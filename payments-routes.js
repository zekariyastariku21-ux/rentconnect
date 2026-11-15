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
const cfg = () => require('./lib/paymentSettings').get();

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

router.get('/fee', (req, res) => {
  const ps = require('./lib/paymentSettings');
  let price = req.query.price !== undefined ? Number(req.query.price) : NaN;
  if (req.query.listingId !== undefined) {
    const id = Number(req.query.listingId);
    const q = db.prepare('SELECT price FROM listings WHERE id=?');
    const row = q.get(id) || (id >= 1000 && q.get(id - 1000));
    if (row) price = row.price;
  }
  res.json({ fee: ps.feeFor(price), currency: 'ETB' });
});

// start a payment for one of my listings
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const settings = cfg();
    if (!settings.chapaEnabled) return res.status(400).json({ error: 'Chapa payments are not enabled.' });
    if (!settings.chapaSecretKey && !(settings.fakePay && process.env.NODE_ENV !== 'production')) {
      return res.status(500).json({ error: 'Payments are not configured.' });
    }
    const raw = Number(req.body.listingId);
    const find = db.prepare('SELECT id, status, price FROM listings WHERE id=? AND user_id=?');
    const l = find.get(raw, req.user.id) || (raw >= 1000 && find.get(raw - 1000, req.user.id));
    if (!l) return res.status(404).json({ error: 'Listing not found.' });
    if (l.status === 'active') return res.status(400).json({ error: 'This listing is already published.' });

    const fee = require('./lib/paymentSettings').feeFor(l.price);
    const kind = l.status === 'rented' ? 'relist' : 'publish';
    const u = db.prepare('SELECT full_name FROM users WHERE id=?').get(req.user.id) || {};
    const parts = String(u.full_name || 'Owner').trim().split(/\s+/);
    const txRef = 'rc-' + l.id + '-' + crypto.randomBytes(6).toString('hex');
    const base = (settings.baseUrl || 'http://localhost:3000').replace(/\/$/, '');
    if ((cfg().fakePay && process.env.NODE_ENV !== 'production')) {
      db.prepare('INSERT INTO payments (tx_ref, listing_id, user_id, kind, amount, status, created_at) VALUES (?,?,?,?,?,?,?)')
        .run(txRef, l.id, req.user.id, kind, fee, 'paid', Date.now());
      db.prepare("UPDATE listings SET status='active' WHERE id=? AND user_id=?").run(l.id, req.user.id);
      return res.json({ fake: true, message: (kind === 'relist' ? 'TEST MODE: listing is live again.' : 'TEST MODE: listing published.') + ' No real payment was made.' });
    }

    const r = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg().chapaSecretKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: String(fee),
        currency: 'ETB',
        first_name: parts[0],
        last_name: parts.slice(1).join(' ') || parts[0],
        tx_ref: txRef,
        return_url: base + '/my-listings.html?tx_ref=' + txRef,
        ...(base.startsWith('https') ? { callback_url: base + '/api/payments/callback' } : {})
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.data || !j.data.checkout_url) {
      return res.status(502).json({ error: (j && j.message) || 'Could not start payment.' });
    }
    db.prepare('INSERT INTO payments (tx_ref, listing_id, user_id, kind, amount, created_at) VALUES (?,?,?,?,?,?)')
      .run(txRef, l.id, req.user.id, kind, fee, Date.now());
    res.json({ checkoutUrl: j.data.checkout_url });
  } catch (e) {
    res.status(500).json({ error: 'Payment error.' });
  }
});

// confirm with Chapa, then publish
// ---- Telebirr ----
const tele = () => require('./lib/telebirr');
try { db.exec("ALTER TABLE payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'chapa'"); } catch (e) {}

async function settleTelebirr(p) {
  if (p.status === 'used') return 'used';
  if (p.status === 'pending') {
    const q = await tele().queryOrder(p.tx_ref);
    if (!q.paid || q.currency !== 'ETB' || !Number.isFinite(q.amount) || q.amount < p.amount) return 'pending';
    db.prepare("UPDATE payments SET status='paid' WHERE id=? AND status='pending'").run(p.id);
  }
  db.prepare("UPDATE listings SET status='active' WHERE id=? AND user_id=?").run(p.listing_id, p.user_id);
  return 'used';
}

router.get('/methods', (req, res) => {
  const settings = cfg();
  res.json({
    chapa: settings.chapaEnabled && (!!settings.chapaSecretKey || !!(settings.fakePay && process.env.NODE_ENV !== 'production')),
    telebirr: tele().ready() || !!(tele().get().enabled && settings.fakePay && process.env.NODE_ENV !== 'production')
  });
});

