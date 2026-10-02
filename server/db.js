const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new DatabaseSync(path.join(__dirname, 'luxegallery.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS gallery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    description TEXT,
    price TEXT,
    dimensions TEXT,
    image_path TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    quote TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    status TEXT DEFAULT 'approved',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migration: add price/dimensions columns if upgrading from an older database
const galleryColumns = db.prepare("PRAGMA table_info(gallery_items)").all().map(c => c.name);
if (!galleryColumns.includes('price')) {
  db.exec('ALTER TABLE gallery_items ADD COLUMN price TEXT');
}
if (!galleryColumns.includes('dimensions')) {
  db.exec('ALTER TABLE gallery_items ADD COLUMN dimensions TEXT');
}

// Migration: add rating/status columns to testimonials if upgrading from an older database
const testimonialColumns = db.prepare("PRAGMA table_info(testimonials)").all().map(c => c.name);
if (!testimonialColumns.includes('rating')) {
  db.exec("ALTER TABLE testimonials ADD COLUMN rating INTEGER DEFAULT 5");
}
if (!testimonialColumns.includes('status')) {
  db.exec("ALTER TABLE testimonials ADD COLUMN status TEXT DEFAULT 'approved'");
}

// Seed a default admin user if none exists yet.
// You can override the default credentials by setting ADMIN_USERNAME and
// ADMIN_PASSWORD as environment variables on your hosting provider (e.g. Railway
// > Variables tab) before the first deploy that creates the database.
const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin_users').get().c;
console.log(`[db] admin_users table currently has ${adminCount} account(s).`);

if (adminCount === 0) {
  const seedUsername = process.env.ADMIN_USERNAME || 'admin';
  const seedPassword = process.env.ADMIN_PASSWORD || 'luxegallery123';
  const defaultHash = bcrypt.hashSync(seedPassword, 10);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
    .run(seedUsername, defaultHash);
  console.log(`[db] Default admin created -> username: ${seedUsername} | password: ${seedPassword} (please change this after logging in)`);
}

// Seed default settings if not present
const defaultSettings = {
  whatsapp_number: '',
  facebook_url: '',
  instagram_url: '',
  announcement_text: '',
  announcement_enabled: '0',
  hero_image: '/img/hero-placeholder.jpg',
  about_image: '/img/about-placeholder.jpg'
};
for (const [key, value] of Object.entries(defaultSettings)) {
  const existing = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
  if (!existing) {
    db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run(key, value);
  }
}

module.exports = db;
