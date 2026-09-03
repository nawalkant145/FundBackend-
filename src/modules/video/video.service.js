const mongoose = require("mongoose");
const Video = require("./video.model");
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");
const {
  uploadVideoToCloudinary,
  deleteFromCloudinary,
} = require("../../utils/cloudinaryUpload");
const { getClient } = require("../../config/redis");
const { cleanText } = require("../../utils/profanityFilter");
const settingsService = require("../settings/settings.service");
const {
  toObjectId,
  enrichVideo,
  enrichVideos,
} = require("../../utils/engagement");


const MIN_DURATION = 10;
const MAX_DURATION = 120;
const MAX_TOTAL_PITCHES = 3;
const PITCH_EXPIRY_DAYS = 30;

const FEED_TTL = 5 * 60;         
const FEED_PAGE_SIZE = 5;

const uploadPitch = async (founderId, file, body) => {
  if (!file) throw new ApiError(400, "Video file required");

  const settings = await settingsService.getSettings().catch(() => ({}));
  if (settings.uploadsEnabled === false) {
    throw new ApiError(403, "Pitch uploads are temporarily disabled by admin");
  }
  const maxPitches = settings.maxPitchesPerFounder || MAX_TOTAL_PITCHES;
  const expiryDays = settings.pitchExpiryDays || PITCH_EXPIRY_DAYS;

  const founder = await User.findById(founderId);
  if (!founder) throw new ApiError(404, "Founder not found");
  if (founder.role !== "founder") {
    throw new ApiError(403, "Only founders can upload pitches");
  }
  const isPhoneVerified = (u) => !!(u?.phoneVerified || u?.isPhoneVerified || (u?.verificationLevel || 0) >= 1);
  if (!isPhoneVerified(founder)) {
    throw new ApiError(403, "Verify phone before uploading");
  }

  const totalPitches = await Video.countDocuments({
    founderId,
    status: { $in: ["active", "processing", "paused"] },
  });
  if (totalPitches >= maxPitches) {
    throw new ApiError(400, `Max ${maxPitches} active pitches allowed`);
  }

                                                                                      

  const uploaded = await uploadVideoToCloudinary(file.path);

                      
  const dur = Math.round(uploaded.duration || 0);
  if (dur < MIN_DURATION || dur > MAX_DURATION) {
    await deleteFromCloudinary(uploaded.publicId, "video");
    throw new ApiError(
      400,
      `Video must be between ${MIN_DURATION} and ${MAX_DURATION} seconds (got ${dur}s)`,
    );
  }

                                                    
  const hlsUrl = uploaded.url.replace(/\.[^.]+$/, ".m3u8");

                                                         
  const thumbnailUrl = uploaded.url
    .replace("/video/upload/", "/video/upload/so_1,w_640,h_360,c_fill/")
    .replace(/\.[^.]+$/, ".jpg");

  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const filterOn = settings.profanityFilterEnabled !== false;
  const extraWords = settings.customBannedWords || [];

  const video = await Video.create({
    founderId,
    title: filterOn ? cleanText(body.title, extraWords) : body.title,
    description: filterOn
      ? cleanText(body.description || "", extraWords)
      : body.description || "",
    videoUrl: uploaded.url,
    hlsUrl,
    thumbnailUrl,
    cloudinaryPublicId: uploaded.publicId,
    duration: dur,
    industry: body.industry || founder.industry,
    fundingStage: body.fundingStage || founder.fundingStage,
    askAmount: Number(body.askAmount) || 0,
    equityOffered: Number(body.equityOffered) || 0,
    visibility:
      body.visibility === "investors-only" ? "investors-only" : "everyone",
    status: "active",
    expiresAt,
  });

  founder.activePitchId = video._id;
  await founder.save({ validateBeforeSave: false });

                                                                       
  try {
    const moderation = require("../moderation/moderation.service");
    moderation
      .flagIfNeeded({
        contentType: "video",
        contentId: video._id,
        authorId: founderId,
        text: `${body.title || ""} ${body.description || ""}`,
        extraWords,
      })
      .catch(() => {});
  } catch {}

                          
  await invalidateFeedCache();
  return video;
};

