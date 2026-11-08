require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');

const router = express.Router();
router.use(express.json());

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const db = new Database(path.join(__dirname, 'auth.db'));
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  verified INTEGER DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',
  otp_hash TEXT,
  otp_expires INTEGER,
  otp_attempts INTEGER DEFAULT 0
)`);
const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!userCols.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");

function normalizePhone(p) {
  p = String(p || '').replace(/[\s-]/g, '');
  if (p.startsWith('0')) p = '+251' + p.slice(1);
  else if (p.startsWith('251')) p = '+' + p;
  return /^\+251[79]\d{8}$/.test(p) ? p : null;
}
const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

// Replace with a real SMS provider (Africa's Talking, Twilio, AfroMessage...)
async function sendSms(phone, message) {
  console.log(`[SMS to ${phone}] ${message}`);
}

async function issueOtp(phone) {
  const otp = String(crypto.randomInt(100000, 1000000));
  db.prepare('UPDATE users SET otp_hash=?, otp_expires=?, otp_attempts=0 WHERE phone=?')
    .run(hashOtp(otp), Date.now() + 5 * 60 * 1000, phone);
  await sendSms(phone, `Your RentConnect verification code is ${otp}. It expires in 5 minutes.`);
  return otp;
}

const devOtp = (code) => (process.env.SHOW_OTP === 'true' ? code : undefined);
const makeToken = (u) => jwt.sign({ id: u.id, phone: u.phone }, SECRET, { expiresIn: '7d' });

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    req.auth = jwt.verify(token, SECRET);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please log in first.' });
  }
}

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT full_name, phone, role, verified FROM users WHERE id=?').get(req.auth.id);
  if (!user) return res.status(401).json({ error: 'Please log in first.' });
  res.json({ user: { fullName: user.full_name, phone: user.phone, role: user.verified ? user.role : 'user' } });
});

router.post('/register', async (req, res) => {
  const { fullName, phone, password, confirmPassword } = req.body;
  const p = normalizePhone(phone);
  if (!fullName || fullName.trim().length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  if (!p) return res.status(400).json({ error: 'Enter a valid phone number.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });

  const existing = db.prepare('SELECT * FROM users WHERE phone=?').get(p);
  if (existing && existing.verified) return res.status(409).json({ error: 'Phone number already registered.' });

  const hash = await bcrypt.hash(password, 10);
  if (existing) db.prepare('UPDATE users SET full_name=?, password_hash=? WHERE phone=?').run(fullName.trim(), hash, p);
  else db.prepare('INSERT INTO users (full_name, phone, password_hash) VALUES (?,?,?)').run(fullName.trim(), p, hash);

  const otpCode = await issueOtp(p);
  res.json({ message: 'OTP sent to your phone.', phone: p, devOtp: devOtp(otpCode) });
});

router.post('/verify-otp', (req, res) => {
  const p = normalizePhone(req.body.phone);
  const otp = String(req.body.otp || '');
  const u = p && db.prepare('SELECT * FROM users WHERE phone=?').get(p);
  if (!u || !u.otp_hash) return res.status(400).json({ error: 'No pending verification.' });
  if (u.otp_attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
  if (Date.now() > u.otp_expires) return res.status(400).json({ error: 'Code expired. Request a new one.' });
  if (hashOtp(otp) !== u.otp_hash) {
    db.prepare('UPDATE users SET otp_attempts=otp_attempts+1 WHERE id=?').run(u.id);
    return res.status(400).json({ error: 'Incorrect code.' });
  }
  db.prepare('UPDATE users SET verified=1, otp_hash=NULL, otp_expires=NULL WHERE id=?').run(u.id);
  const user = db.prepare('SELECT id, full_name, phone, role FROM users WHERE id=?').get(u.id);
  res.json({ message: 'Phone verified.', token: makeToken(user), user: { fullName: user.full_name, phone: user.phone, role: user.role } });
});

router.post('/resend-otp', async (req, res) => {
  const p = normalizePhone(req.body.phone);
  const u = p && db.prepare('SELECT * FROM users WHERE phone=?').get(p);
  if (!u || u.verified) return res.status(400).json({ error: 'Nothing to verify.' });
  const otpCode = await issueOtp(p);
  res.json({ message: 'New OTP sent.', devOtp: devOtp(otpCode) });
});

router.post('/login', async (req, res) => {
  const p = normalizePhone(req.body.phone);
  const u = p && db.prepare('SELECT * FROM users WHERE phone=?').get(p);
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash)))
    return res.status(401).json({ error: 'Incorrect phone number or password.' });
  if (!u.verified) return res.status(403).json({ error: 'Phone not verified. Please register again to get a code.' });
  res.json({ token: makeToken(u), user: { fullName: u.full_name, phone: u.phone, role: u.role } });
});

// ---- Forgot password: phone -> OTP -> new password ----
const RESET_SECRET = SECRET + ':reset';

router.post('/forgot-password', async (req, res) => {
  const p = normalizePhone(req.body.phone);
  if (!p) return res.status(400).json({ error: 'Enter a valid phone number.' });
  // same answer whether or not the number is registered
  const reply = { message: 'If this number is registered, a code has been sent.', phone: p };
  const u = db.prepare('SELECT * FROM users WHERE phone=? AND verified=1').get(p);
  if (!u) return res.json(reply);
  if (u.otp_expires && Date.now() - (u.otp_expires - 5 * 60 * 1000) < 30000)
    return res.status(429).json({ error: 'Please wait 30 seconds before asking for a new code.' });
  const code = await issueOtp(p);
  res.json(Object.assign(reply, { devOtp: devOtp(code) }));
});

router.post('/verify-reset-otp', (req, res) => {
  const p = normalizePhone(req.body.phone);
  const otp = String(req.body.otp || '');
  const u = p && db.prepare('SELECT * FROM users WHERE phone=? AND verified=1').get(p);
  const bad = () => res.status(400).json({ error: 'Incorrect or expired code.' });
  if (!u || !u.otp_hash || Date.now() > u.otp_expires) return bad();
  if (u.otp_attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
  if (hashOtp(otp) !== u.otp_hash) {
    db.prepare('UPDATE users SET otp_attempts=otp_attempts+1 WHERE id=?').run(u.id);
    return bad();
  }
  db.prepare('UPDATE users SET otp_hash=NULL, otp_expires=NULL, otp_attempts=0 WHERE id=?').run(u.id);
  const resetToken = jwt.sign({ id: u.id, purpose: 'reset', ph: u.password_hash.slice(-12) }, RESET_SECRET, { expiresIn: '10m' });
  res.json({ resetToken });
});

router.post('/reset-password', async (req, res) => {
  const { resetToken, password, confirmPassword } = req.body;
  const expired = () => res.status(400).json({ error: 'Reset session expired. Please start again.' });
  let t;
  try { t = jwt.verify(String(resetToken || ''), RESET_SECRET); } catch (e) { return expired(); }
  if (t.purpose !== 'reset') return expired();
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });
  const u = db.prepare('SELECT * FROM users WHERE id=? AND verified=1').get(t.id);
  if (!u || u.password_hash.slice(-12) !== t.ph) return expired();
  const hash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, u.id);
  res.json({ message: 'Password changed. You can log in now.' });
});
module.exports = router;
