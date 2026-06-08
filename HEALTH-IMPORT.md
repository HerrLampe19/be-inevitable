# Apple-Health-Daten per Kurzbefehl übertragen (Anleitung)

Der „Alle Gesundheitsdaten exportieren"-Weg von Apple ist riesig, langsam und lässt
sich nicht auf einen Zeitraum eingrenzen. Dieser Weg über die **Kurzbefehle-App** ist
viel schneller: einmal einrichten, danach wöchentlich ein Knopfdruck – nur wenige
Kilobyte statt Gigabyte.

## Was am Ende herauskommt
Der Kurzbefehl erzeugt einen kurzen Text in diesem Format (Beispiel):

```
{"days":{
  "2026-06-01":{"weight":75.5,"steps":8200,"sleep":7.5},
  "2026-06-02":{"weight":75.3,"steps":10100,"sleep":8.0}
}}
```

Diesen Text fügst du in BE INEVITABLE unter **Verlauf → Gesundheitsdaten verbinden →
Apple Health** in das Feld ein und tippst „Übernehmen". Fertig.

> Felder, die du nicht hast, kannst du weglassen. Auch eine einfache Zeilenliste
> `2026-06-01, 75.5, 8200, 7.5` (Datum, Gewicht, Schritte, Schlaf) wird akzeptiert.

## Kurzbefehl einrichten (einmalig, ca. 10 Min.)
Die genauen Aktionsnamen können je nach iOS-Version leicht abweichen.

1. **Kurzbefehle**-App öffnen → **+** (neuer Kurzbefehl).
2. Aktion **„Gesundheitsdaten suchen"** (engl. *Find Health Samples*) hinzufügen:
   - Typ **Gewicht (Body Mass)**, sortiert nach Datum, Zeitraum **letzte 7 Tage**.
3. Mit weiteren „Gesundheitsdaten suchen"-Aktionen dasselbe für **Schritte (Step Count)**
   und **Schlaf (Sleep Analysis)** machen.
4. Die Ergebnisse in **Text** zu obigem JSON zusammensetzen
   (Datum als JJJJ-MM-TT, Gewicht in kg, Schritte als Zahl, Schlaf in Stunden).
   - Tipp: Wer sich das Bauen sparen will, kann den Kurzbefehl auch einfach pro Tag
     je einen Wert ausgeben lassen und die einfache Zeilenliste oben verwenden.
5. Abschluss-Aktion **„In die Zwischenablage kopieren"**.
6. Kurzbefehl sichern, z.B. als „BE INEVITABLE Export".

## Wöchentlich übertragen (ein Knopfdruck)
1. Kurzbefehl starten (vom Home-Bildschirm oder aus der Kurzbefehle-App).
2. In BE INEVITABLE das Feld öffnen und **einfügen** → **Übernehmen**.

Aktiviere optional die **wöchentliche Erinnerung** in der App – dann weist dich die
Startseite freundlich darauf hin, wenn länger nichts übertragen wurde.

## Warum nicht vollautomatisch?
Apple gibt Gesundheitsdaten aus Datenschutzgründen nur an native iPhone-Apps heraus,
nicht an Webseiten. Eine echte Hintergrund-Synchronisation würde eine eigene iOS-App
und einen kostenpflichtigen Apple-Entwickler-Account erfordern. Der Kurzbefehl-Weg
liefert nahezu denselben Komfort – ohne diese Kosten.

## Android / andere Geräte
Die Oberfläche „Gesundheitsdaten verbinden" zeigt bereits Google Fit / Health Connect,
Fitbit und Garmin als „kommt bald" an. Diese Anbindungen sind noch nicht aktiv, aber
vorgesehen – sie haben echte Web-Schnittstellen und lassen sich später ergänzen, ohne
dass sich für die Nutzer etwas an der Bedienung ändert.
