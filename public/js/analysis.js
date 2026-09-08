// BE INEVITABLE – Frontend, Teil «analysis.js» (WP5 Analyse). Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js. Nutzt die WP0-Helfer (icon, ring, metricChart/lineChart/
// lineChart2, openSheet, confirmSheet, toast, skeleton, emptyState, showFieldErr, fmtNum/fmtDate/pl, coachView).
// Fremde Funktionen aus parallelen Paketen (openCheckinSheet, weightVerdict, invalidateView, openExHistory …) werden
// defensiv aufgerufen (typeof-Check + Fallback), damit vor der Integration nichts bricht.
// ===== ANALYSE: Körper + Training =====

// --- Daten-Cache pro betrachtetem Nutzer (~60 s): synchron malen, im Hintergrund auffrischen ---
const ANA_TTL=60000;
function anaCache(){const c=renderTracker.cache;if(!c||c.uid!==VIEW_USER)renderTracker.cache={uid:VIEW_USER};return renderTracker.cache;}
function anaCached(key){const e=anaCache()[key];return e?e.data:null;}
function anaEntry(key){return anaCache()[key]||null;}
function anaStore(key,data){anaCache()[key]={data,ts:Date.now()};return data;}
// anaInvalidate(key?) – markiert als veraltet (Daten bleiben für den sofortigen Anstrich erhalten) + leert den View-Cache des Tabs
function anaInvalidate(key){const c=renderTracker.cache;
  if(c){if(key){if(c[key])c[key].ts=0;}else Object.keys(c).forEach(k=>{if(c[k]&&typeof c[k]==='object')c[k].ts=0;});}
  if(typeof invalidateView==='function')try{invalidateView('tracker');}catch(e){}}
async function anaFetch(key,path,pick){const r=await API.get(path);if(r.status!==200)return anaCached(key);return anaStore(key,pick?pick(r.data):r.data);}
function anaStale(key,o){const e=anaEntry(key);if(!e)return true;const age=Date.now()-e.ts;
  if(o&&o.refresh)return true;if(age>=ANA_TTL)return true;if(o&&o.entry&&age>5000)return true;return false;}
// Sichtbarer Bereich im Hintergrund auffrischen (nur neu malen, wenn sich Daten geändert haben)
function anaRefreshIfVisible(){if(!document.getElementById('anaBody'))return;
  if(renderTracker.tab==='training')drawAnaTraining({refresh:true});else drawAnaKoerper({refresh:true});}
// Nach dem Schließen des nächsten Sheets etwas ausführen (z. B. nach dem Check-in-Formular aus home.js)
function anaAfterSheet(fn){const m=document.getElementById('modal');if(!m||typeof fn!=='function')return;
  const start=()=>{const ob=new MutationObserver(()=>{if(!m.classList.contains('on')){ob.disconnect();try{fn();}catch(e){console.error('[analysis]',e);}}});
    ob.observe(m,{attributes:true,attributeFilter:['class']});setTimeout(()=>ob.disconnect(),10*60*1000);};
  let tries=0;const t=setInterval(()=>{tries++;if(m.classList.contains('on')){clearInterval(t);start();}else if(tries>20)clearInterval(t);},100);}
// Datums-Helfer (lokale Tage, Montag = Wochenstart – gleiche Woche wie mondayOf() im Server)
function anaAddDays(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return fmt(d);}
function anaMonday(iso){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return fmt(d);}
function anaDayDiff(a,b){return Math.round((Date.parse(a+'T00:00:00')-Date.parse(b+'T00:00:00'))/864e5);}
function anaToneCls(t){return {green:'tone-green',amber:'tone-amber',red:'tone-red',blue:'tone-blue',ok:'tone-green',warn:'tone-amber'}[t]||'muted';}
// Ziele des betrachteten Nutzers (individuell, sonst Standard)
function anaGoals(){const p=(VIEW_USER===ME.id)?ME:(VIEW_USER_PROFILE||ME||{});
  return {sleep:+p.sleep_goal||8,steps:+p.steps_goal||10000,water:+p.water_goal||3,goal:p.goal||ME.goal||'health',start:+p.start_weight||null,days:+p.days_per_week||3};}

// --- Tab-Einstieg: Segmente Körper / Training (Titel trägt der Header) ---
function renderTracker(v,opts){opts=opts||{};if(typeof opts==='string')opts={tab:opts};
  if(opts.tab)renderTracker.tab=opts.tab;
  const t=renderTracker.tab==='training'?'training':'koerper';
  // go() hat den View-Cache bereits gemalt -> DOM behalten, nur Daten auffrischen (kein Flackern)
  const reuse=!!(opts.cached&&v.querySelector('#anaBody')&&v.querySelector('#anaSeg')&&v.querySelector(t==='training'?'#an_t.on':'#an_k.on'));
  if(!reuse)v.innerHTML=`<div class="page on${opts.cached?'':' first'}">
    <div class="seg" id="anaSeg" data-tour="anaSeg">
      <button id="an_k" onclick="anaTab('koerper')">Körper</button>
      <button id="an_t" onclick="anaTab('training')">Training</button>
    </div>
    <div id="anaBody" data-tour="trackerBody"></div></div>`;
  anaTab(t,{entry:true,keep:reuse});
  if(typeof maybeStartTabTour==='function')try{maybeStartTabTour('tracker',{deferred:true});}catch(e){}}
function anaTab(t,o){t=(t==='training')?'training':'koerper';renderTracker.tab=t;
  const k=document.getElementById('an_k'),tr=document.getElementById('an_t');if(!k||!tr)return;
  k.classList.toggle('on',t==='koerper');tr.classList.toggle('on',t==='training');
  if(t==='training')drawAnaTraining(o);else drawAnaKoerper(o);}

// Ohne Athleten-Kontext (Coach kommt über go('athletes') hierher, VIEW_USER=null) ehrlich bleiben:
// nicht „Verbindung prüfen" zeigen, sondern den fehlenden Athleten benennen.
function anaNoAthleteHTML(){return emptyState({icon:'users',title:'Kein Athlet ausgewählt',
  text:'Wähle zuerst einen Athleten aus, um seine Entwicklung zu sehen.',
  btn:{label:'Zu den Athleten',onclick:"go('athletes')"}});}

// ===== KÖRPER-SEGMENT: Status-Story + Kacheln + Diagramme + Maße/Fotos + Historie + Health =====
async function drawAnaKoerper(o){o=o||{};const box=document.getElementById('anaBody');if(!box)return;
  if(!VIEW_USER)return void(box.innerHTML=anaNoAthleteHTML());
  const have=anaEntry('checkins');
  if(have)anaPaintKoerper(have.data);
  else if(!o.keep||!box.children.length)box.innerHTML=`<div class="skeleton lg"></div><div class="tiles mt-3"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>${skeleton(2,'lg')}`;
  if(have&&!anaStale('checkins',o))return;
  const before=have?JSON.stringify(have.data):null;
  const data=await anaFetch('checkins','/checkins/'+VIEW_USER,d=>d.checkins||[]);
  if(!document.getElementById('anaBody')||renderTracker.tab!=='koerper')return;
  if(data==null){if(!have)box.innerHTML=emptyState({icon:'alertTriangle',title:'Daten konnten nicht geladen werden',text:'Prüfe deine Verbindung und versuch es noch einmal.',btn:{label:'Erneut versuchen',onclick:"drawAnaKoerper({refresh:true})"}});return;}
  if(before!==JSON.stringify(data))anaPaintKoerper(data);}

