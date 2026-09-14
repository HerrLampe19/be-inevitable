// ============================================================
// KERN-LOGIK (rein, ohne DB/Server) — damit hart testbar.
// ============================================================

// ---- Zeitzone der Nutzer (Server läuft meist in UTC) ----
// "Heute" und Uhrzeiten für Erinnerungen werden in APP_TZ berechnet (Standard: Europe/Berlin),
// damit Check-ins/Logs kurz nach Mitternacht nicht auf dem Vortag landen und Push-Zeiten stimmen.
export const APP_TZ = process.env.APP_TZ || 'Europe/Berlin';
let _tzDateFmt, _tzHourFmt;
try {
  _tzDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  _tzHourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, hour: '2-digit', hour12: false });
} catch (e) {
  console.error('[tz] Ungueltige APP_TZ "' + APP_TZ + '" - Rueckfall auf UTC');
  _tzDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
  _tzHourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', hour12: false });
}
// ISO-Datum 'YYYY-MM-DD' des aktuellen Tages in APP_TZ
export function tzToday(d = new Date()) { return _tzDateFmt.format(d); }
// Stunde 0-23 in APP_TZ
export function tzHour(d = new Date()) { return parseInt(_tzHourFmt.format(d), 10) % 24; }
// Wochentag 0 (So) - 6 (Sa) in APP_TZ
export function tzWeekday(d = new Date()) { return new Date(tzToday(d) + 'T00:00:00Z').getUTCDay(); }
// Montag der Kalenderwoche eines ISO-Datums (reine UTC-Arithmetik, zeitzonen-unabhaengig)
export function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z'); const w = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10);
}

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
// Gewicht fuer Nutzertexte: deutsches Komma, aber keine erzwungene Nachkommastelle („80 kg", „82,5 kg").
function _kg(x) { return String(Math.round(Number(x) * 10) / 10).replace('.', ','); }

export function recommend(lastSets, targetReps, stepKg = 2.5) {
  const range = parseRepRange(targetReps);
  const valid = (lastSets || []).filter(s => s && s.weight != null && s.reps != null && s.reps > 0);
  if (!valid.length) {
    return { type: 'none', text: range ? `Ziel: ${range.min === range.max ? range.min : range.min + '-' + range.max} Reps` : 'Leg los — trag deine Sätze ein.' };
  }
  // "Bester" Satz: die staerkste Leistung, nicht das hoechste Gewicht.
  // Bis 2.4.0 gewann schlicht das schwerste Gewicht. Ein einzelner schwerer Satz (Drop-Set,
  // Rest-Pause, ein Maximalversuch) machte damit die Empfehlung fuer den naechsten Arbeitssatz
  // kaputt: [120 kg x 1, 80 kg x 12] ergab „Nur 1 Reps. Versuch 117,5 kg" – 35 kg / 43 % daneben
  // (RECHEN-REVIEW D4). Jetzt zaehlen (1.) nur Saetze, die ueberhaupt in die Naehe des Zielbereichs
  // kommen, und (2.) das geschaetzte 1RM als Vergleichsmass; bei Gleichstand das hoehere Gewicht.
  const pool = range ? valid.filter(s => s.reps >= range.min - 3) : valid;
  const cand = pool.length ? pool : valid; // nur Schwerversuche vorhanden: dann eben diese
  // Vergleichsmass: Epley, aber mit bei 12 Wiederholungen gedeckelten Reps – oberhalb davon ueberschaetzt
  // die Formel (60 kg x 15 kaeme sonst auf 90 kg und schluege den schwereren Satz 67,5 kg x 8 mit 85,5 kg,
  // RECHEN-REVIEW D14). Die Zahl wird hier nie angezeigt, sie sortiert nur.
  const strength = s => (Number(s.weight) || 0) * (1 + Math.min(Number(s.reps) || 0, E1RM_MAX_REPS) / 30);
  const best = cand.slice().sort((a, b) =>
    (strength(b) - strength(a)) || (b.weight - a.weight) || (b.reps - a.reps))[0];
  if (!range) {
    return { type: 'hold', weight: best.weight, text: `Letztes Mal: ${_kg(best.weight)} kg × ${best.reps}. Schlag das!` };
  }
  if (best.reps > range.max) {
    const nw = Math.round((best.weight + stepKg) * 2) / 2;
    return { type: 'up', weight: nw, fromWeight: best.weight, text: `Stark! ${best.reps} Reps geschafft. Empfehlung: ${_kg(nw)} kg (+${_kg(stepKg)}).` };
  }
  if (best.reps < range.min) {
    const nw = Math.max(0, Math.round((best.weight - stepKg) * 2) / 2);
    // „Versuch 0 kg" war bis 2.4.0 moeglich: 1,5 kg Kurzhantel minus 2,5 kg Schrittweite ergab 0 und
    // wurde als Empfehlung ausgeschrieben (RECHEN-REVIEW D23). Wo es nach unten nichts mehr gibt,
    // ist die ehrliche Empfehlung: Gewicht lassen, Technik und Wiederholungen verbessern.
    if (nw <= 0) {
      return { type: 'hold', weight: best.weight, fromWeight: best.weight,
        text: `Nur ${best.reps} Reps. Leichter geht hier nicht — bleib bei ${_kg(best.weight)} kg und arbeite an sauberer Technik.` };
    }
    return { type: 'down', weight: nw, fromWeight: best.weight, text: `Nur ${best.reps} Reps. Versuch ${_kg(nw)} kg, dann saubere Technik.` };
  }
  return { type: 'hold', weight: best.weight, text: `${_kg(best.weight)} kg halten. Ziel: Richtung ${range.max} Reps arbeiten (zuletzt ${best.reps}).` };
}

// ============================================================
// FREQUENZ-SEQUENZ (dynamischer Rhythmus, nicht wochentagbasiert)
// ============================================================
// pattern: Array von Slots, die sich endlos wiederholen – KEIN Wochenraster.
// Ein Slot ist entweder
//   'rest'                          Ruhetag
//   'train'                         Trainingstag, Tagesname rotiert automatisch
//   {type:'train', day:'Upper 1'}   Trainingstag mit FESTEM Tag (z.B. O1,U1,Ruhe,O2,U2,Ruhe)
// trainingDays: Liste der Tagesnamen in Reihenfolge, z.B. ['Lower 1','Upper 1','Lower 2','Upper 2']
//   -> die automatischen 'train'-Slots werden der Reihe nach damit gefüllt (rotierend); fest
//      belegte Tage sind reserviert und fallen aus dieser Rotation heraus.
// history: Array vergangener Tage [{date, type:'train'|'rest'|'sick', dayName?}] chronologisch.
//
// Der "Zeiger" ergibt sich aus der Historie: jeder absolvierte Trainingstag rückt
// die Trainingsrotation um 1 weiter; rest/sick rücken nur das Pattern weiter.

// Slot-Typ ('train' | 'rest') und fest hinterlegter Tagesname eines Pattern-Slots.
// Alte Datenbanken enthalten nur die Strings 'train'/'rest' – die bleiben unveraendert gueltig.
export function slotType(slot) {
  const t = (slot && typeof slot === 'object') ? slot.type : slot;
  return t === 'train' ? 'train' : 'rest';
}
export function slotDay(slot) {
  const d = (slot && typeof slot === 'object') ? slot.day : null;
  return (typeof d === 'string' && d.trim()) ? d.trim() : null;
}

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

// Tage, die in KEINEM Slot fest vergeben sind – nur durch sie rotieren die automatischen Slots.
// So kollidiert ein Muster wie [O1, auto, Ruhe] nicht mit dem fest gesetzten O1.
function rotationDays(pattern, trainingDays) {
  const all = (trainingDays || []).filter(Boolean);
  if (!all.length) return [];
  const fixed = new Set((pattern || []).map(slotDay).filter(Boolean));
  const free = all.filter(n => !fixed.has(n));
  return free.length ? free : all;
}

// Was ist für ein gegebenes Datum dran? (Vorschlag, überschreibbar)
export function suggestForToday({ pattern, trainingDays, history }) {
  const pat = pattern && pattern.length ? pattern : buildPattern(4);
  const slot = pat[patternIndex(history, pat)];
  if (slotType(slot) !== 'train') return { type: 'rest', dayName: null };
  // Fest hinterlegter Tag gewinnt – solange es ihn im Plan noch gibt (sonst automatisch weiter).
  const fixed = slotDay(slot);
  if (fixed && (!trainingDays || !trainingDays.length || trainingDays.includes(fixed)))
    return { type: 'train', dayName: fixed };
  // Trainingstag: rotierender Index über die frei gebliebenen Tage. Fest gesetzte Tage zählen
  // dabei NICHT mit – sonst würde ein gepinntes O1 die Reihenfolge der übrigen Tage verschieben.
  const rot0 = rotationDays(pat, trainingDays);
  if (!rot0.length) return { type: 'train', dayName: null };
  const pinned = new Set(pat.map(slotDay).filter(Boolean));
  const done = pinned.size
    ? (history || []).filter(h => h.type === 'train' && !pinned.has(h.dayName)).length
    : completedTrainings(history);
  return { type: 'train', dayName: rot0[done % rot0.length] };
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
  // Reine UTC-Arithmetik (kein lokales Datum + toISOString: das kippt je nach Serverzeitzone/DST um einen Tag)
  const start = new Date(startDate + 'T00:00:00Z');
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
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
// MAHLZEITEN-SLOTS: EIN Vokabular für Protokoll, Plan und Rezepte
// ============================================================
// Wird von POST /api/foodlog, /foodlog/frommeal, /recipes/:id/log validiert und vom
// Frontend (Slot-Auswahl, Sortierung des Tagesprotokolls) 1:1 benutzt.
export const MEAL_SLOTS = ['Frühstück', 'Mittag', 'Abend', 'Snack', 'Pre-Workout', 'Post-Workout'];

// Slot nach Uhrzeit (Fallback, wenn keiner angegeben ist): <10 Frühstück, <14 Mittag, <17 Snack, sonst Abend
export function slotByHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return 'Abend';
  return h < 10 ? 'Frühstück' : h < 14 ? 'Mittag' : h < 17 ? 'Snack' : 'Abend';
}

