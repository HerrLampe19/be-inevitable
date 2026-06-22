# Changelog

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
