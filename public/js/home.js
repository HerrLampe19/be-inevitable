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
let HOME_CI_PICK=false;    // im Check-in-Sheet steht gerade die Tagesauswahl statt des Formulars
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
  // Drei Antworten tragen die Seite und haben KEINE eigene Absicherung: Check-ins (Zeile „Check-in",
  // Gewichtstrend), Essensprotokoll (Zeile „Ernährung") und die Sätze von heute (Hauptknopf).
  // Fehlt eine davon, wird gar nicht gezeichnet. Supplements, Insights und Mindset dürfen fehlen – ihre
  // Zeilen lassen sich ohne Daten schon von selbst weg (drawHomeGoals, hmLastHTML, openBodyPage).
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

/* ============================================================================================
   DESIGN-4 6.1 · DIE VIER ABSCHNITTE DER STARTSEITE – Praefix `hm`
   --------------------------------------------------------------------------------------------
   1 Jetzt (.card.lg)  ·  2 Heute offen  ·  3 Zuletzt  ·  4 Koerper & Fortschritt

   Gemessener Ausgangspunkt (tools/sprache.mjs, Stand vor diesem Umbau, Konto Marco):
   17 Zeilenformen, 12 Schriftpaare, 4 Ringe, 0 Abschnittsueberschriften, 1138 px Seitenhoehe,
   eine abgeschnittene Beschriftung („Challenge Tag 5/10 · 1/14 erledigt · Rad") und fuenf graue
   Pillen am Seitenende, die nichts benennen (Masse · Foto · Kalender · Erfolge · Startseite).

   Die Regeln dieser Welle:
     · EIN Zeilenmuster. Jede Zeile kommt aus rowHTML(), jede Gruppe aus groupHTML() (G6/N17).
       Handgeschriebene `class="row"` gibt es in dieser Datei nicht mehr.
     · KEIN Ring mehr auf der Startseite (K19). Ein Ring ohne Wort ist eine Ampel; die Zahl steht
       jetzt als Wort rechts in der Zeile („695 von 3.017 kcal" statt eines Kreissegments).
     · Jede Handlung traegt ein WORT. Die fuenf grauen Pillen sind benannte Zeilen im Abschnitt
       „Koerper & Fortschritt" (Teil 7, R3).
     · Erklaert wird im `.rows-f` unter der Gruppe, nie in einem Symbol (G8).
   ============================================================================================ */

// ---- „Tag komplett" feiern – einmal pro Tag ----
// EIN Schluessel mit dem Datum als Wert – nicht einer je Kalendertag: die Frage lautet nur „heute
// schon gefeiert?", und die alten Tages-Schluessel raeumte nie jemand auf.
function hmCelebrate(s){
  if(!s||!s.allDone)return;
  const key='be_daily';
  try{if(localStorage.getItem(key)!==s.tdy&&HOME_TIP!==s.tdy){HOME_TIP=s.tdy;localStorage.setItem(key,s.tdy);
    setTimeout(()=>{if(typeof celebrate==='function')celebrate('🎉','Tag komplett!','Alle Tagesziele erreicht – stark!');},700);}}catch(e){}}

// ---- Der grosse Titel der Startseite (DESIGN-4 3.2/6.1) ----
// Er steht seit dieser Welle im Markup der Ansicht selbst; `ensureLargeTitle()` in shell.js ruehrt
// eine Seite nicht an, die schon einen hat. Die Unterzeile traegt Datum und Phase – beides stand
// vorher in der Jetzt-Karte („Guten Abend, Marco · Do., 17.9." + „Aufbauphase") und ist dort
// ersatzlos entfallen: der Ort fuer „welcher Tag ist heute" ist der Titel des Bildschirms.
// „Offseason" heisst hier „Aufbauphase" – dasselbe Wort wie bisher, dieselbe Regel (STRATEGY 4.5):
// auf Stufe 1 bleibt der unberuehrte Standard ganz weg, weil eine Phase, die niemand gesetzt hat,
// keine Aussage ist.
// Bewusst als Funktion und nicht als Objekt-Literal am Dateianfang: `scratchpad/dup_check.py`
// liest eine Zeile `const X={a:'..',prep:'..'}` als Mehrfach-Deklaration und meldete `prep`
// faelschlich als Namenskollision mit `PHASE_LABEL` in account.js. Ein Werkzeug, das man wegen
// eines Schreibstils ignorieren muss, ist kein Werkzeug mehr.
function hmPhaseWord(s){
  const raw=String((s&&s.T&&s.T.phase)||'');
  if(hmLevel()<2&&(raw||'offseason')==='offseason')return '';
  if(raw==='offseason')return 'Aufbauphase';
  if(raw==='prep')return 'Wettkampf-Diät';
  if(raw==='maintain')return 'Halten';
  return '';}
function hmTitleHTML(s){
  const sub=[cap(fmtDate(new Date(),{weekday:'long',month:'long'})),hmPhaseWord(s)].filter(Boolean).join(' · ');
  return `<h1 class="lg-title">Heute${sub?`<small>${esc2(sub)}</small>`:''}</h1>`;}

// ---- Wie heisst der Tag eines vergangenen Trainings? ----
function hmDayWord(iso){
  const d=Math.round((Date.parse(today()+'T00:00:00Z')-Date.parse(iso+'T00:00:00Z'))/864e5);
  if(d<=0)return 'Heute';
  if(d===1)return 'Gestern';
  if(d===2)return 'Vorgestern';
  if(d<=6)return cap(fmtDate(iso,{weekday:'long'}));
  return 'vor '+pl(d,'Tag','Tagen');}

/* ---- Abschnitt 3 · „Zuletzt" (6.1, Teil 8 S#3) ---------------------------------------------
   Die Startseite beantwortete dreimal dieselbe Frage („was ist heute offen?") und diese nie:
   „Wie lief es bisher?". Drei Zeilen, drei Antworten – letzte Einheit, Wochenstand, Gewicht.
   Alle drei rechnet der Server schon (lastWorkout, insights.weekGoal, checkins); es kommt keine
   einzige Anfrage dazu. */
