(function () {
  var ENDPOINT = '/api/admin/rented';

  var main = document.querySelector('.admin-main');
  if (!main) return;

  var sec = document.createElement('section');
  sec.id = 'rented';
  sec.className = 'rented-card';
  sec.innerHTML =
    '<div class="rented-head"><div><h2>Rented properties</h2>' +
    '<p class="rented-sub" id="rentedSummary">Loading...</p></div>' +
    '<button type="button" class="rented-btn" id="rentedCsv">Export CSV</button></div>' +
    '<div class="rented-tools">' +
    '<input type="search" id="rentedSearch" placeholder="Search property, owner, phone, location...">' +
    '<select id="rentedCategory"><option value="">All categories</option></select>' +
    '<select id="rentedLocation"><option value="">All cities</option></select>' +
    '<select id="rentedSort">' +
    '<option value="new">Newest first</option>' +
    '<option value="high">Price: high to low</option>' +
    '<option value="low">Price: low to high</option>' +
    '<option value="az">Name: A to Z</option></select></div>' +
    '<div class="rented-wrap"><table class="rented-table"><thead><tr>' +
    '<th>Property</th><th>Category</th><th>Location</th><th>Price</th><th>Owner</th><th>Phone</th><th>Listed</th><th>Rented on</th>' +
    '</tr></thead><tbody id="rentedBody"></tbody></table></div>';
  main.appendChild(sec);

  var nav = document.querySelector('.side-nav');
  if (nav && !nav.querySelector('a[href="#rented"]')) {
    var a = document.createElement('a');
    a.href = '#rented';
    a.textContent = 'Rented properties';
    a.addEventListener('click', function () { document.body.classList.remove('sidebar-open'); });
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
    if (!v) return '-';
    var d = new Date(Number(v) < 1e12 ? Number(v) * 1000 : Number(v));
    return isNaN(d) ? '-' : d.toLocaleDateString();
  }
  function norm(r) {
    return {
      name: r.title || '',
      category: r.category || '',
      city: r.city || '',
      area: r.area || '',
      price: Number(r.price) || 0,
      owner: r.ownerName || '',
      phone: r.contactPhone || r.ownerPhone || '',
      created: Number(r.createdAt) || 0,
      rented: Number(r.rentedAt) || 0
    };
  }

  function render() {
    var q = $('rentedSearch').value.trim().toLowerCase();
    var cat = $('rentedCategory').value;
    var city = $('rentedLocation').value;
    var sort = $('rentedSort').value;

    var rows = all.filter(function (p) {
      if (cat && p.category !== cat) return false;
      if (city && p.city !== city) return false;
      if (!q) return true;
      return [p.name, p.category, p.city, p.area, p.owner, p.phone].join(' ').toLowerCase().indexOf(q) > -1;
    });

    rows.sort(function (a, b) {
      if (sort === 'high') return b.price - a.price;
      if (sort === 'low') return a.price - b.price;
      if (sort === 'az') return a.name.localeCompare(b.name);
      return (b.rented || b.created) - (a.rented || a.created);
    });

    var total = rows.reduce(function (s, p) { return s + p.price; }, 0);
    $('rentedSummary').textContent = rows.length + ' of ' + all.length +
      ' rented · Total price ' + total.toLocaleString();

    $('rentedBody').innerHTML = rows.length ? rows.map(function (p) {
      return '<tr><td><strong>' + esc(p.name) + '</strong></td><td>' + esc(p.category) +
        '</td><td>' + esc(p.city) + (p.area ? ', ' + esc(p.area) : '') +
        '</td><td>' + p.price.toLocaleString() + '</td><td>' + esc(p.owner || '-') +
        '</td><td>' + esc(p.phone || '-') + '</td><td>' + fmtDate(p.created) + '</td><td>' + fmtDate(p.rented) + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="rented-empty">No rented properties found.</td></tr>';

    sec._rows = rows;
  }

  function options(id, label, values) {
    $(id).innerHTML = '<option value="">' + label + '</option>' +
      values.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('');
  }
  function uniq(key) {
    var o = {};
    all.forEach(function (p) { if (p[key]) o[p[key]] = 1; });
    return Object.keys(o).sort();
  }

  ['rentedSearch', 'rentedCategory', 'rentedLocation', 'rentedSort'].forEach(function (id) {
    $(id).addEventListener(id === 'rentedSearch' ? 'input' : 'change', render);
  });

  $('rentedCsv').addEventListener('click', function () {
    var rows = sec._rows || [];
    var csv = ['Property,Category,City,Area,Price,Owner,Phone,Listed,Rented on'].concat(rows.map(function (p) {
      return [p.name, p.category, p.city, p.area, p.price, p.owner, p.phone, fmtDate(p.created), fmtDate(p.rented)].map(function (v) {
        return '"' + String(v).replace(/"/g, '""') + '"';
      }).join(',');
    })).join('\r\n');
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'rented-properties.csv';
    link.click();
  });

  var token = localStorage.getItem('token');
  fetch(ENDPOINT, { headers: { Authorization: 'Bearer ' + token } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (list) {
      all = list.map(norm);
      options('rentedCategory', 'All categories', uniq('category'));
      options('rentedLocation', 'All cities', uniq('city'));
      render();
    })
    .catch(function (err) {
      $('rentedSummary').textContent = 'Could not load rented properties (' + err.message + ')';
      $('rentedBody').innerHTML = '<tr><td colspan="8" class="rented-empty">Restart the server and make sure you are logged in as admin.</td></tr>';
    });
})();


