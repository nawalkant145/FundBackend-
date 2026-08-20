const express = require("express");
const router = express.Router();
const c = require("./boost.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

router.use(authenticate);

router.get("/tiers", c.tiers);
router.get("/my", c.myBoosts);
router.get("/active", c.activeBoosts);
router.get("/diagnostics/:investorId", authorize("admin"), c.diagnostics);
router.post("/order", c.createOrder);
router.post("/:id/verify", c.verifyPayment);

module.exports = router;