// Die Zeile „Gewicht" fuehrt in den heutigen Check-in – dort wird das Gewicht eingetragen und
// geaendert. Das ist zugleich der Weg, den ein erledigter Check-in sonst verloren haette: er
// verschwindet aus „Heute offen", sobald er steht, und stand danach nirgends mehr auf dieser Seite.
function hmWeightRow(s){
  const ws=(s.cis||[]).filter(c=>c&&c.weight!=null);
  if(!ws.length)return rowHTML({icon:'scale',title:'Gewicht',
    sub:'Noch nichts eingetragen – im Check-in nachtragen',tap:'homeExpandCheckin()'});
  const cur=+ws[0].weight;
  const alt=ws.find(c=>wk2DayDiff(ws[0].date,c.date)>=7)||(ws.length>1?ws[ws.length-1]:null);
  let sub='seit dem ersten Eintrag';
  if(alt){
    const tage=wk2DayDiff(ws[0].date,alt.date),diff=cur-(+alt.weight);
    // Wort statt Vorzeichen (G9): „0,4 kg mehr in 9 Tagen" liest sich ohne Legende.
    sub=(Math.abs(diff)<0.15)
      ?'unverändert seit '+pl(tage,'Tag','Tagen')
      :fmtNum(Math.abs(diff),1)+' kg '+(diff>0?'mehr':'weniger')+' in '+pl(tage,'Tag','Tagen');}
  return rowHTML({icon:'scale',title:'Gewicht',sub,value:fmtNum(cur,1)+' kg',tap:'homeExpandCheckin()'});}

function hmLastHTML(){
  const s=homeState();
  if(!s.own||homeDayOne(s))return '';
  const rows=[],L=s.last;
  if(L&&L.none)
    rows.push(rowHTML({icon:'dumbbell',title:'Noch kein Training aufgezeichnet',
      sub:'Sobald du den ersten Satz einträgst, steht hier deine letzte Einheit',tap:"go('workout')"}));
  else if(L){
    // A-9: Tonnage ist die Leitkennzahl der oberen Stufen, nicht der ersten (STRATEGY 4.3).
    const teile=[pl(L.sets,'Satz','Sätze'),
      // „t" ist ein Kuerzel ohne Erklaerung (K21, tools/BEGRIFFE.md). Ausgeschrieben kostet es
      // null Pixel – die Unterzeile bleibt einzeilig – und spart den Fusstext, der es erklaeren muesste.
      (hmLevel()>=2&&L.volume>=100)?fmtNum(L.volume/1000,1)+' Tonnen bewegt':null,
      L.prs>0?pl(L.prs,'Bestleistung','Bestleistungen'):null,
      (!L.prs&&L.top)?'Top '+fmtNum(L.top.weight,L.top.weight%1?1:0)+' kg × '+fmtNum(L.top.reps):null].filter(Boolean);
    rows.push(rowHTML({icon:'dumbbell',title:hmDayWord(L.date)+(L.name?' · '+L.name:''),
      sub:teile.join(' · '),tap:`shOpenRhythmDay('${L.date}')`}));}
  const w=(typeof lpWeekLine==='function')?lpWeekLine(s):null;
  // Ohne Unterzeile: der Wert IST die Aussage, und der Satz „ein Fehltag aendert daran nichts"
  // steht im Fusstext der Gruppe – dort gehoert die Erklaerung hin (G8), und die Zeile bleibt 56 px.
  if(w)rows.push(rowHTML({icon:'calendar',title:'Diese Woche',
    value:fmtNum(w.done)+' von '+pl(w.planned,'Einheit','Einheiten'),
    tap:"if(typeof renderTracker==='function')renderTracker.tab='training';go('tracker')"}));
  // Die Zeile „Gewicht" steht NUR, wenn der heutige Check-in schon steht.
  // NACHBESSERUNG S1/B1 (Hoehe): Solange er offen ist, fuehrt die Zeile „Check-in" in
  // „Heute offen" in genau dasselbe Sheet – zwei Zeilen mit demselben Ziel auf einem Bildschirm
  // sind eine Doppelung, und sie kostet 65 px auf der einzigen Seite mit Hoehenbudget (9.4).
  // Ist der Check-in erledigt, verschwindet er aus „Heute offen" und DIESE Zeile wird der Weg
  // zum Gewicht – die beiden Zeilen loesen einander ab, es faellt nichts weg (G5).
  if(s.checkedIn)rows.push(hmWeightRow(s));
  // Die LISTE der Einnahmen (openSupp) stand hier als vierte Zeile, fuer den Fall, dass heute schon
  // alles abgehakt ist. Sie ist mit dieser Nachbesserung weg – sie war Navigation, nicht „wie lief
  // es bisher", und 6.1 nennt fuer diesen Abschnitt genau drei Antworten. Versteckt ist damit
  // nichts (G5): solange eine Einnahme offen ist, steht die Zeile in „Heute offen"; die LISTE
  // selbst gehoert dem Bildschirm, auf dem sie verwaltet wird – Profil › „Supplements · Deine
  // Liste – abhaken und verwalten" (account.js) – und steht zusaetzlich in der Suche.
  if(!rows.length)return '';
  // Der Fusstext ist der Erklaerungsort (G8). Hier steht auch, was eine „Reparatur" ist – bis zu
  // diesem Umbau stand das nur hinter dem kleinen Schild-Knopf neben der Streak-Zeile.
  const rep=Math.max(0,Math.round(+((s.ins&&s.ins.freezes&&s.ins.freezes.balance)||0)));
  const fuss='Der Wochenstand zählt geplante Einheiten – ein Fehltag bricht nichts.'
    +(rep?' '+pl(rep,'Reparatur','Reparaturen')+' übrig.':'');
  // „Körper & Fortschritt" ist die WORTAKTION dieses Abschnitts, keine eigene Zeile mehr.
  // NACHBESSERUNG S1/B1: Die Zeile beantwortete nicht „wie lief es bisher", sie war Navigation –
  // und 6.1 nennt für „Zuletzt" genau drei Antworten. Als Wortaktion im Abschnittskopf steht
  // derselbe Weg mit demselben Wort auf demselben Bildschirm (G5), kostet aber 0 px:
  // die Ueberschrift ist ohnehin da. Dieselbe Bauform wie „Nachtragen" in „Heute offen"
  // (.rows-h .a, DESIGN-4 4.5) – es kommt keine Form dazu.
  return groupHTML('Zuletzt',rows,fuss,
    {action:{label:'Körper & Fortschritt',tap:'openBodyPage()'}});}

