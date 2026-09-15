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
// A-V.5 (DEFER-A3 D2-4): der letzte Statuscode wird gemerkt, damit die Fehlerkarte unterscheiden kann,
// ob gerade kein Netz da ist (status 0 -> „liegt auf dem Server, hier noch nicht gespeichert") oder ob
// der Server geantwortet hat (dann mit Fehlernummer). Vorher fiel beides auf denselben Satz „Prüfe
// deine Verbindung", auch wenn die Verbindung stand.
let ANA_LAST_ST=0;
async function anaFetch(key,path,pick){const r=await API.get(path);ANA_LAST_ST=r.status|0;if(r.status!==200)return anaCached(key);return anaStore(key,pick?pick(r.data):r.data);}
// Ladefehler-Karte in der Hausfassung (`stlNotLoaded`, home.js – im Kernbündel, also immer da).
// Fällt sie aus, bleibt die alte Karte: eine fehlende Funktion darf keine leere Ansicht erzeugen.
function anaNotLoaded(sache,st,retry){
  if(typeof stlNotLoaded==='function')return stlNotLoaded(sache,st,retry);
  return emptyState({icon:'alertTriangle',title:'Daten konnten nicht geladen werden',
    text:'Prüfe deine Verbindung und versuch es noch einmal.',btn:{label:'Erneut versuchen',onclick:retry}});}
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

// ===== A-IV.6 · ZEITRAUM, BEREICH, AUSSAGESATZ =====
// Drei Bausteine, die in diesem Tab überall gelten (Präfix `an2`):
//  1. ZEITRAUM: Bis 2.7.0 war er fest verdrahtet – die Gewichtskurve nahm die letzten 90 EINTRÄGE, jedes
//     andere Diagramm die letzten 30 (RATE-25-analysis, Befund M10: „Kein Zeitraum wählbar"). Wer drei
//     Monate zurückschauen wollte, konnte es nicht; wer nur die letzten vier Wochen sehen wollte, auch nicht.
//     Jetzt wählen drei Chips über dem Diagramm: 4 Wochen · 3 Monate · 1 Jahr. Die Wahl gilt für den
//     ganzen Tab und übersteht das Schließen der App (localStorage).
//  2. BEREICH: Eine nackte Zahl ist keine Einordnung. „HRV 58 ms" sagt nichts, „HRV 58 ms · dein Bereich
//     50–62" sagt alles – und zwar ohne ein Urteil zu fällen (Prinzip P4; Oura Vitals zeigt seine
//     Kennzahlen seit Ende 2025 genau so, RESEARCH-25-einsichten M10a). Der Bereich ist die mittlere
//     Hälfte der eigenen Werte im gewählten Zeitraum (25.–75. Perzentil), nicht eine Norm und nicht ein Ziel.
//     Perzentile statt Mittelwert ± Streuung, weil ein einzelner Ausreißer den Bereich sonst wochenlang
//     verschiebt (M10b: genau daran scheitert WHOOP in der Nutzerkritik).
//  3. AUSSAGESATZ: Über jedem Diagramm steht EIN Satz, der sagt, was die Kurve bedeutet. Ohne ihn ist ein
//     Diagramm eine Hausaufgabe für den Leser.
const AN2_RANGES=[{k:'4w',lbl:'4 Wochen',short:'4 W',days:28},{k:'3m',lbl:'3 Monate',short:'3 M',days:91},{k:'1j',lbl:'1 Jahr',short:'1 J',days:365}];
let AN2_RANGE=(function(){try{const v=localStorage.getItem('be_an2_range');if(AN2_RANGES.some(r=>r.k===v))return v;}catch(e){}return '3m';})();
function an2Range(){return AN2_RANGES.find(r=>r.k===AN2_RANGE)||AN2_RANGES[1];}
function an2From(){return anaAddDays(today(),-(an2Range().days-1));}
// Nur Einträge im gewählten Fenster (Liste in beliebiger Reihenfolge, Datum als ISO-Text)
function an2Window(rows,key){const from=an2From();return (rows||[]).filter(r=>r&&(key?r[key]:r.date)>=from);}
// Wie viele Tage Check-ins geholt werden müssen, damit das Fenster überhaupt gefüllt werden kann.
// Nie weniger als das bisherige 120-Tage-Fenster: die Tabellen und Durchschnitte darunter leben davon.
function an2CiDays(){return Math.max(ANA_CI_DAYS,an2Range().days+7);}
function an2ChipsHTML(){const cur=an2Range().k;
  return `<div class="chip-row an2-range" role="group" aria-label="Zeitraum des Diagramms">`
    +AN2_RANGES.map(x=>`<button class="chip${x.k===cur?' on':''}" aria-pressed="${x.k===cur?'true':'false'}" aria-label="Zeitraum ${x.lbl}" onclick="an2SetRange('${x.k}')">${x.short}</button>`).join('')
    +`</div>`;}
// Umschalten: neu malen reicht, solange die Daten schon da sind. Erst ein größeres Fenster als das
// geladene macht eine neue Anfrage nötig – dann steht kurz der Ladezustand da, statt eine Kurve zu
// zeigen, die nur so aussieht, als reichte sie ein Jahr zurück.
function an2SetRange(k){if(!AN2_RANGES.some(r=>r.k===k)||k===AN2_RANGE)return;
  AN2_RANGE=k;try{localStorage.setItem('be_an2_range',k);}catch(e){}
  // Im Trainings-Tab hängt seit 2.8.0 auch die Muskelverteilung am Chip: die Zahlen für einen größeren
  // Zeitraum kommen aus derselben Route, also erst neu zeichnen (die Kurve ist sofort da) und die
  // Wochenzahlen nachladen. Kommen sie an, zeichnet der Rückruf ein zweites Mal.
  if(renderTracker.tab==='training'){anaPaintTraining();
    an2LoadMuscleSets().then(d=>{if(d&&renderTracker.tab==='training'&&document.getElementById('anaBody'))anaPaintTraining();}).catch(e=>{});
    return;}
  if(renderTracker.tab==='woche')return;
  if(an2CiDays()>(+anaCache().ciDays||0)){anaInvalidate('checkins');drawAnaKoerper({refresh:true});return;}
  const d=anaCached('checkins');if(d)anaPaintKoerper(d);}

// Stufe des betrachteten Athleten: 1 Einsteiger · 2 Fortgeschritten · 3 Profi (STRATEGY-25, Abschnitt 4).
// Der Coach kann die Selbsteinschätzung übersteuern (`experience_coach`) – deshalb gewinnt sie.
// DIESELBE Stufe wie in der Satzzeile: A-IV.2 hält sie in `twLevel()` (training.js), und zwei
// Rechnungen für dieselbe Frage sind genau der Fehler, den CRITIC K1 beschreibt. Fehlt die Datei
// (Ladereihenfolge, Teilbündel), rechnet diese Funktion dasselbe selbst – auf isBeginner() ist kein
// Verlass, das kennt nur das EIGENE Konto und nicht den Athleten im Coach-Blick.
function an2Level(){
  try{if(typeof twLevel==='function'){const n=+twLevel();if(n>=1&&n<=3)return n;}}catch(e){}
  let p=null;
  try{p=(VIEW_USER===ME.id)?ME:(typeof VIEW_USER_PROFILE!=='undefined'?VIEW_USER_PROFILE:null);}catch(e){}
  p=p||{};
  const x=String(p.experience_coach||p.experience||'beginner').toLowerCase();
  return x==='advanced'?3:x==='intermediate'?2:1;}

// --- Bereich: mittlere Hälfte der eigenen Werte ---
// {lo,hi,med,n} oder null. Unter fünf Werten wird kein Bereich behauptet – aus drei Nächten einen
// „üblichen Bereich" abzuleiten wäre erfundene Genauigkeit (RESEARCH-25-einsichten M7: lieber den
// Kalibrierzustand nennen als eine Zahl ohne Grundlage).
// Seit B-I.5 rechnet das `wk2Band()` in home.js – eine Rechnung, ein Ergebnis. home.js liegt im
// Kernbündel (BOOT_CORE_JS) und ist vor dieser Datei da; der typeof-Zweig ist reine Vorsicht für den
// Fall, dass jemand analysis.js einzeln lädt, und rechnet dann exakt dasselbe.
function an2Band(vals){
  if(typeof wk2Band==='function')return wk2Band(vals,5);
  const xs=(vals||[]).map(Number).filter(v=>v!=null&&isFinite(v)).sort((a,b)=>a-b);
  if(xs.length<5)return null;
  const q=p=>{const i=(xs.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return xs[lo]+(xs[hi]-xs[lo])*(i-lo);};
  const b={lo:q(.25),hi:q(.75),med:q(.5),n:xs.length};
  return (b.hi-b.lo)>0?b:null;}

// ===== B-I.5 · SELBSTBERICHT FÜR DEN DIVERGENZ-HINWEIS =====
// Die Reihe kommt aus den Mindset-Sitzungen (Energie/Stimmung, vom Athleten selbst eingetragen) und
// wird NUR geholt, wenn die Bereitschaft auch wirklich angesehen wird – wer sich die Gewichtskurve
// ansieht, zahlt dafür keine Anfrage. Kommt sie an, wird einmal nachgezeichnet; der 60-s-Takt der
// übrigen Daten verhindert, dass daraus eine Schleife wird.
let AN2_SELF_BUSY=false;
function an2SelfEnsure(){
  if(AN2_SELF_BUSY||!VIEW_USER||typeof wk2SelfSeries!=='function')return;
  if(anaEntry('self')&&!anaStale('self'))return;
  AN2_SELF_BUSY=true;
  wk2SelfSeries(VIEW_USER,21).then(list=>{AN2_SELF_BUSY=false;anaStore('self',list||[]);
    if(renderTracker.tab==='koerper'&&ANA_METRIC==='readiness'&&document.getElementById('anaBody')){
      const d=anaCached('checkins');if(d)anaPaintKoerper(d);}})
    .catch(e=>{AN2_SELF_BUSY=false;});}
// {ready,…} bzw. null – dieselbe Rechnung wie auf der Startseite (wk2Calib in home.js).
function an2Calib(R,checkins){return (typeof wk2Calib==='function')?wk2Calib(R,checkins):null;}
function an2Diverge(R,checkins){return (typeof wk2Diverge==='function')
  ?wk2Diverge(R,{rows:checkins,self:anaCached('self')||[]}):null;}
function an2BandText(b,d,u){if(!b)return '';return `dein Bereich ${fmtNum(b.lo,d||0)}–${fmtNum(b.hi,d||0)}${u?' '+u:''}`;}
// Derselbe Bereich für den WOCHENRÜCKBLICK. Er bezieht sich bewusst nicht auf den Zeitraum-Chip
// (der steht auf dieser Seite nicht) und auch nicht auf heute, sondern auf die 90 Tage, die mit der
// BETRACHTETEN Woche enden. Nur so vergleicht der Rückblick einer Woche im Juni mit dem Juni und nicht
// mit dem September. Ohne geladene Check-ins (Direkteinstieg in das Segment „Woche") liefert er '' –
// dann steht die Zeile wie bisher da, statt eine zusätzliche Anfrage auszulösen.
const AN2_WK_BAND_DAYS=90;
function an2WeekBand(key,dec,unit){
  const ci=anaCached('checkins_all')||anaCached('checkins');if(!Array.isArray(ci)||!ci.length)return '';
  const st=ANA_WEEK_START;if(!st)return '';
  const end=anaAddDays(st,6),from=anaAddDays(end,-(AN2_WK_BAND_DAYS-1));
  // Reicht die geladene Liste nicht bis in dieses Fenster, wäre der „Bereich" der eines anderen Zeitraums.
  const oldest=ci[ci.length-1]&&ci[ci.length-1].date;if(!oldest||oldest>end)return '';
  const vals=ci.filter(c=>c&&c.date>=from&&c.date<=end&&c[key]!=null&&+c[key]>0).map(c=>+c[key]);
  return an2BandText(an2Band(vals),dec,unit);}
// Wie viele der jüngsten Einträge liegen am Stück außerhalb des Bereichs? (rows aufsteigend nach Datum)
// Gezählt werden Einträge; ob das auch aufeinanderfolgende TAGE sind, prüft an2Streak mit – sonst stünde
// „seit 5 Tagen" über fünf Werten aus drei Wochen (genau der Fehler, den Befund M8 beschreibt).
function an2Streak(rows,test){let n=0,days=true;
  for(let i=rows.length-1;i>=0;i--){if(!test(rows[i].value))break;
    if(n&&anaDayDiff(rows[i+1].date,rows[i].date)!==1)days=false;n++;}
  return {n,days};}
// Der eine Satz über dem Diagramm. rows aufsteigend [{date,value}].
// Reihenfolge der Regeln: erst die Auffälligkeit (mehrere Werte am Stück außerhalb), dann der letzte
// Wert gegen den Bereich, dann das Ziel. Nie mehr als ein Satz – zwei Sätze sind schon eine Liste.
function an2Say(rows,o){o=o||{};const d=o.dec||0,u=o.unit||'';
  rows=(rows||[]).filter(r=>r&&r.value!=null);
  if(rows.length<2)return null;
  const band=o.band||an2Band(rows.map(r=>r.value));
  const last=rows[rows.length-1],v=+last.value;
  const num=x=>fmtNum(x,d)+(u?' '+u:'');
  const rng=band?`${fmtNum(band.lo,d)}–${fmtNum(band.hi,d)}${u?' '+u:''}`:'';
  const since=s=>s.days?`seit ${pl(s.n,'Tag','Tagen')}`:`bei den letzten ${fmtNum(s.n)} Einträgen`;
  if(band){
    const lo=an2Streak(rows,x=>+x<band.lo),hi=an2Streak(rows,x=>+x>band.hi);
    if(lo.n>=3)return {tone:o.lowBad===false?'muted':'amber',txt:`${o.name} liegt ${since(lo)} unter deinem üblichen Bereich (${rng}).`};
    if(hi.n>=3)return {tone:o.highBad?'amber':'green',txt:`${o.name} liegt ${since(hi)} über deinem üblichen Bereich (${rng}).`};
    if(v<band.lo)return {tone:'muted',txt:`Zuletzt ${num(v)} – unter deinem üblichen Bereich (${rng}).`};
    if(v>band.hi)return {tone:'muted',txt:`Zuletzt ${num(v)} – über deinem üblichen Bereich (${rng}).`};
  }
  if(o.goal!=null){const miss=Math.round((o.goal-v)*100)/100;
    if(miss>0)return {tone:'muted',txt:`Zuletzt ${num(v)} – bis zu deinem Ziel fehlen ${num(miss)}${rng?` · dein Bereich ${rng}`:''}.`};
    return {tone:'green',txt:`Zuletzt ${num(v)} – Ziel erreicht${rng?` · dein Bereich ${rng}`:''}.`};}
  return {tone:'muted',txt:band?`Zuletzt ${num(v)} – in deinem üblichen Bereich (${rng}).`:`Zuletzt ${num(v)} am ${fmtDate(last.date)}.`};}
// Der Satz als Zeile über dem Diagramm (derselbe Baustein wie über den Muskel-Balken)
// Trend-Zeile einer Kachel: der eigene Bereich, sonst der mitgegebene Ersatztext
function an2Trend(band,d,u,fallback){return {cls:'',html:`<span class="muted-2">${esc2(band?an2BandText(band,d,u):(fallback||''))}</span>`};}
function an2SayHTML(say){if(!say||!say.txt)return '';
  const ic=say.tone==='green'?'check':say.tone==='amber'?'alertTriangle':'info';
  return `<div class="an2-say ${anaToneCls(say.tone)}">${icon(ic,16)}<span>${esc2(say.txt)}</span></div>`;}
// Den eigenen Bereich als graues Band HINTER die Kurve legen. metricChart() gehört home.js und kennt
// keine Bänder; sein SVG hat aber eine feste Geometrie (viewBox 0 0 340 220, oben 16, unten 28) und
// benutzt dieselben Achsen-Helfer, die hier auch zur Verfügung stehen. Deshalb wird das Rechteck aus
// exakt denselben Werten gerechnet und direkt hinter das <svg ...> gesetzt – also hinter alles andere.
// Passt irgendetwas davon nicht (andere viewBox, fehlender Helfer), bleibt das Diagramm unverändert:
// lieber kein Band als ein verschobenes.
function an2WithBand(svg,band,pts,opts){
  if(!svg||!band||typeof _domain!=='function'||typeof _ticks!=='function'||typeof _axisW!=='function'||typeof _chartFS!=='function')return svg;
  const m=/^<svg viewBox="0 0 (\d+) (\d+)"/.exec(svg);if(!m)return svg;
  const W=+m[1],H=+m[2],T=16,B=28,R=12;
  try{
    const o=opts||{},vals=pts.map(p=>+p.value).filter(v=>isFinite(v));
    if(!vals.length)return svg;
    const dom=_domain(vals,o.goal!=null?o.goal:null,o),ticks=_ticks(dom),FS=_chartFS(),L=_axisW(ticks,dom.step,o,FS);
    const Y=v=>T+(1-(v-dom.mn)/((dom.mx-dom.mn)||1))*(H-T-B);
    const y1=Math.max(T,Y(band.hi)),y2=Math.min(H-B,Y(band.lo));
    if(!(y2>y1))return svg;
    const rect=`<rect x="${L.toFixed(1)}" y="${y1.toFixed(1)}" width="${(W-L-R).toFixed(1)}" height="${(y2-y1).toFixed(1)}" fill="var(--ink3)" opacity=".14"/>`;
    return svg.replace(/^(<svg[^>]*>)/,'$1'+rect);
  }catch(e){return svg;}}
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
// Das Fenster wächst mit dem gewählten Zeitraum (an2CiDays): „1 Jahr" braucht ein Jahr Check-ins,
// „4 Wochen" kommt weiter mit den 120 Tagen aus, die Historie und Durchschnitte ohnehin brauchen.
function anaCheckinPath(){const d=an2CiDays();return '/checkins/'+VIEW_USER+'?days='+d+'&limit='+d;}
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
  const want=an2CiDays();
  const [data]=await Promise.all([anaFetch('checkins',anaCheckinPath(),d=>d.checkins||[]),anaFetch('readiness','/readiness/'+VIEW_USER)]);
  // Merken, wie weit die geladene Liste zurückreicht: erst ein größerer Zeitraum als dieser löst eine
  // neue Anfrage aus (an2SetRange), ein kleinerer kommt ohne aus.
  if(data!=null)anaCache().ciDays=want;
  if(!document.getElementById('anaBody')||renderTracker.tab!=='koerper')return;
  if(data==null){if(!have)box.innerHTML=anaNotLoaded('Körperzahlen',ANA_LAST_ST,"drawAnaKoerper({refresh:true})");return;}
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
  // „Ø 14 Tage" hieß bis 2.7.0 „Ø der letzten 14 EINTRÄGE" (`slice(0,n)`) – bei Lücken reichte das
  // Fenster still Wochen zurück (Befund M8). Gemittelt wird jetzt über die letzten n KALENDERTAGE.
  // Liegt in diesem Fenster kein Wert (wer drei Wochen pausiert hat), zählen ersatzweise die letzten
  // n Einträge – sonst verschwände die Zahl genau bei dem Nutzer, der zurückkommt und sehen will, wo er steht.
  const avgOf=(key,n)=>{n=n||7;const have=checkins.filter(c=>c[key]!=null&&+c[key]>0);
    const mean=xs=>xs.length?xs.reduce((a,c)=>a+ +c[key],0)/xs.length:null;
    const win=have.filter(c=>anaDayDiff(tdy,c.date)<=n-1);
    return win.length?mean(win):mean(have.slice(0,n));};
  // Letzter gemessener Wert einer Kennzahl (die Liste ist absteigend sortiert)
  const lastOf=key=>{const c=checkins.find(x=>x[key]!=null&&+x[key]>0);return c?+c[key]:null;};
  // Der eigene Bereich im gewählten Zeitraum – die Zahl daneben, die aus 58 ms eine Einordnung macht.
  const bandOf=key=>an2Band(an2Window(checkins).filter(c=>c[key]!=null&&+c[key]>0).map(c=>+c[key]));
  // Werte aus der Uhr (Apple Health). Sie erscheinen nur, wenn wirklich welche da sind –
  // ohne verbundene Uhr bleibt die Ansicht so schlank wie vorher.
  const avg={aSleep:avgOf('sleep'),aSteps:avgOf('steps'),aWater:avgOf('water'),
    aBurn:avgOf('active_kcal'),aRhr:avgOf('resting_hr',14),aHrv:avgOf('hrv',14)};
  const tr=anaWeekTrend(ws);
  h+=anaHeroHTML(checkins,ws,g,avg,tr,canEdit);
  // Kacheln SIND die Diagramm-Auswahl: angetippt wechselt darunter EIN Diagramm.
  // Vorher standen bis zu sieben Diagramme untereinander – die Seite war dreimal so lang,
  // und man hat trotzdem immer nur eines angesehen.
  // Nachbesserung A-IV.6 (Befund B8 · CRITIC K3): Die GEWÄHLTE Kachel wiederholt keinen Wert mehr.
  // Gemessen auf `tracker`: der Hero nannte „78,4 kg" und „↗ +0,1 kg/Woche · 7-Tage-Schnitt vs.
  // Vorwoche", rund 300 px darunter stand in der ersten Kachel wortgleich „78,4 kg / Gewicht /
  // ↗ +0,1 kg/Woche". Dieselbe Aussage zweimal auf einem Bildschirm ist genau das Rauschen, wegen
  // dessen A-IV.1 auf der Startseite Karten entfernen musste. Die gewählte Kachel ist jetzt nur noch
  // das, was sie in diesem Moment ist: die Auswahlmarke. Beschriftung + Haken, kein Wert, kein Delta –
  // der Wert steht groß im Hero bzw. im Kartenkopf des Diagramms, das genau diese Kachel gerade zeigt.
  // Die NICHT gewählten Kacheln behalten Wert und Delta: sie sind die Übersicht, aus der man wählt,
  // und dort wiederholt sich nichts. Trefferfläche, Rolle und `aria-pressed` bleiben unverändert –
  // der Tap-Weg zu jedem Diagramm ist derselbe wie vorher (Veto `tapcount.mjs`).
  // Still wird die Kachel aber NUR, wenn ihr Wert wirklich woanders auf demselben Bildschirm steht:
  // beim Gewicht immer (der Hero nennt es groß, auch wenn im Zeitraum keine Wiegung liegt), bei der
  // Bereitschaft immer (ihre Karte nennt die Zahl auch ohne Verlauf). Bei allen anderen Kennzahlen
  // zeigt die Karte unter zwei Werten im Zeitraum nur „Zu wenig Daten" und hat gar keine Kopfzeile –
  // dann behält die Kachel ihren Wert. Sonst hätte diese Nachbesserung die Doppelung gegen ein
  // Verschwinden getauscht, und das ist der schlechtere Fehler.
  const anaEchoed=key=>key==='weight'||key==='readiness'
    ||an2Window(checkins).filter(c=>c[key]!=null&&+c[key]>0).length>=2;
  const tile=(key,label,val,unit,t)=>{const on=ANA_METRIC===key,still=on&&anaEchoed(key);
    return `<button class="tile tap${on?' on':''}" aria-pressed="${on?'true':'false'}" onclick="anaMetric('${key}')" aria-label="${label} – Diagramm ${on?'wird angezeigt':'anzeigen'}">`
      +(still?`<div class="v an2-sel">${icon('check',22)}</div>`:`<div class="v">${val}${unit?`<em> ${unit}</em>`:''}</div>`)
      +`<div class="l">${label}</div>`
      +`<div class="trend ${still?'':t.cls}">${still?'<span class="muted-2">unten im Diagramm</span>':t.html}</div></button>`;};
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
      // B-I.5: Unter sieben Nächten steht hier der Kalibrierzustand statt der Zahl – und zwar mit den
      // Nächten selbst als Wert. Das ist die einzige Zahl, die an dieser Stelle gedeckt ist.
      const cal=an2Calib(R,checkins);
      if(cal&&!cal.ready&&cal.have>0)return tile('readiness','Bereitschaft',`${fmtNum(cal.have)}/${fmtNum(cal.need)}`,'Nächte',
        {cls:'',html:`<span class="muted-2">${esc2(wk2CalibText(cal))}</span>`});
      const cls=R.tone==='green'?'up':R.tone==='amber'?'amber':R.tone==='red'?'down':'';
      return tile('readiness','Bereitschaft',fmtNum(R.score),'',{cls,html:esc2(R.label||'')+(solo?' · geschätzt':'')});},
    sleep:()=>tile('sleep','Ø Schlaf',avg.aSleep!=null?fmtNum(avg.aSleep,1):'–',avg.aSleep!=null?'h':'',goalTrend(avg.aSleep,g.sleep,'h',1)),
    steps:()=>tile('steps','Ø Schritte',avg.aSteps!=null?fmtNum(Math.round(avg.aSteps)):'–','',goalTrend(avg.aSteps,g.steps,'',0)),
    water:()=>tile('water','Ø Wasser',avg.aWater!=null?fmtNum(avg.aWater,1):'–',avg.aWater!=null?'L':'',goalTrend(avg.aWater,g.water,'L',1)),
    // Uhr-Werte: der ZULETZT gemessene Wert, daneben der eigene Bereich – nicht ein Durchschnitt ohne
    // Maßstab. „HRV 58 ms" ist eine Zahl, „HRV 58 ms · dein Bereich 50–62" ist eine Einordnung (P4).
    active_kcal:()=>tile('active_kcal','Ø Verbrauch',fmtNum(Math.round(avg.aBurn||0)),'kcal',an2Trend(bandOf('active_kcal'),0,'kcal','aktiv, aus der Uhr')),
    resting_hr:()=>tile('resting_hr','Ruhepuls',fmtNum(Math.round(lastOf('resting_hr')||avg.aRhr||0)),'bpm',an2Trend(bandOf('resting_hr'),0,'bpm','Ø 14 Tage '+fmtNum(Math.round(avg.aRhr||0))+' bpm')),
    hrv:()=>tile('hrv','HRV',fmtNum(Math.round(lastOf('hrv')||avg.aHrv||0)),'ms',an2Trend(bandOf('hrv'),0,'ms','Ø 14 Tage '+fmtNum(Math.round(avg.aHrv||0))+' ms')),
  };
  h+=`<div class="tiles" id="anaTiles">${ANA_TILES.map(k=>tileFor[k]()).join('')}</div>`;
  if(checkins.length<2)h+=`<div class="note mb-4">Mehr Auswertungen erscheinen, sobald du ein paar Tage Check-ins gemacht hast.</div>`;
  h+=`<div id="anaChartBox">${anaChartHTML(checkins,g,avg)}</div>`;
  h+=anaPhysHTML();
  h+=`<div class="section-label">Check-in Historie${canEdit?`<span class="sl-r"><button class="btn sm sec" onclick="anaOpenCheckin()">${icon('plus',14)} Nachtragen</button></span>`:''}</div><div id="histlist" class="ana-hist"></div>`;
  if(canEdit)h+=`<button class="btn sec mt-4" onclick="openIntegrations()">${icon('apple',18)} Gesundheitsdaten verbinden</button>`;
  box.innerHTML=h;loadHist(checkins);anaTourTarget();}

