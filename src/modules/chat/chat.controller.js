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

const { getIO } = require("../../socket");

const sendMessage = asyncHandler(async (req, res) => {
  const { message, text, messageType, type, attachment, fileUrl, receiverId, replyTo } = req.body;
  const result = await chatService.sendMessage({
    chatId: req.params.chatId,
    senderId: req.user._id,
    receiverId,
    message,
    text,
    messageType,
    type,
    attachment,
    fileUrl,
    replyTo,
  });

  try {
    const io = getIO();
    if (io && result?.message) {
      const chatIdStr = req.params.chatId.toString();
      io.to(chatIdStr).emit("new_message", result.message);
      io.to(chatIdStr).emit("receive_message", result.message);
    }
  } catch (e) {
    console.warn("Socket broadcast warning in sendMessage:", e.message);
  }

  res.status(201).json(new ApiResponse(201, result, "Message sent"));
});

const editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { message, text } = req.body;
  const updated = await chatService.editMessage(messageId, req.user._id, message || text || "");
  res.json(new ApiResponse(200, { message: updated }, "Message edited"));
});

const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { deleteForEveryone } = req.body;
  const updated = await chatService.deleteMessage(messageId, req.user._id, !!deleteForEveryone);
  res.json(new ApiResponse(200, { message: updated }, "Message deleted"));
});

const searchMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { query, limit } = req.query;
  const result = await chatService.searchMessages(chatId, req.user._id, { query, limit });
  res.json(new ApiResponse(200, result, "Messages found"));
});

const getChatMedia = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { mediaType, limit, cursor } = req.query;
  const result = await chatService.getChatMedia(chatId, req.user._id, { mediaType, limit, cursor });
  res.json(new ApiResponse(200, result, "Media gallery fetched"));
});

const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "File required");
  const isImage = /^image\//.test(req.file.mimetype);
  const isVideo = /^video\//.test(req.file.mimetype);
  const isAudio = /^audio\//.test(req.file.mimetype);

  const folder = isImage ? "chat-images" : isVideo ? "chat-videos" : isAudio ? "chat-audio" : "chat-files";
  const result = isImage
    ? await uploadImageToCloudinary(req.file.path, folder)
    : await uploadDocumentToCloudinary(req.file.path, folder);

  const determinedType = isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "document";

  res.status(201).json(
    new ApiResponse(
      201,
      {
        fileUrl: result.url,
        url: result.url,
        messageType: determinedType,
        type: determinedType,
        attachment: {
          url: result.url,
          name: req.file.originalname || "attachment",
          size: req.file.size || 0,
          mimeType: req.file.mimetype,
        },
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
  editMessage,
  deleteMessage,
  searchMessages,
  getChatMedia,
  uploadAttachment,
  markRead,
  deleteChat,
  totalUnreadCount,
};
