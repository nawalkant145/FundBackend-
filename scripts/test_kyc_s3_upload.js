require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { initialize, uploadToS3 } = require("../src/config/aws");

console.log("=== Testing Identity Verification S3 Upload Integration ===");

const isInitialized = initialize();
console.log("AWS Storage Initialized:", isInitialized);

async function testUpload() {
                                                  
  const tempDir = path.join(process.cwd(), "tmp", "uploads");
  fs.mkdirSync(tempDir, { recursive: true });
  const sampleFilePath = path.join(tempDir, `test-identity-${Date.now()}.png`);
  fs.writeFileSync(sampleFilePath, "DUMMY_IMAGE_CONTENT_FOR_TEST");

  console.log("📤 Identity file received:", {
    fileName: path.basename(sampleFilePath),
    filePath: sampleFilePath,
    mimetype: "image/png",
    size: fs.statSync(sampleFilePath).size,
  });

  const s3Key = `uploads/identity/front/${Date.now()}-test-identity.png`;
  console.log("☁️ Calling uploadToS3()...", { localPath: sampleFilePath, s3Key });

  try {
    const uploadResult = await uploadToS3(sampleFilePath, s3Key, false, {
      contentType: "image/png",
    });
    console.log("✅ S3 upload result:", uploadResult);

    if (uploadResult.url) {
      console.log("SUCCESS: Identity document successfully uploaded to S3!");
      console.log("S3 URL:", uploadResult.url);
      console.log("S3 Key:", uploadResult.key);
    }
  } catch (err) {
    console.error("❌ Identity S3 upload failed:", err);
  }
}

testUpload();
