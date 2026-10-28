#!/usr/bin/env python3
"""
Freitagspredigt der DITIB laden, übersetzen (Bosnisch, Arabisch), zweifach prüfen
und als PDF für die Anzeige ablegen.

Ablauf:
  1. Im DITIB-Predigtarchiv die Predigt für den kommenden Freitag suchen
     (noch nicht veröffentlicht → Ende, es entstehen keine Kosten).
  2. Titel, Datum, Absätze und Quellen aus der Seite lesen.
  3. Je Sprache: Übersetzung durch Claude.
  4. Prüfung 1: Ein zweiter Durchgang vergleicht Absatz für Absatz mit dem
     Original und korrigiert Fehler.
  5. Prüfung 2: Ein unabhängiger dritter Durchgang entscheidet über die Freigabe,
     zusätzlich prüft das Skript automatisch (Absatzzahl, Fußnoten, Schrift,
     Längenverhältnis). Bei Mängeln wird einmal nachgebessert und erneut
     geprüft; besteht die Sprache dann nicht, wird sie NICHT veröffentlicht.
  6. PDF mit dem Hinweis „kann Übersetzungsfehler enthalten“ erzeugen und
     predigten/aktuell.json (+ .js) für die Anzeige schreiben.

Aufruf:
    python3 tools/predigt_laden.py                      (normaler Wochenlauf)
    python3 tools/predigt_laden.py --datum 2026-10-23   (bestimmte Predigt)
    python3 tools/predigt_laden.py --test-uebersetzer --ausgabe /tmp/test
        (ohne API: Platzhalter-„Übersetzung“, nur um Layout/PDF zu prüfen)

Benötigt: ANTHROPIC_API_KEY (auf GitHub als Secret hinterlegt),
          pip install anthropic playwright && python -m playwright install chromium
"""
import argparse
import base64
import datetime
import html
import json
import os
import re
import shutil
import sys
import time
import urllib.request
import zoneinfo

HIER = os.path.dirname(os.path.abspath(__file__))
WURZEL = os.path.normpath(os.path.join(HIER, ".."))
TZ = zoneinfo.ZoneInfo("Europe/Berlin")

ARCHIV_URL = "https://www.ditib.de/default1.php?id=11&sid=12&lang=de"
DETAIL_URL = "https://www.ditib.de/detail_predigt1.php?id={id}&lang=de"
USER_AGENT = "moschee-anzeige-marktoberdorf/1.0"

MODELL = "claude-opus-5-5"
# Preise Claude Opus 5.5 (USD je 1 Mio. Tokens) – nur für die Kostenanzeige im Protokoll
PREIS_EIN, PREIS_AUS = 4.00, 20.00
WOCHEN_AUFBEWAHREN = 6

SPRACHEN = {
    "bs": {
        "name": "Bosanski",
        "beschreibung": "Bosnisch (bosanski), lateinische Schrift, ijekavisch",
        "regeln": (
            "Verwende die in Bosnien und Herzegowina übliche islamische Terminologie "
            "(z. B. hutba, džuma-namaz, Allah dž.š., Poslanik s.a.v.s., ashabi, ummet, dova, "
            "Kur'an). Übersetze Koranverse und Hadithe sinngemäß und genau, angelehnt an den "
            "Stil gängiger bosnischer Übersetzungen; erfinde keine Wortlaute. "
            "„(s)“ im deutschen Text steht für sallallahu alejhi ve sellem → „s.a.v.s.“."
        ),
        "rtl": False,
        "hinweis": "Prijevod hutbe napravljen uz pomoć umjetne inteligencije. Može sadržavati greške u prijevodu. "
                   "Mjerodavna je originalna verzija na njemačkom jeziku.",
        "fusszeile": "Može sadržavati greške u prijevodu",
        "kopf": "Prijevod petkove hutbe",
        "datum_wort": "Hutba od",
        "original_wort": "Original",
    },
    "ar": {
        "name": "العربية",
        "beschreibung": "Arabisch (Hocharabisch, fuṣḥā)",
        "regeln": (
            "Koranverse: Gib den originalen arabischen Wortlaut des Korans wieder, wenn die "
            "Quellenangabe den Vers eindeutig bestimmt und du dir des Wortlauts vollkommen sicher "
            "bist; sonst übersetze sinngemäß und kennzeichne es nicht als wörtliches Zitat. "
            "Hadithe: den arabischen Originalwortlaut nur verwenden, wenn er gesichert bekannt ist, "
            "sonst sinngemäß übersetzen. „(s)“ im deutschen Text → „ﷺ“. "
            "Verwende würdevolle, in Freitagspredigten übliche Sprache."
        ),
        "rtl": True,
        "hinweis": "ترجمة الخطبة أُعدّت بمساعدة الذكاء الاصطناعي، وقد تحتوي على أخطاء في الترجمة. "
                   "النص الألماني الأصلي هو المعتمد.",
        "fusszeile": "قد تحتوي على أخطاء في الترجمة",
        "kopf": "ترجمة خطبة الجمعة",
        "datum_wort": "خطبة يوم",
        "original_wort": "الأصل",
    },
}
HINWEIS_DE = ("Übersetzung der Freitagspredigt mithilfe künstlicher Intelligenz. Kann Übersetzungsfehler "
              "enthalten. Maßgeblich ist die deutsche Originalfassung der DITIB.")


