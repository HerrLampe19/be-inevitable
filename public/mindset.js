/* =====================================================================
   BE INEVITABLE – Mindset-Modul (Frontend)
   Priming · Power-Atmung · Abend-Reflexion · Rad des Lebens · Vital-Challenge · Wissen
   Wird VOR app.js geladen: hier werden ausschließlich Funktionen und Konstanten
   definiert – kein DOM-Zugriff beim Laden. Alle Aufrufe passieren später aus app.js
   (go('mindset') → renderMindset) bzw. aus Inline-onclick-Handlern.
   Verwendet globale Helfer aus app.js: API, ME, VIEW_USER, openSheet, closeModal,
   toast, celebrate, esc, esc2, today, fmt, metricChart, lineChart2, refreshAchievements, infoBox.
   ===================================================================== */

// ===== §2 Rad des Lebens (identisch mit Backend) =====
const WHEEL_AREAS = [
  { key:'body',          n:1, label:'Physischer Körper',        short:'Körper',     icon:'💪', color:'#e10600' },
  { key:'emotions',      n:2, label:'Gefühle & Bedeutung',      short:'Gefühle',    icon:'🧠', color:'#bf5af2' },
  { key:'relationships', n:3, label:'Beziehungen',              short:'Beziehungen',icon:'❤️', color:'#ff375f' },
  { key:'time',          n:4, label:'Zeit',                     short:'Zeit',       icon:'⏳', color:'#ff9f0a' },
  { key:'career',        n:5, label:'Arbeit / Karriere / Mission', short:'Karriere', icon:'🎯', color:'#ffd60a' },
  { key:'finances',      n:6, label:'Finanzen',                 short:'Finanzen',   icon:'💰', color:'#30d158' },
  { key:'contribution',  n:7, label:'Zelebrieren & Beitragen',  short:'Beitrag',    icon:'🌍', color:'#0a84ff' },
];
// Kurze Erklärung je Bereich (eigene Worte) – für die Slider im Rad-Formular
const WHEEL_DESC = {
  body:'Energie, Fitness, Schlaf – wie wohl du dich in deinem Körper fühlst.',
  emotions:'Wie du dich meistens fühlst und welche Bedeutung du den Dingen gibst.',
  relationships:'Partnerschaft, Familie, Freunde – Tiefe und Qualität deiner Verbindungen.',
  time:'Hast du deine Zeit im Griff – oder hat sie dich?',
  career:'Erfüllung, Fortschritt und Sinn in dem, was du täglich tust.',
  finances:'Überblick, Sicherheit und Freiheit beim Thema Geld.',
  contribution:'Erfolge feiern, dankbar sein und etwas zurückgeben.',
};

// ===== §3 Vital-Challenge (identisch mit Backend) =====
const CHALLENGE_RULES = [
  // Geschenke (give yourself)
  { id:'breath',    group:'gift',  icon:'🌬️', label:'3× Power-Atmung (1-4-2)',        hint:'Dreimal am Tag 10 Atemzüge: 1 einatmen · 4 halten · 2 ausatmen (z.B. 5 s / 20 s / 10 s).', auto:'breath3' },
  { id:'move',      group:'gift',  icon:'🤸', label:'20–30 Min. Bewegung / Rebounding', hint:'Lymphe aktivieren: Trampolin, Seilspringen, zügiges Gehen.', auto:null },
  // D42: „Hälfte des Körpergewichts" ist die Unzen-Faustregel und ergibt in Kilogramm gelesen das
  // Fünfzehnfache (80 kg → 40 L statt 2,6 L). Muss mit src/mindset.js übereinstimmen.
  { id:'water',     group:'gift',  icon:'💧', label:'Wasser: rund 0,03 L je kg Körpergewicht', hint:'Etwa 0,033 L pro Kilogramm Körpergewicht – bei 80 kg sind das rund 2,6 L am Tag. Zitrone rein.', auto:'water' },
  { id:'living',    group:'gift',  icon:'🥗', label:'70 % lebendige, wasserreiche Nahrung', hint:'Gemüse, Salat, Obst, Sprossen – der Großteil des Tellers.', auto:null },
  { id:'fats',      group:'gift',  icon:'🥑', label:'Gute Fette & Omega-3',            hint:'Avocado, Oliven, Nüsse, Samen, natives Olivenöl, Fischöl.', auto:null },
  { id:'alkaline',  group:'gift',  icon:'🌿', label:'Basische, mineralstoffreiche Kost', hint:'Grünes Blattgemüse, Gemüse, Obst, Nüsse statt säurebildender Lebensmittel.', auto:null },
  { id:'strength',  group:'gift',  icon:'🏋️', label:'Krafttraining (3×/Woche)',        hint:'Ganzkörper-Krafteinheiten – wird aus deinem Trainingslog erkannt.', auto:'strength' },
  { id:'cardio',    group:'gift',  icon:'🏃', label:'30 Min. Ausdauer (3×/Woche)',      hint:'Wird aus deinem Cardio-Log erkannt.', auto:'cardio' },
  { id:'stretch',   group:'gift',  icon:'🧘', label:'Dehnen & Ausrichtung',             hint:'Nicht den ganzen Tag sitzen: öfter aufstehen, Treppe statt Aufzug, täglich dehnen – beide Seiten und die Gegenspieler-Muskeln.', auto:null },
  { id:'mind',      group:'gift',  icon:'🛡️', label:'Wache am Tor deines Geistes',      hint:'Stärkende Emotionen bewusst wählen (Dankbarkeit, Mut, Entschlossenheit), Stress-Muster unterbrechen.', auto:null },
  { id:'heart',     group:'gift',  icon:'💓', label:'3× Herzfokus',                     hint:'Dreimal am Tag kurz innehalten und Aufmerksamkeit auf das Herz richten (zusammen mit der Power-Atmung).', auto:'breath3' },
  { id:'gratitude', group:'gift',  icon:'🙏', label:'Tag mit Dankbarkeit starten & beenden', hint:'Morgen-Priming + Abend-Reflexion in der App.', auto:'gratitude' },
  // Gifte (avoid)
  { id:'no_procfat', group:'poison', icon:'🚫', label:'Keine verarbeiteten Fette',      hint:'Frittiertes, gehärtete Fette, Fertigprodukte streichen.', auto:null },
  { id:'no_meat',    group:'poison', icon:'🥩', label:'Kein Fleisch (10 Tage)',          hint:'Optional – passt nicht zu jedem Ernährungsziel. Danach: 3–5×/Woche, saubere Quelle, mit Gemüse.', auto:null, default:false },
  { id:'no_dairy',   group:'poison', icon:'🥛', label:'Milchprodukte reduzieren',        hint:'Alternativen wie Hafer-, Reis- oder Mandelmilch testen.', auto:null, default:false },
  { id:'no_acid',    group:'poison', icon:'☕', label:'Keine säurebildenden Abhängigkeiten', hint:'Übermäßiges Koffein, Zucker, Weißmehl/Verarbeitetes, Essig, Alkohol, Nikotin, Drogen.', auto:null },
];

// ===== Offizielle Links (exakt wie im Spec) =====
const MIND_LINKS = [
  { key:'priming', label:'Priming (offizielle Seite)', url:'https://www.tonyrobbins.com/priming' },
  { key:'guide',   label:'Priming-Guide (kostenlos, offiziell)', url:'https://go.tonyrobbins.com/priming-guide' },
  { key:'video1',  label:'Video „Priming: the daily habit Tony Robbins uses to boost his brain" (YouTube)', url:'https://www.youtube.com/watch?v=faTGTgid8Uc' },
  { key:'video2',  label:'Video „Tony Robbins 10-Minute Morning Routine to Prime for Success" (YouTube)', url:'https://www.youtube.com/watch?v=3y72AjjUd54' },
  { key:'needs',   label:'Die 6 menschlichen Grundbedürfnisse (offizieller Blog)', url:'https://www.tonyrobbins.com/blog/why-you-are-the-way-you-are' },
];

// ===== Die 6 Grundbedürfnisse (eigene Kurzbeschreibungen) =====
const MIND_NEEDS = [
  { key:'certainty',    icon:'🛡️', label:'Gewissheit / Sicherheit', group:'p', desc:'Kontrolle, Stabilität, Schmerz vermeiden, Komfort.' },
  { key:'variety',      icon:'🎲', label:'Abwechslung',            group:'p', desc:'Überraschung, Reiz, Neues, Herausforderung.' },
  { key:'significance', icon:'🏆', label:'Bedeutsamkeit',          group:'p', desc:'Wichtig sein, gebraucht werden, herausragen.' },
  { key:'connection',   icon:'❤️', label:'Verbindung / Liebe',     group:'p', desc:'Nähe, Zugehörigkeit, geliebt werden.' },
  { key:'growth',       icon:'🌱', label:'Wachstum',               group:'s', desc:'Lernen, besser werden, sich entwickeln.' },
  { key:'contribution', icon:'🤝', label:'Beitrag',                group:'s', desc:'Über sich hinaus geben, für andere da sein.' },
];

// ===== Frage des Tages – eigener Fragen-Pool (deterministisch nach Tag im Jahr) =====
const MIND_QUESTIONS = [
  'Was würdest du heute tun, wenn Scheitern unmöglich wäre?',
  'Was hältst du sonst für selbstverständlich, wofür du gerade dankbar bist?',
  'Welche Entscheidung schiebst du seit Wochen vor dir her – und was kostet dich das?',
  'Wer hat dir in den letzten Tagen etwas Gutes getan, ohne dass du es gewürdigt hast?',
  'Was würde die stärkste Version von dir heute als Erstes tun?',
  'Welche Emotion soll heute dein Zuhause sein?',
  'Wo hältst du dich klein, obwohl du längst bereit bist?',
  'Was gibt dir Energie – und wie viel davon hattest du diese Woche?',
  'Wem könntest du heute mit fünf Minuten echter Aufmerksamkeit den Tag verändern?',
  'Welche Geschichte erzählst du dir über deinen Körper – und stimmt sie noch?',
  'Was wolltest du als Kind unbedingt werden – und was davon lebt heute noch in dir?',
  'Welche Gewohnheit würde dein Leben in einem Jahr am meisten verändern?',
  'Was ist heute das Eine, das alles andere leichter macht?',
  'Wann hast du dich zuletzt richtig lebendig gefühlt – was war da anders?',
  'Welche Angst hat dich zuletzt gesteuert, und was würde Mut jetzt tun?',
  'Wofür würdest du morgens aufstehen, auch wenn dich niemand dafür bezahlt?',
  'Welche Beziehung verdient in dieser Woche mehr von dir?',
  'Was hast du in den letzten Tagen gelernt, das du vorher noch nicht wusstest?',
  'Wo verwechselst du „beschäftigt" mit „wirksam"?',
  'Welche Regel hast du dir selbst gesetzt, die dir nicht mehr dient?',
  'Wenn dein Körper sprechen könnte – was würde er dir heute sagen?',
  'Was würdest du tun, wenn du dir sicher wärst, dass du genug bist?',
  'Wo erwartest du gerade etwas von jemandem – und was würde sich ändern, wenn du stattdessen dankbar wärst?',
  'Welches Bedürfnis steuert dich gerade am stärksten: Sicherheit, Abwechslung, Bedeutung oder Verbindung?',
  'Was ist der kleinste Schritt, den du innerhalb der nächsten Stunde gehen kannst?',
  'Wer profitiert davon, dass du heute dein Bestes gibst?',
  'Was würde dir dein 80-jähriges Ich für heute raten?',
  'Was hast du diese Woche gegeben, ohne etwas zurückzuerwarten?',
  'Welchen Standard willst du ab heute nicht mehr unterschreiten?',
  'Was macht dich gerade stolz, das du dir selten eingestehst?',
  'Wo wartest du auf den richtigen Moment, obwohl der Moment jetzt ist?',
  'Welches Gespräch würdest du führen, wenn du keine Angst vor der Reaktion hättest?',
  'Was tust du für deine Energie, bevor du sie an andere verteilst?',
  'Welche Frage stellst du dir zu oft – und welche bessere könntest du stattdessen stellen?',
  'Wie sieht ein Tag aus, an dem du abends sagst: Das war genau richtig?',
  'Was würdest du sofort loslassen, wenn du dürftest?',
  'Welche Stärke hat dich schon durch schwere Zeiten getragen?',
  'Wo bist du gerade zu hart mit dir – und wo zu bequem?',
  'Was bedeutet Erfolg für dich heute, unabhängig davon, was andere denken?',
  'Welchem Menschen hast du lange nicht gesagt, was er dir bedeutet?',
  'Was bringt dich in Bewegung, wenn die Motivation gerade fehlt?',
  'Woran würdest du merken, dass du dein außergewöhnliches Leben bereits lebst?',
  'Was hast du heute schon geschafft, das gestern noch ein Wunsch war?',
  'Wenn du dein Training als Geschenk siehst – an wen ist es gerichtet?',
  'Welcher Gedanke hat dich heute Morgen als Erstes begrüßt – und willst du ihn behalten?',
  'Was würdest du üben, wenn du wüsstest, dass Meisterschaft nur eine Frage der Wiederholung ist?',
  'Welche drei Ergebnisse würden diese Woche zu einem Sieg machen?',
  'Wo bist du gerade Zuschauer deines Lebens statt Spieler?',
];

// ===== Emotionaler Wochencheck – Chip-Listen =====
const MIND_EMO_STRONG = ['Dankbarkeit','Freude','Liebe','Mut','Zuversicht','Neugier','Stolz','Ruhe','Entschlossenheit','Begeisterung','Mitgefühl','Humor'];
const MIND_EMO_WEAK   = ['Stress','Angst','Ärger','Frust','Überforderung','Traurigkeit','Sorge','Scham','Neid','Langeweile','Unsicherheit','Erschöpfung'];

// ===== Zustand (nur Variablen, kein DOM) =====
let MIND_TODAY = null;      // Cache von GET /api/mindset/today/:id
let MIND_TOK = 0;           // Render-Token gegen verspätete Antworten
let MIND_ENTRIES = null;    // Cache von GET /api/mindset/entries/:id
let MIND_WHEEL = null;      // Cache von GET /api/mindset/wheel/:id
let MIND_CHAL = null;       // Cache von GET /api/mindset/challenge/:id
const MIND_PICK = {};       // Auswahl in Zahlen-Chips (Energie/Stimmung)
let MP = null;              // Player-Zustand (Priming / Atmung / State-Change)
let PRIM_RES = null;        // Ergebnis des letzten Priming-Durchlaufs
let EVE = null;             // Abend-Reflexion
let EVE_OBS = null;         // Beobachter, der EVE beim Schliessen des Sheets aufräumt
let WEEKLY = null;          // Wochencheck
let WHEEL_FORM = null;      // Rad-Formular
let CHAL_SEL = null;        // Regel-Auswahl beim Challenge-Start
let CHAL_DAYS = 10;
let CHAL_BUSY = false;
// Zwischenspeicher je Unter-Tab (~60 s): ein Tab-Wechsel oder eine kleine Aktion holt die
// Daten nicht erneut, sondern zeigt sofort den letzten Stand und frischt nur bei Bedarf auf.
const MIND_TTL = 60000;
let MIND_TODAY_TS = 0;      // Zeitpunkt von MIND_TODAY
let MIND_SESS = null;       // Cache von GET /api/mindset/sessions
let MIND_SESS_TS = 0;
let MIND_WHEEL_TS = 0;      // Zeitpunkt von MIND_WHEEL
let MIND_CHAL_TS = 0;       // Zeitpunkt von MIND_CHAL
let MIND_TAB = 'heute';     // aktueller Unter-Tab (über renderMindset.tab gesetzt/gelesen)
let MIND_TAB_AT = 0;        // wann zuletzt gesetzt (Deep-Link erkennen)

