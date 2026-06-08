import { db } from './db.js';

export function initSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'athlete',   -- 'admin' | 'coach' | 'athlete' (Hierarchie: admin > coach > athlete)
    coach_id INTEGER,                        -- welcher Coach betreut diesen Athleten
    dob TEXT, gender TEXT, height_cm REAL,
    start_weight REAL, goal TEXT,            -- 'muscle' | 'fatloss' | 'health'
    days_per_week INTEGER DEFAULT 4,
    pattern TEXT,                            -- JSON-Array, z.B. ["train","train","rest"]
    phase TEXT DEFAULT 'offseason',          -- 'offseason' | 'prep' | 'maintain'
    kcal_target_train INTEGER,
    kcal_target_rest INTEGER,
    experience TEXT DEFAULT 'beginner',      -- 'beginner' | 'intermediate' | 'advanced'
    last_health_import TEXT,                 -- Zeitpunkt des letzten Apple-Health-Imports
    health_reminder INTEGER DEFAULT 0,       -- 1 = wöchentliche Erinnerung gewünscht
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (coach_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS day_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,                      -- 'train' | 'rest' | 'sick'
    day_name TEXT,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    from_id INTEGER,
    kind TEXT DEFAULT 'message',             -- 'message' | 'change' | 'system'
    title TEXT, body TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,                -- der Athlet, dem der Plan gehört
    title TEXT NOT NULL DEFAULT 'Mein Plan',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS training_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    name TEXT NOT NULL,                      -- frei wählbar: "Lower 1", "Push", ...
    position INTEGER DEFAULT 0,              -- Reihenfolge
    weekday INTEGER,                         -- optional 0-6 (Mo-So), null = flexibel
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    muscle TEXT,
    name TEXT NOT NULL,
    technique TEXT,                          -- z.B. "Continuous Reps", Link/Tipp
    video_url TEXT,                          -- Link zur Übungsausführung
    target_sets INTEGER DEFAULT 3,
    target_reps TEXT,                        -- "8-12" o.ä.
    notes TEXT,
    position INTEGER DEFAULT 0,
    source TEXT DEFAULT 'coach',             -- 'coach' | 'athlete'  (wer hat es zuletzt gesetzt)
    coach_locked INTEGER DEFAULT 0,          -- 1 = Coach-Inhalt, Warnung beim Überschreiben
    deleted INTEGER DEFAULT 0,               -- Soft-Delete: 1 = gelöscht (wiederherstellbar)
    FOREIGN KEY (day_id) REFERENCES training_days(id) ON DELETE CASCADE
  );

  -- Tatsächlich geleistete Sätze (pro Übung, pro Datum)
  CREATE TABLE IF NOT EXISTS set_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    date TEXT NOT NULL,                      -- 'YYYY-MM-DD'
    set_no INTEGER NOT NULL,
    weight REAL,
    reps INTEGER,
    note TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
  );

  -- Täglicher Check-In
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    weight REAL, sleep REAL, sleep_quality INTEGER,
    steps INTEGER, cardio INTEGER, water REAL,
    training TEXT, notes TEXT,
    coach_notes TEXT,                        -- nur Coach editierbar
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Meal Plan: pro Athlet, Tagtyp (training/rest), Mahlzeiten + Items
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day_type TEXT NOT NULL,                  -- 'training' | 'rest'
    meal_no INTEGER,
    label TEXT,
    position INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS meal_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    food TEXT NOT NULL,
    amount REAL,
    kcal REAL, fat REAL, carbs REAL, protein REAL,
    notes TEXT,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
  );

  -- Lebensmitteldatenbank (global, vom Coach pflegbar)
  CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    fat REAL, carbs REAL, protein REAL,      -- pro 1 g
    owner_id INTEGER,                        -- NULL = globales Lebensmittel, sonst eigenes des Users
    use_count INTEGER DEFAULT 0              -- wie oft genutzt (für Sortierung)
  );

  -- BAUSTEIN 1: tatsächlich gegessene Lebensmittel pro Tag (Tracking)
  CREATE TABLE IF NOT EXISTS food_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    meal_slot TEXT,                          -- 'Frühstück' | 'Mittag' | ... (frei)
    food TEXT NOT NULL,
    amount REAL,
    kcal REAL, fat REAL, carbs REAL, protein REAL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- BAUSTEIN 2: Cardio-Einheiten
  CREATE TABLE IF NOT EXISTS cardio_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    kind TEXT,                               -- 'Laufen' | 'Rad' | 'Rudern' | 'Gehen' | ...
    minutes REAL, distance_km REAL,
    avg_hr INTEGER, kcal REAL,
    intensity TEXT,                          -- 'leicht' | 'moderat' | 'hart'
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Globale Supplement-Stammdaten (Standard-Empfehlungen)
  CREATE TABLE IF NOT EXISTS supplements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,                           -- z.B. 'Morgens','Pre-Workout','Intra','Abends'
    dose TEXT,                               -- z.B. '5 g', '3 Kapseln'
    timing TEXT,                             -- wann genau, z.B. 'morgens zum Frühstück'
    with_water INTEGER DEFAULT 1,            -- 1 = mit Wasser, 0 = ohne
    how_to TEXT,                             -- Einnahmehinweis / Wirkung
    sort INTEGER DEFAULT 0
  );

  -- Zuweisung pro Athlet: welche Supplements, Pflicht/optional, optional angepasste Werte
  CREATE TABLE IF NOT EXISTS athlete_supplements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    supplement_id INTEGER NOT NULL,
    mandatory INTEGER DEFAULT 0,             -- 1 = Pflicht (vom Coach)
    custom_dose TEXT,                        -- überschreibt dose, falls gesetzt
    custom_timing TEXT,                      -- überschreibt timing, falls gesetzt
    note TEXT,                               -- individueller Coach-Hinweis
    UNIQUE(user_id, supplement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (supplement_id) REFERENCES supplements(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    goal TEXT,                               -- 'muscle' | 'fatloss' | 'health' | NULL (für alle)
    meal_type TEXT,                          -- 'Frühstück' | 'Mittag' | 'Abend' | 'Snack'
    kcal REAL, protein REAL, carbs REAL, fat REAL,
    ingredients TEXT,                        -- Zutaten als Text (eine pro Zeile)
    steps TEXT,                              -- Zubereitung als Text
    link TEXT,                               -- optionaler Link zu Video/Rezeptseite
    owner_id INTEGER,                        -- NULL = global, sonst eigenes
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exercise_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    note TEXT,
    flagged INTEGER DEFAULT 1,               -- 1 = für Coach hervorheben (Beschwerde)
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    body_fat REAL, chest REAL, waist REAL, hips REAL,
    arm REAL, thigh REAL, neck REAL, shoulders REAL,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS progress_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    pose TEXT,                               -- 'front' | 'side' | 'back'
    image TEXT NOT NULL,                     -- Base64 Data-URL (verkleinert)
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_setlogs ON set_logs(user_id, exercise_id, date);
  CREATE INDEX IF NOT EXISTS idx_checkins ON checkins(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_foodlog ON food_log(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_cardiolog ON cardio_log(user_id, date);
  `);

  // Idempotente Migrationen: fehlende Spalten zu bestehenden Tabellen ergänzen,
  // damit Online-Datenbanken mit alten Daten beim Update nicht brechen.
  const cols = db.all("PRAGMA table_info(users)").map(c => c.name);
  const addCol = (name, def) => { if (!cols.includes(name)) { try { db.run(`ALTER TABLE users ADD COLUMN ${name} ${def}`); } catch (e) {} } };
  addCol('last_health_import', 'TEXT');
  addCol('health_reminder', 'INTEGER DEFAULT 0');

  console.log('[db] Schema bereit');
}
