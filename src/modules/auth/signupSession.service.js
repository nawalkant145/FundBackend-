/**
 * signupSession.service.js
 *
 * Manages temporary signup sessions in Redis.
 *
 * The session stores pre-hashed signup data with a 30-minute TTL.
 * No permanent MongoDB User document is created until identity verification
 * is successfully confirmed by the backend via the DigiLocker/Aadhaar callback.
 *
 * Redis key: signupSession:<signupSessionId>
 * TTL: 30 minutes (1800 seconds)
 */

const crypto = require("crypto");
const bcrypt = (() => {
  try {
    return require("bcrypt");
  } catch {
    return require("bcryptjs");
  }
})();
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../utils/generateToken");
const { normalizePhone } = require("../auth/auth.validation");

const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes

const getRedis = () => {
  const { getClient } = require("../../config/redis");
  return getClient();
};

const hashRefresh = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// ─── Create a temporary signup session ───────────────────────────────────────

const createSession = async ({
  name,
  username,
  email,
  password,
  role,
  phone,
  country,
  // Founder fields
  companyName,
  industry,
  fundingStage,
  website,
  linkedIn,
  // Investor fields
  investorType,
  investmentRange,
  preferredIndustries,
  preferredStages,
  investmentThesis,
}) => {
  email = (email || "").toLowerCase().trim();
  username = (username || "").toLowerCase().trim();

  // Respect global signups-enabled flag
  try {
    const settingsService = require("../settings/settings.service");
    const settings = await settingsService.getSettings();
    if (settings.signupsEnabled === false) {
      throw new ApiError(403, "New signups are temporarily disabled.");
    }
  } catch (e) {
    if (e.statusCode === 403) throw e;
  }

  // Duplicate checks against existing permanent accounts
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
    normalizedPhone =
      normalizePhone(phone, country) || phone.replace(/[\s\-()\u00A0]/g, "");
    if (await User.findOne({ phone: normalizedPhone })) {
      throw new ApiError(409, "Phone already registered", {
        field: "phone",
        message: "This phone number is already in use",
      });
    }
  }

  // Hash password immediately — never store plaintext, even temporarily
  const passwordHash = await bcrypt.hash(password, 12);

  const signupSessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  const sessionData = {
    signupSessionId,
    role,
    identityVerificationStatus: "pending",
    expiresAt,
    accountData: {
      name,
      username,
      email,
      passwordHash, // pre-hashed — never plaintext
      phone: normalizedPhone || "",
      country: country || "",
    },
    profileData: {
      // Founder
      companyName: companyName || "",
      industry: industry || "",
      fundingStage: fundingStage || "",
      website: website || "",
      linkedIn: linkedIn || "",
      // Investor
      investorType: investorType || "",
      investmentRange: investmentRange || null,
      preferredIndustries: preferredIndustries || [],
      preferredStages: preferredStages || [],
      investmentThesis: investmentThesis || "",
    },
  };

  const redis = getRedis();
  await redis.set(
    `signupSession:${signupSessionId}`,
    JSON.stringify(sessionData),
    "EX",
    SESSION_TTL_SECONDS
  );

  return { signupSessionId, expiresAt };
};

// ─── Retrieve a session ───────────────────────────────────────────────────────

const getSession = async (signupSessionId) => {
  if (!signupSessionId) throw new ApiError(400, "signupSessionId is required");
  const redis = getRedis();
  const raw = await redis.get(`signupSession:${signupSessionId}`);
  if (!raw) {
    throw new ApiError(
      410,
      "Signup session expired or not found. Please start signup again.",
      { code: "SIGNUP_SESSION_EXPIRED" }
    );
  }
  return JSON.parse(raw);
};

// ─── Finalize account after verified identity ─────────────────────────────────
// Called exclusively by the backend DigiLocker callback after confirming identity.
// Returns { user, accessToken, refreshToken } to be set as auth cookies.

