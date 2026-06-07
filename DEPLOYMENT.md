# BE INEVITABLE – online stellen (Schritt für Schritt)

Diese Anleitung bringt deine App ins Internet, sodass dein Coach und deine Athleten
von überall darauf zugreifen können – mit HTTPS (Schloss-Symbol) und dauerhafter
Datenspeicherung.

Wir nutzen **Render.com**, weil es Node.js direkt aus einem GitHub-Repo baut,
HTTPS automatisch mitbringt und einfach zu bedienen ist.

> **Wichtig vorab – die ehrliche Kostenfrage:**
> Der **kostenlose** Render-Tarif speichert KEINE Daten dauerhaft – bei jedem Neustart
> wäre deine Datenbank weg. Für echten Betrieb brauchst du eine **persistente Festplatte**
> (Persistent Disk), die ab ca. **7 $/Monat** kostet. Plane das ein. Ohne sie verlierst
> du regelmäßig alle Nutzerdaten.

---

## Überblick: Was wir tun

1. Code zu GitHub hochladen
2. Auf Render einen "Web Service" daraus erstellen
3. Eine persistente Festplatte anhängen (für die Datenbank)
4. Sicherheits-Umgebungsvariablen setzen
5. Ersten Coach-Account anlegen
6. Fertig – App ist online

Dauer: ca. 30–45 Minuten beim ersten Mal.

---

## Schritt 1: Code zu GitHub

### 1a. GitHub-Konto & Repo
1. Falls noch nicht vorhanden: kostenloses Konto auf **https://github.com** anlegen.
2. Oben rechts auf **+ → New repository**.
3. Name z.B. `be-inevitable`. Auf **Private** stellen (deine Daten gehen niemanden an).
4. **Create repository** klicken.

### 1b. Dateien hochladen (einfachste Variante, ohne Git-Kenntnisse)
1. Im leeren Repo auf **uploading an existing file** klicken.
2. Den **kompletten Inhalt** des entpackten Projektordners hineinziehen
   (also die Ordner `src`, `public` und die Dateien `package.json`, `README.md`,
   `START.bat`, `DEPLOYMENT.md`, `.gitignore` …).
   **Nicht** den Ordner `node_modules` hochladen (den gibt es im ZIP gar nicht – gut so).
3. Unten **Commit changes** klicken.

> Tipp: Wer Git kennt, kann stattdessen `git init && git add . && git commit && git push` nutzen.

---

## Schritt 2: Web Service auf Render erstellen

1. Konto auf **https://render.com** anlegen (mit GitHub anmelden ist am einfachsten).
2. Im Dashboard: **New + → Web Service**.
3. **Build and deploy from a Git repository** wählen → **Next**.
4. Dein `be-inevitable`-Repo verbinden und auswählen.
5. Einstellungen:
   - **Name:** `be-inevitable` (wird Teil der URL)
   - **Region:** Frankfurt (EU) – am nächsten an deinen Nutzern
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** für echten Betrieb **Starter** (~7 $/Monat). Free geht zum
     Ausprobieren, verliert aber Daten (s.o.).
6. Noch **nicht** auf "Create" klicken – erst die Umgebungsvariablen (Schritt 4) und
   Festplatte (Schritt 3) vorbereiten. Render lässt dich beides direkt hier eintragen.

---

## Schritt 3: Persistente Festplatte (für die Datenbank)

Damit Daten Neustarts überleben:

1. Im selben Erstellungs-Formular (oder später unter **Settings → Disks**):
   **Add Disk**.
2. Einstellungen:
   - **Name:** `data`
   - **Mount Path:** `/var/data`
   - **Size:** 1 GB reicht für den Anfang locker.
3. Speichern.

Das sagt dem Server: "Lege die Datenbank in `/var/data` ab" – diesen Ordner behält
Render dauerhaft. Verknüpft wird das über die Variable `DB_PATH` (nächster Schritt).

---

## Schritt 4: Umgebungsvariablen (Sicherheit)

Unter **Environment → Add Environment Variable** diese drei eintragen:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(eine lange zufällige Zeichenkette, s.u.)* |
| `DB_PATH` | `/var/data/data.db` |