// Freitext (Plan-Label wie „Mittagessen 1", Rezept-Kategorie, alte Slot-Namen wie „Pre/Post Workout")
// auf den Slot abbilden. null, wenn nichts passt. `opts.trainedToday` entscheidet bei „Pre/Post Workout".
export function slotFromLabel(label, opts = {}) {
  const s = String(label || '').trim().toLowerCase();
  if (!s) return null;
  const exact = MEAL_SLOTS.find(x => x.toLowerCase() === s);
  if (exact) return exact;
  if (/pre[\s/-]*post|post[\s/-]*pre/.test(s)) return opts.trainedToday ? 'Post-Workout' : 'Pre-Workout';
  if (/\bpre[\s-]*workout|vor dem training|pre[\s-]*wo\b/.test(s)) return 'Pre-Workout';
  if (/\bpost[\s-]*workout|nach dem training|post[\s-]*wo\b/.test(s)) return 'Post-Workout';
  if (/fr(ü|u|ue)hst(ü|u|ue)ck|breakfast|morgen/.test(s)) return 'Frühstück';
  if (/mittag|lunch/.test(s)) return 'Mittag';
  if (/abend|dinner|nacht/.test(s)) return 'Abend';
  if (/snack|zwischen|jause/.test(s)) return 'Snack';
  return null;
}

// Eingabe validieren: gültiger Slot -> Slot; bekannter Alt-Name -> Slot; leer -> Uhrzeit-Fallback; Unbekanntes -> null (400)
export function normalizeSlot(input, { hour, trainedToday } = {}) {
  const s = String(input ?? '').trim();
  if (!s) return slotByHour(hour);
  return slotFromLabel(s, { trainedToday });
}

// Sortier-Reihenfolge eines Slots im Tagesprotokoll (unbekannte ans Ende)
export function slotOrder(slot) {
  const order = ['Frühstück', 'Pre-Workout', 'Post-Workout', 'Mittag', 'Snack', 'Abend'];
  const i = order.indexOf(slot);
  return i < 0 ? order.length : i;
}

// ============================================================
// REZEPT-ZUTATEN -> PLAN-ITEMS (Mahlzeit tauschen)
// ============================================================
// Zutatenzeile „180 g Hähnchenbrust" / „1 EL Olivenöl" / „Zimt" zerlegen.
// amount nur bei g/ml/kg/l (in Gramm bzw. Milliliter), sonst null + qty-Text ("1 EL", "1 Stück").
// seasoning=true für Zeilen ohne Mengenangabe (Gewürze o.ä.) – bekommen keine Makros.
export function parseIngredientLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;
  const m = raw.match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|½|¼|¾)\s*(kg|g|ml|l|el|tl|scoops?|scheiben?|stück|st\.?|prisen?|handvoll|becher|dosen?|packung(?:en)?|x)?\.?\s+(.+)$/i);
  if (!m) return { food: raw, amount: null, qty: null, seasoning: true };
  let n = m[1].replace(',', '.');
  if (n === '½') n = 0.5; else if (n === '¼') n = 0.25; else if (n === '¾') n = 0.75;
  else if (n.includes('/')) { const [a, b] = n.split('/').map(Number); n = b ? a / b : a; }
  n = Number(n);
  const unit = (m[2] || '').toLowerCase().replace(/\.$/, '');
  const food = m[3].trim();
  if (unit === 'g' || unit === 'ml') return { food, amount: n, unit, qty: null, seasoning: false };
  if (unit === 'kg') return { food, amount: n * 1000, unit: 'g', qty: null, seasoning: false };
  if (unit === 'l') return { food, amount: n * 1000, unit: 'ml', qty: null, seasoning: false };
  const label = unit ? (m[1] + ' ' + m[2]) : (m[1] + ' Stück');
  return { food, amount: null, unit: null, qty: label.trim(), seasoning: false };
}

// Zutaten eines Rezepts in Plan-Items mit Makros umrechnen.
// foodsLookup(name) -> {fat,carbs,protein} pro Gramm oder null (aus der Lebensmittel-DB).
// Erst werden bekannte Lebensmittel mit Grammangabe exakt berechnet; der Rest der Rezept-Nährwerte
// wird auf die übrigen Mengen-Zutaten verteilt (Gewürze ohne Menge bleiben bei 0). Am Ende stimmen
// die Summen mit dem Rezept überein – so bleibt der Plan-Tagesbedarf korrekt.
export function recipeToItems(recipe, foodsLookup) {
  const lines = String(recipe?.ingredients || '').split('\n').map(parseIngredientLine).filter(Boolean);
  const total = { kcal: Number(recipe?.kcal) || 0, protein: Number(recipe?.protein) || 0, carbs: Number(recipe?.carbs) || 0, fat: Number(recipe?.fat) || 0 };
  if (!lines.length) return [{ food: recipe?.name || 'Rezept', amount: null, notes: null, ...roundMacros(total) }];
  const items = lines.map(l => ({ food: l.food, amount: l.amount, notes: l.qty || null, seasoning: l.seasoning, kcal: 0, protein: 0, carbs: 0, fat: 0, matched: false }));
  // 1) bekannte Lebensmittel exakt
  for (const it of items) {
    if (it.amount == null || !foodsLookup) continue;
    const f = foodsLookup(it.food);
    if (!f) continue;
    it.protein = (f.protein || 0) * it.amount; it.carbs = (f.carbs || 0) * it.amount; it.fat = (f.fat || 0) * it.amount;
    it.kcal = it.protein * 4 + it.carbs * 4 + it.fat * 9; it.matched = true;
  }
  // 2) Rest auf die unbekannten Mengen-Zutaten verteilen (nach Gramm gewichtet, sonst gleich)
  const open = items.filter(it => !it.matched && !it.seasoning);
  const sumM = k => items.filter(it => it.matched).reduce((a, it) => a + it[k], 0);
  const rest = { kcal: total.kcal - sumM('kcal'), protein: total.protein - sumM('protein'), carbs: total.carbs - sumM('carbs'), fat: total.fat - sumM('fat') };
  if (open.length) {
    const wsum = open.reduce((a, it) => a + (it.amount || 0), 0);
    for (const it of open) {
      const w = wsum > 0 ? ((it.amount || 0) / wsum) : (1 / open.length);
      for (const k of ['kcal', 'protein', 'carbs', 'fat']) it[k] = Math.max(0, rest[k]) * w;
    }
  } else if (total.kcal > 0) {
    // alles bekannt: proportional auf die Rezeptangaben skalieren (Rezept ist die Wahrheit)
    const cur = sumM('kcal');
    const f = cur > 0 ? total.kcal / cur : 1;
    for (const it of items) if (it.matched) for (const k of ['kcal', 'protein', 'carbs', 'fat']) it[k] *= f;
  }
  return items.map(it => ({ food: it.food, amount: it.amount, notes: it.notes, ...roundMacros(it) }));
}
function roundMacros(m) {
  return { kcal: Math.round(m.kcal || 0), protein: Math.round((m.protein || 0) * 10) / 10,
    carbs: Math.round((m.carbs || 0) * 10) / 10, fat: Math.round((m.fat || 0) * 10) / 10 };
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
    // Arten, die aus der Gesundheits-App kommen können (Apple Watch)
    // Krafttraining moderat stand bis 2.4.0 auf MET 5 und zahlte damit 420 statt 294 kcal fuer eine
    // Stunde (+43 %). Das Compendium of Physical Activities fuehrt „resistance training, multiple
    // exercises, 8–15 Wiederholungen" mit 3,5 und erst „vigorous effort" mit 6,0 (RECHEN-REVIEW D29).
    'Krafttraining': { leicht: 3, moderat: 3.5, hart: 6 },
    'Funktionelles Training': { leicht: 4, moderat: 6, hart: 8 },
    'Yoga': { leicht: 2.5, moderat: 3, hart: 4 },
    'Pilates': { leicht: 3, moderat: 3.8, hart: 4.5 },
    'Core': { leicht: 3, moderat: 4, hart: 5 },
    'Mobility': { leicht: 2.3, moderat: 2.8, hart: 3.5 },
  };
  // Unbekannte Sportart (jeder Trainingstyp aus der Gesundheits-App, den die Zuordnung nicht kennt):
  // bis 2.4.0 galt MET 6 – 45 Minuten Dehnen wurden so zu 378 statt ~145 kcal (+160 %). Eine
  // unbekannte Bewegung wird jetzt bewusst konservativ geschaetzt (RECHEN-REVIEW D29).
  const row = metTable[kind] || { leicht: 2.5, moderat: 3.5, hart: 6 };
  const met = row[intensity] || row.moderat;
  // Minuten und Ergebnis deckeln: `estimateCardioKcal` wird auch mit importierten Werten aufgerufen,
  // und 1440 Minuten ergaben ungebremst 25.200 kcal – der Deckel im Server galt nur fuer selbst
  // eingetragene Zahlen (RECHEN-REVIEW D29/A29).
  const min = Math.max(0, Math.min(1440, Number(minutes) || 0));
  return Math.min(20000, Math.round(met * 3.5 * w / 200 * min));
}

// ============================================================
// ONBOARDING-EMPFEHLUNGEN: Kalorien + Makros + Trainingsplan
// ============================================================

// Geschlechts-Offset der Mifflin-St-Jeor-Formel.
// Bis 2.4.0 stand hier `gender === 'female' ? -161 : +5` – jede Angabe ausser exakt 'female' (also
// 'other', 'Male' aus dem Seed, NULL bei vom Coach angelegten Athleten, Grossschreibung) landete
// stillschweigend auf der Maennerformel. Fuer eine 52-jaehrige Frau mit 'other' waren das +212 kcal
// im Tagesziel – mehr als ihr ganzes Defizit (RECHEN-REVIEW D24). Unbekannt heisst jetzt unbekannt:
// der Mittelwert beider Formeln (−78) raet nicht, sondern liegt bewusst in der Mitte.
const GENDER_OFFSET = { female: -161, male: 5, unknown: -78 };
function genderKey(gender) {
  const g = String(gender == null ? '' : gender).trim().toLowerCase();
  if (g === 'female' || g === 'weiblich' || g === 'w' || g === 'f') return 'female';
  if (g === 'male' || g === 'maennlich' || g === 'männlich' || g === 'm') return 'male';
  return 'unknown';
}

