const validator = require("validator");
const ApiError = require("../../utils/ApiError");

const validateRegister = (data) => {
  const errors = [];
  const { name, email, password, role } = data;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }
  if (!email || !validator.isEmail(email)) {
    errors.push("Valid email is required");
  }
  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!role || !["founder", "investor"].includes(role)) {
    errors.push("Role must be founder or investor");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

const validateLogin = (data) => {
  const errors = [];
  const { email, password } = data;

  if (!email || !validator.isEmail(email)) {
    errors.push("Valid email is required");
  }
  if (!password) {
    errors.push("Password is required");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

module.exports = { validateRegister, validateLogin };
