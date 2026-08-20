const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const dealRoomService = require("./dealRoom.service");
const { uploadDocumentToCloudinary } = require("../../utils/cloudinaryUpload");

const createDealRoom = asyncHandler(async (req, res) => {
  const dealRoom = await dealRoomService.createDealRoom(req.user, req.body);
  res.status(201).json(new ApiResponse(201, { dealRoom }, "Deal Room initialized successfully"));
});

const getDealRoom = asyncHandler(async (req, res) => {
  const dealRoom = await dealRoomService.getDealRoomById(req.params.id, req.user._id);
  res.status(200).json(new ApiResponse(200, { dealRoom }, "Deal Room details retrieved"));
});

const listDealRooms = asyncHandler(async (req, res) => {
  const dealRooms = await dealRoomService.listUserDealRooms(req.user._id);
  res.status(200).json(new ApiResponse(200, { dealRooms }, "User Deal Rooms retrieved"));
});

const updateTerms = asyncHandler(async (req, res) => {
  const dealRoom = await dealRoomService.updateDealTerms(req.params.id, req.user._id, req.body);
  res.status(200).json(new ApiResponse(200, { dealRoom }, "Deal terms updated"));
});

const updateStage = asyncHandler(async (req, res) => {
  const { stage } = req.body;
  if (!stage) throw new ApiError(400, "Stage is required");
  const dealRoom = await dealRoomService.updateDealStage(req.params.id, req.user._id, stage);
  res.status(200).json(new ApiResponse(200, { dealRoom }, `Deal stage updated to ${stage}`));
});

const uploadDocument = asyncHandler(async (req, res) => {
  let url = req.body.url;
  const name = req.body.name || req.file?.originalname || "Uploaded Document";
  const category = req.body.category || "other";
  const notes = req.body.notes || "";

  if (req.file) {
    const uploadRes = await uploadDocumentToCloudinary(req.file.path, "deal-room-docs");
    url = uploadRes.url;
  }

  if (!url) throw new ApiError(400, "Document URL or file is required");

  const dealRoom = await dealRoomService.addDocument(req.params.id, req.user._id, {
    category,
    name,
    url,
    notes,
  });

  res.status(201).json(new ApiResponse(201, { dealRoom }, "Document added to Deal Room"));
});

const updateChecklist = asyncHandler(async (req, res) => {
  const { key, status, comments } = req.body;
  if (!key) throw new ApiError(400, "Checklist item key is required");

  const dealRoom = await dealRoomService.updateChecklistItem(req.params.id, req.user._id, {
    key,
    status,
    comments,
  });

  res.status(200).json(new ApiResponse(200, { dealRoom }, "Checklist item updated"));
});

const updateReview = asyncHandler(async (req, res) => {
  const { reviewerType, status, notes } = req.body;
  const dealRoom = await dealRoomService.updateProfessionalReview(req.params.id, req.user, {
    reviewerType,
    status,
    notes,
  });

  res.status(200).json(new ApiResponse(200, { dealRoom }, "Professional compliance review updated"));
});

const acceptRequest = asyncHandler(async (req, res) => {
  const dealRoom = await dealRoomService.acceptDealRoomRequest(req.params.id, req.user);
  res.status(200).json(new ApiResponse(200, { dealRoom }, "Deal Room request accepted"));
});

const declineRequest = asyncHandler(async (req, res) => {
  const dealRoom = await dealRoomService.declineDealRoomRequest(req.params.id, req.user);
  res.status(200).json(new ApiResponse(200, { dealRoom }, "Deal Room request declined"));
});

module.exports = {
  createDealRoom,
  getDealRoom,
  listDealRooms,
  updateTerms,
  updateStage,
  uploadDocument,
  updateChecklist,
  updateReview,
  acceptRequest,
  declineRequest,
};
