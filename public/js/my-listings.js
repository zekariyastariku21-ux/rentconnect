const $ = (id) => document.getElementById(id);
const token = localStorage.getItem('token');
if (!token) location.href = 'login.html?next=my-listings.html';
const auth = { Authorization: 'Bearer ' + token };
const show = (m, ok = false) => { const el = $('msg'); el.textContent = m; el.style.color = ok ? 'green' : 'crimson'; };

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

async function setStatus(l, status) {
  const asks = {
    rented: { type: 'warning', title: 'Mark as rented?', message: 'This property will be removed from the public list. You can list it again anytime from My listings.', item: l.title, confirmText: 'Yes, mark as rented', cancelText: 'Cancel' },
    active: { type: 'success', title: 'List this property again?', message: 'It will appear on the public homepage again right away.', item: l.title, confirmText: 'Yes, list again', cancelText: 'Cancel' }
  };
  if (!(await proConfirm(asks[status]))) return;
  try {
    const r = await fetch('/api/listings/' + l.id + '/status', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, auth),
      body: JSON.stringify({ status })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Something went wrong');
    show(j.message, true);
    load();
  } catch (err) { show(err.message); }
}

function render(items) {
  const box = $('list');
  box.innerHTML = '';
  if (!items.length) {
    const p = el('p', "You haven't listed any property yet. ");
    const a = el('a', 'List your first property');
    a.href = 'list-property.html';
    p.appendChild(a);
    box.appendChild(p);
    return;
  }
  items.forEach(function (l) {
    const row = el('div', null, 'item' + (l.status === 'rented' ? ' isRented' : ''));
    if (l.image) { const img = el('img'); img.src = l.image; img.alt = ''; row.appendChild(img); }
    else row.appendChild(el('div', null, 'noimg'));

    const info = el('div', null, 'info');
    const h = el('h3', l.title);
    h.appendChild(el('span', l.status === 'rented' ? 'Rented' : 'Active', 'badge ' + l.status));
    info.appendChild(h);
    info.appendChild(el('p', l.area + ', ' + l.city + ' \u2022 ' + l.category));
    info.appendChild(el('p', 'ETB ' + Number(l.price).toLocaleString() + ' / month \u2022 ' + l.beds + ' beds \u2022 ' + l.baths + ' baths'));

    const actions = el('div', null, 'actions');
    const edit = el('a', 'Edit', 'edit');
    edit.href = 'list-property.html?edit=' + l.id;
    edit.onclick = async function (ev) {
      ev.preventDefault();
      const yes = await proConfirm({ type: 'info', title: 'Edit this listing?', message: 'You will open the edit form for this property.', item: l.title, confirmText: 'Yes, edit', cancelText: 'Cancel' });
      if (yes) location.href = 'list-property.html?edit=' + l.id;
    };
    actions.appendChild(edit);
    if (l.status === 'rented') {
      const b = el('button', 'List again', 'relist');
      b.type = 'button';
      b.onclick = function () { setStatus(l, 'active'); };
      actions.appendChild(b);
    } else {
      const b = el('button', 'Mark as rented', 'rent');
      b.type = 'button';
      b.onclick = function () { setStatus(l, 'rented'); };
      actions.appendChild(b);
    }
    info.appendChild(actions);
    row.appendChild(info);
    box.appendChild(row);
  });
}

async function load() {
  try {
    const r = await fetch('/api/listings/mine', { headers: auth });
    if (r.status === 401) {
      localStorage.removeItem('token'); localStorage.removeItem('user');
      location.href = 'login.html?next=my-listings.html';
      return;
    }
    if (!r.ok) throw new Error('Could not load your listings.');
    render(await r.json());
  } catch (err) { $('list').textContent = ''; show(err.message); }
}
load();


