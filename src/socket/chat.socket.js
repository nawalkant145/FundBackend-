const chatService = require("../modules/chat/chat.service");
const notif = require("../modules/notification/notification.service");

module.exports = (io, socket) => {
  // Join a chat room
  socket.on("join_chat", async ({ chatId }) => {
    try {
      if (!chatId) return;
      // Verify membership
      const result = await chatService.getMessages(chatId, socket.userId, {
        limit: 1,
      });
      if (!result) return;
      socket.join(chatId.toString());
    } catch (e) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("leave_chat", ({ chatId }) => {
    if (chatId) socket.leave(chatId.toString());
  });

  socket.on("send_message", async ({ chatId, text, type, fileUrl }, ack) => {
    try {
      const { message, chat } = await chatService.sendMessage({
        chatId,
        senderId: socket.userId,
        text,
        type,
        fileUrl,
      });
      io.to(chatId.toString()).emit("new_message", message);

      // Notify the other participant if not in the room
      const otherId = chat.participants
        .map((id) => id.toString())
        .find((id) => id !== socket.userId.toString());
      if (otherId) {
        notif
          .send(otherId, {
            type: "message",
            title: socket.userName || "New message",
            body: type === "text" ? text?.slice(0, 100) : `[${type}]`,
            data: { chatId: chatId.toString(), senderId: socket.userId },
          })
          .catch(() => {});
      }
      ack?.({ ok: true, message });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("typing", ({ chatId }) => {
    if (chatId) socket.to(chatId.toString()).emit("user_typing", { userId: socket.userId });
  });

  socket.on("stop_typing", ({ chatId }) => {
    if (chatId) socket.to(chatId.toString()).emit("user_stop_typing", { userId: socket.userId });
  });

  socket.on("mark_read", async ({ chatId }) => {
    try {
      if (!chatId) return;
      await chatService.markRead(chatId, socket.userId);
      socket
        .to(chatId.toString())
        .emit("messages_read", { chatId, userId: socket.userId });
    } catch (e) {
      socket.emit("error", { message: e.message });
    }
  });
};
