const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      default: null,
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    text: { type: String, required: true, maxlength: 1000 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    replyCount: { type: Number, default: 0 },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },                
    reportCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

commentSchema.index({ videoId: 1, parentId: 1, createdAt: -1 });
commentSchema.index({ postId: 1, parentId: 1, createdAt: -1 });

module.exports = mongoose.model("Comment", commentSchema);
