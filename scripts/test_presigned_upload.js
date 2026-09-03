require("dotenv").config();
const { initialize, generateUploadPresignedUrl } = require("../src/config/aws");

console.log("=== Testing Presigned PUT Upload URL Generation ===");

const initialized = initialize();
console.log("Storage initialized:", initialized);

async function testPresignedUpload() {
  if (!initialized) {
    console.log("AWS S3 is not initialized. Test skipped.");
    return;
  }

  try {
    const result = await generateUploadPresignedUrl({
      uploadType: "kyc",
      fileName: "passport-front.png",
      contentType: "image/png",
    });

    console.log("✅ Presigned PUT Upload URL generated successfully:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("❌ Failed to generate presigned upload URL:", err.message);
  }
}

testPresignedUpload();
