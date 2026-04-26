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

function registerVoiceHandlers(io, socket) {
  socket.on('voice:join', (channelId) => {
    socket.join(`voice:${channelId}`)
    socket.voiceChannel = channelId

    const peers = []
    for (const [id, s] of io.sockets.sockets) {
      if (id !== socket.id && s.voiceChannel === channelId) {
        peers.push({ socketId: id, nickname: s.user.nickname })
      }
    }

    socket.emit('voice:peers', peers)

    socket.to(`voice:${channelId}`).emit('voice:user-joined', {
      socketId: socket.id,
      nickname: socket.user.nickname,
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

  socket.on('voice:ping', (timestamp) => {
    socket.emit('voice:pong', timestamp)
  })
}

module.exports = { registerVoiceHandlers }
