const express = require("express");
const router = express.Router();
const c = require("./report.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);
router.post("/", c.create);
router.get("/my-reports", c.myReports);

module.exports = router;
