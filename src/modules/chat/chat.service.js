const mongoose = require("mongoose");
const { Chat, Message } = require("./chat.model");
const Video = require("../video/video.model");
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");
const { resolveUserId } = require("../user/user.service");
const {
  FREE_CHATS_PER_MONTH,
} = require("../subscription/subscription.constants");

function nextMonthStart() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isParticipant(chat, userId) {
  if (!chat || !userId) return false;
  const uid = userId.toString();
  if (chat.founderId && chat.founderId.toString() === uid) return true;
  if (chat.investorId && chat.investorId.toString() === uid) return true;
  if (Array.isArray(chat.participants)) {
    return chat.participants.some((p) => p && (p._id || p).toString() === uid);
  }
  return false;
}

// Investor starts chat with founder (or vice versa). Requires investor to have liked
// at least one of founder's pitches (mutual interest signal).
const startChat = async (initiatorId, targetId) => {
  if (!targetId) {
    throw new ApiError(400, "targetId required");
  }

  let resolvedTargetId = await resolveUserId(targetId);
  if (!resolvedTargetId) {
    throw new ApiError(404, "Target user not found");
  }

  // Cannot chat with yourself
  if (initiatorId.toString() === resolvedTargetId.toString()) {
    throw new ApiError(400, "Cannot chat with yourself");
  }

  const initiator = await User.findById(initiatorId);
  const target = await User.findById(resolvedTargetId);
  if (!initiator || !target) {
    throw new ApiError(404, "User not found");
  }

  if (initiator.verificationLevel < 2) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(403, "Verify phone before chatting");
    }
  }
  if (target.openToConnect === false) {
    throw new ApiError(403, "Target user is not accepting new connections");
  }
  if (
    target.blockedUsers?.some(
      (id) => id && id.toString() === initiatorId.toString(),
    )
  ) {
    throw new ApiError(403, "You cannot message this user");
  }

  // Determine actual founder vs investor based on real user roles
  let founderId, investorId;
  if (initiator.role === "founder" && target.role !== "founder") {
    founderId = initiator._id;
    investorId = target._id;
  } else if (target.role === "founder" && initiator.role !== "founder") {
    founderId = target._id;
    investorId = initiator._id;
  } else {
    // If both have the same role (e.g. founder-founder), assign deterministically by ID
    const sorted = [initiator._id.toString(), target._id.toString()].sort();
    founderId = sorted[0];
    investorId = sorted[1];
  }

  // Mutual interest check — if target is a founder, initiator must like pitch or follow
  if (target.role === "founder") {
    const hasLiked = await Video.exists({
      founderId: target._id,
      likes: initiatorId,
    });
    const followingArray = initiator.following || [];
    const isFollowing = followingArray.some(
      (id) => id && id.toString() === target._id.toString(),
    );

    if (!hasLiked && !isFollowing) {
      if (process.env.NODE_ENV !== "production") {
        initiator.following = initiator.following || [];
        initiator.following.push(target._id);
        await initiator.save({ validateBeforeSave: false });
      } else {
        throw new ApiError(
          403,
          "Like one of the founder's pitches or follow them first to start a chat",
        );
      }
    }
  }

  // Find existing chat using all participant permutations to ensure ONE unique chat document
  let chat = await Chat.findOne({
    $or: [
      { participants: { $all: [initiatorId, resolvedTargetId] } },
      { founderId, investorId },
      { founderId: investorId, investorId: founderId },
    ],
    isActive: { $ne: false },
  });

  // Subscription / free-tier gate for investors starting NEW conversations
  if (initiator.role !== "founder" && !initiator.isProActive()) {
    if (
      !initiator.chatQuotaResetAt ||
      new Date(initiator.chatQuotaResetAt) <= new Date()
    ) {
      initiator.freeChatsUsedThisMonth = 0;
      initiator.chatQuotaResetAt = nextMonthStart();
      await initiator.save({ validateBeforeSave: false });
    }

    if (!chat && (initiator.freeChatsUsedThisMonth || 0) >= FREE_CHATS_PER_MONTH) {
      throw new ApiError(
        403,
        "You've used your free chat for this month. Upgrade to Pro for unlimited conversations.",
      );
    }

    if (!chat) {
      initiator.freeChatsUsedThisMonth =
        (initiator.freeChatsUsedThisMonth || 0) + 1;
      await initiator.save({ validateBeforeSave: false });
    }
  }

  if (!chat) {
    chat = await Chat.create({
      participants: [founderId, investorId],
      founderId,
      investorId,
    });
  } else {
    // Ensure participants array is properly populated with both IDs
    const partStrs = (chat.participants || []).map((id) => id.toString());
    if (
      !partStrs.includes(founderId.toString()) ||
      !partStrs.includes(investorId.toString())
    ) {
      chat.participants = [founderId, investorId];
      await chat.save();
    }
  }

  // Always return a fully-populated chat so the frontend can render it immediately
  const populated = await Chat.findById(chat._id)
    .populate(
      "founderId",
      "name username avatar companyName isOnline lastSeen isVerified",
    )
    .populate(
      "investorId",
      "name username avatar companyName isOnline lastSeen isVerified",
    )
    .populate(
      "participants",
      "name username avatar companyName isOnline lastSeen isVerified",
    )
    .lean();

  return populated || chat;
};

