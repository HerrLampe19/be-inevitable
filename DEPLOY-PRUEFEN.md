# Version prüfen & richtig deployen

## NEU: Versionsnummer in der App
Unten im **Profil-Menü** (Profil-Icon oben rechts) und auf dem **Login-Screen** steht jetzt
die Versionsnummer. Die jeweils aktuelle Nummer steht in CHANGELOG.md.

**So prüfst du in 5 Sekunden, ob das Update live ist:**
1. App öffnen (oder Login-Screen ansehen).
2. Steht dort die **erwartete Versionsnummer** (laut CHANGELOG.md)? → neue Version ist live. ✓
3. Steht eine ältere Nummer (oder gar keine)? → der Deploy ist NICHT durchgekommen.

Wenn Frontend und Server auseinanderlaufen, zeigt der Login-Screen automatisch
„App X · Server Y – neu laden" mit einem Klick-Link, falls Frontend und Server auseinanderlaufen.

Du kannst die Version auch direkt abfragen: **https://DEINE-URL/api/version**
→ liefert die laufende Versionsnummer. Zeigt das eine alte Nummer, läuft auf Render noch alter Code.

## Cache ist jetzt kein Problem mehr
- `index.html` wird nicht mehr gecacht (no-cache-Header).
- `app.js` wird über einen `?v=`-Parameter mit der Versionsnummer geladen – bei jeder neuen Version eine neue URL,
  d.h. der Browser lädt garantiert die neue Datei. Kein hartes Neuladen mehr nötig.

## Deploy-Schritte (Render)
1. Code als ZIP hochladen / per Git pushen.
2. Render-Dashboard → Service → **Manual Deploy** → **Clear build cache & deploy**.
3. Warten bis Status „Live".
4. **https://DEINE-URL/api/version** öffnen → muss die neue Versionsnummer zeigen.
   - Zeigt es die neue Nummer → alles gut, App neu öffnen.
   - Zeigt es etwas anderes → der Build wurde nicht übernommen. Prüfe, ob die richtige
     ZIP/der richtige Branch deployt wurde und ob Render Fehler im Log zeigt.

## Wenn /api/version die alte Nummer zeigt
Dann liegt es definitiv NICHT am Code, sondern am Deployment-Prozess:
- Wurde wirklich die neueste ZIP hochgeladen? (Datei-Datum prüfen)
- Hat Render den Build ohne Fehler abgeschlossen? (Deploy-Logs ansehen)
- Zeigt Render denselben Commit-/Build-Stand wie erwartet?

## Datenbank / Profile
Keine Migration nötig. Neue Spalten (avatar, food_log.details, recipes.*) werden beim
Start automatisch ergänzt. **Bestehende Profile bleiben erhalten** – ein „zerschossenes"
Profil entsteht durch diese Updates nicht. Falls ein Test-Profil dennoch Probleme macht,
kannst du jederzeit ein neues anlegen; die Daten anderer Nutzer sind davon unberührt.
