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
      <div class="wcell"><input type="number" inputmode="decimal" min="0" max="1000" placeholder="kg"${sc} value="${wVal}" data-sugg="${sugg?1:0}" aria-label="Gewicht Satz ${s}" onfocus="clearSugg(this)" oncontextmenu="event.preventDefault();openPlateCalc(this.value)" onchange="logSet(${ex.id},${s},'weight',this.value)"><button class="pcbtn" type="button" aria-label="Hantelrechner für Satz ${s}" onclick="trOpenPlateFromRow(this)">${icon('dumbbell',16)}</button><div class="prev">${ps?'zuletzt '+_fmtW(ps.weight)+' kg':'–'}</div></div>
      <div><input type="number" inputmode="numeric" min="0" max="1000" placeholder="–"${sc} value="${rVal}" data-sugg="${sugg?1:0}" aria-label="Wiederholungen Satz ${s}" onfocus="clearSugg(this)" onchange="logSet(${ex.id},${s},'reps',this.value,true)"><div class="prev">${ps?'× '+ps.reps:''}</div></div>
      <button class="ok" type="button" aria-label="Satz ${s} bestätigen" onclick="commitSet(${ex.id},${s})">${icon('check',22)}</button>
    </div>`;}).join('');
  // Aufklapper: der Kopf ist der Knopf, der Satzblock das Ziel. aria-expanded/aria-controls sagen einem
  // Screenreader, dass hier etwas auf- und zugeht und was davon betroffen ist (A-II.6). Den Zustand
  // haelt semExAria synchron – sowohl beim Tippen (toggleEx) als auch beim Neuzeichnen (renderEx).
  return `<div class="ex" id="ex-${ex.id}" data-id="${ex.id}">
    <div class="ex-head" role="button" tabindex="0" aria-expanded="false" aria-controls="exb-${ex.id}" onclick="toggleEx(${ex.id})">
      <div class="ex-idx" data-n="${i+1}">${i+1}</div>
      <div class="ex-main"><div class="nm">${ex.coach_locked&&!coachView()?icon('lock',14,'lock'):''}${esc2(ex.name)}</div><div class="mg">${meta}</div></div>
      <span class="ex-cnt caption hidden"></span>
      <button class="btn icon sm ghost ex-more" type="button" aria-label="Optionen zu ${esc2(ex.name)}" onclick="event.stopPropagation();exMenu(${ex.id})">${icon('more',20)}</button>
      <div class="ex-chev">${icon('chevronRight',18)}</div>
    </div>
    <div class="ex-body" id="exb-${ex.id}"><div class="ex-inner">
      ${recIcon&&rec.text?`<div class="rec ${rec.type}"><span class="ric">${icon(recIcon,18)}</span><span>${esc2(rec.text)}</span></div>`:''}
      <div class="setgrid"><div class="hd">Satz</div><div class="hd">Gewicht</div><div class="hd">Reps</div><div class="hd" aria-hidden="true"></div></div>
      ${rows}
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
  if(cv){el.innerHTML=`<div class="rows plan-rows">${day.exercises.map((ex,i)=>_exRowCoach(ex,i)).join('')}</div>`;trainBarSync();return;}
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
  el.innerHTML=`<div id="trReady">${rc?trainReadyHTML(rc.data):''}</div>`+banner+day.exercises.map((ex,i)=>_exCard(ex,i,progs[ex.id],logs)).join('');
  if(!rc||(!rc.data&&Date.now()-rc.at>6e4))_trReadiness(rk);
  if(openId){const c=document.getElementById('ex-'+openId);if(c){c.classList.add('open');semExAria(c);}}
  updateTrainProgress();
  // Von der Home gestartet: erste Übung mit offenen Sätzen aufklappen und hinscrollen
  if(renderWorkout.start){renderWorkout.start=false;const first=[...el.querySelectorAll('.ex')].find(c=>!c.classList.contains('done'));
    if(first)setTimeout(()=>toggleEx(+first.dataset.id),80);}}
// aria-expanded des Kartenkopfs dem Klassenzustand nachziehen. Ein Screenreader liest sonst dauerhaft
// „eingeklappt", egal wie die Karte gerade steht (A-II.6). Nur ein Attribut – keine Logik.
function semExAria(card){if(!card)return;const h=card.querySelector('.ex-head');
  if(h)h.setAttribute('aria-expanded',card.classList.contains('open')?'true':'false');}
function toggleEx(id){const el=document.getElementById('ex-'+id);if(!el)return;const wasOpen=el.classList.contains('open');
  document.querySelectorAll('.ex.open').forEach(x=>{if(x!==el){x.classList.remove('open');semExAria(x);}});
  el.classList.toggle('open',!wasOpen);semExAria(el);
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
  const pill=` <span class="pill amber pr">${icon('trophy',12)} ${_fmtW(w)} kg</span>`;
  EX_META[exId]=meta.replace(/ · Best [^<]*$/,'').replace(/ <span class="pill amber pr">.*?<\/span>$/,'')+pill;
  const card=document.getElementById('ex-'+exId);if(card)_paintCard(card);}