function anaPaintKoerper(checkins){const box=document.getElementById('anaBody');if(!box)return;
  checkins=(checkins||[]).slice().sort((a,b)=>a.date<b.date?1:-1); // neueste zuerst
  const g=anaGoals(),tdy=today(),canEdit=!coachView();
  let h='';
  if(!checkins.length){
    h+=emptyState({icon:'scale',title:'Noch keine Check-ins',text:'Gewicht, Schlaf, Schritte und Wasser – ab dem ersten Eintrag entsteht hier deine Kurve.',btn:canEdit?{label:'Check-in eintragen',onclick:"anaOpenCheckin('"+tdy+"')"}:null});
    if(canEdit)h+=`<div class="center mb-4"><button class="btn sm sec" onclick="openIntegrations()">${icon('apple',14)} Gesundheitsdaten importieren</button></div>`;
    h+=anaPhysHTML();box.innerHTML=h;anaTourTarget();return;}
  const ws=checkins.filter(c=>c.weight>0);
  const avgOf=(key,n)=>{const xs=checkins.filter(c=>c[key]!=null&&+c[key]>0).slice(0,n||7);return xs.length?xs.reduce((a,c)=>a+ +c[key],0)/xs.length:null;};
  const avg={aSleep:avgOf('sleep'),aSteps:avgOf('steps'),aWater:avgOf('water')};
  const tr=anaWeekTrend(ws);
  h+=anaHeroHTML(checkins,ws,g,avg,tr,canEdit);
  // Kacheln: antippbar -> springen zum Diagramm; Trend-Slot erklärt das Ziel
  const tile=(label,val,unit,t,chartId)=>`<button class="tile tap" onclick="anaScrollTo('${chartId}')" aria-label="${label} – zum Diagramm"><div class="v">${val}${unit?`<em> ${unit}</em>`:''}</div><div class="l">${label}</div><div class="trend ${t.cls}">${t.html}</div></button>`;
  const goalTrend=(v,goal,unit,d)=>v==null?{cls:'',html:'<span class="muted-2">noch keine Werte</span>'}:v>=goal?{cls:'up',html:icon('check',14)+' Ziel erreicht'}:{cls:'amber',html:`Ziel ${fmtNum(goal,d)}${unit?' '+unit:''} · −${fmtNum(goal-v,d)}${unit?' '+unit:''}`};
  let wT={cls:'',html:'<span class="muted-2">Trend ab 2 Einträgen</span>'};
  if(tr){const v=Math.round(tr.perWeek*10)/10;wT={cls:anaTrendCls(v,g.goal,true),html:`${icon(v>0.05?'trendUp':v<-0.05?'trendDown':'trendFlat',14)} ${v>0?'+':''}${fmtNum(v,1)} kg/Woche`};}
  h+=`<div class="tiles" id="anaTiles">
    ${tile('Gewicht',ws[0]?fmtNum(ws[0].weight,1):'–',ws[0]?'kg':'',wT,'chart-weight')}
    ${tile('Ø Schlaf',avg.aSleep!=null?fmtNum(avg.aSleep,1):'–',avg.aSleep!=null?'h':'',goalTrend(avg.aSleep,g.sleep,'h',1),'chart-sleep')}
    ${tile('Ø Schritte',avg.aSteps!=null?fmtNum(Math.round(avg.aSteps)):'–','',goalTrend(avg.aSteps,g.steps,'',0),'chart-steps')}
    ${tile('Ø Wasser',avg.aWater!=null?fmtNum(avg.aWater,1):'–',avg.aWater!=null?'L':'',goalTrend(avg.aWater,g.water,'L',1),'chart-water')}
  </div>`;
  if(checkins.length<2)h+=`<div class="note mb-4">Mehr Auswertungen erscheinen, sobald du ein paar Tage Check-ins gemacht hast.</div>`;
  // Diagramme (WP0-Engine: schöne Ticks, Ziel-Label links, 7-Tage-Schnitt)
  const card=(id,title,v,svg,extra)=>`<div class="chart-card" id="${id}"><div class="ch-h"><div class="t">${title}</div><div class="v">${v}</div></div>${svg}${extra||''}</div>`;
  const series=(key,n)=>checkins.filter(c=>c[key]!=null&&+c[key]>0).slice(0,n||30).reverse().map(c=>({date:c.date,value:+c[key]}));
  const wRows=ws.slice(0,90).reverse().map(c=>({date:c.date,value:+c.weight}));
  if(wRows.length>=2){const total=Math.round((wRows[wRows.length-1].value-wRows[0].value)*10)/10;
    h+=card('chart-weight','Gewicht',`${total>0?'+':''}${fmtNum(total,1)} kg seit ${fmtDate(wRows[0].date)}`,metricChart(wRows,'kg'));}
  let legend=false;const leg=()=>legend?'':(legend=true,`<div class="caption mt-2">Dicke Linie = 7-Tage-Schnitt · dünne Linie = Tageswerte · gestrichelt = Ziel</div>`);
  const sl=series('sleep');if(sl.length>=2)h+=card('chart-sleep','Schlaf',`Ø ${fmtNum(avg.aSleep,1)} h · Ziel ${fmtNum(g.sleep,1)} h`,metricChart(sl,'h',g.sleep,'Ziel '+fmtNum(g.sleep,1)+' h',{avg:7}),leg());
  const st=series('steps');if(st.length>=2)h+=card('chart-steps','Schritte',`Ø ${fmtNum(Math.round(avg.aSteps))}/Tag · Ziel ${fmtNum(g.steps)}`,metricChart(st,'',g.steps,'Ziel '+fmtNum(g.steps),{avg:7}),leg());
  const wa=series('water');if(wa.length>=2)h+=card('chart-water','Wasser',`Ø ${fmtNum(avg.aWater,1)} L/Tag · Ziel ${fmtNum(g.water,1)} L`,metricChart(wa,'L',g.water,'Ziel '+fmtNum(g.water,1)+' L',{avg:7}),leg());
  h+=anaPhysHTML();
  h+=`<div class="section-label">Check-in Historie${canEdit?`<span class="sl-r"><button class="btn sm sec" onclick="anaOpenCheckin()">${icon('plus',14)} Nachtragen</button></span>`:''}</div><div id="histlist" class="ana-hist"></div>`;
  if(canEdit)h+=`<button class="btn sec mt-4" onclick="openIntegrations()">${icon('apple',18)} Gesundheitsdaten verbinden</button>`;
  box.innerHTML=h;loadHist(checkins);anaTourTarget();}

// Gewichtstrend: 7-Tage-Schnitt vs. die 7 Tage davor (sonst Spanne erster/letzter Eintrag auf eine Woche umgerechnet)
function anaWeekTrend(ws){if(!ws||ws.length<2)return null;const t=today();
  const A=ws.filter(c=>anaDayDiff(t,c.date)<=6),B=ws.filter(c=>{const d=anaDayDiff(t,c.date);return d>=7&&d<=13;});
  const mean=xs=>xs.reduce((s,c)=>s+ +c.weight,0)/xs.length;
  if(A.length&&B.length)return {perWeek:mean(A)-mean(B),kind:'avg'};
  const days=Math.max(1,anaDayDiff(ws[0].date,ws[ws.length-1].date));
  return {perWeek:(ws[0].weight-ws[ws.length-1].weight)/Math.max(1,days/7),kind:'span',days};}
// Trend-Farbe hängt vom Ziel ab: Aufbau = plus ist gut, Definition = minus ist gut
function anaTrendCls(v,goal,tile){const g=tile?'up':'tone-green',a=tile?'amber':'tone-amber';
  if(Math.abs(v)<=0.05)return '';if(goal==='muscle')return v>0?g:a;if(goal==='fatloss')return v<0?g:a;return '';}
// weightVerdict(diff,goal) -> {text,tone}: Home-Funktion (WP1) wenn vorhanden, sonst gleiche Logik lokal
function anaWeightVerdict(diff,goal){
  if(typeof weightVerdict==='function'){try{const v=weightVerdict(diff,goal);if(v&&v.text)return v;}catch(e){}}
  diff=Math.round((+diff||0)*10)/10;const s=(diff>0?'+':'')+fmtNum(diff,1)+' kg';
  if(goal==='muscle'){if(diff>0)return {text:s+' aufgebaut',tone:'green'};if(diff<0)return {text:s+' – Richtung beobachten',tone:'amber'};return {text:'Noch keine Veränderung',tone:'muted'};}
  if(goal==='fatloss'){if(diff<0)return {text:fmtNum(Math.abs(diff),1)+' kg verloren',tone:'green'};if(diff>0)return {text:s+' – Richtung beobachten',tone:'amber'};return {text:'Noch keine Veränderung',tone:'muted'};}
  return {text:s+' seit Start',tone:'muted'};}
// „Nächster Schritt": das Ziel, das relativ am weitesten entfernt ist
function anaNextStep(avg,g){const c=[];
  if(avg.aSleep!=null)c.push({k:'Schlaf',rel:(g.sleep-avg.aSleep)/g.sleep,txt:`Schlaf: noch ${fmtNum(g.sleep-avg.aSleep,1)} h bis zum Ziel (${fmtNum(g.sleep,1)} h)`});
  if(avg.aSteps!=null)c.push({k:'Schritte',rel:(g.steps-avg.aSteps)/g.steps,txt:`Schritte: noch ${fmtNum(Math.round(g.steps-avg.aSteps))} bis zum Ziel (${fmtNum(g.steps)})`});
  if(avg.aWater!=null)c.push({k:'Wasser',rel:(g.water-avg.aWater)/g.water,txt:`Wasser: noch ${fmtNum(g.water-avg.aWater,1)} L bis zum Ziel (${fmtNum(g.water,1)} L)`});
  if(!c.length)return 'Trag Schlaf, Schritte und Wasser ein – dann siehst du hier, was am weitesten vom Ziel entfernt ist.';
  const worst=c.filter(x=>x.rel>0.01).sort((a,b)=>b.rel-a.rel)[0];
  if(worst)return worst.txt;
  return (c.length>1?'Ziele erreicht: ':'Ziel erreicht: ')+c.map(x=>x.k).join(', ')+' – weiter so.';}
function anaHeroHTML(checkins,ws,g,avg,tr,canEdit){const lw=ws[0];const tdy=today();
  const hasToday=checkins.some(c=>c.date===tdy);
  let trendHtml='<span class="muted-2">Trend ab dem zweiten Gewichtseintrag</span>';
  if(tr){const v=Math.round(tr.perWeek*10)/10;const ic=v>0.05?'trendUp':v<-0.05?'trendDown':'trendFlat';
    trendHtml=`<span class="ana-trend ${anaTrendCls(v,g.goal)}">${icon(ic,16)} ${v>0?'+':''}${fmtNum(v,1)} kg/Woche</span><span class="muted-2"> · ${tr.kind==='avg'?'7-Tage-Schnitt vs. Vorwoche':'seit '+fmtDate(ws[ws.length-1].date)}</span>`;}
  let verdictHtml='';
  if(g.start&&lw){const v=anaWeightVerdict(Math.round((lw.weight-g.start)*10)/10,g.goal);verdictHtml=`<div class="ana-verdict ${anaToneCls(v.tone)}">${esc2(v.text)} <span class="muted-2 caption">(Start ${fmtNum(g.start,1)} kg)</span></div>`;}
  return `<div class="card lg ana-hero" id="anaHero">
    <div class="between"><div class="eyebrow">${lw?'Gewicht · '+fmtDate(lw.date,{weekday:'short'}):'Körper'}</div>${(!hasToday&&canEdit)?`<button class="btn sm sec" onclick="anaOpenCheckin('${tdy}')">${icon('plus',14)} Heute eintragen</button>`:''}</div>
    <div class="ana-big">${lw?`<span class="num-xl">${fmtNum(lw.weight,1)}</span><em>kg</em>`:`<span class="num-xl">–</span><em>kein Gewicht eingetragen</em>`}</div>
    <div class="body mt-1">${trendHtml}</div>${verdictHtml}
    <div class="ana-next mt-3">${icon('target',16)}<div><b>Nächster Schritt</b><br>${anaNextStep(avg,g)}</div></div></div>`;}
function anaPhysHTML(){let h=`<div class="section-label">Maße &amp; Fotos</div>`;
  if(isBeginner()&&!coachView())h+=infoBox('koerper_beginner','Für den Anfang reicht dein Gewicht. Wenn du weiter bist, kannst du hier auch Körpermaße und Fortschrittsfotos festhalten – beides hilft deinem Coach.');
  h+=`<div class="quick mb-4">
      <button class="qcard" onclick="openMeasure()">${icon('ruler',24)}<div class="t">Körpermaße</div><div class="d">Taille, Arm, Brust …</div></button>
      <button class="qcard" onclick="openPhotos()">${icon('camera',24)}<div class="t">Fortschrittsfotos</div><div class="d">Physik vergleichen</div></button>
    </div>`;return h;}
