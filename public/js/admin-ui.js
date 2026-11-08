(function () {
  // highlight the sidebar link of the section being viewed
  var links = Array.prototype.slice.call(document.querySelectorAll('.side-nav a'));
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  function mark(id) { links.forEach(function (a) { a.classList.toggle('active', a === map[id]); }); }
  mark('overview');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: '-25% 0px -65% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }
  links.forEach(function (a) { a.addEventListener('click', function () { mark(a.getAttribute('href').slice(1)); }); });

  // ask before removing a custom category (runs before the original click handler)
  var approved = false;
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-remove-category]');
    if (!btn || approved || typeof proConfirm !== 'function') return;
    e.stopImmediatePropagation();
    e.preventDefault();
    proConfirm({
      type: 'warning',
      title: 'Remove this category?',
      message: 'It will be removed from the shared rental categories if no listings use it.',
      item: btn.dataset.removeCategory,
      confirmText: 'Yes, remove',
      cancelText: 'Cancel'
    }).then(function (yes) {
      if (!yes) return;
      approved = true;
      btn.click();
      approved = false;
    });
  }, true);
})();
