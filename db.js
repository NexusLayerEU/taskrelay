const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'aijira.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT DEFAULT 'mid' CHECK(priority IN ('high','mid','low')),
    status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done','paused','cancelled')),
    working_directory TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

const PRIORITY_SQL = `CASE priority WHEN 'high' THEN 1 WHEN 'mid' THEN 2 WHEN 'low' THEN 3 END`;

module.exports = {
  getAll() {
    return db.prepare(`SELECT * FROM tickets ORDER BY ${PRIORITY_SQL}, created_at ASC`).all();
  },
  getQueue() {
    return db.prepare(`
      SELECT * FROM tickets
      WHERE status IN ('todo','paused')
      ORDER BY
        CASE status WHEN 'paused' THEN 0 ELSE 1 END,
        ${PRIORITY_SQL},
        created_at ASC
    `).all();
  },
  getById(id) {
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  },
  create({ title, description, priority, working_directory }) {
    const r = db.prepare(
      'INSERT INTO tickets (title, description, priority, working_directory) VALUES (?, ?, ?, ?)'
    ).run(title, description || '', priority || 'mid', working_directory || '');
    return this.getById(r.lastInsertRowid);
  },
  update(id, data) {
    const allowed = ['title', 'description', 'priority', 'status', 'working_directory'];
    const fields = Object.keys(data).filter(k => allowed.includes(k));
    if (!fields.length) return this.getById(id);
    const sets = [...fields.map(f => `${f} = ?`), `updated_at = datetime('now')`].join(', ');
    db.prepare(`UPDATE tickets SET ${sets} WHERE id = ?`).run(...fields.map(f => data[f]), id);
    return this.getById(id);
  },
  remove(id) {
    db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
  }
};
