const express = require("express");
const router = express.Router();
const c = require("./video.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const {
  authorize,
  requireVerificationLevel,
} = require("../../middlewares/role.middleware");
const { uploadVideo } = require("../../middlewares/upload.middleware");

router.use(authenticate);

const { requireFounderVerified } = require("../../middlewares/verification.middleware");

// Founder routes
router.post(
  "/upload",
  authorize("founder"),
  requireFounderVerified,
  uploadVideo.single("video"),
  c.upload,
);
router.get("/my-pitches", authorize("founder"), c.myPitches);
router.get("/:id/analytics", authorize("founder"), c.analytics);
router.put("/:id", authorize("founder"), c.update);
router.delete("/:id", authorize("founder"), c.remove);
router.post("/:id/renew", authorize("founder"), c.renew);
router.post("/:id/pause-toggle", authorize("founder"), c.togglePause);

// Feed & engagement routes (both founders and investors can browse and interact)
router.get("/feed", c.feed);
router.get("/saved", c.savedPitches);
router.post("/:id/like", c.like);
router.post("/:id/save", c.save);
router.post("/:id/not-interested", c.notInterested);

// Both
router.get("/trending", c.trending);
router.get("/search", c.search);
router.get("/user/:userId", c.userPitches);
router.get("/:id", c.getOne);
router.post("/:id/view", c.logView);

module.exports = router;
