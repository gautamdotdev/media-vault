export const errorMiddleware = (err, req, res, next) => {
  // Detect Cloudinary SDK errors — they carry `http_code` instead of `statusCode`
  let statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  if (err.statusCode) statusCode = err.statusCode;
  if (err.http_code) statusCode = err.http_code;

  // Build user-friendly messages for known upstream errors
  let message = err.message || "Internal Server Error";
  if (statusCode === 413 || (message && message.includes("413"))) {
    statusCode = 413;
    message =
      "File too large — Cloudinary rejected the upload. Please use a smaller file.";
  }

  console.error(`[Error] ${req.method} ${req.url}:`, {
    message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};
