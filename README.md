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
- **Training:** Trainingsplan nach Tagen, Sätze/Wiederholungen/Gewicht loggen,
  automatische Progressions-Empfehlung (mehr/halten/weniger), Bestleistungen,
  Hantelrechner, Pausen-Timer, Übungs-Verlaufskurve, Workout-Abschluss-Screen.
- **Ernährung:** Tagesprotokoll mit Kalorien & Makros, Ernährungsplan-Generator
  (trifft das Kalorienziel, mit vegetarisch/vegan-Option), 50+ Rezepte,
  Barcode-Scanner, Makro-Rechner, Mahlzeiten aufschlüsselbar.
- **Tracking & Analyse:** täglicher Check-in (Gewicht, Schlaf, Schritte, Wasser),
  Körpermaße, Fortschrittsfotos, Cardio, Supplements, Diagramme mit Ziel-Linien.
- **Motivation:** XP, Level, Erfolge, Streaks, Wochenziel.
- **Kalender:** kommende Tage als Widget, voller Monatskalender; Ruhetag/Krank
  melden, der Trainingsrhythmus rechnet automatisch weiter.
- **Teilen:** Rezepte und Übungen per Link verschicken (WhatsApp & Co.);
  Empfänger übernimmt sie mit einem Tipp in sein Profil.
- **Push-Erinnerungen** und **Daten-Export** (eigene Daten als JSON).

**Für Coaches**
- Athleten-Übersicht, in einen Athleten „hineingehen" und dessen Pläne/Daten sehen.
- Trainingspläne bauen, Plan-Vorlagen speichern und per Klick Athleten zuweisen.
- Rezepte an einzelne Athleten oder an alle senden, Nachrichten schreiben.

**Für Admins**
- Nutzer- und Rollenverwaltung.

---

## Betrieb (Cloud)

Die App läuft als Node.js-Dienst (Express) mit SQLite-Datenbank. Sie ist für den
Betrieb auf **Render** eingerichtet; jeder Anbieter, der Node.js und eine
persistente Festplatte bietet, funktioniert ebenso.

**Wie man neue Versionen ausliefert und prüft:** siehe **DEPLOY-PRUEFEN.md**.
**E-Mail einrichten (Verifizierung, Passwort-Reset):** siehe **EMAIL-SETUP.md**.
**Updates einspielen ohne Datenverlust:** siehe **UPDATE.md**.

### Umgebungsvariablen
| Variable          | Pflicht | Zweck |
|-------------------|---------|-------|
| `JWT_SECRET`      | **ja**  | Lange Zufallszeichenkette für Login-Tokens. Im Produktivbetrieb (`NODE_ENV=production`) zwingend. |
| `DB_PATH`         | empfohlen | Pfad der Datenbank auf der persistenten Platte, z.B. `/var/data/data.db`. Ohne das liegt die DB im Projektordner und wird bei jedem Deploy zurückgesetzt. |
| `APP_URL`         | für Mails | Öffentliche URL der App, z.B. `https://deine-app.onrender.com`. Wird für die Links in E-Mails gebraucht. |
| `EMAIL_HOST/PORT/USER/PASS/FROM` | für Mails | SMTP-Zugang (siehe EMAIL-SETUP.md). Fehlt das, landen Mails nur im Server-Log. |
| `ANTHROPIC_API_KEY` | optional | Aktiviert die KI-gestützte Analyse. `AI_MODEL` optional zum Modellwechsel. |
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
  email.js      – E-Mail-Versand (SMTP, sonst Log)
  seed.js       – Demo-Daten zum lokalen Ausprobieren
  create-coach.js – Coach/Admin-Konto anlegen
  *-data.json   – Übungen, Rezepte, Supplements
public/
  index.html, app.js  – die komplette Weboberfläche (PWA)
  sw.js         – Service Worker, ausschließlich für Push (kein Caching)
  manifest.json, Icons
```

---

## Mitentwickeln (optional, lokal)

Die App ist eine Cloud-App; lokal braucht man sie nur zum Weiterentwickeln.
Voraussetzung ist Node.js 18+ (empfohlen 22+). Dann im Projektordner die
Abhängigkeiten installieren, optional Demo-Daten erzeugen und starten – die
genauen Befehle stehen in `package.json` unter „scripts". Zum Anmelden legt man
sich über `create-coach` ein Konto an oder nutzt nach dem Seed die in `seed.js`
hinterlegten Demo-Konten. Aus Sicherheitsgründen stehen hier bewusst **keine**
Zugangsdaten in der README.
