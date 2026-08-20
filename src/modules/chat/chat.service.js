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

  const isPhoneVerified = (u) => !!(u?.phoneVerified || u?.isPhoneVerified || (u?.verificationLevel || 0) >= 1);
  if (!isPhoneVerified(initiator)) {
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
  const q = {
    chatId,
    deletedEveryone: { $ne: true },
    deletedFor: { $ne: userId },
    isDeleted: { $ne: true },
  };
  if (cursor) {
    if (!mongoose.Types.ObjectId.isValid(cursor)) {
      throw new ApiError(400, "Invalid cursor");
    }
    q._id = { $lt: cursor };
  }
  const messages = await Message.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("replyTo", "_id senderId message text messageType attachment")
    .lean();

  const hasMore = messages.length > limit;
  const items = (hasMore ? messages.slice(0, limit) : messages).reverse();

  // Normalize message fields to match standard schema
  items.forEach((m) => {
    if (!m.message) m.message = m.text || "";
    if (!m.text) m.text = m.message || "";
    if (!m.messageType) m.messageType = m.type || "text";
    if (!m.type) m.type = m.messageType || "text";
    if (!m.status) m.status = m.isRead ? "seen" : "sent";
    if (!m.createdAt) m.createdAt = m.updatedAt || new Date().toISOString();
    if (!m.attachment) {
      m.attachment = m.fileUrl
        ? { url: m.fileUrl, name: "", size: 0, mimeType: "" }
        : { url: "", name: "", size: 0, mimeType: "" };
    }
  });

  const nextCursor = hasMore ? messages[limit - 1]._id : null;
  return { messages: items, nextCursor, hasMore };
};

const sendMessage = async ({
  chatId,
  senderId,
  receiverId,
  message: msgContent,
  text,
  messageType = "text",
  type = "text",
  attachment,
  fileUrl = "",
  replyTo = null,
}) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(400, "Invalid chatId");
  }
  const bodyText = msgContent || text || "";
  const finalType = messageType || type || "text";

  if (!bodyText && !fileUrl && (!attachment || !attachment.url)) {
    throw new ApiError(400, "Message content required");
  }
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!isParticipant(chat, senderId)) {
    throw new ApiError(403, "Not a participant of this chat");
  }

  let calculatedReceiverId = receiverId;
  if (!calculatedReceiverId) {
    if (chat.founderId && chat.founderId.toString() !== senderId.toString()) {
      calculatedReceiverId = chat.founderId;
    } else if (chat.investorId && chat.investorId.toString() !== senderId.toString()) {
      calculatedReceiverId = chat.investorId;
    } else if (Array.isArray(chat.participants)) {
      calculatedReceiverId = chat.participants.find(
        (p) => p && p.toString() !== senderId.toString(),
      );
    }
  }

  if (!calculatedReceiverId) {
    throw new ApiError(400, "Receiver not found for this chat");
  }

  const attachmentObj = attachment || {
    url: fileUrl || "",
    name: "",
    size: 0,
    mimeType: "",
  };

  const messageDoc = await Message.create({
    chatId,
    senderId,
    receiverId: calculatedReceiverId,
    message: bodyText,
    text: bodyText,
    messageType: finalType,
    type: finalType,
    attachment: attachmentObj,
    fileUrl: attachmentObj.url || fileUrl,
    replyTo: replyTo && mongoose.Types.ObjectId.isValid(replyTo) ? replyTo : null,
    status: "sent",
  });

  const populatedMessage = await Message.findById(messageDoc._id)
    .populate("replyTo", "_id senderId message text messageType attachment")
    .lean();

  if (!populatedMessage.message) populatedMessage.message = populatedMessage.text || "";
  if (!populatedMessage.messageType) populatedMessage.messageType = populatedMessage.type || "text";

  chat.lastMessage = finalType === "text" ? bodyText : `[${finalType}]`;
  chat.lastMessageAt = new Date();

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

  return { message: populatedMessage, chat };
};

const editMessage = async (messageId, userId, newText) => {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new ApiError(400, "Invalid messageId");
  }
  const msg = await Message.findById(messageId);
  if (!msg) throw new ApiError(404, "Message not found");
  if (msg.senderId.toString() !== userId.toString()) {
    throw new ApiError(403, "Only the sender can edit this message");
  }
  if (msg.deletedEveryone) {
    throw new ApiError(400, "Cannot edit deleted message");
  }

  msg.message = newText;
  msg.text = newText;
  msg.edited = true;
  await msg.save();
  return msg;
};

const deleteMessage = async (messageId, userId, deleteForEveryone = false) => {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new ApiError(400, "Invalid messageId");
  }
  const msg = await Message.findById(messageId);
  if (!msg) throw new ApiError(404, "Message not found");

  if (deleteForEveryone) {
    if (msg.senderId.toString() !== userId.toString()) {
      throw new ApiError(403, "Only the sender can delete for everyone");
    }
    msg.deletedEveryone = true;
    msg.isDeleted = true;
    msg.message = "This message was deleted";
    msg.text = "This message was deleted";
  } else {
    if (!msg.deletedFor.includes(userId)) {
      msg.deletedFor.push(userId);
    }
  }
  await msg.save();
  return msg;
};

const searchMessages = async (chatId, userId, { query, limit = 20 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(400, "Invalid chatId");
  }
  if (!query || typeof query !== "string") return { messages: [] };

  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!isParticipant(chat, userId)) {
    throw new ApiError(403, "Not a participant");
  }

  const messages = await Message.find({
    chatId,
    deletedEveryone: { $ne: true },
    deletedFor: { $ne: userId },
    $or: [
      { message: { $regex: query, $options: "i" } },
      { text: { $regex: query, $options: "i" } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return { messages };
};

const getChatMedia = async (chatId, userId, { mediaType = "all", limit = 30, cursor } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(400, "Invalid chatId");
  }
  const chat = await Chat.findById(chatId);
  if (!chat) throw new ApiError(404, "Chat not found");
  if (!isParticipant(chat, userId)) {
    throw new ApiError(403, "Not a participant");
  }

  const q = {
    chatId,
    deletedEveryone: { $ne: true },
    deletedFor: { $ne: userId },
  };

  if (mediaType === "images") q.$or = [{ messageType: "image" }, { type: "image" }];
  else if (mediaType === "videos") q.$or = [{ messageType: "video" }, { type: "video" }];
  else if (mediaType === "documents") q.$or = [{ messageType: "document" }, { type: "file" }];
  else if (mediaType === "audio") q.$or = [{ messageType: "audio" }, { type: "audio" }];
  else if (mediaType === "links") q.$or = [{ messageType: "link" }, { message: { $regex: "https?://", $options: "i" } }];
  else {
    q.$or = [
      { messageType: { $in: ["image", "video", "audio", "document", "link"] } },
      { type: { $in: ["image", "file", "video", "audio"] } },
      { fileUrl: { $ne: "" } },
    ];
  }

  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    q._id = { $lt: cursor };
  }

  const items = await Message.find(q).sort({ _id: -1 }).limit(limit).lean();
  return { media: items };
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
    { chatId, senderId: { $ne: userId }, status: { $ne: "seen" } },
    { status: "seen", isRead: true, readAt: new Date() },
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
  editMessage,
  deleteMessage,
  searchMessages,
  getChatMedia,
  markRead,
  deleteChat,
};
