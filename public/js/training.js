// BE INEVITABLE – Frontend, Teil «training.js» (WP2, v2.1). Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js.
// Inhalt: Trainings-Tab (Kraft: Tages-Chips, Fortschritts-Banner, Übungskarten mit Ein-Daumen-Satzlogging,
// Plan-Menü) · Übungs-Sheets (Menü, Notiz, Ausführung, Verlauf, Formular) · Abschluss · Cardio-Tab ·
// Kalender + Tages-Sheet · Trainingsrhythmus-Editor · Technik-Lexikon · Hantelrechner · Pausen-Timer /
// Trainingsleiste (#restBar, Markup in index.html).
// Regeln: ein Satz zählt erst mit Reps > 0 (per ✓ oder Änderung im Reps-Feld); Vorschläge aus dem letzten
// Training werden NIE stillschweigend gespeichert.

// ===== kleine Helfer (nur hier) =====
function _inv(tab){try{if(typeof invalidateView==='function')invalidateView(tab);}catch(e){}}
function _fmtW(w){w=+w||0;return fmtNum(w,(w%1)?1:0);}
// Scheibengewichte brauchen zwei Nachkommastellen (1,25 kg) – ohne unnötige Nullen
function _fmtP(w){w=+w||0;return fmtNum(w,(w%1===0)?0:((Math.round(w*100)%10)?2:1));}
function _findEx(id){for(const d of (PLAN?.days||[]))for(const e of (d.exercises||[]))if(e.id===id)return e;return null;}
// Kurzform eines Tagesnamens für Kalender-/Rhythmus-Kacheln: „Lower 1" -> „L1", „Push" -> „Pu", „Ganzkörper A" -> „GA"
function dayAbbr(name){const t=String(name||'').trim().split(/\s+/).filter(Boolean);if(!t.length)return 'T';
  if(t.length>=2){const last=t[t.length-1];return (t[0].charAt(0)+(/^\d+$/.test(last)?last:last.charAt(0))).toUpperCase().slice(0,3);}
  return t[0].charAt(0).toUpperCase()+t[0].slice(1,2);}
// Progression je Tag für die Sitzung merken (1 Batch-Request statt 10; bei Plan-Änderungen leeren)
const PROG_CACHE={};
function _progInvalidate(){for(const k of Object.keys(PROG_CACHE))delete PROG_CACHE[k];}
const EX_META={}; // Basis-Metazeile je Übung (wird bei „fertig" durch die Zusammenfassung ersetzt)

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
  renderDaySel();renderEx({quiet:o.quiet});trainBarSync();
  if(typeof maybeStartTabTour==='function')try{maybeStartTabTour('workout',{deferred:true});}catch(e){}}
function renderDaySel(){const el=document.getElementById('daysel');if(!el)return;
  el.innerHTML=(PLAN?.days||[]).map(d=>`<button class="chip${d.id===CUR_DAY?' on':''}" onclick="selDay(${d.id})">${esc2(d.name)}</button>`).join('');
  const dt=document.getElementById('dayDate');if(dt)dt.textContent=fmtDate(new Date(),{weekday:'short'});}
