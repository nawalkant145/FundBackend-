const rateLimit = require("express-rate-limit");

// Global limiter — generous ceiling for an interactive SPA (feeds, comments,
// availability checks, etc. all hit /api). Still protects against abuse.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// Auth limiter for login/register — only failed attempts count, so a user
// who logs in / registers successfully isn't penalised.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many auth attempts. Please try again in 15 minutes.",
  },
});

// OTP SEND limiter — sends trigger an email/SMS, so keep these protected.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many OTP requests. Please wait a few minutes before requesting another code.",
  },
});

// OTP VERIFY limiter — verifying is cheap (no email/SMS), so be lenient and
// only count failed attempts. This stops a few mistyped codes from locking a
// user out while still blocking brute-force guessing.
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many incorrect codes. Please wait a few minutes.",
  },
});

module.exports = { globalLimiter, authLimiter, otpLimiter, otpVerifyLimiter };
