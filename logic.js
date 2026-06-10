// ============================================================
// KERN-LOGIK (rein, ohne DB/Server) — damit hart testbar.
// ============================================================

// ---- Reps-Ziel parsen: "8-12" -> {min:8,max:12}, "10" -> {min:10,max:10} ----
export function parseRepRange(target) {
  if (!target) return null;
  const s = String(target).replace(/\s/g, '');
  const m = s.match(/^(\d+)(?:[-–](\d+))?$/);
  if (!m) return null;
  const min = parseInt(m[1]);
  const max = m[2] ? parseInt(m[2]) : min;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

// ---- Progressions-Empfehlung ----
// Eingabe: letzte Sätze [{weight, reps}], Ziel-Reps-String, Schrittweite kg
// Logik (vom Nutzer definiert):
//   beste Reps > max         -> Gewicht erhöhen
//   beste Reps < min         -> Gewicht reduzieren
//   sonst                    -> halten, Reps steigern
export function recommend(lastSets, targetReps, stepKg = 2.5) {
  const range = parseRepRange(targetReps);
  const valid = (lastSets || []).filter(s => s && s.weight != null && s.reps != null && s.reps > 0);
  if (!valid.length) {
    return { type: 'none', text: range ? `Ziel: ${range.min === range.max ? range.min : range.min + '-' + range.max} Reps` : 'Leg los — trag deine Sätze ein.' };
  }
  // "Bester" Satz: höchstes Gewicht; bei Gleichstand die meisten Reps
  const best = valid.slice().sort((a, b) => (b.weight - a.weight) || (b.reps - a.reps))[0];
  if (!range) {
    return { type: 'hold', weight: best.weight, text: `Letztes Mal: ${best.weight} kg × ${best.reps}. Schlag das!` };
  }
  if (best.reps > range.max) {
    const nw = Math.round((best.weight + stepKg) * 2) / 2;
    return { type: 'up', weight: nw, fromWeight: best.weight, text: `Stark! ${best.reps} Reps geschafft. Empfehlung: ${nw} kg (+${stepKg}).` };
  }
  if (best.reps < range.min) {
    const nw = Math.max(0, Math.round((best.weight - stepKg) * 2) / 2);
    return { type: 'down', weight: nw, fromWeight: best.weight, text: `Nur ${best.reps} Reps. Versuch ${nw} kg, dann saubere Technik.` };
  }
  return { type: 'hold', weight: best.weight, text: `${best.weight} kg halten. Ziel: Richtung ${range.max} Reps arbeiten (zuletzt ${best.reps}).` };
}

// ============================================================
// FREQUENZ-SEQUENZ (dynamischer Rhythmus, nicht wochentagbasiert)
// ============================================================
// pattern: Array wie ['train','train','rest'] = 2 Trainingstage, 1 Rest, wiederholt.
// trainingDays: Liste der Tagesnamen in Reihenfolge, z.B. ['Lower 1','Upper 1','Lower 2','Upper 2']
//   -> die 'train'-Slots werden der Reihe nach mit diesen Tagen gefüllt (rotierend).
// history: Array vergangener Tage [{date, type:'train'|'rest'|'sick', dayName?}] chronologisch.
//
// Der "Zeiger" ergibt sich aus der Historie: jeder absolvierte Trainingstag rückt
// die Trainingsrotation um 1 weiter; rest/sick rücken nur das Pattern weiter.

export function buildPattern(daysPerWeek) {
  // sinnvolle Default-Rhythmen je nach Frequenz
  const map = {
    1: ['train', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'],
    2: ['train', 'rest', 'rest', 'train', 'rest', 'rest', 'rest'],
    3: ['train', 'rest', 'train', 'rest', 'train', 'rest', 'rest'],
    4: ['train', 'train', 'rest', 'train', 'train', 'rest', 'rest'],
    5: ['train', 'train', 'rest', 'train', 'train', 'train', 'rest'],
    6: ['train', 'train', 'train', 'rest', 'train', 'train', 'train'],
    7: ['train', 'train', 'train', 'train', 'train', 'train', 'train'],
  };
  return map[daysPerWeek] || map[4];
}

// Wie viele Trainings wurden bisher absolviert (für die Rotation der Tage)
function completedTrainings(history) {
  return (history || []).filter(h => h.type === 'train').length;
}

// Position im Pattern: Summe aller bisherigen "verbrauchten" Pattern-Slots.
// train UND rest verbrauchen je 1 Slot. 'sick' = ungeplanter Rest -> verbraucht KEINEN
// regulären Trainings-Slot, sondern schiebt nur (man macht den Trainingstag später).
function patternIndex(history, pattern) {
  let idx = 0;
  for (const h of (history || [])) {
    if (h.type === 'sick') continue; // Krankheit verschiebt, verbraucht keinen Plan-Slot
    idx++;
  }
  return idx % pattern.length;
}

// Was ist für ein gegebenes Datum dran? (Vorschlag, überschreibbar)
export function suggestForToday({ pattern, trainingDays, history }) {
  const pat = pattern && pattern.length ? pattern : buildPattern(4);
  const slot = pat[patternIndex(history, pat)];
  if (slot === 'rest') return { type: 'rest', dayName: null };
  // Trainingstag: rotierender Index über trainingDays
  const rot = completedTrainings(history) % Math.max(1, (trainingDays || []).length);
  const dayName = (trainingDays && trainingDays.length) ? trainingDays[rot] : null;
  return { type: 'train', dayName };
}

// Vorschau der nächsten N Tage (für Home-Anzeige "kommende Tage")
export function previewNext({ pattern, trainingDays, history }, n = 5) {
  const pat = pattern && pattern.length ? pattern : buildPattern(4);
  const out = [];
  // simuliere ab jetzt
  const sim = (history || []).slice();
  for (let i = 0; i < n; i++) {
    const s = suggestForToday({ pattern: pat, trainingDays, history: sim });
    out.push(s);
    sim.push({ type: s.type, dayName: s.dayName }); // angenommen wird befolgt
  }
  return out;
}

// Kalender für einen Datumsbereich ab `startDate` über `days` Tage.
// history = vergangene Tage (vor startDate). planned = Map{ 'YYYY-MM-DD': {type, dayName} }
// für bereits manuell eingetragene/abgeschlossene Tage (auch in der Zukunft).
// Geplante Tage werden RESPEKTIERT und verschieben den Rhythmus entsprechend.
// `today`: Tage VOR heute ohne Eintrag gelten als ausgelassen (de-facto-Ruhe) und
// verschieben den Rhythmus NICHT – exakt wie das Heute-Widget rechnet (nahtlos weitermachen).
export function calendarRange({ pattern, trainingDays, history, startDate, days = 35, planned = {}, today = null }) {
  const pat = pattern && pattern.length ? pattern : buildPattern(4);
  const out = [];
  const sim = (history || []).slice();
  const start = new Date(startDate + 'T00:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    let entry, simType = null;
    if (planned[iso]) {
      // manuell festgelegt -> respektieren
      const p = planned[iso];
      entry = { date: iso, type: p.type, dayName: p.dayName || null, planned: true };
      if (p.type === 'train') {
        simType = 'train';
        // bei geplantem Training den rotierenden Tagesnamen ergänzen, falls nicht gesetzt
        if (!entry.dayName) {
          const s = suggestForToday({ pattern: pat, trainingDays, history: sim });
          entry.dayName = s.dayName;
        }
      } else if (p.type === 'sick') {
        // Krankheit ist IMMER ein eingeschobener Tag -> verschiebt den Rhythmus,
        // verbraucht keinen Trainings-Slot (das geplante Training wird nachgeholt).
        simType = 'sick';
      } else { // 'rest'
        // Ein eingeschobener Ruhetag an einem eigentlichen TRAININGStag verschiebt
        // den Rhythmus (wie 'sick'). Fällt er ohnehin auf einen Ruhetag, zählt er normal.
        const wouldBe = suggestForToday({ pattern: pat, trainingDays, history: sim });
        simType = wouldBe.type === 'train' ? 'sick' : 'rest';
      }
    } else if (today && iso < today) {
      // Vergangener Tag OHNE Eintrag: ausgelassen. Anzeige als Ruhetag (markiert),
      // aber KEIN Simulationsschritt – der Rhythmus läuft nahtlos weiter.
      entry = { date: iso, type: 'rest', dayName: null, planned: false, missed: true };
    } else {
      const s = suggestForToday({ pattern: pat, trainingDays, history: sim });
      entry = { date: iso, type: s.type, dayName: s.dayName, planned: false };
      simType = s.type;
    }
    out.push(entry);
    if (simType) sim.push({ type: simType, dayName: entry.dayName });
  }
  return out;
}

// ============================================================
// BAUSTEIN 1: Kalorien-Tracking — gegessen vs. Ziel
// ============================================================
export function dayNutrition(foodLogRows, target) {
  const sum = (foodLogRows || []).reduce((a, r) => ({
    kcal: a.kcal + (r.kcal || 0), fat: a.fat + (r.fat || 0),
    carbs: a.carbs + (r.carbs || 0), protein: a.protein + (r.protein || 0),
  }), { kcal: 0, fat: 0, carbs: 0, protein: 0 });
  const t = target || 0;
  const remaining = t ? Math.round(t - sum.kcal) : null;
  const pct = t ? Math.min(1, sum.kcal / t) : 0;
  let status = 'ok';
  if (t) {
    if (sum.kcal > t * 1.05) status = 'over';        // mehr als 5% drüber
    else if (sum.kcal >= t * 0.95) status = 'onTarget'; // im Zielkorridor
    else status = 'under';
  }
  return {
    consumed: Math.round(sum.kcal), target: t || null, remaining, pct,
    macros: { fat: Math.round(sum.fat), carbs: Math.round(sum.carbs), protein: Math.round(sum.protein) },
    status,
  };
}

// Kalorien einer Cardio-Einheit grob schätzen, falls nicht angegeben.
// MET-basiert: kcal ≈ MET * 3.5 * kg / 200 * Minuten
export function estimateCardioKcal({ kind, minutes, intensity, weightKg }) {
  const w = weightKg || 75;
  const metTable = {
    'Laufen': { leicht: 7, moderat: 9.8, hart: 12.5 },
    'Joggen': { leicht: 6, moderat: 8, hart: 10 },
    'Rad': { leicht: 4, moderat: 7, hart: 10 },
    'Spinning': { leicht: 5.5, moderat: 8.5, hart: 12 },
    'Rudern': { leicht: 4.8, moderat: 7, hart: 9.5 },
    'Gehen': { leicht: 2.8, moderat: 3.8, hart: 5 },
    'Wandern': { leicht: 4, moderat: 6, hart: 7.5 },
    'Schwimmen': { leicht: 5.3, moderat: 7, hart: 9.8 },
    'Crosstrainer': { leicht: 4.5, moderat: 6.5, hart: 9 },
    'Stepper': { leicht: 5, moderat: 7, hart: 9 },
    'Seilspringen': { leicht: 8, moderat: 10, hart: 12.3 },
    'HIIT': { leicht: 6, moderat: 8.5, hart: 11 },
    'Crossfit': { leicht: 6, moderat: 9, hart: 12 },
  };
  const row = metTable[kind] || { leicht: 4, moderat: 6, hart: 8 };
  const met = row[intensity] || row.moderat;
  return Math.round(met * 3.5 * w / 200 * (minutes || 0));
}

// ============================================================
// BAUSTEIN 2: Recovery — wie Cardio & Kraft sich gegenseitig beeinflussen
// ============================================================
// Gibt einen Erholungs-Score 0..100 und einen Hinweis zurück.
// Eingaben: gestriges hartes Training (Kraft-Volumen + Cardio-Minuten),
//           Schlaf (h) und Schlafqualität (1-10) aus dem letzten Check-in.
export function recoveryStatus({ yesterdayHardCardioMin = 0, yesterdayWasTraining = false, sleepHours = null, sleepQuality = null }) {
  let score = 100;
  if (yesterdayWasTraining) score -= 18;
  if (yesterdayHardCardioMin > 0) score -= Math.min(30, yesterdayHardCardioMin * 0.6);
  if (sleepHours != null) {
    if (sleepHours < 6) score -= 22;
    else if (sleepHours < 7) score -= 10;
  }
  if (sleepQuality != null && sleepQuality < 5) score -= 12;
  score = Math.max(0, Math.min(100, Math.round(score)));
  let label, advice;
  if (score >= 75) { label = 'Top erholt'; advice = 'Volle Leistung möglich — geh ans Limit.'; }
  else if (score >= 50) { label = 'Solide'; advice = 'Trainiere normal, achte auf saubere Technik.'; }
  else if (score >= 30) { label = 'Angeschlagen'; advice = 'Halte das Volumen moderat, kürze Cardio.'; }
  else { label = 'Erschöpft'; advice = 'Erwäge einen leichten Tag oder Ruhetag.'; }
  return { score, label, advice };
}

// ============================================================
// ONBOARDING-EMPFEHLUNGEN: Kalorien + Makros + Trainingsplan
// ============================================================

// Grundumsatz (BMR) nach Mifflin-St-Jeor
export function bmr({ gender, weightKg, heightCm, age }) {
  const w = Number(weightKg) || 70, h = Number(heightCm) || 175, a = Number(age) || 30;
  const base = 10 * w + 6.25 * h - 5 * a;
  return Math.round(gender === 'female' ? base - 161 : base + 5);
}

// Aktivitätsfaktor aus Trainingstagen/Woche
function activityFactor(daysPerWeek) {
  const d = Number(daysPerWeek) || 3;
  if (d <= 1) return 1.3;
  if (d <= 2) return 1.45;
  if (d <= 3) return 1.55;
  if (d <= 4) return 1.65;
  if (d <= 5) return 1.75;
  return 1.85;
}

// Komplette Kalorien-/Makro-Empfehlung
export function nutritionPlan({ gender, weightKg, heightCm, age, goal, daysPerWeek }) {
  const b = bmr({ gender, weightKg, heightCm, age });
  const tdee = Math.round(b * activityFactor(daysPerWeek));
  const w = Number(weightKg) || 70;
  // Ziel-Anpassung: Trainingstag vs Ruhetag leicht unterschiedlich
  let trainKcal, restKcal, proteinPerKg;
  if (goal === 'muscle') {
    trainKcal = Math.round(tdee * 1.12);   // +12% Überschuss am Trainingstag
    restKcal = Math.round(tdee * 1.05);    // +5% am Ruhetag
    proteinPerKg = 2.0;
  } else if (goal === 'fatloss') {
    trainKcal = Math.round(tdee * 0.88);   // -12% am Trainingstag
    restKcal = Math.round(tdee * 0.80);    // -20% am Ruhetag
    proteinPerKg = 2.2;                    // mehr Protein zum Muskelerhalt
  } else { // health / maintain
    trainKcal = tdee;
    restKcal = Math.round(tdee * 0.95);
    proteinPerKg = 1.8;
  }
  // Makros für den Trainingstag (Ruhetag analog skaliert über kcal)
  const protein = Math.round(w * proteinPerKg);
  const fat = Math.round((trainKcal * 0.25) / 9);          // 25% Fett
  const carbs = Math.round((trainKcal - protein * 4 - fat * 9) / 4); // Rest Carbs
  return { bmr: b, tdee, trainKcal, restKcal,
    macros: { protein, carbs: Math.max(0, carbs), fat } };
}

// Trainingsplan-Vorlage nach Ziel/Erfahrung/Frequenz
// Liefert Array von Tagen: [{name, exercises:[{muscle,name,target_sets,target_reps,technique}]}]
export function generatePlan({ goal, experience, daysPerWeek }) {
  const d = Number(daysPerWeek) || 3;
  // Reps-Schema nach Ziel
  const reps = goal === 'muscle' ? '8-12' : goal === 'fatloss' ? '12-15' : '10-12';
  const heavyReps = goal === 'muscle' ? '6-10' : '10-12';
  const sets = experience === 'beginner' ? 3 : experience === 'advanced' ? 4 : 3;

  // Übungs-Bausteine
  const ex = (muscle, name, r = reps) => ({ muscle, name, target_sets: sets, target_reps: r, technique: '' });
  const fullBody = { name: 'Ganzkörper', exercises: [
    ex('Beine', 'Kniebeuge / Beinpresse', heavyReps), ex('Brust', 'Bankdrücken / Liegestütz', heavyReps),
    ex('Rücken', 'Rudern / Latzug'), ex('Schultern', 'Schulterdrücken'), ex('Core', 'Plank') ] };
  const upper = { name: 'Oberkörper', exercises: [
    ex('Brust', 'Bankdrücken', heavyReps), ex('Rücken', 'Latzug / Klimmzug'), ex('Schultern', 'Schulterdrücken'),
    ex('Bizeps', 'Bizeps-Curls'), ex('Trizeps', 'Trizeps-Drücken') ] };
  const lower = { name: 'Unterkörper', exercises: [
    ex('Quads', 'Kniebeuge / Beinpresse', heavyReps), ex('Hamstrings', 'Rumänisches Kreuzheben'),
    ex('Glutes', 'Hip Thrust'), ex('Waden', 'Wadenheben'), ex('Core', 'Beinheben') ] };
  const push = { name: 'Push', exercises: [
    ex('Brust', 'Bankdrücken', heavyReps), ex('Schultern', 'Schulterdrücken'), ex('Brust', 'Schrägbankdrücken'),
    ex('Trizeps', 'Trizeps-Drücken') ] };
  const pull = { name: 'Pull', exercises: [
    ex('Rücken', 'Klimmzug / Latzug', heavyReps), ex('Rücken', 'Rudern'), ex('Bizeps', 'Bizeps-Curls'),
    ex('Schultern', 'Face Pulls') ] };
  const legs = { name: 'Beine', exercises: [
    ex('Quads', 'Kniebeuge', heavyReps), ex('Hamstrings', 'Kreuzheben'), ex('Glutes', 'Ausfallschritte'),
    ex('Waden', 'Wadenheben') ] };

  if (d <= 2) return [ { ...fullBody, name: 'Ganzkörper A' }, { ...fullBody, name: 'Ganzkörper B' } ].slice(0, Math.max(1, d));
  if (d === 3) return [ push, pull, legs ];
  if (d === 4) return [ { ...upper, name: 'Oberkörper 1' }, { ...lower, name: 'Unterkörper 1' },
                        { ...upper, name: 'Oberkörper 2' }, { ...lower, name: 'Unterkörper 2' } ];
  if (d === 5) return [ push, pull, legs, upper, lower ];
  return [ push, pull, legs, push, pull, legs ].slice(0, d); // 6+
}

// ============================================================
// MAHLZEITENPLAN-GENERATOR
// ============================================================

// Kuratierter Lebensmittel-Katalog mit Rollen + Mahlzeiteignung.
// Werte pro 100 g (p=Protein, c=Kohlenhydrate, f=Fett in g).
// roles: protein|carb|fat|fruit|veg · meals: b(Frühstück) l(Mittag) d(Abend) s(Snack)
// diet: 'vegan' | 'veg' (vegetarisch) | '' (enthält Fleisch/Fisch)
// maxG: realistische Portions-Obergrenze · pieceG: Gramm pro Stück (für Einkaufsliste)
const MEAL_FOODS = [
  { name: 'Haferflocken', p: 13.5, c: 58.7, f: 7, role: 'carb', meals: 'bs', diet: 'vegan', maxG: 120 },
  { name: 'Vollkornbrot', p: 9, c: 41, f: 3, role: 'carb', meals: 'b', diet: 'vegan', maxG: 180, pieceG: 45 },
  { name: 'Magerquark', p: 12, c: 4, f: 0.3, role: 'protein', meals: 'bs', diet: 'veg', maxG: 350 },
  { name: 'Skyr', p: 11, c: 4, f: 0.2, role: 'protein', meals: 'bs', diet: 'veg', maxG: 350 },
  { name: 'Hüttenkäse', p: 11, c: 3, f: 4.3, role: 'protein', meals: 'bs', diet: 'veg', maxG: 300 },
  { name: 'Eier', p: 13, c: 1, f: 11, role: 'protein', meals: 'b', diet: 'veg', maxG: 240, pieceG: 60 },
  { name: 'Whey Protein', p: 80, c: 8, f: 6, role: 'protein', meals: 'bs', diet: 'veg', maxG: 50 },
  { name: 'Veganes Proteinpulver', p: 75, c: 8, f: 5, role: 'protein', meals: 'bs', diet: 'vegan', maxG: 50 },
  { name: 'Sojajoghurt (natur)', p: 4, c: 2.3, f: 2.3, role: 'protein', meals: 'bs', diet: 'vegan', maxG: 350 },
  { name: 'Banane', p: 1.1, c: 23, f: 0.3, role: 'fruit', meals: 'bs', diet: 'vegan', maxG: 240, pieceG: 120 },
  { name: 'Apfel', p: 0.3, c: 14, f: 0.2, role: 'fruit', meals: 's', diet: 'vegan', maxG: 180, pieceG: 180 },
  { name: 'Beeren', p: 1, c: 12, f: 0.3, role: 'fruit', meals: 'bs', diet: 'vegan', maxG: 200 },
  { name: 'Erdnussbutter', p: 25, c: 20, f: 50, role: 'fat', meals: 'bs', diet: 'vegan', maxG: 40 },
  { name: 'Mandeln', p: 21, c: 20, f: 50, role: 'fat', meals: 's', diet: 'vegan', maxG: 50 },
  { name: 'Avocado', p: 2, c: 9, f: 15, role: 'fat', meals: 'bl', diet: 'vegan', maxG: 120 },
  { name: 'Olivenöl', p: 0, c: 0, f: 100, role: 'fat', meals: 'ld', diet: 'vegan', maxG: 25 },
  { name: 'Hähnchenbrust', p: 23, c: 0, f: 1.5, role: 'protein', meals: 'ld', diet: '', maxG: 300 },
  { name: 'Pute', p: 24, c: 0, f: 1, role: 'protein', meals: 'ld', diet: '', maxG: 300 },
  { name: 'Rinderhack (5% Fett)', p: 21, c: 0, f: 5, role: 'protein', meals: 'ld', diet: '', maxG: 300 },
  { name: 'Lachs', p: 20, c: 0, f: 13, role: 'protein', meals: 'ld', diet: '', maxG: 250 },
  { name: 'Thunfisch', p: 23, c: 0, f: 1, role: 'protein', meals: 'ld', diet: '', maxG: 200 },
  { name: 'Tofu', p: 12, c: 2, f: 7, role: 'protein', meals: 'ld', diet: 'vegan', maxG: 300 },
  { name: 'Tempeh', p: 19, c: 9, f: 11, role: 'protein', meals: 'ld', diet: 'vegan', maxG: 200 },
  { name: 'Kichererbsen (gekocht)', p: 9, c: 27, f: 2.6, role: 'protein', meals: 'ld', diet: 'vegan', maxG: 250 },
  { name: 'Linsen', p: 9, c: 20, f: 0.4, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 300 },
  { name: 'Reis', p: 6.7, c: 80, f: 0.7, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 150 },
  { name: 'Vollkornnudeln', p: 12, c: 72, f: 1.5, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 150 },
  { name: 'Kartoffeln', p: 2, c: 15, f: 0.1, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 500 },
  { name: 'Süßkartoffeln', p: 1.6, c: 20, f: 0.1, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 450 },
  { name: 'Quinoa (gekocht)', p: 4.4, c: 21, f: 1.9, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 350 },
  { name: 'Brokkoli', p: 2.8, c: 7, f: 0.4, role: 'veg', meals: 'ld', diet: 'vegan', maxG: 400 },
  { name: 'Gemüse gemischt', p: 2, c: 7, f: 0.3, role: 'veg', meals: 'ld', diet: 'vegan', maxG: 500 },
  { name: 'Spinat', p: 2.9, c: 3.6, f: 0.4, role: 'veg', meals: 'ld', diet: 'vegan', maxG: 200 },
];

const kcalOf = (food, grams) => (food.p * 4 + food.c * 4 + food.f * 9) * grams / 100;
const density = f => f.p * 4 + f.c * 4 + f.f * 9; // kcal pro 100 g
const isDisliked = (name, disliked) => (disliked || []).some(d => {
  const a = name.toLowerCase(), b = String(d).toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
});
const dietOk = (food, dietType) =>
  dietType === 'vegan' ? food.diet === 'vegan'
  : dietType === 'vegetarian' ? food.diet !== ''
  : true;

// Lebensmittel einer Rolle wählen – passend zu Mahlzeit, Ernährungsweise und Ziel.
// fatloss bevorzugt kalorienarme (voluminöse) Optionen, muscle darf dichte nehmen.
// `dense=true` (für Auffüllen) bevorzugt kaloriendichte Optionen.
function pickFood(role, mealSlot, disliked, seed, dietType, goal, dense) {
  let cands = MEAL_FOODS.filter(x => x.role === role && dietOk(x, dietType) && !isDisliked(x.name, disliked));
  const slotted = cands.filter(x => x.meals.includes(mealSlot));
  if (slotted.length) cands = slotted; // sonst Fallback: Rolle ohne Slot (diet bleibt strikt)
  if (!cands.length) return null;
  if (dense) { // zum Auffüllen: kaloriendichteste bevorzugen
    const byDense = cands.slice().sort((a, b) => density(b) - density(a));
    return byDense[seed % Math.min(3, byDense.length)];
  }
  if (goal === 'fatloss') { // Abnehmen: aus den kalorienärmeren 60 % wählen (mehr Volumen)
    const byLight = cands.slice().sort((a, b) => density(a) - density(b));
    const n = Math.max(1, Math.ceil(byLight.length * 0.6));
    return byLight[seed % n];
  }
  return cands[seed % cands.length]; // Standard: Katalog-Reihenfolge rotieren (ausgewogen)
}

// Erzeugt einen Tagesplan, der das kcal-Ziel eng trifft (±3 %, sofern mit realistischen
// Portionen erreichbar) und die Ernährungsweise (vegan/vegetarisch) strikt respektiert.
export function generateMealPlan({ kcalTarget, macros, disliked = [], mealCount = 4, goal = 'all', dietType = 'all' }) {
  const kcal = Number(kcalTarget) || 2200;
  const targetProtein = (macros && macros.protein) || Math.round((kcal * 0.3) / 4);

  let splits;
  if (mealCount <= 3) splits = [
    { label: 'Frühstück', slot: 'b', share: 0.33 },
    { label: 'Mittagessen', slot: 'l', share: 0.37 },
    { label: 'Abendessen', slot: 'd', share: 0.30 },
  ];
  else if (mealCount >= 5) splits = [
    { label: 'Frühstück', slot: 'b', share: 0.22 },
    { label: 'Snack', slot: 's', share: 0.13 },
    { label: 'Mittagessen', slot: 'l', share: 0.28 },
    { label: 'Snack 2', slot: 's', share: 0.12 },
    { label: 'Abendessen', slot: 'd', share: 0.25 },
  ];
  else splits = [
    { label: 'Frühstück', slot: 'b', share: 0.28 },
    { label: 'Mittagessen', slot: 'l', share: 0.32 },
    { label: 'Abendessen', slot: 'd', share: 0.28 },
    { label: 'Snack', slot: 's', share: 0.12 },
  ];

  const findFood = name => MEAL_FOODS.find(x => x.name === name);
  const mkItem = (food, grams) => {
    const g = Math.max(10, Math.min(food.maxG || 400, Math.round(grams / 5) * 5));
    return { food: food.name, amount: g,
      kcal: Math.round(kcalOf(food, g)),
      protein: Math.round(food.p * g / 100 * 10) / 10,
      carbs: Math.round(food.c * g / 100 * 10) / 10,
      fat: Math.round(food.f * g / 100 * 10) / 10 };
  };

  const meals = splits.map((s, i) => {
    const mealKcal = kcal * s.share;
    const mealProtein = targetProtein * s.share;
    const items = [];
    const pf = pickFood('protein', s.slot, disliked, i, dietType, goal);
    if (pf) items.push(mkItem(pf, (mealProtein * 0.7) / (pf.p / 100)));
    const cf = pickFood('carb', s.slot, disliked, i, dietType, goal);
    if (cf) {
      const used = items.reduce((a, it) => a + it.kcal, 0);
      items.push(mkItem(cf, (Math.max(120, mealKcal - used) * 0.7) / (density(cf) / 100)));
    }
    if (s.slot === 'l' || s.slot === 'd') {
      const vf = pickFood('veg', s.slot, disliked, i + 1, dietType, goal);
      if (vf) items.push(mkItem(vf, goal === 'fatloss' ? 200 : 150));
    } else {
      const ff = pickFood('fruit', s.slot, disliked, i + 1, dietType, goal);
      if (ff) items.push(mkItem(ff, ff.pieceG || 100));
    }
    // Mahlzeit grob aufs Teilziel skalieren (Caps respektiert)
    for (let pass = 0; pass < 2; pass++) {
      const actual = items.reduce((a, it) => a + it.kcal, 0);
      if (actual <= 0) break;
      const factor = mealKcal / actual;
      if (Math.abs(factor - 1) < 0.04) break;
      for (const it of items) Object.assign(it, mkItem(findFood(it.food), it.amount * factor));
    }
    return { label: s.label, slot: s.slot, items };
  });

  // Globaler Genauigkeits-Pass: so nah wie möglich ans Tagesziel (±3 %).
  // Reicht Hochskalieren (Caps!) nicht, wird gezielt aufgefüllt – Ziel-gerecht:
  // fatloss füllt mit Carbs/magerem Protein (kein Öl/Nussmus), muscle mit dichten Quellen.
  const total = () => meals.reduce((a, m) => a + m.items.reduce((x, it) => x + it.kcal, 0), 0);
  for (let pass = 0; pass < 8; pass++) {
    const t = total();
    if (t >= kcal * 0.97 && t <= kcal * 1.03) break;
    if (t > kcal * 1.03) { // runter skalieren
      const f = (kcal / t);
      for (const m of meals) for (const it of m.items) Object.assign(it, mkItem(findFood(it.food), it.amount * f));
      continue;
    }
    // hoch: erst proportional bis an die Caps …
    const f = Math.min(1.5, kcal / t);
    let grew = false;
    for (const m of meals) for (const it of m.items) {
      const before = it.amount;
      Object.assign(it, mkItem(findFood(it.food), it.amount * f));
      if (it.amount > before) grew = true;
    }
    if (grew) continue;
    // … Caps erreicht: Filler-Item in die größte Mahlzeit
    const deficit = kcal - total();
    if (deficit < 120) break;
    const big = meals.reduce((a, b) => (a.items.reduce((x, i2) => x + i2.kcal, 0) > b.items.reduce((x, i2) => x + i2.kcal, 0) ? a : b));
    const fillerRoles = goal === 'fatloss' ? ['carb', 'protein'] : ['fat', 'carb'];
    let added = false;
    for (const role of fillerRoles) {
      const cand = pickFood(role, big.slot, disliked.concat(big.items.map(i2 => i2.food)), pass, dietType, goal, goal !== 'fatloss');
      if (!cand) continue;
      const grams = (deficit / (density(cand) / 100));
      const item = mkItem(cand, grams);
      if (item.kcal < 40) continue;
      big.items.push(item); added = true; break;
    }
    if (!added) break; // nichts mehr möglich -> bestmögliches Ergebnis behalten
  }

  // Protein-Absicherung: falls deutlich unter Ziel, Proteinquellen anheben (Caps!)
  const proteinNow = () => meals.reduce((a, m) => a + m.items.reduce((x, it) => x + it.protein, 0), 0);
  if (proteinNow() < targetProtein * 0.75) {
    for (const m of meals) for (const it of m.items) {
      const f = findFood(it.food);
      if (f && f.role === 'protein' && it.amount < (f.maxG || 400)) Object.assign(it, mkItem(f, it.amount * 1.3));
    }
  }

  const done = meals.map(m => {
    const mKcal = m.items.reduce((a, it) => a + it.kcal, 0);
    const mProt = Math.round(m.items.reduce((a, it) => a + it.protein, 0));
    return { ...m, kcal: mKcal, protein: mProt };
  });
  const totals = {
    kcal: done.reduce((a, m) => a + m.kcal, 0),
    protein: Math.round(done.reduce((a, m) => a + m.items.reduce((x, it) => x + it.protein, 0), 0)),
    carbs: Math.round(done.reduce((a, m) => a + m.items.reduce((x, it) => x + it.carbs, 0), 0)),
    fat: Math.round(done.reduce((a, m) => a + m.items.reduce((x, it) => x + it.fat, 0), 0)),
  };
  return { meals: done, totals, kcalTarget: kcal, proteinTarget: targetProtein };
}

// Stück-Info für die Einkaufsliste (z.B. Eier ≈ 60 g/Stück)
export function pieceInfo(name) {
  const f = MEAL_FOODS.find(x => x.name === name);
  return f && f.pieceG ? { pieceG: f.pieceG } : null;
}

// Liste auswählbarer „mag ich nicht"-Lebensmittel fürs Onboarding (aus dem Katalog)
export function dislikeOptions() {
  return ['Eier', 'Lachs', 'Thunfisch', 'Rinderhack (5% Fett)', 'Tofu', 'Tempeh', 'Linsen', 'Hüttenkäse',
    'Magerquark', 'Brokkoli', 'Süßkartoffeln', 'Quinoa (gekocht)', 'Kichererbsen (gekocht)', 'Avocado', 'Erdnussbutter', 'Mandeln'];
}


// ============================================================
// STREAKS & ATHLETEN-AMPEL (reine Logik)
// ============================================================

// Tages-Streak: wie viele Tage in Folge (endend heute oder gestern) ein Eintrag existiert.
// dates = Array 'YYYY-MM-DD'. Heute darf noch fehlen (Streak "läuft noch").
export function streakDays(dates, todayStr) {
  const set = new Set(dates || []);
  const fmt = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const d = todayStr ? new Date(todayStr + 'T00:00:00') : new Date();
  if (!set.has(fmt(d))) d.setDate(d.getDate() - 1); // heute noch offen -> ab gestern zählen
  let n = 0;
  while (set.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Wochenziel-Serie: wie viele Wochen in Folge wurde die Ziel-Frequenz (Trainingstage/Woche)
// erreicht? Die laufende Woche zählt nur, wenn das Ziel schon erfüllt ist – sonst ab Vorwoche.
export function weeklyGoalStreak(dates, goalPerWeek, todayStr) {
  const goal = Math.max(1, Number(goalPerWeek) || 1);
  const fmt = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const monday = ds => { const d = new Date(ds + 'T00:00:00'); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return fmt(d); };
  const perWeek = {};
  for (const d of (dates || [])) { const m = monday(d); (perWeek[m] = perWeek[m] || new Set()).add(d); }
  const cnt = k => (perWeek[k] ? perWeek[k].size : 0);
  const prevMon = k => { const d = new Date(k + 'T00:00:00'); d.setDate(d.getDate() - 7); return fmt(d); };
  let m = monday(todayStr || fmt(new Date()));
  if (cnt(m) < goal) m = prevMon(m);
  let n = 0;
  while (cnt(m) >= goal) { n++; m = prevMon(m); }
  return n;
}

// Ampel-Status für einen Athleten aus Sicht des Coaches.
// Liefert { level: 'ok'|'watch'|'alert', reasons: [...] }.
export function attentionStatus({ daysSinceCheckin, daysSinceTraining, openFlags }) {
  const reasons = []; let level = 'ok';
  const bump = l => { if (l === 'alert') level = 'alert'; else if (l === 'watch' && level === 'ok') level = 'watch'; };
  if ((openFlags || 0) > 0) { reasons.push(openFlags + ' offene Beschwerde' + (openFlags > 1 ? 'n' : '')); bump('alert'); }
  if (daysSinceCheckin == null) { reasons.push('noch kein Check-in'); bump('watch'); }
  else if (daysSinceCheckin >= 10) { reasons.push(daysSinceCheckin + ' Tage kein Check-in'); bump('alert'); }
  else if (daysSinceCheckin >= 5) { reasons.push(daysSinceCheckin + ' Tage kein Check-in'); bump('watch'); }
  if (daysSinceTraining == null) { reasons.push('noch kein Training geloggt'); bump('watch'); }
  else if (daysSinceTraining >= 10) { reasons.push(daysSinceTraining + ' Tage kein Training'); bump('alert'); }
  else if (daysSinceTraining >= 6) { reasons.push(daysSinceTraining + ' Tage kein Training'); bump('watch'); }
  return { level, reasons };
}

// ============================================================
// PERSÖNLICHE REKORDE (PRs) + 1RM-Schätzung
// ============================================================

// Geschätztes 1-Rep-Max nach Epley-Formel
export function estimate1RM(weight, reps) {
  const w = Number(weight) || 0, r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

// Findet PRs aus allen Logs einer Übung.
// rows: [{date, weight, reps}] -> liefert bestes Gewicht, beste geschätzte 1RM, bestes Volumen je Satz
export function personalRecords(rows) {
  let maxWeight = 0, maxWeightReps = 0, maxWeightDate = null;
  let best1RM = 0, best1RMDate = null;
  let maxReps = 0, maxRepsWeight = 0;
  for (const r of (rows || [])) {
    const w = Number(r.weight) || 0, reps = Number(r.reps) || 0;
    if (w <= 0 || reps <= 0) continue;
    if (w > maxWeight) { maxWeight = w; maxWeightReps = reps; maxWeightDate = r.date; }
    const e = estimate1RM(w, reps);
    if (e > best1RM) { best1RM = e; best1RMDate = r.date; }
    if (reps > maxReps) { maxReps = reps; maxRepsWeight = w; }
  }
  return {
    maxWeight, maxWeightReps, maxWeightDate,
    best1RM, best1RMDate,
    maxReps, maxRepsWeight,
    hasData: maxWeight > 0,
  };
}

// Prüft, ob ein neuer Satz einen PR darstellt (gegen bisherige Bestwerte VOR diesem Satz)
export function isNewPR(newWeight, newReps, priorRows) {
  const prior = personalRecords(priorRows);
  const w = Number(newWeight) || 0, reps = Number(newReps) || 0;
  if (w <= 0 || reps <= 0) return null;
  const e = estimate1RM(w, reps);
  const records = [];
  if (!prior.hasData) return null; // erster Eintrag ist kein "Rekord"
  if (w > prior.maxWeight) records.push('weight');
  if (e > prior.best1RM) records.push('1rm');
  return records.length ? records : null;
}

// ============================================================
// PLATE-CALCULATOR: welche Scheiben pro Seite auf die Stange?
// ============================================================
// target = Zielgewicht gesamt, barWeight = Stangengewicht (Standard 20 kg)
// plates = verfügbare Scheibengrößen (kg), absteigend
export function platesPerSide(target, barWeight = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  const t = Number(target) || 0;
  const bar = Number(barWeight) || 0;
  if (t < bar) return { ok: false, reason: 'unter_stange', barWeight: bar, perSide: [], achievable: bar };
  let perSideKg = (t - bar) / 2;
  const result = [];
  for (const p of plates) {
    let count = 0;
    while (perSideKg >= p - 1e-9) { perSideKg -= p; count++; }
    if (count > 0) result.push({ plate: p, count });
  }
  const used = result.reduce((s, r) => s + r.plate * r.count, 0);
  const achievable = bar + used * 2;
  return {
    ok: Math.abs(achievable - t) < 1e-9,
    barWeight: bar,
    perSide: result,
    achievable: Math.round(achievable * 100) / 100,
    remainder: Math.round((t - achievable) * 100) / 100,
  };
}
