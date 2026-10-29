/* =====================================================================
   EINSTELLUNGEN FÜR DIE ANZEIGE – DITIB-Moschee Marktoberdorf
   =====================================================================

   Dies ist die EINZIGE Datei, die Sie normalerweise ändern müssen.

   Hinweise zum Bearbeiten:
   - Texte stehen immer in Anführungszeichen: "so"
   - Zahlen stehen ohne Anführungszeichen: 180
   - Ja/Nein-Werte heißen true (ja) und false (nein)
   - Jede Zeile in einer Liste endet mit einem Komma.
   - Alles hinter // ist ein Kommentar und wird ignoriert.
   - Nach dem Speichern die Seite neu laden (F5) – oder bis 03:00 Uhr
     warten, dann lädt sie sich ohnehin von selbst neu.

   Wenn nach einer Änderung nur noch ein schwarzer/leerer Bildschirm
   erscheint, ist meist ein Komma oder Anführungszeichen verloren
   gegangen. Dann die letzte Änderung rückgängig machen.
   ===================================================================== */

window.CONFIG = {

  /* -------------------------------------------------------------------
     1) MOSCHEE
     ------------------------------------------------------------------- */

  // Name, der oben auf dem Bildschirm neben dem Logo steht.
  MOSCHEE_NAME: "DITIB Türkisch-Islamische Gemeinde zu Marktoberdorf e.V.",

  // Standort (wird nur für die Ersatz-Berechnung über das Internet
  // gebraucht, falls in gebetszeiten.json ein Tag fehlt).
  BREITENGRAD: 47.78,   // Nord
  LAENGENGRAD: 10.62,   // Ost

  // Zeitzone. Sommer- und Winterzeit werden automatisch berücksichtigt.
  ZEITZONE: "Europe/Berlin",


  /* -------------------------------------------------------------------
     2) DESIGN
     ------------------------------------------------------------------- */

  // Standard-Design, wenn in der Adresse kein ?theme=… steht:
  //   1 = „Nacht über Mekka“  (Nachtblau, Gold, Glas-Karten)
  //   2 = „İznik“             (Türkis, Kobalt, Creme, Ornamentrahmen)
  //   3 = „Smaragd & Gold“    (Smaragdgrün, Gold, Sternmuster)
  //   4 = „Minimal“           (Anthrazit/Weiß, sehr große dünne Ziffern)
  //   5 = „Glas“              (Apple-Stil, Liquid Glass, DITIB-Rot, hell/dunkel automatisch)
  THEME: 5,

  // Logo (wird in Design 5 oben links und in der Jumu'ah-Ansicht gezeigt).
  // Am besten eine SVG-Datei, bei der die Buchstaben ausgestanzt (transparent) sind.
  LOGO: "assets/ditib-logo.svg",
  // Schrift im Logo: weiß ("assets/ditib-logo-schrift.svg") oder durchsichtig ("").
  LOGO_SCHRIFT: "assets/ditib-logo-schrift.svg",

  // Optional: eigenes mehrfarbiges Logo für Tag- und Nachtmodus (nur Design 5).
  // Sind beide eingetragen, werden sie statt LOGO angezeigt und wechseln
  // automatisch mit hell/dunkel. Leer lassen ("") = normales Logo von oben.
  // Beispiel 40-Jahre-Logo:
  //   LOGO_TAG:   "assets/ditib-40-hell.svg",
  //   LOGO_NACHT: "assets/ditib-40-dunkel.svg",
  LOGO_TAG: "",
  LOGO_NACHT: "",

  // Feineinstellungen nur für Design 5 „Glas“
  DESIGN_5: {
    // "auto"   = tagsüber hell, abends/nachts dunkel (wie beim iPhone)
    // "hell"   = immer hell
    // "dunkel" = immer dunkel
    modus: "auto",

    // Bei "auto": Ab welcher Gebetszeit wird es dunkel bzw. wieder hell?
    // Mögliche Werte: "fajr", "shuruq", "dhuhr", "asr", "maghrib", "isha"
    dunkelAb: "maghrib",
    hellAb: "fajr",

    // Weichzeichnung des Livestreams in diesem Design. Bewusst schwächer als
    // bei den anderen Designs, damit hinter dem Glas Bewegung sichtbar ist.
    streamBlurPx: 4,

    // Wie stark das Glas den Hintergrund dahinter verwischt (Pixel).
    // Raspberry Pi: Ruckelt es, auf 0 setzen – das Glas bleibt dann klar.
    glasUnschaerfePx: 30,

    // Aufhellung (hell) bzw. Abdunklung (dunkel) des Hintergrunds, 0 bis 1.
    schleierHell: 0.55,
    schleierDunkel: 0.5,
  },


  /* -------------------------------------------------------------------
     3) NAMEN DER GEBETSZEITEN
     Links (name) groß, rechts (deutsch) klein darunter.
     Die Reihenfolge und die Schlüssel (fajr, shuruq, …) nicht ändern!
     ------------------------------------------------------------------- */
  GEBETE: {
    fajr:    { name: "İmsak",    deutsch: "Fajr" },
    shuruq:  { name: "Güneş",  deutsch: "Shuruq" },
    dhuhr:   { name: "Öğle",   deutsch: "Dhuhur" },
    asr:     { name: "İkindi",     deutsch: "Asr" },
    maghrib: { name: "Akşam", deutsch: "Maghrib" },
    isha:    { name: "Yatsı",    deutsch: "Isha" },
  },


  // Fajr: Wann wird das Morgengebet in der Moschee verrichtet?
  // Rechts oben bei „Nächstes Gebet“ wird für Fajr diese Uhrzeit angezeigt:
  // so viele Minuten vor Sonnenaufgang (Shuruq/Güneş). 0 = normale Fajr-Zeit (İmsak).
  // Die Gebetsleiste unten zeigt weiterhin die normale Fajr-Zeit.
  FAJR_MINUTEN_VOR_SHURUQ: 30,


  // Beschriftungen rechts oben im Feld „Nächstes Gebet“ (zuerst Türkisch, dann Deutsch).
  TEXTE: {
    naechstesGebet: "Sonraki Namaz / Nächstes Gebet",   // Überschrift
    morgen: "yarın / morgen",                           // steht in Klammern, wenn das Gebet erst morgen ist
  },


  /* -------------------------------------------------------------------
     4) GEBETSZEITEN-QUELLE
     ------------------------------------------------------------------- */

  // Reihenfolge: 1. diese Datei → 2. Diyanet online → 3. Aladhan (Berechnung)

  // 1) Lokale Datei mit den offiziellen Zeiten (wie in der DITIB-Namaz-Vakti-App).
  //    Wird automatisch von tools/diyanet_laden.py befüllt (auf GitHub
  //    läuft das jede Woche von selbst) oder mit tools/csv_zu_json.py aus einer CSV.
  GEBETSZEITEN_DATEI: "gebetszeiten.json",

  // 2) Fehlt ein Tag in der Datei: direkt bei Diyanet nachladen.
  //    ortId 10438 = MARKTOBERDORF (Diyanet-Ortsliste: Almanya → Bayern).
  DIYANET: {
    aktiv: true,
    ortId: 10438,
  },

  // 3) Letzte Ersatzquelle, falls Diyanet nicht erreichbar ist:
  //    berechnete Zeiten vom Aladhan-Internetdienst.
  ONLINE_ERSATZ: {
    aktiv: true,
    methode: 13,        // 13 = Diyanet İşleri Başkanlığı (Türkei)
    // Minuten-Korrektur je Gebet, z. B. dhuhr: 2 → 2 Minuten später,
    // fajr: -1 → 1 Minute früher. So lassen sich die Online-Zeiten an
    // den DITIB-Kalender angleichen. (Gilt NUR für die Online-Zeiten,
    // nicht für gebetszeiten.json.)
    tune: { fajr: 0, shuruq: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  },


  /* -------------------------------------------------------------------
     5) FREITAGSGEBET (JUMU'AH)
     ------------------------------------------------------------------- */
  JUMUAH: {
    // Uhrzeit des Freitagsgebets, getrennt nach Sommer- und Winterzeit.
    // (Sommerzeit = letzter Sonntag im März bis letzter Sonntag im Oktober)
    uhrzeitSommer: "13:30",
    uhrzeitWinter: "12:30",

    // Soll die Freitagsgebet-Uhrzeit klein auf dem Hauptbildschirm stehen?
    aufHauptbildschirm: true,

    // Am Freitag bleibt „Heute“ so viele Minuten nach Beginn des Freitagsgebets
    // stehen; danach wird schon das Freitagsgebet der nächsten Woche angezeigt.
    heuteBisMinutenNach: 120,

    // Bezeichnung in dieser kleinen Anzeige oben rechts.
    bezeichnung: "Cuma Namazı / Freitagsgebet",

    // Geplante Änderung der Uhrzeit: Ab „sichtbarAb“ (Datum und Uhrzeit) gelten die
    // neuen Uhrzeiten. Vorher zeigt die Anzeige weiter die alten an. Wird die Änderung
    // an einem Freitag wirksam (z. B. nach dem Gebet), zeigt die Anzeige ab dann sofort
    // den nächsten Freitag mit der neuen Uhrzeit. Es kann mehrere Einträge geben.
    // Nur ändern, was sich ändert – fehlt uhrzeitSommer, bleibt die bisherige.
    aenderungen: [
      { sichtbarAb: "2026-10-30 13:15", uhrzeitWinter: "13:15" },   // ab 6.11. um 13:15
    ],
  },

  // Die bildschirmfüllende Jumu'ah-Sonderansicht.
  JUMUAH_ANSICHT: {
    aktiv: true,

    // An welchen Tagen und zu welchen Uhrzeiten soll sie erscheinen?
    // wochentag: 0 = Sonntag, 1 = Montag, … 4 = Donnerstag, 5 = Freitag
    // von / bis: Uhrzeit im Format "HH:MM"
    // modus:  "gemischt"   = wechselt sich mit dem Hauptbildschirm ab (Intervall unten)
    //         "nur_jumuah" = in diesem Zeitraum NUR die Jumu'ah-Ansicht, dauerhaft
    zeitraeume: [
      { wochentag: 4, von: "00:00", bis: "23:59", modus: "gemischt" },   // Donnerstag ganztags
      { wochentag: 5, von: "00:00", bis: "13:14", modus: "gemischt" },  // Freitag bis 14:30
      { wochentag: 5, von: "13:15", bis: "14:30", modus: "nur_jumuah" }
    ],

    // Alle wie viele Sekunden erscheint die Sonderansicht? (180 = 3 Minuten)
    intervallSekunden: 190,

    // Wie viele Sekunden bleibt sie stehen?
    anzeigeSekunden: 20,

    // Dauer der Überblendung in Millisekunden (1500 = 1,5 Sekunden)
    ueberblendungMs: 1500,

    // Texte auf der Jumu'ah-Ansicht
    texte: {
      titel: "Cuma namazı",               // große Überschrift
      untertitel: "Freitagsgebet",    // darunter
      heute: "Heute",                 // vor dem Datum, wenn das Gebet heute ist
      morgen: "Morgen",               // vor dem Datum, wenn das Gebet morgen ist
      hinweis: "Yeni saat/Neue Uhrzeit 13:15 Uhr",                    // zusätzliche Zeile ganz unten, z. B. "Neue Uhrzeit!" ("" = keine)
      // Zeitraum für den Hinweis (Datum und Uhrzeit). Leer lassen ("") = immer sichtbar.
      hinweisAb: "2026-10-30 13:15",    // ab hier sichtbar (gleich wie die Umstellung oben)
      hinweisBis: "2026-11-06 14:30",   // ab hier wieder ausgeblendet
    },
  },


  /* -------------------------------------------------------------------
     6) SOCIAL MEDIA (QR-Codes)
     Instagram: einfach den Namen mit oder ohne @ eintragen.
     Lange Namen werden automatisch zweizeilig umbrochen.
     ------------------------------------------------------------------- */
  INSTAGRAM_MOSCHEE: "@ditib_marktoberdorf",
  INSTAGRAM_MOSCHEE_TITEL: "Moschee",

  INSTAGRAM_JUGEND: "@ditib_jugend_marktoberdorf",
  INSTAGRAM_JUGEND_TITEL: "Jugend",

  // WhatsApp-Kanal: den kompletten Link eintragen (in WhatsApp: Kanal öffnen →
  // Kanalname antippen → „Link teilen“ → „Link kopieren“).
  // Leer lassen ("") = kein WhatsApp-QR-Code.
  WHATSAPP_KANAL: "https://www.whatsapp.com/channel/0029VbByAkR0lwgsquR6LW03",
  WHATSAPP_KANAL_TITEL: "WhatsApp",
  WHATSAPP_KANAL_TEXT: "Kanal folgen",


  /* -------------------------------------------------------------------
     7) HINTERGRUND: LIVESTREAM AUS MEKKA
     ------------------------------------------------------------------- */
  STREAM: {
    aktiv: true,

    // YouTube-Kanal, dessen aktueller Livestream gezeigt wird.
    // Standard: offizieller Kanal „KSA Qur'an TV“ (Live aus der Masjid al-Haram).
    // Die Kanal-ID beginnt immer mit "UC". So finden Sie sie: Kanal auf
    // YouTube öffnen → „Teilen“ → „Kanal-ID kopieren“.
    kanalId: "UCos52azQNBgW63_9uDJoPDA",

    // Optional: Statt des Kanals ein bestimmtes Video/Livestream verwenden.
    // Leer lassen ("") = Kanal verwenden (empfohlen, weil sich
    // Livestream-IDs immer wieder ändern).
    videoId: "",

    // Weichzeichnung in Pixeln (0 = scharf, 12 = deutlich verschwommen)
    blurPx: 12,

    // Abdunklung: 0 = gar nicht, 1 = komplett schwarz. Empfehlung 0.5–0.7
    abdunklung: 0.6,

    // Leistung: Der Stream wird intern in dieser Breite abgespielt und dann
    // hochskaliert. Kleiner = weniger Rechenlast und Datenverbrauch (wegen
    // der Weichzeichnung sieht man keinen Unterschied).
    // Raspberry Pi: 640 empfohlen, Mini-PC: 960 oder 1280.
    renderBreite: 640,
  },

  // Ersatz-Hintergrund, falls der Stream nicht lädt (kein Internet usw.).
  // Leer lassen ("") = ruhiger Farbverlauf passend zum Design.
  // Oder ein eigenes Bild in den Ordner assets/ legen, z. B.
  // HINTERGRUNDBILD: "assets/hintergrund.jpg",
  HINTERGRUNDBILD: "",


  /* -------------------------------------------------------------------
     8) DATUM
     ------------------------------------------------------------------- */

  // Korrektur des Hidschri-Datums in Tagen (z. B. -1 oder 1), falls es
  // vom DITIB-Kalender abweicht.
  HIDSCHRI_KORREKTUR_TAGE: 0,

  // Namen der islamischen Monate (lateinische Umschrift).
  HIDSCHRI_MONATE: [
    "Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Akhir",
    "Dschumada l-Ula", "Dschumada l-Akhira", "Radschab", "Scha'ban",
    "Ramadan", "Schawwal", "Dhu l-Qa'da", "Dhu l-Hiddscha",
  ],

  // Türkische Namen beim Datum anzeigen (true = ja, false = nein):
  //   „Çarşamba / Mittwoch, 28.10.2026“ und „17. Cemaziyelevvel / Dschumada l-Ula 1448“
  HIDSCHRI_TUERKISCH: true,
  WOCHENTAGE_TUERKISCH: [
    "Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi",
  ],
  HIDSCHRI_MONATE_TUERKISCH: [
    "Muharrem", "Safer", "Rebiülevvel", "Rebiülahir",
    "Cemaziyelevvel", "Cemaziyelahir", "Recep", "Şaban",
    "Ramazan", "Şevval", "Zilkade", "Zilhicce",
  ],


  /* -------------------------------------------------------------------
     9) SYSTEM
     ------------------------------------------------------------------- */

  // Tägliches Neuladen der Seite (für einen stabilen Dauerbetrieb).
  NEULADEN_UM: "03:00",

  // Burn-in-Schutz: Das Layout verschiebt sich unmerklich.
  BURNIN_SCHUTZ: {
    aktiv: true,
    maxPixel: 8,         // höchstens so viele Pixel in jede Richtung
    alleMinuten: 4,      // so oft wird verschoben
  },


  /* -------------------------------------------------------------------
     10) VERS DES TAGES
     Jeden Tag wird automatisch der nächste Vers der Liste gezeigt.
     Format:  { text: "…", sure: "Name der Sure", stelle: "Sure:Vers" },
     Bitte kurze Verse wählen (höchstens etwa 3 Zeilen).
     Die Übersetzungen sind sinngemäß; bitte nach Wunsch mit der
     Übersetzung Ihres Vertrauens (z. B. Diyanet) abgleichen.
     ------------------------------------------------------------------- */
  VERSE: [
    { text: "Wahrlich, im Gedenken Allahs finden die Herzen Ruhe.", sure: "Ar-Ra'd", stelle: "13:28" },
    { text: "Gewiss, mit der Erschwernis ist Erleichterung. Gewiss, mit der Erschwernis ist Erleichterung.", sure: "Asch-Scharh", stelle: "94:5–6" },
    { text: "So gedenkt Meiner, dann gedenke Ich euer. Und seid Mir dankbar und seid nicht undankbar.", sure: "Al-Baqara", stelle: "2:152" },
    { text: "O ihr, die ihr glaubt, sucht Hilfe in der Geduld und im Gebet. Gewiss, Allah ist mit den Geduldigen.", sure: "Al-Baqara", stelle: "2:153" },
    { text: "Und wenn dich Meine Diener nach Mir fragen: Ich bin nahe. Ich erhöre den Ruf des Bittenden, wenn er Mich anruft.", sure: "Al-Baqara", stelle: "2:186" },
    { text: "Allah erlegt keiner Seele mehr auf, als sie zu tragen vermag.", sure: "Al-Baqara", stelle: "2:286" },
    { text: "Gewiss, das Gebet hält ab vom Schändlichen und Verwerflichen.", sure: "Al-'Ankabut", stelle: "29:45" },
    { text: "Und wer sich auf Allah verlässt, dem ist Er genug.", sure: "At-Talaq", stelle: "65:3" },
    { text: "Sag: O Meine Diener, die ihr gegen euch selbst maßlos gewesen seid, verliert nicht die Hoffnung auf Allahs Barmherzigkeit.", sure: "Az-Zumar", stelle: "39:53" },
    { text: "Und sag: Mein Herr, lass mich an Wissen zunehmen.", sure: "Ta-Ha", stelle: "20:114" },
    { text: "Gewiss, Allah ist mit denen, die gottesfürchtig sind, und mit denen, die Gutes tun.", sure: "An-Nahl", stelle: "16:128" },
    { text: "O ihr, die ihr glaubt, wenn am Freitag zum Gebet gerufen wird, dann eilt zum Gedenken Allahs und lasst das Geschäft ruhen.", sure: "Al-Dschumu'a", stelle: "62:9" },
    { text: "O ihr, die ihr glaubt, gedenkt Allahs in häufigem Gedenken.", sure: "Al-Ahzab", stelle: "33:41" },
    { text: "Gewiss, das Gebet ist für die Gläubigen eine zu bestimmten Zeiten vorgeschriebene Pflicht.", sure: "An-Nisa'", stelle: "4:103" },
    { text: "Alles Lob gebührt Allah, dem Herrn der Welten.", sure: "Al-Fatiha", stelle: "1:2" },
    { text: "Welche der Wohltaten eures Herrn wollt ihr denn leugnen?", sure: "Ar-Rahman", stelle: "55:13" },
    { text: "Wehre das Schlechte mit dem ab, was besser ist.", sure: "Fussilat", stelle: "41:34" },
    { text: "Und dein Herr hat bestimmt, dass ihr nur Ihm dienen und zu den Eltern gütig sein sollt.", sure: "Al-Isra'", stelle: "17:23" },
    { text: "Und sucht Hilfe in der Geduld und im Gebet.", sure: "Al-Baqara", stelle: "2:45" },
    { text: "Und Er ist mit euch, wo immer ihr auch seid.", sure: "Al-Hadid", stelle: "57:4" },
    { text: "O ihr Menschen, Wir haben euch zu Völkern und Stämmen gemacht, damit ihr einander kennenlernt.", sure: "Al-Hudschurat", stelle: "49:13" },
  ],

  // Feste Verse für bestimmte Tage – haben Vorrang vor der Liste oben.
  // Je genauer die Angabe, desto höher der Vorrang:
  //   datum: "2026-11-06"                 → genau an diesem Datum
  //   hidschriMonat: 1, hidschriTag: 10    → jedes Jahr an diesem islamischen Datum (10 Muharrem)
  //   hidschriMonat: 9                     → den ganzen islamischen Monat (9 = Ramazan)
  //   wochentag: 5                         → jede Woche an diesem Tag (0 = Sonntag … 5 = Freitag)
  // Islamische Monate: 1 Muharrem, 2 Safer, 3 Rebiülevvel, 4 Rebiülahir, 5 Cemaziyelevvel,
  //   6 Cemaziyelahir, 7 Recep, 8 Şaban, 9 Ramazan, 10 Şevval, 11 Zilkade, 12 Zilhicce
  // Zum Aktivieren die beiden // am Zeilenanfang entfernen.
  VERSE_FEST: [
    // { wochentag: 5, text: "Oh ihr, die ihr glaubt, wenn am Freitag zum Gebet gerufen wird, dann eilt zum Gedenken Allahs und lasst das Geschäft ruhen.", sure: "Al-Dschumu'a", stelle: "62:9" },
    // { hidschriMonat: 9, text: "Oh ihr, die ihr glaubt, vorgeschrieben ist euch das Fasten, so wie es denen vor euch vorgeschrieben war, auf dass ihr gottesfürchtig werdet.", sure: "Al-Baqara", stelle: "2:183" },
    // { datum: "2026-11-06", text: "…", sure: "…", stelle: "…" },
  ],
};
