const express = require("express");
const router = express.Router();
const c = require("./user.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const {
  uploadImage,
  uploadDocument,
} = require("../../middlewares/upload.middleware");

router.use(authenticate);

router.get("/profile", c.getProfile);
router.put("/profile", c.updateProfile);
router.post("/avatar", uploadImage.single("avatar"), c.uploadAvatar);
router.post(
  "/pitch-deck",
  uploadDocument.single("pitchDeck"),
  c.uploadPitchDeck,
);
router.post(
  "/documents",
  uploadDocument.fields([
    { name: "panCard", maxCount: 1 },
    { name: "aadhar", maxCount: 1 },
    { name: "businessReg", maxCount: 1 },
  ]),
  c.submitDocuments,
);
router.get("/verification-status", c.getVerificationStatus);
router.get("/profile-completion", c.getProfileCompletion);
router.put("/fcm-token", c.updateFcmToken);

router.get("/search", c.search);
router.get("/profile-viewers", c.getProfileViewers);
router.get("/recommended-startups", c.getRecommendedStartups);
router.get("/recommended", c.getRecommendedStartups);
router.get("/public/:userId", c.getPublicProfile);

router.post("/block/:userId", c.blockUser);
router.delete("/block/:userId", c.unblockUser);
router.delete("/account", c.deleteAccount);

// Follow system
router.post("/follow/:userId", c.followUser);
router.get("/followers/:userId?", c.getFollowers);
router.get("/following/:userId?", c.getFollowingList);
router.get("/following-check/:userId", c.checkFollowing);

module.exports = router;
