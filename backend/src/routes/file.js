import { Router } from "express";
import path from "path";
import { fileService } from "../services/file.js";
import { metadataService } from "../services/metadata.js";
import { upload } from "../middleware/upload.js";
import { config } from "../config/config.js";

/* File routes - defines API endpoints for file operations. */

const router = Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.file;
    const fileId = file.filename;
    const uploadDate = new Date().toISOString();

    const fileInfo = {
      fileId,
      filename: fileId,
      originalName: file.originalname,
      size: file.size,
      uploadDate,
    };

    fileService.registerFile(fileInfo);
    metadataService.setMetadata(fileId, {
      originalName: file.originalname,
      uploadDate,
    });
    await metadataService.saveMetadata();

    res.json(fileInfo);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

router.get("/files", (req, res) => {
  res.json(fileService.getAllFiles());
});

router.get("/download/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const fileInfo = fileService.getFileInfo(fileId);

  if (!fileInfo) {
    return res.status(404).json({ error: "File not found in registry" });
  }

  try {
    const filePath = path.join(config.uploadsDir, fileInfo.filename);
    return res.download(filePath, fileInfo.originalName);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({
      error: "Failed to download file",
      details: error.message,
    });
  }
});

export default router;
