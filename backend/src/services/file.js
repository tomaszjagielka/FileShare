import fs from "fs/promises";
import path from "path";
import { config } from "../config/config.js";

class FileService {
  #fileRegistry = new Map();

  async scanExistingFiles(metadata) {
    try {
      const files = await fs.readdir(config.uploadsDir);

      for (const filename of files) {
        if (filename === ".gitkeep" || filename === "metadata.json") continue;

        const filePath = path.join(config.uploadsDir, filename);
        const stats = await fs.stat(filePath);
        const fileId = filename;
        const fileMetadata = metadata.get(fileId);

        if (!this.#fileRegistry.has(fileId)) {
          this.#fileRegistry.set(fileId, {
            fileId,
            filename: fileId,
            originalName: fileMetadata?.originalName || fileId,
            size: stats.size,
            uploadDate: fileMetadata?.uploadDate || stats.mtime.toISOString(),
          });
        }
      }
      console.log(`Scanned ${files.length} existing files`);
    } catch (error) {
      console.error("Error scanning existing files:", error);
      throw error;
    }
  }

  registerFile(fileInfo) {
    this.#fileRegistry.set(fileInfo.fileId, fileInfo);
  }

  getFileInfo(fileId) {
    return this.#fileRegistry.get(fileId);
  }

  getAllFiles() {
    return Array.from(this.#fileRegistry.values());
  }
}

export const fileService = new FileService();
