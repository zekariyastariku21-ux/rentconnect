require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const router = express.Router();
const db = new Database(path.join(__dirname, 'auth.db'));
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DEFAULT_CATEGORIES = ['Apartment', 'House', 'Villa', 'Studio', 'Room', 'Shared Housing'];

router.use(express.json());

db.exec(`CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  is_default INTEGER NOT NULL DEFAULT 0
)`);
const addDefaultCategory = db.prepare(
  'INSERT OR IGNORE INTO categories (name, is_default) VALUES (?, 1)'
);
for (const category of DEFAULT_CATEGORIES) addDefaultCategory.run(category);

const userCols = db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
if (!userCols.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");

function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT role, verified, full_name AS fullName FROM users WHERE id=?').get(payload.id);
    if (!user || user.role !== 'admin' || !user.verified) {
      return res.status(403).json({ error: 'Administrator access is required.' });
    }
    req.admin = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please log in first.' });
  }
}

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT id, name FROM categories ORDER BY is_default DESC, name COLLATE NOCASE').all();
  res.json(rows);
});

router.get('/admin/dashboard', requireAdmin, (req, res) => {
  const categories = db.prepare(`
    SELECT c.id, c.name, c.is_default AS isDefault, COUNT(l.id) AS listingCount
    FROM categories c
    LEFT JOIN listings l ON l.category = c.name
    GROUP BY c.id
    ORDER BY c.is_default DESC, c.name COLLATE NOCASE
  `).all();
  const accounts = db.prepare(`
    SELECT u.id, u.full_name AS name, u.phone, u.role, u.verified,
      COUNT(l.id) AS listingCount
    FROM users u
    LEFT JOIN listings l ON l.user_id = u.id
    GROUP BY u.id
    ORDER BY u.id DESC
  `).all();
  const listings = db.prepare(`
    SELECT l.id, l.title, l.category, l.city, l.area, l.price, l.status,
      u.full_name AS ownerName
    FROM listings l
    LEFT JOIN users u ON u.id = l.user_id
    ORDER BY l.id DESC
  `).all();

  res.json({
    adminName: req.admin.fullName,
    stats: {
      listings: listings.length,
      categories: categories.length,
      accounts: accounts.length,
      unverified: accounts.filter(account => !account.verified).length
    },
    categories,
    accounts,
    listings
  });
});

router.post('/admin/categories', requireAdmin, (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 40) {
    return res.status(400).json({ error: 'Category name must be between 1 and 40 characters.' });
  }

  try {
    const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid, name, isDefault: 0, listingCount: 0 });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'That category already exists.' });
    }
    throw error;
  }
});

router.delete('/admin/categories/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid category.' });

  const category = db.prepare('SELECT id, name, is_default FROM categories WHERE id=?').get(id);
  if (!category) return res.status(404).json({ error: 'Category not found.' });
  if (category.is_default) return res.status(400).json({ error: 'Built-in categories cannot be removed.' });
  const usage = db.prepare('SELECT COUNT(*) AS count FROM listings WHERE category=?').get(category.name);
  if (usage.count) {
    return res.status(409).json({ error: 'This category is used by existing listings and cannot be removed.' });
  }

  db.prepare('DELETE FROM categories WHERE id=?').run(id);
  res.json({ message: 'Category removed.' });
});

router.use((error, req, res, next) => {
  console.error('Admin API error:', error);
  res.status(500).json({ error: 'Server error.' });
});

module.exports = router;
