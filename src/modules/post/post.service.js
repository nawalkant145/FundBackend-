const Post = require("./post.model");
const ApiError = require("../../utils/ApiError");
const cloudinary = require("../../config/cloudinary");
const { cleanText } = require("../../utils/profanityFilter");
const settingsService = require("../settings/settings.service");

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

const getFeed = async (userId, { cursor, limit = 20 }) => {
  const query = { isDeleted: false };
  if (cursor) query._id = { $lt: cursor };

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate("authorId", "name username avatar companyName isVerified")
    .lean();

  // Enrich with isLiked/isSaved for the requesting user
  const uid = userId.toString();
  const enriched = posts.map((p) => ({
    ...p,
    isLiked: (p.likes || []).some((id) => id.toString() === uid),
    isSaved: (p.saves || []).some((id) => id.toString() === uid),
    likeCount: (p.likes || []).length,
    saveCount: (p.saves || []).length,
  }));

  return {
    posts: enriched,
    nextCursor: posts.length > 0 ? posts[posts.length - 1]._id : null,
    hasMore: posts.length === Number(limit),
  };
};

const getMyPosts = async (userId) => {
  return Post.find({ authorId: userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .lean();
};

const getPostById = async (postId) => {
  const post = await Post.findById(postId)
    .populate("authorId", "name username avatar companyName isVerified")
    .lean();
  if (!post || post.isDeleted) throw new ApiError(404, "Post not found");
  return post;
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
  return post.toObject();
};

const likePost = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");
  // BUG-01 FIX: .indexOf() uses reference equality and always returns -1 for
  // ObjectId objects. Use .findIndex() with .toString() comparison instead.
  const idx = post.likes.findIndex(
    (id) => id.toString() === userId.toString(),
  );
  if (idx === -1) {
    post.likes.push(userId);
  } else {
    post.likes.splice(idx, 1);
  }
  await post.save();
  return { liked: idx === -1, count: post.likes.length };
};

const savePost = async (postId, userId) => {
  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");
  // BUG-01 FIX: same as likePost — .indexOf() always returns -1 for ObjectIds.
  const idx = post.saves.findIndex(
    (id) => id.toString() === userId.toString(),
  );
  if (idx === -1) {
    post.saves.push(userId);
  } else {
    post.saves.splice(idx, 1);
  }
  await post.save();
  return { saved: idx === -1, count: post.saves.length };
};

const getSavedPosts = async (userId) => {
  const posts = await Post.find({ saves: userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .populate("authorId", "name username avatar companyName isVerified")
    .lean();
  const uid = userId.toString();
  return posts.map((p) => ({
    ...p,
    isLiked: (p.likes || []).some((id) => id.toString() === uid),
    isSaved: true,
    likeCount: (p.likes || []).length,
    saveCount: (p.saves || []).length,
  }));
};

const getUserPosts = async (userId, { cursor, limit = 20 }) => {
  const query = { authorId: userId, isDeleted: false };
  if (cursor) query._id = { $lt: cursor };
  return Post.find(query).sort({ createdAt: -1 }).limit(Number(limit)).lean();
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