// Das eine Diagramm zur gewählten Kachel (WP0-Engine: schöne Ticks, Ziel-Label, gleitender Schnitt).
// Neu in 2.8.0: über der Karte die Zeitraum-Chips, in der Karte ein Aussagesatz und hinter der Kurve
// der eigene Bereich als Band. Die Reihenfolge ist Absicht – erst die Aussage, dann die Zahlen.
function anaChartHTML(checkins,g,avg){
  // Die Reihe folgt dem gewählten Zeitraum (vorher fest: die letzten 30 Einträge, Befund M10).
  const series=key=>an2Window(checkins).filter(c=>c[key]!=null&&+c[key]>0).reverse().map(c=>({date:c.date,value:+c[key]}));
  const card=(title,v,svg,extra,say)=>`${an2ChipsHTML()}<div class="chart-card" id="anaChart"><div class="ch-h"><div class="t">${title}</div><div class="v">${v}</div></div>${an2SayHTML(say)}${svg}${extra||''}</div>`;
  // „7-Tage-Schnitt" war hier ein Versprechen, das der Motor nicht hält: _rolling() mittelt die letzten
  // sieben WERTE, nicht sieben Tage (Befund M8). Der Text sagt jetzt, was gerechnet wird.
  const leg=(b,goal)=>`<div class="caption mt-2">Dicke Linie = Schnitt der letzten 7 Werte · dünne Linie = Tageswerte${goal!=null?' · gestrichelt = Ziel':''}${b?' · graues Band = die mittlere Hälfte deiner Werte im Zeitraum':''}</div>`;
  const few=`${an2ChipsHTML()}<div class="chart-card" id="anaChart"><div class="caption center">Zu wenig Daten im gewählten Zeitraum – ab 2 Einträgen erscheint hier die Kurve.</div></div>`;
  // Bereitschaft: der 14-Tage-Verlauf aus GET /readiness (derselbe wie im Sheet der Startseite), darunter
  // der Weg zu den Teilwerten. openReadiness gehört home.js – ohne sie fehlt nur der Knopf, nicht die Kurve.
  if(ANA_METRIC==='readiness'){const R=anaCached('readiness')||{};
    // B-I.5: Der Selbstbericht wird erst hier geholt – eine Anfrage, die nur zahlt, wer die
    // Bereitschaft auch ansieht.
    an2SelfEnsure();
    const cal=an2Calib(R,checkins),dv=an2Diverge(R,checkins);
    const divHTML=(typeof wk2DivHTML==='function')?wk2DivHTML(dv,'mt-2'):'';
    // Kalibrierung: wie im Sheet der Startseite bleiben Zahl, Wort UND Verlauf weg – der Verlauf
    // bestünde aus genau den Zahlen, die noch keine Grundlage haben. Was bleibt, ist der Stand.
    if(cal&&!cal.ready&&cal.have>0)
      return card('Bereitschaft',`${fmtNum(cal.have)} von ${fmtNum(cal.need)} Nächten`,
        `<div class="caption mt-2 mb-2">${esc2(wk2CalibWhy(cal))} ${esc2(wk2CalibSteer())}</div>${divHTML}`,
        typeof openReadiness==='function'?`<div class="between mt-2"><span class="caption"></span><button class="btn sm sec fixed" onclick="openReadiness()">Details</button></div>`:'',
        {tone:'muted',txt:wk2CalibText(cal)});
    const hist=(R.history||[]).filter(x=>x&&x.date&&x.score!=null).map(x=>({date:x.date,value:+x.score}));
    const solo=(typeof _readySolo==='function')?_readySolo(R):'';
    // Die Handlungs-Aussage (R.headline) steht seit 2.8.0 ÜBER der Kurve – hier bleibt nur der Hinweis
    // auf eine Einzelquelle. Vorher stand derselbe Satz zweimal in derselben Karte.
    const txt=solo?`Geschätzt aus ${solo} – für eine belastbare Einschätzung fehlen noch Werte.`:'';
    const extra=`<div class="between mt-2"><span class="caption">${esc2(txt)}</span>${typeof openReadiness==='function'?`<button class="btn sm sec fixed" onclick="openReadiness()">Details</button>`:''}</div>`;
    // Ohne heutige Zahl (score:null) nennt die Kopfzeile den Grund statt eines Strichs; der Verlauf
    // der Vortage bleibt stehen, er ist ja echt.
    const head=R.score==null?esc2(R.label||'Noch keine Daten'):`${fmtNum(R.score)}${R.label?' · '+esc2(R.label):''}`;
    // Der Satz über der Kurve kommt hier vom Server – er ist die Bereitschafts-Aussage selbst
    // („Zieh deinen Plan durch", mit Grund). Ein zweiter, selbst gerechneter Satz daneben wäre Lärm.
    const say=R.headline?{tone:R.tone==='green'?'green':R.tone==='red'||R.tone==='amber'?'amber':'muted',txt:R.headline}:null;
    // Der Divergenz-Hinweis steht UNTER der Kurve, nicht über ihr: über der Kurve steht die Aussage
    // des Servers, und zwei Sätze übereinander sind schon eine Liste (A-IV.6, „nie mehr als ein Satz").
    if(hist.length<2)return card('Bereitschaft',head,'<div class="caption mt-2 mb-2">Ab zwei Tagen mit Werten erscheint hier der Verlauf.</div>'+divHTML,extra,say);
    return card('Bereitschaft',head,metricChart(hist,'Punkte',null,null,{domain:[0,100],step:25})+divHTML,extra,say);}
  // Gewicht hat eine eigene Karte: Lücken, Trendlinie, Kopfzeile nur über den letzten Abschnitt (D33).
  if(ANA_METRIC==='weight')return anaWeightCard(checkins,g);
  const defs={
    sleep:{t:'Schlaf',n:'Dein Schlaf',u:'h',d:1,goal:g.sleep,gl:()=>'Ziel '+fmtNum(g.sleep,1)+' h'},
    steps:{t:'Schritte',n:'Deine Schritte',u:'',d:0,goal:g.steps,gl:()=>'Ziel '+fmtNum(g.steps)},
    water:{t:'Wasser',n:'Dein Wasser',u:'L',d:1,goal:g.water,gl:()=>'Ziel '+fmtNum(g.water,1)+' L'},
    active_kcal:{t:'Aktive Kalorien',n:'Dein Verbrauch',u:'kcal',d:0,goal:null},
    // Ein hoher Ruhepuls ist das Warnzeichen, ein niedriger das gute Zeichen – umgekehrt zu allem anderen.
    resting_hr:{t:'Ruhepuls',n:'Dein Ruhepuls',u:'bpm',d:0,goal:null,highBad:true,lowBad:false},
    hrv:{t:'HRV',n:'Deine HRV',u:'ms',d:0,goal:null},
  }[ANA_METRIC];
  if(!defs)return '';
  const rows=series(ANA_METRIC);
  if(rows.length<2)return few;
  const band=an2Band(rows.map(r=>r.value));
  const say=an2Say(rows,{name:defs.n,unit:defs.u,dec:defs.d,goal:defs.goal,band,highBad:defs.highBad,lowBad:defs.lowBad});
  const o={avg:7,goal:defs.goal};
  const svg=an2WithBand(metricChart(rows,defs.u,defs.goal,defs.gl?defs.gl():null,{avg:7}),band,rows,o);
  // Die Kopfzeile mittelt ueber GENAU die Werte, die im Bild stehen – und sagt das auch. Vorher stand
  // dort der 14-Tage-Schnitt ueber einer Kurve, die drei Monate zeigte: zwei Zahlen, ein Wort „Ø".
  const mean=rows.reduce((a,r)=>a+ +r.value,0)/rows.length;
  const head=`Ø ${fmtNum(defs.d?Math.round(mean*10)/10:Math.round(mean),defs.d)}${defs.u?' '+defs.u:''} in ${an2Range().lbl}${defs.goal!=null?` · ${defs.gl()}`:''}`;
  return card(defs.t,head,svg,leg(!!band,defs.goal),say);}
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

