const express = require("express");
const router = express.Router();
const c = require("./investment.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

const { requireInvestorVerified } = require("../../middlewares/verification.middleware");

router.use(authenticate);

router.post("/express-interest", requireInvestorVerified, c.expressInterest);
router.put("/:id/stage", c.updateStage);
router.post("/:id/pay", requireInvestorVerified, c.createOrder);
router.post("/:id/verify-payment", c.verifyPayment);
router.get("/my-deals", c.myDeals);
router.get("/:id", c.getOne);

module.exports = router;
