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
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", index: true },
    callType: {
      type: String,
      enum: ["voice", "video", "audio", "meeting"],
      default: "meeting",
    },
    type: { type: String, enum: ["audio", "video", "voice", "meeting"], default: "meeting" },         
    status: {
      type: String,
      enum: [
        "initiated",
        "ringing",
        "accepted",
        "completed",
        "declined",
        "rejected",
        "ended",
        "missed",
        "cancelled",
        "busy",
        "no_answer",
      ],
      default: "initiated",
      index: true,
    },
    channelName: { type: String, required: true, unique: true },
    startedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number, default: 0 },           
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

callSchema.index({ callerId: 1, createdAt: -1 });
callSchema.index({ receiverId: 1, createdAt: -1 });

module.exports = mongoose.model("Call", callSchema);
