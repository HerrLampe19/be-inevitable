# Changelog

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
