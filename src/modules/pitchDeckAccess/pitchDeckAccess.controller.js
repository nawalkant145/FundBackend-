const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const service = require("./pitchDeckAccess.service");

const request = asyncHandler(async (req, res) => {
  const { founderId, message } = req.body;
  if (!founderId) throw new ApiError(400, "founderId required");
  const r = await service.request(req.user._id, founderId, message);
  res.status(201).json(new ApiResponse(201, { request: r }, "Request sent"));
});

const respond = asyncHandler(async (req, res) => {
  const r = await service.respond(
    req.params.id,
    req.user._id,
    !!req.body.approve,
  );
  res.json(new ApiResponse(200, { request: r }, "Response saved"));
});

const getDeck = asyncHandler(async (req, res) => {
  const r = await service.getDeck(req.user._id, req.params.founderId);
  res.json(new ApiResponse(200, r, "Pitch deck"));
});

const incoming = asyncHandler(async (req, res) => {
  const requests = await service.incoming(req.user._id);
  res.json(new ApiResponse(200, { requests }, "Incoming requests"));
});

const outgoing = asyncHandler(async (req, res) => {
  const requests = await service.outgoing(req.user._id);
  res.json(new ApiResponse(200, { requests }, "My requests"));
});

module.exports = { request, respond, getDeck, incoming, outgoing };
