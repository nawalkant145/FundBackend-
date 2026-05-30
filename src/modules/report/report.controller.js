const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const reportService = require("./report.service");

const create = asyncHandler(async (req, res) => {
  const r = await reportService.createReport(req.user._id, req.body);
  res.status(201).json(new ApiResponse(201, { report: r }, "Report submitted"));
});

const myReports = asyncHandler(async (req, res) => {
  const reports = await reportService.myReports(req.user._id);
  res.status(200).json(new ApiResponse(200, { reports }, "Reports"));
});

module.exports = { create, myReports };
