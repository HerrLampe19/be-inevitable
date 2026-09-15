# iPhone-Prüfliste (zum Abhaken)

Diese Liste prüft die Dinge, die **nur auf einem echten iPhone** zu prüfen sind. Ein Agent kann den
Programmtext messen, aber nicht, ob dein Telefon klingelt. Und genau daran hängt die Tagesschleife:
Ohne installierte App gibt es auf iOS **keinen** Web-Push, und ohne Push gibt es keine Erinnerung.

**Wie du das hier benutzt:** Arbeite von oben nach unten. Jeder Punkt hat drei Zeilen:
**Was du tust · Was passieren muss · Wenn es nicht passiert.** Überspring nichts – ab Punkt 3 setzt
alles Punkt 2 b voraus, und Punkt 6 setzt Punkt 5 voraus. **Punkt 2 a geht nur vor Punkt 2 b** –
danach ist er für immer unsichtbar.

**Du brauchst:** dein iPhone, **Safari** (nicht Chrome), die öffentliche Adresse deiner App
(`https://…`), deine Zugangsdaten und ungefähr 35 Minuten. Teil B geht erst am **nächsten
Trainingstag**, Teil C nur, wenn du ein Training machst. Für **6b und 6c** brauchst du zusätzlich ein
zweites Gerät (oder den Rechner) mit einem **Coach-Konto**.

> **Neu in 3.0.0 sind zwei Punkte:** **6c** (Push, wenn der Coach die heutige Einheit ändert) und
> **13** (Supersatz – eine Pause für zwei Übungen). Beide hängen an Dingen, die ein Agent nicht
> messen kann: ob dein Telefon klingelt und ob die Pause im Training an der richtigen Stelle
> losläuft.

> **Ein Hinweis vorweg:** Diese Liste prüft die App über **HTTPS**. Auf `http://…` (etwa einem
> Testserver im WLAN) sperrt iOS Push, Service Worker und „Zum Home-Bildschirm" ganz oder teilweise –
> ein Fehlschlag dort sagt nichts über die echte App aus.

---

## Teil A · Einmalig, heute

### 1 · Version prüfen (30 Sekunden)

**Was du tust:** In Safari `https://DEINE-URL/api/version` öffnen.

**Was passieren muss:** Es steht die erwartete Versionsnummer da **und** `"schema":"ok"`, z. B.
`{"version":"3.0.0","schema":"ok"}`.

