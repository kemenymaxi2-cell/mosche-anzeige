# Gebetszeiten-Anzeige – DITIB-Moschee Marktoberdorf

Vollbild-Anzeige für den Fernseher im Empfangsraum (1920×1080). Sie läuft ohne Bedienung:
Uhr, Datum (gregorianisch und Hidschri), Gebetszeiten mit Hervorhebung des aktuellen Gebets,
Countdown zum nächsten Gebet, Vers des Tages, Instagram-QR-Codes und donnerstags die
Jumu'ah-Sonderansicht. Im Hintergrund läuft weichgezeichnet der Livestream aus Mekka.

Alles liegt lokal im Ordner (Schriften, QR-Bibliothek), ein Build-Schritt ist nicht nötig. Internet
braucht die Anzeige nur für den Livestream und als Ersatzquelle für fehlende Gebetszeiten.

## 1. Seite starten

**Zum Anschauen am eigenen Laptop:** ZIP entpacken (unter Windows: Rechtsklick → „Alle extrahieren“) und **`index.html` doppelklicken**. Am besten öffnen Sie sie in Chrome oder Edge. Mit F11 schalten Sie den Vollbildmodus ein und aus. `vergleich.html` zeigt alle Designs nebeneinander.
In diesem Modus fehlt nur der Livestream, YouTube erlaubt ihn bei Dateien ohne Webserver nicht. Stattdessen erscheint der ruhige Ersatz-Hintergrund. Die Gebetszeiten kommen dann aus `gebetszeiten.js`. Diese Datei erzeugt `tools/csv_zu_json.py` automatisch zusammen mit `gebetszeiten.json`.

**Für den Dauerbetrieb mit Livestream** muss die Seite über einen kleinen lokalen Webserver laufen:

**Raspberry Pi / Linux:**

```bash
cd ~/moschee-anzeige
./start.sh
```

`start.sh` startet den Webserver (`python3 -m http.server 8080`) und öffnet Chromium im Kiosk-Modus.
Stürzt der Browser ab, startet das Skript ihn nach 5 Sekunden neu.

**Windows (Mini-PC):** Python (python.org) und Google Chrome installieren und dann
`start-windows.bat` doppelklicken.

**Nur zum Ausprobieren am eigenen PC:** Im Ordner `python3 -m http.server 8080` ausführen und
<http://localhost:8080> im Browser öffnen. Den Vollbildmodus schalten Sie mit F11 ein und aus.

Kiosk-Modus beenden: `Alt+F4`.

## 2. Automatisch beim Hochfahren starten

**Raspberry Pi OS (Desktop-Version):**

1. Den Ordner nach `/home/pi/moschee-anzeige` kopieren. Bei einem anderen Benutzernamen den Pfad
   in `tools/moschee-anzeige.desktop` anpassen.
2. Autostart einrichten:
   ```bash
   chmod +x ~/moschee-anzeige/start.sh
   mkdir -p ~/.config/autostart
   cp ~/moschee-anzeige/tools/moschee-anzeige.desktop ~/.config/autostart/
   ```
3. Automatische Anmeldung einschalten und Bildschirmschoner ausschalten:
   `sudo raspi-config` → *System Options → Boot / Auto Login → Desktop Autologin*
   und *Display Options → Screen Blanking → Nein*.
4. Neu starten (`sudo reboot`). Danach erscheint die Anzeige von selbst.

**Windows:** `Win+R` → `shell:startup` eingeben. In den geöffneten Ordner eine Verknüpfung zu
`start-windows.bat` legen. Außerdem die automatische Anmeldung einrichten und in den
Energieoptionen „Bildschirm ausschalten: Nie“ wählen.

Jede Nacht um 03:00 lädt die Seite sich von selbst neu. Den Zeitpunkt stellen Sie über
`NEULADEN_UM` ein.

## 3. Einstellungen ändern (`config.js`)