async function selDay(id){if(id===CUR_DAY)return;CUR_DAY=id;renderDaySel();await renderEx();}
function curDayObj(){return (PLAN?.days||[]).find(d=>d.id===CUR_DAY);}
// Menü-Zeile für Sheets (Icon · Label · Chevron)
function _mrow(ic,label,fn,o){o=o||{};return `<div class="row tap${o.cls?' '+o.cls:''}" onclick="${fn}"><div class="r-ic">${icon(ic,22)}</div><div class="rl">${esc2(label)}${o.sub?`<small>${esc2(o.sub)}</small>`:''}</div></div>`;}
// „···" neben den Tages-Chips: alles Seltene (Tag verwalten/anlegen, Kalender, Rhythmus, Coach-Vorlagen)
function openPlanMenu(){const d=curDayObj();const cv=coachView();const own=ME&&VIEW_USER===ME.id;
  let h='<div class="rows">';
  if(d)h+=_mrow('dumbbell','Übung hinzufügen',`closeAllSheets();addExercise()`,{sub:'zu „'+d.name+'"'});
  if(d)h+=_mrow('settings','Tag verwalten',`manageDay()`,{sub:'Umbenennen oder löschen'});
  h+=_mrow('plus','Trainingstag hinzufügen',`addDay()`);
  h+=_mrow('calendar','Kalender',`openCalendar()`,{sub:'Tage planen oder nachtragen'});
  if(own)h+=_mrow('refresh','Trainingsrhythmus',`openRhythmus()`,{sub:'Folge von Trainings- und Ruhetagen'});
  if(cv){h+=_mrow('download','Als Vorlage speichern',`closeAllSheets();saveAsTemplate()`);
    h+=_mrow('upload','Vorlage anwenden',`closeAllSheets();openTemplates()`);
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
function deleteDay(id){const d=(PLAN?.days||[]).find(x=>x.id===id)||curDayObj();if(!d)return;
  confirmSheet('Tag löschen',`„${d.name}" wirklich löschen? Die Übungen dieses Tags werden mitgelöscht. Dein Rhythmus passt sich automatisch an.`,{label:'Tag löschen',onYes:async()=>{
    const r=await API.del('/days/'+d.id);
    if(r.status===200){closeAllSheets();CUR_DAY=null;_progInvalidate();await loadPlan();renderWorkout.lastEff=null;renderWorkout(document.getElementById('views'));_inv();toast('Tag gelöscht');}
    else toast(r.data?.error||'Fehler');}});}

// ---- Übungsliste ----
async function _todayLogs(){const lr=await API.get('/logs/'+VIEW_USER+'?date='+today());return lr.data?.logs||[];}
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
function _exRowCoach(ex,i){return `<div class="row" id="ex-${ex.id}" data-id="${ex.id}"><div class="r-ic num">${i+1}</div>
  <div class="rl">${esc2(ex.name)}<small>${ex.target_sets||3} × ${esc2(ex.target_reps||'–')}${ex.muscle?' · '+esc2(ex.muscle):''}${ex.technique?' · '+esc2(ex.technique):''}</small></div>
  <div class="rr"><button class="btn icon sm" aria-label="Bearbeiten" onclick="editExercise(${ex.id})">${icon('pencil',18)}</button><button class="btn icon sm ghost" aria-label="Optionen" onclick="exMenu(${ex.id})">${icon('more',20)}</button></div></div>`;}
function _exCard(ex,i,pr,logs){const sets=ex.target_sets||3;pr=pr||{};const rec=pr.recommendation||{type:'none',text:''};
  const logFor=s=>logs.find(l=>l.exercise_id===ex.id&&l.set_no===s)||{};
  const lastFor=s=>(pr.lastSets||[]).find(x=>x.set_no===s&&x.reps>0);
  const prs=pr.prs||{};const prToday=!!(logSet.prDone&&Object.keys(logSet.prDone).some(k=>k.startsWith(ex.id+'_')));
  const recentPR=prToday||(prs.maxWeightDate&&(Date.now()-Date.parse(prs.maxWeightDate+'T00:00'))<7*864e5&&prs.maxWeightDate<today());
  const meta=`${esc2(ex.muscle||'')}${ex.target_reps?(ex.muscle?' · ':'')+esc2(ex.target_reps)+' Reps':''}`+
    (ex.technique?` · <button class="tchip" type="button" aria-label="Technik ${esc2(ex.technique)} erklären" onclick="event.stopPropagation();explainTechnique('${esc(ex.technique)}')">${esc2(ex.technique)}${icon('info',12)}</button>`:'')+
    (prs.maxWeight>0?(recentPR?` <span class="pill amber pr">${icon('trophy',12)} ${_fmtW(prs.maxWeight)} kg</span>`:` · Best ${_fmtW(prs.maxWeight)} kg`):'');
  EX_META[ex.id]=meta;
  const recIcon={up:'trendUp',down:'trendDown',hold:'trendFlat'}[rec.type];
  const rows=Array.from({length:sets},(_,k)=>{const s=k+1;const lg=logFor(s);const ps=lastFor(s);
    const hasToday=(lg.weight!=null&&lg.weight>0)||(lg.reps!=null&&lg.reps>0);
    const wVal=hasToday?(lg.weight??''):(ps?ps.weight??'':'');const rVal=hasToday?(lg.reps>0?lg.reps:''):(ps?ps.reps??'':'');
    const sugg=!hasToday&&!!ps;const sc=sugg?' class="sugg"':'';
    return `<div class="setgrid" data-ex="${ex.id}" data-set="${s}">
      <div class="sn">${s}</div>
      <div><input type="number" inputmode="decimal" min="0" max="1000" placeholder="kg"${sc} value="${wVal}" data-sugg="${sugg?1:0}" aria-label="Gewicht Satz ${s}" onfocus="clearSugg(this)" oncontextmenu="event.preventDefault();openPlateCalc(this.value)" onchange="logSet(${ex.id},${s},'weight',this.value)"><div class="prev">${ps?'zuletzt '+_fmtW(ps.weight)+' kg':'–'}</div></div>
      <div><input type="number" inputmode="numeric" min="0" max="1000" placeholder="–"${sc} value="${rVal}" data-sugg="${sugg?1:0}" aria-label="Wiederholungen Satz ${s}" onfocus="clearSugg(this)" onchange="logSet(${ex.id},${s},'reps',this.value,true)"><div class="prev">${ps?'× '+ps.reps:''}</div></div>
      <button class="ok" type="button" aria-label="Satz ${s} bestätigen" onclick="commitSet(${ex.id},${s})">${icon('check',22)}</button>
    </div>`;}).join('');
  return `<div class="ex" id="ex-${ex.id}" data-id="${ex.id}">
    <div class="ex-head" onclick="toggleEx(${ex.id})">
      <div class="ex-idx" data-n="${i+1}">${i+1}</div>
      <div class="ex-main"><div class="nm">${ex.coach_locked&&!coachView()?icon('lock',14,'lock'):''}${esc2(ex.name)}</div><div class="mg">${meta}</div></div>
      <span class="ex-cnt caption hidden"></span>
      <button class="btn icon sm ghost ex-more" type="button" aria-label="Optionen" onclick="event.stopPropagation();exMenu(${ex.id})">${icon('more',20)}</button>
      <div class="ex-chev">${icon('chevronRight',18)}</div>
    </div>
    <div class="ex-body"><div class="ex-inner">
      ${recIcon&&rec.text?`<div class="rec ${rec.type}"><span class="ric">${icon(recIcon,18)}</span><span>${esc2(rec.text)}</span></div>`:''}
      <div class="setgrid"><div class="hd">Satz</div><div class="hd">Gewicht</div><div class="hd">Reps</div><div class="hd" aria-hidden="true"></div></div>
      ${rows}
      ${ex.notes?`<div class="note">${esc2(ex.notes)}</div>`:''}
    </div></div></div>`;}
async function renderEx(o){o=o||{};const day=curDayObj();const el=document.getElementById('exlist');if(!el)return;
  const addBtn=document.getElementById('addExBtn');if(addBtn)addBtn.classList.toggle('hidden',!(day&&day.exercises.length));
  if(!day){el.innerHTML=emptyState({icon:'calendar',title:'Noch kein Trainingstag',text:'Leg deinen ersten Tag an – z.B. Push, Lower 1 oder Beine.',btn:{label:'Ersten Trainingstag erstellen',onclick:'addDay()'}});trainBarSync();return;}
  if(!day.exercises.length){el.innerHTML=emptyState({icon:'dumbbell',title:'Noch keine Übungen',text:'Füg die erste Übung für diesen Tag hinzu.',btn:{label:'Übung hinzufügen',onclick:'addExercise()'}});trainBarSync();return;}
  const cv=coachView();const seq=(renderEx.seq=(renderEx.seq||0)+1);
  const openId=el.querySelector('.ex.open')?.dataset.id;
  if(!o.quiet)el.innerHTML=(cv?'':skeleton(1,'lg'))+skeleton(3);
  const [logs,progs]=await Promise.all([_todayLogs(),cv?Promise.resolve({}):_loadProgression(day)]);
  if(seq!==renderEx.seq||document.getElementById('exlist')!==el)return; // inzwischen anderer Tag/Tab
  if(cv){el.innerHTML=`<div class="rows plan-rows">${day.exercises.map((ex,i)=>_exRowCoach(ex,i)).join('')}</div>`;trainBarSync();return;}
  const banner=`<div class="card tp" id="trainProg">
    <svg class="ring" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="27" fill="none" stroke="var(--surface3)" stroke-width="6"/>
      <circle id="tpRing" class="ring-fg" cx="32" cy="32" r="27" fill="none" stroke="var(--red)" stroke-width="6" stroke-linecap="butt" stroke-dasharray="${(2*Math.PI*27).toFixed(2)}" stroke-dashoffset="${(2*Math.PI*27).toFixed(2)}" transform="rotate(-90 32 32)"/>
      <text id="tpPct" x="32" y="32" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="var(--ink)">0%</text></svg>
    <div class="fill"><div class="h3">Heutiges Training</div><div class="meta" id="tpSub"></div></div></div>`;
  el.innerHTML=banner+day.exercises.map((ex,i)=>_exCard(ex,i,progs[ex.id],logs)).join('');
  if(openId){const c=document.getElementById('ex-'+openId);if(c)c.classList.add('open');}
  updateTrainProgress();
  // Von der Home gestartet: erste Übung mit offenen Sätzen aufklappen und hinscrollen
  if(renderWorkout.start){renderWorkout.start=false;const first=[...el.querySelectorAll('.ex')].find(c=>!c.classList.contains('done'));
    if(first)setTimeout(()=>toggleEx(+first.dataset.id),80);}}
function toggleEx(id){const el=document.getElementById('ex-'+id);if(!el)return;const wasOpen=el.classList.contains('open');
  document.querySelectorAll('.ex.open').forEach(x=>{if(x!==el)x.classList.remove('open');});
  el.classList.toggle('open',!wasOpen);
  if(!wasOpen)setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),60);}