**Wenn nicht:** Steht eine ältere Nummer, läuft auf Render noch alter Code – dann hat es keinen Sinn,
weiterzutesten (DEPLOY-PRUEFEN.md, Abschnitt „Wenn /api/version die alte Nummer zeigt"). Steht dort
etwas anderes als `"ok"`, öffne `https://DEINE-URL/api/selftest`: die Antwort nennt im Klartext, was
fehlt.

### 2 a · Fragt die App von selbst? (nur **vor** dem Installieren prüfbar)

Das ist die einzige Tür des Installations-Trichters, die von allein aufgeht – und sie geht nur im
**Safari-Tab** auf. Sobald das Icon auf dem Home-Bildschirm liegt, ist sie für immer still (die App
läuft dann als installierte App, und der Hinweis wäre sinnlos). **Deshalb steht dieser Punkt vor dem
Installieren. Machst du zuerst 2 b, kannst du 2 a nie mehr sehen.**

**Was du tust:**
1. Die App in **Safari** öffnen und anmelden – **noch nichts installieren**.
2. Einen **Satz loggen**: Training → eine Übung → Gewicht und Wiederholungen eintragen, haken.
3. Auf **Home** wechseln, dann wieder auf **Training** (oder Ernährung, Mindset, Analyse) – und dabei
   auf den Bereich **direkt unter dem Kopf** (Logo/Suche) schauen.

**Was passieren muss:**
- **Beim Öffnen steht sie noch nicht da** – die App startet auf Home, und dort gehört sie nicht hin.
  Der Anlass ist der **Tipp auf einen der anderen Reiter**; Schritt 3 ist deshalb kein Beiwerk.
- Auf **Training/Ernährung/Mindset/Analyse** steht unter dem Kopf eine schmale Zeile:
  **„Auf den Startbildschirm legen – nur so kann die App dich erinnern."** mit einem Pfeil rechts
  und einem **×** ganz rechts (nachgemessen: 44 px hoch, direkt unter dem Kopf).
- Auf **Home** steht sie **nicht** – das ist Absicht: die Startseite hat als einzige Ansicht ein
  Höhenbudget (unter 1.000 px), und die Zeile hat es gerissen. Wenn sie dort auftaucht, ist **das**
  der Befund. (Bei 3.0.0 nachgemessen: Startseite **980 px** ohne die Zeile am ruhigen Tag – siehe
  APP-INSTALLIEREN.md, dort steht auch, wann sie länger wird.)
- Ein Tipp **auf die Zeile** (nicht nur auf ein Wort darin) öffnet die Anleitung **„Auf den
  Startbildschirm legen"** mit **drei Bildern**: Teilen → Zum Home-Bildschirm → Hinzufügen.
- Das **×** lässt die Zeile verschwinden – und sie bleibt dann **30 Tage** weg.

**Und die Gegenprobe:** Mit einem **frischen Konto**, das noch **keinen einzigen Satz** hat, darf die
Zeile auf **keinem** Reiter auftauchen – auch nicht, wenn du zwischen ihnen hin- und herwechselst.
Das ist der eigentliche Punkt der Änderung aus 2.9.0: kein Banner beim ersten Start. Hat dein Konto
schon Sätze (Bestandskonto), ist diese Bedingung längst erfüllt und **Schritt 2 entfällt** – Schritt 3
brauchst du trotzdem, denn die Zeile kommt erst beim Reiterwechsel. Das ist **kein** Fehler; die
Gegenprobe geht dann nur mit einem neu registrierten Testkonto.

**Wenn nicht:**
- Zeile kommt beim Öffnen nicht → **das ist richtig so.** Erst ein Tipp auf Training, Ernährung,
  Mindset oder Analyse holt sie. Auf Home steht sie nie.
- Zeile kommt auf keinem Reiter, obwohl ein Satz gespeichert ist → hast du schon einmal auf das **×**
  getippt? Dann schweigt sie 30 Tage. Zum erneuten Prüfen in Safari: *Einstellungen → Safari →
  Verlauf und Websitedaten löschen* (löscht den Merker, aber auch deine Anmeldung) oder ein anderes
  Gerät nehmen.
- Zeile kommt auf keinem Reiter, und eine **Einführungs-Tour** liegt gerade über dem Bild → die Zeile
  hält sich während einer Tour zurück. Tour zu Ende klicken, dann den Reiter noch einmal wechseln.
- Zeile kommt nicht, und du hast noch nie ein × getippt → notier, ob du dich im **eigenen**
  Athleten-Konto befindest (im Coach-Blick auf einen Athleten erscheint sie absichtlich nie) und ob
  der Satz wirklich gespeichert ist (Training → der Satz steht nach dem Neuladen noch da).
- Zeile ist da, aber der Tipp öffnet nichts → echter Befund, mit Bildschirmfoto melden.
- Am **Rechner oder auf Android** heißt dieselbe Zeile **„Als App installieren – eigenes Fenster,
  schnellerer Start, Erinnerungen."** Auch das ist richtig so: dass **gar keine** Erinnerung möglich
  ist, gilt nur auf iOS.

### 2 b · App auf den Home-Bildschirm legen

**Was du tust:** Die App in **Safari** öffnen, anmelden. Unten auf das **Teilen-Symbol** tippen
(Quadrat mit Pfeil nach oben), im Menü nach unten scrollen zu **„Zum Home-Bildschirm"**, oben rechts
**„Hinzufügen"**.

**Was passieren muss:** Das BE-INEVITABLE-Icon liegt auf dem Home-Bildschirm. Startest du die App
über dieses Icon, läuft sie **im Vollbild ohne Safari-Adressleiste**.

**Wenn nicht:**
- „Zum Home-Bildschirm" fehlt im Menü → du bist nicht in Safari (Chrome/Firefox auf dem iPhone können
  das nicht) oder das Menü ist nicht weit genug gescrollt.
- Das Icon ist grau oder ein Seiten-Schnappschuss statt des Logos → `apple-touch-icon.png` wird nicht
  ausgeliefert. Prüf `https://DEINE-URL/apple-touch-icon.png` im Browser.
