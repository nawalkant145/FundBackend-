const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const chatService = require("./chat.service");
const {
  uploadImageToCloudinary,
  uploadDocumentToCloudinary,
} = require("../../utils/cloudinaryUpload");

const startChat = asyncHandler(async (req, res) => {
  const targetId =
    req.body?.founderId ||
    req.body?.userId ||
    req.body?.targetId ||
    req.body?.recipientId ||
    req.body?.id ||
    req.params?.targetId ||
    req.params?.founderId ||
    req.params?.userId ||
    req.query?.founderId ||
    req.query?.userId ||
    req.query?.targetId;

  if (!targetId) throw new ApiError(400, "Target founder or user ID is required");
  try {
    const chat = await chatService.startChat(req.user._id, targetId);
    res.json(new ApiResponse(200, { chat }, "Chat ready"));
  } catch (error) {
    console.error("=== START CHAT ERROR ===");
    console.error(
      `User (initiator): ${req.user?._id} (${req.user?.name}, Role: ${req.user?.role}, VerificationLevel: ${req.user?.verificationLevel})`,
    );
    console.error(`Target Identifier: ${targetId}`);
    console.error(`Error status: ${error.statusCode || 500}`);
    console.error(`Error message: ${error.message}`);
    console.error("========================");
    throw error;
  }
});

const listChats = asyncHandler(async (req, res) => {
  const chats = await chatService.listChats(req.user._id);
  res.json(new ApiResponse(200, { chats }, "Chats fetched"));
});

const getMessages = asyncHandler(async (req, res) => {
  const result = await chatService.getMessages(
    req.params.chatId,
    req.user._id,
    {
      cursor: req.query.cursor,
      limit: req.query.limit,
    },
  );
  res.json(new ApiResponse(200, result, "Messages fetched"));
});

const sendMessage = asyncHandler(async (req, res) => {
  const { text, type, fileUrl } = req.body;
  const result = await chatService.sendMessage({
    chatId: req.params.chatId,
    senderId: req.user._id,
    text,
    type,
    fileUrl,
  });
  res.status(201).json(new ApiResponse(201, result, "Message sent"));
});

const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "File required");
  const isImage = /^image\//.test(req.file.mimetype);
  const result = isImage
    ? await uploadImageToCloudinary(req.file.path, "chat-images")
    : await uploadDocumentToCloudinary(req.file.path, "chat-files");
  res.status(201).json(
    new ApiResponse(
      201,
      {
        fileUrl: result.url,
        type: isImage ? "image" : "file",
      },
      "File uploaded",
    ),
  );
});

const markRead = asyncHandler(async (req, res) => {
  const result = await chatService.markRead(req.params.chatId, req.user._id);
  res.json(new ApiResponse(200, result, "Marked read"));
});

const deleteChat = asyncHandler(async (req, res) => {
  const result = await chatService.deleteChat(req.params.chatId, req.user._id);
  res.json(new ApiResponse(200, result, "Chat deleted"));
});

const totalUnreadCount = asyncHandler(async (req, res) => {
  const chats = await chatService.listChats(req.user._id);
  const total = chats.reduce((sum, ch) => {
    const isFounder = ch.founderId?._id?.toString() === req.user._id.toString();
    return sum + (isFounder ? ch.unreadCount.founder : ch.unreadCount.investor);
  }, 0);
  res.json(new ApiResponse(200, { total }, "Total unread"));
});

module.exports = {
  startChat,
  listChats,
  getMessages,
  sendMessage,
  uploadAttachment,
  markRead,
  deleteChat,
  totalUnreadCount,
};
