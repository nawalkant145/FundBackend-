const Comment = require("./comment.model");
const Video = require("../video/video.model");
const ApiError = require("../../utils/ApiError");

const create = async (userId, { videoId, text, parentId }) => {
  if (!text || !text.trim()) throw new ApiError(400, "Comment text required");
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (video.status !== "active") {
    throw new ApiError(400, "Cannot comment on inactive pitch");
  }

  if (parentId) {
    const parent = await Comment.findById(parentId);
    if (!parent || parent.videoId.toString() !== videoId.toString()) {
      throw new ApiError(404, "Parent comment not found");
    }
  }

  const comment = await Comment.create({
    videoId,
    userId,
    parentId: parentId || null,
    text: text.trim(),
  });

  if (parentId) {
    await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
  }
  return comment.populate("userId", "name avatar role isVerified");
};

const list = async (videoId, { cursor, limit = 20, parentId = null } = {}) => {
  limit = Math.min(Number(limit) || 20, 50);
  const q = { videoId, parentId, isDeleted: false, isHidden: false };
  if (cursor) q._id = { $lt: cursor };
  const items = await Comment.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("userId", "name avatar role isVerified")
    .lean();
  const hasMore = items.length > limit;
  return {
    comments: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

const update = async (commentId, userId, text) => {
  if (!text || !text.trim()) throw new ApiError(400, "Text required");
  const comment = await Comment.findOne({ _id: commentId, userId });
  if (!comment) throw new ApiError(404, "Comment not found");
  comment.text = text.trim();
  comment.isEdited = true;
  await comment.save();
  return comment;
};

const remove = async (commentId, userId) => {
  const comment = await Comment.findOne({ _id: commentId, userId });
  if (!comment) throw new ApiError(404, "Comment not found");
  comment.isDeleted = true;
  comment.text = "[deleted]";
  await comment.save();
  if (comment.parentId) {
    await Comment.findByIdAndUpdate(comment.parentId, {
      $inc: { replyCount: -1 },
    });
  }
  return { deleted: true };
};

const like = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, "Comment not found");
  const liked = comment.likes.some((id) => id.toString() === userId.toString());
  if (liked) {
    comment.likes = comment.likes.filter(
      (id) => id.toString() !== userId.toString(),
    );
  } else {
    comment.likes.push(userId);
  }
  await comment.save();
  return { liked: !liked, totalLikes: comment.likes.length };
};

// Admin
const adminHide = async (commentId) => {
  const c = await Comment.findByIdAndUpdate(
    commentId,
    { isHidden: true },
    { new: true },
  );
  if (!c) throw new ApiError(404, "Comment not found");
  return c;
};

const adminUnhide = async (commentId) => {
  const c = await Comment.findByIdAndUpdate(
    commentId,
    { isHidden: false },
    { new: true },
  );
  if (!c) throw new ApiError(404, "Comment not found");
  return c;
};

module.exports = { create, list, update, remove, like, adminHide, adminUnhide };
