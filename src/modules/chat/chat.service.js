const { Chat, Message } = require("./chat.model");
const Video = require("../video/video.model");
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");
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
  if (investorId.toString() === founderId.toString()) {
    throw new ApiError(400, "Cannot chat with yourself");
  }
  const investor = await User.findById(investorId);
  const founder = await User.findById(founderId);
  if (!founder || founder.role !== "founder") {
    throw new ApiError(404, "Founder not found");
  }
  if (investor.verificationLevel < 2) {
    throw new ApiError(403, "Verify phone before chatting");
  }
  if (!founder.openToConnect) {
    throw new ApiError(403, "Founder is not accepting new connections");
  }
  if (
    founder.blockedUsers?.some((id) => id.toString() === investorId.toString())
  ) {
    throw new ApiError(403, "You cannot message this user");
  }

  // Check mutual interest — investor must have liked founder's pitch
  const hasLiked = await Video.exists({
    founderId,
    likes: investorId,
  });
  if (!hasLiked) {
    throw new ApiError(403, "Like one of the founder's pitches first");
  }

  let chat = await Chat.findOne({ founderId, investorId });
  if (!chat) {
    // ── Free-tier quota enforcement (server-side) ──
    // Founders chat free; investors get FREE_CHATS_PER_MONTH new chats,
    // then must be on an active Pro subscription.
    if (!investor.isProActive()) {
      // Reset the monthly counter if the window has passed
      if (
        !investor.chatQuotaResetAt ||
        new Date(investor.chatQuotaResetAt) <= new Date()
      ) {
        investor.freeChatsUsedThisMonth = 0;
        investor.chatQuotaResetAt = nextMonthStart();
      }
      if ((investor.freeChatsUsedThisMonth || 0) >= FREE_CHATS_PER_MONTH) {
        throw new ApiError(
          403,
          "You've used your free chat for this month. Upgrade to Pro for unlimited conversations.",
        );
      }
      investor.freeChatsUsedThisMonth =
        (investor.freeChatsUsedThisMonth || 0) + 1;
      await investor.save({ validateBeforeSave: false });
    }

    chat = await Chat.create({
      participants: [founderId, investorId],
      founderId,
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
      "name avatar companyName isOnline lastSeen isVerified",
    )
    .populate("investorId", "name avatar isOnline lastSeen isVerified")
    .lean();
  return chats;
};

const getMessages = async (chatId, userId, { cursor, limit = 30 } = {}) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!chat.participants.some((id) => id.toString() === userId.toString())) {
    throw new ApiError(403, "Not a participant of this chat");
  }
  limit = Math.min(Number(limit) || 30, 100);
  const q = { chatId, isDeleted: false };
  if (cursor) q._id = { $lt: cursor };
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
  if (!text && !fileUrl) {
    throw new ApiError(400, "Message content required");
  }
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!chat.participants.some((id) => id.toString() === senderId.toString())) {
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
  if (chat.founderId.toString() === senderId.toString()) {
    chat.unreadCount.investor += 1;
  } else {
    chat.unreadCount.founder += 1;
  }
  await chat.save();

  return { message, chat };
};

const markRead = async (chatId, userId) => {
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
