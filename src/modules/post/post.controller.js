const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const postService = require("./post.service");

const create = asyncHandler(async (req, res) => {
  const post = await postService.createPost(
    req.user._id,
    req.files,
    req.body,
    req.user.role,
  );
  res.status(201).json(new ApiResponse(201, { post }, "Post created"));
});

                                                             
const createThoughts = asyncHandler(async (req, res) => {
  const post = await postService.createPost(
    req.user._id,
    [],                        
    { ...req.body, type: "text" },                      
    req.user.role,
  );
  res.status(201).json(new ApiResponse(201, { post }, "Thought posted"));
});

const feed = asyncHandler(async (req, res) => {
  const result = await postService.getFeed(req.user._id, {
    cursor: req.query.cursor,
    limit: req.query.limit,
  });
  res.json(new ApiResponse(200, result, "Post feed"));
});

const myPosts = asyncHandler(async (req, res) => {
  const posts = await postService.getMyPosts(req.user._id);
  res.json(new ApiResponse(200, { posts }, "My posts"));
});

const getOne = asyncHandler(async (req, res) => {
  const post = await postService.getPostById(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { post }, "Post fetched"));
});

const remove = asyncHandler(async (req, res) => {
  await postService.deletePost(req.params.id, req.user._id);
  res.json(new ApiResponse(200, null, "Post deleted"));
});

const update = asyncHandler(async (req, res) => {
  const post = await postService.updatePost(
    req.params.id,
    req.user._id,
    req.body,
  );
  res.json(new ApiResponse(200, { post }, "Post updated"));
});

const like = asyncHandler(async (req, res) => {
  const result = await postService.likePost(req.params.id, req.user._id);
  res.json(new ApiResponse(200, result, "Like toggled"));
});

const save = asyncHandler(async (req, res) => {
  const result = await postService.savePost(req.params.id, req.user._id);
  res.json(new ApiResponse(200, result, "Save toggled"));
});

const savedPosts = asyncHandler(async (req, res) => {
  const posts = await postService.getSavedPosts(req.user._id);
  res.json(new ApiResponse(200, { posts }, "Saved posts"));
});

const userPosts = asyncHandler(async (req, res) => {
  const posts = await postService.getUserPosts(req.params.userId, {
    cursor: req.query.cursor,
    limit: req.query.limit,
    viewerId: req.user._id,
  });
  res.json(new ApiResponse(200, { posts }, "User posts"));
});

module.exports = {
  create,
  createThoughts,
  feed,
  myPosts,
  getOne,
  remove,
  update,
  like,
  save,
  savedPosts,
  userPosts,
};
