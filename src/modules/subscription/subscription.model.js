const mongoose = require("mongoose");

// Payment/order history for Pro subscriptions. Current entitlement lives on
// the User document (user.subscription); this records each purchase.
const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: { type: String, required: true }, // investor-pro | founder-pro
    amount: { type: Number, required: true }, // INR
    durationDays: { type: Number, required: true },

    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "active", "failed"],
      default: "pending",
      index: true,
    },
    startedAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
