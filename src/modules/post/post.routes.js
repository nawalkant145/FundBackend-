const express = require("express");
const router = express.Router();
const c = require("./post.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const { uploadImage } = require("../../middlewares/upload.middleware");

router.use(authenticate);

// Create post with images (founder only, up to 10 images)
router.post(
  "/",
  authorize("founder"),
  uploadImage.array("images", 10),
  c.create,
);

// Create text-only (thoughts) post — no image upload allowed
router.post("/thoughts", authorize("founder"), c.createThoughts);

// Feed (all authenticated users)
router.get("/feed", c.feed);

// My posts (founder)
router.get("/my-posts", authorize("founder"), c.myPosts);

// Saved posts (all authenticated users)
router.get("/saved", c.savedPosts);

// User's posts (public profile)
router.get("/user/:userId", c.userPosts);

// Single post CRUD
router.get("/:id", c.getOne);
router.put("/:id", authorize("founder"), c.update);
router.delete("/:id", authorize("founder"), c.remove);

// Engagement
router.post("/:id/like", c.like);
router.post("/:id/save", c.save);

module.exports = router;
