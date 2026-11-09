(function () {
  var TARGETS = [
    { match: /account/i, file: 'accounts' },
    { match: /^listing/i, file: 'listings' }
  ];

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function cellText(td) {
    var sel = td.querySelector('select');
    if (sel) return clean(sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '');
    return clean(td.textContent);
  }
  function q(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }

  function exportTable(section, file, btn) {
    var table = section.querySelector('table');
    if (!table) { alert('No table found to export.'); return; }

    var heads = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    var skip = {};
    var names = [];
    heads.forEach(function (th, i) {
      var t = clean(th.textContent);
      if (!t || /^actions?$/i.test(t)) { skip[i] = true; return; }
      names.push(t);
    });

    var lines = [names.map(q).join(',')];
    var count = 0;
    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr) {
      if (tr.hidden || getComputedStyle(tr).display === 'none') return;
      var tds = Array.prototype.slice.call(tr.children);
      if (tds.length === 1 && tds[0].colSpan > 1) return; // "no results" row
      var vals = [];
      tds.forEach(function (td, i) { if (!skip[i]) vals.push(q(cellText(td))); });
      lines.push(vals.join(','));
      count++;
    });

    if (!count) { alert('There are no rows to export.'); return; }

    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  Array.prototype.slice.call(document.querySelectorAll('section[id], div[id].module-section')).forEach(function (s) {
    TARGETS.forEach(function (t) {
      if (!t.match.test(s.id) || s.querySelector('.export-btn')) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'export-btn';
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/></svg>Export CSV';
      b.addEventListener('click', function () { exportTable(s, t.file, b); });
      var close = s.querySelector('.module-close');
      if (close && close.nextSibling) s.insertBefore(b, close.nextSibling);
      else s.insertBefore(b, s.firstChild);
    });
  });
})();
