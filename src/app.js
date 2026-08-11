const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");

const { globalLimiter } = require("./middlewares/rateLimit.middleware");
const { notFound, errorHandler } = require("./middlewares/error.middleware");
const apiRoutes = require("./routes");
const investmentController = require("./modules/investment/investment.controller");

const ApiError = require("./utils/ApiError");

const app = express();

// ─── Security ──────────────────────────────────
app.disable("x-powered-by");
app.set("trust proxy", 1); // for accurate IPs behind Railway/Vercel proxy
app.use(helmet());

// CORS
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://expglofrontend.netlify.app",
  "https://expglofunds.netlify.app",
  "https://expglobusiness.com",
  "https://www.expglobusiness.com",
  "https://expglofund.web.app",
  "https://expglofund.firebaseapp.com",
  // Railway (primary frontend)
  "https://fundfrontend-production.up.railway.app",
  // Vercel (old deployment — kept for backward compat)
  "https://fund-frontend-ctlw.vercel.app"
];

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Merge env origins with hardcoded defaults (so it works even without env var)
const allOrigins = [...new Set([...DEFAULT_ORIGINS, ...allowedOrigins])];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, server-to-server, curl)
      if (!origin) return cb(null, true);
      if (allOrigins.includes(origin)) return cb(null, true);
      // Allow any netlify.app deployment (previews, alternate frontend domains)
      if (/\.netlify\.app$/.test(origin)) return cb(null, true);
      // Allow any vercel.app deployment (previews, alternate frontend domains)
      if (/\.vercel\.app$/.test(origin)) return cb(null, true);
      // In dev, allow everything
      if (process.env.NODE_ENV !== "production") return cb(null, true);
      console.warn(`CORS blocked: ${origin}`);
      return cb(new ApiError(403, `CORS blocked: ${origin}`));
    },
    credentials: true,
    maxAge: 86400, // 24 hours preflight cache
  }),
);

// ─── Razorpay Webhook (raw body — must come BEFORE JSON parser) ──
app.post(
  "/api/v1/investment/webhook/razorpay",
  express.raw({ type: "application/json", limit: "1mb" }),
  investmentController.webhook,
);
// Legacy alias
app.post(
  "/api/investment/webhook/razorpay",
  express.raw({ type: "application/json", limit: "1mb" }),
  investmentController.webhook,
);

const path = require("path");
const fs = require("fs");
const UPLOADS_DIR = path.join(process.cwd(), "tmp", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ─── Body & Cookies ────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use("/uploads", express.static(UPLOADS_DIR));

// ─── Hardening ─────────────────────────────────
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());

// ─── Logging ───────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ─── Rate Limit ────────────────────────────────
app.use("/api", globalLimiter);

// ─── Health Check ──────────────────────────────
app.get("/api/health", async (req, res) => {
  const mongoose = require("mongoose");
  const { getClient } = require("./config/redis");
  let redisOk = false;
  try {
    const c = getClient();
    await c.set("health:probe", "1", "EX", 5);
    redisOk = (await c.get("health:probe")) === "1";
  } catch {}
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    services: {
      mongo: mongoose.connection.readyState === 1,
      redis: redisOk,
    },
  });
});

// ─── API Routes ────────────────────────────────
// Both /api and /api/v1 supported for forward compat
app.use("/api", apiRoutes);
app.use("/api/v1", apiRoutes);

// ─── Health check (silences Render/UptimeRobot 404 on root) ──
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", service: "EXPGLO FUND API" });
});

// ─── 404 + Error Handlers (must be last) ───────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
