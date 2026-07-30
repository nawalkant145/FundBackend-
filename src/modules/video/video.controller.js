const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const videoService = require("./video.service");

const upload = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title || title.trim().length < 3) {
    throw new ApiError(400, "Title required (min 3 chars)");
  }
  if (!req.file) throw new ApiError(400, "Video file required");
  const video = await videoService.uploadPitch(
    req.user._id,
    req.file,
    req.body,
  );
  res.status(201).json(new ApiResponse(201, { video }, "Pitch uploaded"));
});

const feed = asyncHandler(async (req, res) => {
  const result = await videoService.getFeed(req.user._id, {
    cursor: req.query.cursor,
    limit: req.query.limit,
  });
  res.json(new ApiResponse(200, result, "Feed fetched"));
});

const trending = asyncHandler(async (req, res) => {
  const videos = await videoService.getTrending({
    limit: req.query.limit,
    userId: req.user._id,
  });
  res.json(new ApiResponse(200, { videos }, "Trending pitches"));
});

const search = asyncHandler(async (req, res) => {
  const result = await videoService.searchVideos({
    ...req.query,
    userId: req.user._id,
  });
  res.json(new ApiResponse(200, result, "Search results"));
});

const getOne = asyncHandler(async (req, res) => {
  const video = await videoService.getVideoById(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { video }, "Video fetched"));
});

const update = asyncHandler(async (req, res) => {
  const video = await videoService.updateVideo(
    req.params.id,
    req.user._id,
    req.body,
  );
  res.json(new ApiResponse(200, { video }, "Video updated"));
});

const remove = asyncHandler(async (req, res) => {
  await videoService.deleteVideo(req.params.id, req.user._id);
  res.json(new ApiResponse(200, null, "Video deleted"));
});

const like = asyncHandler(async (req, res) => {
  const result = await videoService.likeVideo(req.params.id, req.user._id);
  res.json(new ApiResponse(200, result, "Like toggled"));
});

const save = asyncHandler(async (req, res) => {
  const result = await videoService.saveVideo(req.params.id, req.user._id);
  res.json(new ApiResponse(200, result, "Save toggled"));
});

const notInterested = asyncHandler(async (req, res) => {
  const result = await videoService.markNotInterested(
    req.params.id,
    req.user._id,
  );
  res.json(new ApiResponse(200, result, "Marked not interested"));
});

const logView = asyncHandler(async (req, res) => {
  const result = await videoService.logView(
    req.params.id,
    req.user._id,
    Number(req.body.watchedSeconds || 0),
  );
  res.json(new ApiResponse(200, result, "View logged"));
});

const myPitches = asyncHandler(async (req, res) => {
  const videos = await videoService.getMyPitches(req.user._id);
  res.json(new ApiResponse(200, { videos }, "My pitches"));
});

const userPitches = asyncHandler(async (req, res) => {
  const videos = await videoService.getUserPitches(
    req.params.userId,
    req.user._id,
  );
  res.json(new ApiResponse(200, { videos }, "User pitches"));
});

const savedPitches = asyncHandler(async (req, res) => {
  const videos = await videoService.getSavedPitches(req.user._id);
  res.json(new ApiResponse(200, { videos }, "Saved pitches"));
});

const analytics = asyncHandler(async (req, res) => {
  const data = await videoService.getAnalytics(req.params.id, req.user._id);
  res.json(new ApiResponse(200, data, "Analytics"));
});

const renew = asyncHandler(async (req, res) => {
  const video = await videoService.renewPitch(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { video }, "Pitch renewed"));
});

const togglePause = asyncHandler(async (req, res) => {
  const video = await videoService.togglePause(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { video }, "Pitch status toggled"));
});

module.exports = {
  upload,
  feed,
  trending,
  search,
  getOne,
  update,
  remove,
  like,
  save,
  notInterested,
  logView,
  myPitches,
  userPitches,
  savedPitches,
  analytics,
  renew,
  togglePause,
};