// ---- Fortschritt (Ring, Karten-Status, Leiste) – reines DOM-Patchen, kein Re-Render ----
// Ein Satz gilt als erledigt, wenn Reps > 0 eingetragen UND bestätigt sind (kein Vorschlag mehr) und der
// letzte Speicherversuch nicht fehlgeschlagen ist (data-failed setzt setSaveStatus).
function _rowDone(g){const r=g.querySelectorAll('input')[1];return !!(r&&r.value!==''&&parseFloat(r.value)>0&&r.dataset.sugg!=='1'&&g.dataset.failed!=='1');}
function _countDone(){let done=0,total=0;document.querySelectorAll('#exlist .ex .setgrid[data-set]').forEach(g=>{total++;if(_rowDone(g))done++;});return {done,total};}
function _paintCard(card){const rows=[...card.querySelectorAll('.setgrid[data-set]')];if(!rows.length)return;
  const done=rows.filter(_rowDone).length,total=rows.length,all=done>=total;
  rows.forEach(g=>{const ok=g.querySelector('.ok');if(ok)ok.classList.toggle('done',_rowDone(g));});
  card.classList.toggle('done',all);
  const cnt=card.querySelector('.ex-cnt');if(cnt){cnt.textContent=done>0&&!all?`${done}/${total}`:'';cnt.classList.toggle('hidden',!(done>0&&!all));}
  const idx=card.querySelector('.ex-idx');if(idx)idx.innerHTML=all?icon('check',16):idx.dataset.n;
  const mg=card.querySelector('.mg');const id=+card.dataset.id;
  if(mg){if(all){const li=rows[rows.length-1].querySelectorAll('input');mg.textContent=`${done}/${total} · ${li[0].value!==''?_fmtW(li[0].value)+' kg × ':''}${li[1].value}`;}
    else if(EX_META[id]!=null&&mg.innerHTML!==EX_META[id])mg.innerHTML=EX_META[id];}}
function updateTrainProgress(doneSets,totalSets){
  document.querySelectorAll('#exlist .ex').forEach(_paintCard);
  if(doneSets==null||totalSets==null){const c=_countDone();doneSets=c.done;totalSets=c.total;}
  const box=document.getElementById('trainProg');
  if(box){const pct=totalSets?Math.round(doneSets/totalSets*100):0;const done=totalSets>0&&doneSets>=totalSets;const C=2*Math.PI*27;
    const ring=document.getElementById('tpRing');if(ring){ring.style.strokeDashoffset=String(C*(1-(totalSets?doneSets/totalSets:0)));ring.setAttribute('stroke',done?'var(--green)':'var(--red)');
      ring.setAttribute('stroke-linecap',doneSets>0?'round':'butt');} // bei 0 % zeichnet ein runder Cap sonst einen Punkt
    const pctEl=document.getElementById('tpPct');if(pctEl)pctEl.textContent=pct+'%';
    const sub=document.getElementById('tpSub');if(sub){sub.textContent=done?'Alle Sätze geschafft – stark!':(doneSets>0?`${doneSets} / ${totalSets} Sätze · noch ${totalSets-doneSets}`:`${pl(totalSets,'Satz','Sätze')} geplant – leg los`);sub.classList.toggle('tone-green',done);}
  }
  trainBarSync();}

// ---- Satz loggen: ✓ pro Zeile ODER Änderung im Reps-Feld; Gewicht allein wird gespeichert, zählt aber nicht ----
function _rowInputs(exId,setNo){const g=document.querySelector(`#exlist .setgrid[data-ex="${exId}"][data-set="${setNo}"]`);if(!g)return null;
  const ins=g.querySelectorAll('input');return {grid:g,w:ins[0],r:ins[1],ok:g.querySelector('.ok')};}
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
  _queueLog(exId,setNo,{weight:row.w.value===''?null:parseFloat(row.w.value),reps},true);
  _afterCommit(exId,setNo);}
