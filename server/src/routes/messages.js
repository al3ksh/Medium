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

  res.json(messages)
})

module.exports = router
