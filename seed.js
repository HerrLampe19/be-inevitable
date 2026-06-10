import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { initSchema } from './schema.js';
import { hashPassword } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));

initSchema();

// Idempotent: nur seeden, wenn noch keine User existieren
const userCount = db.get('SELECT COUNT(*) c FROM users').c;
if (userCount > 0) {
  console.log('[seed] Es existieren bereits Nutzer – Seed übersprungen.');
  console.log('       (Zum Neu-Seeden: data.db löschen und "npm run seed" erneut.)');
  process.exit(0);
}

// 1) Lebensmittel
const foods = DATA.diet.foods;
for (const f of foods) {
  db.run('INSERT INTO foods(name,fat,carbs,protein) VALUES(?,?,?,?)',
    [f.name, Number(f.fat) || 0, Number(f.carbs) || 0, Number(f.protein) || 0]);
}
console.log('[seed] Lebensmittel:', foods.length);

// 2) Coach + Athlet
const coachId = db.run('INSERT INTO users(email,password_hash,name,role) VALUES(?,?,?,?)',
  ['coach@be-inevitable.at', hashPassword('coach123'), 'Pierre', 'coach']).lastInsertRowid;

const marcoId = db.run(`INSERT INTO users(email,password_hash,name,role,coach_id,dob,gender,height_cm,start_weight,goal,days_per_week,pattern,phase,kcal_target_train,kcal_target_rest,experience)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ['marco@be-inevitable.at', hashPassword('marco123'), 'Marco Munsch', 'athlete', coachId,
   '1999-12-14', 'Male', 171, 58, 'muscle', 4,
   JSON.stringify(['train','train','rest','train','train','rest','rest']), 'offseason', 3017, 2600, 'intermediate']).lastInsertRowid;
console.log('[seed] Accounts: Coach(Pierre) + Athlet(Marco)');

// 3) Plan + Trainingstage + Übungen (vom Coach erstellt -> coach_locked=1)
const planId = db.run('INSERT INTO plans(user_id,title) VALUES(?,?)', [marcoId, 'Offseason Split']).lastInsertRowid;
let dayPos = 0;
for (const d of DATA.workout.days) {
  const dayId = db.run('INSERT INTO training_days(plan_id,name,position) VALUES(?,?,?)',
    [planId, d.day, dayPos++]).lastInsertRowid;
  let exPos = 0;
  for (const e of d.exercises) {
    // Original-Tabelle hatte oft leere Sätze/Reps -> sinnvolle Defaults setzen
    const sets = e.sets || 3;
    const reps = e.reps || (/press|squat|deadlift|row|press|kniebeuge|bench/i.test(e.exercise) ? '6-10' : '10-15');
    db.run(`INSERT INTO exercises(day_id,muscle,name,technique,target_sets,target_reps,notes,position,source,coach_locked)
      VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [dayId, e.muscle, e.exercise, e.technique || null, sets, reps, e.notes || null, exPos++, 'coach', 1]);
  }
}
console.log('[seed] Trainingsplan mit', DATA.workout.days.length, 'Tagen');

// 4) Meal Plan (training + rest)
function seedMeals(list, dayType) {
  let pos = 0;
  for (const m of list) {
    const mealNo = parseInt((m.meal || '').replace(/\D/g, '')) || pos;
    const mealId = db.run('INSERT INTO meals(user_id,day_type,meal_no,label,position) VALUES(?,?,?,?,?)',
      [marcoId, dayType, mealNo, m.label || '', pos++]).lastInsertRowid;
    for (const it of (m.items || [])) {
      db.run('INSERT INTO meal_items(meal_id,food,amount,kcal,fat,carbs,protein,notes) VALUES(?,?,?,?,?,?,?,?)',
        [mealId, it.food, Number(it.amount) || 0, Number(it.kcal) || 0, Number(it.fat) || 0,
         Number(it.carbs) || 0, Number(it.protein) || 0, it.notes || null]);
    }
  }
}
seedMeals(DATA.diet.training, 'training');
seedMeals(DATA.diet.rest, 'rest');
console.log('[seed] Meal Plan (Trainings- + Resttag)');

console.log('\n[seed] FERTIG. Login-Daten:');
console.log('  Coach:  coach@be-inevitable.at  /  coach123');
console.log('  Athlet: marco@be-inevitable.at  /  marco123\n');
process.exit(0);