function logSet(exId,setNo,field,value,autoTimer){const row=_rowInputs(exId,setNo);
  const n=(value===''||value==null)?null:parseFloat(value);const patch={[field]:n};
  const commit=field==='reps'&&n>0;
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
function _logSig(b){return [b.exercise_id,b.set_no,b.date,b.weight==null?'':b.weight,b.reps==null?'':b.reps].join('|');}
async function _postLog(key){const body=logSet.cache&&logSet.cache[key];if(!body)return;
  const exId=body.exercise_id,setNo=body.set_no,sig=_logSig(body);
  logSet.sent=logSet.sent||{};logSet.busy=logSet.busy||{};
  if(logSet.sent[key]===sig){ // schon unterwegs oder erfolgreich gespeichert -> nichts zu tun
    if(!logSet.busy[key]){setSaveStatus(exId,'saved',setNo);updateTrainProgress();}
    return;}
  logSet.sent[key]=sig;logSet.busy[key]=1;
  const r=await API.post('/logs',body);delete logSet.busy[key];
  if(r.status!==200)delete logSet.sent[key]; // fehlgeschlagen -> „Erneut versuchen" darf wieder senden
  if(r.status===200){setSaveStatus(exId,'saved',setNo);
    // Neuer Übungs-Rekord? Einmal pro Satz melden, Kopfzeile der Karte nachziehen.
    if(r.data?.pr){logSet.prDone=logSet.prDone||{};if(!logSet.prDone[key]){logSet.prDone[key]=1;toast('Neuer Rekord · '+_fmtW(body.weight)+' kg');_markPR(exId,body.weight);_progInvalidate();}}
    if(body.reps>0){TODAY=null;_inv('home');if(typeof refreshAchievements==='function')refreshAchievements();}
    updateTrainProgress();}
  else{setSaveStatus(exId,'error',setNo);updateTrainProgress(); // fehlgeschlagene Zeile fällt aus Ring/Karte heraus
    toast('Satz nicht gespeichert',{label:'Erneut versuchen',fn:()=>_postLog(key)});}}
function _markPR(exId,w){const meta=EX_META[exId];if(meta==null)return;
  const pill=` <span class="pill amber pr">${icon('trophy',12)} ${_fmtW(w)} kg</span>`;
  EX_META[exId]=meta.replace(/ · Best [^<]*$/,'').replace(/ <span class="pill amber pr">.*?<\/span>$/,'')+pill;
  const card=document.getElementById('ex-'+exId);if(card)_paintCard(card);}
function _afterCommit(exId,setNo){
  startRest(REST_SECS); // jeder bestätigte Satz startet die Pause neu
  trainBarSync.dismissed=null;
  try{if(navigator.vibrate)navigator.vibrate(8);}catch(e){}
  updateTrainProgress();
  const card=document.getElementById('ex-'+exId);const next=_rowInputs(exId,setNo+1);
  if(next){setTimeout(()=>{next.w.scrollIntoView({block:'center',behavior:'smooth'});if(next.w.value==='')try{next.w.focus({preventScroll:true});}catch(e){}},80);}
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
  h+=_mrow('play','Ausführung',`openVideo('${esc(name)}','${esc(ex?.video_url||'')}')`);
  if(typeof shareViaLink==='function')h+=_mrow('share','Teilen',`shareViaLink('exercise',${id})`);
  h+=_mrow('chartLine','Verlauf',`openExHistory(${id},'${esc(name)}')`);
  h+=_mrow('settings','Bearbeiten',`editExercise(${id})`);
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

function openVideo(name,url){const q=encodeURIComponent(name+' richtige Ausführung Technik');
  const safeUrl=/^https?:\/\/\S+$/.test(url||'')?url:''; // nur echte http(s)-Links (kein javascript: o.ä.)
  const yt=safeUrl||`https://www.youtube.com/results?search_query=${q}`;
  openSheet('Ausführung: '+name,`<div class="note mb-3">${safeUrl?'Vom Coach hinterlegte Anleitung.':'Such-Ergebnisse für die korrekte Ausführung. Achte auf saubere Technik vor Gewicht.'}</div>
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
  <div class="field"><label>Übung</label><input id="ex_name" value="${esc2(ex?.name||'')}" placeholder="z.B. Leg Press" maxlength="120"></div>
  <div class="field"><label>Muskelgruppe</label><input id="ex_muscle" value="${esc2(ex?.muscle||'')}" placeholder="z.B. Quads" maxlength="60"></div>
  <div class="grid-2">
    <div class="field"><label>Sätze (1–10)</label><input id="ex_sets" type="number" inputmode="numeric" min="1" max="10" value="${ex?.target_sets||3}"></div>
    <div class="field"><label>Reps</label><input id="ex_reps" value="${esc2(ex?.target_reps||'')}" placeholder="8-12" maxlength="20"></div>
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
  EX_FORM_CTX={id:null,draft:null};
  openSheet('Übung hinzufügen',exForm(null)+`<button class="btn block" onclick="confirmAddExercise()">Hinzufügen</button>`);}
async function confirmAddExercise(){const body={day_id:CUR_DAY,..._exFormBody()};
  if(!body.name)return showFieldErr('sheetBody','Übungsname fehlt','ex_name');
  const r=await API.post('/exercises',body);
  if(r.status===200){closeAllSheets();_progInvalidate();await loadPlan();renderEx();_inv();toast('Hinzugefügt ✓');}else toast(r.data?.error||'Fehler');}
function editExercise(id){const ex=_findEx(id);if(!ex)return;EX_FORM_CTX={id:id,draft:null};
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

// Achse mit genau 5 Gitterlinien und „schönem" Schritt (Vielfaches von base). lineChart2 leitet die rechte
// Beschriftung aus der Position der linken Linien ab – nur mit gleicher Linienzahl bleiben beide Achsen rund.
function _axis5(vals,base){const mn=Math.min(...vals),mx=Math.max(...vals);
  for(const m of [1,2,2.5,5,10,20,25,50,100,200,250,500,1000]){const c=base*m;const lo=Math.floor(mn/c)*c;
    if(lo+4*c>=mx-1e-9)return {domain:[Math.round(lo*1e6)/1e6,Math.round((lo+4*c)*1e6)/1e6],step:c};}
  const c=((mx-mn)/4)||base;return {domain:[mn,mn+4*c],step:c};}
// ---- Verlauf einer Übung: Top-Gewicht + Reps je Einheit, freundlicher Einzel-Zustand, letzte Einheiten ----
async function openExHistory(exId,name){name=name||'Übung';openSheet(name,'<div class="spinner"></div>');
  // ?exercise_id= liefert ALLE Sätze dieser Übung (ohne die 500er-Kappung der ungefilterten Liste) – sonst
  // fehlen bei langer Historie ganze Einheiten und die Kurve beginnt zu spät.
  const r=await API.get('/logs/'+VIEW_USER+'?exercise_id='+exId);
  const logs=(r.data?.logs||[]).filter(l=>l.exercise_id===exId&&l.reps>0);
  if(!logs.length){openSheet(name,emptyState({icon:'chartLine',title:'Noch keine Sätze geloggt',text:'Ab dem ersten Training entsteht hier deine Kurve.'}));return;}
  const byDate={};logs.forEach(l=>{const d=byDate[l.date]||(byDate[l.date]={date:l.date,sets:[],top:0,reps:0});d.sets.push(l);
    const w=l.weight||0;if(w>d.top||(w===d.top&&l.reps>d.reps)){d.top=w;d.reps=l.reps;}});
  const rows=Object.values(byDate).sort((a,b)=>a.date<b.date?-1:1);rows.forEach(d=>d.sets.sort((a,b)=>a.set_no-b.set_no));
  const list=`<div class="section-label">Letzte Einheiten</div><div class="rows">${rows.slice(-8).reverse().map(d=>`<div class="row"><div class="rl">${fmtDate(d.date,{weekday:'short'})}<small>${d.sets.map(s=>_fmtW(s.weight)+' × '+s.reps).join(' · ')}</small></div><div class="rr">${_fmtW(d.top)} kg</div></div>`).join('')}</div>`;
  if(rows.length<2){const d=rows[0];
    openSheet(name,`<div class="note status mb-3">Erste Einheit: <b>${_fmtW(d.top)} kg × ${d.reps}</b> am ${fmtDate(d.date).replace(/\.$/,'')}. Ab der zweiten Einheit erscheint hier deine Kurve.</div>${list}`);return;}
  const tops=rows.map(x=>x.top);const best=Math.max(...tops);const diff=Math.round((rows[rows.length-1].top-rows[0].top)*10)/10;
  const A1=_axis5(tops,0.5),A2=_axis5(rows.map(x=>x.reps),1); // beide Achsen mit 5 Linien -> rechts bleiben Reps ganzzahlig
  const data=rows.map(d=>({date:d.date,v1:d.top,v2:d.reps}));
  openSheet(name,`<div class="grid-3 hist-stats mb-3">
      <div class="tile"><div class="v">${_fmtW(best)}<em> kg</em></div><div class="l">Bestleistung</div></div>
      <div class="tile"><div class="v${diff>0?' tone-green':diff<0?' tone-red':''}">${diff>0?'+':''}${_fmtW(diff)}<em> kg</em></div><div class="l">seit Beginn</div></div>
      <div class="tile"><div class="v">${rows.length}</div><div class="l">Einheiten</div></div></div>
    <div class="chart-card"><div class="ch-h"><div class="t">Top-Gewicht und Reps</div><div class="v">kg · Wiederholungen</div></div>${lineChart2(data,'Gewicht','kg','Reps','',{domain1:A1.domain,step1:A1.step,tickFmt1:_fmtW,domain2:A2.domain,step2:A2.step,tickFmt2:v=>fmtNum(Math.round(v))})}</div>${list}`);}

// ===== CARDIO-TAB im Training =====
async function drawCardioTab(o){o=o||{};const b=document.getElementById('workoutBody');if(!b)return;
  if(!(o.quiet&&b.querySelector('.cardio')))b.innerHTML=skeleton(1,'sm')+skeleton(2);
  const r=await API.get('/cardio/'+VIEW_USER);const all=r.data?.cardio||[];drawCardioTab.list=all;
  if(document.getElementById('workoutBody')!==b||renderWorkout.tab!=='cardio')return;
  // „Diese Woche" = Kalenderwoche ab Montag – gleiche Definition wie in der Analyse und beim Wochenziel,
  // damit beide Bildschirme nie unterschiedliche Zahlen unter derselben Überschrift zeigen.
  const wa=new Date();wa.setDate(wa.getDate()-((wa.getDay()+6)%7));const weekAgo=fmt(wa);const wk=all.filter(c=>c.date>=weekAgo);
  const wkMin=wk.reduce((a,c)=>a+(c.minutes||0),0),wkKcal=wk.reduce((a,c)=>a+(c.kcal||0),0),wkKm=wk.reduce((a,c)=>a+(c.distance_km||0),0);
  const kindIcon=k=>({Laufen:'footprints',Joggen:'footprints',Gehen:'footprints',Wandern:'footprints',Stepper:'footprints',Schwimmen:'droplet',HIIT:'zap',Crossfit:'zap',Seilspringen:'zap',Rad:'refresh',Spinning:'refresh',Rudern:'wind',Crosstrainer:'wind'})[k]||'heart';
  let h=`<div class="cardio">${coachView()?'':`<button class="btn block" onclick="openCardio()">${icon('plus',18)} Cardio-Einheit erfassen</button>`}
    <div class="section-label">Diese Woche</div>
    <div class="cardio-tiles">
      <div class="tile"><div class="v">${fmtNum(wkMin)}<em> min</em></div><div class="l">Cardio-Zeit</div></div>
      <div class="tile"><div class="v">${fmtNum(Math.round(wkKcal))}<em> kcal</em></div><div class="l">verbrannt</div></div>
      ${wkKm>0?`<div class="tile"><div class="v">${fmtNum(wkKm,1)}<em> km</em></div><div class="l">Distanz</div></div>`:''}
    </div>`;
  if(!all.length)h+=emptyState({icon:'heart',title:'Noch keine Cardio-Einheiten',text:coachView()?'Hier erscheinen die Cardio-Einheiten deines Athleten.':'Erfasse deine erste Einheit – Laufen, Rad, Schwimmen oder HIIT.',btn:coachView()?null:{label:'Einheit erfassen',onclick:'openCardio()'}});
  else{h+='<div class="section-label">Verlauf</div><div class="rows">'+all.slice(0,40).map(c=>{
    const pace=_cardioPace(c)?' · '+_cardioPace(c):'';
    return `<div class="row"><div class="r-ic">${icon(kindIcon(c.kind),22)}</div><div class="rl">${esc2(c.kind)}<small>${fmtDate(c.date)} · ${c.minutes||0} min${c.distance_km?' · '+fmtNum(c.distance_km,1)+' km':''}${pace} · ${esc2(c.intensity||'moderat')}</small></div>
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
  const todayISO=today();
  let cells='';for(let i=0;i<(first.getDay()+6)%7;i++)cells+='<div></div>';
  for(let day=1;day<=last.getDate();day++){
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const e=byDate[iso];const isTrain=e?.type==='train',isSick=e?.type==='sick',isRest=e?.type==='rest';
    const isToday=iso===todayISO,isPast=iso<todayISO;
    cells+=`<button class="cal-cell${isTrain?' train':isSick?' sick':isRest?' rest':''}${isToday?' today':''}${isPast&&!e?' past':''}" onclick="calDay('${iso}',${isPast?'true':'false'})" aria-label="${fmtDate(iso,{weekday:'long',month:'long'})}">
      <span class="d">${day}</span><span class="n">${isTrain?esc2(dayAbbr(e.dayName||'Training')):isSick?'K':e?'–':''}</span>${e?.planned?'<i class="dot"></i>':''}</button>`;}
  openSheet('Kalender',`
    <div class="cal-head"><button class="btn icon sm" aria-label="Voriger Monat" onclick="calNav(-1)">${icon('chevronLeft',20)}</button><div class="h3">${esc2(monthName)}</div><button class="btn icon sm" aria-label="Nächster Monat" onclick="calNav(1)">${icon('chevronRight',20)}</button></div>
    <div class="cal-wd">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>`<span>${w}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-legend"><span><i class="sw train"></i>Training</span><span><i class="sw rest"></i>Ruhetag</span><span><i class="sw sick"></i>Krank</span><span><i class="sw dot"></i>geplant</span></div>
    <div class="note mt-3">Tippe auf einen Tag, um ihn zu planen – z.B. einen Ruhetag, wenn du unterwegs bist. Dein Rhythmus rechnet automatisch weiter.</div>
    ${VIEW_USER===ME.id?`<button class="btn sec mt-3" onclick="openRhythmus()">${icon('refresh',18)} Trainingsrhythmus anpassen</button>`:''}`);}
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
    ${e?.planned?`<button class="btn block ghost mt-3" onclick="clearCalDay('${iso}')">Planung entfernen (automatisch)</button>`:''}`);}
async function _afterCalChange(iso){TODAY=null;await loadToday();_inv();
  if(iso===today())renderWorkout.lastEff=null; // heutige Empfehlung kann sich geändert haben
  drawCalendar();refreshHomeIfActive();
  if(iso===today()&&document.getElementById('exlist')){const before=CUR_DAY;const eff=TODAY?.confirmed||TODAY?.suggestion;
    if(eff?.type==='train'&&eff.dayName){const m=(PLAN?.days||[]).find(d=>d.name===eff.dayName);if(m)CUR_DAY=m.id;}
    renderWorkout.lastEff=VIEW_USER+'|'+(TODAY?.date||today())+'|'+(eff?.type||'')+'|'+(eff?.dayName||'');
    if(CUR_DAY!==before){renderDaySel();renderEx({quiet:true});}}}
async function setCalDay(iso,type,dayName){
  const r=await API.post('/today/'+VIEW_USER,{date:iso,type,day_name:dayName});
  if(r.status===200){toast('Tag geplant ✓');_afterCalChange(iso);}else toast(r.data?.error||'Fehler');}
async function clearCalDay(iso){
  const r=await API.del('/today/'+VIEW_USER+'?date='+iso);
  if(r.status===200){toast('Zurück auf automatisch');_afterCalChange(iso);}else toast(r.data?.error||'Fehler');}
// Profilbild im Header anzeigen (Bild, sonst Initiale). Lädt das Bild bei Bedarf separat.
async function applyAvatar(){const el=document.getElementById('avatar');if(!el||!ME)return;
  if(ME.has_avatar){try{const r=await API.get('/avatar/'+ME.id);if(r.status===200&&r.data.avatar){
    el.textContent='';el.style.backgroundImage=`url(${r.data.avatar})`;el.style.backgroundSize='cover';el.style.backgroundPosition='center';return;}}catch(e){}}
  el.style.backgroundImage='';el.textContent=(ME.name||'?').charAt(0).toUpperCase();}
// Zeichnet die Home neu, wenn sie gerade aktiv ist (nach Kalender-/Rhythmus-Änderungen)
function refreshHomeIfActive(){const cur=document.querySelector('.navbtn.on')?.dataset?.p;
  if(cur==='home'){const v=document.getElementById('views');if(v)renderHome(v);}}
// Zurück aus dem Hintergrund: Tages-Daten als veraltet markieren; die Home nur nach > 5 Minuten neu zeichnen
// (kein DOM-Wipe bei jedem kurzen App-Wechsel).
let _trHiddenAt=0;
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){_trHiddenAt=Date.now();return;}
  if(!ME)return;
  if(_trHiddenAt&&Date.now()-_trHiddenAt>5*60*1000){TODAY=null;_inv();refreshHomeIfActive();}});

