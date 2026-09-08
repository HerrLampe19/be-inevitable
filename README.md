# BE INEVITABLE

All-in-One Coaching-App für Training, Ernährung und Fortschritt – als Web-App
(läuft im Browser und lässt sich auf dem Handy zum Home-Bildschirm hinzufügen).

Coach-Athlet-Hybrid: Coaches erstellen und betreuen Trainings- und Ernährungspläne,
Athleten tracken ihren Alltag direkt in derselben App.

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
- **Ernährung:** „Laut Plan als Nächstes" mit „Gegessen ✓" und „Tauschen" (samt
  Wiederherstellen), Tagesprotokoll mit Kalorien & Makros, Ernährungsplan-Generator
  (trifft das Kalorienziel, mit vegetarisch/vegan-Option), 50+ Rezepte, Barcode-Scanner,
  Makro-Rechner, Einkaufswagen, Mahlzeiten aufschlüsselbar. Beim Hinzufügen stehen die
  zuletzt und häufig genutzten Lebensmittel oben, mit Portions-Chips in der richtigen
  Einheit (g / ml / Stück).
- **Tracking & Analyse:** täglicher Check-in (Gewicht, Schlaf, Schritte, Wasser) direkt
  auf der Home, Körpermaße, Fortschrittsfotos, Cardio, Supplements, Statuskarte mit
  Gewichtstrend und nächstem Schritt, Diagramme mit Ziel-Linien und 7-Tage-Mittel,
  Übungs-Verlauf je Übung.
- **Motivation:** XP, Level, Erfolge, Streaks, Wochenziel.
- **Mindset (ab 2.0.0):** eigener Reiter 🧠 für mentale Routinen –
  geführtes **Morgen-Priming** (5/10/15 Min., Vollbild-Player mit Atem-Taktgeber),
  eine **Tages-Checkliste** (Priming, Power-Atmung 1-4-2, State-Change 60 s,
  Abend-Reflexion, Frage des Tages, laufende Challenge), **Rad des Lebens**
  (7 Lebensbereiche, Balance-Index, Entwicklung, Maßnahmen), **Emotionaler Wochencheck**,
  **Vital-Challenge** (10/30 Tage, Regeln teils automatisch aus den Logs erkannt) und ein
  **Wissens-Bereich** mit persönlichen Arbeitsblättern (privat – nur der Athlet sieht sie).
  Mit Mindset-Verknüpfung in der Home-Karte, fünftem Tagesziel-Ring, XP, Erfolgen und
  eigenen Erinnerungen. Anleitung: **MINDSET.md**.
- **Kalender:** kommende Tage als Widget, voller Monatskalender; Ruhetag/Krank
  melden, der Trainingsrhythmus rechnet automatisch weiter.
- **Teilen:** Rezepte und Übungen per Link verschicken (WhatsApp & Co.);
  Empfänger übernimmt sie mit einem Tipp in sein Profil.
- **Push-Erinnerungen** und **Daten-Export** (eigene Daten als JSON).

**Für Coaches**
- Athleten-Übersicht als **eine** nach Dringlichkeit sortierte Liste (Alarm › Beobachten › OK)
  mit dem wichtigsten Grund je Zeile.
- In einen Athleten „hineingehen" und dessen Pläne/Daten sehen – eine feste Kontextleiste unter
  dem Kopf zeigt dabei jederzeit, wessen Daten man gerade betrachtet, samt „Verlassen".
- Trainingspläne bauen (im Athleten-Kontext als kompakte Plan-Zeilen), Plan-Vorlagen speichern
  und per Klick Athleten zuweisen, Pläne aus Excel importieren.
- Nachrichten als Unterhaltung je Athlet (beide Richtungen), Rundnachricht an alle,
  Rezepte an einzelne Athleten oder an alle senden.

