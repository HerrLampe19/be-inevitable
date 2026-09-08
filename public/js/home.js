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
// „Lower 1" -> „L1"; Einwortnamen werden nur so weit gekürzt, dass sich keine zwei Tage des Plans
// gleichen („Push"/„Pull" -> „Pus"/„Pul", nicht zweimal „Pu").
function homeAbbrDay(n,len){n=String(n||'').trim();if(!n)return 'Tr';
  const parts=n.split(/[\s\-_/]+/).filter(Boolean);
  if(parts.length>1)return parts.map(p=>/^\d+$/.test(p)?p:p.charAt(0).toUpperCase()).join('').slice(0,3);
  return (parts[0].charAt(0).toUpperCase()+parts[0].slice(1)).slice(0,Math.max(2,len||2));}
function homeShortDay(n){
  const names=(((HOME_DATA&&HOME_DATA.plan&&HOME_DATA.plan.days)||(PLAN&&PLAN.days)||[]).map(d=>d&&d.name).filter(Boolean));
  for(let len=2;len<=5;len++){
    const seen={};let clash=false;
    names.forEach(x=>{const a=homeAbbrDay(x,len);if(seen[a]!==undefined&&seen[a]!==x)clash=true;seen[a]=x;});
    if(!clash)return homeAbbrDay(n,len);}
  return homeAbbrDay(n,5);}
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
// Eine Anfrage statt neun. Fällt der Server auf 404 (Endpunkt noch nicht deployt), greifen die Einzelrouten.
async function loadHomeData(){
  const uid=VIEW_USER||ME.id;
  let d=null;
  const r=await API.get('/home/'+uid);
  if(r.status===200&&r.data&&r.data.today)d=r.data;
  else d=await homeLegacyLoad(uid);
  if(!d)return null;
  HOME_DATA=d;
  if(d.today)TODAY=d.today;
  HOME_CIS=d.checkins||[];
  if(d.insights){try{LAST_INSIGHTS=d.insights;}catch(e){}}
  if(d.mindset){try{MIND_TODAY=d.mindset;}catch(e){}}
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
    API.get('/checkins/'+uid),
    API.get('/foodlog/'+uid+'?date='+today()),
    API.get('/supplement-intake/'+uid+'?date='+today()),
    API.get('/insights/'+uid),
    API.get('/logs/'+uid+'?date='+today()),
    API.get('/mindset/today/'+uid)
  ]);
  const ok=(x)=>(x&&x.status===200)?x.data:null;
  const days=((PLAN&&PLAN.days)||[]).map(d=>{const exs=(d.exercises||[]).filter(e=>!e.deleted);
    return {id:d.id,name:d.name,exerciseCount:exs.length,expectedSets:exs.reduce((s,e)=>s+(e.target_sets||3),0)};});
  const logs=(ok(logsR)?.logs)||[];
  return {date:today(),today:TODAY,plan:{days,activeTitle:PLAN?.title||''},
    checkins:ok(cr)?.checkins||[],foodlog:ok(flr),supplements:ok(suppR),insights:ok(insR),
    logsToday:logs.filter(l=>(+l.reps||0)>0).length,monthly:null,mindset:ok(mindR),unread:null};}

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
  const hasMind=!!(MIND&&typeof openPriming==='function'&&own);
  const primed=!!(MIND&&MIND.priming),evened=!!(MIND&&MIND.evening);
  const mins=[5,10,15].includes(+MIND?.prefs?.priming_minutes)?+MIND.prefs.priming_minutes:10;
  // Tagesziele – nur, was es heute wirklich gibt (sonst wäre n/n gelogen)
  const goals=[{key:'checkin',ic:'pencil',l:'Check-in',done:checkedIn,act:'homeExpandCheckin()'},
    {key:'food',ic:'utensils',l:'Ernährung',done:gFood,act:"go('diet')"}];
  if(sTot>0)goals.push({key:'supp',ic:'pill',l:'Supplements',done:sDone>=sTot,act:'openSupp()'});
  if(isTrain&&expected>0)goals.push({key:'train',ic:'dumbbell',l:'Training',done:doneSets>=expected,act:"go('workout')"});
  if(hasMind)goals.push({key:'mind',ic:'brain',l:'Mindset',done:primed,act:"go('mindset')"});
  const doneN=goals.filter(g=>g.done).length;
  return {d,T,eff,isTrain,isSick,tdy,own,cis,ciToday,checkedIn,fl,kcalTarget,consumed,gFood,
    sup,sTot,sDone,sItems,sItemsDone,planDays,dayObj,expected,doneSets,MIND,hasMind,primed,evened,mins,
    goals,doneN,allDone:goals.length>0&&doneN===goals.length,
    ins:d.insights||null,monthly:d.monthly||null};}
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