const invalidateFeedCache = async () => {
  try {
    const redis = getClient();
    const keys = await redis.keys("feed:*");
    if (keys.length) await redis.del(...keys);
  } catch (e) {
    console.warn("⚠️  Feed cache invalidate failed:", e.message);
  }
};

                                                       
const invalidateUserFeedCache = async (userId) => {
  try {
    const redis = getClient();
    const keys = await redis.keys(`feed:${userId}:*`);
    if (keys.length) await redis.del(...keys);
  } catch (e) {
    console.warn("⚠️  User feed cache invalidate failed:", e.message);
  }
};

const buildFeedQuery = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const blocked = user.blockedUsers || [];
                                                            
  const seen = await Video.find({ notInterested: userId }).distinct("_id");

                                                                        
  const $and = [
    { status: "active" },
    {
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    },
    { _id: { $nin: seen } },
    { founderId: { $nin: blocked } },
  ];

                                                                           
  if (user.role === "founder") {
    $and.push({ visibility: { $ne: "investors-only" } });
  }

                                                               
                                                                         
                                                                            
                                                                               
                                                                              
                                                                              
                                             
  return { $and, preferredIndustries: user.preferredIndustries || [] };
};

const getFeed = async (investorId, { cursor, limit = FEED_PAGE_SIZE } = {}) => {
  limit = Math.min(Number(limit) || FEED_PAGE_SIZE, 20);

  const cacheKey = `feed:${investorId}:${cursor || "start"}:${limit}`;
  try {
    const redis = getClient();
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

                                                                             
  const { preferredIndustries = [], ...baseQuery } = await buildFeedQuery(investorId);

                                                                      
                                                                    
                                                                      
                                                                           
                                                                          
                                                                           
                                                                     
    
                                                         
                                   
                                                                      
                                                                            
                                                          
                                                                        
    
                                        
                                                                         
                                                                            
                                                                      

  const now = new Date();

                                                                         
                                                                        
  if (!cursor) {
    const { expireStale } = require("../boost/boost.service");
    expireStale().catch(() => {});
  }

  let boostedSection = [];
  let boostedVideoIds = new Set();

                                                                
                                                                               
  if (!cursor) {
    try {
      const { getActiveBoostedForFeed, recordShownTo } = require("../boost/boost.service");
      const activeBoosted = await getActiveBoostedForFeed(investorId);

      if (activeBoosted.length > 0) {
        const boostedVidIds = activeBoosted.map((b) => b.videoId);

                                                                           
                                                                            
                                                                           
                             
          
                                                                            
                                                                  
        const boostedQuery = {
          $and: [
            ...(baseQuery.$and || []),
            { _id: { $in: boostedVidIds } },
                                                   
                                                                          
                                                         
            { isBoosted: true },
            { boostedUntil: { $gt: now } },
          ],
        };

        let boostedVideos;
        if (preferredIndustries.length > 0) {
          boostedVideos = await Video.aggregate([
            { $match: boostedQuery },
            {
              $addFields: {
                prefMatch: {
                  $cond: [{ $in: ["$industry", preferredIndustries] }, 1, 0],
                },
              },
            },
            { $sort: { prefMatch: -1, createdAt: -1, _id: -1 } },
            {
              $lookup: {
                from: "users",
                localField: "founderId",
                foreignField: "_id",
                as: "_founderArr",
              },
            },
            {
              $addFields: {
                founderId: { $mergeObjects: [{ $arrayElemAt: ["$_founderArr", 0] }] },
              },
            },
            { $unset: ["_founderArr", "prefMatch"] },
          ]);

          const safeFields = ["_id", "name", "avatar", "companyName", "industry", "isVerified"];
          boostedVideos = boostedVideos.map((v) => ({
            ...v,
            founderId: v.founderId
              ? Object.fromEntries(safeFields.map((f) => [f, v.founderId[f]]))
              : v.founderId,
          }));
        } else {
          boostedVideos = await Video.find(boostedQuery)
            .sort({ createdAt: -1, _id: -1 })
            .populate("founderId", "name avatar companyName industry isVerified")
            .lean();
        }

        if (boostedVideos.length > 0) {
          boostedSection = boostedVideos;
          boostedVideoIds = new Set(boostedVideos.map((v) => v._id.toString()));

                                                                             
                                                                
          const vidToBoost = {};
          activeBoosted.forEach((b) => {
            vidToBoost[b.videoId.toString()] = b.boostId;
          });
          boostedVideos.forEach((v) => {
            const bId = vidToBoost[v._id.toString()];
            if (bId) {
              recordShownTo(bId, investorId).catch(() => {});
            }
          });
        }
      }
    } catch (e) {
                                                       
      console.warn("⚠️  Boost section build failed:", e.message);
    }
  }

                                                                      
                                                                     
                                                                      
                                                                       
  if (cursor) {
    let cursorCreatedAt = null;
    let cursorId = cursor;

                                                      
    if (cursor.includes("_")) {
      const sepIdx = cursor.indexOf("_");
      cursorCreatedAt = new Date(cursor.slice(0, sepIdx));
      cursorId = cursor.slice(sepIdx + 1);
    }

    if (cursorCreatedAt && !isNaN(cursorCreatedAt.getTime())) {
      baseQuery.$and = [
        ...(baseQuery.$and || []),
        {
          $or: [
            { createdAt: { $lt: cursorCreatedAt } },
            { createdAt: cursorCreatedAt, _id: { $lt: cursorId } },
          ],
        },
      ];
    } else {
      baseQuery.$and = [...(baseQuery.$and || []), { _id: { $lt: cursorId } }];
    }
  }

                                                                                
  if (boostedVideoIds.size > 0) {
    const mongoose = require("mongoose");
    const excludeIds = [...boostedVideoIds].map((id) => new mongoose.Types.ObjectId(id));
    baseQuery.$and = [
      ...(baseQuery.$and || []),
      { _id: { $nin: excludeIds } },
    ];
  }

                                                                        
  const normalLimit = limit - boostedSection.length;

                                                                              
                                                                           
                                                                   
  let videos;
  if (normalLimit > 0) {
    if (preferredIndustries.length > 0) {
      videos = await Video.aggregate([
        { $match: baseQuery },
        {
          $addFields: {
            prefMatch: {
              $cond: [
                { $in: ["$industry", preferredIndustries] },
                1,
                0,
              ],
            },
                                                                                      
            effectiveBoosted: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isBoosted", true] },
                    { $gt: ["$boostedUntil", now] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
        { $sort: { effectiveBoosted: -1, prefMatch: -1, createdAt: -1, _id: -1 } },
        { $limit: normalLimit + 1 },
        {
          $lookup: {
            from: "users",
            localField: "founderId",
            foreignField: "_id",
            as: "_founderArr",
          },
        },
        {
          $addFields: {
            founderId: {
              $mergeObjects: [
                { $arrayElemAt: ["$_founderArr", 0] },
              ],
            },
          },
        },
        { $unset: ["_founderArr", "prefMatch", "effectiveBoosted"] },
      ]);

                                                                       
      const safeFields = ["_id", "name", "avatar", "companyName", "industry", "isVerified"];
      videos = videos.map((v) => ({
        ...v,
        founderId: v.founderId
          ? Object.fromEntries(safeFields.map((f) => [f, v.founderId[f]]))
          : v.founderId,
      }));
    } else {
                                                
      videos = await Video.find(baseQuery)
        .sort({ isBoosted: -1, createdAt: -1, _id: -1 })
        .limit(normalLimit + 1)
        .populate("founderId", "name avatar companyName industry isVerified")
        .lean();
    }
  } else {
    videos = [];
  }

                                                      
  const hasMore = videos.length > normalLimit;
  const normalItems = hasMore ? videos.slice(0, normalLimit) : videos;
  const items = [...boostedSection, ...normalItems];

                                                                           
                                                                           
  const lastNormal = normalItems.length > 0 ? normalItems[normalItems.length - 1] : null;
  const nextCursor = lastNormal
    ? `${new Date(lastNormal.createdAt).toISOString()}_${lastNormal._id}`
    : null;

                                                                
  const Comment = require("../comment/comment.model");
  const videoIds = items.map((v) => v._id);
  const commentCounts = {};
  try {
    const counts = await Comment.aggregate([
      {
        $match: {
          videoId: { $in: videoIds },
          parentId: null,
          isDeleted: false,
          isHidden: false,
        },
      },
      { $group: { _id: "$videoId", count: { $sum: 1 } } },
    ]);
    counts.forEach((c) => {
      commentCounts[c._id.toString()] = c.count;
    });
  } catch {}

                                                                            
  const enriched = enrichVideos(items, investorId).map((v) => ({
    ...v,
    commentCount: commentCounts[v._id.toString()] ?? v.commentCount ?? 0,
  }));

  const result = { videos: enriched, nextCursor, hasMore };

  try {
    const redis = getClient();
    await redis.set(cacheKey, JSON.stringify(result), "EX", FEED_TTL);
  } catch {}

  return result;
};

const getVideoById = async (videoId, userId) => {
  const video = await Video.findById(videoId)
    .populate(
      "founderId",
      "name avatar companyName industry isVerified bio website linkedIn",
    )
    .lean();
  if (!video) throw new ApiError(404, "Video not found");

                                                                 
  try {
    const Comment = require("../comment/comment.model");
    const realCount = await Comment.countDocuments({
      videoId: video._id,
      parentId: null,
      isDeleted: false,
      isHidden: false,
    });
    if (video.commentCount !== realCount) {
      video.commentCount = realCount;
                                                                 
      await Video.findByIdAndUpdate(video._id, { commentCount: realCount });
    }
  } catch {}

  if (userId) {
    return enrichVideo(video, userId);
  }
  return video;
};

const updateVideo = async (videoId, founderId, updates) => {
  const allowed = [
    "title",
    "description",
    "askAmount",
    "equityOffered",
    "industry",
  ];
  const sanitized = {};
  for (const k of allowed)
    if (updates[k] !== undefined) sanitized[k] = updates[k];
  if (sanitized.title) sanitized.title = cleanText(sanitized.title);
  if (sanitized.description)
    sanitized.description = cleanText(sanitized.description);

  const video = await Video.findOneAndUpdate(
    { _id: videoId, founderId },
    sanitized,
    { new: true, runValidators: true },
  )
    .populate("founderId", "name avatar companyName isVerified")
    .lean();
  if (!video) throw new ApiError(404, "Video not found");
  await invalidateFeedCache();
  return enrichVideo(video, founderId);
};

const deleteVideo = async (videoId, founderId) => {
  const video = await Video.findOne({ _id: videoId, founderId });
  if (!video) throw new ApiError(404, "Video not found");
  if (video.cloudinaryPublicId) {
    await deleteFromCloudinary(video.cloudinaryPublicId, "video");
  }
  await video.deleteOne();
  await User.findByIdAndUpdate(founderId, { $unset: { activePitchId: 1 } });
  await invalidateFeedCache();
};

const likeVideo = async (videoId, investorId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  const uid = toObjectId(investorId);
  const uidStr = investorId.toString();

  const liked = (video.likes || []).some(
    (id) => id && id.toString() === uidStr,
  );

  let updatedVideo;
  if (liked) {
                             
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $pull: { likes: { $in: [uid, uidStr] } } },
      { new: true },
    );
  } else {
                                                      
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      {
        $addToSet: { likes: uid },
        $pull: { notInterested: { $in: [uid, uidStr] } },
      },
      { new: true },
    );
  }

                                                                             
                                                          
  await Promise.all([
    invalidateUserFeedCache(investorId),
    invalidateFeedCache(),
  ]);

  const total = (updatedVideo.likes || []).length;
  const payload = {
    videoId: videoId.toString(),
    liked: !liked,
    likeCount: total,
    count: total,
    totalLikes: total,
  };

                                                                   
  try {
    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) io.emit("pitch:engagement", payload);
  } catch {}

                               
  if (!liked && video.founderId.toString() !== uidStr) {
    try {
      const notif = require("../notification/notification.service");
      const investor = await User.findById(investorId).select("name");
      notif
        .send(video.founderId, {
          type: "like",
          title: `${investor?.name || "An investor"} liked your pitch`,
          body: video.title,
          data: {
            videoId: video._id.toString(),
            investorId: uidStr,
          },
        })
        .catch(() => {});
    } catch {}
  }
  return payload;
};