// Grundumsatz (BMR) nach Mifflin-St-Jeor.
// Fehlen Gewicht ODER Groesse, gibt es keinen Grundumsatz – dann liefert die Funktion `null` statt
// einer erfundenen Person (70 kg / 175 cm / 30 J / maennlich, RECHEN-REVIEW D25). Wer die Zahl
// trotzdem braucht, muss sich bewusst fuer einen Startwert entscheiden (siehe nutritionPlan).
// Das Alter faellt weiterhin auf 30 zurueck, wird aber von nutritionPlan als Schaetzung gekennzeichnet.
export function bmr({ gender, weightKg, heightCm, age }) {
  const w = Number(weightKg), h = Number(heightCm);
  if (!isFinite(w) || w <= 0 || !isFinite(h) || h <= 0) return null;
  const a = Number(age) > 0 ? Number(age) : 30;
  const base = 10 * w + 6.25 * h - 5 * a;
  return Math.round(base + GENDER_OFFSET[genderKey(gender)]);
}

// Aktivitätsfaktor aus Trainingstagen/Woche — STUFENLOS interpoliert.
// Stuetzstellen unveraendert: 1 -> 1,30 · 2 -> 1,45 · 3 -> 1,55 · 4 -> 1,65 · 5 -> 1,75 · ab 6 -> 1,85.
// Warum interpoliert: seit 2.5.0 liefert der Rhythmus gebrochene Raten (ein 6-Tage-Zyklus mit vier
// Trainings sind 4,67 Einheiten je Woche, nicht 5). Die alte Treppe (`d <= 5` -> 1,75) bezahlte 4,67
// exakt wie 5 — der Sprung aus RECHEN-REVIEW D9 war damit nicht behoben, sondern zum Dauerzustand
// geworden: Person A (33 J, m, 80 kg, 181 cm, Aufbau) bekam 3.471 statt der ehrlichen ~3.405 kcal.
// 4,67 ergibt jetzt 1,65 + 0,10 · 0,67 = 1,717.
const ACTIVITY_STEPS = [1.3, 1.45, 1.55, 1.65, 1.75, 1.85];
function activityFactor(daysPerWeek) {
  const raw = Number(daysPerWeek);
  const d = Math.max(1, Math.min(6, isFinite(raw) && raw > 0 ? raw : 3));
  const lo = Math.floor(d), hi = Math.ceil(d);
  const a = ACTIVITY_STEPS[lo - 1], b = ACTIVITY_STEPS[hi - 1];
  return a + (b - a) * (d - lo);
}

// ---- EINE Fettquote fuer die ganze App ----
// [gesetzt: 25 % der Energie, entspricht logic.js:432 vor 2.5.0] – innerhalb der ueblichen 20–35 %.
// Vorher stand dieselbe Zahl an zwei Stellen (hier und in planTargets im Server) und lief auseinander:
// das Tagesziel im Ernaehrungs-Tab kam aus den Plan-Makros und lag bei 29 g auf 2600 kcal = 10 % der
// Energie (RECHEN-REVIEW D2). Wer normal isst, stand damit jeden Tag „+23 g ueber dem Ziel" in Amber.
export const FAT_MIN_E_PCT = 0.25;

// Fett-Untergrenze in Gramm: 25 % der Energie, mindestens aber 0,7 g je kg Koerpergewicht.
// Die zweite Schranke greift in der Diaet: bei 1200 kcal und 100 kg waeren 25 % nur 33 g Fett –
// zu wenig fuer Hormonhaushalt und fettloesliche Vitamine. `kg` darf 0/unbekannt sein, dann zaehlt
// allein die Energiequote. Server (planTargets) und Mahlzeitenplan rechnen mit DIESER Funktion.
export function fatFloorG(kcal, kg) {
  const k = Number(kcal) > 0 ? Number(kcal) : 0;
  const w = Number(kg) > 0 ? Number(kg) : 0;
  return Math.max(Math.round(k * FAT_MIN_E_PCT / 9), Math.round(0.7 * w));
}

// Praxis-Untergrenze fuers Tagesziel (RECHEN-REVIEW D26). Ohne sie rechnete die App fuer eine
// 70-jaehrige Frau mit 45 kg ein Ruhetagsziel von 912 kcal aus und schrieb es kommentarlos als
// „dein Ziel" hin. Unter den eigenen Grundumsatz geht das Ziel nie, und unter die in der
// Ernaehrungsberatung ueblichen Grenzen (1200 kcal Frauen / 1500 kcal Maenner) auch nicht;
// bei unbekanntem Geschlecht steht die Mitte (1350).
const KCAL_FLOOR = { female: 1200, male: 1500, unknown: 1350 };

// Bezugsgewicht fuers Eiweissziel (RECHEN-REVIEW D27): ab starkem Uebergewicht ist das Gesamtgewicht
// der falsche Bezug – 2,2 g/kg auf 120 kg waeren 264 g Eiweiss = 44 % der Energie. Gedeckelt wird auf
// das Gewicht bei BMI 25 zuzueglich 15 % (naeherungsweise fettfreie Masse plus Reserve).
function proteinRefWeight(weightKg, heightCm) {
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (!isFinite(w) || w <= 0) return 0;
  if (!isFinite(h) || h <= 0) return w;
  return Math.min(w, 25 * Math.pow(h / 100, 2) * 1.15);
}

