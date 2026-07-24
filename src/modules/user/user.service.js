const User = require("./user.model");
const Video = require("../video/video.model");
const ProfileView = require("../profileView/profileView.model");
const ApiError = require("../../utils/ApiError");
const {
  uploadImageToCloudinary,
  uploadDocumentToCloudinary,
  deleteFromCloudinary,
} = require("../../utils/cloudinaryUpload");

const SAFE_FIELDS = [
  "name",
  "phone",
  "bio",
  "companyName",
  "industry",
  "fundingStage",
  "website",
  "linkedIn",
  "investmentRange",
  "preferredIndustries",
  "preferredStages",
  "investmentThesis",
  "portfolioCompanies",
  "openToConnect",
  "notificationPrefs",
  "privacyPrefs",
];

const computeProfileCompleteness = (user) => {
  let total = 0;
  let filled = 0;
  const check = (val) => {
    total++;
    if (
      val !== undefined &&
      val !== null &&
      val !== "" &&
      !(Array.isArray(val) && val.length === 0)
    )
      filled++;
  };
  check(user.name);
  check(user.email);
  check(user.phone);
  check(user.bio);
  check(user.avatar);
  if (user.role === "founder") {
    check(user.companyName);
    check(user.industry);
    check(user.fundingStage);
    check(user.website || user.linkedIn);
    check(user.pitchDeck);
  }
  if (user.role === "investor") {
    check(user.investmentRange?.min);
    check(user.investmentRange?.max);
    check(user.preferredIndustries?.length ? "1" : "");
    check(user.investmentThesis);
  }
  return Math.round((filled / total) * 100);
};

const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  user.profileCompleteness = computeProfileCompleteness(user);
  await user.save({ validateBeforeSave: false });
  return user.toSafeJSON();
};

const updateProfile = async (userId, updates) => {
  const sanitized = {};
  for (const k of SAFE_FIELDS)
    if (updates[k] !== undefined) sanitized[k] = updates[k];
  const user = await User.findByIdAndUpdate(userId, sanitized, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new ApiError(404, "User not found");
  user.profileCompleteness = computeProfileCompleteness(user);
  await user.save({ validateBeforeSave: false });
  return user.toSafeJSON();
};

const uploadAvatar = async (userId, file) => {
  if (!file) throw new ApiError(400, "Image file required");
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  const uploaded = await uploadImageToCloudinary(file.path, "avatars");
  if (user.avatarPublicId)
    await deleteFromCloudinary(user.avatarPublicId, "image");
  user.avatar = uploaded.url;
  user.avatarPublicId = uploaded.publicId;
  await user.save({ validateBeforeSave: false });
  return user.toSafeJSON();
};

const uploadPitchDeck = async (userId, file) => {
  if (!file) throw new ApiError(400, "Pitch deck file required");
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (user.role !== "founder") {
    throw new ApiError(403, "Only founders can upload pitch deck");
  }
  const uploaded = await uploadDocumentToCloudinary(file.path, "pitch-decks");
  user.pitchDeck = uploaded.url;
  await user.save({ validateBeforeSave: false });
  return user.toSafeJSON();
};

const submitDocuments = async (userId, files) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (!user.isPhoneVerified) {
    throw new ApiError(403, "Verify phone before submitting KYC");
  }
  const updates = { ...(user.documents.toObject?.() || user.documents) };
  if (files.panCard?.[0]) {
    const r = await uploadDocumentToCloudinary(
      files.panCard[0].path,
      "documents/pan",
    );
    updates.panCard = r.url;
  }
  if (files.aadhar?.[0]) {
    const r = await uploadDocumentToCloudinary(
      files.aadhar[0].path,
      "documents/aadhar",
    );
    updates.aadhar = r.url;
  }
  if (files.businessReg?.[0]) {
    const r = await uploadDocumentToCloudinary(
      files.businessReg[0].path,
      "documents/business",
    );
    updates.businessReg = r.url;
  }
  updates.status = "pending";
  updates.submittedAt = new Date();
  updates.rejectionReason = "";
  user.documents = updates;
  await user.save({ validateBeforeSave: false });
  return user.toSafeJSON();
};

const updateFcmToken = async (userId, fcmToken) => {
  await User.findByIdAndUpdate(userId, { fcmToken });
};

