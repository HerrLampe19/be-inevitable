// BE INEVITABLE – Frontend, Teil «training.js» (WP2, v2.1). Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js.
// Inhalt: Trainings-Tab (Kraft: Tages-Chips, Fortschritts-Banner, Übungskarten mit Ein-Daumen-Satzlogging,
// Plan-Menü) · Übungs-Sheets (Menü, Notiz, Ausführung, Verlauf, Formular) · Abschluss · Cardio-Tab ·
// Kalender + Tages-Sheet · Trainingsrhythmus-Editor · Technik-Lexikon · Hantelrechner · Pausen-Timer /
// Trainingsleiste (#restBar, Markup in index.html).
// Regeln: ein Satz zählt erst mit Reps > 0 (per ✓ oder Änderung im Reps-Feld); Vorschläge aus dem letzten
// Training werden NIE stillschweigend gespeichert; ohne Netz reiht die Outbox (core.js) den Satz ein –
// er gilt trotzdem als erledigt.

// ===== kleine Helfer (nur hier) =====
function _inv(tab){try{if(typeof invalidateView==='function')invalidateView(tab);}catch(e){}}
function _fmtW(w){w=+w||0;return fmtNum(w,(w%1)?1:0);}
// Scheibengewichte brauchen zwei Nachkommastellen (1,25 kg) – ohne unnötige Nullen
function _fmtP(w){w=+w||0;return fmtNum(w,(w%1===0)?0:((Math.round(w*100)%10)?2:1));}
function _findEx(id){for(const d of (PLAN?.days||[]))for(const e of (d.exercises||[]))if(e.id===id)return e;return null;}
// Kurzform eines Tagesnamens für Kalender-/Rhythmus-Kacheln: „Lower 1" -> „L1", „Ganzkörper A" -> „GA".
// Zwei Buchstaben waren zu wenig: „Push" und „Pull" ergaben BEIDE „Pu" (Befund A-7) – die Kachel sagte
// dem Athleten also nicht, welcher Tag ansteht, und die Legende löste das Kürzel nicht auf.
// Regel seit der Nachbesserung: ein einzelnes Wort mit höchstens 6 Zeichen steht AUSGESCHRIEBEN da
// („Push", „Pull", „Beine") – ein Kürzel, das man erklären muss, ist kein Gewinn (STRATEGY 1.1:
// „Die App spricht in Kürzeln"). Längere Namen werden gekürzt, und `names` (alle Tage DESSELBEN Plans)
// lässt die Kurzform wachsen, bis sie innerhalb des Plans eindeutig ist.
// `grow` = wie viele Buchstaben die Kurzform ueber ihre Grundform hinaus bekommt (0 = Grundform).
// Mehrwortige Namen behalten ihre bewaehrte Form („Lower 1" -> „L1"), einwortige Namen bis 6 Zeichen
// stehen ausgeschrieben da, laengere mit drei Buchstaben.
function _abbrOf(name,grow){const t=String(name||'').trim().split(/\s+/).filter(Boolean);if(!t.length)return 'T';
  const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  grow=Math.max(0,grow|0);
  if(t.length>=2){const last=t[t.length-1];const tail=/^\d+$/.test(last)?last:last.charAt(0).toUpperCase();
    return cap(t[0].slice(0,1+grow))+tail;}
  const w=t[0];return (w.length<=6)?cap(w):cap(w.slice(0,3+grow));}
function dayAbbr(name,names){const list=(Array.isArray(names)?names:[]).filter(Boolean);
  let grow=0;
  if(list.length>1){const ziel=new Set(list).size;
    for(grow=0;grow<=9;grow++)if(new Set(list.map(n=>_abbrOf(n,grow))).size>=ziel)break;}
  return _abbrOf(name,grow);}
// Auflösung der Kürzel für die Legende: nur die Tage, deren Kachel NICHT den vollen Namen trägt.
function twAbbrLegend(names){const list=[...new Set((Array.isArray(names)?names:[]).filter(Boolean))];
  return list.map(n=>[dayAbbr(n,list),n]).filter(([k,n])=>k!==n);}
// Progression je Tag für die Sitzung merken (1 Batch-Request statt 10; bei Plan-Änderungen leeren)
const PROG_CACHE={};
function _progInvalidate(){for(const k of Object.keys(PROG_CACHE))delete PROG_CACHE[k];}
const EX_META={}; // Basis-Metazeile je Übung (wird bei „fertig" durch die Zusammenfassung ersetzt)

// ===== A-IV.2 · Die Satzzeile für Anfänger UND Profis (Präfix tw) =============================
// Eine Zeile, zwei Sichtbarkeitsstufen – kein zweiter Bildschirm, kein Modus-Schalter
// (STRATEGY-25 4.0/4.1). Gesteuert von EINEM Feld am Athleten, das es seit 2.6.0 gibt
// (CRITIC K1: nichts Neues erfinden): `experience_coach` (vom Coach gesetzt) schlägt
// `experience` (Selbstauskunft aus dem Onboarding). Im Coach-Blick zählt das Profil des
// ANGESEHENEN Athleten, nicht das des Coachs.
function twProfile(){try{if(typeof ME==='undefined'||!ME)return {};
  if(typeof VIEW_USER!=='undefined'&&VIEW_USER!=null&&VIEW_USER!==ME.id&&typeof VIEW_USER_PROFILE!=='undefined'&&VIEW_USER_PROFILE)return VIEW_USER_PROFILE;
  return ME;}catch(e){return {};}}
function twLevel(){const v=String(twProfile().experience_coach||twProfile().experience||'beginner').toLowerCase();
  return v==='advanced'?3:(v==='intermediate'?2:1);}
// `features` am Athleten (JSON, Spalte seit 2.6.0) darf eine einzelne Funktion abweichend
// freischalten („RIR ab heute, aber noch kein Tempo"). Fehlt der Schlüssel, entscheidet die Stufe.
function twFeat(k){try{let f=twProfile().features;if(typeof f==='string')f=JSON.parse(f||'{}');
  if(f&&typeof f==='object'&&Object.prototype.hasOwnProperty.call(f,k))return !!f[k];}catch(e){}
  return null;}
// RIR-Spalte ab Stufe 2. Für Anfänger bleibt die Zeile [kg][Wdh][✓] – genau wie heute.
function twRirOn(){const f=twFeat('rir');return f==null?twLevel()>=2:f;}
// Satztypen ebenfalls ab Stufe 2 – dieselbe Rangfolge, derselbe Schlüssel wie im Coach-Blatt
// (coach.js CO2_FEATS: `set_types`, „ab Stufe 2"). Bis zur Nachbesserung hing NUR das RIR-Feld an
// der Stufe, die Satznummer war für jeden ein Knopf: der Anfänger konnte seine Arbeitssätze auf
// „Aufwärmsatz" stellen und sie damit aus dem eigenen Volumen, e1RM und den Bestleistungen nehmen –
// ohne je von einer Satzart gehört zu haben. Der Coach-Blick versprach in derselben Version das
// Gegenteil (Befund A-5).
function twSetTypesOn(){const f=twFeat('set_types');return f==null?twLevel()>=2:f;}
// Schrittweite des ± Steppers: `exercises.step_kg` (Spalte seit 2.6.0), sonst 2,5 kg.
// Bei 3-kg-Kurzhanteln ist 2,5 falsch – deshalb gewinnt immer der Wert der Übung.
// `pr.stepKg` kommt aus der Progressions-Antwort (A-IV.3), sobald sie ihn mitschickt.
function twStepKg(ex,pr){for(const v of [pr&&pr.step,pr&&pr.stepKg,pr&&pr.step_kg,
    pr&&pr.recommendation&&pr.recommendation.step,ex&&ex.step_kg]){
    const n=parseFloat(v);if(isFinite(n)&&n>0)return Math.min(50,n);}
  return 2.5;}
// Satzarten – dieselben vier, die `set_logs.set_type` seit 2.6.0 kennt und die der Server
// annimmt (SET_TYPES in server.js). 'deleted' ist KEINE wählbare Art: gelöscht wird über
// DELETE /api/logs/:id, und das ist weich (CRITIC K9).
const TW_TYPES=[
  {k:'work',    s:'',  l:'Arbeitssatz',  d:'Zählt in Volumen, e1RM und Bestleistung.'},
  {k:'warmup',  s:'A', l:'Aufwärmsatz',  d:'Zählt NICHT in Volumen, e1RM und Bestleistung.'},
  {k:'drop',    s:'D', l:'Drop-Satz',    d:'Direkt im Anschluss mit weniger Gewicht, ohne Pause.'},
  {k:'backoff', s:'B', l:'Backoff-Satz', d:'Bewusst leichter nach dem schweren Satz.'}];
function twType(k){return TW_TYPES.find(t=>t.k===k)||TW_TYPES[0];}
// Vorschlagsgewicht EINER Satzzeile: der eigene letzte Wert dieses Satzes plus die Veränderung,
// die die Empfehlung für die Übung vorsieht. Warum nicht schlicht `rec.weight` in jede Zeile?
// Weil ein absteigendes Schema (80 / 75 / 70) damit platt gebügelt würde. Die Empfehlung
// VERSCHIEBT die Zeile, sie ersetzt sie nicht. Gespeichert wird davon nie etwas von allein –
// `data-sugg` bleibt stehen, bis der Satz bestätigt wird.
// P-4 · Der Hantelrechner rechnet Scheiben auf eine Stange. An einer Kurzhantel-, Kabel- oder
// Stapelmaschinen-Zeile hat er nichts zu rechnen und antwortete deshalb mit einem Fehlerhinweis
// („Das Zielgewicht ist kleiner als die Stange (20 kg)") – ein Fehler als erste Antwort auf eine
// sinnvolle Handlung. Die Liste ist bewusst ENG: sie nennt nur Fälle ohne Scheiben, und alles, was
// nach Scheiben aussieht (Smith, Press, Hack, Langhantel), gewinnt. Ein Knopf zu viel kostet nichts,
// ein fehlender Knopf nähme dem Athleten ein Werkzeug.
const TW_NOPLATE=/\b(db|kh)\b|dumbbell|kurzhantel|cable|kabel|\brope\b|seil|band|machine|maschine/i;
const TW_PLATE=/smith|press|hack|pendulum|barbell|langhantel|t-?bar|deadlift|kreuzheben|squat|kniebeuge/i;
function twPlateOn(name){const n=String(name||'');return !(TW_NOPLATE.test(n)&&!TW_PLATE.test(n));}
function twSuggW(lastW,rec){const w=parseFloat(lastW);if(!isFinite(w))return null;
  const to=parseFloat(rec&&rec.weight),from=parseFloat(rec&&rec.fromWeight);
  if(!isFinite(to)||!isFinite(from))return w;
  const d=to-from;if(!d)return w;
  return Math.max(0,Math.round((w+d)*2)/2);}
// Unterer Rand des Zielbereichs einer Übung: „6-10" -> 6, „12" -> 12, „AMRAP" -> null.
function _repLow(t){const m=String(t||'').match(/\d+/);const n=m?parseInt(m[0],10):NaN;
  return (isFinite(n)&&n>0&&n<=100)?n:null;}
// Wie EIN Satz in der Begründungszeile beschrieben wird. Bei `weight = 0` ist „0 kg" keine Aussage
// über die Leistung, sondern eine falsche: Klimmzüge stehen mit 0 in `set_logs`, geleistet wurden
// acht Wiederholungen mit dem eigenen Körper (Befund P-3). Die Spalte `exercises.bodyweight`, die
// das sauber lösen würde, steht zu Recht in DEFER-A4 – die FORMULIERUNG braucht sie nicht.
function _satzTxt(x){const w=+x.weight;
  return (x.weight==null||w===0)?fmtNum(x.reps)+' Wiederholungen (Körpergewicht)':_fmtW(w)+' kg × '+fmtNum(x.reps);}
// P3 · „Jede Zahl, die die App vorschlägt, trägt genau einen Satz, woher sie kommt."
// „zuletzt 72,5 kg × 10 bei RIR 2 → heute 75 kg (+2,5)"
// A-V.5 (DEFER-A4, Nachtrag A-IV.3, Befund A-4 zweite Fundstelle): „bei RIR n" darf nur stehen, wenn
// die RIR-Spalte auch sichtbar ist. Auf Stufe 1 ist sie aus — der Server filtert seinen eigenen
// Empfehlungstext seit 2.8.0 danach (`rirVisible`), diese Zeile baut die Trainingsansicht aber selbst.
// Gemessen vorher auf Stufe 1: „zuletzt 70 kg × 10 bei RIR 2 → heute 72,5 kg (+2,5)". Der RIR-WERT
// bleibt in `lastSets` – er ist echte Messung; nur die Anzeige folgt der Stufe.
function twWhy(ps,sug,rirOn){if(!ps||ps.weight==null)return '';
  const ro=(rirOn===undefined)?twRirOn():!!rirOn;
  let t='zuletzt '+_satzTxt(ps);
  if(ro&&ps.rir!=null&&ps.rir!=='')t+=' bei RIR '+fmtNum(ps.rir);
  if(sug==null||+sug===+ps.weight)return t+' → heute gleich';
  const d=Math.round((+sug-+ps.weight)*10)/10;
  return t+' → heute '+_fmtW(sug)+' kg ('+(d>0?'+':'−')+_fmtW(Math.abs(d))+')';}
// A-2 · Begründung, wenn die Zahl aus DERSELBEN Einheit kommt: „Satz 1 heute: 20 kg × 10".
function twWhyToday(l){if(!l||!(l.reps>0))return '';
  return 'Satz '+fmtNum(l.set_no)+' heute: '+_satzTxt(l)+' → Satz wiederholen';}
// A-1 · Erste Einheit dieser Übung: es gibt nichts zu belegen, also behauptet die Zeile auch nichts.
// Sie sagt stattdessen, woran der Athlet das richtige Gewicht erkennt – der Sonderfall Erstnutzung
// aus P2, wörtlich („Finde ein Gewicht, mit dem 2–3 Wiederholungen übrig bleiben").
function twWhyFirst(t){return 'Erste Einheit – nimm ein Gewicht, mit dem noch 2–3 Wiederholungen übrig bleiben'
  +(t?' (Ziel '+t+')':'');}
// Dieselbe Zahl, aber die Übung ist nicht neu: dann kommt sie schlicht aus der Vorgabe des Plans.
function twWhyTarget(t){return t?('Zielbereich der Übung: '+t+' Wdh'):'';}
// Die Zusatzfelder EINER Zeile, so wie sie gerade auf dem Bildschirm stehen. Sie reisen mit jedem
// Schreibvorgang dieser Zeile mit – dadurch entsteht für Satzart, RIR oder Notiz nie eine eigene,
// leere Satzzeile in der Datenbank. Ohne sichtbare RIR-Spalte wird `rir` NICHT mitgeschickt:
// der Server lässt einen vorhandenen Wert dann in Ruhe (er unterscheidet undefined von null).
function _rowExtra(grid){const o={};if(!grid)return o;
  o.set_type=grid.dataset.type||'work';
  o.note=grid.dataset.note?String(grid.dataset.note):null;
  const ri=grid.querySelector('input.rir');
  if(ri)o.rir=(ri.value===''?null:Math.max(0,Math.min(5,parseInt(ri.value,10)||0)));
  return o;}
let TW_CUR=null; // vom Nutzer gewählte Satzzeile {ex,set}; sonst gilt „die nächste offene"
// Genau EINE Zeile je Karte trägt die Werkzeugleiste (Stepper, Hantelrechner, Notiz): die, die
// gerade dran ist. Das hält die Karte kurz – und es ist dieselbe Zeile, die der Athlet als
// nächstes bestätigt, also stehen die Werkzeuge immer dort, wo der Daumen ohnehin ist.
function twMarkCur(card){const rows=[...card.querySelectorAll('.setgrid[data-set]')];if(!rows.length)return;
  const id=+card.dataset.id;let pick=null;
  if(TW_CUR&&TW_CUR.ex===id)pick=rows.find(g=>+g.dataset.set===TW_CUR.set)||null;
  if(!pick)pick=rows.find(g=>!_rowDone(g))||rows[rows.length-1];
  rows.forEach(g=>g.classList.toggle('cur',g===pick));}
function twCurSet(exId,setNo){TW_CUR={ex:+exId,set:+setNo};
  const c=document.getElementById('ex-'+exId);if(c)twMarkCur(c);}
// Fokus in einer Satzzeile = diese Zeile ist gemeint (Tastatur wie Finger).
document.addEventListener('focusin',e=>{const t=e.target;if(!t||!t.closest)return;
  const g=t.closest('#exlist .setgrid[data-set]');
  if(g&&(!TW_CUR||TW_CUR.ex!==+g.dataset.ex||TW_CUR.set!==+g.dataset.set))twCurSet(g.dataset.ex,g.dataset.set);});

// ===== WORKOUT =====
// renderWorkout(v,{start:true}) öffnet nach dem Laden automatisch die erste Übung mit offenen Sätzen (Home-CTA).
// {cached:true} (Router-Repaint aus dem Cache): vorhandene Ansicht stehen lassen und nur die Daten nachziehen.
async function renderWorkout(v,opts){opts=opts||{};if(!PLAN)await loadPlan();if(!TODAY)await loadToday();
  // aktiver Tag = bestätigter/empfohlener Trainingstag – aber nur, wenn sich die Empfehlung seit dem letzten
  // Rendern geändert hat (eine manuelle Wahl überlebt den Tab-Wechsel)
  const eff=TODAY?.confirmed||TODAY?.suggestion;const days=PLAN?.days||[];
  const effKey=VIEW_USER+'|'+(TODAY?.date||today())+'|'+(eff?.type||'')+'|'+(eff?.dayName||'');
  if(effKey!==renderWorkout.lastEff||!days.find(d=>d.id===CUR_DAY)){renderWorkout.lastEff=effKey;
    if(eff?.type==='train'&&eff.dayName){const m=days.find(d=>d.name===eff.dayName);if(m)CUR_DAY=m.id;}
    if(!days.find(d=>d.id===CUR_DAY))CUR_DAY=days[0]?.id||null;}
  if(opts.start)renderWorkout.start=true;
  if(opts.cached&&v.querySelector('#workoutBody')){workoutTab(renderWorkout.tab||'strength',{quiet:true});return;}
  v.innerHTML=`<div class="page on">
    <div class="seg" id="workoutSeg">
      <button id="wt_strength" class="on" onclick="workoutTab('strength')">Kraft</button>
      <button id="wt_cardio" onclick="workoutTab('cardio')">Cardio</button>
    </div>
    <div id="workoutBody"></div>
  </div>`;
  workoutTab(renderWorkout.tab||'strength');}
// workoutTab('kraft'|'strength'|'cardio') – Vertrag Home ↔ Training
function workoutTab(t,o){if(t==='kraft')t='strength';if(t!=='cardio')t='strength';renderWorkout.tab=t;
  const a=document.getElementById('wt_strength'),b=document.getElementById('wt_cardio');if(!a||!b)return;
  a.classList.toggle('on',t==='strength');b.classList.toggle('on',t==='cardio');
  if(t==='strength')drawStrength(o);else drawCardioTab(o);}
// Das Technik-Lexikon (DEFS) lädt seit 2.9.0 nicht mehr der Startpfad, sondern rpLoadDefs() – nach
// dem ersten vollständigen Bild (core.js/rpLater) oder hier, wenn jemand schneller im Trainings-Reiter
// ist. Die Übungsliste liest es (twTechChip/twFormDef); kommt es erst danach an, wird sie still
// nachgezogen. Ohne Netz bleibt sie, wie sie ist – der Technik-Chip fehlt dann, mehr passiert nicht.
function _trEnsureDefs(){
  if((DEFS||[]).length||typeof rpLoadDefs!=='function')return;
  rpLoadDefs().then(()=>{if((DEFS||[]).length&&document.getElementById('exlist'))renderEx({quiet:true});})
    .catch(e=>console.error('[lexikon]',e));}
function drawStrength(o){o=o||{};const b=document.getElementById('workoutBody');if(!b)return;
  const cv=coachView();
  if(!(o.quiet&&document.getElementById('exlist'))){
    b.innerHTML=`${!cv&&isBeginner()?infoBox('workout_intro','Tippe eine Übung an, trag Gewicht und Wiederholungen ein und bestätige den Satz mit dem Haken. Der farbige Hinweis sagt dir, ob du nächstes Mal mehr Gewicht nehmen solltest.'):''}
      <div class="dayrow">
        <div class="chip-row fill" id="daysel"></div>
        <span class="caption fixed" id="dayDate"></span>
        <button class="btn icon sm fixed" id="planMenuBtn" aria-label="Plan bearbeiten" onclick="openPlanMenu()">${icon('more',20)}</button>
      </div>
      <div id="exlist"></div>
      <button class="btn sec mt-2 hidden" id="addExBtn" onclick="addExercise()">${icon('plus',18)} Übung hinzufügen</button>`;}
  _trEnsureDefs();
  renderDaySel();renderEx({quiet:o.quiet});trainBarSync();
  if(typeof maybeStartTabTour==='function')try{maybeStartTabTour('workout',{deferred:true});}catch(e){}}
function renderDaySel(){const el=document.getElementById('daysel');if(!el)return;
  el.innerHTML=(PLAN?.days||[]).map(d=>`<button class="chip${d.id===CUR_DAY?' on':''}" onclick="selDay(${d.id})">${esc2(d.name)}</button>`).join('');
  const dt=document.getElementById('dayDate');if(dt)dt.textContent=fmtDate(new Date(),{weekday:'short'});}
async function selDay(id){if(id===CUR_DAY)return;CUR_DAY=id;renderDaySel();await renderEx();}
function curDayObj(){return (PLAN?.days||[]).find(d=>d.id===CUR_DAY);}
// Menü-Zeile für Sheets (Icon · Label · Chevron)
function _mrow(ic,label,fn,o){o=o||{};return `<div class="row tap${o.cls?' '+o.cls:''}" role="button" tabindex="0" onclick="${fn}"><div class="r-ic">${icon(ic,22)}</div><div class="rl">${esc2(label)}${o.sub?`<small>${esc2(o.sub)}</small>`:''}</div></div>`;}
// „···" neben den Tages-Chips: alles Seltene (Tag verwalten/anlegen, Kalender, Rhythmus, Coach-Vorlagen)
function openPlanMenu(){const d=curDayObj();const cv=coachView();const own=ME&&VIEW_USER===ME.id;
  let h='<div class="rows">';
  if(d)h+=_mrow('dumbbell','Übung hinzufügen',`closeAllSheets();addExercise()`,{sub:'zu „'+d.name+'"'});
  if(d)h+=_mrow('settings','Tag verwalten',`manageDay()`,{sub:'Umbenennen oder löschen'});
  h+=_mrow('plus','Trainingstag hinzufügen',`addDay()`);
  h+=_mrow('calendar','Kalender',`openCalendar()`,{sub:'Tage planen oder nachtragen'});
  if(own)h+=_mrow('refresh','Trainingsrhythmus',`openRhythmus()`,{sub:'Folge von Trainings- und Ruhetagen'});
  if(cv){h+=_mrow('download','Als Vorlage speichern',`closeAllSheets();if(typeof bootCall==='function')bootCall('coach','saveAsTemplate')`);
    h+=_mrow('upload','Vorlage anwenden',`closeAllSheets();if(typeof bootCall==='function')bootCall('coach','openTemplates')`);
    if(typeof openImport==='function')h+=_mrow('fileSpreadsheet','Aus Excel importieren',`closeAllSheets();openImport(${VIEW_USER},'${esc(COACH_CONTEXT||'')}')`);}
  h+='</div>';
  openSheet('Plan bearbeiten',h);}
function manageDay(){const d=curDayObj();if(!d)return;
  openSheet('Tag verwalten',`
    <div class="field"><label>Name des Trainingstags</label><input id="dn_name" value="${esc2(d.name)}" maxlength="60"></div>
    <button class="btn block" onclick="renameDay(${d.id})">Umbenennen</button>
    <button class="btn block danger mt-2" onclick="deleteDay(${d.id})">${icon('trash',18)} Tag löschen</button>
    <div class="caption mt-3">Beim Löschen werden auch die Übungen dieses Tags entfernt. Dein Rhythmus passt sich automatisch an.</div>`);}
async function renameDay(id){const name=val('dn_name');if(!name)return showFieldErr('sheetBody','Name darf nicht leer sein','dn_name');
  const r=await API.put('/days/'+id,{name});
  if(r.status===200){closeAllSheets();await loadPlan();renderDaySel();_inv();toast('Umbenannt ✓');}else toast(r.data?.error||'Fehler');}
// Zahl der Sätze, die an einem Trainingstag hängen – aus der Antwort des Servers (Feld `sets`; die
// älteren Schreibweisen daneben kosten nichts). null, wenn der Server sie (noch) nicht mitschickt.
function _daySetCount(d){if(!d||typeof d!=='object')return null;
  for(const k of ['sets','setCount','set_count','setsAffected','sets_affected']){const v=d[k];if(v!=null&&isFinite(+v))return Math.max(0,Math.round(+v));}
  return null;}
// „Tag löschen" ist der einzige Weg, auf dem mit einem Tipp Jahre an Sätzen verschwinden konnten (ON DELETE
// CASCADE über Übungen -> Sätze) – die alte Rückfrage sprach nur von „Übungen". Der Server macht daraus
// ein weiches Löschen und sagt, wie viele Sätze betroffen sind: entweder VORAB als 409 + warning auf den
// ersten Aufruf ohne `confirm` (dasselbe Muster wie beim Löschen einer Coach-Übung, delExercise) oder
// als Feld `sets` in der 200-Antwort. Alles per Feature-Erkennung – ein Server ohne beides bekommt
// weiterhin genau die alte Rückfrage und die alte Meldung, kein Verhalten hängt an einem neuen Feld.
function deleteDay(id,confirmed){const d=(PLAN?.days||[]).find(x=>x.id===id)||curDayObj();if(!d)return;
  if(!confirmed){confirmSheet('Tag löschen',`„${d.name}" wirklich löschen? Der Tag wird ausgeblendet – deine eingetragenen Sätze bleiben erhalten und lassen sich mit „Rückgängig" zurückholen. Dein Rhythmus passt sich automatisch an.`,{label:'Tag löschen',onYes:()=>deleteDay(id,'ok')});return;}
  (async()=>{
    const r=await API.del('/days/'+d.id,confirmed==='force'?{confirm:true}:undefined);
    if(r.status===409&&r.data&&r.data.warning){
      // Vor dem Löschen: die Zahl steht in der Warnung, nicht erst im Toast danach.
      const n=_daySetCount(r.data);
      const msg=n!=null?`An den Übungen von „${d.name}" hängen ${pl(n,'eingetragener Satz','eingetragene Sätze')} – Rekorde, Volumen und Verlauf dieser Übungen verschwinden mit dem Tag aus deinen Auswertungen. `:'';
      confirmSheet('Sätze betroffen',msg+String(r.data.message||r.data.warning||''),{label:'Trotzdem löschen',onYes:()=>deleteDay(id,'force')});return;}
    if(r.status!==200)return toast(r.data?.error||'Fehler');
    closeAllSheets();CUR_DAY=null;_progInvalidate();await loadPlan();renderWorkout.lastEff=null;renderWorkout(document.getElementById('views'));_inv();
    // Ehrliche Meldung: nennt die betroffenen Sätze, wenn der Server sie meldet. `soft`/`restorable` sagt,
    // dass sie nur ausgeblendet sind (weiches Löschen) – ohne das Feld steht nur die Zahl da.
    const n=_daySetCount(r.data);
    const soft=!!(r.data&&(r.data.soft||r.data.softDelete||r.data.restorable));
    // Weiches Löschen kennt einen Rückweg: POST /days/:id/restore bringt Tag und Übungen exakt zurück.
    // Der Knopf steht im Toast, weil dort auch die Zahl der betroffenen Sätze steht – ein Fehlgriff
    // ist so in einer Sekunde repariert, statt über den Coach oder den Export.
    const undo=soft?{label:'Rückgängig',fn:async()=>{const rr=await API.post('/days/'+d.id+'/restore',{});
      if(rr.status!==200)return toast(rr.data?.error||'Konnte nicht wiederherstellen');
      CUR_DAY=null;_progInvalidate();await loadPlan();renderWorkout.lastEff=null;renderWorkout(document.getElementById('views'));_inv();toast('Tag wiederhergestellt ✓');}}:undefined;
    toast(n>0?`Tag gelöscht · ${pl(n,'Satz','Sätze')} ${soft?'bleiben gespeichert, sind aber ausgeblendet':'aus den Auswertungen genommen'}`:'Tag gelöscht',undo);
  })().catch(e=>{console.error('[training] Tag löschen',e);toast('Fehler');});}

// ---- Übungsliste ----
// Mit Status, nicht als nackte Liste: ein fehlgeschlagener Abruf (offline, Server im Kaltstart) liefert
// sonst eine LEERE Liste, und renderEx malt die Übungen ohne die Sätze des Tages neu – alle Haken weg,
// Ring auf 0 %, obwohl nichts verloren ist. Der Aufrufer muss den Unterschied sehen können.
// `status` wandert mit: renderEx unterscheidet damit „keine Antwort" (0 – offline und kein Schnappschuss)
// von „Server hat abschlägig geantwortet" (≥ 400) und kann denselben ehrlichen Satz zeigen wie Cardio.
async function _todayLogs(){const lr=await API.get('/logs/'+VIEW_USER+'?date='+today());
  return {ok:lr.status===200,status:lr.status,logs:lr.data?.logs||[]};}
// Progression aller Übungen eines Tags: Batch-Route GET /progression/:userId?day=<id>; fällt auf die
// Einzelabfragen zurück, solange die Batch-Route fehlt (404). Ergebnis wird pro Tag gemerkt.
async function _loadProgression(day){const key=VIEW_USER+'_'+day.id;const ids=day.exercises.map(e=>e.id);
  const c=PROG_CACHE[key];if(c&&ids.every(id=>c[id]))return c;
  let items=null;
  const r=await API.get('/progression/'+VIEW_USER+'?day='+day.id);
  if(r.status===200&&r.data&&r.data.items&&typeof r.data.items==='object')items=r.data.items;
  if(!items){items={};const rs=await Promise.all(ids.map(id=>API.get('/progression/'+VIEW_USER+'/'+id)));
    rs.forEach((x,i)=>{items[ids[i]]=(x.status===200&&x.data)?x.data:{};});}
  PROG_CACHE[key]=items;return items;}
// B-I.3 · Auch die Planzeile des Coachs trägt die Supersatz-Marke (A1/A2) und den Hinweis auf eine
// getauschte Übung – sonst sähe er einen Plan, den sein Athlet anders vor sich hat.
function _exRowCoach(ex,i){const G=LIB_GRP[ex.id]||null;const m=libMeta(ex);
  return `<div class="row" id="ex-${ex.id}" data-id="${ex.id}"><div class="r-ic num">${esc2(G?G.tag:String(i+1))}</div>
  <div class="rl">${esc2(ex.name)}<small>${ex.target_sets||3} × ${esc2(ex.target_reps||'–')}${ex.muscle?' · '+esc2(ex.muscle):''}${ex.technique&&ex.technique!==(ex.form_guide||'')?' · '+esc2(ex.technique):''}${G?' · Supersatz '+esc2(G.tag.charAt(0)):''}${m.prevName?' · früher: '+esc2(m.prevName):''}</small></div>
  <div class="rr"><button class="btn icon sm" aria-label="Bearbeiten" onclick="editExercise(${ex.id})">${icon('pencil',18)}</button><button class="btn icon sm ghost" aria-label="Optionen" onclick="exMenu(${ex.id})">${icon('more',20)}</button></div></div>`;}
