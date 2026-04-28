const jwt = require('jsonwebtoken')
const { onlineUsers, gracePeriods } = require('../store')

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = header.slice(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token
  if (!token) {
    return next(new Error('No token provided'))
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.user = decoded

    const { nickname, userId } = decoded

    for (const [, entry] of onlineUsers) {
      if (entry.nickname === nickname && entry.userId !== userId) {
        return next(new Error('Nickname in use'))
      }
    }

    const grace = gracePeriods.get(nickname)
    if (grace && grace.userId !== userId && Date.now() < grace.expiresAt) {
      return next(new Error('Nickname in use'))
    }
    if (grace && grace.userId !== userId && Date.now() >= grace.expiresAt) {
      gracePeriods.delete(nickname)
    }
    if (grace && grace.userId === userId) {
      gracePeriods.delete(nickname)
    }
    next()
  } catch (err) {
    if (err.message === 'Nickname in use') {
      return next(err)
    }
    return next(new Error('Invalid or expired token'))
  }
}

module.exports = { authMiddleware, socketAuthMiddleware }
