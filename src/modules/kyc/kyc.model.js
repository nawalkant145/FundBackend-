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
    referenceId: { type: String, default: "", index: true },
    documentFront: { type: String, required: true },
    documentBack: { type: String, default: "" },
    selfie: { type: String, required: true },
    verificationStatus: {
      type: String,
      enum: ["draft", "submitted", "under_review", "approved", "rejected", "resubmitted"],
      default: "under_review",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    reviewNotes: { type: String, default: "" },
    additionalInfoInstructions: { type: String, default: "" },
    verificationLevel: { type: Number, default: 2 },
    verifiedAt: { type: Date },
    verificationExpiry: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    attemptsCount: { type: Number, default: 1 },
    history: [
      {
        action: {
          type: String,
          enum: ["submitted", "under_review", "approved", "rejected", "resubmitted"],
          required: true,
        },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: { type: String, default: "" },
        notes: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],

                                                                                
    verificationMethod: {
      type: String,
      enum: ["manual", "digilocker"],
      default: "manual",
      index: true,
    },
    digilockerReference: { type: String, default: "" },                                     
    digilockerStatus: {
      type: String,
      enum: ["none", "initiated", "verifying", "completed", "failed"],
      default: "none",
    },
    documentsVerified: [{ type: String }],                           
    verificationResult: {
      type: String,
      enum: ["passed", "failed", "manual_review_required"],
      default: "passed",
    },
    manualReviewRequired: { type: Boolean, default: false },
    failureReason: { type: String, default: "" },
    matchConfidence: { type: Number, default: 0 },                                
    extractedData: {
      name: { type: String, default: "" },
      dob: { type: String, default: "" },
      gender: { type: String, default: "" },
      aadhaarMasked: { type: String, default: "" },
      panNumber: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KYC", kycSchema);