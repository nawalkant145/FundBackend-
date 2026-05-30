const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema(
  {
    founderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" },
    amount: { type: Number, default: 0 }, // INR (paise stored as INR rupees here)
    equity: { type: Number, default: 0 }, // %
    stage: {
      type: String,
      enum: ["interested", "negotiating", "agreed", "completed"],
      default: "interested",
      index: true,
    },
    terms: { type: String, default: "" },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

investmentSchema.index(
  { founderId: 1, investorId: 1, videoId: 1 },
  { unique: true },
);

module.exports = mongoose.model("Investment", investmentSchema);
