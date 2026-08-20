const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const paymentService = require("./payment.service");

const createCourseOrder = asyncHandler(async (req, res) => {
  const result = await paymentService.createCourseOrder(req.user, req.body.courseId);
  res.status(201).json(new ApiResponse(201, result, "Razorpay payment order created successfully"));
});

const guestCreateCourseOrder = asyncHandler(async (req, res) => {
  const result = await paymentService.guestCreateCourseOrder(req.body.courseId);
  res.status(201).json(new ApiResponse(201, result, "Guest Razorpay payment order created successfully"));
});

const verifyPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.verifyAndFulfill(req.user || null, req.body);
  res.json(new ApiResponse(200, result, "Razorpay payment verified and enrollment processed successfully"));
});

const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const result = await paymentService.handleWebhook(req.body, signature);
  res.json({ ok: true, ...result });
});

const claimPurchase = asyncHandler(async (req, res) => {
  const enrollment = await paymentService.claimPurchase(req.user, req.body.claimToken);
  res.json(new ApiResponse(200, { enrollment }, "Pending purchase successfully claimed and enrolled"));
});

module.exports = {
  createCourseOrder,
  guestCreateCourseOrder,
  verifyPayment,
  razorpayWebhook,
  claimPurchase,
};
