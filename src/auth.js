import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const DEV_SECRET = 'be-inevitable-dev-secret-bitte-aendern';
const SECRET = process.env.JWT_SECRET || DEV_SECRET;

// Sicherheits-Stopp: das Dev-Secret steht im Quellcode – wer es kennt, kann Token fuer JEDES Konto
// (auch Admin) selbst signieren. Der Stopp haengt bewusst NICHT an NODE_ENV: eine auf Render vergessene
// Variable bootete den Server frueher mit dem oeffentlichen Secret (SEC-23, CRITICAL). Lokal ohne
// eigenes Secret arbeiten geht weiter – aber nur ausdruecklich mit ALLOW_DEV_SECRET=1.
if (SECRET === DEV_SECRET && process.env.ALLOW_DEV_SECRET !== '1') {
  console.error('\n  FEHLER: JWT_SECRET ist nicht gesetzt. Ohne eigenes Secret koennte jeder, der den Quellcode kennt, Anmelde-Token faelschen.');
  console.error('  Setze eine lange zufaellige Zeichenkette als Umgebungsvariable JWT_SECRET (z.B. `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`).');
  console.error('  Nur fuer lokale Tests ohne echte Daten: ALLOW_DEV_SECRET=1 setzen.\n');
  process.exit(1);
}
if (SECRET === DEV_SECRET) console.warn('[auth] WARNUNG: Dev-Secret aktiv (ALLOW_DEV_SECRET=1) – nur fuer lokale Tests, nie mit echten Daten.');

// Laeuft diese Anfrage ueber HTTPS? Hinter dem Hosting-Proxy (Render) steht das in X-Forwarded-Proto;
// 'trust proxy' ist gesetzt, deshalb spiegelt req.secure das bereits – der Header ist die Gegenprobe.
export function isHttps(req) {
  if (req?.secure) return true;
  const xfp = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return xfp === 'https';
}

// Cookie-Optionen. `secure` haengt nicht allein an NODE_ENV: wird HTTPS an der Anfrage erkannt
// (req.secure / X-Forwarded-Proto), bekommt das Cookie das Flag auch ohne die Variable – eine vergessene
// NODE_ENV darf das Sitzungs-Cookie nicht ueber Klartext abgreifbar machen. Lokal ueber http bleibt es aus.
export const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PROD,
  maxAge: 30 * 864e5,
};
export function cookieOptsFor(req) {
  return { ...cookieOpts, secure: IS_PROD || isHttps(req) };
}

// Passwort-Hashing. Versucht bcryptjs, sonst scrypt (eingebaut in Node).
let bcrypt = null;
try { bcrypt = (await import('bcryptjs')).default; } catch { /* Fallback unten */ }

