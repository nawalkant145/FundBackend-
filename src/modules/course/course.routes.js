const express = require("express");
const router = express.Router();
const { sendCourseReceipt } = require("./course.controller");

// POST /api/course/send-receipt
// Body: { email, name, courseTitle, price, paymentMethod, transactionId? }
router.post("/send-receipt", sendCourseReceipt);

module.exports = router;
