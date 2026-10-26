/* Reine Rechenlogik (Zeitzone, aktuelles Gebet, Jumu'ah, Datum, Vers).
   Hat keinen Zugriff auf die Seite – dadurch in tests/test.html prüfbar. */
(function (global) {
  'use strict';

  var L = {};
  L.SCHLUESSEL = ['fajr', 'shuruq', 'dhuhr', 'asr', 'maghrib', 'isha'];

  var WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August',
    'September', 'Oktober', 'November', 'Dezember'];

  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  L.zwei = zwei;

  /* ---------- Zeitzone ---------- */

  var formatCache = {};
  function format(tz) {
    if (!formatCache[tz]) {
      formatCache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
      });
    }
    return formatCache[tz];
  }

  // Wanduhrzeit in der Zeitzone tz für einen Zeitpunkt (ms seit 1970).
  L.wanduhr = function (ms, tz) {
    var t = {};
    format(tz).formatToParts(new Date(ms)).forEach(function (p) {
      if (p.type !== 'literal') t[p.type] = parseInt(p.value, 10);
    });
    var w = { y: t.year, m: t.month, d: t.day, h: t.hour % 24, mi: t.minute, s: t.second };
    w.wochentag = new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
    w.tag = w.y + '-' + zwei(w.m) + '-' + zwei(w.d);
    w.sekundeDesTages = w.h * 3600 + w.mi * 60 + w.s;
    return w;
  };

  // Abstand der Zeitzone zu UTC in Minuten (Berlin: 60 Winter, 120 Sommer).
  L.versatzMinuten = function (ms, tz) {
    var w = L.wanduhr(ms, tz);
    var alsUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
    return Math.round((alsUtc - Math.floor(ms / 1000) * 1000) / 60000);
  };

  // Wanduhrzeit (Datum "YYYY-MM-DD" + "HH:MM") → Zeitpunkt in ms.
  L.zeitpunkt = function (tag, hhmm, tz) {
    var d = tag.split('-').map(Number), z = hhmm.split(':').map(Number);
    var basis = Date.UTC(d[0], d[1] - 1, d[2], z[0], z[1] || 0, z[2] || 0);
    var t = basis - L.versatzMinuten(basis, tz) * 60000;
    return basis - L.versatzMinuten(t, tz) * 60000;
  };

  L.tagPlus = function (tag, n) {
    var d = tag.split('-').map(Number);
    var x = new Date(Date.UTC(d[0], d[1] - 1, d[2] + n));
    return x.getUTCFullYear() + '-' + zwei(x.getUTCMonth() + 1) + '-' + zwei(x.getUTCDate());
  };

  L.wochentagVon = function (tag) {
    var d = tag.split('-').map(Number);
    return new Date(Date.UTC(d[0], d[1] - 1, d[2])).getUTCDay();
  };

  L.minuten = function (hhmm) {
    var z = String(hhmm).split(':').map(Number);
    return z[0] * 60 + (z[1] || 0);
  };

  // Gilt an diesem Tag (mittags) die Sommerzeit?
  L.istSommerzeit = function (tag, tz) {
    var jahr = Number(tag.slice(0, 4));
    var mittag = L.zeitpunkt(tag, '12:00', tz);
    var winter = Math.min(L.versatzMinuten(Date.UTC(jahr, 0, 15, 12), tz),
      L.versatzMinuten(Date.UTC(jahr, 6, 15, 12), tz));
    return L.versatzMinuten(mittag, tz) > winter;
  };

  /* ---------- Gebetszeiten ---------- */

  /* Ermittelt aktuelles und nächstes Gebet.
     zeiten: { heute: {fajr:"05:07",…}, morgen: {…} (optional) }
     Ergebnis:
       aktuell     – Schlüssel des laufenden Gebetszeitfensters oder null
                     (zwischen Shuruq und Dhuhr: null, Shuruq ist kein Gebet)
       naechstes   – { schluessel, ms, tag } oder null, falls unbekannt
       fajrEndeMs  – Zeitpunkt von Shuruq, wenn gerade Fajr-Zeit ist */
  L.zustand = function (jetztMs, tz, heuteTag, zeiten) {
    var heute = zeiten.heute, morgen = zeiten.morgen;
    var erg = { aktuell: null, naechstes: null, fajrEndeMs: null };
    if (!heute) return erg;

    var ereignisse = L.SCHLUESSEL.map(function (k) {
      return { schluessel: k, ms: L.zeitpunkt(heuteTag, heute[k], tz), tag: heuteTag };
    });

    // Aktuelles Fenster: letztes Ereignis, das schon begonnen hat.
    var letztes = null;
    ereignisse.forEach(function (e) { if (e.ms <= jetztMs) letztes = e; });
    if (!letztes) erg.aktuell = 'isha';           // nach Mitternacht, vor Fajr: noch Isha-Zeit
    else if (letztes.schluessel !== 'shuruq') erg.aktuell = letztes.schluessel;

    if (erg.aktuell === 'fajr') erg.fajrEndeMs = ereignisse[1].ms;

    // Nächstes Gebet (Shuruq wird übersprungen).
    for (var i = 0; i < ereignisse.length; i++) {
      var e = ereignisse[i];
      if (e.schluessel !== 'shuruq' && e.ms > jetztMs) { erg.naechstes = e; break; }
    }
    if (!erg.naechstes && morgen) {
      var morgenTag = L.tagPlus(heuteTag, 1);
      erg.naechstes = { schluessel: 'fajr', ms: L.zeitpunkt(morgenTag, morgen.fajr, tz), tag: morgenTag };
    }
    return erg;
  };

  // "1 Std. 12 Min." / "12 Min." / "2 Std."
  L.dauerText = function (ms) {
    var min = Math.max(1, Math.ceil(ms / 60000));
    var h = Math.floor(min / 60), m = min % 60;
    if (h && m) return h + ' Std. ' + m + ' Min.';
    if (h) return h + ' Std.';
    return m + ' Min.';
  };

  /* ---------- Jumu'ah ---------- */

  // Nächster Freitag ab heute (heute selbst, wenn heute Freitag ist).
  L.naechsterFreitag = function (tag) {
    return L.tagPlus(tag, (5 - L.wochentagVon(tag) + 7) % 7);
  };

  L.jumuahUhrzeit = function (jumuahCfg, freitag, tz) {
    return L.istSommerzeit(freitag, tz) ? jumuahCfg.uhrzeitSommer : jumuahCfg.uhrzeitWinter;
  };

  // Liegt die Wanduhrzeit w in einem der konfigurierten Zeiträume?
  L.imJumuahZeitraum = function (w, ansichtCfg) {
    if (!ansichtCfg || !ansichtCfg.aktiv) return false;
    var minute = w.h * 60 + w.mi;
    return (ansichtCfg.zeitraeume || []).some(function (z) {
      return z.wochentag === w.wochentag &&
        minute >= L.minuten(z.von || '00:00') && minute <= L.minuten(z.bis || '23:59');
    });
  };

  // Soll die Jumu'ah-Sonderansicht genau jetzt sichtbar sein?
  // Zyklus richtet sich nach der Uhr: in jedem Intervall die ersten
  // anzeigeSekunden lang (z. B. 12:00:00–12:00:20, 12:03:00–12:03:20 …).
  L.jumuahAnsichtJetzt = function (w, ansichtCfg) {
    if (!L.imJumuahZeitraum(w, ansichtCfg)) return false;
    var intervall = Math.max(10, ansichtCfg.intervallSekunden || 180);
    var dauer = Math.min(intervall - 5, ansichtCfg.anzeigeSekunden || 20);
    return (w.sekundeDesTages % intervall) < dauer;
  };

  /* ---------- Datum ---------- */

  L.datumText = function (tag) {
    var d = tag.split('-').map(Number);
    return WOCHENTAGE[L.wochentagVon(tag)] + ', ' + d[2] + '. ' + MONATE[d[1] - 1] + ' ' + d[0];
  };

  var hidschriFormat = null;
  L.hidschri = function (tag, korrekturTage, monatsnamen) {
    if (!hidschriFormat) {
      ['islamic-umalqura', 'islamic-civil', 'islamic'].some(function (kal) {
        try {
          var f = new Intl.DateTimeFormat('en-US-u-ca-' + kal,
            { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
          if (f.resolvedOptions().calendar.indexOf('islamic') === 0) { hidschriFormat = f; return true; }
        } catch (e) { /* nächsten Kalender probieren */ }
        return false;
      });
      if (!hidschriFormat) return '';
    }
    var d = L.tagPlus(tag, korrekturTage || 0).split('-').map(Number);
    var t = {};
    hidschriFormat.formatToParts(new Date(Date.UTC(d[0], d[1] - 1, d[2], 12)))
      .forEach(function (p) { if (p.type !== 'literal') t[p.type] = parseInt(p.value, 10); });
    var jahr = t.year || t.relatedYear;
    return t.day + '. ' + (monatsnamen[t.month - 1] || t.month) + ' ' + jahr + ' n. H.';
  };

  /* ---------- Vers des Tages ---------- */

  L.versDesTages = function (tag, verse) {
    if (!verse || !verse.length) return null;
    var d = tag.split('-').map(Number);
    var tagNr = Math.round(Date.UTC(d[0], d[1] - 1, d[2]) / 86400000);
    return verse[tagNr % verse.length];
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  else global.Logik = L;
})(this);
