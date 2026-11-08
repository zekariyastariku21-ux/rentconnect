(function () {
  var box = document.getElementById('description');
  var out = document.getElementById('descCount');
  if (!box || !out) return;
  var last = -1;
  function update() {
    var n = box.value.length;
    if (n === last) return;
    last = n;
    out.textContent = n + ' / 1000';
  }
  box.addEventListener('input', update);
  // also catches the text filled in automatically when editing a listing
  setInterval(update, 400);
  update();
})();
