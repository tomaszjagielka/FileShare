import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

function ServerStatus({ serverUrl }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${serverUrl}/status`)
        const data = await response.json()
        setStatus(data)
        setError(null)
      } catch (err) {
        setError('Failed to fetch server status')
        console.error('Error fetching status:', err)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [serverUrl])

  if (error) {
    return <div className="server-status error">{error}</div>
  }

  if (!status) {
    return <div className="server-status loading">Loading server status...</div>
  }

  return (
    <div className="server-status">
      <h3>Server status</h3>
      <div className="status-info">
        <div className="status-item">
          <span className="status-label">Current server:</span>
          <span className="status-value">{status.serverName}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Connected servers:</span>
          <span className="status-value server-list">
            {status.connectedServers.length > 0 
              ? status.connectedServers.map(server => server.name).join(', ')
              : 'None'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Total files:</span>
          <span className="status-value">{status.totalFiles}</span>
        </div>
      </div>
    </div>
  )
}

ServerStatus.propTypes = {
  serverUrl: PropTypes.string.isRequired
}

export default ServerStatus 