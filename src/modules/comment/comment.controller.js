const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const commentService = require("./comment.service");
const notif = require("../notification/notification.service");
const Video = require("../video/video.model");
const Post = require("../post/post.model");

const create = asyncHandler(async (req, res) => {
  const comment = await commentService.create(req.user._id, req.body);
  // Notify the content owner of a new comment (top-level only, not own content)
  try {
    if (req.body.videoId) {
      const video = await Video.findById(req.body.videoId);
      if (video && video.founderId.toString() !== req.user._id.toString()) {
        notif
          .send(video.founderId, {
            type: "system",
            title: `${req.user.name} commented on your pitch`,
            body: req.body.text.slice(0, 100),
            data: {
              videoId: video._id.toString(),
              commentId: comment._id.toString(),
            },
          })
          .catch(() => {});
      }
    } else if (req.body.postId) {
      const post = await Post.findById(req.body.postId);
      if (post && post.authorId.toString() !== req.user._id.toString()) {
        notif
          .send(post.authorId, {
            type: "system",
            title: `${req.user.name} commented on your post`,
            body: req.body.text.slice(0, 100),
            data: {
              postId: post._id.toString(),
              commentId: comment._id.toString(),
            },
          })
          .catch(() => {});
      }
    }
  } catch {}
  res.status(201).json(new ApiResponse(201, { comment }, "Comment posted"));
});

const list = asyncHandler(async (req, res) => {
  const result = await commentService.list(
    { videoId: req.params.videoId },
    {
      cursor: req.query.cursor,
      limit: req.query.limit,
      parentId: req.query.parentId || null,
    },
  );
  res.json(new ApiResponse(200, result, "Comments"));
});

const listByPost = asyncHandler(async (req, res) => {
  const result = await commentService.list(
    { postId: req.params.postId },
    {
      cursor: req.query.cursor,
      limit: req.query.limit,
      parentId: req.query.parentId || null,
    },
  );
  res.json(new ApiResponse(200, result, "Comments"));
});

const update = asyncHandler(async (req, res) => {
  const c = await commentService.update(
    req.params.id,
    req.user._id,
    req.body.text,
  );
  res.json(new ApiResponse(200, { comment: c }, "Comment updated"));
});

const remove = asyncHandler(async (req, res) => {
  await commentService.remove(req.params.id, req.user._id);
  res.json(new ApiResponse(200, null, "Comment deleted"));
});

const like = asyncHandler(async (req, res) => {
  const result = await commentService.like(req.params.id, req.user._id);
  res.json(new ApiResponse(200, result, "Like toggled"));
});

module.exports = { create, list, listByPost, update, remove, like };
