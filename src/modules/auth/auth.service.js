const crypto = require("crypto");
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../../utils/generateToken");
const { sendEmail, otpEmailHtml } = require("../../utils/sendEmail");
const { sendSms } = require("../../utils/sendSms");
const { generateOtp, hashOtp, compareOtp } = require("../../utils/otp");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const PASSWORD_RESET_EXPIRY_MS = 30 * 60 * 1000;

const hashRefresh = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const issueTokens = async (user, { save = true } = {}) => {
  const payload = { _id: user._id.toString(), role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  user.refreshToken = hashRefresh(refreshToken);                       
  if (save) {
    await user.save({ validateBeforeSave: false });
  }
  return { accessToken, refreshToken };
};

const registerUser = async ({
  name,
  username,
  email,
  password,
  role,
  phone,
  country,
  companyName,
  industry,
  fundingStage,
  website,
  linkedIn,
  investorType,
  investmentRange,
  preferredIndustries,
  preferredStages,
  investmentThesis,
                                                                        
                                                                             
                                                                    
  emailVerified = false,
}) => {
  email = email.toLowerCase().trim();
  username = (username || "").toLowerCase().trim();

                                                      
  try {
    const settingsService = require("../settings/settings.service");
    const settings = await settingsService.getSettings();
    if (settings.signupsEnabled === false) {
      throw new ApiError(403, "New signups are temporarily disabled.");
    }
  } catch (e) {
    if (e.statusCode === 403) throw e;
  }

                                                                
  if (await User.findOne({ email })) {
    throw new ApiError(409, "Email already registered", {
      field: "email",
      message: "This email is already in use",
    });
  }
  if (username && (await User.findOne({ username }))) {
    throw new ApiError(409, "Username taken", {
      field: "username",
      message: "This username is already taken",
    });
  }

  let normalizedPhone = "";
  if (phone) {
    const { normalizePhone } = require("./auth.validation");
    normalizedPhone = normalizePhone(phone, country) || phone.replace(/[\s\-()]/g, "");
    if (await User.findOne({ phone: normalizedPhone })) {
      throw new ApiError(409, "Phone already registered", {
        field: "phone",
        message: "This phone number is already in use",
      });
    }
  }

  const userData = {
    name,
    username,
    email,
    password,
    role,
    emailVerified: false,
    phoneVerified: false,
    identityVerified: false,
    verificationLevel: 0,
  };
  if (phone) userData.phone = normalizedPhone;
  if (country) userData.country = country;
  if (companyName) userData.companyName = companyName;
  if (industry) userData.industry = industry;
  if (fundingStage) userData.fundingStage = fundingStage;
  if (website) userData.website = website;
  if (linkedIn) userData.linkedIn = linkedIn;
  if (investorType) userData.investorType = investorType;
  if (investmentRange && (investmentRange.min || investmentRange.max))
    userData.investmentRange = investmentRange;
  if (preferredIndustries?.length)
    userData.preferredIndustries = preferredIndustries;
  if (preferredStages?.length) userData.preferredStages = preferredStages;
  if (investmentThesis) userData.investmentThesis = investmentThesis;

  const user = await User.create(userData);
  const tokens = await issueTokens(user);
  return { user: user.toSafeJSON(), ...tokens };
};

                                                             
const checkAvailability = async ({ username, email, phone, country }) => {
  const { isValidEmail, isValidPhone, normalizePhone } = require("./auth.validation");
  const result = {};
  if (username) {
    const u = username.toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
      throw new ApiError(400, "Username must be 3-20 characters (letters, numbers, underscore)");
    }
    result.username = (await User.findOne({ username: u }))
      ? "taken"
      : "available";
  }
  if (email) {
    const e = email.toLowerCase().trim();
    if (!isValidEmail(e)) {
      throw new ApiError(400, "Valid email address is required");
    }
    result.email = (await User.findOne({ email: e })) ? "taken" : "available";
  }
  if (phone) {
    const p = phone.trim();
    if (!isValidPhone(p, country)) {
      throw new ApiError(400, "Please enter a valid phone number for the selected country.");
    }
    const normalizedPhone = normalizePhone(p, country) || p.replace(/[\s\-()]/g, "");
    result.phone = (await User.findOne({ phone: normalizedPhone }))
      ? "taken"
      : "available";
  }
  return result;
};

