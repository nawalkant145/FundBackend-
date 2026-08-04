const validator = require("validator");
const ApiError = require("../../utils/ApiError");

// ─── Shared helpers ────────────────────────────────────────────────────────

/**
 * Country-aware phone number rules.
 * Keys are the full country calling code (with leading '+').
 * Values specify the allowed subscriber (national) digit count range.
 * Codes are matched longest-first so +971 is tried before +97 before +9.
 *
 * Sources: ITU-T E.164 national numbering plans.
 */
const PHONE_RULES = {
  // 4-digit codes first (none currently, placeholder for future)
  // 3-digit codes
  "+971": { min: 9,  max: 9  }, // UAE
  "+852": { min: 8,  max: 8  }, // Hong Kong
  "+853": { min: 8,  max: 8  }, // Macau
  "+880": { min: 10, max: 10 }, // Bangladesh
  "+966": { min: 9,  max: 9  }, // Saudi Arabia
  "+974": { min: 8,  max: 8  }, // Qatar
  "+973": { min: 8,  max: 8  }, // Bahrain
  "+968": { min: 8,  max: 8  }, // Oman
  "+965": { min: 8,  max: 8  }, // Kuwait
  // 2-digit codes
  "+91": { min: 10, max: 10 }, // India
  "+44": { min: 10, max: 10 }, // UK
  "+61": { min: 9,  max: 9  }, // Australia
  "+65": { min: 8,  max: 8  }, // Singapore
  "+86": { min: 11, max: 11 }, // China
  "+49": { min: 10, max: 11 }, // Germany
  "+33": { min: 9,  max: 9  }, // France
  "+81": { min: 10, max: 11 }, // Japan
  "+82": { min: 9,  max: 10 }, // South Korea
  "+60": { min: 9,  max: 10 }, // Malaysia
  "+63": { min: 10, max: 10 }, // Philippines
  "+62": { min: 9,  max: 12 }, // Indonesia
  "+55": { min: 10, max: 11 }, // Brazil
  "+27": { min: 9,  max: 9  }, // South Africa
  "+92": { min: 10, max: 10 }, // Pakistan
  "+94": { min: 9,  max: 9  }, // Sri Lanka
  "+20": { min: 10, max: 10 }, // Egypt
  "+98": { min: 10, max: 10 }, // Iran
  // 1-digit codes
  "+1": { min: 10, max: 10 }, // US/Canada
};

/**
 * Validates a mobile number in international format (+countryCode + subscriber).
 *
 * Rules:
 *  - International format (leading '+') is REQUIRED.
 *  - Strips whitespace, dashes, and parentheses before parsing.
 *  - Validates subscriber digit count against per-country rules.
 *  - Unknown country codes are accepted with a permissive 7–12 digit fallback
 *    so unlisted countries are not permanently blocked.
 *  - Returns false for local-only numbers (no '+') — callers should prompt
 *    the user to use the full international format.
 */
const isValidPhone = (phone) => {
  if (!phone || typeof phone !== "string") return false;

  // Strip common formatting characters
  const cleaned = phone.replace(/[\s\-()\u00A0]/g, "");

  if (!cleaned.startsWith("+")) {
    // Local numbers are not accepted; international format is required.
    return false;
  }

  // Try to match the longest known country code first (4 → 3 → 2 → 1 digit)
  const digits = cleaned.slice(1); // everything after '+'
  const lengths = [4, 3, 2, 1];

  for (const len of lengths) {
    const code = "+" + digits.slice(0, len);
    if (PHONE_RULES[code]) {
      const subscriber = digits.slice(len);
      const { min, max } = PHONE_RULES[code];
      // Subscriber must be purely numeric, correct length, and non-empty
      if (!/^\d+$/.test(subscriber)) return false;
      return subscriber.length >= min && subscriber.length <= max;
    }
  }

  // Unknown country code — apply a permissive fallback (7–12 subscriber digits)
  // so users from unlisted countries are not blocked.
  const allDigits = digits;
  if (!/^\d+$/.test(allDigits)) return false;
  // At minimum we need 1 country-code digit + 7 subscriber digits
  return allDigits.length >= 8 && allDigits.length <= 15;
};

/**
 * Validates a strict email format with TLD requirements.
 * Also checks and rejects common misspelled domains.
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(trimmed) || !validator.isEmail(trimmed)) {
    return false;
  }
  
  // Blacklist common misspelled domains to prevent typos
  const domain = trimmed.split("@")[1]?.toLowerCase();
  const COMMON_TYPOS = [
    "gmil.com", "gamil.com", "gmal.com", "gmaill.com", "gmel.com", "gmail.con", "gmail.cm",
    "yaho.com", "yahoo.co", "yaboo.com", "yahoo.cm",
    "hotmal.com", "hotmial.com", "hormail.com", "hotmail.cm",
    "outlok.com", "outook.com",
    "redifmail.com"
  ];
  
  if (COMMON_TYPOS.includes(domain)) {
    return false;
  }
  
  return true;
};

/**
 * Validates OTP — must be exactly 6 numeric digits.
 */
