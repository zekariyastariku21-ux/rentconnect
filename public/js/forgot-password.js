const $ = (id) => document.getElementById(id);
const show = (m, ok = false) => { const el = $('msg'); el.textContent = m; el.style.color = ok ? 'green' : 'crimson'; };
const post = async (url, data) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j;
};
const withCode = (j) => j.message + (j.devOtp ? ' | TEST CODE: ' + j.devOtp : '');
const step = (n) => { [1, 2, 3].forEach((i) => { $('step' + i).style.display = i === n ? 'block' : 'none'; }); };

let phone = null;
let resetToken = null;

$('phoneForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const j = await post('/api/auth/forgot-password', { phone: $('phone').value });
    phone = j.phone;
    step(2);
    show(withCode(j), true);
    $('otp').focus();
  } catch (err) { show(err.message); }
});

$('verifyBtn').addEventListener('click', async () => {
  try {
    const j = await post('/api/auth/verify-reset-otp', { phone, otp: $('otp').value });
    resetToken = j.resetToken;
    step(3);
    show('Phone verified. Choose your new password.', true);
    $('password').focus();
  } catch (err) { show(err.message); }
});

$('resendBtn').addEventListener('click', async () => {
  try {
    const j = await post('/api/auth/forgot-password', { phone });
    show(withCode(j), true);
  } catch (err) { show(err.message); }
});

$('newPassForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const j = await post('/api/auth/reset-password', {
      resetToken, password: $('password').value, confirmPassword: $('confirmPassword').value
    });
    show(j.message + ' Taking you to login...', true);
    setTimeout(() => { location.href = 'login.html'; }, 1500);
  } catch (err) {
    show(err.message);
    if (/expired/i.test(err.message)) setTimeout(() => step(1), 1500);
  }
});
