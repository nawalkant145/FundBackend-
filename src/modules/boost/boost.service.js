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

  const now = new Date();

  // Fast-path check: Video document says it is currently boosted.
  if (video.isBoosted && video.boostedUntil && video.boostedUntil > now) {
    throw new ApiError(400, "This pitch is already boosted");
  }

  // GAP 5 — Authoritative check via Boost collection.
  // Protects against Video/Boost record desync (e.g. an admin manually
  // set isBoosted=false on the Video without expiring the Boost record,
  // or vice-versa). The Boost collection is the source of truth.
  const existingActiveBoost = await Boost.findOne({
    videoId,
    founderId,
    status: "active",
    expiresAt: { $gt: now },
  });
  if (existingActiveBoost) {
    throw new ApiError(400, "This pitch is already boosted");
  }

  const boost = await Boost.create({
    founderId,
    videoId,
    tier: tierDef.id,
    amount: tierDef.price,
    durationHours: tierDef.durationHours,
    status: "pending",
    // shownTo[] starts empty — each boost purchase gets a fresh promotion
    // cycle; investors who saw a previous boost will see this one again.
  });

  const razorpay = getRazorpay();

  if (!razorpay) {
    // Production safety: never allow a boost to be created/activated for free in production.
    if (process.env.NODE_ENV === "production") {
      await Boost.findByIdAndDelete(boost._id);
      throw new ApiError(
        503,
        "Payment gateway unavailable. Please configure Razorpay credentials.",
      );
    }

    // Development fallback when Razorpay keys are not set in .env:
    // Create a dev order structure so the frontend opens Razorpay Checkout / payment window.
    // Boost stays in "pending" status until verifyPayment is called.
    const devOrder = {
      id: `order_dev_${boost._id}`,
      amount: Math.round(tierDef.price * 100), // INR → paise
      currency: "INR",
      receipt: `boost_${boost._id}`,
    };

    boost.razorpayOrderId = devOrder.id;
    await boost.save();

    return {
      boost,
      order: devOrder,
      keyId: "rzp_test_dev_key",
    };
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
  if (boost.razorpayOrderId && boost.razorpayOrderId !== razorpayOrderId) {
    throw new ApiError(400, "Order ID mismatch");
  }

  if (process.env.RAZORPAY_KEY_SECRET) {
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expected !== razorpaySignature) {
      boost.status = "failed";
      await boost.save();
      throw new ApiError(400, "Invalid payment signature");
    }
  } else if (process.env.NODE_ENV === "production") {
    throw new ApiError(
      503,
      "Payment gateway secret not configured in production.",
    );
  }

  boost.razorpayPaymentId = razorpayPaymentId || `pay_dev_${Date.now()}`;
  boost.razorpaySignature = razorpaySignature || "dev_signature";
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

// ─────────────────────────────────────────────────────────────────
// GAP 1 — recordShownTo
// ─────────────────────────────────────────────────────────────────
// Atomically appends investorId to Boost.shownTo[] using $addToSet.
// $addToSet guarantees idempotency — the same investor cannot be
// inserted twice even under concurrent feed loads.
//
// Called by video.service.js:getFeed() after an eligible boosted pitch
// has been prepended to the investor's feed response.
// Fire-and-forget: the feed response is NOT blocked on this write.
const recordShownTo = async (boostId, investorId) => {
  await Boost.findByIdAndUpdate(boostId, {
    $addToSet: { shownTo: investorId },
  });
};

// ─────────────────────────────────────────────────────────────────
// GAP 6 — getActiveBoostedForFeed
// ─────────────────────────────────────────────────────────────────
// Returns active boosts that this investor has NOT yet seen (i.e. their
// investorId is not in shownTo[]). Boost-specific filters only — feed
// eligibility rules (blocked, not-interested, visibility, pitch status)
// are applied in video.service.js:getFeed where buildFeedQuery is
// centralised.
//
// Returns: [{ boostId, videoId }]
const getActiveBoostedForFeed = async (investorId) => {
  const now = new Date();
  const boosts = await Boost.find({
    status: "active",
    expiresAt: { $gt: now },
    shownTo: { $ne: investorId },
  })
    .select("_id videoId")
    .lean();

  return boosts.map((b) => ({
    boostId: b._id,
    videoId: b.videoId,
  }));
};

