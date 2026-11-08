(function () {
  var loginBtn = document.getElementById('loginBtn');
  var registerBtn = document.getElementById('registerBtn');
  if (!loginBtn || !registerBtn) return;

  var user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch (e) {}
  if (!user || !user.fullName || !localStorage.getItem('token')) return;

  var css = [
    '.umWrap{position:relative;display:inline-block;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.umBtn{display:flex;align-items:center;gap:10px;padding:5px 12px 5px 5px;border-radius:999px;border:1px solid #d1d5db;background:#fff;color:#0f172a;cursor:pointer;font:600 14px system-ui,-apple-system,"Segoe UI",sans-serif;transition:box-shadow .15s ease,border-color .15s ease}',
    '.umBtn:hover{border-color:#94a3b8;box-shadow:0 2px 8px rgba(15,23,42,.1)}',
    '.umBtn:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}',
    '.umAvatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex:none}',
    '.umName{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.umChev{width:16px;height:16px;color:#64748b;transition:transform .2s ease;flex:none}',
    '.umWrap.open .umChev{transform:rotate(180deg)}',
    '.umMenu{position:absolute;right:0;top:calc(100% + 10px);min-width:240px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 18px 45px rgba(15,23,42,.18);padding:8px;opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .15s ease,transform .15s ease,visibility .15s;z-index:1000}',
    '.umWrap.open .umMenu{opacity:1;visibility:visible;transform:none}',
    '.umHead{display:flex;align-items:center;gap:10px;padding:8px 10px 12px;border-bottom:1px solid #e2e8f0;margin-bottom:6px}',
    '.umHead .umAvatar{width:40px;height:40px;font-size:17px}',
    '.umHead div{min-width:0}',
    '.umHead b{display:block;font-size:15px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.umHead span{font-size:13px;color:#64748b}',
    '.umItem{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;border-radius:9px;background:none;color:#1e293b;text-decoration:none;font:500 14px system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left;cursor:pointer;box-sizing:border-box}',
    '.umItem:hover,.umItem:focus-visible{background:#f1f5f9;outline:none}',
    '.umItem svg{width:18px;height:18px;color:#64748b;flex:none}',
    '.umSep{height:1px;background:#e2e8f0;margin:6px 0}',
    '.umItem.danger,.umItem.danger svg{color:#dc2626}',
    '.umItem.danger:hover,.umItem.danger:focus-visible{background:#fef2f2}',
    '@media(max-width:480px){.umName{display:none}.umBtn{padding-right:8px}}'
  ].join('');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  var ICON = {
    chev: S + '<path d="m6 9 6 6 6-6"/></svg>',
    list: S + '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>',
    plus: S + '<circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>',
    out: S + '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>'
  };

  var fullName = String(user.fullName).trim();
  var firstName = fullName.split(/\s+/)[0];
  var initial = fullName.charAt(0).toUpperCase();

  function avatar() {
    var a = document.createElement('span');
    a.className = 'umAvatar';
    a.textContent = initial;
    return a;
  }

  function item(tag, label, icon, cls) {
    var el = document.createElement(tag);
    el.className = 'umItem' + (cls ? ' ' + cls : '');
    el.setAttribute('role', 'menuitem');
    el.innerHTML = icon;
    el.appendChild(document.createTextNode(label));
    return el;
  }

  var wrap = document.createElement('div');
  wrap.className = 'umWrap';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'umBtn';
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.appendChild(avatar());
  var nm = document.createElement('span');
  nm.className = 'umName';
  nm.textContent = firstName;
  btn.appendChild(nm);
  btn.insertAdjacentHTML('beforeend', '<span class="umChev">' + ICON.chev + '</span>');

  var menu = document.createElement('div');
  menu.className = 'umMenu';
  menu.setAttribute('role', 'menu');

  var head = document.createElement('div');
  head.className = 'umHead';
  head.appendChild(avatar());
  var who = document.createElement('div');
  var b = document.createElement('b');
  b.textContent = fullName;
  var ph = document.createElement('span');
  ph.textContent = user.phone || '';
  who.appendChild(b);
  who.appendChild(ph);
  head.appendChild(who);
  menu.appendChild(head);

  var mine = item('a', 'My listings', ICON.list);
  mine.href = 'my-listings.html';
  var add = item('a', 'List a property', ICON.plus);
  add.href = 'list-property.html';
  var sep = document.createElement('div');
  sep.className = 'umSep';
  var out = item('button', 'Log out', ICON.out, 'danger');
  out.type = 'button';
  out.addEventListener('click', function () {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.reload();
  });
  menu.appendChild(mine);
  menu.appendChild(add);
  menu.appendChild(sep);
  menu.appendChild(out);

  wrap.appendChild(btn);
  wrap.appendChild(menu);

  function setOpen(o) {
    wrap.classList.toggle('open', o);
    btn.setAttribute('aria-expanded', o ? 'true' : 'false');
  }
  btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!wrap.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(false); btn.focus(); } });

  loginBtn.replaceWith(wrap);
  registerBtn.remove();
})();
