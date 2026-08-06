const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/ApiError");

const TMP_DIR = path.join(process.cwd(), "tmp", "uploads");
fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const imageFilter = (req, file, cb) => {
  if (/^image\/(jpeg|png|jpg|webp)$/.test(file.mimetype)) cb(null, true);
  else cb(new ApiError(400, "Only JPEG/PNG/WEBP images allowed"));
};

const videoFilter = (req, file, cb) => {
  if (/^video\/(mp4|quicktime|webm|x-matroska)$/.test(file.mimetype))
    cb(null, true);
  else cb(new ApiError(400, "Only MP4/MOV/WEBM videos allowed"));
};

const documentFilter = (req, file, cb) => {
  if (/^(image\/(jpeg|png|jpg|webp)|application\/pdf)$/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, "Only image or PDF documents allowed"));
  }
};

const chatAttachmentFilter = (req, file, cb) => {
  if (
    /^image\//.test(file.mimetype) ||
    /^video\//.test(file.mimetype) ||
    /^audio\//.test(file.mimetype) ||
    /^text\//.test(file.mimetype) ||
    /^(application\/pdf|application\/msword|application\/vnd\.|application\/zip|application\/x-zip-compressed)/.test(
      file.mimetype
    )
  ) {
    cb(null, true);
  } else {
    cb(new ApiError(400, "Unsupported file format for chat attachment"));
  }
};

const courseMediaFilter = (req, file, cb) => {
  if (file.fieldname === "thumbnail") {
    if (/^image\/(jpeg|png|jpg|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, "Thumbnail must be a JPEG, PNG, or WEBP image"));
  } else if (file.fieldname === "previewVideo" || file.fieldname === "video") {
    if (/^video\/(mp4|quicktime|webm|x-matroska)$/.test(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, "Video must be an MP4, MOV, or WEBM file"));
  } else if (file.fieldname === "document") {
    if (
      /^(image\/(jpeg|png|jpg|webp)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/.test(
        file.mimetype
      )
    ) {
      cb(null, true);
    } else {
      cb(new ApiError(400, "Document must be a PDF, DOC, DOCX, or Image"));
    }
  } else {
    cb(null, true);
  }
};

const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadChatAttachment = multer({
  storage,
  fileFilter: chatAttachmentFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const uploadCourseMedia = multer({
  storage,
  fileFilter: courseMediaFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

module.exports = {
  uploadImage,
  uploadVideo,
  uploadDocument,
  uploadChatAttachment,
  uploadCourseMedia,
  TMP_DIR,
};
