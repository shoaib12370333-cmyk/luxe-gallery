const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'luxe-gallery-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hour session
}));

// Static files
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Multer (image upload) config ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only JPG, PNG, or WEBP images are allowed'), ok);
  }
});

// ---------- Auth middleware ----------
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// ================= PUBLIC API =================

app.get('/api/gallery', (req, res) => {
  const items = db.prepare('SELECT * FROM gallery_items ORDER BY sort_order ASC, id DESC').all();
  res.json(items);
});

app.get('/api/testimonials', (req, res) => {
  const items = db.prepare(
    "SELECT * FROM testimonials WHERE status = 'approved' ORDER BY sort_order ASC, id DESC"
  ).all();
  res.json(items);
});

app.post('/api/reviews', (req, res) => {
  const { client_name, quote, rating } = req.body;
  if (!client_name || !client_name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!quote || !quote.trim()) return res.status(400).json({ error: 'Review text is required' });

  let ratingValue = parseInt(rating, 10);
  if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) ratingValue = 5;

  const result = db.prepare(
    "INSERT INTO testimonials (client_name, quote, rating, status) VALUES (?, ?, ?, 'pending')"
  ).run(client_name.trim().slice(0, 100), quote.trim().slice(0, 1000), ratingValue);

  res.json({ success: true, id: result.lastInsertRowid });
});

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

// ================= ADMIN AUTH =================

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.isAdmin = true;
  req.session.username = username;
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// Diagnostic route — does not reveal credentials, just confirms an admin
// account exists in the database. Useful for troubleshooting login issues
// without needing shell/console access to the server.
app.get('/api/admin/status', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM admin_users').get().c;
  const usernames = db.prepare('SELECT username FROM admin_users').all().map(u => u.username);
  res.json({ adminAccountCount: count, usernames });
});

// Recovery route — only works if RESET_ADMIN_KEY is set as an environment
// variable on your host, and the request supplies the same key. This lets you
// recreate/reset the admin account without server console access, in case the
// account is ever missing or you're locked out. Remove or rotate the key once
// you no longer need it.
app.post('/api/admin/emergency-reset', (req, res) => {
  const { key, username, password } = req.body;
  const expectedKey = process.env.RESET_ADMIN_KEY;

  if (!expectedKey) {
    return res.status(403).json({ error: 'Emergency reset is not enabled on this server.' });
  }
  if (!key || key !== expectedKey) {
    return res.status(401).json({ error: 'Invalid reset key.' });
  }
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: 'A username and a password of at least 6 characters are required.' });
  }

  const newHash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

  if (existing) {
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(newHash, username);
  } else {
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, newHash);
  }

  res.json({ success: true, message: `Admin account "${username}" has been set. You can now log in.` });
});

app.post('/api/admin/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(req.session.username);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(newHash, req.session.username);
  res.json({ success: true });
});

// ================= ADMIN: GALLERY MANAGEMENT =================

