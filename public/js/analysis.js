// BE INEVITABLE – Frontend, Teil «analysis.js» (WP5 Analyse). Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js. Nutzt die WP0-Helfer (icon, ring, metricChart/lineChart/
// lineChart2, openSheet, confirmSheet, toast, skeleton, emptyState, showFieldErr, fmtNum/fmtDate/pl, coachView).
// Fremde Funktionen aus parallelen Paketen (openCheckinSheet, weightVerdict, invalidateView, openExHistory …) werden
// defensiv aufgerufen (typeof-Check + Fallback), damit vor der Integration nichts bricht.
// ===== ANALYSE: Körper + Training + Woche =====

// --- Daten-Cache pro betrachtetem Nutzer (~60 s): synchron malen, im Hintergrund auffrischen ---
const ANA_TTL=60000;
function anaCache(){const c=renderTracker.cache;if(!c||c.uid!==VIEW_USER)renderTracker.cache={uid:VIEW_USER};return renderTracker.cache;}
function anaCached(key){const e=anaCache()[key];return e?e.data:null;}
function anaEntry(key){return anaCache()[key]||null;}
function anaStore(key,data){anaCache()[key]={data,ts:Date.now()};return data;}
// anaInvalidate(key?) – markiert als veraltet (Daten bleiben für den sofortigen Anstrich erhalten) + leert den View-Cache des Tabs
// 'checkins' zieht die vollständige Liste ('checkins_all', „Alle anzeigen") mit – beide zeigen dieselben Zeilen.
function anaInvalidate(key){const c=renderTracker.cache;
  if(c){if(key){if(c[key])c[key].ts=0;if(key==='checkins'&&c.checkins_all)c.checkins_all.ts=0;}else Object.keys(c).forEach(k=>{if(c[k]&&typeof c[k]==='object')c[k].ts=0;});}
  if(typeof invalidateView==='function')try{invalidateView('tracker');}catch(e){}}
async function anaFetch(key,path,pick){const r=await API.get(path);if(r.status!==200)return anaCached(key);return anaStore(key,pick?pick(r.data):r.data);}
function anaStale(key,o){const e=anaEntry(key);if(!e)return true;const age=Date.now()-e.ts;
  if(o&&o.refresh)return true;if(age>=ANA_TTL)return true;if(o&&o.entry&&age>5000)return true;return false;}
// Sichtbarer Bereich im Hintergrund auffrischen (nur neu malen, wenn sich Daten geändert haben)
function anaRefreshIfVisible(){if(!document.getElementById('anaBody'))return;
  if(renderTracker.tab==='training')drawAnaTraining({refresh:true});
  else if(renderTracker.tab==='woche')drawAnaWeek({refresh:true});
  else drawAnaKoerper({refresh:true});}
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
// Wirksames Schlafziel. Steht im Profil keines, leitet der SERVER es aus dem eigenen 14-Tage-Median ab
// (sleepGoalOf, geklemmt auf 7–8 h) und liefert es mit: /api/readiness (sleepGoal), /api/home
// (readiness.sleepGoal), /api/week (health.sleepGoal). Die Oberfläche rechnete hier stur mit 8 h – deshalb
// stand „Ziel getroffen" im Wochenrückblick neben „noch 1,0 h bis zum Ziel" in der Kachel. Ein gesetztes
// Profilziel gewinnt immer (der Server tut dasselbe); ohne jede Serverangabe bleibt der App-Standard 8.
function anaSleepGoal(p){const set=+(p&&p.sleep_goal);if(set>0)return set;
  const num=v=>{v=Number(v);return (v>0&&isFinite(v))?v:null;};
  const R=anaCached('readiness');if(R&&num(R.sleepGoal))return num(R.sleepGoal);
  // Home-Aggregat nur im eigenen Konto: HOME_DATA kann im Coach-Blick noch dem vorigen Athleten gehören.
  try{if(VIEW_USER===ME.id&&typeof HOME_DATA!=='undefined'&&HOME_DATA&&HOME_DATA.readiness&&num(HOME_DATA.readiness.sleepGoal))return num(HOME_DATA.readiness.sleepGoal);}catch(e){}
  // Wochenrückblick (Cache-Schlüssel 'week:<Montag>'): dieselbe Ableitung, bezogen auf das Wochenende.
  try{const c=renderTracker.cache;if(c)for(const k of Object.keys(c)){if(k.indexOf('week:')!==0)continue;const w=c[k]&&c[k].data;if(w&&w.health&&num(w.health.sleepGoal))return num(w.health.sleepGoal);}}catch(e){}
  return 8;}
// Ziele des betrachteten Nutzers (individuell, sonst Standard)
function anaGoals(){const p=(VIEW_USER===ME.id)?ME:(VIEW_USER_PROFILE||ME||{});
  return {sleep:anaSleepGoal(p),steps:+p.steps_goal||10000,water:+p.water_goal||3,goal:p.goal||ME.goal||'health',start:+p.start_weight||null,days:+p.days_per_week||3};}

// --- Tab-Einstieg: Segmente Körper / Training / Woche (Titel trägt der Header) ---
function renderTracker(v,opts){opts=opts||{};if(typeof opts==='string')opts={tab:opts};
  if(opts.tab)renderTracker.tab=opts.tab;
  const t=renderTracker.tab==='training'?'training':renderTracker.tab==='woche'?'woche':'koerper';
  // go() hat den View-Cache bereits gemalt -> DOM behalten, nur Daten auffrischen (kein Flackern).
  // Die Prüfung muss ALLE drei Segmente kennen, sonst wird das Gerüst beim Zurückkehren neu gebaut.
  const reuse=!!(opts.cached&&v.querySelector('#anaBody')&&v.querySelector('#anaSeg')&&v.querySelector(`#an_${t==='training'?'t':t==='woche'?'w':'k'}.on`));
  if(!reuse)v.innerHTML=`<div class="page on${opts.cached?'':' first'}">
    <div class="seg" id="anaSeg" data-tour="anaSeg">
      <button id="an_k" onclick="anaTab('koerper')">Körper</button>
      <button id="an_t" onclick="anaTab('training')">Training</button>
      <button id="an_w" onclick="anaTab('woche')">Woche</button>
    </div>
    <div id="anaBody" data-tour="trackerBody"></div></div>`;
  anaTab(t,{entry:true,keep:reuse});
  if(typeof maybeStartTabTour==='function')try{maybeStartTabTour('tracker',{deferred:true});}catch(e){}}
// Der Woche-Knopf wird defensiv behandelt (altes View-Cache-HTML kennt ihn noch nicht) –
// Körper und Training bleiben Pflicht, ohne sie ist das Gerüst nicht das erwartete.
function anaTab(t,o){t=(t==='training')?'training':(t==='woche')?'woche':'koerper';renderTracker.tab=t;
  const k=document.getElementById('an_k'),tr=document.getElementById('an_t'),wo=document.getElementById('an_w');if(!k||!tr)return;
  k.classList.toggle('on',t==='koerper');tr.classList.toggle('on',t==='training');if(wo)wo.classList.toggle('on',t==='woche');
  if(t==='training')drawAnaTraining(o);else if(t==='woche')drawAnaWeek(o);else drawAnaKoerper(o);}

// Ohne Athleten-Kontext (Coach kommt über go('athletes') hierher, VIEW_USER=null) ehrlich bleiben:
// nicht „Verbindung prüfen" zeigen, sondern den fehlenden Athleten benennen.
function anaNoAthleteHTML(){return emptyState({icon:'users',title:'Kein Athlet ausgewählt',
  text:'Wähle zuerst einen Athleten aus, um seine Entwicklung zu sehen.',
  btn:{label:'Zu den Athleten',onclick:"go('athletes')"}});}