// Der Aussagesatz über der Gewichtskurve. Er nennt Tempo UND Bewertung – „+0,1 kg/Woche" allein ist
// ohne das Ziel des Athleten bedeutungslos (im Aufbau gut, in der Definition ein Problem).
// Ohne Ziel und ohne belastbares Tempo bleibt der Satz beschreibend statt zu raten.
// Die Kopfzeile der Karte nennt bereits „Trend 78,3 kg" – der Satz wiederholt sie NICHT. In der ersten
// Fassung stand „Trend 78,3 kg" zweimal auf derselben Karte, zwei Zeilen übereinander; das liest sich
// wie zwei Befunde und ist einer. Der Satz sagt, was die Kurve bedeutet; die Zahl steht daneben.
function an2WeightSay(checkins,g,seg,ema){
  const goal=(g&&g.goal)||null;
  const ws=(checkins||[]).filter(c=>c&&+c.weight>0).slice().sort((a,b)=>a.date<b.date?1:-1);
  const tr=anaWeekTrend(ws);
  const trend=ema&&ema.length?ema[ema.length-1].v:null;
  if(!tr||trend==null)return null;
  const v=Math.round(tr.perWeek*100)/100,av=Math.abs(v);
  if(av<0.05)return {tone:'muted',txt:`Dein Gewicht steht seit ${tr.kind==='avg'?'zwei Wochen':'dem ersten Eintrag'} praktisch still.`};
  const dir=v>0?'steigt':'fällt';
  const speed=`${fmtNum(av,1)} kg pro Woche`;
  if(goal==='muscle')return v>0?{tone:'green',txt:`Dein Gewicht ${dir} um ${speed} – das passt zum Aufbau.`}
    :{tone:'amber',txt:`Dein Gewicht ${dir} um ${speed} – im Aufbau sollte es nach oben gehen.`};
  if(goal==='fatloss')return v<0?{tone:'green',txt:`Dein Gewicht ${dir} um ${speed} – das passt zur Definition.`}
    :{tone:'amber',txt:`Dein Gewicht ${dir} um ${speed} – in der Definition sollte es nach unten gehen.`};
  return {tone:'muted',txt:`Dein Gewicht ${dir} um ${speed}.`};}
function anaWeightCard(checkins,g){
  // Zeitraum aus den Chips statt „die letzten 90 Einträge" (Befund M10).
  const pts=an2Window(checkins||[]).filter(c=>c&&+c.weight>0&&c.date).map(c=>({t:Date.parse(c.date+'T00:00'),v:+c.weight,date:c.date}))
    .filter(p=>!isNaN(p.t)&&!isNaN(p.v)).sort((a,b)=>a.t-b.t);
  const wrap=(head,body,cap,say)=>`${an2ChipsHTML()}<div class="chart-card" id="anaChart"><div class="ch-h"><div class="t">Gewicht</div><div class="v">${head}</div></div>${an2SayHTML(say)}${body}${cap?`<div class="caption mt-2">${cap}</div>`:''}</div>`;
  if(pts.length<2)return `${an2ChipsHTML()}<div class="chart-card" id="anaChart"><div class="caption center">Zu wenig Daten im gewählten Zeitraum – ab 2 Wiegungen erscheint hier die Kurve.</div></div>`;
  const segs=anaSegments(pts),last=segs[segs.length-1],prev=segs.length>1?segs[segs.length-2]:null;
  const gapDays=prev?Math.round((last[0].t-prev[prev.length-1].t)/864e5):0;
  // Kopfzeile: geglättete Enden des LETZTEN zusammenhängenden Abschnitts. Ein Abschnitt aus einer
  // einzigen Wiegung hat keine Veränderung – dann steht schlicht der Wert da.
  const ema=anaEma(last),trend=ema[ema.length-1].v,delta=Math.round((trend-ema[0].v)*10)/10;
  // Nachbesserung A-IV.6: Hier stand „+0,5 kg seit 14. Aug." – und das war falsch datiert.
  // `delta` ist `trend − ema[0].v`, und `ema[0].v` ist der GEGLÄTTETE Startwert des Abschnitts
  // (Mittel der ersten drei Wiegungen, siehe `anaEma`), nicht die Wiegung vom 14. August.
  // Nachgerechnet am Testkonto: roh 14.08. = 77,8 kg, 14.09. = 78,4 kg → +0,6 kg; angezeigt wurden
  // +0,5 kg (78,40 − 77,89). Die Zahl selbst bleibt geglättet und das mit Absicht – ungeglättet
  // stimmt bei einer Wochenbetrachtung in fast jeder dritten Woche schon das Vorzeichen nicht (D33),
  // und ein einzelner verrauschter Startwert verzöge den ganzen Abschnitt. Falsch war nur der Bezug:
  // Die Kopfzeile nennt deshalb die LÄNGE des Abschnitts statt eines Datums, an dem der Athlet einen
  // Rohwert nachschlagen und eine andere Zahl finden würde, und die Legende sagt, was verglichen wird.
  const spanD=Math.round((last[last.length-1].t-last[0].t)/864e5);
  const spanTxt=spanD>=1?`in ${pl(spanD,'Tag','Tagen')}`:'im Verlauf';
  // Beim Coach-Blick auf ein frisches Konto (zwei Wiegungen, ein Tag) stand hier „−0,0 kg": `delta`
  // war −0,04 und rundete auf die negative Null. Ein Vorzeichen vor einer Null behauptet eine
  // Richtung, die die Zahl selbst verneint – unter 0,05 kg heißt es deshalb schlicht „unverändert".
  const deltaTxt=Math.abs(delta)<0.05?'unverändert':`${delta>0?'+':''}${fmtNum(delta,1)} kg`;
  const head=last.length<2?`${fmtNum(last[0].v,1)} kg am ${fmtDate(last[0].date)}`
    :`Trend ${fmtNum(trend,1)} kg · ${deltaTxt} ${spanTxt}`;
  let cap=`Punkte = deine Wiegungen · Linie = Trend über ${fmtNum(ANA_EMA_N)} Tage · die Veränderung vergleicht diese Linie am Anfang und am Ende`;
  if(gapDays)cap+=` · zwischen ${fmtDate(prev[prev.length-1].date)} und ${fmtDate(last[0].date)} ${pl(gapDays,'Tag','Tage')} ohne Wiegung – dort ist die Linie unterbrochen`;
  // Der eine Satz über der Kurve: Richtung, Tempo und – das ist der Punkt – ob das zum Ziel passt.
  // Die Kachel daneben nennt dieselbe Wochenrate; beide kommen aus anaWeekTrend, damit sie sich nicht
  // widersprechen können (genau das war Befund M1: Kopfzeile „+15,4 kg", Kachel „+0,1 kg/Woche").
  const say=an2WeightSay(checkins,g,last,ema);
  // Die Achsen-Helfer wohnen in home.js (dieselben wie in metricChart). Fehlt einer, zeichnen wir
  // wenigstens den letzten Abschnitt sauber, statt wieder quer durch die Lücke zu ziehen.
  if(typeof _domain!=='function'||typeof _ticks!=='function'||typeof _tickFmt!=='function'||typeof _axisW!=='function'||typeof _chartFS!=='function'||typeof _xLabels!=='function')
    return wrap(head,typeof metricChart==='function'?metricChart(last.map(p=>({date:p.date,value:p.v})),'kg',null,null,{avg:ANA_EMA_N}):'',cap,say);
  // Achsenschrift: 12 px gerendert statt 11 (CRITIC K10 / A-IV.5 „Mindestschriftgröße 12 px").
  // `_chartFS()` (home.js) rechnet die viewBox-Größe so aus, dass 11 CSS-Pixel herauskommen – bei
  // 390 px Fenster gemessen 11,5 in der viewBox, rund 11,0 auf dem Schirm. Derselbe Rechenweg, nur
  // mit 12 als Boden: `×12/11`. Die Zahl gilt für DIESE Karte; der gemeinsame Helfer in home.js
  // gehört A-IV.1 und steht in DEFER-A4, damit die anderen Diagramme nachziehen.
  const W=340,H=220,R=12,T=16,B=28,FS=Math.ceil(_chartFS()*12/11*10)/10;
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
  return wrap(head,svg,cap,say);}

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
// „Nächster Schritt": das Ziel, das relativ am weitesten entfernt ist.
// Nachbesserung A-IV.6 (Befund B8, zweite Fundstelle · CRITIC K3): Der Zielwert stand hier in Klammern
// ein zweites Mal. Gemessen auf `tracker`, ein Bildschirm: Hero „Wasser: noch 1,3 L bis zum Ziel
// (3,5 L)" und rund 300 px darunter die Kachel „Ø Wasser · Ziel 3,5 L · −1,3 L" – derselbe Zielwert
// zweimal, genau die Doppelung, wegen der die gewählte Kachel oben schon still geworden ist.
// Die Klammer ist weg; der Zielwert steht jetzt einmal, nämlich in der Kachel. Der ABSTAND bleibt im
// Satz, denn er IST der nächste Schritt – ein „Nächster Schritt" ohne Menge wäre keiner mehr, und der
// Satz soll ohne Blickwechsel handlungsfähig machen.
// Dass die zugehörige Kachel sicher auf demselben Bildschirm steht, ist keine Annahme: `avgOf()`
// liefert genau dann eine Zahl, wenn es mindestens einen Wert > 0 gibt – dieselbe Bedingung, nach der
// `has(key)` weiter oben die Kachel aufnimmt. Kein Fall, in dem der Satz ein Thema nennt, das die
// Kachelreihe verschweigt.
function anaNextStep(avg,g){const c=[];
  if(avg.aSleep!=null)c.push({k:'Schlaf',rel:(g.sleep-avg.aSleep)/g.sleep,txt:`Schlaf: noch ${fmtNum(g.sleep-avg.aSleep,1)} h bis zum Ziel`});
  if(avg.aSteps!=null)c.push({k:'Schritte',rel:(g.steps-avg.aSteps)/g.steps,txt:`Schritte: noch ${fmtNum(Math.round(g.steps-avg.aSteps))} bis zum Ziel`});
  if(avg.aWater!=null)c.push({k:'Wasser',rel:(g.water-avg.aWater)/g.water,txt:`Wasser: noch ${fmtNum(g.water-avg.aWater,1)} L bis zum Ziel`});
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
  const snap=()=>JSON.stringify(keys.concat(['setlogs',an2MuscleKey()]).map(anaCached));
  const before=snap();
  const [a,ins,mg]=await Promise.all([
    anaFetch('analytics','/analytics/'+VIEW_USER),
    anaFetch('insights','/insights/'+VIEW_USER),
    anaFetch('monthly','/monthly/'+VIEW_USER),
    anaFetch('cardio','/cardio/'+VIEW_USER,d=>d.cardio||[])]);
  if(ins)checkNewAchievements(ins); // feiert neue Erfolge (nur eigenes Athletenkonto)
  if(mg&&mg.justClaimed&&mg.award&&VIEW_USER===ME.id)setTimeout(()=>celebrateMonthly(mg.award,mg.bonusXp),600);
  // Sätze je Muskelgruppe (D17): /api/analytics bringt die letzten vier Wochen aus derselben Rechnung
  // mit wie GET /api/muscle-sets. Geht der Zeitraum-Chip darüber hinaus, fragen wir dieselbe Route mit
  // mehr Wochen – eine zusätzliche Anfrage, aber keine zweite Rechnung.
  if(a&&a.totals&&a.totals.totalSets)await an2LoadMuscleSets(o);
  // Ersatzweg: liefert keiner der beiden Wege Muskelzeilen (alter Zwischenstand, Antwort ohne
  // Muskelangaben), zählen wir die Sätze aus dem Satzprotokoll – nur dann, und im 60-s-Takt der anderen.
  if(a&&a.totals&&a.totals.totalSets&&!anaMuscleServerSets(a)&&!an2MuscleCached()&&anaStale('setlogs',o))await anaFetch('setlogs','/logs/'+VIEW_USER);
  if(!document.getElementById('anaBody')||renderTracker.tab!=='training')return;
  if(a==null){if(!have)b.innerHTML=anaNotLoaded('Trainingszahlen',ANA_LAST_ST,"drawAnaTraining({refresh:true})");return;}
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
// EHRLICHE FUSSNOTE (A-IV.3 liefert sie als `indirectCounted:false`, DEFER-A4): `exercises.muscle`
// kennt genau EINE Gruppe je Übung, deshalb zählt jeder Satz voll auf eine – der Bizeps beim Rudern
// und der Trizeps beim Bankdrücken kommen in der Wochenzahl nicht vor. RESEARCH-25-einsichten (Q45/Q46)
// bewertet indirekte Sätze mit 0,5; dafür braucht es `exercises.muscle2`, und diese Welle darf kein
// Schema ändern. Bis dahin steht die Grenze unter den Balken, statt dass ein Profi sie selbst errät:
// „Bizeps 3,0 Sätze/Woche" ist sonst eine Zahl, die zu niedrig aussieht, ohne zu sagen warum.
const ANA_MUSC_D=28,ANA_MUSC_LO=10,ANA_MUSC_HI=20,ANA_MUSC_NONE='Ohne Muskelgruppe';
function anaMuscleServerSets(a){const m=(a&&a.muscles)||[];return m.length>0&&m.every(x=>x&&x.sets!=null);}
// ===== EINE ZAHL, EIN WEG (Nachbesserung 2.8.0) =====
// Bis eben rechnete dieser Browser die Sätze pro Woche selbst (`Sätze / (Tage/7)`), während der Server
// dieselbe Zahl auf zwei weiteren Wegen lieferte: `/api/analytics` über ein rollendes 28-Tage-Fenster
// und GET /api/muscle-sets als Schnitt der ABGESCHLOSSENEN Wochen. Am selben Konto, in derselben
// Sekunde: Quads 16,8 gegen 18,0. Angezeigt wurde die erste Zahl, die zweite Route hatte im ganzen
// ausgelieferten Bündel keinen einzigen Aufrufer. Jetzt gibt es eine Rechnung (`muscleSetsView` im
// Server) und zwei Ausgabewege, die dasselbe Ergebnis tragen:
//   · bis 4 Wochen: das `muscles`-Feld von /api/analytics – ohne zusätzliche Anfrage,
//   · darüber (Chip „3 Monate"/„1 Jahr"): GET /api/muscle-sets?weeks=N – dieselbe Funktion.
// Der Browser zählt nur noch dann selbst, wenn beide Wege nichts liefern (alter Zwischenstand,
// Offline-Antwort ohne Muskelzeilen) – und dann nach DERSELBEN Regel: Schnitt der fertigen Wochen,
// die laufende Woche bleibt draußen. „4 Sätze am Montag" ist kein Rückstand, sondern Montag.
const AN2_MUSC_MAXW=26;   // Deckel der Route (MUSCLE_MAX_WEEKS im Server)
function an2MuscleWeeks(){return Math.max(1,Math.min(AN2_MUSC_MAXW,Math.round(an2Range().days/7)));}
function an2MuscleBaseW(){return Math.max(1,+((anaCached('analytics')||{}).muscleWeeks)||4);}
function an2MuscleKey(){return 'msets'+an2MuscleWeeks();}
function an2MuscleCached(){const M=anaCached(an2MuscleKey());return (M&&Array.isArray(M.muscles))?M:null;}
// Holt die Wochenzahlen NUR, wenn der Zeitraum-Chip über das hinausgeht, was /api/analytics ohnehin
// mitbringt: „4 Wochen" kostet keine Anfrage, „3 Monate" und „1 Jahr" je eine.
async function an2LoadMuscleSets(o){
  if(!VIEW_USER||an2MuscleWeeks()<=an2MuscleBaseW())return null;
  const k=an2MuscleKey();if(!anaStale(k,o))return anaCached(k);
  return anaFetch(k,'/muscle-sets/'+VIEW_USER+'?weeks='+an2MuscleWeeks());}
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
  const tdy=today();
  // Ein junges Konto hat kein 28-Tage-Fenster: über Tage vor dem ersten Satz zu mitteln machte aus
  // sechs Sätzen in drei Tagen „1,5 Sätze pro Woche". Im Server-Zweig klemmt die eine Rechnung das
  // selbst (sie kennt den ersten Satz), im Ersatzzweig tut es diese Zeile.
  const firstDate=exs.map(e=>e.firstDate).filter(Boolean).sort()[0]||null;
  const sort=rows=>rows.sort((x,y)=>(x.none?1:0)-(y.none?1:0)||((y.perWeek??-1)-(x.perWeek??-1))||x.muscle.localeCompare(y.muscle));
  // --- Weg 1 + 2: die Zahlen des Servers (dieselbe Rechnung, einmal als Feld, einmal als Route) ---
  const M=an2MuscleCached();
  const S=M||(anaMuscleServerSets(a)?{muscles:a.muscles,days:+a.muscleWindowDays||ANA_MUSC_D,weeks:+a.muscleWeeks||4}:null);
  if(S){
    const days=Math.max(1,+S.days||ANA_MUSC_D);
    // Die laufende Woche zählt im Schnitt nicht mit – also sind die „abgeschlossenen" Wochen eine
    // weniger als die betrachteten. Die Zahl steht in der Kopfzeile, damit „Ø pro Woche" nachprüfbar ist.
    const doneWeeks=Math.max(0,(+S.weeks||Math.round(days/7))-1);
    const by={};
    // Die Zeile OHNE Muskelnamen (`muscle:null`) landet im selben Topf „Ohne Muskelgruppe" wie im
    // Ersatzzweig – vorher fiel sie durch `if(!k)return;` heraus, und weil der Server-Zweig immer
    // gewinnt, war der Topf in der Praxis IMMER leer. Gemessen an einer Übung ohne Muskelangabe:
    // 24 Sätze verschwanden spurlos, die Balken summierten 115 statt 139.
    (S.muscles||[]).forEach(m=>{const k=String(m.muscle||'').trim()||ANA_MUSC_NONE;known.add(k);
      by[k]={muscle:k,none:k===ANA_MUSC_NONE,sets:+m.sets||0,vol:Math.round(+m.volume||0),
        thisWeek:+m.thisWeek||0,perWeek:(m.perWeek==null?null:+m.perWeek)};});
    if(!by[ANA_MUSC_NONE])known.delete(ANA_MUSC_NONE);
    // Bekannt, aber im Zeitraum ohne einen einzigen Satz: dieselbe Zeile mit Nullen – das ist der
    // eigentliche Befund („für diese Gruppe steht nichts").
    const rows=Array.from(known).map(k=>by[k]||{muscle:k,none:false,sets:0,vol:0,thisWeek:0,perWeek:doneWeeks?0:null});
    return known.size?{rows:sort(rows),days,doneWeeks,partial:false,src:'server'}:null;}
  // --- Weg 3 (Ersatz): selbst zählen, aber nach DERSELBEN Regel ---
  const L=anaCached('setlogs');if(!L||!Array.isArray(L.logs))return null;
  // Aufwärmsätze zählen nicht – weder hier noch in der Zählung des Servers (SQL_SET_WORK, 2.8.0).
  // Bis 2.7.0 zählte dieser Weg sie mit: dieselbe Frage, zwei Antworten, je nachdem welcher Zweig
  // gerade lief. `set_type` steht in jeder Zeile von GET /api/logs (SELECT *); weich gelöschte Sätze
  // filtert der Server schon.
  const logs=L.logs.filter(r=>r&&+r.reps>0&&r.date&&(r.set_type||'work')!=='warmup'&&(r.set_type||'work')!=='deleted');
  let start=anaAddDays(tdy,-(ANA_MUSC_D-1)),partial=false;
  // Das 500er-Fenster des Servers kann kürzer sein als 28 Tage. Dann zählt nur der Zeitraum, der
  // wirklich vollständig vorliegt – sonst stünden die Sätze eines halben Zeitraums gegen volle Wochen.
  if(L.truncated&&logs.length){const oldest=logs.map(r=>r.date).sort()[0];if(oldest>start){start=oldest;partial=true;}}
  if(firstDate&&firstDate>start)start=firstDate;
  const thisMon=anaMonday(tdy);
  // Erste Woche, die der Zeitraum VOLLSTÄNDIG abdeckt – eine angebrochene erste Woche würde den
  // Schnitt nach unten ziehen, ohne dass jemand ein Training ausgelassen hätte.
  let firstMon=anaMonday(start);if(firstMon<start)firstMon=anaAddDays(firstMon,7);
  const cnt={},vol={},wk={};
  // Sätze einer Übung OHNE Muskelgruppe verschwinden nicht still – sie stehen am Ende unter
  // „Ohne Muskelgruppe". Sonst summierte die Liste weniger Sätze, als der Nutzer gemacht hat.
  logs.forEach(r=>{if(r.date<start||r.date>tdy)return;const m=musOf[r.exercise_id];if(m===undefined)return;
    const k=m||ANA_MUSC_NONE;known.add(k);cnt[k]=(cnt[k]||0)+1;vol[k]=(vol[k]||0)+Math.max(0,(+r.weight||0)*(+r.reps||0));
    const w=anaMonday(r.date);if(w>=firstMon){(wk[k]=wk[k]||{})[w]=((wk[k]||{})[w]||0)+1;}});
  if(!cnt[ANA_MUSC_NONE])known.delete(ANA_MUSC_NONE);
  if(!known.size)return null;
  const days=Math.max(1,anaDayDiff(tdy,start)+1);
  const doneKeys=[];for(let k=firstMon;k<thisMon;k=anaAddDays(k,7))doneKeys.push(k);
  const rows=Array.from(known).map(m=>({muscle:m,none:m===ANA_MUSC_NONE,sets:cnt[m]||0,vol:Math.round(vol[m]||0),
    thisWeek:((wk[m]||{})[thisMon])||0,
    perWeek:doneKeys.length?Math.round(doneKeys.reduce((s,k)=>s+((wk[m]||{})[k]||0),0)/doneKeys.length*10)/10:null}));
  return {rows:sort(rows),days,doneWeeks:doneKeys.length,partial,src:'logs'};}
