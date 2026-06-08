# E-Mail einrichten (Verifizierung, Passwort-Reset, Benachrichtigungen)

Die App kann E-Mails verschicken: Adress-Bestätigung bei der Registrierung,
Passwort-Zurücksetzen per Link und optionale Benachrichtigungen. Dafür brauchst
du **einen E-Mail-Versanddienst** – das kann eine Web-App technisch nicht selbst.

> Ohne Konfiguration funktioniert die App normal weiter. Statt zu versenden,
> schreibt der Server die Mail samt Link nur ins Log (sichtbar in den Render-Logs).
> So kannst du alles testen, bevor du einen Maildienst anbindest.

## Variante A – SMTP (z. B. Zoho, Gmail, dein Hoster)
Setze auf Render unter **Environment** diese Variablen:

| Variable      | Beispiel                                   |
|---------------|--------------------------------------------|
| `EMAIL_HOST`  | `smtp.zoho.eu` / `smtp.gmail.com`          |
| `EMAIL_PORT`  | `465` (SSL) oder `587` (STARTTLS)          |
| `EMAIL_USER`  | `no-reply@deine-domain.de`                 |
| `EMAIL_PASS`  | dein SMTP- bzw. App-Passwort               |
| `EMAIL_FROM`  | `BE INEVITABLE <no-reply@deine-domain.de>` |
| `APP_URL`     | `https://deine-app.onrender.com`           |

`APP_URL` ist wichtig – daraus werden die Links in den Mails gebaut.

**Gmail-Hinweis:** Mit normalem Passwort geht es nicht. Du brauchst ein
„App-Passwort" (erfordert aktivierte 2-Faktor-Anmeldung im Google-Konto).

## Variante B – Transaktionsmail-Dienst (empfohlen für Zustellbarkeit)
Dienste wie **Resend, Mailgun, SendGrid, Postmark, AWS SES** bieten ebenfalls
SMTP-Zugangsdaten – einfach dieselben Variablen oben mit deren Werten füllen.
Vorteil: bessere Zustellbarkeit (weniger Spam), wenn du zusätzlich deine Domain
verifizierst (SPF/DKIM – Anleitung beim jeweiligen Anbieter).

## Nach dem Einrichten
1. Variablen speichern, App neu deployen/neustarten.
2. Neu registrieren → es kommt eine Bestätigungs-Mail.
3. „Passwort vergessen?" auf der Anmeldeseite testen.

## Was die App genau verschickt
- **Bestätigungs-Mail** bei Registrierung (Link 48 Std. gültig). Nicht-blockierend:
  Login klappt auch ohne Bestätigung, es erscheint nur ein Hinweis.
- **Passwort-Reset** über „Passwort vergessen?" (Link 1 Std. gültig, einmalig).
  Aus Sicherheitsgründen verrät die App nie, ob eine Adresse registriert ist.
- **Benachrichtigung** bei neuer Coach-Nachricht – nur wenn der Athlet das in
  „Mehr → Profil" aktiviert hat.

## Sicherheit
- Tokens sind zufällig (32 Byte), laufen ab und sind nach einmaliger Nutzung ungültig.
- Beim Passwort-Reset werden alle übrigen offenen Reset-Links des Kontos entwertet.
- JWT-Secret muss in Produktion über `JWT_SECRET` gesetzt sein (separat von E-Mail).
