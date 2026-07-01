const mongoose = require("mongoose");

const boostSchema = new mongoose.Schema(
  {
    founderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      index: true,
    },
    tier: {
      type: String,
      enum: ["mini", "pro", "mega"],
      required: true,
    },
    amount: { type: Number, required: true }, // INR
    durationHours: { type: Number, required: true },

    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "active", "expired", "failed"],
      default: "pending",
      index: true,
    },
    startedAt: { type: Date },
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true },
);

boostSchema.index({ videoId: 1, status: 1 });

module.exports = mongoose.model("Boost", boostSchema);
