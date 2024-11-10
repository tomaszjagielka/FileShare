import { useState, useEffect } from 'react'
import FileUpload from './components/FileUpload'
import FileList from './components/FileList'
import ServerStatus from './components/ServerStatus'
import './App.css'

function App() {
  const [files, setFiles] = useState([])
  const [status, setStatus] = useState(null)
  const [selectedServer, setSelectedServer] = useState(process.env.SERVER_URL || 'http://localhost:3000')
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${serverUrl}/files`)
      const data = await response.json()
      setFiles(data)
    } catch (error) {
      console.error('Failed to fetch files:', error)
    }
  }

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${serverUrl}/status`)
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Failed to fetch status:', error)
    }
  }

  // Fetch files and status when component mounts
  useEffect(() => {
    fetchFiles()
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleFileUpload = (newFiles) => {
    setFiles(prev => [...prev, ...newFiles])
    fetchFiles() // Refresh the file list after upload
  }

  const handleServerChange = (newServer) => {
    setSelectedServer(newServer)
  }

  return (
    <div className="container">
      <header>
        <h1>File share hub</h1>
        <p className="subtitle">Simple, secure file sharing</p>
      </header>
      
      <main>
        <ServerStatus serverUrl={serverUrl} />
        <FileUpload 
          onUpload={handleFileUpload}
          serverUrl={serverUrl}
          connectedServers={status?.connectedServers || []}
          onServerChange={handleServerChange}
          status={status}
        />
        <FileList files={files} />
      </main>
    </div>
  )
}

export default App
