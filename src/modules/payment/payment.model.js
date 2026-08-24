const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      trim: true,
    },
    razorpaySignature: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0, // stored in subunits (paise)
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    status: {
      type: String,
      enum: ["created", "authorized", "captured", "failed", "claimed", "refunded"],
      default: "created",
      index: true,
    },
    paymentMethod: {
      type: String,
      default: "Razorpay Checkout",
    },
    receipt: {
      type: String,
      default: "",
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    capturedAt: {
      type: Date,
      default: null,
    },
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      default: null,
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    claimToken: {
      type: String,
      sparse: true,
      index: true,
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
