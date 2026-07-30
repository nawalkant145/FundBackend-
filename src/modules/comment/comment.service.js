const mongoose = require("mongoose");
const Comment = require("./comment.model");
const Video = require("../video/video.model");
const Post = require("../post/post.model");
const ApiError = require("../../utils/ApiError");
const { getClient } = require("../../config/redis");
const { cleanText } = require("../../utils/profanityFilter");
const settingsService = require("../settings/settings.service");
const { toObjectId, enrichComment, enrichComments } = require("../../utils/engagement");

// Invalidate all feed caches so updated comment counts show on refresh
const invalidateFeedCache = async () => {
  try {
    const redis = getClient();
    const keys = await redis.keys("feed:*");
    if (keys.length) await redis.del(...keys);
  } catch {}
};

// Sync exact active comment count to target (Video/Post/Comment)
const syncTargetCommentCount = async ({ videoId, postId, parentId }) => {
  let replyCount = 0;
  let commentCount = 0;

  if (parentId) {
    replyCount = await Comment.countDocuments({
      parentId,
      isDeleted: false,
      isHidden: false,
    });
    await Comment.findByIdAndUpdate(parentId, { replyCount });
  }

  if (videoId) {
    commentCount = await Comment.countDocuments({
      videoId,
      isDeleted: false,
      isHidden: false,
    });
    await Video.findByIdAndUpdate(videoId, { commentCount });
    await invalidateFeedCache();
  } else if (postId) {
    commentCount = await Comment.countDocuments({
      postId,
      isDeleted: false,
      isHidden: false,
    });
    await Post.findByIdAndUpdate(postId, { commentCount });
    await invalidateFeedCache();
  }
  return { commentCount, replyCount };
};

const create = async (userId, { videoId, postId, text, parentId }) => {
  if (!text || !text.trim()) throw new ApiError(400, "Comment text required");
  if (!videoId && !postId) {
    throw new ApiError(400, "videoId or postId required");
  }

  if (videoId && !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }
  if (postId && !mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(400, "Invalid post ID");
  }

  // Resolve the target (video OR post)
  if (videoId) {
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");
    if (video.status !== "active") {
      throw new ApiError(400, "Cannot comment on inactive pitch");
    }
  } else {
    const post = await Post.findById(postId);
    if (!post || post.isDeleted) throw new ApiError(404, "Post not found");
  }

  if (parentId) {
    const parent = await Comment.findById(parentId);
    const sameTarget = videoId
      ? parent?.videoId?.toString() === videoId.toString()
      : parent?.postId?.toString() === postId.toString();
    if (!parent || !sameTarget) {
      throw new ApiError(404, "Parent comment not found");
    }
  }

  const settings = await settingsService.getSettings().catch(() => ({}));
  const extraWords = settings.customBannedWords || [];
  const filterOn = settings.profanityFilterEnabled !== false;

  const comment = await Comment.create({
    videoId: videoId || null,
    postId: postId || null,
    userId,
    parentId: parentId || null,
    text: filterOn ? cleanText(text.trim(), extraWords) : text.trim(),
  });

  const { commentCount, replyCount } = await syncTargetCommentCount({
    videoId,
    postId,
    parentId,
  });

  // Auto-flag for admin review if the original text had profanity
  try {
    const moderation = require("../moderation/moderation.service");
    moderation
      .flagIfNeeded({
        contentType: "comment",
        contentId: comment._id,
        authorId: userId,
        text,
        extraWords,
      })
      .catch(() => {});
  } catch {}

  const populated = await comment.populate(
    "userId",
    "name username avatar role isVerified",
  );
  const enrichedComment = enrichComment(populated.toObject(), userId);

  // Broadcast new comment to all clients watching this video/post
  try {
    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) {
      if (videoId) {
        const vId = videoId.toString();
        io.emit("comment:new", {
          videoId: vId,
          comment: enrichedComment,
          commentCount,
          replyCount,
          parentId: parentId ? parentId.toString() : null,
        });
        io.emit("pitch:engagement", { videoId: vId, commentCount });
      } else if (postId) {
        const pId = postId.toString();
        io.emit("comment:new", {
          postId: pId,
          comment: enrichedComment,
          commentCount,
          replyCount,
          parentId: parentId ? parentId.toString() : null,
        });
        io.emit("post:engagement", { postId: pId, commentCount });
      }
    }
  } catch {}

  return enrichedComment;
};

