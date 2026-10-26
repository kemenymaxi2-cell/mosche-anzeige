/* Steuerung der Anzeige: Uhr, Gebetszeiten, Jumu'ah-Wechsel, Hintergrund.

   Test-Parameter in der Adresszeile (mit & kombinierbar):
     ?theme=1 … 4               Design wählen
     ?now=2026-10-29T12:00      Datum/Uhrzeit simulieren (Ortszeit Marktoberdorf)
     ?speed=60                  simulierte Zeit läuft 60-mal so schnell
     ?jumuah=immer | aus        Jumu'ah-Ansicht dauerhaft zeigen bzw. nie zeigen
     ?stream=aus                Livestream abschalten (nur Ersatz-Hintergrund)  */
(function () {
  'use strict';

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
  if (CFG.LOGO) {
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

  function qrZeichnen(ziel, url) {
    try {
      var qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      var n = qr.getModuleCount(), rand = 2, pfad = '';
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        if (qr.isDark(y, x)) pfad += 'M' + (x + rand) + ',' + (y + rand) + 'h1v1h-1z';
      }
      var g = n + 2 * rand;
      ziel.innerHTML = '<svg viewBox="0 0 ' + g + ' ' + g + '" shape-rendering="crispEdges">' +
        '<rect width="' + g + '" height="' + g + '" class="qr-hg"/><path d="' + pfad + '" class="qr-vg"/></svg>';
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
    qrZeichnen($(id), 'https://instagram.com/' + encodeURIComponent(name));
    qrBeschriften(id, 'instagram', titel, '@' + name);
  }
  instagram('qr-moschee', CFG.INSTAGRAM_MOSCHEE, CFG.INSTAGRAM_MOSCHEE_TITEL);
  instagram('qr-jugend', CFG.INSTAGRAM_JUGEND, CFG.INSTAGRAM_JUGEND_TITEL);

  if (CFG.WHATSAPP_KANAL) {
    qrZeichnen($('qr-whatsapp'), CFG.WHATSAPP_KANAL);
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
    setzeText('datum', L.datumText(w.tag));
    // Hidschri-Datum: Umschrift, daneben (falls gewünscht) auf Türkisch
    var hd = $('hidschri');
    hd.innerHTML = '<span class="h-umschrift"></span>';
    hd.firstChild.textContent = L.hidschri(w.tag, CFG.HIDSCHRI_KORREKTUR_TAGE, CFG.HIDSCHRI_MONATE);
    if (CFG.HIDSCHRI_TUERKISCH && CFG.HIDSCHRI_MONATE_TUERKISCH) {
      hd.insertAdjacentHTML('beforeend', '<span class="h-trenner"> · </span><span class="h-tuerkisch" lang="tr"></span>');
      hd.lastChild.textContent = L.hidschriTuerkisch(w.tag, CFG.HIDSCHRI_KORREKTUR_TAGE, CFG.HIDSCHRI_MONATE_TUERKISCH);
    }

    var vers = L.versDesTages(w.tag, CFG.VERSE);
    setzeText('vers-text', vers ? '„' + vers.text + '“' : '');
    setzeText('vers-quelle', vers ? 'Sure ' + vers.sure + ' · ' + vers.stelle : '');
    versEinpassen();

    // Freitagsgebet (dezent) und Sonderansicht
    var freitag = L.naechsterFreitag(w.tag);
    var jZeit = L.jumuahUhrzeit(CFG.JUMUAH, freitag, TZ);
    var wann = freitag === w.tag ? 'Heute' : freitag === L.tagPlus(w.tag, 1) ? 'Morgen' : '';
    var fd = freitag.split('-');
    $('jumuah-mini').innerHTML = '';
    if (CFG.JUMUAH.aufHauptbildschirm) {
      $('jumuah-mini').innerHTML = '<span class="jm-label">Freitagsgebet</span> ' +
        '<span class="jm-tag"></span> <span class="jm-zeit"></span>';
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

    var st = L.zustand(jetzt(), TZ, w.tag, { heute: heute, morgen: morgen });
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
      setzeText('n-countdown', 'morgen');
      setzeText('n-hinweis', '');
      return;
    }
    var g = CFG.GEBETE[st.naechstes.schluessel];
    var uhr = L.wanduhr(st.naechstes.ms, TZ);
    setzeText('n-name', g.name);
    setzeText('n-deutsch', g.deutsch);
    setzeText('n-countdown', 'in ' + L.dauerText(st.naechstes.ms - jetzt()));

    var hinweis = 'um ' + L.zwei(uhr.h) + ':' + L.zwei(uhr.mi) + (st.naechstes.tag !== w.tag ? ' (morgen)' : '');
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
        tagesInhalte(w);
        datenNachladen(w.tag);
      }
      zeitenAnzeigen(w);
      modusSetzen(w);
      jumuahUmschalten(w);
      if (simStartMs !== null) {
        setzeText('sim-hinweis', 'Simulation: ' + w.d + '.' + w.m + '.' + w.y + ' ' +
          L.zwei(w.h) + ':' + L.zwei(w.mi) + ':' + L.zwei(w.s) + (tempo !== 1 ? ' (×' + tempo + ')' : ''));
      }
    } catch (e) {
      console.error(e);
    }
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

  // Simulation sichtbar kennzeichnen.
  if (simStartMs !== null) document.body.classList.add('simulation');

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
