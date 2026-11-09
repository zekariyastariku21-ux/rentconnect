require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
router.use(express.json());
const db = new Database(path.join(__dirname, 'auth.db'));
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CHAPA_KEY = process.env.CHAPA_SECRET_KEY;
const FEE = Number(process.env.LISTING_FEE || 100);
const FAKE = process.env.DEV_FAKE_PAY === 'true' && process.env.NODE_ENV !== 'production';
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

db.exec(`CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_ref TEXT NOT NULL UNIQUE,
  listing_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
)`);

// new listings start unpaid (hidden)
db.exec(`CREATE TRIGGER IF NOT EXISTS listing_start_unpaid AFTER INSERT ON listings
BEGIN UPDATE listings SET status='unpaid' WHERE id=NEW.id; END;`);
// nothing becomes active without a paid payment
db.exec(`CREATE TRIGGER IF NOT EXISTS listing_pay_gate BEFORE UPDATE OF status ON listings
WHEN NEW.status='active' AND OLD.status<>'active'
 AND NOT EXISTS (SELECT 1 FROM payments WHERE listing_id=NEW.id AND status='paid')
BEGIN SELECT RAISE(ABORT,'Payment required'); END;`);
// each payment publishes once
db.exec(`CREATE TRIGGER IF NOT EXISTS listing_pay_use AFTER UPDATE OF status ON listings
WHEN NEW.status='active' AND OLD.status<>'active'
BEGIN UPDATE payments SET status='used' WHERE listing_id=NEW.id AND status='paid'; END;`);

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch (e) { res.status(401).json({ error: 'Please log in first.' }); }
}

router.get('/fee', (req, res) => res.json({ fee: FEE, currency: 'ETB' }));

// start a payment for one of my listings
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    if (!CHAPA_KEY) return res.status(500).json({ error: 'Payments are not configured.' });
    const raw = Number(req.body.listingId);
    const find = db.prepare('SELECT id, status FROM listings WHERE id=? AND user_id=?');
    const l = find.get(raw, req.user.id) || (raw >= 1000 && find.get(raw - 1000, req.user.id));
    if (!l) return res.status(404).json({ error: 'Listing not found.' });
    if (l.status === 'active') return res.status(400).json({ error: 'This listing is already published.' });

    const kind = l.status === 'rented' ? 'relist' : 'publish';
    const u = db.prepare('SELECT full_name FROM users WHERE id=?').get(req.user.id) || {};
    const parts = String(u.full_name || 'Owner').trim().split(/\s+/);
    const txRef = 'rc-' + l.id + '-' + crypto.randomBytes(6).toString('hex');
    if (FAKE) {
      db.prepare('INSERT INTO payments (tx_ref, listing_id, user_id, kind, amount, status, created_at) VALUES (?,?,?,?,?,?,?)')
        .run(txRef, l.id, req.user.id, kind, FEE, 'paid', Date.now());
      db.prepare("UPDATE listings SET status='active' WHERE id=? AND user_id=?").run(l.id, req.user.id);
      return res.json({ fake: true, message: (kind === 'relist' ? 'TEST MODE: listing is live again.' : 'TEST MODE: listing published.') + ' No real payment was made.' });
    }

    const r = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + CHAPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: String(FEE),
        currency: 'ETB',
        first_name: parts[0],
        last_name: parts.slice(1).join(' ') || parts[0],
        tx_ref: txRef,
        return_url: BASE + '/my-listings.html?tx_ref=' + txRef,
        ...(BASE.startsWith('https') ? { callback_url: BASE + '/api/payments/callback' } : {})
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.data || !j.data.checkout_url) {
      return res.status(502).json({ error: (j && j.message) || 'Could not start payment.' });
    }
    db.prepare('INSERT INTO payments (tx_ref, listing_id, user_id, kind, amount, created_at) VALUES (?,?,?,?,?,?)')
      .run(txRef, l.id, req.user.id, kind, FEE, Date.now());
    res.json({ checkoutUrl: j.data.checkout_url });
  } catch (e) {
    res.status(500).json({ error: 'Payment error.' });
  }
});

// confirm with Chapa, then publish
router.get('/verify', requireAuth, async (req, res) => {
  try {
    const p = db.prepare('SELECT * FROM payments WHERE tx_ref=? AND user_id=?').get(String(req.query.tx_ref || ''), req.user.id);
    if (!p) return res.status(404).json({ error: 'Payment not found.' });
    if (p.status === 'used') return res.json({ ok: true, message: 'Your listing is already published.' });

    if (p.status === 'pending') {
      const r = await fetch('https://api.chapa.co/v1/transaction/verify/' + encodeURIComponent(p.tx_ref), {
        headers: { Authorization: 'Bearer ' + CHAPA_KEY }
      });
      const j = await r.json().catch(() => ({}));
      const ok = j.status === 'success' && j.data && j.data.status === 'success' && Number(j.data.amount) >= p.amount;
      if (!ok) return res.status(402).json({ error: 'Payment not completed yet.' });
      db.prepare("UPDATE payments SET status='paid' WHERE id=?").run(p.id);
    }
    db.prepare("UPDATE listings SET status='active' WHERE id=? AND user_id=?").run(p.listing_id, p.user_id);
    res.json({ ok: true, message: p.kind === 'relist' ? 'Payment received. Your listing is live again.' : 'Payment received. Your listing is now published.' });
  } catch (e) {
    res.status(500).json({ error: 'Could not verify the payment.' });
  }
});

async function settle(p) {
  if (p.status === 'used') return 'used';
  if (p.status === 'pending') {
    const r = await fetch('https://api.chapa.co/v1/transaction/verify/' + encodeURIComponent(p.tx_ref), {
      headers: { Authorization: 'Bearer ' + CHAPA_KEY }
    });
    const j = await r.json().catch(() => ({}));
    const ok = j.status === 'success' && j.data && j.data.status === 'success' && Number(j.data.amount) >= p.amount;
    if (!ok) return 'pending';
    db.prepare("UPDATE payments SET status='paid' WHERE id=? AND status='pending'").run(p.id);
  }
  db.prepare("UPDATE listings SET status='active' WHERE id=? AND user_id=?").run(p.listing_id, p.user_id);
  return 'used';
}

// Chapa calls this after payment (needs a public https BASE_URL); it only trusts Chapa's verify API
router.get('/callback', async (req, res) => {
  try {
    const ref = String(req.query.trx_ref || req.query.tx_ref || '');
    const p = db.prepare('SELECT * FROM payments WHERE tx_ref=?').get(ref);
    if (p) await settle(p);
  } catch (e) {}
  res.sendStatus(200);
});

// publish any of my listings whose payment went through while I was away
router.post('/recheck', requireAuth, async (req, res) => {
  const since = Date.now() - 7 * 24 * 3600 * 1000;
  const rows = db.prepare("SELECT * FROM payments WHERE user_id=? AND status IN ('pending','paid') AND created_at>?").all(req.user.id, since);
  let n = 0;
  for (const p of rows) { try { if (await settle(p) === 'used') n++; } catch (e) {} }
  res.json({ published: n });
});

module.exports = router;


