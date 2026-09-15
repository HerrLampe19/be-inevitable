# Version prüfen & richtig deployen

> **Die Kurzfassung nach jedem Deploy** steht als Checkliste in **DEPLOYMENT.md, Schritt 6**:
> `/api/version` · `/api/selftest` · Verwaltung → Betrieb · Render-Logs. Dieses Dokument erklärt,
> **warum** und was zu tun ist, wenn einer der vier Punkte rot ist.

## Versionsnummer in der App
Unten im **Profil-Menü** (Profil-Icon oben rechts) und auf dem **Login-Screen** steht
die Versionsnummer. Die jeweils aktuelle Nummer steht in CHANGELOG.md und in `package.json`.

**So prüfst du in 5 Sekunden, ob das Update live ist:**
1. App öffnen (oder Login-Screen ansehen).
2. Steht dort die **erwartete Versionsnummer** (laut CHANGELOG.md)? → neue Version ist live. ✓
3. Steht eine ältere Nummer (oder gar keine)? → der Deploy ist NICHT durchgekommen.

Wenn Frontend und Server auseinanderlaufen, zeigt der Login-Screen automatisch
„App X · Server Y – neu laden" mit einem Klick-Link, falls Frontend und Server auseinanderlaufen.

Du kannst die Version auch direkt abfragen: **https://DEINE-URL/api/version**
→ liefert die laufende Versionsnummer. Zeigt das eine alte Nummer, läuft auf Render noch alter Code.

## Cache ist jetzt kein Problem mehr
- Die Versionsnummer steht nur noch in `package.json`; der Server setzt sie beim Ausliefern
  in `index.html` ein (`?v=`-Parameter, `window.BE_VERSION`) und liefert sie unter `/api/version`.
- `index.html` wird nicht mehr gecacht (no-cache-Header).
- Alle Skripte und Stylesheets werden über einen `?v=`-Parameter mit der Versionsnummer geladen –
  bei jeder neuen Version eine neue URL, d.h. der Browser lädt garantiert die neue Datei.
  Kein hartes Neuladen mehr nötig.
- Seit 2.3.0 legt der Service Worker die Programmhülle in einen Cache, damit die App auch **ohne
  Netz startet**. Seit 2.4.0 kommen Dateien mit Versionsstempel (`?v=…`) daraus **ohne Nachfrage beim
  Server** (cache-first) und werden vom Server mit `immutable` ausgeliefert. Das ist sicher, WEIL sich
  ihre Adresse mit jeder Version ändert. `index.html`, `manifest.json`, `sw.js` und `/api/*` bleiben
  netzwerk-zuerst bzw. werden nie gecacht; beim Aktivieren einer neuen Version werden alle älteren
  Caches gelöscht.

> ⚠️ **Deshalb gilt ab 2.4.0 ohne Ausnahme: Jede Auslieferung geänderter JS-/CSS-Dateien braucht eine
> neue Versionsnummer in `package.json`.** Wird dieselbe Nummer erneut hochgeladen, behalten die
> Browser die alten Dateien bis zu ein Jahr lang – und niemand merkt es.

## Seit 2.7.0: ein Skript, ein Stylesheet – gebündelt beim Serverstart

Bis 2.6.0 lud jeder Kaltstart zehn JS- und neun CSS-Dateien einzeln: **34 Anfragen, 485 KB, 3,1 Sekunden**
auf einer normalen Mobilverbindung. Seit 2.7.0 hängt der Server die Dateien **beim Hochfahren** zusammen –
es gibt weiterhin **keinen Build-Schritt** und kein zusätzliches Paket:

| Adresse | Inhalt |
|---|---|
| `/app.js` | `core, home, training, diet, account, shell` – in genau dieser Reihenfolge, plus der Nachlade-Lader |
| `/app.css` | alle neun Stylesheets in der Reihenfolge von früher |
| `/mod/analysis.js`, `/mod/mindset.js`, `/mod/coach.js`, `/mod/search.js` | werden erst geholt, wenn die Ansicht gebraucht wird – und spätestens kurz nachdem die Startseite steht |

Gemessen mit `tools/perf.mjs` (Slow-4G per CDP, leerer Cache, angemeldet), bis die Startseite steht:

