const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl: getS3PresignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const path = require("path");
const ApiError = require("../utils/ApiError");

let s3Client = null;
let isStorageInitialized = false;
let initializationError = null;

/**
 * Helper to clean up local temp files created by Multer
 */
const cleanupTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn("⚠️ [AWS Storage] Failed to delete temp file:", filePath, e.message);
    }
  }
};

/**
 * Normalizes and formats the S3 Object URL
 * Format: https://{bucket-name}.s3.{region}.amazonaws.com/{s3Key}
 */
const formatS3Url = (bucket, region, s3Key) => {
  const cleanKey = s3Key.startsWith("/") ? s3Key.slice(1) : s3Key;
  return `https://${bucket}.s3.${region}.amazonaws.com/${cleanKey}`;
};

/**
 * Extracts s3Key from full S3 URL, legacy CloudFront URL, or returns raw s3Key
 */
const s3UrlToKey = (urlOrKey) => {
  if (!urlOrKey || typeof urlOrKey !== "string") return "";
  if (!urlOrKey.startsWith("http://") && !urlOrKey.startsWith("https://")) {
    return urlOrKey.startsWith("/") ? urlOrKey.slice(1) : urlOrKey;
  }
  try {
    const parsedUrl = new URL(urlOrKey);
    const pathname = parsedUrl.pathname;
    return pathname.startsWith("/") ? pathname.slice(1) : pathname;
  } catch (err) {
    return urlOrKey;
  }
};

/**
 * Initializes the AWS S3 client with credential flexibility (Env variables or EC2 IAM Role)
 */
const initialize = () => {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  const missingVars = [];
  if (!bucket) missingVars.push("AWS_S3_BUCKET");
  if (!region) missingVars.push("AWS_REGION");

  if (missingVars.length > 0) {
    isStorageInitialized = false;
    initializationError = `Missing configuration: ${missingVars.join(", ")}`;
    console.warn(`⚠️ [AWS Storage] S3 storage DISABLED - ${initializationError}`);
    return false;
  }

  try {
    // If access key & secret are provided, use explicit credentials.
    // Otherwise, allow AWS SDK to automatically load EC2 / IAM Role credentials.
    const s3Config = { region };
    if (accessKeyId && secretAccessKey) {
      s3Config.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    s3Client = new S3Client(s3Config);
    isStorageInitialized = true;
    initializationError = null;

    console.log(`✅ [AWS Storage] S3 storage ENABLED (Bucket: ${bucket}, Region: ${region})`);
    return true;
  } catch (err) {
    isStorageInitialized = false;
    initializationError = err.message;
    console.error("❌ [AWS Storage] S3 storage DISABLED - Initialization failed:", err.message);
    return false;
  }
};

/**
 * Returns boolean state of S3 storage availability
 */
const isCloudStorageEnabled = () => {
  return isStorageInitialized;
};

/**
 * Returns current health status of AWS S3 storage
 */
const getStorageStatus = () => {
  if (!isStorageInitialized) {
    return {
      enabled: false,
      bucket: process.env.AWS_S3_BUCKET || null,
      region: process.env.AWS_REGION || null,
      error: initializationError,
    };
  }

  return {
    enabled: true,
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION,
  };
};

/**
 * Generates an S3 Presigned URL for temporary access to private S3 objects
 */
const getPresignedUrl = async (s3Key, expiresInSeconds = 3600) => {
  if (!isStorageInitialized) {
    throw new ApiError(500, "AWS S3 Storage service is not configured");
  }

  const cleanKey = s3UrlToKey(s3Key);
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: cleanKey,
  });

  try {
    const signedUrl = await getS3PresignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });
    return signedUrl;
  } catch (err) {
    console.error("❌ [AWS Storage] Failed to generate S3 presigned URL:", err.message);
    throw new ApiError(500, `S3 presigned URL generation failed: ${err.message}`);
  }
};

const crypto = require("crypto");

const MIME_EXTENSION_MAP = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
};

const UPLOAD_CONFIG = {
  kyc: {
    folder: "identity",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    isPrivate: true,
  },
  avatar: {
    folder: "avatars",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    isPrivate: false,
  },
  company: {
    folder: "company",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxSizeBytes: 15 * 1024 * 1024, // 15MB
    isPrivate: false,
    requiredRoles: ["founder", "admin"],
  },
  document: {
    folder: "documents",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxSizeBytes: 15 * 1024 * 1024, // 15MB
    isPrivate: false,
  },
  pitchDeck: {
    folder: "pitch-decks",
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    isPrivate: true,
    requiredRoles: ["founder", "admin"],
  },
  courseMedia: {
    folder: "courses",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "application/pdf"],
    maxSizeBytes: 200 * 1024 * 1024, // 200MB
    isPrivate: false,
    requiredRoles: ["admin"],
  },
  chat: {
    folder: "chats",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "video/mp4",
      "audio/mpeg",
    ],
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    isPrivate: false,
  },
};

/**
 * Generates an S3 Presigned PUT URL for direct frontend-to-S3 file uploads
 */
