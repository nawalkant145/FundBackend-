const crypto = require("crypto");
const KYC = require("./kyc.model");
const Company = require("../company/company.model");
const InvestmentKYC = require("../investmentKyc/investmentKyc.model");
const RiskAssessment = require("../risk/risk.model");
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");
const kycEvents = require("../../events/kyc.events");
const digilockerService = require("../../services/digilocker.service");
const path = require("path");
const { uploadToS3 } = require("../../config/aws");

const fs = require("fs");

const processFileUploadToS3 = async (file, folder = "identity") => {
  if (!file) return "";

  // Case A: Multer Disk Storage file object
  if (typeof file === "object" && file.path) {
    console.log("📤 Identity file received (Multer Disk Storage):", {
      fileName: file.originalname || path.basename(file.path),
      filePath: file.path,
      mimetype: file.mimetype,
      size: file.size,
    });
    const s3Key = `uploads/${folder}/${Date.now()}-${file.filename || path.basename(file.path)}`;
    console.log("☁️ Calling uploadToS3()...", { localPath: file.path, s3Key });
    try {
      const uploadResult = await uploadToS3(file.path, s3Key, false, {
        contentType: file.mimetype,
      });
      console.log("✅ S3 upload result:", uploadResult);
      return uploadResult.url;
    } catch (error) {
      console.error("❌ Identity S3 upload failed:", error);
      throw error;
    }
  }

  // Case B: Base64 Data URI string (e.g., "data:image/jpeg;base64,...")
  if (typeof file === "string" && file.startsWith("data:")) {
    console.log("📤 Identity file received (Base64 Data URI string)");
    try {
      const matches = file.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new ApiError(400, "Invalid base64 image data URI format");
      }
      const mimetype = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      const ext = mimetype.split("/")[1] || "png";

      const tempDir = path.join(process.cwd(), "tmp", "uploads");
      fs.mkdirSync(tempDir, { recursive: true });
      const tempFilePath = path.join(tempDir, `base64-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`);
      fs.writeFileSync(tempFilePath, buffer);

      const s3Key = `uploads/${folder}/${Date.now()}-base64.${ext}`;
      console.log("☁️ Calling uploadToS3() for base64 file...", { localPath: tempFilePath, s3Key });
      const uploadResult = await uploadToS3(tempFilePath, s3Key, false, { contentType: mimetype });
      console.log("✅ S3 upload result for base64:", uploadResult);
      return uploadResult.url;
    } catch (error) {
      console.error("❌ Base64 S3 upload failed:", error);
      throw error;
    }
  }

  // Case C: Standard HTTP / HTTPS URL
  if (typeof file === "string" && (file.startsWith("http://") || file.startsWith("https://"))) {
    return file;
  }

  // Reject invalid Blob URLs
  if (typeof file === "string" && file.startsWith("blob:")) {
    console.error("❌ Blob URL received instead of binary file or base64 payload:", file);
    throw new ApiError(400, "Blob URLs cannot be saved. Please send binary file or base64 data.");
  }

  if (typeof file === "string" && file.trim().length > 0) {
    return file;
  }

  return "";
};

const resolveFileAndUpload = async (keyNames = [], body = {}, files = null, singleFile = null, folder = "identity") => {
  const keys = Array.isArray(keyNames) ? keyNames : [keyNames];
  let fileToUpload = null;

  // 1. Check array files (e.g., from uploadDocument.any())
  if (Array.isArray(files)) {
    fileToUpload = files.find((f) => keys.includes(f.fieldname));
  }
  // 2. Check object files (e.g., from uploadDocument.fields())
  else if (files && typeof files === "object") {
    for (const key of keys) {
      if (files[key] && files[key][0]) {
        fileToUpload = files[key][0];
        break;
      }
    }
  }

  // 3. Check single file (req.file)
  if (!fileToUpload && singleFile) {
    if (keys.some((k) => singleFile.fieldname === k || k === "documentFront" || k === "selfie" || k === "file")) {
      fileToUpload = singleFile;
    }
  }

  // 4. Check body (req.body)
  if (!fileToUpload && body) {
    for (const key of keys) {
      if (body[key]) {
        fileToUpload = body[key];
        break;
      }
    }
  }

  if (!fileToUpload) return "";
  return processFileUploadToS3(fileToUpload, folder);
};


