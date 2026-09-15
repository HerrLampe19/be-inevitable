// BE INEVITABLE – Frontend, Teil «home.js». Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js.
// ===== HOME (WP1) =====
// Aufbau der Startseite (oben -> unten): Jetzt-Karte (nowCardHTML) · Mindset-Status · „Heute geschafft"-Ringe
// (drawHomeGoals) · Check-in (drawHomeCheckin, kurze Karte – Formular im Sheet) · Ernährung · Supplements ·
// Fortschritt · Mehr.
// Alle Blöcke rendern aus EINER Datenquelle (GET /api/home/:userId, Fallback: die alten Einzelrouten) und
// werden nach einer Änderung an Ort und Stelle nachgezogen – nie über go('home').

// ===== ZUSTAND =====
let CHECKIN_DATE=null, HOME_CIS=[];
let HOME_DATA=null;        // letzte Antwort von GET /api/home/:userId (bzw. der Fallback in gleicher Form)
let HOME_CI_SHEET=false;   // Check-in-Formular läuft gerade im Sheet (openCheckinSheet)
let HOME_TIP=null;         // Merker für „Tag komplett"-Feier (einmal pro Tag)
// Eigene (selbst hinzugefügte) Supplements kennt der Server nur als „genommen"-Zeile: Abwählen heißt dort Löschen.
// Damit die Zeile sich trotzdem wie jede andere abhaken lässt, bleibt der Eintrag hier als leerer Haken stehen,
// bis er erneut angetippt (= wieder eingetragen) wird. [{date,name,dose}] – nur für die laufende Sitzung.
let HOME_SUPP_OFF=[];

// ===== KLEINE HELFER =====
function homePatch(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html;return !!el;}
function homeCache(){try{if(typeof cacheView==='function'&&document.getElementById('homePage'))cacheView('home');}catch(e){}}
function homeGreeting(){const h=new Date().getHours();return h<11?'Guten Morgen':h<17?'Hallo':'Guten Abend';}
function homeFirstName(){const n=(coachView()&&COACH_CONTEXT)?String(COACH_CONTEXT):String(ME?.name||'');return n.split(' ')[0]||n;}
// Beschriftung eines Rhythmus-Chips: Wochentag + Klartext („Heute · Push", „Mo · Ruhe", „Di · Krank").
// Bis 2.4.0 stand hier „Heute Pus · Mo Pul · Di –" – drei Buchstaben, die am ersten Tag niemand liest
// (RATE-shell-home H2). Der Name wird jetzt ausgeschrieben und erst ab 14 Zeichen an der Ellipse gekürzt;
// die Leiste scrollt ohnehin, die Chips dürfen also breiter werden.
function shChipLabel(p,i,dt){
  const wd=['So','Mo','Di','Mi','Do','Fr','Sa'];
  const day=(i===0)?'Heute':wd[dt.getDay()];
  const t=p&&p.type;
  let what=(t==='train')?String(p.dayName||'Training').trim():(t==='sick')?'Krank':'Ruhe';
  if(what.length>14)what=what.slice(0,13).trim()+'…';
  return day+' · '+what;}
// Tipp auf einen Rhythmus-Chip öffnet GENAU diesen Tag – vorher öffneten alle sieben denselben Kalender
// und versprachen eine Auswahl, die sie nicht boten (RATE-shell-home H2).
// calDay() liest den Tagesstand aus drawCalendar.byDate; ohne vorher geöffneten Kalender ist die Karte leer
// und das Sheet schlüge fälschlich „Ruhetag" vor. Die Vorschau der Jetzt-Karte trägt dieselben Felder
// (date/type/dayName/planned) – also wird sie vorher eingespielt, damit das Sheet die Wahrheit zeigt.
function shOpenRhythmDay(iso){
  if(typeof calDay!=='function')return (typeof openCalendar==='function')?openCalendar():undefined;
  try{const pv=((HOME_DATA&&HOME_DATA.today)||TODAY||{}).preview||[];
    if(typeof drawCalendar==='function'){const by=drawCalendar.byDate||{};
      pv.forEach(p=>{if(p&&p.date&&!by[p.date])by[p.date]=p;});drawCalendar.byDate=by;}
  }catch(e){console.error('[home] Rhythmus-Tag',e);}
  calDay(iso,iso<today());}
// Effektiver Tagtyp (identisch zur Quelle des Kalenders: preview[0])
function homeEff(){const T=(HOME_DATA&&HOME_DATA.today)||TODAY;return T?.preview?.[0]||T?.confirmed||T?.suggestion||{type:'rest'};}
// Gewichts-Einordnung (Home + Analyse): {text, tone:'green'|'amber'|'neutral'}
function weightVerdict(diff,goal){
  const d=Math.round((+diff||0)*10)/10,a=Math.abs(d);
  if(goal==='muscle'){if(d>0)return{text:'+'+fmtNum(d,1)+' kg aufgebaut',tone:'green'};
    if(d<0)return{text:fmtNum(d,1)+' kg – Richtung beobachten',tone:'amber'};return{text:'Noch keine Veränderung',tone:'neutral'};}
  if(goal==='fatloss'){if(d<0)return{text:fmtNum(a,1)+' kg verloren',tone:'green'};
    if(d>0)return{text:'+'+fmtNum(d,1)+' kg – Richtung beobachten',tone:'amber'};return{text:'Noch keine Veränderung',tone:'neutral'};}
  return{text:(d>0?'+':'')+fmtNum(d,1)+' kg seit Start',tone:'neutral'};}
function homeToneCls(t){return t==='green'?'tone-green':t==='amber'?'tone-amber':'muted';}

// ===== DATEN =====
// Check-ins nur im Fenster nachladen, das die Startseite wirklich zeigt. Bisher holte JEDE Speicherung die
// komplette Historie (nach drei Jahren 1.100 Zeilen, 316 KB – rund 300 ms Mobilfunk für eine Streak-Zahl);
// gebraucht werden hier 14 Tage: die Tages-Chips im Sheet (7), die Chips im Nachtrag-Sheet (14), die Zeile
// „Heute" und der Gewichtstrend (neuester Eintrag). Dasselbe Fenster liefert auch das Aggregat GET /api/home
// (LIMIT 14) – nach dem Speichern steht die Seite damit auf demselben Stand wie nach einem frischen Start.
// ?days= (Kalendertage zurück) und ?limit= (Zeilen) sind für den Server OPTIONAL: ein Server ohne die
// Parameter ignoriert sie und antwortet wie bisher mit allem – die Ansicht stimmt in beiden Fällen, nur die
// Übertragung ist dann so groß wie früher. Beide zusammen, damit es mit jedem der beiden Namen greift.
const HOME_CI_DAYS=14;
function homeCheckinPath(uid,days){days=days||HOME_CI_DAYS;return '/checkins/'+uid+'?days='+days+'&limit='+days;}
// Eine Anfrage statt neun. Fällt der Server auf 404 (Endpunkt noch nicht deployt), greifen die Einzelrouten.
//
// A-III.2 – „Leerzustand nur bei echtem 200 + leer": Bis 2.6.0 fiel JEDER Nicht-200 in den Legacy-Pfad.
// Ohne Netz antworteten dort alle sechs Altrouten ebenfalls mit status 0, ok() machte daraus null – und
// die Startseite zeichnete daraus einen kompletten Tag aus Nullen: Bereitschaft 92 → 0, Streak-Zeile weg,
// „0 / 3.017 kcal", „0/3 Power-Atmung" (gemessen, tools/offline-diff.mjs: 19 Kennzahlen weg, 4 gefälscht –
// und zwar in BEIDEN Fällen, auch wenn die App schon lief und die Zahlen im Speicher standen).
// Bei kein Netz liefert API.get (A-III.1, core.js) den Schnappschuss als 200 mit stale:true – dieser Pfad
// läuft dann wie online, nur mit dem letzten Stand. Den Zeitstempel dazu zeigt die Hülle an EINER Stelle
// (BUILD-A3 Abschnitt 3.5); hier wird bewusst kein zweiter Stand-Chip gebaut.
// Wann der Legacy-Pfad noch laufen darf:
//   404/405/501 – die Route fehlt (älterer Server). Dafür wurde er gebaut.
//   0           – keine Antwort. Auch dann darf er es versuchen: die Schnappschuss-Schicht kann die
//                 sechs Altrouten einzeln bedienen, wenn es für das Aggregat keinen Stand gibt.
//   alles andere (4xx/5xx) – der Server HAT geantwortet, nur abschlägig. Sechs weitere Anfragen brechen
//                 genauso, und ihr Ergebnis wäre wieder nur eine Seite aus Nullen.
// Entscheidend ist nicht, OB der Legacy-Pfad läuft, sondern dass er nichts erfindet: er gibt jetzt null
// zurück, wenn die tragenden Antworten fehlen (siehe homeLegacyLoad).
const STL_ROUTE_GONE={404:1,405:1,501:1};
let STL_HOME_ST=null;   // Status des letzten Ladeversuchs – nur für die ehrliche Karte in renderHome
// A-V.3 (2.9.0): Kurzschluss gegen den Anfrage-Stau beim Start. GEMESSEN (lp-net.mjs, kalter Start
// angemeldet): GET /api/home/2 lief VIERMAL in den ersten vier Sekunden – einmal fuer die Startseite
// und dreimal, weil die Seite gleich wieder neu gezeichnet wurde (stlMindWatch, sobald mindset.js da
// ist; refreshHomeIfActive aus core.js). Jedes Mal 4,4 KB fuer dieselbe Antwort.
// Ein Neuzeichnen innerhalb von 2,5 s bekommt deshalb den Stand, der schon im Speicher liegt. Laenger
// darf das Fenster nicht sein: alles, was der Nutzer selbst eintraegt, soll sofort wieder frisch
// geladen werden koennen. Die Schreibwege der Startseite pflegen ihre Aenderung ohnehin lokal ein
// (homeMergeCheckin) und rufen diese Funktion gar nicht.
const STL_HOME_MIN_MS=2500;
let STL_HOME_AT=0;
async function loadHomeData(){
  const uid=VIEW_USER||ME.id;
  let d=null;
  if(HOME_DATA&&loadHomeData.uid===uid&&HOME_DATA.date===today()&&(Date.now()-STL_HOME_AT)<STL_HOME_MIN_MS){
    STL_HOME_ST=200;return HOME_DATA;}
  const r=await API.get('/home/'+uid);
  STL_HOME_ST=r.status;
  if(r.status===200&&r.data&&r.data.today)d=r.data;
  else if(STL_ROUTE_GONE[r.status]||r.status===0)d=await homeLegacyLoad(uid);   // setzt STL_HOME_ST selbst
  // TAGESWECHSEL (gemessen: online am 13., ohne Netz am 14. kalt gestartet). Der Schnappschuss von
  // API.get liegt unter `be_snap_v1_<uid>_/home/<uid>` – ohne Tag im Schlüssel, anders als /foodlog?date=
  // und /logs?date=. Er kommt als status 200 mit `stale:true` zurück, und die Zeile darüber hat ihn
  // gestern wie heute genommen: „Weiter · 2/27 Sätze", „597 / 3.017 kcal", „Level 4 / 961 XP" – alles
  // von gestern, während der Trainings-Tab im selben Lauf „27 Sätze geplant" sagte. Die App widersprach
  // sich innerhalb einer Sitzung. Ein Stand von gestern ist für HEUTE keine Zahl, sondern eine falsche:
  // Ringe, Kalorien und Sätze sind tagesgebunden, es gibt keinen Teil davon, der übrig bliebe.
  // Also verwerfen und die ehrliche Karte zeigen – dieselbe Regel, die drei Zeilen tiefer schon für den
  // Speicherstand HOME_DATA gilt (`HOME_DATA.date===today()`), nur jetzt auch auf dem stale-Pfad.
  // Nur bei `stale`: eine FRISCHE Serverantwort gilt immer (A-III.1, Regel 1) – weicht dort der Tag ab,
  // steht der Server in einer anderen Zeitzone, und darüber entscheidet today(), nicht diese Stelle.
  // STL_HOME_ST zurück auf 0, weil genau das die Lage ist: keine Antwort. Sonst stünde auf der Karte
  // „Fehler 200". Der Schnappschuss selbst bleibt liegen – morgen früh mit Netz überschreibt ihn das
  // nächste echte 200, und bis dahin ist er der letzte Stand, den die Hülle im Chip datiert nennt.
  // Der Weg über offKey() (Tag im Schlüssel, core.js) wäre die andere Lösung – es darf nur EINE geben
  // (CRITIC K4); die hier steht in der Datei, der die Lüge gehört, und fasst core.js nicht an.
  if(d&&r.stale&&d.date&&d.date!==today()){d=null;STL_HOME_ST=0;}
  if(!d){
    // Kein neuer Stand – aber vielleicht steht der alte noch im Speicher (die App lief schon, dann fiel
    // das Netz aus). Der gehört gezeigt, nicht weggeworfen: „bei stale die letzten Zahlen zeichnen".
    // Nur für denselben Nutzer und denselben Tag – ein fremder Athlet oder ein Tageswechsel wäre falsch.
    if(HOME_DATA&&loadHomeData.uid===uid&&HOME_DATA.date===today())return HOME_DATA;
    return null;}
  loadHomeData.uid=uid;
  STL_HOME_ST=200;
  STL_HOME_AT=Date.now();
  HOME_DATA=d;
  if(d.today)TODAY=d.today;
  HOME_CIS=d.checkins||[];
  if(d.insights){try{LAST_INSIGHTS=d.insights;}catch(e){}}
  if(d.mindset){try{MIND_TODAY=d.mindset;}catch(e){}}
  // Bereitschaft kommt seit 2.3.0 im Aggregat mit (ohne Verlauf – den holt erst openReadiness).
  // Ein Server ohne das Feld und der Fallback-Weg liefern null: dann entfällt die Zeile, statt einen alten Stand zu zeigen.
  if(d.readiness===undefined)d.readiness=null;
  if(d.unread!=null){UNREAD=+d.unread||0;const b=document.getElementById('bellBadge');
    if(b){b.textContent=UNREAD>9?'9+':UNREAD;b.classList.toggle('hidden',UNREAD===0);}}
  if(!PLAN||!PLAN.days)await loadPlan();
  return d;}
// Fallback in exakt der Form von GET /api/home/:userId (parallele Altrouten).
// Alle Routen laufen unbedingt – canAccess deckt den Coach ab, und die Startseite soll über beide Wege
// dieselben Karten zeigen (früher lieferte der Fallback dem Coach vier Felder als null).
// AUSNAHME monthly: GET /api/monthly schreibt die Monatsbelohnung gut, sobald der Athlet selbst schaut.
// Das Aggregat tut das bewusst nicht (nebenwirkungsfrei), also holt der Fallback es hier auch nicht –
// Gutschrift und Feier gehören zur Analyse (analysis.js), nicht zur Startseite.
async function homeLegacyLoad(uid){
  await loadToday();
  if(!PLAN||!PLAN.days)await loadPlan();
  const [cr,flr,suppR,insR,logsR,mindR]=await Promise.all([
    API.get(homeCheckinPath(uid)),
    API.get('/foodlog/'+uid+'?date='+today()),
    API.get('/supplement-intake/'+uid+'?date='+today()),
    API.get('/insights/'+uid),
    API.get('/logs/'+uid+'?date='+today()),
    API.get('/mindset/today/'+uid)
  ]);
  const ok=(x)=>(x&&x.status===200)?x.data:null;
  // Dieselbe Regel wie oben, eine Ebene tiefer – und hier sitzt die eigentliche Ursache der Null-Seite:
  // ok() macht aus jedem Nicht-200 ein null, und aus null macht die Startseite eine 0. Aus einem
  // ausgefallenen /foodlog wurde so „0 / 3.017 kcal" (gemessen: online 249), aus einem ausgefallenen
  // /logs „Lower 1 starten" statt „Weiter · 1/27 Sätze".
  // Drei Antworten tragen die Seite und haben KEINE eigene Absicherung: Check-ins (Ringe, Streak-Zeile,
  // Gewichtstrend), Essensprotokoll (Kalorienring) und die Sätze von heute (Trainingsring + Hauptknopf).
  // Fehlt eine davon, wird gar nicht gezeichnet. Supplements, Insights und Mindset dürfen fehlen – ihre
  // Blöcke lassen sich ohne Daten schon von selbst weg (homeSuppHTML, homeProgressHTML, drawHomeGoals).
  const tragend=[['Check-ins',cr],['Essensprotokoll',flr],['Sätze',logsR]].filter(([,x])=>!(x&&x.status===200));
  if(tragend.length){const bad=tragend[0][1];STL_HOME_ST=bad?bad.status:0;return null;}
  const days=((PLAN&&PLAN.days)||[]).map(d=>{const exs=(d.exercises||[]).filter(e=>!e.deleted);
    return {id:d.id,name:d.name,exerciseCount:exs.length,expectedSets:exs.reduce((s,e)=>s+(e.target_sets||3),0)};});
  const logs=(ok(logsR)?.logs)||[];
  return {date:today(),today:TODAY,plan:{days,activeTitle:PLAN?.title||''},
    checkins:ok(cr)?.checkins||[],foodlog:ok(flr),supplements:ok(suppR),insights:ok(insR),
    logsToday:logs.filter(l=>(+l.reps||0)>0).length,monthly:null,mindset:ok(mindR),unread:null,readiness:null};}

// ===== STUFE DES BETRACHTETEN ATHLETEN (Nachbesserung A-IV.1) =================================
// 1 Einsteiger · 2 Fortgeschritten · 3 Profi (STRATEGY-25 Abschnitt 4). Bis hierher kannte home.js
// überhaupt keine Stufe (`grep -c "experience|twLevel|an2Level" public/js/home.js` = 0) – Anfängerin
// und Profi sahen dieselben Kacheln, samt Tonnage in Tonnen nach dem allerersten Satz.
// DIESELBE Quelle und DIESELBE Rangfolge wie in der Satzzeile (training.js `twLevel`) und in der
// Analyse (analysis.js `an2Level`): `experience_coach` (vom Coach gesetzt) schlägt `experience`
// (Selbstauskunft aus dem Onboarding). Drei Rechnungen für dieselbe Frage wären genau der Fehler,
// den CRITIC K1 beschreibt – deshalb wird twLevel() gefragt, wenn es da ist, und nur bei fehlender
// Datei (Ladereihenfolge, Teilbündel) dasselbe selbst gerechnet. Auf `isBeginner()` (shell.js) ist
// kein Verlass: das kennt nur das EIGENE Konto und nicht den Athleten im Coach-Blick.
function hmLevel(){
  try{if(typeof twLevel==='function'){const n=+twLevel();if(n>=1&&n<=3)return n;}}catch(e){}
  let p=null;
  try{p=(VIEW_USER===ME.id)?ME:((typeof VIEW_USER_PROFILE!=='undefined'&&VIEW_USER_PROFILE)||ME);}catch(e){}
  p=p||{};
  const x=String(p.experience_coach||p.experience||'beginner').toLowerCase();
  return x==='advanced'?3:x==='intermediate'?2:1;}

// Abgeleiteter Tageszustand – Grundlage für Hero, Ringe, Chips und Fortschritt
function homeState(){
  const d=HOME_DATA||{},T=d.today||TODAY||{};
  const eff=homeEff(),isTrain=eff.type==='train',isSick=eff.type==='sick';
  const tdy=d.date||today();
  const own=(VIEW_USER===ME.id&&ME.role==='athlete');
  const cis=d.checkins||HOME_CIS||[];
  const ciToday=cis.find(c=>c.date===tdy)||null;
  const checkedIn=!!(ciToday&&(ciToday.weight!=null||ciToday.sleep!=null||ciToday.steps!=null||ciToday.water!=null));
  const fl=(d.foodlog&&d.foodlog.summary)||{};
  const kcalTarget=(fl.target!=null?fl.target:(isTrain?T?.kcal?.train:T?.kcal?.rest))||null;
  const consumed=+fl.consumed||0;
  const gFood=kcalTarget?(fl.status==='onTarget'||fl.status==='over'):(consumed>0);
  const sup=d.supplements||null,sTot=sup?(+sup.total||0):0,sDone=sup?(+sup.done||0):0;
  // Die Liste auf der Startseite (Plan + eigene Einträge + gerade abgewählte eigene) und ihr eigener Zähler:
  // sTot/sDone des Servers zählen nur Plan-Einnahmen, deshalb stand neben einem gesetzten Haken „0/1".
  const sItems=sup?homeSuppItems(sup,tdy):[],sItemsDone=sItems.filter(p=>p.taken).length;
  const planDays=(d.plan&&d.plan.days)||[];
  const dayObj=planDays.find(x=>x.name===eff.dayName)||planDays[0]||null;
  const expected=isTrain&&dayObj?(+dayObj.expectedSets||0):0;
  const doneSets=+d.logsToday||0;
  const MIND=d.mindset||null;
  // Ob es hier Mindset gibt, sagen die DATEN (HOME_DATA.mindset aus dem Home-Aggregat) – nicht der
  // Ladezustand einer Datei. Bis 2.7.0 stand hier `typeof openPriming==='function'`, und das hiess, seit
  // mindset.js nachgeladen wird (A-III.3), rund zwei Sekunden lang „dieser Athlet hat kein Mindset":
  // der Ring fehlte, die Zählung sprang von 1/4 auf 1/5, sobald die Datei da war (k3-nachruecken).
  // Der Ring führt ohnehin nur nach go('mindset'), und go() holt das Modul selbst nach (Lader in /app.js).
  const hasMind=!!(MIND&&own);
  const primed=!!(MIND&&MIND.priming),evened=!!(MIND&&MIND.evening);
  const mins=[5,10,15].includes(+MIND?.prefs?.priming_minutes)?+MIND.prefs.priming_minutes:10;
  // Tagesziele – nur, was es heute wirklich gibt (sonst wäre n/n gelogen)
  // A-IV.1: Seit 2.8.0 sind die Ringe das EINZIGE Tages-Dashboard (BUILD-A4 3.1). Deshalb tragen sie
  // zwei Dinge mehr als vorher:
  //   `pct`  – der echte Füllstand statt „an/aus". 695 von 3.017 kcal sind kein leerer Ring.
  //   `val`  – die Zahl darunter (höchstens ~11 Zeichen). Ohne sie wäre mit den Karten „Ernährung"
  //            und „Supplements" auch die Zahl verschwunden, und der Ring wäre eine Ampel ohne Wert.
  //   `act`  – jeder Ring öffnet jetzt das passende Sheet statt mal Sheet, mal Tabwechsel
  //            (RATE-shell-home N13). „Ernährung" führt damit in EINEM Tipp ins Eintragen-Sheet –
  //            das ist der Ein-Tap-Einstieg, den CRITIC K3 über dem Falz verlangt, gemessen mit
  //            tools/tapcount.mjs (`food`, Weg `[onclick*="openLogFood"]`).
  const kcalPct=kcalTarget?Math.min(1,consumed/kcalTarget):0;
  const goals=[{key:'checkin',ic:'pencil',l:'Check-in',done:checkedIn,act:'homeExpandCheckin()',
      pct:checkedIn?1:0,val:checkedIn?(ciToday&&ciToday.weight!=null?fmtNum(ciToday.weight,1)+' kg':'erledigt'):'offen'},
    {key:'food',ic:'utensils',l:'Ernährung',done:gFood,
      act:"typeof openLogFood==='function'?openLogFood({focus:true}):go('diet')",
      pct:kcalPct,val:kcalTarget?fmtNum(consumed)+' kcal':(consumed>0?fmtNum(consumed)+' kcal':'offen')}];
  if(sTot>0)goals.push({key:'supp',ic:'pill',l:'Supplements',done:sDone>=sTot,act:'openSupp()',
    pct:sTot?sDone/sTot:0,val:fmtNum(sDone)+'/'+fmtNum(sTot)});
  if(isTrain&&expected>0)goals.push({key:'train',ic:'dumbbell',l:'Training',done:doneSets>=expected,act:"go('workout')",
    pct:expected?Math.min(1,doneSets/expected):0,val:fmtNum(doneSets)+'/'+fmtNum(expected)});
  if(hasMind)goals.push({key:'mind',ic:'brain',l:'Mindset',done:primed,act:"go('mindset')",
    pct:primed?1:0,val:primed?'erledigt':'offen'});
  const doneN=goals.filter(g=>g.done).length;
  return {d,T,eff,isTrain,isSick,tdy,own,cis,ciToday,checkedIn,fl,kcalTarget,consumed,gFood,
    sup,sTot,sDone,sItems,sItemsDone,planDays,dayObj,expected,doneSets,MIND,hasMind,primed,evened,mins,
    goals,doneN,allDone:goals.length>0&&doneN===goals.length,
    // `last` = das letzte abgeschlossene Training, fertig gerechnet vom Server (lastWorkoutView).
    // Bis 2.8.0 holte die Karte sich dafür 25 KB Sätze und zählte Bestleistungen nach einer eigenen,
    // vierten Regel – siehe den Block bei hmLastHTML().
    last:d.lastWorkout||null,
    ins:d.insights||null,monthly:d.monthly||null,readiness:d.readiness||null};}
// Plan-Supplements, eigene Einträge und die gerade abgewählten eigenen Einträge in EINER Liste.
function homeSuppItems(sup,date){
  const extras=(sup&&sup.extras)||[];
  const off=(HOME_SUPP_OFF||[]).filter(x=>x.date===date&&!extras.some(e=>e.name===x.name));
  return [...((sup&&sup.plan)||[]),...extras,
    ...off.map(x=>({supplement_id:null,intake_id:null,name:x.name,dose:x.dose||'',taken:false,mandatory:false}))];}

// Chip-Beschriftung fuer das Mindset-Angebot: ein blosses Verb („Starten") sagt nichts – dann den Titel nehmen.
const HOME_GENERIC_ACTIONS=['starten','öffnen','oeffnen','weiter','los','mehr','ansehen','fertig'];
function homeMindChipLabel(w){
  const a=String(w.action||'').trim();
  if(a&&!HOME_GENERIC_ACTIONS.includes(a.toLowerCase()))return homeShortLabel(a);
  return homeShortLabel(w.title||a||'Mindset');}
// Lange Titel („Pre-Workout (60–90 Min. vor Trainingsbeginn)", „Priming: 10 Minuten für deinen Tag")
// auf das Wesentliche kuerzen – und wenn doch gekuerzt wird, dann an der Wortgrenze, nie mitten im Wort.
function homeShortLabel(s){s=String(s||'').trim();
  s=s.split(' · ')[0].split(' (')[0].split(': ')[0].replace(/[?!:]+$/,'').trim();
  if(s.length<=26)return s;
  const cut=s.slice(0,25),sp=cut.lastIndexOf(' ');
  return (sp>=10?cut.slice(0,sp):cut).trim()+'…';}
// Erster Tag nach dem Onboarding: heute registriert und noch nichts geloggt -> das Mindset-Modul
// tritt zurueck, damit „Training starten"/„Check-in" die ersten Wege sind.
function homeDayOne(s){
  const c=(ME&&ME.created_at)?String(ME.created_at).slice(0,10):'';
  return !!(c&&c===(s.tdy||today())&&!s.doneSets&&!(s.cis&&s.cis.length));}

// Mindset-Widget (WP4 liefert ein Objekt; alte Fassung lieferte Markup -> defensiv einpacken)
function homeMindWidget(){
  const d=HOME_DATA&&HOME_DATA.mindset;
  if(!d||typeof mindsetHomeWidget!=='function')return null;
  let w=null;try{w=mindsetHomeWidget(d);}catch(e){return null;}
  if(!w)return null;
  if(typeof w==='string')return {title:'Mindset',sub:'',action:'Mindset',fn:"go('mindset')"};
  if(typeof w!=='object')return null;
  return w;}

// ===== PLATZ FÜR DAS NACHGELADENE MINDSET-MODUL =====
// mindset.js kommt seit 2.7.0 aus dem Nachlauf (BUILD-A3 Abschnitt 5.1) und ist rund zwei Sekunden nach
// der fertigen Startseite da. Bis dahin fehlten drei Dinge, die beim Erscheinen alles darunter nach unten
// schoben – gemessen 96 px: der Mindset-Ring, der Mindset-Kurzweg und die Statuszeile (Challenge/Rad).
// Die Antwort steht hier: Platz von Anfang an reservieren, damit nichts nachrückt.
//   · Ring: braucht das Modul gar nicht (siehe homeState) – steht sofort richtig da.
//   · Kurzweg: schon jetzt benutzbar („Mindset" → go('mindset') lädt das Modul selbst nach); sobald
//     das Modul da ist, steht an derselben Stelle sein genauer Text („Priming nachholen").
//   · Statuszeile: ein Platzhalter derselben Höhe – und nur dann, wenn die Daten eine ankündigen.
// Die Platzhalter tragen bewusst NICHT die Klasse `skeleton`: ein `.skeleton` unter `#views` heißt in
// dieser App „die Seite ist noch nicht fertig" – der Nachlade-Lader wartet darauf, bevor er überhaupt
// anfängt (src/server.js). Mit dieser Klasse hätte der reservierte Platz den Nachlauf ausgesperrt.
// Geholt wird hier NICHTS: der Zeitplan des Nachlaufs (BOOT_IDLE_MS, A-III.3) bleibt unangetastet, damit
// sich die Kaltstart-Messung (perf.mjs: Anfragen und Bytes) nicht verschiebt.
let STL_MIND_GONE=false;   // Modul kam auch nach der Wartezeit nicht – reservierten Platz auflösen
let STL_MIND_WATCH=0;
function stlMindLoaded(){return typeof mindsetHomeWidget==='function';}
function stlMindPending(s){return !!(s&&s.own&&s.MIND&&!stlMindLoaded()&&!STL_MIND_GONE);}
// Eine Mindset-Handlung auslösen, gleich ob das Modul schon da ist: ist es da, sofort; ist es unterwegs,
// holt der Lader es nach und ruft dann; gibt es den Lader nicht, bleibt der Weg über den Tab.
function stlMindCall(fn){
  try{if(typeof window[fn]==='function')return window[fn]();}catch(e){}
  if(typeof bootCall==='function')return bootCall('mindset',fn);
  return go('mindset');}
