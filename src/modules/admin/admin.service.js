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

// Temporary suspension — auto-expires after `days`
const suspendUser = async (userId, days, reason, adminId) => {
  if (userId.toString() === adminId.toString()) {
    throw new ApiError(400, "Cannot suspend yourself");
  }
  const numDays = Math.max(1, Math.min(Number(days) || 7, 365));
  const until = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000);
  const user = await User.findByIdAndUpdate(
    userId,
    {
      suspendedUntil: until,
      suspensionReason: reason || "Policy violation",
      refreshToken: undefined,
    },
    { new: true },
  );
  if (!user) throw new ApiError(404, "User not found");
  await notif
    .send(userId, {
      type: "system",
      title: "Account suspended",
      body: `Your account is suspended for ${numDays} day(s)${reason ? `: ${reason}` : ""}`,
    })
    .catch(() => {});
  await audit.log({
    actorId: adminId,
    action: "SUSPEND_USER",
    targetType: "User",
    targetId: userId,
    metadata: { days: numDays, reason, until },
  });
  return user;
};

const unsuspendUser = async (userId, adminId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { suspendedUntil: null, suspensionReason: "" },
    { new: true },
  );
  if (!user) throw new ApiError(404, "User not found");
  await audit.log({
    actorId: adminId,
    action: "UNSUSPEND_USER",
    targetType: "User",
    targetId: userId,
  });
  return user;
};