// Unified Level Status Card & Progress Calculator
const getVerificationStatus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const [kycDoc, companyDoc, investorKycDoc, riskDoc] = await Promise.all([
    KYC.findOne({ userId }).sort({ createdAt: -1 }),
    Company.findOne({ founderId: userId }).sort({ createdAt: -1 }),
    InvestmentKYC.findOne({ investorId: userId }).sort({ createdAt: -1 }),
    RiskAssessment.findOne({ userId }).sort({ createdAt: -1 }),
  ]);

  // Ensure levels and profile completeness are updated
  user.recomputeVerificationLevel();

  return {
    verificationLevel: user.verificationLevel,
    isVerified: user.isVerified || user.verifiedBadge,
    verifiedBadge: user.verifiedBadge,
    verifiedAt: user.verifiedAt,
    profileCompleteness: user.profileCompleteness || 20,
    badges: {
      isIdentityVerified: user.isIdentityVerified || user.verificationLevel >= 2,
      isBusinessVerified: user.isBusinessVerified || (user.role === "founder" && user.companyVerificationStatus === "approved"),
      isOrganizationVerified: user.isOrganizationVerified || (user.role === "investor" && user.investmentVerificationStatus === "approved"),
      isInvestorProfileVerified: user.isInvestorProfileVerified || (user.role === "investor" && user.investmentVerificationStatus === "approved"),
      isStartupProfileComplete: user.profileCompleteness >= 70,
      dueDiligenceStatus: user.dueDiligenceStatus || "none",
    },
    statusCard: {
      emailVerified: {
        level: 1,
        status: user.isEmailVerified ? "completed" : "pending",
        verified: user.isEmailVerified,
      },
      mobileVerified: {
        level: 1,
        status: user.isPhoneVerified ? "completed" : "pending",
        verified: user.isPhoneVerified,
      },
      identityVerified: {
        level: 2,
        status: kycDoc?.verificationStatus || user.kycStatus || user.documents?.status || "none",
        verified: user.isIdentityVerified || user.verificationLevel >= 2,
        rejectionReason: kycDoc?.rejectionReason || user.documents?.rejectionReason || "",
        badge: user.verifiedBadge,
        submittedAt: kycDoc?.createdAt || user.documents?.submittedAt,
        verificationMethod: kycDoc?.verificationMethod || "manual",
        manualReviewRequired: kycDoc?.manualReviewRequired || false,
      },
      founderVerification: {
        level: 3,
        status: user.companyVerificationStatus || companyDoc?.verificationStatus || "none",
        verified: user.isBusinessVerified || (user.role === "founder" && user.companyVerificationStatus === "approved"),
        companyName: companyDoc?.companyName || user.companyName || "",
        rejectionReason: companyDoc?.rejectionReason || "",
      },
      investmentKyc: {
        level: 4,
        status: user.investmentVerificationStatus || investorKycDoc?.verificationStatus || "none",
        verified: user.isInvestorProfileVerified || (user.role === "investor" && user.investmentVerificationStatus === "approved"),
        rejectionReason: investorKycDoc?.rejectionReason || "",
      },
      dueDiligence: {
        status: user.dueDiligenceStatus || "none",
        completed: user.dueDiligenceStatus === "completed",
      },
      riskStatus: {
        level: 5,
        riskLevel: user.riskLevel || riskDoc?.riskLevel || "low",
        restricted: user.riskLevel === "critical" || user.isSuspended(),
      },
    },
  };
};

const generateReferenceId = () => {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `KYC-${dateStr}-${rand}`;
};

