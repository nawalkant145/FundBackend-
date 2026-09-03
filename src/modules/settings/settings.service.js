const Settings = require("./settings.model");

                                                          
let cached = null;
let cachedAt = 0;
const TTL = 30 * 1000;       

const ALLOWED_FIELDS = [
  "signupsEnabled",
  "uploadsEnabled",
  "postsEnabled",
  "investmentsEnabled",
  "maintenanceMode",
  "maintenanceMessage",
  "maxPitchesPerFounder",
  "maxPostsPerDay",
  "pitchExpiryDays",
  "profanityFilterEnabled",
  "customBannedWords",
];

                                                                       
const getSettings = async (force = false) => {
  if (!force && cached && Date.now() - cachedAt < TTL) return cached;
  let doc = await Settings.findOne({ key: "global" });
  if (!doc) doc = await Settings.create({ key: "global" });
  cached = doc.toObject();
  cachedAt = Date.now();
  return cached;
};

                                                              
const getCached = () => cached;

const updateSettings = async (updates, adminId) => {
  const sanitized = {};
  for (const k of ALLOWED_FIELDS) {
    if (updates[k] !== undefined) sanitized[k] = updates[k];
  }
  if (Array.isArray(sanitized.customBannedWords)) {
    sanitized.customBannedWords = sanitized.customBannedWords
      .map((w) => String(w).toLowerCase().trim())
      .filter(Boolean);
  }
  sanitized.updatedBy = adminId;
  const doc = await Settings.findOneAndUpdate({ key: "global" }, sanitized, {
    new: true,
    upsert: true,
  });
  cached = doc.toObject();
  cachedAt = Date.now();
  return cached;
};

module.exports = { getSettings, getCached, updateSettings };
