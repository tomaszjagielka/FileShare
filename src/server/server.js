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
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  allowUpgrades: true,
  cookie: false
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

// Move these declarations to the top, right after the imports
const PORT = process.env.PORT || 3001
const knownServers = (process.env.KNOWN_SERVERS || '').split(',').filter(Boolean)

// Function to get MAC address (keep this before serverName declaration)
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

// Function to get username (keep this before serverName declaration)
function getUsername() {
  return process.env.USER || process.env.USERNAME || os.userInfo().username || 'unknown'
}

// Generate server identifiers
const macAddress = getMacAddress()
const username = getUsername()
const serverName = `${username}@${macAddress.slice(-6)}:${PORT}`

// Replace connectedServers Map to use socket IDs instead of URLs
const connectedServers = new Map() // socketId -> { socket, name, files }
const fileRegistry = new Map() // fileId -> { fileId, serverName, filename, etc }

// Update connectToServer function to remove URL dependencies
function connectToServer(serverUrl) {
  if (!serverUrl) return
  
  console.log(`Attempting to connect to server: ${serverUrl}`)
  
  const socket = SocketClient(serverUrl, {
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: 5,
    timeout: 10000,
    transports: ['websocket', 'polling'],
    forceNew: true,
    secure: serverUrl.startsWith('https://'),
    rejectUnauthorized: false
  })

  socket.on('connect', () => {
    console.log(`Connected to server: ${serverUrl}`)
    
    // Send only our server name
    socket.emit('register-server', {
      name: serverName
    })

    // Then request their registry
    socket.emit('request-registry')
  })

  return socket
}

