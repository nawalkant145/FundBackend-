const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const fundingService = require("./funding.service");

const getFundingImpact = asyncHandler(async (req, res) => {
  const data = await fundingService.getImpactSummary();
  return res.json(new ApiResponse(200, data, "Funding impact summary retrieved successfully"));
});

const listFundingRecords = asyncHandler(async (req, res) => {
  const data = await fundingService.listAllRecords();
  return res.json(new ApiResponse(200, data, "Funding records retrieved successfully"));
});

const createMonthlyFunding = asyncHandler(async (req, res) => {
  const record = await fundingService.createMonthlyFunding(req.body, req.user._id);
  return res.status(201).json(new ApiResponse(201, record, "Monthly funding record created successfully"));
});

const updateMonthlyFunding = asyncHandler(async (req, res) => {
  const record = await fundingService.updateMonthlyFunding(req.params.id, req.body, req.user._id);
  return res.json(new ApiResponse(200, record, "Monthly funding record updated successfully"));
});

const deleteMonthlyFunding = asyncHandler(async (req, res) => {
  const record = await fundingService.deleteMonthlyFunding(req.params.id);
  return res.json(new ApiResponse(200, record, "Monthly funding record deleted successfully"));
});

module.exports = {
  getFundingImpact,
  listFundingRecords,
  createMonthlyFunding,
  updateMonthlyFunding,
  deleteMonthlyFunding,
};
