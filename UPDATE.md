# Updates einspielen, ohne Daten zu verlieren

Diese Anleitung beantwortet deine Frage: *Wie bringe ich neue Features online,
ohne dass die Daten der Athleten verloren gehen?*

## Die kurze, beruhigende Antwort

**Deine Daten gehen bei einem Update NICHT verloren.** Code und Daten sind getrennt:

- **Der Code** liegt auf GitHub und wird von Render bei jedem Push neu gebaut.
- **Die Daten** (alle Nutzer, Logins, Trainings, Ernährung, Fotos …) liegen in der
  Datei `data.db` auf der **persistenten Festplatte** (`/var/data`), die du bei Render
  eingerichtet hast. Diese Festplatte bleibt bei einem Code-Update unangetastet.

Beim Neustart prüft die App: „Gibt es die Tabellen schon? Gibt es schon Daten?"
Wenn ja, fasst sie nichts an (`CREATE TABLE IF NOT EXISTS`, idempotenter Seed).
Neue Features fügen nur **neue** Tabellen/Spalten hinzu – nie werden alte überschrieben.
So sind seit 2.0.0 die fünf Mindset-Tabellen dazugekommen, mit 2.6.0 die vier Betriebstabellen
(`audit`, `errors`, `jobs`, `support_grants`) und die Einwilligungs-Spalten, mit 3.0.0 vier weitere
(`exercise_catalog`, `target_history`, `session_override`, `backups`) – jedes Mal beim ersten
Start, ohne manuellen Schritt, ohne dass bestehende Daten angefasst wurden. Ob eine Migration
durchgelaufen ist, sagt dir nach dem Deploy `/api/selftest`.

## So spielst du ein Update ein (Schritt für Schritt)

1. **Neue Dateien von mir herunterladen** (das ZIP) und entpacken.
2. **Auf GitHub aktualisieren:**
   - Gehe zu deinem Repo auf github.com.
   - Du kannst die geänderten Dateien per „Upload files" hochladen – gleiche Pfade
     überschreiben die alten. Am einfachsten: die kompletten Ordner `src` und `public`
     sowie geänderte Einzeldateien (z.B. `package.json`) neu hochladen.
   - Unten **Commit changes** klicken.
   - (Wer Git nutzt: `git add . && git commit -m "Update" && git push`.)
3. **Render deployed automatisch.** Sobald der neue Commit auf GitHub ist, erkennt
   Render das und baut neu (2–4 Min). Du musst bei Render nichts klicken.
4. **Fertig.** Alle Athleten-Daten, Logins und Einträge sind unverändert da.
   Die Nutzer sehen beim nächsten Öffnen einfach die neuen Funktionen.

## Was sicher ist – und was man vermeiden muss

✅ **Immer sicher** (das machen wir):
- Neue Tabellen hinzufügen
- Neue Spalten zu bestehenden Tabellen hinzufügen
- Neue Routen, neue Frontend-Funktionen
- Bestehende Logik verbessern

⚠️ **Nur mit Vorsicht / Absprache** (machen wir nicht ohne Migration):
- Eine bestehende Spalte umbenennen oder löschen
- Eine Tabelle umbauen
Solche Änderungen brauchen ein „Migrations-Skript", das die alten Daten ins neue
Format überführt. Wenn so etwas nötig wird, sage ich dir das ausdrücklich und liefere
das Skript mit. Solange wir nur *hinzufügen*, brauchst du dir keine Sorgen zu machen.

## Sicherheitsnetz: Backup vor jedem Update (empfohlen)

> **Seit 3.0.0 sichert sich die App jede Nacht selbst** (3 Uhr Ortszeit, in `/var/data/backups`,
> 14 Tage Aufbewahrung). Das ist ein Netz, aber nicht *dein* Netz: die Datei liegt auf **derselben
> Platte** wie die Datenbank. Vor einem Update ziehst du dir trotzdem eine Kopie auf deinen Rechner –
> und zwar **vor** dem Deploy, nicht danach. Alles zur nächtlichen Sicherung und zur
> Wiederherstellungsprobe steht in **DEPLOY-PRUEFEN.md**.

Sobald echte Nutzer drauf sind, mach vor jedem Update ein Backup.

