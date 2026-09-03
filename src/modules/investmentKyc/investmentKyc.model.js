const mongoose = require("mongoose");

const investmentKycSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    investorType: {
      type: String,
      enum: ["individual", "angel", "hni", "vc", "family_office", "corporate", "other"],
      default: "individual",
    },
    
                                                                 
    isCorporateEntity: { type: Boolean, default: false },
    entityDetails: {
      companyName: { type: String, default: "" },
      registrationType: { type: String, default: "" },                      
      CIN_LLPIN: { type: String, default: "" },
      companyPAN: { type: String, default: "" },
      GSTIN: { type: String, default: "" },
      registeredAddress: { type: String, default: "" },
      officialBusinessEmail: { type: String, default: "" },
      boardResolutionDoc: { type: String, default: "" },
      authorizedPersonName: { type: String, default: "" },
      authorizedPersonDesignation: { type: String, default: "" },
    },

    addressProof: {
      docType: { type: String, enum: ["utility_bill", "bank_statement", "passport", "aadhaar"], required: true },
      docUrl: { type: String, required: true },
    },
    bankAccount: {
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
      bankName: { type: String, required: true },
      proofUrl: { type: String, default: "" },                                 
      isVerified: { type: Boolean, default: false },
    },
    incomeProofUrl: { type: String, default: "" },
    netWorthDeclaration: {
      declaredAmount: { type: Number, default: 0 },
      declarationDocUrl: { type: String, default: "" },
    },

                                      
    investmentProfile: {
      preferredSectors: [{ type: String }],
      typicalTicketSizeMin: { type: Number, default: 0 },
      typicalTicketSizeMax: { type: Number, default: 0 },
      preferredGeography: [{ type: String }],
      investmentStage: [{ type: String }],
      riskDeclarationAccepted: { type: Boolean, default: false },
      declarationAcceptedAt: { type: Date },
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
    pepCheck: { type: Boolean, default: false },                              
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
