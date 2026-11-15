(function () {
  var LINKS = [
    { after: 'a[href="#payments"]', href: '/admin-payment.html', text: 'Chapa payment settings', key: 'chapa' },
    { after: 'a[data-nav-extra="chapa"]', href: '/admin-telebirr.html', text: 'Telebirr payment settings', key: 'telebirr' }
  ];
  function place() {
    LINKS.forEach(function (L) {
      var anchor = document.querySelector(L.after);
      if (!anchor) return;
      var next = anchor.nextElementSibling;
      if (next && next.getAttribute('data-nav-extra') === L.key) return;
      var old = document.querySelector('a[data-nav-extra="' + L.key + '"]');
      if (old) old.remove();
      var a = document.createElement('a');
      a.href = L.href; a.textContent = L.text;
      a.setAttribute('data-nav-extra', L.key);
      a.className = (anchor.className || '').replace(/\b(active|selected|current)\b/g, '').trim();
      if (anchor.getAttribute('style')) a.setAttribute('style', anchor.getAttribute('style'));
      a.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); location.href = L.href; }, true);
      anchor.insertAdjacentElement('afterend', a);
    });
  }
  place();
  new MutationObserver(place).observe(document.documentElement, { childList: true, subtree: true });
})();