// Wie viele Kurzweg-Plätze holt sich das Modul, sobald es da ist? Gebraucht wird das NUR für die
// Reservierung – die Texte entstehen weiter in mindset.js (mindsetHomeWidget). Gespiegelt sind dessen
// Tore, nicht seine Formulierungen: „voll" ist ein Durchlauf mit full!==false (mdIsFull), vor 17 Uhr
// geht es ums Priming, danach um die Reflexion, und die Power-Atmung wird angeboten, solange ihr
// Tagesziel offen und der Tag nicht rund ist. Ändert mindset.js diese Tore, stimmt die Reservierung um
// einen Chip nicht mehr – dann rückt wieder etwas nach; gelogen wird deshalb nichts.
function stlMindSlots(s,hour){
  const M=(s&&s.MIND)||null;
  if(!M)return {action:false,breath:false};
  if(hour==null)hour=new Date().getHours();
  const full=x=>!!x&&x.full!==false;
  const prim=full(M.priming),eve=full(M.evening);
  const done=!!eve&&(prim||hour>=17);
  const bn=+M.breathCount||0,bt=+M.breathTarget||3;
  return {action:(hour<17)?!prim:!eve,breath:bn<bt&&!done};}
// Reservierter Platz für die Statuszeile. Ob eine kommt, sagen die Daten (challenge.active, wheel.due);
// den Text formuliert mindset.js. Kommt keine, wird auch nichts reserviert – ein Platzhalter, auf den nie
// etwas folgt, wäre eine Lüge in die andere Richtung.
function stlMindStatusPlaceholder(s){
  if(!stlMindPending(s))return '';
  const M=s.MIND||{};
  if(!(M.challenge&&M.challenge.active)&&!(M.wheel&&M.wheel.due))return '';
  return `<div class="rows mb-3" id="homeMind" aria-hidden="true"><div class="row">
    <div class="r-ic">${icon('brain')}</div>
    <div class="rl"><span class="stl-wait" style="display:inline-block;vertical-align:middle;height:17px;width:52%;border-radius:8px;background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%);background-size:200% 100%;animation:sk 1.2s linear infinite"></span></div>
    <div class="rr"></div></div></div>`;}
// Solange Platz reserviert ist: nachsehen, ob das Modul da ist, und die Seite EINMAL an Ort und Stelle
// nachziehen ({cached:true} – kein Skelett, kein Sprung, keine Scroll-Rücksetzung). Der Nachlade-Lader
// tut das auch, aber erst wenn ALLE vier Module da sind; mindset.js ist das erste und steht früher.
// Kommt es nach zehn Sekunden nicht (kein Netz), lösen sich die Platzhalter auf; der Ring und der
// Kurzweg „Mindset" bleiben stehen – beide führen dann auf die Wiederholen-Karte des Laders.
function stlMindWatch(){
  if(STL_MIND_WATCH||STL_MIND_GONE)return;
  let n=0;
  STL_MIND_WATCH=setInterval(function(){
    const da=stlMindLoaded();
    if(!da&&++n<40)return;
    clearInterval(STL_MIND_WATCH);STL_MIND_WATCH=0;
    if(!da)STL_MIND_GONE=true;
    try{
      if(typeof CUR_TAB!=='undefined'&&CUR_TAB!=='home')return;
      const v=document.getElementById('views');
      if(v&&v.querySelector('#homePage'))renderHome(v,{cached:true});
    }catch(e){}
  },250);}

// Ab Mittag ohne nennenswerte Mahlzeit ist Essen die nächste Handlung – und zwar das Eintragen selbst,
// nicht der Wechsel auf den Ernährungs-Tab. Bis 2.4.0 stand um 13 Uhr bei 0 kcal „Ernährung öffnen" als
// Hauptknopf, während direkt darunter der Kurzweg „Essen loggen" das Sheet öffnete (RATE-shell-home M5).
// Liefert true, sobald ab 12 Uhr weniger als die Hälfte des Tagesziels gegessen ist.
function shMiddayCta(s,hour){
  if(!s||!s.own||!s.kcalTarget)return false;
  if(hour==null)hour=new Date().getHours();
  return hour>=12&&(+s.consumed||0)<s.kcalTarget*0.5;}
// Krank gemeldet: eine Bereitschaftszahl und ein „zieh durch" wären an diesem Tag eine falsche Ansage.
// Statt der Bereitschaftszeile steht deshalb genau ein Satz in der Karte (RATE-shell-home M2).
function shSickHTML(){
  return '<div class="note mt-3">Erst gesund werden – dein Rhythmus wartet.</div>';}

/* ============================================================================================
   A-IV.1 (2.8.0) · DIE AUFGERÄUMTE STARTSEITE – Präfix `hm`
   --------------------------------------------------------------------------------------------
   Gemessener Ausgangspunkt (tools/accent.mjs, 2.7.0, Konto Marco): 1.816 px Seitenhöhe = 2,2
   Bildschirme, 5 rote Elemente über dem Falz. Jedes Thema stand dreimal da: Supplements als Chip
   UND Ring UND Liste, Ernährung als Chip UND Ring UND Karte, Check-in als Ring UND Karte UND
   Zeile (RATE-shell-home H1).

   Die Regel dieser Welle (CRITIC K3): DOPPELUNGEN entfernen, NICHT EINSTIEGE. Genau daran ist
   MyFitnessPal 2026 gescheitert (RESEARCH-25-apps.md) – eine aufgeräumte Startseite, die jeden
   Eintrag einen Tap teurer machte. Deshalb gilt hier:
     · Jedes Thema erscheint EINMAL als Zustand (sein Ring) und höchstens EINMAL als Handlung.
     · Der Ring IST die Handlung: ein Tipp öffnet das passende Sheet (RATE-shell-home N13).
       „Ernährung" öffnet damit das Eintragen-Sheet statt den Tab – ein Tap statt eines Umwegs.
     · Was dadurch entfällt, sind die Wiederholungen: die Karten Check-in/Ernährung/Supplements,
       die Chips „Essen loggen"/„Check-in"/„Supplements x/y" und die Mindset-Statuszeile.
     · Was bleibt, sind die Ein-Tap-Wege. Nachgewiesen mit tools/tapcount.mjs vorher/nachher:
       food 3 → 3, checkin 7 → 2, supp 1 → 1, priming 2 → 2 (Werte im Bericht DONE-A4-A-IV.1.md).
   Der eine Ausreißer ist das Supplement: sein Ring öffnet das Sheet, aber ein Haken KOSTET dort
   einen zweiten Tap. Der Haken ist der Einstieg, nicht die Doppelung – also bleibt genau EINE
   offene Einnahme als abhakbare Zeile unter den Ringen stehen (statt bis zu vier Zeilen plus
   „alle anzeigen" plus Abschnittskopf plus Chip).
   ============================================================================================ */

// ---- Rückweg: „Startseite: neu / klassisch" (BUILD-A4 3.7, CRITIC K3) ----
// Ein Flag, zwei Zeichenpfade, mehr nicht. Wer mit der neuen Seite nicht zurechtkommt, stellt sie
// zurück, ohne auf ein Update zu warten – 14 Tage lang ist das die Zusage.
const HM_VAR_KEY='be_home_v';
function hmVariant(){try{return localStorage.getItem(HM_VAR_KEY)==='klassisch'?'klassisch':'neu';}catch(e){return 'neu';}}
function hmNew(){return hmVariant()==='neu';}
function hmSetVariant(v){
  try{if(v==='klassisch')localStorage.setItem(HM_VAR_KEY,'klassisch');else localStorage.removeItem(HM_VAR_KEY);}catch(e){}
  closeAllSheets();
  if(typeof invalidateView==='function')try{invalidateView('home');}catch(e){}
  const el=document.getElementById('views');
  if(el&&el.querySelector('#homePage'))renderHome(el,{cached:true});
  toast(v==='klassisch'?'Klassische Startseite ✓':'Neue Startseite ✓');}
function openHomeVariantSheet(){
  const cur=hmVariant();
  const row=(key,title,sub)=>`<div class="row h-tap" role="button" tabindex="0" aria-pressed="${cur===key?'true':'false'}"
      onkeydown="homeRowKey(event)" onclick="hmSetVariant('${key}')">
      <div class="r-ic">${icon(key==='neu'?'sparkles':'more',22)}</div>
      <div class="rl">${esc2(title)}<small>${esc2(sub)}</small></div>
      <div class="rr">${cur===key?icon('check',20,'tone-green'):''}</div></div>`;
  openSheet('Startseite',`
    <div class="note mb-3">Die neue Startseite zeigt jedes Thema einmal: die Ringe sind dein Tag, ein Tipp darauf öffnet das passende Formular. Wenn dir die ausführliche Fassung lieber ist, stell sie hier zurück.</div>
    <div class="rows" role="group" aria-label="Darstellung der Startseite">
      ${row('neu','Neu','Ringe als Tagesübersicht, eine Hauptsache, „Zuletzt"')}
      ${row('klassisch','Klassisch','Karten für Check-in, Ernährung und Supplements')}
    </div>`);}

// ---- „Tag komplett" feiern – einmal pro Tag, aus beiden Zeichenpfaden derselbe Weg ----
// EIN Schlüssel mit dem Datum als Wert – nicht einer je Kalendertag: die Frage lautet nur „heute
// schon gefeiert?", und die alten Tages-Schlüssel räumte nie jemand auf (nach drei Jahren über
// 1.000 Einträge, die _snapKeys bei jedem Hintergrundwechsel durchlief).
function hmCelebrate(s){
  if(!s||!s.allDone)return;
  const key='be_daily';
  try{if(localStorage.getItem(key)!==s.tdy&&HOME_TIP!==s.tdy){HOME_TIP=s.tdy;localStorage.setItem(key,s.tdy);
    setTimeout(()=>{if(typeof celebrate==='function')celebrate('🎉','Tag komplett!','Alle Tagesziele erreicht – stark!');},700);}}catch(e){}}

// ---- Die Streak-Zeile (aus beiden Pfaden gleich) ----
// Die Flamme trägt KEIN Marken-Rot mehr: sie ist Status, nicht Marke (STRATEGY-25 P6). Gemessen
// zählte accent.mjs sie über dem Falz als zwei der fünf roten Elemente mit.
function hmStreakHTML(s){
  if(!s.ins)return '';
  // 2.9.0 (A-V.3, CRITIC K10): Hier stand die TAGES-Serie („31 Check-ins in Folge"). Sie ist ersetzt
  // durch die EINE Konsistenz-Zeile – lpWeekLineHTML(). Der Rest dieser Funktion bleibt nur als
  // Notnagel stehen, falls der Server die Wochenziel-Zahlen nicht mitliefert (ältere Antwort).
  const wl=lpWeekLineHTML(s);if(wl)return wl;
  const streak=s.ins?.streaks?.checkin||0,fb=s.ins?.freezes?.balance||0;
  // Numerus wie in lpWeekLineHTML: „1 Reparatur übrig", nicht „1 Reparaturen übrig".
  const jok=`<button class="hg-jok" onclick="openStreakInfo()" aria-label="${pl(fb,'Reparatur','Reparaturen')} übrig">${icon('shield',16)}${fmtNum(fb)}</button>`;
  const sw=shStreakWords(streak,s.ins?.streaks?.checkinFrozen);
  // Der Tagesstand als eigene Marke rechts statt als Anhängsel im Satz: „31 Check-ins in Folge ·
  // heute schon dran" brach auf 390 px auf zwei Zeilen um und kostete die Karte 22 px, ohne ein
  // Wort mehr zu sagen.
  // B6: „heute ✓" war das letzte Zeichen-Symbol auf der Startseite – direkt neben icon('flame') und
  // icon('shield') in derselben Zeile. Jetzt derselbe Strichglyph wie ueberall, Farbe kommt weiter
  // von `.tone-green` (dafuer `.hg-st .ic{color:inherit}` in home.css).
  const st=s.checkedIn?`<span class="hg-st tone-green">heute ${icon('check',13)}</span>`:'<span class="hg-st tone-amber">heute offen</span>';
  return streak>0
    ? `<div class="hg-streak">${icon('flame',18)}<div class="fill"><b>${esc2(sw.main)}</b>${sw.detail?`<small>${esc2(sw.detail)}</small>`:''}</div>${st}${jok}</div>`
    : `<div class="hg-streak">${icon('flame',18)}<div class="fill muted">Ab deinem ersten Check-in zählt hier die Folge.</div>${jok}</div>`;}

// ---- Die EINE Tages-Karte: Ringe + Folge + (falls offen) eine abhakbare Einnahme ----
// Der Abschnittskopf sitzt IN der Karte statt darüber: fünf `section-label` à 40 px waren auf einer
// Seite, die unter 1.000 px bleiben soll, ein Fünftel des Platzes.
function hmTodayHTML(){
  const s=homeState();if(!s.own||!s.goals.length)return '';
  hmCelebrate(s);
  const rings=s.goals.map(g=>{
    const pct=Math.max(0,Math.min(1,+g.pct||0));
    return `<button class="hg" onclick="${g.act}" aria-label="${esc2(g.l)} ${esc2(String(g.val||''))}${g.done?' – erledigt':''}. Öffnen">
      <span class="hg-r">${ring(g.done?1:pct,{size:46,stroke:4,color:'var(--green)',track:'var(--surface3)'})}<span class="hg-ic">${icon(g.ic,20)}</span>${g.done?`<span class="hg-b">${icon('check',12)}</span>`:''}</span>
      <span class="hg-l${g.done?' done':''}">${esc2(g.l)}</span>
      <span class="hg-v">${esc2(String(g.val==null?'':g.val))}</span></button>`;}).join('');
  // Genau EINE offene Einnahme – der Ein-Tap-Haken, der vorher unter einer 4-zeiligen Liste bei
  // y = 1.304 px lag (gemessen: 915 px Scrollweg, tapcount `supp`). Jetzt steht er über dem Falz.
  let supp='';
  const open=(s.sItems||[]).filter(p=>!p.taken);
  if(open.length){const p=open[0],rest=open.length-1;
    supp=`<div class="hg-supp"><div class="row h-tap" role="button" tabindex="0" aria-pressed="false" onkeydown="homeRowKey(event)"
        onclick="toggleIntakeHome(event,${p.supplement_id??'null'},${p.intake_id??'null'},'${esc(p.name)}','${esc(p.dose||'')}')">
        <div class="r-ic">${icon('pill',22)}</div>
        <div class="rl">${esc2(p.name)}<small>${esc2(p.dose||'Menge offen')}${rest>0?' · noch '+fmtNum(rest)+' offen':''}</small></div>
        <div class="rr">${p.mandatory?'<span class="pill must">Pflicht</span>':''}</div></div></div>`;}
  return `<div class="card hm-day mb-3">
    <div class="hm-h"><span class="hm-h-t">Heute</span><span class="hm-h-n${s.allDone?' tone-green':''}">${fmtNum(s.doneN)}/${fmtNum(s.goals.length)}</span></div>
    <div class="hg-row">${rings}</div>${hmStreakHTML(s)}${supp}</div>`;}

/* ---- „Zuletzt": das letzte Training des Athleten (BUILD-A4 3.3) -----------------------------
   Der Coach sieht „Letztes Training Lower 1 · gestern" (coach.js:1549) – der Athlet selbst sah es
   auf seiner eigenen Startseite nirgends (RATE-shell-home, Abschnitt „Was 12 von 10 wäre", Punkt 2).
   Strong/Hevy öffnen mit dem letzten Workout, WHOOP mit dem Recap: das ist der Grund, die App
   morgens zu öffnen, wenn noch nichts zu tun ist.

   NACHBESSERUNG 2.8.0: Die Karte rechnete sich hier selbst aus GET /api/logs/:uid aus – und hatte
   damit eine EIGENE Bestleistungs-Regel, die vierte in der App. Sie gruppierte über `exercise_id`,
   der Server vergleicht seit D15 über den normalisierten Übungsnamen, also über die Bewegung.
   Gemessen in `rate-shell-home.db`: „Leg Press" steht als id 3 UND id 4 im Plan; 100 kg auf id 3
   beantwortet POST /api/logs mit {"pr":false,"prevMax":102.5} – die Startseite schrieb trotzdem
   „1 Bestleistung". Jetzt rechnet der Server (`lastWorkoutView`, server.js), und die Karte zeigt nur
   noch an, was im Home-Aggregat steht: `HOME_DATA.lastWorkout` = {none} | {date,name,sets,volume,prs,top}.
   Zwei Dinge fallen damit zugleich weg: die zweite Anfrage über 25 KB und der Platzhalter, der zwei
   Sekunden lang dastand – die Karte ist jetzt Teil des ersten Bildes und des Offline-Schnappschusses. */
function hmDayWord(iso){
  const d=Math.round((Date.parse(today()+'T00:00:00Z')-Date.parse(iso+'T00:00:00Z'))/864e5);
  if(d<=0)return 'Heute';
  if(d===1)return 'Gestern';
  if(d===2)return 'Vorgestern';
  if(d<=6)return cap(fmtDate(iso,{weekday:'long'}));
  return 'vor '+pl(d,'Tag','Tagen');}
function hmLastHTML(){
  const s=homeState();
  if(!s.own||homeDayOne(s))return '';
  const L=s.last;
  // Ein Aggregat ohne `lastWorkout` (alter Offline-Schnappschuss aus 2.8.0-vor-dieser-Nachbesserung)
  // zeigt gar nichts – lieber keine Karte als ein Platzhalter, der nie gefüllt wird.
  if(!L)return '';
  if(L.none)
    return `<div class="card hm-last mb-3"><div class="r-ic">${icon('dumbbell',22)}</div>
      <div class="fill"><b>Noch kein Training aufgezeichnet</b><small>Sobald du den ersten Satz einträgst, steht hier deine letzte Einheit.</small></div></div>`;
  // A-9 (Nachbesserung): dieselbe Regel wie im Fortschritts-Streifen. „9,5 t" in der Zeile „Zuletzt"
  // ist für Stufe 1 keine Rückmeldung; „12 Sätze · Top 102,5 kg × 10" ist eine – und das ist genau
  // das „Stärker geworden" aus STRATEGY 4.3 Level 1. Ab Stufe 2 bleibt die Tonne stehen.
  const parts=[pl(L.sets,'Satz','Sätze'),
    (hmLevel()>=2&&L.volume>=100)?fmtNum(L.volume/1000,1)+' t':null,
    L.prs>0?pl(L.prs,'Bestleistung','Bestleistungen'):null,
    (!L.prs&&L.top)?'Top '+fmtNum(L.top.weight,L.top.weight%1?1:0)+' kg × '+fmtNum(L.top.reps):null].filter(Boolean);
  return `<div class="card hm-last tap mb-3" role="button" tabindex="0" onkeydown="homeRowKey(event)" onclick="shOpenRhythmDay('${L.date}')">
    <div class="r-ic">${icon('dumbbell',22)}</div>
    <div class="fill"><b>${esc2(hmDayWord(L.date))}${L.name?' · '+esc2(L.name):''}</b><small>${esc2(parts.join(' · '))}</small></div>
    <div class="rr">${icon('chevronRight',18)}</div></div>`;}

// Der variantenrichtige Zeichner für `#homeGoals`. Jede Stelle, die nach einem Haken, einem
// Check-in oder einem Tagwechsel nachzieht, geht hier durch – sonst bekäme die neue Startseite
// beim ersten Patch die alte Ringzeile untergeschoben.
function hmGoalsHTML(){return hmNew()?hmTodayHTML():drawHomeGoals();}

// ---- „Mehr": dieselben vier Wege als Chip-Zeile statt als 116-px-Kachelblock ----
// Dazu der Schalter aus 3.7. Er sitzt hier, weil public/js/account.js in dieser Welle niemandem
// gehört (BUILD-A4 Abschnitt 2) – der Weg ins Profil steht in DEFER-A4.md.
function hmMoreHTML(){
  const c=(fn,t)=>`<button class="chip" onclick="${fn}">${t}</button>`;
  // EINE Zeile, alle fünf Wege sichtbar, ohne Symbol und ohne Umbruch. Gemessen: mit Symbol
  // brauchen fünf Chips 512 px bei 358 px Seitenbreite – „Startseite" lag komplett ausserhalb des
  // Bildes, und das ist ausgerechnet der Rückweg aus 3.7. Umgebrochen kostete die Zeile 56 px, die
  // bei 985 px Seitenhöhe nicht da sind. Ohne Symbol sind es 334 px: nichts entfernt, nichts
  // versteckt, 24 px Reserve (Begründung in home.css bei `.hm-more`).
  return `<div class="chip-row hm-more mb-3">
    ${c("typeof openMeasure==='function'?openMeasure():go('tracker')",'Maße')}
    ${c("typeof openPhotos==='function'?openPhotos():go('tracker')",'Foto')}
    ${c("typeof openCalendar==='function'?openCalendar():go('workout')",'Kalender')}
    ${c("typeof openAchievements==='function'?openAchievements():go('tracker')",'Erfolge')}
    ${c('openHomeVariantSheet()','Startseite')}
  </div>`;}

