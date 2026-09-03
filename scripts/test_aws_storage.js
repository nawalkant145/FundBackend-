require("dotenv").config();
const {
  initialize,
  getStorageStatus,
  isCloudStorageEnabled,
  getPresignedUrl,
  s3UrlToKey,
} = require("../src/config/aws");

console.log("=== Testing Pure AWS S3 Storage Module ===");

                            
const initialized = initialize();
console.log("Initialization result:", initialized);

                          
const status = getStorageStatus();
console.log("Storage Status:", JSON.stringify(status, null, 2));

                                                         
console.log("isCloudStorageEnabled():", isCloudStorageEnabled());

const sampleUrl = "https://expglofund.s3.ap-south-2.amazonaws.com/uploads/test.jpg";
console.log("s3UrlToKey test:", s3UrlToKey(sampleUrl));

if (initialized) {
  getPresignedUrl("uploads/test.jpg", 600)
    .then((url) => {
      console.log("✅ Generated S3 Presigned URL:");
      console.log(url);
    })
    .catch((err) => {
      console.error("❌ Presigned URL test failed:", err.message);
    });
} else {
  console.log("ℹ️  S3 Storage is currently disabled (missing AWS_S3_BUCKET or AWS_REGION).");
}