# ---------------------------------------------------------------------------
# 1) + 2) Predigt finden und lesen
# ---------------------------------------------------------------------------

def laden(url):
    anfrage = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(anfrage, timeout=30) as antwort:
        return antwort.read().decode("utf-8", errors="replace")


def ziel_freitag(heute):
    """Kommender Freitag (oder heute, wenn heute Freitag ist)."""
    return heute + datetime.timedelta(days=(4 - heute.weekday()) % 7)


def html_zu_text(fragment):
    t = re.sub(r"<sup[^>]*>\s*(\d+)\s*</sup>", r"[\1]", fragment, flags=re.S | re.I)
    t = re.sub(r"<br\s*/?>", "\n", t, flags=re.I)
    t = re.sub(r"</?(strong|b)\b[^>]*>", "**", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace("\xa0", " ")
    t = re.sub(r"\*\*(\s*)\*\*", r"\1", t)            # leere Fettungen entfernen
    t = re.sub(r"[ \t]+", " ", t)
    return "\n".join(z.strip() for z in t.split("\n")).strip()


def ist_arabisch(text, anteil=0.5):
    buchstaben = [z for z in text if z.isalpha()]
    if not buchstaben:
        return False
    return sum(1 for z in buchstaben if "؀" <= z <= "ۿ" or "ﭐ" <= z <= "﻿") / len(buchstaben) >= anteil


def predigt_lesen(detail_id):
    seite = laden(DETAIL_URL.format(id=detail_id))
    start = seite.find("Freitagspredigt</h4>")
    if start < 0:
        raise ValueError(f"Predigt {detail_id}: Inhaltsbereich nicht gefunden")
    ende = seite.find('<div class="col_5">', start)
    block = seite[start:ende]
    pdf = re.search(r'href="(https?://[^"]*hutbe_de_\d{8}\.pdf)"', block)

    haupt, _, fussnoten = block.partition("<hr")
    absaetze_roh = [html_zu_text(p) for p in re.findall(r"<p\b[^>]*>(.*?)</p>", haupt, re.S | re.I)]
    absaetze_roh = [a for a in absaetze_roh if a.strip("* ")]

    arabisch, titel, datum, rumpf = [], None, None, []
    for a in absaetze_roh:
        m = re.match(r"^\*\*(.+?)\*\*\s*\(?\s*(\d{2}\.\d{2}\.\d{4})\s*\)?$", a.replace("\n", " "), re.S)
        if titel is None and m:
            titel, datum = m.group(1).strip(), m.group(2)
        elif titel is None:
            arabisch.extend(z for z in a.replace("**", "").split("\n") if z.strip())
        else:
            rumpf.append(a)
    if not titel or not rumpf:
        raise ValueError(f"Predigt {detail_id}: Titel oder Text nicht erkannt")

    unterschrift = ""
    if re.fullmatch(r"\*\*[^*]+\*\*", rumpf[-1]):
        unterschrift = rumpf.pop().strip("* ")
    absaetze = []
    for a in rumpf:
        m = re.match(r"^\*\*([^*]+)\*\*\s*\n(.*)$", a, re.S)
        if m:
            absaetze.append({"ueberschrift": m.group(1).strip(), "text": m.group(2).strip()})
        else:
            absaetze.append({"ueberschrift": "", "text": a})

    quellen = []
    for p in re.findall(r"<p\b[^>]*>(.*?)</p>", fussnoten, re.S | re.I):
        t = html_zu_text(p).replace("**", "").strip()
        if t and not t.lower().startswith("quellen"):
            quellen.append(t)

    t, m_, j = datum.split(".")
    return {
        "id": detail_id,
        "datum": f"{j}-{m_}-{t}",
        "titel": titel,
        "arabisch": arabisch,
        "absaetze": absaetze,
        "unterschrift": unterschrift,
        "quellen": quellen,
        "original_pdf": pdf.group(1) if pdf else "",
        "detail_url": DETAIL_URL.format(id=detail_id),
    }


def predigt_finden(datum_iso):
    archiv = laden(ARCHIV_URL)
    ids = sorted({int(i) for i in re.findall(r"detail_predigt1\.php\?id=(\d+)", archiv)}, reverse=True)
    for detail_id in ids[:4]:                       # nur die neuesten Einträge ansehen
        p = predigt_lesen(detail_id)
        if p["datum"] == datum_iso:
            return p
    return None


# ---------------------------------------------------------------------------
# 3) – 5) Übersetzen und prüfen
# ---------------------------------------------------------------------------

UEBERSETZUNG_SCHEMA = {
    "type": "object",
    "properties": {
        "titel": {"type": "string"},
        "absaetze": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"ueberschrift": {"type": "string"}, "text": {"type": "string"}},
                "required": ["ueberschrift", "text"],
                "additionalProperties": False,
            },
        },
        "unterschrift": {"type": "string"},
        "quellen": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["titel", "absaetze", "unterschrift", "quellen"],
    "additionalProperties": False,
}