const listChats = async (userId) => {
  const chats = await Chat.find({
    $or: [
      { participants: userId },
      { founderId: userId },
      { investorId: userId },
    ],
    isActive: { $ne: false },
  })
    .sort({ lastMessageAt: -1 })
    .populate(
      "founderId",
      "name username avatar companyName isOnline lastSeen isVerified",
    )
    .populate(
      "investorId",
      "name username avatar companyName isOnline lastSeen isVerified",
    )
    .populate(
      "participants",
      "name username avatar companyName isOnline lastSeen isVerified",
    )
    .lean();

  chats.forEach((ch) => {
    if (ch.founderId && !ch.founderId.avatar) ch.founderId.avatar = null;
    if (ch.investorId && !ch.investorId.avatar) ch.investorId.avatar = null;
    const isFounder = ch.founderId?._id?.toString() === userId.toString();
    ch.unread = isFounder
      ? ch.unreadCount?.founder || 0
      : ch.unreadCount?.investor || 0;
  });

  return chats;
};

const getMessages = async (chatId, userId, { cursor, limit = 30 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(400, "Invalid chatId");
  }
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!isParticipant(chat, userId)) {
    throw new ApiError(403, "Not a participant of this chat");
  }
  limit = Math.min(Number(limit) || 30, 100);
  const q = { chatId, isDeleted: { $ne: true } };
  if (cursor) {
    if (!mongoose.Types.ObjectId.isValid(cursor)) {
      throw new ApiError(400, "Invalid cursor");
    }
    q._id = { $lt: cursor };
  }
  const messages = await Message.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = messages.length > limit;
  const items = (hasMore ? messages.slice(0, limit) : messages).reverse();
  const nextCursor = hasMore ? messages[limit - 1]._id : null;
  return { messages: items, nextCursor, hasMore };
};

const sendMessage = async ({
  chatId,
  senderId,
  text,
  type = "text",
  fileUrl = "",
}) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(400, "Invalid chatId");
  }
  if (!text && !fileUrl) {
    throw new ApiError(400, "Message content required");
  }
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!isParticipant(chat, senderId)) {
    throw new ApiError(403, "Not a participant of this chat");
  }

  const message = await Message.create({
    chatId,
    senderId,
    text: text || "",
    type,
    fileUrl,
  });

  chat.lastMessage = type === "text" ? text : `[${type}]`;
  chat.lastMessageAt = new Date();

  // Repair participants array if needed
  if (!chat.participants || chat.participants.length < 2) {
    chat.participants = [chat.founderId, chat.investorId].filter(Boolean);
  }

  const isSenderFounder =
    chat.founderId && chat.founderId.toString() === senderId.toString();
  if (isSenderFounder) {
    chat.unreadCount.investor = (chat.unreadCount?.investor || 0) + 1;
  } else {
    chat.unreadCount.founder = (chat.unreadCount?.founder || 0) + 1;
  }
  await chat.save();

  return { message, chat };
};

const markRead = async (chatId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(400, "Invalid chatId");
  }
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!isParticipant(chat, userId)) {
    throw new ApiError(403, "Not a participant");
  }

  await Message.updateMany(
    { chatId, senderId: { $ne: userId }, isRead: false },
    { isRead: true, readAt: new Date() },
  );
  if (chat.founderId && chat.founderId.toString() === userId.toString()) {
    chat.unreadCount.founder = 0;
  } else {
    chat.unreadCount.investor = 0;
  }
  await chat.save();
  return { read: true };
};

const deleteChat = async (chatId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(400, "Invalid chatId");
  }
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!isParticipant(chat, userId)) {
    throw new ApiError(403, "Not a participant");
  }
  chat.isActive = false;
  await chat.save();
  return { deleted: true };
};

module.exports = {
  startChat,
  listChats,
  getMessages,
  sendMessage,
  markRead,
  deleteChat,
};
