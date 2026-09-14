import { db } from './db.js';
import { initMindsetSchema } from './mindset.js'; // Mindset-Modul (2.0.0): eigene Tabellen + users-Spalten, idempotent

// ============================================================
// SOLL-ZUSTAND DES SCHEMAS (für GET /api/selftest)
// ============================================================
// Diese Liste ist bewusst STATISCH und steht ausserhalb von initSchema(): bricht dort der grosse
// CREATE-Block ab, laufen die ADD-COLUMN-Schritte darunter gar nicht erst – eine Liste, die sich
// erst beim Migrieren aufbaut, waere dann leer und meldete faelschlich „alles da". Erzeugt aus einer
// frischen Datenbank dieser Version (PRAGMA table_info je Tabelle). Wer eine Tabelle/Spalte/einen
// Index ergaenzt, traegt sie hier nach – sonst prueft der Selbsttest sie nicht.
export const SCHEMA_EXPECTED = {
  tables: {
    users: 'id,email,password_hash,name,role,coach_id,dob,gender,height_cm,start_weight,goal,days_per_week,pattern,phase,kcal_target_train,kcal_target_rest,experience,last_health_import,health_reminder,disliked_foods,email_verified,email_notifications,created_at,diet_type,avatar,sleep_goal,steps_goal,water_goal,push_hour,streak_freezes,freeze_last_grant,tour_done,health_token,health_token_at,mindset_push_hour,evening_push,needs_top,priming_minutes,token_version,consent_health_at,consent_version,ai_consent,experience_coach,features,xp_peak,tz',
    day_log: 'id,user_id,date,type,day_name',
    messages: 'id,user_id,from_id,kind,title,body,read,created_at',
    plans: 'id,user_id,title,active,created_at',
    training_days: 'id,plan_id,name,position,weekday,deleted',
    exercises: 'id,day_id,muscle,name,technique,video_url,target_sets,target_reps,notes,position,source,coach_locked,deleted,step_kg,replaces_id,group_id',
    set_logs: 'id,user_id,exercise_id,date,set_no,weight,reps,note,rir,set_type,bodyweight',
    checkins: 'id,user_id,date,weight,sleep,sleep_quality,steps,cardio,water,training,notes,coach_notes,active_kcal,exercise_min,resting_hr,hrv,source',
    meals: 'id,user_id,day_type,meal_no,label,position,recipe_id',
    meal_items: 'id,meal_id,food,amount,kcal,fat,carbs,protein,notes',
    foods: 'id,name,fat,carbs,protein,owner_id,use_count,unit',
    food_log: 'id,user_id,date,meal_slot,food,amount,kcal,fat,carbs,protein,details,created_at,meal_id,client_id',
    cardio_log: 'id,user_id,date,kind,minutes,distance_km,avg_hr,kcal,intensity,notes,created_at,source,ext_id,client_id',
    supplements: 'id,name,category,dose,timing,with_water,how_to,sort',
    athlete_supplements: 'id,user_id,supplement_id,mandatory,custom_dose,custom_timing,note',
    supplement_intake: 'id,user_id,supplement_id,name,dose,date,created_at,client_id',
    recipes: 'id,name,goal,meal_type,kcal,protein,carbs,fat,ingredients,steps,link,owner_id,diet,category,photo,shared_scope,created_at',
    recipe_shares: 'id,recipe_id,shared_by,shared_with,created_at',
    share_links: 'id,token,kind,payload,created_by,created_at,uses,expires_at',
    settings: 'key,value,updated_at,updated_by',
    push_subscriptions: 'id,user_id,endpoint,p256dh,auth,created_at',
    plan_templates: 'id,coach_id,name,data,created_at',
    monthly_goals: 'id,user_id,month,target_trainings,target_checkins,target_volume,custom,set_by,claimed,created_at',
    exercise_notes: 'id,user_id,exercise_id,date,note,flagged,author_id,author_role,created_at',
    measurements: 'id,user_id,date,body_fat,chest,waist,hips,arm,thigh,neck,shoulders',
    progress_photos: 'id,user_id,date,pose,image,created_at,thumb',
    streak_freeze_log: 'id,user_id,date,created_at',
    cart_items: 'id,user_id,text,source,checked,created_at',
    auth_tokens: 'id,user_id,token,type,expires_at,used,created_at',
    plan_versions: 'id,user_id,created_at,data',
    mindset_sessions: 'id,user_id,date,kind,duration_sec,steps_done,steps_total,focus,energy,mood,data,note,created_at',
    wheel_assessments: 'id,user_id,date,scores,targets,focus_area,second_area,actions,feeling_now,feeling_target,note,created_at,actions_done',
    challenges: 'id,user_id,kind,start_date,days,rules,status,finished_at,created_at,complete_days,adherence_pct',
    mindset_entries: 'id,user_id,key,data,updated_at',
    challenge_days: 'id,challenge_id,date,checks',
    // 2.6.0 (Welle A-II, „Recht & Rollen"): Betriebstabellen. Sie enthalten bewusst KEINE Inhalte,
    // nur IDs, Namen von Handlungen und redigierte Texte – siehe die Kommentare am CREATE-Block.
    audit: 'id,ts_utc,actor_id,actor_role,action,target_type,target_id,meta_json',
    errors: 'id,ts_utc,route,status,kind,msg_redacted,count',
    jobs: 'name,last_run_utc,last_ok_utc,last_error,state',
    support_grants: 'id,user_id,granted_at,expires_at,revoked_at,actor_id,reason',
  },
  indexes: 'idx_setlogs,idx_setlogs2,idx_foodlog,idx_cardiolog,idx_planversions,idx_messages_thread,idx_cardio_ext,idx_users_healthtoken,idx_foodlog_client,idx_cardiolog_client,idx_intake_client,idx_mindset_sessions_ud,idx_intake_ud,idx_setlogs_cov,idx_photos_cov,idx_audit_ts,idx_errors_ts,idx_support_grants_user',
};