export function hashPassword(pw) {
  if (bcrypt) return 'bcrypt$' + bcrypt.hashSync(pw, 10);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

export function verifyPassword(pw, stored) {
  if (stored.startsWith('bcrypt$')) {
    if (!bcrypt) return false;
    return bcrypt.compareSync(pw, stored.slice(7));
  }
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    const test = crypto.scryptSync(pw, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  }
  return false;
}

// Vergleichs-Hash fuer UNBEKANNTE E-Mails beim Login. Ohne ihn antwortete der Server bei fremder Adresse
// in ~2 ms (kein bcrypt), bei bekannter in ~70 ms – an der Antwortzeit liess sich ablesen, ob ein Konto
// existiert (SEC-23). Der Login vergleicht deshalb IMMER, notfalls gegen diesen zufaelligen Hash, der zu
// keinem Passwort passt. Einmal beim Start berechnet (gleiche Kostenklasse wie echte Konten).
export const DUMMY_HASH = hashPassword(crypto.randomBytes(24).toString('base64url'));

// ---- Passwortregeln (nur fuer NEUE und GEAENDERTE Passwoerter; bestehende Logins bleiben unberuehrt) ----
// Mindestens 8 Zeichen und nicht in der Liste der haeufigsten Passwoerter (eingebettet, kein Netz,
// keine Zeichenklassen-Pflicht – die UX-Linse will keine Sonderzeichen-Zwaenge). Liefert null, wenn das
// Passwort in Ordnung ist, sonst einen freundlichen Grund fuer die Oberflaeche.
const COMMON_PASSWORDS = new Set(`123456 123456789 12345678 1234567 1234567890 12345678910 123123 123321 1234 12345 111111 000000 121212 112233 123123123 11111111 00000000 987654321 654321 666666 777777 888888 999999 555555 222222 333333 444444 1q2w3e4r 1q2w3e 1qaz2wsx qwerty qwertz qwerty123 qwertz123 qwerty1 qwertyuiop qwertzuiop asdfgh asdfghjkl asdf1234 zxcvbnm yxcvbnm abc123 abcd1234 abcdef abcdefg abcdefgh abc12345 a1b2c3d4 1234abcd
password password1 password123 passwort passwort1 passwort123 passw0rd p@ssw0rd pa$$w0rd pass1234 password1234 kennwort geheim geheim123 secret admin admin123 administrator root toor letmein welcome welcome1 login master hello hallo hallo123 hallo1234 test test123 test1234 testtest demo demo123 guest user user123 changeme default access
iloveyou ichliebedich liebe schatz sunshine princess dragon monkey football baseball basketball soccer fussball fußball hockey superman batman pokemon starwars ninja shadow trustno1 charlie michael jennifer jessica daniel thomas andreas stefan michelle ashley matthew jordan hunter killer george harley ranger buster thunder robert tigger nicole justin taylor jasmine amanda nicholas joshua andrew anthony william
fitness training bodybuilding gym gym1234 muskel muskeln protein power power123 strong stronger champion champion1 winner beast beastmode alpha alpha123 coach coach123 athlet athlet123 athlete sport sport123 sports fit fit1234 fitness1 fitness123 workout workout1 workout123 gains gainz inevitable beinevitable
sommer sommer2024 sommer2025 sommer2026 winter winter2025 winter2026 fruehling herbst berlin hamburg muenchen wien zuerich schweiz deutschland oesterreich austria germany
1q2w3e4r5t 1qazxsw2 qazwsx zaq12wsx q1w2e3r4 q1w2e3r4t5 asdasd asdasd123 qweqwe qwe123 qweasd asdfasdf zxcvbn zxcvbnm123 mnbvcxz 159753 147258 147258369 963852741 1029384756 102030 1122334455 123qwe 123abc 12qwaszx 1qaz2wsx3edc
computer internet samsung google facebook youtube instagram whatsapp iphone android windows linux apple nokia
monkey1 dragon1 shadow1 master1 killer1 summer summer2025 spring autumn winter1 flower flowers freedom whatever cheese chocolate cookie pepper ginger banana orange purple yellow silver golden diamond
love love123 lovely loveme loveyou family mother father mama papa baby babygirl angel angel1 angels heaven jesus jesus1 god blessed
soccer1 football1 baseball1 hockey1 tennis golf golf1 boxing runner running marathon triathlon cycling ironman
maverick mustang corvette ferrari porsche mercedes audi bmw bmw1234 vw golf4 toyota honda yamaha harley1
pussy fuckyou fuck asshole bitch sexy sexy123 sex sex123 sexsex
1111 2222 3333 4444 5555 6666 7777 8888 9999 0000 1212 1313 2000 2001 2002 2003 2004 2005 2006 2007 2008 2009 2010 2011 2012 2013 2014 2015 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025 2026
aaaaaaaa 11111111a a123456 a12345678 abc123456 abcd123456 asd123456 qwe123456 123456a 123456ab 12345678a 123456789a 123456789q 1234567890a 987654321a`.split(/\s+/).filter(Boolean));

export function passwordProblem(pw) {
  if (typeof pw !== 'string') return 'Bitte ein Passwort eingeben';
  if (pw.length < 8) return 'Das Passwort braucht mindestens 8 Zeichen';
  if (pw.length > 200) return 'Das Passwort ist zu lang (max. 200 Zeichen)';
  const norm = pw.trim().toLowerCase();
  // Anhaengsel wie "passwort!" oder "123456." helfen nicht: Ziffern-/Satzzeichen-Rand abschneiden und
  // gegen die Liste pruefen – beides sind Standard-Mutationen jeder Woerterliste.
  const core = norm.replace(/^[\W_]+|[\W_]+$/g, '');
  if (COMMON_PASSWORDS.has(norm) || COMMON_PASSWORDS.has(core)) return 'Dieses Passwort ist zu bekannt – bitte ein anderes wählen';
  if (/^(.)\1+$/.test(norm)) return 'Bitte nicht nur ein Zeichen wiederholen';
  return null;
}

export function signToken(user) {
  // tv = token_version: aendert sich bei Passwortwechsel/Reset/"alle Geraete abmelden" und macht damit
  // alle aelteren Token dieses Kontos ungueltig (siehe auth()). Alte Token ohne tv zaehlen als 0.
  return jwt.sign({ id: user.id, role: user.role, name: user.name, tv: Number(user.token_version) || 0 }, SECRET, { expiresIn: '30d' });
}

// Middleware: liest Token aus Cookie ODER Authorization-Header
export function auth(req, res, next) {
  const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  let payload;
  try { payload = jwt.verify(token, SECRET); }
  catch { return res.status(401).json({ error: 'Token ungültig' }); }
  // Rolle/Existenz IMMER frisch aus der DB: Rollenwechsel, Coach-Neuzuordnung oder Löschung
  // wirken sofort – nicht erst nach Ablauf des 30-Tage-Tokens.
  let u;
  try { u = db.get('SELECT id, role, coach_id, token_version FROM users WHERE id=?', [payload.id]); }
  catch (e) {
    // Fehlt die Spalte (Migration uebersprungen, /api/selftest meldet es), darf deshalb nicht jede
    // Anmeldung scheitern: dann ohne Widerruf weiterarbeiten wie vor dem Update.
    u = db.get('SELECT id, role, coach_id, 0 AS token_version FROM users WHERE id=?', [payload.id]);
  }
  if (!u) return res.status(401).json({ error: 'Konto nicht gefunden – bitte neu anmelden' });
  // Sitzungs-Widerruf: passt die Token-Generation nicht mehr zur DB, ist die Sitzung beendet (Passwort
  // geaendert/zurueckgesetzt oder "auf allen Geraeten abmelden"). Bestandskonten: Spalte 0, Token ohne
  // tv = 0 -> bleiben nach dem Update angemeldet.
  if ((Number(payload.tv) || 0) !== (Number(u.token_version) || 0)) return res.status(401).json({ error: 'Bitte neu anmelden' });
  // `method` gehoert zur ANFRAGE, nicht zum Konto – es steht hier trotzdem, weil canAccessPersonal()
  // in server.js an 62 Stellen nur `req.user` gereicht bekommt und fuer die Hilfe-Freigabe wissen muss,
  // ob gerade gelesen oder geschrieben wird (B3: „nur lesend" war eine Zusage, die der Code nicht hielt).
  // req.user wird je Anfrage NEU gebaut – der Wert kann deshalb nicht zwischen zwei parallelen
  // Anfragen verrutschen, anders als eine Modulvariable (siehe CURRENT_ROUTE in server.js).
  req.user = { id: u.id, role: u.role, coach_id: u.coach_id, name: payload.name, method: req.method };
  next();
}

// 2.6.0 (Welle A-II, „Recht & Rollen"): NUR Coach. Bis 2.5.0 schloss diese Schranke den Admin mit ein
// („Admin schliesst Coach-Faehigkeiten ein") – damit war der Betreiber automatisch Coach JEDES Athleten
// und sah ueber /api/dashboard, /api/flagged-notes, /api/messages & Co. dessen Gesundheitsdaten,
// Beschwerdetexte und Nachrichten. Marcos Auftrag lautet anders: der Admin ueberwacht und stellt ein,
// er coacht nicht. Betriebs-Routen haengen an requireAdmin, nicht hier.
// Braucht ein Betreiber wirklich Einblick, gibt ihn der Athlet zeitlich begrenzt frei
// (POST /api/support/grant, siehe canAccessPersonal in server.js) – und jeder Zugriff wird protokolliert.
export function requireCoach(req, res, next) {
  if (req.user?.role !== 'coach')
    return res.status(403).json({ error: 'Nur für Coaches. Als Betreiber siehst du Betrieb und Protokoll, keine Coaching-Inhalte.' });
  next();
}

// Stammdaten und Betriebsangaben OHNE Personenbezug: Coach und Betreiber.
// `requireCoach` ohne Admin ist fuer Coaching-INHALTE richtig (siehe oben) – an zwei Stellen nahm sie
// dem Betreiber aber etwas weg, das ihn nichts ueber einen Menschen verraet: den Supplement-Katalog
// (eine Liste von Praeparaten, keine Personendaten) und /api/ai/status (ob ein Schluessel gesetzt ist –
// eine Betriebsangabe, also genau sein Zustaendigkeitsbereich). BUILD-A2 Punkt 1 haelt diesen Weg
// ausdruecklich offen: „canAccess() bleibt fuer Stammdaten".
// NICHT fuer Routen benutzen, die Daten eines Athleten liefern – dort gilt canAccessPersonal.
export function requireCoachOrAdmin(req, res, next) {
  if (req.user?.role !== 'coach' && req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Nur für Coaches und den Betreiber.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Nur für Admins' });
  next();
}
