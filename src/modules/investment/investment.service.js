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
  const isPhoneVerified = (u) => !!(u?.phoneVerified || u?.isPhoneVerified || (u?.verificationLevel || 0) >= 1);
  if (!isPhoneVerified(investor)) {
    throw new ApiError(403, "Verify your phone before expressing interest");
  }

  // 1. Check if an Investment document already exists for (founderId, investorId, videoId)
  let inv = await Investment.findOne({
    founderId: resolvedFounderId,
    investorId,
    videoId: videoId || null,
  });

  if (inv) {
    // If the existing deal is ALREADY paid & completed:
    if (inv.status === "paid" || inv.stage === "completed") {
      throw new ApiError(409, "You have already invested in this startup.", {
        investmentId: inv._id.toString(),
        alreadyPaid: true,
      });
    }

    // If deal is pending / interested / negotiating / agreed: update terms
    if (amount !== undefined) inv.amount = amount;
    if (equity !== undefined) inv.equity = equity;
    if (terms !== undefined) inv.terms = terms;
    await inv.save();
  } else {
    // Create new Investment
    try {
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
    } catch (err) {
      if (err.code === 11000 || err.name === "MongoServerError") {
        inv = await Investment.findOne({
          founderId: resolvedFounderId,
          investorId,
          videoId: videoId || null,
        });
        if (inv?.status === "paid") {
          throw new ApiError(409, "You have already invested in this startup.", {
            investmentId: inv._id.toString(),
            alreadyPaid: true,
          });
        }
        if (inv) {
          if (amount !== undefined) inv.amount = amount;
          if (equity !== undefined) inv.equity = equity;
          if (terms !== undefined) inv.terms = terms;
          await inv.save();
        } else {
          throw new ApiError(409, "An investment already exists for this startup.");
        }
      } else {
        throw err;
      }
    }
  }

  console.log("[EXPRESS_INTEREST_RUNTIME]", {
    investmentId: inv._id.toString(),
    founderId: resolvedFounderId.toString(),
    investorId: investorId.toString(),
    videoId: (videoId || "").toString(),
    status: inv.status,
    stage: inv.stage,
    amount: inv.amount,
    equity: inv.equity,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  });

  const freshInv = await Investment.findById(inv._id);
  console.log("[INVESTMENT_DB_RUNTIME]", {
    _id: freshInv?._id?.toString(),
    founderId: freshInv?.founderId?.toString(),
    investorId: freshInv?.investorId?.toString(),
    videoId: freshInv?.videoId?.toString(),
    status: freshInv?.status,
    stage: freshInv?.stage,
    amount: freshInv?.amount,
    equity: freshInv?.equity,
  });

  // Ensure Founder Interest Notification is sent idempotently
  try {
    const Notification = require("../notification/notification.model");
    const notif = require("../notification/notification.service");

    const existingNotif = await Notification.findOne({
      userId: resolvedFounderId,
      type: "investment",
      "data.investmentId": inv._id.toString(),
      "data.status": "interested",
    });

    let notifDoc = existingNotif;

    if (!existingNotif) {
      notifDoc = await notif.send(resolvedFounderId, {
        type: "investment",
        title: "New Investment Interest",
        body: `${investor.name || "An investor"} is interested in investing ₹${Number(
          inv.amount || 0,
        ).toLocaleString("en-IN")} in your startup.`,
        data: {
          investmentId: inv._id.toString(),
          investorId: investorId.toString(),
          videoId: (videoId || "").toString(),
          status: "interested",
          investorName: investor?.name,
          amount: inv.amount,
          equity: inv.equity,
        },
      });
    }

    console.log("[FOUNDER_ID_RUNTIME]", {
      investmentFounderId: inv.founderId.toString(),
      videoFounderId: resolvedFounderId.toString(),
      notificationUserId: notifDoc?.userId?.toString(),
    });

    const notifsInDb = await Notification.find({
      "data.investmentId": inv._id.toString(),
    });

    console.log("[NOTIFICATION_DB_RUNTIME]", notifsInDb.map((n) => ({
      notificationId: n._id.toString(),
      userId: n.userId.toString(),
      type: n.type,
      title: n.title,
      dataStatus: n.data?.status,
      dataInvestmentId: n.data?.investmentId,
      createdAt: n.createdAt,
      isRead: n.isRead,
    })));
  } catch (notifErr) {
    console.error("Error creating interest notification:", notifErr);
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
  let inv = await Investment.findById(investmentId);
  if (!inv) {
    inv = await Investment.findOne({ videoId: investmentId, investorId: userId });
  }
  if (!inv) throw new ApiError(404, "Investment record not found");
  if (inv.investorId.toString() !== userId.toString()) {
    throw new ApiError(403, "Only investor can pay");
  }
  if (inv.isFrozen) {
    throw new ApiError(403, "This deal is frozen by admin and cannot proceed");
  }
  if (inv.stage === "interested") {
    inv.stage = "agreed";
    await inv.save();
  }
  if (inv.status === "paid") {
    throw new ApiError(400, "Already paid");
  }
  if (!inv.amount || inv.amount <= 0) {
    throw new ApiError(400, "Investment amount must be set");
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

  console.log("[RAZORPAY_ORDER_CREATED]", {
    investmentId: inv._id.toString(),
    orderId: order.id,
  });

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
  let inv = await Investment.findById(investmentId);
  if (!inv && razorpayOrderId) {
    inv = await Investment.findOne({ razorpayOrderId });
  }
  if (!inv) throw new ApiError(404, "Investment not found");

  console.log("[PAYMENT_VERIFICATION_ATTEMPT]", {
    investmentId: inv._id.toString(),
    razorpayOrderId,
    razorpayPaymentId,
    currentStatus: inv.status,
  });

  // Idempotency: already verified — return as-is
  if (inv.status === "paid" && inv.razorpayPaymentId === razorpayPaymentId) {
    return inv;
  }

  if (inv.razorpayOrderId && razorpayOrderId && inv.razorpayOrderId !== razorpayOrderId) {
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

  // Atomic transition — set paid, completed, paidAt
  const updated = await Investment.findOneAndUpdate(
    { _id: inv._id, status: { $ne: "paid" } },
    {
      razorpayOrderId: razorpayOrderId || inv.razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status: "paid",
      stage: "completed",
      paidAt: new Date(),
    },
    { new: true },
  );

  const finalInv = updated || inv;

  console.log("[PAYMENT_VERIFIED]", {
    investmentId: finalInv._id.toString(),
    founderId: finalInv.founderId.toString(),
    investorId: finalInv.investorId.toString(),
    status: finalInv.status,
    stage: finalInv.stage,
  });

  // Bump aggregates exactly once
  await User.findByIdAndUpdate(finalInv.investorId, {
    $inc: { totalInvested: finalInv.amount },
  });

  // Notify founder & investor idempotently
  try {
    const Notification = require("../notification/notification.model");
    const notif = require("../notification/notification.service");
    const investor = await User.findById(finalInv.investorId).select("name avatar");
    const founder = await User.findById(finalInv.founderId).select("name avatar");

    // Check if payment notification was already sent for this investment
    const existingNotif = await Notification.findOne({
      userId: finalInv.founderId,
      type: "investment",
      "data.investmentId": finalInv._id.toString(),
      "data.status": "paid",
    });

    console.log("[NOTIFICATION_CHECK]", {
      existingPaidNotification: !!existingNotif,
    });

    if (!existingNotif) {
      const createdNotif = await notif.send(finalInv.founderId, {
        type: "investment",
        title: "New Investment Received",
        body: `${investor?.name || "An investor"} has successfully invested ₹${finalInv.amount.toLocaleString(
          "en-IN",
        )} in your startup.`,
        data: {
          investmentId: finalInv._id.toString(),
          investorId: finalInv.investorId.toString(),
          investorName: investor?.name,
          investorAvatar: investor?.avatar,
          amount: finalInv.amount,
          equity: finalInv.equity,
          instrument: "Equity",
          round: "Series A",
          status: "paid",
          stage: "completed",
          transactionId: finalInv.razorpayPaymentId || `INVST-${finalInv._id.toString().slice(-6).toUpperCase()}`,
          razorpayOrderId: finalInv.razorpayOrderId,
          razorpayPaymentId: finalInv.razorpayPaymentId,
          paidAt: finalInv.paidAt || new Date(),
        },
      });

      console.log("[NOTIFICATION_CREATED]", {
        notificationId: createdNotif?._id?.toString(),
        founderId: finalInv.founderId.toString(),
        investmentId: finalInv._id.toString(),
      });
    }

    // Also notify investor
    notif
      .send(finalInv.investorId, {
        type: "investment",
        title: "Payment successful",
        body: `Investment of ₹${finalInv.amount.toLocaleString("en-IN")} to ${
          founder?.name || "founder"
        } completed`,
        data: { investmentId: finalInv._id.toString() },
      })
      .catch(() => {});
  } catch (err) {
    console.error("Error creating notification during payment verification:", err);
  }

  return finalInv;
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

        // Also notify founder on webhook payment capture
        try {
          const notif = require("../notification/notification.service");
          const investor = await User.findById(inv.investorId).select("name avatar");
          notif.send(inv.founderId, {
            type: "investment",
            title: "New Investment Received",
            body: `${investor?.name || "An investor"} has successfully invested ₹${inv.amount.toLocaleString(
              "en-IN",
            )} in your startup.`,
            data: {
              investmentId: inv._id.toString(),
              investorName: investor?.name,
              investorAvatar: investor?.avatar,
              amount: inv.amount,
              equity: inv.equity,
              instrument: "Equity",
              round: "Series A",
              status: "paid",
              stage: "completed",
              transactionId: paymentId || `INVST-${inv._id.toString().slice(-6).toUpperCase()}`,
            },
          }).catch(() => {});
        } catch {}
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
    .populate("founderId", "name avatar companyName email isVerified verificationLevel")
    .populate("investorId", "name avatar email phone location isVerified verificationLevel bio")
    .populate("videoId", "title thumbnailUrl coverUrl askAmount equityOffered fundingStage industry");
};

const getById = async (id, userId) => {
  const inv = await Investment.findById(id)
    .populate("founderId", "name avatar companyName email isVerified verificationLevel")
    .populate("investorId", "name avatar email phone location isVerified verificationLevel bio")
    .populate("videoId", "title thumbnailUrl coverUrl askAmount equityOffered fundingStage industry");
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