// Zum Diagramm springen: weich, wenn der Browser das kann – sonst (oder bei reduzierter Bewegung) direkt.
function anaScrollTo(id){const el=document.getElementById(id);
  if(!el){toast('Ab 2 Einträgen erscheint hier das Diagramm');return;}
  const soft=!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  try{el.scrollIntoView({behavior:soft?'smooth':'auto',block:'start'});}catch(e){el.scrollIntoView();}
  if(soft)setTimeout(()=>{const r=el.getBoundingClientRect();if(r.top<-4||r.top>innerHeight*0.6)el.scrollIntoView({block:'start'});},600);
  el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}

// --- Check-in Historie: letzte 7 Zeilen, antippbar (Bearbeiten/Nachtragen), „Alle anzeigen" ---
async function loadHist(checkins){const el=document.getElementById('histlist');if(!el)return;
  let h=checkins||anaCached('checkins');
  if(!h){el.innerHTML=skeleton(2,'sm');h=(await anaFetch('checkins','/checkins/'+VIEW_USER,d=>d.checkins||[]))||[];if(!document.getElementById('histlist'))return;}
  h=h.slice().sort((a,b)=>a.date<b.date?1:-1);
  if(!h.length){el.innerHTML=emptyState({icon:'calendar',title:'Noch keine Einträge',text:'Dein erster Check-in erscheint hier.'});return;}
  const all=!!loadHist.all;const list=all?h:h.slice(0,7);
  el.innerHTML=`<div class="rows">${list.map(anaHistRow).join('')}</div>`+
    (h.length>7?`<button class="btn sm sec mt-3" onclick="loadHist.all=!loadHist.all;loadHist()">${all?'Weniger anzeigen':'Alle anzeigen ('+h.length+')'}</button>`:'');}
// Zeile: links Datum + die Nebenwerte klein darunter, rechts das Gewicht (bleibt einzeilig, auch auf schmalen Geräten)
function anaHistRow(c){const parts=[];
  if(c.sleep!=null)parts.push(fmtNum(c.sleep,1)+' h Schlaf');
  if(c.steps!=null)parts.push(fmtNum(Math.round(c.steps))+' Schritte');
  if(c.water!=null)parts.push(fmtNum(c.water,1)+' L');
  const tap=!coachView();
  return `<div class="row${tap?' tap':''}"${tap?` onclick="anaOpenCheckin('${c.date}')"`:''}><div class="rl">${fmtDate(c.date,{weekday:'short'})}<small>${parts.join(' · ')||'nur Gewicht'}</small>${c.coach_notes?`<small class="tone-red">Coach: ${esc2(c.coach_notes)}</small>`:''}</div><div class="rr">${c.weight!=null?fmtNum(c.weight,1)+' kg':'–'}</div></div>`;}
// Erster Tag der letzten 7 ohne Check-in (für „Nachtragen"), sonst heute
function anaMissingDate(){const cis=anaCached('checkins')||[];const tdy=today();
  for(let i=0;i<7;i++){const iso=anaAddDays(tdy,-i);if(!cis.some(c=>c.date===iso))return iso;}return tdy;}
// Check-in für ein Datum: Formular aus home.js (WP1) wenn vorhanden, sonst eigenes Sheet
function anaOpenCheckin(date){date=date||anaMissingDate();
  if(typeof openCheckinSheet==='function'){try{openCheckinSheet(date);anaAfterSheet(anaRefreshIfVisible);return;}catch(e){console.error('[analysis] openCheckinSheet',e);}}
  anaCheckinSheet(date);}
function anaCheckinSheet(date){const cis=anaCached('checkins')||[];const tdy=today();date=date||tdy;
  const ci=cis.find(c=>c.date===date)||{};const last=cis.slice().sort((a,b)=>a.date<b.date?1:-1)[0]||{};const past=date!==tdy;
  let chips='<div class="chip-row mb-3">';
  for(let i=0;i<7;i++){const iso=anaAddDays(tdy,-i);const has=cis.some(c=>c.date===iso);const lbl=i===0?'Heute':i===1?'Gestern':fmtDate(iso,{weekday:'short'});
    chips+=`<button class="chip${iso===date?' on':''}" onclick="anaCheckinSheet('${iso}')">${has?icon('check',14)+' ':''}${lbl}</button>`;}
  chips+='</div>';
  const v=k=>ci[k]!=null?ci[k]:'';
  const f=(id,lbl,step,ph,max)=>`<div class="field"><label for="${id}">${lbl}</label><input id="${id}" type="number"${step?` step="${step}"`:''} inputmode="${step?'decimal':'numeric'}" min="0" max="${max}" value="${v(id.slice(3))}" placeholder="${ph}"></div>`;
  openSheet('Check-in',`<div class="meta mb-2">${fmtDate(date,{weekday:'long',month:'long'})}${ci.date?' · schon eingetragen, Werte werden überschrieben':''}</div>${chips}
    <div class="grid-2" id="ac_form">
      ${f('ac_weight','Gewicht (kg)','0.1',last.weight!=null?fmtNum(last.weight,1):'63,5',500)}
      ${f('ac_sleep','Schlaf (h)','0.5',last.sleep!=null?fmtNum(last.sleep,1):'8',24)}
      ${f('ac_steps','Schritte','',last.steps!=null?fmtNum(last.steps):'8.000',200000)}
      ${f('ac_water','Wasser (L)','0.1',last.water!=null?fmtNum(last.water,1):'3',30)}
    </div>
    <button class="btn block" onclick="anaSaveCheckin('${date}')">${past?'Nachtragen':'Check-in speichern'}</button>
    <div class="caption center mt-2">Leer lassen ist okay.</div>`);}
async function anaSaveCheckin(date){const w=num('ac_weight'),sl=num('ac_sleep'),st=num('ac_steps'),wa=num('ac_water');
  if(w==null&&sl==null&&st==null&&wa==null)return showFieldErr('ac_form','Bitte mindestens einen Wert eingeben','ac_weight');
  const body={user_id:VIEW_USER,date};if(w!=null)body.weight=w;if(sl!=null)body.sleep=sl;if(st!=null)body.steps=st;if(wa!=null)body.water=wa;
  const r=await API.post('/checkins',body);if(r.status!==200)return toast(r.data?.error||'Fehler – nicht gespeichert');
  closeModal();toast(r.data?.jokerRefunded?'Nachgetragen – Joker zurückerstattet ✓':(date===today()?'Check-in gespeichert ✓':'Nachgetragen ✓'));
  anaInvalidate('checkins');anaInvalidate('insights');if(typeof invalidateView==='function')try{invalidateView('home');}catch(e){}
  refreshAchievements();anaRefreshIfVisible();}

// ===== TRAINING-SEGMENT: Diese Woche + Ziele & Erfolge + Wochen-Volumen + Übungen + Muskelgruppen =====
async function drawAnaTraining(o){o=o||{};const b=document.getElementById('anaBody');if(!b)return;
  if(!VIEW_USER)return void(b.innerHTML=anaNoAthleteHTML());
  const keys=['analytics','insights','monthly','cardio'];
  const have=anaEntry('analytics');
  if(have)anaPaintTraining();
  else if(!o.keep||!b.children.length)b.innerHTML=`<div class="tiles"><div class="skeleton"></div><div class="skeleton"></div></div>${skeleton(3)}`;
  if(have&&!keys.some(k=>anaStale(k,o)))return;
  const before=JSON.stringify(keys.map(anaCached));
  const [a,ins,mg]=await Promise.all([
    anaFetch('analytics','/analytics/'+VIEW_USER),
    anaFetch('insights','/insights/'+VIEW_USER),
    anaFetch('monthly','/monthly/'+VIEW_USER),
    anaFetch('cardio','/cardio/'+VIEW_USER,d=>d.cardio||[])]);
  if(ins)checkNewAchievements(ins); // feiert neue Erfolge (nur eigenes Athletenkonto)
  if(mg&&mg.justClaimed&&mg.award&&VIEW_USER===ME.id)setTimeout(()=>celebrateMonthly(mg.award,mg.bonusXp),600);
  if(!document.getElementById('anaBody')||renderTracker.tab!=='training')return;
  if(a==null){if(!have)b.innerHTML=emptyState({icon:'alertTriangle',title:'Daten konnten nicht geladen werden',text:'Prüfe deine Verbindung und versuch es noch einmal.',btn:{label:'Erneut versuchen',onclick:"drawAnaTraining({refresh:true})"}});return;}
  if(before!==JSON.stringify(keys.map(anaCached)))anaPaintTraining();}

// Wochenvergleich: aus /analytics.week (BE 2.1), sonst /insights.week, sonst aus den Wochen-Buckets
function anaWeek(a,INS){let src=(a&&a.week)||(INS&&INS.week)||null;let tw=src?src.thisWeek:null,lw=src?src.lastWeek:null;
  if(!tw&&a&&a.weeks){const mon=anaMonday(today()),prev=anaAddDays(mon,-7);tw=a.weeks.find(w=>w.week===mon);lw=a.weeks.find(w=>w.week===prev);}
  const target=(INS&&INS.weekGoal&&+INS.weekGoal.target)||anaGoals().days||3;
  return {tw:tw||{volume:0,sessions:0},lw:lw||{volume:0,sessions:0},target};}
function anaCardioWeek(list){const mon=anaMonday(today());const wk=(list||[]).filter(c=>c.date>=mon);
  return {n:wk.length,min:wk.reduce((s,c)=>s+(+c.minutes||0),0),km:wk.reduce((s,c)=>s+(+c.distance_km||0),0),kcal:wk.reduce((s,c)=>s+(+c.kcal||0),0)};}
