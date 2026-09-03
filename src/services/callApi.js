import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || "/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const callApi = {
                                       
  initiateCall: async (receiverId, callType = "voice") => {
    const res = await api.post("/call/initiate", { receiverId, callType, type: callType });
    return res.data.data;
  },

                         
  acceptCall: async (callId) => {
    const res = await api.post(`/call/${callId}/accept`);
    return res.data.data;
  },

                          
  declineCall: async (callId) => {
    const res = await api.post(`/call/${callId}/decline`);
    return res.data.data;
  },

                    
  endCall: async (callId) => {
    const res = await api.post(`/call/${callId}/end`);
    return res.data.data;
  },

                                                 
  getCallHistory: async ({ filter = "all", query = "", cursor, limit = 30 } = {}) => {
    const params = { filter, query, limit };
    if (cursor) params.cursor = cursor;
    const res = await api.get("/call/history", { params });
    return res.data.data;
  },

                            
  getCallById: async (callId) => {
    const res = await api.get(`/call/${callId}`);
    return res.data.data.call;
  },

                                             
  getIceServers: async () => {
    const res = await api.get("/call/ice-servers");
    return res.data.data.iceServers || [];
  },
};

export default callApi;
