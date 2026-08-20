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

    // Per-boost-cycle investor deduplication.
    // When a boosted pitch is promoted to an investor, their _id is appended
    // here via $addToSet. The same investor will not receive the boost
    // promotion again during THIS boost cycle. A new boost purchase starts
    // with an empty shownTo[], giving a fresh promotion cycle.
    shownTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

// Original index kept intact
boostSchema.index({ videoId: 1, status: 1 });
// Feed query: find active unshown boosts efficiently
boostSchema.index({ status: 1, expiresAt: 1, shownTo: 1 });
// Authoritative active-boost check in createOrder (GAP 5)
boostSchema.index({ videoId: 1, founderId: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model("Boost", boostSchema);
