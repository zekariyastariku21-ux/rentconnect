// lib/telebirr.js - settings, RSA signing and Telebirr API calls
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FILE = path.join(__dirname, '..', 'data', 'telebirr-settings.json');
const TEXT = ['apiBase', 'webBase', 'fabricAppId', 'merchantAppId', 'merchantCode', 'shortCode'];
const KEYS = ['appSecret', 'privateKey', 'publicKey'];
const PSS = { padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST };

function norm(s) { return String(s).replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u200B-\u200D\uFEFF\s]/g, ''); }
function readFile() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}
function get() {
  const s = readFile(), o = { enabled: !!s.enabled };
  TEXT.concat(KEYS).forEach((k) => { o[k] = s[k] || ''; });
  return o;
}
function pem(raw, kind) {
  const s = String(raw || '').trim().replace(/\\n/g, '\n');
  if (!s || s.includes('-----BEGIN')) return s;
  const label = kind === 'private' ? 'PRIVATE KEY' : 'PUBLIC KEY';
  return '-----BEGIN ' + label + '-----\n' + s.replace(/\s+/g, '').match(/.{1,64}/g).join('\n') + '\n-----END ' + label + '-----';
}
function privateKey(p) {
  try { return crypto.createPrivateKey(p); } catch (e) {
    return crypto.createPrivateKey(p.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '-----$1 RSA PRIVATE KEY-----'));
  }
}
function save(patch) {
  const cur = readFile(), next = { ...cur };
  TEXT.forEach((k) => {
    if (patch[k] === undefined) return;
    let v = norm(patch[k]);
    if (k === 'apiBase') v = v.replace(/\/+$/, '');
    if ((k === 'apiBase' || k === 'webBase') && v && !/^https?:\/\//i.test(v)) throw new Error('URLs must start with http:// or https://');
    next[k] = v;
  });
  if (patch.appSecret && patch.appSecret.trim()) next.appSecret = norm(patch.appSecret);
  if (patch.privateKey && patch.privateKey.trim()) {
    const p = pem(patch.privateKey, 'private');
    try { privateKey(p); } catch (e) { throw new Error('Private key could not be read. Paste the PKCS#8 key from your merchant files.'); }
    next.privateKey = p;
  }
  if (patch.publicKey && patch.publicKey.trim()) {
    const p = pem(patch.publicKey, 'public');
    try { crypto.createPublicKey(p); } catch (e) { throw new Error('Telebirr public key could not be read.'); }
    next.publicKey = p;
  }
  if (patch.enabled !== undefined) next.enabled = !!patch.enabled;
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
}
function publicView() {
  const c = get();
  return {
    enabled: c.enabled, apiBase: c.apiBase, webBase: c.webBase, fabricAppId: c.fabricAppId,
    merchantAppId: c.merchantAppId, merchantCode: c.merchantCode, shortCode: c.shortCode,
    appSecretSet: !!c.appSecret, privateKeySet: !!c.privateKey, publicKeySet: !!c.publicKey
  };
}
function ready() {
  const c = get();
  return !!(c.enabled && c.apiBase && c.webBase && c.fabricAppId && c.appSecret && c.merchantAppId && c.merchantCode && c.privateKey);
}
function need(c, names) {
  const miss = names.filter((n) => !c[n]);
  if (miss.length) throw new Error('Telebirr settings missing: ' + miss.join(', '));
}

// ---- signing ----
function signString(obj) {
  const skip = new Set(['sign', 'sign_type', 'header', 'refund_info', 'openType', 'raw_request', 'biz_content']);
  const flat = {};
  const add = (k, v) => { if (v !== undefined && v !== null && v !== '') flat[k] = v; };
  Object.keys(obj).forEach((k) => { if (!skip.has(k)) add(k, obj[k]); });
  if (obj.biz_content) Object.keys(obj.biz_content).forEach((k) => add(k, obj.biz_content[k]));
  return Object.keys(flat).sort().map((k) => k + '=' + flat[k]).join('&');
}
function sign(obj) {
  return crypto.sign('sha256', Buffer.from(signString(obj)), { key: privateKey(get().privateKey), ...PSS }).toString('base64');
}
function verify(obj) {
  const c = get();
  if (!c.publicKey || !obj || !obj.sign) return false;
  try {
    return crypto.verify('sha256', Buffer.from(signString(obj)), { key: crypto.createPublicKey(c.publicKey), ...PSS }, Buffer.from(obj.sign, 'base64'));
  } catch (e) { return false; }
}

// ---- API ----
const ts = () => String(Math.floor(Date.now() / 1000));
const nonce = () => crypto.randomBytes(16).toString('hex');
async function post(url, headers, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j: j || {} };
}
const errText = (j, status) => (j.msg || j.errorMsg || j.message || j.error_description || ('Telebirr request failed (' + status + ')'));

