const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["images", "text"],
      default: "images",
    },
    images: [{ type: String }], // Cloudinary URLs, max 10
    caption: { type: String, default: "", maxlength: 2200 },
    link: { type: String, default: "" },
    hashtags: [{ type: String }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    commentCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
