(function () {
  var css = [
    '.pcOverlay{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;z-index:10000;opacity:0;transition:opacity .18s ease}',
    '.pcOverlay.show{opacity:1}',
    '.pcCard{background:#fff;color:#0f172a;width:100%;max-width:400px;border-radius:18px;padding:28px 24px 22px;text-align:center;box-shadow:0 24px 60px rgba(15,23,42,.35);font-family:system-ui,-apple-system,Segoe UI,sans-serif;transform:translateY(14px) scale(.96);transition:transform .22s cubic-bezier(.2,.9,.3,1.2)}',
    '.pcOverlay.show .pcCard{transform:none}',
    '.pcIcon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}',
    '.pcIcon svg{width:32px;height:32px}',
    '.pcIcon.warning{background:#fef3c7;color:#d97706}',
    '.pcIcon.success{background:#dcfce7;color:#16a34a}',
    '.pcIcon.info{background:#dbeafe;color:#2563eb}',
    '.pcTitle{margin:0 0 8px;font-size:20px;font-weight:700}',
    '.pcMsg{margin:0 0 14px;color:#475569;font-size:15px;line-height:1.5}',
    '.pcItem{display:block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:9px 12px;margin:0 0 18px;font-weight:600;font-size:14px;word-break:break-word}',
    '.pcBtns{display:flex;gap:10px}',
    '.pcBtns button{flex:1;padding:12px 14px;border-radius:10px;border:0;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:transform .1s ease,box-shadow .15s ease,background .15s ease}',
    '.pcBtns button:active{transform:scale(.97)}',
    '.pcBtns button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}',
    '.pcCancel{background:#e2e8f0;color:#0f172a}.pcCancel:hover{background:#cbd5e1}',
    '.pcOk{color:#fff}',
    '.pcOk.warning{background:#f59e0b;box-shadow:0 4px 12px rgba(245,158,11,.4)}.pcOk.warning:hover{background:#d97706}',
    '.pcOk.success{background:#16a34a;box-shadow:0 4px 12px rgba(22,163,74,.4)}.pcOk.success:hover{background:#15803d}',
    '.pcOk.info{background:#2563eb;box-shadow:0 4px 12px rgba(37,99,235,.4)}.pcOk.info:hover{background:#1d4ed8}',
    '@media(max-width:380px){.pcBtns{flex-direction:column-reverse}}',
    '@media(prefers-color-scheme:dark){.pcCard{background:#1e293b;color:#f1f5f9}.pcMsg{color:#cbd5e1}.pcItem{background:#0f172a;border-color:#334155}.pcCancel{background:#334155;color:#f1f5f9}.pcCancel:hover{background:#475569}.pcIcon.warning{background:#78350f;color:#fcd34d}.pcIcon.success{background:#14532d;color:#86efac}.pcIcon.info{background:#1e3a8a;color:#93c5fd}}'
  ].join('');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  var ICONS = {
    warning: S + '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="m9.5 15 2 2 3.5-4"/></svg>',
    success: S + '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>',
    info: S + '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'
  };

  window.proConfirm = function (opts) {
    opts = opts || {};
    var type = ICONS[opts.type] ? opts.type : 'warning';
    return new Promise(function (resolve) {
      var previouslyFocused = document.activeElement;

      var overlay = document.createElement('div');
      overlay.className = 'pcOverlay';
      overlay.setAttribute('role', 'alertdialog');
      overlay.setAttribute('aria-modal', 'true');

      var card = document.createElement('div');
      card.className = 'pcCard';

      var icon = document.createElement('div');
      icon.className = 'pcIcon ' + type;
      icon.innerHTML = ICONS[type];

      var title = document.createElement('h3');
      title.className = 'pcTitle';
      title.textContent = opts.title || 'Are you sure?';

      var msg = document.createElement('p');
      msg.className = 'pcMsg';
      msg.textContent = opts.message || '';

      card.appendChild(icon);
      card.appendChild(title);
      card.appendChild(msg);

      if (opts.item) {
        var item = document.createElement('span');
        item.className = 'pcItem';
        item.textContent = opts.item;
        card.appendChild(item);
      }

      var btns = document.createElement('div');
      btns.className = 'pcBtns';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'pcCancel';
      cancel.textContent = opts.cancelText || 'Cancel';
      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'pcOk ' + type;
      ok.textContent = opts.confirmText || 'Confirm';
      btns.appendChild(cancel);
      btns.appendChild(ok);
      card.appendChild(btns);

      overlay.appendChild(card);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () { overlay.classList.add('show'); });
      cancel.focus();

      function done(result) {
        document.removeEventListener('keydown', onKey, true);
        overlay.classList.remove('show');
        document.body.style.overflow = '';
        setTimeout(function () { overlay.remove(); }, 180);
        if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
        resolve(result);
      }

      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        if (e.key === 'Tab') {
          e.preventDefault();
          (document.activeElement === cancel ? ok : cancel).focus();
        }
      }

      document.addEventListener('keydown', onKey, true);
      cancel.addEventListener('click', function () { done(false); });
      ok.addEventListener('click', function () { done(true); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) done(false); });
    });
  };
})();
