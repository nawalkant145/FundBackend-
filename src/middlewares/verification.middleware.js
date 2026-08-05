const ApiError = require("../utils/ApiError");

const requireIdentityVerified = (req, res, next) => {
  if (
    req.user.verificationLevel < 2 ||
    (req.user.kycStatus !== "approved" && req.user.documents?.status !== "approved")
  ) {
    return next(
      new ApiError(403, "Level 2 Identity Verification required to access this feature.", {
        code: "IDENTITY_VERIFICATION_REQUIRED",
        requiredLevel: 2,
        currentLevel: req.user.verificationLevel || 1,
        cta: "/kyc/identity",
      })
    );
  }
  next();
};

const requireFounderVerified = (req, res, next) => {
  if (
    req.user.verificationLevel < 3 ||
    req.user.companyVerificationStatus !== "approved"
  ) {
    return next(
      new ApiError(403, "Level 3 Founder Verification required to publish startups or pitches.", {
        code: "FOUNDER_VERIFICATION_REQUIRED",
        requiredLevel: 3,
        currentLevel: req.user.verificationLevel || 1,
        cta: "/kyc/company",
      })
    );
  }
  next();
};

const requireInvestorVerified = (req, res, next) => {
  if (
    req.user.verificationLevel < 4 ||
    req.user.investmentVerificationStatus !== "approved"
  ) {
    return next(
      new ApiError(403, "Level 4 Investor Verification required to initiate investment deals.", {
        code: "INVESTOR_VERIFICATION_REQUIRED",
        requiredLevel: 4,
        currentLevel: req.user.verificationLevel || 1,
        cta: "/kyc/investor",
      })
    );
  }
  next();
};

const requireLowRisk = (req, res, next) => {
  if (req.user.riskLevel === "critical" || req.user.isSuspended()) {
    return next(
      new ApiError(403, "Account restricted due to compliance risk review. Contact support.", {
        code: "ACCOUNT_RISK_RESTRICTED",
        requiredLevel: 5,
        riskLevel: req.user.riskLevel,
      })
    );
  }
  next();
};

module.exports = {
  requireIdentityVerified,
  requireFounderVerified,
  requireInvestorVerified,
  requireLowRisk,
};