function anaTons(v){const t=(+v||0)/1000;return fmtNum(t,t>=100?0:1)+' t';}
function anaPaintTraining(){const b=document.getElementById('anaBody');if(!b)return;
  const a=anaCached('analytics'),INS=anaCached('insights'),MG=anaCached('monthly'),cardio=anaCached('cardio');
  const empty=!a||!a.totals||!a.totals.totalSets;
  const wk=anaWeek(a,INS);let h='';
  if(!empty){const tw=wk.tw,lw=wk.lw;const dv=(tw.volume||0)-(lw.volume||0);
    const vCls=lw.volume?(dv>0?'up':dv<0?'amber':''):'';const vIc=dv>0?'trendUp':dv<0?'trendDown':'trendFlat';
    h+=`<div class="tiles" id="anaTiles">
      <div class="tile"><div class="v">${fmtNum(tw.sessions)}<em> / ${fmtNum(wk.target)}</em></div><div class="l">Trainings diese Woche</div><div class="trend ${tw.sessions>=wk.target?'up':''}">${tw.sessions>=wk.target?icon('check',14)+' Wochenziel erreicht':`${pl(wk.target-tw.sessions,'Training','Trainings')} offen`}</div></div>
      <div class="tile"><div class="v">${anaTons(tw.volume)}</div><div class="l">Volumen diese Woche</div><div class="trend ${vCls}">${icon(vIc,14)} Vorwoche ${anaTons(lw.volume)}</div></div>
    </div>
    <div class="meta mb-3 ana-lifetime">Gesamt: ${pl(a.totals.totalSessions,'Trainingstag','Trainingstage')} · ${pl(a.totals.totalSets,'Satz','Sätze')} · ${anaTons(a.totals.totalVolume)}</div>`;}
  // Ohne Trainingsdaten steht der Handlungsaufruf oben, die Ziele darunter
  if(empty){h+=emptyState({icon:'dumbbell',title:'Noch keine Trainingsdaten',text:'Sobald Sätze eingetragen sind, erscheinen hier Volumen, Häufigkeit und der Verlauf jeder Übung.',btn:coachView()?null:{label:'Training starten',onclick:"renderWorkout.tab='kraft';go('workout')"}});
    h+=anaGoalsStrip(INS,MG,cardio,wk);b.innerHTML=h;return;}
  h+=anaGoalsStrip(INS,MG,cardio,wk);
  // Wochen-Volumen (laufende Woche als hohler Punkt)
  if(a.weeks&&a.weeks.length>=2){const cur=a.weeks[a.weeks.length-1];const running=cur.week===anaMonday(today());
    h+=`<div class="chart-card" id="chart-volume"><div class="ch-h"><div class="t">Wochen-Volumen</div><div class="v">${running?'läuft: ':'zuletzt '}${anaTons(cur.volume)}</div></div>${lineChart(a.weeks.map(w=>({date:w.week,value:w.volume/1000})),'t',{partialLast:running,tickFmt:v=>fmtNum(v,Number.isInteger(v)?0:1)+' t'})}<div class="caption mt-2">Gewicht × Wiederholungen pro Woche${running?' · hohler Punkt = laufende Woche':''}</div></div>`;}
  // Übungen: nach Fortschritt sortiert, Drilldown
  const exs=(a.exercises||[]).map(e=>({...e,gain:Math.round(((+e.lastWeight||0)-(+e.firstWeight||0))*10)/10}))
    .sort((x,y)=>{const nx=x.sessions<2,ny=y.sessions<2;if(nx!==ny)return nx?1:-1;return y.gain-x.gain;});
  h+=`<div class="section-label">Übungen<span class="sl-r">nach Fortschritt</span></div>`;
  const vari=anaExVariants(exs); // gleichnamige Übungen unterscheidbar machen
  if(exs.length){h+='<div class="rows">'+exs.map(e=>{
      const t=e.sessions<2?`<span class="muted-2">neu</span>`:e.gain>0?`<span class="trend up">${icon('trendUp',14)} +${fmtNum(e.gain,1)} kg</span>`:e.gain<0?`<span class="trend amber">${icon('trendDown',14)} ${fmtNum(e.gain,1)} kg</span>`:`<span class="muted-2">${icon('trendFlat',14)} stabil</span>`;
      const v=vari[e.id]||'';const full=e.name+(v?' · '+v:'');
      return `<div class="row tap" onclick="anaExHistory(${e.id},'${esc(full)}')"><div class="rl">${esc2(e.name)}${v?` <span class="ana-vari">${esc2(v)}</span>`:''}<small>${pl(e.sessions,'Einheit','Einheiten')}${e.muscle?' · '+esc2(e.muscle):''}${e.best1rm?' · 1RM ~'+fmtNum(e.best1rm)+' kg':''}</small></div><div class="rr">${t}</div></div>`;}).join('')+'</div>';}
  else h+='<div class="note">Noch keine Übungen mit Sätzen.</div>';
  if(a.muscles&&a.muscles.length){const max=Math.max(...a.muscles.map(m=>m.volume))||1;
    h+=`<div class="section-label">Volumen nach Muskelgruppe</div><div class="card">`+a.muscles.map(m=>`<div class="ana-muscle"><div class="between meta"><span>${esc2(m.muscle)}</span><span>${anaTons(m.volume)}</span></div><div class="bar"><i style="width:${Math.round(m.volume/max*100)}%"></i></div></div>`).join('')+`</div>`;}
  if(coachView())h+=`<div class="note mt-4">Als Coach siehst du hier dieselben Zahlen wie dein Athlet – nutze Volumen-Trend und Übungsverlauf, um den Plan gezielt anzupassen.</div>`;
  b.innerHTML=h;}
// Ein Plan darf dieselbe Übung mehrfach enthalten (z. B. „Leg Press" zweimal an einem Tag). In der Liste
// wären die Zeilen sonst nicht auseinanderzuhalten -> Zusatz nur bei Namensgleichheit: der Trainingstag aus
// dem Plan (wenn er eindeutig ist), sonst eine stabile Nummer („Variante 2", nach Übungs-ID sortiert).
function anaExVariants(exs){const cnt={};(exs||[]).forEach(e=>{cnt[e.name]=(cnt[e.name]||0)+1;});
  const dayOf={};try{((typeof PLAN!=='undefined'&&PLAN&&PLAN.days)||[]).forEach(d=>(d.exercises||[]).forEach(x=>{dayOf[x.id]=d.name;}));}catch(e){}
  const out={},seen={};
  (exs||[]).slice().sort((a,b)=>(+a.id||0)-(+b.id||0)).forEach(e=>{if(cnt[e.name]<2)return;
    const n=(seen[e.name]=(seen[e.name]||0)+1);const dn=dayOf[e.id];
    const uniqueDay=!!dn&&exs.every(o=>o.name!==e.name||o.id===e.id||dayOf[o.id]!==dn);
    out[e.id]=uniqueDay?dn:'Variante '+n;});
  return out;}

// „Ziele & Erfolge": Monatsziel · Wochenziel · Level/Erfolge · Cardio – alles aus dem Analyse-Tab erreichbar
function anaGoalsStrip(INS,MG,cardio,wk){
  const strip=(ic,t,s,oc)=>`<div class="stat-strip" role="button" tabindex="0" onclick="${oc}" onkeydown="if(event.key==='Enter')this.click()"><div class="si">${icon(ic,24)}</div><div class="sc"><div class="st">${t}</div><div class="ss">${s}</div></div><div class="sx">${icon('chevronRight',18)}</div></div>`;
  let h=`<div class="section-label">Ziele &amp; Erfolge</div>`;
  h+=strip('target','Monatsziel',(MG&&MG.parts)?(MG.allReached?'Erreicht – stark':`${fmtNum(MG.reachedCount)} von ${fmtNum(MG.parts.length)} geschafft`):'Öffnen','openMonthlyGoal()');
  const streak=INS&&INS.streaks&&INS.streaks.weekGoal;
  h+=strip('calendar','Wochenziel',`${fmtNum(wk.tw.sessions)}/${fmtNum(wk.target)} Trainings${streak?` · ${pl(streak,'Woche','Wochen')} in Folge`:''}`,"renderWorkout.tab='kraft';go('workout')");
  if(INS){const list=INS.achievements||[];h+=strip('star',`Level ${fmtNum(INS.level||1)} · ${esc2(INS.levelTitle||'Rookie')}`,`${fmtNum(list.filter(x=>x.done).length)}/${fmtNum(list.length)} Erfolge · ${fmtNum(INS.xp||0)} XP`,'openAchievements()');}
  const cw=anaCardioWeek(cardio);
  h+=strip('heart','Cardio diese Woche',cw.n?`${fmtNum(cw.min)} min${cw.km?' · '+fmtNum(cw.km,1)+' km':''} · ${fmtNum(Math.round(cw.kcal))} kcal`:'Noch keine Einheit',"renderWorkout.tab='cardio';go('workout')");
  return h;}

