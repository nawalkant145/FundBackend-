const chatService = require("../modules/chat/chat.service");
const notif = require("../modules/notification/notification.service");

module.exports = (io, socket) => {
                     
  socket.on("join_chat", async ({ chatId }) => {
    try {
      if (!chatId) return;
      socket.join(chatId.toString());
      if (socket.userId) {
        socket.join(socket.userId.toString());
      }
    } catch (e) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("leave_chat", ({ chatId }) => {
    if (chatId) socket.leave(chatId.toString());
  });

  socket.on(
    "send_message",
    async (
      {
        chatId,
        message: msgContent,
        text,
        messageType,
        type,
        attachment,
        fileUrl,
        replyTo,
      },
      ack,
    ) => {
      try {
        const { message, chat } = await chatService.sendMessage({
          chatId,
          senderId: socket.userId,
          message: msgContent,
          text,
          messageType,
          type,
          attachment,
          fileUrl,
          replyTo,
        });

                                                  
        socket.emit("message_sent", { messageId: message._id, status: "sent", message });

                                                                                     
        io.to(chatId.toString()).emit("new_message", message);
        io.to(chatId.toString()).emit("receive_message", message);

        const otherId = chat.participants
          .map((id) => id.toString())
          .find((id) => id !== socket.userId.toString());

        if (otherId) {
                                  
          io.to(otherId).emit("message_delivered", {
            messageId: message._id,
            chatId,
            status: "delivered",
          });

          notif
            .send(otherId, {
              type: "message",
              title: socket.userName || "New message",
              body:
                (messageType || type) === "text"
                  ? (msgContent || text)?.slice(0, 100)
                  : `[${messageType || type}]`,
              data: { chatId: chatId.toString(), senderId: socket.userId },
            })
            .catch(() => {});
        }
        ack?.({ ok: true, message });
      } catch (e) {
        ack?.({ ok: false, error: e.message });
        socket.emit("error", { message: e.message });
      }
    },
  );

  socket.on("typing", ({ chatId }) => {
    if (chatId) {
      socket.to(chatId.toString()).emit("user_typing", { userId: socket.userId, chatId });
      socket.to(chatId.toString()).emit("typing", { userId: socket.userId, chatId });
    }
  });

  socket.on("stop_typing", ({ chatId }) => {
    if (chatId) {
      socket.to(chatId.toString()).emit("user_stop_typing", { userId: socket.userId, chatId });
      socket.to(chatId.toString()).emit("stop_typing", { userId: socket.userId, chatId });
    }
  });

  socket.on("mark_read", async ({ chatId }) => {
    try {
      if (!chatId) return;
      await chatService.markRead(chatId, socket.userId);
      socket
        .to(chatId.toString())
        .emit("messages_read", { chatId, userId: socket.userId });
      socket
        .to(chatId.toString())
        .emit("message_seen", { chatId, userId: socket.userId, status: "seen" });
    } catch (e) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("message_seen", async ({ chatId, messageId }) => {
    try {
      if (chatId) {
        await chatService.markRead(chatId, socket.userId);
        io.to(chatId.toString()).emit("message_seen", {
          chatId,
          messageId,
          userId: socket.userId,
          status: "seen",
        });
      }
    } catch (e) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("edit_message", async ({ messageId, message: newText }, ack) => {
    try {
      const updated = await chatService.editMessage(messageId, socket.userId, newText);
      io.to(updated.chatId.toString()).emit("edit_message", updated);
      ack?.({ ok: true, message: updated });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
    }
  });

  socket.on("delete_message", async ({ messageId, deleteForEveryone }, ack) => {
    try {
      const updated = await chatService.deleteMessage(messageId, socket.userId, deleteForEveryone);
      if (deleteForEveryone) {
        io.to(updated.chatId.toString()).emit("delete_message", {
          messageId,
          deletedEveryone: true,
        });
      } else {
        socket.emit("delete_message", { messageId, deletedForMe: true });
      }
      ack?.({ ok: true, messageId });
    } catch (e) {
      ack?.({ ok: false, error: e.message });
    }
  });
};
