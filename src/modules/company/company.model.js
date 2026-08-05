const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    founderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyName: { type: String, required: true, trim: true },
    CIN: { type: String, required: true, trim: true, index: true },
    GST: { type: String, default: "", trim: true },
    registrationCertificate: { type: String, required: true },
    companyPAN: { type: String, required: true, trim: true },
    startupIndiaCert: { type: String, default: "" },
    businessEmail: { type: String, required: true, lowercase: true, trim: true },
    isBusinessEmailVerified: { type: Boolean, default: false },
    businessEmailOtpHash: { type: String, select: false },
    businessEmailOtpExpires: { type: Date, select: false },
    verificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected", "info_requested"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    additionalInfoInstructions: { type: String, default: "" },
    verifiedAt: { type: Date },
    verificationExpiry: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);
