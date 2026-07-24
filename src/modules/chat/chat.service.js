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

// Investor starts chat with founder. Requires investor to have liked
// at least one of founder's pitches (mutual interest signal).
const startChat = async (investorId, founderId) => {
  if (!founderId) {
    throw new ApiError(400, "founderId required");
  }

  let resolvedFounderId = await resolveUserId(founderId);
  if (!resolvedFounderId) {
    throw new ApiError(404, "Founder not found");
  }

  // Cannot chat with yourself
  if (investorId.toString() === resolvedFounderId.toString()) {
    throw new ApiError(400, "Cannot chat with yourself");
  }

  const investor = await User.findById(investorId);
  const founder = await User.findById(resolvedFounderId);
  if (!founder) {
    throw new ApiError(404, "Founder not found");
  }
  if (investor.verificationLevel < 2) {
    // In dev, bypass verification level check so testing chat works smoothly
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(403, "Verify phone before chatting");
    }
  }
  if (founder.openToConnect === false) {
    throw new ApiError(403, "Founder is not accepting new connections");
  }
  if (
    founder.blockedUsers?.some((id) => id.toString() === investorId.toString())
  ) {
    throw new ApiError(403, "You cannot message this user");
  }

  // Check mutual interest — investor must have liked founder's pitch or follow the founder
  const hasLiked = await Video.exists({
    founderId: resolvedFounderId,
    likes: investorId,
  });
  const followingArray = investor.following || [];
  const isFollowing = followingArray.some(
    (id) => id.toString() === resolvedFounderId.toString(),
  );

  if (!hasLiked && !isFollowing) {
    // In development or when using mock profiles, automatically add founder to following
    if (process.env.NODE_ENV !== "production") {
      investor.following = investor.following || [];
      investor.following.push(resolvedFounderId);
      await investor.save({ validateBeforeSave: false });
    } else {
      throw new ApiError(
        403,
        "Like one of the founder's pitches or follow them first to start a chat",
      );
    }
  }

  let chat = await Chat.findOne({ founderId: resolvedFounderId, investorId });

  // ── Subscription / free-tier gate ────────────────────────────────────────
  // Only investors who are Pro (or still within their free quota) can start/open chats.
  // Founders always have free access.
  if (investor.role !== "founder" && !investor.isProActive()) {
    if (
      !investor.chatQuotaResetAt ||
      new Date(investor.chatQuotaResetAt) <= new Date()
    ) {
      investor.freeChatsUsedThisMonth = 0;
      investor.chatQuotaResetAt = nextMonthStart();
      await investor.save({ validateBeforeSave: false });
    }

    if ((investor.freeChatsUsedThisMonth || 0) >= FREE_CHATS_PER_MONTH) {
      throw new ApiError(
        403,
        "You've used your free chat for this month. Upgrade to Pro for unlimited conversations.",
      );
    }

    if (!chat) {
      investor.freeChatsUsedThisMonth =
        (investor.freeChatsUsedThisMonth || 0) + 1;
      await investor.save({ validateBeforeSave: false });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (!chat) {
    chat = await Chat.create({
      participants: [resolvedFounderId, investorId],
      founderId: resolvedFounderId,
      investorId,
    });
  }
  return chat;
};

const listChats = async (userId) => {
  const chats = await Chat.find({ participants: userId, isActive: true })
    .sort({ lastMessageAt: -1 })
    .populate(
      "founderId",
      "name username avatar companyName isOnline lastSeen isVerified",
    )
    .populate(
      "investorId",
      "name username avatar isOnline lastSeen isVerified",
    )
    .lean();

  chats.forEach((ch) => {
    if (ch.founderId && !ch.founderId.avatar) ch.founderId.avatar = null;
    if (ch.investorId && !ch.investorId.avatar) ch.investorId.avatar = null;
  });

  return chats;
};

const getMessages = async (chatId, userId, { cursor, limit = 30 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(400, "Invalid chatId");
  }
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!chat.participants.some((id) => id.toString() === userId.toString())) {
    throw new ApiError(403, "Not a participant of this chat");
  }
  limit = Math.min(Number(limit) || 30, 100);
  const q = { chatId, isDeleted: false };
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
  if (!chat.participants.some((id) => id.toString() === senderId.toString())) {
    throw new ApiError(403, "Not a participant of this chat");
  }

  const sender = await User.findById(senderId);
  if (sender && sender.role !== "founder" && !sender.isProActive()) {
    if (
      !sender.chatQuotaResetAt ||
      new Date(sender.chatQuotaResetAt) <= new Date()
    ) {
      sender.freeChatsUsedThisMonth = 0;
      sender.chatQuotaResetAt = nextMonthStart();
      await sender.save({ validateBeforeSave: false });
    }

    if ((sender.freeChatsUsedThisMonth || 0) >= FREE_CHATS_PER_MONTH) {
      throw new ApiError(
        403,
        "You've used your free chat for this month. Upgrade to Pro for unlimited conversations.",
      );
    }
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
  if (chat.founderId.toString() === senderId.toString()) {
    chat.unreadCount.investor += 1;
  } else {
    chat.unreadCount.founder += 1;
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
  if (!chat.participants.some((id) => id.toString() === userId.toString())) {
    throw new ApiError(403, "Not a participant");
  }

  await Message.updateMany(
    { chatId, senderId: { $ne: userId }, isRead: false },
    { isRead: true, readAt: new Date() },
  );
  if (chat.founderId.toString() === userId.toString()) {
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
  if (!chat.participants.some((id) => id.toString() === userId.toString())) {
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
