window.addEventListener('load', async function () {
  if (typeof properties === 'undefined' || typeof renderProperties !== 'function') return;
  try {
    const r = await fetch('/api/listings');
    if (!r.ok) throw new Error('Could not load listings.');
    const extra = await r.json();
    if (!Array.isArray(extra)) throw new TypeError('The listings response has an invalid format.');

    const placeholder = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=700';
    extra.forEach(function (p) { properties.push(Object.assign({}, p, { image: p.image || placeholder })); });

    // make sure new cities appear in the city filter
    const sel = document.getElementById('cityFilter');
    if (sel && sel.tagName === 'SELECT') {
      const selectedCity = sel.value;
      const cities = Array.from(new Map(extra
        .filter(function (p) { return typeof p.city === 'string' && p.city.trim(); })
        .map(function (p) { return [p.city.trim().toLowerCase(), p.city.trim()]; }))
        .values())
        .sort(function (a, b) { return a.localeCompare(b); });
      sel.replaceChildren(new Option('All Cities', ''));
      cities.forEach(function (city) {
        sel.add(new Option(city, city));
      });
      if (cities.some(function (city) { return city.toLowerCase() === selectedCity.toLowerCase(); })) sel.value = selectedCity;
    }
    renderProperties();
  } catch (e) { console.error('Could not load listings:', e); }
});
