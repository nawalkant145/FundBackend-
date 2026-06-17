const Post = require("./post.model");
const ApiError = require("../../utils/ApiError");
const cloudinary = require("../../config/cloudinary");

const MAX_POSTS_PER_DAY = 10;
const MAX_IMAGES = 10;

const createPost = async (userId, files, body) => {
  // Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await Post.countDocuments({
    authorId: userId,
    createdAt: { $gte: today },
  });
  if (count >= MAX_POSTS_PER_DAY) {
    throw new ApiError(
      429,
      `Daily post limit reached (${MAX_POSTS_PER_DAY}/day)`,
    );
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
    caption: caption || "",
    link: link || "",
    hashtags: hashtags
      ? (typeof hashtags === "string" ? hashtags.split(",") : hashtags).map(
          (h) => h.trim().replace(/^#/, ""),
        )
      : [],
  });

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

  return {
    posts,
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
  const idx = post.likes.indexOf(userId);
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
  const idx = post.saves.indexOf(userId);
  if (idx === -1) {
    post.saves.push(userId);
  } else {
    post.saves.splice(idx, 1);
  }
  await post.save();
  return { saved: idx === -1, count: post.saves.length };
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
  getUserPosts,
};