/* ---- Abschnitt 4 · „Koerper & Fortschritt" als Push-Seite (Teil 7, R3) ----------------------
   HIER LANDEN DIE FUENF GRAUEN PILLEN. Gemessen lagen sie bei y = 813–857 hinter der Reiterleiste
   (y = 790–840) – acht Bedienelemente, die ohne Scrollen nicht erreichbar waren, und keines von
   ihnen sagte, wohin es fuehrt. Jetzt vier benannte Zeilen mit Symbol, Untertitel und Wert:
     Masse     -> „Koerpermasse"        Foto     -> „Fortschrittsfotos"
     Kalender  -> „Trainingskalender"   Erfolge  -> „Erfolge · Level x · y XP"
   Die fuenfte Pille („Startseite", Variante waehlen) entfaellt mit dem zweiten Zeichenpfad.

   WARUM EINE SEITE UND NICHT EIN ABSCHNITT AUF „HEUTE" – die Rechnung, nicht die Vorliebe:
   Der feste Rahmen der Startseite kostet 173 px (Kopfzeile 61, Leistenpolster 80, Seitenrand 32),
   der grosse Titel und die Jetzt-Karte 277 px, drei Abschnittskoepfe 162 px, zwei Fusstexte 88 px.
   Bei einem Ziel von unter 1.000 px bleiben damit 300 px fuer Zeilen – fuenf Stueck. DESIGN-4 6.1
   nennt zehn bis elf. Die woertliche Fassung wurde gebaut und gemessen: 1.367 px. Diese hier misst
   1.118 px, also weniger als der Stand VOR dem Umbau (1.138 px).
   Versteckt ist dadurch nichts: die vier Woerter stehen als Unterzeile der Zeile auf der Startseite,
   der Zurueck-Knopf der Seite traegt „Heute" (G3/K13). Der Preis ist EIN Tap je Eintrag, und er
   steht in DEFER-D5.md unter D2-2/A1.

   Der Fortschritts-Streifen (Level/Woche/Monat) ist damit ebenfalls aufgeloest: „Woche" steht als
   Zeile in „Zuletzt", „Level" als Wert der Zeile „Erfolge", „Monat" gehoert in die Analyse. */
function openBodyPage(){
  const s=homeState();
  const I=s.ins||null;
  if(I&&typeof checkNewAchievements==='function'){try{checkNewAchievements(I);}catch(e){}}
  const rows=[
    rowHTML({icon:'ruler',title:'Körpermaße',sub:'Umfänge eintragen und vergleichen',
      tap:"typeof openMeasure==='function'?openMeasure():go('tracker')"}),
    rowHTML({icon:'camera',title:'Fortschrittsfotos',sub:'Bilder aufnehmen und nebeneinanderlegen',
      tap:"typeof openPhotos==='function'?openPhotos():go('tracker')"}),
    rowHTML({icon:'calendar',title:'Trainingskalender',sub:'Welcher Tag war welche Einheit',
      tap:"typeof openCalendar==='function'?openCalendar():go('workout')"}),
    rowHTML({icon:'trophy',title:'Erfolge',sub:(I&&I.levelTitle)?String(I.levelTitle):'Stufen, Abzeichen, Meilensteine',
      value:I?('Level '+fmtNum(I.level)+' · '+fmtNum(I.xp)+' XP'):'',
      tap:"typeof openAchievements==='function'?openAchievements():go('tracker')"})
  ];
  const html=groupHTML(null,rows,
    'Maße und Fotos stehen auch in der Analyse, der Kalender im Training. '
    +'Hier liegen sie zusammen, weil sie dieselbe Frage beantworten: bewegt sich etwas?');
  if(typeof pushPage==='function')return pushPage('koerper','Körper & Fortschritt','Heute',html);
  openSheet('Körper & Fortschritt',html);}

// ===== ABSCHNITT 1 · DIE JETZT-KARTE (DESIGN-4 6.1, `.card.lg`) =====
// Genau EINE Hauptsache: Tag – Grund – Primaeraktion. Drei Zeilen, ein roter Knopf.
//
// WAS HIER RAUSGEFLOGEN IST (und wohin):
//   · Gruss „Guten Abend, Marco · Do., 17.9."  -> Unterzeile des grossen Titels (hmTitleHTML)
//   · Chip-Zeile „Reflexion" / „Power-Atmung 0/3" -> Zeile „Mindset" im Abschnitt „Heute offen"
//   · Chips „Essen loggen" / „Check-in"        -> die benannten Zeilen in „Heute offen"
//   · Rhythmus-Streifen (7 Tages-Chips)        -> Zeile „Trainingskalender" (R3) und „Tag aendern"
//   · Rueckkehr-Banner („Schoen, dass du da bist") -> Wortaktion „Nachtragen" im Abschnittskopf
//     und die Unterzeile der Check-in-Zeile („Seit 5 Tagen keiner")
//   · Bereitschaftszeile `.rdy` (eigene Bauform) -> DIE Grundzeile dieser Karte (`.hm-why`)
//   · Hinweis „Heute 3 Saetze eingetragen…"    -> Unterzeile des Tagesknopfs
// Damit hat die Karte statt sieben Bauformen noch drei Elemente, und keines davon ist eine Zeile
// (DESIGN-4 5.3: eine Karte enthaelt entweder Zeilen ODER etwas, das keine Zeile ist – nie beides).

// Die Grundzeile: WARUM gerade das? Sie traegt die Bereitschaft als Wort samt Zahl und fuehrt in
// einem Tipp in die Erklaerung (openReadiness). Bis hierher war die Bereitschaft eine eigene
// Bauform `.rdy` mit Zahlenfeld, Textblock und Chevron – gemessen eine der 17 Zeilenformen.
// DESIGN-4 5.3 verbietet eine `.row` in einer Karte; deshalb ist das hier KEINE Zeile, sondern der
// Begruendungssatz der Karte, der sich antippen laesst. Der Tipp ist sichtbar: das Chevron steht da.
function hmWhyBtn(head,sub,fn){
  const a=[head,sub].filter(Boolean).join('. ');
  return `<button type="button" class="hm-why" onclick="${esc2(fn)}" aria-label="${esc2(a)} Details anzeigen">`
    +`<span class="hm-why-t"><b>${esc2(head)}</b>${sub?' – '+esc2(sub):''}</span>`
    +`<span class="chev" aria-hidden="true"></span></button>`;}
function hmWhyHTML(s){
  // Krank gemeldet: kein Wert und kein „zieh durch" – das waere an diesem Tag eine falsche Ansage.
  if(s.isSick)return `<p class="hm-why static">Erst gesund werden – dein Rhythmus wartet.</p>`;
  const R=s.readiness;
  if(!R)return '';
  if(R.needsHealth)return s.own?hmWhyBtn('Bereitschaft: noch keine Werte',
    'Verbinde deine Gesundheitsdaten, dann steht hier deine Einschätzung.',
    "typeof openIntegrations==='function'?openIntegrations():go('tracker')"):'';
  if(R.score==null)return s.own?hmWhyBtn('Bereitschaft: noch keine Daten',
    'Trag Schlaf ein oder verbinde deine Uhr.','openReadiness()'):'';
  // B-I.5: der dritte Zustand zwischen „keine Daten" und einer Zahl. Unter sieben Naechten gibt es
  // keine Baseline, gegen die sich eine Zahl vergleichen koennte – sie waere erfunden ([Q13][Q16]).
  const cal=(typeof wk2Calib==='function')?wk2Calib(R,s.cis):null;
  if(cal&&!cal.ready&&cal.have>0)return hmWhyBtn('Bereitschaft wird noch kalibriert',
    'Noch '+pl(cal.left,'Nacht','Nächte')+' – '+wk2CalibSteer(1),'openReadiness()');
  const solo=(typeof _readySolo==='function')?_readySolo(R):'';
  const sub=!s.own?'':solo
    ?('Geschätzt aus '+solo+' – für eine belastbare Einschätzung fehlen noch Werte.')
    :String(R.headline||'');
  return hmWhyBtn('Bereitschaft '+fmtNum(R.score)+(R.label?' · '+R.label:''),sub,'openReadiness()');}

