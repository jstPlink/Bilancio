// Inserito in testa a ogni pagina dell'app Android: le richieste a /api/ con corpo (login, salvataggi, aggiornamento)
// passano dal codice nativo (oggetto Native), che le inoltra al server. Le letture (GET) le gestisce la WebView.
(function () {
  // Feedback aptico: un tick a ogni tocco su un elemento cliccabile (non mentre si scorre: il click arriva solo a dito sollevato).
  var CLICKABLE = 'button, a[href], select, summary, label, input[type=checkbox], input[type=file], [role=button], [role=tab], [role=checkbox], [data-go], [data-expand], .pcell, tr.mv';
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest(CLICKABLE) : null;
    if (t && !t.disabled && window.Native && Native.haptic) Native.haptic();
  }, true);
  var nativeFetch = window.fetch.bind(window);
  var pending = {};
  var counter = 0;
  window.__bilancioResult = function (id, status, headers, b64) {
    var p = pending[id];
    delete pending[id];
    if (!p) return;
    if (!status) { p.reject(new TypeError('Failed to fetch')); return; }
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var empty = status === 204 || status === 205 || status === 304;
    p.resolve(new Response(empty ? null : bytes, { status: status, headers: headers }));
  };
  window.fetch = function (input, init) {
    var req = typeof input === 'string' || input instanceof URL ? null : input;
    var u = new URL(req ? req.url : String(input), location.href);
    var method = String((init && init.method) || (req && req.method) || 'GET').toUpperCase();
    if (u.origin !== location.origin || u.pathname.indexOf('/api/') !== 0 || method === 'GET' || method === 'HEAD') return nativeFetch(input, init);
    var headers = {};
    new Headers((init && init.headers) || (req && req.headers) || {}).forEach(function (v, k) { headers[k] = v; });
    var raw = init && init.body != null ? init.body : null;
    return new Promise(function (resolve, reject) {
      var id = ++counter;
      pending[id] = { resolve: resolve, reject: reject };
      var send = function (body, isBase64) { Native.send(id, method, u.pathname + u.search, JSON.stringify(headers), body, isBase64); };
      if (raw == null) return send('', false);
      if (typeof raw === 'string') return send(raw, false);
      // File e altri dati binari (caricamento documenti): arrivano al codice nativo in base64.
      new Response(raw).arrayBuffer().then(function (buf) {
        var bytes = new Uint8Array(buf);
        var bin = '';
        for (var i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        send(btoa(bin), true);
      }, reject);
    });
  };
})();
