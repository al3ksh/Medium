const { db } = require('../db')

function buildOccupancy(io) {
  const occupancy = {}
  for (const [, s] of io.sockets.sockets) {
    if (s.voiceChannel) {
      if (!occupancy[s.voiceChannel]) occupancy[s.voiceChannel] = []
      occupancy[s.voiceChannel].push(s.user.nickname)
    }
  }
  return occupancy
}

function buildVoiceStates(io) {
  const states = {}
  for (const [, s] of io.sockets.sockets) {
    if (s.voiceChannel && (s.isMuted || s.isDeafened)) {
      states[s.user.nickname] = { muted: !!s.isMuted, deafened: !!s.isDeafened }
    }
  }
  return states
}

function registerVoiceHandlers(io, socket) {
  socket.on('voice:join', (channelId) => {
    const channel = db.prepare('SELECT id, type, locked FROM channels WHERE id = ?').get(channelId)
    if (!channel || channel.type !== 'voice') return
    if (channel.locked && !socket.unlockedChannels?.has(channelId)) return

    socket.join(`voice:${channelId}`)
    socket.voiceChannel = channelId

    const peers = []
    for (const [id, s] of io.sockets.sockets) {
      if (id !== socket.id && s.voiceChannel === channelId) {
        peers.push({ socketId: id, nickname: s.user.nickname, isMuted: !!s.isMuted, isDeafened: !!s.isDeafened })
      }
    }

    socket.emit('voice:peers', peers)

    socket.to(`voice:${channelId}`).emit('voice:user-joined', {
      socketId: socket.id,
      nickname: socket.user.nickname,
      isMuted: !!socket.isMuted,
      isDeafened: !!socket.isDeafened,
    })

    io.emit('voice:occupancy', buildOccupancy(io))
  })

  socket.on('voice:leave', () => {
    if (socket.voiceChannel) {
      socket.to(`voice:${socket.voiceChannel}`).emit('voice:user-left', { socketId: socket.id })
      socket.leave(`voice:${socket.voiceChannel}`)
      socket.voiceChannel = null
      io.emit('voice:occupancy', buildOccupancy(io))
    }
  })

  socket.on('voice:signal', (data) => {
    const target = io.sockets.sockets.get(data.target)
    if (target) {
      target.emit('voice:signal', {
        type: data.type,
        sdp: data.sdp,
        candidate: data.candidate,
        from: socket.id,
      })
    }
  })

  socket.on('voice:speaking', (isSpeaking) => {
    if (socket.voiceChannel) {
      socket.to(`voice:${socket.voiceChannel}`).emit('voice:speaking', {
        socketId: socket.id,
        isSpeaking,
      })
    }
  })

  socket.on('voice:mute', (muted) => {
    socket.isMuted = muted
    if (socket.voiceChannel) {
      socket.to(`voice:${socket.voiceChannel}`).emit('voice:mute', {
        socketId: socket.id,
        muted,
      })
      io.emit('voice:states', buildVoiceStates(io))
    }
  })

  socket.on('voice:deafen', (deafened) => {
    socket.isDeafened = deafened
    if (socket.voiceChannel) {
      socket.to(`voice:${socket.voiceChannel}`).emit('voice:deafen', {
        socketId: socket.id,
        deafened,
      })
      io.emit('voice:states', buildVoiceStates(io))
    }
  })

  socket.on('voice:ping', (timestamp) => {
    socket.emit('voice:pong', timestamp)
  })

  socket.on('voice:kick', ({ nickname, channelId }) => {
    for (const [id, s] of io.sockets.sockets) {
      if (s.voiceChannel === channelId && s.user.nickname === nickname) {
        s.leave(`voice:${channelId}`)
        s.voiceChannel = null
        s.isMuted = false
        s.isDeafened = false
        s.emit('voice:kicked')
        socket.to(`voice:${channelId}`).emit('voice:user-left', { socketId: id })
        io.emit('voice:occupancy', buildOccupancy(io))
        io.emit('voice:states', buildVoiceStates(io))
        break
      }
    }
  })
}

module.exports = { registerVoiceHandlers, buildOccupancy, buildVoiceStates }