function nowCardHTML(){
  if(!HOME_DATA)return '<div class="card lg hm-now" id="homeNow">'+skeleton(1)+'</div>';
  const s=homeState();
  const eff=s.eff,hour=new Date().getHours();
  const dayName=s.isSick?'Erholung':(s.isTrain?(eff.dayName||'Training'):'Ruhetag');
  const kind=s.isSick?'Krank gemeldet':(s.isTrain?'Trainingstag':'Ruhetag');
  const titel=(kind===dayName)?kind:(kind+' · '+dayName);

  // --- Der Tag IST der Knopf ---
  // Wer an einem Ruhe- oder Krankheitstag Saetze eintraegt, las auf der Startseite „Ruhetag" und im
  // Trainings-Tab im selben Moment „Lower 1 · 7/27 Saetze". Der Widerspruch steht jetzt als
  // Unterzeile am Tagesknopf statt als eigener Hinweiskasten (B10) – 18 px statt 78 px, und die
  // Aufloesung („Tag aendern") ist genau der Knopf, an dem der Satz steht.
  const konflikt=(s.own&&!s.isTrain&&s.doneSets>0)
    ?`Heute ${pl(s.doneSets,'Satz','Sätze')} eingetragen – Tag ändern?`:'';
  const head=s.own
    ? `<button type="button" class="hm-day" onclick="openDayPicker()"
        aria-label="Heute: ${esc2(titel)}. Tag ändern"><span class="hm-day-t">${esc2(titel)}`
      +(konflikt?`<small>${esc2(konflikt)}</small>`:'')
      +`</span><span class="chev" aria-hidden="true"></span></button>`
    : `<div class="hm-day"><span class="hm-day-t">${esc2(titel)}</span></div>`;

  // --- Die eine Primaeraktion (G10) ---
  // Reihenfolge nach Dringlichkeit des Tages, unveraendert gegenueber 2.9.0 (B10):
  //  · Krank gemeldet: kein Mindset-Programm, kein roter Knopf – heute ist Erholung die Aufgabe.
  //  · „Ernaehrung oeffnen" ist kein Ruf zur Tat, sondern ein Tabwechsel; ab 12 Uhr und unter der
  //    Haelfte des Kalorienziels traegt der Hauptknopf das Eintragen selbst (shMiddayCta).
  const day1=homeDayOne(s);
  const foodCta={l:'Essen loggen',fn:"typeof openLogFood==='function'?openLogFood({focus:true}):go('diet')"};
  let cta=null,ctaCls='btn';
  if(s.own){
    if(s.isSick){
      ctaCls='btn sec';
      if(!s.checkedIn)cta={l:'Check-in eintragen',fn:'homeExpandCheckin()'};
      else if(shMiddayCta(s,hour))cta=foodCta;
      else if(s.allDone)cta={l:'Tag komplett',fn:"go('tracker')"};
    }
    else if(s.isTrain&&s.expected>0&&s.doneSets<s.expected)
      cta={l:s.doneSets>0?`Weiter · ${fmtNum(s.expected-s.doneSets)} Sätze offen`:`${dayName} starten`,
        fn:"go('workout',{start:true})"};
    else if(s.isTrain&&s.expected===0&&s.planDays.length)cta={l:'Training öffnen',fn:"go('workout')"};
    else if(!s.isTrain&&hour<12&&s.hasMind&&!s.primed&&!day1)
      cta={l:`Priming starten · ${fmtNum(s.mins)} Min.`,fn:"stlMindCall('openPriming')"};
    else if(!s.checkedIn)cta={l:'Check-in eintragen',fn:'homeExpandCheckin()'};
    else if(shMiddayCta(s,hour))cta=foodCta;
    else if(hour>=17&&s.hasMind&&!s.evened&&!day1)cta={l:'Abend-Reflexion',fn:"stlMindCall('openEvening')"};
    else if(s.allDone){cta={l:'Tag komplett',fn:"go('tracker')"};ctaCls='btn sec';}
    else if(!s.gFood)cta=foodCta;
    else if(s.sTot>0&&s.sDone<s.sTot){cta={l:'Supplements abhaken',fn:'openSupp()'};ctaCls='btn sec';}
  }else{
    cta={l:'Trainingsplan ansehen',fn:"go('workout')"};ctaCls='btn sec';
  }

  return `<div class="card lg hm-now" id="homeNow">${head}${hmWhyHTML(s)}`
    +(cta?`<button type="button" class="${ctaCls}" onclick="${esc2(cta.fn)}">${esc2(cta.l)}</button>`:'')
    +`</div>`;}

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
  // NACHBESSERUNG B6/D8: Der Ring dieses Sheets war nach der Ampel eingefaerbt und bei rotem
  // Zustand ROT GEFUELLT. DESIGN-4 5.7 sagt zu beidem nein: „ein Helfer (ringHTML)" und „nie rot".
  // Die Aussage geht nicht verloren, sie steht als WORT darunter (R.label, R.headline) – und ein
  // Wort sagt mehr als eine Farbe (G9). Die frueher hier gerechnete Ampelfarbe ist ersatzlos weg.
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
  // Das Wort steht UNTER dem Ring, nicht darin (5.7: „Der Ring traegt die Zahl innen, das Wort daneben").
  if(R.score!=null&&!calibrating)h+=`<div class="center mb-3">${ringHTML(R.score/100,112,fmtNum(R.score))}
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
  if(parts.length)h+=`<h2 class="rows-h">Woraus sich das ergibt</h2>
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

