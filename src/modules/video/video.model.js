const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    founderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 2000 },
    videoUrl: { type: String, required: true },
    hlsUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    cloudinaryPublicId: { type: String, default: "" },
    duration: { type: Number, required: true },           
    industry: { type: String, default: "", index: true },
    fundingStage: { type: String, default: "", index: true },
    askAmount: { type: Number, default: 0 },
    equityOffered: { type: Number, default: 0 },
    visibility: {
      type: String,
      enum: ["everyone", "investors-only"],
      default: "everyone",
    },

    views: { type: Number, default: 0 },
    uniqueViews: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    notInterested: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    commentCount: { type: Number, default: 0 },

    watchTimeData: [
      {
        investorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        watchedSeconds: Number,
        completedAt: Date,
      },
    ],

    status: {
      type: String,
      enum: [
        "processing",
        "active",
        "paused",
        "expired",
        "rejected",
        "deleted",
      ],
      default: "processing",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
    expiresAt: { type: Date, index: true },
    isRenewed: { type: Boolean, default: false },
    isBoosted: { type: Boolean, default: false },
    boostedUntil: { type: Date },
    reportCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

videoSchema.index({ status: 1, createdAt: -1 });
videoSchema.index({ founderId: 1, status: 1 });

module.exports = mongoose.model("Video", videoSchema);