// ===== JETZT-KARTE =====
// Genau EIN roter Primär-Button, gewählt aus dem Tageszustand; darunter höchstens vier offene Kurzwege.
function nowCardHTML(){
  if(!HOME_DATA)return '<div class="today" id="homeNow">'+skeleton(1)+'</div>';
  const s=homeState();
  const eff=s.eff,hour=new Date().getHours();
  const dayName=s.isSick?'Erholung':(s.isTrain?(eff.dayName||'Training'):'Ruhetag');
  const kind=s.isSick?'Krank gemeldet':(s.isTrain?'Trainingstag':'Ruhetag');
  // A-3 (Nachbesserung): „Offseason" stand auf dem allerersten Bildschirm JEDES neuen Kontos.
  // `users.phase` hat den Standardwert 'offseason' (src/schema.js:166) und das Onboarding fragt nie
  // danach – gemessen an einem frisch angelegten Konto („Anfänger — Neu im Training"), das eine Minute
  // später „Trainingstag · Offseason" las. Das Wort wird nirgends erklärt; das Technik-Lexikon
  // (src/server.js, 26 Begriffe) kennt es nicht. STRATEGY 1.1 Reibungspunkt 2 nennt es namentlich als
  // Anfänger-Blocker, STRATEGY 4.5 verbietet Fachbegriffe im Athleten-UI. Zwei Regeln:
  //  · Klartext statt Jargon – „Aufbauphase" versteht auch ein Profi, „Offseason" nicht jede Anfängerin.
  //  · Auf Stufe 1 bleibt der UNBERÜHRTE Standard 'offseason' ganz weg: die Zeile trägt schon
  //    „Trainingstag", und eine Phase, die niemand gesetzt hat, ist keine Aussage. Hat der Coach
  //    ausdrücklich 'prep' oder 'maintain' gesetzt, steht das auch auf Stufe 1 da – das ist eine
  //    Entscheidung über diesen Athleten und keine Voreinstellung.
  // Die Phase in der Sprache des Athleten. Der Coach-Bildschirm darf beim Fachwort bleiben
  // (coach.js `phaseLabel`, account.js `PHASE_LABEL`) – hier liest ein Mensch seinen eigenen Tag.
  const phWort={offseason:'Aufbauphase',prep:'Wettkampf-Diät',maintain:'Halten'};
  const phRaw=String(s.T?.phase||'');
  const phase=(hmLevel()<2&&(phRaw||'offseason')==='offseason')?'':(phWort[phRaw]||'');
  // „Woche 1/4" stand hier zweimal (der Fortschritt-Streifen traegt es) und las sich wie ein Blockplan;
  // an Ruhetagen sagte die Zeile ausserdem dasselbe wie der Tagesname darueber.
  const meta=[(kind===dayName?'':kind),phase].filter(Boolean).join(' · ');
  // Gruss darf kuerzen, das Datum steht immer ganz da. Im Coach-Kontext kein „Guten Abend, <Athlet>" –
  // die Karte gehoert dem Athleten, gelesen wird sie vom Coach.
  const dateTxt=esc2(cap(fmtDate(new Date(),{weekday:'short',month:'numeric'})));
  const eyebrow=s.own
    ? `<span class="t-hi">${homeGreeting()}, ${esc2(homeFirstName())}</span><span class="t-date">· ${dateTxt}</span>`
    : `<span class="t-hi">Athletenansicht</span><span class="t-date">· ${dateTxt}</span>`;

  // --- Primärer Ruf zur Tat ---
  // Reihenfolge nach Dringlichkeit des Tages. Zwei Regeln kamen mit 2.5.0 dazu (B10):
  //  · Krank gemeldet: kein Mindset-Programm, kein roter Knopf – heute ist Erholung die Aufgabe.
  //  · „Ernährung öffnen" ist kein Ruf zur Tat, sondern ein Tabwechsel; ab 12 Uhr und unter der Hälfte
  //    des Kalorienziels trägt der Hauptknopf das Eintragen selbst (shMiddayCta).
  const mw=homeMindWidget(),day1=homeDayOne(s);
  const foodCta={l:'Essen loggen',fn:"typeof openLogFood==='function'?openLogFood({focus:true}):go('diet')"};
  let cta=null,ctaCls='btn block',used='';
  if(s.own){
    if(s.isSick){
      ctaCls='btn block sec';
      if(!s.checkedIn){cta={l:'Check-in eintragen',fn:'homeExpandCheckin()'};used='checkin';}
      else if(shMiddayCta(s,hour)){cta=foodCta;used='food';}
      else if(s.allDone){cta={l:'Tag komplett',fn:"go('tracker')"};used='done';}
    }
    else if(s.isTrain&&s.expected>0&&s.doneSets<s.expected){
      cta={l:s.doneSets>0?`Weiter · ${fmtNum(s.doneSets)}/${fmtNum(s.expected)} Sätze`:`${dayName} starten`,fn:"go('workout',{start:true})"};used='train';}
    else if(s.isTrain&&s.expected===0&&s.planDays.length){cta={l:'Training öffnen',fn:"go('workout')"};used='train';}
    else if(!s.isTrain&&hour<12&&s.hasMind&&!s.primed&&!day1){cta={l:`Priming starten · ${fmtNum(s.mins)} Min.`,fn:"stlMindCall('openPriming')"};used='mind';}
    else if(!s.checkedIn){cta={l:'Check-in eintragen',fn:'homeExpandCheckin()'};used='checkin';}
    else if(shMiddayCta(s,hour)){cta=foodCta;used='food';}
    else if(hour>=17&&s.hasMind&&!s.evened&&!day1){cta={l:'Abend-Reflexion',fn:"stlMindCall('openEvening')"};used='mind';}
    else if(s.allDone){cta={l:'Tag komplett',fn:"go('tracker')"};ctaCls='btn block sec';used='done';}
    else if(!s.gFood){cta=foodCta;used='food';}
    else if(s.sTot>0&&s.sDone<s.sTot){cta={l:'Supplements abhaken',fn:'openSupp()'};ctaCls='btn block sec';used='supp';}
  }else{
    cta={l:'Trainingsplan ansehen',fn:"go('workout')"};ctaCls='btn block sec';
  }

  // --- Sekundäre Kurzwege (nur offene Punkte) ---
  // NEUE STARTSEITE (2.8.0, BUILD-A4 3.5): höchstens ZWEI weitere neutrale Chips – und zwar genau
  // die Angebote, die KEINEN eigenen Ring haben. Check-in, Ernährung und Supplements standen bis
  // 2.7.0 zusätzlich als Chip hier; das war die Doppelung (RATE-shell-home H1), nicht der Einstieg.
  // Der Einstieg ist jetzt der Ring darunter, und der kostet denselben einen Tap (tapcount `food`,
  // `checkin`). Was hier bleibt, ist das Mindset-Angebot – es hat zwar einen Ring, aber der führt
  // auf den Tab, nicht in die Übung; der Chip ist also der einzige Ein-Tap-Weg ins Ritual
  // (tapcount `priming` = 2 Taps, Weg „Power-Atmung" → „Los geht's").
  const chips=[],maxChips=hmNew()?2:4;
  if(s.own&&hmNew()){
    const wait=(!mw&&!day1&&!s.isSick&&s.MIND&&!stlMindLoaded())?stlMindSlots(s,hour):null;
    if(used!=='mind'&&!day1&&!s.isSick&&mw&&!mw.done&&mw.action&&mw.fn)
      chips.push({l:homeMindChipLabel(mw),fn:String(mw.fn),ic:'brain'});
    else if(wait&&used!=='mind'&&wait.action)chips.push({l:'Mindset',fn:"go('mindset')",ic:'brain'});
    if(mw&&!day1&&!s.isSick&&Array.isArray(mw.secondary))mw.secondary.filter(x=>x&&x.label&&x.fn).slice(0,2)
      .forEach(x=>chips.push({l:String(x.label),fn:String(x.fn),ic:'sparkles'}));
    else if(wait&&wait.breath&&stlMindPending(s))chips.push({skel:true});
    // Die nächste Plan-Mahlzeit lässt sich von hier in EINEM Tipp abhaken – das ist keine
    // Wiederholung des Ernährungsrings, sondern eine andere Handlung (eintragen statt öffnen).
    const nm=homeNextMeal();
    if(hour<12&&nm&&!nm.logged&&nm.mealId)chips.push({l:homeShortLabel(nm.label),fn:`homeMealDone(${+nm.mealId})`,ic:'check'});
  }else if(s.own){
    // Fehlt das Mindset-Modul noch, sagen die Daten, welche Plätze es sich holen wird (stlMindSlots) –
    // sonst wüchse die Chip-Zeile zwei Sekunden später um eine Zeile und schöbe alles darunter nach
    // unten. Der Kurzweg selbst steht auch dann da, wenn das Modul gar nicht mehr kommt: das Angebot
    // gibt es ja (die Daten sagen es), und go('mindset') führt dann auf die Wiederholen-Karte des Laders.
    const wait=(!mw&&!day1&&!s.isSick&&s.own&&s.MIND&&!stlMindLoaded())?stlMindSlots(s,hour):null;
    // Nur wenn das Mindset-Modul wirklich etwas zu tun anbietet (Aktion + Ziel) – ein „erledigt ✓" ist kein Kurzweg.
    // Krank gemeldet: gar nichts davon. „Power-Atmung 0/3" neben „Krank gemeldet" ist ein Programm, kein Angebot.
    if(used!=='mind'&&!day1&&!s.isSick&&mw&&!mw.done&&mw.action&&mw.fn)
      chips.push({l:homeMindChipLabel(mw),fn:String(mw.fn),ic:'brain'});
    // Derselbe Platz, schon benutzbar: go('mindset') holt das Modul nach. Sobald es da ist, steht hier
    // sein genauer Text („Priming nachholen") – an derselben Stelle, ohne dass etwas nachrückt.
    else if(wait&&used!=='mind'&&wait.action)chips.push({l:'Mindset',fn:"go('mindset')",ic:'brain'});
    if(used!=='checkin'&&!s.checkedIn)chips.push({l:'Check-in',fn:'homeExpandCheckin()',ic:'pencil'});
    if(used!=='food'&&!s.gFood)chips.push({l:foodCta.l,fn:foodCta.fn,ic:'utensils'});
    if(used!=='supp'&&s.sTot>0&&s.sDone<s.sTot)chips.push({l:`Supplements ${fmtNum(s.sDone)}/${fmtNum(s.sTot)}`,fn:'openSupp()',ic:'pill'});
    const nm=homeNextMeal();
    if(hour<12&&nm&&!nm.logged&&nm.mealId)chips.push({l:homeShortLabel(nm.label),fn:`homeMealDone(${+nm.mealId})`,ic:'check'});
    // Zusatzangebote des Mindset-Moduls (z.B. „Power-Atmung 0/3") ganz zum Schluss – sie fallen als Erstes weg
    if(mw&&!day1&&!s.isSick&&Array.isArray(mw.secondary))mw.secondary.filter(x=>x&&x.label&&x.fn).slice(0,2)
      .forEach(x=>chips.push({l:String(x.label),fn:String(x.fn),ic:'sparkles'}));
    // … und ihr Platz, solange das Modul unterwegs ist: ein Chip knapp in der Breite von
    // „Power-Atmung 0/3" (gemessen 158 px auf 390 px Breite; der Platzhalter nimmt 150 px). Bewusst etwas
    // schmaler – ein breiterer Platzhalter braucht einen Umbruch mehr als der echte Chip, und dann
    // schrumpft die Seite beim Eintreffen des Moduls, statt einfach stehen zu bleiben.
    // Kommt es nicht mehr, fällt dieser Platzhalter weg – ein Text, den nur mindset.js kennt, wäre hier
    // geraten, und ein Schimmern ohne Ende wäre eine Ladeanzeige, die nichts mehr lädt.
    else if(wait&&wait.breath&&stlMindPending(s))chips.push({skel:true});
  }
  // --- Die zwei Einstiege, die auf schmalen Geräten sonst hinter der Tab-Leiste liegen ---
  // Auf der neuen Startseite IST der Ring der Ein-Tap-Einstieg für „Essen loggen" und „Check-in",
  // und auf 390 × 844 steht die Ringzeile im ersten Bild (gemessen y = 530…615, Falz 844).
  // Auf 320 × 568 nicht: dort liegt sie bei y = 587…673 – unter dem Falz (568) und komplett hinter
  // der Tab-Leiste (Oberkante 505). In 2.7.0 standen hier Chips bei y = 383 und y = 421, der
  // Einstieg war also da und ist mit 2.8.0 verloren gegangen. BUILD-A4 Abschnitt 3 ist an dieser
  // Stelle bindend, deshalb stehen beide unter 360 px wieder als Chip in der Jetzt-Karte.
  // `.hm-narrow` blendet sie ab 360 px aus (home.css) – dort bleibt der Ring der einzige Einstieg,
  // es entsteht keine zweite Stelle für dasselbe Thema (CRITIC K3). Kosten: keine. Die Zeile
  // scrollt unter 360 px, ihre Höhe hängt nicht an der Zahl der Chips.
  const nchips=[];
  if(s.own&&hmNew()){
    if(used!=='food'&&!s.gFood)nchips.push({l:foodCta.l,fn:foodCta.fn,ic:'utensils',nar:true});
    if(used!=='checkin'&&!s.checkedIn)nchips.push({l:'Check-in',fn:'homeExpandCheckin()',ic:'pencil',nar:true});
  }
  // .wrap: die Kurzwege stehen umgebrochen alle sichtbar da – gescrollt war der letzte unerreichbar
  // (unter 360 px kehrt home.css das um, siehe oben).
  const rowChips=nchips.concat(chips.slice(0,maxChips));
  const chipRow=rowChips.length?`<div class="chip-row wrap mt-3${chips.length?'':' hm-narrow'}">${rowChips.map(c=>
    c.skel?`<span class="chip stl-wait" aria-hidden="true" style="width:150px;background:linear-gradient(90deg,var(--surface3) 25%,var(--surface4) 50%,var(--surface3) 75%);background-size:200% 100%;animation:sk 1.2s linear infinite"></span>`
    :`<button class="chip soft on${c.nar?' hm-narrow':''}" onclick="${c.fn}">${icon(c.ic,16)}${esc2(c.l)}</button>`).join('')}</div>`:'';

  // --- Bereitschaft: EINE Zeile, direkt unter dem Tagtyp ---
  const ready=homeReadyHTML(s);

  // --- Widerspruch zum Trainings-Tab auflösen (B10) ---
  // Wer an einem Ruhe- oder Krankheitstag Sätze einträgt, las bis 2.4.0 auf der Startseite „Ruhetag" und
  // im Trainings-Tab im selben Moment „Lower 1 · 7/27 Sätze". Die Startseite verschweigt den Stand nicht
  // mehr; geändert wird der Tag weiter oben mit „Tag ändern".
  const trainNote=(s.own&&!s.isTrain&&s.doneSets>0)
    ? `<div class="note status mt-3">Heute ${pl(s.doneSets,'Satz','Sätze')} eingetragen – dein Tag steht trotzdem auf „${esc2(dayName)}". Passt das nicht, ändere ihn oben.</div>`
    : '';

  // --- Rückkehr nach ≥ 3 Tagen ohne Check-in ---
  // NACHBESSERUNG 2.8.0 (Befund „Startseite < 1.000 px gilt nur für einen Kontostand"): das hier war
  // bis eben eine `.note warn` über zwei Zeilen – 81 px plus 12 px Abstand, gemessen am laufenden
  // Server. Sie war der ganze Unterschied zwischen 975 px (Regelfall) und 1.092 px (fünf Tage Pause).
  // Zwei Dinge sind daran falsch gewesen:
  //  · Sie sagte „die Tage davor kannst du nachtragen" – und ließ den Leser damit allein. Der Weg
  //    dorthin (`openBulkCheckin()`) stand nirgends in dieser Karte. Jetzt IST die Zeile dieser Weg.
  //  · In genau dem Zustand, in dem sie erscheint, sagt die Bereitschaftszeile dasselbe noch einmal
  //    („Noch keine Daten – trag Schlaf ein"): ohne Check-ins hat die Bereitschaft keine Zahl. Zwei
  //    Zeilen, eine Aussage – das ist die Doppelung, die CRITIC K3 zu entfernen verlangt, und sie
  //    kostete 165 px in der Karte eines Menschen, der gerade zurückkommt.
  // Kein Wort über eine „gerettete Serie": die vergangenen Tage sind offen und lassen sich nachtragen (E6/D18).
  let comeback='';
  if(s.own&&s.cis.length){
    const since=Math.floor((Date.parse(s.tdy+'T00:00:00Z')-Date.parse(s.cis[0].date+'T00:00:00Z'))/864e5);
    if(since>=3){
      // 2.9.0 (A-V.3): Der Ton folgt jetzt der Wiederkehr-Leiter (3 · 5 · 10 · 14 · 30 Tage) statt
      // einem Satz für jede Pause. Ohne Schuldton, ohne „deine Serie reißt" – die Sprossen und ihre
      // Begründung stehen in src/logic.js (reminderLadder), die Worte hier in lpComebackWords().
      const cw=lpComebackWords(since);
      comeback=`<button class="rdy hm-cb" onclick="openBulkCheckin()" aria-label="${esc2(cw.main)} – ${esc2(cw.sub)}. Mehrere Tage nachtragen">
        <span class="rdy-n tone-amber">${icon('calendar',22)}</span>
        <span class="rdy-tx"><b>${esc2(cw.main)}</b><small>${esc2(cw.sub)}</small></span>
        <span class="rdy-go">${icon('chevronRight',16)}</span></button>`;}}

  // --- 7-Tage-Streifen: NUR NOCH IM KLASSISCHEN PFAD ---
  // ENTSCHEIDUNG DER WELLENLEITUNG (Befund B2). Zwei Abnahmezeilen aus BUILD-A4 Abschnitt 9 schlossen
  // sich aus: „Home < 1.000 px" und „0 Ziele < 44 px". Gemessen am laufenden Server: 987 px mit
  // 32-px-Chips, 1.011 px, sobald die Chips ihre echten 44 px bekommen (`fixw-vorher.json` /
  // `fixw-inj44.json`, beide 390 × 844). Die 44 px sind nicht verhandelbar – die vermeintliche
  // Trefferflächen-Erweiterung `::before{inset:-6px -3px}` erzeugte gar kein Pseudo-Element
  // (`content` war `none`, seit A-IV.5 `.chip::before` aus app.css entfernt hat), die Chips waren
  // also wirklich 32 px, und einer davon ist der erste Tap des Priming-Flusses.
  // Also wird der Konflikt entschieden statt weggemessen: von den zwei Chip-Zeilen der Jetzt-Karte
  // fällt die Rhythmus-Zeile weg. Ihr erster Chip trug wörtlich denselben Text wie die Überschrift
  // 42 px darüber („Heute · Probe-Tag" gegen „Probe-Tag") und rief dieselbe Funktion auf
  // (`openDayPicker()`) – genau die Doppelung, die CRITIC K3 zu entfernen verlangt. Die Zeile, die
  // bleibt, trägt dafür Handlungen, die es sonst nirgends in einem Tap gibt (Priming, Mahlzeit
  // abhaken), und sie steht im Tap-Veto.
  // Kein Einstieg geht verloren, aber einer wird länger: die sechs Folgetage öffnet jetzt der Chip
  // „Kalender" in der Mehr-Zeile (1 Tap) plus der Tag darin (1 Tap) statt eines einzigen Chips.
  // Das steht so in DEFER-A4.md; kein Fluss aus `tapcount.mjs` führt über den Streifen.
  // Der klassische Pfad (BUILD-A4 3.7) ist wortwörtlich 2.7.0 und behält den Streifen deshalb.
  // role="list"/"listitem" ist hier weg: es überschrieb die Knopf-Rolle der Chips (RATE-shell-home M7).
  let strip='';
  // Dieselbe Bedingung wie in renderHome (`hmNew()&&s.own`) – der Coach-Blick auf einen Athleten
  // zeichnet die klassische Reihenfolge und behält den Streifen.
  const pv=(hmNew()&&s.own)?[]:((s.T&&s.T.preview)||[]);
  if(pv.length){
    const base=s.T?.date?new Date(s.T.date+'T00:00:00'):new Date();
    strip=`<div class="chip-row rhythm mt-3">`+pv.slice(0,7).map((p,i)=>{
      const dt=new Date(base);dt.setDate(base.getDate()+i);
      const tr=p.type==='train';
      // Heute führt derselbe Weg wie „Tag ändern"; jeder andere Chip öffnet genau seinen Tag.
      const fn=(i===0)?'openDayPicker()':`shOpenRhythmDay('${fmt(dt)}')`;
      return `<button class="chip${i===0?' on':(tr?'':' rest')}" onclick="${fn}">${esc2(shChipLabel(p,i,dt))}</button>`;
    }).join('')+'</div>';}

  // Der Tagesname IST der Knopf (2.8.0). Bis 2.7.0 stand rechts oben ein roter Ghost-Button
  // „Tag ändern", der aussah wie Text und kaum von der Eyebrow zu unterscheiden war
  // (RATE-shell-home M8) – und der die Kopfzeile auf 44 px aufblies, ohne etwas zu sagen, was der
  // Tagesname nicht schon sagt. Jetzt trägt der Tagesname das Chevron: was man ändert, tippt man
  // auch an. Der Weg bleibt gleich lang (2 Taps: Name → Zeile), die Karte wird 23 px kürzer.
  const dayHead=s.own
    ? `<button class="daytype dt-b" onclick="openDayPicker()" aria-label="Heute: ${esc2(dayName)}. Tag ändern">${esc2(dayName)}${icon('chevronRight',20)}</button>`
    : `<div class="daytype">${esc2(dayName)}</div>`;

  // Rückkehr-Zeile UND zahllose Bereitschaftszeile zugleich: das wäre zweimal derselbe Satz. In diesem
  // Zustand steht nur die Rückkehr-Zeile – sie trägt dieselbe Aussage („von dir liegt gerade nichts
  // vor"), nennt die Zahl der Tage und führt mit einem Tipp dorthin, wo sich das ändern lässt.
  // Entfernt wird eine Doppelung, kein Einstieg: das Bereitschafts-Sheet hat in genau diesem Zustand
  // selbst keine Zahl („Noch keine Daten"), und es bleibt vom Trainings-Tab (`trainReadyHTML`), aus der
  // Analyse („Details") und aus der Suche erreichbar – gemessen, siehe FIX-A4-A-IV.1.md.
  // Sobald die Bereitschaft eine Zahl hat, bleiben beide Zeilen stehen: dann sagen sie Verschiedenes.
  // Krank gemeldet (`ready` = Krankheitssatz) bleibt ebenfalls unberührt.
  const rdyOhneZahl=!s.isSick&&(!s.readiness||s.readiness.needsHealth||s.readiness.score==null);
  const readyOut=(comeback&&rdyOhneZahl)?'':ready;
  return `<div class="today" id="homeNow">
    <div class="eyebrow">${eyebrow}</div>
    ${dayHead}
    ${meta?`<div class="meta">${esc2(meta)}</div>`:''}
    ${readyOut}
    ${trainNote}
    ${comeback}
    ${cta?`<button class="${ctaCls} mt-4" onclick="${cta.fn}">${esc2(cta.l)}</button>`:''}
    ${chipRow}${strip}
  </div>`;}

// ===== B-I.5 · KALIBRIERZUSTAND UND DIVERGENZ =====
// Zwei Lücken der Bereitschaft, beide aus RESEARCH-25-einsichten. Sie stehen hier und nicht in
// analysis.js, weil home.js im Kernbündel liegt: das Bereitschafts-Sheet (openReadiness) und die
// Analyse sollen dieselbe Rechnung benutzen, und die Analyse wird erst nachgeladen.
//
//  1. KALIBRIERUNG. Bis 2.9.0 kannte die Anzeige zwei Zustände: eine Zahl oder „Noch keine Daten".
//     Dazwischen fehlte der ehrliche dritte – eine Zahl aus zwei Nächten IST eine erfundene Zahl.
//     Jeder große Hersteller zeigt dort den Kalibrierzustand statt eines Werts: Apple „Wear your Apple
//     Watch to sleep for 7 days to establish your typical range" [Q13], Fitbit „7 nights of sleep"
//     [Q16], WHOOP führt dafür ein eigenes Feld `user_calibrating` [Q8b] (Muster M7). Sieben Nächte
//     sind damit die Zahl, auf die sich zwei unabhängige Hersteller unabhängig voneinander festgelegt
//     haben – wir nehmen dieselbe, statt eine eigene zu erfinden.
//  2. DIVERGENZ. Laufen Messwerte und Selbstbericht auseinander, ist genau DAS die Einsicht und kein
//     Fehler: selbstberichteter Stress und Nervosität hängen nicht mit der nächtlichen HRV zusammen
//     (p = 0,63 bzw. 0,41; Ungaro et al. 2026 [Q54]), Muskelkater nicht mit der RMSSD [Q55]. Ein
//     System, das beides zu einer Zahl verrechnet, vernichtet diese Information (Muster M10c).
//     Gemeldet wird nach der Zwei-von-N-Regel (M6, Apple Vitals [Q13]): ein einzelner Wert außerhalb
//     des eigenen Bereichs ist Rauschen, zwei sind eine Aussage. Und weil ein Alarm Angst und
//     Arztkontakte erzeugt [Q34], nennt die Meldung immer mögliche Ursachen – als ANGEBOT, nie als
//     Diagnose.
// Beide Funktionen nehmen bevorzugt, was der Server mitschickt (`readiness.calibration` bzw.
// `readiness.divergence` aus den Paketen B-I.1/B-I.2), und rechnen sonst aus den Zahlen, die die
// Ansicht ohnehin geladen hat. Liefert weder Server noch Ansicht etwas, ist das Ergebnis null – dann
// bleibt die Anzeige exakt so, wie sie vorher war.

