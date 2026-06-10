# Wichtig: Läuft die neueste Version auf Render?

Mehrere gemeldete Bugs ("immer noch da") deuten darauf hin, dass auf Render noch eine
ältere Version läuft. So prüfst/erzwingst du das aktuelle Deployment:

## 1. Prüfen, welche Version live ist
Schnelltest im Browser (eingeloggt als Athlet):
- Heißt der unterste Nav-Punkt **"Home"** (nicht "Heute")? 
- Steht beim Schnell-Check-in **"Fast Check-in"**?
- Hat der Rezepte-Tab ein **⚙️ Filter**-Symbol (statt großem "Zutaten ausschließen"-Button)?
Wenn NEIN → es läuft die alte Version.

## 2. Neu deployen (Render)
1. Code committen & pushen (falls Git-Deploy):
   `git add -A && git commit -m "Bugfixes Kalender/Eingabe/Ernährung" && git push`
2. Im Render-Dashboard → dein Service → **"Manual Deploy"** →
   **"Clear build cache & deploy"** (wichtig: Cache leeren!).
3. Warten bis "Live", dann im Browser **Hard-Reload**: Strg+Shift+R
   (bzw. am Handy: App schließen, Browser-Cache leeren, PWA neu laden).

## 3. PWA-Cache am Handy
Die App ist eine PWA – das Handy cacht aggressiv. Nach dem Deploy:
- Browser-Tab komplett schließen und neu öffnen, ODER
- Falls als App installiert: deinstallieren und neu "Zum Startbildschirm".

## 4. Datenbank
Keine Migration nötig – neue Spalten (diet_type, recipes.diet) werden beim Boot
automatisch ergänzt. Bestehende Daten bleiben erhalten.