| Stand | Startseite kalt | Anmeldeseite kalt |
|---|---|---|
| 2.6.0 (vor dem Bündeln) | 34 Anfragen · 485 KB · 3,1 s | – |
| 2.7.0 (Auslieferung) | 15 Anfragen · 189 KB · ~1,6 s | 9 Anfragen · 188 KB |
| 2.8.0 | 14 Anfragen · 180,3 KB · 1.578 ms | 9 Anfragen · 176,5 KB · 1.199 ms |
| 2.9.0 | 14 Anfragen · 183,9 KB · 1.555 ms | 9 Anfragen · ~177 KB |
| 3.0.0 | 10 Anfragen · 189,5–190,4 KB · 1.588–1.636 ms (fünf Läufe) | – |

Die Ziele von `tools/perf.mjs` liegen bei **≤ 10 Anfragen, ≤ 200 KB, ≤ 1.200 ms** (`perf.mjs`,
`const TARGETS = { requests: 10, kb: 200, ms: 1200 }`).

**Stand 3.0.0, fünf Läufe gemessen: 10 Anfragen · 189,5–190,4 KB · 1.588 / 1.591 / 1.608 / 1.619 /
1.636 ms.** Anfragen und Volumen sind damit erreicht, **die Zeit ist es weiterhin nicht** –
`Ziele verfehlt: 1`. Trotz vier neuer Funktionsblöcke ist das **kein Rückschritt**: die Anfragen sind
von 14 auf 10 gefallen, das Volumen um rund 6 KB gewachsen, die Zeit liegt in derselben Spanne wie
bei 2.9.0 (1.532–1.652 ms). `Regressionen: 0` in drei von fünf Läufen; die beiden mit `1` waren je
eine einzelne API über der 15-%-Toleranz und im Wiederholungslauf weg – genau der Fall, den der
Absatz unten beschreibt. **Miss deshalb mindestens zweimal.**

Zum Vergleich der Befund von **2.9.0**, der die Zeit als das eigentliche Loch benannt hat. Über sechs
Läufe desselben Standes (Slow-4G, leerer Cache) gemessen:

* **Zeit bis interaktiv: 1.532 / 1.543 / 1.552 / 1.555 / 1.599 / 1.652 ms** – das Ziel von 1.200 ms
  ist in **keinem** Lauf erreicht. Das ist das eigentliche offene Loch.
* **Anfragen: 10 bis 14** – je nachdem, ob die vier nachgeladenen Module (`analysis`, `mindset`,
  `coach`, `search`) die Messmarke noch erwischen. Der Lauf zur Tabelle oben zählte 14, drei
  Wiederholungsläufe 10. Verlässlich erreicht ist das Ziel damit **nicht**.
* **Volumen: 177–185 KB von 200 KB** – als einziges der drei Ziele erreicht, mit Luft.

Das Werkzeug meldet deshalb je nach Lauf `Ziele verfehlt: 1` oder `2` – im ruhigen Lauf bei
**0 Regressionen**. Nicht erreichte Ziele sind kein Rückschritt: Anfragen und Volumen sind seit
2.7.0 stabil. Steht auf einem Rechner unter Last einmal `Regressionen: 1`, ist das fast immer eine
einzelne API, die über die 15-%-Toleranz gerutscht ist – der Wiederholungslauf zeigt wieder 0. Wer
die Zahl nachmisst, misst deshalb **mehrfach** und nennt die Spanne, nicht den einen günstigen Lauf.

**Lies die Zahl richtig:** Das ist, was bis zur fertigen Startseite über die Leitung geht. Die vier
nachgeladenen Module holt die App kurz danach von selbst – wer die App öffnet und nur die Startseite
anschaut, zieht am Ende deutlich mehr (bei 2.7.0 gemessen: **20 Anfragen und 314 KB**, gegen 34 und
485 KB in 2.6.0). Wer eine Zahl für „so viel Volumen kostet ein Kaltstart" braucht, nimmt die zweite,
nicht die erste. Beide wachsen mit dem Code – wer sie neu erhebt, misst die erste bis zur fertigen
Startseite und die zweite erst, wenn auch die vier Module durch sind.

**Was das für den Deploy heißt:**

* Die Einzeldateien unter `public/js/` und `public/css/` bleiben liegen und sind weiter erreichbar –
  im Zip ändert sich nichts an der Ordnerstruktur. Gebündelt wird nur beim Ausliefern.
* Ändert jemand eine dieser Dateien, muss der **Server neu starten**, damit das Bündel neu entsteht.
  Auf Render passiert das bei jedem Deploy von selbst.
* Im Startprotokoll stehen **zwei** Zeilen. Die erste kommt sofort und sieht so aus
  (die KB-Zahlen sind der Rohstand des jeweiligen Codes und wachsen mit ihm – **entscheidend ist,
  dass die Zeile überhaupt dasteht**, nicht welche Zahl darin):
  `[buendel] /app.js 510 KB roh · /app.css 127 KB roh · 4 Module nachladbar`.
  Fehlt sie, ist der Server mit altem Code hochgefahren.
