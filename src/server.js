import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { initSchema } from './schema.js';
import { hashPassword, verifyPassword, signToken, auth, requireCoach, requireAdmin, cookieOpts } from './auth.js';
import { recommend, buildPattern, suggestForToday, previewNext, dayNutrition, estimateCardioKcal, recoveryStatus, nutritionPlan, generatePlan, bmr, personalRecords, estimate1RM, calendarRange } from './logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
initSchema();

// Stammdaten (Lebensmittel) automatisch laden, falls die Tabelle leer ist.
// Idempotent: läuft online beim ersten Start, danach übersprungen. Keine Demo-Accounts.
try {
  const foodCount = db.get('SELECT COUNT(*) c FROM foods').c;
  if (foodCount === 0) {
    const { readFileSync } = await import('node:fs');
    const seed = JSON.parse(readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));
    for (const f of (seed.diet?.foods || [])) {
      db.run('INSERT INTO foods(name,fat,carbs,protein) VALUES(?,?,?,?)', [f.name, f.fat, f.carbs, f.protein]);
    }
    console.log('[init] Lebensmittel-Stammdaten geladen:', (seed.diet?.foods || []).length);
  }
} catch (e) { console.error('[init] Stammdaten-Laden übersprungen:', e.message); }

// Rezept-Stammdaten: fehlende globale Rezepte nachtragen (per Name-Abgleich).
// So bekommen auch bestehende Installationen neue Rezepte, ohne eigene zu berühren.
try {
  const { readFileSync } = await import('node:fs');
  const recipes = JSON.parse(readFileSync(path.join(__dirname, 'recipes-data.json'), 'utf8'));
  const existing = new Set(db.all('SELECT name FROM recipes WHERE owner_id IS NULL').map(r => r.name));
  let added = 0;
  for (const r of recipes) {
    if (existing.has(r.name)) continue;
    db.run(`INSERT INTO recipes(name,goal,meal_type,kcal,protein,carbs,fat,ingredients,steps,link,owner_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,NULL)`,
      [r.name, r.goal || null, r.meal_type || null, r.kcal, r.protein, r.carbs, r.fat, r.ingredients || '', r.steps || '', r.link || '']);
    added++;
  }
  if (added) console.log('[init] Rezepte nachgetragen:', added);
} catch (e) { console.error('[init] Rezept-Laden übersprungen:', e.message); }

// Supplement-Stammdaten: fehlende nachtragen (per Name-Abgleich, idempotent).
try {
  const { readFileSync } = await import('node:fs');
  const supps = JSON.parse(readFileSync(path.join(__dirname, 'supplements-data.json'), 'utf8'));
  const existing = new Set(db.all('SELECT name FROM supplements').map(s => s.name));
  let added = 0;
  for (const s of supps) {
    if (existing.has(s.name)) continue;
    db.run(`INSERT INTO supplements(name,category,dose,timing,with_water,how_to,sort)
      VALUES(?,?,?,?,?,?,?)`,
      [s.name, s.category || null, s.dose || null, s.timing || null, s.with_water === 0 ? 0 : 1, s.how_to || null, s.sort || 0]);
    added++;
  }
  if (added) console.log('[init] Supplements nachgetragen:', added);
} catch (e) { console.error('[init] Supplement-Laden übersprungen:', e.message); }

const app = express();
app.set('trust proxy', 1); // korrekte Client-IP hinter Reverse-Proxy (Hosting/HTTPS)
const clampSets = (v, fb = 3) => { let n = parseInt(v); if (isNaN(n)) n = fb; return Math.max(1, Math.min(10, n)); };
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;

// Helfer: prüft, ob der eingeloggte User auf den Athleten zugreifen darf
function canAccess(reqUser, athleteId) {
  athleteId = Number(athleteId);
  if (reqUser.id === athleteId) return true;        // eigener Account
  if (reqUser.role === 'admin') return true;        // Admin: Zugriff auf alle
  if (reqUser.role === 'coach') {                   // Coach seines Athleten
    const a = db.get('SELECT coach_id FROM users WHERE id=?', [athleteId]);
    return a && a.coach_id === reqUser.id;
  }
  return false;
}
// Prüft, ob reqUser Coach des Athleten ist ODER Admin (für Coach-Detailrouten)
function coachOwns(reqUser, athleteCoachId) {
  return reqUser.role === 'admin' || athleteCoachId === reqUser.id;
}

/* ---------------- AUTH ---------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Bitte alle Felder ausfüllen' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Bitte eine gültige E-Mail eingeben' });
  if (password.length < 6) return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
  if (name.length > 80 || email.length > 120) return res.status(400).json({ error: 'Eingabe zu lang' });
  const exists = db.get('SELECT id FROM users WHERE email=?', [email.toLowerCase()]);
  if (exists) return res.status(409).json({ error: 'Diese E-Mail ist bereits registriert' });
  // Selbst-Registrierung erstellt IMMER einen Athleten. Coaches werden separat angelegt.
  const r = db.run('INSERT INTO users(email,password_hash,name,role) VALUES(?,?,?,?)',
    [email.toLowerCase(), hashPassword(password), name.trim(), 'athlete']);
  const user = db.get('SELECT * FROM users WHERE id=?', [r.lastInsertRowid]);
  const token = signToken(user);
  res.cookie('token', token, cookieOpts);
  res.json({ token, user: pubUser(user) });
});

// Einfacher Rate-Limiter gegen Passwort-Raten: max 8 Fehlversuche / 15 Min je IP+E-Mail
const loginAttempts = new Map();
function tooManyAttempts(key) {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec) return false;
  if (now - rec.first > 15 * 60 * 1000) { loginAttempts.delete(key); return false; }
  return rec.count >= 8;
}
function noteFailure(key) {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || now - rec.first > 15 * 60 * 1000) loginAttempts.set(key, { count: 1, first: now });
  else rec.count++;
}

app.post('/api/login', (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password;
  const key = (req.ip || '') + '|' + email;
  if (tooManyAttempts(key))
    return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' });
  const user = db.get('SELECT * FROM users WHERE email=?', [email]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    noteFailure(key);
    return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
  }
  loginAttempts.delete(key); // erfolgreich -> Zähler zurücksetzen
  const token = signToken(user);
  res.cookie('token', token, cookieOpts);
  res.json({ token, user: pubUser(user) });
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/me', auth, (req, res) => {
  const user = db.get('SELECT * FROM users WHERE id=?', [req.user.id]);
  res.json({ user: pubUser(user) });
});

// Benutzerdefinierten Trainingsrhythmus (Pattern) speichern
app.post('/api/pattern', auth, (req, res) => {
  const pat = req.body.pattern;
  if (!Array.isArray(pat) || !pat.length) return res.status(400).json({ error: 'Ungültiges Muster' });
  // nur erlaubte Werte: 'train' oder 'rest'
  const clean = pat.map(x => x === 'train' ? 'train' : 'rest');
  const trainCount = clean.filter(x => x === 'train').length;
  db.run('UPDATE users SET pattern=?, days_per_week=? WHERE id=?',
    [JSON.stringify(clean), trainCount, req.user.id]);
  res.json({ ok: true });
});

// Passwort ändern (aktuelles Passwort prüfen)
app.post('/api/password', auth, (req, res) => {
  const { current, next } = req.body;
  if (!next || next.length < 6) return res.status(400).json({ error: 'Neues Passwort min. 6 Zeichen' });
  const user = db.get('SELECT * FROM users WHERE id=?', [req.user.id]);
  if (!verifyPassword(current || '', user.password_hash))
    return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
  db.run('UPDATE users SET password_hash=? WHERE id=?', [hashPassword(next), req.user.id]);
  res.json({ ok: true });
});

// Coach setzt Passwort eines Athleten zurück (Self-Service-Reset per E-Mail kommt später mit Mailversand)
app.post('/api/athlete/:id/resetpw', auth, requireCoach, (req, res) => {
  const a = db.get('SELECT coach_id FROM users WHERE id=?', [req.params.id]);
  if (!a || !coachOwns(req.user, a.coach_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const next = req.body.next;
  if (!next || next.length < 6) return res.status(400).json({ error: 'Passwort min. 6 Zeichen' });
  db.run('UPDATE users SET password_hash=? WHERE id=?', [hashPassword(next), req.params.id]);
  db.run('INSERT INTO messages(user_id,from_id,kind,title,body) VALUES(?,?,?,?,?)',
    [req.params.id, req.user.id, 'system', 'Passwort zurückgesetzt', 'Dein Coach hat dir ein neues Passwort vergeben. Ändere es nach dem Login im Profil.']);
  res.json({ ok: true });
});

function pubUser(u) {
  const { password_hash, ...rest } = u; return rest;
}

/* ---------------- ONBOARDING ---------------- */
// Vorschau der Empfehlung (ohne Speichern) – für den letzten Onboarding-Schritt
app.post('/api/onboarding/preview', auth, (req, res) => {
  const f = req.body;
  const age = f.age || (f.dob ? Math.floor((Date.now() - new Date(f.dob).getTime()) / (365.25 * 864e5)) : 30);
  const nut = nutritionPlan({ gender: f.gender, weightKg: f.start_weight, heightCm: f.height_cm, age, goal: f.goal, daysPerWeek: f.days_per_week });
  const plan = generatePlan({ goal: f.goal, experience: f.experience, daysPerWeek: f.days_per_week });
  const bmiVal = f.start_weight && f.height_cm ? +(f.start_weight / Math.pow(f.height_cm / 100, 2)).toFixed(1) : null;
  res.json({ nutrition: nut, plan, bmi: bmiVal });
});

