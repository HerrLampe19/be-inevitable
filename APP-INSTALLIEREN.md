# BE INEVITABLE als App nutzen (iPhone & Android)

BE INEVITABLE ist eine **Web-App (PWA)**: Sie läuft im Browser **und** lässt sich mit
einem Tipp wie eine echte App auf den Home-Bildschirm legen – ohne App Store, ohne Kosten.
Web und App teilen sich dasselbe Konto und dieselben Daten; du kannst jederzeit beides nutzen.

## iPhone / iPad (Safari)
> Wichtig: Das geht **nur in Safari**, nicht in Chrome oder Firefox auf dem iPhone.

1. Die App-Adresse in **Safari** öffnen (`https://DEINE-APP.onrender.com`).
2. Unten auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben ↑).
3. Im Menü nach unten scrollen → **„Zum Home-Bildschirm"**.
4. Oben rechts **„Hinzufügen"**. Fertig – das BE-INEVITABLE-Icon liegt jetzt auf dem Home-Bildschirm.
5. Ab jetzt die App über dieses Icon starten: Vollbild, ohne Browser-Leiste, wie eine native App.

Beim Öffnen im Safari zeigt die App selbst einen kurzen Hinweis dazu an (einmalig, schließbar).

## Android (Chrome)
1. Die Adresse in **Chrome** öffnen.
2. Chrome bietet meist automatisch **„App installieren"** an (Banner oder Menü ⋮ → „App installieren / Zum Startbildschirm hinzufügen").
3. Bestätigen – Icon liegt auf dem Startbildschirm.

## Was die installierte App kann
- **Vollbild** mit eigenem App-Icon, getrennt vom Browser.
- **Push-Benachrichtigungen** (Trainings-Erinnerung, Coach-Nachrichten). Auf dem iPhone gehen
  Push erst, **nachdem** die App zum Home-Bildschirm hinzugefügt wurde – dann im Profil aktivieren.
- Funktioniert offline-tolerant für bereits geladene Inhalte (Daten brauchen Internet).

## Apple Health
Die direkte Health-Synchronisierung ist Apple-bedingt **nur in einer echten nativen App** möglich,
nicht in der Web-/PWA-Version. Solange überträgst du Health-Daten bequem per **Kurzbefehl**
(siehe HEALTH-IMPORT.md). Eine native App (mit echtem HealthKit-Zugriff) ist als späterer Ausbau
vorgesehen – der Server-Endpoint dafür (`/api/health-import`) ist bereits vorhanden.

## Updates
Es gibt nichts zu aktualisieren: Bei jedem Öffnen lädt die App automatisch die neueste Version
vom Server. Die laufende Versionsnummer steht unten im Login-Screen und im Profil.
