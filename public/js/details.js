(function () {
  var css = [
    '#dtOverlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:16px;z-index:9999}',
    '#dtOverlay.open{display:flex}',
    '#dtBox{background:#fff;color:#111;border-radius:14px;width:100%;max-width:640px;max-height:92vh;overflow:auto;position:relative;font-family:system-ui,sans-serif}',
    '#dtBox img{width:100%;height:280px;object-fit:cover;border-radius:14px 14px 0 0;display:block;background:#e5e7eb}',
    '#dtClose{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;border-radius:50%;background:#fff;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 1px 6px #0004}',
    '#dtBody{padding:20px 22px 24px}',
    '#dtBody h2{margin:0 0 4px;font-size:22px}',
    '#dtType{display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:999px;padding:2px 10px;font-size:13px;margin-bottom:8px}',
    '#dtLoc{color:#555;margin:2px 0 10px}',
    '#dtPrice{font-size:24px;font-weight:700;color:#2563eb;margin:0 0 14px}',
    '#dtPrice small{font-size:14px;font-weight:400;color:#666}',
    '.dtStats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}',
    '.dtStats div{background:#f3f4f6;border-radius:10px;padding:10px;text-align:center;font-size:14px}',
    '.dtStats b{display:block;font-size:18px}',
    '.dtTags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}',
    '.dtTags span{border:1px solid #d1d5db;border-radius:999px;padding:3px 12px;font-size:13px}',
    '#dtDesc{white-space:pre-wrap;line-height:1.5;margin:0 0 16px}',
    '.dtContact{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.dtContact a{text-decoration:none;color:#fff;padding:11px 18px;border-radius:8px;font-size:15px}',
    '#dtCall{background:#2563eb}#dtWa{background:#16a34a}',
    '#dtNoContact{color:#666;font-size:14px}'
  ].join('');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.id = 'dtOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML =
    '<div id="dtBox">' +
      '<button id="dtClose" type="button" aria-label="Close">&times;</button>' +
      '<img id="dtImg" alt="">' +
      '<div id="dtBody">' +
        '<span id="dtType"></span>' +
        '<h2 id="dtTitle"></h2>' +
        '<p id="dtLoc"></p>' +
        '<p id="dtPrice"></p>' +
        '<div class="dtStats" id="dtStats"></div>' +
        '<div class="dtTags" id="dtTags"></div>' +
        '<p id="dtDesc"></p>' +
        '<div class="dtContact" id="dtContact"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  var $ = function (id) { return document.getElementById(id); };

  function plain(s) {
    return String(s == null ? '' : s);
  }

  function stat(value, label) {
    var d = document.createElement('div');
    var b = document.createElement('b');
    b.textContent = value;
    d.appendChild(b);
    d.appendChild(document.createTextNode(label));
    return d;
  }

  function intlPhone(raw) {
    var d = String(raw || '').replace(/[^\d]/g, '');
    if (d.indexOf('251') === 0) return d;
    if (d.indexOf('0') === 0) return '251' + d.slice(1);
    return d;
  }

  function open(p) {
    $('dtImg').src = p.image;
    $('dtImg').alt = plain(p.title);
    $('dtType').textContent = p.category || '';
    $('dtTitle').textContent = plain(p.title);
    $('dtLoc').textContent = plain(p.city) + ', ' + plain(p.area);
    $('dtPrice').textContent = 'ETB ' + Number(p.price).toLocaleString() + ' ';
    var sm = document.createElement('small');
    sm.textContent = '/ month';
    $('dtPrice').appendChild(sm);

    var stats = $('dtStats');
    stats.innerHTML = '';
    stats.appendChild(stat(p.beds, ' Bedrooms'));
    stats.appendChild(stat(p.baths, ' Bathrooms'));
    stats.appendChild(stat(p.size + ' m\u00B2', p.dims ? ' (' + p.dims.split('x').join(' m \u00D7 ') + ' m)' : ' Size'));

    var tags = $('dtTags');
    tags.innerHTML = '';
    (p.features || []).forEach(function (f) {
      var s = document.createElement('span');
      s.textContent = f;
      tags.appendChild(s);
    });

    $('dtDesc').textContent = p.description ? plain(p.description) : '';
    $('dtDesc').style.display = p.description ? 'block' : 'none';

    var c = $('dtContact');
    c.innerHTML = '';
    if (p.phone) {
      var num = intlPhone(p.phone);
      var call = document.createElement('a');
      call.id = 'dtCall';
      call.href = 'tel:+' + num;
      call.textContent = 'Call ' + p.phone;
      var wa = document.createElement('a');
      wa.id = 'dtWa';
      wa.href = 'https://wa.me/' + num;
      wa.target = '_blank';
      wa.rel = 'noopener noreferrer';
      wa.textContent = 'WhatsApp';
      c.appendChild(call);
      c.appendChild(wa);
    } else {
      var n = document.createElement('span');
      n.id = 'dtNoContact';
      n.textContent = 'Contact details are not available for this sample listing.';
      c.appendChild(n);
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('dtClose').focus();
  }

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function findProperty(card) {
    if (typeof properties === 'undefined') return null;
    var h3 = card.querySelector('h3');
    var imgEl = card.querySelector('img');
    var title = h3 ? h3.textContent.trim() : '';
    var src = imgEl ? imgEl.getAttribute('src') : '';
    var addr = card.querySelector('.address') ? card.querySelector('.address').textContent : '';

    var same = properties.filter(function (p) { return plain(p.title) === title; });
    if (same.length <= 1) return same[0] || null;
    var narrowed = same.filter(function (p) {
      return p.image === src && addr.indexOf(plain(p.area)) !== -1 && addr.indexOf(plain(p.city)) !== -1;
    });
    return narrowed[0] || same[0];
  }

  // capture phase: runs before the inline alert() onclick
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.property-card .btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var p = findProperty(btn.closest('.property-card'));
    if (p) open(p);
  }, true);

  $('dtClose').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
