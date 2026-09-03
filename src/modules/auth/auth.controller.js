const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const authService = require("./auth.service");
const signupSessionService = require("./signupSession.service");
const {
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
} = require("./auth.validation");


const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};
const accessCookieMaxAge = 15 * 60 * 1000;
const refreshCookieMaxAge = 30 * 24 * 60 * 60 * 1000;           

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

  const email = (rawEmail || "").toLowerCase().trim();

                                                                                     
                                                                                                                   
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
    emailVerified: false,
    phoneVerified: false,
    identityVerified: false,
  });

  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(201).json(new ApiResponse(201, result, "Registration successful"));
});

                                                                    
                                                                  
                                                                                       
const initiateSignup = asyncHandler(async (req, res) => {
  validateInitiateSignup(req.body);
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

  const email = (rawEmail || "").toLowerCase().trim();

                                                            
  const result = await signupSessionService.createSession({
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
  });

                                                                              
  res.status(200).json(
    new ApiResponse(200, result, "Signup session created. Proceed to identity verification.")
  );
});

                                                                                
const skipSignup = asyncHandler(async (req, res) => {
  const { signupSessionId } = req.body;
  if (!signupSessionId) throw new ApiError(400, "signupSessionId is required");

  const result = await signupSessionService.skipAndCreateAccount(signupSessionId);

  res.cookie("accessToken", result.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", result.refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json(
    new ApiResponse(200, result, "Account created successfully without identity verification")
  );
});




                                                       
const checkAvailability = asyncHandler(async (req, res) => {
  const { username, email, phone } = req.query;
  const result = await authService.checkAvailability({
    username,
    email,
    phone,
  });
  res.status(200).json(new ApiResponse(200, result, "Availability"));
});

                                                                 
const sendPreRegisterOtp = asyncHandler(async (req, res) => {
  validateSendPreRegisterOtp(req.body);
  const { email } = req.body;
  const result = await authService.sendPreRegisterOtp(email);
  res.status(200).json(new ApiResponse(200, result, "OTP sent to email"));
});

                          
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
  initiateSignup,
  skipSignup,
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

