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

const list = async ({ actorId, action, from, to, limit = 50, cursor }) => {
  limit = Math.min(Number(limit) || 50, 200);
  const q = {};
  if (actorId) q.actorId = actorId;
  if (action) q.action = action;
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);
  }
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

// Distinct action types — for the filter dropdown
const actionTypes = async () => {
  return AuditLog.distinct("action");
};

// Export filtered audit logs as CSV
const exportCsv = async ({ actorId, action, from, to } = {}) => {
  const q = {};
  if (actorId) q.actorId = actorId;
  if (action) q.action = action;
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);
  }
  const items = await AuditLog.find(q)
    .sort({ _id: -1 })
    .limit(5000)
    .populate("actorId", "name email role")
    .lean();

  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Date",
    "Admin",
    "Email",
    "Action",
    "Target Type",
    "Target ID",
    "Metadata",
    "IP",
  ].join(",");
  const rows = items.map((a) =>
    [
      esc(new Date(a.createdAt).toISOString()),
      esc(a.actorId?.name),
      esc(a.actorId?.email),
      esc(a.action),
      esc(a.targetType),
      esc(a.targetId),
      esc(JSON.stringify(a.metadata || {})),
      esc(a.ip),
    ].join(","),
  );
  return [header, ...rows].join("\n");
};

module.exports = { log, list, actionTypes, exportCsv };
