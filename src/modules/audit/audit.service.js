const AuditLog = require("./audit.model");

const log = async ({
  actorId,
  action,
  targetType,
  targetId,
  metadata,
  ip,
  userAgent,
}) => {
  try {
    await AuditLog.create({
      actorId,
      action,
      targetType,
      targetId,
      metadata: metadata || {},
      ip: ip || "",
      userAgent: userAgent || "",
    });
  } catch (e) {
    console.warn("⚠️  Audit log failed:", e.message);
  }
};

const list = async ({ actorId, action, limit = 50, cursor }) => {
  limit = Math.min(Number(limit) || 50, 200);
  const q = {};
  if (actorId) q.actorId = actorId;
  if (action) q.action = action;
  if (cursor) q._id = { $lt: cursor };
  const items = await AuditLog.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("actorId", "name email role")
    .lean();
  const hasMore = items.length > limit;
  return {
    logs: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? items[limit - 1]._id : null,
    hasMore,
  };
};

module.exports = { log, list };