// ─────────────────────────────────────────────────────────────────
// GAP 7 — Development / Staging Diagnostics
// ─────────────────────────────────────────────────────────────────
// Returns a detailed diagnostic breakdown of:
//   1. eligiblePitches (passes feed rules)
//   2. activeBoostedPitches (active, not expired)
//   3. boostedAfterShownToFilter (active, not expired, not seen by investor)
//   4. finalFeed (resulting feed array)
//   5. effectiveIsBoostedState & shownToState
//
// Strictly disabled in production (throws 403 ApiError).
const getDiagnostics = async (investorId) => {
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(403, "Diagnostics endpoint is disabled in production");
  }

  const now = new Date();
  const investor = await User.findById(investorId).select("name role preferredIndustries").lean();
  if (!investor) throw new ApiError(404, "Investor user not found");

  const { preferredIndustries = [], ...baseQuery } = await videoService.buildFeedQuery(investorId);
  const eligiblePitches = await Video.find(baseQuery).select("_id title isBoosted boostedUntil industry founderId").lean();

  const activeBoosts = await Boost.find({
    status: "active",
    expiresAt: { $gt: now },
  }).populate("videoId", "title isBoosted boostedUntil").lean();

  const boostedAfterShownToFilter = activeBoosts.filter(
    (b) => !b.shownTo || !b.shownTo.some((id) => id.toString() === investorId.toString())
  );

  const finalFeedResult = await videoService.getFeed(investorId, { limit: 10 });
  const finalFeed = (finalFeedResult.videos || []).map((v) => ({
    _id: v._id,
    title: v.title,
    isBoosted: v.isBoosted,
    boostedUntil: v.boostedUntil,
    effectiveIsBoosted: Boolean(v.isBoosted && v.boostedUntil && new Date(v.boostedUntil) > now),
  }));

  const shownToState = activeBoosts.map((b) => ({
    boostId: b._id,
    videoId: b.videoId?._id || b.videoId,
    pitchTitle: b.videoId?.title || "",
    shownToCount: (b.shownTo || []).length,
    hasBeenShownToThisInvestor: Boolean(
      b.shownTo && b.shownTo.some((id) => id.toString() === investorId.toString())
    ),
  }));

  return {
    investor: {
      id: investor._id,
      name: investor.name,
      role: investor.role,
    },
    eligiblePitchesCount: eligiblePitches.length,
    eligiblePitches: eligiblePitches.map((p) => ({ _id: p._id, title: p.title })),
    activeBoostedPitchesCount: activeBoosts.length,
    activeBoostedPitches: activeBoosts.map((b) => ({
      boostId: b._id,
      videoId: b.videoId?._id || b.videoId,
      title: b.videoId?.title,
      expiresAt: b.expiresAt,
    })),
    boostedAfterShownToFilterCount: boostedAfterShownToFilter.length,
    boostedAfterShownToFilter: boostedAfterShownToFilter.map((b) => ({
      boostId: b._id,
      videoId: b.videoId?._id || b.videoId,
      title: b.videoId?.title,
    })),
    finalFeed,
    shownToState,
  };
};

module.exports = {
  createOrder,
  verifyPayment,
  getMyBoosts,
  getActiveBoosts,
  // GAP 1 / GAP 6 — new helpers consumed by video.service.js:getFeed
  recordShownTo,
  getActiveBoostedForFeed,
  // GAP 7 — dev/staging diagnostics
  getDiagnostics,
  // Exported so video.service.js can trigger background cleanup from getFeed
  expireStale,
};

