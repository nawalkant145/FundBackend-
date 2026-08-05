const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const kycService = require("./kyc.service");

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

module.exports = {
  getVerificationStatus,
  submitPersonalKyc,
  submitCompanyKyc,
  submitInvestmentKyc,
};
