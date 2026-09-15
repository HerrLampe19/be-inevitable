// Mindset-Modul: Priming, Abend-Reflexion, Power-Atmung, Rad des Lebens, Vital-Challenge,
// persönliche Arbeitsblätter, Erinnerungen. Eigenständig gehalten (importiert bewusst NICHT
// schema.js/server.js): Schema, Routen, Stats-Helfer und Cron-Hook werden von dort eingehängt.
//   initMindsetSchema(db)                         -> Tabellen + users-/challenges-Spalten (idempotent)
//   registerMindsetRoutes(app, deps)              -> alle /api/mindset/* Routen
//   mindsetStats(db, uid, ctx?)                   -> Zahlen für /api/insights (XP + Erfolge)
//   mindsetTodayView(db, uid, own, ctx?)          -> Tagesübersicht (auch im Home-Aggregat)
//   buildAutoContext(db, u, fromDate?)            -> Auto-Kontext einer Challenge; ctx? oben = einmal bauen, zweimal nutzen
//   mindsetCron(db, now, { sendPush })            -> stündlicher Erinnerungs-Hook + Challenge-Abschluss
//   sweepChallenges(db, today, push)              -> abgelaufene/komplette Challenges schließen (auch beim Start)
// Grundsatz: GET-Handler sind rein lesend. Zustandsänderungen (z.B. Challenge schließen) passieren nur
// in Schreibpfaden (POST) und im Cron.
import { streakDays, tzToday, tzHour } from './logic.js';

/* ---------------- SCHEMA ---------------- */
export function initMindsetSchema(db) {
  db.exec(`
  -- Sessions: Priming, Abend-Reflexion, Atmung, State-Change, Wochencheck, Frage des Tages
  CREATE TABLE IF NOT EXISTS mindset_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,                      -- ISO-Tag in APP_TZ (Standard Europe/Berlin)
    kind TEXT NOT NULL,                      -- 'priming' | 'evening' | 'breath' | 'state' | 'weekly' | 'question'
    duration_sec INTEGER DEFAULT 0,
    steps_done INTEGER DEFAULT 0,            -- abgeschlossene Player-Schritte
    steps_total INTEGER DEFAULT 0,
    focus TEXT,                              -- JSON-Array, bis zu 3 kurze Strings ("3 to thrive")
    energy INTEGER,                          -- 1..10 optional
    mood INTEGER,                            -- 1..10 optional
    data TEXT,                               -- JSON, je nach kind (weekly: {strong,weak,targets}; question: {id})
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_mindset_sessions_ud ON mindset_sessions(user_id, date);

  -- Rad des Lebens: eine Standortbestimmung pro Zeile (pro Tag höchstens eine, siehe POST /wheel)
  CREATE TABLE IF NOT EXISTS wheel_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    scores TEXT NOT NULL,                    -- JSON {body,emotions,relationships,time,career,finances,contribution} 0..100
    targets TEXT,                            -- JSON gleiche Keys, optional (Wunschstand)
    focus_area TEXT,                         -- Bereich, der zuerst dran ist
    second_area TEXT,                        -- zweiter Bereich
    actions TEXT,                            -- JSON-Array, bis zu 3 Maßnahmen
    feeling_now TEXT,                        -- wie fühlt sich das Leben gerade an
    feeling_target TEXT,                     -- wie fühlt sich das außergewöhnliche Leben an
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Vital-Challenge (10 oder 30 Tage)
  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'vital',
    start_date TEXT NOT NULL,
    days INTEGER NOT NULL DEFAULT 10,        -- 10 | 30
    rules TEXT NOT NULL,                     -- JSON-Array aktiver Regel-IDs
    status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'done' | 'stopped'
    finished_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Persönliche Arbeitsblätter (Glaubenssätze, Incantation, ...): eine Zeile pro Key
  CREATE TABLE IF NOT EXISTS mindset_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,                       -- 'beliefs' | 'incantation' | 'thrive' | 'passion' | 'decisions' | 'vision'
    data TEXT NOT NULL,                      -- JSON-Objekt
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Manuelle Haken pro Challenge-Tag (automatisch erkannte Regeln werden nicht gespeichert)
  CREATE TABLE IF NOT EXISTS challenge_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checks TEXT NOT NULL DEFAULT '{}',       -- JSON {ruleId: true/false}
    UNIQUE(challenge_id, date),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
  );
  `);

  // Idempotente Migration: neue users-Spalten (gleiches Muster wie in schema.js)
  const cols = db.all('PRAGMA table_info(users)').map(c => c.name);
  const addCol = (name, def) => { if (!cols.includes(name)) { try { db.run(`ALTER TABLE users ADD COLUMN ${name} ${def}`); } catch (e) {} } };
  addCol('mindset_push_hour', 'INTEGER');          // Stunde in APP_TZ (Standard Europe/Berlin) der Priming-Erinnerung; NULL = aus
  addCol('evening_push', 'INTEGER DEFAULT 0');     // 1 = Abend-Reflexion-Erinnerung (20 Uhr in APP_TZ)
  addCol('needs_top', 'TEXT');                     // JSON-Array der 2 wichtigsten Grundbedürfnisse
  addCol('priming_minutes', 'INTEGER DEFAULT 10'); // 5 | 10 | 15

  // wheel_assessments: abgehakte Maßnahmen (JSON-Array der Positionen, z.B. [0,2])
  const waCols = db.all('PRAGMA table_info(wheel_assessments)').map(c => c.name);
  if (!waCols.includes('actions_done')) { try { db.run('ALTER TABLE wheel_assessments ADD COLUMN actions_done TEXT'); } catch (e) {} }

  // challenges: Kennzahlen werden beim Abschluss festgeschrieben (kein Neuberechnen alter Challenges bei jedem GET)
  const chCols = db.all('PRAGMA table_info(challenges)').map(c => c.name);
  const addChCol = (name, def) => { if (!chCols.includes(name)) { try { db.run(`ALTER TABLE challenges ADD COLUMN ${name} ${def}`); } catch (e) {} } };
  addChCol('complete_days', 'INTEGER');            // komplette Tage bei Abschluss
  addChCol('adherence_pct', 'INTEGER');            // Adhärenz in % bei Abschluss
}

/* ---------------- KONSTANTEN (identisch im Frontend) ---------------- */
export const WHEEL_AREAS = [
  { key: 'body',          n: 1, label: 'Physischer Körper',            short: 'Körper',      icon: '💪', color: '#e10600' },
  { key: 'emotions',      n: 2, label: 'Gefühle & Bedeutung',          short: 'Gefühle',     icon: '🧠', color: '#bf5af2' },
  { key: 'relationships', n: 3, label: 'Beziehungen',                  short: 'Beziehungen', icon: '❤️', color: '#ff375f' },
  { key: 'time',          n: 4, label: 'Zeit',                         short: 'Zeit',        icon: '⏳', color: '#ff9f0a' },
  { key: 'career',        n: 5, label: 'Arbeit / Karriere / Mission',  short: 'Karriere',    icon: '🎯', color: '#ffd60a' },
  { key: 'finances',      n: 6, label: 'Finanzen',                     short: 'Finanzen',    icon: '💰', color: '#30d158' },
  { key: 'contribution',  n: 7, label: 'Zelebrieren & Beitragen',      short: 'Beitrag',     icon: '🌍', color: '#0a84ff' },
];
const WHEEL_KEYS = WHEEL_AREAS.map(a => a.key);

export const CHALLENGE_RULES = [
  // Geschenke (dir selbst geben)
  { id: 'breath',    group: 'gift',   icon: '🌬️', label: '3× Power-Atmung (1-4-2)',            hint: 'Dreimal am Tag 10 Atemzüge: 1 einatmen · 4 halten · 2 ausatmen (z.B. 5 s / 20 s / 10 s).', auto: 'breath3' },
  { id: 'move',      group: 'gift',   icon: '🤸', label: '20–30 Min. Bewegung / Rebounding',   hint: 'Lymphe aktivieren: Trampolin, Seilspringen, zügiges Gehen.', auto: null },
  // D42: „Hälfte des Körpergewichts" stammt aus der Unzen-Faustregel und ergibt in Kilogramm gelesen
  // das Fünfzehnfache (80 kg → 40 L statt 2,6 L). Die Beschriftung nennt jetzt die Rechnung selbst;
  // die persönliche Zahl steht daneben (challengeSummary.waterTargetL → „Dein Ziel heute ≈ 2,6 L").
  { id: 'water',     group: 'gift',   icon: '💧', label: 'Wasser: rund 0,03 L je kg Körpergewicht', hint: 'Etwa 0,033 L pro Kilogramm Körpergewicht – bei 80 kg sind das rund 2,6 L am Tag. Zitrone rein.', auto: 'water' },
  { id: 'living',    group: 'gift',   icon: '🥗', label: '70 % lebendige, wasserreiche Nahrung', hint: 'Gemüse, Salat, Obst, Sprossen – der Großteil des Tellers.', auto: null },
  { id: 'fats',      group: 'gift',   icon: '🥑', label: 'Gute Fette & Omega-3',               hint: 'Avocado, Oliven, Nüsse, Samen, natives Olivenöl, Fischöl.', auto: null },
  { id: 'alkaline',  group: 'gift',   icon: '🌿', label: 'Basische, mineralstoffreiche Kost',  hint: 'Grünes Blattgemüse, Gemüse, Obst, Nüsse statt säurebildender Lebensmittel.', auto: null },
  { id: 'strength',  group: 'gift',   icon: '🏋️', label: 'Krafttraining (3×/Woche)',           hint: 'Ganzkörper-Krafteinheiten – wird aus deinem Trainingslog erkannt.', auto: 'strength' },
  { id: 'cardio',    group: 'gift',   icon: '🏃', label: '30 Min. Ausdauer (3×/Woche)',         hint: 'Wird aus deinem Cardio-Log erkannt.', auto: 'cardio' },
  { id: 'stretch',   group: 'gift',   icon: '🧘', label: 'Dehnen & Ausrichtung',                hint: 'Nicht den ganzen Tag sitzen: öfter aufstehen, Treppe statt Aufzug, täglich dehnen – beide Seiten und die Gegenspieler-Muskeln.', auto: null },
  { id: 'mind',      group: 'gift',   icon: '🛡️', label: 'Wache am Tor deines Geistes',         hint: 'Stärkende Emotionen bewusst wählen (Dankbarkeit, Mut, Entschlossenheit), Stress-Muster unterbrechen.', auto: null },
  { id: 'heart',     group: 'gift',   icon: '💓', label: '3× Herzfokus',                        hint: 'Dreimal am Tag kurz innehalten und Aufmerksamkeit auf das Herz richten (zusammen mit der Power-Atmung).', auto: 'breath3' },
  { id: 'gratitude', group: 'gift',   icon: '🙏', label: 'Tag mit Dankbarkeit starten & beenden', hint: 'Morgen-Priming + Abend-Reflexion in der App.', auto: 'gratitude' },
  // Gifte (weglassen)
  { id: 'no_procfat', group: 'poison', icon: '🚫', label: 'Keine verarbeiteten Fette',          hint: 'Frittiertes, gehärtete Fette, Fertigprodukte streichen.', auto: null },
  { id: 'no_meat',    group: 'poison', icon: '🥩', label: 'Kein Fleisch (10 Tage)',              hint: 'Optional – passt nicht zu jedem Ernährungsziel. Danach: 3–5×/Woche, saubere Quelle, mit Gemüse.', auto: null, default: false },
  { id: 'no_dairy',   group: 'poison', icon: '🥛', label: 'Milchprodukte reduzieren',            hint: 'Alternativen wie Hafer-, Reis- oder Mandelmilch testen.', auto: null, default: false },
  { id: 'no_acid',    group: 'poison', icon: '☕', label: 'Keine säurebildenden Abhängigkeiten', hint: 'Übermäßiges Koffein, Zucker, Weißmehl/Verarbeitetes, Essig, Alkohol, Nikotin, Drogen.', auto: null },
];
const RULE_BY_ID = Object.fromEntries(CHALLENGE_RULES.map(r => [r.id, r]));
const DEFAULT_RULES = CHALLENGE_RULES.filter(r => r.default !== false).map(r => r.id);

