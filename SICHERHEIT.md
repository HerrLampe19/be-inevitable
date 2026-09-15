# Sicherheit und Datenschutz – für den Betreiber

Diese App verarbeitet **Gesundheitsdaten** (Gewicht, Schlaf, Puls, HRV, Körpermaße, Fotos,
Stimmung) und sehr persönliche Texte (Mindset). Dieses Dokument sagt dir, was die App dafür tut,
was **du** vor dem Upload tun musst, und was in eine Datenschutzerklärung gehört.

Stand: **3.0.0**. Grundlage ist ein Sicherheits-Audit mit sechs Prüfern, die die App mit echten Konten
gegen einen laufenden Server angegriffen haben – nicht auf dem Papier. Ergebnis vorweg: Die
Trennung zwischen Nutzern hält vollständig. Die Lücken lagen bei Sitzungen, Login-Drosselung,
Konfiguration und Abhängigkeiten – und sind seit 2.4.0 geschlossen. Das **Rollenmodell** kam mit
2.6.0 (Abschnitt 10) und ist seither unverändert gültig; 2.7.0 bis 2.9.0 haben daran nichts gelockert.

> **Was seit 2.6.0 dazugekommen ist und diesen Text berührt:** das Bündeln beim Serverstart und der
> Hüllen-Cache (2.7.0, Abschnitt 5 und 7), die Stände im Gerätespeicher (2.7.0, Abschnitt 5), die
> Laufzeit-Schalter in der Verwaltung (2.9.0, Abschnitt 13) und – **neu in 3.0.0** – die
> **nächtliche Sicherung** (Abschnitt 6 und 9, sie ist datenschutzrechtlich der wichtigste Punkt
> dieser Version) samt vier neuen Tabellen und 19 neuen Routen (Abschnitt 3 und 14). Alles unten ist
> gegen den laufenden Server nachgemessen worden, nicht abgeschrieben.
>
> **Der eine Satz, der sich in 3.0.0 ändert:** Bis 2.9.0 entstand eine vollständige Kopie aller
> Personendaten nur, wenn ein Mensch einen Knopf drückte. Ab 3.0.0 entsteht sie **jede Nacht von
> selbst** und bleibt 14 Tage liegen. Das ist gewollt (ohne Sicherung keine Wiederherstellung,
> Art. 32(1)(c)), es ändert aber, was auf der Platte liegt – und gehört genau deshalb in die
> Datenschutzerklärung. Abschnitt 9 sagt, was in dieser Datei steht.

**Neu in 2.6.0 – das Rollenmodell (Abschnitt 10):** Bis 2.5.0 war der Administrator technisch der
Coach jedes Athleten. Er sah Check-ins, Körpermaße, Fotos, Nachrichten, Beschwerdetexte und
Mindset-Freitexte jedes Menschen im System, und er konnte in fremdem Namen Check-ins, Essen und
Cardio eintragen. **Das ist beendet.** Der Administrator ist Betreiber: Konten, Rollen, Zuordnungen,
Protokoll, Fehler, Jobs, Zahlen – keine Gesundheitsdaten. Braucht er wirklich Einblick, gibt ihn der
Athlet für 30 Minuten frei; jeder Zugriff wird protokolliert und der Athlet bekommt eine Nachricht
(Abschnitt 12).

Gemessen mit `tools/roles.mjs` (Erwartung je Zelle in `tools/ROUTEN-PERSONENBEZUG.md`). Die
Routenzahl wächst mit jeder Version – **die drei Nullen sind das Ergebnis, nicht die Größe der
Tabelle**:

| | 2.5.0 | 2.6.0 | 2.9.0 | 3.0.0 |
|---|---|---|---|---|
| geprüfte Routen × Rollen | 181 × 6 = 1.086 | 181 × 6 = 1.086 | 189 × 6 = 1.134 | 208 × 6 = **1.248** |
| Antworten mit Personendaten **für den Administrator** | 18–20 | **0** | **0** | **0** |
| Antworten mit Personendaten für einen **fremden Coach** | – | 0 | **0** | **0** |
| belegtes Fremdschreiben (Zeile im Namen eines anderen) | 4 | **0** | **0** | **0** |
| offene Aufträge in der Erwartungstabelle | 28 | **0** | **0** | **0** |
| Routen ohne Eintrag in der Erwartungstabelle | – | 0 | **0** | **0** |

Der Lauf meldet Abweichungen, und die sind alle derselbe Fall: Für einen Platzhalter in der
Routenadresse (`mealId`, `photoId`, `cardioId`, `templateId`, `noteId`, `cartId`, `wheelId`,
`challengeId`, `sessionId`, `token`, `entryKey`) steht in der Prüfdatenbank keine echte Zeile, also
antwortet die Route 404 statt 200. **Kein einziger Rechtefehler** ist darunter – das Werkzeug zählt
sie trotzdem, und das soll es auch: eine Abweichung, die man wegdefiniert, sieht man nie wieder.

**Wie viele es sind, sagt nichts über die App, sondern nur darüber, wie voll die Prüfdatenbank ist.**
Nachgemessen am 15.09.2026 gegen denselben Server, nur mit zwei verschiedenen Datenbankkopien:

| Datenbank | Version | Abweichungen | Platzhalter ohne echte Zeile |
|---|---|---|---|
| `scratchpad/rate-engagement.db` | 2.9.0 | 25 | 11 (`mealId`, `photoId`, `cardioId`, `templateId`, `noteId`, `cartId`, `wheelId`, `challengeId`, `sessionId`, `token`, `entryKey`) |
| `tools/reference.db` | 2.9.0 | 11 | 5 (`templateId`, `wheelId`, `sessionId`, `token`, `entryKey`) |
| `scratchpad/rate-engagement.db` | 3.0.0 | 25–26 (zwei Läufe) | dieselben 11 – **19 neue Routen, keine neue Abweichung durch sie** |

Beide Läufe melden dieselben drei Nullen. **`roles` bleibt deshalb als einziges der sieben Werkzeuge
rot** – ein Artefakt der Testdaten, kein Befund am Rechtemodell. Wer die Zahl zitiert, nennt die
Datenbank dazu; ohne sie ist sie wertlos.

Dazu kamen mit 2.9.0 **vier Betriebsrouten**. Sie stehen als Nr 189–192 in
`tools/ROUTEN-PERSONENBEZUG.md` (mit Begründung je Route) – der Lauf meldet deshalb
`routesNotInTable: 0`. Einzeln nachgemessen:

| Route | Coach | Athlet | anonym |
|---|---|---|---|
| `GET /api/admin/ops` | 403 | 403 | 401 |
| `PUT /api/admin/ops` | 403 | 403 | 401 |
| `POST /api/admin/mailcheck` | 403 | 403 | 401 |
| `GET /api/notice` | 200 | 200 | **200 – absichtlich öffentlich** |

`/api/notice` liefert **nur** den Wartungstext (`{"notice":null}`, solange keiner gesetzt ist) und
sonst nichts: kein Zustand, keine Zahl, keine Kennung. Er muss auch ohne Konto lesbar sein – sonst
erführe gerade der nichts vom Wartungsfenster, der wegen einer Wartung nicht hereinkommt.

Damit ist die Erwartungstabelle wieder vollständig: **keine Route ohne Eintrag, kein Eintrag ohne
Route** (`routesNotInTable: 0`, `openTasksFromTable: 0`).

**Mit 3.0.0 kommen 19 Routen dazu.** Sie folgen denselben zwei Prüfungen wie alles andere
(Abschnitt 10) – hier ist, was das je Gruppe heißt, einzeln am laufenden Server nachgemessen:

