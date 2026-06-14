const express = require('express');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.APP_PASSWORD || 'changeme';

// DB setup
const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const db = new Database(path.join(DB_DIR, 'templates.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth middleware ───
function requireAuth(req, res, next) {
  if (req.cookies.auth === PASSWORD) return next();
  if (req.headers['x-auth'] === PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ─── Auth endpoints ───
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    res.cookie('auth', PASSWORD, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'パスワードが違います' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ loggedIn: req.cookies.auth === PASSWORD });
});

// ─── Template CRUD ───
app.get('/api/templates', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, name, created_at, updated_at FROM templates ORDER BY updated_at DESC').all();
  res.json(rows);
});

app.get('/api/templates/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, data: JSON.parse(row.data) });
});

app.post('/api/templates', requireAuth, (req, res) => {
  const { name, data } = req.body;
  if (!name || !data) return res.status(400).json({ error: 'name and data required' });
  const result = db.prepare(
    'INSERT INTO templates (name, data) VALUES (?, ?)'
  ).run(name, JSON.stringify(data));
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/templates/:id', requireAuth, (req, res) => {
  const { name, data } = req.body;
  db.prepare(
    "UPDATE templates SET name = ?, data = ?, updated_at = datetime('now','localtime') WHERE id = ?"
  ).run(name, JSON.stringify(data), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/templates/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