// ============================================================
// AUFBEWAHRUNG (Welle A-II, Betriebstabellen)
// ============================================================
// Was protokolliert wird, muss auch wieder verschwinden – sonst wächst ein Protokoll, das niemand
// mehr überblickt, und aus „nur IDs" wird mit der Zeit doch ein Bewegungsprofil.
//   audit   : 365 Tage. Lang genug, um eine Beschwerde über ein ganzes Jahr zu belegen, kurz genug,
//             dass nichts unbegrenzt liegen bleibt. Es gibt keine Löschroute – NUR diese Regel.
//   errors  : 14 Tage ODER 2.000 Zeilen, je nachdem was zuerst greift (Ringpuffer). Ein Fehlerbild
//             ist nach zwei Wochen entweder behoben oder kein Einzelfall mehr.
//   jobs    : keine Aufbewahrungsregel – eine Zeile je Job-Name, sie wird überschrieben, nicht ergänzt.
//   support_grants: bleiben stehen. Eine abgelaufene Hilfe-Freigabe ist der Beleg dafür, WANN die Tür
//             offen stand; sie fällt mit dem Konto (ON DELETE CASCADE) und sonst nie.
// Ausgeführt wird das hier NICHT. pruneRetention() ist der fertige Migrations-/Aufräumschritt;
// Paket A-II.2 ruft ihn beim Start und im täglichen Aufräum-Job auf und trägt das Ergebnis in `jobs` ein.
export const RETENTION = { auditDays: 365, errorDays: 14, errorRows: 2000 };

