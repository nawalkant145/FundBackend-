const express = require("express");
const router = express.Router();
const c = require("./call.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);

router.post("/initiate", c.initiate);
router.put("/:callId/accept", c.accept);
router.post("/:callId/accept", c.accept);
router.put("/:callId/decline", c.decline);
router.post("/:callId/decline", c.decline);
router.put("/:callId/end", c.end);
router.post("/:callId/end", c.end);
router.get("/history", c.history);
router.get("/ice-servers", c.iceServers);
router.get("/:callId", c.getOne);

module.exports = router;
