const mongoose = require("mongoose");
const bcrypt = (() => {
  try {
    return require("bcrypt");
  } catch {
    return require("bcryptjs");
  }
})();

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
      set: function (v) {
        if (!v) return "";
        const normalized = require("../auth/auth.validation").normalizePhone(v, this.country);
        return normalized || v;
      },
      validate: {
        validator: function (v) {
          if (!v) return true;                      
          return require("../auth/auth.validation").isValidPhone(v, this.country);
        },
        message: "Please enter a valid phone number for the selected country.",
      },
    },
    country: { type: String, default: "" },
    bio: { type: String, default: "" },

                                                                                                                         
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    identityVerified: { type: Boolean, default: false, index: true },
    verificationLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      index: true,
    },
    isVerified: { type: Boolean, default: false },                              
    verifiedBadge: { type: Boolean, default: false },                                           
    verifiedAt: { type: Date },

                                           
    isBusinessVerified: { type: Boolean, default: false, index: true },
    isOrganizationVerified: { type: Boolean, default: false, index: true },
    isInvestorProfileVerified: { type: Boolean, default: false, index: true },
    dueDiligenceStatus: {
      type: String,
      enum: ["none", "in_progress", "completed"],
      default: "none",
      index: true,
    },

                                   
    kycStatus: {
      type: String,
      enum: ["none", "pending", "under_review", "approved", "rejected", "resubmitted", "info_requested", "digilocker_pending", "manual_review"],
      default: "none",
      index: true,
    },
    companyVerificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },
    investmentVerificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
      index: true,
    },

                    
    emailOtpHash: { type: String, select: false },
    emailOtpExpires: { type: Date, select: false },
    phoneOtpHash: { type: String, select: false },
    phoneOtpExpires: { type: Date, select: false },

                     
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

                     
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
    profileCompleteness: { type: Number, default: 20 },
    totalPitchViews: { type: Number, default: 0 },
    activePitchId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" },
    openToConnect: { type: Boolean, default: true },

                      
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

                                        
    documents: {
      referenceId: { type: String, default: "" },
      panCard: { type: String, default: "" },
      aadhar: { type: String, default: "" },
      businessReg: { type: String, default: "" },
      status: {
        type: String,
        enum: ["none", "pending", "under_review", "approved", "rejected", "resubmitted", "info_requested"],
        default: "none",
      },
      rejectionReason: { type: String, default: "" },
      submittedAt: { type: Date },
      reviewedAt: { type: Date },
    },

                 
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

                    
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },

                                                                     
    notificationPrefs: {
      type: Object,
      default: {},
    },
                                       
    privacyPrefs: {
      type: Object,
      default: {},
    },

                                
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
                                               
    freeChatsUsedThisMonth: { type: Number, default: 0 },
    chatQuotaResetAt: { type: Date },

           
    refreshToken: { type: String, select: false },
    fcmToken: { type: String, default: "" },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

             
    lastSeen: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },

                                        
    lastLoginIp: { type: String, default: "" },
    lastLoginUserAgent: { type: String, default: "" },
    lastLoginAt: { type: Date },

                                          
    suspendedUntil: { type: Date, default: null },
    suspensionReason: { type: String, default: "" },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
                                                                              
                                                                            
                                                                                
  const BCRYPT_HASH_RE = /^\$2[ayb]\$\d{2}\$.{53}$/;
  if (BCRYPT_HASH_RE.test(this.password)) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});


                                                                                                                    
userSchema.virtual("isEmailVerified")
  .get(function () { return !!this.emailVerified; })
  .set(function (val) { this.emailVerified = !!val; });

userSchema.virtual("isPhoneVerified")
  .get(function () { return !!this.phoneVerified; })
  .set(function (val) { this.phoneVerified = !!val; });

userSchema.virtual("isIdentityVerified")
  .get(function () { return !!this.identityVerified; })
  .set(function (val) { this.identityVerified = !!val; });

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject({ virtuals: true });
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

                                                                                 
  obj.emailVerified = !!(this.emailVerified);
  obj.phoneVerified = !!(this.phoneVerified);
  obj.identityVerified = !!(this.identityVerified);
  obj.isEmailVerified = obj.emailVerified;
  obj.isPhoneVerified = obj.phoneVerified;
  obj.isIdentityVerified = obj.identityVerified;
  obj.verificationLevel = this.verificationLevel || 0;

  return obj;
};

                                                                           
userSchema.methods.recomputeVerificationLevel = function () {
  let lvl = 1;                                                       
  
                                    
  if (this.kycStatus === "approved" || this.documents?.status === "approved" || this.identityVerified) {
    lvl = 2;
    this.identityVerified = true;
    this.verifiedBadge = true;
    this.isVerified = true;
    if (!this.verifiedAt) this.verifiedAt = new Date();
  } else {
    this.identityVerified = false;
    this.verifiedBadge = false;
    this.isVerified = false;
  }

                                           
  if (this.role === "founder") {
    if (this.companyVerificationStatus === "approved" || this.isBusinessVerified) {
      this.isBusinessVerified = true;
      lvl = Math.max(lvl, 3);
    } else {
      this.isBusinessVerified = false;
    }
  }

                                                                        
  if (this.role === "investor") {
    if (this.investmentVerificationStatus === "approved" || this.isInvestorProfileVerified) {
      this.isInvestorProfileVerified = true;
      this.isOrganizationVerified = true;
      lvl = Math.max(lvl, 4);
    } else {
      this.isInvestorProfileVerified = false;
      this.isOrganizationVerified = false;
    }
  }

                                                               
  if (this.riskLevel === "critical" || this.riskLevel === "high") {
    lvl = 5;
  }

  this.verificationLevel = lvl;
  this.calculateProfileCompleteness();
};

userSchema.methods.calculateProfileCompleteness = function () {
  let score = 0;
  if (this.emailVerified) score += 15;
  if (this.phoneVerified) score += 15;
  if (this.name && this.username) score += 15;
  if (this.avatar) score += 10;
  if (this.bio) score += 5;

  if (this.kycStatus === "approved" || this.documents?.status === "approved" || this.identityVerified) {
    score += 20;
  }

  if (this.role === "founder") {
    if (this.companyName) score += 10;
    if (this.companyVerificationStatus === "approved") score += 10;
  } else if (this.role === "investor") {
    if (this.investorType) score += 10;
    if (this.investmentVerificationStatus === "approved") score += 10;
  }

  this.profileCompleteness = Math.min(100, score);
  return this.profileCompleteness;
};

                                                                     
userSchema.methods.isSuspended = function () {
  return !!(this.suspendedUntil && this.suspendedUntil > new Date());
};

                                                                    
userSchema.methods.isProActive = function () {
  return !!(
    this.subscription &&
    this.subscription.plan === "pro" &&
    this.subscription.status === "active" &&
    this.subscription.expiresAt &&
    this.subscription.expiresAt > new Date()
  );
};

userSchema.pre("validate", function (next) {
  if (this.phone) {
    const { normalizePhone } = require("../auth/auth.validation");
    const normalized = normalizePhone(this.phone, this.country);
    if (normalized) this.phone = normalized;
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
