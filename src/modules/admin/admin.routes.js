const express = require("express");
const router = express.Router();
const c = require("./admin.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

router.use(authenticate, authorize("admin"));

// Dashboard
router.get("/dashboard", c.dashboard);
router.get("/stats", c.stats);

// Users
router.get("/users", c.listUsers);
router.get("/users/:id", c.getUserDetails);
router.put("/users/:id", c.editUser);
router.put("/users/:id/ban", c.banUser);
router.put("/users/:id/unban", c.unbanUser);
router.put("/users/:id/reset-password", c.resetUserPassword);
router.put("/users/:id/promote", c.promoteToAdmin);
router.put("/users/:id/demote", c.demoteAdmin);
router.delete("/users/:id", c.deleteUserHard);

// Videos
router.get("/videos", c.listVideos);
router.get("/videos/pending", c.pendingVideos);
router.put("/videos/:id/approve", c.approveVideo);
router.put("/videos/:id/reject", c.rejectVideo);
router.post("/videos/:id/boost", c.boostVideo);
router.delete("/videos/:id/boost", c.removeBoost);
router.delete("/videos/:id", c.forceDeleteVideo);

// KYC
router.get("/documents/pending", c.pendingDocuments);
router.put("/documents/:userId/approve", c.approveDocuments);
router.put("/documents/:userId/reject", c.rejectDocuments);

// Reports
router.get("/reports", c.listReports);
router.put("/reports/:id/resolve", c.resolveReport);

// Comments
router.get("/comments", c.listAllComments);
router.put("/comments/:id/hide", c.hideComment);
router.put("/comments/:id/unhide", c.unhideComment);
router.delete("/comments/:id", c.deleteComment);

// Investments
router.get("/investments", c.listInvestments);
router.post("/investments/:id/refund", c.refundInvestment);

// Calls / Chats
router.get("/calls", c.listCalls);
router.get("/chats", c.listChats);
router.get("/chats/:chatId/messages", c.getChatMessages);

// Broadcast
router.post("/broadcast", c.broadcast);

// Audit log
router.get("/audit", c.auditLogs);

module.exports = router;
