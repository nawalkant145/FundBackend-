const mongoose = require("mongoose");

const dealRoomSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      index: true,
    },
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
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
    },
    
    // Core Deal Terms
    fundingAmount: { type: Number, default: 0 }, // INR
    proposedValuation: { type: Number, default: 0 }, // INR
    equityPercentage: { type: Number, default: 0 }, // %

    // Deal Workflow Lifecycle Stage
    stage: {
      type: String,
      enum: [
        "deal_agreed",
        "term_sheet",
        "legal_compliance_review",
        "investment_documentation",
        "payment_route",
        "share_issuance",
        "statutory_filings",
      ],
      default: "deal_agreed",
      index: true,
    },

    // Deal Room Document Vault Repository
    documents: [
      {
        category: {
          type: String,
          enum: ["term_sheet", "company_doc", "financial_doc", "legal_doc", "other"],
          default: "other",
        },
        name: { type: String, required: true },
        url: { type: String, required: true },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uploadedAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["draft", "under_review", "approved", "rejected"],
          default: "under_review",
        },
        notes: { type: String, default: "" },
      },
    ],

    // Due Diligence Checklist Items
    checklist: [
      {
        key: { type: String, required: true },
        title: { type: String, required: true },
        category: {
          type: String,
          enum: ["corporate", "financial", "tax", "legal"],
          default: "corporate",
        },
        status: {
          type: String,
          enum: ["pending", "passed", "flagged"],
          default: "pending",
        },
        comments: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    // Professional Compliance Review Status
    reviewStatus: {
      caCsStatus: {
        type: String,
        enum: ["pending", "under_review", "approved", "changes_requested"],
        default: "pending",
      },
      caCsNotes: { type: String, default: "" },
      caCsReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      caCsReviewedAt: { type: Date },
      lawyerStatus: {
        type: String,
        enum: ["pending", "under_review", "approved", "changes_requested"],
        default: "pending",
      },
      lawyerNotes: { type: String, default: "" },
      lawyerReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      lawyerReviewedAt: { type: Date },
    },

    // E-Sign Execution Status
    eSignStatus: {
      type: String,
      enum: ["draft", "sent", "partially_signed", "fully_signed"],
      default: "draft",
    },

    // Request Initiator & Target
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    requestedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // Overall Deal Status
    status: {
      type: String,
      enum: ["pending_acceptance", "active", "declined", "on_hold", "closed_successfully", "cancelled"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

dealRoomSchema.index({ founderId: 1, investorId: 1, status: 1 });

module.exports = mongoose.model("DealRoom", dealRoomSchema);
