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
// D-4 (DESIGN-4 3.6 / 6.9 / R12): `short` ("4 W") wird nicht mehr gebraucht – die Chip-Reihe, die
// diese Kurzform trug, ist die zweite Steuerebene und faellt (G4). `wort` ist die Fassung fuer den
// Untertitel des grossen Titels und fuer den Wert rechts in der Zeitraum-Zeile: ein ausgeschriebener
// Zeitraum statt „3 M" (G9).
const AN2_RANGES=[
  {k:'4w',lbl:'4 Wochen',wort:'letzte 4 Wochen',zeigt:'Zeigt die letzten vier Wochen',days:28},
  {k:'3m',lbl:'3 Monate',wort:'letzte 3 Monate',zeigt:'Zeigt die letzten drei Monate',days:91},
  {k:'1j',lbl:'1 Jahr',  wort:'letztes Jahr',  zeigt:'Zeigt die letzten zwölf Monate',days:365}];
let AN2_RANGE=(function(){try{const v=localStorage.getItem('be_an2_range');if(AN2_RANGES.some(r=>r.k===v))return v;}catch(e){}return '3m';})();
function an2Range(){return AN2_RANGES.find(r=>r.k===AN2_RANGE)||AN2_RANGES[1];}
function an2From(){return anaAddDays(today(),-(an2Range().days-1));}
// Nur Einträge im gewählten Fenster (Liste in beliebiger Reihenfolge, Datum als ISO-Text)
function an2Window(rows,key){const from=an2From();return (rows||[]).filter(r=>r&&(key?r[key]:r.date)>=from);}
// Wie viele Tage Check-ins geholt werden müssen, damit das Fenster überhaupt gefüllt werden kann.
// Nie weniger als das bisherige 120-Tage-Fenster: die Tabellen und Durchschnitte darunter leben davon.
function an2CiDays(){return Math.max(ANA_CI_DAYS,an2Range().days+7);}
// ===== D-4 · EINE STEUEREBENE, EIN ZEITRAUM IN WOERTERN (DESIGN-4 3.6, 6.9, 6.10, R12) =====
// Bis 3.0.2 standen drei Steuerebenen uebereinander: Reiterleiste · Segment (Koerper/Training/Woche)
// · Zeitraum-Chips (4 W / 3 M / 1 J). Gemessen: `ebenen:["Segment","Chip-Reihe"]` in
// tracker-koerper UND tracker-training, also zwei Ebenen unter dem Titel bei einem Limit von einer
// (K3). Dazu waren „4 W" und „3 M" Kuerzel ohne Erklaerung (G9).
// Der Zeitraum wandert deshalb an genau zwei Orte, beide ohne eigene Steuerebene:
//   1. in den UNTERTITEL des grossen Titels („Koerper · letzte 3 Monate") – dort beantwortet er
//      „wie viel sehe ich?" ohne einen einzigen Tap (3.6, „Wohin die zweite Ebene wandert", Weg 1);
//   2. in eine ZEILE mit Wert rechts („Zeitraum · letzte 3 Monate ›"), die eine Optionsliste
//      oeffnet (5.2, Zustand „gewaehlt (Optionsliste)").
// Die Chip-Reihe `.an2-range` ist damit ersatzlos geloescht.
const AN5_SEG={koerper:'Körper',training:'Training',woche:'Woche'};
// Der Untertitel des grossen Titels. Er nennt IMMER zuerst die Sicht (dasselbe Wort wie im Segment,
// G2) und danach den Zeitraum, den die Zahlen darunter wirklich abdecken. Im Segment „Woche" ist der
// Zeitraum die betrachtete Woche selbst – der Zeitraum-Chip galt dort noch nie.
function an5Sub(){const t=renderTracker.tab;
  if(t==='woche'){const st=ANA_WEEK_START;if(!st)return AN5_SEG.woche;
    return AN5_SEG.woche+' · '+an5WeekRange(st);}
  return (AN5_SEG[t]||AN5_SEG.koerper)+' · '+an2Range().wort;}
// Zeitraum einer Woche als Wort: „14. – 20. September" bzw. „28. Sept. – 4. Okt."
function an5WeekRange(start){const end=anaAddDays(start,6);
  return start.slice(5,7)===end.slice(5,7)
    ? `${+start.slice(8,10)}. – ${fmtDate(end,{month:'long'})}`
    : `${fmtDate(start)} – ${fmtDate(end)}`;}
// Den Untertitel in den grossen Titel schreiben, den diese Ansicht selbst mitbringt.
// Die Huelle (shell.js `ensureLargeTitle`) setzt nur dann einen Titel ein, wenn die Seite keinen hat –
// ab hier hat sie einen, und der Uebergangsmechanismus ruehrt ihn nicht mehr an (DONE-D4-huelle 2.2).
function an5SetTitle(){const h=document.querySelector('#views .page.on > .lg-title')
    ||document.querySelector('#views .page > .lg-title');
  if(!h)return;
  let s=h.querySelector('small');
  if(!s){s=document.createElement('small');h.appendChild(s);}
  s.textContent=an5Sub();}
// Die Zeitraum-Zeile. Sie steht in dem Abschnitt, dessen Zahlen sie bestimmt – nicht oben auf der
// Seite. `sub` sagt, WOFUER der Zeitraum gilt; ohne das waere der Wert rechts eine Einstellung ohne
// Gegenstand.
function an5RangeRow(sub){return rowHTML({icon:'calendar',title:'Zeitraum',sub:sub||'Gilt für die Zahlen auf dieser Seite',
  value:an2Range().wort,tap:'an5RangeSheet()'});}
// Die Optionsliste (5.2): eine Zeile je Zeitraum, die gewaehlte traegt das Wort „ausgewählt" rechts.
// Kein Segment, keine Chips – eine Liste, weil eine Liste die Form fuer „waehle genau eines" ist.
// Der Wrapper `#an5Zeitraum` nimmt den Zeilen ihr Chevron: eine Optionsliste fuehrt nirgendwohin,
// sie waehlt (G7 – „das Chevron bedeutet genau eines: fuehrt weiter"). Das gewaehlte Wort rechts ist
// das zweite Signal neben der Fuellung (A47).
function an5RangeSheet(){const cur=an2Range().k;
  openSheet('Zeitraum','<div id="an5Zeitraum">'+groupHTML('',AN2_RANGES.map(r=>rowHTML({
      title:r.lbl,sub:r.k===cur?'':r.zeigt,
      value:r.k===cur?'ausgewählt':'',tap:`an5RangePick('${r.k}')`})),
    'Der Zeitraum gilt für die Kurven und für die Zahlen je Woche. Er bleibt gespeichert, bis du ihn wieder änderst.',{inset:false})+'</div>');}
function an5RangePick(k){closeModal();an2SetRange(k);an5SetTitle();
  // Eine offene Kennzahl-Seite zeigt dieselbe Kurve – sie wird mitgezogen, sonst stuende dort der
  // alte Zeitraum unter einem neuen Untertitel.
  if(typeof an5MetricRedraw==='function')an5MetricRedraw();}
// ===== D-4 · DER BALKEN IN DER ZEILE (DESIGN-4 5.7) =====
// „Ring = Tagesziel. Balken = Anteil in einer Liste. Zahl = alles andere." Die Saetze je
// Muskelgruppe sind der Musterfall fuer den Balken – 5.7 nennt sie woertlich. `rowHTML()` kennt aber
// nur Text, Pille und Wert; ein Balken ist keines davon, und eine zweite Zeilenform waere ein
// Abnahmefehler (K6). Deshalb wird der Balken NACHTRAEGLICH in die fertige Zeile gesetzt, an genau
// der Stelle, an der `rowHTML()` den Titelblock schliesst. Findet sich der Anker nicht (weil der
// Helfer sich einmal aendert), bleibt die Zeile unveraendert – dann fehlt der Balken, und sonst
// nichts. Dasselbe Vorgehen wie `an2WithBand()` beim Diagramm: lieber kein Zusatz als ein falscher.
// Der Anker ist das Ende des Titelblocks `.rl`. Sein Inhalt (Titel, Unterzeile) laeuft durch esc2()
// und kann deshalb kein `</span>` enthalten – das erste `</span>` hinter `<span class="rl">` ist
// immer sein eigenes. Der Balken landet damit UNTER der Unterzeile und ueber die volle Breite der
// Titelspalte, nicht als dritte Spalte neben dem Wert.
const AN5_RL='<span class="rl">';
function an5RowBar(row,pct,cls){
  if(!row)return '';
  const a=row.indexOf(AN5_RL);if(a<0)return row;
  const i=row.indexOf('</span>',a+AN5_RL.length);if(i<0)return row;
  const w=Math.max(0,Math.min(100,Math.round(+pct||0)));
  return row.slice(0,i)+`<span class="bar an5-bar${cls?' '+cls:''}" aria-hidden="true"><i style="width:${w}%"></i></span>`+row.slice(i);}
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
  // D-4: Der Verlauf steht jetzt auf der Kennzahl-Seite, nicht mehr im Koerper-Segment – also wird
  // genau die neu gezeichnet, wenn der Selbstbericht ankommt.
  wk2SelfSeries(VIEW_USER,21).then(list=>{AN2_SELF_BUSY=false;anaStore('self',list||[]);
    if(AN5_PAGE==='readiness')an5MetricRedraw();})
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
// (Die frühere Funktion `an2Trend` stand hier: die Trendzeile einer Kachel. Die Kacheln gibt es nicht mehr – der
//  eigene Bereich steht als Unterzeile in der Zeile, in Woertern statt in einem HTML-Schnipsel.)
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

// --- Tab-Einstieg: grosser Titel + die EINE Steuerebene (Segment Körper / Training / Woche) ---
// D-4: Die Ansicht bringt ihren grossen Titel jetzt SELBST mit (DESIGN-4 3.2 / G1). Bis hierher
// setzte ihn die Huelle nachtraeglich ein (`ensureLargeTitle`) und die Unterzeile blieb leer, weil
// der Zeitraum noch in den Chips stand. Beides faellt zusammen weg: der Titel steht im Markup, und
// seine Unterzeile traegt Sicht und Zeitraum („Körper · letzte 3 Monate").
function renderTracker(v,opts){opts=opts||{};if(typeof opts==='string')opts={tab:opts};
  if(opts.tab)renderTracker.tab=opts.tab;
  const t=renderTracker.tab==='training'?'training':renderTracker.tab==='woche'?'woche':'koerper';
  // go() hat den View-Cache bereits gemalt -> DOM behalten, nur Daten auffrischen (kein Flackern).
  // Die Prüfung muss ALLE drei Segmente kennen, sonst wird das Gerüst beim Zurückkehren neu gebaut.
  const reuse=!!(opts.cached&&v.querySelector('#anaBody')&&v.querySelector('#anaSeg')&&v.querySelector('.lg-title')&&v.querySelector(`#an_${t==='training'?'t':t==='woche'?'w':'k'}.on`));
  if(!reuse)v.innerHTML=`<div class="page on${opts.cached?'':' first'}">
    <h1 class="lg-title">Analyse<small></small></h1>
    <div class="seg" id="anaSeg" data-tour="anaSeg">
      <button id="an_k" onclick="anaTab('koerper')">Körper</button>
      <button id="an_t" onclick="anaTab('training')">Training</button>
      <button id="an_w" onclick="anaTab('woche')">Woche</button>
    </div>
    <div id="anaBody" data-tour="trackerBody"></div></div>`;
  anaTab(t,{entry:true,keep:reuse});
  if(typeof mountLargeTitle==='function')try{mountLargeTitle();}catch(e){}
  if(typeof maybeStartTabTour==='function')try{maybeStartTabTour('tracker',{deferred:true});}catch(e){}}
