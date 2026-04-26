const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { authMiddleware } = require('../middleware/auth')

router.use(authMiddleware)

router.get('/:channelId', (req, res) => {
  const { channelId } = req.params
  const since = Math.floor(Date.now() / 1000) - 86400

  const messages = db.prepare(
    'SELECT * FROM messages WHERE channel_id = ? AND created_at >= ? ORDER BY created_at ASC'
  ).all(channelId, since)

  const replyIds = [...new Set(messages.map(m => m.reply_to).filter(Boolean))]
  const replies = {}
  if (replyIds.length > 0) {
    const placeholders = replyIds.map(() => '?').join(',')
    const rows = db.prepare(`SELECT id, nickname, content FROM messages WHERE id IN (${placeholders})`).all(...replyIds)
    for (const r of rows) {
      replies[r.id] = { id: r.id, nickname: r.nickname, content: r.content }
    }
  }

  const result = messages.map(m => ({
    ...m,
    reply_to: m.reply_to ? (replies[m.reply_to] || null) : null,
  }))

  res.json(result)
})

module.exports = router
