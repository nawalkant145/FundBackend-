const crypto = require("crypto");
const Boost = require("./boost.model");
const Video = require("../video/video.model");
const { BOOST_TIERS } = require("./boost.constants");
const videoService = require("../video/video.service");
const ApiError = require("../../utils/ApiError");

let razorpayClient = null;
const getRazorpay = () => {
  if (razorpayClient) return razorpayClient;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  const Razorpay = require("razorpay");
  razorpayClient = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return razorpayClient;
};

// Apply an active boost to the underlying video and persist boost record.
const activateBoost = async (boost) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + boost.durationHours * 3600 * 1000);
  boost.status = "active";
  boost.startedAt = now;
  boost.expiresAt = expiresAt;
  await boost.save();

  await Video.findByIdAndUpdate(boost.videoId, {
    isBoosted: true,
    boostedUntil: expiresAt,
  });

  // Refresh feed caches so the boosted pitch jumps to the top
  await videoService.invalidateFeedCache().catch(() => {});
  return boost;
};

// Create a Razorpay order for a boost. In non-production environments without
// Razorpay keys configured, the boost is activated immediately (dev fallback)
// so the flow is testable end-to-end.
const createOrder = async (founderId, { videoId, tier }) => {
  const tierDef = BOOST_TIERS[tier];
  if (!tierDef) throw new ApiError(400, "Invalid boost tier");

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Pitch not found");
  if (video.founderId.toString() !== founderId.toString()) {
    throw new ApiError(403, "You can only boost your own pitch");
  }
  if (video.status !== "active") {
    throw new ApiError(400, "Only active pitches can be boosted");
  }

  // Already boosted and not expired?
  if (
    video.isBoosted &&
    video.boostedUntil &&
    video.boostedUntil > new Date()
  ) {
    throw new ApiError(400, "This pitch is already boosted");
  }

  const boost = await Boost.create({
    founderId,
    videoId,
    tier: tierDef.id,
    amount: tierDef.price,
    durationHours: tierDef.durationHours,
    status: "pending",
  });

  const razorpay = getRazorpay();

  if (!razorpay) {
    throw new ApiError(
      500,
      "Payment gateway not configured. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }

  const order = await razorpay.orders.create({
    amount: Math.round(tierDef.price * 100), // INR → paise
    currency: "INR",
    receipt: `boost_${boost._id}`,
    notes: {
      boostId: boost._id.toString(),
      videoId: videoId.toString(),
      founderId: founderId.toString(),
      tier: tierDef.id,
    },
  });

  boost.razorpayOrderId = order.id;
  await boost.save();

  return {
    boost,
    order,
    keyId: process.env.RAZORPAY_KEY_ID,
    activated: false,
  };
};

// Idempotent — verifying an already-active boost returns it unchanged.
const verifyPayment = async ({
  boostId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const boost = await Boost.findById(boostId);
  if (!boost) throw new ApiError(404, "Boost not found");

  if (
    boost.status === "active" &&
    boost.razorpayPaymentId === razorpayPaymentId
  ) {
    return boost;
  }
  if (boost.razorpayOrderId !== razorpayOrderId) {
    throw new ApiError(400, "Order ID mismatch");
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expected !== razorpaySignature) {
    boost.status = "failed";
    await boost.save();
    throw new ApiError(400, "Invalid payment signature");
  }

  boost.razorpayPaymentId = razorpayPaymentId;
  boost.razorpaySignature = razorpaySignature;
  await activateBoost(boost);
  return boost;
};

// All boosts belonging to a founder (active first, newest first).
const getMyBoosts = async (founderId) => {
  await expireStale(founderId);
  return Boost.find({ founderId })
    .sort({ status: 1, createdAt: -1 })
    .populate("videoId", "title thumbnailUrl status")
    .lean();
};

// Currently-active boosts (used to render badges in the feed/studio).
const getActiveBoosts = async (founderId) => {
  await expireStale(founderId);
  const q = { status: "active", expiresAt: { $gt: new Date() } };
  if (founderId) q.founderId = founderId;
  return Boost.find(q).lean();
};

// Lazily flip expired boosts → "expired" and clear the video flag.
const expireStale = async (founderId) => {
  const now = new Date();
  const q = { status: "active", expiresAt: { $lte: now } };
  if (founderId) q.founderId = founderId;
  const stale = await Boost.find(q);
  for (const b of stale) {
    b.status = "expired";
    await b.save();
    await Video.findByIdAndUpdate(b.videoId, {
      isBoosted: false,
      $unset: { boostedUntil: 1 },
    });
  }
  if (stale.length) await videoService.invalidateFeedCache().catch(() => {});
};

module.exports = {
  createOrder,
  verifyPayment,
  getMyBoosts,
  getActiveBoosts,
};