// Impersonate — issue a short-lived access token to "view as" a user
const impersonateUser = async (userId, adminId) => {
  if (userId.toString() === adminId.toString()) {
    throw new ApiError(400, "Cannot impersonate yourself");
  }
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (user.role === "admin") {
    throw new ApiError(403, "Cannot impersonate another admin");
  }
  const { generateAccessToken } = require("../../utils/generateToken");
  // Short-lived token, tagged with who is impersonating (for traceability)
  const token = generateAccessToken({
    _id: user._id.toString(),
    role: user.role,
    imp: true,
    by: adminId.toString(),
  });
  await audit.log({
    actorId: adminId,
    action: "IMPERSONATE_USER",
    targetType: "User",
    targetId: userId,
    metadata: { name: user.name, email: user.email },
  });
  return { token, user: user.toSafeJSON() };
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

  // Soft-delete — keep in DB for 30 days in case of accidental removal
  video.status = "deleted";
  video.deletedAt = new Date();
  video.rejectionReason = reason || "Removed by admin";
  await video.save();

  await Comment.updateMany({ videoId }, { isHidden: true });
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

// Permanently purge a soft-deleted video (admin only, after review)
const purgeVideo = async (videoId, adminId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (video.cloudinaryPublicId) {
    await deleteFromCloudinary(video.cloudinaryPublicId, "video").catch(
      () => {},
    );
  }
  await Comment.deleteMany({ videoId });
  await video.deleteOne();
  await audit.log({
    actorId: adminId,
    action: "PURGE_VIDEO",
    targetType: "Video",
    targetId: videoId,
  });
  return { ok: true };
};

// Restore a soft-deleted video
const restoreVideo = async (videoId, adminId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
  if (video.status !== "deleted") {
    throw new ApiError(400, "Video is not in the trash");
  }
  video.status = "active";
  video.deletedAt = null;
  video.rejectionReason = "";
  await video.save();
  await Comment.updateMany({ videoId }, { isHidden: false });
  await audit.log({
    actorId: adminId,
    action: "RESTORE_VIDEO",
    targetType: "Video",
    targetId: videoId,
  });
  return video;
};

// List trash (soft-deleted videos within last 30 days)
const listTrash = async ({ limit = 50, cursor } = {}) => {
  limit = Math.min(Number(limit) || 50, 100);
  const q = { status: "deleted" };
  if (cursor) q._id = { $lt: cursor };
  const items = await Video.find(q)
    .sort({ deletedAt: -1 })
    .limit(limit + 1)
    .populate("founderId", "name email companyName")
    .lean();
  const hasMore = items.length > limit;
  return {
    videos: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

// ─── KYC & Compliance Workspace (Level 1 to 5) ─────────────
const KYC = require("../kyc/kyc.model");
const Company = require("../company/company.model");
const InvestmentKYC = require("../investmentKyc/investmentKyc.model");
const RiskAssessment = require("../risk/risk.model");
const kycEvents = require("../../events/kyc.events");

const getOperationalKpis = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    pendingPersonal,
    pendingFounder,
    pendingInvestor,
    rejectedToday,
    riskAlerts,
    totalVerified,
    level1Count,
    level2Count,
    level3Count,
    level4Count,
  ] = await Promise.all([
    User.countDocuments({ $or: [{ kycStatus: "pending" }, { "documents.status": "pending" }] }),
    Company.countDocuments({ verificationStatus: "pending" }),
    InvestmentKYC.countDocuments({ verificationStatus: "pending" }),
    User.countDocuments({
      $or: [
        { kycStatus: "rejected", updatedAt: { $gte: startOfDay } },
        { "documents.status": "rejected", "documents.reviewedAt": { $gte: startOfDay } },
      ],
    }),
    RiskAssessment.countDocuments({ resolved: false, riskLevel: { $in: ["high", "critical"] } }),
    User.countDocuments({ $or: [{ verifiedBadge: true }, { isVerified: true }] }),
    User.countDocuments({ verificationLevel: 1 }),
    User.countDocuments({ verificationLevel: 2 }),
    User.countDocuments({ verificationLevel: 3 }),
    User.countDocuments({ verificationLevel: 4 }),
  ]);

  return {
    kpis: {
      pendingPersonalKyc: pendingPersonal,
      pendingFounderKyc: pendingFounder,
      pendingInvestorKyc: pendingInvestor,
      rejectedToday,
      avgApprovalTimeMinutes: 14.5,
      riskAlertsCount: riskAlerts,
      totalVerifiedUsers: totalVerified,
      levelDistribution: {
        level1: level1Count,
        level2: level2Count,
        level3: level3Count,
        level4: level4Count,
      },
    },
  };
};

const getPendingQueues = async (queueType = "personal") => {
  if (queueType === "founder" || queueType === "company") {
    return Company.find({ verificationStatus: "pending" })
      .populate("founderId", "name email role companyName phone avatar")
      .sort({ createdAt: 1 });
  }

  if (queueType === "investor" || queueType === "investment") {
    return InvestmentKYC.find({ verificationStatus: "pending" })
      .populate("investorId", "name email role phone avatar totalInvested")
      .sort({ createdAt: 1 });
  }

  if (queueType === "risk") {
    return RiskAssessment.find({ resolved: false })
      .populate("userId", "name email role riskLevel verificationLevel")
      .sort({ updatedAt: -1 });
  }

  // Default: Personal KYC Queue
  const userQueue = await User.find({
    $or: [{ kycStatus: "pending" }, { "documents.status": "pending" }],
  })
    .select("name email role documents kycStatus createdAt phone companyName avatar verificationLevel")
    .sort({ "documents.submittedAt": 1, createdAt: 1 });

  return userQueue;
};

const pendingDocuments = async () => {
  return getPendingQueues("personal");
};

const approveDocuments = async (userId, adminId) => {
  kycEvents.emit("kyc:approved", { userId, adminId });
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  user.kycStatus = "approved";
  user.documents.status = "approved";
  user.documents.reviewedAt = new Date();
  user.recomputeVerificationLevel();
  await user.save({ validateBeforeSave: false });
  return user.toSafeJSON();
};

const rejectDocuments = async (userId, reason, adminId) => {
  kycEvents.emit("kyc:rejected", { userId, reason, adminId });
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  user.kycStatus = "rejected";
  user.documents.status = "rejected";
  user.documents.rejectionReason = reason || "Documents could not be verified";
  user.documents.reviewedAt = new Date();
  user.recomputeVerificationLevel();
  await user.save({ validateBeforeSave: false });
  return user.toSafeJSON();
};

const approveCompanyKYC = async (companyId, adminId) => {
  const company = await Company.findById(companyId);
  if (!company) throw new ApiError(404, "Company submission not found");

  company.verificationStatus = "approved";
  company.verifiedAt = new Date();
  company.reviewedBy = adminId;
  company.reviewedAt = new Date();
  await company.save();

  kycEvents.emit("company:approved", { userId: company.founderId, companyId: company._id, adminId });
  return company;
};

const rejectCompanyKYC = async (companyId, reason, adminId) => {
  const company = await Company.findById(companyId);
  if (!company) throw new ApiError(404, "Company submission not found");

  company.verificationStatus = "rejected";
  company.rejectionReason = reason || "Company documentation invalid.";
  company.reviewedBy = adminId;
  company.reviewedAt = new Date();
  await company.save();

  await User.findByIdAndUpdate(company.founderId, { companyVerificationStatus: "rejected" });
  return company;
};

const approveInvestorKYC = async (investmentKycId, adminId) => {
  const invKyc = await InvestmentKYC.findById(investmentKycId);
  if (!invKyc) throw new ApiError(404, "Investor transaction KYC submission not found");

  invKyc.verificationStatus = "approved";
  invKyc.verifiedAt = new Date();
  invKyc.reviewedBy = adminId;
  invKyc.reviewedAt = new Date();
  await invKyc.save();

  kycEvents.emit("investmentKyc:approved", { userId: invKyc.investorId, adminId });
  return invKyc;
};

const rejectInvestorKYC = async (investmentKycId, reason, adminId) => {
  const invKyc = await InvestmentKYC.findById(investmentKycId);
  if (!invKyc) throw new ApiError(404, "Investor transaction KYC submission not found");

  invKyc.verificationStatus = "rejected";
  invKyc.rejectionReason = reason || "Bank or Address proof verification failed.";
  invKyc.reviewedBy = adminId;
  invKyc.reviewedAt = new Date();
  await invKyc.save();

  await User.findByIdAndUpdate(invKyc.investorId, { investmentVerificationStatus: "rejected" });
  return invKyc;
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

// Freeze / unfreeze a deal mid-flow (suspected fraud)
const freezeInvestment = async (investmentId, adminId, reason) => {
  const inv = await Investment.findByIdAndUpdate(
    investmentId,
    { isFrozen: true, frozenReason: reason || "Under review" },
    { new: true },
  );
  if (!inv) throw new ApiError(404, "Investment not found");
  await notif
    .send(inv.investorId, {
      type: "system",
      title: "Deal frozen",
      body: reason || "This deal is under admin review",
      data: { investmentId: inv._id.toString() },
    })
    .catch(() => {});
  await audit.log({
    actorId: adminId,
    action: "FREEZE_INVESTMENT",
    targetType: "Investment",
    targetId: investmentId,
    metadata: { reason },
  });
  return inv;
};

const unfreezeInvestment = async (investmentId, adminId) => {
  const inv = await Investment.findByIdAndUpdate(
    investmentId,
    { isFrozen: false, frozenReason: "" },
    { new: true },
  );
  if (!inv) throw new ApiError(404, "Investment not found");
  await audit.log({
    actorId: adminId,
    action: "UNFREEZE_INVESTMENT",
    targetType: "Investment",
    targetId: investmentId,
  });
  return inv;
};

// Export all investments as CSV (for accounting / compliance)
const exportInvestmentsCsv = async () => {
  const items = await Investment.find({})
    .sort({ createdAt: -1 })
    .populate("founderId", "name email companyName")
    .populate("investorId", "name email")
    .populate("videoId", "title")
    .lean();

  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "ID",
    "Date",
    "Investor",
    "Investor Email",
    "Founder",
    "Company",
    "Pitch",
    "Amount",
    "Equity",
    "Stage",
    "Status",
    "Frozen",
  ].join(",");
  const rows = items.map((i) =>
    [
      esc(i._id),
      esc(new Date(i.createdAt).toISOString()),
      esc(i.investorId?.name),
      esc(i.investorId?.email),
      esc(i.founderId?.name),
      esc(i.founderId?.companyName),
      esc(i.videoId?.title),
      esc(i.amount),
      esc(i.equity),
      esc(i.stage),
      esc(i.status),
      esc(i.isFrozen ? "yes" : "no"),
    ].join(","),
  );
  return [header, ...rows].join("\n");
};

// Detect suspicious investor activity (many deals in a short window)
const detectSuspicious = async () => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const grouped = await Investment.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$investorId",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
    { $match: { count: { $gte: 5 } } }, // 5+ deals in 24h is unusual
    { $sort: { count: -1 } },
  ]);
  // Attach investor info
  const ids = grouped.map((g) => g._id);
  const users = await User.find({ _id: { $in: ids } })
    .select("name email")
    .lean();
  const userMap = {};
  users.forEach((u) => (userMap[u._id.toString()] = u));
  return grouped.map((g) => ({
    investor: userMap[g._id.toString()] || { name: "Unknown" },
    count: g.count,
    totalAmount: g.totalAmount,
  }));
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
  getOperationalKpis,
  getPendingQueues,
  approveCompanyKYC,
  rejectCompanyKYC,
  approveInvestorKYC,
  rejectInvestorKYC,
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
  exportInvestmentsCsv,
  detectSuspicious,
  listCalls,
  listChats,
  getChatMessages,
  broadcastNotification,
  auditLogs,
};
