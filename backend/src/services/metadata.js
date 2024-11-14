import fs from "fs/promises";
import { metadataPath } from "../config/config.js";

class MetadataService {
  #metadata = new Map();

  async loadMetadata() {
    try {
      const data = await fs.readFile(metadataPath, "utf8");
      const parsedData = JSON.parse(data);
      this.#metadata = new Map(Object.entries(parsedData));
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Error loading metadata:", error);
      }
    }
  }

  async saveMetadata() {
    try {
      await fs.writeFile(
        metadataPath,
        JSON.stringify(Object.fromEntries(this.#metadata))
      );
    } catch (error) {
      console.error("Error saving metadata:", error);
      throw error;
    }
  }

  setMetadata(fileId, metadata) {
    this.#metadata.set(fileId, metadata);
  }

  getMetadata() {
    return this.#metadata;
  }
}

export const metadataService = new MetadataService();
