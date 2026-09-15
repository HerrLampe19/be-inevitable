# BE INEVITABLE

All-in-One Coaching-App für Training, Ernährung und Fortschritt – als Web-App
(läuft im Browser und lässt sich auf dem Handy zum Home-Bildschirm hinzufügen).

Coach-Athlet-Hybrid: Coaches erstellen und betreuen Trainings- und Ernährungspläne,
Athleten tracken ihren Alltag direkt in derselben App.

> **Sicherheit und Datenschutz:** was die App schützt, **wer was sieht** (seit 2.6.0 ist der
> Administrator Betreiber und kein Coach mehr), was der Betreiber vor dem Upload setzen muss und was
> in eine Datenschutzerklärung gehört, steht in **SICHERHEIT.md**.
>
> **Online stellen:** DEPLOYMENT.md (mit Render-Checkliste). **Auf dem iPhone prüfen:**
> IPHONE-TEST.md.
>
> **Aktuelle Version:** wird in der App angezeigt (Login-Screen unten + Profil-Menü)
> und ist jederzeit unter `/api/version` abrufbar. Die Versionshistorie steht in
> **CHANGELOG.md**.

---

## Was die App kann

**Für Athleten**
- **Training:** Trainingsplan nach Tagen, Sätze mit einem Haken je Zeile loggen
  (Gewicht + Wiederholungen zusammen, Pause startet automatisch), Pausen-Leiste über der
  Navigation mit Countdown, ±15 s und Hantelrechner, automatische Progressions-Empfehlung
  (mehr/halten/weniger), Bestleistungen, Übungs-Verlaufskurve, Workout-Abschluss-Screen.
- **Übungsbibliothek, Tauschen und Supersätze (ab 3.0.0):** Beim Anlegen einer Übung schlägt die App
  aus einem **Katalog** vor, während du tippst – **70 mitgelieferte Übungen** (Grundübungen, die
  üblichen Maschinen, fünf Cardio-Geräte) plus alles, was in deinen Plänen schon steht, plus was du
  selbst anlegst. Die Liste ist bewusst kurz statt vollständig: jede Zeile ist ein Vorschlag, und
  eine Liste, in der man scrollen muss, trifft schlechter als eine, die trifft.
  Gesucht wird umlautfest und zweisprachig – „ruecken", „rücken" und
  „squat" finden alle etwas (nachgemessen). Wählst du einen Vorschlag, füllt sich der **Muskel von
  selbst** – aber nur, wenn das Feld leer ist, und mit einem Satz darunter, woher der Wert kommt.
  Was du von Hand hineingeschrieben hast, überschreibt die App nicht.
  Legst du etwas an, das es schon gibt, sagt die App es dir, statt es zweimal zu führen – mit dem
  Tag und der Zahl der Sätze, die dort schon daran hängen:
  *„Meinst du ‚Beinpresse'? Die hast du schon – Probe-Tag, 30 geloggte Sätze."* Das ist der Punkt an
  der ganzen Sache: vier Übungen doppelt im Plan heißen zwei getrennte Bestwerte und eine
  Progression, die auf beiden Hälften zu langsam läuft.
  Dazu zwei Handgriffe im Übungs-Menü **„···"**:
  - **„Übung tauschen"** – die neue Übung nimmt denselben Platz, dieselbe Satzzahl und denselben
    Zielbereich. Deine alten Sätze bleiben gespeichert und über die Zeile **„Getauscht · früher: …"**
    erreichbar. Die neue Übung fängt mit einem **eigenen** Bestwert an, weil ein Bestwert an der
    Übung hängt und nicht am Platz im Plan.
  - **„Supersatz"** – zwei oder **höchstens drei** Übungen desselben Tages zu einer Gruppe koppeln
    (**A1, A2, A3**; mehr wäre ein Zirkel, und die gemeinsame Pause so lang, dass der erste Satz
    kalt ist, bevor der letzte steht).
    Nach dem Haken bei A1 startet **keine** Pause; die App springt direkt zu A2, und die Pause läuft
    **einmal für die Gruppe**. Auflösen geht im selben Blatt. Ohne Gruppe ändert sich am gewohnten
    Ablauf nichts.

  Beides steht **im Plan auf dem Server**, nicht nur auf deinem Telefon: Gruppe und Tausch laufen
  über eigene Routen und sind damit auf jedem Gerät und für deinen Coach dieselben (nachgemessen:
  Gruppe gesetzt → `group_id` steht danach an beiden Übungen im Plan, auflösen nimmt sie wieder
  weg). Kann der Server sie einmal nicht annehmen, merkt sich die App die Gruppe für dieses Gerät
  und **sagt es dazu** („… nur auf diesem Gerät") – statt so zu tun, als wäre sie gespeichert.
- **e1RM-Verlauf je Übung (ab 3.0.0):** Im Übungs-Menü **„···" → „Verlauf"** steht unter der
  Gewichtskurve die **geschätzte Maximalkraft** als eigener Verlauf – die Kennzahl, die ein
  Kraftsportler wirklich verfolgt. Sie ist bewusst **eng** gerechnet, und die Kurve sagt das auch:
  gezählt wird je Einheit der beste **Arbeitssatz mit höchstens 10 Wiederholungen**; Aufwärm-, Drop-
  und Backoff-Sätze bleiben draußen. Steht die Kurve leer oder zählen Sätze nicht mit, sagt die
  Fußnote, **wie viele** und warum – ein Aufwärmsatz 60 kg × 15 ergäbe rechnerisch 90 kg und schlüge
  damit einen echten Arbeitssatz mit 67,5 kg × 8. Genannt wird auch die Formel (Epley: Gewicht ×
  (1 + Wiederholungen ÷ 30)); über 10 Wiederholungen laufen die gängigen Formeln um bis zu 22 %
  auseinander, und eine Zahl, die so stark von der Formelwahl abhängt, ist keine Aussage über Kraft.
  **Keine übungsübergreifenden Vergleiche** – ein e1RM hängt an der Übung, nicht am Menschen.
- **Ernährung:** „Laut Plan als Nächstes" mit „Gegessen ✓" und „Tauschen" (samt
  Wiederherstellen), Tagesprotokoll mit Kalorien & Makros, Ernährungsplan-Generator
  (trifft das Kalorienziel, mit vegetarisch/vegan-Option), 50+ Rezepte, Barcode-Scanner,
  Makro-Rechner, Einkaufswagen, Mahlzeiten aufschlüsselbar. Beim Hinzufügen stehen die
  zuletzt und häufig genutzten Lebensmittel oben, mit Portions-Chips in der richtigen
  Einheit (g / ml / Stück).