Alle Einstellungen stehen in **`config.js`**, jede ist auf Deutsch kommentiert. Öffnen Sie die
Datei mit einem Texteditor (Pi: Mousepad/Geany; Windows: Editor oder Notepad++), ändern Sie den
Wert, speichern Sie und laden Sie die Seite neu (F5). Ohne Neuladen übernimmt die Anzeige die
Änderung spätestens um 03:00.

Das sollten Sie **als Erstes** eintragen:

| Einstellung | Bedeutung |
|---|---|
| `INSTAGRAM_MOSCHEE` / `INSTAGRAM_JUGEND` | Instagram-Namen, z. B. `"@ditib_marktoberdorf"`. Die QR-Codes werden daraus automatisch erzeugt. Lange Namen werden zweizeilig umbrochen. |
| `WHATSAPP_KANAL` | Link zum WhatsApp-Kanal (in WhatsApp: Kanal → Name antippen → „Link teilen“). Steht hier `""`, verschwindet dieser QR-Code. |
| `MOSCHEE_NAME` | Vereinsname oben neben dem Logo |
| `JUMUAH.uhrzeitSommer` / `uhrzeitWinter` | Uhrzeit des Freitagsgebets (derzeit Platzhalter 13:30 / 12:45). |
| `THEME` | Standard-Design 1–5 (voreingestellt: 5 „Glas“). |
| `gebetszeiten.json` | Die offiziellen DITIB-Zeiten, siehe Abschnitt 4. |

Weitere Einstellungen:

- `JUMUAH_ANSICHT`: Tage und Uhrzeiten, Intervall (Standard alle 180 s), Anzeigedauer (20 s) und
  Überblendung. Für zusätzlich „Freitagvormittag“ die vorbereitete Zeile aktivieren.
- `STREAM`: Kanal-ID oder Video-ID, Weichzeichnung (`blurPx`), Abdunklung, `renderBreite`
  (geringere Last auf dem Raspberry Pi).
- `HINTERGRUNDBILD`: eigenes Ersatzbild, z. B. `"assets/hintergrund.jpg"`.
- `GEBETE`: Namen und deutsche Bezeichnungen der Gebetszeiten.
- `VERSE`: Liste für den Vers des Tages. Jeden Tag kommt automatisch der nächste dran.
- `ONLINE_ERSATZ.tune`: Minuten-Korrektur je Gebet für die Online-Ersatzzeiten.
- `HIDSCHRI_KORREKTUR_TAGE`: Hidschri-Datum um ±1 Tag anpassen. `HIDSCHRI_TUERKISCH` schaltet die türkische Schreibweise (z. B. „14 Cemaziyelevvel 1448“) neben der Umschrift ein oder aus.
- `BURNIN_SCHUTZ`: unmerkliches Verschieben des Layouts.

Sieht die Seite nach einer Änderung leer aus, fehlt meist ein Komma oder ein Anführungszeichen.
Machen Sie die letzte Änderung dann rückgängig.

## 4. Gebetszeiten (`gebetszeiten.json`)

Die Anzeige verwendet die **offiziellen Diyanet-Zeiten für Marktoberdorf**. Das sind dieselben Zeiten wie in der DITIB-Namaz-Vakti-App. Diyanet führt Marktoberdorf als eigenen Ort mit der ID `10438`. Die Zeiten kommen in dieser Reihenfolge:

1. **`gebetszeiten.json`**: Auf GitHub aktualisiert sich diese Datei **jeden Montag automatisch**. Den Ablauf steuert `.github/workflows/gebetszeiten.yml`, er führt `tools/diyanet_laden.py` aus. Von Hand starten Sie ihn so: GitHub → **Actions** → „Gebetszeiten aktualisieren“ → **Run workflow**.
2. **Diyanet online**: Fehlt ein Tag in der Datei, lädt die Seite ihn direkt bei Diyanet nach und speichert ihn im Browser. So bleiben die Zeiten auch bei einem Internetausfall verfügbar.
3. **Aladhan-API** (`method=13`, berechnet): Diese Quelle springt nur ein, wenn Diyanet nicht erreichbar ist.

