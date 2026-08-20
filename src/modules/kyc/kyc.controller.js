const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const kycService = require("./kyc.service");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

const getVerificationStatus = asyncHandler(async (req, res) => {
  const status = await kycService.getVerificationStatus(req.user._id);
  res.json(new ApiResponse(200, status, "Verification status fetched"));
});

const submitPersonalKyc = asyncHandler(async (req, res) => {
  const kyc = await kycService.submitPersonalKyc(req.user._id, req.body);
  res.status(201).json(new ApiResponse(201, kyc, "Personal KYC submitted for review"));
});

const submitCompanyKyc = asyncHandler(async (req, res) => {
  const company = await kycService.submitCompanyKyc(req.user._id, req.body);
  res.status(201).json(new ApiResponse(201, company, "Company verification submitted for review"));
});

const submitInvestmentKyc = asyncHandler(async (req, res) => {
  const investorKyc = await kycService.submitInvestmentKyc(req.user._id, req.body);
  res.status(201).json(new ApiResponse(201, investorKyc, "Investment transaction KYC submitted for review"));
});

const resubmitPersonalKyc = asyncHandler(async (req, res) => {
  const kyc = await kycService.resubmitPersonalKyc(req.user._id, req.body);
  res.status(200).json(new ApiResponse(200, kyc, "Personal KYC resubmitted for review"));
});

const getKycDetails = asyncHandler(async (req, res) => {
  const kyc = await kycService.getKycById(req.params.id);
  res.json(new ApiResponse(200, kyc, "KYC details fetched"));
});

// --- DigiLocker handlers ------------------------------------------------------

// Authenticated post-account flow: user is already logged in
// Pre-account signup flow: signupSessionId passed as ?signupSessionId=<id> query param (no auth)
const authorizeDigilocker = asyncHandler(async (req, res) => {
  /* === PRE-ACCOUNT BRANCH (Commented out — uncomment when mandatory pre-account KYC is enabled) ===
  const signupSessionId = req.query.signupSessionId || null;
  if (signupSessionId) {
    const { redirectUrl } = await kycService.initiateDigilockerVerification(null, { signupSessionId });
    return res.status(200).json(new ApiResponse(200, { redirectUrl }, "DigiLocker authorization URL generated"));
  }
  ================================================================================================ */
  const { redirectUrl } = await kycService.initiateDigilockerVerification(req.user._id);
  res.status(200).json(new ApiResponse(200, { redirectUrl }, "DigiLocker authorization URL generated"));
});

const digilockerCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const result = await kycService.handleDigilockerCallback({ code, state });

  const frontendBase = process.env.FRONTEND_BASE_URL || "/";

  /* === PRE-ACCOUNT CALLBACK BRANCH (Commented out — uncomment when mandatory pre-account KYC is enabled) ===
  if (result.signupSessionId !== undefined || (result.status === "approved" && result.accessToken)) {
    if (result.status === "approved" && result.accessToken && result.refreshToken) {
      res.cookie("accessToken", result.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
      res.cookie("refreshToken", result.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
      return res.redirect(`${frontendBase}/kyc?digilocker=approved&signup=1`);
    }
    return res.redirect(`${frontendBase}/kyc?digilocker=failed&signup=1`);
  }
  ========================================================================================================== */

  // Post-account flow — existing user
  res.redirect(`${frontendBase}/kyc?digilocker=${result.status}`);
});


const getDigilockerStatus = asyncHandler(async (req, res) => {
  const status = await kycService.getDigilockerStatus(req.user._id);
  res.json(new ApiResponse(200, status, "DigiLocker verification status fetched"));
});

const digilockerFallback = asyncHandler(async (req, res) => {
  const result = await kycService.fallbackToManual(req.user._id);
  res.json(new ApiResponse(200, result, "Switched to manual document upload"));
});

module.exports = {
  getVerificationStatus,
  submitPersonalKyc,
  resubmitPersonalKyc,
  getKycDetails,
  submitCompanyKyc,
  submitInvestmentKyc,
  authorizeDigilocker,
  digilockerCallback,
  getDigilockerStatus,
  digilockerFallback,
};