// Übungs-Verlauf aus der Analyse: Gewicht + Wiederholungen (lineChart2) und die letzten Einheiten als Zeilen.
// (openExHistory in training.js bleibt für den Trainings-Tab; hier die Analyse-Variante mit denselben Daten.)
// WICHTIG: Quelle ist die Übungs-Route GET /api/exercise-history/:uid/:exId – sie rechnet über ALLE Sätze.
// GET /api/logs/:uid liefert nur die letzten 500 Satzzeilen; damit fielen ältere Einheiten lautlos weg und
// „Bestleistung / seit Beginn / Einheiten" widersprachen der Zeile, aus der man gerade getippt hatte.
// Die Satz-Details der letzten Einheiten holen wir tagesgenau (/logs/:uid?date=…) – diese Abfrage ist ungekappt.
async function anaExHistory(exId,name){name=name||'Übung';openSheet(name,'<div class="spinner"></div>');
  const r=await API.get('/exercise-history/'+VIEW_USER+'/'+exId);
  if(r.status!==200){openSheet(name,`<div class="note err">${esc2(r.data?.error||'Verlauf konnte nicht geladen werden.')}</div>`);return;}
  const sess=(r.data?.history||[]).filter(x=>+x.weight>0&&+x.reps>0)
    .map(x=>({date:x.date,top:+x.weight,reps:+x.reps})).sort((x,y)=>x.date<y.date?-1:1);
  if(!sess.length){openSheet(name,emptyState({icon:'dumbbell',title:'Noch keine Sätze mit Gewicht',text:'Ab dem ersten Training entsteht hier deine Kurve.'}));return;}
  const prs=r.data?.prs||{};
  const best=(+prs.maxWeight>0)?+prs.maxWeight:Math.max(...sess.map(s=>s.top));
  const first=sess[0],lastS=sess[sess.length-1];const diff=Math.round((lastS.top-first.top)*10)/10;
  const setsBy=await anaExSets(exId,sess.slice(-3).map(s=>s.date));
  const setsTxt=s=>{const ss=setsBy[s.date]||[];
    if(!ss.length)return `${fmtNum(s.top,1)} kg × ${fmtNum(s.reps)}`;
    const same=ss.every(x=>+x.weight===+ss[0].weight);
    return same?`${fmtNum(ss[0].weight,1)} kg × ${ss.map(x=>fmtNum(x.reps)).join('/')}`:ss.map(x=>`${fmtNum(x.weight,1)}×${fmtNum(x.reps)}`).join(' · ');};
  let h=`<div class="card grid-3 center mb-3">
      <div><div class="num-md">${fmtNum(best,1)}<em class="meta"> kg</em></div><div class="caption">Bestleistung</div></div>
      <div><div class="num-md ${diff>0?'tone-green':diff<0?'tone-amber':''}">${diff>0?'+':''}${fmtNum(diff,1)}<em class="meta"> kg</em></div><div class="caption">seit Beginn</div></div>
      <div><div class="num-md">${fmtNum(sess.length)}</div><div class="caption">${sess.length===1?'Einheit':'Einheiten'}</div></div></div>`;
  if(sess.length>=2){
    // Beide Achsen vorgeben: lineChart2 leitet die rechte Beschriftung aus den linken Linien ab – ohne
    // eigene Wiederholungs-Achse stünde bei konstanten Reps „10,1 Wdh." an der Skala (_axis5 aus training.js).
    let o={};
    if(typeof _axis5==='function'){const A1=_axis5(sess.map(s=>s.top),0.5),A2=_axis5(sess.map(s=>s.reps),1);
      o={domain1:A1.domain,step1:A1.step,tickFmt1:v=>fmtNum(v,Number.isInteger(v)?0:1),
         domain2:A2.domain,step2:A2.step,tickFmt2:v=>fmtNum(Math.round(v))};}
    h+=`<div class="chart-card"><div class="ch-h"><div class="t">Top-Gewicht und Wiederholungen</div><div class="v">${fmtNum(lastS.top,1)} kg × ${fmtNum(lastS.reps)} zuletzt</div></div>${lineChart2(sess.map(s=>({date:s.date,v1:s.top,v2:s.reps})),'Gewicht','kg','Wdh.','',o)}</div>`;}
  else h+=`<div class="note mb-3">Erste Einheit: ${fmtNum(first.top,1)} kg × ${fmtNum(first.reps)} am ${fmtDate(first.date,{month:'long'})} – ab der zweiten Einheit erscheint hier die Kurve.</div>`;
  h+=`<div class="section-label">Letzte Einheiten</div><div class="rows">`+sess.slice(-3).reverse().map(s=>`<div class="row"><div class="rl">${fmtDate(s.date,{weekday:'short'})}<small>${setsTxt(s)}</small></div><div class="rr">${fmtNum(s.top,1)} kg × ${fmtNum(s.reps)}</div></div>`).join('')+`</div>`;
  openSheet(name,h);}
// Sätze einzelner Trainingstage (für die Zeilen „Letzte Einheiten"): pro Datum eine kleine, ungekappte Abfrage.
async function anaExSets(exId,dates){const out={};
  await Promise.all((dates||[]).map(async d=>{const q=await API.get('/logs/'+VIEW_USER+'?date='+encodeURIComponent(d));
    out[d]=(q.data?.logs||[]).filter(l=>l.exercise_id===exId&&+l.weight>0&&+l.reps>0).sort((a,b)=>(+a.set_no||0)-(+b.set_no||0));}));
  return out;}

// ===== CARDIO-EINHEIT (Sheet; die Cardio-Liste wohnt im Trainings-Tab, training.js) =====
const CARDIO_KINDS=['Laufen','Joggen','Rad','Spinning','Rudern','Gehen','Wandern','Schwimmen','Crosstrainer','Stepper','Seilspringen','HIIT','Crossfit'];
const CARDIO_DIST=['Laufen','Joggen','Rad','Gehen','Wandern','Schwimmen']; // Sportarten mit sinnvoller Distanz
const CARDIO_PACE=['Laufen','Joggen','Gehen'];   // min/km ist hier aussagekräftig
const CARDIO_SPEED=['Rad','Wandern','Schwimmen']; // km/h statt Pace
// cardioPaceText(kind,minutes,km) -> „Tempo 5:30 min/km · 10,9 km/h" | „Ø 24,0 km/h" | '' (auch für training.js nutzbar)
function cardioPaceText(kind,min,dist){min=+min||0;dist=+dist||0;if(!(min>0&&dist>0)||!CARDIO_DIST.includes(kind))return '';
  const speed=dist/(min/60);
  if(CARDIO_PACE.includes(kind)){const pace=min/dist;let mm=Math.floor(pace),ss=Math.round((pace-mm)*60);if(ss===60){mm++;ss=0;}
    return `Tempo ${mm}:${String(ss).padStart(2,'0')} min/km · ${fmtNum(speed,1)} km/h`;}
  return `Ø ${fmtNum(speed,1)} km/h`;}
function openCardio(){openSheet('Cardio-Einheit',`
  <div class="field"><label for="c_kind">Sportart</label><select id="c_kind" onchange="cardioKindChange()">${CARDIO_KINDS.map(k=>`<option>${k}</option>`).join('')}</select></div>
  <div class="grid-2" id="c_form">
    <div class="field"><label for="c_min">Minuten</label><input id="c_min" type="number" inputmode="numeric" min="0" max="1440" placeholder="30" oninput="cardioPace()"></div>
    <div class="field" id="c_distwrap"><label for="c_dist">Distanz (km, optional)</label><input id="c_dist" type="number" step="0.1" inputmode="decimal" min="0" max="1000" placeholder="5" oninput="cardioPace()"></div>
  </div>
  <div id="c_pace" class="caption mb-3"></div>
  <div class="field"><label for="c_int">Intensität</label><select id="c_int"><option value="leicht">Leicht (locker, Gespräch möglich)</option><option value="moderat" selected>Moderat</option><option value="hart">Hart (fordernd, außer Atem)</option></select></div>
  <div class="field"><label for="c_hr">Puls Ø (optional)</label><input id="c_hr" type="number" inputmode="numeric" min="0" max="250" placeholder="z. B. 145"></div>
  <div class="note mb-4">Die Kalorien werden automatisch geschätzt. Hartes und moderates Cardio fließt in deine Erholungs-Anzeige ein – so weiß die App, ob du morgen voll Kraft trainieren kannst.</div>
  <button class="btn block" onclick="confirmCardio()">Speichern</button>`);cardioKindChange();}
// Distanz nur für Sportarten mit sinnvoller Strecke. Beim Ausblenden das Feld leeren, sonst würde ein
// vorher getippter Wert unsichtbar weiterleben und beim Speichern die Wochen-Kilometer aufblähen.
function cardioKindChange(){const k=val('c_kind');const w=document.getElementById('c_distwrap');const show=CARDIO_DIST.includes(k);
  if(w)w.hidden=!show;
  if(!show){const d=document.getElementById('c_dist');if(d)d.value='';}
  cardioPace();}
function cardioPace(){const el=document.getElementById('c_pace');if(!el)return;
  el.textContent=cardioPaceText(val('c_kind'),parseFloat(val('c_min')),parseFloat(val('c_dist')));}
async function confirmCardio(){const kind=val('c_kind');
  const body={user_id:VIEW_USER,date:today(),kind,minutes:num('c_min'),distance_km:CARDIO_DIST.includes(kind)?num('c_dist'):null,avg_hr:num('c_hr'),intensity:val('c_int')};
  if(!body.minutes)return showFieldErr('c_form','Bitte Minuten eingeben','c_min');
  const r=await API.post('/cardio',body);if(r.status!==200)return toast(r.data?.error||'Fehler – nicht gespeichert');
  closeModal();toast(`Cardio gespeichert ✓ · ${fmtNum(Math.round(r.data?.kcal||0))} kcal`);refreshAchievements();
  anaInvalidate('cardio');anaInvalidate('insights');
  if(typeof drawCardioTab==='function'&&document.getElementById('workoutBody'))drawCardioTab();
  anaRefreshIfVisible();}

// ===== GESUNDHEITS-INTEGRATIONEN (Hub) =====
function openIntegrations(){const on=!!(ME&&ME.health_reminder);const own=!coachView();
  openSheet('Gesundheitsdaten',`
  <div class="note mb-3">Verbinde deine Gesundheits-App, damit Gewicht, Schritte und Schlaf automatisch in deine Auswertung fließen – ohne alles von Hand einzutragen.</div>
  <div class="rows">
    <div class="row tap" onclick="openAppleHealth()"><div class="r-ic">${icon('apple',24)}</div><div class="rl">Apple Health<small>Über Kurzbefehl – schnell und ohne Riesen-Export</small></div><div class="rr"><span class="pill green">verfügbar</span></div></div>
    <div class="row soon"><div class="r-ic">${icon('heart',24)}</div><div class="rl">Health Connect<small>Android · Google Fit</small></div><div class="rr"><span class="pill neutral">kommt bald</span></div></div>
    <div class="row soon"><div class="r-ic">${icon('timer',24)}</div><div class="rl">Fitbit<small>Tracker und Smartwatches</small></div><div class="rr"><span class="pill neutral">kommt bald</span></div></div>
    <div class="row soon"><div class="r-ic">${icon('zap',24)}</div><div class="rl">Garmin Connect<small>Sportuhren</small></div><div class="rr"><span class="pill neutral">kommt bald</span></div></div>
  </div>
  ${own?`<div class="rows mt-4"><div class="switch-row"><div class="rl">Wöchentlich erinnern<small>Neue Daten importieren</small></div><button class="tgl${on?' on':''}" id="health_rem" role="switch" aria-checked="${on?'true':'false'}" aria-label="Wöchentlich erinnern" onclick="toggleHealthReminder(!this.classList.contains('on'))"></button></div></div>`:''}
  <div class="caption mt-3">Kein passendes Gerät? Du kannst alle Werte jederzeit auf der Startseite oder in der Check-in Historie eintragen.</div>`);}

// ----- Apple Health über Kurzbefehl -----
// Das Sheet selbst (openAppleHealth), das Einlesen des Textfeldes (importShortcutText) und die Vorschau
// (showImportPreview) gehören zum Konto-Paket und stehen in account.js. Hier bleiben die gemeinsam genutzten
// Bausteine, die von dort aufgerufen werden: Parser, Datei-Import und der Upload zum Server.

