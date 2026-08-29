const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const eventService = require("./event.service");

const getUpcomingEvents = asyncHandler(async (req, res) => {
  const userId = req.user?._id || null;
  const result = await eventService.getUpcomingEvents(userId, req.query);
  res.json(new ApiResponse(200, result, "Upcoming events fetched successfully"));
});

const getEventById = asyncHandler(async (req, res) => {
  const userId = req.user?._id || null;
  const event = await eventService.getEventById(req.params.id, userId);
  res.json(new ApiResponse(200, { event }, "Event details fetched successfully"));
});

const registerForEvent = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const result = await eventService.registerForEvent(req.params.id, userId);
  res.json(new ApiResponse(200, result, "Event registration successful"));
});

// Admin Controllers
const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.user._id, req.body);
  res.json(new ApiResponse(201, { event }, "Event created successfully"));
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.params.id, req.body);
  res.json(new ApiResponse(200, { event }, "Event updated successfully"));
});

const deleteEvent = asyncHandler(async (req, res) => {
  const event = await eventService.deleteEvent(req.params.id);
  res.json(new ApiResponse(200, { event }, "Event deleted successfully"));
});

const getAdminEvents = asyncHandler(async (req, res) => {
  const result = await eventService.getAdminEvents(req.query);
  res.json(new ApiResponse(200, result, "Admin events list fetched successfully"));
});

const getEventRegistrations = asyncHandler(async (req, res) => {
  const result = await eventService.getEventRegistrations(req.params.id, req.query);
  res.json(new ApiResponse(200, result, "Event registrations fetched successfully"));
});

module.exports = {
  getUpcomingEvents,
  getEventById,
  registerForEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getAdminEvents,
  getEventRegistrations,
};
