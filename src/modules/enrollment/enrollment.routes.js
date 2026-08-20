const express = require("express");
const router = express.Router();
const c = require("./enrollment.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

// Restrict course enrollment, purchases, and learning progress to Founder and Investor roles
router.post(
  "/purchase",
  authenticate,
  authorize("founder", "investor"),
  c.purchaseCourse
);

router.post(
  "/claim-purchase",
  authenticate,
  authorize("founder", "investor"),
  c.claimPurchase
);

router.get(
  "/my-courses",
  authenticate,
  authorize("founder", "investor"),
  c.getMyCourses
);

router.get(
  "/:courseId",
  authenticate,
  authorize("founder", "investor"),
  c.getEnrollment
);

router.patch(
  "/:courseId/progress",
  authenticate,
  authorize("founder", "investor"),
  c.updateProgress
);

module.exports = router;