**Für Admins**
- Nutzer- und Rollenverwaltung (mit „zuletzt aktiv" je Konto), System-Statistiken,
  Passwort zurücksetzen.

**Bedienung (seit 2.1.0)**
- Jeder Reiter öffnet mit der Handlung, die gerade dran ist; auf der Home steht dafür genau
  **eine** rote Schaltfläche.
- Alles Antippbare ist mindestens 44 px groß, Icons sind einheitliche SVG statt Emoji.
- Eingaben werden an Ort und Stelle gespeichert – die Seite springt nicht und verliert die
  Scroll-Position nicht; bereits besuchte Reiter erscheinen sofort und aktualisieren sich
  im Hintergrund.
- Löschen fragt in einem Bottom-Sheet nach und lässt sich meist per „Rückgängig" zurücknehmen.

---

## Betrieb (Cloud)

Die App läuft als Node.js-Dienst (Express) mit SQLite-Datenbank. Sie ist für den
Betrieb auf **Render** eingerichtet; jeder Anbieter, der Node.js und eine
persistente Festplatte bietet, funktioniert ebenso.

**Wie man neue Versionen ausliefert und prüft:** siehe **DEPLOY-PRUEFEN.md**.
**E-Mail einrichten (Verifizierung, Passwort-Reset):** siehe **EMAIL-SETUP.md**.
**Updates einspielen ohne Datenverlust:** siehe **UPDATE.md**.
**Mindset-Modul (Priming, Rad des Lebens, Challenge, Erinnerungen):** siehe **MINDSET.md**.

### Umgebungsvariablen
| Variable          | Pflicht | Zweck |
|-------------------|---------|-------|
| `JWT_SECRET`      | **ja**  | Lange Zufallszeichenkette für Login-Tokens. Im Produktivbetrieb (`NODE_ENV=production`) zwingend. |
| `DB_PATH`         | empfohlen | Pfad der Datenbank auf der persistenten Platte, z.B. `/var/data/data.db`. Ohne das liegt die DB im Projektordner und wird bei jedem Deploy zurückgesetzt. |
| `APP_URL`         | für Mails | Öffentliche URL der App, z.B. `https://deine-app.onrender.com`. Wird für die Links in E-Mails gebraucht. |
| `EMAIL_HOST/PORT/USER/PASS/FROM` | für Mails | SMTP-Zugang (siehe EMAIL-SETUP.md). Fehlt das, landen Mails nur im Server-Log. |
| `ANTHROPIC_API_KEY` | optional | Aktiviert die KI-gestützte Analyse. `AI_MODEL` optional zum Modellwechsel. |
| `APP_TZ`          | optional | Zeitzone der Nutzer (IANA-Name), Standard `Europe/Berlin`. Bestimmt „heute" für Check-ins/Logs und die Uhrzeiten von Push-Erinnerungen. |
| `NODE_ENV`        | empfohlen | Im Betrieb auf `production` setzen. |
| `PORT`            | nein    | Setzt Render automatisch. |

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

---

## Projektstruktur
```
src/
  server.js     – Express-Server & alle API-Routen
  db.js         – Datenbank-Anbindung (better-sqlite3 / node:sqlite)
  schema.js     – Tabellen & Migrationen
  auth.js       – Login, JWT, Passwort-Hashing
  logic.js      – Trainingsrhythmus, Progression, Berechnungen
  mindset.js    – Mindset-Modul: Tabellen, API-Routen, Statistiken, Erinnerungs-Cron
  email.js      – E-Mail-Versand (SMTP, sonst Log)
  seed.js       – Demo-Daten zum lokalen Ausprobieren
  create-coach.js – Coach/Admin-Konto anlegen
  *-data.json   – Übungen, Rezepte, Supplements
public/
  index.html    – nur Markup (Login, Kopfzeile, Reiter-Leiste, Sheets, Pausen-Leiste)
  app.css       – Design-System: Farben & Abstände, Schaltflächen, Chips, Karten,
                  Zeilen, Bottom-Sheets, Tour, Pausen-Leiste
  css/          – ein Stylesheet je Bereich: home, training, diet, analysis, coach, account
  js/           – die Weboberfläche, in fester Ladereihenfolge (alle Funktionen global):
    core.js       Fehlerbehandlung, Icons, Format-Helfer, API, Login, Onboarding,
                  Router go() und Ansichts-Cache, Datenlader
    home.js       Home („Jetzt"-Karte, Tagesziele), Check-in, Diagramm- und Ring-Helfer,
                  Supplement-Checkliste
    training.js   Trainingsplan, Satz-Logging, Pausen-Timer, Hantelrechner, Cardio,
                  Rhythmus-Editor, Kalender
    diet.js       Ernährung (Heute, Plan, Rezepte, Einkauf), Barcode, Makro-Rechner
    analysis.js   Analyse (Körper/Training), Gesundheitsdaten-Import, Erfolge, Monatsziel
    coach.js      Coach & Admin: Athletenliste, Dashboard, Kontextleiste, Nachrichten,
                  Supplements, Excel-Import, Vorlagen
    account.js    Profil-Hub, Nachrichten, Teilen-Links, Einführungs-Tour, Push
    shell.js      Toasts, Bottom-Sheets, Wischen, Hinweise, Hilfsfunktionen, Start-IIFE
  mindset.js, mindset.css – Oberfläche des Mindset-Reiters (Player, Rad, Challenge, Wissen)
  sw.js         – Service Worker, ausschließlich für Push (kein Caching)
  manifest.json, Icons
```

> Die `?v=`-Kennung an jedem Datei-Verweis in `index.html` (und in `sw.js`) setzt der Server
> beim Ausliefern aus der Version in `package.json` ein – nach einem Update lädt der Browser
> also garantiert die neuen Dateien.

---

## Mitentwickeln (optional, lokal)

Die App ist eine Cloud-App; lokal braucht man sie nur zum Weiterentwickeln.
Voraussetzung ist Node.js 18+ (empfohlen 22+). Dann im Projektordner die
Abhängigkeiten installieren, optional Demo-Daten erzeugen und starten – die
genauen Befehle stehen in `package.json` unter „scripts". Zum Anmelden legt man
sich über `create-coach` ein Konto an oder nutzt nach dem Seed die in `seed.js`
hinterlegten Demo-Konten. Aus Sicherheitsgründen stehen hier bewusst **keine**
Zugangsdaten in der README.