const isValidOtp = (otp) => /^\d{6}$/.test(String(otp).trim());

/**
 * Password complexity rule:
 *   - At least 8 characters
 *   - At least one uppercase letter (A-Z)
 *   - At least one lowercase letter (a-z)
 *   - At least one digit (0-9)
 *   - At least one special character
 */
const PASSWORD_REGEX =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const validatePasswordStrength = (password, errors) => {
  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters");
  } else if (!PASSWORD_REGEX.test(password)) {
    errors.push(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    );
  }
};

// ─── Register ──────────────────────────────────────────────────────────────

const validateRegister = (data) => {
  const errors = [];
  const { name, username, email, password, role, phone } = data;

  // Name
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  // Username
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    errors.push("Username must be 3-20 characters (letters, numbers, underscore)");
  }

  // Email
  if (!email || !isValidEmail(String(email))) {
    errors.push("Valid email is required");
  }

  // Password (complexity)
  validatePasswordStrength(password, errors);

  // Role
  if (!role || !["founder", "investor"].includes(role)) {
    errors.push("Role must be founder or investor");
  }

  // Phone — required at registration; must be in international format
  if (!phone || phone === "") {
    errors.push("Phone number is required");
  } else if (!isValidPhone(String(phone))) {
    errors.push(
      "Phone number must include your country code in international format " +
      "(e.g. +919876543210 for India, +17025551234 for US, +971501234567 for UAE, " +
      "+6591234567 for Singapore). The number of digits after the country code " +
      "must match your country's standard.",
    );
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── Login ─────────────────────────────────────────────────────────────────

const validateLogin = (data) => {
  const errors = [];
  const { identifier, email, password, role } = data;

  // Trim before the falsy check so a whitespace-only string is rejected
  if (!identifier?.trim() && !email?.trim()) {
    errors.push("Username, email, or phone is required");
  }

  if (!password || !password.trim()) {
    errors.push("Password is required");
  }

  if (role && typeof role === "string" && !["founder", "investor", "admin"].includes(role.toLowerCase().trim())) {
    errors.push("Invalid role specified");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── OTP: send pre-register email OTP ──────────────────────────────────────

const validateSendPreRegisterOtp = (data) => {
  const errors = [];
  const { email } = data;

  if (!email || !isValidEmail(String(email))) {
    errors.push("Valid email address is required");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── OTP: verify pre-register email OTP ────────────────────────────────────

const validateVerifyPreRegisterOtp = (data) => {
  const errors = [];
  const { email, otp } = data;

  if (!email || !isValidEmail(String(email))) {
    errors.push("Valid email address is required");
  }

  if (!otp || !isValidOtp(otp)) {
    errors.push("OTP must be a 6-digit numeric code");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── OTP: verify email OTP (post-login) ────────────────────────────────────

const validateVerifyEmailOtp = (data) => {
  const errors = [];
  const { otp } = data;

  if (!otp || !isValidOtp(otp)) {
    errors.push("OTP must be a 6-digit numeric code");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── OTP: send phone OTP ───────────────────────────────────────────────────

const validateSendPhoneOtp = (data) => {
  const errors = [];
  const { phone } = data;

  if (!phone || !isValidPhone(String(phone))) {
    errors.push(
      "A valid phone number in international format is required " +
      "(e.g. +919876543210 for India, +17025551234 for US, +971501234567 for UAE, " +
      "+6591234567 for Singapore).",
    );
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── OTP: verify phone OTP ─────────────────────────────────────────────────

const validateVerifyPhoneOtp = (data) => {
  const errors = [];
  const { otp } = data;

  if (!otp || !isValidOtp(otp)) {
    errors.push("OTP must be a 6-digit numeric code");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── Forgot password ───────────────────────────────────────────────────────

const validateForgotPassword = (data) => {
  const errors = [];
  const { email } = data;

  if (!email || !isValidEmail(String(email))) {
    errors.push("Valid email address is required");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── Reset password ────────────────────────────────────────────────────────

const validateResetPassword = (data) => {
  const errors = [];
  const { email, token, newPassword } = data;

  if (!email || !isValidEmail(String(email))) {
    errors.push("Valid email address is required");
  }

  if (!token || typeof token !== "string" || token.trim().length < 10) {
    errors.push("Valid reset token is required");
  }

  validatePasswordStrength(newPassword, errors);

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── Change password ───────────────────────────────────────────────────────

const validateChangePassword = (data) => {
  const errors = [];
  const { oldPassword, newPassword } = data;

  if (!oldPassword || !oldPassword.trim()) {
    errors.push("Current password is required");
  }

  validatePasswordStrength(newPassword, errors);

  if (
    oldPassword &&
    newPassword &&
    oldPassword.trim() === newPassword.trim()
  ) {
    errors.push("New password must be different from the current password");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  validateRegister,
  validateLogin,
  validateSendPreRegisterOtp,
  validateVerifyPreRegisterOtp,
  validateVerifyEmailOtp,
  validateSendPhoneOtp,
  validateVerifyPhoneOtp,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  isValidPhone,
  isValidEmail,
};