// Komplette Kalorien-/Makro-Empfehlung.
// `estimated`/`missing` sagen der Oberflaeche, dass Teile der Rechnung auf einem Startwert stehen –
// fehlende Angaben duerfen nicht als Tatsache durchgehen (RECHEN-REVIEW D25, D1).
export function nutritionPlan({ gender, weightKg, heightCm, age, goal, daysPerWeek }) {
  const missing = [];
  if (!(Number(weightKg) > 0)) missing.push('weightKg');
  if (!(Number(heightCm) > 0)) missing.push('heightCm');
  if (!(Number(age) > 0)) missing.push('age');
  if (genderKey(gender) === 'unknown') missing.push('gender');
  const w = Number(weightKg) > 0 ? Number(weightKg) : 70;
  const h = Number(heightCm) > 0 ? Number(heightCm) : 175;
  // Ohne Gewicht/Groesse gibt es keinen echten Grundumsatz. Damit die Oberflaeche nicht auf NaN
  // laeuft, rechnet der Startwert mit 70 kg / 175 cm weiter – aber als `estimated: true`
  // gekennzeichnet, damit daneben „Startwert – ergaenze dein Profil" stehen kann.
  const b = bmr({ gender, weightKg: w, heightCm: h, age });
  const tdee = Math.round(b * activityFactor(daysPerWeek));
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
  // Untergrenze: weder unter den Grundumsatz noch unter die Praxisgrenze (D26).
  const floor = Math.max(Math.round(b), KCAL_FLOOR[genderKey(gender)]);
  const kcalFloorApplied = restKcal < floor || trainKcal < floor;
  trainKcal = Math.max(trainKcal, floor);
  restKcal = Math.max(restKcal, floor);
  // Makros für den Trainingstag (Ruhetag analog skaliert über kcal)
  const protein = Math.round(proteinRefWeight(w, h) * proteinPerKg);
  const fat = fatFloorG(trainKcal, w);                                // mindestens 25 % der Energie (D2)
  const carbs = Math.round((trainKcal - protein * 4 - fat * 9) / 4);  // Rest Carbs, nie negativ
  return { bmr: b, tdee, trainKcal, restKcal,
    macros: { protein, carbs: Math.max(0, carbs), fat },
    estimated: missing.length > 0, missing,
    kcalFloor: floor, kcalFloorApplied,
    note: kcalFloorApplied
      ? `Das Ziel liegt auf der Untergrenze von ${floor} kcal – weniger empfehlen wir nicht. Sprich mit deinem Coach, wenn du schneller abnehmen willst.`
      : null };
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
// ROH ODER GEKOCHT steht seit 2.5.0 im Namen jeder Zutat, bei der es einen Unterschied macht:
// „Reis" trug 353 kcal/100 g (also roh), „Linsen" 120 kcal/100 g (also gekocht) – im selben Plan,
// ohne ein Wort dazu. Eine Planzeile „Reis 145 g" bucht 512 kcal; wer 145 g fertig gekochten Reis
// abwiegt, isst 190 kcal. Bis zu 600 kcal Unterschied am Tag (RECHEN-REVIEW D3). `cookedFactor`
// nennt das ungefaehre Gewicht nach dem Kochen (Reis 1 : 2,8) fuer den Hinweis in der Planzeile.
// roles: protein|carb|fat|fruit|veg · meals: b(Frühstück) l(Mittag) d(Abend) s(Snack)
// diet: 'vegan' | 'veg' (vegetarisch) | '' (enthält Fleisch/Fisch)
// maxG: realistische Portions-Obergrenze · pieceG: Gramm pro Stück (für Einkaufsliste)
//
// EINE WAHRHEIT: Die Zahlen kommen aus `src/seed-data.json` (Abschnitt diet.foods) – derselbe Katalog,
// den das Ernährungs-Protokoll benutzt. Bis 2.5.0 waren es zwei Listen mit zwei Wahrheiten: Brokkoli
// stand hier mit 43 kcal/100 g, im Protokoll mit 28; Linsen (gekocht) mit 120 statt 88. Wer den Plan
// abhakte und dieselbe Zutat im Protokoll erfasste, bekam zwei verschiedene Tage (B8/D30). Der
// Unterschied war fast immer derselbe: Die Stammdatei rechnet mit VERWERTBAREN Kohlenhydraten ohne
// Ballaststoffe (LMIV-Konvention, weil kcal = F*9 + KH*4 + EW*4 gerechnet wird), diese Liste trug
// die Gesamt-Kohlenhydrate inklusive Ballaststoffen. Wer hier eine Zahl ändert, ändert sie in
// `seed-data.json` – nicht umgekehrt, und nie nur an einer Stelle.
// Auch die NAMEN sind dieselben – bis auf EINE begründete Ausnahme, die `catalog` benennt:
// „Eier" führt die Stammdatei je Stück („Eier (Stück)"), die Planzeile rechnet dagegen in Gramm.
// Würde die Planzeile „Eier (Stück)" heißen, läse die Ernährungs-Ansicht die 120 g als 120 Stück
// (`pieceModeFor` erkennt Stück-Lebensmittel am Namen) – deshalb bleibt hier der kurze Name.
// Gesucht wird der Eintrag trotzdem: „Eier" ist Teilzeichenkette von „Eier (Stück)".
// „Rinderhack" hieß bis 2.5.0 aus demselben Reflex kurz „Rinderhack (5% Fett)" – dort gibt es aber
// keinen Einheiten-Konflikt (beides Gramm), und der Plan nannte damit eine Zutat, die in der
// Lebensmittel-Liste unter dem österreichischen Zweitnamen steht. Jetzt heißt beides gleich;
// `alt` hält den alten Namen für gespeicherte „mag ich nicht"-Listen weiter treffbar.
const MEAL_FOODS = [
  { name: 'Haferflocken (roh)', p: 13.5, c: 58.7, f: 7, role: 'carb', meals: 'bs', diet: 'vegan', maxG: 120, cookedFactor: 3 },
  { name: 'Vollkornbrot', p: 8, c: 38, f: 1.5, role: 'carb', meals: 'b', diet: 'vegan', maxG: 180, pieceG: 45 },
  { name: 'Magerquark', p: 12, c: 4.1, f: 0.2, role: 'protein', meals: 'bs', diet: 'veg', maxG: 350 },
  { name: 'Skyr', p: 11, c: 4, f: 0.2, role: 'protein', meals: 'bs', diet: 'veg', maxG: 350 },
  { name: 'Hüttenkäse', p: 11, c: 3, f: 2.2, role: 'protein', meals: 'bs', diet: 'veg', maxG: 300 },
  // Stammdatei führt Eier je Stück (7,5 g EW · 0,3 g KH · 6 g F); hier je 100 g, pieceG 60 rechnet es um.
  { name: 'Eier', catalog: 'Eier (Stück)', p: 12.5, c: 0.5, f: 10, role: 'protein', meals: 'b', diet: 'veg', maxG: 240, pieceG: 60 },
  { name: 'Whey Protein', p: 78, c: 5.3, f: 4.7, role: 'protein', meals: 'bs', diet: 'veg', maxG: 50 },
  { name: 'Veganes Proteinpulver', p: 69, c: 11, f: 6.5, role: 'protein', meals: 'bs', diet: 'vegan', maxG: 50 },
  { name: 'Sojajoghurt natur', p: 3.5, c: 2.3, f: 2.3, role: 'protein', meals: 'bs', diet: 'vegan', maxG: 350 },
  { name: 'Banane', p: 1.1, c: 22.8, f: 0.3, role: 'fruit', meals: 'bs', diet: 'vegan', maxG: 240, pieceG: 120 },
  { name: 'Apfel', p: 0.3, c: 11.5, f: 0.6, role: 'fruit', meals: 's', diet: 'vegan', maxG: 180, pieceG: 180 },
  { name: 'Beeren (Mix)', p: 0.9, c: 7.2, f: 0.6, role: 'fruit', meals: 'bs', diet: 'vegan', maxG: 200 },
  { name: 'Erdnussmus / Erdnussbutter', p: 26, c: 11, f: 52, role: 'fat', meals: 'bs', diet: 'vegan', maxG: 40 },
  { name: 'Mandeln', p: 29.1, c: 4.5, f: 51.1, role: 'fat', meals: 's', diet: 'vegan', maxG: 50 },
  { name: 'Avocado', p: 2, c: 8.5, f: 14.7, role: 'fat', meals: 'bl', diet: 'vegan', maxG: 120 },
  { name: 'Olivenöl', p: 0, c: 0, f: 100, role: 'fat', meals: 'ld', diet: 'vegan', maxG: 25 },
  { name: 'Hähnchenbrust', p: 23, c: 1, f: 0.7, role: 'protein', meals: 'ld', diet: '', maxG: 300 },
  { name: 'Putenbrust', p: 23.7, c: 0, f: 1, role: 'protein', meals: 'ld', diet: '', maxG: 300 },
  // Name wie im Katalog (D30). `alt` ist der Name bis 2.4.0 – er steht noch in gespeicherten
  // „mag ich nicht"-Listen und muss dort weiter greifen, sonst landet er wieder auf dem Teller.
  { name: 'Rinderhack / Faschiertes mager (5 % Fett)', alt: 'Rinderhack (5% Fett)', p: 21, c: 0, f: 5, role: 'protein', meals: 'ld', diet: '', maxG: 300 },
  { name: 'Lachs', p: 20.4, c: 0, f: 13.4, role: 'protein', meals: 'ld', diet: '', maxG: 250 },
  { name: 'Thunfisch', p: 21.1, c: 0, f: 0.6, role: 'protein', meals: 'ld', diet: '', maxG: 200 },
  { name: 'Tofu natur', p: 15, c: 1, f: 9, role: 'protein', meals: 'ld', diet: 'vegan', maxG: 300 },
  { name: 'Tempeh', p: 20.3, c: 7.6, f: 10.8, role: 'protein', meals: 'ld', diet: 'vegan', maxG: 200 },
  { name: 'Kichererbsen (gekocht)', p: 8.9, c: 19.8, f: 2.6, role: 'protein', meals: 'ld', diet: 'vegan', maxG: 250 },
  { name: 'Linsen (gekocht)', p: 9, c: 12.2, f: 0.4, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 300 },
  { name: 'Reis (roh)', p: 6.7, c: 80, f: 0.7, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 150, cookedFactor: 2.8 },
  { name: 'Vollkornnudeln (roh)', p: 13.5, c: 62, f: 2.7, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 150, cookedFactor: 2.4 },
  { name: 'Kartoffeln (roh)', p: 2, c: 15, f: 0.1, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 500, cookedFactor: 0.95 },
  { name: 'Süßkartoffeln (roh)', p: 1.6, c: 20, f: 0, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 450, cookedFactor: 0.95 },
  { name: 'Quinoa (gekocht)', p: 4.4, c: 18.5, f: 1.9, role: 'carb', meals: 'ld', diet: 'vegan', maxG: 350 },
  { name: 'Brokkoli', p: 3.8, c: 2.7, f: 0.2, role: 'veg', meals: 'ld', diet: 'vegan', maxG: 400 },
  { name: 'Gemüse gemischt', p: 2, c: 4.1, f: 0.3, role: 'veg', meals: 'ld', diet: 'vegan', maxG: 500 },
  { name: 'Spinat', p: 2.9, c: 0.9, f: 0.4, role: 'veg', meals: 'ld', diet: 'vegan', maxG: 200 },
];

const kcalOf = (food, grams) => (food.p * 4 + food.c * 4 + food.f * 9) * grams / 100;
const density = f => f.p * 4 + f.c * 4 + f.f * 9; // kcal pro 100 g
// Abneigung prüfen – gegen den heutigen Namen UND gegen `alt`, den Namen vor der Angleichung an den
// Katalog. Ohne das zweite Paar wäre eine gespeicherte Abneigung nach einer Umbenennung still weg.
const nameHits = (name, d) => {
  const a = String(name).toLowerCase(), b = String(d).toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
};
const isDisliked = (food, disliked) => {
  const names = typeof food === 'string' ? [food] : [food.name, food.alt].filter(Boolean);
  return (disliked || []).some(d => names.some(n => nameHits(n, d)));
};
const dietOk = (food, dietType) =>
  dietType === 'vegan' ? food.diet === 'vegan'
  : dietType === 'vegetarian' ? food.diet !== ''
  : true;

// Lebensmittel einer Rolle wählen – passend zu Mahlzeit, Ernährungsweise und Ziel.
// fatloss bevorzugt kalorienarme (voluminöse) Optionen, muscle darf dichte nehmen.
// `dense=true` (für Auffüllen) bevorzugt kaloriendichte Optionen.
function pickFood(role, mealSlot, disliked, seed, dietType, goal, dense) {
  let cands = MEAL_FOODS.filter(x => x.role === role && dietOk(x, dietType) && !isDisliked(x, disliked));
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
export function generateMealPlan({ kcalTarget, macros, disliked = [], mealCount = 4, goal = 'all', dietType = 'all', weightKg = null }) {
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
  const fitKcal = () => {
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
  };
  fitKcal();

  // Protein-Absicherung: falls deutlich unter Ziel, Proteinquellen anheben (Caps!)
  const macroTotal = (key) => meals.reduce((a, m) => a + m.items.reduce((x, it) => x + (it[key] || 0), 0), 0);
  const proteinNow = () => macroTotal('protein');
  if (proteinNow() < targetProtein * 0.75) {
    for (const m of meals) for (const it of m.items) {
      const f = findFood(it.food);
      if (f && f.role === 'protein' && it.amount < (f.maxG || 400)) Object.assign(it, mkItem(f, it.amount * 1.3));
    }
  }

  // Makro-Feinabgleich: den Zielsplit treffen, nicht nur die Kalorien.
  // Ohne diesen Pass landete der Plan systematisch bei ~0,5 g Fett/kg (Ziel: 25 % der Kalorien),
  // weil Kohlenhydrat- und Proteinquellen die Mahlzeiten füllen – Ernährungs-Tab und Onboarding
  // zeigten dann Makros, die nie zusammenpassten. Vorgehen je Runde: Protein deckeln, Fett anheben
  // bzw. eine Fettquelle ergänzen, danach wieder proportional auf das kcal-Ziel bringen
  // (proportionales Skalieren lässt das Makro-Verhältnis unverändert).
  // Fett-Ziel = das vorgegebene Makro, mindestens aber die Untergrenze aus fatFloorG() (D2).
  // Ohne diese Schranke lieferte der Generator Plaene mit rund 10 % Fett-Energie, und der
  // Ernaehrungs-Tab machte daraus ein Tagesziel, das jeden normalen Esstag als „zu viel Fett" markiert.
  const targetFat = Math.max(Math.round((macros && macros.fat) || 0), fatFloorG(kcal, weightKg));
  const scaleRole = (role, factor) => {
    let changed = false;
    for (const m of meals) for (const it of m.items) {
      const f = findFood(it.food);
      if (!f || f.role !== role) continue;
      const before = it.amount;
      Object.assign(it, mkItem(f, it.amount * factor));
      if (it.amount !== before) changed = true;
    }
    return changed;
  };
  const addFat = (need, seed) => { // je Mahlzeit höchstens eine zusätzliche Fettquelle
    let added = 0;
    for (const m of meals) {
      if (need - added <= 3) break;
      if (m.items.some(it => (findFood(it.food) || {}).role === 'fat')) continue;
      const cand = pickFood('fat', m.slot, disliked.concat(m.items.map(i2 => i2.food)), seed, dietType, goal);
      if (!cand || !cand.f) continue;
      const item = mkItem(cand, (need - added) * 100 / cand.f);
      if (item.fat < 3) continue;
      m.items.push(item); added += item.fat;
    }
    return added;
  };
  for (let round = 0; round < 3; round++) {
    const t = total() || 1;
    const scale = t / kcal; // Makro-Ziele auf den aktuellen Stand umrechnen (danach wird auf kcal refittet)
    const wantFat = targetFat * scale, wantProtein = targetProtein * scale;
    let touched = false;
    const pNow = macroTotal('protein');
    if (pNow > wantProtein * 1.15) touched = scaleRole('protein', Math.max(0.4, wantProtein * 1.05 / pNow)) || touched;
    else if (pNow < wantProtein * 0.9) touched = scaleRole('protein', Math.min(1.8, wantProtein / Math.max(1, pNow))) || touched;
    let fNow = macroTotal('fat');
    if (fNow < wantFat * 0.9) {
      if (scaleRole('fat', Math.min(2.5, wantFat / Math.max(1, fNow)))) touched = true;
      fNow = macroTotal('fat');
      if (fNow < wantFat * 0.9 && addFat(wantFat - fNow, round) > 0) touched = true;
    }
    if (!touched) break;
    fitKcal();
  }
  // Kalorien-Abgleich, der das Fett STEHEN LAESST: der Ausgleich laeuft ueber Kohlenhydrate,
  // Obst und Gemuese, erst als zweite Stufe (wenn das nicht reicht) auch ueber die Proteinquellen.
  // Das ist der Unterschied zu `fitKcal()`, das alles proportional skaliert.
  const fitKcalKeepFat = () => {
    for (const roles of [['carb', 'fruit', 'veg'], ['carb', 'fruit', 'veg', 'protein']]) {
      for (let pass = 0; pass < 6; pass++) {
        const t = total();
        if (t >= kcal * 0.97 && t <= kcal * 1.03) return true;
        const pool = [];
        for (const m of meals) for (const it of m.items) {
          const f = findFood(it.food);
          if (f && roles.includes(f.role)) pool.push({ it, f });
        }
        const poolKcal = pool.reduce((a, x) => a + x.it.kcal, 0);
        if (poolKcal <= 0) break;
        const want = poolKcal + (kcal - t);
        if (want <= 0) break;
        const factor = Math.max(0.2, Math.min(2, want / poolKcal));
        let changed = false;
        for (const x of pool) {
          const before = x.it.amount;
          Object.assign(x.it, mkItem(x.f, x.it.amount * factor));
          if (x.it.amount !== before) changed = true;
        }
        if (!changed) break; // Caps/Mindestportionen erreicht -> naechste Stufe
      }
    }
    const t = total();
    return t >= kcal * 0.97 && t <= kcal * 1.03;
  };

  // Letzte Absicherung: die Fett-Untergrenze ist eine echte Schranke, kein Wunsch.
  // Bis hierher hob `addFat()` das Fett zwar an — der darauf folgende `fitKcal()` skalierte aber
  // ALLE Zutaten proportional zurueck, und das frisch ergaenzte Fett fiel wieder mit. Gemessen ueber
  // zwoelf Zielwerte von 1.200 bis 5.000 kcal: 22,4–23,6 % Fett-Energie statt der versprochenen 25 %
  // (bei 2.859 kcal: Ziel 79 g, Plan 72 g). Deshalb wird hier aufgefuellt und der Ueberschuss
  // danach ueber die Kohlenhydrate abgebaut, nicht ueber das Fett.
  // Fett, das in den Fettquellen selbst steckt (Oel, Nuesse, Avocado) – nur diese lassen sich
  // ueber `scaleRole` anheben. Der Rest kommt aus Eiern, Lachs & Co. und bleibt, wie er ist.
  const fatFromFatRole = () => meals.reduce((a, m) => a + m.items.reduce(
    (x, it) => x + ((findFood(it.food) || {}).role === 'fat' ? (it.fat || 0) : 0), 0), 0);
  // Letzter Zentimeter: `mkItem` rastert Portionen auf 5 g. Ein kleiner Aufschlag verpufft deshalb
  // (10 g Olivenoel × 1,06 = 10,6 g -> wieder 10 g), die Runde meldete „nichts geaendert" und brach
  // drei Gramm unter der Untergrenze ab. Dann wird genau EINE Fettquelle um eine Portionsstufe
  // angehoben – die, bei der noch Luft bis zur realistischen Hoechstmenge ist.
  const bumpOneFat = () => {
    for (const m of meals) for (const it of m.items) {
      const f = findFood(it.food);
      if (!f || f.role !== 'fat') continue;
      const before = it.amount;
      Object.assign(it, mkItem(f, it.amount + 5));
      if (it.amount !== before) return true;
    }
    return false;
  };
  for (let guard = 0; guard < 8; guard++) {
    let fNow = macroTotal('fat');
    if (fNow >= targetFat) break;
    let gained = false;
    // Der Faktor muss sich auf die Fettquellen beziehen, nicht auf das Gesamtfett: mit
    // `targetFat / fNow` faellt der Aufschlag zu klein aus, weil das Fett aus Eiern, Lachs & Co.
    // mitzaehlt, sich hier aber nicht anheben laesst.
    const fr = fatFromFatRole();
    if (fr > 0 && scaleRole('fat', Math.min(3, (fr + (targetFat - fNow)) / fr))) gained = true;
    fNow = macroTotal('fat');
    if (fNow < targetFat && addFat(targetFat - fNow, 7 + guard) > 0) gained = true;
    if (!gained) gained = bumpOneFat();
    if (!gained) break; // Katalog gibt fuer dieses Ziel nicht mehr Fett her
    fitKcalKeepFat();
  }
  // Nur falls die fettschonende Runde das kcal-Ziel verfehlt hat (Caps in beide Richtungen),
  // bekommt der Plan den alten proportionalen Abgleich — Kalorien vor Makro-Feinheit.
  {
    const t = total();
    if (t < kcal * 0.97 || t > kcal * 1.03) fitKcal();
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

// Kochgewicht zu einer Rohmenge (D3): „Reis (roh) 145 g" sind rund 400 g fertiger Reis.
// Liefert null, wenn es fuer diese Zutat keinen Unterschied macht (Gemuese, Quark, Oel …).
// Gedacht fuer die Planzeile in der Ernaehrungs-Ansicht; die Zahl steht damit an genau einer Stelle.
export function cookedEquivalent(name, grams) {
  const f = MEAL_FOODS.find(x => x.name === name);
  const g = Number(grams);
  if (!f || !f.cookedFactor || !(g > 0)) return null;
  const cookedG = Math.round(g * f.cookedFactor / 5) * 5;
  return { factor: f.cookedFactor, cookedG,
    text: f.cookedFactor >= 1.2 ? `roh abgewogen — entspricht ca. ${cookedG} g gekocht`
      : `roh abgewogen — gekocht ca. ${cookedG} g` };
}

// Stück-Info für die Einkaufsliste (z.B. Eier ≈ 60 g/Stück)
export function pieceInfo(name) {
  const f = MEAL_FOODS.find(x => x.name === name);
  return f && f.pieceG ? { pieceG: f.pieceG } : null;
}

// Liste auswählbarer „mag ich nicht"-Lebensmittel fürs Onboarding (aus dem Katalog)
export function dislikeOptions() {
  // BEWUSST ohne „(roh)"/„(gekocht)": eine Abneigung gilt dem Lebensmittel, nicht seinem Zustand –
  // und die Namen sind hier zugleich der gespeicherte Wert. isDisliked() vergleicht in beide
  // Richtungen als Teilzeichenkette, „Linsen" trifft also auch „Linsen (gekocht)" im Katalog.
  return ['Eier', 'Lachs', 'Thunfisch', 'Rinderhack', 'Tofu', 'Tempeh', 'Linsen', 'Hüttenkäse',
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
  const perWeek = {};
  for (const d of (dates || [])) { const m = mondayOf(d); (perWeek[m] = perWeek[m] || new Set()).add(d); }
  const cnt = k => (perWeek[k] ? perWeek[k].size : 0);
  const prevMon = k => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10); };
  let m = mondayOf(todayStr || tzToday());
  if (cnt(m) < goal) m = prevMon(m);
  let n = 0;
  while (cnt(m) >= goal) { n++; m = prevMon(m); }
  return n;
}

// Ampel-Status für einen Athleten aus Sicht des Coaches.
// Liefert { level: 'ok'|'watch'|'alert', reasons: [...] }.
// D37: Die Trainings-Schwelle folgt der GEPLANTEN Frequenz, nicht einer festen Zahl. Feste 6/10 Tage
// bedeuteten bei 1x/Woche schon nach zwei plangemaessen Tagen Gelb und bei 5x/Woche erst nach drei
// verpassten Einheiten – dieselbe Lampe, zwei voellig verschiedene Lagen. `gap` ist der geplante
// Abstand zwischen zwei Einheiten, danach zwei Tage Luft bis Gelb und sieben bis Rot.
// Ebenfalls D37: eine ueber 30 Tage alte, vergessene Beschwerde haelt den Athleten sonst dauerhaft auf
// Rot und verdeckt die echten Faelle – sie bleibt sichtbar, faellt aber auf Gelb zurueck.
// Die Check-in-Schwellen bleiben fest (5/10), weil ein Check-in taeglich moeglich ist und nicht am
// Trainingsrhythmus haengt.
export function attentionStatus({ daysSinceCheckin, daysSinceTraining, openFlags, daysPerWeek, oldestFlagDays }) {
  const reasons = []; let level = 'ok';
  const bump = l => { if (l === 'alert') level = 'alert'; else if (l === 'watch' && level === 'ok') level = 'watch'; };
  const dpw = Math.max(1, Math.min(7, Number(daysPerWeek) || 3));
  const gap = Math.ceil(7 / dpw), watchT = gap + 2, alertT = gap + 7;
  const flags = openFlags || 0;
  if (flags > 0) {
    reasons.push(flags + ' offene Beschwerde' + (flags > 1 ? 'n' : ''));
    bump(Number(oldestFlagDays) > 30 ? 'watch' : 'alert');
  }
  if (daysSinceCheckin == null) { reasons.push('noch kein Check-in'); bump('watch'); }
  else if (daysSinceCheckin >= 10) { reasons.push(daysSinceCheckin + ' Tage kein Check-in'); bump('alert'); }
  else if (daysSinceCheckin >= 5) { reasons.push(daysSinceCheckin + ' Tage kein Check-in'); bump('watch'); }
  if (daysSinceTraining == null) { reasons.push('noch kein Training geloggt'); bump('watch'); }
  else if (daysSinceTraining >= alertT) { reasons.push(daysSinceTraining + ' Tage kein Training'); bump('alert'); }
  else if (daysSinceTraining >= watchT) { reasons.push(daysSinceTraining + ' Tage kein Training'); bump('watch'); }
  return { level, reasons };
}

// ============================================================
// PERSÖNLICHE REKORDE (PRs) + 1RM-Schätzung
// ============================================================

// Gueltigkeitsgrenze der 1RM-Schaetzung: oberhalb von 12 Wiederholungen laufen Epley, Brzycki und
// Lombardi um bis zu 22 % auseinander (50 kg x 30: Epley 100 kg, Brzycki 257 kg). Eine Zahl, die so
// stark von der gewaehlten Formel abhaengt, ist keine Aussage ueber die Kraft des Nutzers.
export const E1RM_MAX_REPS = 12;

// Geschätztes 1-Rep-Max nach Epley-Formel.
// Ausserhalb des Gueltigkeitsbereichs (mehr als `maxReps` Wiederholungen) gibt es KEINE Schaetzung:
// die Funktion liefert 0 = „nicht schaetzbar". Vorher machte ein Aufwaermsatz 60 kg x 15 rechnerisch
// 90 kg daraus und schlug damit den echten Arbeitssatz 67,5 kg x 8 (85,5 kg) – in der Analyse stand
// „1RM ~90 kg" und der Satz galt als Rekord (RECHEN-REVIEW D14).
export function estimate1RM(weight, reps, maxReps = E1RM_MAX_REPS) {
  const w = Number(weight) || 0, r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r > (Number(maxReps) > 0 ? Number(maxReps) : E1RM_MAX_REPS)) return 0;
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
// Die Fassung, die hier bis 2.4.0 stand (`platesPerSide()`), wurde NIE aufgerufen: weder server.js
// noch ein Frontend importierte sie – gerechnet hat immer die Nachbildung `platesPerSideJS()` in
// public/js/training.js (RECHEN-REVIEW D40). Zwei Fassungen derselben Regel laufen unweigerlich
// auseinander; ohne Bündelungsschritt kann das Frontend aus src/ nichts importieren, also bleibt
// die Rechnung dort, wo sie benutzt wird. Ergänzungen gehören nach public/js/training.js (A-I.3):
// Fall „Ziel < Stangengewicht" (ok:false, reason 'unter_stange') und der Rest, der sich mit den
// vorhandenen Scheiben nicht legen lässt (remainder).

// ============================================================
// BEREITSCHAFT & WOCHENRÜCKBLICK (2.3.0) — reine Rechnung, Daten kommen aus server.js
// ============================================================

// Zahl fuer Endnutzer-Text: eine Nachkommastelle mit deutschem Komma (5.2 -> "5,2")
function _de1(x) { return (Math.round(Number(x) * 10) / 10).toFixed(1).replace('.', ','); }
// Ganze Zahl mit Tausenderpunkt (48230 -> "48.230")
function _deInt(x) { return String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
// Lineare Interpolation entlang fester Stuetzpunkte [[x,y], ...] (aufsteigend nach x). Ausserhalb
// laeuft die aeusserste Steigung weiter und wird dann geklemmt – so entsteht kein Sprung an den Raendern.
function _ipol(x, pts, lo, hi) {
  let y = pts[0][1];
  if (x <= pts[0][0]) { const [x0, y0] = pts[0], [x1, y1] = pts[1]; y = y0 + (x - x0) * (y1 - y0) / (x1 - x0); }
  else if (x >= pts[pts.length - 1][0]) { const [x0, y0] = pts[pts.length - 2], [x1, y1] = pts[pts.length - 1]; y = y1 + (x - x1) * (y1 - y0) / (x1 - x0); }
  else for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; if (x <= x1) { y = y0 + (x - x0) * (y1 - y0) / (x1 - x0); break; } }
  return Math.max(lo, Math.min(hi, y));
}

// Die vier Baender der Bereitschaft, aufsteigend: [Etikett, Farbton, Rat des Tages].
// Grenzen 40 / 60 / 80 wie bisher (A19) – die Liste macht nur sichtbar, dass es vier Stufen sind.
const READY_BANDS = [
  ['Erholen', 'red', 'Heute leicht: halbes Volumen oder ein Ruhetag. Morgen bist du weiter.'],
  ['Etwas zurücknehmen', 'amber', 'Gleiche Gewichte, aber ein Arbeitssatz weniger je Übung.'],
  ['Solide', 'green', 'Zieh deinen Plan wie er steht durch.'],
  ['Grünes Licht', 'green', 'Voll durchziehen. Wenn ein Satz leicht läuft, leg Gewicht drauf.'],
];

// ---- Bereitschaft: eine Zahl 0-100 aus Schlaf, HRV, Ruhepuls und Trainingslast ----
// Bewusst KEINE medizinische Bewertung, sondern eine Einschaetzung aus den eigenen Zahlen des Nutzers.
// Ein Teil zaehlt nur, wenn sein Wert vorliegt; sein Gewicht verteilt sich sonst auf die uebrigen Teile.
// Das ist der Kern: HRV/Ruhepuls sind ohne verbundene Uhr dauerhaft null – ein `Number(x)||0` wuerde
// daraus still einen katastrophalen Wert machen. Fehlende Teile stehen deshalb in `missing`.
// Eingaben: sleep/sleepGoal in Stunden, hrv/hrvBase in ms, rhr/rhrBase in bpm,
//   load7d = LAST der letzten 7 Tage in Satz-Aequivalenten (Kraftsaetze PLUS umgerechnete Cardio-Minuten,
//   die Umrechnung macht server.js), loadAvg7d = uebliches Wochenpensum in derselben Einheit (Median der
//   drei vorangegangenen Trainingswochen; Pausenwochen zaehlen nicht mit, sonst sieht ein normales
//   Comeback wie eine Verdopplung aus).
//   Nur fuer den TEXT, nicht fuer die Rechnung: sets7d = tatsaechlich protokollierte Kraftsaetze der
//   letzten 7 Tage, cardioMin7d = Cardio-Minuten derselben 7 Tage, loadHasCardio = ob im Vergleichszeitraum
//   ueberhaupt Cardio steckt. Fehlen diese drei, bleibt der alte Wortlaut stehen.
export function readinessScore({ sleep, sleepPrev, sleepGoal, hrv, hrvBase, rhr, rhrBase, load7d, loadAvg7d, sets7d, cardioMin7d, loadHasCardio } = {}) {
  const num = v => (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? null : Number(v);
  const parts = [], missing = [], detailOf = {};
  const goal = num(sleepGoal) > 0 ? num(sleepGoal) : 8; // NULL im Profil = App-Standard 8 h

  const h = num(sleep);
  if (h == null) missing.push('sleep');
  else {
    // Erholung haengt nicht an EINER Nacht. Eine kurze Nacht nach zwei guten steckt man weg; drei
    // kurze hintereinander sind etwas anderes. Deshalb zaehlt die letzte Nacht am staerksten, die
    // beiden davor zusammen etwa ein Drittel (Schlafschuld). Ohne Vorgeschichte zaehlt allein die
    // letzte Nacht - dann ist der Wert eben genauer nicht zu haben.
    // Die Gewichte haengen an der POSITION der Nacht, nicht an ihrer Stelle in einer zusammengestrichenen
    // Liste. Bis 2.4.0 filterte `filter()` die Luecken zuerst weg und `forEach` vergab die Gewichte
    // danach der Reihe nach: fehlte die Vornacht, rueckte die Nacht davor auf deren Gewicht (0,25 statt
    // 0,15) und zog den Wert nach unten – 8 h / fehlt / 4 h ergab 6,82 h statt 7,20 h (RECHEN-REVIEW D34).
    // Zugleich verwarf `x > 0` eine echte Null-Stunden-Nacht, die als letzte Nacht sehr wohl zaehlte.
    const prev = (Array.isArray(sleepPrev) ? sleepPrev : []).slice(0, 2).map(num);
    const wts = [0.6, 0.25, 0.15];
    let sum = h * wts[0], wsum = wts[0], usedPrev = 0;
    prev.forEach((v, i) => { if (v == null || v < 0) return; sum += v * wts[i + 1]; wsum += wts[i + 1]; usedPrev++; });
    const eff = sum / wsum;
    // Ziel erreicht = 100; darunter linear bis zum Katastrophenpunkt (=30), darunter 20.
    // Der Katastrophenpunkt ist biologisch (~5 h) und NICHT das Wunschziel minus 3 h: bei einem
    // Schlafziel von 14 h bekam eine gesunde Nacht von 7,5 h sonst denselben Wert wie eine halbe
    // Stunde Schlaf – 365 Tage lang (RECHEN-REVIEW D21). floorH liegt nie ueber 5 h, und der Abstand
    // zum Ziel ist immer mindestens 3 h, also gibt es keine Division durch null.
    const floorH = Math.min(goal - 3, 5);
    const s = eff >= goal ? 100 : (eff >= floorH ? 30 + (eff - floorH) / (goal - floorH) * 70 : 20);
    parts.push({ key: 'sleep', label: 'Schlaf', score: Math.round(s), weight: 0.35,
      text: usedPrev ? `${_de1(h)} h · ${usedPrev + 1} Nächte ${_de1(eff)} h · Ziel ${_de1(goal)} h` : `${_de1(h)} h · Ziel ${_de1(goal)} h` });
    if (eff < goal) detailOf.sleep = usedPrev
      ? `Schlaf ${_de1(eff)} h im Schnitt der letzten drei Nächte – ${_de1(goal - eff)} h unter deinem Ziel.`
      : `Schlaf ${_de1(h)} h – ${_de1(goal - h)} h unter deinem Ziel.`;
  }

  const v = num(hrv), vb = num(hrvBase);
  if (v == null || vb == null || vb <= 0) missing.push('hrv');
  else {
    const dev = (v - vb) / vb * 100; // Abweichung vom eigenen Median in Prozent
    parts.push({ key: 'hrv', label: 'HRV', score: Math.round(_ipol(dev, [[-30, 25], [-20, 45], [-10, 70], [0, 100]], 10, 100)), weight: 0.25,
      text: `${Math.round(v)} ms · Schnitt ${Math.round(vb)} ms` });
    if (dev < 0) detailOf.hrv = `HRV ${Math.round(v)} ms – ${Math.round(-dev)} % unter deinem Schnitt.`;
  }

  const r = num(rhr), rb = num(rhrBase);
  if (r == null || rb == null || rb <= 0) missing.push('rhr');
  else {
    const diff = r - rb;
    parts.push({ key: 'rhr', label: 'Ruhepuls', score: Math.round(_ipol(diff, [[0, 100], [5, 65], [10, 35]], 10, 100)), weight: 0.15,
      text: `${Math.round(r)} bpm · Schnitt ${Math.round(rb)} bpm` });
    // Einheit auch am Vergleichswert: die anderen drei Saetze nennen sie ebenfalls (h, %, %) –
    // eine nackte Zahl liest sich sonst wie ein Prozentwert.
    if (diff > 0) detailOf.rhr = `Ruhepuls ${Math.round(r)} bpm – ${Math.round(diff)} bpm über deinem Schnitt.`;
  }

  const l3 = num(load7d), la = num(loadAvg7d);
  if (l3 == null || la == null || la <= 0) missing.push('load');
  else {
    // Verhaeltnis der letzten 7 Tage zur ueblichen 7-Tage-Last. Ein 3-Tage-Fenster war dafuer zu kurz:
    // es enthaelt fast nur Trainingstage, der Vergleichswert dagegen auch die Ruhetage - jeder
    // regelmaessige Nutzer stand damit dauerhaft ueber 1,0 und bekam Abzug fuers Plangemaesse.
    const ratio = l3 / la; // 1.0 = so viel wie sonst, 2.0 = doppelte Last
    // Stuetzpunkt bei 1,5 statt 1,6: Gabbett 2016 sieht den „sweet spot" bei 0,8–1,3 und ab etwa 1,5
    // ein erhoehtes Verletzungsrisiko. Mit der alten Kurve sagte die App bei 1,6-facher Wochenlast noch
    // „leg Gewicht drauf" – die Lastspitze wurde zu spaet gefangen (RECHEN-REVIEW D22).
    // WORTLAUT: `l3` ist keine Satzzahl, sondern eine Summe aus Kraftsaetzen UND umgerechneten
    // Cardio-Minuten. Sie „Sätze" zu nennen war falsch: nach 90 min hartem Cardio stand
    // „63 Sätze in 7 Tagen · üblich 36" da, obwohl genau 36 Sätze im Protokoll standen – der Nutzer
    // sucht 27 Sätze, die es nie gab. Liegt die Zerlegung vor, nennt der Text beide Lasten bei ihrem
    // Namen. Steckt Cardio nur in der Vergleichsbasis, entfaellt die absolute Zahl „üblich 36" (sie
    // waere ebenfalls keine Satzzahl) und der Vergleich steht in Prozent.
    const sets = num(sets7d), cmin = num(cardioMin7d);
    const pct = Math.round((ratio - 1) * 100);
    const cmpTxt = pct > 0 ? `${pct} % mehr als üblich` : (pct < 0 ? `${-pct} % weniger als üblich` : 'wie üblich');
    const mixed = sets != null && cmin != null && cmin > 0;
    // „0 Sätze + 90 min Cardio" nennt eine Null, die niemanden interessiert – in einer reinen
    // Cardiowoche steht nur das Cardio da.
    const lastTxt = mixed
      ? (sets > 0 ? `${Math.round(sets)} Sätze + ${Math.round(cmin)} min Cardio` : `${Math.round(cmin)} min Cardio`)
      : `${Math.round(sets != null ? sets : l3)} Sätze`;
    const text = mixed || (sets != null && loadHasCardio)
      ? `${lastTxt} in 7 Tagen · ${cmpTxt}`
      : `${Math.round(l3)} Sätze in 7 Tagen · üblich ${Math.round(la)}`;
    parts.push({ key: 'load', label: 'Last', score: Math.round(_ipol(ratio, [[1, 100], [1.3, 75], [1.5, 40], [2, 30]], 20, 100)), weight: 0.25,
      text });
    if (ratio > 1) detailOf.load = `${mixed && sets > 0 ? lastTxt.replace(' + ', ' und ') : lastTxt} in 7 Tagen – ${pct} % mehr als üblich.`;
  }

  // Ohne einen einzigen ERHOLUNGS-Wert gibt es keine Bereitschaft – nur Trainingslast.
  // Bis 2.4.0 reichte der Last-Teil allein fuer eine Zahl: jedes Verhaeltnis <= 1,0 ergibt exakt 100,
  // gedaempft 70 + 30 * 0,8 = 94 – „Grünes Licht. Voll durchziehen." stand so jeden Tag da, ohne dass
  // je ein Schlafwert erfasst wurde (RECHEN-REVIEW D5). Die Last sagt, WIE VIEL du getan hast, nicht
  // wie erholt du bist. Antwort deshalb: score = null, „Noch keine Daten".
  // ACHTUNG fuer die Anzeige: `score` kann null sein, `parts` enthaelt trotzdem den Last-Teil.
  const hasRecovery = parts.some(p => p.key !== 'load');
  if (!hasRecovery) return { score: null, label: 'Noch keine Daten', tone: 'neutral',
    headline: 'Trag Schlaf ein oder verbinde deine Uhr – dann steht hier eine Einschätzung.',
    detail: parts.length
      ? 'Deine Trainingslast kennen wir, deine Erholung noch nicht — dafür fehlt Schlaf, HRV oder Ruhepuls.'
      : 'Noch keine Werte für heute.', parts, missing };

  const wsum = parts.reduce((s, p) => s + p.weight, 0);
  let score = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / wsum);
  // Steht nur EIN Wert zur Verfuegung (typisch: Schlaf von Hand, keine Uhr), ist die Zahl die
  // Zahl dieses einen Wertes - und das Etikett springt mit jeder unruhigen Nacht zwischen
  // „Gruenes Licht" und „Erholen". Eine einzelne Messung traegt aber nicht so weit. Deshalb wird
  // sie zur Mitte hin gedaempft: die Richtung bleibt erhalten, die Aussage wird nicht groesser
  // gemacht, als die Datenlage hergibt. Ab zwei Quellen bleibt die Rechnung unangetastet.
  const thin = parts.length < 2;
  // Mit 0,6 war das unterste Band rechnerisch unerreichbar: der schlechtestmoegliche Einzelwert (20)
  // landete bei 40 – eine halbe Stunde Schlaf bekam denselben Rat wie fuenfeinhalb Stunden. 0,8 daempft
  // die Uebertreibung nach oben weiterhin (ein guter Wert allein verspricht kein „Gruenes Licht"),
  // laesst aber alle vier Baender erreichbar. Zusammen mit dem Drei-Naechte-Schnitt oben springt das
  // Etikett trotzdem nicht mehr taeglich.
  if (thin) score = Math.round(70 + (score - 70) * 0.8);
  // Ein einzelner Wert, der weit aus dem Rahmen faellt, verhindert das oberste Band. Sonst kann der
  // Durchschnitt ihn zudecken: Schlaf, HRV und Ruhepuls tadellos, dazu die doppelte Wochenlast -
  // rechnerisch 80 Punkte, und der Rat lautete „leg Gewicht drauf". Genau dann ist er falsch.
  // Die Zahl bleibt stehen; nur die Einordnung wird vorsichtiger, und detail nennt den Grund.
  // Die alte Kappung auf 79 war ein Leerlauf: sie verhinderte nur das oberste Band. Drei Naechte mit
  // je 4 Stunden Schlaf (Teil-Score 20) ergaben 72 Punkte, min(72, 79) = 72 – „Solide. Zieh deinen Plan
  // wie er steht durch." (RECHEN-REVIEW D22). Die Regel lautet jetzt: liegt ein Teil am Boden (<= 40),
  // traegt er hoechstens EIN Band nach oben. Die Zahl selbst bleibt unveraendert stehen; nur die
  // Einordnung wird vorsichtiger, und `detail` nennt den Grund.
  // (Die im Auftrag genannte Formel `min(score, 40 + worstPart)` trifft dieselbe Absicht, landet aber
  //  bei worstPart 20 auf exakt 60 – der unteren Kante von „Solide", also wieder auf demselben Etikett
  //  wie vorher. Die Bandregel ist dieselbe Aussage ohne diesen Randfall; Abweichung im DONE-Bericht.)
  const worstPart = Math.min(...parts.map(p => p.score));
  const bandIdx = v => v >= 80 ? 3 : v >= 60 ? 2 : v >= 40 ? 1 : 0;
  const idx = worstPart <= 40 ? Math.min(bandIdx(score), bandIdx(worstPart) + 1) : bandIdx(score);
  const band = READY_BANDS[idx];
  // Groesster Ausreisser = schwaechster Teil, aber erst wenn er aus dem obersten Band faellt (< 80 –
  // dieselbe Grenze wie „Gruenes Licht"). Bei 70 blieb der einzige personalisierte Satz genau dort
  // stumm, wo er gebraucht wird: eine Stunde zu wenig Schlaf ergibt Teil-Score 77 und haette nur
  // „Deine Werte liegen im Rahmen." gezeigt. detailOf enthaelt ohnehin nur echte Rueckstaende.
  const worst = parts.slice().sort((a, b) => a.score - b.score)[0];
  const detail = (worst.score < 80 && detailOf[worst.key]) ? detailOf[worst.key] : 'Deine Werte liegen im Rahmen.';
  // thin sagt der Oberflaeche, dass die Zahl auf einer einzigen Quelle steht – sie schreibt dann
  // dazu, woraus geschaetzt wurde, statt eine Genauigkeit vorzutaeuschen.
  return { score, label: band[0], tone: band[1], headline: band[2], detail, parts, missing, thin };
}

// ---- Wochenrueckblick: Highlights (max. 3) ----
// Rein aus den Zahlen von /api/week abgeleitet, kein KI-Aufruf – gleiche Woche, gleiche Saetze.
// Reihenfolge = Staerke: echte Rekorde vor erfuelltem Wochenziel vor Steigerung vor Volumen.
// `week` ist die Antwortstruktur von GET /api/week (fehlende Zahlen sind null, nie 0).
// Zahl + Wort im richtigen Numerus („1 Einheit" statt „1 Einheiten") – der Rueckblick liest sich
// sonst wie eine Maschine. pl() im Frontend macht dasselbe; hier braucht es eine eigene Fassung,
// weil logic.js nichts aus dem Frontend kennt.
function pl2(n, one, many) { const v = Math.round(Number(n) || 0); return v + ' ' + (Math.abs(v) === 1 ? one : many); }

export function weekHighlights(week) {
  const w = week || {}, t = w.training || {}, n = w.nutrition || {}, b = w.body || {}, hl = w.health || {}, m = w.mindset || {}, p = w.prev || {};
  const out = [];
  const add = s => { if (s && out.length < 3) out.push(s); };
  if ((t.prs || 0) > 0) add(`${t.prs} neue${t.prs === 1 ? 'r' : ''} Rekord${t.prs === 1 ? '' : 'e'} – stärker als je zuvor.`);
  if (t.sessions != null && t.planned && t.sessions >= t.planned) add(`${t.sessions} von ${pl2(t.planned,'Einheit','Einheiten')} – Wochenziel erfüllt.`);
  if (t.sessions != null && p.sessions != null && t.sessions > p.sessions) add(`${pl2(t.sessions,'Einheit','Einheiten')} – ${t.sessions - p.sessions} mehr als in der Vorwoche.`);
  if (t.volumeKg) add(`${_deInt(t.volumeKg)} kg bewegt in ${pl2(t.sets,'Satz','Sätzen')}.`);
  const top = (t.topSets || [])[0];
  // Gewicht ohne erzwungene Nachkommastelle: „180 kg", aber „72,5 kg"
  if (top) add(`Bestleistung: ${top.exercise} ${String(Math.round(Number(top.weight) * 10) / 10).replace('.', ',')} kg × ${top.reps}.`);
  // Erst ab 50 Gramm: −0,04 kg wurde zu „−0,0 kg auf der Waage." – ein Hoehepunkt der Woche, der
  // auf null gerundet dasteht (RECHEN-REVIEW D41). Unter der Anzeigegenauigkeit gibt es nichts zu melden.
  if (b.delta != null && Math.abs(b.delta) >= 0.05) add(`${b.delta > 0 ? '+' : '−'}${_de1(Math.abs(b.delta))} kg auf der Waage.`);
  if ((n.onTargetDays || 0) >= 3) add(`${n.onTargetDays} Tage im Kalorienziel.`);
  if (hl.avgSleep != null && hl.avgSleep >= (Number(hl.sleepGoal) > 0 ? Number(hl.sleepGoal) : 8)) add(`Ø ${_de1(hl.avgSleep)} h Schlaf – dein Ziel getroffen.`);
  // D18: „ohne Unterbrechung" darf nur dastehen, wenn die Serie wirklich ohne Unterbrechung lief.
  // Ein Streak-Joker deckt einen Tag OHNE Eintrag – der Server zaehlt diese Tage in `streakFrozen`
  // (server.js/frozenDaysInStreak) und legt sie genau dafuer in die Wochenzahlen. Ohne das hier ging
  // der als Luege benannte Satz unveraendert in die Sonntags-Nachricht. Fehlt das Feld (aeltere
  // Antwort), bleibt es beim alten Satz – null heisst hier „keine Joker-Tage bekannt", nicht „viele".
  if ((w.streak || 0) >= 3) add((w.streakFrozen || 0) > 0
    ? `${w.streak} Tage Serie – ${w.streakFrozen} davon mit Joker.`
    : `${w.streak} Tage Serie ohne Unterbrechung.`);
  if ((m.primings || 0) >= 3) add(`${m.primings}× Priming am Morgen.`);
  if ((m.challengeDays || 0) >= 3) add(`${m.challengeDays} Challenge-Tage abgehakt.`);
  return out;
}

// ---- Wochenrueckblick: EIN Fokus fuer die kommende Woche ----
// Erste zutreffende Regel gewinnt (Reihenfolge = Hebelwirkung). Eine Regel greift nur, wenn ihre
// Zahlen wirklich vorliegen – „unbekannt" (null) darf nie wie „schlecht" behandelt werden.
export function weekFocus(week) {
  const w = week || {}, t = w.training || {}, n = w.nutrition || {}, hl = w.health || {}, m = w.mindset || {};
  // „wieder auf Kurs" setzt voraus, dass es einen Kurs gab. In der allerersten Woche eines Kontos gibt
  // es keinen: prevStart ist dann null (davor liegt keine Spur des Kontos), und die Sonntags-Nachricht
  // fällt mangels Highlights genau auf diesen Satz zurück – die erste Nachricht der App wäre also ein
  // Vorwurf an jemanden, der sich am Donnerstag registriert hat. Fehlt das Feld ganz (ältere Antwort),
  // gilt bewusst der freundlichere Fall.
  // prevStart allein genuegt nicht: es haengt an JEDER Spur des Kontos (Check-in, Essen, Anmeldung),
  // nicht daran, ob je trainiert wurde. Wer sechs Wochen nur Check-ins macht, hoerte sonst weiter
  // „wieder auf Kurs", ohne je auf einem gewesen zu sein. Deshalb zusaetzlich: in der Vorwoche
  // gab es mindestens eine Einheit.
  const hasPast = !!w.prevStart && (w.prev?.sessions || 0) > 0;
  if (t.sessions != null && t.planned && t.sessions < t.planned - 1)
    return hasPast
      ? { title: 'Eine Einheit mehr', why: `${t.sessions} von ${pl2(t.planned,'Einheit','Einheiten')} geschafft – eine zusätzliche Einheit bringt dich wieder auf Kurs.` }
      : { title: 'Der Anfang zählt', why: `${t.sessions} von ${pl2(t.planned,'Einheit','Einheiten')} in deiner ersten Woche – fang mit einer an, den Rhythmus baust du danach.` };
  // ---- Reihenfolge der Ernaehrungs-Regeln: Datenbasis, dann Kalorien, dann Eiweiss ----
  // Die Reihenfolge IST die Aussage der Woche (A30). Bis 2.4.0 stand die Eiweiss-Regel vor der
  // Datenbasis-Regel: ein einziger protokollierter Tag wurde zu „Ø 120 g statt 199 g – dir fehlen 79 g
  // am Tag" als Urteil ueber die ganze Woche (RECHEN-REVIEW D13). Aus einem Tag laesst sich kein
  // Wochenschnitt bilden – erst die Datenlage, dann die Zahlen.
  if ((n.daysLogged || 0) < 4)
    return { title: 'Jeden Tag eintragen', why: `Nur ${n.daysLogged || 0} von 7 Tagen protokolliert – ohne Zahlen lässt sich nichts nachsteuern.` };
  // Und es gab ueberhaupt keine Kalorien-Regel: sieben protokollierte Tage mit Ø 2148 statt 2838 kcal
  // und null Tagen im Ziel ergaben „Weiter so" (RECHEN-REVIEW D12). 690 kcal Defizit am Tag sind im
  // Aufbau der Unterschied zwischen Fortschritt und Stillstand – das ist der groesste Hebel der Woche,
  // also steht er vor dem Eiweiss (das Eiweissziel ist ohnehin kaum zu treffen, wenn zu wenig gegessen wird).
  if (n.avgKcal != null && n.targetKcal && Math.abs(n.avgKcal - n.targetKcal) > n.targetKcal * 0.08) {
    const diff = Math.round(Math.abs(n.targetKcal - n.avgKcal));
    return n.avgKcal < n.targetKcal
      ? { title: 'Mehr essen', why: `Ø ${Math.round(n.avgKcal)} statt ${Math.round(n.targetKcal)} kcal – dir fehlen ${diff} kcal am Tag.` }
      : { title: 'Weniger essen', why: `Ø ${Math.round(n.avgKcal)} statt ${Math.round(n.targetKcal)} kcal – das sind ${diff} kcal zu viel am Tag.` };
  }
  if (n.avgProtein != null && n.targetProtein && n.avgProtein < n.targetProtein * 0.85)
    return { title: 'Eiweiß treffen', why: `Ø ${Math.round(n.avgProtein)} g statt ${Math.round(n.targetProtein)} g – dir fehlen ${Math.round(n.targetProtein - n.avgProtein)} g am Tag.` };
  const goal = Number(hl.sleepGoal) > 0 ? Number(hl.sleepGoal) : 8;
  if (hl.avgSleep != null && hl.avgSleep < goal - 1)
    return { title: 'Eine Stunde früher ins Bett', why: `Ø ${_de1(hl.avgSleep)} h Schlaf bei einem Ziel von ${_de1(goal)} h – Erholung ist der billigste Fortschritt.` };
  // (Die Datenbasis-Regel stand bis 2.5.0 hier – jetzt oben, vor allen Nährwert-Regeln.)
  // primings === null heisst „Mindset nicht in Benutzung" – der Rueckblick blendet den Block dann
  // ganz aus. Daraus hier eine harte 0 zu machen, wuerde dem Nutzer in der prominentesten Karte
  // etwas vorwerfen, was der Bildschirm daneben gar nicht zeigt.
  if (m.primings != null && m.primings < 3)
    return { title: 'Drei Morgen priming', why: `${m.primings}× Priming diese Woche – drei Morgen reichen, um den Unterschied zu spüren.` };
  // Nichts zu korrigieren: der staerkste Wert der Woche traegt die Begruendung.
  return { title: 'Weiter so', why: weekHighlights(week)[0] || 'Deine Woche steht – halte das Tempo.' };
}
