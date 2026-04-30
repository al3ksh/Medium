const { db } = require('../db')

const streamViewers = new Map()

function broadcastViewers(io, presenterSocketId) {
  const viewers = streamViewers.get(presenterSocketId)
  if (!viewers) return
  const list = []
  for (const [, nickname] of viewers) list.push(nickname)
  const presenter = io.sockets.sockets.get(presenterSocketId)
  if (presenter?.voiceChannel) {
    io.to(`voice:${presenter.voiceChannel}`).emit('voice:stream-viewers', { presenterId: presenterSocketId, viewers: list })
  }
}

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
    if (s.voiceChannel) {
      const state = {}
      if (s.isMuted) state.muted = true
      if (s.isDeafened) state.deafened = true
      if (s.isScreenSharing) state.screenSharing = true
      if (Object.keys(state).length > 0) {
        states[s.user.nickname] = state
      }
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
        peers.push({ socketId: id, nickname: s.user.nickname, isMuted: !!s.isMuted, isDeafened: !!s.isDeafened, isScreenSharing: !!s.isScreenSharing })
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
    if (!socket.voiceChannel) return
    const target = io.sockets.sockets.get(data.target)
    if (!target || target.voiceChannel !== socket.voiceChannel) return
    target.emit('voice:signal', {
      type: data.type,
      sdp: data.sdp,
      candidate: data.candidate,
      from: socket.id,
    })
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
    if (socket.voiceChannel !== channelId) return
    for (const [id, s] of io.sockets.sockets) {
      if (s.voiceChannel === channelId && s.user.nickname === nickname) {
        s.leave(`voice:${channelId}`)
        s.voiceChannel = null
        s.isMuted = false
        s.isDeafened = false
        s.isScreenSharing = false
        s.emit('voice:kicked')
        socket.to(`voice:${channelId}`).emit('voice:user-left', { socketId: id })
        io.emit('voice:occupancy', buildOccupancy(io))
        io.emit('voice:states', buildVoiceStates(io))
        break
      }
    }
  })

  socket.on('voice:screen-start', () => {
    if (!socket.voiceChannel) return
    socket.isScreenSharing = true
    socket.to(`voice:${socket.voiceChannel}`).emit('voice:screen-start', { socketId: socket.id, nickname: socket.user.nickname })
    io.emit('voice:states', buildVoiceStates(io))
  })

  socket.on('voice:screen-stop', () => {
    if (socket.voiceChannel) {
      socket.isScreenSharing = false
      streamViewers.delete(socket.id)
      socket.to(`voice:${socket.voiceChannel}`).emit('voice:screen-stop', { socketId: socket.id })
      io.emit('voice:states', buildVoiceStates(io))
    }
  })

  socket.on('voice:stream-join', (presenterId) => {
    if (!socket.voiceChannel) return
    const presenter = io.sockets.sockets.get(presenterId)
    if (!presenter || presenter.voiceChannel !== socket.voiceChannel) return
    if (!streamViewers.has(presenterId)) streamViewers.set(presenterId, new Map())
    streamViewers.get(presenterId).set(socket.id, socket.user.nickname)
    broadcastViewers(io, presenterId)
  })

  socket.on('voice:stream-leave', (presenterId) => {
    const viewers = streamViewers.get(presenterId)
    if (viewers) {
      viewers.delete(socket.id)
      broadcastViewers(io, presenterId)
    }
  })
}

module.exports = { registerVoiceHandlers, buildOccupancy, buildVoiceStates, streamViewers, broadcastViewers }
