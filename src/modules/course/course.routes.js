const express = require("express");
const router = express.Router();
const c = require("./course.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const { uploadCourseMedia } = require("../../middlewares/upload.middleware");

// Helper middleware to optionally extract user if JWT token is provided
const optionalAuthenticate = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    return authenticate(req, res, next);
  }
  next();
};

// -------------------------------------------------------------
// Public / General Routes
// -------------------------------------------------------------

// GET /api/course - Get published courses (Public)
router.get("/", c.getPublishedCourses);

// POST /api/course/send-receipt - Send enrollment receipt email
router.post("/send-receipt", c.sendCourseReceipt);

// -------------------------------------------------------------
// Founder-only Routes (Course Management)
// -------------------------------------------------------------

// GET /api/course/my-courses - Get courses created by logged-in Founder
router.get("/my-courses", authenticate, authorize("founder"), c.getMyCourses);

// POST /api/course - Create new course (Founder only)
router.post(
  "/",
  authenticate,
  authorize("founder"),
  uploadCourseMedia.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "previewVideo", maxCount: 1 },
  ]),
  c.createCourse
);

// PUT /api/course/:id - Update course metadata / status (Founder only)
router.put(
  "/:id",
  authenticate,
  authorize("founder"),
  uploadCourseMedia.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "previewVideo", maxCount: 1 },
  ]),
  c.updateCourse
);

// DELETE /api/course/:id - Delete course (Founder only)
router.delete("/:id", authenticate, authorize("founder"), c.deleteCourse);

// POST /api/course/:id/lesson - Add lesson / video to course (Founder only)
router.post(
  "/:id/lesson",
  authenticate,
  authorize("founder"),
  uploadCourseMedia.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  c.addLesson
);

// PUT /api/course/:id/lesson/:lessonId - Update lesson details / media (Founder only)
router.put(
  "/:id/lesson/:lessonId",
  authenticate,
  authorize("founder"),
  uploadCourseMedia.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  c.updateLesson
);

// DELETE /api/course/:id/lesson/:lessonId - Delete lesson from course (Founder only)
router.delete(
  "/:id/lesson/:lessonId",
  authenticate,
  authorize("founder"),
  c.deleteLesson
);

// GET /api/course/:id - Get course details (Public for published; Founder-only if draft)
router.get("/:id", optionalAuthenticate, c.getCourseById);

module.exports = router;