// Onboarding abschließen: Profil speichern + Plan anlegen
app.post('/api/onboarding/complete', auth, (req, res) => {
  const f = req.body;
  const age = f.age || (f.dob ? Math.floor((Date.now() - new Date(f.dob).getTime()) / (365.25 * 864e5)) : 30);
  const nut = nutritionPlan({ gender: f.gender, weightKg: f.start_weight, heightCm: f.height_cm, age, goal: f.goal, daysPerWeek: f.days_per_week });
  const pattern = JSON.stringify(buildPattern(Number(f.days_per_week) || 3));
  // Profil speichern
  db.run(`UPDATE users SET dob=?,gender=?,height_cm=?,start_weight=?,goal=?,days_per_week=?,
    pattern=?,experience=?,kcal_target_train=?,kcal_target_rest=? WHERE id=?`,
    [f.dob, f.gender, f.height_cm, f.start_weight, f.goal, f.days_per_week,
     pattern, f.experience || 'beginner', nut.trainKcal, nut.restKcal, req.user.id]);
  // Bestehenden aktiven Plan deaktivieren, neuen anlegen
  db.run('UPDATE plans SET active=0 WHERE user_id=?', [req.user.id]);
  const planId = db.run('INSERT INTO plans(user_id,title,active) VALUES(?,?,1)',
    [req.user.id, 'Mein Startplan']).lastInsertRowid;
  const days = generatePlan({ goal: f.goal, experience: f.experience, daysPerWeek: f.days_per_week });
  days.forEach((d, di) => {
    const dayId = db.run('INSERT INTO training_days(plan_id,name,position) VALUES(?,?,?)', [planId, d.name, di]).lastInsertRowid;
    d.exercises.forEach((e, ei) => {
      db.run(`INSERT INTO exercises(day_id,muscle,name,technique,target_sets,target_reps,position,source,coach_locked)
        VALUES(?,?,?,?,?,?,?,?,?)`,
        [dayId, e.muscle, e.name, e.technique || null, e.target_sets, e.target_reps, ei, 'system', 0]);
    });
  });
  res.json({ ok: true, nutrition: nut });
});

/* ---------------- PROFIL ---------------- */
app.put('/api/profile', auth, (req, res) => {
  const f = req.body;
  const current = db.get('SELECT days_per_week FROM users WHERE id=?', [req.user.id]);
  let pattern = f.pattern;
  if (pattern && typeof pattern !== 'string') pattern = JSON.stringify(pattern);
  // Pattern NUR neu ableiten, wenn sich die Frequenz wirklich ändert (sonst bleiben
  // manuell geplante Kalendertage erhalten). Ohne explizites Pattern und ohne Änderung: null -> COALESCE behält Bestehendes.
  if (!pattern && f.days_per_week && Number(f.days_per_week) !== current?.days_per_week) {
    pattern = JSON.stringify(buildPattern(Number(f.days_per_week)));
  }
  db.run(`UPDATE users SET name=?,dob=?,gender=?,height_cm=?,start_weight=?,goal=?,days_per_week=?,
    pattern=COALESCE(?,pattern),phase=COALESCE(?,phase),kcal_target_train=?,kcal_target_rest=?,experience=COALESCE(?,experience) WHERE id=?`,
    [f.name, f.dob, f.gender, f.height_cm, f.start_weight, f.goal, f.days_per_week,
     pattern, f.phase, f.kcal_target_train, f.kcal_target_rest, f.experience, req.user.id]);
  res.json({ ok: true });
});

// Coach darf Profil/Phase eines Athleten setzen
app.put('/api/athlete/:id/profile', auth, requireCoach, (req, res) => {
  const a = db.get('SELECT coach_id FROM users WHERE id=?', [req.params.id]);
  if (!a || !coachOwns(req.user, a.coach_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const f = req.body;
  db.run(`UPDATE users SET phase=COALESCE(?,phase),goal=COALESCE(?,goal),
    kcal_target_train=COALESCE(?,kcal_target_train),kcal_target_rest=COALESCE(?,kcal_target_rest) WHERE id=?`,
    [f.phase, f.goal, f.kcal_target_train, f.kcal_target_rest, req.params.id]);
  // Athlet bekommt eine Nachricht über die Änderung
  db.run('INSERT INTO messages(user_id,from_id,kind,title,body) VALUES(?,?,?,?,?)',
    [req.params.id, req.user.id, 'change', 'Coach hat dein Profil angepasst',
     'Phase/Ziele wurden aktualisiert. Schau dir deinen Plan und deine Kalorienziele an.']);
  res.json({ ok: true });
});

/* ---------------- COACH: ATHLETEN ---------------- */
// Coach-Gesamtübersicht: aggregierte Kennzahlen über alle Athleten
app.get('/api/coach/overview', auth, requireCoach, (req, res) => {
  const coachId = req.user.id;
  const athletes = req.user.role === 'admin'
    ? db.all("SELECT id,name,goal,phase FROM users WHERE role='athlete'")
    : db.all('SELECT id,name,goal,phase FROM users WHERE coach_id=?', [coachId]);
  const ids = athletes.map(a => a.id);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  let trainingsThisWeek = 0, activeThisWeek = 0, attention = 0, totalSessions = 0;
  const goalCounts = { muscle: 0, fatloss: 0, health: 0 };
  const phaseCounts = { offseason: 0, prep: 0, maintain: 0 };
  for (const a of athletes) {
    if (a.goal && goalCounts[a.goal] != null) goalCounts[a.goal]++;
    if (a.phase && phaseCounts[a.phase] != null) phaseCounts[a.phase]++;
    const tw = db.get("SELECT COUNT(*) c FROM day_log WHERE user_id=? AND type='train' AND date>=?", [a.id, weekAgo]).c;
    trainingsThisWeek += tw;
    if (tw > 0) activeThisWeek++;
    const lastTrain = db.get("SELECT MAX(date) d FROM day_log WHERE user_id=? AND type='train'", [a.id])?.d;
    const daysSince = lastTrain ? Math.floor((Date.now() - new Date(lastTrain + 'T00:00').getTime()) / 864e5) : 999;
    if (daysSince > 4) attention++;
    totalSessions += db.get('SELECT COUNT(DISTINCT date) c FROM set_logs WHERE user_id=?', [a.id]).c;
  }
  // Trainingseinheiten der letzten 8 Wochen (alle Athleten zusammen) für Trend
  const weeklyTrend = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date(Date.now() - (w + 1) * 7 * 864e5).toISOString().slice(0, 10);
    const end = new Date(Date.now() - w * 7 * 864e5).toISOString().slice(0, 10);
    let count = 0;
    for (const id of ids) count += db.get("SELECT COUNT(*) c FROM day_log WHERE user_id=? AND type='train' AND date>=? AND date<?", [id, start, end]).c;
    weeklyTrend.push(count);
  }
  // jüngste Aktivität (letzte geloggte Sätze über alle Athleten)
  let recentActivity = [];
  if (ids.length) {
    recentActivity = db.all(`SELECT sl.date, u.name, td.name dayName, COUNT(*) sets
      FROM set_logs sl JOIN users u ON u.id=sl.user_id
      JOIN exercises e ON e.id=sl.exercise_id JOIN training_days td ON td.id=e.day_id
      WHERE sl.user_id IN (${ids.map(() => '?').join(',')})
      GROUP BY sl.user_id, sl.date ORDER BY sl.date DESC LIMIT 8`, ids);
  }
  res.json({
    totalAthletes: athletes.length,
    activeThisWeek, attention, trainingsThisWeek, totalSessions,
    goalCounts, phaseCounts, weeklyTrend, recentActivity,
  });
});

app.get('/api/athletes', auth, requireCoach, (req, res) => {
  // Coach sieht seine Athleten; Admin sieht alle Athleten im System
  const list = req.user.role === 'admin'
    ? db.all("SELECT id,name,email,goal,phase,days_per_week,start_weight FROM users WHERE role='athlete' ORDER BY name")
    : db.all('SELECT id,name,email,goal,phase,days_per_week,start_weight FROM users WHERE coach_id=? ORDER BY name', [req.user.id]);
  // Pro Athlet: letzte Aktivität + Trainings diese Woche + ungelesene Coach-relevante Infos
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  for (const a of list) {
    const lastTrain = db.get("SELECT MAX(date) d FROM day_log WHERE user_id=? AND type='train'", [a.id])?.d;
    const trainsThisWeek = db.get("SELECT COUNT(*) c FROM day_log WHERE user_id=? AND type='train' AND date>=?", [a.id, weekAgo]).c;
    const lastWeight = db.get('SELECT weight FROM checkins WHERE user_id=? AND weight IS NOT NULL ORDER BY date DESC LIMIT 1', [a.id])?.weight;
    const lastCheckin = db.get('SELECT MAX(date) d FROM checkins WHERE user_id=?', [a.id])?.d;
    a.lastTrain = lastTrain || null;
    a.trainsThisWeek = trainsThisWeek;
    a.lastWeight = lastWeight ?? null;
    a.lastCheckin = lastCheckin || null;
    // "Achtung"-Flag: seit >4 Tagen kein Training UND Frequenz erwartet mehr
    const daysSince = lastTrain ? Math.floor((Date.now() - new Date(lastTrain + 'T00:00').getTime()) / 864e5) : 999;
    a.attention = daysSince > 4;
    a.daysSinceTrain = lastTrain ? daysSince : null;
  }
  res.json({ athletes: list });
});

// Athlet einem Coach zuordnen (per E-Mail einladen = einfache Variante)
app.post('/api/athletes/add', auth, requireCoach, (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const a = db.get('SELECT * FROM users WHERE email=? AND role=?', [email, 'athlete']);
  if (!a) return res.status(404).json({ error: 'Kein Athlet mit dieser E-Mail gefunden' });
  db.run('UPDATE users SET coach_id=? WHERE id=?', [req.user.id, a.id]);
  res.json({ ok: true, athlete: { id: a.id, name: a.name } });
});

// Coach legt einen NEUEN Athleten-Account direkt an
app.post('/api/athletes/create', auth, requireCoach, (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, E-Mail und Startpasswort nötig' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Ungültige E-Mail' });
  if (password.length < 6) return res.status(400).json({ error: 'Passwort min. 6 Zeichen' });
  if (db.get('SELECT id FROM users WHERE email=?', [email])) return res.status(409).json({ error: 'E-Mail bereits vergeben' });
  const r = db.run('INSERT INTO users(email,password_hash,name,role,coach_id) VALUES(?,?,?,?,?)',
    [email, hashPassword(password), name, 'athlete', req.user.id]);
  db.run('INSERT INTO messages(user_id,from_id,kind,title,body) VALUES(?,?,?,?,?)',
    [r.lastInsertRowid, req.user.id, 'system', 'Willkommen bei BE INEVITABLE',
     'Dein Coach hat dein Konto erstellt. Lege im Profil deine Daten an, dann erstellen wir deinen Plan.']);
  res.json({ ok: true, athlete: { id: r.lastInsertRowid, name } });
});

