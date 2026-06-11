const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/tickets', (req, res) => res.json(db.getAll()));

app.get('/api/tickets/queue', (req, res) => res.json(db.getQueue()));

app.get('/api/tickets/:id', (req, res) => {
  const t = db.getById(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

app.post('/api/tickets', (req, res) => {
  const { title, description, priority, working_directory } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  res.status(201).json(db.create({ title, description, priority, working_directory }));
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

const PORT = process.env.PORT || 4010;
app.listen(PORT, '0.0.0.0', () => console.log(`AIJira running on :${PORT}`));
