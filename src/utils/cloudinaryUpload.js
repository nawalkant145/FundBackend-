const fs = require("fs");
const cloudinary = require("../config/cloudinary");
const ApiError = require("./ApiError");

const cleanupTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn("⚠️  Failed to delete temp file:", filePath);
    }
  }
};

const path = require("path");

const uploadToCloudinary = async (filePath, options = {}) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    const basename = path.basename(filePath);
    return {
      url: `/uploads/${basename}`,
      publicId: basename,
    };
  }
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
      ...options,
    });
    cleanupTempFile(filePath);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (err) {
    console.warn("⚠️ Cloudinary upload error, using local fallback:", err.message);
    const basename = path.basename(filePath);
    return {
      url: `/uploads/${basename}`,
      publicId: basename,
    };
  }
};

const uploadVideoToCloudinary = async (filePath) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    const basename = path.basename(filePath);
    return {
      url: `/uploads/${basename}`,
      publicId: basename,
    };
  }
  try {
    const result = await cloudinary.uploader.upload_large(filePath, {
      resource_type: "video",
      folder: "pitches",
      chunk_size: 6000000, // 6MB chunked streaming for maximum upload throughput
      eager: [{ streaming_profile: "hd", format: "m3u8" }],
      eager_async: true,
    });
    cleanupTempFile(filePath);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (err) {
    console.warn("⚠️ Cloudinary video upload error, using local fallback:", err.message);
    const basename = path.basename(filePath);
    return {
      url: `/uploads/${basename}`,
      publicId: basename,
    };
  }
};

const uploadImageToCloudinary = async (filePath, folder = "images") => {
  return uploadToCloudinary(filePath, {
    resource_type: "image",
    folder,
    transformation: [{ quality: "auto:good", fetch_format: "auto" }],
  });
};

const uploadDocumentToCloudinary = async (filePath, folder = "documents") => {
  return uploadToCloudinary(filePath, {
    resource_type: "auto",
    folder,
  });
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (err) {
    console.warn(
      `⚠️  Cloudinary delete failed for ${publicId}: ${err.message}`,
    );
  }
};

module.exports = {
  uploadToCloudinary,
  uploadVideoToCloudinary,
  uploadImageToCloudinary,
  uploadDocumentToCloudinary,
  deleteFromCloudinary,
};
