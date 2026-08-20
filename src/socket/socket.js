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

  socket.on("connect", () => {
    console.log("🔌 CALL SOCKET CONNECTED", { id: socket.id, serverUrl });
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 CALL SOCKET DISCONNECTED", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("CALL SOCKET ERROR", err.message || err);
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