- Die App startet mit Adressleiste → du hast das Icon aus einem anderen Browser angelegt, oder
  `manifest.json` liefert nicht `"display": "standalone"` (`https://DEINE-URL/manifest.json` öffnen).

**Ab jetzt gilt: Alles Weitere machst du über das Icon, nicht in Safari.** Die installierte App und
der Safari-Tab sind für iOS zwei verschiedene Welten – Erlaubnisse gelten nur dort, wo du sie gibst.

### 3 · Safe-Area oben und unten

**Was du tust:** Die App über das Icon starten. Auf die Startseite schauen, dann auf einen Bereich
mit Inhalt bis ganz unten (z. B. **Training**), dann ein Bottom-Sheet öffnen (irgendeine Zeile mit
„…" oder „Löschen").

**Was passieren muss:**
- Oben: Uhrzeit, Empfang und Akku des iPhones stehen **frei**; der Kopf der App mit Logo und Suche
  beginnt darunter und wird von der Dynamic Island / dem Notch nicht angeschnitten.
- Unten: Die Reiter-Leiste (Home · Training · Ernährung · Mindset · Analyse) steht **über** dem
  waagrechten Home-Balken, nicht darunter. Der Home-Balken verdeckt kein Symbol und keine Schrift.
- Im Bottom-Sheet: Der unterste Knopf ist vollständig sichtbar und antippbar.

**Wenn nicht:** Das ist ein echter Befund – melden mit einem Bildschirmfoto. Technisch hängt es an
`viewport-fit=cover` in `public/index.html` und den Variablen `--safe-t` / `--safe-b` in
`public/app.css`; beide sind gesetzt, aber nur ein echtes Gerät zeigt, ob die Rechnung aufgeht.

### 4 · Tastatur verdeckt keine Eingabe

**Was du tust:** Drei Stellen mit Tastatur der Reihe nach durchgehen und dabei **immer schauen, ob du
das Feld, in das du tippst, noch siehst**:
1. **Home → Check-in**: Gewicht eintragen.
2. **Ernährung → Hinzufügen**: in das Suchfeld tippen, dann eine Menge in Gramm eintragen.
3. **Training**: bei einem Satz Gewicht und Wiederholungen eintragen (die Pausen-Leiste steht dabei
   unten mit im Bild).

**Was passieren muss:** Das Feld, in dem der Cursor steht, bleibt **über** der Tastatur sichtbar. Der
Knopf zum Bestätigen ist erreichbar – notfalls durch Scrollen, aber ohne die Tastatur schließen zu
müssen.

**Wenn nicht:** Notier **welches** Feld in **welcher** Ansicht verdeckt war und ob das Gerät hoch-
oder quer gehalten wurde. Das ist die Art Befund, die man ohne Gerät nicht findet.

### 5 · Erlaubnis für Mitteilungen geben

Die Reihenfolge ist Absicht und darf nicht umgedreht werden: **erst installieren, dann fragt die App,
erst dann fragt iOS.** Ein einmal abgelehnter iOS-Dialog kommt nie wieder.

**Weg 1 – so, wie ein echter Nutzer es erlebt:** In der **installierten** App einen **Check-in
speichern** (Home → Gewicht eintragen) oder einen **Satz** haken. Kurz danach fragt die App selbst in
einem Sheet: **„Soll ich dich erinnern?"** mit den drei Knöpfen **[Ja, um 18 Uhr] · [Andere Zeit] ·
[Nein danke]**.

**Weg 2 – wenn die Frage schon durch ist:** **Profil → Erinnerungen** → Schalter
**Push-Mitteilungen** einschalten.

