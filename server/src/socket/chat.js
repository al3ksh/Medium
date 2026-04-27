const { db } = require('../db')

const typingUsers = new Map()

function registerChatHandlers(io, socket) {
  socket.on('channel:join', (channelId, callback) => {
    const channel = db.prepare('SELECT id, type, locked FROM channels WHERE id = ?').get(channelId)
    if (!channel || channel.type !== 'text') return

    if (channel.locked && !socket.unlockedChannels?.has(channelId)) {
      if (callback) callback({ error: 'locked' })
      return
    }

    for (const room of socket.rooms) {
      if (room.startsWith('text:')) {
        socket.leave(room)
      }
    }
    socket.join(`text:${channelId}`)
    socket.currentChannel = channelId
    if (callback) callback({ ok: true })
  })

  socket.on('message:send', (data) => {
    const { channelId, content, attachment, attachmentName, attachmentType, replyTo } = data

    if (!channelId || (!content && !attachment)) return
    if (content && content.length > 2000) return

    const channel = db.prepare('SELECT id, type, locked FROM channels WHERE id = ?').get(channelId)
    if (!channel || channel.type !== 'text') return
    if (channel.locked && !socket.unlockedChannels?.has(channelId)) return

    const { v4: uuidv4 } = require('uuid')
    const id = uuidv4()
    const now = Math.floor(Date.now() / 1000)
    const userId = socket.user.userId || null

    let replyData = null
    if (replyTo) {
      const original = db.prepare('SELECT id, nickname, content FROM messages WHERE id = ?').get(replyTo)
      if (original) {
        replyData = { id: original.id, nickname: original.nickname, content: original.content }
      }
    }

    db.prepare(
      'INSERT INTO messages (id, channel_id, nickname, user_id, content, attachment, attachment_name, attachment_type, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, channelId, socket.user.nickname, userId, content || null, attachment || null, attachmentName || null, attachmentType || null, replyTo || null, now)

    const message = {
      id,
      channel_id: channelId,
      nickname: socket.user.nickname,
      user_id: userId,
      content: content || null,
      attachment: attachment || null,
      attachment_name: attachmentName || null,
      attachment_type: attachmentType || null,
      reply_to: replyData,
      created_at: now,
    }

    io.to(`text:${channelId}`).emit('message:new', message)

    const channelTyping = typingUsers.get(channelId)
    if (channelTyping) {
      channelTyping.delete(socket.user.nickname)
      if (channelTyping.size === 0) {
        typingUsers.delete(channelId)
      }
      const typers = Array.from(channelTyping.keys())
      io.to(`text:${channelId}`).emit('typing:update', { channelId, typers })
    }
  })

  socket.on('message:delete', (messageId) => {
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId)
    if (!msg) return

    const userId = socket.user.userId
    if (msg.user_id && msg.user_id !== userId) return

    db.prepare('DELETE FROM messages WHERE id = ?').run(messageId)
    io.to(`text:${msg.channel_id}`).emit('message:deleted', messageId)
  })

  socket.on('typing:start', (channelId) => {
    if (!channelId) return
    if (!typingUsers.has(channelId)) typingUsers.set(channelId, new Map())
    const channelTyping = typingUsers.get(channelId)
    channelTyping.set(socket.user.nickname, Date.now())

    const typers = Array.from(channelTyping.keys())
    socket.to(`text:${channelId}`).emit('typing:update', { channelId, typers })

    setTimeout(() => {
      const ch = typingUsers.get(channelId)
      if (!ch) return
      const last = ch.get(socket.user.nickname)
      if (last && Date.now() - last >= 5000) {
        ch.delete(socket.user.nickname)
        if (ch.size === 0) typingUsers.delete(channelId)
        const updated = Array.from(ch.keys())
        io.to(`text:${channelId}`).emit('typing:update', { channelId, typers: updated })
      }
    }, 5000)
  })

  socket.on('typing:stop', (channelId) => {
    if (!channelId) return
    const channelTyping = typingUsers.get(channelId)
    if (!channelTyping) return
    channelTyping.delete(socket.user.nickname)
    if (channelTyping.size === 0) typingUsers.delete(channelId)
    const typers = Array.from(channelTyping.keys())
    socket.to(`text:${channelId}`).emit('typing:update', { channelId, typers })
  })
}

module.exports = { registerChatHandlers }
