/* Gebetszeiten laden:
   1. gebetszeiten.json (offizielle Diyanet-Zeiten für Marktoberdorf)
   2. Diyanet online (Ort 10438) – abgerufene Tage werden im Browser gespeichert
   3. Aladhan-API (method=13, berechnet) – ebenfalls zwischengespeichert
   Die gespeicherten Online-Zeiten bleiben bei Internetausfall verfügbar. */
(function (global) {
  'use strict';

  var CACHE_SCHLUESSEL = 'moschee-gebetszeiten-v1';
  var DIYANET_SCHLUESSEL = 'moschee-gebetszeiten-diyanet-v1';
  var DIYANET_URL = 'https://ezanvakti.emushaf.net/vakitler/';
  var DIYANET_FELDER = { fajr: 'Imsak', shuruq: 'Gunes', dhuhr: 'Ogle', asr: 'Ikindi', maghrib: 'Aksam', isha: 'Yatsi' };
  var API_REIHENFOLGE = { fajr: 'Fajr', shuruq: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

  var cfg, datei = {}, cache = { signatur: '', tage: {} }, laufend = {};
  var diyanet = { ortId: null, tage: {} }, diyanetLaeuft = null, diyanetVersuch = 0;

  function normZeit(z) {
    var m = String(z || '').match(/(\d{1,2})[:.](\d{2})/);
    return m ? (m[1].length === 1 ? '0' : '') + m[1] + ':' + m[2] : null;
  }

  // Akzeptiert {fajr:"05:07",…} oder ["05:07","06:44",…] (sechs Werte).
  function normTag(eintrag) {
    if (!eintrag) return null;
    var aus = {}, ok = true;
    Logik.SCHLUESSEL.forEach(function (k, i) {
      var z = normZeit(Array.isArray(eintrag) ? eintrag[i] : eintrag[k]);
      if (!z) ok = false;
      aus[k] = z;
    });
    return ok ? aus : null;
  }

  function tuneSignatur() {
    var t = cfg.ONLINE_ERSATZ.tune || {};
    return [cfg.ONLINE_ERSATZ.methode, cfg.BREITENGRAD, cfg.LAENGENGRAD]
      .concat(Logik.SCHLUESSEL.map(function (k) { return t[k] || 0; })).join(',');
  }

  function cacheLaden() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_SCHLUESSEL) || 'null');
      if (c && c.tage) cache = c;
    } catch (e) { /* kein Zwischenspeicher verfügbar */ }
  }

  // Alte Tage (älter als 7 Tage) weglassen, damit der Speicher klein bleibt.
  function ohneAlteTage(tage) {
    var grenze = Logik.tagPlus(new Date().toISOString().slice(0, 10), -7), aus = {};
    Object.keys(tage).forEach(function (t) { if (t >= grenze) aus[t] = tage[t]; });
    return aus;
  }

  function cacheSpeichern() {
    try {
      localStorage.setItem(CACHE_SCHLUESSEL, JSON.stringify({ signatur: cache.signatur, tage: ohneAlteTage(cache.tage) }));
    } catch (e) { /* egal */ }
  }

  function diyanetCacheLaden() {
    try {
      var c = JSON.parse(localStorage.getItem(DIYANET_SCHLUESSEL) || 'null');
      if (c && c.tage && c.ortId === cfg.DIYANET.ortId) diyanet = c;
    } catch (e) { /* kein Zwischenspeicher verfügbar */ }
    diyanet.ortId = cfg.DIYANET.ortId;
  }

  // Diyanet liefert die nächsten ~30 Tage für den Ort auf einmal.
  function diyanetAbrufen() {
    if (diyanetLaeuft) return diyanetLaeuft;
    if (Date.now() - diyanetVersuch < 30 * 60000) return Promise.resolve();   // höchstens alle 30 Min.
    diyanetVersuch = Date.now();
    diyanetLaeuft = mitTimeout(DIYANET_URL + encodeURIComponent(cfg.DIYANET.ortId), 20000)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (liste) {
        (liste || []).forEach(function (eintrag) {
          var d = String(eintrag.MiladiTarihKisa || '').split('.');     // DD.MM.YYYY
          if (d.length !== 3) return;
          var z = {};
          Logik.SCHLUESSEL.forEach(function (k) { z[k] = eintrag[DIYANET_FELDER[k]]; });
          z = normTag(z);
          if (z) diyanet.tage[d[2] + '-' + d[1] + '-' + d[0]] = z;
        });
        try {
          localStorage.setItem(DIYANET_SCHLUESSEL, JSON.stringify({ ortId: diyanet.ortId, tage: ohneAlteTage(diyanet.tage) }));
        } catch (e) { /* egal */ }
      })
      .catch(function (e) { console.warn('Diyanet-Gebetszeiten nicht abrufbar:', e.message); })
      .then(function (r) { diyanetLaeuft = null; return r; }, function (e) { diyanetLaeuft = null; throw e; });   // „finally“ für ältere TV-Browser
    return diyanetLaeuft;
  }

  function mitTimeout(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(timer); return r; }, function (e) { clearTimeout(timer); throw e; });   // „finally“ für ältere TV-Browser
  }

  function uebernehmen(json) {
    var neu = {};
    Object.keys(json).forEach(function (tag) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tag)) return;   // z. B. "_quelle" überspringen
      var z = normTag(json[tag]);
      if (z) neu[tag] = z;
    });
    datei = neu;
  }

  function dateiLaden() {
    if (location.protocol === 'file:' && global.GEBETSZEITEN) {
      uebernehmen(global.GEBETSZEITEN);
      return Promise.resolve();
    }
    return mitTimeout(cfg.GEBETSZEITEN_DATEI + '?t=' + Date.now(), 10000)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(uebernehmen)
      .catch(function (e) {
        // Per Doppelklick geöffnet (file://) darf der Browser keine JSON-Datei lesen.
        // Dann die gleichen Daten aus gebetszeiten.js verwenden.
        if (global.GEBETSZEITEN) uebernehmen(global.GEBETSZEITEN);
        else console.warn('gebetszeiten.json konnte nicht geladen werden:', e.message);
      });
  }

  // Einen ganzen Monat von der Aladhan-API holen.
  function monatAbrufen(jahr, monat) {
    var id = jahr + '-' + monat;
    if (laufend[id]) return laufend[id];
    var o = cfg.ONLINE_ERSATZ, t = o.tune || {};
    // Reihenfolge laut API: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight
    var tune = [0, t.fajr || 0, t.shuruq || 0, t.dhuhr || 0, t.asr || 0, t.maghrib || 0, 0, t.isha || 0, 0].join(',');
    var url = 'https://api.aladhan.com/v1/calendar/' + jahr + '/' + monat +
      '?latitude=' + cfg.BREITENGRAD + '&longitude=' + cfg.LAENGENGRAD +
      '&method=' + o.methode + '&timezonestring=' + encodeURIComponent(cfg.ZEITZONE) + '&tune=' + tune;

    laufend[id] = mitTimeout(url, 20000)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (json) {
        (json.data || []).forEach(function (eintrag) {
          var g = eintrag.date.gregorian.date.split('-');    // DD-MM-YYYY
          var tag = g[2] + '-' + g[1] + '-' + g[0];
          var z = {};
          Logik.SCHLUESSEL.forEach(function (k) { z[k] = eintrag.timings[API_REIHENFOLGE[k]]; });
          z = normTag(z);
          if (z) cache.tage[tag] = z;
        });
        cacheSpeichern();
      })
      .catch(function (e) { console.warn('Online-Gebetszeiten nicht abrufbar:', e.message); })
      .then(function (r) { delete laufend[id]; return r; }, function (e) { delete laufend[id]; throw e; });   // „finally“ für ältere TV-Browser
    return laufend[id];
  }

  var Daten = {
    quelle: {},   // tag → "datei" | "diyanet" | "aladhan"

    init: function (konfiguration) {
      cfg = konfiguration;
      cfg.DIYANET = cfg.DIYANET || { aktiv: false };
      cacheLaden();
      diyanetCacheLaden();
      if (cache.signatur !== tuneSignatur()) cache = { signatur: tuneSignatur(), tage: {} };
      return dateiLaden();
    },

    neuLaden: dateiLaden,

    zeiten: function (tag) {
      if (datei[tag]) { this.quelle[tag] = 'datei'; return datei[tag]; }
      if (diyanet.tage[tag]) { this.quelle[tag] = 'diyanet'; return diyanet.tage[tag]; }
      if (cache.tage[tag]) { this.quelle[tag] = 'aladhan'; return cache.tage[tag]; }
      return null;
    },

    // Sorgt dafür, dass für die genannten Tage Zeiten vorhanden sind.
    sicherstellen: function (tage) {
      var self = this;
      function fehlend() { return tage.filter(function (t) { return !self.zeiten(t); }); }
      if (!fehlend().length) return Promise.resolve();
      var schritt = cfg.DIYANET.aktiv ? diyanetAbrufen() : Promise.resolve();
      return schritt.then(function () {
        // Was Diyanet nicht liefern konnte, notfalls berechnen lassen.
        var monate = {};
        if (!cfg.ONLINE_ERSATZ.aktiv) return;
        fehlend().forEach(function (tag) { monate[tag.slice(0, 7)] = true; });
        return Promise.all(Object.keys(monate).map(function (ym) {
          return monatAbrufen(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)));
        }));
      });
    },
  };

  global.Daten = Daten;
})(this);
