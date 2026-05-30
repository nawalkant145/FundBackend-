// Phone OTP via MSG91. Falls back to console log in dev.
const axios = require("axios");

const sendSms = async ({ phone, otp, message }) => {
  if (!process.env.MSG91_AUTH_KEY) {
    console.log("📱 [DEV] SMS skipped — no MSG91_AUTH_KEY");
    console.log(`    Phone: ${phone} | OTP: ${otp}`);
    return { id: "dev-mock" };
  }

  // MSG91 OTP API
  try {
    const url = "https://control.msg91.com/api/v5/otp";
    const res = await axios.post(
      url,
      {
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile: phone.replace(/\D/g, ""),
        otp,
        ...(message ? { message } : {}),
      },
      {
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );
    return res.data;
  } catch (err) {
    console.error("❌ MSG91 send failed:", err.response?.data || err.message);
    throw new Error("Failed to send OTP SMS");
  }
};

module.exports = { sendSms };
