const express = require("express");
const router = express.Router();
const paymentController = require("./payment.controller");
const { authenticate, optionalAuthenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

                                                           
router.post(
  "/create-order",
  authenticate,
  authorize("founder", "investor"),
  paymentController.createCourseOrder
);

                                                
router.post(
  "/guest/create-order",
  paymentController.guestCreateCourseOrder
);

                                                                                      
router.post(
  "/verify",
  optionalAuthenticate,
  paymentController.verifyPayment
);

                                                                
router.post(
  "/webhook/razorpay",
  paymentController.razorpayWebhook
);

module.exports = router;
