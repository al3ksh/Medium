const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { authMiddleware } = require('../middleware/auth')

router.use(authMiddleware)

router.get('/search/query', (req, res) => {
  const { q, channel, nickname: nick, private_password: privatePass } = req.query
  if (!q || q.trim().length < 2) return res.json([])

  const since = Math.floor(Date.now() / 1000) - 86400
  const includeLocked = privatePass && privatePass === process.env.PRIVATE_PASSWORD
  const conditions = ['m.created_at >= ?', "m.content LIKE '%' || ? || '%'"]
  const params = [since, q.trim()]

  if (!includeLocked) {
    conditions.push('c.locked = 0')
  }

  if (channel) {
    if (!includeLocked) {
      const ch = db.prepare('SELECT locked FROM channels WHERE id = ?').get(channel)
      if (ch?.locked) return res.json([])
    }
    conditions.push('m.channel_id = ?')
    params.push(channel)
  }
  if (nick) {
    conditions.push('m.nickname = ?')
    params.push(nick)
  }

  const where = conditions.join(' AND ')
  const messages = db.prepare(`SELECT m.*, c.name as channel_name FROM messages m JOIN channels c ON m.channel_id = c.id WHERE ${where} ORDER BY m.created_at DESC LIMIT 50`).all(...params)

  res.json(messages.map(m => ({
    id: m.id,
    channel_id: m.channel_id,
    channel_name: m.channel_name,
    nickname: m.nickname,
    content: m.content,
    created_at: m.created_at,
  })))
})

router.get('/:channelId', (req, res) => {
  const { channelId } = req.params
  const { before, limit } = req.query
  const maxLimit = Math.min(parseInt(limit) || 50, 100)

  let messages, replyIds

  if (before) {
    messages = db.prepare(
      'SELECT * FROM messages WHERE channel_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?'
    ).all(channelId, parseInt(before), maxLimit).reverse()
  } else {
    const since = Math.floor(Date.now() / 1000) - 86400
    messages = db.prepare(
      'SELECT * FROM messages WHERE channel_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?'
    ).all(channelId, since, maxLimit).reverse()
  }

  replyIds = [...new Set(messages.map(m => m.reply_to).filter(Boolean))]
  const replies = {}
  if (replyIds.length > 0) {
    const placeholders = replyIds.map(() => '?').join(',')
    const rows = db.prepare(`SELECT id, nickname, content FROM messages WHERE id IN (${placeholders})`).all(...replyIds)
    for (const r of rows) {
      replies[r.id] = { id: r.id, nickname: r.nickname, content: r.content }
    }
  }

  const msgIds = messages.map(m => m.id)
  const reactionMap = {}
  if (msgIds.length > 0) {
    const placeholders = msgIds.map(() => '?').join(',')
    const reactionRows = db.prepare(`SELECT message_id, emoji, GROUP_CONCAT(nickname) as nicknames, COUNT(*) as count FROM reactions WHERE message_id IN (${placeholders}) GROUP BY message_id, emoji`).all(...msgIds)
    for (const r of reactionRows) {
      if (!reactionMap[r.message_id]) reactionMap[r.message_id] = []
      reactionMap[r.message_id].push({ emoji: r.emoji, count: r.count, nicknames: r.nicknames.split(',') })
    }
  }

  const result = messages.map(m => ({
    ...m,
    reply_to: m.reply_to ? (replies[m.reply_to] || null) : null,
    reactions: reactionMap[m.id] || [],
  }))

  res.json(result)
})

module.exports = router