async function fabricToken() {
  const c = get();
  need(c, ['apiBase', 'fabricAppId', 'appSecret']);
  const { status, j } = await post(c.apiBase + '/payment/v1/token', { 'X-APP-Key': c.fabricAppId }, { appSecret: c.appSecret });
  if (!j.token) throw new Error(errText(j, status));
  return j.token;
}
async function createOrder(o) {
  const c = get();
  need(c, ['apiBase', 'webBase', 'fabricAppId', 'appSecret', 'merchantAppId', 'merchantCode', 'privateKey']);
  const token = await fabricToken();
  const body = {
    timestamp: ts(), nonce_str: nonce(), method: 'payment.preorder', version: '1.0',
    biz_content: {
      notify_url: o.notifyUrl, appid: c.merchantAppId, merch_code: c.merchantCode, merch_order_id: o.orderId,
      trade_type: 'Checkout', title: o.title, total_amount: String(o.amount), trans_currency: 'ETB',
      timeout_express: '120m', business_type: 'BuyGoods',
      payee_identifier: c.shortCode || c.merchantCode, payee_identifier_type: '04', payee_type: '5000',
      redirect_url: o.redirectUrl
    }
  };
  body.sign = sign(body);
  body.sign_type = 'SHA256WithRSA';
  const { status, j } = await post(c.apiBase + '/payment/v1/merchant/preOrder', { 'X-APP-Key': c.fabricAppId, Authorization: token }, body);
  const prepay = j.biz_content && j.biz_content.prepay_id;
  if (!prepay) throw new Error(errText(j, status));
  const raw = { appid: c.merchantAppId, merch_code: c.merchantCode, nonce_str: nonce(), prepay_id: prepay, timestamp: ts() };
  const qs = Object.keys(raw).sort().map((k) => k + '=' + raw[k]).join('&');
  const url = c.webBase + (c.webBase.includes('?') ? (/[?&]$/.test(c.webBase) ? '' : '&') : '?') + qs +
    '&sign=' + encodeURIComponent(sign(raw)) + '&sign_type=SHA256WithRSA&version=1.0&trade_type=Checkout';
  return { checkoutUrl: url, prepayId: prepay };
}
async function queryOrder(orderId) {
  const c = get();
  need(c, ['apiBase', 'fabricAppId', 'appSecret', 'merchantAppId', 'merchantCode', 'privateKey']);
  const token = await fabricToken();
  const body = {
    timestamp: ts(), nonce_str: nonce(), method: 'payment.queryorder', version: '1.0',
    biz_content: { appid: c.merchantAppId, merch_code: c.merchantCode, merch_order_id: orderId }
  };
  body.sign = sign(body);
  body.sign_type = 'SHA256WithRSA';
  const { status, j } = await post(c.apiBase + '/payment/v1/merchant/queryOrder', { 'X-APP-Key': c.fabricAppId, Authorization: token }, body);
  const bc = j.biz_content || {};
  const st = String(bc.order_status || bc.trade_status || '').toUpperCase();
  const paid = st === 'PAY_SUCCESS' || st === 'COMPLETED';
  if (!paid) console.log('Telebirr queryOrder', orderId, 'status:', st || '(none)', 'http:', status, 'msg:', j.msg || '');
  return { paid, amount: Number(bc.total_amount), currency: bc.trans_currency || '' };
}

module.exports = { get, save, publicView, ready, verify, fabricToken, createOrder, queryOrder };