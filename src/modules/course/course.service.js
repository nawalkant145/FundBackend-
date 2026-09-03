const Course = require("./course.model");
const Enrollment = require("../enrollment/enrollment.model");
const ApiError = require("../../utils/ApiError");
const {
  uploadImageToCloudinary,
  uploadVideoToCloudinary,
  uploadDocumentToCloudinary,
  deleteFromCloudinary,
} = require("../../utils/cloudinaryUpload");

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");

                                             
const createCourse = async (adminId, courseData, files = {}) => {
  const { title, description, category, level, price, tags, status } = courseData;

  if (!title || title.trim().length < 3) {
    throw new ApiError(400, "Course title is required (at least 3 characters)");
  }

  let thumbnailUrl = "";
  let thumbnailPublicId = "";
  let previewVideoUrl = "";
  let previewVideoPublicId = "";

  if (files.thumbnail && files.thumbnail[0]) {
    const uploadedThumb = await uploadImageToCloudinary(
      files.thumbnail[0].path,
      "course-thumbnails"
    );
    thumbnailUrl = uploadedThumb.url;
    thumbnailPublicId = uploadedThumb.publicId;
  }

  if (files.previewVideo && files.previewVideo[0]) {
    const uploadedVideo = await uploadVideoToCloudinary(
      files.previewVideo[0].path
    );
    previewVideoUrl = uploadedVideo.url;
    previewVideoPublicId = uploadedVideo.publicId;
  }

  let parsedTags = [];
  if (tags) {
    parsedTags = Array.isArray(tags)
      ? tags
      : tags.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const course = await Course.create({
    founderId: adminId,
    title: title.trim(),
    slug: `${slugify(title.trim())}-${Date.now().toString(36)}`,
    description: description || "",
    category: category || "General",
    level: level || "all-levels",
    price: price !== undefined ? Number(price) : 0,
    status: status || "published",
    tags: parsedTags,
    thumbnailUrl,
    thumbnailPublicId,
    previewVideoUrl,
    previewVideoPublicId,
    modules: [],
  });

  return course;
};

                                                 
const getAdminCourses = async (query = {}) => {
  const { status, limit = 50, page = 1 } = query;
  const filter = { status: { $ne: "deleted" } };

  if (status) {
    filter.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate("founderId", "name email avatar title companyName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Course.countDocuments(filter),
  ]);

  return {
    courses,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

                                               
const updateCourse = async (courseId, adminId, updateData, files = {}) => {
  const course = await Course.findOne({ _id: courseId, status: { $ne: "deleted" } });
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const allowedFields = [
    "title",
    "description",
    "category",
    "level",
    "price",
    "status",
    "tags",
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      if (field === "tags") {
        course.tags = Array.isArray(updateData.tags)
          ? updateData.tags
          : updateData.tags.split(",").map((t) => t.trim()).filter(Boolean);
      } else if (field === "price") {
        course.price = Number(updateData.price);
      } else if (field === "title") {
        course.title = updateData.title.trim();
        course.slug = `${slugify(updateData.title.trim())}-${Date.now().toString(36)}`;
      } else {
        course[field] = updateData[field];
      }
    }
  });

  if (files.thumbnail && files.thumbnail[0]) {
    if (course.thumbnailPublicId) {
      await deleteFromCloudinary(course.thumbnailPublicId, "image");
    }
    const uploadedThumb = await uploadImageToCloudinary(
      files.thumbnail[0].path,
      "course-thumbnails"
    );
    course.thumbnailUrl = uploadedThumb.url;
    course.thumbnailPublicId = uploadedThumb.publicId;
  }

  if (files.previewVideo && files.previewVideo[0]) {
    if (course.previewVideoPublicId) {
      await deleteFromCloudinary(course.previewVideoPublicId, "video");
    }
    const uploadedVideo = await uploadVideoToCloudinary(
      files.previewVideo[0].path
    );
    course.previewVideoUrl = uploadedVideo.url;
    course.previewVideoPublicId = uploadedVideo.publicId;
  }

  await course.save();
  return course;
};

                                       
const deleteCourse = async (courseId, adminId) => {
  const course = await Course.findOne({ _id: courseId, status: { $ne: "deleted" } });
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

                                   
  if (course.thumbnailPublicId) {
    await deleteFromCloudinary(course.thumbnailPublicId, "image");
  }
  if (course.previewVideoPublicId) {
    await deleteFromCloudinary(course.previewVideoPublicId, "video");
  }

                                     
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (lesson.cloudinaryPublicId) {
        await deleteFromCloudinary(lesson.cloudinaryPublicId, "video");
      }
      if (lesson.documentPublicId) {
        await deleteFromCloudinary(lesson.documentPublicId, "raw");
      }
    }
  }

  course.status = "deleted";
  course.deletedAt = new Date();
  await course.save();

  return { message: "Course deleted successfully" };
};

                                                                 
const addLesson = async (courseId, adminId, lessonData, files = {}) => {
  const course = await Course.findOne({ _id: courseId, status: { $ne: "deleted" } });
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const { title, description, moduleTitle, moduleIndex, isPreview, order } = lessonData;

  if (!title || title.trim().length === 0) {
    throw new ApiError(400, "Lesson title is required");
  }

  let videoUrl = "";
  let cloudinaryPublicId = "";
  let duration = 0;
  let documentUrl = "";
  let documentPublicId = "";
  let thumbnailUrl = "";
  let thumbnailPublicId = "";

  if (files.video && files.video[0]) {
    const uploadedVideo = await uploadVideoToCloudinary(files.video[0].path);
    videoUrl = uploadedVideo.url;
    cloudinaryPublicId = uploadedVideo.publicId;
    duration = uploadedVideo.duration || 0;
  }

  const thumbFile = (files.thumbnail && files.thumbnail[0]) || (files.lessonThumbnail && files.lessonThumbnail[0]);
  if (thumbFile) {
    const uploadedThumb = await uploadImageToCloudinary(
      thumbFile.path,
      "lesson-thumbnails"
    );
    thumbnailUrl = uploadedThumb.url;
    thumbnailPublicId = uploadedThumb.publicId;
  }

  if (files.document && files.document[0]) {
    const uploadedDoc = await uploadDocumentToCloudinary(
      files.document[0].path,
      "course-documents"
    );
    documentUrl = uploadedDoc.url;
    documentPublicId = uploadedDoc.publicId;
  }

  let modIdx = moduleIndex !== undefined ? Number(moduleIndex) : -1;
  let targetModule;

  if (modIdx >= 0 && course.modules[modIdx]) {
    targetModule = course.modules[modIdx];
  } else if (moduleTitle) {
    targetModule = course.modules.find(
      (m) => m.title.toLowerCase() === moduleTitle.trim().toLowerCase()
    );
    if (!targetModule) {
      course.modules.push({
        title: moduleTitle.trim(),
        order: course.modules.length + 1,
        lessons: [],
      });
      targetModule = course.modules[course.modules.length - 1];
    }
  } else {
    if (course.modules.length === 0) {
      course.modules.push({
        title: "Module 1: Getting Started",
        order: 1,
        lessons: [],
      });
    }
    targetModule = course.modules[0];
  }

  const newLesson = {
    title: title.trim(),
    description: description || "",
    order: order ? Number(order) : targetModule.lessons.length + 1,
    videoUrl,
    cloudinaryPublicId,
    thumbnailUrl,
    thumbnailPublicId,
    duration,
    isPreview: Boolean(isPreview === "true" || isPreview === true),
    documentUrl,
    documentPublicId,
  };

  targetModule.lessons.push(newLesson);
  await course.save();

  return course;
};

                                                   
const updateLesson = async (
  courseId,
  adminId,
  lessonId,
  updateData,
  files = {}
) => {
  const course = await Course.findOne({ _id: courseId, status: { $ne: "deleted" } });
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  let targetLesson;
  for (const mod of course.modules) {
    const found = mod.lessons.id(lessonId);
    if (found) {
      targetLesson = found;
      break;
    }
  }

  if (!targetLesson) {
    throw new ApiError(404, "Lesson not found in this course");
  }

  if (updateData.title) targetLesson.title = updateData.title.trim();
  if (updateData.description !== undefined)
    targetLesson.description = updateData.description;
  if (updateData.order !== undefined)
    targetLesson.order = Number(updateData.order);
  if (updateData.isPreview !== undefined)
    targetLesson.isPreview = Boolean(
      updateData.isPreview === "true" || updateData.isPreview === true
    );

  if (files.video && files.video[0]) {
    if (targetLesson.cloudinaryPublicId) {
      await deleteFromCloudinary(targetLesson.cloudinaryPublicId, "video");
    }
    const uploadedVideo = await uploadVideoToCloudinary(files.video[0].path);
    targetLesson.videoUrl = uploadedVideo.url;
    targetLesson.cloudinaryPublicId = uploadedVideo.publicId;
    targetLesson.duration = uploadedVideo.duration || 0;
  }

  const thumbFile = (files.thumbnail && files.thumbnail[0]) || (files.lessonThumbnail && files.lessonThumbnail[0]);
  if (thumbFile) {
    if (targetLesson.thumbnailPublicId) {
      await deleteFromCloudinary(targetLesson.thumbnailPublicId, "image");
    }
    const uploadedThumb = await uploadImageToCloudinary(
      thumbFile.path,
      "lesson-thumbnails"
    );
    targetLesson.thumbnailUrl = uploadedThumb.url;
    targetLesson.thumbnailPublicId = uploadedThumb.publicId;
  }

  if (files.document && files.document[0]) {
    if (targetLesson.documentPublicId) {
      await deleteFromCloudinary(targetLesson.documentPublicId, "raw");
    }
    const uploadedDoc = await uploadDocumentToCloudinary(
      files.document[0].path,
      "course-documents"
    );
    targetLesson.documentUrl = uploadedDoc.url;
    targetLesson.documentPublicId = uploadedDoc.publicId;
  }

  await course.save();
  return course;
};

                                                       
const deleteLesson = async (courseId, adminId, lessonId) => {
  const course = await Course.findOne({ _id: courseId, status: { $ne: "deleted" } });
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  let foundLesson = false;
  for (const mod of course.modules) {
    const lesson = mod.lessons.id(lessonId);
    if (lesson) {
      if (lesson.cloudinaryPublicId) {
        await deleteFromCloudinary(lesson.cloudinaryPublicId, "video");
      }
      if (lesson.thumbnailPublicId) {
        await deleteFromCloudinary(lesson.thumbnailPublicId, "image");
      }
      if (lesson.documentPublicId) {
        await deleteFromCloudinary(lesson.documentPublicId, "raw");
      }
      mod.lessons.pull(lessonId);
      foundLesson = true;
      break;
    }
  }

  if (!foundLesson) {
    throw new ApiError(404, "Lesson not found in this course");
  }

  await course.save();
  return course;
};

                                                      
const getPublishedCourses = async (query = {}) => {
  const { category, level, search, limit = 20, page = 1 } = query;
  const filter = { status: "published" };

  if (category) {
    filter.category = category;
  }

  if (level) {
    filter.level = level;
  }

  if (search) {
    filter.title = { $regex: search, $options: "i" };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate("founderId", "name email avatar title companyName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Course.countDocuments(filter),
  ]);

  return {
    courses,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

                                                                                     
const getCourseById = async (courseId, user = null) => {
  const course = await Course.findOne({
    _id: courseId,
    status: { $ne: "deleted" },
  }).populate("founderId", "name email avatar title companyName");

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const isAdmin = user && user.role === "admin";

                                                                    
  if (course.status !== "published" && !isAdmin) {
    throw new ApiError(403, "This course is not published yet");
  }

                                            
  let isEnrolled = false;
  if (user && (user.role === "founder" || user.role === "investor")) {
    const enrollment = await Enrollment.findOne({
      userId: user._id,
      courseId,
      status: "active",
    });
    if (enrollment) {
      isEnrolled = true;
    }
  }

  const courseObj = course.toObject();

                                                                   
  if (isAdmin || course.price === 0 || isEnrolled) {
    courseObj.isEnrolled = true;
    return courseObj;
  }

                                                                       
  courseObj.isEnrolled = false;
  if (courseObj.modules && Array.isArray(courseObj.modules)) {
    courseObj.modules = courseObj.modules.map((mod) => {
      if (mod.lessons && Array.isArray(mod.lessons)) {
        mod.lessons = mod.lessons.map((lesson) => {
          if (lesson.isPreview) {
            return { ...lesson, isLocked: false };
          }
          return {
            ...lesson,
            videoUrl: "",
            cloudinaryPublicId: "",
            documentUrl: "",
            documentPublicId: "",
            isLocked: true,
          };
        });
      }
      return mod;
    });
  }

  return courseObj;
};

module.exports = {
  createCourse,
  getAdminCourses,
  updateCourse,
  deleteCourse,
  addLesson,
  updateLesson,
  deleteLesson,
  getPublishedCourses,
  getCourseById,
};
