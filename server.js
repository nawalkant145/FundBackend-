require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const connectDB = require("./src/config/db");
const { initRedis } = require("./src/config/redis");
const { initFirebase } = require("./src/config/firebase");
const { initSocket } = require("./src/socket");
const { startCronJobs } = require("./src/cron");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  initRedis();
  initFirebase();

  const server = http.createServer(app);
  initSocket(server);
  startCronJobs();

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down...`);
    server.close(() => {
      console.log("✅ HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (err) => {
    console.error("❌ Unhandled Rejection:", err);
  });
  process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    process.exit(1);
  });
};

startServer();
