require('dotenv').config()

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')

const { db, migrate } = require('./db')
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

const biosRows = db.prepare('SELECT nickname, bio FROM user_bios').all()
for (const row of biosRows) {
  if (row.bio) userBios.set(row.nickname, row.bio)
}

const onlineUsers = new Map()
const userColors = new Map()
const userBios = new Map()

function broadcastBios() {
  io.emit('user:bios', Object.fromEntries(userBios))
}

function broadcastColors() {
  io.emit('user:colors', Object.fromEntries(userColors))
}

io.use(socketAuthMiddleware)

io.on('connection', (socket) => {
  const { nickname } = socket.user
  onlineUsers.set(socket.id, nickname)

  console.log(`[socket] ${nickname} connected (${socket.id})`)
  io.emit('users:update', Array.from(onlineUsers.values()))

  socket.emit('user:colors', Object.fromEntries(userColors))
  socket.emit('user:bios', Object.fromEntries(userBios))

  registerChatHandlers(io, socket)
  registerVoiceHandlers(io, socket)

  socket.on('user:color', (color) => {
    userColors.set(nickname, color)
    broadcastColors()
  })

  socket.on('user:bio', (bio) => {
    const trimmed = (bio || '').slice(0, 190)
    userBios.set(nickname, trimmed)
    db.prepare('INSERT OR REPLACE INTO user_bios (nickname, bio) VALUES (?, ?)').run(nickname, trimmed)
    broadcastBios()
  })

  socket.on('channel:created', (channel) => {
    socket.broadcast.emit('channel:created', channel)
  })

  socket.on('channel:deleted', (channelId) => {
    socket.broadcast.emit('channel:deleted', channelId)
  })

  socket.on('disconnect', () => {
    console.log(`[socket] ${nickname} disconnected (${socket.id})`)
    onlineUsers.delete(socket.id)

    if (socket.voiceChannel) {
      socket.to(`voice:${socket.voiceChannel}`).emit('voice:user-left', { socketId: socket.id })
      const { buildOccupancy } = require('./socket/voice')
      io.emit('voice:occupancy', buildOccupancy(io))
    }

    let stillOnline = false
    for (const [, nick] of onlineUsers) {
      if (nick === nickname) { stillOnline = true; break }
    }
    if (!stillOnline) userColors.delete(nickname)

    io.emit('users:update', Array.from(onlineUsers.values()))
    broadcastColors()
    broadcastBios()
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`[server] Medium running on port ${PORT}`)
})
