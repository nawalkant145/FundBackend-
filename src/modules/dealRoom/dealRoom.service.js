const DealRoom = require("./dealRoom.model");
const User = require("../user/user.model");
const { Chat, Message } = require("../chat/chat.model");
const ApiError = require("../../utils/ApiError");
const notificationService = require("../notification/notification.service");

const DEFAULT_CHECKLIST_ITEMS = [
  { key: "dd_incorporation", title: "Certificate of Incorporation / Registration", category: "corporate", status: "pending" },
  { key: "dd_cap_table", title: "Cap Table & Shareholding Pattern", category: "corporate", status: "pending" },
  { key: "dd_financials", title: "Audited Financial Statements & Bank Accounts", category: "financial", status: "pending" },
  { key: "dd_tax_compliance", title: "Corporate Tax & Compliance Filings", category: "tax", status: "pending" },
  { key: "dd_legal_terms", title: "Term Sheet & SHA Governance Agreement", category: "legal", status: "pending" },
];

const createDealRoom = async (user, payload) => {
                                                                                                
  const dbUser = await User.findById(user._id);
  if (
    !dbUser ||
    (!dbUser.identityVerified &&
      (dbUser.verificationLevel || 0) < 1 &&
      dbUser.kycStatus !== "approved" &&
      dbUser.documents?.status !== "approved")
  ) {
    throw new ApiError(
      403,
      "Identity Verification required before creating a Deal Room",
      { code: "IDENTITY_VERIFICATION_REQUIRED", cta: "/kyc" }
    );
  }

  let founderId = payload.founderId;
  let investorId = payload.investorId;
  let targetId = payload.targetId;

  if (user.role === "founder") {
    founderId = user._id;
    if (!targetId && payload.investorId) targetId = payload.investorId;
  } else if (user.role === "investor") {
    investorId = user._id;
    if (!targetId && payload.founderId) targetId = payload.founderId;
  }

  if (!targetId) {
    if (user._id.toString() === founderId?.toString()) {
      targetId = investorId;
    } else if (user._id.toString() === investorId?.toString()) {
      targetId = founderId;
    }
  }

  if (!founderId && targetId) founderId = user._id;
  if (!investorId && targetId) investorId = targetId;

  if (!founderId || !investorId) {
    throw new ApiError(400, "Both founderId and investorId (or targetId) are required to create a Deal Room.");
  }

  const founder = await User.findById(founderId);
  const investor = await User.findById(investorId);

  if (!founder || !investor) {
    throw new ApiError(444, "Founder or Investor user not found.");
  }

  const initiatorRole = user.role;
  const targetUser = user._id.toString() === founder._id.toString() ? investor : founder;
  const targetRole = targetUser.role;

                                        
                                     
                                     
                                                 
                                     
  let initialStatus = "active";
  if (initiatorRole === "founder" && targetRole === "investor") {
    initialStatus = "pending_acceptance";
  }

                                   
  let existingRoom = await DealRoom.findOne({
    $or: [
      { founderId, investorId },
      { founderId: investorId, investorId: founderId },
    ],
    status: { $in: ["active", "pending_acceptance"] },
  });

  if (existingRoom) {
    if (existingRoom.status === "active" && (payload.fundingAmount || payload.proposedValuation || payload.equityPercentage)) {
      if (payload.fundingAmount) existingRoom.fundingAmount = Number(payload.fundingAmount);
      if (payload.proposedValuation) existingRoom.proposedValuation = Number(payload.proposedValuation);
      if (payload.equityPercentage) existingRoom.equityPercentage = Number(payload.equityPercentage);
      await existingRoom.save();
    }
    return existingRoom;
  }

                                                                           
  const dealRoom = await DealRoom.create({
    chatId: payload.chatId || null,
    founderId,
    investorId,
    videoId: payload.videoId || null,
    fundingAmount: Number(payload.fundingAmount) || 0,
    proposedValuation: Number(payload.proposedValuation) || 0,
    equityPercentage: Number(payload.equityPercentage) || 0,
    stage: "deal_agreed",
    checklist: DEFAULT_CHECKLIST_ITEMS,
    documents: [],
    requestedBy: user._id,
    requestedTo: targetUser._id,
    status: initialStatus,
  });

                                              
  if (initialStatus === "pending_acceptance") {
    try {
      await notificationService.send(targetUser._id, {
        type: "deal_room_request",
        title: "New Deal Room Request",
        body: `${user.name} wants to proceed with a Deal Room.`,
        data: { dealRoomId: dealRoom._id, chatId: payload.chatId },
      });
    } catch (e) {
      console.warn("Could not send deal_room_request notification:", e.message);
    }

    if (payload.chatId) {
      try {
        const chat = await Chat.findById(payload.chatId);
        if (chat) {
          await Message.create({
            chatId: chat._id,
            senderId: user._id,
            receiverId: targetUser._id,
            message: "🔐 Deal Room request sent to Investor.",
            messageType: "system",
            type: "system",
          });
          chat.lastMessage = "🔐 Deal Room Request Sent";
          chat.lastMessageAt = new Date();
          await chat.save();
        }
      } catch (e) {
        console.warn("Could not post system chat message:", e.message);
      }
    }
  } else {
    try {
      await notificationService.send(targetUser._id, {
        type: "deal_room_created",
        title: "Deal Room Created",
        body: `${user.name} started a Deal Room with you.`,
        data: { dealRoomId: dealRoom._id, chatId: payload.chatId },
      });
    } catch (e) {
      console.warn("Could not send deal_room_created notification:", e.message);
    }

    if (payload.chatId) {
      try {
        const chat = await Chat.findById(payload.chatId);
        if (chat) {
          await Message.create({
            chatId: chat._id,
            senderId: user._id,
            receiverId: targetUser._id,
            message: `🔐 Deal Room created! Funding: ₹${(dealRoom.fundingAmount || 0).toLocaleString('en-IN')} for ${dealRoom.equityPercentage || 0}% equity.`,
            messageType: "system",
            type: "system",
          });
          chat.lastMessage = "🔐 Deal Room Created";
          chat.lastMessageAt = new Date();
          await chat.save();
        }
      } catch (e) {
        console.warn("Could not post system chat message:", e.message);
      }
    }
  }

  return dealRoom;
};