* Die zweite kommt ein bis zwei Sekunden später und meldet, dass die Bündel **vorab gepackt**
  bereitliegen (Brotli 11 und gzip, im Threadpool, damit der Dienst sofort Anfragen annimmt):
  `[buendel] vorab gepackt in 1202 ms · /app.js 121 KB br / 150.2 KB gzip · /app.css 20.6 KB br / 23.9 KB gzip`.
  **Das sind die Zahlen, die wirklich über die Leitung gehen** – die „roh"-Zahlen der ersten Zeile
  nicht. Fehlt die zweite Zeile ganz, liefert der Server trotzdem korrekt aus, nur ein paar KB größer.
* Taucht dort `NICHT verkleinert` auf, hat der Verkleinerer eine Datei nicht sauber übersetzen können
  und liefert sie **unverändert** aus. Die App läuft dann normal weiter, nur etwas größer. Melden, nicht ignorieren.
* **`/` kommt in zwei Fassungen** – Unterschied ist genau ein Attribut: Trägt die Anfrage ein
  Sitzungs-Cookie, steht beim Anmelde-Logo `data-src` statt `src`, das Bild (13,2 KB) wird dann nicht
  geholt. Wer den Quelltext eines angemeldeten Tabs ansieht und das `src` vermisst: das ist so gewollt.
  Beide Fassungen entstehen beim Hochfahren; die Antwort trägt `Vary: Cookie` und wie bisher
  `no-store`. Steht im Startprotokoll `[boot] Anmelde-Logo: Marke in index.html nicht gefunden`, hat
  jemand die `<img id="loginLogo" …>`-Zeile in `index.html` umgeschrieben, ohne `src/server.js`
  mitzuziehen – dann geht die Seite für alle mit Logo raus (13 KB je Start, sonst nichts kaputt).

**Notbremse `MINIFY=0`:** Der Server entfernt beim Bündeln Kommentare und Einrückungen. Am Stand
2.8.0 auf demselben Rechner gemessen, einmal mit und einmal ohne:

| `/app.js` | roh | brotli (über die Leitung) | gzip |
|---|---|---|---|
| verkleinert (Standard) | 495 KB | **121 KB** | 150,2 KB |
| `MINIFY=0` | 810 KB | 222,8 KB | 281,7 KB |

Das Verkleinern spart also **rund 46 %** dessen, was wirklich übertragen wird. Falls je der Verdacht
aufkommt, dass daran etwas kaputtgeht: in Render unter *Environment* die Variable `MINIFY` auf `0`
setzen und neu starten. Dann geht alles unverkleinert raus – gleiche Funktion, nur größer. Im
Protokoll steht dann `MINIFY=0 (unverkleinert)`.

## Notausgang: `?swkill=1` (Service Worker abschalten)

Wenn ein Gerät nach einer Auslieferung hängt – weiße Seite, alte Version, Neuladen hilft nicht –, liegt
das fast immer am Service Worker oder seinem Cache. Dafür gibt es seit 2.7.0 einen Notausgang, den man
am Telefon durchgeben kann:

> **`https://DEINE-URL/?swkill=1` aufrufen.**

Was dann passiert, in dieser Reihenfolge:

1. Der Service Worker wird **abgemeldet**.
2. Die Seite lädt sich selbst neu – und zwar sauber auf `/`, der Zusatz verschwindet aus der Adresse.
3. Nach dem Neuladen werden **alle Caches gelöscht** (erst jetzt – vorher würde der noch laufende
   Worker sie sofort wieder füllen).
4. Der Tab läuft ab jetzt im **Notbetrieb**: kein Service Worker, kein Cache. Alles kommt direkt vom
   Server. In der Entwicklerkonsole steht `[swkill] Notbetrieb: kein Service Worker, kein Cache in
   diesem Tab.`

**Der Notbetrieb gilt nur für diesen Tab.** Tab schließen und die App normal öffnen → alles wieder wie
immer, ein frischer Worker installiert sich aus der laufenden Version. Das ist Absicht: Wäre der Worker
sofort wieder da, käme man bei einem wirklich kaputten Worker keinen Schritt weiter.

Abmelden und Cache leeren kann man auch von Hand (DevTools → Application → Service Workers →
*Unregister*), aber niemand macht das am Handy. Der Notausgang ist für genau diesen Fall.