// Der eigene Bereich: die mittlere Hälfte der eigenen Werte (25.–75. Perzentil), nicht eine Norm und
// nicht ein Ziel. Perzentile statt Mittelwert ± Streuung, weil ein einzelner Ausreißer den Bereich
// sonst wochenlang verschiebt – genau daran scheitert WHOOP in der zitierten Nutzerkritik (M10b,
// [Q58]). Unter fünf Werten wird kein Bereich behauptet.
// Diese Fassung ist die EINE: `an2Band()` in analysis.js reicht seit B-I.5 hierher durch, damit
// Kachel, Diagrammband und Divergenz nicht drei Bereiche für dieselbe Kennzahl kennen (CRITIC K1).
function wk2Band(vals,minN){const xs=(vals||[]).map(Number).filter(v=>v!=null&&isFinite(v)).sort((a,b)=>a-b);
  if(xs.length<(minN||5))return null;
  const q=p=>{const i=(xs.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return xs[lo]+(xs[hi]-xs[lo])*(i-lo);};
  const b={lo:q(.25),hi:q(.75),med:q(.5),n:xs.length};
  return (b.hi-b.lo)>0?b:null;}
function wk2DayDiff(a,b){return Math.round((Date.parse(a+'T00:00:00')-Date.parse(b+'T00:00:00'))/864e5);}

// --- 1. Kalibrierung ---------------------------------------------------------------------------
const WK2_CAL_NIGHTS=7;   // Apple/Fitbit: sieben Nächte bis zur eigenen Baseline [Q13][Q16]
// Fenster, in dem sie zusammenkommen dürfen. 14 Tage sind nicht gegriffen, sondern das Fenster, mit
// dem der Server ohnehin rechnet: `readinessView` bildet die Basis jedes Teilwerts als MEDIAN DER
// 14 TAGE VOR DEM STICHTAG (server.js, `median(field, day)`) und braucht dafür fünf Werte. Wer
// zwei Wochen nichts eingetragen hat, hat serverseitig also wirklich keine Baseline mehr – und
// nicht nur „hier oben zählt jemand zu kurz". Oura zählt aus demselben Grund „7 aus 14" [Q3].
const WK2_CAL_WIN=14;
// Wie viele Nächte mit einem Erholungswert liegen im Fenster? Gezählt werden TAGE, nicht Einträge:
// zwei Werte an einem Tag sind eine Nacht.
function wk2CalibNights(rows,to){const end=to||today(),days=new Set();
  (rows||[]).forEach(c=>{if(!c||!c.date)return;const d=wk2DayDiff(end,c.date);
    if(d<0||d>=WK2_CAL_WIN)return;
    if(c.sleep!=null||c.hrv!=null||c.resting_hr!=null)days.add(c.date);});
  return days.size;}
// {ready, have, need, left, why} – oder null, wenn sich nichts sagen lässt.
// `why` ist der Satz, woher die Zahl kommt (Prinzip P3); er steht in der Oberfläche als Kleingedrucktes.
// Feldnamen bewusst nach `calibrationState` aus src/logic.js (Paket B-I.1): `nights`, `needed`,
// `remaining`, `ready`, `label`, `text`. Sobald eine Route diesen Block mitschickt, gewinnen seine
// Zahlen UND seine Sätze – dann steht auf jedem Bildschirm derselbe Wortlaut, und diese Datei muss
// dafür nicht angefasst werden. Bis dahin rechnet der Zweig darunter dasselbe aus den Check-ins.
function wk2Calib(R,rows,to){
  const C=R&&R.calibration;
  let have=null,need=WK2_CAL_NIGHTS,why='',label='',text='';
  if(C&&typeof C==='object'){
    const n=+(C.nights!=null?C.nights:C.have);
    if(isFinite(n)&&n>=0){have=n;
      need=+(C.needed!=null?C.needed:C.need)>0?+(C.needed!=null?C.needed:C.need):WK2_CAL_NIGHTS;
      why=String(C.why||'');label=String(C.label||'');text=String(C.text||'');}
    if(C.ready===true)return {ready:true,have:have,need:need,left:0,why:why,label:label,text:text};}
  if(have==null){if(!Array.isArray(rows))return null;have=wk2CalibNights(rows,to);}
  if(!why)why=`gezählt werden die Tage der letzten ${fmtNum(WK2_CAL_WIN)} mit Schlaf-, HRV- oder Ruhepuls-Wert`;
  const left=(C&&C.remaining!=null&&isFinite(+C.remaining))?Math.max(0,+C.remaining):Math.max(0,need-have);
  return {ready:left<=0,have:have,need:need,left:left,why:why,label:label,text:text};}
// Die eine Formulierung für alle drei Anzeigeorte (Startseite, Analyse-Kachel, Sheet).
// „Kalibriert – noch 4 Nächte" ist bewusst Fortschritt und keine Absage: der Hinweis IST das Onboarding.
// Genau derselbe Wortlaut wie das `label` von calibrationState in src/logic.js – geprüft, nicht geraten.
function wk2CalibText(cal){if(!cal||cal.ready||!(cal.left>0))return '';
  return cal.label||`Kalibriert – noch ${pl(cal.left,'Nacht','Nächte')}`;}
function wk2CalibWhy(cal){if(!cal||cal.ready)return '';
  return cal.text||`${fmtNum(cal.have)} von ${fmtNum(cal.need)} Nächten sind da (${cal.why}). Ohne diese Grundlage hätte eine Zahl nichts, womit sie sich vergleichen könnte.`;}
// Was in der Zwischenzeit steuert. Im Coach-Blick ohne „dein": der Satz gilt dem Athleten, gelesen
// wird er vom Coach – derselbe Grund, aus dem die Bereitschaftszeile dort ihre Handlungsanweisung
// zurücknimmt (RATE-25-coach 11).
function wk2CalibSteer(lower){const s=(typeof coachView==='function'&&coachView())
  ?'Bis dahin steuert der Check-in.':'Bis dahin steuert dein Check-in.';
  return lower?s.charAt(0).toLowerCase()+s.slice(1):s;}

// --- 2. Divergenz ------------------------------------------------------------------------------
const WK2_DIV_DAYS=3;     // so viele Tage am Stück muss der Selbstbericht tief liegen, bevor es zählt
const WK2_DIV_WIN=28;     // Fenster, aus dem der eigene Bereich kommt
// Ursachen-ANGEBOT, kein Befund. Wortlaut nach Apple Vitals, das bei einer Auffälligkeit mögliche
// Gründe nennt statt einer Diagnose („elevation changes, alcohol consumption, or even illness", [Q13]).
const WK2_DIV_CAUSE_SELF='Das spricht eher für Kopf als für Körper – Stress, Schlafrhythmus, Alkohol oder ein beginnender Infekt kommen infrage. Dein Körper meldet nichts.';
const WK2_DIV_CAUSE_METR='Dein Gefühl sagt nichts davon – späte Einheit, Alkohol, warmes Zimmer oder ein Infekt im Anmarsch sind die üblichen Gründe.';
// Fällt der Selbstbericht? {days, base, last} oder null.
// Maßstab ist der MEDIAN der Tage VOR dem letzten Wochenfenster, nicht ein Perzentil-Band: Ein
// Selbstbericht auf einer 1–10-Skala ist oft über Wochen dieselbe Zahl (gemessen am Testkonto:
// 16 von 21 Tagen der Wert 7). Ein 25.–75.-Perzentil ist dann null Punkte breit und taugt als
// Schwelle nicht – der Median dagegen bleibt aussagekräftig und ist gegen Ausreißer genauso
// unempfindlich (M10b). „Tiefer" heißt mindestens einen vollen Punkt unter diesem Median: ein
// halber Punkt Tagesform ist keine Nachricht.
// Gezählt werden nur wirklich aufeinanderfolgende Kalendertage – sonst stünde „seit 5 Tagen" über
// fünf Werten aus drei Wochen (derselbe Fehler, den Befund M8 für die Durchschnitte beschreibt).
const WK2_DIV_RECENT=7,WK2_DIV_MARGIN=1;
function wk2Median(xs){const a=(xs||[]).slice().sort((x,y)=>x-y);if(!a.length)return null;
  const m=(a.length-1)/2;return (a[Math.floor(m)]+a[Math.ceil(m)])/2;}
function wk2SelfDrop(self,to){const end=to||today();
  if(!self||self.length<10)return null;
  const base=wk2Median(self.filter(s=>wk2DayDiff(end,s.date)>=WK2_DIV_RECENT).map(s=>s.value));
  if(base==null||self.filter(s=>wk2DayDiff(end,s.date)>=WK2_DIV_RECENT).length<5)return null;
  const lim=base-WK2_DIV_MARGIN;let n=0;
  for(let i=self.length-1;i>=0;i--){if(!(self[i].value<lim))break;
    if(n&&wk2DayDiff(self[i+1].date,self[i].date)!==1)break;n++;}
  return n?{days:n,base:base,last:self[self.length-1].value}:null;}
// Wie viele Messwerte liegen HEUTE außerhalb des eigenen Bereichs? (Zwei-von-N-Regel, M6)
// Ruhepuls zählt nur nach oben, HRV und Schlaf nur nach unten – ein hoher HRV-Wert ist kein Alarm.
const WK2_DIV_METRICS=[['hrv','deine HRV','low'],['resting_hr','dein Ruhepuls','high'],['sleep','dein Schlaf','low']];
function wk2MetricsOff(rows,to){const end=to||today();const out=[];
  WK2_DIV_METRICS.forEach(([k,label,dir])=>{
    const win=(rows||[]).filter(c=>c&&c.date&&c[k]!=null&&+c[k]>0&&wk2DayDiff(end,c.date)>=0&&wk2DayDiff(end,c.date)<WK2_DIV_WIN);
    if(win.length<6)return;                       // 5 für den Bereich + der Tageswert selbst
    const last=win.slice().sort((a,b)=>a.date<b.date?1:-1)[0];
    if(!last||wk2DayDiff(end,last.date)>1)return; // ein drei Tage alter Wert ist keine Aussage über heute
    const band=wk2Band(win.filter(c=>c.date!==last.date).map(c=>+c[k]));
    if(!band)return;
    const v=+last[k];
    if(dir==='low'?v<band.lo:v>band.hi)out.push(label);});
  return out;}
// {kind:'self'|'metrics', text, cause, days} – oder null.
// o.rows = Check-ins (Messwerte), o.self = Selbstbericht als [{date,value}] aufsteigend.
function wk2Diverge(R,o){o=o||{};
  // Feldnamen nach `divergence` aus src/logic.js (Paket B-I.1): `state`, `alert`, `headline`,
  // `why`, `text`, `causes`. `alert === false` heißt dort ausdrücklich „das ist noch keine Meldung"
  // (ein einzelner Ausreißer, ein einzelner schlechter Check-in-Tag) – dann zeigt die Oberfläche
  // auch nichts. Sonst wäre die Zwei-von-N-Regel im Rechenkern und die Meldung trotzdem im Bild.
  const D=R&&R.divergence;
  if(D&&typeof D==='object'&&(D.headline||D.text)){
    if(D.alert===false||D.state==='ruhig')return null;
    return {kind:D.state||D.kind||'self',text:String(D.headline||D.text),
      cause:String(D.text&&D.headline?D.text:(D.cause||(Array.isArray(D.causes)?D.causes.join(', '):''))),
      why:String(D.why||''),days:+(D.selfDays!=null?D.selfDays:D.days)||0};}
  const rows=o.rows,self=(o.self||[]).filter(s=>s&&s.date&&s.value!=null&&isFinite(+s.value))
    .map(s=>({date:s.date,value:+s.value})).sort((a,b)=>a.date<b.date?-1:1);
  if(!Array.isArray(rows))return null;
  const off=wk2MetricsOff(rows,o.to),drop=wk2SelfDrop(self,o.to);
  // Fall A (der Fall aus dem Auftrag): Werte unauffällig, Selbstbericht fällt seit Tagen.
  if(off.length<2&&drop&&drop.days>=WK2_DIV_DAYS)return {kind:'self',days:drop.days,
    text:`Deine Werte sind unauffällig, dein Selbstbericht fällt seit ${pl(drop.days,'Tag','Tagen')}.`,
    cause:WK2_DIV_CAUSE_SELF,
    why:`Selbstbericht = die Energie, die du selbst einträgst: zuletzt ${fmtNum(drop.last,Number.isInteger(drop.last)?0:1)} von 10, üblich sind bei dir ${fmtNum(drop.base,Number.isInteger(drop.base)?0:1)}.`};
  // Fall B (der Spiegel): zwei Messwerte außerhalb, das Gefühl sagt nichts.
  if(off.length>=2&&!drop)return {kind:'metrics',days:0,
    text:`${off.slice(0,2).join(' und ')} liegen außerhalb deines üblichen Bereichs${self.length?', dein Selbstbericht nicht':''}.`,
    cause:WK2_DIV_CAUSE_METR,
    why:'Der übliche Bereich ist die mittlere Hälfte deiner eigenen Werte der letzten vier Wochen.'};
  return null;}
// Die Meldung als Kasten – eine Aussage, ein Ursachenangebot, nie eine Diagnose.
// Die Meldung als Kasten: Aussage · Ursachenangebot · woher die Zahl kommt (P3).
function wk2DivHTML(dv,cls){if(!dv||!dv.text)return '';
  return `<div class="wk2-div ${cls||''}">${icon('info',16)}<div><b>${esc2(dv.text)}</b>${dv.cause?`<br>${esc2(dv.cause)}`:''}${dv.why?`<br><span class="wk2-why">${esc2(dv.why)}</span>`:''}</div></div>`;}
// Selbstbericht-Reihe aus den Mindset-Sitzungen: Energie des Tages, ersatzweise die Stimmung (1–10).
// Beides trägt der Athlet selbst ein (Abendreflexion, Priming) – es ist der einzige echte
// Selbstbericht, den die App heute führt. Ohne Mindset-Nutzung bleibt die Reihe leer, und
// wk2Diverge() sagt dann nichts: eine Divergenz ohne Selbstbericht gibt es nicht.
// Einmal je Nutzer gemerkt: das Bereitschafts-Sheet und die Analyse fragen dieselbe Reihe, und ein
// zweites Öffnen soll nicht ein zweites Mal warten.
// Nach WK2_SELF_TTL wird neu geholt: Wer nach der Abendreflexion noch einmal nachsieht, soll seinen
// eigenen Eintrag darin wiederfinden und nicht den Stand von vor einer Stunde.
const WK2_SELF_TTL=5*60*1000;
let WK2_SELF={uid:null,list:null,at:0};
function wk2SelfCached(uid){return (WK2_SELF.uid===uid&&Array.isArray(WK2_SELF.list)&&(Date.now()-WK2_SELF.at)<WK2_SELF_TTL)?WK2_SELF.list:null;}
async function wk2SelfSeries(uid,days){
  const hit=wk2SelfCached(uid);if(hit)return hit;
  try{const r=await API.get('/mindset/sessions/'+uid+'?days='+(days||21));
    if(r.status!==200||!r.data||!r.data.byDay)return [];
    const list=Object.keys(r.data.byDay).sort().map(d=>{const x=r.data.byDay[d]||{};
      const v=(x.energy!=null)?x.energy:(x.mood!=null?x.mood:null);
      return v==null?null:{date:d,value:+v};}).filter(Boolean);
    WK2_SELF={uid:uid,list:list,at:Date.now()};
    return list;}
  catch(e){return [];}}

// ===== BEREITSCHAFT =====
// Zahl, Wort, ein Satz – mehr steht auf der Startseite nicht. Die Zeile ist tippbar (Teilwerte + Verlauf
// im Sheet) und bleibt bewusst eine Zeile: die Jetzt-Karte soll durch sie nicht zum Block werden.
// Kein zweiter roter Knopf – die Regel „genau EIN roter Button" gilt weiter.
// _readyTone nimmt den Ton des Servers ODER eine Zahl (Teilwerte tragen keinen eigenen Ton).
function _readyTone(t){if(typeof t==='number')t=t>=60?'green':t>=40?'amber':'red';
  return t==='green'?'tone-green':t==='amber'?'tone-amber':t==='red'?'tone-red':'muted';}
// Steht die Zahl auf einer EINZIGEN Quelle (typisch: Schlaf von Hand, keine Uhr), liefert _readySolo
// den Namen dieser Quelle, sonst ''. Der Server dämpft so eine Zahl bereits zur Mitte hin (readinessScore,
// Feld `thin`) – die Oberfläche muss dazusagen, WORAUS geschätzt wurde. Eine gedämpfte Schätzung darf
// sich nicht wie eine Messung präsentieren. Ältere Antworten (und das Home-Aggregat, solange es das Feld
// nicht durchreicht) kennen `thin` nicht: dann zählen wir die Teilwerte selbst – dieselbe Bedingung.
function _readySolo(R){if(!R)return '';
  const ps=(R.parts||[]).filter(p=>p&&p.label);
  if(!ps.length||!((R.thin!=null)?!!R.thin:ps.length===1))return '';
  return {sleep:'deinem Schlaf',hrv:'deiner HRV',rhr:'deinem Ruhepuls',load:'deiner Trainingslast'}[ps[0].key]||ps[0].label;}
function homeReadyHTML(s){
  s=s||homeState();const R=s.readiness;
  // Krank gemeldet: kein Wert, kein Ratschlag – „Bereitschaft 75 · Zieh deinen Plan wie er steht durch."
  // stand bis 2.4.0 direkt unter „Krank gemeldet" (RATE-shell-home M2, B10).
  if(s.isSick)return s.own?shSickHTML():'';
  if(!R)return '';
  // Ohne Uhr-Werte hat eine Zahl keine Grundlage – dann steht hier der Weg zu den Gesundheitsdaten.
  // Im Coach-Blick entfällt die Zeile: verbinden kann sie nur der Athlet selbst.
  if(R.needsHealth)return !s.own?'':`<button class="rdy" onclick="typeof openIntegrations==='function'?openIntegrations():go('tracker')">
      <span class="rdy-n muted">${icon('zap',22)}</span>
      <span class="rdy-tx"><b>Bereitschaft</b><small>Verbinde deine Gesundheitsdaten – dann steht hier deine Einschätzung.</small></span>
      <span class="rdy-go">${icon('chevronRight',16)}</span></button>`;
  // Kein einziger Erholungswert (Schlaf, HRV, Ruhepuls): der Rechenkern liefert seit 2.5.0 score:null
  // statt einer aus der Trainingslast allein gebauten 94 (D5). Hier steht dann der Weg zu den Daten.
  if(R.score==null)return !s.own?'':`<button class="rdy" onclick="openReadiness()" aria-label="Bereitschaft – noch keine Daten. Details anzeigen">
      <span class="rdy-n muted">${icon('zap',22)}</span>
      <span class="rdy-tx"><b>Bereitschaft</b><small>Noch keine Daten – trag Schlaf ein oder verbinde deine Uhr.</small></span>
      <span class="rdy-go">${icon('chevronRight',16)}</span></button>`;
  // Eine Kennzahl, dieselbe Lesereihenfolge wie über der Übungsliste im Trainings-Tab (trainReadyHTML):
  // erst die Zahl, dann „Bereitschaft · <Wort>", darunter der Satz. Die Zeichenketten sind aber NICHT
  // identisch: dort steht die Zahl mitten im fetten Text („Bereitschaft 74 · Solide"), hier links im
  // eigenen Feld .rdy-n – deshalb fehlt sie im Text. Zusammengesetzt liest sie nur das aria-label vor.
  // Bricht die fette Zeile auf 320 px um, ist das in Ordnung: .rdy-tx b darf umbrechen, abgeschnitten
  // wird nichts.
  // Steht die Zahl auf einer einzigen Quelle, tritt die Handlungsempfehlung zurück: sie wäre eine
  // Ansage, die die Datenlage nicht hergibt. Stattdessen steht dort, woraus geschätzt wurde; der Weg zu
  // „Gesundheitsdaten verbinden" liegt einen Tipp weiter im Sheet (die Zeile ist ein einziger Knopf,
  // ein zweiter darin wäre nicht bedienbar).
  // Im Coach-Blick bleibt die Zahl, die Handlungsanweisung nicht: „Zieh deinen Plan wie er steht durch."
  // ist an den Athleten gerichtet und las sich im Coach-Kontext wie eine Ansage an den Coach
  // (RATE-coach 11, Beistellung an A-I.6).
  // B-I.5: Der dritte Zustand zwischen „Noch keine Daten" und einer Zahl. Liegen weniger als sieben
  // Nächte vor, steht hier der Kalibrierzustand STATT der Zahl – eine Zahl aus drei Nächten hat keine
  // Baseline, gegen die sie sich vergleichen könnte, und wäre damit erfunden (M7, [Q13][Q16][Q8b]).
  // Die Zeile bleibt in Bauform und Höhe dieselbe wie die beiden Zustände darüber: Symbol, eine fette
  // Zeile, ein Satz. Der Coach sieht sie auch – „warum steht da keine Zahl" ist seine Frage genauso.
  const cal=(typeof wk2Calib==='function')?wk2Calib(R,s.cis):null;
  if(cal&&!cal.ready&&cal.have>0)return `<button class="rdy" onclick="openReadiness()" aria-label="Bereitschaft – ${esc2(wk2CalibText(cal))}. Details anzeigen">
      <span class="rdy-n muted">${icon('zap',22)}</span>
      <span class="rdy-tx"><b>Bereitschaft · Kalibriert</b><small>Noch ${pl(cal.left,'Nacht','Nächte')} – ${esc2(wk2CalibSteer(1))}</small></span>
      <span class="rdy-go">${icon('chevronRight',16)}</span></button>`;
  const solo=_readySolo(R);
  const sub=!s.own?''
    :solo?`<small>Geschätzt aus ${esc2(solo)} – für eine belastbare Einschätzung fehlen noch Werte.</small>`
    :(R.headline?`<small>${esc2(R.headline)}</small>`:'');
  return `<button class="rdy" onclick="openReadiness()" aria-label="Bereitschaft ${fmtNum(R.score)}${esc2(R.label?' · '+R.label:'')}. Details anzeigen">
      <span class="rdy-n ${_readyTone(R.tone)}">${fmtNum(R.score)}</span>
      <span class="rdy-tx"><b>Bereitschaft${R.label?' · '+esc2(R.label):''}</b>${sub}</span>
      <span class="rdy-go">${icon('chevronRight',16)}</span></button>`;}
// Detail-Sheet: Gesamtwert, die Teilwerte als Zeilen, der 14-Tage-Verlauf und der Hinweis, was das NICHT ist.
// Den Verlauf liefert nur GET /readiness – das Home-Aggregat spart ihn bewusst (eine Anfrage weniger beim Start).
async function openReadiness(){
  openSheet('Bereitschaft','<div class="spinner"></div>',{size:'tall'});
  let R=null;
  // Derselbe Tageswechsel wie in loadHomeData: /readiness/<uid> ist tagesgebunden, sein Schnappschuss
  // trägt den Tag aber nicht im Schlüssel. Der Server schickt den gerechneten Tag mit (`date`) – weicht
  // er bei einem stale-Treffer vom heutigen ab, ist das die Bereitschaft von gestern und keine Aussage
  // über heute. Dann lieber der Notnagel darunter (das Aggregat ist tagesgeprüft) bzw. der ehrliche Satz.
  try{const r=await API.get('/readiness/'+(VIEW_USER||ME.id));
    if(r.status===200&&r.data&&!(r.stale&&r.data.date&&r.data.date!==today()))R=r.data;}
  catch(e){console.error('[home] Bereitschaft',e);}
  if(!R){try{R=homeState().readiness;}catch(e){}}   // Notnagel: der Stand aus dem Aggregat, dann eben ohne Verlauf
  if(!R){openSheet('Bereitschaft','<div class="note err">Die Bereitschaft ist gerade nicht erreichbar.</div>',{size:'tall'});return;}
  // Zweiter Satz: E24 – er muss zur Rechnung passen. Seit 2.5.0 zählt Cardio in Satz-Äquivalenten in
  // die Last der Bereitschaft (server.js `readinessView`, CARDIO_SET_EQ: leicht 0,07 · moderat 0,15 ·
  // hart 0,3 je Minute, also rund 4,5 / 9 / 18 Sätze je Stunde). Der alte Satz („zählt nicht für die
  // Bereitschaft") war damit falsch. Statt nur „zählt mit" steht hier die Größenordnung – sonst rätselt
  // der Nutzer, warum eine harte Cardio-Stunde seine Bereitschaft drückt.
  const CAP='<div class="caption mt-3">Das ist eine Einschätzung aus deinen Zahlen, keine medizinische Bewertung. Cardio zählt mit – eine harte Stunde wiegt rund 18 Sätze.</div>';
  // Ohne eine einzige Erholungsmessung gibt es nichts einzuschätzen (D5) – dann nennt das Sheet die zwei
  // Wege zu echten Werten, statt eine Zahl zu erklären, die es nicht gibt.
  if(R.score==null&&!R.needsHealth){
    openSheet('Bereitschaft',`<div class="note status mb-3"><b>Noch keine Daten</b><br>Für eine Einschätzung fehlen Schlaf, HRV oder Ruhepuls. Trag deinen Schlaf ein oder verbinde deine Uhr – dann steht hier eine Zahl, die etwas wert ist.</div>
      ${coachView()?'':`<button class="btn block mb-2" onclick="closeModal();homeExpandCheckin()">Schlaf eintragen</button>
      <button class="btn block sec" onclick="closeModal();typeof openIntegrations==='function'?openIntegrations():go('tracker')">Gesundheitsdaten verbinden</button>`}${CAP}`,{size:'tall'});
    return;}
  if(R.needsHealth){
    openSheet('Bereitschaft',`<div class="note mb-3">Für eine Einschätzung braucht es Schlaf, HRV oder Ruhepuls – die kommen von deiner Uhr.</div>
      ${coachView()?'':`<button class="btn block" onclick="closeModal();typeof openIntegrations==='function'?openIntegrations():go('tracker')">Gesundheitsdaten verbinden</button>`}${CAP}`,{size:'tall'});
    return;}
  // B-I.5: Zwei Dinge, die das Sheet bis 2.9.0 verschwieg – beide kosten keine Startseiten-Höhe,
  // weil sie hier drin stehen und nicht draußen.
  //  · Der Kalibrierzustand mit der Zahl dahinter („3 von 7 Nächten sind da"). Er ersetzt oben die
  //    Zahl; hier steht, warum, und wie viel noch fehlt.
  //  · Die Divergenz zwischen Messwerten und Selbstbericht. Der Selbstbericht kommt aus den
  //    Mindset-Sitzungen (Energie/Stimmung 1–10, vom Athleten selbst eingetragen). Fehlt er, sagt
  //    wk2Diverge() nichts – eine Divergenz ohne zweite Meinung gibt es nicht.
  // Der Selbstbericht wird NICHT abgewartet: Das Sheet soll aufgehen, sobald die Bereitschaft da ist.
  // Liegt die Reihe schon im Speicher (zweites Öffnen, oder die Analyse hat sie geholt), steht der
  // Hinweis sofort; sonst rutscht er nach, sobald die Antwort da ist – in den leeren Kasten, der
  // dafür schon an seiner Stelle steht.
  const rdyUid=VIEW_USER||ME.id;
  let cis=[];try{cis=homeState().cis||[];}catch(e){}
  const cal=wk2Calib(R,cis);
  const dv=wk2Diverge(R,{rows:cis,self:wk2SelfCached(rdyUid)||[]});
  if(!wk2SelfCached(rdyUid))wk2SelfSeries(rdyUid,21).then(list=>{
    const box=document.getElementById('wk2DivBox');if(!box)return;
    box.innerHTML=wk2DivHTML(wk2Diverge(R,{rows:cis,self:list||[]}),'mb-3');}).catch(e=>{});
  const col=R.tone==='green'?'var(--green)':R.tone==='amber'?'var(--amber)':R.tone==='red'?'var(--red)':'var(--ink3)';
  let h='';
  // Während der Kalibrierung bleiben Ring, Wort und Handlungsempfehlung weg. Nicht aus Vorsicht,
  // sondern weil beide auf einer Zahl ohne Baseline stehen: Die 5-Wochen-RCT mit manipulierten
  // Tracker-Zahlen zeigt, dass eine zu pessimistisch angezeigte Zahl Stimmung, Selbstwert, Ernährung,
  // Ruhepuls und Blutdruck verschlechtert, OHNE das Training zu ändern [Q56]. Ein roter Morgen ist
  // selbst eine Intervention [Q33] – dann lieber gar keiner. Weg sind Ring, Wort, Empfehlung UND der
  // 14-Tage-Verlauf: Der Verlauf besteht aus genau denselben ungedeckten Zahlen, ihn stehen zu lassen
  // hieße, sie durch die Hintertür doch zu zeigen. Die TEILWERTE bleiben – „Schlaf 7,1 h" ist
  // gemessen und nicht geschätzt, und sie sind der Weg, auf dem die Kalibrierung voll wird.
  const calibrating=!!(cal&&!cal.ready&&cal.have>0);
  if(calibrating)h+=`<div class="note status mb-3"><b>${esc2(wk2CalibText(cal))}</b><br>${esc2(wk2CalibWhy(cal))} ${esc2(wk2CalibSteer())}</div>`;
  // Das Wort steht UNTER dem Ring, nicht darin: _ringFit staucht den Innentext auf die Sehne des freien
  // Innenkreises – „Etwas zurücknehmen" landete dort bei 8,2 px und damit unter dem kleinsten Typo-Token (12 px).
  if(R.score!=null&&!calibrating)h+=`<div class="center mb-3">${ring(R.score/100,{size:112,color:col,label:fmtNum(R.score)})}
    ${R.label?`<div class="meta mt-1">${esc2(R.label)}</div>`:''}</div>`;
  if(!calibrating)h+=`<div class="note status mb-3"><b>${esc2(R.headline||R.label||'')}</b>${R.detail?`<br>${esc2(R.detail)}`:''}</div>`;
  // Der Divergenz-Hinweis steht direkt unter der Aussage, auf die er sich bezieht – er ist die
  // Einschränkung dazu, nicht eine eigene Kennzahl. Mit Ursachenangebot, nie als Diagnose.
  h+=`<div id="wk2DivBox">${wk2DivHTML(dv,'mb-3')}</div>`;
  // Eine Zahl aus einer einzigen Quelle wird hier benannt, nicht versteckt: sie ist gedämpft (deshalb
  // liegt sie nah an der Mitte) und bleibt eine Schätzung. Direkt darunter der Weg, der sie belastbar
  // macht – im Coach-Blick nicht, verbinden kann die Daten nur der Athlet selbst.
  // Während der Kalibrierung sagt dieser Kasten dasselbe wie der Kalibrier-Kasten darüber, nur
  // schwächer – und sein erstes Wort („Diese Zahl") zeigt auf eine Zahl, die gerade nicht dasteht.
  // Der Knopf darunter bleibt: er ist in beiden Fällen derselbe nächste Schritt.
  const solo=_readySolo(R);
  if(solo&&!calibrating)h+=`<div class="note mb-3">Diese Zahl ist nur aus ${esc2(solo)} geschätzt. Eine einzelne Quelle trägt nicht weit, deshalb bleibt die Einschätzung nah an der Mitte. Mit Schlaf, HRV und Ruhepuls aus deiner Uhr wird sie belastbar.</div>`;
  if(solo)h+=(coachView()?'':`<button class="btn sec block mb-3" onclick="closeModal();typeof openIntegrations==='function'?openIntegrations():go('tracker')">Gesundheitsdaten verbinden</button>`);
  const parts=(R.parts||[]).filter(p=>p&&p.label);
  if(parts.length)h+=`<div class="section-label"><span>Woraus sich das ergibt</span></div>
    <div class="rows mb-3">${parts.map(p=>`<div class="row"><div class="rl">${esc2(p.label)}
      <small>${esc2(p.text||'')}${p.weight?(p.text?' · ':'')+'zählt '+fmtNum(+p.weight*100)+' %':''}</small></div>
      <div class="rr"><b class="${p.score==null?'muted':_readyTone(+p.score)}">${fmtNum(p.score)}</b></div></div>`).join('')}</div>`;
  // Die Trainingslast steht bewusst nicht in derselben Aufzählung: sie entfällt auch dann, wenn jeder
  // einzelne Satz in der Datenbank steht – nämlich solange es kein „übliches" Pensum gibt (am Anfang und
  // nach einer Pause, siehe loadAvgOf im Server). „Dafür fehlen die Werte" wäre dort schlicht gelogen.
  const MISS={sleep:'Schlaf',hrv:'HRV',rhr:'Ruhepuls'};
  const mk=R.missing||[],miss=mk.map(k=>MISS[k]).filter(Boolean);
  // Ohne einen einzigen Teilwert wäre „Ohne … gerechnet" irreführend – gerechnet wurde dann gar nichts.
  // (nicht `cap` nennen – so heißt die globale Hilfsfunktion aus shell.js)
  let missTxt=miss.length?`Ohne ${miss.length>1?miss.slice(0,-1).join(', ')+' und '+miss[miss.length-1]:miss[0]} gerechnet – dafür fehlen die Werte.`:'';
  if(mk.includes('load'))missTxt+=(missTxt?' ':'')+'Die Trainingslast zählt erst mit, wenn ein paar regelmäßige Trainingswochen zusammengekommen sind.';
  if(missTxt&&R.score!=null)h+=`<div class="caption mb-3">${esc2(missTxt)}</div>`;
  const hist=(R.history||[]).filter(x=>x&&x.date&&x.score!=null).map(x=>({date:x.date,value:+x.score}));
  if(calibrating)h+=`<div class="caption mb-3">Der 14-Tage-Verlauf erscheint, sobald die Kalibrierung steht – er bestünde sonst aus genau den Zahlen, die noch keine Grundlage haben.</div>`;
  else if(hist.length)h+=`<div class="chart-card mb-3"><div class="ch-h"><div class="t">Letzte 14 Tage</div><div class="v">Punkte</div></div>
    ${metricChart(hist,'Punkte',null,null,{domain:[0,100],step:25})}</div>`;
  openSheet('Bereitschaft',h+CAP,{size:'tall'});}

// Status-Zeile (Challenge / Rad des Lebens) – nur wenn vorhanden, als EINE Zeile unter der Karte.
// Nur im eigenen Konto: das Mindset-Modul verweigert Coaches jede Aktion, eine tote Zeile ist schlechter als keine.
function homeMindStatusHTML(){
  const s=homeState();if(!s.own||homeDayOne(s))return '';
  const mw=homeMindWidget();
  if(!mw)return stlMindStatusPlaceholder(s);   // Modul noch unterwegs: Platz halten, statt nachzurücken
  if(!mw.status||!mw.status.text)return '';
  // role/tabindex/onkeydown: die Zeile war per Tastatur und Screenreader nicht erreichbar (RATE-shell-home M7)
  return `<div class="rows mb-3" id="homeMind"><div class="row tap" role="button" tabindex="0" onkeydown="homeRowKey(event)" onclick="${String(mw.status.fn||"go('mindset')")}">
    <div class="r-ic">${icon('brain')}</div><div class="rl truncate">${esc2(String(mw.status.text))}</div><div class="rr"></div></div></div>`;}

// Der EINE Wortlaut für die Check-in-Serie – Startseite, Wochenrückblick und Meilenstein-Feier.
// Vorher sagten diese drei Orte drei Dinge über dieselbe Zahl („31 Check-ins in Folge", „31 Tage
// Streak", „30 Tage Streak!") und alle drei zählten reparierte Tage als Check-in mit (D18). Eine
// Reparatur trägt einen Tag OHNE Eintrag nach: `checkinFrozen` (Insights) bzw. `streakFrozen`
// (Wochenzahlen) sagt, wie viele Tage der Serie nur so gedeckt sind. Ohne reparierten Tag bleibt
// „Check-ins in Folge" stehen – das ist dann wahr und sagt mehr als „Tage"; mit repariertem Tag nennt
// `detail` die Aufteilung, statt sie zu verschweigen.
// 2.9.0 Fix-Runde A-V.3: Diese beiden Sätze hießen bis eben „vom Joker gerettet" – dieselbe Mechanik,
// zwei Namen. Der Server heißt sein Feld weiter `jokerRefunded`/`freezes`; auf dem Schirm steht
// ausnahmslos „Reparatur" (BUILD-A5 5.6, CRITIC K10).
function shStreakWords(days,frozen){
  const d=Math.max(0,Math.round(+days||0)),f=Math.max(0,Math.min(d,Math.round(+frozen||0)));
  if(!f)return {main:pl(d,'Check-in','Check-ins')+' in Folge',detail:''};
  return {main:pl(d,'Tag','Tage')+' in Folge',
    // Sonderfall: die ganze Serie hängt an Reparaturen („davon 0 mit Check-in" wäre eine Rechenaufgabe
    // statt einer Aussage) – das passiert bei einem einzelnen reparierten Tag ohne jeden Eintrag.
    detail:(d-f===0)?'alle repariert, noch kein Check-in'
      :'davon '+pl(d-f,'mit Check-in','mit Check-in')+', '+fmtNum(f)+' repariert'};}

// ===== „HEUTE GESCHAFFT" – RINGE + STREAK =====
function drawHomeGoals(){
  const s=homeState();if(!s.own||!s.goals.length)return '';
  const streak=s.ins?.streaks?.checkin||0,fb=s.ins?.freezes?.balance||0;
  const rings=s.goals.map(g=>`<button class="hg" onclick="${g.act}" aria-label="${esc2(g.l)}${g.done?' erledigt':''}">
      <span class="hg-r">${ring(g.done?1:0,{size:46,stroke:4,color:'var(--green)',track:'var(--surface3)'})}<span class="hg-ic">${icon(g.ic,20)}</span>${g.done?`<span class="hg-b">${icon('check',12)}</span>`:''}</span>
      <span class="hg-l${g.done?' done':''}">${esc2(g.l)}</span></button>`).join('');
  const jok=`<button class="hg-jok" onclick="openStreakInfo()" aria-label="${pl(fb,'Reparatur','Reparaturen')} übrig">${icon('shield',16)}${fmtNum(fb)}</button>`;
  // „30 Tage Streak" war nicht wahr: eine Reparatur trägt einen Tag OHNE Eintrag nach, die Zahl zählte ihn
  // trotzdem als Tag mit (D18 – 313 echte Check-ins wurden zu „365 Tage ohne Unterbrechung"). „Check-ins in
  // Folge" sagt, was gezählt wird; was ein reparierter Tag bedeutet, steht im Reparatur-Sheet. Mit einem
  // reparierten Tag in der Serie stimmte auch „Check-ins" nicht mehr – dann trennt die zweite Zeile echte
  // von nachgetragenen Tagen.
  const sw=shStreakWords(streak,s.ins?.streaks?.checkinFrozen);
  // A-III.2: Ohne Insights ist die Folge UNBEKANNT, nicht null. „Trag heute etwas ein – ab dem ersten
  // Check-in zählt hier deine Folge" behauptete bei einer ausgebliebenen Antwort, es gäbe noch keine –
  // bei einem Athleten mit 31 Check-ins in Folge ist das schlicht falsch. Dann bleibt die Zeile weg,
  // genau wie der Fortschritt-Streifen (homeProgressHTML) es ohne Insights schon immer hält.
  // 2.9.0 (A-V.3): beide Zeichenpfade nehmen dieselbe Zeile – lpWeekLineHTML(). Der alte
  // Tages-Streak-Satz bleibt darunter nur als Notnagel für Antworten ohne Wochenziel-Zahlen.
  const line=!s.ins?''
    :(lpWeekLineHTML(s)
    ||(streak>0
    ? `<div class="hg-streak">${icon('flame',20)}<div class="fill"><b>${esc2(sw.main)}</b>${s.checkedIn?' <span class="tone-green">· heute schon dran</span>':' <span class="tone-amber">· heute noch offen</span>'}${sw.detail?`<small>${esc2(sw.detail)}</small>`:''}</div>${jok}</div>`
    : `<div class="hg-streak">${icon('flame',20)}<div class="fill muted">Trag heute etwas ein – ab dem ersten Check-in zählt hier deine Folge.</div>${jok}</div>`));
  // „Tag komplett" einmal pro Tag feiern – die Regel steht seit 2.8.0 in hmCelebrate, damit beide
  // Zeichenpfade (neu/klassisch) denselben Schlüssel und dieselbe Bedingung benutzen.
  hmCelebrate(s);
  return `<div class="section-label"><span>Heute geschafft</span><span class="sl-r${s.allDone?' tone-green':''}">${fmtNum(s.doneN)}/${fmtNum(s.goals.length)}</span></div>
    <div class="card mb-3"><div class="hg-row">${rings}</div>${line}</div>`;}

// Einmal beim Laden: die alten Tages-Schlüssel („be_daily_2026-09-10", einer je Kalendertag) auf den einen
// Schlüssel umziehen und wegräumen. Der Eintrag von HEUTE wird dabei übernommen – sonst feierte die App am
// Umstellungstag ein zweites Mal „Tag komplett". Ohne localStorage (Privatmodus) passiert schlicht nichts.
// Datum hier von Hand (lokaler Tag, wie fmt() in shell.js): shell.js lädt als LETZTES Skript, today() ist
// beim Ausführen dieser Zeilen also noch nicht aufrufbar.
(function homeMigrateDailyKey(){try{
  const old=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf('be_daily_')===0)old.push(k);}
  if(!old.length)return;
  const d=new Date(),t=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if(old.includes('be_daily_'+t)&&!localStorage.getItem('be_daily'))localStorage.setItem('be_daily',t);
  old.forEach(k=>localStorage.removeItem(k));
}catch(e){}})();