// Aufräumen nach den Regeln oben. Idempotent, additiv-verträglich, nie destruktiv für Nutzdaten:
// die Funktion fasst ausschliesslich `audit` und `errors` an. Fehlt eine Tabelle (alter Stand), tut
// sie für diese Tabelle nichts und meldet das über `skipped` – sie wirft nie.
// Rückgabe: { auditDeleted, errorsDeletedAge, errorsDeletedOverflow, skipped[] } – reine Zahlen,
// damit der Aufrufer sie gefahrlos ins Log oder nach `jobs.last_error` schreiben kann.
export function pruneRetention() {
  const out = { auditDeleted: 0, errorsDeletedAge: 0, errorsDeletedOverflow: 0, skipped: [] };
  const has = (t) => !!db.get("SELECT 1 x FROM sqlite_master WHERE type='table' AND name=?", [t]);
  const n = (r) => Number(r?.changes ?? r?.rowsAffected ?? 0) || 0;
  // Die Tagesangaben gehen als Text in den Modifikator von datetime() – deshalb hier hart auf eine
  // ganze Zahl festgenagelt, auch wenn RETENTION spaeter einmal aus einer Einstellung kaeme.
  const tage = (v, fallback) => { const x = Math.trunc(Number(v)); return (Number.isFinite(x) && x > 0) ? x : fallback; };
  const auditDays = tage(RETENTION.auditDays, 365), errorDays = tage(RETENTION.errorDays, 14);
  const errorRows = tage(RETENTION.errorRows, 2000);
  // datetime(ts_utc) statt eines rohen Zeichenkettenvergleichs: so ist es egal, ob eine Zeile
  // 'YYYY-MM-DD HH:MM:SS' (der DEFAULT, wie überall in dieser Datei) oder ISO mit T/Z trägt.
  // Der Index auf ts_utc bedient dafür die Anzeige (ORDER BY ts_utc DESC), nicht dieses Aufräumen –
  // beide Tabellen sind klein, der Lauf ist täglich und einmalig.
  // Grenzfall mit Absicht: traegt eine Zeile einen Zeitstempel, den datetime() nicht lesen kann, wird
  // der Vergleich NULL und die Zeile bleibt stehen. Das ist die richtige Richtung (lieber eine Zeile
  // zu wenig loeschen als eine zu viel) und heute nicht ausloesbar – beide Schreiber ueberlassen den
  // Zeitstempel dem DEFAULT (datetime('now')), ts_utc ist NOT NULL. Wer spaeter einen EIGENEN
  // Zeitstempel in `audit` oder `errors` schreibt, laesst bitte den DEFAULT arbeiten; sonst waechst
  // dort ein Rest, den keine Aufbewahrungsregel mehr erreicht. (Fuer `errors` faengt der Ringpuffer
  // unten solche Zeilen inzwischen ab, fuer `audit` gibt es keine zweite Regel.)
  try {
    if (!has('audit')) out.skipped.push('audit');
    else out.auditDeleted = n(db.run(
      `DELETE FROM audit WHERE datetime(ts_utc) < datetime('now', '-${auditDays} days')`));
  } catch (e) { out.skipped.push('audit'); console.error('[db] Aufbewahrung audit:', e?.message || e); }
  try {
    if (!has('errors')) out.skipped.push('errors');
    else {
      out.errorsDeletedAge = n(db.run(
        `DELETE FROM errors WHERE datetime(ts_utc) < datetime('now', '-${errorDays} days')`));
      // Ringpuffer: alles ausser den jüngsten RETENTION.errorRows Zeilen. Sortiert wird nach der ZEIT,
      // nicht nach der id: der Schreiber (src/server.js recordError) legt bei einem wiederkehrenden
      // Fehler keine neue Zeile an, sondern zaehlt hoch – `UPDATE errors SET count=count+1,
      // ts_utc=datetime('now') WHERE id=?`. Die id bleibt dabei alt, der Zeitstempel wird neu. Nach
      // id sortiert flog also ausgerechnet der haeufigste, gerade eben aufgetretene Fehler zuerst raus,
      // waehrend 2.000 einmalige Altfehler stehen blieben. count DESC bricht Gleichstaende innerhalb
      // derselben Sekunde zugunsten des haeufigeren Fehlers; id DESC macht die Reihenfolge eindeutig.
      // Dieselbe Sortierung benutzt die Anzeige (GET /api/admin/errors: ORDER BY ts_utc DESC, id DESC).
      // Nebenwirkung, die wir wollen: datetime() liefert fuer einen unlesbaren Zeitstempel NULL, und
      // NULL sortiert bei DESC ans Ende – eine kaputte Zeile faellt hier als erste heraus, statt (wie
      // bei der Altersregel, die einen NULL-Vergleich nie wahr werden laesst) ewig liegen zu bleiben.
      out.errorsDeletedOverflow = n(db.run(
        `DELETE FROM errors WHERE id NOT IN (
           SELECT id FROM errors ORDER BY datetime(ts_utc) DESC, count DESC, id DESC LIMIT ?)`,
        [errorRows]));
    }
  } catch (e) { out.skipped.push('errors'); console.error('[db] Aufbewahrung errors:', e?.message || e); }
  return out;
}

// Migrationsschritte, die beim Start NICHT durchgelaufen sind – nur die NAMEN, keine Fehlertexte.
// Der Selbsttest ist ohne Login erreichbar; ein SQLite-Fehlertext kann Pfade oder Spaltennamen
// enthalten, die dort nichts verloren haben. Der Text selbst steht im Server-Log.
export const schemaFailures = [];
function noteFailure(name, e) {
  if (!schemaFailures.includes(name)) schemaFailures.push(name);
  console.error('[db] Migrationsschritt "' + name + '" übersprungen:', e?.message || e);
}