/* ---------------- ADMIN: NUTZERVERWALTUNG ---------------- */
// Alle Nutzer im System (mit Coach-Name, Statistiken)
app.get('/api/admin/users', auth, requireAdmin, (req, res) => {
  const users = db.all(`SELECT u.id, u.name, u.email, u.role, u.coach_id, u.goal, u.phase,
    c.name AS coach_name,
    (SELECT COUNT(*) FROM users a WHERE a.coach_id=u.id) AS athlete_count
    FROM users u LEFT JOIN users c ON c.id=u.coach_id ORDER BY
    CASE u.role WHEN 'admin' THEN 0 WHEN 'coach' THEN 1 ELSE 2 END, u.name`);
  // Zähl-Übersicht
  const counts = { admin: 0, coach: 0, athlete: 0 };
  users.forEach(u => { if (counts[u.role] != null) counts[u.role]++; });
  res.json({ users, counts });
});

// Neuen Nutzer mit beliebiger Rolle anlegen
app.post('/api/admin/users', auth, requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password;
  const role = ['admin', 'coach', 'athlete'].includes(req.body.role) ? req.body.role : 'athlete';
  const coachId = req.body.coach_id || null;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, E-Mail und Passwort nötig' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Ungültige E-Mail' });
  if (password.length < 6) return res.status(400).json({ error: 'Passwort min. 6 Zeichen' });
  if (db.get('SELECT id FROM users WHERE email=?', [email])) return res.status(409).json({ error: 'E-Mail bereits vergeben' });
  const r = db.run('INSERT INTO users(email,password_hash,name,role,coach_id) VALUES(?,?,?,?,?)',
    [email, hashPassword(password), name, role, role === 'athlete' ? coachId : null]);
  res.json({ ok: true, user: { id: r.lastInsertRowid, name, role } });
});

