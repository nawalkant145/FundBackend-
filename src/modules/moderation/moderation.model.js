const mongoose = require("mongoose");

                                                                                                                                                                                             
const moderationFlagSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: ["video", "comment", "post"],
      required: true,
      index: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
                                                             
    originalText: { type: String, default: "" },
                                      
    matchedTerms: [{ type: String }],
    reason: {
      type: String,
      enum: ["profanity", "banned-keyword", "manual"],
      default: "profanity",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "removed", "dismissed"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

moderationFlagSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ModerationFlag", moderationFlagSchema);