const SESSION_KINDS = ['priming', 'evening', 'breath', 'state', 'weekly', 'question'];
const ENTRY_KEYS = ['beliefs', 'incantation', 'thrive', 'passion', 'decisions', 'vision'];
const NEED_KEYS = ['certainty', 'variety', 'significance', 'connection', 'growth', 'contribution'];
const XP_HINT = { priming: 8, evening: 5, breath: 2, state: 2, weekly: 5, question: 2 };
const BREATH_XP_CAP = 5;       // pro Tag höchstens 5 Atemsessions mit XP (kein Spam)
const CHALLENGE_DONE_PCT = 80; // Zeit abgelaufen: ab dieser Adhärenz gilt die Challenge als 'done'
// Datumsfenster für Schreibzugriffe (kein Nachtragen von XP über Monate, keine Einträge in ferner Zukunft)
const SESSION_PAST_DAYS = 7;   // Sessions: [heute-7, heute+1]
const WHEEL_PAST_DAYS = 365;   // Rad des Lebens: [heute-365, heute+1]
const SESSION_DAY_CAP = 20;    // höchstens 20 Zeilen je (Nutzer, Tag, Art)
const ERR_DATE_RANGE = 'Datum außerhalb des erlaubten Zeitraums';

/* ---------------- VOLLWERTIG ODER ÜBERSPRUNGEN (B16) ----------------
Bis 2.4.0 zählte jede gespeicherte Zeile: sechsmal „Überspringen" in einer Sekunde ergaben
duration_sec 1, steps_done 0 – und trotzdem XP, Streak und einen grünen Kalenderpunkt. Damit war
jede Zahl des Moduls wertlos, für den Athleten wie für den Coach. Ein Ritual zählt jetzt erst,
wenn es wirklich stattgefunden hat:
  Priming, Weg 1 (durchgelaufen): mindestens FULL_TIME_RATIO der gewählten Dauer – 180 / 360 / 540 s
           bei 5 / 10 / 15 Minuten.
  Priming, Weg 2 (bewusst abgekürzt, aber echt): mindestens PRIMING_MIN_STEPS der 6 Schritte UND
           eine Dauer, die dazu passt – mindestens PRIMING_STEP_TIME_RATIO der gewählten Dauer
           (105 / 210 / 315 s) und mindestens SEC_PER_STEP_MIN Sekunden je gemeldetem Schritt.
           Bis 2.5.0 zählte hier die Schrittzahl allein. Das hatte zwei Folgen: die Zeitregel griff
           nie (der Schrittweg war bei jeder Einstellung deutlich früher erreicht), und sechs
           Schritte in einer Sekunde galten als vollwertig – über die Oberfläche nicht erreichbar,
           über die Offline-Ablage oder eine selbstgebaute Anfrage sehr wohl.
  Abend-Reflexion: mindestens EVENING_MIN_SEC (vier Fragen, nominal 2 Minuten).
Der Player gibt einen Schritt erst nach der Hälfte seiner Planzeit frei (MD_STEP_GATE): der
schnellste ehrliche Durchlauf über vier Schritte dauert 110 / 219 / 329 s und bleibt damit auf
allen drei Einstellungen vollwertig.
Alles darunter wird gespeichert, gilt aber als übersprungen (`full:false`): kein XP, kein Streak,
grauer Kalenderpunkt, und der Coach sieht „übersprungen".
Die Schwellen sind gewählt, nicht aus Literatur abgeleitet. [gesetzt, nicht belegt] */
const FULL_TIME_RATIO = 0.6;
const PRIMING_MIN_STEPS = 4;           // von 6 Schritten
const PRIMING_STEP_TIME_RATIO = 0.35;  // Schrittweg: gut ein Drittel der gewählten Dauer muss trotzdem gelaufen sein
const SEC_PER_STEP_MIN = 10;           // je gemeldetem Schritt mindestens 10 s – ein Schritt in 0 s gibt es nicht
// `export`, weil `src/server.js` dieselbe Regel braucht (siehe PRIMING_FULL_SQL weiter unten).
export const EVENING_MIN_SEC = 45;
const EVENING_PLAN_SEC = 120;     // Abend-Reflexion: 4 Fragen à ~30 s
const DEFAULT_PRIMING_MIN = 10;
const primingMin = m => ([5, 10, 15].includes(Number(m)) ? Number(m) : DEFAULT_PRIMING_MIN);
// Planzeit einer Sitzung in Sekunden (minutes = gewählte Priming-Dauer 5/10/15)
function planSecOf(kind, minutes) {
  if (kind === 'priming') return primingMin(minutes) * 60;
  if (kind === 'evening') return EVENING_PLAN_SEC;
  return 0;
}
// Die Zeit-Untergrenze einer Art – auch als SQL-Parameter verwendbar (Streak-/XP-Abfragen)
const fullSecOf = (kind, minutes) => (kind === 'evening' ? EVENING_MIN_SEC : Math.round(planSecOf(kind, minutes) * FULL_TIME_RATIO));
// Zeit-Untergrenze des Schrittwegs beim Priming – skaliert mit der gewählten Dauer, sonst wäre der
// Schrittweg bei 15 Minuten dreimal so mild wie bei 5 Minuten (auch als SQL-Parameter nutzbar).
const stepPathSecOf = (minutes) => Math.round(planSecOf('priming', minutes) * PRIMING_STEP_TIME_RATIO);
// Dieselbe Regel in Zahlen für die Oberfläche. Bis 2.5.0 stand im Abschluss-Sheet „ab der halben
// Zeit", gezählt wurde aber ab FULL_TIME_RATIO = 60 % – der Satz stand ausgerechnet dort, wo gerade
// stand, dass der Durchlauf nicht zählt. Die Oberfläche kopiert die Schwellen deshalb nicht mehr,
// sie bekommt sie hier; so kann der Text gar nicht mehr von der Regel abweichen.
function fullRuleOf(kind, minutes) {
  if (kind === 'priming') return { kind, full_sec: fullSecOf('priming', minutes), min_steps: PRIMING_MIN_STEPS, steps_total: 6, step_path_sec: stepPathSecOf(minutes), sec_per_step: SEC_PER_STEP_MIN };
  if (kind === 'evening') return { kind, full_sec: EVENING_MIN_SEC };
  return { kind, full_sec: 0 };
}
// Dieselbe Priming-Regel als SQL-Ausdruck: Streak-, XP- und Kalender-Abfragen aggregieren weiter in
// SQL und dürfen dabei nicht von isFullSession abweichen – darum nur diese eine Quelle.
//
// A-V.5 (DEFER-A1 B16-Rest/a, bestätigt in DEFER-A4): `export`, damit `src/server.js` die Regel
// IMPORTIEREN statt ABSCHREIBEN kann. Zwei Zähler dort zählen den Wochenrückblick noch roh
// (`challengeCompleteDaysIn` und der `COUNT(DISTINCT date) … GROUP BY kind`); ein durchgeklicktes
// Priming steht deshalb im Sonntagsrückblick als Priming-Tag, während die Mindset-Ansicht es als
// „übersprungen" zeigt. Die Reparatur ist dort zwei Zeilen:
//   import { PRIMING_FULL_SQL, primingFullArgs, EVENING_MIN_SEC } from './mindset.js';
//   … AND ${PRIMING_FULL_SQL}  mit  [..., ...primingFullArgs(minutes)]   bzw.
//   … AND duration_sec>=?      mit  [..., EVENING_MIN_SEC]
// Eine dritte Kopie der Bedingung wäre genau die Krankheit, vor der DEFER-A1 wörtlich warnt.
// `src/server.js` gehört diesem Paket nicht – hier steht nur die Hälfte, die hier hingehört.
export const PRIMING_FULL_SQL = '(duration_sec>=? OR (steps_done>=? AND duration_sec>=? AND duration_sec>=steps_done*?))';
export const primingFullArgs = (minutes) => [fullSecOf('priming', minutes), PRIMING_MIN_STEPS, stepPathSecOf(minutes), SEC_PER_STEP_MIN];
// Vollwertig? Arten ohne eigene Regel (Atmung, State-Change, Wochencheck, Frage) gelten als vollwertig.
function isFullSession(row, minutes) {
  if (!row) return false;
  const dur = Number(row.duration_sec) || 0, steps = Number(row.steps_done) || 0;
  // Der Schrittweg braucht beides: genug Schritte UND eine Dauer, die dazu passt. Sonst ist die
  // gemeldete Schrittzahl nur eine Behauptung (B16 / Prüfbefund 2.5.0).
  if (row.kind === 'priming') return dur >= fullSecOf('priming', minutes)
    || (steps >= PRIMING_MIN_STEPS && dur >= stepPathSecOf(minutes) && dur >= steps * SEC_PER_STEP_MIN);
  if (row.kind === 'evening') return dur >= EVENING_MIN_SEC;
  return true;
}

