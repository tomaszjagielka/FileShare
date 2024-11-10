import PropTypes from 'prop-types'
import { useState } from 'react'

function FileList({ files }) {
  const [shareLinks, setShareLinks] = useState({})

  if (!files || files.length === 0) {
    return null
  }

  const sortedFiles = [...files].sort((a, b) => {
    const dateA = a.uploadDate ? new Date(a.uploadDate) : new Date(0)
    const dateB = b.uploadDate ? new Date(b.uploadDate) : new Date(0)
    return dateB - dateA
  })

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      console.error('Error formatting date:', error)
      return dateString
    }
  }

  const formatServerUrl = (url) => {
    if (!url) return 'Unknown server'
    try {
      // Handle URLs that might be missing protocol
      const fullUrl = url.startsWith('http') ? url : `http://${url}`
      const urlObj = new URL(fullUrl)
      return `${urlObj.hostname}:${urlObj.port}`
    } catch (error) {
      console.error('Error formatting server URL:', error)
      return url // Return original if parsing fails
    }
  }

  const formatServerInfo = (file) => {
    if (!file) return 'Unknown server'
    return file.serverName || 'Unknown server'
  }

  const handleCopyLink = (fileId) => {
    if (!fileId) return
    const shareLink = `${process.env.SERVER_URL}/download/${fileId}`
    navigator.clipboard.writeText(shareLink)
      .then(() => alert('Link copied to clipboard!'))
      .catch(err => console.error('Failed to copy:', err))
  }

  const handleDownload = (fileId, originalName) => {
    if (!fileId) return
    const downloadUrl = `${process.env.SERVER_URL}/download/${fileId}`
    // Create a temporary link element and trigger the download
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = originalName // This will suggest the original filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="file-list">
      <h2>Uploaded files</h2>
      <div className="files">
        {sortedFiles.filter(file => file && file.fileId).map((file) => (
          <div key={file.fileId} className="file-item">
            <div className="file-icon">📄</div>
            <div className="file-details">
              <div className="file-name">{file.originalName || 'Unknown file'}</div>
              <div className="file-info">
                <span className="file-size">{formatFileSize(file.size)}</span>
                <span className="upload-date">{formatDate(file.uploadDate)}</span>
                <span className="server-info">Server: {formatServerInfo(file)}</span>
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
  )
}

FileList.propTypes = {
  files: PropTypes.arrayOf(PropTypes.shape({
    fileId: PropTypes.string.isRequired,
    originalName: PropTypes.string.isRequired,
    size: PropTypes.number.isRequired,
    uploadDate: PropTypes.string
  })).isRequired
}

export default FileList 