// ===== TRAININGSRHYTHMUS-EDITOR (Kacheln; ersetzt die Zeilenliste aus coach.js – Bindung siehe _trInit) =====
let RHY=[];
function _rhyLabels(){const names=(PLAN?.days||[]).map(d=>d.name);let k=0;return RHY.map(s=>s==='train'?(names.length?names[(k++)%names.length]:'Training'):'Ruhe');}
async function openRhythmus(){const me=await API.get('/me');let p=null;try{p=JSON.parse(me.data?.user?.pattern);}catch(e){p=null;}
  RHY=(Array.isArray(p)&&p.length)?p.map(x=>x==='train'?'train':'rest'):['train','train','rest'];
  if(!PLAN)await loadPlan();drawRhythmus();}
function drawRhythmus(){if(!Array.isArray(RHY)||!RHY.length)RHY=['train','train','rest'];
  const labels=_rhyLabels();const trainTotal=RHY.filter(x=>x==='train').length;
  const tiles=RHY.map((s,i)=>`<button class="rhy-tile${s==='train'?' train':''}" type="button" data-i="${i}" aria-label="Tag ${i+1}: ${esc2(labels[i])} – tippen zum Wechseln, lange drücken zum Verschieben" onclick="rhyToggle(${i})" oncontextmenu="event.preventDefault();rhyOptions(${i})"><span class="d">${i+1}</span><span class="n">${s==='train'?esc2(dayAbbr(labels[i])):'–'}</span></button>`).join('');
  const wd=['So','Mo','Di','Mi','Do','Fr','Sa'];const t=new Date();
  const prev=Array.from({length:7},(_,i)=>{const d=new Date(t);d.setDate(t.getDate()+i);const s=RHY[i%RHY.length];const lbl=labels[i%RHY.length];
    return `<div class="rhy-prev${s==='train'?' train':''}"><span class="w">${wd[d.getDay()]}</span><span class="n">${s==='train'?esc2(dayAbbr(lbl)):'–'}</span></div>`;}).join('');
  openSheet('Trainingsrhythmus',`
    <div class="note status mb-3">${trainTotal===1?'1 Trainingstag':trainTotal+' Trainingstage'} in ${pl(RHY.length,'Tag','Tagen')} – die Folge wiederholt sich endlos. Tippen wechselt Training/Ruhe, lange drücken verschiebt oder entfernt einen Tag.</div>
    <div class="rhy-strip" id="rhyStrip">${tiles}</div>
    <div class="cluster mt-3">
      <button class="btn sm sec" onclick="rhyAdd('train')">${icon('plus',16)} Trainingstag</button>
      <button class="btn sm sec" onclick="rhyAdd('rest')">${icon('plus',16)} Ruhetag</button>
      <button class="btn sm sec" onclick="rhyRemoveLast()">${icon('minus',16)} Letzten Tag</button>
    </div>
    <div class="section-label">Vorschau ab heute<span class="sl-r">wenn heute Tag 1 ist</span></div>
    <div class="rhy-week">${prev}</div>
    <button class="btn block mt-4" onclick="saveRhythmus()">Rhythmus speichern</button>`);}