function _exCard(ex,i,pr,logs,open){const sets=ex.target_sets||3;pr=pr||{};const rec=pr.recommendation||{type:'none',text:''};
  const logFor=s=>logs.find(l=>l.exercise_id===ex.id&&l.set_no===s)||{};
  // Der Satz von LETZTER Woche, der zu dieser Zeile gehört. Erst über die Satznummer – und wenn die
  // nicht passt, über die Position. Warum die zweite Stufe nötig ist: `set_no` ist in Bestandsdaten
  // nicht immer je Übung gezählt. In der Prüf-Datenbank läuft sie über die ganze Einheit durch
  // (Übung 2 trägt die Sätze 4/5/6), und die reine Nummernsuche fand deshalb bei 8 von 9 Übungen
  // NICHTS: kein Vorschlagswert im Feld, keine Begründungszeile – Punkt 8 des Vertrags wäre genau
  // dort unsichtbar geblieben, wo er gebraucht wird. `lastSets` kommt vom Server nach `set_no`
  // sortiert und enthält nur die letzte Einheit dieser Übung; der n-te Eintrag IST der n-te Satz.
  // Entschieden wird EINMAL je Übung, nicht je Zeile: beginnt die letzte Einheit bei Satz 1, gilt die
  // Nummer; sonst die Position. Sonst bekämen zwei Zeilen denselben Vorschlag, wenn beides teilweise
  // greift (Sätze 2/3/4 nach einem gelöschten ersten Satz).
  const _last=(pr.lastSets||[]).filter(x=>x.reps>0);
  const _byNo=!_last.length||_last[0].set_no===1;
  const lastFor=s=>(_byNo?_last.find(x=>x.set_no===s):_last[s-1])||null;
  const prs=pr.prs||{};const prToday=!!(logSet.prDone&&Object.keys(logSet.prDone).some(k=>k.startsWith(ex.id+'_')));
  const recentPR=prToday||(prs.maxWeightDate&&(Date.now()-Date.parse(prs.maxWeightDate+'T00:00'))<7*864e5&&prs.maxWeightDate<today());
  // B13 · Die Metazeile entsteht aus TEILEN, und leere Teile fliegen vor dem Zusammenfügen heraus –
  // vorher hing bei einer Übung ohne Muskel oder ohne Zielbereich ein „·" ins Leere.
  // Die beiden Teile, die ein ELEMENT sind (Technik-Chip, Bestleistung), tragen ihr Trennzeichen
  // IN SICH (`.mgp`, `white-space:nowrap`). Sonst bricht die Zeile zwischen Punkt und Chip um und der
  // Punkt bleibt allein am Zeilenende stehen – genau das war im Prüf-Screenshot zu sehen
  // („Hamstrings · 10-15 Reps ·" und der Chip eine Zeile tiefer).
  // B12 · „Wdh", nicht „Reps": dieselbe Vokabel wie in der Kopfzeile und auf den Steppern.
  const mgParts=[[esc2(ex.muscle||''),ex.target_reps?esc2(ex.target_reps)+' Wdh':''].filter(Boolean).join(' · '),
    twTechChip(ex),
    prs.maxWeight>0?(recentPR?`<span class="pill amber pr">${icon('trophy',12)} ${_fmtW(prs.maxWeight)} kg</span>`:`<span class="best">Best ${_fmtW(prs.maxWeight)} kg</span>`):''
  ].filter(Boolean);
  const meta=mgParts.map((h,i)=>i?`<span class="mgp">· ${h}</span>`:h).join(' ');
  EX_META[ex.id]=meta;
  const recIcon={up:'trendUp',down:'trendDown',hold:'trendFlat'}[rec.type];
  // Satzzeile 2.8.0: [Satz][kg][Wdh][RIR][✓] plus die Werkzeugleiste der aktiven Zeile.
  // Die beiden Vorschau-Zeilen unter den Feldern („zuletzt 72,5 kg" / „× 10") sind weg – sie
  // wiederholten nur, was im Feld steht (RATE-25-training M2, ~40 px je Satz). An ihrer Stelle
  // steht EIN Satz, der sagt, woher die vorgeschlagene Zahl kommt und wohin sie zeigt (P3).
  const rirOn=twRirOn();const typesOn=twSetTypesOn();const step=twStepKg(ex,pr);const stepTxt=_fmtW(step);
  const plateOn=twPlateOn(ex.name);
  const zielRep=_repLow(ex.target_reps);
  // Ist diese Uebung fuer den Athleten WIRKLICH neu? Nur dann darf die Zeile „Erste Einheit" sagen.
  // Ein Satz 2 ohne Vorwochen-Gegenstueck, waehrend Satz 1 eine Vorgeschichte hat, ist keine erste
  // Einheit – dort sagt die Zeile stattdessen, aus welchem Zielbereich die Zahl kommt (P3: nichts
  // behaupten, was sich nicht belegen laesst).
  const neuFuerMich=!_last.length&&!logs.some(l=>l.exercise_id===ex.id&&l.reps>0);
  let _whyPrev=''; // zuletzt gezeigte Begründung DIESER Übung (siehe unten)
  const rows=Array.from({length:sets},(_,k)=>{const s=k+1;const lg=logFor(s);const ps=lastFor(s);
    const hasToday=(lg.weight!=null&&lg.weight>0)||(lg.reps!=null&&lg.reps>0);
    // A-2 · Gibt es zu dieser Zeile keinen Satz der VORIGEN Einheit, ist der letzte HEUTE bestätigte
    // Satz derselben Übung die Quelle – STRATEGY 4.1, Zeile „Vorbelegung": „letzter Wert aus derselben
    // Einheit". Bis zur Nachbesserung las `lastFor` ausschließlich `_last` (die Vorwoche); wer eine
    // Übung heute zum ersten Mal machte, fand Satz 2 leer vor, obwohl Satz 1 gerade gespeichert war.
    let heute=null;
    if(!ps&&!hasToday)for(let q=s-1;q>=1;q--){const l=logFor(q);if(l&&l.reps>0){heute={...l,set_no:q};break;}}
    // Die Empfehlung VERSCHIEBT nur den Wert der Vorwoche. Innerhalb derselben Einheit wird nichts
    // verschoben: Satz 2 wiederholt Satz 1, das ist die ehrlichere Vorgabe.
    const sug=ps?twSuggW(ps.weight,rec):(heute&&heute.weight!=null?+heute.weight:null);
    const wVal=hasToday?(lg.weight??''):(sug!=null?sug:'');
    let rVal=hasToday?(lg.reps>0?lg.reps:''):((ps||heute)?((ps||heute).reps??''):'');
    // A-1 · Erste Einheit: keine Vorwoche, kein Satz von heute. Dann trägt wenigstens die Spalte „Wdh"
    // den unteren Rand des Zielbereichs der Übung (`exercises.target_reps`, „6-10" -> 6). P2 nennt
    // genau diesen Sonderfall Erstnutzung. Das GEWICHT bleibt leer – eine Zahl dafür wäre geraten,
    // und die Begründungszeile sagt stattdessen, woran der Athlet es erkennt.
    let erst=false;
    if(!hasToday&&!ps&&!heute&&zielRep!=null&&rVal===''){rVal=zielRep;erst=true;}
    const rirVal=hasToday?(lg.rir==null?'':lg.rir):'';
    const ty=twType(hasToday&&lg.set_type?lg.set_type:'work');
    const note=hasToday?String(lg.note||''):'';
    const sugg=!hasToday&&(!!ps||!!heute||erst);const sc=sugg?' class="sugg"':'';
    // P3 · Begründung unter der vorgeschlagenen Zahl. Sie steht unter JEDER Zahl, die sich von der
    // darüber unterscheidet – und NICHT ein zweites und drittes Mal wortgleich darunter. Genau das
    // war der teuerste Fehler der alten Karte (RATE-25-training M2: die wiederholten „zuletzt 72,5 kg"
    // / „× 10" kosteten bei 3 Sätzen 429 px, ohne einen einzigen neuen Satz zu sagen). Bei einem
    // absteigenden Schema (80 / 75 / 70) trägt weiterhin jede Zeile ihre eigene Zeile.
    let why=sugg?(ps?twWhy(ps,sug,rirOn):(heute?twWhyToday(heute)
      :(neuFuerMich?twWhyFirst(ex.target_reps):twWhyTarget(ex.target_reps)))):'';
    if(why&&why===_whyPrev)why='';if(sugg)_whyPrev=why||_whyPrev;
    // `data-src` sagt, WOHER die Zahlen dieser Zeile stammen. twSeedNext (A-2) liest es: eine Zeile,
    // die schon den Wert der VORWOCHE trägt, wird nach einem ✓ nicht überschrieben – der Rückfall auf
    // „letzter Satz von heute" gilt nur, wo es keine Vorwoche gibt.
    const src=hasToday?'log':(ps?'last':(heute?'today':(erst?'first':'')));
    return `<div class="setgrid${rirOn?' rir':''}" data-ex="${ex.id}" data-set="${s}" data-type="${ty.k}" data-src="${src}"${note?` data-note="${esc2(note)}"`:''}>
      ${typesOn?`<button class="sn${ty.k!=='work'?' t-'+ty.k:''}" type="button" aria-label="Satz ${s} · Satztyp ${esc2(ty.l)} (langer Druck ändert den Satztyp)" onclick="twTypeSheet(${ex.id},${s})"><span class="v">${s}</span><span class="t">${ty.s}</span></button>`
        :`<div class="sn stat" aria-hidden="true"><span class="v">${s}</span></div>`}
      <div class="wcell"><input type="number" inputmode="decimal" step="any" min="0" max="1000" placeholder="kg"${sc} value="${wVal}" data-sugg="${sugg?1:0}" aria-label="Gewicht Satz ${s}" onfocus="clearSugg(this)" oncontextmenu="event.preventDefault();openPlateCalc(this.value)" onchange="logSet(${ex.id},${s},'weight',this.value)"></div>
      <div class="rcell"><input type="number" inputmode="numeric" min="0" max="1000" placeholder="–"${sc} value="${rVal}" data-sugg="${sugg?1:0}" aria-label="Wiederholungen Satz ${s}" onfocus="clearSugg(this)" onchange="logSet(${ex.id},${s},'reps',this.value,true)"></div>
      ${rirOn?`<div class="rircell"><input class="rir" type="number" inputmode="numeric" min="0" max="5" placeholder="–" value="${rirVal}" aria-label="RIR Satz ${s}: wie viele Wiederholungen wären noch gegangen" onchange="twRirChange(${ex.id},${s})"></div>`:''}
      <button class="ok" type="button" aria-label="Satz ${s} bestätigen" onclick="commitSet(${ex.id},${s})">${icon('check',22)}</button>
      <div class="strip${plateOn?'':' nopc'}">
        ${plateOn?`<button class="tl pc" type="button" aria-label="Hantelrechner für Satz ${s}" onclick="trOpenPlateFromRow(this)">${icon('dumbbell',18)}</button>`:''}
        <button class="stp wu" type="button" aria-label="Gewicht erhöhen um ${stepTxt} kg" onclick="twStep(${ex.id},${s},'weight',1)">+${stepTxt}<i>kg</i></button>
        <button class="stp wd" type="button" aria-label="Gewicht senken um ${stepTxt} kg" onclick="twStep(${ex.id},${s},'weight',-1)">−${stepTxt}<i>kg</i></button>
        <button class="stp ru" type="button" aria-label="Wiederholungen erhöhen um 1" onclick="twStep(${ex.id},${s},'reps',1)">+1<i>Wdh</i></button>
        <button class="stp rd" type="button" aria-label="Wiederholungen senken um 1" onclick="twStep(${ex.id},${s},'reps',-1)">−1<i>Wdh</i></button>
        <button class="tl nt${note?' on':''}" type="button" aria-label="Notiz zu Satz ${s}" onclick="twNoteSheet(${ex.id},${s})">${icon('pencil',18)}</button>
      </div>
      ${why?`<div class="why">${esc2(why)}</div>`:''}
      <div class="snote${note?'':' hidden'}">${esc2(note)}</div>
    </div>`;}).join('');
  // B-I.3 · Supersatz: die Karte bleibt eine Karte, bekommt aber die Klammer der Gruppe, ihre Marke
  // (A1/A2) an der Stelle der Nummer und den Satz, warum der Pausen-Timer wartet.
  const G=LIB_GRP[ex.id]||null;
  const gCls=G?' lib-g'+(G.idx===0?' lib-g-first':'')+(G.idx===G.size-1?' lib-g-last':''):'';
  const gIdx=G?G.tag:String(i+1);
  // Aufklapper: der Kopf ist der Knopf, der Satzblock das Ziel. aria-expanded/aria-controls sagen einem
  // Screenreader, dass hier etwas auf- und zugeht und was davon betroffen ist (A-II.6). Den Zustand
  // haelt semExAria synchron – sowohl beim Tippen (toggleEx) als auch beim Neuzeichnen (renderEx).
  return `<div class="ex${open?' open':''}${gCls}" id="ex-${ex.id}" data-id="${ex.id}"${G?` data-lib-g="${esc2(G.gid)}"`:''}>
    <div class="ex-head" role="button" tabindex="0" aria-expanded="${open?'true':'false'}" aria-controls="exb-${ex.id}" onclick="toggleEx(${ex.id})">
      <div class="ex-idx" data-n="${esc2(gIdx)}"${G?` aria-label="Supersatz ${esc2(G.tag)}"`:''}>${esc2(gIdx)}</div>
      <div class="ex-main"><div class="nm">${ex.coach_locked&&!coachView()?`<span class="lockw" role="img" aria-label="Vom Coach vorgegeben" title="Vom Coach vorgegeben">${icon('lock',14,'lock')}</span>`:''}${esc2(ex.name)}</div><div class="mg">${meta}</div></div>
      <span class="ex-cnt caption hidden"></span>
      <button class="btn icon sm ghost ex-more" type="button" aria-label="Optionen zu ${esc2(ex.name)}" onclick="event.stopPropagation();exMenu(${ex.id})">${icon('more',20)}</button>
      <div class="ex-chev">${icon('chevronRight',18)}</div>
    </div>
    <div class="ex-body" id="exb-${ex.id}"><div class="ex-inner">
      ${libPrevHTML(ex)}
      ${recIcon&&rec.text?`<div class="rec ${rec.type}"><span class="ric">${icon(recIcon,18)}</span><span>${esc2(rec.text)}</span></div>`:''}
      <div class="setgrid hdrow${rirOn?' rir':''}"><div class="hd">Satz</div><div class="hd">Gewicht</div><div class="hd">Wdh</div>${rirOn?'<div class="hd"><abbr title="Wiederholungen in Reserve: wie viele Wiederholungen wären noch gegangen">RIR</abbr></div>':''}<div class="hd" aria-hidden="true"></div></div>
      ${rows}
      ${libNextHTML(ex.id)}
      ${ex.notes?`<div class="note">${esc2(ex.notes)}</div>`:''}
    </div></div></div>`;}
// ---- Bereitschaft: ein Hinweis über der Übungsliste ----
// Er erscheint NUR bei „Etwas zurücknehmen"/„Erholen" (amber/rot). Grün oder „noch keine Daten"
// bleiben still, damit der Tab nicht bevormundet: er sagt, was die Zahlen hergeben, entscheiden
// tut der Nutzer. Ohne Uhr-Werte (needsHealth) steht statt der Zahl der Weg zu den Gesundheitsdaten.
function trainReadyHTML(rd){const tone=rd&&rd.tone;if(tone!=='amber'&&tone!=='red')return '';
  const health=!!rd.needsHealth&&typeof openIntegrations==='function';
  const fn=health?'openIntegrations()':(typeof openReadiness==='function'?'openReadiness()':''); // openReadiness gehört home.js
  // Gleiche Lesereihenfolge wie auf der Startseite (Zahl, dann Wort), aber NICHT dieselbe Zeichenkette:
  // dort steht die Zahl separat im Ring-Feld (home.js, .rdy-n) und der fette Text lautet nur
  // „Bereitschaft · <Wort>". Hier gibt es keinen Ring, deshalb trägt der fette Text die Zahl mit.
  const head=health?'Bereitschaft':`Bereitschaft ${fmtNum(rd.score)}${rd.label?' · '+rd.label:''}`;
  // Steht die Zahl auf einer EINZIGEN Quelle (typisch: Schlaf von Hand, keine Uhr – Feld `thin` des
  // Servers, ausgewertet von _readySolo in home.js), tritt die Handlungsempfehlung zurück – genau wie
  // auf der Startseite. „Ein Arbeitssatz weniger je Übung" wäre eine Ansage aus einer einzelnen,
  // gedämpften Schlafzahl; stattdessen steht hier, WORAUS geschätzt wurde. Ohne home.js (kein
  // _readySolo) bleibt es beim bisherigen Hinweis.
  const solo=(!health&&typeof _readySolo==='function')?_readySolo(rd):'';
  const sub=solo?`Geschätzt aus ${solo} – für eine belastbare Einschätzung fehlen noch Werte.`:(rd.headline||'');
  const inner=`${icon(tone==='red'?'moon':'heart',20)}<span class="fill"><b>${esc2(head)}</b>${sub?`<small>${esc2(sub)}</small>`:''}${health?'<small>Gesundheitsdaten verbinden</small>':''}</span>${fn?icon('chevronRight',18):''}`;
  const cls='tr-ready'+(tone==='red'?' red':''); // eigener Klassenname: „.rdy" gehört der Zeile auf der Startseite
  return fn?`<button class="${cls}" type="button" onclick="${fn}">${inner}</button>`:`<div class="${cls}">${inner}</div>`;}
// Höchstens ein Abruf je Nutzer und Tag (das Ergebnis ändert sich während des Trainings nicht) –
// gemerkt an renderEx.readiness. Läuft bewusst NEBEN dem Rendern: eine langsame Antwort darf das
// Satzraster nicht aufhalten. Gemalt wird über die ID, nie in das alte #exlist hinein.
async function _trReadiness(key){if(_trReadiness.busy)return;_trReadiness.busy=1;
  const r=await API.get('/readiness/'+VIEW_USER);_trReadiness.busy=0;
  renderEx.readiness={key,at:Date.now(),data:(r.status===200&&r.data)?r.data:null};
  if(key!==VIEW_USER+'|'+today())return; // inzwischen anderer Athlet/Tag
  const box=document.getElementById('trReady');if(box)box.innerHTML=trainReadyHTML(renderEx.readiness.data);}
// ---- FIX-B1 · „Heute geändert" – der Pivot, den der Athlet bisher nicht sah (BUILD-B1 4.5) -------
// Der Server liefert die Zeile seit 3.0.0 fertig: `GET /api/today/:id` trägt `override.text`
// („Heute geändert: Probe-Tag – weil Schulter zwickt"), gebaut an EINER Stelle (server.js
// overrideFor), damit Home, Training und Coach sie nicht dreimal verschieden formulieren. Im Client
// las sie bis hierher NUR `coach.js` – der Athlet, für den die Änderung gemacht wurde, erfuhr davon
// ausschließlich über Postfach und Push, und die Begründung stand nirgends neben dem Plan.
// Die Tageswahl selbst folgt dem Pivot schon (todayView setzt `suggestion` auf den Override, und
// renderWorkout wählt danach CUR_DAY) – es fehlte allein die Erklärung, warum heute ein anderer Tag
// offen steht. Die Zeile ist Text, kein Bedienelement: kein zusätzlicher Tipp, kein neuer Weg.
function libOverrideHTML(){const o=TODAY&&TODAY.override;
  if(!o||!o.text)return '';
  const wer=o.by==='coach'?'Dein Coach hat die heutige Einheit geändert.':'Du hast die heutige Einheit selbst geändert.';
  const statt=(TODAY.suggestionPlanned&&TODAY.suggestionPlanned.dayName&&TODAY.suggestionPlanned.dayName!==o.dayName)
    ?` Geplant war: ${esc2(TODAY.suggestionPlanned.dayName)}.`:'';
  return `<div class="note status lib-ovr mb-3">${icon('refresh',18)}<div class="fill"><b>${esc2(o.text)}</b>
    <small>${wer}${statt} Dein Plan selbst bleibt unverändert – ab morgen gilt wieder dein Rhythmus.</small></div></div>`;}
// ---- Tagestyp im Trainings-Tab (Ruhetag / krank) ----
// Die Startseite sagt am Ruhe- und am Kranktag die Wahrheit; der Trainings-Tab hat bisher trotzdem
// „27 Sätze geplant – leg los" gerufen. Quelle ist derselbe Tagestyp wie auf der Startseite
// (bestätigter Tag, sonst Vorschlag). Der Tag bleibt wählbar und eintragbar – nur die Aufforderung fällt weg.
function trDayMode(){const t=(TODAY?.confirmed||TODAY?.suggestion)?.type;return (t==='rest'||t==='sick')?t:'train';}
function trDayHead(m){return m==='sick'?'Krank gemeldet':m==='rest'?'Heute ist Ruhetag':'Heutiges Training';}
// Untertitel für Ruhe-/Kranktag. Eingetragene Sätze werden weiter gezählt (ehrlich), aber ohne „noch X".
function trDaySub(m,done,total){
  if(m==='sick')return done>0?`${done} von ${total} Sätzen eingetragen – dein Tag steht auf „Krank".`:'Erhol dich – dein Plan wartet auf dich.';
  return done>0?`${done} von ${total} Sätzen eingetragen – dein Tag steht auf „Ruhetag".`:'Du kannst trotzdem etwas eintragen.';}
async function renderEx(o){o=o||{};const day=curDayObj();const el=document.getElementById('exlist');if(!el)return;
  const addBtn=document.getElementById('addExBtn');if(addBtn)addBtn.classList.toggle('hidden',!(day&&day.exercises.length));
  if(!day){el.innerHTML=emptyState({icon:'calendar',title:'Noch kein Trainingstag',text:'Leg deinen ersten Tag an – z.B. Push, Lower 1 oder Beine.',btn:{label:'Ersten Trainingstag erstellen',onclick:'addDay()'}});trainBarSync();return;}
  if(!day.exercises.length){el.innerHTML=emptyState({icon:'dumbbell',title:'Noch keine Übungen',text:'Füg die erste Übung für diesen Tag hinzu.',btn:{label:'Übung hinzufügen',onclick:'addExercise()'}});trainBarSync();return;}
  const cv=coachView();const seq=(renderEx.seq=(renderEx.seq||0)+1);
  const openId=el.querySelector('.ex.open')?.dataset.id;
  if(!o.quiet)el.innerHTML=(cv?'':skeleton(1,'lg'))+skeleton(3);
  const [tl,progs]=await Promise.all([_todayLogs(),cv?Promise.resolve({}):_loadProgression(day)]);
  if(seq!==renderEx.seq||document.getElementById('exlist')!==el)return; // inzwischen anderer Tag/Tab
  // Letzter belastbarer Stand je Nutzer und Tag. Kam der Abruf nicht durch, wird NICHT mit einer leeren
  // Liste gemalt: steht die Liste schon (stilles Neuzeichnen), bleibt sie stehen; sonst dient der
  // gemerkte Stand als Grundlage. Sonst verschwindet dem Nutzer mitten im Training sein halbes Pensum.
  // Der Coach sieht dieselben Gruppen wie sein Athlet – deshalb wird LIB_GRP AUCH in seinem Blick
  // gefüllt und nicht nur in der Satzansicht. Ohne diese Zeile stünde im „···"-Menü des Coachs noch
  // die Gruppe des zuletzt angesehenen Athleten.
  if(cv){libBuild(day);el.innerHTML=`<div class="rows plan-rows">${day.exercises.map((ex,i)=>_exRowCoach(ex,i)).join('')}</div>`;trainBarSync();return;}
  const rlk=VIEW_USER+'|'+today();
  if(tl.ok)renderEx.logs={key:rlk,list:tl.logs};
  if(!tl.ok&&el.querySelector('.ex')){trainBarSync();return;}
  const kept=(renderEx.logs&&renderEx.logs.key===rlk)?renderEx.logs.list:null;
  // Kaltstart ohne Netz und ohne Schnappschuss: der PLAN liegt vor (27 Sätze), die SÄTZE VON HEUTE nicht.
  // Mit logs=[] zu zeichnen hiesse behaupten, heute sei nichts eingetragen – Ring auf 0 %, jede Satzzeile
  // auf „–" und „27 Sätze geplant – leg los" an einen Athleten, der sein Pensum vielleicht längst hinter
  // sich hat. Dieselbe Lage, derselbe Satz wie bei Cardio (drawCardioTab) und auf der Startseite.
  if(!tl.ok&&!kept){el.innerHTML=stlNotLoaded('Sätze von heute',tl.status,'renderEx()');trainBarSync();return;}
  const logs=tl.ok?tl.logs:kept;
  const banner=`<div class="card tp" id="trainProg">
    <svg class="ring" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="27" fill="none" stroke="var(--surface3)" stroke-width="6"/>
      <circle id="tpRing" class="ring-fg" cx="32" cy="32" r="27" fill="none" stroke="var(--red)" stroke-width="6" stroke-linecap="butt" stroke-dasharray="${(2*Math.PI*27).toFixed(2)}" stroke-dashoffset="${(2*Math.PI*27).toFixed(2)}" transform="rotate(-90 32 32)"/>
      <text id="tpPct" x="32" y="32" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="var(--ink)">0%</text></svg>
    <div class="fill"><div class="h3" id="tpHead">${esc2(trDayHead(trDayMode()))}</div><div class="meta" id="tpSub"></div></div></div>`;
  // Bereitschaft ganz oben: aus dem Cache sofort, sonst füllt _trReadiness() den Platzhalter nach.
  // Ein fehlgeschlagener Abruf (offline, Route noch nicht da) darf es später nochmal versuchen.
  const rk=VIEW_USER+'|'+today();const rc=(renderEx.readiness&&renderEx.readiness.key===rk)?renderEx.readiness:null;
  // P1/M1: Die Übung, die JETZT dran ist, steht offen da. Bis 2.7.0 startete jede Karte zugeklappt
  // (app.css `.ex-body{max-height:0}`) – „einen Satz bestätigen" kostete deshalb 2 Taps statt 1 und
  // ab der Startseite 3 (gemessen mit tapcount.mjs). Offen ist die erste Übung, in der noch ein Satz
  // ohne Wiederholungen steht; ist alles erledigt, bleibt alles zu (dann gibt es nichts zu tippen).
  const openIdx=day.exercises.findIndex(ex=>{const n=ex.target_sets||3;
    for(let s=1;s<=n;s++){const l=logs.find(x=>x.exercise_id===ex.id&&x.set_no===s);if(!(l&&l.reps>0))return true;}
    return false;});
  TW_CUR=null;
  libBuild(day); // Supersatz-Gruppen dieses Tages VOR dem Zeichnen bestimmen (_exCard liest LIB_GRP)
  el.innerHTML=`<div id="trReady">${rc?trainReadyHTML(rc.data):''}</div>`+libOverrideHTML()+banner+day.exercises.map((ex,i)=>_exCard(ex,i,progs[ex.id],logs,i===openIdx)).join('');
  if(!rc||(!rc.data&&Date.now()-rc.at>6e4))_trReadiness(rk);
  // Eine vom Nutzer offen gelassene Karte gewinnt gegen die Vorauswahl (stilles Neuzeichnen).
  if(openId){const c=document.getElementById('ex-'+openId);
    if(c&&!c.classList.contains('open')){el.querySelectorAll('.ex.open').forEach(x=>{x.classList.remove('open');semExAria(x);});
      c.classList.add('open');semExAria(c);}}
  updateTrainProgress();
  // Von der Home gestartet: zur ersten Übung mit offenen Sätzen scrollen (sie ist bereits offen)
  if(renderWorkout.start){renderWorkout.start=false;const first=[...el.querySelectorAll('.ex')].find(c=>!c.classList.contains('done'));
    if(first){const nid=+first.dataset.id;
      if(first.classList.contains('open'))setTimeout(()=>first.scrollIntoView({behavior:'smooth',block:'start'}),80);
      else setTimeout(()=>toggleEx(nid),80);}}}
// aria-expanded des Kartenkopfs dem Klassenzustand nachziehen. Ein Screenreader liest sonst dauerhaft
// „eingeklappt", egal wie die Karte gerade steht (A-II.6). Nur ein Attribut – keine Logik.
function semExAria(card){if(!card)return;const h=card.querySelector('.ex-head');
  if(h)h.setAttribute('aria-expanded',card.classList.contains('open')?'true':'false');}
function toggleEx(id){const el=document.getElementById('ex-'+id);if(!el)return;const wasOpen=el.classList.contains('open');
  TW_CUR=null;
  // Partner eines Supersatzes bleiben offen: der Sprung von A1 nach A2 darf die Zeile nicht zuklappen,
  // in die gerade eingetragen wird (B-I.3).
  document.querySelectorAll('.ex.open').forEach(x=>{if(x!==el&&!libSameGroup(+x.dataset.id,id)){x.classList.remove('open');semExAria(x);}});
  el.classList.toggle('open',!wasOpen);semExAria(el);
  if(!wasOpen)setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),60);}

// ---- Fortschritt (Ring, Karten-Status, Leiste) – reines DOM-Patchen, kein Re-Render ----
// Ein Satz gilt als erledigt, wenn Reps > 0 eingetragen UND bestätigt sind (kein Vorschlag mehr) und der
// letzte Speicherversuch nicht fehlgeschlagen ist (data-failed setzt setSaveStatus).
// (Das Reps-Feld ist das ZWEITE Eingabefeld der Zeile – die RIR-Spalte steht dahinter und ist optional.)
function _rowDone(g){const r=g.querySelector('.rcell input')||g.querySelectorAll('input')[1];
  return !!(r&&r.value!==''&&parseFloat(r.value)>0&&r.dataset.sugg!=='1'&&g.dataset.failed!=='1');}
function _countDone(){let done=0,total=0;document.querySelectorAll('#exlist .ex .setgrid[data-set]').forEach(g=>{total++;if(_rowDone(g))done++;});return {done,total};}
function _paintCard(card){const rows=[...card.querySelectorAll('.setgrid[data-set]')];if(!rows.length)return;
  const done=rows.filter(_rowDone).length,total=rows.length,all=done>=total;
  rows.forEach(g=>{const ok=g.querySelector('.ok');if(ok)ok.classList.toggle('done',_rowDone(g));});
  card.classList.toggle('done',all);
  const cnt=card.querySelector('.ex-cnt');if(cnt){cnt.textContent=done>0&&!all?`${done}/${total}`:'';cnt.classList.toggle('hidden',!(done>0&&!all));}
  const idx=card.querySelector('.ex-idx');if(idx)idx.innerHTML=all?icon('check',16):idx.dataset.n;
  const mg=card.querySelector('.mg');const id=+card.dataset.id;
  if(mg){if(all){const li=rows[rows.length-1].querySelectorAll('input');
      // B13 · aus Teilen, leere raus: ohne Gewicht UND ohne Wiederholungen stand hier „3/3 · ".
      const letzt=[li[0].value!==''?_fmtW(li[0].value)+' kg':'',li[1].value!==''?'× '+li[1].value:''].filter(Boolean).join(' ');
      mg.textContent=[done+'/'+total,letzt].filter(Boolean).join(' · ');}
    else if(EX_META[id]!=null&&mg.innerHTML!==EX_META[id])mg.innerHTML=EX_META[id];}
  twMarkCur(card);}
