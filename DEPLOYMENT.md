# BE INEVITABLE online stellen (Erst-Einrichtung)

Diese Anleitung richtet die App **einmalig** auf Render ein. Für spätere Updates
siehe UPDATE.md, zum Prüfen einer Auslieferung siehe DEPLOY-PRUEFEN.md, für die
Prüfung auf dem echten iPhone siehe IPHONE-TEST.md.

## Überblick
1. Code zu GitHub
2. Web Service auf Render erstellen
3. Persistente Festplatte für die Datenbank
4. Umgebungsvariablen setzen
5. Ersten Admin/Coach anlegen
6. Nach dem Deploy prüfen

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

---

## Schritt 4 – Umgebungsvariablen

Service → **Environment**. Die folgende Liste ist **vollständig**: sie enthält jede Variable, die der
Code liest (`grep process.env` über `src/`). Was hier nicht steht, wirkt auch nicht.

### 4a · Das MUSST du setzen

| Variable | Wert | Was passiert ohne sie |
|---|---|---|
| `JWT_SECRET` | lange Zufallszeichenkette, mind. 32 Zeichen, z.B. aus `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | **Der Server startet nicht** (`FEHLER: JWT_SECRET ist nicht gesetzt`, Exit 1). Das ist Absicht: bis 2.4.0 bootete er mit einem im Quelltext stehenden Standardschlüssel, und damit ließ sich jedes Konto fälschen. **Nie ändern**, solange Nutzer angemeldet bleiben sollen – ein neues Secret meldet alle ab. |
| `DB_PATH` | `/var/data/data.db` (der Mount-Pfad aus Schritt 3) | Die Datenbank landet im Projektordner und ist **nach jedem Deploy weg**. |
| `NODE_ENV` | `production` | Kein HSTS. (Das `secure`-Flag am Sitzungs-Cookie hängt seit 2.4.0 **zusätzlich** an der erkannten HTTPS-Verbindung, fällt also nicht mit aus – gesetzt gehört die Variable trotzdem.) |
| `APP_URL` | die öffentliche Adresse, z.B. `https://deine-app.onrender.com` (ohne Schrägstrich am Ende) | Die Links in E-Mails und der persönliche Apple-Health-Link zeigen ins Leere. Im Status-Streifen der **Verwaltung** steht dann rot: „APP_URL · Links in Mails zeigen ins Leere · fehlt". |

### 4b · Für E-Mail (Bestätigung, Passwort-Reset, Wochenmail)

| Variable | Wert |
|---|---|
| `EMAIL_HOST` | z.B. `smtp-relay.brevo.com` |
| `EMAIL_PORT` | `587` (oder `465`) |
| `EMAIL_USER` | Login beim Mail-Dienst |
| `EMAIL_PASS` | SMTP-Schlüssel / App-Passwort |
| `EMAIL_FROM` | `BE INEVITABLE <deine-verifizierte-absenderadresse>` |

Details und ein kostenloser Anbieter: **EMAIL-SETUP.md**.

> **Ohne SMTP gibt es keinen Passwort-Reset.** Der Link wird seit 2.4.0 nicht mehr ins Log
> geschrieben. Fehlt `EMAIL_HOST`, steht im Log nur `[email] Mail nicht versandt - SMTP fehlt`
> mit maskierter Adresse – der Inhalt kommt dort **nicht** an. Wer die App ohne Mailversand
> betreibt, sollte das wissen, bevor jemand sein Passwort vergisst.

### 4c · Optional

