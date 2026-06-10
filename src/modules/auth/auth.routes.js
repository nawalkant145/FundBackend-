const express = require("express");
const router = express.Router();
const c = require("./auth.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authLimiter } = require("../../middlewares/rateLimit.middleware");

router.post("/register", authLimiter, c.register);
router.post("/login", authLimiter, c.login);
router.post("/refresh-token", c.refresh);
router.post("/forgot-password", authLimiter, c.forgotPassword);
router.post("/reset-password", authLimiter, c.resetPassword);

// Pre-register email verification (no auth needed)
router.post("/send-pre-register-otp", authLimiter, c.sendPreRegisterOtp);
router.post("/verify-pre-register-otp", authLimiter, c.verifyPreRegisterOtp);

router.post("/logout", authenticate, c.logout);
router.get("/me", authenticate, c.getMe);

router.post("/send-email-otp", authenticate, authLimiter, c.sendEmailOtp);
router.post("/verify-email-otp", authenticate, c.verifyEmailOtp);
router.post("/send-phone-otp", authenticate, authLimiter, c.sendPhoneOtp);
router.post("/verify-phone-otp", authenticate, c.verifyPhoneOtp);
router.post("/change-password", authenticate, c.changePassword);

module.exports = router;
