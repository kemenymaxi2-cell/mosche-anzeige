/* Hintergrund-Livestream (YouTube) mit Ersatz-Hintergrund.
   Der Stream wird erst eingeblendet, wenn er wirklich abspielt. Bis dahin –
   und bei jedem Fehler – bleibt der ruhige Farbverlauf bzw. das Bild sichtbar. */
(function (global) {
  'use strict';

  var cfg, huelle, iframe = null, player = null, apiAngefragt = false, erzeugtAm = 0;

  function zeigen(an) { huelle.classList.toggle('sichtbar', !!an); }

  function quelle() {
    var p = 'autoplay=1&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3' +
      '&modestbranding=1&playsinline=1&rel=0&enablejsapi=1';
    if (location.origin && location.origin !== 'null') p += '&origin=' + encodeURIComponent(location.origin);
    if (cfg.videoId) return 'https://www.youtube.com/embed/' + encodeURIComponent(cfg.videoId) + '?' + p;
    return 'https://www.youtube.com/embed/live_stream?channel=' + encodeURIComponent(cfg.kanalId) + '&' + p;
  }

  // Iframe so groß machen, dass es den Bildschirm (mit Rand) überdeckt.
  function groesse() {
    if (!iframe) return;
    var b = cfg.renderBreite || 640, h = Math.round(b * 9 / 16);
    var faktor = Math.max(innerWidth / b, innerHeight / h) * 1.12;   // Überstand verdeckt Ränder und Einblendungen
    iframe.style.width = b + 'px';
    iframe.style.height = h + 'px';
    iframe.style.transform = 'translate(-50%,-50%) scale(' + faktor + ')';
    // Der Blur wirkt vor der Skalierung, deshalb auf die interne Größe umrechnen.
    var blur = (cfg.blurPx || 0) * (innerWidth / 1920) / faktor;
    iframe.style.filter = blur > 0 ? 'blur(' + blur.toFixed(2) + 'px)' : 'none';
  }

  function playerVerbinden() {
    if (!iframe || player || !(global.YT && global.YT.Player)) return;
    player = new global.YT.Player(iframe, {
      events: {
        onReady: function (e) { try { e.target.mute(); e.target.playVideo(); } catch (x) { /* egal */ } },
        onStateChange: function (e) { zeigen(e.data === 1); },   // 1 = spielt
        onError: function () { zeigen(false); },
      },
    });
  }

  function erzeugen() {
    zeigen(false);
    if (player) { try { player.destroy(); } catch (e) { /* egal */ } player = null; }
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    iframe = document.createElement('iframe');
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('title', 'Livestream Masjid al-Haram');
    iframe.src = quelle();
    huelle.appendChild(iframe);
    erzeugtAm = Date.now();
    groesse();
    playerVerbinden();
  }

  function apiLaden() {
    if (global.YT && global.YT.Player) { playerVerbinden(); return; }
    if (apiAngefragt) return;
    apiAngefragt = true;
    global.onYouTubeIframeAPIReady = playerVerbinden;
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () {
      apiAngefragt = false;   // beim nächsten Wächter-Durchlauf erneut versuchen
      s.parentNode.removeChild(s);
      console.warn('YouTube nicht erreichbar – Ersatz-Hintergrund bleibt.');
    };
    document.head.appendChild(s);
  }

  // Wächter: Läuft der Stream nicht, wird er regelmäßig neu aufgebaut.
  function waechter() {
    var status = -1;
    try { if (player && player.getPlayerState) status = player.getPlayerState(); } catch (e) { /* egal */ }
    if (status === 1) return;
    zeigen(false);
    if (status === 2 || status === 5) { try { player.playVideo(); } catch (e) { /* egal */ } }
    if (Date.now() - erzeugtAm > 3 * 60000) erzeugen();
    apiLaden();
  }

  global.Stream = {
    start: function (streamCfg) {
      cfg = streamCfg;
      huelle = document.getElementById('stream-huelle');
      if (!cfg.aktiv || (!cfg.kanalId && !cfg.videoId)) return;
      erzeugen();
      addEventListener('resize', groesse);
      apiLaden();
      setInterval(waechter, 60000);
    },
  };
})(this);
