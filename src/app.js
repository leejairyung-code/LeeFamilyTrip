(function () {
  var root = document.documentElement;
  var cfg = JSON.parse(document.getElementById('cfg').textContent);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* language */
  function setLang(l) {
    root.setAttribute('data-lang', l);
    root.lang = l;
    store.set('lang', l);
    $$('[data-setlang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setlang === l)); });
  }
  $$('[data-setlang]').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.setlang); }); });
  setLang(root.getAttribute('data-lang'));

  /* tabs */
  var tabs = ['plan', 'places', 'flights', 'stays', 'contacts', 'info'];
  function showTab(name, anchor) {
    tabs.forEach(function (t) { $('#' + t).hidden = t !== name; });
    $$('.nav a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var target = anchor && document.getElementById(anchor);
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
  }
  function route() {
    var h = location.hash.replace('#', '');
    if (h.indexOf('place-') === 0) return showTab('places', h);
    showTab(tabs.indexOf(h) >= 0 ? h : 'plan');
  }
  window.addEventListener('hashchange', route);

  /* days */
  function pickDay(id) {
    current = id;
    $$('.day').forEach(function (d) { d.classList.toggle('active', d.dataset.date === id); });
    if (typeof fab !== 'undefined') syncFab();
    $$('.chip[data-day]').forEach(function (c) {
      var on = c.dataset.day === id;
      c.setAttribute('aria-selected', String(on));
      if (on) c.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
  }
  $$('.chip[data-day]').forEach(function (c) { c.addEventListener('click', function () { pickDay(c.dataset.day); window.scrollTo(0, 0); }); });
  var today = new Date().toLocaleDateString('sv-SE', { timeZone: cfg.timezone });
  var days = cfg.days;
  var inTrip = days.indexOf(today) >= 0;
  var fab = $('#today-fab');
  var current = null;
  function syncFab() { fab.hidden = !(inTrip && current !== today && !$('#plan').hidden); }
  fab.addEventListener('click', function () { pickDay(today); window.scrollTo(0, 0); });
  window.addEventListener('hashchange', syncFab);
  if (inTrip) {
    $$('[data-day="' + today + '"]').forEach(function (c) { c.classList.add('today'); });
    $$('.today-tag').forEach(function (t) { t.hidden = t.dataset.for !== today; });
  }
  route();
  pickDay(inTrip ? today : 'overview');

  /* map links open the phone's map app */
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $$('a[data-q]').forEach(function (a) {
    var q = encodeURIComponent(a.dataset.q);
    a.href = ios ? 'https://maps.apple.com/?q=' + q : 'https://www.google.com/maps/search/?api=1&query=' + q;
  });

  /* flights: filter by traveler */
  $$('[data-who]').forEach(function (b) {
    if (b.tagName !== 'BUTTON') return;
    b.addEventListener('click', function () {
      var who = b.dataset.who;
      $$('button[data-who]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      $$('.trip').forEach(function (c) { c.hidden = who !== 'all' && (' ' + c.dataset.who + ' ').indexOf(' ' + who + ' ') < 0; });
      $$('.flight-day').forEach(function (g) { g.hidden = !$$('.trip', g).some(function (c) { return !c.hidden; }); });
    });
  });

  /* currency helper */
  var rates = cfg.rates;
  rates.CZK = 1;
  var cur = 'CZK';
  var amt = $('#cur-amount');
  function fmt(c, v) {
    var digits = c === 'KRW' || c === 'CZK' ? 0 : 2;
    return v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }
  function convert() {
    var n = parseFloat((amt.value || '').replace(',', '.'));
    var czk = isFinite(n) ? n * rates[cur] : 0;
    $$('[data-out]').forEach(function (el) {
      var c = el.dataset.out;
      el.closest('div').hidden = c === cur;
      el.textContent = isFinite(n) && n > 0 ? fmt(c, czk / rates[c]) + ' ' + c : '–';
    });
  }
  if (amt) {
    amt.addEventListener('input', convert);
    $$('[data-cur]').forEach(function (b) {
      b.addEventListener('click', function () {
        cur = b.dataset.cur;
        $$('[data-cur]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        convert();
      });
    });
    convert();
  }

  /* offline + updates */
  var chipReady = $('#chip-ready'), chipOffline = $('#chip-offline'), banner = $('#update');
  function net() { chipOffline.hidden = navigator.onLine; }
  window.addEventListener('online', net);
  window.addEventListener('offline', net);
  net();

  if ('serviceWorker' in navigator) {
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading || !hadController) return;
      reloading = true;
      location.reload();
    });
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      function offer(worker) {
        banner.hidden = false;
        banner.onclick = function () { worker.postMessage('SKIP_WAITING'); };
      }
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
      reg.update().catch(function () {});
    }).catch(function () {});
    navigator.serviceWorker.ready.then(function () { chipReady.hidden = false; });
  }
})();