// ===== Kleine Helfer =====
function mindOwn(){ return !!(typeof ME!=='undefined' && ME && VIEW_USER===ME.id && ME.role==='athlete'); }
function mAttr(s){ return esc2(s==null?'':String(s)).replace(/"/g,'&quot;'); }
function mAddDays(iso,n){ const d=new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function mDaysBetween(a,b){ return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5); }
function mDateDE(iso,opts){ try{ const d=new Date(iso+'T00:00'); if(isNaN(d)) return esc2(iso||''); return esc2(d.toLocaleDateString('de-DE',opts||{day:'numeric',month:'short'})); }catch(e){ return esc2(iso||''); } }
// Coach/Admin im Athleten-Kontext: darf lesen, sieht aber keine persönlichen Texte
function mindCoachView(){ return !!(typeof ME!=='undefined' && ME && VIEW_USER && VIEW_USER!==ME.id); }
// B7: Die Bedienelemente werden im Coach-Blick zwar nicht gezeichnet (mindOwn()), aber der Tag des
// Athleten stand bis 2.6.0 ohne ein Wort da, warum hier nichts zu tippen ist. Check-in (home.js) und
// Ernährung (diet.js) sagen es seit jeher – Mindset sagt es ab jetzt mit demselben Satz.
const MIND_RO_TX='Nur Ansicht – das trägt dein Athlet selbst ein.';
function mindRoNote(cls){ return mindCoachView()?`<div class="note status${cls?' '+cls:''}">${MIND_RO_TX}</div>`:''; }
// Letzte Sperre vor jedem Schreibzugriff: /api/mindset/* kennt kein user_id und schreibt immer auf den
// angemeldeten Nutzer. Ein Aufruf aus einem alten Zustand, einem Deep-Link oder der Konsole darf dem
// Coach also keine XP auf sein eigenes Konto buchen. Die Sheet-/Player-Einstiege (openPriming,
// openBreath, openStateChange, openEvening, openWeeklyCheck, openWheelNew, openKnow) prüfen schon
// vorher; das hier fängt alles ab, was daran vorbeikäme.
function mindRoGuard(){
  if(mindOwn()) return false;
  if(typeof toast==='function') toast(mindCoachView()?MIND_RO_TX:'Nur im eigenen Konto möglich');
  return true;
}
// „vor n Tagen" – mit den Sonderfällen heute/gestern
function mAgo(n){ n=Number(n); if(!isFinite(n)||n<=0) return 'heute'; if(n===1) return 'gestern'; return `vor ${n} Tagen`; }
function mMin(sec){ const m=Math.round((sec||0)/60); return m<1?'< 1 Min':m+' Min'; }
// Hat dieses Ritual wirklich stattgefunden? Der Server entscheidet das (Feld `full`, siehe
// src/mindset.js „VOLLWERTIG ODER ÜBERSPRUNGEN"); eine durchgeklickte Sitzung ist gespeichert,
// zählt aber nicht. Ältere Antworten ohne das Feld gelten als vollwertig (kein Rückschritt).
function mdIsFull(s){ return !!s && s.full!==false; }
// Sekunden als Minutenangabe für Regeltexte: immer auf die nächste halbe Minute AUFgerundet, damit
// die genannte Grenze nie milder klingt als die echte (lieber „5,5 Minuten" nennen als 5,25).
function mdMinCeil(sec){
  const h=Math.ceil((Number(sec)||0)/30)/2;
  return (Number.isInteger(h)?String(h):String(h).replace('.',','))+(h===1?' Minute':' Minuten');
}
// Was muss ein Durchlauf erfüllen, damit er zählt? Die Zahlen stehen NICHT hier, sie kommen aus der
// Server-Antwort (Feld `rule`, src/mindset.js → fullRuleOf). Bis 2.5.0 versprach der Satz „ab der
// halben Zeit", gezählt wurde ab 60 % – und er stand genau unter „zählt heute nicht" (Prüfbefund).
// Fehlt `rule` (alte Antwort aus dem Zwischenspeicher), bleibt der Text bewusst ohne Minutenzahl.
function mdRuleTxt(rule){
  const sec=+(rule&&rule.full_sec)||0;
  if(!sec) return 'Gezählt wird ein Durchlauf ab 60 % der gewählten Zeit – oder ab vier von sechs Schritten, wenn er lang genug dafür war.';
  const steps=+(rule&&rule.min_steps)||0, total=+(rule&&rule.steps_total)||6, stepSec=+(rule&&rule.step_path_sec)||0;
  if(steps&&stepSec) return `Gezählt wird ein Durchlauf ab ${mdMinCeil(sec)} – oder ab ${steps} von ${total} Schritten, wenn er mindestens ${mdMinCeil(stepSec)} gedauert hat.`;
  return `Gezählt wird ein Durchlauf ab ${mdMinCeil(sec)}.`;
}
// Anteil der Schrittzeit, ab dem „Überspringen"/„Fertig" freigegeben wird (B16 / 12-von-10 Nr. 2)
const MD_STEP_GATE = 0.5;
// Wie viele Millisekunden fehlen noch, bis der aktuelle Schritt zur Hälfte gelaufen ist? 0 = frei.
function mdStepGateMs(){
  if(!MP||MP.finished||MP.aborting) return 0;
  const st=MP.steps[MP.idx]; if(!st||!st.total) return 0;
  return Math.max(0,Math.round(st.total*MD_STEP_GATE-MP.stepElapsed));
}
// Schrittzahl im Abschluss nur zeigen, wenn sie etwas aussagt: wer alles überspringt, hat 0
// natürlich beendete Schritte – „0/6 Schritte" neben „Gespeichert" wäre nur verwirrend.
function mStepsTxt(res){ const d=+(res&&res.steps_done)||0, t=+(res&&res.steps_total)||0; return (d>0&&t>0)?` · ${d}/${t} Schritte`:''; }
function mindVibrate(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms||200); }catch(e){} }
function mReducedMotion(){ try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
function mParse(v,fallback){ if(v==null) return fallback; if(typeof v==='object') return v; try{ return JSON.parse(v); }catch(e){ return fallback; } }
function mindLink(l){ return `<a class="mind-link" href="${l.url}" target="_blank" rel="noopener">↗ ${esc2(l.label)}</a>`; }
function mindLinks(keys){ return `<div class="mind-links">${MIND_LINKS.filter(l=>!keys||keys.includes(l.key)).map(mindLink).join('')}</div>`; }
// Leer-/Fehlerzustand über den gemeinsamen Helfer (name = Icon-Name aus icon(), kein Emoji)
function mindEmpty(name,title,sub,action,label){
  if(typeof emptyState==='function') return emptyState({icon:name,title,text:sub||'',btn:action?{label:label||'Erneut laden',onclick:action}:null});
  return `<div class="empty"><div class="t">${esc2(title)}</div><div>${esc2(sub||'')}</div>${action?`<button class="btn sm" onclick="${action}">${esc2(label||'Erneut laden')}</button>`:''}</div>`;
}
function mindFresh(ts){ return !!ts && (Date.now()-ts) < MIND_TTL; }
function mindCacheClear(){ MIND_TODAY=null; MIND_TODAY_TS=0; MIND_SESS=null; MIND_SESS_TS=0; MIND_WHEEL_TS=0; MIND_CHAL_TS=0; }
function mindSkel(n){ return typeof skeleton==='function'?skeleton(n||3):'<div class="spinner"></div>'; }
// Lade-Anzeige: vorhandenen Inhalt stehen lassen und erst nach 300 ms abblenden (kein Blitzen);
// nur beim allerersten Aufbau erscheinen Skeleton-Blöcke.
function mindLoadStart(){
  const box=document.getElementById('mindBody'); if(!box) return null;
  if(!box.firstElementChild){ box.innerHTML=mindSkel(3); return {t:null}; }
  const h={t:null};
  h.t=setTimeout(()=>{ const b=document.getElementById('mindBody'); if(b) b.classList.add('mind-loading'); },300);
  return h;
}
function mindLoadEnd(h){ if(h) clearTimeout(h.t); const b=document.getElementById('mindBody'); if(b) b.classList.remove('mind-loading'); }
// Veralteter Aufruf: nur den Timer stoppen, die Anzeige gehoert schon dem neueren Aufruf
function mindLoadCancel(h){ if(h) clearTimeout(h.t); }
// Inhalt eines offenen Sheets ersetzen, ohne eine neue Ebene zu öffnen (Kopfzeile bleibt stehen)
function mindSheetBody(html,title){
  const b=document.getElementById('sheetBody');
  if(b){ b.innerHTML=html; const sh=document.getElementById('sheet'); if(sh) try{ sh.scrollTop=0; }catch(e){} return true; }
  if(title) openSheet(title,html);
  return false;
}
// Die aktuelle Mindset-Ansicht in den Ansichts-Cache legen (schneller Rücksprung aus anderen Tabs)
function mindCacheView(){ try{ if(typeof cacheView==='function'&&typeof CUR_TAB!=='undefined'&&CUR_TAB==='mindset') cacheView('mindset'); }catch(e){} }
function mindXp(r,fallback){ const g=r?.data?.xp?.gained; return (g!=null&&!isNaN(g))?g:fallback; }
// Zahlen-Chips 1–10 (Energie/Stimmung)
function numChips(id,cur){
  MIND_PICK[id]=cur??null;
  return `<div class="numchips" role="group" aria-label="Skala 1 bis 10" data-noswipe>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button type="button" class="nchip${cur===n?' on':''}" aria-pressed="${cur===n}" onclick="numChipPick('${id}',${n},this)">${n}</button>`).join('')}</div>`;
}
let MIND_PICK_ON=null;   // optionaler Haken: Sheets ziehen ihre Schaltfläche nach einer Auswahl nach
function numChipPick(id,n,btn){
  MIND_PICK[id]=(MIND_PICK[id]===n)?null:n;
  const wrap=btn.parentElement; if(!wrap) return;
  wrap.querySelectorAll('.nchip').forEach(b=>{ const on=(+b.textContent===MIND_PICK[id]); b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
  if(typeof MIND_PICK_ON==='function'){ try{ MIND_PICK_ON(id); }catch(e){} }
}
// Nach jeder Aktion: aktuelle Ansicht auffrischen (Mindset-Tab oder Home)
function mindRefresh(){
  mindCacheClear();
  if(typeof invalidateView==='function'){ try{ invalidateView('mindset'); invalidateView('home'); }catch(e){} }
  if(document.getElementById('mindBody')){ mindsetTab(renderMindset.tab||'heute'); return; }
  if(typeof refreshHomeIfActive==='function') refreshHomeIfActive();
}
// Nur die geänderten Felder schicken – der Server mischt mit dem Bestand und liefert die
// vollständigen Prefs zurück (so kann ein leerer Cache nichts versehentlich zurücksetzen).
async function mindSavePrefs(patch){
  if(mindRoGuard()) return false;
  const r=await API.put('/mindset/prefs',patch||{});
  if(r.status===200){
    const merged=(r.data&&typeof r.data.prefs==='object'&&r.data.prefs)?r.data.prefs:(patch||{});
    if(MIND_TODAY) MIND_TODAY.prefs={...(MIND_TODAY.prefs||{}),...merged};
    return true;
  }
  toast(r.data?.error||'Konnte nicht speichern'); return false;
}

// ===== Daten laden =====
async function loadMindsetToday(force){
  if(typeof ME==='undefined'||!ME||!VIEW_USER) return null;
  // Home legt MIND_TODAY aus dem Sammel-Endpunkt ab (ohne Zeitstempel) – das gilt als frisch
  if(MIND_TODAY&&!MIND_TODAY_TS) MIND_TODAY_TS=Date.now();
  if(!force&&MIND_TODAY&&mindFresh(MIND_TODAY_TS)) return MIND_TODAY;
  try{
    const r=await API.get('/mindset/today/'+VIEW_USER);
    if(r.status===200&&r.data){ MIND_TODAY=r.data; MIND_TODAY_TS=Date.now(); return MIND_TODAY; }
  }catch(e){}
  return MIND_TODAY||null;
}

// =====================================================================
// SEITE: renderMindset(v) + Tabs
// =====================================================================
// Der Tab-Titel steht in der Kopfzeile – die Seite selbst startet direkt mit dem Segment.
// go('mindset') landet immer auf „Heute“; nur ein Deep-Link (#mindset/wheel) setzt kurz vorher
// renderMindset.tab und wird deshalb übernommen.
function renderMindset(v,opts){
  opts=opts||{};
  const t=mindPickTab();
  if(opts.cached&&document.getElementById('mindBody')){ mindSegSet(t); mindsetTab(t); return; }
  v.innerHTML=`<div class="page on${opts.cached?'':' first'}">
    <div class="seg" id="mindSeg" role="tablist" aria-label="Mindset-Bereiche" onkeydown="semMindTabKey(event)">
      <button type="button" id="ms_heute" role="tab" aria-controls="mindBody" tabindex="-1" onclick="mindsetTab('heute')">Heute</button>
      <button type="button" id="ms_wheel" role="tab" aria-controls="mindBody" tabindex="-1" onclick="mindsetTab('wheel')">Rad</button>
      <button type="button" id="ms_challenge" role="tab" aria-controls="mindBody" tabindex="-1" onclick="mindsetTab('challenge')">Challenge</button>
      <button type="button" id="ms_wissen" role="tab" aria-controls="mindBody" tabindex="-1" onclick="mindsetTab('wissen')">Wissen</button>
    </div>
    <div id="mindBody" role="tabpanel" tabindex="0" aria-labelledby="ms_heute"></div></div>`;
  mindsetTab(t);
}
// renderMindset.tab merkt sich zusätzlich den Zeitpunkt: nur eine Zuweisung unmittelbar vor dem
// Rendern (Deep-Link) überschreibt den Start auf „Heute“.
try{ Object.defineProperty(renderMindset,'tab',{get(){return MIND_TAB;},set(v){MIND_TAB=v;MIND_TAB_AT=Date.now();},configurable:true}); }catch(e){}
function mindPickTab(){ const t=MIND_TAB||'heute'; return (Date.now()-MIND_TAB_AT<1500)?t:'heute'; }
// Wer role="tablist" vergibt, verspricht das Tastaturmuster (WAI-ARIA APG): ein einziger Tab-Stopp
// in der Leiste (roving tabindex), Pfeiltasten wechseln den Reiter, Pos1/Ende springen an den Rand,
// Tab führt aus der Leiste in den Panel-Inhalt (#mindBody trägt deshalb tabindex="0").
// Bis 2.6.0 waren alle vier Reiter eigene Tab-Stopps und die Pfeiltasten wirkungslos (p2b-t10).
const SEM_MIND_TABS=[['heute','ms_heute'],['wheel','ms_wheel'],['challenge','ms_challenge'],['wissen','ms_wissen']];
function mindSegSet(t,focus){
  SEM_MIND_TABS.forEach(([k,id])=>{
    const el=document.getElementById(id); if(!el) return;
    const on=t===k;
    el.classList.toggle('on',on); el.setAttribute('aria-selected',on?'true':'false');
    el.setAttribute('tabindex',on?'0':'-1');
    if(on&&focus) try{ el.focus(); }catch(e){}
  });
  const box=document.getElementById('mindBody');
  const sel=SEM_MIND_TABS.find(([k])=>k===t);
  if(box&&sel) box.setAttribute('aria-labelledby',sel[1]);
}
function semMindTabKey(e){
  if(e.altKey||e.ctrlKey||e.metaKey) return;
  const step={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.key];
  const id=(document.activeElement&&document.activeElement.id)||'';
  let i=SEM_MIND_TABS.findIndex(([,x])=>x===id);
  if(i<0) i=Math.max(0,SEM_MIND_TABS.findIndex(([k])=>k===(MIND_TAB||'heute')));
  let n=null;
  if(step) n=(i+step+SEM_MIND_TABS.length)%SEM_MIND_TABS.length;
  else if(e.key==='Home') n=0;
  else if(e.key==='End') n=SEM_MIND_TABS.length-1;
  else return;
  e.preventDefault();
  mindsetTab(SEM_MIND_TABS[n][0]);
  mindSegSet(SEM_MIND_TABS[n][0],true);
}
function mindsetTab(t){
  const alias={rad:'wheel',wheel:'wheel',chal:'challenge',challenge:'challenge',wissen:'wissen',knowledge:'wissen',heute:'heute',today:'heute'};
  t=alias[String(t||'').toLowerCase()]||'heute';
  renderMindset.tab=t;
  mindSegSet(t);
  // Der Body merkt sich, welcher Unter-Tab in ihm steht: gehört der Inhalt zu einem anderen Tab
  // (Rücksprung aus dem Ansichts-Cache), zeigen wir Skelette statt fremder Inhalte.
  const box=document.getElementById('mindBody');
  if(box&&box.dataset.tab!==t){ box.dataset.tab=t; box.innerHTML=mindSkel(3); box.classList.remove('mind-loading'); }
  if(t==='wheel') drawMindWheel(); else if(t==='challenge') drawMindChallenge(); else if(t==='wissen') drawMindWissen(); else drawMindHeute();
}

// =====================================================================
// TAB HEUTE
// =====================================================================
function questionOfDay(){
  const d=new Date(today()+'T00:00:00Z');
  const doy=Math.floor((d-Date.UTC(d.getUTCFullYear(),0,0))/864e5);
  const id=doy%MIND_QUESTIONS.length;
  return { id, text:MIND_QUESTIONS[id] };
}
async function drawMindHeute(){
  const box=document.getElementById('mindBody'); if(!box) return;
  const tok=++MIND_TOK; const ld=mindLoadStart();
  const needSess=!(MIND_SESS&&mindFresh(MIND_SESS_TS));
  const [t,sr]=await Promise.all([loadMindsetToday(), needSess?API.get('/mindset/sessions/'+VIEW_USER+'?days=90'):Promise.resolve(null)]);
  if(tok!==MIND_TOK){ mindLoadCancel(ld); return; } const b=document.getElementById('mindBody'); if(!b) return; mindLoadEnd(ld);
  if(sr&&sr.status===200&&sr.data){ MIND_SESS=sr.data; MIND_SESS_TS=Date.now(); }
  if(!t){ b.innerHTML=mindEmpty('brain','Mindset gerade nicht erreichbar','Prüfe deine Verbindung und versuche es gleich noch einmal.',"mindsetTab('heute')",'Erneut laden'); return; }
  const sess=MIND_SESS||{sessions:[],byDay:{}};
  const sessions=sess.sessions||[], byDay=sess.byDay||{};
  const own=mindOwn();
  const tdy=today();
  const hour=new Date().getHours();
  // Gespeichert ist nicht gleich gemacht: nur ein vollwertiges Ritual gilt als erledigt (B16).
  const primRow=t.priming, eveRow=t.evening;
  const prim=mdIsFull(primRow)?primRow:null, eve=mdIsFull(eveRow)?eveRow:null;
  const primSkipped=!!primRow&&!prim, eveSkipped=!!eveRow&&!eve;
  const streak=t.streak?.priming||0;
  const mins=[5,10,15].includes(+t.prefs?.priming_minutes)?+t.prefs.priming_minutes:10;
  const breaths=t.breathCount||0, breathTarget=t.breathTarget||3;
  const q=questionOfDay();
  let qDone=sessions.some(s=>s.kind==='question'&&s.date===tdy);
  try{ if(localStorage.getItem('be_q')===tdy) qDone=true; }catch(e){}
  // Streak wie auf Home: dasselbe monochrome Zeichen (icon('flame')) statt eines Farb-Emojis.
  const streakTxt=streak?`${icon('flame',16,'mind-flame')} ${pl(streak,'Tag','Tage')} in Folge`:'';
  let html='';

  // ---------- 1) Hero: die naechste offene Handlung – nach der Uhrzeit, nicht nach der Reihenfolge ----------
  // B10/H1: bis 2.4.0 stand „Dein Morgen · Priming starten" auch um 23:14 Uhr, weil `!prim` VOR der
  // Uhrzeit geprueft wurde. Jetzt gilt: ab 17 Uhr ohne Reflexion gewinnt der Abend, 12–17 Uhr ist das
  // Priming nur noch ein Nachholen (sekundaerer Knopf), vor 12 Uhr ist es der Morgen. Gleiche Reihenfolge
  // wie im Home-Widget (mindsetHomeWidget), damit Home und Mindset-Reiter nie Verschiedenes sagen.
  let hEye='\u{1F9E0} Priming', hTitle, hMeta, hCta='', hMinChip=false;
  const skipNote=primSkipped?' · heute übersprungen':'';
  if(!eve&&hour>=17){
    hEye='\u{1F319} Abend';
    hTitle='Abend-Reflexion';
    hMeta=eveSkipped?'2 Minuten · der letzte Durchlauf war zu kurz':'2 Minuten · ohne Tippen';
    if(own) hCta=`<button class="btn block" onclick="openEvening()">Abend-Reflexion starten</button>`;
  } else if(!prim&&hour<12){
    hTitle='Dein Morgen';
    hMeta=`${mins} Minuten · Atmung · Dankbarkeit · Visualisierung${skipNote}`;
    hMinChip=true;
    if(own) hCta=`<button class="btn block" onclick="openPriming()">Priming starten</button>`;
  } else if(!prim&&hour<17){
    hTitle='Priming nachholen?';
    hMeta=`Auch mittags wirken ${mins} Minuten Fokus${skipNote}`;
    hMinChip=true;
    if(own) hCta=`<button class="btn block sec" onclick="openPriming()">Priming nachholen</button>`;
  } else if(prim&&eve){
    hEye='\u2728 Geschafft';
    hTitle='Tag abgerundet ✓';
    hMeta=`${mMin(prim.duration_sec)} Priming${streakTxt?' · '+streakTxt:''}`;
    if(own) hCta=`<button class="btn ghost inline" onclick="openPriming()">Priming wiederholen</button>`;
  } else if(prim){
    hTitle='Priming erledigt ✓';
    hMeta=`${mMin(prim.duration_sec)} heute${streakTxt?' · '+streakTxt:''}`;
    if(own) hCta=breaths<breathTarget
      ? `<button class="btn block sec" onclick="openBreath()">Power-Atmung · ${breaths}/${breathTarget}</button>`
      : `<button class="btn ghost inline" onclick="openPriming()">Priming wiederholen</button>`;
  } else {
    // Abend erledigt, Priming fehlt (oder war zu kurz) – nach 17 Uhr ist der Morgen vorbei
    hEye='\u{1F319} Abend';
    hTitle='Abend-Reflexion erledigt ✓';
    hMeta='Morgen früh: Priming für deinen Start';
    if(own) hCta=`<button class="btn ghost inline" onclick="openPriming()">Priming nachholen</button>`;
  }
  html+=`<div class="today mind-hero">
    <div class="eyebrow">${hEye}</div>
    <div class="daytype">${hTitle}</div>
    <div class="meta" id="mindHeroMeta">${hMeta}</div>
    ${(own&&hMinChip)?`<div class="chip-row wrap mind-hero-chips" data-noswipe><button type="button" class="chip" id="mindMinChip" onclick="openMindMinutes()">${mins} Min ${icon('chevronDown',14)}</button></div>`:''}
    ${hCta?`<div class="today-acts">${hCta}</div>`:''}
    <button type="button" class="mind-vlink" onclick="openPrimingVideo()">${own?'Mit Tony (Video)':'Was ist Priming?'}</button>
  </div>`;
  html+=mindRoNote('mb-3');   // B7: im Coach-Blick steht hier, warum keine Knöpfe da sind

  // ---------- 2) Eine Checkliste: jede Zeile ist die Handlung, nichts steht doppelt ----------
  const ok=`<span class="mind-ok" aria-label="erledigt">${icon('check',18)}</span>`;
  const open='<span class="muted-2">–</span>';
  // Übersprungen: gespeichert, aber nicht gezählt – im eigenen Konto wie im Coach-Blick sichtbar (B16)
  const skipped='<span class="mind-skip">übersprungen</span>';
  // Eine Zeile, die etwas tut, muss auch mit Tabulator und Enter bedienbar sein (RATE M1):
  // bisher waren 0 von 8 Zeilen fokussierbar, obwohl app.css schon einen :focus-visible-Stil dafür hat.
  // Die Maßnahmen-Zeilen im Rad (mindWheelActions) machen es seit jeher richtig – gleiche Lösung.
  const mKey=fn=>`role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${fn}}"`;
  const tapRow=fn=>`class="row tap" onclick="${fn}" ${mKey(fn)}`;
  const tap=fn=>own?tapRow(fn):'class="row"';
  let rows='';
  const primSub=prim?mMin(prim.duration_sec)+' · '+(prim.steps_done||0)+'/'+(prim.steps_total||6)+' Schritte'
    :(primSkipped?mMin(primRow.duration_sec)+' · '+(primRow.steps_done||0)+'/'+(primRow.steps_total||6)+' Schritten – zu kurz, zählt nicht':mins+' Minuten · noch offen');
  rows+=`<div ${tap('openPriming()')}><div class="r-ic">${icon('sun',22)}</div><div class="rl">Priming<small>${primSub}</small></div><div class="rr">${prim?ok:(primSkipped?skipped:open)}</div></div>`;
  rows+=`<div ${tap('openBreath()')}><div class="r-ic">${icon('wind',22)}</div><div class="rl">Power-Atmung<small>${breaths>=breathTarget?'Tagesziel erreicht':'1-4-2 · je 5–6 Minuten'}</small></div><div class="rr"><b class="${breaths>=breathTarget?'tone-green':''}">${breaths}/${breathTarget}</b></div></div>`;
  rows+=`<div ${tap('openStateChange()')}><div class="r-ic">${icon('zap',22)}</div><div class="rl">State-Change<small>60 Sekunden · Körper · Fokus · Sprache</small></div><div class="rr">${(t.stateCount||0)>0?ok:open}</div></div>`;
  rows+=`<div ${tap('openEvening()')}><div class="r-ic">${icon('moon',22)}</div><div class="rl">Abend-Reflexion<small>${eve?'Heute erledigt':(eveSkipped?'Zu kurz durchgeklickt – zählt nicht':'2 Minuten · ohne Tippen')}</small></div><div class="rr">${eve?ok:(eveSkipped?skipped:open)}</div></div>`;
  rows+=`<div ${tap('openMindQuestion()')}><div class="r-ic">${icon('help',22)}</div><div class="rl">Frage des Tages<small class="mind-clamp">${esc2(q.text)}</small></div><div class="rr">${qDone?ok:open}</div></div>`;
  const ch=t.challenge?.active||null;
  if(ch){
    const done=mindChalDoneCount(ch);
    const pct=done.total?Math.round(done.done/done.total*100):0;
    rows+=`<div ${tapRow("mindsetTab('challenge')")}><div class="r-ic">${icon('trophy',22)}</div><div class="rl">Challenge<small>Tag ${+ch.dayIndex||1} von ${+ch.days||10}${done.total?` · ${done.done}/${done.total} erledigt`:''}</small><div class="bar mt-1"><i style="width:${pct}%"></i></div></div><div class="rr"></div></div>`;
  }
  html+=`<div class="section-label">Heute</div><div class="rows">${rows}</div>`;

  // ---------- 3) Woche & Monat ----------
  const wl=t.wheel?.last||null;
  const wDays=wl?(t.wheel.daysSince??mDaysBetween(wl.date,tdy)):null;
  const wheelSub=wl?`${mAgo(wDays)} · Ø ${wl.avg??'–'}${t.wheel?.due?' · fällig':''}`:'Wo stehst du gerade?';
  const wkSub=t.weekly?`${mAgo(mDaysBetween(t.weekly.date,tdy))}${t.weeklyDue?' · fällig':''}`:'Welche Emotionen prägen deine Woche?';
  const due='<span class="pill due">fällig</span>';
  html+=`<div class="section-label">Woche &amp; Monat</div><div class="rows">
    <div ${tapRow("mindsetTab('wheel')")}><div class="r-ic">${icon('target',22)}</div><div class="rl">Rad des Lebens<small>${wheelSub}</small></div><div class="rr">${t.wheel?.due?due:''}</div></div>
    <div ${tap('openWeeklyCheck()')}><div class="r-ic">${icon('heart',22)}</div><div class="rl">Emotionaler Wochencheck<small>${wkSub}</small></div><div class="rr">${t.weeklyDue?due:(t.weekly?ok:'')}</div></div>
  </div>`;

  // ---------- 4) Verlauf ----------
  const days30=[]; for(let i=29;i>=0;i--) days30.push(mAddDays(tdy,-i));
  const em=days30.map(d=>({date:d,v1:byDay[d]?.energy??null,v2:byDay[d]?.mood??null})).filter(x=>x.v1!=null||x.v2!=null);
  const primDays=days30.filter(d=>byDay[d]?.priming).length;
  const everPrimed=sessions.some(x=>x.kind==='priming');
  html+=`<div class="section-label">Verlauf</div><div class="chart-card">
    <div class="ch-h"><div class="t">Energie &amp; Stimmung</div><div class="v">30 Tage</div></div>
    ${em.length>=2?lineChart2(em,'Energie','1–10','Stimmung','1–10',{domain1:[0,10],step1:2,domain2:[0,10],step2:2}):'<div class="caption mind-hint">Bewerte Energie und Stimmung beim Priming oder in der Abend-Reflexion – ab zwei Tagen erscheint hier deine Kurve.</div>'}
    ${everPrimed?`<div class="ch-h mt-4"><div class="t">Priming-Tage</div><div class="v">${primDays} von 30</div></div>
    <div class="mind-cal" aria-label="Priming der letzten 30 Tage">${days30.map(d=>{const x=byDay[d]||{};
      // grauer Punkt fuer einen Tag, an dem nur durchgeklickt wurde (B16)
      const cls=x.priming?'ok':(x.primingPartial?'part':(x.evening?'half':''));
      const lbl=x.priming?'Priming':(x.primingPartial?'Priming übersprungen':(x.evening?'nur Abend-Reflexion':'ohne'));
      return `<span class="mind-cal-d ${cls}${d===tdy?' is-today':''}" title="${mDateDE(d)}: ${lbl}" role="img" aria-label="${mAttr(mDateDE(d)+': '+lbl)}"></span>`;}).join('')}</div>
    <div class="mind-legend"><span><i class="ok"></i>Priming</span><span><i class="part"></i>übersprungen</span><span><i class="half"></i>nur Abend</span><span><i></i>ohne</span></div>`
    :(em.length>=2?'<div class="caption mind-hint">Nach deinem ersten Priming erscheint hier dein 30-Tage-Verlauf.</div>':'')}
    ${weeklyBars(sessions)}
  </div>`;
  b.innerHTML=html;
  mindCacheView();
}
// Sheet fuer die Priming-Dauer (5/10/15) - der Hero traegt nur noch einen Chip
function openMindMinutes(){
  const mins=[5,10,15].includes(+MIND_TODAY?.prefs?.priming_minutes)?+MIND_TODAY.prefs.priming_minutes:10;
  openSheet('Priming-Dauer',`<div class="body muted mb-4">Wie viel Zeit nimmst du dir morgens? Die Schritte werden passend skaliert.</div>
    <div class="chip-row wrap" data-noswipe>${[5,10,15].map(m=>`<button type="button" class="chip${mins===m?' on':''}" aria-pressed="${mins===m}" onclick="mindSetMinutes(${m})">${m} Min</button>`).join('')}</div>`);
}
// Frage des Tages als eigenes Sheet (in der Checkliste steht nur die Zeile)
function openMindQuestion(){
  const q=questionOfDay(); const tdy=today();
  let qDone=(MIND_SESS?.sessions||[]).some(s=>s.kind==='question'&&s.date===tdy);
  try{ if(localStorage.getItem('be_q')===tdy) qDone=true; }catch(e){}
  openSheet('Frage des Tages',`
    <div class="card mind-q"><div class="mind-q-text">${esc2(q.text)}</div>
      <div class="mind-q-sub">Nur denken – kein Tippen. Nimm dir eine Minute.</div></div>
    ${mindOwn()?`<button class="btn block mt-4" id="mindQBtn" ${qDone?'disabled':''} onclick="mindQuestionDone(${q.id})">${qDone?'Nachgedacht ✓':'Nachgedacht · +2 XP'}</button>`:''}`);
}
function mindChalDoneCount(ch){
  const rules=Array.isArray(ch.rules)?ch.rules:mParse(ch.rules,[]);
  const td=ch.today||{}; const checks=mParse(td.checks,{})||{}; const auto=mParse(td.auto,{})||{};
  let done=0; rules.forEach(id=>{ if(checks[id]===true||auto[id]===true) done++; });
  if(td.doneCount!=null) done=td.doneCount;
  return { done, total:rules.length||0 };
}
function weeklyBars(sessions){
  const weekly=(sessions||[]).filter(s=>s.kind==='weekly');
  if(!weekly.length) return '';
  const tdy=today(); const weeks=[]; // 8 Wochen, älteste zuerst
  for(let w=7;w>=0;w--){ const end=mAddDays(tdy,-7*w), start=mAddDays(end,-6); weeks.push({start,end,ratio:null,n:0}); }
  weekly.forEach(s=>{ const d=mParse(s.data,{})||{}; const st=(d.strong||[]).length, wk=(d.weak||[]).length; if(st+wk===0) return;
    const wkObj=weeks.find(x=>s.date>=x.start&&s.date<=x.end); if(!wkObj) return; wkObj.ratio=Math.round(st/(st+wk)*100); wkObj.n++; });
  const has=weeks.some(w=>w.ratio!=null); if(!has) return '';
  return `<div class="ch-h mt-4"><div class="t">Stärkende Emotionen</div><div class="v">Anteil · 8 Wochen</div></div>
    <div class="mind-wbars" aria-label="Anteil stärkender Emotionen pro Woche">${weeks.map(w=>`<div class="wb"><div class="wbv" style="height:${w.ratio==null?4:Math.max(6,w.ratio)}%;background:${w.ratio==null?'var(--surface2)':w.ratio>=60?'var(--green)':w.ratio>=40?'var(--amber)':'var(--red)'}"></div><div class="wbl">${w.ratio==null?'·':w.ratio+'%'}</div></div>`).join('')}</div>`;
}
async function mindSetMinutes(m){
  if(![5,10,15].includes(m)) return;
  if(!(await mindSavePrefs({priming_minutes:m}))) return;
  toast('Priming-Dauer: '+m+' Minuten');
  closeModal();
  // Hero an Ort und Stelle nachziehen (kein Neuaufbau des Tabs)
  const chip=document.getElementById('mindMinChip'); if(chip) chip.innerHTML=`${m} Min ${icon('chevronDown',14)}`;
  // Der Hero-Text haengt an der Uhrzeit (Morgen / Nachholen) und daran, ob heute schon vollwertig geprimt wurde
  const primRow=MIND_TODAY&&MIND_TODAY.priming, done=mdIsFull(primRow);
  const skipNote=(primRow&&!done)?' · heute übersprungen':'';
  const meta=document.getElementById('mindHeroMeta');
  if(meta&&!done) meta.textContent=(new Date().getHours()<12?`${m} Minuten · Atmung · Dankbarkeit · Visualisierung`:`Auch mittags wirken ${m} Minuten Fokus`)+skipNote;
  const row=document.querySelector('#mindBody .rows .row .rl small');
  if(row&&!primRow) row.textContent=`${m} Minuten · noch offen`;
  mindCacheView();
}
async function mindQuestionDone(id){
  if(mindRoGuard()) return;
  const btn=document.getElementById('mindQBtn'); if(btn) btn.disabled=true;
  const r=await API.post('/mindset/session',{kind:'question',date:today(),data:{id}});
  if(r.status===200||r.status===201){
    try{ localStorage.setItem('be_q',today());Object.keys(localStorage).filter(k=>k.startsWith('be_q_')).forEach(k=>{try{localStorage.removeItem(k);}catch(e){}}); }catch(e){}
    if(btn) btn.textContent='Nachgedacht ✓';
    // Der Server antwortet bei einer zweiten Antwort am selben Tag mit already:true (0 XP)
    if(r.data?.already) toast('Heute schon erledigt ✓');
    else { toast('+'+mindXp(r,2)+' XP · Nachgedacht ✓'); if(typeof refreshAchievements==='function') refreshAchievements(); }
    setTimeout(()=>{ closeModal(); mindRefresh(); },400);
  }
  else { if(btn) btn.disabled=false; toast(r.data?.error||'Konnte nicht speichern'); }
}
function openPrimingVideo(){
  openSheet('Priming mit Tony',`
    <div class="mind-sheet-ic" aria-hidden="true">🧠</div>
    <div class="note">Priming ist die 10-Minuten-Morgenroutine von Tony Robbins: Atmung, Dankbarkeit, Visualisierung. Hier findest du die offiziellen Quellen und Videos – zum Mitmachen oder als Einstieg.</div>
    ${mindLinks(['priming','guide','video1','video2'])}
    ${mindOwn()?`<button class="btn block mt-4" onclick="closeAllSheets();openPriming()">Lieber mit der App-Anleitung</button>`:''}`);
}

