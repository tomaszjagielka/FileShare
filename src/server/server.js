import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { io as SocketClient } from 'socket.io-client'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import dotenv from 'dotenv'
import fs from 'fs'
import os from 'os'
import { networkInterfaces } from 'os'

// Configure dotenv
dotenv.config()

// Ensure uploads directory exists
const uploadsDir = './uploads'
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const app = express()
const httpServer = createServer(app)
const io = new SocketServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Middleware setup
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  exposedHeaders: ['Content-Disposition']
}))
app.use(express.json())

// Add metadata storage and path at the top with other constants
const metadataPath = path.join(uploadsDir, 'metadata.json')
const fileMetadata = new Map()

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const fileId = uuidv4()
    cb(null, fileId)
  }
})

const upload = multer({ storage })

// Load metadata on startup
try {
  if (fs.existsSync(metadataPath)) {
    const data = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
    for (const [key, value] of Object.entries(data)) {
      fileMetadata.set(key, value)
    }
  }
} catch (error) {
  console.error('Error loading metadata:', error)
}

// Save metadata helper
const saveMetadata = () => {
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(Object.fromEntries(fileMetadata)))
  } catch (error) {
    console.error('Error saving metadata:', error)
  }
}

// Server registry and file registry
const connectedServers = new Map() // serverUrl -> socket
const fileRegistry = new Map() // fileId -> { serverUrl, filename, size }
const MY_URL = cleanServerUrl(process.env.SERVER_URL || 'http://localhost:3001')

// Known server list (could be loaded from config or environment)
const knownServers = (process.env.KNOWN_SERVERS || '').split(',').filter(Boolean)

// Move PORT declaration to the top with other constants
const PORT = process.env.PORT || 3001

// Function to get MAC address
function getMacAddress() {
  const interfaces = networkInterfaces()
  for (const interfaceName of Object.keys(interfaces)) {
    const networkInterface = interfaces[interfaceName]
    if (!networkInterface) continue
    
    for (const interface_ of networkInterface) {
      if (!interface_.internal && interface_.family === 'IPv4') {
        return interface_.mac.replace(/:/g, '')
      }
    }
  }
  return 'unknown'
}

// Function to get username
function getUsername() {
  return process.env.USER || process.env.USERNAME || os.userInfo().username || 'unknown'
}

// Generate a unique server identifier
const macAddress = getMacAddress()
const username = getUsername()
const serverName = `${username}@${macAddress.slice(-6)}:${PORT}` // Use the PORT constant

