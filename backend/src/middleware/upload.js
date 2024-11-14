import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/config.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadsDir);
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    cb(null, fileId);
  },
});

export const upload = multer({ storage });