// Tolerantes Parsen: akzeptiert {"days":{...}}, {...} direkt, oder einfache Zeilen "Datum, Gewicht, Schritte, Schlaf"
function parseShortcutData(raw){
  const txt=raw.trim();
  // 1) JSON versuchen
  try{const j=JSON.parse(txt);const days=j.days||j;
    if(days&&typeof days==='object'){const out={};
      for(const[k,v]of Object.entries(days)){if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||typeof v!=='object')continue;
        const e={};if(v.weight!=null&&!isNaN(+v.weight))e.weight=Math.round(+v.weight*10)/10;
        if(v.steps!=null&&!isNaN(+v.steps))e.steps=Math.round(+v.steps);
        if(v.sleep!=null&&!isNaN(+v.sleep))e.sleep=Math.round(+v.sleep*10)/10;
        if(Object.keys(e).length)out[k]=e;}
      if(Object.keys(out).length)return out;}
  }catch(e){}
  // 2) CSV-artige Zeilen: "2026-06-01, 75.5, 8200, 7.5"
  const out={};
  for(const line of txt.split(/\r?\n/)){
    const m=line.match(/(\d{4}-\d{2}-\d{2})/);if(!m)continue;
    const nums=line.replace(m[1],'').match(/-?\d+(?:[.,]\d+)?/g)||[];
    const f=nums.map(x=>parseFloat(x.replace(',','.')));
    const e={};if(f[0]!=null)e.weight=Math.round(f[0]*10)/10;if(f[1]!=null)e.steps=Math.round(f[1]);if(f[2]!=null)e.sleep=Math.round(f[2]*10)/10;
    if(Object.keys(e).length)out[m[1]]=e;
  }
  return Object.keys(out).length?out:null;}

// Datei lesen: JSON/Text -> parseShortcutData; XML -> alter Apple-Voll-Export-Parser (Fallback)
function handleHealthFile(ev){const file=ev.target.files&&ev.target.files[0];if(!file)return;
  const st=document.getElementById('health_status');
  const say=html=>{const el=document.getElementById('health_status');if(el)el.innerHTML=html;};
  say('<div class="spinner"></div><div class="caption center">Datei wird gelesen …</div>');
  const reader=new FileReader();
  reader.onerror=()=>say('<div class="note err">Datei konnte nicht gelesen werden.</div>');
  reader.onload=()=>{try{
      const text=reader.result;
      let days;
      if(/^\s*</.test(text)&&/<Record/.test(text)){days=parseHealthXML(text).days;} // alter XML-Export
      else{days=parseShortcutData(text);}
      if(!days||!Object.keys(days).length){say('<div class="note">Keine passenden Daten gefunden. Erwartet wird die kleine JSON-Datei aus dem Kurzbefehl (oder die Export.xml).</div>');return;}
      showImportPreview(days,document.getElementById('health_status')||st);
    }catch(e){console.error('[analysis] health file',e);say('<div class="note err">Die Datei konnte nicht verarbeitet werden.</div>');}};
  reader.readAsText(file);}

// XML-Fallback-Parser (alter Apple-Voll-Export) – bleibt für Nutzer, die das schon haben
function parseHealthXML(xml){
  const dayOf=s=>{const m=(s||'').match(/^(\d{4}-\d{2}-\d{2})/);return m?m[1]:null;};
  const norm=x=>{const m=(x||'').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\s*([+-]\d{2})(\d{2})?/);return m?`${m[1]}T${m[2]}${m[3]}:${m[4]||'00'}`:null;};
  const weight={},steps={},sleepMs={};let count=0;
  for(const mt of xml.matchAll(/<Record\b([^>]*)>/g)){
    const tag=mt[1];const a={};for(const m of tag.matchAll(/(\w+)="([^"]*)"/g))a[m[1]]=m[2];count++;
    const t=a.type;if(!t)continue;
    if(t==='HKQuantityTypeIdentifierBodyMass'){const d=dayOf(a.startDate||a.endDate),v=parseFloat(a.value);if(d&&!isNaN(v))weight[d]=v;}
    else if(t==='HKQuantityTypeIdentifierStepCount'){const d=dayOf(a.startDate||a.endDate),v=parseFloat(a.value);if(d&&!isNaN(v))steps[d]=(steps[d]||0)+v;}
    else if(t==='HKCategoryTypeIdentifierSleepAnalysis'){if(!/Asleep/i.test(a.value||''))continue;const s=norm(a.startDate),e=norm(a.endDate);if(!s||!e)continue;const ms=Math.max(0,Date.parse(e)-Date.parse(s));if(ms<=0)continue;const d=dayOf(a.endDate||a.startDate);if(d)sleepMs[d]=(sleepMs[d]||0)+ms;}
  }
  const days={};const ens=d=>(days[d]=days[d]||{});
  for(const[d,v]of Object.entries(weight))ens(d).weight=Math.round(v*10)/10;
  for(const[d,v]of Object.entries(steps))ens(d).steps=Math.round(v);
  for(const[d,ms]of Object.entries(sleepMs))ens(d).sleep=Math.round(ms/3600000*10)/10;
  return{days,stats:{records:count,weightDays:Object.keys(weight).length,stepDays:Object.keys(steps).length,sleepDays:Object.keys(sleepMs).length}};}

async function doHealthImport(days){const say=html=>{const el=document.getElementById('health_status');if(el)el.innerHTML=html;};
  say('<div class="spinner"></div>');
  const r=await API.post('/health-import/'+VIEW_USER,{days});
  if(r.status===200){
    if(ME)ME.last_health_import=new Date().toISOString();
    say(`<div class="note ok">Fertig ✓ – ${pl(r.data.created,'neuer Tag','neue Tage')}, ${pl(r.data.updated,'Tag','Tage')} ergänzt. Deine Kurven sind aktualisiert.</div>`);
    toast('Daten importiert ✓');anaInvalidate('checkins');anaInvalidate('insights');
    if(typeof invalidateView==='function')try{invalidateView('home');}catch(e){}
    refreshAchievements();anaRefreshIfVisible();
  }else say('<div class="note err">Import fehlgeschlagen. Bitte erneut versuchen.</div>');}

async function toggleHealthReminder(on){const r=await API.post('/health-reminder',{enabled:on});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  if(ME)ME.health_reminder=on?1:0;
  const t=document.getElementById('health_rem');if(t){t.classList.toggle('on',!!on);t.setAttribute('aria-checked',on?'true':'false');if(t.type==='checkbox')t.checked=!!on;}
  toast(on?'Erinnerung aktiviert ✓':'Erinnerung deaktiviert');}

// ===== KÖRPERMASSE =====
async function openMeasure(){openSheet('Körpermaße','<div class="spinner"></div>');
  const r=await API.get('/measurements/'+VIEW_USER);const list=(r.data?.measurements||[]).slice().sort((a,b)=>a.date<b.date?1:-1);
  openMeasure.list=list;openSheet('Körpermaße',anaMeasureHTML(list));}
function anaMeasureLabel(k){const f=MEASURE_FIELDS.find(x=>x[0]===k);return (f?f[1]:k).replace(' %','');}
function anaMeasureUnit(k){return k==='body_fat'?'%':'cm';}
// Als Coach nur lesen – genau wie Check-ins, Historie und Fotos, die für ihn ebenfalls ohne Eingabe auskommen.
function anaMeasureHTML(list){const canEdit=!coachView();let h='';
  if(canEdit){
    h+=`<div class="note mb-3">Trag ein, was du misst – leer lassen ist okay. Umfänge in cm, Körperfett in %.</div><div class="grid-2" id="ms_form">`;
    MEASURE_FIELDS.forEach(([k])=>{const lastE=list.find(m=>m[k]!=null);const u=anaMeasureUnit(k);
      h+=`<div class="field"><label for="ms_${k}">${anaMeasureLabel(k)} (${u})</label><input id="ms_${k}" type="number" step="0.1" inputmode="decimal" min="0" max="${k==='body_fat'?80:300}" placeholder="–">${lastE?`<div class="caption mt-1">zuletzt ${fmtNum(lastE[k],1)} ${u} · ${fmtDate(lastE.date)}</div>`:''}</div>`;});
    h+=`</div><button class="btn block" onclick="saveMeasure()">Speichern</button>`;
  }else h+=`<div class="note mb-3">Maße deines Athleten – nur zur Ansicht. Eintragen kann sie nur er selbst.</div>`;
  const withData=MEASURE_FIELDS.filter(([k])=>list.some(m=>m[k]!=null));
  if(withData.length){if(!openMeasure.sel||!withData.some(([k])=>k===openMeasure.sel))openMeasure.sel=withData[0][0];
    h+=`<div class="section-label">Verlauf</div><div class="chip-row" id="ms_chips">${withData.map(([k])=>`<button class="chip${k===openMeasure.sel?' on':''}" data-k="${k}" onclick="measureSel('${k}')">${anaMeasureLabel(k)}</button>`).join('')}</div><div id="ms_hist">${anaMeasureHist(list,openMeasure.sel)}</div>`;}
  else if(!canEdit)h+=emptyState({icon:'ruler',title:'Noch keine Maße',text:'Dein Athlet hat noch keine Körpermaße eingetragen.'});
  return h;}
function anaMeasureHist(list,k){const lbl=anaMeasureLabel(k),u=anaMeasureUnit(k);
  const rows=list.filter(m=>m[k]!=null).slice(0,30);const asc=rows.slice().reverse();let h='';
  if(asc.length>=2){const d=Math.round((asc[asc.length-1][k]-asc[0][k])*10)/10;
    h+=`<div class="chart-card mt-3"><div class="ch-h"><div class="t">${lbl}</div><div class="v">${fmtNum(asc[asc.length-1][k],1)} ${u} · ${d>0?'+':''}${fmtNum(d,1)} ${u} seit ${fmtDate(asc[0].date)}</div></div>${metricChart(asc.map(m=>({date:m.date,value:+m[k]})),u)}</div>`;}
  else h+=`<div class="caption mt-3 mb-3">Ab dem zweiten Eintrag erscheint hier die Kurve.</div>`;
  h+=`<div class="rows">`+rows.slice(0,8).map((m,i)=>{const prev=rows[i+1];const d=prev?Math.round((m[k]-prev[k])*10)/10:null;
    return `<div class="row"><div class="rl">${fmtDate(m.date,{weekday:'short'})}</div><div class="rr">${fmtNum(m[k],1)} ${u}${d!=null?` <span class="pill neutral">${d>0?'+':''}${fmtNum(d,1)}</span>`:''}</div></div>`;}).join('')+`</div>`;
  return h;}