// ===== CHECK-IN =====
// Auf der Startseite steht IMMER die kurze Karte (eine Zeile + Trend); das Formular öffnet als Sheet
// (openCheckinSheet). Grund: die 2×2-Felder standen auf der Seite so weit unten, dass „Check-in speichern"
// erst nach Scrollen erreichbar war – im Sheet beginnt das Formular am oberen Rand des Bildschirms.
// Schlaf ohne erzwungene Nachkommastelle: „7 h", aber „7,5 h"
function homeSleepTxt(v){return fmtNum(v,Number.isInteger(+v)?0:1)+' h';}
function homeCheckinHTML(o){
  o=o||{};const sheet=!!o.sheet;
  const s=homeState();const tdy=s.tdy||today();
  // Sheet ohne Speichern geschlossen? Dann das Nachtrag-Datum verwerfen – sonst zeigt die Seitenkarte
  // die Werte eines anderen Tages unter der Überschrift „Heute".
  if(HOME_CI_SHEET&&!sheet&&!(typeof sheetOpen==='function'&&sheetOpen())){HOME_CI_SHEET=false;CHECKIN_DATE=tdy;}
  if(!CHECKIN_DATE)CHECKIN_DATE=tdy;
  const cis=s.cis||HOME_CIS||[];
  const ci=cis.find(c=>c.date===CHECKIN_DATE)||{};
  const ciT=cis.find(c=>c.date===tdy)||{}; // die eingeklappte Zeile zeigt IMMER heute
  const last=cis[0]||{};
  // Das Formular gibt es nur im Sheet – die Seitenkarte bleibt immer kurz (keine doppelten Feld-IDs)
  const open=sheet;
  // Gewichts-Trend als Kopfzeile (ersetzt den früheren eigenen Gewichts-Streifen)
  // Im Coach-Kontext NIE auf die eigenen Werte des Coaches zurückfallen – sonst stünde sein Startgewicht
  // neben dem aktuellen Gewicht des Athleten.
  const startW=(VIEW_USER===ME.id?ME.start_weight:(VIEW_USER_PROFILE?.start_weight??null));
  const curW=last?.weight;let trend='';
  if(startW&&curW){const goal=(VIEW_USER===ME.id?(ME.goal||''):(VIEW_USER_PROFILE?.goal||''));
    const v=weightVerdict(curW-startW,goal);
    trend=`<div class="meta">${fmtNum(startW,1)} → <b>${fmtNum(curW,1)} kg</b> · <span class="${homeToneCls(v.tone)}">${esc2(v.text)}</span></div>`;}
  // „Maße" und „Foto" stehen weiter unten unter „Mehr" – hier standen sie ein zweites Mal
  // auf derselben Seite. Beim Check-in bleibt nur, was zum Check-in gehört.
  const more=`<div class="cluster mt-3">
    <button class="btn sm sec" onclick="openBulkCheckin()">Mehrere Tage nachtragen</button></div>`;

  // --- Coach/Admin im Athleten-Kontext: nur Ansicht (die Selbstauskunft gehört dem Athleten) ---
  if(!s.own){
    const rows=cis.slice(0,5).map(c=>{
      // `source==='carried'`: dieser Tag ist bestätigt, aber nichts daran ist gemessen – die Werte sind
      // aus der Vorbelegung übernommen (src/server.js, POST /api/checkins). Der Coach muss das sehen,
      // sonst liest er eine fortgeschriebene Schrittzahl als Messung.
      const p=[c.weight!=null?fmtNum(c.weight,1)+' kg':null,c.sleep!=null?homeSleepTxt(c.sleep):null,
        c.steps!=null?fmtNum(c.steps)+' Schritte':null,c.water!=null?fmtNum(c.water,1)+' L':null,
        c.source==='carried'?'übernommen':null].filter(Boolean);
      return `<div class="row"><div class="r-ic">${icon('pencil',22)}</div>
        <div class="rl">${esc2(cap(fmtDate(c.date,{weekday:'short'})))}<small>${esc2(p.join(' · ')||'keine Werte')}</small></div>
        <div class="rr"></div></div>`;}).join('');
    return `<div class="between mb-2"><div class="fill"><div class="h3">Check-in</div>${trend}</div></div>
      ${rows?`<div class="rows">${rows}</div>`
        :`<div class="note">Noch keine Check-ins – sobald dein Athlet Gewicht, Schlaf, Schritte oder Wasser einträgt, steht es hier.</div>`}
      <div class="caption mt-2">Nur Ansicht – diese Werte trägt dein Athlet selbst ein.</div>`;}

  if(!open){
    const done=s.checkedIn;
    const parts=[ciT.weight!=null?fmtNum(ciT.weight,1)+' kg':'–',ciT.sleep!=null?homeSleepTxt(ciT.sleep):'–',
      ciT.steps!=null?fmtNum(ciT.steps)+' Schritte':'–',ciT.water!=null?fmtNum(ciT.water,1)+' L':'–'];
    // Nichts davon ist heute gemessen worden – dann steht es auch so da (siehe `source='carried'`).
    if(ciT.source==='carried')parts.push('übernommen');
    return `<div class="between mb-2"><div class="fill"><div class="h3">Check-in</div>${trend}</div>
        <button class="btn sm sec" onclick="homeExpandCheckin()">${done?'Bearbeiten':'Eintragen'}</button></div>
      <div class="rows"><div class="row tap" role="button" tabindex="0" onkeydown="homeRowKey(event)" onclick="homeExpandCheckin()"><div class="r-ic${done?' tone-green':''}">${icon(done?'check':'pencil',22)}</div>
        <div class="rl">Heute<small>${done?esc2(parts.join(' · ')):'Gewicht, Schlaf, Schritte und Wasser – dauert 20 Sekunden'}</small></div><div class="rr"></div></div></div>
      ${more}`;}

  // --- Formular (heute oder Nachtrag) ---
  const past=CHECKIN_DATE!==tdy;
  // A-IV.1 / M2: VIER von vier Feldern tragen beim Öffnen einen Wert.
  // Bis 2.7.0 standen hier vier LEERE Felder mit einem Vorschlag im `placeholder` – und ein
  // placeholder ist kein Wert: „Check-in speichern" ohne Eingabe brach mit „Bitte mindestens einen
  // Wert eingeben" ab (quickCheckin). Gemessen kostete der Check-in deshalb 7 Taps (tapcount:
  // 3 Klicks + 4 Tastenanschläge, 0 von 4 Feldern vorbelegt). Wer denselben Vorschlag abtippen muss,
  // den die App ihm hinschreibt, tippt für die App, nicht für sich.
  // Woher der Wert kommt, in dieser Reihenfolge:
  //   1. der Eintrag dieses Tages selbst (auch der von der Uhr eingespielte – siehe `source`),
  //   2. der letzte bekannte Wert VOR diesem Tag (bei einem Nachtrag also nicht der von heute),
  //   3. das WIRKSAME Tagesziel – beim Gewicht das Startgewicht aus dem Onboarding.
  // Stufe 3 hieß bis zu diesem Nachtrag „das im Profil GESETZTE Ziel" – und genau daran scheiterte
  // das frische Konto, für das die Vorbelegung gedacht ist: `sleep_goal`, `steps_goal` und
  // `water_goal` fragt das Onboarding nicht ab (`onboardingInput` in src/server.js kennt nur
  // sleep_goal, und auch dafür gibt es keinen Schritt), sie sind bei einem neuen Konto NULL.
  // Gemessen an einem neu registrierten Konto ohne Vorgeschichte: qc_weight="62" (Startgewicht),
  // qc_sleep/qc_steps/qc_water leer – 1 von 4 statt 4 von 4. „Vier von vier" galt nur für ein Konto
  // mit Vergangenheit, also für niemanden am ersten Tag.
  // Die Standards sind nicht hier erfunden, sondern die, mit denen die App längst rechnet – sonst
  // stünde unter dem Feld eine andere Zahl als in Bereitschaft, Profil und Analyse:
  //   Schlaf   – Profilziel, sonst das vom Server aus dem eigenen 14-Nächte-Median abgeleitete Ziel
  //              (`readiness.sleepGoal`, auf 7–8 h begrenzt, `sleepGoalOf` in src/server.js), sonst 8 h.
  //   Schritte – Profilziel, sonst 10.000 (derselbe Standard wie in `anaGoals` und im Ziele-Sheet).
  //   Wasser   – Profilziel, sonst ≈ 0,033 L je kg Körpergewicht (`waterTargetL` in src/server.js –
  //              das Ziel, gegen das das Mindset-Modul den Wassertag zählt), sonst 3 L.
  // Eine Messung wird damit weiterhin nicht erfunden: ein Ziel ist ein Vorsatz, kein Messwert – und
  // genau das steht unter dem Feld („dein Schlafziel", „Schritteziel · Standard 10.000"). Wer die
  // Zahl stehen lässt, bestätigt seinen Vorsatz; wer sie leert, sagt „heute nicht gemessen".
  // Was keine Quelle hat, bleibt leer: ohne Startgewicht wird kein Gewicht geraten – eine erfundene
  // Zahl in der Gewichtskurve wäre teurer als ein leeres Feld.
  const before=cis.filter(c=>c&&c.date<CHECKIN_DATE);
  const lastOf=k=>{const h=before.find(c=>c[k]!=null);return h?{v:h[k],date:h.date}:null;};
  const gnum=v=>{v=Number(v);return (isFinite(v)&&v>0)?v:null;};
  const setG={sleep:gnum(ME&&ME.sleep_goal),steps:gnum(ME&&ME.steps_goal),water:gnum(ME&&ME.water_goal)};
  // `readiness.sleepGoal` kommt IMMER – ohne eigene Nächte gibt `sleepGoalOf` schlicht die 8 zurück.
  // „aus deinem Schnitt" darf deshalb nur dort stehen, wo es wirklich einen eigenen Schnitt gibt:
  // sonst behauptet ein Konto am ersten Tag, die App habe seinen Schlaf gemessen.
  const srvSleep=gnum(s.readiness&&s.readiness.sleepGoal);
  const ownSleep=cis.some(c=>c&&c.sleep!=null);
  const wKg=gnum(last.weight)||gnum(startW);
  const goalOf={weight:(startW??null),sleep:setG.sleep||srvSleep||8,steps:setG.steps||10000,
    water:setG.water||(wKg?Math.round(wKg*0.033*10)/10:3)};
  const GOAL_TXT={weight:'dein Startgewicht',
    sleep:setG.sleep?'dein Schlafziel':((srvSleep&&ownSleep)?'dein Schlafziel · aus deinem Schnitt':'Schlafziel · Standard 8 h'),
    steps:setG.steps?'dein Schritteziel':'Schritteziel · Standard 10.000',
    water:setG.water?'dein Wasserziel':(wKg?'Wasserziel · ≈ 0,033 L je kg':'Wasserziel · Standard 3 L')};
  // B7: „von deiner Uhr" wird GELESEN, nicht geraten. Bis 2.8.0 stand hier eine Regel
  // („health_sync an + heute + Feld, das die Uhr liefern kann") – die kann lügen: ein von Hand
  // getippter Schlafwert an einem Tag mit aktivem Health-Sync bekam „von deiner Uhr" untergeschrieben.
  // Jetzt entscheidet `checkins.source` (Spalte seit D19, seit dieser Welle in CHECKIN_COLS und damit
  // im Home-Paket, src/server.js):
  //   'health'         = die Zeile ist ausschließlich vom Apple-Health-Import angelegt und seither von
  //                      keiner Handeingabe berührt (POST /api/checkins setzt beim ersten echten Wert
  //                      auf 'manual'). Jeder Wert darin stammt von der Uhr.
  //   'manual' / NULL  = ein Mensch hat diesen Tag geschrieben (NULL = Bestandszeile von vor D19, laut
  //                      DEFER-A2 als Handeingabe zu lesen). Auch fehlt `source` in einem alten
  //                      Offline-Cache – undefined fällt hier genauso auf die neutrale Seite.
  // Dazu bleibt die Gegenprobe am Feld: der Import (HEALTH_FIELDS in src/server.js) kennt Gewicht,
  // Schlaf, Schritte, Aktiv-kcal, Bewegungsminuten, Ruhepuls und HRV – Wasser ist nicht dabei und kann
  // in keiner 'health'-Zeile stehen. Alles andere bekommt das neutrale „schon eingetragen", das in
  // beiden Fällen wahr ist (auch dann, wenn der Import später Schlaf/Schritte in eine von Hand
  // angelegte Zeile nachgetragen hat – dort ist die Herkunft je Feld nicht mehr belegbar, und eine
  // unbelegte Behauptung ist genau der Fehler, der hier abgestellt wird).
  const WATCH_CAN=new Set(['weight','sleep','steps']);
  const fromWatch=ci.source==='health';
  // A-IV.1-Nachbesserung: Ein vorbelegter Wert, den niemand anfasst, ist KEINE Messung. Welche Felder
  // übernommen sind, entscheidet sich hier (Quelle 2 und 3: letzter bekannter Wert, Ziel aus dem
  // Profil) und wandert als `data-carried` ins Feld; `quickCheckin()` schickt die unberührten davon als
  // `carried` mit, und src/server.js schreibt die Zeile dann als `source='carried'` statt 'manual'.
  // Eine bereits als 'carried' gespeicherte Zeile bleibt übernommen, solange niemand sie ändert –
  // sonst würde erneutes Öffnen und Speichern eine fortgeschriebene Zahl zur Messung befördern.
  const wasCarried=ci.source==='carried';
  function pre(k){
    if(ci[k]!=null)return {v:ci[k],carried:wasCarried,
      why:(fromWatch&&WATCH_CAN.has(k))?'von deiner Uhr':(wasCarried?'übernommen':'schon eingetragen')};
    const h=lastOf(k);
    if(h)return {v:h.v,carried:true,why:'zuletzt '+fmtDate(h.date,{weekday:'short'})};
    if(goalOf[k]!=null)return {v:goalOf[k],carried:true,why:GOAL_TXT[k]};
    return {v:'',carried:false,why:''};}
  const P={weight:pre('weight'),sleep:pre('sleep'),steps:pre('steps'),water:pre('water')};
  // Zahlenfelder wollen den Punkt, nicht das Komma – 78,4 wäre für <input type=number> kein Wert.
  const pv=k=>P[k].v===''?'':String(P[k].v).replace(',','.');
  const ph=k=>P[k].why?`<small class="fh">${esc2(P[k].why)}</small>`:'';
  // Der vorbelegte Wert bleibt am Feld stehen: nur wer ihn ändert, hat gemessen. Ein Vergleich beim
  // Speichern genügt – kein Ereignis-Zuhörer, der beim Neuzeichnen verloren ginge.
  const dp=k=>P[k].carried&&pv(k)!==''?` data-carried="1" data-pre="${esc2(pv(k))}"`:'';
  const preK=['weight','sleep','steps','water'].filter(k=>P[k].v!==''&&ci[k]==null);
  const anyPre=preK.length>0;
  // Woraus die Vorbelegung besteht, gehört in die Fußzeile: bei einem frischen Konto sind es
  // ausschließlich Ziele – „vorbelegt mit deinen letzten Werten" wäre dort schlicht falsch, es gibt
  // noch keine. Der Satz nennt deshalb genau die Quellen, die im Formular auch wirklich stehen.
  const isGoal=k=>ci[k]==null&&!lastOf(k)&&goalOf[k]!=null;
  const gN=preK.filter(isGoal).length;
  const preTxt=gN===0?'deinen letzten Werten':(gN===preK.length?'deinen Zielen':'deinen letzten Werten und deinen Zielen');
  // Der placeholder ist nur noch der Hinweis für ein GELEERTES Feld – er trägt dieselbe Zahl wie die
  // Vorbelegung. Sonst stünde unter „Schritteziel · Standard 10.000" ein Vorschlag von 8.000.
  // Beim Gewicht endet die Kette anders als bei den drei anderen Feldern: hat weder dieser Tag noch
  // die Vergangenheit noch das Onboarding ein Gewicht, gibt es KEINE Quelle – das Feld bleibt leer
  // (siehe oben: „ohne Startgewicht wird kein Gewicht geraten"). Bis hierher stand im placeholder
  // trotzdem ein festes `??75`: eine Zahl, die niemand gemessen, gesetzt oder gewählt hat, in genau
  // dem Feld, das als einziges keine Herkunftszeile trägt. Gemessen an einem Konto ohne
  // `start_weight` (Athlet, den ein Coach angelegt hat, bevor er das Onboarding durchläuft):
  // Feld leer, darunter nichts, im Feld der Vorschlag „75,0" – und 75,0 ist die Zahl, die ein Mensch
  // in Eile bestätigt und die danach als seine Gewichtskurve beginnt. Ohne Quelle also auch kein
  // Vorschlag; das Etikett „Gewicht (kg)" sagt ohnehin, was hineingehört.
  const sleepPh=last.sleep??goalOf.sleep,wPh=last.weight??startW;
  const phv={weight:wPh!=null?fmtNum(wPh,1):'',sleep:fmtNum(sleepPh,Number.isInteger(+sleepPh)?0:1),
    steps:fmtNum(last.steps??goalOf.steps),water:fmtNum(last.water??goalOf.water,1)};
  let chips='<div class="chip-row mb-3">';
  for(let i=0;i<7;i++){const dd=new Date(tdy+'T00:00:00');dd.setDate(dd.getDate()-i);const iso=fmt(dd);
    const has=cis.some(c=>c.date===iso&&(c.weight!=null||c.sleep!=null||c.steps!=null||c.water!=null));
    const lbl=i===0?'Heute':i===1?'Gestern':fmtDate(iso,{weekday:'short'});
    chips+=`<button class="chip${iso===CHECKIN_DATE?' on':''}${has&&iso!==CHECKIN_DATE?' done':''}" onclick="setCheckinDate('${iso}')">${has?icon('check',14):''}${esc2(lbl)}</button>`;}
  chips+='</div>';
  // „Mehrere Tage nachtragen" gehört dorthin, wo über den TAG entschieden wird – also neben die
  // Tages-Chips. Im neuen Zeichenpfad gibt es die Check-in-Karte auf der Seite nicht mehr, und mit
  // ihr war auch ihre Fußzeile weg: openBulkCheckin() war von nirgends mehr erreichbar (gemessen:
  // kein sichtbares Element mit diesem onclick, weder auf Home noch im Sheet). Über die sieben
  // Chips kostet ein einzelner vergangener Tag zwei Taps – eine ganze Woche aber sieben mal zwei
  // statt eines Dialogs. Im klassischen Pfad steht der Knopf weiter auf der Seite selbst; dort
  // wäre er hier ein zweites Mal, und genau das soll diese Welle nicht.
  const bulk=hmNew()?`<div class="cluster mb-3">
    <button class="btn sm sec" onclick="openBulkCheckin()">Mehrere Tage nachtragen</button></div>`:'';
  const head=trend?`<div class="mb-3">${trend}</div>`:'';
  return `${head}
    ${chips}
    ${bulk}
    ${past?`<div class="note mb-3">Du trägst für <b>${esc2(fmtDate(CHECKIN_DATE,{weekday:'long',month:'long'}))}</b> nach – das schließt auch Lücken in deiner Check-in-Folge.</div>`:''}
    <div class="grid-2">
      <div class="field"><label>Gewicht (kg)</label><input id="qc_weight" type="number" step="0.1" inputmode="decimal" min="0" max="500" value="${esc2(pv('weight'))}"${dp('weight')} placeholder="${esc2(phv.weight)}">${ph('weight')}</div>
      <div class="field"><label>Schlaf (h)</label><input id="qc_sleep" type="number" step="0.5" inputmode="decimal" min="0" max="24" value="${esc2(pv('sleep'))}"${dp('sleep')} placeholder="${esc2(phv.sleep)}">${ph('sleep')}</div>
      <div class="field"><label>Schritte</label><input id="qc_steps" type="number" inputmode="numeric" min="0" max="200000" value="${esc2(pv('steps'))}"${dp('steps')} placeholder="${esc2(phv.steps)}">${ph('steps')}</div>
      <div class="field"><label>Wasser (L)</label><input id="qc_water" type="number" step="0.1" inputmode="decimal" min="0" max="30" value="${esc2(pv('water'))}"${dp('water')} placeholder="${esc2(phv.water)}">${ph('water')}</div>
    </div>
    <button class="btn block" id="qcSave" onclick="quickCheckin()">${past?'Nachtragen':'Check-in speichern'}</button>
    <div class="caption mt-2">${anyPre?'Vorbelegt mit '+preTxt+' – überschreib, was heute anders ist. Was du stehen lässt, wird als <b>übernommen</b> gespeichert, nicht als Messung. Ein Feld leeren heißt „heute nicht gemessen".'
      :(ME&&ME.health_sync?'Schlaf, Schritte und Verbrauch kommen automatisch von deiner Uhr – trag hier nur ein, was fehlt.':'Leer lassen ist okay.')}</div>`;}
// Alias mit dem Namen aus dem Plan – gibt denselben Karteninhalt zurück
function drawHomeCheckin(){return homeCheckinHTML();}
function setCheckinDate(d){CHECKIN_DATE=d;homePatch('homeCheckinSheet',homeCheckinHTML({sheet:true}));}
// „Check-in eintragen"/„Bearbeiten" von der Startseite -> dasselbe Sheet wie aus der Analyse
function homeExpandCheckin(){openCheckinSheet(today());}
// Check-in-Formular als Sheet (Startseite und Analyse-Nachtrag, Vertrag mit WP5)
function openCheckinSheet(date){
  CHECKIN_DATE=date||today();HOME_CI_SHEET=true;
  openSheet('Check-in',`<div id="homeCheckinSheet">${homeCheckinHTML({sheet:true})}</div>`);}

// Offline eingetragen: der Tag erreicht den Server erst später. Damit Ringe, Streak-Zeile und Jetzt-Karte
// den Eintrag trotzdem sofort zeigen, wandert er hier in die lokale Check-in-Liste – die Outbox trägt ihn nach.
// B7: `source` wandert mit. Hier tippt ein Mensch, also 'manual' – genau das schreibt auch
// POST /api/checkins, sobald der Eintrag den Server erreicht (src/server.js, `handwert`). Ohne diese
// Zeile behielte eine von der Uhr angelegte Zeile offline ihr 'health' und die Herkunftszeile stünde
// unter einem gerade von Hand getippten Wert.
// `src` ist dieselbe Unterscheidung, die src/server.js trifft: 'carried', wenn der Eintrag nur aus
// übernommenen Werten der Vorbelegung besteht – dann füllt er auch offline nur Lücken und stuft eine
// vorhandene Herkunft ('health'/'manual') nicht herunter.
function homeMergeCheckin(date,vals,src){
  src=src==='carried'?'carried':'manual';
  const list=((HOME_DATA&&HOME_DATA.checkins)||HOME_CIS||[]).slice();
  const i=list.findIndex(c=>c&&c.date===date);
  if(i>=0){const old=list[i]||{},m={...old};
    for(const k in vals){if(src==='carried'&&m[k]!=null)continue;m[k]=vals[k];}
    m.date=date;m.source=src==='carried'?(old.source||'carried'):'manual';list[i]=m;}
  else{list.push({date,...vals,source:src});list.sort((a,b)=>String(b.date).localeCompare(String(a.date)));}
  HOME_CIS=list;if(HOME_DATA)HOME_DATA.checkins=list;}

// Welche der vier Felder tragen noch genau den vorbelegten Wert? Genau die sind übernommen und nicht
// gemessen. Verglichen wird der Feldwert mit `data-pre` – wer die Zahl ändert, fällt heraus. Wer
// dieselbe Zahl stehen lässt oder erneut tippt, bleibt „übernommen": es ist die Zahl von gestern, und
// mehr lässt sich ohne Messung nicht behaupten. Ein geleertes Feld schickt ohnehin nichts.
function homeCarriedFields(){
  const out=[];
  for(const [id,k] of [['qc_weight','weight'],['qc_sleep','sleep'],['qc_steps','steps'],['qc_water','water']]){
    const el=document.getElementById(id);
    if(!el||el.getAttribute('data-carried')!=='1')continue;
    if(String(el.value||'').trim()===String(el.getAttribute('data-pre')||'').trim())out.push(k);}
  return out;}

// Speichern OHNE Neuaufbau der Seite: Werte bleiben, Scrollposition bleibt, Ringe/Hero ziehen nach.
async function quickCheckin(){
  const w=num('qc_weight'),sl=num('qc_sleep'),st=num('qc_steps'),wa=num('qc_water');
  if(w==null&&sl==null&&st==null&&wa==null)return toast('Bitte mindestens einen Wert eingeben');
  const d=CHECKIN_DATE||today();
  const vals={};
  if(w!=null)vals.weight=w;if(sl!=null)vals.sleep=sl;if(st!=null)vals.steps=st;if(wa!=null)vals.water=wa;
  // Zwei Taps ohne eine einzige Eingabe schrieben bis 2.8.0 eine Zeile, die aussah wie gemessen:
  // Gewicht von gestern, Schritte von vorgestern, `source='manual'`. Die Herkunft stand nur unter dem
  // Feld, nicht in der Zeile – und die Zahl geht danach in Wochenmittel, Bereiche und den Coach-Blick
  // ein. Ab jetzt reist sie mit: `carried` nennt die unberührten Felder, der Server füllt damit nur
  // Lücken und schreibt eine reine Übernahme als `source='carried'` (src/server.js, POST /api/checkins).
  const carried=homeCarriedFields().filter(k=>vals[k]!=null);
  const allCarried=carried.length===Object.keys(vals).length;
  const body={user_id:VIEW_USER,date:d,...vals};
  if(carried.length)body.carried=carried;
  const btn=document.getElementById('qcSave');if(btn)btn.disabled=true;
  const r=await API.post('/checkins',body,{queue:true,kind:'checkin',label:'Check-in '+fmtDate(d)});
  if(!okRes(r)){if(btn)btn.disabled=false;return toast(r.data?.error||'Fehler – nicht gespeichert');}
  if(btn){btn.textContent='Gespeichert ✓';btn.classList.add('sec');}
  // Ohne Netz wartet der Eintrag in der Outbox. Jetzt nachzuladen hieße, den Serverstand OHNE ihn
  // zurückzuschreiben – also nur lokal einpflegen und dieselben Blöcke patchen wie sonst.
  if(wasQueued(r)){
    toast('Offline gespeichert – wird nachgetragen, sobald du online bist');
    homeMergeCheckin(d,vals,allCarried?'carried':'manual');
    CHECKIN_DATE=today();
    if(HOME_CI_SHEET){HOME_CI_SHEET=false;closeAllSheets();}
    homePatch('homeGoals',hmGoalsHTML());homePatch('homeCheckin',homeCheckinHTML());homePatchHero();homeCache();
    return;}
  // `jokerRefunded` heißt auf dem Server so; auf dem Schirm heißt es „Reparatur" (BUILD-A5 5.6).
  if(r.data?.jokerRefunded)toast('Nachgetragen – Reparatur zurückerstattet ✓');
  // Sagt, was gespeichert wurde: eine reine Übernahme ist kein gemessener Tag, und die App tut auch
  // nicht so. Der Tag zählt trotzdem (Serie, Ringe) – bestätigt hat der Mensch ihn ja.
  else if(r.data?.source==='carried'||(allCarried&&carried.length))toast(d===today()?'Übernommen ✓ – deine letzten Werte, nichts neu gemessen':'Nachgetragen ✓ – übernommene Werte');
  else toast(d===today()?'Check-in gespeichert ✓':'Nachgetragen ✓');
  // Daten nachladen (Check-ins + Insights für Streak/Level) und alles an Ort und Stelle nachziehen
  const own=(VIEW_USER===ME.id&&ME.role==='athlete');
  const [cr,ir]=await Promise.all([API.get(homeCheckinPath(VIEW_USER)),own?API.get('/insights/'+VIEW_USER):Promise.resolve(null)]);
  if(cr.status===200){HOME_CIS=cr.data?.checkins||[];if(HOME_DATA)HOME_DATA.checkins=HOME_CIS;}
  if(ir&&ir.status===200){if(HOME_DATA)HOME_DATA.insights=ir.data;try{LAST_INSIGHTS=ir.data;}catch(e){}}
  if(typeof refreshAchievements==='function')refreshAchievements();
  invalidateView('tracker');invalidateView('mindset');
  CHECKIN_DATE=today();
  if(HOME_CI_SHEET){HOME_CI_SHEET=false;closeAllSheets();}
  homePatch('homeGoals',hmGoalsHTML());homePatch('homeCheckin',homeCheckinHTML());homePatchHero();homeCache();
  // A-V.3 (CRITIC K7, Reihenfolge erst installieren – dann fragen): Die Frage nach Erinnerungen kommt
  // NACH dem ersten gespeicherten Check-in, in der App, und nie als Systemdialog aus dem Nichts.
  lpAfterEntry('checkin');}

// ===== ERNÄHRUNG (Ring + nächste Plan-Mahlzeit) =====
function homeNextMeal(){
  if(typeof nextPlanMeal!=='function')return null;
  try{return nextPlanMeal((HOME_DATA&&HOME_DATA.foodlog&&HOME_DATA.foodlog.summary)||null);}catch(e){return null;}}
// D1: Fehlt das Geburtsjahr, rechnet der Server das Kalorienziel ohne Alter. Der Ring zeigte die Zahl
// trotzdem wie einen Messwert („0 / 2.584 kcal"), obwohl GET /api/home den ehrlichen Satz in
// foodlog.summary.targetsNote mitliefert. Wortgleich mit der Zeile im Ernährungs-Tab (diet.js
// dtTargetsNote) – zwei Orte, eine Aussage.
function shTargetsNote(sum,own){
  const note=(sum&&typeof sum.targetsNote==='string')?sum.targetsNote.trim():'';
  if(!note&&!(sum&&sum.dobMissing))return '';
  const txt=own?(note||'Startwert – trag dein Geburtsjahr ein, dann rechnen wir genauer.')
    :'Startwert – ohne Geburtsjahr rechnet das Ziel ohne Alter.';
  return `<div class="h-sep h-note">${icon('info',16)}<span>${esc2(txt)}</span></div>`;}
