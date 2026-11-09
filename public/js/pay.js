(function () {
  var token = localStorage.getItem('token');
  var H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  window.rcPay = async function (listingId, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Redirecting...'; }
    try {
      var r = await fetch('/api/payments/checkout', { method: 'POST', headers: H, body: JSON.stringify({ listingId: listingId }) });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Payment failed');
      if (j.fake) { alert(j.message); location.reload(); return; } location.href = j.checkoutUrl;
    } catch (e) {
      alert(e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Pay to publish'; }
    }
  };

  var ref = new URLSearchParams(location.search).get('tx_ref');
  if (ref) {
    fetch('/api/payments/verify?tx_ref=' + encodeURIComponent(ref), { headers: H })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        alert(x.ok ? x.j.message : (x.j.error || 'Could not confirm the payment.'));
        history.replaceState(null, '', location.pathname);
        location.reload();
      });
  }
})();


(function () {
  if (new URLSearchParams(location.search).get('tx_ref')) return;
  var t = localStorage.getItem('token');
  if (!t) return;
  fetch('/api/payments/recheck', { method: 'POST', headers: { Authorization: 'Bearer ' + t } })
    .then(function (r) { return r.json(); })
    .then(function (j) { if (j && j.published) location.reload(); })
    .catch(function () {});
})();