function rhyToggle(i){if(rhyToggle.skip){rhyToggle.skip=false;return;}RHY[i]=RHY[i]==='train'?'rest':'train';drawRhythmus();}
function rhyMove(i,dir){const j=i+dir;if(j<0||j>=RHY.length)return toast(dir<0?'Steht schon ganz vorne':'Steht schon ganz hinten');[RHY[i],RHY[j]]=[RHY[j],RHY[i]];drawRhythmus();}
function rhyRemove(i){if(RHY.length<=1)return toast('Mindestens 1 Tag nötig');RHY.splice(i,1);drawRhythmus();}
function rhyRemoveLast(){rhyRemove(RHY.length-1);}
function rhyAdd(t){if(RHY.length>=14)return toast('Maximal 14 Tage');RHY.push(t);drawRhythmus();}
function rhyOptions(i){const lbl=_rhyLabels()[i];
  openSheet('Tag '+(i+1)+': '+lbl,`<div class="rows">
    ${_mrow('arrowLeft','Nach vorne',`rhyMove(${i},-1)`)}
    ${_mrow('arrowRight','Nach hinten',`rhyMove(${i},1)`)}
    ${_mrow('refresh',RHY[i]==='train'?'Zu Ruhetag machen':'Zu Trainingstag machen',`rhyToggle(${i})`)}
    ${_mrow('trash','Tag entfernen',`rhyRemove(${i})`,{cls:'tone-red'})}</div>`);}
