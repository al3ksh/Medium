const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'medium.db')

const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      content TEXT,
      attachment TEXT,
      attachment_name TEXT,
      attachment_type TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel_created
      ON messages(channel_id, created_at);

    INSERT OR IGNORE INTO channels (id, name, type) VALUES ('general', 'general', 'text');
  `)
}

module.exports = { db, migrate }
