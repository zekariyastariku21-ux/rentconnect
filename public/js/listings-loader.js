window.addEventListener('load', async function () {
  if (typeof properties === 'undefined' || typeof renderProperties !== 'function') return;
  try {
    const r = await fetch('/api/listings');
    if (!r.ok) return;
    const extra = await r.json();
    if (!Array.isArray(extra) || !extra.length) return;

    const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
    const placeholder = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=700';
    extra.forEach(function (p) { properties.push(Object.assign({}, p, { title: esc(p.title), area: esc(p.area), city: esc(p.city), image: p.image || placeholder })); });

    // make sure new cities appear in the city filter
    const sel = document.getElementById('cityFilter');
    if (sel && sel.tagName === 'SELECT') {
      const have = Array.from(sel.options).map(function (o) { return o.value.toLowerCase(); });
      extra.forEach(function (p) {
        if (!have.includes(p.city.toLowerCase())) {
          sel.add(new Option(p.city, p.city));
          have.push(p.city.toLowerCase());
        }
      });
    }
    renderProperties();
  } catch (e) { console.error('Could not load listings:', e); }
});

