                                                                                                                                                                                                                                                                                                                                                                                                                                              
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../modules/user/user.model");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "expgloadmin@gmail.com")
  .toLowerCase()
  .trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_NAME = process.env.ADMIN_NAME || "EXPGLO Admin";
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "expgloadmin")
  .toLowerCase()
  .trim();

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("❌ MONGODB_URI is not set in .env");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    let user = await User.findOne({ email: ADMIN_EMAIL });

    if (user) {
                                               
      user.role = "admin";
      user.password = ADMIN_PASSWORD;                              
      user.isEmailVerified = true;
      user.isPhoneVerified = true;
      user.isVerified = true;
      user.verificationLevel = 3;
      user.isActive = true;
      user.isBanned = false;
      user.suspendedUntil = null;
      await user.save();
      console.log(`✅ Existing user promoted to admin: ${ADMIN_EMAIL}`);
    } else {
                                  
      let username = ADMIN_USERNAME;
      if (await User.findOne({ username })) {
        username = `${ADMIN_USERNAME}_${Date.now().toString().slice(-4)}`;
      }

      user = await User.create({
        name: ADMIN_NAME,
        username,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,                           
        role: "admin",
        isEmailVerified: true,
        isPhoneVerified: true,
        isVerified: true,
        verificationLevel: 3,
        isActive: true,
      });
      console.log(`✅ Admin created: ${ADMIN_EMAIL} (username: ${username})`);
    }

    console.log("\n──────────────────────────────");
    console.log("  Login with:");
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log("──────────────────────────────\n");
    console.log("⚠️  Change this password after first login.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to create admin:", err.message);
    process.exit(1);
  }
})();