// ===== A-IV.6 · BEWEGUNGSRICHTUNGEN: das ist der Befund B22 =====
// „Was fehlt?" beantwortet man nicht Muskel für Muskel, sondern Richtung für Richtung. Genau das ist
// der Befund: Tonnage belohnt die Beinpresse und verschweigt, dass seit Wochen kein einziger ZUG-Satz
// stattgefunden hat. Und die alphabetische Liste tut dasselbe – sie nennt „Abs, Adductors, Calves"
// zuerst, weil das Alphabet es so will, und versteckt „Lats, Rear Delts" hinter „3 weitere Gruppen".
// Die Zuordnung läuft über Wortbestandteile, nicht über eine feste Liste: die Muskelnamen kommen aus
// `exercises.muscle` und sind vom Betreiber frei gefüllt (heute englisch, morgen vielleicht deutsch).
// Rumpf steht vorn, damit „Lower Back" nicht am `back` der Zug-Regel hängen bleibt.
const AN2_MOVE=[
  ['Rumpf','Rumpf-',/\babs?\b|bauch|core|oblique|rumpf|lower\s*back|unterer\s*r(ü|ue)cken/i],
  ['Zug','Zug-',/\blat|r(ü|ue)cken|\bback\b|bizeps|biceps|rear\s*delt|hintere\s*schulter|trap|rhomb|unterarm|forearm|rudern|\brow/i],
  ['Druck','Druck-',/brust|chest|\bpec|trizeps|triceps|delt|schulter|shoulder/i],
  ['Beine','Bein-',/quad|hamstring|beinbeuger|glut|ges(ä|ae)(ss|ß)|wade|calf|calves|adduct|abduct|\bbein|\bleg/i],
];
function an2Move(m){const s=String(m||'');for(const [k,,re] of AN2_MOVE)if(re.test(s))return k;return null;}
// Große Gruppen zuerst nennen – eine fehlende Rückenarbeit wiegt schwerer als fehlende Waden.
const AN2_BIG=/\blat|r(ü|ue)cken|\bback\b|brust|chest|\bpec|quad|hamstring|glut|ges(ä|ae)(ss|ß)|bizeps|biceps|trizeps|triceps|delt|schulter|shoulder/i;
function an2ByWeight(xs){return xs.slice().sort((a,b)=>(AN2_BIG.test(a.muscle)?0:1)-(AN2_BIG.test(b.muscle)?0:1)
  ||a.muscle.localeCompare(b.muscle,'de'));}
// Eine ganze Richtung ohne einen einzigen Satz? Nur, wenn mindestens zwei ihrer Gruppen bekannt sind –
// aus einer einzigen Gruppe eine ganze Bewegungsrichtung zu behaupten wäre zu viel gesagt.
function an2MoveGap(rows){
  for(const [k,pre] of AN2_MOVE){if(k==='Rumpf')continue; // der Rumpf wird oft bewusst weggelassen
    const mine=rows.filter(r=>an2Move(r.muscle)===k);
    if(mine.length>=2&&mine.every(r=>r.sets===0))return {name:k,pre,rows:an2ByWeight(mine)};}
  return null;}
// Der eine Satz über den Balken: erst die fehlende Richtung, dann die Lücken, dann das Zuwenig, sonst die Bestätigung.
// `next` ist der HANDLUNGSSATZ dazu – das ist der Unterschied zwischen einer Auswertung und einem Rat.
// WHOOP, Oura und MacroFactor machen aus ihren Zahlen genau EINEN Satz, der sagt, was jetzt zu tun ist
// (RESEARCH-25-einsichten). „Seit 28 Tagen kein Zug-Satz" ist eine Feststellung; „Bau nächste Woche
// 2–3 Zug-Sätze ein" ist die Antwort darauf. Es bleibt bei einem Satz, nicht einer Liste.
function anaMuscleMsg(st){
  // Seit der Topf „Ohne Muskelgruppe" auch im Server-Zweig ankommt, kann er der EINZIGE Eintrag sein
  // (kein Plan pflegt Muskelgruppen). Dann gibt es nichts zu bewerten – „jede Gruppe liegt über 10"
  // wäre eine Aussage über Daten, die es nicht gibt.
  const real=st.rows.filter(r=>!r.none);
  if(!real.length)return {tone:'amber',txt:`${pl(st.rows.reduce((s,r)=>s+r.sets,0),'Satz','Sätze')} ohne Muskelgruppe – die Verteilung lässt sich nicht bewerten.`,
    next:'Trag in deinen Übungen die Muskelgruppe nach, dann zeigt dir diese Karte, welche Gruppe zu kurz kommt.'};
  // `perWeek==null` heißt „noch keine abgeschlossene Woche" – daraus wird kein „zu wenig" gemacht.
  const zero=an2ByWeight(real.filter(r=>r.sets===0)),low=real.filter(r=>r.sets>0&&r.perWeek!=null&&r.perWeek<ANA_MUSC_LO);
  const list=xs=>xs.slice(0,3).map(r=>esc2(r.muscle)).join(', ')+(xs.length>3?` und ${pl(xs.length-3,'weitere Gruppe','weitere Gruppen')}`:'');
  const corr=`Der Korridor für Muskelaufbau liegt bei ${fmtNum(ANA_MUSC_LO)}–${fmtNum(ANA_MUSC_HI)} Sätzen je Muskel und Woche.`;
  const gap=an2MoveGap(real);
  if(gap)return {tone:'amber',txt:`Seit ${pl(st.days,'Tag','Tagen')} kein einziger ${gap.pre}Satz – ${list(gap.rows)} ohne jede Belastung.`,
    next:`Nimm nächste Woche ${gap.pre}Übungen in den Plan: zwei Einheiten mit je 4–5 Sätzen. ${corr}`};
  if(zero.length)return {tone:'amber',txt:`In ${pl(st.days,'Tag','Tagen')} kein einziger Satz für ${list(zero)}.`,
    next:`Setz ${esc2(zero[0].muscle)} in die nächste Einheit – 3–4 Sätze reichen zum Anfang. ${corr}`};
  if(low.length)return {tone:'amber',txt:`Unter der Orientierung von ${fmtNum(ANA_MUSC_LO)} Sätzen je Woche: ${low.slice(0,3).map(r=>esc2(r.muscle)+' '+fmtNum(r.perWeek,1)).join(' · ')}.`,
    next:`Häng ${esc2(low[0].muscle)} je Einheit ein bis zwei Sätze an. ${corr}`};
  // Ohne eine einzige abgeschlossene Woche gibt es keinen Wochenschnitt – dann wird auch keiner
  // behauptet. „Jede Gruppe liegt über 10" wäre am Dienstag der ersten Woche schlicht erfunden.
  if(real.every(r=>r.perWeek==null))return {tone:'muted',txt:`Die erste Woche läuft noch – bisher ${pl(real.reduce((s,r)=>s+(+r.thisWeek||0),0),'Satz','Sätze')}.`,
    next:`Sobald eine Woche abgeschlossen ist, steht hier, welche Gruppe zu kurz kommt. ${corr}`};
  return {tone:'green',txt:`Jede Gruppe liegt bei mindestens ${fmtNum(ANA_MUSC_LO)} Sätzen pro Woche.`,
    next:`Lass die Verteilung so und steigere lieber das Gewicht. ${corr}`};}
function anaMuscleHTML(a){
  const st=anaMuscleStats(a);
  // Ohne zählbare Sätze bleibt die Tonnage – dann aber mit dem Etikett, das sie verdient.
  if(!st||!st.rows.length){const ms=(a&&a.muscles)||[];if(!ms.length)return '';
    const max=Math.max(...ms.map(m=>+m.volume||0))||1;
    return `<div class="section-label">Volumen nach Muskelgruppe<span class="sl-r">gesamt</span></div><div class="card">`
      +ms.map(m=>`<div class="ana-muscle"><div class="between meta"><span>${esc2(m.muscle)}</span><span>${anaTons(m.volume)}</span></div><div class="bar"><i style="width:${Math.round((+m.volume||0)/max*100)}%"></i></div></div>`).join('')
      +`<div class="caption mt-3">Volumen = Gewicht × Wiederholungen über die gesamte Zeit. Es sagt nichts darüber, wie viele harte Sätze eine Gruppe bekommen hat, und zählt Übungen mit dem eigenen Körpergewicht mit 0 kg.</div></div>`;}
  // Der Aussagesatz steht seit 2.8.0 OBEN im Segment (anaTrainLeadHTML) – „erst die Einsicht, dann die
  // Zahl". Zweimal derselbe Satz auf einem Bildschirm liest sich wie zwei verschiedene Befunde.
  // Ohne abgeschlossene Woche gibt es keinen Schnitt (`perWeek==null`): dann steht der Stand der
  // laufenden Woche da, neutral gefärbt – und ausdrücklich nicht als „zu wenig".
  const bar=r=>{const pw=r.perWeek,w=pw==null?0:Math.min(100,Math.round(pw/ANA_MUSC_HI*100));
    const cls=pw==null?'unknown':r.sets===0?'zero':pw<ANA_MUSC_LO?'low':pw<=ANA_MUSC_HI?'ok':'high';
    return `<div class="bar corr ${cls}"><i style="width:${w}%"></i></div>`;};
  const val=r=>!r.sets?'0 Sätze':r.perWeek==null?pl(r.thisWeek||r.sets,'Satz','Sätze')+' diese Woche':fmtNum(r.perWeek,1)+' Sätze/Woche';
  // Die laufende Woche steht als eigene Zahl daneben: sie zählt im Schnitt bewusst NICHT mit, und eine
  // Zahl, die man nicht sieht, kann man nicht nachrechnen.
  const row=r=>`<div class="ana-muscle"><div class="between meta"><span>${esc2(r.muscle)}</span><span>${val(r)}</span></div>${bar(r)}
    <div class="caption">${r.none?`${pl(r.sets,'Satz','Sätze')} aus Übungen ohne Muskelgruppe – trag sie in der Übung nach, dann zählen sie oben mit.`
      :r.sets?`${pl(r.sets,'Satz','Sätze')} in ${pl(st.days,'Tag','Tagen')}${r.perWeek==null?'':' · diese Woche '+fmtNum(r.thisWeek||0)}${r.vol?' · '+fmtNum(r.vol)+' kg bewegt':''}`:'nichts eingetragen'}</div></div>`;
  // Gruppen ohne einen einzigen Satz bekommen keinen eigenen Balken (sechs leere Balken untereinander
  // sagen weniger als eine Zeile), aber sie werden vollständig benannt – das ist der eigentliche Befund.
  // Auch hier gilt die Reihenfolge nach Gewicht statt nach Alphabet (A-IV.6).
  const zero=an2ByWeight(st.rows.filter(r=>r.sets===0&&!r.none));
  return `<div class="section-label">Sätze je Muskelgruppe<span class="sl-r">${st.doneWeeks?'Ø je abgeschlossener Woche · '+pl(st.doneWeeks,'Woche','Wochen'):'laufende Woche'}</span></div>
    <div class="card">
    ${st.rows.filter(r=>r.sets>0).map(row).join('')}
    ${zero.length?`<div class="ana-zero">Ohne einen Satz in diesem Zeitraum: ${zero.map(r=>esc2(r.muscle)).join(', ')}.</div>`:''}
    <div class="caption mt-3">Balkenbreite bis ${fmtNum(ANA_MUSC_HI)} Sätze pro Woche, der Strich steht bei ${fmtNum(ANA_MUSC_LO)}. Zwischen ${fmtNum(ANA_MUSC_LO)} und ${fmtNum(ANA_MUSC_HI)} harten Sätzen je Woche liegt die übliche Orientierung für Muskelaufbau – keine feste Regel. Gezählt wird der Schnitt der ${st.doneWeeks?pl(st.doneWeeks,'abgeschlossenen Woche','abgeschlossenen Wochen'):'abgeschlossenen Wochen'} – die laufende Woche bleibt draußen, sonst stünde jeder Montag als Rückstand da. Gezählt werden Arbeitssätze; Aufwärmsätze zählen nicht mit. Jeder Satz zählt auf genau eine Gruppe – der Bizeps beim Rudern ist darin nicht enthalten.${st.partial?' Gezählt wird der Zeitraum, den dein Satzprotokoll vollständig abdeckt.':''}${st.src==='logs'?' Die bewegten Kilogramm lassen Übungen mit dem eigenen Körpergewicht außen vor.':''}</div></div>`;}
// ===== „ERST DIE EINSICHT, DANN DIE ZAHL" (A-IV.6) =====
// Das Trainings-Segment begann mit zwei Kacheln, vier Streifen, einem Diagramm und einer Übungsliste –
// und sagte in keiner Zeile, was davon zu tun ist (RATE-25-analysis M4: „nur Zahlen, keine Einsicht").
// Ganz oben steht deshalb EIN Satz über die Verteilung der Sätze auf die Muskelgruppen: die Frage, die
// eine Trainingsauswertung beantworten muss. Tonnage beantwortet sie nicht – sie belohnt die Beinpresse
// und verschweigt, dass seit Wochen kein Zug-Training stattfand (Befund B22).
// Die Karte ist kein zusätzlicher Weg: sie zeigt denselben Satz, der vorher über den Balken stand, nur
// dort, wo er gelesen wird. Kein Tap kommt dazu.
// Zeile 1 sagt, WAS ist. Zeile 2 sagt, was daraus folgt. Mehr steht nicht in der Karte – die Zahl, auf
// der beides beruht, steht zwei Bildschirme weiter unten als Balken und kann dort nachgeprüft werden.
function anaTrainLeadHTML(a){const st=anaMuscleStats(a);if(!st||!st.rows.length)return '';
  const msg=anaMuscleMsg(st);if(!msg||!msg.txt)return '';
  const sub=msg.next||'';
  // msg.txt und msg.next enthalten bereits durch esc2() gelaufene Muskelnamen – ein zweites esc2
  // machte daraus „&amp;". Im Coach-Blick gehören die Sätze dem Athleten, nicht dem Leser.
  return `<div class="card an2-lead ${anaToneCls(msg.tone)}">${icon(msg.tone==='green'?'check':'alertTriangle',20)}
    <div><div class="eyebrow">${coachView()?'Sätze':'Deine Sätze'} der letzten ${pl(st.days,'Tag','Tage')}</div><b>${msg.txt}</b>${sub?`<div class="meta mt-1">${sub}</div>`:''}</div></div>`;}

