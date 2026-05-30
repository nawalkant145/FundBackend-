const mongoose = require("mongoose");

const pitchDeckAccessSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    founderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending",
      index: true,
    },
    message: { type: String, default: "" },
    respondedAt: { type: Date },
  },
  { timestamps: true },
);

pitchDeckAccessSchema.index({ founderId: 1, investorId: 1 }, { unique: true });

module.exports = mongoose.model("PitchDeckAccess", pitchDeckAccessSchema);
