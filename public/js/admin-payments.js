(function () {
  var ENDPOINT = '/api/admin/payments';

  var main = document.querySelector('.admin-main');
  if (!main) return;

  var sec = document.createElement('section');
  sec.id = 'payments';
  sec.className = 'rented-card';
  sec.innerHTML =
    '<div class="rented-head"><div><h2>Payments</h2>' +
    '<p class="rented-sub" id="paySummary">Loading...</p></div>' +
    '<button type="button" class="rented-btn" id="payCsv">Export CSV</button></div>' +
    '<div class="rented-tools">' +
    '<input type="search" id="paySearch" placeholder="Search owner, phone, property, reference...">' +
    '<select id="payStatus"><option value="">All statuses</option></select>' +
    '<select id="payKind"><option value="">All types</option>' +
    '<option value="publish">Publish</option><option value="relist">List again</option></select>' +
    '<select id="paySort">' +
    '<option value="new">Newest first</option>' +
    '<option value="high">Amount: high to low</option>' +
    '<option value="low">Amount: low to high</option></select></div>' +
    '<div class="rented-wrap"><table class="rented-table"><thead><tr>' +
    '<th>Date</th><th>Owner</th><th>Phone</th><th>Property</th><th>Type</th><th>Amount</th><th>Status</th><th>Reference</th>' +
    '</tr></thead><tbody id="payBody"></tbody></table></div>';
  main.appendChild(sec);

  var nav = document.querySelector('.side-nav');
  if (nav && !nav.querySelector('a[href="#payments"]')) {
    var a = document.createElement('a');
    a.href = '#payments';
    a.textContent = 'Payments';
    nav.appendChild(a);
  }

  var $ = function (id) { return document.getElementById(id); };
  var all = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(v) {
    var d = new Date(Number(v));
    return isNaN(d) || !v ? '-' : d.toLocaleString();
  }
  function kindLabel(k) { return k === 'relist' ? 'List again' : 'Publish'; }
  function isPaid(s) { return s === 'paid' || s === 'used'; }

  function norm(r) {
    return {
      date: Number(r.createdAt) || 0,
      owner: r.ownerName || '',
      phone: r.ownerPhone || '',
      property: r.listingTitle || '(deleted listing)',
      kind: r.kind || '',
      amount: Number(r.amount) || 0,
      status: r.status || '',
      ref: r.txRef || ''
    };
  }

  function render() {
    var q = $('paySearch').value.trim().toLowerCase();
    var st = $('payStatus').value;
    var kd = $('payKind').value;
    var sort = $('paySort').value;

    var rows = all.filter(function (p) {
      if (st && p.status !== st) return false;
      if (kd && p.kind !== kd) return false;
      if (!q) return true;
      return [p.owner, p.phone, p.property, p.ref].join(' ').toLowerCase().indexOf(q) > -1;
    });

    rows.sort(function (a, b) {
      if (sort === 'high') return b.amount - a.amount;
      if (sort === 'low') return a.amount - b.amount;
      return b.date - a.date;
    });

    var revenue = rows.reduce(function (s, p) { return s + (isPaid(p.status) ? p.amount : 0); }, 0);
    $('paySummary').textContent = rows.length + ' of ' + all.length +
      ' payments \u00b7 Revenue ETB ' + revenue.toLocaleString();

    $('payBody').innerHTML = rows.length ? rows.map(function (p) {
      var cls = isPaid(p.status) ? 'rented-pill' : 'rented-pill pill-wait';
      var label = p.status === 'used' ? 'paid' : p.status;
      return '<tr><td>' + fmtDate(p.date) + '</td><td><strong>' + esc(p.owner || '-') +
        '</strong></td><td>' + esc(p.phone || '-') + '</td><td>' + esc(p.property) +
        '</td><td>' + kindLabel(p.kind) + '</td><td>' + p.amount.toLocaleString() +
        '</td><td><span class="' + cls + '">' + esc(label) + '</span></td><td>' + esc(p.ref) + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="rented-empty">No payments found.</td></tr>';

    sec._rows = rows;
  }

  ['paySearch', 'payStatus', 'payKind', 'paySort'].forEach(function (id) {
    $(id).addEventListener(id === 'paySearch' ? 'input' : 'change', render);
  });

  $('payCsv').addEventListener('click', function () {
    var rows = sec._rows || [];
    if (!rows.length) { alert('There are no rows to export.'); return; }
    var csv = ['Date,Owner,Phone,Property,Type,Amount,Status,Reference'].concat(rows.map(function (p) {
      return [fmtDate(p.date), p.owner, p.phone, p.property, kindLabel(p.kind), p.amount,
        p.status === 'used' ? 'paid' : p.status, p.ref].map(function (v) {
        return '"' + String(v).replace(/"/g, '""') + '"';
      }).join(',');
    })).join('\r\n');
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'payments-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  var token = localStorage.getItem('token');
  fetch(ENDPOINT, { headers: { Authorization: 'Bearer ' + token } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (list) {
      all = list.map(norm);
      var seen = {};
      all.forEach(function (p) { if (p.status) seen[p.status] = 1; });
      $('payStatus').innerHTML = '<option value="">All statuses</option>' +
        Object.keys(seen).sort().map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
      render();
    })
    .catch(function (err) {
      $('paySummary').textContent = 'Could not load payments (' + err.message + ')';
      $('payBody').innerHTML = '<tr><td colspan="8" class="rented-empty">Restart the server and make sure you are logged in as admin.</td></tr>';
    });
})();