| Routengruppe | Athlet (er selbst) | sein Coach | Betreiber | anonym |
|---|---|---|---|---|
| **Übungskatalog** `GET /api/exercise-catalog`, `…/duplicates`, `POST`, `DELETE /:id` | 200 – Seed-Liste **plus nur seine eigenen** | 200 – für sein eigenes Konto | 200 – für sein eigenes Konto, **keine fremden Einträge** | **401** |
| **Wochenbericht** `GET /api/weekreport/:userId` | 200, Tonlage „athlet" | 200, Tonlage „coach" | **403 „Kein Zugriff"** | **401** |
| **Adaptive Ziele** `GET /api/targets/:userId`, `…/run`, `…/decide`, `…/mode`, `…/revert` | 200 | 200 | **403** | **401** |
| **Pivot** `POST /api/session-override`, `GET`/`DELETE /:userId` | 200 | 200 | **403** für jedes fremde Konto (nachgemessen mit `user_id: 2`). Für sein **eigenes** Konto darf er es – er ist dort der Athlet | **401** |
| **Plan-Werkzeuge** `POST /api/days/:id/superset`, `POST /api/exercises/:id/replace` | 200 | 200 | **403** | **401** |
| **Sicherung** `GET /api/admin/backups`, `POST …/run`, `POST …/verify`, `PUT …/keep` | **403 „Nur für Admins"** | **403 „Nur für Admins"** | 200 | **401** |

Zwei Punkte, die man leicht übersieht und die deshalb ausdrücklich geprüft wurden:

1. **Der Katalog ist kein Schlupfloch.** Die Abfrage lautet
   `WHERE owner_id IS NULL OR owner_id = <ich>` – Seed-Übungen sieht jeder, eigene Einträge nur ihr
   Besitzer. Ein Übungsname ist harmlos, aber „welche Übungen hat sich dieser Mensch angelegt" ist
   es nicht mehr unbedingt.
2. **Der Betreiber bleibt draußen, auch bei den neuen Routen.** Wochenbericht, Ziele und Pivot hängen
   an `canAccessPersonal()` und antworten ihm für **jedes fremde Konto** mit **403** – gemessen, nicht
   angenommen (`GET /api/weekreport/2`, `GET /api/targets/2`, `POST /api/session-override
   {user_id:2}`, `POST /api/days/:id/superset`, `POST /api/exercises/:id/replace`: alle 403). Was er
   sieht, ist die Liste der Sicherungen – Zeitpunkte, Bytes und Prüfsummen, keine Personendaten.
   Die Erwartungstabelle führt die 19 neuen Routen als Nr 193–211; der Lauf meldet
   `routesNotInTable: 0` und `openTasksFromTable: 0`.

Dazu in 2.6.0: ausdrückliche **Einwilligung** nach Art. 9 DSGVO vor der ersten Gesundheitseingabe
(bei Konten, die es vor dem Update schon gab, einmalig **übernommen** statt eingeholt – Abschnitt 9),
der Athleten-Schalter für die **KI-Auswertung** (Standard aus), ein **Protokoll** (`audit`), ein
redigierter **Fehler-Ringpuffer** (`errors`), der **Zustand der wiederkehrenden Läufe** (`jobs`),
eine **pseudonyme** Nutzerverwaltung und der **Einladungslink** statt eines Startpassworts im Klartext.

**Weiterhin offen** (Abschnitt 9): CSP `'unsafe-inline'`, der Apple-Health-Schlüssel in der URL,
die 7-Tage-Gnadenfrist vor der endgültigen Löschung, die **übernommene Einwilligung der
Bestandskonten** – und die **vollständige Sicherung**, die dem Betreiber weiterhin alles in eine
Datei legt. Der Download dafür mit Passwort, Protokoll und einer Nachricht an jedes betroffene Konto;
die **nächtliche Datei ab 3.0.0 ohne all das** – sie ist unverschlüsselt, liegt 14 Tage auf der
Platte und enthält denselben vollständigen Bestand (Abschnitt 9).

---

## 1. Vor dem Upload: das musst du setzen

Render → Service → **Environment**.

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `JWT_SECRET` | **ja** | Schlüssel, mit dem Anmelde-Cookies signiert werden. Lange Zufallszeichenkette (≥ 32 Zeichen). **Ohne diese Variable startet der Server nicht mehr** – vorher genügte ein vergessenes `NODE_ENV`, und jedes Konto ließ sich mit dem öffentlich bekannten Standardschlüssel fälschen. Nie ändern, solange Nutzer angemeldet bleiben sollen. |
| `DB_PATH` | **ja** | `/var/data/data.db` – die Datenbank auf der persistenten Platte. Ohne sie sind die Daten nach jedem Deploy weg. |
| `NODE_ENV` | **ja** | `production` – schaltet HSTS, Clickjacking-Schutz und `secure`-Cookies scharf. |
| `APP_URL` | **ja** | Öffentliche Adresse, z.B. `https://deine-app.onrender.com`. Steht in Mail-Links und im Apple-Health-Link. |
| `EMAIL_HOST/PORT/USER/PASS/FROM` | empfohlen | Mailversand (Bestätigung, Passwort-Reset, Wochenmail). **Ohne SMTP gibt es keinen Passwort-Reset** – der Link wird seit 2.4.0 nicht mehr ins Log geschrieben. |
| `REGISTER_CODE` | optional | Der Einladungscode. **Seit 2.9.0 entscheidet der Schalter `ops.registration` in der Verwaltung, OB er verlangt wird** (Abschnitt 13) – solange niemand ihn angefasst hat, gilt wie bisher: Variable gesetzt = Code nötig. |
| `SELFTEST_KEY` | optional | Gesetzt: `/api/selftest?key=…` zeigt zusätzlich Zählwerte (Nutzer, Sätze …). Ohne Schlüssel bleibt der Selbsttest öffentlich, aber ohne Zahlen. |
| `ANTHROPIC_API_KEY` | optional | KI-Analyse für Coaches. Wenn gesetzt: Anthropic ist Empfänger von Gesundheitswerten → Datenschutzerklärung und Auftragsverarbeitung (siehe Abschnitt 8). Seit 2.9.0 gibt es dazu einen **Not-Aus ohne Redeploy** (`ops.ai`, Abschnitt 13). |
| `APP_TZ` | optional | Zeitzone (IANA-Name), in der „heute" und alle Push-Uhrzeiten gerechnet werden. Standard `Europe/Berlin`. Sicherheitsrelevant nur mittelbar: Protokoll und Fehlerspeicher stempeln **UTC** (`ts_utc`), die Oberfläche rechnet um. |
| `MINIFY` | optional | `0` liefert JS/CSS unverkleinert aus (Notbremse, DEPLOY-PRUEFEN.md). Ändert nichts an Rechten oder Daten. |
| `BACKUP_DIR` | optional | **Ab 3.0.0 sicherheitsrelevant:** der Ordner, in dem die nächtlichen Sicherungen liegen. Ohne die Variable ist es `backups/` neben der Datenbank, also die persistente Platte. **Jede Datei darin ist ein Vollabzug aller Personendaten** (Abschnitt 9) – zeig die Variable nie auf ein öffentlich erreichbares Verzeichnis und nie auf einen synchronisierten Ordner. Standard `<Ordner von DB_PATH>/backups`. |
| `ALLOW_DEV_SECRET` | **nur lokal** | `1` erlaubt den Start ohne `JWT_SECRET` auf deinem Rechner. **Niemals auf Render setzen.** |
| `EMAIL_DEBUG` | **nur lokal** | `1` schreibt den Mailtext **samt Reset-Links** ins Log. Der Code ignoriert die Variable bei `NODE_ENV=production` – setzen muss man sie trotzdem nie. |

Die vollständige Liste samt Render-Checkliste steht in **DEPLOYMENT.md, Schritt 4 und 6**. Diese
Tabelle hier nennt, was **sicherheitsrelevant** ist; `PORT` und die `COACH_*`-Variablen des
einmaligen Anlegebefehls sind es nicht.