// Phase 2 Personal Identity Submission (manual upload path with AWS S3)
const submitPersonalKyc = async (userId, body = {}, files = {}, singleFile = null) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  console.log("========== KYC SERVICE FILE DEBUG ==========");
  console.log("Files received by service:", files);
  console.log(
    "Document front:",
    Array.isArray(files)
      ? files.find((f) => ["documentFront", "frontImage", "identityFront", "front", "panCard"].includes(f.fieldname))
      : files?.documentFront || files?.frontImage || files?.panCard
  );
  console.log(
    "Document back:",
    Array.isArray(files)
      ? files.find((f) => ["documentBack", "backImage", "identityBack", "back", "aadhar"].includes(f.fieldname))
      : files?.documentBack || files?.backImage || files?.aadhar
  );
  console.log(
    "Selfie:",
    Array.isArray(files)
      ? files.find((f) => ["selfie", "selfieImage"].includes(f.fieldname))
      : files?.selfie || files?.selfieImage
  );
  console.log("============================================");

  const documentType = body.documentType || body.type || "pan";
  const documentNumber = body.documentNumber || "";

  const frontKeys = ["documentFront", "frontImage", "identityFront", "front", "panCard", "idFront", "file", "document", "image"];
  const backKeys = ["documentBack", "backImage", "identityBack", "back", "aadhar", "idBack"];
  const selfieKeys = ["selfie", "selfieImage"];

  let frontUrl = await resolveFileAndUpload(frontKeys, body, files, singleFile, "identity/front");
  let backUrl = await resolveFileAndUpload(backKeys, body, files, singleFile, "identity/back");
  let selfieUrl = await resolveFileAndUpload(selfieKeys, body, files, singleFile, "identity/selfie");

  if (!documentType || !frontUrl || !selfieUrl) {
    throw new ApiError(400, "documentType, documentFront (or front image), and selfie are required for identity verification");
  }

  const docHash = documentNumber
    ? crypto.createHash("sha256").update(documentNumber.trim().toUpperCase()).digest("hex")
    : "";

  // Duplicate document check across different accounts
  if (docHash) {
    const existing = await KYC.findOne({ documentNumberHash: docHash, userId: { $ne: userId } });
    if (existing) {
      await RiskAssessment.create({
        userId,
        riskScore: 75,
        riskLevel: "high",
        triggers: [{ reason: "Duplicate ID document number attempted on multiple accounts" }],
      });
      user.riskLevel = "high";
      await user.save({ validateBeforeSave: false });
      throw new ApiError(400, "This ID document is already registered with another account.");
    }
  }

  const referenceId = generateReferenceId();

  const kyc = await KYC.create({
    userId,
    referenceId,
    documentType,
    documentNumber: documentNumber ? documentNumber.trim() : "",
    documentNumberHash: docHash,
    documentFront: frontUrl,
    documentBack: backUrl || "",
    selfie: selfieUrl,
    verificationStatus: "under_review",
    verificationMethod: "manual",
    history: [
      {
        action: "submitted",
        performedBy: userId,
        notes: "Initial document submission received",
        timestamp: new Date(),
      },
    ],
  });

  user.kycStatus = "under_review";
  user.documents = {
    referenceId,
    panCard: frontUrl,
    aadhar: backUrl || "",
    status: "under_review",
    submittedAt: new Date(),
  };
  await user.save({ validateBeforeSave: false });

  kycEvents.emit("kyc:submitted", { userId, kycId: kyc._id, referenceId });

  return kyc;
};

