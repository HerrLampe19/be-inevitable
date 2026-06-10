import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const IS_PROD = process.env.NODE_ENV === 'production';
const SECRET = process.env.JWT_SECRET || 'be-inevitable-dev-secret-bitte-aendern';

// Sicherheits-Stopp: im Produktionsbetrieb darf NICHT das Dev-Secret laufen.
if (IS_PROD && SECRET === 'be-inevitable-dev-secret-bitte-aendern') {
  console.error('\n  FEHLER: Im Produktionsbetrieb (NODE_ENV=production) muss JWT_SECRET gesetzt sein.');
  console.error('  Setze eine lange zufällige Zeichenkette als Umgebungsvariable JWT_SECRET und starte neu.\n');
  process.exit(1);
}

// Cookie-Optionen: secure nur bei HTTPS (Produktion), damit es lokal weiter über http läuft.
export const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PROD,
  maxAge: 30 * 864e5,
};

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

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: '30d' });
}

// Middleware: liest Token aus Cookie ODER Authorization-Header
export function auth(req, res, next) {
  const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token ungültig' });
  }
}

export function requireCoach(req, res, next) {
  // Coach ODER Admin (Admin schließt Coach-Fähigkeiten ein)
  if (req.user?.role !== 'coach' && req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Nur für Coaches' });
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Nur für Admins' });
  next();
}