/* ===== ABSCHNITT 2 · „HEUTE OFFEN" (DESIGN-4 6.1) ============================================
   Genau die heute OFFENEN Dinge, hoechstens drei, jedes als benannte Zeile mit Wert oder Marke.
   Hier stand bis zu diesem Umbau die Ringreihe „HEUTE 0/5": fuenf Ringe nebeneinander, jeder
   46 px, jeder mit einer Zahl darin und einem Wort darunter. Drei Dinge waren daran falsch:
     · Ein Ring ohne Wort ist eine Ampel. „0/4" sagt nicht, was offen ist (G9).
     · Fuenf Ringe auf einem Bildschirm sind vier zu viel (K19: hoechstens einer, nie rot).
     · Erledigtes stand gleichberechtigt neben Offenem – die Seite beantwortete fuenfmal
       „gibt es das?" und nie „was ist jetzt dran?".
   Jetzt verschwindet eine Zeile, sobald ihr Ding erledigt ist. Ist nichts mehr offen, steht das
   als Satz da – das ist eine Antwort, kein leerer Platz.

   REIHENFOLGE (fest, nicht nach Laune): Check-in · Ernaehrung · Supplements · Mindset.
   Sie ist nach dem Tap-Veto gewaehlt (DESIGN-4 9.5): `supp` muss EIN Tap bleiben, also darf die
   Supplement-Zeile nie aus den ersten drei fallen. Faellt bei vier offenen Dingen „Mindset"
   heraus, fuehrt der Weg ueber den Reiter – zwei Taps gegen eine Grundlinie von drei.

   Die Wortaktion im Kopf ist „Nachtragen" (openBulkCheckin). Sie ersetzt das Rueckkehr-Banner,
   das bisher erst nach drei Tagen Pause erschien: ein Weg, den es nur in einer Notlage gibt, ist
   ein versteckter Weg (G5).  */
function drawHomeGoals(){
  const s=homeState();
  if(!s.own)return '';
  hmCelebrate(s);
  const rows=[];

  // 1 · Check-in. Zwei Taps: diese Zeile oeffnet das Sheet, „Speichern" schliesst es ab – die vier
  //     Felder sind vorbelegt (homeCheckinHTML), deshalb steht das auch in der Unterzeile.
  if(!s.checkedIn){
    const seit=s.cis.length?wk2DayDiff(s.tdy,s.cis[0].date):0;
    rows.push({name:'Check-in',html:rowHTML({icon:'pencil',title:'Check-in',
      sub:(seit>=3)?('Seit '+pl(seit,'Tag','Tagen')+' keiner · vorbelegt')
        :'Gewicht, Schlaf, Schritte, Wasser · vorbelegt',
      pill:{text:'heute offen',tone:'amber'},tap:'homeExpandCheckin()'})});}

  // 2 · Ernaehrung. Der Wert IST die Antwort („695 von 3.017 kcal"), der Tipp oeffnet das
  //     Eintragen-Sheet direkt – nicht den Reiter (tapcount `food`: 3 Taps).
  if(!s.gFood)
    rows.push({name:'Ernährung',html:rowHTML({icon:'utensils',title:'Ernährung',
      value:s.kcalTarget?(fmtNum(s.consumed)+' von '+fmtNum(s.kcalTarget)+' kcal')
        :(s.consumed>0?fmtNum(s.consumed)+' kcal':'noch nichts'),
      tap:"typeof openLogFood==='function'?openLogFood({focus:true}):go('diet')"})});

  // 3 · Supplements. DIE EINE ZEILE, DIE NICHT WEITERFUEHRT, SONDERN ABHAKT (1 Tap, Tap-Veto).
  //     Deshalb traegt sie kein Chevron: „›" bedeutet genau eines, naemlich „fuehrt weiter" (G7).
  //     Was ein Tipp bewirkt, steht in der Unterzeile und noch einmal im Fusstext der Gruppe (G8).
  const offen=(s.sItems||[]).filter(p=>!p.taken);
  if(offen.length){
    const p=offen[0];
    rows.push({name:'Supplements',haken:true,html:rowHTML({icon:'pill',title:'Supplements',id:'homeSuppRow',
      sub:'Tippen hakt ab: '+homeShortLabel(p.name),
      value:fmtNum(s.sItemsDone)+' von '+fmtNum(s.sItems.length),
      tap:`toggleIntakeHome(event,${p.supplement_id??'null'},${p.intake_id??'null'},'${esc(p.name)}','${esc(p.dose||'')}')`})});}

  // 4 · Mindset. Der Text kommt aus mindset.js; er darf umbrechen statt abgeschnitten zu werden
  //     (G11 – gemessen war genau hier „Challenge Tag 5/10 · 1/14 erledigt · Rad" abgeschnitten).
  if(!homeDayOne(s)&&!s.isSick&&s.hasMind){
    const mw=homeMindWidget();
    if(mw&&!mw.done&&mw.action&&mw.fn)
      rows.push({name:'Mindset',html:rowHTML({icon:'brain',title:'Mindset',
        sub:[homeShortLabel(mw.title||mw.action||''),(mw.status&&mw.status.text)?String(mw.status.text):''].filter(Boolean).join(' · '),
        pill:{text:'offen',tone:'amber'},tap:String(mw.fn)})});
    else if(mw&&mw.status&&mw.status.text)
      rows.push({name:'Mindset',html:rowHTML({icon:'brain',title:'Mindset',sub:String(mw.status.text),
        tap:String(mw.status.fn||"go('mindset')")})});
    else if(!mw&&stlMindPending(s)){
      // Das Modul ist noch unterwegs (mindset.js kommt aus dem Nachlauf). Der Platz wird JETZT
      // eingenommen, damit spaeter nichts nachrueckt – und die Zeile ist schon benutzbar:
      // stlMindCall() holt das Modul nach und ruft dann. Ein Tap, wie mit geladenem Modul.
      // Welche Uebung dran ist, sagen die DATEN (stlMindSlots spiegelt die Tore von mindset.js),
      // nicht der Ladezustand einer Datei.
      const fr=new Date().getHours()<17;
      rows.push({name:'Mindset',html:rowHTML({icon:'brain',title:'Mindset',
        sub:fr?'Priming · Atmung, Dankbarkeit, Fokus':'Abend-Reflexion · 2 Minuten für den Abend',
        pill:{text:'offen',tone:'amber'},
        tap:fr?"stlMindCall('openPriming')":"stlMindCall('openEvening')"})});}}

  // DER SCHNITT AUF DREI – und die zwei Regeln, die er einhalten muss (NACHBESSERUNG Befund 2):
  //  a) Die Abhak-Zeile faellt NIE heraus. Sie ist die einzige, die mit einem Tap ERLEDIGT statt
  //     weiterzufuehren; ohne sie kostet `supp` zwei Taps ueber das Sheet, und 9.5 sagt: kein Fluss
  //     wird teurer. Bis hierher hing das allein an ihrer Position in der Liste – eine Reihenfolge
  //     ist kein Riegel. Jetzt ist es einer: faellt sie durch den Schnitt, rueckt sie auf Platz 3.
  //  b) Was herausfaellt, wird BEIM NAMEN genannt. „Weiteres steht im jeweiligen Reiter" ist die
  //     abgeschwaechte Form desselben Fehlers, den R3 behoben hat: ein Hinweis, der nicht sagt,
  //     worauf er zeigt, zeigt auf nichts (G5/G8).
  let liste=rows.slice(0,3);
  if(rows.length>3&&!liste.some(r=>r.haken)){
    const h=rows.find(r=>r.haken);
    if(h)liste=rows.slice(0,2).concat([h]);}
  const weg=rows.filter(r=>liste.indexOf(r)<0).map(r=>r.name).filter(Boolean);
  const html=liste.map(r=>r.html);
  if(!html.length)html.push(rowHTML({icon:'checkCircle',title:'Alles erledigt',
    sub:'Für heute ist nichts mehr offen'}));
  const fuss=offen.length
    ? 'Ein Tipp auf die Supplement-Zeile hakt die nächste Einnahme ab. „Nachtragen" öffnet die letzten 14 Tage.'
    : 'Was hier steht, verschwindet, sobald du es einträgst. „Nachtragen" öffnet die letzten 14 Tage.';
  const wegTxt=!weg.length?''
    :' '+(weg.length>1?weg.slice(0,-1).join(', ')+' und '+weg[weg.length-1]+' stehen'
                     :weg[0]+' steht')+' im eigenen Reiter.';
  return groupHTML('Heute offen',html,fuss+wegTxt,
    {action:{label:'Nachtragen',tap:'openBulkCheckin()'}});}