function measureSel(k){openMeasure.sel=k;const el=document.getElementById('ms_hist');if(el)el.innerHTML=anaMeasureHist(openMeasure.list||[],k);
  document.querySelectorAll('#ms_chips .chip').forEach(c=>c.classList.toggle('on',c.dataset.k===k));}
async function saveMeasure(){if(coachView())return toast('Maße kann nur der Athlet selbst eintragen');
  const body={user_id:VIEW_USER,date:today()};let any=false;
  MEASURE_FIELDS.forEach(([k])=>{const v=num('ms_'+k);if(v!=null){body[k]=v;any=true;}});
  if(!any)return showFieldErr('ms_form','Bitte mindestens einen Wert eingeben','ms_'+MEASURE_FIELDS[0][0]);
  const r=await API.post('/measurements',body);if(r.status!==200)return toast(r.data?.error||'Fehler – nicht gespeichert');
  toast('Maße gespeichert ✓');refreshAchievements();
  const rr=await API.get('/measurements/'+VIEW_USER);const list=(rr.data?.measurements||[]).slice().sort((a,b)=>a.date<b.date?1:-1);openMeasure.list=list;
  if(sheetOpen())openSheet('Körpermaße',anaMeasureHTML(list)); // Liste im Sheet aktualisieren, neuer Eintrag sichtbar
}

// ===== FORTSCHRITTSFOTOS =====
async function openPhotos(uid){uid=uid||VIEW_USER;const readOnly=(uid!==ME.id);
  openSheet('Fortschrittsfotos','<div class="spinner"></div>');
  const r=await API.get('/photos/'+uid);const list=r.data?.photos||[];openPhotos.uid=uid;openPhotos.list=list;
  const pose=openPhotos.pose||'front';
  let h=readOnly
    ? `<div class="note mb-3">Nur du als zugewiesener Coach siehst die Fotos dieses Athleten.</div>`
    : `<div class="note mb-3">Alle zwei Wochen ein Foto – gleiche Pose, gleiches Licht. Fotos bleiben privat: nur du und dein zugewiesener Coach sehen sie.</div>
      <div class="seg" id="ph_poseSeg">${[['front','Vorne'],['side','Seite'],['back','Hinten']].map(([k,l])=>`<button class="${k===pose?'on':''}" data-pose="${k}" onclick="phPose('${k}')">${l}</button>`).join('')}</div>
      <label class="btn block">${icon('camera',18)} Foto aufnehmen<input type="file" accept="image/*" capture="environment" onchange="handlePhoto(event)"></label>`;
  if(list.length){h+=`<div class="section-label">${readOnly?'Fotos':'Deine Fotos'}<span class="sl-r">${pl(list.length,'Foto','Fotos')}</span></div><div class="ph-grid">`+
    list.map(p=>`<button class="ph-th" data-pid="${p.id}" onclick="viewPhoto(${p.id},${uid})" aria-label="Foto vom ${fmtDate(p.date)}"><img alt="" loading="lazy"><span class="ph-cap">${fmtDate(p.date)} · ${({front:'V',side:'S',back:'H'})[p.pose]||''}</span></button>`).join('')+`</div>`;}
  else h+=emptyState({icon:'camera',title:'Noch keine Fotos',text:readOnly?'Der Athlet hat noch keine Fotos hochgeladen.':'Dein erstes Foto ist dein Startpunkt – mach es heute.'});
  openSheet('Fortschrittsfotos',h);
  anaLoadThumbs(list,uid);}
// Vorschaubilder: aus der Liste (thumb, BE 2.1) – ältere Fotos ohne thumb einzeln nachladen. src immer als Property, nie im HTML.
async function anaLoadThumbs(list,uid){for(const p of list){const img=document.querySelector(`.ph-th[data-pid="${p.id}"] img`);if(!img)return; // Sheet ist weg
    if(p.thumb){img.src=p.thumb;continue;}
    const pr=await API.get('/photos/'+uid+'/'+p.id);const im2=document.querySelector(`.ph-th[data-pid="${p.id}"] img`);
    if(im2&&pr.data?.photo)im2.src=pr.data.photo.thumb||pr.data.photo.image;}}
function phPose(k){openPhotos.pose=k;document.querySelectorAll('#ph_poseSeg button').forEach(b=>b.classList.toggle('on',b.dataset.pose===k));}
function handlePhoto(ev){const file=ev.target.files&&ev.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=()=>{
    const img=new Image();img.onload=()=>{
      // Hauptbild max. 800 px breit (JPEG 0.7, deutlich unter 2 MB), Vorschaubild max. 200 px (JPEG 0.6, wenige KB)
      const shrink=(max,q)=>{let w=img.width,hh=img.height;if(w>max){hh=Math.round(hh*max/w);w=max;}if(hh>max*1.5){w=Math.round(w*max*1.5/hh);hh=Math.round(max*1.5);}
        const cv=document.createElement('canvas');cv.width=Math.max(1,w);cv.height=Math.max(1,hh);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);return cv.toDataURL('image/jpeg',q);};
      uploadPhoto(shrink(800,.7),shrink(200,.6));};
    img.onerror=()=>toast('Bild konnte nicht gelesen werden');img.src=reader.result;};
  reader.readAsDataURL(file);}
async function uploadPhoto(data,thumb){toast('Lädt hoch …');
  const body={user_id:VIEW_USER,date:today(),pose:openPhotos.pose||'front',image:data};if(thumb)body.thumb=thumb;
  const r=await API.post('/photos',body);
  if(r.status===200){toast('Foto gespeichert ✓');refreshAchievements();openPhotos(VIEW_USER);}else toast(r.data?.error||'Fehler');}
async function viewPhoto(id,uid){uid=uid||VIEW_USER;const meta=(openPhotos.list||[]).find(p=>p.id===id);
  const title=meta?fmtDate(meta.date,{weekday:'long',month:'long'}):'Foto';
  openSheet(title,'<div class="spinner"></div>');
  const r=await API.get('/photos/'+uid+'/'+id);if(r.status!==200){openSheet(title,'<div class="note err">Foto konnte nicht geladen werden.</div>');return;}
  const p=r.data.photo;const own=uid===ME.id;viewPhoto.cur=p;
  openSheet(fmtDate(p.date,{weekday:'long',month:'long'}),`<img id="ph_view" class="ph-view" alt="Fortschrittsfoto">
    <div class="between mt-3"><span class="meta">${({front:'Vorne',side:'Seite',back:'Hinten'})[p.pose]||''}</span>
      <div class="cluster"><button class="btn sm sec" onclick="closeModal()">Zurück</button>${own?`<button class="btn sm danger" onclick="delPhoto(${p.id})">${icon('trash',14)} Löschen</button>`:''}</div></div>`);
  const im=document.getElementById('ph_view');if(im)im.src=p.image;} // src als Property, nie in den HTML-String
// Löschen mit Bestätigung + Rückgängig (Bilddaten sind aus viewPhoto bekannt und werden neu hochgeladen)
function delPhoto(id){const p=(viewPhoto.cur&&viewPhoto.cur.id===id)?viewPhoto.cur:null;const uid=openPhotos.uid||VIEW_USER;
  confirmSheet('Foto löschen','Das Foto wird entfernt. Direkt danach kannst du es noch rückgängig machen.',{label:'Löschen',onYes:async()=>{
    const r=await API.del('/photos/'+id);if(r.status!==200)return toast(r.data?.error||'Fehler');
    if(sheetOpen())openPhotos(uid); // zurück zur Liste (Titel liegt tiefer im Stack -> Ebene wird abgebaut)
    const undo=p?{label:'Rückgängig',fn:async()=>{const body={user_id:p.user_id||uid,date:p.date,pose:p.pose,image:p.image};if(p.thumb)body.thumb=p.thumb;
      const rr=await API.post('/photos',body);if(rr.status===200){toast('Wiederhergestellt ✓');if(sheetOpen())openPhotos(uid);}else toast(rr.data?.error||'Konnte nicht wiederherstellen');}}:null;
    toast('Foto gelöscht',undo);}});}

// ===== ERFOLGE (Level, „Als Nächstes", nach Bereich gruppiert) =====
let LAST_INSIGHTS=null;
async function openAchievements(){openSheet('Erfolge','<div class="spinner"></div>');
  let I=(VIEW_USER===ME.id?LAST_INSIGHTS:null)||anaCached('insights');
  if(!I||anaStale('insights')){const r=await API.get('/insights/'+VIEW_USER);if(r.status===200){I=anaStore('insights',r.data);if(VIEW_USER===ME.id)LAST_INSIGHTS=I;}}
  I=I||{};
  const list=(I.achievements||[]);const done=list.filter(a=>a.done).length;const lp=I.levelProgress||{pct:0};
  const CATS=[['Training',/^(first_workout|sessions_|sets_|volume_|pr_|first_cardio|cardio_|dist_)/],['Körper & Ernährung',/^(first_checkin|first_photo|first_measure|food_|mealplan)/],['Konstanz',/^(streak_|weekgoal_|month_|coach_challenge|level_)/],['Mindset',/^(prime_|wheel_|challenge_|breath_)/]];
  const catOf=a=>(CATS.find(([,re])=>re.test(String(a.id||'')))||['Weitere'])[0];
  const sortFn=(a,b)=>{if(a.done!==b.done)return a.done?-1:1;const pa=a.target?a.progress/a.target:0,pb=b.target?b.progress/b.target:0;return pb-pa;};
  const next=list.filter(a=>!a.done&&a.target>0&&a.progress>0).sort((a,b)=>(b.progress/b.target)-(a.progress/a.target)).slice(0,3);
  const row=(a,bar)=>`<div class="row ach${a.done?' done':''}"><div class="r-ic">${esc2(a.icon||'')}</div><div class="rl">${esc2(a.title)}<small>${esc2(a.desc)}${(!a.done&&a.target)?` · ${fmtNum(a.progress)}/${fmtNum(a.target)}`:''}</small>${bar?`<div class="bar mt-2"><i style="width:${Math.min(100,Math.round(a.progress/a.target*100))}%"></i></div>`:''}</div><div class="rr">${a.done?`<span class="pill green">${icon('check',12)} erreicht</span>`:`<span class="muted-2">${icon('lock',16)}</span>`}</div></div>`;
  let h=`<div class="card ach-head mb-3"><div class="between"><div class="h3">${icon('star',18)} Level ${fmtNum(I.level||1)} · ${esc2(I.levelTitle||'Rookie')}</div><span class="pill neutral">${fmtNum(done)}/${fmtNum(list.length)}</span></div>
    <div class="meta mt-1">${fmtNum(I.xp||0)} XP · nächstes Level bei ${fmtNum(lp.next||100)} XP</div>
    <div class="bar mt-2"><i style="width:${Math.max(0,Math.min(100,+lp.pct||0))}%"></i></div>
    <div class="caption mt-2">XP gibt es für alles: Sätze, Check-ins, Cardio, Fotos, Maße – und am meisten für neue Rekorde.</div></div>`;
  if(next.length)h+=`<div class="section-label">Als Nächstes</div><div class="rows">${next.map(a=>row(a,true)).join('')}</div>`;
  const groups={};list.forEach(a=>{const c=catOf(a);(groups[c]=groups[c]||[]).push(a);});
  [...CATS.map(c=>c[0]),'Weitere'].forEach(c=>{const g=groups[c];if(!g||!g.length)return;const gd=g.filter(a=>a.done).length;
    h+=`<div class="section-label">${c}<span class="sl-r">${fmtNum(gd)}/${fmtNum(g.length)}</span></div><div class="rows">${g.slice().sort(sortFn).map(a=>row(a,false)).join('')}</div>`;});
  if(!list.length)h+=emptyState({icon:'medal',title:'Noch keine Erfolge',text:'Mit dem ersten Check-in und dem ersten Training geht es los.'});
  openSheet('Erfolge',h);}