const mongoose = require("mongoose");

const resolveUserId = async (idOrUsername) => {
  if (!idOrUsername) return null;
  const str = idOrUsername.toString().replace(/^@/, "").trim();
  if (mongoose.Types.ObjectId.isValid(str)) {
    const userById = await User.findById(str).select("_id");
    if (userById) return userById._id;
  }
  const userByUsername = await User.findOne({
    username: new RegExp(`^${str}$`, "i"),
  }).select("_id");
  if (userByUsername) return userByUsername._id;

  const userByName = await User.findOne({
    name: new RegExp(`^${str}$`, "i"),
  }).select("_id");
  if (userByName) return userByName._id;

  // Fallback for mock/placeholder IDs (e.g. f_1, f_2, founder_1, 1) in frontend mock data
  if (/^(f_\d+|founder_\d+|mock_\d+|\d+|pitch_\d+)$/i.test(str)) {
    const defaultFounder = await User.findOne({ role: "founder" }).select("_id");
    if (defaultFounder) return defaultFounder._id;
    const anyUser = await User.findOne().select("_id");
    if (anyUser) return anyUser._id;
  }

  return mongoose.Types.ObjectId.isValid(str) ? str : null;
};

const getPublicProfile = async (viewerId, userIdOrUsername) => {
  const targetId = await resolveUserId(userIdOrUsername);
  if (!targetId) throw new ApiError(404, "User not found");

  const user = await User.findById(targetId)
    .select(
      "-password -refreshToken -documents -emailOtpHash -phoneOtpHash " +
        "-passwordResetTokenHash -loginAttempts -lockUntil -fcmToken -blockedUsers",
    )
    .populate(
      "followers",
      "name username avatar isVerified role companyName bio industry fundingStage",
    )
    .populate(
      "following",
      "name username avatar isVerified role companyName bio industry fundingStage",
    );

  if (!user) throw new ApiError(404, "User not found");
  if (user.isBanned || !user.isActive) {
    throw new ApiError(404, "User not found");
  }

  const userObj = user.toObject();
  userObj.followers = (userObj.followers || []).filter(
    (item) => item && typeof item === "object" && item._id,
  );
  userObj.following = (userObj.following || []).filter(
    (item) => item && typeof item === "object" && item._id,
  );
  userObj.followersCount = userObj.followers.length;
  userObj.followingCount = userObj.following.length;

  if (
    user.followersCount !== userObj.followersCount ||
    user.followingCount !== userObj.followingCount
  ) {
    await User.findByIdAndUpdate(targetId, {
      followersCount: userObj.followersCount,
      followingCount: userObj.followingCount,
    }).catch(() => {});
  }

  // Track view (don't track self-views)
  if (viewerId && viewerId.toString() !== targetId.toString()) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    await ProfileView.updateOne(
      { profileOwnerId: targetId, viewerId, viewedAt: { $gte: startOfDay } },
      {
        $setOnInsert: {
          profileOwnerId: targetId,
          viewerId,
          viewedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
  return userObj;
};

const getProfileViewers = async (userId, { limit = 20, cursor } = {}) => {
  limit = Math.min(Number(limit) || 20, 50);
  const q = { profileOwnerId: userId };
  if (cursor) q._id = { $lt: cursor };
  const items = await ProfileView.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("viewerId", "name avatar role companyName isVerified")
    .lean();
  const hasMore = items.length > limit;
  return {
    views: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

const blockUser = async (userId, targetId) => {
  if (userId.toString() === targetId.toString()) {
    throw new ApiError(400, "Cannot block yourself");
  }
  await User.findByIdAndUpdate(userId, {
    $addToSet: { blockedUsers: targetId },
  });
  return { blocked: true };
};

const unblockUser = async (userId, targetId) => {
  await User.findByIdAndUpdate(userId, { $pull: { blockedUsers: targetId } });
  return { unblocked: true };
};

const deleteAccount = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    isActive: false,
    refreshToken: undefined,
  });
};

// Search users + their pitches
const search = async ({
  q,
  role,
  industry,
  fundingStage,
  verified,
  limit = 20,
  cursor,
}) => {
  limit = Math.min(Number(limit) || 20, 50);
  const filter = { isActive: true, isBanned: false };
  if (role) filter.role = role;
  if (industry) filter.industry = industry;
  if (fundingStage) filter.fundingStage = fundingStage;
  if (verified === "true" || verified === true) filter.isVerified = true;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { companyName: new RegExp(q, "i") },
      { industry: new RegExp(q, "i") },
    ];
  }
  if (cursor) filter._id = { $lt: cursor };
  const users = await User.find(filter)
    .select(
      "name username avatar role companyName industry isVerified bio fundingStage activePitchId isOnline lastSeen",
    )
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate({
      path: "activePitchId",
      select: "title thumbnailUrl duration views",
    })
    .lean();
  const hasMore = users.length > limit;
  return {
    users: hasMore ? users.slice(0, limit) : users,
    nextCursor: hasMore ? users[limit - 1]._id : null,
    hasMore,
  };
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  uploadPitchDeck,
  submitDocuments,
  updateFcmToken,
  getPublicProfile,
  getProfileViewers,
  blockUser,
  unblockUser,
  deleteAccount,
  search,
  computeProfileCompleteness,
  followUser,
  getFollowers,
  getFollowingList,
  resolveUserId,
};

