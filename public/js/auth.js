const $ = (id) => document.getElementById(id);
const show = (m, ok = false) => { const el = $('msg'); el.textContent = m; el.style.color = ok ? 'green' : 'crimson'; };
const post = async (url, data) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j;
};
const saveSession = (j) => { localStorage.setItem('token', j.token); localStorage.setItem('user', JSON.stringify(j.user)); };
let pendingPhone = null;

$('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const j = await post('/api/auth/register', {
      fullName: $('fullName').value, phone: $('phone').value,
      password: $('password').value, confirmPassword: $('confirmPassword').value
    });
    pendingPhone = j.phone;
    $('registerForm').style.display = 'none';
    $('otpSection').style.display = 'block';
    show(j.message + (j.devOtp ? ' | TEST CODE: ' + j.devOtp : ''), true);
  } catch (err) { show(err.message); }
});

$('verifyBtn')?.addEventListener('click', async () => {
  try {
    const j = await post('/api/auth/verify-otp', { phone: pendingPhone, otp: $('otp').value });
    saveSession(j);
    const nextPage = new URLSearchParams(location.search).get('next'); window.location.href = /^[\w-]+\.html$/.test(nextPage || '') ? nextPage : '/index.html';
  } catch (err) { show(err.message); }
});

$('resendBtn')?.addEventListener('click', async () => {
  try { const j = await post('/api/auth/resend-otp', { phone: pendingPhone }); show(j.message + (j.devOtp ? ' | TEST CODE: ' + j.devOtp : ''), true); }
  catch (err) { show(err.message); }
});

$('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const j = await post('/api/auth/login', { phone: $('phone').value, password: $('password').value });
    saveSession(j);
    const nextPage = new URLSearchParams(location.search).get('next'); window.location.href = /^[\w-]+\.html$/.test(nextPage || '') ? nextPage : '/index.html';
  } catch (err) { show(err.message); }
});


