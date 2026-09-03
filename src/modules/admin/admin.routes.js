const express = require("express");
const router = express.Router();
const c = require("./admin.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

router.use(authenticate, authorize("admin"));

            
router.get("/dashboard", c.dashboard);
router.get("/stats", c.stats);

        
router.get("/users", c.listUsers);
router.get("/users/:id", c.getUserDetails);
router.put("/users/:id", c.editUser);
router.put("/users/:id/ban", c.banUser);
router.put("/users/:id/unban", c.unbanUser);
router.put("/users/:id/suspend", c.suspendUser);
router.put("/users/:id/unsuspend", c.unsuspendUser);
router.post("/users/:id/impersonate", c.impersonateUser);
router.put("/users/:id/reset-password", c.resetUserPassword);
router.put("/users/:id/promote", c.promoteToAdmin);
router.put("/users/:id/demote", c.demoteAdmin);
router.delete("/users/:id", c.deleteUserHard);

         
router.get("/videos", c.listVideos);
router.get("/videos/pending", c.pendingVideos);
router.put("/videos/:id/approve", c.approveVideo);
router.put("/videos/:id/reject", c.rejectVideo);
router.post("/videos/:id/boost", c.boostVideo);
router.delete("/videos/:id/boost", c.removeBoost);
router.delete("/videos/:id", c.forceDeleteVideo);

                               
router.get("/trash", c.listTrash);
router.put("/videos/:id/restore", c.restoreVideo);
router.delete("/videos/:id/purge", c.purgeVideo);

                                              
router.get("/kyc/kpis", c.getOperationalKpis);
router.get("/kyc/queue", c.getPendingQueues);
router.get("/kyc/queue/:type", c.getPendingQueues);
router.get("/documents/pending", c.pendingDocuments);

                                    
router.put("/documents/:userId/approve", c.approveDocuments);
router.put("/documents/:userId/reject", c.rejectDocuments);
router.put("/kyc/identity/:userId/approve", c.approveDocuments);
router.put("/kyc/identity/:userId/reject", c.rejectDocuments);

                                              
router.put("/kyc/company/:companyId/approve", c.approveCompanyKYC);
router.put("/kyc/company/:companyId/reject", c.rejectCompanyKYC);
router.put("/kyc/business/:companyId/approve", c.approveCompanyKYC);
router.put("/kyc/business/:companyId/reject", c.rejectCompanyKYC);

                                                                         
router.put("/kyc/investor/:investmentKycId/approve", c.approveInvestorKYC);
router.put("/kyc/investor/:investmentKycId/reject", c.rejectInvestorKYC);
router.put("/kyc/organization/:investmentKycId/approve", c.approveInvestorKYC);
router.put("/kyc/organization/:investmentKycId/reject", c.rejectInvestorKYC);

                                  
router.put("/kyc/due-diligence/:userId/complete", c.completeDueDiligence);

          
router.get("/reports", c.listReports);
router.put("/reports/:id/resolve", c.resolveReport);

           
router.get("/comments", c.listAllComments);
router.put("/comments/:id/hide", c.hideComment);
router.put("/comments/:id/unhide", c.unhideComment);
router.delete("/comments/:id", c.deleteComment);

              
router.get("/investments", c.listInvestments);
router.get("/investments/export", c.exportInvestments);
router.get("/investments/suspicious", c.suspiciousActivity);
router.post("/investments/:id/refund", c.refundInvestment);
router.put("/investments/:id/freeze", c.freezeInvestment);
router.put("/investments/:id/unfreeze", c.unfreezeInvestment);

                
router.get("/calls", c.listCalls);
router.get("/chats", c.listChats);
router.get("/chats/:chatId/messages", c.getChatMessages);

            
router.post("/broadcast", c.broadcast);

            
router.get("/audit", c.auditLogs);
router.get("/audit/actions", c.auditActionTypes);
router.get("/audit/export", c.auditExport);

                                          
router.get("/moderation", c.listFlags);
router.put("/moderation/:id/resolve", c.resolveFlag);

                                                          
router.get("/settings", c.getSettings);
router.put("/settings", c.updateSettings);

module.exports = router;
