(function () {
  var $ = function (id) { return document.getElementById(id); };
  var filters = $('filters');
  var toggle = $('filterToggle');
  if (!filters) return;

  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">';

  // ETB prefix on the two price fields
  ['minFilter', 'maxFilter'].forEach(function (id) {
    var input = $(id);
    if (!input || input.parentNode.className === 'fPre') return;
    var wrap = document.createElement('span');
    wrap.className = 'fPre';
    var tag = document.createElement('b');
    tag.textContent = 'ETB';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(tag);
    wrap.appendChild(input);
  });

  // drawer header with a close button
  var head = document.createElement('div');
  head.className = 'fHead';
  head.innerHTML = '<h3>' + S + '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/></svg>Filters</h3>';
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'fClose';
  closeBtn.setAttribute('aria-label', 'Close filters');
  closeBtn.innerHTML = S + '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  head.appendChild(closeBtn);
  filters.insertBefore(head, filters.firstChild);
  filters.setAttribute('role', 'dialog');
  filters.setAttribute('aria-label', 'Filters');

  // dark backdrop behind the drawer
  var overlay = document.createElement('div');
  overlay.className = 'fOverlay';
  document.body.appendChild(overlay);

  // badge on the Filter button
  var badge = document.createElement('span');
  badge.className = 'fBadge';
  badge.hidden = true;
  if (toggle) toggle.appendChild(badge);

  function countActive() {
    var n = 0;
    ['minFilter', 'maxFilter', 'cityFilter', 'bedFilter'].forEach(function (id) {
      if ($(id) && $(id).value !== '') n++;
    });
    if ($('areaFilter') && $('areaFilter').value.trim() !== '') n++;
    if (typeof selectedCategory !== 'undefined' && selectedCategory) n++;
    return n;
  }
  function updateBadge() {
    var n = countActive();
    badge.textContent = n;
    badge.hidden = n === 0;
    if (toggle) toggle.setAttribute('aria-label', n ? 'Toggle filters (' + n + ' active)' : 'Toggle filters');
  }
  filters.addEventListener('input', updateBadge);
  filters.addEventListener('change', updateBadge);
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.category')) setTimeout(updateBadge, 0);
  });

  // Apply button shows how many properties match
  var applyBtn = filters.querySelector('.filter-actions .btn-primary');
  var counter = $('resultCount');
  function updateApplyLabel() {
    if (!applyBtn || !counter) return;
    var m = counter.textContent.match(/Found\s+(\d+)/);
    applyBtn.textContent = m ? 'Show ' + m[1] + (m[1] === '1' ? ' result' : ' results') : 'Apply Filters';
  }
  if (counter && window.MutationObserver) {
    new MutationObserver(updateApplyLabel).observe(counter, { childList: true, characterData: true, subtree: true });
  }

  // the drawer: replaces the sidebar logic from app.js (toggleFilters still flips areFiltersVisible)
  window.syncFilterToggle = function () {
    var content = document.querySelector('.content');
    if (content) content.classList.remove('filters-hidden');
    filters.classList.remove('open');
    var isOpen = !!areFiltersVisible;
    filters.classList.toggle('fOpen', isOpen);
    overlay.classList.toggle('show', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
  };

  var lastFocus = null;
  function setOpen(open) {
    if (open === !!areFiltersVisible) return;
    if (open) lastFocus = document.activeElement;
    areFiltersVisible = open;
    window.syncFilterToggle();
    if (open) setTimeout(function () { closeBtn.focus(); }, 60);
    else if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  closeBtn.addEventListener('click', function () { setOpen(false); });
  overlay.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && areFiltersVisible) setOpen(false);
  });

  // Apply Filters: run the search, close the drawer, jump to the results
  window.applyFilters = function () {
    renderProperties();
    updateBadge();
    setOpen(false);
    var grid = $('propertyGrid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Clear Filters: original behavior + reset category and badge (drawer stays open)
  var originalReset = window.resetFilters;
  window.resetFilters = function () {
    if (typeof originalReset === 'function') originalReset();
    if (typeof selectedCategory !== 'undefined') {
      selectedCategory = '';
      if (typeof updateCategoryButtons === 'function') updateCategoryButtons();
    }
    renderProperties();
    updateBadge();
    updateApplyLabel();
  };

  window.syncFilterToggle();
  updateBadge();
  updateApplyLabel();
})();
