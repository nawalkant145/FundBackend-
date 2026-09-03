const express = require("express");
const router = express.Router();
const c = require("./course.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const { uploadCourseMedia } = require("../../middlewares/upload.middleware");

                                                                        
const optionalAuthenticate = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    return authenticate(req, res, next);
  }
  next();
};

                                                                
                          
                                                                

                                                             
router.get("/", c.getPublishedCourses);

                                                                                                  
router.post("/send-receipt", c.sendCourseReceipt);

                                                                
                                                
                                                                

                                                                       
router.get("/admin-courses", authenticate, authorize("admin"), c.getAdminCourses);

                                                       
router.get("/my-courses", authenticate, authorize("admin"), c.getAdminCourses);

                                                    
router.post(
  "/",
  authenticate,
  authorize("admin"),
  uploadCourseMedia.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "previewVideo", maxCount: 1 },
  ]),
  c.createCourse
);

                                                                     
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  uploadCourseMedia.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "previewVideo", maxCount: 1 },
  ]),
  c.updateCourse
);

                                                      
router.delete("/:id", authenticate, authorize("admin"), c.deleteCourse);

                                                                          
router.post(
  "/:id/lesson",
  authenticate,
  authorize("admin"),
  uploadCourseMedia.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  c.addLesson
);

                                                                                    
router.put(
  "/:id/lesson/:lessonId",
  authenticate,
  authorize("admin"),
  uploadCourseMedia.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  c.updateLesson
);

                                                                                   
router.delete(
  "/:id/lesson/:lessonId",
  authenticate,
  authorize("admin"),
  c.deleteLesson
);

                                                                                                                                  
router.get("/:id", optionalAuthenticate, c.getCourseById);

module.exports = router;
