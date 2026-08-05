const express = require("express");
const router = express.Router();
const kycController = require("./kyc.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);

router.get("/status", kycController.getVerificationStatus);
router.get("/:id", kycController.getKycDetails);
router.post("/personal", kycController.submitPersonalKyc);
router.put("/resubmit", kycController.resubmitPersonalKyc);
router.post("/company", kycController.submitCompanyKyc);
router.post("/investment", kycController.submitInvestmentKyc);

module.exports = router;