// D10: Weicht das gespeicherte kcal-Ziel um mehr als 7 % von der Formel ab, verwirft der Server es und
// rechnet neu (foodlog.summary.kcalAsk). Im Ring stand dann 2.975, im Profil und in der Coach-Übersicht
// 2.600 – zwei Zahlen für dieselbe Sache, ohne ein Wort dazu. Die Rückfrage („Übernehmen?") steht bewusst
// nur an EINER Stelle, im Ernährungs-Tab (diet.js dtKcalAskNote); hier steht der erklärende Satz.
// Welcher Tagtyp gilt, entscheidet die Zahl im Ring selbst – so passt der Satz garantiert zur Anzeige.
function shKcalAskNote(sum,own){
  const ask=sum&&sum.kcalAsk;if(!ask)return '';
  const tgt=Math.round(sum.target||0);
  const d=(ask.train&&Math.round(ask.train.suggested||0)===tgt&&tgt)?ask.train
    :(ask.rest&&Math.round(ask.rest.suggested||0)===tgt&&tgt)?ask.rest:null;
  const saved=Math.round((d?d.saved:ask.saved)||0),sug=Math.round((d?d.suggested:ask.suggested)||0);
  if(!saved||!sug||saved===sug)return '';
  const txt=`${own?'Dein gespeichertes Ziel':'Das gespeicherte Ziel'} (${fmtNum(saved)} kcal) passt nicht mehr zum aktuellen Gewicht – gerechnet wird mit ${fmtNum(sug)} kcal.`;
  return `<div class="h-sep h-note">${icon('info',16)}<span>${esc2(txt)}</span></div>`;}
function homeFoodHTML(){
  const s=homeState();if(!s.kcalTarget)return '';
  const pct=Math.min(1,(s.consumed||0)/s.kcalTarget);
  const over=s.fl.status==='over';
  const rem=s.fl.remaining;
  const goalTxt={muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'}[s.T?.goal]||'';
  const status=over?'über dem Ziel':(s.fl.status==='onTarget'?'im Ziel ✓':(rem!=null?fmtNum(rem)+' kcal übrig · '+fmtNum(s.fl.macros?.protein||0)+' g Eiweiß':''));
  // Essen trägt nur der Athlet selbst ein: im Coach-Blick keine „Gegessen"-Aktion – die Check-in-Karte
  // direkt darunter sagt ausdrücklich „Nur Ansicht", und der Plan-Cache der Ernährung kann im Coach-Kontext
  // noch dem zuvor geöffneten Athleten gehören. Also wird die nächste Mahlzeit hier gar nicht erst gelesen.
  const nm=s.own?homeNextMeal():null;
  const next=(nm&&nm.label)?`<div class="h-sep between">
      <div class="fill"><div class="body truncate">Nächste Mahlzeit: <b>${esc2(homeShortLabel(nm.label))}</b></div>
        <div class="caption">${fmtNum(nm.kcal)} kcal · ${fmtNum(nm.protein)} g Eiweiß</div></div>
      ${nm.logged?'<span class="pill green">gegessen</span>':((nm.mealId&&!coachView())?`<button class="btn sm" onclick="homeMealDone(${+nm.mealId})">Gegessen</button>`:'')}</div>`:'';
  // Ohne Netz getippte Plan-Mahlzeiten stehen sichtbar in der Karte, bis sie im Tagesprotokoll auftauchen –
  // sonst quittiert die Startseite den Tipp mit nichts. Wortgleich zur wartenden Zeile im Ernährungs-Tab.
  // Aufgeräumt wird beim Zeichnen: steht die Mahlzeit im Protokoll (nachgetragen ODER vom Ernährungs-Tab
  // optimistisch eingefügt), zeigt das die Karte schon über Ring und „Nächste Mahlzeit" – Zeile weg.
  // Im Coach-Blick nicht aufräumen: das Protokoll gehört dann dem Athleten, die wartenden Einträge aber
  // immer dem eigenen Konto (homeMealDone bricht für Coaches ab) – sonst fielen sie fälschlich heraus.
  const inLog=(id)=>((s.fl.loggedMealIds||[]).some(v=>+v===+id))||((s.d.foodlog?.items||[]).some(it=>it&&+it.meal_id===+id));
  const qm=s.own?(homeMealDone.queued=(homeMealDone.queued||[]).filter(x=>x&&x.date===today()&&!inLog(x.mealId))):[];
  const pend=qm.map(x=>`<div class="h-sep between">
      <div class="fill"><div class="body truncate">${esc2(homeShortLabel(x.label))}</div>
        <div class="caption">ohne Netz eingetragen</div></div>
      <span class="pill neutral fixed">wird nachgetragen</span></div>`).join('');
  return `<div class="section-label"><span>Ernährung</span><span class="sl-r">${goalTxt}${s.isTrain?' · Trainingstag':' · Ruhetag'}</span></div>
    <div class="card mb-3">
      <div class="ring-card" role="button" tabindex="0" aria-label="Ernährung öffnen" onkeydown="homeRowKey(event)" onclick="go('diet')">
        ${ring(pct,{size:76,color:over?'var(--amber)':'var(--red)',label:fmtNum(s.consumed),sub:'/ '+fmtNum(s.kcalTarget)})}
        <div class="ring-info"><div class="big">${fmtNum(s.consumed)}<em> / ${fmtNum(s.kcalTarget)} kcal</em></div>
          <div class="lbl">${esc2(status)}</div></div>
        <div class="muted-2">${icon('chevronRight',20)}</div>
      </div>${shTargetsNote(s.fl,s.own)}${shKcalAskNote(s.fl,s.own)}${next}${pend}</div>`;}
// „Gegessen" direkt von der Startseite: loggt die Plan-Mahlzeit und zieht Ring/Ringe nach.
// homeMealDone.queued = [{mealId,label,date}] – die ohne Netz eingereihten Plan-Mahlzeiten dieser Sitzung.
// Sie leben hier und nicht im Ernährungs-Tab: dessen optimistischer Eintrag (_dietPendingMeal) braucht den
// geladenen Plan, und genau der fehlt, wenn man die App aufmacht und direkt auf der Startseite tippt.
async function homeMealDone(mealId){
  if(coachView())return go('diet');   // Sicherheitsnetz: der Coach loggt nichts für seinen Athleten
  if(typeof logFromMeal!=='function')return go('diet');
  const nm=homeNextMeal(),label=(nm&&+nm.mealId===+mealId&&nm.label)?nm.label:'Mahlzeit';
  const q0=(typeof outboxCount==='function')?outboxCount():0;
  // Eingetragen wird in diet.js: dort hängen die Doppel-Erkennung (409), das Rückgängig und die
  // Outbox-Kennung „food". Home wertet nur aus, ob es geklappt hat.
  const logged=await logFromMeal(mealId);
  if(logged===false)return;
  // Wartet der Eintrag nur in der Outbox, darf nichts nachgeladen werden – der Server kennt die Mahlzeit
  // noch nicht und würde den optimistischen Stand überschreiben. 'queued' ist die Auskunft von diet.js;
  // ältere Fassungen melden dort schlicht true, deshalb zusätzlich der Blick auf die Outbox-Länge.
  const queued=logged==='queued'||((typeof outboxCount==='function')&&outboxCount()>q0);
  if(!queued){const r=await API.get('/foodlog/'+(VIEW_USER||ME.id)+'?date='+today());
    if(r.status===200&&HOME_DATA)HOME_DATA.foodlog=r.data;}
  else if(!homeMealDone.queued?.some(x=>+x.mealId===+mealId&&x.date===today()))
    homeMealDone.queued=[...(homeMealDone.queued||[]),{mealId:+mealId,label,date:today()}];
  // Bietet die Karte dieselbe Mahlzeit danach immer noch an, hat sie niemand nachgeführt (Plan nicht geladen,
  // oder das Nachladen scheiterte). Ein zweiter Tipp legte sonst einen zweiten Outbox-Eintrag an, den der
  // Server später als Dublette ablehnt – „1 Eintrag nachgetragen · 1 abgelehnt" für einen korrekten Tipp.
  // (Nur nextMeal leeren, NICHT loggedMealIds ergänzen: die Liste sagt „der Server kennt den Eintrag" –
  // genau daran erkennt die Karte oben, wann die wartende Zeile wieder verschwinden darf.)
  try{const sum=HOME_DATA?.foodlog?.summary,still=homeNextMeal();
    if(sum&&still&&+still.mealId===+mealId&&!still.logged)sum.nextMeal=null;
  }catch(e){console.error('[home] Mahlzeit',e);}
  invalidateView('diet');
  homePatch('homeFood',homeFoodHTML());homePatch('homeGoals',hmGoalsHTML());homePatchHero();homeCache();}

// ===== SUPPLEMENTS-BLOCK AUF DER STARTSEITE =====
// Abhak-Zeile mit role="button": Enter/Leertaste sollen wie ein Tipp wirken
function homeRowKey(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();ev.currentTarget.click();}}
function homeSuppHTML(){
  const s=homeState();if(!s.own||!s.sup)return '';
  const items=s.sItems;
  if(!items.length)return `<div class="section-label"><span>Supplements</span></div>
    <div class="rows mb-3"><div class="row tap" role="button" tabindex="0" onclick="openAddIntake()"><div class="r-ic">${icon('pill')}</div>
      <div class="rl">Keine Supplements zugewiesen<small>Eigene hinzufügen</small></div><div class="rr"></div></div></div>`;
  // Auf der Startseite stehen nur die OFFENEN Einnahmen (max. 3). Abgehakte verschwinden –
  // der Block schrumpft im Lauf des Tages auf eine Zeile, statt dauerhaft 4 Zeilen zu belegen.
  const open=items.filter(p=>!p.taken);
  const rows=open.slice(0,3).map(p=>`<div class="row h-tap" role="button" tabindex="0" aria-pressed="false" onkeydown="homeRowKey(event)" onclick="toggleIntakeHome(event,${p.supplement_id??'null'},${p.intake_id??'null'},'${esc(p.name)}','${esc(p.dose||'')}')">
      <div class="r-ic">${icon('pill',22)}</div>
      <div class="rl">${esc2(p.name)}${p.dose?`<small>${esc2(p.dose)}</small>`:''}</div>
      <div class="rr">${p.mandatory?'<span class="pill must">Pflicht</span>':''}</div></div>`).join('');
  const rest=open.length-Math.min(3,open.length);
  const moreLabel=!open.length?'Alle '+fmtNum(items.length)+' genommen – Tages-Check öffnen'
    :rest>0?'Noch '+fmtNum(rest)+' offen – alle anzeigen':'Tages-Check öffnen';
  // Kein icon('chevronRight') in .rr: app.css zeichnet für .row.tap .rr::after bereits einen – es standen
  // zwei nebeneinander (RATE-shell-home M6).
  const more=`<div class="row tap" role="button" tabindex="0" onkeydown="homeRowKey(event)" onclick="openSupp()"><div class="r-ic">${icon(open.length?'more':'check',22)}</div>
    <div class="rl${open.length?'':' tone-green'}">${moreLabel}</div><div class="rr"></div></div>`;
  return `<div class="section-label"><span>Supplements</span><span class="sl-r${s.sItemsDone===items.length?' tone-green':''}">${fmtNum(s.sItemsDone)}/${fmtNum(items.length)}</span></div>
    <div class="rows mb-3">${rows}${more}</div>`;}

// ===== FORTSCHRITT: EIN STREIFEN, DREI ANTIPPBARE SEGMENTE =====
function homeProgressHTML(){
  const s=homeState();if(!s.own||!s.ins)return '';
  const I=s.ins,lp=I.levelProgress||{pct:0};
  const w=I.week&&I.week.thisWeek,wg=I.weekGoal||{target:0,done:0};
  const vol=w?(w.volume/1000):0;
  const MG=s.monthly;
  // A-9 (Nachbesserung): Tonnage ist die Leitkennzahl der oberen Stufen, nicht der ersten. STRATEGY 4.3
  // gibt Stufe 1 „Konsequenz" – Einheiten pro Woche gegen das Ziel – und ausdrücklich KEINE Tonnage;
  // Stufe 3 lässt sie sogar als Leitkennzahl fallen. Gemessen an einem frischen Konto nach einem
  // einzigen Satz 20 kg × 10 stand hier „Woche 1/3 · 0,2 t Volumen": eine Einheit, die eine Anfängerin
  // erst nachschlagen müsste, über einer Zahl, die nichts darüber sagt, ob sie dran geblieben ist.
  // Gleiche Kachel, gleicher Weg, gleicher Balken, gleiche Tap-Zahl – nur die Beschriftung wechselt.
  const lvl=hmLevel();
  const wkT=lvl>=2?('Woche '+fmtNum(wg.done)+'/'+fmtNum(wg.target)):'Diese Woche';
  const wkS=lvl>=2?(fmtNum(vol,1)+' t Volumen')
    :(wg.target?fmtNum(wg.done)+' von '+fmtNum(wg.target)+' Trainings':pl(wg.done,'Training','Trainings'));
  const segs=[
    {t:'Level '+fmtNum(I.level),s:fmtNum(I.xp)+' XP',pct:lp.pct,cls:'',fn:"typeof openAchievements==='function'?openAchievements():go('tracker')"},
    {t:wkT,s:wkS,pct:wg.target?Math.min(100,Math.round(wg.done/wg.target*100)):0,cls:(wg.target&&wg.done>=wg.target)?'green':'',fn:"if(typeof renderTracker==='function')renderTracker.tab='training';go('tracker')"}
  ];
  if(MG&&MG.parts)segs.push({t:'Monat '+fmtNum(MG.reachedCount)+'/'+fmtNum(MG.parts.length),s:'Gesamt '+fmtNum(MG.overallPct)+'%',pct:MG.overallPct,cls:MG.allReached?'green':'',fn:"typeof openMonthlyGoal==='function'?openMonthlyGoal():go('tracker')"});
  // Keine Monatsziel-Feier auf der Startseite: GET /api/home liefert monthly bewusst ohne Gutschrift
  // (justClaimed ist dort immer false), und der Fallback holt /monthly gar nicht erst. Gutschrift und
  // Feier gehören zur Analyse (analysis.js, GET /api/monthly) – dort und nur dort.
  if(typeof checkNewAchievements==='function'){try{checkNewAchievements(I);}catch(e){}}
  // A-IV.1: Auf der neuen Startseite entfällt der Abschnittskopf. Er kostete 41 px und trug den
  // Level-Titel („Einsteiger") neben einem Profil, das „Fortgeschritten" sagt – zwei Skalen mit
  // denselben Wörtern (RATE-shell-home M10). Die drei Segmente beschriften sich selbst.
  const head=hmNew()?'':`<div class="section-label"><span>Fortschritt</span><span class="sl-r">${esc2(I.levelTitle||'')}</span></div>`;
  return `${head}
    <div class="card h-prog mb-3">${segs.map(g=>`<button class="h-seg" onclick="${g.fn}">
      <span class="h-seg-t">${esc2(g.t)}</span><span class="caption truncate">${esc2(g.s)}</span>
      <span class="bar${g.cls?' '+g.cls:''}"><i style="width:${Math.max(0,Math.min(100,+g.pct||0))}%"></i></span></button>`).join('')}</div>`;}

// ===== „MEHR" =====
// Vier Kacheln in EINER Reihe (Icon + Wort): dieselben Wege, rund 140 px weniger Seitenlänge.
function homeMoreHTML(){
  const q=(fn,ic,t)=>`<button class="qcard" onclick="${fn}" aria-label="${t}"><span class="ic">${icon(ic,22)}</span><div class="t">${t}</div></button>`;
  return `<div class="section-label"><span>Mehr</span></div><div class="quick mini">
    ${q("typeof openMeasure==='function'?openMeasure():go('tracker')",'ruler','Maße')}
    ${q("typeof openPhotos==='function'?openPhotos():go('tracker')",'camera','Foto')}
    ${q("typeof openCalendar==='function'?openCalendar():go('workout')",'calendar','Kalender')}
    ${q("typeof openAchievements==='function'?openAchievements():go('tracker')",'trophy','Erfolge')}
  </div>`;}

// ===== A-III.2: DIE EINE EHRLICHE KARTE =====
// Es ist nichts da – und genau das steht dann hier. „Bereitschaft 0", „0 Sätze", „0 / 3.017 kcal" oder
// „noch keine Folge" wären Aussagen über Daten, die diese App gerade gar nicht kennt; ein Leerzustand
// („Noch keine Cardio-Einheiten", „Starte heute") wäre eine Aussage über den Nutzer, die niemand geprüft
// hat. Unterschieden werden zwei Lagen, und nur diese zwei:
//   status 0     → keine Antwort. Und es liegt kein Schnappschuss auf diesem Gerät – sonst hätte
//                  API.get (A-III.1) längst 200 mit `stale:true` geliefert und wir wären nie hier.
//   status ≥ 400 → der Server HAT geantwortet, nur abschlägig. „Offline" wäre hier gelogen.
// Eine Funktion für alle fünf Bereichsdateien (ein globaler Scope, Präfix `stl`) – damit dieselbe Lage
// überall denselben Satz bekommt. `sache` ist der PLURALE Gegenstand OHNE Possessiv („Cardio-Einheiten").
// Das Possessiv setzt diese Funktion, denn es hängt vom Blick ab: im Coach-Blick gehören die Daten nicht
// dem Leser, und „Deine Cardio-Einheiten" wäre dort an den Falschen gerichtet (wie RATE-coach 11). Die
// Regel steht deshalb hier an einer Stelle und nicht in vier Aufrufen, die sie einzeln vergessen können.
function stlNotLoaded(sache,st,retry){
  const off=!st||st===0;
  sache=sache||'Zahlen';
  const was=(typeof coachView==='function'&&coachView())?('Die '+sache+' dieses Athleten'):('Deine '+sache);
  return emptyState({icon:off?'devices':'alertTriangle',title:'Noch nicht geladen',
    text:off?was+' liegen auf dem Server und sind auf diesem Gerät noch nicht gespeichert. Sobald du wieder Netz hast, ist alles da.'
      :was+' konnten nicht geladen werden'+(st?' (Fehler '+st+')':'')+'. Gespeichert ist auf dem Server alles.',
    btn:retry?{label:'Wiederholen',onclick:retry}:null});}

// ===== RENDER =====
// 401/403 im Coach-Blick ist kein Ladefehler, sondern eine Auskunft: dieser Athlet ist für dich nicht
// (mehr) freigegeben. „Noch nicht geladen (Fehler 403)" schickte den Coach ins Leere – mit „Wiederholen"
// als einzigem Weg, der garantiert wieder dasselbe liefert. Wortgleich zur Ernährung (diet.js dtErrNote),
// damit beide Bereiche dieselbe Lage gleich benennen.
function stlNotLoadedHTML(st){
  if((st===401||st===403)&&typeof coachView==='function'&&coachView())
    return emptyState({icon:'lock',title:'Kein Zugriff',
      text:'Die Startseite dieses Athleten ist für dich nicht freigegeben. Wähle einen Athleten aus deiner Liste.',
      btn:{label:'Zu den Athleten',onclick:"go('athletes')"}});
  return stlNotLoaded('Zahlen',st,'stlRetryHome()');}
function stlRetryHome(){
  if(typeof invalidateView==='function')try{invalidateView('home');}catch(e){}
  HOME_DATA=null;loadHomeData.uid=null;go('home');}
function homePatchHero(){const el=document.getElementById('homeNow');if(!el)return;el.outerHTML=nowCardHTML();homeCache();}
async function renderHome(v,opts){
  opts=opts||{};
  const mounted=!!(v&&v.querySelector('#homePage'));
  if(!opts.cached&&!mounted)v.innerHTML=`<div class="page on first" id="homePage">${skeleton(4)}</div>`;
  const d=await loadHomeData();
  if(!d){v.innerHTML=`<div class="page on" id="homePage">${stlNotLoadedHTML(STL_HOME_ST)}</div>`;return;}
  const s=homeState();
  HOME_CI_SHEET=false; // frisch aufgebaut: kein Sheet offen, Check-in-Karte immer kurz
  CHECKIN_DATE=today();

  let html=`<div class="page on${(opts.cached||mounted)?'':' first'}" id="homePage">`;
  // Einstieg ohne Plan/Ziele (nur eigenes Konto)
  if(s.own&&!PLAN?.days?.length&&!s.T?.kcal?.train){
    html+=`<div class="today"><div class="eyebrow">Erste Schritte</div>
      <div class="daytype">Dein Plan</div>
      <div class="meta">In unter einer Minute zu Trainingsplan und Kalorienzielen.</div>
      <button class="btn block mt-4" onclick="startOnboarding()">Jetzt einrichten</button></div>`;
    html+='</div>';v.innerHTML=html;homeCache();return;}

  // Coach/Admin im Athleten-Kontext: Coach-Zusammenfassung statt der eigenen Logging-Oberfläche
  if(coachView()){
    let cc='';
    if(typeof coachHomeCard==='function'){try{cc=coachHomeCard()||'';}catch(e){cc='';}}
    if(!cc){const lc=s.cis[0];
      cc=`<div class="card mb-3"><div class="eyebrow mb-1">Coach-Übersicht</div><div class="h2">${esc2(COACH_CONTEXT||'')}</div>
        <div class="meta mt-1">Letzter Check-in: ${lc?esc2(fmtDate(lc.date,{weekday:'short'}))+(lc.weight!=null?' · '+fmtNum(lc.weight,1)+' kg':''):'noch keiner'}</div></div>`;}
    html+=cc;
  }
  html+=nowCardHTML();
  // ZWEI ZEICHENPFADE (BUILD-A4 3.7). „neu" ist der Standard; „klassisch" ist wortwörtlich die
  // Reihenfolge aus 2.7.0 – kein zweiter Satz Funktionen, nur eine andere Zusammenstellung.
  if(hmNew()&&s.own){
    // Die Statuszeile gehört in BEIDE Pfade. Sie trägt „Rad fällig" und die laufende Challenge –
    // und weder das Rad noch die Challenge hat einen Ring. Ohne sie kostete das Rad des Lebens
    // 3 Taps (Ring „Mindset" → Reiter „Rad" → „Jetzt bewerten") statt einem; das war keine
    // entfernte Wiederholung, sondern ein entfernter Einstieg (CRITIC K3, BUILD-A4 3:
    // „Doppelungen entfernen, NICHT Einstiege"). homeMindStatusHTML() prüft selbst auf
    // mw.status.text und liefert sonst den leeren String – Höhe kostet die Zeile also nur,
    // wenn es etwas zu sagen gibt.
    html+=homeMindStatusHTML();
    html+=`<div id="homeLast">${hmLastHTML()}</div>`;
    html+=`<div id="homeGoals">${hmTodayHTML()}</div>`;
    html+=homeProgressHTML();
    html+=hmMoreHTML();
  }else{
    html+=homeMindStatusHTML();
    html+=`<div id="homeGoals">${drawHomeGoals()}</div>`;
    html+=`<div class="card mb-3" id="homeCheckin">${homeCheckinHTML()}</div>`;
    html+=`<div id="homeFood">${homeFoodHTML()}</div>`;
    html+=`<div id="homeSupp">${homeSuppHTML()}</div>`;
    html+=homeProgressHTML();
    if(s.own)html+=homeMoreHTML();
    if(s.own)html+=`<div class="hm-sw"><button class="btn sm ghost" onclick="openHomeVariantSheet()">Startseite: klassisch – umstellen</button></div>`;
  }
  html+='</div>';
  // Beim Auffrischen einer schon stehenden Seite die Scrollposition halten: das Ersetzen des Inhalts
  // staucht das Dokument kurz zusammen, der Browser würde sonst nach oben klemmen.
  const keepY=(opts.cached||mounted)?window.scrollY:0;
  v.innerHTML=html;
  if(keepY){window.scrollTo(0,keepY);requestAnimationFrame(()=>window.scrollTo(0,keepY));}
  homeCache();
  // Der reservierte Mindset-Platz wird eingenommen, sobald das nachgeladene Modul da ist.
  if(stlMindPending(s))stlMindWatch();
  // „Zuletzt" braucht keinen Nachlauf mehr: die Zahlen stehen seit der Nachbesserung im Home-Aggregat.
  // Tour erst jetzt – der Hero steht, nichts liegt über dem Header (WP1)
  if(typeof maybeStartTour==='function'){try{maybeStartTour();}catch(e){}}
  // A-V.3: Die Frage nach Erinnerungen steht als ruhige ZEILE auf der Seite, nicht als Sheet, das
  // sich von selbst über die Startseite legt. Ob sie überhaupt etwas bewirken kann (Push aus,
  // erlaubt, auf iOS installiert), weiß erst pushStatus() – also wird die Zeile versteckt gezeichnet
  // und erst danach freigegeben oder entfernt. So springt beim Zeichnen nichts.
  // HIER ÖFFNET SICH NICHTS VON SELBST – und das ist eine Messung, keine Meinung.
  // Versuch (2.9.0, verworfen): Trichter bzw. Erinnerungs-Frage 1,2 s nach dem Zeichnen als Sheet.
  // Ergebnis tools/tapcount.mjs: Fluss `set` FEHLER – das Sheet legte sich über die Tab-Leiste, der
  // nächste Tipp landete auf dem Hintergrund. Was ein Messwerkzeug so trifft, trifft einen Menschen
  // genauso: 1,2 s nach dem Start tippt er schon. Ein Sheet, das sich selbst öffnet, ist deshalb raus.
  // Der Trichter kommt stattdessen dort, wo er niemanden unterbricht:
  //   · die schmale Zeile unter dem Header (account.js/maybeShowInstallHint) – seit der Fix-Runde
  //     auf ALLEN Plattformen und bei jedem Tabwechsel, nicht nur einmal 1,6 s nach dem App-Start
  //     (core.js). Gemessener Grund: wer sein erstes Training in der laufenden Sitzung abschließt,
  //     erfüllt die Bedingung erst danach – bis eben sah er die Zeile frühestens beim nächsten
  //     Start. Die Funktion sperrt sich selbst (Zeile schon da, 30 Tage Ruhe, läuft als App), ein
  //     Aufruf zu viel kostet also nichts.
  //     AUF DER STARTSEITE steht sie nicht: 981 px + 83 px Zeile = 1.064 px, und Home ist die
  //     einzige Ansicht mit Höhenbudget (accent.mjs, Ziel < 1.000). Der Aufruf hier räumt sie
  //     deshalb weg und meldet den Tabwechsel-Zuhörer an – Einzelheiten in account.js.
  //   · überall: Profil → Daten → „Als App installieren", und auf iOS führt auch der Push-Schalter
  //     dorthin (pushStatus liefert dort `install`).
  // Die Frage nach Erinnerungen kommt nach einem GESPEICHERTEN Check-in (siehe lpAfterEntry) – das ist
  // der Anlass, den CRITIC K7 verlangt, und dort unterbricht sie nichts.
  lpInstallNudge();
}
// EIN Anstoß für den Trichter, von überall aufrufbar (Startseite gezeichnet, Check-in gespeichert,
// Training beendet). maybeShowInstallHint() prüft alle Bedingungen selbst; hier steht nur die kleine
// Verzögerung, damit die Zeile nicht mitten in das Zeichnen springt.
function lpInstallNudge(ms){
  try{setTimeout(()=>{try{
    if(document.querySelector('#modal.on'))return;   // nichts unter einem offenen Sheet verschieben
    if(typeof maybeShowInstallHint==='function')maybeShowInstallHint();
  }catch(e){}},ms==null?900:ms);}catch(e){}}

// ===== BULK-NACHTRAGEN =====
let BULK_SEL=new Set(), BULK_CIS={};
function bulkChipsHTML(){
  const tdy=today();let chips='';
  for(let i=0;i<14;i++){const d=new Date(tdy+'T00:00:00');d.setDate(d.getDate()-i);const iso=fmt(d);
    const c=BULK_CIS[iso]||{};const has=c.weight!=null||c.sleep!=null||c.steps!=null||c.water!=null;
    const lbl=i===0?'Heute':i===1?'Gestern':fmtDate(iso,{weekday:'short'});
    const on=BULK_SEL.has(iso);
    chips+=`<button class="chip${on?' on':(has?' done':'')}" onclick="bulkToggleDay('${iso}')">${on?icon('check',14):''}${esc2(lbl)}</button>`;}
  return chips;}
function bulkToggleDay(iso){if(BULK_SEL.has(iso))BULK_SEL.delete(iso);else BULK_SEL.add(iso);
  const c=document.getElementById('bk_chips');if(c)c.innerHTML=bulkChipsHTML();
  const b=document.getElementById('bk_apply');const n=BULK_SEL.size;
  if(b){b.disabled=!n;b.textContent=n?('Auf '+pl(n,'Tag','Tage')+' anwenden'):'Erst Tage auswählen';}}
async function openBulkCheckin(){
  openSheet('Mehrere Tage nachtragen','<div class="spinner"></div>');
  // 14 Tages-Chips -> 14 Tage; die volle Historie färbte hier nur Chips ein.
  const r=await API.get(homeCheckinPath(VIEW_USER));const cis=r.data?.checkins||[];
  BULK_CIS={};cis.forEach(c=>BULK_CIS[c.date]=c);BULK_SEL=new Set();
  openSheet('Mehrere Tage nachtragen',`
    <div class="note mb-3">Werte eintragen, dann die Tage auswählen und mit einem Tipp auf alle übernehmen. Leere Felder bleiben unverändert.</div>
    <div class="grid-2">
      <div class="field"><label>Gewicht (kg)</label><input id="bk_weight" type="number" step="0.1" inputmode="decimal" placeholder="z.B. 63"></div>
      <div class="field"><label>Schlaf (h)</label><input id="bk_sleep" type="number" step="0.5" inputmode="decimal" placeholder="z.B. 8"></div>
      <div class="field"><label>Schritte</label><input id="bk_steps" type="number" inputmode="numeric" placeholder="z.B. 9000"></div>
      <div class="field"><label>Wasser (L)</label><input id="bk_water" type="number" step="0.1" inputmode="decimal" placeholder="z.B. 3"></div>
    </div>
    <div class="section-label"><span>Tage auswählen</span><span class="sl-r">markiert = schon Daten</span></div>
    <div id="bk_chips" class="chip-row wrap mb-4">${bulkChipsHTML()}</div>
    <button class="btn block" id="bk_apply" disabled onclick="saveBulkCheckin()">Erst Tage auswählen</button>`);}
