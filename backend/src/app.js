import cors from "cors";
import express from "express";
import { vaultRoutes } from "./routes/vaultRoutes.js";
import { dbMiddleware } from "./middleware/dbMiddleware.js";
import { errorMiddleware, notFound } from "./middleware/errorMiddleware.js";
import mongoose from "mongoose";

const app = express();

// Security and utility middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check (public)
app.get("/health", (_req, res) => {
  const dbStatus = mongoose.connection.readyState === 1;
  res.json({
    success: true,
    message: dbStatus ? "Media Vault backend is healthy" : "Backend is up, but DB is disconnected",
    dbStatus: dbStatus ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api", dbMiddleware); // Ensure DB connection for all API routes
app.use("/api", vaultRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorMiddleware);

export { app };
export default app;

