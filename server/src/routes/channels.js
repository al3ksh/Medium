const express = require('express')
const router = express.Router()
const { db } = require('../db')
const { authMiddleware } = require('../middleware/auth')

router.use(authMiddleware)

router.get('/', (req, res) => {
  const channels = db.prepare('SELECT * FROM channels ORDER BY name ASC').all()
  res.json(channels)
})

router.post('/', (req, res) => {
  const { name, type } = req.body

  if (!name || name.trim().length < 1 || name.length > 30) {
    return res.status(400).json({ error: 'Channel name must be 1-30 characters' })
  }

  const validTypes = ['text', 'voice']
  const channelType = validTypes.includes(type) ? type : 'text'

  const id = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')

  const existing = db.prepare('SELECT id FROM channels WHERE id = ?').get(id)
  if (existing) {
    return res.status(409).json({ error: 'Channel already exists' })
  }

  db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(id, name.trim(), channelType)
  res.status(201).json({ id, name: name.trim(), type: channelType })
})

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.id)
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Channel not found' })
  }
  res.json({ success: true })
})

module.exports = router
