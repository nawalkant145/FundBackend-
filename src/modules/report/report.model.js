const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reportedVideo: { type: mongoose.Schema.Types.ObjectId, ref: "Video" },
    type: {
      type: String,
      enum: ["spam", "fake", "inappropriate", "scam", "other"],
      required: true,
    },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    actionTaken: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Report", reportSchema);