// Der Woche-Knopf wird defensiv behandelt (altes View-Cache-HTML kennt ihn noch nicht) –
// Körper und Training bleiben Pflicht, ohne sie ist das Gerüst nicht das erwartete.
function anaTab(t,o){t=(t==='training')?'training':(t==='woche')?'woche':'koerper';renderTracker.tab=t;
  const k=document.getElementById('an_k'),tr=document.getElementById('an_t'),wo=document.getElementById('an_w');if(!k||!tr)return;
  k.classList.toggle('on',t==='koerper');tr.classList.toggle('on',t==='training');if(wo)wo.classList.toggle('on',t==='woche');
  an5SetTitle();
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
  else if(!o.keep||!box.children.length)box.innerHTML=`<div class="skeleton lg"></div>${skeleton(4,'sm')}`;
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

// ===== D-4 · KOERPER: eine Hauptaussage, vier Abschnitte, keine Kachelwand =====
// Vorher (gemessen, `tracker-koerper`): 2.377 px hoch, 16 Zeilenformen, 0 `.rows-h`, 0 `.rows-f`,
// zwei Steuerebenen, 5 abgeschnittene Unterzeilen, bis zu acht Kacheln, von denen sieben nur
// Umschalter fuer EIN Diagramm waren, und darunter dasselbe Diagramm noch einmal als Karte.
// Nachher nach DESIGN-4 6.9: grosser Titel mit dem Zeitraum als Unterzeile, das Segment, die EINE
// Hauptaussage (Gewicht mit Kurve), die eine Primaeraktion, dann vier Abschnitte aus derselben
// Zeile: Werte · Einträge · Maße & Fotos · Verbindungen. Jede Gruppe traegt ihren Fusstext – den
// Erklaerungsort der App (G8).
function anaPaintKoerper(checkins){const box=document.getElementById('anaBody');if(!box)return;
  checkins=(checkins||[]).slice().sort((a,b)=>a.date<b.date?1:-1); // neueste zuerst
  const g=anaGoals(),tdy=today(),canEdit=!coachView();
  an5SetTitle();
  let h='';
  if(!checkins.length){
    h+=emptyState({icon:'scale',title:'Noch keine Check-ins',text:'Gewicht, Schlaf, Schritte und Wasser – ab dem ersten Eintrag entsteht hier deine Kurve.',btn:canEdit?{label:'Check-in eintragen',onclick:"anaOpenCheckin('"+tdy+"')"}:null});
    h+=an5PhysHTML()+an5LinkHTML();box.innerHTML=h;anaTourTarget();return;}
  const ws=checkins.filter(c=>c.weight>0);
  // „Ø 14 Tage" hieß bis 2.7.0 „Ø der letzten 14 EINTRÄGE" (`slice(0,n)`) – bei Lücken reichte das
  // Fenster still Wochen zurück (Befund M8). Gemittelt wird jetzt über die letzten n KALENDERTAGE.
  // Liegt in diesem Fenster kein Wert (wer drei Wochen pausiert hat), zählen ersatzweise die letzten
  // n Einträge – sonst verschwände die Zahl genau bei dem Nutzer, der zurückkommt und sehen will, wo er steht.
  const avgOf=(key,n)=>{n=n||7;const have=checkins.filter(c=>c[key]!=null&&+c[key]>0);
    const mean=xs=>xs.length?xs.reduce((a,c)=>a+ +c[key],0)/xs.length:null;
    const win=have.filter(c=>anaDayDiff(tdy,c.date)<=n-1);
    return win.length?mean(win):mean(have.slice(0,n));};
  const avg={aSleep:avgOf('sleep'),aSteps:avgOf('steps'),aWater:avgOf('water'),
    aBurn:avgOf('active_kcal'),aRhr:avgOf('resting_hr',14),aHrv:avgOf('hrv',14)};
  const tr=anaWeekTrend(ws);
  // 1 · DIE HAUPTAUSSAGE. Gewicht, Tempo, Urteil und Kurve in EINER Karte statt in zweien, die
  //     einander widersprachen („Trend 78,4 kg" stand im Kartenkopf UND rund 300 px darüber im Hero).
  h+=an5WeightHTML(checkins,ws,g,tr,canEdit,tdy);
  // 2 · DIE WERTE. Aus acht Kacheln, die ein Diagramm umschalteten, wird eine Liste: jede Zeile
  //     nennt Wort, Zahl, Einheit und Einordnung und führt auf die Seite mit dem Verlauf (6.9/R12).
  h+=an5ValuesHTML(checkins,avg,g);
  // 3 · DIE EINTRÄGE. „Nachtragen" ist die Wortaktion im Kopf (5.1), der Zeitraum die erste Zeile.
  h+=`<h2 class="rows-h">Einträge${canEdit?`<button type="button" class="a" onclick="anaOpenCheckin()">Nachtragen</button>`:''}</h2>`
    +`<div class="rows inset" id="histlist"></div>`
    +`<p class="rows-f">Jede Zeile ist ein Tag mit Check-in. Rechts steht das Gewicht dieses Tages, darunter die übrigen Werte`
    +`${canEdit?' – tippe eine Zeile an, um sie zu ändern':''}. Der Zeitraum bestimmt, wie weit Liste und Kurve zurückreichen.</p>`;
  // 4 + 5 · Maße, Fotos und Verbindungen standen bei y = 1.082 bzw. y = 1.779 als Kacheln am Ende
  //     (R12: 12 von 31 Aktionen unter dem Falz). Jetzt sind es zwei benannte Abschnitte.
  h+=an5PhysHTML()+an5LinkHTML();
  box.innerHTML=h;loadHist(checkins);anaTourTarget();}

// --- Die eine Held-Karte: Gewicht -------------------------------------------------------------
// Reihenfolge der Antworten: Wo stehe ich? In welche Richtung? Passt das zum Ziel? Und erst danach
// der Verlauf. Der Fusstext darunter sagt, wie die Linie entsteht und warum sie bei Lücken
// unterbrochen ist – das war bis hierher eine `.caption` IN der Karte (S#22, G8).
function an5WeightHTML(checkins,ws,g,tr,canEdit,tdy){
  const lw=ws[0],hasToday=checkins.some(c=>c.date===tdy);
  const w=anaWeightCard(checkins,g);   // {say,svg,foot} – svg/foot fehlen bei zu wenig Daten
  let sagt;
  if(tr){const v=Math.round(tr.perWeek*10)/10;
    sagt=`${v>0?'+':v<0?'':'±'}${fmtNum(v,1)} kg pro Woche · ${tr.kind==='avg'?'Schnitt der letzten 7 Tage gegen die 7 davor':'seit '+fmtDate(ws[ws.length-1].date)}`;}
  else sagt='Die Richtung steht ab dem zweiten Gewichtseintrag hier';
  let urteil='';
  if(g.start&&lw){const v=anaWeightVerdict(Math.round((lw.weight-g.start)*10)/10,g.goal);
    urteil=`<div class="an5-verdict">${esc2(v.text)} <span class="an5-quiet">· Start ${fmtNum(g.start,1)} kg</span></div>`;}
  const h=`<h2 class="rows-h">Gewicht</h2>`
    +`<div class="card lg an5-hero" id="anaHero">`
    +`<div class="an5-big">${lw?`${fmtNum(lw.weight,1)}<em>kg</em>`:'<em>noch nicht gewogen</em>'}</div>`
    +`<div class="an5-l">${lw?'zuletzt gewogen '+esc2(fmtDate(lw.date,{weekday:'long'})):'Trag dein erstes Gewicht ein'}</div>`
    +`<div class="an5-d">${esc2(sagt)}</div>${urteil}`
    +(w&&w.say?`<p class="an5-say">${esc2(w.say)}</p>`:'')
    +(w&&w.svg?w.svg:`<p class="an5-say an5-quiet">Ab zwei Wiegungen im gewählten Zeitraum erscheint hier die Kurve.</p>`)
    +`</div>`
    +`<p class="rows-f">${esc2((w&&w.foot)||'Punkte sind deine Wiegungen, die Linie ist der geglättete Verlauf über sieben Tage. Liegen mehr als sieben Tage ohne Wiegung dazwischen, ist die Linie unterbrochen – eine durchgezogene Linie über leere Tage wäre eine Behauptung.')}</p>`;
  // DIE EINE PRIMAERAKTION DIESES BILDSCHIRMS (G10/K10). Sie steht unter der Hauptaussage und
  // beantwortet „was tue ich hier?" – nicht als graue Pille in einer Kartenecke (5.1 „.btn.sm wird
  // ersatzlos gelöscht"), sondern als der eine rote Knopf. Im Coach-Blick gibt es sie nicht: er
  // trägt für seinen Athleten nichts ein.
  if(!canEdit)return h;
  return h+`<button class="btn an5-cta" onclick="anaOpenCheckin('${tdy}')">${icon('pencil',18)} ${hasToday?'Check-in von heute ändern':'Check-in für heute eintragen'}</button>`;}

// --- Abschnitt „Werte": aus acht Kacheln wird eine Liste ---------------------------------------
// Jede Zeile: das WORT (nicht das Kürzel), die Zahl mit Einheit rechts und in der Unterzeile die
// Einordnung – Ziel und Abstand, wo es ein Ziel gibt, sonst der eigene Bereich (P4). Der Tap führt
// auf eine eigene Seite mit dem Verlauf; sie trägt einen Titel und einen benannten Zurück-Weg.
// „HRV" heißt hier ausgeschrieben Herzratenvariabilität (R15/G9); der Fusstext erklärt sie.
const AN5_METRICS=[
  {k:'readiness',ic:'sparkles',name:'Bereitschaft',unit:'',dec:0},
  {k:'sleep',ic:'moon',name:'Schlaf',unit:'h',dec:1,goal:'sleep',avg:'aSleep'},
  {k:'steps',ic:'footprints',name:'Schritte',unit:'',dec:0,goal:'steps',avg:'aSteps'},
  {k:'water',ic:'droplet',name:'Wasser',unit:'L',dec:1,goal:'water',avg:'aWater'},
  {k:'active_kcal',ic:'flame',name:'Aktiver Verbrauch',unit:'kcal',dec:0,avg:'aBurn'},
  {k:'resting_hr',ic:'heart',name:'Ruhepuls',unit:'bpm',dec:0},
  {k:'hrv',ic:'zap',name:'Herzratenvariabilität',unit:'ms',dec:0},
];
function an5Metric(k){return AN5_METRICS.find(x=>x.k===k)||null;}
function an5ValuesHTML(checkins,avg,g){
  const has=key=>checkins.some(c=>c[key]!=null&&+c[key]>0);
  const lastOf=key=>{const c=checkins.find(x=>x[key]!=null&&+x[key]>0);return c?+c[key]:null;};
  const bandOf=key=>an2Band(an2Window(checkins).filter(c=>c[key]!=null&&+c[key]>0).map(c=>+c[key]));
  const R=anaCached('readiness');
  const hasR=!!(R&&(R.score!=null||!R.needsHealth));
  // Dieselbe Auswahl wie bisher – nur ohne „Gewicht": das Gewicht ist die Hauptaussage darüber und
  // braucht keinen zweiten Platz (Befund B8, Doppelung).
  ANA_TILES=(hasR?['readiness']:[]).concat(['sleep','steps','water','active_kcal','resting_hr','hrv'].filter(has));
  if(!ANA_TILES.length)return '';
  const wert=(v,d,u)=>v==null?'':fmtNum(v,d||0)+(u?' '+u:'');
  const zeile=key=>{const m=an5Metric(key);if(!m)return '';
    const tap=`an5OpenMetric('${key}')`;
    if(key==='readiness'){
      const cal=an2Calib(R,checkins);
      if(cal&&!cal.ready&&cal.have>0)
        return rowHTML({icon:m.ic,title:m.name,sub:wk2CalibText(cal),value:`${fmtNum(cal.have)} von ${fmtNum(cal.need)} Nächten`,tap});
      if(R.score==null)return rowHTML({icon:m.ic,title:m.name,sub:R.label||'',value:'noch keine Daten',tap});
      const solo=(typeof _readySolo==='function')?_readySolo(R):'';
      return rowHTML({icon:m.ic,title:m.name,sub:(R.label||'')+(solo?' · geschätzt aus '+solo:''),value:fmtNum(R.score)+' von 100',tap});}
    let v,sub;
    if(m.goal){const ziel=+g[m.goal];v=avg[m.avg];
      const fehlt=(v!=null&&ziel)?Math.round((ziel-v)*100)/100:null;
      sub='Ziel '+wert(ziel,m.dec,m.unit)
        +(fehlt==null?'':fehlt>0?' · es fehlen '+wert(fehlt,m.dec,m.unit):' · Ziel erreicht');}
    else{const b=bandOf(key);
      v=m.avg?avg[m.avg]:lastOf(key);
      sub=b?an2BandText(b,m.dec,m.unit):(m.avg?'Schnitt der letzten 7 Tage':'zuletzt gemessen');}
    if(v==null)return rowHTML({icon:m.ic,title:m.name,sub:'noch nicht eingetragen',tap});
    return rowHTML({icon:m.ic,title:m.name,sub,value:wert(m.dec?Math.round(v*10)/10:Math.round(v),m.dec,m.unit),tap});};
  const rows=ANA_TILES.map(zeile);
  // Der „Nächste Schritt" war bis hierher ein grauer Kasten in der Held-Karte. Er bleibt als Zeile –
  // ohne Chevron, denn er führt nirgendwohin: er sagt, welches Ziel am weitesten entfernt ist (G7).
  rows.push(rowHTML({icon:'target',title:'Nächster Schritt',sub:anaNextStep(avg,g)}));
  return groupHTML('Werte',rows,
    'Der Schnitt geht über die letzten sieben Kalendertage; liegt darin kein Wert, zählen die letzten sieben Einträge. '
    +'„Dein Bereich" ist die mittlere Hälfte deiner eigenen Werte im gewählten Zeitraum – keine Norm und kein Ziel. '
    +'Die Herzratenvariabilität misst den Abstand zwischen zwei Herzschlägen; höhere Werte gehen meist mit besserer Erholung einher. '
    +'Tippe eine Zeile an, um ihren Verlauf zu sehen.');}

// --- Kennzahl-Seite (Push-Seite, Eltern: Analyse) ----------------------------------------------
// Bis 3.0.2 wechselte ein Tipp auf eine Kachel das EINE Diagramm weiter unten auf derselben Seite –
// ohne Titel, ohne Rückweg, und die Seite blieb 2.377 px lang. Jetzt bekommt jede Kennzahl einen
// eigenen Bildschirm mit Namen und benanntem Zurück-Knopf (DESIGN-4 3.3, N1/N4).
let AN5_PAGE=null;
function an5OpenMetric(k){const m=an5Metric(k);if(!m||typeof pushPage!=='function')return;
  ANA_METRIC=k;AN5_PAGE=k;
  // Die Bereitschaft holt ihren Selbstbericht erst, wenn jemand sie wirklich ansieht (B-I.5).
  if(k==='readiness')an2SelfEnsure();
  pushPage('ana-'+k,m.name,'Analyse',`<div id="an5MetricBody">${an5MetricBodyHTML(k)}</div>`,{sub:an2Range().wort});}
// Neu zeichnen, ohne die Ebene neu aufzubauen (sonst springt sie nach oben und legt eine zweite an).
function an5MetricRedraw(){if(!AN5_PAGE)return;
  const el=document.getElementById('an5MetricBody');
  if(!el){AN5_PAGE=null;return;}
  el.innerHTML=an5MetricBodyHTML(AN5_PAGE);}
function an5MetricBodyHTML(k){const m=an5Metric(k);if(!m)return '';
  const cis=(anaCached('checkins')||[]).slice().sort((a,b)=>a.date<b.date?1:-1);
  const g=anaGoals();
  const vorher=ANA_METRIC;ANA_METRIC=k;
  let chart='';AN5_LEG='';
  try{chart=anaChartHTML(cis,g,{});}catch(e){console.error('[analysis] Kennzahl-Seite',e);}
  finally{ANA_METRIC=vorher;}
  const rows=[an5RangeRow('Gilt für diese Kurve und für die Zahlen im Körper-Bereich')];
  if(k==='readiness'&&typeof openReadiness==='function')
    rows.push(rowHTML({icon:'info',title:'Woraus die Bereitschaft entsteht',sub:'Schlaf, Erholung und die Last der letzten Tage',tap:'openReadiness()'}));
  const foot=({
    readiness:'Die Bereitschaft fasst Schlaf, Erholung und die Last der letzten Tage zu einer Zahl zwischen 0 und 100 zusammen. Unter sieben Nächten steht hier der Kalibrierstand statt einer Zahl – aus drei Nächten lässt sich kein Übliches ableiten.',
    sleep:'Gezählt wird die Schlafdauer aus deinem Check-in oder aus der verbundenen Gesundheits-App. Das Ziel kommt aus deinem Profil; ohne eigenes Ziel leitet es der Server aus deinem Median der letzten 14 Nächte ab.',
    steps:'Gezählt werden die Schritte des ganzen Tages. Das Ziel steht in deinem Profil und lässt sich dort ändern.',
    water:'Getrunkene Menge in Litern aus deinem Check-in. Das Ziel steht in deinem Profil.',
    active_kcal:'Aktiver Verbrauch heißt: die Kalorien, die über deinen Grundumsatz hinausgehen. Die Zahl kommt aus der verbundenen Uhr, nicht aus einer Schätzung der App.',
    resting_hr:'Der Ruhepuls ist die niedrigste Herzfrequenz eines Tages, meist im Schlaf gemessen. Ein hoher Wert ist hier das Warnzeichen, ein niedriger das gute – umgekehrt zu allen anderen Werten auf dieser Seite.',
    hrv:'Die Herzratenvariabilität (HRV) misst, wie stark der Abstand zwischen zwei Herzschlägen schwankt. Höhere Werte gehen meist mit besserer Erholung einher. Der Wert ist stark persönlich – vergleichbar ist er nur mit deinem eigenen Bereich, nie mit dem anderer.',
  })[k]||'';
  return chart+groupHTML('Zeitraum',rows,(AN5_LEG?AN5_LEG+' ':'')+foot);}
// Das eine Diagramm zur gewählten Kachel (WP0-Engine: schöne Ticks, Ziel-Label, gleitender Schnitt).
// Neu in 2.8.0: über der Karte die Zeitraum-Chips, in der Karte ein Aussagesatz und hinter der Kurve
// der eigene Bereich als Band. Die Reihenfolge ist Absicht – erst die Aussage, dann die Zahlen.
let AN5_LEG='';   // Legende der zuletzt gebauten Kurve – Fusstext der Kennzahl-Seite, nicht Kartentext
function anaChartHTML(checkins,g,avg){
  AN5_LEG='';
  // Die Reihe folgt dem gewählten Zeitraum (vorher fest: die letzten 30 Einträge, Befund M10).
  const series=key=>an2Window(checkins).filter(c=>c[key]!=null&&+c[key]>0).reverse().map(c=>({date:c.date,value:+c[key]}));
  // D-4: Ohne die Zeitraum-Chips davor – der Zeitraum steht im Untertitel der Seite und als Zeile
  // darunter (3.6). Und ohne Kartentitel: die Karte steht auf einer Seite, die so heißt wie sie
  // (G1/G2) – der Titel zweimal übereinander wäre genau die Doppelung, gegen die D-4 antritt.
  // `v` ist bereits fertiges HTML (die Aufrufer haben Serverdaten durch esc2() geschickt).
  const card=(title,v,svg,extra,say)=>`<div class="chart-card" id="anaChart"><div class="ch-h"><div class="t">${v}</div></div>${an2SayHTML(say)}${svg}${extra||''}</div>`;
  // „7-Tage-Schnitt" war hier ein Versprechen, das der Motor nicht hält: _rolling() mittelt die letzten
  // sieben WERTE, nicht sieben Tage (Befund M8). Der Text sagt jetzt, was gerechnet wird.
  // D-4/G8: Die Legende gehoert nicht als `.caption` mit Gleichheitszeichen in die Karte, sondern als
  // ganzer Satz in den Fusstext unter der Gruppe. `anaChartHTML` legt sie hier ab; die Kennzahl-Seite
  // haengt sie vor ihre eigene Erklaerung.
  const leg=(b,goal)=>{AN5_LEG='Die dicke Linie ist der Schnitt der letzten sieben Werte, die dünne zeigt die Tageswerte'
    +(goal!=null?', die gestrichelte dein Ziel':'')
    +(b?'. Das graue Band ist die mittlere Hälfte deiner Werte im Zeitraum':'')+'.';return '';};
  const few=`<div class="chart-card" id="anaChart"><div class="caption center">Zu wenig Daten im gewählten Zeitraum – ab 2 Einträgen erscheint hier die Kurve. Über die Zeile „Zeitraum" darunter kannst du weiter zurückschauen.</div></div>`;
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
        '',
        {tone:'muted',txt:wk2CalibText(cal)});
    const hist=(R.history||[]).filter(x=>x&&x.date&&x.score!=null).map(x=>({date:x.date,value:+x.score}));
    const solo=(typeof _readySolo==='function')?_readySolo(R):'';
    // Die Handlungs-Aussage (R.headline) steht seit 2.8.0 ÜBER der Kurve – hier bleibt nur der Hinweis
    // auf eine Einzelquelle. Vorher stand derselbe Satz zweimal in derselben Karte.
    const txt=solo?`Geschätzt aus ${solo} – für eine belastbare Einschätzung fehlen noch Werte.`:'';
    // D-4 (5.1): Die graue Pille „Details" entfaellt. Der Weg zu den Teilwerten steht als benannte
    // Zeile „Woraus die Bereitschaft entsteht" unter der Karte (an5MetricBodyHTML).
    const extra=txt?`<div class="caption mt-2">${esc2(txt)}</div>`:'';
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
  const head=`Ø ${fmtNum(defs.d?Math.round(mean*10)/10:Math.round(mean),defs.d)}${defs.u?' '+defs.u:''} · ${an2Range().wort}${defs.goal!=null?` · ${defs.gl()}`:''}`;
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
// D-4: Diese Funktion baut keine Karte mehr, sondern liefert ihre DREI Teile: den einen Satz
// (`say`), die Kurve (`svg`) und den Fusstext (`foot`). Zusammengesetzt werden sie in
// `an5WeightHTML()` – dort, wo auch die Zahl steht. Vorher gab es zwei Karten uebereinander, die
// dieselbe Zahl nannten („78,4 kg" im Hero, „Trend 78,4 kg" im Kartenkopf 300 px darunter), und die
// Legende stand als `.caption` IN der Karte statt als Fusstext unter der Gruppe (G8).
function anaWeightCard(checkins,g){
  // Zeitraum aus der Zeitraum-Zeile statt „die letzten 90 Einträge" (Befund M10).
  const pts=an2Window(checkins||[]).filter(c=>c&&+c.weight>0&&c.date).map(c=>({t:Date.parse(c.date+'T00:00'),v:+c.weight,date:c.date}))
    .filter(p=>!isNaN(p.t)&&!isNaN(p.v)).sort((a,b)=>a.t-b.t);
  const wrap=(head,body,cap,say)=>({head,svg:body,foot:cap,say:say&&say.txt?say.txt:''});
  if(pts.length<2)return {head:'',svg:'',say:'',
    foot:'Ab zwei Wiegungen im gewählten Zeitraum entsteht hier die Kurve. Über die Zeile „Zeitraum" im Abschnitt Einträge kannst du weiter zurückschauen.'};
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
  // D-4/G8: aus der `.caption` in der Karte wird der Fusstext unter der Gruppe – ganze Saetze statt
  // einer Legende aus Gleichheitszeichen.
  let cap=`Die Punkte sind deine Wiegungen, die Linie ist der geglättete Verlauf über ${fmtNum(ANA_EMA_N)} Tage. Die Veränderung vergleicht diese Linie am Anfang und am Ende des Abschnitts, nicht zwei einzelne Wiegungen.`;
  if(gapDays)cap+=` Zwischen ${fmtDate(prev[prev.length-1].date)} und ${fmtDate(last[0].date)} liegen ${pl(gapDays,'Tag','Tage')} ohne Wiegung – dort ist die Linie unterbrochen, weil eine durchgezogene Linie über leere Tage eine Behauptung wäre.`;
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

// Die frühere Funktion `anaMetric` hat die Kachelreihe und das eine Diagramm darunter umgeschaltet. Beides gibt es
// nicht mehr: die Kennzahl fuehrt auf eine eigene Seite (an5OpenMetric). Der Name bleibt als
// Weiterleitung stehen, weil ihn aeltere Deep-Links und die Suche kennen koennen.

// Gewichtstrend: 7-Tage-Schnitt vs. die 7 Tage davor (sonst Spanne erster/letzter Eintrag auf eine Woche umgerechnet)
function anaWeekTrend(ws){if(!ws||ws.length<2)return null;const t=today();
  const A=ws.filter(c=>anaDayDiff(t,c.date)<=6),B=ws.filter(c=>{const d=anaDayDiff(t,c.date);return d>=7&&d<=13;});
  const mean=xs=>xs.reduce((s,c)=>s+ +c.weight,0)/xs.length;
  if(A.length&&B.length)return {perWeek:mean(A)-mean(B),kind:'avg'};
  const days=Math.max(1,anaDayDiff(ws[0].date,ws[ws.length-1].date));
  return {perWeek:(ws[0].weight-ws[ws.length-1].weight)/Math.max(1,days/7),kind:'span',days};}
// (Die frühere Funktion `anaTrendCls` stand hier: die Trendfarbe einer Kachel. A47 verlangt ohnehin ein WORT und nicht
//  nur eine Farbe – das Wort steht jetzt im Satz unter der Zahl, die Farbklasse faellt ersatzlos.)
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
// --- Abschnitt „Maße & Fotos" (DESIGN-4 6.9 / R12 / R17) --------------------------------------
// Vorher: zwei Kacheln bei y = 1.082, die Unterzeile der ersten abgeschnitten („Taille, Arm,
// Brust …") – und „Fotos vergleichen" lag drei Ebenen tief in einem Sheet im Sheet (R17).
// Nachher: drei Zeilen mit VOLLSTÄNDIGER Unterzeile (G11) direkt unter dem Gewichtsverlauf.
function an5PhysHTML(){
  const rows=[
    rowHTML({icon:'ruler',title:'Körpermaße',sub:'Taille, Brust, Arm, Hüfte, Oberschenkel und Körperfett',tap:'openMeasure()'}),
    rowHTML({icon:'camera',title:'Fortschrittsfotos',sub:'Alle zwei Wochen ein Bild – gleiche Pose, gleiches Licht',tap:'openPhotos()'}),
    rowHTML({icon:'eye',title:'Vorher und Nachher',sub:'Zwei Aufnahmen derselben Pose nebeneinander vergleichen',tap:'an5Compare()'}),
  ];
  let foot='Maße und Fotos zeigen, was die Waage nicht zeigt: wo sich etwas verändert hat. Beides ist freiwillig.';
  if(isBeginner()&&!coachView())foot='Für den Anfang reicht dein Gewicht. Wenn du weiter bist, halte hier auch Körpermaße und Fortschrittsfotos fest – beides hilft deinem Coach. Fotos sehen nur du und dein zugewiesener Coach.';
  return groupHTML('Maße & Fotos',rows,foot);}

// --- Abschnitt „Verbindungen" -----------------------------------------------------------------
// „Gesundheitsdaten verbinden" stand bei y = 1.779 als vollbreiter Knopf ganz unten (R12). Jetzt
// eine Zeile mit Wert rechts – sie beantwortet „ist etwas verbunden?" ohne Tap (A28).
function an5LinkHTML(){
  const hl=an5LinkHTML.stand;
  return groupHTML('Verbindungen',[rowHTML({icon:'apple',title:'Gesundheitsdaten',
      sub:'Apple Health, Health Connect, Fitbit und Garmin',
      pill:hl===true?{text:'verbunden',tone:'green'}:hl===false?{text:'nicht verbunden',tone:'neutral'}:null,
      tap:'openIntegrations()'})],
    'Ist eine Gesundheits-App verbunden, kommen Schlaf, Schritte, Verbrauch und Puls von selbst in deine Auswertung – du trägst sie dann nicht mehr von Hand ein.');}
// Der Stand des persönlichen Links wird NICHT eigens abgefragt: `openIntegrations()` holt ihn beim
// Öffnen ohnehin und legt ihn hier ab. Ohne diesen Stand bleibt die Pille weg – eine Pille, die rät,
// wäre schlechter als keine (A47).
an5LinkHTML.stand=null;

// --- „Vorher / Nachher" ohne Umweg über das Foto-Raster (R17) ---------------------------------
// Bis 3.0.2 führte der Vergleich über: Analyse → Kachel Fotos (Sheet) → Knopf im Sheet → Sheet im
// Sheet. Jetzt ist es EINE Zeile. Die Foto-Liste, die `an2CompareOpen()` braucht, wird hier geholt –
// dieselbe Anfrage, die `openPhotos()` auch stellt, nur ohne dessen Bildschirm dazwischen.
async function an5Compare(){const uid=VIEW_USER;if(!uid)return;
  openSheet('Vorher / Nachher','<div class="spinner"></div>');
  const r=await API.get(phPath(uid));
  if(!sheetOpen())return;
  if(r.status!==200){openSheet('Vorher / Nachher',stlNotLoaded('Fortschrittsfotos',r.status,'an5Compare()'));return;}
  const list=r.data?.photos||[];
  openPhotos.uid=uid;openPhotos.list=list;openPhotos.shown=0;
  openPhotos.more=list.length===PH_PAGE&&r.data?.more!==false&&r.data?.hasMore!==false;
  if(list.length<2){openSheet('Vorher / Nachher',emptyState({icon:'camera',
    title:list.length?'Erst ein Foto':'Noch keine Fotos',
    text:'Zum Vergleichen braucht es zwei Bilder derselben Pose – gleicher Abstand, gleiches Licht, gleiche Tageszeit.',
    btn:{label:'Fortschrittsfotos öffnen',onclick:'openPhotos()'}}));return;}
  an2CompareOpen();}

// --- Check-in Historie: eine Gruppe aus der einen Zeile ----------------------------------------
// Die vollständige Liste (ohne Fenster) holt erst der Tipp auf die letzte Zeile – eigener
// Cache-Schlüssel, damit das Segment weiterhin mit dem kleinen Fenster (anaCheckinPath) auskommt.
// D-4 (5.1): Aus der grauen Pille „Mehr anzeigen" am Listenende wird die LETZTE ZEILE der Gruppe
// („Alle 42 Einträge ansehen ›"), aus „Nachtragen" die Wortaktion im Abschnittskopf.
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
  // Die Zeitraum-Zeile ist die erste Zeile der Gruppe (6.9) – sie steht auch dann da, wenn die
  // Liste leer ist: dann ist genau sie die Antwort auf „warum sehe ich nichts?".
  const kopf=an5RangeRow('Wie weit Liste und Kurve zurückreichen');
  if(!h.length){el.innerHTML=kopf+rowHTML({icon:'calendar',title:'Noch keine Einträge',sub:'Dein erster Check-in erscheint hier'});return;}
  const show=Math.max(AN5_HIST_VOR,Math.min(n||AN5_HIST_VOR,h.length));loadHist.shown=show>AN5_HIST_VOR?show:0;
  el.innerHTML=kopf+h.slice(0,show).map(anaHistRow).join('')+loadHist.rest(show,h.length,n>7);}
// Die letzte Zeile der Gruppe. Solange nur das Fenster geladen ist, ist die Gesamtzahl unbekannt –
// dann steht keine Zahl darin, sondern das, was sie tut.
const AN5_HIST_VOR=5;   // so viele Tage stehen ohne Tap da – der Rest ist eine Zeile entfernt
loadHist.rest=function(shown,total,exact){
  if(total<=shown&&exact)return '';
  const rest=total-shown;let h='';
  if(rest>0||!exact)h+=rowHTML({icon:'calendar',
    title:exact?`Alle ${fmtNum(total)} Einträge ansehen`:'Ältere Einträge ansehen',
    sub:exact?`${fmtNum(shown)} von ${fmtNum(total)} stehen hier · die nächsten ${fmtNum(Math.min(ANA_HIST_STEP,rest))} kommen dazu`:'Lädt die vollständige Liste nach',
    tap:'loadHistMore()'});
  if(shown>AN5_HIST_VOR)h+=rowHTML({icon:'chevronDown',title:`Wieder auf ${fmtNum(AN5_HIST_VOR)} Einträge kürzen`,tap:'loadHist.shown=0;loadHist()'});
  return h;};
// Nächste Stufe anhängen: insertAdjacentHTML statt innerHTML, damit die stehenden Zeilen nicht neu
// geparst werden. Vorher schrieb „Alle anzeigen" bis zu 1.100 Zeilen (196 KB HTML) in EINEM Stück.
async function loadHistMore(){const el=document.getElementById('histlist');if(!el)return;
  const all=(await anaCheckinsAll())||anaCached('checkins')||[];
  if(!document.getElementById('histlist'))return;
  const h=all.slice().sort((a,b)=>a.date<b.date?1:-1);
  const from=Math.max(AN5_HIST_VOR,+loadHist.shown||AN5_HIST_VOR),to=Math.min(h.length,from+ANA_HIST_STEP);
  loadHist.shown=to>AN5_HIST_VOR?to:0;
  el.innerHTML=an5RangeRow('Wie weit Liste und Kurve zurückreichen')
    +h.slice(0,to).map(anaHistRow).join('')+loadHist.rest(to,h.length,true);}
// Eine Zeile je Tag: links das Datum und darunter ALLE übrigen Werte des Tages, rechts das Gewicht.
// D-4/G11: Die Unterzeile wird nicht mehr nach drei Werten abgeschnitten („· +1 Wert") und nicht
// mehr per `text-overflow` gekappt – sie bricht um. Gemessen waren das 5 von 5 sichtbaren Zeilen mit
// abgeschnittener Beschriftung (K8). G9: statt eines Gedankenstrichs steht da, was wirklich fehlt.
function anaHistRow(c){const parts=[];
  if(c.sleep!=null)parts.push(fmtNum(c.sleep,1)+' h Schlaf');
  if(c.steps!=null)parts.push(fmtNum(Math.round(c.steps))+' Schritte');
  if(c.active_kcal!=null)parts.push(fmtNum(Math.round(c.active_kcal))+' kcal aktiv');
  if(c.water!=null)parts.push(fmtNum(c.water,1)+' L Wasser');
  if(c.resting_hr!=null)parts.push(fmtNum(Math.round(c.resting_hr))+' bpm Ruhepuls');
  if(c.weight==null)parts.push('Gewicht noch nicht eingetragen');
  let sub=parts.join(' · ')||'nur das Gewicht';
  if(c.coach_notes)sub+=' · Anmerkung deines Coachs: '+c.coach_notes;
  return rowHTML({icon:'calendar',title:fmtDate(c.date,{weekday:'long'}),sub,
    value:c.weight!=null?fmtNum(c.weight,1)+' kg':'',
    tap:coachView()?null:`anaOpenCheckin('${c.date}')`});}
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
  else if(!o.keep||!b.children.length)b.innerHTML=`<div class="skeleton lg"></div>${skeleton(4,'sm')}`;
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
// ===== D-4 · TRAINING: Sätze je Muskelgruppe statt Tonnage, sechs benannte Abschnitte =====
// Vorher (gemessen, `tracker-training`): 3.306 px, 17 Zeilenformen, 0 `.rows-h`, 0 `.rows-f`, zwei
// Steuerebenen, und als Leitzahl „20,4 t Volumen diese Woche" – eine Zahl, die die Beinpresse
// belohnt und verschweigt, dass seit 88 Tagen kein Zug-Satz stattfand (DESIGN-4 6.10, Befund B22).
// Nachher: die Einsicht als Hauptaussage, dann Sätze je Muskelgruppe, dann die Belege.
// „t" kommt in keiner Zeile mehr vor; wo Volumen bleibt, heißt es „20.383 kg bewegt" (R15).
function anaPaintTraining(){const b=document.getElementById('anaBody');if(!b)return;
  const a=anaCached('analytics'),INS=anaCached('insights'),MG=anaCached('monthly'),cardio=anaCached('cardio');
  an5SetTitle();
  const empty=!a||!a.totals||!a.totals.totalSets;
  const wk=anaWeek(a,INS);let h='';
  if(empty){
    h+=emptyState({icon:'dumbbell',title:'Noch keine Trainingsdaten',text:'Sobald Sätze eingetragen sind, siehst du hier, welche Muskelgruppe zu kurz kommt und wie sich jede Übung entwickelt.',btn:coachView()?null:{label:'Training starten',onclick:"renderWorkout.tab='kraft';go('workout')"}});
    h+=an5GoalsHTML(INS,MG,cardio,wk);b.innerHTML=h;return;}
  h+=an5TrainLeadHTML(a);      // 1 · die eine Aussage über dem Falz
  // DIE EINE PRIMAERAKTION (G10/K10). Die Auswertung endet immer bei derselben Handlung: den Plan
  // aendern. Sie steht deshalb direkt unter der Einsicht und traegt das Wort dafuer – im Coach-Blick
  // fuehrt sie zum Plan des Athleten, nicht zum eigenen.
  if(!coachView())h+=`<button class="btn an5-cta" onclick="renderWorkout.tab='kraft';go('workout')">${icon('dumbbell',18)} Trainingsplan öffnen</button>`;
  h+=an5MuscleHTML(a);         // 2 · Sätze je Muskelgruppe (6.10, die Leitzahl)
  h+=an5WeekNowHTML(a,wk);     // 3 · diese Woche in drei Zeilen
  h+=an5ExercisesHTML(a);      // 4 · Übungen
  h+=an5GoalsHTML(INS,MG,cardio,wk); // 5 · Ziele & Erfolge
  h+=an5TrainRangeHTML(a);     // 6 · Zeitraum und Wochen-Verlauf
  b.innerHTML=h;}

// --- 1 · Die Hauptaussage --------------------------------------------------------------------
// Zeile 1 sagt, WAS ist. Zeile 2 sagt, was daraus folgt. Mehr steht nicht in der Karte – die Zahl,
// auf der beides beruht, steht als Balken direkt darunter und kann dort nachgeprüft werden.
function an5TrainLeadHTML(a){const st=anaMuscleStats(a);if(!st||!st.rows.length)return '';
  const msg=anaMuscleMsg(st);if(!msg||!msg.txt)return '';
  // msg.txt und msg.next enthalten bereits durch esc2() gelaufene Muskelnamen – ein zweites esc2
  // machte daraus „&amp;".
  return `<div class="card lg an5-hero"><p class="an5-say">${msg.txt}</p>`
    +(msg.next?`<p class="an5-quiet">${msg.next}</p>`:'')+`</div>`;}

// --- 2 · Sätze je Muskelgruppe ----------------------------------------------------------------
// Die eine Zeile, dazu der Balken aus 5.7 („Balken = Anteil in einer Liste") und die eine Marke für
// „hier musst du hinschauen" aus 5.10 – mit einem WORT, nie nur als Farbe (A47).
function an5MuscleHTML(a){
  const st=anaMuscleStats(a);
  // Ohne zählbare Sätze bleibt die bewegte Last – dann aber mit dem Etikett, das sie verdient.
  if(!st||!st.rows.length){const ms=(a&&a.muscles)||[];if(!ms.length)return '';
    const max=Math.max(...ms.map(m=>+m.volume||0))||1;
    return groupHTML('Bewegte Last je Muskelgruppe',ms.map(m=>an5RowBar(
        rowHTML({title:m.muscle,sub:'seit dem ersten Training',value:fmtNum(Math.round(+m.volume||0))+' kg'}),
        (+m.volume||0)/max*100)),
      'Bewegte Last ist Gewicht mal Wiederholungen über die gesamte Zeit. Sie sagt nichts darüber, wie viele harte Sätze eine Gruppe bekommen hat, und zählt Übungen mit dem eigenen Körpergewicht mit 0 kg. Sobald in deinen Übungen Muskelgruppen hinterlegt sind, steht hier stattdessen die Zahl der Sätze pro Woche.');}
  const marke=r=>r.sets===0?{text:'nichts eingetragen',tone:'neutral'}
    :r.perWeek==null?{text:'erste Woche läuft',tone:'neutral'}
    :r.perWeek<ANA_MUSC_LO?{text:'zu wenig',tone:'amber'}
    :r.perWeek<=ANA_MUSC_HI?{text:'im Korridor',tone:'green'}
    :{text:'über dem Korridor',tone:'neutral'};
  const bal=r=>r.perWeek==null?'unknown':r.sets===0?'zero':r.perWeek<ANA_MUSC_LO?'low':r.perWeek<=ANA_MUSC_HI?'ok':'';
  const wert=r=>!r.sets?'0 Sätze'
    :r.perWeek==null?pl(r.thisWeek||r.sets,'Satz','Sätze')
    :fmtNum(r.perWeek,1)+' Sätze/Woche';
  const unter=r=>r.none
    ?`aus Übungen ohne hinterlegte Muskelgruppe – trag sie in der Übung nach, dann zählen sie oben mit`
    :!r.sets?'in diesem Zeitraum kein einziger Satz'
    :`im Schnitt · ${fmtNum(r.sets)} in ${pl(st.days,'Tag','Tagen')}`
      +(r.perWeek==null?'':' · diese Woche '+fmtNum(r.thisWeek||0));
  const rows=st.rows.filter(r=>r.sets>0).map(r=>an5RowBar(
    rowHTML({title:r.muscle,sub:unter(r),value:wert(r),pill:marke(r)}),
    r.perWeek==null?0:Math.min(100,r.perWeek/ANA_MUSC_HI*100),bal(r)));
  // Gruppen ohne einen einzigen Satz bekommen keinen eigenen Balken (sechs leere Balken sagen
  // weniger als eine Zeile), aber sie werden VOLLSTÄNDIG benannt – das ist der eigentliche Befund.
  const zero=an2ByWeight(st.rows.filter(r=>r.sets===0&&!r.none));
  if(zero.length)rows.push(rowHTML({title:'Ohne einen einzigen Satz',
    sub:zero.map(r=>r.muscle).join(', '),pill:{text:pl(zero.length,'Gruppe','Gruppen'),tone:'amber'}}));
  return groupHTML('Sätze je Muskelgruppe',rows,
    `Der Korridor liegt bei ${fmtNum(ANA_MUSC_LO)} bis ${fmtNum(ANA_MUSC_HI)} harten Sätzen je Muskelgruppe und Woche – eine Orientierung aus der Trainingslehre, keine feste Regel. `
    +`Der Balken misst gegen ${fmtNum(ANA_MUSC_HI)} Sätze, der Strich in der Mitte steht bei ${fmtNum(ANA_MUSC_LO)}. `
    +`Gezählt wird der Schnitt der ${st.doneWeeks?pl(st.doneWeeks,'abgeschlossenen Woche','abgeschlossenen Wochen'):'abgeschlossenen Wochen'}; die laufende Woche bleibt draußen, sonst stünde jeder Montag als Rückstand da. `
    +`Aufwärmsätze zählen nicht mit. Jeder Satz zählt auf genau eine Gruppe – der Bizeps beim Rudern und der Trizeps beim Bankdrücken sind darin nicht enthalten.`
    +(st.partial?' Gezählt wird der Zeitraum, den dein Satzprotokoll vollständig abdeckt.':'')
    +(st.src==='logs'?' Die bewegten Kilogramm lassen Übungen mit dem eigenen Körpergewicht außen vor.':''));}

// --- 3 · Diese Woche --------------------------------------------------------------------------
// Aus zwei Kacheln („2/4 Trainings diese Woche" · „20,4 t Volumen diese Woche") und einer grauen
// Zeile „Gesamt: 17 Trainingstage · 188 Sätze · 139 t" werden drei Zeilen und ein Fusstext. Die
// laufende Woche bekommt kein Urteil und keine Richtung, sondern den Stand (P4).
function an5WeekNowHTML(a,wk){const tw=wk.tw,lw=wk.lw;
  const tag=((new Date(today()+'T00:00:00').getDay()+6)%7)+1,laeuft=tag<7;
  const offen=Math.max(0,wk.target-tw.sessions);
  const rows=[
    rowHTML({icon:'calendar',title:'Einheiten',
      sub:`von ${pl(wk.target,'geplanten Einheit','geplanten Einheiten')}${laeuft?` · Tag ${fmtNum(tag)} von 7`:''}`,
      value:fmtNum(tw.sessions),
      pill:tw.sessions>=wk.target?{text:'Wochenziel erreicht',tone:'green'}
        :laeuft?{text:offen===1?'noch eine offen':`noch ${fmtNum(offen)} offen`,tone:'neutral'}
        :{text:offen===1?'eine gefehlt':`${fmtNum(offen)} gefehlt`,tone:'amber'}}),
  ];
  // Die Satzzahl der laufenden Woche steht nicht in jeder Antwort – eine 0 waere dort keine Zahl,
  // sondern eine Behauptung (G9). Dann bleibt die Zeile weg.
  if(tw.sets!=null)rows.push(rowHTML({icon:'dumbbell',title:'Sätze',sub:'Arbeitssätze dieser Woche, ohne Aufwärmsätze',value:fmtNum(tw.sets)}));
  rows.push(rowHTML({icon:'scale',title:'Bewegte Last',
      sub:`Gewicht mal Wiederholungen${lw.volume?` · Vorwoche ${fmtNum(Math.round(lw.volume))} kg`:''}`,
      value:fmtNum(Math.round(tw.volume||0))+' kg'}));
  const T=(a&&a.totals)||{};
  return groupHTML('Diese Woche',rows,
    `Insgesamt stehen ${pl(T.totalSessions||0,'Trainingstag','Trainingstage')}, ${pl(T.totalSets||0,'Satz','Sätze')} und ${fmtNum(Math.round(T.totalVolume||0))} kg bewegte Last in deinem Protokoll. `
    +'Übungen mit dem eigenen Körpergewicht zählen dabei 0 kg – die App kennt dein Körpergewicht in der Übung nicht.'
    +(laeuft?' Solange die Woche läuft, steht hier der Stand und kein Urteil: Tag 1 von 7 ist kein Einbruch.':''));}

// --- 4 · Übungen ------------------------------------------------------------------------------
// Die Zeile beantwortet, was ein Athlet vor dem Satz wissen will, ohne einen einzigen Tap: wann
// zuletzt, mit welchem Gewicht, wie viele Wiederholungen. „e1RM" heißt ausgeschrieben
// „geschätztes Maximum" (R15/G9); der Fusstext erklärt, wie es entsteht.
function an5ExercisesHTML(a){
  const exs=(a.exercises||[]).map(e=>({...e,gain:Math.round(((+e.lastWeight||0)-(+e.firstWeight||0))*10)/10}))
    .sort((x,y)=>{const nx=x.sessions<2,ny=y.sessions<2;if(nx!==ny)return nx?1:-1;return y.gain-x.gain;});
  if(!exs.length)return groupHTML('Übungen',[rowHTML({icon:'dumbbell',title:'Noch keine Übung mit Sätzen',sub:'Ab dem ersten protokollierten Satz steht hier jede Übung mit ihrer Entwicklung'})],'');
  const vari=anaExVariants(exs); // gleichnamige Übungen unterscheidbar machen
  let e1=false;
  const rows=exs.map(e=>{
    const v=vari[e.id]||'';
    const teile=[];
    if(e.lastDate&&+e.lastWeight>0)teile.push(`zuletzt ${fmtDate(e.lastDate,{weekday:'short'})} · ${fmtNum(e.lastWeight,1)} kg`+(+e.repsAtTop>0?` × ${fmtNum(e.repsAtTop)}`:''));
    teile.push(pl(e.sessions,'Einheit','Einheiten'));
    if(e.muscle)teile.push(e.muscle);
    // Das geschätzte Maximum erscheint ab Stufe 2 – für einen Einsteiger ist es ein Rätsel.
    if(an2Level()>=2&&e.best1rm){teile.push('geschätztes Maximum '+fmtNum(e.best1rm)+' kg');e1=true;}
    const wert=e.sessions<2?'neu':e.gain>0?`+${fmtNum(e.gain,1)} kg`:e.gain<0?`${fmtNum(e.gain,1)} kg`:'unverändert';
    return rowHTML({title:e.name+(v?' · '+v:''),sub:teile.join(' · '),value:wert,
      tap:`anaExHistory(${e.id},'${esc(e.name+(v?' · '+v:''))}')`});});
  let foot='Sortiert nach Fortschritt: oben steht, was am meisten zugelegt hat. „102,5 kg × 10" heißt: 102,5 Kilogramm mit zehn Wiederholungen im schwersten Arbeitssatz. Die Zahl rechts ist die Veränderung deines Arbeitsgewichts seit der ersten Einheit, nicht die Last eines einzelnen Satzes.';
  if(e1)foot+=' Das geschätzte Maximum rechnet aus deinem besten Arbeitssatz hoch, was du einmal schaffen würdest – geschätzt, nicht gemessen, und nur innerhalb derselben Übung vergleichbar.';
  return groupHTML('Übungen',rows,foot);}

// --- 5 · Ziele & Erfolge ----------------------------------------------------------------------
// Vier `.stat-strip` (eine eigene Zeilenform mit eigenem Chevron) werden vier `.row` (4.6).
// Kürzel wie „2/4" und „13/35" stehen ausgeschrieben da (G9).
function an5GoalsHTML(INS,MG,cardio,wk){
  const rows=[];
  rows.push(rowHTML({icon:'target',title:'Monatsziel',
    sub:(MG&&MG.parts)?(MG.allReached?'Alle Teilziele dieses Monats erreicht':`${fmtNum(MG.reachedCount)} von ${fmtNum(MG.parts.length)} Teilzielen geschafft`):'Drei Teilziele je Monat',
    value:(MG&&MG.parts&&MG.allReached)?'erreicht':'',tap:'openMonthlyGoal()'}));
  const serie=INS&&INS.streaks&&INS.streaks.weekGoal;
  rows.push(rowHTML({icon:'calendar',title:'Wochenziel',
    sub:`${fmtNum(wk.tw.sessions)} von ${pl(wk.target,'geplanten Einheit','geplanten Einheiten')} diese Woche`
      +(serie?` · ${pl(serie,'Woche','Wochen')} in Folge geschafft`:''),
    tap:"renderWorkout.tab='kraft';go('workout')"}));
  if(INS){const list=INS.achievements||[];
    rows.push(rowHTML({icon:'star',title:`Level ${fmtNum(INS.level||1)} · ${INS.levelTitle||'Rookie'}`,
      sub:`${fmtNum(list.filter(x=>x.done).length)} von ${fmtNum(list.length)} Erfolgen · ${fmtNum(INS.xp||0)} Erfahrungspunkte`,
      tap:'openAchievements()'}));}
  const cw=anaCardioWeek(cardio);
  rows.push(rowHTML({icon:'heart',title:'Cardio diese Woche',
    sub:cw.n?`${pl(cw.n,'Einheit','Einheiten')}${cw.km?' · '+fmtNum(cw.km,1)+' km':''} · ${fmtNum(Math.round(cw.kcal))} kcal`:'Noch keine Einheit eingetragen',
    value:cw.n?fmtNum(cw.min)+' min':'',tap:"renderWorkout.tab='cardio';go('workout')"}));
  return groupHTML('Ziele & Erfolge',rows,
    'Erfahrungspunkte gibt es für Sätze, Check-ins, Cardio, Fotos und Maße – am meisten für neue Bestleistungen. Das Monatsziel setzt die App aus deinem Rhythmus; dein Coach kann es überschreiben.');}

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


// --- 6 · Zeitraum und Wochen-Verlauf ----------------------------------------------------------
function an5TrainRangeHTML(a){
  const rows=[an5RangeRow('Gilt für die Sätze je Muskelgruppe und für den Wochen-Verlauf')];
  if(a&&a.weeks&&a.weeks.length>=2){
    const ser=an2WeekSeries(a,Math.max(2,Math.round(an2Range().days/7)));
    const cur=ser.length?ser[ser.length-1]:null;
    rows.push(rowHTML({icon:'chartLine',title:'Wochen-Verlauf',
      sub:cur?(cur.week===anaMonday(today())?'laufende Woche':'zuletzt abgeschlossene Woche')+`: ${fmtNum(Math.round(cur.volume||0))} kg bewegt`:'Bewegte Last Woche für Woche',
      tap:'an5OpenWeeks()'}));}
  return groupHTML('Zeitraum',rows,
    'Der Zeitraum bestimmt, wie weit die Zahlen auf dieser Seite zurückreichen. Er gilt auch im Bereich Körper und bleibt gespeichert, bis du ihn wieder änderst.');}

// --- Push-Seite „Wochen-Verlauf" (Eltern: Analyse) --------------------------------------------
// Die Volumenkurve war bis 3.0.2 die zweitgrößte Fläche im Trainings-Segment und trug als einzige
// Zahl „t" – ein Kürzel ohne Erklärung. Sie bleibt (G5: nichts verschwindet), aber sie ist nicht
// mehr die Leitzahl: sie bekommt einen eigenen Bildschirm mit Namen, Rückweg und Fusstext.
function an5OpenWeeks(){const a=anaCached('analytics');if(!a||typeof pushPage!=='function')return;
  AN5_PAGE=null;
  pushPage('ana-weeks','Wochen-Verlauf','Analyse',an5WeeksBodyHTML(a),{sub:an2Range().wort});}
function an5WeeksBodyHTML(a){
  const nw=Math.max(2,Math.round(an2Range().days/7));
  const weeks=an2WeekSeries(a,nw);
  if(weeks.length<2)return emptyState({icon:'chartLine',title:'Zu wenig Wochen',text:'Ab zwei Wochen mit Training entsteht hier die Kurve.'});
  const cur=weeks[weeks.length-1],laeuft=cur.week===anaMonday(today());
  const luecken=weeks.filter(w=>w.gap).length;
  return `<div class="chart-card"><div class="ch-h"><div class="t">${laeuft?'laufende Woche':'zuletzt'}: ${fmtNum(Math.round(cur.volume||0))} kg</div></div>`
    +an2SayHTML(an2WeekSay(a))
    +lineChart(weeks.map(w=>({date:w.week,value:w.volume/1000})),'t',{partialLast:laeuft,tickFmt:v=>fmtNum(v,Number.isInteger(v)?0:1)+' t'})
    +`</div>`
    +groupHTML('Zeitraum',[an5RangeRow('Wie viele Wochen die Kurve zeigt')],
      'Ein Punkt ist eine Kalenderwoche. Gerechnet wird Gewicht mal Wiederholungen; „1 t" auf der Achse sind 1.000 kg bewegte Last. '
      +'Übungen mit dem eigenen Körpergewicht zählen dabei 0 kg. '
      +(laeuft?'Der hohle Punkt ganz rechts ist die laufende Woche – sie ist noch nicht fertig. ':'')
      +(luecken?`${pl(luecken,'Eine Woche','Wochen')} ohne Training stehen als 0 im Bild, statt dass die Linie quer darüber zieht. `:'')
      +'Die bewegte Last sagt nichts darüber, welche Muskelgruppe wie viele harte Sätze bekommen hat – dafür steht der Abschnitt „Sätze je Muskelgruppe".');}
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

// (Die frühere Funktion anaGoalsStrip stand hier: vier `.stat-strip` mit eigenem Chevron und eigener Zeilenhoehe.
//  DESIGN-4 4.6 macht daraus `.row` – der Ersatz heisst `an5GoalsHTML()` und steht oben im
//  Trainings-Abschnitt, bei den anderen fuenf Gruppen.)

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
      <div><div class="num-md">${diff>0?'+':''}${fmtNum(diff,1)}<em class="meta"> kg</em></div><div class="caption">seit Beginn</div></div>
      <div><div class="num-md">${fmtNum(sess.length)}</div><div class="caption">${sess.length===1?'Einheit':'Einheiten'}</div></div></div>`;
  if(sess.length>=2){
    // Beide Achsen vorgeben: lineChart2 leitet die rechte Beschriftung aus den linken Linien ab – ohne
    // eigene Wiederholungs-Achse stünde bei konstanten Reps „10,1 Wdh." an der Skala (_axis5 aus training.js).
    let o={};
    if(typeof _axis5==='function'){const A1=_axis5(sess.map(s=>s.top),0.5),A2=_axis5(sess.map(s=>s.reps),1);
      o={domain1:A1.domain,step1:A1.step,tickFmt1:v=>fmtNum(v,Number.isInteger(v)?0:1),
         domain2:A2.domain,step2:A2.step,tickFmt2:v=>fmtNum(Math.round(v))};}
    h+=`<div class="chart-card"><div class="ch-h"><div class="t">Top-Gewicht und Wiederholungen</div><div class="v">${fmtNum(lastS.top,1)} kg × ${fmtNum(lastS.reps)} zuletzt</div></div>${lineChart2(sess.map(s=>({date:s.date,v1:s.top,v2:s.reps})),'Gewicht','kg','Wiederh.','',o)}</div>`;}
  else h+=`<div class="note mb-3">Erste Einheit: ${fmtNum(first.top,1)} kg × ${fmtNum(first.reps)} am ${fmtDate(first.date,{month:'long'})} – ab der zweiten Einheit erscheint hier die Kurve.</div>`;
  h+=an2E1rmHTML(sess,r.data);
  h+=groupHTML('Letzte Einheiten',sess.slice(-3).reverse().map(s=>rowHTML({icon:'calendar',
      title:fmtDate(s.date,{weekday:'long'}),sub:setsTxt(s),
      value:`${fmtNum(s.top,1)} kg × ${fmtNum(s.reps)}`})),
    'Rechts steht der schwerste Arbeitssatz des Tages mit seinen Wiederholungen, darunter alle Sätze dieses Tages. Aufwärmsätze sind nicht dabei.');
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
  // D-4/G8: aus der `.caption` in der Karte wird der Fusstext unter der Gruppe – und aus dem
  // Kuerzel „e1RM" das Wort „geschätztes Maximum" (R15). Die Formel steht weiter darin: wer sie
  // kennt, findet sie; wer sie nicht kennt, braucht sie nicht zu kennen.
  const foot=`<p class="rows-f">Das geschätzte Maximum sagt, welches Gewicht du voraussichtlich genau einmal schaffen würdest. Gerechnet wird es nach ${esc2(formula)}: Gewicht × (1 + Wiederholungen ÷ 30), aus deinem besten Arbeitssatz je Trainingstag und nur bis ${fmtNum(maxReps)} Wiederholungen – darüber wird die Formel unbrauchbar. Aufwärmsätze zählen nicht. Die Zahl ist geschätzt, nicht gemessen, und nur innerhalb dieser Übung vergleichbar.</p>`;
  // Kein einziger schätzbarer Satz (alles über der Grenze): das ist eine Auskunft, kein leerer Kasten.
  if(!rows.length)return `<div class="note mb-3">Für diese Übung gibt es noch kein geschätztes Maximum: geschätzt wird nur aus Arbeitssätzen bis ${fmtNum(maxReps)} Wiederholungen.</div>`;
  const last=rows[rows.length-1],first=rows[0];
  const best=rows.reduce((a,b)=>b.value>a.value?b:a);
  // Richtung aus dem MEDIAN der ersten und der letzten drei schätzbaren Einheiten, nicht aus
  // „letzter Punkt minus erster Punkt". Das ist genau der Fehler, an dem die Gewichtskurve bis 2.8.0
  // scheiterte (Befund M1: Kopfzeile „+15,4 kg" neben Kachel „+0,1 kg/Woche") – ein einzelner guter
  // oder schlechter Tag am Rand entschied sonst über die Aussage einer ganzen Kurve.
  const med=xs=>(typeof wk2Median==='function')?wk2Median(xs):xs.slice().sort((a,b)=>a-b)[Math.floor(xs.length/2)];
  const k=Math.min(3,Math.floor(rows.length/2))||1;
  const d=Math.round((med(rows.slice(-k).map(r=>r.value))-med(rows.slice(0,k).map(r=>r.value)))*10)/10;
  if(rows.length<2)return `<div class="note mb-3">Geschätztes Maximum ${fmtNum(last.value,1)} kg aus ${fmtNum(last.top,1)} kg × ${fmtNum(last.reps)} – ab der zweiten schätzbaren Einheit erscheint hier der Verlauf.</div>${foot}`;
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
  return `<h2 class="rows-h">Geschätztes Maximum</h2><div class="chart-card"><div class="ch-h"><div class="t">${head}</div></div>`
    +an2SayHTML(say)+metricChart(rows,'kg',null,null,o)
    +`</div>${foot.replace('<p class="rows-f">','<p class="rows-f">Jeder Punkt ist der beste Arbeitssatz eines Trainingstages, zuletzt '+fmtNum(last.top,1)+' kg mit '+pl(last.reps,'Wiederholung','Wiederholungen')+'. ')}`;}

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
  // D-4: Die Kopfzeile mit den zwei Pfeilknoepfen gibt es nicht mehr – die angezeigte Woche steht im
  // Untertitel des grossen Titels, und der wird sofort gesetzt. Im Ladezustand stehen deshalb nur
  // Platzhalter in der Form dessen, was kommt (5.11).
  an5SetTitle();
  if(!have&&(!o.keep||!b.children.length))b.innerHTML=skeleton(3,'lg');
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
// (Die frühere Funktion wk2BalanceHTML stand hier: eine eigene Kartenform mit eigener Zeile `.wk2-bal-r`.
//  DESIGN-4 4.6/6.10 macht daraus eine Gruppe aus der einen Zeile – `an5BalanceHTML()`.

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
  return groupHTML('Bestleistungen dieser Woche',list.slice(0,8).map(p=>{
    const val=(+p.weight>0)?`${fmtNum(p.weight,1)} kg${+p.reps>0?` × ${fmtNum(p.reps)}`:''}`
      :(+p.e1rm>0?`${fmtNum(p.e1rm,1)} kg geschätzt`:'');
    const before=(+p.prev>0)?`vorher ${fmtNum(p.prev,1)} kg`:(+p.before>0?`vorher ${fmtNum(p.before,1)} kg`:'');
    const when=p.date?fmtDate(p.date,{weekday:'long'}):'';
    return rowHTML({icon:'trophy',title:String(p.exercise||p.name||'Übung'),
      sub:[when,before].filter(Boolean).join(' · '),value:val});}),
    'Eine Bestleistung ist ein Satz, der schwerer war als alles, was in dieser Übung vorher protokolliert wurde. '
    +'Steht dort „geschätzt", war der Rekord kein Einzelsatz, sondern das aus deinem besten Arbeitssatz hochgerechnete Maximum.');}
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
  if(!coachView())return groupHTML('Beschwerden',
    [rowHTML({icon:'alertTriangle',title:pl(open,'offene Beschwerde','offene Beschwerden'),
      sub:(names||'zu deinen Übungen')+' · liegt bei deinem Coach'})],
    'Eine Beschwerde ist eine Anmerkung, die du an einem Satz hinterlassen hast. Dein Coach sieht sie in seiner Übersicht und meldet sich dazu.');
  return wk2FlagCoachHTML(open,names);}
// Der Knopf führt genau dorthin, wo die Beschwerde bearbeitet wird (Coach-Dashboard, Paket B-I.6) –
// `openDashboard` gehört coach.js und wird defensiv aufgerufen: fehlt es, bleibt die Athletenliste.
function wk2FlagCoachHTML(open,names){
  // D-4 (5.1): Aus der grauen Pille „Bearbeiten" rechts in der Zeile wird die Zeile selbst – sie
  // sagt, wohin sie fuehrt, und ist auf ganzer Breite zu treffen statt auf 70 px.
  return groupHTML('Beschwerden',
    [rowHTML({icon:'alertTriangle',title:pl(open,'offene Beschwerde','offene Beschwerden'),
      sub:(names||'zu den Übungen dieses Athleten')+(open>3?' und weitere':''),
      tap:"typeof openDashboard==='function'?openDashboard(VIEW_USER):go('athletes')"})],
    'Bearbeitet werden Beschwerden im Dashboard – dort steht der Freitext, den dein Athlet am Satz hinterlassen hat.');}
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

// Eine Zeile des Rückblicks. D-4: aus `_weekRow` (eigene Zeilenform `.ana-wk-row` mit zweizeiligem
// rechten Block) wird die EINE Zeile aus 4.5. Der Vergleich mit der Vorwoche wandert dabei aus dem
// rechten Block in die Unterzeile – rechts steht genau eine Zahl, wie in jeder anderen Liste der App.
// label/sub sind KLARTEXT (rowHTML escapet selbst); Zahlen kommen durch fmtNum().
function an5WeekRow(icon,label,val,sub,cmp){
  return rowHTML({icon,title:label,sub:[sub,cmp].filter(Boolean).join(' · '),value:val});}

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


// ===== D-4 · WOCHE: drei Aussagen, dann die Belege (DESIGN-4 6.10) =====
// Vorher: eine Kopfzeile mit zwei Symbolknöpfen ohne Wort (`‹` / `›`, K11), darunter eine Meta-Zeile,
// eine Highlight-Karte, eine Fokus-Karte, eine Bilanz-Karte mit eigener Zeilenform und fünf Blöcke –
// 13 Zeilenformen auf einem Bildschirm. Nachher: EINE Held-Karte mit genau drei Aussagen
// (Konsequenz · ein Fortschritt · eine Einsicht), dann Gruppen aus derselben Zeile, und der
// Wochenwechsel als benannter Abschnitt „Vergangene Wochen" statt als zwei Pfeilknöpfe.
function anaPaintWeek(w){const b=document.getElementById('anaBody');if(!b)return;w=w||{};
  const t=w.training||{},n=w.nutrition||{},bo=w.body||{},he=w.health||{},mi=w.mindset||{},pv=w.prev||{};
  // Fehlt ein Navigationsfeld ganz (ältere Antwort), rechnen wir die Nachbarwoche selbst. Ein
  // ausdrückliches null ist dagegen eine Aussage des Servers: davor liegt nichts (vor der ersten Woche
  // des Kontos), danach liegt die Zukunft.
  const st=w.start||ANA_WEEK_START,pS=(w.prevStart!==undefined)?w.prevStart:anaAddDays(st,-7),
    nS=(w.nextStart!==undefined)?w.nextStart:(st<anaMonday(today())?anaAddDays(st,7):null);
  // Laufende Woche? Der Server sagt es (current); fehlt das Feld, entscheidet der Montag von heute.
  const isCur=(w.current!==undefined)?!!w.current:(st>=anaMonday(today()));
  const isFut=!isCur&&st>anaMonday(today());
  an5SetTitle();
  const ex=anaCached('wr:'+(st||''))||null;
  // mi.skipped zählt mit: eine Woche mit lauter abgebrochenen Ritualen ist nicht leer – dort war
  // jemand da, nur zu kurz. „Noch nichts eingetragen" wäre an dieser Stelle falsch.
  const any=[t.sessions,t.sets,n.daysLogged,bo.weightEnd,he.avgSleep,he.avgSteps,he.avgBurn,mi.primings,mi.evenings,mi.breathing,mi.skipped,mi.challengeDays].some(v=>v!=null&&+v>0)||!!mi.wheel;
  if(!any){b.innerHTML=(isFut
    ?emptyState({icon:'calendar',title:'Diese Woche liegt noch vor dir',text:'Der Rückblick entsteht, während die Woche läuft.'})
    :isCur
    ?emptyState({icon:'calendar',title:'Diese Woche ist noch leer',text:'Sobald du etwas einträgst, entsteht hier dein Rückblick.'})
    :emptyState({icon:'calendar',title:'Nichts eingetragen',text:'In dieser Woche ist kein Training, kein Essen und kein Check-in aufgezeichnet.'}))
    +an5WeeksNavHTML(st,pS,nS);return;}
  let h=an5WeekHeroHTML(w,isCur,ex);
  h+=an5BalanceHTML(w,isCur,ex);
  // null heißt „nicht bekannt" – eine 0 an dieser Stelle wäre schlicht gelogen (G9).
  const vT=(v,d,u)=>v==null?'noch nicht eingetragen':`${fmtNum(v,d)}${u?' '+u:''}`;
  const cmp=(now,was,d,u)=>(now==null||was==null)?'':`Vorwoche ${fmtNum(was,d)}${u?' '+u:''}`;
  // Zählwerte gegen eine fertige Vorwoche: in der LAUFENDEN Woche ist jede Richtung gelogen.
  const some=(...v)=>v.some(x=>x!=null);
  const ts=(t.topSets||[])[0];
  // Die Zeile „Einheiten" entfällt, SOBALD die Bilanz-Gruppe die Compliance trägt – dieselbe Zahl
  // zweimal auf einem Bildschirm (Befund B8). Ohne hinterlegten Rhythmus gibt es kein Band, dann
  // bleibt die Zeile die einzige Stelle, an der die Einheiten stehen.
  let r=wk2Compliance(t,ex)?''
    :an5WeekRow('calendar','Einheiten',vT(t.sessions),t.planned?`von ${pl(t.planned,'geplanten Einheit','geplanten Einheiten')}`:'',cmp(t.sessions,pv.sessions));
  r+=an5WeekRow('dumbbell','Sätze',vT(t.sets),'Arbeitssätze, ohne Aufwärmsätze','')
    // Bewegte Last in KILOGRAMM, nicht in Tonnen: der Highlight-Satz oben im SELBEN Bild sagt
    // „48.230 kg bewegt in 112 Sätzen", und die Wochenmail nennt dieselbe Zahl ebenfalls in kg.
    // Zwei Einheiten für dieselbe Zahl muss der Leser sonst selbst umrechnen (R15).
    +an5WeekRow('scale','Bewegte Last',t.volumeKg==null?vT(null)
      :(+t.volumeKg>0?vT(t.volumeKg,0,'kg')
      :(+t.sets>0?'nur Körpergewicht':vT(0,0,'kg'))),'Gewicht mal Wiederholungen','');
  // Steht die Rekord-LISTE darunter, ist die gezählte Zeile darüber dieselbe Aussage ohne Inhalt.
  const prHTML=wk2PrRows(w,ex);
  if(+t.prs>0&&!prHTML)r+=an5WeekRow('trophy','Bestleistungen',fmtNum(t.prs),ts?`stärkster Satz: ${ts.exercise}`:'','');
  else if(ts&&!(+t.prs>0))r+=an5WeekRow('trophy','Stärkster Satz',`${fmtNum(ts.weight,1)} kg × ${fmtNum(ts.reps)}`,ts.exercise,'');
  if(some(t.sessions,t.sets,t.volumeKg,t.prs)||ts)h+=groupHTML('Training',[r],
    'Gezählt werden Arbeitssätze aus dem Satzprotokoll dieser Woche. Übungen mit dem eigenen Körpergewicht zählen 0 kg bewegte Last – die App kennt dein Körpergewicht in der Übung nicht.');
  h+=prHTML;
  h+=wk2FlagRows(ex&&ex.flags,ex);
  // „Tage protokolliert" und „davon x Tage im Kalorienziel" stehen beide in der Bilanz-Gruppe – dort
  // mit Prozentsatz und Band statt als nackte Zahl. Trägt sie die Zahlen, entfällt die Zeile hier.
  r=(wk2Adherence(n,ex)?''
    :an5WeekRow('utensils','Tage protokolliert',n.daysLogged==null?vT(null):`${fmtNum(n.daysLogged)} von 7`,
      n.onTargetDays!=null?`davon ${pl(n.onTargetDays,'Tag','Tage')} im Kalorienziel (±5 %)`:'',''))
    +an5WeekRow('flame','Kalorien im Schnitt',vT(n.avgKcal,0,'kcal'),n.targetKcal?`Ziel ${fmtNum(n.targetKcal)} kcal`:'',cmp(n.avgKcal,pv.avgKcal,0,'kcal'))
    +an5WeekRow('meat','Eiweiß im Schnitt',vT(n.avgProtein,0,'g'),n.targetProtein?`Ziel ${fmtNum(n.targetProtein)} g`:'','');
  if(some(n.daysLogged,n.avgKcal,n.avgProtein))h+=groupHTML('Ernährung',[r],
    '„Im Schnitt" heißt: über die Tage dieser Woche, an denen du etwas protokolliert hast. Ein Tag ohne Eintrag zählt nicht als Nulltag – er zählt gar nicht.');
  r=an5WeekRow('scale','Gewicht am Wochenende',vT(bo.weightEnd,1,'kg'),bo.weightStart!=null?`zu Wochenbeginn ${fmtNum(bo.weightStart,1)} kg`:'','')
    +an5WeekRow('trendUp','Veränderung',bo.delta==null?vT(null):`${bo.delta>0?'+':''}${fmtNum(bo.delta,1)} kg`,'vom Wochenbeginn zum Wochenende',
      (bo.delta!=null&&pv.weightDelta!=null&&!isCur)?`Vorwoche ${pv.weightDelta>0?'+':''}${fmtNum(pv.weightDelta,1)} kg`:'');
  // Die Wochenrate liefert der Server erst ab vier Tagen Messspanne (sonst null).
  if(bo.perWeek!=null)r+=an5WeekRow('chartLine','Hochgerechnet pro Woche',`${bo.perWeek>0?'+':''}${fmtNum(bo.perWeek,1)} kg`,'aus den Wiegetagen dieser Woche hochgerechnet','');
  if(some(bo.weightEnd,bo.weightStart,bo.delta))h+=groupHTML('Körper',[r],
    'Gewogen wird morgens und nüchtern, sonst vergleicht die Zahl zwei verschiedene Zustände. Eine einzelne Woche sagt wenig – der Verlauf im Bereich Körper sagt mehr.');
  // „Ø Ruhepuls 50 bpm" ist eine Zahl ohne Maßstab – 50 ist für den einen gut und für den anderen
  // hoch. Daneben steht deshalb der eigene Bereich (an2WeekBand), aus den ohnehin geladenen Check-ins.
  r=an5WeekRow('moon','Schlaf im Schnitt',vT(he.avgSleep,1,'h'),'',cmp(he.avgSleep,pv.avgSleep,1,'h'))
    +an5WeekRow('footprints','Schritte im Schnitt',vT(he.avgSteps),an2WeekBand('steps',0,''),'');
  if(he.avgBurn!=null)r+=an5WeekRow('flame','Aktiver Verbrauch im Schnitt',vT(he.avgBurn,0,'kcal'),an2WeekBand('active_kcal',0,'kcal')||'aus der verbundenen Uhr','');
  if(he.avgRhr!=null)r+=an5WeekRow('heart','Ruhepuls im Schnitt',vT(he.avgRhr,0,'bpm'),an2WeekBand('resting_hr',0,'bpm'),'');
  if(he.avgHrv!=null)r+=an5WeekRow('zap','Herzratenvariabilität im Schnitt',vT(he.avgHrv,0,'ms'),an2WeekBand('hrv',0,'ms'),'');
  if(some(he.avgSleep,he.avgSteps,he.avgBurn,he.avgRhr,he.avgHrv))h+=groupHTML('Gesundheit',[r],
    '„Dein Bereich" ist die mittlere Hälfte deiner eigenen Werte der letzten 90 Tage – keine Norm und kein Ziel. Die Herzratenvariabilität misst den Abstand zwischen zwei Herzschlägen; höhere Werte gehen meist mit besserer Erholung einher.');
  const mal=v=>v==null?vT(null):`${fmtNum(v)} ×`;
  r=an5WeekRow('sun','Priming',mal(mi.primings),'Morgenritual','')
    +an5WeekRow('moon','Abendreflexion',mal(mi.evenings),'Abendritual','');
  if(mi.breathing!=null)r+=an5WeekRow('wind','Atemübungen',mal(mi.breathing),'','');
  // Abgebrochene Rituale zählt der Server nicht mehr als erledigt. Ohne diese Zeile stünde bei einer
  // Woche voller kurzer Durchläufe nur „0 ×" – und niemand wüsste warum.
  if(mi.skipped)r+=an5WeekRow('ban','Abgebrochen',mal(mi.skipped),'zu kurz – zählt nicht für Serie und Erfahrungspunkte','');
  if(mi.challengeDays!=null)r+=an5WeekRow('flame','Challenge',pl(mi.challengeDays,'Tag','Tage'),'','');
  if(mi.wheel)r+=rowHTML({icon:'wheel',title:'Rad des Lebens',pill:{text:'ausgefüllt',tone:'green'}});
  if(some(mi.primings,mi.evenings,mi.breathing,mi.skipped,mi.challengeDays)||mi.wheel)h+=groupHTML('Mindset',[r],
    'Eine Sitzung zählt erst als vollwertig, wenn du sie wirklich durchgezogen hast – sechsmal „Überspringen" in einer Sekunde ist kein Ritual.');
  h+=an5WeeksNavHTML(st,pS,nS);
  b.innerHTML=h;}

// --- Die eine Held-Karte: drei Aussagen, mehr nicht (6.10) ------------------------------------
// (a) die Konsequenz als Band, (b) EIN Fortschritt, (c) EINE Einsicht mit Handlung.
// Unter fünf Tagen mit Daten steht statt der Einsicht, dass die Grundlage fehlt – eine Einsicht aus
// zwei Tagen wäre erfunden (DESIGN-4 6.10, Fußtext).
function an5WeekHeroHTML(w,isCur,ex){
  const c=wk2Compliance(w.training||{},ex);
  const wkc=anaWeekConsistency(w,isCur);
  const zeilen=[];
  if(wkc)zeilen.push(`<p class="an5-say">${esc2(wkc.main)}${c&&!isCur?` · ${esc2(c.label)}`:''}</p>`);
  else if(c)zeilen.push(`<p class="an5-say">${fmtNum(c.done)} von ${pl(c.planned,'geplanten Einheit','geplanten Einheiten')}${isCur?'':' · '+esc2(c.label)}</p>`);
  const hl=(w.highlights||[]).filter(Boolean);
  if(hl.length)zeilen.push(`<p class="an5-quiet">${esc2(hl[0])}</p>`);
  const tage=an5WeekDataDays(w);
  if(tage!=null&&tage<5)zeilen.push(`<p class="an5-quiet">Zu wenig Daten diese Woche – ${tage===1?'ein Tag mit Eintrag reicht':`${fmtNum(tage)} Tage mit Einträgen reichen`} nicht für eine Einsicht.</p>`);
  else if(w.focus&&w.focus.title)zeilen.push(`<p class="an5-quiet"><b>Für nächste Woche: ${esc2(w.focus.title)}</b>${w.focus.why?' '+esc2(w.focus.why):''}</p>`);
  if(!zeilen.length)return '';
  return `<div class="card lg an5-hero">${zeilen.join('')}</div>`
    +`<p class="rows-f">Oben steht, was die Woche gebracht hat, darunter die eine Sache für die nächste. `
    +`Die Zahlen, auf denen beides beruht, stehen in den Gruppen darunter${w.xp?` · ${fmtNum(w.xp)} Erfahrungspunkte in dieser Woche`:''}.</p>`;}
// Tage MIT Daten in der betrachteten Woche – oder null, wenn die Check-ins nicht geladen sind.
// Lieber keine Zahl als eine geratene: der Rückblick lässt sich auch direkt öffnen (Deep-Link aus
// der Sonntags-Nachricht), und dann liegt die Check-in-Liste noch gar nicht im Speicher.
function an5WeekDataDays(w){const st=w&&w.start||ANA_WEEK_START;if(!st)return null;
  const ci=anaCached('checkins_all')||anaCached('checkins');
  if(!Array.isArray(ci)||!ci.length)return null;
  const end=anaAddDays(st,6);
  const oldest=ci[ci.length-1]&&ci[ci.length-1].date;
  if(!oldest||oldest>st)return null;   // die Liste reicht nicht bis in diese Woche
  const tage=new Set(ci.filter(c=>c&&c.date>=st&&c.date<=end).map(c=>c.date));
  ((w.training||{}).days||[]).forEach(d=>{if(d>=st&&d<=end)tage.add(d);});
  return tage.size;}

// --- Die Bilanz als Gruppe statt als eigene Kartenform ----------------------------------------
// Zwei Korridore, bevor die Zahlen kommen (M15). Bis 3.0.2 trug das eine eigene Bauform
// (`.wk2-bal-r` mit eigenem rechten Block); jetzt ist es die eine Zeile mit Wert und Marke.
function an5BalanceHTML(w,isCur,srv){
  const c=wk2Compliance(w.training,srv),a=wk2Adherence(w.nutrition,srv);
  if(!c&&!a)return '';
  const tag=((new Date(today()+'T00:00:00').getDay()+6)%7)+1;
  const pv=w.prev||{};
  const rows=[];
  if(c){const vor=(pv.sessions!=null&&c.planned>0)?Math.round(+pv.sessions/c.planned*100):null;
    rows.push(rowHTML({icon:'dumbbell',title:'Training',
      sub:`${fmtNum(c.done)} von ${pl(c.planned,'geplanten Einheit','geplanten Einheiten')}`+(vor!=null?` · Vorwoche ${fmtNum(vor)} %`:''),
      value:fmtNum(c.pct)+' %',
      pill:isCur?{text:`Tag ${fmtNum(tag)} von 7`,tone:'neutral'}:{text:c.label,tone:c.tone}}));}
  if(a)rows.push(rowHTML({icon:'utensils',title:'Ernährung',
    sub:`${fmtNum(a.logged)} von 7 Tagen protokolliert`+(a.onTarget!=null?` · davon ${pl(a.onTarget,'Tag','Tage')} im Kalorienziel (±5 %)`:''),
    value:fmtNum(a.pct)+' %',
    pill:isCur?{text:`Tag ${fmtNum(tag)} von 7`,tone:'neutral'}:{text:a.label,tone:a.tone}}));
  return groupHTML('Bilanz',rows,
    'Beim Training zählt der Anteil der geplanten Einheiten; als getroffen gilt ein Korridor von 80 bis 120 Prozent – 90 Prozent vom Plan sind kein Versagen. '
    +'Bei der Ernährung zählt, an wie vielen der sieben Tage du überhaupt protokolliert hast. '
    +(isCur?'Solange die Woche läuft, steht hier der Stand ohne Urteil: am Dienstag sind 43 Prozent kein Rückstand, sondern Dienstag.':'Beide Bänder ordnen ein, sie warnen nicht.'));}

// --- Wochenwechsel als benannter Abschnitt statt zweier Pfeilknöpfe ---------------------------
// Die beiden runden Symbolknöpfe `‹` und `›` waren Symbolknöpfe ohne Wort im Inhaltsbereich (K11)
// und zugleich eine zweite Steuerebene unter dem Titel. Beides fällt: die angezeigte Woche steht im
// Untertitel des großen Titels, und der Wechsel ist eine Liste benannter Wochen (3.6, Weg 1).
function an5WeeksNavHTML(st,prev,next){
  if(!st)return '';
  const mon=anaMonday(today()),erste=anaCache().weekFirst||null;
  const liste=[];
  // Von der jüngsten erreichbaren Woche aus zurück: die laufende (bzw. die angezeigte, falls sie in
  // der Zukunft liegt) und die sechs davor. Die angezeigte Woche ist immer dabei.
  let w=(st>mon)?st:mon;
  for(let i=0;i<5;i++){liste.push(w);w=anaAddDays(w,-7);}
  if(!liste.includes(st))liste.push(st);
  liste.sort().reverse();
  const rows=liste.filter(iso=>!erste||iso>=erste).map(iso=>{
    const zurueck=Math.round(anaDayDiff(mon,iso)/7);
    const wann=zurueck===0?'Diese Woche':zurueck===1?'Letzte Woche':zurueck>1?`vor ${pl(zurueck,'Woche','Wochen')}`
      :zurueck===-1?'Nächste Woche':`in ${pl(-zurueck,'Woche','Wochen')}`;
    if(iso===st)return rowHTML({icon:'calendar',title:an5WeekRange(iso),sub:wann,value:'angezeigt'});
    return rowHTML({icon:'calendar',title:an5WeekRange(iso),sub:wann,tap:`anaWeekNav('${iso}')`});});
  if(!rows.length)return '';
  let foot='Der Rückblick einer Woche entsteht am Sonntagabend. Weiter zurück als bis zur ersten Woche deines Kontos führt die Liste nicht.';
  if(prev===null)foot='Das ist die erste Woche deines Kontos – weiter zurück gibt es nichts zu berichten.';
  return groupHTML('Vergangene Wochen',rows,foot);}

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
// D-4: dieselben vier Zeilen, aber aus `rowHTML()` – und die Erklaerung, die vorher als `.note`
// darueber und als `.caption` darunter stand, jetzt als Fusstext unter der Gruppe (G8).
// Der Schalter ist die Schalterzeile aus 5.5: der Zeilentext IST die Beschriftung (A29).
async function openIntegrations(){const on=!!(ME&&ME.health_reminder);const own=!coachView();
  // Status des persönlichen Links gleich mitladen: „aktiv" oder „einrichten" steht dann direkt in der
  // Zeile – und die Analyse-Seite darunter erfaehrt ihn mit, ohne selbst zu fragen.
  let hl=null;if(own){try{const r=await API.get('/health/link');if(r.status===200)hl=r.data;}catch(e){}}
  if(own)an5LinkHTML.stand=!!(hl&&hl.enabled);
  const rows=[
    rowHTML({icon:'apple',title:'Apple Health',
      sub:hl&&hl.enabled?'Dein iPhone schickt die Werte von selbst':'Automatisch per Kurzbefehl – oder von Hand',
      pill:hl&&hl.enabled?{text:'aktiv',tone:'green'}:{text:'einrichten',tone:'neutral'},tap:'openAppleHealth()'}),
    rowHTML({icon:'heart',title:'Health Connect',sub:'Android und Google Fit',pill:{text:'kommt bald',tone:'neutral'}}),
    rowHTML({icon:'timer',title:'Fitbit',sub:'Tracker und Smartwatches',pill:{text:'kommt bald',tone:'neutral'}}),
    rowHTML({icon:'zap',title:'Garmin Connect',sub:'Sportuhren',pill:{text:'kommt bald',tone:'neutral'}}),
  ];
  let h=groupHTML('Verbinden',rows,
    'Ist eine Gesundheits-App verbunden, fließen Schlaf, Schritte, Verbrauch und Puls von selbst in deine Auswertung – du trägst sie dann nicht mehr von Hand ein. '
    +(hl&&hl.enabled?'Die wöchentliche Erinnerung entfällt, solange dein iPhone die Werte selbst schickt.'
      :'Kein passendes Gerät? Du kannst alle Werte jederzeit im Check-in eintragen.'));
  if(own&&!(hl&&hl.enabled))h+=groupHTML('',[rowHTML({icon:'bell',title:'Wöchentlich an den Import erinnern',
      switch:{name:'health_rem',on},id:'health_rem_row'})],
    'Einmal pro Woche eine Erinnerung, neue Gesundheitsdaten zu importieren. Sie kommt nur, solange nichts automatisch übertragen wird.');
  openSheet('Gesundheitsdaten',h);
  // Der Schalter wirkt SOFORT (5.5) – deshalb haengt der Handler am Element, nicht an einem
  // „Speichern"-Knopf, den es in diesem Sheet nicht gibt.
  const sw=document.querySelector('#health_rem_row input.sw');
  if(sw)sw.addEventListener('change',()=>toggleHealthReminder(sw.checked));}

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
  // D-4: Der Schalter ist jetzt ein `input.sw` in einer Schalterzeile (5.5) – er traegt seinen
  // Zustand selbst. Der alte `.tgl`-Knopf mit role="switch" wird weiterhin bedient, falls ihn eine
  // andere Datei noch zeichnet.
  const t=document.getElementById('health_rem');if(t){t.classList.toggle('on',!!on);if(t.getAttribute('role')==='switch')t.setAttribute('aria-checked',on?'true':'false');if(t.type==='checkbox')t.checked=!!on;}
  const sw=document.querySelector('#health_rem_row input.sw');if(sw)sw.checked=!!on;
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
    // Die Chip-Reihe ist hier die EINE Steuerebene des Sheets (3.6: Filter, > 4 Eintraege,
    // waagrecht scrollbar) – darueber steht kein Segment, darunter keine zweite Reihe.
    h+=`<h2 class="rows-h">Verlauf</h2><div class="chip-row" id="ms_chips">${withData.map(([k])=>`<button class="chip${k===openMeasure.sel?' on':''}" data-k="${k}" onclick="measureSel('${k}')">${esc2(anaMeasureLabel(k))}</button>`).join('')}</div><div id="ms_hist">${anaMeasureHist(list,openMeasure.sel)}</div>`;}
  else if(!canEdit)h+=emptyState({icon:'ruler',title:'Noch keine Maße',text:'Dein Athlet hat noch keine Körpermaße eingetragen.'});
  return h;}
function anaMeasureHist(list,k){const lbl=anaMeasureLabel(k),u=anaMeasureUnit(k);
  const rows=list.filter(m=>m[k]!=null).slice(0,30);const asc=rows.slice().reverse();let h='';
  if(asc.length>=2){const d=Math.round((asc[asc.length-1][k]-asc[0][k])*10)/10;
    h+=`<div class="chart-card mt-3"><div class="ch-h"><div class="t">${lbl}</div><div class="v">${fmtNum(asc[asc.length-1][k],1)} ${u} · ${d>0?'+':''}${fmtNum(d,1)} ${u} seit ${fmtDate(asc[0].date)}</div></div>${metricChart(asc.map(m=>({date:m.date,value:+m[k]})),u)}</div>`;}
  else h+=`<div class="caption mt-3 mb-3">Ab dem zweiten Eintrag erscheint hier die Kurve.</div>`;
  h+=groupHTML('',rows.slice(0,8).map((m,i)=>{const prev=rows[i+1];const d=prev?Math.round((m[k]-prev[k])*10)/10:null;
      return rowHTML({title:fmtDate(m.date,{weekday:'long'}),
        sub:d==null?'erster Eintrag':`${d>0?'+':d<0?'':'±'}${fmtNum(d,1)} ${u} gegenüber dem Eintrag davor`,
        value:`${fmtNum(m[k],1)} ${u}`});}),
    `Gemessen wird ${lbl.toLowerCase()==='körperfett'?'in Prozent':'in Zentimetern'}, immer an derselben Stelle und am besten morgens – sonst vergleicht die Zahl zwei verschiedene Zustände.`);
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
  if(list.length){h+=`<h2 class="rows-h">${readOnly?'Fotos':'Deine Fotos'}<span class="a" id="ph_count"></span></h2><div class="ph-grid" id="ph_grid"></div><div id="ph_more"></div>`
    +`<p class="rows-f">Gleiche Pose, gleiches Licht, gleiche Tageszeit – nur dann vergleicht das nächste Bild wirklich mit diesem. Deine Fotos sehen nur du und dein zugewiesener Coach.</p>`;}
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
  if(more)more.innerHTML=rest>0?`<button class="btn sec mt-3" onclick="phShowMore()">Weitere ${fmtNum(Math.min(PH_PAGE,rest))} Fotos anzeigen</button>`
    :(openPhotos.more?`<button class="btn sec mt-3" id="ph_older" onclick="phLoadOlder()">Ältere Fotos laden</button>`:'');
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
      </div>${own?groupHTML('',[rowHTML({title:'Foto löschen',danger:true,tap:`delPhoto(${p.id})`})],
        'Direkt nach dem Löschen kannst du es in der Meldung noch rückgängig machen.'):''}`);
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
    <button class="btn sec" id="an2cmpOlder" onclick="an2CompareOlder()">Ältere Fotos laden</button></div>`;}
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
  // D-4: die eine Zeile, das eine Wort. „3/10" wird „3 von 10 geschafft" (G9), und der Balken sitzt
  // ueber `an5RowBar()` in der Titelspalte statt als eigene Zeilenform daneben (5.7).
  const row=(a,bar)=>{const z=rowHTML({icon:(a&&a.iconName)||AN2_ACH_ICONS[String(a&&a.id||'')]||'medal',
      title:a.title,
      sub:a.desc+((!a.done&&a.target)?` · ${fmtNum(a.progress)} von ${fmtNum(a.target)} geschafft`:''),
      pill:a.done?{text:'erreicht',tone:'green'}:{text:'offen',tone:'neutral'}});
    return bar&&a.target?an5RowBar(z,a.progress/a.target*100):z;};
  let h=`<div class="card ach-head mb-3"><div class="between"><div class="h3">${icon('star',18)} Level ${fmtNum(I.level||1)} · ${esc2(I.levelTitle||'Rookie')}</div><span class="pill neutral">${fmtNum(done)} von ${fmtNum(list.length)}</span></div>
    <div class="meta mt-1">${fmtNum(I.xp||0)} Erfahrungspunkte · nächstes Level bei ${fmtNum(lp.next||100)}</div>
    <div class="bar mt-2"><i style="width:${Math.max(0,Math.min(100,+lp.pct||0))}%"></i></div>
    </div><p class="rows-f">Erfahrungspunkte gibt es für Sätze, Check-ins, Cardio, Fotos und Maße – am meisten für neue Bestleistungen.</p>`;
  if(next.length)h+=groupHTML('Als Nächstes',next.map(a=>row(a,true)),
    'Die drei Erfolge, denen du gerade am nächsten bist. Der Balken zeigt, wie weit du auf dem Weg dorthin bist.');
  const groups={};list.forEach(a=>{const c=catOf(a);(groups[c]=groups[c]||[]).push(a);});
  [...CATS.map(c=>c[0]),'Weitere'].forEach(c=>{const g=groups[c];if(!g||!g.length)return;const gd=g.filter(a=>a.done).length;
    h+=groupHTML(`${c} · ${fmtNum(gd)} von ${fmtNum(g.length)} erreicht`,g.slice().sort(sortFn).map(a=>row(a,false)),'');});
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
    <div class="mg-ic">${icon(m.allReached?'trophy':'target',36)}</div>
    <div class="h2 mt-2">${m.allReached?'Monatsziel erreicht':fmtNum(m.reachedCount)+' von '+fmtNum((m.parts||[]).length)+' geschafft'}</div>
    <div class="meta mt-1">${m.allReached?'Stark durchgezogen – das zahlt sich aus.':'Noch '+pl(open,'Ziel','Ziele')+' bis zur Auszeichnung.'}</div></div>`;
  // D-4 (5.7/K19): Aus drei Ringen – zwei davon ROT gefuellt, was 5.7 ausdruecklich verbietet –
  // werden drei Zeilen mit Balken. „3 / 10" heisst ausgeschrieben „3 von 10 geschafft" (G9).
  h+=groupHTML('',(m.parts||[]).map(p=>an5RowBar(rowHTML({
      icon:p.reached?'check':(p.iconName||'target'),title:p.label,
      sub:`${fmtNum(p.done)} von ${fmtNum(p.target)} geschafft`,
      pill:p.reached?{text:'erreicht',tone:'green'}:{text:fmtNum(Math.round(+p.pct||0))+' %',tone:'neutral'}}),
      Math.max(0,Math.min(100,+p.pct||0)),p.reached?'ok':'')),
    'Das Monatsziel setzt die App aus deinem Rhythmus der letzten Wochen; dein Coach kann es überschreiben. Erreicht ist es, wenn alle Teilziele stehen.');
  if((ME.role==='coach'||ME.role==='admin')&&COACH_CONTEXT&&typeof openEditMonthly==='function'){const t=k=>((m.parts||[]).find(p=>p.key===k)||{}).target||0;
    h+=`<button class="btn sec mt-4" onclick="openEditMonthly('${m.month}',${t('trainings')},${t('checkins')},${t('volume')})">${icon('target',18)} Ziel für diesen Athleten anpassen</button>`;}
  if(m.history&&m.history.length){h+=`<h2 class="rows-h">Geschaffte Monate</h2><div class="cluster">`+
    m.history.map(x=>`<span class="pill neutral">${icon(x.custom?'medal':'trophy',12)} ${cap(new Date(x.month+'-01T00:00:00').toLocaleDateString('de-DE',{month:'short',year:'2-digit'}))}</span>`).join('')+`</div>`;}
  openSheet('Monatsziel',h);
  if(m.justClaimed&&m.award&&uid===ME.id)setTimeout(()=>celebrateMonthly(m.award,m.bonusXp),400);}

function celebrateMonthly(award,bonusXp){award=award||{};
  openSheet('Monatsziel erreicht',`<div class="center mg-cel">
    <div class="mg-cel-ic">${icon('trophy',36)}</div>
    <div class="h1 mt-2">${esc2(award.title||'Monatsziel erreicht')}</div>
    <div class="meta mt-2">${esc2(award.desc||'')}</div>
    <div class="mt-3"><span class="pill green mg-xp">+${fmtNum(bonusXp||0)} Erfahrungspunkte</span></div>
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
