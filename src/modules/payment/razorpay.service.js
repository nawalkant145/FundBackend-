const crypto = require("crypto");
const ApiError = require("../../utils/ApiError");

let razorpayInstance = null;

                                                          
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

                                                                                                                                                                                                                                                                                                                  
const createOrder = async (amountInSubunits, currency = "INR", receipt = "", notes = {}) => {
  const rzp = getRazorpay();
  try {
    const order = await rzp.orders.create({
      amount: Math.round(amountInSubunits),
      currency,
      receipt,
      notes,
    });
    return order;
  } catch (err) {
                                                                                   
    const failureDetail = err.error?.description || err.error?.reason || err.message || "Unknown Razorpay error";
    const failureCode = err.error?.code || err.statusCode || "RAZORPAY_ERROR";
    console.error(`[Razorpay Order Error] Code: ${failureCode} | Detail: ${failureDetail}`);

    throw new ApiError(
      400,
      `Unable to create Razorpay payment order: ${failureDetail}`
    );
  }
};

                                                                                                                                                                                                                                                                                                 
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

                                                         
const fetchPayment = async (paymentId) => {
  const rzp = getRazorpay();
  return rzp.payments.fetch(paymentId);
};

                                                       
const fetchOrder = async (orderId) => {
  const rzp = getRazorpay();
  return rzp.orders.fetch(orderId);
};

                                                                                                                                                                                                         
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
