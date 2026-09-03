const callService = require("../modules/call/call.service");
const notif = require("../modules/notification/notification.service");

const RING_TIMEOUT_MS = 30 * 1000;

module.exports = (io, socket) => {
  const handleInitiateCall = async ({ receiverId, callType, type, chatId }, ack) => {
    try {
      const finalType = callType || type || "voice";
      const { call, iceServers } = await callService.initiateCall(
        socket.userId,
        {
          receiverId,
          callType: finalType,
          type: finalType,
          chatId,
        },
      );

                                             
      const payload = {
        callId: call._id,
        callerId: socket.userId,
        callerName: socket.userName,
        callerAvatar: socket.userAvatar,
        callType: finalType,
        type: finalType,
        channelName: call.channelName,
        startedAt: call.startedAt,
      };

      io.to(receiverId.toString()).emit("incoming_call", payload);

                                
      notif
        .send(receiverId, {
          type: "call",
          title: `${socket.userName} is calling`,
          body:
            finalType === "video" ? "Incoming video call" : "Incoming voice call",
          data: { callId: call._id.toString(), type: finalType },
        })
        .catch(() => {});

                        
      setTimeout(async () => {
        try {
          const updated = await callService.markMissed(call._id);
          if (updated && (updated.status === "missed" || updated.status === "no_answer")) {
            io.to(socket.userId).emit("call_timeout", { callId: call._id });
            io.to(socket.userId).emit("call_no_answer", { callId: call._id });
            io.to(receiverId.toString()).emit("call_timeout", { callId: call._id });
            io.to(receiverId.toString()).emit("call_no_answer", { callId: call._id });
            notif
              .send(receiverId, {
                type: "missed_call",
                title: `Missed call from ${socket.userName}`,
                body: finalType === "video" ? "Video call" : "Voice call",
                data: { callId: call._id.toString() },
              })
              .catch(() => {});
          }
        } catch {}
      }, RING_TIMEOUT_MS).unref?.();

      ack?.({
        ok: true,
        callId: call._id,
        channelName: call.channelName,
        iceServers,
      });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
      socket.emit("error", { message: e.message });
    }
  };

  socket.on("call_user", handleInitiateCall);
  socket.on("call_initiate", handleInitiateCall);

  const handleAcceptCall = async ({ callId }, ack) => {
    try {
      const { call, iceServers } = await callService.accept(
        callId,
        socket.userId,
      );
      io.to(call.callerId.toString()).emit("call_accepted", {
        callId: call._id,
        channelName: call.channelName,
        iceServers,
      });
      ack?.({ ok: true, channelName: call.channelName, iceServers });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
    }
  };

  socket.on("accept_call", handleAcceptCall);
  socket.on("call_accept", handleAcceptCall);

  const handleRejectCall = async ({ callId }, ack) => {
    try {
      const call = await callService.decline(callId, socket.userId);
      io.to(call.callerId.toString()).emit("call_declined", {
        callId: call._id,
      });
      io.to(call.callerId.toString()).emit("reject_call", {
        callId: call._id,
      });
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
    }
  };

  socket.on("reject_call", handleRejectCall);
  socket.on("call_decline", handleRejectCall);

  const handleEndCall = async ({ callId }, ack) => {
    try {
      const call = await callService.end(callId, socket.userId);
      const otherId =
        call.callerId.toString() === socket.userId
          ? call.receiverId.toString()
          : call.callerId.toString();

      io.to(otherId).emit("call_ended", {
        callId: call._id,
        duration: call.duration,
      });
      socket.emit("call_ended", { callId: call._id, duration: call.duration });

      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
    }
  };

  socket.on("end_call", handleEndCall);
  socket.on("call_end", handleEndCall);

                                                 
  const handleOffer = ({ targetId, offer }) => {
    if (targetId) {
      io.to(targetId.toString()).emit("offer", { from: socket.userId, offer });
      io.to(targetId.toString()).emit("webrtc_offer", { from: socket.userId, offer });
    }
  };
  socket.on("offer", handleOffer);
  socket.on("webrtc_offer", handleOffer);

  const handleAnswer = ({ targetId, answer }) => {
    if (targetId) {
      io.to(targetId.toString()).emit("answer", { from: socket.userId, answer });
      io.to(targetId.toString()).emit("webrtc_answer", { from: socket.userId, answer });
    }
  };
  socket.on("answer", handleAnswer);
  socket.on("webrtc_answer", handleAnswer);

  socket.on("ice_candidate", ({ targetId, candidate }) => {
    if (targetId) {
      io.to(targetId.toString()).emit("ice_candidate", {
        from: socket.userId,
        candidate,
      });
    }
  });

  socket.on("media_state_change", ({ targetId, muted, cameraOff, isScreenSharing }) => {
    if (targetId) {
      io.to(targetId.toString()).emit("media_state_change", {
        from: socket.userId,
        muted,
        cameraOff,
        isScreenSharing,
      });
    }
  });
};
