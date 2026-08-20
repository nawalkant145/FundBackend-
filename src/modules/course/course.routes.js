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
// Public / Student Routes
// -------------------------------------------------------------

// GET /api/course - Get published courses (Public / Student)
router.get("/", c.getPublishedCourses);

// POST /api/course/send-receipt - Send enrollment receipt email (kept for backward compatibility)
router.post("/send-receipt", c.sendCourseReceipt);

// -------------------------------------------------------------
// Admin-only Routes (Course Content Management)
// -------------------------------------------------------------

// GET /api/course/admin-courses - Get all courses for Admin management
router.get("/admin-courses", authenticate, authorize("admin"), c.getAdminCourses);

// GET /api/course/my-courses - Alias for Admin courses
router.get("/my-courses", authenticate, authorize("admin"), c.getAdminCourses);

// POST /api/course - Create new course (Admin only)
router.post(
  "/",
  authenticate,
  authorize("admin"),
  uploadCourseMedia.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "previewVideo", maxCount: 1 },
  ]),
  c.createCourse
);

// PUT /api/course/:id - Update course metadata / status (Admin only)
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  uploadCourseMedia.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "previewVideo", maxCount: 1 },
  ]),
  c.updateCourse
);

// DELETE /api/course/:id - Delete course (Admin only)
router.delete("/:id", authenticate, authorize("admin"), c.deleteCourse);

// POST /api/course/:id/lesson - Add lesson / video to course (Admin only)
router.post(
  "/:id/lesson",
  authenticate,
  authorize("admin"),
  uploadCourseMedia.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  c.addLesson
);

// PUT /api/course/:id/lesson/:lessonId - Update lesson details / media (Admin only)
router.put(
  "/:id/lesson/:lessonId",
  authenticate,
  authorize("admin"),
  uploadCourseMedia.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  c.updateLesson
);

// DELETE /api/course/:id/lesson/:lessonId - Delete lesson from course (Admin only)
router.delete(
  "/:id/lesson/:lessonId",
  authenticate,
  authorize("admin"),
  c.deleteLesson
);

// GET /api/course/:id - Get course details (Public for published; Admin-only for drafts; Checks enrollment for locked video URLs)
router.get("/:id", optionalAuthenticate, c.getCourseById);

module.exports = router;