- **Kalorienziel, das mitlernt (ab 3.0.0, Standard AUS):** Bis 2.9.0 war das Kalorienziel eine
  **Formel** – Gewicht, Größe, Alter, Ziel, einmal gerechnet, dann steht sie. Ab 3.0.0 kann die App
  einmal pro Woche **messen** statt rechnen: Sie glättet deinen Gewichtsverlauf (7-Tage-EMA), hält
  ihn gegen das, was du wirklich gegessen hast, und schätzt daraus deinen tatsächlichen Verbrauch.
  Daraus wird **höchstens ±100 kcal pro Woche** – mit einem Satz dazu, warum.
  Zu finden unter **Ernährung → Plan → „⋯" → „Ziele automatisch anpassen"**.

  **Und jetzt der wichtigere Teil: wann sie NICHT anpasst.** Eine Automatik, die immer etwas tut,
  folgt irgendwann dem Rauschen statt dir. Diese hier hält still, sobald eine dieser Bedingungen
  zutrifft – alle Grenzen stehen in `src/logic.js` und sind im Rückgabewert benannt:
  - **Der Schalter ist aus** (Standard). Dann wird zwar gerechnet, aber nichts geändert – du bekommst
    einen Vorschlag zum Übernehmen oder Behalten.
  - **Du hast einen Coach.** Dann geht die Anpassung erst an ihn und wirkt erst nach seiner Freigabe.
  - **Weniger als 4 protokollierte Esstage** in den letzten 14 (`TDEE_MIN_LOG_DAYS`). Ein Schnitt aus
    zwei Tagen ist kein Wochenschnitt. Die App sagt das auch so: *„Zu wenig Daten diese Woche – ich
    lasse dein Ziel stehen."*
  - **Weniger als 3 Wiegetage**, oder sie liegen weniger als eine Woche auseinander, oder zwischen
    zwei Wägungen liegen **mehr als 7 Tage**. Über eine Urlaubspause hinweg besteht ein „Trend" aus
    mehr erfundenen als gemessenen Tagen.
  - **Die Messung weicht um mehr als 35 % von der Formel ab.** Das ist der Riegel gegen halb
    protokollierte Tage: Wer an fünf von sieben Tagen nur die Hälfte einträgt, sieht für eine
    Energiebilanz aus wie jemand, der wenig isst – und das Ziel wäre Woche für Woche gefallen, ohne
    dass irgendwo ein Fehler sichtbar geworden wäre.
  - **Die Änderung wäre kleiner als 25 kcal.** Dann bleibt das Ziel stehen.
  - **Unter 1.200 kcal** geht es nie, Protein bleibt an g/kg gebunden, Fett nie unter seine Untergrenze.
    Das ist auch die **einzige Ausnahme von den ±100 kcal**: Liegt ein Ziel unter dieser Grenze, hebt
    die App es sofort ganz an, statt es in 100er-Schritten drei Wochen lang zu tief zu lassen. Nach
    oben gibt es keine solche Ausnahme.

  Jede Änderung steht mit Begründung, Quelle und Datum im **Zielverlauf** und lässt sich widerrufen.
  Der geschätzte Verbrauch wird übrigens **auch dann** festgehalten, wenn nicht angepasst wird – er
  ist die Zahl, die den Vorschlag erklärt.

  > ⚠️ **Eine Einschränkung am Stand 3.0.0, nachgemessen:** Der Kippschalter im Sheet **speichert
  > nicht**. Er meldet Erfolg, springt aber beim nächsten Öffnen zurück auf „Aus", weil die
  > Oberfläche den Modus an eine Route schickt, die dieses Feld nicht kennt
  > (`PUT /api/profile` → 200, danach weiterhin `mode: "formel"`). **Praktisch heißt das: Die
  > Automatik bleibt vorerst aus, und die wöchentliche Rechnung kommt als Vorschlag zum Übernehmen
  > oder Behalten** – also genau das, was auch mit eingeschaltetem Schalter passiert wäre, solange du
  > einen Coach hast. Es geht dir dadurch nichts verloren und nichts wird ungefragt geändert. Der
  > Auftrag steht in `DEFER-B1.md` (D1); die Route dafür (`POST /api/targets/:userId/mode`) gibt es
  > und sie funktioniert.
