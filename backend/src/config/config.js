import dotenv from "dotenv";
import path from "path";

dotenv.config();

/* Configuration - centralizes environment variables and app settings. */

export const config = {
  port: process.env.PORT || 3001,
  uploadsDir: process.env.UPLOAD_DIR || "./uploads",
  corsOptions: {
    origin: "*",
    methods: ["GET", "POST"],
    exposedHeaders: ["Content-Disposition"],
  },
};

export const metadataPath = path.join(config.uploadsDir, "metadata.json");
