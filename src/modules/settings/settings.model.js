const mongoose = require("mongoose");

                                                                                                                                                                                                                
const settingsSchema = new mongoose.Schema(
  {
                                      
    key: { type: String, default: "global", unique: true, index: true },

                                                    
    signupsEnabled: { type: Boolean, default: true },
    uploadsEnabled: { type: Boolean, default: true },
    postsEnabled: { type: Boolean, default: true },
    investmentsEnabled: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: {
      type: String,
      default: "We're doing some maintenance. Back shortly.",
    },

                                                    
    maxPitchesPerFounder: { type: Number, default: 3 },
    maxPostsPerDay: { type: Number, default: 10 },
    pitchExpiryDays: { type: Number, default: 30 },

                                                    
    profanityFilterEnabled: { type: Boolean, default: true },
                                                                
    customBannedWords: [{ type: String }],

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Settings", settingsSchema);
