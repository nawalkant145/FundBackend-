const express = require("express");
const router = express.Router();
const kycController = require("./kyc.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

// IMPORTANT: the DigiLocker callback must be mounted BEFORE the `authenticate`
// middleware below. DigiLocker redirects the user's browser back to this URL
// directly — it is not an authenticated ExpgloFund API call, so req.user won't
// be populated. Identity is instead recovered from the signed `state` param
// inside kycController.digilockerCallback -> kycService.handleDigilockerCallback.
router.get("/digilocker/callback", kycController.digilockerCallback);

/* === PRE-ACCOUNT DIGILOCKER AUTHORIZE ROUTE (Commented out — uncomment when mandatory pre-account KYC is enabled) ===
// router.get("/digilocker/authorize", optionalAuthenticate, kycController.authorizeDigilocker);
==================================================================================================================== */

router.use(authenticate);

router.get("/status", kycController.getVerificationStatus);
router.get("/:id", kycController.getKycDetails);
router.post("/personal", kycController.submitPersonalKyc);
router.put("/resubmit", kycController.resubmitPersonalKyc);
router.post("/company", kycController.submitCompanyKyc);
router.post("/investment", kycController.submitInvestmentKyc);

// DigiLocker automatic verification (authenticated routes)
router.get("/digilocker/authorize", kycController.authorizeDigilocker);
router.get("/digilocker/status", kycController.getDigilockerStatus);
router.post("/digilocker/fallback", kycController.digilockerFallback);

module.exports = router;