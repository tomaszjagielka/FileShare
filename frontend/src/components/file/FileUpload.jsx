import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import styles from "../../styles/components/FileUpload.module.css";

export function FileUpload({ onUpload, serverUrl }) {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(
    async (files) => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        for (const file of files) {
          formData.append("file", file);
        }

        const response = await fetch(`${serverUrl}/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        onUpload([data]);
      } catch (error) {
        console.error("Upload failed:", error);
      } finally {
        setIsUploading(false);
      }
    },
    [serverUrl, onUpload]
  );

  const handleFileSelect = useCallback(
    (e) => {
      const files = [...e.target.files];
      if (files && files.length > 0) {
        uploadFile(files);
      }
    },
    [uploadFile]
  );

  return (
    <div className={styles.uploadContainer}>
      <div className={styles.dropZone}>
        <div className={styles.uploadIcon}>📁</div>
        <p>{isUploading ? "Uploading..." : "Select files to upload"}</p>
        <label className={styles.fileInputLabel}>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className={styles.fileInput}
            disabled={isUploading}
          />
          Browse files
        </label>
      </div>
    </div>
  );
}

FileUpload.propTypes = {
  onUpload: PropTypes.func.isRequired,
  serverUrl: PropTypes.string.isRequired,
};
