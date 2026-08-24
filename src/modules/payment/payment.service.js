const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const Payment = require("./payment.model");
const PaymentWebhookEvent = require("./paymentWebhookEvent.model");
const Course = require("../course/course.model");
const User = require("../user/user.model");
const Enrollment = require("../enrollment/enrollment.model");
const enrollmentService = require("../enrollment/enrollment.service");
const razorpayService = require("./razorpay.service");
const ApiError = require("../../utils/ApiError");

/**
 * Safely unset null values on sparse indexed fields for legacy payment documents
 */
const sanitizeNullSparseFields = async () => {
  try {
    await Payment.updateMany({ razorpayPaymentId: null }, { $unset: { razorpayPaymentId: "" } });
    await Payment.updateMany({ claimToken: null }, { $unset: { claimToken: "" } });
  } catch (err) {
    // Non-blocking warning for legacy cleanup
    console.warn("[Payment DB Migration Warning] Could not sanitize null sparse fields:", err.message);
  }
};
// Run once asynchronously on module load
sanitizeNullSparseFields();

/**
 * Create a server-authorized Razorpay Order for an authenticated Founder/Investor
 */
const createCourseOrder = async (user, courseId) => {
  if (!user || !user._id) {
    throw new ApiError(401, "Authentication required");
  }

  // Ensure Admin cannot purchase courses
  if (user.role === "admin") {
    throw new ApiError(403, "Admins cannot purchase courses. Admin role has direct management access.");
  }

  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID format.");
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(404, "Course not found. Please refresh the page and try again.");
  }

  if (course.status === "deleted") {
    throw new ApiError(404, "This course is no longer available.");
  }

  if (course.status !== "published") {
    throw new ApiError(400, `This course is not available for purchase yet (status: ${course.status}).`);
  }

  // Check if user is already enrolled
  const existingEnrollment = await Enrollment.findOne({ userId: user._id, courseId, status: "active" });
  if (existingEnrollment) {
    throw new ApiError(400, "You are already enrolled in this course.");
  }

  // Price coming strictly from backend MongoDB Course model
  const rawPrice = Number(course.price);
  if (isNaN(rawPrice) || rawPrice < 0) {
    throw new ApiError(400, "Invalid course price configuration.");
  }
  const amountInPaise = Math.round(rawPrice * 100);

  // Free course handling
  if (amountInPaise <= 0) {
    const enrollment = await enrollmentService.purchaseAndEnroll(user, courseId, {
      transactionId: `FREE_${Date.now()}`,
      paymentMethod: "Free Access",
      amount: 0,
    });
    return { isFree: true, enrollment };
  }

  if (amountInPaise < 100) {
    throw new ApiError(400, "Payment amount must be at least ₹1 (100 paise).");
  }

  // Check if an active unfulfilled pending order exists for this user and course created within 15 mins
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  const pendingOrder = await Payment.findOne({
    userId: user._id,
    courseId,
    status: "created",
    createdAt: { $gte: fifteenMinsAgo },
  }).sort({ createdAt: -1 });

  if (pendingOrder && pendingOrder.amount === amountInPaise && pendingOrder.razorpayOrderId) {
    return {
      success: true,
      order: {
        id: pendingOrder.razorpayOrderId,
        amount: pendingOrder.amount,
        currency: pendingOrder.currency || "INR",
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentId: pendingOrder._id,
      reusedPendingOrder: true,
    };
  }

  // Generate safe Razorpay receipt (max 40 chars, using safe alphanumerics <= 25 chars)
  const receipt = `rcpt_${courseId.toString().slice(-6)}_${Date.now().toString(36)}`;

  const order = await razorpayService.createOrder(amountInPaise, "INR", receipt, {
    courseId: courseId.toString(),
    userId: user._id.toString(),
  });

  // Construct document without null defaults for sparse fields
  const paymentRecord = await Payment.create({
    userId: user._id,
    courseId,
    razorpayOrderId: order.id,
    amount: amountInPaise,
    currency: order.currency || "INR",
    receipt,
    status: "created",
    isGuest: false,
  });

  return {
    success: true,
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency || "INR",
    },
    keyId: process.env.RAZORPAY_KEY_ID,
    paymentId: paymentRecord._id,
  };
};

/**
 * Create a server-authorized Razorpay Order for an unauthenticated Guest
 */