// Connect to known servers
function connectToServer(serverUrl) {
  if (!serverUrl) return // Don't connect to empty URLs
  const cleanUrl = cleanServerUrl(serverUrl)
  if (cleanUrl === MY_URL) return // Don't connect to self
  
  // If we're already connected to this server, don't try to connect again
  if (connectedServers.has(cleanUrl)) {
    const existingConnection = connectedServers.get(cleanUrl)
    if (existingConnection.socket?.connected) {
      return existingConnection.socket
    }
  }
  
  console.log(`Attempting to connect to server: ${cleanUrl}`)
  const socket = SocketClient(cleanUrl, {
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: 5,
    timeout: 10000
  })

  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 5

  socket.on('connect', () => {
    console.log(`Connected to server: ${cleanUrl}`)
    reconnectAttempts = 0 // Reset attempts on successful connection
    socket.emit('register-server', {
      url: MY_URL,
      name: serverName
    })
  })

  socket.on('connect_error', (error) => {
    console.error(`Connection error to ${cleanUrl}:`, error.message)
    reconnectAttempts++
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`Max reconnection attempts reached for ${cleanUrl}, giving up`)
      socket.disconnect()
      connectedServers.delete(cleanUrl)
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(`Disconnected from server: ${cleanUrl}, reason: ${reason}`)
    // Only remove from connectedServers if we've exceeded max attempts
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      connectedServers.delete(cleanUrl)
    }
  })

  socket.on('file-registry', (files) => {
    // Update our registry with files from other server
    for (const [fileId, fileInfo] of Object.entries(files)) {
      if (!fileRegistry.has(fileId)) {
        fileRegistry.set(fileId, fileInfo)
        // Propagate to other servers except the one we got it from
        for (const [url, info] of connectedServers.entries()) {
          if (info.socket && info.socket.id !== socket.id) {
            info.socket.emit('file-available', fileInfo)
          }
        }
      }
    }
  })

  socket.on('file-available', (fileInfo) => {
    fileRegistry.set(fileInfo.fileId, fileInfo)
    // Propagate to other servers
    for (const [url, info] of connectedServers.entries()) {
      if (info.socket && info.socket.id !== socket.id) {
        info.socket.emit('file-available', fileInfo)
      }
    }
  })

  socket.on('request-file', async ({ fileId, requestId }) => {
    const fileInfo = fileRegistry.get(fileId)
    if (fileInfo) {
      try {
        // If we have the file locally, send it
        if (fileInfo.serverUrl === MY_URL) {
          const filePath = path.join('./uploads', fileInfo.filename)
          const fileData = await fs.promises.readFile(filePath)
          socket.emit('file-data', fileData, requestId)
        } 
        // If we know another server has it, proxy the request
        else {
          const sourceServer = connectedServers.get(fileInfo.serverUrl)
          if (sourceServer?.socket) {
            // Create a promise to wait for the response
            const fileData = await new Promise((resolve, reject) => {
              const handleData = (data, respId) => {
                if (respId === requestId) {
                  sourceServer.socket.off('file-data', handleData)
                  sourceServer.socket.off('file-error', handleError)
                  resolve(data)
                }
              }

              const handleError = (error, respId) => {
                if (respId === requestId) {
                  sourceServer.socket.off('file-data', handleData)
                  sourceServer.socket.off('file-error', handleError)
                  reject(error)
                }
              }

              sourceServer.socket.on('file-data', handleData)
              sourceServer.socket.on('file-error', handleError)
              sourceServer.socket.emit('request-file', { fileId, requestId })

              // Set timeout
              setTimeout(() => {
                sourceServer.socket.off('file-data', handleData)
                sourceServer.socket.off('file-error', handleError)
                reject(new Error('Request timed out'))
              }, 30000)
            })

            socket.emit('file-data', fileData, requestId)
          } else {
            socket.emit('file-error', { 
              error: 'Source server not available', 
              requestId 
            })
          }
        }
      } catch (error) {
        socket.emit('file-error', { 
          error: error.message || 'Failed to fetch file', 
          requestId 
        })
      }
    } else {
      socket.emit('file-error', { 
        error: 'File not found in registry', 
        requestId 
      })
    }
  })

  // Store the socket with the cleaned URL
  connectedServers.set(cleanUrl, {
    socket,
    name: undefined // Will be set when server registers
  })

  return socket
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New connection:', socket.id)

  socket.on('register-server', (serverInfo) => {
    const cleanUrl = cleanServerUrl(serverInfo.url)
    console.log(`Server registered: ${serverInfo.name} (${cleanUrl})`)
    
    // Update or create the server entry
    const existingServer = connectedServers.get(cleanUrl)
    if (existingServer) {
      existingServer.name = serverInfo.name
      existingServer.socket = socket // Update the socket reference
    } else {
      connectedServers.set(cleanUrl, {
        socket,
        name: serverInfo.name
      })
    }

    // Send back list of servers with their names
    const serverList = Array.from(connectedServers.entries())
      .filter(([_, info]) => info.socket?.connected)
      .map(([url, info]) => ({
        url,
        name: info.name
      }))
    
    socket.emit('known-servers', serverList)
    
    // Send our complete file registry to the new server
    socket.emit('file-registry', Object.fromEntries(fileRegistry))
  })

  socket.on('request-file', async ({ fileId, requestId }) => {
    console.log(`File request received for ${fileId} with requestId ${requestId}`)
    const fileInfo = fileRegistry.get(fileId)
    
    if (!fileInfo) {
      console.log(`File not found in registry: ${fileId}`)
      socket.emit('file-error', { 
        error: 'File not found in registry', 
        requestId 
      })
      return
    }

    try {
      // If we have the file locally, send it
      if (fileInfo.serverUrl === MY_URL) {
        console.log(`Serving local file: ${fileId}`)
        const filePath = path.join('./uploads', fileInfo.filename)
        const fileData = await fs.promises.readFile(filePath)
        socket.emit('file-data', fileData, requestId)
      } 
      // If we know another server has it, proxy the request
      else {
        console.log(`Proxying request for file ${fileId} to ${fileInfo.serverUrl}`)
        const sourceServer = connectedServers.get(fileInfo.serverUrl)
        if (!sourceServer?.socket?.connected) {
          console.error(`Source server not available or not connected: ${fileInfo.serverUrl}`)
          socket.emit('file-error', { 
            error: 'Source server not available', 
            requestId 
          })
          return
        }

        // Create a promise to wait for the response
        const fileData = await new Promise((resolve, reject) => {
          const cleanup = () => {
            sourceServer.socket.off('file-data', handleData)
            sourceServer.socket.off('file-error', handleError)
            clearTimeout(timeoutId)
          }

          const handleData = (data, respId) => {
            if (respId === requestId) {
              cleanup()
              resolve(data)
            }
          }

          const handleError = (error, respId) => {
            if (respId === requestId) {
              cleanup()
              reject(new Error(error.message || 'Failed to fetch file'))
            }
          }

          sourceServer.socket.on('file-data', handleData)
          sourceServer.socket.on('file-error', handleError)
          sourceServer.socket.emit('request-file', { fileId, requestId })

          const timeoutId = setTimeout(() => {
            cleanup()
            reject(new Error('Request timed out'))
          }, 30000)
        })

        socket.emit('file-data', fileData, requestId)
      }
    } catch (error) {
      console.error(`Error handling file request for ${fileId}:`, error)
      socket.emit('file-error', { 
        error: error.message || 'Failed to fetch file', 
        requestId 
      })
    }
  })

  socket.on('request-registry', () => {
    // Send our file registry to the requesting server
    socket.emit('file-registry', Object.fromEntries(fileRegistry))
  })

  socket.on('file-available', (fileInfo) => {
    fileRegistry.set(fileInfo.fileId, fileInfo)
    // Propagate to other servers
    for (const [url, info] of connectedServers.entries()) {
      if (info.socket && info.socket.id !== socket.id) {
        info.socket.emit('file-available', fileInfo)
      }
    }
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
    for (const [url, info] of connectedServers.entries()) {
      if (info.socket.id === socket.id) {
        console.log(`Server disconnected: ${info.name} (${url})`)
        connectedServers.delete(url)
        break
      }
    }
  })
})