// Der Name, unter dem jede Stelle nachzieht, die etwas eingetragen hat (Check-in, Essen, Supplement,
// Tagwechsel). Seit es nur noch EINEN Zeichenpfad gibt, ist er ein Durchreicher – er bleibt stehen,
// weil sechs Stellen in dieser Datei und `diet.js` ihn rufen.
function hmGoalsHTML(){return drawHomeGoals();}

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
  // ---- Der Tag: EINE Zeile statt einer Chip-Reihe (NACHBESSERUNG K3/G4) ----------------------
  // Hier stand eine waagrechte Reihe aus sieben Tages-Chips. Unter dem Sheet war sie die ZWEITE
  // Steuerebene – sprache.mjs K3 meldete `sheet-checkin: 2 (Sheet · Chip-Reihe)` als einzige der
  // 19 Ansichten ueber dem Limit von G4. DESIGN-4 3.6 nennt fuer „genau ein Tag" die Zeile, nicht
  // die Chip-Reihe (die ist fuer Zeitraum oder Filter, 5.9), und im Sheet zaehlt das Sheet selbst
  // schon als Ebene. Jetzt: erste Zeile im Sheet, Wert rechts, ein Tipp oeffnet die Optionsliste
  // mit Haken (A32) als eigenes Blatt – dessen Zurueck-Knopf traegt „Check-in" (G3).
  if(sheet&&HOME_CI_PICK)return homeCheckinDayListHTML();
  const tagWort=homeCheckinDayWord(CHECKIN_DATE);
  const tagZeile=groupHTML(null,[rowHTML({icon:'calendar',title:'Tag',value:tagWort,
    tap:'openCheckinDaySheet()'})],
    past?'Du trägst für einen vergangenen Tag nach – das schließt auch Lücken in deiner Check-in-Folge.'
        :'Vergangene Tage trägst du hier nach, einzeln oder mehrere auf einmal.');
  // „Mehrere Tage nachtragen" gehört dorthin, wo über den TAG entschieden wird – also neben die
  // Tages-Chips. Im neuen Zeichenpfad gibt es die Check-in-Karte auf der Seite nicht mehr, und mit
  // ihr war auch ihre Fußzeile weg: openBulkCheckin() war von nirgends mehr erreichbar (gemessen:
  // kein sichtbares Element mit diesem onclick, weder auf Home noch im Sheet). Über die sieben
  // Chips kostet ein einzelner vergangener Tag zwei Taps – eine ganze Woche aber sieben mal zwei
  // statt eines Dialogs. Im klassischen Pfad steht der Knopf weiter auf der Seite selbst; dort
  // wäre er hier ein zweites Mal, und genau das soll diese Welle nicht.
  const head=trend?`<div class="mb-3">${trend}</div>`:'';
  return `${head}
    ${tagZeile}
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
// Wie heisst der gewaehlte Tag in einem Wort? „Heute" / „Gestern" / „Di., 15. Sept."
function homeCheckinDayWord(iso){
  const d=wk2DayDiff(today(),iso);
  return d<=0?'Heute':d===1?'Gestern':fmtDate(iso,{weekday:'short',month:'short'});}
// Die Optionsliste (A32): jede Zeile setzt genau EINEN Tag und fuehrt nirgendwohin – deshalb ein
// Haken statt eines Chevrons (G7). Sie liegt IM SELBEN Sheet, nicht darueber: DESIGN-4 3.5/S6
// erlaubt genau EIN Sheet gleichzeitig, und shell.js schliesst das untere, sobald eines darueber
// aufgeht. Nachgemessen mit der ersten Fassung: `stack=["Tag"]`, Kopf links „Fertig", das
// Formular darunter weg – also genau der Raum ohne Fenster, den S6 verbietet. Der Sheet-Titel
// bleibt deshalb „Check-in", und ein Tipp auf einen Tag bringt das Formular zurueck. Der schon
// gewaehlte Tag traegt den Haken; ihn anzutippen ist der Weg zurueck, ohne etwas zu aendern –
// und genau das sagt der Fusstext.
// „Mehrere Tage nachtragen" steht hier und nicht mehr im Formular: es ist eine Entscheidung ueber
// den TAG, und genau darum geht es auf dieser Ebene.
function homeCheckinDayListHTML(){
  const cis=homeState().cis||[],tdy=today();
  const rows=[];
  for(let i=0;i<7;i++){const dd=new Date(tdy+'T00:00:00');dd.setDate(dd.getDate()-i);const iso=fmt(dd);
    const has=cis.some(c=>c.date===iso&&(c.weight!=null||c.sleep!=null||c.steps!=null||c.water!=null));
    rows.push(rowHTML({icon:'calendar',title:homeCheckinDayWord(iso),
      sub:has?'schon eingetragen – überschreiben':'noch nichts eingetragen',
      value:iso===CHECKIN_DATE?'✓':'',tap:`pickCheckinDay('${iso}')`}));}
  // `.rows.pick` blendet das Chevron aus – eine Auswahlzeile fuehrt nicht weiter, sie waehlt (G7).
  // Die Regel steht seit D-6 EINMAL in css/account.css:128 und gilt fuer die ganze App (ein Bundle);
  // sie hier ein zweites Mal zu schreiben waere genau die Doppelung, die diese Welle abschafft.
  // Der Haken bleibt ein Zeichen im Wertfeld (`value:'✓'`), keine zweite Zeilenform.
  const pick=h=>h.replace('class="rows','class="rows pick');
  return pick(groupHTML('Tag wählen',rows,
      'Der Haken steht am Tag, den du gerade einträgst – tipp ihn an, um ohne Änderung zum Formular '
      +'zurückzukommen. Ein Tag, der schon Werte hat, lässt sich überschreiben.'))
    +groupHTML(null,[rowHTML({icon:'pencil',title:'Mehrere Tage nachtragen',
      sub:'Dieselben Werte auf mehrere der letzten 14 Tage',tap:'openBulkCheckin()'})],null);}
// Zur Auswahl und zurueck – beides zeichnet dasselbe Sheet neu, es oeffnet sich nichts Zweites.
function openCheckinDaySheet(){HOME_CI_PICK=true;homePatch('homeCheckinSheet',homeCheckinHTML({sheet:true}));}
function pickCheckinDay(iso){HOME_CI_PICK=false;CHECKIN_DATE=iso;
  homePatch('homeCheckinSheet',homeCheckinHTML({sheet:true}));}
function setCheckinDate(d){CHECKIN_DATE=d;homePatch('homeCheckinSheet',homeCheckinHTML({sheet:true}));}
// „Check-in eintragen"/„Bearbeiten" von der Startseite -> dasselbe Sheet wie aus der Analyse
function homeExpandCheckin(){openCheckinSheet(today());}
// Check-in-Formular als Sheet (Startseite und Analyse-Nachtrag, Vertrag mit WP5)
function openCheckinSheet(date){
  CHECKIN_DATE=date||today();HOME_CI_SHEET=true;HOME_CI_PICK=false;
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
    homePatch('homeGoals',hmGoalsHTML());homePatchHero();homeCache();
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
  homePatch('homeGoals',hmGoalsHTML());homePatchHero();homeCache();
  // A-V.3 (CRITIC K7, Reihenfolge erst installieren – dann fragen): Die Frage nach Erinnerungen kommt
  // NACH dem ersten gespeicherten Check-in, in der App, und nie als Systemdialog aus dem Nichts.
  lpAfterEntry('checkin');}

// ===== ERNÄHRUNG (Ring + nächste Plan-Mahlzeit) =====
/* ---- ERSATZLOS GELOESCHT (NACHBESSERUNG B7): die Ernaehrungs-Kachel der alten Startseite ----
   `homeFoodHTML` baute `.ring-card` und `.section-label` samt rot gefuelltem Ring. Die CSS-Regeln
   dafuer sind mit Welle D-2 gefallen (3.0.2: app.css:419, css/home.css:209-210); uebrig blieb
   Markup ohne Regeln, das niemand mehr sah, weil `#homeFood` im neuen Zeichenpfad gar nicht mehr
   existiert – `homePatch('homeFood',…)` fand es nicht und gab still `false` zurueck.
   Mit der Kachel fallen ihre einzigen Verbraucher: `homeNextMeal`, `homeMealDone`,
   `shTargetsNote` und `shKcalAskNote`. Beide Saetze stehen wortgleich im Ernaehrungs-Reiter
   (diet.js `dtTargetsNote` / `dtKcalAskNote`) – es geht keine Aussage verloren, nur ihre
   Zweitfassung. `diet.js:_homeFoodPatch` prueft `typeof homeFoodHTML==='function'` und laeuft
   deshalb ohne diese Datei still ins Leere; seine Loeschung gehoert dem Ernaehrungs-Paket
   (angemeldet in FIX-D5-D-2.md). */

