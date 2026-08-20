const express = require("express");
const router = express.Router();
const paymentController = require("./payment.controller");
const { authenticate, optionalAuthenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

// Authenticated Founder & Investor Razorpay order creation
router.post(
  "/create-order",
  authenticate,
  authorize("founder", "investor"),
  paymentController.createCourseOrder
);

// Unauthenticated Guest Razorpay order creation
router.post(
  "/guest/create-order",
  paymentController.guestCreateCourseOrder
);

// Razorpay checkout payment verification (supports both logged-in and guest payments)
router.post(
  "/verify",
  optionalAuthenticate,
  paymentController.verifyPayment
);

// Public Razorpay Webhook endpoint (Raw body handled in app.js)
router.post(
  "/webhook/razorpay",
  paymentController.razorpayWebhook
);

module.exports = router;