// Resubmit Personal Identity Docs (manual upload path with AWS S3)
const resubmitPersonalKyc = async (userId, body = {}, files = {}, singleFile = null) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  console.log("========== KYC SERVICE FILE DEBUG ==========");
  console.log("Files received by service:", files);
  console.log(
    "Document front:",
    Array.isArray(files)
      ? files.find((f) => ["documentFront", "frontImage", "identityFront", "front", "panCard"].includes(f.fieldname))
      : files?.documentFront || files?.frontImage || files?.panCard
  );
  console.log(
    "Document back:",
    Array.isArray(files)
      ? files.find((f) => ["documentBack", "backImage", "identityBack", "back", "aadhar"].includes(f.fieldname))
      : files?.documentBack || files?.backImage || files?.aadhar
  );
  console.log(
    "Selfie:",
    Array.isArray(files)
      ? files.find((f) => ["selfie", "selfieImage"].includes(f.fieldname))
      : files?.selfie || files?.selfieImage
  );
  console.log("============================================");

  const documentType = body.documentType || body.type || "pan";
  const documentNumber = body.documentNumber || "";

  const frontKeys = ["documentFront", "frontImage", "identityFront", "front", "panCard", "idFront", "file", "document", "image"];
  const backKeys = ["documentBack", "backImage", "identityBack", "back", "aadhar", "idBack"];
  const selfieKeys = ["selfie", "selfieImage"];

  let frontUrl = await resolveFileAndUpload(frontKeys, body, files, singleFile, "identity/front");
  let backUrl = await resolveFileAndUpload(backKeys, body, files, singleFile, "identity/back");
  let selfieUrl = await resolveFileAndUpload(selfieKeys, body, files, singleFile, "identity/selfie");

  if (!documentType || !frontUrl || !selfieUrl) {
    throw new ApiError(400, "documentType, documentFront (or front image), and selfie are required for identity verification");
  }

  const prevKyc = await KYC.findOne({ userId }).sort({ createdAt: -1 });
  const attemptsCount = (prevKyc?.attemptsCount || 1) + 1;

  const docHash = documentNumber
    ? crypto.createHash("sha256").update(documentNumber.trim().toUpperCase()).digest("hex")
    : "";

  const referenceId = prevKyc?.referenceId || generateReferenceId();

  const kyc = await KYC.create({
    userId,
    referenceId,
    documentType,
    documentNumber: documentNumber ? documentNumber.trim() : "",
    documentNumberHash: docHash,
    documentFront: frontUrl,
    documentBack: backUrl || "",
    selfie: selfieUrl,
    verificationStatus: "under_review",
    verificationMethod: "manual",
    attemptsCount,
    history: [
      ...(prevKyc?.history || []),
      {
        action: "resubmitted",
        performedBy: userId,
        notes: `Resubmission attempt #${attemptsCount}`,
        timestamp: new Date(),
      },
    ],
  });

  user.kycStatus = "under_review";
  user.documents = {
    referenceId,
    panCard: frontUrl,
    aadhar: backUrl || "",
    status: "under_review",
    rejectionReason: "",
    submittedAt: new Date(),
  };
  await user.save({ validateBeforeSave: false });

  kycEvents.emit("kyc:resubmitted", { userId, kycId: kyc._id, referenceId });

  return kyc;
};

// Fetch KYC Submission Details by ID
const getKycById = async (id) => {
  const kyc = await KYC.findById(id)
    .populate("userId", "name email role phone avatar companyName verificationLevel")
    .populate("history.performedBy", "name email role");
  if (!kyc) throw new ApiError(404, "KYC Submission record not found");
  return kyc;
};

// Phase 3 Founder Company Verification Submission (unchanged)
const submitCompanyKyc = async (userId, { companyName, CIN, GST, registrationCertificate, companyPAN, startupIndiaCert, businessEmail }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (user.role !== "founder") throw new ApiError(403, "Only founders can submit company verification");

  if (!companyName || !CIN || !registrationCertificate || !companyPAN || !businessEmail) {
    throw new ApiError(400, "companyName, CIN, registrationCertificate, companyPAN, and businessEmail are required");
  }

  const company = await Company.create({
    founderId: userId,
    companyName: companyName.trim(),
    CIN: CIN.trim().toUpperCase(),
    GST: GST ? GST.trim().toUpperCase() : "",
    registrationCertificate,
    companyPAN: companyPAN.trim().toUpperCase(),
    startupIndiaCert: startupIndiaCert || "",
    businessEmail: businessEmail.trim().toLowerCase(),
    verificationStatus: "pending",
  });

  user.companyName = companyName;
  user.companyVerificationStatus = "pending";
  await user.save({ validateBeforeSave: false });

  return company;
};

// Phase 4 Investor Transaction KYC Submission (unchanged)
const submitInvestmentKyc = async (userId, { addressProof, bankAccount, incomeProofUrl, netWorthDeclaration }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (user.role !== "investor") throw new ApiError(403, "Only investors can submit transaction KYC");

  if (!addressProof?.docUrl || !bankAccount?.accountNumber || !bankAccount?.ifscCode) {
    throw new ApiError(400, "addressProof docUrl, bank account number, and IFSC code are required");
  }

  const investorKyc = await InvestmentKYC.create({
    investorId: userId,
    addressProof,
    bankAccount: {
      accountNumber: bankAccount.accountNumber,
      ifscCode: bankAccount.ifscCode,
      bankName: bankAccount.bankName || "Verified Bank",
      proofUrl: bankAccount.proofUrl || "",
      isVerified: true,
    },
    incomeProofUrl: incomeProofUrl || "",
    netWorthDeclaration: netWorthDeclaration || { declaredAmount: 0 },
    amlStatus: "passed",
    sanctionsCheck: "clear",
    verificationStatus: "pending",
  });

  user.investmentVerificationStatus = "pending";
  await user.save({ validateBeforeSave: false });

  return investorKyc;
};