// ===== JETZT-KARTE =====
// Genau EIN roter Primär-Button, gewählt aus dem Tageszustand; darunter höchstens vier offene Kurzwege.
function nowCardHTML(){
  if(!HOME_DATA)return '<div class="today" id="homeNow">'+skeleton(1)+'</div>';
  const s=homeState();
  const eff=s.eff,hour=new Date().getHours();
  const dayName=s.isSick?'Erholung':(s.isTrain?(eff.dayName||'Training'):'Ruhetag');
  const kind=s.isSick?'Krank gemeldet':(s.isTrain?'Trainingstag':'Ruhetag');
  const phase={offseason:'Offseason',prep:'Wettkampf-Prep',maintain:'Maintenance'}[s.T?.phase]||'';
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
  const mw=homeMindWidget(),day1=homeDayOne(s);
  let cta=null,ctaCls='btn block',used='';
  if(s.own){
    if(s.isTrain&&s.expected>0&&s.doneSets<s.expected){
      cta={l:s.doneSets>0?`Weiter · ${fmtNum(s.doneSets)}/${fmtNum(s.expected)} Sätze`:`${dayName} starten`,fn:"go('workout',{start:true})"};used='train';}
    else if(s.isTrain&&s.expected===0&&s.planDays.length){cta={l:'Training öffnen',fn:"go('workout')"};used='train';}
    else if(!s.isTrain&&hour<12&&s.hasMind&&!s.primed&&!day1){cta={l:`Priming starten · ${fmtNum(s.mins)} Min.`,fn:'openPriming()'};used='mind';}
    else if(!s.checkedIn){cta={l:'Check-in eintragen',fn:'homeExpandCheckin()'};used='checkin';}
    else if(hour>=17&&s.hasMind&&!s.evened&&!day1){cta={l:'Abend-Reflexion',fn:'openEvening()'};used='mind';}
    else if(s.allDone){cta={l:'Tag komplett',fn:"go('tracker')"};ctaCls='btn block sec';used='done';}
    else cta={l:'Ernährung öffnen',fn:"go('diet')"};
  }else{
    cta={l:'Trainingsplan ansehen',fn:"go('workout')"};ctaCls='btn block sec';
  }

  // --- Sekundäre Kurzwege (max. 4, nur offene Punkte) ---
  const chips=[];
  if(s.own){
    // Nur wenn das Mindset-Modul wirklich etwas zu tun anbietet (Aktion + Ziel) – ein „erledigt ✓" ist kein Kurzweg
    if(used!=='mind'&&!day1&&mw&&!mw.done&&mw.action&&mw.fn)
      chips.push({l:homeMindChipLabel(mw),fn:String(mw.fn),ic:'brain'});
    if(used!=='checkin'&&!s.checkedIn)chips.push({l:'Check-in',fn:'homeExpandCheckin()',ic:'pencil'});
    if(!s.gFood)chips.push({l:'Essen loggen',fn:"typeof openLogFood==='function'?openLogFood({focus:true}):go('diet')",ic:'utensils'});
    if(s.sTot>0&&s.sDone<s.sTot)chips.push({l:`Supplements ${fmtNum(s.sDone)}/${fmtNum(s.sTot)}`,fn:'openSupp()',ic:'pill'});
    const nm=homeNextMeal();
    if(hour<12&&nm&&!nm.logged&&nm.mealId)chips.push({l:`${homeShortLabel(nm.label)} ✓`,fn:`homeMealDone(${+nm.mealId})`,ic:'check'});
    // Zusatzangebote des Mindset-Moduls (z.B. „Power-Atmung 0/3") ganz zum Schluss – sie fallen als Erstes weg
    if(mw&&!day1&&Array.isArray(mw.secondary))mw.secondary.filter(x=>x&&x.label&&x.fn).slice(0,2)
      .forEach(x=>chips.push({l:String(x.label),fn:String(x.fn),ic:'sparkles'}));
  }
  // .wrap: die vier Kurzwege stehen umgebrochen alle sichtbar da – gescrollt war der vierte unerreichbar
  const chipRow=chips.length?`<div class="chip-row wrap mt-3">${chips.slice(0,4).map(c=>
    `<button class="chip soft on" onclick="${c.fn}">${icon(c.ic,16)}${esc2(c.l)}</button>`).join('')}</div>`:'';

  // --- Comeback-Notiz (≥ 3 Tage ohne Check-in) ---
  let comeback='';
  if(s.own&&s.cis.length){
    const since=Math.floor((Date.parse(s.tdy+'T00:00:00Z')-Date.parse(s.cis[0].date+'T00:00:00Z'))/864e5);
    if(since>=3)comeback=`<div class="note warn mt-3">Willkommen zurück – ${pl(since,'Tag','Tage')} Pause. Trag heute kurz etwas ein und komm wieder in deinen Rhythmus.</div>`;}

  // --- 7-Tage-Streifen ---
  let strip='';
  const pv=(s.T&&s.T.preview)||[];
  if(pv.length){
    const wd=['So','Mo','Di','Mi','Do','Fr','Sa'];
    const base=s.T?.date?new Date(s.T.date+'T00:00:00'):new Date();
    strip=`<div class="chip-row mt-3" role="list">`+pv.slice(0,7).map((p,i)=>{
      const dt=new Date(base);dt.setDate(base.getDate()+i);
      const tr=p.type==='train',sick=p.type==='sick';
      const lbl=(i===0?'Heute':wd[dt.getDay()])+' '+(tr?homeShortDay(p.dayName):sick?'Pause':'–');
      return `<button class="chip${i===0?' on':(tr?'':' rest')}" role="listitem" onclick="typeof openCalendar==='function'?openCalendar():0">${esc2(lbl)}</button>`;
    }).join('')+'</div>';}

  return `<div class="today" id="homeNow">
    <div class="between mb-1"><div class="eyebrow">${eyebrow}</div>
      ${s.own?`<button class="btn sm ghost" onclick="openDayPicker()">Tag ändern</button>`:''}</div>
    <div class="daytype">${esc2(dayName)}</div>
    ${meta?`<div class="meta">${esc2(meta)}</div>`:''}
    ${comeback}
    ${cta?`<button class="${ctaCls} mt-4" onclick="${cta.fn}">${esc2(cta.l)}</button>`:''}
    ${chipRow}${strip}
  </div>`;}

