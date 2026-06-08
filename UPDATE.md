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
2. Befehl: `cp /var/data/data.db /var/data/backup-$(date +%F).db`
   Das legt eine datierte Kopie auf derselben Festplatte ab.
3. Alternativ kannst du die Datei auch herunterladen, um sie extern zu sichern.

So kannst du im unwahrscheinlichen Problemfall jederzeit zurück.

## Wenn nach einem Update etwas klemmt

- Render → **Logs** ansehen. Fehler stehen dort im Klartext.
- Die App ist so gebaut, dass ein fehlendes neues Feld den Start nicht verhindert –
  im Zweifel läuft die alte Funktion weiter.
- Schick mir die Log-Zeile, dann finde ich die Ursache.

## Hinweis zu diesem Update (Apple Health Import)
Dieses Update fügt der `users`-Tabelle zwei neue Spalten hinzu (`last_health_import`,
`health_reminder`) und zwei neue Tabellen für frühere Features. Das geschieht
**automatisch und datenschonend** beim ersten Start nach dem Deploy:
- Neue Spalten werden per `ALTER TABLE` ergänzt, falls sie fehlen – bestehende Zeilen behalten ihre Werte.
- Es werden keine Spalten entfernt oder umbenannt.
Du musst nichts manuell tun. Wie immer gilt: vorher ein kurzes Backup schadet nicht
(`cp /var/data/data.db /var/data/backup-$(date +%F).db`).
