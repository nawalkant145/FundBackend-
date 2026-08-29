const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const notif = require("./notification.service");

const list = asyncHandler(async (req, res) => {
  const result = await notif.list(req.user._id, {
    cursor: req.query.cursor,
    limit: req.query.limit,
    unreadOnly: req.query.unreadOnly === "true",
  });
  console.log("[FOUNDER_NOTIFICATION_API]", {
    authenticatedUserId: req.user._id.toString(),
    notificationCount: result?.notifications?.length || 0,
    matchingInvestmentNotifications: (result?.notifications || [])
      .filter((n) => n.type === "investment")
      .map((n) => ({
        id: n._id.toString(),
        title: n.title,
        dataStatus: n.data?.status,
        investmentId: n.data?.investmentId,
      })),
  });
  res.status(200).json(new ApiResponse(200, result, "Notifications"));
});

const markRead = asyncHandler(async (req, res) => {
  const n = await notif.markRead(req.params.id, req.user._id);
  res
    .status(200)
    .json(new ApiResponse(200, { notification: n }, "Marked read"));
});

const markAllRead = asyncHandler(async (req, res) => {
  await notif.markAllRead(req.user._id);
  res.status(200).json(new ApiResponse(200, null, "All marked read"));
});

const remove = asyncHandler(async (req, res) => {
  await notif.remove(req.params.id, req.user._id);
  res.status(200).json(new ApiResponse(200, null, "Deleted"));
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await notif.unreadCount(req.user._id);
  res.status(200).json(new ApiResponse(200, { count }, "Unread count"));
});

const getById = asyncHandler(async (req, res) => {
  const n = await notif.getById(req.params.id, req.user._id);
  res.status(200).json(new ApiResponse(200, { notification: n }, "Notification detail"));
});

module.exports = { list, markRead, markAllRead, remove, unreadCount, getById };