**Was ausdrücklich KEINE Umgebungsvariable ist:** die **VAPID-Schlüssel** für Web-Push. Der Server
erzeugt sie beim ersten Bedarf selbst und legt sie in der Tabelle `settings`
(`vapid_public` / `vapid_private`) ab. Sie liegen damit in der Datenbank – und damit in jeder
Sicherung. Wer eine Sicherung weitergibt, gibt auch sie weiter.

Nach dem Deploy: **`/api/version`** muss die neue Nummer und `"schema":"ok"` zeigen. Sonst
**`/api/selftest`** öffnen – er nennt in Klartext, was fehlt (HTTP 503, solange etwas fehlt), ohne
personenbezogene Daten. Und die Regel aus DEPLOY-PRUEFEN.md: **Jede Auslieferung geänderter Dateien
braucht eine neue Versionsnummer** – die Browser halten versionierte Dateien sonst ein Jahr im Cache.

---

## 2. So ist die Anmeldung geschützt – ohne sie mühsam zu machen

- **Passwörter** liegen nur als bcrypt-Hash (Kostenfaktor 10) in der Datenbank. Mindestens 8 Zeichen,
  keine aus der Liste der häufigsten – nur für neue und geänderte Passwörter; bestehende Anmeldungen
  bleiben unberührt. Keine Zeichenklassen-Regeln; dafür ein „Passwort anzeigen"-Auge und eine Hilfe
  beim Tippen.
- **Sitzung** = signiertes Cookie, `HttpOnly` (kein Zugriff aus JavaScript), `Secure`, `SameSite=Lax`
  (Schutz gegen Cross-Site-Requests), 30 Tage. Der Token steht **nicht** mehr in der Login-Antwort und
  nie im Browser-Speicher.
- **Rolle und Existenz** werden bei **jedem** Aufruf frisch aus der Datenbank gelesen: Rollenentzug,
  Coach-Wechsel und Kontolöschung wirken sofort.
- **Passwortwechsel und Reset entwerten alle anderen Geräte** (`token_version`). Das eigene Gerät
  bleibt angemeldet. Im Profil: **„Alle Geräte abmelden"** – der Weg, einen Eindringling auszusperren.
- **Drosselung** (seit 2.5.0 in drei Stufen, in genau dieser Reihenfolge):
  1. **Harte Grenze je Anschluss, vor dem Passwortvergleich:** 60 Fehlversuche in 15 Minuten von
     derselben IP → 429 mit Restzeit. Das ist die einzige Prüfung vor dem bcrypt-Hash und damit der
     Schutz gegen Rechenzeit-Erschöpfung: Sie antwortet in unter einer Millisekunde statt in 60–70.
     Gemessen: normaler Fehlversuch 58 ms, gesperrter Versuch 1 ms. Ein echtes Studio-WLAN erreicht
     diese Grenze im Alltag nicht.
  2. **Wartezeit je Konto:** ab dem vierten Fehlversuch 1 s, verdoppelnd, höchstens 30 s – IP-unabhängig,
     damit verteiltes Raten nichts bringt (rund zwei Versuche pro Minute gegen ein Konto).
  3. **Sperre je Adresse+Konto (8 Fehlversuche / 15 Minuten) erst NACH dem Vergleich.** Sie trifft
     ausschließlich falsche Passwörter.
  **Das richtige Passwort kommt immer durch** und löscht alle drei Zähler. Bis 2.4.0 stand Stufe 3 vor
  dem Vergleich – gemessen: acht Tippfehler, und der neunte Versuch mit dem RICHTIGEN Passwort bekam
  429 mit 868 Sekunden Restzeit. Wer im gemeinsamen WLAN die Adresse eines Athleten kannte, sperrte
  ihn damit mit acht Aufrufen aus. Das Formular zeigt weiterhin den Countdown.
- **Keine Konto-Ausspähung**: „Passwort vergessen" antwortet immer gleich, und der Login braucht für
  bekannte und unbekannte Adressen gleich lang (vorher war der Unterschied 40-fach).
- **Bewusst nicht gebaut**: Zwei-Faktor, PIN-Sperre der App, E-Mail-Bestätigung als Login-Pflicht.
  Jede davon kostet die Anmeldung mehr, als sie in dieser Konstellation bringt.

---

## 3. Welche Daten es gibt und wer sie sieht

Die Spalte „Betreiber" gilt ab 2.6.0. Sie ist die wichtigste Änderung dieser Version: **überall
„nein"**, wo es um einen Menschen geht. Was dort trotzdem möglich ist, steht in Abschnitt 12
(Hilfe-Freigabe) – zeitlich begrenzt, vom Athleten erteilt, protokolliert.

Sie gilt für die **App**. Daneben kommt der Betreiber ohne Hilfe-Freigabe an alles – über die
**Sicherung** (die letzten beiden Tabellenzeilen, Abschnitt 9). Bis 2.9.0 war das **ein** Weg: der
Download-Knopf, mit Passwort und einer Nachricht an jedes betroffene Konto. **Ab 3.0.0 sind es zwei**,
denn die nächtliche Datei entsteht ohne Knopf und ohne Nachricht. Der Weg wird nicht wegdefiniert –
ohne Sicherung gibt es keine Wiederherstellung –, sondern benannt und laut gemacht.

| Daten | Athlet | zuständiger Coach | Betreiber (Admin) | anonym |
|---|---|---|---|---|
| Konto-Kennung (Pseudonym `A-7F2`), Rolle, Coach-Zuordnung, Aktivitätsklasse, Anlagedatum | ja | Name seiner Athleten | **ja** – das ist seine Arbeitsgrundlage | – |
| E-Mail, Name | ja | Name ja, E-Mail **nur beim Zuordnen** | **nein** – keine Liste mehr; nur die Suche nach einer **exakten** Adresse, und die ist selbst ein Protokoll-Ereignis. Seit der Nachbesserung B3/B4 (2026-09-13) gilt das auch für die Coach-Auswahl beim Zuordnen (`GET /api/admin/coaches`): dort standen bis dahin **Klarnamen**, und wer einen Athleten kurz per `PUT /api/admin/users/:id/role` zum Coach machte, las seinen bürgerlichen Namen. Die Route liefert jetzt `pseudonym`, `role` und `athlete_count`. | – |
| Geburtsdatum, Geschlecht, Größe | ja | **nein** | **nein** | – |
| Gewicht, Schlaf, Schritte, Wasser, Ruhepuls, HRV, aktive kcal | ja | ja | **nein** | – |
| Körpermaße, Fortschrittsfotos, Profilbild | ja | ja | **nein** | – |
| Sätze, Trainingstage, Cardio, Essen, Supplements | ja | ja | **nein** | – |
| Übungsnotizen / Beschwerden | ja | ja (gewollt) | **nein** | – |
| Check-in-Freitexte (Notiz, Trainingsbeschreibung) | ja | **nein** | **nein** | – |
| Mindset: Zahlen (Stimmung, Energie, Dauer, Challenge-Haken) | ja | ja | **nein** | – |
| Mindset: **Freitexte** (Notizen, Abend-Reflexion, Rad-Gefühle, Rad-Maßnahmen, Arbeitsblätter) | ja | **nein** | **nein** | – |
| Nachrichten Coach ↔ Athlet | ja | ja | **nein** | – |
| Datenexport (alle eigenen Tabellen als JSON) | ja | nein | **nein** – seit 2.6.0 auch nicht mehr über eine Hilfe-Freigabe | – |
| Apple-Health-Schlüssel | nur selbst | nein | nein (auch nicht im Export) | – |
| Teilen-Link (Rezept/Übung + Vorname des Teilenden) | – | – | – | **ja, 30 Tage, per Token** |
| **Übungskatalog** (`exercise_catalog`): Seed-Übungen und **eigene** Einträge (Name, Muskel, Gerät, Alias) – ab 3.0.0 | ja: die Seed-Liste **und nur seine eigenen** (`owner_id IS NULL OR owner_id = ich`, nachgemessen) | dasselbe für sein eigenes Konto – **nicht** die eigenen Einträge seiner Athleten | dasselbe für sein eigenes Konto | **nein** – die Route verlangt einen Login (401) |
| **Zielverlauf** (`target_history`): jede Kalorien-/Makro-Änderung mit Begründungssatz, Quelle und wer freigegeben hat – ab 3.0.0 | ja | ja | **nein** (`GET /api/targets/:id` → **403**, nachgemessen) | – |
| **Tagesänderung** (`session_override`): „Heute geändert: … – weil …", mit Urheber – ab 3.0.0 | ja | ja | **nein** (403, nachgemessen) | – |
| **Wochenbericht** (`GET /api/weekreport/:id`): Compliance, PRs, Beschwerden, Gewichts-Delta – ab 3.0.0 | ja (Tonlage „athlet") | ja (Tonlage „coach") | **nein** (403, nachgemessen) | – |
| **Liste der Sicherungen** (`backups`): Zeitpunkt, Bytes, SHA-256, Ergebnis der Probe – ab 3.0.0. **Keine Personendaten, nur Betriebszahlen.** | – | – | **ja** – das ist Betriebsaufsicht | – |
| **Vollständige Sicherung der Datenbank** (`POST /api/admin/backup`) | – | – | **ja** – der eine Weg an alles, ohne Hilfe-Freigabe. Zweiter Faktor Passwort, Protokolleintrag, **Nachricht + Push an jedes betroffene Konto**, Abschnitt 9 | – |
| **Nächtliche Sicherungsdatei** (`/var/data/backups/*.db`, ab 3.0.0) | – | – | **ja, ohne jeden Handgriff** – sie entsteht von selbst und liegt 14 Tage auf der Platte. Inhalt: **dasselbe wie oben, also alles.** Kein Passwort, keine Nachricht an die Konten. Abschnitt 9. | – |

