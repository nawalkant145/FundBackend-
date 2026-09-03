const express = require("express");
const router = express.Router();
const kycController = require("./kyc.controller");
const { authenticate, optionalAuthenticate } = require("../../middlewares/auth.middleware");

                                                                               
                                                                             
                                                                               
                                                                            
                                                                                  
router.get("/digilocker/callback", kycController.digilockerCallback);

                                                                                
                                                                              
                                                                                  
router.get("/digilocker/authorize", optionalAuthenticate, kycController.authorizeDigilocker);

router.use(authenticate);

router.get("/status", kycController.getVerificationStatus);
router.get("/:id", kycController.getKycDetails);
router.post("/personal", kycController.submitPersonalKyc);
router.put("/resubmit", kycController.resubmitPersonalKyc);
router.post("/company", kycController.submitCompanyKyc);
router.post("/investment", kycController.submitInvestmentKyc);

                                                           
router.get("/digilocker/status", kycController.getDigilockerStatus);
router.post("/digilocker/fallback", kycController.digilockerFallback);


module.exports = router;