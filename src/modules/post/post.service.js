const mongoose = require("mongoose");
const Post = require("./post.model");
const ApiError = require("../../utils/ApiError");
const cloudinary = require("../../config/cloudinary");
const { cleanText } = require("../../utils/profanityFilter");
const settingsService = require("../settings/settings.service");
const {
  toObjectId,
  enrichPost,
  enrichPosts,
} = require("../../utils/engagement");

const MAX_POSTS_PER_DAY = 10;
const MAX_IMAGES = 10;

const createPost = async (userId, files, body) => {
  const settings = await settingsService.getSettings().catch(() => ({}));
  if (settings.postsEnabled === false) {
    throw new ApiError(403, "Posting is temporarily disabled by admin");
  }
  const dailyLimit = settings.maxPostsPerDay || MAX_POSTS_PER_DAY;

  // Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await Post.countDocuments({
    authorId: userId,
    createdAt: { $gte: today },
  });
  if (count >= dailyLimit) {
    throw new ApiError(429, `Daily post limit reached (${dailyLimit}/day)`);
  }

  const { caption, link, hashtags, type } = body;

  // Upload images to Cloudinary
  let imageUrls = [];
  if (files?.length > 0) {
    if (files.length > MAX_IMAGES) {
      throw new ApiError(400, `Max ${MAX_IMAGES} images allowed`);
    }
    const uploads = await Promise.all(
      files.map((f) =>
        cloudinary.uploader.upload(f.path || f.buffer?.toString("base64"), {
          folder: "posts",
          resource_type: "image",
          transformation: [
            { width: 1080, height: 1080, crop: "limit", quality: "auto" },
          ],
        }),
      ),
    );
    imageUrls = uploads.map((u) => u.secure_url);
  }

  const post = await Post.create({
    authorId: userId,
    type: type || (imageUrls.length > 0 ? "images" : "text"),
    images: imageUrls,
    caption:
      settings.profanityFilterEnabled !== false
        ? cleanText(caption || "", settings.customBannedWords || [])
        : caption || "",
    link: link || "",
    hashtags: hashtags
      ? (typeof hashtags === "string" ? hashtags.split(",") : hashtags).map(
          (h) => h.trim().replace(/^#/, ""),
        )
      : [],
  });

  // Auto-flag caption for admin review if it had profanity
  try {
    const moderation = require("../moderation/moderation.service");
    moderation
      .flagIfNeeded({
        contentType: "post",
        contentId: post._id,
        authorId: userId,
        text: caption || "",
        extraWords: settings.customBannedWords || [],
      })
      .catch(() => {});
  } catch {}

  return post.toObject();
};

// enrichPost / enrichPosts are now imported from src/utils/engagement.js

const getFeed = async (userId, { cursor, limit = 20 }) => {
  const query = { isDeleted: false };
  if (cursor) query._id = { $lt: cursor };

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate("authorId", "name username avatar role companyName isVerified")
    .lean();

  const enriched = enrichPosts(posts, userId);

  return {
    posts: enriched,
    nextCursor: posts.length > 0 ? posts[posts.length - 1]._id : null,
    hasMore: posts.length === Number(limit),
  };
};

