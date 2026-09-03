const validator = require("validator");
const ApiError = require("../../utils/ApiError");

                                                                              

const { parsePhoneNumber } = require("libphonenumber-js/max");

                                                                                                                                                                                                                                                                                                                                                     
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

                                                                                                                          
const isValidEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(trimmed) || !validator.isEmail(trimmed)) {
    return false;
  }
  
                                                         
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

                                                              
const isValidOtp = (otp) => /^\d{6}$/.test(String(otp).trim());

                                                                                                                                                                                                                                    
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

                                                                              

const validateRegister = (data) => {
  const errors = [];
  const { name, username, email, password, role, phone } = data;

         
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }

             
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    errors.push("Username must be 3-20 characters (letters, numbers, underscore)");
  }

          
  if (!email || !isValidEmail(String(email))) {
    errors.push("Valid email is required");
  }

                          
  validatePasswordStrength(password, errors);

         
  if (!role || !["founder", "investor"].includes(role)) {
    errors.push("Role must be founder or investor");
  }

                                                                          
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

                                                                              

const validateLogin = (data) => {
  const errors = [];
  const { identifier, email, password, role } = data;

                                                                        
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

                                                                              

const validateSendPreRegisterOtp = (data) => {
  const errors = [];
  const { email } = data;

  if (!email || !isValidEmail(String(email))) {
    errors.push("Valid email address is required");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

                                                                              

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

                                                                              

const validateVerifyEmailOtp = (data) => {
  const errors = [];
  const { otp } = data;

  if (!otp || !isValidOtp(otp)) {
    errors.push("OTP must be a 6-digit numeric code");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

                                                                              

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

                                                                              

const validateVerifyPhoneOtp = (data) => {
  const errors = [];
  const { otp } = data;

  if (!otp || !isValidOtp(otp)) {
    errors.push("OTP must be a 6-digit numeric code");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

                                                                              

const validateForgotPassword = (data) => {
  const errors = [];
  const { email } = data;

  if (!email || !isValidEmail(String(email))) {
    errors.push("Valid email address is required");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

                                                                              

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

                                                                              
                                                                               
                                                                    

const validateInitiateSignup = (data) => {
  const errors = [];
  const { name, username, email, password, role, phone } = data;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    errors.push("Username must be 3-20 characters (letters, numbers, underscore)");
  }
  if (!email || !isValidEmail(String(email))) {
    errors.push("Valid email is required");
  }

  validatePasswordStrength(password, errors);

  if (!role || !["founder", "investor"].includes(role)) {
    errors.push("Role must be founder or investor");
  }

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
  validateInitiateSignup,
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