async function saveRhythmus(){if(!RHY.filter(x=>x==='train').length)return toast('Mindestens 1 Trainingstag nötig');
  const r=await API.post('/pattern',{pattern:RHY});
  if(r.status===200){closeAllSheets();TODAY=null;renderWorkout.lastEff=null;_progInvalidate();_inv();toast('Rhythmus gespeichert ✓');
    const cur=document.querySelector('.navbtn.on')?.dataset?.p;if(cur)go(cur);}
  else toast(r.data?.error||'Fehler');}
// Hinweis: Diese Kachel-Version trägt die kanonischen Namen (openRhythmus/drawRhythmus/saveRhythmus/
// rhyToggle/rhyMove/rhyRemove/rhyAdd). Da training.js vor coach.js geladen wird, greift dort der
// Fallback-Guard (`typeof window.openRhythmus!=='function'`) nicht mehr; _trInit() bindet zusätzlich nach.
// Langes Drücken auf eine Rhythmus-Kachel (Pointer-Events; contextmenu als Fallback)
(function(){let t=null,x0=0,y0=0;
  document.addEventListener('pointerdown',e=>{const el=e.target&&e.target.closest&&e.target.closest('.rhy-tile');if(!el)return;x0=e.clientX;y0=e.clientY;clearTimeout(t);
    t=setTimeout(()=>{t=null;rhyToggle.skip=true;try{if(navigator.vibrate)navigator.vibrate(10);}catch(x){}rhyOptions(+el.dataset.i);},420);},{passive:true});
  const cancel=()=>{clearTimeout(t);t=null;};
  document.addEventListener('pointerup',()=>{setTimeout(()=>{rhyToggle.skip=false;},50);cancel();},{passive:true});
  document.addEventListener('pointercancel',cancel,{passive:true});
  document.addEventListener('pointermove',e=>{if(t&&(Math.abs(e.clientX-x0)>8||Math.abs(e.clientY-y0)>8))cancel();},{passive:true});})();

// ===== TECHNIK-LEXIKON =====
// Tippfehler der Server-Definitionen clientseitig glätten (Quelle: src/server.js DEFINITIONS / seed-data.json)
function _fixDef(s){return esc2(String(s||'')).replace(/Umkerpunkt/g,'Umkehrpunkt').replace(/ohne einer/g,'ohne eine').replace(/continous/g,'continuous').replace(/Tripple/g,'Triple').replace(/aufsVersagen/g,'aufs Versagen').replace(/\n/g,'<br>');}
// Anzeigename eines Lexikon-Eintrags: Zeilenumbrueche glaetten und die Tippfehler der Server-Quelle
// korrigieren. Der gespeicherte Wert bleibt der Originalbegriff, damit die Suche im Lexikon weiter greift.
function _defLabel(t){return String(t||'').replace(/\s+/g,' ').trim().replace(/Tripple/g,'Triple').replace(/Continous/gi,'Continuous');}
function _findDef(t){t=(t||'').toLowerCase().trim();if(!t)return null;
  return (DEFS||[]).find(d=>d.term.toLowerCase()===t)||(DEFS||[]).find(d=>d.term.toLowerCase().includes(t)||t.includes(d.term.toLowerCase()))||null;}
function explainTechnique(term){const hit=_findDef(term);
  if(hit)openSheet(_defLabel(hit.term),`<div class="body muted">${_fixDef(hit.def)}</div><button class="btn block mt-4" onclick="closeModal()">Verstanden</button>`);
  else openSheet(term||'Technik',`<div class="note mb-3">Für diese Technik gibt es noch keine Erklärung im Lexikon. Dein Coach hat sie als Hinweis gesetzt – frag im Zweifel direkt nach.</div><button class="btn block sec" onclick="openDefs()">Ganzes Lexikon ansehen</button>`);}