const loginUser = async ({ identifier, email, password, role, clientInfo }) => {
  const tTotalStart = performance.now();
  const raw = (identifier || email || "").trim();
  let query;
  if (raw.includes("@")) {
    query = { email: raw.toLowerCase() };
  } else if (/^\+?\d[\d\s\-()\u00A0]{5,}$/.test(raw)) {
    const { normalizePhone } = require("./auth.validation");
    const normalizedPhone = normalizePhone(raw) || raw.replace(/[\s\-()\u00A0]/g, "");
    query = { phone: normalizedPhone };
  } else {
    query = { username: raw.toLowerCase() };
  }

  const tDbReadStart = performance.now();
  const user = await User.findOne(query).select("+password +refreshToken");
  const dbReadMs = performance.now() - tDbReadStart;

  if (!user) throw new ApiError(401, "Invalid credentials");
  if (user.isBanned) throw new ApiError(403, "Your account has been banned");
  if (user.suspendedUntil && user.suspendedUntil > new Date()) {
    const until = new Date(user.suspendedUntil).toLocaleString();
    throw new ApiError(
      403,
      `Your account is suspended until ${until}${user.suspensionReason ? `: ${user.suspensionReason}` : ""}`,
    );
  }
  if (!user.isActive) throw new ApiError(403, "Your account is inactive");

  if (user.lockUntil && user.lockUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockUntil.getTime() - Date.now()) / 60000,
    );
    throw new ApiError(429, `Account locked. Try again in ${minutesLeft} min.`);
  }

  const tPassStart = performance.now();
  const ok = await user.comparePassword(password);
  const passMs = performance.now() - tPassStart;

  if (!ok) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.loginAttempts = 0;
    }
    await user.save({ validateBeforeSave: false });
    throw new ApiError(401, "Invalid credentials");
  }

  if (role) {
    const targetRole = String(role).toLowerCase().trim();
    if (["founder", "investor", "admin"].includes(targetRole)) {
      if (user.role !== targetRole) {
        const requiredRoleName =
          targetRole === "founder"
            ? "Founder"
            : targetRole === "investor"
            ? "Investor"
            : "Admin";
        throw new ApiError(
          401,
          `Invalid credentials for ${requiredRoleName} login`,
        );
      }
    }
  }

  const tSaveStart = performance.now();
                                                                           
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastSeen = new Date();
  user.isOnline = true;
  if (clientInfo) {
    if (clientInfo.ip) user.lastLoginIp = clientInfo.ip;
    if (clientInfo.userAgent) user.lastLoginUserAgent = clientInfo.userAgent;
    user.lastLoginAt = new Date();
  }

  const tokens = await issueTokens(user, { save: false });
  await user.save({ validateBeforeSave: false });
  const saveMs = performance.now() - tSaveStart;

  const totalMs = performance.now() - tTotalStart;
  console.log(
    `⚡ [AUTH PROFILE] DB Read: ${dbReadMs.toFixed(1)}ms | Password Compare: ${passMs.toFixed(1)}ms | Token & DB Save: ${saveMs.toFixed(1)}ms | Total: ${totalMs.toFixed(1)}ms`
  );

  return { user: user.toSafeJSON(), ...tokens };
};

