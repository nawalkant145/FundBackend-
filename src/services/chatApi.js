import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || "/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const chatApi = {
  // List all conversations
  listChats: async () => {
    const res = await api.get("/chat/list");
    return res.data.data.chats || [];
  },

  // Start or get chat with user
  startChat: async (targetId) => {
    const res = await api.post("/chat/start", { targetId });
    return res.data.data.chat;
  },

  // Get message history for a chat
  getMessages: async (chatId, { cursor, limit = 30 } = {}) => {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    const res = await api.get(`/chat/${chatId}/messages`, { params });
    return res.data.data;
  },

  // Send a message via REST
  sendMessage: async (chatId, messageData) => {
    const res = await api.post(`/chat/${chatId}/messages`, messageData);
    return res.data.data.message;
  },

  // Upload an attachment (image, video, audio, document)
  uploadAttachment: async (chatId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(`/chat/${chatId}/attachment`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data;
  },

  // Edit a message
  editMessage: async (chatId, messageId, messageText) => {
    const res = await api.patch(`/chat/${chatId}/messages/${messageId}`, {
      message: messageText,
    });
    return res.data.data.message;
  },

  // Delete a message (for me or everyone)
  deleteMessage: async (chatId, messageId, deleteForEveryone = false) => {
    const res = await api.delete(`/chat/${chatId}/messages/${messageId}`, {
      data: { deleteForEveryone },
    });
    return res.data.data.message;
  },

  // Mark chat as read
  markRead: async (chatId) => {
    const res = await api.put(`/chat/${chatId}/read`);
    return res.data.data;
  },

  // Search inside chat messages
  searchMessages: async (chatId, query) => {
    const res = await api.get(`/chat/${chatId}/search`, { params: { query } });
    return res.data.data.messages || [];
  },

  // Get media attachments gallery
  getChatMedia: async (chatId, { mediaType = "all", limit = 30, cursor } = {}) => {
    const params = { mediaType, limit };
    if (cursor) params.cursor = cursor;
    const res = await api.get(`/chat/${chatId}/media`, { params });
    return res.data.data.media || [];
  },

  // Get total unread message count
  getTotalUnread: async () => {
    const res = await api.get("/chat/unread-total");
    return res.data.data.total || 0;
  },
};

export default chatApi;
