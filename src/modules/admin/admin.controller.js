const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const adminService = require("./admin.service");

// Helper: extract IP + UA from request (for audit logging)
const getReqMeta = (req) => ({
  ip:
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    "",
  userAgent: req.headers["user-agent"] || "",
});

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
const suspendUser = asyncHandler(async (req, res) => {
  const u = await adminService.suspendUser(
    req.params.id,
    req.body.days,
    req.body.reason,
    req.user._id,
  );
  res.json(new ApiResponse(200, { user: u }, "User suspended"));
});
const unsuspendUser = asyncHandler(async (req, res) => {
  const u = await adminService.unsuspendUser(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { user: u }, "Suspension lifted"));
});
const impersonateUser = asyncHandler(async (req, res) => {
  const result = await adminService.impersonateUser(
    req.params.id,
    req.user._id,
  );
  res.json(new ApiResponse(200, result, "Impersonation token issued"));
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
const purgeVideo = asyncHandler(async (req, res) => {
  await adminService.purgeVideo(req.params.id, req.user._id);
  res.json(new ApiResponse(200, null, "Video permanently purged"));
});
const restoreVideo = asyncHandler(async (req, res) => {
  const v = await adminService.restoreVideo(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { video: v }, "Video restored"));
});
const listTrash = asyncHandler(async (req, res) => {
  const data = await adminService.listTrash(req.query);
  res.json(new ApiResponse(200, data, "Trash"));
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
const freezeInvestment = asyncHandler(async (req, res) => {
  const inv = await adminService.freezeInvestment(
    req.params.id,
    req.user._id,
    req.body.reason,
  );
  res.json(new ApiResponse(200, { investment: inv }, "Deal frozen"));
});
const unfreezeInvestment = asyncHandler(async (req, res) => {
  const inv = await adminService.unfreezeInvestment(
    req.params.id,
    req.user._id,
  );
  res.json(new ApiResponse(200, { investment: inv }, "Deal unfrozen"));
});
const exportInvestments = asyncHandler(async (req, res) => {
  const csv = await adminService.exportInvestmentsCsv();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="investments.csv"',
  );
  res.send(csv);
});
const suspiciousActivity = asyncHandler(async (req, res) => {
  const data = await adminService.detectSuspicious();
  res.json(new ApiResponse(200, { suspicious: data }, "Suspicious activity"));
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
const auditActionTypes = asyncHandler(async (req, res) => {
  const audit = require("../audit/audit.service");
  const actions = await audit.actionTypes();
  res.json(new ApiResponse(200, { actions }, "Action types"));
});
const auditExport = asyncHandler(async (req, res) => {
  const audit = require("../audit/audit.service");
  const csv = await audit.exportCsv(req.query);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-log.csv"');
  res.send(csv);
});

// Moderation queue (auto-flagged content)
const moderationService = require("../moderation/moderation.service");
const listFlags = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(200, await moderationService.listFlags(req.query), "Flags"),
  );
});
const resolveFlag = asyncHandler(async (req, res) => {
  const flag = await moderationService.resolveFlag(
    req.params.id,
    req.user._id,
    req.body.action,
  );
  // If the admin chose to remove the content, delete it
  if (req.body.action === "removed" && flag) {
    try {
      if (flag.contentType === "video") {
        await adminService.forceDeleteVideo(
          flag.contentId,
          req.user._id,
          "Removed via moderation queue",
        );
      } else if (flag.contentType === "comment") {
        await adminService.deleteComment(flag.contentId, req.user._id);
      } else if (flag.contentType === "post") {
        const Post = require("../post/post.model");
        await Post.findByIdAndUpdate(flag.contentId, { isDeleted: true });
      }
    } catch {}
  }
  res.json(new ApiResponse(200, { flag }, "Flag resolved"));
});

// Platform settings (feature flags, limits, banned words)
const settingsService = require("../settings/settings.service");
const getSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.getSettings(true);
  res.json(new ApiResponse(200, { settings: data }, "Settings"));
});
const updateSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.updateSettings(req.body, req.user._id);
  res.json(new ApiResponse(200, { settings: data }, "Settings updated"));
});

module.exports = {
  dashboard,
  stats,
  listUsers,
  getUserDetails,
  banUser,
  unbanUser,
  suspendUser,
  unsuspendUser,
  impersonateUser,
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
  purgeVideo,
  restoreVideo,
  listTrash,
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
  freezeInvestment,
  unfreezeInvestment,
  exportInvestments,
  suspiciousActivity,
  listCalls,
  listChats,
  getChatMessages,
  broadcast,
  auditLogs,
  auditActionTypes,
  auditExport,
  listFlags,
  resolveFlag,
  getSettings,
  updateSettings,
};
