const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "" },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date },
    location: { type: String, default: "Online", trim: true },
    eventType: {
      type: String,
      enum: ["offline", "online", "hybrid"],
      default: "offline",
    },
    meetingUrl: { type: String, default: "" },
    bannerUrl: { type: String, default: "" },
    capacity: { type: Number, default: 0 },                 
    registeredCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "published", "completed", "cancelled"],
      default: "published",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

eventSchema.index({ status: 1, isDeleted: 1, startDate: 1 });

module.exports = mongoose.model("Event", eventSchema);
