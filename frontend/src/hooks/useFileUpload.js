import { useState } from "react";
import * as api from "../services/api";

export const useFileUpload = (onSuccess) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const uploadFiles = async (files) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("file", file);
      });

      const data = await api.uploadFile(formData);
      onSuccess?.(data);
    } catch (error) {
      setUploadError(error.message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFiles, isUploading, uploadError };
};