// Status-Zeile (Challenge / Rad des Lebens) – nur wenn vorhanden, als EINE Zeile unter der Karte.
// Nur im eigenen Konto: das Mindset-Modul verweigert Coaches jede Aktion, eine tote Zeile ist schlechter als keine.
function homeMindStatusHTML(){
  const s=homeState();if(!s.own||homeDayOne(s))return '';
  const mw=homeMindWidget();if(!mw||!mw.status||!mw.status.text)return '';
  return `<div class="rows mb-3" id="homeMind"><div class="row tap" onclick="${String(mw.status.fn||"go('mindset')")}">
    <div class="r-ic">${icon('brain')}</div><div class="rl truncate">${esc2(String(mw.status.text))}</div><div class="rr"></div></div></div>`;}

// ===== „HEUTE GESCHAFFT" – RINGE + STREAK =====
function drawHomeGoals(){
  const s=homeState();if(!s.own||!s.goals.length)return '';
  const streak=s.ins?.streaks?.checkin||0,fb=s.ins?.freezes?.balance||0;
  const rings=s.goals.map(g=>`<button class="hg" onclick="${g.act}" aria-label="${esc2(g.l)}${g.done?' erledigt':''}">
      <span class="hg-r">${ring(g.done?1:0,{size:46,stroke:4,color:'var(--green)',track:'var(--surface3)'})}<span class="hg-ic">${icon(g.ic,20)}</span>${g.done?`<span class="hg-b">${icon('check',12)}</span>`:''}</span>
      <span class="hg-l${g.done?' done':''}">${esc2(g.l)}</span></button>`).join('');
  const jok=`<button class="hg-jok" onclick="openStreakInfo()" aria-label="Streak-Joker">${icon('shield',16)}${fmtNum(fb)}</button>`;
  const line=streak>0
    ? `<div class="hg-streak">${icon('flame',20)}<div class="fill"><b>${pl(streak,'Tag','Tage')} Streak</b>${s.checkedIn?' <span class="tone-green">· heute schon dran</span>':' <span class="tone-amber">· heute noch offen</span>'}</div>${jok}</div>`
    : `<div class="hg-streak">${icon('flame',20)}<div class="fill muted">Starte heute deine Streak – jeder Tag mit Eintrag zählt.</div>${jok}</div>`;
  // „Tag komplett" einmal pro Tag feiern
  if(s.allDone){const key='be_daily_'+s.tdy;
    try{if(!localStorage.getItem(key)&&HOME_TIP!==key){HOME_TIP=key;localStorage.setItem(key,'1');
      setTimeout(()=>{if(typeof celebrate==='function')celebrate('🎉','Tag komplett!','Alle Tagesziele erreicht – stark!');},700);}}catch(e){}}
  return `<div class="section-label"><span>Heute geschafft</span><span class="sl-r${s.allDone?' tone-green':''}">${fmtNum(s.doneN)}/${fmtNum(s.goals.length)}</span></div>
    <div class="card mb-3"><div class="hg-row">${rings}</div>${line}</div>`;}

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
  const more=`<div class="cluster mt-3">
    <button class="btn sm sec" onclick="openBulkCheckin()">Mehrere Tage</button>
    <button class="btn sm sec" onclick="typeof openMeasure==='function'?openMeasure():toast('Maße sind hier noch nicht verfügbar')">Maße</button>
    <button class="btn sm sec" onclick="typeof openPhotos==='function'?openPhotos():toast('Fotos sind hier noch nicht verfügbar')">Foto</button></div>`;

  // --- Coach/Admin im Athleten-Kontext: nur Ansicht (die Selbstauskunft gehört dem Athleten) ---
  if(!s.own){
    const rows=cis.slice(0,5).map(c=>{
      const p=[c.weight!=null?fmtNum(c.weight,1)+' kg':null,c.sleep!=null?homeSleepTxt(c.sleep):null,
        c.steps!=null?fmtNum(c.steps)+' Schritte':null,c.water!=null?fmtNum(c.water,1)+' L':null].filter(Boolean);
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
    return `<div class="between mb-2"><div class="fill"><div class="h3">Check-in</div>${trend}</div>
        <button class="btn sm sec" onclick="homeExpandCheckin()">${done?'Bearbeiten':'Eintragen'}</button></div>
      <div class="rows"><div class="row tap" onclick="homeExpandCheckin()"><div class="r-ic${done?' tone-green':''}">${icon(done?'check':'pencil',22)}</div>
        <div class="rl">Heute<small>${done?esc2(parts.join(' · ')):'Gewicht, Schlaf, Schritte und Wasser – dauert 20 Sekunden'}</small></div><div class="rr"></div></div></div>
      ${more}`;}

  // --- Formular (heute oder Nachtrag) ---
  const past=CHECKIN_DATE!==tdy;
  const g=k=>ci[k]!=null?ci[k]:'';
  let chips='<div class="chip-row mb-3">';
  for(let i=0;i<7;i++){const dd=new Date(tdy+'T00:00:00');dd.setDate(dd.getDate()-i);const iso=fmt(dd);
    const has=cis.some(c=>c.date===iso&&(c.weight!=null||c.sleep!=null||c.steps!=null||c.water!=null));
    const lbl=i===0?'Heute':i===1?'Gestern':fmtDate(iso,{weekday:'short'});
    chips+=`<button class="chip${iso===CHECKIN_DATE?' on':''}${has&&iso!==CHECKIN_DATE?' done':''}" onclick="setCheckinDate('${iso}')">${has?icon('check',14):''}${esc2(lbl)}</button>`;}
  chips+='</div>';
  const head=trend?`<div class="mb-3">${trend}</div>`:'';
  return `${head}
    ${chips}
    ${past?`<div class="note mb-3">Du trägst für <b>${esc2(fmtDate(CHECKIN_DATE,{weekday:'long',month:'long'}))}</b> nach – das schließt auch Streak-Lücken.</div>`:''}
    <div class="grid-2">
      <div class="field"><label>Gewicht (kg)</label><input id="qc_weight" type="number" step="0.1" inputmode="decimal" min="0" max="500" value="${g('weight')}" placeholder="${esc2(fmtNum(last.weight??startW??75,1))}"></div>
      <div class="field"><label>Schlaf (h)</label><input id="qc_sleep" type="number" step="0.5" inputmode="decimal" min="0" max="24" value="${g('sleep')}" placeholder="${last.sleep||'8'}"></div>
      <div class="field"><label>Schritte</label><input id="qc_steps" type="number" inputmode="numeric" min="0" max="200000" value="${g('steps')}" placeholder="${last.steps||'8000'}"></div>
      <div class="field"><label>Wasser (L)</label><input id="qc_water" type="number" step="0.1" inputmode="decimal" min="0" max="30" value="${g('water')}" placeholder="${last.water||'3'}"></div>
    </div>
    <button class="btn block" id="qcSave" onclick="quickCheckin()">${past?'Nachtragen':'Check-in speichern'}</button>
    <div class="caption mt-2">Leer lassen ist okay.</div>`;}
// Alias mit dem Namen aus dem Plan – gibt denselben Karteninhalt zurück
function drawHomeCheckin(){return homeCheckinHTML();}
function setCheckinDate(d){CHECKIN_DATE=d;homePatch('homeCheckinSheet',homeCheckinHTML({sheet:true}));}
// „Check-in eintragen"/„Bearbeiten" von der Startseite -> dasselbe Sheet wie aus der Analyse
function homeExpandCheckin(){openCheckinSheet(today());}
// Check-in-Formular als Sheet (Startseite und Analyse-Nachtrag, Vertrag mit WP5)
function openCheckinSheet(date){
  CHECKIN_DATE=date||today();HOME_CI_SHEET=true;
  openSheet('Check-in',`<div id="homeCheckinSheet">${homeCheckinHTML({sheet:true})}</div>`);}

// Speichern OHNE Neuaufbau der Seite: Werte bleiben, Scrollposition bleibt, Ringe/Hero ziehen nach.
async function quickCheckin(){
  const w=num('qc_weight'),sl=num('qc_sleep'),st=num('qc_steps'),wa=num('qc_water');
  if(w==null&&sl==null&&st==null&&wa==null)return toast('Bitte mindestens einen Wert eingeben');
  const d=CHECKIN_DATE||today();
  const body={user_id:VIEW_USER,date:d};
  if(w!=null)body.weight=w;if(sl!=null)body.sleep=sl;if(st!=null)body.steps=st;if(wa!=null)body.water=wa;
  const btn=document.getElementById('qcSave');if(btn)btn.disabled=true;
  const r=await API.post('/checkins',body);
  if(r.status!==200){if(btn)btn.disabled=false;return toast(r.data?.error||'Fehler – nicht gespeichert');}
  if(r.data?.jokerRefunded)toast('Nachgetragen – Joker zurückerstattet ✓');
  else toast(d===today()?'Check-in gespeichert ✓':'Nachgetragen ✓');
  if(btn){btn.textContent='Gespeichert ✓';btn.classList.add('sec');}
  // Daten nachladen (Check-ins + Insights für Streak/Level) und alles an Ort und Stelle nachziehen
  const own=(VIEW_USER===ME.id&&ME.role==='athlete');
  const [cr,ir]=await Promise.all([API.get('/checkins/'+VIEW_USER),own?API.get('/insights/'+VIEW_USER):Promise.resolve(null)]);
  if(cr.status===200){HOME_CIS=cr.data?.checkins||[];if(HOME_DATA)HOME_DATA.checkins=HOME_CIS;}
  if(ir&&ir.status===200){if(HOME_DATA)HOME_DATA.insights=ir.data;try{LAST_INSIGHTS=ir.data;}catch(e){}}
  if(typeof refreshAchievements==='function')refreshAchievements();
  invalidateView('tracker');invalidateView('mindset');
  CHECKIN_DATE=today();
  if(HOME_CI_SHEET){HOME_CI_SHEET=false;closeAllSheets();}
  homePatch('homeGoals',drawHomeGoals());homePatch('homeCheckin',homeCheckinHTML());homePatchHero();homeCache();}

// ===== ERNÄHRUNG (Ring + nächste Plan-Mahlzeit) =====
function homeNextMeal(){
  if(typeof nextPlanMeal!=='function')return null;
  try{return nextPlanMeal((HOME_DATA&&HOME_DATA.foodlog&&HOME_DATA.foodlog.summary)||null);}catch(e){return null;}}
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
  return `<div class="section-label"><span>Ernährung</span><span class="sl-r">${goalTxt}${s.isTrain?' · Trainingstag':' · Ruhetag'}</span></div>
    <div class="card mb-3">
      <div class="ring-card" onclick="go('diet')">
        ${ring(pct,{size:76,color:over?'var(--amber)':'var(--red)',label:fmtNum(s.consumed),sub:'/ '+fmtNum(s.kcalTarget)})}
        <div class="ring-info"><div class="big">${fmtNum(s.consumed)}<em> / ${fmtNum(s.kcalTarget)} kcal</em></div>
          <div class="lbl">${esc2(status)}</div></div>
        <div class="muted-2">${icon('chevronRight',20)}</div>
      </div>${next}</div>`;}
