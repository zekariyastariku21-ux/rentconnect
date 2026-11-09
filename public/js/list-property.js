const $ = (id) => document.getElementById(id);
const token = localStorage.getItem('token');
const editId = new URLSearchParams(location.search).get('edit');
const isEdit = /^\d+$/.test(editId || '');
if (!token) location.href = 'login.html?next=' + (isEdit ? 'my-listings.html' : 'list-property.html');

const show = (m, ok = false) => { const el = $('msg'); el.textContent = m; el.style.color = ok ? 'green' : 'crimson'; };
const submitButton = $('submitBtn');
submitButton.disabled = true;
const categoriesReady = (async () => {
  try {
    const response = await fetch('/api/categories');
    const categories = await response.json();
    if (!response.ok) throw new Error(categories.error || 'Could not load property categories.');
    if (!Array.isArray(categories) || categories.some(category => typeof category.name !== 'string')) {
      throw new TypeError('The categories response has an invalid format.');
    }
    categories.forEach(category => $('category').add(new Option(category.name, category.name)));
    submitButton.disabled = false;
    return true;
  } catch (error) {
    show(error.message);
    console.error('Could not load property categories:', error);
    return false;
  }
})();

function resizeImage(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = url;
  });
}

if (isEdit) {
  document.querySelector('h2').textContent = 'Edit your property';
  $('submitBtn').textContent = 'Save changes';
  $('photo').previousElementSibling.textContent = 'Photo (leave empty to keep the current one)';
  (async () => {
    try {
      if (!await categoriesReady) return;
      const r = await fetch('/api/listings/mine', { headers: { Authorization: 'Bearer ' + token } });
      if (r.status === 401) { location.href = 'login.html?next=my-listings.html'; return; }
      const l = (await r.json()).find(x => x.id === Number(editId));
      if (!l) { show('Listing not found.'); $('submitBtn').disabled = true; return; }
      $('title').value = l.title; $('category').value = l.category;
      $('city').value = l.city; $('area').value = l.area; $('price').value = l.price;
      $('beds').value = l.beds; $('baths').value = l.baths; $('size').value = l.dims ? l.dims.replace('x', ' x ') : l.size;
      $('description').value = l.description || ''; $('phone').value = l.phone;
      document.querySelectorAll('#feats input').forEach(i => { i.checked = l.features.includes(i.value); });
      if (l.image) { $('preview').src = l.image; $('preview').style.display = 'block'; }
    } catch (e) { show('Could not load the listing.'); }
  })();
}

$('photo').addEventListener('change', async () => {
  const f = $('photo').files[0];
  if (!f) return;
  try {
    $('preview').src = await resizeImage(f);
    $('preview').style.display = 'block';
  } catch (err) { show(err.message); }
});

$('listForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('submitBtn').disabled = true;
  show('');
  try {
    const f = $('photo').files[0];
    const payload = {
      title: $('title').value, category: $('category').value,
      city: $('city').value, area: $('area').value, price: $('price').value,
      beds: $('beds').value, baths: $('baths').value, size: $('size').value,
      features: [...document.querySelectorAll('#feats input:checked')].map(i => i.value),
      description: $('description').value, phone: $('phone').value,
      image: f ? await resizeImage(f) : null
    };
    const r = await fetch(isEdit ? '/api/listings/' + editId : '/api/listings', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) {
      localStorage.removeItem('token'); localStorage.removeItem('user');
      location.href = 'login.html?next=' + (isEdit ? 'my-listings.html' : 'list-property.html');
      return;
    }
    if (!r.ok) throw new Error(j.error || 'Something went wrong');
    show(isEdit ? j.message : 'Saved. Now pay to publish your listing.', true);
    setTimeout(() => { location.href = 'my-listings.html'; }, 1000);
  } catch (err) {
    show(err.message);
    $('submitBtn').disabled = false;
  }
});

// live area preview for sizes like 4x3
function sizeFromText(v) {
  const s = String(v).toLowerCase().replace(/[x\u00D7*]/g, 'x').replace(/\s/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?))?$/);
  return m ? Math.round(Number(m[1]) * (m[2] ? Number(m[2]) : 1)) : null;
}
$('size').addEventListener('input', () => {
  const raw = $('size').value.trim();
  const n = sizeFromText(raw);
  $('sizeHint').textContent = !raw ? '' : (n ? (/[x\u00D7*]/i.test(raw) ? ' = ' + n + ' m\u00B2' : '') : ' Use a number like 120 or 4x3');
});


// clearer preview: "4 m long x 3 m wide = 12 m2"
$('size').addEventListener('input', () => {
  const s = $('size').value.toLowerCase().replace(/[x\u00D7*]/g, 'x').replace(/\s/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (m) $('sizeHint').textContent = ' ' + Number(m[1]) + ' m long \u00D7 ' + Number(m[2]) + ' m wide = ' + Math.round(m[1] * m[2]) + ' m\u00B2';
});

