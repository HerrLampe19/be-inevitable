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
    disliked_foods TEXT,                     -- JSON-Array abgelehnter Lebensmittel (für Mahlzeitenplan)
    email_verified INTEGER DEFAULT 0,        -- 1 = E-Mail bestätigt
    email_notifications INTEGER DEFAULT 1,   -- 1 = Benachrichtigungen auch per E-Mail
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
    details TEXT,                            -- JSON-Zutatenliste bei aggregierten Mahlzeiten
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

  -- Tägliche Einnahme-Abhakliste. Ein Eintrag = an diesem Tag genommen.
  -- supplement_id kann NULL sein (spontan hinzugefügtes Supp, das nicht im Katalog steht).
  CREATE TABLE IF NOT EXISTS supplement_intake (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    supplement_id INTEGER,                   -- NULL bei freiem Eintrag
    name TEXT NOT NULL,                      -- Name (auch für freie Einträge)
    dose TEXT,                               -- tatsächlich genommene Menge (anpassbar)
    date TEXT NOT NULL,                      -- 'YYYY-MM-DD'
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    diet TEXT DEFAULT '',                    -- 'vegan' | 'veg' | '' (Ernährungsweise)
    category TEXT,                           -- freie Kategorie (z.B. 'Bowl', 'Smoothie', 'Meal Prep')
    photo TEXT,                              -- optionales Foto (base64 Data-URL)
    shared_scope TEXT DEFAULT 'private',     -- 'private' | 'athletes' (Coach->seine Athleten) | 'public'
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Gezieltes Teilen einzelner Rezepte an einzelne Nutzer (Athlet<->Athlet, Coach->Athlet)
  CREATE TABLE IF NOT EXISTS recipe_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    shared_by INTEGER NOT NULL,              -- wer geteilt hat
    shared_with INTEGER NOT NULL,            -- mit wem
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(recipe_id, shared_with),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
  );

  -- Teilen per Link (WhatsApp & Co.): Schnappschuss des Inhalts hinter einem Token.
  -- Schnappschuss statt Referenz: funktioniert auch, wenn das Original gelöscht/geändert wird,
  -- und der Link gibt nie mehr preis als den geteilten Inhalt selbst.
  CREATE TABLE IF NOT EXISTS share_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    kind TEXT NOT NULL,                      -- 'recipe' | 'exercise'
    payload TEXT NOT NULL,                   -- JSON-Schnappschuss
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    uses INTEGER DEFAULT 0
  );

  -- Schlüssel/Wert-Einstellungen des Systems (z.B. VAPID-Schlüssel für Push, Cron-Marker)
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Web-Push-Abos der Nutzer (ein Nutzer kann mehrere Geräte haben)
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Plan-Vorlagen des Coaches (JSON-Schnappschuss: Tage + Übungen)
  CREATE TABLE IF NOT EXISTS plan_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,                      -- JSON {days:[{name,exercises:[...]}]}
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Monatsziele: pro Athlet & Monat ein Ziel mit drei Teilzielen (Trainings/Check-ins/Volumen).
  -- Automatisch generiert; vom Coach überschreibbar (custom=1 -> mehr XP bei Erfüllung).
  -- claimed=1 sobald die Belohnung gutgeschrieben wurde (verhindert Doppel-Vergabe).
  CREATE TABLE IF NOT EXISTS monthly_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL,                     -- 'YYYY-MM'
    target_trainings INTEGER NOT NULL,
    target_checkins INTEGER NOT NULL,
    target_volume INTEGER NOT NULL,
    custom INTEGER DEFAULT 0,                -- vom Coach angepasst?
    set_by INTEGER,                          -- welcher Coach (falls custom)
    claimed INTEGER DEFAULT 0,               -- Belohnung schon vergeben?
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, month),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exercise_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    note TEXT,
    flagged INTEGER DEFAULT 0,               -- 1 = ausdrücklich als Problem markiert (optional)
    author_id INTEGER,                        -- wer die Notiz geschrieben hat
    author_role TEXT DEFAULT 'athlete',       -- 'athlete' | 'coach'
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

  -- Streak-Joker (Streak-Freeze): protokolliert Tage, die automatisch durch einen Joker
  -- geschützt wurden. Diese Tage zählen wie ein Check-in für die Streak-Berechnung.
  CREATE TABLE IF NOT EXISTS streak_freeze_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,                      -- der geschützte Tag 'YYYY-MM-DD'
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_setlogs ON set_logs(user_id, exercise_id, date);
  CREATE INDEX IF NOT EXISTS idx_checkins ON checkins(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_foodlog ON food_log(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_cardiolog ON cardio_log(user_id, date);

  CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,                      -- 'verify' | 'reset'
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_authtokens ON auth_tokens(token);
  `);

  // Idempotente Migrationen: fehlende Spalten zu bestehenden Tabellen ergänzen,
  // damit Online-Datenbanken mit alten Daten beim Update nicht brechen.
  const cols = db.all("PRAGMA table_info(users)").map(c => c.name);
  const addCol = (name, def) => { if (!cols.includes(name)) { try { db.run(`ALTER TABLE users ADD COLUMN ${name} ${def}`); } catch (e) {} } };
  addCol('last_health_import', 'TEXT');
  addCol('health_reminder', 'INTEGER DEFAULT 0');
  addCol('diet_type', "TEXT DEFAULT 'all'");   // 'all' | 'vegetarian' | 'vegan'
  addCol('avatar', 'TEXT');                      // optionales Profilbild (base64 Data-URL)

  // food_log: Zutaten-Details bei aggregierten Mahlzeiten nachrüsten
  const flCols = db.all("PRAGMA table_info(food_log)").map(c => c.name);
  if (!flCols.includes('details')) { try { db.run("ALTER TABLE food_log ADD COLUMN details TEXT"); } catch (e) {} }

  // recipes: Ernährungsweise-Tag nachrüsten (bestehende DBs)
  const recCols = db.all("PRAGMA table_info(recipes)").map(c => c.name);
  const addRecCol = (name, def) => { if (!recCols.includes(name)) { try { db.run(`ALTER TABLE recipes ADD COLUMN ${name} ${def}`); } catch (e) {} } };
  addRecCol('diet', "TEXT DEFAULT ''");
  addRecCol('category', 'TEXT');
  addRecCol('photo', 'TEXT');
  addRecCol('shared_scope', "TEXT DEFAULT 'private'");
  addCol('disliked_foods', 'TEXT');
  addCol('email_verified', 'INTEGER DEFAULT 0');
  addCol('email_notifications', 'INTEGER DEFAULT 1');
  // Individuelle Gesundheitsziele (NULL = App-Standard 8 h / 10.000 / 3 L) + Push-Uhrzeit
  addCol('sleep_goal', 'REAL');           // Ziel Schlaf in Stunden
  addCol('steps_goal', 'INTEGER');        // Ziel Schritte/Tag
  addCol('water_goal', 'REAL');           // Ziel Wasser in Litern
  addCol('push_hour', 'INTEGER');         // Stunde (UTC/Serverzeit) der täglichen Trainings-Erinnerung; NULL = 6
  addCol('streak_freezes', 'INTEGER DEFAULT 1'); // verfügbare Streak-Joker (Start 1, max 2)
  addCol('freeze_last_grant', 'TEXT');    // Datum der letzten Joker-Gutschrift

  // exercise_notes: Autor-Spalten nachrüsten (bestehende DBs)
  const enCols = db.all("PRAGMA table_info(exercise_notes)").map(c => c.name);
  const addEnCol = (name, def) => { if (!enCols.includes(name)) { try { db.run(`ALTER TABLE exercise_notes ADD COLUMN ${name} ${def}`); } catch (e) {} } };
  addEnCol('author_id', 'INTEGER');
  addEnCol('author_role', "TEXT DEFAULT 'athlete'");

  console.log('[db] Schema bereit');
}
