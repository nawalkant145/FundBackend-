const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const adminService = require("./admin.service");

// Dashboard
const dashboard = asyncHandler(async (req, res) => {
  const data = await adminService.dashboard();
  res.json(new ApiResponse(200, data, "Dashboard"));
});

const stats = asyncHandler(async (req, res) => {
  const data = await adminService.stats({ days: req.query.days });
  res.json(new ApiResponse(200, data, "Stats"));
});

// Users
const listUsers = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(200, await adminService.listUsers(req.query), "Users"),
  );
});
const getUserDetails = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(
      200,
      await adminService.getUserDetails(req.params.id),
      "User details",
    ),
  );
});
const banUser = asyncHandler(async (req, res) => {
  const u = await adminService.banUser(
    req.params.id,
    req.body.reason,
    req.user._id,
  );
  res.json(new ApiResponse(200, { user: u }, "User banned"));
});
const unbanUser = asyncHandler(async (req, res) => {
  const u = await adminService.unbanUser(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { user: u }, "User unbanned"));
});
const editUser = asyncHandler(async (req, res) => {
  const u = await adminService.editUser(req.params.id, req.body, req.user._id);
  res.json(new ApiResponse(200, { user: u }, "User updated"));
});
const resetUserPassword = asyncHandler(async (req, res) => {
  await adminService.resetUserPassword(
    req.params.id,
    req.body.newPassword,
    req.user._id,
  );
  res.json(new ApiResponse(200, null, "Password reset"));
});
const promoteToAdmin = asyncHandler(async (req, res) => {
  const u = await adminService.promoteToAdmin(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { user: u }, "User promoted to admin"));
});
const demoteAdmin = asyncHandler(async (req, res) => {
  const u = await adminService.demoteAdmin(
    req.params.id,
    req.user._id,
    req.body.role,
  );
  res.json(new ApiResponse(200, { user: u }, "Admin demoted"));
});
const deleteUserHard = asyncHandler(async (req, res) => {
  await adminService.deleteUserHard(req.params.id, req.user._id);
  res.json(new ApiResponse(200, null, "User permanently deleted"));
});

// Videos
const listVideos = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(200, await adminService.listVideos(req.query), "Videos"),
  );
});
const pendingVideos = asyncHandler(async (req, res) => {
  const videos = await adminService.pendingVideos();
  res.json(new ApiResponse(200, { videos }, "Pending videos"));
});
const approveVideo = asyncHandler(async (req, res) => {
  const v = await adminService.approveVideo(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { video: v }, "Video approved"));
});
const rejectVideo = asyncHandler(async (req, res) => {
  const v = await adminService.rejectVideo(
    req.params.id,
    req.body.reason,
    req.user._id,
  );
  res.json(new ApiResponse(200, { video: v }, "Video rejected"));
});
const boostVideo = asyncHandler(async (req, res) => {
  const v = await adminService.boostVideo(
    req.params.id,
    req.body.days,
    req.user._id,
  );
  res.json(new ApiResponse(200, { video: v }, "Video boosted"));
});
const removeBoost = asyncHandler(async (req, res) => {
  const v = await adminService.removeBoost(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { video: v }, "Boost removed"));
});
const forceDeleteVideo = asyncHandler(async (req, res) => {
  await adminService.forceDeleteVideo(
    req.params.id,
    req.user._id,
    req.body.reason,
  );
  res.json(new ApiResponse(200, null, "Video deleted"));
});

// KYC
const pendingDocuments = asyncHandler(async (req, res) => {
  const users = await adminService.pendingDocuments();
  res.json(new ApiResponse(200, { users }, "Pending KYC"));
});
const approveDocuments = asyncHandler(async (req, res) => {
  const u = await adminService.approveDocuments(
    req.params.userId,
    req.user._id,
  );
  res.json(new ApiResponse(200, { user: u }, "Documents approved"));
});
const rejectDocuments = asyncHandler(async (req, res) => {
  const u = await adminService.rejectDocuments(
    req.params.userId,
    req.body.reason,
    req.user._id,
  );
  res.json(new ApiResponse(200, { user: u }, "Documents rejected"));
});

// Reports
const listReports = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(200, await adminService.listReports(req.query), "Reports"),
  );
});
const resolveReport = asyncHandler(async (req, res) => {
  const r = await adminService.resolveReport(
    req.params.id,
    req.user._id,
    req.body,
  );
  res.json(new ApiResponse(200, { report: r }, "Report resolved"));
});

// Comments
const listAllComments = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(
      200,
      await adminService.listAllComments(req.query),
      "Comments",
    ),
  );
});
const hideComment = asyncHandler(async (req, res) => {
  const c = await adminService.hideComment(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { comment: c }, "Comment hidden"));
});
const unhideComment = asyncHandler(async (req, res) => {
  const c = await adminService.unhideComment(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { comment: c }, "Comment unhidden"));
});
const deleteComment = asyncHandler(async (req, res) => {
  await adminService.deleteComment(req.params.id, req.user._id);
  res.json(new ApiResponse(200, null, "Comment deleted"));
});

// Investments
const listInvestments = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(
      200,
      await adminService.listInvestments(req.query),
      "Investments",
    ),
  );
});
const refundInvestment = asyncHandler(async (req, res) => {
  const inv = await adminService.refundInvestment(
    req.params.id,
    req.user._id,
    req.body.reason,
  );
  res.json(new ApiResponse(200, { investment: inv }, "Refunded"));
});

// Calls / Chats
const listCalls = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(200, await adminService.listCalls(req.query), "Calls"),
  );
});
const listChats = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(200, await adminService.listChats(req.query), "Chats"),
  );
});
const getChatMessages = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(
      200,
      await adminService.getChatMessages(req.params.chatId, req.query),
      "Messages",
    ),
  );
});

// Broadcast
const broadcast = asyncHandler(async (req, res) => {
  const result = await adminService.broadcastNotification(
    req.body,
    req.user._id,
  );
  res.json(new ApiResponse(200, result, "Broadcast sent"));
});

// Audit
const auditLogs = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(200, await adminService.auditLogs(req.query), "Audit logs"),
  );
});

module.exports = {
  dashboard,
  stats,
  listUsers,
  getUserDetails,
  banUser,
  unbanUser,
  editUser,
  resetUserPassword,
  promoteToAdmin,
  demoteAdmin,
  deleteUserHard,
  listVideos,
  pendingVideos,
  approveVideo,
  rejectVideo,
  boostVideo,
  removeBoost,
  forceDeleteVideo,
  pendingDocuments,
  approveDocuments,
  rejectDocuments,
  listReports,
  resolveReport,
  listAllComments,
  hideComment,
  unhideComment,
  deleteComment,
  listInvestments,
  refundInvestment,
  listCalls,
  listChats,
  getChatMessages,
  broadcast,
  auditLogs,
};