const guestCreateCourseOrder = async (courseId) => {
  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID format.");
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(404, "Course not found. Please refresh the page and try again.");
  }

  if (course.status === "deleted") {
    throw new ApiError(404, "This course is no longer available.");
  }

  if (course.status !== "published") {
    throw new ApiError(400, `This course is not available for purchase yet (status: ${course.status}).`);
  }

  const rawPrice = Number(course.price);
  if (isNaN(rawPrice) || rawPrice < 0) {
    throw new ApiError(400, "Invalid course price configuration.");
  }
  const amountInPaise = Math.round(rawPrice * 100);

  if (amountInPaise <= 0) {
    throw new ApiError(400, "Free courses require account sign-up before enrollment.");
  }

  if (amountInPaise < 100) {
    throw new ApiError(400, "Payment amount must be at least ₹1 (100 paise).");
  }

  // Check for recent unfulfilled guest order for the same course created within 15 mins
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
  const pendingGuestOrder = await Payment.findOne({
    userId: null,
    courseId,
    status: "created",
    isGuest: true,
    createdAt: { $gte: fifteenMinsAgo },
  }).sort({ createdAt: -1 });

  if (pendingGuestOrder && pendingGuestOrder.amount === amountInPaise && pendingGuestOrder.razorpayOrderId) {
    return {
      success: true,
      order: {
        id: pendingGuestOrder.razorpayOrderId,
        amount: pendingGuestOrder.amount,
        currency: pendingGuestOrder.currency || "INR",
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentId: pendingGuestOrder._id,
      reusedPendingOrder: true,
    };
  }

  const receipt = `g_rcpt_${courseId.toString().slice(-6)}_${Date.now().toString(36)}`;
  const order = await razorpayService.createOrder(amountInPaise, "INR", receipt, {
    courseId: courseId.toString(),
    isGuest: "true",
  });

  const paymentRecord = await Payment.create({
    userId: null,
    courseId,
    razorpayOrderId: order.id,
    amount: amountInPaise,
    currency: order.currency || "INR",
    receipt,
    status: "created",
    isGuest: true,
  });

  return {
    success: true,
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency || "INR",
    },
    keyId: process.env.RAZORPAY_KEY_ID,
    paymentId: paymentRecord._id,
  };
};

/**
 * Idempotent fulfillment helper to convert confirmed Razorpay payment into Course Enrollment
 */
const fulfillSuccessfulPayment = async (razorpayOrderId, razorpayPaymentId, paymentMethod = "Razorpay Checkout") => {
  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    throw new ApiError(404, "Payment record not found for order");
  }

  // Idempotency: if already fulfilled, return existing enrollment or status
  if (payment.status === "captured" || payment.status === "claimed") {
    if (payment.enrollmentId) {
      const enrollment = await Enrollment.findById(payment.enrollmentId);
      if (enrollment) return { payment, enrollment };
    }
    return { payment, claimToken: payment.claimToken };
  }

  // Atomic state change to captured
  const updatedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "captured" } },
    {
      razorpayPaymentId,
      status: "captured",
      paymentMethod,
      capturedAt: new Date(),
      verifiedAt: new Date(),
    },
    { new: true }
  );

  if (!updatedPayment) {
    // Concurrent execution completed it
    const reFetched = await Payment.findById(payment._id);
    if (reFetched.enrollmentId) {
      const enrollment = await Enrollment.findById(reFetched.enrollmentId);
      return { payment: reFetched, enrollment };
    }
    return { payment: reFetched, claimToken: reFetched.claimToken };
  }

  // Handle Authenticated User vs Guest User
  if (updatedPayment.userId) {
    const user = await User.findById(updatedPayment.userId);
    if (!user) {
      throw new ApiError(404, "User account for payment not found");
    }

    const enrollment = await enrollmentService.purchaseAndEnroll(user, updatedPayment.courseId, {
      transactionId: razorpayPaymentId,
      paymentId: razorpayPaymentId,
      paymentMethod: updatedPayment.paymentMethod,
      amount: updatedPayment.amount / 100,
    });

    updatedPayment.enrollmentId = enrollment._id;
    await updatedPayment.save();

    return { payment: updatedPayment, enrollment };
  } else {
    // Guest purchase: Generate claimToken for account signup/login linkage
    const claimToken = `CLAIM_${uuidv4()}`;
    updatedPayment.claimToken = claimToken;
    await updatedPayment.save();

    return { payment: updatedPayment, claimToken };
  }
};

/**
 * Verify Razorpay Checkout response parameters and fulfill purchase
 */