function _afterCommit(exId,setNo){
  // Der Tipp auf ✓ ist die Nutzergeste, auf die iOS für den Ton wartet – und der Moment, ab dem der
  // Bildschirm wach bleiben soll. Beides ist idempotent und kostet ab dem zweiten Satz nichts.
  trAudioUnlock();trWakeLock.want=1;trWakeLock();
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
  // Kennzahlen (Bestleistung, „seit Beginn", Einheiten) rechnen über ALLE Einheiten – die Kurve zeichnet nur
  // die letzten 52: nach drei Jahren hätte sie sonst 157 Einheiten × 2 Punkte auf 340 Einheiten Breite,
  // rund zwei Pixel je Punkt, und nichts mehr wäre abzulesen. Der Kartenkopf sagt, wenn gekürzt wurde.
  const EX_CHART_MAX=52;
  const tops=rows.map(x=>x.top);const best=Math.max(...tops);const diff=Math.round((rows[rows.length-1].top-rows[0].top)*10)/10;
  const shown=rows.length>EX_CHART_MAX?rows.slice(-EX_CHART_MAX):rows;
  const A1=_axis5(shown.map(x=>x.top),0.5),A2=_axis5(shown.map(x=>x.reps),1); // beide Achsen mit 5 Linien -> rechts bleiben Reps ganzzahlig
  const data=shown.map(d=>({date:d.date,v1:d.top,v2:d.reps}));
  openSheet(name,`<div class="grid-3 hist-stats mb-3">
      <div class="tile"><div class="v">${_fmtW(best)}<em> kg</em></div><div class="l">Bestleistung</div></div>
      <div class="tile"><div class="v${diff>0?' tone-green':diff<0?' tone-red':''}">${diff>0?'+':''}${_fmtW(diff)}<em> kg</em></div><div class="l">seit Beginn</div></div>
      <div class="tile"><div class="v">${rows.length}</div><div class="l">Einheiten</div></div></div>
    <div class="chart-card"><div class="ch-h"><div class="t">Top-Gewicht und Reps</div><div class="v">${shown.length<rows.length?'letzte '+fmtNum(shown.length)+' Einheiten':'kg · Wiederholungen'}</div></div>${lineChart2(data,'Gewicht','kg','Reps','',{domain1:A1.domain,step1:A1.step,tickFmt1:_fmtW,domain2:A2.domain,step2:A2.step,tickFmt2:v=>fmtNum(Math.round(v))})}</div>${list}`);}

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
      <span class="d">${day}</span><span class="n">${isTrain?esc2(dayAbbr(e.dayName||'Training')):isSick?'K':e?'–':''}</span>${e?.planned?'<i class="dot"></i>':''}</button>`;}
  openSheet('Kalender',`
    <div class="cal-head"><button class="btn icon sm" aria-label="Voriger Monat" onclick="calNav(-1)">${icon('chevronLeft',20)}</button><div class="h3">${esc2(monthName)}</div><button class="btn icon sm" aria-label="Nächster Monat" onclick="calNav(1)">${icon('chevronRight',20)}</button></div>
    <div class="cal-wd">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>`<span>${w}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-legend"><span><i class="sw train"></i>Training</span><span><i class="sw rest"></i>Ruhetag</span><span><i class="sw sick"></i>Krank</span><span><i class="sw dot"></i>geplant</span></div>
    ${_cycleRow()}
    <div class="note mt-3">Tippe auf einen Tag, um ihn zu planen – z.B. einen Ruhetag, wenn du unterwegs bist. Dein Rhythmus rechnet automatisch weiter.</div>`);}
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
    if(d)return dayAbbr(d);const n=rot.length?rot[(k++)%rot.length]:null;return n?dayAbbr(n):'Training';}).join(' · ');}
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
    ${e?.planned?`<button class="btn block ghost mt-3" onclick="clearCalDay('${iso}')">Planung entfernen (automatisch)</button>`:''}`);}
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
    if(d)return{label:d,short:dayAbbr(d),train:true,fixed:true};
    const n=rot.length?rot[(k++)%rot.length]:null;
    return{label:n?n+' (automatisch)':'Training',short:n?dayAbbr(n):'T',train:true,fixed:false};});}
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
  const opt=(sel,label,sub,act)=>`<button class="rhy-opt${sel?' on':''}" type="button" onclick="${act}"><span class="l">${esc2(label)}</span>${sub?`<span class="s">${esc2(sub)}</span>`:''}${sel?icon('check',18):''}</button>`;
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
      list.push(['Je 2 Trainings, dann 1 Ruhetag',p,p.map(x=>rhyDay(x)?dayAbbr(rhyDay(x)):'Ruhe').join(' · ')]);}
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
// Der Hantelrechner war bis 2.4.0 aus der Satzzeile nur über das Kontextmenü des Gewichtsfeldes zu
// erreichen (Rechtsklick/Longpress) – und iOS Safari feuert `contextmenu` auf Eingabefeldern nicht.
// Der Knopf in der Leiste erscheint erst nach dem ersten Satz, also war der Rechner auf dem iPhone
// genau dann unerreichbar, wenn man ihn braucht: vor dem ersten Satz (RATE-25-training M6).
// Das Scheiben-Symbol in der Gewichtszelle öffnet ihn mit dem Wert genau dieser Zeile; das
// Kontextmenü bleibt zusätzlich bestehen (Desktop, Android).
function trOpenPlateFromRow(btn){const inp=btn&&btn.parentElement?btn.parentElement.querySelector('input'):null;
  if(inp)curRowWeight.last=inp; // damit die Leiste danach dieselbe Zeile meint
  openPlateCalc(inp&&+inp.value>0?inp.value:curRowWeight());}
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