const generateUploadPresignedUrl = async ({
  uploadType,
  fileName,
  contentType,
  user = null,
}) => {
  if (!isStorageInitialized) {
    throw new ApiError(500, "AWS S3 Storage service is not configured");
  }

  if (!uploadType || !fileName || !contentType) {
    throw new ApiError(400, "uploadType, fileName, and contentType are required");
  }

  const config = UPLOAD_CONFIG[uploadType];
  if (!config) {
    throw new ApiError(
      400,
      `Invalid uploadType '${uploadType}'. Allowed types: ${Object.keys(UPLOAD_CONFIG).join(", ")}`
    );
  }

  // Authorize User Role if required
  if (config.requiredRoles && config.requiredRoles.length > 0) {
    const userRole = user?.role || "user";
    if (!config.requiredRoles.includes(userRole)) {
      throw new ApiError(403, `User role '${userRole}' is not authorized to upload type '${uploadType}'`);
    }
  }

  // Validate ContentType MIME type
  const cleanContentType = String(contentType).toLowerCase().trim();
  if (!config.allowedMimeTypes.includes(cleanContentType)) {
    throw new ApiError(
      400,
      `MIME type '${contentType}' not allowed for '${uploadType}'. Allowed: ${config.allowedMimeTypes.join(", ")}`
    );
  }

  // Validate Extension matches ContentType strictly
  const ext = path.extname(fileName).toLowerCase();
  const allowedExtensions = MIME_EXTENSION_MAP[cleanContentType];
  if (!ext || !allowedExtensions || !allowedExtensions.includes(ext)) {
    throw new ApiError(
      400,
      `File extension '${ext}' does not match MIME type '${cleanContentType}'. Allowed extensions for '${cleanContentType}': ${allowedExtensions ? allowedExtensions.join(", ") : "none"}`
    );
  }

  // Generate Unique S3 Key using crypto.randomUUID()
  const userIdStr = user?._id ? user._id.toString() : "public";
  const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueKey = `uploads/${config.folder}/${userIdStr}/${crypto.randomUUID()}-${baseName}${ext}`;

  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const expiresInSeconds = 900; // Fixed 15 minutes security expiry

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: uniqueKey,
    ContentType: cleanContentType,
  });

  try {
    const uploadUrl = await getS3PresignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      uploadUrl,
      key: uniqueKey,
      expiresIn: expiresInSeconds,
      maxSizeBytes: config.maxSizeBytes,
      isPrivate: config.isPrivate,
    };
  } catch (err) {
    console.error("❌ [AWS Storage] Failed to generate presigned upload URL:", err.message);
    throw new ApiError(500, `Presigned upload URL generation failed: ${err.message}`);
  }
};

/**
 * Verifies that an object exists in S3 and validates key ownership / folder prefix / actual ContentType / max size
 */
const verifyS3Object = async (s3Key, expectedUploadType = null, userId = null) => {
  if (!isStorageInitialized) {
    throw new ApiError(500, "AWS S3 Storage service is not configured");
  }

  if (!s3Key || typeof s3Key !== "string") {
    throw new ApiError(400, "s3Key is required");
  }

  const cleanKey = s3UrlToKey(s3Key);

  if (!cleanKey.startsWith("uploads/")) {
    console.error("❌ [verifyS3Object] Invalid S3 key path prefix:", {
      rawInput: s3Key,
      extractedCleanKey: cleanKey,
      expectedPrefix: "uploads/",
    });
    throw new ApiError(
      403,
      `Access denied: Invalid S3 key path prefix. Received key '${cleanKey}' (must start with 'uploads/'). Make sure to submit the 'key' returned by /api/v1/upload/presigned-url.`
    );
  }

  if (expectedUploadType && UPLOAD_CONFIG[expectedUploadType]) {
    const expectedFolder = UPLOAD_CONFIG[expectedUploadType].folder;
    if (!cleanKey.startsWith(`uploads/${expectedFolder}/`)) {
      throw new ApiError(
        403,
        `S3 key mismatch: Expected uploadType '${expectedUploadType}' in folder '${expectedFolder}'`
      );
    }
  }

  // Strict ownership validation via exact expected prefix uploads/{folder}/{userId}/
  if (userId && expectedUploadType && UPLOAD_CONFIG[expectedUploadType]) {
    const expectedFolder = UPLOAD_CONFIG[expectedUploadType].folder;
    const userIdStr = userId.toString();
    const expectedPrefix = `uploads/${expectedFolder}/${userIdStr}/`;
    if (!cleanKey.startsWith(expectedPrefix)) {
      throw new ApiError(
        403,
        "Access denied: You do not own this S3 object or key structure is invalid"
      );
    }
  } else if (userId) {
    const userIdStr = userId.toString();
    const parts = cleanKey.split("/");
    if (parts.length >= 3 && parts[2] !== userIdStr) {
      throw new ApiError(403, "Access denied: You do not own this S3 object");
    }
  }

  const command = new HeadObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: cleanKey,
  });

  try {
    const headData = await s3Client.send(command);

    // Validate actual S3 ContentType and ContentLength against upload configuration
    if (expectedUploadType && UPLOAD_CONFIG[expectedUploadType]) {
      const config = UPLOAD_CONFIG[expectedUploadType];
      const actualContentType = String(headData.ContentType || "").toLowerCase().trim();

      if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(actualContentType)) {
        throw new ApiError(
          403,
          `Uploaded file has an invalid content type '${actualContentType}'. Expected: ${config.allowedMimeTypes.join(", ")}`
        );
      }

      if (config.maxSizeBytes && headData.ContentLength > config.maxSizeBytes) {
        throw new ApiError(
          400,
          `Uploaded file size (${headData.ContentLength} bytes) exceeds maximum limit of ${config.maxSizeBytes} bytes`
        );
      }
    }

    return {
      verified: true,
      key: cleanKey,
      contentLength: headData.ContentLength,
      contentType: headData.ContentType,
      lastModified: headData.LastModified,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error(`❌ [AWS Storage] S3 object verification failed for key ${cleanKey}:`, err.message);
    throw new ApiError(404, `S3 object does not exist or has expired. Please upload the file first.`);
  }
};

