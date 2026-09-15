# Excel-Import für Coaches

Coaches können bestehende Trainings- und Ernährungspläne aus einer Excel-Datei
(.xlsx) importieren, statt alles von Hand einzugeben.

> **Nur für Coaches.** Seit 2.6.0 ist der Betreiber (Admin) kein Coach mehr: für ihn sind die
> Coach-Funktionen einschließlich des Imports geschlossen. Wer beides sein will, braucht ein zweites
> Konto mit der Rolle `coach` (siehe SICHERHEIT.md Abschnitt 10).

## So geht's
1. Im Coach-Bereich einen Athleten öffnen → in dessen Menü die Zeile **„Aus Excel importieren"**.
2. Eine `.xlsx`-Datei wählen (**höchstens 6 MB**, sonst lehnt die App sie gleich ab).
3. Falls die Datei mehrere Tabellenblätter hat: das richtige auswählen.
4. **Typ wählen:** Training oder Ernährung.
5. **Spalten zuordnen:** Für jede Angabe (Übung, Sätze, …) die passende Spalte
   aus der Datei auswählen. Die App rät die Zuordnung automatisch anhand der
   Überschriften – einfach prüfen und ggf. korrigieren.
6. Die Vorschau zeigt die ersten Zeilen. Passt alles → **„Plan übernehmen"**.

## Format-Tipps
Das Format ist flexibel, aber am besten klappt es so:

**Training** – eine Zeile pro Übung, Spalten z.B.:
| Tag  | Übung        | Sätze | Wdh   | Gewicht | Notiz |
|------|--------------|-------|-------|---------|-------|
| Push | Bankdrücken  | 4     | 8-10  | 80      | RPE 8 |
|      | Schrägbank   | 3     | 10-12 | 30      |       |
| Pull | Klimmzüge    | 4     | max   | 0       |       |

- Die **Tag-Spalte** darf leer bleiben, solange dieselbe Einheit weiterläuft –
  leere Zellen werden automatisch dem zuletzt genannten Tag zugeordnet (so wie
  man Excel-Blöcke typischerweise schreibt).
- Nur **Übung** ist Pflicht. Alles andere ist optional; fehlt „Sätze"/„Wdh.",
  werden sinnvolle Standardwerte (3 Sätze, 8–12 Wdh.) gesetzt.
- Gewicht und Notiz landen als Hinweis bei der Übung.

**Ernährung** – eine Zeile pro Lebensmittel, Spalten z.B.:
| Mahlzeit   | Lebensmittel | Menge | kcal | Eiweiß | KH | Fett |
|------------|--------------|-------|------|--------|----|----|
| Frühstück  | Haferflocken | 80    | 300  | 10     | 54 | 6  |
|            | Magerquark   | 250   | 160  | 30     | 8  | 1  |
| Mittag     | Reis         | 100   | 350  | 7      | 77 | 1  |

- Nur **Lebensmittel** ist Pflicht.
- Beim Übernehmen wählst du, ob der Plan für **Trainings- oder Ruhetag** gilt.
- Zahlen dürfen Komma oder Punkt nutzen; Einheiten wie „g" werden ignoriert.

## Gut zu wissen
- Der Import **ersetzt** den bisherigen aktiven Trainingsplan (der alte bleibt
  in der Datenbank erhalten, nur nicht mehr aktiv) bzw. die Mahlzeiten des
  gewählten Tagtyps.
- Importierte Übungen sind als Coach-Vorgabe markiert.
- Der Athlet bekommt eine Nachricht und (falls aktiviert) eine Push-Mitteilung.
- Maximale Dateigröße: 6 MB.
- Die Excel-Bibliothek stammt seit 2.4.0 aus dem reparierten SheetJS-Paket (nicht aus dem
  npm-Paket `xlsx`) – der Grund steht in SICHERHEIT.md Abschnitt 9.
