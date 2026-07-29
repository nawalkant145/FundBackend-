const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_]+$/,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v) => require("../auth/auth.validation").isValidEmail(v),
        message: "Please enter a valid email address",
      },
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ["founder", "investor", "admin"],
      required: true,
      index: true,
    },
    avatar: { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },
    phone: {
      type: String,
      default: "",
      index: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // optional in schema
          return require("../auth/auth.validation").isValidPhone(v);
        },
        message: "Please enter a valid phone number",
      },
    },
    country: { type: String, default: "" },
    bio: { type: String, default: "" },

    // Verification
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    verificationLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
      index: true,
    },
    isVerified: { type: Boolean, default: false }, // blue tick (level 3)
    verifiedAt: { type: Date },

    // OTPs (hashed)
    emailOtpHash: { type: String, select: false },
    emailOtpExpires: { type: Date, select: false },
    phoneOtpHash: { type: String, select: false },
    phoneOtpExpires: { type: Date, select: false },

    // Password reset
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Founder fields
    companyName: { type: String, default: "" },
    industry: { type: String, default: "" },
    fundingStage: {
      type: String,
      enum: ["", "idea", "pre-seed", "seed", "series-a", "series-b"],
      default: "",
    },
    pitchDeck: { type: String, default: "" },
    website: { type: String, default: "" },
    linkedIn: { type: String, default: "" },
    profileCompleteness: { type: Number, default: 0 },
    totalPitchViews: { type: Number, default: 0 },
    activePitchId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" },
    openToConnect: { type: Boolean, default: true },

    // Investor fields
    investorType: {
      type: String,
      enum: ["", "individual", "angel", "vc", "family-office"],
      default: "",
    },
    investmentRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    preferredIndustries: [{ type: String }],
    preferredStages: [{ type: String }],
    totalInvested: { type: Number, default: 0 },
    portfolioCompanies: [{ type: String }],
    investmentThesis: { type: String, default: "" },

    // Documents (KYC)
    documents: {
      panCard: { type: String, default: "" },
      aadhar: { type: String, default: "" },
      businessReg: { type: String, default: "" },
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
      },
      rejectionReason: { type: String, default: "" },
      submittedAt: { type: Date },
      reviewedAt: { type: Date },
    },

    // Block list
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Follow system
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },

    // Notification preferences (per-channel toggles; default all on)
    notificationPrefs: {
      type: Object,
      default: {},
    },
    // Privacy preferences (UI toggles)
    privacyPrefs: {
      type: Object,
      default: {},
    },

    // Subscription (EXPGLO Pro)
    subscription: {
      plan: { type: String, enum: ["free", "pro"], default: "free" },
      status: {
        type: String,
        enum: ["inactive", "active", "expired", "cancelled"],
        default: "inactive",
      },
      startedAt: { type: Date },
      expiresAt: { type: Date },
    },
    // Free-tier monthly chat quota (investors)
    freeChatsUsedThisMonth: { type: Number, default: 0 },
    chatQuotaResetAt: { type: Date },

    // Auth
    refreshToken: { type: String, select: false },
    fcmToken: { type: String, default: "" },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    // Status
    lastSeen: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },

    // IP / device tracking (last login)
    lastLoginIp: { type: String, default: "" },
    lastLoginUserAgent: { type: String, default: "" },
    lastLoginAt: { type: Date },

    // Temporary suspension (auto-expires)
    suspendedUntil: { type: Date, default: null },
    suspensionReason: { type: String, default: "" },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  delete obj.emailOtpHash;
  delete obj.emailOtpExpires;
  delete obj.phoneOtpHash;
  delete obj.phoneOtpExpires;
  delete obj.passwordResetTokenHash;
  delete obj.passwordResetExpires;
  return obj;
};

// Helper — recalculate verificationLevel from booleans
userSchema.methods.recomputeVerificationLevel = function () {
  let lvl = 0;
  if (this.isEmailVerified) lvl = 1;
  if (this.isEmailVerified && this.isPhoneVerified) lvl = 2;
  if (
    this.isEmailVerified &&
    this.isPhoneVerified &&
    this.documents?.status === "approved"
  ) {
    lvl = 3;
  }
  this.verificationLevel = lvl;
  this.isVerified = lvl === 3;
  if (lvl === 3 && !this.verifiedAt) this.verifiedAt = new Date();
};

// Helper — is the account currently suspended (and not yet expired)?
userSchema.methods.isSuspended = function () {
  return !!(this.suspendedUntil && this.suspendedUntil > new Date());
};

// Helper — does the user have an active Pro subscription right now?
userSchema.methods.isProActive = function () {
  return !!(
    this.subscription &&
    this.subscription.plan === "pro" &&
    this.subscription.status === "active" &&
    this.subscription.expiresAt &&
    this.subscription.expiresAt > new Date()
  );
};

module.exports = mongoose.model("User", userSchema);