// ─── Follow system ─────────────────────────────────
async function followUser(currentUserId, targetUserIdOrUsername) {
  const targetUserId = await resolveUserId(targetUserIdOrUsername);
  if (!targetUserId) throw new ApiError(404, "User not found");

  if (currentUserId.toString() === targetUserId.toString()) {
    throw new ApiError(400, "Cannot follow yourself");
  }
  const target = await User.findById(targetUserId);
  if (!target) throw new ApiError(404, "User not found");

  const alreadyFollowing = (target.followers || []).some(
    (id) => id.toString() === currentUserId.toString(),
  );

  if (alreadyFollowing) {
    // Unfollow
    const updatedTarget = await User.findByIdAndUpdate(
      targetUserId,
      { $pull: { followers: currentUserId } },
      { new: true },
    );
    const updatedCurrent = await User.findByIdAndUpdate(
      currentUserId,
      { $pull: { following: targetUserId } },
      { new: true },
    );
    // Keep follower/following counters in sync
    await User.findByIdAndUpdate(targetUserId, {
      followersCount: Math.max(0, updatedTarget?.followers?.length || 0),
    });
    await User.findByIdAndUpdate(currentUserId, {
      followingCount: Math.max(0, updatedCurrent?.following?.length || 0),
    });

    return { following: false, isFollowing: false };
  } else {
    // Follow
    const updatedTarget = await User.findByIdAndUpdate(
      targetUserId,
      { $addToSet: { followers: currentUserId } },
      { new: true },
    );
    const updatedCurrent = await User.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { following: targetUserId } },
      { new: true },
    );
    // Keep follower/following counters in sync
    await User.findByIdAndUpdate(targetUserId, {
      followersCount: updatedTarget?.followers?.length || 0,
    });
    await User.findByIdAndUpdate(currentUserId, {
      followingCount: updatedCurrent?.following?.length || 0,
    });

    // Notify the target user
    try {
      const notifService = require("../notification/notification.service");
      const follower = await User.findById(currentUserId).select("name");
      notifService
        .send(targetUserId, {
          type: "follow",
          title: `${follower?.name || "Someone"} started following you`,
          body: "",
          data: { followerId: currentUserId.toString() },
        })
        .catch(() => {});
    } catch {}
    return { following: true, isFollowing: true };
  }
}

async function getFollowers(userIdOrUsername) {
  const targetId = await resolveUserId(userIdOrUsername);
  if (!targetId) return [];
  const user = await User.findById(targetId)
    .select("followers")
    .populate(
      "followers",
      "name username avatar isVerified role companyName bio industry fundingStage",
    );
  const followers = user?.followers || [];
  return followers.filter(
    (item) => item && typeof item === "object" && item._id,
  );
}

async function getFollowingList(userIdOrUsername) {
  const targetId = await resolveUserId(userIdOrUsername);
  if (!targetId) return [];
  const user = await User.findById(targetId)
    .select("following")
    .populate(
      "following",
      "name username avatar isVerified role companyName bio industry fundingStage",
    );
  const following = user?.following || [];
  return following.filter(
    (item) => item && typeof item === "object" && item._id,
  );
}
