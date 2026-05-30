const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const callService = require("./call.service");

const initiate = asyncHandler(async (req, res) => {
  const { receiverId, type } = req.body;
  const result = await callService.initiateCall(req.user._id, {
    receiverId,
    type,
  });
  res.status(201).json(new ApiResponse(201, result, "Call initiated"));
});

const accept = asyncHandler(async (req, res) => {
  const result = await callService.accept(req.params.callId, req.user._id);
  res.status(200).json(new ApiResponse(200, result, "Call accepted"));
});

const decline = asyncHandler(async (req, res) => {
  const call = await callService.decline(req.params.callId, req.user._id);
  res.status(200).json(new ApiResponse(200, { call }, "Call declined"));
});

const end = asyncHandler(async (req, res) => {
  const call = await callService.end(req.params.callId, req.user._id);
  res.status(200).json(new ApiResponse(200, { call }, "Call ended"));
});

const history = asyncHandler(async (req, res) => {
  const result = await callService.history(req.user._id, {
    cursor: req.query.cursor,
    limit: req.query.limit,
  });
  res.status(200).json(new ApiResponse(200, result, "Call history"));
});

const getOne = asyncHandler(async (req, res) => {
  const call = await callService.getById(req.params.callId, req.user._id);
  res.status(200).json(new ApiResponse(200, { call }, "Call"));
});

const iceServers = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { iceServers: callService.ICE_SERVERS() },
        "ICE servers",
      ),
    );
});

module.exports = {
  initiate,
  accept,
  decline,
  end,
  history,
  getOne,
  iceServers,
};