// Connect to known servers on startup
knownServers.forEach(connectToServer)

// Update scanExistingFiles to properly use metadata and server name
const scanExistingFiles = () => {
  try {
    const files = fs.readdirSync(uploadsDir)
    files.forEach(filename => {
      if (filename === '.gitkeep' || filename === 'metadata.json') return
      
      const filePath = path.join(uploadsDir, filename)
      const stats = fs.statSync(filePath)
      const fileId = filename
      const metadata = fileMetadata.get(fileId)
      
      if (!fileRegistry.has(fileId)) {
        fileRegistry.set(fileId, {
          fileId,
          serverUrl: MY_URL,
          serverName: metadata?.serverName || serverName,
          filename: fileId,
          originalName: metadata?.originalName || fileId,
          size: stats.size,
          mimeType: metadata?.mimeType || 'application/octet-stream',
          uploadDate: metadata?.uploadDate || stats.mtime.toISOString()
        })
      }
    })
    console.log(`Scanned ${files.length} existing files`)
  } catch (error) {
    console.error('Error scanning existing files:', error)
  }
}

// Update upload handler with better error handling
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = req.file
    const fileId = file.filename
    const uploadDate = new Date().toISOString()

    // Create file info object with all required fields
    const fileInfo = {
      fileId: fileId,
      serverUrl: MY_URL,
      serverName: serverName,
      filename: fileId,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      uploadDate: uploadDate
    }

    // Store file metadata
    fileMetadata.set(fileId, {
      originalName: file.originalname,
      uploadDate: uploadDate,
      serverName: serverName,
      mimeType: file.mimetype
    })

    // Save metadata to file
    saveMetadata()

    // Register file in local registry
    fileRegistry.set(fileId, fileInfo)

    // Broadcast to other servers
    for (const [_, info] of connectedServers.entries()) {
      if (info.socket) {
        info.socket.emit('file-available', fileInfo)
      }
    }

    // Send response with all required fields
    res.json(fileInfo)
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ 
      error: 'File upload failed',
      details: error.message 
    })
  }
})

