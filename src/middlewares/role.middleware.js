const ApiError = require("../utils/ApiError");

                                                                          
                                                  
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
