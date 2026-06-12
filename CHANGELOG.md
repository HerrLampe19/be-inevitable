# Changelog

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
