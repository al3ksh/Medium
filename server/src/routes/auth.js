const express = require('express')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const rateLimit = require('express-rate-limit')
const router = express.Router()
const { onlineUsers } = require('../store')

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later' } })

router.post('/check-passphrase', authLimiter, (req, res) => {
  if (process.env.PASSPHRASE_ENABLED !== 'true') {
    return res.json({ valid: true })
  }

  const { passphrase } = req.body

  if (!passphrase || passphrase !== process.env.PASSPHRASE) {
    return res.status(403).json({ error: 'Wrong passphrase' })
  }

  res.json({ valid: true })
})

router.post('/login', authLimiter, (req, res) => {
  const { passphrase, nickname } = req.body

  if (!nickname) {
    return res.status(400).json({ error: 'Nickname is required' })
  }

  if (nickname.length < 2 || nickname.length > 20) {
    return res.status(400).json({ error: 'Nickname must be 2-20 characters' })
  }

  if (!/^[\p{L}\p{N}_\-. ]+$/u.test(nickname)) {
    return res.status(400).json({ error: 'Nickname can only contain letters, numbers, spaces, _ - .' })
  }

  if (process.env.PASSPHRASE_ENABLED === 'true') {
    if (!passphrase || passphrase !== process.env.PASSPHRASE) {
      return res.status(403).json({ error: 'Wrong passphrase' })
    }
  }

  const takenNicks = new Set(Array.from(onlineUsers.values()).map(u => u.nickname))
  if (takenNicks.has(nickname)) {
    return res.status(409).json({ error: 'This nickname is currently in use' })
  }

  const userId = uuidv4()

  const token = jwt.sign(
    { nickname, userId },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )

  res.json({ token, nickname, userId })
})

router.get('/config', (req, res) => {
  res.json({ passphraseEnabled: process.env.PASSPHRASE_ENABLED === 'true' })
})

router.get('/verify', (req, res) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false })
  }

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    res.json({ valid: true, nickname: decoded.nickname, userId: decoded.userId })
  } catch {
    res.json({ valid: false })
  }
})

module.exports = router