// ===== DIE WOCHENREIHE IST EIN KALENDER, KEINE LISTE VON TRAININGSWOCHEN (A-IV.6) =====
// `GET /api/analytics` baut `weeks` aus einer Gruppierung über die Trainingstage: eine Woche OHNE
// Training kommt in der Antwort gar nicht vor. Wer daraus „die letzten n“ schneidet, schneidet
// EINTRÄGE, keine Wochen – und das hat drei Dinge verdorben, die nebeneinander auf einem Bildschirm standen:
//   1. Die Kurve zog eine gerade Linie über die sieben trainingsfreien Wochen zwischen dem 15.6. und
//      dem 10.8., als wäre durchtrainiert worden. Die Pause war im Bild nicht zu sehen.
//   2. Der Chip „4 W“ schnitt vier Einträge: bei Trainingswochen 15.6./10.8./17.8./24.8. spannte die
//      als „4 Wochen“ beschriftete Kurve zehn Kalenderwochen (15.6. bis 24.8. = 70 Tage; elf Wochen
//      einschließlich beider Ränder). Hier stand bis zur dritten Nachbesserungsrunde „vierzehn“ –
//      nachgerechnet falsch, der Prüfer hatte mit „zehn Wochen“ recht. Der Befund bleibt derselbe.
//   3. Der Aussagesatz verglich mit „den 2 Vorwochen“ (Chip 4 W) bzw. „den 4 Vorwochen“ (3 M / 1 J):
//      dieselbe Woche, dasselbe Konto, zwei verschiedene Auskünfte (gemessen „so viel wie im Schnitt“
//      gegen „23 % mehr“). Ein Satz, der von der Chip-Wahl abhängt, ist keine Aussage über das Training.
// Die Reihe wird deshalb DICHT aufgebaut: jede Kalenderwoche des Zeitraums kommt vor, eine ohne
// Training mit `volume:0`. Das ist keine erfundene Zahl – null Sätze sind null Kilogramm.
// Sie beginnt frühestens in der ersten Woche mit Training: vor dem ersten Satz gab es nichts zu zeigen,
// und ein halbes Jahr Nullen vor dem Kontostart wäre eine Aussage über eine Zeit, die die App nicht
// kennt (dieselbe Regel, die `firstDate` schon bei den Sätzen je Muskelgruppe zieht).
function an2WeekSeries(a,nw){
  const src=(a&&Array.isArray(a.weeks))?a.weeks.filter(w=>w&&w.week):[];
  if(!src.length)return [];
  const by={};src.forEach(w=>{by[w.week]={week:w.week,volume:+w.volume||0,sessions:+w.sessions||0};});
  const keys=Object.keys(by).sort();
  const n=Math.max(2,Math.round(+nw||2)),mon=anaMonday(today());
  // Ein Satz mit Datum in der Zukunft (nachgetragen mit `?date=`) darf nicht aus dem Bild fallen.
  const end=keys[keys.length-1]>mon?keys[keys.length-1]:mon;
  let start=anaAddDays(end,-7*(n-1));
  if(keys[0]>start)start=anaMonday(keys[0]);
  const out=[];
  for(let w=start,i=0;w<=end&&i<400;w=anaAddDays(w,7),i++)out.push(by[w]||{week:w,volume:0,sessions:0,gap:true});
  return out;}
// Der Satz über der Volumenkurve. Verglichen wird die zuletzt ABGESCHLOSSENE Woche mit dem Schnitt der
// vier Wochen davor: die laufende Woche gegen volle Wochen zu stellen, ergäbe jeden Montag einen
// Einbruch von 80 % (dieselbe Falle, die der hohle Punkt im Bild schon entschärft).
// Vier Vorwochen sind FEST – nicht so viele, wie der gewählte Chip gerade übrig lässt. Der Zeitraum
// bestimmt, wie weit die Kurve zurückreicht; der Satz darunter beantwortet immer dieselbe Frage.
const AN2_SAY_REF=4;
function an2WeekSay(a){const ser=an2WeekSeries(a,AN2_SAY_REF+2);
  if(ser.length<2)return null;
  return an2VolumeSay(ser,ser[ser.length-1].week===anaMonday(today()));}
function an2VolumeSay(weeks,running){
  const done=running?weeks.slice(0,-1):weeks.slice();
  if(done.length<2)return null;
  const lastW=done[done.length-1],ref=done.slice(-(AN2_SAY_REF+1),-1);
  if(!ref.length)return null;
  const mean=ref.reduce((s,w)=>s+(+w.volume||0),0)/ref.length;
  const v=+lastW.volume||0,wk=`Woche ab ${fmtDate(lastW.week)}`;
  // Die Vorwochen bekommen ein Datum. Der Satz rechnet bewusst mit FEST vier Vorwochen, damit er nicht
  // mit dem Zeitraum-Chip die Auskunft wechselt – dadurch liegen bei „4 W" aber zwei der vier
  // Vergleichswochen außerhalb der gezeichneten Kurve. Ohne Datum wäre die Bezugsgröße dann nirgends
  // nachzählbar: gemessen zeigt „4 W" die Wochen ab 24.8./31.8./7.9./14.9., verglichen wird mit
  // 10.8.–31.8. Mit der Spanne im Satz stimmt die Aussage in jedem Chip und ist in jedem überprüfbar.
  const nRef=pl(ref.length,'Vorwoche','Vorwochen')
    +(ref.length>1?` (${fmtDate(ref[0].week)} bis ${fmtDate(ref[ref.length-1].week)})`:` (ab ${fmtDate(ref[0].week)})`);
  const pause=ref.filter(w=>!(+w.volume>0)).length;
  // Seit die Reihe dicht ist, können Vorwochen 0 sein – und „100 % weniger als im Schnitt“ wäre für
  // eine Pause eine alberne Auskunft. Beide Ränder bekommen deshalb einen eigenen Satz, statt (wie bis
  // 2.8.0) ganz zu verstummen, sobald der Schnitt 0 ist.
  if(!(v>0))return {tone:'amber',txt:mean>0
    ?`${wk}: kein Training eingetragen – in den ${nRef} waren es im Schnitt ${anaTons(mean)}.`
    :`${wk}: kein Training eingetragen – wie in den ${pl(pause,'Woche','Wochen')} davor.`};
  if(!(mean>0))return {tone:'green',txt:`${wk}: ${anaTons(v)} – die erste Woche mit Training nach mindestens ${pl(pause,'Woche','Wochen')} Pause.`};
  const pct=Math.round((v-mean)/mean*100);
  if(Math.abs(pct)<10)return {tone:'muted',txt:`${wk}: ${anaTons(v)} – so viel wie im Schnitt der ${nRef}.`};
  return {tone:pct>0?'green':'amber',txt:`${wk}: ${anaTons(v)} – ${fmtNum(Math.abs(pct))} % ${pct>0?'mehr':'weniger'} als im Schnitt der ${nRef}.`};}

function anaPaintTraining(){const b=document.getElementById('anaBody');if(!b)return;
  const a=anaCached('analytics'),INS=anaCached('insights'),MG=anaCached('monthly'),cardio=anaCached('cardio');
  const empty=!a||!a.totals||!a.totals.totalSets;
  const wk=anaWeek(a,INS);let h='';
  if(!empty){const tw=wk.tw,lw=wk.lw;const dv=(tw.volume||0)-(lw.volume||0);
    // Die laufende Woche ist keine fertige Woche. Bis 2.7.0 stellte diese Kachel am Montag „2,0 t" neben
    // „Vorwoche 27,3 t", malte den Pfeil nach unten und tönte ihn amber – ein Einbruch von 92 %, der
    // keiner ist, sondern Tag 1 von 7. Genau diese Art Fehlalarm soll die Welle abstellen (P4): solange
    // die Woche läuft, gibt es keinen Ton und keine Richtung, sondern den Stand („Tag 1 von 7"). Der
    // Aussagesatz über der Kurve rechnet schon seit dieser Version nur mit abgeschlossenen Wochen
    // (`an2VolumeSay`) – die Kachel folgt jetzt derselben Regel, statt ihr zu widersprechen.
    const wkDay=((new Date(today()+'T00:00:00').getDay()+6)%7)+1,wkRun=wkDay<7;
    const vCls=(wkRun||!lw.volume)?'':(dv>0?'up':dv<0?'amber':'');
    const vIc=wkRun?'trendFlat':(dv>0?'trendUp':dv<0?'trendDown':'trendFlat');
    const vTxt=wkRun?`Tag ${wkDay} von 7 · Vorwoche ${anaTons(lw.volume)}`:`Vorwoche ${anaTons(lw.volume)}`;
    h+=`<div class="tiles" id="anaTiles">
      <div class="tile"><div class="v">${fmtNum(tw.sessions)}<em> / ${fmtNum(wk.target)}</em></div><div class="l">Trainings diese Woche</div><div class="trend ${tw.sessions>=wk.target?'up':''}">${tw.sessions>=wk.target?icon('check',14)+' Wochenziel erreicht':`${pl(wk.target-tw.sessions,'Training','Trainings')} offen`}</div></div>
      <div class="tile"><div class="v">${anaTons(tw.volume)}</div><div class="l">Volumen diese Woche</div><div class="trend ${vCls}">${icon(vIc,14)} ${vTxt}</div></div>
    </div>
    <div class="meta mb-3 ana-lifetime">Gesamt: ${pl(a.totals.totalSessions,'Trainingstag','Trainingstage')} · ${pl(a.totals.totalSets,'Satz','Sätze')} · ${anaTons(a.totals.totalVolume)}</div>`;
    h+=anaTrainLeadHTML(a);}
  // Ohne Trainingsdaten steht der Handlungsaufruf oben, die Ziele darunter
  if(empty){h+=emptyState({icon:'dumbbell',title:'Noch keine Trainingsdaten',text:'Sobald Sätze eingetragen sind, erscheinen hier Volumen, Häufigkeit und der Verlauf jeder Übung.',btn:coachView()?null:{label:'Training starten',onclick:"renderWorkout.tab='kraft';go('workout')"}});
    h+=anaGoalsStrip(INS,MG,cardio,wk);b.innerHTML=h;return;}
  h+=anaGoalsStrip(INS,MG,cardio,wk);
  // Wochen-Volumen (laufende Woche als hohler Punkt) – Zeitraum aus den Chips (vorher: immer alles).
  if(a.weeks&&a.weeks.length>=2){
    // `nw` ist die Zahl der KALENDERWOCHEN, die der Chip verspricht (4 W = 4, 3 M = 13, 1 J = 52) –
    // mit `an2WeekSeries()` steht darunter jetzt auch genau diese Zahl von Punkten, Lücken inbegriffen.
    const nw=Math.max(2,Math.round(an2Range().days/7));
    const weeks=an2WeekSeries(a,nw);
    if(weeks.length>=2){
    const cur=weeks[weeks.length-1];const running=cur.week===anaMonday(today());
    const gaps=weeks.filter(w=>w.gap).length;
    h+=an2ChipsHTML();
    h+=`<div class="chart-card" id="chart-volume"><div class="ch-h"><div class="t">Wochen-Volumen</div><div class="v">${running?'läuft: ':'zuletzt '}${anaTons(cur.volume)}</div></div>${an2SayHTML(an2WeekSay(a))}${lineChart(weeks.map(w=>({date:w.week,value:w.volume/1000})),'t',{partialLast:running,tickFmt:v=>fmtNum(v,Number.isInteger(v)?0:1)+' t'})}<div class="caption mt-2">Gewicht × Wiederholungen pro Woche · Übungen mit dem eigenen Körpergewicht zählen dabei 0 kg${running?' · hohler Punkt = laufende Woche':''}${gaps?` · ${pl(gaps,'Woche','Wochen')} ohne Training stehen als 0`:''}</div></div>`;}}
  // Übungen: nach Fortschritt sortiert, Drilldown
  const exs=(a.exercises||[]).map(e=>({...e,gain:Math.round(((+e.lastWeight||0)-(+e.firstWeight||0))*10)/10}))
    .sort((x,y)=>{const nx=x.sessions<2,ny=y.sessions<2;if(nx!==ny)return nx?1:-1;return y.gain-x.gain;});
  h+=`<div class="section-label">Übungen<span class="sl-r">nach Fortschritt</span></div>`;
  const vari=anaExVariants(exs); // gleichnamige Übungen unterscheidbar machen
  // e1RM erscheint ab Stufe 2. Wird es überhaupt gezeigt, steht die Erklärung EINMAL unter der Liste –
  // nicht „(geschätzt)" hinter jeder der acht Zeilen. Gemessen bei 390 px kostete der Zusatz je Zeile
  // eine dritte Textzeile (Umbruch), also acht zusätzliche Zeilen für dieselbe eine Auskunft.
  let anyE1=false;
  if(exs.length){h+='<div class="rows">'+exs.map(e=>{
      const t=e.sessions<2?`<span class="muted-2">neu</span>`:e.gain>0?`<span class="trend up">${icon('trendUp',14)} +${fmtNum(e.gain,1)} kg</span>`:e.gain<0?`<span class="trend amber">${icon('trendDown',14)} ${fmtNum(e.gain,1)} kg</span>`:`<span class="muted-2">${icon('trendFlat',14)} stabil</span>`;
      const v=vari[e.id]||'';const full=e.name+(v?' · '+v:'');
      // „zuletzt Fr., 11. Sept. · 92,5 kg × 8" statt „9 Einheiten · Quads": lastDate, lastWeight und
      // repsAtTop liegen seit 2.1 in der Antwort und standen auf keinem Bildschirm (Befund M4/M10).
      // Das ist die Zeile, die ein Athlet vor dem Satz wissen will – und sie kostet keinen Tap.
      const last=(e.lastDate&&+e.lastWeight>0)?`zuletzt ${fmtDate(e.lastDate,{weekday:'short'})} · ${fmtNum(e.lastWeight,1)} kg${+e.repsAtTop>0?' × '+fmtNum(e.repsAtTop):''}`:'';
      // „1RM ~110 kg" ist für einen Einsteiger ein Rätsel (Befund Anfänger: unerklärte Fachbegriffe).
      const e1=(an2Level()>=2&&e.best1rm)?' · e1RM ~'+fmtNum(e.best1rm)+' kg':'';
      if(e1)anyE1=true;
      const meta=pl(e.sessions,'Einheit','Einheiten')+(e.muscle?' · '+esc2(e.muscle):'')+e1;
      // Zwei Zeilen nur, wenn es zwei zu sagen gibt: ohne letzten Satz (neue Übung) bleibt es bei einer,
      // statt „undefined" darunterzuschreiben.
      const sub=last?`<small>${last}</small><small class="muted-2">${meta}</small>`:`<small>${meta}</small>`;
      return `<div class="row tap" role="button" tabindex="0" onclick="anaExHistory(${e.id},'${esc(full)}')"><div class="rl">${esc2(e.name)}${v?` <span class="ana-vari">${esc2(v)}</span>`:''}${sub}</div><div class="rr">${t}</div></div>`;}).join('')+'</div>';}
  else h+='<div class="note">Noch keine Übungen mit Sätzen.</div>';
  if(anyE1)h+=`<div class="caption mt-2">e1RM = geschätztes Einer-Maximum, aus deinem besten Satz gerechnet – nicht gemessen. Die Zahl neben der Übung ist die Veränderung deines Arbeitsgewichts.</div>`;
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
    .map(x=>({date:x.date,top:+x.weight,reps:+x.reps,e1rm:+x.e1rm||0})).sort((x,y)=>x.date<y.date?-1:1);
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
  h+=an2E1rmHTML(sess,r.data);
  h+=`<div class="section-label">Letzte Einheiten</div><div class="rows">`+sess.slice(-3).reverse().map(s=>`<div class="row"><div class="rl">${fmtDate(s.date,{weekday:'short'})}<small>${setsTxt(s)}</small></div><div class="rr">${fmtNum(s.top,1)} kg × ${fmtNum(s.reps)}</div></div>`).join('')+`</div>`;
  openSheet(name,h);}