**Normalfall ohne Notausgang:** Ein Browser, der noch die alte Fassung im Cache hat, kommt nach einem
Deploy von allein auf den neuen Stand. `index.html` wird nie gecacht und nennt sofort die neuen
Adressen (`/app.js?v=2.7.0`); der Cache-Name trägt die Version, und beim Aktivieren löscht der neue
Worker jeden älteren Cache. Geprüft mit dem Wechsel 2.6.0 → 2.7.0 auf demselben Port: **nach einem
einzigen normalen Neuladen** stand 2.7.0, mit genau einem Cache (`be-shell-2.7.0`), ohne Fehler in der
Konsole und ohne Handgriff.

## Seit 2.7.0: der letzte Stand liegt auf dem Gerät – wichtig fürs Fehlersuchen

Seit 2.7.0 legt die App **jede gelesene Antwort** als Stand im Browser des angemeldeten Kontos ab
(`localStorage`, Schlüssel `be_snap_v1_<Konto>_<Pfad>`, höchstens 40 Einträge, Verfall nach 30 Tagen).
Startet jemand ohne Netz, sieht er diesen Stand mit einem Chip „Stand 20:14 · offline" statt einer Seite
voller Nullen. `/api/*` wird vom Service Worker weiterhin **nie** gecacht – das hat sich nicht geändert.

Was das für dich heißt, wenn jemand „alte Zahlen" meldet:

* **Erst fragen, ob oben im Kopf „Stand … · offline" steht.** Steht es da, ist alles in Ordnung: das
  Gerät hat gerade keine Verbindung und zeigt ehrlich den letzten Stand. Sobald das Netz da ist, steht
  die frische Zahl da und der Chip verschwindet.
* **Der Ort ist der Gerätespeicher dieses Kontos, nicht dein Cache auf Render.** `?swkill=1` räumt den
  Dateicache, **nicht** den Stand. Der sichere Handgriff dagegen ist **Abmelden und neu anmelden** –
  beim Abmelden werden Stände, wartende Einträge und Vorschlagslisten vom Gerät geräumt.
* **Auf einem geteilten Gerät bleibt nichts liegen**, und beim Blick eines Coaches auf einen Athleten
  wird gar nichts abgelegt. Wenn dich also jemand fragt, ob Zahlen „im Handy hängen bleiben": nein,
  nicht über das Abmelden hinaus.

## Deploy-Schritte (Render)
1. Code als ZIP hochladen / per Git pushen.
2. Render-Dashboard → Service → **Manual Deploy** → **Clear build cache & deploy**.
3. Warten bis Status „Live".
4. **https://DEINE-URL/api/version** öffnen → muss die neue Versionsnummer zeigen **und**
   `"schema":"ok"`. Steht dort `"fehlgeschlagen"`, sofort **https://DEINE-URL/api/selftest** öffnen:
   die Antwort nennt in Klartext, welche Tabellen, Spalten oder Migrationsschritte fehlen (HTTP 503,
   solange etwas fehlt). Der Selbsttest enthält keine personenbezogenen Daten.
   - Zeigt es die neue Nummer → alles gut, App neu öffnen.
   - Zeigt es etwas anderes → der Build wurde nicht übernommen. Prüfe, ob die richtige
     ZIP/der richtige Branch deployt wurde und ob Render Fehler im Log zeigt.

## Wenn /api/version die alte Nummer zeigt
Dann liegt es definitiv NICHT am Code, sondern am Deployment-Prozess:
- Wurde wirklich die neueste ZIP hochgeladen? (Datei-Datum prüfen)
- Hat Render den Build ohne Fehler abgeschlossen? (Deploy-Logs ansehen)
- Zeigt Render denselben Commit-/Build-Stand wie erwartet?

## Datenbank / Profile
Keine Migration von Hand nötig. Ob alle Migrationen gelaufen sind, zeigt `/api/selftest` (seit 2.4.0).
Fehlende Spalten und Indizes legt der Server bei jedem Start
selbst an (wiederholbar, bestehende Daten bleiben unangetastet). In 2.3.0 gehören dazu
`food_log.client_id` und `cardio_log.client_id` samt ihren eindeutigen Teilindizes – das ist der
Dublettenschutz der Offline-Warteschlange. Die vollständige Liste je Version steht im CHANGELOG
unter „Für Technikinteressierte"; wer nach dem Deploy prüfen will, ob die Migration durch ist,
schaut dort nach, nicht hier.
**Bestehende Profile bleiben erhalten** – ein „zerschossenes" Profil entsteht durch diese
Updates nicht. Falls ein Test-Profil dennoch Probleme macht, kannst du jederzeit ein neues anlegen;
die Daten anderer Nutzer sind davon unberührt.