// Update the server startup log
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Server Name: ${serverName}`)
  console.log(`Known servers: ${knownServers.join(', ') || 'none'}`)
  
  // Scan existing files
  scanExistingFiles()
})

// Update scanExistingFiles to use only serverName
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New connection:', socket.id)

  socket.on('register-server', (serverInfo) => {
    console.log(`Server registered: ${serverInfo.name} (${socket.id})`)
    
    connectedServers.set(socket.id, {
      socket,
      name: serverInfo.name,
      files: new Set() // Track files available on this server
    })

    // Send our complete file registry to the new server
    console.log(`Sending file registry (${fileRegistry.size} files) to ${serverInfo.name}`)
    socket.emit('file-registry', Array.from(fileRegistry.values()))
  })

  socket.on('file-registry', (data) => {
    // Check if we received an array or an object with files property
    const files = Array.isArray(data) ? data : (data.files ? Object.values(data.files) : [])
    console.log(`Received file registry with ${files.length} files`)
    let newFiles = 0
    
    // Update our registry with new files
    for (const fileInfo of files) {
      if (!fileRegistry.has(fileInfo.fileId)) {
        console.log(`Adding new file to registry: ${fileInfo.fileId} from ${fileInfo.serverUrl}`)
        fileRegistry.set(fileInfo.fileId, fileInfo)
        newFiles++
      }
    }
    
    if (newFiles > 0) {
      console.log(`Added ${newFiles} new files to registry`)
    }
  })

  socket.on('file-available', (fileInfo) => {
    const serverInfo = connectedServers.get(socket.id)
    if (!serverInfo) return

    console.log(`Received file-available for ${fileInfo.fileId} from ${serverInfo.name}`)
    
    // Update file info to use server name instead of URL
    const updatedFileInfo = {
      ...fileInfo,
      serverName: serverInfo.name,
      sourceSocketId: socket.id // Store socket ID for file requests
    }

    if (!fileRegistry.has(fileInfo.fileId)) {
      fileRegistry.set(fileInfo.fileId, updatedFileInfo)
      serverInfo.files.add(fileInfo.fileId)
      
      // Propagate to other connected servers
      socket.broadcast.emit('file-available', updatedFileInfo)
    }
  })

  socket.on('request-file', async ({ fileId, requestId }) => {
    const fileInfo = fileRegistry.get(fileId)
    if (!fileInfo) {
      socket.emit('file-error', { error: 'File not found', requestId })
      return
    }

    try {
      // Check if we have the file locally
      if (fileInfo.sourceSocketId === undefined) { // Local file
        const filePath = path.join('./uploads', fileInfo.filename)
        const fileData = await fs.promises.readFile(filePath)
        socket.emit('file-data', fileData, requestId)
      } else {
        // Get the server that has the file
        const sourceServer = connectedServers.get(fileInfo.sourceSocketId)
        if (!sourceServer?.socket?.connected) {
          socket.emit('file-error', { error: 'Source server not available', requestId })
          return
        }

        // Forward the request
        sourceServer.socket.emit('request-file', { fileId, requestId })
      }
    } catch (error) {
      socket.emit('file-error', { error: error.message, requestId })
    }
  })

  socket.on('refresh-registry', ({ source, propagateId }) => {
    console.log(`Registry refresh requested by ${source}`)
    
    // Send our complete registry back - fix the format to match what the handler expects
    socket.emit('file-registry', Array.from(fileRegistry.values()))

    // Propagate refresh request to other servers
    for (const [url, info] of connectedServers.entries()) {
      if (info.socket?.connected && url !== source) {
        console.log(`Propagating registry refresh request to ${url}`)
        info.socket.emit('refresh-registry', {
          source: MY_URL,
          propagateId
        })
      }
    }
  })

  // Add disconnect handler
  socket.on('disconnect', () => {
    const serverInfo = connectedServers.get(socket.id)
    if (serverInfo) {
      console.log(`Server disconnected: ${serverInfo.name}`)
      // Remove files from registry that were from this server
      serverInfo.files.forEach(fileId => {
        fileRegistry.delete(fileId)
      })
      connectedServers.delete(socket.id)
    }
  })

  // Add handler for request-registry event
  socket.on('request-registry', () => {
    console.log(`Registry requested by ${socket.id}`)
    socket.emit('file-registry', Array.from(fileRegistry.values()))
  })
})

// Connect to known servers on startup
knownServers.forEach(connectToServer)

// Update upload handler to just notify connected servers
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = req.file
    const fileId = file.filename
    const uploadDate = new Date().toISOString()

    const fileInfo = {
      fileId,
      serverName, // Use our server name
      filename: fileId,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      uploadDate
    }

    fileRegistry.set(fileId, fileInfo)
    
    // Notify all connected servers
    io.emit('file-available', fileInfo)

    res.json(fileInfo)
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Upload failed', details: error.message })
  }
})

app.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params
  const fileInfo = fileRegistry.get(fileId)

  console.log('Download request for:', fileId)
  console.log('File info:', fileInfo)

  if (!fileInfo) {
    return res.status(404).json({ error: 'File not found in registry' })
  }

  try {
    const cleanFileServerUrl = cleanServerUrl(fileInfo.serverUrl)
    
    // If file is local, serve it directly
    if (cleanFileServerUrl === MY_URL) {
      const filePath = path.join('./uploads', fileInfo.filename)
      return res.download(filePath, fileInfo.originalName)
    }

    // Get the server that has the file
    const sourceServer = connectedServers.get(cleanFileServerUrl)
    if (!sourceServer?.socket?.connected) {
      console.error(`Source server not available: ${cleanFileServerUrl}`)
      return res.status(404).json({ error: 'Source server not available' })
    }

    // Request file from the source server
    const requestId = uuidv4()
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

app.get('/files', async (req, res) => {
  // Create a promise that resolves when we receive registry updates
  const registryUpdates = new Promise((resolve) => {
    const newFiles = new Map(fileRegistry) // Start with current registry
    let pendingResponses = 0
    
    // Handler for receiving registry updates
    const handleRegistry = (data) => {
      const files = Array.isArray(data) ? data : (data.files ? Object.values(data.files) : [])
      files.forEach(file => {
        if (!newFiles.has(file.fileId)) {
          newFiles.set(file.fileId, file)
        }
      })
      pendingResponses--
      
      if (pendingResponses <= 0) {
        // All responses received or no connected servers
        resolve(Array.from(newFiles.values()))
      }
    }

    // Request registry from all connected servers
    for (const [url, info] of connectedServers.entries()) {
      if (info.socket?.connected) {
        console.log(`Requesting registry from ${url}`)
        pendingResponses++
        info.socket.once('file-registry', handleRegistry)
        info.socket.emit('request-registry')
      }
    }

    // If no connected servers, resolve immediately
    if (pendingResponses === 0) {
      resolve(Array.from(newFiles.values()))
    }

    // Timeout after 5 seconds
    setTimeout(() => {
      resolve(Array.from(newFiles.values()))
    }, 10000)
  })

  try {
    const files = await registryUpdates
    res.json(files)
  } catch (error) {
    console.error('Error fetching files:', error)
    // Return current known files if there's an error
    res.json(Array.from(fileRegistry.values()))
  }
})

// Add a new endpoint to get server status
app.get('/status', (req, res) => {
  const status = {
    serverName,
    connectedServers: Array.from(connectedServers.values())
      .filter(info => info.socket?.connected)
      .map(info => ({
        name: info.name,
        files: info.files.size
      })),
    totalFiles: fileRegistry.size
  }
  res.json(status)
})

// Add this near the start of the file
setInterval(() => {
  console.log('Connected servers:', Array.from(connectedServers.entries()).map(([url, info]) => ({
    url,
    name: info.name,
    connected: info.socket?.connected
  })))
}, 10000)

// Add this near the start of the file
setInterval(() => {
  console.log('Connection status:', Array.from(connectedServers.entries()).map(([url, info]) => ({
    url,
    name: info.name,
    connected: info.socket?.connected,
    transport: info.socket?.io?.engine?.transport?.name,
    state: info.socket?.io?.engine?.readyState
  })))
}, 10000)

// Add this after the imports and before any other code
function cleanServerUrl(url) {
  if (!url) return ''
  // Remove trailing slash and ensure consistent format
  return url.trim().replace(/\/+$/, '')
} 