| Variable | Wirkung | Standard |
|---|---|---|
| `REGISTER_CODE` | Der Einladungscode. **Seit 2.9.0 entscheidet der Schalter in der Verwaltung, ob er verlangt wird** (siehe unten) – solange niemand ihn angefasst hat, gilt: Variable gesetzt = Code nötig. | nicht gesetzt = offene Registrierung (DECISIONS F1) |
| `SELFTEST_KEY` | Gesetzt: `/api/selftest?key=…` zeigt zusätzlich Zählwerte (Nutzerzahl, Sätze …). Ohne Schlüssel bleibt der Selbsttest öffentlich erreichbar, aber **ohne Zahlen** – die Kundenzahl ist geschäftssensibel. | nicht gesetzt |
| `ANTHROPIC_API_KEY` | Schaltet die KI-Analyse für Coaches frei. **Dann ist Anthropic Empfänger von Gesundheitswerten** → Datenschutzerklärung und Auftragsverarbeitung, siehe SICHERHEIT.md Abschnitt 4 und 8. Der Athlet muss zusätzlich selbst zustimmen. Not-Aus ohne Redeploy: siehe unten. | nicht gesetzt = KI aus |
| `AI_MODEL` | Anderes Modell für die KI-Analyse (wirkt nur mit `ANTHROPIC_API_KEY`). | der Standard im Code |
| `APP_TZ` | Zeitzone (IANA-Name), in der die App „heute" und alle Push-Uhrzeiten rechnet. | `Europe/Berlin` |
| `MINIFY` | `0` liefert JavaScript und CSS **unverkleinert** aus – die Notbremse, falls je der Verdacht aufkommt, der Verkleinerer mache etwas kaputt. Gleiche Funktion, nur größer. Im Startprotokoll steht dann `MINIFY=0 (unverkleinert)`. | verkleinert |
| `BACKUP_DIR` | **Neu in 3.0.0.** Ordner für die nächtlichen Sicherungen. Lass ihn leer – dann legt der Server sie **neben die Datenbank** (`/var/data/backups`), also auf die persistente Platte. Setz ihn nur, wenn du einen zweiten Datenträger hast. Ein Ordner **im Projektverzeichnis wäre beim nächsten Deploy weg** – derselbe Fehler wie ein vergessenes `DB_PATH`. | `<Ordner von DB_PATH>/backups` |
| `PORT` | Setzt Render selbst. Nicht anfassen. | von Render |

### 4d · Niemals auf Render setzen

| Variable | Warum |
|---|---|
| `ALLOW_DEV_SECRET` | `1` erlaubt den Start **ohne** `JWT_SECRET` – also mit dem öffentlich bekannten Schlüssel aus dem Quelltext. Nur für lokale Tests ohne echte Daten. |
| `EMAIL_DEBUG` | `1` schreibt den Mailtext **samt Links** ins Log. Der Code ignoriert die Variable bei `NODE_ENV=production` von sich aus – setzen muss man sie trotzdem nicht. |
| `B12_COUNT` | `1` zählt jede Datenbankabfrage mit – ein Messwerkzeug aus der Arbeit an 3.0.0 (N+1-Abfragen in `/api/athletes`). Es kostet bei jeder Anfrage Zeit und nützt im Betrieb nichts. |

### 4e · Nur für den einmaligen Befehl in Schritt 5

`COACH_EMAIL`, `COACH_PASSWORD`, `COACH_NAME`, `COACH_ROLE` liest ausschließlich
`npm run create-coach`. Sie gehören **nicht** in die Environment-Liste des Dienstes, sondern werden
dem Befehl in der Shell vorangestellt.

Nach dem Speichern startet Render neu.

### 4f · Was du NICHT als Variable setzen musst (seit 2.9.0)

Drei Betriebsentscheidungen liegen seit 2.9.0 in der App selbst – **Verwaltung → Betrieb**, wirksam
**sofort, ohne Redeploy**:

| Schalter | Werte | Standard |
|---|---|---|
| **Registrierung** | offen · nur mit Code · geschlossen | offen |
| **KI-Analyse** | an · Not-Aus (für den ganzen Betrieb, unabhängig von den Schaltern der Athleten) | an |
| **Wartungshinweis** | eine Zeile, höchstens 200 Zeichen | leer |

> **Zum Wartungshinweis eine ehrliche Einschränkung (Stand 2.9.0, nachgemessen):** Der Text wird
> gespeichert und ist öffentlich abrufbar (`GET /api/notice`, und als Feld in `/api/register-info`),
> aber die **Athleten-Oberfläche zeichnet ihn noch nicht**. Du siehst ihn also in der Verwaltung, dein
> Athlet noch nicht. Wer jetzt eine Wartung ankündigen will, schickt zusätzlich eine Rundnachricht.
> Der Auftrag steht in `DEFER-A5.md` (W1).

Jedes Umlegen steht danach im Protokoll (`ops.set`) – beim Wartungshinweis ohne seinen Text, nur mit
Länge und „geleert ja/nein". **„Nur mit Code" lässt sich erst wählen, wenn `REGISTER_CODE` gesetzt
ist** – sonst wäre es eine Tür ohne Schlüssel, und die Verwaltung sagt das auch so. Details:
SICHERHEIT.md Abschnitt 13.