const getMyPosts = async (userId) => {
  const posts = await Post.find({ authorId: userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .populate("authorId", "name username avatar role companyName isVerified")
    .lean();
  return enrichPosts(posts, userId);
};

const getPostById = async (postId, userId) => {
  const post = await Post.findById(postId)
    .populate("authorId", "name username avatar role companyName isVerified")
    .lean();
  if (!post || post.isDeleted) throw new ApiError(404, "Post not found");
  return enrichPost(post, userId);
};

const deletePost = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");
  if (post.authorId.toString() !== userId.toString()) {
    throw new ApiError(403, "Not your post");
  }
  post.isDeleted = true;
  await post.save();
};

const updatePost = async (postId, userId, body) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");
  if (post.authorId.toString() !== userId.toString()) {
    throw new ApiError(403, "Not your post");
  }
  if (body.caption !== undefined) post.caption = body.caption;
  if (body.link !== undefined) post.link = body.link;
  if (body.hashtags !== undefined) {
    post.hashtags = (
      typeof body.hashtags === "string"
        ? body.hashtags.split(",")
        : body.hashtags
    ).map((h) => h.trim().replace(/^#/, ""));
  }
  await post.save();
  // Re-fetch as lean with populated author so the response is consistent
  const fresh = await Post.findById(post._id)
    .populate("authorId", "name username avatar role companyName isVerified")
    .lean();
  return enrichPost(fresh, userId);
};

const likePost = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");

  const uid = toObjectId(userId);
  const uidStr = userId.toString();

  const liked = (post.likes || []).some(
    (id) => id && id.toString() === uidStr,
  );

  let updatedPost;
  if (liked) {
    updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $pull: { likes: { $in: [uid, uidStr] } } },
      { new: true },
    );
  } else {
    updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $addToSet: { likes: uid } },
      { new: true },
    );
  }

  // Send notification to post author when liked (if not liking own post)
  if (!liked && post.authorId && post.authorId.toString() !== uidStr) {
    try {
      const notif = require("../notification/notification.service");
      const User = require("../user/user.model");
      const liker = await User.findById(userId).select("name");
      await notif.send(post.authorId, {
        type: "like",
        title: `${liker?.name || "Someone"} liked your post`,
        body: post.caption ? post.caption.slice(0, 80) : "Your post",
        data: { postId: post._id.toString(), likerId: uidStr },
      });
    } catch (e) {
      console.error("Failed to send post like notification:", e);
    }
  }

  const total = (updatedPost.likes || []).length;
  const result = {
    liked: !liked,
    likeCount: total,
    count: total,
    totalLikes: total,
  };

  // Broadcast real-time engagement update to all connected clients
  try {
    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) {
      io.emit("post:engagement", {
        postId: postId.toString(),
        liked: !liked,
        likeCount: total,
        count: total,
        totalLikes: total,
      });
    }
  } catch {}

  return result;
};

const savePost = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");

  const uid = toObjectId(userId);
  const uidStr = userId.toString();

  const saved = (post.saves || []).some(
    (id) => id && id.toString() === uidStr,
  );

  let updatedPost;
  if (saved) {
    updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $pull: { saves: { $in: [uid, uidStr] } } },
      { new: true },
    );
  } else {
    updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $addToSet: { saves: uid } },
      { new: true },
    );
  }

  // Send notification to post author when saved (if not saving own post)
  if (!saved && post.authorId && post.authorId.toString() !== uidStr) {
    try {
      const notif = require("../notification/notification.service");
      const User = require("../user/user.model");
      const saver = await User.findById(userId).select("name");
      await notif.send(post.authorId, {
        type: "save",
        title: `${saver?.name || "Someone"} saved your post`,
        body: post.caption ? post.caption.slice(0, 80) : "Your post",
        data: { postId: post._id.toString(), saverId: uidStr },
      });
    } catch (e) {
      console.error("Failed to send post save notification:", e);
    }
  }

  const total = (updatedPost.saves || []).length;
  const result = {
    saved: !saved,
    saveCount: total,
    count: total,
    totalSaves: total,
  };

  // Broadcast real-time engagement update to all connected clients
  try {
    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) {
      io.emit("post:engagement", {
        postId: postId.toString(),
        saved: !saved,
        saveCount: total,
        count: total,
        totalSaves: total,
      });
    }
  } catch {}

  return result;
};

const getSavedPosts = async (userId) => {
  // Explicitly cast to ObjectId so Mongoose array queries always match
  const uid = toObjectId(userId);

  const posts = await Post.find({ saves: uid, isDeleted: false })
    .sort({ createdAt: -1 })
    .populate("authorId", "name username avatar role companyName isVerified")
    .lean();

  const enriched = enrichPosts(posts, userId);
  // Ensure isSaved is explicitly true for all saved posts
  return enriched.map((p) => ({ ...p, isSaved: true }));
};

const getUserPosts = async (userIdOrUsername, { cursor, limit = 20, viewerId }) => {
  const userService = require("../user/user.service");
  const targetId =
    (await userService.resolveUserId(userIdOrUsername)) || userIdOrUsername;
  const query = { authorId: targetId, isDeleted: false };
  if (cursor) query._id = { $lt: cursor };
  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate("authorId", "name username avatar role companyName isVerified")
    .lean();
  return enrichPosts(posts, viewerId);
};

module.exports = {
  createPost,
  getFeed,
  getMyPosts,
  getPostById,
  deletePost,
  updatePost,
  likePost,
  savePost,
  getSavedPosts,
  getUserPosts,
};
