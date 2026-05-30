const { Server } = require("socket.io");
const { verifyAccessToken } = require("../utils/generateToken");
const User = require("../modules/user/user.model");
const { getClient } = require("../config/redis");

const chatHandlers = require("./chat.socket");
const callHandlers = require("./call.socket");

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => cb(null, true), // allow all (mobile no-origin) — auth middleware enforces
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // ─── Auth handshake ─────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
      if (!token) return next(new Error("Auth token required"));

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded._id).select(
        "name avatar role isBanned isActive",
      );
      if (!user) return next(new Error("User not found"));
      if (user.isBanned || !user.isActive) {
        return next(new Error("Account inactive"));
      }
      socket.userId = user._id.toString();
      socket.userName = user.name;
      socket.userAvatar = user.avatar;
      socket.userRole = user.role;
      next();
    } catch (err) {
      next(new Error("Auth failed: " + err.message));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`🔌 Socket connected: ${socket.userId}`);

    // Join personal room (for direct emits)
    socket.join(socket.userId);

    // Online status
    try {
      await getClient().set(`online:${socket.userId}`, "1", "EX", 60);
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        lastSeen: new Date(),
      });
      socket.broadcast.emit("online_status", {
        userId: socket.userId,
        isOnline: true,
      });
    } catch {}

    // Heartbeat to refresh online status
    socket.on("heartbeat", async () => {
      try {
        await getClient().set(`online:${socket.userId}`, "1", "EX", 60);
      } catch {}
    });

    chatHandlers(io, socket);
    callHandlers(io, socket);

    socket.on("disconnect", async () => {
      console.log(`🔌 Socket disconnected: ${socket.userId}`);
      try {
        await getClient().del(`online:${socket.userId}`);
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
        socket.broadcast.emit("online_status", {
          userId: socket.userId,
          isOnline: false,
        });
      } catch {}
    });
  });

  return io;
};

const getIO = () => io;

module.exports = { initSocket, getIO };
