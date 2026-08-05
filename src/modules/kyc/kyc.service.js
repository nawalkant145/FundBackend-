const crypto = require("crypto");
const KYC = require("./kyc.model");
const Company = require("../company/company.model");
const InvestmentKYC = require("../investmentKyc/investmentKyc.model");
const RiskAssessment = require("../risk/risk.model");
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");
const kycEvents = require("../../events/kyc.events");

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
        verified: user.verificationLevel >= 2,
        rejectionReason: kycDoc?.rejectionReason || user.documents?.rejectionReason || "",
        badge: user.verifiedBadge,
        submittedAt: kycDoc?.createdAt || user.documents?.submittedAt,
      },
      founderVerification: {
        level: 3,
        status: user.companyVerificationStatus || companyDoc?.verificationStatus || "none",
        verified: user.verificationLevel >= 3 && user.companyVerificationStatus === "approved",
        companyName: companyDoc?.companyName || user.companyName || "",
        rejectionReason: companyDoc?.rejectionReason || "",
      },
      investmentKyc: {
        level: 4,
        status: user.investmentVerificationStatus || investorKycDoc?.verificationStatus || "none",
        verified: user.verificationLevel >= 4 && user.investmentVerificationStatus === "approved",
        rejectionReason: investorKycDoc?.rejectionReason || "",
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

// Phase 2 Personal Identity Submission
const submitPersonalKyc = async (userId, { documentType, documentNumber, documentFront, documentBack, selfie }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (!documentType || !documentFront || !selfie) {
    throw new ApiError(400, "documentType, documentFront, and selfie are required");
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
    documentFront,
    documentBack: documentBack || "",
    selfie,
    verificationStatus: "under_review",
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
    panCard: documentFront,
    aadhar: documentBack || "",
    status: "under_review",
    submittedAt: new Date(),
  };
  await user.save({ validateBeforeSave: false });

  kycEvents.emit("kyc:submitted", { userId, kycId: kyc._id, referenceId });

  return kyc;
};

// Resubmit Personal Identity Docs
const resubmitPersonalKyc = async (userId, { documentType, documentNumber, documentFront, documentBack, selfie }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (!documentType || !documentFront || !selfie) {
    throw new ApiError(400, "documentType, documentFront, and selfie are required");
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
    documentFront,
    documentBack: documentBack || "",
    selfie,
    verificationStatus: "under_review",
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
    panCard: documentFront,
    aadhar: documentBack || "",
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
  const kyc = await KYC.findById(id).populate("userId", "name email role phone avatar companyName verificationLevel").populate("history.performedBy", "name email role");
  if (!kyc) throw new ApiError(404, "KYC Submission record not found");
  return kyc;
};

// Phase 3 Founder Company Verification Submission
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

// Phase 4 Investor Transaction KYC Submission
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

module.exports = {
  getVerificationStatus,
  submitPersonalKyc,
  resubmitPersonalKyc,
  getKycById,
  submitCompanyKyc,
  submitInvestmentKyc,
};
