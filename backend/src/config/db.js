import mongoose from "mongoose";
import { env } from "./env.js";

// Disable command buffering for serverless environments. 
// This prevents Mongoose from queuing queries while the connection is not ready,
// which often leads to "buffering timed out" errors in Vercel.
mongoose.set("bufferCommands", false);

let cachedConnection = null;

export const connectDatabase = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  try {
    console.log("Connecting to MongoDB...");
    // If there's an existing connection promise, wait for it
    if (!cachedConnection) {
      cachedConnection = mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
    }

    await cachedConnection;
    console.log("MongoDB Connected successfully");
    return cachedConnection;
  } catch (error) {
    cachedConnection = null;
    console.error("MongoDB Connection Error:", error);
    throw error;
  }
};
