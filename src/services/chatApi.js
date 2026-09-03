import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || "/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const chatApi = {
                           
  listChats: async () => {
    const res = await api.get("/chat/list");
    return res.data.data.chats || [];
  },

                                
  startChat: async (targetId) => {
    const res = await api.post("/chat/start", { targetId });
    return res.data.data.chat;
  },

                                   
  getMessages: async (chatId, { cursor, limit = 30 } = {}) => {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    const res = await api.get(`/chat/${chatId}/messages`, { params });
    return res.data.data;
  },

                            
  sendMessage: async (chatId, messageData) => {
    const res = await api.post(`/chat/${chatId}/messages`, messageData);
    return res.data.data.message;
  },

                                                         
  uploadAttachment: async (chatId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(`/chat/${chatId}/attachment`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data;
  },

                   
  editMessage: async (chatId, messageId, messageText) => {
    const res = await api.patch(`/chat/${chatId}/messages/${messageId}`, {
      message: messageText,
    });
    return res.data.data.message;
  },

                                          
  deleteMessage: async (chatId, messageId, deleteForEveryone = false) => {
    const res = await api.delete(`/chat/${chatId}/messages/${messageId}`, {
      data: { deleteForEveryone },
    });
    return res.data.data.message;
  },

                      
  markRead: async (chatId) => {
    const res = await api.put(`/chat/${chatId}/read`);
    return res.data.data;
  },

                                
  searchMessages: async (chatId, query) => {
    const res = await api.get(`/chat/${chatId}/search`, { params: { query } });
    return res.data.data.messages || [];
  },

                                  
  getChatMedia: async (chatId, { mediaType = "all", limit = 30, cursor } = {}) => {
    const params = { mediaType, limit };
    if (cursor) params.cursor = cursor;
    const res = await api.get(`/chat/${chatId}/media`, { params });
    return res.data.data.media || [];
  },

                                   
  getTotalUnread: async () => {
    const res = await api.get("/chat/unread-total");
    return res.data.data.total || 0;
  },
};

export default chatApi;
