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
  // optionen.fajrVorShuruqMin: Wird das Fajr-Gebet gemeinsam erst kurz vor Sonnenaufgang
  //   verrichtet (z. B. 30 Min. vor Shuruq), gilt diese Uhrzeit als „nächstes Gebet“.
  //   Das aktuelle Gebetsfenster beginnt trotzdem schon zur Fajr-Zeit (İmsak).
  L.zustand = function (jetztMs, tz, heuteTag, zeiten, optionen) {
    var heute = zeiten.heute, morgen = zeiten.morgen;
    var vorShuruq = (optionen && optionen.fajrVorShuruqMin) || 0;
    function fajrGebet(tag, z) {
      var imsak = L.zeitpunkt(tag, z.fajr, tz);
      return vorShuruq ? Math.max(imsak, L.zeitpunkt(tag, z.shuruq, tz) - vorShuruq * 60000) : imsak;
    }
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

    // Nächstes Gebet (Shuruq wird übersprungen, Fajr zur Gebetszeit der Gemeinde).
    for (var i = 0; i < ereignisse.length; i++) {
      var e = ereignisse[i];
      if (e.schluessel === 'fajr') e = { schluessel: 'fajr', ms: fajrGebet(heuteTag, heute), tag: heuteTag };
      if (e.schluessel !== 'shuruq' && e.ms > jetztMs) { erg.naechstes = e; break; }
    }
    if (!erg.naechstes && morgen) {
      var morgenTag = L.tagPlus(heuteTag, 1);
      erg.naechstes = { schluessel: 'fajr', ms: fajrGebet(morgenTag, morgen), tag: morgenTag };
    }
    // Hinweis „Fajr-Zeit endet …“ erst, wenn das Fajr-Gebet nicht mehr bevorsteht.
    if (erg.naechstes && erg.naechstes.schluessel === 'fajr') erg.fajrEndeMs = null;
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

  // Welches Freitagsgebet wird angezeigt? Am Freitag selbst bleibt es „Heute“, bis
  // jumuahCfg.heuteBisMinutenNach (Standard 120) Minuten nach Beginn vergangen sind –
  // danach der Freitag der nächsten Woche.
  // Ergebnis: { tag: "YYYY-MM-DD", uhrzeit: "HH:MM", wann: "Heute" | "Morgen" | "" }
  // Geplante Uhrzeit-Änderungen (jumuahCfg.aenderungen) berücksichtigen:
  // Liefert die Einstellungen, die zum Zeitpunkt w gelten, und – falls eine Änderung
  // genau heute wirksam wurde – deren Zeitpunkt.
  // Eintrag: { sichtbarAb: "2026-10-30 13:30", uhrzeitWinter: "13:15", uhrzeitSommer: "…" }
  L.jumuahCfgJetzt = function (jumuahCfg, w) {
    var jetzt = w.tag + ' ' + L.zwei(w.h) + ':' + L.zwei(w.mi);
    var erg = {}, heuteGewechselt = false;
    Object.keys(jumuahCfg).forEach(function (k) { erg[k] = jumuahCfg[k]; });
    (jumuahCfg.aenderungen || []).slice().sort(function (a, b) {
      return String(a.sichtbarAb) < String(b.sichtbarAb) ? -1 : 1;
    }).forEach(function (a) {
      var ab = String(a.sichtbarAb || '').replace('T', ' ');
      if (!ab || ab > jetzt) return;
      if (a.uhrzeitSommer) erg.uhrzeitSommer = a.uhrzeitSommer;
      if (a.uhrzeitWinter) erg.uhrzeitWinter = a.uhrzeitWinter;
      if (ab.slice(0, 10) === w.tag) heuteGewechselt = true;
    });
    erg.heuteGewechselt = heuteGewechselt;
    return erg;
  };

  // Liegt der Zeitpunkt w im Fenster [ab, bis)? ab/bis als "YYYY-MM-DD HH:MM", beide optional.
  L.imZeitfenster = function (w, ab, bis) {
    var jetzt = w.tag + ' ' + L.zwei(w.h) + ':' + L.zwei(w.mi);
    if (ab && jetzt < String(ab).replace('T', ' ')) return false;
    if (bis && jetzt >= String(bis).replace('T', ' ')) return false;
    return true;
  };

  L.jumuahZiel = function (w, jumuahCfgBasis, tz) {
    var jumuahCfg = L.jumuahCfgJetzt(jumuahCfgBasis, w);
    var freitag = L.naechsterFreitag(w.tag);
    var uhrzeit = L.jumuahUhrzeit(jumuahCfg, freitag, tz);
    var nach = jumuahCfg.heuteBisMinutenNach != null ? jumuahCfg.heuteBisMinutenNach : 120;
    // Am Freitag ist das heutige Gebet vorbei, wenn die Nachlaufzeit um ist –
    // oder wenn heute eine neue Uhrzeit wirksam wurde (dann zeigt die Anzeige
    // sofort den nächsten Freitag mit der neuen Uhrzeit).
    if (freitag === w.tag && (jumuahCfg.heuteGewechselt || w.h * 60 + w.mi >= L.minuten(uhrzeit) + nach)) {
      freitag = L.tagPlus(w.tag, 7);
      uhrzeit = L.jumuahUhrzeit(jumuahCfg, freitag, tz);
    }
    var wann = freitag === w.tag ? 'Heute' : freitag === L.tagPlus(w.tag, 1) ? 'Morgen' : '';
    return { tag: freitag, uhrzeit: uhrzeit, wann: wann };
  };

  // Liegt die Wanduhrzeit w in einem der konfigurierten Zeiträume?
  // Der passende Zeitraum aus der Konfiguration (oder null).
  L.jumuahZeitraum = function (w, ansichtCfg) {
    if (!ansichtCfg || !ansichtCfg.aktiv) return null;
    var minute = w.h * 60 + w.mi, treffer = null;
    (ansichtCfg.zeitraeume || []).some(function (z) {
      if (z.wochentag === w.wochentag &&
        minute >= L.minuten(z.von || '00:00') && minute <= L.minuten(z.bis || '23:59')) treffer = z;
      return !!treffer;
    });
    return treffer;
  };

  L.imJumuahZeitraum = function (w, ansichtCfg) {
    return !!L.jumuahZeitraum(w, ansichtCfg);
  };

  // Soll die Jumu'ah-Sonderansicht genau jetzt sichtbar sein?
  // Zyklus richtet sich nach der Uhr: in jedem Intervall die ersten
  // anzeigeSekunden lang (z. B. 12:00:00–12:00:20, 12:03:00–12:03:20 …).
  // Modus „nur_jumuah“: im Zeitraum dauerhaft die Jumu'ah-Ansicht, kein Wechsel.
  L.jumuahAnsichtJetzt = function (w, ansichtCfg) {
    var z = L.jumuahZeitraum(w, ansichtCfg);
    if (!z) return false;
    if ((z.modus || ansichtCfg.modus) === 'nur_jumuah') return true;
    var intervall = Math.max(10, ansichtCfg.intervallSekunden || 180);
    var dauer = Math.min(intervall - 5, ansichtCfg.anzeigeSekunden || 20);
    return (w.sekundeDesTages % intervall) < dauer;
  };

  // Sekunde des Tages, zu der die Jumu'ah-Ansicht heute das nächste Mal erscheint
  // (null = heute nicht mehr). Nur für die Diagnose-Anzeige.
  L.jumuahNaechsteEinblendung = function (w, ansichtCfg) {
    if (!ansichtCfg || !ansichtCfg.aktiv) return null;
    var intervall = Math.max(10, ansichtCfg.intervallSekunden || 180);
    var beste = null;
    (ansichtCfg.zeitraeume || []).forEach(function (z) {
      if (z.wochentag !== w.wochentag) return;
      var von = L.minuten(z.von || '00:00') * 60, bis = L.minuten(z.bis || '23:59') * 60 + 59;
      var ab = Math.max(von, w.sekundeDesTages);
      var t = (z.modus || ansichtCfg.modus) === 'nur_jumuah' ? ab : Math.ceil(ab / intervall) * intervall;
      if (t <= bis && (beste === null || t < beste)) beste = t;
    });
    return beste;
  };

  /* ---------- Datum ---------- */

  L.datumText = function (tag) {
    var d = tag.split('-').map(Number);
    return WOCHENTAGE[L.wochentagVon(tag)] + ', ' + d[2] + '. ' + MONATE[d[1] - 1] + ' ' + d[0];
  };

  // „Çarşamba / Mittwoch, 28.10.2026“ (ohne türkische Namen: „Mittwoch, 28.10.2026“)
  L.datumZahlen = function (tag, wochentageTuerkisch) {
    var d = tag.split('-'), wt = L.wochentagVon(tag);
    var tr = wochentageTuerkisch && wochentageTuerkisch[wt];
    return (tr ? tr + ' / ' : '') + WOCHENTAGE[wt] + ', ' + d[2] + '.' + d[1] + '.' + d[0];
  };

  var hidschriFormat = null;
  // Hidschri-Datum als Zahlen: { tag, monat (1–12), jahr } oder null.
  L.hidschriTeile = function (tag, korrekturTage) {
    if (!hidschriFormat) {
      ['islamic-umalqura', 'islamic-civil', 'islamic'].some(function (kal) {
        try {
          var f = new Intl.DateTimeFormat('en-US-u-ca-' + kal,
            { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
          if (f.resolvedOptions().calendar.indexOf('islamic') === 0) { hidschriFormat = f; return true; }
        } catch (e) { /* nächsten Kalender probieren */ }
        return false;
      });
      if (!hidschriFormat) return null;
    }
    var d = L.tagPlus(tag, korrekturTage || 0).split('-').map(Number);
    var t = {};
    hidschriFormat.formatToParts(new Date(Date.UTC(d[0], d[1] - 1, d[2], 12)))
      .forEach(function (p) { if (p.type !== 'literal') t[p.type] = parseInt(p.value, 10); });
    return { tag: t.day, monat: t.month, jahr: t.year || t.relatedYear };
  };

  // „14. Dschumada l-Ula 1448 n. H.“
  L.hidschri = function (tag, korrekturTage, monatsnamen) {
    var h = L.hidschriTeile(tag, korrekturTage);
    return h ? h.tag + '. ' + (monatsnamen[h.monat - 1] || h.monat) + ' ' + h.jahr + ' n. H.' : '';
  };

  // „17. Cemaziyelevvel / Dschumada l-Ula 1448“ (ohne türkische Namen: „17. Dschumada l-Ula 1448“)
  L.hidschriZweisprachig = function (tag, korrekturTage, monateTuerkisch, monateUmschrift) {
    var h = L.hidschriTeile(tag, korrekturTage);
    if (!h) return '';
    var tr = monateTuerkisch && monateTuerkisch[h.monat - 1];
    var um = (monateUmschrift && monateUmschrift[h.monat - 1]) || h.monat;
    return h.tag + '. ' + (tr ? tr + ' / ' : '') + um + ' ' + h.jahr;
  };

  // Türkische Schreibweise wie bei Diyanet: „14 Cemaziyelevvel 1448“
  L.hidschriTuerkisch = function (tag, korrekturTage, monatsnamen) {
    var h = L.hidschriTeile(tag, korrekturTage);
    return h ? h.tag + ' ' + (monatsnamen[h.monat - 1] || h.monat) + ' ' + h.jahr : '';
  };

  /* ---------- Vers des Tages ---------- */

  L.versDesTages = function (tag, verse) {
    if (!verse || !verse.length) return null;
    var d = tag.split('-').map(Number);
    var tagNr = Math.round(Date.UTC(d[0], d[1] - 1, d[2]) / 86400000);
    return verse[tagNr % verse.length];
  };

  /* Fester Vers für bestimmte Tage (Vorrang vor der täglichen Reihenfolge).
     Jeder Eintrag in `fest` nennt, wann er gilt – je genauer, desto höher der Vorrang:
       datum: "2026-11-06"                    → genau dieses Datum
       hidschriMonat: 1, hidschriTag: 10       → jedes Jahr an diesem islamischen Datum
       hidschriMonat: 9                        → der ganze islamische Monat (z. B. Ramadan)
       wochentag: 5                            → jede Woche an diesem Tag (5 = Freitag)
     Passen mehrere gleich genaue Einträge, wechseln sie sich täglich ab. */
  L.versFuerTag = function (tag, verse, fest, hidschriKorrektur) {
    var h = null, beste = -1, kandidaten = [];
    (fest || []).forEach(function (v) {
      var rang = -1;
      if (v.datum) rang = v.datum === tag ? 4 : -1;
      else if (v.hidschriMonat) {
        h = h || L.hidschriTeile(tag, hidschriKorrektur) || {};
        if (v.hidschriMonat === h.monat && (!v.hidschriTag || v.hidschriTag === h.tag)) rang = v.hidschriTag ? 3 : 2;
      } else if (v.wochentag !== undefined) rang = v.wochentag === L.wochentagVon(tag) ? 1 : -1;
      if (rang > beste) { beste = rang; kandidaten = []; }
      if (rang >= 0 && rang === beste) kandidaten.push(v);
    });
    return kandidaten.length ? L.versDesTages(tag, kandidaten) : L.versDesTages(tag, verse);
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  else global.Logik = L;
})(this);
