const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'taskrelay.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#7c3aed',
    type        TEXT DEFAULT 'existing',
    description TEXT DEFAULT '',
    location    TEXT DEFAULT '',
    tech_stack  TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    title             TEXT NOT NULL,
    description       TEXT DEFAULT '',
    priority          TEXT DEFAULT 'mid' CHECK(priority IN ('high','mid','low')),
    status            TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done','paused','cancelled')),
    working_directory TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    project_id        INTEGER,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  )
`);

// Migrate existing DBs
for (const col of [
  `notes TEXT DEFAULT ''`,
  `project_id INTEGER`,
  `archived INTEGER DEFAULT 0`,
]) {
  try { db.exec(`ALTER TABLE tickets ADD COLUMN ${col}`); } catch (_) {}
}
try { db.exec(`ALTER TABLE projects ADD COLUMN type TEXT DEFAULT 'existing'`); } catch (_) {}

const T_SEL = `
  SELECT t.*, p.name AS project_name, p.color AS project_color,
         p.location AS project_location, p.tech_stack AS project_tech_stack,
         p.notes AS project_notes
  FROM tickets t
  LEFT JOIN projects p ON t.project_id = p.id
`;
const PSQL = `CASE t.priority WHEN 'high' THEN 1 WHEN 'mid' THEN 2 WHEN 'low' THEN 3 END`;

module.exports = {
  // ── Tickets ──────────────────────────────────────────────────────
  getAll() {
    return db.prepare(`${T_SEL} ORDER BY ${PSQL}, t.created_at ASC`).all();
  },
  getQueue() {
    return db.prepare(`
      ${T_SEL}
      WHERE t.status IN ('todo','paused')
      ORDER BY CASE t.status WHEN 'paused' THEN 0 ELSE 1 END, ${PSQL}, t.created_at ASC
    `).all();
  },
  getById(id) {
    return db.prepare(`${T_SEL} WHERE t.id = ?`).get(id);
  },
  create({ title, description, priority, working_directory, project_id }) {
    const r = db.prepare(
      `INSERT INTO tickets (title,description,priority,working_directory,project_id) VALUES (?,?,?,?,?)`
    ).run(title, description || '', priority || 'mid', working_directory || '', project_id || null);
    return this.getById(r.lastInsertRowid);
  },
  update(id, data) {
    const allowed = ['title','description','priority','status','working_directory','notes','project_id','archived'];
    const fields = Object.keys(data).filter(k => allowed.includes(k));
    if (!fields.length) return this.getById(id);
    const sets = [...fields.map(f => `${f}=?`), `updated_at=datetime('now')`].join(',');
    db.prepare(`UPDATE tickets SET ${sets} WHERE id=?`).run(...fields.map(f => data[f]), id);
    return this.getById(id);
  },
  remove(id) { db.prepare('DELETE FROM tickets WHERE id=?').run(id); },

  // ── Projects ─────────────────────────────────────────────────────
  getAllProjects() {
    return db.prepare(`
      SELECT p.*,
        COUNT(CASE WHEN t.status NOT IN ('done','cancelled') THEN 1 END) AS active_tickets,
        COUNT(t.id) AS total_tickets
      FROM projects p
      LEFT JOIN tickets t ON t.project_id = p.id
      GROUP BY p.id ORDER BY p.name ASC
    `).all();
  },
  getProjectById(id) {
    return db.prepare('SELECT * FROM projects WHERE id=?').get(id);
  },
  createProject({ name, color, type, description, location, tech_stack, notes }) {
    const r = db.prepare(
      `INSERT INTO projects (name,color,type,description,location,tech_stack,notes) VALUES (?,?,?,?,?,?,?)`
    ).run(name, color || '#7c3aed', type || 'existing', description || '', location || '', tech_stack || '', notes || '');
    return this.getProjectById(r.lastInsertRowid);
  },
  updateProject(id, data) {
    const allowed = ['name','color','type','description','location','tech_stack','notes'];
    const fields = Object.keys(data).filter(k => allowed.includes(k));
    if (!fields.length) return this.getProjectById(id);
    const sets = [...fields.map(f => `${f}=?`), `updated_at=datetime('now')`].join(',');
    db.prepare(`UPDATE projects SET ${sets} WHERE id=?`).run(...fields.map(f => data[f]), id);
    return this.getProjectById(id);
  },
  removeProject(id) {
    db.prepare('UPDATE tickets SET project_id=NULL WHERE project_id=?').run(id);
    db.prepare('DELETE FROM projects WHERE id=?').run(id);
  },

  // ── Stats ─────────────────────────────────────────────────────────
  getStats() {
    const byStatus   = db.prepare(`SELECT status, COUNT(*) n FROM tickets GROUP BY status`).all();
    const byPriority = db.prepare(`SELECT priority, COUNT(*) n FROM tickets WHERE status NOT IN ('done','cancelled') GROUP BY priority`).all();
    const projectCount = db.prepare('SELECT COUNT(*) n FROM projects').get().n;
    const recent = db.prepare(`
      SELECT t.*, p.name project_name, p.color project_color
      FROM tickets t LEFT JOIN projects p ON t.project_id=p.id
      ORDER BY t.updated_at DESC LIMIT 8
    `).all();
    const sm = Object.fromEntries(byStatus.map(r => [r.status, r.n]));
    const pm = Object.fromEntries(byPriority.map(r => [r.priority, r.n]));
    return {
      projects: projectCount,
      tickets: {
        total: byStatus.reduce((s,r) => s + r.n, 0),
        todo: sm.todo || 0, in_progress: sm.in_progress || 0,
        done: sm.done || 0, paused: sm.paused || 0
      },
      by_priority: { high: pm.high || 0, mid: pm.mid || 0, low: pm.low || 0 },
      recent
    };
  }
};
