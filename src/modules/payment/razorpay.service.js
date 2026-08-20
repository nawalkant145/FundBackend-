const crypto = require("crypto");
const ApiError = require("../../utils/ApiError");

let razorpayInstance = null;

/**
 * Get lazy-initialized Razorpay client instance
 */
const getRazorpay = () => {
  if (razorpayInstance) return razorpayInstance;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(500, "Razorpay API keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured in environment");
  }
  const Razorpay = require("razorpay");
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return razorpayInstance;
};

/**
 * Create a new Razorpay order server-side
 * @param {number} amountInSubunits Amount in smallest currency unit (e.g. paise)
 * @param {string} currency Currency code (default "INR")
 * @param {string} receipt Receipt string identifier
 * @param {object} notes Custom metadata key-value pairs
 */
const createOrder = async (amountInSubunits, currency = "INR", receipt = "", notes = {}) => {
  const rzp = getRazorpay();
  const order = await rzp.orders.create({
    amount: Math.round(amountInSubunits),
    currency,
    receipt,
    notes,
  });
  return order;
};

/**
 * Verify Razorpay payment signature using HMAC SHA256
 * @param {string} storedOrderId Order ID stored on backend server
 * @param {string} razorpayPaymentId Payment ID returned by Razorpay Checkout
 * @param {string} razorpaySignature Signature returned by Razorpay Checkout
 */
const verifySignature = (storedOrderId, razorpayPaymentId, razorpaySignature) => {
  if (!storedOrderId || !razorpayPaymentId || !razorpaySignature) return false;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${storedOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return expected === razorpaySignature;
};

/**
 * Fetch payment details from Razorpay REST API
 */
const fetchPayment = async (paymentId) => {
  const rzp = getRazorpay();
  return rzp.payments.fetch(paymentId);
};

/**
 * Fetch order details from Razorpay REST API
 */
const fetchOrder = async (orderId) => {
  const rzp = getRazorpay();
  return rzp.orders.fetch(orderId);
};

/**
 * Verify Razorpay Webhook signature against RAW request body
 * @param {Buffer|string} rawBody Raw request payload
 * @param {string} signatureHeader Value from X-Razorpay-Signature header
 */
const verifyWebhookSignature = (rawBody, signatureHeader) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return expected === signatureHeader;
};

module.exports = {
  getRazorpay,
  createOrder,
  verifySignature,
  fetchPayment,
  fetchOrder,
  verifyWebhookSignature,
};