/* ---------------- KLEINE HELFER ---------------- */
// „Heute" in APP_TZ (Standard Europe/Berlin) – dieselbe Quelle wie der übrige Server (tzToday), nicht UTC
const todayISO = (now) => tzToday(now || new Date());
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const isISO = s => typeof s === 'string' && ISO_RE.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isoAddDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const round1 = x => Math.round(x * 10) / 10;

// Zahlen werden laut Spezifikation (§4 „validate & clamp") auf den gültigen Bereich begrenzt, nicht abgelehnt.
function clampNum(v, min, max, asInt) {
  if (v === undefined || v === null || v === '') return null;
  let n = Number(v);
  if (!isFinite(n)) return null;
  n = Math.max(min, Math.min(max, n));
  return asInt ? Math.round(n) : n;
}
// String trimmen, HTML-Tags und Spitzklammern entfernen (wie str() in server.js) + kürzen; leer -> null
function str(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
  return s ? s.slice(0, max) : null;
}
// Array kurzer Strings (leere raus, Anzahl + Länge begrenzt) – für echte Listen
function strArr(v, maxItems, maxLen) {
  if (!Array.isArray(v)) return [];
  return v.map(x => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}
function parseJSON(s, fallback) {
  if (s === null || s === undefined) return fallback;
  try { const v = JSON.parse(s); return v === null ? fallback : v; } catch { return fallback; }
}
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// minutes = gewählte Priming-Dauer des Nutzers (für die Vollwertigkeits-Grenze); fehlt sie, gilt die Standarddauer.
// `full` ist bewusst KEIN privates Feld: der Coach soll sehen, ob ein Ritual wirklich stattgefunden hat.
function rowSession(r, minutes) {
  if (!r) return null;
  return { ...r, focus: parseJSON(r.focus, []), data: parseJSON(r.data, null), full: isFullSession(r, minutes) };
}
// Privatsphäre: Freitext einer Session (Notiz, Payload, Fokus-Ziele) sieht nur der Nutzer selbst
const PRIVATE_SESSION_FIELDS = ['note', 'data', 'focus'];
function privSession(s) {
  if (!s) return s;
  const o = { ...s };
  for (const k of PRIVATE_SESSION_FIELDS) delete o[k];
  return o;
}
function fullYears(dob, today) {
  if (!dob) return null;
  const b = new Date(String(dob).slice(0, 10) + 'T00:00:00Z'); if (isNaN(b)) return null;
  const t = new Date(today + 'T00:00:00Z');
  let age = t.getUTCFullYear() - b.getUTCFullYear();
  const m = t.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && t.getUTCDate() < b.getUTCDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}
// Aerobe Herzfrequenz-Zone (Faustformel nach Alter) für den Cardio-Hinweis der Challenge
function hrZoneOf(u, today) {
  const age = fullYears(u?.dob, today);
  if (age == null) return null;
  return { age, lo: 170 - age, hi: 180 - age, wlo: 130 - age, whi: 140 - age };
}
function prefsOf(u) {
  return {
    mindset_push_hour: u?.mindset_push_hour == null ? null : Number(u.mindset_push_hour),
    evening_push: u?.evening_push ? 1 : 0,
    priming_minutes: [5, 10, 15].includes(Number(u?.priming_minutes)) ? Number(u.priming_minutes) : 10,
    needs_top: strArr(parseJSON(u?.needs_top, []), 2, 40).filter(k => NEED_KEYS.includes(k)),
  };
}

/* ---------------- RAD DES LEBENS: KENNZAHLEN ---------------- */
function wheelStats(scores) {
  const vals = WHEEL_KEYS.map(k => Number(scores[k]) || 0);
  const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  const min = Math.min(...vals), max = Math.max(...vals);
  const weakest = WHEEL_KEYS[vals.indexOf(min)];
  return { avg, min, max, balance: Math.round(100 - (max - min)), weakest };
}
function wheelDelta(scores, prevScores) {
  if (!prevScores) return null;
  const d = {};
  for (const k of WHEEL_KEYS) d[k] = (Number(scores[k]) || 0) - (Number(prevScores[k]) || 0);
  return d;
}
function rowWheel(r) {
  const scores = parseJSON(r.scores, {});
  return { id: r.id, date: r.date, scores, targets: parseJSON(r.targets, null), focus_area: r.focus_area, second_area: r.second_area,
    actions: parseJSON(r.actions, []), actions_done: parseJSON(r.actions_done, []), feeling_now: r.feeling_now, feeling_target: r.feeling_target, note: r.note, created_at: r.created_at,
    ...wheelStats(scores) };
}
// Privatsphäre: Freitext einer Bewertung sieht nur der Nutzer selbst – die Gefühls-Texte, die Notiz UND die
// selbst formulierten Maßnahmen (actions) samt Abhak-Stand (actions_done, sonst wäre die Liste über die
// Indizes rekonstruierbar). Der Coach bekommt Zahlen und Stufen: scores, targets, Fokusbereiche, avg/balance.
// Dieselbe Grenze wie bei Sessions (PRIVATE_SESSION_FIELDS) und wie in MINDSET.md zugesagt.
const PRIVATE_WHEEL_FIELDS = ['feeling_now', 'feeling_target', 'note', 'actions', 'actions_done'];
function privWheel(a) {
  if (!a) return a;
  const o = { ...a };
  for (const k of PRIVATE_WHEEL_FIELDS) delete o[k];
  return o;
}
function lastWheel(db, uid) {
  const r = db.get('SELECT * FROM wheel_assessments WHERE user_id=? ORDER BY date DESC, id DESC LIMIT 1', [uid]);
  return r ? rowWheel(r) : null;
}
// Letzte Bewertung VOR einem Datum (Vergleichsbasis für delta) – optional eine Zeile ausnehmen (beim Bearbeiten)
function prevWheel(db, uid, beforeDate, excludeId) {
  const r = db.get('SELECT * FROM wheel_assessments WHERE user_id=? AND date<? AND id!=? ORDER BY date DESC, id DESC LIMIT 1', [uid, beforeDate, excludeId || 0]);
  return r ? rowWheel(r) : null;
}

/* ---------------- CHALLENGE: AUTOMATISCHE ERKENNUNG ---------------- */
// Wassertagesziel: ≈ 0,033 L je kg (letztes Check-in-Gewicht, sonst Startgewicht), sonst Wasserziel/3 L.
function waterTargetL(db, u) {
  const w = db.get('SELECT weight FROM checkins WHERE user_id=? AND weight IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1', [u.id])?.weight || u.start_weight;
  if (w && w > 0) return round1(w * 0.033);
  return round1(Number(u.water_goal) || 3);
}
// Untergrenze für den Auto-Kontext: der früheste Starttag aller Challenges des Nutzers, die noch LIVE gerechnet
// werden – die aktive, und beendete Zeilen aus der Zeit vor complete_days/adherence_pct (der Cron trägt die
// Werte nach, bis dahin rechnet pastEntryOf sie live). Beendete Challenges mit festgeschriebenen Kennzahlen
// brauchen den Kontext nicht mehr. Gibt es nichts Lebendiges, reicht heute (Wasser von heute für /challenge).
// Bewusst nicht „heute minus 30": eine alte, noch nicht nachgetragene Challenge bekäme sonst stillschweigend
// 0 komplette Tage, und die XP-Zahl fiele sichtbar.
function ctxFloor(db, uid, today) {
  const m = db.get("SELECT MIN(start_date) m FROM challenges WHERE user_id=? AND (status='active' OR complete_days IS NULL OR adherence_pct IS NULL)", [uid])?.m;
  return m && isISO(m) && m < today ? m : today;
}
// Lädt alle Datenquellen der Auto-Regeln EINMAL pro Nutzer (Maps pro Datum), damit Tages- und
// Verlaufsberechnung ohne weitere Abfragen in Speicher laufen.
// Nur ab fromDate (Standard: ctxFloor): eine Challenge läuft 10–30 Tage, die Auto-Erkennung und countInWeek
// bewegen sich nie vor ihrem Starttag. Ohne Grenze wuchsen die vier Abfragen mit dem Kontoalter (3 Jahre:
// 7,8 ms je Aufbau, 6 Jahre: 13,2 ms – begrenzt 0,07 / 0,15 ms) und liefen je /api/home zweimal.
// Exportiert, damit /api/home den Kontext einmal bauen und an mindsetTodayView/mindsetStats durchreichen kann.
export function buildAutoContext(db, u, fromDate) {
  const uid = u.id;
  const from = fromDate && isISO(fromDate) ? fromDate : ctxFloor(db, uid, todayISO());
  const ctx = { breathByDate: {}, primingDates: new Set(), eveningDates: new Set(), setDates: new Set(), cardioDates: new Set(), waterByDate: {}, waterTarget: waterTargetL(db, u), from };
  // Auch die Challenge-Regel „Tag mit Dankbarkeit starten & beenden" zählt nur vollwertige Rituale (B16):
  // sonst brächte ein durchgeklicktes Priming weiterhin komplette Challenge-Tage und damit XP.
  // MAX() je (Tag, Art) heißt: der beste Durchlauf des Tages entscheidet – wie bei sessionOn().
  const mins = prefsOf(u).priming_minutes;
  for (const r of db.all("SELECT date, kind, COUNT(*) c, MAX(duration_sec) d, MAX(steps_done) s FROM mindset_sessions WHERE user_id=? AND kind IN ('breath','priming','evening') AND date>=? GROUP BY date, kind", [uid, from])) {
    if (r.kind === 'breath') ctx.breathByDate[r.date] = r.c;
    else if (!isFullSession({ kind: r.kind, duration_sec: r.d, steps_done: r.s }, mins)) continue;
    else if (r.kind === 'priming') ctx.primingDates.add(r.date);
    else ctx.eveningDates.add(r.date);
  }
  for (const r of db.all('SELECT DISTINCT date FROM set_logs WHERE user_id=? AND reps>0 AND date>=?', [uid, from])) ctx.setDates.add(r.date); // reps>0: Phantom-Sätze zählen nicht als Training
  for (const r of db.all('SELECT DISTINCT date FROM cardio_log WHERE user_id=? AND date>=?', [uid, from])) ctx.cardioDates.add(r.date);
  for (const r of db.all('SELECT date, water FROM checkins WHERE user_id=? AND water IS NOT NULL AND date>=?', [uid, from])) ctx.waterByDate[r.date] = Number(r.water) || 0;
  return ctx;
}
const countInWeek = (set, weekStart, upTo) => { let n = 0; for (let i = 0; i < 7; i++) { const d = isoAddDays(weekStart, i); if (d > upTo) break; if (set.has(d)) n++; } return n; };

// Ein Challenge-Tag: manuelle Haken + automatisch erkannte Regeln -> done/total/complete
function buildDay(ctx, ruleIds, date, weekStart, checks, dayIndex) {
  const auto = {}, partial = {}, detail = {};
  for (const id of ruleIds) {
    const rule = RULE_BY_ID[id]; if (!rule || !rule.auto) continue;
    switch (rule.auto) {
      case 'breath3': { const c = ctx.breathByDate[date] || 0; auto[id] = c >= 3; detail[id] = { count: c, target: 3 }; break; }
      case 'water': { const l = ctx.waterByDate[date]; auto[id] = l != null && l >= ctx.waterTarget; detail[id] = { liters: l == null ? 0 : l, target: ctx.waterTarget }; break; }
      case 'strength': { auto[id] = ctx.setDates.has(date); detail[id] = { weekCount: countInWeek(ctx.setDates, weekStart, date), weekTarget: 3 }; break; }
      case 'cardio': { auto[id] = ctx.cardioDates.has(date); detail[id] = { weekCount: countInWeek(ctx.cardioDates, weekStart, date), weekTarget: 3 }; break; }
      case 'gratitude': {
        const p = ctx.primingDates.has(date), e = ctx.eveningDates.has(date);
        auto[id] = p && e; if ((p || e) && !(p && e)) partial[id] = true;
        detail[id] = { priming: p, evening: e }; break;
      }
    }
  }
  const total = ruleIds.length;
  let done = 0;
  for (const id of ruleIds) if (checks[id] === true || auto[id] === true) done++;
  return { date, dayIndex, checks, auto, partial, detail, done, total, complete: total > 0 && done === total, pct: total ? Math.round(done / total * 100) : 0 };
}

const endDateOf = ch => isoAddDays(ch.start_date, (Number(ch.days) || 10) - 1);

// Vollständige Sicht auf eine Challenge (Tag heute, Verlauf, Adhärenz).
// Beendete Challenges werden bis zum Abschlusstag gerechnet – die Adhärenz einer gestoppten
// Challenge „friert" also ein und sinkt nicht mit jedem weiteren Kalendertag.
function challengeSummary(db, ch, ctx, today) {
  const ruleIds = strArr(parseJSON(ch.rules, []), 40, 40).filter(id => RULE_BY_ID[id]);
  const start = ch.start_date, days = Number(ch.days) || 10;
  const endDate = isoAddDays(start, days - 1);
  const finishedDay = ch.status !== 'active' && ch.finished_at ? String(ch.finished_at).slice(0, 10) : null;
  const upTo = finishedDay && isISO(finishedDay) && finishedDay < today ? finishedDay : today;
  const offset = daysBetween(start, upTo);                        // 0 = erster Tag
  const daysElapsed = Math.max(0, Math.min(days, offset + 1));
  const dayIndex = Math.max(0, Math.min(days, offset + 1));
  const stored = {};
  for (const r of db.all('SELECT date, checks FROM challenge_days WHERE challenge_id=?', [ch.id])) stored[r.date] = parseJSON(r.checks, {});
  const history = [];
  for (let i = 0; i < daysElapsed; i++) {
    const date = isoAddDays(start, i);
    const weekStart = isoAddDays(start, 7 * Math.floor(i / 7));
    history.push(buildDay(ctx, ruleIds, date, weekStart, isObj(stored[date]) ? stored[date] : {}, i + 1));
  }
  const sumDone = history.reduce((s, d) => s + d.done, 0), sumTotal = history.reduce((s, d) => s + d.total, 0);
  const completeDays = history.filter(d => d.complete).length;
  return {
    id: ch.id, kind: ch.kind, start_date: start, days, rules: ruleIds, status: ch.status, finished_at: ch.finished_at,
    dayIndex, endDate, daysElapsed, over: today > endDate,
    today: history.find(d => d.date === today) || null,
    history, adherencePct: sumTotal ? Math.round(sumDone / sumTotal * 100) : 0, completeDays,
    waterTargetL: ctx.waterTarget,
  };
}
const pastEntry = s => ({ id: s.id, kind: s.kind, start_date: s.start_date, endDate: s.endDate, days: s.days, status: s.status, finished_at: s.finished_at, completeDays: s.completeDays, adherencePct: s.adherencePct });
// Kennzahlen einer beendeten Challenge: beim Abschluss festgeschrieben (complete_days/adherence_pct); Zeilen aus
// der Zeit vor diesen Spalten werden live gerechnet (der Cron trägt die Werte einmalig nach, GET bleibt lesend)
function pastEntryOf(db, ch, ctxOf, today) {
  if (ch.complete_days != null && ch.adherence_pct != null) {
    return { id: ch.id, kind: ch.kind, start_date: ch.start_date, endDate: endDateOf(ch), days: Number(ch.days) || 10, status: ch.status,
      finished_at: ch.finished_at, completeDays: Number(ch.complete_days), adherencePct: Number(ch.adherence_pct) };
  }
  return pastEntry(challengeSummary(db, ch, ctxOf(), today));
}
// Abschluss festschreiben: Status, Zeitpunkt und Kennzahlen (Quelle für die „Vergangene"-Liste und die Stats)
function finishChallenge(db, id, status, s) {
  db.run("UPDATE challenges SET status=?, finished_at=datetime('now'), complete_days=?, adherence_pct=? WHERE id=?", [status, s.completeDays, s.adherencePct, id]);
}
const donePush = s => ({ title: '🏆 Challenge geschafft', body: `${s.days} Tage Vital-Challenge durchgezogen – ${s.completeDays}/${s.days} Tage komplett. Stark.`, url: '/#mindset/challenge' });
const lastDayComplete = s => s.completeDays === s.days || !!(s.history[s.days - 1] && s.history[s.days - 1].complete);

// Aktive Challenges eines Nutzers abschließen – NUR aus Schreibpfaden (POST) und dem Cron, nie aus GET:
//  - letzter Tag komplett (auch heute, z.B. wenn die letzte Regel automatisch erkannt wurde) -> 'done' + Push
//  - Zeitraum abgelaufen: ab CHALLENGE_DONE_PCT Adhärenz 'done', sonst 'stopped' (kein Push)
// Ohne das bliebe eine vergessene Challenge ewig aktiv (und blockierte einen Neustart). Liefert die geschlossenen.
function closeExpiredChallenges(db, u, ctx, today, push) {
  const closed = [];
  for (const ch of db.all("SELECT * FROM challenges WHERE user_id=? AND status='active'", [u.id])) {
    const endDate = endDateOf(ch);
    if (today < endDate) continue;
    const s = challengeSummary(db, ch, ctx, today);
    const complete = lastDayComplete(s);
    if (today === endDate && !complete) continue; // letzter Tag läuft noch
    const status = complete || (today > endDate && s.adherencePct >= CHALLENGE_DONE_PCT) ? 'done' : 'stopped';
    finishChallenge(db, ch.id, status, s);
    if (status === 'done' && push) push(u.id, donePush(s));
    closed.push({ ...s, status });
  }
  return closed;
}
// Systemweiter Durchlauf (Cron + Serverstart): alle Nutzer mit fälligen aktiven Challenges,
// zusätzlich Kennzahlen alter, schon beendeter Zeilen ohne gespeicherte Werte einmalig nachtragen.
export function sweepChallenges(db, today, push) {
  today = today || todayISO();
  const users = new Set();
  for (const ch of db.all("SELECT id, user_id, start_date, days FROM challenges WHERE status='active'")) if (today >= endDateOf(ch)) users.add(ch.user_id);
  for (const ch of db.all("SELECT user_id FROM challenges WHERE status!='active' AND (complete_days IS NULL OR adherence_pct IS NULL) LIMIT 200")) users.add(ch.user_id);
  let closed = 0;
  for (const uid of users) {
    try {
      const u = db.get('SELECT * FROM users WHERE id=?', [uid]); if (!u) continue;
      const ctx = buildAutoContext(db, u);
      closed += closeExpiredChallenges(db, u, ctx, today, push).length;
      for (const ch of db.all("SELECT * FROM challenges WHERE user_id=? AND status!='active' AND (complete_days IS NULL OR adherence_pct IS NULL)", [uid])) {
        const s = challengeSummary(db, ch, ctx, today);
        db.run('UPDATE challenges SET complete_days=?, adherence_pct=? WHERE id=?', [s.completeDays, s.adherencePct, ch.id]);
      }
    } catch (e) {}
  }
  return closed;
}

/* ---------------- ARBEITSBLÄTTER: FORM JE KEY ---------------- */
// type 'str' = Freitext, 'arr' = Liste kurzer Strings (leere fliegen raus), 'slots' = feste Plätze
// (leere bleiben als '' erhalten, nur nachlaufende leere werden gekappt – das Formular rendert nach Index),
// 'objarr' = Liste von Objekten mit Strings, 'dates' = Liste ISO-Daten (dedupliziert, sortiert, die letzten n)
const ENTRY_SHAPES = {
  beliefs:     { old: { type: 'slots', max: 3 }, new: { type: 'slots', max: 3 }, health_limiting: { type: 'slots', max: 2 }, health_empowering: { type: 'slots', max: 2 } },
  incantation: { lines: { type: 'arr', max: 8 }, spoken_dates: { type: 'dates', max: 60 } },
  thrive:      { decisions: { type: 'objarr', max: 2, fields: ['text', 'impact'] }, immediate: { type: 'str' }, actions: { type: 'slots', max: 5 } },
  passion:     { love: { type: 'str' }, hate: { type: 'str' }, passion: { type: 'str' }, want: { type: 'str' } },
  vision:      { extraordinary: { type: 'str' }, obstacles: { type: 'str' }, change: { type: 'str' } },
  decisions:   { items: { type: 'arr', max: 10 }, note: { type: 'str' } },
};
function sanitizeEntry(key, body) {
  const shape = ENTRY_SHAPES[key], out = {};
  for (const f in shape) {
    const def = shape[f], v = body[f];
    if (def.type === 'str') out[f] = str(v, 1000) || '';
    else if (def.type === 'arr') out[f] = strArr(v, Math.min(def.max || 10, 10), 200);
    else if (def.type === 'slots') {
      const a = (Array.isArray(v) ? v : []).slice(0, Math.min(def.max || 10, 10)).map(x => str(x, 200) || '');
      while (a.length && !a[a.length - 1]) a.pop();
      out[f] = a;
    }
    else if (def.type === 'dates') out[f] = [...new Set(strArr(v, 400, 10).filter(isISO))].sort().slice(-def.max);
    else if (def.type === 'objarr') out[f] = (Array.isArray(v) ? v : []).filter(isObj)
      .map(o => Object.fromEntries(def.fields.map(k => [k, str(o[k], 200) || ''])))
      .filter(o => def.fields.some(k => o[k])).slice(0, Math.min(def.max || 10, 10));
  }
  return out;
}

/* ---------------- STATS FÜR /api/insights ---------------- */
// Die users-Spalten, die dieses Modul wirklich liest (waterTargetL, hrZoneOf, prefsOf). Kein SELECT *:
// die Spalte avatar (bis 0,5 MB Base64) würde sonst bei jedem /api/home mitgelesen, ohne je gebraucht zu werden.
const USER_COLS = 'id, dob, start_weight, water_goal, mindset_push_hour, evening_push, priming_minutes, needs_top';
// Rein lesend: beendete Challenges kommen aus den festgeschriebenen Spalten, nur die aktive wird live gerechnet.
// Alle Zahlen sind bewusst All-Time (XP/Erfolge) – begrenzen lässt sich hier nichts, ohne eine angezeigte Zahl
// zu ändern. Deshalb wird in SQL aggregiert statt jede (Tag, Art)-Zeile nach JS zu holen (3 Jahre: 3,9 → 2,2 ms).
// ctx (optional): ein von /api/home schon gebauter Auto-Kontext desselben Nutzers – spart den zweiten Aufbau.
export function mindsetStats(db, uid, ctx) {
  const today = todayISO();
  const u = db.get(`SELECT ${USER_COLS} FROM users WHERE id=?`, [uid]);
  // je Art: Anzahl Tage (DISTINCT date) und Anzahl Sessions – entspricht dem früheren GROUP BY date, kind + Zählen in JS
  const byKind = {};
  for (const r of db.all('SELECT kind, COUNT(DISTINCT date) d, COUNT(*) n FROM mindset_sessions WHERE user_id=? GROUP BY kind', [uid])) byKind[r.kind] = r;
  const days = kind => byKind[kind]?.d || 0;
  // XP und Streak zählen nur vollwertige Rituale (B16) – die Grenze steckt direkt in der Abfrage,
  // damit weiterhin in SQL aggregiert wird und nicht jede Zeile nach JS wandert.
  const pMins = prefsOf(u).priming_minutes;
  const primingDates = db.all(`SELECT DISTINCT date FROM mindset_sessions WHERE user_id=? AND kind='priming' AND ${PRIMING_FULL_SQL}`,
    [uid, ...primingFullArgs(pMins)]).map(r => r.date);
  const breathSessions = byKind.breath?.n || 0;
  // je Tag höchstens BREATH_XP_CAP Atemsessions mit XP: SUM(MIN(c, cap)) über die Tagesgruppen
  const breathXpUnits = db.get("SELECT COALESCE(SUM(MIN(c, ?)), 0) u FROM (SELECT COUNT(*) c FROM mindset_sessions WHERE user_id=? AND kind='breath' GROUP BY date)", [BREATH_XP_CAP, uid]).u;
  const primingDays = primingDates.length;
  const eveningDays = db.get("SELECT COUNT(DISTINCT date) d FROM mindset_sessions WHERE user_id=? AND kind='evening' AND duration_sec>=?", [uid, EVENING_MIN_SEC]).d;
  const stateDays = days('state'), questionDays = days('question'), weeklyChecks = days('weekly');
  const wheelCount = db.get('SELECT COUNT(*) c FROM wheel_assessments WHERE user_id=?', [uid]).c;
  let challengesDone = 0, challengeDaysComplete = 0;
  if (u) {
    const ctxOf = () => (ctx = ctx || buildAutoContext(db, u));
    for (const ch of db.all('SELECT * FROM challenges WHERE user_id=?', [uid])) {
      if (ch.status === 'done') challengesDone++;
      challengeDaysComplete += ch.status === 'active' ? challengeSummary(db, ch, ctxOf(), today).completeDays : pastEntryOf(db, ch, ctxOf, today).completeDays;
    }
  }
  const xp = primingDays * 8 + eveningDays * 5 + breathXpUnits * 2 + wheelCount * 30 + challengeDaysComplete * 10 + challengesDone * 200
    + stateDays * 2 + questionDays * 2 + weeklyChecks * 5;
  return { primingDays, primingStreak: streakDays(primingDates, today), eveningDays, breathSessions, breathXpUnits,
    stateDays, questionDays, weeklyChecks, wheelCount, challengesDone, challengeDaysComplete, xp };
}

/* ---------------- ROUTEN ---------------- */
// Mindset-Tagesübersicht eines Nutzers (Priming/Abend/Atmung heute, Streak, Rad-Status, aktive Challenge,
// Einstellungen). own=false (Coach schaut) blendet Freitexte aus (privSession). null, wenn der Nutzer fehlt.
// Genutzt von GET /api/mindset/today/:userId UND vom Home-Aggregat GET /api/home/:userId.
// ctx (optional): ein schon gebauter Auto-Kontext desselben Nutzers (siehe buildAutoContext), sonst wird er hier gebaut.
export function mindsetTodayView(db, uid, own, ctx) {
  const u = db.get(`SELECT ${USER_COLS} FROM users WHERE id=?`, [uid]); if (!u) return null;
  const prefs = prefsOf(u);
  const sess = s => (own ? s : privSession(s));
  const sessionOn = kind => rowSession(db.get('SELECT * FROM mindset_sessions WHERE user_id=? AND kind=? AND date=? ORDER BY steps_done DESC, duration_sec DESC, id DESC LIMIT 1', [uid, kind, date]), prefs.priming_minutes);
  const countOn = kind => db.get('SELECT COUNT(*) c FROM mindset_sessions WHERE user_id=? AND kind=? AND date=?', [uid, kind, date]).c;
  const date = todayISO();
  // Streak und 30-Tage-Zähler kennen nur vollwertige Primings (B16) – ein durchgeklicktes zählt nicht
  const primingDates = db.all(`SELECT DISTINCT date FROM mindset_sessions WHERE user_id=? AND kind='priming' AND date<=? AND ${PRIMING_FULL_SQL} ORDER BY date DESC LIMIT 400`,
    [uid, date, ...primingFullArgs(prefs.priming_minutes)]).map(r => r.date);
  const primingDays30 = primingDates.filter(d => d >= isoAddDays(date, -29)).length;
  const last = lastWheel(db, uid);
  const daysSince = last ? Math.max(0, daysBetween(last.date, date)) : null;
  const ch = db.get("SELECT * FROM challenges WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1", [uid]);
  const weeklyLast = rowSession(db.get("SELECT * FROM mindset_sessions WHERE user_id=? AND kind='weekly' ORDER BY date DESC, id DESC LIMIT 1", [uid]), prefs.priming_minutes);
  return {
    date, own: !!own,
    priming: sess(sessionOn('priming')),
    evening: sess(sessionOn('evening')),
    question: sess(sessionOn('question')),
    breathCount: countOn('breath'), breathTarget: 3,
    stateCount: countOn('state'),
    streak: { priming: streakDays(primingDates, date) },
    primingDays30,
    wheel: { last: last ? { id: last.id, date: last.date, avg: last.avg, balance: last.balance, weakest: last.weakest, scores: last.scores } : null,
      daysSince, due: !last || daysSince >= 28 },
    // nur die aktive Challenge wird hier gerechnet -> Kontext ab ihrem Starttag reicht (10–30 Tage)
    challenge: { active: ch ? challengeSummary(db, ch, ctx || buildAutoContext(db, u, ch.start_date), date) : null },
    weeklyDue: !weeklyLast || weeklyLast.date < isoAddDays(date, -6),
    weekly: sess(weeklyLast),
    prefs,
  };
}

export function registerMindsetRoutes(app, deps) {
  const { db, auth, canAccess, sendPush } = deps;
  const getUserFull = deps.getUserFull || (id => db.get('SELECT * FROM users WHERE id=?', [id]));
  const push = (uid, msg) => { try { const p = sendPush && sendPush(uid, msg); if (p && p.catch) p.catch(() => {}); } catch (e) {} };
  const parseUid = (req, res) => {
    const uid = Number(req.params.userId);
    if (!Number.isInteger(uid) || uid <= 0) { res.status(400).json({ error: 'Ungültige Nutzer-ID' }); return null; }
    if (!canAccess(req.user, uid)) { res.status(403).json({ error: 'Kein Zugriff' }); return null; }
    return uid;
  };
  const body = req => (isObj(req.body) ? req.body : {});
  // Datum aus dem Body: fehlt -> heute; ungültig -> 400; außerhalb [heute-pastDays, heute+1] -> 400. null = schon geantwortet.
  const dateFromBody = (b, pastDays, res) => {
    if (b.date !== undefined && b.date !== null && !isISO(b.date)) { res.status(400).json({ error: 'Ungültiges Datum' }); return null; }
    const today = todayISO(), date = b.date || today;
    if (date > isoAddDays(today, 1) || date < isoAddDays(today, -pastDays)) { res.status(400).json({ error: ERR_DATE_RANGE }); return null; }
    return date;
  };
  // Die "vollste" Session des Tages (meiste Schritte, längste Dauer) – nicht zwingend die letzte
  const primingMinutesOf = uid => prefsOf(db.get('SELECT priming_minutes FROM users WHERE id=?', [uid])).priming_minutes;
  const sessionOn = (uid, kind, date) => rowSession(db.get('SELECT * FROM mindset_sessions WHERE user_id=? AND kind=? AND date=? ORDER BY steps_done DESC, duration_sec DESC, id DESC LIMIT 1', [uid, kind, date]), kind === 'priming' ? primingMinutesOf(uid) : null);
  const countOn = (uid, kind, date) => db.get('SELECT COUNT(*) c FROM mindset_sessions WHERE user_id=? AND kind=? AND date=?', [uid, kind, date]).c;
  // Wie viele VOLLWERTIGE Sitzungen dieser Art gibt es heute schon? Nur danach richtet sich das XP:
  // ein übersprungenes Priming am Morgen darf das echte am Mittag nicht um seine Punkte bringen (B16).
  const fullCountOn = (uid, kind, date, minutes) => {
    if (kind === 'priming') return db.get(`SELECT COUNT(*) c FROM mindset_sessions WHERE user_id=? AND kind='priming' AND date=? AND ${PRIMING_FULL_SQL}`, [uid, date, ...primingFullArgs(minutes)]).c;
    if (kind === 'evening') return db.get("SELECT COUNT(*) c FROM mindset_sessions WHERE user_id=? AND kind='evening' AND date=? AND duration_sec>=?", [uid, date, EVENING_MIN_SEC]).c;
    return countOn(uid, kind, date);
  };
  const activeChallenge = uid => db.get("SELECT * FROM challenges WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1", [uid]);
  // Schreibpfad-Hook: Challenges des Nutzers abschließen, wenn eine fällig ist (Cron erledigt den Rest stündlich)
  const settleChallenges = (uid, u, ctx) => {
    if (!activeChallenge(uid)) return [];
    u = u || getUserFull(uid); if (!u) return [];
    return closeExpiredChallenges(db, u, ctx || buildAutoContext(db, u), todayISO(), push);
  };

  // Tagesübersicht (rein lesend): Priming/Abend/Atmung heute, Streak, Rad-Status, aktive Challenge, Einstellungen.
  // Immer für „heute" in APP_TZ – ein Datum aus der Anfrage wird bewusst nicht übernommen.
  // Die Berechnung liegt in mindsetTodayView() (exportiert), damit GET /api/home sie ohne zweite Anfrage einbetten kann.
  app.get('/api/mindset/today/:userId', auth, (req, res) => {
    const uid = parseUid(req, res); if (!uid) return;
    const view = mindsetTodayView(db, uid, uid === req.user.id);
    if (!view) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(view);
  });

  // Session speichern (immer für den eingeloggten Nutzer selbst). Datum nur [heute-7, heute+1], max. 20 je Tag & Art.
  app.post('/api/mindset/session', auth, (req, res) => {
    const b = body(req), uid = req.user.id;
    const kind = String(b.kind || '');
    if (!SESSION_KINDS.includes(kind)) return res.status(400).json({ error: 'Unbekannte Session-Art' });
    const date = dateFromBody(b, SESSION_PAST_DAYS, res); if (!date) return;
    const energy = clampNum(b.energy, 1, 10, true), mood = clampNum(b.mood, 1, 10, true);
    const focus = strArr(b.focus, 3, 120);
    let data = null;
    if (kind === 'weekly') {
      const d = isObj(b.data) ? b.data : {};
      data = { strong: strArr(d.strong, 12, 40), weak: strArr(d.weak, 12, 40), targets: strArr(d.targets, 2, 40) };
    } else if (kind === 'question') {
      const d = isObj(b.data) ? b.data : {};
      const id = typeof d.id === 'number' ? clampNum(d.id, 0, 9999, true) : str(d.id, 40);
      if (id === null) return res.status(400).json({ error: 'Frage-ID fehlt' });
      const existing = sessionOn(uid, 'question', date);
      if (existing) return res.json({ ok: true, id: existing.id, already: true, first: false, xp: { gained: 0 } }); // max. eine pro Tag
      data = { id };
    } else if (isObj(b.data)) {
      const s = JSON.stringify(b.data); data = s.length <= 2000 ? parseJSON(s, null) : null;
    }
    let dur = clampNum(b.duration_sec, 0, 7200, true) || 0;
    let steps = clampNum(b.steps_done, 0, 50, true) || 0;
    let stepsTotal = clampNum(b.steps_total, 0, 50, true) || 0;
    const mins = kind === 'priming' ? primingMinutesOf(uid) : null;
    // Abend-Reflexion und Wochencheck gibt es genau einmal pro Tag: ein zweiter Durchlauf aktualisiert den
    // vorhandenen Eintrag, statt eine zweite Zeile anzulegen (sonst zählt der Verlauf denselben Abend doppelt).
    if (kind === 'evening' || kind === 'weekly') {
      const ex = sessionOn(uid, kind, date);
      if (ex) {
        // Dauer und Schritte nur nach oben mitnehmen: ein zweiter, durchgeklickter Durchlauf darf eine
        // echte Reflexion nicht nachträglich auf „übersprungen" herunterschreiben (B16).
        dur = Math.max(dur, Number(ex.duration_sec) || 0);
        steps = Math.max(steps, Number(ex.steps_done) || 0);
        stepsTotal = Math.max(stepsTotal, Number(ex.steps_total) || 0);
        db.run('UPDATE mindset_sessions SET duration_sec=?, steps_done=?, steps_total=?, focus=?, energy=?, mood=?, data=?, note=? WHERE id=?',
          [dur, steps, stepsTotal,
            focus.length ? JSON.stringify(focus) : null, energy, mood, data ? JSON.stringify(data) : null, str(b.note, 500), ex.id]);
        const exFull = isFullSession({ kind, duration_sec: dur, steps_done: steps }, mins);
        // Aus „übersprungen" wird durch einen echten zweiten Durchlauf doch noch ein gezählter Abend –
        // dann gibt es das XP jetzt (mindsetStats zählt den Tag ab sofort mit, vorher tat es das nicht).
        const gainedNow = exFull && !ex.full ? (XP_HINT[kind] || 0) : 0;
        return res.json({ ok: true, id: ex.id, already: true, first: false, full: exFull, partial: !exFull, xp: { gained: gainedNow }, rule: fullRuleOf(kind, mins) });
      }
    }
    const before = countOn(uid, kind, date);
    const beforeFull = kind === 'priming' || kind === 'evening' ? fullCountOn(uid, kind, date, mins) : before;
    if (before >= SESSION_DAY_CAP) return res.status(429).json({ error: 'Zu viele Einträge für heute' });
    const r = db.run('INSERT INTO mindset_sessions(user_id,date,kind,duration_sec,steps_done,steps_total,focus,energy,mood,data,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      [uid, date, kind, dur, steps, stepsTotal,
        focus.length ? JSON.stringify(focus) : null, energy, mood, data ? JSON.stringify(data) : null, str(b.note, 500)]);
    // Vollwertig? Ein durchgeklicktes Ritual wird gespeichert, bringt aber kein XP und keinen Streak (B16).
    const full = isFullSession({ kind, duration_sec: dur, steps_done: steps }, mins);
    // XP-Hinweis: pro Tag & Art einmal (Atmung bis zu BREATH_XP_CAP Sessions) – entspricht mindsetStats
    const gained = !full ? 0 : (kind === 'breath' ? (before < BREATH_XP_CAP ? XP_HINT.breath : 0) : (beforeFull === 0 ? XP_HINT[kind] : 0));
    // Eine Session kann die letzte automatisch erkannte Regel des letzten Challenge-Tags erfüllen -> Abschluss prüfen
    let challengeFinished = false;
    try { challengeFinished = settleChallenges(uid).some(c => c.status === 'done'); } catch (e) {}
    res.json({ ok: true, id: r.lastInsertRowid, first: before === 0, full, partial: !full, xp: { gained }, challengeFinished, rule: fullRuleOf(kind, mins) });
  });

  // Session nachträglich ergänzen (eigene Zeile von heute/gestern): Fokus-Ziele, Energie, Stimmung, Notiz, Dauer, Schritte.
  // So bleibt ein fertig gelaufenes Priming gespeichert, auch wenn das Abschluss-Sheet weggetippt wird.
  app.put('/api/mindset/session/:id', auth, (req, res) => {
    const b = body(req), uid = req.user.id;
    const row = db.get('SELECT * FROM mindset_sessions WHERE id=?', [Number(req.params.id) || 0]);
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' });
    if (row.user_id !== uid) return res.status(403).json({ error: 'Nur eigene Sessions änderbar' });
    const today = todayISO();
    if (row.date !== today && row.date !== isoAddDays(today, -1)) return res.status(400).json({ error: 'Nur Sessions von heute oder gestern lassen sich ergänzen' });
    const sets = [], vals = [];
    if ('focus' in b) { const f = strArr(b.focus, 3, 120); sets.push('focus=?'); vals.push(f.length ? JSON.stringify(f) : null); }
    if ('energy' in b) { sets.push('energy=?'); vals.push(clampNum(b.energy, 1, 10, true)); }
    if ('mood' in b) { sets.push('mood=?'); vals.push(clampNum(b.mood, 1, 10, true)); }
    if ('note' in b) { sets.push('note=?'); vals.push(str(b.note, 500)); }
    if ('duration_sec' in b) { const d = clampNum(b.duration_sec, 0, 7200, true); if (d !== null) { sets.push('duration_sec=?'); vals.push(d); } }
    if ('steps_done' in b) { const d = clampNum(b.steps_done, 0, 50, true); if (d !== null) { sets.push('steps_done=?'); vals.push(d); } }
    if (!sets.length) return res.status(400).json({ error: 'Nichts zu ändern' });
    db.run(`UPDATE mindset_sessions SET ${sets.join(',')} WHERE id=?`, [...vals, row.id]);
    // Der Nachtrag kann Dauer und Schritte ändern – die Antwort sagt deshalb, ob die Sitzung jetzt zählt (B16)
    const after = db.get('SELECT kind, duration_sec, steps_done FROM mindset_sessions WHERE id=?', [row.id]);
    const putMins = after.kind === 'priming' ? primingMinutesOf(uid) : null;
    const full = isFullSession(after, putMins);
    res.json({ ok: true, id: row.id, full, partial: !full, rule: fullRuleOf(after.kind, putMins) });
  });

  // Sessions der letzten n Tage + Tageszusammenfassung (für Verlauf/Kalender); Freitext nur für den Nutzer selbst
  app.get('/api/mindset/sessions/:userId', auth, (req, res) => {
    const uid = parseUid(req, res); if (!uid) return;
    const own = uid === req.user.id;
    const days = clampNum(req.query.days, 1, 730, true) || 90;
    const today = todayISO(), from = isoAddDays(today, -(days - 1));
    // neueste zuerst laden (Obergrenze), dann chronologisch ausgeben
    const pMins = primingMinutesOf(uid);
    const sessions = db.all('SELECT * FROM mindset_sessions WHERE user_id=? AND date>=? ORDER BY date DESC, id DESC LIMIT 2000', [uid, from]).map(r => rowSession(r, pMins)).reverse();
    // priming/evening sind der Tagesstand der VOLLWERTIGEN Rituale; primingPartial/eveningPartial
    // merken sich, dass an dem Tag zwar etwas gespeichert, aber durchgeklickt wurde (grauer Punkt, B16).
    const byDay = {};
    for (const s of sessions) {
      const d = byDay[s.date] = byDay[s.date] || { priming: false, evening: false, primingPartial: false, eveningPartial: false, breaths: 0, state: 0, weekly: false, question: false, energy: null, mood: null };
      if (s.kind === 'priming') { if (s.full) d.priming = true; else d.primingPartial = true; }
      else if (s.kind === 'evening') { if (s.full) d.evening = true; else d.eveningPartial = true; }
      else if (s.kind === 'breath') d.breaths++;
      else if (s.kind === 'state') d.state++;
      else if (s.kind === 'weekly') d.weekly = true;
      else if (s.kind === 'question') d.question = true;
      if (s.energy != null) d.energy = s.energy;   // letzter Wert des Tages gewinnt
      if (s.mood != null) d.mood = s.mood;
    }
    // Wochencheck-Verlauf: Anteil stärkender Emotionen je Check (älteste zuerst); die gewählten Emotionen selbst nur für den Nutzer
    const weekly = sessions.filter(s => s.kind === 'weekly').map(s => {
      const st = (s.data?.strong || []).length, wk = (s.data?.weak || []).length;
      return { id: s.id, date: s.date, strong: st, weak: wk, targets: own ? (s.data?.targets || []) : [], ratio: st + wk ? Math.round(st / (st + wk) * 100) : null };
    });
    res.json({ from, to: today, own, sessions: own ? sessions : sessions.map(privSession), byDay, weekly });
  });

  // Rad des Lebens: Bewertungen (neueste zuerst, max. 100) + Zeitreihen je Bereich (älteste zuerst)
  app.get('/api/mindset/wheel/:userId', auth, (req, res) => {
    const uid = parseUid(req, res); if (!uid) return;
    const own = uid === req.user.id;
    const rows = db.all('SELECT * FROM wheel_assessments WHERE user_id=? ORDER BY date DESC, id DESC LIMIT 100', [uid]).map(rowWheel).reverse();
    const series = Object.fromEntries(WHEEL_KEYS.map(k => [k, []]));
    const avgSeries = [], balanceSeries = [];
    rows.forEach((a, i) => {
      a.delta = wheelDelta(a.scores, i > 0 ? rows[i - 1].scores : null);
      for (const k of WHEEL_KEYS) series[k].push({ date: a.date, value: Number(a.scores[k]) || 0 });
      avgSeries.push({ date: a.date, value: a.avg }); balanceSeries.push({ date: a.date, value: a.balance });
    });
    const assessments = [...rows].reverse();
    res.json({ areas: WHEEL_AREAS, own, assessments: own ? assessments : assessments.map(privWheel), series, avgSeries, balanceSeries });
  });

  // Gemeinsame Prüfung für POST und PUT /wheel: liefert die normalisierten Felder oder { error }
  const wheelInput = b => {
    if (!isObj(b.scores)) return { error: 'Bewertungen fehlen' };
    const scores = {};
    for (const k of WHEEL_KEYS) {
      const v = clampNum(b.scores[k], 0, 100, true);
      if (v === null) return { error: 'Bitte alle 7 Bereiche bewerten' };
      scores[k] = v;
    }
    let targets = null;
    if (isObj(b.targets)) {
      targets = {};
      for (const k of WHEEL_KEYS) { const v = clampNum(b.targets[k], 0, 100, true); if (v !== null) targets[k] = v; }
      if (!Object.keys(targets).length) targets = null;
    }
    const area = v => { const s = str(v, 40); return s ? (WHEEL_KEYS.includes(s) ? s : false) : null; };
    const focus_area = area(b.focus_area), second_area = area(b.second_area);
    if (focus_area === false || second_area === false) return { error: 'Unbekannter Lebensbereich' };
    return { scores, targets, focus_area, second_area, actions: strArr(b.actions, 3, 160),
      feeling_now: str(b.feeling_now, 500), feeling_target: str(b.feeling_target, 500), note: str(b.note, 500) };
  };

  // Neue Bewertung. Pro Tag höchstens eine: gibt es schon eine, antwortet 409 mit existingId (Frontend -> PUT).
  app.post('/api/mindset/wheel', auth, (req, res) => {
    const b = body(req), uid = req.user.id;
    const x = wheelInput(b);
    if (x.error) return res.status(400).json({ error: x.error });
    const date = dateFromBody(b, WHEEL_PAST_DAYS, res); if (!date) return;
    const dup = db.get('SELECT id FROM wheel_assessments WHERE user_id=? AND date=? ORDER BY id DESC LIMIT 1', [uid, date]);
    if (dup) return res.status(409).json({ error: 'Für heute gibt es schon eine Bewertung', existingId: dup.id });
    const first = !db.get('SELECT id FROM wheel_assessments WHERE user_id=? LIMIT 1', [uid]);
    const prev = prevWheel(db, uid, date);
    const r = db.run('INSERT INTO wheel_assessments(user_id,date,scores,targets,focus_area,second_area,actions,feeling_now,feeling_target,note) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [uid, date, JSON.stringify(x.scores), x.targets ? JSON.stringify(x.targets) : null, x.focus_area, x.second_area, x.actions.length ? JSON.stringify(x.actions) : null,
        x.feeling_now, x.feeling_target, x.note]);
    const st = wheelStats(x.scores);
    res.json({ ok: true, id: r.lastInsertRowid, first, summary: { ...st, delta: wheelDelta(x.scores, prev?.scores) } });
  });

  // Bewertung bearbeiten (eigene Zeile, Datum bleibt): gleiche Prüfung wie POST, UPDATE an Ort und Stelle
  app.put('/api/mindset/wheel/:id', auth, (req, res) => {
    const b = body(req), uid = req.user.id;
    const row = db.get('SELECT * FROM wheel_assessments WHERE id=?', [Number(req.params.id) || 0]);
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' });
    if (row.user_id !== uid) return res.status(403).json({ error: 'Nur eigene Bewertungen änderbar' });
    const x = wheelInput(b);
    if (x.error) return res.status(400).json({ error: x.error });
    db.run('UPDATE wheel_assessments SET scores=?,targets=?,focus_area=?,second_area=?,actions=?,feeling_now=?,feeling_target=?,note=? WHERE id=?',
      [JSON.stringify(x.scores), x.targets ? JSON.stringify(x.targets) : null, x.focus_area, x.second_area, x.actions.length ? JSON.stringify(x.actions) : null,
        x.feeling_now, x.feeling_target, x.note, row.id]);
    const prev = prevWheel(db, uid, row.date, row.id);
    const st = wheelStats(x.scores);
    res.json({ ok: true, id: row.id, summary: { ...st, delta: wheelDelta(x.scores, prev?.scores) } });
  });

  // Eine der Maßnahmen abhaken. Bewusst eine eigene, winzige Route: das Rad selbst wird dabei
  // nicht angefasst (kein versehentliches Überschreiben von Bewertung oder Fokus).
  app.put('/api/mindset/wheel/:id/actions', auth, (req, res) => {
    const row = db.get('SELECT * FROM wheel_assessments WHERE id=?', [Number(req.params.id) || 0]);
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Kein Zugriff' });
    const total = (parseJSON(row.actions, []) || []).length;
    const raw = Array.isArray(req.body?.done) ? req.body.done : [];
    const done = [...new Set(raw.map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < total))].sort((a, b) => a - b);
    db.run('UPDATE wheel_assessments SET actions_done=? WHERE id=?', [done.length ? JSON.stringify(done) : null, row.id]);
    res.json({ ok: true, done, total });
  });

  app.delete('/api/mindset/wheel/:id', auth, (req, res) => {
    const row = db.get('SELECT id, user_id FROM wheel_assessments WHERE id=?', [Number(req.params.id) || 0]);
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Nur eigene Bewertungen löschbar' });
    db.run('DELETE FROM wheel_assessments WHERE id=?', [row.id]);
    res.json({ ok: true });
  });

  // Challenge-Ansicht (rein lesend): Regeln, aktive Challenge (mit Auto-Erkennung je Tag), Vergangene, HF-Zone, Wasser.
  // Eine abgelaufene Challenge kann hier bis zum nächsten Schreibzugriff/Cron-Lauf noch aktiv (over:true) erscheinen.
  app.get('/api/mindset/challenge/:userId', auth, (req, res) => {
    const uid = parseUid(req, res); if (!uid) return;
    const u = getUserFull(uid); if (!u) return res.status(404).json({ error: 'Nicht gefunden' });
    const today = todayISO();
    const ctx = buildAutoContext(db, u), ctxOf = () => ctx;
    const act = activeChallenge(uid);
    const past = db.all("SELECT * FROM challenges WHERE user_id=? AND status!='active' ORDER BY id DESC LIMIT 100", [uid]);
    res.json({
      rules: CHALLENGE_RULES,
      active: act ? challengeSummary(db, act, ctx, today) : null,
      past: past.map(c => pastEntryOf(db, c, ctxOf, today)),
      hrZone: hrZoneOf(u, today),
      water: { targetL: ctx.waterTarget, todayL: ctx.waterByDate[today] ?? null },
    });
  });

  app.post('/api/mindset/challenge', auth, (req, res) => {
    const b = body(req), uid = req.user.id;
    const days = Number(b.days === undefined ? 10 : b.days);
    if (days !== 10 && days !== 30) return res.status(400).json({ error: 'Dauer muss 10 oder 30 Tage sein' });
    let rules = DEFAULT_RULES;
    if (b.rules !== undefined && b.rules !== null) {
      if (!Array.isArray(b.rules)) return res.status(400).json({ error: 'Regeln müssen eine Liste sein' });
      const ids = [...new Set(b.rules.map(x => str(x, 40)).filter(Boolean))];
      if (ids.some(id => !RULE_BY_ID[id])) return res.status(400).json({ error: 'Unbekannte Regel' });
      if (!ids.length) return res.status(400).json({ error: 'Mindestens eine Regel wählen' });
      rules = CHALLENGE_RULES.map(r => r.id).filter(id => ids.includes(id)); // feste Reihenfolge
    }
    const u = getUserFull(uid); if (!u) return res.status(404).json({ error: 'Nicht gefunden' });
    const today = todayISO(), ctx = buildAutoContext(db, u);
    settleChallenges(uid, u, ctx); // eine vergessene, abgelaufene Challenge blockiert den Neustart nicht
    if (activeChallenge(uid)) return res.status(409).json({ error: 'Es läuft bereits eine Challenge' });
    const r = db.run("INSERT INTO challenges(user_id,kind,start_date,days,rules,status) VALUES(?,?,?,?,?,'active')", [uid, 'vital', today, days, JSON.stringify(rules)]);
    const ch = db.get('SELECT * FROM challenges WHERE id=?', [r.lastInsertRowid]);
    res.json({ ok: true, id: ch.id, active: challengeSummary(db, ch, ctx, today) });
  });

  // Tages-Haken setzen (Upsert). Letzter Tag komplett -> Challenge 'done' + Push.
  app.post('/api/mindset/challenge/:id/day', auth, (req, res) => {
    const b = body(req), uid = req.user.id;
    let ch = db.get('SELECT * FROM challenges WHERE id=?', [Number(req.params.id) || 0]);
    if (!ch) return res.status(404).json({ error: 'Challenge nicht gefunden' });
    if (ch.user_id !== uid) return res.status(403).json({ error: 'Nur eigene Challenge' });
    const u = getUserFull(uid); if (!u) return res.status(404).json({ error: 'Nicht gefunden' });
    const today = todayISO(), ctx = buildAutoContext(db, u);
    if (ch.status === 'active') { settleChallenges(uid, u, ctx); ch = db.get('SELECT * FROM challenges WHERE id=?', [ch.id]); }
    if (ch.status !== 'active') return res.status(409).json({ error: 'Challenge ist nicht mehr aktiv' });
    if (b.date !== undefined && b.date !== null && !isISO(b.date)) return res.status(400).json({ error: 'Ungültiges Datum' });
    const date = b.date || today;
    const endDate = endDateOf(ch);
    if (date < ch.start_date || date > endDate || date > today) return res.status(400).json({ error: 'Datum liegt außerhalb der Challenge' });
    if (!isObj(b.checks)) return res.status(400).json({ error: 'checks fehlt' });
    const ruleIds = strArr(parseJSON(ch.rules, []), 40, 40);
    if (Object.keys(b.checks).some(k => !ruleIds.includes(k))) return res.status(400).json({ error: 'Regel nicht Teil dieser Challenge' });
    const row = db.get('SELECT checks FROM challenge_days WHERE challenge_id=? AND date=?', [ch.id, date]);
    const stored = parseJSON(row?.checks, {});
    const checks = isObj(stored) ? stored : {};
    for (const k in b.checks) { if (b.checks[k]) checks[k] = true; else delete checks[k]; }
    if (row) db.run('UPDATE challenge_days SET checks=? WHERE challenge_id=? AND date=?', [JSON.stringify(checks), ch.id, date]);
    else db.run('INSERT INTO challenge_days(challenge_id,date,checks) VALUES(?,?,?)', [ch.id, date, JSON.stringify(checks)]);
    let summary = challengeSummary(db, ch, ctx, today);
    const day = summary.history.find(d => d.date === date) || null;
    let justFinished = false;
    if (lastDayComplete(summary)) {
      finishChallenge(db, ch.id, 'done', summary);
      summary = { ...summary, status: 'done', finished_at: new Date().toISOString() };
      justFinished = true;
      push(uid, donePush(summary));
    }
    res.json({ ok: true, day, justFinished, active: summary });
  });

  app.post('/api/mindset/challenge/:id/stop', auth, (req, res) => {
    const ch = db.get('SELECT * FROM challenges WHERE id=?', [Number(req.params.id) || 0]);
    if (!ch) return res.status(404).json({ error: 'Challenge nicht gefunden' });
    if (ch.user_id !== req.user.id) return res.status(403).json({ error: 'Nur eigene Challenge' });
    if (ch.status !== 'active') return res.status(409).json({ error: 'Challenge ist nicht mehr aktiv' });
    const u = getUserFull(req.user.id); if (!u) return res.status(404).json({ error: 'Nicht gefunden' });
    // Kennzahlen bis heute festschreiben – die Adhärenz einer gestoppten Challenge bleibt danach konstant
    finishChallenge(db, ch.id, 'stopped', challengeSummary(db, ch, buildAutoContext(db, u), todayISO()));
    res.json({ ok: true });
  });

  // Einstellungen (nur übergebene Felder werden geändert)
  app.put('/api/mindset/prefs', auth, (req, res) => {
    const b = body(req), uid = req.user.id, sets = [], vals = [];
    if ('mindset_push_hour' in b) {
      if (b.mindset_push_hour === null || b.mindset_push_hour === '') { sets.push('mindset_push_hour=NULL'); }
      else { const h = clampNum(b.mindset_push_hour, 0, 23, true); if (h === null) return res.status(400).json({ error: 'Ungültige Uhrzeit' }); sets.push('mindset_push_hour=?'); vals.push(h); }
    }
    if ('evening_push' in b) {
      if (![0, 1, true, false, '0', '1'].includes(b.evening_push)) return res.status(400).json({ error: 'evening_push muss 0 oder 1 sein' });
      sets.push('evening_push=?'); vals.push(Number(b.evening_push) ? 1 : 0);
    }
    if ('priming_minutes' in b) {
      const m = Number(b.priming_minutes);
      if (![5, 10, 15].includes(m)) return res.status(400).json({ error: 'priming_minutes muss 5, 10 oder 15 sein' });
      sets.push('priming_minutes=?'); vals.push(m);
    }
    if ('needs_top' in b) {
      if (!Array.isArray(b.needs_top)) return res.status(400).json({ error: 'needs_top muss eine Liste sein' });
      const keys = [...new Set(b.needs_top.map(x => str(x, 40)).filter(Boolean))];
      if (keys.some(k => !NEED_KEYS.includes(k))) return res.status(400).json({ error: 'Unbekanntes Bedürfnis' });
      if (keys.length > 2) return res.status(400).json({ error: 'Höchstens 2 Bedürfnisse' });
      sets.push('needs_top=?'); vals.push(keys.length ? JSON.stringify(keys) : null);
    }
    if (!sets.length) return res.status(400).json({ error: 'Keine Einstellung übergeben' });
    db.run(`UPDATE users SET ${sets.join(',')} WHERE id=?`, [...vals, uid]);
    res.json({ ok: true, prefs: prefsOf(getUserFull(uid)) });
  });

  // Arbeitsblätter lesen (alle Keys) – ausschließlich der Nutzer selbst, auch Coach/Admin nicht (persönliche Texte)
  app.get('/api/mindset/entries/:userId', auth, (req, res) => {
    const uid = Number(req.params.userId);
    if (!Number.isInteger(uid) || uid <= 0) return res.status(400).json({ error: 'Ungültige Nutzer-ID' });
    if (uid !== req.user.id) return res.status(403).json({ error: 'Persönliche Arbeitsblätter sind privat' });
    const entries = {}, updated = {};
    for (const r of db.all('SELECT key, data, updated_at FROM mindset_entries WHERE user_id=?', [uid])) {
      if (!ENTRY_KEYS.includes(r.key)) continue;
      entries[r.key] = parseJSON(r.data, {}); updated[r.key] = r.updated_at;
    }
    res.json({ entries, updated });
  });

  // Arbeitsblatt schreiben (eigene Zeile, ein Key)
  app.put('/api/mindset/entries/:key', auth, (req, res) => {
    const key = String(req.params.key || '');
    if (!ENTRY_KEYS.includes(key)) return res.status(400).json({ error: 'Unbekanntes Arbeitsblatt' });
    const b = req.body;
    if (!isObj(b)) return res.status(400).json({ error: 'JSON-Objekt erwartet' });
    if (JSON.stringify(b).length > 8192) return res.status(400).json({ error: 'Eintrag zu groß (max. 8 KB)' });
    const data = sanitizeEntry(key, b), json = JSON.stringify(data);
    const ex = db.get('SELECT id FROM mindset_entries WHERE user_id=? AND key=?', [req.user.id, key]);
    if (ex) db.run("UPDATE mindset_entries SET data=?, updated_at=datetime('now') WHERE id=?", [json, ex.id]);
    else db.run('INSERT INTO mindset_entries(user_id,key,data) VALUES(?,?,?)', [req.user.id, key, json]);
    res.json({ ok: true, key, data });
  });
}

