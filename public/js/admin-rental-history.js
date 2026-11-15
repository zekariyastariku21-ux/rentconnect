(function () {
  var ENDPOINT = '/api/admin/rental-history';
  var rows = [], loading = false;

  var css = document.createElement('style');
  css.textContent =
    '.rh-panel{margin-top:28px}' +
    '.rh-panel h2{margin:0 0 4px}.rh-sub{margin:0 0 14px;opacity:.7}' +
    '.rh-stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px}' +
    '.rh-stat{border:1px solid rgba(128,128,128,.3);border-radius:10px;padding:10px 16px;min-width:130px}' +
    '.rh-stat b{display:block;font-size:22px}.rh-stat span{font-size:12px;opacity:.7}' +
    '.rh-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}' +
    '.rh-bar input,.rh-bar select{padding:8px 10px;border:1px solid rgba(128,128,128,.4);border-radius:8px;background:transparent;color:inherit;font:inherit}' +
    '.rh-bar input{flex:1;min-width:180px}' +
    '.rh-scroll{overflow-x:auto}.rh-panel table{width:100%;border-collapse:collapse;font-size:14px}' +
    '.rh-panel th,.rh-panel td{text-align:left;padding:9px 10px;border-bottom:1px solid rgba(128,128,128,.25);white-space:nowrap}' +
    '.rh-panel th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;opacity:.7}' +
    '.rh-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}' +
    '.rh-badge.rented{background:rgba(217,119,6,.18);color:#b45309}' +
    '.rh-badge.relisted{background:rgba(10,125,59,.18);color:#0a7d3b}' +
    '.rh-empty{padding:22px;text-align:center;opacity:.7}';
  document.head.appendChild(css);

  function findToken() {
    var stores = [localStorage, sessionStorage];
    for (var s = 0; s < stores.length; s++) {
      for (var i = 0; i < stores[s].length; i++) {
        var v = stores[s].getItem(stores[s].key(i)) || '';
        try { var j = JSON.parse(v); if (j && typeof j === 'object') v = j.token || j.accessToken || v; } catch (e) {}
        if (typeof v === 'string' && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)) return v;
      }
    }
    return '';
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function stat(id, label) {
    var d = el('div', 'rh-stat'), b = el('b', '', '0'); b.id = id;
    d.appendChild(b); d.appendChild(el('span', '', label)); return d;
  }
  function build() {
    var p = el('div', 'rh-panel'); p.id = 'rentalHistoryPanel';
    p.appendChild(el('h2', '', 'Rental history'));
    p.appendChild(el('p', 'rh-sub', 'Every time a listing was marked rented or put back on the market.'));
    var stats = el('div', 'rh-stats');
    stats.appendChild(stat('rhRented', 'Times rented'));
    stats.appendChild(stat('rhRelisted', 'Times relisted'));
    stats.appendChild(stat('rhListings', 'Listings involved'));
    p.appendChild(stats);
    var bar = el('div', 'rh-bar');
    var q = el('input'); q.id = 'rhQ'; q.placeholder = 'Search title or owner…';
    var ev = el('select'); ev.id = 'rhEv';
    [['', 'All events'], ['rented', 'Rented'], ['relisted', 'Relisted']].forEach(function (o) {
      var op = el('option', '', o[1]); op.value = o[0]; ev.appendChild(op);
    });
    q.oninput = render; ev.onchange = render;
    bar.appendChild(q); bar.appendChild(ev); p.appendChild(bar);
    var wrap = el('div', 'rh-scroll'), t = el('table');
    var head = el('thead'), hr = el('tr');
    ['Date', 'Event', 'Listing', 'Owner', 'Phone', 'Price (ETB)', 'Status now'].forEach(function (h) { hr.appendChild(el('th', '', h)); });
    head.appendChild(hr); t.appendChild(head);
    var body = el('tbody'); body.id = 'rhBody'; t.appendChild(body);
    wrap.appendChild(t); p.appendChild(wrap);
    return p;
  }
  function cell(tr, text, badge) {
    var td = el('td');
    if (badge) td.appendChild(el('span', 'rh-badge ' + badge, text)); else td.textContent = text;
    tr.appendChild(td);
  }
  function render() {
    var body = document.getElementById('rhBody'); if (!body) return;
    var q = (document.getElementById('rhQ').value || '').trim().toLowerCase();
    var ev = document.getElementById('rhEv').value;
    var list = rows.filter(function (r) {
      return (!ev || r.event === ev) && (!q || ((r.title || '') + ' ' + (r.owner || '')).toLowerCase().indexOf(q) !== -1);
    });
    body.innerHTML = '';
    if (!list.length) {
      var tr0 = el('tr'), td0 = el('td', 'rh-empty', 'No rental history found.'); td0.colSpan = 7;
      tr0.appendChild(td0); body.appendChild(tr0); return;
    }
    list.forEach(function (r) {
      var tr = el('tr');
      cell(tr, new Date(r.changedAt).toLocaleString());
      cell(tr, r.event === 'rented' ? 'Rented' : 'Relisted', r.event);
      cell(tr, r.title || ('Listing #' + r.listingId));
      cell(tr, r.owner || '-');
      cell(tr, r.ownerPhone || '-');
      cell(tr, r.price != null ? Number(r.price).toLocaleString() : '-');
      cell(tr, r.currentStatus || 'deleted');
      body.appendChild(tr);
    });
  }
  function load() {
    if (loading) return; loading = true;
    fetch(ENDPOINT, { headers: { Authorization: 'Bearer ' + findToken() } })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok) throw new Error(x.d.error || 'Request failed');
        rows = x.d.rows;
        document.getElementById('rhRented').textContent = x.d.totals.rented;
        document.getElementById('rhRelisted').textContent = x.d.totals.relisted;
        document.getElementById('rhListings').textContent = x.d.totals.listings;
        render();
      })
      .catch(function (e) {
        var body = document.getElementById('rhBody'); if (!body) return;
        body.innerHTML = '';
        var tr = el('tr'), td = el('td', 'rh-empty', 'Could not load rental history (' + e.message + ')'); td.colSpan = 7;
        tr.appendChild(td); body.appendChild(tr);
      })
      .then(function () { loading = false; });
  }
  function place() {
    if (document.getElementById('rentalhistory')) return;
    var main = document.querySelector('.admin-main');
    if (!main) return;
    var sec = el('section', 'rented-card');
    sec.id = 'rentalhistory';
    sec.appendChild(build());
    main.appendChild(sec);

    // hidden sidebar link: admin-modules.js builds its module cards from these links
    var nav = document.querySelector('.side-nav');
    if (nav && !nav.querySelector('a[href="#rentalhistory"]')) {
      var a = document.createElement('a');
      a.href = '#rentalhistory';
      a.textContent = 'Rental history';
      a.style.display = 'none';
      nav.appendChild(a);
    }
    load();
  }
  place();
})();