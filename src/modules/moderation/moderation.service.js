const ModerationFlag = require("./moderation.model");
const { findProfanity } = require("../../utils/profanityFilter");

/**
 * Inspect a piece of user content. If it contains profanity, raise a
 * moderation flag for admin review. Safe to call fire-and-forget.
 */
const flagIfNeeded = async ({
  contentType,
  contentId,
  authorId,
  text,
  extraWords = [],
}) => {
  try {
    const matched = findProfanity(text, extraWords);
    if (matched.length === 0) return null;
    return await ModerationFlag.create({
      contentType,
      contentId,
      authorId,
      originalText: (text || "").slice(0, 1000),
      matchedTerms: matched,
      reason: "profanity",
      status: "pending",
    });
  } catch {
    return null;
  }
};

const listFlags = async ({
  status = "pending",
  contentType,
  limit = 50,
  cursor,
}) => {
  limit = Math.min(Number(limit) || 50, 200);
  const q = {};
  if (status) q.status = status;
  if (contentType) q.contentType = contentType;
  if (cursor) q._id = { $lt: cursor };
  const flags = await ModerationFlag.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("authorId", "name email avatar role")
    .lean();
  const hasMore = flags.length > limit;
  return {
    flags: hasMore ? flags.slice(0, limit) : flags,
    nextCursor: hasMore ? flags[limit - 1]._id : null,
    hasMore,
  };
};

const countPending = async () =>
  ModerationFlag.countDocuments({ status: "pending" });

const resolveFlag = async (flagId, adminId, action) => {
  // action: "approved" | "removed" | "dismissed"
  const flag = await ModerationFlag.findByIdAndUpdate(
    flagId,
    { status: action, reviewedBy: adminId, reviewedAt: new Date() },
    { new: true },
  );
  return flag;
};

module.exports = { flagIfNeeded, listFlags, countPending, resolveFlag };
