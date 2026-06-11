const express = require('express');
const path = require('path');
const db = require('./db');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Stats
app.get('/api/stats', (req, res) => res.json(db.getStats()));

// Tickets
app.get('/api/tickets',       (req, res) => res.json(db.getAll()));
app.get('/api/tickets/queue', (req, res) => res.json(db.getQueue()));
app.get('/api/tickets/:id',   (req, res) => {
  const t = db.getById(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});
app.post('/api/tickets', (req, res) => {
  const { title, description, priority, working_directory, project_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  res.status(201).json(db.create({ title, description, priority, working_directory, project_id }));
});
app.put('/api/tickets/:id', (req, res) => {
  const t = db.update(req.params.id, req.body);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});
app.delete('/api/tickets/:id', (req, res) => {
  db.remove(req.params.id);
  res.json({ ok: true });
});

// Projects
app.get('/api/projects',     (req, res) => res.json(db.getAllProjects()));
app.get('/api/projects/:id', (req, res) => {
  const p = db.getProjectById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});
app.post('/api/projects', (req, res) => {
  const { name, color, type, description, location, tech_stack, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try { res.status(201).json(db.createProject({ name, color, type, description, location, tech_stack, notes })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/projects/:id', (req, res) => {
  const p = db.updateProject(req.params.id, req.body);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});
app.delete('/api/projects/:id', (req, res) => {
  db.removeProject(req.params.id);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4010;
app.listen(PORT, '0.0.0.0', () => console.log(`AIJira running on :${PORT}`));