// ===== B-I.5 · e1RM-VERLAUF JE ÜBUNG, MIT BENANNTER FORMEL =====
// Bis 2.9.0 stand das geschätzte Einer-Maximum als EINE Zahl neben der Übung („e1RM ~97 kg", ab
// Stufe 2) – ein Punkt, kein Verlauf. Für einen Kraftsportler ist aber genau der Verlauf die
// Kennzahl: Hevy, Strong und Alpha Progression zeigen unabhängig voneinander dieselben drei
// Rekordarten mit Verlauf, e1RM ist bei allen dreien dabei (M23, [Q20][Q21][Q60]).
//
// Was hier NICHT passiert und warum:
//  · Keine zweite Rechnung. Die Werte kommen fertig aus GET /api/exercise-history (`history[].e1rm`),
//    und die Route rechnet mit `estimate1RM()` aus logic.js – derselben Funktion, aus der auch die
//    Zahl in der Übungsliste und die Bestleistung stammen. Der Browser rechnet keinen einzigen
//    e1RM-Wert selbst (CRITIC K1: eine Frage, eine Rechnung).
//  · Keine Vergleiche zwischen Übungen. Der Umrechnungsfaktor ist gewichtsabhängig; eine Auswertung
//    von 303.494 Sätzen zeigt, dass Formeln mit festem Faktor das systematisch unterschätzen
//    ([Q61], Preprint – kein Grund, die Formel zu wechseln, aber ein Grund, nicht quer zu
//    vergleichen). Der Verlauf steht deshalb IM Sheet einer Übung und nirgends daneben.
//  · Keine unbenannte Zahl. Die Fußnote nennt Formel, Rechenweg, Wiederholungs-Grenze und die
//    Tatsache, dass Aufwärmsätze nicht zählen (P3). Alle vier Angaben sind im Server nachprüfbar:
//    `estimate1RM` (Epley, `w*(1+r/30)`, `E1RM_MAX_REPS=12`) und `SQL_SET_WORK` in movementSetLogs.
// Der Server darf beides mitschicken (`formula`, `repsMax`), falls die Regel dort je wechselt –
// dann gewinnt seine Angabe und die Fußnote stimmt weiter.
const AN2_E1RM_FORMULA='Epley',AN2_E1RM_MAXREPS=12;
function an2E1rmHTML(sess,data){
  // Dieselbe Stufen-Grenze wie in der Übungsliste: e1RM ab Stufe 2 (STRATEGY-25 Abschnitt 4).
  // Zwei Orte, eine Regel – sonst erklärt die Liste das Kürzel nicht und das Sheet zeigt es doch.
  if(an2Level()<2)return '';
  const rows=(sess||[]).filter(s=>s&&s.e1rm>0).map(s=>({date:s.date,value:s.e1rm,reps:s.reps,top:s.top}));
  const formula=String((data&&data.formula)||AN2_E1RM_FORMULA);
  const maxReps=+((data&&data.repsMax))>0?+data.repsMax:AN2_E1RM_MAXREPS;
  const foot=`<div class="caption mt-2">e1RM = geschätztes Einer-Maximum nach ${esc2(formula)}: Gewicht × (1 + Wiederholungen ÷ 30). Gerechnet aus deinem besten Arbeitssatz je Trainingstag, nur bis ${fmtNum(maxReps)} Wiederholungen – darüber wird die Formel unbrauchbar. Aufwärmsätze zählen nicht. Die Zahl ist geschätzt, nicht gemessen, und nur innerhalb dieser Übung vergleichbar.</div>`;
  // Kein einziger schätzbarer Satz (alles über der Grenze): das ist eine Auskunft, kein leerer Kasten.
  if(!rows.length)return `<div class="note mb-3">Für diese Übung gibt es noch keinen e1RM: geschätzt wird nur aus Arbeitssätzen bis ${fmtNum(maxReps)} Wiederholungen.</div>`;
  const last=rows[rows.length-1],first=rows[0];
  const best=rows.reduce((a,b)=>b.value>a.value?b:a);
  // Richtung aus dem MEDIAN der ersten und der letzten drei schätzbaren Einheiten, nicht aus
  // „letzter Punkt minus erster Punkt". Das ist genau der Fehler, an dem die Gewichtskurve bis 2.8.0
  // scheiterte (Befund M1: Kopfzeile „+15,4 kg" neben Kachel „+0,1 kg/Woche") – ein einzelner guter
  // oder schlechter Tag am Rand entschied sonst über die Aussage einer ganzen Kurve.
  const med=xs=>(typeof wk2Median==='function')?wk2Median(xs):xs.slice().sort((a,b)=>a-b)[Math.floor(xs.length/2)];
  const k=Math.min(3,Math.floor(rows.length/2))||1;
  const d=Math.round((med(rows.slice(-k).map(r=>r.value))-med(rows.slice(0,k).map(r=>r.value)))*10)/10;
  if(rows.length<2)return `<div class="note mb-3">e1RM ${fmtNum(last.value,1)} kg aus ${fmtNum(last.top,1)} kg × ${fmtNum(last.reps)} – ab der zweiten schätzbaren Einheit erscheint hier der Verlauf.</div>${foot}`;
  // Der eine Satz über der Kurve – Richtung und Tempo, nicht noch einmal die Zahl aus der Kopfzeile.
  const seit=`seit ${fmtDate(first.date,{month:'long'})}`;
  const say=Math.abs(d)<0.5
    ?{tone:'muted',txt:`Dein geschätztes Maximum steht ${seit} praktisch still.`}
    :{tone:d>0?'green':'amber',txt:`Dein geschätztes Maximum ist ${seit} um ${fmtNum(Math.abs(d),1)} kg ${d>0?'gestiegen':'gefallen'} – verglichen sind die ersten und die letzten ${pl(k,'Einheit','Einheiten')}.`};
  // „Bestwert" nur, wenn er wirklich über dem letzten Wert liegt – sonst stünde zweimal dieselbe Zahl
  // in derselben Kopfzeile („136,7 kg zuletzt · Bestwert 136,7 kg").
  const head=`${fmtNum(last.value,1)} kg zuletzt${best.value>last.value+0.05?` · Bestwert ${fmtNum(best.value,1)} kg`:''}`;
  // Mindestspanne wie bei der Gewichtskurve (Befund N1): 3,4 kg Unterschied über die volle Kartenhöhe
  // gespreizt sehen aus wie ein Sprung. Fünf Kilo sind die kleinste Spanne, in der ein e1RM-Schritt
  // (2,5 kg Scheibe) noch als Schritt und nicht als Absturz erscheint.
  const vs=rows.map(r=>r.value),lo=Math.min(...vs),hi=Math.max(...vs),o={avg:0};
  if(hi-lo<5){const c=(hi+lo)/2,d0=Math.max(0,Math.floor((c-5)/5)*5);o.domain=[d0,d0+10];o.step=5;}
  return `<div class="chart-card mb-3"><div class="ch-h"><div class="t">e1RM-Verlauf</div><div class="v">${head}</div></div>`
    +an2SayHTML(say)+metricChart(rows,'kg',null,null,o)
    +`<div class="caption mt-2">Punkte = bester Arbeitssatz je Trainingstag, zuletzt ${fmtNum(last.top,1)} kg × ${fmtNum(last.reps)}.</div>${foot}</div>`;}

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
    :anaNotLoaded('Wochenzahlen',rq.status|0,"drawAnaWeek({refresh:true})"));return;}
  // prevStart===null heißt „davor gibt es nichts mehr" – die Grenze im Nutzer-Cache festhalten (er wird
  // beim Athletenwechsel ohnehin komplett verworfen, anaCache()).
  if(w.prevStart===null)anaCache().weekFirst=w.start||start;
  if(before!==JSON.stringify(w))anaPaintWeek(w);
  // B-I.5: Rekorde und Beschwerden kommen NACH den Zahlen – wer den Bericht öffnet, wartet keine
  // Millisekunde länger darauf. Treffen sie ein, wird einmal nachgezeichnet; bleibt die Route aus
  // (älterer Server), steht der Bericht unverändert da.
  const had=JSON.stringify(anaCached('wr:'+start)||null);
  try{const ex=await an2WeekExtra(start);
    if(document.getElementById('anaBody')&&renderTracker.tab==='woche'&&ANA_WEEK_START===start
      &&JSON.stringify(ex||null)!==had)anaPaintWeek(anaCached('week:'+start)||w);
  }catch(e){}}
// Wochenwechsel: prevStart/nextStart kommen aus der Antwort, hier wird nur umgeschaltet.
// drawAnaWeek.own mitschreiben – sonst hielte der nächste Einstieg diesen Wert für einen Deep-Link.
function anaWeekNav(start){if(!start)return;ANA_WEEK_START=drawAnaWeek.own=start;drawAnaWeek();}

// ===== B-I.5 · DER WOCHENBERICHT: ZWEI KORRIDORE, DANN DIE ZAHLEN =====
// Der Rückblick gab es seit 2.3.0 als eigene Ansicht samt Deep-Link aus der Sonntags-Nachricht
// (`#tracker/woche/JJJJ-MM-TT`). Was ihm fehlte, war die Antwort auf die EINE Frage, für die man
// einen Wochenbericht öffnet: „War die Woche im Korridor?" (Muster M15). Stattdessen begann er mit
// Highlights und ging dann in eine Zahlenwand über, in der „4 / 3 Trainings" und „6 von 7 Tagen
// protokolliert" gleichberechtigt neben „Ø Schritte" standen.
//
// Zwei Korridore stehen jetzt oben – Training und Ernährung, beide als Band und nicht als Ja/Nein:
//  · TRAINING. TrainingPeaks bewertet die Abweichung, nicht die Person: ±20 % grün, 50–79 % bzw.
//    121–150 % gelb, darüber hinaus orange [Q23]. 90 % vom Plan sind kein Versagen (M22). Genau
//    diese Grenzen sind hier übernommen, statt eigene zu erfinden.
//  · ERNÄHRUNG. Dieselbe Idee mit der Zahl, die der Server ohnehin rechnet: Tage im Kalorienziel
//    (±5 %, `onTargetDays` in weekView) von sieben. Ein Toleranzband statt „Ziel verfehlt".
// Die Tonalität ist aufgabenbezogen, nie personenbezogen: „über dem Plan", nicht „überlastet" –
// Feedback, das auf die Person zielt, verschlechtert die Leistung in über einem Drittel der Fälle
// (Kluger & DeNisi 1996, 607 Effektgrößen [Q38]). Und es gibt kein Rot: das Band ist eine
// Einordnung, keine Warnung.
const WK2_CMP_BANDS=[[80,120,'green','im Korridor'],[50,79,'amber','unter dem Plan'],[121,150,'amber','über dem Plan']];
function wk2Band3(pct){for(const [lo,hi,tone,label] of WK2_CMP_BANDS)if(pct>=lo&&pct<=hi)return {tone,label};
  return {tone:'amber',label:pct>120?'deutlich über dem Plan':'deutlich unter dem Plan'};}
// EINE ZAHL, EIN WEG: Liegt der Wochenbericht des Servers vor (GET /api/weekreport, Paket B-I.2),
// gewinnen SEINE Prozentsätze – dieselben, mit denen die Sonntags-Nachricht und die Review-Inbox des
// Coachs rechnen. Sonst rechnet dieselbe Formel hier (done/planned bzw. Logtage/7). Zwei Zahlen für
// dieselbe Frage sind der Fehler, den CRITIC K1 beschreibt; die Rangfolge verhindert ihn.
// {done,planned,pct,tone,label} – oder null ohne hinterlegten Rhythmus (dann gibt es keine Bezugsgröße,
// und „0 von 1 geplanten Einheit" wäre erfunden; dieselbe Regel wie in anaWeekConsistency).
function wk2Compliance(t,srv){
  const S=srv&&srv.compliance&&srv.compliance.training;
  const planned=Math.round(+((S&&S.planned)||(t&&t.planned)||0));
  const done=(S&&S.done!=null)?+S.done:((t&&t.sessions!=null)?+t.sessions:null);
  if(!(planned>0)||done==null)return null;
  const pct=(S&&S.pct!=null&&isFinite(+S.pct))?Math.round(+S.pct):Math.round(done/planned*100);
  const b=wk2Band3(pct);
  return {done,planned,pct,tone:b.tone,label:b.label,src:S?'server':'lokal'};}
// {logged,onTarget,pct,tone,label} – ADHÄRENZ = protokollierte Tage von sieben, genau so, wie der
// Server sie in `compliance.nutrition.pct` rechnet. Bewusst NICHT „Tage im Kalorienziel": die
// Kalorienlücke steht schon im Fokus-Satz darüber („Mehr essen · Ø 1916 statt 2809 kcal"), und
// dieselbe Sache zweimal auf einem Bildschirm liest niemand als dieselbe Sache. Die Trefferquote
// steht als Herkunftsangabe daneben – als Zahl, nicht als Urteil ([Q38], M12: Adhärenz-neutral).
function wk2Adherence(n,srv){
  const S=srv&&srv.compliance&&srv.compliance.nutrition;
  const logged=(S&&S.daysLogged!=null)?+S.daysLogged:((n&&n.daysLogged!=null)?+n.daysLogged:null);
  if(logged==null)return null;
  const onTarget=(S&&S.onTarget!=null)?+S.onTarget:((n&&n.onTargetDays!=null)?+n.onTargetDays:null);
  const pct=(S&&S.pct!=null&&isFinite(+S.pct))?Math.round(+S.pct):Math.round(logged/7*100);
  const b=pct>=80?{tone:'green',label:'im Korridor'}:pct>=50?{tone:'amber',label:'lückenhaft'}:{tone:'amber',label:'kaum protokolliert'};
  return {logged,onTarget,pct,tone:b.tone,label:b.label,src:S?'server':'lokal'};}
// Die Bilanz-Karte. Sie steht zwischen dem Fokus und den Zahlenblöcken: erst was war, dann die Belege.
// Bewusst KEINE eigene Zahl erfunden – jede hier stammt aus `w.training` bzw. `w.nutrition`.
// WICHTIG – warum die Karte die Zahlen NICHT wiederholt: Über ihr stehen bereits die Konsistenz-Zeile
// („Woche geschafft · 4 von 3 Einheiten", derselbe Wortlaut wie auf der Startseite, CRITIC K10) und der
// Highlight-Satz des Servers („4 von 3 Einheiten – Wochenziel erfüllt."). Eine dritte Fassung derselben
// Aussage wäre genau die Doppelung, wegen der A-IV.6 schon die gewählte Kachel im Körper-Segment still
// gestellt hat (Befund B8). Die Karte trägt deshalb NUR das, was neu ist: den Prozentsatz, das Band und
// den Satz, woher beides kommt. Im Gegenzug entfallen unten die Zeile „Trainings 4 / 3" und der Zusatz
// „davon 0 Tage im Kalorienziel" – beide stehen jetzt hier, mit Einordnung statt nur als Zahl.
function wk2BalanceHTML(w,isCur,srv){
  const c=wk2Compliance(w.training,srv),a=wk2Adherence(w.nutrition,srv);
  if(!c&&!a)return '';
  const row=(lbl,pct,tone,band,why)=>`<div class="wk2-bal-r">
      <div class="wk2-bal-t">${lbl}<small>${esc2(why)}</small></div>
      <div class="wk2-bal-v"><b>${fmtNum(pct)} %</b><span class="wk2-bal-b ${anaToneCls(tone)}">${esc2(band)}</span></div></div>`;
  let h='';
  // In der LAUFENDEN Woche ist jedes Band eine Zwischenbilanz – am Dienstag „43 % · unter dem Plan" zu
  // melden wäre derselbe Fehlalarm, den die Volumen-Kachel im Trainings-Segment abgestellt hat (P4).
  // Dann steht der Stand da, aber ohne Urteil und ohne Ton.
  const day=((new Date(today()+'T00:00:00').getDay()+6)%7)+1;
  const pv=w.prev||{};
  if(c){const prevPct=(pv.sessions!=null&&c.planned>0)?Math.round(+pv.sessions/c.planned*100):null;
    h+=row('Training',c.pct,isCur?'':c.tone,isCur?`Tag ${fmtNum(day)} von 7`:c.label,
      `Anteil der ${pl(c.planned,'geplanten Einheit','geplanten Einheiten')} · als getroffen gilt ein Korridor von 80–120 %`
      +(prevPct!=null?` · Vorwoche ${fmtNum(prevPct)} %`:''));}
  if(a)h+=row('Ernährung',a.pct,isCur?'':a.tone,isCur?`Tag ${fmtNum(day)} von 7`:a.label,
    `${fmtNum(a.logged)} von 7 Tagen protokolliert${a.onTarget!=null?` · davon ${pl(a.onTarget,'Tag','Tage')} im Kalorienziel (±5 %)`:''}`);
  return `<div class="card wk2-bal">${h}</div>`;}

// --- Rekorde der Woche und offene Beschwerden ---------------------------------------------------
// Beide Listen kommen von außen und werden nur gezeigt, wenn sie wirklich da sind:
//  · `w.prList` bzw. der Wochenbericht des Servers (GET /api/weekreport, Paket B-I.2) liefert die
//    Rekorde MIT Übung, Gewicht, Wiederholungen und dem alten Bestwert. Bis 2.9.0 stand im Rückblick
//    nur eine Zahl („Bestleistungen 4") – gezählt, nie gezeigt (RATE-25-analysis, Befund M10).
//    Kommt die Liste nicht, bleibt die Zahl stehen: eine Liste zu erfinden wäre schlimmer.
//  · Beschwerden: Für den COACH liegt die offene Liste in GET /api/flagged-notes (er darf sie sehen,
//    der Athlet holt sie über dieselbe Route nicht). Sie wird hier bewusst NUR gezählt und benannt,
//    nicht bearbeitet – bearbeitet wird sie im Coach-Dashboard (Paket B-I.6). Zwei Arbeitsflächen für
//    dieselbe Beschwerde wären genau die Doppelung, vor der CRITIC K3 warnt.
function wk2PrRows(w,ex){const list=(ex&&ex.prs)||w.prList||(ex&&ex.records)||null;
  if(!Array.isArray(list)||!list.length)return '';
  return `<div class="section-label">Rekorde dieser Woche</div><div class="rows">`+list.slice(0,8).map(p=>{
    const nm=esc2(String(p.exercise||p.name||'Übung'));
    const val=(+p.weight>0)?`${fmtNum(p.weight,1)}<em> kg</em>${+p.reps>0?` × ${fmtNum(p.reps)}`:''}`:(+p.e1rm>0?`${fmtNum(p.e1rm,1)}<em> kg e1RM</em>`:'–');
    const before=(+p.prev>0)?`vorher ${fmtNum(p.prev,1)} kg`:(+p.before>0?`vorher ${fmtNum(p.before,1)} kg`:'');
    const when=p.date?fmtDate(p.date,{weekday:'short'}):'';
    return `<div class="row"><div class="rl">${nm}<small>${[when,before].filter(Boolean).join(' · ')}</small></div><div class="rr"><span class="v">${val}</span></div></div>`;}).join('')+`</div>`;}
