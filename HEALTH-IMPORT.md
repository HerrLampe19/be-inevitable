# Apple Health verbinden (Schlaf, Verbrauch, Trainings)

Ab Version 2.2.0 gibt es zwei Wege. **Der erste läuft von selbst** – einmal einrichten,
danach schickt das iPhone jede Nacht die Werte, ohne dass du etwas tust.

| | automatisch | von Hand |
|---|---|---|
| Aufwand | 10 Min. einmalig | jedes Mal einfügen |
| Übertragung | nachts von selbst | wenn du dran denkst |
| Werte | Schlaf, Schritte, Verbrauch, Bewegungsminuten, Ruhepuls, HRV, Gewicht, Trainings | Gewicht, Schritte, Schlaf |

Beide Wege findest du in der App unter **Analyse → Gesundheitsdaten verbinden → Apple Health**.

---

## 1. Automatisch (empfohlen)

### Was passiert da?
Die App erzeugt dir einen **persönlichen Link**. Ein Kurzbefehl auf dem iPhone liest deine
Werte aus der Gesundheits-App und schickt sie an diesen Link. Der Link darf **nur
Gesundheitswerte schreiben** – er ist kein Login und gibt nichts heraus. Verloren oder
versehentlich geteilt? „Neu erzeugen" macht den alten sofort ungültig.

### Einrichten
1. In der App: **Analyse → Gesundheitsdaten verbinden → Apple Health →
   „Automatische Übertragung einrichten"**. Danach **Link kopieren**.
2. **Kurzbefehle**-App öffnen → **+** (neuer Kurzbefehl).
3. Aktion **„Gesundheitsdaten suchen"** hinzufügen: Typ **Schlafanalyse**, Zeitraum **heute**;
   danach **„Statistik berechnen" → Summe**. Apple liefert Minuten – also noch **durch 60 teilen**.
   Die Variable in **sleep** umbenennen.
4. Dasselbe für die übrigen Werte:

   | Gesundheitsdaten-Typ | Rechnung | Schlüssel |
   |---|---|---|
   | Schritte | Summe | `steps` |
   | Aktive Energie | Summe | `active_kcal` |
   | Trainingsminuten | Summe | `exercise_min` |
   | Ruhepuls | Durchschnitt | `resting_hr` |
   | Herzfrequenzvariabilität | Durchschnitt | `hrv` |
   | Gewicht | letzter Wert | `weight` |

5. Aktion **„Wörterbuch"** anlegen: je ein Schlüssel aus der Tabelle, als Wert die passende
   Variable. Werte, die du nicht hast, lässt du einfach weg.
6. Aktion **„Inhalte von URL abrufen"**:
   - URL: **dein kopierter Link**
   - Methode: **POST**
   - Anfragetext: **JSON**, Inhalt: das Wörterbuch aus Schritt 5
7. Kurzbefehl sichern, z.B. als **„BE INEVITABLE Sync"**, und einmal starten.
   In der App steht danach oben **„Zuletzt: …"**.
   Bleibt die Zeile leer oder auf einem alten Datum stehen, siehe **„Wenn nichts ankommt: Antwort 409"**
   weiter unten – ohne deine Einwilligung nimmt der Server keine Gesundheitsdaten an, und der
   Kurzbefehl meldet das von sich aus nicht.

### Jede Nacht von selbst
Kurzbefehle-App → Reiter **Automation** → **+** → **Tageszeit** → z.B. **23:50**, täglich →
Kurzbefehl **„BE INEVITABLE Sync"** wählen → **„Sofort ausführen"** ein, **„Vor dem Ausführen
fragen"** aus. Fertig.

### Trainings mitschicken (optional)
Wer auch seine Einheiten übernehmen will, ergänzt die Aktion **„Trainings suchen"**
(Zeitraum heute) und schickt zusätzlich den Schlüssel `workouts` als Liste:

```json
{"workouts":[{"date":"2026-09-08","kind":"Laufen","minutes":38,"kcal":410,"distance_km":6.8,"avg_hr":151,"id":"…"}]}
```

Das Feld `id` ist die Trainings-UUID aus Apple Health. Sie sorgt dafür, dass dieselbe Einheit
nie zweimal ankommt – auch wenn der Kurzbefehl mehrmals am Tag läuft. Die Einheiten erscheinen
unter **Training → Cardio**, mit einem kleinen Apple-Zeichen als Herkunftshinweis.

### Was die Schnittstelle annimmt
`POST <dein Link>` mit JSON. Der Schlüssel steht im Link (`?token=…`), weil die Kurzbefehle-App so am
einfachsten arbeitet. Wer es sauberer mag, schickt ihn stattdessen als Header `X-Health-Token` oder
im JSON als Feld `token` und ruft nur `…/api/health/push` auf – dann taucht er in keiner Adresse
auf. Der Server schreibt Adressen ohnehin nicht ins Log.

Der Inhalt: entweder flach (ein Tag, das ist der einfache Weg):

```json
{"date":"2026-09-08","sleep":7.4,"steps":11200,"active_kcal":742,"exercise_min":51,"resting_hr":48,"hrv":72,"weight":78.2}
```

