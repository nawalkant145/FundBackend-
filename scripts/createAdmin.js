                                 
         
                                                                             
require("dotenv").config();
const path = require("path");
process.chdir(path.join(__dirname, ".."));

const mongoose = require("mongoose");
const User = require("../src/modules/user/user.model");

const [, , email, password, name = "Admin"] = process.argv;

if (!email || !password) {
  console.error("Usage: node scripts/createAdmin.js <email> <password> [name]");
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    let user = await User.findOne({ email });
    if (user) {
      user.role = "admin";
      user.password = password;
      user.isEmailVerified = true;
      user.isPhoneVerified = true;
      user.verificationLevel = 3;
      user.isVerified = true;
      await user.save();
      console.log(`✅ Existing user upgraded to admin: ${email}`);
    } else {
      user = await User.create({
        name,
        email,
        password,
        role: "admin",
        isEmailVerified: true,
        isPhoneVerified: true,
        verificationLevel: 3,
        isVerified: true,
      });
      console.log(`✅ Admin created: ${email}`);
    }
    console.log("   ID:", user._id.toString());
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
})();
