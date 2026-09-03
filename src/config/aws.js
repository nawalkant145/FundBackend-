const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
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
  s3UrlToKey,
  cfUrlToS3Key: s3UrlToKey,
};