async function saveBulkCheckin(){
  if(!BULK_SEL.size)return toast('Bitte Tage auswählen');
  const vals={};const w=num('bk_weight'),sl=num('bk_sleep'),st=num('bk_steps'),wa=num('bk_water');
  if(w!=null)vals.weight=w;if(sl!=null)vals.sleep=sl;if(st!=null)vals.steps=st;if(wa!=null)vals.water=wa;
  if(!Object.keys(vals).length)return toast('Bitte mindestens einen Wert eingeben');
  const btn=document.getElementById('bk_apply');if(btn)btn.disabled=true;
  let n=0,refunded=0,queued=0;
  for(const d of BULK_SEL){const r=await API.post('/checkins',{user_id:VIEW_USER,date:d,...vals},{queue:true,kind:'checkin',label:'Check-in '+fmtDate(d)});
    if(!okRes(r))continue;
    n++;
    if(wasQueued(r)){queued++;homeMergeCheckin(d,vals);}
    else if(r.data?.jokerRefunded)refunded++;}
  closeAllSheets();
  // `n` sind alle gespeicherten Tage, `queued` nur die wartenden – kommt das Netz mitten in der Schleife
  // zurück, sind das zwei verschiedene Zahlen, und nur `queued` steht auch im Kopf-Zähler (syncBadge).
  // Numerus passend zur Zahl: „1 Tag … wird", „3 Tage … werden".
  const sent=n-queued;
  toast(!queued?pl(n,'Tag','Tage')+' nachgetragen ✓'
    :sent?pl(sent,'Tag','Tage')+' nachgetragen ✓ · '+pl(queued,'Tag','Tage')+' offline gespeichert'
    :pl(queued,'Tag','Tage')+' offline gespeichert – '+(queued===1?'wird':'werden')+' nachgetragen, sobald du online bist');
  if(refunded)setTimeout(()=>toast(pl(refunded,'Reparatur','Reparaturen')+' zurückerstattet'),1800);
  if(typeof refreshAchievements==='function')refreshAchievements();
  invalidateView('tracker');
  // Startseite an Ort und Stelle nachziehen (kein go('home'), keine Scroll-Rückstellung).
  // Wartet auch nur ein Tag in der Outbox, wird NICHT nachgeladen: der Serverstand kennt ihn noch nicht.
  if(!queued){
    const own=(VIEW_USER===ME.id&&ME.role==='athlete');
    const [cr,ir]=await Promise.all([API.get(homeCheckinPath(VIEW_USER)),own?API.get('/insights/'+VIEW_USER):Promise.resolve(null)]);
    if(cr.status===200){HOME_CIS=cr.data?.checkins||[];if(HOME_DATA)HOME_DATA.checkins=HOME_CIS;}
    if(ir&&ir.status===200){if(HOME_DATA)HOME_DATA.insights=ir.data;try{LAST_INSIGHTS=ir.data;}catch(e){}}}
  homePatch('homeGoals',hmGoalsHTML());homePatch('homeCheckin',homeCheckinHTML());homePatchHero();homeCache();}

// ===== STREAK-JOKER =====
function openStreakInfo(){
  const f=((typeof LAST_INSIGHTS!=='undefined'&&LAST_INSIGHTS)?LAST_INSIGHTS.freezes:null)||(HOME_DATA?.insights?.freezes)||{};
  const fb=f.balance==null?1:f.balance,mx=f.max||2;
  // 2.9.0 (A-V.3, BUILD-A5 5.6): „Streak-Joker" heißt ab jetzt „Reparatur". Der Name folgt der
  // EINEN Mechanik (Wochen-Konsistenz): repariert wird ein Tag, nicht eine Serie gerettet.
  // Die Zahlen sind unverändert die des Servers (insights.freezes) – hier wird nichts gerundet und
  // nichts versprochen, was der Server nicht hält: `maxPer30Days` ist die echte Obergrenze.
  const per30=f.maxPer30Days==null?mx:f.maxPer30Days;
  openSheet('Reparatur',`
    <div class="center mb-4">${ring(mx?Math.min(1,fb/mx):0,{size:96,color:'var(--blue)',label:fmtNum(fb)+' / '+fmtNum(mx),sub:'Reparatur'})}</div>
    <div class="note mb-3">Eine <b>Reparatur</b> trägt automatisch einen Tag nach, an dem du nichts eingetragen hast. Deine Wochen-Konsistenz bleibt damit stehen.</div>
    <div class="note status mb-3">Ein reparierter Tag zählt mit, ist aber <b>kein Check-in</b>. Die Zahl deiner echten Einträge bleibt darunter – und wenn du den Tag später selbst nachträgst, bekommst du die Reparatur zurück.</div>
    <div class="rows mb-4">
      <div class="row"><div class="r-ic">${icon('shield')}</div><div class="rl">Automatisch<small>Vergisst du einen Tag, wird er repariert – du musst nichts tun</small></div></div>
      <div class="row"><div class="r-ic">${icon('calendar')}</div><div class="rl">Nachschub<small>+1 pro aktiver Woche, höchstens ${fmtNum(per30)} in 30 Tagen</small></div></div>
      <div class="row"><div class="r-ic">${icon('pencil')}</div><div class="rl">Selbst nachtragen<small>Vergessene Tage kannst du jederzeit von Hand nachpflegen</small></div></div>
    </div>
    <button class="btn block sec" onclick="closeModal()">Verstanden</button>`);}

// ===== GEMEINSAME HELFER: Ring + Diagramme (WP0; genutzt von Home, Training, Analyse, Mindset) =====
// ring(pct,{size=84,stroke,color,track,label,sub}) – pct 0..1, SVG-String.
// Kompatibel: ring(val,max) wie bisher (Zahl im Ring, „/ max" darunter) – Aufrufer erkennt sich an der Zahl als 2. Argument.
// Beschriftung IM Ring: Platz ist nur die Sehne des inneren Kreises auf Höhe der Zeile. Lange Untertitel
// („kcal Überschuss") liefen sonst links und rechts über den Ring-Strich. Daher erst kleiner setzen,
// und wenn das nicht reicht, mit textLength stauchen – der Text bleibt in jedem Fall innerhalb des Rings.
function _ringFit(s,cx,y,fs,wide,rIn){let f=fs,maxW=0;
  const room=(g)=>{const dy=Math.abs(y-cx)+g*.38;return Math.max(8,2*(Math.sqrt(Math.max(0,rIn*rIn-dy*dy))-1.5));};
  for(let i=0;i<3;i++){maxW=room(f);const est=s.length*f*wide;
    if(est<=maxW)return {f,tl:0};
    const nf=Math.max(fs*.62,f*maxW/est);if(nf>=f)break;f=nf;}
  maxW=room(f);
  return {f,tl:(s.length*f*wide>maxW)?maxW:0};}
function _ringText(txt,cx,y,fs,bold,fill,rIn){const s=String(txt);
  const w=_ringFit(s,cx,y,fs,bold?.6:.52,rIn);
  return `<text x="${cx}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${Math.round(w.f*10)/10}"${bold?' font-weight="700"':''} fill="${fill}"${w.tl?` textLength="${w.tl.toFixed(1)}" lengthAdjust="spacingAndGlyphs"`:''}>${esc2(s)}</text>`;}
function ring(a,b){let pct=0,o={};
  if(b!=null&&typeof b!=='object'){const max=+b||0,val=+a||0;pct=max?Math.min(1,val/max):0;o={label:String(a),sub:'/ '+b};}
  else{pct=Math.max(0,Math.min(1,+a||0));o=b||{};}
  const size=o.size||84,stroke=o.stroke||Math.max(3,Math.round(size*.085)),r=(size-stroke)/2,c=2*Math.PI*r,off=c*(1-pct),cx=size/2;
  const color=o.color||'var(--red)',track=o.track||'var(--surface3)';
  const hasSub=o.sub!=null&&o.sub!=='';
  const rIn=(size-stroke*2)/2-1; // freier Innenradius (Innenkante des Rings)
  const label=(o.label!=null&&o.label!=='')?_ringText(o.label,cx,hasSub?cx-size*.07:cx,Math.round(size*.18),true,'var(--ink)',rIn):'';
  const sub=hasSub?_ringText(o.sub,cx,cx+size*.14,Math.round(size*.12),false,'var(--ink2)',rIn):'';
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle class="ring-fg" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>
    ${label}${sub}</svg>`;}
function sparkline(vals){if(vals.length<2)return'';const w=480,h=120,pad=10;
  const mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;
  const pts=vals.map((v,i)=>[pad+i*(w-2*pad)/(vals.length-1),h-pad-((v-mn)/rng)*(h-2*pad)]);
  const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=d+` L${pts[pts.length-1][0].toFixed(1)} ${h-pad} L${pts[0][0].toFixed(1)} ${h-pad} Z`;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${area}" fill="var(--red-tint)"/>
    <path d="${d}" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="var(--red)"/>`).join('')}
  </svg>`;}

// --- Diagramm-Engine: viewBox 340×220, Achsentext ≥ 11 px in --ink2, „schöne" Ticks, keine Einheit im SVG
// (die trägt der Kartenkopf .ch-h .v). opts: {step, domain:[min,max], tickFmt(v), avg:7, partialLast:true, overBad:true}
function _niceStep(range,n){n=n||4;const raw=(range||1)/n;const p=Math.pow(10,Math.floor(Math.log10(raw)));const f=raw/p;
  return (f<=1?1:f<=2?2:(f<=2.5&&p>=10)?2.5:f<=5?5:10)*p;}
function _domain(vals,goal,opts){opts=opts||{};let mn=Math.min(...vals),mx=Math.max(...vals);
  if(goal!=null){mn=Math.min(mn,goal);mx=Math.max(mx,goal);}
  if(opts.domain){mn=+opts.domain[0];mx=+opts.domain[1];}
  const step=opts.step||_niceStep((mx-mn)||Math.abs(mn)*.2||1,4);
  if(!opts.domain){const pad=(mx-mn)*.08;mn=Math.floor((mn-pad)/step)*step;mx=Math.ceil((mx+pad)/step)*step;if(mx-mn<step)mx=mn+step;
    if(Math.min(...vals)>=0&&(goal==null||goal>=0)&&mn<0)mn=0;} // nie unter 0 bei nicht-negativen Daten
  return {mn,mx,step};}
function _ticks(dom){const out=[];for(let v=dom.mn;v<=dom.mx+dom.step*1e-6;v+=dom.step)out.push(Math.round(v*1e6)/1e6);return out;}
function _tickFmt(v,step,opts){if(opts&&opts.tickFmt)return opts.tickFmt(v);const d=step>=1?0:Math.min(3,Math.max(1,Math.ceil(-Math.log10(step))));return fmtNum(v,d);}
// Achsentext: die 340er-viewBox wird auf die Kartenbreite skaliert, auf einem 320-px-Telefon also auf 0,75.
// Damit die Beschriftung nie unter 11 CSS-Pixel rutscht, wird die Schriftgröße in viewBox-Einheiten
// gegengerechnet (auf breiten Karten bleibt es bei 11).
function _chartFS(){let w=0;
  try{const v=document.getElementById('views');w=v?v.clientWidth-64:0;}catch(e){}
  if(!w||w<160)w=(window.innerWidth||375)-64;
  return Math.ceil(Math.max(11,11*340/Math.max(200,w))*10)/10;}
function _axisW(ticks,step,opts,fs){return 10+Math.max(...ticks.map(v=>String(_tickFmt(v,step,opts)).length))*(fs||11)*0.6;}
function _xLabels(pts,X,H,fs){const dl=t=>new Date(t).toLocaleDateString('de-DE',{day:'numeric',month:'numeric'});
  const idx=[0,Math.floor((pts.length-1)/2),pts.length-1];const seen=new Set();let out='';
  idx.forEach((i,k)=>{const lbl=dl(pts[i].t);if(seen.has(lbl))return;seen.add(lbl);
    out+=`<text x="${X(pts[i].t).toFixed(1)}" y="${H-8}" text-anchor="${k===0?'start':k===2?'end':'middle'}" font-size="${fs||11}" fill="var(--ink2)">${lbl}</text>`;});
  return out;}
function _rolling(pts,k){return pts.map((p,i)=>{const s=pts.slice(Math.max(0,i-k+1),i+1);return {t:p.t,v:s.reduce((a,q)=>a+q.v,0)/s.length};});}
function _path(pts,X,Y){return pts.map((q,i)=>(i?'L':'M')+X(q.t).toFixed(1)+' '+Y(q.v).toFixed(1)).join(' ');}

// Verlaufs-Chart mit beschrifteten Achsen (X = Datum, Y = Wert) und optionaler Ziel-Linie.
// rows: [{date,value}] (älteste zuerst). goal: Zielwert -> gestrichelte grüne Linie, Label links oben an der Linie;
// Punkte ≥ Ziel grün (opts.overBad: über Ziel rot). opts.avg=7 -> gleitender Schnitt als Hauptlinie, Rohwerte dünn grau.
function metricChart(rows,unit,goal,goalLabel,opts){opts=opts||{};
  const pts=(rows||[]).filter(d=>d.value!=null&&d.date).map(d=>({t:Date.parse(d.date+'T00:00'),v:+d.value})).filter(d=>!isNaN(d.t)&&!isNaN(d.v)).sort((a,b)=>a.t-b.t);
  if(pts.length<2)return '<div class="caption mt-2 mb-2">Zu wenig Daten – ab 2 Einträgen erscheint hier die Kurve.</div>';
  const W=340,H=220,R=12,T=16,B=28,FS=_chartFS();
  const dom=_domain(pts.map(p=>p.v),goal,opts),ticks=_ticks(dom),L=_axisW(ticks,dom.step,opts,FS);
  const tMin=pts[0].t,tMax=pts[pts.length-1].t,tRng=(tMax-tMin)||1;
  const X=t=>L+((t-tMin)/tRng)*(W-L-R),Y=v=>T+(1-(v-dom.mn)/((dom.mx-dom.mn)||1))*(H-T-B);
  const grid=ticks.map(v=>{const y=Y(v).toFixed(1);return `<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="var(--hairline2)" stroke-width="1"/><text x="${L-6}" y="${(+y+4).toFixed(1)}" text-anchor="end" font-size="${FS}" fill="var(--ink2)">${_tickFmt(v,dom.step,opts)}</text>`;}).join('');
  let goalLine='';if(goal!=null){const gy=Y(goal).toFixed(1);
    goalLine=`<line x1="${L}" y1="${gy}" x2="${W-R}" y2="${gy}" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${L+4}" y="${(+gy-5).toFixed(1)}" text-anchor="start" font-size="${FS}" font-weight="600" fill="var(--green)">${esc2(goalLabel||('Ziel '+_tickFmt(goal,dom.step,opts)+(unit?' '+unit:'')))}</text>`;}
  const series=opts.avg?_rolling(pts,+opts.avg):pts;
  const raw=opts.avg?`<path d="${_path(pts,X,Y)}" fill="none" stroke="var(--ink3)" stroke-width="1" stroke-linejoin="round" opacity=".7"/>`:'';
  const main=`<path d="${_path(series,X,Y)}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  const dotCol=q=>goal==null?'var(--ink)':(opts.overBad?(q.v>goal?'var(--red-text)':'var(--ink)'):(q.v>=goal?'var(--green)':'var(--ink)'));
  const rad=series.length>30?2:3;
  const dots=series.map((q,i)=>{const x=X(q.t).toFixed(1),y=Y(q.v).toFixed(1);
    if(opts.partialLast&&i===series.length-1)return `<circle cx="${x}" cy="${y}" r="4" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/><text x="${x}" y="${(+y-9).toFixed(1)}" text-anchor="end" font-size="${FS}" fill="var(--ink3)">läuft</text>`;
    return `<circle cx="${x}" cy="${y}" r="${rad}" fill="${dotCol(q)}"/>`;}).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    ${grid}${goalLine}<line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="var(--hairline2)" stroke-width="1"/>
    ${raw}${main}${dots}${_xLabels(pts,X,H,FS)}
  </svg>`;}

// Datums-basiertes Liniendiagramm (eine Reihe, ohne Ziel). data = [{date:'YYYY-MM-DD', value}] – gleiche Engine wie metricChart.
function lineChart(data,unit,opts){
  const pts=(data||[]).filter(d=>d.value!=null&&d.date);
  if(pts.length<2)return '<div class="caption mt-2 mb-2">Zu wenig Daten für ein Diagramm – ab 2 Einträgen erscheint hier die Kurve.</div>';
  return metricChart(pts,unit,null,null,opts);}

