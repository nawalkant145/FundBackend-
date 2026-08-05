const mongoose = require("mongoose");

const kycSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: ["pan", "passport", "govt_id", "aadhar", "driving_license"],
      required: true,
    },
    documentNumber: { type: String, default: "" },
    documentNumberHash: { type: String, default: "", index: true },
    documentFront: { type: String, required: true },
    documentBack: { type: String, default: "" },
    selfie: { type: String, required: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "info_requested"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    additionalInfoInstructions: { type: String, default: "" },
    verifiedAt: { type: Date },
    verificationExpiry: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    attemptsCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KYC", kycSchema);
