# E-Mail einrichten (Verifizierung, Passwort-Reset, Benachrichtigungen, Wochenrückblick)

**Kurzantwort auf „Geht das auf Render?": JA, direkt.** Render erlaubt ausgehende
SMTP-Verbindungen auf Port **587** und **465** (nur Port 25 ist gesperrt – den
braucht man nicht). Du musst nichts auslagern – du brauchst nur ein Konto bei
einem Mail-Versanddienst und trägst dessen Zugangsdaten als Umgebungsvariablen ein.
Der gesamte Code (Verifizierungs-Mail, Reset-Mail, Benachrichtigungen, Wochenrückblick)
ist fertig und springt automatisch von „Log-Modus" auf echten Versand um, sobald
die Variablen gesetzt sind.

---

## Empfehlung: Brevo (kostenlos, 300 Mails/Tag, in 10 Minuten fertig)

1. Konto anlegen auf **brevo.com** (ehem. Sendinblue), E-Mail bestätigen.
2. Oben rechts → **SMTP & API** → Reiter **SMTP** → „SMTP-Schlüssel generieren".
   Dort stehen: Server (`smtp-relay.brevo.com`), Port (`587`), Login (deine
   Brevo-Anmelde-Mail) und der generierte Schlüssel (= Passwort).
3. Render-Dashboard → dein Service → **Environment** → diese Variablen anlegen:

   | Variable     | Wert                                              |
   |--------------|---------------------------------------------------|
   | `EMAIL_HOST` | `smtp-relay.brevo.com`                            |
   | `EMAIL_PORT` | `587`                                             |
   | `EMAIL_USER` | deine Brevo-Login-Mail                            |
   | `EMAIL_PASS` | der generierte SMTP-Schlüssel                     |
   | `EMAIL_FROM` | `BE INEVITABLE <deine-bestätigte-absender-mail>`  |
   | `APP_URL`    | `https://DEINE-APP.onrender.com`                  |

   ⚠️ `EMAIL_FROM` muss eine in Brevo **verifizierte Absenderadresse** sein
   (Brevo → Senders & IP → Absender hinzufügen + bestätigen).
   ⚠️ `APP_URL` nicht vergessen – daraus werden die Klick-Links in den Mails gebaut!
4. **Save Changes** → Render startet den Dienst neu.

## Funktioniert es? – In 30 Sekunden prüfen
1. `https://DEINE-APP.onrender.com/api/version` aufrufen →
   muss `"mail":"konfiguriert"` und `"app_url":"gesetzt"` zeigen.
2. Als Coach/Admin eingeloggt diesen Aufruf machen (z.B. per Browser-Konsole):
   `fetch('/api/admin/testmail',{method:'POST'}).then(r=>r.json()).then(console.log)`
   → Antwort sagt dir klar, ob versendet wurde, und die Testmail landet in deinem
   Postfach (Spam-Ordner mitprüfen!).

## Alternative: Gmail (nur zum Testen okay)
`EMAIL_HOST=smtp.gmail.com`, `EMAIL_PORT=587`, `EMAIL_USER=deine@gmail.com`,
`EMAIL_PASS=App-Passwort` (Google-Konto → Sicherheit → 2FA aktivieren →
„App-Passwörter"; das normale Passwort funktioniert NICHT). Nachteil: Tageslimit
und Mails von Gmail-Absendern landen bei fremden Empfängern öfter im Spam –
für echte Nutzer lieber Brevo.

## Später (wenn die App wächst): eigene Domain
Für beste Zustellbarkeit eine eigene Domain bei Brevo verifizieren
(SPF/DKIM-DNS-Einträge, Brevo zeigt sie an) und `EMAIL_FROM` auf
`no-reply@deine-domain.de` stellen. Kein Code-Änderungsbedarf.

## Was die App automatisch verschickt (sobald konfiguriert)
- Bestätigungs-Mail bei Registrierung (Verifizierungs-Link)
- „Passwort vergessen"-Mail mit Reset-Link
- Benachrichtigung bei Coach-Nachricht (wenn der Athlet es im Profil aktiviert hat)
- Wochenrückblick sonntags (gleiche Profil-Einstellung; inaktive Wochen = keine Mail)
