(function () {
  var sel = document.getElementById('bedFilter');
  var filters = document.getElementById('filters');
  if (!sel || !filters || sel.dataset.seg) return;
  sel.dataset.seg = '1';

  // shorter labels so the two price fields fit side by side
  var labels = { minFilter: 'Min price', maxFilter: 'Max price' };
  Object.keys(labels).forEach(function (id) {
    var input = document.getElementById(id);
    var group = input && input.closest('.filter-group');
    var title = group && group.querySelector('label.title');
    if (title) title.textContent = labels[id];
  });

  var seg = document.createElement('div');
  seg.className = 'fSeg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Bedrooms');

  var buttons = Array.prototype.map.call(sel.options, function (o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = o.value;
    b.textContent = o.value === '' ? 'Any' : o.text;
    b.addEventListener('click', function () {
      sel.value = o.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });
    seg.appendChild(b);
    return b;
  });

  function sync() {
    buttons.forEach(function (b) {
      var on = b.dataset.value === sel.value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  sel.classList.add('fSegHidden');
  sel.parentNode.appendChild(seg);
  sel.addEventListener('change', sync);

  // Clear Filters sets the value without an event, so sync after it runs
  var prevReset = window.resetFilters;
  window.resetFilters = function () {
    if (typeof prevReset === 'function') prevReset();
    sync();
  };

  sync();
})();
