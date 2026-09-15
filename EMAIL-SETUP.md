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

**Der einfache Weg (seit 2.6.0):** In der App als **Admin** → **Verwaltung**. Der Status-Streifen
oben zeigt zwei Zeilen dazu: **E-Mail-Versand** („fehlt", wenn `EMAIL_HOST` nicht gesetzt ist – mit
dem Zusatz „Bestätigungs- und Reset-Mails gehen nicht raus") und **APP_URL** („fehlt – Links in Mails
zeigen ins Leere"). Im Reiter **Betrieb** darunter, unter *Mailversand*, stehen die beiden Knöpfe
**„Selbsttest"** und **„Testmail an mich"**. Beides ohne Browser-Konsole.

### Selbsttest zuerst (seit 2.9.0)

**Verwaltung → Betrieb → Mailversand → „Selbsttest".** Er baut die Verbindung genau mit deinen
`EMAIL_*`-Variablen auf und meldet in ein bis zwei Sekunden grün oder rot – **er verschickt dabei
keine Mail**. Damit beantwortest du zuerst die einfachere Frage: *Stimmen Host, Port und Passwort
überhaupt?* Erst wenn die steht, sagt die Testmail etwas Neues; sonst wartest du nur auf ein
Postfach, das nie etwas bekommt. Die App gibt denselben Rat („Erst Selbsttest, dann Testmail").

- **Grün** (`{"ok":true,"configured":true,"ms":…}`) → Zugangsdaten stimmen. Ob eine Mail auch
  **ankommt**, beweist erst die Testmail (Zustellung, Absenderfreigabe, Spam).
- **Rot** (`"ok":false,"configured":true`) → die Verbindung kam nicht zustande. Prüf `EMAIL_HOST`,
  `EMAIL_PORT` (465 = SSL, 587 = STARTTLS), `EMAIL_USER`, `EMAIL_PASS`. Die Fehlermeldung des
  Anbieters steht dabei – gekürzt und redigiert.
- **`"configured":false`** → `EMAIL_HOST` ist gar nicht gesetzt: „es gibt keinen Server, mit dem
  sich der Test verbinden könnte". Dann ist Schritt 3 oben noch offen. Diese Antwort kommt **sofort**
  und ohne Verbindungsversuch – sie ist deshalb weder gedrosselt noch steht sie im Protokoll.
  Es gibt hier nichts zu wiederholen: Solange `EMAIL_HOST` fehlt, bleibt die Antwort dieselbe.

Sobald `EMAIL_HOST` gesetzt ist, gilt für den **echten Verbindungsversuch**: Er ist **Admin-only**
(ein Coach bekommt 403) und auf **einen Lauf alle 30 Sekunden** gedrosselt – der zweite Klick
innerhalb der Sperre antwortet `429` mit der Restzeit (nachgemessen:
`{"error":"Bitte 30 Sekunden warten.","retryAfterSec":30}`). Jeder solche Lauf steht als
`mail.check` im **Protokoll** (dort als „SMTP-Selbsttest" lesbar); das Ergebnis des letzten Laufs
zeigt die Zeile *Mailversand* als „Selbsttest grün/rot" mit an.

**Der Weg von Hand**, wenn du lieber die Rohdaten siehst:
1. Als **Admin** eingeloggt `https://DEINE-APP.onrender.com/api/admin/stats` aufrufen →
   muss `"mail":"konfiguriert"` und `"app_url":"gesetzt"` zeigen. Steht dort `"mail":"log-fallback"`,
   fehlt `EMAIL_HOST`; steht dort `"app_url":"FEHLT (Links in Mails zeigen ins Leere!)"`, fehlt
   `APP_URL`. (`/api/version` ist öffentlich und liefert bewusst nur Version und Schema-Zustand.)
2. Selbsttest von Hand (Browser-Konsole, **als Admin**, verschickt nichts):
   `fetch('/api/admin/mailcheck',{method:'POST'}).then(r=>r.json()).then(console.log)`
3. Testmail auslösen (Browser-Konsole, **als Admin** – seit 2.6.0 ist das eine reine
   Betreiber-Funktion, Coaches kommen nicht mehr durch):
   `fetch('/api/admin/testmail',{method:'POST'}).then(r=>r.json()).then(console.log)`
   → Die Antwort sagt dir im Klartext, was Sache ist:
   - `{"ok":true,"configured":true,"sent":true,…}` → versendet, Postfach prüfen (**Spam-Ordner
     mitprüfen!**).
   - `configured:true, sent:false` → SMTP ist gesetzt, der Versand ist aber gescheitert. Die
     Render-Logs nennen den Grund (Zugangsdaten? Port?).
   - `configured:false` → `EMAIL_HOST` fehlt; die Mail wurde nur ins Server-Log geschrieben.

Jede ausgelöste Testmail steht danach als `mail.test` im **Protokoll** (Verwaltung → Protokoll).

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

## Was die App verschickt (sobald konfiguriert)

Genau sechs Mails, mehr gibt es nicht:

| Betreff | Wann |
|---|---|
| **Bestätige deine E-Mail – BE INEVITABLE** | bei der Registrierung (Verifizierungs-Link) |
| **Passwort zurücksetzen – BE INEVITABLE** | wenn jemand „Passwort vergessen" benutzt |
| **Dein Zugang zu BE INEVITABLE** | einmaliger Einladungslink (72 h, einmal gültig): beim Anlegen eines Kontos durch den Betreiber und beim Zurücksetzen eines Passworts durch den Betreiber |
| **Neue Nachricht – BE INEVITABLE** | wenn der Coach schreibt – nur, wenn der Athlet es im Profil aktiviert **und** seine Adresse bestätigt hat |
| **💪 Dein Wochenrückblick – BE INEVITABLE** | sonntags ab 18 Uhr (gleiche Profil-Einstellung; inaktive Wochen = keine Mail) |
| **✅ Testmail – BE INEVITABLE** | nur, wenn der Betreiber sie auslöst |

> **Ohne SMTP gibt es keinen Passwort-Reset.** Der Link wird seit 2.4.0 **nicht mehr ins Log
> geschrieben** – dort steht nur `[email] Mail nicht versandt - SMTP fehlt` mit maskierter Adresse.
> Wer die App ohne Mailversand betreibt, sollte das wissen, bevor jemand sein Passwort vergisst.
> Alles, was einen Nutzer wirklich erreichen soll, läuft über **Push** und das Postfach in der App.
