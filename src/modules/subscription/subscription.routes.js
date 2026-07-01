const express = require("express");
const router = express.Router();
const c = require("./subscription.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);

router.get("/me", c.mine);
router.post("/order", c.createOrder);
router.post("/:id/verify", c.verifyPayment);
router.post("/cancel", c.cancel);

module.exports = router;
