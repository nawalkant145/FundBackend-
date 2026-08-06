const Notification = require("./notification.model");
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");
const { getAdmin } = require("../../config/firebase");

// Push via FCM if configured
const pushFCM = async (fcmToken, { title, body, data = {} }) => {
  const admin = getAdmin();
  if (!admin || !fcmToken) return;
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      android: { priority: "high" },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      ),
    });
  } catch (e) {
    console.warn("⚠️  FCM send failed:", e.message);
  }
};

// Map a notification type → the user preference key that gates it.
// Types without an entry are always delivered (e.g. account/security, calls).
const TYPE_TO_PREF = {
  like: "likes",
  save: "saves",
  investment: "investmentInterest",
};

// Main entry — fan out to in-app socket, FCM, and DB
const send = async (userId, payload) => {
  const { type, title, body = "", data = {} } = payload;

  // Respect the recipient's notification preferences (default on)
  const prefKey = TYPE_TO_PREF[type];
  if (prefKey) {
    try {
      const recipient = await User.findById(userId).select("notificationPrefs");
      if (recipient?.notificationPrefs?.[prefKey] === false) {
        return null; // user opted out of this notification type
      }
    } catch {}
  }

  const notif = await Notification.create({ userId, type, title, body, data });

  // Realtime via Socket.io
  try {
    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) io.to(userId.toString()).emit("notification", notif);
  } catch {}

  // Push notification
  const user = await User.findById(userId).select("fcmToken");
  if (user?.fcmToken) {
    pushFCM(user.fcmToken, { title, body, data: { ...data, type } });
  }

  return notif;
};

const list = async (
  userId,
  { limit = 30, cursor, unreadOnly = false } = {},
) => {
  limit = Math.min(Number(limit) || 30, 100);
  const q = { userId };
  if (unreadOnly) q.isRead = false;
  if (cursor) q._id = { $lt: cursor };
  const items = await Notification.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = items.length > limit;
  return {
    notifications: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

const markRead = async (id, userId) => {
  const n = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { isRead: true, readAt: new Date() },
    { new: true },
  );
  if (!n) throw new ApiError(404, "Notification not found");
  return n;
};

const markAllRead = async (userId) => {
  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() },
  );
  return { ok: true };
};

const remove = async (id, userId) => {
  await Notification.deleteOne({ _id: id, userId });
  return { ok: true };
};

const unreadCount = async (userId) => {
  return Notification.countDocuments({ userId, isRead: false });
};

module.exports = { send, list, markRead, markAllRead, remove, unreadCount };
