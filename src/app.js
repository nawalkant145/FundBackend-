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
const paymentController = require("./modules/payment/payment.controller");

const ApiError = require("./utils/ApiError");

const app = express();

                                                  
app.disable("x-powered-by");
app.set("trust proxy", 1);                                                
app.use(helmet());

       
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://expglofrontend.netlify.app",
  "https://expglofunds.netlify.app",
  "https://expglobusiness.com",
  "https://www.expglobusiness.com",
  "https://expglofund.web.app",
  "https://expglofund.firebaseapp.com",
                               
  "https://fundfrontend-production.up.railway.app",
                                                       
  "https://fund-frontend-ctlw.vercel.app"
];

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

                                                                               
const allOrigins = [...new Set([...DEFAULT_ORIGINS, ...allowedOrigins])];

app.use(
  cors({
    origin: (origin, cb) => {
                                                                            
      if (!origin) return cb(null, true);
      if (allOrigins.includes(origin)) return cb(null, true);
                                                                                
      if (/\.netlify\.app$/.test(origin)) return cb(null, true);
                                                                               
      if (/\.vercel\.app$/.test(origin)) return cb(null, true);
                                 
      if (process.env.NODE_ENV !== "production") return cb(null, true);
      console.warn(`CORS blocked: ${origin}`);
      return cb(new ApiError(403, `CORS blocked: ${origin}`));
    },
    credentials: true,
    maxAge: 86400,                            
  }),
);

                                  
app.post(
  "/api/v1/payment/webhook/razorpay",
  express.raw({ type: "application/json", limit: "1mb" }),
  paymentController.razorpayWebhook,
);
app.post(
  "/api/payment/webhook/razorpay",
  express.raw({ type: "application/json", limit: "1mb" }),
  paymentController.razorpayWebhook,
);

const path = require("path");
const fs = require("fs");
const UPLOADS_DIR = path.join(process.cwd(), "tmp", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

                                                  
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use("/uploads", express.static(UPLOADS_DIR));

                                                  
app.use(mongoSanitize());
app.use(hpp());
app.use(compression());

                                                  
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

                                                  
app.use("/api", globalLimiter);

                                                  
app.get("/api/health", async (req, res) => {
  const mongoose = require("mongoose");
  const { getClient } = require("./config/redis");
  const { getStorageStatus } = require("./config/aws");
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
      awsStorage: getStorageStatus(),
    },
  });
});

                                                  
                                                     
app.use("/api", apiRoutes);
app.use("/api/v1", apiRoutes);

                                                                
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", service: "EXPGLO FUND API" });
});

                                                  
app.use(notFound);
app.use(errorHandler);

module.exports = app;
