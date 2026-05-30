const express = require("express");
const router = express.Router();
const c = require("./comment.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);

router.post("/", c.create);
router.get("/video/:videoId", c.list);
router.put("/:id", c.update);
router.delete("/:id", c.remove);
router.post("/:id/like", c.like);

module.exports = router;