// Rolle eines Nutzers ändern
app.put('/api/admin/users/:id/role', auth, requireAdmin, (req, res) => {
  const role = req.body.role;
  if (!['admin', 'coach', 'athlete'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' });
  const target = db.get('SELECT id, role FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  // Sich selbst nicht degradieren, wenn man der letzte Admin ist
  if (target.id === req.user.id && role !== 'admin') {
    const admins = db.get("SELECT COUNT(*) c FROM users WHERE role='admin'").c;
    if (admins <= 1) return res.status(400).json({ error: 'Du bist der letzte Admin – Rolle kann nicht entzogen werden' });
  }
  // Wird jemand vom Athleten zu Coach/Admin, verliert er die Coach-Zuordnung
  const clearCoach = role !== 'athlete';
  db.run('UPDATE users SET role=?' + (clearCoach ? ', coach_id=NULL' : '') + ' WHERE id=?', [role, req.params.id]);
  res.json({ ok: true });
});

// Athlet einem Coach zuordnen (oder Zuordnung lösen mit coach_id=null)
app.put('/api/admin/users/:id/coach', auth, requireAdmin, (req, res) => {
  const coachId = req.body.coach_id || null;
  const target = db.get('SELECT id, role FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  if (coachId) {
    const coach = db.get('SELECT role FROM users WHERE id=?', [coachId]);
    if (!coach || (coach.role !== 'coach' && coach.role !== 'admin'))
      return res.status(400).json({ error: 'Ziel ist kein Coach' });
  }
  db.run('UPDATE users SET coach_id=? WHERE id=?', [coachId, req.params.id]);
  res.json({ ok: true });
});

// Nutzer löschen (mit Sicherheitscheck)
app.delete('/api/admin/users/:id', auth, requireAdmin, (req, res) => {
  const target = db.get('SELECT id, role FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Du kannst dich nicht selbst löschen' });
  // Athleten dieses Coaches lösen (nicht mitlöschen)
  db.run('UPDATE users SET coach_id=NULL WHERE coach_id=?', [req.params.id]);
  db.run('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// Admin: Passwort eines beliebigen Nutzers zurücksetzen
app.post('/api/admin/users/:id/resetpw', auth, requireAdmin, (req, res) => {
  const target = db.get('SELECT id FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  const next = req.body.next;
  if (!next || next.length < 6) return res.status(400).json({ error: 'Passwort min. 6 Zeichen' });
  db.run('UPDATE users SET password_hash=? WHERE id=?', [hashPassword(next), req.params.id]);
  db.run('INSERT INTO messages(user_id,from_id,kind,title,body) VALUES(?,?,?,?,?)',
    [req.params.id, req.user.id, 'system', 'Passwort zurückgesetzt', 'Ein Administrator hat dir ein neues Passwort vergeben. Ändere es nach dem Login im Profil.']);
  res.json({ ok: true });
});

// Liste der Coaches (für Zuordnungs-Dropdowns)
app.get('/api/admin/coaches', auth, requireAdmin, (req, res) => {
  res.json({ coaches: db.all("SELECT id, name FROM users WHERE role IN ('coach','admin') ORDER BY name") });
});

// Coach-Dashboard: gebündelte Detail-Daten zu einem Athleten
app.get('/api/dashboard/:userId', auth, requireCoach, (req, res) => {
  const uid = Number(req.params.userId);
  const a = db.get('SELECT * FROM users WHERE id=?', [uid]);
  if (!a || !canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  // Letzte Trainingseinheiten (Tage mit geloggten Sätzen), je mit Übungs-Anzahl + Top-Satz
  const sessions = db.all(`SELECT sl.date, td.name dayName, COUNT(DISTINCT sl.exercise_id) exCount, COUNT(*) setCount,
      MAX(sl.weight) topWeight
      FROM set_logs sl
      JOIN exercises e ON e.id=sl.exercise_id
      JOIN training_days td ON td.id=e.day_id
      WHERE sl.user_id=?
      GROUP BY sl.date ORDER BY sl.date DESC LIMIT 10`, [uid]);
  // Gewichtsverlauf
  const weights = db.all('SELECT date, weight FROM checkins WHERE user_id=? AND weight IS NOT NULL ORDER BY date DESC LIMIT 30', [uid]);
  // Check-in-Verlauf (Schlaf/Schritte)
  const checkins = db.all('SELECT * FROM checkins WHERE user_id=? ORDER BY date DESC LIMIT 14', [uid]);
  // Cardio der letzten 14 Tage
  const cardio = db.all('SELECT date,kind,minutes,kcal,intensity FROM cardio_log WHERE user_id=? ORDER BY date DESC LIMIT 14', [uid]);
  // Volumen-Trend: Gesamt-Tonnage (kg*reps) je Trainingstag, letzte 8
  const volume = db.all(`SELECT date, SUM(COALESCE(weight,0)*COALESCE(reps,0)) tonnage
      FROM set_logs WHERE user_id=? GROUP BY date ORDER BY date DESC LIMIT 8`, [uid]);
  res.json({
    athlete: { id: a.id, name: a.name, email: a.email, goal: a.goal, phase: a.phase,
      days_per_week: a.days_per_week, experience: a.experience, start_weight: a.start_weight,
      kcal_target_train: a.kcal_target_train, kcal_target_rest: a.kcal_target_rest },
    sessions, weights, checkins, cardio, volume,
  });
});


app.get('/api/plan/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  let plan = db.get('SELECT * FROM plans WHERE user_id=? AND active=1', [uid]);
  if (!plan) {
    const r = db.run('INSERT INTO plans(user_id,title) VALUES(?,?)', [uid, 'Mein Plan']);
    plan = db.get('SELECT * FROM plans WHERE id=?', [r.lastInsertRowid]);
  }
  const days = db.all('SELECT * FROM training_days WHERE plan_id=? ORDER BY position,id', [plan.id]);
  for (const d of days) {
    d.exercises = db.all('SELECT * FROM exercises WHERE day_id=? AND deleted=0 ORDER BY position,id', [d.id]);
  }
  res.json({ plan, days });
});

app.post('/api/days', auth, (req, res) => {
  const { plan_id, name } = req.body;
  const plan = db.get('SELECT * FROM plans WHERE id=?', [plan_id]);
  if (!plan || !canAccess(req.user, plan.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const pos = db.get('SELECT COALESCE(MAX(position),0)+1 p FROM training_days WHERE plan_id=?', [plan_id]).p;
  const r = db.run('INSERT INTO training_days(plan_id,name,position) VALUES(?,?,?)', [plan_id, name || 'Neuer Tag', pos]);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/days/:id', auth, (req, res) => {
  const d = db.get('SELECT td.*, p.user_id FROM training_days td JOIN plans p ON p.id=td.plan_id WHERE td.id=?', [req.params.id]);
  if (!d || !canAccess(req.user, d.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('UPDATE training_days SET name=?,weekday=? WHERE id=?', [req.body.name ?? d.name, req.body.weekday ?? d.weekday, d.id]);
  res.json({ ok: true });
});

app.delete('/api/days/:id', auth, (req, res) => {
  const d = db.get('SELECT td.*, p.user_id FROM training_days td JOIN plans p ON p.id=td.plan_id WHERE td.id=?', [req.params.id]);
  if (!d || !canAccess(req.user, d.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('DELETE FROM training_days WHERE id=?', [d.id]);
  res.json({ ok: true });
});

// Übung anlegen
app.post('/api/exercises', auth, (req, res) => {
  const day = db.get('SELECT td.*, p.user_id FROM training_days td JOIN plans p ON p.id=td.plan_id WHERE td.id=?', [req.body.day_id]);
  if (!day || !canAccess(req.user, day.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const isCoach = req.user.role === 'coach';
  const pos = db.get('SELECT COALESCE(MAX(position),0)+1 p FROM exercises WHERE day_id=?', [req.body.day_id]).p;
  const r = db.run(`INSERT INTO exercises(day_id,muscle,name,technique,video_url,target_sets,target_reps,notes,position,source,coach_locked)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [req.body.day_id, req.body.muscle, req.body.name, req.body.technique, req.body.video_url,
     clampSets(req.body.target_sets), req.body.target_reps, req.body.notes, pos,
     isCoach ? 'coach' : 'athlete', isCoach ? 1 : 0]);
  res.json({ id: r.lastInsertRowid });
});

// Übung ändern – HIER die Coach-Lock-Logik
app.put('/api/exercises/:id', auth, (req, res) => {
  const ex = db.get('SELECT e.*, p.user_id FROM exercises e JOIN training_days td ON td.id=e.day_id JOIN plans p ON p.id=td.plan_id WHERE e.id=?', [req.params.id]);
  if (!ex || !canAccess(req.user, ex.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const isCoach = req.user.role === 'coach';

  // Athlet überschreibt Coach-Inhalt -> Warnung, außer er bestätigt (confirm:true)
  if (!isCoach && ex.coach_locked && !req.body.confirm) {
    return res.status(409).json({
      warning: true,
      message: 'Diese Übung wurde von deinem Coach erstellt. Wenn du sie änderst, weicht dein Plan von der Coach-Vorgabe ab. Trotzdem ändern?'
    });
  }

  db.run(`UPDATE exercises SET muscle=?,name=?,technique=?,video_url=?,target_sets=?,target_reps=?,notes=?,
    source=?, coach_locked=? WHERE id=?`,
    [req.body.muscle ?? ex.muscle, req.body.name ?? ex.name, req.body.technique ?? ex.technique,
     req.body.video_url ?? ex.video_url,
     clampSets(req.body.target_sets, ex.target_sets), req.body.target_reps ?? ex.target_reps, req.body.notes ?? ex.notes,
     isCoach ? 'coach' : 'athlete',           // wer zuletzt editiert hat
     isCoach ? 1 : 0,                          // Coach lockt wieder, Athlet entlockt
     ex.id]);
  // Wenn Coach den Plan eines Athleten ändert -> Changelog-Nachricht
  if (isCoach && ex.user_id !== req.user.id) {
    const changes = [];
    if (req.body.target_reps && req.body.target_reps !== ex.target_reps) changes.push(`Reps: ${ex.target_reps || '–'} → ${req.body.target_reps}`);
    if (req.body.target_sets && req.body.target_sets !== ex.target_sets) changes.push(`Sätze: ${ex.target_sets} → ${req.body.target_sets}`);
    if (req.body.name && req.body.name !== ex.name) changes.push(`Übung: ${ex.name} → ${req.body.name}`);
    db.run('INSERT INTO messages(user_id,from_id,kind,title,body) VALUES(?,?,?,?,?)',
      [ex.user_id, req.user.id, 'change', 'Coach hat deinen Plan angepasst',
       `Bei "${ex.name}": ${changes.length ? changes.join(', ') : 'Details aktualisiert'}.`]);
  }
  res.json({ ok: true });
});

app.delete('/api/exercises/:id', auth, (req, res) => {
  const ex = db.get('SELECT e.*, p.user_id, e.coach_locked FROM exercises e JOIN training_days td ON td.id=e.day_id JOIN plans p ON p.id=td.plan_id WHERE e.id=?', [req.params.id]);
  if (!ex || !canAccess(req.user, ex.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  if (req.user.role !== 'coach' && ex.coach_locked && !req.body?.confirm) {
    return res.status(409).json({ warning: true, message: 'Coach-Übung löschen? Dein Plan weicht dann von der Vorgabe ab.' });
  }
  db.run('UPDATE exercises SET deleted=1 WHERE id=?', [ex.id]); // Soft-Delete
  res.json({ ok: true, id: ex.id });
});

// Übung wiederherstellen (Rückgängig)
app.post('/api/exercises/:id/restore', auth, (req, res) => {
  const ex = db.get('SELECT e.*, p.user_id FROM exercises e JOIN training_days td ON td.id=e.day_id JOIN plans p ON p.id=td.plan_id WHERE e.id=?', [req.params.id]);
  if (!ex || !canAccess(req.user, ex.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('UPDATE exercises SET deleted=0 WHERE id=?', [ex.id]);
  res.json({ ok: true });
});

/* ---------------- SET-LOGS ---------------- */
app.get('/api/logs/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const date = req.query.date;
  const rows = date
    ? db.all('SELECT * FROM set_logs WHERE user_id=? AND date=?', [uid, date])
    : db.all('SELECT * FROM set_logs WHERE user_id=? ORDER BY date DESC LIMIT 500', [uid]);
  res.json({ logs: rows });
});

// Satz speichern (upsert pro user+exercise+date+set_no)
app.post('/api/logs', auth, (req, res) => {
  const { user_id, exercise_id, date, set_no, weight, reps, note } = req.body;
  if (!canAccess(req.user, user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const ex = db.get('SELECT * FROM set_logs WHERE user_id=? AND exercise_id=? AND date=? AND set_no=?',
    [user_id, exercise_id, date, set_no]);
  if (ex) {
    db.run('UPDATE set_logs SET weight=?,reps=?,note=? WHERE id=?', [weight, reps, note, ex.id]);
  } else {
    db.run('INSERT INTO set_logs(user_id,exercise_id,date,set_no,weight,reps,note) VALUES(?,?,?,?,?,?,?)',
      [user_id, exercise_id, date, set_no, weight, reps, note]);
  }
  // Tag automatisch als Trainingstag markieren (mit dem Namen des Tages dieser Übung)
  const exMeta = db.get('SELECT td.name dn FROM exercises e JOIN training_days td ON td.id=e.day_id WHERE e.id=?', [exercise_id]);
  const dayRow = db.get('SELECT id,type FROM day_log WHERE user_id=? AND date=?', [user_id, date]);
  if (!dayRow) db.run('INSERT INTO day_log(user_id,date,type,day_name) VALUES(?,?,?,?)', [user_id, date, 'train', exMeta?.dn || null]);
  else if (dayRow.type !== 'train') db.run('UPDATE day_log SET type=?,day_name=? WHERE id=?', ['train', exMeta?.dn || null, dayRow.id]);
  res.json({ ok: true });
});

/* ---------------- CHECK-INS ---------------- */
app.get('/api/checkins/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  res.json({ checkins: db.all('SELECT * FROM checkins WHERE user_id=? ORDER BY date DESC', [uid]) });
});

app.post('/api/checkins', auth, (req, res) => {
  const c = req.body;
  if (!canAccess(req.user, c.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  // Hilfsfunktion: undefined -> null, damit COALESCE den Bestandswert behält
  const v = x => (x === undefined ? null : x);
  const ex = db.get('SELECT id FROM checkins WHERE user_id=? AND date=?', [c.user_id, c.date]);
  if (ex) {
    // Nur tatsächlich übergebene Felder ändern – fehlende behalten ihren Wert (kein Datenverlust
    // bei Teil-Check-ins, z.B. morgens Gewicht, abends Wasser).
    db.run(`UPDATE checkins SET
      weight=COALESCE(?,weight), sleep=COALESCE(?,sleep), sleep_quality=COALESCE(?,sleep_quality),
      steps=COALESCE(?,steps), cardio=COALESCE(?,cardio), water=COALESCE(?,water),
      training=COALESCE(?,training), notes=COALESCE(?,notes) WHERE id=?`,
      [v(c.weight), v(c.sleep), v(c.sleep_quality), v(c.steps), v(c.cardio), v(c.water), v(c.training), v(c.notes), ex.id]);
  } else {
    db.run(`INSERT INTO checkins(user_id,date,weight,sleep,sleep_quality,steps,cardio,water,training,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [c.user_id, c.date, v(c.weight), v(c.sleep), v(c.sleep_quality), v(c.steps), v(c.cardio), v(c.water), v(c.training), v(c.notes)]);
  }
  res.json({ ok: true });
});

// Apple-Health-Import: nimmt bereits im Browser aggregierte Tageswerte entgegen
// ({ days: { 'YYYY-MM-DD': {weight,steps,sleep} }, overwrite }) und schreibt sie in die Check-ins.
// Standardmäßig werden nur LEERE Felder gefüllt (manuelle Einträge bleiben erhalten);
// mit overwrite=true überschreiben die Health-Werte vorhandene.
app.post('/api/health-import/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const days = req.body.days || {};
  const overwrite = !!req.body.overwrite;
  let created = 0, updated = 0;
  const setOrKeep = (cur, val) => {
    if (val == null) return cur;            // kein neuer Wert
    if (overwrite) return val;              // überschreiben gewünscht
    return cur == null ? val : cur;         // sonst nur füllen, wenn leer
  };
  for (const [date, vals] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const ex = db.get('SELECT * FROM checkins WHERE user_id=? AND date=?', [uid, date]);
    if (ex) {
      const w = setOrKeep(ex.weight, vals.weight);
      const s = setOrKeep(ex.sleep, vals.sleep);
      const st = setOrKeep(ex.steps, vals.steps);
      db.run('UPDATE checkins SET weight=?, sleep=?, steps=? WHERE id=?', [w, s, st, ex.id]);
      updated++;
    } else {
      db.run('INSERT INTO checkins(user_id,date,weight,sleep,steps) VALUES(?,?,?,?,?)',
        [uid, date, vals.weight ?? null, vals.sleep ?? null, vals.steps ?? null]);
      created++;
    }
  }
  // Zeitpunkt des letzten Imports am Nutzer vermerken (für Reminder)
  db.run("UPDATE users SET last_health_import=datetime('now') WHERE id=?", [uid]);
  res.json({ ok: true, created, updated, days: Object.keys(days).length });
});

// Wöchentliche Health-Erinnerung an-/abschalten
app.post('/api/health-reminder', auth, (req, res) => {
  db.run('UPDATE users SET health_reminder=? WHERE id=?', [req.body.enabled ? 1 : 0, req.user.id]);
  res.json({ ok: true });
});
app.put('/api/checkins/:id/coachnote', auth, requireCoach, (req, res) => {
  const c = db.get('SELECT c.*, u.coach_id FROM checkins c JOIN users u ON u.id=c.user_id WHERE c.id=?', [req.params.id]);
  if (!c || !coachOwns(req.user, c.coach_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('UPDATE checkins SET coach_notes=? WHERE id=?', [req.body.coach_notes, c.id]);
  res.json({ ok: true });
});

/* ---------------- ÜBUNGS-NOTIZEN (Beschwerden) ---------------- */
app.get('/api/exercise-notes/:userId/:exerciseId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  res.json({ notes: db.all('SELECT * FROM exercise_notes WHERE user_id=? AND exercise_id=? ORDER BY date DESC', [uid, req.params.exerciseId]) });
});
app.post('/api/exercise-notes', auth, (req, res) => {
  const { user_id, exercise_id, note, flagged } = req.body;
  if (!canAccess(req.user, user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  if (!note || !note.trim()) return res.status(400).json({ error: 'Notiz fehlt' });
  db.run('INSERT INTO exercise_notes(user_id,exercise_id,date,note,flagged) VALUES(?,?,?,?,?)',
    [user_id, exercise_id, new Date().toISOString().slice(0, 10), note.trim(), flagged === false ? 0 : 1]);
  res.json({ ok: true });
});
app.post('/api/exercise-notes/:id/resolve', auth, requireCoach, (req, res) => {
  const n = db.get('SELECT en.*, u.coach_id FROM exercise_notes en JOIN users u ON u.id=en.user_id WHERE en.id=?', [req.params.id]);
  if (!n || !coachOwns(req.user, n.coach_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('UPDATE exercise_notes SET flagged=0 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});
// Coach: alle offenen Beschwerden eines Athleten (mit Übungsname)
app.get('/api/flagged-notes/:userId', auth, requireCoach, (req, res) => {
  const a = db.get('SELECT coach_id FROM users WHERE id=?', [req.params.userId]);
  if (!a || !coachOwns(req.user, a.coach_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  res.json({ notes: db.all(`SELECT en.*, e.name AS exercise_name FROM exercise_notes en
    JOIN exercises e ON e.id=en.exercise_id WHERE en.user_id=? AND en.flagged=1 ORDER BY en.date DESC`, [req.params.userId]) });
});

/* ---------------- KÖRPERMASSE ---------------- */
app.get('/api/measurements/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  res.json({ measurements: db.all('SELECT * FROM measurements WHERE user_id=? ORDER BY date DESC', [uid]) });
});
app.post('/api/measurements', auth, (req, res) => {
  const m = req.body;
  if (!canAccess(req.user, m.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const date = m.date || new Date().toISOString().slice(0, 10);
  const ex = db.get('SELECT id FROM measurements WHERE user_id=? AND date=?', [m.user_id, date]);
  const f = ['body_fat', 'chest', 'waist', 'hips', 'arm', 'thigh', 'neck', 'shoulders'];
  if (ex) {
    db.run(`UPDATE measurements SET ${f.map(k => k + '=?').join(',')} WHERE id=?`, [...f.map(k => m[k] ?? null), ex.id]);
  } else {
    db.run(`INSERT INTO measurements(user_id,date,${f.join(',')}) VALUES(?,?,${f.map(() => '?').join(',')})`,
      [m.user_id, date, ...f.map(k => m[k] ?? null)]);
  }
  res.json({ ok: true });
});

/* ---------------- FORTSCHRITTSFOTOS ---------------- */
app.get('/api/photos/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  // ohne Bilddaten (nur Metadaten) für die Liste, Bild via Einzelabruf
  res.json({ photos: db.all('SELECT id,date,pose FROM progress_photos WHERE user_id=? ORDER BY date DESC, id DESC', [uid]) });
});
app.get('/api/photos/:userId/:id', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const p = db.get('SELECT * FROM progress_photos WHERE id=? AND user_id=?', [req.params.id, uid]);
  if (!p) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json({ photo: p });
});
app.post('/api/photos', auth, (req, res) => {
  const { user_id, date, pose, image } = req.body;
  if (!canAccess(req.user, user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  if (!image || !image.startsWith('data:image/')) return res.status(400).json({ error: 'Ungültiges Bild' });
  if (image.length > 3_000_000) return res.status(413).json({ error: 'Bild zu groß (max ~2 MB)' });
  db.run('INSERT INTO progress_photos(user_id,date,pose,image) VALUES(?,?,?,?)',
    [user_id, date || new Date().toISOString().slice(0, 10), pose || 'front', image]);
  res.json({ ok: true });
});
app.delete('/api/photos/:id', auth, (req, res) => {
  const p = db.get('SELECT * FROM progress_photos WHERE id=?', [req.params.id]);
  if (!p || !canAccess(req.user, p.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('DELETE FROM progress_photos WHERE id=?', [p.id]);
  res.json({ ok: true });
});

/* ---------------- MEAL PLAN ---------------- */
app.get('/api/meals/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const meals = db.all('SELECT * FROM meals WHERE user_id=? ORDER BY day_type, position, meal_no', [uid]);
  for (const m of meals) m.items = db.all('SELECT * FROM meal_items WHERE meal_id=? ORDER BY id', [m.id]);
  res.json({ meals });
});

/* ---------------- FOODS / RECHNER ---------------- */
app.get('/api/foods', auth, (req, res) => {
  // Eigene + globale Lebensmittel; häufig genutzte zuerst, dann alphabetisch
  res.json({ foods: db.all(
    `SELECT * FROM foods WHERE owner_id IS NULL OR owner_id=?
     ORDER BY use_count DESC, name`, [req.user.id]) });
});

// Eigenes Lebensmittel anlegen (Makros pro 100 g eingegeben -> pro 1 g gespeichert)
app.post('/api/foods', auth, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name fehlt' });
  const per = req.body.per100 ? 100 : 1; // Eingabe pro 100g oder pro 1g
  const fat = (Number(req.body.fat) || 0) / per;
  const carbs = (Number(req.body.carbs) || 0) / per;
  const protein = (Number(req.body.protein) || 0) / per;
  const r = db.run('INSERT INTO foods(name,fat,carbs,protein,owner_id,use_count) VALUES(?,?,?,?,?,1)',
    [name, fat, carbs, protein, req.user.id]);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.get('/api/definitions', (req, res) => {
  res.json({ definitions: DEFINITIONS });
});

/* ---------------- REZEPTE ---------------- */
// Rezeptliste: global + eigene; optional gefiltert nach goal, meal_type, maxKcal
app.get('/api/recipes', auth, (req, res) => {
  const { goal, meal, maxKcal } = req.query;
  let sql = 'SELECT * FROM recipes WHERE (owner_id IS NULL OR owner_id=?)';
  const params = [req.user.id];
  if (goal && goal !== 'all') { sql += ' AND (goal=? OR goal IS NULL)'; params.push(goal); }
  if (meal && meal !== 'all') { sql += ' AND meal_type=?'; params.push(meal); }
  if (maxKcal && Number(maxKcal) > 0) { sql += ' AND kcal<=?'; params.push(Number(maxKcal)); }
  sql += ' ORDER BY (owner_id IS NOT NULL) DESC, name'; // eigene zuerst
  res.json({ recipes: db.all(sql, params) });
});

// Eigenes Rezept anlegen
app.post('/api/recipes', auth, (req, res) => {
  const b = req.body;
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name fehlt' });
  const kcal = Number(b.kcal) || 0;
  if (kcal <= 0) return res.status(400).json({ error: 'Kalorien angeben' });
  const r = db.run(`INSERT INTO recipes(name,goal,meal_type,kcal,protein,carbs,fat,ingredients,steps,link,owner_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [name, b.goal || null, b.meal_type || null, kcal, Number(b.protein) || 0, Number(b.carbs) || 0, Number(b.fat) || 0,
     b.ingredients || '', b.steps || '', b.link || '', req.user.id]);
  res.json({ ok: true, id: r.lastInsertRowid });
});

// Eigenes Rezept löschen (nur eigene)
app.delete('/api/recipes/:id', auth, (req, res) => {
  const rec = db.get('SELECT * FROM recipes WHERE id=?', [req.params.id]);
  if (!rec) return res.status(404).json({ error: 'Nicht gefunden' });
  if (rec.owner_id !== req.user.id) return res.status(403).json({ error: 'Nur eigene Rezepte löschbar' });
  db.run('DELETE FROM recipes WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// Rezept als gegessen loggen (schreibt direkt ins food_log) — der "1-Tipp"-Weg
app.post('/api/recipes/:id/log', auth, (req, res) => {
  const uid = req.body.user_id || req.user.id;
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const rec = db.get('SELECT * FROM recipes WHERE id=? AND (owner_id IS NULL OR owner_id=?)', [req.params.id, req.user.id]);
  if (!rec) return res.status(404).json({ error: 'Rezept nicht gefunden' });
  db.run(`INSERT INTO food_log(user_id,date,meal_slot,food,amount,kcal,fat,carbs,protein)
    VALUES(?,?,?,?,?,?,?,?,?)`,
    [uid, req.body.date || new Date().toISOString().slice(0, 10), rec.meal_type || 'Mahlzeit',
     rec.name, 1, rec.kcal, rec.fat, rec.carbs, rec.protein]);
  res.json({ ok: true });
});

/* ---------------- SUPPLEMENTS ---------------- */
// Katalog aller globalen Supplements (für Coach zum Zuweisen)
app.get('/api/supplements-catalog', auth, requireCoach, (req, res) => {
  res.json({ supplements: db.all('SELECT * FROM supplements ORDER BY sort, name') });
});

// Supplements eines Athleten: global gemerged mit seinen Zuweisungen.
// Liefert nur ZUGEWIESENE (mind. wenn der Coach welche gesetzt hat). Hat der Athlet
// noch keine Zuweisung, liefern wir den Katalog als "optional" zur Orientierung.
app.get('/api/supplements/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const assigned = db.all(`SELECT s.*, a.mandatory, a.custom_dose, a.custom_timing, a.note,
      1 AS assigned
    FROM athlete_supplements a JOIN supplements s ON s.id=a.supplement_id
    WHERE a.user_id=? ORDER BY a.mandatory DESC, s.sort, s.name`, [uid]);
  if (assigned.length) {
    // angepasste Werte anwenden
    const out = assigned.map(s => ({
      id: s.id, name: s.name, category: s.category,
      dose: s.custom_dose || s.dose, timing: s.custom_timing || s.timing,
      with_water: s.with_water, how_to: s.how_to,
      mandatory: !!s.mandatory, note: s.note, assigned: true
    }));
    return res.json({ supplements: out, personalized: true });
  }
  // Fallback: noch nichts zugewiesen -> Katalog als Orientierung (alles optional)
  const cat = db.all('SELECT * FROM supplements ORDER BY sort, name')
    .map(s => ({ ...s, with_water: s.with_water, mandatory: false, assigned: false }));
  res.json({ supplements: cat, personalized: false });
});

// Coach: Supplement zuweisen / Pflicht setzen / anpassen (upsert)
app.put('/api/supplements/:userId/:suppId', auth, requireCoach, (req, res) => {
  const uid = Number(req.params.userId), sid = Number(req.params.suppId);
  const a = db.get('SELECT coach_id FROM users WHERE id=?', [uid]);
  if (!a || !coachOwns(req.user, a.coach_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  if (!db.get('SELECT id FROM supplements WHERE id=?', [sid])) return res.status(404).json({ error: 'Supplement unbekannt' });
  const mandatory = req.body.mandatory ? 1 : 0;
  const cd = req.body.custom_dose || null, ct = req.body.custom_timing || null, note = req.body.note || null;
  const existing = db.get('SELECT id FROM athlete_supplements WHERE user_id=? AND supplement_id=?', [uid, sid]);
  if (existing) {
    db.run('UPDATE athlete_supplements SET mandatory=?, custom_dose=?, custom_timing=?, note=? WHERE id=?',
      [mandatory, cd, ct, note, existing.id]);
  } else {
    db.run('INSERT INTO athlete_supplements(user_id,supplement_id,mandatory,custom_dose,custom_timing,note) VALUES(?,?,?,?,?,?)',
      [uid, sid, mandatory, cd, ct, note]);
  }
  res.json({ ok: true });
});

// Coach: Zuweisung entfernen
app.delete('/api/supplements/:userId/:suppId', auth, requireCoach, (req, res) => {
  const uid = Number(req.params.userId), sid = Number(req.params.suppId);
  const a = db.get('SELECT coach_id FROM users WHERE id=?', [uid]);
  if (!a || !coachOwns(req.user, a.coach_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('DELETE FROM athlete_supplements WHERE user_id=? AND supplement_id=?', [uid, sid]);
  res.json({ ok: true });
});

/* ---------------- TODAY / RHYTHMUS ---------------- */
function getUserFull(id) { return db.get('SELECT * FROM users WHERE id=?', [id]); }
function getHistory(uid) {
  return db.all('SELECT date,type,day_name as dayName FROM day_log WHERE user_id=? ORDER BY date', [uid]);
}
function getTrainingDayNames(uid) {
  const plan = db.get('SELECT * FROM plans WHERE user_id=? AND active=1', [uid]);
  if (!plan) return [];
  return db.all('SELECT name FROM training_days WHERE plan_id=? ORDER BY position,id', [plan.id]).map(d => d.name);
}

// Was ist heute dran (Vorschlag aus Rhythmus, oder bereits bestätigt)
app.get('/api/today/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const u = getUserFull(uid);
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const pattern = u.pattern ? JSON.parse(u.pattern) : buildPattern(u.days_per_week || 4);
  const trainingDays = getTrainingDayNames(uid);
  const history = getHistory(uid).filter(h => h.date < date); // alles vor heute
  const existing = db.get('SELECT type,day_name as dayName FROM day_log WHERE user_id=? AND date=?', [uid, date]);
  const suggestion = suggestForToday({ pattern, trainingDays, history });
  // Vorschau beginnt MIT heute: dieselbe History wie die suggestion verwenden
  const preview = previewNext({ pattern, trainingDays, history }, 7);
  // Wenn heute bereits bestätigt ist, ersten Vorschau-Eintrag entsprechend ersetzen
  if (existing) preview[0] = { type: existing.type, dayName: existing.dayName };
  res.json({ date, suggestion, confirmed: existing || null, preview, phase: u.phase, goal: u.goal,
    kcal: { train: u.kcal_target_train, rest: u.kcal_target_rest } });
});

// Tag bestätigen/ändern (train mit bestimmtem Tag / rest / sick)
app.post('/api/today/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const { date, type, day_name } = req.body;
  const d = date || new Date().toISOString().slice(0, 10);
  const ex = db.get('SELECT id FROM day_log WHERE user_id=? AND date=?', [uid, d]);
  if (ex) db.run('UPDATE day_log SET type=?,day_name=? WHERE id=?', [type, day_name || null, ex.id]);
  else db.run('INSERT INTO day_log(user_id,date,type,day_name) VALUES(?,?,?,?)', [uid, d, type, day_name || null]);
  res.json({ ok: true });
});

// Interaktiver Kalender: Bereich ab `start` über `days` Tage, mit geplanten Tagen
app.get('/api/calendar/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const u = getUserFull(uid);
  const start = req.query.start || new Date().toISOString().slice(0, 10);
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 35));
  const pattern = u.pattern ? JSON.parse(u.pattern) : buildPattern(u.days_per_week || 4);
  const trainingDays = getTrainingDayNames(uid);
  // Historie = alles strikt vor dem Startdatum; planned = alle Einträge ab Start (heute + Zukunft)
  const allLog = getHistory(uid);
  const history = allLog.filter(h => h.date < start);
  const planned = {};
  for (const h of allLog.filter(h => h.date >= start)) {
    planned[h.date] = { type: h.type, dayName: h.dayName };
  }
  const calendar = calendarRange({ pattern, trainingDays, history, startDate: start, days, planned });
  res.json({ start, days, calendar });
});

// Geplanten Tag wieder entfernen (zurück zum automatischen Rhythmus)
app.delete('/api/today/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'Datum fehlt' });
  db.run('DELETE FROM day_log WHERE user_id=? AND date=?', [uid, date]);
  res.json({ ok: true });
});

// Progression pro Übung: letzte geloggten Sätze + Empfehlung
app.get('/api/progression/:userId/:exerciseId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const exId = Number(req.params.exerciseId);
  const ex = db.get('SELECT * FROM exercises WHERE id=?', [exId]);
  if (!ex) return res.status(404).json({ error: 'Übung nicht gefunden' });
  // Letztes Datum mit Logs für diese Übung (vor heute)
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = db.get('SELECT MAX(date) d FROM set_logs WHERE user_id=? AND exercise_id=? AND date < ?', [uid, exId, today])?.d;
  const lastSets = lastDate
    ? db.all('SELECT set_no,weight,reps FROM set_logs WHERE user_id=? AND exercise_id=? AND date=? ORDER BY set_no', [uid, exId, lastDate])
    : [];
  const rec = recommend(lastSets, ex.target_reps, 2.5);
  // Persönliche Rekorde über ALLE Logs dieser Übung
  const allSets = db.all('SELECT date,weight,reps FROM set_logs WHERE user_id=? AND exercise_id=?', [uid, exId]);
  const prs = personalRecords(allSets);
  res.json({ lastDate, lastSets, recommendation: rec, target_reps: ex.target_reps, prs });
});

// Detail-Verlauf einer Übung: bestes 1RM je Trainingstag (für Chart) + PRs
app.get('/api/exercise-history/:userId/:exerciseId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const exId = Number(req.params.exerciseId);
  const ex = db.get('SELECT * FROM exercises WHERE id=?', [exId]);
  if (!ex) return res.status(404).json({ error: 'Übung nicht gefunden' });
  // pro Datum: bestes geschätztes 1RM und bestes Gewicht
  const rows = db.all('SELECT date,weight,reps FROM set_logs WHERE user_id=? AND exercise_id=? ORDER BY date', [uid, exId]);
  const byDate = {};
  for (const r of rows) {
    const e = estimate1RM(r.weight, r.reps);
    if (!byDate[r.date] || e > byDate[r.date].e1rm) byDate[r.date] = { date: r.date, e1rm: e, weight: r.weight, reps: r.reps };
  }
  const history = Object.values(byDate);
  res.json({ name: ex.name, history, prs: personalRecords(rows) });
});

/* ---------------- NACHRICHTEN ---------------- */
app.get('/api/messages/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  res.json({ messages: db.all(`SELECT m.*, u.name AS from_name FROM messages m
    LEFT JOIN users u ON u.id=m.from_id WHERE m.user_id=? ORDER BY m.created_at DESC LIMIT 50`, [uid]) });
});
// Athlet schreibt seinem Coach
app.post('/api/messages/tocoach', auth, (req, res) => {
  const me = db.get('SELECT coach_id,name FROM users WHERE id=?', [req.user.id]);
  if (!me?.coach_id) return res.status(400).json({ error: 'Dir ist kein Coach zugeordnet' });
  db.run('INSERT INTO messages(user_id,from_id,kind,title,body) VALUES(?,?,?,?,?)',
    [me.coach_id, req.user.id, 'message', req.body.title || ('Nachricht von ' + me.name), req.body.body || '']);
  res.json({ ok: true });
});
app.post('/api/messages/:userId/read', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('UPDATE messages SET read=1 WHERE user_id=?', [uid]);
  res.json({ ok: true });
});
// Coach schickt Nachricht an Athlet
app.post('/api/messages', auth, requireCoach, (req, res) => {
  const { user_id, title, body } = req.body;
  const a = db.get('SELECT coach_id FROM users WHERE id=?', [user_id]);
  if (!a || !coachOwns(req.user, a.coach_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('INSERT INTO messages(user_id,from_id,kind,title,body) VALUES(?,?,?,?,?)',
    [user_id, req.user.id, 'message', title || 'Nachricht vom Coach', body || '']);
  res.json({ ok: true });
});


/* ---------------- BAUSTEIN 1: KALORIEN-TRACKING ---------------- */
// Gegessene Lebensmittel eines Tages + Auswertung gegen Ziel
app.get('/api/foodlog/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = db.all('SELECT * FROM food_log WHERE user_id=? AND date=? ORDER BY created_at', [uid, date]);
  // Ziel je nach Tagtyp
  const u = getUserFull(uid);
  const dayRow = db.get('SELECT type FROM day_log WHERE user_id=? AND date=?', [uid, date]);
  const isTrain = dayRow ? dayRow.type === 'train' : true;
  const target = isTrain ? u.kcal_target_train : u.kcal_target_rest;
  res.json({ date, items: rows, summary: dayNutrition(rows, target), isTrain });
});

app.post('/api/foodlog', auth, (req, res) => {
  const { user_id, date, meal_slot, food, amount, kcal, fat, carbs, protein } = req.body;
  if (!canAccess(req.user, user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const r = db.run(`INSERT INTO food_log(user_id,date,meal_slot,food,amount,kcal,fat,carbs,protein)
    VALUES(?,?,?,?,?,?,?,?,?)`,
    [user_id, date || new Date().toISOString().slice(0, 10), meal_slot, food, amount, kcal, fat, carbs, protein]);
  // Nutzungszähler des Lebensmittels erhöhen (für "häufig zuoberst")
  if (food) db.run('UPDATE foods SET use_count=use_count+1 WHERE name=? AND (owner_id IS NULL OR owner_id=?)', [food, user_id]);
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/foodlog/:id', auth, (req, res) => {
  const row = db.get('SELECT * FROM food_log WHERE id=?', [req.params.id]);
  if (!row || !canAccess(req.user, row.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('DELETE FROM food_log WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// Lebensmittel aus dem Meal-Plan eines Meals direkt als gegessen übernehmen
app.post('/api/foodlog/frommeal/:mealId', auth, (req, res) => {
  const meal = db.get('SELECT * FROM meals WHERE id=?', [req.params.mealId]);
  if (!meal || !canAccess(req.user, meal.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const items = db.all('SELECT * FROM meal_items WHERE meal_id=?', [req.params.mealId]);
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  for (const it of items) {
    db.run(`INSERT INTO food_log(user_id,date,meal_slot,food,amount,kcal,fat,carbs,protein) VALUES(?,?,?,?,?,?,?,?,?)`,
      [meal.user_id, date, meal.label || ('Meal ' + meal.meal_no), it.food, it.amount, it.kcal, it.fat, it.carbs, it.protein]);
  }
  res.json({ ok: true, added: items.length });
});

/* ---------------- BAUSTEIN 2: CARDIO ---------------- */
app.get('/api/cardio/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const date = req.query.date;
  const rows = date
    ? db.all('SELECT * FROM cardio_log WHERE user_id=? AND date=? ORDER BY created_at', [uid, date])
    : db.all('SELECT * FROM cardio_log WHERE user_id=? ORDER BY date DESC LIMIT 100', [uid]);
  res.json({ cardio: rows });
});

app.post('/api/cardio', auth, (req, res) => {
  const { user_id, date, kind, minutes, distance_km, avg_hr, intensity, notes } = req.body;
  if (!canAccess(req.user, user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const u = getUserFull(user_id);
  // Kalorien schätzen, falls nicht angegeben
  let kcal = req.body.kcal;
  if (kcal == null) kcal = estimateCardioKcal({ kind, minutes, intensity, weightKg: u.start_weight });
  const d = date || new Date().toISOString().slice(0, 10);
  const r = db.run(`INSERT INTO cardio_log(user_id,date,kind,minutes,distance_km,avg_hr,kcal,intensity,notes)
    VALUES(?,?,?,?,?,?,?,?,?)`, [user_id, d, kind, minutes, distance_km, avg_hr, kcal, intensity, notes]);
  res.json({ id: r.lastInsertRowid, kcal });
});

app.delete('/api/cardio/:id', auth, (req, res) => {
  const row = db.get('SELECT * FROM cardio_log WHERE id=?', [req.params.id]);
  if (!row || !canAccess(req.user, row.user_id)) return res.status(403).json({ error: 'Kein Zugriff' });
  db.run('DELETE FROM cardio_log WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

/* ---------------- BAUSTEIN 2: RECOVERY ---------------- */
app.get('/api/recovery/:userId', auth, (req, res) => {
  const uid = Number(req.params.userId);
  if (!canAccess(req.user, uid)) return res.status(403).json({ error: 'Kein Zugriff' });
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  // gestern: war Training? harte Cardio-Minuten?
  const yDay = db.get('SELECT type FROM day_log WHERE user_id=? AND date=?', [uid, y]);
  const yCardio = db.all('SELECT minutes,intensity FROM cardio_log WHERE user_id=? AND date=?', [uid, y]);
  const hardMin = yCardio.filter(c => c.intensity === 'hart' || c.intensity === 'moderat').reduce((a, c) => a + (c.minutes || 0), 0);
  // letzter Check-in mit Schlaf
  const ci = db.get('SELECT sleep,sleep_quality FROM checkins WHERE user_id=? AND sleep IS NOT NULL ORDER BY date DESC LIMIT 1', [uid]);
  const rec = recoveryStatus({
    yesterdayWasTraining: yDay?.type === 'train',
    yesterdayHardCardioMin: hardMin,
    sleepHours: ci?.sleep ?? null,
    sleepQuality: ci?.sleep_quality ?? null,
  });
  res.json(rec);
});



// Fallback: alle anderen Routen -> index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Zentraler Fehler-Handler: nie crashen, immer JSON zurückgeben
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Serverfehler: ' + err.message });
});

process.on('uncaughtException', (e) => console.error('[uncaught]', e.message));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e?.message || e));

// Technik-Definitionen (statisch, aus deiner Tabelle)
const DEFINITIONS = [{"term": "Sets", "def": "Anzahl der Sätze in der jeweiligen Übung"}, {"term": "Reps", "def": "Anzahl der Wdh in den jeweiligen Sätzen"}, {"term": "RIR", "def": "RIR = Reps in reserve. So viele Wiederholungen sollst du in den jeweiligen Sätzen noch im Tank lassen. Bsp. RIR 1 = Noch eine Wiederholung am Ende vom Satz im Tank lassen"}, {"term": "Notes", "def": "Hier stehen weitere Informationen zur jeweiligen Übung. Notitzen vor dem Ausfrühren der Übung (grau hinterlegt) und Notizen nach dem Ausführen der Übung (weiß hinterlegt)."}, {"term": "Technique", "def": "Hier können Links zu Technikvideos, Hinweise zur Trainingsintensität oder andere Informationen zur Ausführung der Übung stehen."}, {"term": "Weight", "def": "Hier steht das jeweilige Gewicht welches du verwendet hast"}, {"term": "Reps S.1,2,3,4,5,6,...", "def": "Hier stehen die Wiederholungen die im jeweiligen Satz absolivert hast."}, {"term": "TEMPO \nW,X,Y,Z (Bsp.0,1,2,0)", "def": "TEMPO = die Kadenz des jeweiligen Satzes. Diese wird im Schema (W,X,Y,Z) beschrieben. W=Zeit der Exzentrik der Wdh, X=Zeit im statischen Halten am Punkt der maximalen Exzentrik, Y=Zeit der Konzentrik der Wdh, Z=Zeit im statischen Halten im Punkt der maximalen Konzentrik."}, {"term": "Average RIR", "def": "Gesamt Wiederholungen der jeweiligen Übung"}, {"term": "Session RIR", "def": "Subjektive Wahrnehmung der Intensität der jeweiligen Trainingsheit. Von 0=Mittagsschlaf bis 10=Fast gestorben"}, {"term": "MRP*2", "def": "Ein Satz mit zwei kurzen Pausen (ca. 5 Atemzüge), in jedem Satz wird dabei aufsVersagen trainiert. "}, {"term": "Meso", "def": "Mesozyklus XY (Komplex aus Mikrozyklen/Trainingswochen)"}, {"term": "Soreness", "def": "Ermüdung der Muskelgruppe vor Training (dt. Muskelkater/Ermüdung)"}, {"term": "DB", "def": "Dumbbell (dt. Kurzhantel)"}, {"term": "BB", "def": "Barbell (dt. Langhantel)"}, {"term": "SZ", "def": "SZ-Stange"}, {"term": "SA", "def": "Single Arm (einarmig)"}, {"term": "Widowmaker", "def": "Für einen Widowmaker nimmst du dir ein Gewicht, welches du kontinuierlich (siehe unten) 8-12x bewegen kannst. Nun versuchst du mit diesem Gewicht 15-20 Reps zu erreichen, indem du deinen kontinuierlichen Satz mit Intra-Set Pausen ausweitest. Aus 8-12 wird nun also 8-12 + 2 + 2 + 2 + 1 + 1 + Fail (beispielsweise, das \"+\" steht für Atemzüge)"}, {"term": "Continuous Reps", "def": "Kontinuierliche Wiederholungen sind Reps, die ohne einer sogenannten \"Intra-Set\" Pause ausgeführt werden. Damit sind die Atempausen zwischen den Reps gemeint. Wird ein Satz also \"continous\" ausgeführt, wird dieser ohne Pause im oberen und unteren Punkt ausgeführt. Viel Stimulus in wenig Zeit (und mit wenig Ermüdung)."}, {"term": "Rest Pause", "def": "Ein Rest-Pause Set besteht aus Aktivierungssatz, der in einer Rep Range (bspw. 10-15) ans Versagen durchgeführt wird, gefolgt von Minisätzen, wo wiederholt ans Versagen trainiert wird. Sieht z.B. so aus, dass mit einem Gewicht 12 Reps erzielt und dann 5 tiefe Atemzüge Pause gemacht werden (Gewicht abgelegt) - dann erneut Versagen, etc."}, {"term": "Paired Set", "def": "Ein gepaarter Satz ist kein Supersatz. Du wählst Übungen, die mit einer dazwischenliegenden Pause absolviert werden. Anstann Übung A - Pause - Übung A - Pause, etc. zu machen, führst du Übung A - Pause - Übung B - Pause - Übung A - Pause - etc. durch. Dies hat zur Folge, dass sich die einzelnen Muskelgruppen etwas erholen können."}, {"term": "Drop-Set", "def": "Nach deinem letzten Arbeitssatz reduzierst du das Gewicht um 30% und machst nach rund 10-20s einen weiteren Satz direkt im Anschluss. Dieser muss nicht in der gegebenen Rep Range landen, sondern einfach nur ans Versagen durchgeführt werden. Diese Technik erlaubt für metabolische Reize und ein höheres Volumen."}, {"term": "Double Drop-Set", "def": "Siehe Drop Set - du reduzierst das Gewicht allerdings 2x."}, {"term": "Tripple Drop-Set", "def": "Siehe Drop Set - du reduzierst das Gewicht allerdings 3x."}, {"term": "Partials", "def": "Partials sind inkomplette Wiederholungen. Wenn du ein Gewicht nicht mehr über die volle ROM bewegen kannst, dann bewegst du es also nur mehr so weit, wie du es mit voller Kontrolle (und ohne Schwung) bewegen kannst. Diese Wiederholungen zählst du allerdings nicht und beziehst sie nicht in die \"Progression\" mit ein."}, {"term": "UP", "def": "Umkerpunkt, Wende der Wiederholungsrichtung. "}];

app.listen(PORT, () => {
  console.log(`\n  BE INEVITABLE läuft auf http://localhost:${PORT}\n`);
});

export default app;
