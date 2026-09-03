const crypto = require("crypto");
const Subscription = require("./subscription.model");
const User = require("../user/user.model");
const { planForRole, DURATION_DAYS } = require("./subscription.constants");
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

                                                         
const activate = async (sub) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sub.durationDays * 86400 * 1000);
  sub.status = "active";
  sub.startedAt = now;
  sub.expiresAt = expiresAt;
  await sub.save();

  await User.findByIdAndUpdate(sub.userId, {
    subscription: {
      plan: "pro",
      status: "active",
      startedAt: now,
      expiresAt,
    },
  });
  return sub;
};

                                                                         
const getMine = async (userId) => {
  const user = await User.findById(userId).select("subscription role");
  if (!user) throw new ApiError(404, "User not found");
  const s = user.subscription || {};
  if (
    s.plan === "pro" &&
    s.status === "active" &&
    s.expiresAt &&
    new Date(s.expiresAt) <= new Date()
  ) {
    user.subscription.plan = "free";
    user.subscription.status = "expired";
    await user.save({ validateBeforeSave: false });
  }
  const plan = planForRole(user.role);
  return { subscription: user.subscription, plan };
};

const createOrder = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (user.isProActive()) {
    throw new ApiError(400, "You already have an active Pro subscription");
  }
  const plan = planForRole(user.role);

  const sub = await Subscription.create({
    userId,
    planId: plan.id,
    amount: plan.price,
    durationDays: DURATION_DAYS,
    status: "pending",
  });

  const razorpay = getRazorpay();

  if (!razorpay) {
                                                                                     
    const active = await activate(sub);
    return {
      subscription: active,
      activated: true,
    };
  }

  const order = await razorpay.orders.create({
    amount: Math.round(plan.price * 100),
    currency: "INR",
    receipt: `sub_${sub._id}`,
    notes: { subscriptionId: sub._id.toString(), userId: userId.toString() },
  });

  sub.razorpayOrderId = order.id;
  await sub.save();
  return { subscription: sub, order, keyId: process.env.RAZORPAY_KEY_ID };
};

const verifyPayment = async ({
  subscriptionId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) throw new ApiError(404, "Subscription not found");

  if (sub.status === "active" && sub.razorpayPaymentId === razorpayPaymentId) {
    return sub;
  }
  if (sub.razorpayOrderId !== razorpayOrderId) {
    throw new ApiError(400, "Order ID mismatch");
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expected !== razorpaySignature) {
    sub.status = "failed";
    await sub.save();
    throw new ApiError(400, "Invalid payment signature");
  }

  sub.razorpayPaymentId = razorpayPaymentId;
  sub.razorpaySignature = razorpaySignature;
  await activate(sub);
  return sub;
};

                                          
const cancel = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  user.subscription = {
    plan: "free",
    status: "cancelled",
    startedAt: user.subscription?.startedAt,
    expiresAt: user.subscription?.expiresAt,
  };
  await user.save({ validateBeforeSave: false });
  return user.subscription;
};

module.exports = { getMine, createOrder, verifyPayment, cancel, activate };