KORREKTUR_SCHEMA = {
    "type": "object",
    "properties": {
        **UEBERSETZUNG_SCHEMA["properties"],
        "korrekturen": {"type": "array", "items": {"type": "string"}},
    },
    "required": UEBERSETZUNG_SCHEMA["required"] + ["korrekturen"],
    "additionalProperties": False,
}

FREIGABE_SCHEMA = {
    "type": "object",
    "properties": {
        "freigabe": {"type": "boolean"},
        "probleme": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "absatz": {"type": "integer"},
                    "beschreibung": {"type": "string"},
                    "schwere": {"type": "string", "enum": ["hoch", "mittel", "niedrig"]},
                },
                "required": ["absatz", "beschreibung", "schwere"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["freigabe", "probleme"],
    "additionalProperties": False,
}

FORMAT_REGELN = (
    "Formatregeln: Gib genau so viele Absätze zurück wie im Original, in derselben Reihenfolge. "
    "Überschriften (Anreden wie „Werte Muslime!“) stehen im Feld „ueberschrift“; ist sie im Original leer, "
    "bleibt sie leer. Fußnotenmarken wie [1] stehen an derselben Stelle wie im Original. Fett markierte "
    "Stellen (**so**) bleiben fett. Zeilenumbrüche (\\n) innerhalb eines Absatzes bleiben erhalten. "
    "Die Quellenangaben werden ebenfalls übersetzt (Namen der Suren und Hadithsammlungen in der in "
    "der Zielsprache üblichen Schreibweise), Nummern und Zahlen bleiben gleich."
)


class Uebersetzer:
    """Ruft Claude auf (Übersetzung, Prüfung, Freigabe)."""

    def __init__(self):
        import anthropic                      # erst hier, damit --test-uebersetzer ohne SDK läuft
        self.anthropic = anthropic
        self.client = anthropic.Anthropic(max_retries=4)
        self.ein = self.aus = 0

    def _json(self, system, nutzlast, schema):
        with self.client.beta.messages.stream(
            model=MODELL,
            max_tokens=64000,
            thinking={"type": "adaptive"},
            output_config={"effort": "high", "format": {"type": "json_schema", "schema": schema}},
            # Lehnt das Modell ab, übernimmt automatisch ein Ersatzmodell (server-seitig)
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=system,
            messages=[{"role": "user", "content": json.dumps(nutzlast, ensure_ascii=False, indent=1)}],
        ) as stream:
            antwort = stream.get_final_message()
        self.ein += antwort.usage.input_tokens
        self.aus += antwort.usage.output_tokens
        if antwort.stop_reason == "refusal":
            raise RuntimeError(f"Anfrage abgelehnt ({antwort.stop_details})")
        if antwort.stop_reason == "max_tokens":
            raise RuntimeError("Antwort abgeschnitten (max_tokens)")
        text = next(b.text for b in antwort.content if b.type == "text")
        return json.loads(text)

    def uebersetzen(self, quelle, sprache):
        s = SPRACHEN[sprache]
        system = (
            f"Du übersetzt die offizielle deutsche Freitagspredigt der DITIB ins {s['beschreibung']}. "
            "Die Übersetzung wird Gläubigen in einer Moschee angeboten, die die Predigt auf Deutsch nicht "
            "verstehen. Übersetze vollständig, genau und sinngetreu – nichts weglassen, nichts hinzufügen, "
            f"nichts deuten oder abschwächen. {s['regeln']} {FORMAT_REGELN}"
        )
        return self._json(system, {"original_deutsch": quelle}, UEBERSETZUNG_SCHEMA)

    def pruefen_und_korrigieren(self, quelle, uebersetzung, sprache, hinweise=None):
        s = SPRACHEN[sprache]
        system = (
            f"Du bist ein zweiter, unabhängiger Prüfer für Übersetzungen ins {s['beschreibung']}. "
            "Vergleiche die Übersetzung Absatz für Absatz und Satz für Satz mit dem deutschen Original. "
            "Korrigiere jede Bedeutungsabweichung, Auslassung, Hinzufügung, falsche religiöse "
            "Fachbegriffe, falsch wiedergegebene Koranverse oder Hadithe sowie Grammatik- und "
            f"Rechtschreibfehler. {s['regeln']} {FORMAT_REGELN} Gib die vollständige, korrigierte "
            "Übersetzung zurück und liste in „korrekturen“ kurz auf Deutsch jede vorgenommene Änderung auf "
            "(leere Liste, wenn nichts zu ändern war)."
        )
        nutzlast = {"original_deutsch": quelle, "uebersetzung": uebersetzung}
        if hinweise:
            nutzlast["bekannte_probleme"] = hinweise
        return self._json(system, nutzlast, KORREKTUR_SCHEMA)

    def freigeben(self, quelle, uebersetzung, sprache):
        s = SPRACHEN[sprache]
        system = (
            f"Du entscheidest als letzte, unabhängige Instanz, ob eine Übersetzung ins {s['beschreibung']} "
            "veröffentlicht werden darf. Vergleiche gründlich mit dem deutschen Original. Gib nur frei "
            "(freigabe=true), wenn die Übersetzung vollständig ist, keine inhaltlichen Fehler oder "
            "Auslassungen enthält und religiöse Inhalte (Koranverse, Hadithe, Bittgebete) korrekt wiedergibt. "
            "Liste jedes gefundene Problem mit Absatznummer (0-basiert, -1 für Titel/Quellen) und Schwere auf "
            "Deutsch auf. Kleine stilistische Anmerkungen sind „niedrig“ und verhindern die Freigabe nicht."
        )
        return self._json(system, {"original_deutsch": quelle, "uebersetzung": uebersetzung}, FREIGABE_SCHEMA)

    def kosten(self):
        return self.ein / 1e6 * PREIS_EIN + self.aus / 1e6 * PREIS_AUS


class TestUebersetzer:
    """Platzhalter ohne API – nur zum Prüfen von Layout und PDF."""

    BEISPIEL_AR = "هذا نص تجريبي لاختبار تخطيط الصفحة فقط، وليس ترجمة حقيقية للخطبة[1]."
    ein = aus = 0

    def uebersetzen(self, quelle, sprache):
        def t(text):
            if sprache == "ar":
                marken = "".join(re.findall(r"\[\d+\]", text))
                return self.BEISPIEL_AR.replace("[1]", marken)
            return "[TEST bs] " + text
        return {
            "titel": t(quelle["titel"]).replace("[TEST bs] ", "[TEST] "),
            "absaetze": [{"ueberschrift": t(a["ueberschrift"]) if a["ueberschrift"] else "", "text": t(a["text"])}
                         for a in quelle["absaetze"]],
            "unterschrift": quelle["unterschrift"],
            "quellen": list(quelle["quellen"]),
        }

    def pruefen_und_korrigieren(self, quelle, uebersetzung, sprache, hinweise=None):
        return dict(uebersetzung, korrekturen=[])

    def freigeben(self, quelle, uebersetzung, sprache):
        return {"freigabe": True, "probleme": []}

    def kosten(self):
        return 0.0


def automatisch_pruefen(quelle, ueb, sprache, test=False):
    """Prüfungen, die kein Sprachmodell brauchen. Liefert eine Liste von Problemen."""
    probleme = []
    if len(ueb["absaetze"]) != len(quelle["absaetze"]):
        probleme.append(f"Absatzzahl {len(ueb['absaetze'])} statt {len(quelle['absaetze'])}")
        return probleme
    if len(ueb["quellen"]) != len(quelle["quellen"]):
        probleme.append(f"{len(ueb['quellen'])} Quellenangaben statt {len(quelle['quellen'])}")
    if not ueb["titel"].strip():
        probleme.append("Titel fehlt")
    for i, (q, u) in enumerate(zip(quelle["absaetze"], ueb["absaetze"])):
        if not u["text"].strip():
            probleme.append(f"Absatz {i}: leer")
            continue
        if bool(q["ueberschrift"]) != bool(u["ueberschrift"]):
            probleme.append(f"Absatz {i}: Überschrift fehlt oder ist überzählig")
        if sorted(re.findall(r"\[(\d+)\]", q["text"])) != sorted(re.findall(r"\[(\d+)\]", u["text"])):
            probleme.append(f"Absatz {i}: Fußnotenmarken stimmen nicht überein")
        if u["text"].count("**") % 2:
            probleme.append(f"Absatz {i}: Fettmarkierung nicht geschlossen")
        if test:
            continue
        verhaeltnis = len(u["text"]) / max(1, len(q["text"]))
        if not 0.45 <= verhaeltnis <= 2.2:
            probleme.append(f"Absatz {i}: auffällige Länge (Faktor {verhaeltnis:.2f})")
        if sprache == "ar" and not ist_arabisch(u["text"], 0.6):
            probleme.append(f"Absatz {i}: überwiegend nicht in arabischer Schrift")
        if sprache != "ar" and ist_arabisch(u["text"], 0.2):
            probleme.append(f"Absatz {i}: enthält unerwartet viel arabische Schrift")
    return probleme


def sprache_erstellen(uebersetzer, quelle, sprache, protokoll, test=False):
    """Übersetzung mit zweifacher Prüfung. Gibt die freigegebene Übersetzung oder None zurück."""
    quelle_kurz = {k: quelle[k] for k in ("titel", "absaetze", "unterschrift", "quellen")}
    ueb = uebersetzer.uebersetzen(quelle_kurz, sprache)

    # Prüfung 1: unabhängiger Vergleich mit dem Original, Korrektur
    korr = uebersetzer.pruefen_und_korrigieren(quelle_kurz, ueb, sprache)
    protokoll["pruefung_1_korrekturen"] = korr.pop("korrekturen")
    ueb = korr

    # Prüfung 2: Freigabe durch dritten Durchgang + automatische Prüfungen
    for runde in (1, 2):
        urteil = uebersetzer.freigeben(quelle_kurz, ueb, sprache)
        auto = automatisch_pruefen(quelle_kurz, ueb, sprache, test)
        ernst = [p for p in urteil["probleme"] if p["schwere"] != "niedrig"]
        protokoll[f"pruefung_2_runde_{runde}"] = {"freigabe": urteil["freigabe"], "probleme": urteil["probleme"],
                                                  "automatisch": auto}
        if urteil["freigabe"] and not ernst and not auto:
            return ueb
        if runde == 2:
            return None
        hinweise = [f"Absatz {p['absatz']}: {p['beschreibung']}" for p in ernst] + auto
        korr = uebersetzer.pruefen_und_korrigieren(quelle_kurz, ueb, sprache, hinweise)
        protokoll["nachbesserung"] = korr.pop("korrekturen")
        ueb = korr
    return None


# ---------------------------------------------------------------------------
# 6) PDF erzeugen
# ---------------------------------------------------------------------------

def moschee_name():
    try:
        with open(os.path.join(WURZEL, "config.js"), encoding="utf-8") as f:
            m = re.search(r'MOSCHEE_NAME:\s*"([^"]*)"', f.read())
            return m.group(1) if m else ""
    except OSError:
        return ""


def text_html(t):
    t = html.escape(t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t, flags=re.S)
    t = re.sub(r"\[(\d+)\]", r"<sup>\1</sup>", t)
    return t.replace("\n", "<br>")


def font_url(datei):
    return "file://" + os.path.join(WURZEL, "fonts", datei)


def pdf_html(quelle, ueb, sprache):
    s = SPRACHEN[sprache]
    j, m, t = quelle["datum"].split("-")
    absaetze = "".join(
        (f'<h2>{text_html(a["ueberschrift"])}</h2>' if a["ueberschrift"] else "") + f'<p>{text_html(a["text"])}</p>'
        for a in ueb["absaetze"]
    )
    arabisch = "".join(f'<p class="ar-kopf">{html.escape(z)}</p>' for z in quelle["arabisch"])
    quellen = "".join(f"<li>{text_html(q)}</li>" for q in ueb["quellen"])
    richtung = "rtl" if s["rtl"] else "ltr"
    return f"""<!DOCTYPE html>
<html lang="{sprache}" dir="{richtung}"><head><meta charset="utf-8">
<style>
@font-face {{ font-family: Inter; src: url("{font_url('inter-latin-wght-normal.woff2')}") format("woff2"); font-weight: 100 900; }}
@font-face {{ font-family: Inter; src: url("{font_url('inter-latin-ext-wght-normal.woff2')}") format("woff2"); font-weight: 100 900;
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F; }}
@font-face {{ font-family: Naskh; src: url("{font_url('noto-naskh-arabic-arabic-400-normal.woff2')}") format("woff2"); font-weight: 400; }}
@font-face {{ font-family: Naskh; src: url("{font_url('noto-naskh-arabic-arabic-700-normal.woff2')}") format("woff2"); font-weight: 700; }}
@page {{ size: A4; margin: 16mm 18mm 20mm; }}
body {{ font-family: {"Naskh, Inter" if s["rtl"] else "Inter, Naskh"}, sans-serif; color: #1d1d1f; font-size: {"14.5pt" if s["rtl"] else "11pt"};
  line-height: {"1.75" if s["rtl"] else "1.55"}; margin: 0; }}
.hinweis {{ border: 1.5px solid #e40613; background: #fff4f4; border-radius: 12px; padding: 10px 14px; margin-bottom: 18px; }}
.hinweis strong {{ color: #b0000c; }}
.hinweis .de {{ font-family: Inter, sans-serif; direction: ltr; text-align: left; font-size: 9pt; color: #555; margin-top: 4px; line-height: 1.4; }}
.kopf {{ display: flex; justify-content: space-between; align-items: baseline; font-size: 9.5pt; color: #6e6e73; margin-bottom: 14px; }}
.ar-kopf {{ font-family: Naskh, serif; direction: rtl; text-align: center; font-size: 16pt; margin: 2px 0; line-height: 1.7; }}
h1 {{ font-size: {"21pt" if s["rtl"] else "19pt"}; line-height: 1.3; margin: 16px 0 2px; text-align: center; }}
.original {{ text-align: center; font-family: Inter, sans-serif; font-size: 9.5pt; color: #6e6e73; direction: ltr; margin-bottom: 18px; }}
h2 {{ font-size: 1em; margin: 16px 0 2px; }}
p {{ margin: 0 0 8px; text-align: justify; }}
.ar-kopf, h1 {{ text-align: center; }}
sup {{ font-size: .65em; line-height: 0; }}
.unterschrift {{ font-weight: 700; margin-top: 16px; }}
.quellen {{ margin-top: 18px; padding-top: 8px; border-top: 1px solid #d2d2d7; font-size: .82em; color: #424245; }}
.quellen ol {{ list-style: none; padding: 0; margin: 4px 0 0; }}
</style></head><body>
<div class="hinweis"><strong>⚠ {html.escape(s["hinweis"])}</strong><div class="de">{html.escape(HINWEIS_DE)}</div></div>
<div class="kopf"><span>{html.escape(s["kopf"])} · {html.escape(s["datum_wort"])} {t}.{m}.{j}</span><span>{html.escape(moschee_name())}</span></div>
{arabisch}
<h1>{text_html(ueb["titel"])}</h1>
<div class="original">{html.escape(s["original_wort"])}: „{html.escape(quelle["titel"])}“ – DITIB</div>
{absaetze}
{f'<p class="unterschrift">{html.escape(ueb["unterschrift"])}</p>' if ueb["unterschrift"] else ""}
{f'<div class="quellen"><ol>{quellen}</ol></div>' if quellen else ""}
</body></html>"""


def fusszeile(sprache):
    s = SPRACHEN[sprache]
    with open(os.path.join(WURZEL, "fonts", "noto-naskh-arabic-arabic-400-normal.woff2"), "rb") as f:
        naskh = base64.b64encode(f.read()).decode()
    return f"""<style>@font-face {{ font-family: N; src: url(data:font/woff2;base64,{naskh}); }}</style>
<div style="width:100%; font-size:8px; color:#86868b; padding:0 18mm; display:flex; justify-content:space-between;
  font-family: Helvetica, Arial, N, sans-serif;">
  <span>⚠ {html.escape(s["fusszeile"])} · Kann Übersetzungsfehler enthalten</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>"""


def pdf_erzeugen(quelle, ueb, sprache, ziel):
    from playwright.sync_api import sync_playwright
    html_datei = os.path.join(os.path.dirname(ziel), f".tmp-{sprache}.html")
    with open(html_datei, "w", encoding="utf-8") as f:
        f.write(pdf_html(quelle, ueb, sprache))
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PFAD") or None)
            seite = browser.new_page()
            seite.goto("file://" + html_datei, wait_until="networkidle")
            seite.evaluate("document.fonts.ready")
            seite.pdf(path=ziel, format="A4", print_background=True, display_header_footer=True,
                      header_template="<span></span>", footer_template=fusszeile(sprache),
                      margin={"top": "16mm", "bottom": "20mm", "left": "18mm", "right": "18mm"})
            browser.close()
    finally:
        os.remove(html_datei)


# ---------------------------------------------------------------------------
# Ablage
# ---------------------------------------------------------------------------

def schreiben_json_js(pfad_ohne_endung, daten, variable):
    inhalt = json.dumps(daten, ensure_ascii=False, indent=2)
    with open(pfad_ohne_endung + ".json", "w", encoding="utf-8") as f:
        f.write(inhalt + "\n")
    with open(pfad_ohne_endung + ".js", "w", encoding="utf-8") as f:
        f.write("/* Automatisch erzeugt von tools/predigt_laden.py */\n"
                f"window.{variable} = {inhalt};\n")


def alte_entfernen(ordner):
    tage = sorted(d for d in os.listdir(ordner) if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d))
    for d in tage[:-WOCHEN_AUFBEWAHREN]:
        shutil.rmtree(os.path.join(ordner, d))