function updateTrainProgress(doneSets,totalSets){
  document.querySelectorAll('#exlist .ex').forEach(_paintCard);
  if(doneSets==null||totalSets==null){const c=_countDone();doneSets=c.done;totalSets=c.total;}
  const box=document.getElementById('trainProg');
  if(box){const pct=totalSets?Math.round(doneSets/totalSets*100):0;const done=totalSets>0&&doneSets>=totalSets;const C=2*Math.PI*27;
    const ring=document.getElementById('tpRing');if(ring){ring.style.strokeDashoffset=String(C*(1-(totalSets?doneSets/totalSets:0)));ring.setAttribute('stroke',done?'var(--green)':'var(--red)');
      ring.setAttribute('stroke-linecap',doneSets>0?'round':'butt');} // bei 0 % zeichnet ein runder Cap sonst einen Punkt
    const pctEl=document.getElementById('tpPct');if(pctEl)pctEl.textContent=pct+'%';
    // Ruhe-/Kranktag: keine Aufforderung, kein „noch X" – die Kopfzeile sagt stattdessen, was heute gilt
    const mode=trDayMode();
    const hd=document.getElementById('tpHead');if(hd)hd.textContent=trDayHead(mode);
    const sub=document.getElementById('tpSub');if(sub){
      sub.textContent=mode!=='train'?trDaySub(mode,doneSets,totalSets)
        :(done?'Alle Sätze geschafft – stark!':(doneSets>0?`${doneSets} / ${totalSets} Sätze · noch ${totalSets-doneSets}`:`${pl(totalSets,'Satz','Sätze')} geplant – leg los`));
      sub.classList.toggle('tone-green',done&&mode==='train');}
  }
  trainBarSync();}

// ---- Satz loggen: ✓ pro Zeile ODER Änderung im Reps-Feld; Gewicht allein wird gespeichert, zählt aber nicht ----
function _rowInputs(exId,setNo){const g=document.querySelector(`#exlist .setgrid[data-ex="${exId}"][data-set="${setNo}"]`);if(!g)return null;
  const ins=g.querySelectorAll('input');
  return {grid:g,w:g.querySelector('.wcell input')||ins[0],r:g.querySelector('.rcell input')||ins[1],
    rir:g.querySelector('input.rir'),ok:g.querySelector('.ok')};}
function _adopt(input){if(input&&input.dataset.sugg==='1'){input.dataset.sugg='0';input.classList.remove('sugg');}}
// Fokus auf ein Vorschlagsfeld darf NUR die Kursivschrift nehmen. Das Vorschlags-Flag (data-sugg) räumen
// ausschliesslich die Commit-Pfade (commitSet / logSet mit Reps > 0) per _adopt(), sonst würde blosses
// Antippen eines vorbelegten Feldes den Satz als erledigt zählen, ohne dass etwas gespeichert wurde.
function clearSugg(input){if(input)input.classList.remove('sugg');}
// Ein bestätigter Satz darf genau EINEN Schreibvorgang auslösen. Der Tipp auf ✓ nimmt dem Reps-Feld zuerst
// den Fokus, dessen change-Handler bestätigt den Satz also bereits (logSet), bevor der Klick commitSet
// erreicht. _commitMark/_commitFresh merken sich pro Zeile den Zeitpunkt der letzten Bestätigung, damit der
// zweite Pfad im selben Tipp still aussteigt (kein zweiter POST, keine zweite Pause, kein zweites Vibrieren).
function _commitMark(exId,setNo){commitSet.last=commitSet.last||{};commitSet.last[exId+'_'+setNo]=Date.now();}
function _commitFresh(exId,setNo){const t=(commitSet.last||{})[exId+'_'+setNo];return !!t&&(Date.now()-t)<600;}
function commitSet(exId,setNo){const row=_rowInputs(exId,setNo);if(!row)return;
  const reps=parseFloat(row.r.value);
  if(!(reps>0)){try{row.r.focus();}catch(e){}toast('Wiederholungen eintragen, dann bestätigen');return;}
  if(_commitFresh(exId,setNo))return; // change-Handler des Reps-Feldes war schneller (Blur durch diesen Tipp)
  _adopt(row.w);_adopt(row.r);
  _commitMark(exId,setNo);
  _queueLog(exId,setNo,{weight:row.w.value===''?null:parseFloat(row.w.value),reps,..._rowExtra(row.grid)},true);
  _afterCommit(exId,setNo);}
function logSet(exId,setNo,field,value,autoTimer){const row=_rowInputs(exId,setNo);
  const n=(value===''||value==null)?null:parseFloat(value);const patch={[field]:n};
  const commit=field==='reps'&&n>0;
  if(row)Object.assign(patch,_rowExtra(row.grid));
  if(commit&&row){_adopt(row.w);_adopt(row.r);patch.weight=row.w.value===''?null:parseFloat(row.w.value);}
  if(commit)_commitMark(exId,setNo);
  _queueLog(exId,setNo,patch,commit);
  if(commit)_afterCommit(exId,setNo);else updateTrainProgress();}
function _queueLog(exId,setNo,patch,now){const key=exId+'_'+setNo;logSet.cache=logSet.cache||{};
  logSet.cache[key]={...(logSet.cache[key]||{}),user_id:VIEW_USER,exercise_id:exId,date:today(),set_no:setNo,...patch};
  setSaveStatus(exId,'saving',setNo);
  clearTimeout(logTimers[key]);
  if(now)_postLog(key);else logTimers[key]=setTimeout(()=>_postLog(key),500);}
// Signatur eines Satzes: identische Werte werden kein zweites Mal geschrieben (Netz-Sicherung zusätzlich zum
// Commit-Fenster oben – deckt auch Doppel-Tipps und den Fall „✓ ohne Änderung" ab).
// 2.8.0: RIR, Satzart und Notiz gehören zur Signatur. Ohne sie hätte eine Zeile, an der NUR der
// RIR-Wert oder die Satzart geändert wurde, dieselbe Signatur wie vorher – _postLog hielte sie für
// „schon gespeichert", stiege still aus und setzte den grünen Haken, ohne etwas zu schreiben.
function _logSig(b){return [b.exercise_id,b.set_no,b.date,b.weight==null?'':b.weight,b.reps==null?'':b.reps,
  b.rir==null?'':b.rir,b.set_type||'',b.note==null?'':b.note].join('|');}
// Ohne Netz wandert der Satz in die Outbox (core.js) und gilt trotzdem als erledigt – gleiche Geste,
// gleicher Haken, keine Fehlermeldung. Die Antwort ist dann 202 und enthält KEINE Serverdaten (kein
// `pr`), also wird auch nichts daraus ausgewertet. Beide Doppelschreib-Sperren bleiben gültig:
// `commitSet.last` unverändert, und `logSet.sent[key]` bleibt bei 202 stehen – der Eintrag liegt ja
// schon in der Outbox und darf nicht ein zweites Mal eingereiht werden. Lehnt der Server ihn später
// beim Nachtragen ab, meldet core.js das über trainForgetSets() zurück – erst dort fällt der Merker.
async function _postLog(key){const body=logSet.cache&&logSet.cache[key];if(!body)return;
  const exId=body.exercise_id,setNo=body.set_no,sig=_logSig(body);
  logSet.sent=logSet.sent||{};logSet.busy=logSet.busy||{};
  if(logSet.sent[key]===sig){ // schon unterwegs oder erfolgreich gespeichert -> nichts zu tun
    if(!logSet.busy[key]){setSaveStatus(exId,'saved',setNo);updateTrainProgress();}
    return;}
  logSet.sent[key]=sig;logSet.busy[key]=1;
  // Das Label steht später in der Warteliste („Bankdrücken Satz 2"), damit der Nutzer sieht, was noch offen ist.
  const r=await API.post('/logs',body,{queue:true,kind:'set',label:(_findEx(exId)?.name||'Übung')+' Satz '+setNo});
  delete logSet.busy[key];
  const ok=okRes(r),q=wasQueued(r); // okRes: 200 ODER 202; 202 = in der Outbox (core.js)
  if(!ok)delete logSet.sent[key]; // fehlgeschlagen -> „Erneut versuchen" darf wieder senden
  if(ok){setSaveStatus(exId,'saved',setNo);
    if(!q){ // nur mit Netz gibt es eine Antwort, aus der sich etwas lesen lässt
      // Neuer Übungs-Rekord? Einmal pro Satz melden, Kopfzeile der Karte nachziehen.
      if(r.data?.pr){logSet.prDone=logSet.prDone||{};if(!logSet.prDone[key]){logSet.prDone[key]=1;toast('Neuer Rekord · '+_fmtW(body.weight)+' kg');_markPR(exId,body.weight);_progInvalidate();}}
      // Ansichten erst auffrischen, wenn der Satz wirklich beim Server war – sonst holt sich die
      // Startseite offline eine leere Antwort und überschreibt den optimistischen Stand.
      if(body.reps>0){TODAY=null;_inv('home');if(typeof refreshAchievements==='function')refreshAchievements();}}
    updateTrainProgress();
    // EIN ruhiger Hinweis je Offline-Strecke statt eines Toasts pro Satz – wie viele Einträge warten,
    // steht ohnehin dauerhaft im Kopf. Nach dem nächsten Satz mit Netz ist der Hinweis wieder scharf.
    if(q){if(!_postLog.hinted){_postLog.hinted=1;toast('Offline gespeichert – wird nachgetragen, sobald du online bist');}}
    else _postLog.hinted=0;}
  else{setSaveStatus(exId,'error',setNo);updateTrainProgress(); // fehlgeschlagene Zeile fällt aus Ring/Karte heraus
    toast('Satz nicht gespeichert',{label:'Erneut versuchen',fn:()=>_postLog(key)});}}
// Der Server hat einen nachgetragenen Satz abgelehnt (4xx beim Leeren der Ablage, core.js ruft hier an).
// Ohne dieses Aufräumen bliebe die Signatur in logSet.sent stehen: der Nutzer tippt dieselben Werte
// erneut ein, _postLog erkennt „schon gesendet", steigt still aus und setzt den grünen Haken – der Satz
// wäre endgültig verloren und der Bildschirm behauptete das Gegenteil. Nur ein anderer Wert käme durch.
// Deshalb: alle Merker dieses Satzes weg, und die Zeile auf dem Bildschirm ehrlich als nicht gespeichert
// zeigen (data-failed nimmt sie aus Ring und Karten-Zähler heraus).
function trainForgetSets(bodies){if(!Array.isArray(bodies)||!bodies.length)return;
  let touched=false;
  bodies.forEach(b=>{if(!b||b.exercise_id==null||b.set_no==null)return;
    const key=b.exercise_id+'_'+b.set_no;
    clearTimeout(logTimers[key]);delete logTimers[key];
    if(logSet.sent)delete logSet.sent[key];
    if(logSet.cache)delete logSet.cache[key];
    if(logSet.busy)delete logSet.busy[key];
    if(logSet.prDone)delete logSet.prDone[key];
    if(commitSet.last)delete commitSet.last[key];   // sonst schluckt das 600-ms-Fenster den nächsten Tipp auf ✓
    // Nur die Zeile anfassen, die wirklich gemeint ist: ein abgelehnter Satz von gestern oder aus einem
    // anderen Athleten-Blick hat mit der gerade sichtbaren Liste nichts zu tun.
    if(b.date&&b.date!==today())return;
    if(b.user_id!=null&&b.user_id!==VIEW_USER)return;
    if(_rowInputs(b.exercise_id,b.set_no)){setSaveStatus(b.exercise_id,'error',b.set_no);touched=true;}});
  if(touched)updateTrainProgress();}