**Wer schreibt was.** Selbstauskünfte schreibt nur der Mensch selbst: Check-in, Körpermaße,
Ernährungs- und Cardio-Protokoll, Fortschrittsfotos, Apple-Health-Import und die Mindset-Eintragungen.
Der Coach hat eigene Kanäle, die als seine erkennbar bleiben: die **Coach-Notiz** am Check-in, die
**Übungsnotiz** (`author_role='coach'`), die **Nachricht**, den **Trainingsplan**, den
**Mahlzeitenplan**, **Vorlagen**, **Supplements** und die **Monatsziele**. Bis 2.5.0 konnte er (und
der Admin) im Namen des Athleten Check-ins, Essen, Cardio und Fotos anlegen – von einer echten
Eingabe hinterher nicht zu unterscheiden. Seit 2.6.0 antworten diese Wege mit **403** und einem Satz,
der auf den richtigen Kanal zeigt.

Ein Coach sieht nur **seine** Athleten. Übernimmt ein Coach einen Athleten ohne Coach (nur mit dessen
E-Mail), bekommt der Athlet eine Nachricht, wer ihn ab jetzt betreut und was er sieht.

---

## 4. Wohin Daten die App verlassen

| Empfänger | Was | Wann |
|---|---|---|
| Dein Mail-Provider (SMTP) | Adresse, Name, Bestätigungs-/Reset-Link, Coach-Nachricht (200 Zeichen), Wochenmail mit Trainingszahlen, Gewichtsdelta, Ø Schlaf | nur an **bestätigte** Adressen |
| Apple / Google Push | Push-Endpunkt; der Inhalt ist **verschlüsselt** (aes128gcm), der Push-Dienst kann ihn nicht lesen | wenn Push aktiviert |
| Open Food Facts | Barcode + IP-Adresse, keine Cookies. Dazu die **Produktbilder**, die der Browser direkt von dort holt (`img-src https://*.openfoodfacts.org`). | nur beim Barcode-Scan bzw. wenn ein Produktbild angezeigt wird, direkt aus dem Browser |
| unpkg.com (Cloudflare) | IP + Herkunft beim Laden der Barcode-Bibliothek (festgepinnte Version mit Prüfsumme) | nur beim Öffnen des Scanners |
| Anthropic | Ziel, Erfahrung, Trainingstage/Woche, 14 Tage Check-in-Werte, die letzten 90 Sätze, Anzahl und Daten offener Beschwerden – **ohne Klarnamen, ohne Freitexte** | nur wenn `ANTHROPIC_API_KEY` gesetzt **und** der Athlet den Schalter „KI-Analyse durch meinen Coach erlauben" gesetzt hat (`users.ai_consent`, **Standard aus**) **und** der Coach klickt. Ohne den Schalter antwortet die Route 403 mit Klartext für den Coach. Nach **jeder** Auswertung bekommt der Athlet eine Systemnachricht, die genau diese Aufzählung enthält, und im Protokoll steht eine Zeile `ai.summary`. Anthropic ist **Auftragsverarbeiter** und gehört namentlich in die Datenschutzerklärung. |
| Render-Log | Startmeldungen, Fehlerstacks **ohne** Request-Inhalt, Nutzer-IDs bei Mailfehlern. Keine Adressen, keine Links, keine IPs. | laufend |

Google Fonts wird nicht geladen (die Freigabe wurde entfernt).

---

## 5. Was auf dem Gerät liegt

Damit die App ohne Netz startet und im Keller loggt, liegen im Browser-Speicher (`localStorage`):

| Was | Schlüssel | Umfang |
|---|---|---|
| Profil des angemeldeten Kontos | `be_me` | E-Mail, Name, Ziele – **kein** Token |
| Offline-Warteschlange | `be_outbox` | noch nicht gesendete Sätze, Essen, Check-ins, Supplements, Cardio |
| **Lese-Schnappschüsse** (ab 2.7.0) | `be_snap_v1_<Konto>_<Pfad>` | **jede gelesene API-Antwort**: Startseiten-Zahlen, Check-ins, Sätze, Essensprotokoll, Maße, Bereitschaft, Wochenrückblick, Mindset-Tag. Höchstens **40 Einträge** über alle Konten des Geräts, je Eintrag höchstens 64 KB, Verfall nach **30 Tagen**. |

**Das ist mehr als vor 2.7.0, und es gehört benannt:** Vorher lagen nur Profil, Plan und Tagesvorschau
auf dem Gerät. Heute liegen dort Gesundheitswerte – deshalb steht in Abschnitt 8 Punkt 6 die
Gerätespeicherung als eigener Punkt der Datenschutzerklärung.

**Was ausdrücklich NICHT abgelegt wird:** `/me`, `/version`, `/register-info`, `/selftest`, `/login`,
`/register`, **Fotos** (`/photos/…`), Profilbilder, **Push-Schlüssel**, alle **KI**-Antworten, alle
**`/admin`**-Antworten, Hilfe-Freigaben, Teilen-Links und Einladungen. Und: Beim Blick eines Coaches
auf einen Athleten wird **gar nichts** abgelegt – Fremddaten haben auf dem Gerät des Coaches nichts
verloren.

Der Service Worker hält nur die Programmhülle (`/`, `/app.js`, `/app.css`, `manifest.json`), nie
Daten: `/api/*` wird von ihm **niemals** gecacht.

**Geteiltes Gerät:** „Abmelden" räumt den Speicher des Kontos komplett auf. Wer unsicher ist, ob ein
fremdes Gerät noch angemeldet ist, benutzt im Profil **„Alle Geräte abmelden"**. Was bewusst bleibt:
ohne Netz lässt sich das Abmelden nicht bestätigen – dann bleibt die Sitzung bis zum nächsten
Netzkontakt bestehen (das Cookie ist ohnehin gültig).

