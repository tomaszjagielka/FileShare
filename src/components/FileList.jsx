import PropTypes from "prop-types";

function FileList({ files }) {
  const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

  if (!files || files.length === 0) {
    return null;
  }

  const sortedFiles = [...files].sort((a, b) => {
    const dateA = a.uploadDate ? new Date(a.uploadDate) : new Date(0);
    const dateB = b.uploadDate ? new Date(b.uploadDate) : new Date(0);
    return dateB - dateA;
  });

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  const handleCopyLink = (fileId) => {
    if (!fileId) return;
    const shareLink = `${serverUrl}/download/${fileId}`;
    navigator.clipboard
      .writeText(shareLink)
      .then(() => alert("Link copied to clipboard!"))
      .catch((err) => console.error("Failed to copy:", err));
  };

  const handleDownload = (fileId) => {
    if (!fileId) return;
    const downloadUrl = `${serverUrl}/download/${fileId}`;
    window.location.href = downloadUrl;
  };

  return (
    <div className="file-list">
      <h2>Uploaded files</h2>
      <div className="files">
        {sortedFiles
          .filter((file) => file && file.fileId)
          .map((file) => (
            <div key={file.fileId} className="file-item">
              <div className="file-icon">📄</div>
              <div className="file-details">
                <div className="file-name">
                  {file.originalName || "Unknown file"}
                </div>
                <div className="file-info">
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  <span className="upload-date">
                    {formatDate(file.uploadDate)}
                  </span>
                </div>
              </div>
              <div className="file-actions">
                <button
                  className="action-button copy-button"
                  onClick={() => handleCopyLink(file.fileId)}
                  title="Copy download link"
                >
                  Copy link
                </button>
                <button
                  className="action-button download-button"
                  onClick={() => handleDownload(file.fileId, file.originalName)}
                  title="Download file"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

FileList.propTypes = {
  files: PropTypes.arrayOf(
    PropTypes.shape({
      fileId: PropTypes.string,
      originalName: PropTypes.string,
      size: PropTypes.number,
      uploadDate: PropTypes.string,
    })
  ).isRequired,
};

export default FileList;
