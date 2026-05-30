const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    type: { type: String, enum: ["audio", "video"], required: true },
    status: {
      type: String,
      enum: [
        "initiated",
        "ringing",
        "accepted",
        "declined",
        "ended",
        "missed",
        "no_answer",
      ],
      default: "initiated",
      index: true,
    },
    channelName: { type: String, required: true, unique: true },
    startedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 }, // seconds
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

callSchema.index({ callerId: 1, createdAt: -1 });
callSchema.index({ receiverId: 1, createdAt: -1 });

module.exports = mongoose.model("Call", callSchema);
