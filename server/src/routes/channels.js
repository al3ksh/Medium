const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')
const { db } = require('../db')
const { authMiddleware } = require('../middleware/auth')

const unlockLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts' } })

router.use(authMiddleware)

router.post('/unlock', unlockLimiter, (req, res) => {
  const { password } = req.body
  if (!password) {
    return res.status(400).json({ error: 'Password required' })
  }

  if (password !== process.env.PRIVATE_PASSWORD) {
    return res.status(403).json({ error: 'Wrong password' })
  }

  res.json({ unlocked: true })
})

router.get('/', (req, res) => {
  const channels = db.prepare('SELECT * FROM channels ORDER BY locked DESC, type ASC, name ASC').all()
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

router.patch('/:id', (req, res) => {
  const { name } = req.body
  if (!name || name.trim().length < 1 || name.length > 30) {
    return res.status(400).json({ error: 'Channel name must be 1-30 characters' })
  }
  const existing = db.prepare('SELECT id FROM channels WHERE id = ?').get(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Channel not found' })
  }
  db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(name.trim(), req.params.id)
  const updated = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id)
  res.json(updated)
})

module.exports = router