- **Tracking & Analyse:** täglicher Check-in (Gewicht, Schlaf, Schritte, Wasser) direkt
  auf der Home, Körpermaße, Fortschrittsfotos, Cardio, Supplements, Statuskarte mit
  Gewichtstrend und nächstem Schritt, Übungs-Verlauf je Übung. Die Kacheln sind zugleich die
  Diagramm-Auswahl: eine antippen, darunter steht die passende Kurve mit Ziel-Linie und
  7-Tage-Mittel (ab 2.2.0 – vorher standen alle Diagramme untereinander).
- **Bereitschaft (ab 2.3.0):** Eine Zahl von 0 bis 100 aus **Schlaf, HRV, Ruhepuls und deiner
  Trainingslast der letzten 7 Tage**, dazu ein Wort und **ein Satz, was das für heute heißt**.
  Auf der Startseite eine Zeile, angetippt die komplette Rechnung samt 14-Tage-Verlauf. Fehlende
  Werte werden nicht geraten – der Teil fällt weg; steht nur eine einzige Quelle zur Verfügung,
  wird die Zahl zur Mitte hin gedämpft. Keine medizinische Bewertung, und die App schreibt das
  auch dazu.
  **Neu in 3.0.0 – zwei Zustände zwischen „nichts" und „einer Zahl":**
  - **„Kalibriert – noch 4 Nächte"** statt einer Zahl aus zu wenigen Daten. Bis 2.9.0 gab es nur
    „Noch keine Daten" oder einen Wert; dazwischen fehlte der Fortschritt. Gezählt werden die Tage
    der letzten 14 mit Schlaf-, HRV- oder Ruhepuls-Wert, gebraucht werden **7** (so lange brauchen
    auch Apple und Fitbit für ihre eigene Grundlinie). Darunter steht genau das – und *„Ohne diese
    Grundlage hätte eine Zahl nichts, womit sie sich vergleichen könnte."*
  - **Divergenz-Hinweis** für den Fall, den kein Fitness-Armband sieht: **„Deine Werte sind
    unauffällig, dein Selbstbericht fällt seit 3 Tagen."** – und umgekehrt, wenn zwei Messwerte
    außerhalb deines üblichen Bereichs liegen und dein Gefühl nichts davon sagt. Gemeldet wird erst
    ab **zwei** abweichenden Metriken bzw. drei Tagen in Folge, und dazu kommt ein
    **Ursachen-Angebot**, nie eine Diagnose: *„Stress, Schlafrhythmus, Alkohol oder ein beginnender
    Infekt kommen infrage."* Der Selbstbericht dafür ist die Energie/Stimmung aus dem
    Mindset-Reiter – wer den nicht nutzt, bekommt keinen Divergenz-Hinweis, weil es ohne
    Selbstbericht keine Divergenz gibt.
- **Wochenrückblick (ab 2.3.0):** Drittes Segment „Woche" in der Analyse – drei Höhepunkte, **ein
  Fokus für nächste Woche**, dann die Zahlen (Training gegen Plan, Volumen, Kalorien- und
  Eiweißtreue, Gewicht, Schlaf/Schritte/Verbrauch, Mindset) mit Vergleich zur Vorwoche und ‹ › durch
  frühere Wochen. Sonntags ab 18 Uhr kommt er als Nachricht und Push (ein Tipp öffnet genau die
  berichtete Woche); die Wochen-E-Mail rechnet mit denselben Zahlen.
- **Apple Health (ab 2.2.0):** Ein Kurzbefehl auf dem iPhone schickt **Schlaf, Schritte, aktive
  Kalorien, Bewegungsminuten, Ruhepuls, HRV und Gewicht** an einen persönlichen Link – als
  Automation jede Nacht von selbst. Auf Wunsch kommen auch die **Trainings** mit (Laufen, Rad,
  Krafttraining …) und landen unter *Training → Cardio*. Einrichtung und Format:
  **HEALTH-IMPORT.md**. Der Weg von Hand (Text einfügen / Datei) bleibt erhalten.