**JWT_SECRET erzeugen:** Das ist der geheime Schlüssel, mit dem Logins signiert werden.
Nimm etwas Langes, Zufälliges (mind. 30 Zeichen), z.B. von einem Passwort-Generator.
Beispiel-Format (nimm NICHT genau dieses, erzeuge ein eigenes):
`k7Qm2xP9vR4tL8wZ3nB6yH1jF5sD0aG`

> Wenn `NODE_ENV=production` gesetzt ist und `JWT_SECRET` fehlt oder unsicher ist,
> **startet die App absichtlich nicht** – ein eingebauter Schutz, damit du nicht
> versehentlich unsicher online gehst.

Jetzt auf **Create Web Service** klicken. Render baut die App (dauert 2–4 Minuten).
Beim ersten Start lädt die App automatisch die 187 Lebensmittel in die Datenbank.

---

## Schritt 5: Ersten Admin-Account anlegen

Aus Sicherheitsgründen kann sich über die Webseite **niemand** selbst als Coach oder
Admin registrieren (nur als Athlet). Deinen ersten Admin-Account legst du einmalig per
Render-Konsole an – als Admin kannst du danach in der App alle weiteren Nutzer (Coaches,
Admins, Athleten) bequem anlegen und verwalten:

1. Im Service auf den Reiter **Shell** (rechts oben) klicken.
2. Folgenden Befehl eingeben (E-Mail/Passwort/Name anpassen) und Enter:
   ```
   COACH_EMAIL=pierre@be-inevitable.at COACH_PASSWORD=DEINSICHERESPW COACH_NAME="Pierre" COACH_ROLE=admin npm run create-coach
   ```
3. Es erscheint `✓ Admin-Account angelegt`. Fertig.

> Danach: in der App als Admin einloggen → Reiter **Verwaltung** → dort alle weiteren
> Nutzer und Rollen verwalten. Den Shell-Befehl brauchst du nur dieses eine Mal.
> (Lässt du `COACH_ROLE` weg, wird ein normaler Coach angelegt.)

---

## Schritt 6: Fertig – so nutzt ihr die App

- Deine App läuft jetzt unter `https://be-inevitable.onrender.com`
  (oder wie du sie genannt hast).
- **Coach:** mit den eben angelegten Daten einloggen.
- **Athleten:** Entweder registrieren sie sich selbst über "Registrieren" und der Coach
  ordnet sie per E-Mail zu – oder der Coach legt sie direkt unter
  "Übersicht → + Athlet hinzufügen → Neu anlegen" an.
- **Auf dem Handy als App:** Seite in Safari (iPhone) / Chrome (Android) öffnen →
  Teilen → **"Zum Home-Bildschirm"**. Dann startet sie wie eine echte App im Vollbild.

---

## Eigene Domain (optional)

Wenn du z.B. `app.be-inevitable.at` statt der Render-URL willst:
1. Render: **Settings → Custom Domains → Add Custom Domain**.
2. Den angezeigten CNAME-Eintrag bei deinem Domain-Anbieter (wo du be-inevitable.at
   verwaltest) hinterlegen.
3. Render stellt das HTTPS-Zertifikat automatisch aus.

---

## Datensicherung (Backup)

Deine ganze Datenbank ist die Datei unter `/var/data/data.db`.
Über die Render-**Shell** kannst du jederzeit ein Backup erzeugen und herunterladen,
oder Render-Snapshots der Disk nutzen. Mach das regelmäßig, sobald echte Nutzer drauf sind.

---

## Wenn etwas nicht läuft

- **App startet nicht / "exited":** Im Reiter **Logs** nachsehen. Häufigste Ursache:
  `JWT_SECRET` nicht gesetzt, obwohl `NODE_ENV=production`. → Variable setzen, neu deployen.
- **Daten weg nach Neustart:** Dann läuft es ohne persistente Festplatte (Free-Tier) oder
  `DB_PATH` zeigt nicht auf `/var/data/data.db`. → Schritt 3 & 4 prüfen.
- **Login geht nicht:** E-Mail wird klein geschrieben gespeichert – einfach normal eingeben,
  Groß-/Kleinschreibung ist egal.
- **Build schlägt fehl bei better-sqlite3:** Render baut das normalerweise problemlos.
  Falls doch ein Fehler kommt, nutzt die App automatisch die in Node eingebaute Datenbank –
  in dem Fall im Service unter **Settings** die Node-Version auf 22 stellen.

---

Viel Erfolg – ab jetzt kann die ganze Welt trainieren. 💪
