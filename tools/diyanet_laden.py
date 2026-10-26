#!/usr/bin/env python3
"""
Lädt die offiziellen Diyanet-Gebetszeiten für Marktoberdorf (dieselben Zeiten
wie in der DITIB-Namaz-Vakti-App) und trägt sie in gebetszeiten.json ein.

Aufruf:
    python3 tools/diyanet_laden.py            (ergänzt die vorhandene Datei)
    python3 tools/diyanet_laden.py --neu      (verwirft alle bisherigen Tage)
    python3 tools/diyanet_laden.py --ort 10438

Diyanet liefert jeweils die nächsten ~30 Tage. Auf GitHub führt der Ablauf
.github/workflows/gebetszeiten.yml dieses Skript jede Woche automatisch aus,
sodass die Datei immer weit genug in die Zukunft reicht.
Tage, die älter als 7 Tage sind, werden entfernt.
"""
import argparse
import datetime
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from csv_zu_json import SCHLUESSEL, schreiben, zeit_lesen  # noqa: E402

QUELLE_URL = "https://ezanvakti.emushaf.net/vakitler/{ort}"
FELDER = {"fajr": "Imsak", "shuruq": "Gunes", "dhuhr": "Ogle",
          "asr": "Ikindi", "maghrib": "Aksam", "isha": "Yatsi"}


def abrufen(ort):
    anfrage = urllib.request.Request(QUELLE_URL.format(ort=ort), headers={
        "Accept": "application/json",
        "User-Agent": "moschee-anzeige-marktoberdorf/1.0",
    })
    with urllib.request.urlopen(anfrage, timeout=30) as antwort:
        liste = json.load(antwort)
    tage = {}
    for eintrag in liste:
        t, m, j = eintrag["MiladiTarihKisa"].split(".")          # DD.MM.YYYY
        zeiten = {k: zeit_lesen(eintrag.get(feld)) for k, feld in FELDER.items()}
        if None in zeiten.values():
            continue
        tage[f"{j}-{m}-{t}"] = {k: zeiten[k] for k in SCHLUESSEL}
    return tage


def main():
    hier = os.path.dirname(os.path.abspath(__file__))
    p = argparse.ArgumentParser(description="Diyanet-Gebetszeiten in gebetszeiten.json eintragen.")
    p.add_argument("--ort", default="10438", help="Diyanet-Orts-ID (10438 = MARKTOBERDORF)")
    p.add_argument("-o", "--ausgabe", default=os.path.join(hier, "..", "gebetszeiten.json"))
    p.add_argument("--neu", action="store_true", help="vorhandene Tage verwerfen")
    a = p.parse_args()

    neu = abrufen(a.ort)
    if not neu:
        raise SystemExit("Diyanet hat keine Zeiten geliefert – Datei bleibt unverändert.")

    daten = {}
    if not a.neu and os.path.exists(a.ausgabe):
        with open(a.ausgabe, encoding="utf-8") as f:
            daten = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    grenze = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
    daten = {k: v for k, v in daten.items() if k >= grenze}
    daten.update(neu)

    quelle = f"Diyanet (Ort {a.ort} MARKTOBERDORF), zuletzt abgerufen am {datetime.date.today().isoformat()}"
    schreiben(a.ausgabe, daten, quelle)
    tage = sorted(daten)
    print(f"{len(neu)} Tage von Diyanet geladen. Datei enthält jetzt {tage[0]} bis {tage[-1]}.")


if __name__ == "__main__":
    main()
