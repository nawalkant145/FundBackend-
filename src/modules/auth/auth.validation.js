const validator = require("validator");
const ApiError = require("../../utils/ApiError");

// ─── Shared helpers ────────────────────────────────────────────────────────

/**
 * Validates a mobile number.
 * Ensures the base phone number has exactly 10 digits (excluding country code).
 * Supports an optional country code starting with '+' (1-3 digits) followed by exactly 10 digits.
 */
const isValidPhone = (phone) => {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/[\s\-()]/g, "");
  
  if (cleaned.startsWith("+")) {
    const digitsOnly = cleaned.slice(1);
    // 1-3 digits country code followed by exactly 10 digits starting with non-zero
    return /^\d{1,3}[1-9]\d{9}$/.test(digitsOnly);
  }
  
  // Local number must be exactly 10 digits starting with non-zero
  return /^[1-9]\d{9}$/.test(cleaned);
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

  // Phone — optional at registration but must be valid if provided
  if (phone !== undefined && phone !== null && phone !== "") {
    if (!isValidPhone(String(phone))) {
      errors.push(
        "Phone number must be in international format (e.g. +91XXXXXXXXXX)",
      );
    }
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

// ─── Login ─────────────────────────────────────────────────────────────────

const validateLogin = (data) => {
  const errors = [];
  const { identifier, email, password } = data;

  // Trim before the falsy check so a whitespace-only string is rejected
  if (!identifier?.trim() && !email?.trim()) {
    errors.push("Username, email, or phone is required");
  }

  if (!password || !password.trim()) {
    errors.push("Password is required");
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
      "Valid phone number is required in international format (e.g. +91XXXXXXXXXX)",
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
