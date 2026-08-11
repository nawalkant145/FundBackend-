const nodemailer = require("nodemailer");
const { Resend } = require("resend");

let resendInstance = null;

const getResend = () => {
  if (resendInstance) return resendInstance;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    resendInstance = new Resend(apiKey.trim());
    return resendInstance;
  }
  return null;
};

const getTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ""),
    },
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  const gUser = process.env.GMAIL_USER || "expglobusiness@gmail.com";

  // 1. Resend API fallback if RESEND_API_KEY is present
  const resend = getResend();
  if (resend) {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
      const data = await resend.emails.send({
        from: `EXPGLO FUND <${fromEmail}>`,
        to: [to],
        subject,
        html,
        text,
      });
      console.log(`📧 Email sent via Resend to ${to} — id: ${data?.id || "ok"}`);
      return { id: data?.id || "resend-ok", success: true };
    } catch (err) {
      console.error("⚠️ Resend API error:", err.message);
    }
  }

  // 2. Gmail SMTP transport
  const transport = getTransporter();
  if (!transport) {
    console.log("📧 [DEV] Email skipped — no GMAIL credentials set in .env");
    console.log(`    To: ${to} | Subject: ${subject}`);
    if (text) console.log(`    Text: ${text}`);
    return { id: "dev-mock", skipped: true };
  }

  try {
    const from = `EXPGLO FUND <${gUser.trim()}>`;
    const info = await transport.sendMail({
      from,
      to,
      replyTo: gUser.trim(),
      subject,
      html,
      text,
      headers: {
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "Auto-Submitted": "auto-generated",
        "X-Report-Abuse-To": gUser.trim(),
      },
    });
    console.log(`📧 Email sent to ${to} — messageId: ${info.messageId}`);
    return { id: info.messageId, success: true };
  } catch (err) {
    if (err.message.includes("535") || err.message.includes("BadCredentials")) {
      console.error(
        "❌ Gmail App Password rejected (535 BadCredentials). Please check GMAIL_APP_PASSWORD env var on Render."
      );
    } else {
      console.error("⚠️ Gmail SMTP error:", err.message);
    }
    return { id: "smtp-failed", success: false, error: err.message };
  }
};

const otpEmailHtml = (otp) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f9fafb;margin:0;padding:24px;color:#111827">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="color:#0F4A2E;font-size:22px;font-weight:700;margin:0 0 8px 0">EXPGLO FUND</h1>
        <p style="color:#4b5563;font-size:14px;margin:0">Verification Code</p>
      </div>
      <p style="font-size:15px;line-height:24px;color:#374151;margin-bottom:20px">Hello,</p>
      <p style="font-size:15px;line-height:24px;color:#374151;margin-bottom:24px">Please use the following 6-digit verification code to complete your request. This code will expire in <strong>10 minutes</strong>.</p>
      
      <div style="background-color:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
        <span style="font-family:monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#0F4A2E;display:inline-block">${otp}</span>
      </div>

      <p style="font-size:13px;line-height:20px;color:#6b7280;margin-bottom:24px">If you did not request this code, please ignore this email or contact support if you have concerns.</p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0" />
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0">© EXPGLO FUND. All rights reserved.</p>
    </div>
  </body>
  </html>
`;

module.exports = { sendEmail, otpEmailHtml };
