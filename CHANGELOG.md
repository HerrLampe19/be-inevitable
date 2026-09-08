# Changelog

## 2.1.0
Die größte Überarbeitung der Oberfläche seit dem Start: Jeder Reiter öffnet jetzt mit der
Handlung, die gerade dran ist – sichtbar ohne Scrollen und in ein bis zwei Tipps erreichbar.
Alles Übrige rückt eine Ebene tiefer. Funktionen wurden nicht entfernt, sie sind nur besser
sortiert.

- **Home: die „Jetzt"-Karte.** Ganz oben steht deine Karte für heute – Begrüßung, Datum,
  Tagesname („Upper 1" oder „Ruhetag") und **genau eine rote Schaltfläche** mit dem nächsten
  Schritt. Was das ist, entscheidet die App aus deinem Tag: an Trainingstagen „Upper 1 starten",
  morgens das Priming, abends die Reflexion, sonst das nächste Essen. Darunter höchstens vier
  kleine Verknüpfungen (Check-in, Essen loggen, Supplements, Mindset) und ein 7-Tage-Streifen
  zum Kalender. Das große Logo, die doppelte Begrüßung und die separate „Dein Plan"-Karte sind weg.
- **Schneller eintragen – nichts springt mehr.** Check-in, Essen, Supplements und Sätze werden
  an Ort und Stelle aktualisiert: Die Seite lädt nicht neu, die Scroll-Position bleibt, es blitzt
  kein Ladekreis mehr auf. Ein Reiter, den du schon gesehen hast, ist beim Zurückkommen sofort
  wieder da und aktualisiert sich unsichtbar im Hintergrund.
