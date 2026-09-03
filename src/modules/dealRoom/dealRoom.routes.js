const express = require("express");
const router = express.Router();
const controller = require("./dealRoom.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { uploadDocument } = require("../../middlewares/upload.middleware");

router.use(authenticate);

                              
router.post("/", controller.createDealRoom);
router.get("/", controller.listDealRooms);
router.get("/:id", controller.getDealRoom);
router.patch("/:id/terms", controller.updateTerms);
router.patch("/:id/stage", controller.updateStage);
router.post("/:id/documents", uploadDocument.single("file"), controller.uploadDocument);
router.patch("/:id/checklist", controller.updateChecklist);
router.patch("/:id/review", controller.updateReview);
router.patch("/:id/accept", controller.acceptRequest);
router.patch("/:id/decline", controller.declineRequest);

module.exports = router;
