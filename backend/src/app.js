import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { fileService } from "./services/file.js";
import { metadataService } from "./services/metadata.js";
import { config } from "./config/config.js";
import fileRoutes from "./routes/file.js";

const initializeApp = async () => {
  try {
    await fs.access(config.uploadsDir);
  } catch {
    await fs.mkdir(config.uploadsDir, { recursive: true });
  }

  const app = express();

  app.use(cors(config.corsOptions));
  app.use(express.json());

  await metadataService.loadMetadata();
  await fileService.scanExistingFiles(metadataService.getMetadata());

  app.use("/", fileRoutes);

  app.listen(config.port, () => {
    console.log(`Server running at http://localhost:${config.port}`);
  });
};

initializeApp().catch(console.error);
