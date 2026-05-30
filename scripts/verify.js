// Verifies every module file loads without syntax/require errors.
const path = require("path");
const projectRoot = path.join(__dirname, "..");
process.chdir(projectRoot);

process.env.MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test_secret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test_secret";

const resolve = (rel) => path.join(projectRoot, rel);

const targets = [
  "src/app.js",
  "src/socket/index.js",
  "src/socket/chat.socket.js",
  "src/socket/call.socket.js",
  "src/cron/index.js",
  "src/config/db.js",
  "src/config/redis.js",
  "src/config/cloudinary.js",
  "src/config/firebase.js",
  "src/middlewares/auth.middleware.js",
  "src/middlewares/role.middleware.js",
  "src/middlewares/upload.middleware.js",
  "src/middlewares/rateLimit.middleware.js",
  "src/middlewares/error.middleware.js",
  "src/utils/ApiError.js",
  "src/utils/ApiResponse.js",
  "src/utils/asyncHandler.js",
  "src/utils/generateToken.js",
  "src/utils/sendEmail.js",
  "src/utils/sendSms.js",
  "src/utils/otp.js",
  "src/utils/cloudinaryUpload.js",
  "src/modules/profileView/profileView.model.js",
  "src/modules/audit/audit.model.js",
  "src/modules/audit/audit.service.js",
  "src/modules/pitchDeckAccess/pitchDeckAccess.model.js",
];

const modules = [
  "auth",
  "user",
  "video",
  "comment",
  "chat",
  "call",
  "investment",
  "pitchDeckAccess",
  "notification",
  "report",
  "activity",
  "admin",
];

let failed = 0;
const ok = (n) => console.log("  OK ", n);
const fail = (n, e) => {
  console.log("  ERR", n, "—", e.message);
  failed++;
};

console.log("\nLoading core...");
for (const t of targets) {
  try {
    require(resolve(t));
    ok(t);
  } catch (e) {
    fail(t, e);
  }
}

console.log("\nLoading modules...");
for (const m of modules) {
  for (const layer of ["routes", "controller", "service"]) {
    const p = `src/modules/${m}/${m}.${layer}.js`;
    try {
      require(resolve(p));
      ok(p);
    } catch (e) {
      fail(p, e);
    }
  }
}

console.log();
if (failed === 0) {
  console.log("SUCCESS: All files load cleanly");
  process.exit(0);
} else {
  console.log(`FAILED: ${failed} file(s) failed to load`);
  process.exit(1);
}