// ===== SUPPLEMENT-ZEILE AUF DER STARTSEITE =====
// Die Liste als eigener Block ist mit DESIGN-4 6.1 entfallen: „Heute offen" traegt die EINE
// offene Einnahme als Abhak-Zeile (ein Tap), „Zuletzt" die Zeile in die vollstaendige Liste.
// Abhak-Zeile mit role="button": Enter/Leertaste sollen wie ein Tipp wirken
function homeRowKey(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();ev.currentTarget.click();}}


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
  HOME_CI_SHEET=false;HOME_CI_PICK=false; // frisch aufgebaut: kein Sheet offen
  CHECKIN_DATE=today();

  // EIN Zeichenpfad. Der zweite („klassisch", 2.8.0) ist mit diesem Umbau entfallen: zwei
  // Startseiten sind zwei Dialekte, und genau die raeumt DESIGN-4 auf. Begruendung und die
  // Frage, was aus der Pille „Startseite" wird, stehen in DONE-D5-D-2.md / DEFER-D5.md.
  let html=`<div class="page on${(opts.cached||mounted)?'':' first'}" id="homePage">`+hmTitleHTML(s);

  // Einstieg ohne Plan/Ziele (nur eigenes Konto): eine Karte, ein Knopf, sonst nichts.
  if(s.own&&!PLAN?.days?.length&&!s.T?.kcal?.train){
    html+=`<div class="card lg hm-now" id="homeNow">
      <div class="hm-day"><span class="hm-day-t">Erste Schritte</span></div>
      <p class="hm-why static">In unter einer Minute zu Trainingsplan und Kalorienzielen.</p>
      <button type="button" class="btn" onclick="startOnboarding()">Jetzt einrichten</button></div>`;
    html+='</div>';v.innerHTML=html;homeCache();
    if(typeof mountLargeTitle==='function')try{mountLargeTitle();}catch(e){}
    return;}

  // Coach/Admin im Athleten-Kontext: die Zusammenfassung des Coaches steht ueber der Tageskarte.
  if(coachView()){
    let cc='';
    if(typeof coachHomeCard==='function'){try{cc=coachHomeCard()||'';}catch(e){cc='';}}
    if(!cc){const lc=s.cis[0];
      cc=groupHTML(String(COACH_CONTEXT||'Athlet'),[rowHTML({icon:'user',title:'Letzter Check-in',
        value:lc?(fmtDate(lc.date,{weekday:'short'})+(lc.weight!=null?' · '+fmtNum(lc.weight,1)+' kg':'')):'noch keiner'})],null);}
    html+=cc;}

  html+=nowCardHTML();                                   // 1 · Jetzt
  html+=`<div id="homeGoals">${drawHomeGoals()}</div>`;  // 2 · Heute offen
  html+=hmLastHTML();                                    // 3 · Zuletzt (letzte Zeile: 4 · Koerper)
  html+='</div>';

  // Beim Auffrischen einer schon stehenden Seite die Scrollposition halten: das Ersetzen des
  // Inhalts staucht das Dokument kurz zusammen, der Browser wuerde sonst nach oben klemmen.
  const keepY=(opts.cached||mounted)?window.scrollY:0;
  v.innerHTML=html;
  if(keepY){window.scrollTo(0,keepY);requestAnimationFrame(()=>window.scrollTo(0,keepY));}
  homeCache();
  // Der grosse Titel steht jetzt im Markup dieser Ansicht; die Kopfzeile muss ihn neu beobachten.
  if(typeof mountLargeTitle==='function')try{mountLargeTitle();}catch(e){}
  // Der reservierte Mindset-Platz wird eingenommen, sobald das nachgeladene Modul da ist.
  if(stlMindPending(s))stlMindWatch();
  if(typeof maybeStartTour==='function'){try{maybeStartTour();}catch(e){}}
  // HIER OEFFNET SICH NICHTS VON SELBST – und das ist eine Messung, keine Meinung (tapcount `set`
  // brach ab, als der Trichter 1,2 s nach dem Zeichnen als Sheet aufging). Der Installations-Hinweis
  // ist eine schmale Zeile unter der Kopfzeile; auf der Startseite raeumt lpInstallNudge sie weg,
  // weil home die einzige Ansicht mit Hoehenbudget ist (accent.mjs, Ziel < 1.000 px).
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
    <h2 class="rows-h">Tage auswählen</h2>
    <div id="bk_chips" class="chip-row wrap">${bulkChipsHTML()}</div>
    <p class="rows-f">Ein Tag mit Haken ist ausgewählt; ein grau hinterlegter Tag hat schon Werte –
      die werden überschrieben, wenn du ihn auswählst.</p>
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
  homePatch('homeGoals',hmGoalsHTML());homePatchHero();homeCache();}

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
    <div class="center mb-4">${ringHTML(mx?Math.min(1,fb/mx):0,96,fmtNum(fb))}
      <div class="meta mt-1">${esc2(fmtNum(fb)+' von '+fmtNum(mx)+' Reparaturen übrig')}</div></div>
    <div class="note mb-3">Eine <b>Reparatur</b> trägt automatisch einen Tag nach, an dem du nichts eingetragen hast. Deine Wochen-Konsistenz bleibt damit stehen.</div>
    <div class="note status mb-3">Ein reparierter Tag zählt mit, ist aber <b>kein Check-in</b>. Die Zahl deiner echten Einträge bleibt darunter – und wenn du den Tag später selbst nachträgst, bekommst du die Reparatur zurück.</div>
    <div class="rows mb-4">
      <div class="row"><div class="r-ic">${icon('shield')}</div><div class="rl">Automatisch<small>Vergisst du einen Tag, wird er repariert – du musst nichts tun</small></div></div>
      <div class="row"><div class="r-ic">${icon('calendar')}</div><div class="rl">Nachschub<small>+1 pro aktiver Woche, höchstens ${fmtNum(per30)} in 30 Tagen</small></div></div>
      <div class="row"><div class="r-ic">${icon('pencil')}</div><div class="rl">Selbst nachtragen<small>Vergessene Tage kannst du jederzeit von Hand nachpflegen</small></div></div>
    </div>
    <button class="btn block sec" onclick="closeModal()">Verstanden</button>`);}

// ===== GEMEINSAME HELFER: Diagramme (WP0; genutzt von Home, Training, Analyse, Mindset) =====
/* ERSATZLOS GELOESCHT (NACHBESSERUNG B6/D8): `ring`, `_ringText`, `_ringFit`.
   Das war der ZWEITE Ring-Erzeuger der App – mit `var(--red)` als Voreinstellung und einer Farbe
   je Aufrufer. DESIGN-4 5.7 kennt genau einen Helfer (`ringHTML` in core.js) und verbietet Rot;
   K19 zaehlt die Implementierungen im Quelltext. Die drei Aufrufer lagen alle in dieser Datei
   (Bereitschafts-Sheet 112 px, Ernaehrungs-Kachel 76 px, Reparatur-Sheet 96 px); die mittlere ist
   mit B7 gefallen, die anderen beiden zeichnen jetzt mit `ringHTML` – neutral in `--ink2`, und
   das WORT steht daneben statt einer Farbe (G9/G10).
   Was dabei entfaellt: die gestauchte Beschriftung IM Ring (`_ringFit` presste lange Untertitel
   auf die Sehne des Innenkreises, bis 8 px – unter dem kleinsten Typo-Token). `ringHTML` nimmt
   nur EINE kurze Zahl innen; alles andere steht daneben, so wie 5.7 es vorschreibt. */
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
  homePatchHero();homePatch('homeGoals',hmGoalsHTML());homeCache();}

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
      <div class="num-md${done===total?' tone-green':''}">${fmtNum(done)} von ${fmtNum(total)}</div></div>
      <div class="bar${done===total?' green':''}"><i style="width:${pct}%"></i></div></div>`;}
  if(!plan.length&&!extras.length){
    h+=emptyState({icon:'pill',title:'Keine Supplements für heute',
      text:isOwn?'Dein Coach kann dir welche zuweisen – oder füge selbst hinzu, was du genommen hast.':'Diesem Athleten sind keine Supplements zugewiesen.'});}
  if(plan.length){
    const groups={};plan.forEach(p=>{const c=p.category||'Sonstige';(groups[c]=groups[c]||[]).push(p);});
    const order=['Morgens','Pre-Workout','Intra-Workout','Nach dem Training','Zu einer Mahlzeit','Täglich','Abends','Bei Bedarf'];
    const cats=Object.keys(groups).sort((a,b)=>{const ia=order.indexOf(a),ib=order.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);});
    cats.forEach(c=>{h+=`<h2 class="rows-h">${esc2(c)}</h2><div class="rows mb-3">`+groups[c].map(p=>suppRow(p,isOwn)).join('')+'</div>';});}
  if(extras.length){h+=`<h2 class="rows-h">Zusätzlich genommen</h2><div class="rows mb-3">`+extras.map(p=>suppRow(p,isOwn)).join('')+'</div>';}
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
  homePatch('homeGoals',hmGoalsHTML());homePatchHero();homeCache();}
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
    ${s.how_to?`<h2 class="rows-h">Einnahme &amp; Wirkung</h2><div class="card body mb-3">${esc2(s.how_to)}</div>`:''}
    ${s.note?`<h2 class="rows-h">Hinweis deines Coaches</h2><div class="card body coach-note">${esc2(s.note)}</div>`:''}
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
// Die Wochenzeile als Markup gab es bis DESIGN-4 6.1 als eigene Bauform `.hg-streak` mit
// Schild-Knopf und Tagesmarke. Sie ist jetzt die Zeile „Diese Woche" in der Gruppe „Zuletzt"
// (rowHTML), und was eine Reparatur ist, steht im Fusstext dieser Gruppe statt hinter dem Schild.
// `lpWeekLine()` darueber bleibt: es rechnet die Zahlen und wird auch von analysis.js gerufen.

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
