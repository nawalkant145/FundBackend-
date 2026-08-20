const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const boostService = require("./boost.service");
const { BOOST_TIERS } = require("./boost.constants");

const tiers = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(200, { tiers: Object.values(BOOST_TIERS) }, "Tiers"),
  );
});

const createOrder = asyncHandler(async (req, res) => {
  const result = await boostService.createOrder(req.user._id, {
    videoId: req.body.videoId,
    tier: req.body.tier,
  });
  res.status(201).json(new ApiResponse(201, result, "Boost order created"));
});

const verifyPayment = asyncHandler(async (req, res) => {
  const boost = await boostService.verifyPayment({
    boostId: req.params.id,
    razorpayOrderId: req.body.razorpay_order_id,
    razorpayPaymentId: req.body.razorpay_payment_id,
    razorpaySignature: req.body.razorpay_signature,
  });
  res.json(new ApiResponse(200, { boost }, "Boost activated"));
});

const myBoosts = asyncHandler(async (req, res) => {
  const boosts = await boostService.getMyBoosts(req.user._id);
  res.json(new ApiResponse(200, { boosts }, "My boosts"));
});

const activeBoosts = asyncHandler(async (req, res) => {
  const boosts = await boostService.getActiveBoosts(req.user._id);
  res.json(new ApiResponse(200, { boosts }, "Active boosts"));
});

const diagnostics = asyncHandler(async (req, res) => {
  const data = await boostService.getDiagnostics(req.params.investorId);
  res.json(new ApiResponse(200, data, "Boost diagnostics"));
});

module.exports = {
  tiers,
  createOrder,
  verifyPayment,
  myBoosts,
  activeBoosts,
  diagnostics,
};
