const ApiError = require("../utils/ApiError");

// 404 handler — runs when no route matches
const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

// Global error handler — runs for any error passed to next()
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = err.errors || [];

  // Mongoose — bad ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    const fieldName = err.path === "_id" ? "ID" : err.path;
    message = `Invalid ${fieldName}: ${err.value}`;
  }

  // Mongoose — validation
  if (err.name === "ValidationError") {
    statusCode = 400;
    errors = Object.values(err.errors).map((e) => e.message);
    message = "Validation failed";
  }

  // Mongoose — duplicate key (unique fields)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  if (process.env.NODE_ENV !== "production" && err.name !== "TokenExpiredError" && err.name !== "JsonWebTokenError") {
    console.error("❌ Error:", err);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
