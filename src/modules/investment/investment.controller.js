const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const investmentService = require("./investment.service");

const expressInterest = asyncHandler(async (req, res) => {
  const inv = await investmentService.expressInterest(req.user._id, req.body);
  res
    .status(201)
    .json(new ApiResponse(201, { investment: inv }, "Interest recorded"));
});

const updateStage = asyncHandler(async (req, res) => {
  const inv = await investmentService.updateStage(
    req.params.id,
    req.user._id,
    req.body.stage,
  );
  res.json(new ApiResponse(200, { investment: inv }, "Stage updated"));
});

const createOrder = asyncHandler(async (req, res) => {
  const result = await investmentService.createPaymentOrder(
    req.params.id,
    req.user._id,
  );
  res.status(201).json(new ApiResponse(201, result, "Payment order created"));
});

const verifyPayment = asyncHandler(async (req, res) => {
  const inv = await investmentService.verifyPayment({
    investmentId: req.params.id,
    razorpayOrderId: req.body.razorpay_order_id,
    razorpayPaymentId: req.body.razorpay_payment_id,
    razorpaySignature: req.body.razorpay_signature,
  });
  res.json(new ApiResponse(200, { investment: inv }, "Payment verified"));
});

// Razorpay webhook — uses raw body, no auth
const webhook = asyncHandler(async (req, res) => {
  const sig = req.headers["x-razorpay-signature"];
  const result = await investmentService.handleWebhook(req.body, sig);
  res.json({ ok: true, ...result });
});

const myDeals = asyncHandler(async (req, res) => {
  const deals = await investmentService.myDeals(req.user._id);
  res.json(new ApiResponse(200, { deals }, "My deals"));
});

const getOne = asyncHandler(async (req, res) => {
  const inv = await investmentService.getById(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { investment: inv }, "Investment"));
});

module.exports = {
  expressInterest,
  updateStage,
  createOrder,
  verifyPayment,
  webhook,
  myDeals,
  getOne,
};
