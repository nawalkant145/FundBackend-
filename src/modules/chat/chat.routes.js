const express = require("express");
const router = express.Router();
const c = require("./chat.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { uploadChatAttachment } = require("../../middlewares/upload.middleware");

router.use(authenticate);

router.post("/start", c.startChat);
router.post("/start/:targetId", c.startChat);
router.get("/start/:targetId", c.startChat);

router.get("/", c.listChats);
router.get("/list", c.listChats);
router.get("/conversations", c.listChats);

router.get("/unread-total", c.totalUnreadCount);
router.get("/unread-count", c.totalUnreadCount);

router.get("/:chatId/messages", c.getMessages);
router.post("/:chatId/messages", c.sendMessage);
router.patch("/:chatId/messages/:messageId", c.editMessage);
router.delete("/:chatId/messages/:messageId", c.deleteMessage);
router.get("/:chatId/search", c.searchMessages);
router.get("/:chatId/media", c.getChatMedia);

router.post(
  "/:chatId/attachment",
  uploadChatAttachment.single("file"),
  c.uploadAttachment,
);
router.put("/:chatId/read", c.markRead);
router.delete("/:chatId", c.deleteChat);

module.exports = router;
