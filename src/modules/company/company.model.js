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
    companyPAN: { type: String, required: true, trim: true },
    registrationCertificate: { type: String, required: true },
    
    // Optional Supporting Verification Documents (Non-blocking for early stage)
    GST: { type: String, default: "", trim: true },
    udyamNumber: { type: String, default: "", trim: true }, // MSME registration number
    startupIndiaCert: { type: String, default: "" },
    moaUrl: { type: String, default: "" }, // Memorandum of Association
    aoaUrl: { type: String, default: "" }, // Articles of Association
    
    // Company Profile & Entity Details
    registeredOfficeAddress: { type: String, default: "" },
    website: { type: String, default: "" },
    businessEmail: { type: String, required: true, lowercase: true, trim: true },
    directors: [
      {
        name: { type: String, default: "" },
        din: { type: String, default: "" }, // Director Identification Number
        pan: { type: String, default: "" },
        email: { type: String, default: "" },
      },
    ],
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
