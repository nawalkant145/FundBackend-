const express = require("express");
const router = express.Router();
const c = require("./auth.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const {
  authLimiter,
  otpLimiter,
  otpVerifyLimiter,
} = require("../../middlewares/rateLimit.middleware");

router.post("/signup/initiate", authLimiter, c.initiateSignup);
router.post("/signup/skip", authLimiter, c.skipSignup);
router.post("/register", authLimiter, c.register);




router.post("/login", authLimiter, c.login);
router.get("/check-availability", c.checkAvailability);
router.post("/refresh-token", c.refresh);
router.post("/forgot-password", authLimiter, c.forgotPassword);
router.post("/reset-password", authLimiter, c.resetPassword);

                                                   
router.post("/send-pre-register-otp", otpLimiter, c.sendPreRegisterOtp);
router.post(
  "/verify-pre-register-otp",
  otpVerifyLimiter,
  c.verifyPreRegisterOtp,
);

router.post("/logout", authenticate, c.logout);
router.get("/me", authenticate, c.getMe);

router.post("/send-email-otp", authenticate, otpLimiter, c.sendEmailOtp);
router.post(
  "/verify-email-otp",
  authenticate,
  otpVerifyLimiter,
  c.verifyEmailOtp,
);
router.post("/send-phone-otp", authenticate, otpLimiter, c.sendPhoneOtp);
router.post(
  "/verify-phone-otp",
  authenticate,
  otpVerifyLimiter,
  c.verifyPhoneOtp,
);
router.post("/change-password", authenticate, c.changePassword);

module.exports = router;
