// Legt einen Coach- oder Admin-Account an. Aufruf:
//   COACH_EMAIL=... COACH_PASSWORD=... COACH_NAME=... COACH_ROLE=admin node src/create-coach.js
// COACH_ROLE ist optional (Standard: coach; erlaubt: coach | admin).
// Sicher & idempotent: existiert die E-Mail schon, passiert nichts.
import { db } from './db.js';
import { initSchema } from './schema.js';
import { hashPassword } from './auth.js';

initSchema();

const email = (process.env.COACH_EMAIL || '').toLowerCase().trim();
const password = process.env.COACH_PASSWORD || '';
const name = (process.env.COACH_NAME || 'Coach').trim();
const role = ['coach', 'admin'].includes(process.env.COACH_ROLE) ? process.env.COACH_ROLE : 'coach';

if (!email || !password) {
  console.error('Bitte COACH_EMAIL und COACH_PASSWORD als Umgebungsvariablen setzen.');
  console.error('Beispiel: COACH_EMAIL=pierre@be-inevitable.at COACH_PASSWORD=geheim123 COACH_NAME="Pierre" COACH_ROLE=admin node src/create-coach.js');
  process.exit(1);
}
if (password.length < 6) { console.error('Passwort muss mind. 6 Zeichen haben.'); process.exit(1); }

const exists = db.get('SELECT id, role FROM users WHERE email=?', [email]);
if (exists) {
  console.log(`Nutzer mit ${email} existiert bereits (Rolle: ${exists.role}). Nichts geändert.`);
  process.exit(0);
}

db.run('INSERT INTO users(email,password_hash,name,role) VALUES(?,?,?,?)',
  [email, hashPassword(password), name, role]);
console.log(`✓ ${role === 'admin' ? 'Admin' : 'Coach'}-Account angelegt: ${email}`);
process.exit(0);
