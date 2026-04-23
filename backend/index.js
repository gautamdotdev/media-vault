import express from "express";
import "./src/config/config.js";
import app from "./src/app.js";
import { connectDatabase } from "./src/config/db.js";
import { env } from "./src/config/config.js";



const startServer = async () => {
  try {
    // In local development, we connect to DB and start the listener.
    // In Vercel, the app is exported and Vercel handles the execution, 
    // but we still want to ensure DB is connected.
    
    if (process.env.VERCEL !== "1") {
      await connectDatabase();
      const port = env.port || 5000;
      app.listen(port, () => {
        console.log(`\x1b[32m[Server]\x1b[0m Media Vault backend running on http://localhost:${port}`);
      });
    } else {
      // Vercel environment: connection is handled by the app/middleware
      console.log("Running in Vercel environment");
    }
  } catch (err) {
    console.error("\x1b[31m[Critical]\x1b[0m Failed to start server:", err);
    if (process.env.VERCEL !== "1") {
      process.exit(1);
    }
  }
};

startServer();

// Export for Vercel
export default app;