const saveVideo = async (videoId, investorId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  const uid = toObjectId(investorId);
  const uidStr = investorId.toString();

  const saved = (video.saves || []).some(
    (id) => id && id.toString() === uidStr,
  );

  let updatedVideo;
  if (saved) {
                                                      
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $pull: { saves: { $in: [uid, uidStr] } } },
      { new: true },
    );
  } else {
                                                                                 
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $addToSet: { saves: uid } },
      { new: true },
    );
  }

                                                                             
                                                          
  await Promise.all([
    invalidateUserFeedCache(investorId),
    invalidateFeedCache(),
  ]);

  const total = (updatedVideo.saves || []).length;
  const payload = {
    videoId: videoId.toString(),
    saved: !saved,
    saveCount: total,
    count: total,
    totalSaves: total,
  };

                                                                   
  try {
    const { getIO } = require("../../socket");
    const io = getIO();
    if (io) io.emit("pitch:engagement", payload);
  } catch {}

                               
  if (!saved && video.founderId.toString() !== uidStr) {
    try {
      const notif = require("../notification/notification.service");
      const investor = await User.findById(investorId).select("name");
      notif
        .send(video.founderId, {
          type: "save",
          title: `${investor?.name || "An investor"} saved your pitch`,
          body: video.title,
          data: {
            videoId: video._id.toString(),
            investorId: uidStr,
          },
        })
        .catch(() => {});
    } catch {}
  }
  return payload;
};

