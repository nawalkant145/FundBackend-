const ApiError = require("../utils/ApiError");

// Usage: authorize('founder'), authorize('investor'), authorize('admin'),
// or authorize('founder', 'investor') for either.
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Required role: ${allowedRoles.join(" or ")}`,
        ),
      );
    }
    next();
  };
};

// Verification level guard — e.g. requireVerificationLevel(2)
const requireVerificationLevel = (minLevel) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }
    if ((req.user.verificationLevel || 0) < minLevel) {
      return next(
        new ApiError(
          403,
          `Verification level ${minLevel} required. You are at level ${req.user.verificationLevel || 0}.`,
        ),
      );
    }
    next();
  };
};

module.exports = { authorize, requireVerificationLevel };