- **Motivation:** XP, Level, Erfolge – und seit 2.9.0 **eine** Konsistenz-Mechanik statt mehrerer
  Zählungen: die **Wochen-Konsistenz** („3 von 4 geplanten Einheiten"). Ein Fehltag bricht nichts,
  die Woche läuft bis Sonntag, und erst eine ganz verfehlte Woche unterbricht die Wochenserie. Der
  frühere „Streak-Joker" heißt jetzt, was er ist: eine **Reparatur**. Sie trägt einen vergessenen Tag
  automatisch nach; es gibt höchstens zwei davon, sie füllen sich wöchentlich nach, und **höchstens
  zwei je 30 Tage** werden eingesetzt – wer öfter aussetzt, fängt neu an. Keine Schuld-Töne, keine
  Drohung mit einer reißenden Serie.
- **Mindset (ab 2.0.0):** eigener Reiter 🧠 für mentale Routinen –
  geführtes **Morgen-Priming** (5/10/15 Min., Vollbild-Player mit Atem-Taktgeber),
  eine **Tages-Checkliste** (Priming, Power-Atmung 1-4-2, State-Change 60 s,
  Abend-Reflexion, Frage des Tages, laufende Challenge), **Rad des Lebens**
  (7 Lebensbereiche, Balance-Index, Entwicklung, Maßnahmen), **Emotionaler Wochencheck**,
  **Vital-Challenge** (10/30 Tage, Regeln teils automatisch aus den Logs erkannt) und ein
  **Wissens-Bereich** mit persönlichen Arbeitsblättern (privat – nur der Athlet sieht sie).
  Mit Mindset-Verknüpfung in der Home-Karte, fünftem Tagesziel-Ring, XP, Erfolgen und
  eigenen Erinnerungen. Anleitung: **MINDSET.md**.
- **Kalender & Trainingsrhythmus:** kommende Tage als Widget, voller Monatskalender; Ruhetag/Krank
  melden, der Rhythmus rechnet automatisch weiter. Der Rhythmus ist eine **endlos wiederholte Folge
  ohne Wochentage** – seit 2.2.0 lässt sich jeder Platz namentlich belegen, z.B.
  `O1 · U1 · Ruhe · O2 · U2 · Ruhe`. Der aktuelle Zyklus steht unter dem Monatskalender und führt
  mit einem Tipp in den Editor.
- **Teilen:** Rezepte und Übungen per Link verschicken (WhatsApp & Co.);
  Empfänger übernimmt sie mit einem Tipp in sein Profil.
- **Offline nutzbar (ab 2.3.0):** Sätze, Essen, Check-ins, Supplements und Cardio lassen sich ohne
  Empfang eintragen; sie landen in einer Warteschlange auf dem Gerät und gehen von selbst raus,
  sobald wieder Netz da ist. Im Kopf steht „Offline · 3 warten". Nichts geht verloren, nichts kommt
  doppelt an (Essen, Cardio und spontane Supplement-Einträge tragen dafür eine Marke, die der Server wiedererkennt; Sätze,
  Check-ins und Plan-Supplements landen ohnehin immer im selben Eintrag), und ein Serverneustart
  verwirft nichts. Die App **startet** auch ohne Netz: Ein Service Worker hält die Programmhülle
  vor. Dateien mit Versionsstempel (`?v=…`) kommen aus dem Cache ohne Nachfrage – ihre Adresse ändert
  sich mit jeder Version, deshalb kann nie etwas Altes hängen bleiben; `index.html` und `/api/*`
  werden nie gecacht.
- **Suche (ab 2.3.0):** Lupensymbol im Kopf – findet Übungen, Rezepte, Lebensmittel, Mindset-Themen
  **und App-Funktionen** in einer Liste. Umlaute sind egal („masse" findet „Maße"), ein Treffer
  führt direkt hin.
- **Erinnerungen (ab 2.9.0):** Profil → Erinnerungen zeigt **jede** Push-Art, die es gibt, mit
  ihrem Zeitfenster – Trainings-Erinnerung (Uhrzeit wählbar), Priming, Abend-Reflexion, dazu als
  ehrliche Liste die fünf, die am Hauptschalter hängen (Wochenrückblick, Coach-Nachricht,
  Planänderung, Reparatur, Abend-Hinweis). Dazu eine **Test-Mitteilung**, die zeigt, ob die Anzeige
  auf diesem Gerät funktioniert. Gefragt wird nach Erinnerungen **erst nach dem ersten Eintrag** und
  **in der App**, nicht per Systemdialog – und auf dem iPhone erst, wenn die App vom Home-Bildschirm
  läuft (sonst gibt es dort gar keinen Push). Details und Prüfliste: **IPHONE-TEST.md**.
- **Daten-Export** (eigene Daten als JSON) und **Einwilligung** (Art. 9 DSGVO) unter
  **Profil → Daten & Verbindungen** – jederzeit widerrufbar.

**Für Coaches**
- Athleten-Übersicht als **eine** nach Dringlichkeit sortierte Liste (Alarm › Beobachten › OK)
  mit dem wichtigsten Grund je Zeile.
- **Wochen-Review-Inbox (ab 3.0.0):** Über der Athletenliste steht eine Umschaltung
  **Athleten · Wochen-Review**. Im zweiten Reiter liegt **eine Karte je Athlet** mit den Zahlen der
  Woche – Trainingseinheiten gegen Plan, geloggte Tage, Gewichts-Delta, Bestleistungen, Beschwerden,
  offene Nachrichten – und einem Antwortfeld darunter. Umschaltbar zwischen **Letzte Woche**
  (Standard – die abgeschlossene Woche ist die, über die man redet) und **Diese Woche**; über den
  Karten steht, woher welche Zahl kommt.
  Die Rechnung dahinter (`GET /api/weekreport/:userId`) ist **eine** und liefert **zwei Tonlagen** –
  *„2 von 5 Einheiten diese Woche."*, wenn der Athlet sie abruft, *„Marco Munsch: 2/5 Einheiten,
  2/7 Tage geloggt"*, wenn sein Coach dieselbe Woche abruft (beides nachgemessen; dieselbe Zahl,
  einmal als Ansprache, einmal als Meldung). **Beide Seiten holen sie
  sich:** die Karte des Coaches komplett, der Wochenrückblick des Athleten in *Analyse → Woche* für
  seine Treue-Bänder und die Rekordliste. Nachgemessen steht dort jetzt
  *„Training · Anteil der geplanten Einheiten · als getroffen gilt ein Korridor von 80–120 % ·
  2 von 4 Einheiten · 50 % · Tag 2 von 7"* – in der laufenden Woche ohne Urteil, weil „50 % am
  Dienstag" kein Befund ist, sondern eine Zwischenbilanz. Und der Bericht liefert seine eigene
  Fußnote mit: *„Einheiten = Tage mit mindestens einem Arbeitssatz. Logtage = Tage mit mindestens
  einem Eintrag im Essprotokoll. Gewicht aus den Check-ins der Woche."* – jede Zahl sagt, wie sie
  gezählt wurde, statt es den Leser raten zu lassen.