const markNotInterested = async (videoId, investorId) => {
  const uid = toObjectId(investorId);
  const uidStr = investorId.toString();

  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  const interested = (video.notInterested || []).some(
    (id) => id && id.toString() === uidStr,
  );

  if (!interested) {
    await Video.findByIdAndUpdate(
      videoId,
      { $addToSet: { notInterested: uid } },
      { new: true },
    );
  }
  return { notInterested: true };
};

const logView = async (videoId, investorId, watchedSeconds = 0) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");

  const isUnique = !video.uniqueViews.some(
    (id) => id.toString() === investorId.toString(),
  );
  if (isUnique) video.uniqueViews.push(investorId);

                                                                         
                                                                           
                                                                             
                                                                            
                                                                              
                                                          
                                                                        
                                                                              
  let redisBuffered = false;
  try {
    const redis = getClient();
    await redis.incr(`video:views:${videoId}`);
    redisBuffered = true;
  } catch {
                                                             
  }

  if (!redisBuffered) {
                                         
    video.views = (video.views || 0) + 1;
  }

  if (watchedSeconds > 0) {
    video.watchTimeData.push({
      investorId,
      watchedSeconds: Math.min(watchedSeconds, video.duration),
      completedAt: watchedSeconds >= video.duration * 0.95 ? new Date() : null,
    });
  }
  await video.save();
  return { logged: true, views: video.views };
};

