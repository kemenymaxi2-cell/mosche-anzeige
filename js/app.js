/* Steuerung der Anzeige: Uhr, Gebetszeiten, Jumu'ah-Wechsel, Hintergrund.

   Test-Parameter in der Adresszeile (mit & kombinierbar):
     ?theme=1 … 5               Design wählen
     ?now=2026-10-29T12:00      Datum/Uhrzeit simulieren (Ortszeit Marktoberdorf)
     ?speed=60                  simulierte Zeit läuft 60-mal so schnell
     ?jumuah=immer | aus        Jumu'ah-Ansicht dauerhaft zeigen bzw. nie zeigen
     ?stream=aus                Livestream abschalten (nur Ersatz-Hintergrund)
     ?modus=hell | dunkel       Design 5: hellen/dunklen Modus erzwingen
     ?diagnose=1                zeigt unten, was die Anzeige gerade „denkt“ (Wochentag,
                                Jumu'ah-Zeitraum, nächster Wechsel, Programmversion)  */
(function () {
  'use strict';

  var VERSION = '2026-10-28c';   // bei jeder Änderung erhöhen (auch in index.html)
  var CFG = window.CONFIG, L = window.Logik, TZ = CFG.ZEITZONE || 'Europe/Berlin';
  var param = new URLSearchParams(location.search);
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Zeitquelle (echt oder simuliert) ---------- */

  var simStartMs = null, echtStartMs = Date.now(), tempo = Number(param.get('speed')) || 1;
  var nowParam = param.get('now');
  if (nowParam) {
    var m = nowParam.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}:\d{2}(?::\d{2})?))?$/);
    if (m) simStartMs = L.zeitpunkt(m[1], m[2] || '12:00', TZ);
  }
  function jetzt() {
    return simStartMs === null ? Date.now() : simStartMs + (Date.now() - echtStartMs) * tempo;
  }

  /* ---------- Design ---------- */

  var theme = Number(param.get('theme')) || Number(CFG.THEME) || 1;
  if (theme < 1 || theme > 5) theme = 1;
  document.body.className = 'theme-' + theme;

  var root = document.documentElement.style;
  root.setProperty('--abdunklung', String(CFG.STREAM.abdunklung));
  root.setProperty('--ueberblendung', (CFG.JUMUAH_ANSICHT.ueberblendungMs || 1500) + 'ms');
  if (CFG.LOGO_TAG || CFG.LOGO_NACHT) {
    // Mehrfarbiges Logo: je ein Bild für Tag und Nacht, CSS blendet passend zum Modus um
    Array.prototype.forEach.call(document.querySelectorAll('.logo-glas'), function (el) {
      el.classList.add('mehrfarbig');
      el.innerHTML = '<img class="logo-tag" alt=""><img class="logo-nacht" alt="">';
      el.firstChild.src = CFG.LOGO_TAG || CFG.LOGO_NACHT;
      el.lastChild.src = CFG.LOGO_NACHT || CFG.LOGO_TAG;
    });
  } else if (CFG.LOGO) {
    Array.prototype.forEach.call(document.querySelectorAll('.logo'), function (el) {
      if (location.protocol === 'file:') {
        // Per Doppelklick geöffnet: Masken aus Dateien sind gesperrt → Logo als Bild zeigen
        el.classList.add('logo-bild');
        el.innerHTML = '<img alt="" src="' + CFG.LOGO + '">';
      } else {
        el.style.webkitMaskImage = el.style.maskImage = 'url("' + CFG.LOGO + '")';
      }
    });
  } else document.body.classList.add('ohne-logo');

  // Design 5: eigene Stärke von Stream-Blur, Glas und Schleier
  var D5 = CFG.DESIGN_5 || {};
  var streamCfg = CFG.STREAM;
  if (theme === 5) {
    streamCfg = Object.assign({}, CFG.STREAM, { blurPx: D5.streamBlurPx != null ? D5.streamBlurPx : 4 });
    root.setProperty('--glas-blur', (D5.glasUnschaerfePx != null ? D5.glasUnschaerfePx : 30) + 'px');
    root.setProperty('--schleier-hell', String(D5.schleierHell != null ? D5.schleierHell : 0.55));
    root.setProperty('--schleier-dunkel', String(D5.schleierDunkel != null ? D5.schleierDunkel : 0.5));
  }

  if (CFG.HINTERGRUNDBILD) {
    // Bild nur zeigen, wenn es tatsächlich geladen werden kann.
    var bild = new Image();
    bild.onload = function () {
      $('bg-bild').style.backgroundImage = 'url("' + CFG.HINTERGRUNDBILD + '")';
      document.body.classList.add('hat-bild');
    };
    bild.src = CFG.HINTERGRUNDBILD;
  }

  // 1920×1080-Bühne auf jede Bildschirmgröße einpassen.
  function skalieren() {
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    var b = $('buehne');
    b.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }
  addEventListener('resize', skalieren);
  skalieren();

  /* ---------- Statische Inhalte ---------- */

  $('moschee-name').textContent = CFG.MOSCHEE_NAME || '';

  var TEXTE = CFG.TEXTE || {};
  TEXTE.naechstesGebet = TEXTE.naechstesGebet || 'Nächstes Gebet';
  TEXTE.morgen = TEXTE.morgen || 'morgen';
  $('n-label').textContent = TEXTE.naechstesGebet;

  var kacheln = {};
  L.SCHLUESSEL.forEach(function (k) {
    var g = CFG.GEBETE[k] || { name: k, deutsch: '' };
    var el = document.createElement('div');
    el.className = 'gebet' + (k === 'shuruq' ? ' kein-gebet' : '');
    el.innerHTML = '<div class="g-glow"></div><div class="g-name"></div><div class="g-deutsch"></div><div class="g-zeit">--:--</div>';
    el.querySelector('.g-name').textContent = g.name;
    el.querySelector('.g-deutsch').textContent = g.deutsch;
    $('gebete').appendChild(el);
    kacheln[k] = el;
  });

  // Piktogramme für die Mitte der QR-Codes (Koordinaten 0–24)
  var QR_LOGOS = {
    instagram:
      '<defs><radialGradient id="ig-verlauf" cx=".25" cy="1.05" r="1.25">' +
      '<stop offset="0" stop-color="#FED373"/><stop offset=".25" stop-color="#F15245"/>' +
      '<stop offset=".55" stop-color="#D92E7F"/><stop offset=".8" stop-color="#9B36B7"/>' +
      '<stop offset="1" stop-color="#515ECF"/></radialGradient></defs>' +
      '<rect width="24" height="24" rx="6.5" fill="url(#ig-verlauf)"/>' +
      '<rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" stroke-width="1.9"/>' +
      '<circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" stroke-width="1.9"/>' +
      '<circle cx="16.1" cy="7.9" r="1.1" fill="#fff"/>',
    whatsapp:
      '<rect width="24" height="24" rx="6.5" fill="#25D366"/>' +
      '<path d="M12 4.6a7.4 7.4 0 0 0-6.4 11.1l-1 3.7 3.8-1A7.4 7.4 0 1 0 12 4.6z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M9.4 8.6c.2-.4.4-.4.6-.4h.4c.2 0 .3 0 .5.4l.6 1.4c.1.2 0 .4-.1.5l-.4.5c-.1.1-.2.3 0 .5.3.5.8 1.1 1.3 1.5.6.5 1.1.7 1.4.8.2.1.3 0 .5-.1l.5-.7c.1-.2.3-.2.5-.1l1.3.6c.2.1.4.2.4.3 0 .2 0 .8-.3 1.1-.3.4-1 .8-1.6.8-.5 0-1.3-.1-2.6-.8-1.6-.8-2.6-2.4-2.8-2.6-.2-.2-.8-1.1-.8-2 0-.9.4-1.4.6-1.6z" fill="#fff"/>',
  };

  function qrZeichnen(ziel, url, logo) {
    try {
      // Fehlerkorrektur „H“: bis zu 30 % des Codes dürfen verdeckt sein – Platz für das Logo
      var qr = qrcode(0, logo ? 'H' : 'M');
      qr.addData(url);
      qr.make();
      var n = qr.getModuleCount(), rand = 4, pfad = '';   // 4 Module Ruhezone: Pflicht für zuverlässiges Scannen
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        if (qr.isDark(y, x)) pfad += 'M' + (x + rand) + ',' + (y + rand) + 'h1v1h-1z';
      }
      var g = n + 2 * rand, mitte = '';
      if (logo && QR_LOGOS[logo]) {
        // Logo ca. 20 % der Breite (≈ 4 % der Fläche), mit weißem Rand
        var gr = Math.round(n * 0.20), feld = gr + 2, pos = (g - feld) / 2;
        mitte = '<rect x="' + pos + '" y="' + pos + '" width="' + feld + '" height="' + feld + '" rx="' + feld * 0.3 + '" class="qr-hg"/>' +
          '<svg x="' + (pos + 1) + '" y="' + (pos + 1) + '" width="' + gr + '" height="' + gr + '" viewBox="0 0 24 24" shape-rendering="geometricPrecision">' +
          QR_LOGOS[logo] + '</svg>';
      }
      ziel.innerHTML = '<svg viewBox="0 0 ' + g + ' ' + g + '" shape-rendering="crispEdges">' +
        '<rect width="' + g + '" height="' + g + '" class="qr-hg"/><path d="' + pfad + '" class="qr-vg"/>' + mitte + '</svg>';
    } catch (e) { ziel.textContent = ''; }
  }

  // Kleine Symbole vor dem Titel, damit man sieht, wohin der QR-Code führt.
  var SYMBOLE = {
    instagram: '<svg class="qr-symbol" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5.5"/>' +
      '<circle cx="12" cy="12" r="4.2"/><circle class="voll" cx="17.4" cy="6.6" r="1.2"/></svg>',
    whatsapp: '<svg class="qr-symbol" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2z"/></svg>',
  };

  // Titel (mit Symbol) und Text darunter setzen. Bei langen Namen darf nach
  // jedem „_“ bzw. „.“ umbrochen werden – so bleibt das @ immer sichtbar.
  function qrBeschriften(id, symbol, titel, text) {
    var t = $(id + '-titel'), h = $(id + '-handle');
    t.innerHTML = SYMBOLE[symbol] + '<span></span>';
    t.lastChild.textContent = titel || '';
    h.textContent = '';
    String(text).replace(/([_.])/g, '$1\n').split('\n').forEach(function (teil, i) {
      if (i) h.appendChild(document.createElement('wbr'));
      h.appendChild(document.createTextNode(teil));
    });
  }

  function instagram(id, handle, titel) {
    var name = String(handle || '').trim().replace(/^@/, '');
    qrZeichnen($(id), 'https://instagram.com/' + encodeURIComponent(name), 'instagram');
    qrBeschriften(id, 'instagram', titel, '@' + name);
  }
  instagram('qr-moschee', CFG.INSTAGRAM_MOSCHEE, CFG.INSTAGRAM_MOSCHEE_TITEL);
  instagram('qr-jugend', CFG.INSTAGRAM_JUGEND, CFG.INSTAGRAM_JUGEND_TITEL);

  if (CFG.WHATSAPP_KANAL) {
    qrZeichnen($('qr-whatsapp'), CFG.WHATSAPP_KANAL, 'whatsapp');
    qrBeschriften('qr-whatsapp', 'whatsapp', CFG.WHATSAPP_KANAL_TITEL || 'WhatsApp', CFG.WHATSAPP_KANAL_TEXT || '');
  } else {
    $('qr-whatsapp').parentNode.style.display = 'none';
  }

  /* ---------- Laufende Aktualisierung ---------- */

  var zuletzt = { sekunde: null, tag: null, jumuah: null };

  function setzeText(id, text) {
    var el = $(id);
    if (el.textContent !== text) el.textContent = text;
  }

  // Lange Verse: Schrift verkleinern, bis alles in die Karte passt.
  function versEinpassen() {
    var karte = document.querySelector('.vers-karte'), text = $('vers-text');
    text.style.fontSize = '';
    var groesse = parseFloat(getComputedStyle(text).fontSize);
    function benoetigt() {
      var h = 0, st = getComputedStyle(karte);
      Array.prototype.forEach.call(karte.children, function (k) {
        var s = getComputedStyle(k);
        h += k.offsetHeight + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
      });
      return h + parseFloat(st.paddingTop) + parseFloat(st.paddingBottom);
    }
    while (benoetigt() > karte.clientHeight && groesse > 24) {
      groesse -= 1;
      text.style.fontSize = groesse + 'px';
    }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(versEinpassen);

  function tagesInhalte(w) {
    var tuerkisch = CFG.HIDSCHRI_TUERKISCH !== false;
    setzeText('datum', L.datumZahlen(w.tag, tuerkisch && CFG.WOCHENTAGE_TUERKISCH));
    // Hidschri-Datum: Monat auf Türkisch / in Umschrift
    setzeText('hidschri', L.hidschriZweisprachig(w.tag, CFG.HIDSCHRI_KORREKTUR_TAGE,
      tuerkisch && CFG.HIDSCHRI_MONATE_TUERKISCH, CFG.HIDSCHRI_MONATE));

    var vers = L.versFuerTag(w.tag, CFG.VERSE, CFG.VERSE_FEST, CFG.HIDSCHRI_KORREKTUR_TAGE);
    setzeText('vers-text', vers ? '„' + vers.text + '“' : '');
    setzeText('vers-quelle', vers ? 'Sure ' + vers.sure + ' · ' + vers.stelle : '');
    versEinpassen();
  }

  // Freitagsgebet (dezent oben rechts) und Sonderansicht – wird jede Minute geprüft,
  // damit am Freitag nach dem Gebet der nächste Freitag erscheint.
  function jumuahInhalte(w) {
    var ziel = L.jumuahZiel(w, CFG.JUMUAH, TZ);
    var schluessel = ziel.tag + ziel.uhrzeit + ziel.wann;
    if (schluessel === zuletzt.jumuahZiel) return;
    zuletzt.jumuahZiel = schluessel;
    var freitag = ziel.tag, jZeit = ziel.uhrzeit, wann = ziel.wann;
    var fd = freitag.split('-');
    $('jumuah-mini').innerHTML = '';
    if (CFG.JUMUAH.aufHauptbildschirm) {
      $('jumuah-mini').innerHTML = '<span class="jm-label"></span> ' +
        '<span class="jm-tag"></span> <span class="jm-zeit"></span>';
      $('jumuah-mini').querySelector('.jm-label').textContent = CFG.JUMUAH.bezeichnung || 'Freitagsgebet';
      $('jumuah-mini').querySelector('.jm-tag').textContent = wann ? wann : 'Fr., ' + Number(fd[2]) + '.' + Number(fd[1]) + '.';
      $('jumuah-mini').querySelector('.jm-zeit').textContent = jZeit;
    }
    setzeText('j-zeit', jZeit);
    var jd = $('j-datum');
    jd.innerHTML = wann ? '<span class="j-wann"></span> · <span></span>' : '<span></span>';
    if (wann) jd.firstChild.textContent = wann;
    jd.lastChild.textContent = L.datumText(freitag);
  }

  function zeitenAnzeigen(w) {
    var heute = Daten.zeiten(w.tag), morgen = Daten.zeiten(L.tagPlus(w.tag, 1));
    L.SCHLUESSEL.forEach(function (k) {
      var z = kacheln[k].querySelector('.g-zeit'), t = heute ? heute[k] : '--:--';
      if (z.textContent !== t) z.textContent = t;
    });

    var st = L.zustand(jetzt(), TZ, w.tag, { heute: heute, morgen: morgen },
      { fajrVorShuruqMin: CFG.FAJR_MINUTEN_VOR_SHURUQ });
    L.SCHLUESSEL.forEach(function (k) {
      kacheln[k].classList.toggle('aktuell', st.aktuell === k);
      kacheln[k].classList.toggle('naechstes', !!st.naechstes && st.naechstes.schluessel === k &&
        st.naechstes.tag === w.tag);
    });

    if (!heute) {
      setzeText('n-name', '–');
      setzeText('n-deutsch', '');
      setzeText('n-countdown', 'Gebetszeiten werden geladen …');
      setzeText('n-hinweis', '');
      return;
    }
    if (!st.naechstes) {
      setzeText('n-name', CFG.GEBETE.fajr.name);
      setzeText('n-deutsch', CFG.GEBETE.fajr.deutsch);
      setzeText('n-countdown', TEXTE.morgen);
      setzeText('n-hinweis', '');
      return;
    }
    var g = CFG.GEBETE[st.naechstes.schluessel];
    var uhr = L.wanduhr(st.naechstes.ms, TZ);
    setzeText('n-name', g.name);
    setzeText('n-deutsch', g.deutsch);
    setzeText('n-countdown', L.dauerText(st.naechstes.ms - jetzt()));

    var hinweis = 'um ' + L.zwei(uhr.h) + ':' + L.zwei(uhr.mi) + (st.naechstes.tag !== w.tag ? ' (' + TEXTE.morgen + ')' : '');
    if (st.fajrEndeMs) {
      var s = L.wanduhr(st.fajrEndeMs, TZ);
      hinweis = CFG.GEBETE.fajr.name + '-Zeit endet in ' + L.dauerText(st.fajrEndeMs - jetzt()) +
        ' (' + CFG.GEBETE.shuruq.name + ' ' + L.zwei(s.h) + ':' + L.zwei(s.mi) + ')';
    } else if (w.wochentag === 5 && st.naechstes.schluessel === 'dhuhr') {
      hinweis += ' · Freitagsgebet ' + L.jumuahUhrzeit(CFG.JUMUAH, w.tag, TZ);
    }
    setzeText('n-hinweis', hinweis);
  }

  // Design 5: hell/dunkel je nach Tageszeit (zwischen hellAb und dunkelAb hell).
  function modusSetzen(w) {
    if (theme !== 5) return;
    var modus = param.get('modus') || D5.modus || 'auto';
    if (modus === 'auto') {
      var z = Daten.zeiten(w.tag);
      var hell = z ? z[D5.hellAb || 'fajr'] : '06:00', dunkel = z ? z[D5.dunkelAb || 'maghrib'] : '18:00';
      var min = w.h * 60 + w.mi;
      modus = (min >= L.minuten(hell) && min < L.minuten(dunkel)) ? 'hell' : 'dunkel';
    }
    if (zuletzt.modus === modus) return;
    zuletzt.modus = modus;
    document.body.classList.toggle('modus-hell', modus === 'hell');
    document.body.classList.toggle('modus-dunkel', modus !== 'hell');
  }

  function jumuahUmschalten(w) {
    var modus = param.get('jumuah');
    var an = modus === 'immer' ? true : modus === 'aus' ? false : L.jumuahAnsichtJetzt(w, CFG.JUMUAH_ANSICHT);
    if (an === zuletzt.jumuah) return;
    zuletzt.jumuah = an;
    $('jumuah').classList.toggle('sichtbar', an);
    $('haupt').classList.toggle('sichtbar', !an);
    $('jumuah').setAttribute('aria-hidden', String(!an));
    document.body.classList.toggle('jumuah-aktiv', an);
  }

  var datenBereit = false;
  function datenNachladen(tag) {
    if (!datenBereit) return;
    Daten.sicherstellen([tag, L.tagPlus(tag, 1)]);
  }

  function takt() {
    try {
      var ms = jetzt(), w = L.wanduhr(ms, TZ);
      var sekunde = Math.floor(ms / 1000);
      if (sekunde === zuletzt.sekunde) return;
      zuletzt.sekunde = sekunde;

      setzeText('uhr-hhmm', L.zwei(w.h) + ':' + L.zwei(w.mi));
      setzeText('uhr-sek', L.zwei(w.s));

      if (w.tag !== zuletzt.tag) {
        zuletzt.tag = w.tag;
        schritt(tagesInhalte, w);
        schritt(datenNachladen, w.tag);
      }
      // Jeder Teil für sich: Ein Fehler in einem Teil darf die anderen
      // (z. B. den Wechsel zur Jumu'ah-Ansicht) nicht aufhalten.
      schritt(jumuahInhalte, w);
      schritt(zeitenAnzeigen, w);
      schritt(modusSetzen, w);
      schritt(jumuahUmschalten, w);
      schritt(diagnose, w);
      if (simStartMs !== null) {
        setzeText('sim-hinweis', 'Simulation: ' + w.d + '.' + w.m + '.' + w.y + ' ' +
          L.zwei(w.h) + ':' + L.zwei(w.mi) + ':' + L.zwei(w.s) + (tempo !== 1 ? ' (×' + tempo + ')' : ''));
      }
    } catch (e) {
      console.error(e);
    }
  }

  var WOCHENTAG_NAMEN = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  function diagnose(w) {
    if (param.get('diagnose') !== '1') return;
    var ja = CFG.JUMUAH_ANSICHT || {}, z = L.jumuahZeitraum(w, ja);
    var n = L.jumuahNaechsteEinblendung(w, ja), naechste = 'heute keine mehr';
    if (zuletzt.jumuah) naechste = 'läuft gerade';
    else if (n !== null) naechste = L.zwei(Math.floor(n / 3600)) + ':' + L.zwei(Math.floor(n / 60) % 60) + ':' + L.zwei(n % 60);
    setzeText('diagnose',
      'Version ' + VERSION + ' · ' + WOCHENTAG_NAMEN[w.wochentag] + ' ' + L.zwei(w.h) + ':' + L.zwei(w.mi) + ':' + L.zwei(w.s) +
      ' (' + TZ + ') · Jumu\'ah-Ansicht ' + (ja.aktiv ? 'aktiv' : 'AUS') +
      ' · Zeitraum jetzt: ' + (z ? z.von + '–' + z.bis + ' ' + (z.modus || ja.modus || 'gemischt') : 'nein') +
      ' · alle ' + (ja.intervallSekunden || 180) + ' s für ' + (ja.anzeigeSekunden || 20) + ' s' +
      ' · nächste Einblendung: ' + naechste);
  }

  function schritt(f, arg) {
    try { f(arg); } catch (e) { console.error(e); }
  }

  /* ---------- Wartung ---------- */

  // Fehlende Gebetszeiten regelmäßig erneut versuchen; Datei alle 6 Std. neu einlesen.
  setInterval(function () { if (zuletzt.tag) datenNachladen(zuletzt.tag); }, 5 * 60000);
  setInterval(function () { Daten.neuLaden(); }, 6 * 3600000);

  // Tägliches Neuladen (nach echter Uhrzeit, nicht im Simulationsmodus).
  setInterval(function () {
    if (simStartMs !== null || performance.now() < 30 * 60000) return;
    var w = L.wanduhr(Date.now(), TZ);
    if (L.zwei(w.h) + ':' + L.zwei(w.mi) === (CFG.NEULADEN_UM || '03:00')) location.reload();
  }, 20000);

  // Burn-in-Schutz: Layout langsam um wenige Pixel verschieben.
  var bs = CFG.BURNIN_SCHUTZ || {};
  if (bs.aktiv) {
    setInterval(function () {
      var p = bs.maxPixel || 8;
      root.setProperty('--versatz-x', Math.round((Math.random() * 2 - 1) * p) + 'px');
      root.setProperty('--versatz-y', Math.round((Math.random() * 2 - 1) * p) + 'px');
    }, Math.max(1, bs.alleMinuten || 4) * 60000);
  }

  // Simulation bzw. Diagnose sichtbar kennzeichnen.
  if (simStartMs !== null) document.body.classList.add('simulation');
  if (param.get('diagnose') === '1') document.body.classList.add('diagnose');

  /* ---------- Start ---------- */

  var bereit = Daten.init(CFG);
  takt();
  setInterval(takt, tempo > 1 ? 100 : 250);
  bereit.then(function () {
    datenBereit = true;
    zuletzt.tag = null;   // Tagesinhalte mit geladenen Daten neu aufbauen
    takt();
  });
  if (param.get('stream') !== 'aus') Stream.start(streamCfg);
})();
