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
const connectedServers = new Map() // socketId -> { socket, name }
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
      name: serverInfo.name
    })
  })

  // Add disconnect handler
  socket.on('disconnect', () => {
    const serverInfo = connectedServers.get(socket.id)
    if (serverInfo) {
      console.log(`Server disconnected: ${serverInfo.name}`)
      connectedServers.delete(socket.id)
    }
  })
})

// Connect to known servers on startup
knownServers.forEach(connectToServer)

// Update upload handler to remove propagation
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
      serverName,
      filename: fileId,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      uploadDate
    }

    // Update local registry
    fileRegistry.set(fileId, fileInfo)
    
    // Save metadata
    fileMetadata.set(fileId, {
      serverName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      uploadDate
    })
    saveMetadata()

    res.json(fileInfo)
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Upload failed', details: error.message })
  }
})

// Simplify files endpoint to only return local files
app.get('/files', async (req, res) => {
  res.json(Array.from(fileRegistry.values()))
})

// Update download endpoint to only serve local files
app.get('/download/:fileId', async (req, res) => {
  const { fileId } = req.params
  const fileInfo = fileRegistry.get(fileId)

  console.log('Download request for:', fileId)
  console.log('File info:', fileInfo)

  if (!fileInfo) {
    return res.status(404).json({ error: 'File not found in registry' })
  }

  try {
    const filePath = path.join('./uploads', fileInfo.filename)
    return res.download(filePath, fileInfo.originalName)
  } catch (error) {
    console.error('Error downloading file:', error)
    res.status(500).json({ 
      error: 'Failed to download file', 
      details: error.message 
    })
  }
})

// Simplify status endpoint
app.get('/status', (req, res) => {
  const status = {
    serverName,
    connectedServers: Array.from(connectedServers.values())
      .filter(info => info.socket?.connected)
      .map(info => ({
        name: info.name
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