const getMyPitches = async (founderId) => {
  const videos = await Video.find({ founderId })
    .sort({ createdAt: -1 })
    .populate("founderId", "name avatar companyName isVerified")
    .lean();
  return enrichWithCommentCounts(videos, founderId);
};

                                                                       
const getUserPitches = async (founderIdOrUsername, viewerId) => {
  const userService = require("../user/user.service");
  const founderId =
    (await userService.resolveUserId(founderIdOrUsername)) || founderIdOrUsername;
  const videos = await Video.find({
    founderId,
    status: "active",
    visibility: { $ne: "investors-only" },
  })
    .sort({ createdAt: -1 })
    .populate("founderId", "name avatar companyName isVerified")
    .lean();
  return enrichWithCommentCounts(videos, viewerId || founderId);
};

const getSavedPitches = async (investorId) => {
                                                                       
  const uid = toObjectId(investorId);

  const videos = await Video.find({
    saves: uid,
    status: { $ne: "deleted" },
  })
    .sort({ createdAt: -1 })
    .populate("founderId", "name username avatar companyName industry isVerified")
    .lean();

                                                                           
  const enriched = await enrichWithCommentCounts(videos, uid);
  return enriched.map((v) => ({ ...v, isSaved: true }));
};

                                                                           
const enrichWithCommentCounts = async (videos, userId) => {
  if (!videos.length) return videos;
  const Comment = require("../comment/comment.model");
  const videoIds = videos.map((v) => v._id);
  const commentCounts = {};
  try {
    const counts = await Comment.aggregate([
      {
        $match: {
          videoId: { $in: videoIds },
          isDeleted: false,
          isHidden: false,
        },
      },
      { $group: { _id: "$videoId", count: { $sum: 1 } } },
    ]);
    counts.forEach((c) => {
      commentCounts[c._id.toString()] = c.count;
    });
  } catch {}

  return enrichVideos(videos, userId).map((v) => ({
    ...v,
    commentCount: commentCounts[v._id.toString()] ?? v.commentCount ?? 0,
  }));
};