---

## 6. Sicherung, Löschung, Auskunft

- **Sicherung, von Hand:** Verwaltung → „Sicherung herunterladen" (Admin, Passwort nötig, höchstens
  alle 10 Minuten). Das ist eine **konsistente** Kopie (`VACUUM INTO`). Ein `cp` der Datei während des
  Betriebs ist es **nicht** – die Datenbank schreibt in eine Begleitdatei (WAL). Lege die Sicherung
  verschlüsselt ab: sie enthält alle Gesundheitsdaten aller Nutzer.
- **Sicherung, nächtlich (ab 3.0.0):** Um 3 Uhr Ortszeit schreibt der Server dieselbe Art Kopie
  (`VACUUM INTO`) in den Ordner `backups/` **neben der Datenbank**, mit SHA-256 je Datei, und hält
  sie **14 Tage** (`settings.backup_keep_days`, 1–365). Dazu die **Wiederherstellungsprobe**
  (`POST /api/admin/backups/verify`, Stand 3.0.0 ohne Knopf in der Verwaltung): die jüngste
  Sicherung wird in eine Wegwerf-Datei kopiert und dort geprüft
  (`PRAGMA integrity_check`, Tabellen vollständig, Zeilen je Tabelle) – die laufende Datenbank wird
  dabei **nicht** angefasst. Das ist die Antwort auf Art. 32(1)(c) **und** (d): Wiederherstellbarkeit
  *und* ihr regelmäßiger Test. Ablauf, Grenzen und Fallstricke: DEPLOY-PRUEFEN.md.
  **Datenschutzrechtlich heißt das:** ab 3.0.0 liegen bis zu 14 vollständige Abzüge aller
  Personendaten auf der Platte, ohne dass jemand etwas dafür tut. Abschnitt 9 sagt, was drinsteht;
  in der Datenschutzerklärung gehört es unter „Speicherdauer".
- **Löschung:** Jeder Athlet kann sein Konto im Profil selbst löschen (Passwort, zweistufige
  Rückfrage). Admin: Verwaltung – seit 2.5.0 ebenfalls **mit dem eigenen Passwort** als zweitem Faktor,
  wie bei der Sicherung. Beides löscht **vollständig** – auch Nachrichten, Teilen-Links,
  Push-Registrierungen, Mindset-Daten – in einer Transaktion.
