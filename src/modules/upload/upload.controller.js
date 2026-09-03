const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const { generateUploadPresignedUrl } = require("../../config/aws");

/**
 * Controller to generate an S3 Presigned PUT URL for direct frontend uploads
 */
const getUploadPresignedUrl = asyncHandler(async (req, res) => {
  const { uploadType, fileName, contentType } = req.body;

  if (!uploadType || !fileName || !contentType) {
    throw new ApiError(400, "uploadType, fileName, and contentType are required");
  }

  const result = await generateUploadPresignedUrl({
    uploadType,
    fileName,
    contentType,
    user: req.user,
  });

  res.status(200).json(
    new ApiResponse(200, result, "S3 Presigned upload URL generated successfully")
  );
});

module.exports = {
  getUploadPresignedUrl,
};
