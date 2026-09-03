const { sendEmail } = require("../../utils/sendEmail");
const ApiResponse = require("../../utils/ApiResponse");
const asyncHandler = require("../../utils/asyncHandler");
const courseService = require("./course.service");

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
              <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#F5B942;margin-bottom:6px">EXPGLO FUND ACADEMY</p>
              <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff">Enrollment Confirmed! 🎉</h1>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75)">Your receipt for course access</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px">
              <p style="margin:0 0 24px;font-size:15px;color:#0A1F14">Hi <strong>${name || "there"}</strong>,</p>
              <p style="margin:0 0 28px;font-size:14px;color:#444;line-height:1.6">
                Your payment has been successfully processed. You now have <strong>lifetime access</strong> to the course below.
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
                      Go to My Courses →
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbf0;border:1px solid #f5e6b8;border-radius:10px;margin-bottom:8px">
                <tr>
                  <td style="padding:14px 20px">
                    <p style="margin:0;font-size:12px;color:#7a5c00">
                      🛡️ <strong>30-Day Money Back Guarantee</strong> — If you are not satisfied, contact us within 30 days for a full refund.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f5f7f5;padding:20px 40px;text-align:center;border-top:1px solid #e8ede9">
              <p style="margin:0;font-size:11px;color:#999;line-height:1.6">
                This is an automated receipt from <strong>EXPGLO FUND Academy</strong>.<br/>
                Questions? Reply to this email or visit <a href="https://expglofund.com/support" style="color:#1B5E3F;text-decoration:none">expglofund.com/support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendCourseReceipt = asyncHandler(async (req, res) => {
  const { email, name, courseTitle, price, paymentMethod, transactionId } = req.body;

  if (!email || !courseTitle || !price) {
    return res.status(400).json({ success: false, message: "email, courseTitle, and price are required" });
  }

  const date = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const txId = transactionId || `TXN${Date.now().toString(36).toUpperCase()}`;

  const result = await sendEmail({
    to: email,
    subject: `🎉 Enrollment Confirmed: ${courseTitle} — EXPGLO FUND Academy`,
    html: receiptEmailHtml({ name, courseTitle, price, paymentMethod: paymentMethod || "Online Payment", transactionId: txId, date }),
    text: `Hi ${name || "there"}, you have successfully enrolled in "${courseTitle}". Amount paid: ${price}. Transaction ID: ${txId}. Date: ${date}.`,
  });

  return res.status(200).json(
    new ApiResponse(200, { transactionId: txId, emailSent: result.id !== null }, "Receipt sent successfully")
  );
});

                             
const createCourse = asyncHandler(async (req, res) => {
  const course = await courseService.createCourse(
    req.user._id,
    req.body,
    req.files || {}
  );
  res.status(201).json(new ApiResponse(201, { course }, "Course created successfully"));
});

                            
const getAdminCourses = asyncHandler(async (req, res) => {
  const result = await courseService.getAdminCourses(req.query);
  res.status(200).json(new ApiResponse(200, result, "Admin courses retrieved"));
});

                             
const updateCourse = asyncHandler(async (req, res) => {
  const course = await courseService.updateCourse(
    req.params.id,
    req.user._id,
    req.body,
    req.files || {}
  );
  res.status(200).json(new ApiResponse(200, { course }, "Course updated successfully"));
});

                             
const deleteCourse = asyncHandler(async (req, res) => {
  const result = await courseService.deleteCourse(req.params.id, req.user._id);
  res.status(200).json(new ApiResponse(200, result, "Course deleted successfully"));
});

                                    
const addLesson = asyncHandler(async (req, res) => {
  const course = await courseService.addLesson(
    req.params.id,
    req.user._id,
    req.body,
    req.files || {}
  );
  res.status(200).json(new ApiResponse(200, { course }, "Lesson added successfully"));
});

                                       
const updateLesson = asyncHandler(async (req, res) => {
  const course = await courseService.updateLesson(
    req.params.id,
    req.user._id,
    req.params.lessonId,
    req.body,
    req.files || {}
  );
  res.status(200).json(new ApiResponse(200, { course }, "Lesson updated successfully"));
});

                                         
const deleteLesson = asyncHandler(async (req, res) => {
  const course = await courseService.deleteLesson(
    req.params.id,
    req.user._id,
    req.params.lessonId
  );
  res.status(200).json(new ApiResponse(200, { course }, "Lesson deleted successfully"));
});

                                             
const getPublishedCourses = asyncHandler(async (req, res) => {
  const result = await courseService.getPublishedCourses(req.query);
  res.status(200).json(new ApiResponse(200, result, "Published courses retrieved"));
});

                           
const getCourseById = asyncHandler(async (req, res) => {
  const course = await courseService.getCourseById(req.params.id, req.user);
  res.status(200).json(new ApiResponse(200, { course }, "Course details fetched"));
});

module.exports = {
  sendCourseReceipt,
  createCourse,
  getAdminCourses,
  getMyCourses: getAdminCourses,
  updateCourse,
  deleteCourse,
  addLesson,
  updateLesson,
  deleteLesson,
  getPublishedCourses,
  getCourseById,
};
