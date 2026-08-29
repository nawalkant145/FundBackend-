const mongoose = require("mongoose");

const eventRegistrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["registered", "cancelled", "attended"],
      default: "registered",
    },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);
