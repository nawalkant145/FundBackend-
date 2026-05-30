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

// Founder routes
router.post(
  "/upload",
  authorize("founder"),
  requireVerificationLevel(2),
  uploadVideo.single("video"),
  c.upload,
);
router.get("/my-pitches", authorize("founder"), c.myPitches);
router.get("/:id/analytics", authorize("founder"), c.analytics);
router.put("/:id", authorize("founder"), c.update);
router.delete("/:id", authorize("founder"), c.remove);
router.post("/:id/renew", authorize("founder"), c.renew);
router.post("/:id/pause-toggle", authorize("founder"), c.togglePause);

// Investor routes
router.get("/feed", authorize("investor"), c.feed);
router.get("/saved", authorize("investor"), c.savedPitches);
router.post("/:id/like", authorize("investor"), c.like);
router.post("/:id/save", authorize("investor"), c.save);
router.post("/:id/not-interested", authorize("investor"), c.notInterested);

// Both
router.get("/trending", c.trending);
router.get("/search", c.search);
router.get("/:id", c.getOne);
router.post("/:id/view", c.logView);

module.exports = router;