// ============================================================================
// DigiLocker automatic KYC verification
// ============================================================================

// Step 1 — user clicks "Verify with DigiLocker"
// When called during signup (before account creation), signupSessionId is provided.
// When called by an authenticated user, userId is provided (existing post-account KYC).
const initiateDigilockerVerification = async (userId, { signupSessionId } = {}) => {
  if (signupSessionId) {
    // Pre-account signup flow — validate the session exists before redirecting
    const signupSessionService = require("../auth/signupSession.service");
    const session = await signupSessionService.getSession(signupSessionId);
    // Generate the OAuth URL embedding signupSessionId in the signed state
    const { url, state } = digilockerService.getAuthorizationUrl(null, { signupSessionId });
    return { redirectUrl: url, state };
  }

  // Existing post-account flow — user already has a MongoDB User record
  const user = await User.findById(userId);


  if (!user) throw new ApiError(404, "User not found");

  const { url, state } = digilockerService.getAuthorizationUrl(userId);

  await KYC.create({
    userId,
    referenceId: generateReferenceId(),
    documentType: "aadhar", // placeholder; DigiLocker may supply multiple doc types
    documentFront: "digilocker-pending", // required field on schema; not used for this method
    selfie: "digilocker-pending",
    verificationStatus: "under_review",
    verificationMethod: "digilocker",
    digilockerStatus: "initiated",
    history: [{ action: "submitted", performedBy: userId, notes: "DigiLocker verification initiated" }],
  });

  user.kycStatus = "digilocker_pending";
  await user.save({ validateBeforeSave: false });

  return { redirectUrl: url, state };
};


