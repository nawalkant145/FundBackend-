const ApiResponse = require("../../utils/ApiResponse");
const asyncHandler = require("../../utils/asyncHandler");
const enrollmentService = require("./enrollment.service");
const paymentService = require("../payment/payment.service");

// POST /api/enrollment/purchase (Founder & Investor)
const purchaseCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.body;
  if (!courseId) {
    return res.status(400).json({ success: false, message: "courseId is required" });
  }

  const Course = require("../course/course.model");
  const course = await Course.findById(courseId);
  if (course && course.price > 0) {
    return res.status(400).json({
      success: false,
      message: "Paid courses must be purchased via Razorpay Checkout (/api/payment/create-order). Direct enrollment is disabled.",
    });
  }

  const enrollment = await enrollmentService.purchaseAndEnroll(
    req.user,
    courseId,
    req.body
  );

  res.status(201).json(new ApiResponse(201, { enrollment }, "Course enrollment successful"));
});

// POST /api/enrollment/claim-purchase (Founder & Investor)
const claimPurchase = asyncHandler(async (req, res) => {
  const { claimToken } = req.body;
  if (!claimToken) {
    return res.status(400).json({ success: false, message: "claimToken is required" });
  }

  const enrollment = await paymentService.claimPurchase(req.user, claimToken);
  res.status(200).json(new ApiResponse(200, { enrollment }, "Guest purchase claimed successfully"));
});

// GET /api/enrollment/my-courses (Founder & Investor)
const getMyCourses = asyncHandler(async (req, res) => {
  const enrollments = await enrollmentService.getMyEnrollments(req.user._id);
  res.status(200).json(new ApiResponse(200, { enrollments }, "Purchased courses retrieved"));
});

// GET /api/enrollment/:courseId (Founder & Investor)
const getEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await enrollmentService.getEnrollmentDetails(
    req.user._id,
    req.params.courseId
  );
  res.status(200).json(new ApiResponse(200, { enrollment }, "Enrollment details retrieved"));
});

// PATCH /api/enrollment/:courseId/progress (Founder & Investor)
const updateProgress = asyncHandler(async (req, res) => {
  const enrollment = await enrollmentService.updateProgress(
    req.user._id,
    req.params.courseId,
    req.body
  );
  res.status(200).json(new ApiResponse(200, { enrollment }, "Course progress updated"));
});

module.exports = {
  purchaseCourse,
  claimPurchase,
  getMyCourses,
  getEnrollment,
  updateProgress,
};
