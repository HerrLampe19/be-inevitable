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
Version 2.0.0 legt beim ersten Start automatisch die fünf Mindset-Tabellen
(`mindset_sessions`, `wheel_assessments`, `challenges`, `challenge_days`, `mindset_entries`)
und vier zusätzliche Spalten in `users` an – ohne manuellen Schritt, bestehende Daten bleiben unberührt.

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

Sobald echte Nutzer drauf sind, mach vor jedem Update ein schnelles Backup:

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
- Schick mir die Log-Zeile, dann finde ich die Ursache.

## Hinweis zu neuen Abhängigkeiten
Wenn ein Update neue npm-Pakete braucht (z.B. `nodemailer`, `web-push`), installiert
Render sie beim Deploy automatisch über die `package.json`. Du musst nichts manuell tun.

## Prüfen, ob das Update live ist
Nach dem Deploy `https://DEINE-APP.onrender.com/api/version` öffnen – die angezeigte
Versionsnummer muss zur neuen Version passen (siehe CHANGELOG.md). Mehr dazu in
Seit 2.4.0 zusätzlich: `/api/version` muss `"schema":"ok"` tragen; sonst `/api/selftest` öffnen.
Und: **jede Auslieferung geänderter Dateien braucht eine neue Versionsnummer** (siehe DEPLOY-PRUEFEN.md).
DEPLOY-PRUEFEN.md.
