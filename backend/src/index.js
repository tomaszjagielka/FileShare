import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import fs from "fs";

// Configure dotenv
dotenv.config();

// Ensure uploads directory exists
const uploadsDir = "./uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// Middleware setup
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(express.json());

// Simplify metadata to only store essential file info
const metadataPath = path.join(uploadsDir, "metadata.json");
const fileMetadata = new Map();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    cb(null, fileId);
  },
});

const upload = multer({ storage });

// Load metadata on startup
try {
  if (fs.existsSync(metadataPath)) {
    const data = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    for (const [key, value] of Object.entries(data)) {
      fileMetadata.set(key, value);
    }
  }
} catch (error) {
  console.error("Error loading metadata:", error);
}

// Save metadata helper
const saveMetadata = () => {
  try {
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(Object.fromEntries(fileMetadata))
    );
  } catch (error) {
    console.error("Error saving metadata:", error);
  }
};

const PORT = process.env.PORT || 3001;
const fileRegistry = new Map(); // fileId -> { fileId, filename, etc }

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  scanExistingFiles();
});

const scanExistingFiles = () => {
  try {
    const files = fs.readdirSync(uploadsDir);
    files.forEach((filename) => {
      if (filename === ".gitkeep" || filename === "metadata.json") return;

      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      const fileId = filename;
      const metadata = fileMetadata.get(fileId);

      if (!fileRegistry.has(fileId)) {
        fileRegistry.set(fileId, {
          fileId,
          filename: fileId,
          originalName: metadata?.originalName || fileId,
          size: stats.size,
          uploadDate: metadata?.uploadDate || stats.mtime.toISOString(),
        });
      }
    });
    console.log(`Scanned ${files.length} existing files`);
  } catch (error) {
    console.error("Error scanning existing files:", error);
  }
};

// Update upload handler to remove propagation
app.post("/upload", upload.single("file"), async (req, res) => {
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

    // Update local registry
    fileRegistry.set(fileId, fileInfo);

    // Save metadata
    fileMetadata.set(fileId, {
      originalName: file.originalname,
      uploadDate,
    });
    saveMetadata();

    res.json(fileInfo);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

// Simplify files endpoint to only return local files
app.get("/files", async (req, res) => {
  res.json(Array.from(fileRegistry.values()));
});

app.get("/download/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const fileInfo = fileRegistry.get(fileId);

  if (!fileInfo) {
    return res.status(404).json({ error: "File not found in registry" });
  }

  try {
    const filePath = path.join("./uploads", fileInfo.filename);
    return res.download(filePath, fileInfo.originalName);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({
      error: "Failed to download file",
      details: error.message,
    });
  }
});
