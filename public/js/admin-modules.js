(function () {
  var body = document.body;
  var links = Array.prototype.slice.call(document.querySelectorAll('.side-nav a')).filter(function (a) {
    var h = a.getAttribute('href') || '';
    return h.charAt(0) === '#' && h !== '#overview' && h.length > 1;
  });

  var mods = [];
  links.forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    var s = document.getElementById(id);
    if (s && !mods.some(function (m) { return m.id === id; })) {
      mods.push({ id: id, s: s, label: a.textContent.trim(), link: a });
    }
  });
  if (!mods.length) return;

  var META = [
    { k: 'categor', cls: 'm-cat', sub: 'Manage rental types',
      icon: '<path d="M20 12l-8 8-9-9V3h8l9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>' },
    { k: 'account', cls: 'm-acc', sub: 'Users and verification',
      icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7"/><path d="M18 14.5c2.5.6 4 2.5 4 5.5"/>' },
    { k: 'payment', cls: 'm-pay', sub: 'Revenue and transactions',
      icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>' },
    { k: 'rented', cls: 'm-rnt', sub: 'Search and export rented',
      icon: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M16 7l3 3"/>' },
    { k: 'listing', cls: 'm-lst', sub: 'All property listings',
      icon: '<path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-5h6v5"/><path d="M9 9h2M13 9h2M9 12.5h2M13 12.5h2"/>' }
  ];
  function meta(label) {
    var l = label.toLowerCase();
    for (var i = 0; i < META.length; i++) if (l.indexOf(META[i].k) > -1) return META[i];
    return { cls: 'm-def', sub: 'Open module', icon: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>' };
  }

  var backdrop = document.createElement('div');
  backdrop.className = 'module-backdrop';
  body.appendChild(backdrop);

  var current = null;
  var buttons = {};

  function close() {
    if (current) {
      current.s.classList.remove('module-open');
      buttons[current.id].classList.remove('is-active');
    }
    current = null;
    body.classList.remove('module-lock');
  }
  function open(m) {
    close();
    current = m;
    m.s.classList.add('module-open');
    buttons[m.id].classList.add('is-active');
    body.classList.add('module-lock');
    body.classList.remove('sidebar-open');
    m.s.scrollTop = 0;
  }

  var wrap = document.createElement('div');
  wrap.className = 'module-wrap';
  wrap.innerHTML = '<h2 class="module-title">Admin modules</h2><p class="module-hint">Choose a module to open</p>';
  var bar = document.createElement('div');
  bar.className = 'module-bar';
  wrap.appendChild(bar);

  mods.forEach(function (m) {
    var info = meta(m.label);
    m.s.classList.add('module-section');

    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'module-close';
    x.setAttribute('aria-label', 'Close');
    x.innerHTML = '&times;';
    x.addEventListener('click', close);
    m.s.insertBefore(x, m.s.firstChild);

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'module-btn ' + info.cls;
    b.innerHTML =
      '<span class="module-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + info.icon + '</svg></span>' +
      '<span class="module-text"><strong>' + m.label + '</strong><small>' + info.sub + '</small></span>' +
      '<svg class="module-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
    b.addEventListener('click', function () { open(m); });
    bar.appendChild(b);
    buttons[m.id] = b;

    m.link.addEventListener('click', function (e) {
      e.preventDefault();
      open(m);
    });
  });

  var first = mods.map(function (m) { return m.s; }).sort(function (a, b) {
    return a.compareDocumentPosition(b) & 4 ? -1 : 1;
  })[0];
  first.parentNode.insertBefore(wrap, first);

  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();