app.post('/api/admin/gallery', requireAuth, upload.single('image'), (req, res) => {
  const { title, category, description, price, dimensions, sort_order } = req.body;
  if (!title || !req.file) return res.status(400).json({ error: 'Title and image are required' });

  const imagePath = '/uploads/' + req.file.filename;
  const stmt = db.prepare(
    'INSERT INTO gallery_items (title, category, description, price, dimensions, image_path, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(title, category || 'General', description || '', price || '', dimensions || '', imagePath, sort_order || 0);
  res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/admin/gallery/:id', requireAuth, upload.single('image'), (req, res) => {
  const { title, category, description, price, dimensions, sort_order } = req.body;
  const existing = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  let imagePath = existing.image_path;
  if (req.file) {
    imagePath = '/uploads/' + req.file.filename;
    const oldFile = path.join(UPLOADS_DIR, path.basename(existing.image_path));
    fs.unlink(oldFile, () => {}); // best-effort cleanup
  }

  db.prepare(
    'UPDATE gallery_items SET title = ?, category = ?, description = ?, price = ?, dimensions = ?, image_path = ?, sort_order = ? WHERE id = ?'
  ).run(
    title || existing.title,
    category || existing.category,
    description ?? existing.description,
    price ?? existing.price,
    dimensions ?? existing.dimensions,
    imagePath,
    sort_order ?? existing.sort_order,
    req.params.id
  );

  res.json({ success: true });
});

app.delete('/api/admin/gallery/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const filePath = path.join(UPLOADS_DIR, path.basename(existing.image_path));
  fs.unlink(filePath, () => {});
  db.prepare('DELETE FROM gallery_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ================= ADMIN: TESTIMONIALS / REVIEWS MANAGEMENT =================

app.get('/api/admin/testimonials', requireAuth, (req, res) => {
  const items = db.prepare(
    "SELECT * FROM testimonials ORDER BY (status = 'pending') DESC, sort_order ASC, id DESC"
  ).all();
  res.json(items);
});

app.post('/api/admin/testimonials', requireAuth, (req, res) => {
  const { client_name, quote, rating, sort_order } = req.body;
  if (!client_name || !quote) return res.status(400).json({ error: 'Client name and quote are required' });

  let ratingValue = parseInt(rating, 10);
  if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) ratingValue = 5;

  const result = db.prepare(
    "INSERT INTO testimonials (client_name, quote, rating, status, sort_order) VALUES (?, ?, ?, 'approved', ?)"
  ).run(client_name, quote, ratingValue, sort_order || 0);
  res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/admin/testimonials/:id', requireAuth, (req, res) => {
  const { client_name, quote, rating, sort_order } = req.body;
  const existing = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Review not found' });

  let ratingValue = parseInt(rating, 10);
  if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) ratingValue = existing.rating;

  db.prepare('UPDATE testimonials SET client_name = ?, quote = ?, rating = ?, sort_order = ? WHERE id = ?')
    .run(client_name || existing.client_name, quote || existing.quote, ratingValue, sort_order ?? existing.sort_order, req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/testimonials/:id/approve', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Review not found' });
  db.prepare("UPDATE testimonials SET status = 'approved' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/testimonials/:id/reject', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Review not found' });
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/testimonials/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ================= ADMIN: SETTINGS =================

app.post('/api/admin/settings', requireAuth, (req, res) => {
  const allowedKeys = ['whatsapp_number', 'facebook_url', 'instagram_url', 'announcement_text', 'announcement_enabled'];
  const upsert = db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  );
  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) {
      upsert.run(key, String(req.body[key]), String(req.body[key]));
    }
  }
  res.json({ success: true });
});

app.post('/api/admin/site-images', requireAuth, upload.fields([
  { name: 'hero_image', maxCount: 1 },
  { name: 'about_image', maxCount: 1 }
]), (req, res) => {
  const upsert = db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  );

  const getOldPath = (key) => {
    const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
    return row ? row.value : null;
  };

  if (req.files && req.files.hero_image && req.files.hero_image[0]) {
    const newPath = '/uploads/' + req.files.hero_image[0].filename;
    const oldPath = getOldPath('hero_image');
    upsert.run('hero_image', newPath, newPath);
    if (oldPath && oldPath.startsWith('/uploads/')) {
      fs.unlink(path.join(UPLOADS_DIR, path.basename(oldPath)), () => {});
    }
  }

  if (req.files && req.files.about_image && req.files.about_image[0]) {
    const newPath = '/uploads/' + req.files.about_image[0].filename;
    const oldPath = getOldPath('about_image');
    upsert.run('about_image', newPath, newPath);
    if (oldPath && oldPath.startsWith('/uploads/')) {
      fs.unlink(path.join(UPLOADS_DIR, path.basename(oldPath)), () => {});
    }
  }

  res.json({ success: true });
});

// ---------- Error handler for multer/file errors ----------
app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

app.listen(PORT, () => {
  console.log(`Luxe Gallery server running on http://localhost:${PORT}`);
});
