                                                                                                                                                                                                                                                                                                                                                                                                                       

const crypto = require("crypto");
const bcrypt = (() => {
  try {
    return require("bcrypt");
  } catch {
    return require("bcryptjs");
  }
})();
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../utils/generateToken");
const { normalizePhone } = require("../auth/auth.validation");

const SESSION_TTL_SECONDS = 30 * 60;              

const getRedis = () => {
  const { getClient } = require("../../config/redis");
  return getClient();
};

const hashRefresh = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

                                                                                

const createSession = async ({
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
}) => {
  email = (email || "").toLowerCase().trim();
  username = (username || "").toLowerCase().trim();

                                        
  try {
    const settingsService = require("../settings/settings.service");
    const settings = await settingsService.getSettings();
    if (settings.signupsEnabled === false) {
      throw new ApiError(403, "New signups are temporarily disabled.");
    }
  } catch (e) {
    if (e.statusCode === 403) throw e;
  }

                                                         
  if (await User.findOne({ email })) {
    throw new ApiError(409, "Email already registered", {
      field: "email",
      message: "This email is already in use",
    });
  }
  if (username && (await User.findOne({ username }))) {
    throw new ApiError(409, "Username taken", {
      field: "username",
      message: "This username is already taken",
    });
  }

  let normalizedPhone = "";
  if (phone) {
    normalizedPhone =
      normalizePhone(phone, country) || phone.replace(/[\s\-()\u00A0]/g, "");
    if (await User.findOne({ phone: normalizedPhone })) {
      throw new ApiError(409, "Phone already registered", {
        field: "phone",
        message: "This phone number is already in use",
      });
    }
  }

                                                                        
  const passwordHash = await bcrypt.hash(password, 12);

  const signupSessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  const sessionData = {
    signupSessionId,
    role,
    identityVerificationStatus: "pending",
    expiresAt,
    accountData: {
      name,
      username,
      email,
      passwordHash,                                
      phone: normalizedPhone || "",
      country: country || "",
    },
    profileData: {
                
      companyName: companyName || "",
      industry: industry || "",
      fundingStage: fundingStage || "",
      website: website || "",
      linkedIn: linkedIn || "",
                 
      investorType: investorType || "",
      investmentRange: investmentRange || null,
      preferredIndustries: preferredIndustries || [],
      preferredStages: preferredStages || [],
      investmentThesis: investmentThesis || "",
    },
  };

  const redis = getRedis();
  await redis.set(
    `signupSession:${signupSessionId}`,
    JSON.stringify(sessionData),
    "EX",
    SESSION_TTL_SECONDS
  );

  return { signupSessionId, expiresAt };
};

                                                                                 

const getSession = async (signupSessionId) => {
  if (!signupSessionId) throw new ApiError(400, "signupSessionId is required");
  const redis = getRedis();
  const raw = await redis.get(`signupSession:${signupSessionId}`);
  if (!raw) {
    throw new ApiError(
      410,
      "Signup session expired or not found. Please start signup again.",
      { code: "SIGNUP_SESSION_EXPIRED" }
    );
  }
  return JSON.parse(raw);
};

                                                                                 
                                                                                   
                                                                         