const finalizeAccountCreation = async (signupSessionId, { kycDetails } = {}) => {
  const session = await getSession(signupSessionId);

  const { accountData, profileData, role } = session;
  const {
    name,
    username,
    email,
    passwordHash,
    phone,
    country,
  } = accountData;

  // Final duplicate check before creating the account (race-condition guard)
  if (await User.findOne({ email })) {
    throw new ApiError(409, "Email already registered during finalization");
  }
  if (username && (await User.findOne({ username }))) {
    throw new ApiError(409, "Username taken during finalization");
  }
  if (phone && (await User.findOne({ phone }))) {
    throw new ApiError(409, "Phone already registered during finalization");
  }

  // Build user document — backend determines all verification fields
  // Do NOT trust any client-supplied verification values
  const userData = {
    name,
    username,
    email,
    password: passwordHash, // already bcrypt-hashed; pre-save hook will skip re-hashing
    role,
    emailVerified: false,
    phoneVerified: false,
    identityVerified: true, // set by backend — verified via DigiLocker/Aadhaar
    verificationLevel: 1,
    kycStatus: "approved",
    verifiedBadge: true,
    isVerified: true,
    verifiedAt: new Date(),
  };

  if (phone) userData.phone = phone;
  if (country) userData.country = country;

  // Founder profile fields
  if (profileData.companyName) userData.companyName = profileData.companyName;
  if (profileData.industry) userData.industry = profileData.industry;
  if (profileData.fundingStage) userData.fundingStage = profileData.fundingStage;
  if (profileData.website) userData.website = profileData.website;
  if (profileData.linkedIn) userData.linkedIn = profileData.linkedIn;

  // Investor profile fields
  if (profileData.investorType) userData.investorType = profileData.investorType;
  if (profileData.investmentRange) userData.investmentRange = profileData.investmentRange;
  if (profileData.preferredIndustries?.length)
    userData.preferredIndustries = profileData.preferredIndustries;
  if (profileData.preferredStages?.length)
    userData.preferredStages = profileData.preferredStages;
  if (profileData.investmentThesis) userData.investmentThesis = profileData.investmentThesis;

  // Create permanent user
  const user = await User.create(userData);

  // Issue JWT tokens
  const tokenPayload = { _id: user._id.toString(), role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  user.refreshToken = hashRefresh(refreshToken);
  user.lastLoginAt = new Date();
  user.isOnline = true;
  await user.save({ validateBeforeSave: false });

  // Delete the temporary signup session — no longer needed
  const redis = getRedis();
  await redis.del(`signupSession:${signupSessionId}`);

  return { user: user.toSafeJSON(), accessToken, refreshToken };
};

// ─── Skip identity verification & create unverified account ─────────────────
// Creates an unverified permanent user account from a signup session when the user skips verification.
// Rules:
// - Does NOT mark identity as verified (identityVerified: false, verificationLevel: 0, kycStatus: "none")
// - Does NOT create fake Aadhaar/PAN or KYC data
// - Deletes the Redis signup session
// - Issues JWT tokens & returns { user, accessToken, refreshToken }

const skipAndCreateAccount = async (signupSessionId) => {
  const session = await getSession(signupSessionId);

  const { accountData, profileData, role } = session;
  const { name, username, email, passwordHash, phone, country } = accountData;

  // Duplicate check guards
  if (await User.findOne({ email })) {
    throw new ApiError(409, "Email already registered");
  }
  if (username && (await User.findOne({ username }))) {
    throw new ApiError(409, "Username taken");
  }
  if (phone && (await User.findOne({ phone }))) {
    throw new ApiError(409, "Phone already registered");
  }

  // Unverified user creation — identityVerified remains FALSE
  const userData = {
    name,
    username,
    email,
    password: passwordHash,
    role,
    emailVerified: false,
    phoneVerified: false,
    identityVerified: false, // Explicitly false
    verificationLevel: 0,
    kycStatus: "none",
    verifiedBadge: false,
    isVerified: false,
  };

  if (phone) userData.phone = phone;
  if (country) userData.country = country;

  if (profileData.companyName) userData.companyName = profileData.companyName;
  if (profileData.industry) userData.industry = profileData.industry;
  if (profileData.fundingStage) userData.fundingStage = profileData.fundingStage;
  if (profileData.website) userData.website = profileData.website;
  if (profileData.linkedIn) userData.linkedIn = profileData.linkedIn;

  if (profileData.investorType) userData.investorType = profileData.investorType;
  if (profileData.investmentRange) userData.investmentRange = profileData.investmentRange;
  if (profileData.preferredIndustries?.length)
    userData.preferredIndustries = profileData.preferredIndustries;
  if (profileData.preferredStages?.length)
    userData.preferredStages = profileData.preferredStages;
  if (profileData.investmentThesis) userData.investmentThesis = profileData.investmentThesis;

  const user = await User.create(userData);

  const tokenPayload = { _id: user._id.toString(), role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  user.refreshToken = hashRefresh(refreshToken);
  user.lastLoginAt = new Date();
  user.isOnline = true;
  await user.save({ validateBeforeSave: false });

  const redis = getRedis();
  await redis.del(`signupSession:${signupSessionId}`);

  return { user: user.toSafeJSON(), accessToken, refreshToken };
};

// ─── Delete a session (on failure / retry) ────────────────────────────────────

const deleteSession = async (signupSessionId) => {
  if (!signupSessionId) return;
  const redis = getRedis();
  await redis.del(`signupSession:${signupSessionId}`);
};

module.exports = {
  createSession,
  getSession,
  finalizeAccountCreation,
  skipAndCreateAccount,
  deleteSession,
  SESSION_TTL_SECONDS,
};

