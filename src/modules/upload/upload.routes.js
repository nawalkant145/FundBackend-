const express = require("express");
const router = express.Router();
const uploadController = require("./upload.controller");
const { authenticate } = require("../../middlewares/auth.middleware");

router.use(authenticate);

                                                                        
router.post("/presigned-url", uploadController.getUploadPresignedUrl);

module.exports = router;
