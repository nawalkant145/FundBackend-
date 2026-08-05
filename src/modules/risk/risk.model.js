const mongoose = require("mongoose");

const riskAssessmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    riskScore: { type: Number, default: 0, min: 0, max: 100 }, // 0=safe, 100=critical
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
      index: true,
    },
    triggers: [
      {
        reason: { type: String, required: true },
        source: { type: String, default: "system" },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: Object, default: {} },
      },
    ],
    actionTaken: {
      type: String,
      enum: ["none", "info_requested", "restricted", "suspended", "banned"],
      default: "none",
    },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RiskAssessment", riskAssessmentSchema);