const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    isOnline: false,
    lastSeen: new Date(),
    $unset: { refreshToken: 1 },
  });
};

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) throw new ApiError(401, "Refresh token missing");
  const decoded = verifyRefreshToken(refreshToken);
  const user = await User.findById(decoded._id).select("+refreshToken");
  if (!user) throw new ApiError(401, "User not found");
  if (user.refreshToken !== hashRefresh(refreshToken)) {
    throw new ApiError(401, "Refresh token mismatch");
  }
  const tokens = await issueTokens(user);
  return { user: user.toSafeJSON(), ...tokens };
};

                                                  

                                                                                  
const sendPreRegisterOtp = async (email) => {
  if (!email) throw new ApiError(400, "Email required");
                                                                     
                                                                       
  email = email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "Email already registered");

  const otp = generateOtp();
  const hash = await hashOtp(otp);
  const expires = new Date(Date.now() + OTP_EXPIRY_MS);

                                                                        
  const { getClient } = require("../../config/redis");
  const redis = getClient();
  await redis.set(
    `preregister:${email}`,
    JSON.stringify({ otpHash: hash, expires: expires.toISOString() }),
    "EX",
    600,              
  );

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📧 PRE-REGISTER OTP for ${email}: ${otp}\n`);
  }

  try {
    await sendEmail({
      to: email,
      subject: "Your EXPGLO FUND verification code",
      html: otpEmailHtml(otp),
      text: `Your verification code: ${otp} (valid 10 min)`,
    });
  } catch (err) {
    console.error("Failed to send pre-register email:", err?.message || err);
  }

  return {
    sent: true,
  };
};

                                                    
const verifyPreRegisterOtp = async (email, otp) => {
  if (!email || !otp) throw new ApiError(400, "Email and OTP required");
                                                                             
  email = email.toLowerCase().trim();

  const { getClient } = require("../../config/redis");
  const redis = getClient();
  const raw = await redis.get(`preregister:${email}`);
  if (!raw) throw new ApiError(400, "Verification code expired or not requested. Please click 'Resend Code'.");

  const { otpHash, expires } = JSON.parse(raw);
  if (new Date(expires) < new Date()) {
    await redis.del(`preregister:${email}`);
    throw new ApiError(400, "OTP expired");
  }

  const ok = await compareOtp(otp, otpHash);
  if (!ok) throw new ApiError(400, "Invalid OTP");

                                                                
  await redis.set(`preregister:verified:${email}`, "1", "EX", 1800);                             
  await redis.del(`preregister:${email}`);

  return { verified: true };
};

const sendEmailOtp = async (userId) => {
  const user = await User.findById(userId).select(
    "+emailOtpHash +emailOtpExpires",
  );
  if (!user) throw new ApiError(404, "User not found");
  if (user.isEmailVerified) {
    throw new ApiError(400, "Email already verified");
  }

  const otp = generateOtp();
  user.emailOtpHash = await hashOtp(otp);
  user.emailOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
  await user.save({ validateBeforeSave: false });

                                                                      
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📧 EMAIL OTP for ${user.email}: ${otp}\n`);
  }

  try {
    await sendEmail({
      to: user.email,
      subject: "Your EXPGLO FUND verification code",
      html: otpEmailHtml(otp),
      text: `Your verification code: ${otp} (valid 10 min)`,
    });
  } catch (err) {
    console.error("Failed to send email OTP:", err);
    throw new ApiError(500, "Failed to send OTP email. Please try again later.");
  }

  return {
    sent: true,
  };
};

