const express = require("express");
const router = express.Router();
const kycController = require("./kyc.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);

router.get("/status", kycController.getVerificationStatus);
router.post("/personal", kycController.submitPersonalKyc);
router.post("/company", kycController.submitCompanyKyc);
router.post("/investment", kycController.submitInvestmentKyc);

module.exports = router;