- **„Heute ändern" – zwei Tipps, ohne den Plan anzufassen (ab 3.0.0):** Auf derselben Karte ändert
  der Coach die **heutige** Einheit des Athleten (anderer Trainingstag oder Ruhetag). Die
  Plan-Vorlage bleibt unberührt, morgen läuft der Rhythmus weiter wie vorher. **Eine Begründung ist
  Pflicht**, wenn es nicht der Athlet selbst war – ohne sie lehnt der Server ab: *„Bitte schreib dazu,
  warum – der Athlet liest diesen Satz."* Der Athlet bekommt Nachricht und Push. Erlaubt sind **heute
  und morgen**; alles Weitere gehört in den Plan und nicht in eine zweite, heimliche Planung.
- **Freigabe der Zielanpassung (ab 3.0.0):** Passt sich das Kalorienziel eines Athleten an und hat er
  einen Coach, wartet die Änderung auf dessen **Freigabe** – mit der Rechnung daneben, in einem Tipp.
- In einen Athleten „hineingehen" und dessen Pläne/Daten sehen – eine feste Kontextleiste unter
  dem Kopf zeigt dabei jederzeit, wessen Daten man gerade betrachtet, samt „Verlassen".
- Trainingspläne bauen (im Athleten-Kontext als kompakte Plan-Zeilen), Plan-Vorlagen speichern
  und per Klick Athleten zuweisen, Pläne aus Excel importieren.
- Nachrichten als Unterhaltung je Athlet (beide Richtungen), Rundnachricht an alle,
  Rezepte an einzelne Athleten oder an alle senden.

**Für den Betreiber (Admin) – seit 2.6.0 ausdrücklich KEIN Coach**
Der Reiter **Verwaltung** ist eine Betriebsansicht mit einem Status-Streifen und fünf Bereichen:
- **Betrieb** – Mail, `APP_URL`, Schema, letzte Sicherung, Fehler der letzten 24 Stunden, offene
  Einwilligungen; dazu die Handgriffe: Selbsttest, **Sicherung herunterladen** (mit Passwort),
  Testmail. **Und seit 2.9.0 drei Schalter, die ohne Redeploy wirken:** Registrierung
  (offen · nur mit Code · geschlossen), KI-Analyse (Not-Aus für den ganzen Betrieb) und ein
  **Wartungshinweis** (gespeichert und unter `/api/notice` abrufbar; die Anzeige in der
  Athleten-Oberfläche fehlt noch – siehe SICHERHEIT.md Abschnitt 13).
- **Konten** – jedes Konto als **Pseudonym** (`A-7F2`), mit Rolle, Coach-Zuordnung,
  Aktivitätsklasse (aktiv · ruhig · inaktiv) und Anlagedatum. **Keine Namen, keine E-Mail-Liste.**
  Eine Adresse lässt sich nur **exakt** suchen, und die Suche selbst ist ein Protokoll-Ereignis.
