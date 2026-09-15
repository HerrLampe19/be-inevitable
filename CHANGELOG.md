# Changelog

## 3.0.2

Die drei Kanten, die 3.0.1 beim Nachladen stehen gelassen hat.

3.0.1 hat den Trainings- und den Ernährungs-Reiter aus dem Startbündel geholt – 58 KB weniger beim
ersten Öffnen. Die Nachprüfung hat danach drei Stellen gefunden, an denen das im **ersten Moment
nach dem Start** anders aussieht als danach. Alle drei sind weg.

**Der Rhythmus-Chip öffnet wieder deinen Tag.** Tippst du auf „Do · Lower 1" oder auf die Karte mit
deinem letzten Training, kommt das Tages-Sheet – auch in der ersten Sekunde nach dem Start. Bis
3.0.1 sprang es in diesem Fenster auf den ganzen Monatskalender um, weil der Tages-Teil noch
unterwegs war. Gemessen: Sheet-Text 153 Zeichen wie immer, statt 463.

**„Ziel & Training" sagt jetzt Bescheid, statt still zu sterben.** Wenn die Verbindung beim
Nachladen abreißt, öffnete dieser Knopf im Profil gar nichts – kein Sheet, keine Meldung, zwei
Fehler im Hintergrund. Jetzt kommt derselbe Hinweis wie überall sonst: „Dieser Bereich braucht kurz
Verbindung". **Das Profil selbst öffnet dabei weiter** – Name, Abmelden und Einwilligung brauchen
den Trainings-Teil nicht und warten auch nicht mehr auf ihn.

**Das teure Fenster ist kürzer.** Die App holt Training und Ernährung 200 ms früher im Leerlauf
nach. Der Zeitraum, in dem ein sehr früher Tipp noch aufs Netz wartet, schrumpft von 1.470 auf
1.302 ms. Am Kaltstart selbst ändert das nichts: weiter 10 Anfragen und 134 KB.

| | 3.0.1 | 3.0.2 |
|---|---|---|
| Kaltstart, angemeldet, langsames Netz | 10 Anfragen · 134,1 KB · 1.301 ms | 10 Anfragen · 134,2 KB · 1.292 ms |
| Fenster, in dem ein Tipp aufs Netz wartet | 1.470 ms | **1.302 ms** |
| Rhythmus-Chip in der ersten Sekunde | Monatskalender | **dein Tag** |
| „Ziel & Training" ohne Verbindung | stumm, 2 Fehler | **Hinweis, 0 Fehler** |

## 3.0.1

Ein Kaltstart weniger auf dem Rücken.

Die Welle B-I hat viel gebracht – und den Start teurer gemacht: 3.0.0 lud beim ersten Öffnen
**191,9 KB** statt der 178 KB von 2.9.0. Die Verträge waren eingehalten, die eigene Grundlinie nicht.
Ursache war kein Leichtsinn, sondern Arithmetik: der Trainings- und der Ernährungs-Reiter lagen im
Startbündel, obwohl beim Öffnen der App **immer die Startseite kommt** – und die braucht von beiden
keine einzige Zeile.

Ab 3.0.1 werden sie nachgeladen, wie Analyse, Mindset, Coach und Suche seit 2.7.0. Was du merkst:

| | 3.0.0 | 3.0.1 |
|---|---|---|
| Erstes Öffnen, angemeldet, langsames Netz | 191,9 KB · 1.617 ms | **134,1 KB · 1.301 ms** |
| Erstes Öffnen, Anmeldeseite | 196,8 KB · 1.292 ms | **139,0 KB · 970 ms** |
| Anfragen | 10 | 10 |

Rund **eine Drittelsekunde** früher tippbar, bei jedem ersten Start auf jedem Gerät – und 58 KB
Mobilfunk, die niemand mehr bezahlt.

**Und warten musst du dafür nicht.** Eine Sekunde nachdem deine Startseite steht, holt die App beide
Reiter im Leerlauf nach – lange bevor ein Finger auf dem Bildschirm ist. Wer trotzdem schneller ist:
„Upper 1 starten", „Essen loggen", „Kalender" und das Profil funktionieren auch dann sofort und mit
**derselben Zahl Tipper** wie vorher. Sie holen sich ihren Teil dann eben im Moment des Tippens
(gemessene Obergrenze auf langsamem Netz: 0,3 Sekunden – einmalig, danach liegt alles im Cache).

Tiefe Links (`#workout`, `#diet`, `#tracker/woche/…`), der Offline-Start und die Umstellung eines
Browsers, der 3.0.0 im Speicher hatte, sind mitgeprüft: gleiche Zahl Tipper in allen zehn gemessenen
Wegen, keine Fehlermeldung in keiner Ansicht, keine Rolle, keine Bildschirmbreite.

## 3.0.0

Das ist die Version, mit der du startest – und deshalb fängt sie mit dem an, was beim Start mit
echten Nutzerdaten am meisten wehtut, wenn es fehlt.

### Die Sicherung, die niemand anstoßen muss

Bis 2.9.0 gab es genau **einen** Weg zu einer Kopie deiner Datenbank: den Knopf in der Verwaltung.
Ein Knopf, den ein Mensch drücken muss. Der wird gedrückt, solange man daran denkt – und dann nie
wieder. Mit echten Athletendaten ist das das größte Betriebsrisiko der ganzen App.

Ab jetzt läuft die Sicherung **nachts um 3 Uhr von selbst**: `VACUUM INTO` auf die Platte neben der
Datenbank, eine Zeile in `backups` mit **SHA-256 und Byte-Zahl**, und eine eigene Zeile im
Betriebsstreifen (`backup.auto`, Karenz 36 Stunden). Fällt eine Nacht aus, steht es am nächsten
Morgen dort. Und weil der Zeitgeber an den Minuten hängt, an denen der Prozess gestartet ist, gibt es
ein **Nachholfenster bis 6 Uhr**: ein Neustart um 03:10 kostet nicht die Sicherung dieser Nacht.

| Was | Wie | Gemessen |
|---|---|---|
| **Nächtlicher Lauf** | 3 Uhr Ortszeit, Nachholfenster bis 6, Merker je Tag | Mit gestellter Uhr: 22 Uhr → keine Datei · 3 Uhr → Datei, 596 KB, 33 ms · 4 Uhr desselben Tages → unverändert |
| **Platz prüfen, bevor geschrieben wird** | Datenbankgröße + 50 MB Rest müssen frei sein | Reicht es nicht, entsteht **keine** halbe Datei, sondern eine Zeile mit `ok=0` und dem Grund. Render-Disks sind klein. |
| **Aufbewahrung** | `settings.backup_keep_days`, Standard **14 Tage** | Mit `keep=1` und drei zurückdatierten Läufen: alte Dateien und Zeilen weg – **die jüngste brauchbare Sicherung bleibt immer stehen**, auch wenn sie 300 Tage alt ist. |
| **Wiederherstellungsprobe** | Knopf: jüngste Sicherung → Wegwerf-Datei → `PRAGMA integrity_check` → Zeilen je Tabelle gegen das Original | `integrity_check ok · 43 Tabellen · 1.669 von 1.671 Zeilen · 596 KB`. Die **laufende Datenbank wird dabei nicht angefasst** – die Probe öffnet eine eigene, nur lesende Verbindung auf die Kopie der Kopie. |

Art. 32 DSGVO verlangt zwei Dinge: die Fähigkeit zur Wiederherstellung **und** ihren regelmäßigen
Test. Die Probe hat deshalb eine eigene Zeile im Betriebsstreifen (`backup.verify`, Karenz 35 Tage).
„Überfällig" heißt hier: seit über einem Monat hat niemand geprüft, ob sich eine Sicherung überhaupt
zurückspielen lässt.

**Ein Fehler, der beim Bauen gefunden wurde und der es wert ist, hier zu stehen:** der Dateiname trug
den Zeitstempel bis auf die Sekunde. Zwei Läufe in derselben Sekunde ergaben denselben Namen,
`VACUUM INTO` verweigerte mit „output file already exists" – und der Aufräumer im Fehlerzweig löschte
danach die Datei, die schon da war. Ein **fehlgeschlagener Lauf hätte also die vorhandene, gute
Sicherung vernichtet**. Der Name ist jetzt garantiert neu, und der Fehlerzweig löscht nur, was der
Lauf selbst angelegt hat.

Was die nächtliche Sicherung **nicht** tut: sie schickt keine Nachricht an die Konten. Der
Download-Knopf tut das weiterhin, denn dort zieht der Betreiber eine vollständige Kopie auf seine
Maschine. Die nächtliche Datei bleibt auf demselben Server unter demselben Verantwortlichen – 14
Systemnachrichten pro Nacht wären kein Datenschutz, sondern Lärm.

### Die Übungsbibliothek – gegen vier Beinpressen mit vier Bestwerten

In deinem echten Plan liegen **vier Übungen doppelt**: „Leg Press" und „Beinpresse" sind für die App
zwei verschiedene Bewegungen, weil der Verlauf über den Namen gruppiert. Jede hat ihre eigene
Bestleistung, ihre eigene Empfehlung, ihre eigene Kurve. Das repariert man nicht hinterher, sondern
beim Tippen.

Neu ist ein **Nachschlagewerk mit 70 Grundübungen**, deutsch als Anzeigename, englisch und die
gängigen Kurzformen als Schreibweisen daneben. Die Suche ist **umlautfest** – dasselbe Verfahren wie
bei der Lebensmittelsuche seit 2.5.0, plus Satzzeichen, weil Übungen „Beinpresse 45°" heißen.

| Getippt | Gefunden |
|---|---|
| `beinpresse` · `leg press` · `legpress` | **Beinpresse** [Quadrizeps] |
| `bankdrucken` (ohne Umlaut) · `BANKDRÜCKEN` | Bankdrücken, Schrägbankdrücken, Negativbankdrücken, … (7 Treffer) |
| `schraegbank` | Schrägbankdrücken, Schrägbankdrücken (Smith), Kurzhantel-Schrägbankdrücken |
| `hueftstoss` | **Hüftstoß** [Gesäß] |

Beim Anlegen sagt die App, was schon da ist – **bevor** die Dublette entsteht: *„Meinst du
‚Beinpresse'? Die hast du schon – Probe-Tag, 27 geloggte Sätze."* Sie verbietet nichts. Du
entscheidest (P10). Und der Katalog zieht beim Start die Übungen nach, die in dieser Datenbank schon
in Plänen stehen – von 17 verschiedenen Namen fielen 14 unter einen vorhandenen Eintrag, drei kamen
dazu.

Dazu zwei Spalten, die seit 2.6.0 in der Datenbank stehen und **null Treffer im Code** hatten:

- **`replaces_id` – Übung tauschen.** Der Slot bleibt (gleicher Tag, gleiche Position), der
  Vorgänger bleibt verknüpft. Der Plan zeigt „früher: Leg Press", der Übungsverlauf zeigt die alte
  Kurve **daneben** und nicht darin: eine Beinpresse ist keine Kniebeuge, und die alten Sätze unter
  dem neuen Namen wären eine Bestleistung, die nie stattgefunden hat. Die Muskelgruppe füllt der
  Katalog automatisch. Gemessen: getauscht, Position 2 blieb Position 2, 54 alte Sätze blieben
  sichtbar.
- **`group_id` – Supersätze.** Eine Marke auf mehreren Übungen desselben Tages: sie gehören zusammen,
  dazwischen wird nicht pausiert. Eine Übung ist in höchstens einer Gruppe, `dissolve` löst sie auf.

### Dein Kalorienziel ist ab jetzt eine Messung, keine Formel

Bis 2.9.0 kam dein Ziel aus einer Formel: Größe, Gewicht, Alter, Ziel, Trainingstage rein, Zahl raus.
Eine gute Startzahl – aber sie kennt weder deinen Stoffwechsel noch das, was du wirklich isst. Beides
liegt seit Jahren in der Datenbank: Gewicht aus den Check-ins, Kalorien aus dem Essprotokoll.

Der Sonntags-Lauf rechnet daraus deinen **gemessenen Verbrauch** und macht daraus einen Vorschlag mit
**einem Satz Begründung**:

> „Dein gemessener Verbrauch liegt bei 2.510 kcal – 100 kcal weniger, also 2.820 kcal am Tag. Mehr
> als 100 kcal ändere ich in einer Woche nicht."

Drei Regeln, und sie sind der ganze Unterschied zu „die App dreht an deinem Essen":

1. **Standard ist `formel`:** es wird gerechnet, aber **nichts geändert**. Der Vorschlag liegt da und
   wartet auf „Übernehmen" oder „Behalten". Gemessen: nach dem Lauf standen im Profil unverändert
   3.017/2.600 kcal.
2. **`adaptiv` schaltest nur du selbst** – nicht dein Coach. Hast du einen Coach, **wartet die
   Anpassung auf seine Freigabe**; er bekommt eine Nachricht, und erst nach seinem Tipp stehen die
   neuen Zahlen im Profil (gemessen: 2.920 → wirkt nicht → Freigabe → 2.820).
