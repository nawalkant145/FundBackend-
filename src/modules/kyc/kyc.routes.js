const express = require("express");
const router = express.Router();
const kycController = require("./kyc.controller");
const { authenticate, optionalAuthenticate } = require("../../middlewares/auth.middleware");

// IMPORTANT: the DigiLocker callback must be mounted BEFORE the `authenticate`
// middleware below. DigiLocker redirects the user's browser back to this URL
// directly — it is not an authenticated ExpgloFund API call, so req.user won't
// be populated. Identity is instead recovered from the signed `state` param
// inside kycController.digilockerCallback -> kycService.handleDigilockerCallback.
router.get("/digilocker/callback", kycController.digilockerCallback);

// DigiLocker authorize: open to both authenticated users (existing account KYC)
// AND unauthenticated pre-account signup flows (signupSessionId query param).
// optionalAuthenticate populates req.user if a valid token is present, else null.
router.get("/digilocker/authorize", optionalAuthenticate, kycController.authorizeDigilocker);

const { uploadDocument } = require("../../middlewares/upload.middleware");

// Use uploadDocument.any() to handle any field name sent by the frontend
const kycUpload = uploadDocument.any();

router.use(authenticate);

router.get("/status", kycController.getVerificationStatus);
router.get("/:id", kycController.getKycDetails);
router.post("/personal", kycUpload, kycController.submitPersonalKyc);
router.put("/resubmit", kycUpload, kycController.resubmitPersonalKyc);
router.post("/company", kycUpload, kycController.submitCompanyKyc);
router.post("/investment", kycUpload, kycController.submitInvestmentKyc);

// DigiLocker automatic verification (authenticated routes)
router.get("/digilocker/status", kycController.getDigilockerStatus);
router.post("/digilocker/fallback", kycController.digilockerFallback);


module.exports = router;