// „Gegessen" direkt von der Startseite: loggt die Plan-Mahlzeit und zieht Ring/Ringe nach
async function homeMealDone(mealId){
  if(coachView())return go('diet');   // Sicherheitsnetz: der Coach loggt nichts für seinen Athleten
  if(typeof logFromMeal!=='function')return go('diet');
  const okRes=await logFromMeal(mealId);
  if(okRes===false)return;
  const r=await API.get('/foodlog/'+(VIEW_USER||ME.id)+'?date='+today());
  if(r.status===200&&HOME_DATA)HOME_DATA.foodlog=r.data;
  invalidateView('diet');
  homePatch('homeFood',homeFoodHTML());homePatch('homeGoals',drawHomeGoals());homePatchHero();homeCache();}

// ===== SUPPLEMENTS-BLOCK AUF DER STARTSEITE =====
// Abhak-Zeile mit role="button": Enter/Leertaste sollen wie ein Tipp wirken
function homeRowKey(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();ev.currentTarget.click();}}
function homeSuppHTML(){
  const s=homeState();if(!s.own||!s.sup)return '';
  const items=s.sItems;
  if(!items.length)return `<div class="section-label"><span>Supplements</span></div>
    <div class="rows mb-3"><div class="row tap" onclick="openAddIntake()"><div class="r-ic">${icon('pill')}</div>
      <div class="rl">Keine Supplements zugewiesen<small>Eigene hinzufügen</small></div><div class="rr"></div></div></div>`;
  const rows=items.slice(0,4).map(p=>`<div class="row h-tap" role="button" tabindex="0" aria-pressed="${p.taken?'true':'false'}" onkeydown="homeRowKey(event)" onclick="toggleIntakeHome(event,${p.supplement_id??'null'},${p.intake_id??'null'},'${esc(p.name)}','${esc(p.dose||'')}')">
      <div class="r-ic${p.taken?' tone-green':''}">${icon(p.taken?'check':'pill',22)}</div>
      <div class="rl${p.taken?' done':''}">${esc2(p.name)}${p.dose?`<small>${esc2(p.dose)}</small>`:''}</div>
      <div class="rr">${p.mandatory?'<span class="pill must">Pflicht</span>':''}</div></div>`).join('');
  const more=`<div class="row tap" onclick="openSupp()"><div class="r-ic">${icon('more')}</div>
    <div class="rl">${items.length>4?'Alle '+fmtNum(items.length)+' anzeigen':'Tages-Check öffnen'}</div><div class="rr"></div></div>`;
  return `<div class="section-label"><span>Supplements</span><span class="sl-r${s.sItemsDone===items.length?' tone-green':''}">${fmtNum(s.sItemsDone)}/${fmtNum(items.length)}</span></div>
    <div class="rows mb-3">${rows}${more}</div>`;}

