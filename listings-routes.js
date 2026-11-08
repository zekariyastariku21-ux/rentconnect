require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CATEGORIES = ['Apartment', 'House', 'Villa', 'Studio', 'Room', 'Shared Housing'];
const FEATURES = ['Parking', 'Balcony', 'Furnished', 'Internet', 'Generator'];

const db = new Database(path.join(__dirname, 'auth.db'));
db.exec(`CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  price INTEGER NOT NULL,
  beds INTEGER,
  baths INTEGER,
  size INTEGER,
  features TEXT,
  description TEXT,
  contact_phone TEXT NOT NULL,
  image_data TEXT,
  created_at INTEGER NOT NULL
)`);

// add the status column to existing databases (active / rented)
const listingCols = db.prepare('PRAGMA table_info(listings)').all().map(c => c.name);
if (!listingCols.includes('status')) {
  db.exec("ALTER TABLE listings ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
}
// accepts 120, 4x3, 4*3, 4 x 3.5 -> area in m2 (rounded)
function sizeVal(v) {
  const s = String(v == null ? '' : v).toLowerCase().replace(/[x\u00D7*]/g, 'x').replace(/\s/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const n = Math.round(Number(m[1]) * (m[2] ? Number(m[2]) : 1));
  return n >= 1 && n <= 100000 ? n : null;
}
// keep the length x width the owner typed (e.g. "4x3") next to the calculated area
const hasDims = db.prepare('PRAGMA table_info(listings)').all().some(c => c.name === 'size_dims');
if (!hasDims) db.exec('ALTER TABLE listings ADD COLUMN size_dims TEXT');

function dimsVal(v) {
  const s = String(v == null ? '' : v).toLowerCase().replace(/[x\u00D7*]/g, 'x').replace(/\s/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  return m ? Number(m[1]) + 'x' + Number(m[2]) : null;
}
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Please log in first.' });
  }
}

const int = (v, min, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

// Public: all listings
router.get('/', (req, res) => {
  const rows = db.prepare(
    "SELECT id, title, category, city, area, price, beds, baths, size, size_dims, features, description, contact_phone, image_data IS NOT NULL AS has_image FROM listings WHERE status = 'active' ORDER BY id DESC"
  ).all();
  res.json(rows.map(r => ({
    id: 1000 + r.id,
    title: r.title,
    category: r.category,
    city: r.city,
    area: r.area,
    price: r.price,
    beds: r.beds,
    baths: r.baths,
    size: r.size,
    dims: r.size_dims,
    features: JSON.parse(r.features || '[]'),
    description: r.description,
    phone: r.contact_phone,
    image: r.has_image ? `/api/listings/${r.id}/image` : ''
  })));
});

// Public: photo of one listing
router.get('/:id/image', (req, res) => {
  const row = db.prepare('SELECT image_data FROM listings WHERE id=?').get(Number(req.params.id));
  const m = row && row.image_data && row.image_data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return res.status(404).end();
  res.set('Content-Type', m[1]);
  res.set('Cache-Control', 'no-cache');
  res.send(Buffer.from(m[2], 'base64'));
});

// Logged-in users: create a listing
router.post('/', requireAuth, express.json({ limit: '3mb' }), (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const city = String(b.city || '').trim();
  const area = String(b.area || '').trim();
  const description = String(b.description || '').trim();
  const phone = String(b.phone || '').trim();
  const price = int(b.price, 1, 100000000);
  const beds = int(b.beds, 0, 50);
  const baths = int(b.baths, 0, 50);
  const size = sizeVal(b.size);

  if (title.length < 5 || title.length > 100) return res.status(400).json({ error: 'Title must be 5 to 100 characters.' });
  if (!CATEGORIES.includes(b.category)) return res.status(400).json({ error: 'Choose a property type.' });
  if (!city || city.length > 60) return res.status(400).json({ error: 'Enter the city.' });
  if (!area || area.length > 60) return res.status(400).json({ error: 'Enter the area.' });
  if (price === null) return res.status(400).json({ error: 'Enter a valid monthly price.' });
  if (beds === null || baths === null) return res.status(400).json({ error: 'Enter valid bedrooms and bathrooms.' });
  if (size === null) return res.status(400).json({ error: 'Enter a valid size, like 120 or 4x3.' });
  if (description.length > 1000) return res.status(400).json({ error: 'Description is too long (max 1000).' });
  if (!/^\+?[\d\s-]{9,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid contact phone number.' });

  const features = (Array.isArray(b.features) ? b.features : []).filter(f => FEATURES.includes(f));

  let image = null;
  if (b.image) {
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image) || b.image.length > 2000000)
      return res.status(400).json({ error: 'Photo must be a JPG, PNG or WEBP image under 2 MB.' });
    image = b.image;
  }

  const info = db.prepare(
    `INSERT INTO listings (user_id, title, category, city, area, price, beds, baths, size, size_dims, features, description, contact_phone, image_data, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(req.user.id, title, b.category, city, area, price, beds, baths, size, JSON.stringify(features), description, phone, image, Date.now());

  db.prepare('UPDATE listings SET size_dims=? WHERE id=?').run(dimsVal(b.size), info.lastInsertRowid);
  res.json({ message: 'Your property is now listed.', id: 1000 + info.lastInsertRowid });
});

// ---- Owner tools: my listings, edit, mark rented ----
function parseListing(b) {
  const title = String(b.title || '').trim();
  const city = String(b.city || '').trim();
  const area = String(b.area || '').trim();
  const description = String(b.description || '').trim();
  const phone = String(b.phone || '').trim();
  const price = int(b.price, 1, 100000000);
  const beds = int(b.beds, 0, 50);
  const baths = int(b.baths, 0, 50);
  const size = sizeVal(b.size);

  if (title.length < 5 || title.length > 100) return { error: 'Title must be 5 to 100 characters.' };
  if (!CATEGORIES.includes(b.category)) return { error: 'Choose a property type.' };
  if (!city || city.length > 60) return { error: 'Enter the city.' };
  if (!area || area.length > 60) return { error: 'Enter the area.' };
  if (price === null) return { error: 'Enter a valid monthly price.' };
  if (beds === null || baths === null) return { error: 'Enter valid bedrooms and bathrooms.' };
  if (size === null) return { error: 'Enter a valid size, like 120 or 4x3.' };
  if (description.length > 1000) return { error: 'Description is too long (max 1000).' };
  if (!/^\+?[\d\s-]{9,15}$/.test(phone)) return { error: 'Enter a valid contact phone number.' };

  const features = (Array.isArray(b.features) ? b.features : []).filter(f => FEATURES.includes(f));

  let image;
  if (b.image) {
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.image) || b.image.length > 2000000)
      return { error: 'Photo must be a JPG, PNG or WEBP image under 2 MB.' };
    image = b.image;
  }
  return { v: { title, category: b.category, city, area, price, beds, baths, size, description, phone, features, image } };
}

// The logged-in owner's own listings (active and rented)
router.get('/mine', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT id, title, category, city, area, price, beds, baths, size, size_dims, features, description, contact_phone, status, image_data IS NOT NULL AS has_image FROM listings WHERE user_id=? ORDER BY id DESC'
  ).all(req.user.id);
  res.json(rows.map(r => ({
    id: r.id,
    title: r.title,
    category: r.category,
    city: r.city,
    area: r.area,
    price: r.price,
    beds: r.beds,
    baths: r.baths,
    size: r.size,
    dims: r.size_dims,
    features: JSON.parse(r.features || '[]'),
    description: r.description,
    phone: r.contact_phone,
    status: r.status,
    image: r.has_image ? `/api/listings/${r.id}/image` : ''
  })));
});

// Edit a listing (owner only)
router.put('/:id', requireAuth, express.json({ limit: '3mb' }), (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id, user_id FROM listings WHERE id=?').get(id);
  if (!row || row.user_id !== req.user.id) return res.status(404).json({ error: 'Listing not found.' });

  const r = parseListing(req.body || {});
  if (r.error) return res.status(400).json({ error: r.error });
  const v = r.v;

  db.prepare(
    'UPDATE listings SET title=?, category=?, city=?, area=?, price=?, beds=?, baths=?, size=?, features=?, description=?, contact_phone=? WHERE id=? AND user_id=?'
  ).run(v.title, v.category, v.city, v.area, v.price, v.beds, v.baths, v.size, JSON.stringify(v.features), v.description, v.phone, id, req.user.id);
  if (v.image) db.prepare('UPDATE listings SET image_data=? WHERE id=?').run(v.image, id);

  db.prepare('UPDATE listings SET size_dims=? WHERE id=? AND user_id=?').run(dimsVal((req.body || {}).size), id, req.user.id);
  res.json({ message: 'Changes saved.' });
});

// Mark as rented (hides it from the public list) or list it again
router.post('/:id/status', requireAuth, express.json(), (req, res) => {
  const status = req.body && req.body.status;
  if (!['active', 'rented'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const info = db.prepare('UPDATE listings SET status=? WHERE id=? AND user_id=?')
    .run(status, Number(req.params.id), req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Listing not found.' });
  res.json({ message: status === 'rented'
    ? 'Marked as rented and removed from the public list.'
    : 'Your property is listed again.' });
});
router.use((err, req, res, next) => {
  const tooBig = err && err.status === 413;
  res.status(tooBig ? 413 : 500).json({ error: tooBig ? 'Photo is too large.' : 'Server error.' });
});

module.exports = router;





