const validator = require("validator");
const ApiError = require("../../utils/ApiError");

const validateRegister = (data) => {
  const errors = [];
  const { name, username, email, password, role } = data;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    errors.push("Name must be at least 2 characters");
  }
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    errors.push(
      "Username must be 3-20 characters (letters, numbers, underscore)",
    );
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
  const { identifier, email, password } = data;

  // Login accepts a username, email, or phone via `identifier`
  // (falls back to `email` for backward compatibility).
  if (!identifier && !email) {
    errors.push("Username, email, or phone is required");
  }
  if (!password) {
    errors.push("Password is required");
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
};

module.exports = { validateRegister, validateLogin };