const acceptDealRoomRequest = async (dealRoomId, user) => {
                                                                                                
  const dbUser = await User.findById(user._id);
  if (
    !dbUser ||
    (!dbUser.identityVerified &&
      (dbUser.verificationLevel || 0) < 1 &&
      dbUser.kycStatus !== "approved" &&
      dbUser.documents?.status !== "approved")
  ) {
    throw new ApiError(
      403,
      "Identity Verification required before accepting a Deal Room",
      { code: "IDENTITY_VERIFICATION_REQUIRED", cta: "/kyc" }
    );
  }

  const dealRoom = await DealRoom.findById(dealRoomId);
  if (!dealRoom) throw new ApiError(404, "Deal Room not found.");

  if (dealRoom.status !== "pending_acceptance") {
    throw new ApiError(400, "Deal Room request is not pending acceptance.");
  }

                                                                       
  if (!dealRoom.requestedTo || dealRoom.requestedTo.toString() !== user._id.toString()) {
    throw new ApiError(403, "Only the target investor can accept this Deal Room request.");
  }

  dealRoom.status = "active";
  await dealRoom.save();

  if (dealRoom.requestedBy) {
    try {
      await notificationService.send(dealRoom.requestedBy, {
        type: "deal_room_accepted",
        title: "Deal Room Request Accepted",
        body: `Your Deal Room request was accepted.`,
        data: { dealRoomId: dealRoom._id },
      });
    } catch (e) {
      console.warn("Could not send notification:", e.message);
    }
  }

  if (dealRoom.chatId) {
    try {
      const chat = await Chat.findById(dealRoom.chatId);
      if (chat) {
        await Message.create({
          chatId: chat._id,
          senderId: user._id,
          receiverId: dealRoom.requestedBy,
          message: "🔐 Deal Room is now active.",
          messageType: "system",
          type: "system",
        });
        chat.lastMessage = "🔐 Deal Room Active";
        chat.lastMessageAt = new Date();
        await chat.save();
      }
    } catch (e) {
      console.warn("Could not post system message:", e.message);
    }
  }

  return dealRoom;
};

const declineDealRoomRequest = async (dealRoomId, user) => {
  const dealRoom = await DealRoom.findById(dealRoomId);
  if (!dealRoom) throw new ApiError(404, "Deal Room not found.");

  if (dealRoom.status !== "pending_acceptance") {
    throw new ApiError(400, "Deal Room request is not pending acceptance.");
  }

                                                                        
  if (!dealRoom.requestedTo || dealRoom.requestedTo.toString() !== user._id.toString()) {
    throw new ApiError(403, "Only the target investor can decline this Deal Room request.");
  }

  dealRoom.status = "declined";
  await dealRoom.save();

  if (dealRoom.requestedBy) {
    try {
      await notificationService.send(dealRoom.requestedBy, {
        type: "deal_room_declined",
        title: "Deal Room Request Declined",
        body: `Your Deal Room request was declined.`,
        data: { dealRoomId: dealRoom._id },
      });
    } catch (e) {
      console.warn("Could not send notification:", e.message);
    }
  }

  if (dealRoom.chatId) {
    try {
      const chat = await Chat.findById(dealRoom.chatId);
      if (chat) {
        await Message.create({
          chatId: chat._id,
          senderId: user._id,
          receiverId: dealRoom.requestedBy,
          message: "Deal Room request was declined.",
          messageType: "system",
          type: "system",
        });
        chat.lastMessage = "Deal Room Declined";
        chat.lastMessageAt = new Date();
        await chat.save();
      }
    } catch (e) {
      console.warn("Could not post system message:", e.message);
    }
  }

  return dealRoom;
};