// ===== FORTSCHRITT: EIN STREIFEN, DREI ANTIPPBARE SEGMENTE =====
function homeProgressHTML(){
  const s=homeState();if(!s.own||!s.ins)return '';
  const I=s.ins,lp=I.levelProgress||{pct:0};
  const w=I.week&&I.week.thisWeek,wg=I.weekGoal||{target:0,done:0};
  const vol=w?(w.volume/1000):0;
  const MG=s.monthly;
  const segs=[
    {t:'Level '+fmtNum(I.level),s:fmtNum(I.xp)+' XP',pct:lp.pct,cls:'',fn:"typeof openAchievements==='function'?openAchievements():go('tracker')"},
    {t:'Woche '+fmtNum(wg.done)+'/'+fmtNum(wg.target),s:fmtNum(vol,1)+' t Volumen',pct:wg.target?Math.min(100,Math.round(wg.done/wg.target*100)):0,cls:(wg.target&&wg.done>=wg.target)?'green':'',fn:"if(typeof renderTracker==='function')renderTracker.tab='training';go('tracker')"}
  ];
  if(MG&&MG.parts)segs.push({t:'Monat '+fmtNum(MG.reachedCount)+'/'+fmtNum(MG.parts.length),s:'Gesamt '+fmtNum(MG.overallPct)+'%',pct:MG.overallPct,cls:MG.allReached?'green':'',fn:"typeof openMonthlyGoal==='function'?openMonthlyGoal():go('tracker')"});
  // Keine Monatsziel-Feier auf der Startseite: GET /api/home liefert monthly bewusst ohne Gutschrift
  // (justClaimed ist dort immer false), und der Fallback holt /monthly gar nicht erst. Gutschrift und
  // Feier gehören zur Analyse (analysis.js, GET /api/monthly) – dort und nur dort.
  if(typeof checkNewAchievements==='function'){try{checkNewAchievements(I);}catch(e){}}
  return `<div class="section-label"><span>Fortschritt</span><span class="sl-r">${esc2(I.levelTitle||'')}</span></div>
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

// ===== RENDER =====
function homePatchHero(){const el=document.getElementById('homeNow');if(!el)return;el.outerHTML=nowCardHTML();homeCache();}
async function renderHome(v,opts){
  opts=opts||{};
  const mounted=!!(v&&v.querySelector('#homePage'));
  if(!opts.cached&&!mounted)v.innerHTML=`<div class="page on first" id="homePage">${skeleton(4)}</div>`;
  const d=await loadHomeData();
  if(!d){v.innerHTML=`<div class="page on" id="homePage">${emptyState({icon:'alertTriangle',title:'Daten nicht erreichbar',text:'Die Startseite konnte nicht geladen werden. Prüfe deine Verbindung.',btn:{label:'Neu laden',onclick:"go('home')"}})}</div>`;return;}
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
  html+=homeMindStatusHTML();
  html+=`<div id="homeGoals">${drawHomeGoals()}</div>`;
  html+=`<div class="card mb-3" id="homeCheckin">${homeCheckinHTML()}</div>`;
  html+=`<div id="homeFood">${homeFoodHTML()}</div>`;
  html+=`<div id="homeSupp">${homeSuppHTML()}</div>`;
  html+=homeProgressHTML();
  if(s.own)html+=homeMoreHTML();
  html+='</div>';
  // Beim Auffrischen einer schon stehenden Seite die Scrollposition halten: das Ersetzen des Inhalts
  // staucht das Dokument kurz zusammen, der Browser würde sonst nach oben klemmen.
  const keepY=(opts.cached||mounted)?window.scrollY:0;
  v.innerHTML=html;
  if(keepY){window.scrollTo(0,keepY);requestAnimationFrame(()=>window.scrollTo(0,keepY));}
  homeCache();
  // Tour erst jetzt – der Hero steht, nichts liegt über dem Header (WP1)
  if(typeof maybeStartTour==='function'){try{maybeStartTour();}catch(e){}}
}

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
  const r=await API.get('/checkins/'+VIEW_USER);const cis=r.data?.checkins||[];
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
  let n=0,refunded=0;
  for(const d of BULK_SEL){const r=await API.post('/checkins',{user_id:VIEW_USER,date:d,...vals});
    if(r.status===200){n++;if(r.data?.jokerRefunded)refunded++;}}
  closeAllSheets();
  toast(pl(n,'Tag','Tage')+' nachgetragen ✓');
  if(refunded)setTimeout(()=>toast(pl(refunded,'Joker','Joker')+' zurückerstattet'),1800);
  if(typeof refreshAchievements==='function')refreshAchievements();
  invalidateView('tracker');
  // Startseite an Ort und Stelle nachziehen (kein go('home'), keine Scroll-Rückstellung)
  const own=(VIEW_USER===ME.id&&ME.role==='athlete');
  const [cr,ir]=await Promise.all([API.get('/checkins/'+VIEW_USER),own?API.get('/insights/'+VIEW_USER):Promise.resolve(null)]);
  if(cr.status===200){HOME_CIS=cr.data?.checkins||[];if(HOME_DATA)HOME_DATA.checkins=HOME_CIS;}
  if(ir&&ir.status===200){if(HOME_DATA)HOME_DATA.insights=ir.data;try{LAST_INSIGHTS=ir.data;}catch(e){}}
  homePatch('homeGoals',drawHomeGoals());homePatch('homeCheckin',homeCheckinHTML());homePatchHero();homeCache();}

// ===== STREAK-JOKER =====
function openStreakInfo(){
  const f=((typeof LAST_INSIGHTS!=='undefined'&&LAST_INSIGHTS)?LAST_INSIGHTS.freezes:null)||(HOME_DATA?.insights?.freezes)||{};
  const fb=f.balance==null?1:f.balance,mx=f.max||2;
  openSheet('Streak-Joker',`
    <div class="center mb-4">${ring(mx?Math.min(1,fb/mx):0,{size:96,color:'var(--blue)',label:fmtNum(fb)+' / '+fmtNum(mx),sub:'Joker'})}</div>
    <div class="note mb-3">Ein <b>Streak-Joker</b> rettet automatisch einen Tag, an dem du nichts eingetragen hast – deine Serie reißt dann nicht.</div>
    <div class="rows mb-4">
      <div class="row"><div class="r-ic">${icon('shield')}</div><div class="rl">Automatischer Einsatz<small>Vergisst du einen Tag, springt ein Joker ein</small></div></div>
      <div class="row"><div class="r-ic">${icon('calendar')}</div><div class="rl">Nachschub<small>+1 Joker pro aktiver Woche (max. ${fmtNum(mx)})</small></div></div>
      <div class="row"><div class="r-ic">${icon('pencil')}</div><div class="rl">Selbst nachtragen<small>Vergessene Tage kannst du auch manuell nachpflegen</small></div></div>
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
  let h='<div class="note mb-3">Wähle, was du heute machst. Trainings-Tage rotieren automatisch weiter – du kannst jederzeit abweichen.</div><div class="rows">';
  days.forEach(d=>{const on=cur===d.name;const isSug=sug.type==='train'&&sug.dayName===d.name;
    h+=`<div class="row h-tap" onclick="setDay('train','${esc(d.name)}')"><div class="r-ic">${icon('dumbbell')}</div>
      <div class="rl">${esc2(d.name)}${isSug?'<small>Vorschlag aus deinem Rhythmus</small>':''}</div>
      <div class="rr">${on?icon('check',20,'tone-green'):''}</div></div>`;});
  h+=`<div class="row h-tap" onclick="setDay('rest')"><div class="r-ic">${icon('moon')}</div>
      <div class="rl">Ruhetag${sug.type==='rest'?'<small>Vorschlag aus deinem Rhythmus</small>':''}</div>
      <div class="rr">${cur==='rest'?icon('check',20,'tone-green'):''}</div></div>
    <div class="row h-tap" onclick="setDay('sick')"><div class="r-ic">${icon('bed')}</div>
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
  homePatchHero();homePatch('homeGoals',drawHomeGoals());homePatch('homeFood',homeFoodHTML());homeCache();}

// ===== SUPPLEMENTS-CHECKLISTE (aus shell.js hierher verschoben – WP0) =====
// Supplements des angesehenen Nutzers: Pflicht oben hervorgehoben, Details auf Tippen.
async function openSupp(){openSheet('Supplements','<div class="spinner"></div>');
  await drawSuppSheet();}
let SUPP_TODAY=null;
async function drawSuppSheet(){
  const uid=VIEW_USER||ME.id;const T=today();
  const r=await API.get('/supplement-intake/'+uid+'?date='+T);
  if(r.status!==200){openSheet('Supplements',`<div class="note err">${esc2(r.data?.error||'Fehler')}</div>`);return;}
  SUPP_TODAY=r.data;const {plan,extras,done,total}=r.data;
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
  const tap=isOwn?` h-tap" onclick="toggleIntake(event,${p.supplement_id??'null'},${p.intake_id??'null'},'${esc(p.name)}','${esc(p.dose||'')}')`:'"';
  return `<div class="row${tap}">
    <div class="r-ic${checked?' tone-green':''}">${icon(checked?'check':'pill',22)}</div>
    <div class="rl${checked?' done':''}">${esc2(p.name)}${p.mandatory?' <span class="pill must">Pflicht</span>':''}
      <small>${p.dose?esc2(p.dose):'Menge offen'}${p.category?' · '+esc2(p.category):''}</small></div>
    <div class="rr">
      ${isOwn&&checked?`<button class="btn sm sec" onclick="event.stopPropagation();editIntakeDose(${p.intake_id},'${esc(p.name)}','${esc(p.dose||'')}')">Menge</button>`:''}
      ${p.supplement_id?`<button class="btn icon sm ghost" aria-label="Details zu ${esc2(p.name)}" onclick="event.stopPropagation();suppDetail(${p.supplement_id})">${icon('info',18)}</button>`
        :(isOwn?`<button class="btn icon sm ghost" aria-label="${esc2(p.name)} entfernen" onclick="event.stopPropagation();removeIntake(${p.intake_id},'${esc(p.name)}','${esc(p.dose||'')}')">${icon('x',18)}</button>`:'')}
    </div></div>`;}
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
  if(intakeId){await API.del('/supplement-intake/'+uid+'/'+intakeId);
    if(free)suppUndoToast(uid,name,dose,async()=>{await drawSuppSheet();await homeRefreshSupp();});}
  else{await API.post('/supplement-intake/'+uid,suppIntakeBody(sid,name,dose));}
  await drawSuppSheet();
  await homeRefreshSupp();}
// Abhaken direkt aus dem Home-Widget -> nur die betroffenen Blöcke nachziehen (kein Neuaufbau der Seite)
async function toggleIntakeHome(ev,sid,intakeId,name,dose){if(ev)ev.stopPropagation();
  const free=(sid===null||sid===undefined),T=today();
  if(intakeId){await API.del('/supplement-intake/'+ME.id+'/'+intakeId);
    // Eigener Eintrag: Zeile bleibt als leerer Haken stehen (erneut antippen = wieder eintragen) + Undo-Toast
    if(free){if(!HOME_SUPP_OFF.some(x=>x.date===T&&x.name===name))HOME_SUPP_OFF.push({date:T,name,dose:dose||''});
      suppUndoToast(ME.id,name,dose,homeRefreshSupp);}}
  else{await API.post('/supplement-intake/'+ME.id,suppIntakeBody(sid,name,dose));
    if(free)HOME_SUPP_OFF=HOME_SUPP_OFF.filter(x=>!(x.date===T&&x.name===name));}
  await homeRefreshSupp();}
// Supplement-Stand neu holen und Home-Blöcke patchen (nur wenn die Startseite steht)
async function homeRefreshSupp(){
  if(!document.getElementById('homePage'))return;
  const uid=VIEW_USER||ME.id;
  const r=await API.get('/supplement-intake/'+uid+'?date='+today());
  if(r.status!==200||!HOME_DATA)return;
  HOME_DATA.supplements=r.data;
  homePatch('homeSupp',homeSuppHTML());homePatch('homeGoals',drawHomeGoals());homePatchHero();homeCache();}
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
  await API.post('/supplement-intake/'+uid,{name,dose:val('add_supp_dose'),date:today()});
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