**Der einfache und saubere Weg:** in der App als Admin → **Verwaltung → Betrieb → Sicherung
herunterladen** (dein Passwort als zweiter Faktor). Das ist eine **konsistente** Kopie
(`VACUUM INTO`) – eine Datei, garantiert vollständig, ohne Begleitdateien. Sie enthält allerdings
alle Gesundheitsdaten aller Nutzer: verschlüsselt ablegen, nie per Mail verschicken.

**Der Weg über die Shell** tut es auch, verlangt aber Sorgfalt:

1. Render → dein Service → Reiter **Shell**.
2. Befehl (alle drei Dateien, siehe Kasten):
   ```
   cp /var/data/data.db /var/data/backup-$(date +%F).db
   cp /var/data/data.db-wal /var/data/backup-$(date +%F).db-wal 2>/dev/null
   cp /var/data/data.db-shm /var/data/backup-$(date +%F).db-shm 2>/dev/null
   ```
   Das legt eine datierte Kopie auf derselben Festplatte ab.
3. Alternativ kannst du die Dateien auch herunterladen, um sie extern zu sichern.

> **Warum drei Dateien?** Die Datenbank läuft im WAL-Modus: neue Einträge landen
> zuerst in `data.db-wal` und wandern erst bei einem „Checkpoint" nach `data.db`.
> Eine Kopie von `data.db` **allein** kann deshalb Tage alt sein – ohne dass eine
> Fehlermeldung darauf hinweist. Die App schreibt das WAL stündlich und bei jedem
> sauberen Stopp (Render schickt beim Deploy SIGTERM) zurück; wer nur eine einzelne
> Datei sichern will, kopiert also am besten direkt nach einem Neustart des Dienstes.

So kannst du im unwahrscheinlichen Problemfall jederzeit zurück.

## Wenn nach einem Update etwas klemmt

- Render → **Logs** ansehen. Fehler stehen dort im Klartext.
- Die App ist so gebaut, dass ein fehlendes neues Feld den Start nicht verhindert –
  im Zweifel läuft die alte Funktion weiter.
- **Ein einzelnes Gerät hängt** (weiße Seite, alte Version, Neuladen hilft nicht): Auf diesem Gerät
  `https://DEINE-APP.onrender.com/?swkill=1` aufrufen. Das meldet den Service Worker ab und leert
  alle Caches. Erklärung: DEPLOY-PRUEFEN.md, Abschnitt „Notausgang".
- Schick mir die Log-Zeile, dann finde ich die Ursache.

## Hinweis zu neuen Abhängigkeiten
Wenn ein Update neue npm-Pakete braucht (z.B. `nodemailer`, `web-push`), installiert
Render sie beim Deploy automatisch über die `package.json`. Du musst nichts manuell tun.

## Die eine Regel, die man nicht brechen darf

> ⚠️ **Jede Auslieferung geänderter JS-/CSS-Dateien braucht eine neue Versionsnummer in
> `package.json`.**

Der Browser lädt Skripte und Stylesheets über einen `?v=`-Parameter mit der Versionsnummer. Wird
dieselbe Nummer erneut hochgeladen, ist die Adresse unverändert – und der Browser behält die alten
Dateien **bis zu ein Jahr lang**, ohne dass jemand es merkt. Das gilt seit 2.4.0 ohne Ausnahme; die
Begründung steht in DEPLOY-PRUEFEN.md.

Dasselbe in kurz für den lokalen Betrieb: Wer eine Datei unter `public/js/` oder `public/css/`
ändert, muss den **Server neu starten** – er bündelt die Dateien beim Hochfahren, nicht je Anfrage.

## Prüfen, ob das Update live ist

Nach dem Deploy in dieser Reihenfolge:

1. `https://DEINE-APP.onrender.com/api/version` öffnen – die angezeigte Versionsnummer muss zur neuen
   Version passen (siehe CHANGELOG.md) **und** `"schema":"ok"` tragen.
2. Steht dort etwas anderes: `https://DEINE-APP.onrender.com/api/selftest` öffnen. Die Antwort nennt
   im Klartext, was fehlt (HTTP 503, solange etwas fehlt), ohne personenbezogene Daten.
3. Als Admin in der App: **Verwaltung → Betrieb** – Mail, `APP_URL`, Schema und Fehlerzahl auf einen
   Blick.

Die ausführliche Checkliste steht in **DEPLOYMENT.md, Schritt 6**; was zu tun ist, wenn einer der
Punkte rot bleibt, in **DEPLOY-PRUEFEN.md**.