// ===== KÖRPER-SEGMENT: Status-Story + Kacheln + Diagramme + Maße/Fotos + Historie + Health =====
// Ausgewählte Kennzahl der Kachelreihe – bestimmt, welches EINE Diagramm darunter steht.
let ANA_METRIC='weight',ANA_TILES=['weight'];
// Check-ins nur im Fenster, das dieses Segment zeichnet: Durchschnitte über 7/14/30 Einträge, die Kurve
// der gewählten Kennzahl über 30, die Gewichtskurve über bis zu 90 Einträge, die Historie über 7 Zeilen.
// Bisher kam bei jedem Öffnen die komplette Historie (nach drei Jahren 1.100 Zeilen, 316 KB) für ein
// Diagramm, das intern ohnehin auf 90 kappt. 120 Kalendertage / 120 Zeilen decken jede dieser Stellen;
// die Gewichtskurve reicht damit höchstens vier Monate zurück (statt 90 Wiege-Einträge, egal wie alt) –
// der Kartenkopf nennt weiterhin ehrlich, seit wann sie gilt. „Alle anzeigen" holt die volle Liste eigens
// (anaCheckinsAll). ?days=/?limit= sind für den Server optional: ohne sie kommt wie bisher alles, und
// jede Stelle hier rechnet dann mit derselben Liste wie vorher – nur die Übertragung bleibt dann groß.
const ANA_CI_DAYS=120;
function anaCheckinPath(){return '/checkins/'+VIEW_USER+'?days='+ANA_CI_DAYS+'&limit='+ANA_CI_DAYS;}
async function drawAnaKoerper(o){o=o||{};const box=document.getElementById('anaBody');if(!box)return;
  if(!VIEW_USER)return void(box.innerHTML=anaNoAthleteHTML());
  const have=anaEntry('checkins');
  if(have)anaPaintKoerper(have.data);
  else if(!o.keep||!box.children.length)box.innerHTML=`<div class="skeleton lg"></div><div class="tiles mt-3"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>${skeleton(2,'lg')}`;
  // Die Bereitschaft (Kachel + 14-Tage-Verlauf) hängt am selben Zeichner: ~1 KB, gemeinsam mit den
  // Check-ins geholt und im selben 60-s-Takt aufgefrischt. Fehlt die Route (älterer Server), bleibt die
  // Kachel schlicht weg – anaFetch liefert dann null.
  if(have&&!anaStale('checkins',o)&&!anaStale('readiness',o))return;
  const snap=()=>JSON.stringify([anaCached('checkins'),anaCached('readiness')]);
  const before=snap();
  const [data]=await Promise.all([anaFetch('checkins',anaCheckinPath(),d=>d.checkins||[]),anaFetch('readiness','/readiness/'+VIEW_USER)]);
  if(!document.getElementById('anaBody')||renderTracker.tab!=='koerper')return;
  if(data==null){if(!have)box.innerHTML=emptyState({icon:'alertTriangle',title:'Daten konnten nicht geladen werden',text:'Prüfe deine Verbindung und versuch es noch einmal.',btn:{label:'Erneut versuchen',onclick:"drawAnaKoerper({refresh:true})"}});return;}
  // Leeres Fenster heißt nicht „keine Check-ins": wer vier Monate pausiert hat, hat welche – nur ältere.
  // Einmal ohne Fenster nachfassen, sonst stünde (auch für den Coach) fälschlich der Leerzustand da.
  if(!data.length&&!drawAnaKoerper.widened){drawAnaKoerper.widened=VIEW_USER;const all=await anaCheckinsAll();
    if(all&&all.length){const e=anaEntry('checkins');if(e)e.data=all;anaPaintKoerper(all);return;}}
  if(drawAnaKoerper.widened!==VIEW_USER)drawAnaKoerper.widened=null;
  if(before!==snap())anaPaintKoerper(data);}

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
  // Werte aus der Uhr (Apple Health). Sie erscheinen nur, wenn wirklich welche da sind –
  // ohne verbundene Uhr bleibt die Ansicht so schlank wie vorher.
  const avg={aSleep:avgOf('sleep'),aSteps:avgOf('steps'),aWater:avgOf('water'),
    aBurn:avgOf('active_kcal'),aRhr:avgOf('resting_hr',14),aHrv:avgOf('hrv',14)};
  const tr=anaWeekTrend(ws);
  h+=anaHeroHTML(checkins,ws,g,avg,tr,canEdit);
  // Kacheln SIND die Diagramm-Auswahl: angetippt wechselt darunter EIN Diagramm.
  // Vorher standen bis zu sieben Diagramme untereinander – die Seite war dreimal so lang,
  // und man hat trotzdem immer nur eines angesehen.
  const tile=(key,label,val,unit,t)=>`<button class="tile tap${ANA_METRIC===key?' on':''}" aria-pressed="${ANA_METRIC===key?'true':'false'}" onclick="anaMetric('${key}')" aria-label="${label} – Diagramm anzeigen"><div class="v">${val}${unit?`<em> ${unit}</em>`:''}</div><div class="l">${label}</div><div class="trend ${t.cls}">${t.html}</div></button>`;
  const goalTrend=(v,goal,unit,d)=>v==null?{cls:'',html:'<span class="muted-2">noch keine Werte</span>'}:v>=goal?{cls:'up',html:icon('check',14)+' Ziel erreicht'}:{cls:'amber',html:`Ziel ${fmtNum(goal,d)}${unit?' '+unit:''} · −${fmtNum(goal-v,d)}${unit?' '+unit:''}`};
  let wT={cls:'',html:'<span class="muted-2">Trend ab 2 Einträgen</span>'};
  if(tr){const v=Math.round(tr.perWeek*10)/10;wT={cls:anaTrendCls(v,g.goal,true),html:`${icon(v>0.05?'trendUp':v<-0.05?'trendDown':'trendFlat',14)} ${v>0?'+':''}${fmtNum(v,1)} kg/Woche`};}
  // Nur Kacheln zeigen, für die es Werte gibt (Uhr-Werte fehlen ohne verbundene Uhr komplett)
  const has=key=>checkins.some(c=>c[key]!=null&&+c[key]>0);
  // Bereitschaft als Kachel im selben Wechsler (SPEC-23 A: „in der Analyse als Kachel mit Verlauf") –
  // nur, wenn es eine Zahl gibt. Ohne Uhr-Werte (needsHealth) steht unten ohnehin „Gesundheitsdaten verbinden".
  // Seit A-I.1 kann die Bereitschaft `score:null` liefern, obwohl Werte da sind (z. B. nur Trainings-
  // last, kein Erholungsteil für heute). Die Kachel verschwindet dann NICHT – sie sagt „Noch keine
  // Daten". Sonst fehlt die Bereitschaft ausgerechnet an dem Tag, an dem man wissen will, warum.
  // Ohne jeden Uhr- oder Schlafwert der letzten sieben Tage (needsHealth) bleibt sie weiterhin weg;
  // dort steht unten „Gesundheitsdaten verbinden".
  const R=anaCached('readiness');const hasR=!!(R&&(R.score!=null||!R.needsHealth));
  ANA_TILES=['weight'].concat(hasR?['readiness']:[]).concat(['sleep','steps','water','active_kcal','resting_hr','hrv'].filter(has));
  if(!ANA_TILES.includes(ANA_METRIC))ANA_METRIC='weight';
  const tileFor={
    weight:()=>tile('weight','Gewicht',ws[0]?fmtNum(ws[0].weight,1):'–',ws[0]?'kg':'',wT),
    // Ton wie auf der Startseite (grün/amber/rot); eine Zahl aus nur EINER Quelle (thin) heißt „geschätzt".
    readiness:()=>{const solo=(typeof _readySolo==='function')?_readySolo(R):'';
      if(R.score==null)return tile('readiness','Bereitschaft','–','',{cls:'',html:`<span class="muted-2">${esc2(R.label||'Noch keine Daten')}</span>`});
      const cls=R.tone==='green'?'up':R.tone==='amber'?'amber':R.tone==='red'?'down':'';
      return tile('readiness','Bereitschaft',fmtNum(R.score),'',{cls,html:esc2(R.label||'')+(solo?' · geschätzt':'')});},
    sleep:()=>tile('sleep','Ø Schlaf',avg.aSleep!=null?fmtNum(avg.aSleep,1):'–',avg.aSleep!=null?'h':'',goalTrend(avg.aSleep,g.sleep,'h',1)),
    steps:()=>tile('steps','Ø Schritte',avg.aSteps!=null?fmtNum(Math.round(avg.aSteps)):'–','',goalTrend(avg.aSteps,g.steps,'',0)),
    water:()=>tile('water','Ø Wasser',avg.aWater!=null?fmtNum(avg.aWater,1):'–',avg.aWater!=null?'L':'',goalTrend(avg.aWater,g.water,'L',1)),
    active_kcal:()=>tile('active_kcal','Ø Verbrauch',fmtNum(Math.round(avg.aBurn||0)),'kcal',{cls:'',html:'<span class="muted-2">aktiv, aus der Uhr</span>'}),
    resting_hr:()=>tile('resting_hr','Ruhepuls',fmtNum(Math.round(avg.aRhr||0)),'bpm',{cls:'',html:'<span class="muted-2">Ø 14 Tage</span>'}),
    hrv:()=>tile('hrv','HRV',fmtNum(Math.round(avg.aHrv||0)),'ms',{cls:'',html:'<span class="muted-2">Ø 14 Tage · Erholung</span>'}),
  };
  h+=`<div class="tiles" id="anaTiles">${ANA_TILES.map(k=>tileFor[k]()).join('')}</div>`;
  if(checkins.length<2)h+=`<div class="note mb-4">Mehr Auswertungen erscheinen, sobald du ein paar Tage Check-ins gemacht hast.</div>`;
  h+=`<div id="anaChartBox">${anaChartHTML(checkins,g,avg)}</div>`;
  h+=anaPhysHTML();
  h+=`<div class="section-label">Check-in Historie${canEdit?`<span class="sl-r"><button class="btn sm sec" onclick="anaOpenCheckin()">${icon('plus',14)} Nachtragen</button></span>`:''}</div><div id="histlist" class="ana-hist"></div>`;
  if(canEdit)h+=`<button class="btn sec mt-4" onclick="openIntegrations()">${icon('apple',18)} Gesundheitsdaten verbinden</button>`;
  box.innerHTML=h;loadHist(checkins);anaTourTarget();}

// Das eine Diagramm zur gewählten Kachel (WP0-Engine: schöne Ticks, Ziel-Label, 7-Tage-Schnitt).
function anaChartHTML(checkins,g,avg){
  const series=(key,n)=>checkins.filter(c=>c[key]!=null&&+c[key]>0).slice(0,n||30).reverse().map(c=>({date:c.date,value:+c[key]}));
  const card=(title,v,svg,extra)=>`<div class="chart-card" id="anaChart"><div class="ch-h"><div class="t">${title}</div><div class="v">${v}</div></div>${svg}${extra||''}</div>`;
  const leg=`<div class="caption mt-2">Dicke Linie = 7-Tage-Schnitt · dünne Linie = Tageswerte · gestrichelt = Ziel</div>`;
  const few=`<div class="chart-card" id="anaChart"><div class="caption center">Zu wenig Daten – ab 2 Einträgen erscheint hier die Kurve.</div></div>`;
  // Bereitschaft: der 14-Tage-Verlauf aus GET /readiness (derselbe wie im Sheet der Startseite), darunter
  // der Weg zu den Teilwerten. openReadiness gehört home.js – ohne sie fehlt nur der Knopf, nicht die Kurve.
  if(ANA_METRIC==='readiness'){const R=anaCached('readiness')||{};
    const hist=(R.history||[]).filter(x=>x&&x.date&&x.score!=null).map(x=>({date:x.date,value:+x.score}));
    const solo=(typeof _readySolo==='function')?_readySolo(R):'';
    const txt=solo?`Geschätzt aus ${solo} – für eine belastbare Einschätzung fehlen noch Werte.`:(R.headline||'');
    const extra=`<div class="between mt-2"><span class="caption">${esc2(txt)}</span>${typeof openReadiness==='function'?`<button class="btn sm sec fixed" onclick="openReadiness()">Details</button>`:''}</div>`;
    // Ohne heutige Zahl (score:null) nennt die Kopfzeile den Grund statt eines Strichs; der Verlauf
    // der Vortage bleibt stehen, er ist ja echt.
    const head=R.score==null?esc2(R.label||'Noch keine Daten'):`${fmtNum(R.score)}${R.label?' · '+esc2(R.label):''}`;
    if(hist.length<2)return card('Bereitschaft',head,'<div class="caption mt-2 mb-2">Ab zwei Tagen mit Werten erscheint hier der Verlauf.</div>',extra);
    return card('Bereitschaft',head,metricChart(hist,'Punkte',null,null,{domain:[0,100],step:25}),extra);}
  // Gewicht hat eine eigene Karte: Lücken, Trendlinie, Kopfzeile nur über den letzten Abschnitt (D33).
  if(ANA_METRIC==='weight')return anaWeightCard(checkins);
  const defs={
    sleep:{t:'Schlaf',u:'h',goal:g.sleep,head:()=>`Ø ${fmtNum(avg.aSleep,1)} h · Ziel ${fmtNum(g.sleep,1)} h`,gl:()=>'Ziel '+fmtNum(g.sleep,1)+' h'},
    steps:{t:'Schritte',u:'',goal:g.steps,head:()=>`Ø ${fmtNum(Math.round(avg.aSteps))}/Tag · Ziel ${fmtNum(g.steps)}`,gl:()=>'Ziel '+fmtNum(g.steps)},
    water:{t:'Wasser',u:'L',goal:g.water,head:()=>`Ø ${fmtNum(avg.aWater,1)} L/Tag · Ziel ${fmtNum(g.water,1)} L`,gl:()=>'Ziel '+fmtNum(g.water,1)+' L'},
    active_kcal:{t:'Aktive Kalorien',u:'kcal',goal:null,head:()=>`Ø ${fmtNum(Math.round(avg.aBurn))} kcal/Tag`},
    resting_hr:{t:'Ruhepuls',u:'bpm',goal:null,head:()=>`Ø ${fmtNum(Math.round(avg.aRhr))} bpm`},
    hrv:{t:'HRV',u:'ms',goal:null,head:()=>`Ø ${fmtNum(Math.round(avg.aHrv))} ms`},
  }[ANA_METRIC];
  if(!defs)return '';
  const rows=series(ANA_METRIC);
  if(rows.length<2)return few;
  return card(defs.t,defs.head(),metricChart(rows,defs.u,defs.goal,defs.gl?defs.gl():null,{avg:7}),leg);}
