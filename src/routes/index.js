const express = require("express");
const router = express.Router();

router.use("/auth", require("../modules/auth/auth.routes"));
router.use("/user", require("../modules/user/user.routes"));
router.use("/users", require("../modules/user/user.routes"));
router.use("/kyc", require("../modules/kyc/kyc.routes"));
router.use("/video", require("../modules/video/video.routes"));
router.use("/videos", require("../modules/video/video.routes"));
router.use("/post", require("../modules/post/post.routes"));
router.use("/posts", require("../modules/post/post.routes"));
router.use("/comment", require("../modules/comment/comment.routes"));
router.use("/comments", require("../modules/comment/comment.routes"));
router.use("/chat", require("../modules/chat/chat.routes"));
router.use("/chats", require("../modules/chat/chat.routes"));
router.use("/call", require("../modules/call/call.routes"));
router.use("/investment", require("../modules/investment/investment.routes"));
router.use("/boost", require("../modules/boost/boost.routes"));
router.use(
  "/subscription",
  require("../modules/subscription/subscription.routes"),
);
router.use(
  "/pitch-deck-access",
  require("../modules/pitchDeckAccess/pitchDeckAccess.routes"),
);
router.use(
  "/notification",
  require("../modules/notification/notification.routes"),
);
router.use("/report", require("../modules/report/report.routes"));
router.use("/activity", require("../modules/activity/activity.routes"));
router.use("/admin", require("../modules/admin/admin.routes"));
router.use("/course", require("../modules/course/course.routes"));
router.use("/courses", require("../modules/course/course.routes"));
router.use("/enrollment", require("../modules/enrollment/enrollment.routes"));
router.use("/payment", require("../modules/payment/payment.routes"));
router.use("/deal-room", require("../modules/dealRoom/dealRoom.routes"));
router.use("/deal-rooms", require("../modules/dealRoom/dealRoom.routes"));
router.use("/funding", require("../modules/funding/funding.routes"));
router.use("/event", require("../modules/event/event.routes"));
router.use("/events", require("../modules/event/event.routes"));

router.use("/upload", require("../modules/upload/upload.routes"));
router.use("/uploads", require("../modules/upload/upload.routes"));

module.exports = router;
