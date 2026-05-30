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

module.exports = { uploadImage, uploadVideo, uploadDocument, TMP_DIR };