def main():
    p = argparse.ArgumentParser(description="DITIB-Freitagspredigt laden, übersetzen, prüfen, als PDF ablegen.")
    p.add_argument("--datum", help="Datum der Predigt (YYYY-MM-DD), Standard: kommender Freitag")
    p.add_argument("--ausgabe", default=os.path.join(WURZEL, "predigten"), help="Zielordner")
    p.add_argument("--sprachen", default="bs,ar")
    p.add_argument("--erzwingen", action="store_true", help="auch neu erstellen, wenn schon vorhanden")
    p.add_argument("--test-uebersetzer", action="store_true", help="ohne API, nur Layout/PDF testen")
    a = p.parse_args()

    heute = datetime.datetime.now(TZ).date()
    datum = a.datum or ziel_freitag(heute).isoformat()
    sprachen = [s.strip() for s in a.sprachen.split(",") if s.strip() in SPRACHEN]
    zielordner = os.path.join(a.ausgabe, datum)
    meta_pfad = os.path.join(zielordner, "meta.json")

    if not a.test_uebersetzer and not os.environ.get("ANTHROPIC_API_KEY"):
        print("Kein ANTHROPIC_API_KEY gesetzt – Übersetzung ist nicht eingerichtet. Ende.")
        return
    if os.path.exists(meta_pfad) and not a.erzwingen:
        with open(meta_pfad, encoding="utf-8") as f:
            vorhanden = json.load(f)
        if all(s in vorhanden.get("sprachen", {}) for s in sprachen):
            print(f"Predigt vom {datum} ist bereits übersetzt. Ende.")
            return

    quelle = predigt_finden(datum)
    if not quelle:
        print(f"Predigt für {datum} ist noch nicht veröffentlicht. Ende.")
        return
    print(f"Gefunden: „{quelle['titel']}“ ({quelle['datum']}), {len(quelle['absaetze'])} Absätze, "
          f"{len(quelle['quellen'])} Quellen")

    uebersetzer = TestUebersetzer() if a.test_uebersetzer else Uebersetzer()
    os.makedirs(zielordner, exist_ok=True)
    meta = {"datum": datum, "titel": quelle["titel"], "original_pdf": quelle["original_pdf"],
            "quelle": quelle["detail_url"], "modell": "TEST" if a.test_uebersetzer else MODELL,
            "sprachen": {}, "protokoll": {}}

    for sprache in sprachen:
        protokoll = meta["protokoll"].setdefault(sprache, {})
        start = time.time()
        try:
            ueb = sprache_erstellen(uebersetzer, quelle, sprache, protokoll, a.test_uebersetzer)
        except Exception as e:                     # API-Fehler o. Ä.: diese Sprache auslassen
            protokoll["fehler"] = f"{type(e).__name__}: {e}"
            ueb = None
        if ueb is None:
            print(f"  {sprache}: NICHT freigegeben – wird nicht veröffentlicht. {protokoll.get('fehler', '')}")
            continue
        pdf_datei = f"predigt-{sprache}.pdf"
        pdf_erzeugen(quelle, ueb, sprache, os.path.join(zielordner, pdf_datei))
        meta["sprachen"][sprache] = {"pdf": f"predigten/{datum}/{pdf_datei}", "titel": ueb["titel"]}
        print(f"  {sprache}: freigegeben, PDF erstellt ({time.time() - start:.0f} s)")

    meta["erstellt"] = datetime.datetime.now(TZ).isoformat(timespec="seconds")
    meta["kosten_usd"] = round(uebersetzer.kosten(), 3)
    with open(meta_pfad, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)

    aktuell = {k: meta[k] for k in ("datum", "titel", "original_pdf", "sprachen", "erstellt")}
    schreiben_json_js(os.path.join(a.ausgabe, "aktuell"), aktuell, "PREDIGT_AKTUELL")
    alte_entfernen(a.ausgabe)
    print(f"Fertig. Tokens: {uebersetzer.ein} ein / {uebersetzer.aus} aus, Kosten ca. {meta['kosten_usd']} USD")


if __name__ == "__main__":
    sys.exit(main())
