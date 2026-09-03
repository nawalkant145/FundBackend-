const mongoose = require("mongoose");

const fundingImpactSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    fundingAmountCr: {
      type: Number,
      required: true,
      min: 0,
    },
    startupsFunded: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "startupsFunded must be an integer",
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

                                                                        
fundingImpactSchema.index({ year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("FundingImpact", fundingImpactSchema);