/**
 * Uploads local Multer temporary file to AWS S3 bucket
 */
const uploadToS3 = async (filePath, s3Key, isPrivate = false, options = {}) => {
  if (!isStorageInitialized) {
    console.warn("⚠️ [AWS Storage] S3 service not initialized. Using local fallback.");
    const basename = path.basename(filePath);
    return {
      url: `/uploads/${basename}`,
      key: basename,
      isPrivate: false,
    };
  }

  if (!fs.existsSync(filePath)) {
    throw new ApiError(400, `Local upload file not found at path: ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath);
  const cleanKey = s3Key || `uploads/${Date.now()}-${path.basename(filePath)}`;
  const formattedKey = cleanKey.startsWith("/") ? cleanKey.slice(1) : cleanKey;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: formattedKey,
    Body: fileStream,
    ContentType: options.contentType || undefined,
  });

  try {
    await s3Client.send(command);
    cleanupTempFile(filePath);

    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;
    const publicUrl = formatS3Url(bucket, region, formattedKey);

    if (isPrivate) {
      const presignedUrl = await getPresignedUrl(formattedKey);
      return {
        url: presignedUrl,
        key: formattedKey,
        isPrivate: true,
      };
    }

    return {
      url: publicUrl,
      key: formattedKey,
      isPrivate: false,
    };
  } catch (err) {
    cleanupTempFile(filePath);
    console.error("❌ [AWS Storage] S3 upload failed:", err.message);
    throw new ApiError(500, `Failed to upload file to S3: ${err.message}`);
  }
};

/**
 * Deletes an object from AWS S3
 */
const deleteFromS3 = async (s3Key) => {
  if (!isStorageInitialized || !s3Key) {
    return;
  }

  const formattedKey = s3UrlToKey(s3Key);

  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: formattedKey,
  });

  try {
    await s3Client.send(command);
    console.log(`🗑️ [AWS Storage] Deleted from S3: ${formattedKey}`);
  } catch (err) {
    console.warn(`⚠️ [AWS Storage] Delete from S3 failed for key ${formattedKey}:`, err.message);
    throw new ApiError(500, `Delete from S3 failed: ${err.message}`);
  }
};

/**
 * Safe delete single object from S3 without throwing exceptions
 */
const safeDeleteFromS3 = async (s3Key) => {
  try {
    await deleteFromS3(s3Key);
  } catch (err) {
    console.warn(`⚠️ [AWS Storage] safeDeleteFromS3 caught error for ${s3Key}:`, err.message);
  }
};

/**
 * Safe delete multiple objects from S3
 */
const safeDeleteManyFromS3 = async (s3KeysArray = []) => {
  if (!Array.isArray(s3KeysArray) || s3KeysArray.length === 0) return;
  for (const keyOrUrl of s3KeysArray) {
    await safeDeleteFromS3(keyOrUrl);
  }
};

/**
 * Streams private object content from S3 bucket
 */
const streamFromS3 = async (s3Key) => {
  if (!isStorageInitialized) {
    throw new ApiError(500, "AWS S3 Storage service is not configured");
  }

  const formattedKey = s3UrlToKey(s3Key);

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: formattedKey,
  });

  try {
    const response = await s3Client.send(command);
    return {
      stream: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  } catch (err) {
    console.error(`❌ [AWS Storage] Failed to stream key ${formattedKey}:`, err.message);
    throw new ApiError(404, `File not found in S3: ${err.message}`);
  }
};

module.exports = {
  initialize,
  isCloudStorageEnabled,
  getStorageStatus,
  uploadToS3,
  deleteFromS3,
  safeDeleteFromS3,
  safeDeleteManyFromS3,
  streamFromS3,
  getPresignedUrl,
  getSignedUrl: getPresignedUrl,
  generateUploadPresignedUrl,
  verifyS3Object,
  UPLOAD_CONFIG,
  s3UrlToKey,
  cfUrlToS3Key: s3UrlToKey,
};
