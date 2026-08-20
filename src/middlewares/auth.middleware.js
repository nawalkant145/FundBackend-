const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyAccessToken } = require("../utils/generateToken");
const User = require("../modules/user/user.model");

// Verifies JWT access token from Authorization header or cookie
const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Bearer token (mobile)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // 2. httpOnly cookie (web)
  if (!token && req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw new ApiError(401, "Authentication required. Please log in.");
  }

  const decoded = verifyAccessToken(token);
  const user = await User.findById(decoded._id).select(
    "-password -refreshToken",
  );

  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }

  if (user.isBanned) {
    throw new ApiError(403, "Your account has been banned");
  }

  if (user.suspendedUntil && user.suspendedUntil > new Date()) {
    const until = new Date(user.suspendedUntil).toLocaleString();
    throw new ApiError(
      403,
      `Your account is suspended until ${until}${user.suspensionReason ? `: ${user.suspensionReason}` : ""}`,
    );
  }

  if (!user.isActive) {
    throw new ApiError(403, "Your account is inactive");
  }

  req.user = user;
  next();
});

// Like authenticate, but does NOT throw if no token is present.
// Populates req.user if a valid token exists; sets req.user = null otherwise.
// Used for routes that are accessible to both authenticated and unauthenticated users.
const optionalAuthenticate = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    if (!token) {
      req.user = null;
      return next();
    }
    const { verifyAccessToken } = require("../utils/generateToken");
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded._id).select("-password -refreshToken");
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
};

module.exports = { authenticate, optionalAuthenticate };