// ===== GEWICHTSKURVE: Lücken, Trendlinie, ehrliche Kopfzeile (RECHEN-REVIEW D33, Befund B22) =====
// Vorher zog die Kurve eine gerade Strecke über jede Pause – 53 Tage ohne eine einzige Wiegung sahen
// aus wie ein sauberer Aufbau – und die Kopfzeile rechnete „letzter Punkt minus erster Punkt" über die
// ganze Reihe: „+15,4 kg seit 14. Juni", während die Kachel daneben aus denselben Daten „+0,1 kg/Woche"
// meldete. Drei Dinge stellen das richtig:
//   · Liegen zwischen zwei Wiegungen mehr als ANA_GAP_D Tage, bricht die Linie ab (neues „M" im Pfad)
//     statt quer durch die Lücke zu ziehen.
//   · Über den Rohpunkten liegt eine geglättete Trendlinie. Die Tageswaage schwankt um Wasser und
//     Darminhalt (σ ≈ 0,7 kg); ungeglättet stimmt bei einer Wochenbetrachtung in fast jeder dritten
//     Woche schon das Vorzeichen nicht (D33).
//   · Die Kopfzeile gilt nur für den letzten zusammenhängenden Abschnitt und nennt beide Enden geglättet.
const ANA_GAP_D=7;   // mehr Abstand als das = Lücke
const ANA_EMA_N=7;   // Glättungsfenster der Trendlinie in Tagen

// Punkte [{t,v}] in zusammenhängende Abschnitte teilen
function anaSegments(pts){const out=[];let cur=[];
  (pts||[]).forEach((p,i)=>{if(i&&(p.t-pts[i-1].t)/864e5>ANA_GAP_D){out.push(cur);cur=[];}cur.push(p);});
  if(cur.length)out.push(cur);return out;}
// Exponentiell geglätteter Schnitt über ANA_EMA_N Tage (α = 2/(N+1) je Tag). Weil nicht jeden Tag
// gewogen wird, zählt der Abstand in Tagen mit (1-(1-α)^Tage) – zwei Wiegungen im Abstand von vier
// Tagen ziehen den Trend stärker nach als zwei an aufeinanderfolgenden Tagen. Startwert ist der
// Mittelwert der ersten drei Wiegungen des Abschnitts: ein einzelner Startwert (der genauso
// verrauscht ist wie jeder andere) würde den Abschnitt sonst dauerhaft verziehen.
function anaEma(seg){const K=2/(ANA_EMA_N+1),n=Math.min(3,seg.length);
  let e=seg.slice(0,n).reduce((s,p)=>s+p.v,0)/n;
  return seg.map((p,i)=>{if(i){const d=Math.max(1,Math.round((p.t-seg[i-1].t)/864e5));e+=(1-Math.pow(1-K,d))*(p.v-e);}return {t:p.t,v:e};});}
// Ein Pfad aus mehreren Abschnitten: jeder beginnt mit M, dazwischen bleibt die Lücke leer
function anaPathGapped(segs,X,Y){return (segs||[]).filter(s=>s.length>1)
  .map(s=>s.map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+' '+Y(p.v).toFixed(1)).join(' ')).join(' ');}

function anaWeightCard(checkins){
  const pts=(checkins||[]).filter(c=>c&&+c.weight>0&&c.date).map(c=>({t:Date.parse(c.date+'T00:00'),v:+c.weight,date:c.date}))
    .filter(p=>!isNaN(p.t)&&!isNaN(p.v)).sort((a,b)=>a.t-b.t).slice(-90);
  const wrap=(head,body,cap)=>`<div class="chart-card" id="anaChart"><div class="ch-h"><div class="t">Gewicht</div><div class="v">${head}</div></div>${body}${cap?`<div class="caption mt-2">${cap}</div>`:''}</div>`;
  if(pts.length<2)return `<div class="chart-card" id="anaChart"><div class="caption center">Zu wenig Daten – ab 2 Einträgen erscheint hier die Kurve.</div></div>`;
  const segs=anaSegments(pts),last=segs[segs.length-1],prev=segs.length>1?segs[segs.length-2]:null;
  const gapDays=prev?Math.round((last[0].t-prev[prev.length-1].t)/864e5):0;
  // Kopfzeile: geglättete Enden des LETZTEN zusammenhängenden Abschnitts. Ein Abschnitt aus einer
  // einzigen Wiegung hat keine Veränderung – dann steht schlicht der Wert da.
  const ema=anaEma(last),trend=ema[ema.length-1].v,delta=Math.round((trend-ema[0].v)*10)/10;
  const head=last.length<2?`${fmtNum(last[0].v,1)} kg am ${fmtDate(last[0].date)}`
    :`Trend ${fmtNum(trend,1)} kg · ${delta>0?'+':''}${fmtNum(delta,1)} kg seit ${fmtDate(last[0].date)}`;
  let cap=`Punkte = deine Wiegungen · Linie = Trend über ${fmtNum(ANA_EMA_N)} Tage`;
  if(gapDays)cap+=` · zwischen ${fmtDate(prev[prev.length-1].date)} und ${fmtDate(last[0].date)} ${pl(gapDays,'Tag','Tage')} ohne Wiegung – dort ist die Linie unterbrochen`;
  // Die Achsen-Helfer wohnen in home.js (dieselben wie in metricChart). Fehlt einer, zeichnen wir
  // wenigstens den letzten Abschnitt sauber, statt wieder quer durch die Lücke zu ziehen.
  if(typeof _domain!=='function'||typeof _ticks!=='function'||typeof _tickFmt!=='function'||typeof _axisW!=='function'||typeof _chartFS!=='function'||typeof _xLabels!=='function')
    return wrap(head,typeof metricChart==='function'?metricChart(last.map(p=>({date:p.date,value:p.v})),'kg',null,null,{avg:ANA_EMA_N}):'',cap);
  const W=340,H=220,R=12,T=16,B=28,FS=_chartFS();
  // Mindestspanne 2 kg: bei zwei Wiegungen mit 0,3 kg Unterschied spreizte die Achse den Unterschied
  // sonst über die ganze Kartenhöhe – aus 0,3 kg wurde optisch ein Absturz (RATE-25-analysis N1).
  const vals=pts.map(p=>p.v),lo=Math.min(...vals),hi=Math.max(...vals);
  if(hi-lo<2){const c=(hi+lo)/2;vals.push(c-1,c+1);}
  const dom=_domain(vals,null,{}),ticks=_ticks(dom),L=_axisW(ticks,dom.step,{},FS);
  const tMin=pts[0].t,tMax=pts[pts.length-1].t,tRng=(tMax-tMin)||1;
  const X=t=>L+((t-tMin)/tRng)*(W-L-R),Y=v=>T+(1-(v-dom.mn)/((dom.mx-dom.mn)||1))*(H-T-B);
  const grid=ticks.map(v=>{const y=Y(v).toFixed(1);
    return `<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="var(--hairline2)" stroke-width="1"/><text x="${L-6}" y="${(+y+4).toFixed(1)}" text-anchor="end" font-size="${FS}" fill="var(--ink2)">${_tickFmt(v,dom.step,{})}</text>`;}).join('');
  const rawLine=`<path d="${anaPathGapped(segs,X,Y)}" fill="none" stroke="var(--ink3)" stroke-width="1" stroke-linejoin="round" opacity=".7"/>`;
  const trendLine=`<path d="${anaPathGapped(segs.map(anaEma),X,Y)}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  const rad=pts.length>30?2:3;
  const dots=pts.map(p=>`<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${rad}" fill="var(--ink3)"/>`).join('');
  // Diagramme sind sonst aria-hidden; hier steht die Aussage wenigstens als Text am Bild.
  const alt=`Gewichtsverlauf, ${pl(pts.length,'Wiegung','Wiegungen')} seit ${fmtDate(pts[0].date)}. ${head}.`;
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc2(alt)}">
    ${grid}<line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="var(--hairline2)" stroke-width="1"/>
    ${rawLine}${trendLine}${dots}${_xLabels(pts,X,H,FS)}
  </svg>`;
  return wrap(head,svg,cap);}

// Kachel angetippt: nur die Kachelreihe und das Diagramm neu zeichnen (kein Sprung, kein Neuladen)
function anaMetric(key){
  if(!ANA_TILES.includes(key))return;
  ANA_METRIC=key;
  const data=anaCached('checkins');
  if(data)anaPaintKoerper(data);}

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
      <button class="qcard" onclick="openPhotos()">${icon('camera',24)}<div class="t">Fortschrittsfotos</div><div class="d">Dein Verlauf in Bildern</div></button>
    </div>`;return h;}

// --- Check-in Historie: letzte 7 Zeilen, antippbar (Bearbeiten/Nachtragen), „Mehr anzeigen" in Stufen ---
// Die vollständige Liste (ohne Fenster) holt erst der Tipp auf „Mehr anzeigen" – eigener Cache-Schlüssel,
// damit das Segment weiterhin mit dem kleinen Fenster (anaCheckinPath) auskommt.
const ANA_HIST_STEP=50;
async function anaCheckinsAll(){const c=anaEntry('checkins_all');if(c&&!anaStale('checkins_all'))return c.data;
  return anaFetch('checkins_all','/checkins/'+VIEW_USER,d=>d.checkins||[]);}
async function loadHist(checkins){const el=document.getElementById('histlist');if(!el)return;
  let h=checkins||anaCached('checkins');
  if(!h){el.innerHTML=skeleton(2,'sm');h=(await anaFetch('checkins',anaCheckinPath(),d=>d.checkins||[]))||[];if(!document.getElementById('histlist'))return;}
  // Aufgeklappt: die volle Historie (nachgeladen), sonst das Fenster des Segments.
  const n=+loadHist.shown||0;
  if(n>7){const all=await anaCheckinsAll();if(!document.getElementById('histlist'))return;if(all&&all.length>=h.length)h=all;}
  h=h.slice().sort((a,b)=>a.date<b.date?1:-1);
  if(!h.length){el.innerHTML=emptyState({icon:'calendar',title:'Noch keine Einträge',text:'Dein erster Check-in erscheint hier.'});return;}
  const show=Math.max(7,Math.min(n||7,h.length));loadHist.shown=show>7?show:0;
  // Solange nur das Fenster geladen ist, ist die Gesamtzahl unbekannt – dann steht keine Zahl am Knopf.
  el.innerHTML=`<div class="rows" id="histrows">${h.slice(0,show).map(anaHistRow).join('')}</div>`+loadHist.btn(show,h.length,n>7);}
