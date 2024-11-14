import PropTypes from "prop-types";
import { formatFileSize, formatDate } from "../../utils/formatters";
import { getDownloadUrl } from "../../services/api";

export function FileList({ files }) {
  if (!files || files.length === 0) {
    return null;
  }

  const sortedFiles = [...files].sort((a, b) => {
    const dateA = a.uploadDate ? new Date(a.uploadDate) : new Date(0);
    const dateB = b.uploadDate ? new Date(b.uploadDate) : new Date(0);
    return dateB - dateA;
  });

  const handleCopyLink = (fileId) => {
    if (!fileId) {
      return;
    }

    navigator.clipboard
      .writeText(getDownloadUrl(fileId))
      .then(() => alert("Link copied to clipboard!"))
      .catch((err) => console.error("Failed to copy:", err));
  };

  const handleDownload = (fileId) => {
    if (!fileId) {
      return;
    }

    window.location.href = getDownloadUrl(fileId);
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
                  onClick={() => handleDownload(file.fileId)}
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