Ohne `date` zählt der Tag, an dem gesendet wird. Oder mehrere Tage auf einmal:

```json
{"days":{"2026-09-07":{"sleep":6.1,"steps":8300},"2026-09-08":{"sleep":7.4,"steps":11200}}}
```

Regeln beim Zusammenführen:
- Werte, die nur die Uhr kennt (Schlaf, Schritte, Verbrauch, Bewegungsminuten, Ruhepuls, HRV),
  **ersetzen** den bisherigen Stand – die Uhr weiß es besser.
- Das **Gewicht** wird nur ergänzt, wenn für den Tag noch keines eingetragen ist. Von Hand
  gewogene Werte bleiben also stehen.
- Zukunftsdaten und unrealistische Werte werden verworfen, maximal 400 Tage pro Aufruf.
- Höchstens 60 Übertragungen pro Stunde und Schlüssel.

Die Antwort ist kurz genug, um sie im Kurzbefehl als Mitteilung anzuzeigen:
`{"ok":true,"days":1,"neu":0,"aktualisiert":1,"einheiten":2}`

### Wenn nichts ankommt: Antwort 409 („Einwilligung fehlt")

Seit Version 2.6.0 speichert die App Gesundheitsdaten erst, wenn du einmal ausdrücklich zugestimmt
hast (Art. 9 DSGVO). Das gilt auch für den Kurzbefehl. Ohne Zustimmung antwortet der Server:

```json
{"error":"Bevor wir Gesundheitsdaten speichern, brauchen wir dein Einverständnis. …","needsConsent":true}
```

Status **409**, und es wird **nichts** geschrieben. Der Kurzbefehl läuft trotzdem jede Nacht weiter –
und zeigt diese Antwort nur an, wenn du ihm eine Mitteilung mitgegeben hast (siehe unten). Sonst
scheitert die Übertragung **still**, Nacht für Nacht, bis du zustimmst. Erkennbar ist das in der App
daran, dass **„Zuletzt: …"** unter *Analyse → Gesundheitsdaten verbinden* stehen bleibt.

**Was zu tun ist:**
1. In der App: **Konto → Daten & Verbindungen → Einwilligung** – ein Häkchen, jederzeit widerrufbar.
2. Die Tage, die in der Zwischenzeit verloren gegangen sind, holt der Kurzbefehl **nicht** von selbst
   nach – er schickt nur den aktuellen Tag. Trage sie einmalig über **Abschnitt 2 (Von Hand)** nach,
   oder schick den Kurzbefehl einmal mit dem `days`-Format über den fehlenden Zeitraum.

**Damit es dir nie wieder still passiert:** Häng im Kurzbefehl hinter „Inhalte von URL abrufen" die
Aktion **„Mitteilung anzeigen"** mit dem Ergebnis der Abfrage an. Dann steht bei einem 409 der
Klartext auf dem Sperrbildschirm statt gar nichts.

Ändert sich später der **Text** der Einwilligung, fragt dich die App beim nächsten Check-in noch
einmal (409 mit `"reason":"version"`). Der Kurzbefehl läuft in diesem Fall **weiter** – er verlangt nur,
dass überhaupt eine Einwilligung vorliegt, und bricht dir die nächtliche Übertragung nicht wegen einer
Textänderung ab.

Die übrigen Fehlerfälle: **401** = Schlüssel fehlt oder ist ungültig (in der App neu erzeugen),
**429** = mehr als 60 Übertragungen pro Stunde.

---

## 2. Von Hand (ohne Einrichtung)

Im selben Sheet unten: Text einfügen oder Datei hochladen. Erwartet wird

```json
{"days":{"2026-06-01":{"weight":75.5,"steps":8200,"sleep":7.5}}}
```

Auch eine einfache Zeilenliste `2026-06-01, 75.5, 8200, 7.5` (Datum, Gewicht, Schritte, Schlaf)
wird akzeptiert, ebenso die große `Export.xml` aus „Alle Gesundheitsdaten exportieren".

Auch dieser Weg braucht deine Einwilligung (siehe oben). Hier siehst du den Hinweis aber sofort auf
dem Bildschirm – nichts scheitert still. Das ist der Weg, mit dem du nach der Zustimmung die Tage
nachträgst, die der Kurzbefehl in der Zwischenzeit nicht loswerden konnte.

---

## Warum kein „richtiger" Hintergrund-Sync?
Apple gibt Gesundheitsdaten aus Datenschutzgründen nur an native iPhone-Apps heraus, nicht an
Webseiten. Eine eigene iOS-App bräuchte einen kostenpflichtigen Entwickler-Account und ein
App-Store-Verfahren. Der Weg über Kurzbefehl + Automation liefert dasselbe Ergebnis – die Daten
sind morgens da – ohne diese Kosten.

## Android / andere Geräte
Health Connect (Google Fit), Fitbit und Garmin stehen in der App als „kommt bald". Diese Dienste
haben echte Web-Schnittstellen; sie lassen sich später ergänzen, ohne dass sich für dich an der
Bedienung etwas ändert – der Einlieferungsweg (`/api/health/push`) ist derselbe.