Bei beiden Wegen erscheint **erst danach** der Systemdialog von iOS („… möchte dir Mitteilungen
senden") – dort auf **„Erlauben"** tippen.

**Was passieren muss:** Nach dem Erlauben meldet die App „Push-Mitteilungen aktiviert ✓" (bzw.
„Läuft – du hörst am nächsten Trainingstag um … Uhr von mir"). Der Schalter bleibt an, auch wenn du
die App schließt und neu öffnest. Unter **Profil → Erinnerungen → Trainings-Erinnerung** steht
jetzt eine Uhrzeit und nicht mehr „Aus".

**Wenn die Frage aus Weg 1 nicht kommt:** Das ist kein Fehler, sondern eine der eingebauten Bremsen –
sie kommt nicht, wenn die App **nicht vom Home-Bildschirm** läuft (dann ist erst Punkt 2 b dran), wenn
die Erlaubnis schon erteilt oder schon abgelehnt ist, oder wenn du sie in den letzten 7 Tagen
(bzw. 30 Tagen nach „Nein danke") schon einmal weggetippt hast. Nimm dann Weg 2.

**Wenn die Erlaubnis nicht zustande kommt – die App sagt dir, woran es liegt.** Unter dem Schalter
steht der Zustand dieses Geräts im Klartext:
- **„Zuerst zum Home-Bildschirm hinzufügen"**, und der Schalter öffnet die Installations-Anleitung
  statt des Systemdialogs → du bist im **Safari-Tab** statt in der installierten App. Zurück zu
  Punkt 2 b. (Das ist keine Fehlbedienung des Schalters, sondern die Reihenfolge aus CRITIC K7.)
- **„Blockiert – iOS Einstellungen › BE INEVITABLE › Mitteilungen"** → die Erlaubnis wurde auf diesem
  Gerät schon einmal **abgelehnt**. Auf iOS ist das endgültig, der Dialog kommt nie wieder. Weg
  zurück: genau dort, wo der Text hinzeigt. Hilft das nicht, App-Icon löschen, Safari öffnen und
  Punkt 2 b wiederholen.
- **„Auf diesem Gerät nicht verfügbar"** → der Browser kennt Service Worker oder Push gar nicht;
  auf dem iPhone heißt das: iOS älter als 16.4.
- **„Push auf dem Server nicht eingerichtet"** → der Server konnte keinen Schlüssel liefern. Die
  VAPID-Schlüssel erzeugt der Server beim ersten Bedarf selbst und legt sie in `settings` ab; es gibt
  dafür **keine** Umgebungsvariable zu setzen. Ein Blick in die Render-Logs zeigt die Ursache.

> **Solange Push aus ist, sind die Uhrzeit-Chips darunter bewusst gesperrt.** Eine Uhrzeit zu
> wählen, zu der nie etwas ankommt, wäre ein Versprechen ohne Deckung – die App sagt das auch, wenn
> du es trotzdem versuchst.

### 6a · Test-Mitteilung (prüft die **Anzeige** auf diesem Gerät)

**Was du tust:** In der App: **Profil → Erinnerungen**. Ganz
oben unter dem Push-Schalter steht die Zeile **Test-Mitteilung** mit dem Knopf **„Senden"**. Darauf
tippen, dann das iPhone **sperren**.

**Was passieren muss:** Die Mitteilung erscheint auf dem **Sperrbildschirm**, mit dem
BE-INEVITABLE-Symbol. Ein Tipp darauf öffnet die App. In der Zeile steht danach
„Zuletzt geprüft: heute HH:MM · lokal auf diesem Gerät".

> **Was dieser Test NICHT beweist:** Die Mitteilung zeichnet der Service Worker **auf deinem Gerät
> selbst** – es geht dabei kein Byte über den Server. Grün heißt also: Erlaubnis erteilt, Service
> Worker läuft, Anzeige funktioniert. Ob der Server dich wirklich erreicht, sagt erst **Punkt 6b**.

**Wenn nicht:**
- „Erst Push-Mitteilungen einschalten" → zurück zu Punkt 5.
- Der Knopf öffnet die Installations-Anleitung → du bist nicht in der installierten App (Punkt 2 b).
- „Kein Service Worker" → die App einmal ganz schließen und neu öffnen; bleibt es dabei, in Safari
  `?swkill=1` aufrufen (siehe Punkt 8) und Punkt 2 b wiederholen.
- Nichts erscheint, obwohl die App „gezeigt" meldet → **iOS-Einstellungen → Mitteilungen → BE
  INEVITABLE**: „Sperrbildschirm" muss angehakt sein, und ein **Fokus** („Nicht stören") darf nicht
  laufen.

### 6b · Echter Push vom Server (prüft die **Zustellung**)

**Was du tust:** Melde dich auf einem zweiten Gerät oder am Rechner als **Coach** an und schick dem
Athleten-Konto eine **Nachricht**. Dann das iPhone sperren und warten.

**Was passieren muss:** Die Nachricht kommt als Mitteilung auf dem Sperrbildschirm an. **Erst damit
ist die Kette Server → Apple → dein Gerät belegt** – und nur diese Kette trägt die Erinnerung am
Trainingstag (Punkt 9).

**Wenn nicht:** Prüf zuerst, ob 6a grün war (dann liegt es nicht am Gerät). Danach in den
**Render-Logs** nachsehen, ob der Versand überhaupt versucht wurde. Bleibt es dabei: Push im Profil
einmal aus- und wieder einschalten – damit registriert sich das Gerät neu beim Server.

### 6c · „Deine Einheit wurde geändert" (neu in 3.0.0)

Seit 3.0.0 kann dein Coach die **heutige** Einheit ändern, ohne deinen Plan anzufassen („Pivot"). Das
erzeugt eine **neue Art Push**, und die hängt an derselben Kette wie 6b – deshalb steht sie hier und
nicht in Teil C.

**Was du tust:** Am Rechner oder auf einem zweiten Gerät als **Coach** anmelden. Über der
Athletenliste steht eine Umschaltung **Athleten · Wochen-Review** – auf **Wochen-Review** tippen, auf
der Karte des Athleten **„Heute ändern"**, einen anderen Trainingstag oder „Ruhetag" wählen und
**eine Begründung schreiben**. Dann das iPhone sperren.

**Was passieren muss:**
- Auf dem iPhone kommt die Mitteilung **„Deine Einheit wurde geändert"** mit deinem Begründungssatz.
- Derselbe Satz steht danach als **Nachricht im Postfach** (Profil → Nachrichten).
- Dein **Trainingsplan ist unverändert** – morgen läuft der Rhythmus weiter wie vorher. Genau das ist
  der Sinn: Die Änderung gilt für heute, nicht für immer. Sieh in **Training** nach, dass dein Plan
  noch so aussieht wie vorher; **das** ist hier die eigentliche Prüfung.

**Wenn nicht:**
- Der Coach kommt gar nicht bis zum Speichern → **ohne Begründung geht es nicht**. Der Server
  antwortet dann (nachgemessen): *„Bitte schreib dazu, warum – der Athlet liest diesen Satz."*
- Er will übermorgen ändern und bekommt eine Absage → richtig so: erlaubt sind **heute und morgen**,
  alles andere gehört in den Plan.
- Die Nachricht steht im Postfach, aber es kam kein Push → dann liegt es nicht am Pivot. Zurück zu
  6a/6b.
- **Du änderst deine Einheit selbst und bekommst keinen Push** → auch richtig so. Die Mitteilung geht
  nur raus, wenn es **jemand anderes** war; die eigene Entscheidung muss dir niemand melden.
- Du suchst in der Trainingsansicht nach einer Zeile „Heute geändert: …" und findest keine → **das
  ist der Stand von 3.0.0, kein Fehler deines Geräts.** Der Server kennt die Änderung
  (`GET /api/session-override/:userId` liefert sie samt fertigem Satz), die Trainingsansicht zeichnet
  sie noch nicht; du erfährst es über Push und Postfach. Der Auftrag steht in `DEFER-B1.md`.

> **Was hier ausdrücklich NICHT kommt:** ein Push zur **Zielanpassung** der Ernährung. Die landet als
> **Nachricht im Postfach** (beim Athleten „Vorschlag für dein Kalorienziel", beim Coach
> „Zielanpassung wartet auf dich") – bewusst ohne Push. Eine Zahl, über die du in Ruhe entscheiden
> sollst, gehört nicht auf den Sperrbildschirm.

### 7 · Apple-Kurzbefehl end-to-end

**Was du tust:**
1. In der App: **Analyse → Gesundheitsdaten verbinden → Apple Health → „Automatische Übertragung
   einrichten"**, dann **Link kopieren**. (Derselbe Weg steht auch unter *Profil → Gesundheitsdaten
   verbinden*.)
2. Den Kurzbefehl nach **HEALTH-IMPORT.md, Abschnitt 1** bauen und **einmal von Hand starten**.

**Was passieren muss:** Der Kurzbefehl läuft ohne Fehler durch, und in der App steht unter *Apple
Health* die Zeile **„Zuletzt: …"** mit dem heutigen Datum. Die Werte tauchen in der Analyse auf
(Schlaf, Schritte, Verbrauch), Trainings unter **Training → Cardio** mit dem Apple-Zeichen.

**Wenn nicht – die Antwort sagt dir, warum.** Häng im Kurzbefehl hinter „Inhalte von URL abrufen" die
Aktion **„Mitteilung anzeigen"** mit dem Ergebnis an, dann siehst du sie:
- `{"ok":true,"days":1,…}` → alles richtig; wenn trotzdem nichts zu sehen ist, hast du in der App das
  falsche Datum offen.
- **409** mit `"needsConsent":true` → die **Einwilligung** fehlt (seit 2.6.0 Voraussetzung). In der
  App: **Profil → Daten & Verbindungen → Einwilligung**. Danach den Kurzbefehl erneut starten. Ohne
  die Mitteilungs-Aktion scheitert der Kurzbefehl an dieser Stelle **still**, Nacht für Nacht.
- **401** → der Schlüssel stimmt nicht mehr (in der App neu erzeugen und in den Kurzbefehl
  übernehmen).
- **429** → mehr als 60 Übertragungen in einer Stunde; einfach abwarten.

**Erst wenn der Lauf von Hand grün ist,** die Automation anlegen (Kurzbefehle → Automation →
Tageszeit, z. B. 23:50, „Vor dem Ausführen fragen" **aus**).

### 8 · Offline-Start im Flugmodus

**Was du tust:** Die App **einmal normal öffnen** (damit die Hülle im Cache liegt) und wieder
schließen. Dann **Flugmodus an** – und WLAN prüfen, der Flugmodus lässt WLAN manchmal an. Jetzt die
App über das Icon starten.

**Was passieren muss:**
- Die App **startet** und zeigt die Startseite, keine Fehlerseite des Browsers.
- Oben im Kopf steht ein Hinweis auf den Zustand („Offline" bzw. „Stand HH:MM · offline").
- Ein **Check-in** oder ein **Satz** lässt sich eintragen; im Kopf steht danach „Offline · 1 wartet".

Dann **Flugmodus aus** und warten:
- Die wartenden Einträge gehen von selbst raus, der Zähler geht auf 0, nichts kommt doppelt an.

**Wenn nicht:**
- Die App startet gar nicht → der Service Worker hat die Hülle nicht abgelegt. Einmal online öffnen,
  20 Sekunden offen lassen, App schließen, dann erneut versuchen.
- Die App startet, aber alles steht auf 0 statt auf dem letzten Stand → der Gerätespeicher dieses
  Kontos ist leer (nach „Abmelden" ist er das bewusst).
- Nach dem Flugmodus bleiben Einträge liegen → die App versucht es weiter; erst nach fünf vergeblichen
  Anläufen stellt sie einen Eintrag hinten an. **Nichts wird verworfen.** Melden, wenn der Zähler
  nach einigen Minuten mit Netz nicht auf 0 geht.

> Wenn nach einer Auslieferung einmal gar nichts mehr geht – weiße Seite, alte Version, Neuladen
> hilft nicht: `https://DEINE-URL/?swkill=1` in **Safari** aufrufen. Das ist der Notausgang
> (DEPLOY-PRUEFEN.md).

---

## Teil B · Am nächsten Trainingstag

### 9 · Erinnerung kommt von selbst

**Was du tust (am Abend davor):** Unter **Profil → Erinnerungen** die Chip-Reihe
**„Trainings-Erinnerung"** auf eine Uhrzeit stellen, zu der du erreichbar bist. Dann **nichts weiter
tun** – insbesondere den Trainingstag am nächsten Morgen **nicht** vorher schon bestätigen.

**Was passieren muss:** Zur eingestellten Stunde (deutsche Zeit) kommt die Mitteilung **„Heute ist
Trainingstag! 💪"**, darunter der Name des Plantags. Ein Tipp öffnet die App.

**Wenn nicht – der Reihe nach prüfen:**
1. Steht die Uhrzeit wirklich auf einer Stunde und nicht auf „Aus"? Ohne Uhrzeit wird nicht erinnert.
2. War heute laut Rhythmus überhaupt **Trainingstag**? An einem Ruhetag kommt bewusst nichts.
3. Hattest du den Tag schon bestätigt? Dann wird die Erinnerung bewusst unterdrückt.
4. Lief der Server zur vollen Stunde? Der Zeitgeber tickt stündlich und holt bis zu **drei Stunden**
   nach – schläft der Dienst länger, fällt die Erinnerung des Tages aus. Der Zustand steht in der
   **Verwaltung → Jobs** (`cron.tick`: `up` / `late` / `down`).
5. Zeitzone: Die Uhrzeiten sind **deutsche Zeit** (`APP_TZ`, Standard `Europe/Berlin`). Wer in einer
   anderen Zone sitzt, bekommt die Erinnerung entsprechend verschoben.

---

## Teil C · Beim nächsten Training

Diese drei Punkte gehören zusammen und gehen nur mit einer echten Einheit: **Gewicht und
Wiederholungen bei einem Satz eintragen und den Haken setzen.** Damit startet die Pause, und erst
damit hat iOS die Erlaubnis, Ton zu machen.

### 10 · Ton am Ende der Pause

**Was du tust:** Einen Satz bestätigen. Die Pausen-Leiste läuft. Das iPhone **nicht** sperren, den
Bildschirm ansehen und die Pause ablaufen lassen (zur Not über die Zeit-Anzeige eine kurze Länge
wählen, z. B. 60 s).

**Was passieren muss:** Bei 0:00 ein kurzer Ton, ein Vibrieren, und der Hinweis „Pause vorbei –
nächster Satz".

**Wenn nicht:**
- Kein Ton, aber Vibration → der **Klingelschalter** an der Seite des iPhones steht auf lautlos. iOS
  gibt Web-Ton nur frei, wenn er nicht auf stumm steht.
- Weder Ton noch Vibration → der Ton wird beim **ersten bestätigten Satz** der Sitzung freigeschaltet
  (iOS erlaubt das nur während einer echten Berührung). Wenn du die Pause über „Pause starten"
  ausgelöst hast, ohne vorher einen Satz zu haken, kann das fehlen. Einen Satz bestätigen und erneut
  probieren.

### 11 · Wake-Lock: der Bildschirm bleibt an

**Was du tust:** Einen Satz bestätigen, das Telefon hinlegen und **nicht anfassen**, bis die Pause
abgelaufen ist (60–180 s).

**Was passieren muss:** Der Bildschirm bleibt **an**, solange die App im Vordergrund ist; der
Countdown läuft sichtbar weiter. Nach „Training abschließen" darf der Bildschirm wieder von selbst
dunkel werden.

**Wenn nicht:** Prüf **iOS-Einstellungen → Anzeige & Helligkeit → Automatische Sperre**; steht sie
auf 30 Sekunden, gewinnt in manchen iOS-Fassungen das System. Wechselst du kurz in eine andere App,
gibt iOS den Wake-Lock von sich aus frei – beim Zurückkommen holt die App ihn sich wieder.

### 12 · Pausen-Timer mit gesperrtem Bildschirm

**Was du tust:** Einen Satz bestätigen, dann das iPhone **sofort sperren** (Seitentaste). Warten, bis
die Pause sicher vorbei ist, dann entsperren und die App ansehen.

**Was passieren muss:**
- Nach dem Entsperren steht die Pause **richtig** da – also abgelaufen bzw. mit der korrekten
  Restzeit auf die Sekunde. Der Countdown rechnet gegen die Uhr, nicht gegen einen zählenden Timer.
- Der Hinweis **„Pause vorbei – nächster Satz"** erscheint, sobald die App wieder läuft.
- **Ohne Ton und ohne Vibration** – das ist Absicht: Ist die Pause beim Zurückkommen schon länger als
  drei Sekunden vorbei, wäre der Piepser nur noch Lärm; du schaust ja gerade auf den Bildschirm.

**Was NICHT passieren wird – und das ist bekannt:** Die Meldung kommt **nicht pünktlich zur Sekunde
null**, solange das Telefon gesperrt ist. iOS hält die Seite dabei an; JavaScript läuft erst wieder,
wenn du entsperrst. Eine Meldung, die auch bei gesperrtem Bildschirm zur Sekunde kommt, bräuchte
einen vom Server geschickten Push und ist ausdrücklich **nicht gebaut** (`DEFER-A1.md`, B8-Rest).
**Rechne also nicht damit, dass dich das Telefon aus der Tasche heraus zum nächsten Satz ruft.** Was
trägt, ist der Countdown, der beim Entsperren auf die Sekunde stimmt.

**Wenn die Restzeit nach dem Entsperren falsch ist** – etwa stehen geblieben oder um die Sperrzeit
zu hoch –, ist das ein echter Befund. Notier: Pausenlänge, wie lange gesperrt, was dastand.

### 13 · Supersatz: die Pause gehört der Gruppe (neu in 3.0.0)

Seit 3.0.0 lassen sich zwei Übungen zu einem **Supersatz** koppeln. Der Punkt daran ist die Pause –
und ob sie am Gerät wirklich so läuft, sieht man erst mit Hanteln in der Hand.

**Was du tust (einmalig vorbereiten):** Training → bei einer Übung auf **„···" → „Supersatz"** →
eine zweite (oder dritte) Übung **desselben Tages** wählen → **„Supersatz speichern"**. Die Karten
tragen danach statt ihrer Nummer eine Gruppenmarke: **A1, A2**.

**Dann trainieren:** Bei **A1** einen Satz eintragen und haken. Weiterschauen, **ohne zu tippen**.

**Was passieren muss:**
- Nach dem Haken bei A1 startet **keine** Pause. Die App springt direkt zur Zeile von **A2** – dort
  steht der Hinweis, dass es ohne Pause weitergeht.
- Erst wenn der Satz bei **A2** gehakt ist, läuft die Pausen-Leiste los – **einmal für beide**.
- Ton, Vibration und Wake-Lock verhalten sich dabei genau wie in den Punkten 10 und 11. Der Ton wird
  weiterhin beim **ersten** gehakten Satz der Sitzung freigeschaltet, also schon bei A1.

**Wenn nicht:**
- Nach A1 läuft sofort eine Pause → entweder ist die Gruppe nicht gespeichert (Karten neu laden: steht
  die Marke A1/A2 noch da?) oder es ist ein echter Befund. Notier, welche Übung, welcher Satz.
- Die App springt zu A2, aber der Bildschirm wird zwischendurch dunkel → Punkt 11, nicht dieser Punkt.
- Du willst die Kopplung wieder los: **„···" → „Supersatz" → auflösen.** Danach hat jede Übung wieder
  ihre eigene Pause.

---

## Ergebnisblatt

| # | Punkt | ✓ / ✗ | Notiz |
|---|---|---|---|
| 1 | Version und Schema | | |
| 2a | Hinweiszeile unter dem Kopf (in Safari, nach dem ersten Satz) | | |
| 2b | Auf dem Home-Bildschirm, Vollbild | | |
| 3 | Safe-Area oben und unten | | |
| 4 | Tastatur verdeckt keine Eingabe | | |
| 5 | Erlaubnis für Mitteilungen | | |
| 6a | Test-Mitteilung (Anzeige auf dem Gerät) | | |
| 6b | Echter Push vom Server (Coach-Nachricht) | | |
| 6c | Push bei geänderter Einheit (Pivot, ab 3.0.0) | | |
| 7 | Apple-Kurzbefehl end-to-end | | |
| 8 | Offline-Start im Flugmodus | | |
| 9 | Erinnerung am Trainingstag | | |
| 10 | Ton am Pausenende | | |
| 11 | Wake-Lock während der Pause | | |
| 12 | Pausen-Timer bei gesperrtem Bildschirm | | |
| 13 | Supersatz: eine Pause für die Gruppe (ab 3.0.0) | | |

**Die Punkte 2b, 5, 6b und 9 sind die Kette, an der die ganze Tagesschleife hängt.** Bricht einer
davon, läuft die App im echten Leben nicht an – dann lohnt kein weiterer Ausbau, bevor der Punkt
steht. Die übrigen sind Komfort und Feinschliff.
