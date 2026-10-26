#!/usr/bin/env python3
"""
Wandelt eine CSV-Datei mit Gebetszeiten (z. B. aus dem DITIB-Jahreskalender)
in die Datei gebetszeiten.json um, die die Anzeige liest.

Aufruf:
    python3 tools/csv_zu_json.py kalender.csv
    python3 tools/csv_zu_json.py kalender.csv --zusammenfuehren   (bestehende Tage behalten)
    python3 tools/csv_zu_json.py kalender.csv -o anderer/pfad.json

Die CSV darf so aussehen (Trennzeichen ; , oder Tab, Kopfzeile optional):

    Datum;İmsak;Güneş;Öğle;İkindi;Akşam;Yatsı
    01.11.2026;05:41;07:17;12:09;14:31;16:52;18:22

Erkannt werden deutsche, türkische und englische Spaltennamen
(z. B. "Fajr", "İmsak", "Morgengebet", "Güneş", "Sunrise", "Öğle", "Dhuhr" …).
Ohne Kopfzeile gilt: 1. Spalte Datum, danach Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha.
Datumsformate: 01.11.2026, 1.11.26, 2026-11-01, 01/11/2026, 01-11-2026.
"""
import argparse
import csv
import json
import os
import re
import sys
import unicodedata

SCHLUESSEL = ["fajr", "shuruq", "dhuhr", "asr", "maghrib", "isha"]
STICHWORTE = {
    "fajr":    ["fajr", "fadschr", "imsak", "morgengebet", "morgen"],
    "shuruq":  ["shuruq", "schuruq", "sunrise", "gunes", "sonnenaufgang", "sonne"],
    "dhuhr":   ["dhuhr", "zuhr", "duhr", "ogle", "mittag"],
    "asr":     ["asr", "ikindi", "nachmittag"],
    "maghrib": ["maghrib", "magrib", "aksam", "abend"],
    "isha":    ["isha", "ischa", "yatsi", "nachtgebet", "nacht"],
}


def einfach(text):
    """Kleinbuchstaben ohne Akzente: 'Öğle' -> 'ogle', 'Yatsı' -> 'yatsi'."""
    t = unicodedata.normalize("NFKD", text.replace("ı", "i").replace("İ", "I")).lower()
    return "".join(z for z in t if not unicodedata.combining(z))


def datum_lesen(text):
    text = text.strip()
    m = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if m:
        j, mo, t = m.groups()
    else:
        m = re.fullmatch(r"(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})", text)
        if not m:
            return None
        t, mo, j = m.groups()
        if len(j) == 2:
            j = "20" + j
    j, mo, t = int(j), int(mo), int(t)
    if not (1 <= mo <= 12 and 1 <= t <= 31):
        return None
    return f"{j:04d}-{mo:02d}-{t:02d}"


def zeit_lesen(text):
    m = re.search(r"(\d{1,2})[:.](\d{2})", text or "")
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 23 or mi > 59:
        return None
    return f"{h:02d}:{mi:02d}"


def datei_lesen(pfad):
    for kodierung in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(pfad, encoding=kodierung, newline="") as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    raise SystemExit("Datei konnte nicht gelesen werden: " + pfad)


def spalten_zuordnen(kopf):
    """Ordnet Spaltennummern den Gebeten zu. Gibt (datum_spalte, {gebet: spalte}) zurück."""
    datum_spalte, zuordnung = None, {}
    for i, name in enumerate(kopf):
        n = einfach(name)
        if datum_spalte is None and ("datum" in n or "date" in n or "tarih" in n):
            datum_spalte = i
            continue
        for k in SCHLUESSEL:
            if k not in zuordnung and any(w in n for w in STICHWORTE[k]):
                zuordnung[k] = i
                break
    return datum_spalte, zuordnung