Ebenfalls dort: der **Zustand der wiederkehrenden Läufe** (`up` / `late` / `down`) und ein
„jetzt nachholen" für den Sonntagslauf.

---

## Schritt 5 – Ersten Admin/Coach anlegen
Service → **Shell**, dann (Werte anpassen):
```
COACH_EMAIL=admin@be-inevitable.at COACH_PASSWORD=DEIN_SICHERES_PASSWORT COACH_NAME="Admin" COACH_ROLE=admin npm run create-coach
```
Danach mit diesen Zugangsdaten in der App anmelden. Weitere Coaches genauso mit
`COACH_ROLE=coach`. (Aus Sicherheitsgründen keine Passwörter in dieser Datei.)

> **Wichtig seit 2.6.0:** Ein **Administrator ist Betreiber, nicht Coach.** Er sieht Konten, Rollen,
> Zuordnungen, Protokoll, Fehler, Jobs und Zahlen – **keine** Gesundheitsdaten, keine Nachrichten,
> keine Freitexte. Wer selbst Athleten betreuen will, braucht ein **zweites Konto mit
> `COACH_ROLE=coach`**. Details: SICHERHEIT.md Abschnitt 10.

---

## Schritt 6 – Nach dem Deploy prüfen (Render-Checkliste)

Vier Adressen, fünf Minuten. In dieser Reihenfolge.

| # | Was | Wo | Grün heißt |
|---|---|---|---|
| 1 | **Version und Schema** | `https://DEINE-URL/api/version` | `{"version":"3.0.0","schema":"ok"}` – die erwartete Nummer **und** `ok`. |
| 2 | **Selbsttest** | `https://DEINE-URL/api/selftest` | `"ok": true`, `problems: []`, `schema.missingTables/-Columns/-Indexes` alle leer, `db.reachable: true`, `db.journalMode: "wal"`. Solange etwas fehlt, antwortet die Route **HTTP 503** und nennt es im Klartext – ohne personenbezogene Daten. |
| 3 | **Betriebszustand** | in der App als Admin: **Verwaltung** (Status-Streifen ganz oben) | Steht dort **„Betrieb ohne Befund"** statt „N Punkte zu prüfen", ist alles grün. Einzeln: *Version* = deine Nummer · *Schema* = „vollständig" · *E-Mail-Versand* nicht „fehlt" · *APP_URL* nicht „fehlt" · *Letzter Cron* frisch · *Fehler (24 h)* = 0. Dieselben Werte liefert `GET /api/admin/stats`. |
| 4 | **Startprotokoll** | Render → **Logs** | Die Zeile `[buendel] /app.js … KB roh · /app.css … KB roh · 4 Module nachladbar` muss dastehen. Fehlt sie, ist der Dienst mit altem Code hochgefahren. Steht dort `NICHT verkleinert`, melden – die App läuft weiter, nur größer. |

**Danach einmal die App selbst öffnen**, anmelden und auf die Startseite schauen. Und wenn ein iPhone
im Spiel ist: **IPHONE-TEST.md** von oben nach unten abarbeiten. Alles, was dort geprüft wird – Push,
Installation, Pausen-Timer, Kurzbefehl –, lässt sich am Rechner nicht feststellen.

**Schlägt Punkt 1 oder 2 fehl:** Das liegt fast nie am Code, sondern am Deployment. Siehe
DEPLOY-PRUEFEN.md, Abschnitt „Wenn /api/version die alte Nummer zeigt".

---

## Eigene Domain (optional)
Render → Settings → **Custom Domains**: Domain hinzufügen und den angezeigten
DNS-Eintrag beim Domain-Anbieter setzen. Danach `APP_URL` auf die neue Domain ändern
(sonst zeigen Mail-Links und der Apple-Health-Link weiter auf die alte Adresse).

## Backup

**Seit 3.0.0 sichert der Server sich jede Nacht selbst** – um 3 Uhr Ortszeit (`APP_TZ`), per
`VACUUM INTO` in den Ordner **`backups/` neben der Datenbank**, mit SHA-256 je Datei und einer
Aufbewahrung von 14 Tagen. Dazu eine **Wiederherstellungsprobe**, die die jüngste Sicherung in eine
Wegwerf-Datei spielt und dort nachprüft, ob sie überhaupt taugt – Stand 3.0.0 **ohne Knopf in der
Verwaltung**, ausgelöst über `POST /api/admin/backups/verify`. Beides – Einstellungen, Grenzen, die
Falle beim allerersten Mal und was die Verwaltung davon heute zeigt – steht in
**DEPLOY-PRUEFEN.md, Abschnitt „Die Sicherung läuft ab 3.0.0 von selbst"**.