function _markPR(exId,w){const meta=EX_META[exId];if(meta==null)return;
  // Der Bestleistungs-Teil ist IMMER der letzte und steckt seit B13 in einer eigenen `.mgp`-Gruppe
  // (Trennzeichen inklusive). Der Technik-Chip davor beginnt mit `<button`, die Bestleistung mit
  // `<span class="best"` bzw. `<span class="pill` – daran unterscheidet der Ausdruck die beiden.
  const pill=` <span class="mgp">· <span class="pill amber pr">${icon('trophy',12)} ${_fmtW(w)} kg</span></span>`;
  EX_META[exId]=meta.replace(/\s*<span class="mgp">· <span class="(?:best|pill)[\s\S]*$/,'')+pill;
  const card=document.getElementById('ex-'+exId);if(card)_paintCard(card);}
// A-2 (zweite Hälfte) · Das Neuzeichnen der Karte belegt Satz 2 aus Satz 1 – aber nach einem ✓ wird
// die Karte NICHT neu gezeichnet (nur gepatcht, das ist der ganze Sinn von `_paintCard`). Ohne diese
// Funktion stünde Satz 2 also weiter leer da, obwohl Satz 1 eine Sekunde zuvor gespeichert wurde
// (gemessen: Zeile 2 auf placeholder „kg" / „–", Screenshot des Prüfers).
// Belegt werden nur Felder, die LEER sind oder selbst noch Vorschlag – ein eingetippter Wert bleibt.
// Das Belegte bleibt Vorschlag (`data-sugg=1`): gespeichert wird es erst mit dem nächsten ✓.
function twSeedNext(exId,setNo,next){const cur=_rowInputs(exId,setNo);if(!cur||!next)return;
  if(next.grid.dataset.src==='last'||next.grid.dataset.src==='log')return; // Vorwoche bzw. eigener Eintrag gewinnt
  const w=cur.w.value,r=cur.r.value;if(!(parseFloat(r)>0))return;
  const set=(inp,val)=>{if(!inp||val===''||val==null)return false;
    if(!(inp.value===''||inp.dataset.sugg==='1'))return false;
    if(inp.value===String(val)&&inp.dataset.sugg==='1')return true;
    inp.value=String(val);inp.dataset.sugg='1';inp.classList.add('sugg');return true;};
  const a=set(next.w,w),b=set(next.r,r);
  if(!a&&!b)return;
  next.grid.dataset.src='today';
  const txt=twWhyToday({set_no:setNo,weight:w===''?null:parseFloat(w),reps:parseFloat(r)});
  let el=next.grid.querySelector('.why');
  if(!el&&txt){el=document.createElement('div');el.className='why';
    next.grid.insertBefore(el,next.grid.querySelector('.snote'));}
  if(el)el.textContent=txt;}
function _afterCommit(exId,setNo){
  TW_CUR=null; // die Werkzeugleiste wandert zur nächsten offenen Zeile (der Fokus setzt sie gleich neu)
  // Der Tipp auf ✓ ist die Nutzergeste, auf die iOS für den Ton wartet – und der Moment, ab dem der
  // Bildschirm wach bleiben soll. Beides ist idempotent und kostet ab dem zweiten Satz nichts.
  trAudioUnlock();trWakeLock.want=1;trWakeLock();
  // Jeder bestätigte Satz startet die Pause neu – AUSSER die Übung steckt in einem Supersatz und der
  // Partner ist noch dran (B-I.3, libStep). Ohne Gruppe liefert libStep genau das alte Verhalten.
  const st=libStep(exId,setNo);
  if(st.rest)startRest(REST_SECS);
  trainBarSync.dismissed=null;
  try{if(navigator.vibrate)navigator.vibrate(8);}catch(e){}
  updateTrainProgress();
  if(st.goEx!==exId&&libJump(st.goEx,st.goSet))return; // ohne Pause direkt zur Partnerübung
  const card=document.getElementById('ex-'+exId);const next=_rowInputs(exId,setNo+1);
  if(next){twSeedNext(exId,setNo,next);
    setTimeout(()=>{next.w.scrollIntoView({block:'center',behavior:'smooth'});if(next.w.value==='')try{next.w.focus({preventScroll:true});}catch(e){}},80);}
  else{ // letzter Satz der Übung: der Fokus darf nicht auf der gerade zugeklappten Zeile stehen bleiben,
        // sonst steht die Tastatur über einem Feld, das der Nutzer nicht mehr sieht (und Tippen ändert es).
    const act=document.activeElement;
    if(act&&act.closest&&act.closest('#ex-'+exId))try{act.blur();}catch(e){}
    if(card&&card.classList.contains('done')){ // Karte fertig -> nächste offene Karte aufklappen
      let n=card.nextElementSibling;while(n&&!(n.classList.contains('ex')&&!n.classList.contains('done')))n=n.nextElementSibling;
      if(n)setTimeout(()=>{const nid=+n.dataset.id;toggleEx(nid);
        const nx=_rowInputs(nid,1);if(nx&&nx.w&&nx.w.value==='')try{nx.w.focus({preventScroll:true});}catch(e){}},250);}}}
// Rückmeldung pro Zeile: ✓ wird grün (fertig), Felder blitzen 1 s grün nach dem Speichern
function setSaveStatus(exId,state,setNo){const row=setNo?_rowInputs(exId,setNo):null;if(!row)return;
  const {grid,w,r,ok}=row;
  // data-failed am Raster ist die Quelle für _rowDone – ein nicht gespeicherter Satz zählt nicht als erledigt
  if(state==='error')grid.dataset.failed='1';else delete grid.dataset.failed;
  if(state==='saving'){if(ok){ok.classList.add('saving');ok.classList.remove('failed');}}
  else if(state==='saved'){if(ok){ok.classList.remove('saving');ok.classList.remove('failed');}[w,r].forEach(i=>{i.classList.add('saved');clearTimeout(i._t);i._t=setTimeout(()=>i.classList.remove('saved'),1000);});}
  else{if(ok){ok.classList.remove('saving');ok.classList.add('failed');}[w,r].forEach(i=>i.classList.remove('saved'));}}

// ---- ± Stepper, Satzart, RIR und Satz-Notiz (A-IV.2) --------------------------------------
// Ändern ohne Systemtastatur. Gemessen (tapcount.mjs `set_change`) kostete eine Gewichtsänderung
// bis 2.7.0 NEUN Taps: Feld antippen, vier- bis sechsmal Rücktaste, neuen Wert tippen, bestätigen.
// Mit dem Stepper sind es zwei: ein Tipp auf „+2,5", ein Tipp auf den Haken.
// Die Schrittweite kommt aus der Übung (`exercises.step_kg`) – bei 3-kg-Kurzhanteln wären 2,5 kg
// eine Zahl, die es an der Hantelablage nicht gibt.
function twStep(exId,setNo,field,dir){const row=_rowInputs(exId,setNo);if(!row)return;
  const inp=field==='reps'?row.r:row.w;if(!inp)return;
  const st=field==='reps'?1:twStepKg(_findEx(exId),(PROG_CACHE[VIEW_USER+'_'+CUR_DAY]||{})[exId]);
  let v=parseFloat(inp.value);if(!isFinite(v))v=0;
  v=Math.max(0,Math.min(1000,Math.round((v+dir*st)*100)/100));
  if(String(v)===String(parseFloat(inp.value)))return; // bei 0 nach unten passiert nichts
  inp.value=String(v);_adopt(inp);
  twCurSet(exId,setNo);
  const commit=(field==='reps'&&v>0);
  const patch={[field]:v,..._rowExtra(row.grid)};
  if(commit){_adopt(row.w);patch.weight=row.w.value===''?null:parseFloat(row.w.value);}
  // 500-ms-Sammelfenster statt sofort: zehn schnelle Tipps auf „+1" sind EIN Schreibvorgang.
  _queueLog(exId,setNo,patch,false);
  if(commit){ // Ein Satz mit Wiederholungen gilt als gemacht – wie eine Eingabe im Reps-Feld.
    trainBarSync.dismissed=null;
    // KEIN Sprung zur nächsten Zeile und kein Neustart einer laufenden Pause: der Nutzer korrigiert
    // gerade eine Zahl, er ist nicht fertig. Nur wenn noch gar keine Pause läuft, startet sie.
    // Im Supersatz gehört die Pause der GRUPPE: solange ein Partner noch dran ist, startet hier keine.
    if(!REST_END_AT&&libStep(exId,setNo).rest){trAudioUnlock();trWakeLock.want=1;trWakeLock();startRest(REST_SECS);}}
  updateTrainProgress();
  try{if(navigator.vibrate)navigator.vibrate(5);}catch(e){}}
// Satzart wählen. Der lange Druck auf die Satznummer ist die Geste aus dem Vertrag; ein kurzer Tipp
// tut dasselbe, weil ein langer Druck mit der Tastatur nicht auslösbar wäre (P7 – sichtbar heißt
// bedienbar). Der Knopf trägt die aktuelle Art in seinem aria-label.
function twTypeSheet(exId,setNo){if(!twSetTypesOn())return; // A-5: Stufe 1 kennt keine Satzarten
  const row=_rowInputs(exId,setNo);const cur=row?(row.grid.dataset.type||'work'):'work';
  const ex=_findEx(exId);twCurSet(exId,setNo);
  openSheet('Satz '+setNo+(ex?' · '+ex.name:''),`
    <div class="note mb-3">Die Satzart entscheidet, ob der Satz in Volumen, e1RM und Bestleistung zählt. Aufwärmsätze zählen nicht mit – sie sollen deine Rekorde nicht verwässern.</div>
    <div class="stack-sm">${TW_TYPES.map(t=>`<button class="rhy-opt tw-t${t.k===cur?' on':''}" type="button" aria-pressed="${t.k===cur?'true':'false'}" onclick="twSetType(${exId},${setNo},'${t.k}')"><span class="l">${esc2(t.l)}${t.k===cur?icon('check',18):''}</span><span class="s">${esc2(t.d)}</span></button>`).join('')}</div>
    <div class="caption mt-3">Tipp: Ein langer Druck auf die Satznummer öffnet diese Auswahl direkt.</div>`);}
function twSetType(exId,setNo,k){const row=_rowInputs(exId,setNo);if(!row){closeModal();return;}
  const t=twType(k);row.grid.dataset.type=t.k;
  const sn=row.grid.querySelector('.sn');
  if(sn){sn.className='sn'+(t.k!=='work'?' t-'+t.k:'');
    const tv=sn.querySelector('.t');if(tv)tv.textContent=t.s;
    sn.setAttribute('aria-label','Satz '+setNo+' · Satztyp '+t.l+' (langer Druck ändert den Satztyp)');}
  closeModal();
  // Steht die Zeile schon in der Datenbank, wird die neue Art sofort nachgezogen. Steht sie noch
  // nicht dort, reist sie mit dem nächsten Bestätigen mit – für eine bloße Markierung entsteht nie
  // eine leere Satzzeile mit 0 Wiederholungen.
  if(_rowDone(row.grid))_queueLog(exId,setNo,{weight:row.w.value===''?null:parseFloat(row.w.value),
    reps:parseFloat(row.r.value)||0,..._rowExtra(row.grid)},true);
  toast('Satzart: '+t.l);}
let _twLp=null;
document.addEventListener('touchstart',e=>{const t=(e.target&&e.target.closest)?e.target.closest('#exlist .setgrid .sn'):null;
  if(!t||!twSetTypesOn())return;clearTimeout(_twLp);
  _twLp=setTimeout(()=>{_twLp=null;try{if(navigator.vibrate)navigator.vibrate(12);}catch(x){}
    const g=t.closest('.setgrid');if(g)twTypeSheet(+g.dataset.ex,+g.dataset.set);},450);},{passive:true});
['touchend','touchmove','touchcancel','scroll'].forEach(ev=>document.addEventListener(ev,()=>{clearTimeout(_twLp);_twLp=null;},{passive:true,capture:true}));
// RIR: „Wie viele Wiederholungen wären noch gegangen?" Leer bleibt leer – „nicht erfasst" ist eine
// eigene Aussage und darf nicht als 0 (Muskelversagen) gespeichert werden. Solange die Zeile noch
// nicht bestätigt ist, reist der Wert mit dem Haken mit.
function twRirChange(exId,setNo){const row=_rowInputs(exId,setNo);if(!row)return;
  twCurSet(exId,setNo);
  if(!_rowDone(row.grid))return;
  _queueLog(exId,setNo,{weight:row.w.value===''?null:parseFloat(row.w.value),
    reps:parseFloat(row.r.value)||0,..._rowExtra(row.grid)},true);}
// Satz-Notiz – der Server speichert `set_logs.note` seit jeher, die Oberfläche zeigte sie nie
// (RATE-25-training M1: ein Test schrieb „RIR 1" hinein, in der App war davon nichts zu sehen).
function twNoteSheet(exId,setNo){const row=_rowInputs(exId,setNo);const cur=row?String(row.grid.dataset.note||''):'';
  const ex=_findEx(exId);twCurSet(exId,setNo);
  openSheet('Notiz · Satz '+setNo,`
    <div class="note mb-3">Ein Satz zu genau dieser Zeile – „links zwickt es", „mit Gurt", „letzte Wiederholung abgefälscht". Dein Coach sieht sie im Verlauf des Tages.</div>
    <div class="field"><label>Notiz zu Satz ${setNo}${ex?' · '+esc2(ex.name):''}</label><textarea id="tw_note" rows="3" maxlength="300" placeholder="Was gehört zu diesem Satz?">${esc2(cur)}</textarea></div>
    <button class="btn block" onclick="twNoteSave(${exId},${setNo})">Speichern</button>
    ${cur?`<button class="btn block sec mt-2" onclick="twNoteSave(${exId},${setNo},1)">Notiz entfernen</button>`:''}`);
  setTimeout(()=>{try{document.getElementById('tw_note')?.focus();}catch(e){}},350);}
function twNoteSave(exId,setNo,clear){const row=_rowInputs(exId,setNo);if(!row){closeModal();return;}
  const v=clear?'':val('tw_note').slice(0,300);
  if(v)row.grid.dataset.note=v;else delete row.grid.dataset.note;
  const box=row.grid.querySelector('.snote');
  if(box){box.textContent=v;box.classList.toggle('hidden',!v);}
  const btn=row.grid.querySelector('.tl.nt');if(btn)btn.classList.toggle('on',!!v);
  closeModal();
  if(_rowDone(row.grid))_queueLog(exId,setNo,{weight:row.w.value===''?null:parseFloat(row.w.value),
    reps:parseFloat(row.r.value)||0,..._rowExtra(row.grid)},true);
  toast(v?'Notiz gespeichert ✓':'Notiz entfernt');}

// ---- Abschluss: Zusammenfassung (nur Sätze mit Reps > 0), optionales Gefühl 1–5, Feier-Pop, bleibt im Training ----
async function openWorkoutSummary(){openSheet('Training beendet','<div class="spinner"></div>');
  const r=await API.get('/logs/'+VIEW_USER+'?date='+today());
  const logs=(r.data?.logs||[]).filter(l=>l.reps>0);
  const exName={};(PLAN?.days||[]).forEach(d=>(d.exercises||[]).forEach(e=>exName[e.id]=e.name));
  const volume=Math.round(logs.reduce((a,l)=>a+(l.weight||0)*(l.reps||0),0));
  const exIds=[...new Set(logs.map(l=>l.exercise_id))];
  const prs=Object.keys(logSet.prDone||{}).length;
  let top=null;for(const l of logs){if(!top||((l.weight||0)>(top.weight||0)))top=l;}
  openWorkoutSummary.data={sets:logs.length,volume,prs,exIds};openWorkoutSummary.feel=null;
  openSheet('Training beendet',`
    <div class="grid-2 mb-3">
      <div class="tile"><div class="v">${logs.length}</div><div class="l">Sätze</div></div>
      <div class="tile"><div class="v">${exIds.length}</div><div class="l">Übungen</div></div>
      <div class="tile"><div class="v">${fmtNum(volume)}<em> kg</em></div><div class="l">Gesamt bewegt</div></div>
      <div class="tile"><div class="v${prs?' tone-green':''}">${prs}</div><div class="l">Neue Rekorde</div></div></div>
    ${top&&top.weight?`<div class="note status mb-3">Schwerster Satz: <b>${esc2(exName[top.exercise_id]||'Übung')}</b> mit ${_fmtW(top.weight)} kg × ${top.reps}</div>`:''}
    ${logs.length?`<div class="section-label">Wie lief es?<span class="sl-r" id="feelHint">optional</span></div><div class="feel" id="feelRow">${[1,2,3,4,5].map(n=>`<button class="chip" data-n="${n}" onclick="feelPick(${n})">${n}</button>`).join('')}</div>`:'<div class="note mb-3">Noch kein Satz mit Wiederholungen eingetragen.</div>'}
    <div class="body center muted mt-4 mb-4">${prs>0?'Rekord-Tag – genau so wächst man.':'Sauber durchgezogen – Erholung nicht vergessen.'}</div>
    <button class="btn block" onclick="finishWorkout()">Fertig</button>
    <button class="btn block sec mt-2" onclick="finishWorkout('home')">Fertig und zur Home</button>`);}
function feelPick(n){openWorkoutSummary.feel=n;document.querySelectorAll('#feelRow .chip').forEach(c=>c.classList.toggle('on',+c.dataset.n===n));
  const h=document.getElementById('feelHint');if(h)h.textContent=['','Schwach','Zäh','Okay','Gut','Stark'][n];}
async function finishWorkout(dest){const d=openWorkoutSummary.data||{};const feel=openWorkoutSummary.feel;
  closeAllSheets();restStop();trainBarSync.dismissed=today();trainBarSync();
  trWakeLock.want=0;trWakeRelease(); // Einheit vorbei – der Bildschirm darf wieder schlafen
  if(feel&&d.exIds&&d.exIds.length){const day=curDayObj();
    API.post('/exercise-notes',{user_id:VIEW_USER,exercise_id:d.exIds[0],note:`Training abgeschlossen${day?' ('+day.name+')':''} – Gefühl ${feel}/5`,flagged:false}).catch(()=>{});}
  openWorkoutSummary.feel=null;
  if(d.sets>0)celebrate(d.prs>0?'🏆':'💪','Training beendet',`${pl(d.sets,'Satz','Sätze')} · ${fmtNum(d.volume||0)} kg bewegt`);
  if(typeof refreshAchievements==='function')refreshAchievements();_inv();
  if(dest==='home')setTimeout(()=>go('home'),d.sets>0?900:0);}

// ---- Übungs-Menü („···"): Notiz · Ausführung · Teilen · Verlauf · Bearbeiten · Löschen (+ Coach: sortieren) ----
function exMenu(id,name){const ex=_findEx(id);name=name||ex?.name||'Übung';const cv=coachView();
  let h='<div class="rows">';
  h+=_mrow('pencil','Notiz',`openExNote(${id},'${esc(name)}')`);
  h+=_mrow('play','Ausführung',`openVideo('${esc(name)}','${esc(ex?.video_url||'')}','${esc(twFormTerm(ex))}')`);
  if(typeof shareViaLink==='function')h+=_mrow('share','Teilen',`shareViaLink('exercise',${id})`);
  // FIX-B1 · B9: Der Untertitel nennt das Kürzel e1RM nur dort, wo die Karte auch erscheint.
  h+=_mrow('chartLine','Verlauf',`openExHistory(${id},'${esc(name)}')`,{sub:libProOn()?'Kurve, Bestleistung und e1RM':'Kurve und Bestleistung'});
  h+=_mrow('settings','Bearbeiten',`editExercise(${id})`);
  // B-I.3: „Tauschen" stand in RATE-25-training wörtlich unter „Fehlt" (`08_exmenu.png`), obwohl die
  // Spalte `replaces_id` seit 2.6.0 existiert. Der Supersatz ebenso (`group_id`, Befund L10).
  // FIX-B1 · B9: beide ab Stufe 2 (libProOn) – eine bestehende Gruppe bleibt trotzdem in Kraft, sie
  // wird nur nicht mehr von einem Anfänger angelegt oder aufgelöst.
  if(libProOn()){
    h+=_mrow('refresh','Übung tauschen',`libSwapSheet(${id})`,{sub:'Slot und Verlauf bleiben'});
    h+=_mrow('link','Supersatz',`libGroupSheet(${id})`,{sub:LIB_GRP[id]?'Gruppe '+LIB_GRP[id].tag.charAt(0)+' ändern oder auflösen':'Mit einer zweiten Übung koppeln – eine Pause'});}
  if(cv){h+=_mrow('arrowLeft','Nach oben',`moveExercise(${id},-1)`);h+=_mrow('arrowRight','Nach unten',`moveExercise(${id},1)`);}
  h+=_mrow('trash','Löschen',`delExercise(${id})`,{cls:'tone-red'});
  h+='</div>';openSheet(name,h);}
function exGear(id,name){return exMenu(id,name);} // legacy-Name
// Reihenfolge (Coach): PUT /training-days/:id/reorder {order} – die Batch-Route ist Teil des API-Vertrags (2.1).
// (Kein Einzel-Fallback mehr: PUT /exercises/:id erwartet einen 0-basierten Ziel-Index und würde die Übung
//  mit dem alten `position:j+1` eine Stelle zu weit schieben.)
async function moveExercise(id,dir){const day=curDayObj();if(!day)return;const ids=day.exercises.map(e=>e.id);const i=ids.indexOf(id);const j=i+dir;
  if(i<0||j<0||j>=ids.length)return toast(dir<0?'Steht schon ganz oben':'Steht schon ganz unten');
  [ids[i],ids[j]]=[ids[j],ids[i]];
  const r=await API.put('/training-days/'+day.id+'/reorder',{order:ids});
  if(r.status===200){closeAllSheets();_progInvalidate();await loadPlan();const after=curDayObj()?.exercises.map(e=>e.id)||[];renderEx();_inv();
    toast(after.join(',')===ids.join(',')?'Reihenfolge gespeichert ✓':'Sortieren kommt mit dem nächsten Server-Update');}
  else toast(r.data?.error||'Reihenfolge konnte nicht gespeichert werden');}

// ---- Notizen / Beschwerden zu einer Übung ----
async function openExNote(exId,name){const title='Notizen: '+name;openSheet(title,'<div class="spinner"></div>');
  const r=await API.get('/exercise-notes/'+VIEW_USER+'/'+exId);const notes=r.data?.notes||[];const cv=coachView();
  let h=`<div class="note mb-3">${cv?'Schreib deinem Athleten einen Kommentar zu dieser Übung – z.B. „nächstes Mal 2,5 kg mehr, du schaffst das".':'Notizen zu dieser Übung – z.B. „nächstes Mal mehr Gewicht", „lief super" oder eine Beschwerde wie „Schulter zwickt".'}</div>
    <div class="field"><label>Neue Notiz</label><textarea id="en_note" rows="2" placeholder="${cv?'Dein Kommentar für den Athleten…':'Was möchtest du festhalten?'}"></textarea></div>
    <label class="switch-row rows mb-3"><span class="rl">Als Problem markieren<small>${cv?'Wird in deiner Athletenliste hervorgehoben':'Dein Coach wird informiert'}</small></span><input type="checkbox" class="rcheck" id="en_flag"></label>
    <button class="btn block" onclick="saveExNote(${exId},'${esc(name)}')">${cv?'Kommentar senden':'Notiz speichern'}</button>`;
  if(notes.length){h+=`<div class="section-label">Verlauf</div><div class="rows">`+notes.map(n=>{const isCoach=n.author_role==='coach';
    return `<div class="row"><div class="rl">${esc2(n.note)}<small>${fmtDate(n.date,{year:'2-digit'})}</small></div><div class="rr"><span class="pill ${isCoach?'blue':'neutral'}">${isCoach?'Coach':'Du'}</span>${n.flagged?'<span class="pill red">Problem</span>':''}</div></div>`;}).join('')+`</div>`;}
  openSheet(title,h);}
async function saveExNote(exId,name){const note=val('en_note');if(!note)return showFieldErr('sheetBody','Bitte etwas eingeben','en_note');
  const flag=!!document.getElementById('en_flag')?.checked;
  const r=await API.post('/exercise-notes',{user_id:VIEW_USER,exercise_id:exId,note,flagged:flag});
  if(r.status===200){toast('Gespeichert ✓');openExNote(exId,name);}else toast(r.data?.error||'Fehler');}

// `guide` (optional): Name der Technik-Karte dieser Uebung. Steht sie zur Verfuegung, kommt sie ZUERST –
// drei Punkte zur Ausfuehrung und drei typische Fehler sind das, was ein Anfaenger vor dem ersten Satz
// braucht; der Video-Link darunter ist der zweite Schritt und fuehrt weiterhin zum Coach-Video, wenn
// eines hinterlegt ist. Ohne `guide` sieht das Sheet aus wie bisher (aufgerufen aus dem Uebungs-Menue).
function openVideo(name,url,guide){const q=encodeURIComponent(name+' richtige Ausführung Technik');
  const safeUrl=/^https?:\/\/\S+$/.test(url||'')?url:''; // nur echte http(s)-Links (kein javascript: o.ä.)
  const yt=safeUrl||`https://www.youtube.com/results?search_query=${q}`;
  const card=twFormHTML(guide);
  openSheet('Ausführung: '+name,card+`<div class="note mb-3">${safeUrl?'Vom Coach hinterlegte Anleitung.':'Such-Ergebnisse für die korrekte Ausführung. Achte auf saubere Technik vor Gewicht.'}</div>
    <a class="btn block" href="${esc2(yt)}" target="_blank" rel="noopener">${icon('play',18)} Auf YouTube ansehen</a>
    <a class="btn block sec mt-2" href="https://www.muscleandstrength.com/exercises" target="_blank" rel="noopener">Exercise-Datenbank (Bilder und Anleitung)</a>`);}

// ---- Tage und Übungen anlegen/bearbeiten ----
function addDay(){openSheet('Neuer Trainingstag',`<div class="field"><label>Name</label><input id="dayName" placeholder="z.B. Push, Lower 2, Beine" maxlength="60"></div><button class="btn block" onclick="confirmAddDay()">Erstellen</button>`);
  setTimeout(()=>{try{document.getElementById('dayName')?.focus();}catch(e){}},350);}
async function confirmAddDay(){const name=val('dayName');if(!name)return showFieldErr('sheetBody','Gib dem Tag einen Namen','dayName');
  const r=await API.post('/days',{plan_id:PLAN.plan.id,name});
  if(r.status===200){closeAllSheets();await loadPlan();CUR_DAY=r.data.id;_inv();
    if(document.getElementById('exlist')){renderDaySel();renderEx();}else renderWorkout(document.getElementById('views'));}
  else toast(r.data?.error||'Fehler');}
// Technik-Auswahl: nur echte Techniken aus dem Lexikon (kind-Flag vom Server oder Whitelist), Rest ist „Eigene…"
const TECH_WHITELIST=['widowmaker','continuous reps','rest pause','paired set','drop-set','double drop-set','tripple drop-set','triple drop-set','partials','up','mrp*2','tempo'];
function _techDefs(){const list=DEFS||[];const hasKind=list.some(d=>d.kind);
  return list.filter(d=>hasKind?d.kind==='technique':TECH_WHITELIST.some(w=>String(d.term||'').toLowerCase().startsWith(w)));}
function exForm(ex){const techs=_techDefs();const cur=ex?.technique||'';const inList=techs.some(d=>d.term===cur);const more=!!(ex?.video_url||ex?.notes);
  return `
  <div class="field"><label for="ex_name">Übung</label><input id="ex_name" value="${esc2(ex?.name||'')}" placeholder="z.B. Beinpresse" maxlength="120" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="libTa" aria-autocomplete="list" oninput="libTypeahead(this.value)" onfocus="libTypeahead(this.value)"></div>
  <div class="lib-ta hidden" id="libTa" role="listbox" aria-label="Vorschläge aus der Übungsbibliothek"></div>
  <div id="libDup"></div>
  <div class="field"><label for="ex_muscle">Muskelgruppe</label><input id="ex_muscle" value="${esc2(ex?.muscle||'')}" placeholder="z.B. Quadrizeps" maxlength="60" autocomplete="off" oninput="this.dataset.lib=''"></div>
  <div class="caption lib-why hidden" id="libWhy"></div>
  <div class="grid-2">
    <div class="field"><label>Sätze (1–10)</label><input id="ex_sets" type="number" inputmode="numeric" min="1" max="10" value="${ex?.target_sets||3}"></div>
    <div class="field"><label>Wdh</label><input id="ex_reps" value="${esc2(ex?.target_reps||'')}" placeholder="8-12" maxlength="20"></div>
  </div>
  <div class="field"><label>Technik (optional)</label>
    <select id="ex_tech_sel" onchange="techSel(this.value)">
      <option value="">– keine –</option>
      ${techs.map(d=>`<option value="${esc2(d.term)}"${cur===d.term?' selected':''}>${esc2(_defLabel(d.term))}</option>`).join('')}
      <option value="__custom"${cur&&!inList?' selected':''}>Eigene…</option>
    </select>
    <input id="ex_tech" class="field mt-2${cur&&!inList?'':' hidden'}" value="${esc2(cur)}" placeholder="Technik frei eingeben" maxlength="300">
    <button type="button" class="btn sm sec mt-2" onclick="pickTechnique()">${icon('info',16)} Erklärung</button>
  </div>
  <button type="button" class="btn sm sec mb-3" id="exMoreBtn" onclick="exFormMore()">${icon('chevronDown',16)} ${more?'Weniger':'Mehr (Video, Notizen)'}</button>
  <div id="exMore" class="${more?'':'hidden'}">
    <div class="field"><label>Video-Link (optional)</label><input id="ex_video" type="url" inputmode="url" value="${esc2(ex?.video_url||'')}" placeholder="https://…" maxlength="500"></div>
    <div class="field"><label>Notizen (optional)</label><textarea id="ex_notes" rows="2" maxlength="1000">${esc2(ex?.notes||'')}</textarea></div>
  </div>`;}
function techSel(v){const inp=document.getElementById('ex_tech');if(!inp)return;
  if(v==='__custom'){inp.classList.remove('hidden');inp.value='';try{inp.focus();}catch(e){}}
  else{inp.classList.add('hidden');inp.value=v;}}
function exFormMore(){const m=document.getElementById('exMore'),b=document.getElementById('exMoreBtn');if(!m)return;
  const open=m.classList.toggle('hidden')===false;if(b)b.innerHTML=icon('chevronDown',16)+' '+(open?'Weniger':'Mehr (Video, Notizen)');}
function _curTech(){const sel=document.getElementById('ex_tech_sel')?.value;return sel==='__custom'||sel==null?val('ex_tech'):sel;}
function _exFormBody(){return {muscle:val('ex_muscle'),name:val('ex_name'),technique:_curTech(),video_url:val('ex_video'),target_sets:clampSets(val('ex_sets')),target_reps:val('ex_reps'),notes:val('ex_notes')};}
function addExercise(){if(!curDayObj())return toast('Erstelle zuerst einen Trainingstag');
  EX_FORM_CTX={id:null,draft:null};LIB_TA=[];LIB_DUP=null;LIB_ALIAS=null;
  openSheet('Übung hinzufügen',exForm(null)+`<button class="btn block" onclick="confirmAddExercise()">Hinzufügen</button>`);}
async function confirmAddExercise(){const body={day_id:CUR_DAY,..._exFormBody()};
  if(!body.name)return showFieldErr('sheetBody','Übungsname fehlt','ex_name');
  // FIX-B1 · B6: Die Bibliothek wirkt auch ohne Tipp auf einen Vorschlag. Der Katalogtreffer zum
  // ausgeschriebenen Namen füllt die leere Muskelgruppe und stellt seine Synonyme für die
  // Dublettenprüfung bereit – sonst legt genau der Athlet, der den Namen kennt, eine Übung ohne
  // Muskelgruppe an, und sie verschwindet in der Analyse unter „Ohne Muskelgruppe".
  const hit=await libExactHit(body.name);
  let vonLib='';
  if(hit){if(!String(body.muscle||'').trim()&&hit.muscle){body.muscle=hit.muscle;vonLib=hit.muscle;}
    LIB_ALIAS={n:libNorm(hit.name),a:(hit.a||[]).slice()};}
  // Dublettenriegel: erkannt wird beim Tippen (libDupDraw), gehalten wird hier. Der Hinweis unter dem
  // Namensfeld trägt die beiden Wege („zusammenlegen" / „trotzdem neu"), deshalb führt der Knopf nur
  // dorthin, statt selbst zu entscheiden – die Wahl bleibt beim Athleten (P10).
  libDupDraw(body.name);
  if(LIB_DUP){const box=document.getElementById('libDup');
    if(box)try{box.scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}
    toast('Diese Übung steht schon in deinem Plan – wähle unten, wie es weitergeht');return;}
  const r=await API.post('/exercises',body);
  if(r.status===200){closeAllSheets();_progInvalidate();await loadPlan();renderEx();_inv();
    toast(vonLib?'Hinzugefügt ✓ – Muskelgruppe „'+vonLib+'" aus der Bibliothek':'Hinzugefügt ✓');}
  else toast(r.data?.error||'Fehler');}
function editExercise(id){const ex=_findEx(id);if(!ex)return;EX_FORM_CTX={id:id,draft:null};LIB_TA=[];LIB_DUP=null;LIB_ALIAS=null;
  openSheet('Übung bearbeiten',(ex.coach_locked&&ME.role==='athlete'?`<div class="note warn mb-3">Diese Übung stammt von deinem Coach. Änderst du sie, weicht dein Plan von der Vorgabe ab.</div>`:'')+exForm(ex)+`<button class="btn block" onclick="confirmEditExercise(${id})">Speichern</button>`);}
// body wird VOR einer Rückfrage eingesammelt (das Formular verliert beim Sheet-Wechsel getippte Werte)
async function confirmEditExercise(id,confirm,body){body=body||_exFormBody();
  if(!body.name)return showFieldErr('sheetBody','Übungsname fehlt','ex_name');
  const send={...body};if(confirm)send.confirm=true;const r=await API.put('/exercises/'+id,send);
  if(r.status===409&&r.data?.warning){confirmSheet('Coach-Vorgabe ändern',r.data.message,{label:'Trotzdem ändern',onYes:()=>confirmEditExercise(id,true,body)});return;}
  if(r.status===200){closeAllSheets();_progInvalidate();await loadPlan();renderEx();_inv();toast('Gespeichert ✓');}else toast(r.data?.error||'Fehler');}
// Löschen: Rückfrage im Sheet, danach 5 s Rückgängig (Soft-Delete + /restore)
async function delExercise(id,confirm){const ex=_findEx(id);const name=ex?.name||'Übung';
  if(!confirm){confirmSheet('Übung löschen',`„${name}" aus diesem Tag entfernen? Du kannst es danach 5 Sekunden lang rückgängig machen.`,{label:'Löschen',onYes:()=>delExercise(id,'ok')});return;}
  const r=await API.del('/exercises/'+id,confirm==='force'?{confirm:true}:{});
  if(r.status===409&&r.data?.warning){confirmSheet('Coach-Übung löschen',r.data.message,{label:'Trotzdem löschen',onYes:()=>delExercise(id,'force')});return;}
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();_progInvalidate();await loadPlan();renderEx();_inv();
  toast('„'+name+'" gelöscht',{label:'Rückgängig',fn:async()=>{const rr=await API.post('/exercises/'+id+'/restore');
    if(rr.status===200){await loadPlan();renderEx();_inv();toast('Wiederhergestellt ✓');}else toast('Konnte nicht wiederhergestellt werden');}});}

// FIX-B1 · B9 · EINE Stufenregel für die Profi-Teile dieser Datei.
// Dieselbe Quelle wie `twRirOn` und `twSetTypesOn` (twLevel), dieselbe Schwelle wie in der Analyse
// (analysis.js `an2Level()>=2`). Was daran hängt: die e1RM-Karte im Verlaufs-Sheet (STRATEGY 4.3
// Level 1: „Keine e1RM-Kurve"), „Übung tauschen" (STRATEGY 4.1 Zeile „Plan ändern": ab Level 2) und
// der Supersatz. Vorher stand all das einem Anfänger offen – und ausgerechnet die e1RM-Karte
// erklärte ihm mit einer Literaturangabe, warum sie leer ist.
// WARUM der Supersatz hier auf Stufe 2 und nicht auf 3 steht, obwohl STRATEGY 4.1 ihn unter
// „Werkzeuge Level 3" führt: das Coach-Blatt beschreibt Stufe 3 heute wörtlich als „in der App
// dasselbe wie Fortgeschritten" (coach.js CO2_LV_TXT). Eine Funktion auf 3 zu legen, die der Coach
// dort nicht angekündigt bekommt, wäre ein neuer Widerspruch statt eines behobenen. Die Verschiebung
// auf Stufe 3 gehört mit dem Coach-Text zusammen und ist deshalb verschoben (FIX-B1-B-I.3, Abschnitt
// „Verschoben") – eine Zeile hier, eine Zeile in CO2_FEATS, ein Satz in CO2_LV_TXT.
function libProOn(){return twLevel()>=2;}

// ---- e1RM-Verlauf einer Übung (B-I.3) --------------------------------------------------------
// e1RM = geschätztes Einwiederholungsmaximum. Die Kennzahl, die ein Kraftsportler wirklich verfolgt –
// aber nur, wenn sie ehrlich gerechnet ist. Zwei Grenzen, beide belegt:
//  · NUR Arbeitssätze. `set_logs.set_type` gibt es seit 2.6.0, die Satzarten in der Oberfläche seit
//    2.8.0. Ein Aufwärmsatz 60 kg × 15 ergäbe rechnerisch 90 kg und schlüge damit den echten
//    Arbeitssatz 67,5 kg × 8 (85,5 kg) – genau dieser Fall stand in RECHEN-REVIEW D14.
//  · NUR bis 10 Wiederholungen. Oberhalb davon laufen Epley, Brzycki und Lombardi um bis zu 22 %
//    auseinander (Mayhew u.a. 2008; RESEARCH-25-anfaenger-profi K7/Q31). Eine Zahl, die so stark von
//    der gewählten Formel abhängt, ist keine Aussage über die Kraft des Athleten.
// Die Formel ist dieselbe wie im Rechenkern des Servers (logic.js estimate1RM, Epley) – nur die
// Obergrenze ist hier strenger (10 statt 12), und genau das steht auch unter der Kurve (P3).
const LIB_E1RM_MAX=10;
function libE1rm(w,r){w=+w||0;r=+r||0;
  if(w<=0||r<=0||r>LIB_E1RM_MAX)return 0;
  return r===1?w:Math.round(w*(1+r/30)*10)/10;}
// FIX-B1 · B12: WAS bei einem Satz auf der Hantel liegt. `set_logs.bodyweight` wird seit 2.8.0
// geschrieben und zählt beim Server in der Last bereits mit (SQL_LOAD, server.js). Ein Klimmzug mit
// Gurt (bodyweight 82, weight 10) ist damit ein 92-kg-Satz; ein Klimmzug ohne Gurt und ohne
// eingetragenes Körpergewicht (weight 0, bodyweight NULL) bleibt, was er ist: eine Übung, aus der
// sich ohne Gewichtsangabe keine Maximalkraft schätzen lässt. Genau das sagt die Fußnote dann auch,
// statt ihn mit dem falschen Grund („Aufwärmsatz") wegzuerklären.
function libE1rmLoad(l){const w=+l.weight||0,b=+l.bodyweight||0;
  return b>0?Math.round((w+b)*10)/10:w;}
// Je Einheit der BESTE zählende Satz. Rückgabe zusätzlich mit der Zahl der Sätze, die draußen bleiben –
// ohne diese Zahl wäre die Kurve eine Auswahl, die sich nicht zu erkennen gibt. `kg0` zählt davon die
// Arbeitssätze OHNE jede Gewichtsangabe getrennt: sie brauchen einen eigenen Satz (B12).
function libE1rmRows(logs){const by={};let raus=0,gesamt=0,kg0=0,bw=0;
  for(const l of (logs||[])){
    if(!(l.reps>0))continue;
    gesamt++;
    const work=(l.set_type||'work')==='work';
    const load=libE1rmLoad(l);
    const e=work?libE1rm(load,l.reps):0;
    if(!e){raus++;if(work&&load<=0)kg0++;continue;}
    if(+l.bodyweight>0)bw++;
    const d=by[l.date];
    if(!d||e>d.value)by[l.date]={date:l.date,value:e,weight:load,reps:+l.reps,bw:+l.bodyweight>0};}
  return {rows:Object.values(by).sort((a,b)=>a.date<b.date?-1:1),raus,gesamt,kg0,bw};}
function libE1rmHTML(logs){
  // FIX-B1 · B9: DIESELBE Stufenregel wie in der Analyse (analysis.js `if(an2Level()<2)return ''`).
  // Bis hierher hing NUR das RIR-Feld und die Satzart an der Stufe – die Profi-Kennzahl e1RM stand
  // auch einem Anfänger im Trainings-Sheet, und zwar ausgerechnet in ihrer Leerform mit
  // Literaturangabe. STRATEGY 4.3 Level 1: „Keine e1RM-Kurve."
  if(!libProOn())return '';
  const {rows,raus,gesamt,kg0,bw}=libE1rmRows(logs);
  // Die Fußnote steht IMMER da – auch (und gerade) dann, wenn keine Kurve entsteht. Sonst bliebe
  // unerklärt, warum eine Übung mit 40 Sätzen hier nichts zeigt.
  const kgs=kg0?` ${kg0===raus?'Alle davon sind':fmtNum(kg0)+' davon sind'} Sätze <b>ohne Gewichtsangabe</b> (Klimmzug, Dip, Liegestütz am eigenen Körpergewicht) – dafür fehlt der Formel die Last. Trag beim Satz dein Körpergewicht oder das Zusatzgewicht ein, dann rechnet sie mit.`:'';
  const bws=bw?` Bei ${pl(bw,'Satz','Sätzen')} ist dein eingetragenes Körpergewicht in der Last enthalten – genauso rechnet der Server dein Volumen.`:'';
  const fuss=`<div class="lib-e1n">Epley-Formel: Gewicht × (1 + Wiederholungen ÷ 30). Gezählt wird je Einheit der beste <b>Arbeitssatz mit höchstens ${LIB_E1RM_MAX} Wiederholungen</b> – Aufwärm-, Drop- und Backoff-Sätze bleiben draußen, und über ${LIB_E1RM_MAX} Wiederholungen laufen die gängigen Formeln zu weit auseinander für eine belastbare Zahl (Mayhew u.a. 2008).${raus?` Von ${pl(gesamt,'eingetragenen Satz','eingetragenen Sätzen')} zählen deshalb ${fmtNum(raus)} nicht mit.`:''}${kgs}${bws}</div>`;
  if(rows.length<2)return `<div class="section-label">Geschätzte Maximalkraft (e1RM)</div>
    <div class="note">${rows.length?`Bisher gibt es genau eine Einheit mit einem zählenden Satz (${_fmtW(rows[0].weight)} kg × ${fmtNum(rows[0].reps)} → e1RM ${_fmtW(rows[0].value)} kg). Ab der zweiten entsteht hier eine Kurve.`:(kg0?'Für eine Schätzung fehlt noch ein Satz mit einer Gewichtsangabe.':'Für eine Schätzung fehlt noch ein passender Satz.')}</div>${fuss}`;
  const last=rows[rows.length-1],first=rows[0];
  const diff=Math.round((last.value-first.value)*10)/10;
  // Bei Gleichstand gewinnt die JÜNGERE Einheit (>=): sonst stünde „bester Wert am 7. Sept" neben
  // demselben Wert von heute, und der Athlet suchte nach einem Unterschied, den es nicht gibt.
  // Steht der Bestwert ohnehin in der letzten Einheit, entfällt der Satz ganz.
  const best=rows.reduce((a,b)=>b.value>=a.value?b:a,rows[0]);
  const A=_axis5(rows.map(r=>r.value),0.5);
  return `<div class="section-label">Geschätzte Maximalkraft (e1RM)<span class="sl-r">Schätzung</span></div>
    <div class="chart-card"><div class="ch-h"><div class="t">${_fmtW(last.value)} kg${diff?` <span class="${diff>0?'tone-green':'tone-red'}">${diff>0?'+':'−'}${_fmtW(Math.abs(diff))} kg</span>`:''}</div><div class="v">${rows.length===1?'1 Einheit':fmtNum(rows.length)+' Einheiten'}</div></div>
      ${lineChart(rows,'kg',{domain:A.domain,step:A.step,tickFmt:_fmtW})}
      <div class="lib-e1n">Zuletzt am ${esc2(fmtDate(last.date).replace(/\.$/,''))}: ${_fmtW(last.weight)} kg × ${fmtNum(last.reps)} → ${_fmtW(last.value)} kg.${best.date!==last.date?` Bester Wert: ${_fmtW(best.value)} kg (${_fmtW(best.weight)} kg × ${fmtNum(best.reps)} am ${esc2(fmtDate(best.date).replace(/\.$/,''))}).`:' Das ist zugleich dein bester Wert.'}</div>
      ${fuss}</div>`;}

// Achse mit genau 5 Gitterlinien und „schönem" Schritt (Vielfaches von base). lineChart2 leitet die rechte
// Beschriftung aus der Position der linken Linien ab – nur mit gleicher Linienzahl bleiben beide Achsen rund.
function _axis5(vals,base){const mn=Math.min(...vals),mx=Math.max(...vals);
  for(const m of [1,2,2.5,5,10,20,25,50,100,200,250,500,1000]){const c=base*m;const lo=Math.floor(mn/c)*c;
    if(lo+4*c>=mx-1e-9)return {domain:[Math.round(lo*1e6)/1e6,Math.round((lo+4*c)*1e6)/1e6],step:c};}
  const c=((mx-mn)/4)||base;return {domain:[mn,mn+4*c],step:c};}
// ---- Verlauf einer Übung: Top-Gewicht + Reps je Einheit, freundlicher Einzel-Zustand, letzte Einheiten ----
// FIX-B1 · B1: EINE BEWEGUNG, EIN VERLAUF.
// Bis hierher las dieses Sheet als EINZIGE Stelle der App hart nach `exercise_id` (`/api/logs?exercise_id=`).
// Der Rest – Plan-Karte, Progression, Analyse, `/api/exercise-history` – gruppiert seit jeher über
// LOWER(TRIM(name)), also über die BEWEGUNG (server.js movementSetLogs). In Marcos echtem Plan steht
// „Leg Press" zweimal (ID 3 und 4). Gemessen am Prüfserver: das Sheet von ID 3 sagte „210 kg
// Bestleistung · 9 Einheiten", das von ID 4 „Erste Einheit: 207,5 kg" – während der Server für BEIDE
// IDs maxWeight 210 und neun Einheiten lieferte. Zwei Bildschirme, dieselbe Maschine, zwei Wahrheiten.
// Jetzt gilt für dieses Sheet dieselbe Quelle wie überall:
//   · die Kennzahlen kommen aus `GET /api/exercise-history/:uid/:exId` (dieselbe Antwort, die die
//     Plan-Karte und die Analyse lesen),
//   · die Satzzeilen aus `/api/logs?exercise_id=` für JEDE Übung des Plans mit demselben
//     Bewegungsschlüssel – nur so stehen unter der Kurve auch die Sätze, die zur Zwillings-ID gehören.
// Fällt der Server aus (offline, ältere Fassung ohne die Route), rechnet die Zusammenführung der
// Satzzeilen dieselben Zahlen – sie ist der Rückfall, nicht die Zweitmeinung.
function libMoveKey(s){return String(s??'').trim().toLowerCase();}
// Alle Übungs-IDs des Plans, die dieselbe Bewegung meinen. Der Schlüssel ist BEWUSST der des Servers
// (LOWER(TRIM(name))) und nicht `libNorm`: die Zusammenführung muss exakt dieselbe Menge treffen wie
// `movementSetLogs`, sonst stünde neben einer Server-Zahl eine Client-Liste mit anderem Inhalt.
// `exId` darf fehlen: „Getauscht · früher: …" öffnet den Verlauf der Vorgängerin, und ältere Stände
// kennen deren Id nicht (libPrevHTML übergibt dann null). Eine Abfrage mit `exercise_id=null` wäre ein
// 400 und stünde als „Teil deiner Sätze ließ sich nicht laden" da, obwohl gar nichts kaputt ist.
function libSiblings(exId,key){const out=[];
  if(exId!=null&&isFinite(exId)&&+exId>0)out.push(+exId);
  if(!key)return out;
  for(const d of (PLAN?.days||[]))for(const e of (d.exercises||[]))
    if(e.id!==exId&&libMoveKey(e.name)===key&&!out.includes(e.id))out.push(e.id);
  return out;}
// FIX-B1 · B4: WAS REKORDFÄHIG IST.
// Vorher filterte diese Stelle nur `reps>0`. Ein Aufwärmsatz 260 kg × 10 stand damit als „260 kg
// Bestleistung · +60 kg seit Beginn" in der Kachel – zwei Zentimeter über der Zusage der e1RM-Fußnote
// in DERSELBEN Karte, dass Aufwärmsätze draußen bleiben (RECHEN-REVIEW D14, gemessen: shots
// 16-tw-drop). Jetzt gilt hier wörtlich dieselbe Regel wie im Rechenkern und im Server:
// `isPrSet` / SQL_SET_PR (server.js:3237) – rekordfähig ist nur der ARBEITSSATZ. Ein Drop- und ein
// Backoff-Satz sind echte Arbeit (sie zählen weiter in Volumen und Tonnage, dort gilt SQL_SET_WORK),
// aber ein Satz nach dem Versagen mit reduziertem Gewicht ist nie eine Bestleistung.
// `null`, `''` und `'work'` sind dabei dasselbe: bis 2.8.0 wurde die Spalte gar nicht geschrieben,
// alle Altsätze sind Arbeitssätze.
function libCountable(l){const t=l.set_type;return t==null||t===''||t==='work';}
async function libMoveLogs(ids){
  // ?exercise_id= liefert ALLE Sätze dieser Übung (ohne die 500er-Kappung der ungefilterten Liste) – sonst
  // fehlen bei langer Historie ganze Einheiten und die Kurve beginnt zu spät.
  const res=await Promise.all(ids.map(id=>API.get('/logs/'+VIEW_USER+'?exercise_id='+id)));
  const seen=new Set(),out=[];let ok=true;
  res.forEach((r,i)=>{if(r.status!==200){ok=false;return;}
    for(const l of (r.data?.logs||[])){
    if(!(l.reps>0)||l.exercise_id!==ids[i])continue;
    const k=l.id==null?(l.exercise_id+'|'+l.date+'|'+l.set_no):l.id;
    if(seen.has(k))continue;seen.add(k);out.push(l);}});
  // Ein halb geladener Verlauf ist schlimmer als gar keiner: er SIEHT vollständig aus. Kam eine der
  // Abfragen nicht durch (kein Netz, Frist abgelaufen), sagt das Sheet es – gemessen einmal in genau
  // dieser Lage: „207,5 kg Bestleistung · 8 Einheiten" statt der 210 kg aus neun Einheiten.
  return {logs:out,ok};}
async function libHistSrv(exId){
  if(!(exId!=null&&isFinite(exId)&&+exId>0))return null;
  const r=await API.get('/exercise-history/'+VIEW_USER+'/'+exId);
  return (r.status===200&&r.data&&Array.isArray(r.data.history))?r.data:null;}
async function openExHistory(exId,name){name=name||'Übung';openSheet(name,'<div class="spinner"></div>');
  const key=libMoveKey(_findEx(exId)?.name||name);
  const ids=libSiblings(exId,key);
  const [srv,mv]=await Promise.all([libHistSrv(exId),libMoveLogs(ids)]);
  if(document.getElementById('sheetBody')==null)return; // Sheet inzwischen geschlossen
  const all=mv.logs;
  const logs=all.filter(libCountable);
  if(!all.length){openSheet(name,emptyState({icon:'chartLine',title:'Noch keine Sätze geloggt',text:'Ab dem ersten Training entsteht hier deine Kurve.'}));return;}
  // Aufwärm-, Drop- und Backoff-Sätze bleiben in der Liste SICHTBAR (sie wurden ja geleistet), aber sie
  // tragen ihr Kürzel (A/D/B) und bestimmen das Tages-Top nicht mehr. Wegzulassen wäre die zweite
  // Unehrlichkeit – dann fehlte plötzlich die halbe Einheit.
  const byDate={};all.forEach(l=>{const d=byDate[l.date]||(byDate[l.date]={date:l.date,sets:[],top:0,reps:0,zaehlt:false});d.sets.push(l);
    if(!libCountable(l))return;
    d.zaehlt=true;const w=l.weight||0;if(w>d.top||(w===d.top&&l.reps>d.reps)){d.top=w;d.reps=l.reps;}});
  const alle=Object.values(byDate).sort((a,b)=>a.date<b.date?-1:1);alle.forEach(d=>d.sets.sort((a,b)=>a.set_no-b.set_no));
  const rows=alle.filter(d=>d.zaehlt);
  const mark=s=>{const t=twType(s.set_type||'work');return _fmtW(s.weight)+' × '+s.reps+(t.s?' '+t.s:'');};
  const list=`<div class="section-label">Letzte Einheiten</div><div class="rows">${alle.slice(-8).reverse().map(d=>`<div class="row"><div class="rl">${fmtDate(d.date,{weekday:'short'})}<small>${d.sets.map(mark).join(' · ')}</small></div><div class="rr">${d.zaehlt?_fmtW(d.top)+' kg':'–'}</div></div>`).join('')}</div>`;
  // Wenn zusammengeführt wurde, steht es da. Ein Verlauf, der still aus zwei Plan-Zeilen stammt, wäre
  // wieder eine Zahl ohne Herkunft (P3) – und genau diese Zeile erklärt dem Athleten die Dublette.
  const merged=(ids.length>1?`<div class="note status mb-3">Diese Übung steht <b>${fmtNum(ids.length)}×</b> in deinem Plan. Der Verlauf hier fasst ${ids.length>2?'alle Einträge':'beide Einträge'} zusammen – so, wie der Server und die Analyse sie schon immer gezählt haben.</div>`:'')
    +(mv.ok?'':`<div class="note warn mb-3">Ein Teil deiner Sätze ließ sich gerade nicht laden. Die Kurve und die Zahlen unten können deshalb unvollständig sein – schau später noch einmal.</div>`);
  // B-I.3 · Wurde diese Übung getauscht, führt der Weg zur Vorgängerin von hier aus weiter – der
  // Verlauf ist nicht weg, er hängt nur an der alten Übung.
  const prev=libPrevHTML(_findEx(exId));
  const e1=libE1rmHTML(logs);
  if(!rows.length){openSheet(name,`${prev}${merged}<div class="note status mb-3">Bisher stehen hier nur Aufwärm-, Drop- und Backoff-Sätze. Für eine Bestleistung zählt der <b>Arbeitssatz</b> – in deinem Volumen sind Drop- und Backoff-Sätze weiterhin drin.</div>${e1}${list}`);return;}
  if(rows.length<2){const d=rows[0];
    openSheet(name,`${prev}${merged}<div class="note status mb-3">Erste Einheit: <b>${_fmtW(d.top)} kg × ${d.reps}</b> am ${fmtDate(d.date).replace(/\.$/,'')}. Ab der zweiten Einheit erscheint hier deine Kurve.</div>${e1}${list}`);return;}
  // Kennzahlen (Bestleistung, „seit Beginn", Einheiten) rechnen über ALLE Einheiten – die Kurve zeichnet nur
  // die letzten 52: nach drei Jahren hätte sie sonst 157 Einheiten × 2 Punkte auf 340 Einheiten Breite,
  // rund zwei Pixel je Punkt, und nichts mehr wäre abzulesen. Der Kartenkopf sagt, wenn gekürzt wurde.
  const EX_CHART_MAX=52;
  // Bestleistung und Einheitenzahl kommen vom Server, wenn er antwortet: er kennt zusätzlich die Sätze
  // unter inzwischen gelöschten Übungen desselben Namens, die im Plan nicht mehr stehen.
  const tops=rows.map(x=>x.top);
  const best=(srv&&srv.prs&&srv.prs.maxWeight>0)?srv.prs.maxWeight:Math.max(...tops);
  const einh=(srv&&srv.history.length)?srv.history.length:rows.length;
  const diff=Math.round((rows[rows.length-1].top-rows[0].top)*10)/10;
  const shown=rows.length>EX_CHART_MAX?rows.slice(-EX_CHART_MAX):rows;
  const A1=_axis5(shown.map(x=>x.top),0.5),A2=_axis5(shown.map(x=>x.reps),1); // beide Achsen mit 5 Linien -> rechts bleiben Reps ganzzahlig
  const data=shown.map(d=>({date:d.date,v1:d.top,v2:d.reps}));
  openSheet(name,`${prev}${merged}<div class="grid-3 hist-stats mb-3">
      <div class="tile"><div class="v">${_fmtW(best)}<em> kg</em></div><div class="l">Bestleistung</div></div>
      <div class="tile"><div class="v${diff>0?' tone-green':diff<0?' tone-red':''}">${diff>0?'+':''}${_fmtW(diff)}<em> kg</em></div><div class="l">seit Beginn</div></div>
      <div class="tile"><div class="v">${einh}</div><div class="l">Einheiten</div></div></div>
    <div class="chart-card"><div class="ch-h"><div class="t">Top-Gewicht und Wdh</div><div class="v">${shown.length<rows.length?'letzte '+fmtNum(shown.length)+' Einheiten':'kg · Wiederholungen'}</div></div>${lineChart2(data,'Gewicht','kg','Wdh','',{domain1:A1.domain,step1:A1.step,tickFmt1:_fmtW,domain2:A2.domain,step2:A2.step,tickFmt2:v=>fmtNum(Math.round(v))})}</div>${e1}${list}`);}

// ===== B-I.3 · Übungsbibliothek, Tausch und Supersätze (Präfix lib) ==========================
// Warum überhaupt: Eine Übung anlegen waren bis 2.9.0 DREI Freitextfelder (Name, Muskel, Wdh) – und
// genau deshalb liegen in Marcos echtem Plan VIER Übungen doppelt, jede mit eigener ID, eigenem
// Bestwert und eigener Progression: „Leg Press" (3, 4), „Bulgarian Splits Squats (Smith Machine)"
// (5, 6), „Incline Smith Machine Press" (11, 12), „Triceps Smith Machine Press" (13, 14)
// (gemessen an der Prüfdatenbank, GET /api/plan/2; RATE-25-training M11, RECHEN-REVIEW D15).
// Die Spalten `exercises.replaces_id` und `exercises.group_id` gibt es seit 2.6.0 und sie hatten
// null Treffer im Code – gebaut, nie benutzt.
//
// WOHER die Vorschläge kommen, in dieser Reihenfolge (P3 – jede Zahl und jeder Name nennt seine Quelle):
//   1. der eigene Plan (die Übungen, die dieser Athlet wirklich macht),
//   2. der Katalog des Servers (`GET /api/exercise-catalog?q=`, Beistellung B-I.2),
//   3. eine kleine Liste Grundübungen hier im Client – nur als Rückfall, wenn 2. fehlt.
// Der Server GEWINNT immer: seine Treffer stehen vor den eingebauten. Der Rückfall existiert, damit
// die Bibliothek auch ohne Netz und gegen einen Server ohne die neue Route etwas Nützliches zeigt,
// statt eine leere Liste zu behaupten.
const LIB_SRV={cat:null,grp:null};   // null = noch nicht geprüft; cat = Katalog-Route, grp = Supersatz-Route
// Gleiche Normalisierung wie die globale Suche (search.js): ä/ae→a, ö/oe→o, ü/ue→u, ß→ss, alles
// Übrige zu Leerzeichen. „Klimmzuege", „Klimmzüge" und „Klimmzüge " sind damit dasselbe Wort.
function libNorm(s){if(typeof _searchNorm==='function')return _searchNorm(s);
  return String(s??'').toLowerCase().replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss')
    .replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u').replace(/[^a-z0-9]+/g,' ').trim();}
// Grundübungen als Rückfall: Name | Muskelgruppe (deutscher Kanon wie logic.js MUSCLE_CANON_MAP) |
// Synonyme, deutsch und englisch. Bewusst KURZ gehalten – der vollständige Katalog (~150 Übungen)
// gehört in die Datenbank (B-I.1 `exercise_catalog`), nicht in jedes ausgelieferte Byte.
const LIB_SEED=`Kniebeuge|Quadrizeps|squat,back squat,langhantel kniebeuge
Frontkniebeuge|Quadrizeps|front squat
Beinpresse|Quadrizeps|leg press
Hackenschmidt-Kniebeuge|Quadrizeps|hack squat,hackenschmidt
Beinstrecker|Quadrizeps|leg extension,quad extension
Ausfallschritte|Quadrizeps|lunges,walking lunges,ausfallschritt
Bulgarische Kniebeuge|Gesäß|bulgarian split squat,split squat
Hüftstoß|Gesäß|hip thrust,glute bridge,huefstoss
Beinbeuger liegend|Beinbeuger|lying leg curl,leg curl
Beinbeuger sitzend|Beinbeuger|seated leg curl
Rumänisches Kreuzheben|Beinbeuger|romanian deadlift,rdl
Kreuzheben|Beinbeuger|deadlift
Wadenheben stehend|Waden|standing calf raise,calf raise
Wadenheben sitzend|Waden|seated calf raise,calves press
Adduktorenmaschine|Adduktoren|adductor machine,hip adduction
Abduktorenmaschine|Abduktoren|abductor machine,hip abduction
Bankdrücken|Brust|bench press,flat bench
Schrägbankdrücken|Brust|incline bench press,incline press
Kurzhantel-Bankdrücken|Brust|dumbbell bench press,db bench
Brustpresse|Brust|chest press,machine chest press
Butterfly|Brust|pec deck,fliegende,chest fly
Kabelzug-Fliegende|Brust|cable fly,cable crossover,cable flies
Dips|Brust|barrendips,chest dips
Liegestütze|Brust|push up,pushups
Klimmzüge|Rücken|pull up,pullups,chin up
Latzug|Rücken|lat pulldown,lat pull down,latziehen
Langhantelrudern|Rücken|barbell row,bent over row
Kurzhantelrudern|Rücken|dumbbell row,one arm row
Kabelrudern|Rücken|seated cable row,cable row
T-Bar-Rudern|Rücken|t bar row
Maschinenrudern|Rücken|machine row,hammer strength row
Überzüge|Rücken|straight arm pulldown,pullover
Rückenstrecker|Unterer Rücken|back extension,hyperextension
Schulterdrücken|Schultern|overhead press,shoulder press,military press
Kurzhantel-Schulterdrücken|Schultern|dumbbell shoulder press
Seitheben|Seitliche Schulter|lateral raise,side raise,lateral raises
Seitheben am Kabel|Seitliche Schulter|cable lateral raise
Frontheben|Vordere Schulter|front raise
Reverse Butterfly|Hintere Schulter|reverse fly,rear delt fly,reverse cable flies
Face Pulls|Hintere Schulter|face pull
Nackenziehen|Nacken|shrugs,schulterheben
Bizepscurls|Bizeps|biceps curl,barbell curl,curls
Kurzhantel-Curls|Bizeps|dumbbell curl
Hammercurls|Bizeps|hammer curl
Scottcurls|Bizeps|preacher curl,scott curl
Trizepsdrücken am Kabel|Trizeps|triceps pushdown,pushdown,tricep extension
Französisches Drücken|Trizeps|skullcrusher,lying triceps extension
Enges Bankdrücken|Trizeps|close grip bench press
Trizeps-Überkopfdrücken|Trizeps|overhead triceps extension
Unterarmcurls|Unterarme|wrist curl
Farmers Walk|Unterarme|farmer walk
Crunches|Bauch|crunch,sit up,situps
Beinheben|Bauch|leg raise,hanging leg raise,leg raises
Planke|Bauch|plank,unterarmstuetz
Russian Twist|Bauch|russian twist
Bauchmaschine|Bauch|ab machine,crunch machine
Kabel-Crunch|Bauch|cable crunch`;
// Zerlegt wird ERST, wenn jemand wirklich eine Übung sucht. Beim Start der App kostet die Liste damit
// genau die Bytes ihrer Zeichenkette und keine einzige Rechenoperation – und die meisten Sitzungen
// legen gar keine Übung an. (Vorher lief hier beim Laden 57 × `libNorm` plus Aufteilen der Synonyme.)
let LIB_SEED_P=null;
function libSeed(){if(LIB_SEED_P)return LIB_SEED_P;
  LIB_SEED_P=LIB_SEED.split('\n').map(l=>{const [name,muscle,al]=l.split('|');
    return {name,muscle,src:'seed',n:libNorm(name),a:(al||'').split(',').filter(Boolean).map(libNorm)};});
  return LIB_SEED_P;}
// Die Übungen des eigenen Plans – sie stehen immer an erster Stelle, weil sie belegbar sind:
// der Athlet macht sie. Doppelte Namen fallen hier schon zusammen (das ist ja der Punkt).
function libOwn(){const out=[],seen=new Set();
  for(const d of (PLAN?.days||[]))for(const e of (d.exercises||[])){const n=libNorm(e.name);
    if(!n||seen.has(n))continue;seen.add(n);
    out.push({name:e.name,muscle:e.muscle||'',src:'plan',day:d.name,n,a:[]});}
  return out;}
// Katalog des Servers, wenn es ihn gibt. Ein 404 wird EINMAL gemerkt (LIB_SRV.cat=false) und danach
// nicht mehr angefragt – ohne die Route soll die Tastatur nicht bei jedem Buchstaben ins Leere greifen.
// Die Antwort von B-I.2 sieht so aus: `{available:true, q, items:[{id,name,muscle,equipment,
// aliases:[…],is_seed,own}]}` – gemessen am Testserver. `aliases` kommt als LISTE; ältere oder andere
// Fassungen schicken eine Zeichenkette mit Kommas. Beides wird hier angenommen, damit die Bibliothek
// nicht an einer Formatfrage hängt.
async function libSrv(q){if(LIB_SRV.cat===false)return [];
  const r=await API.get('/exercise-catalog?q='+encodeURIComponent(q||''));
  if(r.status===404){LIB_SRV.cat=false;return [];}
  if(r.status!==200||!r.data)return [];
  if(r.data.available===false){LIB_SRV.cat=false;return [];}
  LIB_SRV.cat=true;
  const list=Array.isArray(r.data.items)?r.data.items:(Array.isArray(r.data.catalog)?r.data.catalog:(Array.isArray(r.data)?r.data:[]));
  const al=a=>(Array.isArray(a)?a:String(a||'').split(',')).filter(Boolean).map(libNorm);
  return list.filter(x=>x&&x.name).map(x=>({name:String(x.name),muscle:String(x.muscle||''),src:'katalog',
    n:libNorm(x.name),a:al(x.aliases)}));}
// Rang eines Treffers: kleiner ist besser. 0 = Name beginnt so, 1 = ein weiteres Wort im Namen
// beginnt so, 2 = ein Synonym beginnt so, 3 = steht irgendwo im Namen. -1 = kein Treffer.
function libRank(it,q){if(!q)return 3;
  if(it.n.startsWith(q))return 0;
  if((' '+it.n).includes(' '+q))return 1;
  if((it.a||[]).some(a=>a.startsWith(q)||(' '+a).includes(' '+q)))return 2;
  if(it.n.includes(q))return 3;
  return -1;}
// Die Trefferliste EINER Eingabe. Quelle je Treffer bleibt erhalten (`src`), damit die Zeile sagen
// kann, woher der Vorschlag kommt – und damit ein Server-Treffer den eingebauten verdrängt.
async function libFind(q){const nq=libNorm(q);
  const srv=nq.length>=2?await libSrv(q):[];
  const pool=[...libOwn(),...srv,...libSeed()];
  const seen=new Set(),out=[];
  for(const it of pool){const r=libRank(it,nq);if(r<0)continue;
    const key=it.n;if(seen.has(key))continue;seen.add(key);
    // Vorschläge unter einem ZWEITEN Namen („Beinpresse" aus dem Katalog, während im Plan „Leg Press"
    // steht) werden NICHT versteckt – der Athlet darf die deutsche Bezeichnung wählen. Erkannt wird
    // die Dublette stattdessen beim Übernehmen: libPick merkt sich die Synonyme des Treffers, und
    // libDupFind prüft sie gegen den Plan. Verstecken wäre die bequemere, aber stummere Lösung.
    out.push({...it,r});}
  const w={plan:0,katalog:1,seed:2};
  out.sort((a,b)=>(a.r-b.r)||(w[a.src]-w[b.src])||a.name.localeCompare(b.name,'de'));
  return out.slice(0,6);}
// ---- Typeahead im Übungsformular ----------------------------------------------------------
// Ein `oninput` je Tastendruck, aber höchstens eine Abfrage alle 180 ms – die Liste des Servers
// kommt nach, die eigenen und die eingebauten Treffer stehen sofort da.
let LIB_TA=[],LIB_TA_T=null;
// Die UNGEFILTERTE Trefferliste der letzten Eingabe. Sie wird für den exakten Treffer gebraucht –
// den, der in der Vorschlagsliste zu Recht fehlt, weil er schon im Feld steht (libExactHit).
let LIB_TA_ALL=[];
function libTypeahead(v){clearTimeout(LIB_TA_T);
  const q=String(v==null?val('ex_name'):v||'');
  LIB_TA_T=setTimeout(()=>libTaDraw(q),180);
  libDupDraw(q);}
// `aria-expanded` am Eingabefeld sagt einer Sprachausgabe, ob gerade Vorschläge dastehen – ohne das
// Attribut wäre die Liste für sie schlicht nicht vorhanden (dieselbe Regel wie beim Kartenkopf, A-II.6).
function libTaAria(on){const nm=document.getElementById('ex_name');
  if(nm)nm.setAttribute('aria-expanded',on?'true':'false');}
async function libTaDraw(q){const box=document.getElementById('libTa');if(!box)return;
  const nq=libNorm(q);
  if(nq.length<2){box.innerHTML='';box.classList.add('hidden');libTaAria(false);LIB_TA=[];return;}
  const hits=await libFind(q);
  const cur=document.getElementById('libTa');if(cur!==box)return; // Formular ist inzwischen weg
  LIB_TA_ALL=hits;
  // FIX-B1 · B6: Verglichen wird der ROHTEXT, nicht der normalisierte Name.
  // `libNorm` zieht Umlaut und Umschrift zusammen („bankdruecken" und „Bankdrücken" sind beide
  // „bankdrucken"). Der Vergleich gegen den normalisierten Namen warf deshalb JEDEN vollständig
  // getippten Treffer aus der Liste – gemessen: „hueftstoss" → leer, „bankdruecken" → alles außer
  // „Bankdrücken", „kniebeuge" → alles außer „Kniebeuge". Ausgerechnet wer den Namen kennt und zu
  // Ende tippt, sah die richtige Schreibweise nie, bekam die Muskelgruppe nicht gefüllt und verlor
  // damit auch die synonymbasierte Dublettenerkennung. Jetzt verschwindet ein Vorschlag nur noch,
  // wenn er Zeichen für Zeichen schon im Feld steht.
  const qt=String(q||'').trim();
  const rest=hits.filter(h=>h.name.trim()!==qt);
  LIB_TA=rest;
  if(!rest.length){box.innerHTML='';box.classList.add('hidden');libTaAria(false);return;}
  libTaAria(true);
  const tag={plan:'in deinem Plan',katalog:'Bibliothek',seed:'Grundübung'};
  box.innerHTML=rest.map((h,i)=>`<button class="lib-it" type="button" role="option" aria-selected="false" onclick="libPick(${i})">
    <span class="l">${esc2(h.name)}</span><span class="s">${esc2([h.muscle,tag[h.src]||''].filter(Boolean).join(' · '))}</span></button>`).join('');
  box.classList.remove('hidden');}
// Übernehmen: Name und Muskelgruppe. Der Muskel wird NUR gesetzt, wenn das Feld leer ist oder zuletzt
// von der Bibliothek stammt (`data-lib`) – wer „Gesäß" von Hand hineingeschrieben hat, behält es (P10:
// jede Automatik bleibt ein Vorschlag). Darunter steht ein Satz, woher der Wert kommt (P3).
function libPick(i){const h=LIB_TA[i];if(!h)return;
  const nm=document.getElementById('ex_name'),mu=document.getElementById('ex_muscle');
  if(nm)nm.value=h.name;
  const why=document.getElementById('libWhy');
  let filled=false;
  if(mu&&h.muscle&&(mu.value.trim()===''||mu.dataset.lib==='1')){mu.value=h.muscle;mu.dataset.lib='1';filled=true;}
  const box=document.getElementById('libTa');if(box){box.innerHTML='';box.classList.add('hidden');}
  libTaAria(false);LIB_TA=[];
  if(why){const q={plan:'aus deinem Plan',katalog:'aus der Übungsbibliothek',seed:'aus der Liste der Grundübungen'}[h.src]||'';
    why.textContent=filled?`Muskelgruppe „${h.muscle}" automatisch gefüllt – ${q}. Du kannst sie überschreiben.`:'';
    why.classList.toggle('hidden',!filled);}
  // Im Tausch-Sheet steht unter dem Feld schon ein Satz („aus der alten Übung übernommen"). Sobald die
  // Bibliothek den Wert setzt, stimmt der nicht mehr – dann tritt er ab, statt daneben zu stehen.
  const cap=document.getElementById('libSwapCap');if(cap)cap.classList.toggle('hidden',filled);
  // Die Synonyme des übernommenen Treffers merken: nur damit erkennt die Dublettenprüfung, dass
  // „Beinpresse" aus der Bibliothek und „Leg Press" aus Marcos Plan dieselbe Maschine sind.
  LIB_ALIAS={n:libNorm(h.name),a:(h.a||[]).slice()};
  libDupDraw(h.name);
  try{if(navigator.vibrate)navigator.vibrate(5);}catch(e){}}
// FIX-B1 · B6 · Der Treffer zu einem AUSGESCHRIEBENEN Namen.
// Wer „Kniebeuge" zu Ende tippt, tippt nie auf einen Vorschlag – und bekam deshalb weder die
// Muskelgruppe aus dem Katalog noch dessen Synonyme, mit denen die Dublettenprüfung „Beinpresse"
// und „Leg Press" als dieselbe Maschine erkennt. Gemessen vorher: Hinzufügen von „Kniebeuge" ergab
// `{"id":31,"name":"Kniebeuge","muscle":null}`. Diese Funktion holt den Treffer nach – aus der
// zuletzt gezeichneten Liste, sonst mit einer eigenen Abfrage.
async function libExactHit(name){const n=libNorm(name);if(!n)return null;
  const inAll=(LIB_TA_ALL||[]).find(h=>h.n===n);
  if(inAll)return inAll;
  try{return (await libFind(name)).find(h=>h.n===n)||null;}catch(e){return null;}}
// ---- Dublettenerkennung ---------------------------------------------------------------------
// Gesucht wird über den NORMALISIERTEN Namen im ganzen Plan, nicht nur im aktuellen Tag: „Leg Press"
// am Unterkörpertag und „leg press" am Ganzkörpertag sind dieselbe Übung mit zwei Bestwerten.
// Die gerade bearbeitete Übung zählt selbstverständlich nicht als ihre eigene Dublette.
let LIB_DUP=null;
let LIB_ALIAS=null; // Synonyme des zuletzt übernommenen Bibliothek-Treffers: {n, a:[…]}
// Alle Fundstellen, nicht nur die erste: in Marcos echtem Plan steht „Leg Press" ZWEIMAL, und ein
// Hinweis, der nur eine davon nennt, verschweigt die Hälfte des Problems.
// `alias` fängt den Fall, den der reine Namensvergleich NICHT sieht: die Bibliothek nennt die Maschine
// „Beinpresse", Marcos Plan nennt sie „Leg Press". Ohne diesen Zweig wäre die Bibliothek eine
// zusätzliche Quelle für Dubletten statt ein Mittel dagegen.
function libDupFind(name,selfId,alias){const n=libNorm(name);if(!n)return [];
  const al=new Set((alias||[]).filter(Boolean));
  const out=[];
  for(const d of (PLAN?.days||[]))for(const e of (d.exercises||[])){
    if(selfId!=null&&e.id===selfId)continue;
    const en=libNorm(e.name);
    if(en===n)out.push({ex:e,day:d,alias:false});
    else if(al.has(en))out.push({ex:e,day:d,alias:true});}
  return out;}
function libDupDraw(name){const box=document.getElementById('libDup');if(!box)return;
  const selfId=(EX_FORM_CTX&&EX_FORM_CTX.id!=null)?EX_FORM_CTX.id:null;
  const nm=name==null?val('ex_name'):name;
  const al=(LIB_ALIAS&&LIB_ALIAS.n===libNorm(nm))?LIB_ALIAS.a:[];
  const hits=libDupFind(nm,selfId,al);
  LIB_DUP=hits.length?hits:null;
  if(!hits.length){box.innerHTML='';return;}
  const viaAlias=hits.every(h=>h.alias);
  const wo=(viaAlias?'Dieselbe Übung unter einem anderen Namen. ':'')
    +hits.map(h=>`${h.day.name} · ${h.ex.target_sets||3} × ${h.ex.target_reps||'–'}`).join('  ·  ');
  // Zusammenlegen statt Verdoppeln ist der Vorschlag – aber nur innerhalb DESSELBEN Tages, sonst
  // verschöbe der Tipp Sätze zwischen zwei Trainingseinheiten. Angeboten wird die Fundstelle im
  // aktuellen Tag; `clampSets` deckelt bei 10, deshalb steht die Zahl auch im Text.
  const same=hits.find(h=>h.ex.day_id===CUR_DAY);
  const sum=same?Math.min(10,(same.ex.target_sets||3)+clampSets(val('ex_sets'))):0;
  box.innerHTML=`<div class="lib-dup"><b>„${esc2(hits[0].ex.name)}" steht schon ${hits.length>1?fmtNum(hits.length)+'× ':''}in deinem Plan</b>
    <small id="libDupS">${esc2(wo)}. Zwei gleiche Übungen führen getrennte Bestwerte und getrennte Progression – genau daran liegt es, wenn ein Rekord „verschwindet".</small>
    <div class="lib-dupa">${same?`<button class="btn sm sec" type="button" onclick="libMerge(${same.ex.id},${sum})">Dort auf ${sum} Sätze erhöhen</button>`:''}
      <button class="btn sm sec" type="button" onclick="libDupAllow()">Trotzdem neu anlegen</button></div></div>`;
  libDupSrv(nm);}
// Nachschlag vom Server: `GET /api/exercise-catalog/duplicates?name=` (B-I.2) kennt zusätzlich die
// ZAHL der geloggten Sätze je Fundstelle – und genau die entscheidet, ob eine Dublette wehtut.
// Der Kasten steht schon, bevor diese Antwort da ist (er kommt aus dem Plan im Speicher, also sofort
// und auch ohne Netz); hier wird nur der erklärende Satz geschärft. Kommt nichts, bleibt er stehen.
let LIB_DUP_T=null;
function libDupSrv(name){clearTimeout(LIB_DUP_T);const q=String(name||'');
  LIB_DUP_T=setTimeout(async()=>{
    const r=await API.get('/exercise-catalog/duplicates?name='+encodeURIComponent(q)+'&userId='+VIEW_USER);
    if(r.status!==200||!r.data)return;
    const el=document.getElementById('libDupS');
    if(!el||libNorm(val('ex_name'))!==libNorm(q))return; // Name inzwischen weitergetippt
    const list=(r.data.inPlan||[]).filter(x=>x&&x.name);
    if(!list.length)return;
    // Der Satz des Servers nennt die ERSTE Fundstelle. Gibt es mehr, stehen sie danach vollständig da –
    // in Marcos Plan sind es vier Übungen in zwei Paaren, und die Hälfte zu verschweigen hilft niemandem.
    const wo=list.map(x=>`${x.name} · ${x.dayName} · ${pl(x.sets||0,'geloggter Satz','geloggte Sätze')}`).join('  ·  ');
    el.textContent=(r.data.message?r.data.message+' ':'')+(list.length>1?'Alle Fundstellen: '+wo+'. ':'')
      +'Zwei gleiche Übungen führen getrennte Bestwerte und getrennte Progression – genau daran liegt es, wenn ein Rekord „verschwindet".';
  },250);}
// „Trotzdem": der Hinweis verschwindet, die Absicht ist erklärt. Ein Athlet darf zwei Blöcke derselben
// Übung an einem Tag haben – er soll es nur nicht aus Versehen tun.
function libDupAllow(){LIB_DUP=null;const box=document.getElementById('libDup');
  if(box)box.innerHTML='<div class="caption">Wird als zweite, eigenständige Übung angelegt – mit eigenem Bestwert.</div>';}
// FIX-B1 · B2: KEIN `confirm:true` mehr aus dem Bauch heraus.
// Der Knopf schickte fest verdrahtet `confirm:true` mit. Der Server überspringt damit die
// 409-Rückfrage „Diese Übung wurde von deinem Coach erstellt…" (server.js:3130) und schreibt
// `source='athlete'`, `coach_locked=0`. Gemessen mit echtem Browserklick: Übung 3 „Leg Press" ging
// von `src=coach · lock=1 · sets=3` auf `src=athlete · lock=0 · sets=6` – ohne eine einzige Rückfrage.
// Und ausgerechnet alle vier Dubletten in Marcos Plan sind coach_locked=1, der Knopf wurde also
// genau dort angeboten, wo er am meisten anrichtet. Jetzt geht er denselben Weg wie
// confirmEditExercise, delExercise und libSwapGo: erst fragen, dann bestätigen.
// Der Text sagt außerdem, was wirklich passiert: die vorhandene Übung bekommt mehr Sätze. Es wird
// NICHTS zusammengelegt – die zweite Übung entsteht nur gar nicht erst.
async function libMerge(exId,sets,confirm){const send={target_sets:sets};if(confirm)send.confirm=true;
  const r=await API.put('/exercises/'+exId,send);
  if(r.status===409&&r.data?.warning){confirmSheet('Coach-Vorgabe ändern',r.data.message,{label:'Trotzdem ändern',onYes:()=>libMerge(exId,sets,true)});return;}
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();_progInvalidate();await loadPlan();renderEx();_inv();
  toast('Sätze erhöht ✓ – jetzt '+sets+' Sätze');}

// ---- Wo Supersatz-Gruppe und Tausch-Herkunft stehen ------------------------------------------
// Erste Wahl ist IMMER der Server: `exercises.group_id` und `exercises.replaces_id` gibt es als
// Spalten seit 2.6.0, und `GET /api/plan` liefert sie mit (SELECT *). Schreiben kann sie erst der
// Server aus B-I.2. Solange er es nicht kann, merkt sich das GERÄT die Zuordnung – sichtbar gesagt,
// nicht heimlich (libHint). Der Server gewinnt, sobald er antwortet; der lokale Eintrag
// wird dann nicht mehr gelesen. Ein Athlet, der einen Supersatz anlegt, soll ihn morgen wiederfinden –
// und er soll wissen, dass diese Gruppe (noch) nicht auf seinem zweiten Gerät steht.
function libKey(){return 'be_lib_'+(typeof VIEW_USER!=='undefined'?VIEW_USER:'0');}
function libLoad(){const k=libKey();if(libLoad.k===k&&libLoad.v)return libLoad.v;
  let v={};try{v=JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(e){v={};}
  if(typeof v!=='object'||!v)v={};libLoad.k=k;libLoad.v=v;return v;}
function libStore(v){const k=libKey();libLoad.k=k;libLoad.v=v;
  try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
// Ein Feld auf `null` setzen heisst löschen – so bleibt die Ablage klein und es liegen nie Reste
// von Übungen darin, die es nicht mehr gibt (libPrune räumt den Rest beim Zeichnen weg).
function libSet(exId,patch){const v=libLoad();const cur={...(v[exId]||{}),...patch};
  for(const k of Object.keys(cur))if(cur[k]==null||cur[k]==='')delete cur[k];
  if(Object.keys(cur).length)v[exId]=cur;else delete v[exId];
  libStore(v);}
function libPrune(){const v=libLoad();const live=new Set();
  for(const d of (PLAN?.days||[]))for(const e of (d.exercises||[]))live.add(String(e.id));
  let ch=false;for(const k of Object.keys(v))if(!live.has(String(k))){delete v[k];ch=true;}
  if(ch)libStore(v);}
// Gruppe und Herkunft EINER Übung – Server zuerst, Gerät als Rückfall.
// `replaced {id,name}` ist die Beistellung von B-I.2 (DONE-B1-B-I.2, Abschnitt 11): der Server löst
// `replaces_id` schon auf und schickt den NAMEN der Vorgängerin mit – sie ist weich gelöscht und steht
// deshalb nicht mehr im Plan, wäre über die Id allein also nicht zu benennen. Fehlt das Feld (älterer
// Server), greift der Eintrag, den libSwapRun auf diesem Gerät hinterlegt hat.
function libMeta(ex){if(!ex)return {};const l=libLoad()[ex.id]||{};const rp=ex.replaced||null;
  return {gid:ex.group_id||l.g||null,
    prevId:(rp&&rp.id!=null)?rp.id:(ex.replaces_id!=null?ex.replaces_id:(l.ri!=null?l.ri:null)),
    prevName:(rp&&rp.name)||ex.replaces_name||l.rn||null,
    local:!ex.group_id&&!!l.g};}
// WARUM die Gruppe trotz eigener Route noch einen Rückfall aufs Gerät hat: Der Schreibweg ist
// `POST /api/days/:id/superset` (B-I.2). Gegen einen älteren Server (404) darf der Supersatz nicht
// einfach ausfallen – er wäre ein Knopf, der nichts tut. Ausdrücklich NICHT benutzt wird
// `PUT /api/exercises/:id` mit `group_id`: gemessen am Testserver antwortet die Route 200, die Spalte
// bleibt `null`, UND sie liest den Aufruf als inhaltliche Änderung – `source` springt auf „athlete",
// `coach_locked` auf 0. Eine Übung, die der Coach vorgegeben hat, verlöre also ihr Schloss, nur weil
// der Athlet zwei Übungen koppelt. Ein Schreibvorgang, der nichts speichert und dabei etwas kaputt
// macht, ist schlechter als keiner.
// Der Hinweis steht NUR da, wenn wir es wissen: nachdem ein Speicherversuch gezeigt hat, dass dieser
// Server die Gruppe nicht führt. Vorher etwas zu behaupten wäre geraten (P3).
function libHint(){return LIB_SRV.grp===false
  ?'<div class="caption mt-2">Dein Server speichert Supersätze noch nicht – diese App merkt sie sich deshalb nur auf diesem Gerät.</div>':'';}

// ---- Supersatz-Gruppen des angezeigten Tages -------------------------------------------------
// Eine Gruppe ist eine Marke (`group_id`), die zwei oder drei Übungen DESSELBEN Tages tragen.
// Sie bleiben eigene Karten – die Satzzeile aus 2.8.0 wird nicht angefasst (Veto) –, werden aber als
// Block gelesen und teilen sich EINE Pause: bestätigt der Athlet einen Satz von A1, springt der Fokus
// ohne Timer auf denselben Satz von A2; erst nach dem letzten Partner läuft die Pause.
// Belegt: Iversen et al. 2021 – Supersätze halbieren die Trainingszeit bei gleichem Volumen
// (RESEARCH-25-anfaenger-profi K10); Hevy löst es auf demselben Weg: „Add To Superset", eine Pause je Paar.
let LIB_GRP={};
function libBuild(day){LIB_GRP={};if(!day)return;
  libPrune();
  const ex=(day.exercises||[]);
  const order=[],by={};
  ex.forEach(e=>{const g=libMeta(e).gid;if(!g)return;
    if(!by[g]){by[g]=[];order.push(g);}by[g].push(e.id);});
  const AB='ABCDEFGH';
  order.forEach((g,gi)=>{const ids=by[g];
    // Eine „Gruppe" aus einer einzigen Übung ist keine – sie entsteht, wenn der Partner gelöscht wurde.
    if(ids.length<2)return;
    ids.forEach((id,i)=>{LIB_GRP[id]={gid:g,idx:i,size:ids.length,tag:AB.charAt(gi)+(i+1),
      first:ids[0],next:i<ids.length-1?ids[i+1]:null,ids};});});}
// Der nächste Schritt nach einem bestätigten Satz. OHNE Gruppe ist das Ergebnis exakt das Verhalten
// aus 2.8.0 (Pause an, nächste Zeile derselben Übung) – deshalb ändert diese Funktion an einem Plan
// ohne Supersätze nichts, auch nicht an der Tipp-Zahl.
function libStep(exId,setNo){const G=LIB_GRP[exId];
  if(!G)return {rest:true,goEx:exId,goSet:setNo+1};
  if(G.next!=null)return {rest:false,goEx:G.next,goSet:setNo};
  return {rest:true,goEx:G.first,goSet:setNo+1};}
// Zwei Übungen einer Gruppe dürfen gleichzeitig offen stehen – sonst klappt der Sprung von A1 nach A2
// die Zeile zu, die man gerade eintragen will.
function libSameGroup(a,b){const A=LIB_GRP[a],B=LIB_GRP[b];return !!(A&&B&&A.gid===B.gid);}
// Sprung auf die Partnerzeile. Gibt `false` zurück, wenn es sie nicht gibt (Partner hat weniger Sätze) –
// dann greift der gewohnte Weg aus _afterCommit.
function libJump(exId,setNo){const card=document.getElementById('ex-'+exId);if(!card)return false;
  const row=_rowInputs(exId,setNo);if(!row)return false;
  if(!card.classList.contains('open')){card.classList.add('open');semExAria(card);}
  twCurSet(exId,setNo);
  setTimeout(()=>{try{row.w.scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}
    if(row.w.value==='')try{row.w.focus({preventScroll:true});}catch(e){}},80);
  return true;}
// Die Zeile IN der Karte, die sagt, warum der Timer nicht losläuft (oder gleich losläuft).
function libNextHTML(exId){const G=LIB_GRP[exId];if(!G)return '';
  if(G.next!=null){const n=_findEx(G.next),t=LIB_GRP[G.next];
    return `<div class="lib-next">${icon('arrowRight',16)}<span>Supersatz: ohne Pause weiter mit ${esc2((t?t.tag+' · ':'')+(n?n.name:'der nächsten Übung'))}</span></div>`;}
  const f=_findEx(G.first);
  return `<div class="lib-next">${icon('timer',16)}<span>Supersatz ${esc2(G.tag.charAt(0))}: die Pause startet nach diesem Satz – danach wieder ${esc2(f?f.name:'von vorn')}.</span></div>`;}
// „Getauscht – früher: Leg Press". Ein Tipp öffnet den Verlauf der alten Übung; ihre Sätze stehen
// weiter in der Datenbank (`GET /api/logs?exercise_id=` filtert nicht nach gelöschten Übungen).
function libPrevHTML(ex){const m=libMeta(ex);if(!m.prevName)return '';
  return `<button class="lib-prev" type="button" aria-label="Verlauf von ${esc2(m.prevName)} ansehen – diese Übung wurde getauscht" onclick="event.stopPropagation();openExHistory(${m.prevId==null?'null':m.prevId},'${esc(m.prevName)}')">
    ${icon('refresh',16)}<span class="fill">Getauscht · früher: ${esc2(m.prevName)}</span>${m.prevId!=null?icon('chevronRight',16):''}</button>`;}

// ---- „Übung tauschen" -----------------------------------------------------------------------
// Der Slot bleibt: die neue Übung setzt sich an dieselbe Stelle des Tages, die alte wird WEICH
// gelöscht (ihre Sätze bleiben), und `replaces_id` verknüpft beide. Warum nicht einfach umbenennen?
// Weil dann die 207,5 kg der Beinpresse unter „Hackenschmidt-Kniebeuge" stünden – eine Bestleistung,
// die es nie gab. Die neue Übung startet ehrlich bei null und trägt den Weg zurück in der Karte.
function libSwapSheet(exId){const ex=_findEx(exId);if(!ex)return;
  EX_FORM_CTX={id:exId,draft:null};LIB_TA=[];LIB_DUP=null;LIB_ALIAS=null;

  openSheet('Übung tauschen',`
    <div class="note mb-3">„${esc2(ex.name)}" wird durch eine andere Übung ersetzt – an derselben Stelle, mit ${ex.target_sets||3} Sätzen und ${esc2(ex.target_reps||'demselben Zielbereich')}. Deine bisherigen Sätze bleiben gespeichert und bleiben über „früher: ${esc2(ex.name)}" erreichbar. Die neue Übung beginnt mit einem eigenen Bestwert.</div>
    <div class="field"><label for="ex_name">Neue Übung</label><input id="ex_name" placeholder="z.B. Hackenschmidt-Kniebeuge" maxlength="120" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="libTa" aria-autocomplete="list" oninput="libTypeahead(this.value)" onfocus="libTypeahead(this.value)"></div>
    <div class="lib-ta hidden" id="libTa" role="listbox" aria-label="Vorschläge aus der Übungsbibliothek"></div>
    <div id="libDup"></div>
    <div class="field"><label for="ex_muscle">Muskelgruppe</label><input id="ex_muscle" placeholder="${esc2(ex.muscle||'z.B. Quadrizeps')}" maxlength="60" autocomplete="off" oninput="this.dataset.lib=''"></div>
    <div class="caption lib-why hidden" id="libWhy"></div>
    <div class="caption lib-why" id="libSwapCap">Leer lassen – dann setzt die Bibliothek die Muskelgruppe der NEUEN Übung. „${esc2(ex.name)}" trainierte ${esc2(ex.muscle||'keine eingetragene Gruppe')}; eine Tauschübung trifft oft eine andere.</div>
    <button class="btn block" onclick="libSwapGo(${exId})">Tauschen</button>`);
  setTimeout(()=>{try{document.getElementById('ex_name')?.focus();}catch(e){}},350);}
function libSwapGo(exId){const old=_findEx(exId);if(!old)return;
  const name=val('ex_name');
  if(!name)return showFieldErr('sheetBody','Name der neuen Übung fehlt','ex_name');
  if(libNorm(name)===libNorm(old.name))return toast('Das ist dieselbe Übung');
  // Werte VOR einer möglichen Rückfrage einsammeln – ein Sheet-Wechsel leert das Formular
  // (dieselbe Falle wie bei confirmEditExercise).
  const body={name,muscle:val('ex_muscle')};
  if(old.coach_locked&&!coachView()){
    confirmSheet('Coach-Übung tauschen',`„${old.name}" stammt von deinem Coach. Tauschst du sie, weicht dein Plan von seiner Vorgabe ab – er sieht die neue Übung in deinem Plan.`,
      {label:'Trotzdem tauschen',onYes:()=>libSwapRun(exId,body,true)});return;}
  libSwapRun(exId,body,false);}
// Erster Weg: die Route von B-I.2. Sie macht alles in EINER Transaktion – neue Übung an derselben
// Position, `replaces_id` gesetzt, Supersatz-Marke übernommen, alte Übung weich gelöscht – und
// antwortet mit `{id, replaces:{id,name,sets}, note}`. Ein Server ohne diese Route (404) bekommt den
// Weg von Hand: anlegen, an die Stelle schieben, alte weich löschen, Herkunft auf dem Gerät merken.
async function libSwapRun(exId,body,confirmed){const old=_findEx(exId);if(!old)return;
  const day=(PLAN?.days||[]).find(d=>(d.exercises||[]).some(e=>e.id===exId));
  const idx=day?day.exercises.findIndex(e=>e.id===exId):0;
  let newId=null,srv=false;
  const rp=await API.post('/exercises/'+exId+'/replace',{name:body.name,muscle:body.muscle});
  if(rp.status===200&&rp.data?.id){newId=rp.data.id;srv=true;}
  else if(rp.status!==404&&rp.status!==405)return toast(rp.data?.error||'Der Tausch hat nicht geklappt');
  if(newId==null){
    // FIX-B1 · B6/B7: Die Anlege-Route füllt den Muskel NICHT aus dem Katalog nach (nur /replace tut
    // das, server.js:3496). Auf diesem Rückfallweg macht es deshalb der Client – sonst entstünde bei
    // einem Server ohne /replace eine Übung ganz ohne Muskelgruppe.
    if(!String(body.muscle||'').trim()){const hit=await libExactHit(body.name);if(hit&&hit.muscle)body.muscle=hit.muscle;}
    const r=await API.post('/exercises',{day_id:old.day_id,name:body.name,muscle:body.muscle,
      target_sets:old.target_sets||3,target_reps:old.target_reps||'',step_kg:old.step_kg??null,
      replaces_id:exId,replaces_name:old.name});
    if(r.status!==200||!r.data?.id)return toast(r.data?.error||'Die neue Übung konnte nicht angelegt werden');
    newId=r.data.id;
    if(idx>=0)await API.put('/exercises/'+newId,{position:idx});
    const d=await API.del('/exercises/'+exId,confirmed?{confirm:true}:{});
    if(d.status===409&&d.data?.warning)await API.del('/exercises/'+exId,{confirm:true});}
  closeAllSheets();_progInvalidate();await loadPlan();
  // Nur wenn der Server die Herkunft NICHT mitschickt, merkt sie sich dieses Gerät – sonst stünde
  // dieselbe Angabe zweimal und die lokale Kopie veraltete beim ersten Umbenennen.
  const neu=_findEx(newId);
  if(neu&&!libMeta(neu).prevName)libSet(newId,{ri:exId,rn:old.name});
  renderEx();_inv();
  if(srv&&rp.data.replaces&&rp.data.replaces.sets>0)_inv('analysis');
  // Rückgängig: die alte Übung zurückholen und die neue wieder entfernen. Beides ist weich, also
  // geht dabei kein einziger Satz verloren – auch nicht die, die inzwischen zur neuen gehören.
  toast('Getauscht ✓ – früher: '+old.name,{label:'Rückgängig',fn:async()=>{
    await API.post('/exercises/'+exId+'/restore');
    await API.del('/exercises/'+newId,{confirm:true});
    libSet(newId,{ri:null,rn:null});
    _progInvalidate();await loadPlan();renderEx();_inv();toast('Tausch zurückgenommen ✓');}});}

// ---- Supersatz anlegen und auflösen ---------------------------------------------------------
let LIB_PICK=null; // {exId, sel:[ids]}
function libGroupSheet(exId){const ex=_findEx(exId);const day=curDayObj();if(!ex||!day)return;
  const G=LIB_GRP[exId];
  LIB_PICK={exId,sel:G?G.ids.filter(id=>id!==exId):[]};
  const others=day.exercises.filter(e=>e.id!==exId);
  if(!others.length)return openSheet('Supersatz',`<div class="note">An diesem Tag steht nur eine Übung. Ein Supersatz braucht mindestens zwei.</div>`);
  openSheet('Supersatz mit „'+ex.name+'"',`
    <div class="note mb-3">Zwei oder drei Übungen direkt nacheinander, <b>eine</b> Pause danach. Das halbiert die Zeit bei gleichem Satzvolumen (Iversen u.a. 2021) und eignet sich vor allem für Muskelaufbau, weniger für Maximalkraft.</div>
    <div id="libPickList">${others.map(e=>libPickRow(e)).join('')}</div>
    ${libHint()}
    <button class="btn block mt-3" onclick="libGroupSave()">Supersatz speichern</button>
    ${G?`<button class="btn block sec mt-2" onclick="libGroupClear()">Supersatz auflösen</button>`:''}`);}
function libPickRow(e){const on=!!(LIB_PICK&&LIB_PICK.sel.includes(e.id));
  const g=LIB_GRP[e.id];
  return `<button class="lib-pick${on?' on':''}" type="button" data-id="${e.id}" aria-pressed="${on?'true':'false'}" onclick="libPickToggle(${e.id})">
    <span class="fill">${esc2(e.name)}<span class="s">${esc2([e.muscle||'',(e.target_sets||3)+' × '+(e.target_reps||'–'),(g&&(!LIB_PICK||g.gid!==(LIB_GRP[LIB_PICK.exId]||{}).gid))?'schon in Supersatz '+g.tag.charAt(0):''].filter(Boolean).join(' · '))}</span></span>
    ${on?icon('check',18):''}</button>`;}
function libPickToggle(id){if(!LIB_PICK)return;
  const i=LIB_PICK.sel.indexOf(id);
  if(i>=0)LIB_PICK.sel.splice(i,1);
  // Mehr als drei Übungen in einer Gruppe sind kein Supersatz mehr, sondern ein Zirkel – und die
  // gemeinsame Pause wäre dann so lang, dass der erste Satz kalt ist, bevor der letzte steht.
  else if(LIB_PICK.sel.length>=2)return toast('Höchstens drei Übungen in einem Supersatz');
  else LIB_PICK.sel.push(id);
  const box=document.getElementById('libPickList');const day=curDayObj();
  if(box&&day)box.innerHTML=day.exercises.filter(e=>e.id!==LIB_PICK.exId).map(e=>libPickRow(e)).join('');
  try{if(navigator.vibrate)navigator.vibrate(5);}catch(e){}}
// Schreiben: `POST /api/days/:id/superset {ids}` (B-I.2) setzt die Marke auf alle genannten Übungen
// EINES Tages, `dissolve:true` nimmt sie zurück. Die Route fasst nichts anderes an – kein `source`,
// kein `coach_locked`. Antwortet der Server damit nicht (404/405, ältere Fassung), merkt sich die
// Gruppe dieses Gerät, und die Meldung sagt genau das.
async function libGroupWrite(dayId,ids,dissolve){
  const r=await API.post('/days/'+dayId+'/superset',dissolve?{ids,dissolve:true}:{ids});
  if(r.status===200){LIB_SRV.grp=true;return true;}
  if(r.status===404||r.status===405){LIB_SRV.grp=false;return false;}
  toast(r.data?.error||'Der Supersatz konnte nicht gespeichert werden');return null;}
async function libGroupSave(){const p=LIB_PICK;if(!p)return;
  if(!p.sel.length)return toast('Wähle mindestens eine zweite Übung');
  const ex=_findEx(p.exId);const day=curDayObj();if(!ex||!day)return;
  // In der Reihenfolge des Tages, nicht in der Reihenfolge der Tipps – A1 ist die Übung, die im Plan
  // zuerst steht, sonst hiesse die obere Karte A2.
  const ids=day.exercises.map(e=>e.id).filter(id=>id===p.exId||p.sel.includes(id));
  const srv=await libGroupWrite(day.id,ids,false);
  if(srv===null)return; // echter Fehler – die Meldung steht schon, nichts wurde geändert
  // EINE Marke für alle – innerhalb der Schleife gebildet wäre sie bei einem Millisekundenwechsel
  // für die zweite Übung eine andere, und die Gruppe zerfiele in zwei Gruppen zu je einer Übung.
  const gid='g'+Date.now().toString(36)+'-'+p.exId;
  if(srv)ids.forEach(id=>libSet(id,{g:null}));            // der Server führt sie jetzt, das Gerät braucht nichts mehr
  else ids.forEach(id=>libSet(id,{g:gid}));
  closeAllSheets();_progInvalidate();await loadPlan();renderEx();_inv();
  const names=ids.map(id=>(_findEx(id)||{}).name).filter(Boolean);
  toast('Supersatz ✓ '+names.join(' + ')+(srv?'':' (nur auf diesem Gerät)'));}
async function libGroupClear(){const p=LIB_PICK;const G=p?LIB_GRP[p.exId]:null;const day=curDayObj();
  if(!G||!day)return closeModal();
  const ids=G.ids.slice();
  await libGroupWrite(day.id,ids,true);
  ids.forEach(id=>libSet(id,{g:null}));
  closeAllSheets();_progInvalidate();await loadPlan();renderEx();_inv();
  toast('Supersatz aufgelöst – jede Übung hat wieder ihre eigene Pause');}

// ===== CARDIO-TAB im Training =====
async function drawCardioTab(o){o=o||{};const b=document.getElementById('workoutBody');if(!b)return;
  if(!(o.quiet&&b.querySelector('.cardio')))b.innerHTML=skeleton(1,'sm')+skeleton(2);
  const r=await API.get('/cardio/'+VIEW_USER);
  // A-III.2: „Noch keine Cardio-Einheiten · Erfasse deine erste Einheit" ist eine Aussage ÜBER DIE DATEN.
  // Bis 2.6.0 stand sie auch dann da, wenn gar keine Antwort kam (r.data?.cardio||[] machte aus „unbekannt"
  // ein „nichts") – ein Athlet mit 40 Einheiten las, er habe noch keine, und die Wochenkacheln darüber
  // meldeten 0 min / 0 kcal. Ohne echte Antwort bleibt deshalb der letzte Stand dieser Sitzung stehen;
  // gibt es auch den nicht, sagt die Karte das. Bei kein Netz MIT Schnappschuss liefert API.get (A-III.1)
  // längst 200 – dieser Zweig greift nur, wenn wirklich kein Stand existiert.
  const all=(r.status===200)?(r.data?.cardio||[]):(drawCardioTab.list||null);
  if(document.getElementById('workoutBody')!==b||renderWorkout.tab!=='cardio')return;
  if(!all){b.innerHTML=stlNotLoaded('Cardio-Einheiten',r.status,"workoutTab('cardio')");return;}
  drawCardioTab.list=all;
  // „Diese Woche" = Kalenderwoche ab Montag – gleiche Definition wie in der Analyse und beim Wochenziel,
  // damit beide Bildschirme nie unterschiedliche Zahlen unter derselben Überschrift zeigen.
  const wa=new Date();wa.setDate(wa.getDate()-((wa.getDay()+6)%7));const weekAgo=fmt(wa);const wk=all.filter(c=>c.date>=weekAgo);
  const wkMin=wk.reduce((a,c)=>a+(c.minutes||0),0),wkKcal=wk.reduce((a,c)=>a+(c.kcal||0),0),wkKm=wk.reduce((a,c)=>a+(c.distance_km||0),0);
  const kindIcon=k=>({Laufen:'footprints',Joggen:'footprints',Gehen:'footprints',Wandern:'footprints',Stepper:'footprints',Schwimmen:'droplet',HIIT:'zap',Crossfit:'zap',Seilspringen:'zap',Rad:'refresh',Spinning:'refresh',Rudern:'wind',Crosstrainer:'wind'})[k]||'heart';
  let h=`<div class="cardio">${coachView()?'':`<button class="btn block" onclick="if(typeof bootCall==='function')bootCall('analysis','openCardio')">${icon('plus',18)} Cardio-Einheit erfassen</button>`}
    <div class="section-label">Diese Woche</div>
    <div class="cardio-tiles">
      <div class="tile"><div class="v">${fmtNum(wkMin)}<em> min</em></div><div class="l">Cardio-Zeit</div></div>
      <div class="tile"><div class="v">${fmtNum(Math.round(wkKcal))}<em> kcal</em></div><div class="l">verbrannt</div></div>
      ${wkKm>0?`<div class="tile"><div class="v">${fmtNum(wkKm,1)}<em> km</em></div><div class="l">Distanz</div></div>`:''}
    </div>`;
  if(!all.length)h+=emptyState({icon:'heart',title:'Noch keine Cardio-Einheiten',text:coachView()?'Hier erscheinen die Cardio-Einheiten deines Athleten.':'Erfasse deine erste Einheit – Laufen, Rad, Schwimmen oder HIIT.',btn:coachView()?null:{label:'Einheit erfassen',onclick:"if(typeof bootCall==='function')bootCall('analysis','openCardio')"}});
  else{h+='<div class="section-label">Verlauf</div><div class="rows">'+all.slice(0,40).map(c=>{
    const pace=_cardioPace(c)?' · '+_cardioPace(c):'';
    // Einheiten aus der Gesundheits-App tragen ein kleines Apple-Zeichen – man sieht sofort,
    // was von der Uhr kam und was von Hand eingetragen wurde.
    const src=c.source==='apple'?`<span class="src-apple" title="Aus Apple Health">${icon('apple',13)}</span>`:'';
    return `<div class="row"><div class="r-ic">${icon(kindIcon(c.kind),22)}</div><div class="rl">${esc2(c.kind)}${src}<small>${fmtDate(c.date)} · ${c.minutes||0} min${c.distance_km?' · '+fmtNum(c.distance_km,1)+' km':''}${pace} · ${esc2(c.intensity||'moderat')}</small></div>
      <div class="rr">${fmtNum(Math.round(c.kcal||0))} kcal<button class="btn icon sm ghost" aria-label="Optionen" onclick="cardioRowMenu(${c.id})">${icon('more',20)}</button></div></div>`;}).join('')+'</div>';}
  b.innerHTML=h+'</div>';trainBarSync();}
// Tempo/Geschwindigkeit kompakt für die Zeile – Laufen/Gehen in min/km, Rad/Wandern/Schwimmen in km/h
// (Regel und Formatierung kommen aus cardioPaceText() in analysis.js, solange es geladen ist)
function _cardioPace(c){if(typeof cardioPaceText!=='function')return '';
  const t=cardioPaceText(c.kind,c.minutes,c.distance_km);if(!t)return '';
  return t.replace(/^Tempo\s*/,'').replace(/^Ø\s*/,'').split(' · ')[0];}
function cardioRowMenu(id){const c=(drawCardioTab.list||[]).find(x=>x.id===id);if(!c)return;
  // cardioPaceText() liefert „Tempo …"/„Ø …" – das Präfix weg, die Zeile trägt das Label „Tempo" bereits
  const pace=(typeof cardioPaceText==='function')?String(cardioPaceText(c.kind,c.minutes,c.distance_km)||'').replace(/^(?:Tempo|Ø)\s*/,''):'';
  openSheet(c.kind+' · '+fmtDate(c.date,{weekday:'short'}),`<div class="rows mb-3">
    <div class="row"><div class="rl">Dauer</div><div class="rr">${c.minutes||0} min</div></div>
    ${c.distance_km?`<div class="row"><div class="rl">Distanz</div><div class="rr">${fmtNum(c.distance_km,1)} km</div></div>`:''}
    ${pace?`<div class="row"><div class="rl">Tempo</div><div class="rr">${esc2(pace)}</div></div>`:''}
    ${c.avg_hr?`<div class="row"><div class="rl">Puls</div><div class="rr">${c.avg_hr} bpm</div></div>`:''}
    <div class="row"><div class="rl">Intensität</div><div class="rr">${esc2(c.intensity||'moderat')}</div></div>
    <div class="row"><div class="rl">Kalorien</div><div class="rr">${fmtNum(Math.round(c.kcal||0))} kcal</div></div>
    ${c.source==='apple'?`<div class="row"><div class="rl">Herkunft</div><div class="rr">Apple Health</div></div>`:''}
    ${c.notes?`<div class="row"><div class="rl"><small>${esc2(c.notes)}</small></div></div>`:''}</div>
    <button class="btn block danger" onclick="delCardioTab(${id})">${icon('trash',18)} Entfernen</button>`);}
async function delCardioTab(id,confirmed){const c=(drawCardioTab.list||[]).find(x=>x.id===id);
  if(!confirmed){confirmSheet('Cardio-Einheit entfernen',`${c?c.kind+' vom '+fmtDate(c.date):'Diese Einheit'} wirklich entfernen?`,{label:'Entfernen',onYes:()=>delCardioTab(id,true)});return;}
  const r=await API.del('/cardio/'+id);if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();_inv();drawCardioTab({quiet:true});
  toast('Entfernt',c?{label:'Rückgängig',fn:async()=>{const rr=await API.post('/cardio',{user_id:c.user_id,date:c.date,kind:c.kind,minutes:c.minutes,distance_km:c.distance_km,avg_hr:c.avg_hr,kcal:c.kcal,intensity:c.intensity,notes:c.notes});
    if(rr.status===200){drawCardioTab({quiet:true});_inv();toast('Wiederhergestellt ✓');}else toast('Konnte nicht wiederhergestellt werden');}}:undefined);}

// KÖRPERMASSE: die Feldliste MEASURE_FIELDS liegt seit 2.1.0 in core.js (training.js und analysis.js nutzen sie).

// ===== INTERAKTIVER KALENDER =====
let CAL_MONTH=null; // erster Tag des angezeigten Monats
async function openCalendar(){CAL_MONTH=new Date();CAL_MONTH.setDate(1);drawCalendar();}
async function drawCalendar(){
  const y=CAL_MONTH.getFullYear(),m=CAL_MONTH.getMonth();
  const monthName=CAL_MONTH.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  const startISO=`${y}-${String(m+1).padStart(2,'0')}-01`;
  openSheet('Kalender','<div class="spinner"></div>');
  const r=await API.get('/calendar/'+VIEW_USER+'?start='+startISO+'&days='+last.getDate());
  const cal=r.data?.calendar||[];const byDate={};cal.forEach(d=>byDate[d.date]=d);drawCalendar.byDate=byDate;
  drawCalendar.pattern=Array.isArray(r.data?.pattern)?r.data.pattern:null;drawCalendar.dayNames=r.data?.trainingDays||[];
  const todayISO=today();
  let cells='';for(let i=0;i<(first.getDay()+6)%7;i++)cells+='<div></div>';
  for(let day=1;day<=last.getDate();day++){
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const e=byDate[iso];const isTrain=e?.type==='train',isSick=e?.type==='sick',isRest=e?.type==='rest';
    const isToday=iso===todayISO,isPast=iso<todayISO;
    cells+=`<button class="cal-cell${isTrain?' train':isSick?' sick':isRest?' rest':''}${isToday?' today':''}${isPast&&!e?' past':''}" onclick="calDay('${iso}',${isPast?'true':'false'})" aria-label="${fmtDate(iso,{weekday:'long',month:'long'})}">
      <span class="d">${day}</span><span class="n">${isTrain?esc2(dayAbbr(e.dayName||'Training',drawCalendar.dayNames)):isSick?'K':e?'–':''}</span>${e?.planned?'<i class="dot"></i>':''}</button>`;}
  openSheet('Kalender',`
    <div class="cal-head"><button class="btn icon sm" aria-label="Voriger Monat" onclick="calNav(-1)">${icon('chevronLeft',20)}</button><div class="h3">${esc2(monthName)}</div><button class="btn icon sm" aria-label="Nächster Monat" onclick="calNav(1)">${icon('chevronRight',20)}</button></div>
    <div class="cal-wd">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>`<span>${w}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-legend"><span><i class="sw train"></i>Training</span><span><i class="sw rest"></i>Ruhetag</span><span><i class="sw sick"></i>Krank</span><span><i class="sw dot"></i>geplant</span></div>
    ${_calAbbrRow(drawCalendar.dayNames||[])}
    ${_cycleRow()}
    <div class="note mt-3">Tippe auf einen Tag, um ihn zu planen – z.B. einen Ruhetag, wenn du unterwegs bist. Dein Rhythmus rechnet automatisch weiter.</div>`);}
// Auflösung der Kürzel, direkt unter der Legende. Sie erscheint NUR, wenn eine Kachel wirklich ein
// Kürzel trägt – steht der volle Name auf der Kachel („Push"), gäbe es nichts aufzulösen (A-7).
function _calAbbrRow(names){const a=twAbbrLegend(names);if(!a.length)return '';
  return `<div class="cal-abbr">${a.map(([k,n])=>`<span><b>${esc2(k)}</b> = ${esc2(n)}</span>`).join('')}</div>`;}
// Zeile unter dem Kalender: der aktuelle Zyklus als Kette, dahinter der Weg zum Editor.
// Macht sichtbar, dass die Folge sich wiederholt und NICHT am Wochentag hängt.
// Zyklus als lesbare Kette, z.B. „O1 · U1 · Ruhe". EIN Helfer für Kalender und Profil,
// damit beide dieselbe Reihenfolge und dieselben Kürzel zeigen.
function cycleText(pat,names){
  if(!Array.isArray(pat)||!pat.length)return '';
  names=(names||[]).filter(Boolean);
  const fixed=new Set(pat.map(rhyDay).filter(Boolean));
  const free=names.filter(n=>!fixed.has(n));const rot=free.length?free:names;let k=0;
  return pat.map(x=>{if(rhyType(x)!=='train')return 'Ruhe';const d=rhyDay(x);
    if(d)return dayAbbr(d,names);const n=rot.length?rot[(k++)%rot.length]:null;return n?dayAbbr(n,names):'Training';}).join(' · ');}
function _cycleRow(){const pat=drawCalendar.pattern;if(!pat||!pat.length)return '';
  const chain=cycleText(pat,drawCalendar.dayNames||[]);
  const own=VIEW_USER===ME.id;
  return `<div class="cal-cycle${own?' tap':''}"${own?' role="button" tabindex="0" aria-label="Trainingsrhythmus bearbeiten" onclick="openRhythmus()"':''}>
    <div class="cc-t">${icon('refresh',16)} Dein Zyklus <span>${pl(pat.length,'Tag','Tage')}, wiederholt sich</span></div>
    <div class="cc-c">${esc2(chain)}</div>
    ${own?`<div class="cc-a">${icon('chevronRight',18)}</div>`:''}</div>`;}
function calNav(dir){CAL_MONTH.setMonth(CAL_MONTH.getMonth()+dir);drawCalendar();}
// Tages-Sheet: der vom Rhythmus vorgeschlagene Tag ist der primäre Button, alle anderen sekundär, gleiche Höhen
function calDay(iso,isPast){const dt=fmtDate(iso,{weekday:'long',month:'long'});const e=(drawCalendar.byDate||{})[iso];
  const names=(PLAN?.days||[]).map(d=>d.name);const sugType=e?.type||'rest',sugName=e?.dayName||null;
  const btn=(type,name,label)=>{const primary=type===sugType&&(type!=='train'||!names.length||name===sugName);
    return `<button class="btn block${primary?'':' sec'}" onclick="setCalDay('${iso}','${type}',${name?`'${esc(name)}'`:'null'})">${esc2(label)}</button>`;};
  const sugLabel=sugType==='train'?(sugName||'Training'):sugType==='sick'?'Krank / Pause':'Ruhetag';
  openSheet(dt,`
    <div class="note status mb-3">${isPast?'Tag nachtragen – z.B. ein vergessenes Training. Vergangene Einträge verschieben deinen Rhythmus nicht.':(e?.planned?`Geplant: ${esc2(sugLabel)}. Du kannst die Planung ändern oder entfernen.`:`Vorgeschlagen: ${esc2(sugLabel)}.`)}</div>
    <div class="stack-sm">
      ${names.length?names.map(n=>btn('train',n,n)).join(''):btn('train',null,'Training')}
      ${btn('rest',null,'Ruhetag')}
      ${btn('sick',null,'Krank / Pause')}
    </div>
    <div class="caption mt-2">Krank / Pause verschiebt deinen Rhythmus um einen Tag nach hinten.</div>
    ${e?.planned?`<button class="btn block ghost mt-3" onclick="clearCalDay('${iso}')">Planung entfernen (automatisch)</button>`:''}
    <div id="twSess"></div>`);
  // Der Sitzungs-Editor (A-IV.2 Punkt 7) hängt sich UNTER die Planung und lädt nach: das Sheet
  // steht sofort da, die Sätze tropfen nach. Ein künftiger Tag hat keine Sätze und bekommt die
  // Liste erst gar nicht – der Server nähme ein Zukunftsdatum ohnehin nicht an (D32).
  if(iso<=today())twSessLoad(iso);}
async function _afterCalChange(iso){TODAY=null;await loadToday();_inv();
  if(iso===today())renderWorkout.lastEff=null; // heutige Empfehlung kann sich geändert haben
  drawCalendar();refreshHomeIfActive();
  if(iso===today()&&document.getElementById('exlist')){const before=CUR_DAY;const eff=TODAY?.confirmed||TODAY?.suggestion;
    if(eff?.type==='train'&&eff.dayName){const m=(PLAN?.days||[]).find(d=>d.name===eff.dayName);if(m)CUR_DAY=m.id;}
    renderWorkout.lastEff=VIEW_USER+'|'+(TODAY?.date||today())+'|'+(eff?.type||'')+'|'+(eff?.dayName||'');
    if(CUR_DAY!==before){renderDaySel();renderEx({quiet:true});}
    else updateTrainProgress();}} // gleicher Tag, aber evtl. neuer Tagestyp – Kopfzeile ehrlich nachziehen
async function setCalDay(iso,type,dayName){
  const r=await API.post('/today/'+VIEW_USER,{date:iso,type,day_name:dayName});
  if(r.status===200){toast('Tag geplant ✓');_afterCalChange(iso);}else toast(r.data?.error||'Fehler');}
async function clearCalDay(iso){
  const r=await API.del('/today/'+VIEW_USER+'?date='+iso);
  if(r.status===200){toast('Zurück auf automatisch');_afterCalChange(iso);}else toast(r.data?.error||'Fehler');}

// ===== Sitzungs-Editor (A-IV.2 Punkt 7) ======================================================
// Vergangene Sätze listen, ändern, WEICH löschen, nachtragen – im Tages-Sheet des Kalenders.
// Warum hier und nicht in einer eigenen Ansicht: der Kalender ist der einzige Ort, an dem ein
// Athlet einen bestimmten vergangenen Tag schon heute im Kopf hat („Dienstag war die 100 falsch").
// Bis 2.7.0 gab es dafür keinen Weg: „Bearbeiten/Löschen von Sätzen" stand in RATE-25-training
// wörtlich unter „Fehlt" (Funktionen 6/10), und löschen ging nur, indem man 0 Wiederholungen
// eintrug – die Zeile blieb mit ihrem Gewicht stehen und verfälschte Verlauf und Empfehlung.
// Die Daten lagen immer da (GET /api/logs?date=); seit A-IV.3 gibt es DELETE /api/logs/:id, und
// das ist WEICH (CRITIC K9: ein Hard-Delete hat in `set_logs` schon einmal 4.185 Zeilen zerstört)
// mit 24-Stunden-Rückweg über POST /api/logs/:id/restore.
let TW_SESS=null;   // {iso,logs} – zuletzt geladener Tag
let TW_EDIT=null;   // offener Satz im Editor: {iso,exId,setNo,id,w,r,rir,type,note,isNew}
// Name einer Übung – auch dann, wenn sie inzwischen aus dem Plan geflogen ist.
function twExName(id){const e=_findEx(id);return e?e.name:'Übung #'+id;}
// Der Tag in einer Zeile. Aufwärmsätze zählen nicht ins Volumen – dieselbe Regel wie im Server
// (SQL_REAL) und in der Analyse; sonst stünde hier eine andere Zahl als im Diagramm.
// Die Zahl vor „Sätze" zählt dasselbe, was auch ins Volumen geht: Arbeitssätze mit Wiederholungen.
// Bis zur Nachbesserung zählte sie ALLE Zeilen – ein Tag mit drei Aufwärmsätzen stand als „3 Sätze"
// ohne kg in der Kopfzeile, während Analyse, Startseite, Muskelverteilung und Trainingstag-Erkennung
// für denselben Tag übereinstimmend 0 sagten. Die Aufwärmsätze verschwinden nicht, sie stehen jetzt
// als das da, was sie sind – und jede Zeile bleibt in der Liste sichtbar und änderbar.
function twSessSum(rows){const vol=rows.reduce((a,l)=>a+((l.set_type||'work')==='warmup'||!(l.reps>0)?0:(+l.weight||0)*(+l.reps||0)),0);
  const ex=new Set(rows.map(l=>l.exercise_id)).size;
  const arbeit=rows.filter(l=>(l.set_type||'work')!=='warmup'&&l.reps>0).length;
  const warm=rows.filter(l=>(l.set_type||'work')==='warmup').length;
  const leer=rows.filter(l=>(l.set_type||'work')!=='warmup'&&!(l.reps>0)).length;
  return [pl(ex,'Übung','Übungen'),pl(arbeit,'Satz','Sätze'),
    vol>0?fmtNum(Math.round(vol))+' kg':'',
    warm?'+ '+pl(warm,'Aufwärmsatz','Aufwärmsätze'):'',
    leer?'+ '+pl(leer,'leere Zeile','leere Zeilen'):''].filter(Boolean).join(' · ');}
async function twSessLoad(iso){const box=document.getElementById('twSess');if(!box)return;
  if(!(TW_SESS&&TW_SESS.iso===iso))box.innerHTML='<div class="tw-sess"><div class="spinner"></div></div>';
  const r=await API.get('/logs/'+VIEW_USER+'?date='+iso);
  const cur=document.getElementById('twSess');if(!cur)return; // Sheet ist inzwischen weitergezogen
  if(!okRes(r)){cur.innerHTML='<div class="note mt-3">Die Sätze dieses Tages konnten nicht geladen werden.</div>';return;}
  TW_SESS={iso,logs:(r.data&&r.data.logs)||[]};
  cur.innerHTML=twSessHTML(iso);}
function twSessHTML(iso){const rows=((TW_SESS&&TW_SESS.iso===iso)?TW_SESS.logs:[]).slice();
  const fremd=VIEW_USER!==ME.id;
  const add=`<button class="btn block sec mt-2" onclick="twSessPick('${iso}')">Übung nachtragen</button>`;
  if(!rows.length)return `<div class="tw-sess"><div class="tw-sh">Sätze</div>
    <div class="note">An diesem Tag steht kein Satz. Trainiert und vergessen? Trag es nach – ab 3 Sätzen aus 2 Übungen zählt der Tag von selbst als Training.</div>${add}</div>`;
  const byEx=[];rows.forEach(l=>{let g=byEx.find(x=>x.id===l.exercise_id);
    if(!g){g={id:l.exercise_id,sets:[]};byEx.push(g);}g.sets.push(l);});
  byEx.forEach(g=>g.sets.sort((a,b)=>a.set_no-b.set_no));
  const blocks=byEx.map(g=>`<div class="tw-exg"><div class="tw-exn">${esc2(twExName(g.id))}</div>
    ${g.sets.map(l=>{const t=twType(l.set_type||'work');
      const wert=(l.reps>0||l.weight>0)?`${_fmtW(l.weight)} kg × ${fmtNum(l.reps)}`:'leer';
      return `<button class="tw-srow" type="button" aria-label="Satz ${l.set_no} · ${esc2(twExName(g.id))} · ${esc2(wert)}${t.k!=='work'?' · '+esc2(t.l):''} – ändern oder löschen" onclick="twSetSheet('${iso}',${g.id},${l.set_no})">
        <span class="n${t.k!=='work'?' t-'+t.k:''}">${l.set_no}${t.s?`<i>${t.s}</i>`:''}</span>
        <span class="v">${esc2(wert)}${l.rir!=null&&l.rir!==''?`<em>RIR ${fmtNum(l.rir)}</em>`:''}</span>
        ${l.note?`<span class="nt">${icon('pencil',14)}</span>`:''}
        <span class="a">${icon('chevronRight',18)}</span></button>
        ${l.note?`<div class="tw-snote">${esc2(l.note)}</div>`:''}`;}).join('')}
    <button class="tw-add" type="button" onclick="twSessAdd('${iso}',${g.id})">+ Satz nachtragen</button></div>`).join('');
  return `<div class="tw-sess"><div class="tw-sh">Sätze <span>${esc2(twSessSum(rows))}</span></div>
    ${fremd?'<div class="caption mb-2">Du bearbeitest die Sätze deines Athleten – jede Änderung ist sofort bei ihm sichtbar.</div>':''}
    ${blocks}${add}</div>`;}
// Übung nachtragen: alle Übungen des Plans, nach Trainingstag gruppiert. Der Server nimmt nur
// Übungen an, die wirklich zum Plan dieses Athleten gehören (POST /api/logs, 403 sonst) – die
// Liste zeigt also genau das, was auch durchkommt.
function twSessPick(iso){const days=(PLAN?.days||[]).filter(d=>(d.exercises||[]).length);
  if(!days.length){toast('Leg zuerst einen Trainingstag mit Übungen an');return;}
  openSheet('Übung nachtragen',`<div class="note mb-3">Welche Übung fehlt am ${esc2(fmtDate(iso,{weekday:'long',month:'long'}))}?</div>
    ${days.map(d=>`<div class="tw-exg"><div class="tw-exn">${esc2(d.name)}</div>
      ${d.exercises.map(e=>`<button class="rhy-opt" type="button" onclick="twSessAdd('${iso}',${e.id})"><span class="l">${esc2(e.name)}</span><span class="s">${esc2(e.muscle||'')}</span></button>`).join('')}</div>`).join('')}`);}
// Nächste freie Satznummer dieser Übung an diesem Tag (der Server erlaubt 1–20).
function twSessAdd(iso,exId){const rows=((TW_SESS&&TW_SESS.iso===iso)?TW_SESS.logs:[]).filter(l=>l.exercise_id===exId);
  const next=rows.reduce((m,l)=>Math.max(m,+l.set_no||0),0)+1;
  if(next>20){toast('Mehr als 20 Sätze je Übung und Tag speichert der Server nicht');return;}
  twSetSheet(iso,exId,next,rows.length?rows[rows.length-1]:null);}
// Ein Satz im Editor. `seed` belegt einen NEUEN Satz mit den Werten des letzten vor – nachtragen
// heißt fast immer „noch einmal dasselbe", und leere Felder wären drei Tastaturrunden.
function twSetSheet(iso,exId,setNo,seed){
  const rows=(TW_SESS&&TW_SESS.iso===iso)?TW_SESS.logs:[];
  const l=rows.find(x=>x.exercise_id===exId&&+x.set_no===+setNo)||null;
  const src=l||(seed&&typeof seed==='object'?seed:null);
  TW_EDIT={iso,exId,setNo:+setNo,id:l?l.id:null,isNew:!l,
    w:src&&src.weight!=null?+src.weight:null,
    r:l&&l.reps!=null?+l.reps:(src&&src.reps!=null?+src.reps:null),
    rir:l&&l.rir!=null&&l.rir!==''?+l.rir:null,
    type:(l&&l.set_type)||'work',note:l?String(l.note||''):''};
  const step=twStepKg(_findEx(exId),(PROG_CACHE[VIEW_USER+'_'+CUR_DAY]||{})[exId]);
  const rirOn=twRirOn();const typesOn=twSetTypesOn(); // A-5: derselbe Riegel wie in der Satzzeile
  const row=(f,lab,unit,stp)=>`<div class="tw-ed" data-f="${f}">
    <button class="btn icon" type="button" aria-label="${esc2(lab)} senken" onclick="twEditStep('${f}',-1)">−</button>
    <div class="vv"><input id="twe_${f}" type="number" inputmode="${f==='weight'?'decimal':'numeric'}" step="any" value="${TW_EDIT[f==='weight'?'w':f==='reps'?'r':'rir']??''}" aria-label="${esc2(lab)}" oninput="twEditType('${f}',this.value)"><span>${esc2(unit)}</span></div>
    <button class="btn icon" type="button" aria-label="${esc2(lab)} erhöhen" onclick="twEditStep('${f}',1)">+</button>
    <div class="st">±${esc2(_fmtW(stp))}</div></div>`;
  openSheet('Satz '+setNo+' · '+twExName(exId),`
    <div class="note status mb-3">${esc2(fmtDate(iso,{weekday:'long',month:'long'}))}${TW_EDIT.isNew?' · neuer Satz':''}</div>
    ${row('weight','Gewicht','kg',step)}
    ${row('reps','Wiederholungen','Wdh',1)}
    ${rirOn?row('rir','RIR','RIR',1):''}
${typesOn?`<div class="tw-tyl">Satzart</div>
    <div class="tw-tyg">${TW_TYPES.map(t=>`<button class="tw-ty${t.k===TW_EDIT.type?' on':''}" type="button" data-k="${t.k}" data-l="${esc2(t.l)}" aria-pressed="${t.k===TW_EDIT.type}" onclick="twEditType('set_type','${t.k}')">${t.k===TW_EDIT.type?icon('check',16):''}${esc2(t.l)}</button>`).join('')}</div>
    <div class="caption mb-3">Aufwärmsätze zählen nicht in Volumen, e1RM und Bestleistung.</div>`:''}
    <div class="field"><label for="twe_note">Notiz</label><textarea id="twe_note" rows="2" maxlength="300" placeholder="Was gehört zu diesem Satz?" oninput="twEditType('note',this.value)">${esc2(TW_EDIT.note)}</textarea></div>
    <button class="btn block" onclick="twEditSave()">${TW_EDIT.isNew?'Satz nachtragen':'Änderung speichern'}</button>
    ${TW_EDIT.id?`<button class="btn block ghost danger mt-2" onclick="twEditDel()">${icon('trash',18)} Satz löschen</button>`:''}`);}
function twEditType(f,v){if(!TW_EDIT)return;
  if(f==='set_type'){TW_EDIT.type=twType(v).k;
    // Der gewaehlte Satztyp traegt seit der Umstellung auf Stil B einen Haken: die Flaeche allein
    // unterscheidet 1,5:1 vom ungewaehlten Nachbarn – zu wenig, um den Zustand ALLEIN zu tragen
    // (vorher trug ihn die Farbe Rot, was gegen das Akzent-Budget verstiess).
    document.querySelectorAll('.tw-ty').forEach(b=>{const on=b.dataset.k===TW_EDIT.type;
      b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');
      b.innerHTML=(on?icon('check',16):'')+esc2(b.dataset.l||b.textContent.trim());});return;}
  if(f==='note'){TW_EDIT.note=String(v||'').slice(0,300);return;}
  const n=(v===''||v==null)?null:parseFloat(v);
  if(f==='weight')TW_EDIT.w=n==null?null:Math.max(0,Math.min(1000,n));
  else if(f==='reps')TW_EDIT.r=n==null?null:Math.max(0,Math.min(1000,Math.round(n)));
  else TW_EDIT.rir=n==null?null:Math.max(0,Math.min(5,Math.round(n)));}
function twEditStep(f,dir){if(!TW_EDIT)return;
  const key=f==='weight'?'w':f==='reps'?'r':'rir';
  const stp=f==='weight'?twStepKg(_findEx(TW_EDIT.exId),(PROG_CACHE[VIEW_USER+'_'+CUR_DAY]||{})[TW_EDIT.exId]):1;
  const max=f==='weight'?1000:(f==='reps'?1000:5);
  let v=TW_EDIT[key];if(v==null)v=0;
  v=Math.max(0,Math.min(max,Math.round((v+dir*stp)*100)/100));
  TW_EDIT[key]=v;
  const inp=document.getElementById('twe_'+f);if(inp)inp.value=String(v);
  try{if(navigator.vibrate)navigator.vibrate(5);}catch(e){}}
async function twEditSave(){const e=TW_EDIT;if(!e)return;
  // Ein NEUER Satz ohne Wiederholungen ist kein Satz, sondern eine leere Zeile. Der Server nimmt sie
  // an (gemessen: `reps:0` -> 200, id 751) und sie steht danach als „leer" im Verlauf, im Zähler des
  // Tages und im Coach-Blick. Dieselbe Regel wie beim Bestätigen in der Trainingsansicht (commitSet).
  // Eine BESTEHENDE Zeile darf weiterhin auf 0 gesetzt werden – für die gibt es jetzt aber „Löschen“,
  // und genau das steht auch im Hinweis.
  if(e.isNew&&!(e.r>0)){const inp=document.getElementById('twe_reps');if(inp)try{inp.focus();}catch(x){}
    toast('Wiederholungen eintragen, dann nachtragen');return;}
  const body={user_id:VIEW_USER,exercise_id:e.exId,date:e.iso,set_no:e.setNo,
    weight:e.w==null?0:e.w,reps:e.r==null?0:e.r,note:e.note?e.note:null,
    rir:e.rir==null?null:e.rir,set_type:e.type};
  const r=await API.post('/logs',body);
  if(!okRes(r)){toast(r.data?.error||'Satz nicht gespeichert');return;}
  closeModal();
  toast(e.isNew?'Satz nachgetragen ✓':'Satz geändert ✓');
  await twSessAfter(e.iso);}
async function twEditDel(){const e=TW_EDIT;if(!e||!e.id)return;
  const id=e.id,iso=e.iso,name=twExName(e.exId),setNo=e.setNo;
  confirmSheet('Satz löschen?','Satz '+setNo+' · '+name+' verschwindet aus Verlauf, Volumen und Rekorden. Du kannst ihn 24 Stunden lang zurückholen.',
    {label:'Löschen',onYes:async()=>{
      const r=await API.del('/logs/'+id);
      if(!okRes(r)){toast(r.data?.error||'Satz nicht gelöscht');return;}
      // Weich: die Zeile bleibt in der Datenbank stehen, nur `set_type` steht auf 'deleted'.
      toast('Satz gelöscht',{label:'Rückgängig',fn:async()=>{
        const b=await API.post('/logs/'+id+'/restore',{});
        if(okRes(b)){toast('Satz zurückgeholt ✓');twSessAfter(iso);}else toast('Zurückholen nicht möglich');}});
      await twSessAfter(iso);}});}
// Nach jeder Änderung: die Liste im Tages-Sheet neu, und alles, was diesen Tag sonst noch zeigt.
// Der heutige Tag hängt zusätzlich an der Trainingsansicht und der Empfehlung – beide werden hier
// ehrlich nachgezogen, statt bis zum nächsten Neuladen eine alte Zahl zu behaupten.
// Zurück auf die Ebene, der `#twSess` gehört (das Tages-Sheet). Nötig für den Lösch-Weg: die Rückfrage
// (confirmSheet) liegt DRITTE Ebene über dem Tages-Sheet, und `_confirmYes` in shell.js nimmt nur seine
// eigene Ebene vom Stapel – der Satz-Editor darunter bleibt stehen. Ohne diesen Schritt lief twSessLoad
// ins Leere (`if(!box)return;`): der Satz war gelöscht, auf dem Bildschirm stand weiter der alte Wert
// samt „Satz löschen“-Knopf, und erst ein Neuladen hätte die Wahrheit gezeigt. Höchstens zwei Ebenen,
// und nur solange wirklich noch ein Sheet offen ist – ein Aufruf aus dem Rückgängig-Toast (Sheet längst
// zu) darf nichts schließen.
function twBackToSess(){for(let i=0;i<2;i++){
  if(document.getElementById('twSess'))return;
  if(typeof sheetOpen!=='function'||!sheetOpen()||!(typeof SHEET_STACK!=='undefined'&&SHEET_STACK.length>1))return;
  closeModal();}}
async function twSessAfter(iso){TW_SESS=null;
  _progInvalidate();_inv();
  twBackToSess();
  await twSessLoad(iso);
  TODAY=null;try{await loadToday();}catch(e){}
  refreshHomeIfActive(); // (drawCalendar holt sein Raster bei jedem Öffnen neu – nichts zu leeren)
  if(iso===today()&&document.getElementById('exlist')){renderWorkout.lastEff=null;renderEx({quiet:true});}}
// Profilbild im Header anzeigen (Bild, sonst Initiale). Lädt das Bild bei Bedarf separat.
async function applyAvatar(){const el=document.getElementById('avatar');if(!el||!ME)return;
  if(ME.has_avatar){try{const r=await API.get('/avatar/'+ME.id);if(r.status===200&&r.data.avatar){
    el.textContent='';el.style.backgroundImage=`url(${r.data.avatar})`;el.style.backgroundSize='cover';el.style.backgroundPosition='center';return;}}catch(e){}}
  el.style.backgroundImage='';el.textContent=(ME.name||'?').charAt(0).toUpperCase();}
// Zeichnet die Home neu, wenn sie gerade aktiv ist (nach Kalender-/Rhythmus-Änderungen)
function refreshHomeIfActive(){const cur=document.querySelector('.navbtn.on')?.dataset?.p;
  if(cur==='home'){const v=document.getElementById('views');if(v)renderHome(v);}}
// Zurück aus dem Hintergrund: zuerst die Pause (sie ist das Einzige, das währenddessen weiterlief),
// dann die Tages-Daten als veraltet markieren; die Home nur nach > 5 Minuten neu zeichnen
// (kein DOM-Wipe bei jedem kurzen App-Wechsel).
let _trHiddenAt=0;
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){_trHiddenAt=Date.now();trWakeRelease();return;}
  // Im Hintergrund wurden die Ticks gedrosselt oder angehalten – die Anzeige kommt aus der Uhr und wird
  // sofort neu gezeichnet. Ist die Pause dabei abgelaufen, holen wir das Ende hier nach: ohne Piepser,
  // wenn sie schon länger als drei Sekunden vorbei ist (dann ist der Ton nur noch Lärm).
  if(REST_END_AT){const over=Date.now()-REST_END_AT;
    drawRest(true);
    if(over>=0)restDone(over>3000);else trRestSchedule();}
  if(trWakeLock.want)trWakeLock(); // das System gibt den Lock beim Verstecken selbst frei
  if(!ME)return;
  if(_trHiddenAt&&Date.now()-_trHiddenAt>5*60*1000){TODAY=null;_inv();refreshHomeIfActive();}});

// ===== TRAININGSRHYTHMUS-EDITOR (Kacheln; ersetzt die Zeilenliste aus coach.js – Bindung siehe _trInit) =====
// Ein Rhythmus ist eine Folge von Slots, die sich endlos wiederholt – UNABHÄNGIG vom Wochentag.
// Slot: 'rest' | 'train' (Tagesname rotiert automatisch) | {type:'train',day:'Upper 1'} (fester Tag).
// So lässt sich z.B. „O1, U1, Ruhe, O2, U2, Ruhe" fest hinterlegen; die Woche spielt keine Rolle.
let RHY=[];
function rhyType(s){return ((s&&typeof s==='object')?s.type:s)==='train'?'train':'rest';}
function rhyDay(s){const d=(s&&typeof s==='object')?s.day:null;return (typeof d==='string'&&d.trim())?d.trim():null;}
function _rhyNames(){return (PLAN?.days||[]).map(d=>d.name).filter(Boolean);}
// Beschriftung je Slot. Fester Tag gewinnt; automatische Slots rotieren durch die NICHT fest
// vergebenen Tage – genau wie die Engine auf dem Server (logic.js: rotationDays).
function _rhySlots(){
  const names=_rhyNames();const fixed=new Set(RHY.map(rhyDay).filter(Boolean));
  const free=names.filter(n=>!fixed.has(n));const rot=free.length?free:names;let k=0;
  return RHY.map(s=>{
    if(rhyType(s)!=='train')return{label:'Ruhetag',short:'–',train:false,fixed:false};
    const d=rhyDay(s);
    if(d)return{label:d,short:dayAbbr(d,names),train:true,fixed:true};
    const n=rot.length?rot[(k++)%rot.length]:null;
    return{label:n?n+' (automatisch)':'Training',short:n?dayAbbr(n,names):'T',train:true,fixed:false};});}
async function openRhythmus(){const me=await API.get('/me');let p=null;try{p=JSON.parse(me.data?.user?.pattern);}catch(e){p=null;}
  RHY=(Array.isArray(p)&&p.length)?p.map(x=>rhyType(x)==='train'?(rhyDay(x)?{type:'train',day:rhyDay(x)}:'train'):'rest'):['train','train','rest'];
  if(!PLAN)await loadPlan();drawRhythmus();}
function drawRhythmus(){if(!Array.isArray(RHY)||!RHY.length)RHY=['train','train','rest'];
  const slots=_rhySlots();const trainTotal=RHY.filter(x=>rhyType(x)==='train').length;
  const tiles=slots.map((sl,i)=>`<button class="rhy-tile${sl.train?' train':''}${sl.fixed?' fixed':''}" type="button" data-i="${i}" aria-label="Tag ${i+1}: ${esc2(sl.label)} – tippen zum Ändern" onclick="rhyPick(${i})"><span class="d">${i+1}</span><span class="n">${esc2(sl.short)}</span></button>`).join('');
  // Vorschau: die nächsten 14 echten Tage ab heute – zeigt, dass der Zyklus durch die Woche wandert
  const wd=['So','Mo','Di','Mi','Do','Fr','Sa'];const t=new Date();
  const prev=Array.from({length:14},(_,i)=>{const d=new Date(t);d.setDate(t.getDate()+i);const sl=slots[i%slots.length];
    return `<div class="rhy-prev${sl.train?' train':''}"><span class="w">${wd[d.getDay()]}</span><span class="n">${esc2(sl.short)}</span></div>`;}).join('');
  openSheet('Trainingsrhythmus',`
    <div class="note status mb-3">${trainTotal===1?'1 Training':trainTotal+' Trainings'} in ${pl(RHY.length,'Tag','Tagen')} – die Folge wiederholt sich endlos, unabhängig vom Wochentag. Tippe einen Tag an, um ihn festzulegen.</div>
    <div class="rhy-strip" id="rhyStrip">${tiles}</div>
    <div class="cluster mt-3">
      <button class="btn sm sec" onclick="rhyAdd('train')">${icon('plus',16)} Training</button>
      <button class="btn sm sec" onclick="rhyAdd('rest')">${icon('plus',16)} Ruhetag</button>
      <button class="btn sm sec" onclick="rhyRemoveLast()">${icon('minus',16)} Letzter Tag</button>
      <button class="btn sm sec" onclick="rhyPresets()">${icon('sparkles',16)} Vorlage</button>
    </div>
    <div class="section-label">So läuft der Zyklus<span class="sl-r">wenn heute Tag 1 ist</span></div>
    <div class="rhy-week">${prev}</div>
    <div class="caption mt-2">Trainingstage mit festem Namen (z.B. „O1") kommen immer an derselben Stelle des Zyklus. „T" heißt: der nächste Tag aus deinem Plan, automatisch der Reihe nach.<br>
      Der Zyklus läuft dort weiter, wo du gerade stehst – er beginnt nicht bei jedem Speichern neu. Willst du heute an einer bestimmten Stelle einsteigen, tippe im Kalender auf heute und wähle den Tag.</div>
    <button class="btn block mt-4" onclick="saveRhythmus()">Rhythmus speichern</button>`);}
// Slot festlegen: fester Trainingstag, automatischer Trainingstag, Ruhetag – dazu verschieben/entfernen
function rhyPick(i){const cur=RHY[i];const curDay=rhyDay(cur);const names=_rhyNames();
  // aria-pressed: der Haken ist ein aria-hidden-Glyph, der Zustand braucht deshalb einen eigenen
  // Namen – sonst hoert die Sprachausgabe nur „Ruhetag" statt „Ruhetag, ausgewaehlt".
  const opt=(sel,label,sub,act)=>`<button class="rhy-opt${sel?' on':''}" type="button" aria-pressed="${sel?'true':'false'}" onclick="${act}"><span class="l">${esc2(label)}</span>${sub?`<span class="s">${esc2(sub)}</span>`:''}${sel?icon('check',18):''}</button>`;
  openSheet('Tag '+(i+1)+' im Zyklus',`
    ${names.length?`<div class="section-label">Fester Trainingstag</div>
    <div class="stack-sm">${names.map(n=>opt(curDay===n,n,null,`rhySet(${i},'${esc(n)}')`)).join('')}</div>`:''}
    <div class="section-label">Sonst</div>
    <div class="stack-sm">
      ${opt(rhyType(cur)==='train'&&!curDay,'Training (automatisch)','nächster Tag aus dem Plan',`rhySet(${i},null)`)}
      ${opt(rhyType(cur)!=='train','Ruhetag',null,`rhySet(${i},'rest')`)}
    </div>
    <div class="rows mt-3">
      ${_mrow('arrowLeft','Nach vorne schieben',`rhyMove(${i},-1)`)}
      ${_mrow('arrowRight','Nach hinten schieben',`rhyMove(${i},1)`)}
      ${_mrow('trash','Tag aus dem Zyklus entfernen',`rhyRemove(${i})`,{cls:'tone-red'})}
    </div>`);}
function rhySet(i,val){RHY[i]=val==='rest'?'rest':(val?{type:'train',day:val}:'train');drawRhythmus();}
function rhyMove(i,dir){const j=i+dir;if(j<0||j>=RHY.length)return toast(dir<0?'Steht schon ganz vorne':'Steht schon ganz hinten');[RHY[i],RHY[j]]=[RHY[j],RHY[i]];drawRhythmus();}
function rhyRemove(i){if(RHY.length<=1)return toast('Mindestens 1 Tag nötig');RHY.splice(i,1);drawRhythmus();}
function rhyRemoveLast(){if(RHY.length<=1)return toast('Mindestens 1 Tag nötig');RHY.pop();drawRhythmus();}
function rhyAdd(t){if(RHY.length>=21)return toast('Maximal 21 Tage');RHY.push(t==='train'?'train':'rest');drawRhythmus();}
// Fertige Zyklen aus den echten Tagesnamen des Plans – der schnellste Weg zu „O1,U1,Ruhe,O2,U2,Ruhe"
function rhyPresets(){const names=_rhyNames();
  const fix=n=>({type:'train',day:n});
  const list=[];
  if(names.length){
    list.push(['Alle Tage, dann 1 Ruhetag',[...names.map(fix),'rest'],names.join(' · ')+' · Ruhe']);
    list.push(['Alle Tage, dann 2 Ruhetage',[...names.map(fix),'rest','rest'],names.join(' · ')+' · Ruhe · Ruhe']);
    if(names.length>=4){const p=[];names.forEach((n,k)=>{p.push(fix(n));if(k%2===1)p.push('rest');});if(rhyType(p[p.length-1])==='train')p.push('rest');
      list.push(['Je 2 Trainings, dann 1 Ruhetag',p,p.map(x=>rhyDay(x)?dayAbbr(rhyDay(x),names):'Ruhe').join(' · ')]);}
  }
  list.push(['3 Trainings, 1 Ruhetag (automatisch)',['train','train','train','rest'],'T · T · T · Ruhe']);
  list.push(['1 Training, 1 Ruhetag (automatisch)',['train','rest'],'T · Ruhe']);
  openSheet('Vorlage wählen',`<div class="stack-sm">${list.map((x,k)=>
    `<button class="rhy-opt" type="button" onclick="rhyApplyPreset(${k})"><span class="l">${esc2(x[0])}</span><span class="s">${esc2(x[2])}</span></button>`).join('')}</div>
    <div class="caption mt-2">Die Vorlage ersetzt deinen aktuellen Zyklus. Speichern musst du danach noch selbst.</div>`);
  rhyPresets.list=list;}
function rhyApplyPreset(k){const x=(rhyPresets.list||[])[k];if(!x)return;RHY=x[1].slice();drawRhythmus();}
async function saveRhythmus(){if(!RHY.filter(x=>rhyType(x)==='train').length)return toast('Mindestens 1 Trainingstag nötig');
  const r=await API.post('/pattern',{pattern:RHY});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();TODAY=null;renderWorkout.lastEff=null;_progInvalidate();_inv();
  // Der Zyklus läuft an der Stelle weiter, an der die Historie steht – deshalb sagen wir gleich,
  // was daraus für HEUTE folgt. Sonst rätselt man, warum nicht Tag 1 dran ist.
  await loadToday();
  const eff=TODAY?.confirmed||TODAY?.suggestion;
  const what=eff?.type==='train'?(eff.dayName||'Training'):eff?.type==='sick'?'Pause':'Ruhetag';
  toast('Rhythmus gespeichert ✓ – heute: '+what);
  const cur=document.querySelector('.navbtn.on')?.dataset?.p;if(cur)go(cur);}
// Hinweis: Diese Kachel-Version trägt die kanonischen Namen (openRhythmus/drawRhythmus/saveRhythmus/
// rhyPick/rhyMove/rhyRemove/rhyAdd). Da training.js vor coach.js geladen wird, greift dort der
// Fallback-Guard (`typeof window.openRhythmus!=='function'`) nicht mehr; _trInit() bindet zusätzlich nach.
// ===== TECHNIK-LEXIKON =====
// Tippfehler der Server-Definitionen clientseitig glätten (Quelle: src/server.js DEFINITIONS / seed-data.json)
function _fixDef(s){return esc2(String(s||'')).replace(/Umkerpunkt/g,'Umkehrpunkt').replace(/ohne einer/g,'ohne eine').replace(/continous/g,'continuous').replace(/Tripple/g,'Triple').replace(/aufsVersagen/g,'aufs Versagen').replace(/\n/g,'<br>');}
// Anzeigename eines Lexikon-Eintrags: Zeilenumbrueche glaetten und die Tippfehler der Server-Quelle
// korrigieren. Der gespeicherte Wert bleibt der Originalbegriff, damit die Suche im Lexikon weiter greift.
function _defLabel(t){return String(t||'').replace(/\s+/g,' ').trim().replace(/Tripple/g,'Triple').replace(/Continous/gi,'Continuous');}
function _findDef(t){t=(t||'').toLowerCase().trim();if(!t)return null;
  return (DEFS||[]).find(d=>d.term.toLowerCase()===t)||(DEFS||[]).find(d=>d.term.toLowerCase().includes(t)||t.includes(d.term.toLowerCase()))||null;}
// ===== TECHNIK-KARTE EINER GRUNDUEBUNG (2.8.0) =====
// Bis 2.7.0 war der Technik-Chip der Uebungskarte an EINE Bedingung geknuepft: `ex.technique` muss
// gesetzt sein. Gesetzt hat ihn nur ein Coach – ein frisch angelegter Anfaengerplan kam mit zwoelf
// Uebungen und zwoelfmal `technique=NULL`, also NIE mit Chip. Ein Anfaenger bekam Kniebeuge, Kreuzheben
// und Klimmzug ohne eine Zeile zur Ausfuehrung (STRATEGY 4.1, Zeile „Technik", Level 1).
// Seit 2.8.0 liefert der Server zu jeder Uebung, deren Name zu einer Grunduebung passt, den Namen der
// zugehoerigen Karte mit (`form_guide`, abgeleitet in logic.js/FORM_GUIDES); die Karte selbst kommt
// ueber `/api/definitions` mit `kind:'form'`, drei Cues und drei typischen Fehlern.
// Ein Coach-Begriff („Drop-Set") hat weiter Vorrang und sieht aus wie vorher – es kommt KEIN zweiter
// Chip dazu; die Karte bleibt in diesem Fall ueber „···  → Ausfuehrung" erreichbar.
function twFormDef(term){const t=String(term||'').trim();if(!t)return null;
  return (DEFS||[]).find(d=>d.kind==='form'&&d.term===t)||null;}
// Kartenname dieser Uebung: erst der abgeleitete Wert des Servers, sonst – fuer einen Plan aus dem
// Offline-Schnappschuss vor 2.8.0 – der in `technique` gespeicherte Kartenname.
function twFormTerm(ex){if(!ex)return '';
  if(ex.form_guide)return String(ex.form_guide);
  return (ex.technique&&twFormDef(ex.technique))?String(ex.technique):'';}
function twTechChip(ex){if(!ex)return '';
  const form=twFormTerm(ex);
  const coach=(ex.technique&&ex.technique!==form)?String(ex.technique):'';
  if(coach)return `<button class="tchip" type="button" aria-label="Technik ${esc2(coach)} erklären" onclick="event.stopPropagation();explainTechnique('${esc(coach)}')">${esc2(coach)}${icon('info',12)}</button>`;
  if(!form)return '';
  // Beschriftung „Technik" statt des Kartennamens: der Name steht zwei Zeilen darueber schon einmal
  // („Kniebeuge · Kniebeuge" waere Rauschen), und der eingeklappte Kopf muss einzeilig bleiben.
  return `<button class="tchip" type="button" aria-label="Technik von ${esc2(ex.name||'')}: drei Punkte und drei typische Fehler" onclick="event.stopPropagation();openVideo('${esc(ex.name||'')}','${esc(ex.video_url||'')}','${esc(form)}')">Technik${icon('info',12)}</button>`;}
// Der Inhalt der Karte – dieselben Klassen wie im Lexikon (.def/.dt/.dd), damit kein neues CSS noetig ist.
function twFormHTML(term){const g=twFormDef(term);if(!g)return '';
  if(!(g.cues||[]).length)return `<div class="body muted">${_fixDef(g.def)}</div>`;
  const cues=g.cues.map((c,i)=>`${i+1}. ${esc2(c)}`).join('<br>');
  const errs=(g.errs||[]).map(e=>`– ${esc2(e)}`).join('<br>');
  return `<div class="def"><div class="dt">So geht es</div><div class="dd">${cues}</div></div>`
    +(errs?`<div class="def"><div class="dt">Typische Fehler</div><div class="dd">${errs}</div></div>`:'')
    +(g.note?`<div class="note mt-2 mb-3">${esc2(g.note)}</div>`:'');}
function explainTechnique(term){const hit=_findDef(term);
  if(hit)openSheet(_defLabel(hit.term),`<div class="body muted">${_fixDef(hit.def)}</div><button class="btn block mt-4" onclick="closeModal()">Verstanden</button>`);
  else openSheet(term||'Technik',`<div class="note mb-3">Für diese Technik gibt es noch keine Erklärung im Lexikon. Dein Coach hat sie als Hinweis gesetzt – frag im Zweifel direkt nach.</div><button class="btn block sec" onclick="openDefs()">Ganzes Lexikon ansehen</button>`);}
// Das Lexikon fuehrt seit 2.8.0 zwei Arten von Eintraegen: Begriffe und Intensitaetstechniken wie
// bisher – und darunter, mit eigener Ueberschrift, die Technik-Karten der Grunduebungen (`kind:'form'`).
// Ungetrennt stuenden „Kniebeuge" und „Drop-Set" wahllos untereinander.
function _defsPaint(list){
  const row=d=>`<div class="def"><div class="dt">${esc2(_defLabel(d.term))}</div><div class="dd">${_fixDef(d.def)}</div></div>`;
  const forms=list.filter(d=>d.kind==='form'),rest=list.filter(d=>d.kind!=='form');
  openSheet('Technik-Lexikon',list.length
    ?rest.map(row).join('')+(forms.length?`<div class="section-label">Grundübungen</div>`+forms.map(row).join(''):'')
    :emptyState({icon:'help',title:'Keine Einträge'}));}
// Das Lexikon ist auch aus der globalen Suche heraus erreichbar – also aus jeder Ansicht, auch bevor
// jemand im Trainings-Reiter war. Seit 2.9.0 liegt DEFS nicht mehr im Startpfad: ein leeres Sheet mit
// „Keine Einträge" wäre dort eine Falschaussage über einen Katalog, der schlicht noch nicht da ist.
function openDefs(){const list=DEFS||[];
  if(!list.length&&typeof rpLoadDefs==='function'){
    openSheet('Technik-Lexikon','<div class="spinner"></div>');
    rpLoadDefs().then(()=>{if(typeof sheetOpen==='function'&&sheetOpen())_defsPaint(DEFS||[]);})
      .catch(e=>console.error('[lexikon]',e));
    return;}
  _defsPaint(list);}
// Erklärung der im Formular gewählten Technik (sonst das ganze Lexikon)
function pickTechnique(){if(!(DEFS||[]).length){if(typeof rpLoadDefs==='function')return openDefs();return toast('Lexikon lädt noch…');}
  const cur=_curTech();const hit=cur?_findDef(cur):null;
  if(hit)openSheet(_defLabel(hit.term),`<div class="body muted">${_fixDef(hit.def)}</div><button class="btn block mt-4" onclick="closeModal()">Verstanden</button>`);
  else openDefs();}
let EX_FORM_CTX=null; // merkt sich, ob wir gerade eine Übung anlegen oder bearbeiten

// ===== HANTELRECHNER =====
function platesPerSideJS(target,bar,plates){let perSide=(target-bar)/2;const out=[];
  for(const p of plates){let c=0;while(perSide>=p-1e-9){perSide-=p;c++;}if(c>0)out.push([p,c]);}
  const used=out.reduce((s,[p,c])=>s+p*c,0);const ach=bar+used*2;
  return {out,achievable:Math.round(ach*100)/100,remainder:Math.round((target-ach)*100)/100};}
// Gewicht der aktuellen Zeile: zuletzt fokussiertes Gewichtsfeld, sonst erste offene Zeile, sonst 60 kg
function curRowWeight(){const l=curRowWeight.last;if(l&&document.contains(l)&&+l.value>0)return +l.value;
  const g=[...document.querySelectorAll('#exlist .ex.open .setgrid[data-set], #exlist .setgrid[data-set]')].find(x=>!_rowDone(x));
  const w=g&&g.querySelector('input');return (w&&+w.value>0)?+w.value:60;}
document.addEventListener('focusin',e=>{const t=e.target;if(t&&t.matches&&t.matches('#exlist .setgrid input[inputmode="decimal"]'))curRowWeight.last=t;});
// Der Hantelrechner war bis 2.4.0 aus der Satzzeile nur über das Kontextmenü des Gewichtsfeldes zu
// erreichen (Rechtsklick/Longpress) – und iOS Safari feuert `contextmenu` auf Eingabefeldern nicht.
// Der Knopf in der Leiste erscheint erst nach dem ersten Satz, also war der Rechner auf dem iPhone
// genau dann unerreichbar, wenn man ihn braucht: vor dem ersten Satz (RATE-25-training M6).
// Das Scheiben-Symbol in der Gewichtszelle öffnet ihn mit dem Wert genau dieser Zeile; das
// Kontextmenü bleibt zusätzlich bestehen (Desktop, Android).
function trOpenPlateFromRow(btn){const g=btn&&btn.closest?btn.closest('.setgrid[data-set]'):null;
  const inp=g?g.querySelector('.wcell input'):null;
  if(inp)curRowWeight.last=inp; // damit die Leiste danach dieselbe Zeile meint
  if(g)twCurSet(g.dataset.ex,g.dataset.set);
  openPlateCalc(inp&&+inp.value>0?inp.value:curRowWeight());}
function openPlateCalc(w){const start=(+w>0)?Math.round(+w*2)/2:60;
  // Die Stange, die zum Zielgewicht PASST, steht von vornherein ausgewählt da – sonst begrüßt der
  // Rechner ein Ziel unter 20 kg mit einer roten Fehlermeldung, statt zu antworten (P-4).
  const bar0=[20,15,10,0].find(b=>start>=b);
  const barOpt=(v,l)=>`<option value="${v}"${v===bar0?' selected':''}>${l}</option>`;
  openSheet('Hantelrechner',`${infoBox('plate_intro','Gib dein Zielgewicht ein – die App zeigt dir, welche Scheiben pro Seite auf die Langhantel müssen (die Stange wiegt meist 20 kg).')}
  <div class="grid-2">
    <div class="field"><label>Zielgewicht (kg)</label><input id="pc_target" type="number" step="0.5" inputmode="decimal" min="0" max="1000" value="${start}" oninput="doPlate()"></div>
    <div class="field"><label>Stange (kg)</label><select id="pc_bar" onchange="doPlate()">${barOpt(20,'20 (Standard)')}${barOpt(15,'15 (Frauen)')}${barOpt(10,'10 (kurz)')}${barOpt(0,'ohne Stange')}</select></div>
  </div>
  <div id="pc_out"></div>`);doPlate();}
function doPlate(){const target=parseFloat(val('pc_target'))||0;const bar=parseFloat(val('pc_bar'));
  const el=document.getElementById('pc_out');if(!el)return;
  if(target<bar){el.innerHTML=`<div class="note warn">Das Zielgewicht ist kleiner als die Stange (${bar} kg).</div>`;return;}
  const r=platesPerSideJS(target,bar,[25,20,15,10,5,2.5,1.25]);
  let h=`<div class="card center mb-3"><div class="meta">Pro Seite</div>`;
  if(!r.out.length)h+=`<div class="h3 mt-2">Nur die Stange</div>`;
  else h+=`<div class="plates">`+r.out.map(([p,c])=>`<span class="plate">${c}× ${_fmtP(p)} kg</span>`).join('')+`</div>`;
  h+=`</div>`;
  if(r.remainder>0.01)h+=`<div class="note warn">Exakt ${_fmtP(target)} kg nicht möglich. Nächstmöglich: <b>${_fmtP(r.achievable)} kg</b> (${_fmtP(r.remainder)} kg fehlen). Tipp: kleinere Scheiben besorgen.</div>`;
  else h+=`<div class="note ok center">Ergibt genau ${_fmtP(r.achievable)} kg ✓</div>`;
  el.innerHTML=h;}

// ===== PAUSEN-TIMER + TRAININGSLEISTE (#restBar aus index.html) =====
// Zustand: REST_END_AT = Endzeitstempel der laufenden Pause in ms, 0 = keine Pause. restTotal = gewählte
// Länge in Sekunden, nur für den Fortschrittsbalken. restInt = Handle des nächsten Ticks. REST_SECS =
// Standardlänge, pro Gerät in localStorage 'be_rest'; Picker via Tipp auf die Zeit.
// Die Leiste hat zwei Zustände:
//  · läuft: Countdown · −15 · +15 · Abschließen (nur Symbol, damit −15/+15 immer Platz haben) · Fertig
//  · idle (Kraft-Tab, mindestens ein Satz heute): „Pause" (Tipp = Picker + Start) · Hantelrechner · Abschließen
// Solange die Leiste sichtbar ist, trägt body.rest-on (Seitenabstand unten, Toasts höher).
//
// WARUM ein Endzeitstempel und kein Zähler: bis 2.4.0 zog ein setInterval jede Sekunde `restLeft--`.
// Liegt die App im Hintergrund oder ist der Bildschirm gesperrt, drosseln iOS und Android diese Ticks
// oder halten sie ganz an – die Sekunden liefen weiter, der Zähler nicht. Nach zwei Minuten Sperre stand
// die Anzeige bei 1:10 statt bei 0:00 (RATE-25-training H2). Eine Uhrzeit lässt sich nicht drosseln:
// REST_END_AT ist die einzige Wahrheit, alles andere wird daraus gerechnet.
let restInt=null,restTotal=0,REST_END_AT=0;
let REST_SECS=(()=>{try{const v=parseInt(localStorage.getItem('be_rest'));return [60,90,120,180].includes(v)?v:90;}catch(e){return 90;}})();
// Verbleibende Sekunden aus der Uhr – aufgerundet, damit die letzte angefangene Sekunde als 0:01 dasteht.
function trRestTickFromClock(){return REST_END_AT?Math.max(0,Math.ceil((REST_END_AT-Date.now())/1000)):0;}
// Der nächste Tick zielt genau auf die nächste volle Sekunde der Restzeit und plant sich danach neu.
// Kommt er zu spät (Hintergrund, langsames Gerät), korrigiert die nächste Rechnung den Fehler von selbst.
function trRestSchedule(){clearTimeout(restInt);restInt=null;
  if(!REST_END_AT)return;
  const ms=REST_END_AT-Date.now();
  if(ms<=0){restDone();return;}
  restInt=setTimeout(()=>{restInt=null;drawRest();trRestSchedule();},((ms-1)%1000)+1);}
function startRest(seconds){restTotal=(+seconds>0?+seconds:REST_SECS);
  REST_END_AT=Date.now()+restTotal*1000;
  drawRest(true);trRestSchedule();trainBarSync();}
// jump=true: der Wert springt (Start, ±15 s, Rückkehr aus dem Hintergrund). Dann darf der Balken nicht
// eine Sekunde lang zu einer Restzeit hinlaufen, die es gar nicht mehr gibt (app.css: width 1s linear).
function drawRest(jump){const left=trRestTickFromClock();const m=Math.floor(left/60),s=left%60;
  const el=document.getElementById('restTime');if(el)el.textContent=m+':'+String(s).padStart(2,'0');
  const p=document.getElementById('restProg');if(!p)return;
  if(jump)p.style.transition='none';
  p.style.width=(restTotal?Math.round(left/restTotal*1000)/10:0)+'%';
  if(jump){void p.offsetWidth;p.style.transition='';}}
function restAdd(s){if(!REST_END_AT)return;
  REST_END_AT=Math.max(Date.now(),REST_END_AT+s*1000);
  const left=trRestTickFromClock();if(left>restTotal)restTotal=left;
  drawRest(true);trRestSchedule();}
function restStop(){clearTimeout(restInt);restInt=null;REST_END_AT=0;trainBarSync();}
function restHide(){restStop();} // legacy-Name
// quiet=true: die Pause ist im Hintergrund abgelaufen und wird beim Zurückkommen nur noch nachgeholt –
// dann sind Piepser und Vibration Lärm, der Nutzer schaut ja gerade auf den Bildschirm.
function restDone(quiet){clearTimeout(restInt);restInt=null;REST_END_AT=0;
  if(!quiet){trBeep();
    try{if(navigator.vibrate)navigator.vibrate(200);}catch(e){}
    trRestNotify();}
  toast('Pause vorbei – nächster Satz');trainBarSync();}

// ---- Ton, Bildschirm, Benachrichtigung ------------------------------------------------------
// iOS gibt einen AudioContext ausschliesslich während einer echten Nutzergeste frei. Bis 2.4.0 entstand
// er erst beim Ablauf der Pause (in restDone) – dort gibt es keine Geste, der Ton blieb auf dem iPhone
// dauerhaft stumm (RATE-25-training H2). Deshalb wird er beim ERSTEN bestätigten Satz der Sitzung
// angelegt und entsperrt; danach lebt er weiter und wird nicht mehr geschlossen.
let TR_AUDIO_CTX=null;
function trAudioUnlock(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  if(!TR_AUDIO_CTX||TR_AUDIO_CTX.state==='closed')TR_AUDIO_CTX=new AC();
  if(TR_AUDIO_CTX.state==='suspended'){const p=TR_AUDIO_CTX.resume();if(p&&typeof p.catch==='function')p.catch(()=>{});}
}catch(e){}}
function trBeep(){try{const ctx=TR_AUDIO_CTX;if(!ctx||ctx.state==='closed')return;
  if(ctx.state==='suspended'){const p=ctx.resume();if(p&&typeof p.catch==='function')p.catch(()=>{});}
  const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime;
  o.connect(g);g.connect(ctx.destination);o.frequency.value=880;
  // kurze Rampe statt hartem Ein/Aus – sonst knackt es auf Handylautsprechern
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.12,t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,t+0.25);
  o.start(t);o.stop(t+0.26);}catch(e){}}
// Wake-Lock: zwischen zwei Sätzen liegt das Handy auf der Bank. Sperrt sich dabei der Bildschirm, kostet
// der nächste Satz erst Entsperren, dann Tippen – und man sieht nicht, wie lange die Pause noch läuft.
// Ab dem ersten bestätigten Satz halten wir den Bildschirm wach (trWakeLock.want), bei „Training beendet"
// geben wir ihn frei. Die Schnittstelle fehlt in manchen Browsern und schlägt in unsichtbaren Seiten fehl:
// beides wird still geschluckt – es ist reiner Komfort, es hängt nichts daran.
let TR_WAKE_LOCK=null;
function trWakeLock(){try{
  if(TR_WAKE_LOCK||trWakeLock.busy||!navigator.wakeLock||document.visibilityState!=='visible')return;
  trWakeLock.busy=1;
  navigator.wakeLock.request('screen').then(w=>{trWakeLock.busy=0;
    if(!trWakeLock.want){try{w.release();}catch(e){}return;} // inzwischen beendet
    TR_WAKE_LOCK=w;try{w.addEventListener('release',()=>{if(TR_WAKE_LOCK===w)TR_WAKE_LOCK=null;});}catch(e){}
  },()=>{trWakeLock.busy=0;});}catch(e){trWakeLock.busy=0;}}
function trWakeRelease(){const w=TR_WAKE_LOCK;TR_WAKE_LOCK=null;if(w)try{w.release();}catch(e){}}
// „Pause vorbei" als Benachrichtigung – ausschliesslich, wenn die Erlaubnis schon erteilt ist. Wir fragen
// hier NIE danach: ein Berechtigungsdialog mitten im Satz ist eine Zumutung, und ein abgelehnter Dialog
// ist dauerhaft verloren. Sichtbare Seite braucht keine Benachrichtigung – dort reichen Ton und Toast.
function trRestNotify(){try{
  if(document.visibilityState==='visible')return;
  if(typeof Notification==='undefined'||Notification.permission!=='granted')return;
  const opt={body:'Weiter mit dem nächsten Satz.',tag:'be-rest',icon:'/icon-192.png'};
  try{const n=new Notification('Pause vorbei',opt);setTimeout(()=>{try{n.close();}catch(e){}},20000);return;}catch(e){}
  // Android Chrome verbietet den Konstruktor und kennt nur den Weg über den Service Worker.
  if(navigator.serviceWorker&&navigator.serviceWorker.ready)
    navigator.serviceWorker.ready.then(reg=>reg.showNotification('Pause vorbei',opt)).catch(()=>{});
}catch(e){}}
// Pausenlänge wählen (Tipp auf die Zeit): 60/90/120/180 s, gemerkt pro Gerät; im Idle-Zustand auch „Pause starten"
function restPick(){const opts=[60,90,120,180];const running=REST_END_AT>0;
  openSheet('Pausenlänge',`<div class="note mb-3">${running?'Die laufende Pause startet mit der neuen Länge neu.':'Standardlänge für den Pausen-Timer nach jedem bestätigten Satz.'}</div>
    <div class="grid-4 mb-3">${opts.map(n=>`<button class="chip pick${n===REST_SECS?' on':''}" onclick="restSetDefault(${n})">${n} s</button>`).join('')}</div>
    ${running?'':`<button class="btn block" onclick="restStartNow()">${icon('timer',18)} Pause starten (${REST_SECS} s)</button>`}`);}
function restSetDefault(n){n=+n;REST_SECS=n;try{localStorage.setItem('be_rest',String(n));}catch(e){}
  trAudioUnlock(); // Tipp im Picker ist eine Nutzergeste – hier lässt sich der Ton noch entsperren
  if(REST_END_AT>0){closeModal();startRest(n);}else restPick();}
function restStartNow(){closeModal();trAudioUnlock();startRest(REST_SECS);}
// Leiste an den Zustand anpassen (wird von Timer, Fortschritt, Tab-Wechsel und View-Wechsel aufgerufen)
function trainBarSync(){const bar=document.getElementById('restBar');if(!bar)return;
  const running=REST_END_AT>0;
  const onStrength=!!document.getElementById('exlist')&&!coachView();
  const c=onStrength?_countDone():{done:0,total:0};
  const idle=onStrength&&c.done>0&&trainBarSync.dismissed!==today();
  const pct=c.total?c.done/c.total:0;
  const nearDone=idle&&pct>=.8;            // ab 80 % ist der Abschluss die wichtigste Aktion (roter Knopf)
  const showFinish=idle;                   // „Abschließen" bleibt sichtbar, sobald der erste Satz steht (auch während der Pause)
  const show=running||idle;
  bar.classList.toggle('hidden',!show);bar.classList.toggle('idle',!running);
  document.body.classList.toggle('rest-on',show);
  // −15/+15 bleiben sichtbar, solange die Pause läuft – auch am Ende der Einheit, wo die Pausen am längsten
  // sind. Platz macht stattdessen „Abschließen": während der Pause nur als Symbol (siehe Slot unten).
  ['restSub15','restAdd15'].forEach(id=>{const b=document.getElementById(id);if(b)b.hidden=!running;});
  const st=document.getElementById('restStop');if(st)st.hidden=!running;
  const slot=document.getElementById('trainBarSlot');
  if(slot){let h='';
    // Solange die Pause läuft, tritt der Hantelrechner zurück und „Abschließen" wird zum Symbol – so bleibt
    // Platz für Countdown · −15 · +15 · Fertig (die Pausensteuerung ist in diesem Moment das Wichtigste)
    if(onStrength&&!running)h+=`<button class="btn icon sm" aria-label="Hantelrechner" onclick="openPlateCalc(curRowWeight())">${icon('dumbbell',20)}</button>`;
    if(showFinish)h+=running
      ? `<button class="btn icon sm${nearDone?' red':''}" aria-label="Training abschließen" title="Training abschließen" onclick="openWorkoutSummary()">${icon('trophy',20)}</button>`
      : `<button class="btn sm${nearDone?'':' sec'}" onclick="openWorkoutSummary()">Abschließen</button>`;
    if(slot.innerHTML!==h)slot.innerHTML=h;}
  if(!running){const t=document.getElementById('restTime');if(t)t.textContent='Pause';const p=document.getElementById('restProg');if(p)p.style.width='0%';}}
// View-Wechsel (Router ersetzt #views) -> Leiste nachziehen
(function(){const v=document.getElementById('views');if(!v||typeof MutationObserver==='undefined')return;
  new MutationObserver(()=>{clearTimeout(trainBarSync._t);trainBarSync._t=setTimeout(trainBarSync,30);}).observe(v,{childList:true});})();

// ===== Bindungen nach dem Laden aller Skripte =====
// · Tour-Schritte des Trainings-Tabs an das neue Layout anpassen (Daten aus account.js, keine Code-Änderung dort)
function _trInit(){
  // falls coach.js die alten Zeilen-Fallbacks doch installiert hat: Kachel-Version gewinnt
  window.openRhythmus=openRhythmus;window.drawRhythmus=drawRhythmus;window.saveRhythmus=saveRhythmus;
  window._cycleRow=_cycleRow;window.cycleText=cycleText;window.rhyPick=rhyPick;window.rhySet=rhySet;window.rhyMove=rhyMove;window.rhyRemove=rhyRemove;window.rhyAdd=rhyAdd;
  window.rhyRemoveLast=rhyRemoveLast;window.rhyPresets=rhyPresets;window.rhyApplyPreset=rhyApplyPreset;
  try{if(typeof TOUR_DEFS==='object'&&TOUR_DEFS&&TOUR_DEFS.workout)TOUR_DEFS.workout=[
    {sel:'#daysel',title:'Deine Trainingstage',body:'Wechsle hier zwischen deinen Trainingstagen. Der rote Chip ist für heute vorgeschlagen; hinter den drei Punkten bearbeitest du deinen Plan.',pos:'below'},
    {sel:'#trainProg',title:'Dein Fortschritt',body:'Hier siehst du, wie viele Sätze du heute schon geschafft hast. Pausen-Timer, Hantelrechner und „Abschließen" erscheinen unten in der Leiste, sobald du loslegst.',pos:'below'},
    {sel:'#exlist',title:'Übungen loggen',body:'Tippe eine Übung an, trag Gewicht und Wiederholungen ein und bestätige den Satz mit dem Haken. Der farbige Hinweis sagt dir, ob du steigern solltest.',pos:'above'}];}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',_trInit);else _trInit();