function openDefs(){openSheet('Technik-Lexikon',(DEFS||[]).length?DEFS.map(d=>`<div class="def"><div class="dt">${esc2(_defLabel(d.term))}</div><div class="dd">${_fixDef(d.def)}</div></div>`).join(''):emptyState({icon:'help',title:'Keine Einträge'}));}
// Erklärung der im Formular gewählten Technik (sonst das ganze Lexikon)
function pickTechnique(){if(!(DEFS||[]).length)return toast('Lexikon lädt noch…');
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
function openPlateCalc(w){const start=(+w>0)?Math.round(+w*2)/2:60;
  openSheet('Hantelrechner',`${infoBox('plate_intro','Gib dein Zielgewicht ein – die App zeigt dir, welche Scheiben pro Seite auf die Langhantel müssen (die Stange wiegt meist 20 kg).')}
  <div class="grid-2">
    <div class="field"><label>Zielgewicht (kg)</label><input id="pc_target" type="number" step="0.5" inputmode="decimal" min="0" max="1000" value="${start}" oninput="doPlate()"></div>
    <div class="field"><label>Stange (kg)</label><select id="pc_bar" onchange="doPlate()"><option value="20">20 (Standard)</option><option value="15">15 (Frauen)</option><option value="10">10 (kurz)</option><option value="0">ohne Stange</option></select></div>
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
// Zustand: restInt (Intervall, null = keine Pause), restLeft/restTotal (Sekunden), REST_SECS (Standardlänge,
// pro Gerät in localStorage 'be_rest'; Picker via Tipp auf die Zeit). Die Leiste hat zwei Zustände:
//  · läuft: Countdown · −15 · +15 · Abschließen (nur Symbol, damit −15/+15 immer Platz haben) · Fertig
//  · idle (Kraft-Tab, mindestens ein Satz heute): „Pause" (Tipp = Picker + Start) · Hantelrechner · Abschließen
// Solange die Leiste sichtbar ist, trägt body.rest-on (Seitenabstand unten, Toasts höher).
let restInt=null,restLeft=0,restTotal=0;
let REST_SECS=(()=>{try{const v=parseInt(localStorage.getItem('be_rest'));return [60,90,120,180].includes(v)?v:90;}catch(e){return 90;}})();
function startRest(seconds){restTotal=restLeft=(+seconds>0?+seconds:REST_SECS);
  clearInterval(restInt);restInt=setInterval(()=>{restLeft--;drawRest();if(restLeft<=0){clearInterval(restInt);restInt=null;restDone();}},1000);
  drawRest();trainBarSync();}
function drawRest(){const left=Math.max(0,restLeft);const m=Math.floor(left/60),s=left%60;
  const el=document.getElementById('restTime');if(el)el.textContent=m+':'+String(s).padStart(2,'0');
  const p=document.getElementById('restProg');if(p)p.style.width=(restTotal?Math.round(left/restTotal*1000)/10:0)+'%';}
function restAdd(s){if(restInt==null)return;restLeft=Math.max(0,restLeft+s);if(restLeft>restTotal)restTotal=restLeft;drawRest();}
function restStop(){clearInterval(restInt);restInt=null;trainBarSync();}
function restHide(){restStop();} // legacy-Name
function restDone(){clearInterval(restInt);restInt=null;
  // kurzes akustisches + haptisches Signal
  try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.value=0.1;o.start();
    setTimeout(()=>{o.stop();ctx.close();},250);}catch(e){}
  try{if(navigator.vibrate)navigator.vibrate(200);}catch(e){}
  toast('Pause vorbei – nächster Satz');trainBarSync();}
// Pausenlänge wählen (Tipp auf die Zeit): 60/90/120/180 s, gemerkt pro Gerät; im Idle-Zustand auch „Pause starten"
function restPick(){const opts=[60,90,120,180];const running=restInt!=null;
  openSheet('Pausenlänge',`<div class="note mb-3">${running?'Die laufende Pause startet mit der neuen Länge neu.':'Standardlänge für den Pausen-Timer nach jedem bestätigten Satz.'}</div>
    <div class="grid-4 mb-3">${opts.map(n=>`<button class="chip pick${n===REST_SECS?' on':''}" onclick="restSetDefault(${n})">${n} s</button>`).join('')}</div>
    ${running?'':`<button class="btn block" onclick="restStartNow()">${icon('timer',18)} Pause starten (${REST_SECS} s)</button>`}`);}
function restSetDefault(n){n=+n;REST_SECS=n;try{localStorage.setItem('be_rest',String(n));}catch(e){}
  if(restInt!=null){closeModal();startRest(n);}else restPick();}
function restStartNow(){closeModal();startRest(REST_SECS);}
// Leiste an den Zustand anpassen (wird von Timer, Fortschritt, Tab-Wechsel und View-Wechsel aufgerufen)
function trainBarSync(){const bar=document.getElementById('restBar');if(!bar)return;
  const running=restInt!=null;
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
  window.rhyToggle=rhyToggle;window.rhyMove=rhyMove;window.rhyRemove=rhyRemove;window.rhyAdd=rhyAdd;
  try{if(typeof TOUR_DEFS==='object'&&TOUR_DEFS&&TOUR_DEFS.workout)TOUR_DEFS.workout=[
    {sel:'#daysel',title:'Deine Trainingstage',body:'Wechsle hier zwischen deinen Trainingstagen. Der rote Chip ist für heute vorgeschlagen; hinter den drei Punkten bearbeitest du deinen Plan.',pos:'below'},
    {sel:'#trainProg',title:'Dein Fortschritt',body:'Hier siehst du, wie viele Sätze du heute schon geschafft hast. Pausen-Timer, Hantelrechner und „Abschließen" erscheinen unten in der Leiste, sobald du loslegst.',pos:'below'},
    {sel:'#exlist',title:'Übungen loggen',body:'Tippe eine Übung an, trag Gewicht und Wiederholungen ein und bestätige den Satz mit dem Haken. Der farbige Hinweis sagt dir, ob du steigern solltest.',pos:'above'}];}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',_trInit);else _trInit();
