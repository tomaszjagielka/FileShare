import PropTypes from "prop-types";
import { formatFileSize, formatDate } from "../../utils/formatters";
import { getDownloadUrl } from "../../services/api";

export const FileItem = ({ file }) => {
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getDownloadUrl(file.fileId));
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    window.location.href = getDownloadUrl(file.fileId);
  };

  return (
    <div className="file-item">
      <div className="file-icon">📄</div>
      <div className="file-details">
        <div className="file-name">{file.originalName || "Unknown file"}</div>
        <div className="file-info">
          <span className="file-size">{formatFileSize(file.size)}</span>
          <span className="upload-date">{formatDate(file.uploadDate)}</span>
        </div>
      </div>
      <div className="file-actions">
        <button
          className="action-button copy-button"
          onClick={handleCopyLink}
          title="Copy download link"
        >
          Copy link
        </button>
        <button
          className="action-button download-button"
          onClick={handleDownload}
          title="Download file"
        >
          Download
        </button>
      </div>
    </div>
  );
};

FileItem.propTypes = {
  file: PropTypes.shape({
    fileId: PropTypes.string.isRequired,
    originalName: PropTypes.string,
    size: PropTypes.number,
    uploadDate: PropTypes.string,
  }).isRequired,
};
