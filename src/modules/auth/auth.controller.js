const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const authService = require("./auth.service");
const {
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
} = require("./auth.validation");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};
const accessCookieMaxAge = 15 * 60 * 1000;
const refreshCookieMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: accessCookieMaxAge,
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: refreshCookieMaxAge,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
};

const register = asyncHandler(async (req, res) => {
  validateRegister(req.body);
  const {
    name,
    username,
    email: rawEmail,
    password,
    role,
    phone,
    country,
    companyName,
    industry,
    fundingStage,
    website,
    linkedIn,
    investorType,
    investmentRange,
    preferredIndustries,
    preferredStages,
    investmentThesis,
  } = req.body;

  // BUG-02 FIX: Normalize email to lowercase BEFORE the Redis lookup.
  // Without this, an attacker could send 'Test@Example.COM' for OTP but
  // 'test@example.com' for registration and bypass the duplicate-email check.
  const email = (rawEmail || "").toLowerCase().trim();

  // Check that email was pre-verified via OTP
  const { getClient } = require("../../config/redis");
  const redis = getClient();
  const verified = await redis.get(`preregister:verified:${email}`);
  if (!verified) {
    throw new ApiError(
      403,
      "Email not verified. Please verify your email first.",
    );
  }

  const result = await authService.registerUser({
    name,
    username,
    email,
    password,
    role,
    phone,
    country,
    companyName,
    industry,
    fundingStage,
    website,
    linkedIn,
    investorType,
    investmentRange,
    preferredIndustries,
    preferredStages,
    investmentThesis,
    // BUG-02 FIX: Pass the verified flag explicitly — the service no longer
    // hardcodes isEmailVerified:true; only this OTP-confirmed path sets it.
    emailVerified: true,
  });

  // Clean up the verification flag
  await redis.del(`preregister:verified:${email}`);

  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(201).json(new ApiResponse(201, result, "Registration successful"));
});

// Live availability check for username / email / phone
const checkAvailability = asyncHandler(async (req, res) => {
  const { username, email, phone } = req.query;
  const result = await authService.checkAvailability({
    username,
    email,
    phone,
  });
  res.status(200).json(new ApiResponse(200, result, "Availability"));
});

// Pre-register: send OTP to verify email before account creation
const sendPreRegisterOtp = asyncHandler(async (req, res) => {
  validateSendPreRegisterOtp(req.body);
  const { email } = req.body;
  const result = await authService.sendPreRegisterOtp(email);
  res.status(200).json(new ApiResponse(200, result, "OTP sent to email"));
});

// Verify pre-register OTP
const verifyPreRegisterOtp = asyncHandler(async (req, res) => {
  validateVerifyPreRegisterOtp(req.body);
  const { email, otp } = req.body;
  const result = await authService.verifyPreRegisterOtp(email, otp);
  res.status(200).json(new ApiResponse(200, result, "Email verified"));
});

const login = asyncHandler(async (req, res) => {
  validateLogin(req.body);
  const { identifier, email, password, role } = req.body;
  const clientInfo = {
    ip: req.ip || req.headers["x-forwarded-for"] || "",
    userAgent: req.headers["user-agent"] || "",
  };
  const result = await authService.loginUser({
    identifier,
    email,
    password,
    role,
    clientInfo,
  });

  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(200).json(new ApiResponse(200, result, "Login successful"));
});

const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user._id);
  clearAuthCookies(res);
  res.status(200).json(new ApiResponse(200, null, "Logged out"));
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) throw new ApiError(401, "Refresh token required");
  const result = await authService.refreshAccessToken(refreshToken);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(200).json(new ApiResponse(200, result, "Token refreshed"));
});

const getMe = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, { user: req.user }, "Current user"));
});

const sendEmailOtp = asyncHandler(async (req, res) => {
  const result = await authService.sendEmailOtp(req.user._id);
  res.status(200).json(new ApiResponse(200, result, "Email OTP sent"));
});

const verifyEmailOtp = asyncHandler(async (req, res) => {
  validateVerifyEmailOtp(req.body);
  const { otp } = req.body;
  const user = await authService.verifyEmailOtp(req.user._id, otp);
  res.status(200).json(new ApiResponse(200, { user }, "Email verified"));
});

const sendPhoneOtp = asyncHandler(async (req, res) => {
  validateSendPhoneOtp(req.body);
  const { phone } = req.body;
  const result = await authService.sendPhoneOtp(req.user._id, phone);
  res.status(200).json(new ApiResponse(200, result, "Phone OTP sent"));
});

const verifyPhoneOtp = asyncHandler(async (req, res) => {
  validateVerifyPhoneOtp(req.body);
  const { otp } = req.body;
  const user = await authService.verifyPhoneOtp(req.user._id, otp);
  res.status(200).json(new ApiResponse(200, { user }, "Phone verified"));
});

const forgotPassword = asyncHandler(async (req, res) => {
  validateForgotPassword(req.body);
  const { email } = req.body;
  await authService.forgotPassword(email);
  res
    .status(200)
    .json(new ApiResponse(200, null, "If account exists, reset link sent"));
});

const resetPassword = asyncHandler(async (req, res) => {
  validateResetPassword(req.body);
  const { email, token, newPassword } = req.body;
  await authService.resetPassword({ email, token, newPassword });
  res.status(200).json(new ApiResponse(200, null, "Password reset successful"));
});

const changePassword = asyncHandler(async (req, res) => {
  validateChangePassword(req.body);
  const { oldPassword, newPassword } = req.body;
  await authService.changePassword(req.user._id, oldPassword, newPassword);
  clearAuthCookies(res);
  res
    .status(200)
    .json(new ApiResponse(200, null, "Password changed. Please log in again."));
});

module.exports = {
  register,
  checkAvailability,
  login,
  logout,
  refresh,
  getMe,
  sendPreRegisterOtp,
  verifyPreRegisterOtp,
  sendEmailOtp,
  verifyEmailOtp,
  sendPhoneOtp,
  verifyPhoneOtp,
  forgotPassword,
  resetPassword,
  changePassword,
};