app.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params
  const fileInfo = fileRegistry.get(fileId)

  console.log('Download request for:', fileId)
  console.log('File info:', fileInfo)
  console.log('Connected servers:', Array.from(connectedServers.entries()).map(([url, info]) => ({
    url,
    name: info.name,
    connected: info.socket?.connected
  })))

  if (!fileInfo) {
    return res.status(404).json({ error: 'File not found in registry' })
  }

  try {
    // Clean the URLs before comparison
    const cleanFileServerUrl = cleanServerUrl(fileInfo.serverUrl)
    
    // If file is local, serve it directly
    if (cleanFileServerUrl === MY_URL) {
      const filePath = path.join('./uploads', fileInfo.filename)
      return res.download(filePath, fileInfo.originalName)
    }

    // Get the server that has the file
    const sourceServer = connectedServers.get(cleanFileServerUrl)
    if (!sourceServer?.socket?.connected) {
      console.error(`Source server not available or not connected: ${cleanFileServerUrl}`)
      console.debug('Connected servers:', Array.from(connectedServers.keys()))
      console.debug('Server connection status:', {
        hasServer: !!sourceServer,
        hasSocket: !!sourceServer?.socket,
        isConnected: sourceServer?.socket?.connected
      })
      return res.status(404).json({ error: 'Source server not available' })
    }

    // Generate a unique request ID
    const requestId = uuidv4()
    
    // Request file from the source server
    const fileData = await new Promise((resolve, reject) => {
      const cleanup = () => {
        sourceServer.socket.off('file-data', handleData)
        sourceServer.socket.off('file-error', handleError)
        clearTimeout(timeoutId)
      }

      const handleData = (data, respId) => {
        if (respId === requestId) {
          cleanup()
          resolve(data)
        }
      }

      const handleError = (error, respId) => {
        if (respId === requestId) {
          cleanup()
          reject(new Error(error.message || 'Failed to fetch file'))
        }
      }

      sourceServer.socket.on('file-data', handleData)
      sourceServer.socket.on('file-error', handleError)
      sourceServer.socket.emit('request-file', { fileId, requestId })

      const timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('Request timed out'))
      }, 30000)
    })

    // Send the file to the client
    res.set('Content-Type', fileInfo.mimeType)
    res.set('Content-Disposition', `attachment; filename="${fileInfo.originalName}"`)
    res.send(fileData)
  } catch (error) {
    console.error('Error downloading remote file:', error)
    res.status(500).json({ 
      error: 'Failed to download file', 
      details: error.message 
    })
  }
})

app.get('/files', (req, res) => {
  const files = Array.from(fileRegistry.values())
  res.json(files)
})

// Add a new endpoint to get server status
app.get('/status', (req, res) => {
  const status = {
    serverUrl: MY_URL,
    serverName: serverName,
    connectedServers: Array.from(connectedServers.entries())
      .filter(([_, info]) => info.socket?.connected) // Only include connected servers
      .map(([url, info]) => ({
        url,
        name: info.name || `${url} (Unknown)`
      })),
    totalFiles: fileRegistry.size
  }
  res.json(status)
})

// Change the listen call to use '0.0.0.0' instead of default localhost
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Server Name: ${serverName}`)
  console.log(`Server URL: ${MY_URL}`)
  console.log(`Known servers: ${knownServers.join(', ') || 'none'}`)
  
  // Scan existing files
  scanExistingFiles()
})

// Add this near the start of the file
setInterval(() => {
  console.log('Connected servers:', Array.from(connectedServers.entries()).map(([url, info]) => ({
    url,
    name: info.name,
    connected: info.socket?.connected
  })))
}, 10000) 