const getAnalytics = async (videoId, founderId) => {
  const video = await Video.findOne({ _id: videoId, founderId });
  if (!video) throw new ApiError(404, "Video not found");

  const totalViews = video.views;
  const uniqueViewers = video.uniqueViews.length;
  const totalLikes = video.likes.length;
  const totalSaves = video.saves.length;
  const watchData = video.watchTimeData;
  const avgWatchTime =
    watchData.length === 0
      ? 0
      : Math.round(
          watchData.reduce((s, w) => s + (w.watchedSeconds || 0), 0) /
            watchData.length,
        );
  const completionRate =
    watchData.length === 0
      ? 0
      : Math.round(
          (watchData.filter((w) => w.completedAt).length / watchData.length) *
            100,
        );

                                                         
  let commentCount = 0;
  try {
    const Comment = require("../comment/comment.model");
    commentCount = await Comment.countDocuments({
      videoId: video._id,
      parentId: null,
      isDeleted: false,
      isHidden: false,
    });
  } catch {}

  return {
    videoId: video._id,
    title: video.title,
    duration: video.duration,
    totalViews,
    uniqueViewers,
    totalLikes,
    totalSaves,
    likeCount: totalLikes,
    saveCount: totalSaves,
    commentCount,
    avgWatchTime,
    completionRate,
    notInterestedCount: video.notInterested.length,
  };
};

