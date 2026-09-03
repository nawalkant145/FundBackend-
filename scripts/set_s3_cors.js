require("dotenv").config();
const { PutBucketCorsCommand, S3Client } = require("@aws-sdk/client-s3");

async function setS3Cors() {
  const bucketName = process.env.AWS_S3_BUCKET || "expglofund";
  const region = process.env.AWS_REGION || "ap-south-1";

  console.log(`⚙️ Setting CORS configuration on S3 bucket: ${bucketName} (Region: ${region})`);

  const corsRules = [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
      AllowedOrigins: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3000,
    },
  ];

  try {
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: corsRules,
      },
    });

    await s3Client.send(command);
    console.log(`✅ Successfully updated CORS policy on AWS S3 Bucket '${bucketName}'! Direct browser PUT uploads are now allowed.`);
  } catch (err) {
    console.error("❌ Failed to set S3 CORS policy:", err);
  }
}

setS3Cors();
