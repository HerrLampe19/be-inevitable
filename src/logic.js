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
export function calendarRange({ pattern, trainingDays, history, startDate, days = 35, planned = {} }) {
  const pat = pattern && pattern.length ? pattern : buildPattern(4);
  const out = [];
  const sim = (history || []).slice();
  const start = new Date(startDate + 'T00:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    let entry, simType;
    if (planned[iso]) {
      // manuell festgelegt -> respektieren
      const p = planned[iso];
      entry = { date: iso, type: p.type, dayName: p.dayName || null, planned: true };
      if (p.type === 'rest') {
        // Was hätte der Rhythmus für heute vorgesehen?
        const wouldBe = suggestForToday({ pattern: pat, trainingDays, history: sim });
        // Ein eingeschobener Ruhetag an einem eigentlichen TRAININGStag verschiebt
        // den Rhythmus (wie 'sick'): der Trainingstag geht nicht verloren, sondern
        // wird nachgeholt. Fällt der Ruhetag ohnehin auf einen Ruhetag, zählt er normal.
        simType = wouldBe.type === 'train' ? 'sick' : 'rest';
      } else {
        simType = 'train';
      }
      // bei geplantem Training den rotierenden Tagesnamen ergänzen, falls nicht gesetzt
      if (p.type === 'train' && !entry.dayName) {
        const s = suggestForToday({ pattern: pat, trainingDays, history: sim });
        entry.dayName = s.dayName;
      }
    } else {
      const s = suggestForToday({ pattern: pat, trainingDays, history: sim });
      entry = { date: iso, type: s.type, dayName: s.dayName, planned: false };
      simType = s.type;
    }
    out.push(entry);
    sim.push({ type: simType, dayName: entry.dayName });
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
    'Rad': { leicht: 4, moderat: 7, hart: 10 },
    'Rudern': { leicht: 4.8, moderat: 7, hart: 9.5 },
    'Gehen': { leicht: 2.8, moderat: 3.8, hart: 5 },
    'Schwimmen': { leicht: 5.3, moderat: 7, hart: 9.8 },
    'HIIT': { leicht: 6, moderat: 8.5, hart: 11 },
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