// Doppellinien-Diagramm: zwei Messreihen mit eigener y-Achse (links v1 in --ink, rechts v2 in --blue),
// datums-basierte x-Achse mit Lücken-Logik. Für Übungs-Verlauf (Gewicht + Wiederholungen).
// opts: {step1,domain1,step2,domain2,tickFmt1,tickFmt2}
function lineChart2(data,label1,unit1,label2,unit2,opts){opts=opts||{};
  const pts=(data||[]).filter(d=>d.date&&(d.v1!=null||d.v2!=null)).map(d=>({t:Date.parse(d.date+'T00:00'),v1:d.v1,v2:d.v2})).filter(d=>!isNaN(d.t)).sort((a,b)=>a.t-b.t);
  if(pts.length<2)return '<div class="caption mt-2 mb-2">Ab der zweiten Trainingseinheit erscheint hier deine Fortschrittskurve.</div>';
  const W=340,H=220,T=24,B=28,FS=_chartFS();
  const v1s=pts.map(p=>p.v1).filter(v=>v!=null),v2s=pts.map(p=>p.v2).filter(v=>v!=null);
  const d1=_domain(v1s.length?v1s:[0],null,{step:opts.step1,domain:opts.domain1}),d2=_domain(v2s.length?v2s:[0],null,{step:opts.step2,domain:opts.domain2});
  const t1=_ticks(d1);const o1={tickFmt:opts.tickFmt1},o2={tickFmt:opts.tickFmt2};
  const L=_axisW(t1,d1.step,o1,FS),Rp=_axisW(_ticks(d2),d2.step,o2,FS);
  const tMin=pts[0].t,tMax=pts[pts.length-1].t,tRng=(tMax-tMin)||1;
  const X=t=>L+((t-tMin)/tRng)*(W-L-Rp);
  const Y1=v=>T+(1-(v-d1.mn)/((d1.mx-d1.mn)||1))*(H-T-B),Y2=v=>T+(1-(v-d2.mn)/((d2.mx-d2.mn)||1))*(H-T-B);
  const grid=t1.map((v,i)=>{const y=Y1(v).toFixed(1);const f=(v-d1.mn)/((d1.mx-d1.mn)||1);const v2=d2.mn+(d2.mx-d2.mn)*f;
    return `<line x1="${L}" y1="${y}" x2="${W-Rp}" y2="${y}" stroke="var(--hairline2)" stroke-width="1"/><text x="${L-6}" y="${(+y+4).toFixed(1)}" text-anchor="end" font-size="${FS}" fill="var(--ink2)">${_tickFmt(v,d1.step,o1)}</text><text x="${W-Rp+6}" y="${(+y+4).toFixed(1)}" text-anchor="start" font-size="${FS}" fill="var(--blue)">${_tickFmt(v2,d2.step,o2)}</text>`;}).join('');
  const buildPath=(sel,Y)=>{let d='',pen=false;for(const p of pts){const v=sel(p);if(v==null){pen=false;continue;}d+=(pen?'L':'M')+X(p.t).toFixed(1)+' '+Y(v).toFixed(1)+' ';pen=true;}return d;};
  const dots=(sel,Y,color)=>pts.map(p=>{const v=sel(p);return v==null?'':`<circle cx="${X(p.t).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" fill="${color}"/>`;}).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" aria-hidden="true">
    ${grid}${_xLabels(pts,X,H,FS)}
    <path d="${buildPath(p=>p.v1,Y1)}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${buildPath(p=>p.v2,Y2)}" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots(p=>p.v1,Y1,'var(--ink)')}${dots(p=>p.v2,Y2,'var(--blue)')}
    <text x="${L}" y="12" font-size="${FS}" fill="var(--ink2)" font-weight="600">${esc2(label1||'')}</text>
    <text x="${W-Rp}" y="12" text-anchor="end" font-size="${FS}" fill="var(--blue)" font-weight="600">${esc2(label2||'')}</text>
  </svg>`;}

// ===== TAG-PICKER =====
// Zeilen statt gestapelter Buttons; der Rhythmus-Vorschlag ist markiert, der aktive Tag trägt den Haken.
function openDayPicker(){
  const days=(PLAN?.days||[]);
  const eff=homeEff();
  const cur=eff.type==='train'?(eff.dayName||''):eff.type;
  const sug=(HOME_DATA?.today||TODAY)?.suggestion||{};
  // Auswahlliste: jede Zeile ist ein Umschalter auf genau EINEN Tagtyp. Die Zeilen tragen deshalb
  // aria-pressed (der Haken rechts ist ein aria-hidden-Icon und sagt einem Screenreader nichts),
  // die Gruppe darum eine Beschriftung – sonst steht die Auswahl unvermittelt im Raum (A-II.6).
  let h='<div class="note mb-3">Wähle, was du heute machst. Trainings-Tage rotieren automatisch weiter – du kannst jederzeit abweichen.</div><div class="rows" role="group" aria-label="Tagesart wählen">';
  days.forEach(d=>{const on=cur===d.name;const isSug=sug.type==='train'&&sug.dayName===d.name;
    h+=`<div class="row h-tap" role="button" tabindex="0" aria-pressed="${on?'true':'false'}" onclick="setDay('train','${esc(d.name)}')"><div class="r-ic">${icon('dumbbell')}</div>
      <div class="rl">${esc2(d.name)}${isSug?'<small>Vorschlag aus deinem Rhythmus</small>':''}</div>
      <div class="rr">${on?icon('check',20,'tone-green'):''}</div></div>`;});
  h+=`<div class="row h-tap" role="button" tabindex="0" aria-pressed="${cur==='rest'?'true':'false'}" onclick="setDay('rest')"><div class="r-ic">${icon('moon')}</div>
      <div class="rl">Ruhetag${sug.type==='rest'?'<small>Vorschlag aus deinem Rhythmus</small>':''}</div>
      <div class="rr">${cur==='rest'?icon('check',20,'tone-green'):''}</div></div>
    <div class="row h-tap" role="button" tabindex="0" aria-pressed="${cur==='sick'?'true':'false'}" onclick="setDay('sick')"><div class="r-ic">${icon('bed')}</div>
      <div class="rl">Krank / Pause<small>Der Rhythmus verschiebt sich um einen Tag</small></div>
      <div class="rr">${cur==='sick'?icon('check',20,'tone-green'):''}</div></div></div>`;
  openSheet('Was machst du heute?',h);}
async function setDay(type,dayName){
  const r=await API.post('/today/'+VIEW_USER,{date:today(),type,day_name:dayName});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();
  await loadToday();
  if(HOME_DATA)HOME_DATA.today=TODAY;
  invalidateView('workout');invalidateView('diet');invalidateView('tracker');
  toast(type==='sick'?'Gute Besserung – gute Erholung ✓':'Aktualisiert ✓');
  // Hero + Ringe + Ernährung an Ort und Stelle nachziehen (kein go('home'))
  homePatchHero();homePatch('homeGoals',hmGoalsHTML());homePatch('homeFood',homeFoodHTML());homeCache();}

// ===== SUPPLEMENTS-CHECKLISTE (aus shell.js hierher verschoben – WP0) =====
// Supplements des angesehenen Nutzers: Pflicht oben hervorgehoben, Details auf Tippen.
async function openSupp(){openSheet('Supplements','<div class="spinner"></div>');
  await drawSuppSheet();}
let SUPP_TODAY=null;
// local=true zeichnet aus dem zuletzt geholten Stand (SUPP_TODAY) – nötig, wenn ein Haken offline gesetzt
// wurde: eine neue Anfrage gäbe es dann nicht, und der Serverstand kennt den Haken noch gar nicht.
async function drawSuppSheet(local){
  const uid=VIEW_USER||ME.id;
  if(!local){const r=await API.get('/supplement-intake/'+uid+'?date='+today());
    if(r.status!==200){openSheet('Supplements',`<div class="note err">${esc2(r.data?.error||'Fehler')}</div>`);return;}
    SUPP_TODAY=r.data;}
  if(!SUPP_TODAY)return;
  const {plan,extras,done,total}=SUPP_TODAY;
  const isOwn=(uid===ME.id);
  let h='';
  if(total>0){const pct=Math.round(done/total*100);
    h+=`<div class="card mb-4"><div class="between mb-2"><div class="h3">Heute</div>
      <div class="num-md${done===total?' tone-green':''}">${fmtNum(done)}/${fmtNum(total)}</div></div>
      <div class="bar${done===total?' green':''}"><i style="width:${pct}%"></i></div></div>`;}
  if(!plan.length&&!extras.length){
    h+=emptyState({icon:'pill',title:'Keine Supplements für heute',
      text:isOwn?'Dein Coach kann dir welche zuweisen – oder füge selbst hinzu, was du genommen hast.':'Diesem Athleten sind keine Supplements zugewiesen.'});}
  if(plan.length){
    const groups={};plan.forEach(p=>{const c=p.category||'Sonstige';(groups[c]=groups[c]||[]).push(p);});
    const order=['Morgens','Pre-Workout','Intra-Workout','Nach dem Training','Zu einer Mahlzeit','Täglich','Abends','Bei Bedarf'];
    const cats=Object.keys(groups).sort((a,b)=>{const ia=order.indexOf(a),ib=order.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);});
    cats.forEach(c=>{h+=`<div class="section-label"><span>${esc2(c)}</span></div><div class="rows mb-3">`+groups[c].map(p=>suppRow(p,isOwn)).join('')+'</div>';});}
  if(extras.length){h+=`<div class="section-label"><span>Zusätzlich genommen</span></div><div class="rows mb-3">`+extras.map(p=>suppRow(p,isOwn)).join('')+'</div>';}
  if(isOwn)h+=`<button class="btn block sec mt-4" onclick="openAddIntake()">${icon('plus',18)} Supplement hinzufügen</button>`;
  h+=infoBox('supp_check','Hier hakst du ab, was du heute genommen hast. Die Menge kannst du antippen und anpassen. Was dein Coach festgelegt hat, steht oben – eigene Ergänzungen darunter.');
  openSheet('Supplements',h);}
// eine Checklisten-Zeile (ganze Zeile abhakbar, Menge & Detail als eigene Aktionen)
function suppRow(p,isOwn){
  const checked=p.taken;
  // Ein abgehakter Eintrag vom Server hat IMMER eine intake_id (supplementIntakeView setzt taken:!!t und
  // intake_id:t.id). Fehlt sie trotz Haken, ist die Einnahme nur lokal gesetzt und wartet in der Outbox:
  // Abwählen (DELETE), Menge ändern und Entfernen hängen alle an dieser Server-ID und liefen ins Leere –
  // ein zweiter Tipp würde stattdessen denselben POST ein ZWEITES Mal einreihen. Also wartet die Zeile
  // sichtbar, statt sich wie eine servergedeckte zu verhalten (wortgleich zum Ernährungsprotokoll).
  const pending=!!checked&&p.intake_id==null;
  // Abhakbare Zeile = Umschalter: role/tabindex machen sie fuer Tastatur und Screenreader erreichbar,
  // aria-pressed sagt den Zustand, den sonst nur das (aria-hidden) Haken-Icon zeigt (A-II.6).
  const tap=(isOwn&&!pending)?` h-tap" role="button" tabindex="0" aria-pressed="${checked?'true':'false'}" onclick="toggleIntake(event,${p.supplement_id??'null'},${p.intake_id??'null'},'${esc(p.name)}','${esc(p.dose||'')}')`:'"';
  const act=pending?'<span class="pill neutral">wird nachgetragen</span>'
    :`${isOwn&&checked?`<button class="btn sm sec" onclick="event.stopPropagation();editIntakeDose(${p.intake_id},'${esc(p.name)}','${esc(p.dose||'')}')">Menge</button>`:''}
      ${p.supplement_id?`<button class="btn icon sm ghost" aria-label="Details zu ${esc2(p.name)}" onclick="event.stopPropagation();suppDetail(${p.supplement_id})">${icon('info',18)}</button>`
        :(isOwn?`<button class="btn icon sm ghost" aria-label="${esc2(p.name)} entfernen" onclick="event.stopPropagation();removeIntake(${p.intake_id},'${esc(p.name)}','${esc(p.dose||'')}')">${icon('x',18)}</button>`:'')}`;
  return `<div class="row${tap}">
    <div class="r-ic${checked?' tone-green':''}">${icon(checked?'check':'pill',22)}</div>
    <div class="rl${checked?' done':''}">${esc2(p.name)}${p.mandatory?' <span class="pill must">Pflicht</span>':''}
      <small>${p.dose?esc2(p.dose):'Menge offen'}${p.category?' · '+esc2(p.category):''}</small></div>
    <div class="rr">${act}</div></div>`;}
// Haken setzen bzw. entfernen. Ein Plan-Supplement bleibt beim Abwählen in der Liste stehen – ein eigener
// Eintrag existiert dagegen NUR als Einnahme-Zeile, Abwählen löscht ihn also. Damit derselbe Tipp nicht zwei
// sehr verschiedene Folgen hat, kommt beim eigenen Eintrag ein Undo-Toast dazu (und auf der Startseite bleibt
// die Zeile als leerer Haken stehen, siehe HOME_SUPP_OFF).
function suppIntakeBody(sid,name,dose){const b={supplement_id:sid===null||sid===undefined?undefined:sid,name,date:today()};
  if((sid===null||sid===undefined)&&dose)b.dose=dose;return b;}
function suppUndoToast(uid,name,dose,after){
  toast(name+' entfernt',{label:'Rückgängig',fn:async()=>{
    // Wurde die Zeile inzwischen wieder angetippt, gibt es den Eintrag schon – dann nicht doppelt anlegen
    const back=[...(HOME_DATA?.supplements?.extras||[]),...(SUPP_TODAY?.extras||[])].some(e=>e&&e.name===name);
    if(!back)await API.post('/supplement-intake/'+uid,suppIntakeBody(null,name,dose));
    HOME_SUPP_OFF=HOME_SUPP_OFF.filter(x=>!(x.date===today()&&x.name===name));
    if(typeof after==='function')await after();}});}
async function toggleIntake(ev,sid,intakeId,name,dose){if(ev)ev.stopPropagation();
  const uid=VIEW_USER||ME.id,free=(sid===null||sid===undefined);
  if(intakeId){const r=await API.del('/supplement-intake/'+uid+'/'+intakeId);
    // Abwählen ist ein DELETE auf eine Server-ID – die gibt es offline nicht, also kann das nicht warten.
    if(r.status===0)return toast('Dafür brauchst du kurz Netz');
    if(free)suppUndoToast(uid,name,dose,async()=>{await drawSuppSheet();await homeRefreshSupp();});}
  else{const r=await API.post('/supplement-intake/'+uid,suppIntakeBody(sid,name,dose),{queue:true,kind:'intake',label:'Supplement · '+name});
    if(!okRes(r))return toast(r.data?.error||'Fehler – nicht gespeichert');
    if(wasQueued(r)){toast('Offline gespeichert – wird nachgetragen, sobald du online bist');
      homeMarkSupp(sid,name,dose);await drawSuppSheet(true);return homePatchSupp();}}
  await drawSuppSheet();
  await homeRefreshSupp();}
// Abhaken direkt aus dem Home-Widget -> nur die betroffenen Blöcke nachziehen (kein Neuaufbau der Seite)
async function toggleIntakeHome(ev,sid,intakeId,name,dose){if(ev)ev.stopPropagation();
  const free=(sid===null||sid===undefined),T=today();
  if(intakeId){const r=await API.del('/supplement-intake/'+ME.id+'/'+intakeId);
    // Abwählen ist ein DELETE auf eine Server-ID – die gibt es offline nicht, also kann das nicht warten.
    if(r.status===0)return toast('Dafür brauchst du kurz Netz');
    // Eigener Eintrag: Zeile bleibt als leerer Haken stehen (erneut antippen = wieder eintragen) + Undo-Toast
    if(free){if(!HOME_SUPP_OFF.some(x=>x.date===T&&x.name===name))HOME_SUPP_OFF.push({date:T,name,dose:dose||''});
      suppUndoToast(ME.id,name,dose,homeRefreshSupp);}}
  else{const r=await API.post('/supplement-intake/'+ME.id,suppIntakeBody(sid,name,dose),{queue:true,kind:'intake',label:'Supplement · '+name});
    if(!okRes(r))return toast(r.data?.error||'Fehler – nicht gespeichert');
    if(free)HOME_SUPP_OFF=HOME_SUPP_OFF.filter(x=>!(x.date===T&&x.name===name));
    // Offline: den Haken lokal setzen und nur zeichnen – nachladen würde ihn sofort wieder aufheben.
    if(wasQueued(r)){toast('Offline gespeichert – wird nachgetragen, sobald du online bist');
      homeMarkSupp(sid,name,dose);return homePatchSupp();}}
  await homeRefreshSupp();}
// Offline abgehakt: die Zeile lokal auf „genommen" setzen. Sonst springt der Haken beim nächsten Zeichnen
// zurück, obwohl der Eintrag längst in der Outbox wartet.
function homeMarkSupp(sid,name,dose){
  [(HOME_DATA&&HOME_DATA.supplements)||null,SUPP_TODAY].forEach(sup=>{if(!sup)return;
    const hit=[...(sup.plan||[]),...(sup.extras||[])].find(p=>p&&((sid!=null&&p.supplement_id===sid)||(sid==null&&p.name===name)));
    if(hit){if(!hit.taken){hit.taken=true;if(sid!=null)sup.done=(+sup.done||0)+1;}}
    // Nur ein eigener Eintrag kann fehlen (er wurde vorhin abgewählt); ein Plan-Supplement steht immer in der Liste.
    else if(sid==null)sup.extras=[...(sup.extras||[]),{supplement_id:null,intake_id:null,name,dose:dose||'',taken:true,mandatory:false}];});}
// Home-Blöcke neu zeichnen (nur wenn die Startseite steht) – ohne Serveranfrage
function homePatchSupp(){
  if(!document.getElementById('homePage'))return;
  homePatch('homeSupp',homeSuppHTML());homePatch('homeGoals',hmGoalsHTML());homePatchHero();homeCache();}
// Supplement-Stand neu holen und Home-Blöcke patchen (nur wenn die Startseite steht)
async function homeRefreshSupp(){
  if(!document.getElementById('homePage'))return;
  const uid=VIEW_USER||ME.id;
  const r=await API.get('/supplement-intake/'+uid+'?date='+today());
  if(r.status!==200||!HOME_DATA)return;
  HOME_DATA.supplements=r.data;
  homePatchSupp();}
// Eigenen Eintrag ganz entfernen (X in der Zeile) – mit Undo-Toast, nichts verschwindet endgültig auf einen Tipp
async function removeIntake(intakeId,name,dose){const uid=VIEW_USER||ME.id;
  await API.del('/supplement-intake/'+uid+'/'+intakeId);
  if(name)suppUndoToast(uid,name,dose,async()=>{await drawSuppSheet();await homeRefreshSupp();});
  await drawSuppSheet();await homeRefreshSupp();}
function editIntakeDose(intakeId,name,dose){
  openSheet('Menge anpassen',`<div class="field"><label>Wie viel von „${esc2(name)}" hast du genommen?</label><input id="intake_dose" value="${esc2(dose)}" placeholder="z.B. 10 g, 2 Kapseln" maxlength="60"></div>
    <button class="btn block" onclick="saveIntakeDose(${intakeId},'${esc(name)}')">Speichern</button>`);}
async function saveIntakeDose(intakeId,name){const uid=VIEW_USER||ME.id;
  const row=[...(SUPP_TODAY?.plan||[]),...(SUPP_TODAY?.extras||[])].find(p=>p.intake_id===intakeId);
  await API.post('/supplement-intake/'+uid,{supplement_id:row?.supplement_id??undefined,name,dose:val('intake_dose'),date:today()});
  await drawSuppSheet();await homeRefreshSupp();}
function openAddIntake(){
  openSheet('Supplement hinzufügen',`
    <div class="note mb-3">Trag ein, was du zusätzlich genommen hast. Es wird für heute als genommen vermerkt.</div>
    <div class="field"><label>Name</label><input id="add_supp_name" placeholder="z.B. Magnesium"></div>
    <div class="field"><label>Menge (optional)</label><input id="add_supp_dose" placeholder="z.B. 400 mg"></div>
    <button class="btn block" onclick="saveAddIntake()">Als genommen eintragen</button>`);}
async function saveAddIntake(){const name=val('add_supp_name');if(!name)return toast('Name fehlt');
  const uid=VIEW_USER||ME.id;
  // Ein neuer freier Eintrag darf NICHT in die Outbox (Vertrag §3): der Server dedupliziert nur bei
  // supplement_id, zwei wartende Einträge würden also zwei Zeilen unter „Zusätzlich genommen" ergeben.
  // Ohne Netz deshalb ehrlich abbrechen – vorher lief hier „Eingetragen ✓" gleichzeitig mit dem
  // Fehlerhinweis aus drawSuppSheet(), obwohl nichts gespeichert war.
  const r=await API.post('/supplement-intake/'+uid,{name,dose:val('add_supp_dose'),date:today()});
  if(!okRes(r))return toast(r.status===0?'Dafür brauchst du kurz Netz':(r.data?.error||'Fehler – nicht gespeichert'));
  await drawSuppSheet();await homeRefreshSupp();toast('Eingetragen ✓');}
async function suppDetail(id){
  const r=await API.get('/supplements/'+(VIEW_USER||ME.id));
  const s=(r.data?.supplements||[]).find(x=>x.id===id);if(!s){toast('Details nicht verfügbar');return;}
  openSheet(s.name,`
    ${s.mandatory?`<div class="note warn mb-3">${icon('alertTriangle',18)} Pflicht – von deinem Coach festgelegt.</div>`:''}
    <div class="rows mb-4">
      <div class="row"><div class="rl">Dosierung</div><div class="rr">${esc2(s.dose||'–')}</div></div>
      <div class="row"><div class="rl">Wann</div><div class="rr wrap">${esc2(s.timing||'–')}</div></div>
      <div class="row"><div class="rl">Mit Wasser</div><div class="rr">${s.with_water?'Ja':'Nicht nötig'}</div></div>
    </div>
    ${s.how_to?`<div class="section-label"><span>Einnahme &amp; Wirkung</span></div><div class="card body mb-3">${esc2(s.how_to)}</div>`:''}
    ${s.note?`<div class="section-label"><span>Hinweis deines Coaches</span></div><div class="card body coach-note">${esc2(s.note)}</div>`:''}
    <button class="btn block sec mt-4" onclick="openSupp()">Zurück</button>`);}

/* =============================================================================================
   A-V.3 · DIE SCHLEIFE (Präfix lp) — Version 2.9.0
   Reihenfolge ist bindend (CRITIC K7): erst INSTALLIEREN, dann FRAGEN, dann ERINNERN.
   Grund: In beiden Datenbanken standen 0 Push-Abos. Web-Push gibt es auf iOS ausschließlich für die
   INSTALLIERTE PWA – ohne Trichter beginnt die Schleife nie, und ein abgelehnter Systemdialog ist
   auf iOS endgültig. Deshalb fragt diese Datei nie von sich aus den Browser, sondern immer erst in
   der App, und auf iOS erst, wenn die App vom Home-Bildschirm läuft.
   ============================================================================================= */

// ---- 1. DIE EINE KONSISTENZ-MECHANIK (BUILD-A5 5.6, CRITIC K10) ----------------------------
// Bis 2.8.0 trug die Startseite die TAGES-Serie („31 Check-ins in Folge"). Sie zählt jeden Tag ohne
// Eintrag als Verlust – auch die Ruhetage, die der Trainingsplan selbst vorsieht. STRATEGY Abschnitt 8
// nennt das einen Schaden, keinen Antrieb; CRITIC K10 verlangt EINE Mechanik.
// Ab 2.9.0 steht dort die Wochen-Konsistenz: „3 von 4 geplanten Einheiten". Ein Fehltag bricht nichts,
// die Woche läuft bis Sonntag, und erst eine ganze verfehlte Woche unterbricht die Wochenserie.
// Die Zahlen sind KEINE neue Rechnung: `insights.weekGoal` {target,done} und
// `insights.streaks.weekGoal` liefert der Server seit 2.3.0 aus `weeklyGoalStreak` – derselben
// Funktion, die src/logic.js/weekConsistency benutzt. Fehlt das Feld (ältere Antwort), liefert die
// Funktion null und der alte Satz bleibt als Notnagel stehen.
function lpWeekLine(s){
  const ins=s&&s.ins;if(!ins)return null;
  const wg=ins.weekGoal;if(!wg||wg.target==null)return null;
  const planned=Math.max(1,Math.round(+wg.target||0)),done=Math.max(0,Math.round(+wg.done||0));
  const weeks=Math.max(0,Math.round(+((ins.streaks||{}).weekGoal)||0));
  const left=Math.max(0,planned-done);
  const hit=done>=planned;
  // Ein Satz, der die Zahl trägt, und höchstens eine Zeile darunter, die sie einordnet.
  // Kein Ausrufezeichen, keine Drohung, kein „nicht abreißen lassen".
  const main=hit
    ? 'Woche geschafft · '+fmtNum(done)+' von '+pl(planned,'Einheit','Einheiten')
    : fmtNum(done)+' von '+pl(planned,'geplanten Einheit','geplanten Einheiten');
  let detail='';
  if(hit)detail=weeks>=2?fmtNum(weeks)+' Wochen in Folge':'';
  else if(done===0)detail='Die Woche fängt gerade erst an.';
  else detail='Noch '+pl(left,'Einheit','Einheiten')+' – ein Fehltag ändert daran nichts.';
  return {main,detail,hit,done,planned,weeks};}
function lpWeekLineHTML(s){
  const w=lpWeekLine(s);if(!w)return '';
  const f=(s.ins&&s.ins.freezes)||{};const rep=f.balance==null?0:Math.max(0,Math.round(+f.balance||0));
  // Die Pille heißt „Reparatur" (BUILD-A5 5.6) – dieselbe Zahl wie vorher, ehrlicher Name.
  // Numerus wie im sichtbaren Text daneben: „1 Reparatur übrig", nicht „1 Reparaturen übrig".
  const repBtn=`<button class="hg-jok" onclick="openStreakInfo()" aria-label="${pl(rep,'Reparatur','Reparaturen')} übrig">${icon('shield',16)}${fmtNum(rep)}</button>`;
  const st=s.checkedIn?`<span class="hg-st tone-green">heute ${icon('check',13)}</span>`:'<span class="hg-st tone-amber">heute offen</span>';
  return `<div class="hg-streak">${icon(w.hit?'check':'calendar',18)}<div class="fill"><b>${esc2(w.main)}</b>${w.detail?`<small>${esc2(w.detail)}</small>`:''}</div>${st}${repBtn}</div>`;}

// ---- 2. WIEDERKEHR-LEITER, TON IN DER APP (BUILD-A5 5.5) -----------------------------------
// Dieselben Sprossen wie src/logic.js/reminderLadder (5 · 10 · 14 · 21/28 · 30), nur für die Zeile auf
// der Startseite. Unter 5 Tagen schickt der Server NICHTS – der Standardzweig unten ist deshalb kein
// eigener Push-Schritt, sondern nur der Begrüßungssatz für den, der von selbst wiederkommt. Ab 15 Tagen
// meldet sich der Server nur noch wöchentlich (21, 28), ab 30 gar nicht mehr.
// Kein Satz darin macht einen Vorwurf und keiner nennt eine Serie, die reißen könnte:
// wer nach zwei Wochen zurückkommt, braucht einen Weg zurück, keine Rechnung.
function lpComebackWords(since){
  const n=Math.max(0,Math.round(+since||0));
  if(n>=30)return {main:'Schön, dass du da bist',sub:'Wir fangen einfach neu an – ein Tag reicht'};
  if(n>=14)return {main:'Länger nicht da gewesen',sub:pl(n,'Tag','Tage')+' – willst du den Plan pausieren?'};
  if(n>=10)return {main:'Alles in Ordnung?',sub:pl(n,'Tag','Tage')+' Pause – dein Coach kann den Plan anpassen'};
  if(n>=5)return {main:'Schön, dass du wieder da bist',sub:pl(n,'Tag','Tage')+' Pause – ein Check-in reicht für heute'};
  return {main:'Willkommen zurück',sub:pl(n,'Tag','Tage')+' Pause – jetzt nachtragen'};}

// ---- 3. INSTALLATIONS-TRICHTER (BUILD-A5 5.1, CRITIC K7) -----------------------------------
// Bedingungen, alle vier müssen zutreffen – sonst steht hier nichts:
//   · eigenes Athleten-Konto (der Coach-Blick auf einen Athleten zeigt keine Install-Werbung)
//   · die App läuft NICHT als installierte PWA (display-mode: standalone bzw. navigator.standalone)
//   · das ERSTE TRAINING ist abgeschlossen – die Karte kommt nach dem ersten Erfolg, nicht davor.
//     Quelle ist der Server, nicht eine Vermutung: insights.achievements/first_workout.done.
//   · sie wurde nicht in den letzten 30 Tagen weggetippt
// KEIN Banner beim ersten Start: ohne abgeschlossenes Training gibt es die Karte nicht, und sie steht
// unter dem Falz (nach dem Fortschritt), nicht über der Jetzt-Karte.
const LP_INSTALL_KEY='be_lp_install_off';       // Zeitpunkt des „Später" in ms
const LP_INSTALL_QUIET_MS=30*864e5;             // 30 Tage Ruhe nach einmal Ablehnen
function lpStandalone(){
  // isStandalone() wohnt in account.js – dieselbe Prüfung, eine Quelle (CRITIC K1). Fällt die Datei
  // aus der Bündelung, prüft der Notnagel dasselbe selbst, statt „nicht installiert" zu behaupten.
  try{if(typeof isStandalone==='function')return isStandalone();
    return window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;}catch(e){return false;}}
function lpIOS(){try{if(typeof isIOS==='function')return isIOS();
  return /iphone|ipod|ipad/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}catch(e){return false;}}
function lpAndroid(){try{return /android/i.test(navigator.userAgent);}catch(e){return false;}}
// „Erstes Training abgeschlossen?" – die EINE Quelle ist der Erfolg des Servers. Kein zweites
// Kriterium daneben (CRITIC K1); fehlt die Liste, gilt die Bedingung als NICHT erfüllt und die
// Karte bleibt weg. Lieber keine Karte als eine zu früh.
function lpFirstWorkoutDone(s){
  try{const a=(s&&s.ins&&s.ins.achievements)||[];
    const w=a.find(x=>x&&x.id==='first_workout');return !!(w&&w.done);}catch(e){return false;}}
function lpInstallDue(s){
  if(!s||!s.own)return false;
  if(lpStandalone())return false;
  if(!lpFirstWorkoutDone(s))return false;
  try{const t=+localStorage.getItem(LP_INSTALL_KEY)||0;if(t&&Date.now()-t<LP_INSTALL_QUIET_MS)return false;}catch(e){}
  return true;}
// Die drei Bilder für iOS. Reine Inline-SVG: kein zusätzlicher Netzabruf (perf.mjs zählt Anfragen),
// kein Bild, das im Flugmodus fehlt, und in beiden Farbschemata lesbar, weil sie currentColor tragen.
function lpStepSVG(n,plat){
  const box='viewBox="0 0 48 48" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  // Bild 1 ist das einzige, das sich je Plattform unterscheidet: auf dem iPhone das Teilen-Symbol,
  // sonst das Menü bzw. die Adressleiste. Ein Teilen-Pfeil neben dem Wort „Adressleiste" wäre ein
  // Bild, das etwas anderes zeigt als der Text darunter sagt.
  if(n===1&&plat==='ios')return `<svg ${box}><rect x="8" y="30" width="32" height="12" rx="3"/><path d="M24 30V8M17 15l7-7 7 7"/></svg>`;
  if(n===1&&plat==='android')return `<svg ${box}><rect x="7" y="9" width="34" height="30" rx="4"/><path d="M7 19h34"/><circle cx="36" cy="14" r="1.2"/><circle cx="36" cy="18" r="1.2"/><circle cx="36" cy="10" r="1.2"/><path d="M13 26h22M13 32h14"/></svg>`;
  if(n===1)return `<svg ${box}><rect x="7" y="9" width="34" height="30" rx="4"/><path d="M7 19h34"/><rect x="11" y="11.5" width="16" height="6" rx="3"/><path d="M34 11v7M31 15.5l3 3 3-3"/><path d="M13 26h22M13 32h14"/></svg>`;
  if(n===2)return `<svg ${box}><rect x="7" y="10" width="34" height="28" rx="4"/><path d="M7 20h34"/><rect x="11" y="25" width="8" height="8" rx="2"/><path d="M15 26v6M12 29h6M23 27h14M23 32h9"/></svg>`;
  return `<svg ${box}><rect x="7" y="9" width="34" height="30" rx="4"/><path d="M7 19h34"/><rect x="26" y="11.5" width="13" height="6" rx="3"/><path d="M14 27h13M20.5 23.5v7"/></svg>`;}
function lpStepsHTML(){
  const plat=lpIOS()?'ios':lpAndroid()?'android':'desktop';
  const steps=lpIOS()
    ?[[1,'Teilen','Safari-Leiste'],[2,'Zum Home-⁠Bildschirm','in der Liste'],[3,'Hinzufügen','oben rechts']]
    :lpAndroid()
    ?[[1,'Menü','drei Punkte'],[2,'Installieren','oder Startbildschirm'],[3,'Öffnen','vom Startbildschirm']]
    :[[1,'Adressleiste','Installieren-Symbol'],[2,'Installieren','im Browser-Menü'],[3,'Öffnen','als eigenes Fenster']];
  return `<div class="lp-steps" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0 8px">`
    +steps.map(([n,t,sub])=>`<div style="background:var(--surface3);border-radius:12px;padding:8px 4px;text-align:center">
      <div style="color:var(--ink)">${lpStepSVG(n,plat)}</div>
      <div style="font:600 13px/1.2 var(--font);color:var(--ink);margin-top:4px">${esc2(String(n))}. ${esc2(t)}</div>
      <div style="font:400 12px/1.25 var(--font);color:var(--ink2);margin-top:1px">${esc2(sub)}</div></div>`).join('')
    +`</div>`;}
// Wo der Trichter NICHT steht, und warum – damit das niemand versehentlich zurücknimmt:
//  · Keine Dauerkarte auf der Startseite. GEMESSEN mit tools/accent.mjs auf der Referenzdatenbank:
//    die Startseite steht bei 981 px, das Ziel ist < 1.000 px (BUILD-A4). Die schlankeste Fassung der
//    Karte mass 305 px – mit ihr 1.298 px, accent ROT. Auch eine blosse Zeile (81 px) reisst das Ziel.
//  · Kein Sheet, das sich selbst oeffnet. GEMESSEN mit tools/tapcount.mjs: Fluss `set` FEHLER, weil
//    das Sheet 1,2 s nach dem Zeichnen ueber der Tab-Leiste lag.
// Geblieben sind die Wege, die niemanden unterbrechen und die Seite nicht laenger machen:
//    iOS-Zeile unter dem Header (account.js/maybeShowInstallHint) · Profil → Daten → „Als App
//    installieren" · auf iOS der Push-Schalter im Erinnerungs-Center.
// lpInstallDue() ist die EINE Bedingung dahinter, lpStepsHTML() sind die drei Bilder.

// Der zweite Weg steht IMMER dabei – wer die App am Rechner liest und sie aufs Handy legen will,
// findet hier, was auf dem anderen Geraet zu tun ist, statt auf die Browser-Erkennung angewiesen zu sein.
function lpOtherWayText(){
  return lpIOS()
    ?'Auf Android: Browser-Menü (drei Punkte) → „App installieren".'
    :'Auf dem iPhone: in Safari auf Teilen → „Zum Home-Bildschirm" → „Hinzufügen".';}

// ---- 4. KONTEXT-PROMPT STATT SYSTEMDIALOG (BUILD-A5 5.2) -----------------------------------
// Der Systemdialog des Browsers darf erst nach einem „Ja" IN der App kommen. Auf iOS ist ein
// abgelehnter Systemdialog endgültig (nur über Einstellungen › App › Mitteilungen rückgängig), und
// auf einer Seite, die NICHT vom Home-Bildschirm läuft, gibt es ihn dort gar nicht.
// Daraus folgt die Reihenfolge, die diese Funktion durchsetzt:
//   iOS + nicht installiert  -> gar nicht fragen (erst der Trichter oben)
//   sonst                    -> einmal fragen, nach dem ersten gespeicherten Eintrag
// Ein „Nein" hält 30 Tage. Ein „Ja" setzt zugleich die Erinnerungs-Stunde: bis 2.8.0 blieb push_hour
// bei NULL („aus"), auch wenn Push aktiv war – dann kam nie eine Trainings-Erinnerung an.
const LP_PUSH_KEY='be_lp_pushask';              // {at:ms, no:true/false} – wann zuletzt gefragt
const LP_PUSH_SHOWN_MS=7*864e5;                 // nur gezeigt und weggetippt -> 7 Tage Ruhe
const LP_PUSH_NO_MS=30*864e5;                   // ausdrückliches „Nein danke" -> 30 Tage Ruhe
const LP_PUSH_HOUR=18;                          // Standardstunde: nachmittags/abends (BUILD-A5 5.4)
let LP_ASKING=false;
function lpAskState(){try{const j=JSON.parse(localStorage.getItem(LP_PUSH_KEY)||'null');
  return (j&&+j.at)?{at:+j.at,no:!!j.no}:null;}catch(e){return null;}}
function lpAskMark(no){try{localStorage.setItem(LP_PUSH_KEY,JSON.stringify({at:Date.now(),no:!!no}));}catch(e){}}
// Hat das Konto überhaupt schon etwas eingetragen? Der Trichter kommt nach dem ERSTEN Erfolg
// (Check-in oder Satz), nie beim ersten Start – die Quelle sind die Erfolge des Servers.
function lpHasFirstEntry(s){
  try{const a=(s&&s.ins&&s.ins.achievements)||[];
    return a.some(x=>x&&x.done&&(x.id==='first_checkin'||x.id==='first_workout'));}catch(e){return false;}}
// Wird nach einem gespeicherten Check-in gerufen (diese Datei) und beim Zeichnen der Startseite –
// so erwischt die Frage auch den ersten SATZ, der in training.js gespeichert wird.
// Reihenfolge wie CRITIC K7 sie verlangt: ERST der Installations-Anstoß, DANN die Frage nach
// Erinnerungen (lpMaybeAskPush hält auf iOS ohne installierte App von selbst still).
function lpAfterEntry(kind){try{lpInstallNudge(1200);setTimeout(()=>lpMaybeAskPush(kind),1400);}catch(e){}}
async function lpMaybeAskPush(kind){
  try{
    if(LP_ASKING)return;
    if(typeof ME==='undefined'||!ME||ME.role!=='athlete')return;
    if(typeof VIEW_USER!=='undefined'&&VIEW_USER!==ME.id)return;
    if(document.querySelector('#modal.on'))return;                           // kein Sheet über ein Sheet
    if(document.body.classList.contains('tour-active'))return;
    if(!lpAskDue())return;
    if(typeof pushStatus!=='function')return;
    const st=await pushStatus();
    // 'install' heißt: iOS, aber nicht vom Home-Bildschirm gestartet. Dann ist der Trichter dran,
    // nicht die Frage – genau die Reihenfolge aus CRITIC K7. 'on'/'blocked'/'unsupported' ebenso:
    // gefragt wird nur, wenn ein „Ja" auch etwas bewirken kann.
    if(st.state!=='off')return;
    LP_ASKING=true;lpAskPushSheet();
  }catch(e){LP_ASKING=false;}}
function lpAskPushSheet(){
  lpAskMark(false);   // gefragt ist gefragt – ohne Antwort sieben Tage Ruhe
  const h=`<p class="body mb-3">Eine Mitteilung an deinen Trainingstagen – sonst nichts.</p>
    <div class="note mb-4">Uhrzeit und Arten änderst du jederzeit im Profil unter „Erinnerungen", und dort schaltest du auch alles wieder ab. Beim ersten „Ja" fragt gleich danach noch dein Browser – das ist normal.</div>
    <button class="btn block mb-2" onclick="lpPushYes(${LP_PUSH_HOUR})">Ja, um ${LP_PUSH_HOUR} Uhr</button>
    <button class="btn block sec mb-2" onclick="lpPushOtherTime()">Andere Zeit</button>
    <button class="btn block ghost" onclick="lpPushNo()">Nein danke</button>`;
  openSheet('Soll ich dich erinnern?',h);}
// „Andere Zeit": die Stunde wird VOR dem Systemdialog gewählt. Wer erst den Dialog sieht und dann die
// Zeit, hat beim Ablehnen beides verloren.
function lpPushOtherTime(){
  const hrs=[6,7,8,9,10,12,16,17,18,19,20];
  openSheet('Wann passt es dir?',`<p class="body mb-3">Zur vollen Stunde an deinen Trainingstagen – deutsche Zeit.</p>
    <div class="chip-row wrap mb-4">${hrs.map(h=>`<button type="button" class="chip${h===LP_PUSH_HOUR?' on':''}" onclick="lpPushYes(${h})">${h} Uhr</button>`).join('')}</div>
    <button class="btn block ghost" onclick="lpPushNo()">Doch nicht</button>`);}
// Erst JETZT der Systemdialog (enablePush -> Notification.requestPermission), und erst danach die
// Stunde speichern. Andersherum stünde im Profil eine Uhrzeit, zu der nie etwas ankommt.
async function lpPushYes(hour){
  LP_ASKING=false;
  const h=Math.max(0,Math.min(23,Math.round(+hour)||LP_PUSH_HOUR));
  if(typeof closeModal==='function')closeModal();
  if(typeof enablePush!=='function')return;
  const ok=await enablePush();
  if(!ok){lpAskMark(false);return;}   // Systemdialog abgelehnt oder Server ohne Push: nicht gleich wieder fragen
  try{if(typeof profileSave==='function')await profileSave({push_hour:h},{msg:false,hub:false});}catch(e){}
  lpAskMark(true);
  if(typeof toast==='function')toast('Läuft – du hörst am nächsten Trainingstag um '+h+' Uhr von mir');}
function lpPushNo(){
  LP_ASKING=false;lpAskMark(true);
  if(typeof closeModal==='function')closeModal();
  if(typeof toast==='function')toast('Alles klar – du findest das jederzeit im Profil unter Erinnerungen');}

// ---- 4b. WANN DARF GEFRAGT WERDEN? -----------------------------------------------------------
// Ein Sheet, das beim Öffnen der App ungefragt über der Startseite steht, ist genau das, was CRITIC K7
// dem Systemdialog vorwirft: eine Frage ohne Anlass. Deshalb hängt sie an drei Bedingungen, die ALLE
// zutreffen müssen – es gibt schon einen Eintrag (erster Satz oder Check-in, Quelle sind die Erfolge
// des Servers), Push ist auf DIESEM Gerät wirklich aus, und die letzte Frage ist lange genug her.
// Zwischen zwei Fragen liegen sieben Tage; nach einem ausdrücklichen „Nein danke" 30.
function lpAskDue(){
  try{
    if(typeof ME==='undefined'||!ME||ME.role!=='athlete')return false;
    if(typeof VIEW_USER!=='undefined'&&VIEW_USER!==ME.id)return false;
    const a=lpAskState();
    if(a&&Date.now()-a.at<(a.no?LP_PUSH_NO_MS:LP_PUSH_SHOWN_MS))return false;
    return lpHasFirstEntry(homeState());
  }catch(e){return false;}}
