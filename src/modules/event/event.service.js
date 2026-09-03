const Event = require("./event.model");
const EventRegistration = require("./eventRegistration.model");
const ApiError = require("../../utils/ApiError");

                                                                            
const getUpcomingEvents = async (userId, { limit = 10 } = {}) => {
  limit = Math.min(Number(limit) || 10, 50);

                                                                                   
  const cutoffDate = new Date();

  const events = await Event.find({
    status: "published",
    isDeleted: { $ne: true },
    startDate: { $gte: cutoffDate },
  })
    .sort({ startDate: 1 })
    .limit(limit)
    .lean();

  if (events.length === 0) {
    return { events: [], registeredEventIds: [] };
  }

                                                    
  let registeredEventIds = [];
  if (userId) {
    const eventIds = events.map((e) => e._id);
    const regs = await EventRegistration.find({
      userId,
      eventId: { $in: eventIds },
      status: "registered",
    }).select("eventId");
    registeredEventIds = regs.map((r) => r.eventId.toString());
  }

  const registeredSet = new Set(registeredEventIds);

  const formattedEvents = events.map((e) => ({
    ...e,
    isRegistered: registeredSet.has(e._id.toString()),
    isFull: e.capacity > 0 && e.registeredCount >= e.capacity,
  }));

  return {
    events: formattedEvents,
    registeredEventIds,
  };
};

                             
const registerForEvent = async (eventId, userId) => {
  const event = await Event.findOne({
    _id: eventId,
    status: "published",
    isDeleted: { $ne: true },
  });

  if (!event) {
    throw new ApiError(404, "Event not found or unavailable for registration");
  }

  if (event.startDate < new Date(Date.now() - 12 * 60 * 60 * 1000)) {
    throw new ApiError(400, "Registration is closed for past events");
  }

                          
  if (event.capacity > 0 && event.registeredCount >= event.capacity) {
    throw new ApiError(400, "Registration for this event is full");
  }

                                
  const existing = await EventRegistration.findOne({ eventId, userId });
  if (existing && existing.status === "registered") {
    return {
      event,
      registration: existing,
      isRegistered: true,
      alreadyRegistered: true,
    };
  }

  let registration;
  if (existing) {
    existing.status = "registered";
    existing.registeredAt = new Date();
    registration = await existing.save();
  } else {
    registration = await EventRegistration.create({
      eventId,
      userId,
      status: "registered",
    });
  }

                                                    
  const count = await EventRegistration.countDocuments({
    eventId,
    status: "registered",
  });
  event.registeredCount = count;
  await event.save();

  return {
    event,
    registration,
    isRegistered: true,
    alreadyRegistered: false,
  };
};

                         
const getEventById = async (eventId, userId) => {
  const event = await Event.findOne({ _id: eventId, isDeleted: { $ne: true } }).lean();
  if (!event) throw new ApiError(404, "Event not found");

  let isRegistered = false;
  if (userId) {
    const reg = await EventRegistration.findOne({
      eventId,
      userId,
      status: "registered",
    });
    isRegistered = !!reg;
  }

  return {
    ...event,
    isRegistered,
    isFull: event.capacity > 0 && event.registeredCount >= event.capacity,
  };
};

                      
const createEvent = async (adminId, data) => {
  if (!data.title || !data.startDate) {
    throw new ApiError(400, "Event title and start date are required");
  }

  const event = await Event.create({
    title: data.title.trim(),
    description: data.description || "",
    startDate: new Date(data.startDate),
    endDate: data.endDate ? new Date(data.endDate) : undefined,
    location: data.location || "Online",
    eventType: data.eventType || "offline",
    meetingUrl: data.meetingUrl || "",
    bannerUrl: data.bannerUrl || "",
    capacity: Number(data.capacity) || 0,
    status: data.status || "published",
    createdBy: adminId,
  });

  return event;
};

                      
const updateEvent = async (eventId, data) => {
  const event = await Event.findOne({ _id: eventId, isDeleted: { $ne: true } });
  if (!event) throw new ApiError(404, "Event not found");

  if (data.title) event.title = data.title.trim();
  if (data.description !== undefined) event.description = data.description;
  if (data.startDate) event.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) event.endDate = data.endDate ? new Date(data.endDate) : undefined;
  if (data.location !== undefined) event.location = data.location;
  if (data.eventType !== undefined) event.eventType = data.eventType;
  if (data.meetingUrl !== undefined) event.meetingUrl = data.meetingUrl;
  if (data.bannerUrl !== undefined) event.bannerUrl = data.bannerUrl;
  if (data.capacity !== undefined) event.capacity = Number(data.capacity) || 0;
  if (data.status) event.status = data.status;

  await event.save();
  return event;
};

                           
const deleteEvent = async (eventId) => {
  const event = await Event.findByIdAndUpdate(
    eventId,
    { isDeleted: true, status: "cancelled" },
    { new: true },
  );
  if (!event) throw new ApiError(404, "Event not found");
  return event;
};

                                                          
const getAdminEvents = async ({ limit = 20, page = 1, status } = {}) => {
  limit = Math.min(Number(limit) || 20, 100);
  page = Math.max(Number(page) || 1, 1);
  const skip = (page - 1) * limit;

  const q = { isDeleted: { $ne: true } };
  if (status) q.status = status;

  const [events, total] = await Promise.all([
    Event.find(q).sort({ startDate: -1 }).skip(skip).limit(limit).lean(),
    Event.countDocuments(q),
  ]);

  return {
    events,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

                                                   
const getEventRegistrations = async (eventId, { limit = 20, page = 1 } = {}) => {
  limit = Math.min(Number(limit) || 20, 100);
  page = Math.max(Number(page) || 1, 1);
  const skip = (page - 1) * limit;

  const event = await Event.findById(eventId).lean();
  if (!event) throw new ApiError(404, "Event not found");

  const filter = { eventId, status: "registered" };

  const [registrations, total] = await Promise.all([
    EventRegistration.find(filter)
      .sort({ registeredAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        "userId",
        "name avatar companyName role email investorType bio verificationLevel isVerified",
      )
      .lean(),
    EventRegistration.countDocuments(filter),
  ]);

                                                                   
  if (event.registeredCount !== total) {
    await Event.updateOne({ _id: eventId }, { registeredCount: total });
  }

  return {
    event: {
      _id: event._id,
      title: event.title,
      startDate: event.startDate,
      location: event.location,
      registeredCount: total,
    },
    registrations,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

module.exports = {
  getUpcomingEvents,
  registerForEvent,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getAdminEvents,
  getEventRegistrations,
};
