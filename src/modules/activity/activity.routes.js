const express = require("express");
const router = express.Router();
const c = require("./activity.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);
router.get("/dashboard", c.dashboard);

module.exports = router;
