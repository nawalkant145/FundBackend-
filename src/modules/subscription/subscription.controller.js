const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const subscriptionService = require("./subscription.service");

const mine = asyncHandler(async (req, res) => {
  const result = await subscriptionService.getMine(req.user._id);
  res.json(new ApiResponse(200, result, "Subscription"));
});

const createOrder = asyncHandler(async (req, res) => {
  const result = await subscriptionService.createOrder(req.user._id);
  res.status(201).json(new ApiResponse(201, result, "Subscription order"));
});

const verifyPayment = asyncHandler(async (req, res) => {
  const sub = await subscriptionService.verifyPayment({
    subscriptionId: req.params.id,
    razorpayOrderId: req.body.razorpay_order_id,
    razorpayPaymentId: req.body.razorpay_payment_id,
    razorpaySignature: req.body.razorpay_signature,
  });
  res.json(new ApiResponse(200, { subscription: sub }, "Pro activated"));
});

const cancel = asyncHandler(async (req, res) => {
  const subscription = await subscriptionService.cancel(req.user._id);
  res.json(new ApiResponse(200, { subscription }, "Subscription cancelled"));
});

module.exports = { mine, createOrder, verifyPayment, cancel };
