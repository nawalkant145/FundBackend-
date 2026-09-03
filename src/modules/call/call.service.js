const { v4: uuidv4 } = require("uuid");
const Call = require("./call.model");
const User = require("../user/user.model");
const { Chat, Message } = require("../chat/chat.model");
const ApiError = require("../../utils/ApiError");

const ICE_SERVERS = () => {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  if (process.env.METERED_USERNAME && process.env.METERED_CREDENTIAL) {
    servers.push({
      urls: "turn:standard.relay.metered.ca:80",
      username: process.env.METERED_USERNAME,
      credential: process.env.METERED_CREDENTIAL,
    });
    servers.push({
      urls: "turn:standard.relay.metered.ca:443",
      username: process.env.METERED_USERNAME,
      credential: process.env.METERED_CREDENTIAL,
    });
  }
  return servers;
};

const initiateCall = async (callerId, { receiverId, callType, type, chatId }) => {
  const finalCallType = callType || type || "meeting";
  const normalizedType =
    finalCallType === "meeting" || finalCallType === "video"
      ? "video"
      : finalCallType === "audio"
        ? "voice"
        : finalCallType;

  if (!receiverId || !["voice", "video", "audio", "meeting"].includes(finalCallType)) {
    throw new ApiError(400, "receiverId and valid callType required");
  }
  if (callerId.toString() === receiverId.toString()) {
    throw new ApiError(400, "Cannot call yourself");
  }
  const caller = await User.findById(callerId);
  const receiver = await User.findById(receiverId);
  if (!receiver) throw new ApiError(404, "Receiver not found");
  const isPhoneVerified = (user) => !!(user?.phoneVerified || user?.isPhoneVerified || (user?.verificationLevel || 0) >= 1);
  if (!isPhoneVerified(caller) || !isPhoneVerified(receiver)) {
    throw new ApiError(403, "Both users must be phone-verified to call");
  }
  if (caller.role === "investor" && !caller.isProActive()) {
    throw new ApiError(
      403,
      "Calls are a Pro feature. Upgrade to start audio/video calls.",
    );
  }

                                             
  let chat = null;
  if (chatId) {
    chat = await Chat.findById(chatId);
  }
  if (!chat) {
    chat = await Chat.findOne({
      $or: [
        { participants: { $all: [callerId, receiverId] } },
        { founderId: callerId, investorId: receiverId },
        { founderId: receiverId, investorId: callerId },
      ],
      isActive: { $ne: false },
    });
  }

                                                                                       
  const staleCutoff = new Date(Date.now() - 60 * 1000);
  await Call.updateMany(
    {
      $or: [
        { callerId, status: { $in: ["initiated", "ringing", "accepted"] } },
        { receiverId: callerId, status: { $in: ["initiated", "ringing", "accepted"] } },
        { callerId: receiverId, status: { $in: ["initiated", "ringing", "accepted"] } },
        { receiverId, status: { $in: ["initiated", "ringing", "accepted"] } },
      ],
      createdAt: { $lt: staleCutoff },
    },
    { $set: { status: "ended", endedAt: new Date() } }
  );

                                                                           
  await Call.updateMany(
    {
      $or: [
        { callerId, receiverId, status: { $in: ["initiated", "ringing", "accepted"] } },
        { callerId: receiverId, receiverId: callerId, status: { $in: ["initiated", "ringing", "accepted"] } },
      ],
    },
    { $set: { status: "ended", endedAt: new Date() } }
  );

  const channelName = `call_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const call = await Call.create({
    callerId,
    receiverId,
    chatId: chat?._id || null,
    callType: normalizedType,
    type: normalizedType,
    channelName,
    status: "ringing",
  });
  return { call, iceServers: ICE_SERVERS() };
};

const accept = async (callId, userId) => {
  const call = await Call.findById(callId);
  if (!call) throw new ApiError(404, "Call not found");
  if (call.receiverId.toString() !== userId.toString()) {
    throw new ApiError(403, "Only receiver can accept");
  }
  if (call.status !== "ringing") {
    throw new ApiError(400, `Cannot accept call in status ${call.status}`);
  }
  call.status = "accepted";
  call.answeredAt = new Date();
  await call.save();
  return { call, iceServers: ICE_SERVERS() };
};

const createCallChatMessage = async (call, reason) => {
  try {
    const { getIO } = require("../../socket");
    let chatId = call.chatId;

    if (!chatId) {
      const existingChat = await Chat.findOne({
        $or: [
          { participants: { $all: [call.callerId, call.receiverId] } },
          { founderId: call.callerId, investorId: call.receiverId },
          { founderId: call.receiverId, investorId: call.callerId },
        ],
        isActive: { $ne: false },
      });
      if (existingChat) {
        chatId = existingChat._id;
      } else {
        const newChat = await Chat.create({
          participants: [call.callerId, call.receiverId],
          founderId: call.callerId,
          investorId: call.receiverId,
        });
        chatId = newChat._id;
      }
    }

    const isVideo = call.callType === "video" || call.callType === "meeting" || call.type === "video";
    const callLabel = isVideo ? "Video call" : "Voice call";
    const icon = isVideo ? "📹" : "📞";

    let messageText = "";
    if (reason === "completed" && call.duration > 0) {
      const mins = Math.floor(call.duration / 60);
      const secs = call.duration % 60;
      const durationStr = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      messageText = `${icon} ${callLabel} (${durationStr})`;
    } else if (reason === "declined" || reason === "rejected") {
      messageText = `${icon} ${callLabel} declined`;
    } else if (reason === "missed" || reason === "no_answer") {
      messageText = `${icon} Missed ${callLabel.toLowerCase()}`;
    } else {
      messageText = `${icon} ${callLabel} ended`;
    }

    const msgDoc = await Message.create({
      chatId,
      senderId: call.callerId,
      receiverId: call.receiverId,
      message: messageText,
      text: messageText,
      messageType: "system",
      type: "system",
      status: "sent",
    });

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: messageText,
      lastMessageAt: new Date(),
    });

    const io = getIO();
    if (io) {
      const populatedMsg = await Message.findById(msgDoc._id)
        .populate("senderId", "name username avatar")
        .populate("receiverId", "name username avatar")
        .lean();

      io.to(chatId.toString()).emit("new_message", populatedMsg);
      io.to(chatId.toString()).emit("receive_message", populatedMsg);
    }
  } catch (err) {
    console.error("Error creating call chat message:", err);
  }
};

const decline = async (callId, userId) => {
  const call = await Call.findById(callId);
  if (!call) throw new ApiError(404, "Call not found");
  if (call.receiverId.toString() !== userId.toString()) {
    throw new ApiError(403, "Only receiver can decline");
  }
  call.status = "rejected";
  call.endedAt = new Date();
  await call.save();

  await createCallChatMessage(call, "declined");

  return call;
};

const end = async (callId, userId) => {
  const call = await Call.findById(callId);
  if (!call) throw new ApiError(404, "Call not found");
  const isParticipant =
    call.callerId.toString() === userId.toString() ||
    call.receiverId.toString() === userId.toString();
  if (!isParticipant) throw new ApiError(403, "Not a participant");

  if (["ended", "completed", "declined", "rejected", "missed", "no_answer", "cancelled"].includes(call.status)) {
    return call;
  }
  call.status = call.answeredAt ? "completed" : "ended";
  call.endedAt = new Date();
  call.endedBy = userId;
  if (call.answeredAt) {
    call.duration = Math.floor((call.endedAt - call.answeredAt) / 1000);
  }
  await call.save();

  await createCallChatMessage(call, call.answeredAt ? "completed" : "ended");

  return call;
};

const markMissed = async (callId) => {
  const call = await Call.findById(callId);
  if (!call) return null;
  if (call.status === "ringing" || call.status === "initiated") {
    call.status = "missed";
    call.endedAt = new Date();
    await call.save();

    await createCallChatMessage(call, "missed");
  }
  return call;
};

const history = async (userId, { filter = "all", query = "", limit = 30, cursor } = {}) => {
  limit = Math.min(Number(limit) || 30, 100);

  const baseUserQuery = {
    $or: [{ callerId: userId }, { receiverId: userId }],
  };

  const andConditions = [baseUserQuery];

  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    andConditions.push({ _id: { $lt: cursor } });
  }

  if (filter === "missed" || filter === "unread") {
    andConditions.push({ status: { $in: ["missed", "no_answer", "rejected", "declined"] } });
  } else if (filter === "voice") {
    andConditions.push({
      $or: [
        { callType: { $in: ["voice", "audio"] } },
        { type: { $in: ["voice", "audio"] } },
      ],
    });
  } else if (filter === "video") {
    andConditions.push({
      $or: [{ callType: "video" }, { type: "video" }],
    });
  } else if (filter === "completed") {
    andConditions.push({ status: { $in: ["completed", "ended", "accepted"] } });
  } else if (filter === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    andConditions.push({ createdAt: { $gte: startOfDay } });
  } else if (filter === "yesterday") {
    const startOfYesterday = new Date();
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date();
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);
    andConditions.push({ createdAt: { $gte: startOfYesterday, $lte: endOfYesterday } });
  }

  const q = { $and: andConditions };

  const rawCalls = await Call.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("callerId", "name username avatar companyName isVerified verificationLevel")
    .populate("receiverId", "name username avatar companyName isVerified verificationLevel")
    .lean();

  const hasMore = rawCalls.length > limit;
  let items = hasMore ? rawCalls.slice(0, limit) : rawCalls;

                                                  
  items = items.map((c) => {
    const callerIdStr = c.callerId?._id ? c.callerId._id.toString() : c.callerId?.toString();
    const isCaller = callerIdStr === userId.toString();
    const otherUser = isCaller ? c.receiverId : c.callerId;
    const direction = isCaller ? "outgoing" : "incoming";
    const normCallType = c.callType || c.type || "voice";
    return {
      _id: c._id,
      callerId: c.callerId,
      receiverId: c.receiverId,
      chatId: c.chatId,
      callType: normCallType === "audio" ? "voice" : normCallType,
      direction,
      status: c.status,
      duration: c.duration || 0,
      channelName: c.channelName,
      startedAt: c.startedAt || c.createdAt,
      endedAt: c.endedAt,
      createdAt: c.createdAt,
      otherUser,
    };
  });

                                                                              
  if (query && typeof query === "string" && query.trim().length > 0) {
    const lowerQ = query.toLowerCase().trim();
    items = items.filter(
      (c) =>
        c.otherUser?.name?.toLowerCase().includes(lowerQ) ||
        c.otherUser?.username?.toLowerCase().includes(lowerQ),
    );
  }

  const nextCursor = hasMore ? rawCalls[limit - 1]._id : null;
  return { calls: items, nextCursor, hasMore };
};

const getById = async (callId, userId) => {
  const call = await Call.findById(callId)
    .populate("callerId", "name username avatar companyName isVerified verificationLevel")
    .populate("receiverId", "name username avatar companyName isVerified verificationLevel")
    .lean();
  if (!call) throw new ApiError(404, "Call not found");
  const isParticipant =
    call.callerId._id.toString() === userId.toString() ||
    call.receiverId._id.toString() === userId.toString();
  if (!isParticipant) throw new ApiError(403, "Not a participant");

  const isCaller = call.callerId._id.toString() === userId.toString();
  call.direction = isCaller ? "outgoing" : "incoming";
  call.callType = call.callType || call.type || "voice";
  call.otherUser = isCaller ? call.receiverId : call.callerId;

  return call;
};

module.exports = {
  initiateCall,
  accept,
  decline,
  end,
  markMissed,
  history,
  getById,
  ICE_SERVERS,
};
