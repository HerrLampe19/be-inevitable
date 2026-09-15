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
// 2.8.0: zwei statt einer Nachkommastelle. Solange die Schrittweite 2,5 kg war, gab es nie eine zweite –
// mit 0,25-kg-Magneten (`exercises.step_kg`) schon: „100,3 kg" stand als Text unter einem Feld, in dem
// 100,25 lag. Zahlen ohne zweite Stelle schreiben sich unveraendert („72,5", nicht „72,50").
function _kg(x) { return String(Math.round(Number(x) * 100) / 100).replace('.', ','); }

// RIR = Reps in Reserve: wie viele Wiederholungen waeren beim letzten Satz noch gegangen.
// 0 = nichts mehr, 5 = sehr locker. Ab 2.8.0 schreibt die Satzzeile den Wert mit (Profi-Stufe), und
// ab hier steuert er die Empfehlung. Die Schwellen folgen der Doppelprogression mit Autoregulation:
//   RIR >= 4  – der Satz war deutlich zu leicht: zwei Schritte hoch.
//   RIR == 3  – noch Luft: ein Schritt hoch, auch wenn die Wiederholungen im Zielbereich lagen.
//   RIR <= 1  – am Limit: nie erhoehen, nur weil die Wiederholungszahl es hergaebe.
// Ohne RIR-Wert (Anfaengerstufe, Bestandszeilen) bleibt die Rechnung Zeile fuer Zeile die von 2.7.0.
const RIR_EASY = 4, RIR_ROOM = 3, RIR_LIMIT = 1;
const _rirOf = s => { const v = s?.rir; if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
// Ein empfohlenes Gewicht auf ein benutzbares Raster legen. Bis 2.7.0 stand hier fest `*2 / 2` – ein
// halbes Kilo, weil die Schrittweite immer 2,5 kg war und die Rundung nur Fliesskomma-Reste wegraeumte.
// Mit `exercises.step_kg` (2.8.0) gibt es feinere Stufen: 100 kg + 0,25 kg waeren auf dem alten Raster
// als „100,5 kg" herausgekommen – also das Doppelte des Schritts, den der Coach eingetragen hat.
// Darum: halbes Kilo, solange die Schrittweite selbst ein Vielfaches davon ist (bitgleich zu 2.7.0),
// sonst zwei Nachkommastellen (die reichen fuer 0,25-kg-Magnete und halten den Fliesskomma-Rest fern).
const _snapKg = (v, step) => (Math.round(step * 2) === step * 2 ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100);

// A-4 (Nachbesserung 2.8.0): DER TEXT KENNT DIE STUFE.
// Bis hierher schrieb `recommend()` das Kuerzel „RIR" in jeden Empfehlungstext – auch fuer einen
// Anfaenger, dem die Trainingsansicht die RIR-Spalte ausdruecklich vorenthaelt (`twRirOn()`,
// training.js). Gemessen am laufenden Server mit `users.experience='beginner'`: die einzige Zeile mit
// „RIR" auf dem Bildschirm war die Empfehlung selbst – „12 Reps bei RIR 4 — da ist Luft." Dieselbe
// Version verspricht dem Coach fuer Stufe 1 woertlich „Kein RIR, keine Satztypen, Empfehlungen ohne
// Fachbegriffe" (STRATEGY 4.1 / P9). Eine App, die ein Wort versteckt und es zwei Zeilen tiefer selbst
// benutzt, hat den Anfaenger nicht geschont, sondern ratlos gelassen.
// Die RECHNUNG bleibt in jeder Stufe dieselbe – der RIR-Wert steuert die Empfehlung fuer den Anfaenger
// genauso wie fuer den Profi (er traegt ihn nur nicht selbst ein; Bestandszeilen und der Coach koennen
// ihn haben). Nur die WORTE wechseln. Und der RIR-Teil steht ab jetzt zusaetzlich als eigenes Feld
// (`reasonRir`) daneben, damit die Oberflaeche ihn anhaengen kann, statt ihn aus einem Satz zu schneiden.
//   opts.rirText === false -> Texte ohne das Kuerzel („12 Reps — da ist Luft.")
//   sonst (Vorgabe)        -> unveraendert wie 2.8.0 vor der Nachbesserung
export function recommend(lastSets, targetReps, stepKg = 2.5, opts = null) {
  const rirText = opts?.rirText !== false;
  const range = parseRepRange(targetReps);
  const valid = (lastSets || []).filter(s => s && s.weight != null && s.reps != null && s.reps > 0);
  if (!valid.length) {
    return { type: 'none', step: stepKg, text: range ? `Ziel: ${range.min === range.max ? range.min : range.min + '-' + range.max} Reps` : 'Leg los — trag deine Sätze ein.' };
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
  // Gleichstand ist bei einer sauber gefuehrten Einheit der NORMALFALL, nicht die Ausnahme: drei
  // Arbeitssaetze 27,5 kg x 12 sind dreimal dieselbe Staerke, dasselbe Gewicht, dieselben
  // Wiederholungen. Bis hierher entschied dann die stabile Sortierung – also schlicht der zuerst
  // eingetragene Satz. In der Praxis traegt aber der LETZTE Satz den RIR-Wert (davor weiss man noch
  // nicht, ob man am Limit ist), und so fiel die einzige Profi-Angabe der Einheit heraus: gemessen
  // ergaben dieselben drei Saetze „halten bei 27,5 kg" (RIR am letzten Satz) statt „hoch auf 30 kg"
  // (RIR am ersten Satz). Zwei gegenteilige Empfehlungen aus denselben Daten.
  // Deshalb zwei weitere Stufen im Gleichstand: (1.) ein Satz MIT RIR-Wert schlaegt einen ohne –
  // eine Angabe ist mehr wert als keine; (2.) danach die hoehere Satznummer, denn der spaetere Satz
  // ist die frischere Aussage ueber denselben Zustand.
  const hasRir = s => (_rirOf(s) !== null ? 1 : 0);
  const setNo = s => Number(s?.set_no) || 0;
  const best = cand.slice().sort((a, b) =>
    (strength(b) - strength(a)) || (b.weight - a.weight) || (b.reps - a.reps)
    || (hasRir(b) - hasRir(a)) || (setNo(b) - setNo(a)))[0];
  const rir = _rirOf(best);
  // Die Begruendungszeile (A-IV.2 Punkt 8). Sie steht unter jeder vorgeschlagenen Zahl und sagt,
  // WORAUS sie stammt – „zuletzt 72,5 kg × 10 bei RIR 2". Bis 2.7.0 stand dort nur das Ergebnis, und
  // der Athlet konnte weder nachvollziehen noch widersprechen.
  const basis = { weight: best.weight, reps: best.reps, rir };
  // Zwei Felder statt eines zusammengeklebten Satzes: `reason` ist die Zeile, die angezeigt werden darf,
  // `reasonRir` der RIR-Teil fuer sich (null ohne Wert). Wer die Stufe erst im Client kennt, haengt ihn an.
  const reasonRir = rir !== null ? `bei RIR ${rir}` : null;
  const why = `zuletzt ${_kg(best.weight)} kg × ${best.reps}` + (rirText && reasonRir ? ` ${reasonRir}` : '');
  const out = o => ({ ...o, step: stepKg, basis, reason: why, reasonRir });
  if (!range) {
    return out({ type: 'hold', weight: best.weight, text: `Letztes Mal: ${_kg(best.weight)} kg × ${best.reps}. Schlag das!` });
  }
  // Oben aus dem Zielbereich heraus: erhoehen. Wie weit, entscheidet der RIR-Wert – wer 12 Wiederholungen
  // mit 4 in Reserve schafft, ist nicht einen Schritt zu leicht unterwegs, sondern zwei.
  if (best.reps > range.max) {
    const mult = rir !== null && rir >= RIR_EASY ? 2 : 1;
    const nw = _snapKg(best.weight + stepKg * mult, stepKg);
    const zusatz = mult === 2 ? (rirText ? ` Mit RIR ${rir} war noch viel Luft.` : ' Da war noch viel Luft.') : '';
    return out({ type: 'up', weight: nw, fromWeight: best.weight, steps: mult,
      text: `Stark! ${best.reps} Reps geschafft.${zusatz} Empfehlung: ${_kg(nw)} kg (+${_kg(stepKg * mult)}).` });
  }
  if (best.reps < range.min) {
    // Zu wenig Wiederholungen UND noch Luft in Reserve: das Gewicht war nicht zu schwer, der Satz wurde
    // zu frueh beendet (Zeit, Technik, Kopf). Runterzugehen waere hier die falsche Antwort.
    if (rir !== null && rir >= RIR_ROOM) {
      return out({ type: 'hold', weight: best.weight, fromWeight: best.weight,
        text: `Nur ${best.reps} Reps, aber ${rirText ? `RIR ${rir}` : 'da war noch Luft'} — das Gewicht passt. Bleib bei ${_kg(best.weight)} kg und geh näher ans Limit.` });
    }
    const nw = Math.max(0, _snapKg(best.weight - stepKg, stepKg));
    // „Versuch 0 kg" war bis 2.4.0 moeglich: 1,5 kg Kurzhantel minus 2,5 kg Schrittweite ergab 0 und
    // wurde als Empfehlung ausgeschrieben (RECHEN-REVIEW D23). Wo es nach unten nichts mehr gibt,
    // ist die ehrliche Empfehlung: Gewicht lassen, Technik und Wiederholungen verbessern.
    if (nw <= 0) {
      return out({ type: 'hold', weight: best.weight, fromWeight: best.weight,
        text: `Nur ${best.reps} Reps. Leichter geht hier nicht — bleib bei ${_kg(best.weight)} kg und arbeite an sauberer Technik.` });
    }
    return out({ type: 'down', weight: nw, fromWeight: best.weight, text: `Nur ${best.reps} Reps. Versuch ${_kg(nw)} kg, dann saubere Technik.` });
  }
  // Im Zielbereich. Ohne RIR bleibt es beim Halten (so war es bis 2.7.0). Mit RIR >= 3 geht es hoch:
  // drei Wiederholungen in Reserve heissen, dass der Reiz zu klein war, egal wie die Zahl aussieht.
  // „Oben im Bereich" (letzte Zielwiederholung erreicht) zaehlt dabei wie „darueber hinaus": wer die
  // 12 von „8-12" mit 4 in Reserve macht, ist nicht einen Schritt zu leicht unterwegs, sondern zwei.
  // Am unteren Ende des Bereichs bleibt es bei EINEM Schritt – zwei wuerden ihn unter `range.min` werfen.
  const atTop = best.reps >= range.max;
  if (rir !== null && rir >= RIR_ROOM) {
    const mult = (atTop && rir >= RIR_EASY) ? 2 : 1;
    const nw = _snapKg(best.weight + stepKg * mult, stepKg);
    const zusatz = mult === 2 ? 'da ist viel Luft' : 'da ist Luft';
    return out({ type: 'up', weight: nw, fromWeight: best.weight, steps: mult,
      text: `${best.reps} Reps${rirText ? ` bei RIR ${rir}` : ''} — ${zusatz}. Empfehlung: ${_kg(nw)} kg (+${_kg(stepKg * mult)}).` });
  }
  if (rir !== null && rir <= RIR_LIMIT) {
    // Zwei verschiedene Lagen, die bis zur Abnahme dieselbe (und oben falsche) Zeile bekamen: Wer die
    // oberste Zielwiederholung schon HAT und dabei am Limit war, kann sie sich nicht „erst noch holen".
    // Fuer ihn ist der naechste Schritt das Gewicht – aber erst, wenn die Wiederholung leichter faellt.
    return out({ type: 'hold', weight: best.weight,
      text: atTop
        ? (rirText
          ? `${best.reps} Reps bei RIR ${rir} — sauber am Limit. Bleib bei ${_kg(best.weight)} kg, bis derselbe Satz mit mehr Reserve steht.`
          : `${best.reps} Reps, sauber am Limit. Bleib bei ${_kg(best.weight)} kg, bis derselbe Satz leichter fällt.`)
        : (rirText
          ? `${_kg(best.weight)} kg halten. RIR ${rir} war am Limit — hol dir erst die ${range.max}. Wiederholung (zuletzt ${best.reps}).`
          : `${_kg(best.weight)} kg halten. Der letzte Satz war am Limit — hol dir erst die ${range.max}. Wiederholung (zuletzt ${best.reps}).`) });
  }
  return out({ type: 'hold', weight: best.weight, text: `${_kg(best.weight)} kg halten. Ziel: Richtung ${range.max} Reps arbeiten (zuletzt ${best.reps}).` });
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

// ---- EINE Tabelle fuer „wie viel vom Verbrauch bei welchem Ziel" (3.0.0, B-I.1) ----
// Die sechs Zahlen standen bis 2.9.0 als Literale in nutritionPlan(). Ab 3.0.0 braucht sie eine
// zweite Stelle (adaptTargets, B-d), und die klassische Bauart-Falle dieser App heisst „dieselbe
// Regel existiert mehrfach und laeuft auseinander" (RECHEN-REVIEW, vier Bauarten). Deshalb genau
// eine Tabelle: nutritionPlan liest Trainings-/Ruhetag daraus, adaptTargets bildet daraus den
// Wochenschnitt. Die Werte selbst sind unveraendert (E8/E9/E11/E12 im RECHEN-REVIEW: ok).
export const GOAL_KCAL = {
  muscle:  { train: 1.12, rest: 1.05, proteinPerKg: 2.0 },  // Aufbau:  +12 % / +5 %
  fatloss: { train: 0.88, rest: 0.80, proteinPerKg: 2.2 },  // Diaet:   -12 % / -20 %, mehr Eiweiss zum Muskelerhalt
  health:  { train: 1.00, rest: 0.95, proteinPerKg: 1.8 },  // Halten / Gesundheit
};
export function goalKcal(goal) { return GOAL_KCAL[goal] || GOAL_KCAL.health; }

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
  // Ziel-Anpassung: Trainingstag vs Ruhetag leicht unterschiedlich (Faktoren: GOAL_KCAL, siehe oben).
  // Unbekanntes/fehlendes Ziel faellt wie bisher auf 'health' zurueck.
  const gk = goalKcal(goal);
  let trainKcal = Math.round(tdee * gk.train), restKcal = Math.round(tdee * gk.rest);
  const proteinPerKg = gk.proteinPerKg;
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

// ============================================================
// MUSKELGRUPPEN-KANON (2.8.0, A-IV.3) – deutsch als EINE Schreibweise
// ============================================================
// `exercises.muscle` ist ein freies Textfeld. Bis 2.8.0 landete darin, was gerade jemand getippt hat –
// und das waren zwei Sprachen gleichzeitig: die Vorlage unten schrieb „Brust", „Rücken", „Waden", die
// mitgelieferten Übungen (und das Platzhalter-Beispiel im Übungsformular, „z.B. Quads") schrieben
// „Chest", „Lats", „Calves". Gemessen in den Prüf-Datenbanken: 17 verschiedene Werte für 11 Gruppen,
// darunter die Sprachdoppel Brust/Chest, Trizeps/Triceps, Waden/Calves.
//
// Das kostet zweimal:
//   * Der Anfänger liest in der Analyse „Lats · Rear Delts · Adductors" – unerklärte Fachbegriffe in
//     einer sonst durchgehend deutschen App (STRATEGY 4, „Anfänger und Profi").
//   * Der Profi verliert seinen Korridor: `GROUP BY e.muscle` zählt „Brust" und „Chest" als ZWEI
//     Gruppen. Wer 14 Sätze Brust macht, davon 7 unter jeder Schreibweise, sieht zweimal „7 Sätze ·
//     zu wenig" statt einmal „14 · im Korridor 10–20". Die Grenze, an der die App eine Aussage trifft,
//     halbiert sich mit der Zahl der Schreibweisen.
//
// Deshalb: EIN Kanon, deutsch, an EINER Stelle. Er greift beim Schreiben (jede Übung, die neu
// entsteht – Vorlage, Formular, geteilte Übung, Coach-Vorlage) UND beim Lesen (Plan, Analyse,
// Sätze je Muskelgruppe). So braucht es weder eine Schemaänderung noch eine Wanderung über den
// Bestand: Altdaten werden beim Ausliefern normalisiert, Neudaten entstehen gar nicht erst schief.
//
// Die Regel der Tabelle: zusammengelegt wird, was DENSELBEN Namen in einer anderen Sprache oder
// Schreibweise trägt – nicht, was anatomisch ineinander liegt. Zwei Zusammenlegungen sind bewusst
// weiter gefasst, weil die eigenen Daten zeigen, dass sie dieselben Übungen tragen:
//   * `Lats` → Rücken: die Lats-Übungen im Bestand sind „Wide Grip Lat Pull Down" und „SA Hammer
//     Strength Row", die Rücken-Übungen der Vorlage „Klimmzug / Latzug" und „Rudern". Dieselbe Arbeit.
//   * `Core` → Bauch: „Core" trägt Plank und Beinheben, „Abs" trägt Leg Raises und Crunches.
// Ein Wort, das nicht in der Tabelle steht, bleibt UNVERÄNDERT stehen (nur getrimmt). Der Coach darf
// „Serratus" schreiben; die App erfindet dafür keine Gruppe und wirft nichts weg.
const MUSCLE_CANON_MAP = (() => {
  const groups = {
    'Brust': ['brust', 'chest', 'pec', 'pecs', 'pectorals', 'brustmuskel', 'brustmuskulatur'],
    'Rücken': ['ruecken', 'back', 'upper back', 'oberer ruecken', 'lat', 'lats', 'latissimus', 'lat dorsi', 'breiter rueckenmuskel'],
    'Unterer Rücken': ['unterer ruecken', 'lower back', 'erector', 'erector spinae', 'rueckenstrecker'],
    'Nacken': ['nacken', 'trap', 'traps', 'trapez', 'trapezius', 'kapuzenmuskel'],
    'Schultern': ['schulter', 'schultern', 'shoulder', 'shoulders', 'delt', 'delts', 'deltoid', 'deltoids'],
    'Vordere Schulter': ['vordere schulter', 'front delt', 'front delts', 'anterior delt', 'anterior delts'],
    'Seitliche Schulter': ['seitliche schulter', 'mittlere schulter', 'side delt', 'side delts', 'lateral delt', 'lateral delts', 'medial delt', 'medial delts'],
    'Hintere Schulter': ['hintere schulter', 'rear delt', 'rear delts', 'posterior delt', 'posterior delts'],
    'Bizeps': ['bizeps', 'bicep', 'biceps', 'armbeuger'],
    'Trizeps': ['trizeps', 'tricep', 'triceps', 'armstrecker'],
    'Unterarme': ['unterarm', 'unterarme', 'forearm', 'forearms', 'griffkraft', 'grip'],
    'Bauch': ['bauch', 'bauchmuskeln', 'ab', 'abs', 'abdominals', 'core', 'rumpf', 'oblique', 'obliques', 'schraege bauchmuskeln'],
    'Quadrizeps': ['quadrizeps', 'quad', 'quads', 'quadriceps', 'beinstrecker', 'oberschenkel vorne'],
    'Beinbeuger': ['beinbeuger', 'hamstring', 'hamstrings', 'oberschenkel hinten', 'ischiocrurale'],
    'Gesäß': ['gesaess', 'gesaessmuskel', 'po', 'glute', 'glutes', 'gluteus'],
    'Waden': ['wade', 'waden', 'wadenmuskel', 'calf', 'calves'],
    'Adduktoren': ['adduktor', 'adduktoren', 'adductor', 'adductors'],
    'Abduktoren': ['abduktor', 'abduktoren', 'abductor', 'abductors'],
    'Beine': ['bein', 'beine', 'leg', 'legs'],
    'Ganzkörper': ['ganzkoerper', 'full body', 'fullbody', 'total body'],
    'Cardio': ['cardio', 'ausdauer', 'conditioning'],
  };
  const m = new Map();
  for (const [canon, words] of Object.entries(groups)) {
    m.set(muscleKey(canon), canon);
    for (const w of words) m.set(muscleKey(w), canon);
  }
  return m;
})();
// Vergleichsschluessel: klein, ohne Umlaute/Bindestriche, ohne Mehrfach-Leerzeichen und ohne den
// Plural-Zusatz, den Menschen mal setzen und mal nicht. „Rücken", „ruecken", „RUECKEN", „Rücken "
// und „rear-delts" sollen denselben Schluessel ergeben – sonst hilft die Tabelle nur dem, der genau
// so tippt wie sie. `muscleKey` steht VOR der Tabelle, weil sie ihn beim Aufbau schon braucht.
function muscleKey(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
// Kanonischer deutscher Name einer Muskelgruppe. Unbekanntes bleibt (getrimmt) stehen,
// Leeres bleibt leer – `null` fuer „keine Gruppe hinterlegt", damit die Aufrufer wie bisher pruefen.
export function muscleCanon(v) {
  const raw = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
  if (!raw) return v == null ? null : raw;
  const k = muscleKey(raw);
  if (!k) return raw;
  const hit = MUSCLE_CANON_MAP.get(k);
  if (hit) return hit;
  // Einfache Mehrzahl („Quads" steht in der Tabelle, „Quad" auch – aber „Bizepse" nicht):
  // ein angehaengtes s wird einmal probiert, bevor der Wert unveraendert durchgeht.
  const alt = k.endsWith('s') ? k.slice(0, -1) : k + 's';
  return MUSCLE_CANON_MAP.get(alt) || raw;
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
  // `technique` traegt seit 2.8.0 den Namen der Technik-Karte dieser Grunduebung (FORM_GUIDES weiter
  // unten). Bis dahin stand hier fest `''` – ein frisch angelegter Anfaengerplan enthielt zwoelf
  // Uebungen mit `technique=NULL`, darunter Kniebeuge, Kreuzheben und Klimmzug, und der Technik-Chip
  // der Trainingsansicht (training.js, rendert nur bei gesetzter Technik) blieb deshalb IMMER aus:
  // ein Anfaenger bekam Kreuzheben ohne eine Zeile zur Ausfuehrung (STRATEGY 4.1, Zeile „Technik",
  // Level 1). Die Karte selbst steht in FORM_GUIDES, nicht in der Datenbank – hier landet nur ihr Name.
  // `muscleCanon` auch hier, obwohl die Namen unten schon kanonisch sind: die Vorlage ist die EINE
  // Stelle, an der ein Plan ohne Zutun eines Menschen entsteht – und sie hat bis 2.8.0 selbst gemischt
  // („Brust", „Rücken", „Waden" neben „Quads", „Hamstrings", „Glutes", dazu „Beine" und „Quads" fuer
  // dieselbe Kniebeuge). Wer hier eine Uebung ergaenzt, soll die Schreibweise nicht treffen muessen.
  const ex = (muscle, name, r = reps) => ({ muscle: muscleCanon(muscle), name, target_sets: sets, target_reps: r, technique: formGuideFor(name) });
  const fullBody = { name: 'Ganzkörper', exercises: [
    ex('Quadrizeps', 'Kniebeuge / Beinpresse', heavyReps), ex('Brust', 'Bankdrücken / Liegestütz', heavyReps),
    ex('Rücken', 'Rudern / Latzug'), ex('Schultern', 'Schulterdrücken'), ex('Bauch', 'Plank') ] };
  const upper = { name: 'Oberkörper', exercises: [
    ex('Brust', 'Bankdrücken', heavyReps), ex('Rücken', 'Latzug / Klimmzug'), ex('Schultern', 'Schulterdrücken'),
    ex('Bizeps', 'Bizeps-Curls'), ex('Trizeps', 'Trizeps-Drücken') ] };
  const lower = { name: 'Unterkörper', exercises: [
    ex('Quadrizeps', 'Kniebeuge / Beinpresse', heavyReps), ex('Beinbeuger', 'Rumänisches Kreuzheben'),
    ex('Gesäß', 'Hip Thrust'), ex('Waden', 'Wadenheben'), ex('Bauch', 'Beinheben') ] };
  const push = { name: 'Push', exercises: [
    ex('Brust', 'Bankdrücken', heavyReps), ex('Schultern', 'Schulterdrücken'), ex('Brust', 'Schrägbankdrücken'),
    ex('Trizeps', 'Trizeps-Drücken') ] };
  const pull = { name: 'Pull', exercises: [
    ex('Rücken', 'Klimmzug / Latzug', heavyReps), ex('Rücken', 'Rudern'), ex('Bizeps', 'Bizeps-Curls'),
    ex('Schultern', 'Face Pulls') ] };
  const legs = { name: 'Beine', exercises: [
    ex('Quadrizeps', 'Kniebeuge', heavyReps), ex('Beinbeuger', 'Kreuzheben'), ex('Gesäß', 'Ausfallschritte'),
    ex('Waden', 'Wadenheben') ] };

  if (d <= 2) return [ { ...fullBody, name: 'Ganzkörper A' }, { ...fullBody, name: 'Ganzkörper B' } ].slice(0, Math.max(1, d));
  if (d === 3) return [ push, pull, legs ];
  if (d === 4) return [ { ...upper, name: 'Oberkörper 1' }, { ...lower, name: 'Unterkörper 1' },
                        { ...upper, name: 'Oberkörper 2' }, { ...lower, name: 'Unterkörper 2' } ];
  if (d === 5) return [ push, pull, legs, upper, lower ];
  return [ push, pull, legs, push, pull, legs ].slice(0, d); // 6+
}

// ============================================================
// TECHNIK-KARTEN DER GRUNDUEBUNGEN (STRATEGY 4.1, Zeile „Technik", Level 1)
// ============================================================
// Level 1 verlangt „Karte beim ersten Kontakt mit der Uebung: Coach-Video-Link, 3 Cues, 3 typische
// Fehler". Das 26-Begriffe-Lexikon des Servers (DEFINITIONS_RAW) konnte das nicht liefern: es erklaert
// Spaltennamen (Sets, Reps, RIR) und INTENSITAETSTECHNIKEN (Drop-Set, Rest Pause, Widowmaker) – kein
// einziger Eintrag sagt, wie eine Kniebeuge aussieht. Einem Anfaenger „Drop-Set" an die Kniebeuge zu
// schreiben, waere schlimmer als gar nichts. Deshalb kommen die fehlenden Karten hier dazu, in
// derselben Form wie die uebrigen Eintraege (`term` + `def`), aber mit eigener Art `form`:
//  * `term`  ist der Wert, der in `exercises.technique` landet und den die Oberflaeche nachschlaegt.
//  * `match` entscheidet, welche Uebung welche Karte bekommt – EINE Stelle fuer Datenbank (generatePlan)
//    und Anzeige (server.js haengt `form_guide` an jede Uebung des Plans). Die Reihenfolge ist Absicht:
//    „Rumaenisches Kreuzheben" vor „Kreuzheben", „Rudern / Latzug" vor „Latzug / Klimmzug".
//  * `avoid` ist die Notbremse gegen eine FALSCHE Karte, und die ist schlimmer als gar keine. An den
//    echten Plaenen der Pruef-Datenbanken gemessen: „Lying Hamstring Curls" fing sich ueber „curl" die
//    Bizeps-Karte ein, „Bulgarian Splits Squats" ueber „squat" die Kniebeuge statt der Ausfallschritte.
//  * Verglichen wird der NORMALISIERTE Name (Kleinschreibung, Umlaute und ihre Umschreibung auf denselben
//    Nenner, Sonderzeichen zu Leerzeichen) – sonst faellt „Klimmzuege" durch, weil es „Klimmzug" nicht
//    woertlich enthaelt. Die Muster stehen deshalb in dieser Schreibweise: `bankdrucken`, nicht `Bankdrücken`.
//  * `cues`/`errs` sind genau drei und drei – mehr liest im Studio niemand.
// Der Video-Link bleibt beim Coach (`exercises.video_url`); ohne ihn zeigt die Karte die vorhandene
// Suche („Ausfuehrung" im Uebungs-Menue). Es werden KEINE fremden Videos fest verdrahtet.
export const FORM_GUIDES = [
  { term: 'Rumänisches Kreuzheben', match: /rumanisch|\brdl\b|romanian/,
    cues: ['Knie leicht beugen und genau so gebeugt lassen – die Bewegung kommt aus der Hüfte.',
      'Hüfte nach hinten schieben, die Stange bleibt am Bein und wandert bis unter die Knie.',
      'Umkehrpunkt ist dort, wo die Oberschenkelrückseite zieht und der Rücken noch gerade ist.'],
    errs: ['Tief gehen wie bei der Kniebeuge – das ist eine andere Übung.',
      'Der untere Rücken rundet sich am tiefsten Punkt.',
      'Zu schwer gewählt: Dann zieht der Rücken statt der Beinrückseite.'] },
  { term: 'Kreuzheben', match: /kreuzheben|deadlift/,
    cues: ['Stange über der Mitte des Fußes, Schienbein fast an der Stange.',
      'Brust raus, Rücken gerade, Bauch fest – diese Linie hältst du bis oben.',
      'Den Boden wegdrücken statt die Stange zu reißen; die Stange schleift am Bein entlang.'],
    errs: ['Die Hüfte schießt zuerst hoch, der Rücken rundet nach – Brust und Hüfte steigen gemeinsam.',
      'Die Stange wandert nach vorne weg vom Körper.',
      'Oben ins Hohlkreuz lehnen – aufrecht stehen und Gesäß anspannen reicht.'] },
  { term: 'Kniebeuge', match: /kniebeuge|beinpresse|\bleg press\b|squat/, avoid: /split|bulgarian|lunge|ausfallschritt|sissy/,
    cues: ['Stange auf dem Muskel des oberen Rückens, nicht auf dem Nacken; Hände fest, Ellbogen darunter.',
      'Füße etwa schulterbreit, Zehen leicht nach außen – die Knie laufen über die Füße, nicht daran vorbei nach innen.',
      'Bauch fest, Brust offen, Hüfte und Knie zugleich beugen – so tief, wie der Rücken gerade bleibt.'],
    errs: ['Die Fersen heben ab: Stand zu eng oder Sprunggelenke zu steif – der ganze Fuß bleibt am Boden.',
      'Die Knie fallen nach innen.',
      'Der untere Rücken rundet am tiefsten Punkt.'],
    note: 'An der Beinpresse gelten dieselben zwei Punkte: Knie in der Spur der Füße, und der untere Rücken bleibt flach am Polster.' },
  { term: 'Bankdrücken', match: /bankdrucken|liegestutz|push ?up|bench ?press|chest press|incline.*press/, avoid: /trizeps|triceps|schulter|shoulder|overhead|\bohp\b|beinpresse|leg press/,
    cues: ['Schulterblätter zusammen und nach unten, fest auf der Bank; die Füße stehen fest am Boden.',
      'Die Stange trifft die untere Brust, die Ellbogen stehen etwa 45 Grad zum Körper.',
      'Kurz die Brust berühren, dann gerade nach oben drücken.'],
    errs: ['Die Ellbogen stehen im rechten Winkel ab – das belastet die Schulter.',
      'Die Stange prallt von der Brust ab, statt kontrolliert abgesenkt zu werden.',
      'Das Gesäß hebt von der Bank – dann ist das Gewicht zu hoch.'],
    note: 'Auf der Schrägbank gilt dasselbe, die Stange trifft nur etwas höher. Beim Liegestütz bleibt der Körper eine gerade Linie von Kopf bis Ferse.' },
  { term: 'Schulterdrücken', match: /schulterdrucken|schulterpresse|shoulder ?press|overhead ?press|military press|\bohp\b/,
    cues: ['Startpunkt auf Höhe des Schlüsselbeins, Ellbogen leicht vor dem Körper.',
      'Bauch und Gesäß fest – der Rumpf ist das Fundament.',
      'Gerade nach oben drücken und die Arme oben ganz strecken.'],
    errs: ['Ins Hohlkreuz lehnen, um das Gewicht nach oben zu bekommen.',
      'Das Gewicht vor dem Kopf hochschieben statt neben dem Kopf.',
      'Nur halbe Wege: oben nicht strecken, unten nicht ablegen.'] },
  { term: 'Rudern', match: /rudern|\brows?\b|rowing/,
    cues: ['Rücken gerade, Oberkörper vorgeneigt, Bauch fest.',
      'Die Ellbogen eng am Körper nach hinten ziehen, die Schulterblätter zusammenführen.',
      'Kontrolliert zurücklassen, ohne dass der Rücken nachgibt.'],
    errs: ['Der Oberkörper pendelt bei jeder Wiederholung mit.',
      'Mit den Armen ziehen statt mit dem Rücken – die Ellbogen führen.',
      'Zu schweres Gewicht, der Rücken rundet sich.'] },
  { term: 'Latzug / Klimmzug', match: /latzug|klimmzug|lat ?pull|\bpull ?ups?\b|chin ?up/,
    cues: ['Erst die Schultern nach unten ziehen, dann die Ellbogen.',
      'Brust zur Stange, leichte Rücklage, Rumpf fest.',
      'Kontrolliert ablassen, bis die Arme fast gestreckt sind.'],
    errs: ['Mit Schwung aus der Hüfte reißen – lieber eine Wiederholung weniger.',
      'Die Stange in den Nacken ziehen statt vor den Körper.',
      'Nur den halben Weg ablassen.'] },
  { term: 'Bizeps-Curls', match: /bizeps|biceps|curls?\b/, avoid: /hamstring|beinbeuger|leg ?curl|nordic|wrist|handgelenk|trizeps|triceps/,
    cues: ['Die Ellbogen bleiben am Körper, nur der Unterarm bewegt sich.',
      'Oben kurz anspannen, unten fast strecken.',
      'Das Handgelenk bleibt gerade.'],
    errs: ['Mit Schwung aus dem Rücken hochreißen.',
      'Die Ellbogen wandern nach vorn – dann arbeitet die Schulter mit.',
      'Nur halbe Wiederholungen.'] },
  { term: 'Trizeps-Drücken', match: /trizeps|triceps|\bdips?\b/,
    cues: ['Die Ellbogen zeigen nach vorn und bleiben an ihrem Platz.',
      'Nur der Unterarm bewegt sich, bis die Arme gestreckt sind.',
      'Oberkörper aufrecht, Bauch fest.'],
    errs: ['Der ganze Körper drückt mit.',
      'Die Ellbogen spreizen nach außen.',
      'Zu schwer – dann übernimmt die Schulter.'] },
  { term: 'Face Pulls', match: /face ?pull/,
    cues: ['Seil auf Gesichtshöhe, Handrücken zeigen nach außen.',
      'Zum Gesicht ziehen, die Ellbogen bleiben hoch.',
      'Am Ende kurz halten, Schulterblätter zusammen.'],
    errs: ['Zu schwer: Dann zieht der ganze Körper mit.',
      'Die Ellbogen hängen tief, es wird ein Rudern daraus.',
      'Den Kopf nach vorn schieben, statt die Griffe zum Gesicht zu ziehen.'] },
  { term: 'Hip Thrust', match: /hip ?thrust|huftstoss|glute bridge|beckenheben/,
    cues: ['Die Schulterblätter liegen auf der Bankkante, die Schienbeine stehen oben senkrecht.',
      'Kinn zur Brust, Blick nach vorn, die Rippen bleiben unten.',
      'Oben das Gesäß fest anspannen: Knie, Hüfte und Schulter in einer Linie.'],
    errs: ['Ins Hohlkreuz drücken, statt die Hüfte zu strecken.',
      'Die Füße stehen zu weit weg – dann arbeitet die Oberschenkelrückseite.',
      'Nur halb hoch: Das Gesäß spannt nie ganz an.'] },
  { term: 'Ausfallschritte', match: /ausfallschritt|lunges?\b|split ?squat|bulgarian/,
    cues: ['Großer Schritt, Oberkörper aufrecht.',
      'Das hintere Knie Richtung Boden senken, das vordere Schienbein bleibt fast senkrecht.',
      'Über die ganze Sohle des vorderen Fußes nach oben drücken.'],
    errs: ['Zu kurzer Schritt – das vordere Knie schiebt weit über die Zehen.',
      'Der Oberkörper kippt nach vorn.',
      'Wackeln: Erst ohne Gewicht sicher stehen, dann belasten.'] },
  { term: 'Wadenheben', match: /wadenheben|\bwaden\b|calf|calve/,
    cues: ['Die Ferse tief ablassen und unten kurz halten.',
      'Ganz hoch auf die Fußballen, oben eine Sekunde halten.',
      'Die Knie bleiben ruhig, kein Wippen aus dem Sprunggelenk.'],
    errs: ['Federn ohne Pause, oben wie unten.',
      'Nur ein kleiner Bewegungsausschnitt.',
      'Zu schnell – die Wade braucht Zeit unter Spannung.'] },
  { term: 'Beinheben', match: /beinheben|leg ?raises?\b|knieheben/,
    cues: ['Der untere Rücken bleibt am Boden bzw. am Polster.',
      'Die Bewegung startet im Becken, nicht mit Schwung aus den Beinen.',
      'Langsam ablassen und die Bauchspannung halten.'],
    errs: ['Beim Ablassen ins Hohlkreuz fallen – dann hörst du früher auf.',
      'Schwung holen.',
      'Nur die Hüfte arbeitet, der Bauch bleibt locker.'] },
  { term: 'Plank', match: /plank|unterarmstutz/,
    cues: ['Die Ellbogen stehen unter den Schultern, die Unterarme parallel.',
      'Bauch und Gesäß fest, Becken leicht einrollen – eine gerade Linie von Kopf bis Ferse.',
      'Ruhig weiteratmen und die Zeit im Blick behalten.'],
    errs: ['Die Hüfte hängt durch.',
      'Das Gesäß steht zu hoch.',
      'Den Kopf in den Nacken legen – der Blick geht auf den Boden.'] },
];

// Welche Technik-Karte gehoert zu dieser Uebung? Liefert den `term` oder '' (kein Treffer).
// Absichtlich nur ueber den NAMEN: eine umbenannte Uebung bekommt so die passende Karte, und es gibt
// keine zweite Liste, die irgendwann von dieser abweicht.
export function formGuideFor(name) {
  const n = formNameNorm(name);
  if (!n) return '';
  const hit = FORM_GUIDES.find(g => g.match.test(n) && !(g.avoid && g.avoid.test(n)));
  return hit ? hit.term : '';
}

// Uebungsname auf einen Nenner: Kleinschreibung, Umlaute und ihre Umschreibung gleich, alles Uebrige
// zu einem Leerzeichen. Dieselbe Idee wie die Suche in public/js/search.js – „Klimmzuege", „Klimmzüge"
// und „Klimmzug" landen so auf derselben Karte, „Trizeps-Drücken" wird zu „trizeps drucken".
export function formNameNorm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Der Lexikon-Text einer Karte – aus Cues und Fehlern gebaut, damit Karte und Lexikon nie auseinanderlaufen.
export function formGuideDef(g) {
  if (!g) return '';
  const cues = (g.cues || []).map((c, i) => `${i + 1}. ${c}`).join('\n');
  const errs = (g.errs || []).map(e => `– ${e}`).join('\n');
  return `So geht es:\n${cues}\n\nTypische Fehler:\n${errs}` + (g.note ? `\n\n${g.note}` : '');
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

// ---- DIE EINE KONSISTENZ-MECHANIK (A-V.3, CRITIC K10) -------------------------------------
// Bis 2.8.0 liefen drei Zaehlungen nebeneinander: Tages-Streak (streakDays, „31 Check-ins in
// Folge"), Wochenziel-Serie (weeklyGoalStreak) und die Joker-Buchhaltung. Drei Zahlen ueber
// dieselbe Frage – und die lauteste davon (die Tages-Streak) bestraft genau das, was ein
// Trainingsplan ausdruecklich vorsieht: Ruhetage. STRATEGY Abschnitt 8 nennt das einen Schaden,
// keinen Antrieb.
// Ab 2.9.0 gilt EINE Aussage: „x von y geplanten Einheiten diese Woche". Ein Fehltag bricht
// nichts – die Woche laeuft bis Sonntag weiter, und erst eine ganze verfehlte Woche unterbricht
// die Serie. Die Zahlen kommen aus DERSELBEN Rechnung wie die Wochenziel-Serie darueber
// (weeklyGoalStreak wird hier aufgerufen, nicht nachgebaut – CRITIC K1).
//
// dates = Tage MIT Einheit ('YYYY-MM-DD', Duplikate erlaubt), plannedPerWeek = geplante
// Einheiten pro Woche (users.days_per_week). Rueckgabe rein numerisch, ohne einen Satz Text:
// die Formulierung gehoert in die Oberflaeche (home.js), damit es sie genau einmal gibt.
export function weekConsistency(dates, plannedPerWeek, todayStr) {
  const planned = Math.max(1, Math.min(7, Math.round(Number(plannedPerWeek) || 0) || 3));
  const today = todayStr || tzToday();
  const mon = mondayOf(today);
  const inWeek = new Set();
  for (const d of (dates || [])) { if (mondayOf(d) === mon) inWeek.add(d); }
  const done = inWeek.size;
  // Wie viele Tage bleiben in dieser Woche (heute mitgezaehlt)? Montag = 7, Sonntag = 1.
  const daysLeft = 7 - Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(mon + 'T00:00:00Z')) / 864e5);
  return {
    planned, done, weekStart: mon,
    hit: done >= planned,
    left: Math.max(0, planned - done),
    daysLeft: Math.max(0, Math.min(7, daysLeft)),
    // Genug Tage uebrig, um das Pensum noch zu schaffen? Nur DAS ist der Grund fuer einen
    // Hinweis – nicht eine gerissene Serie.
    reachable: Math.max(0, planned - done) <= Math.max(0, Math.min(7, daysLeft)),
    weeksInRow: weeklyGoalStreak(dates, planned, today)
  };
}

// ---- WIEDERKEHR-LEITER (A-V.3, RATE-25-engagement H1) --------------------------------------
// Heute feuert die Trainings-Erinnerung fuer Ausgestiegene endlos weiter (server.js/cronTick
// prueft nur push_hour und den day_log von HEUTE, nie „wann war der letzte Eintrag?"). Wer nach
// 30 Tagen Pause die App nicht oeffnet, bekommt trotzdem an vier von sechs Tagen „Heute ist
// Trainingstag! 💪" – bis er Push abschaltet und damit auch die Nachrichten seines Coachs verliert.
//
// Diese Funktion ist die EINE Entscheidung darueber, was ein inaktives Konto hoeren darf.
// Sprossen: Tag 5 · 10 · 14, ab 14 nur noch woechentlich (21, 28), ab 30 Stille.
// Zwischen den Sprossen: nichts. Bewusst OHNE Schuldton und OHNE Streak-Drohung
// (STRATEGY Abschnitt 8) – Tag 14 fragt ehrlich, ob der Plan pausieren soll.
//
// daysSinceEntry: Tage seit dem letzten Eintrag (Check-in ODER Satz ODER Mahlzeit); 0 = heute.
//                 null/undefined = noch nie etwas eingetragen -> keine Leiter (das ist Onboarding,
//                 nicht Wiederkehr).
// enabled:        false = der Nutzer hat die Wiederkehr-Erinnerungen abgeschaltet -> Stille.
// Rueckgabe: null (nichts senden) oder { step, title, body, url, silenceTraining }.
// `silenceTraining: true` heisst: an diesem Tag darf AUSSER dieser Nachricht keine
// Trainings-Erinnerung raus. Ab Tag 14 ist das dauerhaft so, bis wieder etwas eingetragen wird.
export function reminderLadder({ daysSinceEntry, enabled = true } = {}) {
  const d = daysSinceEntry;
  if (d == null || !Number.isFinite(Number(d))) return null;
  const n = Math.max(0, Math.round(Number(d)));
  // Ab 14 Tagen ohne Eintrag schweigt die taegliche Trainings-Erinnerung in JEDEM Fall – auch
  // wenn der Nutzer die Wiederkehr-Nachrichten abgeschaltet hat. Das Abschalten darf nicht dazu
  // fuehren, dass stattdessen der alte Endlos-Nag wieder uebernimmt.
  const quiet = n >= 14;
  const off = () => (quiet ? { step: 0, silenceTraining: true } : null);
  if (!enabled) return off();
  if (n >= 30) return off();                      // Stille. Nur noch die Sonntags-Nachricht.
  if (n === 5) return { step: 5, silenceTraining: false, url: '/?go=checkin',
    title: 'Fünf Tage Pause', body: 'Ein Check-in dauert 20 Sekunden und bringt deine Woche zurück.' };
  if (n === 10) return { step: 10, silenceTraining: false, url: '/?go=messages',
    title: 'Alles in Ordnung?', body: 'Schreib deinem Coach kurz, was gerade los ist – dann passt ihr den Plan an.' };
  if (n === 14) return { step: 14, silenceTraining: true, url: '/?go=home',
    title: 'Plan pausieren?', body: 'Zwei Wochen Pause. Sag Bescheid, dann hörst du bis zum Neustart nichts mehr von mir.' };
  // 15-29: nur noch woechentlich (21, 28) – eine ruhige Erinnerung, dass es die App noch gibt.
  if (n > 14 && n % 7 === 0) return { step: n, silenceTraining: true, url: '/?go=home',
    title: 'Dein Plan wartet', body: 'Er steht genau so, wie du ihn verlassen hast. Ein Tag reicht zum Wiedereinstieg.' };
  return off();
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

// ------------------------------------------------------------
// DIE EINE e1RM-REGEL – EINE GRENZE, EIN TEXT, EINE QUELLE
// ------------------------------------------------------------
// Gueltigkeitsgrenze der 1RM-Schaetzung: oberhalb von 12 Wiederholungen laufen Epley, Brzycki und
// Lombardi immer weiter auseinander – bei 50 kg x 30 sagt Epley 100 kg und Brzycki 257 kg, das ist
// mehr als das Zweieinhalbfache. Eine Zahl, die so stark von der gewaehlten Formel abhaengt, ist
// keine Aussage ueber die Kraft des Nutzers.
// Nachgerechnet (Epley 1+r/30 gegen Brzycki 36/(37−r), Abstand bezogen auf den kleineren Wert):
//   8 Wdh. 2,0 % · 10 Wdh. 0,0 % · 12 Wdh. 2,9 % · 13 Wdh. 4,7 % · 15 Wdh. 9,1 % · 20 Wdh. 27,1 %
// Bis 12 Wiederholungen bleibt der Abstand unter 3 % – so gross ist die Rundung auf 0,1 kg ohnehin
// nicht, aber es ist dieselbe Groessenordnung. Ab 13 waechst er schnell, ab 15 ist er zweistellig.
//
// DIESE ZAHL GILT UEBERALL. Bis 3.0.0 gab es zwei: 12 fuer den Rekordwert (estimate1RM) und 10 fuer
// den Verlauf (e1rmSeries) – dazu 10 in public/js/training.js und 12 in public/js/analysis.js. Ein
// Satz 140 kg x 11 stand deshalb im Analyse-Sheet mit 191,3 kg und galt im Trainings-Sheet als „zaehlt
// nicht"; dieselbe Uebung, derselbe Server, derselbe Tag, zwei Zahlen. Gemessen an Marcos echten
// Saetzen (rate-training.db, 411 Saetze): mit der Grenze 10 fielen 113 Zwoelfer-Saetze heraus, drei
// Uebungen blieben ohne jeden Verlauf und vier bestehende Rekorde (u. a. Wide Grip Lat Pull Down
// 105,0 kg) haetten ihren Status verloren. Darum bleibt die alte, bereits ausgelieferte Grenze 12
// stehen und der Verlauf zieht nach – ABWEICHUNG von BUILD-B1 3.3/5, ausdruecklich und begruendet.
// Wer sie aendern will, aendert sie HIER; alles andere liest sie ueber e1rmRule().
export const E1RM_MAX_REPS = 12;
// Und eine Obergrenze fuer das Gewicht: der Weltrekord im Kreuzheben liegt bei rund 500 kg, die
// schwerste Beinpresse in einem Studio deutlich darunter. 2.000 kg sind grosszuegig und halten das
// draussen, was keine Hantel ist – ein Satz mit 1e21 kg ergab sonst einen Verlauf, dessen Differenz
// ueberlief (`deltaKg: Infinity`).
export const E1RM_MAX_WEIGHT_KG = 2000;
export const E1RM_FORMULA = 'Epley';
export const E1RM_FORMULA_TEXT = 'e1RM = Gewicht × (1 + Wdh. ÷ 30) — Formel nach Epley';

// Die Regel als Datensatz: Formel, Grenze und der WORTLAUT der Fussnote. Beide Oberflaechen (Training
// und Analyse) sollen denselben Satz anzeigen, statt ihn je selbst zu formulieren – zwei Fussnoten
// ueber dieselbe Kennzahl sind zwei Behauptungen, und eine davon ist dann falsch (P3).
export function e1rmRule(maxReps = E1RM_MAX_REPS) {
  // Eine Grenze ausserhalb von 1–50 Wiederholungen ist keine Grenze, sondern ein Versehen (1e21 stand
  // sonst woertlich in der Fussnote). Dann gilt die dokumentierte Zahl.
  const n = Math.trunc(Number(maxReps));
  const lim = Number.isFinite(n) && n >= 1 && n <= 50 ? n : E1RM_MAX_REPS;
  return {
    formula: E1RM_FORMULA,
    formulaText: E1RM_FORMULA_TEXT,
    maxReps: lim,
    workOnly: true,
    source: 'Mayhew u. a. 2008',
    note: 'Gezählt wird der beste Arbeitssatz mit höchstens ' + lim + ' Wiederholungen – Aufwärm-, Drop- und '
      + 'Backoff-Sätze bleiben draußen. Über ' + lim + ' Wiederholungen laufen die gängigen Formeln zu weit '
      + 'auseinander für eine belastbare Zahl (Mayhew u. a. 2008).',
  };
}

// Geschätztes 1-Rep-Max nach Epley-Formel.
// Ausserhalb des Gueltigkeitsbereichs (mehr als `maxReps` Wiederholungen) gibt es KEINE Schaetzung:
// die Funktion liefert 0 = „nicht schaetzbar". Vorher machte ein Aufwaermsatz 60 kg x 15 rechnerisch
// 90 kg daraus und schlug damit den echten Arbeitssatz 67,5 kg x 8 (85,5 kg) – in der Analyse stand
// „1RM ~90 kg" und der Satz galt als Rekord (RECHEN-REVIEW D14).
export function estimate1RM(weight, reps, maxReps = E1RM_MAX_REPS) {
  const w = Number(weight) || 0, r = Number(reps) || 0;
  if (!isFinite(w) || !isFinite(r)) return 0;   // Infinity ist keine Zahl von einer Hantel
  if (w <= 0 || r < 1 || w > E1RM_MAX_WEIGHT_KG) return 0;
  const lim = Math.trunc(Number(maxReps));      // dieselbe Grenzenlogik wie e1rmRule(), ohne Objekt je Satz
  if (r > (Number.isFinite(lim) && lim >= 1 && lim <= 50 ? lim : E1RM_MAX_REPS)) return 0;
  if (r === 1) return w;
  const e = Math.round(w * (1 + r / 30) * 10) / 10;
  // Nicht nur die Eingabe, auch das Ergebnis: 1,8e308 kg x 12 lief in der Multiplikation ueber und
  // gab `Infinity` zurueck – daraus wurde im Verlauf ein `deltaKg: NaN`. Was ueberlaeuft, ist nicht
  // schaetzbar, und „nicht schaetzbar" heisst in dieser Funktion 0.
  return Number.isFinite(e) ? e : 0;
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
  // 2.9.0 (A-V.3, CRITIC K10): Hier stand bis 2.8.0 die TAGES-Serie („31 Tage Serie ohne
  // Unterbrechung", bei Joker-Tagen mit Zusatz). Das war die zweite Zaehlung neben dem Wochenziel
  // zwei Zeilen weiter oben – zwei Zahlen ueber dieselbe Frage, und die lautere von beiden zaehlte
  // Ruhetage als Versaeumnis. Ab jetzt gibt es nur die Wochen-Konsistenz (weekConsistency).
  // `weeksInRow` liefert der Server als optionales Feld; fehlt es (aeltere Antwort), entfaellt die
  // Zeile ersatzlos – eine fehlende Zahl ist besser als die falsche von vorher. Die Wochenzahlen
  // `streak`/`streakFrozen` bleiben im Objekt, weil analysis.js sie noch anzeigt (siehe DEFER-A5).
  if ((w.weeksInRow || 0) >= 2) add(`${w.weeksInRow} Wochen in Folge dein Pensum getroffen.`);
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

// ============================================================
// 3.0.0 — WELLE B-I (Paket B-I.1): ZEIT JE NUTZER, ADAPTIVE ZIELE, e1RM-VERLAUF,
//         DELOAD-VORSCHLAG, DIVERGENZ, KALIBRIERUNG
// ============================================================
// Alles hier ist reine Rechnung: keine Datenbank, kein Server, kein Zustand. Was die Funktionen
// zurueckgeben, ist immer (a) die Zahl, (b) woraus sie entstand und (c) ein Satz in Du-Form, der
// das sagt (P3). Nichts davon aendert etwas von selbst – Vorschlaege bleiben Vorschlaege (P10).

// ------------------------------------------------------------
// 1 · WELCHER TAG IST DAS FUER DIESEN NUTZER? (B-k)
// ------------------------------------------------------------
// `users.tz` gibt es seit 2.6.0 und wurde bis 2.9.0 NIE gelesen: „heute" war fuer jeden Nutzer die
// Zeitzone des Servers (APP_TZ, meist Europe/Berlin, in der Cloud oft UTC). Ein Check-in um 23:59
// in Wien landet auf einem UTC-Server am Vortag, die Streak reisst ohne Grund, und die Push-Stunde
// trifft die falsche Tageszeit. Ab hier beantwortet GENAU EINE Stelle die Frage.
//
// tzToday()/tzHour()/tzWeekday() bleiben unveraendert: sie sind die Antwort fuer die APP selbst
// (Cron-Takt, Server-Log, alles ohne Nutzerbezug). Sobald ein NUTZER gemeint ist, ist localDay()
// richtig – und localDay(null) ist exakt tzToday(), der Umstieg ist also schrittweise moeglich.
//
// Zeitzonen-Namen sind Text aus der Datenbank. Ein ungueltiger Name wirft in Intl eine RangeError;
// gecacht wird deshalb auch das Scheitern (null), sonst kostet jede Anfrage eines kaputten Kontos
// einen neuen Versuch samt Ausnahme. Ein Rueckfall auf APP_TZ ist gewollt: lieber die Zeitzone der
// App als gar keine Antwort. Er wird EINMAL je Name protokolliert, damit es niemandem entgeht.
const _dayFmtCache = new Map();
const _hourFmtCache = new Map();
function _fmtFor(cache, tz, opts) {
  const key = tz == null || tz === '' ? APP_TZ : String(tz);
  if (cache.has(key)) return cache.get(key);
  let f = null;
  try { f = new Intl.DateTimeFormat(opts.locale, { timeZone: key, ...opts.parts }); }
  catch (e) { f = null; console.error('[tz] Unbekannte Zeitzone "' + key + '" – es gilt ' + APP_TZ); }
  cache.set(key, f);
  return f;
}
// Zeitpunkt normalisieren. `at` weglassen heisst „jetzt". Ein UNLESBARES `at` wird NICHT still zu
// „jetzt": das waere genau die Bauart, an der diese App schon einmal gescheitert ist (fehlende
// Daten werden still zu einem Standardwert). Es gibt dann null zurueck – laut, aber nie falsch.
function _atDate(at) {
  if (at === undefined || at === null) return new Date();
  const d = at instanceof Date ? at : new Date(at);
  return isFinite(d.getTime()) ? d : null;
}

// ISO-Datum 'YYYY-MM-DD' des Tages, in dem `at` fuer einen Nutzer mit dieser Zeitzone liegt.
// Sommerzeit macht Intl selbst: der Umstellungstag hat 23 bzw. 25 Stunden, der DATUMSwechsel liegt
// trotzdem um Mitternacht Ortszeit. Rueckgabe null nur bei unlesbarem `at`.
export function localDay(tz, at) {
  const d = _atDate(at);
  if (!d) return null;
  const f = _fmtFor(_dayFmtCache, tz, { locale: 'en-CA', parts: { year: 'numeric', month: '2-digit', day: '2-digit' } });
  return f ? f.format(d) : tzToday(d);
}

// Stunde 0–23 in der Zeitzone des Nutzers. Fuer die Erinnerungs-Stunde (`users.push_hour`), die bis
// 2.9.0 in Serverzeit verglichen wurde: „19 Uhr" war fuer einen Nutzer in Wien auf einem UTC-Server
// 21 Uhr Ortszeit. Rueckgabe null nur bei unlesbarem `at`.
export function localHour(tz, at) {
  const d = _atDate(at);
  if (!d) return null;
  const f = _fmtFor(_hourFmtCache, tz, { locale: 'en-GB', parts: { hour: '2-digit', hour12: false } });
  if (!f) return tzHour(d);
  const h = parseInt(f.format(d), 10);
  return isFinite(h) ? h % 24 : null;
}

// Montag der Woche, in der dieser Nutzer gerade lebt ('YYYY-MM-DD'). Grundlage fuer
// `target_history.week_start`, den Wochenbericht und den Sonntags-Job.
// Die Wochenarithmetik selbst bleibt mondayOf() – reine UTC-Rechnung auf dem ISO-Datum, also von
// Sommerzeit unberuehrt. Erst der TAG wird lokal bestimmt, dann wird gerechnet; umgekehrt (erst
// rechnen, dann umrechnen) entsteht am Umstellungswochenende ein Sprung.
export function weekStart(tz, at) {
  const day = localDay(tz, at);
  return day ? mondayOf(day) : null;
}

// ------------------------------------------------------------
// 2 · VERBRAUCH AUS DEM GEWICHTSTREND (B-d, MacroFactor-Muster)
// ------------------------------------------------------------
// Die Formel des Tagesziels (Mifflin-St Jeor x Aktivitaetsfaktor) ist eine Schaetzung ueber eine
// Bevoelkerung. Die Energiebilanz ist eine Messung an EINEM Menschen: was gegessen wurde, minus
// was das Koerpergewicht daraus gemacht hat.
//
//   TDEE = Ø Aufnahme − (Gewichtsaenderung in kg x 7.700 kcal/kg) / Tage
//
// 7.700 kcal/kg ist der Energiegehalt von Koerpergewebe (Wishnofsky 1958; die uebliche Faustzahl,
// in der Praxis zwischen ~7.000 und ~9.400 je nach Anteil Fett/Magermasse). Genau deshalb ist das
// Ergebnis eine SCHAETZUNG mit Vertrauensangabe und wird auf 10 kcal gerundet – eine Zahl wie
// „2.683 kcal" taeuscht eine Genauigkeit vor, die die Methode nicht hat (P3).
//
// Das Gewicht wird als 7-Tage-EMA geglaettet (alpha = 2/(7+1) = 0,25): Wasser, Salz und Darminhalt
// bewegen die Waage taeglich um mehr, als eine Woche Diaet an Fett bewegt. Ohne Glaettung folgt das
// Ziel dem Rauschen – das ist der Fehler, den MacroFactor ausdruecklich vermeidet.
//
// **holding** ist die wichtigste Rueckgabe: bei weniger als vier Log-Tagen in der letzten Woche
// wird NICHT angepasst. Ein Ø aus zwei Tagen ist kein Wochenschnitt, und ein Ziel, das auf zwei
// Tagen steht, ist schlechter als das alte Ziel. „Zu wenig gelogged" ist ehrlich, nicht streng.
export const TDEE_KCAL_PER_KG = 7700;
export const TDEE_EMA_DAYS = 7;
export const TDEE_MIN_LOG_DAYS = 4;      // je Woche, sonst holding
export const TDEE_MIN_WEIGH_DAYS = 3;    // weniger Waegungen sind kein Verlauf, sondern zwei Punkte
export const TDEE_MAX_GAP_DAYS = 7;      // Pause zwischen zwei Waegungen; darueber wird nicht gerechnet
export const TDEE_WINDOW_DAYS = 14;      // Standardfenster; MacroFactor braucht 14–30 Tage bis zur Ruhe
const TDEE_PLAUSIBLE = [1000, 6000];     // ausserhalb ist die Rechnung kaputt, nicht der Mensch
export const TDEE_WEIGHT_BAND = [20, 500];      // kg – darunter/darueber ist es keine Waegung
export const TDEE_KCAL_BAND = [0, 30000];       // kcal je Tag – 0 ist erlaubt (Fastentag), 1e21 nicht

// ISO-Datum + n Tage (reine UTC-Arithmetik wie mondayOf)
function _isoAdd(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function _isoDiff(a, b) { // ganze Tage zwischen zwei ISO-Daten (b − a)
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
// Taggenaue Pruefung: die FORM allein reicht nicht. '2026-13-45' und '2026-02-30' haben das richtige
// Muster und sind trotzdem keine Tage – der erste laesst new Date() scheitern (und toISOString()
// werfen), der zweite rutscht still auf den 2. Maerz. Deshalb wird zurueckgerechnet: nur was sich
// selbst wieder ergibt, ist ein Datum. Rueckgabe: 'YYYY-MM-DD' oder null.
function _isoDay(v) {
  if (typeof v !== 'string') return null;
  const day = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(day + 'T00:00:00Z');
  return isFinite(d.getTime()) && d.toISOString().slice(0, 10) === day ? day : null;
}
// Rohzeilen -> Map 'YYYY-MM-DD' -> Zahl. Mehrere Zeilen am selben Tag: die LETZTE gewinnt (so wie
// ein korrigierter Check-in den alten ersetzt). Zeilen ohne brauchbares Datum oder ohne Zahl fallen
// weg – sie duerfen nicht als 0 in einen Mittelwert laufen.
// `zeroOk` sagt, was eine 0 BEDEUTET – und das ist je Reihe verschieden:
//   * Gewicht: 0 kg ist keine Waegung, sondern eine kaputte Zeile. Raus.
//   * Kalorien: 0 kcal ist eine AUSSAGE. Wer einen Fastentag ehrlich protokolliert, hat protokolliert.
//     Bis 3.0.0 flog dieser Tag hier heraus, `logDays7` sank von 7 auf 6, und bei vier Log-Tagen mit
//     einem Fastentag darunter sprang `holding` an: „Nur 3 von 7 Tagen protokolliert" – gesagt zu
//     jemandem, der sieben Tage lang eingetragen hat. Genau die Bauart „fehlende Daten werden still
//     zu etwas anderem", die der Kommentar ueber _atDate verbietet.
// Negative Werte bleiben in beiden Faellen draussen: weder ein Gewicht noch eine Mahlzeit ist negativ.
// `lo`/`hi` sind das Plausibilitaetsband der Reihe: ein Koerpergewicht von 1,8e308 kg und ein Tag mit
// 1e21 kcal sind keine Messwerte, sondern kaputte Zeilen – sie fielen sonst erst ganz am Ende auf
// (`trendKg: -371428571428571450000`, `tdeeSe: 1,27e23`, bei zwei solchen Zeilen `tdee: NaN`).
// Ausserhalb des Bandes wird die Zeile verworfen wie eine ohne Zahl.
function _byDay(rows, keys, zeroOk = false, lo = null, hi = null) {
  const m = new Map();
  for (const r of (Array.isArray(rows) ? rows : [])) {
    if (!r) continue;
    const day = _isoDay(r.date);
    if (!day) continue;
    let v = null;
    for (const k of keys) { const x = Number(r[k]); if (r[k] !== null && r[k] !== undefined && r[k] !== '' && isFinite(x)) { v = x; break; } }
    if (v === null) continue;
    if (zeroOk ? v < 0 : v <= 0) continue;
    if (lo !== null && (v < lo || v > hi)) continue;
    m.set(day, v);
  }
  return m;
}

export function tdeeFromTrend({ weights, kcals, days = TDEE_WINDOW_DAYS, today = null, kcalPerKg = TDEE_KCAL_PER_KG, minLogDays = TDEE_MIN_LOG_DAYS } = {}) {
  const W = _byDay(weights, ['kg', 'weight'], false, TDEE_WEIGHT_BAND[0], TDEE_WEIGHT_BAND[1]);
  const K = _byDay(kcals, ['kcal', 'kcals', 'energy'], true, TDEE_KCAL_BAND[0], TDEE_KCAL_BAND[1]);   // 0 kcal = Fastentag, nicht „kein Eintrag"
  // Auch die Parameter werden geprueft, nicht nur die Daten: `days: Infinity` lief in `_isoAdd` und
  // liess `toISOString()` mit „Invalid time value" WERFEN – ein Wochen-Job, der wirft, laeuft nicht,
  // und niemand sieht warum. Mehr als zehn Jahre Fenster gibt es nicht.
  const zahl = (v, fb, min, max) => { const x = Math.trunc(Number(v)); return Number.isFinite(x) && x >= min && x <= max ? x : fb; };
  const span = Math.max(2, zahl(days, TDEE_WINDOW_DAYS, 1, 3650) || TDEE_WINDOW_DAYS);
  // 7.700 kcal/kg ist die Faustzahl; 1.000 bis 100.000 laesst jede sinnvolle Variante zu und haelt
  // 1,8e308 draussen (das stand sonst als „1.7.976.931.348.623.157e+308 kcal/kg" in der Formelzeile).
  const kPerKg = (() => { const x = Number(kcalPerKg); return Number.isFinite(x) && x >= 1000 && x <= 100000 ? x : TDEE_KCAL_PER_KG; })();
  // Untergrenze 1, nicht 0: mit `minLogDays: 0` lief die Rechnung mit NULL Protokolltagen weiter und
  // `avgKcal` war 0/0 = NaN – das stand dann als Verbrauch da.
  const minLog = zahl(minLogDays, TDEE_MIN_LOG_DAYS, 1, 31);
  const all = [...W.keys(), ...K.keys()].sort();
  const leer = {
    tdee: null, confidence: 0, confidenceLabel: 'gering', holding: true,
    weighDays: 0, logDays: 0, logDays7: 0, zeroKcalDays: 0, spanDays: 0, maxGap: 0, days: span,
    avgKcal: null, trendKg: null, trendKgPerWeek: null, trendWeight: null, tdeeSe: null, from: null, to: null,
    formula: 'Energiebilanz: Ø Aufnahme − Gewichtsänderung × ' + _deInt(kPerKg) + ' kcal/kg',
    clamped: false,
    reason: 'Noch keine Daten – trag ein paar Tage Gewicht und Essen ein, dann rechne ich deinen Verbrauch aus.',
    holdReason: 'Noch keine Daten – dein Ziel bleibt, wie es ist.',
  };
  if (!all.length) return leer;

  const to = _isoDay(today) || all[all.length - 1];
  const from = _isoAdd(to, -(span - 1));
  const inWin = d => d >= from && d <= to;
  const wDays = [...W.keys()].filter(inWin).sort();
  const kDays = [...K.keys()].filter(inWin).sort();
  // „diese Woche" = die letzten sieben Tage des Fensters, nicht die Kalenderwoche: der Job laeuft
  // am Sonntag, aber die Frage „hat er genug gelogged?" gilt fuer die zurueckliegenden 7 Tage.
  const week0 = _isoAdd(to, -6);
  const logDays7 = kDays.filter(d => d >= week0).length;

  // Wie viele der Log-Tage waren Fastentage (0 kcal)? Sie ZAEHLEN als protokolliert und gehen in den
  // Schnitt ein – aber die Oberflaeche soll sie benennen koennen, statt den niedrigen Schnitt zu erklaeren.
  const zeroKcalDays = kDays.filter(d => K.get(d) === 0).length;
  const out = { ...leer, from, to, weighDays: wDays.length, logDays: kDays.length, logDays7, zeroKcalDays };
  if (wDays.length < 2 || kDays.length < minLog) {
    out.reason = wDays.length < 2
      ? 'Für einen Trend brauche ich mindestens zwei Wiegetage – bisher ' + (wDays.length === 1 ? 'ist es einer' : 'ist keiner') + '.'
      : 'Nur ' + kDays.length + ' von ' + span + ' Tagen protokolliert – das reicht für keinen Schnitt.';
    out.holdReason = 'Zu wenig Daten diese Woche – ich lasse dein Ziel stehen.';
    return out;
  }
  const spanDays = _isoDiff(wDays[0], wDays[wDays.length - 1]);
  out.spanDays = spanDays;
  let maxGap = 0;
  for (let i = 1; i < wDays.length; i++) maxGap = Math.max(maxGap, _isoDiff(wDays[i - 1], wDays[i]));
  out.maxGap = maxGap;
  if (spanDays < TDEE_EMA_DAYS - 1) {
    out.reason = 'Deine Wiegetage liegen nur ' + spanDays + ' Tage auseinander – ein Gewichtstrend braucht mindestens eine Woche.';
    out.holdReason = 'Der Gewichtstrend ist noch zu kurz – ich lasse dein Ziel stehen.';
    return out;
  }
  // Lange Pause: zwischen zwei Waegungen darf hoechstens eine Woche liegen. Darueber besteht der
  // „Trend" aus mehr erfundenen als gemessenen Tagen – und eine einzelne Waegung nach drei Wochen
  // Urlaub sagt ueber den Verlauf dazwischen nichts. Lieber keine Zahl als eine erfundene (P3).
  if (wDays.length < TDEE_MIN_WEIGH_DAYS || maxGap > TDEE_MAX_GAP_DAYS) {
    out.reason = wDays.length < TDEE_MIN_WEIGH_DAYS
      ? 'Nur ' + wDays.length + ' Wiegetage in ' + span + ' Tagen – für einen Trend brauche ich mindestens ' + TDEE_MIN_WEIGH_DAYS + '.'
      : 'Zwischen zwei Wiegetagen liegen ' + maxGap + ' Tage – über so eine Pause rechne ich keinen Trend.';
    out.holdReason = 'Zu wenige Wiegetage – ich lasse dein Ziel stehen.';
    return out;
  }

  // ---- 7-Tage-EMA des Gewichts ----
  // Warum ueberhaupt glaetten: Wasser, Salz und Darminhalt bewegen die Waage taeglich um mehr, als
  // eine Woche Diaet an Fett bewegt. alpha = 2/(7+1) = 0,25.
  // Luecken zwischen zwei Waegungen werden LINEAR aufgefuellt (so macht es jede Trendgewichts-App).
  // Weitergetragen wuerde der Trend sonst an jeder Luecke flach – bei einem Nutzer, der zweimal die
  // Woche wiegt, verschwaende das den halben Trend. Ausserhalb der Messpunkte wird NICHT verlaengert,
  // und ueber eine Pause von mehr als einer Woche wird gar nicht erst gerechnet (siehe oben).
  const alpha = 2 / (TDEE_EMA_DAYS + 1);
  const daily = [];
  for (let i = 0; i < wDays.length - 1; i++) {
    const a = W.get(wDays[i]), b = W.get(wDays[i + 1]), n = _isoDiff(wDays[i], wDays[i + 1]);
    for (let k = 0; k < n; k++) daily.push(a + (b - a) * k / n);
  }
  daily.push(W.get(wDays[wDays.length - 1]));
  let ema = daily[0];
  const emaSeries = [ema];
  for (let i = 1; i < daily.length; i++) { ema = alpha * daily[i] + (1 - alpha) * ema; emaSeries.push(ema); }
  const emaEnd = emaSeries[emaSeries.length - 1];

  // ---- Die RATE kommt aus einer Ausgleichsgeraden, nicht aus „EMA-Ende minus EMA-Anfang" ----
  // ABWEICHUNG vom Auftrag, gemessen und begruendet (im DONE-Bericht als Handrechnung H2/H3):
  // Die EMA laeuft der Wirklichkeit um (1−alpha)/alpha = 3 Tage hinterher, und ihr erster Wert ist
  // der Messwert selbst. Auf einem 14-Tage-Fenster ist dieses Einschwingen NIE vorbei – die Steigung
  // der EMA unterschaetzt den echten Trend deshalb systematisch: bei einer sauberen Gerade von
  // 80,0 auf 79,0 kg in 13 Tagen kam −0,936 kg statt −1,000 kg heraus (−6,4 %, das sind 38 kcal im
  // Ergebnis), auf 30 Tagen noch −2 %. Die Ausgleichsgerade durch die (aufgefuellten) TAGESWERTE
  // ist dagegen unverzerrt: sie liefert exakt −1,000 kg. Also:
  //   * EMA  -> das Trendgewicht, das der Nutzer SIEHT (geglaettet, ohne Tagesrauschen)
  //   * Gerade durch die Tageswerte -> die RATE, mit der gerechnet wird
  // Beides steht im Rueckgabewert, beides ist nachrechenbar.
  // Die Gerade laeuft ueber die WIRKLICH GEMESSENEN Tage (x = Tage seit der ersten Waegung), nicht
  // ueber die aufgefuellte Reihe: aufgefuellte Punkte sind keine Beobachtungen und wuerden die
  // Streuung kuenstlich kleinrechnen. Bei taeglichem Wiegen ist beides dasselbe.
  const xs = wDays.map(d => _isoDiff(wDays[0], d)), ys = wDays.map(d => W.get(d));
  const n0 = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0);
  const den = n0 * sxx - sx * sx;
  const slopePerDay = Math.abs(den) > 1e-9 ? (n0 * sxy - sx * sy) / den : 0;
  // Wie genau ist diese Steigung? Standardfehler aus der Streuung der Messpunkte um die Gerade,
  // umgerechnet in kcal. Das ist die ehrliche Antwort auf „wie sicher ist die Zahl": bei einer
  // Waage, die taeglich um ein Kilo schwankt, steht neben 2.310 kcal eben „± 410" – und nicht
  // die Behauptung, man haette den Verbrauch gemessen (Unsicherheit gehoert als Bereich hin).
  const mx = sx / n0, my = sy / n0;
  const sxxC = xs.reduce((a, x) => a + (x - mx) * (x - mx), 0);
  const dof = n0 - 2;
  let tdeeSe = null;
  if (dof > 0 && sxxC > 0) {
    const sse = ys.reduce((a, y, i) => { const r = y - (my + slopePerDay * (xs[i] - mx)); return a + r * r; }, 0);
    tdeeSe = Math.round(Math.sqrt(sse / dof) / Math.sqrt(sxxC) * kPerKg / 10) * 10;
  }
  const trendKg = Math.round(slopePerDay * spanDays * 1000) / 1000;
  const trendKgPerWeek = Math.round(slopePerDay * 7 * 100) / 100;
  const avgKcal = Math.round(kDays.reduce((s, d) => s + K.get(d), 0) / kDays.length);
  // Energie, die je Tag in den Koerper gewandert ist (positiv) bzw. aus ihm heraus (negativ).
  // 1 kg Koerpergewebe = 7.700 kcal (Wishnofsky 1958; Faustzahl, siehe Kopf des Abschnitts).
  const balancePerDay = slopePerDay * kPerKg;
  let tdee = Math.round((avgKcal - balancePerDay) / 10) * 10;

  // Abdeckung: wie dicht ist die Datenlage? Das Wiegen zaehlt am meisten – es ist der verrauschte
  // Teil der Bilanz –, das Loggen fast so viel, die Fensterlaenge ein Fuenftel. 14 Tage sind das
  // Mass, ab dem MacroFactor die Schaetzung selbst als beruhigt beschreibt.
  // Der vierte Teil ist die Streuung selbst: eine dichte Datenlage mit einer Waage, die jeden Tag
  // etwas anderes sagt, ist NICHT vertrauenswuerdiger als eine duenne – das sieht man nur am
  // Standardfehler. 300 kcal sind hier die Kante: mehr als drei Wochenschritte (3 x 100) Unsicherheit
  // heissen, dass die Woche nichts zu sagen hat.
  const cW = Math.min(1, wDays.length / span), cK = Math.min(1, kDays.length / span);
  const cS = Math.min(1, spanDays / TDEE_WINDOW_DAYS);
  const cN = tdeeSe === null ? 0.5 : Math.max(0, Math.min(1, 1 - tdeeSe / 300));
  let confidence = Math.round((0.35 * cW + 0.25 * cK + 0.15 * cS + 0.25 * cN) * 100) / 100;
  if (tdee < TDEE_PLAUSIBLE[0] || tdee > TDEE_PLAUSIBLE[1]) {
    out.clamped = true;
    tdee = Math.max(TDEE_PLAUSIBLE[0], Math.min(TDEE_PLAUSIBLE[1], tdee));
    confidence = Math.min(confidence, 0.3);
  }
  const holding = logDays7 < minLog;
  const trendTxt = Math.abs(trendKg) < 0.05 ? 'dein Gewicht steht'
    : (trendKg > 0 ? '+' : '−') + _de1(Math.abs(trendKg)) + ' kg Trend';
  return {
    ...out,
    tdee, confidence,
    confidenceLabel: confidence < 0.5 ? 'gering' : (confidence < 0.75 ? 'mittel' : 'hoch'),
    holding,
    avgKcal, trendKg, trendKgPerWeek, trendWeight: Math.round(emaEnd * 100) / 100, tdeeSe,
    reason: span + ' Tage: Ø ' + _deInt(avgKcal) + ' kcal gegessen, ' + trendTxt
      + ' – dein Verbrauch liegt bei etwa ' + _deInt(tdee) + ' kcal.',
    holdReason: holding
      ? 'Nur ' + logDays7 + ' von 7 Tagen protokolliert – ich lasse dein Ziel stehen.'
      : null,
  };
}

// ------------------------------------------------------------
// 3 · ZIELE NACHFUEHREN (B-d)
// ------------------------------------------------------------
// Vier Regeln, alle aus dem Auftrag und alle hart im Code:
//   1. hoechstens ±100 kcal je Woche. Eine groessere Korrektur ist keine Steuerung, sondern ein
//      Sprung – und sie bestraft eine einzelne ungenaue Woche.
//   2. Eiweiss bleibt an g/kg (proteinRefWeight x GOAL_KCAL[goal].proteinPerKg) – es haengt am
//      Menschen, nicht an den Kalorien.
//   3. Fett nie unter fatFloorG(kcal, kg) – die Untergrenze aus 2.5.0, unveraendert.
//   4. Kohlenhydrate sind der Rest.
// Dazu: unter `floorKcal` (Grundumsatz/Praxisgrenze aus nutritionPlan) geht es nie, und ohne
// Uebergabe gilt die niedrigste Praxisgrenze der App als harte Kante.
// Rueckgabe traegt IMMER einen Satz Begruendung in Du-Form – die Karte in der Ernaehrung zeigt ihn
// woertlich, der Wochen-Job schreibt ihn nach `target_history.reason` (P3).
export const ADAPT_MAX_STEP_KCAL = 100;   // je Woche
export const ADAPT_MIN_STEP_KCAL = 25;    // darunter bleibt das Ziel stehen (Totzone gegen Rauschen)
export const ADAPT_HARD_FLOOR_KCAL = 1200;
// Wie weit darf die GEMESSENE Zahl von der GERECHNETEN abweichen, bevor ich ihr nicht mehr glaube?
// Gemessen an der echten Testdatenbank (Konto 2, 14-Tage-Fenster): tdeeFromTrend kam auf 1.840 kcal,
// die Formel auf 2.913 – nicht weil der Mensch so wenig verbraucht, sondern weil an 5 von 7 Tagen
// nur ein Teil des Essens protokolliert war. Halb protokollierte Tage sehen fuer die Energiebilanz
// aus wie kleine Tage; das Ziel waere Woche fuer Woche um 100 kcal gefallen, ohne dass irgendwo ein
// Fehler sichtbar geworden waere. Weicht die Messung um mehr als 35 % von der Formel ab, wird
// deshalb NICHT angepasst – mit genau diesem Satz als Begruendung. Die Formel ist nicht die
// Wahrheit, aber sie ist eine Plausibilitaetsgrenze: 35 % ist mehr als jede Abweichung, die durch
// Koerperbau, Aktivitaet oder Formelwahl zustande kommt.
export const ADAPT_PLAUSIBLE_BAND = 0.35;
// Was ueberhaupt als Kalorienzahl durchgeht – Ziel wie gemessener Verbrauch. Die Untergrenze liegt
// bewusst TIEF (100): ein viel zu niedriges Ziel soll nicht als „kein Ziel" durchfallen, sondern von
// der Untergrenze (ADAPT_HARD_FLOOR_KCAL) angehoben werden. Nach oben ist bei 20.000 Schluss; was
// darueber liegt, kommt aus einer kaputten Zeile, nicht von einem Menschen.
export const ADAPT_KCAL_BAND = [100, 20000];

export function adaptTargets({ current, tdee, goal, weeksInPhase = null, weightKg = null, heightCm = null,
  daysPerWeek = 4, trendKgPerWeek = null, maxStep = ADAPT_MAX_STEP_KCAL, minStep = ADAPT_MIN_STEP_KCAL,
  floorKcal = null, tdeeFormula = null } = {}) {
  const cur = current || {};
  // Eine Zahl, die keine ENDLICHE Zahl ist, ist keine Angabe. `Number(x) > 0` laesst Infinity durch:
  // ein `current.kcal` von Infinity kam als Kalorienziel Infinity wieder heraus, JSON.stringify machte
  // daraus `null`, und in `target_history` stuende dann das Nichts als Tagesziel. Alles, was von aussen
  // kommt, laeuft deshalb zuerst durch `fz` – fehlt der Wert oder ist er unendlich, ist er nicht da.
  const fz = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  // Und eine endliche Zahl ist noch kein Kalorienziel: ausserhalb von 500–20.000 kcal ist die Zeile
  // kaputt, nicht der Mensch. Dann wird nichts nachgefuehrt – mit demselben Satz wie „kein Ziel da".
  const band = (v, lo, hi) => { const x = fz(v); return x !== null && x >= lo && x <= hi ? x : null; };
  const curKcal = band(cur.kcal, ADAPT_KCAL_BAND[0], ADAPT_KCAL_BAND[1]) !== null ? Math.round(band(cur.kcal, ADAPT_KCAL_BAND[0], ADAPT_KCAL_BAND[1])) : null;
  const curP = fz(cur.protein), curC = fz(cur.carbs), curF = fz(cur.fat);
  const tdeeN = band(tdee, ADAPT_KCAL_BAND[0], ADAPT_KCAL_BAND[1]);
  const kgRoh = band(weightKg, 20, 500), hcm = band(heightCm, 100, 250);
  const gk = goalKcal(goal);
  // `goal || 'health'` liess jede Wahrheit durch – bei goal = Infinity stand `goal: Infinity` in der
  // Antwort. Gueltig ist nur, was GOAL_KCAL kennt; alles andere ist 'health' (so rechnet goalKcal auch).
  const goalName = (typeof goal === 'string' && GOAL_KCAL[goal]) ? goal : 'health';
  const base = {
    kcal: curKcal, protein: curP || null, carbs: curC || null, fat: curF || null,
    change: 0, changed: false, capped: false, floored: false, conflict: false, implausible: false,
    source: 'adaptiv', goal: goalName, factor: null, want: null,
  };
  if (!(tdeeN > 0) || curKcal === null) {
    return { ...base, reason: !(tdeeN > 0)
      ? 'Diese Woche fehlen mir Daten für eine Verbrauchsschätzung – dein Ziel bleibt, wie es ist.'
      : 'Ohne ein bestehendes Kalorienziel kann ich nichts nachführen – setz erst ein Ziel.' };
  }
  // Plausibilitaetsschranke gegen halb protokollierte Tage (siehe ADAPT_PLAUSIBLE_BAND).
  const tf = band(tdeeFormula, ADAPT_KCAL_BAND[0], ADAPT_KCAL_BAND[1]);
  if (tf > 0 && Math.abs(tdeeN - tf) / tf > ADAPT_PLAUSIBLE_BAND) {
    return { ...base, implausible: true,
      reason: 'Gemessen komme ich auf ' + _deInt(tdeeN) + ' kcal Verbrauch, gerechnet auf ' + _deInt(tf) + ' – das liegt zu weit auseinander. '
        + (tdeeN < tf ? 'Wahrscheinlich fehlen protokollierte Mahlzeiten. ' : 'Wahrscheinlich fehlen Wiegetage, oder es steckt eine Wasserschwankung drin. ')
        + 'Dein Ziel bleibt, wie es ist.' };
  }
  // Wochenschnitt des Ziel-Faktors: an d Trainingstagen gilt gk.train, an (7−d) Ruhetagen gk.rest.
  // Damit rechnet adaptTargets mit exakt derselben Absicht wie nutritionPlan – nur auf den
  // DURCHSCHNITTSTAG bezogen, denn die Bilanz aus tdeeFromTrend ist ebenfalls ein Tagesmittel.
  const d = Math.max(0, Math.min(7, fz(daysPerWeek) > 0 ? fz(daysPerWeek) : 4));
  const factor = (d * gk.train + (7 - d) * gk.rest) / 7;
  const want = Math.round(tdeeN * factor);
  const diff = want - curKcal;
  // Auch die Schrittweiten kommen von aussen: ein `maxStep` von Infinity haette den Deckel still
  // abgeschaltet, ein `minStep` von Infinity jede Aenderung verschluckt.
  const maxS = Math.abs(fz(maxStep) === null ? ADAPT_MAX_STEP_KCAL : fz(maxStep));
  const minS = Math.abs(fz(minStep) === null ? ADAPT_MIN_STEP_KCAL : fz(minStep));
  let step = Math.max(-maxS, Math.min(maxS, diff));
  const capped = Math.abs(diff) > maxS;
  if (Math.abs(diff) < minS) step = 0;
  // Auf 10 kcal runden – aber IMMER zur alten Zahl hin. Sonst macht das Runden aus dem Deckel von
  // 100 kcal eine 105 (3.175 + 100 = 3.275 -> gerundet 3.280), und die Regel steht nur noch fast.
  // Bei step = 0 (Totzone) bleibt die Zahl unangetastet – runden waere hier selbst eine Aenderung.
  let kcal = step === 0 ? curKcal
    : (step > 0 ? Math.floor((curKcal + step) / 10) * 10 : Math.ceil((curKcal + step) / 10) * 10);
  // Die Untergrenze STICHT die Deckelung: liegt das bestehende Ziel unter dem Grundumsatz bzw. unter
  // der Praxisgrenze, wird es sofort angehoben und nicht in 100er-Schritten. Ein zu tiefes Ziel in
  // Ruhe zu lassen, weil die Schrittweite es verbietet, waere die falsche Vorsicht – deshalb kann
  // `change` in genau diesem Fall (floored = true) groesser als maxStep sein. Nach OBEN gibt es
  // keine solche Ausnahme.
  const floor = Math.max(fz(floorKcal) > 0 ? Math.round(fz(floorKcal)) : 0, ADAPT_HARD_FLOOR_KCAL);
  const floored = kcal < floor;
  if (floored) kcal = floor;
  const change = kcal - curKcal;

  const kg = kgRoh > 0 ? kgRoh : 0;
  // Eiweiss: an g/kg gebunden. Ohne Gewicht bleibt der bisherige Wert stehen – eine Zahl zu raten
  // waere hier besonders teuer (RECHEN-REVIEW D27: 2,2 g/kg auf 120 kg sind 44 % der Energie).
  const protein = kg > 0 ? Math.round(proteinRefWeight(kg, hcm) * gk.proteinPerKg)
    : (curP > 0 ? Math.round(curP) : 0);
  // Fett: mitskaliert, aber nie unter die Untergrenze. Ein vom Coach von Hand gesetztes hoeheres
  // Fettziel bleibt damit erhalten – die Anpassung aendert die Kalorien, nicht die Ernaehrungsform.
  const fatFloor = fatFloorG(kcal, kg);
  const scaledFat = curF > 0 ? Math.round(curF * kcal / curKcal) : fatFloor;
  let fat = Math.max(fatFloor, scaledFat);
  let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  if (carbs < 0 && fat > fatFloor) { fat = fatFloor; carbs = Math.round((kcal - protein * 4 - fat * 9) / 4); }
  const conflict = carbs < 0;
  carbs = Math.max(0, carbs);

  // ---- Der eine Satz (Du-Form) ----
  // Teil 1 sagt, WAS gemessen wurde, Teil 2, was daraus folgt. Ohne Teil 1 ist die Zahl eine
  // Behauptung; ohne Teil 2 weiss niemand, was jetzt gilt.
  const tw = trendKgPerWeek === null || trendKgPerWeek === undefined || !isFinite(Number(trendKgPerWeek))
    ? null : Number(trendKgPerWeek);
  const wks = fz(weeksInPhase) > 0 ? Math.round(fz(weeksInPhase)) : null;
  let mess;
  if (tw !== null && Math.abs(tw) < 0.1) {
    mess = wks && wks >= 2 ? 'Dein Gewicht ist ' + wks + ' Wochen gleich geblieben'
      : 'Dein Gewicht steht seit der letzten Anpassung';
  } else if (tw < 0) {
    mess = 'Du verlierst gerade ' + _de1(Math.abs(tw)) + ' kg pro Woche';
  } else if (tw !== null) {
    mess = 'Du legst gerade ' + _de1(tw) + ' kg pro Woche zu';
  } else {
    mess = 'Dein gemessener Verbrauch liegt bei ' + _deInt(tdeeN) + ' kcal';
  }
  let tat;
  if (change === 0) tat = 'dein Ziel bleibt bei ' + _deInt(kcal) + ' kcal.';
  else tat = _deInt(Math.abs(change)) + ' kcal ' + (change > 0 ? 'mehr' : 'weniger') + ', also ' + _deInt(kcal) + ' kcal am Tag.';
  let reason = mess + ' – ' + tat;
  if (capped && change !== 0) reason += ' Mehr als ' + _deInt(maxS) + ' kcal ändere ich in einer Woche nicht.';
  if (floored) reason += ' Weiter runter als ' + _deInt(floor) + ' kcal geht dein Ziel nicht.';
  // Letztes Netz: was hier herauskommt, wird als Tagesziel gespeichert. Ist auch nur eine der vier
  // Zahlen keine endliche Zahl, gilt das Ergebnis als unbrauchbar und das alte Ziel bleibt stehen –
  // lieber keine Anpassung als eine kaputte (P3). Erreichbar nur ueber kaputte Eingaben; genau die
  // kommen aber aus einer Datenbank, in der schon einmal etwas schiefgegangen sein kann.
  if (![kcal, protein, carbs, fat, change].every(Number.isFinite)) {
    return { ...base, implausible: true,
      reason: 'Mit den hinterlegten Zahlen komme ich auf kein sinnvolles Ziel – dein Ziel bleibt, wie es ist.' };
  }
  return { kcal, protein, carbs, fat, change, changed: change !== 0, capped, floored, conflict, implausible: false,
    source: 'adaptiv', goal: goalName, factor: Math.round(factor * 1000) / 1000, want, reason };
}

// ------------------------------------------------------------
// 4 · e1RM-VERLAUF JE UEBUNG (B-i)
// ------------------------------------------------------------
// Drei Einschraenkungen, alle mit Grund:
//   * nur ARBEITSSAETZE. `set_logs.set_type` gibt es seit 2.8.0; NULL zaehlt wie 'work', weil die
//     ganze Historie davor keinen Wert traegt (schema.js, D38) – wuerde NULL ausgeschlossen, waere
//     der Verlauf jedes Bestandskontos leer. 'warmup', 'drop' und 'backoff' fliegen raus.
//   * dieselbe Wiederholungsgrenze wie ueberall sonst: E1RM_MAX_REPS. Bis 3.0.0 stand hier eine
//     eigene, strengere 10 mit dem Argument, ein VERLAUF sei die staerkere Behauptung, weil sich
//     der Formelfehler ueber die Punkte in eine Richtung addieren koenne. Das Argument traegt nicht:
//     ein systematischer Fehler verschiebt ALLE Punkte gleich und kuerzt sich in der Differenz –
//     genau die Differenz ist das, was der Verlauf zeigt. Uebrig blieb nur der Schaden: dieselbe
//     Kennzahl mit zwei Zahlen (siehe Kopf bei E1RM_MAX_REPS). Eine Grenze, eine Stelle.
//   * keine uebungsuebergreifenden Vergleiche. Eine Reihe gehoert zu EINER Uebung; kommen mehrere
//     exercise_id vor und es ist keine ausgewaehlt, verweigert die Funktion die Auskunft.
// Die Formel steht im Rueckgabewert – der Nutzer soll lesen koennen, WIE gerechnet wurde (P3).
// `E1RM_SERIES_MAX_REPS` bleibt als Name bestehen (Beistellung an B-I.2/3/5), ist aber kein zweiter
// Wert mehr, sondern derselbe.
export const E1RM_SERIES_MAX_REPS = E1RM_MAX_REPS;

export function e1rmSeries({ sets, exerciseId = null, maxReps = E1RM_SERIES_MAX_REPS } = {}) {
  // Grenze, Formel und Fussnotentext kommen aus e1rmRule() – dieselbe Quelle, aus der auch die
  // Oberflaechen lesen. `Number.isFinite` steckt dort drin: `maxReps: Infinity` ergab hier frueher
  // „hoechstens Infinity Wiederholungen".
  const rule = e1rmRule(maxReps);
  const lim = rule.maxReps;
  // Die Uebungs-ID: leer heisst „alle" (dann greift die Mischungs-Sperre weiter unten), eine Zahl
  // heisst „nur diese". Eine ID, die keine endliche Zahl ist, heisst WEDER – `Number('abc')` ergab
  // NaN, stand als `exerciseId: null` in der Antwort (also „alle") und verglich sich zugleich mit
  // keiner Zeile. Solche Eingaben werden abgewiesen statt stillschweigend umgedeutet.
  const idLeer = exerciseId === null || exerciseId === undefined || exerciseId === '';
  const idZahl = idLeer ? null : Number(exerciseId);
  const idKaputt = !idLeer && !Number.isFinite(idZahl);
  const out = {
    hasData: false, exerciseId: idLeer || idKaputt ? null : idZahl,
    points: [], n: 0, best: null, first: null, last: null,
    deltaKg: null, deltaPct: null, slopeKgPerWeek: null, weeks: null,
    formula: rule.formula, formulaText: rule.formulaText,
    maxReps: lim, mixed: false, rule,
    excluded: { fremdeUebung: 0, keinArbeitssatz: 0, zuVieleWdh: 0, unbrauchbar: 0 },
    note: rule.note + ' Die Zahl gilt für diese Übung – verschiedene Übungen lassen sich damit nicht vergleichen.',
    text: 'Noch keine Arbeitssätze für einen Verlauf.',
  };
  if (idKaputt) return { ...out, note: 'Ein e1RM-Verlauf gilt immer für EINE Übung – die übergebene Übungs-Nummer ist keine.',
    text: 'Ohne eine gültige Übung kann ich keinen Verlauf rechnen.' };
  const rows = Array.isArray(sets) ? sets : [];
  const want = out.exerciseId;
  const seen = new Set();
  const byDate = new Map();
  for (const r of rows) {
    if (!r) { out.excluded.unbrauchbar++; continue; }
    const ex = r.exercise_id === undefined ? r.exerciseId : r.exercise_id;
    const exNum = (ex === null || ex === undefined || ex === '') ? null : Number(ex);
    if (want !== null && exNum !== want) { out.excluded.fremdeUebung++; continue; }
    if (exNum !== null) seen.add(exNum);
    const t = r.set_type === undefined ? r.setType : r.set_type;
    const work = t === null || t === undefined || t === '' || t === 'work';
    if (!work) { out.excluded.keinArbeitssatz++; continue; }
    const day = _isoDay(r.date);
    const w = Number(r.weight), reps = Number(r.reps);
    // `reps > 0` liess 5e-324 durch – eine Wiederholung ist mindestens eine. Und ein Gewicht ausserhalb
    // von 0–2.000 kg ist keine Angabe, sondern eine kaputte Zeile.
    if (!day || !(w > 0) || !(w <= E1RM_MAX_WEIGHT_KG) || !(reps >= 1)) { out.excluded.unbrauchbar++; continue; }
    if (reps > lim) { out.excluded.zuVieleWdh++; continue; }
    const e = estimate1RM(w, reps, lim);
    if (!(e > 0)) { out.excluded.unbrauchbar++; continue; }
    const prev = byDate.get(day);
    if (!prev || e > prev.e1rm) byDate.set(day, { date: day, e1rm: e, weight: w, reps });
  }
  // Uebungsuebergreifend wird nicht gerechnet – lieber keine Auskunft als eine falsche.
  if (want === null && seen.size > 1) {
    return { ...out, mixed: true, points: [], excluded: out.excluded,
      note: 'Ein e1RM-Verlauf gilt immer für EINE Übung. Hier stecken ' + seen.size + ' verschiedene drin – bitte eine auswählen.',
      text: 'Ein e1RM-Verlauf gilt immer für eine einzelne Übung.' };
  }
  const points = [...byDate.values()].sort((a, b) => a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));
  if (!points.length) return out;
  const first = points[0], last = points[points.length - 1];
  const best = points.reduce((a, b) => b.e1rm > a.e1rm ? b : a, points[0]);
  const spanDays = _isoDiff(first.date, last.date);
  // Steigung als kleinste Quadrate ueber (Wochen seit dem ersten Punkt, e1RM). Ein einzelner
  // Punkt – oder mehrere am selben Tag – ergibt keine Steigung: dann bleibt sie null statt 0,
  // denn „keine Aussage" und „keine Veraenderung" sind zwei verschiedene Dinge.
  let slope = null;
  if (points.length >= 2 && spanDays > 0) {
    const xs = points.map(p => _isoDiff(first.date, p.date) / 7), ys = points.map(p => p.e1rm);
    const n = points.length, sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
    const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0);
    const den = n * sxx - sx * sx;
    if (Math.abs(den) > 1e-9) slope = Math.round((n * sxy - sx * sy) / den * 100) / 100;
  }
  const deltaKg = Math.round((last.e1rm - first.e1rm) * 10) / 10;
  const raus = out.excluded.keinArbeitssatz + out.excluded.zuVieleWdh;
  return {
    ...out, hasData: true, points, n: points.length, best, first, last,
    // Der Prozentwert ist eine DIVISION durch den ersten Punkt: ist der winzig (ein Satz mit
    // 5e-324 kg), laeuft sie ueber. Was nicht endlich ist, wird nicht ausgegeben.
    deltaKg, deltaPct: (() => { const x = first.e1rm > 0 ? Math.round(deltaKg / first.e1rm * 1000) / 10 : null;
      return Number.isFinite(x) ? x : null; })(),
    slopeKgPerWeek: slope, weeks: Math.round(spanDays / 7 * 10) / 10,
    note: out.note + (raus ? ' ' + raus + (raus === 1 ? ' Satz zählt' : ' Sätze zählen') + ' nicht mit (Aufwärmen oder mehr als ' + lim + ' Wdh.).' : ''),
    text: points.length < 2
      ? 'Ein Punkt – ab dem zweiten Training steht hier ein Verlauf.'
      : 'Geschätztes 1RM ' + _de1(last.e1rm) + ' kg, ' + (deltaKg >= 0 ? '+' : '−') + _de1(Math.abs(deltaKg))
        + ' kg in ' + _de1(spanDays / 7) + ' Wochen (Epley, nur Arbeitssätze ≤ ' + lim + ' Wdh.).',
  };
}

// ------------------------------------------------------------
// 5 · DELOAD – EIN VORSCHLAG, NIE EINE AUTOMATIK (B-i)
// ------------------------------------------------------------
// Drei unabhaengige Zeichen; erst wenn MINDESTENS ZWEI in dieselbe Richtung zeigen, entsteht ein
// Vorschlag (dieselbe Zwei-von-N-Regel wie bei der Divergenz – ein einzelnes Zeichen ist Rauschen).
// Ein Zeichen, dessen Wert fehlt, zaehlt NICHT als „unauffaellig": es fehlt, und das steht auch da.
//   * e1RM-Steigung ≤ 0 kg/Woche ueber mindestens 3 Wochen (Stagnation; kuerzere Reihen sagen nichts)
//   * RIR-Drift ≤ −1: dieselben Gewichte fuehlen sich naeher am Limit an
//   * Bereitschaft < 60: die untere Kante von „Solide" in READY_BANDS – dieselbe Grenze wie ueberall
// Bell 2023/24: geplante Entlastungswochen liegen ueblich alle 4–6 Wochen. Liegt die letzte weniger
// als drei Wochen zurueck, gibt es keinen Vorschlag – zwei leichte Wochen hintereinander sind kein
// Deload mehr, sondern eine Pause.
export const DELOAD_READINESS_LIMIT = 60;
export const DELOAD_RIR_DRIFT = -1;
export const DELOAD_MIN_TREND_WEEKS = 3;
export const DELOAD_MIN_WEEKS_SINCE = 3;

// „A", „A und B", „A, B und C" – eine Aufzaehlung, die sich vorlesen laesst.
function _undListe(xs) {
  const a = (xs || []).filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  return a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1];
}

export function deloadHint({ e1rmTrend, rirDrift, readiness, weeksSinceDeload = null, weeksOfTrend = null } = {}) {
  // Jedes Zeichen hat einen Messbereich, und ausserhalb davon ist die Zahl keine Messung, sondern ein
  // Fehler in der Leitung: eine Bereitschaft von 1e21 oder eine RIR-Drift von 1e308 gibt es nicht.
  // Solche Werte gelten als FEHLEND – die Funktion sagt dann „fehlt mir noch" statt
  // „Deine Bereitschaft liegt bei Ø 1e+21". (`isFinite` allein reicht dafuer nicht.)
  const num = (v, lo = -Infinity, hi = Infinity) => {
    const x = Number(v);
    if (v === null || v === undefined || v === '' || !Number.isFinite(x)) return null;
    return (x < lo || x > hi) ? null : x;
  };
  // e1rmTrend darf die Zahl ODER das ganze Ergebnis von e1rmSeries() sein – der Server soll nichts
  // auspacken muessen, was diese Datei selbst gebaut hat.
  const KG_W = 1000, WOCHEN = 520;            // je Woche 1.000 kg mehr gibt es nicht, 10 Jahre Verlauf auch nicht
  let slope = null, weeks = num(weeksOfTrend, 0, WOCHEN);
  if (e1rmTrend && typeof e1rmTrend === 'object') { slope = num(e1rmTrend.slopeKgPerWeek, -KG_W, KG_W); if (weeks === null) weeks = num(e1rmTrend.weeks, 0, WOCHEN); }
  else slope = num(e1rmTrend, -KG_W, KG_W);
  const drift = num(rirDrift, -10, 10), ready = num(readiness, 0, 100);   // RIR-Skala 0–10, Bereitschaft 0–100
  const signals = [];
  const add = (key, label, known, fired, text) => signals.push({ key, label, known, fired, text });

  if (slope === null || (weeks !== null && weeks < DELOAD_MIN_TREND_WEEKS)) {
    add('e1rm', 'Kraftverlauf', false, false, weeks !== null && slope !== null
      ? 'Der Verlauf ist erst ' + _de1(weeks) + ' Wochen lang – zu kurz für eine Aussage.'
      : 'Noch kein e1RM-Verlauf.');
  } else if (slope <= 0) {
    add('e1rm', 'Kraftverlauf', true, true, 'Dein geschätztes 1RM steht seit ' + _de1(weeks === null ? DELOAD_MIN_TREND_WEEKS : weeks) + ' Wochen'
      + (slope < -0.05 ? ' und geht leicht zurück' : '') + '.');
  } else {
    add('e1rm', 'Kraftverlauf', true, false, 'Dein geschätztes 1RM steigt noch (+' + _de1(slope) + ' kg je Woche).');
  }

  if (drift === null) add('rir', 'Anstrengung', false, false, 'Noch keine RIR-Angaben.');
  else if (drift <= DELOAD_RIR_DRIFT) add('rir', 'Anstrengung', true, true, 'Dieselben Gewichte fühlen sich näher am Limit an (RIR ' + _de1(Math.abs(drift)) + ' Punkte niedriger).');
  else add('rir', 'Anstrengung', true, false, 'Deine RIR-Angaben sind stabil.');

  if (ready === null) add('readiness', 'Bereitschaft', false, false, 'Keine Bereitschafts-Zahl in dieser Woche.');
  else if (ready < DELOAD_READINESS_LIMIT) add('readiness', 'Bereitschaft', true, true, 'Deine Bereitschaft liegt bei Ø ' + Math.round(ready) + '.');
  else add('readiness', 'Bereitschaft', true, false, 'Deine Bereitschaft liegt bei Ø ' + Math.round(ready) + ' – im Rahmen.');

  const fired = signals.filter(s => s.fired);
  const missing = signals.filter(s => !s.known).map(s => s.key);
  const since = num(weeksSinceDeload, 0, WOCHEN);
  const tooSoon = since !== null && since < DELOAD_MIN_WEEKS_SINCE;
  const suggest = fired.length >= 2 && !tooSoon;
  return {
    suggest, fired: fired.length, signals, missing, weeksSinceDeload: since, tooSoon,
    rule: 'Zwei von drei Zeichen',
    headline: suggest ? 'Leichte Woche wäre jetzt sinnvoll'
      : (fired.length >= 2 ? 'Zeichen da, aber die letzte leichte Woche ist zu kurz her'
        : (fired.length === 1 ? 'Ein Zeichen – das reicht mir nicht' : 'Kein Grund für eine leichte Woche')),
    why: fired.length ? fired.map(s => s.text).join(' ') : signals.filter(s => s.known).map(s => s.text).join(' '),
    text: suggest
      ? (fired.length >= 3 ? 'Alle drei Zeichen sprechen' : 'Zwei von drei Zeichen sprechen') + ' für eine leichte Woche: ' + fired.map(s => s.text).join(' ')
        + ' Vorschlag: eine Woche mit halbem Volumen, gleiche Gewichte. Du entscheidest – ich ändere nichts von selbst.'
      : (tooSoon
        ? 'Die Zeichen wären da, aber deine letzte leichte Woche ist erst ' + _de1(since) + ' Wochen her – ich schlage keine zweite hinterher vor.'
        : (fired.length === 1
          ? 'Ein Zeichen allein reicht mir nicht: ' + fired[0].text + ' Ich schau nächste Woche wieder hin.'
          : 'Nichts spricht gerade für eine leichte Woche.'))
      + (missing.length ? ' (' + _undListe(signals.filter(s => !s.known).map(s => s.label)) + (missing.length === 1 ? ' fehlt mir noch.)' : ' fehlen mir noch.)') : ''),
  };
}

// ------------------------------------------------------------
// 6 · DIVERGENZ: WERTE UND GEFUEHL GETRENNT LESEN (B-h)
// ------------------------------------------------------------
// Zwei Befunde aus der Forschung stehen hinter dieser Funktion:
//   * Apple Vitals meldet erst, wenn MINDESTENS ZWEI Werte ausserhalb des typischen Bereichs liegen,
//     und nennt moegliche Ursachen. Einzelwert-Alarme sind Rauschen und erzeugen Angst.
//   * Selbstbericht und HRV messen NICHT dasselbe (Ungaro et al. 2026: Stress p = 0,63, Nervositaet
//     p = 0,41 gegen naechtliche HRV; Sensors 2025: Muskelkater nicht mit RMSSD assoziiert). Wenn
//     beide auseinanderlaufen, ist genau das die Einsicht – und keine davon ist der „Fehler".
// Deshalb: Werte und Selbstbericht werden NICHT verrechnet, sondern nebeneinander gelesen. Gezaehlt
// wird nur die SCHLECHTE Richtung – ein ungewoehnlich guter Wert ist kein Alarm.
// Ursachen sind Angebote, keine Diagnose (P10): die App stellt keine Krankheitsvermutung.
const DIV_DEFAULTS = {            // Band = wie weit darf der Wert vom eigenen Schnitt weg sein
  hrv:   { band: b => Math.max(3, Math.abs(b) * 0.10), dir: 'low',  label: 'HRV', unit: ' ms' },
  rhr:   { band: () => 5,                              dir: 'high', label: 'Ruhepuls', unit: ' bpm' },
  sleep: { band: () => 1,                              dir: 'low',  label: 'Schlaf', unit: ' h' },
  rr:    { band: () => 1.5,                            dir: 'high', label: 'Atemfrequenz', unit: '/min' },
  temp:  { band: () => 0.4,                            dir: 'high', label: 'Temperatur', unit: ' °C' },
  steps: { band: b => Math.abs(b) * 0.3,               dir: 'low',  label: 'Schritte', unit: '' },
};
const DIV_CAUSES_WERTE = ['ein später Abend oder Alkohol', 'eine ungewohnt harte Einheit', 'ein beginnender Infekt', 'ein Zeitzonen- oder Höhenwechsel'];
const DIV_CAUSES_GEFUEHL = ['Stress außerhalb des Trainings', 'Schlaf, der lang genug, aber unruhig war', 'Monotonie im Plan'];

// Groesser als eine Million ist keine der hier verglichenen Groessen (ms, bpm, Stunden, °C, Schritte).
// Was darueber liegt, ist ein kaputter Wert und wird behandelt wie ein fehlender – sonst stand in der
// Karte „Atemfrequenz 1e+21/min · dein Bereich Infinity–Infinity".
const DIV_MAX_ABS = 1e6;

export function divergence({ metrics, selfReport, minOut = 2 } = {}) {
  const num = v => {
    const x = Number(v);
    if (v === null || v === undefined || v === '' || !Number.isFinite(x)) return null;
    return Math.abs(x) > DIV_MAX_ABS ? null : x;
  };
  const rows = Array.isArray(metrics) ? metrics : [];
  const outliers = [], checked = [];
  for (const m of rows) {
    if (!m) continue;
    const key = String(m.key || '').toLowerCase();
    // Eigene Kennzahlen sind erlaubt (DIV_DEFAULTS ist nur die Liste der bekannten), aber sie
    // brauchen einen NAMEN: ohne Label wird der Schluessel als Beschriftung angezeigt, und aus
    // `key: 1e21` wurde dann die Zeile „1e+21 0,0 · dein Bereich 0,0–0,0". Kein Name, keine Kennzahl.
    if (!/^[a-z][a-z0-9_.-]{0,23}$/.test(key)) continue;
    const def = DIV_DEFAULTS[key] || { band: b => Math.abs(b) * 0.10, dir: 'both', label: m.label || key, unit: '' };
    const v = num(m.value), b = num(m.base);
    if (v === null || b === null) continue;
    const band = num(m.band) !== null ? Math.abs(num(m.band)) : Math.abs(def.band(b));
    const dir = m.dir || def.dir, label = m.label || def.label || key, unit = m.unit !== undefined ? m.unit : def.unit;
    const diff = v - b;
    checked.push(key);
    const badLow = (dir === 'low' || dir === 'both') && diff < -band;
    const badHigh = (dir === 'high' || dir === 'both') && diff > band;
    if (badLow || badHigh) outliers.push({ key, label,
      text: label + ' ' + _de1(v) + unit + ' · dein Bereich ' + _de1(b - band) + '–' + _de1(b + band) + unit });
  }
  const sr = selfReport && typeof selfReport === 'object' ? selfReport : null;
  const sv = sr ? num(sr.value) : null, sb = sr ? num(sr.base) : null;
  const sBand = sr && num(sr.band) !== null ? Math.abs(num(sr.band)) : (sb !== null ? Math.max(1, Math.abs(sb) * 0.15) : null);
  const sDays = sr ? (num(sr.trendDays) === null ? 1 : Math.round(num(sr.trendDays))) : 0;
  const selfOff = sv !== null && sb !== null && (sv - sb) < -sBand;
  const selfLabel = (sr && sr.label) || 'dein Check-in';

  // `minOut` ist die N in „Zwei-von-N" – und die Zwei steht nicht fest, also darf sie auch nicht als
  // Wort festgeschrieben sein. Infinity haette hier frueher jeden Alarm still abgeschaltet.
  // Zwischen 1 und 20 – mehr Ausreisser, als es Kennzahlen gibt, kann niemand verlangen; ein minOut
  // von 1,8e308 stand sonst als „ich melde mich, wenn 1.8e+308 weitere dazukommen" in der Karte.
  const minRoh = Math.round(Number(minOut));
  const need = Number.isFinite(minRoh) && minRoh >= 1 && minRoh <= 20 ? minRoh : 2;
  const many = outliers.length >= need;
  const state = many && selfOff ? 'beides' : (many ? 'werte' : (selfOff ? 'gefuehl' : 'ruhig'));
  // Ein einzelner schlechter Check-in-Tag ist noch keine Divergenz. Ohne Angabe, wie lange es schon
  // laeuft (`trendDays`), gilt EIN Tag – und der loest bewusst nichts aus.
  const alert = many || (selfOff && sDays >= 2);
  // `rule` ist ein Satz fuer die Anzeige (P3), kein Zustand. Mit null oder einer geprueften Metrik
  // stand dort „Zwei-von-0 bei den Werten" bzw. „Zwei-von-1" – eine Regel, die es so nicht gibt.
  // Sie wird nur ausgesprochen, wenn ueberhaupt genug Werte da sind, um sie anzuwenden; sonst null,
  // und die Oberflaeche zeigt gar nichts (nicht etwa eine leere Zeile).
  const ZAHLWORT = ['', 'Ein', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs'];
  const rule = checked.length >= need
    ? (ZAHLWORT[need] || String(need)) + '-von-' + checked.length + ' bei den Werten, der Selbstbericht zählt getrennt'
    : null;
  const base = { state, alert, n: outliers.length, checked, outliers, selfOff, selfDays: sDays,
    minOut: need, rule, causes: [] };
  if (state === 'ruhig') {
    // Genau EIN auffaelliger Wert ist kein Alarm – aber „alles im Bereich" waere dann gelogen (P9).
    // Der Wert wird genannt, die Zwei-von-N-Regel gleich mit, damit klar ist, warum nichts passiert.
    // Nicht nur der Fall EIN Ausreisser: bei minOut = 3 waeren zwei Ausreisser genauso „noch kein
    // Alarm" – und „Nichts Auffälliges" waere dann glatt gelogen.
    if (outliers.length >= 1) {
      const k = outliers.length, liste1 = outliers.map(o => o.text).join(' · ');
      const fehlt = need - k;
      return { ...base,
        headline: k === 1 ? 'Ein Wert außerhalb deines Bereichs' : k + ' Werte außerhalb deines Bereichs',
        why: liste1,
        text: (k === 1 ? 'Ein Wert liegt' : k + ' Werte liegen') + ' außerhalb deines Bereichs (' + liste1 + '). '
          + (k === 1 ? 'Ein einzelner Wert schwankt zu oft, um daraus etwas zu machen' : 'Das sind noch zu wenige, um daraus etwas zu machen')
          + ' – ich melde mich, wenn ' + (fehlt === 1 ? 'ein weiterer dazukommt' : fehlt + ' weitere dazukommen') + '.' };
    }
    return { ...base,
      headline: 'Nichts Auffälliges', why: checked.length ? 'Deine Werte liegen in deinem Bereich.' : 'Noch keine Vergleichswerte.',
      text: checked.length ? 'Deine Werte liegen in deinem Bereich' + (sv !== null ? ', und dein Check-in passt dazu.' : '.') : 'Noch keine Vergleichswerte.' };
  }
  if (state === 'gefuehl') return { ...base, causes: DIV_CAUSES_GEFUEHL,
    headline: 'Werte im Bereich, Gefühl nicht',
    why: 'Deine Werte liegen in deinem Bereich, ' + selfLabel + (sDays >= 2 ? ' aber seit ' + sDays + ' Tagen darunter' : ' heute darunter') + '.',
    text: 'Deine Werte liegen in deinem Bereich, ' + selfLabel + (sDays >= 2 ? ' seit ' + sDays + ' Tagen nicht' : ' heute nicht')
      + '. Das spricht eher für Kopf und Alltag als für den Körper – Stress und Schlafqualität zeigen sich selten in HRV oder Puls.' };
  const liste = outliers.map(o => o.text).join(' · ');
  if (state === 'werte') return { ...base, causes: DIV_CAUSES_WERTE,
    headline: outliers.length + ' Werte außerhalb deines Bereichs',
    why: liste,
    text: outliers.length + ' deiner Werte liegen außerhalb deines Bereichs (' + liste + '), dein Check-in sagt das nicht. '
      + 'Häufige Gründe: ' + _undListe(DIV_CAUSES_WERTE) + '. Nimm es als Hinweis, nicht als Diagnose.' };
  return { ...base, causes: DIV_CAUSES_WERTE.concat(DIV_CAUSES_GEFUEHL),
    headline: 'Werte und Gefühl zeigen in dieselbe Richtung',
    why: liste + ' · ' + selfLabel + ' liegt ebenfalls darunter',
    text: outliers.length + ' deiner Werte liegen außerhalb deines Bereichs (' + liste + '), und ' + selfLabel
      + ' passt dazu. Heute ist ein guter Tag für weniger – oder für einen Tag Pause.' };
}

// ------------------------------------------------------------
// 7 · KALIBRIERZUSTAND STATT ERFUNDENER ZAHL (B-h)
// ------------------------------------------------------------
// Ein Score ohne eigenen Vergleichsbereich ist Fehlinformation. Alle Hersteller sagen das offen:
// Apple Vitals „wear your Apple Watch to sleep for 7 days to establish your typical range", Fitbit
// 7 Naechte, Garmin 7 Naechte fuer den Schnitt und ~3 Wochen fuer die Baseline, WHOOP fuehrt dafuer
// ein eigenes Flag (`user_calibrating`). Der Hinweis ist zugleich Motivation: „noch 4 Nächte" ist
// eine erreichbare Aufgabe, „keine Daten" ist eine Sackgasse.
export const CALIBRATION_NIGHTS = 7;
export const CALIBRATION_SECURE_NIGHTS = 21;
// Mehr Naechte als hundert Jahre sind kein Schlafprotokoll, sondern ein kaputter Zaehler. Der Wert
// wird dann gekappt und das sagt `clamped` – gekappt, nicht verschwiegen.
export const CALIBRATION_MAX_NIGHTS = 36500;

export function calibrationState({ nights, needed = CALIBRATION_NIGHTS, secureAfter = CALIBRATION_SECURE_NIGHTS } = {}) {
  // `Math.trunc(Number(x)) || 0` faengt NaN, aber NICHT Infinity: `calibrationState({nights: Infinity})`
  // schrieb bis 3.0.0 „Infinity Nächte – dein Bereich ist gesichert." und JSON.stringify machte aus
  // dem Feld `nights` ein `null`. Number.isFinite ist der Unterschied zwischen „keine Zahl" und
  // „keine endliche Zahl" – beides ist keine Nacht.
  const ganz = (v, fallback) => { const x = Number(v); return Number.isFinite(x) ? Math.trunc(x) : fallback; };
  const roh = Number(nights === undefined || nights === null || nights === '' ? 0 : nights);
  const unbrauchbar = !Number.isFinite(roh);
  const clamped = unbrauchbar || Math.trunc(roh) > CALIBRATION_MAX_NIGHTS;
  const n = unbrauchbar ? 0 : Math.min(CALIBRATION_MAX_NIGHTS, Math.max(0, Math.trunc(roh)));
  const need = Math.max(1, Math.min(CALIBRATION_MAX_NIGHTS, ganz(needed, CALIBRATION_NIGHTS) || CALIBRATION_NIGHTS));
  const sec = Math.max(need, Math.min(CALIBRATION_MAX_NIGHTS, ganz(secureAfter, CALIBRATION_SECURE_NIGHTS) || CALIBRATION_SECURE_NIGHTS));
  const remaining = Math.max(0, need - n);
  const naechte = k => k === 1 ? '1 Nacht' : _deInt(k) + ' Nächte';        // Nominativ: „7 Nächte erfasst"
  const naechteD = k => k === 1 ? 'einer Nacht' : _deInt(k) + ' Nächten';  // Dativ: „ab 7 Nächten"
  if (n <= 0) return { nights: 0, needed: need, remaining: need, ready: false, level: 'leer', clamped,
    label: 'Noch keine Nacht', text: 'Trag Schlaf ein oder verbinde deine Uhr – nach ' + naechteD(need) + ' steht hier eine Einschätzung.' };
  if (n < need) return { nights: n, needed: need, remaining, ready: false, level: 'kalibriert', clamped,
    label: 'Kalibriert – noch ' + naechte(remaining),
    text: naechte(n) + ' erfasst. Ab ' + naechteD(need) + ' vergleiche ich deine Werte mit deinem eigenen Bereich – vorher wäre jede Zahl geraten.' };
  if (n < sec) return { nights: n, needed: need, remaining: 0, ready: true, level: 'bereit', clamped,
    label: 'Kalibriert', text: naechte(n) + ' – dein Bereich steht. Nach ' + naechteD(sec) + ' ist er stabil genug, dass einzelne Nächte ihn kaum noch verschieben.' };
  return { nights: n, needed: need, remaining: 0, ready: true, level: 'gesichert', clamped,
    label: 'Kalibriert', text: naechte(n) + ' – dein Bereich ist gesichert.' };
}
