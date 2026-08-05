const mongoose = require("mongoose");

const investmentKycSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    addressProof: {
      docType: { type: String, enum: ["utility_bill", "bank_statement", "passport", "aadhaar"], required: true },
      docUrl: { type: String, required: true },
    },
    bankAccount: {
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
      bankName: { type: String, required: true },
      proofUrl: { type: String, default: "" }, // cancelled cheque or statement
      isVerified: { type: Boolean, default: false },
    },
    incomeProofUrl: { type: String, default: "" },
    netWorthDeclaration: {
      declaredAmount: { type: Number, default: 0 },
      declarationDocUrl: { type: String, default: "" },
    },
    amlStatus: {
      type: String,
      enum: ["passed", "flagged", "pending"],
      default: "pending",
    },
    sanctionsCheck: {
      type: String,
      enum: ["clear", "flagged", "pending"],
      default: "clear",
    },
    pepCheck: { type: Boolean, default: false }, // Politically Exposed Person
    verificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected", "info_requested"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    verifiedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InvestmentKYC", investmentKycSchema);
