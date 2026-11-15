// lib/paymentSettings.js
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'payment-settings.json');
const OPS = ['lt', 'lte', 'gt', 'gte'];

function readFile() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

function cleanTiers(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((t) => ({
      op: String(t && t.op),
      value: Number(t && t.value),
      type: t && t.type === 'percent' ? 'percent' : 'fixed',
      fee: Number(t && t.fee)
    }))
    .filter((t) => OPS.includes(t.op) && Number.isFinite(t.value) && t.value >= 0 &&
      Number.isFinite(t.fee) && t.fee > 0 && (t.type === 'fixed' || t.fee <= 100))
    .slice(0, 20);
}

// Saved admin values win; .env is the fallback
function get() {
  const s = readFile();
  return {
    chapaSecretKey: s.chapaSecretKey || process.env.CHAPA_SECRET_KEY || '',
    chapaWebhookSecret: s.chapaWebhookSecret || process.env.CHAPA_WEBHOOK_SECRET || '',
    chapaEnabled: s.chapaEnabled !== undefined ? !!s.chapaEnabled : true,
    listingFee: s.listingFee || process.env.LISTING_FEE || '',
    baseUrl: s.baseUrl || process.env.BASE_URL || '',
    fakePay: s.fakePay !== undefined ? !!s.fakePay : process.env.DEV_FAKE_PAY === 'true',
    feeTiers: cleanTiers(s.feeTiers)
  };
}

function save(patch) {
  const cur = readFile();
  const next = { ...cur };
  for (const k of ['chapaSecretKey', 'chapaWebhookSecret']) {
    if (patch[k] && patch[k].trim()) next[k] = patch[k].trim();
  }
  if (patch.chapaEnabled !== undefined) next.chapaEnabled = !!patch.chapaEnabled;
  if (patch.listingFee !== undefined) next.listingFee = String(patch.listingFee).trim();
  if (patch.baseUrl !== undefined) next.baseUrl = String(patch.baseUrl).trim().replace(/\/+$/, '');
  if (patch.fakePay !== undefined) next.fakePay = !!patch.fakePay;
  if (patch.feeTiers !== undefined) next.feeTiers = cleanTiers(patch.feeTiers);
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
}

// Fee for a listing price: first matching rule wins, else the default fee
function feeFor(price) {
  const s = get();
  const base = Number(s.listingFee) || 100;
  const p = Number(price);
  if (!Number.isFinite(p)) return base;
  for (const t of s.feeTiers) {
    const hit = t.op === 'lt' ? p < t.value : t.op === 'lte' ? p <= t.value : t.op === 'gt' ? p > t.value : p >= t.value;
    if (hit) {
      const f = t.type === 'percent' ? (p * t.fee) / 100 : t.fee;
      return Math.max(1, Math.round(f * 100) / 100);
    }
  }
  return base;
}

function mask(v) {
  if (!v) return '(not set)';
  return v.slice(0, 10) + '••••••••' + v.slice(-4);
}

module.exports = { get, save, mask, feeFor };
