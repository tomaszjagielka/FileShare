import { useState, useCallback } from "react";
import PropTypes from "prop-types";

export function FileUpload({ onUpload, serverUrl }) {
  const [isDragging, setIsDragging] = useState(false);
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

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = [...e.dataTransfer.files];
      if (files && files.length > 0) {
        uploadFile(files);
      }
    },
    [uploadFile]
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
    <div className="upload-container">
      <div
        className={`drop-zone ${isDragging ? "dragging" : ""}`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📁</div>
        <p>{isUploading ? "Uploading..." : "Drag and drop files here or"}</p>
        <label className="file-input-label">
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="file-input"
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
