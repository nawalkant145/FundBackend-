const express = require("express");
const router = express.Router();
const controller = require("./funding.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

                                                             
router.get("/impact", authenticate, controller.getFundingImpact);

                                                         
router.get("/records", authenticate, authorize("admin"), controller.listFundingRecords);
router.post("/", authenticate, authorize("admin"), controller.createMonthlyFunding);
router.put("/:id", authenticate, authorize("admin"), controller.updateMonthlyFunding);
router.delete("/:id", authenticate, authorize("admin"), controller.deleteMonthlyFunding);

module.exports = router;
