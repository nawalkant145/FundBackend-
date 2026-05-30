const crypto = require("crypto");
const Investment = require("./investment.model");
const Video = require("../video/video.model");
const User = require("../user/user.model");
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

const expressInterest = async (
  investorId,
  { videoId, founderId, amount, equity, terms },
) => {
  if (!videoId && !founderId) {
    throw new ApiError(400, "videoId or founderId required");
  }
  let video = null;
  let resolvedFounderId = founderId;
  if (videoId) {
    video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Pitch not found");
    resolvedFounderId = video.founderId;
  }
  const investor = await User.findById(investorId);
  const founder = await User.findById(resolvedFounderId);
  if (!founder) throw new ApiError(404, "Founder not found");
  if (investor.verificationLevel < 2) {
    throw new ApiError(403, "Verify your phone before expressing interest");
  }

  let inv = await Investment.findOne({
    founderId: resolvedFounderId,
    investorId,
    videoId: videoId || null,
  });
  let isNew = false;
  if (inv) {
    if (amount !== undefined) inv.amount = amount;
    if (equity !== undefined) inv.equity = equity;
    if (terms !== undefined) inv.terms = terms;
    await inv.save();
  } else {
    isNew = true;
    inv = await Investment.create({
      founderId: resolvedFounderId,
      investorId,
      videoId: videoId || undefined,
      amount: amount || 0,
      equity: equity || 0,
      terms: terms || "",
      stage: "interested",
      status: "pending",
    });
  }

  if (isNew) {
    try {
      const notif = require("../notification/notification.service");
      notif
        .send(resolvedFounderId, {
          type: "investment",
          title: `${investor.name} expressed investment interest`,
          body: amount
            ? `Proposed amount: ₹${Number(amount).toLocaleString("en-IN")}`
            : "Tap to discuss",
          data: {
            investmentId: inv._id.toString(),
            investorId: investorId.toString(),
            videoId: (videoId || "").toString(),
          },
        })
        .catch(() => {});
    } catch {}
  }
  return inv;
};

const updateStage = async (investmentId, userId, stage) => {
  if (!["interested", "negotiating", "agreed", "completed"].includes(stage)) {
    throw new ApiError(400, "Invalid stage");
  }
  const inv = await Investment.findById(investmentId);
  if (!inv) throw new ApiError(404, "Investment not found");
  const isParticipant =
    inv.founderId.toString() === userId.toString() ||
    inv.investorId.toString() === userId.toString();
  if (!isParticipant) throw new ApiError(403, "Not a participant");
  const oldStage = inv.stage;
  inv.stage = stage;
  await inv.save();

  // Notify the other party
  if (oldStage !== stage) {
    try {
      const notif = require("../notification/notification.service");
      const otherId =
        inv.founderId.toString() === userId.toString()
          ? inv.investorId
          : inv.founderId;
      notif
        .send(otherId, {
          type: "investment",
          title: `Deal stage updated: ${stage}`,
          body: `Investment moved from ${oldStage} to ${stage}`,
          data: { investmentId: inv._id.toString(), stage },
        })
        .catch(() => {});
    } catch {}
  }
  return inv;
};

const createPaymentOrder = async (investmentId, userId) => {
  const inv = await Investment.findById(investmentId);
  if (!inv) throw new ApiError(404, "Investment not found");
  if (inv.investorId.toString() !== userId.toString()) {
    throw new ApiError(403, "Only investor can pay");
  }
  if (inv.stage !== "agreed") {
    throw new ApiError(400, "Both parties must agree before payment");
  }
  if (inv.status === "paid") {
    throw new ApiError(400, "Already paid");
  }
  if (!inv.amount || inv.amount <= 0) {
    throw new ApiError(400, "Investment amount must be set");
  }

  const investor = await User.findById(userId);
  const founder = await User.findById(inv.founderId);
  if (investor.verificationLevel < 3 || founder.verificationLevel < 3) {
    throw new ApiError(403, "Both parties must be fully verified (Level 3)");
  }

  const razorpay = getRazorpay();
  if (!razorpay) throw new ApiError(500, "Payment gateway not configured");

  const order = await razorpay.orders.create({
    amount: Math.round(inv.amount * 100), // INR → paise
    currency: "INR",
    receipt: `inv_${inv._id}`,
    notes: {
      investmentId: inv._id.toString(),
      founderId: inv.founderId.toString(),
      investorId: userId.toString(),
    },
  });

  inv.razorpayOrderId = order.id;
  await inv.save();
  return {
    investment: inv,
    order,
    keyId: process.env.RAZORPAY_KEY_ID,
  };
};