const verifyAndFulfill = async (user, { courseId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Missing required Razorpay payment response parameters");
  }

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) {
    throw new ApiError(404, "Invalid order ID. Payment record not found.");
  }

  if (payment.courseId.toString() !== courseId.toString()) {
    throw new ApiError(400, "Course ID mismatch for this order");
  }

  if (user && payment.userId && payment.userId.toString() !== user._id.toString()) {
    throw new ApiError(403, "Payment order does not belong to the authenticated user");
  }

  // Verify HMAC SHA256 Signature using server stored order ID
  const isSignatureValid = razorpayService.verifySignature(
    payment.razorpayOrderId,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isSignatureValid) {
    payment.status = "failed";
    await payment.save();
    throw new ApiError(400, "Payment verification failed. Invalid Razorpay signature.");
  }

  // Fetch payment status from Razorpay REST API for double confirmation
  try {
    const rzpPayment = await razorpayService.fetchPayment(razorpay_payment_id);
    if (!rzpPayment || (rzpPayment.status !== "captured" && rzpPayment.status !== "authorized")) {
      payment.status = "failed";
      await payment.save();
      throw new ApiError(400, `Razorpay payment is not successful. Current status: ${rzpPayment?.status || 'unknown'}`);
    }

    if (rzpPayment.amount !== payment.amount) {
      throw new ApiError(400, "Razorpay payment amount mismatch");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.warn("Razorpay API fetch warning during verification:", err.message);
  }

  // Save signature
  payment.razorpaySignature = razorpay_signature;
  await payment.save();

  // Fulfill enrollment idempotently
  return fulfillSuccessfulPayment(payment.razorpayOrderId, razorpay_payment_id);
};

/**
 * Process server-to-server Razorpay webhooks idempotently
 */
const handleWebhook = async (rawBody, signatureHeader) => {
  const isSigValid = razorpayService.verifyWebhookSignature(rawBody, signatureHeader);
  if (!isSigValid) {
    throw new ApiError(400, "Invalid Razorpay Webhook signature");
  }

  const payload = JSON.parse(rawBody.toString());
  const eventId = payload.event_id || payload.id;
  const eventType = payload.event;

  if (!eventId) {
    return { ok: true, message: "No event ID provided" };
  }

  // Idempotency Check: Ignore if webhook event was already processed
  const existingEvent = await PaymentWebhookEvent.findOne({ eventId });
  if (existingEvent) {
    return { ok: true, duplicate: true, message: "Webhook event already processed" };
  }

  await PaymentWebhookEvent.create({
    eventId,
    eventType,
    razorpayPaymentId: payload.payload?.payment?.entity?.id || "",
    razorpayOrderId: payload.payload?.payment?.entity?.order_id || "",
    processedAt: new Date(),
  });

  if (eventType === "payment.captured" || eventType === "order.paid") {
    const paymentEntity = payload.payload?.payment?.entity;
    if (paymentEntity && paymentEntity.order_id) {
      await fulfillSuccessfulPayment(paymentEntity.order_id, paymentEntity.id, paymentEntity.method || "Razorpay Webhook");
    }
  } else if (eventType === "payment.failed") {
    const paymentEntity = payload.payload?.payment?.entity;
    if (paymentEntity && paymentEntity.order_id) {
      await Payment.updateOne(
        { razorpayOrderId: paymentEntity.order_id, status: { $ne: "captured" } },
        { status: "failed" }
      );
    }
  }

  return { ok: true, eventType };
};

/**
 * Claim a verified guest purchase after user registration or login
 */
const claimPurchase = async (user, claimToken) => {
  if (!user || !user._id) {
    throw new ApiError(401, "Authentication required to claim purchase");
  }

  if (user.role === "admin") {
    throw new ApiError(403, "Admins cannot claim student course purchases");
  }

  if (!claimToken) {
    throw new ApiError(400, "Claim token is required");
  }

  const payment = await Payment.findOne({ claimToken });
  if (!payment) {
    throw new ApiError(404, "Invalid or expired purchase claim token");
  }

  if (payment.claimedBy) {
    throw new ApiError(400, "This purchase has already been claimed by an account");
  }

  if (payment.status !== "captured") {
    throw new ApiError(400, "Purchase payment was not captured or verified");
  }

  // Create enrollment for the newly authenticated user
  const enrollment = await enrollmentService.purchaseAndEnroll(user, payment.courseId, {
    transactionId: payment.razorpayPaymentId || payment.razorpayOrderId,
    paymentId: payment.razorpayPaymentId || payment.razorpayOrderId,
    paymentMethod: payment.paymentMethod || "Guest Verified Purchase",
    amount: payment.amount / 100,
  });

  payment.claimedBy = user._id;
  payment.claimedAt = new Date();
  payment.enrollmentId = enrollment._id;
  payment.status = "claimed";
  await payment.save();

  return enrollment;
};

module.exports = {
  createCourseOrder,
  guestCreateCourseOrder,
  fulfillSuccessfulPayment,
  verifyAndFulfill,
  handleWebhook,
  claimPurchase,
};