// Beschwerden für BEIDE Rollen aus derselben Quelle, in zwei Tonlagen:
//  · Der Wochenbericht des Servers liefert `complaints:{week,open,latest:[{date,exercise}]}` – bewusst
//    ohne Freitext (Datensparsamkeit, SEC-23). Das reicht für den Bericht: WAS offen ist und WIE VIELE.
//  · Der Coach hat zusätzlich GET /api/flagged-notes und bekommt den Knopf ins Dashboard; der Athlet
//    bekommt den Satz „liegt bei deinem Coach" statt eines Knopfs, den er nicht drücken kann.
// Der Freitext der Beschwerde steht hier an KEINER Stelle – er gehört in die Übung und ins Dashboard.
function wk2FlagRows(flags,srv){
  const co=srv&&srv.complaints;
  let list=(flags||[]).filter(Boolean).map(f=>({exercise:f.exercise_name||'Übung',date:f.date}));
  if(!list.length&&co&&Array.isArray(co.latest))list=co.latest.filter(Boolean).map(f=>({exercise:f.exercise||'Übung',date:f.date}));
  const open=(co&&+co.open>0)?+co.open:list.length;
  if(!open)return '';
  const names=[...new Set(list.map(f=>String(f.exercise||'Übung')))].slice(0,3).join(', ');
  if(!coachView())return `<div class="section-label">Beschwerden</div><div class="rows"><div class="row"><div class="rl">${pl(open,'offene Beschwerde','offene Beschwerden')}<small>${esc2(names)||'zu deinen Übungen'} · liegt bei deinem Coach</small></div><div class="rr"></div></div></div>`;
  return wk2FlagCoachHTML(open,names);}
// Der Knopf führt genau dorthin, wo die Beschwerde bearbeitet wird (Coach-Dashboard, Paket B-I.6) –
// `openDashboard` gehört coach.js und wird defensiv aufgerufen: fehlt es, bleibt die Athletenliste.
function wk2FlagCoachHTML(open,names){
  return `<div class="section-label">Beschwerden</div><div class="rows"><div class="row"><div class="rl">${pl(open,'offene Beschwerde','offene Beschwerden')}<small>${esc2(names)||'zu den Übungen dieses Athleten'}${open>3?' …':''}</small></div>`
    +`<div class="rr"><button class="btn sm sec" onclick="typeof openDashboard==='function'?openDashboard(VIEW_USER):go('athletes')">Bearbeiten</button></div></div></div>`;}
// Beistellungen des Wochenberichts (Rekorde, Beschwerden) – eine Anfrage je Woche, nie auf dem
// kritischen Pfad: die Zahlen stehen längst, wenn sie ankommt, und ein Fehlschlag ändert nichts.
// Gibt es die Route nicht (älterer Server, Paket B-I.2 noch nicht ausgeliefert), wird sie in dieser
// Sitzung nicht wieder gefragt – derselbe Riegel wie STL_ROUTE_GONE in home.js. Sonst kostete jeder
// Blick in eine Woche eine 404-Anfrage, und zwar dauerhaft.
let AN2_WR_GONE=false;
const AN2_WR_DEAD={404:1,405:1,501:1};
async function an2WeekExtra(start){const k='wr:'+start;
  if(anaEntry(k)&&!anaStale(k))return anaCached(k);
  const out={};
  if(!AN2_WR_GONE){const r=await API.get('/weekreport/'+VIEW_USER+'?start='+encodeURIComponent(start));
    if(AN2_WR_DEAD[r.status|0])AN2_WR_GONE=true;
    else if(r.status===200&&r.data&&typeof r.data==='object')Object.assign(out,r.data);}
  if(coachView()){const f=await API.get('/flagged-notes/'+VIEW_USER);
    if(f.status===200&&f.data&&Array.isArray(f.data.notes))out.flags=f.data.notes;}
  return anaStore(k,out);}

// Eine Zeile des Rückblicks. label/val/sub/cmp sind FERTIGES HTML – Serverdaten müssen vorher
// durch esc2(), Zahlen durch fmtNum(). Der Vergleich steht unter dem Wert, nicht daneben (320 px).
function _weekRow(label,val,sub,cmp){return `<div class="row ana-wk-row"><div class="rl">${label}${sub?`<small>${sub}</small>`:''}</div><div class="rr"><span class="v">${val}</span>${cmp?`<span class="wk-cmp">${cmp}</span>`:''}</div></div>`;}

// Die Konsistenz-Zeile des Wochenrückblicks – dieselbe EINE Mechanik wie auf der Startseite
// (CRITIC K10, BUILD-A5 5.6). Gerechnet und formuliert wird sie NICHT hier, sondern in lpWeekLine()
// (home.js); diese Funktion reicht nur die Zahlen der angezeigten Woche hinüber. Genau darum geht es:
// eine Zählung, ein Wortlaut, zwei Ansichten.
// Ohne hinterlegten Rhythmus ist `planned` 0 – dann gibt es keine Bezugsgröße und die Zeile bleibt
// weg. „0 von 1 geplanten Einheit" wäre erfunden.
// Der Zusatz gilt nur für die LAUFENDE Woche: „Noch 2 Einheiten – ein Fehltag ändert daran nichts"
// verspricht in einer abgeschlossenen Woche etwas, das sich nicht mehr einlösen lässt, und die
// Wochenserie (`streaks.weekGoal`) ist ein Stand von HEUTE, keine Zahl der betrachteten Woche.
function anaWeekConsistency(w,isCur){
  if(typeof lpWeekLine!=='function')return null;
  const t=(w&&w.training)||{};
  const planned=Math.round(+t.planned||0);
  if(!(planned>0)||t.sessions==null)return null;
  // Abgeschlossene (oder kommende) Woche ohne eine einzige Einheit: darunter steht bereits
  // „Nichts eingetragen" bzw. „Diese Woche liegt noch vor dir". „0 von 5 geplanten Einheiten" davor
  // ist zwar wahr, sagt aber nichts dazu – und stand vor 2.9.0 auch nicht dort (die Tages-Serie war
  // in so einer Woche 0 und die Zeile fiel ganz weg). In der LAUFENDEN Woche bleibt sie: dort ist
  // „Die Woche fängt gerade erst an" die Ansage, die auch die Startseite macht.
  if(!isCur&&!(+t.sessions>0))return null;
  const ins=isCur?(anaCached('insights')||LAST_INSIGHTS||null):null;
  const weeks=(ins&&ins.streaks&&ins.streaks.weekGoal)||0;
  const line=lpWeekLine({ins:{weekGoal:{target:planned,done:t.sessions},streaks:{weekGoal:weeks}}});
  if(!line)return null;
  return {main:line.main,detail:isCur?line.detail:'',hit:line.hit};}

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
  // Zählwerte gegen eine fertige Vorwoche: in der LAUFENDEN Woche ist jede Richtung gelogen. Am Montag
  // stand hier „1 Training ↘ Vorwoche 3" – der Pfeil nach unten für den ersten von sieben Tagen.
  // Durchschnitte (Ø Kalorien, Ø Schlaf) dürfen weiter vergleichen, die sind auch nach einem Tag
  // vergleichbar; Summen und Zählungen bekommen bis Sonntag nur den Bezugswert ohne Richtung.
  const cmpN=(now,was,d,u)=>(now==null||was==null)?''
    :isCur?`${icon('trendFlat',12)} Vorwoche ${fmtNum(was,d)}${u?' '+u:''}`:cmp(now,was,d,u);
  const blk=(label,rows)=>rows?`<div class="section-label">${label}</div><div class="rows">${rows}</div>`:'';
  // Fehlt in einem Bereich JEDER Wert, bleibt der Block ganz weg – „keine Daten" dreimal untereinander
  // ist keine Information. Fehlt nur ein einzelner Wert, steht dort „keine Daten".
  const some=(...v)=>v.some(x=>x!=null);
  // 2.9.0: EINE Konsistenz-Mechanik (CRITIC K10). Bis hierher stand an dieser Stelle die TAGES-Serie
  // („32 Tage in Folge – davon 31 mit Check-in, 1 vom Joker gerettet"), während die Startseite EINEN
  // Tipp weiter über denselben Datenstand „1 von 4 geplanten Einheiten" sagte – zwei Zählungen
  // nebeneinander, die der Leser selbst zusammenreimen musste. Jetzt trägt auch der Rückblick die
  // Wochen-Konsistenz, aus derselben Funktion (lpWeekLine, home.js) wie die Startseite.
  // `w.streak`/`w.streakFrozen` schickt der Server weiterhin – hier zeichnet sie niemand mehr.
  const wkc=anaWeekConsistency(w,isCur);
  if(wkc||w.xp)h+=`<div class="ana-wk-meta">${wkc?`${icon(wkc.hit?'check':'calendar',14)} ${esc2(wkc.main)}${wkc.detail?`<span class="sep">·</span>${esc2(wkc.detail)}`:''}`:''}${wkc&&w.xp?'<span class="sep">·</span>':''}${w.xp?`${fmtNum(w.xp)} XP`:''}</div>`;
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
  // B-I.5: die zwei Korridore, bevor die Zahlen kommen (M15).
  const ex=anaCached('wr:'+(st||''))||null;
  h+=wk2BalanceHTML(w,isCur,ex);
  const ts=(t.topSets||[])[0];
  // Die Zeile „Trainings 4 / 3" entfällt, SOBALD die Bilanz-Karte die Compliance trägt – dieselbe
  // Zahl zweimal auf einem Bildschirm (Befund B8). Ohne hinterlegten Rhythmus gibt es kein Band,
  // dann bleibt die Zeile die einzige Stelle, an der die Einheiten stehen, und sie bleibt.
  let r=wk2Compliance(t,ex)?''
    :_weekRow('Trainings',t.sessions==null?vT(null):`${fmtNum(t.sessions)}${t.planned?`<em> / ${fmtNum(t.planned)}</em>`:''}`,'',cmpN(t.sessions,pv.sessions));
  r+=_weekRow('Sätze',vT(t.sets))
    // Volumen in KILOGRAMM, nicht in Tonnen: der Highlight-Satz oben im SELBEN Bild sagt „48.230 kg
    // bewegt in 112 Sätzen" (logic.js/weekHighlights), und die Wochenmail nennt dieselbe Zahl ebenfalls
    // in kg. Zwei Einheiten für dieselbe Zahl auf einem Bildschirm muss der Leser selbst zusammenrechnen.
    // (Die Kacheln im Segment „Training" bleiben bei anaTons – dort steht keine kg-Zahl daneben.)
    // volumeKg ist 0, nicht null, wenn eine Woche nur aus Körpergewichtsübungen bestand: „0 kg" wäre
    // dann die einzige Zahl über ein Training, das stattgefunden hat – deshalb dort Klartext.
    +_weekRow('Volumen',t.volumeKg==null?vT(null)
      :(+t.volumeKg>0?vT(t.volumeKg,0,'kg')
      :(+t.sets>0?'<span class="muted-2">nur Körpergewicht</span>':vT(0,0,'kg'))));
  // Steht die Rekord-LISTE darunter, ist die gezählte Zeile darüber dieselbe Aussage ohne Inhalt.
  const prHTML=wk2PrRows(w,ex);
  if(+t.prs>0&&!prHTML)r+=_weekRow('Bestleistungen',fmtNum(t.prs),ts?`stärkster Satz: ${esc2(ts.exercise)}`:'');
  else if(ts&&!(+t.prs>0))r+=_weekRow('Stärkster Satz',`${fmtNum(ts.weight,1)}<em> kg</em> × ${fmtNum(ts.reps)}`,esc2(ts.exercise));
  if(some(t.sessions,t.sets,t.volumeKg,t.prs)||ts)h+=blk('Training',r);
  // Rekorde als LISTE, sobald der Server sie mitliefert – bis dahin bleibt die Zahl oben stehen (M10).
  h+=prHTML;
  h+=wk2FlagRows(ex&&ex.flags,ex);
  // „davon", weil im Zusatz eine ANDERE Zahl steht als im Wert der Zeile (protokollierte Tage gegen Tage
  // im Ziel) – ohne das Wort liest sich die kleinere Zahl wie ein Widerspruch zur größeren darüber.
  // Wortlaut „im Kalorienziel" wie im Highlight-Satz oben (logic.js/weekHighlights): zwei Namen für
  // dieselbe Zahl auf einem Bildschirm liest niemand als dieselbe Zahl. Das „±5 %" sagt, dass „im Ziel"
  // eine Spanne ist und kein Punkt – WELCHES Ziel gemessen wird, entscheidet der Server (weekView) und
  // steht bewusst nicht hier: sonst veraltet der Satz beim nächsten Eingriff dort.
  // „Tage protokolliert 6 / 7" und „davon 0 Tage im Kalorienziel" stehen beide in der Bilanz-Karte –
  // dort mit Prozentsatz und Band statt als nackte Zahl. Trägt die Karte sie, entfällt die Zeile hier;
  // trägt sie keine (kein Protokoll in der Woche), bleibt die Zeile die einzige Auskunft.
  r=(wk2Adherence(n,ex)?''
    :_weekRow('Tage protokolliert',n.daysLogged==null?vT(null):`${fmtNum(n.daysLogged)}<em> / 7</em>`,n.onTargetDays!=null?`davon ${pl(n.onTargetDays,'Tag','Tage')} im Kalorienziel (±5 %)`:''))
    +_weekRow('Ø Kalorien',vT(n.avgKcal,0,'kcal'),n.targetKcal?`Ziel ${fmtNum(n.targetKcal)} kcal`:'',cmp(n.avgKcal,pv.avgKcal,0,'kcal'))
    +_weekRow('Ø Eiweiß',vT(n.avgProtein,0,'g'),n.targetProtein?`Ziel ${fmtNum(n.targetProtein)} g`:'');
  if(some(n.daysLogged,n.avgKcal,n.avgProtein))h+=blk('Ernährung',r);
  r=_weekRow('Gewicht',vT(bo.weightEnd,1,'kg'),bo.weightStart!=null?`zu Wochenbeginn ${fmtNum(bo.weightStart,1)} kg`:'')
    +_weekRow('Veränderung',bo.delta==null?vT(null):`${bo.delta>0?'+':''}${fmtNum(bo.delta,1)}<em> kg</em>`,'',cmpN(bo.delta,pv.weightDelta,1,'kg'));
  // Die Wochenrate liefert der Server erst ab vier Tagen Messspanne (sonst null) – genau dafür wurde sie
  // abgesichert. Ohne diese Zeile stünde sie in der Antwort und auf keinem Bildschirm. Der Zusatz sagt,
  // dass es eine Hochrechnung ist: aus ein paar Wiegetagen wird hier eine ganze Woche.
  if(bo.perWeek!=null)r+=_weekRow('Ø pro Woche',`${bo.perWeek>0?'+':''}${fmtNum(bo.perWeek,1)}<em> kg</em>`,'aus den Wiegetagen dieser Woche hochgerechnet');
  if(some(bo.weightEnd,bo.weightStart,bo.delta))h+=blk('Körper',r);
  // A-IV.6 (P4): „Ø Ruhepuls 50 bpm" ist eine Zahl ohne Maßstab – 50 ist für den einen gut und für den
  // anderen hoch. Daneben steht deshalb der eigene Bereich (an2WeekBand). Er kommt aus den Check-ins,
  // die das Körper-Segment ohnehin geladen hat: keine zusätzliche Anfrage, kein zusätzlicher Tap.
  // Wer direkt in den Wochenrückblick springt, hat sie noch nicht – dann bleibt die Zeile wie bisher.
  r=_weekRow('Ø Schlaf',vT(he.avgSleep,1,'h'),'',cmp(he.avgSleep,pv.avgSleep,1,'h'))
    +_weekRow('Ø Schritte',vT(he.avgSteps),an2WeekBand('steps',0,''));
  // Uhr-Werte nur zeigen, wenn es sie gibt – ohne verbundene Uhr wäre das eine Reihe leerer Zeilen.
  if(he.avgBurn!=null)r+=_weekRow('Ø Verbrauch',vT(he.avgBurn,0,'kcal'),an2WeekBand('active_kcal',0,'kcal')||'aktiv, aus der Uhr');
  if(he.avgRhr!=null)r+=_weekRow('Ø Ruhepuls',vT(he.avgRhr,0,'bpm'),an2WeekBand('resting_hr',0,'bpm'));
  if(he.avgHrv!=null)r+=_weekRow('Ø HRV',vT(he.avgHrv,0,'ms'),an2WeekBand('hrv',0,'ms'));
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
  viewPhoto.cur=null;AN2_IMG={}; // die zuletzt angesehenen Vollbilder (~216 KB je Stück) nicht länger halten
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
    : `<div class="note mb-3">Alle zwei Wochen ein Foto – gleiche Pose, gleiches Licht. Wer deine Fotos sehen kann: du und dein zugewiesener Coach. Der Betreiber nur, solange du ihm die Hilfe-Freigabe gibst (30 Minuten, jeder Zugriff wird protokolliert).</div>
      <div class="seg" id="ph_poseSeg">${[['front','Vorne'],['side','Seite'],['back','Hinten']].map(([k,l])=>`<button class="${k===pose?'on':''}" data-pose="${k}" onclick="phPose('${k}')">${l}</button>`).join('')}</div>
      <label class="btn block">${icon('camera',18)} Foto aufnehmen<input type="file" accept="image/*" capture="environment" onchange="handlePhoto(event)"></label>`;
  // Der Vergleich ist der eigentliche Grund, warum jemand Fortschrittsfotos macht – er steht deshalb
  // ÜBER dem Raster und nicht hinter einem Foto (A-IV.6; RATE-25-analysis M3).
  if(list.length>1)h+=`<button class="btn sec block mb-3" onclick="an2CompareOpen()">${icon('eye',18)} Vorher / Nachher vergleichen</button>`;
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

