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
const MY_URL = process.env.SERVER_URL || 'http://localhost:3001'

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
  if (serverUrl === MY_URL) return // Don't connect to self
  
  console.log(`Attempting to connect to server: ${serverUrl}`)
  const socket = SocketClient(serverUrl)

  socket.on('connect', () => {
    console.log(`Connected to server: ${serverUrl}`)
    socket.emit('register-server', {
      url: MY_URL,
      name: serverName
    })
  })

  socket.on('disconnect', () => {
    console.log(`Disconnected from server: ${serverUrl}`)
    connectedServers.delete(serverUrl)
    // Attempt to reconnect after delay
    setTimeout(() => connectToServer(serverUrl), 5000)
  })

  socket.on('file-registry', (files) => {
    // Update our registry with files from other server
    for (const [fileId, fileInfo] of Object.entries(files)) {
      if (!fileRegistry.has(fileId)) {
        fileRegistry.set(fileId, fileInfo)
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
    if (fileInfo && fileInfo.serverUrl === MY_URL) {
      try {
        const filePath = path.join('./uploads', fileInfo.filename)
        const fileData = await fs.promises.readFile(filePath)
        socket.emit('file-data', fileData, requestId)
      } catch (error) {
        socket.emit('file-error', { error: 'File not found', requestId })
      }
    }
  })

  connectedServers.set(serverUrl, socket)

  return socket
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New connection:', socket.id)

  socket.on('register-server', (serverInfo) => {
    console.log(`Server registered: ${serverInfo.name} (${serverInfo.url})`)
    connectedServers.set(serverInfo.url, {
      socket: socket,
      name: serverInfo.name
    })

    // Send back list of servers with their names
    const serverList = Array.from(connectedServers.entries()).map(([url, info]) => ({
      url,
      name: info.name
    }))
    socket.emit('known-servers', serverList)
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

  socket.on('request-file', async ({ fileId, requestId }) => {
    const fileInfo = fileRegistry.get(fileId)
    if (fileInfo && fileInfo.serverUrl === MY_URL) {
      try {
        const filePath = path.join('./uploads', fileInfo.filename)
        const fileData = await fs.promises.readFile(filePath)
        socket.emit('file-data', fileData, requestId)
      } catch (error) {
        socket.emit('file-error', { error: 'File not found', requestId })
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
    const fileId = file.filename // This is the UUID generated by multer
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

  if (!fileInfo) {
    return res.status(404).json({ error: 'File not found' })
  }

  // If file is local, serve it directly
  if (fileInfo.serverUrl === (process.env.SERVER_URL || 'http://localhost:3000')) {
    const filePath = path.join('./uploads', fileInfo.filename)
    return res.download(filePath, fileInfo.originalName)
  }

  // If file is on another server, proxy the request
  const serverSocket = connectedServers.get(fileInfo.serverUrl)
  if (!serverSocket) {
    return res.status(404).json({ error: 'Server not available' })
  }

  // Request file from the other server
  serverSocket.emit('request-file', { fileId, requestId: uuidv4() })
  // Handle file transfer through WebSocket
  serverSocket.once('file-data', (data) => {
    res.set('Content-Type', fileInfo.mimeType)
    res.set('Content-Disposition', `attachment; filename="${fileInfo.originalName}"`)
    res.send(data)
  })
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
    connectedServers: Array.from(connectedServers.entries()).map(([url, info]) => ({
      url,
      name: info.name || `${url} (Unknown)`
    })),
    totalFiles: fileRegistry.size
  }
  res.json(status)
})

// Remove duplicate PORT declaration at the bottom and just use the listen call
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Server Name: ${serverName}`)
  console.log(`Server URL: ${MY_URL}`)
  console.log(`Known servers: ${knownServers.join(', ') || 'none'}`)
  
  // Scan existing files
  scanExistingFiles()
}) 