**Damit die nächtliche Sicherung an der richtigen Stelle landet, brauchst du nichts zu tun** – außer
dem, was du für die Datenbank ohnehin getan hast: `DB_PATH` zeigt auf die persistente Platte, also
liegt auch der Ordner `backups/` dort. Steht `DB_PATH` falsch, sind nach dem nächsten Deploy
Datenbank **und** Sicherungen weg.

> **Das ersetzt die Kopie auf deinem Rechner nicht.** Die nächtliche Datei liegt auf **derselben
> Platte** wie die Datenbank. Sie rettet dich vor einem versehentlich gelöschten Datensatz und vor
> einem misslungenen Update – nicht vor einem Plattenschaden und nicht vor einem gelöschten
> Render-Dienst. Dafür lädst du weiterhin von Hand herunter:

Sobald echte Nutzer drauf sind, vor jedem Update ein Backup ziehen. **Der saubere Weg** ist der Knopf
in der App: Verwaltung → Betrieb → **Sicherung herunterladen** (Passwort nötig, höchstens alle
10 Minuten). Er erzeugt eine **konsistente** Kopie (`VACUUM INTO`) – eine einzelne Datei, die
garantiert vollständig ist.

Der Weg über die Render-Shell tut es auch, verlangt aber Sorgfalt:
```
cp /var/data/data.db /var/data/backup-$(date +%F).db
cp /var/data/data.db-wal /var/data/backup-$(date +%F).db-wal 2>/dev/null
cp /var/data/data.db-shm /var/data/backup-$(date +%F).db-shm 2>/dev/null
```

> **Wichtig: immer alle drei Dateien zusammen sichern.** Die Datenbank läuft im
> WAL-Modus: frische Schreibvorgänge stehen zuerst in `data.db-wal`, nicht in
> `data.db`. Eine Kopie von `data.db` **allein** kann deshalb tagealt sein –
> ohne jede Fehlermeldung. Wer nur eine Datei will, kopiert erst **nach** einem
> Checkpoint: die App schreibt das WAL alle 5 Minuten, stündlich und beim Herunterfahren
> (SIGTERM beim Deploy) automatisch zurück – also z.B. direkt nach einem Neustart
> des Dienstes kopieren. Dasselbe gilt beim Herunterladen oder beim Umziehen der
> Datenbank auf einen anderen Rechner.

Die Dateien lassen sich auch herunterladen, um sie extern zu sichern.
**Die Sicherung enthält alle Gesundheitsdaten aller Nutzer** – verschlüsselt ablegen, nie in einen
synchronisierten Ordner, nie in eine Mail (SICHERHEIT.md Abschnitt 9). **Das gilt ab 3.0.0 auch für
die nächtlichen Dateien in `/var/data/backups`:** jede einzelne ist ein vollständiger Abzug aller
Konten, Freitexte, Nachrichten und Passwort-Hashes. Wer den Ordner weitergibt, gibt alles weiter.

Und: Eine Sicherung, die niemand je zurückgespielt hat, ist keine Sicherung. **Seit 3.0.0 prüft der
Server das auf Anforderung selbst** (`POST /api/admin/backups/verify`) – wie er prüft, was „grün"
heißt und warum die allererste Probe zwangsläufig rot wird, steht in DEPLOY-PRUEFEN.md.

## Wenn etwas nicht läuft
- Render → **Logs** zeigen Fehler im Klartext.
- `/api/version` prüfen: zeigt es die erwartete Version und `"schema":"ok"`? Bei Problemen
  `/api/selftest` öffnen (HTTP 503 + Klartext, welche Migration fehlt). Ob die Mail konfiguriert
  ist, steht als Admin unter `/api/admin/stats` bzw. in der Verwaltung → Betrieb.
- Häufige Stolpersteine: Code in verschachteltem Unterordner, falscher Branch,
  fehlendes `DB_PATH` (→ Daten weg nach Deploy), `JWT_SECRET` nicht gesetzt
  (→ der Dienst startet gar nicht erst), `APP_URL` vergessen (→ tote Links in Mails).