def umwandeln(text):
    probe = text[:4096]
    try:
        trenner = csv.Sniffer().sniff(probe, delimiters=";,\t").delimiter
    except csv.Error:
        trenner = ";"
    zeilen = [z for z in csv.reader(text.splitlines(), delimiter=trenner) if any(f.strip() for f in z)]
    if not zeilen:
        raise SystemExit("Die CSV-Datei ist leer.")

    datum_spalte, zuordnung = 0, {k: i + 1 for i, k in enumerate(SCHLUESSEL)}
    start = 0
    if not any(datum_lesen(f) for f in zeilen[0]):            # erste Zeile ist eine Kopfzeile
        ds, zu = spalten_zuordnen(zeilen[0])
        if len(zu) == 6:
            datum_spalte, zuordnung = (ds if ds is not None else 0), zu
        else:
            print("Hinweis: Spaltennamen nicht eindeutig erkannt – verwende die Reihenfolge "
                  "Datum, Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha.", file=sys.stderr)
        start = 1

    ergebnis, fehler = {}, 0
    for nr, zeile in enumerate(zeilen[start:], start=start + 1):
        datum = datum_lesen(zeile[datum_spalte]) if datum_spalte < len(zeile) else None
        if not datum:                                          # evtl. Datum in anderer Spalte
            datum = next((datum_lesen(f) for f in zeile if datum_lesen(f)), None)
        zeiten = {k: zeit_lesen(zeile[i]) if i < len(zeile) else None for k, i in zuordnung.items()}
        if not datum or None in zeiten.values():
            fehler += 1
            print(f"Zeile {nr} übersprungen: {trenner.join(zeile)}", file=sys.stderr)
            continue
        ergebnis[datum] = {k: zeiten[k] for k in SCHLUESSEL}
    return ergebnis, fehler


def schreiben(pfad, daten, quelle):
    """Speichert gebetszeiten.json und – mit denselben Daten – gebetszeiten.js."""
    # Ein Tag pro Zeile – gut lesbar und leicht von Hand zu korrigieren.
    zeilen = ['  "_quelle": ' + json.dumps(quelle, ensure_ascii=False)]
    for tag in sorted(daten):
        zeilen.append(f'  "{tag}": ' + json.dumps(daten[tag], separators=(", ", ": ")))
    inhalt = "{\n" + ",\n".join(zeilen) + "\n}\n"
    with open(pfad, "w", encoding="utf-8") as f:
        f.write(inhalt)
    # Gleiche Daten als .js-Datei: wird gebraucht, wenn index.html per Doppelklick
    # (ohne Webserver) geöffnet wird – dann darf der Browser keine .json lesen.
    js_pfad = os.path.splitext(pfad)[0] + ".js"
    with open(js_pfad, "w", encoding="utf-8") as f:
        f.write("/* Automatisch erzeugt – nicht von Hand bearbeiten, sondern gebetszeiten.json\n"
                "   ändern bzw. tools/csv_zu_json.py oder tools/diyanet_laden.py ausführen. */\n"
                "window.GEBETSZEITEN = " + inhalt.rstrip() + ";\n")
    return js_pfad


def main():
    hier = os.path.dirname(os.path.abspath(__file__))
    p = argparse.ArgumentParser(description="CSV mit Gebetszeiten in gebetszeiten.json umwandeln.")
    p.add_argument("csv", help="CSV-Datei, z. B. aus dem DITIB-Jahreskalender")
    p.add_argument("-o", "--ausgabe", default=os.path.join(hier, "..", "gebetszeiten.json"),
                   help="Zieldatei (Standard: gebetszeiten.json im Hauptordner)")
    p.add_argument("--zusammenfuehren", action="store_true",
                   help="vorhandene Tage in der Zieldatei behalten und nur ergänzen/überschreiben")
    p.add_argument("--quelle", default="DITIB/Diyanet-Kalender Marktoberdorf",
                   help="Hinweistext, der in der JSON-Datei vermerkt wird")
    a = p.parse_args()

    neu, fehler = umwandeln(datei_lesen(a.csv))
    if not neu:
        raise SystemExit("Keine gültigen Zeilen gefunden – bitte das Format der CSV prüfen.")

    daten = {}
    if a.zusammenfuehren and os.path.exists(a.ausgabe):
        with open(a.ausgabe, encoding="utf-8") as f:
            daten = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    daten.update(neu)

    js_pfad = schreiben(a.ausgabe, daten, a.quelle)

    tage = sorted(neu)
    print(f"{len(neu)} Tage übernommen ({tage[0]} bis {tage[-1]}), {fehler} Zeilen übersprungen.")
    print(f"Gespeichert: {os.path.abspath(a.ausgabe)} ({len(daten)} Tage insgesamt)")
    print(f"           + {os.path.abspath(js_pfad)}")


if __name__ == "__main__":
    main()
