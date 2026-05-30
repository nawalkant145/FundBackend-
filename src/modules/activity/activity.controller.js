const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const activityService = require("./activity.service");

const dashboard = asyncHandler(async (req, res) => {
  if (req.user.role === "founder") {
    const data = await activityService.founderActivity(req.user._id);
    return res.json(new ApiResponse(200, data, "Founder dashboard"));
  }
  if (req.user.role === "investor") {
    const data = await activityService.investorActivity(req.user._id);
    return res.json(new ApiResponse(200, data, "Investor dashboard"));
  }
  throw new ApiError(403, "Dashboard not available for this role");
});

module.exports = { dashboard };
