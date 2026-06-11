# Changelog

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
