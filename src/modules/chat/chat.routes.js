const express = require("express");
const router = express.Router();
const c = require("./chat.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { uploadDocument } = require("../../middlewares/upload.middleware");

router.use(authenticate);

router.post("/start", c.startChat);
router.get("/list", c.listChats);
router.get("/unread-total", c.totalUnreadCount);
router.get("/:chatId/messages", c.getMessages);
router.post("/:chatId/messages", c.sendMessage);
router.post(
  "/:chatId/attachment",
  uploadDocument.single("file"),
  c.uploadAttachment,
);
router.put("/:chatId/read", c.markRead);
router.delete("/:chatId", c.deleteChat);

module.exports = router;
