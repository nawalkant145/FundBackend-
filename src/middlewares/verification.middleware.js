const ApiError = require("../utils/ApiError");

const requireIdentityVerified = (req, res, next) => {
  const isVerified =
    req.user?.identityVerified ||
    (req.user?.verificationLevel || 0) >= 1 ||
    req.user?.kycStatus === "approved" ||
    req.user?.documents?.status === "approved";

  if (!isVerified) {
    return next(
      new ApiError(403, "Identity Verification required to access this feature.", {
        code: "IDENTITY_VERIFICATION_REQUIRED",
        requiredLevel: 1,
        currentLevel: req.user?.verificationLevel || 0,
        cta: "/kyc",
      })
    );
  }
  next();
};

const requireFounderVerified = (req, res, next) => {
  const isFounderVerified =
    req.user?.companyVerificationStatus === "approved" ||
    req.user?.isBusinessVerified === true ||
    (req.user?.verificationLevel || 0) >= 3;

  if (!isFounderVerified) {
    return next(
      new ApiError(403, "Level 3 Founder Verification required to publish startups or pitches.", {
        code: "FOUNDER_VERIFICATION_REQUIRED",
        requiredLevel: 3,
        currentLevel: req.user?.verificationLevel || 1,
        cta: "/kyc/company",
      })
    );
  }
  next();
};

const requireInvestorVerified = (req, res, next) => {
  const isInvestorVerified =
    req.user?.investmentVerificationStatus === "approved" ||
    req.user?.isInvestorProfileVerified === true ||
    (req.user?.verificationLevel || 0) >= 4;

  if (!isInvestorVerified) {
    return next(
      new ApiError(403, "Level 4 Investor Verification required to initiate investment deals.", {
        code: "INVESTOR_VERIFICATION_REQUIRED",
        requiredLevel: 4,
        currentLevel: req.user?.verificationLevel || 1,
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
