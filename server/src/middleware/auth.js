const jwt = require('jsonwebtoken')

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
    next()
  } catch {
    return next(new Error('Invalid or expired token'))
  }
}

module.exports = { authMiddleware, socketAuthMiddleware }
