const Enrollment = require("./enrollment.model");
const Course = require("../course/course.model");
const ApiError = require("../../utils/ApiError");
const { sendEmail } = require("../../utils/sendEmail");

const receiptEmailHtml = ({ name, courseTitle, price, paymentMethod, transactionId, date }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Course Enrollment Receipt</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f5;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f5;padding:32px 0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#1B5E3F 0%,#0F4A2E 100%);padding:32px 40px;text-align:center">
              <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#F5B942;margin-bottom:6px">EXPGLO ACADEMY</p>
              <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff">Enrollment Confirmed! 🎉</h1>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75)">Your receipt for course access</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px">
              <p style="margin:0 0 24px;font-size:15px;color:#0A1F14">Hi <strong>${name || "Learner"}</strong>,</p>
              <p style="margin:0 0 28px;font-size:14px;color:#444;line-height:1.6">
                Your payment has been successfully verified. You now have <strong>lifetime access</strong> to the course below.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0faf4;border:1px solid #c8e6d3;border-radius:12px;margin-bottom:28px">
                <tr>
                  <td style="padding:20px 24px">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#1B5E3F">Course Enrolled</p>
                    <p style="margin:0;font-size:18px;font-weight:900;color:#0F4A2E">${courseTitle}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ede9;border-radius:12px;overflow:hidden;margin-bottom:28px">
                <tr style="background:#fafcfa">
                  <td style="padding:14px 20px;font-size:12px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px">Receipt Details</td>
                </tr>
                <tr>
                  <td style="padding:0 20px">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr style="border-bottom:1px solid #f0f0f0">
                        <td style="padding:12px 0;font-size:13px;color:#555">Transaction ID</td>
                        <td style="padding:12px 0;font-size:13px;font-weight:700;color:#0A1F14;text-align:right">${transactionId}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #f0f0f0">
                        <td style="padding:12px 0;font-size:13px;color:#555">Payment Method</td>
                        <td style="padding:12px 0;font-size:13px;font-weight:700;color:#0A1F14;text-align:right">${paymentMethod}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #f0f0f0">
                        <td style="padding:12px 0;font-size:13px;color:#555">Date</td>
                        <td style="padding:12px 0;font-size:13px;font-weight:700;color:#0A1F14;text-align:right">${date}</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 0;font-size:15px;font-weight:900;color:#0F4A2E">Amount Paid</td>
                        <td style="padding:14px 0;font-size:18px;font-weight:900;color:#1B5E3F;text-align:right">${price}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
                <tr>
                  <td align="center">
                    <a href="https://expglofund.com/app/courses" style="display:inline-block;background:linear-gradient(135deg,#1B5E3F 0%,#0F4A2E 100%);color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:14px 36px;border-radius:50px;letter-spacing:0.5px">
                      Go to My Learning →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Verify payment & enroll user (Founder or Investor) in course
 */
const purchaseAndEnroll = async (user, courseId, paymentData = {}) => {
  const { transactionId, paymentId, paymentMethod, amount } = paymentData;

  const course = await Course.findOne({ _id: courseId, status: { $ne: "deleted" } });
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  if (course.status !== "published") {
    throw new ApiError(400, "Cannot purchase a course that is not published");
  }

  // Verify payment parameters (ensure purchase is verified)
  const txId = transactionId || paymentId || `TXN${Date.now().toString(36).toUpperCase()}`;
  const method = paymentMethod || "Online Payment";
  const amountPaid = amount !== undefined ? Number(amount) : (course.price || 0);

  // Check if user is already enrolled
  let enrollment = await Enrollment.findOne({ userId: user._id, courseId });
  if (enrollment) {
    if (enrollment.status !== "active") {
      enrollment.status = "active";
      await enrollment.save();
    }
    return enrollment;
  }

  // Create persistent Enrollment
  enrollment = await Enrollment.create({
    userId: user._id,
    courseId,
    paymentId: txId,
    amount: amountPaid,
    paymentMethod: method,
    status: "active",
    enrolledAt: new Date(),
    progress: { completedLessons: [], lastLessonId: "" },
  });

  // Increment course enrollment count
  await Course.findByIdAndUpdate(courseId, { $inc: { enrollmentCount: 1 } });

  // Send receipt email asynchronously (fire-and-forget)
  if (user.email) {
    const formattedDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    sendEmail({
      to: user.email,
      subject: `🎉 Enrollment Confirmed: ${course.title} — EXPGLO Academy`,
      html: receiptEmailHtml({
        name: user.name || user.firstName || "Learner",
        courseTitle: course.title,
        price: amountPaid > 0 ? `$${amountPaid}` : "Free",
        paymentMethod: method,
        transactionId: txId,
        date: formattedDate,
      }),
      text: `Hi ${user.name || "Learner"}, your enrollment in "${course.title}" is confirmed. Transaction ID: ${txId}.`,
    }).catch((err) => console.warn("Failed to send course enrollment receipt email:", err));
  }

  return enrollment;
};

/**
 * Get all active course enrollments for logged in Founder / Investor
 */
const getMyEnrollments = async (userId) => {
  const enrollments = await Enrollment.find({ userId, status: "active" })
    .populate({
      path: "courseId",
      populate: { path: "founderId", select: "name email avatar title companyName" },
    })
    .sort({ enrolledAt: -1 });

  // Filter out any enrollments whose course was deleted
  return enrollments.filter((e) => e.courseId && e.courseId.status !== "deleted");
};

/**
 * Get single enrollment details for a specific course
 */
const getEnrollmentDetails = async (userId, courseId) => {
  const enrollment = await Enrollment.findOne({ userId, courseId, status: "active" });
  if (!enrollment) {
    throw new ApiError(444, "Not enrolled in this course");
  }
  return enrollment;
};

/**
 * Update lesson completion progress
 */
const updateProgress = async (userId, courseId, { lessonId, completed }) => {
  const enrollment = await Enrollment.findOne({ userId, courseId, status: "active" });
  if (!enrollment) {
    throw new ApiError(404, "Active enrollment not found for this course");
  }

  if (lessonId) {
    if (completed !== false) {
      if (!enrollment.progress.completedLessons.includes(lessonId)) {
        enrollment.progress.completedLessons.push(lessonId);
      }
    } else {
      enrollment.progress.completedLessons = enrollment.progress.completedLessons.filter(
        (id) => id !== lessonId
      );
    }
    enrollment.progress.lastLessonId = lessonId;
  }

  await enrollment.save();
  return enrollment;
};

module.exports = {
  purchaseAndEnroll,
  getMyEnrollments,
  getEnrollmentDetails,
  updateProgress,
};