const getDealRoomById = async (dealRoomId, userId) => {
  const dealRoom = await DealRoom.findById(dealRoomId)
    .populate("founderId", "name email companyName avatar isIdentityVerified isBusinessVerified verifiedBadge")
    .populate("investorId", "name email investorType avatar isIdentityVerified isOrganizationVerified isInvestorProfileVerified verifiedBadge")
    .populate("videoId", "title videoUrl thumbnailUrl")
    .populate("documents.uploadedBy", "name email role");

  if (!dealRoom) throw new ApiError(404, "Deal Room not found.");

                        
  const isParticipant =
    dealRoom.founderId?._id?.toString() === userId.toString() ||
    dealRoom.investorId?._id?.toString() === userId.toString() ||
    dealRoom.requestedBy?.toString() === userId.toString() ||
    dealRoom.requestedTo?.toString() === userId.toString();

  const user = await User.findById(userId);
  const isAdmin = user && user.role === "admin";

  if (!isParticipant && !isAdmin) {
    throw new ApiError(403, "Not authorized to access this Deal Room.");
  }

  return dealRoom;
};

const listUserDealRooms = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found.");

  let query = {};
  if (user.role === "admin") {
    query = {};
  } else if (user.role === "founder") {
    query = { $or: [{ founderId: userId }, { requestedBy: userId }] };
  } else {
    query = { $or: [{ investorId: userId }, { requestedTo: userId }] };
  }

  const rooms = await DealRoom.find(query)
    .populate("founderId", "name email companyName avatar isIdentityVerified isBusinessVerified")
    .populate("investorId", "name email investorType avatar isIdentityVerified isOrganizationVerified isInvestorProfileVerified")
    .sort({ updatedAt: -1 });

  return rooms;
};

const updateDealTerms = async (dealRoomId, userId, { fundingAmount, proposedValuation, equityPercentage }) => {
  const dealRoom = await getDealRoomById(dealRoomId, userId);

  if (fundingAmount !== undefined) dealRoom.fundingAmount = Number(fundingAmount);
  if (proposedValuation !== undefined) dealRoom.proposedValuation = Number(proposedValuation);
  if (equityPercentage !== undefined) dealRoom.equityPercentage = Number(equityPercentage);

  await dealRoom.save();
  return dealRoom;
};

const updateDealStage = async (dealRoomId, userId, stage) => {
  const validStages = [
    "deal_agreed",
    "term_sheet",
    "legal_compliance_review",
    "investment_documentation",
    "payment_route",
    "share_issuance",
    "statutory_filings",
  ];

  if (!validStages.includes(stage)) {
    throw new ApiError(400, `Invalid stage. Must be one of: ${validStages.join(", ")}`);
  }

  const dealRoom = await getDealRoomById(dealRoomId, userId);
  dealRoom.stage = stage;
  await dealRoom.save();
  return dealRoom;
};

const addDocument = async (dealRoomId, userId, { category, name, url, notes }) => {
  if (!name || !url) throw new ApiError(400, "Document name and url are required.");

  const dealRoom = await getDealRoomById(dealRoomId, userId);
  dealRoom.documents.push({
    category: category || "other",
    name: name.trim(),
    url,
    uploadedBy: userId,
    uploadedAt: new Date(),
    status: "under_review",
    notes: notes || "",
  });

  await dealRoom.save();
  return dealRoom;
};

const updateChecklistItem = async (dealRoomId, userId, { key, status, comments }) => {
  const dealRoom = await getDealRoomById(dealRoomId, userId);
  const item = dealRoom.checklist.find((i) => i.key === key);

  if (!item) {
    throw new ApiError(404, `Checklist item '${key}' not found.`);
  }

  if (status && ["pending", "passed", "flagged"].includes(status)) {
    item.status = status;
  }
  if (comments !== undefined) {
    item.comments = comments;
  }
  item.updatedAt = new Date();

  await dealRoom.save();
  return dealRoom;
};

const updateProfessionalReview = async (dealRoomId, reviewerUser, { reviewerType, status, notes }) => {
  const dealRoom = await DealRoom.findById(dealRoomId);
  if (!dealRoom) throw new ApiError(404, "Deal Room not found.");

  if (!reviewerType || !["ca_cs", "lawyer"].includes(reviewerType)) {
    throw new ApiError(400, "reviewerType must be 'ca_cs' or 'lawyer'");
  }

  if (reviewerType === "ca_cs") {
    dealRoom.reviewStatus.caCsStatus = status || "under_review";
    dealRoom.reviewStatus.caCsNotes = notes || "";
    dealRoom.reviewStatus.caCsReviewedBy = reviewerUser._id;
    dealRoom.reviewStatus.caCsReviewedAt = new Date();
  } else {
    dealRoom.reviewStatus.lawyerStatus = status || "under_review";
    dealRoom.reviewStatus.lawyerNotes = notes || "";
    dealRoom.reviewStatus.lawyerReviewedBy = reviewerUser._id;
    dealRoom.reviewStatus.lawyerReviewedAt = new Date();
  }

  await dealRoom.save();
  return dealRoom;
};

module.exports = {
  createDealRoom,
  acceptDealRoomRequest,
  declineDealRoomRequest,
  getDealRoomById,
  listUserDealRooms,
  updateDealTerms,
  updateDealStage,
  addDocument,
  updateChecklistItem,
  updateProfessionalReview,
};
