import { db } from './db.js';
import { initMindsetSchema } from './mindset.js'; // Mindset-Modul (2.0.0): eigene Tabellen + users-Spalten, idempotent

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
    uses INTEGER DEFAULT 0,
    expires_at TEXT                          -- Ablauf (ISO); NULL bei alten Links = 30 Tage nach created_at
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

  -- Einkaufswagen: persistente Einkaufsliste pro Nutzer. Zeilen kommen aus dem Plan,
  -- aus Rezepten (Zutaten) oder manuell. source erlaubt gezieltes Ersetzen (z.B. Plan neu übernehmen).
  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,                      -- Anzeigetext, z.B. "180 g Hähnchenbrust"
    source TEXT DEFAULT 'manual',            -- 'plan' | 'recipe' | 'manual'
    checked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
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
  addCol('push_hour', 'INTEGER');         // Stunde (UTC/Serverzeit) der täglichen Trainings-Erinnerung; NULL = aus (keine Erinnerung)
  addCol('streak_freezes', 'INTEGER DEFAULT 1'); // verfügbare Streak-Joker (Start 1, max 2)
  addCol('freeze_last_grant', 'TEXT');    // Datum der letzten Joker-Gutschrift
  addCol('tour_done', 'INTEGER DEFAULT 0'); // Einführungs-Tour einmalig pro Konto gesehen?

  // share_links: Ablaufdatum nachrüsten (bestehende DBs)
  const slCols = db.all("PRAGMA table_info(share_links)").map(c => c.name);
  if (!slCols.includes('expires_at')) { try { db.run('ALTER TABLE share_links ADD COLUMN expires_at TEXT'); } catch (e) {} }

  // exercise_notes: Autor-Spalten nachrüsten (bestehende DBs)
  const enCols = db.all("PRAGMA table_info(exercise_notes)").map(c => c.name);
  const addEnCol = (name, def) => { if (!enCols.includes(name)) { try { db.run(`ALTER TABLE exercise_notes ADD COLUMN ${name} ${def}`); } catch (e) {} } };
  addEnCol('author_id', 'INTEGER');
  addEnCol('author_role', "TEXT DEFAULT 'athlete'");

  // ---- 2.1.0: additive Migrationen (alle idempotent, nur ADD COLUMN / CREATE IF NOT EXISTS) ----
  const addColTo = (table, name, def) => {
    const have = db.all(`PRAGMA table_info(${table})`).map(c => c.name);
    if (!have.includes(name)) { try { db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`); } catch (e) {} }
  };
  addColTo('food_log', 'meal_id', 'INTEGER');          // Verweis auf die Plan-Mahlzeit (via /foodlog/frommeal) -> "schon gegessen"-Markierung
  addColTo('meals', 'recipe_id', 'INTEGER');           // getauschte Mahlzeit: welches Rezept steckt drin (Label bleibt der Slot-Name)
  addColTo('foods', 'unit', "TEXT DEFAULT 'g'");       // Einheit der Mengenangabe: 'g' | 'ml' | 'Stück'
  addColTo('progress_photos', 'thumb', 'TEXT');        // kleines Vorschaubild (<=200 px, clientseitig erzeugt) für die Liste
  // Plan-Schnappschüsse: vor dem Neu-Erzeugen / Tauschen / Importieren wird der Stand gesichert (Rückgängig)
  step('plan_versions', () => db.exec(`CREATE TABLE IF NOT EXISTS plan_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    data TEXT NOT NULL,                      -- JSON {reason, meals:[{id,day_type,meal_no,label,position,recipe_id,items:[...]}]}
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_planversions ON plan_versions(user_id, id);
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(user_id, from_id, created_at);`));

  // 2.1.0: englische Dubletten in der Lebensmittel-Liste aufräumen (der alte Seed hatte jede Zeile
  // zweimal – einmal deutsch, einmal englisch). Siehe FOOD_RENAMES; seed-data.json ist bereits bereinigt.
  step('foods-dedupe', dedupeSeedFoods);

  // 2.1.0: Tippfehler aus dem alten Seed korrigieren (nur exakt dieser Name, idempotent)
  step('exercise-typo', () => db.run("UPDATE exercises SET name='Quad Extensions' WHERE name='Quad Extentions'"));

  // 2.1.0: Emoji aus gespeicherten Nachrichten-Titeln entfernen. Die Titel erscheinen unverändert als
  // fette Kopfzeile im Nachrichten-Sheet und in der Coach-Chatblase, wo sonst überall reiner Text mit
  // monochromem SVG-Icon steht. Der Server schreibt sie seither ohne Emoji (Push behält seins).
  // Idempotent: es werden nur exakt diese drei alten Titel ersetzt.
  step('message-title-emoji', () => {
    const fixes = [
      ['\u{1F37D}\uFE0F Neues Rezept geteilt', 'Neues Rezept geteilt'],
      ['\u{1F4CB} Neuer Trainingsplan', 'Neuer Trainingsplan'],
      ['\u{1F3AF} Neues Monatsziel', 'Neues Monatsziel'],
    ];
    for (const [from, to] of fixes) db.run('UPDATE messages SET title=? WHERE title=?', [to, from]);
  });

  // Mindset-Modul (Priming, Rad des Lebens, Vital-Challenge, Arbeitsblätter) – Tabellen + users-Spalten
  step('mindset', () => initMindsetSchema(db));

  console.log('[db] Schema bereit');
}

// Ein Migrationsschritt scheitert nie den ganzen Start: er wird laut protokolliert, der Rest läuft weiter.
// (Die Tabellen selbst entstehen oben im CREATE-IF-NOT-EXISTS-Block – nur die Zusatzschritte sind hier gekapselt.)
function step(name, fn) {
  try { fn(); } catch (e) { console.error('[db] Migrationsschritt "' + name + '" übersprungen:', e?.message || e); }
}

// ============================================================
// 2.1.0: LEBENSMITTEL-LISTE EINDEUTSCHEN + ENTDOPPELN
// ============================================================
// Der ursprüngliche Seed hat jede Zeile der Coach-Tabelle doppelt angelegt: einmal mit deutschem,
// einmal mit englischem Namen (187 statt ~100 Einträge). src/seed-data.json ist bereinigt; diese
// Migration zieht bestehende Datenbanken nach.
// Sicherheitsnetz: NUR globale Einträge (owner_id IS NULL), die niemand benutzt (use_count = 0 und
// kein Verweis aus food_log/meal_items). Alles andere bleibt unangetastet.
// Idempotent: sobald kein englischer Name mehr existiert, macht die Funktion nichts mehr.
const FOOD_RENAMES = {
  // halb-englische / falsch geschriebene deutsche Einträge
  'Cereals (<3g Fett)': 'Cerealien (<3 g Fett)', 'Vegan Protein': 'Veganes Protein', 'Mozarella light': 'Mozzarella light',
  // englische Dubletten -> deutscher Name
  'Oatmeal': 'Haferflocken', 'Rice': 'Reis', 'Pasta': 'Nudeln', 'Potatoes': 'Kartoffeln',
  'Sweet potatoes': 'Süßkartoffeln', 'Rice cakes': 'Reiswaffeln', 'Corn cakes': 'Maiswaffeln',
  'Whole wheat toast': 'Vollkorntoast', 'White toast': 'Weizentoast', 'Cereals (<3g fat)': 'Cerealien (<3 g Fett)',
  'Whey isolate': 'Whey Isolat', 'Vegan protein': 'Veganes Protein', 'Clear whey': 'Clearwhey',
  'Chicken breast': 'Hähnchenbrust', 'White fish': 'Weißer Fisch', 'Tuna': 'Thunfisch',
  'Lean ground beef / Tartare': 'Rinderfaschiertes mager / Tatar', 'Plain tofu': 'Tofu natur',
  'Smoked tofu': 'Tofu geräuchert', 'Planted chicken (plain)': 'Planted Chicken Natur', 'Shrimps': 'Garnelen',
  'Whole egg (piece)': 'Vollei (Stück)', 'Egg whites': 'Eiklar', 'Low-fat quark': 'Magerquark',
  'Skyr Protein': 'Skyr', 'pudding Protein': 'Proteinpudding', 'semolina pudding': 'Protein Grießpudding',
  'Salakis light (light cheese)': 'Salakis Light', 'Salmon': 'Lachs', 'Olive oil': 'Olivenöl',
  'Rapeseed oil': 'Rapsöl', 'Peanut butter': 'Erdnussmus', 'Almond butter': 'Mandelmus', 'Nut butter': 'Nussmus',
  'Walnuts': 'Walnüsse', 'Peanuts': 'Erdnüsse', 'Cashew butter': 'Cashewmus',
  '70% chocolate': 'Schokolade 70%', '85% chocolate': 'Schokolade 85%', 'Almonds': 'Mandeln',
  'Vegetables': 'Gemüse', 'Vegetable stir-fry': 'Gemüsepfanne', 'Broccoli': 'Brokkoli', 'Spinach': 'Spinat',
  'Carrots': 'Karotten', 'Lettuce': 'Salat', 'Onion': 'Zwiebel', 'Apple': 'Apfel', 'Banana': 'Banane',
  'Dates': 'Datteln', 'Raisins': 'Rosinen', 'Blueberries': 'Heidelbeeren', 'Raspberries': 'Himbeeren',
  'Strawberries': 'Erdbeeren', 'Mixed berries': 'Beerenmix', 'Tomatoes': 'Tomaten', 'Light ketchup': 'Ketchup Light',
  'Cream of Rice': 'Reisbrei', 'Cluster/Maltodextrin': 'Cluster-/Maltodextrin', 'Himmeltau': 'Himmeltau Grießbrei',
  'Spelt pops': 'Dinkelpops', 'Lentil pasta': 'Linsennudeln', 'Whole grain wrap': 'Vollkorn Wrap',
  'Pretzel Stick (piece)': 'Laugenstange (Stück)', 'Beans': 'Bohnen', 'Chickpeas': 'Kichererbsen',
  'Milk chocolate': 'Schokolade Vollmilch', 'Almond milk': 'Mandelmilch', 'Milk 1.5%': 'Milch 1,5%',
  'Turkey ham': 'Putenschinken', 'Soy shreds': 'Soja Schnetzel', 'Cottage cheese light': 'Cottage Cheese Light',
  'Cottage cheese full-fat': 'Cottage Cheese Vollfett', 'Full-fat cream cheese': 'Frischkäse Vollfett',
  'Philadelphia "so light"': 'Philadelphia "so leicht"', 'Light cheese slices': 'Käseaufschnitt light',
  'Mozzarella light': 'Mozzarella light', 'Light toast cheese': 'Toast Käse light',
  'Alpro Skyr style natural': 'Alpro Skyr Style natur', 'Alpro Skyr style mango/strawberry': 'Alpro Skyr Style Mango/Erdbeere',
  'Jam': 'Marmelade', 'Eggs (piece)': 'Eier (Stück)', 'Alpro soy natural': 'Alpro Soja Natur',
  'Baguette roll (piece)': 'Baguette Brötchen (Stück)', 'Applesauce': 'Apfelmus', 'Rice drink': 'Reis Drink',
};

function dedupeSeedFoods() {
  const names = Object.keys(FOOD_RENAMES);
  let rows = [];
  try {
    rows = db.all(`SELECT id, name, COALESCE(use_count,0) use_count FROM foods
      WHERE owner_id IS NULL AND name IN (${names.map(() => '?').join(',')})`, names);
  } catch (e) { return; }
  if (!rows.length) return;
  let renamed = 0, removed = 0, kept = 0;
  for (const r of rows) {
    try {
    const target = FOOD_RENAMES[r.name];
    if (!target || target === r.name) continue; // schon richtig benannt (Groß-/Kleinschreibung zählt: 'Cottage cheese light' -> 'Cottage Cheese Light')
    // In Benutzung? Dann nichts anfassen (Tagesprotokoll und Plan zeigen weiter denselben Namen).
    const used = r.use_count > 0
      || !!db.get('SELECT 1 x FROM food_log WHERE food=? LIMIT 1', [r.name])
      || !!db.get('SELECT 1 x FROM meal_items WHERE food=? LIMIT 1', [r.name]);
    if (used) { kept++; continue; }
    const twin = db.get('SELECT id FROM foods WHERE lower(name)=lower(?) AND id<>? LIMIT 1', [target, r.id]);
    if (twin) { db.run('DELETE FROM foods WHERE id=?', [r.id]); removed++; }
    else { db.run('UPDATE foods SET name=? WHERE id=?', [target, r.id]); renamed++; }
    } catch (e) { kept++; console.error('[db] Lebensmittel "' + r.name + '" unverändert gelassen:', e?.message || e); }
  }
  if (renamed || removed || kept) {
    console.log(`[db] Lebensmittel vereinheitlicht: ${renamed} umbenannt, ${removed} Dubletten entfernt, ${kept} in Benutzung behalten`);
  }
}