// Der Knopf unter der Liste: „50 weitere anzeigen (noch N)" bzw. „Weniger anzeigen".
loadHist.btn=function(shown,total,exact){if(total<=7)return '';
  const rest=total-shown;
  return `<div class="cluster mt-3" id="histmore">${(rest>0||!exact)?`<button class="btn sm sec" onclick="loadHistMore()">${exact?fmtNum(Math.min(ANA_HIST_STEP,rest))+' weitere anzeigen (noch '+fmtNum(rest)+')':'Mehr anzeigen'}</button>`:''}${shown>7?`<button class="btn sm sec" onclick="loadHist.shown=0;loadHist()">Weniger anzeigen</button>`:''}</div>`;};
// Nächste Stufe anhängen: insertAdjacentHTML statt innerHTML, damit die stehenden Zeilen nicht neu geparst
// werden. Vorher schrieb „Alle anzeigen" bis zu 1.100 Zeilen (196 KB HTML, ~6.600 Knoten) in EINEM Stück.
async function loadHistMore(){const rows=document.getElementById('histrows');if(!rows)return;
  const btn=document.querySelector('#histmore .btn');if(btn)btn.disabled=true;
  const all=(await anaCheckinsAll())||anaCached('checkins')||[];
  if(!document.getElementById('histrows'))return;
  const h=all.slice().sort((a,b)=>a.date<b.date?1:-1);
  const from=rows.children.length,to=Math.min(h.length,from+ANA_HIST_STEP);
  rows.insertAdjacentHTML('beforeend',h.slice(from,to).map(anaHistRow).join(''));
  loadHist.shown=to;
  const more=document.getElementById('histmore');if(more)more.outerHTML=loadHist.btn(to,h.length,true);}
// Zeile: links Datum + die Nebenwerte klein darunter, rechts das Gewicht (bleibt einzeilig, auch auf schmalen Geräten)
function anaHistRow(c){const parts=[];
  if(c.sleep!=null)parts.push(fmtNum(c.sleep,1)+' h Schlaf');
  if(c.steps!=null)parts.push(fmtNum(Math.round(c.steps))+' Schritte');
  if(c.active_kcal!=null)parts.push(fmtNum(Math.round(c.active_kcal))+' kcal aktiv');
  if(c.water!=null)parts.push(fmtNum(c.water,1)+' L');
  const tap=!coachView();
  // Seit die Uhr mitliefert, passen nicht mehr alle Werte in eine Zeile – drei reichen, den Rest
  // zeigt das Sheet. Vorher wurde stumpf abgeschnitten und der letzte Wert war nie zu sehen.
  // Der Rest wird benannt: ein nacktes „· +1" am Zeilenende liest sich wie eine abgeschnittene Zahl.
  // Kurz gehalten, weil die Zeile einzeilig bleibt und sonst selbst wieder abgeschnitten würde.
  const more=parts.length-3;
  const sub=parts.slice(0,3).join(' · ')+(more>0?' · +'+more+(more===1?' Wert':' Werte'):'');
  return `<div class="row${tap?' tap':''}"${tap?` role="button" tabindex="0" onclick="anaOpenCheckin('${c.date}')"`:''}><div class="rl">${fmtDate(c.date,{weekday:'short'})}<small>${sub||'nur Gewicht'}</small>${c.coach_notes?`<small class="tone-red">Coach: ${esc2(c.coach_notes)}</small>`:''}</div><div class="rr">${c.weight!=null?fmtNum(c.weight,1)+' kg':'–'}</div></div>`;}
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
  const snap=()=>JSON.stringify(keys.concat(['setlogs']).map(anaCached));
  const before=snap();
  const [a,ins,mg]=await Promise.all([
    anaFetch('analytics','/analytics/'+VIEW_USER),
    anaFetch('insights','/insights/'+VIEW_USER),
    anaFetch('monthly','/monthly/'+VIEW_USER),
    anaFetch('cardio','/cardio/'+VIEW_USER,d=>d.cardio||[])]);
  if(ins)checkNewAchievements(ins); // feiert neue Erfolge (nur eigenes Athletenkonto)
  if(mg&&mg.justClaimed&&mg.award&&VIEW_USER===ME.id)setTimeout(()=>celebrateMonthly(mg.award,mg.bonusXp),600);
  // Sätze je Muskelgruppe (D17): solange die Analyse-Antwort nur Tonnage kennt, zählen wir die Sätze
  // aus dem Satzprotokoll. Das ist eine zusätzliche Anfrage – deshalb nur dann, wenn sie etwas bringt
  // (Trainingsdaten vorhanden, Server liefert die Zahl nicht selbst) und nur im 60-s-Takt der anderen.
  if(a&&a.totals&&a.totals.totalSets&&!anaMuscleServerSets(a)&&anaStale('setlogs',o))await anaFetch('setlogs','/logs/'+VIEW_USER);
  if(!document.getElementById('anaBody')||renderTracker.tab!=='training')return;
  if(a==null){if(!have)b.innerHTML=emptyState({icon:'alertTriangle',title:'Daten konnten nicht geladen werden',text:'Prüfe deine Verbindung und versuch es noch einmal.',btn:{label:'Erneut versuchen',onclick:"drawAnaTraining({refresh:true})"}});return;}
  if(before!==snap())anaPaintTraining();}

// Wochenvergleich: aus /analytics.week (BE 2.1), sonst /insights.week, sonst aus den Wochen-Buckets
function anaWeek(a,INS){let src=(a&&a.week)||(INS&&INS.week)||null;let tw=src?src.thisWeek:null,lw=src?src.lastWeek:null;
  if(!tw&&a&&a.weeks){const mon=anaMonday(today()),prev=anaAddDays(mon,-7);tw=a.weeks.find(w=>w.week===mon);lw=a.weeks.find(w=>w.week===prev);}
  const target=(INS&&INS.weekGoal&&+INS.weekGoal.target)||anaGoals().days||3;
  return {tw:tw||{volume:0,sessions:0},lw:lw||{volume:0,sessions:0},target};}
function anaCardioWeek(list){const mon=anaMonday(today());const wk=(list||[]).filter(c=>c.date>=mon);
  return {n:wk.length,min:wk.reduce((s,c)=>s+(+c.minutes||0),0),km:wk.reduce((s,c)=>s+(+c.distance_km||0),0),kcal:wk.reduce((s,c)=>s+(+c.kcal||0),0)};}
function anaTons(v){const t=(+v||0)/1000;return fmtNum(t,t>=100?0:1)+' t';}

// ===== SÄTZE JE MUSKELGRUPPE (RECHEN-REVIEW D17, Befund B22) =====
// Tonnage als Leitzahl führt in die Irre: Ein Satz Beinpresse mit 100 kg wiegt zehn Klimmzüge auf, und
// eine Körpergewichtsübung steht mit `weight=0` sogar als „0 kg" da. Im Testkonto führte deshalb
// „Quads 66,2 t" die Liste an, während für Lats, Rear Delts, Glutes, Adductors, Calves und Abs – alle
// sechs stehen im Plan – seit Wochen kein einziger Satz protokolliert war. Genau das stand nirgends.
// Gezählt wird darum, was in der Trainingsplanung gezählt wird: harte Sätze je Muskel und Woche.
// Quelle: `muscle` aus den Übungen der Analyse-Antwort, verbunden mit dem Satzprotokoll
// (GET /api/logs, letzte 500 Zeilen). Liefert der Server die Zahl eines Tages selbst (`sets` je
// Muskelgruppe), gewinnt sie – dann entfällt die zusätzliche Anfrage.
// Der Korridor 10–20 Sätze/Woche ist eine Orientierung aus der Trainingslehre, keine exakte Vorgabe;
// die Texte sagen das auch so.
const ANA_MUSC_D=28,ANA_MUSC_LO=10,ANA_MUSC_HI=20,ANA_MUSC_NONE='Ohne Muskelgruppe';
function anaMuscleServerSets(a){const m=(a&&a.muscles)||[];return m.length>0&&m.every(x=>x&&x.sets!=null);}
// {rows:[{muscle,sets,vol,perWeek}], days, partial, src} – oder null, wenn die Sätze nicht zählbar sind
function anaMuscleStats(a){
  const exs=(a&&a.exercises)||[];
  const musOf={};exs.forEach(e=>{if(e&&e.id!=null)musOf[e.id]=String(e.muscle||'').trim();});
  // „Bekannt" ist jeder Muskel, der trainiert wurde ODER im Plan steht – nur so fällt auf, dass für
  // eine geplante Gruppe seit Wochen nichts eingetragen ist. PLAN gehört einem anderen Paket und kann
  // fehlen; dann bleiben die Muskeln aus dem Verlauf.
  const known=new Set();
  exs.forEach(e=>{const m=String(e.muscle||'').trim();if(m)known.add(m);});
  try{((typeof PLAN!=='undefined'&&PLAN&&PLAN.days)||[]).forEach(d=>(d.exercises||[]).forEach(x=>{const m=String((x&&x.muscle)||'').trim();if(m&&!x.deleted)known.add(m);}));}catch(e){}
  const tdy=today();const cnt={},vol={};
  let start=anaAddDays(tdy,-(ANA_MUSC_D-1)),partial=false,src='logs';
  // Ein junges Konto hat kein 28-Tage-Fenster: über Tage vor dem ersten Satz zu mitteln machte aus
  // sechs Sätzen in drei Tagen „1,5 Sätze pro Woche".
  const firstDate=exs.map(e=>e.firstDate).filter(Boolean).sort()[0]||null;
  if(anaMuscleServerSets(a)){src='server';
    const d=+((a.muscles[0]||{}).days)||ANA_MUSC_D;start=anaAddDays(tdy,-(d-1));
    a.muscles.forEach(m=>{const k=String(m.muscle||'').trim();if(!k)return;known.add(k);cnt[k]=+m.sets||0;vol[k]=+m.volume||0;});}
  else{const L=anaCached('setlogs');if(!L||!Array.isArray(L.logs))return null;
    const rows=L.logs.filter(r=>r&&+r.reps>0&&r.date);
    // Das 500er-Fenster des Servers kann kürzer sein als 28 Tage. Dann zählt nur der Zeitraum, der
    // wirklich vollständig vorliegt – sonst stünden die Sätze eines halben Zeitraums gegen volle Wochen.
    if(L.truncated&&rows.length){const oldest=rows.map(r=>r.date).sort()[0];if(oldest>start){start=oldest;partial=true;}}
    // Sätze einer Übung OHNE Muskelgruppe verschwinden nicht still – sie stehen am Ende unter
    // „Ohne Muskelgruppe". Sonst summierte die Liste weniger Sätze, als der Nutzer gemacht hat.
    rows.forEach(r=>{if(r.date<start||r.date>tdy)return;const m=musOf[r.exercise_id];if(m===undefined)return;
      const k=m||ANA_MUSC_NONE;known.add(k);cnt[k]=(cnt[k]||0)+1;vol[k]=(vol[k]||0)+Math.max(0,(+r.weight||0)*(+r.reps||0));});
    if(!cnt[ANA_MUSC_NONE])known.delete(ANA_MUSC_NONE);}
  if(firstDate&&firstDate>start)start=firstDate;
  if(!known.size)return null;
  const days=Math.max(1,anaDayDiff(tdy,start)+1),weeks=Math.max(1,days/7);
  const rows=Array.from(known).map(m=>({muscle:m,none:m===ANA_MUSC_NONE,sets:cnt[m]||0,vol:Math.round(vol[m]||0),perWeek:Math.round((cnt[m]||0)/weeks*10)/10}))
    .sort((x,y)=>(x.none?1:0)-(y.none?1:0)||y.perWeek-x.perWeek||x.muscle.localeCompare(y.muscle));
  return {rows,days,partial,src};}
