const User = require("../user/user.model");
const Video = require("../video/video.model");
const Investment = require("../investment/investment.model");
const Report = require("../report/report.model");
const Call = require("../call/call.model");
const Comment = require("../comment/comment.model");
const Notification = require("../notification/notification.model");
const { Chat, Message } = require("../chat/chat.model");
const ApiError = require("../../utils/ApiError");
const notif = require("../notification/notification.service");
const { sendEmail } = require("../../utils/sendEmail");
const { deleteFromCloudinary } = require("../../utils/cloudinaryUpload");
const audit = require("../audit/audit.service");

// ─── Dashboard ──────────────────────────────────
const dashboard = async () => {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalFounders,
    totalInvestors,
    totalAdmins,
    totalVideos,
    activeVideos,
    processingVideos,
    expiredVideos,
    rejectedVideos,
    pendingDocs,
    pendingReports,
    pendingVideoReviews,
    totalInvestments,
    completedInvestments,
    totalInvested,
    activeCalls,
    totalCalls7d,
    activeChats,
    messages24h,
    todayRegs,
    regs7d,
    bannedUsers,
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: "founder", isActive: true }),
    User.countDocuments({ role: "investor", isActive: true }),
    User.countDocuments({ role: "admin" }),
    Video.countDocuments(),
    Video.countDocuments({ status: "active" }),
    Video.countDocuments({ status: "processing" }),
    Video.countDocuments({ status: "expired" }),
    Video.countDocuments({ status: "rejected" }),
    User.countDocuments({ "documents.status": "pending" }),
    Report.countDocuments({ status: "pending" }),
    Video.countDocuments({ status: "processing" }),
    Investment.countDocuments(),
    Investment.countDocuments({ status: "paid" }),
    Investment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).then((r) => r[0]?.total || 0),
    Call.countDocuments({ status: { $in: ["ringing", "accepted"] } }),
    Call.countDocuments({ createdAt: { $gte: since7d } }),
    Chat.countDocuments({ isActive: true }),
    Message.countDocuments({ createdAt: { $gte: since24h } }),
    User.countDocuments({ createdAt: { $gte: since24h } }),
    User.countDocuments({ createdAt: { $gte: since7d } }),
    User.countDocuments({ isBanned: true }),
  ]);

  return {
    users: {
      total: totalUsers,
      founders: totalFounders,
      investors: totalInvestors,
      admins: totalAdmins,
      banned: bannedUsers,
      newToday: todayRegs,
      new7d: regs7d,
    },
    videos: {
      total: totalVideos,
      active: activeVideos,
      processing: processingVideos,
      expired: expiredVideos,
      rejected: rejectedVideos,
      pendingReview: pendingVideoReviews,
    },
    pending: { documents: pendingDocs, reports: pendingReports },
    investments: {
      total: totalInvestments,
      completed: completedInvestments,
      totalAmount: totalInvested,
    },
    calls: { active: activeCalls, total7d: totalCalls7d },
    chats: { active: activeChats, messages24h },
  };
};

