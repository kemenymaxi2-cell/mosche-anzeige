/* Gebetszeiten laden:
   1. gebetszeiten.json (offizielle Zeiten)
   2. Zwischenspeicher im Browser (localStorage) mit früher abgerufenen Online-Zeiten
   3. Aladhan-API (method=13, Diyanet) – Ergebnis wird zwischengespeichert */
(function (global) {
  'use strict';

  var CACHE_SCHLUESSEL = 'moschee-gebetszeiten-v1';
  var API_REIHENFOLGE = { fajr: 'Fajr', shuruq: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

  var cfg, datei = {}, cache = { signatur: '', tage: {} }, laufend = {};

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

  function cacheSpeichern() {
    // Alte Tage (älter als 7 Tage) entfernen, damit der Speicher klein bleibt.
    var grenze = Logik.tagPlus(new Date().toISOString().slice(0, 10), -7);
    var kopie = { signatur: cache.signatur, tage: {} };
    Object.keys(cache.tage).forEach(function (t) { if (t >= grenze) kopie.tage[t] = cache.tage[t]; });
    try { localStorage.setItem(CACHE_SCHLUESSEL, JSON.stringify(kopie)); } catch (e) { /* egal */ }
  }

  function mitTimeout(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .finally(function () { clearTimeout(timer); });
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
      .finally(function () { delete laufend[id]; });
    return laufend[id];
  }

  var Daten = {
    quelle: {},   // tag → "datei" | "online"

    init: function (konfiguration) {
      cfg = konfiguration;
      cacheLaden();
      if (cache.signatur !== tuneSignatur()) cache = { signatur: tuneSignatur(), tage: {} };
      return dateiLaden();
    },

    neuLaden: dateiLaden,

    zeiten: function (tag) {
      if (datei[tag]) { this.quelle[tag] = 'datei'; return datei[tag]; }
      if (cache.tage[tag]) { this.quelle[tag] = 'online'; return cache.tage[tag]; }
      return null;
    },

    // Sorgt dafür, dass für die genannten Tage Zeiten vorhanden sind.
    sicherstellen: function (tage) {
      var self = this, monate = {};
      if (!cfg.ONLINE_ERSATZ.aktiv) return Promise.resolve();
      tage.forEach(function (tag) {
        if (!self.zeiten(tag)) monate[tag.slice(0, 7)] = true;
      });
      return Promise.all(Object.keys(monate).map(function (ym) {
        return monatAbrufen(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)));
      }));
    },
  };

  global.Daten = Daten;
})(this);
