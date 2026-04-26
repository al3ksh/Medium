const express = require('express')
const jwt = require('jsonwebtoken')
const router = express.Router()

router.post('/login', (req, res) => {
  const { passphrase, nickname } = req.body

  if (!passphrase || !nickname) {
    return res.status(400).json({ error: 'Passphrase and nickname are required' })
  }

  if (passphrase !== process.env.PASSPHRASE) {
    return res.status(403).json({ error: 'Wrong passphrase' })
  }

  if (nickname.length < 2 || nickname.length > 20) {
    return res.status(400).json({ error: 'Nickname must be 2-20 characters' })
  }

  const token = jwt.sign(
    { nickname, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )

  res.json({ token, nickname })
})

router.post('/verify', (req, res) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false })
  }

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    res.json({ valid: true, nickname: decoded.nickname })
  } catch {
    res.json({ valid: false })
  }
})

module.exports = router
