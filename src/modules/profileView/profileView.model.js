const mongoose = require("mongoose");

const profileViewSchema = new mongoose.Schema(
  {
    profileOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    viewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    viewedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

profileViewSchema.index({ profileOwnerId: 1, viewedAt: -1 });

module.exports = mongoose.model("ProfileView", profileViewSchema);
