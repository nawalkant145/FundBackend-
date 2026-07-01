const mongoose = require("mongoose");

/**
 * Single global settings document (singleton).
 * Holds platform-wide feature flags, limits, and the custom banned-word list.
 * Admins edit these from the Settings panel — no code deploy needed.
 */
const settingsSchema = new mongoose.Schema(
  {
    // Singleton key — always "global"
    key: { type: String, default: "global", unique: true, index: true },

    // ─── Feature flags ───────────────────────────
    signupsEnabled: { type: Boolean, default: true },
    uploadsEnabled: { type: Boolean, default: true },
    postsEnabled: { type: Boolean, default: true },
    investmentsEnabled: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: {
      type: String,
      default: "We're doing some maintenance. Back shortly.",
    },

    // ─── Limits ──────────────────────────────────
    maxPitchesPerFounder: { type: Number, default: 3 },
    maxPostsPerDay: { type: Number, default: 10 },
    pitchExpiryDays: { type: Number, default: 30 },

    // ─── Moderation ──────────────────────────────
    profanityFilterEnabled: { type: Boolean, default: true },
    // Extra banned words admins add on top of the built-in list
    customBannedWords: [{ type: String }],

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Settings", settingsSchema);