// =====================================================================
// PLAYER (Vollbild-Overlay) – Priming, Power-Atmung, State-Change
// =====================================================================
// ===== A-II.6 · Der Player ist ein echter Dialog (Übergabe A5-2 aus A-II.5) =====
// Bis 2.5.0 behauptete #primingOverlay role="dialog" aria-modal="true" und löste nichts davon ein:
// der Hintergrund blieb mit Tab erreichbar, die Seite scrollte darunter weiter, der Fokus stand nach
// dem Öffnen weiter auf dem Startknopf IN der Seite dahinter, und Escape tat nichts. aria-modal="true"
// weist einen Screenreader an, alles außerhalb des Dialogs zu ignorieren – steht der Fokus dann genau
// dort draußen, liest er gar nichts mehr vor. Das ist schlechter als keine Rolle.
// Der Mechanismus ist derselbe wie bei den Sheets (shell.js, A-II.5): inert über den Hintergrund,
// Scroll-Lock, Fokus hinein, Tab bleibt drin, Escape kommt heraus. Der Player ist aber KEIN Sheet
// (er lebt außerhalb von #modal und überlebt keinen Sheet-Stack), darum hier eine eigene, kleine
// Fassung statt openSheet(). Reihenfolge beim Öffnen wie dort: erst den Auslöser merken, DANN inert
// setzen (inert nimmt dem Auslöser sofort den Fokus), dann den Fokus in den Dialog holen.
const SEM_MP_INERT=['appView','loginView','onbView','restBar'];
let semMpReturnFocus=null,semMpScrollY=0,semMpLocked=false,semMpObs=null;
// Schließt sich ein Sheet, das ÜBER dem Player lag, dann räumt _a11SheetOff() in shell.js inert und
// Scroll-Lock weg – es weiß nichts vom Player darunter. Gemessen: der Hintergrund war danach wieder
// mit Tab erreichbar, obwohl der Player noch offen stand. Also nachsetzen, sobald es passiert.
// (shell.js gehört Paket A-II.5 und bleibt unangetastet; das hier ist die Seite, die es merkt.)
function semMpReassert(){
  const ov=document.getElementById('primingOverlay');
  if(!ov||!ov.isConnected){if(semMpObs){semMpObs.disconnect();semMpObs=null;}return;}
  if(typeof sheetOpen==='function'&&sheetOpen())return;   // das Sheet oben regelt es selbst
  SEM_MP_INERT.forEach(id=>{const e=document.getElementById(id);if(e&&!e.hasAttribute('inert'))e.setAttribute('inert','');});
  if(!document.body.classList.contains('sheet-open')){document.body.classList.add('sheet-open');semMpLocked=true;}}
function semMpDialogOn(ov){
  if(!ov)return;
  const a=document.activeElement;
  semMpReturnFocus=(a&&a!==document.body&&a.isConnected)?a:null;
  SEM_MP_INERT.forEach(id=>{const e=document.getElementById(id);if(e)e.setAttribute('inert','');});
  if(!document.body.classList.contains('sheet-open')){
    semMpScrollY=window.scrollY||document.documentElement.scrollTop||0;
    document.body.classList.add('sheet-open');semMpLocked=true;}
  if(semMpObs){semMpObs.disconnect();semMpObs=null;}
  try{
    semMpObs=new MutationObserver(semMpReassert);
    semMpObs.observe(document.body,{attributes:true,attributeFilter:['class']});
    SEM_MP_INERT.forEach(id=>{const e=document.getElementById(id);if(e)semMpObs.observe(e,{attributes:true,attributeFilter:['inert']});});
  }catch(e){}
  ov.setAttribute('tabindex','-1');
  // Auf das Overlay selbst, nicht auf einen Knopf: ein Screenreader liest so zuerst den Dialognamen
  // („Morgen-Priming“) und dann den Inhalt vor. Tab führt von hier zum ersten Knopf (s. semMpKeys).
  try{ov.focus({preventScroll:true});}catch(e){}}
function semMpDialogOff(){
  if(semMpObs){semMpObs.disconnect();semMpObs=null;}
  // Liegt (wieder) ein Sheet oben – mindPlayerNotes() öffnet eines direkt nach dem Abbau –, dann
  // gehören inert, Scroll-Lock und Fokus jetzt shell.js. Nichts davon anfassen.
  const sheetStill=(typeof sheetOpen==='function')&&sheetOpen();
  if(!sheetStill){
    SEM_MP_INERT.forEach(id=>{const e=document.getElementById(id);if(e)e.removeAttribute('inert');});
    if(semMpLocked){
      document.body.classList.remove('sheet-open');
      if(semMpScrollY>0&&(window.scrollY||0)===0){try{window.scrollTo(0,semMpScrollY);}catch(e){}}}}
  semMpLocked=false;
  const back=semMpReturnFocus;semMpReturnFocus=null;
  if(!sheetStill&&back&&back.isConnected&&typeof back.focus==='function'){try{back.focus({preventScroll:true});}catch(e){}}}
// Escape und Tab im Player. Capture-Phase, damit dieser Handler VOR _sheetTrap/a11KeyActivate aus
// shell.js liegt: solange der Player offen ist, darf Escape nichts hinter ihm schließen.
// Escape tut genau das, was der X-Knopf tut (App-Konvention), und das ist beim laufenden Durchlauf
// erst einmal die Rückfrage – ein Fehlgriff darf kein Priming löschen. Das zweite Escape bestätigt.
function semMpKeys(e){
  const ov=document.getElementById('primingOverlay');
  if(!ov||!ov.isConnected)return;
  // Liegt ein Sheet über dem Player (z. B. die Einwilligungs-Rückfrage, die ein fehlgeschlagenes
  // Speichern aufmacht), dann gehört die Tastatur der obersten Schicht: shell.js. Sonst schluckt
  // dieser Handler das Escape, das eigentlich das Sheet schließen soll.
  if(typeof sheetOpen==='function'&&sheetOpen())return;
  if(e.key==='Escape'||e.key==='Esc'){
    if(e.defaultPrevented)return;
    e.preventDefault();e.stopPropagation();
    if(!MP)return;
    if(MP.finished){if(ov.classList.contains('mp-done'))mindPlayerDone();return;}
    if(MP.aborting){mindPlayerDestroy();return;}
    mindPlayerClose();return;}
  if(e.key!=='Tab')return;
  const f=(typeof _a11Focusables==='function')?_a11Focusables(ov)
    :[...ov.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];
  if(!f.length){e.preventDefault();e.stopPropagation();try{ov.focus({preventScroll:true});}catch(x){}return;}
  const first=f[0],last=f[f.length-1],a=document.activeElement,i=f.indexOf(a);
  if(i<0){e.preventDefault();e.stopPropagation();(e.shiftKey?last:first).focus();return;}
  if(e.shiftKey&&a===first){e.preventDefault();e.stopPropagation();last.focus();}
  else if(!e.shiftKey&&a===last){e.preventDefault();e.stopPropagation();first.focus();}}
document.addEventListener('keydown',semMpKeys,true);
function mindBuildPhases(s){
  const ph=[];
  if(s.type==='power'){
    const half=Math.round(((s.period||1.1)*1000)/2);
    for(let set=1;set<=s.sets;set++){
      for(let b=1;b<=s.breaths;b++){
        ph.push({pacer:'in', dur:half, label:`Satz ${set}/${s.sets} · Ein`, count:`${b} / ${s.breaths}`});
        ph.push({pacer:'out',dur:half, label:`Satz ${set}/${s.sets} · Aus`, count:`${b} / ${s.breaths}`});
      }
      if(set<s.sets) ph.push({pacer:'rest', dur:s.rest*1000, label:`Satz ${set} geschafft · kurz durchatmen`, countdown:true});
    }
    return ph;
  }
  if(s.type==='b142'){
    for(let c=1;c<=s.cycles;c++){
      ph.push({pacer:'in',  dur:s.inh*1000,  label:'Einatmen',  cycle:`${c} / ${s.cycles}`, countdown:true});
      ph.push({pacer:'hold',dur:s.hold*1000, label:'Halten',    cycle:`${c} / ${s.cycles}`, countdown:true});
      ph.push({pacer:'out', dur:s.exh*1000,  label:'Ausatmen',  cycle:`${c} / ${s.cycles}`, countdown:true});
    }
    return ph;
  }
  if(Array.isArray(s.parts)&&s.parts.length){
    s.parts.forEach(p=>ph.push({pacer:null,dur:p.dur*1000,label:p.label||'',text:p.text,countdown:false}));
    return ph;
  }
  return [{pacer:null,dur:(s.dur||30)*1000,label:s.label||'',countdown:false}];
}
function mindPlayerOpen(cfg){
  if(MP) mindPlayerDestroy();
  const steps=cfg.steps.map(s=>{ const phases=mindBuildPhases(s); return {...s,phases,total:phases.reduce((a,p)=>a+p.dur,0)}; });
  let chime=false; try{ chime=localStorage.getItem('be_chime')==='1'; }catch(e){}
  MP={cfg,steps,idx:0,pi:0,left:0,stepElapsed:0,running:false,timer:null,active:0,lastTick:0,doneSteps:0,chime,wake:null,actx:null,lastTxt:'',lastRing:-1,lastLeft:-1,finished:false,aborting:false,res:null};
  const ov=document.createElement('div');
  ov.id='primingOverlay'; ov.className='mind-player'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label',cfg.title||'Mindset'); ov.setAttribute('data-noswipe','');
  const R=88, C=(2*Math.PI*R).toFixed(1);
  ov.innerHTML=`
    <div class="mp-top">
      <div class="mp-head"><div class="mp-step" id="mpStep"></div><div class="mp-left" id="mpLeft"></div></div>
      <div class="mp-tools">
        <button type="button" class="mp-ib" id="mpChime" aria-label="Signalton ${chime?'aus':'an'}" onclick="mindChimeToggle()">${icon(chime?'bell':'volumeX',20)}</button>
        <button type="button" class="mp-ib" aria-label="Schließen" onclick="mindPlayerClose()">${icon('x',20)}</button>
      </div>
    </div>
    <div class="mp-steps" id="mpSteps" aria-hidden="true"></div>
    <div class="mp-center">
      <div class="mp-ringwrap">
        <svg class="mind-ring" viewBox="0 0 200 200" aria-hidden="true"><circle class="bg" cx="100" cy="100" r="${R}" fill="none" stroke-width="7"/><circle class="fg" id="mpRing" cx="100" cy="100" r="${R}" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <div class="breath-pacer hidden" id="mpPacer" aria-hidden="true"></div>
        <div class="mp-time" id="mpTime" aria-live="off">0</div>
        <div class="mp-paused hidden" id="mpPaused">Pausiert</div>
      </div>
      <div class="mp-phase" id="mpPhase" aria-live="polite"></div>
      <div class="mp-title" id="mpTitle"></div>
      <div class="mp-text" id="mpText"></div>
    </div>
    <div class="mp-bottom" id="mpBottom"></div>`;
  document.body.appendChild(ov);
  document.body.classList.add('mind-playing');
  semMpDialogOn(ov);   // erst jetzt: der Auslöser hat bis hier den Fokus, inert nimmt ihn weg
  document.addEventListener('visibilitychange',mindPlayerVis);
  mindPlayerLoadStep(0);
  mindPlayerBottom();
  mindPlayerResume(); // holt auch den Wake-Lock (nur eine Anfrage gleichzeitig, s. mindWake)
}
// Untere Leiste: EINE runde Pause-Taste, darunter der leise Textknopf zum Überspringen.
// „Fertig ✓“ erscheint nur im letzten Schritt.
function mindPlayerBottom(){
  const bot=document.getElementById('mpBottom'); if(!bot||!MP) return;
  bot.innerHTML=`<button type="button" class="mp-main" id="mpPause" aria-label="${MP.running?'Pause':'Weiter'}" onclick="mindPlayerToggle()">${icon(MP.running?'pause':'play',30)}</button>
    <button type="button" class="btn ghost mp-skip" id="mpNext" onclick="mindPlayerNext()"></button>`;
  MP.lastGate=-1; mdGateDraw(true);
}
// „Überspringen“/„Fertig ✓“ erst ab der Hälfte des Schritts (B16): vorher steht dort, wie lange es
// noch dauert. Ohne diese Sperre war ein ganzes Priming in einer Sekunde durchgeklickt.
function mdGateDraw(force){
  const b=document.getElementById('mpNext'); if(!b||!MP) return;
  const last=MP.idx===MP.steps.length-1;
  const ms=mdStepGateMs(), sec=Math.ceil(ms/1000);
  if(!force&&sec===MP.lastGate) return;
  MP.lastGate=sec;
  if(ms>0){
    b.disabled=true; b.setAttribute('aria-disabled','true');
    b.textContent=`Noch ${sec} ${sec===1?'Sekunde':'Sekunden'}`;
    const st=MP.steps[MP.idx], half=(st&&st.total)?st.total*MD_STEP_GATE:0;
    b.style.setProperty('--gate',(half?Math.max(0,Math.min(100,Math.round(MP.stepElapsed/half*100))):0)+'%');
  } else {
    b.disabled=false; b.removeAttribute('aria-disabled');
    b.textContent=last?'Fertig ✓':'Überspringen';
    b.style.setProperty('--gate','100%');
  }
}
// 6-Segment-Balken über die ganze Einheit + „noch ~7 Min“
function mindStepsBar(){
  const el=document.getElementById('mpSteps'); if(!el||!MP) return;
  if(MP.steps.length<2){ el.innerHTML=''; el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML=MP.steps.map((s,i)=>`<span class="${i<MP.idx?'done':i===MP.idx?'on':''}"></span>`).join('');
}
function mindRemainMs(){
  if(!MP) return 0;
  let ms=Math.max(0,(MP.steps[MP.idx]?.total||0)-MP.stepElapsed);
  for(let i=MP.idx+1;i<MP.steps.length;i++) ms+=MP.steps[i].total;
  return ms;
}
function mindPlayerLoadStep(i){
  const st=MP.steps[i]; MP.idx=i; MP.pi=0; MP.stepElapsed=0; MP.left=st.phases[0].dur; MP.lastRing=-1; MP.lastTxt=''; MP.lastLeft=-1;
  const n=MP.steps.length;
  const stepEl=document.getElementById('mpStep'); if(stepEl) stepEl.textContent=n>1?`Schritt ${i+1}/${n}`:(MP.cfg.stepLabel||'');
  const tt=document.getElementById('mpTitle'); if(tt) tt.textContent=st.title||'';
  MP.lastGate=-1; mdGateDraw(true);   // neuer Schritt: die Halbzeit-Sperre beginnt von vorn
  mindStepsBar();
  mindApplyPhase(true);
  mindDraw(true);
}
function mindApplyPhase(first){
  const st=MP.steps[MP.idx]; const p=st.phases[MP.pi];
  const pac=document.getElementById('mpPacer');
  if(pac){
    if(p.pacer){ pac.style.setProperty('--dur',Math.max(60,p.dur)+'ms'); pac.className='breath-pacer '+p.pacer; }
    else pac.className='breath-pacer hidden';
  }
  const tx=document.getElementById('mpText'); if(tx){ const t=p.text||st.text||''; if(t!==MP.lastTxt){ tx.textContent=t; MP.lastTxt=t; } }
  if(!first&&p.pacer==='rest') mindVibrate(120);
}
function mindDraw(force){
  const st=MP.steps[MP.idx]; const p=st.phases[MP.pi];
  const remainStep=Math.max(0,st.total-MP.stepElapsed);
  const secStep=Math.ceil(remainStep/1000), secPhase=Math.ceil(Math.max(0,MP.left)/1000);
  const timeEl=document.getElementById('mpTime'), phEl=document.getElementById('mpPhase'), ring=document.getElementById('mpRing');
  let timeTxt, phTxt;
  if(st.type==='power'){ timeTxt=p.pacer==='rest'?String(secPhase):(p.count||''); phTxt=p.label||''; }
  else if(st.type==='b142'){ timeTxt=String(secPhase); phTxt=`${p.label} · Zyklus ${p.cycle}`; }
  else { timeTxt=secStep>=60?`${Math.floor(secStep/60)}:${String(secStep%60).padStart(2,'0')}`:String(secStep); phTxt=p.label||''; }
  if(timeEl&&(force||timeEl.textContent!==timeTxt)) timeEl.textContent=timeTxt;
  if(phEl&&(force||phEl.textContent!==phTxt)) phEl.textContent=phTxt;   // Phasentext bleibt auch in der Pause stehen
  const pz=document.getElementById('mpPaused'); if(pz) pz.classList.toggle('hidden',!!MP.running);
  if(ring){ const frac=st.total?Math.min(1,MP.stepElapsed/st.total):0; const pct=Math.round(frac*200); if(force||pct!==MP.lastRing){ MP.lastRing=pct; const C=2*Math.PI*88; ring.style.strokeDashoffset=(C*(1-frac)).toFixed(1); } }
  const lf=document.getElementById('mpLeft');
  if(lf&&MP.steps.length>1){ const m=Math.max(0,Math.round(mindRemainMs()/60000)); if(force||m!==MP.lastLeft){ MP.lastLeft=m; lf.textContent=m>0?`noch ~${m} Min`:'gleich fertig'; } }
  if(!MP.aborting) mdGateDraw(force);
}
function mindTick(){
  if(!MP||!MP.running) return;
  const now=Date.now(); const dt=Math.min(2000,now-MP.lastTick); MP.lastTick=now;
  MP.active+=dt; MP.left-=dt; MP.stepElapsed+=dt;
  while(MP.left<=0){
    const st=MP.steps[MP.idx]; MP.pi++;
    if(MP.pi>=st.phases.length){ mindStepDone(true); return; }
    MP.left+=st.phases[MP.pi].dur; mindApplyPhase(false);
  }
  mindDraw(false);
}
function mindStepDone(natural){
  const st=MP.steps[MP.idx];
  if(natural||(st.total&&MP.stepElapsed>=st.total*0.5)) MP.doneSteps++;
  if(MP.idx<MP.steps.length-1){
    mindVibrate(200); mindChime();
    mindPlayerLoadStep(MP.idx+1);
  } else mindPlayerFinish();
}
// Zweite Sicherung neben dem gesperrten Knopf: vor der Halbzeit passiert hier nichts.
function mindPlayerNext(){ if(!MP||MP.finished||MP.aborting) return; if(mdStepGateMs()>0){ mdGateDraw(true); return; } if(!MP.running){ MP.lastTick=Date.now(); } mindStepDone(false); }
function mindPlayerResume(){
  if(!MP||MP.finished||MP.aborting) return;
  MP.running=true; MP.lastTick=Date.now();
  clearInterval(MP.timer); MP.timer=setInterval(mindTick,100);
  mindPlayerBtn();
  mindPacerThaw(); mindDraw(true); mindWake();
}
function mindPlayerPause(){
  if(!MP||!MP.running) return;
  MP.running=false; clearInterval(MP.timer); MP.timer=null;
  mindPlayerBtn();
  mindPacerFreeze(); mindDraw(true);
}
// Die zentrale runde Taste zeigt Pause bzw. Weiter (Symbol statt Text)
function mindPlayerBtn(){
  const pb=document.getElementById('mpPause'); if(!pb||!MP) return;
  pb.innerHTML=icon(MP.running?'pause':'play',30);
  pb.setAttribute('aria-label',MP.running?'Pause':'Weiter');
}
function mindPlayerToggle(){ if(!MP||MP.aborting) return; if(MP.running) mindPlayerPause(); else mindPlayerResume(); }
function mindPacerFreeze(){
  const p=document.getElementById('mpPacer'); if(!p||p.classList.contains('hidden')) return;
  try{ const tf=getComputedStyle(p).transform; p.style.transition='none'; p.style.transform=(tf&&tf!=='none')?tf:''; }catch(e){}
}
function mindPacerThaw(){
  const p=document.getElementById('mpPacer'); if(!p||p.classList.contains('hidden')) return;
  try{ void p.offsetWidth; p.style.transition=''; p.style.setProperty('--dur',Math.max(60,MP.left)+'ms'); p.style.transform=''; }catch(e){}
}
function mindPlayerVis(){
  if(!MP) return;
  if(document.visibilityState==='hidden'){ if(MP.running){ mindPlayerPause(); MP.autoPaused=true; } }
  else { mindWake(); }
}
// Bildschirm wach halten: höchstens EINE Anfrage gleichzeitig (wakePending) und höchstens
// EIN Sentinel (ein zweites, z.B. nach Tab-Wechsel, wird sofort wieder freigegeben).
async function mindWake(){
  const me=MP;
  if(!me||me.wake||me.wakePending||!('wakeLock' in navigator)||document.visibilityState!=='visible') return;
  me.wakePending=true;
  try{
    const w=await navigator.wakeLock.request('screen');
    if(MP!==me||me.wake||me.finished){ try{ w.release(); }catch(e){} return; }
    me.wake=w; w.addEventListener('release',()=>{ if(me.wake===w) me.wake=null; });
  }catch(e){}
  finally{ me.wakePending=false; }
}
function mindWakeRelease(){ try{ if(MP&&MP.wake){ const w=MP.wake; MP.wake=null; w.release(); } }catch(e){} }
function mindChime(){
  if(!MP||!MP.chime) return;
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
    if(!MP.actx) MP.actx=new Ctx(); const ctx=MP.actx; if(ctx.state==='suspended') ctx.resume();
    const t=ctx.currentTime;
    [660,990].forEach((f,i)=>{ const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(ctx.destination);
      const s=t+i*0.18; g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(0.12,s+0.02); g.gain.exponentialRampToValueAtTime(0.0001,s+0.4); o.start(s); o.stop(s+0.45); });
  }catch(e){}
}
function mindChimeToggle(){
  if(!MP) return; MP.chime=!MP.chime;
  try{ localStorage.setItem('be_chime',MP.chime?'1':'0'); }catch(e){}
  const b=document.getElementById('mpChime'); if(b){ b.innerHTML=icon(MP.chime?'bell':'volumeX',20); b.setAttribute('aria-label','Signalton '+(MP.chime?'aus':'an')); }
  if(MP.chime) mindChime();
}
// Kein window.confirm: der Player pausiert und fragt in seiner eigenen Leiste nach.
function mindPlayerClose(){
  if(!MP||MP.aborting) return;
  if(MP.finished){ mindPlayerDone(); return; }
  MP.abortWasRunning=MP.running; if(MP.running) mindPlayerPause();
  MP.aborting=true;
  const tx=document.getElementById('mpText');
  if(tx){ MP.abortPrevTxt=tx.textContent; tx.textContent=MP.cfg.abortText||'Abbrechen? Der Fortschritt dieser Runde geht verloren.'; MP.lastTxt=tx.textContent; }
  const bot=document.getElementById('mpBottom');
  // Konvention wie bei confirmSheet(): die zerstoerende Wahl traegt .danger und einen eigenen
  // Verb-Namen; „Abbrechen“ heisst in der ganzen App „Dialog schliessen“ und darf hier nichts loeschen.
  if(bot){bot.innerHTML=`<div class="mp-confirm"><button type="button" class="btn danger inline" onclick="mindPlayerDestroy()">Beenden</button><button type="button" class="btn inline" onclick="mindPlayerAbortBack()">Weitermachen</button></div>`;
    // Der Austausch der Leiste hat dem gerade benutzten Knopf den Fokus genommen: ihn auf die
    // harmlose Wahl setzen, damit die Rückfrage per Tastatur überhaupt erreichbar ist (A-II.6).
    const w=bot.querySelector('.mp-confirm .btn:not(.danger)');if(w)try{w.focus({preventScroll:true});}catch(e){}}
}
function mindPlayerAbortBack(){
  if(!MP) return; MP.aborting=false;
  const tx=document.getElementById('mpText'); if(tx&&MP.abortPrevTxt!=null){ tx.textContent=MP.abortPrevTxt; MP.lastTxt=MP.abortPrevTxt; }
  mindPlayerBottom();
  const pb=document.getElementById('mpPause');if(pb)try{pb.focus({preventScroll:true});}catch(e){}
  if(MP.abortWasRunning) mindPlayerResume(); else mindDraw(true);
}
function mindPlayerDestroy(){
  if(!MP) return;
  clearInterval(MP.timer); mindWakeRelease();
  try{ if(MP.actx) MP.actx.close(); }catch(e){}
  document.removeEventListener('visibilitychange',mindPlayerVis);
  const ov=document.getElementById('primingOverlay'); if(ov) ov.remove();
  document.body.classList.remove('mind-playing');
  semMpDialogOff();   // inert/Scroll-Lock zurück, Fokus zurück auf den Knopf, der den Player öffnete
  MP=null;
}
function mindPlayerFinish(){
  if(!MP||MP.finished) return; MP.finished=true;
  MP.running=false; clearInterval(MP.timer); MP.timer=null;
  const res={duration_sec:Math.max(1,Math.min(7200,Math.round(MP.active/1000))),steps_done:Math.min(MP.steps.length,MP.doneSteps),steps_total:MP.steps.length};
  const cb=MP.cfg.onFinish; mindVibrate([120,80,120]); mindChime();
  if(MP.cfg.complete){ mindPlayerComplete(res); return; }   // Priming: ruhiger Abschluss im Player
  setTimeout(()=>{ mindPlayerDestroy(); try{ if(cb) cb(res); }catch(e){ console.error(e); } },350);
}
// Abschluss-Zustand im schwarzen Player – erst danach (freiwillig) das Ergebnis-Sheet
function mindPlayerComplete(res){
  const ov=document.getElementById('primingOverlay'); if(!ov||!MP){ mindPlayerDestroy(); return; }
  MP.res=res; mindWakeRelease();
  ov.classList.add('mp-done');
  ov.innerHTML=`<div class="mp-center">
      <div class="mp-done-ic" aria-hidden="true">🧠</div>
      <div class="mp-title">${mMin(res.duration_sec)}${mStepsTxt(res)}</div>
      <div class="mp-text" id="mpDoneNote">Wird gespeichert …</div>
    </div>
    <div class="mp-bottom mp-done-acts">
      <button type="button" class="btn sec inline" onclick="mindPlayerNotes()">Ergebnisse notieren</button>
      <button type="button" class="btn inline" onclick="mindPlayerDone()">Fertig</button>
    </div>`;
  // Der Inhalt des Dialogs wurde komplett ersetzt – der Fokus lag in der alten Leiste und ist jetzt
  // im Nichts. Zurück auf den Dialog: ein Screenreader liest damit den Abschluss vor (A-II.6).
  try{ov.focus({preventScroll:true});}catch(e){}
  const cb=MP.cfg.onFinish;
  if(!cb) return mindPlayerCompleteNote();
  try{ const p=cb(res); if(p&&typeof p.then==='function') p.then(mindPlayerCompleteNote,mindPlayerCompleteNote); else mindPlayerCompleteNote(); }
  catch(e){ console.error(e); mindPlayerCompleteNote(); }
}
function mindPlayerCompleteNote(){
  const n=document.getElementById('mpDoneNote'); if(!n) return;
  if(PRIM_RES&&PRIM_RES.saved===false){ n.textContent='Noch nicht gespeichert – tippe auf „Ergebnisse notieren“, um es erneut zu versuchen.'; return; }
  // Ein durchgeklickter Durchlauf wird gespeichert, aber er darf keine Serie behaupten (B16)
  if(PRIM_RES&&PRIM_RES.full===false){ n.textContent='Gespeichert – gezählt wird es heute nicht, dafür war es zu kurz. '+mdRuleTxt(PRIM_RES.rule); return; }
  const st=+(PRIM_RES&&PRIM_RES.streak)||0;
  n.textContent='Gespeichert.'+(st>1?` ${pl(st,'Tag','Tage')} in Folge.`:' Dein Tag hat jetzt eine Richtung.');
}
function mindPlayerNotes(){ const res=MP&&MP.res; mindPlayerDestroy(); if(res) primingFinishSheet(res); }
function mindPlayerDone(){ mindPlayerDestroy(); mindRefresh(); }

