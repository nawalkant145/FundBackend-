const callService = require("../modules/call/call.service");
const notif = require("../modules/notification/notification.service");

const RING_TIMEOUT_MS = 30 * 1000;

module.exports = (io, socket) => {
  // ─── Initiate ───────────────────────────────
  socket.on("call_initiate", async ({ receiverId, type }, ack) => {
    try {
      const { call, iceServers } = await callService.initiateCall(
        socket.userId,
        {
          receiverId,
          type,
        },
      );

      // Push to receiver
      io.to(receiverId.toString()).emit("incoming_call", {
        callId: call._id,
        callerId: socket.userId,
        callerName: socket.userName,
        callerAvatar: socket.userAvatar,
        type,
        channelName: call.channelName,
      });

      // Out-of-app notification
      notif
        .send(receiverId, {
          type: "call",
          title: `${socket.userName} is calling`,
          body:
            type === "video" ? "Incoming video call" : "Incoming audio call",
          data: { callId: call._id.toString(), type },
        })
        .catch(() => {});

      // Auto-miss timer
      setTimeout(async () => {
        try {
          const updated = await callService.markMissed(call._id);
          if (updated && updated.status === "no_answer") {
            io.to(socket.userId).emit("call_no_answer", { callId: call._id });
            io.to(receiverId.toString()).emit("call_no_answer", {
              callId: call._id,
            });
            notif
              .send(receiverId, {
                type: "missed_call",
                title: `Missed call from ${socket.userName}`,
                body: type === "video" ? "Video call" : "Audio call",
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
  });

  // ─── Accept ─────────────────────────────────
  socket.on("call_accept", async ({ callId }, ack) => {
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
  });

  // ─── Decline ────────────────────────────────
  socket.on("call_decline", async ({ callId }, ack) => {
    try {
      const call = await callService.decline(callId, socket.userId);
      io.to(call.callerId.toString()).emit("call_declined", {
        callId: call._id,
      });
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
    }
  });

  // ─── End ────────────────────────────────────
  socket.on("call_end", async ({ callId }, ack) => {
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
  });

  // ─── WebRTC Signaling ───────────────────────
  socket.on("webrtc_offer", ({ targetId, offer }) => {
    io.to(targetId.toString()).emit("webrtc_offer", {
      from: socket.userId,
      offer,
    });
  });

  socket.on("webrtc_answer", ({ targetId, answer }) => {
    io.to(targetId.toString()).emit("webrtc_answer", {
      from: socket.userId,
      answer,
    });
  });

  socket.on("ice_candidate", ({ targetId, candidate }) => {
    io.to(targetId.toString()).emit("ice_candidate", {
      from: socket.userId,
      candidate,
    });
  });
};
