const express = require("express");
const router = express.Router();
const c = require("./event.controller");
const { authenticate, optionalAuthenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");

                       
router.get("/upcoming", optionalAuthenticate, c.getUpcomingEvents);
router.get("/:id", optionalAuthenticate, c.getEventById);
router.post("/:id/register", authenticate, c.registerForEvent);

                                     
router.post("/admin/create", authenticate, authorize("admin"), c.createEvent);
router.get("/admin/list", authenticate, authorize("admin"), c.getAdminEvents);
router.get("/admin/:id/registrations", authenticate, authorize("admin"), c.getEventRegistrations);
router.put("/admin/:id", authenticate, authorize("admin"), c.updateEvent);
router.delete("/admin/:id", authenticate, authorize("admin"), c.deleteEvent);

module.exports = router;
