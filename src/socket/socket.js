import { io } from "socket.io-client";

let socket = null;

export const initSocket = (token) => {
  if (socket) return socket;

  const serverUrl =
    process.env.REACT_APP_SOCKET_URL ||
    process.env.VITE_SOCKET_URL ||
    window.location.origin;

  socket = io(serverUrl, {
    auth: { token },
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