- **Training: Satz für Satz mit einem Daumen.** Jede Satz-Zeile hat einen eigenen **Haken**:
  Gewicht und Wiederholungen werden zusammen gespeichert, die Pause startet automatisch, und der
  Fokus springt in die nächste Zeile. Graue Vorschläge zählen erst als geloggt, wenn du sie
  bestätigst.
  - **Pausen-Leiste über der Navigation:** Countdown (antippen für 60/90/120/180 Sekunden), −15/+15,
    „Fertig" und ein roter Fortschrittsbalken. Hantelrechner und „Abschließen" sitzen in derselben
    Leiste – die alte Werkzeug-Zeile mitten im Plan ist weg.
  - Erledigte Übungen klappen zusammen („3/3 · 50 kg × 12"), die nächste öffnet sich von selbst.
    Kommst du über die Home-Schaltfläche ins Training, ist die erste offene Übung schon aufgeklappt.
  - Alles Seltene (Tag verwalten, Tag anlegen, Kalender, Rhythmus) steckt hinter einem „···" neben
    den Tages-Chips.
- **Ernährung: „Laut Plan als Nächstes".** Ganz oben steht die nächste noch nicht gegessene
  Mahlzeit deines Plans mit „Gegessen ✓" und „Tauschen". Getauschte Mahlzeiten lassen sich
  einzeln wiederherstellen, und was du geloggt hast, ist im Plan als erledigt markiert
  (kein doppeltes Eintragen mehr).
- **Essen hinzufügen ist schneller:** Die Suche ist sofort aktiv, über der Liste stehen deine
  zuletzt und häufig genutzten Lebensmittel (letzte 7 Tage), die Portions-Chips übernehmen die
  richtige Einheit – Milch zeigt „100 ml", Eier „2 Stück" –, und der Mahlzeiten-Slot ist nach
  Uhrzeit vorbelegt. Nach dem Hinzufügen bleibt das Fenster offen und zählt mit.
  Kalorien- und Makroziele kommen aus einer einzigen Quelle (deinem Plan); über dem Ziel zeigt
  der Balken das ehrlich an („+124 g") statt bei 100 % stehen zu bleiben.
- **Mindset: ruhiger Player, eine Liste.** Der Reiter Heute beginnt mit einer Karte, die nur den
  nächsten Schritt zeigt („Dein Morgen" → „Priming erledigt ✓" → „Abend-Reflexion" →
  „Tag abgerundet ✓"). Darunter **eine** Checkliste für den Tag statt Kacheln plus zweiter
  Übersicht; Rad des Lebens und Wochencheck stehen als eigene Gruppe „Woche & Monat" darunter.
  Der Vollbild-Player fragt beim Abbrechen in seiner eigenen Leiste nach („Abbrechen" / „Weiter")
  statt in einem Systemfenster.
- **Analyse: Statuskarte und lesbare Diagramme.** „Körper" beginnt mit einer Statuskarte
  (aktuelles Gewicht, Veränderung pro Woche, Einordnung zu deinem Ziel, ein nächster Schritt);
  die vier Kacheln zeigen den Abstand zum Ziel und springen zum passenden Diagramm.
  Die Diagramme haben runde Achsenwerte, mindestens 11 px große Beschriftungen, eine
  7-Tage-Mittellinie bei Schlaf, Wasser und Schritten und markieren die laufende Woche als
  unfertig. Übungen lassen sich antippen: Verlauf, Bestleistung und die letzten Einheiten.
- **Profil als Anlaufstelle.** Alles rund um dein Konto in einer Liste mit Unterzeilen – Ziele,
  Erinnerungen, Push, Gesundheitsdaten, Teilen, Export, Passwort. Was du änderst, wird direkt
  gespeichert; Fehler stehen am Feld statt als Meldung darüber.
- **Coach-Ansicht.** Betrittst du einen Athleten, sagt eine feste Leiste unter dem Kopf, wen du
  gerade siehst (Bild, Name, Status, „Verlassen") – der alte „‹ Zurück"-Reiter entfällt.
  Die Athletenliste ist **eine** nach Dringlichkeit sortierte Liste (Alarm › Beobachten › OK)
  mit dem wichtigsten Grund je Zeile; den zweiten, abweichenden Aufmerksamkeits-Kasten gibt es
  nicht mehr. Im Athleten-Kontext zeigt das Training den Plan als kompakte Zeilen zum Bearbeiten
  statt des Satz-Rasters. Nachrichten laufen als Unterhaltung je Athlet (beide Richtungen),
  Coaches haben eigene Reiter für Nachrichten und Vorlagen.
- **Design-Auffrischung.** Ein durchgängiges Icon-Set aus SVG statt Emoji (Emoji bleiben, wo sie
  hingehören: Feiern, Erfolge, Mindset-Illustrationen, Ernährungs-Tags, Onboarding). Eine Familie
  von Schaltflächen, Chips, Karten, Zeilen und Bottom-Sheets in allen Reitern; alles Antippbare
  ist **mindestens 44 px** groß; Meldungen erscheinen einzeln nacheinander statt übereinander;
  größere Abstände und höhere Kontraste (Hilfstexte sind jetzt gut lesbar). Löschen fragt in
  einem Bottom-Sheet nach – kein Browser-Dialog mehr – und lässt sich meistens per
  „Rückgängig" zurücknehmen.

**Behobene Fehler**
- **Satz-Vorschläge zählten als geloggt.** Ein grauer Vorschlag im Feld wurde beim Antippen als
  echter Satz gewertet – Fortschritt, „Geschafft"-Ring und die Progression rechneten mit Zahlen,
  die du nie bestätigt hast. Ein Satz zählt jetzt erst nach dem Haken bzw. nach einer Eingabe.
- **Fehlgeschlagenes Speichern sah aus wie Erfolg.** Bricht das Speichern eines Satzes ab, wird die
  Zeile jetzt als nicht gespeichert markiert und aus dem Fortschritt herausgerechnet.
- **Übungs-Verlauf war abgeschnitten.** Bei mehr als 500 geloggten Sätzen fehlten ältere Einheiten
  („1 Einheit", obwohl es 22 waren). Verlauf und Kurve holen die Übung jetzt vollständig.
- **„Cardio diese Woche" meinte zweimal etwas anderes.** Training und Analyse zeigten unter
  derselben Überschrift verschiedene Zahlen (rollende 7 Tage gegen Kalenderwoche). Beide rechnen
  jetzt ab Montag.
- **Rezept-Portionen wurden als Gramm gelesen.** Eine geloggte Rezept-Portion ließ sich über
  „Menge ändern" auf das Hundertfache aufblähen – behoben, eine Portion ist keine Grammzahl mehr.
- **Plan-Summen wanderten beim Tauschen.** Die Kalorien der Plan-Mahlzeiten wurden beim
  Wiederherstellen gerundet; nach mehreren Tausch-Runden stimmte die Tagessumme nicht mehr.
- **Milliliter im Ernährungs-Sheet.** Milch, Sojadrink & Co. boten „100 g" an, obwohl sie in ml
  gemessen werden. Die Einheit kommt jetzt aus dem Lebensmittel selbst (auch nach `npm run seed`).
- **„Zuletzt / Häufig" brauchte sieben Abrufe.** Die Vorschlagsliste im Essen-Sheet holt ihre
  Daten jetzt in einer einzigen Anfrage.
- **Einführungs-Tour konnte die App blockieren.** Wechselte man während der Tour den Reiter, blieb
  eine unsichtbare Ebene liegen und schluckte alle Tipps. Die Tour endet jetzt beim Reiterwechsel;
  zusätzlich kann eine nie sichtbare Ebene keine Eingaben mehr abfangen. Die Tour-Karte blitzt
  auch nicht mehr unpositioniert über dem Kopfbereich auf.
- **Postfach markierte alles als gelesen.** Das bloße Öffnen der Nachrichten-Übersicht setzte alle
  Nachrichten auf gelesen; jetzt geschieht das erst beim Öffnen einer Unterhaltung, und die Glocke
  zeigt die tatsächlich ungelesenen Nachrichten.
- **„Rückgängig" bei erledigten Notizen lief ins Leere** – die passende Server-Route fehlte, jetzt
  ist sie da.
- **Verwaltung: „zuletzt aktiv"** steht wieder in der Nutzerliste und im Nutzer-Sheet
  („heute" / „gestern" / „vor 3 Tagen" / „nie aktiv").
- **Kein Absturz mehr bei abgelaufener Sitzung** im Coach-Postfach und beim Reiterwechsel.
- **Die Mindset-Startleiste** („Challenge starten") verschwand hinter der Pausen-Leiste, wenn ein
  Trainings-Timer lief – sie rückt jetzt darauf.
- **Server startet auch mit fehlerhafter Migration.** Ein einzelner fehlgeschlagener Schritt bricht
  den Start nicht mehr ab, sondern erscheint als eine Zeile im Log.
- Kleineres: der Klick-Bereich der Segment-Umschalter reicht über den ganzen Knopf; doppelte
  CSS-Regeln (Statuszeile, Tour) entfernt; die Vorlagen-Hinweise nennen wieder den richtigen
  Menüpunkt; `/sw.js` und alle Dateiverweise tragen automatisch die Version aus `package.json`
  (nach einem Update lädt der Browser garantiert die neuen Dateien).

**Technisch**
- Das Frontend liegt jetzt in `public/js/core.js, home.js, training.js, diet.js, analysis.js,
  coach.js, account.js, shell.js` statt in einer großen `app.js`; das CSS in `public/app.css`
  (Design-System) plus `public/css/<bereich>.css`. Mindset bleibt in `public/mindset.js` und
  `public/mindset.css`.
- Neue bzw. erweiterte Server-Routen: `GET /api/home/:userId` (eine Anfrage statt neun),
  `GET /api/progression/:userId?day=`, `GET /api/foodlog/:userId/recent`,
  `GET /api/messages/thread/:athleteId` + `POST /api/messages/:athleteId/read-thread`,
  `POST /api/exercise-notes/:id/flag`, `PUT /api/training-days/:id/reorder`,
  `GET /api/logs/:userId?exercise_id=`, `GET /api/ai/status`, Plan-Schnappschüsse in
  `plan_versions` mit `POST /api/meals/restore-plan`. Neue Spalten `food_log.meal_id`,
  `meals.recipe_id`, `foods.unit`, `progress_photos.thumb` – alle Migrationen laufen automatisch
  und lassen bestehende Daten unangetastet.
- **Datensicherheit: Datenbank wird regelmäßig zusammengeführt.** SQLite schrieb neue Einträge in eine
  Begleitdatei (`data.db-wal`), die nie zurückgeschrieben wurde – eine Sicherungskopie von `data.db`
  allein wäre praktisch leer gewesen. Die App führt jetzt alle 5 Minuten, stündlich und beim
  Herunterfahren zusammen; ein Backup der einen Datei genügt.
- **Eiweiß- und Kalorienziele folgen deinem aktuellen Gewicht** (jüngster Check-in statt des fixen
  Startgewichts) und entsprechen wieder deinem Ernährungsplan – vorher konnte das Ziel dem Plan
  widersprechen, sodass der eigene Plan als „über dem Ziel" galt.
- **Trainings-Erinnerung lässt sich wirklich abschalten:** „Aus" im Profil wurde vom Zeitgeber
  ignoriert (er erinnerte weiter um 6 Uhr).
- **Abend-Reflexion und Wochencheck** werden pro Tag nur noch einmal gespeichert; ein zweiter
  Durchlauf aktualisiert den Eintrag, statt den Verlauf doppelt zu zählen.
- **Frisch angelegte Konten:** Kalender und Kalorienziel widersprachen sich am ersten Tag
  („Ruhetag" im Kalender, Trainingstag beim Kalorienziel) – behoben.

## 2.0.0
- **Mindset-Modul (neu, eigener Reiter 🧠):** Mentale Routinen bekommen denselben festen Platz wie Training und Ernährung. Inspiriert von den Prinzipien aus „Unleash the Power Within" – komplett in eigenen Worten, ohne Workbook-Texte. Ausführliche Anleitung: **MINDSET.md**.
  - **Morgen-Priming:** Geführter Vollbild-Player mit sechs Schritten (Ankommen · Power-Atmung · Dankbarkeit · Energie & Heilung · 3 to Thrive · Abschluss), wählbar 5 / 10 / 15 Minuten, Ring-Timer, animierter Atem-Taktgeber, Vibration beim Schrittwechsel, optionaler Signalton 🔔, Bildschirm bleibt an, Pause/Weiter. Die Session wird gespeichert, sobald der Player durch ist – drei Tagesergebnisse und Energie lassen sich danach optional ergänzen.
  - **Kurz-Tools:** Power-Atmung 1-4-2 (10 Atemzüge, „Sanft" 4 / 16 / 8 s oder „Standard" 5 / 20 / 10 s), State-Change 60 s (Körper · Fokus · Sprache), Abend-Reflexion (vier Fragen zum Nachdenken, nach der letzten Frage sofort gespeichert, Energie/Stimmung/Notiz optional), Frage des Tages und ein Emotionaler Wochencheck.
  - **Rad des Lebens:** Sieben Lebensbereiche (Körper, Gefühle, Beziehungen, Zeit, Karriere, Finanzen, Beitrag) per Schieberegler bewerten, Zielwerte setzen, Fokus-Bereich und drei Maßnahmen festhalten. Radar-Grafik, Ø, Balance-Index, schwächster Bereich, Entwicklung je Bereich mit Delta und Mini-Verlauf, Verlauf aller Standortbestimmungen. Eine Bewertung pro Tag, jederzeit bearbeitbar („Bearbeiten" ändert die Bewertung, statt eine zweite anzulegen). Erinnerung alle vier Wochen.
  - **Vital-Challenge (10 oder 30 Tage):** Regeln aus „Geschenken" (annehmen) und „Giften" (weglassen) selbst zusammenstellen. Krafttraining, Ausdauer, Wasser, Atmung und Dankbarkeit werden automatisch aus deinen Logs erkannt, der Rest wird abgehakt. Tages-Punkte, Einhaltungsquote, Feier zum Abschluss.
  - **Wissen:** Zwölf kompakte Karten (Priming, sechs Grundbedürfnisse, Triade des Zustands, Erfolgsformel, Glaubenssätze, Incantation, Rapport, Meisterprinzipien, Rad des Lebens, 3-to-5 to Thrive, Leidenschaft & Vision, Emotionales Zuhause) mit eigenen Arbeitsblättern, die geräteübergreifend gespeichert werden und privat bleiben – nur der Athlet selbst sieht sie. Deine Incantation trägst du selbst ein – die App liefert keinen vorgefertigten Text.
  - **Home:** Mindset-Karte unter der Begrüßung (Priming starten / erledigt · Abend-Reflexion · Challenge-Tag · Rad fällig) und ein fünfter „Heute geschafft"-Ring 🧠.
  - **Motivation:** XP für Priming, Reflexion, Atmung, Rad und Challenge sowie sieben neue Erfolge (Erstes Priming, 7 / 30 Tage Priming, Rad des Lebens, 3 Standortbestimmungen, Vital-Challenge geschafft, 50 Atemsessions).
  - **Erinnerungen:** Im Profil unter „Mindset-Erinnerungen": Priming-Push zur Wunschstunde (5–10 Uhr, aus = Standard) und Abend-Reflexion um 20 Uhr. Push-Klicks springen direkt in den Mindset-Reiter (Deep-Links `#mindset`, `#mindset/wheel`, `#mindset/challenge`).
  - **Coach:** Sieht im Athleten-Kontext Werte, Streaks, Rad-Bewertungen und den Challenge-Stand seiner Athleten (nur lesend). Arbeitsblätter, Notizen und persönliche Texte bleiben privat – die sieht nur der Athlet.
  - Neue Tabellen `mindset_sessions`, `wheel_assessments`, `challenges`, `challenge_days`, `mindset_entries` sowie Spalten `mindset_push_hour`, `evening_push`, `priming_minutes`, `needs_top` in `users` – automatische Migration beim Start. Der Daten-Export enthält alle Mindset-Daten.
- **Bug: Satz speichern konnte hängen bleiben.** Beim Loggen eines Satzes fehlte intern eine Variable (`logTimers`); je nach Browser brach das Speichern mit einem Fehler ab. Behoben.
- **Bug: Zeitzone.** „Heute" wurde bisher in UTC berechnet – Einträge zwischen Mitternacht und 1 bzw. 2 Uhr landeten am Vortag, und Push-Uhrzeiten stimmten nicht mit der deutschen Zeit überein. Server und App rechnen jetzt in deutscher Zeit (konfigurierbar über `APP_TZ`, Standard `Europe/Berlin`); die Uhrzeiten im Profil sind ausdrücklich „deutsche Zeit".
- **Bug: Excel-Import** übernahm den gewählten Tagestyp (Training/Ruhetag) nicht – behoben.
- **Bug: Streak-Warnung** um 19 Uhr ignorierte durch Joker geschützte Tage und warnte zu früh – behoben.
- **Streak-Joker zurück beim Nachtragen:** Wurde ein Tag automatisch durch einen Joker geschützt und trägst du ihn später doch nach, bekommst du den Joker zurück (Hinweis beim Speichern).
- **Bug: geteilte und globale Rezepte** ließen sich teilweise weder loggen noch in den Einkaufswagen legen – die Sichtbarkeit ist jetzt überall einheitlich.
- **Bug: Coach-Profil.** Änderte ein Coach nur seinen Namen, wurden andere Profilfelder geleert – behoben. Persönliche Ziele (Schlaf/Schritte/Wasser) lassen sich jetzt durch Leeren des Felds wieder auf den Standard setzen.
- **Bug: Onboarding aus der App** heraus („Plan neu einrichten") lag über der laufenden App; jetzt wird die App ausgeblendet, und es gibt einen Abbrechen-Button.
- **Sicherheit & Robustheit (umfangreiche Überarbeitung):**
  - Alle Nutzertexte (Übungs-, Tages-, Rezept-, Lebensmittel-, Athletennamen, Nachrichten, Notizen) werden beim Anzeigen konsequent maskiert; der Server begrenzt Längen und entfernt HTML-Zeichen (`<`, `>`) aus Freitext.
  - Rolle und Coach-Zuordnung werden bei jeder Anfrage frisch aus der Datenbank gelesen (Rollenwechsel/Sperrungen wirken sofort). Verwaltungs-Routen (Wochenrückblick, Joker-Verarbeitung) nur noch für Admins.
  - Jede Eingabe wird geprüft: Datumsangaben, Auswahlwerte (Tagestyp, Ziel, Phase, Erfahrung, Intensität …), Zahlenbereiche, Bild-Uploads (nur PNG/JPEG/WebP), Video-Links (nur http/https), Passwort-Regeln überall. Sätze lassen sich nur für Übungen aus eigenen Plänen loggen (Satz-Nummer 1–20).
  - Monatsziele: Monatsangabe wird geprüft, Zielwerte müssen ≥ 1 sein, abgeschlossene Monate werden nicht mehr überschrieben, gutschreiben kann nur der Athlet selbst.
  - Keine versteckten Dateien mehr aus dem `public/`-Ordner abrufbar; unbekannte `/api/…`-Adressen liefern einen klaren JSON-404.
  - Teilen-Links laufen nach 30 Tagen ab; beim Übernehmen werden Werte geprüft.
  - Abgelaufene Anmeldung: Die App lädt automatisch neu und zeigt den Login (statt stiller Fehler).
  - Schnell-Check-in, Tag setzen, Essen loggen, Einkaufswagen, Cardio löschen und Nachrichten zeigen jetzt echte Fehlermeldungen statt eines falschen „✓".
  - Login ist ein echtes Formular (Enter-Taste, Passwort-Manager, Autovervollständigung); der Service Worker wird immer registriert, damit Push-Klicks die App zuverlässig öffnen.
  - Rezept teilen sendet dem Empfänger einen Push; Nachrichten Athlet → Coach lösen einen Push beim Coach aus.
  - Coaches können keine Athleten mehr „abwerben": Ist ein Athlet schon einem anderen Coach zugeordnet, lehnt „Athlet hinzufügen" ab – umbuchen kann nur ein Admin. Coach-Zuordnung nur noch für Athleten-Konten; wer die Coach-Rolle verliert, betreut automatisch niemanden mehr.
  - KI-Analyse: 60 Sekunden Abkühlzeit pro Coach, 30 Sekunden Zeitlimit, Athletendaten werden der KI strikt als Daten (JSON) übergeben – nicht mehr als Teil der Anweisung.
  - Wochenrückblick nur an bestätigte E-Mail-Adressen; Push-Abos nur mit HTTPS-Endpunkt; nur das eigene Postfach lässt sich als gelesen markieren; Coach-erstellte Konten bekommen die Bestätigungs-Mail.
  - Ungültiges JSON in einer Anfrage liefert jetzt einen sauberen 400-Fehler statt „Serverfehler"; Mahlzeitenplan-Erstellung und Plan-Vorlagen laufen als Transaktion (bei einem Fehler bleibt der alte Plan erhalten).
  - Daten-Export (DSGVO) deutlich vollständiger: Pläne, Supplements, Monatsziele, Joker, Einkaufswagen, Nachrichten, Foto-Metadaten und alle Mindset-Daten.
  - Coach im Athleten-Kontext: „Trainingsrhythmus anpassen" und Einkaufswagen nur im eigenen Konto; der Rezept-Filter nutzt die Abneigungen des betrachteten Athleten.
  - Versionsnummer aus einer einzigen Quelle (`package.json`) – Cache-Buster und Versionsanzeige laufen nicht mehr auseinander. Externe Schriftarten-Links entfernt (kein Abruf bei Google mehr).
  - Kleineres: Tab-Touren pro Gerät, Glocken-Badge nach dem Lesen korrekt, Sheets starten immer oben, Admin-Passwortfelder maskiert, Erfolge-Abfrage gebündelt, Speicher der Anmelde-Limits wird stündlich aufgeräumt, toter Code entfernt (alte Einkaufsliste, Recovery-Route, Health-Import-Modul, „Mehr"-Reiter).

## 1.16.0
- **Ernährung neu strukturiert:** Klare Reiter **Heute · Plan · Rezepte · Einkauf**. Jedes Feature hat jetzt einen festen Platz.
- **Einkaufswagen (neu, eigener Reiter):** Persistente Einkaufsliste – Artikel aus dem Plan übernehmen („📋 Aus Plan übernehmen"), Zutaten aus Rezepten hineinlegen, selbst hinzufügen; alles abhakbar, einzeln löschbar, „Erledigte weg" / „Wagen leeren". Geräteübergreifend gespeichert (neue Tabelle `cart_items`, automatische Migration).
- **Rezepte:** Neuer Button „🛒 Zutaten in den Einkaufswagen".
- **Plan-Reiter aufgeräumt:** „Plan neu erstellen" und „Ausschließen" stecken jetzt in einem dezenten **⚙️ Plan-Optionen**-Menü statt als große Buttons.

## 1.15.1
- **Bug: untere Tab-Leiste verdeckt Inhalt** – mehr Abstand am Seitenende, sodass der letzte Inhalt immer über die Leiste gescrollt werden kann.
- **„Heute geschafft": Ernährung** wird jetzt grün, **sobald das Kalorienziel erreicht ist** (auch wenn drüber) – unabhängig davon, ob Protein/Carbs/Fett schon passen.
- **„Heute geschafft": Check-in** wird grün, **sobald für heute überhaupt etwas eingetragen** wurde (vorher blieb er praktisch immer offen).
- **Mehrere Tage nachtragen neu:** Werte einmal eintragen, dann mehrere Tage auswählen und **gemeinsam** übernehmen (statt jeden Tag einzeln) – die Eingaben bleiben beim Auswählen erhalten.
- Rezept-„Teilen"-Button heißt jetzt schlicht **„Per Link teilen"**.

## 1.15.0
- **Essen hinzufügen neu strukturiert:** Statt eines großen Barcode-Buttons gibt es im „+ Essen hinzufügen"-Sheet jetzt vier klare Reiter: **Liste** (suchen), **📷 Scan** (Barcode direkt mit Kamera), **Manuell** (Bezeichnung + Kalorien/Makros eintragen) und **Neu** (eigenes Lebensmittel anlegen). Der Scanner steckt direkt im „Scan"-Reiter.
- **Barcode-Fokus verbessert:** Höhere Kamera-Auflösung + Anforderung von Dauer-Autofokus (hilft bei kleinen Codes; teils hardwareabhängig).
- **Untere Tab-Leiste ruhiger:** Auf dem iPhone „wanderte" die Navigationsleiste beim Scrollen manchmal ein Stück mit – durch eine eigene GPU-Ebene behoben.
- **Einkaufsliste überarbeitet:** Auswahl für **3 Tage / 5 Tage / 1 Woche** (Mengen werden passend skaliert) und **abhakbare** Einträge (durchgestrichen, Fortschrittsanzeige).
- **Ernährungs-Plan-Buttons dezenter** (Einkaufsliste / Ausschließen / Plan neu erstellen als Pills).
- **Rezepte:** Großer roter „+ Eigenes Rezept hinzufügen"-Button am Ende der Liste.
- **Hinweis-Boxen:** Das Ausblenden ist jetzt überall ein dezentes ✕ (auch beim globalen Hinweis-Mechanismus, der vorher die klobige „− ✕"-Leiste einfügte).

## 1.14.0
- **Barcode-Scanner auf dem iPhone:** Der Kamera-Scan funktioniert jetzt auch in iOS-Safari (das kein natives `BarcodeDetector` hat). Die Kamera öffnet sich, erkennt den Strichcode automatisch (über die nachgeladene ZXing-Bibliothek) und trägt die Nummer ein → Produktsuche startet. Auf Android läuft weiterhin der schnelle native Weg; manuelle Eingabe bleibt als Rückfall. (Hinweis: braucht HTTPS + Kamera-Erlaubnis; ZXing wird beim ersten Scan aus dem Netz geladen.)
- **„Heute geschafft" jetzt zielbasiert:** Die Ringe werden erst grün, wenn das Ziel wirklich erreicht ist – Ernährung erst im Kalorien-Korridor (nicht schon beim ersten Eintrag), Check-in erst mit allen Werten + erreichten Schlaf-/Schritte-/Wasser-Zielen, Supplements erst komplett. An Trainingstagen kommt ein vierter Ring „Training" dazu (grün, wenn alle geplanten Sätze geloggt sind).
- **Mehrere Tage nachtragen (Bulk):** Im „Werte eintragen"-Bereich gibt es jetzt „📅 Mehrere Tage" – die letzten 10 Tage auf einen Blick (Gewicht/Schlaf/Schritte/Wasser) und alle gemeinsam speichern.
- **Einführungs-Tour nur einmal pro Konto:** Die Tour wird serverseitig als gesehen markiert und erscheint nicht mehr bei jedem neuen Gerät/Browser. Über „Einführung erneut ansehen" im Profil jederzeit wiederholbar. Neue Spalte `users.tour_done` (automatische Migration).
- **Profilbild groß:** Ein hochgeladenes Bild erscheint jetzt auch groß im Profil und als Avatar in der Coach-Athletenliste und im Athleten-Dashboard (mit Status-Punkt).
- **Zwischen Tabs wischen:** Auf dem Handy links/rechts wischen, um zwischen Home/Training/Ernährung/Analyse zu wechseln.
- **Info-Hinweise:** Das Ausblenden-Symbol an Hinweis-Boxen ist jetzt ein dezentes ✕ statt der klobigen Doppel-Schaltfläche.

## 1.13.1
- **Ernährung „Heute" aufgeräumt:** Die Schnell-Aktionen sind jetzt „+ Essen hinzufügen" und „📷 Barcode" nebeneinander – die redundanten Kacheln „Aus Plan"/„Rezepte" sind weg (dafür gibt es die Reiter oben).
- **Kalorien-Ring zielabhängig eingefärbt:** Wird das Ziel überschritten, zeigt der Ring das je nach Ziel an – beim Abnehmen rot („zu viel"), beim Aufbau grün („Überschuss"), sonst neutral.
- **Makro-Rechner mit Suche:** Lebensmittel lassen sich jetzt per Suchfeld finden (statt langer Dropdown-Liste).
- „als gegessen"-Buttons in Plan & Rezept klarer beschriftet („Gegessen – ins Protokoll").

## 1.13.0
- **Streak-Joker (Streak-Schutz):** Vergisst du einen Tag, springt automatisch ein Joker ein und rettet deine Serie – sie reißt nicht. Du startest mit 1 Joker und bekommst pro aktiver Woche +1 dazu (max. 2). Der aktuelle Stand steht als 🛡️-Badge neben der Streak auf der Startseite (antippen für Erklärung). Wird ein Joker eingesetzt, gibt es eine Push-Mitteilung. Alternativ kannst du vergessene Tage weiterhin selbst nachtragen.
- Neue Tabelle `streak_freeze_log` + Spalten `streak_freezes`/`freeze_last_grant` in `users` (automatische Migration). Die Streak zählt geschützte Tage wie Check-ins.

## 1.12.0
- **Tage nachtragen:** Vergangene Tage lassen sich jetzt für Gewicht/Schlaf/Schritte/Wasser nachpflegen. Im „Werte eintragen"-Bereich auf der Startseite die letzten 7 Tage als Chips wählbar (mit ✓-Markierung für bereits ausgefüllte Tage) – schließt auch Lücken in der Streak.
- **Tägliche Ziele „Heute geschafft":** Drei kleine Ringe auf der Startseite (Check-in · Ernährung · Supplements). Sobald alle drei voll sind, gibt es eine kleine Feier – der tägliche Motivations-Anker.
- **Streak aufgewertet:** Der Tages-Streak ist prominenter, zeigt „heute schon dran ✓" bzw. „in Gefahr", wenn noch nichts eingetragen ist. Abends (~19 Uhr) gibt es bei aktiver Streak ohne heutigen Eintrag eine „Streak in Gefahr"-Push. Nach einer Pause begrüßt ein „Willkommen zurück" und holt sanft in den Rhythmus zurück.
- **Feier-Momente:** Konfetti + Pop-Animation bei Level-up, Streak-Meilensteinen (7/30/100 …) und neuen Erfolgen.
- Bewusst KEIN XP-Abzug bei Inaktivität: XP werden aus echter Aktivität berechnet und nur die Streak reißt – das motiviert, ohne zu bestrafen.

## 1.11.0
- **Dark Mode als fester Standard:** Die App ist jetzt durchgehend dunkel (unabhängig von der System-Einstellung) – passt zur Marke und ist überall einheitlich.
- **Kalender-Widget-Bug behoben:** Home-Widget („Dein Plan") und der volle Kalender konnten für denselben Tag Unterschiedliches anzeigen (z.B. Widget „Ruhetag", Kalender „Upper 1"), wenn ein Ruhetag auf einen Trainingstag fiel. Beide nutzen jetzt EXAKT dieselbe Engine (`rhythmRange`, am frühesten Eintrag verankert) – sie stimmen immer überein und reagieren gleichzeitig auf Tag-Änderungen. Mit Tests abgesichert.
- **Supplements aufgeräumt:** Auf der Startseite gibt es nur noch die Tages-Checkliste (der doppelte „Supplements"-Button ist weg; die Liste ist immer erreichbar, auch ohne zugewiesene Supplements). Aus dem Ernährungs-Plan sind Supplements raus – sie gehören nicht zu den Nährwerten, sondern in ihren eigenen Bereich.
- **Ernährung:** Die Buttons „als gegessen" und „Mahlzeit tauschen" sitzen in den Plan-Mahlzeiten nicht mehr am Kartenrand, sondern mit Abstand und mittig.
- **Coach-Athleten-Dashboard überarbeitet:** Statt einer Wand aus 10 Buttons jetzt Identitäts-Pills + Schnell-Status (Gewicht, letztes Training), zwei Primäraktionen (Plan/Nachricht) und zwei aufgeräumte iOS-Listen („Verwalten", „Ansehen").
- **Als App aufs iPhone (PWA):** Einmaliger, schließbarer Hinweis auf iOS, wie man die App über „Teilen → Zum Home-Bildschirm" installiert (erscheint nur in Safari und nur, solange nicht schon installiert). Neue Anleitung APP-INSTALLIEREN.md. Web und installierte App teilen Konto und Daten.

## 1.10.0
- **Apple-Designsprache:** Durchgängig auf die System-Schrift (SF Pro / system-ui) umgestellt, die großen Titel sind jetzt iOS-„Large Titles" (statt der schmalen Versal-Schrift). Feinere iOS-Farben, Abstände, Radien, weichere Schatten und ein neuer Segment-Umschalter. Gilt automatisch für alle Bildschirme.
- **Coach-Übersicht aufgeräumt & handlungsorientiert:** „Braucht Aufmerksamkeit" steht jetzt ganz oben (mit positivem „Alles im grünen Bereich"-Zustand, wenn nichts ansteht), darunter kompakte Kennzahlen und direkt die Athletenliste. Jede Athleten-Zeile hat jetzt Direkt-Aktionen (✉️ Nachricht, ✏️ Plan), Einblicke (Trend/Ziele/Aktivität) und Rundnachricht sind nach unten gewandert.
- **Ernährung „Heute" neu gedacht:** Großer Kalorien-Ring (zeigt die verbleibenden kcal) mit farbigen Makro-Balken (Protein/Carbs/Fett vs. Ziel), eine klare Primäraktion „+ Essen hinzufügen" plus drei schnelle Wege (Barcode/Plan/Rezepte). Das Tagesprotokoll ist jetzt nach Mahlzeit gruppiert (Frühstück/Mittag/Abend …) mit kcal-Summe je Mahlzeit – übersichtlicher als eine lange Liste.
- **Training mit Fortschritts-Ring:** Der „Heutiges Training"-Kopf zeigt jetzt einen Ring mit Prozent erledigter Sätze (grün bei 100 %) – dieselbe Ring-Sprache wie bei der Ernährung – samt „Training abschließen".
- **Analyse mit Glance-Karten (Apple-Health-Stil):** Oben im Körper-Tab vier Karten (Gewicht, Ø Schlaf, Ø Schritte, Ø Wasser) mit grünem Punkt, sobald das persönliche Ziel erreicht ist – die ausführlichen Verlaufs-Charts folgen darunter.

## 1.9.0
- **Coach-Schnellaktionen:** In der „Braucht Aufmerksamkeit"-Liste gibt es jetzt direkte Aktionen je Athlet – ✉️ Schnellnachricht (ohne erst das Dashboard zu öffnen) und ✏️ Sprung direkt in die Plan-Bearbeitung.
- **Supplements nach Tageszeit gruppiert:** Die Tages-Checkliste ordnet zugewiesene Supplements jetzt nach Kategorie/Tageszeit (Morgens, Pre-Workout, Nach dem Training, Abends …) statt als eine lange Liste.
- **Individuelle Gesundheitsziele:** Schlaf-, Schritte- und Wasser-Ziel sind pro Nutzer im Profil einstellbar und erscheinen als Ziel-Linien in der Analyse (leer = Standard 8 h / 10.000 / 3 L). Der Coach sieht die individuellen Ziele im Athleten-Verlauf.
- **Push-Zeitpunkt pro Nutzer:** Die Uhrzeit der täglichen Trainings-Erinnerung lässt sich im Profil wählen (Standard 6 Uhr Serverzeit). Die Erinnerung wird pro Nutzer genau einmal am Tag und nur an Trainingstagen verschickt.
- Neue Spalten in `users`: sleep_goal, steps_goal, water_goal, push_hour (automatische Migration).

## 1.8.0
- **Excel-Import für Coaches (neu):** Bestehende Trainings- und Ernährungspläne lassen sich direkt aus einer Excel-Datei (.xlsx) importieren. Der Coach öffnet einen Athleten → „📥 Aus Excel importieren", wählt die Datei, ordnet die Spalten zu (die App rät die Zuordnung automatisch) und sieht eine Vorschau, bevor er übernimmt.
- Flexible Spalten-Zuordnung: funktioniert mit unterschiedlich aufgebauten Tabellen, nicht nur einer festen Vorlage. Leere Tag-/Mahlzeit-Zellen werden automatisch dem vorherigen Block zugeordnet (wie in echten Coach-Tabellen üblich).
- Deckt Training (Übung, Sätze, Wdh., Gewicht, Notiz) und Ernährung (Mahlzeit, Lebensmittel, Menge, kcal, Makros) ab.
- Anleitung dazu in EXCEL-IMPORT.md.
- Neue Abhängigkeit: xlsx (SheetJS) – wird beim Deploy automatisch installiert.

## 1.7.1
- Einführungs-Tour: Während die Tour läuft, ist das Scrollen (und Tippen) im Hintergrund jetzt gesperrt. Vorher konnte man die Seite hinter dem Spotlight verschieben, wodurch der rote Rahmen nicht mehr zum erklärten Element passte. Scrollen innerhalb der Hinweis-Karte (bei langem Text) bleibt möglich.

## 1.7.0
- **Supplements komplett neu als Tages-Checkliste:** Supplements sind nicht mehr zwischen den Mahlzeiten (wo Nährwerte zählten, was bei Supps unpassend war), sondern haben einen eigenen Bereich. Man hakt täglich ab, was man genommen hat, kann die Menge pro Eintrag anpassen und spontan eigene Supplements ergänzen, die man zusätzlich genommen hat.
- **Supplement-Widget auf der Startseite:** Zeigt die heutige Abhakliste mit Fortschritt (z.B. „2/4 genommen") – direkt von der Home abhakbar, ohne in einen Unterbereich zu wechseln.
- Der Coach weist Supplements weiterhin zu (Pflicht/optional, eigene Dosis); diese erscheinen oben in der Checkliste, eigene Ergänzungen darunter.
- Supplement-Tausch im Ernährungsplan: „Mahlzeit tauschen" zeigt jetzt nur noch Rezepte der passenden Kategorie (Frühstück zeigt Frühstücks-Rezepte usw.).
- Neue Tabelle: supplement_intake (automatische Migration).

## 1.6.1
- Startseite: BE-INEVITABLE-Logo nimmt deutlich weniger Platz weg. Das quadratische Logobild hatte oben/unten breite schwarze Ränder (über 80% der Höhe) – jetzt wird eine schmale Banner-Version genutzt und der überflüssige Kasten drumherum entfällt. Mehr Inhalt sofort sichtbar.

## 1.6.0
- **Monatsziele (neu):** Jeder Athlet bekommt automatisch ein Monatsziel mit drei Teilzielen (Trainings, Check-ins, Volumen), das mit Erfahrung und Vormonat skaliert. Erreicht = Bonus-XP + Auszeichnung. Das Home-Widget öffnet jetzt einen eigenen Monatsziel-Screen (mit Ringen) statt in die Analyse zu springen.
- **Coach kann Monatsziele anpassen:** Über das Athleten-Dashboard ein persönliches Monatsziel setzen – wird es erreicht, gibt es doppelte XP (500) und eine besondere „Coach-Challenge"-Auszeichnung. Neue Achievements: Erstes/3/6 Monatsziele, Coach-Challenge.
- **Ernährungs-Plan: Mahlzeiten einzeln tauschbar:** Jede Mahlzeit im Plan hat „🔄 Mahlzeit tauschen" – zeigt Rezepte mit ähnlichen Kalorien (Ernährungsweise berücksichtigt) und ersetzt die Mahlzeit per Tipp.
- **Touren für alle Tabs:** Training, Ernährung und Analyse haben jetzt – wie die Startseite – eine kurze Einführungstour beim ersten Besuch. „Einführung erneut ansehen" im Profil setzt alle zurück.
- **Tour-Spotlight verbessert:** Kein unscharfer Hintergrund mehr; das gemeinte Element bleibt scharf und bekommt einen roten, pulsierenden Leuchtrahmen.
- **Training: Werkzeuge scrollen mit:** Pausen-Timer und Hantelrechner bleiben als Leiste oben kleben – kein Hochscrollen mehr nötig.
- **Ernährung: Trainings-/Ruhetag deutlich markiert** (farbiges Badge oben).
- **Rezeptfilter zeigt aktive Filter:** Ziel und Mahlzeit als sichtbare Pills; Ernährungsweise/Quelle hinter dem Filter-Symbol mit Anzahl-Punkt.
- **Rezept-Detail:** „Als gegessen" und „Mahlzeit tauschen" prominent oben nebeneinander statt unten am Rand.
- Neue Tabelle: monthly_goals (automatische Migration).

## Wartung (Dokumentation)
- Alle Doku-Dateien überarbeitet und entrümpelt: README von 40 KB auf ~5 KB gekürzt,
  veraltetes lokales Setup und sämtliche Klartext-Zugangsdaten entfernt.
- DEPLOYMENT.md (Erst-Einrichtung) und UPDATE.md (Updates ohne Datenverlust) neu gefasst,
  DEPLOY-PRUEFEN.md versionsneutral. Stand entspricht jetzt der Cloud-Realität (Render).

## 1.5.1
- Ernährung „Heute": Makro-Übersicht und Kalorien-Fortschritt zu einer Karte zusammengefasst (vorher wurde die kcal-Zahl doppelt angezeigt) – ruhiger und klarer.
- Training „Kraft": Werkzeug-Buttons (Pause, Hantelrechner) dezenter gestaltet, Tageswahl nach oben – der Fokus liegt jetzt klar auf den Übungen.

## 1.5.0
- **Startseite aufgeräumt (ruhigeres, Apple-näheres Design):** Inhalte nach Wichtigkeit geordnet – zuerst „Heute" (Training/Ruhe + 7-Tage-Plan), dann „Heute eintragen" (Schnell-Check-in), dann Ernährung, dann Fortschritt.
- **Verdichtung statt Verstecken:** Der große „Deine Woche"-Block (Level/XP/Streak/Wochenziel/Volumen) ist jetzt in kompakte, antippbare Streifen aufgeteilt – Level/Erfolge öffnen die Erfolgs-Liste, Wochenziel und Gewicht öffnen die Analyse. Nichts ging verloren, alles ist einen Tipp entfernt.
- **Geführte Einführungs-Tour:** Beim ersten Öffnen erklären 4 kurze Spotlight-Hinweise die wichtigsten Stellen (Tagesübersicht, Check-in, Navigation, Profil). Jederzeit erneut startbar über Profil → „Einführung erneut ansehen".
- **Konsistente Diagramme:** Auch das Gewichts-Chart hat jetzt beschriftete Achsen wie die übrigen.

## 1.4.0
- App-Icons: Neues BE INEVITABLE Logo als Favicon (Browser-Tab) und als App-Icon (PWA / „Zum Home-Bildschirm").
- 5 Icon-Größen erzeugt: favicon.ico (16/32/48), icon-192.png, icon-512.png, apple-touch-icon.png (180).
- Manifest aktualisiert: getrennte Einträge für „any" (kein Beschneiden) und „maskable" (Android-Adaptive-Icon), damit der Schriftzug auf keinem Gerät abgeschnitten wird.
- Alle Icon-URLs mit ?v=1.4.0 versehen – sonst halten Browser/PWA am alten Icon fest.

## 1.3.2
- Bugfix Rezept-Filter: Ausgewählte Filter (Ziel, Mahlzeit, Ernährungsweise, Quelle, Kategorie) färben sich jetzt SOFORT beim Antippen rot. Vorher aktualisierte der Klick nur die Liste hinter dem Sheet; das offene Filter-Menü zeigte den alten Zustand bis zum Wiederöffnen. Das Sheet bleibt jetzt außerdem offen, sodass man mehrere Filter nacheinander setzen kann.

## 1.3.1
- Mail-Diagnose: /api/version zeigt, ob SMTP konfiguriert ist und APP_URL gesetzt wurde
- POST /api/admin/testmail (Coach/Admin): verschickt eine Probe-Mail an die eigene Adresse mit klarer Diagnose-Antwort
- EMAIL-SETUP.md: komplette Schritt-für-Schritt-Anleitung für Brevo auf Render (Port-587-Hinweis, Absender-Verifizierung, APP_URL)

## 1.3.0
- **🔔 Push-Erinnerungen:** Im Profil aktivierbar. Tägliche Trainings-Erinnerung („Heute: Oberkörper 1 💪"), Push bei Coach-Nachrichten/Broadcasts/neuem Plan. Service Worker macht AUSSCHLIESSLICH Push (kein Caching!). VAPID-Schlüssel werden beim ersten Start automatisch erzeugt – kein Setup nötig. iPhone: erst „Zum Home-Bildschirm".
- **📷 Barcode-Scanner:** Im Tagesprotokoll. Kamera-Scan (Chrome/Android) oder Nummer eintippen (alle Geräte) → Nährwerte aus Open Food Facts → Menge angeben → eintragen.
- **📋 Plan-Vorlagen (Coach):** Aktuellen Athleten-Plan als Vorlage speichern und jedem Athleten per Klick zuweisen (alter Plan bleibt deaktiviert erhalten, Athlet wird benachrichtigt).
- **📈 Übungs-Verlauf:** Im ⚙️-Menü jeder Übung – Top-Gewicht pro Einheit als Kurve, mit Bestleistung und Fortschritt seit Beginn.
- **🏁 Workout-Abschluss-Screen:** „Training abschließen" zeigt Sätze, Übungen, bewegtes Gesamtgewicht, neue Rekorde und den schwersten Satz.
- **📧 Wochenrückblick per E-Mail:** Sonntags automatisch (Trainings, Sätze, Check-ins, Gewichtsänderung). Respektiert den E-Mail-Schalter im Profil; inaktive Wochen lösen keine Mail aus.
- **⬇️ Daten-Export (DSGVO):** Im Profil – alle eigenen Daten als JSON-Datei.
- Neue Abhängigkeit: web-push. Neue Tabellen: settings, push_subscriptions, plan_templates (automatische Migration).

## 1.2.0
- **Teilen per Link (WhatsApp & Co.):** Rezepte und Übungen lassen sich per Link teilen.
  Teilen-Button öffnet den nativen Teilen-Dialog des Handys (oder kopiert den Link).
  Der Empfänger öffnet den Link, meldet sich an (oder registriert sich) und wird gefragt,
  ob er den Inhalt übernehmen möchte – Rezepte landen in seinen Rezepten, Übungen in einem
  Trainingstag seiner Wahl. Links sind Schnappschüsse: Sie funktionieren auch, wenn das
  Original später gelöscht wird, und geben nie mehr preis als den geteilten Inhalt.

## 1.1.1
- Kalender-Widget: Krank-Tage werden als 🤒 „Krank" angezeigt (vorher als Rest)
- Kalender-Widget-Härtung gegen veraltete Anzeige:
  - Auto-Refresh, sobald die App aus dem Hintergrund zurückkommt (Handy entsperrt / Tab gewechselt)
  - Satz-Loggen invalidiert den Plan-Stand (Server bestätigt heute als Trainingstag -> Folgetage ändern sich)
  - Widget-Datumslabels am Server-Datum verankert (kein Versatz um Mitternacht/Zeitzonen)

## 1.1.0
- Sichtbare Versionsnummer (Login + Profil) + /api/version-Endpoint + Cache-Buster für app.js
- index.html wird nicht mehr gecacht (löst „Update kommt nicht an")
- Navigation: Profil-Icon vereint alles (Profil, Passwort, Hinweise, Abmelden); „Mehr"-Tab entfernt
- Profilbild-Upload mit Zuschnitt (erscheint im Header)
- Kalender-Widget synchronisiert sich sofort nach Änderungen; Hero = preview[0]
- Analyse: beschriftete X/Y-Achsen + Ziel-Linien (Schlaf 8h / Schritte 10.000 / Wasser 3L)
- Ernährung: Mahlzeiten antippbar (Zutaten-Details), lesbare Makros, Makro-Rechner „direkt eintragen"
- Rezepte teilen (Athlet↔Athlet, Coach→Athleten) + Fotos + Kategorien
- Ernährungs-Generator ±2,5% Zielgenauigkeit, vegetarisch/vegan, realistische Portionen
- Supplements-Formatierung, mehr Anfänger-Info-Boxen
- Diverse Bugfixes (Eingabe-Clamping, Akkordeon, verirrte ✕/−)

## 1.0.0
- Erste Version
