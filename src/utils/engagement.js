/**
 * engagement.js — Single source of truth for all like/save enrichment.
 *
 * WHY THIS EXISTS:
 *   Previously, every service function (getFeed, getTrending, searchVideos,
 *   getUserPitches, getUserPosts, getVideoById, getPostById …) duplicated its
 *   own version of "is this item liked/saved by the current user?". Each copy
 *   had subtle differences (some had null guards, some didn't; some returned
 *   likeCount, others totalLikes). That caused inconsistent UI behaviour —
 *   likes worked on some screens but not others.
 *
 *   This module is the ONE place where that logic lives.  Both post.service.js
 *   and video.service.js import from here.
 */

const mongoose = require("mongoose");

/* ── Primitive helpers ──────────────────────────────────────────────────── */

/**
 * Safely casts any userId / id value to a mongoose.Types.ObjectId.
 * If the value is already an ObjectId, it is returned as-is.
 * If it cannot be cast (invalid string), the original value is returned.
 */
const toObjectId = (id) => {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(String(id))
    : id;
};

/**
 * Returns true if `userId` appears anywhere in `arr`.
 * Handles mixed ObjectId / String arrays and null / undefined elements safely.
 */
const userInArray = (arr, userId) => {
  if (!arr || !arr.length || !userId) return false;
  const target = userId.toString();
  return arr.some((id) => id && id.toString() === target);
};

/* ── Post enrichment ────────────────────────────────────────────────────── */

/**
 * Adds isLiked / isSaved / likeCount / saveCount to a single lean Post object.
 * Safe to call with viewerId = null/undefined (all flags default to false/0).
 */
const enrichPost = (post, viewerId) => {
  if (!post) return post;
  return {
    ...post,
    isLiked: userInArray(post.likes, viewerId),
    isSaved: userInArray(post.saves, viewerId),
    likeCount: (post.likes || []).length,
    saveCount: (post.saves || []).length,
  };
};

/**
 * Enriches every post in an array.
 */
const enrichPosts = (posts, viewerId) => {
  if (!posts || !posts.length) return posts || [];
  return posts.map((p) => enrichPost(p, viewerId));
};

/* ── Video / Pitch enrichment ───────────────────────────────────────────── */

/**
 * Adds isLiked / isSaved / likeCount / saveCount to a single lean Video object.
 * commentCount is left untouched (handled by video.service.js separately).
 * Safe to call with viewerId = null/undefined.
 */
const enrichVideo = (video, viewerId) => {
  if (!video) return video;
  return {
    ...video,
    isLiked: userInArray(video.likes, viewerId),
    isSaved: userInArray(video.saves, viewerId),
    likeCount: (video.likes || []).length,
    saveCount: (video.saves || []).length,
  };
};

/**
 * Enriches every video in an array.
 */
const enrichVideos = (videos, viewerId) => {
  if (!videos || !videos.length) return videos || [];
  return videos.map((v) => enrichVideo(v, viewerId));
};
/* ── Comment enrichment ─────────────────────────────────────────────────── */

/**
 * Adds isLiked / likeCount / replyCount to a single lean Comment object.
 * Safe to call with viewerId = null/undefined.
 */
const enrichComment = (comment, viewerId) => {
  if (!comment) return comment;
  return {
    ...comment,
    isLiked: userInArray(comment.likes, viewerId),
    likeCount: (comment.likes || []).length,
    replyCount: comment.replyCount || 0,
  };
};

/**
 * Enriches every comment in an array.
 */
const enrichComments = (comments, viewerId) => {
  if (!comments || !comments.length) return comments || [];
  return comments.map((c) => enrichComment(c, viewerId));
};

module.exports = {
  toObjectId,
  userInArray,
  enrichPost,
  enrichPosts,
  enrichVideo,
  enrichVideos,
  enrichComment,
  enrichComments,
};
