(function () {
  var row = document.getElementById('categoryButtons');
  var controls = document.querySelector('#filters .filter-controls');
  if (!row || !controls || controls.querySelector('.fCat')) return;

  var group = document.createElement('div');
  group.className = 'filter-group fCat';
  var title = document.createElement('label');
  title.className = 'title';
  title.textContent = 'Category';
  var wrap = document.createElement('div');
  wrap.className = 'fCatWrap';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Category');
  group.appendChild(title);
  group.appendChild(wrap);
  controls.insertBefore(group, controls.firstChild);

  var busy = false;

  function build() {
    if (busy) return;
    busy = true;
    wrap.innerHTML = '';
    row.querySelectorAll('.category').forEach(function (orig) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.category = orig.dataset.category || '';
      var t = orig.textContent.trim();
      b.textContent = (orig.dataset.category || '') === '' ? 'All' : t;
      var on = orig.classList.contains('active');
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () { orig.click(); });
      wrap.appendChild(b);
    });
    busy = false;
  }

  function sync() {
    var origs = row.querySelectorAll('.category');
    var pills = wrap.children;
    if (origs.length !== pills.length) return build();
    Array.prototype.forEach.call(origs, function (orig, i) {
      var on = orig.classList.contains('active');
      pills[i].classList.toggle('on', on);
      pills[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // follows the category row: active changes, reset, and rebuilt buttons
  new MutationObserver(sync).observe(row, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  build();
})();
