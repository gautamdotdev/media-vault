import { connectDatabase } from "../config/db.js";

export const dbMiddleware = async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (err) {
    console.error("Database connection error in middleware:", err);
    res.status(503).json({
      success: false,
      message: "Database connection failed. Please try again later.",
      code: "DB_CONNECTION_ERROR",
    });
  }
};