// Vergleicht erreichte Erfolge mit dem letzten Stand (pro Gerät) und feiert neue – überall einsetzbar.
function checkNewAchievements(INS){
  if(!INS||VIEW_USER!==ME.id||ME.role!=='athlete')return;
  LAST_INSIGHTS=INS;
  try{
    let celebrated=false;
    // Level-Up feiern (Konfetti)
    const prevLevel=parseInt(localStorage.getItem('be_level')||'0');
    if(prevLevel&&INS.level>prevLevel){celebrate('⭐','Level '+INS.level+'!',INS.levelTitle||'');celebrated=true;}
    localStorage.setItem('be_level',String(INS.level));
    // Streak-Meilenstein feiern
    const prevStreak=parseInt(localStorage.getItem('be_streak')||'-1');
    const cur=INS.streaks?.checkin||0;
    if(prevStreak>=0){const hit=[7,14,30,50,100,200,365].find(m=>cur>=m&&prevStreak<m);
      if(hit){if(celebrated)setTimeout(()=>celebrate('🔥',hit+' Tage Streak!','Nicht abreißen lassen!'),1500);else{celebrate('🔥',hit+' Tage Streak!','Nicht abreißen lassen!');celebrated=true;}}}
    localStorage.setItem('be_streak',String(cur));
    // Neue Erfolge: den ersten feiern, weitere als Toast
    const prev=JSON.parse(localStorage.getItem('be_ach')||'[]');
    const now=(INS.achievements||[]).filter(a=>a.done).map(a=>a.id);
    const fresh=now.filter(id=>!prev.includes(id));
    if(prev.length&&fresh.length){
      fresh.forEach((id,i)=>{const a=INS.achievements.find(x=>x.id===id);if(!a)return;
        // Der erste neue Erfolg wird gefeiert – sofort, wenn davor nichts gefeiert wurde, sonst mit Abstand.
        if(i===0&&!celebrated){celebrated=true;celebrate(a.icon,a.title,'Neuer Erfolg!');}
        else setTimeout(()=>toast('🏅 Neuer Erfolg: '+a.title+'!'),700+i*1700);});
    }
    localStorage.setItem('be_ach',JSON.stringify(now));
  }catch(e){}
}
// Holt frische Insights und prüft auf neue Erfolge – nach jeder Aktion, die XP bringt.
// Entprellt (4 s nachlaufend): beim Satz-Loggen kommen viele Aufrufe kurz hintereinander;
// es läuft immer nur EINE Anfrage, weitere Aufrufe währenddessen werden zusammengefasst.
let _achTimer=null,_achInFlight=false,_achAgain=false;
function refreshAchievements(){
  if(!ME||VIEW_USER!==ME.id||ME.role!=='athlete')return;
  clearTimeout(_achTimer);_achTimer=setTimeout(_refreshAchievementsNow,4000);
}
async function _refreshAchievementsNow(){
  if(_achInFlight){_achAgain=true;return;}
  _achInFlight=true;
  try{const r=await API.get('/insights/'+ME.id);if(r.status===200){checkNewAchievements(r.data);if(VIEW_USER===ME.id)anaStore('insights',r.data);}}catch(e){}
  _achInFlight=false;
  if(_achAgain){_achAgain=false;refreshAchievements();}
}

// (Die früheren Coach-Helfer coachMessage/sendCoachMsg/coachSetPhase/saveCoachPhase/resolveNote standen hier;
//  coach.js hat sie mit coachQuickMessage/coachMessagesSheet, coachPhaseSheet/saveCoachPhaseSheet und
//  coachResolveNote vollständig abgelöst – die alten Kopien hatten keine Aufrufer mehr und sind entfernt.)

// ===== MONATSZIEL-SCREEN (Ringe + Balken + „x von 3 geschafft") =====
async function openMonthlyGoal(){openSheet('Monatsziel','<div class="spinner"></div>');
  const uid=VIEW_USER||ME.id;
  const r=await API.get('/monthly/'+uid);
  if(r.status!==200){openSheet('Monatsziel',`<div class="note err">${esc2(r.data?.error||'Fehler')}</div>`);return;}
  const m=r.data;anaStore('monthly',m);
  const monthName=cap(new Date(m.month+'-01T00:00:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'}));
  const open=(m.parts||[]).length-(m.reachedCount||0);
  let h=`<div class="center mb-4"><div class="caption">${monthName}${m.custom?' · vom Coach gesetzt':''}</div>
    <div class="mg-ic">${m.allReached?'🏆':icon('target',40)}</div>
    <div class="h2 mt-2">${m.allReached?'Monatsziel erreicht':fmtNum(m.reachedCount)+' von '+fmtNum((m.parts||[]).length)+' geschafft'}</div>
    <div class="meta mt-1">${m.allReached?'Stark durchgezogen – das zahlt sich aus.':'Noch '+pl(open,'Ziel','Ziele')+' bis zur Auszeichnung.'}</div></div>`;
  h+=`<div class="stack-sm">`+(m.parts||[]).map(p=>`<div class="card mg-part">
    <div class="mg-ring">${ring(Math.max(0,Math.min(100,+p.pct||0))/100,{size:54,color:p.reached?'var(--green)':'var(--red)'})}<div class="mg-ring-ic">${p.reached?icon('check',20):icon(p.iconName||'target',20)}</div></div>
    <div class="fill"><div class="h3">${esc2(p.label)}</div>
      <div class="meta">${fmtNum(p.done)} / ${fmtNum(p.target)}${p.reached?' <span class="tone-green">erreicht</span>':''}</div>
      <div class="bar${p.reached?' green':''} mt-2"><i style="width:${Math.max(0,Math.min(100,+p.pct||0))}%"></i></div></div></div>`).join('')+`</div>`;
  if((ME.role==='coach'||ME.role==='admin')&&COACH_CONTEXT&&typeof openEditMonthly==='function'){const t=k=>((m.parts||[]).find(p=>p.key===k)||{}).target||0;
    h+=`<button class="btn sec mt-4" onclick="openEditMonthly('${m.month}',${t('trainings')},${t('checkins')},${t('volume')})">${icon('target',18)} Ziel für diesen Athleten anpassen</button>`;}
  if(m.history&&m.history.length){h+=`<div class="section-label">Geschaffte Monate</div><div class="cluster">`+
    m.history.map(x=>`<span class="pill neutral">${x.custom?'🎖️':'🏆'} ${cap(new Date(x.month+'-01T00:00:00').toLocaleDateString('de-DE',{month:'short',year:'2-digit'}))}</span>`).join('')+`</div>`;}
  openSheet('Monatsziel',h);
  if(m.justClaimed&&m.award&&uid===ME.id)setTimeout(()=>celebrateMonthly(m.award,m.bonusXp),400);}

function celebrateMonthly(award,bonusXp){award=award||{};
  openSheet('Monatsziel erreicht',`<div class="center mg-cel">
    <div class="mg-cel-ic">${esc2(award.icon||'🏆')}</div>
    <div class="h1 mt-2">${esc2(award.title||'Monatsziel erreicht')}</div>
    <div class="meta mt-2">${esc2(award.desc||'')}</div>
    <div class="mt-3"><span class="pill red mg-xp">+${fmtNum(bonusXp||0)} XP</span></div>
    <button class="btn block mt-4" onclick="closeModal()">Weiter so</button>
  </div>`);}
// (Der frühere Coach-Einstieg ins Monatsziel stand hier: er setzte COACH_CONTEXT/VIEW_USER ohne Nav-Aufbau
//  und ohne Rückweg. Ersetzt durch coachMonthlyGoal in coach.js, das den Athleten explizit übergibt.)

// ===== TOUR: Ziel-Selektoren des Analyse-Tabs (TOUR_DEFS wohnt in account.js; hier nur die Zielpunkte) =====
// TOUR_DEFS.tracker zeigt seit 2.1.0 selbst auf #anaSeg / #chart-sleep – die frühere Laufzeit-Korrektur
// im Analyse-Tab war damit wirkungslos und ist entfallen.
// Nach dem Malen: erstes vorhandenes Ziel-Diagramm als Spotlight, sonst die Kacheln/der Hero
function anaTourTarget(){if(typeof TOUR_DEFS==='undefined'||!TOUR_DEFS||!Array.isArray(TOUR_DEFS.tracker)||!TOUR_DEFS.tracker[1])return;
  const s=TOUR_DEFS.tracker[1];if(!/^#(chart-sleep|chart-steps|chart-water|anaTiles|anaHero|anaBody)$/.test(s.sel||''))return; // fremde Anpassung respektieren
  const id=['chart-sleep','chart-steps','chart-water','anaTiles','anaHero'].find(i=>document.getElementById(i));
  if(id){s.sel='#'+id;s.pos='above';}}