// Der eine Satz über den Balken: erst die Lücken, dann das Zuwenig, sonst die Bestätigung.
function anaMuscleMsg(st){
  const zero=st.rows.filter(r=>r.sets===0&&!r.none),low=st.rows.filter(r=>r.sets>0&&!r.none&&r.perWeek<ANA_MUSC_LO);
  const list=xs=>xs.slice(0,3).map(r=>esc2(r.muscle)).join(', ')+(xs.length>3?` und ${pl(xs.length-3,'weitere Gruppe','weitere Gruppen')}`:'');
  if(zero.length)return {tone:'amber',txt:`In ${pl(st.days,'Tag','Tagen')} kein einziger Satz für ${list(zero)}.`};
  if(low.length)return {tone:'amber',txt:`Unter der Orientierung von ${fmtNum(ANA_MUSC_LO)} Sätzen je Woche: ${low.slice(0,3).map(r=>esc2(r.muscle)+' '+fmtNum(r.perWeek,1)).join(' · ')}.`};
  return {tone:'green',txt:`Jede Gruppe liegt bei mindestens ${fmtNum(ANA_MUSC_LO)} Sätzen pro Woche.`};}
function anaMuscleHTML(a){
  const st=anaMuscleStats(a);
  // Ohne zählbare Sätze bleibt die Tonnage – dann aber mit dem Etikett, das sie verdient.
  if(!st||!st.rows.length){const ms=(a&&a.muscles)||[];if(!ms.length)return '';
    const max=Math.max(...ms.map(m=>+m.volume||0))||1;
    return `<div class="section-label">Volumen nach Muskelgruppe<span class="sl-r">gesamt</span></div><div class="card">`
      +ms.map(m=>`<div class="ana-muscle"><div class="between meta"><span>${esc2(m.muscle)}</span><span>${anaTons(m.volume)}</span></div><div class="bar"><i style="width:${Math.round((+m.volume||0)/max*100)}%"></i></div></div>`).join('')
      +`<div class="caption mt-3">Volumen = Gewicht × Wiederholungen über die gesamte Zeit. Es sagt nichts darüber, wie viele harte Sätze eine Gruppe bekommen hat, und zählt Übungen mit dem eigenen Körpergewicht mit 0 kg.</div></div>`;}
  const msg=anaMuscleMsg(st);
  const bar=r=>{const w=Math.min(100,Math.round(r.perWeek/ANA_MUSC_HI*100));
    const cls=r.sets===0?'zero':r.perWeek<ANA_MUSC_LO?'low':r.perWeek<=ANA_MUSC_HI?'ok':'high';
    return `<div class="bar corr ${cls}"><i style="width:${w}%"></i></div>`;};
  const row=r=>`<div class="ana-muscle"><div class="between meta"><span>${esc2(r.muscle)}</span><span>${r.sets?fmtNum(r.perWeek,1)+' Sätze/Woche':'0 Sätze'}</span></div>${bar(r)}
    <div class="caption">${r.none?`${pl(r.sets,'Satz','Sätze')} aus Übungen ohne Muskelgruppe – trag sie in der Übung nach, dann zählen sie oben mit.`
      :r.sets?`${pl(r.sets,'Satz','Sätze')} in ${pl(st.days,'Tag','Tagen')}${r.vol?' · '+fmtNum(r.vol)+' kg bewegt':''}`:'nichts eingetragen'}</div></div>`;
  // Gruppen ohne einen einzigen Satz bekommen keinen eigenen Balken (sechs leere Balken untereinander
  // sagen weniger als eine Zeile), aber sie werden vollständig benannt – das ist der eigentliche Befund.
  const zero=st.rows.filter(r=>r.sets===0&&!r.none);
  return `<div class="section-label">Sätze je Muskelgruppe<span class="sl-r">Ø pro Woche · ${pl(st.days,'Tag','Tage')}</span></div>
    <div class="card"><div class="ana-msg ${anaToneCls(msg.tone)}">${icon(msg.tone==='green'?'check':'alertTriangle',16)}<span>${msg.txt}</span></div>
    ${st.rows.filter(r=>r.sets>0).map(row).join('')}
    ${zero.length?`<div class="ana-zero">Ohne einen Satz in diesem Zeitraum: ${zero.map(r=>esc2(r.muscle)).join(', ')}.</div>`:''}
    <div class="caption mt-3">Balkenbreite bis ${fmtNum(ANA_MUSC_HI)} Sätze pro Woche, der Strich steht bei ${fmtNum(ANA_MUSC_LO)}. Zwischen ${fmtNum(ANA_MUSC_LO)} und ${fmtNum(ANA_MUSC_HI)} harten Sätzen je Woche liegt die übliche Orientierung für Muskelaufbau – keine feste Regel, und Aufwärmsätze zählen hier mit.${st.partial?' Gezählt wird der Zeitraum, den dein Satzprotokoll vollständig abdeckt.':''}${st.src==='logs'?' Die bewegten Kilogramm lassen Übungen mit dem eigenen Körpergewicht außen vor.':''}</div></div>`;}
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
    h+=`<div class="chart-card" id="chart-volume"><div class="ch-h"><div class="t">Wochen-Volumen</div><div class="v">${running?'läuft: ':'zuletzt '}${anaTons(cur.volume)}</div></div>${lineChart(a.weeks.map(w=>({date:w.week,value:w.volume/1000})),'t',{partialLast:running,tickFmt:v=>fmtNum(v,Number.isInteger(v)?0:1)+' t'})}<div class="caption mt-2">Gewicht × Wiederholungen pro Woche · Übungen mit dem eigenen Körpergewicht zählen dabei 0 kg${running?' · hohler Punkt = laufende Woche':''}</div></div>`;}
  // Übungen: nach Fortschritt sortiert, Drilldown
  const exs=(a.exercises||[]).map(e=>({...e,gain:Math.round(((+e.lastWeight||0)-(+e.firstWeight||0))*10)/10}))
    .sort((x,y)=>{const nx=x.sessions<2,ny=y.sessions<2;if(nx!==ny)return nx?1:-1;return y.gain-x.gain;});
  h+=`<div class="section-label">Übungen<span class="sl-r">nach Fortschritt</span></div>`;
  const vari=anaExVariants(exs); // gleichnamige Übungen unterscheidbar machen
  if(exs.length){h+='<div class="rows">'+exs.map(e=>{
      const t=e.sessions<2?`<span class="muted-2">neu</span>`:e.gain>0?`<span class="trend up">${icon('trendUp',14)} +${fmtNum(e.gain,1)} kg</span>`:e.gain<0?`<span class="trend amber">${icon('trendDown',14)} ${fmtNum(e.gain,1)} kg</span>`:`<span class="muted-2">${icon('trendFlat',14)} stabil</span>`;
      const v=vari[e.id]||'';const full=e.name+(v?' · '+v:'');
      return `<div class="row tap" role="button" tabindex="0" onclick="anaExHistory(${e.id},'${esc(full)}')"><div class="rl">${esc2(e.name)}${v?` <span class="ana-vari">${esc2(v)}</span>`:''}<small>${pl(e.sessions,'Einheit','Einheiten')}${e.muscle?' · '+esc2(e.muscle):''}${e.best1rm?' · 1RM ~'+fmtNum(e.best1rm)+' kg':''}</small></div><div class="rr">${t}</div></div>`;}).join('')+'</div>';}
  else h+='<div class="note">Noch keine Übungen mit Sätzen.</div>';
  // Sätze je Muskelgruppe statt Tonnage als Leitzahl (D17); ohne zählbare Sätze bleibt die Tonnage,
  // dann aber ehrlich beschriftet.
  h+=anaMuscleHTML(a);
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
  // Kein eigener onkeydown mehr: der eigene Handler kannte nur Enter, nicht die Leertaste – die scrollte
  // stattdessen die Seite. Der delegierte Auslöser in shell.js (A-II.5) macht beides und genau einmal;
  // sein Schutz Nr. 2 ([onkeydown]) hätte ihn hier sonst übersprungen (A-II.6).
  const strip=(ic,t,s,oc)=>`<div class="stat-strip" role="button" tabindex="0" onclick="${oc}"><div class="si">${icon(ic,24)}</div><div class="sc"><div class="st">${t}</div><div class="ss">${s}</div></div><div class="sx">${icon('chevronRight',18)}</div></div>`;
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