// Step 2 — DigiLocker redirects back with ?code=...&state=...
const handleDigilockerCallback = async ({ code, state }) => {
  if (!code) throw new ApiError(400, "Missing authorization code from DigiLocker");

  const statePayload = digilockerService.verifyState(state);
  const { userId, signupSessionId } = statePayload;

  // ── PRE-ACCOUNT SIGNUP FLOW ──────────────────────────────────────────────
  // The user has NOT yet been created in MongoDB.
  // On success: create permanent User + issue JWT.
  // On failure: do NOT create User, do NOT issue JWT.
  if (signupSessionId) {
    const signupSessionService = require("../auth/signupSession.service");

    let tokenResponse;
    try {
      tokenResponse = await digilockerService.exchangeCodeForToken(code);
    } catch (err) {
      // Verification failed — return failed status (no user created)
      return { status: "failed", signupSessionId, reason: "OAuth token exchange failed" };
    }

    const { extractedData, documentsVerified } = await digilockerService.retrieveAndParseDocuments(
      tokenResponse.access_token
    );

    if (documentsVerified.length === 0) {
      return { status: "failed", signupSessionId, reason: "No documents returned by DigiLocker" };
    }

    // Retrieve session to check name match
    let session;
    try {
      session = await signupSessionService.getSession(signupSessionId);
    } catch {
      return { status: "failed", signupSessionId, reason: "Signup session expired" };
    }

    const match = matchIdentity({
      accountName: session.accountData.name,
      accountDob: null,
      digilockerName: extractedData.name,
      digilockerDob: extractedData.dob,
    });

    if (!match.passed) {
      // Identity mismatch — fail (do not create account)
      return { status: "failed", signupSessionId, reason: "Identity name mismatch" };
    }

    // Verification passed — finalize permanent account creation
    try {
      const result = await signupSessionService.finalizeAccountCreation(signupSessionId, {
        kycDetails: { extractedData, documentsVerified, digilockerReference: tokenResponse.digilocker_id || "" },
      });
      // Result contains { user, accessToken, refreshToken } to be sent back in cookies
      return { status: "approved", ...result };
    } catch (err) {
      // Account creation failed (e.g., race-condition duplicate) — do not leave orphaned state
      return { status: "failed", signupSessionId, reason: err.message };
    }
  }



  // ── POST-ACCOUNT FLOW (Existing Authenticated User) ──────────────────────
  // The user already has a MongoDB User record (they are doing KYC post-signup).
  const kyc = await KYC.findOne({ userId, verificationMethod: "digilocker" }).sort({ createdAt: -1 });
  if (!kyc) throw new ApiError(404, "No pending DigiLocker verification found for this user");

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  kyc.digilockerStatus = "verifying";
  await kyc.save();

  let tokenResponse;
  try {
    tokenResponse = await digilockerService.exchangeCodeForToken(code);
  } catch (err) {
    kyc.digilockerStatus = "failed";
    kyc.verificationResult = "failed";
    kyc.failureReason = "OAuth token exchange failed";
    await kyc.save();
    user.kycStatus = "rejected";
    await user.save({ validateBeforeSave: false });
    throw err;
  }

  const { extractedData, documentsVerified } = await digilockerService.retrieveAndParseDocuments(
    tokenResponse.access_token
  );

  const match = matchIdentity({
    accountName: user.name,
    accountDob: user.dateOfBirth || user.dob,
    digilockerName: extractedData.name,
    digilockerDob: extractedData.dob,
  });

  kyc.digilockerReference = tokenResponse.digilocker_id || "";
  kyc.documentsVerified = documentsVerified;
  kyc.extractedData = {
    name: extractedData.name,
    dob: extractedData.dob,
    gender: extractedData.gender,
    panNumber: extractedData.panNumber,
    aadhaarMasked: extractedData.aadhaarMasked || "",
  };
  kyc.matchConfidence = match.nameScore;

  if (documentsVerified.length === 0) {
    kyc.digilockerStatus = "failed";
    kyc.verificationResult = "failed";
    kyc.failureReason = "No documents were returned by DigiLocker";
    kyc.manualReviewRequired = false;
    await kyc.save();

    user.kycStatus = "rejected";
    await user.save({ validateBeforeSave: false });

    kycEvents.emit("kyc:rejected", { userId, reason: kyc.failureReason, adminId: null });
    return { status: "failed", kyc };
  }

  if (match.passed) {
    kyc.digilockerStatus = "completed";
    kyc.verificationStatus = "approved";
    kyc.verificationResult = "passed";
    kyc.manualReviewRequired = false;
    kyc.verifiedAt = new Date();
    kyc.history.push({ action: "approved", notes: "Auto-approved via DigiLocker", timestamp: new Date() });
    await kyc.save();

    kycEvents.emit("kyc:approved", { userId, adminId: null });
    return { status: "approved", kyc };
  }

  // Name/DOB didn't clear the auto-approval bar — route to human review, not a rejection.
  kyc.digilockerStatus = "completed";
  kyc.verificationStatus = "under_review";
  kyc.verificationResult = "manual_review_required";
  kyc.manualReviewRequired = true;
  await kyc.save();

  user.kycStatus = "manual_review";
  await user.save({ validateBeforeSave: false });

  return { status: "manual_review", kyc };
};


// Step 3 — frontend polls this while waiting for the callback to complete
const getDigilockerStatus = async (userId) => {
  const kyc = await KYC.findOne({ userId, verificationMethod: "digilocker" }).sort({ createdAt: -1 });
  if (!kyc) throw new ApiError(404, "No DigiLocker verification found for this user");

  return {
    digilockerStatus: kyc.digilockerStatus,
    verificationStatus: kyc.verificationStatus,
    verificationResult: kyc.verificationResult,
    manualReviewRequired: kyc.manualReviewRequired,
    matchConfidence: kyc.matchConfidence,
    documentsVerified: kyc.documentsVerified,
    failureReason: kyc.failureReason,
  };
};

// Fallback — user opts into (or is routed to) manual upload after a DigiLocker failure
const fallbackToManual = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  user.kycStatus = "none";
  await user.save({ validateBeforeSave: false });

  return { message: "You can now submit documents manually." };
};

module.exports = {
  getVerificationStatus,
  submitPersonalKyc,
  resubmitPersonalKyc,
  getKycById,
  submitCompanyKyc,
  submitInvestmentKyc,
  initiateDigilockerVerification,
  handleDigilockerCallback,
  getDigilockerStatus,
  fallbackToManual,
};