// ===== A-IV.6 · VORHER / NACHHER: zwei Bilder nebeneinander, gleiche Pose, gleicher Ausschnitt =====
// Bis 2.7.0 hieß „Fotos vergleichen" in Wahrheit: EIN Foto ansehen, zurück, das nächste ansehen
// (RATE-25-analysis M3 – der Viewer zeigt genau ein Bild, kein Wischen, kein Pose-Filter, und die
// Kachel warb mit „Physik vergleichen"). Ein Vergleich, der den Namen verdient, braucht drei Dinge:
//   · zwei Bilder NEBENEINANDER, gleich groß und gleich beschnitten (beide 3:4, object-fit:cover) –
//     sonst vergleicht man Bildausschnitte statt Körper;
//   · dieselbe POSE auf beiden Seiten – Vorne gegen Seite ist kein Vergleich;
//   · die Zahlen desselben Tages darunter (Gewicht aus dem Check-in, Taille aus den Maßen), denn der
//     Blick allein täuscht in beide Richtungen – nach oben wie nach unten.
// Voreingestellt ist das älteste gegen das neueste geladene Foto der Pose; beide Seiten lassen sich
// einzeln durch die Serie blättern. Der Einstieg ist ein Knopf im Foto-Sheet: kein bestehender Weg
// wird dadurch länger (Veto A-IV, tapcount).
const AN2_POSES=[['front','Vorne'],['side','Seite'],['back','Hinten']];
// Vollbilder sind je ~216 KB. Es werden höchstens zwei gehalten (die beiden sichtbaren); jedes weitere
// verdrängt das älteste. `openPhotos()` leert den Speicher beim Öffnen ganz – aus demselben Grund, aus
// dem dort auch `viewPhoto.cur` genullt wird.
let AN2_IMG={};
function an2ImgPut(id,data){const k=Object.keys(AN2_IMG);while(k.length>=3)delete AN2_IMG[k.shift()];AN2_IMG[id]=data;}
async function an2ImgGet(uid,id){if(AN2_IMG[id])return AN2_IMG[id];
  const r=await API.get('/photos/'+uid+'/'+id);
  const im=(r.status===200&&r.data&&r.data.photo)?r.data.photo.image:null;
  if(im)an2ImgPut(id,im);return im;}
// Zustand des Vergleichs: welche Pose, welches Foto links (a = vorher) und rechts (b = nachher).
const AN2_CMP={uid:null,pose:'front',rows:[],a:0,b:0,ci:null,ms:null,msUid:null};
// Fotos einer Pose, ältestes zuerst (die Serverliste kommt absteigend)
function an2CmpRows(pose){return (openPhotos.list||[]).filter(p=>p&&p.pose===pose)
  .slice().sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:((+x.id||0)-(+y.id||0)));}
// Der Wert am Tag des Fotos: der nächstgelegene Eintrag innerhalb einer Woche, sonst keiner.
// Lieber gar keine Zahl als die vom letzten Monat – ein Vergleich lebt davon, dass die Zahlen zum Bild gehören.
function an2Near(list,date,key,maxDays){let best=null,bd=1e9;const max=maxDays||7;
  (list||[]).forEach(r=>{if(!r||!r.date||r[key]==null||!(+r[key]>0))return;
    const d=Math.abs(anaDayDiff(r.date,date));if(d<=max&&d<bd){bd=d;best=+r[key];}});
  return best;}
async function an2CompareOpen(){const uid=openPhotos.uid||VIEW_USER;AN2_CMP.uid=uid;
  // Voreinstellung: die Pose, in der wirklich verglichen werden kann. Die zuletzt gewählte hat Vorrang,
  // solange sie zwei Fotos hat – sonst die mit den meisten.
  const cnt=k=>an2CmpRows(k).length,want=openPhotos.pose||'front';
  AN2_CMP.pose=cnt(want)>=2?want:(AN2_POSES.map(([k])=>k).sort((x,y)=>cnt(y)-cnt(x))[0]||want);
  openSheet('Vorher / Nachher','<div class="spinner"></div>');
  // Gewicht steht im Check-in-Cache des Segments (von dort kommt man her); die Maße sind ein kleiner,
  // einmaliger Abruf je Athlet. Fehlt eines von beidem, bleibt die Zeile darunter eben kürzer.
  AN2_CMP.ci=anaCached('checkins_all')||anaCached('checkins')||null;
  if(AN2_CMP.msUid!==uid){const r=await API.get('/measurements/'+uid);
    AN2_CMP.ms=(r.status===200&&r.data&&r.data.measurements)||[];AN2_CMP.msUid=uid;}
  if(!sheetOpen())return;
  AN2_CMP.rows=an2CmpRows(AN2_CMP.pose);AN2_CMP.a=0;AN2_CMP.b=Math.max(0,AN2_CMP.rows.length-1);
  openSheet('Vorher / Nachher',an2CompareHTML());an2CompareLoad();}
function an2CompareHTML(){
  return `<div class="seg" id="an2cmpPose">${AN2_POSES.map(([k,l])=>{const on=k===AN2_CMP.pose;
    return `<button class="${on?'on':''}" data-pose="${k}" aria-pressed="${on?'true':'false'}" onclick="an2ComparePose('${k}')">${l}</button>`;}).join('')}</div>
    <div id="an2cmpBody">${an2CompareBodyHTML()}</div>`;}
function an2CompareBodyHTML(){const rows=AN2_CMP.rows,n=rows.length;
  if(n<2)return emptyState({icon:'camera',title:n?'Erst ein Foto in dieser Pose':'Noch kein Foto in dieser Pose',
    text:'Zum Vergleichen braucht es zwei Bilder derselben Pose – gleicher Abstand, gleiches Licht, gleiche Tageszeit.'})+an2CompareMoreHTML();
  return `<div class="an2-cmp">${an2CmpSideHTML('a','Vorher')}${an2CmpSideHTML('b','Nachher')}</div>`
    +an2CmpDeltaHTML()+an2CompareMoreHTML();}
function an2CmpSideHTML(side,label){const rows=AN2_CMP.rows,i=AN2_CMP[side],p=rows[i];if(!p)return '';
  return `<figure class="an2-cmp-s">
    <div class="an2-cmp-box"><img id="an2cmp_${side}" alt="Fortschrittsfoto ${label} vom ${fmtDate(p.date)}"></div>
    <figcaption><span class="eyebrow">${label}</span><b>${fmtDate(p.date)}</b>${an2CmpNums(p.date)}</figcaption>
    <div class="an2-cmp-nav">
      <button class="btn icon sm ghost" aria-label="${label}: ein Foto früher"${i<=0?' disabled':''} onclick="an2CompareStep('${side}',-1)">${icon('chevronLeft',20)}</button>
      <span class="meta">${fmtNum(i+1)}/${fmtNum(rows.length)}</span>
      <button class="btn icon sm ghost" aria-label="${label}: ein Foto später"${i>=rows.length-1?' disabled':''} onclick="an2CompareStep('${side}',1)">${icon('chevronRight',20)}</button>
    </div></figure>`;}
// Gewicht schwankt täglich – da zählt nur eine Wiegung aus derselben Woche. Die Taille wird alle paar
// Wochen gemessen und bewegt sich langsam; dort ist ein Fenster von zwei Wochen noch ehrlich.
const AN2_NEAR_W=7,AN2_NEAR_M=14;
function an2CmpNums(date){const w=an2Near(AN2_CMP.ci,date,'weight',AN2_NEAR_W),t=an2Near(AN2_CMP.ms,date,'waist',AN2_NEAR_M);
  const p=[];if(w!=null)p.push(fmtNum(w,1)+' kg');if(t!=null)p.push('Taille '+fmtNum(t,1)+' cm');
  return p.length?`<small>${esc2(p.join(' · '))}</small>`:'';}
// Die eine Zeile unter dem Paar: wie viel Zeit dazwischen liegt und was sich in Zahlen geändert hat.
// Ohne beide Endwerte steht der Teil nicht da – eine Differenz aus einem Wert gibt es nicht.
function an2CmpDeltaHTML(){const A=AN2_CMP.rows[AN2_CMP.a],B=AN2_CMP.rows[AN2_CMP.b];if(!A||!B)return '';
  const days=Math.abs(anaDayDiff(B.date,A.date)),parts=[];
  if(days)parts.push(pl(days,'Tag','Tage')+' dazwischen');
  const add=(key,list,name,unit,win)=>{const a=an2Near(list,A.date,key,win),b=an2Near(list,B.date,key,win);if(a==null||b==null)return;
    // Typografisches Minus wie überall sonst im Tab („−0,7 h"), nicht der Bindestrich aus fmtNum.
    const d=Math.round((b-a)*10)/10;parts.push(`${name} ${d<0?'−':d>0?'+':'±'}${fmtNum(Math.abs(d),1)} ${unit}`);};
  add('weight',AN2_CMP.ci,'Gewicht','kg',AN2_NEAR_W);add('waist',AN2_CMP.ms,'Taille','cm',AN2_NEAR_M);
  if(!parts.length)return '';
  return `<div class="an2-cmp-d">${icon('scale',16)}<span>${esc2(parts.join(' · '))}</span></div>`;}
// Liegen auf dem Server noch ältere Fotos, ist „das älteste" hier nur „das älteste geladene".
// Das wird gesagt – und nachladbar gemacht, statt es zu verschweigen.
function an2CompareMoreHTML(){if(!openPhotos.more)return '';
  return `<div class="center an2-cmp-hint"><div class="caption mb-2">Verglichen wird innerhalb der geladenen Fotos.</div>
    <button class="btn sm sec" id="an2cmpOlder" onclick="an2CompareOlder()">Ältere Fotos laden</button></div>`;}
// Erst das Vorschaubild (es liegt schon in der Liste), dann das Vollbild – so steht nie ein graues Loch da.
async function an2CompareLoad(){const uid=AN2_CMP.uid,rows=AN2_CMP.rows;if(rows.length<2)return;
  await Promise.all(['a','b'].map(async side=>{const p=rows[AN2_CMP[side]];if(!p)return;
    const el=document.getElementById('an2cmp_'+side);if(!el)return;
    if(p.thumb)el.src=p.thumb;
    const full=await an2ImgGet(uid,p.id);const el2=document.getElementById('an2cmp_'+side);
    if(full&&el2&&AN2_CMP.rows[AN2_CMP[side]]===p)el2.src=full;}));}
// Neu zeichnen, ohne das Sheet neu aufzubauen: sonst springt es bei jedem Blättern nach oben.
function an2CompareDraw(){const box=document.getElementById('an2cmpBody');
  if(box)box.innerHTML=an2CompareBodyHTML();else openSheet('Vorher / Nachher',an2CompareHTML());
  an2CompareLoad();}
function an2CompareStep(side,d){const i=AN2_CMP[side]+d;if(i<0||i>=AN2_CMP.rows.length)return;
  AN2_CMP[side]=i;an2CompareDraw();}
function an2ComparePose(k){if(k===AN2_CMP.pose)return;AN2_CMP.pose=k;openPhotos.pose=k;
  document.querySelectorAll('#an2cmpPose button').forEach(b=>{const on=b.dataset.pose===k;
    b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
  AN2_CMP.rows=an2CmpRows(k);AN2_CMP.a=0;AN2_CMP.b=Math.max(0,AN2_CMP.rows.length-1);an2CompareDraw();}
// Nächste Serverseite holen, ohne das Foto-Raster anzufassen (das steht in der Ebene darunter).
async function an2CompareOlder(){const uid=AN2_CMP.uid,list=openPhotos.list||[];
  if(!list.length||an2CompareOlder.busy)return;an2CompareOlder.busy=1;
  const btn=document.getElementById('an2cmpOlder');if(btn){btn.disabled=true;btn.textContent='Lädt …';}
  try{const r=await API.get(phPath(uid,list[list.length-1]));
    const have=new Set(list.map(p=>p.id)),fresh=(r.data?.photos||[]).filter(p=>p&&!have.has(p.id));
    if(!document.getElementById('an2cmpBody')||AN2_CMP.uid!==uid)return;
    openPhotos.more=fresh.length===PH_PAGE&&r.data?.more!==false&&r.data?.hasMore!==false;
    if(fresh.length)openPhotos.list=list.concat(fresh);
    // Nach dem Nachladen ist „vorher" wieder das jetzt wirklich älteste Foto der Pose.
    AN2_CMP.rows=an2CmpRows(AN2_CMP.pose);AN2_CMP.a=0;AN2_CMP.b=Math.max(0,AN2_CMP.rows.length-1);
    an2CompareDraw();
  }finally{an2CompareOlder.busy=0;}}

// ===== ERFOLGE (Level, „Als Nächstes", nach Bereich gruppiert) =====
// B6 · Das Erfolge-Sheet war die groesste verbliebene Emoji-Flaeche in diesem Bereich: der Server
// schickt zu jedem Erfolg ein Farb-Emoji (`achievements[].icon`, src/server.js:5243 ff.) und die
// Zeile stellte es neben den monochromen icon('check')/icon('lock') derselben Zeile – zwei
// Bildsprachen in EINER Komponente.
// Der Monatsziel-Teil derselben Antwort hat das schon geloest: der Server schickt dort `iconName`
// statt `icon` (src/server.js:5336 ff.). Fuer die Erfolge fehlt dieses Feld noch, und src/server.js
// gehoert A-IV.3 – also liegt die Zuordnung hier, bei dem, der zeichnet. Sobald der Server
// `iconName` mitschickt, gewinnt es (erste Abfrage unten); diese Tabelle ist dann nur noch Reserve.
const AN2_ACH_ICONS={
  first_checkin:'checkCircle', first_workout:'dumbbell', sessions_10:'calendar', sessions_50:'trophy',
  sets_100:'target', sets_1000:'zap', volume_10t:'scale', volume_100t:'packageBox',
  pr_1:'medal', pr_5:'star', pr_15:'trophy', streak_7:'flame', streak_30:'flame',
  weekgoal_4:'calendar', weekgoal_12:'calendar', first_cardio:'run', cardio_10:'run',
  dist_100:'footprints', food_7:'bowl', first_photo:'camera', first_measure:'ruler',
  mealplan:'utensils', level_5:'star', level_10:'sparkles', month_1:'trophy', month_3:'calendar',
  month_6:'medal', coach_challenge:'medal', prime_1:'brain', prime_7:'sun', prime_30:'sun',
  wheel_1:'wheel', wheel_3:'chartLine', challenge_1:'trophy', breath_50:'wind',
};
// Ein neuer Erfolg-Schluessel, den diese Tabelle noch nicht kennt, bekommt die Medaille – nie wieder
// das Emoji des Servers und nie ein leeres Feld (die Zeile haette sonst ein 24-px-Loch links).
function an2AchIcon(a){ return icon((a&&a.iconName)||AN2_ACH_ICONS[String(a&&a.id||'')]||'medal',22); }
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
  const row=(a,bar)=>`<div class="row ach${a.done?' done':''}"><div class="r-ic">${an2AchIcon(a)}</div><div class="rl">${esc2(a.title)}<small>${esc2(a.desc)}${(!a.done&&a.target)?` · ${fmtNum(a.progress)}/${fmtNum(a.target)}`:''}</small>${bar?`<div class="bar mt-2"><i style="width:${Math.min(100,Math.round(a.progress/a.target*100))}%"></i></div>`:''}</div><div class="rr">${a.done?`<span class="pill green">${icon('check',12)} erreicht</span>`:`<span class="muted-2">${icon('lock',16)}</span>`}</div></div>`;
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
    // Meilenstein der Wochen-Konsistenz feiern (CRITIC K10, BUILD-A5 5.6).
    // Bis 2.9.0 feuerte hier bei 7/14/30/50/100/200/365 TAGEN Konfetti, und der Untertitel lautete
    // „Nicht abreißen lassen!" – genau der Satz, den die neue Mechanik ausdrücklich ausschließt
    // (home.js/lpWeekLine: kein Ausrufezeichen, keine Drohung). Gefeiert werden jetzt WOCHEN, in
    // denen das Trainingsziel stand: 4 (ein Monat), 12 (ein Quartal), 26 (ein halbes Jahr), 52.
    // Eigener Schlüssel: ein alter `be_streak`-Stand aus Tagen (oft dreistellig) würde als
    // Wochenzahl gelesen jeden ersten Meilenstein verschlucken.
    const prevWeeks=parseInt(localStorage.getItem('be_wkstreak')||'-1');
    const curW=INS.streaks?.weekGoal||0;
    if(prevWeeks>=0){const hit=[4,12,26,52].find(m=>curW>=m&&prevWeeks<m);
      if(hit){const ttl=pl(curW,'Woche','Wochen')+' in Folge',
        sub='In jeder davon stand dein Trainingsziel.';
        if(celebrated)setTimeout(()=>celebrate('🔥',ttl,sub),1500);else{celebrate('🔥',ttl,sub);celebrated=true;}}}
    localStorage.setItem('be_wkstreak',String(curW));
    // Der Tages-Zähler wird nirgends mehr gelesen – er darf nicht als Altlast liegen bleiben und beim
    // nächsten Leser den Eindruck erwecken, es gäbe noch eine zweite Serie.
    localStorage.removeItem('be_streak');
    // Neue Erfolge: den ersten feiern, weitere als Toast
    const prev=JSON.parse(localStorage.getItem('be_ach')||'[]');
    const now=(INS.achievements||[]).filter(a=>a.done).map(a=>a.id);
    const fresh=now.filter(id=>!prev.includes(id));
    if(prev.length&&fresh.length){
      fresh.forEach((id,i)=>{const a=INS.achievements.find(x=>x.id===id);if(!a)return;
        // Der erste neue Erfolg wird gefeiert – sofort, wenn davor nichts gefeiert wurde, sonst mit Abstand.
        if(i===0&&!celebrated){celebrated=true;celebrate(a.icon,a.title,'Neuer Erfolg!');}
        else setTimeout(()=>toast('Neuer Erfolg: '+a.title+'!'),700+i*1700);});
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
    <div class="mg-ic">${icon(m.allReached?'trophy':'target',40)}</div>
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
    m.history.map(x=>`<span class="pill neutral">${icon(x.custom?'medal':'trophy',12)} ${cap(new Date(x.month+'-01T00:00:00').toLocaleDateString('de-DE',{month:'short',year:'2-digit'}))}</span>`).join('')+`</div>`;}
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
