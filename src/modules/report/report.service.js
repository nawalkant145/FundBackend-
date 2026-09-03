const Report = require("./report.model");
const Video = require("../video/video.model");
const ApiError = require("../../utils/ApiError");

const REPORT_THRESHOLD = 5;                                           

const createReport = async (
  reportedBy,
  { reportedUser, reportedVideo, type, description },
) => {
  if (!reportedUser && !reportedVideo) {
    throw new ApiError(400, "reportedUser or reportedVideo required");
  }
  if (!type) throw new ApiError(400, "type required");

  const report = await Report.create({
    reportedBy,
    reportedUser,
    reportedVideo,
    type,
    description,
  });

  if (reportedVideo) {
    const video = await Video.findById(reportedVideo);
    if (video) {
      video.reportCount = (video.reportCount || 0) + 1;
      if (video.reportCount >= REPORT_THRESHOLD && video.status === "active") {
        video.status = "paused";
      }
      await video.save();
    }
  }

  return report;
};

const myReports = async (userId) => {
  return Report.find({ reportedBy: userId }).sort({ createdAt: -1 });
};

module.exports = { createReport, myReports };