Diyanet stellt immer etwa die nächsten 30 Tage bereit. Von Hand aktualisieren:
```bash
python3 tools/diyanet_laden.py
```

**Alternativ aus einer CSV-Datei** (z. B. aus einem Jahreskalender):



1. Den Kalender als CSV speichern. In Excel: *Speichern unter → CSV (Trennzeichen-getrennt)*.
   Eine Zeile pro Tag, z. B.:
   ```
   Datum;İmsak;Güneş;Öğle;İkindi;Akşam;Yatsı
   01.11.2026;05:41;07:17;12:09;14:31;16:52;18:22
   ```
   Spaltennamen auf Türkisch, Deutsch oder Englisch werden erkannt. Ohne Kopfzeile gilt die
   Reihenfolge Datum, Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha. Ein Beispiel liegt unter
   `tools/beispiel-kalender.csv`.
2. Umwandeln:
   ```bash
   python3 tools/csv_zu_json.py kalender-2027.csv                    # ersetzt die Datei
   python3 tools/csv_zu_json.py kalender-2027.csv --zusammenfuehren  # ergänzt vorhandene Tage
   ```
   Unter Windows: `py tools\csv_zu_json.py kalender-2027.csv`.

Das Format ist einfach, Sie können die Datei auch von Hand korrigieren:

```json
{
  "2026-11-01": {"fajr": "05:41", "shuruq": "07:17", "dhuhr": "12:09", "asr": "14:31", "maghrib": "16:52", "isha": "18:22"}
}
```

Alle Uhrzeiten sind Ortszeit (Europe/Berlin). Die Sommer- und Winterzeit wird automatisch
berücksichtigt, auch beim Countdown über die Nacht der Umstellung hinweg.

## 5. Die Designs vergleichen

| Nr. | Name | Kurzbeschreibung |
|---|---|---|
| 1 | Nacht über Mekka | Nachtblau, Gold, Glas-Karten, Serifenschrift |
| 2 | İznik | Cremeweiße Fliesen-Karten, Kobalt/Türkis/Rot, Ornament-Bordüren |
| 3 | Smaragd & Gold | Dunkelgrün, Gold, feines Sternmuster |
| 4 | Minimal | Anthrazit, sehr große dünne Ziffern, eine Akzentfarbe |
| **5** | **Glas** (Standard) | Apple-Stil mit Liquid Glass, DITIB-Logo, Rot nur für Logo, aktuelles Gebet und Countdown. Tagsüber hell, ab Maghrib dunkel |

