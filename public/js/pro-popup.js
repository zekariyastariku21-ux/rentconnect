(function () {
  var ICONS = {
    success: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    error:   '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17h.01"/></svg>',
    info:    '<svg viewBox="0 0 24 24"><path d="M12 11v6M12 7h.01"/></svg>'
  };
  var queue = [], open = false;

  function detect(msg) {
    if (/error|invalid|could not|couldn.t|not found|failed|required|please log|not completed|unable|wrong|denied|not configured/i.test(msg)) return 'error';
    if (/received|published|live|saved|success|paid|thank|updated|deleted|added|done/i.test(msg)) return 'success';
    return 'info';
  }
  function titleFor(type, msg) {
    if (type === 'success') return /payment|paid/i.test(msg) ? 'Payment received' : 'Success';
    if (type === 'error') return /payment/i.test(msg) ? 'Payment problem' : 'Something went wrong';
    return 'Notice';
  }
  function next() {
    if (open || !queue.length) return;
    open = true;
    var item = queue.shift();
    var ov = document.createElement('div');
    ov.className = 'pp-overlay';
    var card = document.createElement('div');
    card.className = 'pp-card pp-' + item.type;
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-modal', 'true');
    card.innerHTML = '<div class="pp-icon">' + ICONS[item.type] + '</div><h3 class="pp-title"></h3><p class="pp-msg"></p><button type="button" class="pp-btn">OK</button>';
    card.querySelector('.pp-title').textContent = item.title;
    card.querySelector('.pp-msg').textContent = item.msg;
    ov.appendChild(card);
    document.body.appendChild(ov);
    var btn = card.querySelector('.pp-btn');
    requestAnimationFrame(function () { ov.classList.add('pp-show'); btn.focus(); });
    function close() {
      document.removeEventListener('keydown', onKey, true);
      ov.classList.remove('pp-show');
      setTimeout(function () { ov.remove(); open = false; next(); }, 180);
    }
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); }
    }
    document.addEventListener('keydown', onKey, true);
    btn.onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  }
  function show(type, title, msg) {
    queue.push({ type: type, title: title, msg: String(msg == null ? '' : msg) });
    if (document.body) next(); else document.addEventListener('DOMContentLoaded', next);
  }
  window.proPopup = { show: show };
  window.alert = function (msg) {
    msg = String(msg == null ? '' : msg);
    var t = detect(msg);
    show(t, titleFor(t, msg), msg);
  };
})();