const express = require("express");
const router = express.Router();
const c = require("./pitchDeckAccess.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

router.use(authenticate);

router.post("/request", authorize("investor"), c.request);
router.put("/:id/respond", authorize("founder"), c.respond);
router.get("/incoming", authorize("founder"), c.incoming);
router.get("/outgoing", authorize("investor"), c.outgoing);
router.get("/deck/:founderId", authorize("investor"), c.getDeck);

module.exports = router;
