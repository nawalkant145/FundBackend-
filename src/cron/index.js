const cron = require("node-cron");
const Video = require("../modules/video/video.model");
const User = require("../modules/user/user.model");
const notif = require("../modules/notification/notification.service");
const { sendEmail } = require("../utils/sendEmail");
const { getClient } = require("../config/redis");

// Every hour — expire pitches past expiresAt
const expirePitches = async () => {
  try {
    const expired = await Video.find({
      status: "active",
      expiresAt: { $lte: new Date() },
    });
    for (const v of expired) {
      v.status = "expired";
      await v.save();
      notif
        .send(v.founderId, {
          type: "pitch_expiry",
          title: "Your pitch has expired",
          body: `${v.title} reached 30 days. Renew it to keep getting views.`,
          data: { videoId: v._id.toString() },
        })
        .catch(() => {});
    }
    if (expired.length) console.log(`⏰ Expired ${expired.length} pitch(es)`);
  } catch (e) {
    console.error("❌ expirePitches:", e.message);
  }
};

// Every 5 min — flush video view counts from Redis to MongoDB
const flushViewCounts = async () => {
  try {
    const redis = getClient();
    const keys = await redis.keys("video:views:*");
    for (const key of keys) {
      const count = Number(await redis.get(key)) || 0;
      if (count > 0) {
        const id = key.replace("video:views:", "");
        await Video.findByIdAndUpdate(id, { $inc: { views: count } });
        await redis.del(key);
      }
    }
    if (keys.length) console.log(`📊 Flushed ${keys.length} view counters`);
  } catch (e) {
    console.error("❌ flushViewCounts:", e.message);
  }
};

// Daily — notify founders 3 days before expiry
const expiryReminders = async () => {
  try {
    const window = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const soon = await Video.find({
      status: "active",
      expiresAt: { $lte: window, $gt: new Date() },
    });
    for (const v of soon) {
      notif
        .send(v.founderId, {
          type: "pitch_expiry",
          title: "Pitch expiring soon",
          body: `${v.title} expires in 3 days. Renew it to keep it live.`,
          data: { videoId: v._id.toString() },
        })
        .catch(() => {});
    }
  } catch (e) {
    console.error("❌ expiryReminders:", e.message);
  }
};

// Weekly Monday digest
const weeklyDigest = async () => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Investor digest — new pitches in their preferred industries
    const investors = await User.find({
      role: "investor",
      isActive: true,
      isBanned: false,
      preferredIndustries: { $exists: true, $ne: [] },
    }).select("name email preferredIndustries");

    for (const inv of investors) {
      const newPitches = await Video.countDocuments({
        status: "active",
        createdAt: { $gte: since },
        industry: { $in: inv.preferredIndustries },
      });
      if (newPitches > 0) {
        notif
          .send(inv._id, {
            type: "system",
            title: "Your weekly digest",
            body: `${newPitches} new pitch${newPitches > 1 ? "es" : ""} in your preferred industries`,
            data: { count: newPitches },
          })
          .catch(() => {});
        sendEmail({
          to: inv.email,
          subject: `${newPitches} new pitches this week`,
          html: `<p>Hi ${inv.name},</p><p>${newPitches} new pitch${
            newPitches > 1 ? "es" : ""
          } in your preferred industries this week. Open the app to check them out.</p>`,
        }).catch(() => {});
      }
    }

    // Founder digest — last week's stats
    const founders = await User.find({
      role: "founder",
      isActive: true,
      isBanned: false,
      activePitchId: { $exists: true, $ne: null },
    }).select("name email activePitchId");

    for (const f of founders) {
      const v = await Video.findById(f.activePitchId).select(
        "title views likes saves",
      );
      if (!v) continue;
      notif
        .send(f._id, {
          type: "pitch_views",
          title: "Your weekly stats",
          body: `${v.views} views • ${v.likes.length} likes • ${v.saves.length} saves`,
          data: { videoId: v._id.toString() },
        })
        .catch(() => {});
    }

    console.log(
      `📨 Weekly digest sent to ${investors.length} investors, ${founders.length} founders`,
    );
  } catch (e) {
    console.error("❌ weeklyDigest:", e.message);
  }
};

// Daily — clean up stale online status keys (safety net)
const cleanupExpiredBoosts = async () => {
  try {
    await Video.updateMany(
      { isBoosted: true, boostedUntil: { $lte: new Date() } },
      { isBoosted: false, boostedUntil: null },
    );
  } catch (e) {
    console.error("❌ cleanupExpiredBoosts:", e.message);
  }
};

const startCronJobs = () => {
  // Every hour
  cron.schedule("0 * * * *", expirePitches);
  // Every 5 minutes
  cron.schedule("*/5 * * * *", flushViewCounts);
  // Daily at 9 AM
  cron.schedule("0 9 * * *", expiryReminders);
  // Daily at 2 AM — boost cleanup
  cron.schedule("0 2 * * *", cleanupExpiredBoosts);
  // Monday 9 AM — weekly digest
  cron.schedule("0 9 * * 1", weeklyDigest);
  console.log("⏰ Cron jobs scheduled");
};

module.exports = { startCronJobs };