/* ---------------- CRON-HOOK (stündlich aus server.js) ---------------- */
// Priming-Erinnerung zur Wunschstunde, Abend-Reflexion um 20 Uhr, Rad-des-Lebens-Erinnerung um 9 Uhr
// (alle Stunden in APP_TZ, Standard Europe/Berlin; fällig ab 28 Tagen, höchstens alle 7 Tage). Dedup über settings
// wie im Bestand. Außerdem: abgelaufene/komplette Challenges schließen (die GET-Handler bleiben rein lesend).
export function mindsetCron(db, now, { sendPush } = {}) {
  now = now || new Date();
  const today = todayISO(now), hour = tzHour(now); // Stunde in APP_TZ wie der übrige Cron (Push-Stunden = deutsche Zeit)
  const get = k => db.get('SELECT value FROM settings WHERE key=?', [k])?.value;
  const set = (k, v) => db.run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', [k, v]);
  const push = (uid, msg) => { try { const p = sendPush && sendPush(uid, msg); if (p && p.catch) p.catch(() => {}); } catch (e) {} };
  const has = (uid, kind) => !!db.get('SELECT id FROM mindset_sessions WHERE user_id=? AND kind=? AND date=? LIMIT 1', [uid, kind, today]);
  const sent = { priming: 0, evening: 0, wheel: 0, challenges: 0 };
  try { sent.challenges = sweepChallenges(db, today, push); } catch (e) {}
  const athletes = db.all("SELECT id, mindset_push_hour, evening_push FROM users WHERE role='athlete'");
  for (const a of athletes) {
    try {
      // Morgen-Priming zur gewählten Stunde (NULL = aus)
      if (a.mindset_push_hour != null && Number(a.mindset_push_hour) === hour && get('mprime_' + a.id) !== today) {
        set('mprime_' + a.id, today);
        if (!has(a.id, 'priming')) {
          push(a.id, { title: '🧠 Zeit für dein Priming', body: '10 Minuten für Fokus, Dankbarkeit und Energie – starte jetzt.', url: '/#mindset' });
          sent.priming++;
        }
      }
      // Abend-Reflexion um 20 Uhr (APP_TZ)
      if (Number(a.evening_push) === 1 && hour === 20 && get('meve_' + a.id) !== today) {
        set('meve_' + a.id, today);
        if (!has(a.id, 'evening')) {
          push(a.id, { title: '🌙 Abend-Reflexion', body: 'Wofür warst du heute dankbar? 2 Minuten – dann ist der Tag rund.', url: '/#mindset' });
          sent.evening++;
        }
      }
      // Rad des Lebens fällig: ≥ 28 Tage seit der letzten Bewertung (oder nie, aber schon geprimt)
      if (hour === 9) {
        const lastSent = get('mwheel_' + a.id);
        if (!lastSent || !isISO(lastSent) || daysBetween(lastSent, today) >= 7) {
          const last = db.get('SELECT date FROM wheel_assessments WHERE user_id=? ORDER BY date DESC, id DESC LIMIT 1', [a.id]);
          const due = last ? daysBetween(last.date, today) >= 28
            : !!db.get("SELECT id FROM mindset_sessions WHERE user_id=? AND kind='priming' LIMIT 1", [a.id]);
          if (due) {
            set('mwheel_' + a.id, today);
            push(a.id, { title: '🎡 Rad des Lebens', body: '4 Wochen sind rum – wie steht dein Rad heute? 2 Minuten Standortbestimmung.', url: '/#mindset/wheel' });
            sent.wheel++;
          }
        }
      }
    } catch (e) {}
  }
  return sent;
}
