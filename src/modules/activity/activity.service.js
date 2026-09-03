const Video = require("../video/video.model");
const Notification = require("../notification/notification.model");
const ProfileView = require("../profileView/profileView.model");
const Investment = require("../investment/investment.model");
const Call = require("../call/call.model");
const { Chat } = require("../chat/chat.model");

                                  
const founderActivity = async (founderId) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    activeVideo,
    totalPitches,
    totalViews7d,
    totalLikes7d,
    profileViews7d,
    interestedInvestors,
    activeChats,
    missedCalls,
  ] = await Promise.all([
    Video.findOne({ founderId, status: "active" }).select(
      "title thumbnailUrl views likes saves expiresAt",
    ),
    Video.countDocuments({ founderId }),
    Video.aggregate([
      { $match: { founderId } },
      { $group: { _id: null, total: { $sum: "$views" } } },
    ]).then((r) => r[0]?.total || 0),
    Video.aggregate([
      { $match: { founderId, createdAt: { $gte: since } } },
      { $project: { likeCount: { $size: "$likes" } } },
      { $group: { _id: null, total: { $sum: "$likeCount" } } },
    ]).then((r) => r[0]?.total || 0),
    ProfileView.countDocuments({
      profileOwnerId: founderId,
      viewedAt: { $gte: since },
    }),
    Investment.countDocuments({ founderId, stage: { $ne: "completed" } }),
    Chat.countDocuments({ founderId, isActive: true }),
    Call.countDocuments({
      receiverId: founderId,
      status: { $in: ["missed", "no_answer"] },
      createdAt: { $gte: since },
    }),
  ]);

  return {
    activeVideo,
    totalPitches,
    totalViews7d,
    totalLikes7d,
    profileViews7d,
    interestedInvestors,
    activeChats,
    missedCalls,
  };
};

const investorActivity = async (investorId) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    likedCount,
    savedCount,
    activeChats,
    deals,
    completedDeals,
    totalInvested,
    pitchesViewed7d,
  ] = await Promise.all([
    Video.countDocuments({ likes: investorId }),
    Video.countDocuments({ saves: investorId }),
    Chat.countDocuments({ investorId, isActive: true }),
    Investment.countDocuments({ investorId }),
    Investment.countDocuments({ investorId, status: "paid" }),
    Investment.aggregate([
      { $match: { investorId, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).then((r) => r[0]?.total || 0),
    Video.countDocuments({
      uniqueViews: investorId,
      createdAt: { $gte: since },
    }),
  ]);

  return {
    likedCount,
    savedCount,
    activeChats,
    deals,
    completedDeals,
    totalInvested,
    pitchesViewed7d,
  };
};

module.exports = { founderActivity, investorActivity };