- **Protokoll** – wer wann welche Verwaltungshandlung gemacht hat (365 Tage, keine Löschroute).
- **Fehler** – redigierter Ringpuffer (14 Tage).
- **Jobs** – Zustand der wiederkehrenden Läufe (`up` / `late` / `down`), letzter Lauf, letzter Fehler.
  Seit 3.0.0 stehen hier auch die **nächtliche Sicherung** (`backup.auto`) und die
  **Wiederherstellungsprobe** (`backup.verify`) – allerdings noch ohne Namen und Beschreibung
  („Dieser Lauf ist in der Verwaltung noch nicht beschrieben"), und eine Liste der Sicherungen
  gibt es in der Oberfläche noch nicht. Was dort fehlt und wie du bis dahin an die Zahlen kommst:
  **DEPLOY-PRUEFEN.md**.

Was der Betreiber **nicht** sieht: Gesundheitsdaten, Körpermaße, Fotos, Nachrichten, Freitexte,
Mindset-Inhalte – von keinem Menschen im System. Braucht er wirklich Einblick, gibt ihn der Athlet
selbst für 30 Minuten frei (nur lesend, protokolliert, mit Nachricht an den Athleten). Das ganze
Modell samt Messung steht in **SICHERHEIT.md**.

**Bedienung (seit 2.1.0)**
- Jeder Reiter öffnet mit der Handlung, die gerade dran ist; auf der Home steht dafür genau
  **eine** rote Schaltfläche.
- Antippbares ist auf **44 px** Trefferfläche ausgelegt (`tools/a11y.mjs` misst das nach; einzelne
  Ausreißer bleiben und stehen im Bericht des jeweiligen Standes). Icons sind einheitliche SVG statt
  Emoji.
- Eingaben werden an Ort und Stelle gespeichert – die Seite springt nicht und verliert die
  Scroll-Position nicht; bereits besuchte Reiter erscheinen sofort und aktualisieren sich
  im Hintergrund.
- Löschen fragt in einem Bottom-Sheet nach und lässt sich meist per „Rückgängig" zurücknehmen.

---

## Betrieb (Cloud)

Die App läuft als Node.js-Dienst (Express) mit SQLite-Datenbank. Sie ist für den
Betrieb auf **Render** eingerichtet; jeder Anbieter, der Node.js und eine
persistente Festplatte bietet, funktioniert ebenso.

| Frage | Dokument |
|---|---|
| Wie stelle ich die App zum ersten Mal online? (inkl. **Render-Checkliste**) | **DEPLOYMENT.md** |
| Wie liefere ich eine neue Version aus und prüfe sie? | **DEPLOY-PRUEFEN.md** |
| Wie spiele ich Updates ein, ohne Daten zu verlieren? | **UPDATE.md** |
| Was schützt die App, was sieht wer, was gehört in die Datenschutzerklärung? | **SICHERHEIT.md** |
| Wie richte ich E-Mail ein (Bestätigung, Passwort-Reset)? | **EMAIL-SETUP.md** |
| **Läuft es auf dem echten iPhone?** (Prüfliste zum Abhaken) | **IPHONE-TEST.md** |
| Wie lege ich die App auf den Home-Bildschirm? | **APP-INSTALLIEREN.md** |
| Apple Health per Kurzbefehl verbinden | **HEALTH-IMPORT.md** |
| Mindset-Modul (Priming, Rad des Lebens, Challenge, Erinnerungen) | **MINDSET.md** |
| Pläne aus Excel importieren (Coach) | **EXCEL-IMPORT.md** |

### Umgebungsvariablen
Die **vollständige** Liste mit Render-Checkliste steht in **DEPLOYMENT.md, Schritt 4**. Kurzfassung:

| Variable          | Pflicht | Zweck |
|-------------------|---------|-------|
| `JWT_SECRET`      | **ja**  | Lange Zufallszeichenkette für Login-Tokens. **Ohne sie startet der Server gar nicht** (seit 2.4.0, unabhängig von `NODE_ENV`). |
| `DB_PATH`         | **ja**  | Pfad der Datenbank auf der persistenten Platte, z.B. `/var/data/data.db`. Ohne das liegt die DB im Projektordner und ist nach jedem Deploy weg. |
| `NODE_ENV`        | **ja**  | Im Betrieb auf `production`. |
| `APP_URL`         | **ja**  | Öffentliche URL der App, z.B. `https://deine-app.onrender.com`. Steht in Mail-Links **und** im persönlichen Apple-Health-Link. |
| `EMAIL_HOST/PORT/USER/PASS/FROM` | für Mails | SMTP-Zugang (siehe EMAIL-SETUP.md). Fehlt das, gibt es **keinen Passwort-Reset**. |
| `REGISTER_CODE`   | optional | Gesetzt: die Registrierung verlangt diesen Einladungscode. Nicht gesetzt: offene Registrierung. |
| `SELFTEST_KEY`    | optional | Gesetzt: `/api/selftest?key=…` zeigt zusätzlich Zählwerte. Ohne Schlüssel bleibt der Selbsttest ohne Zahlen. |
| `ANTHROPIC_API_KEY` | optional | Aktiviert die KI-gestützte Analyse. `AI_MODEL` optional zum Modellwechsel. |
| `APP_TZ`          | optional | Zeitzone (IANA-Name), Standard `Europe/Berlin`. Bestimmt „heute" für Check-ins/Logs, die Uhrzeiten von Push-Erinnerungen und ab 3.0.0 auch die Stunde der nächtlichen Sicherung. Seit 3.0.0 gilt sie als **Rückfallwert**: Steht in `users.tz` eine Zone, rechnet der Server „heute" und den Wochenbeginn für diesen Menschen in **seiner** Zone (siehe unten). |
| `BACKUP_DIR`      | optional | Ordner für die nächtlichen Sicherungen. Leer lassen – dann legt der Server sie neben die Datenbank (`/var/data/backups`). |
| `MINIFY`          | optional | `0` liefert JS/CSS unverkleinert aus (Notbremse, DEPLOY-PRUEFEN.md). |
| `PORT`            | nein    | Setzt Render automatisch. |
| `ALLOW_DEV_SECRET`, `EMAIL_DEBUG` | **nur lokal** | Niemals auf Render setzen (siehe SICHERHEIT.md Abschnitt 1). |

Für **Web-Push** gibt es bewusst **keine** Variable: der Server erzeugt die VAPID-Schlüssel beim
ersten Bedarf selbst und legt sie in der Tabelle `settings` ab.

### Start- und Hilfsbefehle
- Start: `npm start`
- Coach/Admin anlegen (einmalig, per Umgebungsvariablen):
  `COACH_EMAIL=… COACH_PASSWORD=… COACH_NAME="…" COACH_ROLE=admin npm run create-coach`

---

## Datenbank & Daten

- SQLite. Bevorzugt `better-sqlite3`; ist es nicht verfügbar, nutzt die App
  automatisch das in Node 22+ eingebaute `node:sqlite`.
- Das Schema wird beim Start idempotent angelegt und erweitert
  (`CREATE TABLE IF NOT EXISTS`, zusätzliche Spalten werden nachgezogen).
  **Bestehende Daten bleiben bei Updates erhalten** – vorausgesetzt `DB_PATH`
  zeigt auf eine persistente Platte.
- Passwörter werden nur als bcrypt-Hash gespeichert, niemals im Klartext.
- **Die App sichert sich seit 3.0.0 jede Nacht selbst** – um 3 Uhr Ortszeit per `VACUUM INTO` in den
  Ordner `backups/` neben der Datenbank, mit SHA-256 je Datei und 14 Tagen Aufbewahrung. Dazu eine
  **Wiederherstellungsprobe**, die die jüngste Sicherung in eine Wegwerf-Datei spielt und dort prüft
  (`PRAGMA integrity_check`, Tabellen vollständig, Zeilen je Tabelle) – ohne die laufende Datenbank
  anzufassen. Sie hat Stand 3.0.0 **noch keinen Knopf in der Verwaltung** und wird über
  `POST /api/admin/backups/verify` ausgelöst. Einstellungen, Grenzen und die Falle beim allerersten
  Mal: **DEPLOY-PRUEFEN.md**. Dass diese Dateien **alle Personendaten** enthalten und was daraus
  folgt: **SICHERHEIT.md Abschnitt 9**.

### Welcher Tag ist „heute"? (ab 3.0.0)

Bis 2.9.0 kannte der Server genau **einen** Tag: den in `APP_TZ` (Standard `Europe/Berlin`). Für
Marco in Wien stimmt das. Für jemanden in einer anderen Zone nicht: Ein Check-in um 01:30 Ortszeit in
Dubai ist 23:30 Berliner Zeit – der Eintrag landete auf dem **Vortag**, die Konsistenz-Rechnung
verschob sich um einen Tag.

Seit 3.0.0 gibt es genau **eine** Stelle für diese Frage (`localDay` / `weekStart` in `src/logic.js`),
und sie liest `users.tz`. Nachgemessen: mit `users.tz = 'Pacific/Kiritimati'` (UTC+14) antwortet der
Server für diesen Nutzer mit dem **16.**, während es in UTC und in Berlin noch der **15.** ist.
Steht die Spalte leer oder trägt sie eine unbekannte Zone, gilt weiter `APP_TZ` – ein kaputter Wert
darf nie dazu führen, dass eine Route abstürzt.

**Zwei Dinge, die bewusst so sind:**
- **Nichts wird rückwirkend verschoben.** Wer die Zone wechselt, bekommt ab dem *nächsten* Eintrag
  den neuen Tag. Die Vergangenheit umzuschreiben wäre eine Fälschung.
- **Es gibt noch keinen Bildschirm, auf dem man seine Zone einstellt.** `users.tz` wird gelesen, aber
  von keiner Oberfläche geschrieben – solange sie leer ist, verhält sich die App exakt wie 2.9.0.
  Wer sie heute nutzen will, setzt sie in der Datenbank. Der Auftrag für die Oberfläche steht in
  `DEFER-B1.md`.

---

## Projektstruktur
```
src/
  server.js     – Express-Server & alle API-Routen
  db.js         – Datenbank-Anbindung (better-sqlite3 / node:sqlite)
  schema.js     – Tabellen & Migrationen
  auth.js       – Login, JWT, Passwort-Hashing
  logic.js      – Trainingsrhythmus, Progression, Berechnungen, Bereitschaft, Wochenrückblick
  mindset.js    – Mindset-Modul: Tabellen, API-Routen, Statistiken, Erinnerungs-Cron
  email.js      – E-Mail-Versand (SMTP, sonst Log)
  seed.js       – Demo-Daten zum lokalen Ausprobieren
  create-coach.js – Coach/Admin-Konto anlegen
  *-data.json   – Lebensmittel-Stammdaten & Demo-Trainingsplan (seed-data.json),
                  Rezepte (recipes-data.json), Supplements (supplements-data.json).
                  Die Lebensmittel trägt der Server beim ersten Start selbst ein;
                  der Demo-Plan darin ist nur für `npm run seed`.
public/
  index.html    – nur Markup (Login, Kopfzeile, Reiter-Leiste, Sheets, Pausen-Leiste)
  app.css       – Design-System: Farben & Abstände, Schaltflächen, Chips, Karten,
                  Zeilen, Bottom-Sheets, Tour, Pausen-Leiste
  css/          – ein Stylesheet je Bereich: home, training, diet, analysis, coach, account, search
  js/           – die Weboberfläche, in fester Ladereihenfolge (alle Funktionen global):
    core.js       Fehlerbehandlung, Icons, Format-Helfer, API, Login, Onboarding,
                  Router go() und Ansichts-Cache, Datenlader,
                  Offline-Warteschlange samt Nachsenden und Schnappschüssen für den Start ohne Netz
    home.js       Home („Jetzt"-Karte, Tagesziele), Check-in, Diagramm- und Ring-Helfer,
                  Supplement-Checkliste
    training.js   Trainingsplan, Satz-Logging, Pausen-Timer, Hantelrechner, Cardio,
                  Rhythmus-Editor, Kalender
    diet.js       Ernährung (Heute, Plan, Rezepte, Einkauf), Barcode, Makro-Rechner
    analysis.js   Analyse (Körper/Training/Woche), Wochenrückblick, Gesundheitsdaten-Import,
                  Erfolge, Monatsziel
    coach.js      Coach & Admin: Athletenliste, Dashboard, Kontextleiste, Nachrichten,
                  Supplements, Excel-Import, Vorlagen
    account.js    Profil-Hub, Nachrichten, Teilen-Links, Einführungs-Tour, Push, Apple Health
    search.js     Globale Suche: Aktionen, Übungen, Rezepte, Lebensmittel, Mindset-Themen
    shell.js      Toasts, Bottom-Sheets, Wischen, Hinweise, Hilfsfunktionen, Start-IIFE
  mindset.js, mindset.css – Oberfläche des Mindset-Reiters (Player, Rad, Challenge, Wissen)
  sw.js         – Service Worker: Push UND Hüllen-Cache (versionierte Dateien cache-first, /api/* und sw.js nie gecacht)
  manifest.json, Icons
```

> Die `?v=`-Kennung an jedem Skript-, Stylesheet- und Icon-Verweis setzt der Server beim Ausliefern
> aus der Version in `package.json` ein – nach einem Update lädt der Browser also garantiert die
> neuen Dateien. Ersetzt wird das Token `__APP_VERSION__` **an fünf Stellen**: in `index.html`,
> `sw.js` und `manifest.json` sowie in den beiden Bündeln `/app.js` und `/app.css` (dort auf Vorrat –
> heute steht der Platzhalter in den JS-/CSS-Quellen nur in einem Kommentar).
> **`manifest.json` gehört ausdrücklich dazu** (nachgemessen gegen 3.0.0: `/manifest.json` liefert
> `"src": "/icon-192.png?v=3.0.0"`). Wer diese Ersetzung beim Umbau herausnimmt, schickt dem
> Browser Icon-Adressen mit dem rohen Platzhalter – und nimmt der App damit genau die
> Installierbarkeit, um die es in 2.9.0 ging.

### Gebündelt beim Serverstart (seit 2.7.0) – weiterhin **kein Build-Schritt**

Die Einzeldateien unter `public/js/` und `public/css/` bleiben liegen und bleiben einzeln erreichbar.
Der Server hängt sie beim **Hochfahren** zusammen, verkleinert sie und packt sie vorab (Brotli/gzip):

| Adresse | Inhalt |
|---|---|
| `/app.js` | `core, home, training, diet, account, shell` in dieser Reihenfolge, plus der Nachlade-Lader |
| `/app.css` | `app.css · mindset.css · css/home · training · diet · analysis · coach · account · search` |
| `/mod/analysis.js`, `/mod/mindset.js`, `/mod/coach.js`, `/mod/search.js` | werden erst geholt, wenn die Ansicht gebraucht wird |

**Daraus folgt eine Regel für die Entwicklung:** Wer eine Datei unter `public/js/` oder `public/css/`
ändert, muss den **Server neu starten** – sonst liefert er weiter das alte Bündel aus. Auf Render
passiert das bei jedem Deploy von selbst. Details und die Notbremse `MINIFY=0`: **DEPLOY-PRUEFEN.md**.

---

## Mitentwickeln (optional, lokal)

Die App ist eine Cloud-App; lokal braucht man sie nur zum Weiterentwickeln.
Voraussetzung ist Node.js 18+ (empfohlen 22+). Dann im Projektordner die
Abhängigkeiten installieren, optional Demo-Daten erzeugen und starten – die
genauen Befehle stehen in `package.json` unter „scripts". Zum Anmelden legt man
sich über `create-coach` ein Konto an oder nutzt nach dem Seed die in `seed.js`
hinterlegten Demo-Konten. Aus Sicherheitsgründen stehen hier bewusst **keine**
Zugangsdaten in der README.
