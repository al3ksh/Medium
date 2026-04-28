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
const { onlineUsers } = require('./store')

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

const GIPHY_KEY = process.env.GIPHY_API_KEY || '0UTRb7tkDoVsdm/ksdcxf6yo'

app.get('/api/gif/search', async (req, res) => {
  const q = req.query.q || ''
  if (!q) return res.json([])
  try {
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=pg`)
    const data = await r.json()
    res.json((data.data || []).map(g => ({
      id: g.id,
      url: g.images?.original?.url,
      preview: g.images?.fixed_width_small?.url || g.images?.preview_gif?.url,
      title: g.title || '',
    })))
  } catch {
    res.json([])
  }
})

app.get('/api/gif/trending', async (req, res) => {
  try {
    const r = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=pg`)
    const data = await r.json()
    res.json((data.data || []).map(g => ({
      id: g.id,
      url: g.images?.original?.url,
      preview: g.images?.fixed_width_small?.url || g.images?.preview_gif?.url,
      title: g.title || '',
    })))
  } catch {
    res.json([])
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

app.get('/api/link-preview', async (req, res) => {
  const url = req.query.url
  if (!url) return res.json(null)

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MediumBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    const html = await r.text()

    const getMeta = (prop) => {
      const match = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'))
      return match ? match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"') : null
    }

    const title = getMeta('og:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || null
    const desc = getMeta('og:description') || getMeta('description') || null
    let image = getMeta('og:image') || null

    if (image && !image.startsWith('http')) {
      try { image = new URL(image, url).href } catch { image = null }
    }

    const domain = new URL(url).hostname

    res.json({ title, desc, image, domain })
  } catch {
    res.json(null)
  }
})

migrate()
startPurgeInterval()

const userColors = new Map()
const userProfiles = new Map()

const biosRows = db.prepare('SELECT nickname, bio, avatar_url, banner_url FROM user_bios').all()
for (const row of biosRows) {
  const profile = {}
  if (row.bio) profile.bio = row.bio
  if (row.avatar_url) profile.avatar = row.avatar_url
  if (row.banner_url) profile.banner = row.banner_url
  if (Object.keys(profile).length > 0) userProfiles.set(row.nickname, profile)
}

function broadcastProfiles() {
  io.emit('user:profiles', Object.fromEntries(userProfiles))
}

function broadcastColors() {
  io.emit('user:colors', Object.fromEntries(userColors))
}

io.use(socketAuthMiddleware)

io.on('connection', (socket) => {
  const { nickname, userId } = socket.user
  onlineUsers.set(socket.id, { nickname, userId })

  console.log(`[socket] ${nickname} (${userId?.slice(0,8)}) connected (${socket.id})`)
  io.emit('users:update', Array.from(onlineUsers.values()).map(u => u.nickname))

  socket.emit('user:colors', Object.fromEntries(userColors))
  socket.emit('user:profiles', Object.fromEntries(userProfiles))

  const { buildOccupancy, buildVoiceStates } = require('./socket/voice')
  socket.emit('voice:occupancy', buildOccupancy(io))
  socket.emit('voice:states', buildVoiceStates(io))

  registerChatHandlers(io, socket)
  registerVoiceHandlers(io, socket)

  socket.on('channel:unlock', (password, callback) => {
    if (password === process.env.PRIVATE_PASSWORD) {
      if (!socket.unlockedChannels) socket.unlockedChannels = new Set()
      const lockedChannels = db.prepare('SELECT id FROM channels WHERE locked = 1').all()
      for (const ch of lockedChannels) {
        socket.unlockedChannels.add(ch.id)
      }
      if (callback) callback({ ok: true })
    } else {
      if (callback) callback({ error: 'Wrong password' })
    }
  })

  socket.on('user:color', (color) => {
    userColors.set(nickname, color)
    broadcastColors()
  })

  socket.on('user:bio', (bio) => {
    const trimmed = (bio || '').slice(0, 190)
    const profile = userProfiles.get(nickname) || {}
    profile.bio = trimmed
    userProfiles.set(nickname, profile)
    db.prepare('INSERT OR REPLACE INTO user_bios (nickname, bio, avatar_url, banner_url) VALUES (?, ?, ?, ?)').run(
      nickname, trimmed, profile.avatar || null, profile.banner || null
    )
    broadcastProfiles()
  })

  socket.on('user:avatar', (url) => {
    const profile = userProfiles.get(nickname) || {}
    profile.avatar = url || null
    userProfiles.set(nickname, profile)
    db.prepare('INSERT OR REPLACE INTO user_bios (nickname, bio, avatar_url, banner_url) VALUES (?, ?, ?, ?)').run(
      nickname, profile.bio || '', url || null, profile.banner || null
    )
    broadcastProfiles()
  })

  socket.on('user:banner', (url) => {
    const profile = userProfiles.get(nickname) || {}
    profile.banner = url || null
    userProfiles.set(nickname, profile)
    db.prepare('INSERT OR REPLACE INTO user_bios (nickname, bio, avatar_url, banner_url) VALUES (?, ?, ?, ?)').run(
      nickname, profile.bio || '', profile.avatar || null, url || null
    )
    broadcastProfiles()
  })

  socket.on('channel:created', (channel) => {
    socket.broadcast.emit('channel:created', channel)
  })

  socket.on('channel:deleted', (channelId) => {
    socket.broadcast.emit('channel:deleted', channelId)
  })

  socket.on('channel:renamed', (updated) => {
    socket.broadcast.emit('channel:renamed', updated)
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
    for (const [, entry] of onlineUsers) {
      if (entry.nickname === nickname) { stillOnline = true; break }
    }
    if (!stillOnline) userColors.delete(nickname)

    io.emit('users:update', Array.from(onlineUsers.values()).map(u => u.nickname))
    broadcastColors()
    broadcastProfiles()
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`[server] Medium running on port ${PORT}`)
})
