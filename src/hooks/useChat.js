import { useState, useEffect, useCallback, useRef } from "react";
import chatApi from "../services/chatApi";
import { getSocket } from "../socket/socket";

export const useChat = (currentUser) => {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Load chat conversations
  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const data = await chatApi.listChats();
      setChats(data);
    } catch (err) {
      console.error("Failed to load chats:", err);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Load messages for active chat
  const loadMessages = useCallback(async (chatId, cursor = null) => {
    if (!chatId) return;
    setLoadingMessages(true);
    try {
      const res = await chatApi.getMessages(chatId, { cursor, limit: 30 });
      if (cursor) {
        setMessages((prev) => [...res.messages, ...prev]);
      } else {
        setMessages(res.messages);
      }
      setHasMoreMessages(res.hasMore);
      setNextCursor(res.nextCursor);

      // Mark read
      chatApi.markRead(chatId).catch(() => {});
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Select active conversation
  const selectChat = useCallback(
    (chat) => {
      setActiveChat(chat);
      setReplyingTo(null);
      if (chat) {
        loadMessages(chat._id);
        const socket = getSocket();
        if (socket) {
          socket.emit("join_chat", { chatId: chat._id });
        }
      }
    },
    [loadMessages],
  );

  // Send message
  const sendMessage = useCallback(
    async ({ message, messageType = "text", attachment = null }) => {
      if (!activeChat || (!message.trim() && !attachment)) return;

      const currentReply = replyingTo;
      setReplyingTo(null);

      // Optimistic message object
      const tempId = `temp_${Date.now()}`;
      const optimisticMsg = {
        _id: tempId,
        chatId: activeChat._id,
        senderId: currentUser._id || currentUser.id,
        receiverId:
          activeChat.founderId?._id === currentUser._id
            ? activeChat.investorId?._id
            : activeChat.founderId?._id,
        message,
        text: message,
        messageType,
        type: messageType,
        attachment: attachment || { url: "", name: "", size: 0, mimeType: "" },
        status: "sent",
        replyTo: currentReply,
        createdAt: new Date().toISOString(),
        isOptimistic: true,
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit(
            "send_message",
            {
              chatId: activeChat._id,
              message,
              text: message,
              messageType,
              type: messageType,
              attachment,
              replyTo: currentReply?._id,
            },
            (ack) => {
              if (ack && ack.ok && ack.message) {
                setMessages((prev) =>
                  prev.map((m) => (m._id === tempId ? ack.message : m)),
                );
              }
            },
          );
        } else {
          const sent = await chatApi.sendMessage(activeChat._id, {
            message,
            text: message,
            messageType,
            type: messageType,
            attachment,
            replyTo: currentReply?._id,
          });
          setMessages((prev) =>
            prev.map((m) => (m._id === tempId ? sent : m)),
          );
        }
      } catch (err) {
        console.error("Error sending message:", err);
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
      }
    },
    [activeChat, currentUser, replyingTo],
  );

  // Edit message
  const editMessage = useCallback(
    async (messageId, newText) => {
      if (!activeChat || !newText.trim()) return;
      try {
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit("edit_message", { messageId, message: newText });
        } else {
          await chatApi.editMessage(activeChat._id, messageId, newText);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId ? { ...m, message: newText, text: newText, edited: true } : m,
          ),
        );
      } catch (err) {
        console.error("Error editing message:", err);
      }
    },
    [activeChat],
  );

  // Delete message
  const deleteMessage = useCallback(
    async (messageId, deleteForEveryone = false) => {
      if (!activeChat) return;
      try {
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit("delete_message", { messageId, deleteForEveryone });
        } else {
          await chatApi.deleteMessage(activeChat._id, messageId, deleteForEveryone);
        }

        if (deleteForEveryone) {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === messageId
                ? { ...m, deletedEveryone: true, message: "This message was deleted" }
                : m,
            ),
          );
        } else {
          setMessages((prev) => prev.filter((m) => m._id !== messageId));
        }
      } catch (err) {
        console.error("Error deleting message:", err);
      }
    },
    [activeChat],
  );

  // Typing indicators
  const sendTyping = useCallback(() => {
    if (!activeChat) return;
    const socket = getSocket();
    if (socket) socket.emit("typing", { chatId: activeChat._id });
  }, [activeChat]);

  const sendStopTyping = useCallback(() => {
    if (!activeChat) return;
    const socket = getSocket();
    if (socket) socket.emit("stop_typing", { chatId: activeChat._id });
  }, [activeChat]);

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg) => {
      if (activeChatRef.current && msg.chatId === activeChatRef.current._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        socket.emit("message_seen", { chatId: msg.chatId, messageId: msg._id });
      }
      fetchChats();
    };

    const handleMessageDelivered = ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, status } : m)),
      );
    };

    const handleMessageSeen = ({ chatId, messageId }) => {
      if (activeChatRef.current && chatId === activeChatRef.current._id) {
        setMessages((prev) =>
          prev.map((m) =>
            !messageId || m._id === messageId ? { ...m, status: "seen" } : m,
          ),
        );
      }
    };

    const handleTyping = ({ userId, chatId }) => {
      if (activeChatRef.current && chatId === activeChatRef.current._id) {
        setTypingUsers((prev) => ({ ...prev, [userId]: true }));
      }
    };

    const handleStopTyping = ({ userId, chatId }) => {
      if (activeChatRef.current && chatId === activeChatRef.current._id) {
        setTypingUsers((prev) => ({ ...prev, [userId]: false }));
      }
    };

    const handleEditedMessage = (updatedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)),
      );
    };

    const handleDeletedMessage = ({ messageId, deletedEveryone }) => {
      if (deletedEveryone) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? { ...m, deletedEveryone: true, message: "This message was deleted" }
              : m,
          ),
        );
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("receive_message", handleNewMessage);
    socket.on("message_delivered", handleMessageDelivered);
    socket.on("message_seen", handleMessageSeen);
    socket.on("user_typing", handleTyping);
    socket.on("typing", handleTyping);
    socket.on("user_stop_typing", handleStopTyping);
    socket.on("stop_typing", handleStopTyping);
    socket.on("edit_message", handleEditedMessage);
    socket.on("delete_message", handleDeletedMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("receive_message", handleNewMessage);
      socket.off("message_delivered", handleMessageDelivered);
      socket.off("message_seen", handleMessageSeen);
      socket.off("user_typing", handleTyping);
      socket.off("typing", handleTyping);
      socket.off("user_stop_typing", handleStopTyping);
      socket.off("stop_typing", handleStopTyping);
      socket.off("edit_message", handleEditedMessage);
      socket.off("delete_message", handleDeletedMessage);
    };
  }, [fetchChats]);

  return {
    chats,
    activeChat,
    messages,
    loadingChats,
    loadingMessages,
    hasMoreMessages,
    nextCursor,
    typingUsers,
    replyingTo,
    searchQuery,
    setSearchQuery,
    setReplyingTo,
    selectChat,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTyping,
    sendStopTyping,
    loadMoreMessages: () => activeChat && loadMessages(activeChat._id, nextCursor),
    refreshChats: fetchChats,
  };
};

export default useChat;