- **Auskunft (Art. 15):** Profil → Daten & Verbindungen → „Meine Daten exportieren" liefert alle Tabellen des Nutzers als JSON
  (bei Coach- und Admin-Konten heißt dasselbe Unter-Sheet nur **„Daten"** – nachgemessen; die Zeile
  „Meine Daten exportieren" steht in allen drei Rollen darin)
  (Fotos optional). Nicht enthalten: Nachrichten, die der Nutzer **gesendet** hat (sie gehören zum
  Postfach des Empfängers) – in der Auskunft benennen.
- **Auskunft:** Der Export ist ab 2.6.0 **nur noch für den Kontoinhaber selbst** erreichbar – auch
  ein Administrator kann ihn nicht mehr ziehen (bis 2.5.0 konnte er das; es war der vollständige
  Abzug eines fremden Lebens in einer Datei).
- **Aufbewahrung:** Benutzte und abgelaufene Reset-Token, abgelaufene Teilen-Links und tote
  Push-Endpunkte werden stündlich aufgeräumt. Neu ab 2.6.0, einmal täglich: das **Protokoll**
  (`audit`) nach **365 Tagen**, der **Fehler-Ringpuffer** (`errors`) nach **14 Tagen** oder
  2.000 Zeilen – je nachdem, was zuerst greift. Der Zustand dieses Laufs steht unter
  Verwaltung → Jobs (`retention.prune`). Alles andere bleibt, bis der Nutzer oder Admin löscht.
- **Einwilligung:** `users.consent_health_at` und `consent_version` halten fest, **wann** und zu
  **welcher Fassung** zugestimmt wurde. Ein Widerruf setzt `consent_health_at` zurück; ab dann nimmt
  keine Gesundheitsroute mehr etwas an (HTTP 409 mit Klartext). Bereits gespeicherte Daten werden
  dadurch **nicht** gelöscht – das sagt die Antwort auch ausdrücklich, damit die Oberfläche nichts
  Falsches verspricht. Löschen ist die Kontolöschung, eine eigene Entscheidung.
  **Die Fassung vergibt der Server** (`CONSENT_VERSION` in `src/server.js`), nie der Client: ein
  mitgeschicktes `version`-Feld wird ignoriert. Geprüft wird beides – Zeitpunkt **und** Fassung. Steht
  im Konto eine ältere Fassung, antworten die Gesundheitsrouten mit 409 und
  `{needsConsent:true, reason:'version'}`; die Oberfläche öffnet dieselbe Karte wie beim ersten Mal.
  **Wer `CONSENT_VERSION` hochzählt, zieht drei Dinge mit:** den Text in `public/datenschutz.html`,
  den Text im Konto (`public/js/account.js`) und diese Zeile. Jedes bestehende Konto wird danach
  einmal neu gefragt – das ist der Sinn der Spalte.
  **Diese Routen hängen an der Prüfung:** Check-in, Körpermaße, Ernährungsprotokoll (auch aus Rezept
  und Mahlzeit), Cardio, Fotos, Apple-Health-Import, die Gesundheitsfelder des Profils (`dob`,
  `gender`, `height_cm`, `start_weight`), der Onboarding-Abschluss und alle schreibenden
  Mindset-Routen. **Bewusst frei:** Lesen, Löschen, Zurücksetzen auf den Standard, die
  Mindset-Erinnerungen (`PUT /api/mindset/prefs`), das Beenden einer Challenge und die reinen
  Trainingsdaten (`POST /api/logs` – Sätze und Wiederholungen sind Leistung, keine Gesundheitsangabe).
  Sonst sperrt ein Widerruf jemanden aus seinem eigenen Konto aus, statt ihn zu schützen.

---

## 7. Was du technisch nicht anfassen musst (geprüft und standgehalten)

- Sicherheits-Header: HSTS (1 Jahr), Clickjacking-Schutz, `nosniff`, Referrer-Policy,
  Permissions-Policy, Cross-Origin-Opener/Resource-Policy, `/api/*` immer `private, no-store`.
- Eingaben: alle Zahlen begrenzt, Datumsangaben geprüft, HTML aus Texten entfernt; Regex-DoS
  ausgeschlossen (gemessen mit 1-MB-Eingaben); login-freie Routen nehmen nur kleine Anfragen an.
- Geheimnisse: nur in Umgebungsvariablen, nichts im Code, `data.db` nie im Zip.
- Abhängigkeiten: `npm audit` ohne hohe Advisories (nodemailer 10, SheetJS-Paket statt npm-`xlsx`).

---

## 8. Was in die Datenschutzerklärung gehört (Punkte, nicht Text)

1. Verantwortlicher; Hosting bei Render (Region, Auftragsverarbeitungsvertrag, Log-Aufbewahrung).
2. Kategorien – ausdrücklich **Gesundheitsdaten nach Art. 9 DSGVO** (Gewicht, Schlaf, Puls, HRV,
   Maße, Fotos, Stimmung). Rechtsgrundlage ist die **ausdrückliche Einwilligung** (Art. 9 Abs. 2
   lit. a). Sie wird seit 2.6.0 im Onboarding eingeholt und mit Zeitpunkt und Textfassung gespeichert;
   ohne sie nimmt keine Gesundheitsroute Daten an. Der **Widerruf** (Art. 7 Abs. 3) ist jederzeit im
   Konto möglich und wirkt sofort für die Zukunft.
2a. **KI-Auswertung**: eigene, gesonderte Einwilligung (Standard aus), Empfänger **Anthropic** als
   Auftragsverarbeiter, Zweck und übermittelte Felder wie in Abschnitt 4 aufgezählt.
2b. **Protokoll**: Für den Betrieb wird festgehalten, **wer wann welche Verwaltungshandlung** gemacht
   hat (`audit`, 365 Tage) – nur Kennungen und Handlungsnamen, keine Inhalte; berechtigtes Interesse
   an Nachvollziehbarkeit und Missbrauchserkennung. Dazu ein redigierter Fehlerspeicher (14 Tage).
3. Wer sieht was (Tabelle in Abschnitt 3) und wie die Coach-Zuordnung zustande kommt.
4. Empfänger (Abschnitt 4) – je nach Konfiguration: Mail-Provider, Apple/Google Push, Open Food
   Facts, unpkg, Anthropic.
5. Speicherdauer (Abschnitt 6), Löschung und Auskunft, Widerruf von Push. **Ab 3.0.0 gehört dazu
   ausdrücklich die nächtliche Sicherung:** technisch-organisatorische Maßnahme nach Art. 32(1)(c)(d),
   vollständige Kopie der Datenbank, **auf demselben Server**, Aufbewahrung standardmäßig **14 Tage**,
   danach automatisch gelöscht. Das ist auch der Satz, den eine Löschanfrage braucht: ein gelöschtes
   Konto ist in der App sofort weg, in den Sicherungen der letzten 14 Tage aber noch enthalten – sie
   laufen mit der Frist aus. Wer eine kürzere Frist zusagen will, stellt sie auf einen kleineren Wert
   (`PUT /api/admin/backups/keep`) und schreibt **den** in die Erklärung.
6. Speicherung auf dem Gerät (Abschnitt 5).

---

## 9. Bekannt und bewusst offen

- **CSP `'unsafe-inline'`:** Die Oberfläche nutzt Inline-Handler flächendeckend; jede Ausgabe wird
  deshalb konsequent maskiert (geprüft). Der saubere Umbau auf delegierte Handler ist ein eigenes
  Vorhaben.
- **Apple-Health-Schlüssel in der URL:** Die Kurzbefehle-App kann nur so arbeiten. Der Schlüssel darf
  ausschließlich Gesundheitswerte schreiben, lässt sich jederzeit neu erzeugen, und der Server loggt
  keine URLs.
- **Excel-Import** nur für Coaches; die Bibliothek stammt seit 2.4.0 aus dem reparierten SheetJS-Paket.
- **Keine Gnadenfrist beim Löschen:** Ein gelöschtes Konto ist sofort und endgültig weg (dafür mit
  Passwort als zweitem Faktor). Die 7-Tage-Frist braucht eine eigene Spalte und kommt später.
- **Die vollständige Sicherung ist ein Vollabzug aller Personendaten – und bleibt es.** `POST
  /api/admin/backup` liefert dem Betreiber in einer Datei den kompletten Bestand: Freitexte, Fotos,
  Nachrichteninhalte, Geburtsdaten, E-Mail-Adressen und die Passwort-Hashes aller Konten. Die
  Rollentrennung dieser Version endet an dieser Datei, und sie kann es auch nicht anders: eine App
  ohne Sicherung überlebt keinen Plattenschaden. Was
  der Weg deshalb hat: das **Passwort** als zweiten Faktor (ein gestohlenes Admin-Cookie genügt
  nicht), höchstens **eine Kopie je 10 Minuten**, einen Protokolleintrag `backup.download` in einem
  Protokoll ohne Löschroute, den Zeitstempel `settings.backup_last` – und seit der Nachbesserung von
  B1 **Nachricht + Push an jedes betroffene Konto, bei jeder einzelnen Kopie**. Ein heimlicher
  Vollabzug ist damit nicht mehr möglich, ein offener schon. Die Datei gehört verschlüsselt abgelegt,
  nie in einen synchronisierten Ordner und nie in eine Mail, mit einer festen Löschfrist.
- **Die nächtliche Sicherung ab 3.0.0 ist derselbe Vollabzug – nur ohne Knopf, ohne Passwort und
  ohne Nachricht.** Das gehört so deutlich dagestanden, weil es die einzige Stelle ist, an der 3.0.0
  die Lage gegenüber 2.9.0 verschärft: In `/var/data/backups` liegen ab jetzt **bis zu 14 Dateien**,
  und **jede einzelne enthält alles** – Gesundheitswerte, Körpermaße, Fotos, Nachrichten,
  Mindset-Freitexte, Geburtsdaten, E-Mail-Adressen, Passwort-Hashes, dazu die VAPID-Schlüssel und
  jeden gültigen Apple-Health-Schlüssel. Wer Zugriff auf die Platte hat, hat Zugriff auf alles; wer
  eine dieser Dateien weitergibt, gibt alles weiter. **Der Grund, es trotzdem zu bauen:** ohne
  Sicherung gibt es keine Wiederherstellung, und Art. 32(1)(c)(d) verlangt beides – Fähigkeit *und*
  regelmäßigen Test. Was der Weg hat: die Datei verlässt den Server **nicht** (kein Upload, kein
  fremder Dienst, keine Mail), sie liegt unter demselben Verantwortlichen wie die Datenbank selbst,
  die Aufbewahrung ist begrenzt und einstellbar, und jeder Lauf steht in `backups` und in `jobs`.
  Was der Weg **nicht** hat: eine Verschlüsselung und eine Nachricht an die betroffenen Konten.
  *Offen (Entscheidung Marco):* eine Sicherung **ohne** Personendaten (nur Struktur und Betriebs-
  tabellen) als zweiter Knopf, oder eine Verschlüsselung der Datei durch den Server selbst, damit der
  Klartext die Platte nie verlässt. Beides ist eine eigene Welle wert, keine Nachbesserung – und mit
  der nächtlichen Datei ist es dringender geworden als vorher (`DEFER-B1.md`).
- **Die Einwilligung der Bestandskonten wurde beim Update übernommen, nicht eingeholt.** Der Riegel
  nach Art. 9 (ohne `consent_health_at` nimmt der Server keine Gesundheitsdaten an) trifft jedes
  Konto – auch die, die es vor 2.6.0 schon gab. Gefragt wird aber nur im Onboarding, und das sieht
  nur, wer sich neu registriert. Ein Bestandskonto wäre damit ab dem Update aus seiner eigenen App
  ausgesperrt gewesen: kein Check-in, kein Essen, kein Gewicht, keine Maße, kein Health-Import.
  Gemessen war das kein Papierproblem: `tools/tapcount.mjs` lief gegen dieselbe Datenbankkopie unter
  2.5.0 grün (`/api/foodlog` 200, `/api/checkins` 200) und unter 2.6.0 rot (beide 409).
  Deshalb setzt der **erste** Start mit 2.6.0 einmalig bei allen zu diesem Zeitpunkt vorhandenen
  Konten `consent_health_at` auf das Datum des Updates und `consent_version` auf die geltende Fassung
  (`src/server.js`, `consentBackfillOnce()`, Merker `settings.consent_migrated_2_6_0`). **Das ist
  keine erteilte Einwilligung, und es wird nicht so behandelt:** jede Übernahme steht einzeln als
  `consent.migrated` im Protokoll (`via:'upgrade-2.6.0'`, nur Kennungen), jedes betroffene Konto
  bekommt eine Systemnachricht, die ausdrücklich sagt, dass nicht gefragt wurde, und die den Weg zum
  Ansehen und zum Widerruf nennt. Tragfähig ist der Schritt nur, weil es außer Marcos eigenem Konto
  heute keine Nutzer gibt (DECISIONS-25 F2). Jedes Konto, das **nach** dem Update entsteht, muss
  ausdrücklich zustimmen – nachgewiesen: neu angelegtes Konto → Check-in und Essen 409 mit
  `needsConsent`, nach `POST /api/consent` 200, nach Widerruf wieder 409.
  ***Offen und bei 2.9.0 nachgemessen weiterhin offen*** (`public/js/account.js`,
  `lgOpenConsentSheet()`): Das Sheet „Einwilligung" sagt einem übernommenen Konto
  „Du hast am … eingewilligt". Für ein übernommenes Konto stimmt dieser Satz nicht; er gehört auf
  „beim Update am … übernommen – bitte einmal bestätigen" geändert. Der Server liefert dafür bereits
  die Tatsache im Protokoll (`consent.migrated`). Tragbar ist das nur, weil es außer Marcos eigenem
  Konto keine Bestandsnutzer gibt (DECISIONS-25 F2) – **mit dem ersten echten Bestandskonto wird es
  ein Befund.** Der Auftrag steht in `DEFER-A5.md`.
- **Ein Betreiber kann sich selbst eine Rolle geben.** Wer Administrator ist, kann jede Rolle setzen –
  auch sich selbst zum Coach machen und dann Athleten zugeordnet bekommen. Was er dabei **nicht**
  kann: sich stillschweigend Zugriff verschaffen. Jede Rollenänderung steht mit Zeitpunkt und
  Kennungen im Protokoll (`role.change`, `coach.assign`), und das Protokoll hat keine Löschroute.
- **Ein Administrator, der zugleich Athleten betreut, verliert diesen Zugriff.** `requireCoach` lässt
  seit 2.6.0 nur noch echte Coaches durch. Wer beides sein will, braucht ein zweites Konto mit der
  Rolle `coach` – der geplante „Hut-Wechsel" innerhalb eines Kontos kommt in einer späteren Welle.

---

## 10. Das Rollenmodell (ab 2.6.0)

Im Server gibt es genau **zwei** Zugriffsprüfungen, und der Unterschied ist der ganze Punkt:

| Prüfung | gilt für | Athlet | sein Coach | fremder Coach / fremder Athlet | Betreiber |
|---|---|---|---|---|---|
| `canAccess()` | Stammdaten: id, Rolle, Coach-Zuordnung, Aktivitätsklasse | ja | ja | nein | **ja** |
| `canAccessPersonal()` | alles Personenbezogene: Gesundheit, Körper, Mindset, Fotos, Nachrichten, Freitexte, Trainings- und Ernährungsinhalte | ja | ja | nein | **nein** – nur mit Hilfe-Freigabe |

Dazu drei Riegel, die zusammengehören:

1. **`requireCoach` ohne Admin.** Coach-Routen (Athletenliste, Dashboard, Beschwerden, Vorlagen,
   Import, Nachrichten, KI) sind für den Betreiber geschlossen.
2. **Der Zuständigkeitsbereich eines Admins ist leer.** `coachScopeAthletes()` liefert ihm keine
   Athleten – auch dann nicht, wenn eine künftige Route die Coach-Schranke vergisst.
3. **Kein Fremdschreiben.** Selbstauskünfte (Check-in, Körpermaße, Essen, Cardio, Fotos,
   Health-Import, Mindset) nehmen nur den angemeldeten Menschen als Urheber an.

**Nachprüfen:** `node tools/roles.mjs --base <url> --db <kopie>` probiert jede Route mit jeder Rolle
gegen die Erwartungstabelle `tools/ROUTEN-PERSONENBEZUG.md`. Grün heißt: 0 Abweichungen, 0 Antworten
mit Personendaten für die falsche Rolle, 0 offene Aufträge. Die Voraussetzungen für einen
wiederholbaren Lauf stehen im Kopf der Tabelle.

---

## 11. Protokoll, Fehler und Jobs (Verwaltung → Betrieb)

| Tabelle | Inhalt | Was ausdrücklich **nicht** drinsteht | Aufbewahrung |
|---|---|---|---|
| `audit` | Zeitpunkt, Kennung des Handelnden, seine Rolle, Name der Handlung (`role.change`, `user.create`, `user.delete`, `password.reset` (Coach), `password.reset.link` (Betreiber, mit `mailed`/`shown`), `athlete.profile.set` (Coach setzt Phase/Ziel/Kalorienziele), `backup.download`, `admin.search`, `support.grant`, `support.use`, `support.revoke`, `consent.grant`, `consent.revoke`, `ai.consent.on/off`, `ai.summary`, `invite.accept`, `mail.test`, `job.*`, seit 2.9.0 `ops.set` für jeden umgelegten Laufzeit-Schalter, **seit 3.0.0** `backup.run`, `backup.verify`, `backup.keep` (Sicherung), `session.override` und `session.override.undo` (Pivot: nur Datum und „Ruhetag ja/nein", **nicht** der Begründungstext), `targets.mode`, `targets.accept`, `targets.keep`, `targets.revert` (Zielanpassung: nur Kennungen und die Nummer der Zielzeile, **keine** Kalorienzahl)), Art und Kennung des Ziels, ein kleines JSON mit Zahlen | E-Mail, Name, Freitext, Gesundheitswerte. Auch die **gesuchte Adresse** nicht – nur, dass gesucht wurde und ob es einen Treffer gab. Und seit 2.9.0 auch **nicht der Wartungstext** selbst: von ihm stehen nur Länge und „geleert ja/nein" im Protokoll. | 365 Tage, **keine Löschroute** |
| `errors` | Routen**muster** (`/api/checkins/:id`), Status, Fehlerklasse, redigierter Kurztext, Zähler | E-Mails, Tokens, Dateipfade, eingefügte Werte, Datumsangaben – alles wird **vor** dem Schreiben ersetzt, nicht danach | 14 Tage oder 2.000 Zeilen |
| `jobs` | eine Zeile je wiederkehrendem Lauf: letzter Start, letzter Erfolg, redigierter Fehler, Zustand `up`/`late`/`down` mit Karenz | – | wird überschrieben |
| `support_grants` | Hilfe-Freigaben: wer, wann erteilt, wann ablaufend, wann zurückgezogen, Grund aus fester Auswahl | Freitext | bleiben stehen (Beleg), fallen mit dem Konto |

Die Redaktion ist geprüft: aus `UNIQUE constraint failed: users.email ('marco@…')` wird
`… users.email ('[redigiert]')`, aus einem Pfad `[redigiert]`, aus einem Datum `JJJJ-MM-TT`.

---

## 12. Hilfe-Freigabe statt Rundum-Zugriff

Support muss möglich bleiben – aber nicht als Dauerzugriff.

1. Der **Athlet** öffnet die Tür: Profil → Daten & Verbindungen → **„Einblick für den Betreiber"**
   (der Begriff *Hilfe-Freigabe* steht im Text daneben), ein Grund aus einer festen Auswahl
   (Fehler in der App · Daten stimmen nicht · Anmeldung/Konto · Anderes). Ein leerer Aufruf öffnet
   nichts (HTTP 400) – eine Tür zu Gesundheitsdaten darf sich nicht durch einen Fehlklick öffnen.
2. Sie gilt **30 Minuten** und läuft von selbst ab. Der Athlet kann sie jederzeit sofort beenden.
3. **Jeder** Zugriff des Betreibers darüber schreibt eine Zeile `support.use` ins Protokoll –
   mit Freigabe-Nummer und Routenmuster.
4. Beim **ersten** Zugriff bekommt der Athlet eine Nachricht im Postfach und einen Push.
5. Sie erlaubt **nur Lesen** – und zwar durchgesetzt, nicht bloß zugesagt (B3). Bis zur Nachbesserung
   am 2026-09-13 war mit einer gültigen Freigabe messbar möglich: ein Satz im Namen des Athleten
   (`POST /api/logs`, sogar als persönlicher Rekord gewertet), ein gelöschtes Fortschrittsfoto
   (`DELETE /api/photos/:id`), ein gelöschter Essens- oder Cardio-Eintrag. Die Schranke
   `ownRecordOnly` deckte nur die fünf POST-Routen aus BUILD-A2 Punkt 2 ab und keine einzige
   DELETE-Route. Jetzt entscheidet `canAccessPersonal()` selbst: über eine Freigabe kommen nur
   `GET`/`HEAD` durch, alles andere endet mit HTTP 403 und dem Satz „Die Hilfe-Freigabe erlaubt nur
   Ansehen." Jeder abgewiesene Versuch schreibt `support.denied` (Freigabe-Nummer, Routenmuster,
   Methode) ins Protokoll. Die Methode kommt aus `req.user.method` (gesetzt in `auth()`, src/auth.js)
   und damit aus der Anfrage selbst – **nicht** aus einer Modulvariablen wie `CURRENT_ROUTE`, die bei
   zwei gleichzeitigen Anfragen danebenliegen kann.
6. Es gibt **kein** „als Nutzer anmelden" und keinen Datenexport über diesen Weg.
7. Und **kein Umweg über das Passwort** (B2): Bis 2.5.0 setzte der Betreiber unter
   `POST /api/admin/users/:id/resetpw` ein Passwort seiner Wahl und meldete sich damit als dieser
   Mensch an – Startseite, Nachrichten, Fotos, Check-ins, Export, alles ohne Freigabe. Seit 2.6.0
   vergibt er dort **kein Passwort mehr**, sondern erzeugt denselben einmaligen Link wie bei der
   Kontoanlage (72 h, einmal gültig). Ein mitgeschicktes Passwort wird mit HTTP 400 abgelehnt, nicht
   still verworfen. Das bisherige Passwort bleibt gültig, bis der Link eingelöst wird; ist der
   Mailversand eingerichtet, geht der Link an die hinterlegte Adresse und wird dem Betreiber **nicht
   angezeigt** – dann kann er den Zugang gar nicht übernehmen. Jeder Vorgang schreibt
   `password.reset.link` mit `mailed`/`shown` ins Protokoll, und der Betroffene bekommt sofort eine
   Nachricht. **Offen bleibt der Coach:** `POST /api/athlete/:id/resetpw` vergibt weiterhin ein
   Passwort im Klartext. Das ist eine bewusste Grenze dieser Welle – der Coach sieht die Daten seines
   Athleten ohnehin –, steht aber als Auftrag in `DEFER-A2.md`.

Was bewusst offen bleibt: Der Betreiber sieht während der Freigabe dasselbe wie der Coach. Eine
feinere Abstufung („nur die Check-ins der letzten drei Tage") wäre ein eigener Mechanismus und ist
für eine App mit einem Betreiber und wenigen Athleten mehr Versprechen als Schutz.

---

## 13. Laufzeit-Schalter (ab 2.9.0)

Bis 2.8.0 brauchte jede Betriebsentscheidung einen Redeploy. Seit 2.9.0 liegen drei davon in der
Datenbank (`settings`, Präfix `ops.`) und wirken **sofort, ohne Neustart**. Sie stehen in der
**Verwaltung → Betrieb** und sind ausschließlich für den Administrator erreichbar
(`GET`/`PUT /api/admin/ops`; ein Coach bekommt **403 „Nur für Admins"** – nachgemessen).

| Schalter | Werte | Standard | Wirkung |
|---|---|---|---|
| `ops.registration` | `open` · `code` · `closed` | `open` (DECISIONS F1) | `code`: die Registrierung verlangt den Einladungscode aus `REGISTER_CODE`. `closed`: `POST /api/register` antwortet **403** mit `registrationClosed:true` und einem Satz im Klartext. |
| `ops.ai` | `on` · `off` | `on` | `off` ist der **Not-Aus für den ganzen Betrieb**: keine KI-Auswertung mehr, unabhängig davon, was einzelne Athleten erlaubt haben. |
| `ops.notice` | Freitext, höchstens 200 Zeichen | leer | Ein Wartungshinweis. **Kein** Wartungsmodus, der aussperrt – niemand wird ausgeschlossen, alles bleibt bedienbar. Zur Anzeige siehe die Einschränkung unten. |

> **Einschränkung beim Wartungshinweis (Stand 2.9.0, nachgemessen):** Der Text wird gespeichert, ist
> über `GET /api/notice` **öffentlich** abrufbar und steht auch in `/api/register-info` – aber die
> Athleten-Oberfläche zeichnet ihn noch nicht. Gezeichnet wird er heute nur in der Verwaltung. Der
> Auftrag steht in `DEFER-A5.md` (W1). **Datenschutzrechtlich ist das die harmlose Richtung**: der
> Text wird weniger weit verteilt als vorgesehen, nicht weiter.

Vier Regeln, die zusammen dafür sorgen, dass ein Schalter kein neues Risiko ist:

1. **Fehlt der Eintrag, gilt der Standard.** Eine frische Datenbank verhält sich exakt wie 2.8.0.
2. **Ein unbekannter Wert wird abgelehnt, nicht gebogen.** `PUT` mit einem fremden Wert antwortet
   **400** und nennt die erlaubten (nachgemessen: `{"error":"Erlaubt sind: on, off"}`). Wer von Hand
   etwas in `settings` schreibt, bekommt beim Lesen den Standard zurück – kein halber Zustand.
3. **Jedes Umlegen schreibt eine `audit`-Zeile** (`ops.set`) mit Schlüssel, Vorher und Nachher, und
   die Antwort nennt, **wer** zuletzt gedreht hat – als Pseudonym, nicht als Name.
   **Der Wartungstext selbst steht NICHT im Protokoll**: er ist Freitext, und `audit` nimmt keinen
   Freitext auf. Protokolliert werden seine Länge und ob er geleert wurde.
4. **`REGISTER_CODE` behält Vorrang, bis jemand den Schalter zum ersten Mal anfasst.** Eine
   bestehende Installation mit gesetzter Variable ändert durch das Update ihr Verhalten nicht. Ab dem
   ersten Umlegen gilt der Schalter – das ist sein Zweck.
   **„nur mit Code" lässt sich ohne `REGISTER_CODE` gar nicht erst einstellen:** `PUT` antwortet
   dann **400** (nachgemessen: *„Für ‚nur mit Code' muss die Umgebungsvariable REGISTER_CODE gesetzt
   sein. Ohne Code käme niemand mehr durch – das wäre ‚geschlossen'."*), und der Schalter bleibt
   stehen, wo er stand. Das ist dieselbe Aussage wie in DEPLOYMENT.md 4f.
   Der Rückfall auf **`open`** mit `codeMissing: true` greift deshalb **nur nachträglich**: wenn
   `code` bereits gespeichert ist und die Variable **später aus der Umgebung verschwindet**. Eine Tür
   ohne Schlüssel wäre in Wahrheit zu – die Verwaltung sagt das, statt es zu verschweigen.

**Was es ausdrücklich NICHT gibt:** einen Schalter, der dem Betreiber Personendaten öffnet. Die
Grenzen aus Abschnitt 3 und 10 sind nicht konfigurierbar – weder über `settings` noch über eine
Umgebungsvariable.

Daneben zeigt dieselbe Ansicht den **Zustand der wiederkehrenden Läufe** (`jobs`: letzter Start,
letzter Erfolg, redigierter Fehler, `up`/`late`/`down` mit Karenz) und erlaubt das **Nachholen von
Hand** (z. B. `POST /api/admin/weekly` für den Sonntagslauf). Auch das schreibt eine `job.*`-Zeile
ins Protokoll.
