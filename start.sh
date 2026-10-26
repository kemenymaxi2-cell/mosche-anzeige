#!/bin/bash
# Startet die Gebetszeiten-Anzeige: kleiner lokaler Webserver + Chromium im Kiosk-Modus.
# Raspberry Pi OS / Linux. Aufruf: ./start.sh

cd "$(dirname "$0")" || exit 1
PORT=8080
URL="http://localhost:$PORT/index.html"
PROFIL="$HOME/.config/moschee-anzeige-browser"

# Webserver starten (falls noch nicht läuft)
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  sleep 2
fi

# Bildschirmschoner/Energiesparen abschalten (nur X11, unter Wayland egal)
xset s off -dpms s noblank 2>/dev/null

BROWSER=$(command -v chromium-browser || command -v chromium || command -v google-chrome)
if [ -z "$BROWSER" ]; then echo "Kein Chromium/Chrome gefunden." >&2; exit 1; fi

# Browser bei Absturz automatisch neu starten
while true; do
  # Meldung „Seiten wiederherstellen?“ nach Stromausfall unterdrücken
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
    "$PROFIL/Default/Preferences" 2>/dev/null
  "$BROWSER" --kiosk --user-data-dir="$PROFIL" \
    --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
    --autoplay-policy=no-user-gesture-required \
    --check-for-update-interval=31536000 --disable-features=Translate \
    --overscroll-history-navigation=0 --password-store=basic \
    "$URL"
  sleep 5
done
