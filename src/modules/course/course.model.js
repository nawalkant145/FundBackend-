const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    order: { type: Number, default: 1 },
    videoUrl: { type: String, default: "" },
    cloudinaryPublicId: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    thumbnailPublicId: { type: String, default: "" },
    duration: { type: Number, default: 0 },              
    isPreview: { type: Boolean, default: false },
    documentUrl: { type: String, default: "" },
    documentPublicId: { type: String, default: "" },
  },
  { timestamps: true }
);

const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 1 },
    lessons: [lessonSchema],
  },
  { timestamps: true }
);

const courseSchema = new mongoose.Schema(
  {
    founderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, trim: true },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    category: { type: String, default: "General", index: true },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "all-levels"],
      default: "all-levels",
    },
    price: { type: Number, default: 0, min: 0 },
    thumbnailUrl: { type: String, default: "" },
    thumbnailPublicId: { type: String, default: "" },
    previewVideoUrl: { type: String, default: "" },
    previewVideoPublicId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "published", "archived", "deleted"],
      default: "draft",
      index: true,
    },
    modules: [moduleSchema],
    enrollmentCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

courseSchema.index({ founderId: 1, status: 1 });
courseSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Course", courseSchema);
