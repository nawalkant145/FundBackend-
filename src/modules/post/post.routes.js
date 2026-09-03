const express = require("express");
const router = express.Router();
const c = require("./post.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const { uploadImage } = require("../../middlewares/upload.middleware");

router.use(authenticate);

                                                                  
router.post(
  "/",
  authorize("founder", "investor"),
  uploadImage.array("images", 10),
  c.create,
);

                                                             
router.post("/thoughts", authorize("founder", "investor"), c.createThoughts);

                                 
router.get("/feed", c.feed);

                                  
router.get("/my-posts", authorize("founder", "investor"), c.myPosts);

                                        
router.get("/saved", c.savedPosts);

                                
router.get("/user/:userId", c.userPosts);

                   
router.get("/:id", c.getOne);
router.put("/:id", authorize("founder", "investor"), c.update);
router.delete("/:id", authorize("founder", "investor"), c.remove);

             
router.post("/:id/like", c.like);
router.post("/:id/save", c.save);

module.exports = router;
