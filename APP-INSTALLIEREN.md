# BE INEVITABLE als App nutzen (iPhone & Android)

BE INEVITABLE ist eine **Web-App (PWA)**: Sie läuft im Browser **und** lässt sich mit
einem Tipp wie eine echte App auf den Home-Bildschirm legen – ohne App Store, ohne Kosten.
Web und App teilen sich dasselbe Konto und dieselben Daten; du kannst jederzeit beides nutzen.

> **Auf dem iPhone ist das kein Komfort, sondern Voraussetzung.** Apple gibt Web-Push
> **ausschließlich** an die installierte App heraus. Solange BE INEVITABLE im Safari-Tab läuft, kann
> sie dich **gar nicht** erinnern – kein Trainingstag, keine Coach-Nachricht, kein Wochenrückblick.

## iPhone / iPad (Safari)
> Wichtig: Das geht **nur in Safari**, nicht in Chrome oder Firefox auf dem iPhone.

1. Die App-Adresse in **Safari** öffnen (`https://DEINE-APP.onrender.com`).
2. Unten auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben ↑).
3. Im Menü nach unten scrollen → **„Zum Home-Bildschirm"**.
4. Oben rechts **„Hinzufügen"**. Fertig – das BE-INEVITABLE-Icon liegt jetzt auf dem Home-Bildschirm.
5. Ab jetzt die App über dieses Icon starten: Vollbild, ohne Browser-Leiste, wie eine native App.

## Android (Chrome)
1. Die Adresse in **Chrome** öffnen.
2. Chrome bietet meist automatisch **„App installieren"** an (Banner oder Menü ⋮ → „App installieren / Zum Startbildschirm hinzufügen").
3. Bestätigen – Icon liegt auf dem Startbildschirm.

## Am Computer
Über das Installieren-Symbol in der Adressleiste oder das Browser-Menü („Installieren").
Die App bekommt dann ein eigenes Fenster ohne Browser-Leiste.

**Dieselbe Anleitung steht in der App**: Profil → Daten & Verbindungen → **„Als App installieren"**.

---

## Wann die App selbst danach fragt (seit 2.9.0)

Bis 2.8.0 erschien der Hinweis **1,6 Sekunden nach dem allerersten Öffnen** – also bevor jemand einen
Grund hatte, die App auf seinem Startbildschirm zu wollen. Seit 2.9.0 gilt die Reihenfolge
**erst installieren, dann fragen, dann erinnern**, und der Hinweis kommt entsprechend spät.

**Es gibt genau drei Türen zur Anleitung – und nur eine davon macht von selbst auf:**

**1. Die schmale Zeile unter dem Kopf – auf jedem Gerät, aber nicht auf der Startseite.**
Auf dem iPhone/iPad heißt sie „Auf den Startbildschirm legen – nur so kann die App dich erinnern.",
auf Android und am Rechner „Als App installieren – eigenes Fenster, schnellerer Start,
Erinnerungen." (Der Unterschied ist Absicht: dass **gar keine** Erinnerung möglich ist, stimmt nur
auf iOS.) Ein Tipp auf die Zeile – die ganze Zeile, nicht nur ein Wort darin – öffnet die Anleitung
mit den drei Bildern; das „×" rechts legt sie für **30 Tage** schlafen.

Sie steht auf **Training, Ernährung, Mindset und Analyse** – **nicht** auf der Startseite. Das ist
gemessen, nicht Geschmack: die Startseite ist die einzige Ansicht mit einem Höhenbudget
(**unter 1.000 px**), und die Zeile allein trieb sie bei 2.9.0 auf 1.064 px.

**Der Anlass ist der Reiterwechsel.** Die App startet auf der Startseite, und dort gehört die Zeile
nicht hin – sie kommt also **beim Tippen auf einen der vier anderen Reiter**, nicht schon beim
Öffnen. Tippst du zurück auf Home, verschwindet sie wieder; beim nächsten Wechsel ist sie da.
Nachgemessen bei 2.9.0 (eigenes Konto, ein Satz vorhanden, nicht installiert):
Startseite **996 px ohne Zeile**; nach dem Tipp auf Training, Ernährung, Mindset oder Analyse steht
die Zeile jeweils **44 px hoch, 69 px unter der Bildschirmkante** über dem Inhalt; zurück auf Home
ist sie wieder weg.

> **Stand 3.0.0, nachgemessen – und die Zahl hängt davon ab, was schon im Tag steht:**
> `tools/accent.mjs` meldet bei einem frischen Tag **„Home 980 px hoch (Ziel < 1000)"** und ist grün
> (viermal wiederholt). Läuft dasselbe Werkzeug **nachdem** an diesem Tag ein Satz, eine Mahlzeit und
> ein Check-in eingetragen wurden, misst es **1.073 px** und meldet rot. Das Budget hält also im
> ruhigen Zustand, aber nicht in jeder Datenlage – der Auftrag, den zusätzlichen Block zu finden,
> steht in `DEFER-B1.md` (D8). **Für die Entscheidung unten ändert das nichts, im Gegenteil:** Die
> Startseite hat keinen Platz übrig, den man mit einer Installations-Karte belegen könnte.

Sie erscheint nur, wenn **alle vier** Bedingungen zutreffen:

1. Es ist dein **eigenes Athleten-Konto** (im Coach-Blick auf einen Athleten erscheint sie nie).
2. Die App läuft **nicht** schon als installierte App.
3. Du hast **deinen ersten Satz geloggt** – der Hinweis kommt nach dem ersten Eintrag, nicht davor.
   (Es reicht ein einziger gespeicherter Satz; ein ganzes Training musst du dafür nicht abschließen.)
