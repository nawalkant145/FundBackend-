// Email sender via Gmail SMTP (Nodemailer) using App Password.
// Falls back to console log in dev when no credentials set.
const nodemailer = require("nodemailer");

let transporter = null;

const init = () => {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const from = `EXPGLO FUND <${process.env.GMAIL_USER || "noreply@expglofund.com"}>`;
  const transport = init();

  if (!transport) {
    console.log("📧 [DEV] Email skipped — no GMAIL credentials");
    console.log(`    To: ${to} | Subject: ${subject}`);
    if (text) console.log(`    Text: ${text}`);
    return { id: "dev-mock" };
  }

  try {
    const info = await transport.sendMail({ from, to, subject, html, text });
    console.log(`📧 Email sent to ${to} — messageId: ${info.messageId}`);
    return { id: info.messageId };
  } catch (err) {
    console.warn("⚠️  Gmail SMTP error:", err.message);
    return { id: null, error: err.message };
  }
};

const otpEmailHtml = (otp) => `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px">
    <h2 style="color:#0F4A2E">Your EXPGLO FUND verification code</h2>
    <p>Use the code below to verify your email. This code expires in 10 minutes.</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f4f4f4;padding:16px;text-align:center;border-radius:6px;margin:16px 0;color:#0F4A2E">
      ${otp}
    </div>
    <p style="color:#666;font-size:13px">If you didn't request this, you can ignore the email.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
    <p style="color:#999;font-size:11px;text-align:center">EXPGLO FUND — Fundraising in 60 seconds</p>
  </div>
`;

module.exports = { sendEmail, otpEmailHtml };
