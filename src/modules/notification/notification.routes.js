const express = require("express");
const router = express.Router();
const c = require("./notification.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);

router.get("/list", c.list);
router.get("/unread-count", c.unreadCount);
router.put("/read-all", c.markAllRead);
router.put("/:id/read", c.markRead);
router.delete("/:id", c.remove);
router.get("/:id", c.getById);

module.exports = router;