const verifyEmailOtp = async (userId, otp) => {
  const user = await User.findById(userId).select(
    "+emailOtpHash +emailOtpExpires",
  );
  if (!user) throw new ApiError(404, "User not found");
  if (!user.emailOtpHash || !user.emailOtpExpires) {
    throw new ApiError(400, "No OTP requested");
  }
                                                                              
                                                                                    
  if (user.emailOtpExpires < new Date()) {
    user.emailOtpHash = undefined;
    user.emailOtpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "OTP expired. Please request a new one.");
  }
  const ok = await compareOtp(otp, user.emailOtpHash);
  if (!ok) throw new ApiError(400, "Invalid OTP");

  user.isEmailVerified = true;
  user.emailOtpHash = undefined;
  user.emailOtpExpires = undefined;
  user.recomputeVerificationLevel();
  await user.save({ validateBeforeSave: false });
  return user.toSafeJSON();
};

                                                  
const sendPhoneOtp = async (userId, phone) => {
  if (!phone) throw new ApiError(400, "Phone number required");
                                                                            
                                                                           
                                    
  phone = phone.replace(/[\s\-()]/g, "");
  const user = await User.findById(userId).select(
    "+phoneOtpHash +phoneOtpExpires",
  );
  if (!user) throw new ApiError(404, "User not found");
  if (user.isPhoneVerified && user.phone === phone) {
    throw new ApiError(400, "Phone already verified");
  }

  const otp = generateOtp();
  user.phone = phone;
  user.phoneOtpHash = await hashOtp(otp);

  const isDummyOtp =
    process.env.ENABLE_DUMMY_OTP === "true";

  const expiryMs = isDummyOtp ? 5 * 60 * 1000 : OTP_EXPIRY_MS;
  user.phoneOtpExpires = new Date(Date.now() + expiryMs);
  user.isPhoneVerified = false;
  await user.save({ validateBeforeSave: false });

  if (isDummyOtp) {
    console.log(`\n📱 [DUMMY] PHONE OTP for ${phone}: ${otp}\n`);
    return {
      sent: true,
      devOtp: otp,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📱 PHONE OTP for ${phone}: ${otp}\n`);
  }

  await sendSms({ phone, otp });
  return {
    sent: true,
  };
};

const verifyPhoneOtp = async (userId, otp) => {
  const user = await User.findById(userId).select(
    "+phoneOtpHash +phoneOtpExpires",
  );
  if (!user) throw new ApiError(404, "User not found");
  if (!user.phoneOtpHash || !user.phoneOtpExpires) {
    throw new ApiError(400, "No OTP requested");
  }
                                                                              
                                                                                    
  if (user.phoneOtpExpires < new Date()) {
    user.phoneOtpHash = undefined;
    user.phoneOtpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "OTP expired. Please request a new one.");
  }
  const ok = await compareOtp(otp, user.phoneOtpHash);
  if (!ok) throw new ApiError(400, "Invalid OTP");

  user.isPhoneVerified = true;
  user.phoneOtpHash = undefined;
  user.phoneOtpExpires = undefined;
  user.recomputeVerificationLevel();
  await user.save({ validateBeforeSave: false });
  return user.toSafeJSON();
};

                                                  
const forgotPassword = async (email) => {
                                                                            
                                                                     
                                                                   
  email = (email || "").toLowerCase().trim();
  const user = await User.findOne({ email });
                                   
  if (!user) return { sent: true };

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${
    process.env.FRONTEND_URL || "http://localhost:5173"
  }/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  try {
    await sendEmail({
      to: email,
      subject: "Reset your EXPGLO FUND password",
      html: `<p>Click the link below to reset your password (valid 30 min):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      text: `Reset link: ${resetUrl}`,
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err);
                                                             
  }
  return { sent: true };
};

const resetPassword = async ({ email, token, newPassword }) => {
  if (!email || !token || !newPassword) {
    throw new ApiError(400, "Email, token, and new password required");
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }
                                                                            
                                                                            
  email = (email || "").toLowerCase().trim();

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    email,
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires");
  if (!user) throw new ApiError(400, "Invalid or expired reset link");

  user.password = newPassword;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined;
  await user.save();
  return { reset: true };
};

const changePassword = async (userId, oldPassword, newPassword) => {
  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old and new password required");
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }
  const user = await User.findById(userId).select("+password");
  if (!user) throw new ApiError(404, "User not found");
  const ok = await user.comparePassword(oldPassword);
  if (!ok) throw new ApiError(401, "Old password is incorrect");
  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save();
  return { changed: true };
};

module.exports = {
  registerUser,
  loginUser,
  checkAvailability,
  logoutUser,
  refreshAccessToken,
  sendPreRegisterOtp,
  verifyPreRegisterOtp,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  forgotPassword,
  resetPassword,
  changePassword,
};
