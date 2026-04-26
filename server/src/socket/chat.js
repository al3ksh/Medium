const { db } = require('../db')

function registerChatHandlers(io, socket) {
  socket.on('channel:join', (channelId) => {
    const channel = db.prepare('SELECT id, type FROM channels WHERE id = ?').get(channelId)
    if (!channel || channel.type !== 'text') return

    for (const room of socket.rooms) {
      if (room.startsWith('text:')) {
        socket.leave(room)
      }
    }
    socket.join(`text:${channelId}`)
    socket.currentChannel = channelId
  })

  socket.on('message:send', (data) => {
    const { channelId, content, attachment, attachmentName, attachmentType } = data

    if (!channelId || (!content && !attachment)) return
    if (content && content.length > 2000) return

    const channel = db.prepare('SELECT id, type FROM channels WHERE id = ?').get(channelId)
    if (!channel || channel.type !== 'text') return

    const { v4: uuidv4 } = require('uuid')
    const id = uuidv4()
    const now = Math.floor(Date.now() / 1000)

    db.prepare(
      'INSERT INTO messages (id, channel_id, nickname, content, attachment, attachment_name, attachment_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, channelId, socket.user.nickname, content || null, attachment || null, attachmentName || null, attachmentType || null, now)

    const message = {
      id,
      channel_id: channelId,
      nickname: socket.user.nickname,
      content: content || null,
      attachment: attachment || null,
      attachment_name: attachmentName || null,
      attachment_type: attachmentType || null,
      created_at: now,
    }

    io.to(`text:${channelId}`).emit('message:new', message)
  })

  socket.on('message:delete', (messageId) => {
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId)
    if (!msg) return

    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId)
    io.to(`text:${msg.channel_id}`).emit('message:deleted', messageId)
  })
}

module.exports = { registerChatHandlers }
