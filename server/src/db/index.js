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
      reply_to TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel_created
      ON messages(channel_id, created_at);

    CREATE TABLE IF NOT EXISTS user_bios (
      nickname TEXT PRIMARY KEY,
      bio TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS reactions (
      message_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (message_id, nickname, emoji),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
  `)

  const cols = db.prepare("PRAGMA table_info(messages)").all().map(c => c.name)
  if (!cols.includes('reply_to')) {
    db.exec('ALTER TABLE messages ADD COLUMN reply_to TEXT')
  }

  const profileCols = db.prepare("PRAGMA table_info(user_bios)").all().map(c => c.name)
  if (!profileCols.includes('avatar_url')) {
    db.exec('ALTER TABLE user_bios ADD COLUMN avatar_url TEXT DEFAULT NULL')
  }
  if (!profileCols.includes('banner_url')) {
    db.exec('ALTER TABLE user_bios ADD COLUMN banner_url TEXT DEFAULT NULL')
  }

  const msgCols = db.prepare("PRAGMA table_info(messages)").all().map(c => c.name)
  if (!msgCols.includes('user_id')) {
    db.exec('ALTER TABLE messages ADD COLUMN user_id TEXT')
  }
  if (!msgCols.includes('nsfw')) {
    db.exec('ALTER TABLE messages ADD COLUMN nsfw INTEGER NOT NULL DEFAULT 0')
  }

  const chanCols = db.prepare("PRAGMA table_info(channels)").all().map(c => c.name)
  if (!chanCols.includes('locked')) {
    db.exec('ALTER TABLE channels ADD COLUMN locked INTEGER NOT NULL DEFAULT 0')
  }

  db.exec(`
    INSERT OR IGNORE INTO channels (id, name, type, locked) VALUES ('general', 'general', 'text', 0);
    INSERT OR IGNORE INTO channels (id, name, type, locked) VALUES ('voice-1', 'Voice 1', 'voice', 0);
    INSERT OR IGNORE INTO channels (id, name, type, locked) VALUES ('voice-2', 'Voice 2', 'voice', 0);
    INSERT OR IGNORE INTO channels (id, name, type, locked) VALUES ('voice-3', 'Voice 3', 'voice', 0);
  `)

  const privPass = process.env.PRIVATE_PASSWORD
  if (privPass) {
    db.exec(`
      INSERT OR IGNORE INTO channels (id, name, type, locked) VALUES ('private', 'Private', 'text', 1);
      INSERT OR IGNORE INTO channels (id, name, type, locked) VALUES ('private-voice', 'Private Voice', 'voice', 1);
    `)
  }
}

module.exports = { db, migrate }