// ===== WOCHE-SEGMENT: Wochenrückblick (der Server rechnet, hier wird nur erzählt) =====
// Montag der betrachteten Woche; null = laufende Woche.
// Bewusst `var` statt `let`: der Sonntags-Push öffnet „#tracker/woche/JJJJ-MM-TT" und core.js legt den
// Montag der BERICHTETEN Woche vor go('tracker') in window.ANA_WEEK_START ab. Ein let auf oberster
// Ebene hängt nicht am window-Objekt – die Zuweisung von dort käme hier nie an. Es bleibt genau EIN
// globaler Name; drawAnaWeek.own merkt sich nur, welchen Wert wir zuletzt selbst gesetzt haben.
var ANA_WEEK_START=null;
// Wochenstart, der aus dem Deep-Link der Sonntags-Nachricht stammt (core.js setzt ihn vor go()).
// Bewusst getrennt von ANA_WEEK_START: nur so ist unterscheidbar, ob der Nutzer selbst geblättert
// hat oder ob die Nachricht eine bestimmte Woche meint. Ebenfalls var, damit die Zuweisung aus
// core.js dieselbe Bindung trifft. Wird beim Zeichnen genau einmal verbraucht.
var ANA_WEEK_LINK=null;
async function drawAnaWeek(o){o=o||{};const b=document.getElementById('anaBody');if(!b)return;
  if(!VIEW_USER)return void(b.innerHTML=anaNoAthleteHTML());
  const mon=anaMonday(today());
  // Beim Betreten des Segments gilt wieder die laufende Woche – sonst stünde man Tage später noch in
  // einer alten. EINE Ausnahme: ein Wochenstart, der nicht von uns selbst stammt (drawAnaWeek.own),
  // kommt aus dem Deep-Link der Sonntags-Nachricht und meint genau die Woche, über die sie spricht.
  // Ihn hier zurückzusetzen hieße, ab Mitternacht die neue, leere Woche zu zeigen – die Nachricht
  // spräche dann über etwas, das der Bildschirm nicht zeigt. Nach dem Einstieg gilt er als verbraucht.
  // In die Zukunft führt der Link nie: dort gibt es nichts zu berichten.
  // Zuerst der Deep-Link aus der Sonntags-Nachricht: er wird bei JEDEM Zeichnen geprüft und genau
  // einmal verbraucht. Vorher hing das an o.entry und an einem Vergleich mit drawAnaWeek.own – beim
  // zweiten Tipp auf dieselbe Mitteilung galt der Wochenstart als „selbst gewählt" und wurde
  // verworfen. In die Zukunft führt der Link nie; dort gibt es nichts zu berichten.
  const link=(typeof ANA_WEEK_LINK==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(ANA_WEEK_LINK)&&!isNaN(Date.parse(ANA_WEEK_LINK+'T00:00:00')))?anaMonday(ANA_WEEK_LINK):null;
  if(link!=null){ANA_WEEK_LINK=null;try{window.ANA_WEEK_LINK=null;}catch(e){}
    if(link<=mon)ANA_WEEK_START=drawAnaWeek.own=link;}
  // Beim Betreten des Segments gilt sonst wieder die laufende Woche – man soll Tage später nicht
  // noch in einer alten stehen.
  else if(o.entry)ANA_WEEK_START=drawAnaWeek.own=null;
  const start=ANA_WEEK_START||(ANA_WEEK_START=drawAnaWeek.own=mon),key='week:'+start;
  const have=anaEntry(key);
  if(have)anaPaintWeek(have.data);
  // Der Rückweg endet dort, wo der Server keinen prevStart mehr liefert (die erste Woche des Kontos).
  // Diese Grenze merken wir uns je Nutzer, damit „‹" schon im Ladezustand wegbleibt, statt kurz
  // aufzublitzen und ein schneller zweiter Tipp in eine Woche führt, die es nie gab.
  const first=anaCache().weekFirst||null;
  // Beim Wochenwechsel bleibt die Kopfzeile stehen und nur der Rumpf lädt – sonst springt die Ansicht.
  if(!have&&(!o.keep||!b.children.length))b.innerHTML=anaPaintWeek.head(start,(first&&start<=first)?null:anaAddDays(start,-7),start<mon?anaAddDays(start,7):null)+skeleton(3,'lg');
  if(have&&!anaStale(key,o))return;
  const before=have?JSON.stringify(have.data):null;
  // Hier absichtlich ohne anaFetch(): der Statuscode wird gebraucht. Ein 400 heißt „so weit reicht der
  // Zeitraum nicht" (MAX_RANGE_DAYS im Server) – das als „Prüfe deine Verbindung" zu melden, schickt den
  // Nutzer auf die Suche nach einem Fehler, den es nicht gibt.
  const rq=await API.get('/week/'+VIEW_USER+'?start='+encodeURIComponent(start));
  const w=rq.status===200?anaStore(key,rq.data):anaCached(key);
  // Nach dem Warten kann längst ein anderes Segment oder eine andere Woche offen sein
  if(!document.getElementById('anaBody')||renderTracker.tab!=='woche'||ANA_WEEK_START!==start)return;
  if(w==null){if(!have)b.innerHTML=(rq.status===400
    ?emptyState({icon:'calendar',title:'So weit zurück gibt es nichts',text:'Für diesen Zeitraum führt die App keinen Rückblick.',btn:{label:'Zur laufenden Woche',onclick:"anaWeekNav('"+mon+"')"}})
    :emptyState({icon:'alertTriangle',title:'Rückblick konnte nicht geladen werden',text:'Prüfe deine Verbindung und versuch es noch einmal.',btn:{label:'Erneut versuchen',onclick:"drawAnaWeek({refresh:true})"}}));return;}
  // prevStart===null heißt „davor gibt es nichts mehr" – die Grenze im Nutzer-Cache festhalten (er wird
  // beim Athletenwechsel ohnehin komplett verworfen, anaCache()).
  if(w.prevStart===null)anaCache().weekFirst=w.start||start;
  if(before!==JSON.stringify(w))anaPaintWeek(w);}
// Wochenwechsel: prevStart/nextStart kommen aus der Antwort, hier wird nur umgeschaltet.
// drawAnaWeek.own mitschreiben – sonst hielte der nächste Einstieg diesen Wert für einen Deep-Link.
function anaWeekNav(start){if(!start)return;ANA_WEEK_START=drawAnaWeek.own=start;drawAnaWeek();}

// Eine Zeile des Rückblicks. label/val/sub/cmp sind FERTIGES HTML – Serverdaten müssen vorher
// durch esc2(), Zahlen durch fmtNum(). Der Vergleich steht unter dem Wert, nicht daneben (320 px).
function _weekRow(label,val,sub,cmp){return `<div class="row ana-wk-row"><div class="rl">${label}${sub?`<small>${sub}</small>`:''}</div><div class="rr"><span class="v">${val}</span>${cmp?`<span class="wk-cmp">${cmp}</span>`:''}</div></div>`;}

