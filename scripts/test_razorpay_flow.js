const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Course = require("../src/modules/course/course.model");
const User = require("../src/modules/user/user.model");
const Enrollment = require("../src/modules/enrollment/enrollment.model");
const Payment = require("../src/modules/payment/payment.model");
const paymentService = require("../src/modules/payment/payment.service");
const razorpayService = require("../src/modules/payment/razorpay.service");
const ApiError = require("../src/utils/ApiError");

async function runTests() {
  console.log("=== STARTING RAZORPAY ORDER CREATION AUDIT TESTS ===");
  
  // 1. Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/expglo_test";
  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB");

  let testCourseId = null;
  let testUserId = null;

  try {
    // Clean up test fixtures
    await Course.deleteMany({ title: "TEST_AUDIT_COURSE" });
    await User.deleteMany({ email: "test_audit_user@example.com" });

    // Create a mock user
    const testUser = await User.create({
      name: "Audit Test User",
      username: `audusr_${Date.now().toString(36)}`,
      email: "test_audit_user@example.com",
      password: "Password123!",
      role: "founder",
      isEmailVerified: true,
    });
    testUserId = testUser._id;
    console.log("✓ Created test user:", testUserId);

    // Create a mock published course
    const testCourse = await Course.create({
      title: "TEST_AUDIT_COURSE",
      description: "Audit test course description",
      founderId: testUserId,
      price: 499,
      status: "published",
      category: "Tech",
      level: "beginner",
    });
    testCourseId = testCourse._id;
    console.log("✓ Created test published course:", testCourseId);

    // TEST 1: Invalid course ID format
    console.log("\n--- TEST 1: Invalid Course ID Format ---");
    try {
      await paymentService.createCourseOrder(testUser, "invalid_id_format");
      console.error("FAIL: Expected ApiError 400");
    } catch (err) {
      if (err.statusCode === 400) {
        console.log("PASS: Returned 400 Bad Request for invalid ID format ->", err.message);
      } else {
        console.error("FAIL: Unexpected status code ->", err.statusCode, err.message);
      }
    }

    // TEST 2: Non-existent Course ID
    console.log("\n--- TEST 2: Non-existent Course ID ---");
    try {
      const nonExistentId = new mongoose.Types.ObjectId();
      await paymentService.createCourseOrder(testUser, nonExistentId);
      console.error("FAIL: Expected ApiError 404");
    } catch (err) {
      if (err.statusCode === 404) {
        console.log("PASS: Returned 404 Not Found ->", err.message);
      } else {
        console.error("FAIL: Unexpected status code ->", err.statusCode, err.message);
      }
    }

    // TEST 3: Unpublished Course
    console.log("\n--- TEST 3: Unpublished/Draft Course ---");
    const draftCourse = await Course.create({
      title: "TEST_AUDIT_COURSE_DRAFT",
      description: "Draft test course description",
      founderId: testUserId,
      price: 499,
      status: "draft",
      category: "Tech",
      level: "beginner",
    });
    try {
      await paymentService.createCourseOrder(testUser, draftCourse._id);
      console.error("FAIL: Expected ApiError 400");
    } catch (err) {
      if (err.statusCode === 400) {
        console.log("PASS: Returned 400 Bad Request for draft course ->", err.message);
      } else {
        console.error("FAIL: Unexpected status code ->", err.statusCode, err.message);
      }
    } finally {
      await Course.deleteOne({ _id: draftCourse._id });
    }

    // TEST 4: Valid Authenticated Razorpay Order Creation
    console.log("\n--- TEST 4: Valid Authenticated Order Creation ---");
    const orderRes1 = await paymentService.createCourseOrder(testUser, testCourseId);
    console.log("Order Creation Result:", JSON.stringify(orderRes1, null, 2));
    if (orderRes1.success && orderRes1.order?.id && orderRes1.order?.amount === 49900 && orderRes1.keyId) {
      console.log("PASS: Successfully created Razorpay Order in paise (49900)");
    } else {
      console.error("FAIL: Invalid order creation output");
    }

    // TEST 5: Pending Order Reuse (Preventing 409 Conflict)
    console.log("\n--- TEST 5: Repeated Order Request / Pending Order Reuse ---");
    const orderRes2 = await paymentService.createCourseOrder(testUser, testCourseId);
    if (orderRes2.success && orderRes2.order?.id === orderRes1.order.id && orderRes2.reusedPendingOrder) {
      console.log("PASS: Reused existing pending Razorpay Order safely without creating duplicate key conflict!");
    } else {
      console.error("FAIL: Did not reuse pending order ->", orderRes2);
    }

    // TEST 6: Valid Guest Razorpay Order Creation
    console.log("\n--- TEST 6: Valid Guest Order Creation ---");
    const guestCourse = await Course.create({
      title: "TEST_AUDIT_COURSE_GUEST",
      description: "Guest test course",
      founderId: testUserId,
      price: 299,
      status: "published",
      category: "Tech",
      level: "beginner",
    });
    const guestOrderRes = await paymentService.guestCreateCourseOrder(guestCourse._id);
    if (guestOrderRes.success && guestOrderRes.order?.id && guestOrderRes.order?.amount === 29900) {
      console.log("PASS: Guest order created successfully in paise (29900)");
    } else {
      console.error("FAIL: Guest order creation failed ->", guestOrderRes);
    }
    await Course.deleteOne({ _id: guestCourse._id });

    // TEST 7: Already Enrolled User Purchase Attempt
    console.log("\n--- TEST 7: Enrolled User Re-purchase Attempt ---");
    await Enrollment.create({
      userId: testUserId,
      courseId: testCourseId,
      paymentId: "PAY_MOCK_123",
      amount: 499,
      status: "active",
    });
    try {
      await paymentService.createCourseOrder(testUser, testCourseId);
      console.error("FAIL: Expected ApiError 400 for already enrolled user");
    } catch (err) {
      if (err.statusCode === 400) {
        console.log("PASS: Returned 400 for already enrolled user ->", err.message);
      } else {
        console.error("FAIL: Unexpected status ->", err.statusCode, err.message);
      }
    }

    // TEST 8: Webhook Signature Verification
    console.log("\n--- TEST 8: Webhook Signature Verification ---");
    const testSecret = "test_webhook_secret_12345";
    process.env.RAZORPAY_WEBHOOK_SECRET = testSecret;
    const bodyStr = JSON.stringify({ event: "payment.captured", id: "evt_123" });
    const crypto = require("crypto");
    const validSig = crypto.createHmac("sha256", testSecret).update(Buffer.from(bodyStr)).digest("hex");
    const isValidSig = razorpayService.verifyWebhookSignature(Buffer.from(bodyStr), validSig);
    if (isValidSig) {
      console.log("PASS: Razorpay Webhook HMAC-SHA256 signature verified successfully!");
    } else {
      console.error("FAIL: Webhook signature verification failed");
    }

  } catch (err) {
    console.error("UNEXPECTED TEST ERROR:", err);
  } finally {
    // Cleanup database test entries
    if (testCourseId) await Course.deleteOne({ _id: testCourseId });
    if (testUserId) await User.deleteOne({ _id: testUserId });
    await Payment.deleteMany({ receipt: { $regex: /^rcpt_|^g_rcpt_/ } });
    await Enrollment.deleteMany({ paymentId: "PAY_MOCK_123" });
    await mongoose.disconnect();
    console.log("\n✓ Disconnected from MongoDB. Audit tests complete.");
  }
}

runTests();