- **Alle vier nebeneinander:** <http://localhost:8080/vergleich.html>. Oben lässt sich eine
  simulierte Uhrzeit wählen (z. B. Donnerstag 12:00 für die Jumu'ah-Ansicht).
- **Ein Design im Vollbild:** `index.html?theme=1` bis `?theme=5`
- **Design 5 hell oder dunkel ansehen:** `index.html?theme=5&modus=hell` bzw. `&modus=dunkel`
- **Dauerhaft festlegen:** in `config.js` `THEME: 2` (usw.) eintragen.

**Design 5 „Glas“ einstellen** (Abschnitt `DESIGN_5` in `config.js`):
- `modus`: `"auto"`, `"hell"` oder `"dunkel"`. Bei `"auto"` wird es ab `dunkelAb` (Standard Maghrib) dunkel und ab `hellAb` (Standard Fajr) wieder hell. Der Wechsel blendet über 3 Sekunden weich über.
- `streamBlurPx`: Weichzeichnung des Streams. Sie ist bewusst schwächer als bei den anderen Designs, damit hinter dem Glas Bewegung sichtbar ist.
- `glasUnschaerfePx`: Unschärfe hinter dem Glas. Ruckelt ein Raspberry Pi, hier `0` eintragen.
- `schleierHell` / `schleierDunkel`: Aufhellung bzw. Abdunklung des Streams.
- Das Logo liegt unter `assets/ditib-logo.svg` (nachgezeichnet, Buchstaben ausgestanzt). Das Original ist `assets/ditib-logo-original.jpg`. Ein anderes Logo tragen Sie über `LOGO` in `config.js` ein.

## 6. Testen mit simulierter Uhrzeit

Diese Parameter hängen Sie an die Adresse an und kombinieren sie mit `&`:

| Parameter | Wirkung |
|---|---|
| `?now=2026-10-29T12:00` | Datum und Uhrzeit simulieren (Ortszeit). Die Uhr läuft ab da weiter. |
| `&speed=10` | Die simulierte Zeit läuft 10-mal so schnell. |
| `?jumuah=immer` / `?jumuah=aus` | Jumu'ah-Ansicht dauerhaft zeigen bzw. nie zeigen |
| `?stream=aus` | Livestream abschalten und nur den Ersatz-Hintergrund zeigen |
| `?theme=3` | Design wählen |
| `?modus=hell` / `?modus=dunkel` | Design 5: Hell/Dunkel erzwingen |

Beispiele:

- `index.html?now=2026-10-29T12:00`: Donnerstag. Die Jumu'ah-Ansicht erscheint sofort für
  20 Sekunden und dann alle 3 Minuten wieder.
- `index.html?now=2026-10-29T11:59:50`: Nach 10 Sekunden blendet die Anzeige weich über.
- `index.html?now=2026-10-30T09:00`: Zwischen Shuruq und Dhuhr ist kein Gebet markiert.

Im Simulationsmodus steht oben ein roter Hinweis, und das nächtliche Neuladen ist abgeschaltet.

**Selbsttest:** <http://localhost:8080/tests/test.html> prüft automatisch 42 Fälle: aktuelles
Gebet, Shuruq-Lücke, Isha nach Mitternacht, Jumu'ah-Takt, Sommer-/Winterzeit und Datum. Die Seite
enthält außerdem Links zu den wichtigsten Simulationen.

## 7. Gut zu wissen

- **Livestream:** Standard ist der offizielle Kanal *KSA Qur'an TV* (`UCos52azQNBgW63_9uDJoPDA`).
  Die Anzeige verwendet die Kanal-Adresse (`/embed/live_stream?channel=…`). Wechselt der Kanal
  seinen Livestream, passt sie sich also von selbst an. Der Stream wird erst eingeblendet, wenn er
  wirklich läuft. Bis dahin und bei jedem Fehler bleibt der ruhige Farbverlauf sichtbar. Jede
  Minute prüft die Seite, ob der Stream läuft, und baut ihn bei Bedarf neu auf.
- **Raspberry Pi:** Ein Pi 4 oder 5 wird empfohlen. Ruckelt das Bild, setzen Sie in `config.js`
  `renderBreite: 480` oder schalten den Stream mit `STREAM.aktiv: false` ab.
- **Lizenzen:** Die Schriften Inter, Cormorant Garamond, Cinzel und Marcellus stehen unter der
  SIL Open Font License (siehe `fonts/LIZENZ-*.txt`). Die QR-Bibliothek `lib/qrcode.js`
  (Kazuhiko Arase) steht unter der MIT-Lizenz.

## Ordnerübersicht

```
index.html            Die Anzeige
config.js             ALLE Einstellungen
gebetszeiten.json     Gebetszeiten (Datum → sechs Zeiten)
gebetszeiten.js       dieselben Daten für den Doppelklick-Modus (wird automatisch erzeugt)
vergleich.html        Alle Designs nebeneinander
start.sh / start-windows.bat   Start im Kiosk-Modus
css/  js/  fonts/  lib/        Gestaltung, Programmlogik, Schriften, QR-Bibliothek
tools/diyanet_laden.py  Diyanet-Zeiten → gebetszeiten.json
tools/csv_zu_json.py  CSV → gebetszeiten.json
tests/test.html       Selbsttest
assets/               DITIB-Logo, Platz für ein eigenes Hintergrundbild
```
