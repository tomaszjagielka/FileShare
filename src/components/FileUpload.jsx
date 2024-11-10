import { useState, useCallback } from 'react'
import PropTypes from 'prop-types'

function FileUpload({ onUpload, serverUrl, connectedServers, onServerChange, status }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedServer, setSelectedServer] = useState(serverUrl)

  const uploadFile = async (files) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      for (const file of files) {
        formData.append('file', file)
      }

      const response = await fetch(`${selectedServer}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      onUpload([data])
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleServerChange = (e) => {
    const newServer = e.target.value
    setSelectedServer(newServer)
    onServerChange(newServer)
  }

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragOut = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = [...e.dataTransfer.files]
    if (files && files.length > 0) {
      uploadFile(files)
    }
  }, [])

  const handleFileSelect = (e) => {
    const files = [...e.target.files]
    if (files && files.length > 0) {
      uploadFile(files)
    }
  }

  return (
    <div className="upload-container">
      <div className="server-selector">
        <label htmlFor="server-select">Upload to server: </label>
        <select 
          id="server-select" 
          value={selectedServer}
          onChange={handleServerChange}
          disabled={isUploading}
        >
          <option value={serverUrl}>
            This server ({status?.serverName || serverUrl})
          </option>
          {connectedServers.map(server => (
            <option key={server.url} value={server.url}>
              {server.name}
            </option>
          ))}
        </select>
      </div>
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📁</div>
        <p>{isUploading ? 'Uploading...' : 'Drag and drop files here or'}</p>
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
  )
}

FileUpload.propTypes = {
  onUpload: PropTypes.func.isRequired,
  serverUrl: PropTypes.string.isRequired,
  connectedServers: PropTypes.arrayOf(PropTypes.shape({
    url: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  })).isRequired,
  onServerChange: PropTypes.func.isRequired,
  status: PropTypes.object
}

export default FileUpload 