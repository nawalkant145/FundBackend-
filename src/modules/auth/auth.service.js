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

const issueTokens = async (user) => {
  const payload = { _id: user._id.toString(), role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  user.refreshToken = hashRefresh(refreshToken); // store hash, not raw
  await user.save({ validateBeforeSave: false });
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
  // BUG-02 FIX: Accept explicit emailVerified flag from the controller.
  // The service must NOT hardcode isEmailVerified:true — only the controller
  // can assert this after confirming the Redis OTP key was present.
  emailVerified = false,
}) => {
  email = email.toLowerCase().trim();
  username = (username || "").toLowerCase().trim();

  // Respect the global "signups enabled" feature flag
  try {
    const settingsService = require("../settings/settings.service");
    const settings = await settingsService.getSettings();
    if (settings.signupsEnabled === false) {
      throw new ApiError(403, "New signups are temporarily disabled.");
    }
  } catch (e) {
    if (e.statusCode === 403) throw e;
  }

  // Field-specific duplicate checks → clear messages for the UI
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
    normalizedPhone = phone.replace(/[\s\-()]/g, "");
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
    // BUG-02 FIX: Use the emailVerified param, not a hardcoded true.
    // This ensures only callers who completed the OTP flow can set level 1.
    isEmailVerified: emailVerified,
    verificationLevel: emailVerified ? 1 : 0,
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

// Check whether a username / email / phone is already taken.
const checkAvailability = async ({ username, email, phone }) => {
  const { isValidEmail, isValidPhone } = require("./auth.validation");
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
    if (!isValidPhone(p)) {
      throw new ApiError(400, "Invalid phone number format. Base mobile number must be exactly 10 digits.");
    }
    const normalizedPhone = p.replace(/[\s\-()]/g, "");
    result.phone = (await User.findOne({ phone: normalizedPhone }))
      ? "taken"
      : "available";
  }
  return result;
};

const loginUser = async ({ identifier, email, password }) => {
  const raw = (identifier || email || "").trim();
  let query;
  if (raw.includes("@")) {
    query = { email: raw.toLowerCase() };
  } else if (/^\+?\d[\d\s-]{5,}$/.test(raw)) {
    query = { phone: raw };
  } else {
    query = { username: raw.toLowerCase() };
  }

  const user = await User.findOne(query).select("+password +refreshToken");
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

  // BUG-05 FIX: Compare two Date objects (not Date vs number) to be
  // explicit and consistent with the suspendedUntil check above.
  if (user.lockUntil && user.lockUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockUntil.getTime() - Date.now()) / 60000,
    );
    throw new ApiError(429, `Account locked. Try again in ${minutesLeft} min.`);
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.loginAttempts = 0;
    }
    await user.save({ validateBeforeSave: false });
    throw new ApiError(401, "Invalid credentials");
  }

  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastSeen = new Date();
  user.isOnline = true;
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokens(user);
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

// ─── Email OTP ─────────────────────────────────

// Pre-register: send OTP to email before account exists (for signup verification)
const sendPreRegisterOtp = async (email) => {
  if (!email) throw new ApiError(400, "Email required");
  // BUG-02 FIX: Normalize email before forming the Redis key so that
  // 'Test@Example.COM' and 'test@example.com' resolve to the same key.
  email = email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "Email already registered");

  const otp = generateOtp();
  const hash = await hashOtp(otp);
  const expires = new Date(Date.now() + OTP_EXPIRY_MS);

  // Store in Redis temporarily (not in DB since user doesn't exist yet)
  const { getClient } = require("../../config/redis");
  const redis = getClient();
  await redis.set(
    `preregister:${email}`,
    JSON.stringify({ otpHash: hash, expires: expires.toISOString() }),
    "EX",
    600, // 10 minutes
  );

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📧 PRE-REGISTER OTP for ${email}: ${otp}\n`);
  }

  await sendEmail({
    to: email,
    subject: "Your EXPGLO FUND verification code",
    html: otpEmailHtml(otp),
    text: `Your verification code: ${otp} (valid 10 min)`,
  });

  return {
    sent: true,
    ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
  };
};

// Verify pre-register OTP (before account creation)
const verifyPreRegisterOtp = async (email, otp) => {
  if (!email || !otp) throw new ApiError(400, "Email and OTP required");
  // BUG-02 FIX: Normalize email to match the key used in sendPreRegisterOtp.
  email = email.toLowerCase().trim();

  const { getClient } = require("../../config/redis");
  const redis = getClient();
  const raw = await redis.get(`preregister:${email}`);
  if (!raw) throw new ApiError(400, "No OTP requested or expired");

  const { otpHash, expires } = JSON.parse(raw);
  if (new Date(expires) < new Date()) {
    await redis.del(`preregister:${email}`);
    throw new ApiError(400, "OTP expired");
  }

  const ok = await compareOtp(otp, otpHash);
  if (!ok) throw new ApiError(400, "Invalid OTP");

  // Mark as verified in Redis (will be checked during register)
  await redis.set(`preregister:verified:${email}`, "1", "EX", 1800); // 30 min to complete signup
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

  // Always log OTP in dev so you can test without real email delivery
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📧 EMAIL OTP for ${user.email}: ${otp}\n`);
  }

  await sendEmail({
    to: user.email,
    subject: "Your PitchConnect verification code",
    html: otpEmailHtml(otp),
    text: `Your verification code: ${otp} (valid 10 min)`,
  });

  return {
    sent: true,
    ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
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
  // BUG-SERVICE-02 FIX: Clean up the expired OTP from the DB before throwing,
  // so a user can immediately request a fresh OTP without stale data blocking them.
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

// ─── Phone OTP ─────────────────────────────────
const sendPhoneOtp = async (userId, phone) => {
  if (!phone) throw new ApiError(400, "Phone number required");
  // BUG-SERVICE-04 FIX: Normalize phone (strip spaces, dashes, parentheses)
  // before storing and comparing, so '+91 98765-43210' and '+919876543210'
  // are treated as the same number.
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
  user.phoneOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
  user.isPhoneVerified = false;
  await user.save({ validateBeforeSave: false });

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📱 PHONE OTP for ${phone}: ${otp}\n`);
  }

  await sendSms({ phone, otp });
  return {
    sent: true,
    ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
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
  // BUG-SERVICE-03 FIX: Clean up the expired OTP from the DB before throwing,
  // so a user can immediately request a fresh OTP without stale data blocking them.
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

// ─── Password Reset ────────────────────────────
const forgotPassword = async (email) => {
  // BUG-04 FIX: Normalize email before querying. MongoDB string matching is
  // case-sensitive, so 'Test@Example.COM' would NOT match the stored
  // lowercase value 'test@example.com' without this normalization.
  email = (email || "").toLowerCase().trim();
  const user = await User.findOne({ email });
  // Don't leak whether user exists
  if (!user) return { sent: true };

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${
    process.env.FRONTEND_URL || "http://localhost:5173"
  }/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  await sendEmail({
    to: email,
    subject: "Reset your PitchConnect password",
    html: `<p>Click the link below to reset your password (valid 30 min):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    text: `Reset link: ${resetUrl}`,
  });
  return { sent: true };
};

const resetPassword = async ({ email, token, newPassword }) => {
  if (!email || !token || !newPassword) {
    throw new ApiError(400, "Email, token, and new password required");
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }
  // BUG-SERVICE-01 FIX: Normalize email before the DB lookup. Without this,
  // 'Test@EXAMPLE.COM' won't match the stored lowercase 'test@example.com'.
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
