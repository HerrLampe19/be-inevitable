# BE INEVITABLE — Coaching App

Eine Web-App mit Backend und Datenbank: Athleten-Profile, Coach-Zugang, Trainingspläne,
Satz-Tracking, Meal Plan und täglicher Check-In. Läuft lokal auf deinem Windows-PC,
ist später 1:1 auf einen echten Server umziehbar.

---

## 1. Voraussetzung: Node.js installieren (einmalig)

1. Gehe auf **https://nodejs.org**
2. Lade die **LTS-Version** herunter (großer grüner Button, "LTS").
   Wichtig: mindestens **Node 18+**, empfohlen **Node 20 oder 22**.
3. Installer ausführen, alles auf "Next" / Standard lassen, fertig.
4. Prüfen: Öffne die **Eingabeaufforderung** (Windows-Taste → "cmd" tippen → Enter)
   und gib ein:
   ```
   node -v
   ```
   Es sollte eine Version wie `v22.x.x` erscheinen. Klappt das, bist du startklar.

---

## 2. Projekt vorbereiten

1. Entpacke die ZIP-Datei (z.B. nach `C:\be-inevitable`).
2. Öffne die Eingabeaufforderung **in diesem Ordner**:
   - Im Datei-Explorer in den entpackten Ordner gehen.
   - Oben in die Adressleiste klicken, `cmd` tippen, Enter.
   (Dann ist die Eingabeaufforderung direkt im richtigen Ordner.)
3. Pakete installieren (einmalig, dauert ~1 Min.):
   ```
   npm install
   ```

   Hinweis: Falls `npm install` eine Fehlermeldung zu **better-sqlite3** zeigt
   (das braucht Build-Tools), ist das **kein Problem** — die App nutzt dann
   automatisch die in Node 22 eingebaute Datenbank. Du kannst dann einfach mit
   Schritt 3 weitermachen. (Für die robustere Variante siehe ganz unten: "Optional".)

---

## 3. Datenbank füllen (einmalig)

```
npm run seed
```

Das legt die Datenbank an und füllt sie mit deinen echten Daten (Plan, Meal Plan,
187 Lebensmittel) plus zwei Demo-Accounts:

- **Coach:**  `coach@be-inevitable.at`  /  Passwort `coach123`
- **Athlet:** `marco@be-inevitable.at`  /  Passwort `marco123`

> Falls du später nochmal komplett neu starten willst: Datei `data.db` im Projektordner
> löschen und `npm run seed` erneut ausführen.

---

## 4. App starten

```
npm start
```

Du siehst:
```
  BE INEVITABLE läuft auf http://localhost:3000
```

Öffne im Browser **http://localhost:3000** und logge dich mit einem der Accounts oben ein.

Zum Stoppen: in der Eingabeaufforderung **Strg + C** drücken.

---

## 5. Auf dem Handy testen (im selben WLAN)

Solange dein PC die App laufen hat, kannst du sie auch am Handy öffnen:

1. PC und Handy müssen im **gleichen WLAN** sein.
2. Finde die lokale IP deines PCs: Eingabeaufforderung → `ipconfig` → such die
   "IPv4-Adresse", z.B. `192.168.1.42`.
3. Am Handy im Browser öffnen: `http://192.168.1.42:3000`
4. In Safari (iPhone): Teilen-Symbol → **"Zum Home-Bildschirm"**.
   Dann hast du ein App-Icon, das im Vollbild startet — dein "Gateway" zur App.

> Hinweis: Falls das Handy den PC nicht erreicht, liegt es meist an der
> **Windows-Firewall**. Beim ersten `npm start` fragt Windows, ob Node.js im Netzwerk
> kommunizieren darf — hier "Zugriff zulassen" wählen (privates Netzwerk).

---

## Was kann die App?

