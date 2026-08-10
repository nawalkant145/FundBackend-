const validator = require("validator");
const ApiError = require("../../utils/ApiError");

// ─── Shared helpers ────────────────────────────────────────────────────────

const { parsePhoneNumber } = require("libphonenumber-js/max");

/**
 * Validates a mobile number using libphonenumber-js across all international countries.
 *
 * @param {string} phone Raw or normalized phone number string
 * @param {string} [defaultCountry="IN"] Default ISO 3166-1 alpha-2 country code
 * @returns {boolean} True if phone is valid and possible for the country, false otherwise.
 */
const isValidPhone = (phone, defaultCountry = "IN") => {
  if (!phone || typeof phone !== "string") return false;
  const trimmed = phone.trim();
  if (!trimmed) return false;

  try {
    const countryCode =
      defaultCountry && typeof defaultCountry === "string"
        ? defaultCountry.toUpperCase().trim()
        : "IN";
    const phoneNumber = trimmed.startsWith("+")
      ? parsePhoneNumber(trimmed)
      : parsePhoneNumber(trimmed, countryCode);

    if (!phoneNumber || !phoneNumber.isValid()) return false;

    // For India, enforce mobile number prefixes (must start with 6-9)
    if (phoneNumber.country === "IN") {
      const type = phoneNumber.getType();
      if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") {
        return false;
      }
      if (/^[0-5]/.test(phoneNumber.nationalNumber)) {
        return false;
      }
    }

    return true;
  } catch (err) {
    return false;
  }
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

  // Phone — required at registration; must be in valid format for country
  const defaultCountry = data.country || "IN";
  const normalizedPhone = normalizePhone(String(phone || ""), defaultCountry);
  if (!phone || phone === "") {
    errors.push("Phone number is required");
  } else if (!normalizedPhone || !isValidPhone(phone, defaultCountry)) {
    errors.push("Please enter a valid phone number for the selected country.");
  } else {
    data.phone = normalizedPhone;
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
  const { phone, country } = data;
  const defaultCountry = country || "IN";
  const normalizedPhone = normalizePhone(String(phone || ""), defaultCountry);

  if (!phone || !normalizedPhone || !isValidPhone(phone, defaultCountry)) {
    errors.push("Please enter a valid phone number for the selected country.");
  } else {
    data.phone = normalizedPhone;
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

/**
 * Normalizes a phone number into canonical E.164 format (+<country><national>).
 *
 * @param {string} phone Raw phone number string
 * @param {string} [defaultCountry="IN"] Default ISO 3166-1 alpha-2 country code
 * @returns {string|null} E.164 format string if valid, otherwise null.
 */
const normalizePhone = (phone, defaultCountry = "IN") => {
  if (!phone || typeof phone !== "string") return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  if (!isValidPhone(trimmed, defaultCountry)) return null;

  try {
    const countryCode =
      defaultCountry && typeof defaultCountry === "string"
        ? defaultCountry.toUpperCase().trim()
        : "IN";
    const phoneNumber = trimmed.startsWith("+")
      ? parsePhoneNumber(trimmed)
      : parsePhoneNumber(trimmed, countryCode);

    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format("E.164");
    }
    return null;
  } catch (err) {
    return null;
  }
};

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
  normalizePhone,
};