const list = async (
  target,
  { cursor, limit = 20, parentId = null, viewerId = null } = {},
) => {
  limit = Math.min(Number(limit) || 20, 50);
  if (target.videoId && !mongoose.Types.ObjectId.isValid(target.videoId)) {
    return { comments: [], nextCursor: null, hasMore: false };
  }
  if (target.postId && !mongoose.Types.ObjectId.isValid(target.postId)) {
    return { comments: [], nextCursor: null, hasMore: false };
  }

  // Normalize parentId (handle string "null", "undefined", etc.)
  let normalizedParentId = null;
  if (
    parentId &&
    parentId !== "null" &&
    parentId !== "undefined" &&
    mongoose.Types.ObjectId.isValid(parentId)
  ) {
    normalizedParentId = toObjectId(parentId);
  }

  const q = { parentId: normalizedParentId, isDeleted: false, isHidden: false };
  if (target.videoId) q.videoId = target.videoId;
  if (target.postId) q.postId = target.postId;
  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    q._id = { $lt: toObjectId(cursor) };
  }

  const items = await Comment.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("userId", "name username avatar role isVerified")
    .lean();

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const enriched = enrichComments(page, viewerId);

  return {
    comments: enriched,
    nextCursor: hasMore ? page[page.length - 1]._id : null,
    hasMore,
  };
};

const update = async (commentId, userId, text) => {
  if (!text || !text.trim()) throw new ApiError(400, "Text required");
  if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId);
  if (!comment || comment.isDeleted) throw new ApiError(404, "Comment not found");

  if (comment.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "Not authorized to edit this comment");
  }

  comment.text = cleanText(text.trim());
  comment.isEdited = true;
  await comment.save();

  const populated = await comment.populate(
    "userId",
    "name username avatar role isVerified",
  );
  const enrichedComment = enrichComment(populated.toObject(), userId);

  // Broadcast edit to all clients watching this video/post
  try {
    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) {
      io.emit("comment:updated", {
        commentId: comment._id.toString(),
        videoId: comment.videoId ? comment.videoId.toString() : null,
        postId: comment.postId ? comment.postId.toString() : null,
        parentId: comment.parentId ? comment.parentId.toString() : null,
        comment: enrichedComment,
        text: comment.text,
        isEdited: true,
      });
    }
  } catch {}

  return enrichedComment;
};

const remove = async (commentId, userId) => {
  if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, "Invalid comment ID");
  }

  const comment = await Comment.findById(commentId);
  if (!comment || comment.isDeleted) {
    throw new ApiError(404, "Comment not found");
  }

  let videoId = comment.videoId;
  let postId = comment.postId;
  let parentId = comment.parentId;

  if (parentId && !videoId && !postId) {
    const parent = await Comment.findById(parentId);
    if (parent) {
      videoId = videoId || parent.videoId;
      postId = postId || parent.postId;
    }
  }

  const uidStr = userId.toString();
  let isAuthorized = comment.userId.toString() === uidStr;

  if (!isAuthorized && videoId) {
    const video = await Video.findById(videoId);
    if (video && video.founderId && video.founderId.toString() === uidStr) {
      isAuthorized = true;
    }
  } else if (!isAuthorized && postId) {
    const post = await Post.findById(postId);
    if (post && post.authorId && post.authorId.toString() === uidStr) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    throw new ApiError(403, "Not authorized to delete this comment");
  }

  // Soft delete target comment
  comment.isDeleted = true;
  comment.text = "[deleted]";
  await comment.save();

  // If top-level comment, soft-delete child replies
  if (!parentId) {
    await Comment.updateMany(
      { parentId: comment._id },
      { isDeleted: true, text: "[deleted]" },
    );
  }

  const { commentCount, replyCount } = await syncTargetCommentCount({
    videoId,
    postId,
    parentId,
  });

  // Broadcast deletion to all clients watching this video/post
  try {
    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) {
      const payload = {
        commentId: comment._id.toString(),
        videoId: videoId ? videoId.toString() : null,
        postId: postId ? postId.toString() : null,
        parentId: parentId ? parentId.toString() : null,
        commentCount,
        replyCount,
      };
      io.emit("comment:deleted", payload);

      if (videoId) {
        io.emit("pitch:engagement", { videoId: videoId.toString(), commentCount });
      } else if (postId) {
        io.emit("post:engagement", { postId: postId.toString(), commentCount });
      }
    }
  } catch {}

  return { deleted: true, commentCount, replyCount };
};

const like = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, "Comment not found");

  const uid = toObjectId(userId);
  const uidStr = userId.toString();

  const liked = (comment.likes || []).some(
    (id) => id && id.toString() === uidStr,
  );

  const updatedComment = liked
    ? await Comment.findByIdAndUpdate(
        commentId,
        { $pull: { likes: { $in: [uid, uidStr] } } },
        { new: true },
      )
    : await Comment.findByIdAndUpdate(
        commentId,
        { $addToSet: { likes: uid } },
        { new: true },
      );

  const total = (updatedComment.likes || []).length;
  const result = {
    commentId: commentId.toString(),
    videoId: comment.videoId ? comment.videoId.toString() : null,
    postId: comment.postId ? comment.postId.toString() : null,
    parentId: comment.parentId ? comment.parentId.toString() : null,
    liked: !liked,
    isLiked: !liked,
    totalLikes: total,
    likeCount: total,
    count: total,
  };

  // Broadcast comment like update to all connected clients
  try {
    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) {
      io.emit("comment:liked", result);
    }
  } catch {}

  return result;
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
