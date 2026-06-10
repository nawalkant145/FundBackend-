// Email sender via Resend.com. Falls back to console log in dev when no key.
let resend = null;

const init = () => {
  if (!process.env.RESEND_API_KEY) return null;
  if (resend) return resend;
  const { Resend } = require("resend");
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const from =
    process.env.RESEND_FROM || "PitchConnect <onboarding@resend.dev>";
  const client = init();

  if (!client) {
    console.log("📧 [DEV] Email skipped — no RESEND_API_KEY");
    console.log(`    To: ${to} | Subject: ${subject}`);
    if (text) console.log(`    Text: ${text}`);
    return { id: "dev-mock" };
  }

  const result = await client.emails.send({ from, to, subject, html, text });
  if (result.error) {
    console.warn("⚠️  Resend API error:", result.error);
  }
  return result;
};

const otpEmailHtml = (otp) => `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px">
    <h2 style="color:#111">Your PitchConnect verification code</h2>
    <p>Use the code below to verify your email. This code expires in 10 minutes.</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f4f4f4;padding:16px;text-align:center;border-radius:6px;margin:16px 0">
      ${otp}
    </div>
    <p style="color:#666;font-size:13px">If you didn't request this, you can ignore the email.</p>
  </div>
`;

module.exports = { sendEmail, otpEmailHtml };