const finalizeAccountCreation = async (signupSessionId, { kycDetails } = {}) => {
  const session = await getSession(signupSessionId);

  const { accountData, profileData, role } = session;
  const {
    name,
    username,
    email,
    passwordHash,
    phone,
    country,
  } = accountData;

                                                                             
  if (await User.findOne({ email })) {
    throw new ApiError(409, "Email already registered during finalization");
  }
  if (username && (await User.findOne({ username }))) {
    throw new ApiError(409, "Username taken during finalization");
  }
  if (phone && (await User.findOne({ phone }))) {
    throw new ApiError(409, "Phone already registered during finalization");
  }

                                                                     
                                                         
  const userData = {
    name,
    username,
    email,
    password: passwordHash,                                                             
    role,
    emailVerified: false,
    phoneVerified: false,
    identityVerified: true,                                                    
    verificationLevel: 1,
    kycStatus: "approved",
    verifiedBadge: true,
    isVerified: true,
    verifiedAt: new Date(),
  };

  if (phone) userData.phone = phone;
  if (country) userData.country = country;

                           
  if (profileData.companyName) userData.companyName = profileData.companyName;
  if (profileData.industry) userData.industry = profileData.industry;
  if (profileData.fundingStage) userData.fundingStage = profileData.fundingStage;
  if (profileData.website) userData.website = profileData.website;
  if (profileData.linkedIn) userData.linkedIn = profileData.linkedIn;

                            
  if (profileData.investorType) userData.investorType = profileData.investorType;
  if (profileData.investmentRange) userData.investmentRange = profileData.investmentRange;
  if (profileData.preferredIndustries?.length)
    userData.preferredIndustries = profileData.preferredIndustries;
  if (profileData.preferredStages?.length)
    userData.preferredStages = profileData.preferredStages;
  if (profileData.investmentThesis) userData.investmentThesis = profileData.investmentThesis;

                          
  const user = await User.create(userData);

                     
  const tokenPayload = { _id: user._id.toString(), role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  user.refreshToken = hashRefresh(refreshToken);
  user.lastLoginAt = new Date();
  user.isOnline = true;
  await user.save({ validateBeforeSave: false });

                                                           
  const redis = getRedis();
  await redis.del(`signupSession:${signupSessionId}`);

  return { user: user.toSafeJSON(), accessToken, refreshToken };
};

                                                                               
                                                                                                       
         
                                                                                                          
                                                 
                                     
                                                                    

const skipAndCreateAccount = async (signupSessionId) => {
  const session = await getSession(signupSessionId);

  const { accountData, profileData, role } = session;
  const { name, username, email, passwordHash, phone, country } = accountData;

                           
  if (await User.findOne({ email })) {
    throw new ApiError(409, "Email already registered");
  }
  if (username && (await User.findOne({ username }))) {
    throw new ApiError(409, "Username taken");
  }
  if (phone && (await User.findOne({ phone }))) {
    throw new ApiError(409, "Phone already registered");
  }

                                                              
  const userData = {
    name,
    username,
    email,
    password: passwordHash,
    role,
    emailVerified: false,
    phoneVerified: false,
    identityVerified: false,                    
    verificationLevel: 0,
    kycStatus: "none",
    verifiedBadge: false,
    isVerified: false,
  };

  if (phone) userData.phone = phone;
  if (country) userData.country = country;

  if (profileData.companyName) userData.companyName = profileData.companyName;
  if (profileData.industry) userData.industry = profileData.industry;
  if (profileData.fundingStage) userData.fundingStage = profileData.fundingStage;
  if (profileData.website) userData.website = profileData.website;
  if (profileData.linkedIn) userData.linkedIn = profileData.linkedIn;

  if (profileData.investorType) userData.investorType = profileData.investorType;
  if (profileData.investmentRange) userData.investmentRange = profileData.investmentRange;
  if (profileData.preferredIndustries?.length)
    userData.preferredIndustries = profileData.preferredIndustries;
  if (profileData.preferredStages?.length)
    userData.preferredStages = profileData.preferredStages;
  if (profileData.investmentThesis) userData.investmentThesis = profileData.investmentThesis;

  const user = await User.create(userData);

  const tokenPayload = { _id: user._id.toString(), role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  user.refreshToken = hashRefresh(refreshToken);
  user.lastLoginAt = new Date();
  user.isOnline = true;
  await user.save({ validateBeforeSave: false });

  const redis = getRedis();
  await redis.del(`signupSession:${signupSessionId}`);

  return { user: user.toSafeJSON(), accessToken, refreshToken };
};

                                                                                 

const deleteSession = async (signupSessionId) => {
  if (!signupSessionId) return;
  const redis = getRedis();
  await redis.del(`signupSession:${signupSessionId}`);
};

module.exports = {
  createSession,
  getSession,
  finalizeAccountCreation,
  skipAndCreateAccount,
  deleteSession,
  SESSION_TTL_SECONDS,
};