4. Du hast sie **nicht in den letzten 30 Tagen** mit „×" weggetippt.

**2. Profil → Daten & Verbindungen → „Als App installieren" – überall, jederzeit.**
Der Weg, den es auf **jedem** Gerät gibt. (In einem **Coach- oder Admin-Konto** heißt dieses
Unter-Sheet nur **„Daten"** – die Zeile „Als App installieren" steht in beiden.)
Dahinter stehen dieselben drei Bilder für deinen Weg
(iOS: Teilen → Zum Home-Bildschirm → Hinzufügen; Android: Menü → App installieren → Öffnen; am
Rechner: Adressleiste → Installieren), und es steht immer der **andere** Weg dabei – für den Fall,
dass du am Rechner liest und die App aufs Handy legen willst. Die Anleitung selbst heißt auf Handys
**„Auf den Startbildschirm legen"** und am Rechner **„Als App installieren"** – einen
Startbildschirm gibt es dort nicht (nachgemessen in beiden Fällen: drei Bilder, drei Schritte,
dazu der andere Weg).

**3. Der Push-Schalter – auf dem iPhone.**
Schaltest du in **Profil → Erinnerungen** die Push-Mitteilungen ein, während die App im Safari-Tab
läuft, öffnet sich statt des Systemdialogs dieselbe Anleitung. Das ist kein Fehler: iOS gibt Push
nur an die installierte App heraus, also führt der Schalter dorthin, wo er hinführen muss.

**Was es ausdrücklich NICHT gibt – damit du nicht danach suchst:**

- **Kein Banner beim ersten Start.** Vor dem ersten Eintrag fragt niemand.
- **Keine Karte auf der Startseite.** Sie wurde gebaut und wieder herausgenommen: das Ziel für die
  Startseite sind **unter 1.000 px** (nachgemessen 965–996 px bei 2.9.0, **980 px** bei 3.0.0 am
  ruhigen Tag – siehe den Kasten oben), und die schlankeste Fassung der Karte maß allein **305 px**.
  Die Startseite bleibt kurz; der Trichter
  lebt auf den anderen Reitern, also genau dort, wo trainiert und eingetragen wird.
- **Kein Sheet, das sich selbst öffnet.** Ein Fenster, das 1,2 Sekunden nach dem Zeichnen über der
  Reiter-Leiste liegt, kostet Taps und Nerven – gemessen und wieder entfernt.

„Später" heißt wirklich später: einmal auf das „×" getippt, und es ist 30 Tage Ruhe. Nachgemessen:
direkt nach dem „×" ist die Zeile weg und bleibt es auch beim nächsten Reiterwechsel; mit einem auf
**29 Tage** zurückgedrehten Merker bleibt sie weg, mit **31 Tagen** kommt sie wieder. Der Merker
liegt im Browser dieses Geräts, nicht im Konto: auf einem zweiten Gerät fängt die Rechnung neu an.

Die ausführliche Anleitung findest du jederzeit unter
**Profil → Daten & Verbindungen → „Als App installieren"**.

---

## Was die installierte App kann
- **Vollbild** mit eigenem App-Icon, getrennt vom Browser, mit den Rändern des Geräts richtig
  berücksichtigt (Dynamic Island oben, Home-Balken unten).
- **Push-Mitteilungen**: Trainings-Erinnerung zur gewählten Stunde, Coach-Nachrichten,
  Planänderungen, Wochenrückblick am Sonntag. Auf dem iPhone geht das **erst, nachdem** die App zum
  Home-Bildschirm hinzugefügt wurde – danach fragt die App selbst nach dem ersten Eintrag, und erst
  auf dein „Ja" kommt der Systemdialog von iOS. Einstellen und abschalten lässt sich alles unter
  **Profil → Erinnerungen**.
- **Start ohne Netz** (seit 2.3.0): Ein Service Worker hält die Programmhülle vor, die App startet
  also auch im Flugmodus und zeigt den letzten Stand („Stand 20:14 · offline").
- **Eintragen ohne Netz**: Sätze, Essen, Check-ins, Supplements und Cardio landen in einer
  Warteschlange auf dem Gerät („Offline · 1 wartet") und gehen von selbst raus, sobald wieder Netz
  da ist. Nichts geht verloren, nichts kommt doppelt an.
- **Schnellstart-Verknüpfungen** (Android/Desktop, langes Drücken auf das Icon): Training,
  Essen loggen, Priming.

## Apple Health
Die direkte Health-Synchronisierung ist Apple-bedingt **nur in einer echten nativen App** möglich,
nicht in der Web-/PWA-Version. Solange überträgst du Health-Daten bequem per **Kurzbefehl**
(siehe HEALTH-IMPORT.md). Eine native App (mit echtem HealthKit-Zugriff) ist als späterer Ausbau
vorgesehen – der Server-Endpoint dafür (`/api/health/push`) ist bereits vorhanden.

## Updates
Es gibt nichts zu aktualisieren: Bei jedem Öffnen lädt die App automatisch die neueste Version
vom Server. Die laufende Versionsnummer steht unten im Login-Screen und im Profil.

Sollte ein Gerät nach einer Auslieferung einmal hängen (weiße Seite, alte Version, Neuladen hilft
nicht), gibt es einen Notausgang: **`https://DEINE-APP.onrender.com/?swkill=1`** in Safari aufrufen.
Erklärung: DEPLOY-PRUEFEN.md.

---

**Ob das alles auf deinem Gerät wirklich funktioniert, prüfst du mit IPHONE-TEST.md** – Punkt für
Punkt, zum Abhaken.