router.post('/telebirr/checkout', requireAuth, async (req, res) => {
  try {
    const T = tele();
    const fake = cfg().fakePay && process.env.NODE_ENV !== 'production';
    if (!T.get().enabled) return res.status(400).json({ error: 'Telebirr is not enabled.' });
    if (!fake && !T.ready()) return res.status(500).json({ error: 'Telebirr is not configured.' });
    const raw = Number(req.body.listingId);
    const find = db.prepare('SELECT id, status, price FROM listings WHERE id=? AND user_id=?');
    const l = find.get(raw, req.user.id) || (raw >= 1000 && find.get(raw - 1000, req.user.id));
    if (!l) return res.status(404).json({ error: 'Listing not found.' });
    if (l.status === 'active') return res.status(400).json({ error: 'This listing is already published.' });

    const fee = require('./lib/paymentSettings').feeFor(l.price);
    const kind = l.status === 'rented' ? 'relist' : 'publish';
    const ref = 'tb' + l.id + 'x' + crypto.randomBytes(6).toString('hex');
    const ins = db.prepare('INSERT INTO payments (tx_ref, listing_id, user_id, kind, amount, status, created_at, provider) VALUES (?,?,?,?,?,?,?,?)');

    if (fake) {
      ins.run(ref, l.id, req.user.id, kind, fee, 'paid', Date.now(), 'telebirr');
      db.prepare("UPDATE listings SET status='active' WHERE id=? AND user_id=?").run(l.id, req.user.id);
      return res.json({ fake: true, message: 'TEST MODE: listing published. No real payment was made.' });
    }
    const base = (cfg().baseUrl || 'http://localhost:3000').replace(/\/$/, '');
    const order = await T.createOrder({
      orderId: ref, title: 'Listing fee', amount: fee,
      notifyUrl: base + '/api/payments/telebirr/notify',
      redirectUrl: base + '/my-listings.html?tx_ref=' + ref
    });
    ins.run(ref, l.id, req.user.id, kind, fee, 'pending', Date.now(), 'telebirr');
    res.json({ checkoutUrl: order.checkoutUrl });
  } catch (e) {
    console.error('Telebirr checkout:', e.message);
    res.status(502).json({ error: 'Could not start Telebirr payment: ' + e.message });
  }
});

// Telebirr server notification: signature checked when a public key is saved,
// and the payment is always confirmed with Telebirr's query-order API
router.post('/telebirr/notify', async (req, res) => {
  try {
    const b = req.body || {};
    const ref = String(b.merch_order_id || (b.biz_content && b.biz_content.merch_order_id) || '');
    const T = tele();
    if (ref && (!T.get().publicKey || T.verify(b))) {
      const p = db.prepare('SELECT * FROM payments WHERE tx_ref=?').get(ref);
      if (p && p.provider === 'telebirr') await settleTelebirr(p);
    }
  } catch (e) { console.error('Telebirr notify:', e.message); }
  res.json({ code: 0, msg: 'success' });
});

// Telebirr payments are confirmed here; anything else falls through to the Chapa handler below
router.get('/verify', requireAuth, async (req, res, next) => {
  try {
    const p = db.prepare('SELECT * FROM payments WHERE tx_ref=? AND user_id=?').get(String(req.query.tx_ref || ''), req.user.id);
    if (!p || p.provider !== 'telebirr') return next();
    const s = await settleTelebirr(p);
    if (s !== 'used') return res.status(402).json({ error: 'Payment not completed yet.' });
    res.json({ ok: true, message: p.kind === 'relist' ? 'Payment received. Your listing is live again.' : 'Payment received. Your listing is now published.' });
  } catch (e) { res.status(500).json({ error: 'Could not verify the payment.' }); }
});
router.get('/verify', requireAuth, async (req, res) => {
  try {
    const p = db.prepare('SELECT * FROM payments WHERE tx_ref=? AND user_id=?').get(String(req.query.tx_ref || ''), req.user.id);
    if (!p) return res.status(404).json({ error: 'Payment not found.' });
    if (p.status === 'used') return res.json({ ok: true, message: 'Your listing is already published.' });

    if (p.status === 'pending') {
      const r = await fetch('https://api.chapa.co/v1/transaction/verify/' + encodeURIComponent(p.tx_ref), {
        headers: { Authorization: 'Bearer ' + cfg().chapaSecretKey }
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
  if (p && p.provider === 'telebirr') return settleTelebirr(p);
  if (p.status === 'used') return 'used';
  if (p.status === 'pending') {
    const r = await fetch('https://api.chapa.co/v1/transaction/verify/' + encodeURIComponent(p.tx_ref), {
      headers: { Authorization: 'Bearer ' + cfg().chapaSecretKey }
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
