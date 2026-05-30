const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const userService = require("./user.service");

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user._id);
  res.json(new ApiResponse(200, { user }, "Profile fetched"));
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body);
  res.json(new ApiResponse(200, { user }, "Profile updated"));
});

const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Avatar image required");
  const user = await userService.uploadAvatar(req.user._id, req.file);
  res.json(new ApiResponse(200, { user }, "Avatar updated"));
});

const uploadPitchDeck = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Pitch deck file required");
  const user = await userService.uploadPitchDeck(req.user._id, req.file);
  res.json(new ApiResponse(200, { user }, "Pitch deck uploaded"));
});

const submitDocuments = asyncHandler(async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    throw new ApiError(400, "At least one document required");
  }
  const user = await userService.submitDocuments(req.user._id, req.files);
  res.json(new ApiResponse(200, { user }, "Documents submitted"));
});

const getVerificationStatus = asyncHandler(async (req, res) => {
  const u = req.user;
  res.json(
    new ApiResponse(
      200,
      {
        verificationLevel: u.verificationLevel,
        isEmailVerified: u.isEmailVerified,
        isPhoneVerified: u.isPhoneVerified,
        documents: u.documents,
        isVerified: u.isVerified,
      },
      "Verification status",
    ),
  );
});

const updateFcmToken = asyncHandler(async (req, res) => {
  await userService.updateFcmToken(req.user._id, req.body.fcmToken);
  res.json(new ApiResponse(200, null, "FCM token saved"));
});

const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await userService.getPublicProfile(
    req.user._id,
    req.params.userId,
  );
  res.json(new ApiResponse(200, { user }, "Public profile"));
});

const getProfileViewers = asyncHandler(async (req, res) => {
  const result = await userService.getProfileViewers(req.user._id, req.query);
  res.json(new ApiResponse(200, result, "Profile viewers"));
});

const blockUser = asyncHandler(async (req, res) => {
  const result = await userService.blockUser(req.user._id, req.params.userId);
  res.json(new ApiResponse(200, result, "User blocked"));
});

const unblockUser = asyncHandler(async (req, res) => {
  const result = await userService.unblockUser(req.user._id, req.params.userId);
  res.json(new ApiResponse(200, result, "User unblocked"));
});

const deleteAccount = asyncHandler(async (req, res) => {
  await userService.deleteAccount(req.user._id);
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json(new ApiResponse(200, null, "Account deactivated"));
});

const search = asyncHandler(async (req, res) => {
  const result = await userService.search(req.query);
  res.json(new ApiResponse(200, result, "Search results"));
});

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  uploadPitchDeck,
  submitDocuments,
  getVerificationStatus,
  updateFcmToken,
  getPublicProfile,
  getProfileViewers,
  blockUser,
  unblockUser,
  deleteAccount,
  search,
};