**Als Athlet:**
- **Heute-Ansicht:** zeigt automatisch, welcher Trainingstag heute dran ist (nach deinem Rhythmus), dein Kalorienziel, Gewichtsverlauf als Kurve und einen Schnell-Check-in.
- **Trainingsrhythmus statt Wochentage:** Du legst fest, wie oft pro Woche du trainierst (z.B. 4×). Die App bildet daraus ein Muster wie „2 Tage Training, 1 Ruhetag" und rotiert die Trainingstage automatisch. Bist du krank, meldest du das – die App macht danach nahtlos weiter, ohne einen Tag zu verlieren.
- **Progressions-Coach:** Bei jeder Übung siehst du deine letzten Werte (grau) und eine Empfehlung: Hast du die obere Reps-Grenze übertroffen, schlägt die App mehr Gewicht vor. Kamst du unter die untere Grenze, schlägt sie weniger vor. Dazwischen: Gewicht halten, mehr Reps anstreben.
- **Übungs-Videos:** Pro Übung ein Button „Ausführung ansehen" (YouTube-Suche oder vom Coach hinterlegter Link).
- **Ernährung:** wählt automatisch Trainings-/Ruhetag passend zum heutigen Tag, mit Makro-Übersicht.
- **Nachrichten:** Ändert dein Coach etwas an deinem Plan, bekommst du eine Nachricht („Coach hat deinen Plan angepasst: Reps 8-12 → 6-10").
- **Coach-Schutz:** Änderst du eine vom Coach erstellte Übung, kommt erst eine Warnung.
- Makro-Rechner, Technik-Lexikon, Supplements, Profil mit Zielen, Phase (Offseason/Prep) und Kalorienzielen.

**Als Coach:**
- **Athleten-Übersicht mit Ampel:** grün = diese Woche trainiert, gelb = noch nicht, rot = seit über 4 Tagen inaktiv ("Achtung"). Auf einen Blick siehst du, wer durchhängt.
- **Dashboard pro Athlet:** Gewichtsverlauf als Kurve, Trainingsvolumen als Balken, letzte Trainingseinheiten (Übungen/Sätze/Top-Gewicht), Cardio und Schlaf/Schritte.
- **Direkt eingreifen:** Plan bearbeiten, Nachricht schicken, Phase & Kalorienziele setzen – jede Änderung löst automatisch eine Nachricht an den Athleten aus.
- Athleten per E-Mail zuordnen.

## Login zum Testen
- **Athlet:** `marco@be-inevitable.at` / `marco123`
- **Coach:** `coach@be-inevitable.at` / `coach123`

## Alles-in-einem (neu)
- **Kalorien-Tracking:** Im Reiter „Ernährung → Heute" trackst du, was du gegessen hast – einzeln oder per „Aus Plan übernehmen". Der Ring auf der Startseite füllt sich, du siehst „so viel gegessen, so viel übrig" gegen dein Tagesziel.
- **Cardio als eigene Trainingsart:** Im Verlauf erfasst du Läufe, Rad, Rudern usw. Die Kalorien werden automatisch geschätzt (MET-basiert).
- **Recovery-Verbindung:** Hartes Cardio und Krafttraining gestern + dein Schlaf ergeben einen Erholungs-Score auf der Startseite mit konkreter Empfehlung („Volle Leistung möglich" / „Erwäge einen leichten Tag"). So weiß die App, ob dein Lauf am Dienstag dein Beintraining am Mittwoch beeinflusst.
- **Adaptive Oberfläche:** Im Profil stellst du dein Level ein. Anfänger bekommen Erklärungen und eine geführte Oberfläche; Profis schalten Details frei. Eine App für beide.

## Roadmap (was noch kommt)
- **Phase 2:** Rezept-Datenbank mit Makro-Filter, Übungen per Drag tauschen, ausgebautes Coach-Dashboard, echtes Messaging, Online-Deployment.
- **Phase 3 (braucht native App):** Apple-Health-Sync, Foto-Kalorienscan, KI-Formcheck per Video, KI-Coach-Chat, App Store.

---

## Datenspeicherung

Alle Daten liegen in der Datei **`data.db`** im Projektordner (SQLite).
Das ist deine komplette Datenbank — einfach mitkopieren = Backup.

---

## Optional: better-sqlite3 (robustere Datenbank)

Die App läuft mit der eingebauten Node-Datenbank völlig problemlos. Wenn du die
(etwas schnellere, ausgereiftere) `better-sqlite3`-Variante willst und `npm install`
dabei meckert, installiere einmalig die Windows-Build-Tools:

```
npm install --global windows-build-tools
```
oder installiere "Visual Studio Build Tools" mit der Workload "Desktop development with C++".
Danach `npm install` erneut. Nötig ist das aber **nicht**.

---

## Häufige Fragen

**Muss der PC immer laufen?**
Zum Testen ja — die App läuft, solange `npm start` aktiv ist. Für echten Dauerbetrieb
(andere Leute, von überall erreichbar) zieht man das Projekt später auf einen kleinen
Server um (z.B. für ein paar Euro im Monat). Der Code bleibt derselbe.

**Wie ändere ich den Port (falls 3000 belegt ist)?**
Vor dem Start: `set PORT=4000` und dann `npm start`. App läuft dann auf Port 4000.

**Wo sind meine echten Excel-Daten?**
Plan, Meal Plan und Lebensmittel sind beim `npm run seed` in die Datenbank gewandert.
Die Original-Tabellen brauchst du nicht mehr — alles ist jetzt in der App.

## Bedienung & Komfort (neu)
- **Onboarding:** Neue Nutzer werden nach der Registrierung durch einen geführten Wizard geleitet (Ziel, Erfahrung, Körperdaten, Frequenz) und bekommen automatisch Kalorienziele + einen passenden Trainingsplan.
- **Trainingsrhythmus-Editor:** Unter „Mehr → Trainingsrhythmus" baust du deine Wochen-Sequenz frei zusammen (Trainingstage/Ruhetage hoch/runter schieben, hinzufügen, entfernen, umschalten). Das Kalender-Widget auf der Startseite passt sich sofort an.
- **Kalender-Widget:** Auf der Startseite siehst du die kommenden 7 Tage mit Trainings-/Ruhetagen. Antippen öffnet den Rhythmus-Editor.
- **Speicher-Feedback:** Beim Eintragen von Sätzen erscheint „speichert… / ✓ gespeichert" direkt an der Übung – du weißt immer, dass deine Werte sicher sind.
- **Lösch-Schutz:** Gelöschte Übungen lassen sich 5 Sekunden lang per „Rückgängig" wiederherstellen.
- **Passwort:** Im Profil änderbar; der Coach kann das Passwort eines Athleten zurücksetzen.
- **Sicherheit:** Set-Eingaben auf 1–10 begrenzt, Brute-Force-Schutz beim Login, sichere Cookies im Online-Betrieb.

## Gym-Features (neu, auf Augenhöhe mit Top-Apps)
- **Rest-Timer:** Startet automatisch nach dem Eintragen der Reps (90 s) oder per Knopf. Mit +15s, Ton und Vibration am Ende – damit du die Pause nicht vergisst.
- **Persönliche Rekorde (PRs):** Jede Übung zeigt deinen Bestwert (🏆). Unter „Verlauf & PRs" siehst du bestes Gewicht, geschätztes 1RM (Epley-Formel) und meiste Reps.
- **Fortschritts-Charts pro Übung:** Deine 1RM-Entwicklung über alle Trainingseinheiten als Kurve.

## Sicherheit (Audit-Fixes)
- Selbst-Registrierung erstellt immer einen Athleten – niemand kann sich unbefugt Coach-Rechte geben.
- E-Mail-Validierung und Normalisierung (Groß-/Kleinschreibung egal beim Login).
- Eingabelängen begrenzt, alle datenverändernden Routen mit Zugriffsprüfung.

## Weitere Gym-Features (neu)
- **Hantelrechner:** Zielgewicht eingeben → zeigt, welche Scheiben pro Seite auf die Stange müssen (verschiedene Stangengewichte wählbar). Unter „Mehr".
- **Körpermaße:** Taille, Brust, Arm, Bein, Hüfte, Schultern, Nacken, Körperfett tracken – mit Verlaufskurve. Im Reiter „Verlauf".
- **Fortschrittsfotos:** Physik-Fotos aufnehmen (Vorne/Seite/Hinten), werden automatisch verkleinert und privat gespeichert; Galerie zum Vergleichen. Im Reiter „Verlauf".

## Admin-Bereich (stark ausgebaut)
- **Übersichts-Dashboard:** Beim Login sieht der Coach sofort Kennzahlen – Anzahl Athleten, wie viele diese Woche aktiv sind, wer Aufmerksamkeit braucht, Trainings/Woche.
- **Trainings-Aktivität:** Balkendiagramm der letzten 8 Wochen über alle Athleten.
- **Ziel-Verteilung:** Wie viele Athleten auf Muskelaufbau / Definition / Gesundheit trainieren.
- **Jüngste Aktivität:** Live-Feed, wer wann was trainiert hat.
- **Athleten-Suche:** Schnell-Filter bei vielen Athleten.

## Noch einfachere Bedienung
- **Begrüßung mit Namen** und Tageszeit auf der Startseite.
- **Trainings-Fortschrittsbalken:** Zeigt live „X von Y Sätzen gemacht" mit Erfolgsmeldung bei 100 %.

## Feedback-Runde (neu)
- **Nachrichten-Badge:** Prägnanter roter Zähler an der Glocke, pulsierend; neue Coach-Nachrichten erscheinen automatisch (Abruf alle 30 s).
- **Trainingstage verwalten:** Über das ⚙️-Symbol neben den Tag-Chips umbenennen oder löschen.
- **Startgewicht** ist jetzt ein fester Wert (nicht mehr änderbar).
- **Vorwerte vorausgefüllt:** Letztes Gewicht/Reps stehen grau im Feld – antippen übernimmt, sonst überschreiben. Weniger Tipparbeit.
- **Essen flexibler:** Aus Liste, Schnell-Eintrag (nur Kalorien), oder eigenes Lebensmittel anlegen (wird gespeichert). Häufig genutzte zuerst.
- **Notizen/Beschwerden pro Übung:** z.B. „Schulter knackt" – beim Coach rot hervorgehoben, mit „erledigt"-Funktion.
- **Fortschritts-Karte auf Home:** Startgewicht → heute, mit Bewertung passend zum Ziel.
- **Erklär-Tooltips:** Erholungs-Score und Streak antippen erklärt, was dahintersteckt.
- **Adaptiv:** Profis sehen Körpermaße & Fotos direkt auf der Startseite.

## Interaktiver Kalender (neu)
- **Monatsansicht:** Das Plan-Widget auf der Startseite (oder „Mehr → Kalender") öffnet einen vollen Monatskalender. Zwischen Monaten blättern.
- **Tage vorausplanen:** Tippe einen beliebigen zukünftigen Tag an und lege fest, was ansteht – Ruhetag (z.B. wenn du unterwegs bist), ein bestimmter Trainingstag oder Krank/Pause.
- **Rhythmus rechnet automatisch weiter:** Schiebst du einen Ruhetag ein, geht dein Trainingsrhythmus danach nahtlos weiter – kein Trainingstag geht verloren, er wird nachgeholt.
- **Geplante Tage** sind mit einem blauen Punkt markiert; „Automatisch" entfernt eine Planung wieder.

## Rollensystem (neu): Athlet · Coach · Admin
Drei Rollen mit klarer Hierarchie (Admin > Coach > Athlet). Höhere Rollen schließen die Fähigkeiten der niedrigeren ein.

**Athlet** – trainiert. Sieht nur die eigenen Daten (Home, Training, Ernährung, Verlauf). Keine Verwaltung.

**Coach** – betreut seine zugeordneten Athleten. Übersichts-Dashboard, Pläne/Ernährung bearbeiten, Beschwerden sehen, Athleten anlegen/zuordnen. Sieht NICHT alle Systemnutzer und kann keine Coaches/Admins erstellen.

**Admin** – verwaltet das System. Eigener „Verwaltung"-Reiter: alle Nutzer sehen, neue Nutzer mit beliebiger Rolle anlegen, Rollen ändern, Athleten Coaches zuordnen, Nutzer löschen. Kann zusätzlich alle Coach- und Athleten-Ansichten nutzen (sieht z.B. alle Athleten in der Übersicht). Schutzmechanismen: der letzte Admin kann sich nicht selbst degradieren oder löschen.

Selbst-Registrierung erzeugt weiterhin immer einen Athleten. Coaches/Admins werden vom Admin in der App oder per Script angelegt.

## Rezept-Datenbank (neu)
Löst den größten Ernährungs-Schmerz: kein lästiges Tracken einzelner Zutaten mehr.
- **Fertige Mahlzeiten** mit kompletten Nährwerten (Kalorien + Makros), vorgeladen mit zielgerechten Rezepten für Aufbau, Definition und Gesundheit – je Mahlzeit (Frühstück/Mittag/Abend/Snack).
- **Mit einem Tipp loggen:** Rezept öffnen → „Als gegessen eintragen" → landet direkt im Tagesprotokoll. Fertig.
- **Smarte Filter:** nach Ziel, nach Mahlzeit, und „passt noch in mein heutiges Kalorienbudget" (nutzt die Restkalorien des Tages).
- **Zutaten & Zubereitung** in der Detailansicht, plus optionaler Link zu einem externen Rezept/Video (wie die Übungsvideos).
- **Eigene Rezepte** anlegen (z.B. die Standard-Mahlzeit, die man oft isst) – werden gespeichert und zuerst angezeigt.
- Rezepte werden online beim ersten Start automatisch geladen (idempotent).

## Verbesserungen aus Live-Feedback (neu)
- **Krankheitstag verschiebt jetzt aktiv:** Ein als „krank" markierter Tag wird eingeschoben, das geplante Training geht nicht verloren, sondern wird nachgeholt (wie ein eingeschobener Ruhetag). Bug behoben.
- **Rezepte filtern automatisch:** Beim Öffnen werden Ziel (aus dem Profil) und Mahlzeit (aus der Uhrzeit) vorausgewählt – manuell weiter änderbar. Rezept-Auswahl auf 29 erweitert.
- **Technik-Lexikon in den Übungen:** Beim Bearbeiten einer Übung lassen sich Technik-Begriffe per „📖 Begriffe" aus dem Lexikon übernehmen. An der Übung selbst sieht der Athlet die gesetzte Technik und kann sie antippen, um die Erklärung zu lesen.
- **Rollen aufgeräumt:** Coaches und Admins haben kein Athleten-Profil mehr (kein Größe/Gewicht/Kalorien) – nur noch Name/Passwort. Das volle Profil gibt es nur für Athleten.
- **Kalender-Icons** auf dem Smartphone sauber zentriert und ohne Überlauf (responsive Schriftgröße).

## Supplements ausgebaut (neu)
Aus der simplen Liste ist ein echtes, vom Coach steuerbares Protokoll geworden.
- **Vollständige Infos je Supplement:** Dosierung, Wann (Timing), mit/ohne Wasser, und ein Einnahme-/Wirkungshinweis. 12 gängige Supplements vorbefüllt (Kreatin, Whey, Omega 3, Magnesium, Pre-Workout …).
- **Coach legt pro Athlet Pflicht fest:** Im Athleten-Dashboard → „💊 Supplements" weist der Coach Supplements zu, markiert sie als Pflicht oder optional und kann Dosierung/Timing individuell anpassen oder einen persönlichen Hinweis hinterlegen (z.B. „abends wegen Schlaf").
- **Athlet sieht sein Protokoll:** Pflicht-Supplements oben hervorgehoben, dann optionale. Tippen zeigt alle Details. Solange der Coach nichts zugewiesen hat, dienen die Standard-Empfehlungen zur Orientierung.
- Supplements werden online beim Start automatisch nachgetragen (idempotent, bestehende Daten bleiben).

## Cardio ausgebaut (neu)
Cardio ist jetzt vollwertig im Training-Reiter (eigener Tab „Cardio" neben „Kraft") – auch für Ausdauer-fokussierte Nutzer.
- **13 Sportarten:** Laufen, Joggen, Rad, Spinning, Rudern, Gehen, Wandern, Schwimmen, Crosstrainer, Stepper, Seilspringen, HIIT, Crossfit.
- **Automatische Kalorienschätzung** (MET-basiert, nach Körpergewicht und Intensität).
- **Tempo-Anzeige** (min/km und km/h) bei distanzbasierten Sportarten, live beim Eingeben.
- **Optional Puls** erfassbar; Distanzfeld erscheint nur bei sinnvollen Sportarten.
- **Wochenübersicht** im Cardio-Tab: Minuten, verbrannte kcal und Distanz der letzten 7 Tage, plus voller Verlauf.
- Moderates/hartes Cardio fließt weiterhin in die Erholungs-Anzeige ein (beeinflusst die Kraft-Empfehlung am Folgetag).
- Cardio aus dem Verlauf-Reiter entfernt – lebt jetzt sinnvoll unter Training.

## Home & Verlauf neu geordnet (neu)
Klare Trennung: Home = tägliche Übersicht + Eingabe, Verlauf = Auswertung.
- **Home – Schneller Check-in erweitert:** Gewicht, Schlaf, Schritte und Wasser an einem Ort, direkt auf der Startseite. Teil-Eingaben über den Tag verteilt sind möglich, ohne dass vorherige Werte verloren gehen (Bug behoben).
- **Verlauf ist jetzt reine Analyse:** Trend-Charts für Gewicht, Schlaf, Schritte und Wasser (mit Durchschnitten) statt Eingabefeldern. Plus kompakte Check-in-Historie.
- **Körper & Physik als eigener Bereich:** Körpermaße und Fortschrittsfotos sind aus dem Eingabe-Wust herausgelöst. Adaptiv: Profis sehen sie zusätzlich direkt auf der Home, Anfänger bekommen im Verlauf einen erklärenden Hinweis statt Überforderung.

## Lebensmittel-Suche (neu)
Das lange Dropdown ist weg – stattdessen eine schnelle Textsuche.
- **Suchfeld:** Einfach tippen (z.B. „hafer", „reis", „quark") – die Liste filtert live mit. Häufig genutzte Lebensmittel erscheinen oben.
- **Antippen statt scrollen:** Treffer als Liste mit kcal/100g auf einen Blick; ein Tipp wählt aus, dann Menge + Live-Makrovorschau.
- „Ändern" springt zurück zur Suche. Findet man nichts, führt der Weg direkt zu „Schnell" (freie Kalorien) oder „Neu anlegen" (eigenes Lebensmittel).

## Apple Health Import (neu)
Da eine Web-App technisch nicht direkt auf Apple Health zugreifen kann (das erlaubt Apple nur nativen iOS-Apps), läuft die Anbindung über den offiziellen Health-Export – ohne teuren Entwickler-Account.
- **Viele Tage auf einmal:** Apple Health exportiert die komplette Historie. Einmal die „Export.xml" hochladen, und Wochen/Monate an Gewicht, Schritten und Schlaf landen automatisch in den Check-ins.
- **Im Browser geparst:** Die (oft große) Datei wird lokal im Browser ausgewertet – nur die kompakten Tageswerte gehen an den Server. Das schont Upload und Datenbank (nur 1 Wert pro Tag und Kennzahl).
- **Keine Überschreibung:** Manuell eingetragene Werte bleiben erhalten; der Import füllt nur leere Felder (optional per overwrite erzwingbar).
- **Schritt-für-Schritt-Anleitung** direkt in der App (Health → Profil → „Alle Gesundheitsdaten exportieren").
- **Wöchentliche Erinnerung (opt-in):** Häkchen setzen, und die Startseite weist freundlich darauf hin, wenn länger nichts importiert wurde.
- Wer kein Apple Health nutzt, trägt alles wie gewohnt auf der Startseite ein.

## Gesundheitsdaten-Integrationen (überarbeitet)
Statt des riesigen Apple-Voll-Exports gibt es jetzt einen schlanken Integrations-Hub (Verlauf → „Gesundheitsdaten verbinden").
- **Apple Health über Kurzbefehl (aktiv):** Einmal einen iOS-Kurzbefehl einrichten, der Gewicht/Schritte/Schlaf der letzten Tage als kompakten Text liefert. Diesen einfügen (oder als kleine JSON-Datei hochladen) – fertig. Nur Kilobyte statt Gigabyte, kein Entpacken, kein Speichermüll. Ausführliche Anleitung in HEALTH-IMPORT.md.
- **Text-Einfügen ODER Datei:** Beide Wege; der Parser akzeptiert JSON (mit/ohne `days`-Wrapper) und sogar einfache Zeilenlisten (Datum, Gewicht, Schritte, Schlaf) inkl. deutscher Dezimalkommas.
- **Alter XML-Voll-Export bleibt als Fallback** für alle, die ihn schon haben.
- **Mehrere Anbieter vorbereitet:** Google Fit / Health Connect, Fitbit und Garmin sind in der Oberfläche bereits als „kommt bald" angelegt (noch ohne Funktion), damit die Bedienung später gleich bleibt.
- Manueller Import bleibt nicht-überschreibend (nur leere Felder werden gefüllt) und die wöchentliche Erinnerung (opt-in) bleibt erhalten.

## Statistik, Diagramm, Technik & Übungs-Buttons (neu)
- **Ziel-Bug behoben:** Die Fortschritts-Bewertung nutzt jetzt eindeutig dein aktuelles Ziel. „Abnehmen" + abgenommen zeigt korrekt „verloren 🔥" (grün) statt „Richtung stimmt nicht".
- **Gewichtsdiagramm mit Achsen:** Neue datums-basierte Kurve mit beschrifteter x-Achse (Datum TT.MM) und y-Achse (kg). Ausgelassene Tage werden zeitlich korrekt dargestellt und verzerren die Skala nicht mehr.
- **Technik-Feld: Dropdown + Freitext:** Beim Bearbeiten einer Übung lässt sich eine Technik aus der Liste wählen ODER frei eintippen. „📖 Erklärung" zeigt die Bedeutung der gewählten Technik.
- **Übungs-Buttons aufgeräumt:** Pro Übung nur noch das Übungsspezifische (Ausführung-Video, Notiz) plus ein ⚙️-Zahnrad für Bearbeiten/Löschen. Pause-Timer und Hantelrechner sind als allgemeine Werkzeuge einmal oben im Training statt bei jeder Übung. Der Übungs-Verlauf wandert in den Verlauf-Reiter (folgt).

## Branding: Logo & Schriftarten (neu)
- **Logo** „BE INEVITABLE" prominent auf dem Login/Start-Bildschirm, in einem schwarzen, abgerundeten Panel (passt zum dunklen Logo-Hintergrund). Liegt unter `public/logo.jpg` und wird unter `/logo.jpg` ausgeliefert.
- **Überschriften** in **Bebas Neue**, durchgehend GROSSGESCHRIEBEN (Seitentitel, Tagesart auf Home, Sheet-Titel, Login-Headline).
- **Fließtext** in **Nunito**.
- Schriften werden über Google Fonts geladen (`fonts.googleapis.com`); funktioniert im Browser und auf der Render-Deployment automatisch.

## Analyse stark ausgebaut (vormals „Verlauf")
Der Reiter heißt jetzt **Analyse** und ist in zwei Segmente gegliedert:
- **Körper:** Trend-Diagramme für Gewicht (mit beschrifteten Achsen + Lücken-Logik), Schlaf, Schritte, Wasser; Körpermaße & Fotos; Check-in-Historie; Health-Verbindung.
- **Training:** echte Trainings-Statistiken aus allen geloggten Sätzen.
  - Kennzahlen: Trainingstage, Sätze gesamt, Gesamtvolumen (in Tonnen), Einheiten diese Woche.
  - **Wochen-Volumen-Diagramm** (Gesamtlast pro Woche, datums-basiert).
  - **Übungs-Drilldown:** Liste aller trainierten Übungen mit Trend-Pfeil (Gewicht hoch/runter) und geschätztem 1RM. Antippen öffnet den **Übungs-Verlauf mit zwei Linien** – Gewicht (rot, linke Achse) und Wiederholungen (blau, rechte Achse) über die Zeit, beide Achsen beschriftet, ausgelassene Tage zeitlich korrekt dargestellt.
  - **Volumen nach Muskelgruppe** als Balken.
- **Coach-Sicht:** Der Coach sieht im Athleten-Kontext exakt dieselbe Analyse (Volumen-Trend, Übungsverlauf) und kann den Plan datenbasiert anpassen. Neue Route `GET /api/analytics/:userId` mit Zugriffsschutz.

## Ernährungsplan-System (neu)
Unter Ernährung → Plan gibt es jetzt einen echten, automatisch erstellten Mahlzeitenplan – nicht mehr nur ein Kalorienziel.
- **Automatische Erstellung aus dem Profil:** Aus Geschlecht, Gewicht, Größe, Alter und Ziel wird der Kalorienbedarf berechnet (Mifflin-St-Jeor × Aktivität, Ziel-Anpassung) und daraus ein Plan mit konkreten Mahlzeiten erzeugt – getrennt für Trainings- und Ruhetag. Trifft das kcal-Ziel auf ±1–5 % genau, mit ausreichend Protein.
- **Beim Onboarding:** Neuer Schritt „Was magst du nicht?" – ausgewählte Lebensmittel werden aus dem Plan ausgeschlossen. Der Plan wird direkt nach dem Onboarding erzeugt.
- **Im Plan-Tab:** Mahlzeiten mit Lebensmitteln, Mengen und Makros; Vergleich Plan-kcal vs. Ziel; Buttons „🔄 Neu erstellen" und „🚫 Ausschließen"; jede Mahlzeit per Tipp als gegessen eintragbar.
- **Kuratierter Lebensmittel-Katalog mit Rollen** (Protein/Carb/Fett/Gemüse/Obst, je Mahlzeit geeignet) als Grundlage; Portionen werden aufs Ziel skaliert. Der Plan ist ein Vorschlag – Lebensmittel lassen sich im „Heute"-Tab frei austauschen.
- Neue Routen: `POST /api/mealplan/generate/:userId`, `GET/POST /api/disliked/:userId`. Neue Spalte `users.disliked_foods` (automatische, datenschonende Migration).

## Logo auf der Startseite (neu)
Das BE-INEVITABLE-Logo erscheint jetzt auch oben auf der Home (in schwarzem, abgerundetem Band) – als Wiedererkennungsmerkmal auf jedem Start. Aktualisiertes, höher aufgelöstes Logo unter `public/logo.jpg` (auch auf dem Login).

## E-Mail: Verifizierung, Passwort-Reset & Benachrichtigungen (neu)
Die E-Mail-Adresse beim Login hat jetzt echte Funktion.
- **Verifizierung:** Bei der Registrierung geht eine Bestätigungs-Mail raus (Link 48 Std. gültig). Nicht-blockierend – Login klappt auch ohne Bestätigung, auf der Startseite erscheint ein Hinweis „E-Mail bestätigen" mit „erneut senden".
- **Passwort vergessen:** Link „Passwort vergessen?" auf der Anmeldeseite → E-Mail mit Reset-Link (1 Std. gültig, einmalig). Der Link öffnet ein Formular für ein neues Passwort. Aus Sicherheit verrät die App nie, ob eine Adresse existiert.
- **Benachrichtigungen per E-Mail (optional):** In „Mehr → Profil" aktivierbar. Bei neuer Coach-Nachricht bekommt der Athlet dann zusätzlich eine Mail.
- **Sicherheit:** zufällige Tokens mit Ablauf, einmalig nutzbar; beim Reset werden übrige offene Links entwertet; sanftes Rate-Limit bei „Passwort vergessen".
- **Versand:** über SMTP/Transaktionsmail-Dienst – Zugangsdaten als Umgebungsvariablen (siehe EMAIL-SETUP.md). Ohne Konfiguration loggt der Server die Mails nur (App bleibt voll funktionsfähig). Neue Abhängigkeit `nodemailer` (wird nur geladen, wenn `EMAIL_HOST` gesetzt ist). Neue Tabelle `auth_tokens`, neue Spalten `users.email_verified` / `email_notifications` (automatische, datenschonende Migration).

## Sieben Verbesserungen (UX, Notizen, Coach-Tiefe)
1. **Ausblendbare Hinweise (alle):** JEDE Info-Box bekommt automatisch zwei kleine Buttons – ✕ (schließen) und 🚫 (dauerhaft nicht mehr anzeigen, pro Gerät gemerkt) – über einen globalen Mechanismus (greift auch für künftige Hinweise). Dynamische Fehler-/Erfolgsmeldungen (rot/grün) bleiben bewusst bestehen. Unter „Mehr → Hinweise wieder anzeigen" lässt sich alles zurücksetzen.
2. **Benachrichtigungen unter der Glocke:** Die früheren Hinweis-Karten auf der Startseite (E-Mail bestätigen, Gesundheitsdaten aktualisieren) liegen jetzt im Glocken-Portal. Die Home ist aufgeräumter, der Glocken-Zähler bezieht offene Hinweise mit ein.
3. **Ernährung „Aus Plan übernehmen":** Der Button im „Heute"-Tab springt jetzt direkt zum Plan-Tab mit allen Details. Übernimmt man eine Mahlzeit, erscheint sie in „Heute" als EIN Eintrag (z.B. „Frühstück") mit summierten Nährwerten – nicht mehr als einzelne Zutaten.
4. **Rezept-Filter nach Unverträglichkeiten:** In den Rezepten lassen sich Zutaten ausschließen, die man nicht mag / nicht verträgt. Rezepte mit diesen Zutaten werden ausgeblendet. Die Auswahl ist dieselbe wie beim Onboarding (`disliked_foods`) und jederzeit über den Filter änderbar.
5. **Übungs-Notizen sind allgemein:** Das Feld ist jetzt ein Kommentarfeld für alles („nächstes Mal mehr", „lief super", oder eine Beschwerde). „Als Problem markieren" ist optional (Standard aus) statt alles als Beschwerde zu behandeln.
6. **Coach kann Notizen schreiben:** Pro Übung können Athlet UND Coach kommentieren (z.B. „nächstes Mal 2,5 kg mehr, du schaffst das!"). Notizen zeigen den Autor (Du / Coach) und sind optisch unterscheidbar.
7. **Coach sieht mehr:** Das Athleten-Dashboard hat zusätzliche Schnellzugänge – „Volle Analyse" (Trainings-Auswertung), „Alles ansehen" (kompletter Athleten-Blick) und „📸 Fortschrittsfotos". Fortschrittsfotos sieht ausschließlich der zugewiesene Coach (kein anderer Coach) – serverseitig erzwungen. Notiz: `exercise_notes` bekommt Autor-Spalten (automatische Migration).

## Eingabe-Validierung gegen unrealistische Werte (neu)
Alle Zahlenfelder akzeptieren nur noch realistische Werte – kein negatives Gewicht o.ä.
- **Backend (Absicherung):** Zentraler `clampNum`-Helfer begrenzt jeden eingehenden Wert auf einen sinnvollen Bereich, bevor er gespeichert wird – auch bei direktem API-Zugriff. Bereiche u.a.: Gewicht (gehoben) 0–1000 kg, Wiederholungen 0–1000, Körpergewicht 20–500 kg, Schlaf 0–24 h, Schritte 0–200000, Wasser 0–30 L, Cardio 0–1440 min, Puls 0–250, Größe 50–260 cm, Tage/Woche 1–7, Körperfett 0–80 %, Umfänge 0–300 cm, kcal-Ziele 0–15000, Makros pro Gramm 0–1 g. Optionale Felder behalten bei Teil-Updates ihren Bestandswert.
- **Frontend (Komfort):** Globaler Eingabeschutz – KEIN Zahlenfeld kann negativ werden (Standard-Minimum 0), vorhandene min/max werden eingehalten. Zusätzlich sinnvolle min/max-Attribute an den wichtigsten Feldern.

## Mehrwert-Update: neue Features für Athleten, Coaches & Admins
Keine Schema-Änderung – alles wird aus vorhandenen Daten abgeleitet (null Migrationsrisiko).

**Für Athleten**
- **📊 Wochenrückblick** auf der Startseite: Einheiten & Trainingsvolumen dieser Woche im Vergleich zur Vorwoche (▲/▼ in %).
- **🏅 Erfolge**: 14 Meilenstein-Abzeichen aus echten Daten (erstes Training, 100 Sätze, 10 Tonnen bewegt, 7/30-Tage-Streak, erstes Foto …) – erreichte farbig, offene gesperrt. Route `GET /api/insights/:userId` (auch für den Coach sichtbar).
- **🛒 Einkaufsliste**: Im Ernährungsplan-Tab – aggregiert alle Zutaten des Plans für eine Woche (Trainings-/Ruhetage nach deiner Frequenz), sinnvoll gerundet.

**Für Coaches**
- **🚦 Athleten-Ampel** in der Übersicht: Sektion „Braucht Aufmerksamkeit" mit konkreten Gründen (X Tage kein Check-in / kein Training, offene Beschwerden), nach Dringlichkeit sortiert, antippbar. Route `GET /api/coach/attention`.
- **📢 Rundnachricht**: Eine Nachricht an alle eigenen Athleten (inkl. optionaler E-Mail, wenn der Athlet das aktiviert hat).
- **🤖 KI-Analyse** (optional): Knopf im Athleten-Dashboard – der Server schickt Check-ins, Sätze und offene Beschwerden an die Anthropic-API und liefert eine kompakte Analyse mit Empfehlungen. **Setup:** Umgebungsvariable `ANTHROPIC_API_KEY` setzen (Key von console.anthropic.com, kostenpflichtig nach Nutzung; optional `AI_MODEL`). Ohne Key zeigt die App eine klare Meldung – nichts bricht.

**Für Admins**
- **📈 System-Statistiken** in der Verwaltung: aktive Nutzer (7 Tage), Sätze, Check-ins, Nachrichten gesamt. Route `GET /api/admin/stats`.

## Gamification ausgebaut: Level, Wochenziel & Rekord-Feier
- **⭐ Level-System mit XP:** Alles zahlt ein – Trainingstage (10), Sätze (2), Check-ins (5), Cardio (10), Fotos (15), Maße (10), Ernährungs-Tage (3) und am meisten **neue Rekorde (25 XP)**. Progressive Level-Kurve mit Titeln von „Rookie" über „Athlet", „Beast", „Maschine" bis **„UNAUFHALTBAR"** (Level 50). Level + XP-Balken auf der Startseite und im Erfolge-Sheet.
- **🎯 Wochenziel:** „2/4 Einheiten" mit Punkte-Anzeige auf der Home, gegen die Profil-Frequenz – inkl. **Wochen-Serie** („3 Wochen in Serie 🔥"). Die laufende Woche zählt erst, wenn das Ziel erreicht ist.
- **🎉 Rekord-Feier:** Beim Satz-Speichern erkennt der Server automatisch einen neuen Übungs-Rekord (Vergleich gegen das Bestgewicht aller früheren Tage – der erste Trainingstag feiert nicht) und die App zeigt sofort „🎉 NEUER REKORD: X kg!". Route `/api/logs` liefert dazu `pr` + `prevMax`.
- **24 Erfolge** (vorher 14): neu u.a. Rekord-Meilensteine (1/5/15), „4/12 Wochen Plan erfüllt", 10 Cardio-Einheiten, 100 km Distanz, 7 Tage Ernährung getrackt, Level 5/10. **Gesperrte Erfolge zeigen den Fortschritt** (z.B. „67/100").
- **🏅 Freischaltungs-Hinweis:** Beim nächsten App-Öffnen nach einem neuen Erfolg erscheint eine Feier-Meldung (Stand wird pro Gerät gemerkt).
- Bewusst **kein Athleten-Ranking** – Vergleich demotiviert bei kleiner Gruppe mehr als er nützt. Weiterhin keine Schema-Änderung.

## Große Bugfix- & Ernährungs-Runde
**Behobene Bugs**
- **Eingabefelder:** Die Begrenzung greift jetzt erst beim Verlassen des Feldes (change) statt bei jedem Tastendruck – „26 kg" lässt sich wieder eintippen (vorher sprang es nach „2" sofort auf 20).
- **Verirrte ✕/− neben den Satz-Zeilen:** Der globale Hinweis-Mechanismus fasst Übungskarten nicht mehr an (Mindestlänge 30 Zeichen, `.ex-body`/`.setgrid` ausgenommen).
- **Kalender ≠ Widget:** Ausgelassene Vergangenheitstage verschieben den Rhythmus nicht mehr – Kalender und Heute-Widget zeigen jetzt denselben Tag. Ausgelassene Tage werden als verpasste Ruhetage markiert.

**Home aufgeräumt & nach Priorität sortiert:** „Heute" → „Home"; doppeltes Gewicht entfernt (nur noch in der Fortschritts-Karte); Gewichtsverlauf entfernt (lebt in der Analyse); Recovery-Badge entfernt (ungenutzt); „Schneller Check-in" → „Fast Check-in"; Streak in die Wochen-Karte integriert; Gamification-Karte nach oben.

**Ernährung überarbeitet**
- **Generator trifft das kcal-Ziel jetzt auf ±2,5 %** (vorher fehlten teils ~600 kcal). Globaler Skalierungs- und Auffüll-Pass mit realistischen Portions-Obergrenzen; füllt bei Bedarf zielgerecht auf (Definition mit Volumen statt Öl/Nussmus).
- **Vegetarisch & Vegan:** Im Profil, im Onboarding und im Rezept-Filter wählbar. Der Plan wird strikt fleisch-/tierfrei erzeugt und das Protein-Ziel bestmöglich gehalten.
- **Ziel-gerechte Lebensmittel:** Definition bevorzugt kalorienärmere (sättigende) Optionen, Aufbau darf kaloriendichte nehmen.
- **Klarere Zutaten-Namen:** z.B. „Rinderhack (5% Fett)" statt „Rindfleisch (mager)", „Quinoa (gekocht)".
- **Einkaufsliste mit Stückzahlen:** z.B. „12 Stück ≈ 720 g" bei Eiern.
- **Rezept-Filter als Symbol (⚙️):** kompakter Button öffnet ein Filter-Sheet (Ziel, Mahlzeit, Ernährungsweise, Unverträglichkeiten). **51 Rezepte** (vorher 29), mit deutlich mehr für Definition (8 Mittag, 9 Abend statt je 2) und je ≥9 vegan/≥23 vegetarisch.
