const { v4: uuidv4 } = require("uuid");
const Call = require("./call.model");
const User = require("../user/user.model");
const { Chat } = require("../chat/chat.model");
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

const initiateCall = async (callerId, { receiverId, type }) => {
  if (!receiverId || !["audio", "video"].includes(type)) {
    throw new ApiError(400, "receiverId and valid type required");
  }
  if (callerId.toString() === receiverId.toString()) {
    throw new ApiError(400, "Cannot call yourself");
  }
  const caller = await User.findById(callerId);
  const receiver = await User.findById(receiverId);
  if (!receiver) throw new ApiError(404, "Receiver not found");
  if (caller.verificationLevel < 2 || receiver.verificationLevel < 2) {
    throw new ApiError(403, "Both users must be phone-verified to call");
  }

  // Must have an active chat
  const chat = await Chat.findOne({
    participants: { $all: [callerId, receiverId] },
  });
  if (!chat) throw new ApiError(403, "Start a chat first before calling");

  // Already in active call?
  const active = await Call.findOne({
    $or: [
      { callerId, status: { $in: ["initiated", "ringing", "accepted"] } },
      {
        receiverId: callerId,
        status: { $in: ["initiated", "ringing", "accepted"] },
      },
      {
        callerId: receiverId,
        status: { $in: ["initiated", "ringing", "accepted"] },
      },
      { receiverId, status: { $in: ["initiated", "ringing", "accepted"] } },
    ],
  });
  if (active) throw new ApiError(409, "One of the users is already on a call");

  const channelName = `call_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const call = await Call.create({
    callerId,
    receiverId,
    chatId: chat._id,
    type,
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

const decline = async (callId, userId) => {
  const call = await Call.findById(callId);
  if (!call) throw new ApiError(404, "Call not found");
  if (call.receiverId.toString() !== userId.toString()) {
    throw new ApiError(403, "Only receiver can decline");
  }
  call.status = "declined";
  call.endedAt = new Date();
  await call.save();
  return call;
};

const end = async (callId, userId) => {
  const call = await Call.findById(callId);
  if (!call) throw new ApiError(404, "Call not found");
  const isParticipant =
    call.callerId.toString() === userId.toString() ||
    call.receiverId.toString() === userId.toString();
  if (!isParticipant) throw new ApiError(403, "Not a participant");

  if (["ended", "declined", "missed", "no_answer"].includes(call.status)) {
    return call;
  }
  call.status = "ended";
  call.endedAt = new Date();
  call.endedBy = userId;
  if (call.answeredAt) {
    call.duration = Math.floor((call.endedAt - call.answeredAt) / 1000);
  }
  await call.save();
  return call;
};

const markMissed = async (callId) => {
  const call = await Call.findById(callId);
  if (!call) return null;
  if (call.status === "ringing" || call.status === "initiated") {
    call.status = "no_answer";
    call.endedAt = new Date();
    await call.save();
  }
  return call;
};

const history = async (userId, { limit = 30, cursor } = {}) => {
  limit = Math.min(Number(limit) || 30, 100);
  const q = {
    $or: [{ callerId: userId }, { receiverId: userId }],
  };
  if (cursor) q._id = { $lt: cursor };
  const calls = await Call.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("callerId", "name avatar")
    .populate("receiverId", "name avatar")
    .lean();
  const hasMore = calls.length > limit;
  return {
    calls: hasMore ? calls.slice(0, limit) : calls,
    nextCursor: hasMore ? calls[limit - 1]._id : null,
    hasMore,
  };
};

const getById = async (callId, userId) => {
  const call = await Call.findById(callId)
    .populate("callerId", "name avatar")
    .populate("receiverId", "name avatar");
  if (!call) throw new ApiError(404, "Call not found");
  const isParticipant =
    call.callerId._id.toString() === userId.toString() ||
    call.receiverId._id.toString() === userId.toString();
  if (!isParticipant) throw new ApiError(403, "Not a participant");
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