// Idempotent — re-runs safely return the already-paid record
const verifyPayment = async ({
  investmentId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const inv = await Investment.findById(investmentId);
  if (!inv) throw new ApiError(404, "Investment not found");

  // Idempotency: already verified — return as-is
  if (inv.status === "paid" && inv.razorpayPaymentId === razorpayPaymentId) {
    return inv;
  }

  if (inv.razorpayOrderId !== razorpayOrderId) {
    throw new ApiError(400, "Order ID mismatch");
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expected !== razorpaySignature) {
    inv.status = "failed";
    await inv.save();
    throw new ApiError(400, "Invalid payment signature");
  }

  // Atomic transition — only update if not already paid
  const updated = await Investment.findOneAndUpdate(
    { _id: inv._id, status: { $ne: "paid" } },
    {
      razorpayPaymentId,
      razorpaySignature,
      status: "paid",
      stage: "completed",
      paidAt: new Date(),
    },
    { new: true },
  );
  // Already paid by a concurrent webhook
  if (!updated) return inv;

  // Bump aggregates exactly once
  await User.findByIdAndUpdate(inv.investorId, {
    $inc: { totalInvested: inv.amount },
  });

  // Notify both
  try {
    const notif = require("../notification/notification.service");
    const investor = await User.findById(inv.investorId).select("name");
    const founder = await User.findById(inv.founderId).select("name");
    notif
      .send(inv.investorId, {
        type: "investment",
        title: "Payment successful",
        body: `Investment of ₹${inv.amount.toLocaleString("en-IN")} to ${
          founder?.name || "founder"
        } completed`,
        data: { investmentId: inv._id.toString() },
      })
      .catch(() => {});
    notif
      .send(inv.founderId, {
        type: "investment",
        title: "You received an investment",
        body: `${investor?.name || "An investor"} invested ₹${inv.amount.toLocaleString(
          "en-IN",
        )}`,
        data: { investmentId: inv._id.toString() },
      })
      .catch(() => {});
  } catch {}

  return updated;
};

// Razorpay webhook — server-to-server confirmation
// Configure in Razorpay dashboard: Settings → Webhooks
const handleWebhook = async (rawBody, signatureHeader) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new ApiError(500, "Razorpay webhook secret not configured");
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  if (expected !== signatureHeader) {
    throw new ApiError(400, "Invalid webhook signature");
  }

  const payload = JSON.parse(rawBody.toString());
  const event = payload.event;

  if (event === "payment.captured" || event === "order.paid") {
    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;
    if (!payment) return { ok: true, ignored: true };

    const orderId = payment.order_id;
    const paymentId = payment.id;
    const inv = await Investment.findOne({ razorpayOrderId: orderId });
    if (!inv) return { ok: true, missing: true };

    if (inv.status !== "paid") {
      const updated = await Investment.findOneAndUpdate(
        { _id: inv._id, status: { $ne: "paid" } },
        {
          razorpayPaymentId: paymentId,
          status: "paid",
          stage: "completed",
          paidAt: new Date(),
        },
        { new: true },
      );
      if (updated) {
        await User.findByIdAndUpdate(inv.investorId, {
          $inc: { totalInvested: inv.amount },
        });
      }
    }
  }

  if (event === "payment.failed") {
    const payment = payload.payload?.payment?.entity;
    if (payment?.order_id) {
      await Investment.updateOne(
        { razorpayOrderId: payment.order_id, status: { $ne: "paid" } },
        { status: "failed" },
      );
    }
  }

  return { ok: true, event };
};

const myDeals = async (userId) => {
  return Investment.find({
    $or: [{ founderId: userId }, { investorId: userId }],
  })
    .sort({ updatedAt: -1 })
    .populate("founderId", "name avatar companyName")
    .populate("investorId", "name avatar")
    .populate("videoId", "title thumbnailUrl");
};

const getById = async (id, userId) => {
  const inv = await Investment.findById(id)
    .populate("founderId", "name avatar companyName")
    .populate("investorId", "name avatar")
    .populate("videoId", "title thumbnailUrl");
  if (!inv) throw new ApiError(404, "Investment not found");
  const isParticipant =
    inv.founderId._id.toString() === userId.toString() ||
    inv.investorId._id.toString() === userId.toString();
  if (!isParticipant) throw new ApiError(403, "Not a participant");
  return inv;
};

module.exports = {
  expressInterest,
  updateStage,
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  myDeals,
  getById,
};