// Ist-Zustand gegen die Soll-Liste pruefen. Liefert nur Namen und Zahlen (siehe oben).
export function schemaReport() {
  const missingTables = [], missingColumns = [], missingIndexes = [];
  const have = new Set(db.all("SELECT name FROM sqlite_master WHERE type='table'").map(r => r.name));
  for (const [table, cols] of Object.entries(SCHEMA_EXPECTED.tables)) {
    if (!have.has(table)) { missingTables.push(table); continue; }
    const present = new Set(db.all(`PRAGMA table_info(${table})`).map(c => c.name));
    for (const c of cols.split(',')) if (!present.has(c)) missingColumns.push(table + '.' + c);
  }
  const idx = new Set(db.all("SELECT name FROM sqlite_master WHERE type='index'").map(r => r.name));
  for (const i of SCHEMA_EXPECTED.indexes.split(',')) if (!idx.has(i)) missingIndexes.push(i);
  return { missingTables, missingColumns, missingIndexes, failedSteps: schemaFailures.slice() };
}

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
    deleted INTEGER DEFAULT 0,               -- Soft-Delete wie bei exercises: 1 = geloescht, Saetze bleiben (siehe unten)
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
    -- 2.2.0 (per Migration ergänzt): Werte aus der Uhr – active_kcal, exercise_min, resting_hr, hrv
    training TEXT, notes TEXT,
    coach_notes TEXT,                        -- nur Coach editierbar
    -- UNIQUE traegt hier auch die INDEX-Rolle: der automatische Index (user_id, date) bedient alle
    -- Check-in-Abfragen. Ein zusaetzlicher idx_checkins war eine exakte Dublette und wurde entfernt.
    -- Faellt UNIQUE je weg (mehrere Check-ins pro Tag), muss ein eigener Index (user_id, date) her.
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
  -- Zweiter Satz-Index NACH Datum: in idx_setlogs steht date hinter exercise_id, deshalb muss SQLite
  -- fuer jede Frage der Art "was war in diesem Zeitraum?" alle Saetze des Nutzers durchlaufen. Genau
  -- das tun die haeufigsten Abfragen der App: Wochenrueckblick, Bereitschaft (42-Tage-Fenster) und die
  -- MIN(date)-Suche nach der ersten Spur eines Kontos - letztere laeuft in der Sonntagsschleife einmal
  -- je Athlet. Mit (user_id, date) springt SQLite direkt in den Zeitraum bzw. auf das Minimum.
  CREATE INDEX IF NOT EXISTS idx_setlogs2 ON set_logs(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_foodlog ON food_log(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_cardiolog ON cardio_log(user_id, date);

  CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,              -- UNIQUE = der Index fuer die Token-Suche (kein zweiter noetig)
    type TEXT NOT NULL,                      -- 'verify' | 'reset'
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  `);

  // Idempotente Migrationen: fehlende Spalten zu bestehenden Tabellen ergänzen,
  // damit Online-Datenbanken mit alten Daten beim Update nicht brechen.
  // Jeder uebersprungene Schritt wird mit NAMEN gemerkt (schemaFailures), damit GET /api/selftest ihn
  // nennen kann – vorher verschwand er still in einem leeren catch, und der Deploy sah gesund aus.
  const cols = db.all("PRAGMA table_info(users)").map(c => c.name);
  const addCol = (name, def) => { if (!cols.includes(name)) { try { db.run(`ALTER TABLE users ADD COLUMN ${name} ${def}`); } catch (e) { noteFailure('users.' + name, e); } } };
  addCol('last_health_import', 'TEXT');
  addCol('health_reminder', 'INTEGER DEFAULT 0');
  addCol('diet_type', "TEXT DEFAULT 'all'");   // 'all' | 'vegetarian' | 'vegan'
  addCol('avatar', 'TEXT');                      // optionales Profilbild (base64 Data-URL)

  // food_log: Zutaten-Details bei aggregierten Mahlzeiten nachrüsten
  const flCols = db.all("PRAGMA table_info(food_log)").map(c => c.name);
  if (!flCols.includes('details')) { try { db.run("ALTER TABLE food_log ADD COLUMN details TEXT"); } catch (e) { noteFailure('food_log.details', e); } }

  // recipes: Ernährungsweise-Tag nachrüsten (bestehende DBs)
  const recCols = db.all("PRAGMA table_info(recipes)").map(c => c.name);
  const addRecCol = (name, def) => { if (!recCols.includes(name)) { try { db.run(`ALTER TABLE recipes ADD COLUMN ${name} ${def}`); } catch (e) { noteFailure('recipes.' + name, e); } } };
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
  if (!slCols.includes('expires_at')) { try { db.run('ALTER TABLE share_links ADD COLUMN expires_at TEXT'); } catch (e) { noteFailure('share_links.expires_at', e); } }

  // exercise_notes: Autor-Spalten nachrüsten (bestehende DBs)
  const enCols = db.all("PRAGMA table_info(exercise_notes)").map(c => c.name);
  const addEnCol = (name, def) => { if (!enCols.includes(name)) { try { db.run(`ALTER TABLE exercise_notes ADD COLUMN ${name} ${def}`); } catch (e) { noteFailure('exercise_notes.' + name, e); } } };
  addEnCol('author_id', 'INTEGER');
  addEnCol('author_role', "TEXT DEFAULT 'athlete'");

  // ---- 2.1.0: additive Migrationen (alle idempotent, nur ADD COLUMN / CREATE IF NOT EXISTS) ----
  const addColTo = (table, name, def) => {
    const have = db.all(`PRAGMA table_info(${table})`).map(c => c.name);
    if (!have.includes(name)) { try { db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`); } catch (e) { noteFailure(table + '.' + name, e); } }
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

  // ---- 2.2.0: Apple-Health-Synchronisation ----
  // Werte, die nur die Uhr kennt. Sie stehen bewusst am Check-in (ein Tag = eine Zeile),
  // damit Verlauf, Diagramme und Export ohne Sonderweg damit arbeiten.
  addColTo('checkins', 'active_kcal', 'REAL');      // Aktivitätskalorien des Tages (Apple: Active Energy)
  addColTo('checkins', 'exercise_min', 'INTEGER');  // Bewegungsminuten (Apple: Exercise Time)
  addColTo('checkins', 'resting_hr', 'INTEGER');    // Ruhepuls
  addColTo('checkins', 'hrv', 'REAL');              // Herzratenvariabilität in ms (SDNN)
  addCol('health_token', 'TEXT');                   // persönlicher Schlüssel des Kurzbefehls (NULL = Sync aus)
  addCol('health_token_at', 'TEXT');                // wann der Schlüssel erzeugt wurde
  // Importierte Einheiten werden über ihre Apple-UUID erkannt, damit derselbe Lauf nicht doppelt landet.
  addColTo('cardio_log', 'source', 'TEXT');         // NULL = von Hand, 'apple' = aus der Gesundheits-App
  addColTo('cardio_log', 'ext_id', 'TEXT');         // UUID der Einheit aus der Gesundheits-App
  step('cardio-ext-index', () => db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_cardio_ext ON cardio_log(user_id, ext_id) WHERE ext_id IS NOT NULL;' +
    'CREATE INDEX IF NOT EXISTS idx_users_healthtoken ON users(health_token);'));

  // ---- 2.3.0: Idempotenz für die Offline-Ablage ----
  // Essen und Cardio sind reine INSERTs (anders als Sätze und Check-ins, die auf einem Schlüssel
  // upserten). Geht beim Nachtragen die ANTWORT verloren, nachdem die Zeile schon geschrieben wurde,
  // schickt der Client denselben Eintrag erneut – ohne Schlüssel entstünde eine echte Dublette samt
  // doppelter Tageskalorien. client_id ist die Outbox-ID des Clients; der Teil-Index greift nur für
  // gesetzte Werte, alte Zeilen (NULL) bleiben davon unberührt.
  addColTo('food_log', 'client_id', 'TEXT');
  addColTo('cardio_log', 'client_id', 'TEXT');
  // Auch der spontane Supplement-Eintrag ist ein reines INSERT und kann aus der Offline-Ablage
  // wiederholt werden - ohne Marke entstuende dabei eine zweite Zeile.
  addColTo('supplement_intake', 'client_id', 'TEXT');
  step('client-id-index', () => db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_foodlog_client ON food_log(user_id, client_id) WHERE client_id IS NOT NULL;' +
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_cardiolog_client ON cardio_log(user_id, client_id) WHERE client_id IS NOT NULL;' +
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_client ON supplement_intake(user_id, client_id) WHERE client_id IS NOT NULL;'));

  // Mindset-Modul (Priming, Rad des Lebens, Vital-Challenge, Arbeitsblätter) – Tabellen + users-Spalten
  step('mindset', () => initMindsetSchema(db));

  // ---- 2.4.0 (SEC-23): Sitzungs-Widerruf ----
  // Generation der Anmelde-Token je Konto. signToken() schreibt sie als Claim "tv" in den JWT, auth()
  // vergleicht bei jeder Anfrage. +1 bei Passwortwechsel, Reset (eigener, Coach-, Admin-Reset) und
  // "auf allen Geraeten abmelden" – damit fliegen gestohlene oder vergessene Sitzungen sofort raus,
  // statt bis zu 30 Tage weiterzulaufen. DEFAULT 0 = Bestandskonten und alte Token (ohne tv, zaehlt als 0)
  // passen zusammen: niemand muss sich nach dem Update neu anmelden.
  addCol('token_version', 'INTEGER DEFAULT 0');

  // ---- Nach der Messung 2.3.0 (PERF-23): Historie schuetzen, Dubletten weg, drei belegte Indizes ----
  // Trainingstag weich loeschen. Bisher loeschte DELETE /api/days/:id hart, und ON DELETE CASCADE nahm
  // ueber exercises alle set_logs des Tags mit – gemessen 4.185 von 8.345 Saetzen bei EINEM Tipp, ohne
  // Rueckgaengig. Mit der Spalte bleibt der Tag samt Uebungen und Saetzen in der Datenbank, die
  // Oberflaeche filtert ihn (deleted=0), und POST /api/days/:id/restore holt ihn zurueck.
  addColTo('training_days', 'deleted', 'INTEGER DEFAULT 0');
  // Zwei Indizes waren exakte Dubletten der Automatik-Indizes aus UNIQUE (checkins(user_id,date) und
  // auth_tokens(token)): gemessen kein Abfrageplan, der sie braucht, aber jedes Check-in-Schreiben
  // pflegte sie mit (-18 % beim Schreiben ohne sie). Beide CREATE-Zeilen oben sind entfernt; bestehende
  // Datenbanken werden hier nachgezogen. Idempotent: DROP INDEX IF EXISTS.
  step('drop-duplicate-indexes', () => db.exec('DROP INDEX IF EXISTS idx_checkins; DROP INDEX IF EXISTS idx_authtokens;'));
  // supplement_intake war die einzige taeglich wachsende Tabelle im Home-Pfad ohne (user_id, date):
  // die Abhakliste lief bei jedem App-Start als Tabellendurchlauf (0,26 -> 0,01 ms bei 5.482 Zeilen).
  // Der deckende Satz-Index traegt weight/reps mit: die Rekord-Abfrage der Startseite (MAX(weight) je
  // Uebung und Tag ueber die ganze Historie) kommt damit ohne Sprung in die Tabelle aus.
  // Die Fotoliste holt nur id/date/pose/thumb, musste aber jede Zeile samt 400-KB-Bild anfassen
  // (184 ms bei 468 Fotos); mit thumb im Index liest sie das Bild nie (gemessen 12x schneller).
  step('perf-indexes', () => db.exec(
    'CREATE INDEX IF NOT EXISTS idx_intake_ud ON supplement_intake(user_id, date);' +
    'CREATE INDEX IF NOT EXISTS idx_setlogs_cov ON set_logs(user_id, exercise_id, date, weight, reps);' +
    'CREATE INDEX IF NOT EXISTS idx_photos_cov ON progress_photos(user_id, date, id, pose, thumb);'));

  // ============================================================
  // 2.6.0 – WELLE A-II „RECHT & ROLLEN" (Paket A-II.1)
  // ============================================================
  // Alle Schema-Aenderungen der Stufe A entstehen hier und nur hier. Regeln: additiv (nur neue
  // Spalten/Tabellen/Indizes), idempotent (jeder Schritt prueft erst, ob es das Objekt schon gibt),
  // nie destruktiv, nie umbenannt. Ein Server der Version 2.5.0 laeuft mit dieser Datenbank weiter:
  // er sieht die neuen Spalten schlicht nicht, und keine davon ist NOT NULL ohne Standardwert.
  // addColTo liest PRAGMA table_info je Spalte frisch – damit ist die Pruefung auch dann richtig,
  // wenn ein frueherer Schritt in diesem Lauf schon etwas ergaenzt hat.

  // --- users: Einwilligung, KI, Coach-Uebersteuerung, Schalter, Level-Schutz, Zeitzone ---
  // Art. 9 DSGVO: Gesundheitsdaten duerfen erst nach ausdruecklicher Einwilligung verarbeitet werden.
  // Der Zeitpunkt beweist sie, die Fassung erlaubt es, bei einer Textaenderung neu zu fragen.
  // Beide NULL = noch nicht eingewilligt; Routen, die Gesundheitsdaten ENTGEGENNEHMEN, antworten
  // dann mit 409 (Paket A-II.2). Widerruf setzt consent_health_at zurueck auf NULL.
  addColTo('users', 'consent_health_at', 'TEXT');
  addColTo('users', 'consent_version', 'TEXT');
  // DECISIONS F5: KI-Analyse durch den Coach. Standard AUS – deshalb DEFAULT 0, nicht NULL:
  // ein Bestandskonto darf nach dem Update nicht versehentlich als „hat zugestimmt" gelten.
  addColTo('users', 'ai_consent', 'INTEGER DEFAULT 0');
  // CRITIC K1: der Coach kann die Selbsteinschaetzung des Athleten sichtbar uebersteuern, ohne dass
  // dessen eigene Antwort (`experience`) ueberschrieben wird. NULL = keine Uebersteuerung.
  addColTo('users', 'experience_coach', 'TEXT');
  // JSON-Objekt mit Schaltern je Konto (Profi-Funktionen, Welle A-IV). NULL = alles auf Standard.
  addColTo('users', 'features', 'TEXT');
  // D20: der hoechste je erreichte XP-Stand. Wird ein Foto oder ein Satz geloescht, faellt die
  // laufende Punktzahl – das Level darf dadurch nicht sinken. DEFAULT 0 = Bestandskonten starten
  // beim naechsten XP-Lauf mit ihrem aktuellen Wert (A-II.2 zieht xp_peak = MAX(xp_peak, xp) nach).
  addColTo('users', 'xp_peak', 'INTEGER DEFAULT 0');
  // Zeitzone des Kontos (IANA, z.B. 'Europe/Vienna'). NULL = App-Standard (APP_TZ). Ohne sie ist
  // „heute" fuer jeden Nutzer die Zeitzone des Servers – bei Streak und Check-in ein echter Fehler.
  addColTo('users', 'tz', 'TEXT');

  // --- checkins: Herkunft des Werts (D19) ---
  // NULL/'manual' = von Hand eingetragen, 'health' = aus dem Apple-Health-Import. Ein Import ist
  // keine Leistung: er darf keine Streak halten und keinen Erfolg ausloesen. NULL bleibt bewusst
  // erlaubt, damit Bestandszeilen nicht umgeschrieben werden muessen (nie destruktiv).
  addColTo('checkins', 'source', 'TEXT');

  // --- set_logs: Profi-Logging und ehrliche Rechnung ---
  addColTo('set_logs', 'rir', 'INTEGER');         // Reps in Reserve, 0-5; NULL = nicht erfasst (Welle A-IV baut die Oberflaeche)
  // D38: 'work' | 'warmup' | 'drop' | 'backoff'. NULL zaehlt wie 'work' – nur so bleibt die gesamte
  // Historie unveraendert gueltig. Volumen, e1RM und Rekorde zaehlen kuenftig nur 'work'/NULL.
  addColTo('set_logs', 'set_type', 'TEXT');
  // D16: Koerpergewichtsuebungen (Klimmzug, Dip) haben heute 0 kg Tonnage. Hier steht das beim Satz
  // gueltige Koerpergewicht in kg – beim Satz, nicht bei der Uebung, weil es sich mit der Zeit aendert
  // und ein alter Satz mit dem heutigen Gewicht neu gerechnet falsch waere. NULL = nicht anzurechnen.
  addColTo('set_logs', 'bodyweight', 'REAL');

  // --- exercises: Schrittweite, Tausch-Historie, Supersaetze ---
  // D23: 2,5 kg stimmt fuer die Langhantel, nicht fuer 3-kg-Kurzhanteln oder eine Maschine mit
  // 5-kg-Platten. NULL = App-Standard, die Empfehlung rundet dann wie bisher.
  addColTo('exercises', 'step_kg', 'REAL');
  // „Uebung tauschen" behaelt den Verlauf: die neue Zeile zeigt auf die ersetzte (Welle A-IV/B).
  // Bewusst OHNE Fremdschluessel: die ersetzte Uebung wird weich geloescht (deleted=1) und soll auch
  // dann noch auffindbar sein, wenn sie irgendwann doch hart verschwindet.
  addColTo('exercises', 'replaces_id', 'INTEGER');
  addColTo('exercises', 'group_id', 'TEXT');      // gleiche Marke = Supersatz (Welle A-IV/B)

  // --- settings: wer hat wann umgelegt (Laufzeit-Schalter, Welle A-V) ---
  // Die Tabelle gibt es seit jeher (key/value fuer VAPID-Schluessel und Cron-Marker). Sie wird NICHT
  // neu gebaut, sondern ergaenzt – ein Schalter ohne Spur waere in einer Betriebsansicht wertlos.
  addColTo('settings', 'updated_at', 'TEXT');
  addColTo('settings', 'updated_by', 'INTEGER');

  // --- Betriebstabellen (audit, errors, jobs, support_grants) ---
  // Grundsatz fuer alle vier: sie enthalten KEINE personenbezogenen Inhalte. Nur IDs, Namen von
  // Handlungen, Zustaende und redigierte Texte. Der Admin ist Betreiber, nicht Ueber-Coach.
  //
  // Bewusst OHNE Fremdschluessel auf users (Ausnahme: support_grants.user_id):
  //   1. `PRAGMA foreign_keys = ON` ist aktiv. Ein FK ohne ON DELETE wuerde das Loeschen eines Kontos
  //      blockieren, ein FK MIT ON DELETE CASCADE wuerde das Protokoll genau der Handlung loeschen,
  //      die es belegen soll („Konto geloescht"). Beides ist falsch.
  //   2. Ein Protokoll ueberlebt sein Objekt. actor_id/target_id sind Zahlen, kein Verweis.
  // Bei support_grants ist CASCADE dagegen richtig: eine Freigabe ohne Konto ist sinnlos, und die
  // Handlung selbst steht ohnehin in `audit`.
  step('a2-ops-tables', () => db.exec(`
  -- Protokoll jeder Admin-/Coach-Sonderhandlung. NUR INSERT: es gibt keine Loeschroute, nur die
  -- Aufbewahrungsregel (RETENTION.auditDays = 365 Tage, siehe pruneRetention()).
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_utc TEXT NOT NULL DEFAULT (datetime('now')),  -- datetime('now') ist in SQLite UTC; Format wie created_at ueberall sonst
    actor_id INTEGER,                        -- wer gehandelt hat (NULL = System/Cron)
    actor_role TEXT,                         -- 'admin' | 'coach' | 'athlete' | 'system' (Rolle ZUM ZEITPUNKT der Handlung)
    action TEXT NOT NULL,                    -- kurzer Name, z.B. 'role.change', 'user.delete', 'support.use', 'admin.search'
    target_type TEXT,                        -- 'user' | 'plan' | 'setting' | ...
    target_id INTEGER,                       -- ID des betroffenen Objekts – NIE dessen Inhalt
    meta_json TEXT                           -- JSON mit Zahlen/Kennungen (z.B. {"from":"athlete","to":"coach"}).
                                             -- Verboten: E-Mail, Name, Freitext, Gesundheitswerte.
  );

  -- Ringpuffer fuer Serverfehler (RETENTION: 14 Tage / 2.000 Zeilen). Der zentrale Fehlerhandler
  -- redigiert VOR dem Schreiben (Paket A-II.2): keine E-Mails, keine Tokens, keine Freitexte,
  -- keine Dateipfade. msg_redacted ist bereits das Ergebnis dieser Redaktion.
  CREATE TABLE IF NOT EXISTS errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_utc TEXT NOT NULL DEFAULT (datetime('now')),
    route TEXT,                              -- Muster, nicht die konkrete URL: '/api/checkins/:date'
    status INTEGER,                          -- HTTP-Status (500, 409, ...)
    kind TEXT,                               -- Fehlerklasse, z.B. 'SQLITE_CONSTRAINT', 'TypeError'
    msg_redacted TEXT,                       -- redigierter Kurztext (siehe oben)
    count INTEGER DEFAULT 1                  -- gleicher Fehler mehrfach: hochzaehlen statt neue Zeile
  );

  -- Zustand der wiederkehrenden Laeufe (Sonntags-Push, Aufraeumen, Sicherung). Eine Zeile je Job:
  -- der Name ist der Schluessel, die Zeile wird ueberschrieben, nicht ergaenzt.
  CREATE TABLE IF NOT EXISTS jobs (
    name TEXT PRIMARY KEY,                   -- 'push.sunday' | 'retention.prune' | 'backup' | ...
    last_run_utc TEXT,                       -- letzter Start (auch wenn er scheiterte)
    last_ok_utc TEXT,                        -- letzter erfolgreicher Abschluss
    last_error TEXT,                         -- redigierter Kurztext des letzten Fehlers, sonst NULL
    state TEXT DEFAULT 'unknown'             -- 'up' | 'late' | 'down' | 'unknown' (Karenz rechnet A-II.2)
  );

  -- Hilfe-Freigabe: der Athlet oeffnet dem Betreiber zeitlich begrenzt die Tuer. Nur eine gueltige
  -- Zeile (granted_at <= jetzt < expires_at, revoked_at IS NULL) erlaubt einem Admin eine
  -- personenbezogene Route – und jeder solche Zugriff schreibt eine Zeile in audit.
  CREATE TABLE IF NOT EXISTS support_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,                -- der Athlet, der freigibt (er allein darf das)
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,                -- Standard 30 Minuten (A-II.2 setzt den Wert)
    revoked_at TEXT,                         -- vorzeitig zurueckgezogen; NULL = laeuft regulaer ab
    actor_id INTEGER,                        -- fuer wen die Tuer offen ist (der Betreiber), kein Verweis
    reason TEXT,                             -- kurzer Grund aus einer festen Auswahl, kein Freitext
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Indizes: die drei Ansichten, die es wirklich gibt.
  -- audit/errors werden immer nach Zeit absteigend gelesen (Betriebsansicht, Paket A-II.3);
  -- support_grants wird bei JEDER Anfrage eines Admins auf eine personenbezogene Route geprueft –
  -- (user_id, expires_at) beantwortet „gibt es eine gueltige Freigabe?" allein aus dem Index.
  CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts_utc);
  CREATE INDEX IF NOT EXISTS idx_errors_ts ON errors(ts_utc);
  CREATE INDEX IF NOT EXISTS idx_support_grants_user ON support_grants(user_id, expires_at);`));

  console.log('[db] Schema bereit' + (schemaFailures.length ? ' – ' + schemaFailures.length + ' Schritt(e) uebersprungen: ' + schemaFailures.join(', ') : ''));
}

// Ein Migrationsschritt scheitert nie den ganzen Start: er wird laut protokolliert, der Rest läuft weiter.
// (Die Tabellen selbst entstehen oben im CREATE-IF-NOT-EXISTS-Block – nur die Zusatzschritte sind hier gekapselt.)
function step(name, fn) {
  try { fn(); } catch (e) { noteFailure(name, e); }
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
