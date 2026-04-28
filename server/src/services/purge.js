const { db } = require('../db')
const fs = require('fs')
const path = require('path')

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')

function purgeOldMessages() {
  const cutoff = Math.floor(Date.now() / 1000) - 86400

  const oldMessages = db.prepare(
    'SELECT attachment FROM messages WHERE created_at < ? AND attachment IS NOT NULL AND channel_id NOT IN (SELECT id FROM channels WHERE locked = 1)'
  ).all(cutoff)

  for (const msg of oldMessages) {
    if (msg.attachment) {
      const filePath = path.join(UPLOAD_DIR, path.basename(msg.attachment))
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath) } catch {}
      }
    }
  }

  const result = db.prepare('DELETE FROM messages WHERE created_at < ? AND channel_id NOT IN (SELECT id FROM channels WHERE locked = 1)').run(cutoff)
  if (result.changes > 0) {
    console.log(`[purge] Deleted ${result.changes} old messages`)
  }
}

function startPurgeInterval() {
  const interval = parseInt(process.env.CLEANUP_INTERVAL) || 3600000
  purgeOldMessages()
  setInterval(purgeOldMessages, interval)
  console.log(`[purge] Running every ${interval / 1000}s`)
}

module.exports = { startPurgeInterval }