3. **Zu wenig gelogged heißt: gar nichts.** Unter vier Logtagen sagt die App es im Klartext („Nur 0
   von 7 Tagen protokolliert – ich lasse dein Ziel stehen.") und rührt das Ziel nicht an. Eine
   Anpassung auf dünner Datenlage ist schlimmer als keine.

**Alles ist widerrufbar.** Jede Zieländerung steht als eigene Zeile in `target_history` – auch die
von Hand und die des Coachs. Und weil „Widerrufen" ein Ziel braucht, auf das es zurückgeht, bekommt
der **Ausgangswert** beim ersten Übernehmen eine eigene Zeile: gemessen 3.017 → 2.920 → Widerruf →
**wieder 3.017**. Ohne diese Zeile lief der Widerruf ins Leere – gefunden beim Bauen, behoben.

Die Auskunft steht in `GET /api/targets/:userId`; „Übernehmen", „Behalten" und „Widerrufen"
bestätigen nur die Zahlen (`kcal, protein, carbs, fat, source, reason, week_start, id`). Eine
Bestätigung schickt keine ganze Ansicht mit – sonst reist der Hinweistext „Startwert – trag deine
Größe ein …" durch jede Antwort, und genau das war er auch, bis es jemandem auffiel.

### Der Wochenbericht: eine Rechnung, zwei Tonlagen

`GET /api/weekreport/:userId` – für dich der Rückblick, für deinen Coach die Review-Inbox, aus
**denselben** Zahlen. Bis 2.9.0 lasen beide Seiten für dieselbe Woche verschiedene Zahlen; das stand
sogar als Kommentar im Code. Jetzt entscheidet die Rolle nur noch über die **Worte**:

| | Athlet | Coach |
|---|---|---|
| Überschrift | „Deine Woche steht: 4 von 4 Einheiten." | „Marco Munsch: 4/4 Einheiten, 5/7 Tage geloggt" |
| Ernährung ohne Eintrag | „Diese Woche noch nichts gelogged – die Ernährungszahlen bleiben deshalb leer." | „Kein einziger Logtag – zur Ernährung lässt sich diese Woche nichts sagen." |
| Name im Payload | **nein** (du weißt, wie du heißt) | ja |

Gemessen: `compliance`, `training`, `nutrition`, `body` sind in beiden Antworten Zeichen für Zeichen
gleich. Und jede Antwort trägt einen Satz, **woher die Zahlen kommen** (P3): „Einheiten = Tage mit
mindestens einem Arbeitssatz. Logtage = Tage mit mindestens einem Eintrag im Essprotokoll."

### Pivot: die heutige Einheit ändern, ohne die Vorlage zu zerschießen

Die meistgenannte Beschwerde in 98 geprüften Coach-Rezensionen. Du stehst im Studio, die Beinpresse
ist belegt, das Knie zwickt, du hast 40 statt 70 Minuten – und der einzige Weg, die Einheit zu
ändern, war bisher, **die Vorlage** zu ändern. Nächste Woche war sie dann auch geändert, und niemand
wusste mehr, warum.

`POST /api/session-override` schreibt **eine Zeile für diesen einen Tag**. Die Vorlage wird nicht
angefasst; zurücknehmen heißt, die Zeile zu löschen – danach gilt wieder der Rhythmus, ohne
Wiederherstellen, ohne Papierkorb. Du liest die Zeile:

> **Heute geändert: Ruhetag – weil dein Knie – heute nur Mobility**

Trägt es jemand **anderes** ein, ist die Begründung **Pflicht** (400 ohne) und du bekommst eine
Nachricht. Für dich selbst darf sie fehlen. Nur für heute oder morgen – alles weitere ist Planung und
gehört in den Plan.

### Der Tag, der für dich gilt

`users.tz` steht seit 2.6.0 in der Datenbank und wurde **nie gelesen**. Der Server kannte genau einen
Tag: den Berliner. Für dich in Wien stimmt das. Für einen Athleten weiter östlich fällt ein Eintrag
um 00:30 Ortszeit auf den Vortag – die Serie zählt ihn für gestern, die Wochenkonsistenz verschiebt
sich um einen Tag.

Ab jetzt gibt es genau eine Stelle für „welcher Tag ist das für **diesen** Menschen": `userToday`,
`userWeekStart`, `userHour`. Sie tragen den Standardtag von `/api/today`, `/api/foodlog`,
`/api/readiness`, `/api/supplement-intake`, den Wochenbeginn von `/api/week`, die Zukunftsprüfung von
Check-in, Essprotokoll und Cardio – und im Stundentakt die Erinnerungsstunde und den Merker je Tag.

Gemessen mit gestellter Uhr, **ein** Tick am 15.09. um 13:00 UTC (Berlin 15:00 am 15., Auckland 01:00
am **16.**):

| | Merker nach dem Tick |
|---|---|
| Athlet in Auckland, Wunschstunde 1 Uhr | `remind_2 = 2026-09-16` |
| Athlet in Berlin, Wunschstunde 15 Uhr | `remind_7 = 2026-09-15` |

Der Abend-Hinweis hatte dabei zuerst noch einen Rahmen auf der Serverstunde („18 bis 23 Uhr"). Beim
Messen fiel auf: 19 Uhr in Auckland sind 9 Uhr in Berlin – dieser Athlet hätte den Hinweis **nie**
bekommen. Der Rahmen ist weg; entschieden wird je Athlet auf seiner Ortsstunde.

Eine unbekannte Zone fällt still auf Europe/Berlin zurück, und **nichts wird rückwirkend
verschoben**: gespeicherte Daten bleiben, wie sie eingetragen wurden. Die Vergangenheit umzuschreiben
wäre eine Fälschung – und in der Serie sichtbar.

### Die Coach-Liste macht nicht mehr 170 Abfragen

`GET /api/athletes` fragte pro Athlet rund zwölfmal die Datenbank: letzte Aktivität, letztes Gewicht,
Ampel, Wochenziel, Rhythmus. Bei 14 Athleten waren das **170 Abfragen**. Bei 50 wären es über 600 –
im selben Thread, der gerade die Satzzeile eines anderen speichert.

| | vorher | nachher |
|---|---|---|
| Abfragen (14 Athleten) | 170 | **11** |
| Antwortzeit (Median aus 25 Läufen) | 10,75 ms | **4,76 ms** |
| Antwort | | **Zeichen für Zeichen identisch** |

Die Rechnung ist Zeile für Zeile dieselbe geblieben: `athleteAttention` und `athleteWeekGoal` sind
weiter die **eine** Quelle für die Ampel, sie bekommen ihre Werte jetzt nur vorab gereicht statt sie
einzeln zu holen. Wer sie ohne diese Werte aufruft, bekommt exakt dasselbe Ergebnis – nur teurer.

### Nachgebessert vor der Auslieferung (Server)

Fünf unabhängige Prüfer sind über diese Version gegangen, bevor sie ausgeliefert wurde. Was sie
gefunden haben, steht hier – nicht weil es schön aussieht, sondern weil eine Version, die verschweigt,
was an ihr zuletzt noch falsch war, beim nächsten Mal genau denselben Fehler macht.

**Die Sicherung, die ihre letzte Sicherung löschte.** Die Regel „die jüngste brauchbare Sicherung
bleibt immer stehen" schaute nur in die Tabelle, nicht ins Verzeichnis. Gemessen: eine 20 Tage alte
Zeile **mit** Datei wurde gelöscht, weil eine jüngere Zeile **ohne** Datei als „die jüngste" galt –
danach lag keine einzige Sicherung mehr auf der Platte. Geschont wird jetzt die jüngste Zeile, deren
Datei wirklich da ist. Dazu kommt ein **Abgleich zwischen Verzeichnis und Tabelle** beim Start, bei
jeder Betriebsansicht und vor jeder Probe: eine Datei ohne Zeile wird nachgetragen (mit frisch
gerechneter Prüfsumme), eine Zeile ohne Datei auf `ok=0` gesetzt. Das repariert zugleich den Fall,
der nach einer **echten Wiederherstellung** auftrat – die Zeile wird nach dem `VACUUM INTO`
geschrieben und steht deshalb nie in der Datei, die sie beschreibt; die Probe meldete rot, genau
wenn das Zurückspielen geklappt hatte.

| Befund | Vorher | Jetzt |
|---|---|---|
| Aufbewahrung löscht die letzte vorhandene Datei | `pruned: 1`, Verzeichnis leer, Probe rot | `pruned: 0`, Datei da, Probe grün |
| Nach der Wiederherstellung ist die Datei eine Waise | `filesOnDisk: 1`, keine Zeile, Probe rot | Zeile nachgetragen (`kind='gefunden'`), Probe grün |
| Die Probe überschrieb die Notiz des Laufs, den sie prüft | „geschrieben in 412 ms" war weg | die Probe schreibt nur in ihre **eigene** Zeile |
| Ohne Prüfsumme prüfte die Probe nichts und meldete grün | stilles Überspringen | Prüfsumme wird nachgetragen, und die Notiz sagt „ohne Vergleich – die Sicherung kam ohne Prüfsumme" |
| Die Wegwerf-Kopie blieb liegen, wenn das Kopieren scheiterte | halbe Datenbankkopie im Verzeichnis | aufgeräumt, auch im Fehlerzweig – und `.probe-*`-Reste fliegen beim nächsten Lauf mit raus |
| Der Dateiname trug UTC, der Job läuft in Ortszeit | Lauf um 03:30 → `…T01-30-35-auto.db` | `…T03-30-35-auto.db` (ohne Zeitzone gibt es ein `Z` dazu) |
| Die 10-Minuten-Sperre überlebte keinen Neustart | nach jedem Start wieder frei | liest die Laufzeit aus der Tabelle, wie der Download-Knopf seit 2.8.0 |
| `backups/` stand nicht in `.gitignore` | Vollabzüge auf dem Weg nach GitHub | steht drin – **und** der Server warnt beim Start, wenn der Ordner im Projektverzeichnis liegt |

**Das Kalorienziel hatte vier abgeschaltete Schutzregeln.** Der Wochenlauf übergab dem Rechenkern
vier von acht Werten. Jeder fehlende Wert schaltete stillschweigend eine Regel ab, die die App
verspricht:

* Ohne den **Formelwert** war die 35-%-Plausibilitätsschranke toter Code. Gemessen: gemessene
  1.890 gegen gerechnete 3.017 kcal (37 % auseinander, weil an fünf von sieben Tagen nur ein Teil des
  Essens protokolliert war) – das Ziel fiel Woche für Woche um 100 kcal. Jetzt: „Gemessen komme ich
  auf 1.890 kcal Verbrauch, gerechnet auf 3.017 – das liegt zu weit auseinander. Wahrscheinlich
  fehlen protokollierte Mahlzeiten. Dein Ziel bleibt, wie es ist."
* Ohne die **Untergrenze** aus `nutritionPlan` galt nur die harte Kante von 1.200 kcal. Gemessen über
  zwölf Wochenläufe: 2.200 → 2.100 → 2.000 → 1.900 → **1.500** bei einer eigenen Untergrenze von
  1.818, und ohne den Satz „Weiter runter geht dein Ziel nicht". Jetzt endet dieselbe Bahn bei 1.818.
* Ohne die **Trainingstage** rechnete der Zielfaktor für jeden Athleten mit vier Einheiten. Gemessen
  bei 3.000 kcal Verbrauch: 2 Einheiten 3.210 · 4 Einheiten 3.270 · 6 Einheiten 3.330 – wer sechsmal
  trainiert, lag dauerhaft 60 kcal zu tief.
* Ohne den **Gewichtstrend** fiel der Begründungssatz immer auf den Verbrauchszweig. „Dein Gewicht
  ist 3 Wochen gleich geblieben – 40 kcal weniger" konnte gar nicht entstehen. Jetzt schon.

Dazu drei weitere Stellen an derselben Rechnung: `holding` griff nicht, weil das Fenster still auf
den letzten Tag **mit Daten** rutschte – wer eine Woche nichts einträgt, bekam eine Anpassung auf
Daten der Vorwoche statt „Nur 0 von 7 Tagen protokolliert – ich lasse dein Ziel stehen". Ein
Vorschlag, dessen **Makros das eigene Kalorienziel übersteigen** (gemessen: 1.300 kcal Ziel,
172 g Eiweiß + 84 g Fett = 1.444 kcal), wird nicht mehr als Vorschlag hingelegt. Und das
**Ruhetagsziel** folgt wieder dem Verhältnis der eigenen Tabelle statt einem eingefrorenen absoluten
Abstand: 2.920 kcal Trainingstag ergeben 2.738 statt 2.503.

**Wer über dein Essen entscheidet.** Die Karte sagt dem Coach „der Vorschlag wartet auf ihn, nicht
auf dich" – der Server nahm seine Entscheidung trotzdem an. Gemessen: Ziel fiel von 3.173 auf 3.080,
der Athlet las „Dein Coach hat die Anpassung freigegeben." Jetzt antwortet die Route mit „Diese
Entscheidung gehört dem Athleten", solange sie nicht wirklich auf eine Freigabe wartet.

**Drop-Sätze sind keine Bestleistung.** Ein Drop-Satz ist per Definition ein Satz **nach** dem
Versagen mit reduziertem Gewicht. Er zählte als „bester Arbeitssatz": gemessen stand ein Drop-Satz
230 kg × 10 als „230,0 kg Bestleistung · e1RM 306,7 kg" in der Analyse, in der PR-Feier nach dem Satz
und in der Best-Zeile der Plan-Karte. Ab jetzt gibt es zwei Regeln statt einer – **zählbare Arbeit**
(Sätze, Tonnage, Volumen: Drop- und Backoff-Sätze zählen mit, gehobene Kilos sind gehobene Kilos) und
**rekordfähig** (Bestleistung, e1RM, „Neuer Rekord": nur Arbeitssätze).

**Was sonst noch auseinanderlief:**

| Befund | Jetzt |
|---|---|
| Startseite und Trainingsansicht zeigten zwei verschiedene Tage | `/api/home` rechnet „heute" in der Zeitzone des Athleten, wie `/api/today` es längst tat. Gemessen mit `Pacific/Kiritimati`: beide sagen 2026-09-16. |
| Der Pivot war für den Athleten unsichtbar, das Kalorienziel sprang trotzdem | Der Override zieht jetzt auch die Tagesvorschau (`preview[0]`) mit – die Quelle, aus der die Startseite ihren Tag liest. |
| Übungsnamen aus fremden Plänen standen im Katalog aller | Der Import schreibt die Besitzer-Id mit, vorhandene Zeilen wurden einmal nachgezogen. Gemessen mit „Reha rechte Schulter Dr. Weber": sichtbar **nur** für den Besitzer – nicht für andere Athleten, nicht für fremde Coaches, nicht für den Admin. |
| Wer deutsch tippte, bekam keinen Dublettenhinweis | Die Schlüsselmenge kommt jetzt aus **allen** Katalogeinträgen, die sich mit dem getippten Namen überschneiden. „Schrägbankdrücken" findet dieselben zwei Plan-Zeilen wie „Incline Smith Machine Press". |
| Im Wochenbericht gingen zwei von drei Spitzenplätzen an dieselbe Übung | Verdichtet über den normalisierten Namen – und die Rekorde kommen zusätzlich als **Liste** (Übung, Datum, alter Bestwert, Gewicht × Wdh.), nicht nur als Zahl. |
| „Übung tauschen" umging die Coach-Sperre, die Ändern und Löschen erzwingen | 409 mit demselben Satz wie beim Löschen; mit `confirm:true` geht es weiter. |
| Ein Supersatz ließ verwaiste Ein-Mann-Gruppen zurück | Dieselbe Transaktion zählt die verlassene Gruppe nach und löst sie auf, wenn weniger als zwei übrig sind. |
| Vier Rechenkern-Funktionen hatten null Aufrufe | `calibrationState` und `divergence` hängen an der Bereitschaft, `e1rmSeries` und `deloadHint` am Übungsverlauf, `localHour` an der Ortsstunde. Damit gilt überall die Fassung, die mit 20.000 Zufallsläufen belegt ist – und nicht mehr zwei Zahlen für dieselbe Regel (Selbstbericht-Alarm ab 2 Tagen, nicht ab 3). |

### Zum Nachprüfen

| Prüfung | Ergebnis |
|---|---|
| `tools/roles.mjs` (208 Routen × 6 Rollen) | **grün** – 0 Abweichungen, 0 Lecks, 0 Zellen mit Personendaten für die falsche Rolle, 0 Routen außerhalb der Erwartungstabelle. Alle **19 neuen Routen** stehen mit Begründung in `tools/ROUTEN-PERSONENBEZUG.md` (Nr 193–211). |
| Keine der 19 neuen Routen ohne Anmeldung | die sieben öffentlichen Wege bleiben unverändert sieben |
| Start gegen eine Kopie der **echten** Datenbank | 9 neue Tabellen, 13 neue Spalten in `users`, **keine Tabelle mit weniger Zeilen** als vorher; zweiter Start: Zeilen und Spalten identisch |
| `dup_check.py`, `static_check.py` | sauber |

## 2.9.0

Diese Version beantwortet eine Frage, die in jeder App irgendwann kommt und auf die BE INEVITABLE
bisher nur eine peinliche Antwort hatte: **„Kannst du das eben abstellen?"**

Bis 2.8.0 lautete die Antwort: nein, nicht eben. Jede Einstellung – ob sich jemand anmelden darf, ob
die KI-Auswertung läuft, ob ein Hinweis oben steht – war eine Umgebungsvariable. Sie zu ändern hiess:
neu ausliefern. Auf Render sind das ein paar Minuten, in denen die App nicht da ist. Für eine
Entscheidung, die eine Sekunde dauert.

Ab 2.9.0 gibt es dafür **drei Schalter und zwei Handgriffe in der Verwaltung**. Die drei Schalter
tragen einen Zustand (`settings`: `ops.registration`, `ops.ai`, `ops.notice`) und wirken in derselben
Sekunde, in der du sie umlegst – kein Neustart, kein Deploy, keine Wartezeit. Die zwei Handgriffe
(Mailversand prüfen, Wochen-Job nachholen) legt man nicht um: sie lösen etwas aus (`POST
/api/admin/mailcheck`, `POST /api/admin/weekly`) und merken sich keinen Zustand. Sie stehen in
derselben Liste, weil man sie an derselben Stelle braucht.

### Die drei Schalter und die zwei Handgriffe (Verwaltung → Betrieb)

| Schalter / Handgriff | Was er kann | Gemessen |
|---|---|---|
| **Registrierung** | offen · nur mit Code · geschlossen | Auf „geschlossen" antwortet `POST /api/register` mit **403** und dem Klartext „Die Registrierung ist derzeit geschlossen" – auch mit gültigem Code. Zurück auf „offen": die nächste Anmeldung kommt durch. |
| **KI-Analyse** | Not-Aus für den ganzen Betrieb | Mit Not-Aus antwortet `POST /api/ai/summary/:userId` **503** „vom Betreiber vorübergehend abgeschaltet" – auch bei Athleten, die zugestimmt haben. Der Schlüssel bleibt gesetzt, es geht nichts verloren. |
| **Wartungshinweis** | eine Zeile für alle | Kein Wartungsmodus: **niemand wird ausgesperrt**. Der Server gibt den Text über `/api/notice` und die Auskunft der Anmeldeseite heraus. |
| **Mailversand** *(Handgriff)* | Zustand · SMTP-Selbsttest · Testmail | Der **Selbsttest** baut die Verbindung auf und meldet grün/rot, **ohne eine Mail zu verschicken** – zwei Sekunden statt „schau mal ins Postfach". Die Testmail prüft danach den ganzen Weg. |
| **Wochen-Job** *(Handgriff)* | Zustand · letzter Lauf · jetzt nachholen | Das Nachholen von Hand trägt sich jetzt in **dieselbe Zeile** ein wie der Sonntagslauf. Vorher stand der Job nach erfolgreichem Nachholen weiter auf „überfällig". |

Jedes Umlegen eines der drei Schalter schreibt eine Zeile ins Protokoll (`ops.set`, mit Vorher und
Nachher); die beiden Handgriffe schreiben `mail.check`/`mail.test` bzw. `job.weekly.run`. Beim
Wartungstext steht der Text **nicht** im Protokoll, nur seine Länge – `audit` nimmt keinen Freitext
auf, und diese Regel gilt auch für den Betreiber selbst.

Zwei Dinge, die der Schalter absichtlich **nicht** tut:
- **„Nur mit Code" lässt sich nicht wählen, solange `REGISTER_CODE` fehlt.** Das wäre eine Tür ohne
  Schlüssel – in Wahrheit „geschlossen", in der Anzeige „Code". Die Route lehnt es mit Klartext ab.
- **Solange niemand am Schalter gedreht hat, entscheidet weiter die Umgebungsvariable.** Eine
  bestehende Installation mit `REGISTER_CODE` ändert durch dieses Update ihr Verhalten nicht.

### Die Läufe zeigen jetzt, was sie tun

Bis 2.8.0 trugen sich genau **zwei** wiederkehrende Läufe in die Betriebsansicht ein: der
Stundentakt und das tägliche Aufräumen. Das Problem daran sieht man erst, wenn etwas schiefgeht:
fällt ein einzelner Teilschritt aus – die Sonntags-Nachricht, die Erinnerungen, der Mindset-Lauf –,
stand der Zeitgeber trotzdem auf „läuft". Der äußere Lauf kam ja durch.

Jetzt hat jeder Teil seine eigene Zeile mit eigener Karenz: **acht statt zwei**.

| Lauf | Takt | Karenz |
|---|---|---|
| Zeitgeber | stündlich | 2,5 Std. |
| Wochen-Rückblick (Nachricht **und** Mail) | wöchentlich | 8 Tage |
| Trainings-Erinnerung | stündlich geprüft | 36 Std. |
| Abend-Hinweis (Wochenpensum) | abends 19–21 Uhr | 36 Std. |
| Mindset-Erinnerungen | täglich | 36 Std. |
| Aufräumen (WAL, Tokens, Teilen-Links) | stündlich | 2,5 Std. |
| Aufbewahrung (Protokoll/Fehler) | täglich | 36 Std. |
| Letzte Sicherung | von Hand | 7 Tage |

Die letzte Zeile ist kein Lauf, sondern dein Handgriff – sie steht trotzdem dabei, weil sie das ist,
was am ehesten vergessen wird. „Überfällig" heisst dort: die letzte Kopie ist älter als eine Woche.

### Was sonst noch aufgeräumt wurde

- **Die Filter im Protokoll sieben jetzt auf dem Server.** Die Verwaltung schickte Zeitraum, Handlung
  und Akteur seit 2.6.0 mit – die Route hat sie ignoriert und immer die letzten 100 Zeilen geliefert,
  die der Browser danach durchsuchte. Bei vollem Puffer fand ein Filter auf eine **seltene** Handlung
  deshalb nichts, obwohl es Treffer gab: sie lagen hinter den 100. Gemessen an 109 Zeilen: Filter auf
  `ops.set` liefert jetzt **6 von 6** statt der zufälligen Treffer im gelesenen Fenster. Der Akteur
  wird über sein Kürzel aufgelöst; ein Kürzel, das es nicht gibt, sagt das ausdrücklich –
  „kein Treffer" und „gibt es nicht" sind zwei verschiedene Antworten.
- **Dasselbe für die Fehlerliste.** `?hours=24` schickte die Überschrift „Fehler der letzten
  24 Stunden" mit; geliefert wurde der ganze Ringpuffer. Die Überschrift log.
- **Die 10-Minuten-Sperre der Sicherung überlebt einen Neustart.** Sie war ein Zeitstempel im
  Arbeitsspeicher; nach jedem Neustart war sie weg, und ein `VACUUM INTO` über die ganze Datenbank
  liess sich beliebig oft auslösen. Gemessen: Sicherung gezogen → zweiter Versuch 429 („noch 600 s"),
  Server neu gestartet → immer noch 429 („noch 579 s").
- **„Erledigt" erreicht jetzt auch den Athleten.** Wer „Knie zwickt beim Beugen" meldet, erfuhr bisher
  nie, dass sein Coach es gesehen hat: die Route setzte nur das Häkchen. Jetzt bekommt er eine
  Systemnachricht *„Dein Coach hat deine Rückmeldung zu ‚Kniebeuge' gesehen und als erledigt
  markiert. Wenn sich nichts geändert hat, meld dich einfach noch einmal."* Nur beim echten
  Schließen – ein zweites Abhaken derselben Notiz schickt nichts (gemessen: `athleteNotified:false`).
  Wer keine Antwort bekommt, meldet beim nächsten Mal nichts mehr; das war der eigentliche Schaden.

### Eine Streak-Mechanik statt drei – und keine Drohung mehr

Bis 2.8.0 liefen drei Zählungen nebeneinander: die **Tages-Serie** („31 Check-ins in Folge"), die
**Wochenziel-Serie** und die **Joker-Buchhaltung**. Drei Zahlen über dieselbe Frage – und die
lauteste davon bestrafte genau das, was ein Trainingsplan ausdrücklich vorsieht: Ruhetage.

Ab 2.9.0 gibt es **eine** Aussage, die **Wochen-Konsistenz**:

* offen: „**1 von 4 geplanten Einheiten** · Noch 3 Einheiten – ein Fehltag ändert daran nichts."
* erfüllt: „**Woche geschafft · 4 von 4 Einheiten** · 3 Wochen in Folge"

Umgestellt, nicht danebengestellt: Die Startseite, der Sonntags-Rückblick (`weekHighlights` sagt jetzt
„N Wochen in Folge dein Pensum getroffen" statt „31 Tage Serie ohne Unterbrechung") und die
Abend-Mitteilung rechnen aus **derselben** Funktion. **„Streak-Joker" heißt ab jetzt überall
„Reparatur"** – Pille, Sheet, Ring, `aria-label`, die Verwaltung und die Push, die der Server
verschickt.

Und die Drohung ist weg. Bis 2.8.0 schickte der Server abends *„🔥 Deine Streak ist in Gefahr! – N
Tage in Folge, logge heute kurz etwas, damit die Serie nicht reißt."* – an **alle** Athleten, auch an
die, die im Profil „Trainings-Erinnerung: Aus" gewählt hatten. An derselben Stelle steht jetzt ein
ruhiger **Abend-Hinweis**: nur mit gesetzter Erinnerungs-Uhrzeit, nur wenn das Wochenpensum heute
**noch erreichbar** ist, und im Ton der einen Mechanik – „Noch 2 von 4 Einheiten – dafür hast du noch
3 Tage. Ein Fehltag ändert daran nichts."

### Die Trainings-Erinnerung nagt nicht mehr endlos

Wer aufgehört hat, bekam bis 2.8.0 an **jedem** Trainingstag „Heute ist Trainingstag! 💪" – für
immer. Der Lauf kannte nur zwei Fragen: „ist die Wunschstunde erreicht?" und „gibt es heute einen
Eintrag?". Die Frage „wann war der letzte Eintrag überhaupt?" stellte er nie. Der einzige Ausweg war,
Push ganz abzuschalten – und damit auch die Nachrichten des Coachs zu verlieren.

Jetzt entscheidet eine **Wiederkehr-Leiter** (`logic.js/reminderLadder`), was ein stilles Konto hört:

| Tage ohne Eintrag | Was kommt |
|---|---|
| 1–4 | die gewohnte Trainings-Erinnerung zur Wunschstunde |
| **5** | „Fünf Tage Pause – ein Check-in dauert 20 Sekunden." |
| **10** | „Alles in Ordnung? – schreib deinem Coach kurz, was los ist." |
| **14** | „Plan pausieren?" – **ab hier schweigt die tägliche Erinnerung** |
| 15–29 | noch **einmal pro Woche** (Tag 21, 28) |
| **ab 30** | Stille |

Dazwischen: nichts. Keine Schuld-Töne, keine Streak-Drohung. Jede Sprosse geht höchstens einmal am
Tag raus (Dedup über `ladder_<id>`), und wer keine Erinnerungs-Uhrzeit gesetzt hat, bekommt gar
nichts.

### Der Trichter vor der Schleife: erst installieren, dann fragen

In beiden Datenbanken standen **null** Push-Abos. Auf dem iPhone gibt es Web-Push überhaupt nur für
die **installierte** App – ohne Installation läuft die ganze Gewohnheits-Schleife nie an. Die
Reihenfolge ist deshalb bindend: **installieren → fragen → erinnern.**

- **Installations-Trichter.** Eine ruhige Karte kommt erst, wenn vier Dinge zutreffen: eigenes
  Athleten-Konto, die App läuft **nicht** als installierte PWA, das **erste Training ist
  abgeschlossen**, und in den letzten 30 Tagen wurde sie nicht weggetippt. **Kein Banner beim ersten
  Start** – das ist strukturell ausgeschlossen, nicht nur zeitlich verzögert. Das Sheet zeigt drei
  Bilder als Inline-SVG (im Flugmodus da) und den Weg für das jeweils andere System.
- **Gefragt wird in der App, nicht im Systemdialog.** Nach dem ersten gespeicherten Check-in fragt die
  App „Soll ich dich an Trainingstagen um 18 Uhr erinnern?" mit **Ja · Andere Zeit · Nein**. Erst ein
  „Ja" öffnet den Systemdialog – ein abgelehnter Systemdialog ist auf iOS endgültig. „Andere Zeit"
  zeigt elf Stunden-Chips **vor** dem Dialog. „Nein danke": 30 Tage Ruhe.
- **Erinnerungs-Center** im Profil (Profil → Erinnerungen): jede Push-Art mit ihrem Zeitfenster,
  Test-Mitteilung mit Zeitstempel, Trainings-Erinnerung jetzt **6–20 Uhr** statt 5–12 (wer abends
  trainiert, war vorher nicht erreichbar). Fünf Push-Arten waren bis 2.8.0 unsichtbar; sie stehen
  jetzt da – mit dem ehrlichen Satz, dass sie am Hauptschalter hängen und keinen eigenen haben.

### Arbeitsbreite: der Rechner ist kein großes Handy

Coach und Betreiber arbeiten am Rechner. Bis 2.8.0 bekamen sie dort eine **540 px breite
Handyspalte** mitten auf einem 1280-px-Schirm – rund 70 % der Fläche schwarz – und im ganzen Projekt
gab es **keine einzige** `:hover`-Regel.

Ab 1024 px gilt für **Coach und Verwaltung** ein echtes Arbeitslayout: linke Navigationsleiste statt
Leiste unten, Inhalt 720 px, und Sheets werden rechts zum **Inspektor-Panel** statt über allem zu
liegen. Gemessen ging `.app` in der Coach-Ansicht von `540 px` auf `1280 px` Breite.
**Die Athleten-Ansichten auf dem Handy sind unverändert** – alle fünf in der Probe byte-gleich.

Die Athletenliste wird dort zur **Tabelle**: `.ath-row` geht von `396 × 62 px` (drei Zeilen) auf
`568 × 22 px` – statt drei Athleten stehen dreizehn auf dem Schirm. Neu in dieser Fassung sind die
**Spaltenköpfe zum Sortieren** (Athlet · Status · Grund · Zuletzt aktiv; ein dritter Druck stellt
„Alarm zuerst" wieder her) und die **Tastatur**: `j`/`k` durch die Liste, `Enter` öffnet, `/`
fokussiert die Suche, `Esc` schließt. Hover- und Aktivzustände gibt es jetzt überall dort, wo ein
Zeigegerät sie zeigen kann – unter `(hover:hover)`, eine Flächenstufe heller, keine neue Farbe.

### Kleinkram in den Athleten-Ansichten, der trotzdem gelogen hat

- **„bei RIR 2"** stand in der Trainingsbegründung, auch wenn die RIR-Spalte gar nicht sichtbar war.
- **Drei Ladefehler-Karten der Analyse** behaupteten „keine Daten", wo in Wahrheit die Anfrage
  gescheitert war.
- **„Wer deine Fotos sehen kann"** beschrieb einen Stand, den es so nicht mehr gab.
- **Die Planzeile der Ernährung** rechnete das Kochgewicht aus einer Kopie statt aus der Zahl des
  Servers.
- **`aria-current="page"`** fehlte am aktiven Reiter, und acht rohe Farbwerte sind jetzt Token.

### Die Dokumente sagen, was der Code tut

Alle elf Dokumente im Wurzelverzeichnis sind gegen den laufenden Server nachgemessen, nicht
abgeschrieben. Neu ist **`IPHONE-TEST.md`**: 13 Prüfpunkte zum Abhaken, je „Was du tust · Was
passieren muss · Wenn nicht" – von der Installation über Test-Push, Pausen-Timer mit gesperrtem
Bildschirm und Apple-Kurzbefehl bis zum Offline-Start im Flugmodus. `DEPLOYMENT.md` hat jetzt die
vollständige Variablenliste und eine **Render-Checkliste für nach dem Deploy**, `SICHERHEIT.md` einen
eigenen Abschnitt zu den Laufzeit-Schaltern, `APP-INSTALLIEREN.md` den Trichter aus dieser Version.

**`package.json` nennt jetzt die Node-Version** (`"engines": { "node": ">=22" }`). Ohne diese Angabe
entschied die Voreinstellung der Plattform darüber, welcher Datenbanktreiber läuft: `src/db.js`
versucht `better-sqlite3` und fällt sonst auf das eingebaute `node:sqlite` zurück – das es erst ab
Node 22 gibt.

### Was in dieser Version NICHT fertig geworden ist

Damit es niemand erst beim Suchen merkt:

- **Der Wartungshinweis wird Athleten noch nicht angezeigt.** Der Server gibt ihn heraus, die
  Verwaltung zeigt ihn – die Hülle der Athleten-App holt ihn noch nicht ab. Die Verwaltung sagt das
  im Klartext, statt eine Wirkung zu behaupten, die es nicht gibt.
- **Die App hat keinen Hellmodus.** `public/app.css` kennt weder `prefers-color-scheme` noch
  `data-theme`; sie ist dunkel, auf jedem Gerät. Für das Handy ist das eine Entscheidung, für einen
  hellen Büroschirm eine offene Frage – sie ist notiert.
- **Der Startpfad braucht weiter 14 Anfragen** statt der angepeilten 10. Vier davon ließen sich ohne
  Verlust sparen; welche und warum, steht in `DEFER-A5.md`.
- **Eine Reparatur pro Monat** war das Ziel; der Server vergibt weiter höchstens zwei in 30 Tagen. Die
  App nennt die **echte** Zahl des Servers, nicht die gewünschte.
- **Zwei Stellen in der Analyse zählen noch Tage** statt Wochen (Wochenrückblick und die
  Meilenstein-Feier). Startseite und Sonntags-Nachricht sind umgestellt.

## 2.8.0
Diese Version beantwortet die Frage, die ein Trainingstagebuch eigentlich beantworten muss: **Was war
davon echte Arbeit?** Bis 2.7.0 war die Antwort „alles, was du eingetippt hast" — und deshalb machte ein
Aufwärmsatz mit 60 kg × 15 rechnerisch ein geschätztes 1RM von 90 kg, während der schwere Arbeitssatz
mit 67,5 kg × 8 nur auf 85,5 kg kam. Die App feierte den Aufwärmsatz als Rekord.

Die Spalten für Satzart und RIR liegen seit 2.6.0 in der Datenbank. Geschrieben hat sie bis jetzt niemand.
Ab 2.8.0 werden sie geschrieben — und, wichtiger, **gelesen**: im Volumen, in der Bestleistung, in der
1RM-Schätzung, in den Sätzen je Muskelgruppe, in der Empfehlung und sogar in der Frage, ob ein Tag
überhaupt ein Trainingstag war.

Gemessen an einem Testkonto mit 166 Sätzen — dieselbe Zeile einmal als Aufwärmsatz und einmal als
Arbeitssatz eingetragen:

| | als Aufwärmsatz | dieselbe Zeile als Arbeitssatz |
|---|---:|---:|
| geschätztes 1RM der Übung | **96,7 kg** | 583,3 kg |
| Volumen der Übung | **19.538 kg** | 22.038 kg |
| Empfehlung fürs nächste Mal | **95 kg** | 200 kg |

Links steht, was die App ab jetzt zeigt. Rechts steht, was sie bis 2.7.0 gezeigt hätte.

**Und das ist nur die eine Hälfte.** Die andere ist die Oberfläche — sie wurde in dieser Version
Bildschirm für Bildschirm neu geschnitten. Was sich dabei geändert hat, steht gleich als Erstes.

### Für dich als Athlet: die Oberfläche
Die Rechnung darunter ist neu. Der Weg darüber auch. Alle Zahlen hier sind am laufenden Server
gemessen, nicht geschätzt — jeweils 2.7.0 gegen 2.8.0 am selben Konto.

- **Der Check-in kostet zwei Tipps statt sieben — und die Felder sind schon ausgefüllt.** Bis 2.7.0
  öffnete sich ein leeres Blatt: vier Felder, vier Eingaben, Speichern ohne Eingabe schickte nichts.
  Jetzt stehen in allen vier Feldern Vorschläge (letzter Wert oder der Wert deiner Uhr), und unter
  jedem steht, **woher** er kommt. Ein Tipp öffnet, ein Tipp speichert. **0 von 4 vorbelegt → 4 von 4.**
- **Einen Satz bestätigst du mit einem Tipp.** Die heutige Übung ist aufgeklappt, die Satzzeile trifft
  sicher, der Haken sitzt am Ende der Zeile: **2 Tipps → 1** ab der Trainingsansicht. Das Gewicht eines
  Satzes zu ändern kostete bisher **9 Tipps**, jetzt **2** — ± Stepper neben Gewicht und Wiederholungen,
  Tastatur nur noch, wenn du sie willst.
- **Die Startseite sagt eine Sache auf einmal.** Bisher stand dasselbe Thema dreifach da (Supplements
  als Chip *und* Ring *und* Liste). Jetzt sind die Ringe das Tages-Dashboard, ein Tipp auf einen Ring
  öffnet sein Blatt, und darüber steht **eine** Jetzt-Karte mit genau einer Hauptsache. Dazu neu: eine
  Karte „Zuletzt" — dein letztes Training sahst du bisher nirgends, dein Coach schon.
  **Höhe 1.874 px → 987 px**, **19 rote Elemente über dem Falz → 2**, Weg zur Supplement-Einnahme
  **915 px Scrollen → 143 px**. Kein Einstieg ist dabei teurer geworden: „Essen loggen" bleibt bei
  3 Tipps, „Supplement" bei 1.
- **Wenn dir die alte Startseite lieber ist, hol sie zurück.** In der Mehr-Zeile der Startseite steht
  „Startseite: neu / klassisch". Die Wahl bleibt nach dem Neuladen bestehen, und die klassische Fassung
  ist vollständig. (Sie gehört noch auf die Profilseite — das holen wir nach.)
- **Die Ernährung kennt jetzt andere Tage als heute.** Eine Datumsleiste über dem Tag („‹ Sa 12.9. ·
  Heute ›"), Wischen blättert, 365 Tage zurück. Genau das tun Menschen abends: nachtragen. Dazu
  „Gestern wiederholen" und „Mahlzeit als Vorlage" in zwei Tipps, Favoriten oben in der Auswahl, und
  in der Planzeile steht endlich, ob 105 g roh oder gekocht gemeint sind.
- **Ein normaler Tag sieht nicht mehr aus wie ein Fehler.** Die Makros sind Ringe statt Warnbalken;
  „26 g drüber" steht in normaler Schrift, nicht in Alarmfarbe.
- **Die Analyse beantwortet erst die Frage, dann zeigt sie die Zahl.** Über jedem Diagramm steht ein
  Satz im Klartext, neben jedem Wert sein Bereich („HRV 62 ms · dein Bereich 55–70"), und du wählst
  den Zeitraum selbst: **4 Wochen / 3 Monate / 1 Jahr** (bis 2.7.0 fest 30 bzw. 90 Einträge, ohne Wahl).
  Statt Tonnage zählt sie **Sätze je Muskelgruppe gegen den Korridor 10–20** — die Größe, die du
  wirklich planst. Der Fotovergleich zeigt zwei Bilder nebeneinander im gleichen Ausschnitt.
- **Rot ist wieder ein Akzent.** Die Farbe markiert nur noch den einen Hauptknopf, den aktiven Tab,
  den Fokus und einen echten Fehler. Alles andere ist neutral. Dazu: **keine einzige Textfarbe unter
  dem Lesbarkeits-Mindestwert** (vorher 7 Regeln, die schlimmste mit 2,02:1), **kleinste Schrift
  10 px → 12 px** (13 Stellen betroffen → 0), **Tippziele unter 44 px: 186 → 44**.

### Für dich als Athlet
- **Aufwärmsätze zählen nirgends mehr mit.** Nicht im Volumen, nicht in der Bestleistung, nicht im
  geschätzten 1RM, nicht in den Sätzen je Muskelgruppe — und auch nicht bei der Frage, ob der Tag als
  Training gilt. Drei Aufwärmsätze aus zwei Übungen sind kein Trainingstag und verschieben deinen
  Rhythmus nicht mehr.
- **Vier Satzarten statt einer:** Arbeitssatz, Aufwärmsatz, Drop-Satz, Backoff-Satz. Drop und Backoff
  sind echte Arbeit und zählen wie ein Arbeitssatz — nur der Aufwärmsatz fällt heraus. Mehr Arten gibt
  es bewusst nicht; für alles andere hast du die Satz-Notiz.
- **RIR wird gespeichert und benutzt.** Trägst du ein, wie viele Wiederholungen noch gegangen wären,
  rechnet die Empfehlung damit. An derselben Zeile — 90 kg × 15 im Zielbereich 10–15 — kommt heraus:

  | dein RIR | Empfehlung | warum |
  |---:|---|---|
  | nichts eingetragen | 90 kg halten | wie bisher; ohne Angabe ändert sich nichts |
  | 0 oder 1 | 90 kg halten | „sauber am Limit" — das Gewicht steigt nicht, nur weil die Zahl stimmt |
  | 2 | 90 kg halten | im Zielbereich, Reserve normal |
  | 3 | **92,5 kg** | drei in Reserve heißt: der Reiz war zu klein |
  | 4 oder 5 | **95 kg** | zwei Schritte statt einem |

  Ohne RIR-Wert rechnet die App Zeile für Zeile wie in 2.7.0. Wer das Feld nicht benutzt, merkt nichts.
- **Unter jeder vorgeschlagenen Zahl steht jetzt, woher sie kommt** — „zuletzt 72,5 kg × 10 bei RIR 2".
  Bisher stand dort nur das Ergebnis, und du konntest ihm weder folgen noch widersprechen.
- **Die Schrittweite gehört zur Übung, nicht zur App.** Bis 2.7.0 hieß „hoch" immer 2,5 kg — auch an
  einer Kurzhantelreihe mit 1-kg-Stufen, wo es dieses Gewicht schlicht nicht gibt. Trägt dein Coach die
  Stufe ein, rechnet die Empfehlung damit: dieselbe Lage ergibt bei 1 kg Stufe 92 kg, bei 0,25 kg
  (Magnete) 90,5 kg, bei 5 kg 100 kg. Ohne Eintrag bleibt es bei 2,5 kg.
- **Auch die Rückkehr nach einer Pause landet auf einem Gewicht, das es gibt.** 72,5 kg minus 10 %
  ergaben bisher „65,5 kg" — an einer Langhantel mit 2,5-kg-Stufen eine Empfehlung ins Leere. Jetzt
  werden es 65 kg: auf die Stufe deiner Übung abgerundet, lieber etwas leichter als unmöglich.
- **Einen Satz zu löschen ist keine endgültige Entscheidung mehr.** Die Zeile wird markiert, nicht
  vernichtet: sie verschwindet sofort aus allen Listen und aus jeder Rechnung, bleibt aber Wort für
  Wort erhalten. **24 Stunden lang** steht sie unter „Zuletzt gelöscht", und ein Tipp holt sie zurück —
  mit Gewicht, Wiederholungen, RIR, Satzart und Notiz. Nach 24 Stunden verschwindet nur der
  Rückhol-Knopf; die Daten selbst bleiben. (Warum uns das wichtig ist: ein hartes Löschen hat in dieser
  Tabelle schon einmal 4.185 Zeilen mitgerissen.)
- **Fällt ein Tag durchs Löschen unter „echtes Training", nimmt die App auch das zurück.** Löschst du
  die Sätze eines automatisch erkannten Trainingstags wieder weg, steht im Kalender wieder das, was
  vorher dort stand — und nicht ein Trainingstag ohne Training.
- **Nachtragen trägt jetzt auf den richtigen Tag nach.** Die Mahlzeit bekam ihre Tageszeit bisher aus
  der Uhr **im Moment des Speicherns**. Wer sonntagfrüh das Abendessen von Samstag nachtrug, bekam es
  als Frühstück. Jetzt entscheidet der Tag selbst: ist auf ihm noch nichts eingetragen, heißt es
  Frühstück; sonst folgt der Eintrag dem zuletzt benutzten Slot dieses Tages. Für heute gilt weiter
  die Uhr. Gemessen um 23 Uhr: leerer vergangener Tag → Frühstück, Tag mit „Abend" als letztem
  Eintrag → Abend, heute → Abend.
- **Ein Datum in der Zukunft wird auf allen Wegen abgewiesen.** Supplement-Einnahmen waren der letzte
  Schreibweg, der nur die Form des Datums prüfte, nicht seine Lage: `2029-12-31` legte eine Einnahme an,
  die in keiner Ansicht je wieder auftauchte. Jetzt gilt dort dieselbe Regel wie bei Sätzen, Essen,
  Cardio und Check-in.
- **Unter einem vorbelegten Check-in-Wert steht jetzt die gelesene Herkunft, nicht die geratene.**
  Jedes der vier Felder sagt, woher sein Vorschlag kommt — „zuletzt Di", „von deiner Uhr",
  „schon eingetragen". „Von deiner Uhr" war bisher aus Umständen geschlossen (Health-Sync an, Tag ist
  heute, Feld, das eine Uhr liefern kann), und damit bekam auch ein von Hand getippter Schlafwert diese
  Zeile untergeschrieben. Jetzt zählt, was beim Anlegen der Zeile mitgeschrieben wurde: „von deiner Uhr"
  steht nur noch über einem Tag, den wirklich der Import angelegt hat und den seither keine Handeingabe
  berührt hat. In jedem anderen Fall steht dort das in beiden Fällen wahre „schon eingetragen".
- **„Zuletzt" auf der Startseite zählt Bestleistungen nach derselben Regel wie alles andere.** Die neue
  Karte („Gestern · Upper 1 · 27 Sätze · 2 Bestleistungen") rechnete sich ihre Zahlen im Browser selbst
  aus — und zählte dabei je Übungszeile statt je Bewegung. Steht dieselbe Übung zweimal im Plan (was
  nach jeder zugewiesenen Vorlage passiert), feierte sie einen Rekord, den es nicht gab: 100 kg auf der
  einen „Leg Press"-Zeile galten als Bestleistung, obwohl auf der zweiten längst 102,5 kg standen — und
  der Satz-Dialog sagte im selben Moment völlig richtig „kein Rekord". Jetzt rechnet der Server, mit
  genau der Regel, die auch über „Neuer Rekord" entscheidet. Nebenbei steht die Karte sofort da statt
  nach zwei Sekunden, und deine Startseite lädt **25 KB weniger**.

### Für dich als Coach
- **Du setzt die Trainingsstufe, nicht der Athlet.** Neue Zeile „Stufe & Funktionen" im Athleten-Blatt:
  Anfänger / Fortgeschritten / Profi, und darunter **ein** Satz, was sich dadurch für den Athleten
  wirklich ändert. Die Selbstangabe aus dem Onboarding wird dabei nicht überschrieben — sie bleibt
  daneben sichtbar, und ein Tipp nimmt deine Übersteuerung zurück. Dazu vier Einzelschalter (RIR,
  Satztypen, Tempo, Muskel-Korridor), mit denen du eine Funktion abweichend von der Stufe freigibst
  oder abschaltest. Der Athlet bekommt eine Nachricht — aber nur, wenn sich tatsächlich etwas geändert
  hat (siehe „Nachgebessert für Coaches").
- **In der Planzeile steht die Leistung, nicht nur die Vorgabe** („zuletzt 72,5 × 10/9/8 · Best 75"),
  und der KI-Schalter-Zustand des Athleten ist sichtbar, statt geraten zu werden.
- **Sätze je Muskelgruppe je Woche — die Größe, die du wirklich planst.** Neu als eigene Auswertung,
  mit **Korridor 10–20 Sätzen** je Muskel und Woche: darunter passiert zu wenig, darüber nimmt der
  Ertrag ab und die Erholungsschuld überwiegt. Jede Muskelgruppe bekommt „zu wenig / im Korridor /
  viel" statt einer nackten Tonnage. Am Testkonto: Quads 18,8 Sätze pro Woche (im Korridor), Brust 6
  (zu wenig) — eine Aussage, die aus „61.865 kg Tonnage" niemand herausgelesen hätte.
- **Die laufende Woche wird als laufend ausgewiesen.** „6 von 10 Sätzen" am Mittwoch ist kein Rückstand,
  sondern Mittwoch. Nur abgeschlossene Wochen gehen in den Durchschnitt ein.
- **Sätze auf Übungen ohne hinterlegte Muskelgruppe werden getrennt gezeigt, nicht stillschweigend
  verteilt.** Ein Plan mit ungepflegten Stammdaten sähe sonst aus wie zu wenig Training.
- **Die Muskelgruppen heißen jetzt überall gleich – und deutsch.** Das Feld war frei, und deshalb
  standen zwei Sprachen nebeneinander: „Brust" neben „Chest", „Trizeps" neben „Triceps", „Waden" neben
  „Calves", dazu „Lats", „Quads", „Hamstrings", „Glutes", „Rear Delts", „Abs" — 17 Schreibweisen für
  11 Gruppen. Für dich als Anfänger waren das unerklärte Fachbegriffe in einer sonst deutschen App.
  Für dich als Fortgeschrittenen war es schlimmer: Der Korridor zählte jede Schreibweise einzeln.
  Gemessen an einem Konto mit 14 Brust-Sätzen pro Woche, sieben davon unter „Chest" eingetragen:

  | | bis 2.7.0 | ab 2.8.0 |
  |---|---|---|
  | Analyse, Sätze je Muskel | „Chest 7 · zu wenig" **und** „Brust 7 · zu wenig" | „Brust 14 · im Korridor" |
  | Trainingstage der Gruppe | 4 und 4 | 8 |

  Zweimal „zu wenig" für eine Woche, die im Korridor lag. Ab jetzt gibt es je Gruppe **einen** Namen:
  Brust, Rücken, Schultern, Bizeps, Trizeps, Quadrizeps, Beinbeuger, Gesäß, Waden, Bauch und so weiter.
  Getippt werden darf weiter, was du willst – „Chest" wird beim Speichern zu „Brust". Ein Wort, das die
  App nicht kennt, bleibt stehen, wie du es geschrieben hast; sie erfindet dafür keine Gruppe. Deine
  alten Einträge bleiben in der Datenbank unangetastet und werden beim Anzeigen übersetzt.
- **Das gemeinsame Wochenziel zählt jetzt auch dasselbe.** Dass Athletenliste und Athletenblatt
  `weekGoal` derselben Kalenderwoche liefern, kam schon mit 2.7.0. Neu ist, was dahinter gezählt wird:
  ein Tag, an dem nur aufgewärmt wurde, ist keine Einheit mehr, und gelöschte Sätze zählen nicht mit.
  Gemessen: `target` und `done` sind an allen drei Stellen identisch — bei dir, in der Liste, im Blatt.
- **Die Schrittweite je Übung kannst du eintragen** (0,25 bis 25 kg). Ohne Eintrag bleibt es bei 2,5 kg.
- **Das Kochgewicht steht jetzt an der Planzeile selbst.** „Haferflocken (roh) 105 g" heißt 315 g
  fertig — diese Zahl kannte die App seit 2.5.0, hat sie aber an zwei Stellen getrennt gepflegt: einmal
  im Rechenkern, einmal als Kopie von fünf Faktoren in der Ernährungs-Ansicht. Jetzt rechnet sie der
  Server und schickt sie mit; die Kopie fällt weg. Wo das Kochen nichts ändert (Quark, Öl, Gemüse),
  steht bewusst nichts. Gemessen an einem erzeugten Plan: 8 von 31 Zutaten mit Kochgewicht, und alle
  acht auf denselben Faktor wie vorher — an den angezeigten Zahlen ändert sich nichts.

### Für Technikinteressierte
- **Mehr Oberfläche, trotzdem weniger Ladezeit — und hier stehen beide Zahlen.** Die neue Oberfläche ist
  Code, und der Code ist gewachsen: das Bündel `/app.js` geht roh von **435 auf 495 KB**, mit gzip von
  **132,1 auf 150,1 KB**. Was dein Browser wirklich herunterlädt, ist trotzdem **kleiner** geworden,
  weil der Server seit dieser Version **Brotli** ausliefert (Stufe 11, einmal beim Start berechnet):
  `/app.js` **120,9 KB**, `/app.css` **20,4 KB**. A/B auf derselben Maschine, zwei gleichzeitig laufende
  Server, gedrosselt auf Slow-4G:

  | Erster Aufruf, leerer Cache | 2.7.0 | 2.8.0 |
  |---|---:|---:|
  | Anmeldeseite | 9 Anfragen · 188,0 KB · 1.271 ms | 9 · **176,2 KB** · **1.181 ms** |
  | Startseite (angemeldet) | 15 Anfragen · 188,8 KB · 1.595 ms | **14** · **180,6 KB** · **1.530 ms** |

  Ehrlich auch die Gegenrichtung: der **zweite** Aufruf mit gefülltem Cache holt 22,6 → **26,2 KB** —
  3,6 KB mehr, dafür eine Anfrage weniger und (ungedrosselt gemessen) 104 → 79 ms. Das Bündel weiter
  aufzuteilen bleibt trotzdem die nächste Aufgabe: wer nur das Anmeldeformular sieht, lädt heute auch
  Ringe, Satzzeile und Datumsleiste mit. Der Mechanismus dafür steht seit 2.7.0 (nachladbare Module,
  vier laufen bereits).
- **Eine Regel statt siebenunddreißig.** „Was ist ein echter Satz?" stand als `reps>0` an 37 Stellen im
  Server verteilt — und in der 1RM-Schätzung liefen SQL und JavaScript schon einmal auseinander (SQL
  rechnete mit jedem Satz, JavaScript deckelte bei 12 Wiederholungen). Jetzt gibt es drei benannte
  SQL-Bausteine an **einer** Stelle (`SQL_SET_LIVE`, `SQL_SET_WORK`, `SQL_REAL`), und alle 37 Abfragen
  benutzen sie. Eine neue Satzart zu ergänzen heißt ab jetzt: eine Zeile ändern.
- **Weiches Löschen ohne Schemaänderung.** Der gelöschte Satz bekommt `set_type='deleted'` und fällt
  damit durch genau dieselben Bausteine aus jeder Rechnung. Was er vorher war, liegt 24 Stunden als
  Merker in `settings` — derselben Tabelle, die schon die automatisch erkannten Trainingstage trägt.
  Keine neue Tabelle, kein `ALTER TABLE`, und vor allem kein `DELETE` auf `set_logs`. Abgelaufene Merker
  räumt der nächste Schreib- oder Lesezugriff desselben Nutzers weg — kein zusätzlicher Hintergrundjob.
- **Wiederholtes Löschen ist folgenlos.** Eine zweite Zustellung aus der Offline-Warteschlange
  überschreibt den Merker nicht; sonst begänne die 24-Stunden-Frist von vorn und der alte Zustand
  wäre weg.
- **Was der Client nicht schickt, bleibt stehen.** Speichert ein alter Client (oder ein Nachtrag aus der
  Offline-Ablage) eine Satzzeile ohne `rir`/`set_type`, behält die Zeile ihre Werte, statt sie stumm zu
  verlieren. `'deleted'` kommt über `POST /api/logs` bewusst nicht herein: in den Papierkorb führt nur
  ein Weg, sonst könnte ein verirrter Client Verlauf verstecken.
- **Vier neue Routen**, alle mit derselben Zugriffsprüfung wie der Rest: `DELETE /api/logs/:id`,
  `POST /api/logs/:id/restore`, `GET /api/logs/:userId/trash`, `GET /api/muscle-sets/:userId`.
  Die Rollentrennung aus 2.6.0 hält unverändert: 185 Routen × 6 Rollen = 1.110 geprüfte Zellen,
  **0 neue Personendaten für die falsche Rolle, 0 Fremdschreiben.**
- **Die Datenauskunft nach DSGVO zeigt auch die gelöschten Zeilen** — mit ihrer Markierung. Ein
  Datenexport, der verschweigt, was noch da ist, wäre keiner.
- **„Für dich" lässt sich endlich allein als gelesen melden.** Das Postfach hat seit 2.5.0 zwei
  Bereiche, aber der Server kannte nur „alles gelesen". Ein Blick auf „Für dich" hätte damit eine
  ungelesene Coach-Nachricht stumm weggeklickt — deshalb meldete die App den Bereich bisher nur dann,
  wenn im Gespräch ohnehin nichts Ungelesenes mehr lag. `POST /api/messages/:userId/read?scope=system`
  markiert jetzt genau den einen Bereich; die Trennlinie ist dieselbe wie in der App (alles vom eigenen
  Coach gehört ins Gespräch, auch seine „Plan angepasst"-Hinweise). Ohne `scope` bleibt alles beim
  Alten. Gemessen: 2 Systemnachrichten gelesen, **37 Gesprächsnachrichten unberührt.**
- **Eine vierte Bestleistungs-Definition wieder eingesammelt.** `lastWorkout` (Datum, Plantag, Sätze,
  Tonnage, Bestleistungen, schwerster Satz) gehört jetzt zum Home-Aggregat `GET /api/home/:userId` und
  wird dort mit denselben Bausteinen gerechnet wie überall sonst: `SQL_REAL` für „echter Satz", die
  D15-Gruppierung über `LOWER(TRIM(exercises.name))` für „dieselbe Bewegung", `SQL_LOAD` (D16) für die
  Tonnage. Der Client zählt nichts mehr selbst nach, und `GET /api/logs/:userId` (25.022 Byte für das
  Prüfkonto) fällt aus dem Startpfad der Startseite heraus — eine Anfrage weniger, `public/js/home.js`
  rund 1 KB gzip kleiner. Die Verlaufsabfrage bleibt dabei auf dem deckenden Index
  `(user_id, exercise_id, date)`, denselben Umweg über die eigenen Übungs-IDs nehmend wie
  `movementSetLogs()`.
- **Zwei Rundungsfehler nebenbei:** Empfehlungen lagen fest auf einem Halb-Kilo-Raster (aus „+0,25 kg"
  wurde dort „+0,5 kg"), und Gewichtstexte zeigten eine Nachkommastelle, während im Feld zwei standen
  („100,3 kg" über einem Feld mit 100,25). Beides rechnet jetzt auf der Stufe der Übung.

### Nachgebessert vor der Auslieferung (Server & Rechenkern)

Fünf unabhängige Prüfer sind 2.8.0 vor der Freigabe noch einmal durchgegangen. Was sie gefunden haben,
steht hier — nicht weil es schön ist, sondern weil es zur Version gehört.

- **Als Anfänger hast du „RIR 4" gelesen, obwohl dir die App das Feld ausdrücklich vorenthält.** Auf
  Stufe 1 gibt es keine RIR-Spalte in der Satzzeile — der Empfehlungstext schrieb das Kürzel trotzdem
  hin: „12 Reps bei RIR 4 — da ist Luft." Das war auf dem ganzen Bildschirm die einzige Stelle, an der
  das Wort vorkam, und erklärt wurde es nirgends. Jetzt kennt der Text die Stufe: derselbe Fall liest
  sich auf Stufe 1 als **„12 Reps — da ist Luft. Empfehlung: 30 kg (+2,5)."** und ab Stufe 2 unverändert
  mit RIR. **Die Empfehlung selbst ist in beiden Fällen dieselbe** (gemessen über alle fünf Textfälle:
  gleicher Typ, gleiches Gewicht) — dein RIR-Wert wirkt weiter, er wird nur nicht mehr in einer Sprache
  begründet, die du nicht angeboten bekommen hast. Schaltet dein Coach RIR einzeln frei, erscheint es
  sofort; schaltet er es ab, verschwindet es auch auf Stufe 3.
- **Deine RIR-Angabe am letzten Satz ging verloren.** Drei gleiche Arbeitssätze — 27,5 kg × 12, × 12,
  × 12 — und du trägst am **letzten** ein, dass noch vier Wiederholungen drin waren. Genau dort trägt
  man den Wert ja ein. Die App suchte sich den „besten" Satz, fand dreimal dieselbe Leistung und nahm
  bei Gleichstand den zuerst eingetragenen: den ohne RIR. Gemessen an denselben Daten: RIR am letzten
  Satz ergab **„27,5 kg halten"**, RIR am ersten Satz **„hoch auf 30 kg — da ist Luft"**. Zwei
  gegenteilige Ratschläge aus einer Einheit. Jetzt gewinnt bei Gleichstand der Satz **mit** Angabe und
  danach der spätere; beide Fälle sagen dasselbe.
- **„Rückgängig" holt jetzt auch den Trainingstag zurück.** Löschtest du die Sätze eines automatisch
  erkannten Trainingstags und machtest es gleich wieder rückgängig, kamen die Sätze zurück — der Tag
  nicht. Die Startseite schrieb dann **„Ruhetag" über sieben eingetragenen Sätzen**, dein Kalorienziel
  fiel von 3.017 auf 2.600 kcal, das Wochenziel von 1/5 auf 1/4, und der Kalender verschob die Rotation
  um einen Tag. Dieselbe Rechnung, die beim Speichern und beim Löschen läuft, läuft jetzt auch beim
  Zurückholen — auch für einen Tag, den du vorher ausdrücklich als Ruhetag bestätigt hattest.
- **Dein Level fällt nicht mehr, wenn du etwas löschst.** XP werden gerechnet, nicht gespeichert: ein
  gelöschtes Foto kostete 15 Punkte, ein zurückgenommener Satz zwei — und im Grenzfall einen Rang.
  Gemessen: 120 weich gelöschte Sätze ließen das Level von **5 „Aufsteiger" auf 3 „Einsteiger"** fallen.
  Der höchste je erreichte Stand wurde seit 2.6.0 mitgeschrieben, nur nie benutzt. Jetzt kommt das Level
  von dort: die Punktzahl darf sinken, der Rang bleibt. Beide Zahlen stehen in der Antwort.
- **Ein Import von der Uhr hält keine Serie mehr am Leben.** Zwei Tage, die ausschließlich aus dem
  Apple-Health-Import stammen und die kein Mensch angefasst hat, hoben die Check-in-Serie von **0 auf 32
  Tage** — ohne dass jemand die App geöffnet hätte. Eine Serie misst, dass du hinschaust, nicht dass
  deine Uhr läuft. Zeilen, die du selbst bestätigt hast, zählen unverändert: der erste echte Check-in
  holt die Serie sofort zurück.
- **Körpergewichtsübungen können endlich mitzählen.** Wird beim Satz das damals gültige Körpergewicht
  mitgeschickt, geht es in die Tonnage ein — gemessen an drei Sätzen à 8 Wiederholungen mit 85 kg
  Körpergewicht: **+2.040 kg**, die vorher als „0 kg" dastanden. Ohne Angabe ändert sich nichts.

### Nachgebessert für Coaches

- **Die Stufe deines Athleten lässt sich jetzt wirklich setzen.** Das Blatt „Stufe & Funktionen" war
  gebaut, ehrlich beschriftet — und tot: der Server nahm `experience_coach` und die Profi-Schalter
  stillschweigend entgegen, antwortete „OK" und schrieb nichts. Jetzt schreibt er beide, mit einer
  geschlossenen Liste erlaubter Schalter (RIR, Satztypen, Tempo, Muskel-Korridor); ein unbekannter Wert
  wird abgelehnt statt still verschluckt. Die **Selbstangabe des Athleten bleibt unangetastet** — deine
  Einstellung steht daneben, sichtbar, und ein Tipp nimmt sie zurück.
- **Keine Änderungsmeldung mehr für Änderungen, die es nicht gab.** Jedes Speichern im Profilblatt
  schickte dem Athleten „Coach hat dein Profil angepasst" — auch wenn du nur geöffnet und wieder
  gespeichert hattest. Jetzt wird vorher und nachher verglichen; die Nachricht geht nur raus, wenn
  sich wirklich etwas geändert hat, und sie sagt, **was**.
- **Die laufende Woche wird auch dann als laufend behandelt, wenn du nur sie abfragst.** Fragtest du
  die Sätze je Muskelgruppe für genau eine Woche ab, bewertete die App den Montagabend wie eine fertige
  Woche: „Quadrizeps 4 Sätze — zu wenig" an Tag 1 von 7. Ohne abgeschlossene Woche gibt es jetzt keine
  Bewertung, sondern „noch nicht beurteilbar".

## 2.7.0
Diese Version beantwortet zwei Fragen: **Wie lange dauert es, bis die App da ist?** und **was steht da,
wenn kein Netz da ist?** Die ehrlichen Antworten waren bisher: zu lange — und zu oft eine Null, die
niemand eingetragen hat.

Wer die App zum ersten Mal am Tag öffnete, wartete auf einer normalen Mobilverbindung **drei Sekunden**
und lud dabei **485 KB in 34 Anfragen** — darunter 156 KB für Analyse, Mindset, Coach und Suche, die auf
der Startseite niemand braucht, davon 63 KB allein die Coach-Ansicht, die ein Athlet nie öffnen darf
(`coach.js` 56 KB + `coach.css` 7 KB, gezippt gemessen an 2.6.0). Jetzt sind es
**189 KB in 15 Anfragen, und nach rund 1,6 Sekunden steht die Startseite.** Über einen ganzen Kaltstart
gerechnet — die vier nachgeladenen Bereiche holt die App kurz nach der Startseite ja trotzdem — sind es
**314 statt 485 KB: rund ein Drittel weniger Mobilfunk**, und davon 189 KB, bis die Startseite steht.
Der Rest kommt hinterher, wenn er niemanden mehr aufhält.

Und: Startest du **ohne Netz**, siehst du ab jetzt deinen letzten Stand mit Zeitstempel statt einer Seite
voller Nullen. Gemessen (`tools/offline-diff.mjs`, fünf Ansichten, je online gegen offline): bisher
**6 von 10 Fällen rot** — über hundert Kennzahlen verschwanden beim Start ohne Netz oder sprangen auf 0,
während ein Hinweis behauptete, man sähe den letzten Stand. Jetzt: **0 von 10 rot, 0 Abweichungen,
0 verschwundene Kennzahlen.**

### Für dich als Athlet
- **Die App ist beim ersten Öffnen am Tag ungefähr doppelt so schnell da.** Gemessen auf einer
  gedrosselten Mobilverbindung (Slow-4G, leerer Zwischenspeicher, angemeldet): 3,1 Sekunden vorher,
  rund 1,6 Sekunden jetzt. Beim zweiten Öffnen war es immer schon schnell — daran ändert sich nichts,
  außer dass jetzt noch 23 statt 46 KB über die Leitung gehen.
- **Die Anmeldeseite steht sofort.** Bisher entstand das Formular im achten von neun Skripten: du hast
  auf 471 KB gewartet, bevor du überhaupt deine E-Mail eintippen konntest. Jetzt ist die Karte mit dem
  ersten Bild da — Logo, Felder, Auge zum Passwort-Anzeigen, Datenschutz und Impressum. Alles andere
  lädt dahinter weiter. Alles funktioniert wie vorher: Registrieren, Einladungscode, die Hilfe zur
  Passwortstärke, der Countdown nach zu vielen Fehlversuchen, Passwort vergessen.
- **Du zahlst kein Mobilfunkvolumen mehr für Bereiche, die du nicht aufmachst.** Analyse, Mindset,
  Coach-Ansicht und Suche kommen erst, wenn du sie brauchst — und sonst ruhig im Hintergrund, kurz
  nachdem deine Startseite fertig ist, nicht davor. Wechselst du auf so eine Ansicht, bevor sie da ist,
  siehst du für einen Moment Platzhalter statt der alten Seite. Ohne Netz steht dort, was los ist, und
  ein Knopf zum erneuten Versuchen — keine leere Seite.
- **Ohne Netz stehen deine Zahlen da, nicht Nullen.** Bisher galt: App im Flugmodus starten hieß
  Bereitschaft 92 → 0, Streak-Zeile weg, „0 / 3.017 kcal", Ernährung, Mindset und Analyse ohne jede
  Kennzahl — und darüber ein Hinweis, du sähest den letzten Stand. Das war schlicht gelogen. Jetzt legt
  die App jede gelesene Antwort als Stand auf deinem Gerät ab und zeigt beim Start ohne Netz genau
  diesen Stand — mit einem Chip oben im Kopf: **„Stand 20:14 · offline"**. Ein Stand, der älter als
  30 Tage ist, gilt nicht mehr; ein Monat alte Kalorien sind kein „heute".
- **Was du ohne Netz einträgst, siehst du sofort.** Satz geloggt, Essen eingetragen, Check-in gemacht,
  Supplement abgehakt — das wartet wie bisher in der Ablage, bis das Netz zurück ist, **steht aber jetzt
  schon auf dem Bildschirm**, auch wenn du zwischendurch den Tab wechselst. Die Tagessumme rechnet mit.
  Kommt das Netz zurück, wird nachgetragen, und es steht **einmal** da, nicht zweimal.
- **„Noch nicht geladen" statt einer erfundenen 0.** Gibt es weder Netz noch einen Stand auf dem Gerät
  — der allererste Start auf einem neuen Handy ohne Empfang —, steht das jetzt so da, mit einem Knopf
  **Wiederholen**. Vorher zeichnete die App an dieser Stelle einen kompletten Tag aus Nullen: 0 kcal,
  0 Sätze, Bereitschaft 0. Wer das für seine echten Zahlen hielt, hat sich zu Recht geärgert.
  Antwortet der Server dagegen ablehnend (kein Zugriff), steht das da und nicht „offline".
- **Meldest du dich ab, ist dein Stand vom Gerät weg.** Schnappschüsse, wartende Einträge,
  Vorschlagslisten — alles wird beim Abmelden geräumt. Auf einem geteilten Gerät sieht der Nächste
  deine Zahlen nicht mehr, auch nicht im Flugmodus. Öffnet dein Coach dich, wird von deinen Daten
  **nichts** auf seinem Gerät abgelegt.

### Für dich als Coach
- Deine Ansichten (Athleten, Nachrichten, Vorlagen) leben jetzt in einer nachgeladenen Datei. Die App
  merkt an deiner Rolle, dass du sie brauchst, und holt sie sofort beim Anmelden. In der Bedienung
  ändert sich nichts.

### Für dich als Betreiber
- **Es gibt weiterhin keinen Build-Schritt.** Der Server hängt die Dateien beim Hochfahren zusammen —
  dieselbe Mechanik, mit der er schon immer die Versionsnummer eingesetzt hat. Im Zip ändert sich
  nichts an der Ordnerstruktur, hochladen und deployen läuft wie bisher.
- **Neuer Notausgang `?swkill=1`.** Wenn ein Gerät nach einer Auslieferung hängt und Neuladen nicht
  hilft, rufst du `https://DEINE-URL/?swkill=1` auf: Der Service Worker wird abgemeldet, alle Caches
  werden geleert, die Seite lädt sauber neu und läuft in diesem Tab ohne Worker weiter. Tab schließen
  hebt das auf. Schritt für Schritt in DEPLOY-PRUEFEN.md.
- **Notbremse `MINIFY=0`.** Beim Bündeln entfernt der Server Kommentare und Einrückungen — das allein
  spart rund 40 Prozent der übertragenen Bytes (`/app.js`: 226 KB unverkleinert gegen 132 KB
  verkleinert, jeweils gezippt über die Leitung). Kommt je der Verdacht auf, dass daran etwas kaputtgeht,
  setzt du in Render die Umgebungsvariable `MINIFY` auf `0` und startest neu: dann geht alles
  unverkleinert raus, gleiche Funktion, nur größer.
- **Der Wechsel von 2.6.0 auf 2.7.0 braucht keinen Handgriff.** Geprüft: ein Browser mit dem
  vollständigen 2.6.0-Cache bekommt nach **einem** normalen Neuladen 2.7.0, der alte Cache ist weg,
  die Konsole bleibt leer.
- **Der Offline-Stand liegt im Browser, nicht im Service Worker.** `/api/*` wird weiterhin **nie**
  gecacht — die Antworten legt die App selbst ab, unter der Kennung des angemeldeten Kontos, und räumt
  sie beim Abmelden weg. Für dich heißt das: Wenn jemand „alte Zahlen" meldet, ist der Ort dafür der
  Gerätespeicher dieses Kontos, nicht dein Cache auf Render — und der sicherste Handgriff dagegen ist
  **Abmelden und neu anmelden**, nicht `?swkill=1` (das räumt den Cache der Dateien, nicht den Stand).

### Für Technikinteressierte
- **Kein Schema-Wechsel.** Diese Version ändert keine Tabelle, keine Spalte, keinen Index. Wenn nach
  der Auslieferung etwas klemmt, liegt es am Cache oder am Code — nicht an der Datenbank.
- `/app.js` = `core, home, training, diet, account, shell` in genau dieser Reihenfolge (account.js ruft
  am Dateiende `renderLoginView()` und muss deshalb vor shell.js laufen), dazu der Nachlade-Lader
  (rund 140 Zeilen Code). `/app.css` = alle neun Stylesheets in der Reihenfolge von vorher.
  `/mod/analysis.js`, `/mod/mindset.js`, `/mod/coach.js`, `/mod/search.js` werden nachgeladen.
  Ein Bündel komprimiert besser als sechs einzelne: **207 KB gzip vorher, 132 KB jetzt.**
- Der Verkleinerer entfernt ausschließlich Kommentare und führende Leerzeichen, und nur dort, wo der
  Zeichenstrom wirklich Code ist. Er benennt nichts um und entfernt kein Semikolon. Jede Datei wird
  danach übersetzt (`node:vm`, entspricht `node --check`) und zeilenweise gegengeprüft; fällt eine
  der beiden Proben durch, geht die Originaldatei raus und es steht im Protokoll.
- `index.html` bringt `/app.css` und `/app.js` als `Link: rel=preload` schon im Antwortkopf mit, das
  Skript lädt mit `defer` — kein synchrones Skript mehr vor dem ersten Bild.
- `manifest.json` bekommt die Versionsnummer jetzt wie index.html und sw.js vom Server eingesetzt.
  Vorher stand in den Icon-Adressen ein handgeschriebenes `?v=2`, während alles andere `?v=<Version>`
  nannte — dieselbe Datei lag doppelt im Cache und wurde doppelt geholt. Ebenso das Logo: die
  Anmeldeseite hat bis 2.6.0 `logo.jpg` **und** `logo-wide.jpg` geladen (26 KB), jetzt nur noch eines.
- **Das Anmelde-Logo geht nur noch an den, der die Anmeldekarte wirklich sieht.** Es hängt seit dem
  Bündel-Umbau statisch in `index.html` und wurde deshalb bei **jedem** Start geholt — auch beim
  angemeldeten Athleten, der die Karte nie zu Gesicht bekommt: 13,2 KB kalt und 12,2 von 33,8 KB eines
  warmen Starts. Der Server hält jetzt zwei Fassungen der Seite bereit (beide beim Hochfahren gebaut,
  Unterschied: **ein** Attribut) und liefert die Fassung ohne Bildadresse aus, wenn die Anfrage ein
  Sitzungs-Cookie trägt (`Vary: Cookie`; `index.html` wird ohnehin nie gecacht). War das Cookie tot,
  holt ein Notnagel in `index.html` das Bild nach, sobald `/api/me` abgelehnt hat oder jemand die Karte
  anfasst — gemessen 0,6 Sekunden nach dem Laden. Die Adresse trägt jetzt außerdem `?v=<Version>`, greift
  also cache-first. Ergebnis: **kalt 201 → 189 KB, warm 34 → 23 KB.**
- Der Service Worker legt beim Installieren nur noch vier Adressen vorab ab: `/`, `manifest.json`,
  `/app.css`, `/app.js`. Alles andere — Logo, Icon und die vier nachgeladenen Module — landet im Cache,
  sobald es das erste Mal wirklich geholt wird. Die Module beim Installieren mitzuziehen hieße, 112 KB
  zu holen, während jemand auf seine Startseite wartet.
- **Eine Lese-Schicht statt drei.** `API.get` ist ab jetzt die einzige Stelle, die entscheidet, was
  eine Ansicht zu sehen bekommt: echtes 200 gilt und erneuert den Stand; `status 0` **mit** Stand wird
  zu `{status:200, data, stale:true, at}`; `status 0` **ohne** Stand bleibt 0; 4xx/5xx holen nie einen
  alten Stand zurück. Kein Aufrufer musste dafür angefasst werden — alle prüfen weiter auf
  `status === 200` und bekommen Zahlen statt Nullen.
- **Schlüssel `be_snap_v1_<Konto>_<Pfad>` in `localStorage`**, höchstens 40 Einträge à 64 KB, ältester
  fliegt zuerst, Verfall nach 30 Tagen; Hochzählen von `v1` verwirft alles Alte. Nicht abgelegt werden
  `/version`, `/me`, `/login`, `/register…`, Fotos, Avatare, `/ai/`, `/admin/`, Push und Support —
  Auskunft über den Server, große Binärdaten oder Daten, die nicht dem angemeldeten Konto gehören.
  Läuft der Speicher voll (`QuotaExceededError`), wird der älteste Stand geopfert und erneut versucht;
  scheitert jedes Schreiben (Safari privat), wird sofort aufgegeben statt blind aufgeräumt.
- **Die Outbox liegt über dem Stand.** `offApplyOutbox()` rechnet wartende Einträge in gelesene Daten
  ein — Sätze, Essen, Supplements, Check-in — und folgt dabei der Server-Logik, damit Kopfzeile und
  Liste dieselbe Zahl nennen (ein Satz ist ein Upsert und ersetzt die Zeile; ein Check-in überschreibt
  nur die mitgeschickten Felder). Nur auf dem stale-Pfad, sonst wäre die Überlagerung die Dublette.
  `POST /foodlog/frommeal/<id>` löst erst der Server auf: diese Zeile steht ohne Nährwerte da und die
  Tagessumme bleibt unverändert — eine geschätzte Zahl wäre genau die Erfindung, die hier abgeschafft wird.
- **Ein Zeitstempel, eine Stelle.** Der Chip sitzt in der Hülle (`#syncState`) und wird von `API.get`
  gesetzt, nicht von den Ansichten — keine Ansicht baut sich eine zweite Zeitanzeige. Er fällt beim
  Ansichtswechsel und danach **Pfad für Pfad, sobald wirklich frische Zahlen ankommen** — ausdrücklich
  nicht schon, wenn das Netz zurück ist. Sonst verschwände das Etikett, während die alten Zahlen noch
  auf dem Bildschirm stehen, und aus einer ehrlichen Angabe würde eine falsche.
- **`purgeLocalData(uid)`** beim Abmelden und beim Sitzungsverlust: Schnappschüsse, Outbox-Reste,
  Vorschlagslisten, Chip. Im Coach-Blick auf einen Athleten wird gar nicht erst abgelegt
  (`snapAllowed() === false`).
- **Der Legacy-Pfad der Startseite** lief bisher bei **jedem** Nicht-200 und baute aus `null` einen
  vollständigen Tag aus Nullen. Er läuft jetzt nur noch bei `404/405/501` (älterer Server) und bei
  `status 0`; bei 4xx/5xx nicht mehr. Fehlt eine der drei tragenden Antworten (Check-ins, Essen, Sätze
  von heute), gibt er `null` zurück statt einer Seite. Dieselbe Regel in `training.js` (Cardio),
  `diet.js` (Kalorien-Hero) und `analysis.js` (Maße, Fotos): `?.x || []` machte aus „unbekannt" ein
  „nichts" — jetzt bleibt der letzte Stand stehen, und sonst steht die Karte „Noch nicht geladen".

**Was in dieser Version NICHT erreicht wurde, offen gesagt:** Die Zielmarke lautete 10 Anfragen und
1,2 Sekunden. Erreicht sind 15 Anfragen und rund 1,6 Sekunden. Die verbleibenden Anfragen sind zur
Hälfte Datenabrufe der Startseite, und die 132 KB des Kernbündels sind die Untergrenze, solange
`core.js` (140 KB) ungeteilt bleibt. Beides braucht einen Schnitt durch Dateien, die diese Version
bewusst nicht angefasst hat. Und: die **189 KB** gelten bis zur fertigen Startseite — die vier
nachgeladenen Bereiche kommen gleich danach und machen zusammen 314 KB. Deutlich weniger als die
485 KB von vorher, aber eben nicht 189.

## 2.6.0
Diese Version beantwortet eine einzige Frage: **Wer darf deine Daten sehen?** Bis jetzt war die
ehrliche Antwort: mehr Leute, als du gedacht hast. Der Administrator der App war technisch der Coach
von jedem – er sah jedes Gewicht, jeden Schlafwert, jedes Foto, jede Nachricht und jeden Satz, den
du in ein Freitextfeld geschrieben hast. Das ist jetzt vorbei. Gemessen: **0 statt 20** Stellen, an
denen der Betreiber persönliche Daten bekam.

### Für dich als Athlet
- **Deine Daten gehören dir und deinem Coach – sonst niemandem.** Der Betreiber der App sieht ab
  jetzt Konten, Rollen und Zahlen über den Betrieb. Deine Check-ins, Körpermaße, Fotos, Nachrichten,
  Beschwerden und Mindset-Texte sieht er nicht. An 90 Stellen, an denen er bisher durchkam, steht
  jetzt „Kein Zugriff".
- **Niemand trägt mehr etwas in deinem Namen ein.** Check-in, Essen, Cardio, Körpermaße, Fotos,
  Apple-Health-Import und deine Mindset-Eintragungen kannst nur du selbst schreiben. Dein Coach hat
  weiter seine eigenen Wege – die Coach-Notiz am Check-in, die Übungsnotiz, eine Nachricht, deinen
  Plan. Der Unterschied: Man sieht danach, wer was geschrieben hat.
- **Du wirst gefragt, bevor wir Gesundheitsdaten speichern.** Einmal, mit einem Häkchen, und du kannst
  es jederzeit zurücknehmen. Nimmst du es zurück, nehmen wir ab dem Moment nichts Neues mehr an –
  und sagen dir auch offen, dass das Vorhandene damit nicht gelöscht ist (dafür gibt es den Export
  und das Löschen des Kontos).
- **Hattest du dein Konto schon vor diesem Update, sperrt dich das Update nicht aus.** Die Frage nach
  der Einwilligung hängt am Onboarding – das sieht nur, wer sich neu registriert. Ein Konto von
  vorher wäre also ab dem Update mit einem Schlag ohne Einwilligung dagestanden: kein Check-in, kein
  Essen, kein Gewicht, keine Maße, kein Health-Import. Deshalb haben wir sie beim Update **einmalig
  übernommen** und mit dem Datum des Updates vermerkt. Gefragt haben wir dich dabei nicht, und wir
  sagen es dir auch so: Du bekommst darüber eine Nachricht in der App, jede Übernahme steht einzeln
  im Protokoll, und im Konto unter „Daten & Verbindungen → Einwilligung" siehst du, was gilt, und
  nimmst sie mit einem Tipp zurück. Für jedes Konto, das **nach** dem Update entsteht, gilt das
  nicht: dort wird gefragt, bevor der erste Gesundheitswert gespeichert wird.
- **KI-Auswertung nur, wenn du sie erlaubst.** Der Schalter steht auf **aus**. Erst wenn du ihn
  umlegst, darf dein Coach eine KI-Analyse deiner letzten 14 Tage anfordern – und du bekommst danach
  wie bisher eine Nachricht, die auflistet, was übermittelt wurde. Ohne deinen Schalter sieht dein
  Coach einen klaren Hinweis statt einer Analyse.
- **Hilfe-Freigabe: du öffnest die Tür, nicht der Betreiber.** Wenn in der App etwas klemmt und
  jemand von innen draufschauen muss, gibst du das frei: ein Grund aus vier Möglichkeiten, dann
  **30 Minuten**. Danach schließt sie sich von selbst; abbrechen kannst du jederzeit. Sobald die
  Freigabe benutzt wird, bekommst du eine Nachricht – und jeder einzelne Zugriff steht im Protokoll.
  **Und sie ist wirklich nur zum Ansehen:** der Server lässt über eine Freigabe ausschließlich Lesen
  zu. Ein Satz, ein Foto, ein Essenseintrag – nichts davon kann jemand mit einer Freigabe anlegen,
  ändern oder löschen; jeder Versuch wird abgewiesen und steht im Protokoll.
- **Wenn sich deine Rolle ändert, erfährst du es.** Wird aus deinem Konto ein Coach- oder
  Betreiberkonto gemacht (oder zurück), bekommst du eine Nachricht darüber. Und deine Coach-Zuordnung
  überlebt das: sie wird gemerkt und wiederhergestellt, statt still zu verschwinden.
- **Kein Startpasswort mehr per WhatsApp.** Legt dir jemand ein Konto an, bekommst du einen Link
  (72 Stunden, einmal verwendbar) und setzt dein Passwort selbst. Niemand kennt es außer dir.
- **Und der Betreiber kann dir auch später kein Passwort mehr geben.** Bis 2.5.0 konnte er eines
  setzen – und sich damit als du anmelden. Jetzt erzeugt er höchstens denselben einmaligen Link:
  dein bisheriges Passwort gilt weiter, bis du ihn benutzt, das neue setzt du selbst, du bekommst
  sofort eine Nachricht darüber, und jeder Link steht im Protokoll. Ist der Mailversand eingerichtet,
  geht der Link direkt an deine Adresse – der Betreiber sieht ihn dann gar nicht.

### Für dich als Coach
- Alles, was du für deine Athleten brauchst, bleibt: Athletenliste, Dashboard, Plan, Mahlzeitenplan,
  Vorlagen, Supplements, Monatsziele, Beschwerden, Nachrichten, Import, Coach-Notiz.
- **Was nicht mehr geht: im Namen deines Athleten eintragen.** Sein Check-in, sein Essen, sein Cardio,
  seine Maße und seine Fotos sind seine Aufzeichnung. Wenn du etwas festhalten willst, nimm die
  Coach-Notiz am Check-in, die Übungsnotiz oder eine Nachricht – das steht dann als deins da und
  verfälscht seine Zahlen nicht. Die App sagt dir das im Klartext, wenn du es versuchst.
- **KI-Analyse braucht die Zustimmung deines Athleten.** Fehlt sie, steht da: „KI-Auswertung nicht
  freigegeben. Dein Athlet kann sie im Profil unter ‚Daten & Verbindungen' erlauben."
- **Neues Konto anlegen ohne Passwort.** Du gibst Name und E-Mail ein und bekommst einen
  Einladungslink zum Kopieren. Ist der Mailversand eingerichtet, geht er zusätzlich per E-Mail raus –
  ist er es nicht, sagt die App das, statt eine Mail zu versprechen, die nie ankommt.

### Für dich als Betreiber
- **Die Verwaltung ist eine Betriebsansicht, kein Akteneinsichtsrecht.** Die Nutzerliste zeigt
  Kürzel (`A-7F2`), Rolle, Coach-Kürzel, Aktivität (aktiv/ruhig/inaktiv) und Anlagedatum – keine
  Namen, keine E-Mail-Liste. Ein Konto findest du weiter über die **exakte** E-Mail-Adresse; diese
  Suche wird protokolliert, mit oder ohne Treffer. Das gilt auch für die **Coach-Auswahl** beim
  Zuordnen: dort stehen Kürzel, Rolle und die Zahl der betreuten Athleten – kein Name. Vorher war
  genau das die Hintertür: ein Athlet kurz zum Coach gemacht, und sein Klarname stand in der Liste.
- **Protokoll.** Jede Verwaltungshandlung schreibt eine Zeile: Rolle geändert, Coach zugeordnet,
  Konto angelegt oder gelöscht, Zugangs-Link erzeugt, Sicherung gezogen, Adresse gesucht,
  Hilfe-Freigabe erteilt/benutzt/zurückgezogen, Einwilligung erteilt/widerrufen, KI-Analyse
  ausgeführt. Nur Kennungen und Handlungsnamen, nie Inhalte. 365 Tage, keine Löschroute.
- **Fehlerspeicher.** Serverfehler landen redigiert in einem Ringpuffer (14 Tage / 2.000 Zeilen):
  Routenmuster, Status, Fehlerklasse, Kurztext **ohne** E-Mails, Tokens, Pfade und Freitexte – die
  Redaktion läuft, **bevor** geschrieben wird.
- **Jobs.** Die wiederkehrenden Läufe (Stundentakt, tägliches Aufräumen) tragen Start, Erfolg und
  Fehler ein und melden `up`, `late` oder `down`. Wenn der Sonntags-Push ausbleibt, siehst du es –
  statt es zu vermuten.
- **Was du verlierst:** den Durchgriff auf Athletendaten. Das ist Absicht. Wenn du wirklich in ein
  Konto sehen musst, bittest du den Athleten um eine Hilfe-Freigabe. Auch der Datenexport eines
  fremden Kontos ist weg – den zieht jeder für sich selbst.
- **Passwort zurücksetzen heißt jetzt: Link erzeugen.** Du vergibst kein Passwort mehr – auch nicht
  „kurz zum Testen". `POST /api/admin/users/:id/resetpw` liefert einen einmaligen Link (72 Stunden);
  schickst du trotzdem ein Passwort mit, antwortet die Route mit 400 und sagt warum. Ist der
  Mailversand eingerichtet, geht der Link an die hinterlegte Adresse und wird dir **nicht** angezeigt.
  Das bestehende Passwort bleibt gültig, bis der Link benutzt wird – ein verlorener Link sperrt also
  niemanden aus.
- **Rollenwechsel ist kein Schalter.** Der Weg vom Athleten weg löst seine Coach-Zuordnung – sie wird
  jetzt gemerkt und beim Weg zurück wiederhergestellt, und der Betroffene bekommt eine Nachricht.
  Dieselbe Rolle noch einmal zu setzen ändert nichts mehr (`unchanged`), statt die Zuordnung zu kosten.
- **Achtung beim Umstieg:** `requireCoach` lässt nur noch echte Coaches durch. Wenn dein
  Administrator-Konto bisher Athleten betreut hat, brauchst du dafür ein Konto mit der Rolle `coach`.

### Unter der Haube
- Eine neue Prüfung `canAccessPersonal()` (wie bisher, aber **ohne** Admin-Zweig) ersetzt an
  61 Stellen die alte; `canAccess()` bleibt für Stammdaten. `coachScopeAthletes()` ist für
  Administratoren leer.
- Neue Tabellen: `audit`, `errors`, `jobs`, `support_grants`; neue Spalten `users.consent_health_at`,
  `consent_version`, `ai_consent` (Schema, Paket A-II.1).
- Nachträge aus der letzten Welle: Der Ernährungsplan sagt jetzt selbst, wenn er aus einer älteren
  Rechnung stammt und nicht mehr zum Ziel passt („Einmal ‚Plan neu erstellen' bringt ihn auf den
  aktuellen Stand") – statt still daneben zu liegen.
- **Der Widerruf gilt jetzt überall.** Nach dem Zurücknehmen der Einwilligung nahmen drei Wege weiter
  Gesundheitsdaten an, während der Check-in daneben ablehnte: das Profil (Geburtsjahr, Geschlecht,
  Größe, Startgewicht), der Onboarding-Abschluss und sämtliche Mindset-Eingaben (Stimmung, Energie,
  Rad des Lebens, Arbeitsblätter). Alle drei antworten jetzt mit demselben 409 und demselben Satz.
  Was frei bleibt, damit dich der Widerruf nicht aus deinem eigenen Profil aussperrt: Name, Ziel,
  Trainingstage, Kalorienziele, Push-Stunde, jedes Zurücksetzen auf den Standard, das **Lesen** deines
  Bestands, das **Löschen**, die Mindset-Erinnerungen und das Beenden einer laufenden Challenge.
- **Die Fassung der Einwilligung wirkt.** Bisher schrieb der Client die Fassung in den Rumpf und der
  Server übernahm sie ungeprüft – eine alte Fassung reichte damit für alles. Jetzt vergibt der Server
  sie, und geprüft wird gegen die aktuelle: Passt sie nicht mehr, kommt dieselbe Karte wie beim ersten
  Mal, mit dem Grund „Der Text der Einwilligung hat sich geändert". Damit hält die App ihr eigenes
  Versprechen aus der Datenschutzerklärung (Abschnitt 9).
- **Der 409-Hinweis nennt den Weg, den es wirklich gibt:** „Konto → Daten & Verbindungen →
  Einwilligung". Vorher stand dort ein Menüpunkt, der nie existiert hat.
- **Auch der Coach-Reset steht im Protokoll.** Setzt ein Coach das Passwort seines Athleten zurück,
  schreibt das jetzt eine `password.reset`-Zeile – wie beim Betreiber. Das Passwort eines anderen zu
  setzen ist der Weg an alle seine Daten; das darf nicht spurlos bleiben. Ebenso protokolliert:
  `PUT /api/athlete/:id/profile` (Phase, Ziel, Kalorienziele) als `athlete.profile.set`.
- **Die Hilfe-Freigabe erteilt nur noch der Athlet.** Betreiber und Coaches bekamen bisher 200 und
  legten dabei eine sinnlose Freigabe auf dem eigenen Konto an, die danach in der Betriebsansicht
  stand. Jetzt antwortet die Route ihnen mit 400 und einem Satz.
- **Zwei Betriebsangaben sieht der Betreiber wieder:** der Supplement-Katalog (eine Liste von
  Präparaten, keine Personendaten) und `/api/ai/status` (ob ein Schlüssel gesetzt ist). Beide waren
  beim Umbau auf „`requireCoach` ohne Admin" mit abgeschnitten worden; sie hängen jetzt an der neuen
  Schranke `requireCoachOrAdmin`. Coaching-Inhalte wie `/api/templates` und `/api/dashboard/:id`
  bleiben für ihn zu.
- Nachgemessen mit `tools/roles.mjs`: 181 Routen × 6 Rollen = 1.086 Zellen, **0 Abweichungen,
  0 Antworten mit Personendaten für die falsche Rolle, 0 offene Aufträge**. Vorher: 20 bzw. 28.

## 2.5.0
Diese Version baut nichts Neues. Sie repariert Zahlen, die falsch waren – und Sätze, die etwas
versprochen haben, was der Code nicht getan hat. Vorher haben zwei Prüfrunden jede Rechnung der App
mit echten Konten nachgerechnet. Was dabei herauskam, steht hier.

### Die Anmeldung sperrt dich nicht mehr aus
- **Dein richtiges Passwort kommt immer durch.** Bisher galt: acht Fehlversuche, und danach war auch
  das richtige Passwort 15 Minuten lang gesperrt – gemessen 868 Sekunden. Im Studio-WLAN teilen sich
  alle eine Adresse; wer deine E-Mail kannte, konnte dich mit acht Versuchen aussperren. Jetzt wird
  erst dein Passwort geprüft und dann gezählt: Stimmt es, bist du drin, und alle Zähler sind gelöscht.
  Was bleibt: die kurze Wartezeit nach Tippfehlern (1, 2, 4 … bis 30 Sekunden) und eine harte Grenze
  von 60 Fehlversuchen pro Stunde und Anschluss – damit niemand den Server mit Rateversuchen lahmlegt.
  Die antwortet in einer Millisekunde statt in siebzig.
- **Löschen verlangt dein Passwort.** Wenn ein Administrator ein Konto löscht, fragt die App jetzt
  nach seinem Passwort – so wie bei der Sicherung und beim eigenen Konto. Ein gestohlenes Cookie
  allein reicht dafür nicht mehr.
- **Die Testmail ist Betriebssache.** Sie löst nur noch der Administrator aus, nicht mehr jeder Coach.
- **Nachrichten sind gedeckelt:** 20 pro Stunde und Absender – auf jedem Weg: Coach an einen Athleten,
  Rundnachricht an alle, Athlet an den Coach. Genug für jedes Gespräch, zu wenig für eine Lawine aus
  Push-Meldungen und E-Mails. Ist die Grenze erreicht, steht die Wartezeit in Minuten da.

### Zahlen, die jetzt stimmen
- **Dein Alter wird endlich gespeichert.** Das Onboarding fragte nach dem Alter und warf die Antwort
  weg – ab da rechnete die App für jeden mit 30 Jahren. Für einen 62-Jährigen waren das 218 Kalorien
  am Tag zu viel, für einen 19-Jährigen 107 zu wenig. Jetzt wird das Geburtsjahr gespeichert (auch
  nachträglich aus einer alten Altersangabe abgeleitet). Fehlt es noch, sagt die App das offen:
  „Startwert – trag dein Geburtsjahr ein, dann rechnen wir genauer." Kein stilles Schätzen mehr.
- **Fett war zehn Prozent deiner Energie, nicht fünfundzwanzig.** Bei 2.600 Kalorien stand „Fett 29 g"
  im Ziel, obwohl die eigene Regel der App 72 g vorschreibt – ein normaler Tag mit 52 g Fett erschien
  als Überschreitung. Eiweiß war aus demselben Grund zu niedrig. Beide haben jetzt eine Untergrenze.
- **Plan und Ziel sind eine Zahl.** Der Ernährungsplan wurde auf eine andere Kalorienzahl gebaut, als
  im Heute-Tab als Ziel stand: 1.640 gegen 1.495. Wer seinen eigenen Plan exakt aß, lag jeden
  Trainingstag 145 Kalorien „über dem Ziel" – über ein Jahr gerechnet gut sechs Kilo Erklärungsnot.
  Jetzt baut der Plan auf genau das Ziel, das du siehst (gemessene Restabweichung: unter zwei Prozent).
- **Dein Kalorienziel folgt deinem Gewicht.** Es wurde nur beim Einrichten geschrieben und blieb dann
  stehen. Nach acht Kilo Abnahme war aus einem Defizit von 190 Kalorien eines von 88 geworden – man
  aß „im Ziel" und nahm nicht mehr ab. Weicht das gespeicherte Ziel um mehr als sieben Prozent von der
  Rechnung ab, rechnet die App neu und legt beide Zahlen nebeneinander.
- **Eine Rechnung aus Startwerten überstimmt dein Ziel nicht.** Fehlt deine Größe oder dein
  Geburtsjahr, rechnet die App mit 175 cm und ohne Alter weiter – aus 2.600 gespeicherten Kalorien
  wurden so 3.032 ausgelieferte, plus 17 Prozent, allein aus Annahmen (mit 165 cm wären es 2.687
  gewesen, mit 190 cm 3.251). Jetzt bleibt in diesem Fall dein gespeichertes Ziel stehen, und die
  App fragt nur nach, statt still höher zu rechnen. Der Hinweis darunter nennt auch, was genau fehlt:
  „Startwert – trag deine Größe und dein Geburtsjahr ein, dann rechnen wir genauer." Bisher
  verschwand er, sobald das Geburtsjahr da war – auch wenn die Größe weiter fehlte.
- **Dein Eiweißziel klettert nicht mehr von selbst.** Der Plan wird auf dein Ziel gebaut und trifft
  Eiweiß planmäßig etwas darüber – und beim nächsten „Plan neu erstellen" wurde aus dem Überschuss
  das neue Ziel. Fünfmal neu erstellt, ohne dass sich etwas geändert hätte: 176 → 189 → 199 → 203 →
  204 g, am Ende 2,6 statt 2,0 Gramm je Kilo. Die Ziel-Makros kommen jetzt allein aus der Rechnung,
  die auch das Onboarding zeigt; die Summen deines Plans stehen weiter daneben, als Information.
- **Ein einzelner Satz verschiebt deinen Rhythmus nicht mehr.** Fünfzehn Crunches am Ruhetag machten
  den Tag zum Trainingstag: Der Ruhetag war verbraucht, der Montag wurde vom Bein- zum Oberkörpertag,
  und der Ruhetag blieb verschoben. In vier Wochen fiel so ein ganzer Rotationstag aus. Ein Tag zählt
  jetzt erst ab drei Sätzen aus zwei Übungen automatisch als Training – bestätigen kannst du ihn im
  Kalender weiterhin jederzeit selbst. Und der Weg zurück steht offen: Korrigierst du die Sätze
  danach auf null Wiederholungen, weil du sie versehentlich eingetragen hast, nimmt die App den
  automatisch gesetzten Trainingstag wieder zurück – ein Tag, den du selbst im Kalender bestätigt
  hast, bleibt dagegen stehen.
- **Das Wochenziel kommt aus deinem Rhythmus.** Ein Sechs-Tage-Zyklus mit vier Einheiten wurde auf
  fünf aufgerundet; dasselbe Muster noch einmal zu speichern hob das Kalorienziel um 198 pro Tag,
  ohne dass sich am Training etwas geändert hätte. Jetzt zählt die App die Trainingstage dieser Woche.
- **Ein Rekord gehört zur Übung, nicht zur Zeile im Plan.** Steht dieselbe Bewegung zweimal im Plan,
  feierte die App 170 kg als „Neuer Rekord", während auf der anderen Zeile längst 207,5 kg standen.
- **Ein neuer Plan nimmt dir deine Trainingsgeschichte nicht weg.** Wies dein Coach dir eine Vorlage
  zu, standen dieselben Übungen danach wieder bei null: kein „letztes Mal", keine Empfehlung,
  Bestwert 0 – bei einem Athleten mit 362 geloggten Sätzen. Damit war auch das Eintragen eines Satzes
  wieder Tipparbeit statt drei Tipps. Verlauf, Empfehlung und Bestwerte hängen jetzt am Namen der
  Übung statt an ihrer Zeile im Plan, und der Hinweis vor dem Zuweisen sagt, was wirklich passiert:
  gleich benannte Übungen bringen ihren Verlauf mit, wirklich neue starten ohne Empfehlung.
- **Nach einer Pause fängst du leichter an.** Ein Satz von vor 13 Monaten führte zu „Stark! Empfehlung
  42,5 kg (+2,5)". Jetzt steht da: „Letztes Mal vor 400 Tagen. Starte bei 32 kg (20 % weniger) und
  taste dich hoch."
- **Der Gewichtstrend der Woche ist geglättet.** „Letzter minus erster" lag bei normalen
  Tagesschwankungen in knapp einem Drittel der Wochen sogar im Vorzeichen falsch. Jetzt werden die
  ersten gegen die letzten Wiegetage gemittelt – dieselbe Glättung, die Schlaf und Schritte längst
  haben, und zwar über die ersten und letzten drei Kalendertage statt über eine feste Zahl von
  Zeilen. Wer Montag, Mittwoch und Sonntag wiegt, bekommt jetzt den Schnitt aus Montag und Mittwoch
  gegen Sonntag (−0,9 kg) statt Montag gegen Sonntag (−1,4 kg).
- **Ein Schlafziel ist zwischen 5 und 10 Stunden.** Im Profil ließ sich „1 Stunde" eintragen – und
  damit war jede Nacht eine perfekte Nacht: 4,0 Stunden Schlaf ergaben die volle Punktzahl und
  „Grünes Licht". Das Onboarding hatte längst eine Grenze (4–14 h), das Profil keine. Jetzt gilt
  überall dieselbe. Kein Ziel im Profil heißt weiterhin: Die App leitet es aus deinem eigenen
  Schlaf ab.
- **Kein Datum in der Zukunft mehr.** Ein Satz auf den 31.12.2029 wurde angenommen, erzeugte ein
  „1RM ~833 kg" in der Analyse und verschob den Rhythmus. Sätze, Check-ins, Essen und Cardio nehmen
  nur noch Daten bis heute. Cardio verlangt außerdem mindestens eine Minute. Auf Reisen bleibt die App
  trotzdem offen: Der Server rechnet in mitteleuropäischer Zeit, dein Handy in seiner eigenen – in
  Tokio oder Auckland steht dein Kalender schon auf dem nächsten Tag, während es hier noch der alte
  ist. Dieser eine Tag Vorsprung wird angenommen, alles darüber weiterhin nicht. Und geht die Uhr
  deines Geräts um Jahre falsch, rechnet die App mit dem Datum des Servers statt dich auszusperren.
- **Ein geschätztes 1RM oberhalb von zwölf Wiederholungen gibt es nicht mehr.** Die Formel ist dort
  wertlos: 60 kg × 15 ergaben 90 kg, während der schwerere Arbeitssatz 67,5 × 8 nur 85,5 kg lieferte.
- **Muskelgruppen zählen Sätze, nicht Tonnage.** Nach Tonnage lagen die Waden über der gesamten Brust
  bei halb so vielen Sätzen, und 24 Sätze Klimmzüge standen als „0 kg" da. Jetzt zählt die App die
  Sätze der letzten vier Wochen, und wo es kein Hantelgewicht gibt, steht kein „0 kg".
- **Das abgeleitete Schlafziel liegt nicht mehr unter deiner Gewohnheit.** Aus 7,2 Stunden Median
  wurden 7,0 Stunden Ziel – ein Ziel, das man schon erfüllt, ist keins. Jetzt wird aufgerundet.
- **Cardio zählt für die Bereitschaft.** Die App sagte es, rechnete es aber nicht: Eine harte
  90-Minuten-Einheit war für die Bereitschaft ein Ruhetag. Jetzt geht Cardio als Satz-Äquivalent in
  die Wochenlast ein (leicht 0,07 · moderat 0,15 · hart 0,3 je Minute).
- **Die Einkaufsliste rechnet mit deinem echten Rhythmus.** Bei einem Zyklus, der keine sieben Tage
  lang ist, lagen die Wochenmengen bis zu 17 Prozent daneben.
- **Nachtragen kostet keinen Joker mehr** – egal, welches Feld du füllst und ob die Werte von der Uhr
  kommen. Und die Serie kann nicht mehr unbegrenzt mit Jokern am Leben gehalten werden: höchstens
  zwei in 30 Tagen. Eine Serie mit Joker-Tagen heißt jetzt auch nicht mehr „ohne Unterbrechung".
- **Die Ampel beim Coach kennt deinen Plan.** Sechs Tage ohne Training waren für jeden gelb – auch für
  jemanden, der einmal pro Woche trainiert und seinen Plan zu hundert Prozent einhält. Jetzt hängt die
  Schwelle an der geplanten Frequenz, und eine acht Monate alte, vergessene Beschwerde hält niemanden
  mehr dauerhaft auf Rot.
- **Der Wochenrückblick zählt nur Rituale, die auch stattgefunden haben.** Ein nach drei Sekunden
  abgebrochenes Priming führte der Mindset-Reiter als „übersprungen", ohne Serie und ohne Punkte – im
  Rückblick stand dasselbe Priming als erledigt und brachte 8 XP. Jetzt gilt an beiden Stellen
  dieselbe Regel. Abgebrochene Durchläufe verschwinden dabei nicht: Sie stehen als eigene Zeile
  „Abgebrochen – zu kurz, zählt nicht für Streak und XP", damit du siehst, warum die Zahl darüber auf
  null steht. Dasselbe gilt für die Challenge-Regel „Tag mit Dankbarkeit starten & beenden": Sie
  verlangt ein echtes Priming und eine echte Abend-Reflexion, kein Durchklicken.

### Supplements und Lebensmittel: die Korrekturen kommen auch bei dir an
- **Die Dosierungen liegen jetzt unter den amtlichen Höchstmengen – auch in einer App, die schon
  länger läuft.** Bisher standen die Empfehlungen nur in einer frisch eingerichteten Datenbank
  richtig drin; eine bestehende Installation trug die alten Werte weiter. Auf der Startseite stand
  darum bis zuletzt „Magnesium · 300–400 mg", obwohl 250 mg am Tag die Höchstmenge von BfR und EFSA
  ist. Dasselbe bei Zink (10–15 statt 6,5 mg) und Vitamin D3 + K2 (1000–2000 statt 800 IE). Beim
  Start gleicht die App die Stammliste jetzt ab: Menge, Zeitpunkt, Kategorie und der
  Sicherheitshinweis werden nachgezogen. Was dein Coach dir persönlich vorgibt, bleibt unberührt.
- **Falsche Nährwerte werden berichtigt, fehlende Lebensmittel nachgetragen.** Clearwhey stand mit
  0 g Eiweiß im Katalog, Reiswaffeln trugen die Zeile von Reis, Butter 70 statt 83 g Fett, Olivenöl
  91,6 statt 100. Und elf Zutaten, die die Ernährungspläne brauchen, fehlten ganz – Reis, Nudeln,
  Linsen und Quinoa je roh und gekocht, dazu Vollkornbrot, Putenbrust, Tempeh und Sojajoghurt.
  Beides zieht die App beim Start nach, und die Einheit (g, ml oder Stück) kommt in beide Richtungen
  aus der Stammliste – Milch wird in Millilitern gezählt, Pulver in Gramm. Deine eigenen Lebensmittel
  und alles, was du schon eingetragen hast, bleiben so, wie sie sind – vergangene Tage rechnen sich
  nicht rückwirkend um.
- **Auch die Rezepte tragen wieder die richtigen Zahlen.** In einer bestehenden Installation wichen
  74 der 75 Rezepte ab, die größten um mehr als ein Drittel: Die Süßkartoffel-Kichererbsen-Bowl stand
  mit 560 statt 878 Kalorien da, der Ofen-Lachs mit 580 statt 717. Wer danach gekocht hat, hat
  hunderte Kalorien nicht mitgezählt. Beim Start werden sie abgeglichen. Deine eigenen und die dir
  geteilten Rezepte rührt die App dabei nicht an.
- **Ein umbenanntes Lebensmittel zeigt nicht mehr zwei verschiedene Zahlen.** Hast du einen Eintrag
  unter seinem alten Namen schon einmal protokolliert, bleibt dieser Name dir erhalten – bisher aber
  mit seinen alten Nährwerten. In der Suche standen dann „Kichererbsen" mit 98 und
  „Kichererbsen (gekocht)" mit 138 Kalorien je 100 g nebeneinander, also 29 Prozent Unterschied auf
  dieselbe Portion. Der alte Name behält jetzt seinen Platz und bekommt die richtigen Werte.

### Was dein Coach und du voneinander erfahrt
- **Meldest du eine Beschwerde zu einer Übung, erfährt dein Coach es sofort** – als Push und als
  Nachricht im Postfach. Bisher lag so eine Meldung still in einer Liste, bis er von sich aus nachsah.
- **Nach jeder KI-Auswertung bekommst du eine Nachricht.** Darin steht, was übermittelt wurde: Ziel,
  Erfahrung, deine Trainingstage pro Woche, deine Check-in-Werte, deine letzten Sätze und die Anzahl
  samt Datum deiner offenen Beschwerden – ohne deinen Namen und ohne deine Freitexte. Die beiden
  letzten Punkte gingen schon immer mit, standen aber nicht in der Nachricht; jetzt ist die Liste
  vollständig. Der Schalter, mit dem du das ganz abschalten kannst, kommt in der nächsten Version.
- **Weniger von dir unterwegs:** Deine E-Mail-Adresse wird nicht mehr in die Athletenliste und ins
  Coach-Dashboard mitgeschickt – angezeigt wurde sie dort nie.
- **„Nie aktiv" stimmt jetzt.** In der Verwaltung galt ein Coach als nie aktiv, weil er weder Sätze
  noch Check-ins einträgt. Geschriebene Nachrichten zählen jetzt mit.
- **Die App weiß, ob es einen Mailversand gibt.** Ohne Mailserver behauptet sie nicht mehr, eine
  E-Mail sei unterwegs.
- **Zielwechsel sagt, was er bedeutet.** Wer sein Ziel von Aufbau auf Abnehmen umstellt, bekommt die
  neu gerechnete Kalorienempfehlung zurück, statt dass stillschweigend nichts passiert.

## 2.4.0
Die Auslieferungs-Version: gemessen statt geraten, abgesichert statt gehofft. Vor dieser Version
haben fünf Analysten drei Jahre Nutzung durchgemessen – die Rechenzeit war nirgends das Problem
(langsamster Aufruf 57 Millisekunden), die Bytes auf der Leitung waren es. Und ein Tipp konnte die
halbe Trainingshistorie löschen.

### Sicherheit und Datenschutz
Sechs Prüfer haben die App vor dieser Version angegriffen – mit echten Konten gegen einen laufenden
Server, nicht auf dem Papier. Die Mandantentrennung hielt vollständig: 28 Leserouten und alle
Schreibrouten, als fremder Athlet und als fremder Coach, durchweg abgewiesen. Die Lücken lagen
woanders, und sie sind zu:

- **Kein Start mehr mit dem Entwickler-Schlüssel.** Ohne gesetztes `JWT_SECRET` weigert sich der Server
  jetzt zu starten – vorher genügte ein vergessenes `NODE_ENV`, und jedes Konto ließ sich mit dem
  öffentlich bekannten Standardschlüssel fälschen. Lokal geht es weiter mit `ALLOW_DEV_SECRET=1`.
- **Passwortwechsel beendet fremde Sitzungen.** Bisher blieb ein gestohlener Anmelde-Token 30 Tage
  gültig – auch nach Passwortwechsel, Reset oder Abmelden. Jetzt entwertet jeder Passwortwechsel und
  jeder Reset alle anderen Geräte; das eigene bleibt angemeldet. Dazu im Profil: **„Alle Geräte
  abmelden"**. Bestehende Anmeldungen bleiben nach dem Update gültig – niemand muss sich neu anmelden.
- **Anmeldung gedrosselt, ohne dich auszusperren.** Statt der harten 15-Minuten-Sperre wächst nach
  Fehlversuchen eine kurze Wartezeit (1 s, verdoppelnd, höchstens 30 s) – auch kontoweit, damit ein
  Angreifer mit vielen Adressen nicht unbegrenzt raten kann. Das richtige Passwort wird nie dauerhaft
  gesperrt; die Wartezeit läuft im Login-Formular als Countdown mit.
- **Keine Konto-Ausspähung mehr über die Antwortzeit.** Der Login brauchte für bekannte Adressen
  40-mal länger als für unbekannte. Jetzt rechnet er immer gleich lang.
- **Passwörter: mindestens 8 Zeichen, keine aus der Liste der häufigsten.** Nur für neue und geänderte
  Passwörter; bestehende Anmeldungen bleiben unberührt. Keine Zeichenklassen-Regeln, dafür ein
  „Passwort anzeigen"-Auge und eine Hilfe beim Tippen statt einer Fehlermeldung danach.
- **Optionaler Einladungscode** für die Registrierung (`REGISTER_CODE`): gesetzt, verlangt die
  Registrierung ein Feld mehr; nicht gesetzt, bleibt alles wie heute.
- **Konto selbst löschen** – im Profil, mit Passwort, unwiderruflich und vollständig (auch Nachrichten,
  Teilen-Links, Push-Registrierungen, Mindset-Daten). Die Admin-Löschung räumt dieselben Tabellen.
- **Sicherung für den Betreiber:** In der Verwaltung lädt der Admin eine konsistente Kopie der
  Datenbank herunter (Passwort nötig, höchstens alle 10 Minuten). Das dokumentierte `cp` während des
  Betriebs war nicht konsistent.
- **Weniger Daten unterwegs:** Reset-Links stehen nicht mehr im Server-Log, wenn kein Mailserver
  konfiguriert ist. Nachrichten-Mails gehen nur an bestätigte Adressen. Der Datenexport enthält den
  Apple-Health-Schlüssel nicht mehr. Die KI-Analyse schickt keinen Klarnamen und keine
  Beschwerde-Freitexte. Ein Coach, der einen Athleten übernimmt, löst eine Nachricht an den Athleten aus.
  Die Freitexte aus dem Check-in (Notiz, Trainingsbeschreibung) bleiben beim Athleten – Dashboard und
  Startseite des Coaches bekommen sie nicht mehr.
- **Rad des Lebens: die Maßnahmen bleiben privat.** Sie gingen an den Coach – entgegen der Zusage.
- **Abhängigkeiten:** `nodemailer` auf Version 10 (zwölf Advisories), `xlsx` aus dem reparierten
  SheetJS-Paket (auf npm gibt es keinen Fix), Express-Unterbau aktualisiert.
- **Härtung:** kleine Anfragegrößen für login-freie Routen, `Cross-Origin-Opener-Policy` und
  `Cross-Origin-Resource-Policy`, kein `X-Powered-By`, Barcode-Bibliothek mit festgepinnter Version
  und Prüfsumme, Selbsttest-Zählwerte nur mit `SELFTEST_KEY`, sauberer Neustart statt undefiniertem
  Weiterlaufen nach einem unbehandelten Fehler, Aufräumen alter Token und toter Push-Endpunkte.
- **Bewusst nicht gemacht:** Zwei-Faktor, PIN-Sperre, E-Mail-Bestätigung als Login-Pflicht – jede davon
  kostet die Anmeldung mehr, als sie hier bringt. Bekannt und offen bleibt `'unsafe-inline'` in der
  CSP: die Oberfläche nutzt Inline-Handler flächendeckend; der Umbau ist ein eigenes Vorhaben.

### Schneller auf dem Handy
- **Komprimierung.** Alles Textartige geht jetzt gepackt über die Leitung: die App-Hülle beim Start
  von 883 auf 292 KB, die Check-in-Liste von 228 auf 27 KB. Ohne neue Abhängigkeit, mit Bordmitteln
  von Node. Bilder bleiben unangetastet.
- **Nur holen, was die Ansicht zeigt.** Die Check-in-Liste kann jetzt nach Zeitraum gefragt werden
  (`?days=`, `?limit=`); Analyse und Startseite laden 120 Tage statt der ganzen Historie. Wer länger
  pausiert hat, sieht trotzdem seine älteren Einträge – die App fasst dann einmal ohne Fenster nach.
- **Einmal geladen, nie wieder gefragt.** Dateien mit Versionsstempel (`?v=…`) kommen aus dem Cache des
  Service Workers ohne Nachfrage beim Server. Ihre Adresse ändert sich mit jeder Version, deshalb kann
  nie etwas Altes hängen bleiben. `index.html`, `manifest.json` und `/api/*` werden weiterhin nie gecacht.
  **Folge für den Betreiber: Jede Auslieferung geänderter Dateien braucht eine neue Versionsnummer.**
- **Ungelesen-Zähler statt Postfach.** Die Glocke fragt nur noch die Zahl ab (rund 20 Byte) statt alle
  30 Sekunden bis zu 50 Nachrichtentexte – das waren bis zu 7 MB je Stunde geöffneter App.
- **Auswertungen in der Datenbank statt im Speicher.** `/api/analytics` rechnet jetzt in SQL:
  76 → 27 ms bei drei Jahren, 142 → 48 ms bei sechs – und bitgleich dieselben Zahlen wie vorher.
- **Massenschreibvorgänge als Transaktion.** Apple-Health-Import mit 400 Tagen 1.320 → 51 ms,
  Excel-Import 192 → 15 ms, Onboarding 108 → 18 ms. Und alles-oder-nichts: ein Fehler mitten drin
  hinterlässt keinen halben Zustand mehr.
- **Fotoliste ohne Vollbilder.** Die Liste liefert nur Vorschaubilder (mit Blätterung), das Vollbild
  kommt einzeln. 468 Fotos: 315 → 88 ms. Der Datenexport mit Fotos wird gestreamt statt im Speicher gebaut.
- Kleinere Sachen: Mindset-Kontext wird je Startseite einmal statt zweimal gelesen und auf den
  Challenge-Zeitraum begrenzt; abgelaufene Teilen-Links werden aufgeräumt; statische Dateien tragen
  jetzt echte Cache-Regeln.

### Nichts geht mehr verloren
- **„Tag löschen" vernichtete die Historie.** Gemessen: 4.185 von 8.345 Sätzen weg, ohne Warnung, ohne
  Rückweg, in unter 100 ms – weil das Löschen bis in die Satz-Logs durchschlug. Jetzt wird der Tag nur
  **ausgeblendet**, die Sätze bleiben, die Rückfrage sagt das ehrlich, und im Toast steht **„Rückgängig"**.
- **Schwaches Netz hängt nichts mehr auf.** Ein Server, der die Verbindung annimmt und nie antwortet
  (Hotel-WLAN, ein Balken im Keller), ließ einen Satz bisher endlos in „speichert" hängen – und blockierte
  die Offline-Warteschlange. Jetzt hat jeder Aufruf eine Frist; läuft sie ab, gilt das wie „kein Netz",
  und der Satz landet in der Ablage. Lange, gesunde Vorgänge (Excel, Fotos) haben längere Fristen.
  Läuft die Frist bei einem Aufruf ohne Ablage ab, sagt die Meldung, dass der Server es schon haben
  könnte – statt zum blinden Nochmal-Senden zu verleiten.
- **Bereitschaft rechnet Schlafschuld.** Die letzte Nacht zählt am stärksten, die beiden davor zusammen
  ein Drittel. Eine kurze Nacht nach zwei guten wird weggesteckt, drei kurze hintereinander nicht – und
  das Etikett springt nicht mehr an jedem Tagesübergang. Ohne Uhr sind wieder alle vier Stufen erreichbar;
  ein einzelner Ausreißer (doppelte Wochenlast) verhindert das „Grüne Licht" auch bei perfektem Schlaf.
- **Ein Schlafziel, überall dasselbe.** Steht keins im Profil, leitet die App es aus dem eigenen
  14-Tage-Schnitt ab (7–8 h) und zeigt „(abgeleitet)"; ein gesetztes Profilziel gewinnt immer.
- **Die Wochen-Nachricht im Postfach** führt jetzt zu genau der Woche, über die sie spricht.

### Für den Betreiber
- **`GET /api/selftest`** – die Antwort auf „war mein Upload kaputt?". Meldet Version, Schema-Zustand
  (fehlende Tabellen, Spalten, Indizes), beim Start übersprungene Migrationsschritte, Datenbank
  erreichbar, WAL-Größe und ein paar Zählwerte – und antwortet mit **503 in Klartext**, wenn etwas fehlt.
  Ohne personenbezogene Daten, ohne Pfade, ohne Fehlertexte mit Interna. Zusätzlich trägt
  `/api/version` das Feld `schema: "ok"` bzw. `"fehlgeschlagen"`.
- Migrationsfehler beim Start werden nicht mehr nur ins Log geschrieben, sondern gemerkt und im
  Selbsttest ausgegeben.

## 2.3.0
Vier Dinge, die die App von einem Tagebuch zu einem Begleiter machen: Sie sagt dir morgens, was
heute drin ist. Sie zieht sonntags Bilanz. Sie funktioniert im Keller ohne Empfang. Und sie findet
alles wieder.

### Bereitschaft – was ist heute drin?
- **Eine Zahl von 0 bis 100** aus **Schlaf**, **HRV**, **Ruhepuls** und deiner **Trainingslast** der
  letzten sieben Tage – Schlaf, HRV und Ruhepuls aus dem Check-in oder von deiner Uhr (die schickt
  sie seit 2.2.0 von selbst), die Trainingslast aus deinen geloggten Sätzen. Dazu ein
  Wort („Grünes Licht", „Solide", „Etwas zurücknehmen", „Erholen") und **ein Satz, was das für heute
  heißt** – von „Wenn ein Satz leicht läuft, leg Gewicht drauf" bis „Heute leicht: halbes Volumen".
- Auf der Startseite **eine Zeile** in der Jetzt-Karte, angetippt öffnet sich die Rechnung: jeder
  Teilwert einzeln mit seinem Gewicht, dazu der Verlauf der letzten 14 Tage. Im Trainings-Tab
  erscheint ein Hinweis nur dann, wenn die Zahl es nahelegt – bei grünem Licht steht dort nichts.
- **Ehrlich statt schlau:** Fehlt ein Wert, fällt sein Teil weg und wird nicht geraten. Ohne
  Historie gibt es keinen Last-Vergleich (ein Einsteiger bekommt nie „du hast 800 % mehr trainiert
  als üblich"), und als „üblich" zählen nur Wochen, in denen wirklich trainiert wurde – sonst läse
  sich das Comeback nach zwei Wochen Urlaub wie eine Verdopplung. Steht nur eine einzige Quelle da
  (typisch: Schlaf von Hand, keine Uhr), wird die Zahl zur Mitte hin gedämpft; eine einzelne Nacht
  trägt keine große Aussage. Kam in sieben Tagen überhaupt kein Wert an – weder von der Uhr noch von
  Hand –, steht dort der Weg zu *Gesundheitsdaten verbinden* statt einer Zahl.
  Und darunter immer der Satz: **eine Einschätzung aus deinen Zahlen, keine medizinische Bewertung.**
- **Ein Ausreißer wird nicht weggemittelt.** Liegt ein einzelner Wert weit daneben – etwa die
  doppelte Wochenlast –, gibt es kein „Grünes Licht", auch wenn Schlaf, HRV und Ruhepuls tadellos
  sind. Die Zahl bleibt stehen, nur die Einordnung wird vorsichtiger, und der Satz darunter nennt
  den Grund. Vorher konnte der Durchschnitt genau das zudecken und riet dann noch „leg Gewicht drauf".

### Wochenrückblick – sonntags Bilanz, montags Fokus
- Neues drittes Segment **„Woche"** in der Analyse: Zeitraum, **drei Höhepunkte**, **ein Fokus für
  nächste Woche** – und erst danach die Zahlen. Training gegen Plan, Sätze, Volumen, stärkster Satz;
  Kalorien- und Eiweißtreue; Gewicht; Schlaf, Schritte, Verbrauch, Ruhepuls, HRV; Mindset.
  Mit Vergleich zur Vorwoche, wo es einen gibt, und mit ‹ › durch frühere Wochen.
- **Sonntags ab 18 Uhr** kommt der Rückblick als Nachricht und Push; ein Tipp öffnet genau die
  Woche, über die er spricht – nicht die neue, noch leere. Lief der Server sonntagabends gerade
  nicht (Neustart, Deploy), wird die Nachricht bis Montagabend nachgetragen.
  Die wöchentliche E-Mail rechnet ab jetzt mit **denselben Zahlen** – App und Mail können sich nicht
  mehr widersprechen.
- Der Fokus entsteht aus festen Regeln, nicht aus einer KI: zu wenige Einheiten → eine mehr;
  Eiweiß unter 85 % → Eiweiß treffen; Schlaf unter Ziel−1 h → früher ins Bett; und so weiter.
  Was es nicht gibt, wird als „keine Daten" gezeigt – nie als 0.

### Offline – im Keller zählt jeder Satz
- **Sätze, Essen, Check-ins, Supplements und Cardio funktionieren ohne Empfang.** Die Eingabe landet
  in einer Warteschlange auf dem Gerät, die Zeile bekommt ihren Haken, und sobald wieder Netz da ist,
  geht alles von selbst raus – beim Zurückkommen der Verbindung, beim Öffnen der App und alle
  30 Sekunden.
- Im Kopf steht dann **„Offline · 3 warten"**; angetippt siehst du, was noch aussteht, und kannst
  von Hand nachhelfen.
- **Nichts geht verloren und nichts kommt doppelt an.** Essen und Cardio legt der Server jedes Mal
  als neue Zeile an – diese Einträge tragen deshalb eine Marke, die schon beim ersten Versuch
  mitgeschickt wird: Bricht die Verbindung ab, *nachdem* der Server gespeichert hat, erkennt er den
  zweiten Anlauf und legt nichts erneut an. Sätze, Check-ins und abgehakte Plan-Supplements landen
  ohnehin immer im selben Eintrag und können deshalb ebenfalls nicht doppelt entstehen; der spontan
  hinzugefügte Supplement-Eintrag („Supplement hinzufügen") trägt seit dieser Version dieselbe Marke
  wie Essen und Cardio. Ein
  Serverneustart (502/503) verwirft nichts, sondern lässt die Einträge liegen. Nur eine echte
  Ablehnung wirft einen Eintrag weg – und dann sagt die Meldung, **welchen**.
- Kann das Gerät gar nichts speichern (Privatmodus, Speicher voll), behauptet die App keinen Erfolg:
  Die Eingabe wird wie ohne Verbindung gemeldet und muss wiederholt werden. Ein Haken für etwas, das
  nirgends liegt, entsteht nicht.
- Die **App startet jetzt auch ohne Netz**: Ein Service Worker hält die Programmhülle vor
  (immer netzwerk-zuerst, damit online nie etwas Altes ausgeliefert wird), und der letzte bekannte
  Stand von Profil, Plan und Tag liegt lokal. Ohne Verbindung kommst du damit direkt ins Training,
  statt auf dem Anmeldebildschirm zu landen.
- **Was Netz braucht, sagt es:** Mengen ändern, Löschen, „Rückgängig", neue Lebensmittel anlegen und
  Abmelden gehen nur online – mit klarer Meldung statt stillem Fehlschlag.
- Vom Startbildschirm aus führen jetzt **Kurzwege** direkt ins Training, ins Essen-Protokoll und
  ins Priming (App-Symbol gedrückt halten).

### Suche – alles in zwei Tipps
- Neues **Lupensymbol** im Kopf. Es findet **Übungen, Rezepte, Lebensmittel, Mindset-Themen und
  App-Funktionen** in einer Liste – „masse" findet die Körpermaße, „waage" den Check-in (dort wird
  das Gewicht eingetragen), „rhythm" den Trainingsrhythmus, „lachs" die Rezepte und das Lebensmittel.
- Umlaute sind egal, die Reihenfolge ist nach Nützlichkeit sortiert, der Cursor bleibt beim Tippen
  im Feld, und ein Treffer führt direkt dorthin. Bei leerem Feld stehen sechs Vorschläge.
- Damit ist auch das Argument entkräftet, dass die App „zu voll" wird: Was selten gebraucht wird,
  darf eine Ebene tiefer liegen, solange man es in zwei Tipps wiederfindet.

### Behoben
- **Rundungs-Token `--r-md` fehlte** – der Rhythmus-Dialog, die Zyklus-Zeile im Kalender und der neue
  Bereitschafts-Hinweis hatten eckige Ecken statt runder. Betraf schon 2.2.0.
- **Check-in-Historie:** Seit die Uhr Verbrauchswerte liefert, passte die Zeile nicht mehr – der
  letzte Wert wurde stumpf abgeschnitten. Jetzt bricht sie sauber ab und sagt, wie viele Werte
  noch dahinter stehen.
- **Technik-Chips** im Trainingsplan waren mit 22 Pixeln Höhe zu klein zum Treffen. Die Trefferfläche
  ist jetzt größer – ohne dabei den Übungsnamen in der Zeile darüber zu überdecken.
- **Der Wochenrückblick blättert nicht mehr endlos in die Vergangenheit.** Der „‹"-Knopf endet bei
  der ersten Woche, in der es überhaupt eine Spur von dir gibt; davor verschwindet er, statt in
  beliebig viele leere Wochen zu führen.
- **Ein Satz, den der Server beim Nachtragen ablehnt, verliert seinen Haken.** Vorher blieb die Zeile
  grün stehen, obwohl der Server den Satz gar nicht hat. Jetzt wird die Übungsliste aus den echten
  Server-Daten neu gezeichnet, und du kannst den Satz erneut eintragen.
- **Die Check-in-Serie fror bei 400 Tagen ein.** Wer länger als gut ein Jahr lückenlos einträgt,
  sah dauerhaft „400 Tage". Die Grenze liegt jetzt bei 2.000 Tagen – über fünf Jahre.
- **Volumen im Wochenrückblick:** Der Höhepunkt-Satz oben und die Zahlenzeile darunter nennen jetzt
  dieselbe Einheit – vorher stand dieselbe Zahl auf einem Bildschirm einmal in Kilogramm und einmal
  in Tonnen.

### Für Technikinteressierte
- Neue Routen: `GET /api/readiness/:userId` und `GET /api/week/:userId?start=` (beide mit `auth` +
  `canAccess` und geprüftem Datum; `/api/week` weist zusätzlich Wochen ab, die zu weit von heute weg
  liegen). `GET /api/home/:userId` liefert zusätzlich `readiness`.
- Neue reine Funktionen in `src/logic.js`: `readinessScore()`, `weekHighlights()`, `weekFocus()`.
- `GET /api/week` liefert `body.perWeek` (Gewichtsrate) nur, wenn zwischen der ersten und der letzten
  Gewichtsmessung der Woche mindestens vier Tage liegen, sonst `null` – aus zwei Messungen an
  aufeinanderfolgenden Tagen entsteht so keine hochgerechnete Wochenrate mehr.
- Neue Spalten (additiv, Migration läuft beim Start): `food_log.client_id`, `cardio_log.client_id`,
  jeweils mit einem eindeutigen Teilindex – das ist der Dublettenschutz der Offline-Warteschlange.
- `POST /api/admin/weekly` (nur Admin) löst jetzt beide Kanäle aus – die Wochen-Mail **und** die
  Wochen-Nachricht in der App, bezogen auf die zuletzt abgeschlossene Woche.
- Neue Dateien: `public/js/search.js`, `public/css/search.css`.
- `public/sw.js` hat jetzt einen fetch-Handler: **network-first** für die Hülle, `/api/*` wird
  **nie** gecacht, der Cache-Name trägt die Version und alte Caches werden beim Aktivieren gelöscht.
- Die Warteschlange liegt in `localStorage` unter `be_outbox`, jeder Eintrag mit Besitzer-ID –
  auf einem geteilten Gerät sieht und sendet niemand die Einträge eines anderen Kontos.

## 2.2.0
Drei Dinge: Der Trainingsrhythmus ist endgültig von der Woche losgelöst, die Apple Watch
schickt ihre Werte von selbst herüber, und die vollsten Bildschirme sind aufgeräumt.

### Trainingsrhythmus mit festen Tagen – ohne Wochentage
- **Dein Zyklus, deine Reihenfolge.** Bisher legte der Rhythmus nur fest, *wann* trainiert wird
  („2 Tage Training, 1 Ruhetag"); *welcher* Tag drankam, rotierte automatisch. Jetzt kannst du
  jeden Platz im Zyklus **namentlich belegen** – z.B. `O1 · U1 · Ruhe · O2 · U2 · Ruhe`. Die Folge
  wiederholt sich endlos und hängt an keinem Wochentag: Sie wandert durch die Woche, so wie du
  trainierst.
- **Editor überarbeitet.** Tippe eine Kachel an und wähle: ein fester Trainingstag aus deinem Plan,
  „Training (automatisch)" oder „Ruhetag". Dazu Verschieben, Entfernen und **Vorlagen**
  („Alle Tage, dann 1 Ruhetag" usw.), die die echten Namen deines Plans einsetzen. Der Zyklus darf
  jetzt bis zu 21 Tage lang sein.
- **Zyklus im Kalender sichtbar.** Unter dem Monat steht deine Folge als Kette – ein Tipp führt in
  den Editor. Damit sieht man endlich, *warum* ein Tag Training oder Ruhe ist.
- **Fest belegte Tage bleiben fest.** Automatische Plätze rotieren nur noch durch die Tage, die
  du *nicht* festgelegt hast. Wird ein Trainingstag umbenannt, zieht der Rhythmus mit; wird er
  gelöscht, fällt der Platz sauber auf „automatisch" zurück.
- **Nur noch eine Stelle für den Rhythmus.** Die Chipreihe „Trainings pro Woche" im Profil ist weg –
  sie hätte einen von Hand gebauten Zyklus stillschweigend überschrieben. Stattdessen steht dort
  deine Folge im Klartext und führt in den Editor. Die Trainings pro Woche (für Kalorien und Eiweiß)
  errechnet die App aus dem Zyklus, auch wenn er nicht sieben Tage lang ist.
- Nach dem Speichern sagt die App direkt, was daraus für **heute** folgt – der Zyklus läuft dort
  weiter, wo du stehst, und beginnt nicht bei jedem Speichern neu.

### Apple Health: die Uhr trägt selbst ein
- **Automatische Übertragung.** Unter *Analyse → Gesundheitsdaten verbinden → Apple Health* erzeugst
  du einen **persönlichen Link**. Ein Kurzbefehl auf dem iPhone schickt deine Werte dorthin – als
  Automation z.B. jede Nacht um 23:50, ohne dass du etwas tust. Anleitung steht im Sheet und in
  **HEALTH-IMPORT.md**.
- **Was ankommt:** Schlaf, Schritte, **aktive Kalorien**, Bewegungsminuten, **Ruhepuls**, **HRV**,
  Gewicht – und auf Wunsch die **Trainings** selbst (Laufen, Rad, Krafttraining …) mit Dauer,
  Distanz, Puls und Verbrauch. Sie landen unter *Training → Cardio*, mit kleinem Apple-Zeichen als
  Herkunftshinweis. Über die Trainings-UUID kommt dieselbe Einheit nie zweimal an.
- **Neue Auswertungen.** In der Analyse gibt es Kacheln und Kurven für **Ø Verbrauch**, **Ruhepuls**
  und **HRV** – aber nur, wenn es dafür auch Werte gibt. Ohne verbundene Uhr bleibt alles wie vorher.
- **Regeln beim Zusammenführen:** Werte, die nur die Uhr kennt, ersetzen den alten Stand. Das
  **Gewicht** wird nur ergänzt, wenn für den Tag noch keines eingetragen ist – von Hand gewogene
  Werte bleiben stehen. Der Link darf ausschließlich Gesundheitswerte schreiben, ist kein Login und
  gibt nichts heraus; „Neu erzeugen" macht den alten sofort ungültig. Höchstens 60 Übertragungen
  pro Stunde.
- Der Weg **von Hand** (Text einfügen oder Datei hochladen) bleibt unverändert erhalten.

### Aufgeräumt
- **Analyse: ein Diagramm statt sieben.** Die Kacheln sind jetzt die Auswahl – tippe „Ø Schlaf" an,
  und darunter steht die Schlafkurve. Vorher standen bis zu sieben Diagramme untereinander und die
  Seite war dreimal so lang, obwohl man immer nur eines angesehen hat. Kacheln ohne Werte fallen weg.
- **Home: Supplements schrumpfen mit dem Tag.** Es stehen nur noch die **offenen** Einnahmen da
  (höchstens drei); abgehakte verschwinden, und am Ende bleibt eine grüne Zeile „Alle genommen".
- **Home: nichts doppelt.** „Maße" und „Foto" standen zweimal auf derselben Seite – beim Check-in
  und unter „Mehr". Jetzt nur noch unter „Mehr".
- Läuft die automatische Übertragung, entfällt die wöchentliche Import-Erinnerung, und das
  Check-in-Formular sagt, dass Schlaf, Schritte und Verbrauch von der Uhr kommen.

### Behoben
- **Rad des Lebens: Maßnahmen lassen sich abhaken.** Die drei Maßnahmen zum Schließen der Lücke
  waren eine reine Liste – jetzt tippst du sie ab, die App merkt sich das („2/3 umgesetzt").
- **Coach-Kontextleiste:** Bei langen Athletennamen wurde abgekürzt, weil „Verlassen" als Text
  daneben stand. Auf schmalen Geräten ist es jetzt ein Symbol – der Name bekommt 35 px mehr.
- **Profil verrät den Gesundheits-Schlüssel nicht mehr:** Er wird ausschließlich über
  `/api/health/link` ausgeliefert, nicht mehr in Anmelde- und Profilantworten mitgeschickt.
- Mindset-Kopfzeile: der Chip „10 Min" hatte 42 statt 44 px Trefferfläche.
- Toter Code entfernt (Sprung-zum-Diagramm samt Aufleucht-Animation, alter Rhythmus-Longpress).

### Für Technikinteressierte
- Neue Spalten (alle Migrationen laufen beim Start automatisch und sind wiederholbar):
  `checkins.active_kcal / exercise_min / resting_hr / hrv`, `users.health_token / health_token_at`,
  `cardio_log.source / ext_id` (eindeutiger Index gegen Dubletten),
  `wheel_assessments.actions_done`.
- Neue Routen: `GET|POST|DELETE /api/health/link` (eingeloggt) und `POST /api/health/push?token=…`
  (ohne Login, nur mit Schlüssel), `PUT /api/mindset/wheel/:id/actions`.
- Das Rhythmus-Muster darf jetzt Objekte enthalten: `{"type":"train","day":"Upper 1"}` neben den
  bisherigen Strings `"train"`/`"rest"`. Alte Muster funktionieren unverändert weiter.

## 2.1.0
Die größte Überarbeitung der Oberfläche seit dem Start: Jeder Reiter öffnet jetzt mit der
Handlung, die gerade dran ist – sichtbar ohne Scrollen und in ein bis zwei Tipps erreichbar.
Alles Übrige rückt eine Ebene tiefer. Funktionen wurden nicht entfernt, sie sind nur besser
sortiert.

- **Home: die „Jetzt"-Karte.** Ganz oben steht deine Karte für heute – Begrüßung, Datum,
  Tagesname („Upper 1" oder „Ruhetag") und **genau eine rote Schaltfläche** mit dem nächsten
  Schritt. Was das ist, entscheidet die App aus deinem Tag: an Trainingstagen „Upper 1 starten",
  morgens das Priming, abends die Reflexion, sonst das nächste Essen. Darunter höchstens vier
  kleine Verknüpfungen (Check-in, Essen loggen, Supplements, Mindset) und ein 7-Tage-Streifen
  zum Kalender. Das große Logo, die doppelte Begrüßung und die separate „Dein Plan"-Karte sind weg.
- **Schneller eintragen – nichts springt mehr.** Check-in, Essen, Supplements und Sätze werden
  an Ort und Stelle aktualisiert: Die Seite lädt nicht neu, die Scroll-Position bleibt, es blitzt
  kein Ladekreis mehr auf. Ein Reiter, den du schon gesehen hast, ist beim Zurückkommen sofort
  wieder da und aktualisiert sich unsichtbar im Hintergrund.
- **Training: Satz für Satz mit einem Daumen.** Jede Satz-Zeile hat einen eigenen **Haken**:
  Gewicht und Wiederholungen werden zusammen gespeichert, die Pause startet automatisch, und der
  Fokus springt in die nächste Zeile. Graue Vorschläge zählen erst als geloggt, wenn du sie
  bestätigst.
  - **Pausen-Leiste über der Navigation:** Countdown (antippen für 60/90/120/180 Sekunden), −15/+15,
    „Fertig" und ein roter Fortschrittsbalken. Hantelrechner und „Abschließen" sitzen in derselben
    Leiste – die alte Werkzeug-Zeile mitten im Plan ist weg.
  - Erledigte Übungen klappen zusammen („3/3 · 50 kg × 12"), die nächste öffnet sich von selbst.
    Kommst du über die Home-Schaltfläche ins Training, ist die erste offene Übung schon aufgeklappt.
  - Alles Seltene (Tag verwalten, Tag anlegen, Kalender, Rhythmus) steckt hinter einem „···" neben
    den Tages-Chips.
- **Ernährung: „Laut Plan als Nächstes".** Ganz oben steht die nächste noch nicht gegessene
  Mahlzeit deines Plans mit „Gegessen ✓" und „Tauschen". Getauschte Mahlzeiten lassen sich
  einzeln wiederherstellen, und was du geloggt hast, ist im Plan als erledigt markiert
  (kein doppeltes Eintragen mehr).
- **Essen hinzufügen ist schneller:** Die Suche ist sofort aktiv, über der Liste stehen deine
  zuletzt und häufig genutzten Lebensmittel (letzte 7 Tage), die Portions-Chips übernehmen die
  richtige Einheit – Milch zeigt „100 ml", Eier „2 Stück" –, und der Mahlzeiten-Slot ist nach
  Uhrzeit vorbelegt. Nach dem Hinzufügen bleibt das Fenster offen und zählt mit.
  Kalorien- und Makroziele kommen aus einer einzigen Quelle (deinem Plan); über dem Ziel zeigt
  der Balken das ehrlich an („+124 g") statt bei 100 % stehen zu bleiben.
- **Mindset: ruhiger Player, eine Liste.** Der Reiter Heute beginnt mit einer Karte, die nur den
  nächsten Schritt zeigt („Dein Morgen" → „Priming erledigt ✓" → „Abend-Reflexion" →
  „Tag abgerundet ✓"). Darunter **eine** Checkliste für den Tag statt Kacheln plus zweiter
  Übersicht; Rad des Lebens und Wochencheck stehen als eigene Gruppe „Woche & Monat" darunter.
  Der Vollbild-Player fragt beim Abbrechen in seiner eigenen Leiste nach („Abbrechen" / „Weiter")
  statt in einem Systemfenster.
- **Analyse: Statuskarte und lesbare Diagramme.** „Körper" beginnt mit einer Statuskarte
  (aktuelles Gewicht, Veränderung pro Woche, Einordnung zu deinem Ziel, ein nächster Schritt);
  die vier Kacheln zeigen den Abstand zum Ziel und springen zum passenden Diagramm.
  Die Diagramme haben runde Achsenwerte, mindestens 11 px große Beschriftungen, eine
  7-Tage-Mittellinie bei Schlaf, Wasser und Schritten und markieren die laufende Woche als
  unfertig. Übungen lassen sich antippen: Verlauf, Bestleistung und die letzten Einheiten.
- **Profil als Anlaufstelle.** Alles rund um dein Konto in einer Liste mit Unterzeilen – Ziele,
  Erinnerungen, Push, Gesundheitsdaten, Teilen, Export, Passwort. Was du änderst, wird direkt
  gespeichert; Fehler stehen am Feld statt als Meldung darüber.
- **Coach-Ansicht.** Betrittst du einen Athleten, sagt eine feste Leiste unter dem Kopf, wen du
  gerade siehst (Bild, Name, Status, „Verlassen") – der alte „‹ Zurück"-Reiter entfällt.
  Die Athletenliste ist **eine** nach Dringlichkeit sortierte Liste (Alarm › Beobachten › OK)
  mit dem wichtigsten Grund je Zeile; den zweiten, abweichenden Aufmerksamkeits-Kasten gibt es
  nicht mehr. Im Athleten-Kontext zeigt das Training den Plan als kompakte Zeilen zum Bearbeiten
  statt des Satz-Rasters. Nachrichten laufen als Unterhaltung je Athlet (beide Richtungen),
  Coaches haben eigene Reiter für Nachrichten und Vorlagen.
- **Design-Auffrischung.** Ein durchgängiges Icon-Set aus SVG statt Emoji (Emoji bleiben, wo sie
  hingehören: Feiern, Erfolge, Mindset-Illustrationen, Ernährungs-Tags, Onboarding). Eine Familie
  von Schaltflächen, Chips, Karten, Zeilen und Bottom-Sheets in allen Reitern; alles Antippbare
  ist **mindestens 44 px** groß; Meldungen erscheinen einzeln nacheinander statt übereinander;
  größere Abstände und höhere Kontraste (Hilfstexte sind jetzt gut lesbar). Löschen fragt in
  einem Bottom-Sheet nach – kein Browser-Dialog mehr – und lässt sich meistens per
  „Rückgängig" zurücknehmen.

**Behobene Fehler**
- **Satz-Vorschläge zählten als geloggt.** Ein grauer Vorschlag im Feld wurde beim Antippen als
  echter Satz gewertet – Fortschritt, „Geschafft"-Ring und die Progression rechneten mit Zahlen,
  die du nie bestätigt hast. Ein Satz zählt jetzt erst nach dem Haken bzw. nach einer Eingabe.
- **Fehlgeschlagenes Speichern sah aus wie Erfolg.** Bricht das Speichern eines Satzes ab, wird die
  Zeile jetzt als nicht gespeichert markiert und aus dem Fortschritt herausgerechnet.
- **Übungs-Verlauf war abgeschnitten.** Bei mehr als 500 geloggten Sätzen fehlten ältere Einheiten
  („1 Einheit", obwohl es 22 waren). Verlauf und Kurve holen die Übung jetzt vollständig.
- **„Cardio diese Woche" meinte zweimal etwas anderes.** Training und Analyse zeigten unter
  derselben Überschrift verschiedene Zahlen (rollende 7 Tage gegen Kalenderwoche). Beide rechnen
  jetzt ab Montag.
- **Rezept-Portionen wurden als Gramm gelesen.** Eine geloggte Rezept-Portion ließ sich über
  „Menge ändern" auf das Hundertfache aufblähen – behoben, eine Portion ist keine Grammzahl mehr.
- **Plan-Summen wanderten beim Tauschen.** Die Kalorien der Plan-Mahlzeiten wurden beim
  Wiederherstellen gerundet; nach mehreren Tausch-Runden stimmte die Tagessumme nicht mehr.
- **Milliliter im Ernährungs-Sheet.** Milch, Sojadrink & Co. boten „100 g" an, obwohl sie in ml
  gemessen werden. Die Einheit kommt jetzt aus dem Lebensmittel selbst (auch nach `npm run seed`).
- **„Zuletzt / Häufig" brauchte sieben Abrufe.** Die Vorschlagsliste im Essen-Sheet holt ihre
  Daten jetzt in einer einzigen Anfrage.
- **Einführungs-Tour konnte die App blockieren.** Wechselte man während der Tour den Reiter, blieb
  eine unsichtbare Ebene liegen und schluckte alle Tipps. Die Tour endet jetzt beim Reiterwechsel;
  zusätzlich kann eine nie sichtbare Ebene keine Eingaben mehr abfangen. Die Tour-Karte blitzt
  auch nicht mehr unpositioniert über dem Kopfbereich auf.
- **Postfach markierte alles als gelesen.** Das bloße Öffnen der Nachrichten-Übersicht setzte alle
  Nachrichten auf gelesen; jetzt geschieht das erst beim Öffnen einer Unterhaltung, und die Glocke
  zeigt die tatsächlich ungelesenen Nachrichten.
- **„Rückgängig" bei erledigten Notizen lief ins Leere** – die passende Server-Route fehlte, jetzt
  ist sie da.
- **Verwaltung: „zuletzt aktiv"** steht wieder in der Nutzerliste und im Nutzer-Sheet
  („heute" / „gestern" / „vor 3 Tagen" / „nie aktiv").
- **Kein Absturz mehr bei abgelaufener Sitzung** im Coach-Postfach und beim Reiterwechsel.
- **Die Mindset-Startleiste** („Challenge starten") verschwand hinter der Pausen-Leiste, wenn ein
  Trainings-Timer lief – sie rückt jetzt darauf.
- **Server startet auch mit fehlerhafter Migration.** Ein einzelner fehlgeschlagener Schritt bricht
  den Start nicht mehr ab, sondern erscheint als eine Zeile im Log.
- Kleineres: der Klick-Bereich der Segment-Umschalter reicht über den ganzen Knopf; doppelte
  CSS-Regeln (Statuszeile, Tour) entfernt; die Vorlagen-Hinweise nennen wieder den richtigen
  Menüpunkt; `/sw.js` und alle Dateiverweise tragen automatisch die Version aus `package.json`
  (nach einem Update lädt der Browser garantiert die neuen Dateien).

**Technisch**
- Das Frontend liegt jetzt in `public/js/core.js, home.js, training.js, diet.js, analysis.js,
  coach.js, account.js, shell.js` statt in einer großen `app.js`; das CSS in `public/app.css`
  (Design-System) plus `public/css/<bereich>.css`. Mindset bleibt in `public/mindset.js` und
  `public/mindset.css`.
- Neue bzw. erweiterte Server-Routen: `GET /api/home/:userId` (eine Anfrage statt neun),
  `GET /api/progression/:userId?day=`, `GET /api/foodlog/:userId/recent`,
  `GET /api/messages/thread/:athleteId` + `POST /api/messages/:athleteId/read-thread`,
  `POST /api/exercise-notes/:id/flag`, `PUT /api/training-days/:id/reorder`,
  `GET /api/logs/:userId?exercise_id=`, `GET /api/ai/status`, Plan-Schnappschüsse in
  `plan_versions` mit `POST /api/meals/restore-plan`. Neue Spalten `food_log.meal_id`,
  `meals.recipe_id`, `foods.unit`, `progress_photos.thumb` – alle Migrationen laufen automatisch
  und lassen bestehende Daten unangetastet.
- **Datensicherheit: Datenbank wird regelmäßig zusammengeführt.** SQLite schrieb neue Einträge in eine
  Begleitdatei (`data.db-wal`), die nie zurückgeschrieben wurde – eine Sicherungskopie von `data.db`
  allein wäre praktisch leer gewesen. Die App führt jetzt alle 5 Minuten, stündlich und beim
  Herunterfahren zusammen; ein Backup der einen Datei genügt.
- **Eiweiß- und Kalorienziele folgen deinem aktuellen Gewicht** (jüngster Check-in statt des fixen
  Startgewichts) und entsprechen wieder deinem Ernährungsplan – vorher konnte das Ziel dem Plan
  widersprechen, sodass der eigene Plan als „über dem Ziel" galt.
- **Trainings-Erinnerung lässt sich wirklich abschalten:** „Aus" im Profil wurde vom Zeitgeber
  ignoriert (er erinnerte weiter um 6 Uhr).
- **Abend-Reflexion und Wochencheck** werden pro Tag nur noch einmal gespeichert; ein zweiter
  Durchlauf aktualisiert den Eintrag, statt den Verlauf doppelt zu zählen.
- **Frisch angelegte Konten:** Kalender und Kalorienziel widersprachen sich am ersten Tag
  („Ruhetag" im Kalender, Trainingstag beim Kalorienziel) – behoben.

## 2.0.0
- **Mindset-Modul (neu, eigener Reiter 🧠):** Mentale Routinen bekommen denselben festen Platz wie Training und Ernährung. Inspiriert von den Prinzipien aus „Unleash the Power Within" – komplett in eigenen Worten, ohne Workbook-Texte. Ausführliche Anleitung: **MINDSET.md**.
  - **Morgen-Priming:** Geführter Vollbild-Player mit sechs Schritten (Ankommen · Power-Atmung · Dankbarkeit · Energie & Heilung · 3 to Thrive · Abschluss), wählbar 5 / 10 / 15 Minuten, Ring-Timer, animierter Atem-Taktgeber, Vibration beim Schrittwechsel, optionaler Signalton 🔔, Bildschirm bleibt an, Pause/Weiter. Die Session wird gespeichert, sobald der Player durch ist – drei Tagesergebnisse und Energie lassen sich danach optional ergänzen.
  - **Kurz-Tools:** Power-Atmung 1-4-2 (10 Atemzüge, „Sanft" 4 / 16 / 8 s oder „Standard" 5 / 20 / 10 s), State-Change 60 s (Körper · Fokus · Sprache), Abend-Reflexion (vier Fragen zum Nachdenken, nach der letzten Frage sofort gespeichert, Energie/Stimmung/Notiz optional), Frage des Tages und ein Emotionaler Wochencheck.
  - **Rad des Lebens:** Sieben Lebensbereiche (Körper, Gefühle, Beziehungen, Zeit, Karriere, Finanzen, Beitrag) per Schieberegler bewerten, Zielwerte setzen, Fokus-Bereich und drei Maßnahmen festhalten. Radar-Grafik, Ø, Balance-Index, schwächster Bereich, Entwicklung je Bereich mit Delta und Mini-Verlauf, Verlauf aller Standortbestimmungen. Eine Bewertung pro Tag, jederzeit bearbeitbar („Bearbeiten" ändert die Bewertung, statt eine zweite anzulegen). Erinnerung alle vier Wochen.
  - **Vital-Challenge (10 oder 30 Tage):** Regeln aus „Geschenken" (annehmen) und „Giften" (weglassen) selbst zusammenstellen. Krafttraining, Ausdauer, Wasser, Atmung und Dankbarkeit werden automatisch aus deinen Logs erkannt, der Rest wird abgehakt. Tages-Punkte, Einhaltungsquote, Feier zum Abschluss.
  - **Wissen:** Zwölf kompakte Karten (Priming, sechs Grundbedürfnisse, Triade des Zustands, Erfolgsformel, Glaubenssätze, Incantation, Rapport, Meisterprinzipien, Rad des Lebens, 3-to-5 to Thrive, Leidenschaft & Vision, Emotionales Zuhause) mit eigenen Arbeitsblättern, die geräteübergreifend gespeichert werden und privat bleiben – nur der Athlet selbst sieht sie. Deine Incantation trägst du selbst ein – die App liefert keinen vorgefertigten Text.
  - **Home:** Mindset-Karte unter der Begrüßung (Priming starten / erledigt · Abend-Reflexion · Challenge-Tag · Rad fällig) und ein fünfter „Heute geschafft"-Ring 🧠.
  - **Motivation:** XP für Priming, Reflexion, Atmung, Rad und Challenge sowie sieben neue Erfolge (Erstes Priming, 7 / 30 Tage Priming, Rad des Lebens, 3 Standortbestimmungen, Vital-Challenge geschafft, 50 Atemsessions).
  - **Erinnerungen:** Im Profil unter „Mindset-Erinnerungen": Priming-Push zur Wunschstunde (5–10 Uhr, aus = Standard) und Abend-Reflexion um 20 Uhr. Push-Klicks springen direkt in den Mindset-Reiter (Deep-Links `#mindset`, `#mindset/wheel`, `#mindset/challenge`).
  - **Coach:** Sieht im Athleten-Kontext Werte, Streaks, Rad-Bewertungen und den Challenge-Stand seiner Athleten (nur lesend). Arbeitsblätter, Notizen und persönliche Texte bleiben privat – die sieht nur der Athlet.
  - Neue Tabellen `mindset_sessions`, `wheel_assessments`, `challenges`, `challenge_days`, `mindset_entries` sowie Spalten `mindset_push_hour`, `evening_push`, `priming_minutes`, `needs_top` in `users` – automatische Migration beim Start. Der Daten-Export enthält alle Mindset-Daten.
- **Bug: Satz speichern konnte hängen bleiben.** Beim Loggen eines Satzes fehlte intern eine Variable (`logTimers`); je nach Browser brach das Speichern mit einem Fehler ab. Behoben.
- **Bug: Zeitzone.** „Heute" wurde bisher in UTC berechnet – Einträge zwischen Mitternacht und 1 bzw. 2 Uhr landeten am Vortag, und Push-Uhrzeiten stimmten nicht mit der deutschen Zeit überein. Server und App rechnen jetzt in deutscher Zeit (konfigurierbar über `APP_TZ`, Standard `Europe/Berlin`); die Uhrzeiten im Profil sind ausdrücklich „deutsche Zeit".
- **Bug: Excel-Import** übernahm den gewählten Tagestyp (Training/Ruhetag) nicht – behoben.
- **Bug: Streak-Warnung** um 19 Uhr ignorierte durch Joker geschützte Tage und warnte zu früh – behoben.
- **Streak-Joker zurück beim Nachtragen:** Wurde ein Tag automatisch durch einen Joker geschützt und trägst du ihn später doch nach, bekommst du den Joker zurück (Hinweis beim Speichern).
- **Bug: geteilte und globale Rezepte** ließen sich teilweise weder loggen noch in den Einkaufswagen legen – die Sichtbarkeit ist jetzt überall einheitlich.
- **Bug: Coach-Profil.** Änderte ein Coach nur seinen Namen, wurden andere Profilfelder geleert – behoben. Persönliche Ziele (Schlaf/Schritte/Wasser) lassen sich jetzt durch Leeren des Felds wieder auf den Standard setzen.
- **Bug: Onboarding aus der App** heraus („Plan neu einrichten") lag über der laufenden App; jetzt wird die App ausgeblendet, und es gibt einen Abbrechen-Button.
- **Sicherheit & Robustheit (umfangreiche Überarbeitung):**
  - Alle Nutzertexte (Übungs-, Tages-, Rezept-, Lebensmittel-, Athletennamen, Nachrichten, Notizen) werden beim Anzeigen konsequent maskiert; der Server begrenzt Längen und entfernt HTML-Zeichen (`<`, `>`) aus Freitext.
  - Rolle und Coach-Zuordnung werden bei jeder Anfrage frisch aus der Datenbank gelesen (Rollenwechsel/Sperrungen wirken sofort). Verwaltungs-Routen (Wochenrückblick, Joker-Verarbeitung) nur noch für Admins.
  - Jede Eingabe wird geprüft: Datumsangaben, Auswahlwerte (Tagestyp, Ziel, Phase, Erfahrung, Intensität …), Zahlenbereiche, Bild-Uploads (nur PNG/JPEG/WebP), Video-Links (nur http/https), Passwort-Regeln überall. Sätze lassen sich nur für Übungen aus eigenen Plänen loggen (Satz-Nummer 1–20).
  - Monatsziele: Monatsangabe wird geprüft, Zielwerte müssen ≥ 1 sein, abgeschlossene Monate werden nicht mehr überschrieben, gutschreiben kann nur der Athlet selbst.
  - Keine versteckten Dateien mehr aus dem `public/`-Ordner abrufbar; unbekannte `/api/…`-Adressen liefern einen klaren JSON-404.
  - Teilen-Links laufen nach 30 Tagen ab; beim Übernehmen werden Werte geprüft.
  - Abgelaufene Anmeldung: Die App lädt automatisch neu und zeigt den Login (statt stiller Fehler).
  - Schnell-Check-in, Tag setzen, Essen loggen, Einkaufswagen, Cardio löschen und Nachrichten zeigen jetzt echte Fehlermeldungen statt eines falschen „✓".
  - Login ist ein echtes Formular (Enter-Taste, Passwort-Manager, Autovervollständigung); der Service Worker wird immer registriert, damit Push-Klicks die App zuverlässig öffnen.
  - Rezept teilen sendet dem Empfänger einen Push; Nachrichten Athlet → Coach lösen einen Push beim Coach aus.
  - Coaches können keine Athleten mehr „abwerben": Ist ein Athlet schon einem anderen Coach zugeordnet, lehnt „Athlet hinzufügen" ab – umbuchen kann nur ein Admin. Coach-Zuordnung nur noch für Athleten-Konten; wer die Coach-Rolle verliert, betreut automatisch niemanden mehr.
  - KI-Analyse: 60 Sekunden Abkühlzeit pro Coach, 30 Sekunden Zeitlimit, Athletendaten werden der KI strikt als Daten (JSON) übergeben – nicht mehr als Teil der Anweisung.
  - Wochenrückblick nur an bestätigte E-Mail-Adressen; Push-Abos nur mit HTTPS-Endpunkt; nur das eigene Postfach lässt sich als gelesen markieren; Coach-erstellte Konten bekommen die Bestätigungs-Mail.
  - Ungültiges JSON in einer Anfrage liefert jetzt einen sauberen 400-Fehler statt „Serverfehler"; Mahlzeitenplan-Erstellung und Plan-Vorlagen laufen als Transaktion (bei einem Fehler bleibt der alte Plan erhalten).
  - Daten-Export (DSGVO) deutlich vollständiger: Pläne, Supplements, Monatsziele, Joker, Einkaufswagen, Nachrichten, Foto-Metadaten und alle Mindset-Daten.
  - Coach im Athleten-Kontext: „Trainingsrhythmus anpassen" und Einkaufswagen nur im eigenen Konto; der Rezept-Filter nutzt die Abneigungen des betrachteten Athleten.
  - Versionsnummer aus einer einzigen Quelle (`package.json`) – Cache-Buster und Versionsanzeige laufen nicht mehr auseinander. Externe Schriftarten-Links entfernt (kein Abruf bei Google mehr).
  - Kleineres: Tab-Touren pro Gerät, Glocken-Badge nach dem Lesen korrekt, Sheets starten immer oben, Admin-Passwortfelder maskiert, Erfolge-Abfrage gebündelt, Speicher der Anmelde-Limits wird stündlich aufgeräumt, toter Code entfernt (alte Einkaufsliste, Recovery-Route, Health-Import-Modul, „Mehr"-Reiter).

## 1.16.0
- **Ernährung neu strukturiert:** Klare Reiter **Heute · Plan · Rezepte · Einkauf**. Jedes Feature hat jetzt einen festen Platz.
- **Einkaufswagen (neu, eigener Reiter):** Persistente Einkaufsliste – Artikel aus dem Plan übernehmen („📋 Aus Plan übernehmen"), Zutaten aus Rezepten hineinlegen, selbst hinzufügen; alles abhakbar, einzeln löschbar, „Erledigte weg" / „Wagen leeren". Geräteübergreifend gespeichert (neue Tabelle `cart_items`, automatische Migration).
- **Rezepte:** Neuer Button „🛒 Zutaten in den Einkaufswagen".
- **Plan-Reiter aufgeräumt:** „Plan neu erstellen" und „Ausschließen" stecken jetzt in einem dezenten **⚙️ Plan-Optionen**-Menü statt als große Buttons.

## 1.15.1
- **Bug: untere Tab-Leiste verdeckt Inhalt** – mehr Abstand am Seitenende, sodass der letzte Inhalt immer über die Leiste gescrollt werden kann.
- **„Heute geschafft": Ernährung** wird jetzt grün, **sobald das Kalorienziel erreicht ist** (auch wenn drüber) – unabhängig davon, ob Protein/Carbs/Fett schon passen.
- **„Heute geschafft": Check-in** wird grün, **sobald für heute überhaupt etwas eingetragen** wurde (vorher blieb er praktisch immer offen).
- **Mehrere Tage nachtragen neu:** Werte einmal eintragen, dann mehrere Tage auswählen und **gemeinsam** übernehmen (statt jeden Tag einzeln) – die Eingaben bleiben beim Auswählen erhalten.
- Rezept-„Teilen"-Button heißt jetzt schlicht **„Per Link teilen"**.

## 1.15.0
- **Essen hinzufügen neu strukturiert:** Statt eines großen Barcode-Buttons gibt es im „+ Essen hinzufügen"-Sheet jetzt vier klare Reiter: **Liste** (suchen), **📷 Scan** (Barcode direkt mit Kamera), **Manuell** (Bezeichnung + Kalorien/Makros eintragen) und **Neu** (eigenes Lebensmittel anlegen). Der Scanner steckt direkt im „Scan"-Reiter.
- **Barcode-Fokus verbessert:** Höhere Kamera-Auflösung + Anforderung von Dauer-Autofokus (hilft bei kleinen Codes; teils hardwareabhängig).
- **Untere Tab-Leiste ruhiger:** Auf dem iPhone „wanderte" die Navigationsleiste beim Scrollen manchmal ein Stück mit – durch eine eigene GPU-Ebene behoben.
- **Einkaufsliste überarbeitet:** Auswahl für **3 Tage / 5 Tage / 1 Woche** (Mengen werden passend skaliert) und **abhakbare** Einträge (durchgestrichen, Fortschrittsanzeige).
- **Ernährungs-Plan-Buttons dezenter** (Einkaufsliste / Ausschließen / Plan neu erstellen als Pills).
- **Rezepte:** Großer roter „+ Eigenes Rezept hinzufügen"-Button am Ende der Liste.
- **Hinweis-Boxen:** Das Ausblenden ist jetzt überall ein dezentes ✕ (auch beim globalen Hinweis-Mechanismus, der vorher die klobige „− ✕"-Leiste einfügte).

## 1.14.0
- **Barcode-Scanner auf dem iPhone:** Der Kamera-Scan funktioniert jetzt auch in iOS-Safari (das kein natives `BarcodeDetector` hat). Die Kamera öffnet sich, erkennt den Strichcode automatisch (über die nachgeladene ZXing-Bibliothek) und trägt die Nummer ein → Produktsuche startet. Auf Android läuft weiterhin der schnelle native Weg; manuelle Eingabe bleibt als Rückfall. (Hinweis: braucht HTTPS + Kamera-Erlaubnis; ZXing wird beim ersten Scan aus dem Netz geladen.)
- **„Heute geschafft" jetzt zielbasiert:** Die Ringe werden erst grün, wenn das Ziel wirklich erreicht ist – Ernährung erst im Kalorien-Korridor (nicht schon beim ersten Eintrag), Check-in erst mit allen Werten + erreichten Schlaf-/Schritte-/Wasser-Zielen, Supplements erst komplett. An Trainingstagen kommt ein vierter Ring „Training" dazu (grün, wenn alle geplanten Sätze geloggt sind).
- **Mehrere Tage nachtragen (Bulk):** Im „Werte eintragen"-Bereich gibt es jetzt „📅 Mehrere Tage" – die letzten 10 Tage auf einen Blick (Gewicht/Schlaf/Schritte/Wasser) und alle gemeinsam speichern.
- **Einführungs-Tour nur einmal pro Konto:** Die Tour wird serverseitig als gesehen markiert und erscheint nicht mehr bei jedem neuen Gerät/Browser. Über „Einführung erneut ansehen" im Profil jederzeit wiederholbar. Neue Spalte `users.tour_done` (automatische Migration).
- **Profilbild groß:** Ein hochgeladenes Bild erscheint jetzt auch groß im Profil und als Avatar in der Coach-Athletenliste und im Athleten-Dashboard (mit Status-Punkt).
- **Zwischen Tabs wischen:** Auf dem Handy links/rechts wischen, um zwischen Home/Training/Ernährung/Analyse zu wechseln.
- **Info-Hinweise:** Das Ausblenden-Symbol an Hinweis-Boxen ist jetzt ein dezentes ✕ statt der klobigen Doppel-Schaltfläche.

## 1.13.1
- **Ernährung „Heute" aufgeräumt:** Die Schnell-Aktionen sind jetzt „+ Essen hinzufügen" und „📷 Barcode" nebeneinander – die redundanten Kacheln „Aus Plan"/„Rezepte" sind weg (dafür gibt es die Reiter oben).
- **Kalorien-Ring zielabhängig eingefärbt:** Wird das Ziel überschritten, zeigt der Ring das je nach Ziel an – beim Abnehmen rot („zu viel"), beim Aufbau grün („Überschuss"), sonst neutral.
- **Makro-Rechner mit Suche:** Lebensmittel lassen sich jetzt per Suchfeld finden (statt langer Dropdown-Liste).
- „als gegessen"-Buttons in Plan & Rezept klarer beschriftet („Gegessen – ins Protokoll").

## 1.13.0
- **Streak-Joker (Streak-Schutz):** Vergisst du einen Tag, springt automatisch ein Joker ein und rettet deine Serie – sie reißt nicht. Du startest mit 1 Joker und bekommst pro aktiver Woche +1 dazu (max. 2). Der aktuelle Stand steht als 🛡️-Badge neben der Streak auf der Startseite (antippen für Erklärung). Wird ein Joker eingesetzt, gibt es eine Push-Mitteilung. Alternativ kannst du vergessene Tage weiterhin selbst nachtragen.
- Neue Tabelle `streak_freeze_log` + Spalten `streak_freezes`/`freeze_last_grant` in `users` (automatische Migration). Die Streak zählt geschützte Tage wie Check-ins.

## 1.12.0
- **Tage nachtragen:** Vergangene Tage lassen sich jetzt für Gewicht/Schlaf/Schritte/Wasser nachpflegen. Im „Werte eintragen"-Bereich auf der Startseite die letzten 7 Tage als Chips wählbar (mit ✓-Markierung für bereits ausgefüllte Tage) – schließt auch Lücken in der Streak.
- **Tägliche Ziele „Heute geschafft":** Drei kleine Ringe auf der Startseite (Check-in · Ernährung · Supplements). Sobald alle drei voll sind, gibt es eine kleine Feier – der tägliche Motivations-Anker.
- **Streak aufgewertet:** Der Tages-Streak ist prominenter, zeigt „heute schon dran ✓" bzw. „in Gefahr", wenn noch nichts eingetragen ist. Abends (~19 Uhr) gibt es bei aktiver Streak ohne heutigen Eintrag eine „Streak in Gefahr"-Push. Nach einer Pause begrüßt ein „Willkommen zurück" und holt sanft in den Rhythmus zurück.
- **Feier-Momente:** Konfetti + Pop-Animation bei Level-up, Streak-Meilensteinen (7/30/100 …) und neuen Erfolgen.
- Bewusst KEIN XP-Abzug bei Inaktivität: XP werden aus echter Aktivität berechnet und nur die Streak reißt – das motiviert, ohne zu bestrafen.

## 1.11.0
- **Dark Mode als fester Standard:** Die App ist jetzt durchgehend dunkel (unabhängig von der System-Einstellung) – passt zur Marke und ist überall einheitlich.
- **Kalender-Widget-Bug behoben:** Home-Widget („Dein Plan") und der volle Kalender konnten für denselben Tag Unterschiedliches anzeigen (z.B. Widget „Ruhetag", Kalender „Upper 1"), wenn ein Ruhetag auf einen Trainingstag fiel. Beide nutzen jetzt EXAKT dieselbe Engine (`rhythmRange`, am frühesten Eintrag verankert) – sie stimmen immer überein und reagieren gleichzeitig auf Tag-Änderungen. Mit Tests abgesichert.
- **Supplements aufgeräumt:** Auf der Startseite gibt es nur noch die Tages-Checkliste (der doppelte „Supplements"-Button ist weg; die Liste ist immer erreichbar, auch ohne zugewiesene Supplements). Aus dem Ernährungs-Plan sind Supplements raus – sie gehören nicht zu den Nährwerten, sondern in ihren eigenen Bereich.
- **Ernährung:** Die Buttons „als gegessen" und „Mahlzeit tauschen" sitzen in den Plan-Mahlzeiten nicht mehr am Kartenrand, sondern mit Abstand und mittig.
- **Coach-Athleten-Dashboard überarbeitet:** Statt einer Wand aus 10 Buttons jetzt Identitäts-Pills + Schnell-Status (Gewicht, letztes Training), zwei Primäraktionen (Plan/Nachricht) und zwei aufgeräumte iOS-Listen („Verwalten", „Ansehen").
- **Als App aufs iPhone (PWA):** Einmaliger, schließbarer Hinweis auf iOS, wie man die App über „Teilen → Zum Home-Bildschirm" installiert (erscheint nur in Safari und nur, solange nicht schon installiert). Neue Anleitung APP-INSTALLIEREN.md. Web und installierte App teilen Konto und Daten.

## 1.10.0
- **Apple-Designsprache:** Durchgängig auf die System-Schrift (SF Pro / system-ui) umgestellt, die großen Titel sind jetzt iOS-„Large Titles" (statt der schmalen Versal-Schrift). Feinere iOS-Farben, Abstände, Radien, weichere Schatten und ein neuer Segment-Umschalter. Gilt automatisch für alle Bildschirme.
- **Coach-Übersicht aufgeräumt & handlungsorientiert:** „Braucht Aufmerksamkeit" steht jetzt ganz oben (mit positivem „Alles im grünen Bereich"-Zustand, wenn nichts ansteht), darunter kompakte Kennzahlen und direkt die Athletenliste. Jede Athleten-Zeile hat jetzt Direkt-Aktionen (✉️ Nachricht, ✏️ Plan), Einblicke (Trend/Ziele/Aktivität) und Rundnachricht sind nach unten gewandert.
- **Ernährung „Heute" neu gedacht:** Großer Kalorien-Ring (zeigt die verbleibenden kcal) mit farbigen Makro-Balken (Protein/Carbs/Fett vs. Ziel), eine klare Primäraktion „+ Essen hinzufügen" plus drei schnelle Wege (Barcode/Plan/Rezepte). Das Tagesprotokoll ist jetzt nach Mahlzeit gruppiert (Frühstück/Mittag/Abend …) mit kcal-Summe je Mahlzeit – übersichtlicher als eine lange Liste.
- **Training mit Fortschritts-Ring:** Der „Heutiges Training"-Kopf zeigt jetzt einen Ring mit Prozent erledigter Sätze (grün bei 100 %) – dieselbe Ring-Sprache wie bei der Ernährung – samt „Training abschließen".
- **Analyse mit Glance-Karten (Apple-Health-Stil):** Oben im Körper-Tab vier Karten (Gewicht, Ø Schlaf, Ø Schritte, Ø Wasser) mit grünem Punkt, sobald das persönliche Ziel erreicht ist – die ausführlichen Verlaufs-Charts folgen darunter.

## 1.9.0
- **Coach-Schnellaktionen:** In der „Braucht Aufmerksamkeit"-Liste gibt es jetzt direkte Aktionen je Athlet – ✉️ Schnellnachricht (ohne erst das Dashboard zu öffnen) und ✏️ Sprung direkt in die Plan-Bearbeitung.
- **Supplements nach Tageszeit gruppiert:** Die Tages-Checkliste ordnet zugewiesene Supplements jetzt nach Kategorie/Tageszeit (Morgens, Pre-Workout, Nach dem Training, Abends …) statt als eine lange Liste.
- **Individuelle Gesundheitsziele:** Schlaf-, Schritte- und Wasser-Ziel sind pro Nutzer im Profil einstellbar und erscheinen als Ziel-Linien in der Analyse (leer = Standard 8 h / 10.000 / 3 L). Der Coach sieht die individuellen Ziele im Athleten-Verlauf.
- **Push-Zeitpunkt pro Nutzer:** Die Uhrzeit der täglichen Trainings-Erinnerung lässt sich im Profil wählen (Standard 6 Uhr Serverzeit). Die Erinnerung wird pro Nutzer genau einmal am Tag und nur an Trainingstagen verschickt.
- Neue Spalten in `users`: sleep_goal, steps_goal, water_goal, push_hour (automatische Migration).

## 1.8.0
- **Excel-Import für Coaches (neu):** Bestehende Trainings- und Ernährungspläne lassen sich direkt aus einer Excel-Datei (.xlsx) importieren. Der Coach öffnet einen Athleten → „📥 Aus Excel importieren", wählt die Datei, ordnet die Spalten zu (die App rät die Zuordnung automatisch) und sieht eine Vorschau, bevor er übernimmt.
- Flexible Spalten-Zuordnung: funktioniert mit unterschiedlich aufgebauten Tabellen, nicht nur einer festen Vorlage. Leere Tag-/Mahlzeit-Zellen werden automatisch dem vorherigen Block zugeordnet (wie in echten Coach-Tabellen üblich).
- Deckt Training (Übung, Sätze, Wdh., Gewicht, Notiz) und Ernährung (Mahlzeit, Lebensmittel, Menge, kcal, Makros) ab.
- Anleitung dazu in EXCEL-IMPORT.md.
- Neue Abhängigkeit: xlsx (SheetJS) – wird beim Deploy automatisch installiert.

## 1.7.1
- Einführungs-Tour: Während die Tour läuft, ist das Scrollen (und Tippen) im Hintergrund jetzt gesperrt. Vorher konnte man die Seite hinter dem Spotlight verschieben, wodurch der rote Rahmen nicht mehr zum erklärten Element passte. Scrollen innerhalb der Hinweis-Karte (bei langem Text) bleibt möglich.

## 1.7.0
- **Supplements komplett neu als Tages-Checkliste:** Supplements sind nicht mehr zwischen den Mahlzeiten (wo Nährwerte zählten, was bei Supps unpassend war), sondern haben einen eigenen Bereich. Man hakt täglich ab, was man genommen hat, kann die Menge pro Eintrag anpassen und spontan eigene Supplements ergänzen, die man zusätzlich genommen hat.
- **Supplement-Widget auf der Startseite:** Zeigt die heutige Abhakliste mit Fortschritt (z.B. „2/4 genommen") – direkt von der Home abhakbar, ohne in einen Unterbereich zu wechseln.
- Der Coach weist Supplements weiterhin zu (Pflicht/optional, eigene Dosis); diese erscheinen oben in der Checkliste, eigene Ergänzungen darunter.
- Supplement-Tausch im Ernährungsplan: „Mahlzeit tauschen" zeigt jetzt nur noch Rezepte der passenden Kategorie (Frühstück zeigt Frühstücks-Rezepte usw.).
- Neue Tabelle: supplement_intake (automatische Migration).

## 1.6.1
- Startseite: BE-INEVITABLE-Logo nimmt deutlich weniger Platz weg. Das quadratische Logobild hatte oben/unten breite schwarze Ränder (über 80% der Höhe) – jetzt wird eine schmale Banner-Version genutzt und der überflüssige Kasten drumherum entfällt. Mehr Inhalt sofort sichtbar.

## 1.6.0
- **Monatsziele (neu):** Jeder Athlet bekommt automatisch ein Monatsziel mit drei Teilzielen (Trainings, Check-ins, Volumen), das mit Erfahrung und Vormonat skaliert. Erreicht = Bonus-XP + Auszeichnung. Das Home-Widget öffnet jetzt einen eigenen Monatsziel-Screen (mit Ringen) statt in die Analyse zu springen.
- **Coach kann Monatsziele anpassen:** Über das Athleten-Dashboard ein persönliches Monatsziel setzen – wird es erreicht, gibt es doppelte XP (500) und eine besondere „Coach-Challenge"-Auszeichnung. Neue Achievements: Erstes/3/6 Monatsziele, Coach-Challenge.
- **Ernährungs-Plan: Mahlzeiten einzeln tauschbar:** Jede Mahlzeit im Plan hat „🔄 Mahlzeit tauschen" – zeigt Rezepte mit ähnlichen Kalorien (Ernährungsweise berücksichtigt) und ersetzt die Mahlzeit per Tipp.
- **Touren für alle Tabs:** Training, Ernährung und Analyse haben jetzt – wie die Startseite – eine kurze Einführungstour beim ersten Besuch. „Einführung erneut ansehen" im Profil setzt alle zurück.
- **Tour-Spotlight verbessert:** Kein unscharfer Hintergrund mehr; das gemeinte Element bleibt scharf und bekommt einen roten, pulsierenden Leuchtrahmen.
- **Training: Werkzeuge scrollen mit:** Pausen-Timer und Hantelrechner bleiben als Leiste oben kleben – kein Hochscrollen mehr nötig.
- **Ernährung: Trainings-/Ruhetag deutlich markiert** (farbiges Badge oben).
- **Rezeptfilter zeigt aktive Filter:** Ziel und Mahlzeit als sichtbare Pills; Ernährungsweise/Quelle hinter dem Filter-Symbol mit Anzahl-Punkt.
- **Rezept-Detail:** „Als gegessen" und „Mahlzeit tauschen" prominent oben nebeneinander statt unten am Rand.
- Neue Tabelle: monthly_goals (automatische Migration).

## Wartung (Dokumentation)
- Alle Doku-Dateien überarbeitet und entrümpelt: README von 40 KB auf ~5 KB gekürzt,
  veraltetes lokales Setup und sämtliche Klartext-Zugangsdaten entfernt.
- DEPLOYMENT.md (Erst-Einrichtung) und UPDATE.md (Updates ohne Datenverlust) neu gefasst,
  DEPLOY-PRUEFEN.md versionsneutral. Stand entspricht jetzt der Cloud-Realität (Render).

## 1.5.1
- Ernährung „Heute": Makro-Übersicht und Kalorien-Fortschritt zu einer Karte zusammengefasst (vorher wurde die kcal-Zahl doppelt angezeigt) – ruhiger und klarer.
- Training „Kraft": Werkzeug-Buttons (Pause, Hantelrechner) dezenter gestaltet, Tageswahl nach oben – der Fokus liegt jetzt klar auf den Übungen.

## 1.5.0
- **Startseite aufgeräumt (ruhigeres, Apple-näheres Design):** Inhalte nach Wichtigkeit geordnet – zuerst „Heute" (Training/Ruhe + 7-Tage-Plan), dann „Heute eintragen" (Schnell-Check-in), dann Ernährung, dann Fortschritt.
- **Verdichtung statt Verstecken:** Der große „Deine Woche"-Block (Level/XP/Streak/Wochenziel/Volumen) ist jetzt in kompakte, antippbare Streifen aufgeteilt – Level/Erfolge öffnen die Erfolgs-Liste, Wochenziel und Gewicht öffnen die Analyse. Nichts ging verloren, alles ist einen Tipp entfernt.
- **Geführte Einführungs-Tour:** Beim ersten Öffnen erklären 4 kurze Spotlight-Hinweise die wichtigsten Stellen (Tagesübersicht, Check-in, Navigation, Profil). Jederzeit erneut startbar über Profil → „Einführung erneut ansehen".
- **Konsistente Diagramme:** Auch das Gewichts-Chart hat jetzt beschriftete Achsen wie die übrigen.

## 1.4.0
- App-Icons: Neues BE INEVITABLE Logo als Favicon (Browser-Tab) und als App-Icon (PWA / „Zum Home-Bildschirm").
- 5 Icon-Größen erzeugt: favicon.ico (16/32/48), icon-192.png, icon-512.png, apple-touch-icon.png (180).
- Manifest aktualisiert: getrennte Einträge für „any" (kein Beschneiden) und „maskable" (Android-Adaptive-Icon), damit der Schriftzug auf keinem Gerät abgeschnitten wird.
- Alle Icon-URLs mit ?v=1.4.0 versehen – sonst halten Browser/PWA am alten Icon fest.

## 1.3.2
- Bugfix Rezept-Filter: Ausgewählte Filter (Ziel, Mahlzeit, Ernährungsweise, Quelle, Kategorie) färben sich jetzt SOFORT beim Antippen rot. Vorher aktualisierte der Klick nur die Liste hinter dem Sheet; das offene Filter-Menü zeigte den alten Zustand bis zum Wiederöffnen. Das Sheet bleibt jetzt außerdem offen, sodass man mehrere Filter nacheinander setzen kann.

## 1.3.1
- Mail-Diagnose: /api/version zeigt, ob SMTP konfiguriert ist und APP_URL gesetzt wurde
- POST /api/admin/testmail (Coach/Admin): verschickt eine Probe-Mail an die eigene Adresse mit klarer Diagnose-Antwort
- EMAIL-SETUP.md: komplette Schritt-für-Schritt-Anleitung für Brevo auf Render (Port-587-Hinweis, Absender-Verifizierung, APP_URL)

## 1.3.0
- **🔔 Push-Erinnerungen:** Im Profil aktivierbar. Tägliche Trainings-Erinnerung („Heute: Oberkörper 1 💪"), Push bei Coach-Nachrichten/Broadcasts/neuem Plan. Service Worker macht AUSSCHLIESSLICH Push (kein Caching!). VAPID-Schlüssel werden beim ersten Start automatisch erzeugt – kein Setup nötig. iPhone: erst „Zum Home-Bildschirm".
- **📷 Barcode-Scanner:** Im Tagesprotokoll. Kamera-Scan (Chrome/Android) oder Nummer eintippen (alle Geräte) → Nährwerte aus Open Food Facts → Menge angeben → eintragen.
- **📋 Plan-Vorlagen (Coach):** Aktuellen Athleten-Plan als Vorlage speichern und jedem Athleten per Klick zuweisen (alter Plan bleibt deaktiviert erhalten, Athlet wird benachrichtigt).
- **📈 Übungs-Verlauf:** Im ⚙️-Menü jeder Übung – Top-Gewicht pro Einheit als Kurve, mit Bestleistung und Fortschritt seit Beginn.
- **🏁 Workout-Abschluss-Screen:** „Training abschließen" zeigt Sätze, Übungen, bewegtes Gesamtgewicht, neue Rekorde und den schwersten Satz.
- **📧 Wochenrückblick per E-Mail:** Sonntags automatisch (Trainings, Sätze, Check-ins, Gewichtsänderung). Respektiert den E-Mail-Schalter im Profil; inaktive Wochen lösen keine Mail aus.
- **⬇️ Daten-Export (DSGVO):** Im Profil – alle eigenen Daten als JSON-Datei.
- Neue Abhängigkeit: web-push. Neue Tabellen: settings, push_subscriptions, plan_templates (automatische Migration).

## 1.2.0
- **Teilen per Link (WhatsApp & Co.):** Rezepte und Übungen lassen sich per Link teilen.
  Teilen-Button öffnet den nativen Teilen-Dialog des Handys (oder kopiert den Link).
  Der Empfänger öffnet den Link, meldet sich an (oder registriert sich) und wird gefragt,
  ob er den Inhalt übernehmen möchte – Rezepte landen in seinen Rezepten, Übungen in einem
  Trainingstag seiner Wahl. Links sind Schnappschüsse: Sie funktionieren auch, wenn das
  Original später gelöscht wird, und geben nie mehr preis als den geteilten Inhalt.

## 1.1.1
- Kalender-Widget: Krank-Tage werden als 🤒 „Krank" angezeigt (vorher als Rest)
- Kalender-Widget-Härtung gegen veraltete Anzeige:
  - Auto-Refresh, sobald die App aus dem Hintergrund zurückkommt (Handy entsperrt / Tab gewechselt)
  - Satz-Loggen invalidiert den Plan-Stand (Server bestätigt heute als Trainingstag -> Folgetage ändern sich)
  - Widget-Datumslabels am Server-Datum verankert (kein Versatz um Mitternacht/Zeitzonen)

## 1.1.0
- Sichtbare Versionsnummer (Login + Profil) + /api/version-Endpoint + Cache-Buster für app.js
- index.html wird nicht mehr gecacht (löst „Update kommt nicht an")
- Navigation: Profil-Icon vereint alles (Profil, Passwort, Hinweise, Abmelden); „Mehr"-Tab entfernt
- Profilbild-Upload mit Zuschnitt (erscheint im Header)
- Kalender-Widget synchronisiert sich sofort nach Änderungen; Hero = preview[0]
- Analyse: beschriftete X/Y-Achsen + Ziel-Linien (Schlaf 8h / Schritte 10.000 / Wasser 3L)
- Ernährung: Mahlzeiten antippbar (Zutaten-Details), lesbare Makros, Makro-Rechner „direkt eintragen"
- Rezepte teilen (Athlet↔Athlet, Coach→Athleten) + Fotos + Kategorien
- Ernährungs-Generator ±2,5% Zielgenauigkeit, vegetarisch/vegan, realistische Portionen
- Supplements-Formatierung, mehr Anfänger-Info-Boxen
- Diverse Bugfixes (Eingabe-Clamping, Akkordeon, verirrte ✕/−)

## 1.0.0
- Erste Version