const renewPitch = async (videoId, founderId) => {
  const video = await Video.findOne({ _id: videoId, founderId });
  if (!video) throw new ApiError(404, "Video not found");
  video.expiresAt = new Date(
    Date.now() + PITCH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );
  video.isRenewed = true;
  if (video.status === "expired") video.status = "active";
  await video.save();
  await invalidateFeedCache();
                                                                            
  const lean = await Video.findById(video._id)
    .populate("founderId", "name avatar companyName isVerified")
    .lean();
  return enrichVideo(lean, founderId);
};

                                                 
const getTrending = async ({ limit = 10, userId } = {}) => {
  limit = Math.min(Number(limit) || 10, 30);
  const videos = await Video.aggregate([
    {
      $match: {
        status: "active",
        $or: [
          { expiresAt: { $gt: new Date() } },
          { expiresAt: { $exists: false } },
          { expiresAt: null },
        ],
      },
    },
    {
      $addFields: {
        score: {
          $add: [
            { $ifNull: ["$views", 0] },
            { $multiply: [{ $size: { $ifNull: ["$likes", []] } }, 5] },
            { $multiply: [{ $size: { $ifNull: ["$saves", []] } }, 10] },
            { $multiply: [{ $ifNull: ["$commentCount", 0] }, 8] },
            { $multiply: [{ $cond: ["$isBoosted", 100, 0] }, 1] },
          ],
        },
      },
    },
    { $sort: { score: -1, createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "founderId",
        foreignField: "_id",
        as: "founder",
      },
    },
    { $unwind: "$founder" },
    {
      $project: {
        pitchId: "$_id",
        _id: 1,
        title: 1,
        description: 1,
        videoUrl: 1,
        hlsUrl: 1,
        thumbnailUrl: 1,
        duration: 1,
        industry: 1,
        fundingStage: 1,
        askAmount: 1,
        equityOffered: 1,
        views: 1,
        score: 1,
        createdAt: 1,
        likes: 1,
        saves: 1,
        commentCount: 1,
        founderId: {
          _id: "$founder._id",
          name: "$founder.name",
          avatar: "$founder.avatar",
          companyName: "$founder.companyName",
          isVerified: "$founder.isVerified",
        },
      },
    },
  ]);

                                                                            
  const enriched = enrichVideos(videos, userId);

  return enriched.map((v) => {
    const viewsCount = v.views || 0;
    const daysOld = Math.max(0.5, (Date.now() - new Date(v.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    let viewGrowthPercent = 0;
    if (viewsCount > 0) {
      const dailyVelocity = viewsCount / daysOld;
      const likesCount = Array.isArray(v.likes) ? v.likes.length : 0;
      viewGrowthPercent = Math.min(99, Math.max(5, Math.round(dailyVelocity * 10 + likesCount * 2)));
    }
    return {
      ...v,
      viewGrowthPercent,
    };
  });
};

                         
const searchVideos = async ({
  q,
  industry,
  fundingStage,
  minAsk,
  maxAsk,
  sort,
  limit = 20,
  cursor,
  userId,
}) => {
  limit = Math.min(Number(limit) || 20, 50);
  const filter = {
    status: "active",
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: { $exists: false } },
      { expiresAt: null },
    ],
  };
  if (industry) filter.industry = industry;
  if (fundingStage) filter.fundingStage = fundingStage;
  if (minAsk)
    filter.askAmount = { ...(filter.askAmount || {}), $gte: Number(minAsk) };
  if (maxAsk)
    filter.askAmount = { ...(filter.askAmount || {}), $lte: Number(maxAsk) };
  if (q) {
    const qRegex = new RegExp(q, "i");
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [{ title: qRegex }, { description: qRegex }],
      },
    ];
  }
  if (cursor) filter._id = { $lt: cursor };

  let sortOption = { createdAt: -1, _id: -1 };
  if (sort === "trending") {
    sortOption = { views: -1, commentCount: -1, createdAt: -1 };
  } else if (sort === "newest" || sort === "new") {
    sortOption = { createdAt: -1, _id: -1 };
  }

  const videos = await Video.find(filter)
    .sort(sortOption)
    .limit(limit + 1)
    .populate("founderId", "name avatar companyName isVerified")
    .lean();

  const hasMore = videos.length > limit;
  const page = hasMore ? videos.slice(0, limit) : videos;

                                                                            
  const enriched = enrichVideos(page, userId);

  return {
    videos: enriched,
    nextCursor: hasMore ? page[page.length - 1]._id : null,
    hasMore,
  };
};

const togglePause = async (videoId, founderId) => {
  const video = await Video.findOne({ _id: videoId, founderId });
  if (!video) throw new ApiError(404, "Video not found");
  if (video.status === "active") video.status = "paused";
  else if (video.status === "paused") video.status = "active";
  await video.save();
  await invalidateFeedCache();
                                                                            
  const lean = await Video.findById(video._id)
    .populate("founderId", "name avatar companyName isVerified")
    .lean();
  return enrichVideo(lean, founderId);
};

module.exports = {
  uploadPitch,
  getFeed,
  buildFeedQuery,
  getTrending,
  searchVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  likeVideo,
  saveVideo,
  markNotInterested,
  logView,
  getMyPitches,
  getUserPitches,
  getSavedPitches,
  getAnalytics,
  renewPitch,
  togglePause,
  invalidateFeedCache,
};
