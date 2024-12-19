import PropTypes from "prop-types";
import { formatFileSize, formatDate } from "../../utils/formatters";
import { getDownloadUrl } from "../../services/api";
import styles from "../../styles/components/FileList.module.css";
import buttonStyles from "../../styles/shared/buttons.module.css";

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
    <div className={styles.fileList}>
      <h2>Uploaded files</h2>
      <div className={styles.files}>
        {sortedFiles
          .filter((file) => file && file.fileId)
          .map((file) => (
            <div key={file.fileId} className={styles.fileItem}>
              <div className={styles.fileIcon}>📄</div>
              <div className={styles.fileDetails}>
                <div className={styles.fileName}>
                  {file.originalName || "Unknown file"}
                </div>
                <div className={styles.fileInfo}>
                  <span className={styles.fileSize}>
                    {formatFileSize(file.size)}
                  </span>
                  <span className={styles.uploadDate}>
                    {formatDate(file.uploadDate)}
                  </span>
                </div>
              </div>
              <div className={styles.fileActions}>
                <button
                  className={buttonStyles.shareButton}
                  onClick={() => handleCopyLink(file.fileId)}
                  title="Copy download link"
                >
                  Copy link
                </button>
                <button
                  className={buttonStyles.shareButton}
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
    }),
  ).isRequired,
};