// Erst was gut lief (highlights), dann die EINE Sache für nächste Woche (focus), dann die Zahlen –
// eine Wand aus Kennzahlen liest niemand zweimal.
function anaPaintWeek(w){const b=document.getElementById('anaBody');if(!b)return;w=w||{};
  const t=w.training||{},n=w.nutrition||{},bo=w.body||{},he=w.health||{},mi=w.mindset||{},pv=w.prev||{};
  // Fehlt ein Navigationsfeld ganz (ältere Antwort), rechnen wir die Nachbarwoche selbst. Ein
  // ausdrückliches null ist dagegen eine Aussage des Servers: davor liegt nichts (vor der ersten Woche
  // des Kontos), danach liegt die Zukunft. Dann bleibt der Knopf weg – sonst blättert man endlos in
  // Wochen, in denen nichts stand und in denen sich auch nichts mehr eintragen lässt.
  const st=w.start||ANA_WEEK_START,pS=(w.prevStart!==undefined)?w.prevStart:anaAddDays(st,-7),
    nS=(w.nextStart!==undefined)?w.nextStart:(st<anaMonday(today())?anaAddDays(st,7):null);
  // Laufende Woche? Der Server sagt es (current); fehlt das Feld, entscheidet der Montag von heute.
  // Diese eine Antwort trägt Kopfzeile UND Leertext – beide dürfen sich nicht widersprechen.
  const isCur=(w.current!==undefined)?!!w.current:(st>=anaMonday(today()));
  // Kommende Wochen sind über die Knöpfe nicht erreichbar, über einen alten Zwischenstand aber schon.
  // Für sie gilt weder „noch leer" noch „nichts eingetragen" – da war schlicht noch nichts.
  const isFut=!isCur&&st>anaMonday(today());
  let h=anaPaintWeek.head(st,pS,nS,isCur);
  // null heißt „nicht bekannt" – eine 0 an dieser Stelle wäre schlicht gelogen.
  const vT=(v,d,u)=>v==null?'<span class="muted-2">keine Daten</span>':`${fmtNum(v,d)}${u?`<em> ${u}</em>`:''}`;
  const cmp=(now,was,d,u)=>(now==null||was==null)?'':`${icon(now>was?'trendUp':now<was?'trendDown':'trendFlat',12)} Vorwoche ${fmtNum(was,d)}${u?' '+u:''}`;
  const blk=(label,rows)=>rows?`<div class="section-label">${label}</div><div class="rows">${rows}</div>`:'';
  // Fehlt in einem Bereich JEDER Wert, bleibt der Block ganz weg – „keine Daten" dreimal untereinander
  // ist keine Information. Fehlt nur ein einzelner Wert, steht dort „keine Daten".
  const some=(...v)=>v.some(x=>x!=null);
  // Dieselbe Serie wie auf der Startseite, deshalb derselbe Wortlaut aus derselben Funktion
  // (shStreakWords in home.js). „Tage Streak" zählte die vom Joker geretteten Tage stillschweigend
  // mit (D18); der Server liefert sie in `streakFrozen`, hier stehen sie jetzt daneben.
  const stw=shStreakWords(w.streak,w.streakFrozen);
  if(w.streak||w.xp)h+=`<div class="ana-wk-meta">${w.streak?`${icon('flame',14)} ${esc2(stw.main)}${stw.detail?`<span class="sep">·</span>${esc2(stw.detail)}`:''}`:''}${w.streak&&w.xp?'<span class="sep">·</span>':''}${w.xp?`${fmtNum(w.xp)} XP`:''}</div>`;
  // mi.skipped zählt mit: eine Woche mit lauter abgebrochenen Ritualen ist nicht leer – dort war
  // jemand da, nur zu kurz. „Noch nichts eingetragen" wäre an dieser Stelle falsch.
  const any=[t.sessions,t.sets,n.daysLogged,bo.weightEnd,he.avgSleep,he.avgSteps,he.avgBurn,mi.primings,mi.evenings,mi.breathing,mi.skipped,mi.challengeDays].some(v=>v!=null&&+v>0)||!!mi.wheel;
  // Der Leertext hängt am Zustand: in einer vergangenen Woche lässt sich nichts mehr nachtragen –
  // „Sobald du etwas einträgst" wäre dort ein Versprechen, das die App nicht einlösen kann.
  if(!any){b.innerHTML=h+(isFut
    ?emptyState({icon:'calendar',title:'Diese Woche liegt noch vor dir',text:'Der Rückblick entsteht, während die Woche läuft.'})
    :isCur
    ?emptyState({icon:'calendar',title:'Diese Woche ist noch leer',text:'Sobald du etwas einträgst, entsteht hier dein Rückblick.'})
    :emptyState({icon:'calendar',title:'Nichts eingetragen',text:'In dieser Woche ist kein Training, kein Essen und kein Check-in aufgezeichnet.'}));return;}
  const hl=(w.highlights||[]).filter(Boolean).slice(0,3);
  if(hl.length)h+=`<div class="card ana-wk-hl">${hl.map(s=>`<div class="wk-hl">${icon('check',18)}<span>${esc2(s)}</span></div>`).join('')}</div>`;
  if(w.focus&&w.focus.title)h+=`<div class="card ana-wk-focus">${icon('target',20)}<div><div class="eyebrow">Für nächste Woche</div><b>${esc2(w.focus.title)}</b>${w.focus.why?`<div class="meta mt-1">${esc2(w.focus.why)}</div>`:''}</div></div>`;
  const ts=(t.topSets||[])[0];
  let r=_weekRow('Trainings',t.sessions==null?vT(null):`${fmtNum(t.sessions)}${t.planned?`<em> / ${fmtNum(t.planned)}</em>`:''}`,'',cmp(t.sessions,pv.sessions))
    +_weekRow('Sätze',vT(t.sets))
    // Volumen in KILOGRAMM, nicht in Tonnen: der Highlight-Satz oben im SELBEN Bild sagt „48.230 kg
    // bewegt in 112 Sätzen" (logic.js/weekHighlights), und die Wochenmail nennt dieselbe Zahl ebenfalls
    // in kg. Zwei Einheiten für dieselbe Zahl auf einem Bildschirm muss der Leser selbst zusammenrechnen.
    // (Die Kacheln im Segment „Training" bleiben bei anaTons – dort steht keine kg-Zahl daneben.)
    // volumeKg ist 0, nicht null, wenn eine Woche nur aus Körpergewichtsübungen bestand: „0 kg" wäre
    // dann die einzige Zahl über ein Training, das stattgefunden hat – deshalb dort Klartext.
    +_weekRow('Volumen',t.volumeKg==null?vT(null)
      :(+t.volumeKg>0?vT(t.volumeKg,0,'kg')
      :(+t.sets>0?'<span class="muted-2">nur Körpergewicht</span>':vT(0,0,'kg'))));
  if(+t.prs>0)r+=_weekRow('Bestleistungen',fmtNum(t.prs),ts?`stärkster Satz: ${esc2(ts.exercise)}`:'');
  else if(ts)r+=_weekRow('Stärkster Satz',`${fmtNum(ts.weight,1)}<em> kg</em> × ${fmtNum(ts.reps)}`,esc2(ts.exercise));
  if(some(t.sessions,t.sets,t.volumeKg,t.prs)||ts)h+=blk('Training',r);
  // „davon", weil im Zusatz eine ANDERE Zahl steht als im Wert der Zeile (protokollierte Tage gegen Tage
  // im Ziel) – ohne das Wort liest sich die kleinere Zahl wie ein Widerspruch zur größeren darüber.
  // Wortlaut „im Kalorienziel" wie im Highlight-Satz oben (logic.js/weekHighlights): zwei Namen für
  // dieselbe Zahl auf einem Bildschirm liest niemand als dieselbe Zahl. Das „±5 %" sagt, dass „im Ziel"
  // eine Spanne ist und kein Punkt – WELCHES Ziel gemessen wird, entscheidet der Server (weekView) und
  // steht bewusst nicht hier: sonst veraltet der Satz beim nächsten Eingriff dort.
  r=_weekRow('Tage protokolliert',n.daysLogged==null?vT(null):`${fmtNum(n.daysLogged)}<em> / 7</em>`,n.onTargetDays!=null?`davon ${pl(n.onTargetDays,'Tag','Tage')} im Kalorienziel (±5 %)`:'')
    +_weekRow('Ø Kalorien',vT(n.avgKcal,0,'kcal'),n.targetKcal?`Ziel ${fmtNum(n.targetKcal)} kcal`:'',cmp(n.avgKcal,pv.avgKcal,0,'kcal'))
    +_weekRow('Ø Eiweiß',vT(n.avgProtein,0,'g'),n.targetProtein?`Ziel ${fmtNum(n.targetProtein)} g`:'');
  if(some(n.daysLogged,n.avgKcal,n.avgProtein))h+=blk('Ernährung',r);
  r=_weekRow('Gewicht',vT(bo.weightEnd,1,'kg'),bo.weightStart!=null?`zu Wochenbeginn ${fmtNum(bo.weightStart,1)} kg`:'')
    +_weekRow('Veränderung',bo.delta==null?vT(null):`${bo.delta>0?'+':''}${fmtNum(bo.delta,1)}<em> kg</em>`,'',cmp(bo.delta,pv.weightDelta,1,'kg'));
  // Die Wochenrate liefert der Server erst ab vier Tagen Messspanne (sonst null) – genau dafür wurde sie
  // abgesichert. Ohne diese Zeile stünde sie in der Antwort und auf keinem Bildschirm. Der Zusatz sagt,
  // dass es eine Hochrechnung ist: aus ein paar Wiegetagen wird hier eine ganze Woche.
  if(bo.perWeek!=null)r+=_weekRow('Ø pro Woche',`${bo.perWeek>0?'+':''}${fmtNum(bo.perWeek,1)}<em> kg</em>`,'aus den Wiegetagen dieser Woche hochgerechnet');
  if(some(bo.weightEnd,bo.weightStart,bo.delta))h+=blk('Körper',r);
  r=_weekRow('Ø Schlaf',vT(he.avgSleep,1,'h'),'',cmp(he.avgSleep,pv.avgSleep,1,'h'))
    +_weekRow('Ø Schritte',vT(he.avgSteps));
  // Uhr-Werte nur zeigen, wenn es sie gibt – ohne verbundene Uhr wäre das eine Reihe leerer Zeilen.
  if(he.avgBurn!=null)r+=_weekRow('Ø Verbrauch',vT(he.avgBurn,0,'kcal'),'aktiv, aus der Uhr');
  if(he.avgRhr!=null)r+=_weekRow('Ø Ruhepuls',vT(he.avgRhr,0,'bpm'));
  if(he.avgHrv!=null)r+=_weekRow('Ø HRV',vT(he.avgHrv,0,'ms'));
  if(some(he.avgSleep,he.avgSteps,he.avgBurn,he.avgRhr,he.avgHrv))h+=blk('Gesundheit',r);
  const mal=v=>v==null?vT(null):`${fmtNum(v)}<em> ×</em>`;
  r=_weekRow('Priming',mal(mi.primings))+_weekRow('Abendreflexion',mal(mi.evenings));
  if(mi.breathing!=null)r+=_weekRow('Atemübungen',mal(mi.breathing));
  // Abgebrochene Rituale zählt der Server nicht mehr als erledigt (Regel „vollwertig" im Mindset-Modul).
  // Ohne diese Zeile stünde bei einer Woche voller kurzer Durchläufe nur „0 ×" – und niemand wüsste warum.
  if(mi.skipped)r+=_weekRow('Abgebrochen',mal(mi.skipped),'zu kurz – zählt nicht für Streak und XP');
  if(mi.challengeDays!=null)r+=_weekRow('Challenge',pl(mi.challengeDays,'Tag','Tage'));
  if(mi.wheel)r+=_weekRow('Rad des Lebens','<span class="pill green">ausgefüllt</span>');
  if(some(mi.primings,mi.evenings,mi.breathing,mi.skipped,mi.challengeDays)||mi.wheel)h+=blk('Mindset',r);
  b.innerHTML=h;}
// Kopfzeile mit Zeitraum und Wochenwechsel. Hängt als Eigenschaft an anaPaintWeek, damit der
// Ladezustand dieselbe Zeile zeigt wie das fertige Bild – ohne einen weiteren globalen Namen.
anaPaintWeek.head=function(start,prev,next,cur){const end=anaAddDays(start,6);
  const range=start.slice(5,7)===end.slice(5,7)
    ? `${+start.slice(8,10)}. – ${fmtDate(end,{month:'long'})}`
    : `${fmtDate(start)} – ${fmtDate(end)}`;
  const back=Math.round(anaDayDiff(anaMonday(today()),start)/7);
  // back < 0 = eine Woche, die noch nicht war. „Diese Woche" wäre dort schlicht falsch.
  const sub=cur?'Diese Woche':back===0?'Diese Woche':back===1?'Letzte Woche':back>1?`vor ${pl(back,'Woche','Wochen')}`
    :back===-1?'Nächste Woche':`in ${pl(-back,'Woche','Wochen')}`;
  // Ohne Ziel kein Knopf, aber ein Platzhalter – sonst rutscht der Zeitraum aus der Mitte.
  const nav=(s,ic,lbl)=>s?`<button class="btn icon sm sec" onclick="anaWeekNav('${esc(s)}')" aria-label="${lbl}">${icon(ic,20)}</button>`:'<span class="wk-sp" aria-hidden="true"></span>';
  return `<div class="ana-wknav">${nav(prev,'chevronLeft','Vorherige Woche')}<div class="wk-t"><b>${esc2(range)}</b><small>${sub}</small></div>${nav(next,'chevronRight','Nächste Woche')}</div>`;};

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
  <div class="note mb-4">Die Kalorien schätzen wir aus Sportart, Dauer und Intensität. Deine Einheit erscheint im Trainings-Tab unter Cardio – und, wenn du einen Coach hast, in seiner Übersicht.</div>
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
  // Cardio läuft oft ohne Netz (Wald, Keller, Flugmodus): ohne Verbindung wandert die Einheit in die
  // Outbox und wird später nachgetragen. Echte Fehler (4xx/5xx) bleiben sichtbar.
  const r=await API.post('/cardio',body,{queue:true,kind:'cardio',label:`${kind} · ${fmtNum(body.minutes)} min`});
  const ok=typeof okRes==='function'?okRes(r):r.status===200;
  if(!ok)return toast(r.data?.error||'Fehler – nicht gespeichert');
  closeModal();
  // Bei 202 liegt der Eintrag nur lokal: nichts neu laden, sonst überschreibt die Serverantwort den Stand.
  if(typeof wasQueued==='function'&&wasQueued(r))return void toast('Offline gespeichert – wird nachgetragen, sobald du online bist');
  toast(`Cardio gespeichert ✓ · ${fmtNum(Math.round(r.data?.kcal||0))} kcal`);refreshAchievements();
  anaInvalidate('cardio');anaInvalidate('insights');
  if(typeof drawCardioTab==='function'&&document.getElementById('workoutBody'))drawCardioTab();
  anaRefreshIfVisible();}

