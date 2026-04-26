require('dotenv').config()

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')

const { migrate } = require('./db')
const { socketAuthMiddleware } = require('./middleware/auth')
const { startPurgeInterval } = require('./services/purge')
const { registerChatHandlers } = require('./socket/chat')
const { registerVoiceHandlers } = require('./socket/voice')

const authRoutes = require('./routes/auth')
const channelRoutes = require('./routes/channels')
const messageRoutes = require('./routes/messages')
const uploadRoutes = require('./routes/upload')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*' },
})

app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/channels', channelRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/upload', uploadRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

migrate()
startPurgeInterval()

const onlineUsers = new Map()

io.use(socketAuthMiddleware)

io.on('connection', (socket) => {
  const { nickname } = socket.user
  onlineUsers.set(socket.id, nickname)

  console.log(`[socket] ${nickname} connected (${socket.id})`)
  io.emit('users:update', Array.from(onlineUsers.values()))

  registerChatHandlers(io, socket)
  registerVoiceHandlers(io, socket)

  socket.on('disconnect', () => {
    console.log(`[socket] ${nickname} disconnected (${socket.id})`)
    onlineUsers.delete(socket.id)

    if (socket.voiceChannel) {
      socket.to(`voice:${socket.voiceChannel}`).emit('voice:user-left', { socketId: socket.id })
    }

    io.emit('users:update', Array.from(onlineUsers.values()))
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`[server] Medium running on port ${PORT}`)
})
