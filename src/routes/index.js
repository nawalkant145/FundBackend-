const express = require("express");
const router = express.Router();

router.use("/auth", require("../modules/auth/auth.routes"));
router.use("/user", require("../modules/user/user.routes"));
router.use("/video", require("../modules/video/video.routes"));
router.use("/post", require("../modules/post/post.routes"));
router.use("/comment", require("../modules/comment/comment.routes"));
router.use("/chat", require("../modules/chat/chat.routes"));
router.use("/call", require("../modules/call/call.routes"));
router.use("/investment", require("../modules/investment/investment.routes"));
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

module.exports = router;