// ===== GESUNDHEITS-INTEGRATIONEN (Hub) =====
async function openIntegrations(){const on=!!(ME&&ME.health_reminder);const own=!coachView();
  // Status des persönlichen Links gleich mitladen: „aktiv" oder „einrichten" steht dann direkt in der Zeile.
  let hl=null;if(own){try{const r=await API.get('/health/link');if(r.status===200)hl=r.data;}catch(e){}}
  openSheet('Gesundheitsdaten',`
  <div class="note mb-3">Verbinde deine Gesundheits-App, damit Schlaf, Schritte, Verbrauch und Trainings von selbst in deine Auswertung fließen – ohne alles von Hand einzutragen.</div>
  <div class="rows">
    <div class="row tap" role="button" tabindex="0" onclick="openAppleHealth()"><div class="r-ic">${icon('apple',24)}</div><div class="rl">Apple Health<small>${hl?.enabled?'Automatisch – iPhone schickt die Werte selbst':'Automatisch per Kurzbefehl · oder von Hand'}</small></div><div class="rr">${hl?.enabled?'<span class="pill green">aktiv</span>':'<span class="pill neutral">einrichten</span>'}</div></div>
    <div class="row soon"><div class="r-ic">${icon('heart',24)}</div><div class="rl">Health Connect<small>Android · Google Fit</small></div><div class="rr"><span class="pill neutral">kommt bald</span></div></div>
    <div class="row soon"><div class="r-ic">${icon('timer',24)}</div><div class="rl">Fitbit<small>Tracker und Smartwatches</small></div><div class="rr"><span class="pill neutral">kommt bald</span></div></div>
    <div class="row soon"><div class="r-ic">${icon('zap',24)}</div><div class="rl">Garmin Connect<small>Sportuhren</small></div><div class="rr"><span class="pill neutral">kommt bald</span></div></div>
  </div>
  ${(own&&!hl?.enabled)?`<div class="rows mt-4"><div class="switch-row"><div class="rl">Wöchentlich erinnern<small>Neue Daten importieren</small></div><button class="tgl${on?' on':''}" id="health_rem" role="switch" aria-checked="${on?'true':'false'}" aria-label="Wöchentlich erinnern" onclick="toggleHealthReminder(!this.classList.contains('on'))"></button></div></div>`:''}
  <div class="caption mt-3">${hl?.enabled?'Die wöchentliche Erinnerung entfällt – dein iPhone schickt die Werte von selbst.':'Kein passendes Gerät? Du kannst alle Werte jederzeit auf der Startseite oder in der Check-in Historie eintragen.'}</div>`);}

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
  const r=await API.get('/measurements/'+VIEW_USER);
  // A-III.2: Ohne echte Antwort ist die Liste UNBEKANNT, nicht leer. Bis 2.6.0 machte `||[]` daraus ein
  // „noch keine Maße" – und im eigenen Konto schlimmer: das Formular stand offen da, ohne die Zeile
  // „zuletzt 84,0 cm · 12.09.", also ohne jeden Bezug zum letzten Wert. Bei kein Netz MIT Schnappschuss
  // liefert API.get (A-III.1) längst 200; dieser Zweig greift nur, wenn wirklich kein Stand da ist.
  if(r.status!==200){openSheet('Körpermaße',stlNotLoaded('Körpermaße',r.status,'openMeasure()'));return;}
  const list=(r.data?.measurements||[]).slice().sort((a,b)=>a.date<b.date?1:-1);
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
// Die Liste kommt in Seiten zu 24 – jedes Vorschaubild sind rund 11 KB base64, bei drei Jahren und drei
// Posen je zwei Wochen (234 Fotos) waren das 2,6 MB in EINER Antwort und 234 Kacheln auf einmal im DOM.
// Zwei Stufen, beide per Feature-Erkennung:
//  · Der Client zeichnet IMMER nur 24 Kacheln auf einmal („Weitere Fotos anzeigen" hängt die nächsten an).
//  · ?limit=&before=&before_id= sind für den Server optional. Ignoriert er sie (ältere Fassung), kommt
//    wie bisher alles – dann blättern wir nur durch die eigene Liste. Liefert er genau eine volle Seite,
//    holt „Ältere Fotos laden" die nächste hinter dem ältesten Eintrag; kommt dabei nichts Neues, war es die letzte.
const PH_PAGE=24;
function phPath(uid,before){return '/photos/'+uid+'?limit='+PH_PAGE+(before?'&before='+encodeURIComponent(before.date||'')+'&before_id='+encodeURIComponent(before.id):'');}
function phThumbHTML(p,uid){return `<button class="ph-th" data-pid="${p.id}" onclick="viewPhoto(${+p.id},${+uid})" aria-label="Foto vom ${fmtDate(p.date)}"><img alt="" loading="lazy"><span class="ph-cap">${fmtDate(p.date)} · ${({front:'V',side:'S',back:'H'})[p.pose]||''}</span></button>`;}
async function openPhotos(uid){uid=uid||VIEW_USER;const readOnly=(uid!==ME.id);
  openSheet('Fortschrittsfotos','<div class="spinner"></div>');
  viewPhoto.cur=null; // das zuletzt angesehene Vollbild (~216 KB) nicht länger im Speicher halten
  const r=await API.get(phPath(uid));
  // A-III.2: Dieselbe Regel wie bei den Maßen – „Noch keine Fotos · Dein erstes Foto ist dein Startpunkt"
  // ist eine Aussage über die Daten und war ohne Antwort schlicht falsch.
  if(r.status!==200){openSheet('Fortschrittsfotos',stlNotLoaded('Fortschrittsfotos',r.status,'openPhotos('+(+uid)+')'));return;}
  const list=r.data?.photos||[];openPhotos.uid=uid;openPhotos.list=list;
  openPhotos.shown=0;
  // Mehr auf dem Server? Nur, wenn genau eine volle Seite kam und der Server nicht selbst „nein" sagt.
  openPhotos.more=list.length===PH_PAGE&&r.data?.more!==false&&r.data?.hasMore!==false;
  const pose=openPhotos.pose||'front';
  let h=readOnly
    ? `<div class="note mb-3">Fortschrittsfotos gehören zu den empfindlichsten Daten der App – behandle sie vertraulich.</div>`
    : `<div class="note mb-3">Alle zwei Wochen ein Foto – gleiche Pose, gleiches Licht. Wer deine Fotos sehen kann: du, dein zugewiesener Coach und die Verwaltung der App.</div>
      <div class="seg" id="ph_poseSeg">${[['front','Vorne'],['side','Seite'],['back','Hinten']].map(([k,l])=>`<button class="${k===pose?'on':''}" data-pose="${k}" onclick="phPose('${k}')">${l}</button>`).join('')}</div>
      <label class="btn block">${icon('camera',18)} Foto aufnehmen<input type="file" accept="image/*" capture="environment" onchange="handlePhoto(event)"></label>`;
  if(list.length){h+=`<div class="section-label">${readOnly?'Fotos':'Deine Fotos'}<span class="sl-r" id="ph_count"></span></div><div class="ph-grid" id="ph_grid"></div><div id="ph_more"></div>`;}
  else h+=emptyState({icon:'camera',title:'Noch keine Fotos',text:readOnly?'Der Athlet hat noch keine Fotos hochgeladen.':'Dein erstes Foto ist dein Startpunkt – mach es heute.'});
  openSheet('Fortschrittsfotos',h);
  if(list.length)phShowMore();}
// Nächste 24 Kacheln der geladenen Liste anhängen; danach Knopf für weitere bzw. ältere (Server-Seite).
function phShowMore(){const grid=document.getElementById('ph_grid');if(!grid)return;
  const uid=openPhotos.uid,list=openPhotos.list||[];
  const from=openPhotos.shown||0,to=Math.min(list.length,from+PH_PAGE);
  grid.insertAdjacentHTML('beforeend',list.slice(from,to).map(p=>phThumbHTML(p,uid)).join(''));
  openPhotos.shown=to;
  const cnt=document.getElementById('ph_count');if(cnt)cnt.textContent=pl(list.length,'Foto','Fotos')+(openPhotos.more?' geladen':'');
  const rest=list.length-to;
  const more=document.getElementById('ph_more');
  if(more)more.innerHTML=rest>0?`<button class="btn sm sec mt-3" onclick="phShowMore()">Weitere Fotos anzeigen (noch ${fmtNum(rest)})</button>`
    :(openPhotos.more?`<button class="btn sm sec mt-3" id="ph_older" onclick="phLoadOlder()">Ältere Fotos laden</button>`:'');
  anaLoadThumbs(list.slice(from,to),uid);}
// Nächste Seite vom Server (hinter dem ältesten geladenen Foto). Ein Server ohne Blätterung antwortet mit
// derselben Liste – kein neues Foto heißt dann: es gibt keine weiteren.
async function phLoadOlder(){const uid=openPhotos.uid,list=openPhotos.list||[];if(!list.length||phLoadOlder.busy)return;
  const btn=document.getElementById('ph_older');if(btn)btn.disabled=true;phLoadOlder.busy=1;
  try{const last=list[list.length-1];const r=await API.get(phPath(uid,last));
    const have=new Set(list.map(p=>p.id));const fresh=(r.data?.photos||[]).filter(p=>p&&!have.has(p.id));
    if(!document.getElementById('ph_grid')||openPhotos.uid!==uid)return;
    openPhotos.more=fresh.length===PH_PAGE&&r.data?.more!==false&&r.data?.hasMore!==false;
    if(fresh.length){openPhotos.list=list.concat(fresh);phShowMore();}
    else{const more=document.getElementById('ph_more');if(more)more.innerHTML='';}
  }finally{phLoadOlder.busy=0;}}
// Vorschaubilder: aus der Liste (thumb, BE 2.1) – ältere Fotos ohne thumb einzeln nachladen, aber vier
// gleichzeitig statt streng nacheinander (40 Altfotos: ~9 s -> unter 1 s) und nur die Vorschau (?thumb=1;
// ein Server ohne den Parameter schickt das Foto wie bisher ganz, dann gilt thumb||image). Bricht ab, sobald
// das Sheet weg ist. src immer als Property, nie im HTML.
async function anaLoadThumbs(list,uid){
  const imgOf=p=>document.querySelector(`.ph-th[data-pid="${p.id}"] img`);
  const missing=[];
  for(const p of list){const img=imgOf(p);if(!img)return; // Sheet ist weg
    if(p.thumb)img.src=p.thumb;else missing.push(p);}
  if(!missing.length)return;
  let i=0;
  const worker=async()=>{while(i<missing.length){const p=missing[i++];if(!imgOf(p))return;
    const pr=await API.get('/photos/'+uid+'/'+p.id+'?thumb=1');const im2=imgOf(p);
    if(im2&&pr.data?.photo)im2.src=pr.data.photo.thumb||pr.data.photo.image;}};
  await Promise.all([0,1,2,3].map(worker));}
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
      // Gefeiert wird der erreichte Stand, nicht die runde Zahl: derselbe Wortlaut wie auf der Startseite
      // (shStreakWords in home.js). Vorher stand hier „30 Tage Streak!", auch wenn ein Joker einen dieser
      // Tage gerettet hatte (D18) – ein Meilenstein, der auf einem Tag ohne Eintrag steht, ohne das zu sagen.
      if(hit){const sw=shStreakWords(cur,INS.streaks?.checkinFrozen),ttl=sw.main+'!',sub=sw.detail||'Nicht abreißen lassen!';
        if(celebrated)setTimeout(()=>celebrate('🔥',ttl,sub),1500);else{celebrate('🔥',ttl,sub);celebrated=true;}}}
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