// Stats over time (for charts)
const stats = async ({ days = 30 } = {}) => {
  const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

  const userGrowth = await User.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        founders: { $sum: { $cond: [{ $eq: ["$role", "founder"] }, 1, 0] } },
        investors: { $sum: { $cond: [{ $eq: ["$role", "investor"] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const videoUploads = await Video.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const investmentAmounts = await Investment.aggregate([
    { $match: { status: "paid", paidAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return { userGrowth, videoUploads, investmentAmounts };
};

// ─── User management ────────────────────────────
const listUsers = async ({
  role,
  search,
  status,
  verified,
  limit = 30,
  cursor,
}) => {
  limit = Math.min(Number(limit) || 30, 100);
  const q = {};
  if (role) q.role = role;
  if (status === "banned") q.isBanned = true;
  if (status === "inactive") q.isActive = false;
  if (status === "active") {
    q.isActive = true;
    q.isBanned = false;
  }
  if (verified === "true" || verified === true) q.isVerified = true;
  if (search) {
    q.$or = [
      { name: new RegExp(search, "i") },
      { email: new RegExp(search, "i") },
      { companyName: new RegExp(search, "i") },
      { phone: new RegExp(search, "i") },
    ];
  }
  if (cursor) q._id = { $lt: cursor };
  const users = await User.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = users.length > limit;
  return {
    users: hasMore ? users.slice(0, limit) : users,
    nextCursor: hasMore ? users[limit - 1]._id : null,
    hasMore,
  };
};

const getUserDetails = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const [pitches, investments, chats, calls, reports] = await Promise.all([
    Video.find({ founderId: userId }).select("title status views createdAt"),
    Investment.find({
      $or: [{ founderId: userId }, { investorId: userId }],
    }).select("amount stage status createdAt"),
    Chat.countDocuments({ participants: userId }),
    Call.countDocuments({
      $or: [{ callerId: userId }, { receiverId: userId }],
    }),
    Report.find({
      $or: [{ reportedBy: userId }, { reportedUser: userId }],
    }).select("type status createdAt"),
  ]);

  return {
    user: user.toSafeJSON(),
    pitches,
    investments,
    chatCount: chats,
    callCount: calls,
    reports,
  };
};

const banUser = async (userId, reason, adminId) => {
  if (userId.toString() === adminId.toString()) {
    throw new ApiError(400, "Cannot ban yourself");
  }
  const user = await User.findByIdAndUpdate(
    userId,
    {
      isBanned: true,
      banReason: reason || "Violation",
      refreshToken: undefined,
    },
    { new: true },
  );
  if (!user) throw new ApiError(404, "User not found");
  await Video.updateMany({ founderId: userId }, { status: "rejected" });
  await audit.log({
    actorId: adminId,
    action: "BAN_USER",
    targetType: "User",
    targetId: userId,
    metadata: { reason },
  });
  return user;
};

const unbanUser = async (userId, adminId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isBanned: false, banReason: "" },
    { new: true },
  );
  if (!user) throw new ApiError(404, "User not found");
  await audit.log({
    actorId: adminId,
    action: "UNBAN_USER",
    targetType: "User",
    targetId: userId,
  });
  return user;
};

const editUser = async (userId, updates, adminId) => {
  // Admin can edit limited fields directly
  const allowed = [
    "name",
    "phone",
    "role",
    "companyName",
    "industry",
    "fundingStage",
    "isActive",
    "isVerified",
    "verificationLevel",
    "banReason",
    "isEmailVerified",
    "isPhoneVerified",
  ];
  const sanitized = {};
  for (const k of allowed)
    if (updates[k] !== undefined) sanitized[k] = updates[k];

  const user = await User.findByIdAndUpdate(userId, sanitized, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new ApiError(404, "User not found");
  await audit.log({
    actorId: adminId,
    action: "EDIT_USER",
    targetType: "User",
    targetId: userId,
    metadata: { changes: sanitized },
  });
  return user.toSafeJSON();
};

const resetUserPassword = async (userId, newPassword, adminId) => {
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save();
  await audit.log({
    actorId: adminId,
    action: "RESET_PASSWORD",
    targetType: "User",
    targetId: userId,
  });
  return { ok: true };
};

const promoteToAdmin = async (userId, adminId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { role: "admin" },
    { new: true },
  );
  if (!user) throw new ApiError(404, "User not found");
  await audit.log({
    actorId: adminId,
    action: "PROMOTE_ADMIN",
    targetType: "User",
    targetId: userId,
  });
  return user.toSafeJSON();
};

const demoteAdmin = async (userId, adminId, role) => {
  if (!["founder", "investor"].includes(role)) {
    throw new ApiError(400, "Role must be founder or investor");
  }
  const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  await audit.log({
    actorId: adminId,
    action: "DEMOTE_ADMIN",
    targetType: "User",
    targetId: userId,
    metadata: { newRole: role },
  });
  return user.toSafeJSON();
};

const deleteUserHard = async (userId, adminId) => {
  if (userId.toString() === adminId.toString()) {
    throw new ApiError(400, "Cannot delete yourself");
  }
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  // Cleanup
  const videos = await Video.find({ founderId: userId });
  for (const v of videos) {
    if (v.cloudinaryPublicId) {
      await deleteFromCloudinary(v.cloudinaryPublicId, "video").catch(() => {});
    }
  }
  await Video.deleteMany({ founderId: userId });
  await Comment.deleteMany({ userId });
  await Message.deleteMany({ senderId: userId });
  await Chat.deleteMany({ participants: userId });
  await Notification.deleteMany({ userId });
  await User.findByIdAndDelete(userId);

  await audit.log({
    actorId: adminId,
    action: "HARD_DELETE_USER",
    targetType: "User",
    targetId: userId,
    metadata: { email: user.email, name: user.name },
  });
  return { ok: true };
};

// ─── Video management ───────────────────────────
const listVideos = async ({ status, founderId, limit = 30, cursor }) => {
  limit = Math.min(Number(limit) || 30, 100);
  const q = {};
  if (status) q.status = status;
  if (founderId) q.founderId = founderId;
  if (cursor) q._id = { $lt: cursor };
  const videos = await Video.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("founderId", "name email companyName")
    .lean();
  const hasMore = videos.length > limit;
  return {
    videos: hasMore ? videos.slice(0, limit) : videos,
    nextCursor: hasMore ? videos[limit - 1]._id : null,
    hasMore,
  };
};

const pendingVideos = async () => {
  return Video.find({ status: "processing" })
    .sort({ createdAt: -1 })
    .populate("founderId", "name email companyName");
};

const approveVideo = async (videoId, adminId) => {
  const v = await Video.findByIdAndUpdate(
    videoId,
    { status: "active" },
    { new: true },
  );
  if (!v) throw new ApiError(404, "Video not found");
  await notif.send(v.founderId, {
    type: "system",
    title: "Pitch approved",
    body: "Your pitch is now live in investor feed",
    data: { videoId: v._id.toString() },
  });
  await audit.log({
    actorId: adminId,
    action: "APPROVE_VIDEO",
    targetType: "Video",
    targetId: videoId,
  });
  return v;
};

const rejectVideo = async (videoId, reason, adminId) => {
  const v = await Video.findByIdAndUpdate(
    videoId,
    { status: "rejected", rejectionReason: reason || "" },
    { new: true },
  );
  if (!v) throw new ApiError(404, "Video not found");
  await notif.send(v.founderId, {
    type: "system",
    title: "Pitch rejected",
    body: reason || "Your pitch was not approved",
    data: { videoId: v._id.toString() },
  });
  await audit.log({
    actorId: adminId,
    action: "REJECT_VIDEO",
    targetType: "Video",
    targetId: videoId,
    metadata: { reason },
  });
  return v;
};

const boostVideo = async (videoId, days = 7, adminId) => {
  const v = await Video.findByIdAndUpdate(
    videoId,
    {
      isBoosted: true,
      boostedUntil: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
    { new: true },
  );
  if (!v) throw new ApiError(404, "Video not found");
  await audit.log({
    actorId: adminId,
    action: "BOOST_VIDEO",
    targetType: "Video",
    targetId: videoId,
    metadata: { days },
  });
  return v;
};

const removeBoost = async (videoId, adminId) => {
  const v = await Video.findByIdAndUpdate(
    videoId,
    { isBoosted: false, boostedUntil: null },
    { new: true },
  );
  if (!v) throw new ApiError(404, "Video not found");
  await audit.log({
    actorId: adminId,
    action: "REMOVE_BOOST",
    targetType: "Video",
    targetId: videoId,
  });
  return v;
};

const forceDeleteVideo = async (videoId, adminId, reason) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (video.cloudinaryPublicId) {
    await deleteFromCloudinary(video.cloudinaryPublicId, "video").catch(
      () => {},
    );
  }
  await Comment.deleteMany({ videoId });
  await video.deleteOne();
  await notif.send(video.founderId, {
    type: "system",
    title: "Pitch removed",
    body: reason || "Your pitch was removed by admin",
    data: { videoId: video._id.toString() },
  });
  await audit.log({
    actorId: adminId,
    action: "FORCE_DELETE_VIDEO",
    targetType: "Video",
    targetId: videoId,
    metadata: { reason, founderId: video.founderId.toString() },
  });
  return { ok: true };
};

// ─── KYC ────────────────────────────────────────
const pendingDocuments = async () => {
  return User.find({ "documents.status": "pending" })
    .select("name email role documents createdAt phone companyName")
    .sort({ "documents.submittedAt": 1 });
};

const approveDocuments = async (userId, adminId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  user.documents.status = "approved";
  user.documents.reviewedAt = new Date();
  user.recomputeVerificationLevel();
  await user.save({ validateBeforeSave: false });
  await notif.send(userId, {
    type: "verification",
    title: "Documents approved",
    body: "You are now fully verified! Blue tick activated.",
  });
  await sendEmail({
    to: user.email,
    subject: "PitchConnect — Documents approved",
    html: "<p>Your KYC documents have been approved. You are now fully verified.</p>",
  }).catch(() => {});
  await audit.log({
    actorId: adminId,
    action: "APPROVE_KYC",
    targetType: "User",
    targetId: userId,
  });
  return user.toSafeJSON();
};

const rejectDocuments = async (userId, reason, adminId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  user.documents.status = "rejected";
  user.documents.rejectionReason = reason || "Documents could not be verified";
  user.documents.reviewedAt = new Date();
  user.recomputeVerificationLevel();
  await user.save({ validateBeforeSave: false });
  await notif.send(userId, {
    type: "verification",
    title: "Documents rejected",
    body: reason || "Please resubmit your documents",
  });
  await sendEmail({
    to: user.email,
    subject: "PitchConnect — Documents rejected",
    html: `<p>Your KYC documents were rejected: ${reason || "Please resubmit"}</p>`,
  }).catch(() => {});
  await audit.log({
    actorId: adminId,
    action: "REJECT_KYC",
    targetType: "User",
    targetId: userId,
    metadata: { reason },
  });
  return user.toSafeJSON();
};

// ─── Reports ────────────────────────────────────
const listReports = async ({ status, type, limit = 50, cursor }) => {
  limit = Math.min(Number(limit) || 50, 200);
  const q = {};
  if (status) q.status = status;
  if (type) q.type = type;
  if (cursor) q._id = { $lt: cursor };
  const reports = await Report.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("reportedBy", "name email")
    .populate("reportedUser", "name email role")
    .populate("reportedVideo", "title founderId")
    .lean();
  const hasMore = reports.length > limit;
  return {
    reports: hasMore ? reports.slice(0, limit) : reports,
    nextCursor: hasMore ? reports[limit - 1]._id : null,
    hasMore,
  };
};

const resolveReport = async (
  id,
  adminId,
  { actionTaken, status = "resolved" },
) => {
  const r = await Report.findByIdAndUpdate(
    id,
    {
      status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      actionTaken: actionTaken || "",
    },
    { new: true },
  );
  if (!r) throw new ApiError(404, "Report not found");
  await audit.log({
    actorId: adminId,
    action: "RESOLVE_REPORT",
    targetType: "Report",
    targetId: id,
    metadata: { status, actionTaken },
  });
  return r;
};

// ─── Comments ───────────────────────────────────
const listAllComments = async ({ videoId, limit = 50, cursor }) => {
  limit = Math.min(Number(limit) || 50, 200);
  const q = {};
  if (videoId) q.videoId = videoId;
  if (cursor) q._id = { $lt: cursor };
  const items = await Comment.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("userId", "name email avatar")
    .populate("videoId", "title")
    .lean();
  const hasMore = items.length > limit;
  return {
    comments: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

const hideComment = async (commentId, adminId) => {
  const c = await Comment.findByIdAndUpdate(
    commentId,
    { isHidden: true },
    { new: true },
  );
  if (!c) throw new ApiError(404, "Comment not found");
  await audit.log({
    actorId: adminId,
    action: "HIDE_COMMENT",
    targetType: "Comment",
    targetId: commentId,
  });
  return c;
};

const unhideComment = async (commentId, adminId) => {
  const c = await Comment.findByIdAndUpdate(
    commentId,
    { isHidden: false },
    { new: true },
  );
  if (!c) throw new ApiError(404, "Comment not found");
  await audit.log({
    actorId: adminId,
    action: "UNHIDE_COMMENT",
    targetType: "Comment",
    targetId: commentId,
  });
  return c;
};

const deleteComment = async (commentId, adminId) => {
  const c = await Comment.findByIdAndDelete(commentId);
  if (!c) throw new ApiError(404, "Comment not found");
  await audit.log({
    actorId: adminId,
    action: "DELETE_COMMENT",
    targetType: "Comment",
    targetId: commentId,
  });
  return { ok: true };
};

// ─── Investments ────────────────────────────────
const listInvestments = async ({ status, stage, limit = 30, cursor }) => {
  limit = Math.min(Number(limit) || 30, 100);
  const q = {};
  if (status) q.status = status;
  if (stage) q.stage = stage;
  if (cursor) q._id = { $lt: cursor };
  const items = await Investment.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("founderId", "name email companyName")
    .populate("investorId", "name email")
    .populate("videoId", "title")
    .lean();
  const hasMore = items.length > limit;
  return {
    investments: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

const refundInvestment = async (investmentId, adminId, reason) => {
  const inv = await Investment.findById(investmentId);
  if (!inv) throw new ApiError(404, "Investment not found");
  if (inv.status !== "paid") {
    throw new ApiError(400, "Only paid investments can be refunded");
  }
  inv.status = "refunded";
  await inv.save();
  await User.findByIdAndUpdate(inv.investorId, {
    $inc: { totalInvested: -inv.amount },
  });
  await notif.send(inv.investorId, {
    type: "system",
    title: "Investment refunded",
    body: reason || "Your investment has been marked as refunded",
    data: { investmentId: inv._id.toString() },
  });
  await notif.send(inv.founderId, {
    type: "system",
    title: "Investment refunded",
    body: reason || "An investment was marked as refunded",
    data: { investmentId: inv._id.toString() },
  });
  await audit.log({
    actorId: adminId,
    action: "REFUND_INVESTMENT",
    targetType: "Investment",
    targetId: investmentId,
    metadata: { reason, amount: inv.amount },
  });
  return inv;
};

// ─── Calls / Chats overview ─────────────────────
const listCalls = async ({ status, limit = 30, cursor }) => {
  limit = Math.min(Number(limit) || 30, 100);
  const q = {};
  if (status) q.status = status;
  if (cursor) q._id = { $lt: cursor };
  const items = await Call.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("callerId", "name email")
    .populate("receiverId", "name email")
    .lean();
  const hasMore = items.length > limit;
  return {
    calls: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

const listChats = async ({ limit = 30, cursor }) => {
  limit = Math.min(Number(limit) || 30, 100);
  const q = {};
  if (cursor) q._id = { $lt: cursor };
  const items = await Chat.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("founderId", "name email companyName")
    .populate("investorId", "name email")
    .lean();
  const hasMore = items.length > limit;
  return {
    chats: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

const getChatMessages = async (chatId, { limit = 50, cursor }) => {
  limit = Math.min(Number(limit) || 50, 200);
  const q = { chatId };
  if (cursor) q._id = { $lt: cursor };
  const items = await Message.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("senderId", "name email")
    .lean();
  const hasMore = items.length > limit;
  return {
    messages: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

// ─── Broadcast ─────────────────────────────────
const broadcastNotification = async (
  { title, body, role, sendEmail: shouldEmail },
  adminId,
) => {
  const filter = { isActive: true, isBanned: false };
  if (role) filter.role = role;
  const users = await User.find(filter).select("_id email name fcmToken");
  let count = 0;
  for (const u of users) {
    notif
      .send(u._id, {
        type: "system",
        title,
        body,
        data: { broadcast: true },
      })
      .catch(() => {});
    count++;
  }
  if (shouldEmail) {
    for (const u of users) {
      sendEmail({
        to: u.email,
        subject: title,
        html: `<p>${body}</p>`,
      }).catch(() => {});
    }
  }
  await audit.log({
    actorId: adminId,
    action: "BROADCAST",
    metadata: {
      title,
      role: role || "all",
      recipients: count,
      email: !!shouldEmail,
    },
  });
  return { sent: count };
};

// ─── Audit log access ──────────────────────────
const auditLogs = (filters) => audit.list(filters);

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
  broadcastNotification,
  auditLogs,
};
