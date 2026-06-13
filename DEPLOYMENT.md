# BE INEVITABLE online stellen (Erst-Einrichtung)

Diese Anleitung richtet die App **einmalig** auf Render ein. Für spätere Updates
siehe UPDATE.md, zum Prüfen einer Auslieferung siehe DEPLOY-PRUEFEN.md.

## Überblick
1. Code zu GitHub
2. Web Service auf Render erstellen
3. Persistente Festplatte für die Datenbank
4. Umgebungsvariablen setzen
5. Ersten Admin/Coach anlegen

---

## Schritt 1 – Code zu GitHub
1. GitHub-Konto anlegen, neues Repository erstellen (privat ist okay).
2. Die Projektdateien hochladen. Wichtig: Der **Inhalt** des Projekts (die Ordner
   `src`, `public` und Dateien wie `package.json`) muss im **Wurzelverzeichnis**
   des Repos liegen – nicht in einem zusätzlichen Unterordner.
   - Ohne Git: „Add file → Upload files", Dateien hineinziehen, „Commit".
   - Mit Git: `git init && git add -A && git commit -m "Initial" && git push`.

## Schritt 2 – Web Service auf Render
1. Auf render.com mit GitHub anmelden, **New → Web Service**, das Repo auswählen.
2. Einstellungen:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Branch:** der Branch mit deinem Code (meist `main`)
   - Falls der Code doch in einem Unterordner liegt: **Root Directory** entsprechend setzen.
3. Erstellen und ersten Build abwarten.

## Schritt 3 – Persistente Festplatte (Datenbank)
Ohne persistente Platte wäre die Datenbank nach jedem Deploy weg.
1. Service → **Disks → Add Disk**.
2. **Mount Path:** `/var/data`, Größe z.B. 1 GB.
3. Passend dazu die Variable `DB_PATH=/var/data/data.db` setzen (nächster Schritt).

## Schritt 4 – Umgebungsvariablen
Service → **Environment**. Mindestens:

| Variable     | Wert |
|--------------|------|
| `JWT_SECRET` | lange Zufallszeichenkette (mind. 30 Zeichen, z.B. aus einem Passwort-Generator) |
| `DB_PATH`    | `/var/data/data.db` |
| `NODE_ENV`   | `production` |
| `APP_URL`    | die öffentliche URL des Dienstes, z.B. `https://deine-app.onrender.com` |

Für E-Mail zusätzlich `EMAIL_HOST/PORT/USER/PASS/FROM` – Details in EMAIL-SETUP.md.
Optional `ANTHROPIC_API_KEY` für die KI-Analyse. Nach dem Speichern startet Render neu.

## Schritt 5 – Ersten Admin/Coach anlegen
Service → **Shell**, dann (Werte anpassen):
```
COACH_EMAIL=admin@be-inevitable.at COACH_PASSWORD=DEIN_SICHERES_PASSWORT COACH_NAME="Admin" COACH_ROLE=admin npm run create-coach
```
Danach mit diesen Zugangsdaten in der App anmelden. Weitere Coaches genauso mit
`COACH_ROLE=coach`. (Aus Sicherheitsgründen keine Passwörter in dieser Datei.)

---

## Eigene Domain (optional)
Render → Settings → **Custom Domains**: Domain hinzufügen und den angezeigten
DNS-Eintrag beim Domain-Anbieter setzen. Danach `APP_URL` auf die neue Domain ändern.

## Backup
Sobald echte Nutzer drauf sind, vor jedem Update ein Backup ziehen:
```
cp /var/data/data.db /var/data/backup-$(date +%F).db
```
(Render → Shell). Die Datei lässt sich auch herunterladen, um sie extern zu sichern.

## Wenn etwas nicht läuft
- Render → **Logs** zeigen Fehler im Klartext.
- `/api/version` prüfen: zeigt es die erwartete Version und `"mail":"konfiguriert"`?
- Häufige Stolpersteine: Code in verschachteltem Unterordner, falscher Branch,
  fehlendes `DB_PATH` (→ Daten weg nach Deploy), `JWT_SECRET` nicht gesetzt.