---

# Die Sicherung läuft ab 3.0.0 von selbst

Bis 2.9.0 gab es **einen** Weg zu einer Kopie: den Knopf *Verwaltung → Betrieb → Sicherung
herunterladen*. Ein Knopf wird gedrückt, solange man daran denkt – und danach nie wieder. Seit 3.0.0
macht der Server es selbst, und er prüft auf Wunsch auch nach, ob die Kopie etwas taugt.

**Der Knopf bleibt, und du brauchst ihn weiter.** Die nächtliche Datei liegt auf **derselben Platte**
wie die Datenbank. Gegen einen gelöschten Datensatz hilft sie, gegen einen Plattenschaden nicht.
Zieh dir also weiterhin regelmäßig eine Kopie auf deinen eigenen Rechner (DEPLOYMENT.md, „Backup").

## Was nachts passiert

| | Wert | Woher |
|---|---|---|
| Uhrzeit | **3 Uhr Ortszeit** (`APP_TZ`), Nachholfenster bis 6 Uhr | `BACKUP_HOUR` in `src/server.js` |
| Verfahren | `VACUUM INTO` – eine **einzelne, in sich vollständige** Datei, kein `cp`, kein WAL nebendran | – |
| Ort | ein Ordner **`backups/` neben der Datenbank**, also auf der persistenten Platte (`/var/data/backups`). Anders einstellbar über `BACKUP_DIR`. | – |
| Dateiname | `backup-2026-09-15T10-08-01-manuell.db` – Zeitstempel (UTC) und Anlass (`auto` / `manuell`) | nachgemessen |
| Je Lauf | eine Zeile in der Tabelle `backups`: Zeitpunkt, Bytes, **SHA-256**, Anlass, Erfolg, Notiz | – |
| Aufbewahrung | `settings.backup_keep_days`, **Standard 14 Tage**, erlaubt 1–365 | `PUT /api/admin/backups/keep` |
| Platzprüfung | **vor** dem Schreiben: Größe der Datenbank + **50 MB** müssen frei sein, sonst bricht der Lauf ab und schreibt eine Zeile mit `ok = 0` | nachgemessen |
| Zustand | Lauf `backup.auto` unter **Verwaltung → Jobs**, Karenz 36 Stunden – fällt eine Nacht aus, steht dort „überfällig" | – |

Zwei Dinge daran sind wichtiger, als sie klingen:

* **Ein gescheiterter Lauf bekommt seine eigene Zeile.** Eine Sicherung, die nicht zustande kam, ist
  die wichtigste Zeile der ganzen Liste – sie darf nicht einfach fehlen.
* **Die jüngste brauchbare Sicherung wird nie weggeräumt**, auch wenn sie älter ist als die
  Aufbewahrungsfrist. Sonst hätte eine Frist von 14 Tagen nach drei Wochen Stillstand genau das
  gelöscht, was sie schützen soll.

Die nächtliche Sicherung schickt – anders als der **Download**-Knopf – **keine** Nachricht an die
Konten. Der Grund steht in SICHERHEIT.md Abschnitt 9: beim Download zieht der Betreiber eine
vollständige Kopie auf **seine** Maschine, die nächtliche Datei bleibt auf demselben Server unter
demselben Verantwortlichen.

## Die Wiederherstellungsprobe

> **Wichtig, damit du nicht danach suchst: In der Verwaltung gibt es dafür Stand 3.0.0 noch keinen
> Knopf.** Der Server kann die Probe vollständig, die Oberfläche zeigt sie noch nicht – ausgelöst
> wird sie über die Route unten. Was du in *Verwaltung → Jobs* siehst, steht weiter unten unter
> „Was die Verwaltung heute davon zeigt". Der Auftrag für die Kachel steht in `DEFER-B1.md` (D3).

`POST /api/admin/backups/verify` (Admin, ein Coach bekommt **403 „Nur für Admins"** – nachgemessen)
nimmt die **jüngste erfolgreiche** Sicherung und prüft sie in dieser Reihenfolge:

1. Prüfsumme der Datei gegen die gespeicherte SHA-256 – stimmt sie nicht, ist die Datei verrottet.
2. Kopie in eine **Wegwerf-Datei** – geprüft wird die Kopie der Kopie, die Sicherung selbst wird nur
   gelesen und nie als Datenbank geöffnet.
3. `PRAGMA integrity_check` auf der Kopie.
4. Tabellenliste und **Zeilen je Tabelle** gegen die laufende Datenbank.
5. Wegwerf-Datei löschen – immer, auch nach einem Fehler.

**Die laufende Datenbank wird dabei nicht angefasst:** kein Schreiben, kein Ersetzen, kein `ATTACH`.
Die Probe öffnet eine zweite, eigene Verbindung, nur lesend, auf die Kopie der Kopie.

Das Ergebnis steht in `backups.note` der geprüften Zeile **und** als eigene Zeile mit `kind='probe'` –
damit „wann wurde zuletzt geprobt" eine Zahl hat. Genau danach fragt Art. 32(1)(d) DSGVO. Der Lauf
`backup.verify` steht in **Verwaltung → Jobs** mit einer Karenz von **35 Tagen**: „überfällig" heißt
dort, dass seit über einem Monat niemand mehr geprobt hat.

**Grün sieht so aus** (nachgemessen am 15.09.2026, Version 3.0.0, gegen eine Kopie der Testdatenbank):

```
integrity_check ok · 43 Tabellen · 964 von 966 Zeilen (Differenz = alles seit der Sicherung) · 472 KB
```

Die Differenz ist kein Fehler: die Sicherung ist älter als die Datenbank, also hat die Datenbank
immer mindestens so viele Zeilen. Gewertet wird deshalb **nicht** „gleich viele", sondern: keine
Tabelle fehlt, und keine Tabelle, die jetzt Zeilen hat, ist in der Sicherung leer.

### Eine Falle, die dich beim allerersten Mal trifft

**Prob nicht die allererste Sicherung – sie fällt zwangsläufig durch.** Die Zeile, die eine Sicherung
beschreibt, wird in `backups` geschrieben, **nachdem** die Datei fertig ist. In der allerersten Datei
ist die Tabelle `backups` deshalb leer, während sie in der laufenden Datenbank schon eine Zeile hat –
und genau das meldet die Probe (nachgemessen, Wort für Wort):

```
Leer in der Sicherung, gefüllt im Original: backups
```

Dasselbe passiert mit jeder Tabelle, die zum Zeitpunkt der Sicherung **noch** leer war und seitdem
ihre erste Zeile bekommen hat (bei mir zusätzlich `session_override`). **Das ist kein Befund an
deiner Datenbank.** Die Probe gegen die **zweite** Sicherung war im selben Lauf sofort grün.

Merksatz: **Probe frühestens am Tag nach der ersten Nacht** – dann liegen zwei Dateien da, und die
Probe misst, was sie messen soll. Der Auftrag, diese Meldung zu entschärfen, steht in `DEFER-B1.md`.

### Von Hand nachziehen

| Was | Route | Grenze |
|---|---|---|
| Liste, Zustand, freier Platz | `GET /api/admin/backups` | Admin |
| Jetzt sichern | `POST /api/admin/backups/run` | Admin, **höchstens alle 10 Minuten** (`429` mit Restzeit) |
| Wiederherstellungsprobe | `POST /api/admin/backups/verify` | Admin |
| Aufbewahrung ändern | `PUT /api/admin/backups/keep` `{"days": 1…365}` | Admin; ein Wert außerhalb wird **abgelehnt**, nicht stillschweigend zurechtgebogen |

Jeder dieser Handgriffe steht danach im **Protokoll** (`backup.run`, `backup.verify`, `backup.keep`).

Aufrufen lassen sie sich als angemeldeter Admin direkt aus der Browser-Konsole, z. B.:

```js
fetch('/api/admin/backups/verify',{method:'POST'}).then(r=>r.json()).then(console.log)
```

### Was die Verwaltung heute davon zeigt (Stand 3.0.0, nachgemessen)

Damit du den Zustand richtig liest und nicht erschrickst:

* Unter **Verwaltung → Jobs** stehen `backup.auto` (Karenz 36 Stunden) und `backup.verify` (Karenz
  35 Tage) – aber **ohne Namen und ohne Beschreibung**, mit dem Platzhaltertext *„Dieser Lauf ist in
  der Verwaltung noch nicht beschrieben."* Die Ampel daneben stimmt trotzdem: sie kommt vom Server.
* Der **Status-Streifen** ganz oben zeigt unter *Sicherung* weiterhin nur den **Download**-Knopf
  (`backup.manual`). Steht dort „Es gibt noch keine Ablage dafür", heißt das **nicht**, dass keine
  nächtliche Sicherung läuft – es heißt nur, dass noch niemand von Hand eine heruntergeladen hat.
  Ob die nächtliche läuft, sagt `GET /api/admin/backups` und die Zeile `backup.auto` unter *Jobs*.
* Eine **Liste der Sicherungen** und einen Knopf für die Probe gibt es in der Oberfläche noch nicht.

Das ist kein Fehler im Sicherungs-Job, sondern eine Lücke in der Verwaltungsansicht –
`DEFER-B1.md` (D3) beschreibt, was dort fehlt.

**Wie du die Datei zurückspielst, steht unverändert weiter unten** unter „Ernstfall: So spielst du
eine Sicherung auf Render zurück". Der Weg ist derselbe – nur musst du die Datei nicht mehr erst
herunterladen, wenn der Server noch läuft: sie liegt bereits in `/var/data/backups`.

---

# Wiederherstellungsprobe von Hand (Protokoll 13.09.2026)

**Durchgeführt am 13.09.2026 gegen Version 2.5.0 · Ergebnis: GRÜN ✓**

> **Die Zahlen unten sind ein Protokoll, keine Sollwerte.** Die Tabellenzahl wächst mit jeder
> Version: 2.5.0 hatte **35**, mit den vier Betriebstabellen aus 2.6.0 (`audit`, `errors`, `jobs`,
> `support_grants`) wurden es **39**, und 3.0.0 hat mit `exercise_catalog`, `target_history`,
> `session_override` und `backups` **43** (nachgemessen). Die Zeilenzahl wächst ohnehin mit der
> Nutzung. Was übertragbar ist, ist das **Verfahren**: Sicherung ziehen, zurückspielen, Tabelle für
> Tabelle vergleichen. Wer die Probe wiederholt, vergleicht Original und Wiederherstellung
> **miteinander** – nicht mit dieser Tabelle. **Seit 3.0.0 macht die Wiederherstellungsprobe genau
> das von selbst** (Abschnitt darüber); die Handarbeit hier bleibt als Protokoll stehen, weil sie
> zeigt, was dabei geprüft wird – und weil sie der einzige Weg ist, der auch dann noch geht, wenn der
> Server gar nicht mehr startet.

Zum ersten Mal wurde eine Sicherung nicht nur erzeugt, sondern auch wirklich **zurückgespielt**
und geprüft. Vorher wusste niemand, ob die Sicherung im Ernstfall überhaupt taugt. Jetzt wissen wir es.

## Was geprüft wurde

Mit einer **Kopie deiner echten Datenbank** (die echte Datei wurde dabei nur gelesen, nie beschrieben):

1. Server 2.5.0 auf der Kopie gestartet, als Admin angemeldet, die Sicherung über den Knopf im
   Admin-Bereich (`/api/admin/backup`) heruntergeladen → **335.872 Bytes**, gültige Datenbankdatei.
2. Diese heruntergeladene Datei als Datenbank eingesetzt und den Server darauf gestartet.
3. Original und Wiederherstellung Tabelle für Tabelle verglichen.

## Die Zahlen

**`PRAGMA integrity_check` → `ok`** – bei Original **und** Wiederherstellung.
Keine einzige verletzte Verknüpfung (`foreign_key_check` = 0).

**Alle 35 Tabellen haben exakt gleich viele Zeilen. Summe: 317 Zeilen ↔ 317 Zeilen.**
Auch die Indizes stimmen (15 ↔ 15).

| Tabelle | Original | Wiederherstellung |
|---|---|---|
| foods | 112 | 112 |
| recipes | 75 | 75 |
| meal_items | 24 | 24 |
| exercises | 18 | 18 |
| cart_items | 15 | 15 |
| day_log | 14 | 14 |
| supplements | 12 | 12 |
| checkins | 9 | 9 |
| meals | 8 | 8 |
| supplement_intake | 7 | 7 |
| athlete_supplements | 4 | 4 |
| settings | 4 | 4 |
| users | 3 | 3 |
| food_log | 3 | 3 |
| monthly_goals | 2 | 2 |
| set_logs | 2 | 2 |
| training_days | 2 | 2 |
| messages | 1 | 1 |
| plans | 1 | 1 |
| streak_freeze_log | 1 | 1 |
| *(15 weitere Tabellen)* | 0 | 0 |

Zusätzlich wurde der **Inhalt** jeder Tabelle mit einer Prüfsumme verglichen: **34 von 35 Tabellen sind
Zeichen für Zeichen identisch.** Die einzige Abweichung liegt in `settings`, und zwar in genau zwei
Merkzetteln der Nachtarbeit (`freeze_last`, `remind_2`). Grund: Der Testserver lief nach der Sicherung
noch ein paar Minuten weiter und hat diese zwei Datumsmarken aktualisiert. Das ist kein Fehler, sondern
normal – eine Sicherung ist immer eine Momentaufnahme. Keine einzige deiner echten Eingaben ist betroffen.

## Upgrade-Ergebnis

- **Neuer Server auf alter Datenbank:** 2.5.0 auf einer Kopie deiner echten (älteren) Datenbank gestartet.
  `/api/version` → `{"version":"2.5.0","schema":"ok"}`, `/api/selftest` → `ok: true`, keine fehlenden
  Tabellen, Spalten oder Indizes. Der Server hat dabei eine neue Tabelle angelegt und die
  Lebensmittelliste aufgeräumt (187 → 112 Einträge, 85 Doppelte entfernt) – deine Check-ins, Sätze,
  Pläne und Nachrichten sind vollständig geblieben.
- **Alter Server auf neuer Datenbank:** Zur Sicherheit wurde auch der umgekehrte Fall getestet – der
  alte Server 2.4.0 gegen die bereits aktualisierte Datenbank. **Er läuft.** `/api/version` → 2.4.0,
  `/api/selftest` → `ok: true`, Anmeldung und Daten lesen funktionieren, und er hat der neuen Datenbank
  nichts weggenommen (danach immer noch 35 Tabellen, 317 Zeilen).
  **Das heißt: Wenn ein Update schiefgeht, kannst du gefahrlos auf die vorige Version zurück,
  ohne die Datenbank zurückspielen zu müssen.**

## Ernstfall: So spielst du eine Sicherung auf Render zurück

Nimm dir 15 Minuten Zeit und arbeite die Schritte der Reihe nach ab. Nichts überspringen.

1. **Sicherung besorgen.** Melde dich in der App als Admin an → **Verwaltung → Betrieb → Sicherung
   herunterladen** → dein Passwort eingeben. Du bekommst eine Datei namens
   `be-inevitable-JJJJ-MM-TT.db`. Leg sie an einen Ort, den du wiederfindest.
   *Geht die App gar nicht mehr auf? Dann nimm die letzte Sicherung, die du schon auf dem Rechner hast.
   Genau dafür lädst du sie regelmäßig herunter.*
2. **Dienst stoppen.** Render-Dashboard → dein Service → **Suspend** (oder „Stop"). Warte, bis der
   Status nicht mehr „Live" ist. **Wichtig:** Solange der Dienst läuft, schreibt er weiter in die
   Datenbank – dann wird das Zurückspielen unsauber.
3. **Datei ersetzen.** Öffne die **Shell** deines Render-Dienstes und geh in den Ordner, in dem die
   Datenbank liegt (bei dir die persistente Festplatte, z. B. `/var/data`). Dort machst du drei Dinge:
   - Die alte Datei **beiseitelegen, nicht löschen**: `mv data.db data.db.kaputt`
   - Auch die zwei Begleitdateien beiseitelegen, falls sie da sind:
     `mv data.db-wal data.db-wal.alt` und `mv data.db-shm data.db-shm.alt`
   - Deine heruntergeladene Sicherung dort hinlegen und **genau** `data.db` nennen
     (Render: Datei hochladen bzw. per `curl` holen).

   Die beiden Begleitdateien `-wal` und `-shm` müssen weg. Bleiben sie liegen, mischt sich der alte
   Stand unter den neuen.
4. **Starten.** Render-Dashboard → **Resume** (bzw. **Manual Deploy → Clear build cache & deploy**).
   Warte, bis der Status wieder „Live" ist.
5. **Prüfen – zwei Adressen, 30 Sekunden.**
   - `https://DEINE-URL/api/version` → muss deine Versionsnummer zeigen **und** `"schema":"ok"`.
   - `https://DEINE-URL/api/selftest` → muss `"ok":true` zeigen.

   Steht dort etwas anderes (oder HTTP 503), sagt dir die Antwort im Klartext, was fehlt. Dann:
   Dienst wieder stoppen, `data.db.kaputt` zurückbenennen, und erst danach weitersuchen. **Du hast
   nichts verloren, solange du die alte Datei nur beiseitegelegt und nicht gelöscht hast.**
6. **Kurz reinschauen.** App öffnen, anmelden, ein paar eigene Check-ins und Sätze ansehen. Wenn deine
   Daten da sind: fertig. Erst jetzt darfst du `data.db.kaputt` löschen – und auch dann lieber erst
   nach ein paar Tagen.

**Merksatz:** Die Sicherung ist eine Momentaufnahme. Alles, was zwischen der Sicherung und dem Ernstfall
eingetragen wurde, ist weg. Deshalb: Sicherung regelmäßig herunterladen, nicht nur einmal im Jahr.