// ===== §5.2 Priming =====
function primingPlan(mins){
  const f=(mins||10)/10; const S=s=>Math.max(10,Math.round(s*f));
  return [
    { type:'timer', title:'Ankommen', dur:S(30), text:'Aufrecht sitzen oder stehen, Augen schließen. Drei tiefe Atemzüge. Eine Hand aufs Herz – du bist jetzt hier.' },
    { type:'power', title:'Power-Atmung', sets:3, breaths:Math.max(10,Math.round(30*f)), rest:Math.max(8,Math.round(20*f)), period:1.1,
      text:'Kräftig und schnell durch die Nase ein und aus. Arme beim Einatmen nach oben, beim Ausatmen mit Zug nach unten. Nacken locker.' },
    { type:'timer', title:'Dankbarkeit', parts:[
      { dur:S(60), label:'Moment 1', text:'Ein Erlebnis, für das du zutiefst dankbar bist. Geh hinein, als wärst du wieder dort – sieh es, hör es, spür es. Nicht tippen. Fühlen.' },
      { dur:S(60), label:'Moment 2', text:'Ein weiterer Moment, der dich erfüllt. Nimm die Details wahr: Gesichter, Licht, das Gefühl im Körper.' },
      { dur:S(60), label:'Moment 3', text:'Etwas Kleines und Einfaches von heute oder gestern. Genau das Kleine macht dich reich.' } ] },
    { type:'timer', title:'Energie & Heilung', dur:S(90), text:'Stell dir vor, wie Licht durch deinen Scheitel einströmt und jede Zelle füllt. Spannung löst sich, Kraft bleibt. Dann schick diese Energie zu drei Menschen, die dir wichtig sind.' },
    { type:'timer', title:'3 to Thrive', parts:[
      { dur:S(45), label:'Ergebnis 1', text:'Ein Ziel, das du heute oder bald erreichst. Sieh es als bereits erledigt. Wie fühlt sich der Moment an, in dem es geschafft ist? Feiere ihn.' },
      { dur:S(45), label:'Ergebnis 2', text:'Das nächste Ziel – gleiche Intensität. Du hast es schon geschafft. Spür Stolz und Erleichterung.' },
      { dur:S(45), label:'Ergebnis 3', text:'Noch einmal: Sieh das Ergebnis, fühl den Abschluss, bedank dich dafür.' } ] },
    { type:'timer', title:'Abschluss', dur:S(20), text:'Hand aufs Herz. Ein Satz, der dich heute trägt – sag ihn innerlich, mit Überzeugung. Dann öffne die Augen.' },
  ];
}
function openPriming(){
  if(!mindOwn()){ toast('Priming ist nur im eigenen Konto möglich'); return; }
  const mins=[5,10,15].includes(+MIND_TODAY?.prefs?.priming_minutes)?+MIND_TODAY.prefs.priming_minutes:10;
  try{ if(typeof closeAllSheets==='function') closeAllSheets(); else closeModal(); }catch(e){}
  mindPlayerOpen({ kind:'priming', title:'Morgen-Priming', steps:primingPlan(mins), complete:true,
    abortText:'Priming abbrechen? Die Runde wird nicht gespeichert.', onFinish:primingSaveNow });
}
// Gab es überhaupt schon einmal ein Priming? (für die eine Feier beim allerersten Mal)
function mindFirstPriming(){
  if(MIND_TODAY&&MIND_TODAY.priming) return false;
  if(MIND_SESS&&Array.isArray(MIND_SESS.sessions)) return !MIND_SESS.sessions.some(x=>x.kind==='priming');
  return !(+(MIND_TODAY?.streak?.priming)||0);
}
// Der Player ist durch: Session SOFORT speichern (POST), damit ein Tipp neben das Sheet
// nichts verliert. Das Sheet ergänzt danach nur noch Ergebnisse/Energie (PUT /session/:id).
async function primingSaveNow(res){
  const first=mindFirstPriming();
  const already=mdIsFull(MIND_TODAY&&MIND_TODAY.priming);
  const before=+(MIND_TODAY?.streak?.priming)||0;
  PRIM_RES={...res,id:null,saved:false,res,streak:before,full:true,rule:null};
  const r=await API.post('/mindset/session',{kind:'priming',date:today(),duration_sec:res.duration_sec,steps_done:res.steps_done,steps_total:res.steps_total||6});
  if(r.status===200||r.status===201){
    // Der Server entscheidet, ob der Durchlauf zaehlt (B16) – Streak und Feier haengen daran
    const full=r.data?.full!==false;
    const streakNow=full&&!already?before+1:before;
    // Die geltende Schwelle kommt mit der Antwort (`rule`) – nur so nennt der Abschlusstext dieselbe
    // Zahl, nach der der Server gerade entschieden hat.
    PRIM_RES.id=r.data?.id??null; PRIM_RES.saved=true; PRIM_RES.full=full; PRIM_RES.streak=streakNow; PRIM_RES.rule=r.data?.rule||null;
    if(!full) toast('Zu kurz – gespeichert, aber heute nicht gezählt');
    else toast('+'+mindXp(r,8)+' XP · Priming erledigt ✓');
    // Konfetti nur beim allerersten Priming und an den Meilensteinen 7 / 30 Tage
    if(full&&first) setTimeout(()=>celebrate('🧠','Erstes Priming!','Dein Tag hat jetzt eine Richtung.'),300);
    else if(full&&!already&&(streakNow===7||streakNow===30)) setTimeout(()=>celebrate('🔥',streakNow+' Tage in Folge!','Priming ist jetzt deine Gewohnheit.'),300);
    if(typeof refreshAchievements==='function') refreshAchievements();
    mindRefresh();
  } else toast(r.data?.error||'Konnte nicht speichern – gleich nochmal versuchen');
  return PRIM_RES;
}
// Freiwilliges Ergebnis-Formular (wird aus dem Abschluss-Zustand des Players geöffnet)
async function primingFinishSheet(res){
  if(!(PRIM_RES&&PRIM_RES.saved&&PRIM_RES.res===res)) await primingSaveNow(res);
  const saved=!!(PRIM_RES&&PRIM_RES.saved), full=!(PRIM_RES&&PRIM_RES.full===false);
  MIND_PICK_ON=id=>{ if(id==='prim_energy') primSaveLabel(); };
  openSheet(full?'Priming erledigt':'Priming übersprungen',`
    <div class="mind-done"><div class="mind-done-ic" aria-hidden="true">🧠</div><div class="mind-done-t">${mMin(res.duration_sec)}${mStepsTxt(res)}</div><div class="mind-done-s">${saved?(full?'Gespeichert. Dein Tag hat jetzt eine Richtung.':'Gespeichert – gezählt wird es heute nicht, dafür war es zu kurz.'):'Noch nicht gespeichert – „Speichern“ versucht es erneut.'}</div></div>
    <div class="section-label">Deine 3 Ergebnisse festhalten (optional)</div>
    <div class="field"><input id="pf_1" maxlength="120" placeholder="Ergebnis 1" aria-label="Ergebnis 1" oninput="primSaveLabel()"></div>
    <div class="field"><input id="pf_2" maxlength="120" placeholder="Ergebnis 2" aria-label="Ergebnis 2" oninput="primSaveLabel()"></div>
    <div class="field"><input id="pf_3" maxlength="120" placeholder="Ergebnis 3" aria-label="Ergebnis 3" oninput="primSaveLabel()"></div>
    <div class="section-label">Energie jetzt (optional)</div>
    ${numChips('prim_energy',null)}
    <button class="btn block mt-4" id="primSaveBtn" onclick="savePriming()">${saved?'Fertig':'Speichern'}</button>
    ${saved?'<button class="btn ghost mt-2" onclick="closeModal()">Ohne Angaben schließen</button>':''}
    <div class="caption center mt-3">${saved?(full?'Dein Priming ist schon gezählt – die Angaben hier sind freiwillig.':mdRuleTxt(PRIM_RES&&PRIM_RES.rule)):'Das Priming konnte noch nicht gespeichert werden – „Speichern“ versucht es erneut.'}</div>`);
  primSaveLabel();
}
// „Fertig“ solange nichts eingetragen ist, „Speichern“ sobald etwas drinsteht
function primSaveLabel(){
  const b=document.getElementById('primSaveBtn'); if(!b) return;
  if(!(PRIM_RES&&PRIM_RES.saved)){ b.textContent='Speichern'; return; }
  const any=['pf_1','pf_2','pf_3'].some(id=>val(id))||!!MIND_PICK.prim_energy;
  b.textContent=any?'Speichern':'Fertig';
}
async function savePriming(){
  if(!PRIM_RES) return closeModal();
  const btn=document.getElementById('primSaveBtn'); if(btn) btn.disabled=true;
  const focus=['pf_1','pf_2','pf_3'].map(id=>val(id)).filter(Boolean).map(x=>x.slice(0,120));
  const energy=MIND_PICK.prim_energy||null;
  if(PRIM_RES.saved&&PRIM_RES.id){
    if(!focus.length&&!energy){ MIND_PICK_ON=null; closeModal(); PRIM_RES=null; return; }
    const patch={}; if(focus.length) patch.focus=focus; if(energy) patch.energy=energy;
    const r=await API.put('/mindset/session/'+PRIM_RES.id,patch);
    if(r.status===200){ MIND_PICK_ON=null; closeModal(); PRIM_RES=null; toast('Angaben gespeichert ✓'); mindRefresh(); }
    else { if(btn) btn.disabled=false; toast(r.data?.error||'Konnte nicht speichern – bitte nochmal versuchen'); }
    return;
  }
  // Rückfall: Erst-Speichern ist fehlgeschlagen -> komplette Session erneut anlegen
  const body={kind:'priming',date:today(),duration_sec:PRIM_RES.duration_sec,steps_done:PRIM_RES.steps_done,steps_total:PRIM_RES.steps_total||6};
  if(focus.length) body.focus=focus;
  if(energy) body.energy=energy;
  const first=mindFirstPriming();
  const r=await API.post('/mindset/session',body);
  if(r.status===200||r.status===201){
    const full=r.data?.full!==false;
    MIND_PICK_ON=null; closeModal(); PRIM_RES=null;
    toast(full?'+'+mindXp(r,8)+' XP · Priming erledigt ✓':'Zu kurz – gespeichert, aber heute nicht gezählt');
    if(full&&first) setTimeout(()=>celebrate('🧠','Erstes Priming!','Dein Tag hat jetzt eine Richtung.'),300);
    if(typeof refreshAchievements==='function') refreshAchievements();
    mindRefresh();
  } else { if(btn) btn.disabled=false; toast(r.data?.error||'Konnte nicht speichern – bitte nochmal versuchen'); }
}
// ===== §5.3 Power-Atmung 1-4-2 =====
function openBreath(){
  if(!mindOwn()){ toast('Nur im eigenen Konto möglich'); return; }
  let mode='standard'; try{ mode=localStorage.getItem('be_breath_mode')||'standard'; }catch(e){}
  const n=MIND_TODAY?.breathCount||0, tgt=MIND_TODAY?.breathTarget||3;
  openSheet('Power-Atmung 1-4-2',`
    <div class="mind-sheet-ic" aria-hidden="true">🌬️</div>
    <div class="note">10 Atemzüge im Verhältnis 1 : 4 : 2 – einatmen, halten, ausatmen. Aufmerksamkeit dabei aufs Herz. Dreimal am Tag, jeweils rund 5–6 Minuten. Heute: <b>${n}/${tgt}</b>.</div>
    <div class="section-label">Tempo</div>
    <div class="chip-row wrap" data-noswipe>
      <button type="button" class="chip${mode==='soft'?' on':''}" aria-pressed="${mode==='soft'}" onclick="breathMode('soft',this)">Sanft · 4 / 16 / 8 s</button>
      <button type="button" class="chip${mode!=='soft'?' on':''}" aria-pressed="${mode!=='soft'}" onclick="breathMode('standard',this)">Standard · 5 / 20 / 10 s</button>
    </div>
    <div class="caption mt-3">Halten fällt schwer? Starte mit „Sanft“ – der Rhythmus zählt, nicht die Sekunden.</div>
    <button class="btn block mt-4" onclick="startBreath()">Los geht’s</button>`);
}
function breathMode(m,btn){
  try{ localStorage.setItem('be_breath_mode',m); }catch(e){}
  const wrap=btn?.parentElement; if(wrap) wrap.querySelectorAll('.chip,.mchip').forEach(b=>{ const on=b===btn; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
}
function startBreath(){
  let mode='standard'; try{ mode=localStorage.getItem('be_breath_mode')||'standard'; }catch(e){}
  const soft=mode==='soft';
  try{ if(typeof closeAllSheets==='function') closeAllSheets(); else closeModal(); }catch(e){}
  mindPlayerOpen({ kind:'breath', title:'Power-Atmung', stepLabel:'Power-Atmung 1-4-2',
    steps:[{ type:'b142', title:'Power-Atmung', cycles:10, inh:soft?4:5, hold:soft?16:20, exh:soft?8:10, text:'Aufmerksamkeit aufs Herz. Ruhig durch die Nase ein, sanft halten, langsam durch den Mund aus.' }],
    abortText:'Atmung abbrechen?', onFinish:saveBreath });
}
async function saveBreath(res){
  const r=await API.post('/mindset/session',{kind:'breath',date:today(),duration_sec:res.duration_sec,steps_done:1,steps_total:1});
  if(r.status===200||r.status===201){
    const n=(MIND_TODAY?.breathCount||0)+1, tgt=MIND_TODAY?.breathTarget||3;
    toast(`+${mindXp(r,2)} XP · Atmung ${Math.min(n,99)}/${tgt} heute ✓`);
    if(typeof refreshAchievements==='function') refreshAchievements();
    mindRefresh();
  } else toast(r.data?.error||'Konnte nicht speichern');
}

// ===== §5.3 State-Change 60 s =====
function openStateChange(){
  if(!mindOwn()){ toast('Nur im eigenen Konto möglich'); return; }
  try{ if(typeof closeAllSheets==='function') closeAllSheets(); else closeModal(); }catch(e){}
  mindPlayerOpen({ kind:'state', title:'State-Change', abortText:'State-Change abbrechen?',
    steps:[
      { type:'timer', title:'Körper', dur:20, text:'Aufstehen. Schultern zurück, Brust raus, Blick nach oben. Zehn kräftige Atemzüge – Energie kommt aus Bewegung.' },
      { type:'timer', title:'Fokus', dur:20, text:'Wofür bist du gerade dankbar? Was ist jetzt möglich? Richte den Blick auf das, was du willst – nicht auf das, was fehlt.' },
      { type:'timer', title:'Sprache', dur:20, text:'Ein kraftvoller Satz – laut oder innerlich, mit Nachdruck. Sag ihn so, dass dein Körper ihn glaubt.' },
    ], onFinish:saveState });
}
async function saveState(res){
  const r=await API.post('/mindset/session',{kind:'state',date:today(),duration_sec:res.duration_sec,steps_done:res.steps_done,steps_total:3});
  if(r.status===200||r.status===201){ toast('+'+mindXp(r,2)+' XP · Zustand gewechselt ⚡'); if(typeof refreshAchievements==='function') refreshAchievements(); mindRefresh(); }
  else toast(r.data?.error||'Konnte nicht speichern');
}

// ===== §5.3 Abend-Reflexion =====
const EVE_PROMPTS=[
  { n:1, icon:'🙏', q:'Wofür bist du heute dankbar?', s:'Drei Dinge – groß oder klein. Spür jedes kurz nach.' },
  { n:2, icon:'📈', q:'Was hast du heute gelernt oder besser gemacht als gestern?', s:'Eine Sache reicht. Fortschritt zählt, nicht Perfektion.' },
  { n:3, icon:'🤝', q:'Wo hast du heute jemandem etwas gegeben?', s:'Zeit, Aufmerksamkeit, ein ehrliches Wort.' },
  { n:4, icon:'🎯', q:'Welche drei Ergebnisse zählen morgen?', s:'Sieh sie kurz vor dir – und lass den Tag los.' },
];
// Wird das Sheet geschlossen (X, Zurück-Geste, Wischen), räumt der Beobachter die Abend-Session auf:
// sonst überlebt EVE samt 30-Sekunden-Timer und vibriert später ohne sichtbaren Anlass.
// „Weiter" wird erst nach MD_EVE_GATE_MS je Frage frei: viermal durchgetippt ergab bisher eine
// Reflexion von einer Sekunde (DB-Zeile id 15). 4 × 12 s = 48 s liegen sicher über der
// Server-Untergrenze von 45 s – wer die Fragen wirklich durchgeht, zählt also immer. (B16)
const MD_EVE_GATE_MS=12000;
function mdEveGateMs(){ return EVE&&EVE.qAt?Math.max(0,MD_EVE_GATE_MS-(Date.now()-EVE.qAt)):0; }
function eveCleanup(){
  if(EVE){ clearTimeout(EVE.timer); clearInterval(EVE.gate); EVE=null; MIND_PICK_ON=null; }
  if(EVE_OBS){ try{ EVE_OBS.disconnect(); }catch(e){} EVE_OBS=null; }
}
function eveWatchClose(){
  if(EVE_OBS){ try{ EVE_OBS.disconnect(); }catch(e){} EVE_OBS=null; }
  const m=document.getElementById('modal'); if(!m||typeof MutationObserver!=='function') return;
  EVE_OBS=new MutationObserver(()=>{ if(!m.classList.contains('on')) eveCleanup(); });
  try{ EVE_OBS.observe(m,{attributes:true,attributeFilter:['class']}); }catch(e){ EVE_OBS=null; }
}
function openEvening(){
  if(!mindOwn()){ toast('Nur im eigenen Konto möglich'); return; }
  eveCleanup();
  EVE={i:0,start:Date.now(),timer:null,id:null,saved:false,saving:false};
  MIND_PICK_ON=id=>{ if(id==='eve_energy'||id==='eve_mood') eveSaveLabel(); };
  eveWatchClose();
  openSheet('Abend-Reflexion','<div class="spinner"></div>');
  eveDraw();
}
// Alle vier Fragen sind durch: Session sofort speichern – Energie/Stimmung/Notiz kommen
// danach per PUT dazu. Schließt jemand das Sheet vorher, ist die Reflexion trotzdem gezählt.
async function eveAutoSave(){
  const E=EVE; if(!E||E.saved||E.saving) return; E.saving=true;
  const dur=Math.max(1,Math.min(7200,Math.round((Date.now()-E.start)/1000)));
  const r=await API.post('/mindset/session',{kind:'evening',date:today(),duration_sec:dur,steps_done:4,steps_total:4});
  E.saving=false;
  if(r.status===200||r.status===201){
    E.id=r.data?.id??null; E.saved=true; E.full=r.data?.full!==false;
    // Eine zweite Reflexion am selben Tag bringt keine XP mehr – dann sagt der Hinweis das auch so.
    // Ein zu kurzer Durchlauf wird gespeichert, zählt aber nicht (B16) und darf nichts anderes behaupten.
    const xp=mindXp(r,5);
    toast(!E.full?'Zu kurz – gespeichert, aber heute nicht gezählt':(xp>0?'+'+xp+' XP · Tag abgerundet 🌙':'Abend-Reflexion schon erledigt ✓'));
    if(typeof refreshAchievements==='function') refreshAchievements();
    const note=document.getElementById('eveSaveNote'); if(note) note.textContent=E.full?'Deine Reflexion ist schon gezählt – die Angaben hier sind freiwillig.':'Gezählt wird sie heute nicht – dafür war sie zu kurz.';
    const b=document.getElementById('eveSaveBtn'); if(b) b.textContent='Fertig';
    const sk=document.getElementById('eveSaveBtn'); if(sk&&!document.getElementById('eveSkipBtn')){
      const g=document.createElement('button'); g.className='btn ghost mt-2'; g.id='eveSkipBtn'; g.textContent='Ohne Angaben schließen';
      g.onclick=()=>closeModal(); sk.insertAdjacentElement('afterend',g);
    }
    eveSaveLabel();
    // Seite hinter dem Sheet auffrischen (Heute-Karte zeigt „erledigt") – auch dann, wenn das
    // Sheet inzwischen geschlossen wurde (EVE ist dann aufgeräumt); nur eine NEUE Reflexion stoppt es
    if(!EVE||EVE===E) mindRefresh();
  } else toast(r.data?.error||'Konnte nicht speichern – „Speichern" versucht es erneut');
}
// Zustand des „Weiter"-Knopfes nachziehen (gesperrt bis zur Freigabe, danach beschriftet)
function mdEveGateDraw(){
  const b=document.getElementById('eveNextBtn'); if(!b||!EVE) return;
  const ms=mdEveGateMs(), sec=Math.ceil(ms/1000);
  const last=EVE.i===EVE_PROMPTS.length-1;
  if(ms>0){ b.disabled=true; b.setAttribute('aria-disabled','true'); b.textContent=`Noch ${sec} ${sec===1?'Sekunde':'Sekunden'}`; }
  else { b.disabled=false; b.removeAttribute('aria-disabled'); b.textContent=last?'Abschließen':'Weiter'; clearInterval(EVE.gate); EVE.gate=null; }
}
function eveDraw(){
  if(!EVE) return;
  clearTimeout(EVE.timer); clearInterval(EVE.gate); EVE.gate=null;
  const E=EVE;
  if(EVE.i<EVE_PROMPTS.length){
    const p=EVE_PROMPTS[EVE.i];
    const ok=mindSheetBody(`
      <div class="mind-dots" aria-label="Schritt ${p.n} von ${EVE_PROMPTS.length}">${EVE_PROMPTS.map((x,i)=>`<span class="${i<EVE.i?'done':i===EVE.i?'on':''}"></span>`).join('')}</div>
      <div class="eve-card">
        <div class="eve-ic" aria-hidden="true">${p.icon}</div>
        <div class="eve-q">${esc2(p.q)}</div>
        <div class="eve-s">${esc2(p.s)}</div>
        <div class="soft-bar" aria-hidden="true"><div id="eveBar"></div></div>
        <div class="eve-hint">Nur denken, nichts tippen · ~30 Sekunden</div>
      </div>
      <button class="btn block" id="eveNextBtn" onclick="eveNext()" disabled>Noch ${Math.round(MD_EVE_GATE_MS/1000)} Sekunden</button>`,'Abend-Reflexion');
    if(!ok) return;
    EVE.qAt=Date.now();
    mdEveGateDraw();
    EVE.gate=setInterval(()=>{ if(EVE===E&&document.getElementById('eveNextBtn')) mdEveGateDraw(); else { clearInterval(E.gate); E.gate=null; } },250);
    setTimeout(()=>{ const bar=document.getElementById('eveBar'); if(bar){ if(mReducedMotion()){ bar.style.transition='none'; bar.style.width='100%'; } else { void bar.offsetWidth; bar.style.width='100%'; } } },40);
    // Sanfter Impuls nach 30 s – nur, wenn genau DIESE Reflexion noch offen im sichtbaren Sheet steht.
    // (closeModal() räumt das Markup nicht weg, deshalb reicht die Prüfung auf #eveBar allein nicht.)
    EVE.timer=setTimeout(()=>{
      const m=document.getElementById('modal');
      if(EVE===E&&m&&m.classList.contains('on')&&document.getElementById('eveBar')) mindVibrate(60);
    },30000);
  } else {
    const saved=EVE.saved;
    mindSheetBody(`
      <div class="note">Fast fertig. Wie geht es dir gerade? (optional)</div>
      <div class="section-label">Energie</div>${numChips('eve_energy',null)}
      <div class="section-label">Stimmung</div>${numChips('eve_mood',null)}
      <div class="field mt-4"><label for="eve_note">Notiz (optional)</label><textarea id="eve_note" rows="2" maxlength="500" placeholder="Ein Gedanke, den du mitnehmen willst" oninput="eveSaveLabel()"></textarea></div>
      <button class="btn block mt-4" id="eveSaveBtn" onclick="saveEvening()">${saved?'Fertig':'Speichern'}</button>
      ${saved?'<button class="btn ghost mt-2" id="eveSkipBtn" onclick="closeModal()">Ohne Angaben schließen</button>':''}
      <div id="eveSaveNote" class="caption center mt-3">${saved?'Deine Reflexion ist schon gezählt – die Angaben hier sind freiwillig.':'Deine Reflexion wird gerade gespeichert …'}</div>`,'Abend-Reflexion');
    if(!saved) eveAutoSave();
  }
}
// „Fertig“ solange nichts eingetragen ist, „Speichern“ sobald etwas drinsteht
function eveSaveLabel(){
  const b=document.getElementById('eveSaveBtn'); if(!b) return;
  if(!(EVE&&EVE.saved)){ b.textContent='Speichern'; return; }
  const any=!!MIND_PICK.eve_energy||!!MIND_PICK.eve_mood||!!val('eve_note');
  b.textContent=any?'Speichern':'Fertig';
}
function eveNext(){ if(!EVE) return; if(mdEveGateMs()>0){ mdEveGateDraw(); return; } EVE.i++; eveDraw(); }
async function saveEvening(){
  if(!EVE) return closeModal();
  const btn=document.getElementById('eveSaveBtn'); if(btn) btn.disabled=true;
  const patch={};
  if(MIND_PICK.eve_energy) patch.energy=MIND_PICK.eve_energy;
  if(MIND_PICK.eve_mood) patch.mood=MIND_PICK.eve_mood;
  const note=val('eve_note'); if(note) patch.note=note.slice(0,500);
  if(EVE.saved&&EVE.id){
    if(!Object.keys(patch).length){ MIND_PICK_ON=null; closeModal(); EVE=null; return; }
    const r=await API.put('/mindset/session/'+EVE.id,patch);
    if(r.status===200){ MIND_PICK_ON=null; closeModal(); EVE=null; toast('Angaben gespeichert ✓'); mindRefresh(); }
    else { if(btn) btn.disabled=false; toast(r.data?.error||'Konnte nicht speichern'); }
    return;
  }
  if(EVE.saving){ if(btn) btn.disabled=false; return toast('Einen Moment – wird gerade gespeichert'); }
  // Rückfall: Sofort-Speichern ist fehlgeschlagen -> komplette Session anlegen
  const dur=Math.max(1,Math.min(7200,Math.round((Date.now()-EVE.start)/1000)));
  const body={kind:'evening',date:today(),duration_sec:dur,steps_done:4,steps_total:4,...patch};
  const r=await API.post('/mindset/session',body);
  if(r.status===200||r.status===201){ const full=r.data?.full!==false; MIND_PICK_ON=null; closeModal(); EVE=null; const xp=mindXp(r,5); toast(!full?'Zu kurz – gespeichert, aber heute nicht gezählt':(xp>0?'+'+xp+' XP · Tag abgerundet 🌙':'Abend-Reflexion schon erledigt ✓')); if(typeof refreshAchievements==='function') refreshAchievements(); mindRefresh(); }
  else { if(btn) btn.disabled=false; toast(r.data?.error||'Konnte nicht speichern'); }
}

// ===== §5.1 (6) Emotionaler Wochencheck =====
function openWeeklyCheck(){
  if(!mindOwn()){ toast('Nur im eigenen Konto möglich'); return; }
  WEEKLY={step:1,strong:new Set(),weak:new Set(),customStrong:[],customWeak:[],targets:new Set()};
  openSheet('Emotionaler Wochencheck','<div class="spinner"></div>');
  weeklyDraw();
}
function weeklyChip(list,kind){
  return list.map(e=>{ const on=WEEKLY[kind].has(e); return `<button type="button" class="mchip${on?' on':''}" aria-pressed="${on}" onclick="weeklyToggle('${kind}','${esc(e)}',this)">${esc2(e)}</button>`; }).join('');
}
function weeklyDraw(){
  if(!WEEKLY) return;
  if(WEEKLY.step===1){
    mindSheetBody(`
      <div class="note">Deine gewohnten Gefühle sind dein emotionales Zuhause. Welche Emotionen hast du diese Woche mindestens einmal gefühlt?</div>
      <div class="section-label tone-green">Stärkend</div>
      <div class="mind-chips" data-noswipe>${weeklyChip([...MIND_EMO_STRONG,...WEEKLY.customStrong],'strong')}</div>
      <div class="section-label tone-red">Schwächend</div>
      <div class="mind-chips" data-noswipe>${weeklyChip([...MIND_EMO_WEAK,...WEEKLY.customWeak],'weak')}</div>
      <div class="field mt-4"><label for="wk_custom">Eigene Emotion</label>
        <div class="cluster"><input id="wk_custom" class="fill" maxlength="40" placeholder="z.B. Gelassenheit">
        <button type="button" class="btn sm sec" onclick="weeklyAddCustom('strong')">+ stärkend</button><button type="button" class="btn sm sec" onclick="weeklyAddCustom('weak')">+ schwächend</button></div></div>
      <div class="between meta mind-wkcount"><span>Stärkend: <b class="tone-green" id="wkStrongN">${WEEKLY.strong.size}</b></span><span>Schwächend: <b class="tone-red" id="wkWeakN">${WEEKLY.weak.size}</b></span></div>
      <button class="btn block mt-4" onclick="weeklyStep(2)">Weiter</button>`,'Emotionaler Wochencheck');
  } else {
    const pool=[...MIND_EMO_STRONG,...WEEKLY.customStrong];
    const ready=WEEKLY.targets.size===2;
    mindSheetBody(`
      <div class="note">Welche <b>2 Emotionen</b> willst du in der nächsten Woche bewusst jeden Tag leben?</div>
      <div class="mind-chips" data-noswipe>${weeklyChip(pool,'targets')}</div>
      <div class="caption mt-3" id="wkTargetCount">${WEEKLY.targets.size}/2 gewählt</div>
      <div class="cluster mt-4"><button class="btn sec inline" onclick="weeklyStep(1)">Zurück</button><button class="btn inline fill" id="wkSaveBtn" ${ready?'':'disabled'} onclick="saveWeekly()">${ready?'Speichern':'2 Emotionen wählen'}</button></div>`,'Emotionaler Wochencheck');
  }
}
// Auswahl in place umschalten: das Eingabefeld für eigene Emotionen bleibt erhalten
function weeklyToggle(kind,e,btn){
  if(!WEEKLY) return; const set=WEEKLY[kind];
  if(set.has(e)) set.delete(e); else { if(kind==='targets'&&set.size>=2){ toast('Genau zwei Emotionen wählen'); return; } set.add(e); }
  const on=set.has(e); btn.classList.toggle('on',on); btn.setAttribute('aria-pressed',on?'true':'false');
  weeklyCounts();
}
// Zähler und Speichern-Schaltfläche nachziehen (ohne das Sheet neu zu bauen)
function weeklyCounts(){
  if(!WEEKLY) return;
  const sn=document.getElementById('wkStrongN'); if(sn) sn.textContent=WEEKLY.strong.size;
  const wn=document.getElementById('wkWeakN'); if(wn) wn.textContent=WEEKLY.weak.size;
  const tc=document.getElementById('wkTargetCount'); if(tc) tc.textContent=`${WEEKLY.targets.size}/2 gewählt`;
  const sb=document.getElementById('wkSaveBtn');
  if(sb){ const ready=WEEKLY.targets.size===2; sb.disabled=!ready; sb.textContent=ready?'Speichern':'2 Emotionen wählen'; }
}
function weeklyAddCustom(kind){
  if(!WEEKLY) return; const t=val('wk_custom').slice(0,40); if(!t) return toast('Bitte eine Emotion eingeben');
  const list=kind==='strong'?WEEKLY.customStrong:WEEKLY.customWeak;
  if(list.length>=6) return toast('Maximal 6 eigene Einträge');
  if(!list.includes(t)) list.push(t); WEEKLY[kind].add(t); weeklyDraw();
}
function weeklyStep(s){ if(!WEEKLY) return; if(s===2&&WEEKLY.strong.size+WEEKLY.weak.size===0) return toast('Wähle mindestens eine Emotion'); WEEKLY.step=s; weeklyDraw(); }
async function saveWeekly(){
  if(mindRoGuard()) return;
  if(!WEEKLY) return; if(WEEKLY.targets.size!==2) return toast('Wähle genau zwei Emotionen für nächste Woche');
  const btn=document.getElementById('wkSaveBtn'); if(btn) btn.disabled=true;
  const cut=s=>[...s].slice(0,12).map(x=>String(x).slice(0,40));
  const r=await API.post('/mindset/session',{kind:'weekly',date:today(),data:{strong:cut(WEEKLY.strong),weak:cut(WEEKLY.weak),targets:cut(WEEKLY.targets).slice(0,2)}});
  if(r.status===200||r.status===201){ closeModal(); WEEKLY=null; toast('+'+mindXp(r,5)+' XP · Wochencheck gespeichert ✓'); if(typeof refreshAchievements==='function') refreshAchievements(); mindRefresh(); }
  else { if(btn) btn.disabled=false; toast(r.data?.error||'Konnte nicht speichern'); }
}

// =====================================================================
// TAB RAD (Wheel of Life)
// =====================================================================
function wheelStats(scores){
  const vals=WHEEL_AREAS.map(a=>+scores?.[a.key]||0);
  const avg=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length), min=Math.min(...vals), max=Math.max(...vals);
  let weakest=WHEEL_AREAS[0].key, wv=Infinity; WHEEL_AREAS.forEach(a=>{ const v=+scores?.[a.key]||0; if(v<wv){ wv=v; weakest=a.key; } });
  return { avg, min, max, balance:Math.round(100-(max-min)), weakest };
}
function wheelRadarSVG(scores,targets,opts){
  opts=opts||{}; const W=440,H=340,cx=220,cy=172,R=108,n=WHEEL_AREAS.length;
  const ang=i=>-Math.PI/2+i*2*Math.PI/n;
  const pt=(i,v)=>[cx+Math.cos(ang(i))*R*(Math.max(0,Math.min(100,v))/100),cy+Math.sin(ang(i))*R*(Math.max(0,Math.min(100,v))/100)];
  const poly=v=>WHEEL_AREAS.map((a,i)=>{ const p=pt(i,typeof v==='number'?v:(+v?.[a.key]||0)); return p[0].toFixed(1)+','+p[1].toFixed(1); }).join(' ');
  let rings=[20,40,60,80,100].map(v=>`<polygon points="${poly(v)}" fill="none" stroke="var(--line)" stroke-width="${v===100?1.2:0.7}"/>`).join('');
  let spokes=WHEEL_AREAS.map((a,i)=>{ const p=pt(i,100); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="var(--line)" stroke-width="0.7"/>`; }).join('');
  const tgt=targets?`<polygon points="${poly(targets)}" fill="none" stroke="var(--green)" stroke-width="1.6" stroke-dasharray="5 4" opacity=".9"/>`:'';
  const main=`<polygon points="${poly(scores)}" fill="var(--red)" fill-opacity=".35" stroke="var(--red)" stroke-width="2" stroke-linejoin="round"/>`;
  const dots=WHEEL_AREAS.map((a,i)=>{ const p=pt(i,+scores?.[a.key]||0); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${a.color}" stroke="var(--surface)" stroke-width="1.5"/>`; }).join('');
  const labels=WHEEL_AREAS.map((a,i)=>{ const c=Math.cos(ang(i)),s=Math.sin(ang(i)); const x=cx+c*(R+28), y=cy+s*(R+28);
    const anchor=c>0.3?'start':c<-0.3?'end':'middle'; const v=+scores?.[a.key]||0;
    return `<text x="${x.toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="var(--ink2)">${a.icon} ${esc2(a.short)}</text>
      <text x="${x.toFixed(1)}" y="${(y+11).toFixed(1)}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="${a.color}">${v}${targets&&targets[a.key]!=null?`<tspan font-weight="400" fill="var(--ink3)"> → ${+targets[a.key]||0}</tspan>`:''}</text>`; }).join('');
  return `<svg class="wheel-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${mAttr(opts.aria||'Rad des Lebens')}" style="${mAttr(opts.style||'')}">${rings}${spokes}${tgt}${main}${dots}${labels}</svg>`;
}
// Erst ab drei Bewertungen sinnvoll – und auf den tatsächlichen Wertebereich (±5) skaliert,
// sonst sieht jede Kurve flach aus.
function miniSpark(vals,color){
  const v=(vals||[]).filter(x=>x!=null); if(v.length<3) return '<span class="mind-spark-empty">–</span>';
  const w=60,h=18;
  let mn=Math.max(0,Math.min(...v)-5), mx=Math.min(100,Math.max(...v)+5);
  if(mx-mn<10) mx=Math.min(100,mn+10);
  if(mx-mn<10) mn=Math.max(0,mx-10);
  const pts=v.map((x,i)=>`${(i*(w-4)/(v.length-1)+2).toFixed(1)},${(h-2-((x-mn)/(mx-mn||1))*(h-4)).toFixed(1)}`).join(' ');
  return `<svg class="mind-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function deltaPill(d){ if(d==null||isNaN(d)) return ''; if(d>0) return `<span class="delta up">▲ +${d}</span>`; if(d<0) return `<span class="delta down">▼ −${Math.abs(d)}</span>`; return `<span class="delta flat">±0</span>`; }
function wheelArea(key){ return WHEEL_AREAS.find(a=>a.key===key)||null; }
async function drawMindWheel(){
  const box=document.getElementById('mindBody'); if(!box) return;
  const tok=++MIND_TOK; const ld=mindLoadStart();
  let data=(MIND_WHEEL&&mindFresh(MIND_WHEEL_TS))?MIND_WHEEL:null;
  if(!data){
    const r=await API.get('/mindset/wheel/'+VIEW_USER);
    if(tok!==MIND_TOK){ mindLoadCancel(ld); return; }
    if(r.status!==200||!r.data){ mindLoadEnd(ld); const bb=document.getElementById('mindBody'); if(bb) bb.innerHTML=mindEmpty('target','Rad gerade nicht erreichbar',r.data?.error||'Prüfe deine Verbindung und versuche es gleich noch einmal.',"mindsetTab('wheel')",'Erneut laden'); return; }
    data=r.data; MIND_WHEEL=data; MIND_WHEEL_TS=Date.now();
  }
  if(tok!==MIND_TOK){ mindLoadCancel(ld); return; } const b=document.getElementById('mindBody'); if(!b) return; mindLoadEnd(ld);
  const own=mindOwn();
  const list=(data.assessments||[]).map(a=>({...a,scores:mParse(a.scores,{})||{},targets:mParse(a.targets,null),actions:mParse(a.actions,[])||[]}));
  const series=data.series||{}, avgSeries=data.avgSeries||[];
  if(!list.length){
    b.innerHTML=`<div class="card center mind-intro">
      <div class="mind-intro-ic" aria-hidden="true">🎡</div>
      <div class="h2 mt-2">Rad des Lebens</div>
      <div class="body muted mt-2 mb-4">Sieben Lebensbereiche, ehrlich bewertet von 0 bis 100. Ein rundes Rad rollt – ein eckiges holpert. In zwei Minuten siehst du, wo du stehst und wo die größte Lücke ist.</div>
      ${own?'<button class="btn block" onclick="openWheelNew()">Jetzt bewerten</button>':'<div class="caption">Noch keine Bewertung vorhanden.</div>'}
    </div>
    ${mindRoNote('mb-3')}
    <div class="section-label">Die 7 Bereiche</div><div class="rows">${WHEEL_AREAS.map(a=>`<div class="row"><div class="r-ic mind-area-ic" aria-hidden="true">${a.icon}</div><div class="rl">${esc2(a.label)}<small>${esc2(WHEEL_DESC[a.key])}</small></div></div>`).join('')}</div>`;
    mindCacheView();
    return;
  }
  const last=list[0], prev=list[1]||null;
  const st={avg:last.avg??wheelStats(last.scores).avg,balance:last.balance??wheelStats(last.scores).balance,weakest:last.weakest||wheelStats(last.scores).weakest};
  const wk=wheelArea(st.weakest);
  let html=mindRoNote('mb-3')+`<div class="card mb-3">
    <div class="ch-h"><div class="t">Dein Rad</div><div class="v">${mDateDE(last.date,{day:'numeric',month:'long',year:'numeric'})}</div></div>
    ${wheelRadarSVG(last.scores,last.targets,{aria:'Rad des Lebens vom '+last.date})}
    ${last.targets?'<div class="caption center">— Ist &nbsp;·&nbsp; <span class="tone-green">- - Ziel</span></div>':''}
  </div>
  <div class="tiles grid-3">
    <div class="tile"><div class="v">${st.avg}</div><div class="l">Ø</div></div>
    <div class="tile"><div class="v">${st.balance}</div><div class="l">Balance</div></div>
    <div class="tile"><div class="v mind-tile-em">${wk?wk.icon+' '+esc2(wk.short):'–'}</div><div class="l">Schwächster</div></div>
  </div>
  ${own?'<button class="btn block" onclick="openWheelNew()">Neu bewerten</button>':''}`;

  // Entwicklung
  html+=`<div class="section-label">Entwicklung</div><div class="chart-card">
    <div class="ch-h"><div class="t">Ø aller Bereiche</div><div class="v">${pl(list.length,'Bewertung','Bewertungen')}</div></div>
    ${metricChart(avgSeries,'Ø',null,null,{step:5,tickFmt:v=>fmtNum(v,0)})}
  </div>
  <div class="rows mb-4">${WHEEL_AREAS.map(a=>{ const v=+last.scores[a.key]||0; const d=prev?v-(+prev.scores[a.key]||0):null; const ser=(series[a.key]||[]).map(x=>x.value);
    return `<div class="row"><div class="r-ic mind-area-ic" aria-hidden="true">${a.icon}</div><div class="rl">${esc2(a.label)}<small>${deltaPill(d)||'<span class="muted-2">erste Bewertung</span>'}</small></div>
      <div class="rr">${miniSpark(ser,a.color)}<b class="mind-area-v" style="color:${a.color}">${v}</b></div></div>`; }).join('')}</div>`;

  // Lücke schließen
  const fa=wheelArea(last.focus_area), sa=wheelArea(last.second_area);
  if(fa||last.actions.length||last.feeling_now||last.feeling_target){
    html+=`<div class="section-label">Lücke schließen</div><div class="card mb-4">
      ${fa?`<div class="cluster mb-3"><span class="mind-focus-ic" aria-hidden="true">${fa.icon}</span><div><div class="h3">${esc2(fa.label)}</div><div class="meta">Fokusbereich · ${+last.scores[fa.key]||0}${last.targets?' → '+(+last.targets[fa.key]||0):''}</div></div></div>`:''}
      ${wheelActionsHTML(last,own)}
      ${sa?`<div class="meta mt-2">Danach: ${sa.icon} ${esc2(sa.label)}</div>`:''}
      ${own&&last.feeling_now?`<div class="mind-quote"><b>Jetzt:</b> ${esc2(last.feeling_now)}</div>`:''}
      ${own&&last.feeling_target?`<div class="mind-quote"><b>Außergewöhnlich:</b> ${esc2(last.feeling_target)}</div>`:''}
      ${own?`<button class="btn sm sec mt-3" onclick="openWheelNew(${+last.id||0})">Bearbeiten</button>`:''}
    </div>`;
  } else if(own){
    html+=`<div class="section-label">Lücke schließen</div><div class="card mb-4 between"><div class="meta">Noch kein Fokusbereich gewählt.</div><button class="btn sm sec" onclick="openWheelNew(${+last.id||0})">Festlegen</button></div>`;
  }
  // Verlauf-Liste
  html+=`<div class="section-label">Verlauf</div><div class="rows" role="group" aria-label="Verlauf der Rad-des-Lebens-Auswertungen">${list.map(a=>{ const w=wheelStats(a.scores); return `<div class="row tap" role="button" tabindex="0" onclick="openWheelDetail(${+a.id||0})"><div class="rl">${mDateDE(a.date,{day:'numeric',month:'long',year:'numeric'})}<small>Ø ${a.avg??w.avg} · Balance ${a.balance??w.balance}</small></div><div class="rr"></div></div>`; }).join('')}</div>`;
  b.innerHTML=html;
  mindCacheView();
}
// Die 3 Maßnahmen aus dem Rad zum Abhaken. Ohne das blieben sie eine Liste, die nie
// jemand wieder anfasst – erledigt/offen ist genau das, was man beim nächsten Rad sehen will.
function wheelActionsHTML(a,own){
  const acts=mParse(a.actions,[])||[]; if(!acts.length) return '';
  const done=new Set((mParse(a.actions_done,[])||[]).map(Number));
  const id=+a.id||0;
  const rows=acts.map((x,i)=>{const on=done.has(i);
    return `<div class="row${own?' h-tap':''}"${own?` role="button" tabindex="0" aria-pressed="${on?'true':'false'}" onclick="toggleWheelAction(${id},${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"`:''}>
      <div class="r-ic${on?' tone-green':''}">${icon(on?'check':'target',20)}</div>
      <div class="rl${on?' done':''}">${esc2(x)}</div></div>`;}).join('');
  return `<div class="rows mind-actions-rows">${rows}</div>
    <div class="caption mt-1">${done.size}/${acts.length} umgesetzt${own?' · tippen zum Abhaken':''}</div>`;}
async function toggleWheelAction(id,idx){
  if(mindRoGuard()) return;
  const a=(MIND_WHEEL?.assessments||[]).find(x=>+x.id===+id); if(!a) return;
  const before=(mParse(a.actions_done,[])||[]).map(Number);
  const cur=new Set(before); const nowOn=!cur.has(idx);
  nowOn?cur.add(idx):cur.delete(idx);
  const done=[...cur].sort((x,y)=>x-y);
  a.actions_done=done; // sofort sichtbar, danach speichern
  if(document.getElementById('mindBody'))drawMindWheel();
  const r=await API.put('/mindset/wheel/'+id+'/actions',{done});
  if(r.status!==200){a.actions_done=before;toast(r.data?.error||'Konnte nicht speichern');if(document.getElementById('mindBody'))drawMindWheel();return;}
  if(nowOn)toast('Erledigt ✓');}

function openWheelDetail(id){
  const a=(MIND_WHEEL?.assessments||[]).find(x=>x.id===id); if(!a) return;
  const own=mindOwn();
  const scores=mParse(a.scores,{})||{}, targets=mParse(a.targets,null), actions=mParse(a.actions,[])||[];
  const w=wheelStats(scores); const fa=wheelArea(a.focus_area);
  // Titel geht durch openSheet (esc2) – deshalb hier das rohe Datum formatieren, nicht mDateDE (bereits maskiert)
  let title=''; try{ const d=new Date(String(a.date)+'T00:00'); title=isNaN(d)?String(a.date||''):d.toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ title=String(a.date||''); }
  openSheet(title,`
    ${wheelRadarSVG(scores,targets,{aria:'Rad vom '+a.date})}
    <div class="tiles grid-3 mt-2"><div class="tile"><div class="v">${a.avg??w.avg}</div><div class="l">Ø</div></div><div class="tile"><div class="v">${a.balance??w.balance}</div><div class="l">Balance</div></div><div class="tile"><div class="v mind-tile-em">${(()=>{const x=wheelArea(a.weakest||w.weakest);return x?x.icon+' '+esc2(x.short):'–';})()}</div><div class="l">Schwächster</div></div></div>
    ${fa?`<div class="note"><b>Fokus:</b> ${fa.icon} ${esc2(fa.label)}</div>`:''}
    ${actions.length?`<div class="section-label">Maßnahmen</div>${wheelActionsHTML(a,own)}`:''}
    ${own&&a.feeling_now?`<div class="mind-quote"><b>Jetzt:</b> ${esc2(a.feeling_now)}</div>`:''}
    ${own&&a.feeling_target?`<div class="mind-quote"><b>Außergewöhnlich:</b> ${esc2(a.feeling_target)}</div>`:''}
    ${own&&a.note?`<div class="mind-quote">${esc2(a.note)}</div>`:''}
    ${own?`<button class="btn block sec mt-3" onclick="closeAllSheets();openWheelNew(${+a.id||0})">Bearbeiten</button><button class="btn block danger mt-2" onclick="deleteWheel(${+a.id||0})">Bewertung löschen</button>`:''}`);
}
function deleteWheel(id){
  confirmSheet('Bewertung löschen','Diese Bewertung wirklich löschen? Der Verlauf verliert diesen Punkt.',{label:'Löschen',danger:true,onYes:()=>deleteWheelDo(id)});
}
async function deleteWheelDo(id){
  if(mindRoGuard()) return;
  const r=await API.del('/mindset/wheel/'+id);
  if(r.status===200){ if(typeof closeAllSheets==='function') closeAllSheets(); else closeModal(); toast('Gelöscht'); mindCacheClear(); drawMindWheel(); }
  else toast(r.data?.error||'Konnte nicht löschen');
}
// Beim Aktualisieren einer bestehenden Bewertung: Felder, die das Formular leer gelassen hat, nicht löschen
function wheelMergeExisting(body,ex){
  if(!body.focus_area&&ex.focus_area) body.focus_area=ex.focus_area;
  if(!body.second_area&&ex.second_area) body.second_area=ex.second_area;
  if(!body.actions){ const a=mParse(ex.actions,[])||[]; if(a.length) body.actions=a; }
  if(!body.targets&&ex.targets){ const t=mParse(ex.targets,null); if(t) body.targets=t; }
  if(!body.feeling_now&&ex.feeling_now) body.feeling_now=ex.feeling_now;
  if(!body.feeling_target&&ex.feeling_target) body.feeling_target=ex.feeling_target;
}
// --- Rad-Formular (3 Schritte) ---
function openWheelNew(editId){
  if(!mindOwn()){ toast('Nur im eigenen Konto möglich'); return; }
  // Gibt es heute schon eine Bewertung, wird sie bearbeitet – kein zweites Rad, und der Maßnahmenplan bleibt erhalten
  if(!editId){ const sameDay=(MIND_WHEEL?.assessments||[]).find(x=>x.date===today()); if(sameDay) editId=+sameDay.id||null; }
  const base=(editId&&MIND_WHEEL?.assessments||[]).find(x=>+x.id===+editId)||null;
  // Vorbelegung: beim Bearbeiten die Werte der Bewertung, sonst die letzte bekannte Bewertung
  // (Rad-Cache zuerst – der Heute-Cache kann nach dem Speichern leer sein)
  const lastSrc=base||MIND_WHEEL?.assessments?.[0]||MIND_TODAY?.wheel?.last||null;
  const lastScores=lastSrc?.scores?(mParse(lastSrc.scores,{})||{}):null;
  const scores={}; WHEEL_AREAS.forEach(a=>{ scores[a.key]=lastScores&&lastScores[a.key]!=null?Math.max(0,Math.min(100,Math.round((+lastScores[a.key]||0)/5)*5)):50; });
  const bt=base?mParse(base.targets,null):null; const targets={}; WHEEL_AREAS.forEach(a=>{ targets[a.key]=bt&&bt[a.key]!=null?Math.max(0,Math.min(100,+bt[a.key]||0)):Math.max(scores[a.key],80); });
  WHEEL_FORM={step:1,scores,targets,useTargets:true,focus_area:base?.focus_area||null,second_area:base?.second_area||null,actions:base?(mParse(base.actions,[])||[]).slice(0,3):[],feeling_now:base?.feeling_now||'',feeling_target:base?.feeling_target||'',edit:!!base,editId:base?(+base.id||null):null,editDate:base?.date||null,busy:false};
  openSheet('Rad des Lebens','<div class="spinner"></div>');
  wheelFormDraw();
}
function wheelSliderRow(a,val,which){
  return `<div class="wheel-row">
    <div class="wheel-row-h"><label for="ws_${which}_${a.key}"><span class="wheel-row-ic" aria-hidden="true">${a.icon}</span>${esc2(a.label)}</label><b id="wv_${which}_${a.key}" style="color:${a.color}">${val}</b></div>
    <input type="range" class="wheel-slider" id="ws_${which}_${a.key}" min="0" max="100" step="5" value="${val}" style="--c:${a.color};--pct:${val}%" aria-label="${mAttr(a.label)}" aria-valuetext="${val} von 100" oninput="wheelSet('${which}','${a.key}',this.value,this)">
    <div class="wheel-row-d">${esc2(WHEEL_DESC[a.key])}</div>
  </div>`;
}
function wheelSet(which,key,v,el){
  if(!WHEEL_FORM) return; v=Math.max(0,Math.min(100,Math.round((+v||0)/5)*5));
  (which==='t'?WHEEL_FORM.targets:WHEEL_FORM.scores)[key]=v;
  const lbl=document.getElementById('wv_'+which+'_'+key); if(lbl) lbl.textContent=v;
  if(el){ el.style.setProperty('--pct',v+'%'); el.setAttribute('aria-valuetext',v+' von 100'); }
  const live=document.getElementById('wheelLive'); if(live&&which==='s'){ const s=wheelStats(WHEEL_FORM.scores); live.textContent=`Ø ${s.avg} · Balance ${s.balance}`; }
}
function wheelFormDraw(){
  if(!WHEEL_FORM) return;
  const F=WHEEL_FORM; const st=wheelStats(F.scores);
  const head=`<div class="mind-dots" aria-label="Schritt ${F.step} von 3">${[1,2,3].map(i=>`<span class="${i<F.step?'done':i===F.step?'on':''}"></span>`).join('')}</div>
    <div class="h2 mind-step-h">${F.step===1?'Wo stehst du gerade?':F.step===2?'Wo möchtest du sein?':'Die Lücke schließen'}</div>`;
  if(F.step===1){
    mindSheetBody(head+`
      <div class="note">Bewerte jeden Bereich ehrlich von 0 bis 100 – nicht wie es sein sollte, sondern wie es <b>gerade</b> ist.</div>
      <div class="mind-live" id="wheelLive">Ø ${st.avg} · Balance ${st.balance}</div>
      ${WHEEL_AREAS.map(a=>wheelSliderRow(a,F.scores[a.key],'s')).join('')}
      <button class="btn block mt-3" onclick="wheelStep(2)">Weiter</button>`,'Rad des Lebens');
  } else if(F.step===2){
    mindSheetBody(head+`
      <div class="note">Wo willst du in jedem Bereich hin? Die Ziele erscheinen als gestrichelte Linie in deinem Rad. Du kannst diesen Schritt auch überspringen.</div>
      ${WHEEL_AREAS.map(a=>wheelSliderRow(a,F.targets[a.key],'t')).join('')}
      <div class="cluster mt-3"><button class="btn sec inline" onclick="wheelStep(1)">Zurück</button><button class="btn inline fill" onclick="WHEEL_FORM.useTargets=true;wheelStep(3)">Weiter</button></div>
      <button class="btn ghost mt-2" onclick="WHEEL_FORM.useTargets=false;wheelStep(3)">Überspringen</button>`,'Rad des Lebens');
  } else {
    const chips=(sel,fn)=>`<div class="mind-chips" data-noswipe>${WHEEL_AREAS.map(a=>`<button type="button" class="mchip${sel===a.key?' on':''}" aria-pressed="${sel===a.key}" onclick="${fn}('${a.key}')">${a.icon} ${esc2(a.short)} <span class="muted-2">${F.scores[a.key]}</span></button>`).join('')}</div>`;
    const wk=wheelArea(st.weakest);
    mindSheetBody(head+`
      <div class="note">Welcher Bereich bringt am meisten, wenn du ihn <b>zuerst</b> anpackst? ${wk?`Dein schwächster ist gerade ${wk.icon} ${esc2(wk.short)} (${F.scores[wk.key]}).`:''}</div>
      <div class="section-label">Fokusbereich</div>${chips(F.focus_area,'wheelFocus')}
      <div class="section-label">3 Maßnahmen, die die Lücke schließen</div>
      ${[0,1,2].map(i=>`<div class="field"><input id="wa_${i}" maxlength="160" value="${mAttr(F.actions[i]||'')}" placeholder="Maßnahme ${i+1}" aria-label="Maßnahme ${i+1}"></div>`).join('')}
      <div class="section-label">Zweiter Bereich (danach)</div>${chips(F.second_area,'wheelSecond')}
      <div class="field mt-4"><label for="wf_now">So fühlt sich mein Leben gerade an (optional)</label><textarea id="wf_now" rows="2" maxlength="500">${esc2(F.feeling_now)}</textarea></div>
      <div class="field"><label for="wf_target">So fühlt sich mein außergewöhnliches Leben an (optional)</label><textarea id="wf_target" rows="2" maxlength="500">${esc2(F.feeling_target)}</textarea></div>
      <div class="cluster mt-3"><button class="btn sec inline" onclick="wheelCollect();wheelStep(2)">Zurück</button><button class="btn inline fill" id="wheelSaveBtn" onclick="saveWheel()">${F.edit?'Änderungen speichern':'Speichern'}</button></div>`,'Rad des Lebens');
  }
}
function wheelCollect(){ if(!WHEEL_FORM) return; if(document.getElementById('wa_0')){ WHEEL_FORM.actions=[0,1,2].map(i=>val('wa_'+i).slice(0,160)); WHEEL_FORM.feeling_now=val('wf_now').slice(0,500); WHEEL_FORM.feeling_target=val('wf_target').slice(0,500); } }
function wheelStep(s){ if(!WHEEL_FORM) return; WHEEL_FORM.step=s; wheelFormDraw(); }
function wheelFocus(k){ if(!WHEEL_FORM) return; wheelCollect(); WHEEL_FORM.focus_area=WHEEL_FORM.focus_area===k?null:k; if(WHEEL_FORM.second_area===WHEEL_FORM.focus_area) WHEEL_FORM.second_area=null; wheelFormDraw(); }
function wheelSecond(k){ if(!WHEEL_FORM) return; wheelCollect(); WHEEL_FORM.second_area=WHEEL_FORM.second_area===k?null:k; if(WHEEL_FORM.focus_area===WHEEL_FORM.second_area) WHEEL_FORM.focus_area=null; wheelFormDraw(); }
// Speichern: „Bearbeiten" aktualisiert die Bewertung in place (PUT). Eine neue Bewertung
// (POST) wird vom Server mit 409 + existingId beantwortet, wenn es für heute schon eine gibt –
// dann wird diese aktualisiert statt eine zweite Zeile anzulegen.
async function saveWheel(){
  if(mindRoGuard()) return;
  if(!WHEEL_FORM||WHEEL_FORM.busy) return; wheelCollect(); const F=WHEEL_FORM;
  const btn=document.getElementById('wheelSaveBtn'); if(btn) btn.disabled=true; F.busy=true;
  const editId=F.edit&&F.editId?F.editId:null;
  const body={scores:F.scores,date:editId?(F.editDate||today()):today()};
  if(F.useTargets) body.targets=F.targets;
  if(F.focus_area) body.focus_area=F.focus_area;
  if(F.second_area) body.second_area=F.second_area;
  const acts=F.actions.filter(Boolean); if(acts.length) body.actions=acts;
  if(F.feeling_now) body.feeling_now=F.feeling_now;
  if(F.feeling_target) body.feeling_target=F.feeling_target;
  const first=!(MIND_TODAY?.wheel?.last)&&!(MIND_WHEEL?.assessments||[]).length;
  // Heute schon bewertet? Dann direkt aktualisieren (kein 409-Umweg) und leere Felder aus der bestehenden Bewertung übernehmen
  const sameDay=!editId?(MIND_WHEEL?.assessments||[]).find(x=>x.date===today()):null;
  const putId=editId||(sameDay?(+sameDay.id||null):null);
  if(sameDay&&!editId) wheelMergeExisting(body,sameDay);
  let updated=!!putId;
  let r=putId?await API.put('/mindset/wheel/'+putId,body):await API.post('/mindset/wheel',body);
  if(!putId&&r.status===409&&r.data?.existingId){
    updated=true; body.date=today();
    const ex=(MIND_WHEEL?.assessments||[]).find(x=>+x.id===+r.data.existingId); if(ex) wheelMergeExisting(body,ex);
    r=await API.put('/mindset/wheel/'+(+r.data.existingId||0),body);
  }
  if(r.status===200||r.status===201){
    closeModal(); WHEEL_FORM=null; mindCacheClear();
    const sm=r.data?.summary;
    toast(updated?`Rad aktualisiert${sm?` · Ø ${sm.avg}`:''} ✓`:`+30 XP · Rad gespeichert${sm?` · Ø ${sm.avg}`:''} ✓`);
    if(first&&!updated) setTimeout(()=>celebrate('🎡','Erstes Rad des Lebens!','Jetzt weißt du, wo du stehst.'),300);
    if(typeof refreshAchievements==='function') refreshAchievements();
    if(document.getElementById('mindBody')) mindsetTab('wheel'); else if(typeof refreshHomeIfActive==='function') refreshHomeIfActive();
  } else { F.busy=false; if(btn) btn.disabled=false; toast(r.data?.error||'Konnte nicht speichern'); }
}

// =====================================================================
// TAB CHALLENGE
// =====================================================================
// Ring und Punktereihe der laufenden Challenge – getrennt, damit sie nach einem Haken
// einzeln nachgezogen werden koennen (kein Spinner, kein zweiter Abruf).
function chalRingHTML(a){
  const N=+a.days||10, di=Math.min(N,Math.max(1,+a.dayIndex||1));
  return (typeof ring==='function')?ring(di/N,{size:76,label:String(di),sub:'/ '+N}):`<b>${di}/${N}</b>`;
}
function chalDotsHTML(a){
  const N=+a.days||10, di=Math.min(N,Math.max(1,+a.dayIndex||1));
  const td=a.today||{}; const cnt=mindChalDoneCount(a);
  return Array.from({length:N},(_,i)=>{ const d=i+1; const h=(a.history||[]).find(x=>x.dayIndex===d); let cls='';
    if(d===di){ cls=(td.complete?'ok':cnt.done>0?'part':'')+' is-today'; }
    else if(d<di){ cls=h?(h.complete?'ok':(h.pct>0?'part':'miss')):'miss'; }
    return `<span class="chal-dot ${cls}" title="Tag ${d}"></span>`; }).join('');
}
function chalHeroMetaTxt(){
  return (CHAL_DAYS===30?'Dreißig':'Zehn')+' Tage lang die Prinzipien für Energie und Vitalität leben: dir die Geschenke machen, die Gifte weglassen. Kein Perfektionismus – Konsequenz zählt.';
}
async function drawMindChallenge(){
  const box=document.getElementById('mindBody'); if(!box) return;
  const tok=++MIND_TOK; const ld=mindLoadStart();
  let data=(MIND_CHAL&&mindFresh(MIND_CHAL_TS))?MIND_CHAL:null;
  if(!data){
    const [r,cr]=await Promise.all([API.get('/mindset/challenge/'+VIEW_USER), API.get('/checkins/'+VIEW_USER)]);
    if(tok!==MIND_TOK){ mindLoadCancel(ld); return; }
    if(r.status!==200||!r.data){ mindLoadEnd(ld); const bb=document.getElementById('mindBody'); if(bb) bb.innerHTML=mindEmpty('trophy','Challenge gerade nicht erreichbar',r.data?.error||'Prüfe deine Verbindung und versuche es gleich noch einmal.',"mindsetTab('challenge')",'Erneut laden'); return; }
    data=r.data;
    const ci=(cr.status===200?(cr.data?.checkins||[]):[]).find(c=>c.date===today());
    data.waterToday=ci?.water??null;
    MIND_CHAL=data; MIND_CHAL_TS=Date.now();
  }
  if(tok!==MIND_TOK){ mindLoadCancel(ld); return; } const b=document.getElementById('mindBody'); if(!b) return; mindLoadEnd(ld);
  const own=mindOwn();
  // Icons, IDs und Texte kommen aus den lokalen Konstanten (identisch mit dem Backend); die
  // Server-Liste bestimmt nur, welche Regeln es gibt – nichts davon landet ungeprüft im HTML.
  const known=new Set((Array.isArray(data.rules)?data.rules:[]).map(x=>String(x?.id||'')));
  const rules=known.size?CHALLENGE_RULES.filter(x=>known.has(x.id)):CHALLENGE_RULES;
  const a=data.active||null;
  let html='', stickyBar='';   // die Startleiste kommt ganz zum Schluss (sie klebt am Seitenende)
  if(!a){
    if(CHAL_SEL===null){ CHAL_SEL=new Set(rules.filter(x=>x.default!==false).map(x=>x.id)); CHAL_DAYS=10; }
    html+=`<div class="today mb-4">
      <div class="eyebrow">🏆 Vital-Challenge</div>
      <div class="daytype" id="chalHeroTitle">${CHAL_DAYS===30?'30':'10'} Tage Vitalität</div>
      <div class="meta" id="chalHeroMeta">${chalHeroMetaTxt()}</div>
    </div>`;
    if(own){
      html+=`<div class="section-label">Dauer</div>
        <div class="chip-row wrap mb-2" id="chalDayChips" data-noswipe>${[10,30].map(n=>`<button type="button" class="chip${CHAL_DAYS===n?' on':''}" data-d="${n}" aria-pressed="${CHAL_DAYS===n}" onclick="chalDays(${n})">${n} Tage</button>`).join('')}</div>`;
      const grp=(g,title,hint)=>`<div class="section-label">${title}<span class="sl-r">${hint}</span></div><div class="rows mb-2">${rules.filter(x=>x.group===g).map(x=>{ const on=CHAL_SEL.has(x.id);
        return `<button type="button" class="rule-row" aria-pressed="${on}" onclick="chalToggleRule('${x.id}',this)"><span class="ric" aria-hidden="true">${x.icon}</span><span class="rbody"><span class="rlab">${esc2(x.label)}${x.auto?' <span class="pill neutral">auto</span>':''}</span><span class="rhint">${esc2(x.hint)}</span></span><span class="tgl${on?' on':''}" aria-hidden="true"></span></button>`; }).join('')}</div>`;
      html+=grp('gift','Geschenke','jeden Tag')+grp('poison','Gifte','weglassen');
      stickyBar=`<div class="mind-stickybar"><span class="mind-stick-t" id="chalSelCount">${pl(CHAL_SEL.size,'Regel','Regeln')} gewählt</span><button class="btn inline" id="chalStartBtn" onclick="chalStart()">Starten</button></div>`;
    } else html+='<div class="note">Aktuell läuft keine Challenge.</div>'+mindRoNote('mt-2');
  } else {
    const ruleIds=Array.isArray(a.rules)?a.rules:mParse(a.rules,[]);
    const td=a.today||{}; const checks=mParse(td.checks,{})||{}; const auto=mParse(td.auto,{})||{}; const partial=mParse(td.partial,{})||{};
    const N=+a.days||10, di=Math.min(N,Math.max(1,+a.dayIndex||1));
    const cnt=mindChalDoneCount(a);
    const full=!!cnt.total&&cnt.done===cnt.total;
    html+=`<div class="card mb-3">
      <div class="cluster mind-chal-h">
        <div class="mind-chal-ring" id="chalRing">${chalRingHTML(a)}</div>
        <div class="fill">
          <div class="h2">Tag ${di} von ${N}</div>
          <div class="meta" id="chalAdh">${a.adherencePct??0}% eingehalten · ${pl(a.completeDays||0,'Tag','Tage')} komplett</div>
          <div class="meta${full?' tone-green':''}" id="chalDone">Heute ${cnt.done}/${cnt.total} erledigt${full?' ✓':''}</div>
        </div>
        ${own?`<button class="btn icon sm" aria-label="Weitere Optionen" onclick="chalMenu(${+a.id||0})">${icon('more',20)}</button>`:''}
      </div>
      <div class="chal-dots mt-3" id="chalDots" aria-label="Tagesübersicht">${chalDotsHTML(a)}</div>
    </div>`;
    html+=mindRoNote('mb-3');   // B7: die Haken unten sind im Coach-Blick gesperrt – hier steht warum
    const wt=a.waterTargetL!=null?String(a.waterTargetL).replace('.',','):null;
    const wIn=data.waterToday!=null?String(data.waterToday).replace('.',','):null;
    const hz=data.hrZone||a.hrZone||null;
    const det=mParse(td.detail,{})||{};   // Auto-Details je Regel, u.a. weekCount/weekTarget für Kraft & Ausdauer
    const n0=v=>{ const n=Number(v); return isFinite(n)?n:null; };
    const collapsed=di>1;                 // ab Tag 2 stehen nur noch die dynamischen Zeilen da
    const row=x=>{ const isAuto=!!x.auto; const autoOn=auto[x.id]===true; const half=!autoOn&&(partial[x.id]===true||auto[x.id]==='partial');
      const manual=checks[x.id]===true; const on=autoOn||manual;
      let dyn='';
      if(x.id==='water'&&wt) dyn+=`<span class="rdyn">Dein Ziel heute ≈ ${esc2(wt)} L${wIn!=null?` · eingetragen ${esc2(wIn)} L`:' · noch nichts eingetragen'}</span>`;
      if(x.id==='cardio'&&hz&&n0(hz.lo)!=null) dyn+=`<span class="rdyn">Aerobe Zone ${n0(hz.lo)}–${n0(hz.hi)} bpm · Aufwärmen ${n0(hz.wlo)}–${n0(hz.whi)}</span>`;
      if((x.id==='strength'||x.id==='cardio')&&det[x.id]&&n0(det[x.id].weekCount)!=null){ const wc=n0(det[x.id].weekCount), wtg=n0(det[x.id].weekTarget)||3; dyn+=`<span class="rdyn${wc>=wtg?' tone-green':''}">Diese Challenge-Woche: ${wc}/${wtg}×${wc>=wtg?' ✓':''}</span>`; }
      const status=autoOn?'<span class="rauto">automatisch erkannt ✓</span>':half?'<span class="rauto tone-amber">½ · eins von beiden fehlt noch</span>':'';
      const dis=(!own)||(isAuto&&autoOn);
      return `<label class="rule-row${on?' on':''}${dis?' dis':''}" id="cr_${x.id}"><span class="ric" aria-hidden="true">${x.icon}</span><span class="rbody"><span class="rlab">${esc2(x.label)}</span>${dyn}<span class="rhint${collapsed?' hidden':''}" id="rh_${x.id}">${esc2(x.hint)}</span>${status}</span>${collapsed?`<button type="button" class="rinfo" aria-label="Hinweis zu ${mAttr(x.label)}" onclick="chalHintToggle(event,'${x.id}')">${icon('info',18)}</button>`:''}<input type="checkbox" class="rcheck" ${on?'checked':''} ${dis?'disabled':''} aria-label="${mAttr(x.label)}" onchange="chalToggleDay(${+a.id||0},'${x.id}',this.checked,this)"></label>`; };
    const active=rules.filter(x=>ruleIds.includes(x.id));
    const gifts=active.filter(x=>x.group==='gift'), poisons=active.filter(x=>x.group==='poison');
    if(gifts.length) html+=`<div class="section-label">Geschenke · heute</div><div class="rows" id="chalGifts">${gifts.map(row).join('')}</div>`;
    if(poisons.length) html+=`<div class="section-label">Gifte · heute weggelassen</div><div class="rows" id="chalPoisons">${poisons.map(row).join('')}</div>`;
    html+='<div class="caption mt-3">Auto-Regeln werden aus Trainings-, Cardio-, Wasser- und Mindset-Einträgen erkannt. Alles andere hakst du selbst ab.</div>';
  }
  const past=data.past||[];
  if(past.length){
    html+=`<div class="section-label">Bisherige Challenges</div><div class="rows">${past.map(p=>`<div class="row"><div class="rl">${mDateDE(p.start_date,{day:'numeric',month:'short',year:'numeric'})} · ${pl(+p.days||0,'Tag','Tage')}<small>${p.status==='done'?'Geschafft':'Beendet'} · ${pl(+p.completeDays||0,'Tag','Tage')} komplett · ${+p.adherencePct||0}%</small></div><div class="rr">${p.status==='done'?'🏆':'–'}</div></div>`).join('')}</div>`;
  }
  // Die Startleiste klebt (position:sticky) und steht deshalb als LETZTES im Fluss – so verdeckt
  // sie „Bisherige Challenges" nicht mehr und braucht keinen Platzhalter.
  html+=stickyBar;
  b.innerHTML=html;
  mindCacheView();
}
// Hinweis einer Regel auf- und zuklappen (das Label darf davon nicht mitschalten)
function chalHintToggle(ev,id){
  if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  const h=document.getElementById('rh_'+id); if(h) h.classList.toggle('hidden');
}
// Weitere Optionen der laufenden Challenge
function chalMenu(id){
  openSheet('Challenge',`<div class="rows"><div class="row tap" role="button" tabindex="0" onclick="chalStop(${+id||0})"><div class="r-ic">${icon('x',22)}</div><div class="rl tone-red">Challenge beenden<small>Der Fortschritt bleibt unter „Bisherige Challenges“ erhalten.</small></div><div class="rr"></div></div></div>`);
}
// 10/30 Tage: nur Hero-Text und Chips nachziehen, kein kompletter Neuaufbau
function chalDays(n){
  CHAL_DAYS=n===30?30:10;
  const t=document.getElementById('chalHeroTitle');
  if(!t) return drawMindChallenge();
  t.textContent=(CHAL_DAYS===30?'30':'10')+' Tage Vitalität';
  const m=document.getElementById('chalHeroMeta'); if(m) m.textContent=chalHeroMetaTxt();
  document.querySelectorAll('#chalDayChips .chip').forEach(x=>{ const on=+x.dataset.d===CHAL_DAYS; x.classList.toggle('on',on); x.setAttribute('aria-pressed',on?'true':'false'); });
}
function chalToggleRule(id,btn){
  if(!CHAL_SEL) CHAL_SEL=new Set();
  if(CHAL_SEL.has(id)) CHAL_SEL.delete(id); else CHAL_SEL.add(id);
  const on=CHAL_SEL.has(id); btn.setAttribute('aria-pressed',on?'true':'false'); const t=btn.querySelector('.tgl'); if(t) t.classList.toggle('on',on);
  const c=document.getElementById('chalSelCount'); if(c) c.textContent=pl(CHAL_SEL.size,'Regel','Regeln')+' gewählt';
  const sb=document.getElementById('chalStartBtn'); if(sb) sb.disabled=!CHAL_SEL.size;
}
async function chalStart(){
  if(mindRoGuard()) return;
  if(CHAL_BUSY) return; const rulesSel=[...(CHAL_SEL||[])]; if(!rulesSel.length) return toast('Wähle mindestens eine Regel');
  CHAL_BUSY=true; const btn=document.getElementById('chalStartBtn'); if(btn) btn.disabled=true;
  const r=await API.post('/mindset/challenge',{days:CHAL_DAYS,rules:rulesSel});
  CHAL_BUSY=false;
  if(r.status===200||r.status===201){ toast('Challenge gestartet – Tag 1'); CHAL_SEL=null; mindCacheClear(); drawMindChallenge(); }
  else if(r.status===409){ toast('Es läuft bereits eine Challenge'); mindCacheClear(); drawMindChallenge(); }
  else { if(btn) btn.disabled=false; toast(r.data?.error||'Konnte nicht starten'); }
}
// Haken setzen: Zeile, Kopfzahlen und Punktereihe aus der Antwort patchen (kein Spinner, kein Neuladen)
async function chalToggleDay(chalId,ruleId,on,input){
  if(mindRoGuard()){ if(input) input.checked=!on; return; }
  if(!MIND_CHAL?.active||CHAL_BUSY){ if(input) input.checked=!on; return; }
  const a=MIND_CHAL.active; const td=a.today||{}; const checks={...(mParse(td.checks,{})||{})}; checks[ruleId]=!!on;
  CHAL_BUSY=true; if(input) input.disabled=true;
  const r=await API.post('/mindset/challenge/'+chalId+'/day',{date:today(),checks});
  CHAL_BUSY=false; if(input) input.disabled=false;
  if(r.status===200||r.status===201){
    const day=r.data?.day||{};
    if(r.data?.active&&typeof r.data.active==='object'){ MIND_CHAL.active={...r.data.active,waterTargetL:r.data.active.waterTargetL??a.waterTargetL}; }
    else MIND_CHAL.active={...a,today:{...td,...day,checks:mParse(day.checks,checks)||checks}};
    MIND_CHAL_TS=Date.now();
    const lbl=input?input.closest('.rule-row'):document.getElementById('cr_'+ruleId);
    if(lbl) lbl.classList.toggle('on',!!on);
    mindPatchChallenge();
    MIND_TODAY=null; MIND_TODAY_TS=0;
    if(typeof invalidateView==='function'){ try{ invalidateView('home'); invalidateView('mindset'); }catch(e){} }
    if(r.data?.justFinished){
      setTimeout(()=>celebrate('🏆','Challenge geschafft!',pl(+a.days||10,'Tag','Tage')+' Vitalität – stark.'),300);
      if(typeof refreshAchievements==='function') refreshAchievements();
      mindCacheClear(); drawMindChallenge();
    }
  } else { if(input) input.checked=!on; toast(r.data?.error||'Konnte nicht speichern'); }
}
// Kopfzeile der laufenden Challenge an Ort und Stelle aktualisieren
function mindPatchChallenge(){
  const a=MIND_CHAL?.active; if(!a) return;
  const cnt=mindChalDoneCount(a); const full=!!cnt.total&&cnt.done===cnt.total;
  const d=document.getElementById('chalDone');
  if(d){ d.textContent=`Heute ${cnt.done}/${cnt.total} erledigt${full?' ✓':''}`; d.classList.toggle('tone-green',full); }
  const adh=document.getElementById('chalAdh'); if(adh) adh.textContent=`${a.adherencePct??0}% eingehalten · ${pl(a.completeDays||0,'Tag','Tage')} komplett`;
  const dots=document.getElementById('chalDots'); if(dots) dots.innerHTML=chalDotsHTML(a);
  const rg=document.getElementById('chalRing'); if(rg) rg.innerHTML=chalRingHTML(a);
  mindCacheView();
}
function chalStop(id){
  confirmSheet('Challenge beenden','Challenge wirklich beenden? Der bisherige Fortschritt bleibt unter „Bisherige Challenges“ erhalten.',{label:'Beenden',danger:true,onYes:()=>chalStopDo(id)});
}
async function chalStopDo(id){
  if(mindRoGuard()) return;
  const r=await API.post('/mindset/challenge/'+id+'/stop',{});
  if(r.status===200){ if(typeof closeAllSheets==='function') closeAllSheets(); toast('Challenge beendet'); CHAL_SEL=null; mindCacheClear(); drawMindChallenge(); }
  else toast(r.data?.error||'Konnte nicht beenden');
}
// =====================================================================
// TAB WISSEN (Toolbox)
// =====================================================================
async function loadMindEntries(){
  if(!mindOwn()){ MIND_ENTRIES={}; return {}; }   // Arbeitsblätter sind privat – der Server liefert sie nur dem Athleten selbst
  try{ const r=await API.get('/mindset/entries/'+VIEW_USER); if(r.status===200&&r.data){ const e=r.data.entries||{}; Object.keys(e).forEach(k=>{ e[k]=mParse(e[k],{})||{}; }); MIND_ENTRIES=e; return e; } }catch(e){}
  return null;
}
// Karten mit persönlichen Arbeitsblättern – nur im eigenen Konto sichtbar
const MIND_WORKSHEETS=['beliefs','incantation','thrive','passion'];
function incantStreak(dates){
  const set=new Set(dates||[]); if(!set.size) return 0; const tdy=today(); let d=set.has(tdy)?tdy:mAddDays(tdy,-1); let n=0; while(set.has(d)){ n++; d=mAddDays(d,-1); } return n;
}
async function drawMindWissen(){
  const box=document.getElementById('mindBody'); if(!box) return;
  const tok=++MIND_TOK; const ld=mindLoadStart();
  const [E,t]=await Promise.all([loadMindEntries(), loadMindsetToday()]);
  if(tok!==MIND_TOK){ mindLoadCancel(ld); return; } const b=document.getElementById('mindBody'); if(!b) return; mindLoadEnd(ld);
  const en=E||MIND_ENTRIES||{}; const needs=mParse(t?.prefs?.needs_top,[])||[];
  const own=mindOwn();
  // desc/extra: desc ist reiner Text (wird hier maskiert), extra ist bereits fertiges, maskiertes HTML
  const card=(key,icon,title,desc,extra)=>`<button type="button" class="know-card" onclick="openKnow('${key}')"><span class="ki" aria-hidden="true">${icon}</span><span class="kb"><span class="kt">${esc2(title)}</span><span class="kd">${esc2(desc)}</span>${extra||''}</span><span class="kx" aria-hidden="true">${typeof window.icon==='function'?window.icon('chevronRight',18):'›'}</span></button>`;
  const bel=en.beliefs||{}; const newB=(bel.new||[]).filter(Boolean); const hb=(bel.health_empowering||[]).filter(Boolean);
  const inc=en.incantation||{}; const lines=(inc.lines||[]).filter(Boolean); const sp=inc.spoken_dates||[]; const spokenToday=sp.includes(today()); const iSt=incantStreak(sp);
  const th=en.thrive||{}; const thActs=(th.actions||[]).filter(Boolean);
  const pv=en.passion||{}; const vi=en.vision||{};
  let html='';
  if(own){
    html+='<div class="section-label">Deine Arbeitsblätter</div>';
    html+=`<div class="caption mind-lock mb-3">${typeof window.icon==='function'?window.icon('lock',14):''} Was du hier einträgst, bleibt in deinem Konto – auch dein Coach sieht es nicht.</div>`;
    html+=card('beliefs','🔓','Glaubenssätze',newB.length||hb.length?`${pl(newB.length+hb.length,'Satz','Sätze')} festgehalten`:'Der Dickens-Prozess: alte Sätze entlarven, neue verankern.',newB.length||hb.length?`<span class="klist">${[...newB,...hb].slice(0,3).map(x=>`<span>„${esc2(x)}“</span>`).join('')}</span>`:'');
    html+=card('incantation','🔥','Deine Incantation',lines.length?`${pl(lines.length,'Zeile','Zeilen')} · ${spokenToday?'heute gesprochen ✓':'heute noch nicht gesprochen'}${iSt?` · ${pl(iSt,'Tag','Tage')} in Folge`:''}`:'Deine eigenen Kraftsätze – laut, mit Körper und Energie.');
    html+=card('thrive','🚀','3-to-5 to Thrive',thActs.length?`${pl(thActs.length,'Maßnahme','Maßnahmen')} festgelegt`:'Zwei Entscheidungen, eine Sofortmaßnahme, 3–5 Schritte.',thActs.length?`<span class="klist">${thActs.slice(0,3).map(x=>`<span>${esc2(x)}</span>`).join('')}</span>`:'');
    html+=card('passion','🔭','Leidenschaft & Vision',(pv.passion||vi.extraordinary)?'Deine Antworten sind gespeichert – zum Nachlesen und Schärfen.':'Was liebst du? Was willst du wirklich? Wie sieht dein außergewöhnliches Leben aus?');
    html+=card('needs','🧭','Die 6 Grundbedürfnisse',needs.length?'Deine Top 2 sind gewählt.':'Was dich wirklich antreibt. Wähle deine Top 2.',needs.length?`<span class="kpills">${needs.map(k=>{ const n=MIND_NEEDS.find(x=>x.key===k); return n?`<span class="pill red">${n.icon} ${esc2(n.label)}</span>`:''; }).join('')}</span>`:'');
  }
  html+='<div class="section-label">Frameworks</div>';
  html+=card('priming','🧠','Priming','Warum die ersten 10 Minuten den Tag entscheiden – und die 6 Schritte.');
  if(!own) html+=card('needs','🧭','Die 6 Grundbedürfnisse','Was dich wirklich antreibt.');
  html+=card('triad','⚡','Die Triade des Zustands','Körper · Fokus · Sprache – und die 90-Sekunden-Regel.');
  html+=card('formula','🧩','Die Erfolgsformel','Fünf Schritte, die jedes Ziel erreichbar machen.');
  html+=card('rapport','🤝','Rapport 7 · 38 · 55','Wie Verbindung entsteht: Worte, Stimme, Körper.');
  html+=card('principles','🌿','10 Meisterprinzipien','6 Geschenke, 4 Gifte – die Basis der Vital-Challenge.');
  html+=card('wheel','🎡','Rad des Lebens','7 Bereiche, ein Bild. Warum Balance mehr bringt als Höchstwerte.');
  html+=card('home','🏠','Emotionales Zuhause','Deine Gewohnheitsgefühle – und wie du bewusst umziehst.');
  if(!own) html+=`<div class="caption mind-lock mb-3">${typeof window.icon==='function'?window.icon('lock',14):''} Persönliche Arbeitsblätter und Notizen sind privat – nur der Athlet sieht sie.</div>`;
  html+='<div class="section-label">Offizielle Quellen</div><div class="card">'+mindLinks()+'</div>';
  b.innerHTML=html;
  mindCacheView();
}
function kList(items){ return `<ul class="mind-ul">${items.map(x=>`<li>${x}</li>`).join('')}</ul>`; }
function kSteps(items){ return `<ol class="mind-ol">${items.map(x=>`<li>${x}</li>`).join('')}</ol>`; }
function kP(t){ return `<p class="mind-p">${t}</p>`; }
function kH(t){ return `<div class="mind-h">${t}</div>`; }
function openKnow(key){
  const own=mindOwn(); const en=MIND_ENTRIES||{};
  if(!own&&MIND_WORKSHEETS.includes(key)){ toast('Arbeitsblätter sind privat – nur der Athlet sieht sie'); return; }
  const btn=(label,fn,sec)=>`<button class="btn block${sec?' sec':''} mt-4" onclick="${fn}">${label}</button>`;
  let title='',html='';
  switch(key){
    case 'priming':
      title='🧠 Priming';
      html=kP('Die ersten Minuten nach dem Aufwachen entscheiden, in welchem Zustand du den Tag angehst. Priming heißt: Du setzt diesen Zustand bewusst – mit Körper, Atmung und Fokus – statt ihn dem Zufall, dem Handy oder dem Wecker zu überlassen.')
        +kH('Die 6 Schritte in der App')
        +kSteps(['<b>Ankommen</b> – aufrecht, Augen zu, Hand aufs Herz.','<b>Power-Atmung</b> – 3 Sätze schnelle Atemzüge, Arme mitnehmen. Der Körper wacht auf.','<b>Dankbarkeit</b> – drei Momente, in die du wirklich eintauchst. Fühlen, nicht denken.','<b>Energie & Heilung</b> – Licht durch den Körper, dann Energie an drei Menschen schicken.','<b>3 to Thrive</b> – drei Ergebnisse, als wären sie schon erreicht. Feiern.','<b>Abschluss</b> – ein Satz, der dich trägt.'])
        +kH('Warum es wirkt')+kP('Du trainierst dein Nervensystem darauf, in Dankbarkeit und Klarheit zu starten. Was du täglich wiederholst, wird zu deiner Grundeinstellung – wie ein Muskel.')
        +kH('Offizielle Quellen')+mindLinks(['priming','guide','video1','video2'])
        +(own?btn('Priming starten','closeAllSheets();openPriming()'):'');
      break;
    case 'needs': {
      const sel=new Set(mParse(MIND_TODAY?.prefs?.needs_top,[])||[]);
      title='🧭 Die 6 Grundbedürfnisse';
      html=kP('Jeder Mensch handelt, um sechs Grundbedürfnisse zu erfüllen – bewusst oder nicht. Welche zwei bei dir ganz oben stehen, erklärt fast alles: deine Gewohnheiten, deine Konflikte, deine Erfolge.')
        +kH('Vier Bedürfnisse der Persönlichkeit')+kList(MIND_NEEDS.filter(n=>n.group==='p').map(n=>`${n.icon} <b>${esc2(n.label)}</b> – ${esc2(n.desc)}`))
        +kH('Zwei Bedürfnisse der Seele')+kList(MIND_NEEDS.filter(n=>n.group==='s').map(n=>`${n.icon} <b>${esc2(n.label)}</b> – ${esc2(n.desc)}`))
        +kP('Zwei Paare stehen in Spannung: <b>Gewissheit ↔ Abwechslung</b> und <b>Bedeutsamkeit ↔ Verbindung</b>. Wer innerhalb eines Paares nur eine Seite bedient, bleibt unruhig. Erfüllt fühlst du dich erst, wenn Wachstum und Beitrag dazukommen.')
        +kH('Deine Top 2')+kP('Welche zwei haben dich bisher gesteuert – und welche zwei sollen es ab jetzt sein?')
        +`<div class="mind-chips" data-noswipe id="needsChips">${MIND_NEEDS.map(n=>`<button type="button" class="mchip${sel.has(n.key)?' on':''}" aria-pressed="${sel.has(n.key)}" ${own?`onclick="needsPick('${n.key}',this)"`:'disabled'}>${n.icon} ${esc2(n.label)}</button>`).join('')}</div>`
        +(own?btn('Top 2 speichern','saveNeeds()'):'')
        +kH('Offizielle Quelle')+mindLinks(['needs']);
      break; }
    case 'triad':
      title='⚡ Die Triade des Zustands';
      html=kP('Jede Emotion entsteht aus drei Zutaten. Änderst du eine davon, kippt der Zustand – in Sekunden.')
        +kList(['<b>Physiologie</b> – Haltung, Atmung, Bewegung, Gesichtsausdruck. Der schnellste Hebel.','<b>Fokus</b> – worauf du achtest und welche Fragen du dir stellst.','<b>Sprache & Bedeutung</b> – deine Worte, deine Incantations, die Bedeutung, die du einer Situation gibst.'])
        +kH('Die 90-Sekunden-Regel')+kP('Leiden erkennen – und dir 90 Sekunden geben, um zurück in einen guten Zustand zu kommen. Drei Auswege stehen immer offen:')
        +kList(['<b>Wertschätzen</b> – was ist gerade trotzdem gut?','<b>Lernen</b> – was kann ich hier mitnehmen?','<b>Geben / Lieben</b> – wem kann ich jetzt etwas geben?'])
        +(own?btn('State-Change 60 s','closeAllSheets();openStateChange()'):'');
      break;
    case 'formula':
      title='🧩 Die Erfolgsformel';
      html=kP('Egal welches Ziel – der Weg dorthin folgt immer denselben fünf Schritten.')
        +kSteps(['<b>Ergebnis kennen</b> – Klarheit ist Kraft. Was genau willst du?','<b>Warum kennen</b> – dein Grund macht aus „sollte" ein „muss".','<b>Entschlossen handeln</b> – sofort, nicht irgendwann.','<b>Ergebnis wahrnehmen</b> – ehrlich messen, was passiert.','<b>Vorgehen anpassen</b> – so lange, bis es funktioniert.'])
        +kH('Die drei Sätze der Veränderung')+kList(['Es muss sich jetzt ändern.','Ich muss mich jetzt ändern.','Ich kann es jetzt ändern.'])
        +kP('Was war, zählt nur so lange, wie du dich daran festhältst. Entscheidend ist der nächste Schritt.');
      break;
    case 'beliefs': {
      const bl=en.beliefs||{}; const old=bl.old||[], nw=bl.new||[], hl=bl.health_limiting||[], he=bl.health_empowering||[];
      title='🔓 Glaubenssätze';
      html=kP('Ein Glaubenssatz ist nichts anderes als die feste Überzeugung, dass etwas eine bestimmte Bedeutung hat – und diese Überzeugung steuert dein Handeln, ob sie stimmt oder nicht. Der Dickens-Prozess macht sichtbar, was dich ein alter Satz bisher gekostet hat und was er dich weiter kosten wird. Erst dann trägt der neue Satz.')
        +kH('3 einschränkende Sätze')
        +[0,1,2].map(i=>`<div class="field"><input id="bl_old_${i}" maxlength="200" value="${mAttr(old[i]||'')}" placeholder="Alter Glaubenssatz ${i+1}" aria-label="Alter Glaubenssatz ${i+1}" ${own?'':'disabled'}></div>`).join('')
        +`<div class="note">Frag dich zu jedem Satz – nur denken: <b>Was hat dich das bisher gekostet?</b> In Gesundheit, Beziehungen, Geld, Selbstachtung. Und was kostet es dich in fünf Jahren, wenn nichts passiert?</div>`
        +kH('3 neue, stärkende Sätze')
        +[0,1,2].map(i=>`<div class="field"><input id="bl_new_${i}" maxlength="200" value="${mAttr(nw[i]||'')}" placeholder="Neuer Glaubenssatz ${i+1}" aria-label="Neuer Glaubenssatz ${i+1}" ${own?'':'disabled'}></div>`).join('')
        +kH('Gesundheit & Körper')
        +[0,1].map(i=>`<div class="field"><input id="bl_hl_${i}" maxlength="200" value="${mAttr(hl[i]||'')}" placeholder="Einschränkend über Gesundheit ${i+1}" aria-label="Einschränkender Gesundheitsglaubenssatz ${i+1}" ${own?'':'disabled'}></div>`).join('')
        +[0,1].map(i=>`<div class="field"><input id="bl_he_${i}" maxlength="200" value="${mAttr(he[i]||'')}" placeholder="Stärkend über Gesundheit ${i+1}" aria-label="Stärkender Gesundheitsglaubenssatz ${i+1}" ${own?'':'disabled'}></div>`).join('')
        +(own?btn('Speichern','saveBeliefs()'):'');
      break; }
    case 'incantation': {
      const inc=en.incantation||{}; const lines=(inc.lines||[]); const sp=inc.spoken_dates||[]; const spokenToday=sp.includes(today());
      title='🔥 Deine Incantation';
      html=kP('Du kennst deine Incantation vom Event – trag sie hier ein und sprich sie laut, mit Körper und Energie. Eine Incantation ist keine Affirmation: Sie wird nicht gedacht, sondern mit dem ganzen Körper gesprochen, bis du sie glaubst.')
        +`<div class="field"><label for="inc_lines">Deine Zeilen (eine pro Zeile, max. 8)</label><textarea id="inc_lines" rows="6" maxlength="1600" placeholder="Zeile 1&#10;Zeile 2&#10;…" ${own?'':'disabled'}>${esc2(lines.join('\n'))}</textarea></div>`
        +`<div class="tiles mb-3"><div class="tile"><div class="v">${typeof window.icon==='function'?window.icon('flame',18,'mind-flame'):''}${incantStreak(sp)}</div><div class="l">Tage in Folge</div></div><div class="tile"><div class="v">${sp.length}</div><div class="l">Gesprochen gesamt</div></div></div>`
        +(own?`<div class="cluster"><button class="btn sec inline" onclick="saveIncantation(false)">Speichern</button><button class="btn inline fill" id="incSpokeBtn" ${spokenToday?'disabled':''} onclick="saveIncantation(true)">${spokenToday?'Heute gesprochen ✓':'Heute gesprochen · +2 XP'}</button></div>`:'');
      break; }
    case 'rapport':
      title='🤝 Rapport 7 · 38 · 55';
      html=kP('Ob wir uns mit jemandem verbunden fühlen, hängt nur zu einem kleinen Teil vom Inhalt ab. Der Rest ist Stimme und Körper.')
        +`<div class="tiles grid-3"><div class="tile"><div class="v">7<em>%</em></div><div class="l">Worte</div></div><div class="tile"><div class="v">38<em>%</em></div><div class="l">Stimme</div></div><div class="tile"><div class="v">55<em>%</em></div><div class="l">Physiologie</div></div></div>`
        +kH('Anpassen & Spiegeln')+kList(['<b>Worte</b> – Schlüsselbegriffe und Satzbau des Gegenübers aufgreifen.','<b>Stimme</b> – Tempo, Lautstärke, Tonfall, Betonung angleichen.','<b>Physiologie</b> – Haltung, Gesten, Atmung, Blickkontakt, Nähe.'])
        +kP('Rapport ist kein Trick, sondern Aufmerksamkeit: Du gehst in die Welt des anderen, bevor du ihn in deine einlädst.');
      break;
    case 'principles':
      title='🌿 10 Meisterprinzipien';
      html=kP('Vitalität ist kein Zufall. Sechs Dinge gibst du dir – vier lässt du weg.')
        +kH('6 Geschenke')+kList(['Vitales Atmen – Power-Atmung und Bewegung für die Lymphe.','Lebendiges Wasser und wasserreiche Nahrung.','Optimale Ernährung – gute Fette, basisch, mineralstoffreich.','Aerobe Energie – Kraft und Ausdauer, regelmäßig.','Strukturelle Ausrichtung – Haltung, Dehnen, Symmetrie.','Ein ausgerichteter Geist – Dankbarkeit, Herzfokus, Wache am Tor.'])
        +kH('4 Gifte')+kList(['Verarbeitete Fette.','Fleisch (in der Challenge optional).','Milchprodukte (optional reduzieren).','Säurebildende Abhängigkeiten: Koffein im Übermaß, Zucker, Alkohol, Nikotin.'])
        +btn('Zur Vital-Challenge',"closeAllSheets();mindsetTab('challenge')");
      break;
    case 'wheel':
      title='🎡 Rad des Lebens';
      html=kP('Sieben Bereiche, jeder von 0 bis 100 bewertet. Zusammen ergeben sie ein Rad – und ein Rad mit einer Delle rollt nicht rund, egal wie hoch die anderen Werte sind.')
        +kList(WHEEL_AREAS.map(a=>`${a.icon} <b>${esc2(a.label)}</b> – ${esc2(WHEEL_DESC[a.key])}`))
        +kH('Lücke schließen – drei Säulen')+kList(['<b>Klarheit</b> – eine überzeugende Vision, starke Gründe, ehrlicher Ist-Stand.','<b>Beste Werkzeuge</b> – ein bewährter Plan, Mentor, Rituale, ein Team.','<b>Ausrichten & handeln</b> – innere Konflikte lösen, täglich tun, ständig messen.'])
        +btn('Zum Rad',"closeAllSheets();mindsetTab('wheel')");
      break;
    case 'thrive': {
      const th=en.thrive||{}; const dec=th.decisions||[]; const acts=th.actions||[];
      title='🚀 3-to-5 to Thrive';
      html=kP('Zwei neue Entscheidungen für mehr Gesundheit und Energie – und was sie in deinem Leben verändern. Dann eine Maßnahme, die du sofort umsetzt, und drei bis fünf Schritte, die zur Gewohnheit werden.')
        +kH('Entscheidung 1')+`<div class="field"><input id="th_d0" maxlength="200" value="${mAttr(dec[0]?.text||'')}" placeholder="Ich entscheide mich, …" aria-label="Entscheidung 1" ${own?'':'disabled'}></div><div class="field"><input id="th_i0" maxlength="200" value="${mAttr(dec[0]?.impact||'')}" placeholder="Wirkung auf mein Leben" aria-label="Wirkung Entscheidung 1" ${own?'':'disabled'}></div>`
        +kH('Entscheidung 2')+`<div class="field"><input id="th_d1" maxlength="200" value="${mAttr(dec[1]?.text||'')}" placeholder="Ich entscheide mich, …" aria-label="Entscheidung 2" ${own?'':'disabled'}></div><div class="field"><input id="th_i1" maxlength="200" value="${mAttr(dec[1]?.impact||'')}" placeholder="Wirkung auf mein Leben" aria-label="Wirkung Entscheidung 2" ${own?'':'disabled'}></div>`
        +kH('Sofortmaßnahme')+`<div class="field"><input id="th_imm" maxlength="200" value="${mAttr(th.immediate||'')}" placeholder="Was tust du heute noch?" aria-label="Sofortmaßnahme" ${own?'':'disabled'}></div>`
        +kH('3–5 Maßnahmen')+[0,1,2,3,4].map(i=>`<div class="field"><input id="th_a${i}" maxlength="200" value="${mAttr(acts[i]||'')}" placeholder="Maßnahme ${i+1}${i>2?' (optional)':''}" aria-label="Maßnahme ${i+1}" ${own?'':'disabled'}></div>`).join('')
        +(own?btn('Speichern','saveThrive()'):'');
      break; }
    case 'passion': {
      const pv=en.passion||{}, vi=en.vision||{};
      const ta=(id,label,v)=>`<div class="field"><label for="${id}">${label}</label><textarea id="${id}" rows="2" maxlength="200" ${own?'':'disabled'}>${esc2(v||'')}</textarea></div>`;
      title='🔭 Leidenschaft & Vision';
      html=kP('Was dir wirklich wichtig ist, treibt dich an. Wer weiß, wofür er brennt, braucht keine Disziplin – nur Richtung.')
        +kH('Leidenschaft')+ta('pv_love','Was liebst du?',pv.love)+ta('pv_hate','Was hasst du?',pv.hate)+ta('pv_passion','Wofür brennst du?',pv.passion)+ta('pv_want','Was willst du wirklich?',pv.want)
        +kH('Vision')+ta('vi_ex','Wie sieht dein außergewöhnliches Leben aus?',vi.extraordinary)+ta('vi_ob','Was stand bisher im Weg?',vi.obstacles)+ta('vi_ch','Was muss sich jetzt ändern?',vi.change)
        +(own?btn('Speichern','savePassionVision()'):'');
      break; }
    case 'home':
      title='🏠 Emotionales Zuhause';
      html=kP('Jeder Mensch hat ein paar Gefühle, zu denen er immer wieder zurückkehrt – wie nach Hause. Für die einen ist das Sorge oder Frust, für andere Dankbarkeit oder Neugier. Dieses Zuhause ist nicht Schicksal, sondern Gewohnheit.')
        +kP('Der erste Schritt: hinschauen. Welche Emotionen fühlst du in einer normalen Woche wirklich? Der zweite: bewusst umziehen – zwei Emotionen wählen und sie jeden Tag gezielt leben.')
        +(own?btn('Wochencheck starten','closeAllSheets();openWeeklyCheck()'):'');
      break;
    default: return;
  }
  // Ein Emoji am Titelanfang wandert als Illustration in das Sheet (Titel bleiben schlicht)
  const parts=String(title).split(' ');
  const ic=(parts.length>1&&!/[0-9A-Za-zÄÖÜäöüß]/.test(parts[0]))?parts.shift():'';
  openSheet(parts.join(' '),(ic?`<div class="mind-sheet-ic" aria-hidden="true">${ic}</div>`:'')+html);
}
async function mindPutEntry(key,data){
  if(mindRoGuard()) return false;
  const r=await API.put('/mindset/entries/'+key,data);
  if(r.status===200||r.status===201){ if(!MIND_ENTRIES) MIND_ENTRIES={}; MIND_ENTRIES[key]=data; return true; }
  toast(r.data?.error||'Konnte nicht speichern'); return false;
}
function mindWissenRefresh(){ if(document.getElementById('mindBody')&&renderMindset.tab==='wissen') drawMindWissen(); }
async function saveBeliefs(){
  const g=(p,n)=>Array.from({length:n},(_,i)=>val(p+i).slice(0,200));
  const data={old:g('bl_old_',3),new:g('bl_new_',3),health_limiting:g('bl_hl_',2),health_empowering:g('bl_he_',2)};
  if(await mindPutEntry('beliefs',data)){ closeModal(); toast('Glaubenssätze gespeichert ✓'); mindWissenRefresh(); }
}
async function saveIncantation(spoken){
  const lines=val('inc_lines').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,8).map(s=>s.slice(0,200));
  const cur=MIND_ENTRIES?.incantation||{}; let dates=Array.isArray(cur.spoken_dates)?[...cur.spoken_dates]:[];
  if(spoken){ if(!lines.length) return toast('Trag zuerst deine Zeilen ein'); const tdy=today(); if(!dates.includes(tdy)) dates.push(tdy); dates=dates.sort().slice(-60); }
  const btn=document.getElementById('incSpokeBtn'); if(btn&&spoken) btn.disabled=true;
  if(await mindPutEntry('incantation',{lines,spoken_dates:dates})){
    if(spoken){ const r=await API.post('/mindset/session',{kind:'state',date:today(),duration_sec:60,steps_done:1,steps_total:1,note:'incantation'}); const xp=(r.status===200||r.status===201)?mindXp(r,2):0; const iSt=incantStreak(dates); const stTxt=iSt?` · ${pl(iSt,'Tag','Tage')} in Folge`:''; toast(xp>0?`+${xp} XP · Gesprochen ✓${stTxt}`:`Gesprochen ✓${stTxt}`); if(typeof refreshAchievements==='function') refreshAchievements(); }
    else toast('Incantation gespeichert ✓');
    closeModal(); mindWissenRefresh();
  } else if(btn) btn.disabled=false;
}
async function saveThrive(){
  const data={decisions:[{text:val('th_d0').slice(0,200),impact:val('th_i0').slice(0,200)},{text:val('th_d1').slice(0,200),impact:val('th_i1').slice(0,200)}],immediate:val('th_imm').slice(0,200),actions:[0,1,2,3,4].map(i=>val('th_a'+i).slice(0,200)).filter(Boolean)};
  if(await mindPutEntry('thrive',data)){ closeModal(); toast('Gespeichert ✓'); mindWissenRefresh(); }
}
async function savePassionVision(){
  const p={love:val('pv_love').slice(0,200),hate:val('pv_hate').slice(0,200),passion:val('pv_passion').slice(0,200),want:val('pv_want').slice(0,200)};
  const v={extraordinary:val('vi_ex').slice(0,200),obstacles:val('vi_ob').slice(0,200),change:val('vi_ch').slice(0,200)};
  const ok1=await mindPutEntry('passion',p); const ok2=ok1&&await mindPutEntry('vision',v);
  if(ok1&&ok2){ closeModal(); toast('Gespeichert ✓'); mindWissenRefresh(); }
}
function needsPick(k,btn){
  const wrap=document.getElementById('needsChips'); if(!wrap) return;
  const on=btn.classList.contains('on');
  if(!on&&wrap.querySelectorAll('.mchip.on').length>=2) return toast('Genau zwei Bedürfnisse wählen');
  btn.classList.toggle('on',!on); btn.setAttribute('aria-pressed',!on?'true':'false');
}
async function saveNeeds(){
  const wrap=document.getElementById('needsChips'); if(!wrap) return;
  const sel=[...wrap.querySelectorAll('.mchip.on')].map(b=>MIND_NEEDS.find(n=>b.textContent.trim().includes(n.label))?.key).filter(Boolean);
  if(sel.length!==2) return toast('Wähle genau zwei Bedürfnisse');
  if(await mindSavePrefs({needs_top:sel})){ closeModal(); toast('Top 2 gespeichert ✓'); mindWissenRefresh(); }
}

// =====================================================================
// §5.7 HOME-WIDGET
// =====================================================================
// Vertrag (CONTRACTS.md): liefert ein OBJEKT, das die Home-Karte selbst rendert.
// {title, sub, action, fn, done, secondary:[{label,fn}], status:{text,fn}}
// Damit ältere Aufrufe (html += mindsetHomeWidget(d)) nicht brechen, liefert toString()
// weiterhin die schlanke Streifen-Darstellung.
function mindsetHomeWidget(d){
  if(!d||typeof d!=='object') return null;
  try{
    // „gespeichert" reicht nicht: nur ein vollwertiges Ritual gilt als erledigt (B16, mdIsFull)
    const h=new Date().getHours(); const prim=mdIsFull(d.priming), eve=mdIsFull(d.evening); const streak=+(d.streak?.priming)||0;
    const mins=[5,10,15].includes(+d.prefs?.priming_minutes)?+d.prefs.priming_minutes:10;   // gespeicherte Priming-Dauer
    const st=streak?` · ${pl(streak,'Tag','Tage')} in Folge`:'';
    let title,sub,action=null,fn="go('mindset')",done=false;
    // Reihenfolge zählt: nach 17 Uhr gewinnt die Abend-Reflexion, „auch mittags“ kommt dann nie mehr
    // Die Aktion ist zugleich die Chip-Beschriftung auf Home – deshalb sprechend statt „Starten"
    // (ein blosses Verb faellt dort auf den langen Titel zurueck und wird mitten im Wort gekuerzt).
    if(!prim&&h<12){ title=`Priming: ${mins} Minuten für deinen Tag`; sub='Atmung · Dankbarkeit · Fokus'; action='Priming'; fn='openPriming()'; }
    else if(!prim&&h<17){ title='Priming nachholen?'; sub=`Auch mittags wirken ${mins} Minuten Fokus`; action='Priming nachholen'; fn='openPriming()'; }
    else if(!eve&&h>=17){ title='Abend-Reflexion'; sub='2 Minuten für den Abend'; action='Reflexion'; fn='openEvening()'; }
    else if(prim&&eve){ title=`Tag abgerundet ✓${st}`; sub=`Morgen wieder: ${mins} Minuten Priming`; done=true; }
    else if(prim){ title=`Priming erledigt ✓${st}`; sub='Heute Abend: 2 Minuten Reflexion'; }
    else { title='Abend-Reflexion erledigt ✓'; sub='Morgen früh: Priming für deinen Start'; done=true; }

    const secondary=[];
    const bn=+d.breathCount||0, bt=+d.breathTarget||3;
    if(bn<bt&&!done) secondary.push({label:`Power-Atmung ${bn}/${bt}`,fn:'openBreath()'});

    // Challenge und Rad in EINER Statuszeile
    let status=null; const parts=[]; let sfn=null;
    const a=d.challenge?.active;
    if(a){ const c=mindChalDoneCount(a); parts.push(`Challenge Tag ${+a.dayIndex||1}/${+a.days||10}${c.total?` · ${c.done}/${c.total} erledigt`:''}`); sfn="renderMindset.tab='challenge';go('mindset')"; }
    if(d.wheel?.due){ parts.push('Rad fällig'); if(!sfn) sfn='openWheelNew()'; }
    if(parts.length) status={text:parts.join(' · '),fn:sfn||"go('mindset')"};

    const w={title,sub,action,fn,done,secondary,status};
    // Rückfall für Aufrufer, die noch HTML erwarten
    try{ Object.defineProperty(w,'toString',{value:()=>mindsetHomeStrip(w),enumerable:false}); }catch(e){}
    return w;
  }catch(e){
    // Notfall-Zustand: lieber eine schlichte Karte als gar nichts
    const w={title:'Mindset',sub:'Priming · Reflexion · Klarheit',action:null,fn:"go('mindset')",done:false,secondary:[],status:null};
    try{ Object.defineProperty(w,'toString',{value:()=>mindsetHomeStrip(w),enumerable:false}); }catch(e2){}
    return w;
  }
}
// Schlanker Streifen (ein Titel, eine Unterzeile, höchstens eine Statuszeile)
function mindsetHomeStrip(w){
  if(!w) return '';
  const btn=w.action?`<button type="button" class="btn sm ghost" onclick="event.stopPropagation();${w.fn}">${esc2(w.action)}</button>`
    :`<div class="sx" aria-hidden="true">${typeof window.icon==='function'?window.icon('chevronRight',18):'›'}</div>`;
  const line=w.status?`<div class="ss mind-line" role="button" tabindex="0" onclick="event.stopPropagation();${w.status.fn}">${esc2(w.status.text)}</div>`:'';
  return `<div class="stat-strip mind-strip" role="button" tabindex="0" aria-label="Mindset öffnen" onclick="go('mindset')"><div class="si">${typeof window.icon==='function'?window.icon('brain',24):'🧠'}</div><div class="sc"><div class="st">${esc2(w.title)}</div><div class="ss">${esc2(w.sub)}</div>${line}</div>${btn}</div>`;
}
