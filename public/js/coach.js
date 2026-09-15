// BE INEVITABLE – Frontend, Teil «coach.js» (WP7: Coach & Admin). Klassische Skripte in fester Reihenfolge
// (siehe index.html); alle Funktionen sind global, wie zuvor in der einen app.js.
// Inhalt: Admin-Verwaltung · Athleten-Übersicht (EIN Aufmerksamkeits-Modell) · Athleten-Dashboard · Kontextleiste
// (renderCtxBar) · Coach-Karte für die Home (coachHomeCard) ·
// Nachrichten (Schnellnachricht, Unterhaltung, Rundnachricht) · Supplements-Zuweisung · Excel-Import · Vorlagen.
// Verträge für andere Bereiche stehen jeweils über der Funktion.

// Hinweis: esc2() (HTML-Escaping) liegt seit 2.1.0 in core.js, weil jede Datei es nutzt.

// ===== GEMEINSAME COACH-HELFER =====
const ATT_ORDER={alert:0,watch:1,ok:2};
const ATT_LABEL={alert:'Alarm',watch:'Beobachten',ok:'OK'};
let ATHLETES_CACHE=[];        // zuletzt geladene Athleten (mit status/reasons)
let COACH_OV=null;            // {ts,o,list,role} – Übersicht-Cache (~60 s, sofortiges Zeichnen beim Zurückkommen)
let COACH_DASH={};            // Dashboard-Daten je Athlet {ts,d,flagged} – für die Home-Karte im Kontext
let ADMIN_CACHE=null;         // {ts,users,coaches,stats}
let AVATAR_CACHE={};          // id -> dataURL|null
let AI_STATUS=null;           // {configured:boolean|null, cooldownSec}
let COACH_FILTER='all';       // Filter-Chips über der Athletenliste: all | alert | watch | new
let COACH_QUERY='';           // Suchtext der Athletenliste (klein geschrieben) – EIN Sieb mit COACH_FILTER
let THREAD=null;              // offene Unterhaltung {id,name,msgs}
let MONTHLY_UID=null;         // Athlet, dessen Monatsziel gerade bearbeitet wird (explizit, kein Kontext-Nebeneffekt)
const CACHE_MS=60000;

// Spiegel von logic.attentionStatus() – nur als Fallback, wenn der Server noch kein status/reasons liefert.
// Die Regel steht seit 2.5.0 im Rechenkern (logic.js attentionStatus); dieser Zwilling MUSS gleich
// rechnen, sonst wechselt dieselbe Zeile ohne Datenaenderung die Farbe, sobald der Fallback greift.
// D37: Die Trainings-Schwelle folgt der geplanten Frequenz. Feste 6/10 Tage bedeuteten bei 1×/Woche schon nach
// zwei plangemaessen Tagen Gelb und bei 4×/Woche erst nach drei verpassten Einheiten – dieselbe Lampe, zwei
// voellig verschiedene Lagen. gap = geplanter Abstand zwischen zwei Einheiten, danach zwei bzw. sieben Tage Luft.
// Ebenfalls D37: eine ueber 30 Tage alte, vergessene Beschwerde haelt den Athleten sonst dauerhaft auf Rot und
// verdeckt die echten Faelle – sie bleibt sichtbar, faellt aber auf Gelb zurueck.
// Bekannte Abweichung (in DEFER-A1 vermerkt): daysSince() rechnet in Geraetezeit, der Server in APP_TZ.
// Der Client kennt die Serverzeitzone nicht; solange /api/athletes status/reasons liefert, greift dieser Zweig nicht.
function attentionStatusClient(o){o=o||{};const reasons=[];let level='ok';
  const bump=l=>{if(l==='alert')level='alert';else if(l==='watch'&&level==='ok')level='watch';};
  const dpw=Math.max(1,Math.min(7,Number(o.daysPerWeek)||3));
  const gap=Math.ceil(7/dpw),watchT=gap+2,alertT=gap+7;
  const f=o.openFlags||0;
  if(f>0){reasons.push(f+' offene Beschwerde'+(f>1?'n':''));
    bump(Number(o.oldestFlagDays)>30?'watch':'alert');}
  const dc=o.daysSinceCheckin,dt=o.daysSinceTraining;
  if(dc==null){reasons.push('noch kein Check-in');bump('watch');}
  else if(dc>=10){reasons.push(dc+' Tage kein Check-in');bump('alert');}
  else if(dc>=5){reasons.push(dc+' Tage kein Check-in');bump('watch');}
  if(dt==null){reasons.push('noch kein Training geloggt');bump('watch');}
  else if(dt>=alertT){reasons.push(dt+' Tage kein Training');bump('alert');}
  else if(dt>=watchT){reasons.push(dt+' Tage kein Training');bump('watch');}
  return{level,reasons};}
function daysSince(d){if(!d)return null;const t=Date.parse(String(d).slice(0,10)+'T00:00:00');return isNaN(t)?null:Math.floor((Date.now()-t)/864e5);}
// EIN Modell: status/reasons vom Server (GET /api/athletes), sonst /coach/attention-Zeile, sonst Client-Fallback.
function athleteStatus(a,attMap){
  if(a&&a.status&&Array.isArray(a.reasons))return{status:a.status,reasons:a.reasons};
  const m=attMap&&attMap[a.id];if(m&&m.status)return{status:m.status,reasons:m.reasons||[]};
  const st=attentionStatusClient({daysSinceCheckin:daysSince(a.lastCheckin),daysSinceTraining:a.lastTrain?daysSince(a.lastTrain):null,openFlags:a.openFlags||0,
    daysPerWeek:coDpw(a),oldestFlagDays:a.oldestFlagDays});
  return{status:st.level,reasons:st.reasons};}
// Geplante Frequenz EINER Quelle: der Server liefert `plannedPerWeek` stufenlos aus dem Rhythmus
// (6-Tage-Zyklus mit 4 Trainings = 4,67), die Spalte `days_per_week` ist die gerundete Ganzzahl (5).
// Wer hier die Spalte nimmt, rechnet mit einer anderen Zahl als der Server – gleiche Daten, andere Lampe.
function coDpw(a){return (a&&(a.plannedPerWeek??a.days_per_week))||3;}
// Dasselbe fuer die ANZEIGE: hier darf es keinen Ersatzwert 3 geben – wer keinen Rhythmus hinterlegt hat,
// hat kein Wochenziel, und die Kachel sagt das auch. `listRow` (GET /api/athletes) kennt die stufenlose
// Rate, das Dashboard-Payload nur die gerundete Spalte – deshalb Listenzeile zuerst.
function coPlannedRate(a,listRow){
  const r=Number((listRow&&listRow.plannedPerWeek)??(a&&a.plannedPerWeek));
  if(r>0)return r;
  const c=Number(a&&a.days_per_week);
  return c>0?c:null;}
// „4,7×/Woche" statt „4,0×/Woche": die Nachkommastelle nur zeigen, wenn die Rate wirklich krumm ist.
function coRateTxt(r){return r==null?'–':fmtNum(r,Number.isInteger(r)?0:1);}
// Beschriftung der Frequenz im Profil. Eine krumme Rate kommt immer aus einem Zyklus, der nicht auf
// sieben Tage aufgeht (6 Tage mit 4 Trainings = 4,67) – in EINER Kalenderwoche stehen dann mal drei,
// mal vier Einheiten. Deshalb „Ø", sobald die Rate Nachkommastellen hat: sonst liest der Coach
// „4,7×/Woche" direkt ueber „3/3 diese Woche" und haelt das fuer einen Widerspruch.
function coRateLabel(r){return r==null?'':(Number.isInteger(r)?'':'Ø ')+coRateTxt(r)+'×/Woche';}
// ---- Wochenziel: EINE Zahl fuer Athlet und Coach ----
// Der Athlet las „Woche 3/3 · Wochenziel erreicht", der Coach fuer denselben Moment „3/4,7 · 64 %".
// Beides war fuer sich richtig und zusammen unbrauchbar: der Athlet sieht die KALENDERWOCHE
// (Montag–Sonntag, Ziel = Trainingsplaetze des Rhythmus DIESER Woche), der Coach sah rollende sieben
// Tage gegen die Durchschnittsrate. Seit 2.5.0 liefert GET /api/athletes das Wochenziel des Athleten
// unveraendert mit (`weekGoal:{target,done,weekStart}`, dieselbe Rechnung wie GET /api/insights) –
// hier wird es nur abgelesen, nie nachgerechnet.
function coWeekGoal(listRow){
  const w=listRow&&listRow.weekGoal;
  if(!w)return null;
  const t=Number(w.target),d=Number(w.done);
  if(!(t>0)||isNaN(d))return null;
  return {target:t,done:d,weekStart:typeof w.weekStart==='string'?w.weekStart:null};}
// Datum um Tage verschieben (ISO, reine UTC-Arithmetik – keine Zeitzonen-Drift ueber Sommerzeit).
function coIsoAdd(iso,days){const t=Date.parse(String(iso)+'T00:00:00Z');
  if(isNaN(t))return null;return new Date(t+days*864e5).toISOString().slice(0,10);}
// Wie viele Tage der Kalenderwoche sind noch offen (heute mitgezaehlt)? 1 = heute ist Sonntag.
// null, wenn der Montag fehlt oder heute gar nicht in dieser Woche liegt (z. B. ein Payload aus dem Cache
// vom Vortag ueber den Wochenwechsel hinweg) – dann behauptet die Kachel nichts ueber „noch Zeit".
function coDaysLeftInWeek(weekStart){
  if(!weekStart)return null;
  const a=Date.parse(weekStart+'T00:00:00Z'),b=Date.parse(today()+'T00:00:00Z');
  if(isNaN(a)||isNaN(b))return null;
  const i=Math.round((b-a)/864e5);
  return (i>=0&&i<=6)?7-i:null;}
// Vorwoche in derselben Wochendefinition: Trainingstage im Fenster [Montag−7, Montag).
// Die Einheiten im Dashboard-Payload sind auf zehn gedeckelt; der Vergleich wird nur gezeigt, wenn die
// Liste nachweislich bis VOR diesen Montag zurueckreicht – sonst waere der Pfeil eine Erfindung.
function coPrevWeekDone(sessions,weekStart){
  if(!weekStart||!Array.isArray(sessions))return null;
  const prev=coIsoAdd(weekStart,-7);if(!prev)return null;
  const dates=sessions.map(s=>String(s&&s.date||'').slice(0,10)).filter(Boolean);
  if(!(dates.length<10||dates.some(d=>d<prev)))return null;
  return new Set(dates.filter(d=>d>=prev&&d<weekStart)).size;}
// numeric:true, sonst steht „Test Athlet 10" vor „Test Athlet 2" (RATE-coach 13).
function sortAthletes(list){return (list||[]).slice().sort((x,y)=>(ATT_ORDER[x.status]??2)-(ATT_ORDER[y.status]??2)||String(x.name).localeCompare(String(y.name),'de',{numeric:true}));}
function attPill(status){const tone={alert:'red',watch:'amber',ok:'green'}[status]||'neutral';return `<span class="pill ${tone}">${ATT_LABEL[status]||'–'}</span>`;}
// Beide Gruende ausschreiben: „+1" war ein Kuerzel, das niemand erklaert bekam (RATE-coach 10/18).
function reasonLine(reasons){reasons=reasons||[];if(!reasons.length)return '';return reasons.map(esc2).join(' · ');}
function athName(id){const a=(ATHLETES_CACHE||[]).find(x=>x.id===id);return a?a.name:(COACH_CONTEXT&&VIEW_USER===id?COACH_CONTEXT:'Athlet');}
function initialOf(name){return esc2(String(name||'?').trim().charAt(0).toUpperCase()||'?');}
// <span> statt <div>: dieser Baustein steckt seit 2.6.0 in <button>-Zeilen (Tastaturbedienung), und ein
// <div> darf dort laut HTML-Spezifikation nicht stehen. `.ath-av` setzt display:flex selbst.
function athAvatar(id,name,cls){return `<span class="ath-av${cls?' '+cls:''}" data-ath-av="${id}">${initialOf(name)}</span>`;}
// Profilbilder nachladen (nur einmal je Athlet; alle Elemente mit data-ath-av=id werden befüllt)
function loadAthAvatars(ids){ids=[...new Set((ids||[]).filter(Boolean))];
  ids.forEach(id=>{const apply=url=>{document.querySelectorAll('[data-ath-av="'+id+'"]').forEach(el=>{el.textContent='';el.style.backgroundImage='url('+url+')';});};
    if(AVATAR_CACHE[id]){apply(AVATAR_CACHE[id]);return;}
    if(AVATAR_CACHE[id]===null)return;
    API.get('/avatar/'+id).then(r=>{const u=r.data&&r.data.avatar;AVATAR_CACHE[id]=u||null;if(u)apply(u);}).catch(()=>{});});}
function daysAgoTxt(d){const n=daysSince(d);if(n==null)return 'noch nie';if(n===0)return 'heute';if(n===1)return 'gestern';return 'vor '+pl(n,'Tag','Tagen');}
function phaseLabel(p){return{offseason:'Offseason',prep:'Prep',maintain:'Maintain'}[p]||'';}
function expLabel(e){return{beginner:'Anfänger',intermediate:'Fortgeschritten',advanced:'Profi'}[e]||'';}
// Relative Zeit für Nachrichten: 'gerade eben' · 'vor 5 Min.' · 'vor 2 Std.' · 'gestern' · 'Mo., 7. Sept.'
function cParseTs(s){if(!s)return null;s=String(s);let d;if(/[TZ]/.test(s)||/[+-]\d\d:\d\d$/.test(s))d=new Date(s);else d=new Date(s.replace(' ','T')+'Z');return isNaN(d.getTime())?null:d;}
function cRelTime(s){const d=cParseTs(s);if(!d)return '';const diff=(Date.now()-d.getTime())/1000;
  if(diff<60)return 'gerade eben';if(diff<3600)return 'vor '+Math.floor(diff/60)+' Min.';if(diff<86400&&d.getDate()===new Date().getDate())return 'vor '+Math.floor(diff/3600)+' Std.';
  const y=new Date();y.setDate(y.getDate()-1);if(d.toDateString()===y.toDateString())return 'gestern';return fmtDate(d,{weekday:'short'});}
// „Zuletzt aktiv“ einer Nutzerzeile: last_active ist ein ISO-Datum (jüngster Satz oder Check-in) oder null.
function adminLastActive(u){const d=u&&u.last_active;if(!d)return 'nie aktiv';
  const t=today();if(d===t)return 'heute';
  const y=new Date();y.setDate(y.getDate()-1);if(d===fmt(y))return 'gestern';
  const diff=Math.round((new Date(t+'T00:00:00')-new Date(d+'T00:00:00'))/86400000);
  return diff>0&&diff<7?'vor '+pl(diff,'Tag','Tagen'):fmtDate(d);}
function cTime(s){const d=cParseTs(s);return d?d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'';}
// Vertrag (P2): coachSheet(title,athlet,html,opts) – Sheet mit Athleten-Chip unter dem Titel (Titel = reines Nomen).
// `athlet` ist entweder {id,name} (bevorzugt) oder nur der Name. Der Namensweg blieb fuer Alt-Aufrufer, zieht das
// Profilbild aber nur bei EINDEUTIGEM Treffer: bei zwei „Max Mueller" zeigte der Chip sonst den falschen Avatar
// und die falsche id (RATE-coach 15).
function coachSheet(title,athlet,html,opts){
  const obj=athlet&&typeof athlet==='object';
  const name=obj?athlet.name:athlet;
  let id=obj?athlet.id:null;
  if(id==null&&name){const hits=(ATHLETES_CACHE||[]).filter(a=>a.name===name);id=hits.length===1?hits[0].id:null;}
  const chip=name?`<div class="coach-chip"><span class="cav"${id?` data-ath-av="${id}"`:''}>${initialOf(name)}</span><span class="nm">${esc2(name)}</span></div>`:'';
  openSheet(title,chip+html,opts);if(id)loadAthAvatars([id]);}
function coachInvalidate(){COACH_OV=null;ADMIN_CACHE=null;if(typeof invalidateView==='function'){try{invalidateView('athletes');invalidateView('admin');}catch(e){}}}

// ===== KOPFZEILE & KONTEXTLEISTE (Verträge mit core.js/WP1) =====
// coachHeaderActions() -> HTML für die .hdr (Rundnachricht, nur Coach ohne Athleten-Kontext). WP1 darf es in
// .hdr .acts einhängen; solange nicht, hängt mountCoachHeader() es selbst vor die Glocke (id #coachHdrActs).
function coachHeaderActions(){if(!ME||ME.role!=='coach'||COACH_CONTEXT||CUR_TAB==='messages')return '';
  return `<button class="btn icon sm ghost" id="hdrBroadcast" aria-label="Nachricht an alle Athleten" title="Nachricht an alle Athleten" onclick="openBroadcast()">${icon('send',20)}</button>`;}
function mountCoachHeader(){let el=document.getElementById('coachHdrActs');
  if(!el){const bell=document.getElementById('bellBtn');if(!bell||!bell.parentNode)return;el=document.createElement('span');el.id='coachHdrActs';el.className='coach-hdr-acts';bell.parentNode.insertBefore(el,bell);}
  el.innerHTML=coachHeaderActions();}
// renderCtxBar() -> HTML der Kontextleiste (core.js/WP1 besitzt mountCtxBar() und hängt das HTML in #ctxBar,
// sobald coachView()). Inhalt: Avatar 28 · 'Du siehst: Name' · Status-Pill · Nachricht (coachQuickMessage) ·
// 'Verlassen' (verlässt den Athleten-Kontext über go('athletes')). Das Profilbild wird nachgeladen, sobald das
// HTML im DOM hängt – deshalb der Tick über setTimeout (kein zweites Mount-Verfahren in coach.js).
function renderCtxBar(){if(!coachView()||!COACH_CONTEXT)return '';const id=VIEW_USER,name=COACH_CONTEXT;
  const a=(ATHLETES_CACHE||[]).find(x=>x.id===id);const st=a?athleteStatus(a):null;
  if(id)setTimeout(()=>loadAthAvatars([id]),0);
  return `<div class="ctx-av" data-ath-av="${id}">${initialOf(name)}</div><div class="ctx-t"><span class="ctx-lbl">Du siehst: </span><b>${esc2(name)}</b></div>${st?attPill(st.status):''}`+
    `<button class="btn icon sm" aria-label="Nachricht an ${esc2(name)}" onclick="coachQuickMessage(${id},'${esc(name)}')">${icon('mail',18)}</button>`+
    `<button class="btn sm sec ctx-leave" aria-label="Athleten-Ansicht verlassen" onclick="coachLeaveAthlete()">${icon('logOut',18)}<span>Verlassen</span></button>`;}
// Zurueck aus dem Athleten-Kontext: der Coach in seine Liste, der Betreiber in die Verwaltung –
// die Athletenliste ist fuer ihn seit 2.6.0 eine Absage, kein Ziel.
function coachLeaveAthlete(){const el=document.getElementById('ctxBar');if(el)el.innerHTML='';
  co2PerfStop();   // A-IV.7: der Beobachter der Planzeile laeuft nur im Athleten-Kontext
  go(ME&&ME.role==='admin'?'admin':'athletes');}

// ===== VERWALTUNG (A-II.3): BETRIEBSANSICHT STATT NUTZERLISTE =====
// Marcos Auftrag fuer diesen Bereich lautet woertlich: „alles Moegliche ueberwachen und einstellen,
// auch Logs – aber NICHT auf personenbezogene Daten zugreifen". Bis 2.5.0 war die Verwaltung das
// Gegenteil: siebzehn Namen, siebzehn E-Mail-Adressen und eine Kachel „Alle Athleten" mit vollem
// Coach-Blick – dafuer kein Protokoll, keine Fehlerliste, kein Job-Zustand (RATE-admin H1/H2).
// Seit 2.6.0 ist sie eine Betriebsansicht: ein Status-Streifen ganz oben, darunter fuenf Reiter
// (Betrieb · Konten · Protokoll · Fehler · Jobs). Konten erscheinen nur als Kuerzel; wer ein
// bestimmtes Konto sucht, tippt die Adresse vollstaendig ein. Blaettern durch alle Adressen gibt es
// nicht mehr.
//
// WICHTIG beim Lesen: die Betriebsrouten (`/api/admin/audit`, `/errors`, `/jobs`, `/admin/lookup`,
// `/admin/grants`) liefert Paket A-II.2, das gleichzeitig entsteht. Solange eine davon fehlt, sagt
// der Reiter das in einem Satz – er behauptet NICHT „keine Ereignisse". Ein leerer Ringpuffer und
// eine fehlende Route sehen sonst gleich aus, und genau dieser Unterschied entscheidet, ob ein
// Betreiber seinem Protokoll glauben darf.
let ADMIN_USERS=[],ADMIN_COACHES=[];
let ADMIN_LOG_TAB='betrieb';          // betrieb | konten | protokoll | fehler | jobs
let ADMIN_LOG={};                     // je Reiter das letzte Ergebnis {ts,r} – nur zum Nachschlagen
let ADMIN_AUDIT_F={days:'7',action:'',actor:''};
let ADMIN_KONTEN_F='all';             // all | admin | coach | athlete | nocoach | quiet
let ADMIN_LOOKUP=null;                // Ergebnis der letzten E-Mail-Suche

// Eine GET-Anfrage gegen mehrere vereinbarte Routennamen (BUILD-A2 Abschnitt 4 nennt teils andere
// Namen als PLAN-25; beide werden probiert). `status:404` nach allen Versuchen heisst „Route fehlt",
// nicht „nichts gefunden" – die Oberflaeche unterscheidet das sichtbar.
async function adGet(paths,q){
  const pairs=Object.entries(q||{}).filter(([,v])=>v!==''&&v!=null&&v!==undefined);
  const qs=pairs.length?('?'+pairs.map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')):'';
  let last=null;
  for(const p of paths){
    const r=await API.get(p+qs);
    if(r.status===404){last=r;continue;}
    return{ok:r.status===200,status:r.status,data:r.data,route:'/api'+p};}
  return{ok:false,status:404,data:(last&&last.data)||null,route:null,tried:paths.map(p=>'/api'+p)};}
// Die Antwortform der neuen Routen steht noch nicht fest. Statt an einem Feldnamen zu zerbrechen,
// wird die Liste GESUCHT: erst die vereinbarten Namen, dann das erste Array im Objekt.
function adRows(d,keys){
  if(Array.isArray(d))return d;
  if(!d||typeof d!=='object')return[];
  for(const k of (keys||[]))if(Array.isArray(d[k]))return d[k];
  for(const k of Object.keys(d))if(Array.isArray(d[k]))return d[k];
  return[];}
// Ein ehrlicher Platzhalter statt einer Null. Er nennt die Routen, die fehlen – damit beim naechsten
// Blick klar ist, ob hier noch etwas zu bauen ist oder ob der Betrieb wirklich still war.
function adMissingHTML(was,r){
  const tried=(r&&r.tried||[]).join(' · ');
  if(r&&r.status&&r.status!==404)return `<div class="note err">${esc2(was)} konnte nicht geladen werden (Status ${r.status}).</div>`;
  // FIX-A5 A5-11: Hier stand „Die Route liefert Paket A-II.2 dieser Welle." – ein interner Paketname
  // in der ausgelieferten Betreiber-Oberflaeche. Gleicher Wortlaut wie opWrite bei 404 (coach.js).
  return `<div class="note warn"><b>${esc2(was)} ist auf diesem Server noch nicht verfügbar.</b><br>
    Dafür braucht der Server ein Update. Bis dahin steht hier nichts – das heißt ausdrücklich
    <b>nicht</b>, dass nichts passiert ist.${tried?`<br><span class="caption">Gesucht unter: ${esc2(tried)}</span>`:''}</div>`;}

// --- Aus einem Nutzer-Datensatz wird eine Zeile ohne Personenbezug ---
// Kuerzel: nach Paket A-II.2 liefert `GET /api/admin/users` ein stabiles `pseudonym` (z. B. A-7F2K).
// Fehlt es, wird hier KEIN Fantasie-Code erfunden, der sich spaeter aendert – dann steht die
// Konto-Nummer da, mit dem Rollenbuchstaben davor. Beides ist personenfrei und stabil, und am Format
// sieht man sofort, welche Quelle gerade antwortet.
function adPseudo(u){
  if(!u)return '–';
  const p=u.pseudonym||u.code;
  if(p)return String(p);
  const pre={admin:'B',coach:'C',athlete:'A'}[u.role]||'K';
  return pre+'-'+String(u.id==null?'?':u.id).padStart(4,'0');}
function adRoleLabel(r){return{admin:'Betreiber',coach:'Coach',athlete:'Athlet'}[r]||String(r||'–');}
// In der Tabelle steht „Admin": „Betreiber" braucht neun Zeichen und wurde in der 46-px-Spalte
// abgeschnitten. Im Fliesstext und in den Sheets bleibt es bei „Betreiber" – dort ist es das
// treffendere Wort fuer die Rolle, die keine Athletendaten mehr sieht.
function adRoleShort(r){return{admin:'Admin',coach:'Coach',athlete:'Athlet'}[r]||String(r||'–');}
// Coach-Kuerzel. Nach A-II.2 kommt es als `coach_pseudonym` mit; vorher wird es in der geladenen Liste
// nachgeschlagen – wieder als Kuerzel, nie als Name.
function adCoachCode(u,all){
  if(!u||u.role!=='athlete')return '–';
  if(u.coach_pseudonym)return String(u.coach_pseudonym);
  if(!u.coach_id)return 'ohne';
  const c=(all||ADMIN_USERS||[]).find(x=>x.id===u.coach_id);
  return c?adPseudo(c):'C-'+String(u.coach_id).padStart(4,'0');}
// Beschriftung einer Zeile im Zuordnungs-Dropdown. B4: `GET /api/admin/coaches` liefert ab 2.6.0 kein
// `name` mehr – der Klarname eines Coachs war die Hintertuer um die pseudonyme Nutzerliste herum. Zum
// Auseinanderhalten reichen Kuerzel, Rolle und die Zahl der betreuten Athleten; das Kuerzel ist dasselbe
// wie in der Kontenliste daneben. Aeltere Serverfassungen ohne `pseudonym` faengt adPseudo ab.
function adCoachOption(c){
  if(!c)return '–';
  const n=Number(c.athlete_count);
  return adPseudo(c)+' · '+adRoleShort(c.role)+(Number.isFinite(n)&&n>0?' · '+n+(n===1?' Athlet':' Athleten'):'');}
// Aktivitaetsklasse statt Datum: „aktiv / ruhig / inaktiv" beschreibt den Betrieb und verraet nicht,
// an welchem Tag jemand trainiert hat. Die Klasse kommt fertig vom Server (`activity`,
// server.js activityClass: <= 7 Tage aktiv, <= 30 Tage ruhig, sonst inaktiv). Der Fallback rechnet
// dieselben Schwellen aus `last_active`, falls eine aeltere Serverfassung antwortet.
function adActivity(u){
  const c=u&&(u.activity||u.activity_class);
  if(c)return{cls:String(c),tone:c==='aktiv'?'live':(c==='ruhig'?'warm':'quiet')};
  const n=daysSince(u&&u.last_active);
  if(n==null)return{cls:'inaktiv',tone:'quiet'};
  if(n<=7)return{cls:'aktiv',tone:'live'};
  if(n<=30)return{cls:'ruhig',tone:'warm'};
  return{cls:'inaktiv',tone:'quiet'};}
// Anlagedatum. `created_at` liefert die Nutzerliste erst nach A-II.2 – vorher ein ehrlicher Strich.
// In der Tabelle kurz (13.09.26), im Konto-Sheet ausgeschrieben – dort ist Platz.
function adCreated(u){const d=u&&(u.created||u.created_at||u.createdAt);if(!d)return '–';return fmtDate(String(d).slice(0,10));}
function adCreatedShort(u){const s=u&&(u.created||u.created_at||u.createdAt);if(!s)return '–';
  const d=cParseTs(String(s).length<=10?String(s)+' 00:00:00':s);if(!d)return '–';
  const p=n=>String(n).padStart(2,'0');
  return p(d.getDate())+'.'+p(d.getMonth()+1)+'.'+String(d.getFullYear()).slice(2);}
// Die Klassenwoerter des Servers sind kurz genug fuer die Spalte; die Funktion bleibt als EINE Stelle
// bestehen, falls eine aeltere Fassung noch „diese Woche" liefert.
function adActShort(c){return{'diese Woche':'aktiv','diesen Monat':'ruhig','älter':'inaktiv','nie':'inaktiv'}[c]||c;}
// Zeitpunkt eines Protokoll-Eintrags. Die Betriebstabellen speichern UTC (`ts_utc`); cParseTs() haengt
// das fehlende „Z" an – sonst laege in Mitteleuropa jede Zeile ein bis zwei Stunden daneben.
// Format „13.09. 12:30" statt „13.09., 12:30": das Komma kostete in der Protokoll-Tabelle die zwei
// Pixel, an denen die Uhrzeit auf einem 390-px-Bildschirm abgeschnitten wurde.
function adTs(s){const d=cParseTs(s);if(!d)return '–';const p=n=>String(n).padStart(2,'0');
  return p(d.getDate())+'.'+p(d.getMonth()+1)+'. '+p(d.getHours())+':'+p(d.getMinutes());}
function adAgo(s){const d=cParseTs(s);if(!d)return null;return Math.floor((Date.now()-d.getTime())/60000);}
function adAgoTxt(s){const m=adAgo(s);if(m==null)return 'nie';
  if(m<2)return 'gerade eben';if(m<60)return 'vor '+m+' Min.';
  if(m<1440)return 'vor '+Math.round(m/60)+' Std.';return 'vor '+pl(Math.round(m/1440),'Tag','Tagen');}

async function renderAdmin(v,opts){opts=opts||{};
  const fresh=ADMIN_CACHE&&(Date.now()-ADMIN_CACHE.ts<CACHE_MS);
  if(fresh)drawAdmin(v,ADMIN_CACHE);
  else if(!opts.cached)v.innerHTML=`<div class="page on" id="adminPage">${skeleton(1,'sm')}${skeleton(3)}</div>`;
  // Fuenf Aufrufe, alle parallel. `GET /api/admin/stats` liefert seit 2.6.0 den halben Betriebszustand
  // gleich mit (`jobs`, `errors24h`, `auditRows`, `supportGrantsActive`, `consentOpen`) – dafuer braucht
  // der Status-Streifen keine eigenen Abfragen mehr. Das Protokoll wird trotzdem einmal gelesen: nur
  // dort steht, wann zuletzt eine Sicherung gezogen wurde (`backup.download`), und die Hilfe-Freigaben
  // lassen sich nur daraus ablesen (es gibt keine Betreiber-Route dafuer, siehe DEFER-A2).
  // FIX-B1 B-I.6-1/5: Seit 3.0.0 sichert der Server jede Nacht selbst (`backup.auto`) und legt jede
  // Kopie in `backups` ab. Die Zeile „Letzte Sicherung" las trotzdem weiter nur die Protokollhandlung
  // `backup.download` – also den KNOPFDRUCK. Ergebnis, gemessen an derselben Datenbank, in der
  // `jobs.backup.auto` auf „up" stand und `backups` gefuellt war: „Es gibt noch keine Ablage dafür ·
  // nicht protokolliert". Die Liste kommt deshalb als siebte Abfrage mit; sie ist die einzige
  // Quelle, die weiss, ob nachts wirklich eine Datei entstanden ist.
  const [ur,cr,st,sf,au,op,bk]=await Promise.all([
    API.get('/admin/users'),API.get('/admin/coaches'),API.get('/admin/stats'),API.get('/selftest'),
    adGet(['/admin/audit'],{limit:200}),adGet(['/admin/ops']),adGet(['/admin/backups'])]);
  if(ur.status!==200){if(document.getElementById('adminPage'))v.innerHTML=`<div class="page on" id="adminPage">${emptyState({icon:'lock',title:'Kein Zugriff',text:'Diese Seite ist nur für Betreiber.'})}</div>`;return;}
  const data={ts:Date.now(),users:ur.data.users||[],counts:ur.data.counts||ur.data.roles||{},coaches:cr.data?.coaches||[],
    stats:st?.data||{},self:sf?.data||null,audit:au,ops:op,backups:bk};
  OPS_STATE=op&&op.ok?op.data:null;
  // uptimeSec steigt bei jedem Aufruf – nur Zustand und Probleme entscheiden ueber ein Neuzeichnen.
  const bkSig=(()=>{const l=adBackupLast(bk),j=adBackupJob(bk);
    return [bk.status,l&&l.id,j&&j.state,j&&j.last_error,(adBackupData(bk)||{}).keepDays];})();
  const sig=JSON.stringify([data.users,data.counts,data.stats,data.self?.ok,data.self?.problems,data.self?.hints,
    au.status,adRows(au.data,['entries']).length,op.status,OPS_STATE&&[OPS_STATE.registration?.effective,OPS_STATE.ai?.mode,OPS_STATE.notice?.text,OPS_STATE.mail?.configured],bkSig]);
  const changed=!ADMIN_CACHE||ADMIN_CACHE.sig!==sig;data.sig=sig;ADMIN_CACHE=data;
  if((changed||!fresh)&&document.getElementById('adminPage'))drawAdmin(v,data);}

// ===== STATUS-STREIFEN: ACHT ZEILEN, JEDE MIT AMPEL UND EINEM SATZ =====
// Der Server RECHNET Mail-, APP_URL- und Schema-Zustand laengst – die Verwaltung hat sie nur nie
// gezeichnet (RATE-admin M1). Der Streifen steht deshalb ganz oben, vor allen Zahlen.
// Jede Zeile ist ein echter <button>: bis 2.5.0 war auf der ganzen Seite genau EIN Element mit der
// Tastatur erreichbar (gemessen mit tools/a11y.mjs --view admin). Und jede Zeile fuehrt zu einem
// Satz, was zu tun ist – eine Ampel ohne Handlung ist nur eine Farbe.
function coachStatusRow(tone,label,value,onclick,sub){
  const inner=`<span class="sdot ${tone}"></span><span class="rl">${esc2(label)}${sub?`<small>${esc2(sub)}</small>`:''}</span><span class="rr">${esc2(value)}</span>`;
  if(!onclick)return `<div class="row ad-srow">${inner}</div>`;
  return `<button type="button" class="row tap ad-row ad-srow" onclick="${onclick}">${inner}</button>`;}
// Letzten Eintrag einer Handlung im gelesenen Protokoll finden. Genau so kommt „Letzte Sicherung"
// zustande: `POST /api/admin/backup` schreibt `backup.download` ins Protokoll, eine eigene Ablage
// dafuer gibt es nicht. Kein Eintrag heisst „nicht protokolliert", nicht „nie gesichert".
function adLastAction(audit,action){
  const rows=adRows(audit&&audit.data,['entries','audit','rows']);
  const hit=rows.find(e=>String(e.action||'')===action);
  return hit?(hit.ts_utc||hit.ts||null):null;}
/* ===== FIX-B1 B-I.6-1/5 · DIE SICHERUNG, WIE SIE SEIT 3.0.0 WIRKLICH LAEUFT =====
   Bis hierher las die Verwaltung an DREI Stellen etwas anderes ueber dasselbe Thema:
     · Streifen: „Letzte Sicherung · nicht protokolliert · Es gibt noch keine Ablage dafür"
     · Jobs:     „Letzte Sicherung · Zustand nicht protokolliert · Kein Lauf, sondern dein Handgriff"
     · Jobs:     „backup.auto – läuft" und „backup.verify – steht" als namenlose Zeilen mit rohem
                  Routennamen und dem Satz „Dieser Lauf ist in der Verwaltung noch nicht beschrieben."
   Gemessen an derselben Datenbank, in der nachts gesichert wurde. Alle drei Zeilen lesen jetzt
   dieselbe Quelle: GET /api/admin/backups (`entries` = die Dateien, `job`/`verify` = die Laeufe).
   Diese vier Helfer sind die EINE Stelle, die diese Antwort auswertet – kein Feldname steht zweimal
   im Code. Fehlt die Route (aeltere Serverfassung), liefern sie `null`, und die Zeile faellt auf den
   alten, ehrlichen Weg zurueck (Protokollhandlung `backup.download`). */
function adBackupData(bk){
  const d=bk&&bk.ok?bk.data:null;
  return (d&&d.available!==false)?d:null;}
// Die juengste Sicherung, die wirklich eine DATEI ist: `kind='probe'` sind Prueflaeufe ohne Datei,
// `ok=0` sind gescheiterte Versuche. Die Liste kommt absteigend, der erste Treffer ist der juengste.
function adBackupLast(bk){
  const d=adBackupData(bk);if(!d)return null;
  const rows=Array.isArray(d.entries)?d.entries:[];
  return rows.find(e=>e&&Number(e.ok)===1&&String(e.kind||'')!=='probe')||null;}
function adBackupJob(bk){const d=adBackupData(bk);return (d&&d.job)||null;}
function adBackupVer(bk){const d=adBackupData(bk);return (d&&d.verify)||null;}
// Byte-Zahlen der Betriebsansicht. Unter einem MB in KB – „0,5 MB" liest sich als „fast nichts",
// 512 KB als das, was es ist.
// Der freie Plattenplatz sind auf einer Wegwerf-Maschine 1,8 Millionen MB – „1.797.727 MB" liest
// niemand als „1,7 TB". Deshalb bis zur passenden Einheit hochzaehlen statt bei MB stehenzubleiben.
function adBytes(n){n=Number(n)||0;
  if(n<1048576)return fmtNum(Math.round(n/1024))+' KB';
  const u=['MB','GB','TB'];let v=n/1048576,i=0;
  while(v>=1024&&i<u.length-1){v/=1024;i++;}
  return fmtNum(v,v<10?1:0)+' '+u[i];}
// Die vier Arten, die der Server schreibt (server.js backupRun/backupVerify/backupReconcile):
// `auto` nachts, `manuell` per Knopf, `probe` die Wiederherstellungsprobe, `gefunden` eine Datei,
// die beim Abgleich im Verzeichnis lag, ohne Zeile dazu. Ein unbekanntes Wort wird NICHT geraten –
// dann steht es da, wie es kam, und man sieht, dass die Verwaltung eine neue Art nicht kennt.
function adBkKind(k){return{auto:'nächtlich',manuell:'von Hand',probe:'Probe',gefunden:'nachgetragen'}[String(k||'')]||String(k||'–');}
function coAdminStatusHTML(st_,self,audit,bk){st_=st_||{};
  const mailOk=st_.mail==='konfiguriert';
  const urlOk=!!st_.app_url&&!/^FEHLT/i.test(String(st_.app_url));
  const selfOk=self?self.ok===true:null;
  const sc=(self&&self.schema)||{};
  const schemaBad=(sc.missingTables||[]).length+(sc.missingColumns||[]).length+(sc.failedSteps||[]).length;
  const rows=[];
  rows.push(coachStatusRow('ok','Version',String(st_.version||APP_VERSION||'–'),"adInfo('version')"));
  rows.push(coachStatusRow(self?(schemaBad?'bad':'ok'):'unknown','Schema',
    self?(schemaBad?pl(schemaBad,'Lücke','Lücken'):'vollständig'):'nicht erreichbar',"adInfo('schema')",
    schemaBad?'Ein Teil der Datenbank fehlt – Selbsttest öffnen':''));
  rows.push(coachStatusRow(mailOk?'ok':'bad','E-Mail-Versand',mailOk?'konfiguriert':'fehlt',"adInfo('mail')",
    mailOk?'':'Bestätigungs- und Reset-Mails gehen nicht raus'));
  rows.push(coachStatusRow(urlOk?'ok':'bad','APP_URL',urlOk?'gesetzt':'fehlt',"adInfo('appurl')",
    urlOk?'':'Links in Mails zeigen ins Leere'));
  // Sicherung, Cron, Fehlerzahl und offene Einwilligungen kommen aus /api/admin/stats bzw. dem Protokoll.
  const jobs=Array.isArray(st_.jobs)?st_.jobs:null;
  // FIX-B1 B-I.6-1/5: Die Zeile las bis hierher `backup.download` – den KNOPFDRUCK, nicht die
  // Sicherung. Seit 3.0.0 laeuft sie nachts von selbst; gefragt wird deshalb die Ablage. Nur wenn es
  // die Route nicht gibt (aeltere Serverfassung), bleibt der alte Weg – dort ist „nicht
  // protokolliert" weiter die ehrliche Auskunft.
  const bkData=adBackupData(bk);
  if(bkData){
    const last=adBackupLast(bk),job=adBackupJob(bk);
    const ts=last?last.created_at:null;
    const hrs=ts?Math.floor((adAgo(ts)||0)/60):null;
    const js=job?String(job.state||''):'';
    const stale=hrs!=null&&hrs>36;
    const tone=!ts?'bad':(js==='down'?'bad':((js==='late'||stale)?'mid':'ok'));
    const sub=!ts
      ? 'Der nächtliche Lauf hat noch keine Datei geschrieben – hier „Jetzt sichern" drücken'
      : (js==='down'?('Der nächtliche Lauf steht: '+String(job.last_error||'Grund im Blatt „Sicherungen"').slice(0,70))
        :((js==='late'||stale)?'Die letzte Nacht hat keine Kopie geschrieben':''));
    rows.push(coachStatusRow(tone,'Letzte Sicherung',ts?adAgoTxt(ts):'noch keine',"adBackupSheet()",sub));
  }else{
    const bkTs=adLastAction(audit,'backup.download')||st_.lastBackup||null;
    const bkDays=bkTs?Math.floor((adAgo(bkTs)||0)/1440):null;
    rows.push(coachStatusRow(bkTs?(bkDays>7?'mid':'ok'):'unknown','Letzte Sicherung',
      bkTs?adAgoTxt(bkTs):'nicht protokolliert',"adInfo('backup')",
      bkTs?(bkDays>7?'Älter als eine Woche – neue Kopie ziehen':''):'Es gibt noch keine Ablage dafür'));}
  const beat=jobs&&jobs.length?jobs.map(j=>j.last_run_utc||j.last_ok_utc).filter(Boolean).sort().slice(-1)[0]:null;
  const down=jobs?jobs.filter(j=>String(j.state||'')==='down').length:0;
  const late=jobs?jobs.filter(j=>String(j.state||'')==='late').length:0;
  rows.push(coachStatusRow(!jobs||!jobs.length?'unknown':(down?'bad':(late?'mid':'ok')),'Letzter Cron',
    !jobs?'nicht protokolliert':(beat?adAgoTxt(beat):'noch kein Lauf'),"adTab('jobs')",
    !jobs||!jobs.length?'Der Zeitgeber hat sich noch nie eingetragen'
      :(down?pl(down,'Lauf steht','Läufe stehen'):(late?pl(late,'Lauf ist','Läufe sind')+' überfällig':''))));
  const eN=st_.errors24h==null?null:Number(st_.errors24h);
  rows.push(coachStatusRow(eN==null?'unknown':(eN===0?'ok':(eN<10?'mid':'bad')),'Fehler (24 h)',
    eN==null?'nicht protokolliert':fmtNum(eN),"adTab('fehler')",
    eN==null?'Es gibt noch keinen Ringpuffer dafür':(eN?'Im Reiter „Fehler" nach Route und Art sortiert':'')));
  // Diese Welle hat die Einwilligung eingefuehrt (Art. 9 DSGVO). Wie viele Athleten sie noch nicht
  // gegeben haben, ist eine reine Zahl – und die einzige, die sagt, ob der Umbau angekommen ist.
  const co=st_.consentOpen==null?null:Number(st_.consentOpen);
  rows.push(coachStatusRow(co==null?'unknown':(co===0?'ok':'mid'),'Einwilligung offen',
    co==null?'unbekannt':fmtNum(co),"adInfo('consent')",
    co?'Diese Konten haben der Verarbeitung ihrer Gesundheitsdaten noch nicht zugestimmt':''));
  const db=(self&&self.db)||{};
  rows.push(coachStatusRow(self?(db.reachable?(db.walMb>64?'mid':'ok'):'bad'):'unknown','Datenbank',
    self?(db.reachable?(db.journalMode||'erreichbar')+(db.walMb!=null?' · WAL '+fmtNum(db.walMb,1)+' MB':''):'nicht erreichbar'):'unbekannt',
    "coOpenSelftest()",db.walMb>64?'Die WAL-Datei wächst – Checkpoint prüfen':''));
  const bad=(!mailOk?1:0)+(!urlOk?1:0)+(selfOk===false?1:0)+(down?1:0);
  const head=bad?`<div class="cs-h bad">${icon('alertTriangle',18)} ${pl(bad,'Punkt','Punkte')} zu prüfen</div>`
    :`<div class="cs-h ok">${icon('check',18)} Betrieb ohne Befund</div>`;
  return `<div class="co-status${bad?' bad':''}">${head}<div class="rows">${rows.join('')}</div></div>`;}
// Was bedeutet die Zeile, und was ist zu tun? Ein Satz je Punkt – ohne Doku-Suche, ohne Fachchinesisch.
const AD_HELP={
  version:['Version','Diese Fassung läuft gerade auf dem Server. Weicht sie von der Fassung ab, die du zuletzt ausgeliefert hast, ist die Auslieferung nicht durchgelaufen.','Nachsehen unter /api/version – dieselbe Zahl, ohne Anmeldung.'],
  schema:['Schema','Der Selbsttest vergleicht die Datenbank mit der Soll-Liste im Code. Eine Lücke heißt: eine Migration ist nicht gelaufen, und Teile der App werfen Fehler.','Server neu starten (die Migrationen laufen beim Start) und danach den Selbsttest öffnen.'],
  mail:['E-Mail-Versand','Ohne SMTP-Zugangsdaten schreibt der Server jede Mail nur ins Log. Bestätigungen, Passwort-Reset und der Wochenrückblick erreichen damit niemanden.','EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS und EMAIL_FROM setzen und neu starten. Danach hier „Testmail an mich" drücken.'],
  appurl:['APP_URL','Jede Mail enthält Links zurück in die App. Ohne APP_URL zeigen sie ins Leere.','APP_URL auf die öffentliche Adresse setzen (z. B. https://be-inevitable.at) und neu starten.'],
  // Diese Hilfe erscheint nur noch auf Serverfassungen OHNE /api/admin/backups. Wo es die Ablage
  // gibt, öffnet die Zeile das Blatt „Sicherungen" – dort steht die Liste statt einer Erklärung.
  backup:['Letzte Sicherung','Dieser Server hat noch keine Ablage für Sicherungen. Gezeigt wird deshalb der Protokolleintrag „Sicherung heruntergeladen" – also dein letzter Knopfdruck, nicht ein Lauf. Eine Sicherung, die niemand je zurückgespielt hat, ist keine Sicherung.','Im Reiter „Betrieb" eine Kopie ziehen, verschlüsselt ablegen – und einmal im Quartal in eine Testdatenbank zurückspielen. Ab Version 3.0.0 sichert der Server nachts selbst.'],
  consent:['Einwilligung offen','So viele Athletenkonten haben der Verarbeitung ihrer Gesundheitsdaten noch nicht zugestimmt. Sie können die App benutzen, aber keine Gesundheitswerte speichern.','Nichts erzwingen: Die App fragt beim nächsten Start selbst. Bleibt die Zahl über Wochen gleich, stimmt etwas mit der Abfrage nicht.'],
  };
function adInfo(k){const e=AD_HELP[k];if(!e)return;
  openSheet(e[0],`<p class="body mb-3">${esc2(e[1])}</p><div class="note status"><b>Was zu tun ist:</b> ${esc2(e[2])}</div>`);}

// Selbsttest als Liste statt als JSON-URL: Probleme rot, Hinweise gelb, sonst ein gruener Haken.
async function coOpenSelftest(){openSheet('Selbsttest','<div class="spinner"></div>');
  const r=await API.get('/selftest');const d=r.data;
  if(!d)return openSheet('Selbsttest',`<div class="note err">Der Selbsttest ist nicht erreichbar (Status ${r.status}).</div>`);
  // Die Tonfarbe gehoert an das Symbol selbst: .r-ic setzt in app.css eine eigene Farbe und wuerde eine
  // Klasse am Wrapper ueberschreiben.
  const li=(items,cls,ic)=>items.map(t=>`<div class="row"><div class="r-ic">${icon(ic,18,cls)}</div><div class="rl">${esc2(t)}</div></div>`).join('');
  const probs=d.problems||[],hints=d.hints||[];
  let h=probs.length?`<div class="note err mb-3">${pl(probs.length,'Problem','Probleme')} – der Server antwortet auf ${'/api/selftest'} mit 503.</div><div class="rows mb-4">${li(probs,'tone-red','alertTriangle')}</div>`
    :`<div class="note ok mb-3">${icon('check',18)} Keine Probleme. Schema, Datenbank und Startschritte sind in Ordnung.</div>`;
  if(hints.length)h+=`<div class="section-label"><span>Hinweise</span></div><div class="rows mb-4">${li(hints,'tone-amber','info')}</div>`;
  const sc=d.schema||{},db=d.db||{};
  h+=`<div class="section-label"><span>Details</span></div><div class="rows mb-4">
    <div class="row"><div class="rl">Version</div><div class="rr">${esc2(String(d.version||'–'))}</div></div>
    <div class="row"><div class="rl">Läuft seit</div><div class="rr">${esc2(coachUptime(d.uptimeSec))}</div></div>
    <div class="row"><div class="rl">Schema</div><div class="rr">${esc2(String(sc.init||'–'))}</div></div>
    <div class="row"><div class="rl">Datenbank</div><div class="rr">${db.reachable?'erreichbar':'nicht erreichbar'}${db.journalMode?' · '+esc2(db.journalMode):''}</div></div>
    ${db.walMb!=null?`<div class="row"><div class="rl">WAL-Datei</div><div class="rr">${fmtNum(db.walMb,1)} MB</div></div>`:''}</div>`;
  openSheet('Selbsttest',h);}
function coachUptime(sec){sec=Number(sec)||0;
  if(sec<3600)return Math.max(1,Math.round(sec/60))+' Min.';
  if(sec<86400)return Math.round(sec/3600)+' Std.';
  return pl(Math.round(sec/86400),'Tag','Tagen');}

// ===== SEITE: STATUS-STREIFEN + FUENF REITER =====
const AD_TABS=[['betrieb','Betrieb'],['konten','Konten'],['protokoll','Protokoll'],['fehler','Fehler'],['jobs','Jobs']];
// Wer role="tablist" vergibt, verspricht auch das Tastaturmuster (WAI-ARIA APG):
// nur EIN Tab-Stopp in der Leiste (roving tabindex), Pfeiltasten wechseln den Reiter,
// Pos1/Ende springen an den Rand, und Tab führt aus der Leiste in den Panel-Inhalt
// (deshalb trägt #adBody tabindex="0"). Bis 2.6.0 waren alle fünf Reiter eigene Tab-Stopps
// und die Pfeiltasten wirkungslos (Prüfbefund p2b-t10).
function adTabsHTML(){return `<div class="seg ad-tabs" role="tablist" aria-label="Bereiche der Verwaltung" onkeydown="adTabKey(event)">`+
  AD_TABS.map(([k,l])=>{const on=ADMIN_LOG_TAB===k;
    return `<button type="button" role="tab" id="adTab-${k}" aria-selected="${on?'true':'false'}" tabindex="${on?'0':'-1'}" aria-controls="adBody" class="${on?'on':''}" onclick="adTab('${k}')">${l}</button>`;}).join('')+`</div>`;}
function adTab(k,focus){if(!AD_TABS.some(t=>t[0]===k))return;ADMIN_LOG_TAB=k;
  document.querySelectorAll('.ad-tabs [role="tab"]').forEach(b=>{const on=b.id==='adTab-'+k;
    b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false');
    b.setAttribute('tabindex',on?'0':'-1');
    if(on&&focus)try{b.focus();}catch(e){}});
  const body=document.getElementById('adBody');if(body)body.setAttribute('aria-labelledby','adTab-'+k);
  adRenderTab();}
// Pfeiltasten in der Reiterleiste. Die Auswahl folgt dem Fokus (APG „automatic activation") –
// adRenderTab verwirft ohnehin jede Antwort, deren Reiter nicht mehr der gewählte ist,
// schnelles Durchpfeilen kostet also nichts.
function adTabKey(e){if(e.altKey||e.ctrlKey||e.metaKey)return;
  const step={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.key];
  const cur=document.activeElement,id=cur&&cur.id||'';
  let i=AD_TABS.findIndex(t=>'adTab-'+t[0]===id);
  if(i<0)i=Math.max(0,AD_TABS.findIndex(t=>t[0]===ADMIN_LOG_TAB));
  let n=null;
  if(step)n=(i+step+AD_TABS.length)%AD_TABS.length;
  else if(e.key==='Home')n=0;
  else if(e.key==='End')n=AD_TABS.length-1;
  else return;
  e.preventDefault();adTab(AD_TABS[n][0],true);}
function drawAdmin(v,data){ADMIN_USERS=data.users||[];ADMIN_COACHES=data.coaches||[];
  v.innerHTML=`<div class="page on${document.getElementById('adminPage')?'':' first'}" id="adminPage">
    ${coAdminStatusHTML(data.stats,data.self,data.audit,data.backups)}
    ${adTabsHTML()}
    <div id="adBody" class="ad-body" role="tabpanel" tabindex="0" aria-labelledby="adTab-${ADMIN_LOG_TAB}"></div></div>`;
  adRenderTab();if(typeof cacheView==='function')cacheView('admin');}
// Der Reiter zeichnet sich selbst. Protokoll, Fehler und Jobs holen ihre Daten erst beim Oeffnen –
// niemand laedt hundert Protokollzeilen, nur weil er die Sicherung braucht.
async function adRenderTab(){const el=document.getElementById('adBody');if(!el)return;
  const k=ADMIN_LOG_TAB,d=ADMIN_CACHE||{};
  if(k==='betrieb'){el.innerHTML=adBetriebHTML(d);return;}
  if(k==='konten'){el.innerHTML=adKontenHTML(d);adGrantsLoad();return;}
  el.innerHTML=skeleton(3);
  let r;
  if(k==='protokoll')r=await adGet(['/admin/audit'],adAuditQuery());
  else if(k==='fehler')r=await adGet(['/admin/errors'],{hours:24,limit:200});
  else r=await adGet(['/admin/jobs']);
  if(ADMIN_LOG_TAB!==k)return;                    // der Betreiber hat inzwischen weitergeklickt
  const el2=document.getElementById('adBody');if(!el2)return;
  ADMIN_LOG[k]={ts:Date.now(),r:r};
  el2.innerHTML=k==='protokoll'?adminAuditHTML(r):(k==='fehler'?adminErrHTML(r):adminJobsHTML(r));}

// ---- Reiter „Betrieb": vier Zahlen mit Zeitraum, danach die Handgriffe ----
// Die Kacheln sind Knoepfe: bis 2.5.0 stand hier „Sätze gesamt 158" ohne Zeitraum und ohne Erklaerung
// (RATE-admin Design/L8). Ein Druck sagt, was die Zahl zaehlt und ueber welchen Zeitraum.
const AD_KPI=[
  ['active7','aktiv (7 Tage)','Konten mit mindestens einem Satz oder Check-in in den letzten sieben Tagen. Das ist die einzige Zahl hier, die einen Zeitraum hat.'],
  ['totalSets','Sätze gesamt','Alle je geloggten Sätze über alle Konten, seit dem ersten Tag. Eine Lebenszeit-Summe – sie sagt etwas über die Größe der Datenbank, nichts über diese Woche.'],
  ['totalCheckins','Check-ins gesamt','Alle je gespeicherten Check-ins, seit dem ersten Tag.'],
  ['totalMessages','Nachrichten gesamt','Alle Nachrichten und Systemmeldungen in der Datenbank. Der Inhalt ist für dich als Betreiber nicht einsehbar – gezählt wird nur.']];
function adKpiInfo(k){const e=AD_KPI.find(x=>x[0]===k);if(!e)return;
  openSheet(e[1],`<p class="body">${esc2(e[2])}</p>`);}
/* ===================== DIE FUENF SCHALTER (Paket A-V.2, 2.9.0) =====================
   Bis 2.8.0 hiess „einstellen" in dieser Verwaltung: eine Umgebungsvariable aendern und neu
   ausliefern. Jetzt stehen fuenf Schalter im Reiter „Betrieb" – dem ersten, den man sieht – und
   jeder wirkt in derselben Sekunde, in der man ihn umlegt.

   Warum hier und nicht in einem sechsten Reiter: „Betrieb" ist die Startansicht der Verwaltung, die
   Schalter sind damit einen Tipp entfernt. Ein sechster Reiter haette die Leiste auf einem 390-px-
   Bildschirm umgebrochen – und das Stylesheet gehoert in dieser Welle einem anderen Paket.

   Zwei Regeln fuer die Bedienung:
   1. **Jede Richtung, die etwas abschaltet, fragt nach** (Registrierung schliessen, KI-Not-Aus).
      Zurueck geht es ohne Rueckfrage – etwas wieder anzuschalten ist nie der gefaehrliche Weg.
   2. **Der Zustand wird nach dem Schreiben neu gelesen**, nicht vom Klick abgeleitet. Die Antwort
      des Servers ist der volle neue Zustand; angezeigt wird ausschliesslich er. */
let OPS_STATE=null;          // letzte Antwort von GET /api/admin/ops (oder null = Route fehlt)
const OPS_REG_LABEL={open:'offen',code:'nur mit Code',closed:'geschlossen'};
const OPS_HELP={
  registration:['Registrierung','Wer darf sich ein Konto anlegen? <b>Offen</b> heißt: jeder mit der Adresse der App. <b>Nur mit Code</b> verlangt zusätzlich den Einladungscode aus der Umgebungsvariablen REGISTER_CODE. <b>Geschlossen</b> weist jede neue Anmeldung ab – auch mit Code.','Der Schalter wirkt sofort, ohne neue Auslieferung. Bestehende Konten sind nie betroffen: Anmelden geht in jedem Zustand.'],
  ai:['KI-Analyse','Der Not-Aus für den ganzen Betrieb. Er ist unabhängig vom Schalter des Athleten („KI-Analyse durch meinen Coach erlauben"): der sagt <i>ob dein Coach darf</i>, dieser hier sagt <i>ob die Anbindung überhaupt läuft</i>.','Abschalten, wenn die Kosten aus dem Ruder laufen, der Anbieter stört oder eine Datenschutzfrage offen ist. Der Schlüssel bleibt gesetzt – nichts geht verloren, es antwortet nur niemand mehr.'],
  notice:['Wartungshinweis','Eine Zeile für alle – zum Beispiel „Wartung heute 22–23 Uhr". Es ist <b>kein</b> Wartungsmodus: niemand wird ausgesperrt, alles bleibt bedienbar.<br><br><b>Stand 2.9.0, ehrlich gesagt:</b> Der Server liefert den Text aus (<code>/api/notice</code> und die Auskunft der Anmeldeseite), und du siehst ihn hier in der Verwaltung. Die <b>Athleten-Ansicht zeigt ihn noch nicht</b> – dafür fehlt eine Zeile in der Hülle, und die gehört einem anderen Paket dieser Welle.','Kurz halten und wieder löschen, sobald es vorbei ist. Ein Hinweis, der wochenlang steht, wird nicht mehr gelesen.'],
  mail:['Mailversand','Ohne SMTP-Zugangsdaten schreibt der Server jede Mail nur ins Log. Der <b>Selbsttest</b> prüft in zwei Sekunden, ob Host, Port und Passwort stimmen – ohne eine Mail zu verschicken. Die <b>Testmail</b> prüft den ganzen Weg bis in dein Postfach.','Erst Selbsttest, dann Testmail: Wenn schon die Verbindung nicht steht, sagt dir die Testmail nichts Neues.'],
  weekly:['Wochen-Job','Sonntags ab 18 Uhr geht der Rückblick raus – als Nachricht in der App und als Mail. Verpasst der Server das Fenster (Neustart, Auslieferung), holt er es bis Montag 22 Uhr selbst nach.','„Jetzt nachholen" schickt den Rückblick der zuletzt abgeschlossenen Woche. Wer ihn schon hat, bekommt keinen zweiten – das ist je Konto gemerkt.']};
function opInfo(k){const e=OPS_HELP[k];if(!e)return;
  openSheet(e[0],`<p class="body mb-3">${e[1]}</p><div class="note status"><b>Was zu tun ist:</b> ${esc2(e[2])}</div>`);}
// Eine Schalterzeile: Titel, Zustand als Ampel, darunter die Wahl. Die Wahl sind echte Knoepfe –
// ein <select> haette auf dem Handy den Zustand hinter einem Systemdialog versteckt.
// Die Wahl steht als `.seg` UNTER der Zeile, nicht daneben: drei Knoepfe neben einem Text passen auf
// 390 px nicht nebeneinander, und `.seg` ist die Komponente, die es im Design-System fuer „genau
// eines von wenigen" schon gibt – samt 44-px-Hoehe und geprueftem Kontrast (app.css:268).
function opRow(key,label,tone,value,sub,choices,current,disabled){
  const seg=(choices||[]).map(([v,l,warn,off])=>`<button type="button"${v===current?' class="on"':''} aria-pressed="${v===current?'true':'false'}"
    ${off?'disabled ':''}onclick="opSet('${key}','${v}',${warn?1:0})">${esc2(l)}</button>`).join('');
  return `<div class="rows mb-2"><div class="row ad-job"><span class="sdot ${tone}"></span>
    <span class="rl">${esc2(label)}<small>${esc2(value)}${sub?' · '+esc2(sub):''}</small></span>
    <button type="button" class="btn icon sm ghost" aria-label="Was bedeutet ${esc2(label)}?" onclick="opInfo('${disabled||''}')">${icon('info',18)}</button></div></div>
    <div class="seg" role="group" aria-label="${esc2(label)}">${seg}</div>`;}
// Umlegen. Die gefaehrliche Richtung fragt nach; danach wird der Zustand NEU GELESEN, nicht geraten.
async function opSet(key,value,warn){
  const texte={'ops.registration|closed':['Registrierung schließen','Ab sofort kann sich niemand mehr selbst ein Konto anlegen – auch nicht mit Einladungscode. Bestehende Konten melden sich weiter normal an.','Schließen'],
    'ops.ai|off':['KI-Analyse abschalten','Der Not-Aus gilt für den ganzen Betrieb: kein Coach kann mehr eine Analyse anfordern, auch nicht für Athleten, die zugestimmt haben.','Abschalten']};
  const t=texte[key+'|'+value];
  if(warn&&t)return confirmSheet(t[0],t[1],{label:t[2],danger:true,onYes:()=>opWrite(key,value)});
  return opWrite(key,value);}
async function opWrite(key,value){
  const r=await API.put('/admin/ops',{key:key,value:value});
  if(r.status===404)return toast('Dafür braucht der Server ein Update.');
  if(r.status!==200)return toast(r.data?.error||'Der Schalter ließ sich nicht umlegen.');
  OPS_STATE=r.data;
  toast(r.data.changed?'Gespeichert – wirkt sofort ✓':'Stand schon so');
  // FIX-A5 A5-1: coachInvalidate() setzt ADMIN_CACHE auf null – bis 2.9.0 wurde eine Zeile spaeter
  // aus genau diesem null neu gezeichnet. Ergebnis nach JEDEM Schalterklick: „– aktiv, – Saetze",
  // „Betreiber: 0 · Coaches: 0" und der Satz, es gebe die Schalter auf diesem Server nicht. Der
  // Stand wird deshalb VOR dem Verwerfen gemerkt; der frisch gelesene Schalterstand (r.data) wird
  // daruebergelegt, damit die Zeile die Wahrheit zeigt und nicht den Stand von vor dem Klick.
  const merged=opInvalidate(r.data);
  const el=document.getElementById('adBody');
  if(el&&ADMIN_LOG_TAB==='betrieb')el.innerHTML=adBetriebHTML(merged);
  opMountBanner();}
// FIX-A5 A5-1: Ein Reiterwechsel Konten -> Betrieb zeichnet ebenfalls aus ADMIN_CACHE (adRenderTab).
// Den Cache nur fuer den einen Aufruf in opWrite zu retten haette die zweite Haelfte des Befunds
// stehen lassen. Deshalb EINE Stelle: den Stand merken, coachInvalidate() wie bisher laufen lassen
// (die Huelle soll ihre Ansichten neu laden) und danach den gemerkten Stand mit dem frisch
// gelesenen Schalterstand zurueckschreiben. `sig:''` sorgt dafuer, dass renderAdmin beim naechsten
// Betreten trotzdem neu zeichnet, sobald die echten Zahlen da sind.
function opInvalidate(opsData){
  const cache=ADMIN_CACHE;
  coachInvalidate();
  if(!cache)return opsData?{ops:{ok:true,status:200,data:opsData}}:{};
  ADMIN_CACHE=Object.assign({},cache,{sig:''},opsData?{ops:{ok:true,status:200,data:opsData}}:{});
  return ADMIN_CACHE;}
// Wartungstext: eigenes Sheet, weil er Text ist und kein Zustand. Leeres Feld = Hinweis weg.
function opNoticeSheet(){
  const n=(OPS_STATE&&OPS_STATE.notice)||{text:'',max:200};
  openSheet('Wartungshinweis',`<form id="opNfForm" onsubmit="opNoticeSave();return false" novalidate>
    <p class="body mb-3">Eine Zeile für alle. <b>Niemand wird ausgesperrt</b> – es ist ein Hinweis, kein Wartungsmodus.</p>
    <div class="field"><label for="op_notice">Text (leer = kein Hinweis)</label>
      <input id="op_notice" type="text" maxlength="${Number(n.max)||200}" autocomplete="off" placeholder="z. B. Wartung heute 22–23 Uhr – deine Einträge gehen nicht verloren." value="${esc(n.text||'')}"></div>
    <div class="note status mb-3">Der Server gibt ihn ab sofort heraus – über <code>/api/notice</code> und über die Auskunft, die die Anmeldeseite lädt. <b>Gezeigt</b> wird er heute nur hier in der Verwaltung; die Athleten-Hülle holt ihn noch nicht ab.</div>
    <button class="btn block" id="op_nf_go" type="submit">Speichern</button>
    ${n.text?`<button type="button" class="btn sec block mt-2" onclick="opSet('ops.notice','',0)">Hinweis entfernen</button>`:''}</form>`);
  setTimeout(()=>document.getElementById('op_notice')?.focus({preventScroll:true}),380);}
async function opNoticeSave(){await opWrite("ops.notice",val("op_notice")||"");closeModal();}
// SMTP-Selbsttest: gruen/rot, ohne eine Mail zu verschicken.
async function opMailCheck(){
  toast('Verbindung wird geprüft …');
  const r=await API.post('/admin/mailcheck',{});
  if(r.status===404)return toast('Dafür braucht der Server ein Update.');
  if(r.status===429)return toast(r.data?.error||'Bitte kurz warten.');
  const d=r.data||{};
  openSheet('SMTP-Selbsttest',d.ok
    ?`<div class="note ok mb-3">${icon('check',18)} Die Verbindung steht${d.ms?` (${fmtNum(d.ms)} ms)`:''}.</div>
      <p class="body">${esc2(String(d.hint||''))}</p>
      <button type="button" class="btn sec block mt-3" onclick="adTestmail()">${icon('mail',18)} Jetzt Testmail schicken</button>`
    :`<div class="note err mb-3"><b>Die Verbindung kam nicht zustande.</b>${d.error?`<br><span class="caption">${esc2(String(d.error).slice(0,160))}</span>`:''}</div>
      <p class="body">${esc2(String(d.hint||'EMAIL_HOST ist nicht gesetzt.'))}</p>`);
  opInvalidate();}   // FIX-A5 A5-1: derselbe Weg wie beim Schalter – der Reiter „Betrieb" bleibt lesbar
// Der Wartungshinweis, wie ihn ein Nutzer sehen wuerde – in der Verwaltung als Vorschau, damit der
// Betreiber ihn nicht nur speichert, sondern auch liest.
function opNoticeBar(){
  const t=OPS_STATE&&OPS_STATE.notice&&OPS_STATE.notice.text;
  if(!t)return '';
  return `<div class="note warn mb-3" id="opNoticeBar"><b>Hinweis läuft:</b> ${esc2(t)}
    <br><span class="caption">Der Server gibt ihn heraus; gezeigt wird er bis auf Weiteres nur hier.</span></div>`;}
function opMountBanner(){const el=document.getElementById('opNoticeBar');if(el)el.outerHTML=opNoticeBar();}
// Der Schalterblock. Fehlt die Route (aelterer Server), sagt er das – und behauptet keinen Zustand.
function opSwitchesHTML(d){
  const r=(d&&d.ops)||null;
  if(!r||!r.ok)return `<div class="section-label"><span>Schalter</span></div>${adMissingHTML('Die Laufzeit-Schalter',r||{status:404})}`;
  const s=OPS_STATE||r.data||{};
  const reg=s.registration||{},ai=s.ai||{},nt=s.notice||{},ml=s.mail||{},wk=s.weekly||{};
  const wann=m=>m&&m.updatedAt?('zuletzt '+adAgoTxt(m.updatedAt)+(m.updatedBy?' von '+m.updatedBy:'')):'noch nie umgelegt';
  let h=`<div class="section-label"><span>Schalter</span></div>`;
  // 1. Registrierung
  h+=opRow('ops.registration','Registrierung',reg.effective==='closed'?'mid':'ok',
    OPS_REG_LABEL[reg.effective]||'–',wann(reg),
    [['open','offen',0,0],['code','nur mit Code',0,!reg.envCode],['closed','geschlossen',1,0]],
    reg.effective,'registration');
  if(reg.codeMissing)h+=`<div class="note warn mb-3">„Nur mit Code" steht eingestellt, aber REGISTER_CODE ist nicht gesetzt – es gilt <b>offen</b>. Setz die Variable oder wähl bewusst einen anderen Zustand.</div>`;
  else if(!reg.envCode)h+=`<div class="note status mb-3">„Nur mit Code" lässt sich erst wählen, wenn REGISTER_CODE als Umgebungsvariable gesetzt ist – sonst wäre es eine Tür ohne Schlüssel.</div>`;
  // 2. KI-Analyse
  h+=opRow('ops.ai','KI-Analyse',ai.mode==='off'?'mid':(ai.configured?'ok':'unknown'),
    ai.mode==='off'?'Not-Aus gelegt':(ai.configured?'läuft':'kein Schlüssel gesetzt'),wann(ai),
    [['on','an',0,0],['off','Not-Aus',1,0]],ai.mode,'ai');
  if(ai.mode!=='off'&&!ai.configured)h+=`<div class="note status mb-3">ANTHROPIC_API_KEY ist nicht gesetzt – der Schalter steht auf „an", es antwortet aber niemand. Das ist kein Fehler, nur kein Anschluss.</div>`;
  // 3. Wartungstext · 4. Mailversand · 5. Wochen-Job – Zeilen mit eigenem Weg statt Segment
  // FIX-A5 A5-12: Diese drei waren `.row.tap`-Zeilen OHNE Info-Knopf – ihre drei Hilfetexte in
  // OPS_HELP (notice/mail/weekly) waren damit unerreichbar, opInfo() wurde nur aus opRow() gerufen.
  // Ein zweiter Knopf darf nicht in einem Knopf stehen (verschachtelte <button> sind ungueltig und
  // im Browser nicht bedienbar), deshalb ist die Zeile jetzt dieselbe Bauform wie bei opRow():
  // `.row.ad-job` mit einem Handlungs-Knopf rechts und dem Info-Knopf daneben. Gleiche Zahl Tipps
  // wie vorher (ein Tipp loest aus), nur das Ziel ist der Knopf statt der ganzen Zeile.
  h+=`<div class="rows mb-4">
    <div class="row ad-job"><span class="sdot ${nt.text?'mid':'ok'}"></span>
      <span class="rl">Wartungshinweis<small>${nt.text?esc2(String(nt.text).slice(0,60)):'kein Hinweis aktiv'} · ${esc2(wann(nt))}</small></span>
      <button type="button" class="btn sm sec" onclick="opNoticeSheet()">Bearbeiten</button>
      <button type="button" class="btn icon sm ghost" aria-label="Was bedeutet Wartungshinweis?" onclick="opInfo('notice')">${icon('info',18)}</button></div>
    <div class="row ad-job"><span class="sdot ${ml.configured?'ok':'bad'}"></span>
      <span class="rl">Mailversand<small>${ml.configured?'SMTP eingerichtet · Port '+fmtNum(ml.port)+(ml.secure?' (SSL)':' (STARTTLS)'):'EMAIL_HOST fehlt – Mails landen nur im Log'}${ml.lastCheck?' · Selbsttest '+(ml.lastCheck.ok?'grün':'rot'):''}</small></span>
      <button type="button" class="btn sm sec" onclick="opMailCheck()">Selbsttest</button>
      <button type="button" class="btn icon sm ghost" aria-label="Was bedeutet Mailversand?" onclick="opInfo('mail')">${icon('info',18)}</button></div>
    <div class="row ad-job"><span class="sdot ${opJobTone(wk.job)}"></span>
      <span class="rl">Wochen-Job<small>${esc2(opJobText(wk))}</small></span>
      <button type="button" class="btn sm sec" onclick="adTab('jobs')">Jobs</button>
      <button type="button" class="btn icon sm ghost" aria-label="Was bedeutet Wochen-Job?" onclick="opInfo('weekly')">${icon('info',18)}</button></div>
  </div>`;
  return h;}
function opJobTone(j){if(!j)return 'unknown';const s=String(j.state||'');return s==='down'?'bad':(s==='late'?'mid':(s==='up'?'ok':'unknown'));}
function opJobText(wk){
  const j=wk&&wk.job;
  if(!j)return 'noch kein Lauf protokolliert · Woche vom '+String(wk&&wk.week||'').slice(0,10);
  const st={up:'läuft',late:'überfällig',down:'steht'}[String(j.state)]||'Zustand unbekannt';
  return st+(j.last_ok_utc?' · zuletzt '+adAgoTxt(j.last_ok_utc):'')+(j.last_error?' · Fehler: '+String(j.last_error).slice(0,60):'');}

// Die Unterzeile der Kachel „Sicherungen" – die Zahl, die man ohne Öffnen wissen will.
// Ohne die Route (ältere Serverfassung) sagt sie das, statt eine Beruhigung zu erfinden.
function adBkTileSub(bk){
  // Nicht gefragt ist nicht dasselbe wie nicht vorhanden: ohne Antwort steht hier, was die Kachel
  // kann, und keine Behauptung über den Server.
  if(!bk)return 'Liste, Aufbewahrung, jetzt sichern, Wiederherstellungsprobe';
  const d=adBackupData(bk);
  if(!d)return 'Dieser Server hat dafür noch keine Ablage';
  const last=adBackupLast(bk),job=adBackupJob(bk);
  if(!last)return 'Noch keine Kopie auf der Platte – nächtlich gegen '+fmtNum(d.hour==null?3:d.hour)+' Uhr';
  const js=job?String(job.state||''):'';
  const pre=js==='down'?'Der nächtliche Lauf steht · ':(js==='late'?'Überfällig · ':'');
  return pre+'Jüngste '+adAgoTxt(last.created_at)+' · '+fmtNum(d.filesOnDisk||0)+' auf der Platte · '+pl(Number(d.keepDays)||14,'Tag','Tage')+' Aufbewahrung';}
function adBetriebHTML(d){const st_=d.stats||{},c=d.counts||{};
  const tiles=AD_KPI.map(([k,l])=>`<button type="button" class="tile ad-kpi" onclick="adKpiInfo('${k}')">
    <span class="v">${st_[k]!=null?fmtNum(st_[k]):'–'}</span><span class="l">${esc2(l)} ${icon('info',13)}</span></button>`).join('');
  const mailOk=st_.mail==='konfiguriert';
  // Die Schalter stehen GANZ OBEN, vor den Zahlen: sie sind das, was man hier tut. Die Zahlen sind
  // das, was man hier liest – und lesen kann man auch, nachdem man gehandelt hat.
  return `${opNoticeBar()}${opSwitchesHTML(d)}
  <div class="grid-2 ad-kpis mb-4">${tiles}</div>
  <div class="ad-counts mb-4">${adRoleLabel('admin')}: <b>${fmtNum(c.admin||0)}</b> · Coaches: <b>${fmtNum(c.coach||0)}</b> · Athleten: <b>${fmtNum(c.athlete||0)}</b> — Kürzel und Rollen stehen im Reiter „Konten".</div>
  <div class="section-label"><span>Sicherung</span></div>
  <div class="rows mb-4">
    <button type="button" class="row tap ad-row" onclick="adBackupSheet()"><span class="r-ic">${icon('shield')}</span><span class="rl">Sicherungen<small>${esc2(adBkTileSub(d.backups))}</small></span></button>
    <button type="button" class="row tap ad-row" onclick="openBackupSheet()"><span class="r-ic">${icon('download')}</span><span class="rl">Kopie herunterladen<small>Auf deine eigene Maschine – vollständig, mit Passwort</small></span></button>
    <button type="button" class="row tap ad-row" onclick="coOpenSelftest()"><span class="r-ic">${icon('shield')}</span><span class="rl">Selbsttest<small>Schema, Datenbank und Startschritte prüfen</small></span></button>
  </div>
  <div class="section-label"><span>Mailversand</span></div>
  <div class="rows mb-3">
    <button type="button" class="row tap ad-row" onclick="adTestmail()"><span class="r-ic">${icon('mail')}</span><span class="rl">Testmail an mich<small>${mailOk?'Prüft den echten Versandweg bis ins Postfach':'Landet ohne SMTP nur im Server-Log'}</small></span></button>
  </div>
  <div class="note status mb-4">Selbsttest, Sicherung und Testmail gab es bisher nur als Aufruf im Terminal (RATE-admin M2). Die wiederkehrenden Läufe und ihre Knöpfe stehen im Reiter „Jobs"; was du auslöst, steht danach im Reiter „Protokoll".</div>`;}

// ---- Reiter „Konten": Kuerzel statt Adressliste ----
const AD_KFILTERS=[['all','Alle'],['admin','Betreiber'],['coach','Coaches'],['athlete','Athleten'],['nocoach','ohne Coach'],['quiet','länger still']];
function adKontenMatch(u){const f=ADMIN_KONTEN_F;
  if(f==='all')return true;
  if(f==='nocoach')return u.role==='athlete'&&!u.coach_id&&!u.coach_pseudonym;
  if(f==='quiet'){const a=adActivity(u);return a.cls==='inaktiv'||a.cls==='älter'||a.cls==='nie';}
  return u.role===f;}
function adKontenFilter(f){ADMIN_KONTEN_F=f;
  document.querySelectorAll('.ad-kf .chip').forEach(b=>{const on=b.dataset.f===f;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
  const el=document.getElementById('adUserTbl');if(el)el.innerHTML=adUserTblHTML();}
function adUserTblHTML(){
  const list=(ADMIN_USERS||[]).filter(adKontenMatch)
    .slice().sort((a,b)=>String(adPseudo(a)).localeCompare(String(adPseudo(b)),'de',{numeric:true}));
  if(!list.length)return `<div class="note status">Kein Konto in dieser Auswahl.</div>`;
  const head=`<div class="ad-thead" aria-hidden="true"><span>Kürzel</span><span>Rolle</span><span>Coach</span><span>Aktiv</span><span>Seit</span></div>`;
  const rows=list.map(u=>{const a=adActivity(u),p=adPseudo(u),cc=adCoachCode(u);
    return `<button type="button" class="ad-urow" onclick="adminEditUser(${u.id})"
      aria-label="Konto ${esc(p)}, ${esc(adRoleLabel(u.role))}, Coach ${esc(cc)}, aktiv ${esc(a.cls)}, angelegt ${esc(adCreated(u))}">
      <span class="c1">${esc2(p)}${u.id===(ME&&ME.id)?' <span class="pill neutral">du</span>':''}</span>
      <span class="c2">${esc2(adRoleShort(u.role))}</span>
      <span class="c3">${esc2(cc)}</span>
      <span class="c4 t-${a.tone}">${esc2(adActShort(a.cls))}</span>
      <span class="c5">${esc2(adCreatedShort(u))}</span></button>`;}).join('');
  return head+`<div class="ad-tbody">${rows}</div>`;}
function adKontenHTML(d){
  const anyCreated=(ADMIN_USERS||[]).some(u=>u.created||u.created_at||u.createdAt);   // FIX-A5 A5-10: `created` fehlte – der Server schickt genau dieses Feld, die Spalte SEIT zeigte Daten und die Fussnote behauptete daneben, es gebe keine
  const anyPseudo=(ADMIN_USERS||[]).some(u=>u.pseudonym||u.code);
  return `<div class="note status mb-3"><b>Diese Liste zeigt keine Namen und keine E-Mail-Adressen.</b>
      Ein Konto findest du, indem du die Adresse vollständig eintippst – nicht, indem du alle durchsiehst.
      Jede Suche wird protokolliert.</div>
    <form id="adFindBox" class="ad-find mb-3" onsubmit="adminLookup();return false" novalidate>
      <div class="field"><label for="ad_mail">E-Mail exakt eingeben</label>
        <input id="ad_mail" type="email" inputmode="email" autocomplete="off" spellcheck="false" placeholder="name@mail.com" enterkeyhint="search"></div>
      <button type="submit" class="btn sec" id="ad_find_go">${icon('search',18)} Konto finden</button></form>
    <div id="adFindOut" aria-live="polite">${ADMIN_LOOKUP?adLookupOutHTML(ADMIN_LOOKUP):''}</div>
    <div class="section-label"><span>Konten</span><span class="sl-r">${fmtNum((ADMIN_USERS||[]).length)}</span></div>
    <div class="chip-row wrap ad-kf mb-2">${AD_KFILTERS.map(([k,l])=>`<button type="button" class="chip${ADMIN_KONTEN_F===k?' on':''}" data-f="${k}" aria-pressed="${ADMIN_KONTEN_F===k?'true':'false'}" onclick="adKontenFilter('${k}')">${l}</button>`).join('')}</div>
    <div class="ad-tbl" id="adUserTbl">${adUserTblHTML()}</div>
    <p class="caption ad-foot"><b>Aktiv</b> heißt: letzter eigener Eintrag in den letzten 7 Tagen · <b>ruhig</b> in den letzten 30 · <b>inaktiv</b> länger oder nie. <b>Seit</b> ist das Anlagedatum.</p>
    ${anyPseudo?'':`<p class="caption ad-foot">Die Kürzel sind hier aus der Konto-Nummer gebildet (S/C/A + Nummer). Stabile Pseudonyme wie <b>A-7F2K</b> liefert der Server nach einem Update.</p>`}
    ${anyCreated?'':`<p class="caption ad-foot">Das Anlagedatum liefert <code>GET /api/admin/users</code> noch nicht – deshalb der Strich.</p>`}
    <div class="ad-acts mt-3">
      <button type="button" class="btn sec" onclick="adminNewUser()">${icon('plus',18)} Nutzer anlegen</button>
      <button type="button" class="btn sec" onclick="adminInvites()">${icon('link',18)} Einladungen</button></div>
    <div class="section-label"><span>Hilfe-Freigaben</span></div>
    <div id="adGrantsBody">${skeleton(2)}</div>`;}
// Exakte Suche. PLAN-25 nennt `GET /api/admin/lookup?email=`, BUILD-A2 `GET /api/admin/users?email=` –
// beide werden probiert. Heikel ist der dritte Fall: der heutige Server KENNT den Parameter nicht und
// antwortet mit der vollstaendigen Liste. Das darf niemals als Treffer durchgehen.
async function adminLookup(){
  const mail=String(val('ad_mail')||'').trim();
  const out=document.getElementById('adFindOut');
  if(!mail)return showFieldErr('adFindBox','Bitte die vollständige Adresse eintippen.','ad_mail');
  if(out)out.innerHTML=`<div class="note status">Wird gesucht …</div>`;
  const r=await adGet(['/admin/lookup','/admin/users'],{email:mail});
  let res;
  if(!r.ok)res={kind:'route',r:r};
  // `found` ist die verbindliche Auskunft des Servers. Der Treffer selbst steht in `users[0]` bzw.
  // `user` – NICHT im Umschlag: ein `res.data` als Konto zu lesen ergab eine Zeile ohne Rolle.
  else if(r.data&&typeof r.data.found==='boolean'){
    const hit=r.data.user||adRows(r.data,['users','rows'])[0]||null;
    res=(r.data.found&&hit)?{kind:'hit',u:hit}:{kind:'miss'};}
  else{const rows=adRows(r.data,['users','rows']);
    if(rows.length===1)res={kind:'hit',u:rows[0]};
    else if(rows.length===0)res={kind:'miss'};
    else res={kind:'unfiltered',n:rows.length};}
  ADMIN_LOOKUP=res;
  const el=document.getElementById('adFindOut');if(el)el.innerHTML=adLookupOutHTML(res);}
function adLookupOutHTML(res){
  if(!res)return '';
  if(res.kind==='hit'){const u=res.u,p=adPseudo(u);
    return `<div class="note ok mb-3">Gefunden: <b>${esc2(p)}</b> · ${esc2(adRoleLabel(u.role))} · zuletzt aktiv: ${esc2(adActivity(u).cls)}
      <br><button type="button" class="btn sm sec mt-2" onclick="adminEditUser(${Number(u.id)||0})">Konto öffnen</button></div>`;}
  if(res.kind==='miss')return `<div class="note status mb-3">Kein Konto mit dieser Adresse. Achte auf Tippfehler – gesucht wird exakt, nicht nach Teilen.</div>`;
  if(res.kind==='unfiltered')return `<div class="note warn mb-3"><b>Dieser Server filtert noch nicht nach Adresse.</b>
    Er hat auf die Suche ${fmtNum(res.n)} Konten zurückgegeben statt eines. Dafür braucht der Server ein Update;
    bis dahin wird hier bewusst kein Treffer angezeigt.</div>`;
  return adMissingHTML('Die Konto-Suche',res.r);}

// ---- Hilfe-Freigaben: sehen, benutzen, Ablauf kennen ----
// Der Betreiber kommt an personenbezogene Ansichten NUR, wenn der Athlet ihm die Tuer aufmacht –
// zeitlich begrenzt und protokolliert (BUILD-A2 Abschnitt 4 Nr. 4). Diese Liste ist die einzige
// Stelle in der Verwaltung, an der ueberhaupt ein Weg zu einem einzelnen Menschen fuehrt.
function adGrantLeft(g){const e=cParseTs(g&&(g.expires_at||g.expires));if(!e)return null;
  return Math.round((e.getTime()-Date.now())/60000);}
// Eine Zeile je Freigabe: Kuerzel, Grund, Ablauf, Restzeit – und „Benutzen" nur, solange sie laeuft.
function adminGrantRow(g){
  // Feldnamen der Route `GET /api/admin/support-grants`: `user` ist das Pseudonym, `reasonText` der
  // ausgeschriebene Grund, `active` die Auskunft des Servers. Die uebrigen Namen sind der Rueckweg
  // fuer die Ableitung aus dem Protokoll.
  const code=g.user||g.pseudonym||g.user_pseudonym||g.target||('A-'+String(g.user_id==null?'?':g.user_id));
  const left=adGrantLeft(g);
  const scope=g.reasonText||g.reasonLabel||g.scope||g.reason||'kein Grund angegeben';
  const dead=typeof g.active==='boolean'?!g.active:(!!g.revoked_at||(left!=null&&left<=0));
  const until=cParseTs(g.expires_at||g.expires);
  const untilTxt=until?until.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+' Uhr':'–';
  const zustand=dead?(g.revoked_at?'widerrufen':'abgelaufen')
    :'läuft bis '+untilTxt+(left!=null?' · noch '+pl(left,'Minute','Minuten'):'');
  return `<div class="row ad-grant${dead?' off':''}">
    <span class="sdot ${dead?'unknown':'ok'}"></span>
    <span class="rl">${esc2(code)}<small>${esc2(scope)} · ${esc2(zustand)}${g.used?' · schon benutzt':''}</small></span>
    ${dead||!g.user_id?'':`<button type="button" class="btn sm sec" onclick="adUseGrant(${Number(g.user_id)||0},'${esc(code)}')">Benutzen</button>`}</div>`;}
// Rueckweg, falls `GET /api/admin/support-grants` einmal fehlt: die Freigaben lassen sich auch AUS DEM
// PROTOKOLL ablesen – `support.grant` erteilt, `support.revoke` widerruft, `support.use` benutzt,
// jeweils mit Kuerzel, Nutzer-Nummer und Zeitpunkt; die Laufzeit sind 30 Minuten
// (server.js SUPPORT_GRANT_MINUTES). Das ist eine ABLEITUNG, keine Quelle – die Fusszeile sagt das
// auch, damit niemand einen abgeleiteten Ablauf fuer eine Zusage des Servers haelt.
const AD_GRANT_MIN=30;
function adGrantsFromAudit(audit){
  const rows=adRows(audit&&audit.data,['entries','audit','rows']);
  const byUser=new Map();
  // Das Protokoll kommt neu-zuerst: der erste Treffer je Konto ist der juengste.
  rows.forEach(e=>{
    const a=String(e.action||'');
    if(a!=='support.grant'&&a!=='support.revoke'&&a!=='support.use')return;
    const uid=e.target_id!=null?Number(e.target_id):(e.actor_id!=null?Number(e.actor_id):null);
    if(!uid)return;
    const cur=byUser.get(uid)||{user_id:uid,pseudonym:e.target||e.actor||null,granted_at:null,revoked_at:null,used:false,reason:null};
    if(!cur.pseudonym)cur.pseudonym=e.target||e.actor||null;
    const ts=e.ts_utc||e.ts||null;
    if(a==='support.grant'&&!cur.granted_at){cur.granted_at=ts;
      try{const m=typeof e.meta_json==='string'?JSON.parse(e.meta_json):e.meta_json;
        if(m&&m.reason)cur.reason=String(m.reason);}catch(err){}}
    if(a==='support.revoke'&&!cur.revoked_at)cur.revoked_at=ts;
    if(a==='support.use')cur.used=true;
    byUser.set(uid,cur);});
  return [...byUser.values()].filter(g=>g.granted_at).map(g=>{
    const t=cParseTs(g.granted_at);
    return Object.assign(g,{
      expires_at:t?new Date(t.getTime()+AD_GRANT_MIN*60000).toISOString():null,
      reasonLabel:AD_GRANT_REASONS[g.reason]||g.reason||'kein Grund angegeben'});})
    .sort((a,b)=>String(b.granted_at).localeCompare(String(a.granted_at)));}
// Dieselbe Auswahl wie server.js SUPPORT_REASONS – Gruende sind eine feste Liste, kein Freitext.
// (Jeder Schluessel steht in einer eigenen Zeile: dup_check.py liest eine einzeilige Objektliteral-
//  Zuweisung am Zeilenanfang sonst als Liste deklarierter Namen und meldet `data` als Dublette.)
const AD_GRANT_REASONS={
  bug:'Fehler in der App',
  data:'Daten stimmen nicht',
  login:'Anmeldung/Konto',
  other:'Anderes'};
async function adGrantsLoad(){const el=document.getElementById('adGrantsBody');if(!el)return;
  const n=Number((ADMIN_CACHE&&ADMIN_CACHE.stats&&ADMIN_CACHE.stats.supportGrantsActive));
  const nTxt=Number.isFinite(n)?n:null;
  // `GET /api/admin/support-grants` ist die Quelle (Paket A-II.2). `/admin/grants` steht davor, falls
  // die Route je umbenannt wird; schlagen beide fehl, wird aus dem Protokoll abgelesen.
  const r=await adGet(['/admin/support-grants','/admin/grants']);
  const el2=document.getElementById('adGrantsBody');if(!el2)return;
  let rows,quelle;
  if(r.ok&&r.data&&r.data.available!==false){rows=adRows(r.data,['grants','rows']);quelle='route';}
  else{rows=adGrantsFromAudit(ADMIN_CACHE&&ADMIN_CACHE.audit);quelle='audit';}
  const live=rows.filter(g=>typeof g.active==='boolean'?g.active:(!g.revoked_at&&(adGrantLeft(g)==null||adGrantLeft(g)>0)));
  const kopf=nTxt==null?'':`<div class="note status mb-2">${nTxt===0?'<b>Zurzeit ist keine Hilfe-Freigabe aktiv.</b>':`<b>${pl(nTxt,'Hilfe-Freigabe ist','Hilfe-Freigaben sind')} aktiv.</b>`} Ohne Freigabe siehst du keine Trainings-, Gesundheits- oder Nachrichtendaten – so ist es gedacht.</div>`;
  const fuss=quelle==='audit'
    ? `<p class="caption ad-foot">Diese Zeilen sind aus dem Protokoll abgelesen (erteilt · benutzt · widerrufen), die Laufzeit sind ${AD_GRANT_MIN} Minuten ab der Erteilung – nicht vom Server bestätigt.</p>`
    : `<p class="caption ad-foot">Jede Nutzung schreibt eine Zeile ins Protokoll, und der Athlet bekommt eine Nachricht darüber.</p>`;
  if(!rows.length)return void(el2.innerHTML=kopf+`<div class="note status">Im Protokoll steht keine erteilte Freigabe. Der Athlet gibt sie in seinem Konto unter „Wer sieht was" – du kannst sie nicht anfordern.</div>`+fuss);
  el2.innerHTML=kopf+`<div class="rows mb-2">${rows.map(adminGrantRow).join('')}</div>`
    +(live.length?'':`<div class="note status mb-2">Keine dieser Freigaben läuft noch.</div>`)+fuss;}
function adUseGrant(uid,code){
  if(!uid)return;
  openSheet('Freigabe benutzen',`<p class="body mb-3">Du öffnest gleich die App-Ansicht von <b>${esc2(code)}</b> – Start, Training, Ernährung und Analyse, so wie dieser Mensch sie selbst sieht.</p>
    <div class="note status mb-3"><b>Der Zugriff wird protokolliert</b>, und ${esc2(code)} bekommt eine Nachricht darüber. Lesen ja, ändern nein – Einträge macht jeder für sich selbst.</div>
    <p class="caption mb-4">Die Coach-Übersicht bleibt auch jetzt geschlossen: sie gehört zum Coaching, nicht zum Betrieb. Mit „Verlassen" kommst du zurück in die Verwaltung.</p>
    <button type="button" class="btn sec block" onclick="closeModal();coachOpenView(${Number(uid)||0},'${esc(code)}','home')">Ansicht öffnen</button>
    <button type="button" class="btn block ghost mt-2" onclick="closeModal()">Abbrechen</button>`);}
// Einladungen (PLAN A-II.3 Nr. 6 / A20 Stufe 1). Die Routen entstehen in A-II.2; bis dahin sagt das
// Sheet ehrlich, dass es sie noch nicht gibt – und nennt den heutigen Weg.
async function adminInvites(){
  openSheet('Einladungen','<div class="spinner"></div>');
  const r=await adGet(['/invites','/admin/invites']);
  if(!r.ok)return openSheet('Einladungen',`${adMissingHTML('Die Einladungsliste',r)}
    <p class="body mt-3">Den Einladungslink selbst gibt es trotzdem: Er entsteht bei „Nutzer anlegen", wenn du das Passwortfeld leer lässt,
      und wird dir genau einmal zum Kopieren gezeigt (einmalig gültig, 72 Stunden, die Person setzt ihr Passwort selbst).
      Nur diese Übersicht über alle Einladungen fehlt hier gerade.</p>`);
  const rows=adRows(r.data,['invites','rows']);
  const st=i=>i.used_at?'eingelöst':(cParseTs(i.expires_at)&&cParseTs(i.expires_at).getTime()<Date.now()?'abgelaufen':'offen');
  openSheet('Einladungen',(rows.length?`<div class="rows mb-3">${rows.map(i=>`<div class="row"><span class="rl">${esc2(adRoleLabel(i.role))}<small>${esc2(st(i))} · bis ${esc2(adTs(i.expires_at))}</small></span>${i.link?`<button type="button" class="btn sm sec" onclick="adCopy('${esc(i.link)}')">Link kopieren</button>`:''}</div>`).join('')}</div>`
    :`<div class="note status mb-3">Noch keine Einladung erstellt.</div>`));}
function adCopy(t){try{navigator.clipboard.writeText(t);toast('Kopiert ✓');}catch(e){toast('Kopieren nicht möglich');}}

// ---- EINLADUNGSLINK ANZEIGEN (BUILD-A2 §4 Punkt 11) ----
// Der Server antwortet auf eine Kontoanlage ohne Passwort und auf „Zugang wiederherstellen" mit
// `{invite:{url,expiresInHours,mailed,mailNote}}` (src/server.js makeInvite). `url` fehlt bewusst,
// wenn der Link per Mail ging – dann DARF der Betreiber ihn nicht sehen. Diese Karte ist die einzige
// Gelegenheit, ihn zu kopieren: er steht in keiner Liste und lässt sich nicht noch einmal abrufen.
// Sie ersetzt den alten Weg „Startpasswort ausdenken und per WhatsApp durchgeben".
function coInviteSheet(title,d,name){
  const inv=d&&d.invite;
  if(!inv){ // Konto steht, nur der Link fehlt – das ist eine Aussage, kein stiller Erfolg
    const err=d&&d.inviteError;
    return openSheet(title,`<div class="note ok mb-3">${esc2(name?name+' ist angelegt.':'Das Konto ist angelegt.')}</div>
      ${err?`<div class="err">${esc2(err)}</div><p class="body muted mb-3">Setz den Zugang über „Zugang wiederherstellen" im Konto-Sheet neu auf.</p>`:''}
      <button type="button" class="btn block" onclick="closeAllSheets()">Fertig</button>`);}
  const std=Number(inv.expiresInHours)||72;
  const url=String(inv.url||'');
  openSheet(title,`<div class="note ok mb-3">${esc2(name?name+' ist angelegt – ohne Passwort.':'Das Konto ist angelegt – ohne Passwort.')} Über diesen Link setzt die Person ihr eigenes Passwort.</div>
    ${url?`<div class="field"><label for="co_inv_url">Einladungslink</label><input id="co_inv_url" readonly value="${esc2(url)}" onclick="this.select()"></div>
      <button type="button" class="btn block" onclick="coInviteCopy()">${icon('copy',18)} Link kopieren</button>
      <p class="caption mt-2 mb-3">Gültig ${fmtNum(std)} Stunden, einmal verwendbar. <b>Jetzt kopieren</b> – danach ist er nicht mehr abrufbar. Du erfährst das Passwort nie.</p>`:''}
    <div class="note status mb-3">${esc2(String(inv.mailNote||(inv.mailed?'Der Link ist per E-Mail unterwegs.':'Gib den Link selbst weiter.')))}</div>
    <button type="button" class="btn block${url?' sec':''}" onclick="closeAllSheets()">Fertig</button>`);}
function coInviteCopy(){const el=document.getElementById('co_inv_url');if(!el)return;
  try{el.select();}catch(e){}
  adCopy(el.value);}

// ---- Reiter „Protokoll": die audit-Tabelle mit Filter, Pseudonyme statt Namen ----
// Die Kennungen stammen woertlich aus server.js (Paket A-II.2). Eine unbekannte Kennung wird roh
// angezeigt statt verschluckt – ein neues Ereignis darf nie unsichtbar bleiben, nur weil diese
// Tabelle es noch nicht kennt.
const AD_ACTIONS={'admin.search':'Adresse gesucht','user.create':'Konto angelegt','athlete.create':'Athlet angelegt',
  'user.delete':'Konto gelöscht','role.change':'Rolle geändert','coach.assign':'Coach zugeordnet',
  'password.reset':'Passwort zurückgesetzt','password.reset.link':'Zugangs-Link erzeugt',
  'backup.download':'Sicherung heruntergeladen','mail.test':'Testmail ausgelöst','mail.check':'SMTP-Selbsttest',
  'ops.set':'Schalter umgelegt','athlete.profile.set':'Athletenprofil gesetzt',
  'job.weekly.run':'Wochen-Rückblick von Hand','job.freezes.run':'Reparatur von Hand','cron.tick':'Zeitgeber gelaufen',
  'retention.prune':'Aufräumen gelaufen','support.grant':'Hilfe-Freigabe erteilt','support.use':'Hilfe-Freigabe benutzt',
  'support.revoke':'Hilfe-Freigabe widerrufen','support.denied':'Schreibversuch über Freigabe abgewiesen',
  'consent.grant':'Einwilligung erteilt','consent.revoke':'Einwilligung widerrufen',
  'ai.consent.on':'KI-Analyse erlaubt','ai.consent.off':'KI-Analyse widerrufen','ai.summary':'KI-Analyse erstellt',
  'invite.accept':'Einladung eingelöst','entity.too.large':'Anfrage zu groß','entity.parse.failed':'Anfrage unlesbar'};
function adActionLabel(a){return AD_ACTIONS[a]||String(a||'–');}
function adAuditQuery(){const f=ADMIN_AUDIT_F;
  const q={limit:100};
  if(f.days&&f.days!=='all')q.days=f.days;
  if(f.action)q.action=f.action;
  if(f.actor)q.actor=f.actor;
  return q;}
function adAuditApply(){ADMIN_AUDIT_F={days:val('ad_f_days')||'7',action:val('ad_f_action')||'',actor:String(val('ad_f_actor')||'').trim()};
  adRenderTab();}
function adAuditFilterHTML(rows){
  const seen=[...new Set((rows||[]).map(r=>r.action).filter(Boolean))];
  const keys=[...new Set(Object.keys(AD_ACTIONS).concat(seen))].sort();
  const f=ADMIN_AUDIT_F;
  return `<form class="ad-filters mb-3" id="adAuditF" onsubmit="adAuditApply();return false">
    <div class="field"><label for="ad_f_days">Zeitraum</label><select id="ad_f_days">
      ${[['1','letzte 24 Stunden'],['7','letzte 7 Tage'],['30','letzte 30 Tage'],['365','letztes Jahr'],['all','alles']].map(([k,l])=>`<option value="${k}"${f.days===k?' selected':''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label for="ad_f_action">Handlung</label><select id="ad_f_action">
      <option value="">alle Handlungen</option>${keys.map(k=>`<option value="${esc(k)}"${f.action===k?' selected':''}>${esc2(adActionLabel(k))}</option>`).join('')}</select></div>
    <div class="field"><label for="ad_f_actor">Akteur (Kürzel)</label><input id="ad_f_actor" type="text" autocomplete="off" spellcheck="false" placeholder="z. B. S-0003" value="${esc(f.actor||'')}"></div>
    <button type="submit" class="btn sec">${icon('filter',18)} Anwenden</button></form>`;}
// Ein Zugriff ueber eine Hilfe-Freigabe erzeugt eine audit-Zeile JE ROUTE: ein einziger Blick auf die
// Startseite schrieb im Versuch zwoelf Mal „Hilfe-Freigabe benutzt" (gemessen, /home/:id, /today/:id,
// /plan/:id, /avatar/:id, /dashboard/:id …). Als Liste ist das unlesbar, und was unlesbar ist, liest
// niemand – ein Protokoll, das niemand liest, ist keines.
// Deshalb werden unmittelbar aufeinanderfolgende Zeilen mit GLEICHER Handlung, gleichem Akteur und
// gleichem Ziel innerhalb von fuenf Minuten zu einer Zeile mit „12×" gebuendelt. Verschwiegen wird
// dabei nichts: die Zahl steht daneben, und das Detail-Sheet zaehlt jede einzelne Route auf.
const AD_AUDIT_BUNDLE_MS=5*60000;
function adAuditGroups(rows){
  const out=[];
  (rows||[]).forEach(e=>{
    const key=[e.action,e.actor||e.actor_id,e.target||e.target_id].join('|');
    const t=cParseTs(e.ts_utc||e.ts);
    const last=out[out.length-1];
    if(last&&last.key===key&&last.t&&t&&(last.t.getTime()-t.getTime())<=AD_AUDIT_BUNDLE_MS){
      last.n++;last.items.push(e);last.tLast=t;return;}
    out.push({key:key,n:1,items:[e],e:e,t:t,tLast:t});});
  return out;}
function adminAuditHTML(r){
  if(r&&r.ok&&r.data&&r.data.available===false)return adAuditFilterHTML([])+adMissingHTML('Das Protokoll',{status:404});
  const rows=r&&r.ok?adRows(r.data,['entries','audit','rows']):[];
  let h=adAuditFilterHTML(rows);
  if(!r||!r.ok)return h+adMissingHTML('Das Protokoll',r);
  if(!rows.length)return h+`<div class="note status">Keine Einträge in diesem Zeitraum. Der Puffer existiert – er ist wirklich leer.</div>`;
  const groups=adAuditGroups(rows);
  ADMIN_LOG.auditGroups=groups;
  h+=`<div class="ad-thead four" aria-hidden="true"><span>Zeit</span><span>Handlung</span><span>Akteur</span><span>Betrifft</span></div><div class="ad-tbody">`;
  h+=groups.map((g,i)=>{const e=g.e;
    const actor=e.actor||e.actor_pseudonym||(e.actor_id!=null?'#'+e.actor_id:'System');
    const tgt=e.target||e.target_pseudonym||(e.target_type?String(e.target_type)+(e.target_id!=null?' '+e.target_id:''):'–');
    const n=g.n>1?` <span class="pill neutral">${g.n}×</span>`:'';
    return `<button type="button" class="ad-lrow" onclick="adAuditDetail(${i})"
      aria-label="${esc(adTs(e.ts_utc||e.ts))}, ${esc(adActionLabel(e.action))}${g.n>1?', '+g.n+' mal':''}, Akteur ${esc(actor)}, betrifft ${esc(tgt)}">
      <span class="c1">${esc2(adTs(e.ts_utc||e.ts))}</span>
      <span class="c2">${esc2(adActionLabel(e.action))}${n}</span>
      <span class="c3">${esc2(actor)}</span>
      <span class="c4">${esc2(tgt)}</span></button>`;}).join('');
  h+=`</div><p class="caption ad-foot">${pl(rows.length,'Eintrag','Einträge')} in ${pl(groups.length,'Zeile','Zeilen')} · Gleiche Handlung desselben Akteurs am selben Konto innerhalb von fünf Minuten steht als <b>n×</b> zusammen – aufgeklappt im Detail. Das Protokoll kennt nur Kennungen und Zustände, nie Inhalte. Löschen kann es niemand – auch du nicht.</p>`;
  return h;}
function adAuditMeta(e){
  const meta=e&&(e.meta_json||e.meta);
  try{const m=typeof meta==='string'?JSON.parse(meta):meta;
    if(m&&typeof m==='object')return Object.entries(m).map(([k,v])=>k+': '+String(v)).join(' · ');}
  catch(err){}
  return meta?String(meta):'';}
function adAuditDetail(i){
  const g=(ADMIN_LOG.auditGroups||[])[i];if(!g)return;
  const e=g.e;
  const zeit=g.n>1&&g.tLast?adTs(g.items[g.items.length-1].ts_utc||g.items[g.items.length-1].ts)+' bis '+adTs(e.ts_utc||e.ts):adTs(e.ts_utc||e.ts);
  const einzel=g.n>1?`<div class="section-label"><span>Die ${fmtNum(g.n)} Einträge</span></div><div class="rows mb-3">`
      +g.items.map(x=>`<div class="row"><span class="rl">${esc2(adTs(x.ts_utc||x.ts))}</span><span class="rr">${esc2(adAuditMeta(x)||'–')}</span></div>`).join('')+`</div>`
    :'';
  const metaTxt=g.n>1?'':adAuditMeta(e);
  openSheet(adActionLabel(e.action),`<div class="rows mb-3">
    <div class="row"><span class="rl">Zeitpunkt</span><span class="rr">${esc2(zeit)}</span></div>
    <div class="row"><span class="rl">Akteur</span><span class="rr">${esc2(String(e.actor||e.actor_pseudonym||(e.actor_id!=null?'#'+e.actor_id:'System')))}${e.actor_role?' · '+esc2(adRoleLabel(e.actor_role)):''}</span></div>
    <div class="row"><span class="rl">Betrifft</span><span class="rr">${esc2(String(e.target||e.target_pseudonym||e.target_type||'–'))}</span></div>
    <div class="row"><span class="rl">Kennung</span><span class="rr">${esc2(String(e.action||'–'))}</span></div>
    ${g.n>1?`<div class="row"><span class="rl">Anzahl</span><span class="rr">${fmtNum(g.n)}×</span></div>`:''}</div>
    ${metaTxt?`<div class="note status mb-3"><b>Zustände:</b> ${esc2(metaTxt)}</div>`:''}${einzel}`);}

// ---- Reiter „Fehler": der Ringpuffer, gruppiert nach Route und Art ----
function adminErrHTML(r){
  if(!r||!r.ok)return adMissingHTML('Die Fehlerliste',r);
  if(r.data&&r.data.available===false)return adMissingHTML('Die Fehlerliste',{status:404});
  const raw=adRows(r.data,['errors','groups','rows']);
  if(!raw.length)return `<div class="note ok">In den letzten 24 Stunden kein Fehler. Der Ringpuffer existiert und ist leer.</div>`;
  // Der Server darf bereits gruppiert liefern (dann traegt eine Zeile `count`); sonst wird hier
  // gruppiert – nach Route UND Art, weil „500 auf /api/foodlog" und „409 auf /api/foodlog" zwei
  // verschiedene Geschichten sind.
  const map=new Map();
  raw.forEach(e=>{const route=String(e.route||'–'),kind=String(e.kind||e.status||'–');
    const key=route+' '+kind;
    const cur=map.get(key)||{route:route,kind:kind,status:e.status,n:0,last:null,msg:''};
    cur.n+=Number(e.count)||1;
    const t=e.ts_utc||e.ts||e.last_utc||e.last;
    if(t&&(!cur.last||String(t)>String(cur.last)))cur.last=t;
    if(!cur.msg&&(e.msg_redacted||e.msg))cur.msg=String(e.msg_redacted||e.msg);
    map.set(key,cur);});
  const list=[...map.values()].sort((a,b)=>b.n-a.n||String(b.last||'').localeCompare(String(a.last||'')));
  const total=list.reduce((s,x)=>s+x.n,0);
  let h=`<div class="note status mb-3">${pl(total,'Fehler','Fehler')} in ${pl(list.length,'Gruppe','Gruppen')} · letzte 24 Stunden. Die Texte sind vor dem Speichern redigiert – Adressen, Tokens und Freitexte stehen nicht darin.</div>`;
  h+=`<div class="ad-thead four" aria-hidden="true"><span>Route</span><span>Art</span><span>Anzahl</span><span>zuletzt</span></div><div class="ad-tbody">`;
  h+=list.map((g,i)=>`<button type="button" class="ad-lrow ad-err" onclick="adErrDetail(${i})"
      aria-label="${esc(g.route)}, ${esc(g.kind)}, ${g.n} mal, zuletzt ${esc(adTs(g.last))}">
      <span class="c1">${esc2(g.route)}</span>
      <span class="c2">${esc2(g.kind)}</span>
      <span class="c3 ${g.n>=10?'t-bad':(g.n>=3?'t-warn':'')}">${fmtNum(g.n)}×</span>
      <span class="c4">${esc2(adTs(g.last))}</span></button>`).join('');
  h+=`</div>`;
  ADMIN_LOG.fehlerGroups=list;
  return h;}
function adErrDetail(i){const g=(ADMIN_LOG.fehlerGroups||[])[i];if(!g)return;
  openSheet('Fehler',`<div class="rows mb-3">
    <div class="row"><span class="rl">Route</span><span class="rr">${esc2(g.route)}</span></div>
    <div class="row"><span class="rl">Art</span><span class="rr">${esc2(g.kind)}</span></div>
    <div class="row"><span class="rl">Anzahl</span><span class="rr">${fmtNum(g.n)}×</span></div>
    <div class="row"><span class="rl">Zuletzt</span><span class="rr">${esc2(adTs(g.last))}</span></div></div>
    ${g.msg?`<div class="note status"><b>Redigierte Meldung:</b><br>${esc2(g.msg)}</div>`:''}`);}

// ---- Reiter „Jobs": Zustand, letzter Lauf, „jetzt nachholen" ----
// Zwei der vier Jobs lassen sich heute schon von Hand ausloesen (`POST /api/admin/weekly`,
// `/api/admin/process-freezes`) – die Routen gibt es seit 2.3.0, sie hatten nur nie eine Oberflaeche.
// Die uebrigen beiden zeigen ihren Zustand und sagen, warum es dort keinen Knopf gibt.
// Die Namen stammen aus server.js (`jobStart('cron.tick')`, `jobStart('retention.prune')`) – nicht aus
// dieser Datei. Wer hier einen Wunschnamen einträgt, bekommt eine Zeile, die nie einen Zustand hat.
// Die Karenz (`graceMin`) liefert der Server mit: 150 Minuten für den Stundentakt, 36 Stunden fürs
// tägliche Aufräumen.
// FIX-B1 B-I.6-1/5: Seit 3.0.0 ist die Sicherung sehr wohl ein Lauf (`backup.auto`, nachts gegen
// 3 Uhr) und die Wiederherstellungsprobe ein zweiter (`backup.verify`). Beide haben jetzt eine
// eigene Zeile mit Ampel UND einem Knopf, sie zu wiederholen – eine rote Zeile ohne Knopf war das,
// was der Prüfer zu Recht bemängelt hat. `backup.manual` bleibt daneben stehen: das ist der
// Download auf die eigene Maschine, ein Handgriff und kein Lauf.
// 2.9.0: Bis 2.8.0 trugen sich nur zwei Läufe ein – der Stundentakt und das Aufräumen. Ein einzelner
// Teilschritt konnte still ausfallen (keine Wochen-Nachricht, keine Erinnerung), und der Zeitgeber
// stand trotzdem auf „läuft", weil der äußere Lauf ja durchkam. Jetzt hat jeder Teil seine eigene
// Zeile mit eigener Karenz, und die Sicherung steht als `backup.manual` dabei – sie ist kein
// wiederkehrender Lauf, aber das, was am ehesten vergessen wird.
const AD_JOBS=[
  ['cron.tick','Zeitgeber',null,'Der Stundentakt selbst. Steht er, steht alles andere darunter mit.'],
  ['push.weekly','Wochen-Rückblick','weekly','Sonntags ab 18 Uhr: Nachricht in der App und Mail. Bis Montag 22 Uhr holt er sich selbst nach.'],
  ['push.reminder','Trainings-Erinnerung',null,'Jede Stunde wird geprüft, wer zu seiner Wunschstunde eine Erinnerung bekommt. „Überfällig" heißt: seit anderthalb Tagen hat niemand mehr geprüft.'],
  ['push.streakwarn','Abend-Hinweis',null,'Abends zwischen 19 und 21 Uhr für Athleten, die ihr Wochenpensum heute noch erreichen können und bis jetzt nichts eingetragen haben. Nur wer eine Erinnerungs-Uhrzeit gesetzt hat, bekommt ihn.'],
  ['mindset.cron','Mindset-Erinnerungen',null,'Priming zur Wunschstunde, Abend-Reflexion, fälliges Rad des Lebens.'],
  ['cleanup.tick','Aufräumen (stündlich)',null,'Schreibt die WAL-Datei zurück und entfernt abgelaufene Tokens, Merker verwaister Konten und alte Teilen-Links.'],
  ['retention.prune','Aufbewahrung (täglich)',null,'Löscht Protokoll- und Fehlerzeilen, die ihre Frist überschritten haben (365 bzw. 14 Tage).'],
  // FIX-B1 B-I.6-1/5: Diese vier Zeilen fehlten. `backup.auto`, `backup.verify` und `targets.weekly`
  // sind Läufe, die der Server seit 3.0.0 einträgt (server.js: jobStep) – ohne Eintrag hier fielen
  // sie in den extra-Zweig und standen mit rohem Routennamen und dem Satz „Dieser Lauf ist in der
  // Verwaltung noch nicht beschrieben" da. Die Karenz liefert der Server mit (36 Std. / 35 Tage /
  // 8 Tage); hier steht nur, was der Lauf tut und was „überfällig" für IHN bedeutet.
  ['targets.weekly','Ziel-Anpassung (wöchentlich)',null,'Rechnet sonntags je Athlet den gemessenen Verbrauch aus Gewichtsverlauf und Essprotokoll und legt daraus einen Zielvorschlag hin. Der Vorschlag wirkt erst, wenn der Athlet oder du ihn annimmt.'],
  ['backup.auto','Nächtliche Sicherung','backupnow','Jede Nacht gegen 3 Uhr eine vollständige Kopie der Datenbank auf die Platte, mit Prüfsumme. „Überfällig" heißt hier: die letzte Nacht hat keine geschrieben.','Jetzt sichern'],
  ['backup.verify','Wiederherstellungsprobe','backupverify','Spielt die jüngste Sicherung in eine Wegwerf-Datei und prüft sie dort (Integrität, Tabellen, Zeilenzahlen). Die laufende Datenbank wird dabei nicht angefasst. „Überfällig" heißt: seit über einem Monat hat das niemand mehr geprüft.','Probe starten'],
  ['backup.manual','Sicherung heruntergeladen',null,'Kein Lauf, sondern dein Handgriff: die Kopie, die du auf deine eigene Maschine ziehst. Sie ersetzt die nächtliche nicht – und die nächtliche nicht sie.']];
const AD_JOB_STATE={ok:['ok','läuft'],up:['ok','läuft'],late:['mid','überfällig'],down:['bad','steht'],
  never:['unknown','noch nie gelaufen'],unknown:['unknown','noch nie erfolgreich gelaufen']};
function adminJobsHTML(r){
  const avail=!(r&&r.ok&&r.data&&r.data.available===false);
  const srv=r&&r.ok&&avail?adRows(r.data,['jobs','rows']):[];
  const byName={};srv.forEach(j=>{if(j&&j.name)byName[String(j.name)]=j;});
  const known=AD_JOBS.map(([key,label,trigger,text,btn])=>({key,label,trigger,text,btn:btn||'jetzt nachholen',j:byName[key]||null}));
  // Laeufe, die der Server kennt und diese Liste nicht – nie verschweigen, sonst faellt ein neuer Job
  // aus der Aufsicht heraus, ohne dass es jemand merkt.
  const extra=srv.filter(j=>!AD_JOBS.some(k=>k[0]===String(j.name)))
    .map(j=>({key:String(j.name||'?'),label:String(j.name||'?'),trigger:null,text:'Dieser Lauf ist in der Verwaltung noch nicht beschrieben.',j:j}));
  let h='';
  if(!r||!r.ok||!avail)h+=adMissingHTML('Der Zustand der Läufe',avail?r:{status:404})
    +`<p class="body mt-3 mb-3">Die Zeilen unten zeigen deshalb nur, was es gibt und was du von Hand auslösen kannst.</p>`;
  h+=`<div class="section-label"><span>Wiederkehrende Läufe</span></div><div class="rows mb-4">`;
  h+=known.concat(extra).map(({label,trigger,text,btn,j})=>{
    const s=AD_JOB_STATE[j?String(j.state||'unknown'):'']||['unknown','Zustand nicht protokolliert'];
    const last=j?(j.last_ok_utc||j.last_run_utc):null;
    const err=j&&j.last_error?String(j.last_error):'';
    // Ab zwei Tagen in Tagen: „Karenz 192 Std." liest niemand als „acht Tage".
    const grace=j&&j.graceMin?('Karenz '+(j.graceMin>=2880?pl(Math.round(j.graceMin/1440),'Tag','Tage')
      :(j.graceMin>=120?fmtNum(j.graceMin/60,j.graceMin%60?1:0)+' Std.':j.graceMin+' Min.'))):'';
    return `<div class="row ad-job"><span class="sdot ${s[0]}"></span>
      <span class="rl">${esc2(label)}<small>${j?esc2(s[1]):'Zustand nicht protokolliert'}${last?' · zuletzt '+esc2(adAgoTxt(last)):''}${grace?' · '+esc2(grace):''}${err?`<br><span class="t-bad">Fehler: ${esc2(err.slice(0,80))}</span>`:''}<br>${esc2(text)}</small></span>
      ${trigger?`<button type="button" class="btn sm sec" onclick="adJobRun('${trigger}')">${esc2(btn||'jetzt nachholen')}</button>`:''}</div>`;}).join('');
  h+=`</div><div class="section-label"><span>Von Hand auslösen</span></div><div class="rows mb-3">
    <button type="button" class="row tap ad-row" onclick="adJobRun('weekly')"><span class="r-ic">${icon('calendar')}</span><span class="rl">Wochen-Rückblick nachholen<small>Für die zuletzt abgeschlossene Woche – Nachricht und Mail</small></span></button>
    <button type="button" class="row tap ad-row" onclick="adJobRun('freezes')"><span class="r-ic">${icon('refresh')}</span><span class="rl">Reparaturen verarbeiten<small>Vergibt fällige Reparaturen und räumt abgelaufene weg</small></span></button>
    <button type="button" class="row tap ad-row" onclick="adBackupSheet()"><span class="r-ic">${icon('shield')}</span><span class="rl">Sicherungen<small>Liste, Aufbewahrung, jetzt sichern, Wiederherstellungsprobe</small></span></button>
    <button type="button" class="row tap ad-row" onclick="openBackupSheet()"><span class="r-ic">${icon('download')}</span><span class="rl">Kopie herunterladen<small>Auf deine eigene Maschine – zusätzlich zur nächtlichen Sicherung</small></span></button></div>
  <p class="caption ad-foot">„Aufräumen" und „Aufbewahrung" haben keinen Knopf: es gibt keine Route, um sie von Hand anzustoßen – sie laufen im Stundentakt mit. Was du hier auslöst, steht danach im Reiter „Protokoll".</p>`;
  return h;}
// Von Hand ausloesen. Die Antwort wird ausgesprochen (wie viele Mails, wie viele Nachrichten) –
// ein blosses „ok ✓" laesst den Betreiber raten, ob etwas passiert ist.
async function adJobRun(name){
  // FIX-B1 B-I.6-1/5: Die beiden Sicherungs-Läufe antworten mit ganz anderen Feldern (Bytes,
  // Prüfsumme, Prüfbericht) als die zwei alten Knöpfe. Sie bekommen deshalb ihren eigenen Weg,
  // aber DENSELBEN Einstiegspunkt – die Zeile in der Jobs-Liste ruft weiter nur adJobRun().
  if(name==='backupnow')return adBackupRun();
  if(name==='backupverify')return adBackupVerify();
  const map={weekly:['/admin/weekly','Wochen-Rückblick'],freezes:['/admin/process-freezes','Reparaturen']};
  const m=map[name];if(!m)return;
  toast(m[1]+' läuft …');
  const r=await API.post(m[0],{});
  if(r.status===404)return toast('Dafür braucht der Server ein Update.');
  if(r.status!==200)return toast(r.data?.error||(m[1]+' fehlgeschlagen'));
  const d=r.data||{};
  const bits=[];
  if(d.sent!=null)bits.push(pl(d.sent,'Mail','Mails'));
  if(d.messages!=null)bits.push(pl(d.messages,'Nachricht','Nachrichten'));
  if(d.granted!=null)bits.push(fmtNum(d.granted)+' vergeben');
  if(d.expired!=null)bits.push(fmtNum(d.expired)+' abgelaufen');
  if(d.week)bits.push('Woche vom '+fmtDate(String(d.week).slice(0,10)));
  toast(m[1]+': '+(bits.length?bits.join(' · '):'erledigt ✓'));
  coachInvalidate();if(ADMIN_LOG_TAB==='jobs'||ADMIN_LOG_TAB==='protokoll')adRenderTab();}
// Die Antwort wird woertlich genommen: `sent:false` heisst, dass NICHTS verschickt wurde – dann darf
// hier kein gruener Haken stehen. Genau dieser Unterschied („angestossen" vs. „angekommen") war der
// Grund, warum ein Betreiber monatelang glauben konnte, der Mailversand laufe.
async function adTestmail(){
  toast('Testmail wird ausgelöst …');
  const r=await API.post('/admin/testmail',{});
  if(r.status===404)return toast('Dafür braucht der Server ein Update.');
  if(r.status!==200)return toast(r.data?.error||'Testmail fehlgeschlagen');
  const d=r.data||{};
  const really=d.sent===true||(d.sent===undefined&&d.configured!==false);
  openSheet('Testmail',(really
    ?`<div class="note ok mb-3">${icon('check',18)} Die Testmail ist rausgegangen.</div>
      <p class="body">Kommt sie nicht an, liegt es am Postfach oder am Spam-Ordner – der Server hat seinen Teil getan.</p>`
    :`<div class="note warn mb-3"><b>Es wurde keine Mail verschickt.</b></div>
      <p class="body mb-3">${esc2(String(d.hint||'Ohne SMTP-Zugangsdaten schreibt der Server jede Mail nur ins Log.'))}</p>
      <div class="note status">Solange das so ist, erreichen Bestätigung, Passwort-Reset und Wochenrückblick niemanden. Setze EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS und EMAIL_FROM und starte neu.</div>`));}

/* ===== FIX-B1 B-I.6-1/5 · DAS BLATT „SICHERUNGEN" =====
   Der Prüfbefund in einem Satz: die Sicherung läuft seit 3.0.0 jede Nacht, die Verwaltung sagte
   „Es gibt noch keine Ablage dafür" – und hätte einen gescheiterten Lauf nicht rot gemeldet, weil
   sie ihn gar nicht gelesen hat. Hier steht jetzt alles, was der Server dazu weiß, an EINER Stelle:
   wann zuletzt gesichert wurde, ob die Wiederherstellungsprobe grün war, wie lange aufbewahrt wird,
   wie viel auf der Platte liegt – und zwei Knöpfe, die genau das auslösen, was die Zeilen messen.
   Personenbezug: keiner. Zeitpunkte, Byte-Zahlen, Prüfsummen, Zustandswörter (roles.mjs). */
let AD_BK_BUSY=false;                      // ein VACUUM zur Zeit, kein Doppelklick
const AD_BK_KEEP=[7,14,30,60,90,180,365];  // Untergrenze/Obergrenze des Servers: 1 bis 365 Tage
async function adBackupSheet(){
  openSheet('Sicherungen',`<div id="adBkBox">${skeleton(3)}</div>`);
  const r=await adGet(['/admin/backups']);
  if(ADMIN_CACHE){ADMIN_CACHE.backups=r;ADMIN_CACHE.sig='';}
  openSheet('Sicherungen',adBackupSheetHTML(r));}
function adBackupSheetHTML(r){
  const d=adBackupData(r);
  if(!d)return `<div id="adBkBox">${adMissingHTML('Die Liste der Sicherungen',(r&&r.ok)?{status:404}:r)}
    <p class="body mt-3">Bis dahin bleibt nur der Handgriff: „Kopie herunterladen" im Reiter „Betrieb".</p></div>`;
  const last=adBackupLast(r),job=adBackupJob(r),ver=adBackupVer(r);
  const rows=Array.isArray(d.entries)?d.entries:[];
  const js=job?String(job.state||''):'';
  const hrs=last?Math.floor((adAgo(last.created_at)||0)/60):null;
  const head=!last
    ? `<div class="note warn mb-3"><b>Auf der Platte liegt noch keine Sicherung.</b><br>Der nächtliche Lauf schreibt die erste gegen ${fmtNum(d.hour==null?3:d.hour)} Uhr – oder du drückst jetzt „Jetzt sichern".</div>`
    : (js==='down'
      ? `<div class="note err mb-3"><b>Der nächtliche Lauf steht.</b><br>${esc2(String(job.last_error||'Grund nicht protokolliert').slice(0,160))}<br>Jüngste brauchbare Kopie: ${esc2(adAgoTxt(last.created_at))} (${esc2(adTs(last.created_at))}).</div>`
      : (js==='late'||(hrs!=null&&hrs>36)
        ? `<div class="note warn mb-3"><b>Die letzte Nacht hat keine Kopie geschrieben.</b><br>Jüngste: ${esc2(adAgoTxt(last.created_at))} · ${esc2(adBytes(last.bytes))}.</div>`
        : `<div class="note ok mb-3">${icon('check',18)} Jüngste Sicherung ${esc2(adAgoTxt(last.created_at))} – ${esc2(adTs(last.created_at))} · ${esc2(adBytes(last.bytes))} · ${esc2(adBkKind(last.kind))}.</div>`));
  // Die Probe hat ihre eigene Zeile: „gesichert" und „wiederherstellbar" sind zwei Aussagen, und
  // Art. 32(1)(d) verlangt ausdruecklich die zweite. Der Wortlaut des letzten Berichts steht dabei –
  // er nennt Tabellen und Zeilenzahlen, und genau daran sieht man, ob die Kopie taugt.
  const probe=rows.find(e=>e&&String(e.kind||'')==='probe')||null;
  const vs=ver?String(ver.state||''):'';
  // Die Zustandswörter des Servers sind dieselben wie in der Jobs-Liste (AD_JOB_STATE); „up" ist der
  // einzige, der grün heißen darf. Ein unbekanntes Wort wird nicht zu grün geraten.
  const vTone=!ver?'unknown':(vs==='down'?'bad':(vs==='late'?'mid':((vs==='up'||vs==='ok')?'ok':'unknown')));
  const vTxt=!ver?'noch nie geprüft'
    :(vs==='down'?'zuletzt rot':(vs==='late'?'überfällig':((vs==='up'||vs==='ok')?'zuletzt grün':'noch nie erfolgreich gelaufen')))
      +((ver.last_ok_utc||ver.last_run_utc)?' · '+adAgoTxt(ver.last_ok_utc||ver.last_run_utc):'');
  const sha=last&&last.sha256?String(last.sha256).slice(0,12):'';
  let h=`<div id="adBkBox">${head}
  <div class="rows mb-3">
    <div class="row ad-job"><span class="sdot ${vTone}"></span><span class="rl">Wiederherstellungsprobe<small>${esc2(vTxt)}${probe&&probe.note?'<br>'+esc2(String(probe.note).slice(0,180)):''}</small></span></div>
  </div>
  <div class="rows mb-3">
    <button type="button" class="row tap ad-row ad-bk-act" onclick="adBackupRun()"><span class="r-ic">${icon('shield')}</span><span class="rl">Jetzt sichern<small>Derselbe Lauf wie nachts – höchstens alle 10 Minuten</small></span></button>
    <button type="button" class="row tap ad-row ad-bk-act" onclick="adBackupVerify()"><span class="r-ic">${icon('refresh')}</span><span class="rl">Wiederherstellungsprobe<small>Spielt die jüngste Kopie in eine Wegwerf-Datei – die laufende Datenbank bleibt unberührt</small></span></button>
  </div>
  <div class="field"><label for="bk_keep">Aufbewahrung</label>
    <select id="bk_keep" onchange="adBackupKeep(this.value)">${(()=>{
      // Steht der Server auf einer Frist, die hier nicht in der Liste steht (von Hand gesetzt),
      // kommt sie dazu – sonst waere die Auswahl eine stille Korrektur beim ersten Blick.
      const k=Number(d.keepDays);
      const opts=AD_BK_KEEP.slice();
      if(Number.isFinite(k)&&k>0&&opts.indexOf(k)<0)opts.push(k);
      return opts.sort((a,b)=>a-b).map(n=>`<option value="${n}"${n===k?' selected':''}>${esc2(pl(n,'Tag','Tage'))}</option>`).join('');})()}</select></div>
  <p class="caption mb-3">Ältere Kopien werden nachts gelöscht – die jüngste bleibt in jedem Fall stehen, auch bei der kürzesten Frist.
    Auf der Platte: ${fmtNum(d.filesOnDisk||0)} ${(d.filesOnDisk===1?'Datei':'Dateien')} · ${esc2(adBytes(d.bytesOnDisk))}${d.freeMb!=null?' · frei '+esc2(adBytes(Number(d.freeMb)*1048576)):''}.
    ${d.dir?'Verzeichnis: <code>'+esc2(String(d.dir))+'</code>':''}</p>`;
  if(rows.length){
    h+=`<div class="section-label"><span>Die letzten Läufe</span></div><div class="rows mb-3">`
      +rows.slice(0,12).map(e=>`<div class="row"><span class="sdot ${Number(e.ok)===1?'ok':'bad'}"></span>
        <span class="rl">${esc2(adTs(e.created_at))} · ${esc2(adBkKind(e.kind))}${e.note?`<small>${esc2(String(e.note).slice(0,140))}</small>`:''}</span>
        <span class="rr">${esc2(adBytes(e.bytes))}</span></div>`).join('')+`</div>`;}
  h+=`<div class="note status">Die nächtliche Kopie liegt auf <b>demselben Server</b> wie die Datenbank – gegen einen Plattenschaden hilft sie, gegen den Verlust des Servers nicht. Dafür ist „Kopie herunterladen" da${sha?`. Prüfsumme der jüngsten: <code>${esc2(sha)}…</code>`:''}.</div></div>`;
  return h;}
// Nach jedem Lauf wird der Zustand NEU GELESEN, nicht aus dem Klick abgeleitet (dieselbe Regel wie
// bei den Schaltern, opWrite). coachInvalidate() bleibt hier bewusst aus: eine Sicherung ändert
// keine Athletendaten – und der Streifen würde sonst aus einem geleerten Cache neu gezeichnet
// (bekannter Befund FIX-A5 A5-1).
async function adBackupRefresh(sheet){
  const r=await adGet(['/admin/backups']);
  if(ADMIN_CACHE){ADMIN_CACHE.backups=r;ADMIN_CACHE.sig='';}
  const strip=document.querySelector('#adminPage .co-status');
  if(strip&&ADMIN_CACHE)strip.outerHTML=coAdminStatusHTML(ADMIN_CACHE.stats,ADMIN_CACHE.self,ADMIN_CACHE.audit,r);
  if(ADMIN_LOG_TAB==='jobs')adRenderTab();
  if(sheet)openSheet('Sicherungen',adBackupSheetHTML(r));
  return r;}
function adBkBusy(on){AD_BK_BUSY=!!on;
  document.querySelectorAll('.ad-bk-act').forEach(b=>{try{b.disabled=!!on;}catch(e){}});}
async function adBackupRun(){
  if(AD_BK_BUSY)return;
  adBkBusy(true);toast('Sicherung läuft – das kann einen Moment dauern …');
  const r=await API.post('/admin/backups/run',{});
  adBkBusy(false);
  if(r.status===404)return toast('Dafür braucht der Server ein Update.');
  if(r.status===429)return toast((r.data&&r.data.error)||'Bitte ein paar Minuten warten.');
  const d=r.data||{};
  if(r.status!==200||d.ok!==true)return toast(d.error||'Sicherung fehlgeschlagen');
  toast('Sicherung geschrieben ✓ · '+adBytes(d.bytes)+(d.ms!=null?' · '+fmtNum(d.ms)+' ms':''));
  await adBackupRefresh(!!document.getElementById('adBkBox'));}
// Die Probe antwortet mit einem ganzen Satz (Tabellen, Zeilen, Hinweise). Ein Toast trägt ihn nicht –
// deshalb wird danach immer das Blatt gezeigt, auch wenn der Knopf im Reiter „Jobs" gedrückt wurde.
async function adBackupVerify(){
  if(AD_BK_BUSY)return;
  adBkBusy(true);toast('Wiederherstellungsprobe läuft …');
  const r=await API.post('/admin/backups/verify',{});
  adBkBusy(false);
  if(r.status===404)return toast('Dafür braucht der Server ein Update.');
  const d=r.data||{};
  if(r.status!==200)return toast(d.error||'Probe fehlgeschlagen');
  toast(d.ok===true?'Probe grün ✓':'Probe rot – die Sicherung ist nicht brauchbar');
  await adBackupRefresh(true);}
async function adBackupKeep(v){
  const days=parseInt(v,10);
  if(!Number.isFinite(days))return;
  const r=await API.put('/admin/backups/keep',{days:days});
  if(r.status===404)return toast('Dafür braucht der Server ein Update.');
  if(r.status!==200)return toast((r.data&&r.data.error)||'Die Frist ließ sich nicht ändern.');
  const d=r.data||{};
  toast('Aufbewahrung: '+pl(d.keepDays==null?days:d.keepDays,'Tag','Tage')+(d.pruned?' · '+pl(d.pruned,'alte Kopie gelöscht','alte Kopien gelöscht'):''));
  await adBackupRefresh(!!document.getElementById('adBkBox'));}

// --- Sicherung herunterladen (POST /api/admin/backup, Admin + aktuelles Passwort) ---
// Der Download laeuft ueber fetch mit Cookie (httpOnly – ein <a href> mit POST gibt es nicht), die Antwort
// wird als Blob gehalten und ueber einen kurzlebigen <a download> gespeichert. Auf dem Handy (iOS-PWA)
// landet die Datei je nach System in „Dateien" oder oeffnet sich in einer Vorschau – daher der Hinweis
// auf den Computer. Die Warnung stand bis 2.5.0 als siebenzeilige Textwand ueber dem Passwortfeld
// (RATE-admin L1); jetzt sind es drei Stichpunkte, der Rest liegt unter „Mehr dazu".
function openBackupSheet(){
  openSheet('Sicherung herunterladen',`<form id="bkForm" onsubmit="doBackup();return false" novalidate>
    <ul class="ad-bullets mb-3">
      <li><b>Die Datei enthält alles</b> – Passwort-Hashes, Gesundheitswerte, Fotos, Nachrichten.</li>
      <li><b>Nur verschlüsselt ablegen</b> – 7-Zip oder age mit langem Passwort, nie im Cloud-Ordner.</li>
      <li><b>Alte Kopien löschen</b> – nach einer festen Frist, nicht „irgendwann".</li></ul>
    <details class="admin-more mb-3"><summary>Mehr dazu ${icon('chevronDown',18)}</summary>
      <p class="body muted mt-2">Am besten am Computer herunterladen. Bei vielen Fotos kann die Datei mehrere hundert MB groß sein und das Erstellen eine Weile dauern. Höchstens eine Sicherung alle 10 Minuten. Verschicke sie nie per E-Mail.</p>
      <p class="body muted">Eine Sicherung, die noch nie zurückgespielt wurde, ist keine Sicherung: spiele sie einmal im Quartal in eine Testdatenbank ein und prüfe die Zeilenzahlen.</p></details>
    ${pwField({id:'bk_pw',label:'Zur Bestätigung dein Passwort',autocomplete:'current-password',enterkeyhint:'done'})}
    <div id="bk_status" class="mb-3"></div>
    <button class="btn sec block" id="bk_go" type="submit">${icon('download',18)} Sicherung herunterladen</button></form>`);
  setTimeout(()=>document.getElementById('bk_pw')?.focus({preventScroll:true}),380);}
async function doBackup(){const pw=val('bk_pw');
  if(!pw)return showFieldErr('bkForm','Bitte dein Passwort eingeben.','bk_pw');
  const btn=document.getElementById('bk_go'),st=document.getElementById('bk_status');
  if(btn)btn.disabled=true;if(st)st.innerHTML='<div class="note status">Sicherung wird erstellt … bitte das Sheet offen lassen.</div>';
  let res=null;
  try{res=await fetch('/api/admin/backup',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});}
  catch(e){console.error('[backup]',e);}
  if(btn)btn.disabled=false;
  if(!res){if(st)st.innerHTML='';return showFieldErr('bkForm','Keine Verbindung. Ist der Server erreichbar?','bk_pw');}
  if(!res.ok){let d=null;try{d=await res.json();}catch(e){}
    if(st)st.innerHTML='';
    if(res.status===401&&!/passwort/i.test(String(d?.error||''))){if(typeof sessionLost==='function')sessionLost(d?.error);return;}
    if(res.status===404)return showFieldErr('bkForm','Dafür braucht der Server ein Update.','bk_pw');
    if(res.status===429){const s=Number(d?.retryAfterSec);return showFieldErr('bkForm',(d?.error||'Bitte 10 Minuten warten.')+(s>0?` (noch ${Math.ceil(s/60)} Min.)`:''),'bk_pw');}
    return showFieldErr('bkForm',d?.error||'Sicherung fehlgeschlagen.','bk_pw');}
  let blob;try{blob=await res.blob();}catch(e){console.error('[backup]',e);if(st)st.innerHTML='';return showFieldErr('bkForm','Die Übertragung ist abgebrochen – bitte erneut versuchen.','bk_pw');}
  // Dateiname vom Server (Content-Disposition), sonst dasselbe Muster lokal
  let name='be-inevitable-'+today()+'.db';
  try{const cd=res.headers.get('Content-Disposition')||'';const m=cd.match(/filename="?([^";]+)"?/);if(m&&m[1])name=m[1].replace(/[^\w.\-]/g,'_');}catch(e){}
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>{try{URL.revokeObjectURL(url);}catch(e){}},60000); // iOS braucht die URL noch einen Moment
  const mb=blob.size/1048576;
  if(st)st.innerHTML=`<div class="note ok">Sicherung erstellt: <b>${esc2(name)}</b> (${fmtNum(mb,mb<10?1:0)} MB). Jetzt verschlüsselt ablegen.</div>`;
  const pwEl=document.getElementById('bk_pw');if(pwEl)pwEl.value='';
  toast('Sicherung heruntergeladen ✓');
  coachInvalidate();}

// ===== KONTEN: ANLEGEN, ROLLE, PASSWORT, LOESCHEN – ALLES OHNE ADRESSLISTE =====
function adminNewUser(){openSheet('Neuen Nutzer anlegen',`<div id="auBox">
  <div class="note status mb-3">Name und Adresse brauchst du einmal zum Anlegen. Danach taucht beides in keiner Liste dieser Verwaltung mehr auf – das Konto erscheint nur noch als Kürzel.</div>
  <div class="field"><label for="au_name">Name</label><input id="au_name" placeholder="Vor- und Nachname" maxlength="80"></div>
  <div class="field"><label for="au_email">E-Mail</label><input id="au_email" type="email" inputmode="email" autocomplete="off" placeholder="name@mail.com"></div>
  <div class="note mb-3">Lass das Passwortfeld <b>leer</b> – dann bekommst du einen Einladungslink zum Weitergeben und die Person setzt ihr Passwort selbst. Ein Startpasswort, das du kennst und durchgibst, ist der schlechtere Weg.</div>
  ${pwField({id:'au_pw',label:'Startpasswort (optional)',autocomplete:'new-password',placeholder:'leer lassen = Einladungslink',hint:true})}
  <div class="field"><label for="au_role">Rolle</label><select id="au_role" onchange="auRoleChange()">
    <option value="athlete">Athlet</option><option value="coach">Coach</option><option value="admin">Betreiber</option></select></div>
  <div class="field" id="au_coachwrap"><label for="au_coach">Coach zuordnen (optional)</label><select id="au_coach"><option value="">– kein Coach –</option>${ADMIN_COACHES.map(c=>`<option value="${c.id}">${esc2(adCoachOption(c))}</option>`).join('')}</select></div>
  <button type="button" class="btn sec block" onclick="adminCreateUser()">Anlegen</button></div>`);}
function auRoleChange(){const w=document.getElementById('au_coachwrap');if(w)w.hidden=val('au_role')!=='athlete';}
// Das Passwortfeld ist seit 2.6.0 OPTIONAL (BUILD-A2 §4 Punkt 11): leer = Einladungslink. Ein leeres
// Feld darf deshalb nicht als `password:''` mitgehen – der Server unterscheidet an genau diesem Feld,
// ob er ein Passwort setzt oder einen Link erzeugt.
async function adminCreateUser(){const pw=val('au_pw');
  const body={name:val('au_name'),email:val('au_email'),role:val('au_role'),coach_id:val('au_coach')||null};
  if(pw)body.password=pw;
  if(!body.name)return showFieldErr('auBox','Bitte einen Namen eingeben.','au_name');
  if(!body.email)return showFieldErr('auBox','Bitte eine E-Mail eingeben.','au_email');
  if(pw&&pw.length<8)return showFieldErr('auBox','Mindestens 8 Zeichen – oder das Feld leer lassen, dann gibt es einen Einladungslink.','au_pw');
  const r=await API.post('/admin/users',body);
  if(r.status!==200)return showFieldErr('auBox',r.data?.error||'Fehler');
  coachInvalidate();go('admin');
  if(pw){closeModal();toast('Nutzer angelegt ✓');return;}
  coInviteSheet('Nutzer angelegt',r.data,body.name);}
// Das Konto-Sheet zeigt Kuerzel, Rolle, Coach-Kuerzel, Aktivitaetsklasse und Anlagedatum – keinen
// Namen, keine Adresse. Der Loesch-Hinweis haengt an der Rolle (RATE-admin L2): „Athleten verlieren
// ihren Coach" ist bei einem Athleten schlicht falsch.
function adminEditUser(id){const u=(ADMIN_USERS||[]).find(x=>x.id===id);if(!u)return;
  const p=adPseudo(u),a=adActivity(u);
  let h=`<div id="euBox"><div class="rows mb-4">
      <div class="row"><span class="rl">Rolle</span><span class="rr">${esc2(adRoleLabel(u.role))}</span></div>
      <div class="row"><span class="rl">Coach</span><span class="rr">${esc2(adCoachCode(u))}</span></div>
      <div class="row"><span class="rl">Aktivität</span><span class="rr">${esc2(a.cls)}</span></div>
      <div class="row"><span class="rl">Angelegt</span><span class="rr">${esc2(adCreated(u))}</span></div></div>
    <div class="field"><label for="eu_role">Rolle ändern</label><select id="eu_role" onchange="euRoleChange()">
      <option value="athlete"${u.role==='athlete'?' selected':''}>Athlet</option>
      <option value="coach"${u.role==='coach'?' selected':''}>Coach</option>
      <option value="admin"${u.role==='admin'?' selected':''}>Betreiber</option></select></div>
    <div class="field" id="eu_coachwrap"${u.role==='athlete'?'':' hidden'}><label for="eu_coach">Coach</label><select id="eu_coach"><option value="">– kein Coach –</option>${ADMIN_COACHES.map(c=>`<option value="${c.id}"${u.coach_id===c.id?' selected':''}>${esc2(adCoachOption(c))}</option>`).join('')}</select></div>
    <button type="button" class="btn sec block" onclick="adminSaveUser(${id})">Speichern</button></div>
    <details class="admin-more"><summary>Zugang wiederherstellen ${icon('chevronDown',18)}</summary>
      <div id="euPwBox"><p class="caption mt-2 mb-2">Du vergibst kein Passwort mehr – das wäre „als Nutzer anmelden" durch die Hintertür. Stattdessen entsteht ein einmaliger Link (72 Stunden), mit dem sich die Person selbst ein neues Passwort setzt. Das bisherige Passwort gilt weiter, bis der Link benutzt wird; die Person bekommt in jedem Fall eine Nachricht.</p>
      <button type="button" class="btn sec block" onclick="adminResetPw(${id})">Link zum Passwort-Setzen erzeugen</button></div></details>`;
  if(id!==(ME&&ME.id)){
    const folge=u.role==='coach'?'Seine Athleten bleiben erhalten, verlieren aber ihren Coach.'
      :(u.role==='admin'?'Ein Betreiber weniger – achte darauf, dass ein zweiter übrig bleibt.'
      :'Alle Trainings-, Ernährungs- und Check-in-Daten dieses Kontos gehen mit.');
    h+=`<div class="danger-block"><div class="h3 mb-1">Konto löschen</div><div class="meta mb-3">${esc2(folge)}</div>
      <button type="button" class="btn danger block" onclick="adminDeleteUser(${id},'${esc(p)}')">${icon('trash',18)} ${esc2(p)} löschen</button></div>`;}
  openSheet(p,h);}
function euRoleChange(){const w=document.getElementById('eu_coachwrap');if(w)w.hidden=val('eu_role')!=='athlete';}
// EIN Speichern fuer Rolle + Coach-Zuordnung (statt zwei Buttons)
async function adminSaveUser(id){const u=(ADMIN_USERS||[]).find(x=>x.id===id);if(!u)return;const role=val('eu_role');
  if(role!==u.role){const r=await API.put('/admin/users/'+id+'/role',{role});if(r.status!==200)return showFieldErr('euBox',r.data?.error||'Fehler','eu_role');}
  if(role==='athlete'){const cid=val('eu_coach')||null;if(String(cid||'')!==String(u.coach_id||'')){const r=await API.put('/admin/users/'+id+'/coach',{coach_id:cid});if(r.status!==200)return showFieldErr('euBox',r.data?.error||'Fehler','eu_coach');}}
  closeModal();toast('Gespeichert ✓');coachInvalidate();go('admin');}
// Alte Einzel-Buttons bleiben als Aliase erreichbar
async function adminSaveRole(id){return adminSaveUser(id);}
async function adminSaveCoach(id){return adminSaveUser(id);}
// Seit 2.6.0 vergibt der Betreiber KEIN Passwort mehr (server.js /admin/users/:id/resetpw lehnt ein
// mitgeschicktes `next` mit 400 ab – die alte Fassung dieses Aufrufs lief damit zwingend in den Fehler).
// Der Knopf erzeugt den einmaligen Link; ist Mailversand eingerichtet, geht er an die hinterlegte
// Adresse und wird hier bewusst NICHT gezeigt.
async function adminResetPw(id){const u=(ADMIN_USERS||[]).find(x=>x.id===id);
  const r=await API.post('/admin/users/'+id+'/resetpw',{});
  if(r.status!==200)return showFieldErr('euPwBox',r.data?.error||'Fehler');
  coInviteSheet('Zugang wiederherstellen',r.data,null);
  adInviteNoteFix(u);}
// Die Erfolgskarte von coInviteSheet spricht vom Anlegen – beim Zurücksetzen stimmt daran nur der
// Link-Teil. Deshalb der erste Satz hier noch einmal richtig, statt eine zweite Kartenfassung zu bauen.
function adInviteNoteFix(u){const n=document.querySelector('#sheetBody .note.ok');if(!n)return;
  n.textContent=(u?adPseudo(u):'Das Konto')+' bekommt einen einmaligen Link zum Passwort-Setzen. Das bisherige Passwort gilt weiter, bis der Link benutzt wird.';}
// Nutzer loeschen: seit 2.5.0 verlangt DELETE /api/admin/users/:id das eigene Admin-Passwort als zweiten
// Faktor (server.js). Ein reines confirmSheet konnte das nicht liefern – es hat keine Eingabefelder und
// schliesst das Sheet, BEVOR der Rueckruf laeuft (shell.js `_confirmYes`), da waere jedes Feld schon weg.
// Deshalb ein eigenes Sheet mit Passwortfeld, genau wie bei der Sicherung. Angesprochen wird das Konto
// mit seinem Kuerzel – der Name steht in dieser Verwaltung nirgends mehr.
function adminDeleteUser(id,name){
  const u=(Array.isArray(ADMIN_USERS)?ADMIN_USERS:[]).find(x=>x.id===id);
  const nm=u?adPseudo(u):String(name||'');
  openSheet('Konto löschen',`<form id="duBox" onsubmit="coAdminDeleteGo(${id});return false" novalidate>
    <div class="body mb-4">Das Konto <b>${esc2(nm)}</b> wird endgültig gelöscht – samt Trainings-, Ernährungs- und Check-in-Daten. Das kann nicht rückgängig gemacht werden.</div>
    ${pwField({id:'du_pw',label:'Zur Bestätigung dein Passwort',autocomplete:'current-password',enterkeyhint:'done'})}
    <button class="btn danger block" id="du_go" type="submit">${icon('trash',18)} Endgültig löschen</button>
    <button class="btn block sec mt-2" type="button" onclick="closeModal()">Abbrechen</button></form>`);
  setTimeout(()=>document.getElementById('du_pw')?.focus({preventScroll:true}),380);}
async function coAdminDeleteGo(id){
  const pw=val('du_pw');
  if(!pw)return showFieldErr('duBox','Bitte dein Passwort eingeben.','du_pw');
  const btn=document.getElementById('du_go');if(btn)btn.disabled=true;
  // raw:true, weil 401 hier „Passwort falsch" heisst und NICHT „Sitzung abgelaufen" – ohne das wuerde
  // core.js den Admin bei jedem Tippfehler abmelden.
  const r=await API.del('/admin/users/'+id,{password:pw},{raw:true});
  if(btn)btn.disabled=false;
  if(r.status===200){closeAllSheets();toast('Konto gelöscht');coachInvalidate();go('admin');return;}
  if(r.status===401&&!/passwort/i.test(String(r.data?.error||''))){if(typeof sessionLost==='function')sessionLost(r.data?.error);return;}
  showFieldErr('duBox',r.data?.error||'Löschen fehlgeschlagen.','du_pw');}

// ===== COACH: ATHLETEN-ÜBERSICHT (eine Liste, ein Status-Modell) =====
async function fetchCoachOverview(){
  const [ov,al]=await Promise.all([API.get('/coach/overview'),API.get('/athletes')]);
  if(al.status!==200)return null;
  const o=ov.data||{};const list=al.data?.athletes||[];
  // /coach/attention nur noch als Fallback für ältere Server: seit 2.1 liefert GET /api/athletes je Zeile
  // status/reasons/openFlags. Der dritte Aufruf ließe sonst athleteAttention() ein weiteres Mal über alle
  // Athleten laufen (4 Abfragen je Athlet) – bei jedem Zeichnen des Athleten-Tabs.
  const at=list.some(a=>!(a.status&&Array.isArray(a.reasons)))?await API.get('/coach/attention'):null;
  const attMap={};(at?.data?.athletes||[]).forEach(a=>{attMap[a.id]=a;});
  list.forEach(a=>{const s=athleteStatus(a,attMap);a.status=s.status;a.reasons=s.reasons;if(attMap[a.id]&&a.openFlags==null)a.openFlags=attMap[a.id].openFlags||0;});
  const sorted=sortAthletes(list);
  return{ts:Date.now(),o,list:sorted,role:ME&&ME.role,sig:JSON.stringify([o,sorted])};}
// Der Betreiber ist kein Ueber-Coach mehr (BUILD-A2 Abschnitt 1, RATE-admin H1). Diese Ansicht zeigt
// Gewicht, Schlaf, Beschwerden und Plaene fremder Menschen – ein Admin bekommt sie nicht mehr zu sehen,
// auch nicht „nur zur Ansicht". Ab Paket A-II.2 antwortet GET /api/athletes fuer Admins ohnehin mit 403;
// diese Abzweigung sorgt dafuer, dass hier auch VORHER nichts ausgeliefert wird – und erklaert, warum.
function adNoAthletesHTML(){
  return `<div class="page on" id="athPage">${emptyState({icon:'lock',title:'Keine Athletendaten',
    text:'Du bist als Betreiber angemeldet. Für den Betrieb brauchst du Zahlen, Protokolle und Fehler – keine Gesundheitsdaten. Deshalb steht hier nichts.'})}
    <div class="note status mb-3">Wenn dir ein Athlet eine <b>Hilfe-Freigabe</b> erteilt, findest du sie in der Verwaltung unter „Konten". Sie gilt zeitlich begrenzt und nur lesend – Ändern oder Löschen weist der Server ab –, und jede Nutzung wird protokolliert.</div>
    <button type="button" class="btn sec block" onclick="go('admin')">${icon('settings',18)} Zur Verwaltung</button></div>`;}
async function renderAthletes(v,opts){opts=opts||{};mountCoachHeader();
  if(ME&&ME.role==='admin'){v.innerHTML=adNoAthletesHTML();if(typeof cacheView==='function')cacheView('athletes');return;}
  const fresh=COACH_OV&&(Date.now()-COACH_OV.ts<CACHE_MS)&&COACH_OV.role===(ME&&ME.role);
  if(fresh)drawAthletes(v,COACH_OV);
  else if(!opts.cached)v.innerHTML=`<div class="page on" id="athPage">${skeleton(1,'sm')}${skeleton(4)}</div>`;
  const data=await fetchCoachOverview();
  if(!data){if(document.getElementById('athPage'))v.innerHTML=`<div class="page on" id="athPage">${emptyState({icon:'lock',title:'Kein Zugriff',text:'Diese Seite ist nur für Coaches.'})}</div>`;return;}
  const changed=!COACH_OV||COACH_OV.sig!==data.sig;COACH_OV=data;
  if((changed||!fresh)&&document.getElementById('athPage'))drawAthletes(v,data);
  else ATHLETES_CACHE=data.list;}
// Kennzahl-Zeile aus EINEM Modell (kein zweiter Aufmerksamkeits-Zähler mehr)
function coachStatHTML(list){list=list||[];
  const alerts=list.filter(a=>a.status==='alert').length,watch=list.filter(a=>a.status==='watch').length;
  // „aktiv diese Woche" in derselben Kalenderwoche wie Liste und Kachel (weekGoal.done), nicht im
  // rollenden Sieben-Tage-Fenster – sonst zaehlt die Kopfzeile anders als die Zeilen darunter.
  const active=list.filter(a=>{const w=coWeekGoal(a);return (w?w.done:(a.trainsThisWeek||0))>0;}).length;
  const seg=[`<b>${pl(list.length,'Athlet','Athleten')}</b>`,`${fmtNum(active)} aktiv diese Woche`];
  if(alerts)seg.push(`<b class="tone-red">${pl(alerts,'Alarm','Alarme')}</b>`);
  if(watch)seg.push(`<span class="tone-amber">${fmtNum(watch)} beobachten</span>`);
  if(!alerts&&!watch&&list.length)seg.push(`<span class="tone-green">alle im grünen Bereich</span>`);
  return seg.map(x=>`<span>${x}</span>`).join('');}
function drawCoachStat(){const el=document.querySelector('#athPage .coach-stat');if(el)el.innerHTML=coachStatHTML(ATHLETES_CACHE);}
// B-I.6: Die Seite hat seit 3.0.0 zwei Reiter – „Athleten" (die Liste, unveraendert der Standard)
// und „Diese Woche" (die Review-Inbox, Abschnitt am Dateiende). Der Rumpf steckt deshalb in einem
// eigenen Kasten (#athBody), den der Reiterwechsel austauscht; alles darueber (Kennzahl-Zeile) und
// alles darin bleibt, was es war. Ohne Athleten gibt es keine Reiter: ein leerer Coach braucht
// einen Knopf, keine Ansichtswahl.
function drawAthletes(v,data){const list=data.list||[];ATHLETES_CACHE=list;
  const stat=coachStatHTML(list);
  if(!list.length)RV_TAB='list';
  let h=`<div class="page on${document.getElementById('athPage')?'':' first'}" id="athPage">`;
  // (Bis 2.5.0 stand hier ein „Zur Verwaltung"-Knopf fuer Admins. Ein Admin erreicht diese Liste seit
  //  2.6.0 gar nicht mehr – renderAthletes() biegt vorher ab.)
  h+=`<div class="coach-stat">${stat}</div>`;
  if(list.length)h+=rvTabsHTML();
  h+=`<div id="athBody"${list.length?` role="tabpanel" tabindex="0" aria-labelledby="rvTab-${RV_TAB}"`:''}>${RV_TAB==='week'?rvInboxHTML():coachListHTML()}</div></div>`;
  v.innerHTML=h;
  if(RV_TAB==='week')rvAfterDraw();else drawAthleteList(coachVisibleAthletes());
  if(typeof cacheView==='function')cacheView('athletes');}
// Der Reiter „Athleten": Wort fuer Wort die Seite von 2.9.0, nur als eigene Funktion – damit der
// Reiterwechsel sie ohne einen zweiten Netzaufruf wieder aufbauen kann.
function coachListHTML(){const list=ATHLETES_CACHE||[];
  let h=`<div class="section-label"><span>Athleten</span><span class="sl-r"><button class="btn sm sec" onclick="addAthlete()">${icon('plus',14)} Athlet</button></span></div>`;
  // `value` mitgeben: COACH_QUERY ueberlebt das Neuzeichnen (Reiterwechsel, Rueckkehr in den Tab),
  // das leere Feld tat es nicht – die Liste war gefiltert, und im Suchfeld stand nichts.
  if(list.length>5)h+=`<input class="field ath-search" id="athSearch" type="search" placeholder="Athlet suchen" oninput="filterAthletes(this.value)" value="${esc2(COACH_QUERY)}">`;
  // Filter-Chips ab derselben Schwelle wie die Suche: bei fünf Athleten ist die Liste die Übersicht,
  // ab sechs beginnt das Suchen. Keine Sortier-Maschinerie – vier Chips, die man ohne Erklärung versteht.
  if(list.length>5)h+=`<div class="chip-row wrap co-filters" id="athFilters">${coachFilterChipsHTML(list)}</div>`;
  h+=`<div id="athList"></div>`;
  const inNav=!!(ME&&ME.role==='coach'); // Coach-Navigation hat eigene Tabs für Nachrichten und Vorlagen
  h+=`<div class="section-label"><span>Mehr</span></div><div class="rows mb-4">
    ${inNav?'':`<button type="button" class="row tap ad-row" onclick="coachMessagesSheet()"><span class="r-ic">${icon('mail')}</span><span class="rl">Nachrichten<small>Unterhaltungen je Athlet</small></span></button>`}
    <button type="button" class="row tap ad-row" onclick="coachInsights()"><span class="r-ic">${icon('chartLine')}</span><span class="rl">Einblicke<small>Aktivität, Ziele, jüngste Trainings</small></span></button>
  </div>`;
  return h;}
// ---- Filter + Suche: EIN Sieb, damit sich beide nicht gegenseitig aufheben ----
function coachFilterCount(f){return (ATHLETES_CACHE||[]).filter(a=>coachMatchAthlete(a,f,'')).length;}
function coachMatchAthlete(a,f,q){
  q=q==null?COACH_QUERY:q;f=f||COACH_FILTER;
  if(q&&!String(a.name||'').toLowerCase().includes(q))return false;
  if(f==='alert')return a.status==='alert';
  if(f==='watch')return a.status==='watch';
  if(f==='new')return !a.lastTrain&&!a.lastCheckin; // noch keine einzige Eintragung – braucht einen Start, keinen Alarm
  return true;}
function coachVisibleAthletes(){return (ATHLETES_CACHE||[]).filter(a=>coachMatchAthlete(a));}
function coachFilterChipsHTML(list){list=list||ATHLETES_CACHE||[];
  const defs=[['all','Alle'],['alert','Alarm'],['watch','Beobachten'],['new','Neu']];
  return defs.map(([f,label])=>{const n=coachFilterCount(f);
    return `<button class="chip${COACH_FILTER===f?' on':''}" aria-pressed="${COACH_FILTER===f}" onclick="coachSetFilter('${f}')">${label} ${fmtNum(n)}</button>`;}).join('');}
function coachDrawFilters(){const el=document.getElementById('athFilters');if(el)el.innerHTML=coachFilterChipsHTML();}
// B-I.6: EIN Sieb fuer beide Reiter. rvAfterFilter() zeichnet die Wochen-Karten neu und meldet,
// dass es zustaendig war; im Reiter „Athleten" laeuft alles wie bisher ueber drawAthleteList.
function coachSetFilter(f){COACH_FILTER=f||'all';coachDrawFilters();if(!rvAfterFilter())drawAthleteList(coachVisibleAthletes());}
function filterAthletes(q){COACH_QUERY=(q||'').toLowerCase().trim();if(!rvAfterFilter())drawAthleteList(coachVisibleAthletes());}
/* ==== FIX-A5 · A5-2 / A5-3 / A5-8: die Athletenliste wird am Rechner eine Tabelle ==========
   Drei bestaetigte Befunde, eine Stelle:
   A5-2  Es gab keinen Spaltenkopf und kein Sortier-Bedienelement (`th,[role=columnheader],[data-sort],
         [aria-sort]` -> 0 Treffer). Die Reihenfolge war fest: Alarm zuerst, dann alphabetisch.
   A5-3  j / k / Enter / „/" waren nicht belegt (nur Esc aus shell.js).
   A5-8  Die Kennzahlen standen als EINE Zeichenkette in EINEM <small>; genau in der Alarmzeile –
         der einzigen, die Grund UND Kennzahlen hat – wurde sie gekappt (329 px in 157 px).
   Warum das ohne eine Zeile CSS geht: `public/css/coach.css` gehoert Paket A-V.1. Das Raster
   (`.ath-row .rl` = vier Spalten ab 1024 px) liegt dort fertig. Der Kopf benutzt darum dieselbe
   Klasse `.ath-row` und faellt damit in dasselbe Raster; die Spalten stehen als `grid-column`
   inline, weil sie ohne Raster (Handy) wirkungslos sind.
   Gegen A5-8: die Kennzahlen sind jetzt vier eigene <span data-col> in EINEM <small> (die Spalte 4
   des Rasters bleibt damit unveraendert erhalten), und am Rechner stehen sie in der Kurzform, die
   der Spaltenkopf erklaert („gestern · 1/4 · 81,4 kg" statt „gestern trainiert · 1/4 diese Woche ·
   Muskelaufbau"). Auf dem Handy bleibt Wort fuer Wort der Text von 2.8.0 – dort gibt es keinen Kopf,
   der etwas erklaeren koennte. `title` traegt in beiden Faellen die volle Angabe. */
let CO_SORT={key:'auto',dir:1};
// Die Spalten des Rasters aus coach.css, in genau dieser Reihenfolge. `dir` ist die Richtung, in der
// ein frisch gewaehlter Kopf zuerst sortiert – bei „Zuletzt aktiv" ist das absteigend (der laengst
// Stille zuerst), bei Namen aufsteigend.
const CO_COLS=[['name','Athlet',1,1],['status','Status',2,1],['grund','Grund',3,1],['akt','Zuletzt aktiv',4,-1]];
function coDesktop(){try{return !!(window.matchMedia&&window.matchMedia('(min-width:1024px)').matches);}catch(e){return false;}}
function coSortKeyOf(a,k){
  if(k==='name')return String(a.name||'').toLowerCase();
  if(k==='status')return (ATT_ORDER[a.status]??2);
  if(k==='grund')return -((a.reasons||[]).length);
  if(k==='akt'){ // „nie trainiert" ist die laengste Stille, nicht die kuerzeste – sonst stuende sie vorn
    if(!a.lastTrain)return 1e6;
    const n=Number(a.daysSinceTrain);return Number.isFinite(n)?n:1e6;}
  return 0;}
function coSortApply(list){
  list=list||[];
  if(CO_SORT.key==='auto')return list.slice();   // Alarm zuerst, dann alphabetisch (sortAthletes, wie bisher)
  const k=CO_SORT.key,d=CO_SORT.dir;
  return list.slice().sort((a,b)=>{
    const x=coSortKeyOf(a,k),y=coSortKeyOf(b,k);
    let r=0;
    if(typeof x==='string')r=x.localeCompare(String(y),'de',{numeric:true});
    else r=(x<y?-1:x>y?1:0);
    // Gleichstand immer nach Namen – sonst springt die Liste bei jedem Neuzeichnen anders.
    return (d*r)||String(a.name||'').localeCompare(String(b.name||''),'de',{numeric:true});});}
// Drei Zustaende je Kopf: erste Richtung, Gegenrichtung, zurueck zur Grundordnung (Alarm zuerst).
// Ohne den dritten Druck gaebe es keinen Weg zurueck – und die Grundordnung ist die, die dem Coach
// zuerst zeigt, wer seine Aufmerksamkeit braucht.
function coSortBy(k){
  const col=CO_COLS.find(c=>c[0]===k);if(!col)return;
  const def=col[3]||1;
  if(CO_SORT.key!==k)CO_SORT={key:k,dir:def};
  else if(CO_SORT.dir===def)CO_SORT={key:k,dir:-def};
  else CO_SORT={key:'auto',dir:1};
  drawAthleteList(coachVisibleAthletes());
  const h=document.querySelector('#athList .co-thead [data-sort="'+k+'"]');if(h)try{h.focus({preventScroll:true});}catch(e){}}
function coSortHeadHTML(){
  if(!coDesktop())return '';
  const cell=([k,label,col])=>{
    const on=CO_SORT.key===k;
    const arrow=on?(CO_SORT.dir>0?' ↑':' ↓'):'';
    return `<button type="button" role="columnheader" data-sort="${k}" aria-sort="${on?(CO_SORT.dir>0?'ascending':'descending'):'none'}"
      class="co-sort${on?' on':''}" onclick="coSortBy('${k}')"
      style="grid-column:${col};${col===4?'justify-self:end;':'justify-self:start;'}background:none;border:0;padding:6px 5px;margin-inline:-5px;min-height:44px;cursor:pointer;font:600 var(--t-sm)/1.2 var(--font);color:var(--${on?'ink':'ink2'});letter-spacing:var(--track)"
      title="Nach ${esc(label)} sortieren – noch einmal drücken kehrt um, ein drittes Mal stellt „Alarm zuerst“ wieder her">${esc2(label)}${arrow}</button>`;};
  // B-I.6: 32 px Spaltenkopf waren vier Tippziele unter dem 44-px-Ziel des Hauses – gemessen bei
  // 1280 px (B16-probe-1280.json), wo a11y.mjs nicht hinsieht (es misst 390 px, dort gibt es den
  // Kopf nicht). 44 px kosten zwoelf Pixel Kopfzeile und sind der einzige Ort, an dem diese Ansicht
  // unter der Hausregel lag.
  return `<div class="row ath-row co-thead" style="min-height:44px;border-bottom:.5px solid var(--hairline2)">
    <span class="ath-av" aria-hidden="true" style="visibility:hidden"></span>
    <span class="rl">${CO_COLS.map(cell).join('')}</span>
    <span aria-hidden="true" style="flex:0 0 16px"></span></div>`;}
// Die Kopfzeile gibt es nur ab 1024 px. Wechselt die Breite (Fenster ziehen, Geraet drehen), muss die
// Liste neu gezeichnet werden – sonst steht der Kopf auf dem Handy quer oder fehlt am Rechner.
try{
  const _coMq=window.matchMedia&&window.matchMedia('(min-width:1024px)');
  if(_coMq){const _coOn=()=>{if(document.getElementById('athList'))drawAthleteList(coachVisibleAthletes());};
    if(_coMq.addEventListener)_coMq.addEventListener('change',_coOn);else if(_coMq.addListener)_coMq.addListener(_coOn);}
}catch(e){}
// ---- A5-3 · Tastatur auf der Athletenliste: j / k / Enter / „/" ----
// Enter braucht keinen eigenen Zweig: die Zeilen SIND <button>, der Browser loest sie selbst aus,
// sobald der Fokus auf ihnen steht. j/k setzen also nur den Fokus – damit greift auch der Fokusring
// aus app.css von selbst, ohne eine zweite Markierungs-Mechanik daneben.
function coAthKey(e){
  if(e.altKey||e.ctrlKey||e.metaKey||e.defaultPrevented)return;
  const el=document.getElementById('athList');if(!el)return;
  if(typeof sheetOpen==='function'&&sheetOpen())return;      // im Dialog gehoert die Tastatur dem Dialog
  const t=e.target,tag=t&&t.tagName?String(t.tagName).toLowerCase():'';
  const typing=tag==='input'||tag==='textarea'||tag==='select'||!!(t&&t.isContentEditable);
  if(e.key==='/'){
    const s=document.getElementById('athSearch');
    if(typing||!s)return;
    e.preventDefault();                                       // sonst landet der Schraegstrich im Feld
    try{s.focus({preventScroll:false});s.select();}catch(_){}
    return;}
  if(typing||(e.key!=='j'&&e.key!=='k'))return;
  const rows=Array.prototype.slice.call(el.querySelectorAll('.rows .ath-row'));
  if(!rows.length)return;
  e.preventDefault();
  const cur=(t&&t.closest)?rows.indexOf(t.closest('.ath-row')):-1;
  let i=cur<0?(e.key==='j'?0:rows.length-1):cur+(e.key==='j'?1:-1);
  i=Math.max(0,Math.min(rows.length-1,i));
  try{rows[i].focus({preventScroll:true});rows[i].scrollIntoView({block:'nearest'});}catch(_){}}
document.addEventListener('keydown',coAthKey);

function drawAthleteList(list){const el=document.getElementById('athList');if(!el)return;
  if(!list.length){
    el.innerHTML=!(ATHLETES_CACHE||[]).length
      ? emptyState({icon:'users',title:'Noch keine Athleten',text:'Lege einen Athleten an oder ordne dir einen bestehenden zu.',btn:{label:'Athlet hinzufügen',onclick:'addAthlete()'}})
      : (COACH_FILTER!=='all'&&!COACH_QUERY
        ? emptyState({icon:'filter',title:'Niemand in diesem Filter',text:COACH_FILTER==='alert'?'Kein Athlet steht gerade auf Alarm – das ist eine gute Nachricht.':COACH_FILTER==='watch'?'Kein Athlet steht auf Beobachten.':'Kein Athlet ohne erste Eintragung.',btn:{label:'Alle zeigen',onclick:"coachSetFilter('all')"}})
        : emptyState({icon:'search',title:'Kein Treffer',text:'Kein Athlet passt zu deiner Suche.'}));return;}
  list=coSortApply(list);
  const desk=coDesktop();
  el.innerHTML=coSortHeadHTML()+`<div class="rows mb-3">`+list.map(a=>{
    const st=a.status||'ok';const reasons=a.reasons||[];
    const statusTxt=a.lastTrain?(a.daysSinceTrain===0?'heute trainiert':a.daysSinceTrain===1?'gestern trainiert':'Training '+daysAgoTxt(a.lastTrain)):'noch kein Training';
    // FIX-A5 A5-8: Am Rechner erklaert der Spaltenkopf, was die Zahl bedeutet – dort reicht die
    // Kurzform, und genau sie ist der Unterschied zwischen 329 px (gekappt) und rund 150 px (ganz).
    const statusShort=a.lastTrain?(a.daysSinceTrain===0?'heute':a.daysSinceTrain===1?'gestern':(Number.isFinite(Number(a.daysSinceTrain))?pl(Number(a.daysSinceTrain),'Tag','Tage'):daysAgoTxt(a.lastTrain))):'nie';
    // Nie zweimal dieselbe Aussage: sagt der Grund schon „noch kein Training geloggt", fallen „noch kein
    // Training" und „0/3 diese Woche" aus der Unterzeile – sonst steht es dreimal untereinander (RATE-coach, Design).
    const noTrain=reasons.some(r=>/kein Training/i.test(r));
    // „diese Woche" heisst hier dieselbe Kalenderwoche wie beim Athleten: 3/3 statt „3× diese Woche"
    // (das war das rollende Sieben-Tage-Fenster und stand neben einem anderen Wochenziel im Sheet).
    const rw=coWeekGoal(a);
    const weekTxt=rw?`${fmtNum(rw.done)}/${fmtNum(rw.target)} diese Woche`:(a.trainsThisWeek||0)+'× diese Woche';
    const weekShort=rw?`${fmtNum(rw.done)}/${fmtNum(rw.target)}`:(a.trainsThisWeek||0)+'×';
    const weekDone=rw?rw.done:(a.trainsThisWeek||0);
    // Vier Angaben, vier eigene Elemente (DEFER V1-2): `data-col` ist der Anschluss, an dem A-V.1
    // sie spaeter in eigene Rasterspalten legen kann, ohne dass hier noch einmal etwas zerlegt wird.
    // „Ziel" faellt am Rechner weg: es ist eine Stammangabe, keine Kennzahl der Woche, und es war
    // das Stueck, an dem die Alarmzeile zerbrach. Im Inspektor steht es weiterhin.
    const cols=[['akt',noTrain?'':(desk?statusShort:statusTxt)],
      ['week',(noTrain&&!weekDone)?'':(desk?weekShort:weekTxt)],
      ['goal',desk?'':(a.goal?goalLabel(a.goal):'')],
      ['kg',a.lastWeight!=null?fmtNum(a.lastWeight,1)+' kg':'']].filter(c=>c[1]);
    const sub=cols.map((c,i)=>`${i?'<span aria-hidden="true"> · </span>':''}<span data-col="${c[0]}">${esc2(c[1])}</span>`).join('');
    // Die volle Angabe bleibt erreichbar, auch wenn die Spalte am Rechner enger ist als der Text.
    const full=[noTrain?'':statusTxt,(noTrain&&!weekDone)?'':weekTxt,
      a.goal?goalLabel(a.goal):'',a.lastWeight!=null?fmtNum(a.lastWeight,1)+' kg':''].filter(Boolean).join(' · ');
    return `<button type="button" class="row tap ad-row ath-row" onclick="openDashboard(${a.id})">${athAvatar(a.id,a.name)}
      <span class="rl">${esc2(a.name)}${st!=='ok'?attPill(st):''}${reasons.length?`<small class="reason ${st}">${reasonLine(reasons)}</small>`:''}<small${full?` title="${esc(full)}"`:''}>${sub}</small></span></button>`;}).join('')+`</div>`;
  loadAthAvatars(list.filter(a=>a.has_avatar).map(a=>a.id));}
// Alter Name: lud die separate Ampel-Box – heute Teil der einen Liste (neu laden + zeichnen)
async function loadAttention(){COACH_OV=null;const v=document.getElementById('views');if(document.getElementById('athPage')&&v)return renderAthletes(v);}
// Einblicke (Chart, Ziel-Verteilung, jüngste Aktivität) – aus der Seite in ein Sheet
function coachInsights(){const o=COACH_OV?.o||{};let h='';
  if(o.weeklyTrend&&o.weeklyTrend.some(x=>x>0))h+=`<div class="chart-card"><div class="ch-h"><div class="t">Trainings-Aktivität</div><div class="v">letzte 8 Wochen</div></div>${barchart(o.weeklyTrend)}</div>`;
  const gc=o.goalCounts||{};const totalG=(gc.muscle||0)+(gc.fatloss||0)+(gc.health||0);
  if(totalG>0){const gbar=(label,n,cls)=>{const pct=totalG?Math.round(n/totalG*100):0;return `<div class="gbar"><div class="gl"><span>${label}</span><span>${fmtNum(n)}</span></div><div class="bar${cls?' '+cls:''}"><i style="width:${pct}%"></i></div></div>`;};
    h+=`<div class="card mb-3"><div class="h3 mb-3">Ziele deiner Athleten</div>${gbar('Muskelaufbau',gc.muscle||0,'')}${gbar('Definition',gc.fatloss||0,'amber')}${gbar('Gesundheit',gc.health||0,'green')}</div>`;}
  if(o.recentActivity&&o.recentActivity.length){h+=`<div class="section-label"><span>Jüngste Aktivität</span></div><div class="rows mb-3">`+
    o.recentActivity.map(a=>`<div class="row"><div class="rl">${esc2(a.name)}<small>${esc2(a.dayName||'Training')} · ${fmtDate(a.date,{weekday:'short'})}</small></div><div class="rr">${pl(a.sets,'Satz','Sätze')}</div></div>`).join('')+`</div>`;}
  if(!h)h=emptyState({icon:'chartLine',title:'Noch keine Einblicke',text:'Sobald deine Athleten trainieren, siehst du hier Aktivität und Ziele.'});
  openSheet('Einblicke',h);}
function addAthlete(){openSheet('Athlet hinzufügen',`
  <div class="seg"><button id="aa_new" class="on" onclick="aaTab('new')">Neu anlegen</button><button id="aa_link" onclick="aaTab('link')">Bestehenden</button></div>
  <div id="aaBody"></div>`);aaTab('new');}
function aaTab(t){document.getElementById('aa_new').classList.toggle('on',t==='new');document.getElementById('aa_link').classList.toggle('on',t==='link');
  const b=document.getElementById('aaBody');
  if(t==='new')b.innerHTML=`<div class="note mb-4">Lege direkt einen neuen Athleten an. Lass das Passwortfeld <b>leer</b> – du bekommst einen Einladungslink zum Weitergeben, und dein Athlet setzt sein Passwort selbst. Du kennst es dann nie.</div>
    <div class="field"><label for="na_name">Name</label><input id="na_name" placeholder="Vor- und Nachname" maxlength="80"></div>
    <div class="field"><label for="na_email">E-Mail</label><input id="na_email" type="email" inputmode="email" autocomplete="off" placeholder="athlet@mail.com"></div>
    ${pwField({id:'na_pw',label:'Startpasswort (optional)',autocomplete:'new-password',placeholder:'leer lassen = Einladungslink',hint:true})}
    <button class="btn block" onclick="confirmCreateAthlete()">Athlet anlegen</button>`;
  else b.innerHTML=`<div class="note mb-4">Der Athlet hat sich bereits selbst registriert. Gib seine E-Mail ein, um ihn dir zuzuordnen.</div>
    <div class="field"><label>E-Mail</label><input id="addEmail" type="email" inputmode="email" placeholder="athlet@mail.com"></div>
    <button class="btn block" onclick="confirmAddAthlete()">Zuordnen</button>`;}
// Passwort optional (BUILD-A2 §4 Punkt 11): leer = Einladungslink. `password` geht nur mit, wenn
// wirklich eines getippt wurde – ein leerer String würde den Link-Zweig des Servers verfehlen.
async function confirmCreateAthlete(){const pw=val('na_pw');
  const body={name:val('na_name'),email:val('na_email')};
  if(pw)body.password=pw;
  if(!body.name)return showFieldErr('aaBody','Bitte einen Namen eingeben.','na_name');
  if(!body.email)return showFieldErr('aaBody','Bitte eine E-Mail eingeben.','na_email');
  if(pw&&pw.length<8)return showFieldErr('aaBody','Mindestens 8 Zeichen – oder das Feld leer lassen, dann gibt es einen Einladungslink.','na_pw');
  const r=await API.post('/athletes/create',body);
  if(r.status!==200)return showFieldErr('aaBody',r.data?.error||'Fehler');
  coachInvalidate();go('athletes');
  if(pw){closeModal();toast('Athlet angelegt ✓');return;}
  coInviteSheet('Athlet angelegt',r.data,body.name);}
async function confirmAddAthlete(){const email=val('addEmail');if(!email)return showFieldErr('aaBody','Bitte eine E-Mail eingeben.','addEmail');
  const r=await API.post('/athletes/add',{email});
  if(r.status===200){closeModal();toast('Zugeordnet ✓');coachInvalidate();go('athletes');}else showFieldErr('aaBox'in window?'aaBody':'aaBody',r.data?.error||'Fehler','addEmail');}
// Alter Einstieg: Athlet direkt „betreten" (= Home im Athleten-Kontext)
async function openAthlete(id,name){return coachOpenView(id,name||athName(id),'home');}

// ===== COACH: DASHBOARD EINES ATHLETEN =====
// GET /api/dashboard/:id + /api/flagged-notes/:id. Beide Routen sind Coach-Routen: 403 heißt entweder
// „nicht als Coach/Admin angemeldet" (Sitzung gewechselt) oder „dieser Athlet gehört dir nicht"
// (users.coach_id ≠ eigene id bzw. Konto gelöscht). Den Status merken, damit die Aufrufer ehrlich texten können.
async function loadDashboard(id){const [r,fn]=await Promise.all([API.get('/dashboard/'+id),API.get('/flagged-notes/'+id)]);
  loadDashboard.lastStatus=r.status;
  if(r.status!==200)return null;const d=r.data;const flagged=fn.data?.notes||[];COACH_DASH[id]={ts:Date.now(),d,flagged};return COACH_DASH[id];}
async function coachAiStatus(){if(AI_STATUS)return AI_STATUS;const r=await API.get('/ai/status');
  AI_STATUS=r.status===200&&r.data?{configured:!!r.data.configured,cooldownSec:r.data.cooldownSec||0}:{configured:null,cooldownSec:0};return AI_STATUS;}

// ===== KENNZAHL-REIHE IM ATHLETEN-SHEET (B4) =====
// Der Coach bekam bisher Zustand („78,4 kg · Training vor 2 Tagen"), aber keine Analyse. Die vier Kacheln
// zeigen NUR, was ohnehin im Payload von GET /api/dashboard/:id steht (sessions, checkins, weights,
// athlete.days_per_week) bzw. in der Listenzeile aus GET /api/athletes (weekGoal, trainsThisWeek) – hier
// wird kein zweites Bewertungsmodell gerechnet, nur abgelesen, verglichen und beschriftet.
//
// Compliance ist ein TOLERANZBAND, keine Schulnote: 80–120 % ist der Plan (ein Training mehr oder weniger ist
// Trainingsalltag, keine Verfehlung), 50–80 % und 120–150 % sind ein Hinweis, unter 50 % ist ein Ausfall.
// Der Athlet sieht diese Prozentzahl bewusst nie – er sieht „Erledigt 3/4".
function coachKpiTone(pct){if(pct==null||isNaN(pct))return '';
  if(pct>=80&&pct<=120)return 'green';
  if(pct<50)return 'red';
  return 'amber';}
function coachKpiBand(pct){if(pct==null||isNaN(pct))return '';
  if(pct>=80&&pct<=120)return 'im Plan';
  if(pct<50)return 'weit unter Plan';
  if(pct<80)return 'unter Plan';
  if(pct<=150)return 'über Plan';
  return 'weit über Plan';}
// Fusszeile einer Kachel: Pfeil + der Vorwochenwert im Klartext. Bewusst grau – die eine Farbe je Kachel
// steckt oben im Wert, ein zweites Signal darunter wuerde nur streiten.
function coachKpiFoot(cur,prev,label){
  if(cur==null||prev==null)return '';
  const d=cur-prev,ic=d>0?'trendUp':d<0?'trendDown':'trendFlat';
  return `<div class="trend flat">${icon(ic,14)} ${esc2(label||'Vorwoche')} ${fmtNum(prev)}</div>`;}
function coachKpiHTML(d,listRow){
  d=d||{};const a=d.athlete||{},se=d.sessions||[],ch=d.checkins||[],we=d.weights||[];
  // Zeilen in einem Tagesfenster zaehlen (0 = heute). daysSince() liefert null fuer unlesbare Daten.
  const inWin=(rows,from,to)=>rows.filter(r=>{const n=daysSince(r.date);return n!=null&&n>=from&&n<=to;}).length;
  // Der Payload ist gedeckelt (sessions 10, checkins 14, weights 30). Ein Vorwochen-Vergleich wird nur gezeigt,
  // wenn das Fenster nachweislich vollstaendig im Payload liegt – sonst waere der Pfeil eine Erfindung.
  const covers=(rows,limit,days)=>rows.length<limit||rows.some(r=>{const n=daysSince(r.date);return n!=null&&n>=days;});
  const tile=(label,value,reason,tone,foot)=>`<div class="tile co-kpi">
    <div class="v">${value}</div><div class="l">${esc2(label)}</div>
    <div class="kr${tone?' tone-'+tone:''}">${esc2(reason)}</div>${foot||''}</div>`;
  // 1) Trainings: Ist gegen den Wochenplan – in DERSELBEN Woche, die der Athlet sieht.
  //    Erste Wahl ist `weekGoal` aus GET /api/athletes: Kalenderwoche Montag–Sonntag, Ziel = die
  //    Trainingsplaetze des Rhythmus dieser Woche, Erledigt = Tage mit echten Saetzen seit Montag.
  //    Das ist Zahl fuer Zahl das, was auf der Startseite des Athleten steht („Woche 3/3").
  //    Ohne Listenzeile (Tiefenlink) traegt GET /api/dashboard/:id dasselbe Feld – zweite Quelle, gleiche Zahl.
  //    Rueckfall (alter Server, beide Felder fehlen): rollende sieben Tage gegen die stufenlose
  //    Rate `plannedPerWeek` – dann sagt die Beschriftung auch „7 Tage" statt „diese Woche", damit
  //    niemand zwei verschiedene Fenster fuer dieselbe Ueberschrift haelt.
  const wg=coWeekGoal(listRow)||coWeekGoal(d);
  let t1;
  if(wg){
    // Wortlaut wie beim Athleten („Wochenziel erreicht"), die Prozentzahl behaelt nur der Coach –
    // sie ist sein Toleranzband, nicht die Schulnote des Athleten.
    // Und: eine LAUFENDE Woche ist keine verfehlte Woche. Am Dienstag stuenden sonst alle auf „33 % ·
    // weit unter Plan" (rot), obwohl noch fuenf Tage offen sind. Solange das Ziel rechnerisch noch
    // erreichbar ist, zaehlt die Kachel nur, was offen ist; erst wenn die verbleibenden Tage nicht mehr
    // reichen, wird aus dem Rueckstand ein Befund mit Prozentzahl und Band.
    const wPct=Math.round(wg.done/wg.target*100),miss=wg.target-wg.done;
    const left=coDaysLeftInWeek(wg.weekStart);
    let wReason,wTone;
    if(miss<=0){wReason='Wochenziel erreicht'+(miss<0?' · '+pl(-miss,'Einheit','Einheiten')+' mehr':'');wTone=coachKpiTone(wPct);}
    else if(left!=null&&miss<=left){wReason=pl(miss,'Training','Trainings')+' offen · noch '+pl(left,'Tag','Tage');wTone='';}
    else {wReason=wPct+' % · '+coachKpiBand(wPct);wTone=coachKpiTone(wPct);}
    t1=tile('Trainings · diese Woche',`${fmtNum(wg.done)}<em>/${fmtNum(wg.target)}</em>`,
      wReason,wTone,coachKpiFoot(wg.done,coPrevWeekDone(se,wg.weekStart)));
  }else{
    const target=coPlannedRate(a,listRow);
    const trainCur=(listRow&&listRow.trainsThisWeek!=null)?Number(listRow.trainsThisWeek):inWin(se,0,6);
    const trainPrev=covers(se,10,13)?inWin(se,7,13):null;
    const tPct=target?Math.round(trainCur/target*100):null;
    t1=tile('Trainings · 7 Tage',`${fmtNum(trainCur)}<em>/${coRateTxt(target)}</em>`,
      tPct!=null?tPct+' % · '+coachKpiBand(tPct):'Kein Wochenziel gesetzt',
      tPct!=null?coachKpiTone(tPct):'',coachKpiFoot(trainCur,trainPrev));
  }
  // 2) Check-ins der sieben ABGESCHLOSSENEN Tage (gestern zurueck). Der heutige Tag zaehlt nicht als
  //    verpasst, solange er laeuft – sonst stuende jeder Athlet jeden Vormittag auf 6/7.
  const ciCur=inWin(ch,1,7),ciPrev=covers(ch,14,14)?inWin(ch,8,14):null;
  const ciPct=Math.round(ciCur/7*100);
  const t2=tile('Check-ins · 7 Tage',`${fmtNum(ciCur)}<em>/7</em>`,
    ciCur===7?'jeden Tag':ciCur===0?'kein einziger':'an '+ciCur+' von 7 Tagen',
    coachKpiTone(ciPct),coachKpiFoot(ciCur,ciPrev));
  // 3) Gewicht: Veraenderung ueber rund 14 Tage. Bewusst ohne Ampel – ob −0,4 kg gut oder schlecht sind,
  //    entscheidet das Ziel des Athleten, nicht die Kachel.
  let t3;
  const w0=we[0],n0=w0?daysSince(w0.date):null;
  if(w0&&n0!=null){
    const ref=we.find(x=>{const n=daysSince(x.date);return n!=null&&n-n0>=14;})||we[we.length-1];
    const span=ref&&ref!==w0?daysSince(ref.date)-n0:0;
    if(span>=7&&ref.weight!=null&&w0.weight!=null){const dlt=w0.weight-ref.weight;
      t3=tile('Gewicht · '+pl(span,'Tag','Tage'),`${dlt>0?'+':dlt<0?'−':'±'}${fmtNum(Math.abs(dlt),1)}<em> kg</em>`,
        'jetzt '+fmtNum(w0.weight,1)+' kg','');}
    else t3=tile('Gewicht',`${fmtNum(w0.weight,1)}<em> kg</em>`,'Noch kein Vergleichswert','');
  } else t3=tile('Gewicht','–','Noch keine Waage-Werte','');
  // 4) Erholung: HRV, sonst Ruhepuls. Der Vergleich laeuft gegen den Schnitt der Werte davor – ein einzelner
  //    HRV-Wert sagt fuer sich genommen nichts.
  let t4;
  const hrv=ch.filter(x=>x.hrv!=null),rhr=ch.filter(x=>x.resting_hr!=null);
  const meanOf=(rows,key)=>rows.length?rows.reduce((s,x)=>s+Number(x[key]),0)/rows.length:null;
  if(hrv.length){const cur=Number(hrv[0].hrv),avg=meanOf(hrv.slice(1,8),'hrv');
    const word=avg==null?'Erster Wert':cur>avg+1?'über dem Schnitt':cur<avg-1?'unter dem Schnitt':'wie der Schnitt';
    t4=tile('HRV'+(rhr.length?' · Ruhepuls '+fmtNum(rhr[0].resting_hr):''),`${fmtNum(cur)}<em> ms</em>`,
      avg!=null?word+' ('+fmtNum(avg)+')':word,'',coachKpiFoot(cur,avg!=null?Math.round(avg):null,'Schnitt 7 Tage'));}
  else if(rhr.length){const cur=Number(rhr[0].resting_hr),avg=meanOf(rhr.slice(1,8),'resting_hr');
    t4=tile('Ruhepuls',`${fmtNum(cur)}<em> /min</em>`,avg==null?'Erster Wert':'Schnitt 7 Tage: '+fmtNum(avg),'',
      coachKpiFoot(cur,avg!=null?Math.round(avg):null,'Schnitt 7 Tage'));}
  else t4=tile('Erholung','–','Noch keine HRV- oder Puls-Werte','');
  return `<div class="tiles co-kpis">${t1}${t2}${t3}${t4}</div>`;}
async function openDashboard(id,opts){opts=opts||{};
  const top=SHEET_STACK.length?SHEET_STACK[SHEET_STACK.length-1].title:null;
  const openAgain=!!(opts.replace&&top&&(top===athName(id)||top===COACH_DASH[id]?.d?.athlete?.name));
  if(!openAgain)openSheet('Lädt…','<div class="spinner"></div>');
  const [c,ai]=await Promise.all([loadDashboard(id),coachAiStatus()]);
  if(!c){if(!openAgain)closeModal();const s=loadDashboard.lastStatus;
    return toast(s===403||s===401?'Kein Coach-Zugriff auf diesen Athleten':'Fehler beim Laden');}
  const d=c.d,a=d.athlete,flagged=c.flagged;const listRow=(ATHLETES_CACHE||[]).find(x=>x.id===id);
  const st=listRow?athleteStatus(listRow):attentionStatusClient({daysSinceCheckin:daysSince(d.checkins[0]?.date),daysSinceTraining:daysSince(d.sessions[0]?.date),openFlags:flagged.length,daysPerWeek:coDpw(a)});
  const status=st.status||st.level,reasons=st.reasons||[];
  const lastW=d.weights[0]?.weight;const lastTrain=d.sessions[0]?.date;
  // Die Frequenz-Pille zeigt dieselbe Rate wie die Kennzahl-Kachel darunter – sonst stuende „4×/Woche"
  // direkt ueber „3/4,7" und der Coach haette zwei Zahlen fuer dieselbe Sache.
  const rate=coPlannedRate(a,listRow);
  // A-IV.7: die Stufen-Pille zeigt die WIRKSAME Stufe (`experience_coach` schlaegt `experience`) – dieselbe
  // Rangfolge, nach der sich die Trainingsansicht des Athleten richtet. Bis 2.7.0 stand hier die reine
  // Selbstangabe: hatte der Coach uebersteuert, log die Pille. Ein Stern markiert die Uebersteuerung,
  // ausgeschrieben steht sie eine Zeile tiefer in „Stufe & Funktionen".
  const pills=[a.goal?goalLabel(a.goal):'',phaseLabel(a.phase)||'keine Phase',rate!=null?coRateLabel(rate):'',
    expLabel(co2LevelOf(a))+(a.experience_coach?' ∗':'')].filter(Boolean);
  let h=`<div class="dash-head">${athAvatar(id,a.name,'lg')}<div class="fill"><div class="dash-pills">${pills.map(t=>`<span class="pill neutral">${esc2(t)}</span>`).join('')}</div></div></div>`;
  // Gründe, die der Beschwerden-Block ohnehin zeigt, hier weglassen (nie zweimal dieselbe Aussage)
  const factReasons=flagged.length?reasons.filter(r=>!/Beschwerde/i.test(r)):reasons;
  const fseg=[attPill(status)+(factReasons.length?' '+esc2(factReasons.join(' · ')):''),`<b>${lastW!=null?fmtNum(lastW,1)+' kg':'– kg'}</b>`,`Training ${esc2(daysAgoTxt(lastTrain))}`];
  h+=`<div class="dash-facts">${fseg.map(x=>`<span>${x}</span>`).join('')}</div>`;
  // Kennzahl-Reihe (B4): erst die Analyse, dann die Aufgaben. Werte kommen aus demselben Payload.
  h+=coachKpiHTML(d,listRow);
  // Offene Beschwerden – jede mit drei Handlungen: an der Uebung ansetzen, antworten, abhaken (mit Undo).
  // Ohne die ersten beiden endete der Alarm bisher im „abhaken", ohne dass der Athlet je eine Antwort bekam.
  if(flagged.length)h+=`<div class="complaints" id="complaints"><div class="ct">${icon('alertTriangle',18)}<span id="complaintsT">${pl(flagged.length,'offene Beschwerde','offene Beschwerden')}</span></div>`+
    flagged.map(n=>`<div class="complaint" id="cmp-${n.id}"><div class="cm">${esc2(n.exercise_name)} · ${fmtDate(n.date)}</div><div class="cb">${esc2(n.note)}</div>
      <div class="cmp-acts">
        ${n.exercise_id?`<button class="btn sm sec" onclick="coachFixExercise(${id},'${esc(a.name)}',${n.exercise_id})">${icon('pencil',14)} Übung tauschen</button>`:''}
        <button class="btn sm sec" onclick="coachReplyComplaint(${id},'${esc(a.name)}',${n.id})">${icon('mail',14)} Antworten</button>
        <button class="btn sm sec" onclick="coachResolveNote(${n.id},${id},this)">${icon('check',14)} Erledigt</button>
      </div></div>`).join('')+`</div>`;
  h+=`<div class="coach-pair"><button class="btn" onclick="coachOpenPlan(${id},'${esc(a.name)}')">${icon('pencil',18)} Plan bearbeiten</button><button class="btn sec" onclick="openThread(${id},'${esc(a.name)}')">${icon('mail',18)} Nachricht</button></div>`;
  const row=(ic,label,sub,onclick)=>`<button type="button" class="row tap ad-row" onclick="${onclick}"><span class="r-ic">${icon(ic)}</span><span class="rl">${label}${sub?`<small>${sub}</small>`:''}</span></button>`;
  h+=`<div class="section-label"><span>Ansehen</span></div><div class="rows mb-4">`+
    row('user',`Als ${esc2(a.name.split(' ')[0])} ansehen`,'Home, Training, Ernährung, Mindset und Analyse im Athleten-Kontext',`coachOpenView(${id},'${esc(a.name)}','home')`)+
    row('chartLine','Volle Analyse','Körper und Training in Zahlen',`coachOpenView(${id},'${esc(a.name)}','tracker')`)+
    // A-IV.7: Der KI-Schalter des Athleten steht seit 2.6.0 standardmaessig auf AUS – bis hierher erfuhr
    // der Coach das erst NACH dem Tippen, als 403. Ist der Zustand bekannt, steht er in der Unterzeile.
    (ai.configured!==false?row('sparkles','KI-Analyse',(()=>{const st=co2AiState(a);
      return st===false?'Nicht freigegeben – nur '+esc2(a.name.split(' ')[0])+' selbst kann das ändern'
        :st===true?'Freigegeben · Zweitmeinung aus Trainings- und Check-in-Daten'
        :'Zweitmeinung aus Trainings- und Check-in-Daten';})(),`aiSummary(${id})`):'')+`</div>`;
  h+=`<div class="section-label"><span>Verwalten</span></div><div class="rows mb-4">`+
    // A-IV.7: die Stufe war eine tote Pille. Hier wird sie gesetzt – und daneben steht in einem Satz,
    // was sich dadurch in der App des Athleten aendert (RIR-Feld, Satztypen, Tiefe).
    row('settings','Stufe &amp; Funktionen',esc2(co2LevelSummary(a)),`co2LevelSheet(${id},'${esc(a.name)}')`)+
    // D10: Dieselbe Zahl wie in der Kennzahl-Zeile der Übersicht (coKcalTargetTx) – zuerst die, nach der
    // der Athlet wirklich isst, dann das gespeicherte Ziel. Zwei Zahlen auf einem Bildschirm sind nur so
    // lange verwirrend, wie nicht dabeisteht, welche welche ist.
    (()=>{const K=coKcalTargetTx(d,a);
      const sv=a.kcal_target_train?fmtNum(a.kcal_target_train)+' / '+fmtNum(a.kcal_target_rest||0)+' kcal':'nicht gesetzt';
      return row('target','Phase &amp; Ziele',d.kcalAsk?`${K.rr} gerechnet · gespeichert ${sv}`:K.rr,`coachPhaseSheet(${id})`);})()+
    row('trophy','Monatsziel','Trainings, Check-ins und Volumen im Monat',`coachMonthlyGoal(${id},'${esc(a.name)}')`)+
    row('pill','Supplements','Zuweisen, Pflicht und Dosierung',`coachSupp(${id},'${esc(a.name)}')`)+
    row('fileSpreadsheet','Aus Excel importieren','Plan aus einer .xlsx-Datei übernehmen',`openImport(${id},'${esc(a.name)}')`)+
    row('camera','Fortschrittsfotos','',`openPhotos(${id})`)+`</div>`;
  if(d.weights.length>=2){const w=d.weights.slice().reverse().map(x=>x.weight);const sp=typeof sparkline==='function'?sparkline(w):'';
    h+=`<div class="section-label"><span>Gewichtsverlauf</span></div><div class="chart-card">${sp}<div class="chart-foot"><span>${fmtNum(w[0],1)} kg</span><span>jetzt: ${fmtNum(w[w.length-1],1)} kg</span></div></div>`;}
  if(d.volume.length>=2){const vol=d.volume.slice().reverse().map(x=>x.tonnage);
    h+=`<div class="section-label"><span>Trainingsvolumen</span><span class="sl-r">kg je Einheit</span></div><div class="chart-card">${barchart(vol)}</div>`;}
  h+=`<div class="section-label"><span>Letzte Trainings</span></div>`;
  if(!d.sessions.length)h+=`<div class="note status mb-4">Noch keine Trainings geloggt.</div>`;
  else h+=`<div class="rows mb-4">`+d.sessions.map(s=>`<div class="row sess-row"><div class="rl">${esc2(s.dayName||'Training')}<small>${fmtDate(s.date,{weekday:'short'})}</small></div><div class="rr">${pl(s.exCount,'Übung','Übungen')} · ${pl(s.setCount,'Satz','Sätze')}${s.topWeight?`<small class="caption">Top ${fmtNum(s.topWeight)} kg</small>`:''}</div></div>`).join('')+`</div>`;
  if(d.cardio.length)h+=`<div class="section-label"><span>Cardio</span><span class="sl-r">14 Tage</span></div><div class="rows mb-4">`+d.cardio.map(cd=>`<div class="row"><div class="rl">${esc2(cd.kind)}<small>${fmtDate(cd.date)}</small></div><div class="rr">${fmtNum(cd.minutes)} min · ${fmtNum(cd.kcal||0)} kcal</div></div>`).join('')+`</div>`;
  const withData=d.checkins.filter(x=>x.sleep||x.steps);
  if(withData.length)h+=`<div class="section-label"><span>Schlaf &amp; Schritte</span></div><div class="rows mb-4">`+withData.slice(0,7).map(x=>{const p=[];if(x.sleep)p.push(fmtNum(x.sleep,1)+' h');if(x.steps)p.push(fmtNum(Math.round(x.steps))+' Schritte');
    return `<div class="row"><div class="rl">${fmtDate(x.date,{weekday:'short'})}</div><div class="rr">${p.join(' · ')}</div></div>`;}).join('')+`</div>`;
  openSheet(a.name,h);loadAthAvatars([id]);}
// Beschwerde erledigen: Block in place ausblenden, Zähler patchen, Rückgängig (server-seitig optional: POST /exercise-notes/:id/flag)
async function coachResolveNote(noteId,athleteId,btn){const el=document.getElementById('cmp-'+noteId);if(btn)btn.disabled=true;
  const r=await API.post('/exercise-notes/'+noteId+'/resolve');
  if(r.status!==200){if(btn)btn.disabled=false;return toast(r.data?.error||'Fehler');}
  const c=COACH_DASH[athleteId];if(c)c.flagged=c.flagged.filter(n=>n.id!==noteId);
  // A-IV.7: dieselbe Beschwerde haengt als Markierung an der Planzeile – EIN Modell, also hier mit weg.
  if(CO2_FLAGS[athleteId])CO2_FLAGS[athleteId]=CO2_FLAGS[athleteId].filter(n=>n.id!==noteId);
  const arow=(ATHLETES_CACHE||[]).find(x=>x.id===athleteId); // EIN Modell: Listenzeile sofort nachziehen
  if(arow){arow.openFlags=Math.max(0,(arow.openFlags||1)-1);
    const ast=attentionStatusClient({daysSinceCheckin:daysSince(arow.lastCheckin),daysSinceTraining:arow.lastTrain?daysSince(arow.lastTrain):null,openFlags:arow.openFlags,
      daysPerWeek:coDpw(arow),oldestFlagDays:arow.oldestFlagDays});
    arow.status=ast.level;arow.reasons=ast.reasons;
    if(document.getElementById('athList')){ATHLETES_CACHE=sortAthletes(ATHLETES_CACHE);
      drawAthleteList(coachVisibleAthletes());coachDrawFilters();drawCoachStat();}
    if(VIEW_USER===athleteId&&typeof mountCtxBar==='function')mountCtxBar();}
  const left=c?c.flagged.length:0;const box=document.getElementById('complaints');
  if(el){el.classList.add('gone');setTimeout(()=>{el.remove();const t=document.getElementById('complaintsT');if(t)t.textContent=pl(left,'offene Beschwerde','offene Beschwerden');if(!left&&box)box.remove();},240);}
  coachInvalidate();
  if(coachResolveNote.noUndo)return toast('Als erledigt markiert ✓');
  toast('Als erledigt markiert ✓',{label:'Rückgängig',fn:async()=>{const u=await API.post('/exercise-notes/'+noteId+'/flag');
    if(u.status===200){coachInvalidate();delete COACH_DASH[athleteId];openDashboard(athleteId,{replace:true});}
    else{coachResolveNote.noUndo=true;toast('Rückgängig ist auf diesem Server noch nicht möglich');}}});}
// Beschwerde-Handlung 1: direkt an der beanstandeten Übung landen. Dafür muss der Athleten-Kontext stehen
// (coachEnter lädt PLAN/TODAY), danach den Tag wählen, in dem die Übung liegt, und den Editor öffnen.
// go() gibt die Zusage des Renderers zurück – ohne das await stünde CUR_DAY noch auf dem Vorschlagstag.
async function coachFixExercise(uid,name,exId){
  closeAllSheets();
  await coachEnter(uid,name||athName(uid));
  await go('workout');
  const day=(PLAN?.days||[]).find(dd=>(dd.exercises||[]).some(e=>e.id===exId));
  if(!day)return toast('Diese Übung steht nicht mehr im Plan');
  if(typeof selDay==='function'&&CUR_DAY!==day.id)await selDay(day.id);
  if(typeof editExercise==='function')editExercise(exId);
  else toast('Übungs-Editor nicht verfügbar');}
// Beschwerde-Handlung 2: Unterhaltung öffnen und die Beschwerde als Zitat vorschreiben – der Athlet sieht,
// worauf sich die Antwort bezieht. Der Text steht im Eingabefeld, nicht abgeschickt: der Coach formuliert selbst.
async function coachReplyComplaint(uid,name,noteId){
  const n=((COACH_DASH[uid]||{}).flagged||[]).find(x=>x.id===noteId);
  await openThread(uid,name||athName(uid));
  const ta=document.getElementById('th_body');if(!ta||!n)return;
  const note=String(n.note||'').trim();
  ta.value='Zu deiner Rückmeldung bei „'+n.exercise_name+'" ('+fmtDate(n.date)+'):\n„'+(note.length>160?note.slice(0,160)+'…':note)+'"\n\n';
  ta.style.height='auto';ta.style.height=Math.min(120,ta.scrollHeight)+'px';
  try{ta.focus({preventScroll:true});ta.setSelectionRange(ta.value.length,ta.value.length);}catch(e){}}
// ===== A-IV.7 · STUFE, PROFI-FUNKTIONEN UND DER KI-ZUSTAND DES ATHLETEN =====
// Bis 2.7.0 stand die Stufe im Athleten-Blatt als tote Pille („Fortgeschritten") – abgelesen aus
// `experience`, der Selbstangabe aus dem Onboarding. Der Coach konnte sie nicht setzen, und nirgends
// stand, was sie ueberhaupt bewirkt (00-vorher-dashboard.png).
//
// CRITIC K1 ist hier bindend: `experience` bleibt die Selbstangabe des Athleten und wird NICHT
// ueberschrieben. Der Coach setzt `experience_coach` – eine Uebersteuerung, die danebensteht, sichtbar
// bleibt („Selbstangabe: Fortgeschritten") und die er mit einem Tipp wieder loswird. `features` (JSON)
// ist die Feinsteuerung darunter: eine EINZELNE Funktion abweichend von der Stufe.
// Dieselbe Rangfolge liest die Trainingsansicht bereits (training.js:35 `twLevel`, analysis.js:85) –
// hier wird sie gesetzt, nicht neu erfunden. Wer sich selbst als „Profi" eingetragen hat, sieht das
// RIR-Feld also OHNE dass ein Coach handelt; die Uebersteuerung ist der Zusatz, nicht die Voraussetzung.
const CO2_LV=['beginner','intermediate','advanced'];
function co2LvNum(k){const i=CO2_LV.indexOf(String(k||''));return i<0?1:i+1;}
function co2LevelOf(a){return (a&&(a.experience_coach||a.experience))||'beginner';}
function co2Feats(a){try{const f=a&&a.features;const o=(typeof f==='string')?JSON.parse(f||'{}'):(f||{});
  return (o&&typeof o==='object'&&!Array.isArray(o))?o:{};}catch(e){return {};}}
// Was sich fuer den ATHLETEN aendert – ein Satz je Stufe, nicht drei. Ohne ihn ist die Stufe eine Vokabel.
//
// NACHGEBESSERT (Befund Ü-3, P9 „nichts versprechen, was die App nicht tut"): hier standen bis zur
// Fix-Runde zwei Saetze und zwei Schalter, die 2.8.0 NICHT einloest.
//   1. „Tempo-Vorgabe" gibt es nirgends – kein Feld, keine Spalte, kein Verbraucher von
//      `twFeat('tempo')`. Das Tempo-Feld ist in `DEFER-A4.md` bewusst verschoben (es braucht eine
//      Spalte, diese Welle hat ein Schema-Verbot). Ein gruener Schalter im Coach-Blatt hat dem Coach
//      trotzdem erzaehlt, die Funktion sei bei seinem Profi AN.
//   2. Der Volumen-Korridor je Muskelgruppe ist gebaut (`analysis.js` `anaMuscleHTML`), aber er haengt
//      an KEINER Stufe und an keinem Schluessel: JEDER Athlet sieht ihn, auch der Anfaenger. Ihn als
//      „ab Profi" zu fuehren, war damit genauso falsch – nur in die andere Richtung.
// Beide Zeilen sind deshalb raus, bis die Sache dahinter existiert. `co2FeatOn()`/`twFeat()` nehmen
// einen Schluessel spaeter ohne Umbau wieder auf: eine Zeile in CO2_FEATS, fertig.
// Gegenprobe vor dem Streichen (2.8.0): der EINZIGE Stufen-Verbraucher ueber Stufe 2 ist
// `an2Level()>=2` (e1RM); `twRirOn()`/`twSetTypesOn()` haengen an Stufe 2. Nichts in der App
// unterscheidet „Profi" von „Fortgeschritten" – genau das sagt der Satz unten jetzt auch.
const CO2_LV_TXT={
  beginner:'Die Satzzeile bleibt [kg] [Wdh] [✓]. Kein RIR, keine Satztypen, Empfehlungen ohne Fachbegriffe.',
  intermediate:'Dazu das RIR-Feld in der Satzzeile und die Satztypen (Aufwärmen, Drop, Backoff) – Aufwärmsätze zählen dann nicht mehr in Volumen, e1RM und Bestleistung.',
  advanced:'In der App dasselbe wie „Fortgeschritten": RIR-Feld und Satztypen. Eine eigene Profi-Funktion darüber hinaus gibt es in dieser Version noch nicht – die Stufe hält fest, wie du ihn einschätzt, verspricht dir aber nichts, was er nicht sieht.'};
// Schluessel · Name · was der Athlet davon hat · ab welcher Stufe standardmaessig an.
// Aufnahmebedingung: es muss einen Verbraucher geben, der den Schluessel WIRKLICH liest
// (`rir` -> training.js `twRirOn`, `set_types` -> training.js `twSetTypesOn`). Ein Schalter ohne
// Verbraucher ist eine Luege mit Zustand.
const CO2_FEATS=[
  ['rir','RIR-Feld in der Satzzeile','Er trägt je Satz ein, wie viele Wiederholungen noch drin waren.',2],
  ['set_types','Satztypen','Aufwärmen, Drop, Backoff – lange auf die Satznummer drücken.',2]];
function co2FeatSet(a,key){return Object.prototype.hasOwnProperty.call(co2Feats(a),key);}
function co2FeatOn(a,key,min){const f=co2Feats(a);
  if(Object.prototype.hasOwnProperty.call(f,key))return !!f[key];
  return co2LvNum(co2LevelOf(a))>=min;}
// Unterzeile der Zeile im Athleten-Blatt: Stufe, woher sie kommt, wie viele Ausnahmen gesetzt sind.
function co2LevelSummary(a){
  const lv=expLabel(co2LevelOf(a))||'Anfänger';
  const n=CO2_FEATS.filter(f=>co2FeatSet(a,f[0])).length;
  const src=(a&&a.experience_coach)?'von dir gesetzt':'Selbstangabe';
  return lv+' · '+src+(n?' · '+n+' Ausnahme'+(n>1?'n':''):'');}

// Zustand des KI-Schalters: true (frei), false (gesperrt), null (nicht bekannt). Zwei Quellen, in dieser
// Reihenfolge: das Feld `ai_consent` aus dem Athleten-Payload – und, solange der Server es nicht
// mitliefert, was die KI-Route beim letzten Versuch geantwortet hat (403 `needsAiConsent`). Geraten wird
// nichts: ein fehlendes Feld und ein „Nein" duerfen nicht gleich aussehen.
let CO2_AI={};   // athleten-id -> true|false, nur aus ECHTEN Antworten der Route
function co2AiState(a){
  if(a&&('ai_consent' in a))return Number(a.ai_consent)===1;
  const v=CO2_AI[a&&a.id];return typeof v==='boolean'?v:null;}

// ---- Das Blatt „Stufe & Funktionen" ----
// Es legt sich ueber das Athleten-Blatt: die Stufe setzt ein Coach selten, aber dann bewusst.
// Im Athleten-Blatt steht nur die Zeile mit dem Zustand.
async function co2LevelSheet(id,name){
  name=name||athName(id);
  const c=COACH_DASH[id]||await loadDashboard(id);
  if(!c)return toast(loadDashboard.lastStatus===403?'Kein Coach-Zugriff auf diesen Athleten':'Fehler beim Laden');
  coachSheet('Stufe & Funktionen',{id,name},'<div id="co2Lv">'+co2LevelBodyHTML(id)+'</div>');}
function co2LevelDraw(id){const el=document.getElementById('co2Lv');if(el)el.innerHTML=co2LevelBodyHTML(id);}
// Kann dieser Server die Stufe ueberhaupt speichern? Das wird nicht geraten: die Felder muessen im
// Payload von GET /api/dashboard/:id STEHEN (auch als null). Fehlen sie, sagt das Blatt genau das,
// statt Schalter anzubieten, die ins Leere greifen.
function co2CanSet(a){return !!(a&&('experience_coach' in a)&&('features' in a))&&!co2Save.noServer;}
function co2LevelBodyHTML(id){
  const c=COACH_DASH[id]||{},a=(c.d&&c.d.athlete)||{};
  const first=esc2(String(a.name||athName(id)||'Dein Athlet').split(' ')[0]);
  const cur=co2LevelOf(a),can=co2CanSet(a);
  let h='';
  // 1) Die Stufe – drei Knoepfe, und darunter der eine Satz, was sich dadurch aendert.
  h+='<div class="seg co2-seg" role="group" aria-label="Stufe des Athleten">'+
    CO2_LV.map(k=>'<button type="button" class="'+(k===cur?'on':'')+'" aria-pressed="'+(k===cur)+'"'+
      (can?' onclick="co2SetLevel('+id+',\''+k+'\')"':' disabled')+'>'+esc2(expLabel(k))+'</button>').join('')+'</div>';
  h+='<div class="co2-what">'+esc2(CO2_LV_TXT[cur]||'')+'</div>';
  // 2) Woher die Stufe kommt. Die Selbstangabe bleibt sichtbar, auch wenn sie uebersteuert ist (K1).
  const self=expLabel(a.experience)||'Anfänger';
  if(a.experience_coach){
    h+='<div class="co2-src">Von dir gesetzt. Selbstangabe von '+first+' im Onboarding: <b>'+esc2(self)+'</b>.'+
      (can?' <button type="button" class="co2-lnk" onclick="co2SetLevel('+id+',\'\')">Auf Selbstangabe zurücksetzen</button>':'')+'</div>';
  }else{
    h+='<div class="co2-src">Selbstangabe von '+first+' im Onboarding. Du hast nichts übersteuert – '+first+' bekommt, was zu seiner eigenen Antwort passt.</div>';
  }
  // 3) Ausnahmen je Funktion: eine Funktion abweichend von der Stufe.
  h+='<div class="section-label"><span>Einzelne Funktionen</span></div>';
  h+='<div class="rows mb-3">'+CO2_FEATS.map(f=>{
    const key=f[0],label=f[1],sub=f[2],min=f[3];
    const on=co2FeatOn(a,key,min),set=co2FeatSet(a,key),def=co2LvNum(cur)>=min;
    const hint=set?('von dir '+(on?'an':'aus')+'geschaltet · Stufe '+expLabel(cur)+': '+(def?'an':'aus')):('aus der Stufe '+expLabel(cur));
    return '<div class="switch-row"><div class="rl">'+esc2(label)+'<small>'+esc2(sub)+'</small>'+
      '<small class="co2-hint'+(set?' set':'')+'">'+esc2(hint)+'</small></div>'+
      '<button type="button" class="tgl'+(on?' on':'')+'" role="switch" aria-checked="'+on+'" aria-label="'+esc2(label)+' für '+first+'"'+
      (can?' onclick="co2SetFeature('+id+',\''+key+'\','+(on?'false':'true')+')"':' disabled')+'></button></div>';}).join('')+'</div>';
  if(can&&CO2_FEATS.some(f=>co2FeatSet(a,f[0])))
    // Gemessen (14-stufe-gesetzt.png, erste Aufnahme): „Alle Ausnahmen löschen – wieder der Stufe folgen"
    // war bei 390 px 389 px breit in einem 358 px breiten Knopf und wurde auf BEIDEN Seiten abgeschnitten
    // („lle Ausnahmen löschen – wieder der Stufe folge"). Der Knopf traegt jetzt die Handlung, der Satz
    // darunter die Folge – und `.co2-blk` laesst umbrechen, damit auch ein langer Vorname passt.
    h+='<button type="button" class="btn sec block co2-blk" onclick="co2ResetFeatures('+id+')">Alle Ausnahmen löschen</button>'+
      '<div class="co2-src mb-4">Dann gilt für jede Funktion wieder das, was die Stufe vorgibt.</div>';
  // 4) Der KI-Schalter des Athleten: Zustand, kein Bedienelement (DECISIONS F5 – das entscheidet er).
  h+=co2AiConsentHTML(id,a,first);
  // 5) Ehrlicher Hinweis, wenn dieser Server das Speichern noch nicht kann.
  if(!can)h+='<div class="note warn mb-4">Auf diesem Server lässt sich die Stufe noch nicht <b>setzen</b>. '+
    'Oben steht, was gerade gilt – die Trainingsansicht des Athleten richtet sich schon danach.'+
    '<small class="co2-tech">Zum Speichern muss <code>GET /api/dashboard/:id</code> die Felder '+
    '<code>experience_coach</code> und <code>features</code> mitliefern und '+
    '<code>PUT /api/athlete/:id/profile</code> sie annehmen. Die Spalten gibt es seit 2.6.0 '+
    '(<code>schema.js:700/702</code>), die Route noch nicht.</small></div>';
  return h;}
// Zustand des KI-Schalters im Klartext – und, wenn er aus ist, der einzige Weg, der dem Coach bleibt:
// fragen. Umstellen kann das nur der Athlet selbst.
function co2AiConsentHTML(id,a,first){
  const head='<div class="section-label"><span>KI-Auswertung</span></div>';
  const st=co2AiState(a);
  if(st===null)
    return head+'<div class="note status mb-4">Ob '+first+' die KI-Auswertung freigegeben hat, sagt dieser Server '+
      'noch nicht im Voraus – du erfährst es, wenn du sie startest. Entscheiden tut das ohnehin '+first+' selbst, '+
      'im Profil unter „Daten &amp; Verbindungen". Standard ist <b>aus</b>.</div>';
  const txt=st
    ? first+' hat sie freigegeben. Deine Analyse schickt 14 Tage Check-in- und Trainingswerte ohne Namen an Anthropic – und '+first+' bekommt danach eine Nachricht, dass du sie erstellt hast.'
    : first+' hat sie nicht freigegeben – das ist der Standard. Ohne Freigabe verlässt kein Wert den Server: die KI-Analyse antwortet dir mit einem Hinweis statt mit Text. Umstellen kann das nur '+first+' selbst.';
  return head+'<div class="rows mb-3"><div class="row co2-ai"><span class="co2-dot '+(st?'on':'off')+'"></span>'+
    '<span class="rl">KI-Auswertung durch dich<small>'+esc2(txt)+'</small></span>'+
    '<span class="rr">'+(st?'An':'Aus')+'</span></div></div>'+
    (st?'':'<button type="button" class="btn sec block co2-blk mb-4" onclick="co2AskAiConsent('+id+')">'+icon('mail',18)+' '+first+' um die Freigabe bitten</button>');}
// Die Bitte um die Freigabe: Unterhaltung oeffnen, Text vorschreiben, NICHT abschicken. Der Coach
// formuliert selbst – eine automatische Nachricht waere bei genau diesem Thema das Falscheste.
async function co2AskAiConsent(id){
  const first=String(athName(id)||'').split(' ')[0]||'Hallo';
  await openThread(id,athName(id));
  const ta=document.getElementById('th_body');if(!ta)return;
  ta.value='Hi '+first+', ich würde deine letzten 14 Tage gern einmal von der KI gegenlesen lassen – '+
    'als Zweitmeinung zu meiner eigenen Einschätzung. Dafür brauche ich deine Freigabe: '+
    'Profil → „Daten & Verbindungen" → „KI-Auswertung durch meinen Coach erlauben". '+
    'Es gehen nur Check-in- und Trainingswerte raus, ohne deinen Namen. Sag ruhig Nein, wenn dir das nicht passt.';
  ta.style.height='auto';ta.style.height=Math.min(160,ta.scrollHeight)+'px';
  try{ta.focus({preventScroll:true});ta.setSelectionRange(ta.value.length,ta.value.length);}catch(e){}}

// ---- Schreiben, und zwar nachgelesen ----
// PUT /api/athlete/:id/profile nimmt unbekannte Felder stillschweigend entgegen (COALESCE-Update auf
// vier Spalten, server.js:1913). „200 OK" heisst hier also NICHT „gespeichert". Deshalb wird nach jedem
// Schreiben das Dashboard neu geholt und der Wert VERGLICHEN – erst dann meldet das Blatt Erfolg.
// Schlaegt die Gegenprobe fehl, schaltet `co2Save.noServer` die Bedienelemente ab und der Hinweis
// erscheint. Ein stiller Verlust ist das Schlimmste, was diese Oberflaeche tun koennte.
async function co2Save(id,patch,check){
  const r=await API.put('/athlete/'+id+'/profile',patch);
  if(r.status!==200){toast((r.data&&r.data.error)||'Fehler beim Speichern');return false;}
  delete COACH_DASH[id];
  const c=await loadDashboard(id);
  const a=(c&&c.d&&c.d.athlete)||null;
  if(!a||!check(a)){
    co2Save.noServer=true;co2LevelDraw(id);
    toast('Dieser Server speichert die Stufe noch nicht');
    return false;}
  // Der Athleten-Kontext liest dieselbe Quelle (training.js `twProfile` -> VIEW_USER_PROFILE):
  // ohne diese Zeile stuende die Satzzeile bis zum naechsten Kontextwechsel auf der alten Stufe.
  if(typeof VIEW_USER!=='undefined'&&VIEW_USER===id&&typeof VIEW_USER_PROFILE!=='undefined'&&VIEW_USER_PROFILE)
    Object.assign(VIEW_USER_PROFILE,{experience_coach:a.experience_coach,features:a.features});
  coachInvalidate();co2LevelDraw(id);
  return true;}
async function co2SetLevel(id,key){
  const ok=await co2Save(id,{experience_coach:key||null},a=>String(a.experience_coach||'')===String(key||''));
  if(ok)toast(key?('Stufe: '+expLabel(key)):'Wieder die Selbstangabe');}
async function co2SetFeature(id,key,on){
  const a=(((COACH_DASH[id]||{}).d)||{}).athlete||{};
  const f=co2Feats(a);f[key]=!!on;
  const ok=await co2Save(id,{features:f},x=>co2Feats(x)[key]===!!on);
  if(ok)toast(((CO2_FEATS.find(z=>z[0]===key)||[])[1]||key)+(on?' an':' aus'));}
async function co2ResetFeatures(id){
  const ok=await co2Save(id,{features:{}},x=>!Object.keys(co2Feats(x)).length);
  if(ok)toast('Ausnahmen gelöscht – es gilt wieder die Stufe');}

// Alter Name (analysis.js hat ihn auch; dort mit Sheet-Neuaufbau) – hier bewusst nicht überschrieben.
// D10/D1 (Anzeige): Hier setzt der Coach die Kalorienziele – also muss hier auch stehen, wenn der Server
// sie inzwischen überstimmt. Gemessen: im Coach-Blatt standen 3.017 / 2.600 kcal, die Ernährung des
// Athleten rechnete mit 3.173 / 2.975 kcal. Der Server liefert beide Zahlen als `kcalAsk` im Dashboard;
// geändert wird nichts von allein – die Schaltfläche trägt die Werte nur in die Felder ein, gespeichert
// wird wie immer per „Speichern".
function coKcalAskHTML(d,a){if(!d)return '';
  const first=esc2(String(a&&a.name||'Dein Athlet').split(' ')[0]);
  let h='';
  const ask=d.kcalAsk;
  if(ask){const t=ask.train||{},r=ask.rest||{};
    const st=Math.round(t.saved||0),su=Math.round(t.suggested||0),sr=Math.round(r.saved||0),ru=Math.round(r.suggested||0);
    if(su||ru){const kg=ask.weightKg?fmtNum(ask.weightKg,1):'';
      h+=`<div class="note status mb-3">
        <div>Die gespeicherten Ziele (<b>${fmtNum(st)} / ${fmtNum(sr)} kcal</b>) passen nicht mehr zum aktuellen Gewicht${kg?' von '+kg+' kg':''}.
          ${first} isst zurzeit nach <b>${fmtNum(su)} / ${fmtNum(ru)} kcal</b> (Training / Ruhe) – so rechnet der Server.</div>
        <div class="mt-2"><button class="btn sm" onclick="coKcalAskFill(${su},${ru})">Gerechnete Werte eintragen</button></div>
      </div>`;}}
  if(d.dobMissing)h+=`<div class="note mb-3">Ohne Geburtsjahr rechnet das Kalorienziel ohne Alter – die Zahlen sind ein Startwert. ${first} kann das Jahr im Profil unter „Ernährung &amp; Kalorien" nachtragen.</div>`;
  return h;}
// Trägt die gerechneten Werte in die beiden Felder ein – ein Tipp, kein stiller Schreibzugriff.
function coKcalAskFill(t,r){const kt=document.getElementById('cp_kt'),kr=document.getElementById('cp_kr');
  if(kt&&t)kt.value=t;if(kr&&r)kr.value=r;
  if(typeof toast==='function')toast('Eingetragen – mit „Speichern" übernehmen');}
// Phase & Ziele: vorbefüllt mit aktuellen Werten + Ziel-Auswahl
function coachPhaseSheet(id){const c=COACH_DASH[id];const a=c?.d?.athlete||{id,name:athName(id)};
  const opt=(v,l,cur)=>`<option value="${v}"${cur===v?' selected':''}>${l}</option>`;
  coachSheet('Phase & Ziele',{id,name:a.name},`<div id="cpBox">
    <div class="note status mb-3">Aktuell: <b>${a.kcal_target_train?fmtNum(a.kcal_target_train):'–'} / ${a.kcal_target_rest?fmtNum(a.kcal_target_rest):'–'} kcal</b> (Training / Ruhe) · ${goalLabel(a.goal)} · ${phaseLabel(a.phase)||'keine Phase'}</div>
    ${coKcalAskHTML(c?.d,a)}
    <div class="field"><label>Ziel</label><select id="cp_goal">${opt('muscle','Muskelaufbau',a.goal)}${opt('fatloss','Definition',a.goal)}${opt('health','Gesundheit',a.goal)}</select></div>
    <div class="field"><label>Phase</label><select id="cp_phase">${opt('offseason','Offseason (Aufbau)',a.phase||'offseason')}${opt('prep','Wettkampf-Prep (Diät)',a.phase)}${opt('maintain','Maintenance',a.phase)}</select></div>
    <div class="grid-2"><div class="field"><label>kcal Trainingstag</label><input id="cp_kt" type="number" inputmode="numeric" min="0" max="15000" value="${a.kcal_target_train??''}" placeholder="z.B. 3000"></div>
      <div class="field"><label>kcal Ruhetag</label><input id="cp_kr" type="number" inputmode="numeric" min="0" max="15000" value="${a.kcal_target_rest??''}" placeholder="z.B. 2600"></div></div>
    <div class="meta mb-4">${esc2(a.name.split(' ')[0])} bekommt automatisch eine Nachricht über die Änderung.</div>
    <button class="btn block" onclick="saveCoachPhaseSheet(${id})">Speichern</button></div>`);}
async function saveCoachPhaseSheet(id){const body={goal:val('cp_goal'),phase:val('cp_phase'),kcal_target_train:num('cp_kt'),kcal_target_rest:num('cp_kr')};
  const r=await API.put('/athlete/'+id+'/profile',body);
  if(r.status!==200)return showFieldErr('cpBox',r.data?.error||'Fehler');
  const c=COACH_DASH[id];if(c&&c.d&&c.d.athlete){Object.assign(c.d.athlete,{goal:body.goal,phase:body.phase,kcal_target_train:body.kcal_target_train??c.d.athlete.kcal_target_train,kcal_target_rest:body.kcal_target_rest??c.d.athlete.kcal_target_rest});}
  if(VIEW_USER===id&&VIEW_USER_PROFILE)Object.assign(VIEW_USER_PROFILE,{goal:body.goal,phase:body.phase});
  coachInvalidate();closeModal();toast('Gespeichert ✓ – Athlet benachrichtigt');
  if(sheetOpen()&&SHEET_STACK.length&&SHEET_STACK[SHEET_STACK.length-1].title===athName(id)){delete COACH_DASH[id];openDashboard(id,{replace:true});}}
// Monatsziel eines Athleten – Nutzer wird explizit übergeben, kein halber Kontext mehr (Fix für coachMonthly)
async function coachMonthlyGoal(id,name){name=name||athName(id);MONTHLY_UID=id;openSheet('Monatsziel','<div class="spinner"></div>');
  const r=await API.get('/monthly/'+id);
  if(r.status!==200){coachSheet('Monatsziel',{id,name},`<div class="note err">${esc2(r.data?.error||'Fehler')}</div>`);return;}
  const m=r.data;const monthName=new Date(m.month+'-01T00:00:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  const left=m.parts.length-m.reachedCount;
  let h=`<div class="between mb-3"><div><div class="h3">${cap(monthName)}${m.custom?' <span class="pill red">vom Coach</span>':''}</div><div class="meta">${m.allReached?'Monatsziel erreicht':left===0?'alles geschafft':'Noch '+pl(left,'Ziel','Ziele')+' bis zur Auszeichnung'}</div></div>${m.allReached?icon('trophy',28,'tone-green'):''}</div>`;
  h+=`<div class="rows mb-4">`+m.parts.map(p=>`<div class="row"><div class="rl">${esc2(p.label)}<small>${p.key==='volume'?fmtNum(p.done):fmtNum(p.done)} / ${fmtNum(p.target)}${p.reached?' · erreicht':''}</small><div class="bar${p.reached?' green':''} mt-2"><i style="width:${Math.min(100,p.pct||0)}%"></i></div></div><div class="rr">${p.reached?icon('check',18,'tone-green'):Math.round(p.pct||0)+' %'}</div></div>`).join('')+`</div>`;
  const t=m.parts.find(p=>p.key==='trainings')?.target||0,cc=m.parts.find(p=>p.key==='checkins')?.target||0,vv=m.parts.find(p=>p.key==='volume')?.target||0;
  h+=`<button class="btn block sec" onclick="openEditMonthly('${m.month}',${t},${cc},${vv},${id})">${icon('target',18)} Ziel anpassen</button>`;
  if(m.history&&m.history.length)h+=`<div class="section-label"><span>Geschaffte Monate</span></div><div class="cluster">`+m.history.map(x=>`<span class="pill neutral">${new Date(x.month+'-01T00:00:00').toLocaleDateString('de-DE',{month:'short',year:'2-digit'})}</span>`).join('')+`</div>`;
  coachSheet('Monatsziel',{id,name},h);}
// uid explizit: ohne uid (Aufruf aus analysis.js) fällt saveMonthly auf VIEW_USER zurück – nie auf einen alten Athleten.
// Im Coach-Fluss trägt auch diese dritte Ebene den Athleten-Chip – hier tippt der Coach Zahlen für ein fremdes Konto.
function openEditMonthly(month,t,c,v,uid){MONTHLY_UID=uid||null;
  const body=`<div id="mgBox">
    <div class="note mb-4">Erreicht der Athlet sein Monatsziel, gibt es <b>doppelte XP</b> und eine besondere Auszeichnung. Anspruchsvoll, aber machbar wählen.</div>
    <div class="field"><label>Trainings im Monat</label><input id="mg_t" type="number" inputmode="numeric" min="1" max="31" value="${t}"></div>
    <div class="field"><label>Check-ins im Monat</label><input id="mg_c" type="number" inputmode="numeric" min="1" max="31" value="${c}"></div>
    <div class="field"><label>Gesamt-Volumen (kg)</label><input id="mg_v" type="number" inputmode="numeric" min="1" value="${v}"></div>
    <button class="btn block" onclick="saveMonthly('${month}')">Ziel setzen</button></div>`;
  const nm=uid?athName(uid):((typeof coachView==='function'&&coachView()&&COACH_CONTEXT)?COACH_CONTEXT:'');
  if(nm)coachSheet('Monatsziel anpassen',{id:uid||null,name:nm},body);else openSheet('Monatsziel anpassen',body);}
async function saveMonthly(month){const uid=MONTHLY_UID||VIEW_USER||ME.id;
  const r=await API.put('/monthly/'+uid,{month,target_trainings:num('mg_t'),target_checkins:num('mg_c'),target_volume:num('mg_v')});
  if(r.status===200){closeModal();toast('Monatsziel gesetzt ✓ – Athlet wurde benachrichtigt');
    // nur der Coach-Weg (uid explizit gesetzt) zeichnet das Monatsziel-Sheet neu; der eigene Weg gehört analysis.js
    if(MONTHLY_UID&&sheetOpen()&&SHEET_STACK.length&&SHEET_STACK[SHEET_STACK.length-1].title==='Monatsziel')coachMonthlyGoal(uid,athName(uid));}
  else showFieldErr('mgBox',r.data?.error||'Fehler');}

// Athleten-Kontext betreten (einzige Stellen, die COACH_CONTEXT/VIEW_USER setzen – neben go('athletes'))
async function coachEnter(id,name){closeAllSheets();COACH_CONTEXT=name||athName(id);VIEW_USER=id;TODAY=null;PLAN=null;if(typeof RECIPE_FILTER!=='undefined')RECIPE_FILTER=null;
  if(typeof invalidateView==='function'){try{invalidateView();}catch(e){}}
  buildNav();mountCtxBar();mountCoachHeader();
  const dr=await API.get('/dashboard/'+id);VIEW_USER_PROFILE=dr.data?.athlete||null;
  if(dr.status===200){const fl=await API.get('/flagged-notes/'+id);COACH_DASH[id]={ts:Date.now(),d:dr.data,flagged:fl.data?.notes||[]};}
  await loadPlan();await loadToday();
  co2PerfStop();co2PerfWatch();}   // A-IV.7: Leistung in der Planzeile – neuer Athlet, neuer Verlauf
async function coachOpenPlan(id,name){await coachEnter(id,name);go('workout');}
// Bestimmten Tab im Athleten-Kontext öffnen (home/tracker/diet/workout/mindset); 'tracker' zeigt direkt das Training-Segment.
async function coachOpenView(id,name,tab){await coachEnter(id,name);
  if(tab==='tracker'&&typeof renderTracker==='function')renderTracker.tab='training';
  go(tab||'home');}

// ===== COACH-KARTE AUF DER HOME (Vertrag mit home.js/WP1: coachHomeCard() liefert HTML synchron) =====
// Zeichnet sofort aus dem Cache; sonst Skeleton + asynchrones Nachfüllen in #coachHomeCard.
function coachHomeCard(){const id=VIEW_USER;if(!coachView()||!id)return '';
  const c=COACH_DASH[id];if(c&&Date.now()-c.ts<CACHE_MS)return coachHomeCardHTML(c);
  setTimeout(()=>coachHomeCardFill(id),0);
  return `<div class="card coach-home" id="coachHomeCard"><div class="eyebrow mb-2">Coach-Übersicht</div>${skeleton(2,'sm')}</div>`;}
async function coachHomeCardFill(id){const c=await loadDashboard(id);const el=document.getElementById('coachHomeCard');if(!el||VIEW_USER!==id)return;
  if(!c){const s=loadDashboard.lastStatus,who=esc2(COACH_CONTEXT||athName(id));
    const isOps=!!(ME&&ME.role==='admin');
    el.innerHTML=`<div class="eyebrow mb-2">Coach-Übersicht</div>`+(s===403||s===401
      ? (isOps
        ? `<div class="note status">Die Coach-Übersicht bleibt für dich geschlossen – sie gehört zum Coaching. Über die Hilfe-Freigabe siehst du die Ansicht des Athleten, nicht die Beurteilung seines Coaches.</div>
           <button class="btn sm sec mt-3" onclick="coachLeaveAthlete()">Zurück zur Verwaltung</button>`
        : `<div class="note warn">Du hast keinen Coach-Zugriff auf ${who} – der Athlet ist dir nicht (mehr) zugeordnet oder deine Sitzung gehört zu einem anderen Konto.</div>
           <button class="btn sm sec mt-3" onclick="coachLeaveAthlete()">Zur Athletenliste</button>`)
      : `<div class="note err">Daten konnten nicht geladen werden.</div>
         <button class="btn sm sec mt-3" onclick="coachHomeCardFill(${id})">${icon('refresh',16)} Erneut versuchen</button>`);return;}
  el.outerHTML=coachHomeCardHTML(c);loadAthAvatars([id]);}
// D10 (Anzeige, Coach-Zeile): Das gespeicherte Kalorienziel ist nicht zwingend das, nach dem der Athlet isst.
// Weicht es um mehr als 7 % von der Formel ab, verwirft der Server es und rechnet neu (dashboard.kcalAsk).
// Diese Zeile zeigte trotzdem die Profilzahl – „Kalorienziele 3.017 / 2.600 kcal" stand auf demselben
// Bildschirm wie die Ernährungs-Kachel des Athleten mit „2.401 / 2.975 kcal". Jetzt steht hier dieselbe Zahl
// wie im Athletenblick; das gespeicherte Ziel bleibt als Kleingedrucktes sichtbar, denn es steht so im
// Formular „Phase & Ziele", das diese Zeile öffnet.
function coKcalTargetTx(d,a){
  const kt=a&&a.kcal_target_train,kr=a&&a.kcal_target_rest;
  const savedTx=kt?`${fmtNum(kt)} / ${fmtNum(kr||0)} kcal`:'nicht gesetzt';
  const ask=d&&d.kcalAsk;
  const t=Math.round(ask?.train?.suggested||0),r=Math.round(ask?.rest?.suggested||0);
  if(!ask||(!t&&!r))return {rr:savedTx,hint:''};
  return {rr:`${fmtNum(t)} / ${fmtNum(r)} kcal`,
    hint:`<small>gerechnet · gespeichert ${kt?fmtNum(kt):'–'} / ${kr?fmtNum(kr):'–'} kcal</small>`};}
function coachHomeCardHTML(c){const d=c.d,a=d.athlete,id=a.id,fl=c.flagged||[];
  const listRow=(ATHLETES_CACHE||[]).find(x=>x.id===id);
  const st=listRow?athleteStatus(listRow):attentionStatusClient({daysSinceCheckin:daysSince(d.checkins[0]?.date),daysSinceTraining:daysSince(d.sessions[0]?.date),openFlags:fl.length,daysPerWeek:coDpw(a)});
  const status=st.status||st.level;const lc=d.checkins[0],ls=d.sessions[0];
  const n=esc2(a.name),nm=esc(a.name);
  const row=(ic,label,rr,onclick)=>onclick
    ?`<button type="button" class="row tap ad-row" onclick="${onclick}"><span class="r-ic">${icon(ic)}</span><span class="rl">${label}</span><span class="rr">${rr}</span></button>`
    :`<div class="row"><div class="r-ic">${icon(ic)}</div><div class="rl">${label}</div><div class="rr">${rr}</div></div>`;
  return `<div class="card coach-home" id="coachHomeCard">
    <div class="between mb-3"><div><div class="eyebrow">Coach-Übersicht</div><div class="h2">${n}</div></div>${attPill(status)}</div>
    ${(st.reasons||[]).length?`<div class="meta mb-3">${st.reasons.map(esc2).join(' · ')}</div>`:''}
    <div class="coach-facts">
      ${row('scale','Letzter Check-in',lc?`${lc.weight!=null?fmtNum(lc.weight,1)+' kg · ':''}${esc2(daysAgoTxt(lc.date))}`:'noch keiner')}
      ${row('dumbbell','Letztes Training',ls?`${esc2(ls.dayName||'Training')} · ${esc2(daysAgoTxt(ls.date))}`:'noch keins')}
      ${row('alertTriangle','Offene Beschwerden',fl.length?`<b class="tone-red">${fl.length}</b>`:'keine',fl.length?`openDashboard(${id})`:'')}
      ${(()=>{const K=coKcalTargetTx(d,a);return row('utensils','Kalorienziele'+K.hint,K.rr,`coachPhaseSheet(${id})`);})()}
    </div>
    <div class="cluster mt-3">
      <button class="btn sm" onclick="coachQuickMessage(${id},'${nm}')">${icon('mail',14)} Nachricht</button>
      <button class="btn sm sec" onclick="coachPhaseSheet(${id})">Phase &amp; Ziele</button>
      <button class="btn sm sec" onclick="coachMonthlyGoal(${id},'${nm}')">Monatsziel</button>
      <button class="btn sm sec" onclick="coachSupp(${id},'${nm}')">Supplements</button>
      <button class="btn sm sec" onclick="openDashboard(${id})">Dashboard</button>
    </div></div>`;}

// ===== PLAN-EDITOR =====
// Entfernt in 2.1.0: der Coach-Plan-Editor (coachPlanEditorHTML/coachExMenu/coachMoveEx/coachPlanOptions)
// hatte keinen Aufrufer. Im Coach-Kontext zeichnet training.js selbst die Plan-Zeilen (_exRowCoach) und
// bietet ueber openPlanMenu() dieselben Funktionen (Uebung/Tag hinzufuegen, Tag verwalten, Vorlage speichern
// bzw. anwenden, Excel-Import). Es gibt damit genau EINEN Plan-Editor statt zweier Fassungen.

// ===== NACHRICHTEN: Schnellnachricht · Unterhaltung · Rundnachricht =====
function coachQuickMessage(id,name){name=name||athName(id);
  coachSheet('Nachricht',{id,name},`<div id="qmBox">
    <div class="field"><label>Titel (optional)</label><input id="qm_title" placeholder="z.B. Kurzer Check-in" maxlength="120"></div>
    <div class="field"><label>Nachricht</label><textarea id="qm_body" rows="4" placeholder="Wie läuft's bei dir?" maxlength="2000"></textarea></div>
    <button class="btn block" onclick="sendQuickMessage(${id})">${icon('send',18)} Senden</button>
    <button class="btn block sec mt-2" onclick="openThread(${id},'${esc(name)}')">Unterhaltung ansehen</button></div>`);
  setTimeout(()=>{try{document.getElementById('qm_body')?.focus({preventScroll:true});}catch(e){}},80);}
async function sendQuickMessage(id){const body=val('qm_body');if(!body)return showFieldErr('qmBox','Bitte eine Nachricht eingeben.','qm_body');
  const r=await API.post('/messages',{user_id:id,title:val('qm_title'),body});
  if(r.status!==200)return showFieldErr('qmBox',r.data?.error||'Fehler');
  if(THREAD&&THREAD.id===id)THREAD.msgs.push({from_id:ME.id,user_id:id,title:val('qm_title'),body,kind:'message',created_at:new Date().toISOString()});
  closeModal();toast('Nachricht gesendet ✓');
  if(sheetOpen()&&SHEET_STACK.length&&SHEET_STACK[SHEET_STACK.length-1].title==='Unterhaltung'&&THREAD&&THREAD.id===id)openThread(id,THREAD.name);}
// Unterhaltung: GET /api/messages/thread/:athleteId; Fallback (404): Posteingang des Athleten + eigener Posteingang zusammengeführt
async function loadThread(id){const r=await API.get('/messages/thread/'+id);
  if(r.status===200&&r.data){const m=r.data.messages||r.data.thread||(Array.isArray(r.data)?r.data:[]);return m.slice().sort((x,y)=>String(x.created_at)<String(y.created_at)?-1:1);}
  const [a,b]=await Promise.all([API.get('/messages/'+id),API.get('/messages/'+ME.id)]);
  const toAth=(a.data?.messages||[]).filter(m=>m.from_id===ME.id);
  const fromAth=(b.data?.messages||[]).filter(m=>m.from_id===id);
  return [...toAth,...fromAth].sort((x,y)=>String(x.created_at)<String(y.created_at)?-1:1);}
function threadHTML(t){const id=t.id;let lastDay='';const msgs=t.msgs||[];
  // Lesebestätigung, Gegenstück zu acDrawReceipt() auf der Athletenseite (Beistellung aus A-I.5): unter der
  // letzten EIGENEN Blase steht, ob der Athlet sie schon geöffnet hat. Gleiche Klasse, gleicher Wortlaut wie
  // dort – die Lesemarke setzt POST /api/messages/:id/read-thread, die der Athlet beim Öffnen ruft.
  let lastMine=-1;msgs.forEach((m,i)=>{if(Number(m.from_id)===Number(ME&&ME.id)&&!(m.kind&&m.kind!=='message'))lastMine=i;});
  const bubbles=msgs.map((m,i)=>{const mine=m.from_id===ME.id;const sys=m.kind&&m.kind!=='message';
    const d=cParseTs(m.created_at);const day=d?fmtDate(d,{weekday:'short'}):'';let sep='';if(day&&day!==lastDay){lastDay=day;sep=`<div class="thread-day">${esc2(day)}</div>`;}
    const title=m.title&&!/^Nachricht vo[mn] /i.test(m.title)?`<div class="bt">${esc2(m.title)}</div>`:'';
    if(sys)return sep+`<div class="bub sys">${esc2(m.title||'')}${m.body?' – '+esc2(m.body):''}</div>`;
    const receipt=i===lastMine?`<div class="thread-receipt${m.read?' seen':''}">${m.read?'Gelesen ✓':'Gesendet'}</div>`:'';
    return sep+`<div class="bub ${mine?'me':'them'}">${title}${esc2(m.body||'')}<div class="bd">${cTime(m.created_at)}</div></div>`+receipt;}).join('');
  return `<div class="thread" id="thread">${bubbles||emptyState({icon:'mail',title:'Noch keine Nachrichten',text:'Schreib '+t.name.split(' ')[0]+' die erste Nachricht.'})}</div>
    <div class="thread-compose"><textarea id="th_body" rows="1" placeholder="Nachricht an ${esc2(t.name.split(' ')[0])}…" maxlength="2000" oninput="this.style.height='auto';this.style.height=Math.min(120,this.scrollHeight)+'px'"></textarea>
      <button class="btn icon red" aria-label="Senden" onclick="sendThread(${id})">${icon('send',20)}</button></div>`;}
async function openThread(id,name){name=name||athName(id);openSheet('Unterhaltung','<div class="spinner"></div>');
  const msgs=await loadThread(id);THREAD={id,name,msgs};
  coachSheet('Unterhaltung',{id,name},threadHTML(THREAD),{size:'tall'});
  const sh=document.getElementById('sheet');if(sh)requestAnimationFrame(()=>{sh.scrollTop=sh.scrollHeight;});
  // Nur DIESE Unterhaltung wird gelesen. Danach Glocke + (falls offen) der Nachrichten-Tab nachziehen.
  API.post('/messages/'+id+'/read-thread').then(r=>{if(r.status!==200)return;loadMessages();
    if(typeof invalidateView==='function'){try{invalidateView('messages');}catch(e){}}
    const v=document.getElementById('views');
    if(v&&CUR_TAB==='messages'&&document.getElementById('msgPage'))renderMessagesTab(v,{cached:true});});}
async function sendThread(id){const ta=document.getElementById('th_body');const body=(ta?.value||'').trim();
  if(!body){showFieldErr('sheetBody','Bitte eine Nachricht eingeben.','th_body');return;}
  const r=await API.post('/messages',{user_id:id,body});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  const m={from_id:ME.id,user_id:id,body,kind:'message',created_at:new Date().toISOString()};
  if(THREAD&&THREAD.id===id)THREAD.msgs.push(m);
  // Die alte Lesebestätigung gehört zur vorigen Blase – sie wandert mit ans Ende, sonst stünde „Gelesen ✓"
  // über einer soeben gesendeten Nachricht.
  const th=document.getElementById('thread');if(th){th.querySelector('.empty')?.remove();
    th.querySelectorAll('.thread-receipt').forEach(e=>e.remove());
    th.insertAdjacentHTML('beforeend',`<div class="bub me">${esc2(body)}<div class="bd">${cTime(m.created_at)}</div></div><div class="thread-receipt">Gesendet</div>`);}
  if(ta){ta.value='';ta.style.height='auto';}
  const sh=document.getElementById('sheet');if(sh)sh.scrollTop=sh.scrollHeight;toast('Gesendet ✓');}
// Postfach für Coaches: Unterhaltungen je Athlet mit Ungelesen-Zähler. EINE Datenquelle für Tab und Sheet.
async function coachThreads(){
  if(!ME)return{rows:[],ath:[],sys:[],unread:0}; // Sitzung weg (401 lädt gleich neu) – leeres Postfach statt Absturz
  const [mr,ar]=await Promise.all([API.get('/messages/'+ME.id),ATHLETES_CACHE.length?Promise.resolve({data:{athletes:ATHLETES_CACHE}}):API.get('/athletes')]);
  const msgs=mr.data?.messages||[];const ath=ar.data?.athletes||[];
  if(!ATHLETES_CACHE.length&&ath.length)ATHLETES_CACHE=ath;
  // Vorschau = jüngste Nachricht; bei gleicher Sekunde entscheidet die höhere id (der Server sortiert nur nach created_at)
  const newer=(m,cur)=>!cur||String(m.created_at)>String(cur.created_at)||(String(m.created_at)===String(cur.created_at)&&(m.id||0)>(cur.id||0));
  const byAth={};msgs.forEach(m=>{if(!m.from_id)return;const g=byAth[m.from_id]||(byAth[m.from_id]={last:null,unread:0});if(!m.read)g.unread++;if(newer(m,g.last))g.last=m;});
  const rows=ath.map(a=>({a,g:byAth[a.id]})).sort((x,y)=>((y.g?.unread||0)-(x.g?.unread||0))||(String(y.g?.last?.created_at||'')>String(x.g?.last?.created_at||'')?1:-1));
  return{rows,ath,sys:msgs.filter(m=>!m.from_id||m.kind==='system'),unread:msgs.filter(m=>!m.read).length};}
function coachThreadsHTML(t){
  let h=t.rows.length?`<div class="rows mb-4">`+t.rows.map(({a,g})=>`<button type="button" class="row tap ad-row msg-row" onclick="openThread(${a.id},'${esc(a.name)}')">${athAvatar(a.id,a.name,'sm')}
      <span class="rl">${esc2(a.name)}${g&&g.unread?` <span class="pill red">${g.unread} neu</span>`:''}<small class="truncate">${g?.last?esc2(g.last.body||g.last.title||''):'Noch keine Nachrichten'}</small></span>
      <span class="rr">${g?.last?esc2(cRelTime(g.last.created_at)):''}</span></button>`).join('')+`</div>`:
    emptyState({icon:'users',title:'Noch keine Athleten',text:'Füge zuerst einen Athleten hinzu – dann kannst du ihm hier schreiben.',btn:{label:'Athlet hinzufügen',onclick:'addAthlete()'}});
  if(t.sys.length)h+=`<div class="section-label"><span>System</span></div>`+t.sys.slice(0,10).map(m=>`<div class="msg system"><div class="mh"><div class="mt">${esc2(m.title||'')}</div><div class="md">${esc2(cRelTime(m.created_at))}</div></div><div class="mb">${esc2(m.body||'').replace(/\n/g,'<br>')}</div></div>`).join('');
  return h;}
async function coachMessagesSheet(){openSheet('Nachrichten','<div class="spinner"></div>');
  const t=await coachThreads();
  let h=coachThreadsHTML(t);
  if(ME&&ME.role==='coach')h+=`<button class="btn block sec mt-4" onclick="openBroadcast()">${icon('send',18)} Nachricht an alle Athleten</button>`;
  openSheet('Nachrichten',h);loadAthAvatars(t.ath.filter(a=>a.has_avatar).map(a=>a.id));}
// Vertrag mit account.js/WP6: openMessages() delegiert für Coach/Admin hierher. Im eigenen Tab (Coach ohne
// Athleten-Kontext) führt die Glocke auf den Tab, sonst öffnet das Sheet – so gibt es nie zwei Postfächer nebeneinander.
function coachOpenMessages(){
  if(ME&&ME.role==='coach'&&!COACH_CONTEXT&&typeof go==='function')return go('messages');
  return coachMessagesSheet();}
// Tab „Nachrichten" (Coach-Navigation, core.js/WP1 ruft renderMessagesTab).
// Kein Blanket-Read: Das Postfach anzusehen markiert nichts als gelesen. Erst openThread() ruft
// POST /messages/:athleteId/read-thread – so bleibt „wer hat mir geschrieben?" (Pillen + Glocke) erhalten.
async function renderMessagesTab(v,opts){opts=opts||{};mountCoachHeader();
  if(!opts.cached)v.innerHTML=`<div class="page on${document.getElementById('msgPage')?'':' first'}" id="msgPage">${skeleton(4)}</div>`;
  const t=await coachThreads();
  if(!document.getElementById('msgPage')&&!opts.cached)return;
  let h=`<div class="page on" id="msgPage">`;
  h+=`<div class="coach-stat"><span><b>${pl(t.rows.length,'Unterhaltung','Unterhaltungen')}</b></span>${t.unread?`<span><b class="tone-red">${fmtNum(t.unread)} ungelesen</b></span>`:`<span>alles gelesen</span>`}</div>`;
  if(ME&&ME.role==='coach')h+=`<button class="btn block mb-4" onclick="openBroadcast()">${icon('send',18)} Nachricht an alle Athleten</button>`;
  h+=coachThreadsHTML(t)+`</div>`;
  v.innerHTML=h;loadAthAvatars(t.ath.filter(a=>a.has_avatar).map(a=>a.id));
  if(typeof cacheView==='function')cacheView('messages');}
// Tab „Vorlagen" (Coach-Navigation): dieselbe Liste wie das Sheet, nur als Seite
async function renderTemplatesTab(v,opts){opts=opts||{};mountCoachHeader();
  if(!opts.cached)v.innerHTML=`<div class="page on${document.getElementById('tplPage')?'':' first'}" id="tplPage">${skeleton(3)}</div>`;
  const r=await API.get('/templates');const list=r.data?.templates||[];
  let h=`<div class="page on" id="tplPage">`;
  if(!list.length)h+=emptyState({icon:'fileSpreadsheet',title:'Noch keine Vorlagen',text:'Öffne den Plan eines Athleten und speichere ihn dort über „···" › „Als Vorlage speichern". Danach weist du ihn jedem Athleten mit zwei Tipps zu.',btn:{label:'Zu den Athleten',onclick:"go('athletes')"}});
  else{h+=`<div class="coach-stat"><span><b>${pl(list.length,'Vorlage','Vorlagen')}</b></span><span>antippen und zuweisen</span></div>`;
    // Zeile antippen = zuweisen (2 Tipps statt 6 über das versteckte „···"-Menü im Plan eines Athleten).
    h+=`<div class="rows mb-4">`+list.map(t=>`<div class="row tap tpl-row" role="button" tabindex="0" onclick="coTplApplyTo(${t.id},'${esc(t.name)}')"><div class="r-ic">${icon('fileSpreadsheet')}</div>
      <div class="rl">${esc2(t.name)}<small>${pl(t.days,'Tag','Tage')} · ${pl(t.exercises,'Übung','Übungen')}</small></div>
      <div class="rr"><button class="btn icon sm ghost tpl-del" aria-label="Vorlage löschen" onclick="event.stopPropagation();delTemplate(${t.id},'${esc(t.name)}')">${icon('trash',18)}</button></div></div>`).join('')+`</div>`;
    h+=`<div class="note status">Tippe eine Vorlage an, um sie einem Athleten zuzuweisen. Der bisherige Plan bleibt deaktiviert erhalten.</div>`;}
  h+=`</div>`;v.innerHTML=h;if(typeof cacheView==='function')cacheView('templates');}
function openBroadcast(){openSheet('Nachricht an alle Athleten',`<div id="bcBox">
  <div class="note mb-4">Diese Nachricht geht an alle deine Athleten – per Push und, falls aktiviert, per E-Mail.</div>
  <div class="field"><label>Titel (optional)</label><input id="bc_title" placeholder="z.B. Info zur Woche" maxlength="120"></div>
  <div class="field"><label>Nachricht</label><textarea id="bc_body" rows="4" placeholder="Deine Nachricht…" maxlength="2000"></textarea></div>
  <button class="btn block" onclick="sendBroadcast()">${icon('send',18)} An alle senden</button></div>`);}
async function sendBroadcast(){const body=val('bc_body');if(!body)return showFieldErr('bcBox','Bitte eine Nachricht eingeben.','bc_body');
  const r=await API.post('/messages/broadcast',{title:val('bc_title'),body});
  if(r.status===200){closeModal();toast('An '+pl(r.data.sent,'Athleten','Athleten')+' gesendet ✓');}else showFieldErr('bcBox',r.data?.error||'Fehler');}

// ===== COACH: KI-ANALYSE EINES ATHLETEN =====
async function aiSummary(id){const name=athName(id);const st=await coachAiStatus();
  if(st.configured===false)return coachSheet('KI-Analyse',{id,name},`<div class="note status">Die KI-Analyse ist auf diesem Server nicht aktiviert.</div>`);
  openSheet('KI-Analyse',`<div class="spinner"></div><p class="center muted">Analysiere Trainings- und Check-in-Daten…</p>`);
  const r=await API.post('/ai/summary/'+id,{});
  if(r.status===200){CO2_AI[id]=true;   // A-IV.7: der Zustand ist damit belegt, nicht geraten
    return coachSheet('KI-Analyse',{id,name},`<div class="ai-text">${esc2(r.data.summary||'')}</div><div class="caption mt-4">KI-generiert – als Zweitmeinung gedacht. Deine Coach-Einschätzung zählt.</div>`);}
  // A-IV.7: „nicht freigegeben" ist KEIN Fehler, sondern die Standardeinstellung des Athleten (DECISIONS F5).
  // Bis 2.7.0 stand hier eine rote Fehlerbox und eine Sackgasse. Jetzt steht da, was gilt, warum es gilt,
  // und der einzige Weg, der dem Coach bleibt: fragen. Den Zustand merkt sich die Ansicht – die Zeile im
  // Athleten-Blatt und das Blatt „Stufe & Funktionen" sagen ihn beim naechsten Mal VORHER.
  if(r.status===403&&r.data&&r.data.needsAiConsent){CO2_AI[id]=false;
    const first=esc2(String(name||'').split(' ')[0]||'Dein Athlet');
    return coachSheet('KI-Analyse',{id,name},
      `<div class="note status mb-4">${first} hat die KI-Auswertung <b>nicht freigegeben</b> – das ist der Standard.
       Ohne Freigabe verlässt kein Wert den Server. Umstellen kann das nur ${first} selbst, im Profil unter „Daten &amp; Verbindungen".</div>
       <button class="btn block co2-blk mb-2" onclick="closeModal();co2AskAiConsent(${id})">${icon('mail',18)} ${first} um die Freigabe bitten</button>
       <button class="btn block sec" onclick="closeModal()">Schließen</button>`);}
  {const err=String(r.data?.error||'');const friendly=/konfiguriert|API_KEY/i.test(err)?'Die KI-Analyse ist auf diesem Server nicht aktiviert.':(err||'Fehler bei der Analyse.');
    coachSheet('KI-Analyse',{id,name},`<div class="note err mb-4">${esc2(friendly)}</div><button class="btn block sec" onclick="closeModal()">OK</button>`);}}

// ===== COACH: SUPPLEMENTS für Athlet verwalten (Zugewiesen / Katalog, Toggle je Zeile, in-place) =====
let COACH_SUPP_CTX={uid:null,name:'',cat:[],assigned:{}};
async function coachSupp(uid,name){name=name||athName(uid);openSheet('Supplements','<div class="spinner"></div>');
  const [catR,aR]=await Promise.all([API.get('/supplements-catalog'),API.get('/supplements/'+uid)]);
  const cat=catR.data?.supplements||[];
  const assigned={};(aR.data?.personalized?aR.data.supplements:[]).forEach(s=>{assigned[s.id]={mandatory:s.mandatory,dose:s.dose,timing:s.timing,note:s.note};});
  COACH_SUPP_CTX={uid,name,cat,assigned};
  coachSheet('Supplements',{id:uid,name},`<div class="meta mb-3">Schalter = zuweisen. Zeile antippen für Pflicht, Dosierung und Timing.</div><div id="csBody">${coachSuppBodyHTML()}</div>`);}
function coachSuppBodyHTML(){const {cat,assigned}=COACH_SUPP_CTX;
  const row=s=>{const a=assigned[s.id];const on=!!a;
    const status=a?(a.mandatory?'<span class="pill must">Pflicht</span>':'<span class="pill neutral">optional</span>'):'';
    // Zwei Handlungen in einer Zeile: der Schalter weist zu, der Rest oeffnet Pflicht/Dosis/Timing.
    // Bis 2.5.0 waren Beschriftung und rechte Spalte zwei getrennte `div onclick` mit demselben Ziel –
    // mit der Tastatur nicht erreichbar und fuer einen Screenreader zwei stumme Flaechen.
    return `<div class="row supp-row" id="cs-${s.id}"><button class="tgl${on?' on':''}" role="switch" aria-checked="${on}" aria-label="${esc2(s.name)} zuweisen" onclick="coachToggleSupp(${s.id})"></button>
      <button type="button" class="supp-main" onclick="coachEditSupp(${s.id})" aria-label="${esc2(s.name)} einstellen">
        <span class="rl">${esc2(s.name)}<small>${esc2([a?.dose||s.dose,a?.timing||s.timing].filter(Boolean).join(' · '))}</small></span>
        <span class="rr">${status}${icon('chevronRight',16)}</span></button></div>`;};
  const as=cat.filter(s=>assigned[s.id]),rest=cat.filter(s=>!assigned[s.id]);
  let h='';
  h+=`<div class="section-label"><span>Zugewiesen</span><span class="sl-r">${as.length}</span></div>`;
  h+=as.length?`<div class="rows mb-3">${as.map(row).join('')}</div>`:`<div class="note status mb-3">Noch nichts zugewiesen – schalte unten ein Supplement ein.</div>`;
  if(rest.length)h+=`<div class="section-label"><span>Katalog</span><span class="sl-r">${rest.length}</span></div><div class="rows">${rest.map(row).join('')}</div>`;
  return h;}
function drawCoachSupp(){const b=document.getElementById('csBody');if(b)b.innerHTML=coachSuppBodyHTML();else coachSupp(COACH_SUPP_CTX.uid,COACH_SUPP_CTX.name);}
async function coachToggleSupp(sid){const {uid,assigned,cat}=COACH_SUPP_CTX;const s=cat.find(x=>x.id===sid);if(!s)return;
  if(assigned[sid]){const r=await API.del('/supplements/'+uid+'/'+sid);if(r.status!==200)return toast(r.data?.error||'Fehler');delete assigned[sid];toast(s.name+' entfernt');}
  else{const r=await API.put('/supplements/'+uid+'/'+sid,{mandatory:false});if(r.status!==200)return toast(r.data?.error||'Fehler');assigned[sid]={mandatory:0,dose:s.dose,timing:s.timing,note:null};toast(s.name+' zugewiesen ✓');}
  drawCoachSupp();}
function coachEditSupp(sid){const {cat,assigned,name}=COACH_SUPP_CTX;const s=cat.find(x=>x.id===sid);if(!s)return;const a=assigned[sid]||{};
  coachSheet(s.name,{id:COACH_SUPP_CTX.uid,name},`<div id="csEdit">
    <div class="note status mb-4">Standard: ${esc2(s.dose||'–')} · ${esc2(s.timing||'–')}. Leere Felder = Standard verwenden.</div>
    <div class="switch-row mb-3"><div class="rl">Als Pflicht festlegen<small>Erscheint mit Pflicht-Markierung auf der Tagesliste</small></div><button class="tgl${a.mandatory?' on':''}" id="cs_mand" role="switch" aria-checked="${!!a.mandatory}" aria-label="Pflicht" onclick="this.classList.toggle('on');this.setAttribute('aria-checked',this.classList.contains('on'))"></button></div>
    <div class="field"><label>Dosierung anpassen (optional)</label><input id="cs_dose" value="${a.dose&&a.dose!==s.dose?esc2(a.dose):''}" placeholder="${esc2(s.dose||'z.B. 5 g')}" maxlength="60"></div>
    <div class="field"><label>Timing anpassen (optional)</label><input id="cs_timing" value="${a.timing&&a.timing!==s.timing?esc2(a.timing):''}" placeholder="${esc2(s.timing||'z.B. morgens')}" maxlength="60"></div>
    <div class="field"><label>Persönlicher Hinweis (optional)</label><textarea id="cs_note" rows="2" maxlength="300" placeholder="z.B. wegen deiner Schlafprobleme abends">${esc2(a.note||'')}</textarea></div>
    <button class="btn block" onclick="saveCoachSupp(${sid})">Speichern</button>
    ${assigned[sid]?`<button class="btn block danger mt-2" onclick="removeCoachSupp(${sid})">Zuweisung entfernen</button>`:''}</div>`);}
async function saveCoachSupp(sid){const {uid,assigned,cat}=COACH_SUPP_CTX;const s=cat.find(x=>x.id===sid)||{};
  const body={mandatory:!!document.getElementById('cs_mand')?.classList.contains('on'),custom_dose:val('cs_dose')||null,custom_timing:val('cs_timing')||null,note:val('cs_note')||null};
  const r=await API.put('/supplements/'+uid+'/'+sid,body);
  if(r.status!==200)return showFieldErr('csEdit',r.data?.error||'Fehler');
  assigned[sid]={mandatory:body.mandatory?1:0,dose:body.custom_dose||s.dose,timing:body.custom_timing||s.timing,note:body.note};
  closeModal();drawCoachSupp();toast('Gespeichert ✓');}
async function removeCoachSupp(sid){const {uid,assigned}=COACH_SUPP_CTX;
  const r=await API.del('/supplements/'+uid+'/'+sid);
  if(r.status!==200)return toast(r.data?.error||'Fehler');delete assigned[sid];closeModal();drawCoachSupp();toast('Zuweisung entfernt');}

// ===== EXCEL-IMPORT (Coach) =====
let IMPORT={athleteId:null,athleteName:'',sheets:[],sheetIdx:0,type:'training',mapping:{},headerIdx:0};
function openImport(id,name){name=name||athName(id);
  IMPORT={athleteId:id,athleteName:name,sheets:[],sheetIdx:0,type:'training',mapping:{},headerIdx:0};
  coachSheet('Import',{id,name},`
    <div class="note mb-4">Importiere einen bestehenden Plan aus einer Excel-Datei (.xlsx). Danach ordnest du die Spalten zu und prüfst alles vor dem Übernehmen.</div>
    <label class="btn block file-btn">${icon('upload',18)} Excel-Datei wählen<input type="file" accept=".xlsx,.xls" onchange="importPick(event)"></label>
    <div class="caption center mt-3">Tipp: Eine Spalte je Angabe (Übung, Sätze, Wdh., Gewicht). Tagesnamen wie „Push" in eine eigene Spalte.</div>`);}
async function importPick(ev){
  const file=ev.target.files&&ev.target.files[0];if(!file)return;
  if(file.size>6_000_000)return toast('Datei zu groß (max. 6 MB)');
  openSheet('Import','<div class="spinner"></div>');
  const reader=new FileReader();
  reader.onload=async e=>{
    const r=await API.post('/import/parse',{file:e.target.result});
    if(r.status!==200){coachSheet('Import',{id:IMPORT.athleteId,name:IMPORT.athleteName},`<div class="note err mb-4">${esc2(r.data?.error||'Fehler beim Lesen')}</div><button class="btn block sec" onclick="openImport(${IMPORT.athleteId},'${esc(IMPORT.athleteName)}')">Andere Datei</button>`);return;}
    IMPORT.sheets=r.data.sheets;IMPORT.sheetIdx=0;
    applySheetGuess();
    drawImportMapping();
  };
  reader.readAsDataURL(file);}
function applySheetGuess(){const sh=IMPORT.sheets[IMPORT.sheetIdx];IMPORT.headerIdx=sh.headerIdx;
  IMPORT.mapping=IMPORT.type==='training'?{...sh.guessTraining}:{...sh.guessFood};}
function importSelectSheet(i){IMPORT.sheetIdx=+i;applySheetGuess();drawImportMapping();}
function importSetType(t){IMPORT.type=t;applySheetGuess();drawImportMapping();}
function importSetCol(role,v){IMPORT.mapping[role]=v===''?null:+v;drawImportMapping();}
function drawImportMapping(){
  const sh=IMPORT.sheets[IMPORT.sheetIdx];const headers=sh.headers;
  const colOpts=(sel)=>`<option value="">– keine –</option>`+headers.map((h,i)=>`<option value="${i}" ${sel===i?'selected':''}>${esc2(h||('Spalte '+(i+1)))}</option>`).join('');
  const roles=IMPORT.type==='training'
    ? [['exercise','Übung *'],['day','Tag/Einheit'],['sets','Sätze'],['reps','Wiederholungen'],['weight','Gewicht'],['notes','Notiz']]
    : [['food','Lebensmittel *'],['meal','Mahlzeit'],['amount','Menge'],['kcal','kcal'],['protein','Eiweiß'],['carbs','KH'],['fat','Fett']];
  let h='';
  if(IMPORT.sheets.length>1)h+=`<div class="field"><label>Tabellenblatt</label><select onchange="importSelectSheet(this.value)">${IMPORT.sheets.map((s,i)=>`<option value="${i}" ${i===IMPORT.sheetIdx?'selected':''}>${esc2(s.name)} (${s.rowCount} Zeilen)</option>`).join('')}</select></div>`;
  h+=`<div class="seg"><button class="${IMPORT.type==='training'?'on':''}" onclick="importSetType('training')">Training</button><button class="${IMPORT.type==='nutrition'?'on':''}" onclick="importSetType('nutrition')">Ernährung</button></div>`;
  h+=`<div class="section-label"><span>Spalten zuordnen</span></div>`;
  h+=roles.map(([role,label])=>`<div class="map-row"><div class="ml">${label}</div><select aria-label="${esc2(label)}" onchange="importSetCol('${role}',this.value)">${colOpts(IMPORT.mapping[role]??'')}</select></div>`).join('');
  const dataRows=sh.rows.slice(IMPORT.headerIdx+1).filter(r=>r.some(c=>String(c).trim()!=='')).slice(0,5);
  h+=`<div class="section-label"><span>Vorschau</span><span class="sl-r">erste Zeilen</span></div><div class="import-wrap"><table class="import-table">
    <tr>${headers.map(hd=>`<th>${esc2(hd)}</th>`).join('')}</tr>
    ${dataRows.map(r=>`<tr>${headers.map((_,i)=>`<td>${esc2(r[i]||'')}</td>`).join('')}</tr>`).join('')}
  </table></div>`;
  if(IMPORT.type==='nutrition')h+=`<div class="field"><label>Gilt für</label><select id="imp_daytype"><option value="training">Trainingstag</option><option value="rest">Ruhetag</option></select></div>`;
  const req=IMPORT.type==='training'?IMPORT.mapping.exercise!=null:IMPORT.mapping.food!=null;
  h+=`<button class="btn block" ${req?'':'disabled'} onclick="doImport()">${icon('check',18)} Plan übernehmen</button>
    ${req?'':'<div class="caption center mt-2 tone-red">Bitte die Pflichtspalte (*) zuordnen.</div>'}
    <button class="btn block sec mt-2" onclick="openImport(${IMPORT.athleteId},'${esc(IMPORT.athleteName)}')">Andere Datei</button>`;
  coachSheet('Import',{id:IMPORT.athleteId,name:IMPORT.athleteName},h);}
async function doImport(){
  const sh=IMPORT.sheets[IMPORT.sheetIdx];
  const dayType=document.getElementById('imp_daytype')?.value||'training'; // VOR dem Ersetzen des Sheets lesen
  openSheet('Import','<div class="spinner"></div>');
  let r;
  if(IMPORT.type==='training')r=await API.post('/import/apply-training/'+IMPORT.athleteId,{rows:sh.rows,mapping:IMPORT.mapping,headerIdx:IMPORT.headerIdx,planName:'Import: '+sh.name});
  else r=await API.post('/import/apply-nutrition/'+IMPORT.athleteId,{rows:sh.rows,mapping:IMPORT.mapping,headerIdx:IMPORT.headerIdx,dayType});
  if(r.status!==200){coachSheet('Import',{id:IMPORT.athleteId,name:IMPORT.athleteName},`<div class="note err mb-4">${esc2(r.data?.error||'Fehler')}</div><button class="btn block sec" onclick="drawImportMapping()">Zurück zur Zuordnung</button>`);return;}
  const d=r.data;if(VIEW_USER===IMPORT.athleteId){PLAN=null;TODAY=null;}coachInvalidate();
  coachSheet('Import',{id:IMPORT.athleteId,name:IMPORT.athleteName},`<div class="center">
    <div class="import-ok">${icon('check',32)}</div>
    <div class="h2 mb-1">Übernommen</div>
    <div class="body muted mb-2">${IMPORT.type==='training'?`${pl(d.days,'Trainingstag','Trainingstage')} mit ${pl(d.exercises,'Übung','Übungen')}`:`${pl(d.meals,'Mahlzeit','Mahlzeiten')} mit ${pl(d.items,'Lebensmittel','Lebensmitteln')}`} für ${esc2(IMPORT.athleteName)}.</div>
    ${IMPORT.type==='training'?'<div class="caption mb-4">Der Athlet wurde benachrichtigt.</div>':'<div class="mb-4"></div>'}
    <button class="btn block" onclick="closeAllSheets();openDashboard(${IMPORT.athleteId})">Fertig</button>
  </div>`);
  toast('Import erfolgreich ✓');}

// ===== PLAN-VORLAGEN (Coach) =====
// Was beim Zuweisen wirklich passiert – an EINER Stelle, damit die drei Einstiege (Sheet, Athleten-
// Auswahl, Rückfrage im Plan) dasselbe versprechen. Vorher stand dort „geloggte Sätze gehen nicht
// verloren", während die neuen Übungszeilen den Verlauf tatsächlich abgeschnitten haben (letztes
// Datum leer, Bestgewicht 0). Der Server hängt den Verlauf jetzt am Übungsnamen auf – gleich
// benannte Übungen bringen ihn mit, wirklich neue Übungen haben naturgemäß noch keinen.
const coTplHistoryNote='Geloggte Sätze bleiben. Übungen mit demselben Namen bringen Verlauf und Bestwerte mit, wirklich neue Übungen starten ohne Empfehlung.';
function saveAsTemplate(){const name=COACH_CONTEXT||athName(VIEW_USER);
  coachSheet('Als Vorlage speichern',{id:VIEW_USER,name},`<div id="tplBox">
    <div class="note mb-4">Speichert den aktuellen Plan als wiederverwendbare Vorlage – z.B. „Push/Pull/Legs Anfänger". Du kannst sie jedem Athleten mit einem Tipp zuweisen.</div>
    <div class="field"><label>Name der Vorlage</label><input id="tpl_name" placeholder="z.B. Oberkörper/Unterkörper 4x" maxlength="80"></div>
    <button class="btn block" onclick="doSaveTemplate()">Speichern</button></div>`);}
async function doSaveTemplate(){const name=val('tpl_name');if(!name)return showFieldErr('tplBox','Bitte einen Namen eingeben.','tpl_name');
  const r=await API.post('/templates',{name,from_user_id:VIEW_USER});
  if(r.status===200){closeModal();toast('Vorlage gespeichert ✓ ('+pl(r.data.days,'Tag','Tage')+')');}else showFieldErr('tplBox',r.data?.error||'Fehler');}
async function openTemplates(){openSheet('Vorlagen','<div class="spinner"></div>');
  const r=await API.get('/templates');const list=r.data?.templates||[];const inCtx=coachView();
  if(!list.length){openSheet('Vorlagen',emptyState({icon:'fileSpreadsheet',title:'Noch keine Vorlagen',text:inCtx?'Speichere zuerst diesen Plan als Vorlage.':'Speichere im Plan eines Athleten „Als Vorlage speichern".',btn:inCtx?{label:'Als Vorlage speichern',onclick:'saveAsTemplate()'}:null}));return;}
  let h=inCtx?`<div class="note warn mb-4">Beim Anwenden wird der aktuelle Plan von ${esc2(COACH_CONTEXT)} ersetzt (der alte bleibt deaktiviert erhalten). ${coTplHistoryNote}</div>`
    :`<div class="meta mb-3">Tippe eine Vorlage an und wähle den Athleten.</div>`;
  // Ohne Athleten-Kontext führt die Zeile in die Athleten-Auswahl (coTplApplyTo) statt in eine Sackgasse.
  h+=`<div class="rows">`+list.map(t=>`<div class="row tap" role="button" tabindex="0" onclick="${inCtx?`applyTemplate(${t.id},'${esc(t.name)}')`:`coTplApplyTo(${t.id},'${esc(t.name)}')`}"><div class="r-ic">${icon('fileSpreadsheet')}</div>
    <div class="rl">${esc2(t.name)}<small>${pl(t.days,'Tag','Tage')} · ${pl(t.exercises,'Übung','Übungen')}</small></div>
    <div class="rr"><button class="btn icon sm ghost tpl-del" aria-label="Vorlage löschen" onclick="event.stopPropagation();delTemplate(${t.id},'${esc(t.name)}')">${icon('trash',18)}</button></div></div>`).join('')+`</div>`;
  openSheet('Vorlagen',h);}
// Vorlage zuweisen in 2 Tipps: Zeile antippen (1) → Athlet antippen (2). Der Warnhinweis steht ÜBER der
// Auswahl – der zweite Tipp ist damit die bewusste Bestätigung, kein zusätzlicher Rückfrage-Dialog.
async function coTplApplyTo(tid,tname){
  openSheet('Vorlage zuweisen','<div class="spinner"></div>');
  let list=ATHLETES_CACHE||[];
  if(!list.length){const r=await API.get('/athletes');list=r.data?.athletes||[];if(list.length)ATHLETES_CACHE=sortAthletes(list);list=ATHLETES_CACHE;}
  if(!list.length)return openSheet('Vorlage zuweisen',emptyState({icon:'users',title:'Noch keine Athleten',text:'Lege zuerst einen Athleten an – dann kannst du ihm diese Vorlage zuweisen.',btn:{label:'Athlet hinzufügen',onclick:'addAthlete()'}}));
  const h=`<div class="note warn mb-3"><b>„${esc2(tname)}"</b> ersetzt den aktuellen Plan des Athleten. Der alte Plan bleibt deaktiviert erhalten. ${coTplHistoryNote}</div>
    <div class="rows">`+list.map(a=>`<button type="button" class="row tap ad-row" onclick="coTplApply(${tid},'${esc(tname)}',${a.id},'${esc(a.name)}')">${athAvatar(a.id,a.name,'sm')}
      <span class="rl">${esc2(a.name)}<small>${esc2([a.goal?goalLabel(a.goal):'',coPlannedRate(a)!=null?coRateLabel(coPlannedRate(a)):''].filter(Boolean).join(' · '))}</small></span></button>`).join('')+`</div>`;
  openSheet('Vorlage zuweisen',h);loadAthAvatars(list.filter(a=>a.has_avatar).map(a=>a.id));}
async function coTplApply(tid,tname,uid,uname){
  const r=await API.post('/templates/'+tid+'/apply/'+uid,{});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  if(VIEW_USER===uid){PLAN=null;TODAY=null;}
  coachInvalidate();closeAllSheets();
  toast('„'+tname+'" ist jetzt der Plan von '+uname+' ✓');}
function applyTemplate(id,name){
  confirmSheet('Vorlage anwenden',`„${name}" auf ${COACH_CONTEXT||'diesen Athleten'} anwenden? Der aktuelle Plan wird ersetzt. ${coTplHistoryNote}`,{label:'Anwenden',danger:false,onYes:async()=>{
    const r=await API.post('/templates/'+id+'/apply/'+VIEW_USER,{});
    if(r.status===200){closeAllSheets();PLAN=null;TODAY=null;coachInvalidate();toast('Plan zugewiesen ✓');go('workout');}else toast(r.data?.error||'Fehler');}});}
function delTemplate(id,name){
  confirmSheet('Vorlage löschen',`„${name||'Vorlage'}" löschen? Bereits zugewiesene Pläne bleiben erhalten.`,{onYes:async()=>{await API.del('/templates/'+id);toast('Vorlage gelöscht');
    const v=document.getElementById('views');
    if(document.getElementById('tplPage')&&v){if(typeof invalidateView==='function')invalidateView('templates');renderTemplatesTab(v,{});}
    else openTemplates();}});}

// ===== Kleine Grafik-Helfer, die nur der Coach-Bereich nutzt =====
function barchart(vals){if(!vals.length)return'';const mx=Math.max(...vals)||1;const w=480,h=110,n=vals.length,bw=Math.min(48,(w-20)/n-8);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${vals.map((v,i)=>{const bh=(v/mx)*(h-24);const x=10+i*((w-20)/n)+( (w-20)/n - bw)/2;const y=h-bh-4;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="var(--red)" opacity="${(0.4+0.6*v/mx).toFixed(2)}"/>`;}).join('')}</svg>`;}
// Der Ernährungs-Plan-Menü- und der Barcode-Flow leben heute in ihren eigenen Dateien (training.js/diet.js).
// Alte globale Namen bleiben als Alias erreichbar, damit kein alter onclick ins Leere läuft.
if(typeof window.logBarcodeProduct!=='function'&&typeof logScannedProduct==='function')window.logBarcodeProduct=logScannedProduct;

// ===== A-IV.7 · LEISTUNG IN DER PLANZEILE (B4, PLAN-25 A-IV.7/4) =====
// Der Coach sah im Plan-Editor bisher NUR die Vorgabe: „Incline Smith Machine Press · 3 × 6-10 · Chest".
// Was der Athlet daraus gemacht hat, stand eine Ansicht weiter (Analyse) oder gar nicht da – gemessen an
// Marcos Konto: 27 Planzeilen, null Leistungszahlen (shots-a4/A-IV.7/00-vorher-planzeile.png).
// Jede Planzeile traegt jetzt eine zweite Zeile: „zuletzt 72,5 kg × 10/9/8 · Best 82,5 kg".
//
// Woher die Zahlen kommen: GET /api/progression/:uid?day=<id> – EINE Anfrage je Trainingstag fuer ALLE
// Uebungen (dieselbe Batch-Route, die die Athleten-Ansicht schon benutzt, server.js:4747). Kein neuer
// Server-Code, keine N+1-Schleife. `lastSets` ist die letzte Einheit VOR heute, `prs.maxWeight` das
// schwerste je geloggte Gewicht derselben BEWEGUNG (nicht der Uebungs-ID – sonst waere der Verlauf nach
// jeder zugewiesenen Vorlage weg, server.js:4759 movementSetLogs).
//
// Warum ein Beobachter und kein Eingriff in den Zeilen-Bauplan: `_exRowCoach()` gehoert `training.js`
// (Paket A-IV.2). Zwei Pakete duerfen dieselbe Funktion nicht besitzen (BUILD-A4 Regel 1/2). Die Zeile
// wird deshalb NACH dem Zeichnen ergaenzt – der Plan zeichnet unveraendert, die Leistung kommt dazu.
// Faellt die Route aus, bleibt die Planzeile exakt die alte: kein Platzhalter, keine Fehlermeldung.
let CO2_PROG={};              // 'uid|dayId' -> items aus /api/progression (eine Antwort je Tag)
let CO2_OBS=null;             // MutationObserver auf #views, nur im Athleten-Kontext aktiv
let CO2_TICK=false;           // rAF-Sperre: ein Durchlauf je Bild, egal wie viele Mutationen kamen
let CO2_PROG_BUSY='';         // laufender Abruf (Schluessel), verhindert Doppelanfragen
let CO2_FLAGS={};             // athleten-id -> offene Beschwerden, falls kein Dashboard-Cache vorliegt
let CO2_FLAG_BUSY='';         // laufender Abruf der Beschwerden (Athleten-id)

// 72,5 -> „72,5", 60 -> „60". fmtNum() kommt aus core.js und macht das Dezimalkomma.
function co2W(v){const n=Number(v)||0;return fmtNum(n,Number.isInteger(n)?0:1);}
// „72,5 kg × 10/9/8" bei gleichem Gewicht; wechselt es innerhalb der Einheit, steht es an jedem Satz.
// Saetze ohne Wiederholungen (Phantom-Zeilen) zaehlen nicht – genauso wie auf dem Server.
function co2SetsTxt(sets){
  const s=(sets||[]).filter(x=>Number(x.reps)>0);
  if(!s.length)return '';
  const ws=[...new Set(s.map(x=>Number(x.weight)||0))];
  // Die Einheit MUSS dran: „zuletzt 62,5 × 10/9/8 · Best 62,5 kg" las sich in der ersten Fassung so,
  // als truege nur die Bestleistung Kilo (06-planzeile-leistung.png, erste Aufnahme). Bei gleichem
  // Gewicht steht sie einmal, bei wechselndem an jedem Satz – Drop- und Backoff-Saetze sind sonst
  // nicht auseinanderzuhalten.
  if(ws.length===1)return co2W(ws[0])+' kg × '+s.map(x=>x.reps).join('/');
  return s.map(x=>co2W(x.weight)+' kg×'+x.reps).join(' · ');}
// Die Zusatzzeile einer Planzeile. `p` = ein Eintrag aus /api/progression items, `note` = offene
// Beschwerde des Athleten zu genau dieser Uebung (aus /api/flagged-notes, liegt im COACH_DASH-Cache).
function planRowPerfHTML(p,note){
  p=p||{};
  const parts=[];
  const sets=co2SetsTxt(p.lastSets);
  // Ab zwei Wochen Pause ist „zuletzt 72,5 × 10" ohne Datum irrefuehrend – dann kommt das Alter dazu.
  if(sets)parts.push('zuletzt '+sets+(p.gapDays!=null&&p.gapDays>=14?' ('+daysAgoTxt(p.lastDate)+')':''));
  const best=Number(p.prs&&p.prs.maxWeight)||0;
  if(best>0)parts.push('Best '+co2W(best)+' kg');
  let h=parts.length
    ? `<small class="co2-perf">${esc2(parts.join(' · '))}</small>`
    : `<small class="co2-perf none">noch nicht geloggt</small>`;
  // Gekuerzt wird auf der letzten WORTGRENZE, nicht mitten im Wort: „…bei der letzten Wiederholu…" war
  // schwerer zu lesen als der ganze Satz (07-planzeile-beschwerde.png, erste Aufnahme). 120 Zeichen sind
  // drei Zeilen – laenger schiebt die naechste Uebung aus dem Bild, kuerzer sagt nichts mehr.
  if(note){const t=String(note.note||'').trim();
    let s=t;
    if(t.length>120){const cut=t.slice(0,120);const sp=cut.lastIndexOf(' ');s=(sp>70?cut.slice(0,sp):cut)+'…';}
    h+=`<small class="co2-perf flag">${icon('alertTriangle',12)} ${esc2(s)}</small>`;}
  return h;}
// Zeichnet die Zusatzzeilen in die bereits stehende Liste. Bricht in zwei Pruefungen ab, wenn gerade
// keine Coach-Planliste auf dem Schirm ist – das ist der Normalfall und muss billig sein.
async function co2PerfDraw(){
  if(typeof coachView!=='function'||!coachView()||!VIEW_USER)return;
  const box=document.querySelector('#exlist .plan-rows');if(!box)return;
  const rows=box.querySelectorAll('.row[data-id]');if(!rows.length)return;
  const day=(typeof curDayObj==='function')?curDayObj():null;
  const dayId=day?day.id:(typeof CUR_DAY!=='undefined'?CUR_DAY:null);
  if(!dayId)return;
  const key=VIEW_USER+'|'+dayId;
  let items=CO2_PROG[key];
  if(!items){
    if(CO2_PROG_BUSY===key)return;
    CO2_PROG_BUSY=key;
    const r=await API.get('/progression/'+VIEW_USER+'?day='+dayId);
    CO2_PROG_BUSY='';
    // Kein Platzhalter, keine rote Zeile: ohne Antwort bleibt der Plan genau so stehen wie vorher.
    if(r.status!==200||!r.data||typeof r.data.items!=='object')return;
    items=CO2_PROG[key]=r.data.items;
    if(!document.querySelector('#exlist .plan-rows'))return;   // Tag/Tab inzwischen gewechselt
  }
  // Offene Beschwerden zu genau diesen Uebungen. Kommt der Coach ueber das Athleten-Blatt, liegen sie
  // schon im Cache; springt er direkt in den Plan (Kontextleiste, Tiefenlink, Neuladen), lagen sie
  // bisher NICHT vor – und die Beschwerde, wegen der er den Plan oeffnet, stand ausgerechnet dort nicht.
  // Eine Anfrage, einmal je Athlet, nur im Coach-Blick.
  if(!COACH_DASH[VIEW_USER]&&CO2_FLAG_BUSY!==VIEW_USER){
    const uid=CO2_FLAG_BUSY=VIEW_USER;
    const fr=await API.get('/flagged-notes/'+uid);
    CO2_FLAG_BUSY='';
    if(fr.status===200&&fr.data&&Array.isArray(fr.data.notes))CO2_FLAGS[uid]=fr.data.notes;
    if(VIEW_USER!==uid||!document.querySelector('#exlist .plan-rows'))return;
  }
  const fl=((COACH_DASH[VIEW_USER]||{}).flagged)||CO2_FLAGS[VIEW_USER]||[];
  document.querySelectorAll('#exlist .plan-rows .row[data-id]').forEach(row=>{
    if(row.querySelector('.co2-perf'))return;                  // schon beschriftet
    const id=Number(row.dataset.id),rl=row.querySelector('.rl');
    if(!rl)return;
    rl.insertAdjacentHTML('beforeend',planRowPerfHTML(items[id],fl.find(n=>n.exercise_id===id)));});}
// Ein Durchlauf je Bild. Die eigene Einfuegung loest den Beobachter erneut aus; beim zweiten Durchlauf
// tragen alle Zeilen schon eine .co2-perf und es passiert nichts mehr – zwei Bilder, dann Ruhe.
function co2PerfTick(){if(CO2_TICK)return;CO2_TICK=true;
  const run=()=>{CO2_TICK=false;co2PerfDraw();};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,16);}
// Start/Stopp haengen am Athleten-Kontext (coachEnter / coachLeaveAthlete), nicht an der App:
// ausserhalb des Kontexts laeuft kein Beobachter.
function co2PerfWatch(){
  if(CO2_OBS||typeof MutationObserver!=='function')return;
  const v=document.getElementById('views');if(!v)return;
  CO2_OBS=new MutationObserver(co2PerfTick);
  CO2_OBS.observe(v,{childList:true,subtree:true});
  co2PerfTick();}
function co2PerfStop(){if(CO2_OBS){CO2_OBS.disconnect();CO2_OBS=null;}
  CO2_PROG={};CO2_PROG_BUSY='';CO2_FLAGS={};CO2_FLAG_BUSY='';}

/* =====================================================================================
   B-I.6 · WOCHEN-REVIEW-INBOX, PIVOT UND FREIGABE DER ZIELANPASSUNG   (Praefix `rv`)
   =====================================================================================
   WARUM ES DAS GIBT. Coachway misst den Unterschied zwischen 12–15 Minuten und 2–3 Minuten
   je Athlet an genau einer Sache: ob die Woche eines Athleten auf EINEM Bildschirm steht –
   Zahlen, Beschwerden, offene Nachrichten – und ob die Antwort DARUNTER steht statt in einem
   zweiten Fenster (RESEARCH-25-coaching K4/Q47, Abschnitt 5). Bis 2.9.0 hatte der Coach dafuer
   je Athlet ein Sheet zu oeffnen, darin zu lesen, es zu schliessen und im Nachrichten-Tab
   weiterzumachen. Die Wochen-Review-Inbox ist das Gegenstueck zum Wochenrueckblick des
   Athleten (`#tracker/woche`) – RATE-25-coach, „Was 12 von 10 waere" Nr. 2.

   DIE ZAHLEN KOMMEN AUS EINER RECHNUNG, NICHT AUS EINER ZWEITEN (P3).
     · Woche:      GET /api/weekreport/:id?start=  (Paket B-I.2, BUILD-B1 Abschnitt 4.4).
                   Fehlt die Route (Status 404), faellt die Karte auf GET /api/week/:id?start=
                   zurueck – das ist dieselbe Rechnung, aus der der Athlet seinen Wochenrueckblick
                   liest (server.js weekView). „Eine Berechnung, zwei Tonlagen" gilt damit ab
                   heute und nicht erst nach dem Server-Update. Der Fallback wird EINMAL je
                   Sitzung festgestellt und dann fuer alle Athleten benutzt – nicht 30-mal probiert.
     · Ampel/Grund: dasselbe Aufmerksamkeits-Modell wie Liste, Dashboard und Kontextleiste
                   (`athleteStatus`, `reasonLine`). Kein zweiter Regelsatz, keine zweite Farbe.
     · Beschwerden: `openFlags` der Listenzeile; der Text nur fuer Athleten mit offenen
                   Beschwerden (GET /api/flagged-notes/:id) – sonst zahlt jeder ruhige Athlet
                   eine Abfrage fuer eine leere Liste.
     · Nachrichten: EIN Aufruf fuer alle Athleten (`coachThreads()` -> GET /api/messages/:me),
                   nicht einer je Karte.
     · Zielanpassung: `kcalAsk` aus GET /api/dashboard/:id – und nur fuer Athleten, deren Woche
                   ueberhaupt Aktivitaet zeigt. Wer nichts geloggt hat, hat auch kein Ziel,
                   das nachzufuehren waere.

   MIT EINEM ATHLETEN SINNVOLL, MIT DREISSIG NICHT ZUSAMMENGEBROCHEN (DECISIONS F2).
   Die Karten stehen SOFORT da (aus der Athletenliste, die der Tab ohnehin geladen hat), die
   Zahlen fuellen sich nach. Die Abrufe laufen zu dritt (RV_PAR) in Listenreihenfolge, jedes
   Ergebnis wird je Athlet und Woche gemerkt (RV_DATA) und nur die betroffene Karte neu
   gezeichnet – nie die Liste. Gemessen auf dem Pruefstand: 14 Athleten, GET /api/week 5–8 ms
   je Aufruf. Keine Paginierung, kein „Mehr laden", kein Virtualisieren: das waere Maschinerie
   fuer Zahlen, die es nicht gibt.

   WAS DIE INBOX NICHT TUT: sie stellt keine Note aus. Der Athlet sieht seine Compliance-Prozente
   nie (RESEARCH-25-coaching Abschnitt 7 Punkt 5) – sie stehen hier, im Werkzeug des Coaches.
   Und sie schickt nichts von allein: jede Anpassung ist ein Vorschlag mit Begruendung, den der
   Coach freigibt (P10). */
let RV_TAB='list';         // 'list' = Athletenliste (Standard, unveraendert) | 'week' = Wochen-Review
let RV_WEEK=0;             // 0 = letzte abgeschlossene Woche (Standard), 1 = laufende Woche
let RV_DATA={};            // 'uid|start' -> {state:'load'|'ok'|'err', w, flags, ask, status}
let RV_THREADS=null;       // {ts, by:{uid:{unread,last}}} – EIN Postfach-Aufruf fuer alle Karten
let RV_DRAFT={};           // uid -> angefangene Antwort (uebersteht Neuzeichnen und Wochenwechsel)
let RV_KEPT={};            // uid -> true: Zielanpassung in dieser Sitzung bewusst nicht uebernommen
let RV_SENT={};            // uid -> Zeitstempel der aus der Inbox gesendeten Antwort
let RV_WR=null;            // null = /api/weekreport noch nicht probiert, true/false = Ergebnis
let RV_SPAN=null;          // {key,start,end} – das Fenster, das der Server fuer diese Woche nennt
let RV_QUEUE=[],RV_BUSY=0;
const RV_PAR=3;            // gleichzeitige Wochenabrufe

// --- Wochenfenster. Montag als Wochenbeginn, reine UTC-Arithmetik (keine Sommerzeit-Drift) ---
// Der Server rechnet in seiner Zeitzone (`mondayOf(tzToday())`); der Client kennt sie nicht.
// Deshalb SCHICKT er nur einen Montag mit und LIEST das Fenster, das die Antwort nennt
// (`start`/`end`) – die Beschriftung der Karte kommt nie aus der eigenen Rechnung.
function rvMonday(iso){const t=Date.parse(String(iso||today())+'T00:00:00Z');if(isNaN(t))return today();
  const d=new Date(t);return new Date(t-((d.getUTCDay()+6)%7)*864e5).toISOString().slice(0,10);}
function rvWeekStart(){const m=rvMonday(today());return RV_WEEK?m:(coIsoAdd(m,-7)||m);}
// „7.–13. Sept." – aber „28. Sept.–4. Okt.", wenn die Woche ueber den Monatswechsel laeuft.
// Der Monatsname faellt nur weg, wenn beide Tage wirklich denselben tragen; sonst stuende da
// „28.–4. Okt." und der September waere verschwunden.
function rvSpanTxt(start,end){if(!start)return '';
  end=end||coIsoAdd(start,6);
  const a=fmtDate(start),b=fmtDate(end);
  if(!a||!b)return a||'';
  const ma=String(a).replace(/^\d+\.\s*/,''),mb=String(b).replace(/^\d+\.\s*/,'');
  return (ma&&ma===mb?a.replace(/\s*\S+$/,''):a)+'–'+b;}

// --- Reiter ueber der Athletenliste ---------------------------------------------------------
// Zwei Reiter, WAI-ARIA-Muster wie in der Verwaltung (ein Tab-Stopp, Pfeiltasten, Pos1/Ende).
// „Athleten" bleibt der Standard: die Liste ist der Einstieg, den jeder Fluss dieser App kennt
// (tapcount `coach_msg` tippt die erste `.ath-row` an) – die Inbox ist der zweite Reiter,
// kein neuer erster Bildschirm.
const RV_TABS=[['list','Athleten'],['week','Wochen-Review']];
function rvTabsHTML(){return `<div class="seg rv-seg" role="tablist" aria-label="Ansicht der Athleten" onkeydown="rvTabKey(event)">`+
  RV_TABS.map(([k,l])=>{const on=RV_TAB===k;
    return `<button type="button" role="tab" id="rvTab-${k}" aria-selected="${on?'true':'false'}" tabindex="${on?'0':'-1'}" aria-controls="athBody" class="${on?'on':''}" onclick="rvSetTab('${k}')">${l}</button>`;}).join('')+`</div>`;}
function rvTabKey(e){if(e.altKey||e.ctrlKey||e.metaKey)return;
  const step={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.key];
  const id=(document.activeElement||{}).id||'';
  let i=RV_TABS.findIndex(t=>'rvTab-'+t[0]===id);if(i<0)i=Math.max(0,RV_TABS.findIndex(t=>t[0]===RV_TAB));
  let n=null;
  if(step)n=(i+step+RV_TABS.length)%RV_TABS.length;
  else if(e.key==='Home')n=0;else if(e.key==='End')n=RV_TABS.length-1;else return;
  e.preventDefault();rvSetTab(RV_TABS[n][0],true);}
function rvSetTab(k,focus){if(!RV_TABS.some(t=>t[0]===k))return;RV_TAB=k;
  document.querySelectorAll('.rv-seg [role="tab"]').forEach(b=>{const on=b.id==='rvTab-'+k;
    b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false');b.setAttribute('tabindex',on?'0':'-1');
    if(on&&focus)try{b.focus();}catch(e){}});
  const body=document.getElementById('athBody');if(!body)return;
  body.setAttribute('aria-labelledby','rvTab-'+k);
  body.innerHTML=k==='week'?rvInboxHTML():coachListHTML();
  if(k==='week')rvAfterDraw();else{drawAthleteList(coachVisibleAthletes());}}
// EIN Sieb fuer beide Reiter: Filter-Chips und Suche wirken auf Liste UND Inbox (coachSetFilter /
// filterAthletes rufen das hier). Sonst zeigte derselbe Chip „Alarm 1" zwei verschiedene Mengen.
function rvAfterFilter(){if(RV_TAB!=='week')return false;
  const b=document.getElementById('rvCards');if(!b)return true;
  b.innerHTML=rvCardsHTML();rvAfterDraw();return true;}

// --- Die Inbox --------------------------------------------------------------------------------
// Suche und Filter-Chips sind DIESELBEN wie im Reiter „Athleten" (gleiche Kennungen, gleiche
// Funktionen) – ein Sieb, zwei Darstellungen. Wer in der Liste auf „Alarm" gefiltert hat, findet
// im Review dieselben Athleten, nicht plötzlich alle.
function rvInboxHTML(){const list=ATHLETES_CACHE||[];
  let h=`<div class="rv-bar">${rvWeekBtnHTML()}</div>`;
  if(list.length>5)h+=`<input class="field ath-search" id="athSearch" type="search" placeholder="Athlet suchen" oninput="filterAthletes(this.value)" value="${esc2(COACH_QUERY)}">`
    +`<div class="chip-row wrap co-filters" id="athFilters">${coachFilterChipsHTML(list)}</div>`;
  return h+rvSrcHTML()+`<div class="rv-cards" id="rvCards">${rvCardsHTML()}</div>`;}
// Zwei Knoepfe, kein Datumsblaetterer: der Review findet fuer die abgeschlossene Woche statt, und
// wer am Sonntagabend schon schauen will, braucht die laufende. Alles dazwischen ist Archiv – das
// steht im Wochenrueckblick des Athleten, mit Blaetterpfeilen, die es dort schon gibt.
function rvWeekBtnHTML(){
  const b=(v,l)=>`<button type="button" class="chip${RV_WEEK===v?' on':''}" aria-pressed="${RV_WEEK===v}" onclick="rvSetWeek(${v})">${l}</button>`;
  return `<div class="chip-row rv-weeks">${b(0,'Letzte Woche')}${b(1,'Diese Woche')}</div>
    <div class="rv-span">${esc2(rvSpanNow())}</div>`;}
// Das Fenster der gewaehlten Woche – so, wie der Server es genannt hat, sonst wie der Client es
// gewaehlt hat. Beide Beschriftungen (Knopfzeile und Herkunftszeile) lesen dieselbe Stelle.
function rvSpanNow(){const k=rvWeekStart();
  return (RV_SPAN&&RV_SPAN.key===k)?rvSpanTxt(RV_SPAN.start,RV_SPAN.end):rvSpanTxt(k,coIsoAdd(k,6));}
function rvSetWeek(v){v=v?1:0;if(RV_WEEK===v)return;RV_WEEK=v;
  const body=document.getElementById('athBody');if(!body)return;
  body.innerHTML=rvInboxHTML();rvAfterDraw();}
function rvCardsHTML(){
  const list=coachVisibleAthletes();
  if(!list.length)return (ATHLETES_CACHE||[]).length
    ? emptyState({icon:'filter',title:'Niemand in diesem Filter',text:'Kein Athlet passt zu Filter und Suche.',btn:{label:'Alle zeigen',onclick:"coachSetFilter('all')"}})
    : emptyState({icon:'users',title:'Noch keine Athleten',text:'Sobald du einen Athleten hast, steht seine Woche hier auf einer Karte.',btn:{label:'Athlet hinzufügen',onclick:'addAthlete()'}});
  return list.map(a=>rvCardHTML(a)).join('');}
function rvCardHTML(a){
  const id=a.id,name=a.name||'Athlet',first=String(name).split(' ')[0];
  const st=athleteStatus(a),reasons=st.reasons||[];
  return `<article class="rv-card" id="rv-c-${id}">
    <div class="rv-h">
      <button type="button" class="rv-name" onclick="openDashboard(${id})" aria-label="Profil von ${esc2(name)} öffnen">
        ${athAvatar(id,name,'sm')}<span class="nm">${esc2(name)}</span></button>
      ${st.status!=='ok'?attPill(st.status):''}</div>
    ${reasons.length?`<div class="rv-reason ${st.status}">${reasonLine(reasons)}</div>`:''}
    <div class="rv-d" id="rv-d-${id}">${rvDynHTML(a)}</div>
    <div class="rv-reply">
      <label class="rv-lbl" for="rv-t-${id}">Antwort an ${esc2(first)}</label>
      <textarea id="rv-t-${id}" rows="2" maxlength="2000" placeholder="Kurz zurückmelden – ein Satz reicht." oninput="rvDraft(${id},this.value)">${esc2(RV_DRAFT[id]||'')}</textarea>
      <div class="rv-acts">
        <button type="button" class="btn sm sec rv-send" onclick="rvSend(${id})">${icon('send',16)} Senden</button>
        <button type="button" class="btn sm sec" onclick="rvPivot(${id},'${esc(name)}')">${icon('refresh',16)} Heute ändern</button>
        <button type="button" class="btn sm sec" onclick="openThread(${id},'${esc(name)}')">${icon('mail',16)} Unterhaltung</button>
      </div>
      <div class="rv-hint" id="rv-s-${id}" role="status">${RV_SENT[id]?'Antwort gesendet ✓':''}</div>
    </div></article>`;}
// Der Teil der Karte, der sich mit den Daten aendert – und nur dieser wird nachgezeichnet.
// Das Antwortfeld darunter bleibt stehen: ein halb getippter Satz darf nicht verschwinden,
// weil eine Antwort aus dem Netz eintrifft.
function rvDynHTML(a){
  const id=a.id,key=id+'|'+rvWeekStart(),e=RV_DATA[key];
  if(!e||e.state==='load')return `<div class="rv-load">${skeleton(1,'sm')}</div>`;
  if(e.state==='err')return `<div class="note warn rv-err">${esc2(rvErrTxt(e))}</div>`;
  const w=e.w||{};
  return rvNumsHTML(a,w,e)+rvLinesHTML(w,!!(e.flags||[]).length,rvQuiet(a,w))+rvFactsHTML(w)+rvFlagsHTML(a,e)+rvGoalHTML(a,e)+rvMsgHTML(a);}
// Eine Woche ohne jede Spur: kein Training, kein Rekord, keine Beschwerde, keine ungelesene
// Nachricht, kein Gewicht, kein Logtag. Die Karte sagt das dann in EINEM Satz.
function rvQuiet(a,w){const tr=w.training||{},nu=w.nutrition||{},bo=w.body||{};
  return !(Number(tr.sessions)||0)&&!(Number(tr.prs)||0)&&!(Number(a.openFlags)||0)&&!rvUnread(a.id)
    &&bo.delta==null&&!(Number(nu.daysLogged)||0);}
function rvErrTxt(e){
  if(e.status===403||e.status===401)return 'Kein Coach-Zugriff auf diese Woche – die Sitzung oder die Zuordnung hat gewechselt.';
  if(e.status===404)return 'Diesen Athleten gibt es nicht mehr.';
  return 'Die Woche konnte nicht geladen werden (Status '+(e.status||'?')+'). Die Karte zeigt deshalb keine Zahlen – nicht „null Trainings".';}
// Sechs Zellen, jede eine Zahl und ein Wort. Die Farbe traegt NUR die Compliance, und zwar aus
// demselben Toleranzband wie die Kennzahl-Kachel im Athleten-Blatt (coachKpiTone/-Band): 80–120 %
// ist der Plan. Fuer die LAUFENDE Woche wird nicht eingefaerbt – eine Woche, die noch laeuft, ist
// keine verfehlte Woche (dieselbe Regel wie in coachKpiHTML).
// LEERE ZELLEN SIND KEINE INFORMATION. Bei dreizehn Athleten ohne eine einzige Eintragung standen
// hier dreizehnmal „0 Rekorde · 0 Beschwerden · – Gewicht · 0 ungelesen" untereinander – 630 px
// Karte je Athlet, gemessen an 01-inbox-390.png (erste Aufnahme). Gezeigt wird deshalb, was etwas
// SAGT: die Trainings immer (0/4 ist die Aussage), der Rest nur, wenn er nicht null ist. Eine Woche
// ganz ohne Spur bekommt eine Zeile statt einer Zahlenwand – und das Antwortfeld behält sie, denn
// genau diese Athleten sind die, die eine Nachricht brauchen.
function rvNumsHTML(a,w,e){
  const tr=w.training||{},nu=w.nutrition||{},bo=w.body||{};
  const cell=(v,l,tone,title)=>`<div class="rv-n${tone?' tone-'+tone:''}"${title?` title="${esc(title)}"`:''}><span class="v">${v}</span><span class="l">${esc2(l)}</span></div>`;
  const done=Number(tr.sessions)||0,plan=Number(tr.planned)||0;
  const pct=plan>0?Math.round(done/plan*100):null;
  const running=!!w.current;
  const prs=Number(tr.prs)||0,f=Number(a.openFlags)||0,un=rvUnread(a.id),d=bo.delta,fed=Number(nu.daysLogged)||0;
  const c1=cell(`${fmtNum(done)}<em>/${plan>0?fmtNum(plan):'–'}</em>`,'Trainings',
    (!running&&pct!=null)?coachKpiTone(pct):'',plan>0?(pct+' % – '+coachKpiBand(pct)):'Kein Wochenziel hinterlegt');
  if(rvQuiet(a,w))
    return `<div class="rv-nums quiet">${c1}<div class="rv-quiet">In dieser Woche keine Eintragung: kein Training, kein Gewicht, kein Essen.</div></div>`;
  const cells=[c1];
  if(prs)cells.push(cell(fmtNum(prs),prs===1?'Rekord':'Rekorde','','Bestwerte dieser Woche, gezählt vom Wochenbericht'));
  if(f)cells.push(cell(fmtNum(f),f===1?'Beschwerde':'Beschwerden','red','Offene Rückmeldungen des Athleten zu einzelnen Übungen – Stand jetzt, nicht Stand der Woche'));
  if(d!=null)cells.push(cell(`${d>0?'+':d<0?'−':'±'}${fmtNum(Math.abs(d),1)}<em> kg</em>`,'Gewicht','','Erster gegen letzten Wiegewert der Woche'));
  if(un)cells.push(cell(fmtNum(un),'ungelesen','red','Nachrichten dieses Athleten in deinem Postfach, die du noch nicht geöffnet hast'));
  if(fed)cells.push(cell(`${fmtNum(nu.onTargetDays||0)}<em>/${fmtNum(fed)}</em>`,'Essen im Ziel','',
    'Tage innerhalb des Kalorien-Zielbandes, gemessen an den Tagen, an denen überhaupt geloggt wurde'));
  return `<div class="rv-nums">${cells.join('')}</div>`;}
// Die Saetze des Wochenberichts – aber nur die COACH-Fassung. GET /api/weekreport liefert sie in
// `lines` (Tonlage aus der Rolle, B-I.2); GET /api/week hat sie nicht, dort bleibt die Karte bei
// ihren Zahlen. Die athletischen `highlights`/`focus` desselben Payloads werden bewusst NICHT
// gezeigt: sie sind in der Du-Form des Athleten geschrieben („stärker als je zuvor"), und genau das
// ist ein bekannter Befund dieser Datei (RATE-25-coach 11).
// Was der Beschwerde-Block gleich darunter ohnehin sagt, faellt hier weg – nie zweimal dasselbe.
function rvLinesHTML(w,hasFlags,quiet){
  // Bei einer leeren Woche steht die Aussage schon neben der Trainingszahl („keine Eintragung") –
  // die Saetze des Wochenberichts sagen dort dasselbe noch einmal (19-laufende-woche.png).
  if(quiet)return '';
  // Auch „1 ungelesene Nachricht von …" faellt weg: das steht als Zahl in der Zelle und als Zitat
  // unter der Karte. Der Wochenbericht weiss das nicht – er schreibt fuer beide Ansichten.
  const l=(Array.isArray(w&&w.lines)?w.lines:[]).filter(x=>x&&!/ungelesene?\s+Nachricht/i.test(x)&&!(hasFlags&&/Beschwerde/i.test(x)));
  if(!l.length)return '';
  return `<ul class="rv-lines">`+l.map(x=>`<li>${esc2(x)}</li>`).join('')+`</ul>`;}
// Eine Zeile Mittelwerte: Zahlen mit ihrer Einheit, die sonst nirgends auf der Karte stehen
// (Essen, Eiweiss, Schlaf, HRV, Volumen). Die Saetze darueber kommen vom Server, diese Zeile
// rechnet nichts – sie liest ab.
function rvFactsHTML(w){
  const nu=w.nutrition||{},he=w.health||{},tr=w.training||{};
  const p=[];
  // Null ist hier keine Zahl, sondern eine Luecke: „Ø 0 von 2.975 kcal" hiesse, der Athlet habe
  // nichts gegessen – in Wahrheit hat er nichts EINGETRAGEN. Gemessen in der laufenden Woche
  // (18-laufende-woche.png, erste Aufnahme). Deshalb erst ab einem echten Wert.
  if(nu.avgKcal>0)p.push('Ø '+fmtNum(nu.avgKcal)+(nu.targetKcal?' von '+fmtNum(nu.targetKcal):'')+' kcal');
  if(nu.avgProtein>0)p.push('Ø '+fmtNum(nu.avgProtein)+(nu.targetProtein?'/'+fmtNum(nu.targetProtein):'')+' g Eiweiß');
  if(he.avgSleep>0)p.push('Ø '+fmtNum(he.avgSleep,1)+' h Schlaf');
  if(he.avgHrv>0)p.push('Ø HRV '+fmtNum(he.avgHrv));
  // FIX-B1 B-I.6-3: Hier stand `fmtNum(Math.round(tr.volumeKg/1000),1)` – erst auf ganze Tonnen
  // gerundet, dann mit einer Nachkommastelle ausgegeben. Die Stelle war damit IMMER 0 und hat eine
  // Genauigkeit behauptet, die nicht da war: 30.708 kg standen als „31,0 t" auf der Karte, der
  // Fehler geht bis 0,5 t. home.js:528 und analysis.js (anaTons) rechnen es richtig – die Karte
  // widersprach der Analyse desselben Athleten.
  if(Number(tr.volumeKg)>0)p.push(fmtNum(tr.volumeKg/1000,1)+' t Volumen');
  return p.length?`<div class="rv-facts">${p.map(esc2).join(' · ')}</div>`:'';}
function rvFlagsHTML(a,e){
  const n=(e&&e.flags)||[];
  if(!n.length)return '';
  const show=n.slice(0,2);
  return `<div class="rv-flags">`+show.map(x=>`<div class="rv-flag">${icon('alertTriangle',14)}<span><b>${esc2(x.exercise_name||'Übung')}</b> · ${esc2(fmtDate(x.date))}: ${esc2(String(x.note||'').slice(0,160))}</span></div>`).join('')+
    (n.length>2?`<div class="rv-more">${pl(n.length-2,'weitere Beschwerde','weitere Beschwerden')} im Profil</div>`:'')+`</div>`;}
// Die letzte Nachricht DES ATHLETEN – aber nur, solange sie zur Sache gehört: ungelesen, oder aus
// den letzten sieben Tagen. Eine vier Monate alte Zeile unter der Woche zu zeigen, hieße, dem Coach
// etwas als „offen" zu verkaufen, das längst erledigt ist.
function rvMsgHTML(a){
  const g=RV_THREADS&&RV_THREADS.by?RV_THREADS.by[a.id]:null;
  if(RV_SENT[a.id])return `<div class="rv-msg sent">${icon('check',14)} Antwort gesendet · ${esc2(cRelTime(RV_SENT[a.id]))}</div>`;
  if(!g||!g.last)return '';
  const ts=cParseTs(g.last.created_at);
  if(!g.unread&&(!ts||Date.now()-ts.getTime()>7*864e5))return '';
  // Systemzeilen (Beschwerde-Meldung, „Zielanpassung wartet auf dich") stehen auf dieser Karte
  // ohnehin als eigener Block. Die Vorschau zeigt deshalb nur, was der Athlet WIRKLICH geschrieben
  // hat – sonst liest der Coach denselben Vorgang dreimal.
  if(g.last.kind&&g.last.kind!=='message')return '';
  const body=String(g.last.body||g.last.title||'');
  // Nie zweimal dieselbe Aussage: die Beschwerde erzeugt beim Athleten auch eine Nachricht. Steht
  // ihr Wortlaut schon im Beschwerde-Block darueber, faellt die Vorschau hier weg.
  const e=RV_DATA[a.id+'|'+rvWeekStart()];
  if(e&&(e.flags||[]).some(n=>n.note&&body.indexOf(String(n.note).slice(0,40))>=0))return '';
  const t=body.slice(0,140);
  return `<div class="rv-msg${g.unread?' un':''}">${g.unread?`<span class="pill red">${fmtNum(g.unread)} neu</span> `:''}<span class="tx">„${esc2(t)}"</span> <span class="ag">${esc2(cRelTime(g.last.created_at))}</span></div>`;}
// P3: woher die Zahlen kommen – EINMAL über den Karten, nicht unter jeder. Unter jeder Karte war es
// derselbe Satz, vierzehnmal; das ist keine Herkunft mehr, das ist Tapete. Welche Quelle gerade
// antwortet, entscheidet sich beim ersten Abruf und gilt dann für alle Karten (RV_WR).
function rvSrcHTML(){
  const span=rvSpanNow();
  const src=RV_WR?'dem Wochenbericht des Servers':'derselben Rechnung wie im Rückblick des Athleten';
  return `<div class="rv-src" id="rvSrc">Trainings, Rekorde, Gewicht und Essen: ${esc2(span)}, aus ${esc2(src)}. Beschwerden und Nachrichten: Stand jetzt.
    „Senden" legt die Antwort in eure Unterhaltung und markiert sie als gelesen.</div>`;}
function rvSrcDraw(){const el=document.getElementById('rvSrc');if(el)el.outerHTML=rvSrcHTML();}
function rvUnread(id){const g=RV_THREADS&&RV_THREADS.by?RV_THREADS.by[id]:null;return g?(g.unread||0):0;}

// --- Laden: Postfach EINMAL, Woche je Athlet gedrosselt ----------------------------------------
function rvAfterDraw(){
  const list=coachVisibleAthletes();
  loadAthAvatars(list.filter(a=>a.has_avatar).map(a=>a.id));
  rvThreadsLoad();
  const start=rvWeekStart();
  list.forEach(a=>rvNeed(a,start));
  rvPump();}
async function rvThreadsLoad(){
  if(RV_THREADS&&Date.now()-RV_THREADS.ts<CACHE_MS)return;
  const t=await coachThreads();
  const by={};(t.rows||[]).forEach(r=>{if(r.g)by[r.a.id]=r.g;});
  RV_THREADS={ts:Date.now(),by};
  if(RV_TAB==='week')coachVisibleAthletes().forEach(a=>rvPatch(a.id));}
function rvNeed(a,start){
  const key=a.id+'|'+start;
  if(RV_DATA[key])return;
  RV_DATA[key]={state:'load'};
  RV_QUEUE.push(()=>rvFetch(a,start,key));}
function rvPump(){
  while(RV_BUSY<RV_PAR&&RV_QUEUE.length){const job=RV_QUEUE.shift();RV_BUSY++;
    Promise.resolve().then(job).catch(()=>{}).then(()=>{RV_BUSY--;rvPump();});}}
async function rvFetch(a,start,key){
  const q='?start='+encodeURIComponent(start);
  let r=null;
  // Die Route aus BUILD-B1 zuerst – aber nur, solange nicht feststeht, dass es sie nicht gibt.
  if(RV_WR!==false){r=await API.get('/weekreport/'+a.id+q);
    if(r.status===404&&RV_WR===null)RV_WR=false;else if(r.status===200)RV_WR=true;}
  let src='weekreport';
  if(!r||r.status!==200){r=await API.get('/week/'+a.id+q);src='week';}
  if(r.status!==200){RV_DATA[key]={state:'err',status:r.status};return rvPatch(a.id);}
  const w=r.data||{};
  RV_DATA[key]={state:'ok',w,src,flags:[],ask:null};
  rvPatch(a.id);
  if(w.start&&(!RV_SPAN||RV_SPAN.key!==start)){RV_SPAN={key:start,start:w.start,end:w.end||null};rvSrcDraw();}
  else if(src==='weekreport'&&!rvFetch.said){rvFetch.said=true;rvSrcDraw();}
  // Nachladen, aber nur wo es etwas zu holen gibt: Beschwerdetexte nur bei offenen Beschwerden,
  // der Ziel-Abgleich nur bei Athleten, die in dieser Woche ueberhaupt etwas geloggt haben.
  const jobs=[];
  if(Number(a.openFlags)>0)jobs.push(API.get('/flagged-notes/'+a.id).then(fr=>{
    if(fr.status===200&&RV_DATA[key])RV_DATA[key].flags=fr.data?.notes||[];}));
  // Der Ziel-Abgleich nur fuer Athleten, die in dieser Woche ueberhaupt etwas geloggt haben – wer
  // nichts eingetragen hat, hat auch kein Ziel, das nachzufuehren waere. EIN Aufruf je Karte
  // (GET /api/targets/:id); nur wenn es diese Route auf dem Server noch nicht gibt, wird das
  // Dashboard als zweite Quelle geholt (kcalAsk).
  const active=Number(w.training?.sessions)>0||Number(w.nutrition?.daysLogged)>0;
  if(active)jobs.push(API.get('/targets/'+a.id).then(async tr=>{
    if(!RV_DATA[key])return;
    if(tr.status===200){RV_DATA[key].tg=tr.data||null;if(tr.data&&tr.data.available!==false)return;}
    if(tr.status!==200&&tr.status!==404&&tr.status!==503)return;
    const dr=await API.get('/dashboard/'+a.id);
    if(dr.status===200&&RV_DATA[key]){RV_DATA[key].ask=dr.data?.kcalAsk||null;RV_DATA[key].dobMissing=!!dr.data?.dobMissing;}}));
  if(jobs.length){await Promise.all(jobs);rvPatch(a.id);}}
function rvPatch(id){const el=document.getElementById('rv-d-'+id);if(!el)return;
  const a=(ATHLETES_CACHE||[]).find(x=>x.id===id);if(!a)return;
  el.innerHTML=rvDynHTML(a);}

// --- Antwort DARUNTER --------------------------------------------------------------------------
function rvDraft(id,v){RV_DRAFT[id]=v;}
async function rvSend(id){
  const ta=document.getElementById('rv-t-'+id);
  const body=(ta?ta.value:'').trim();
  const hint=document.getElementById('rv-s-'+id);
  if(!body){if(hint){hint.textContent='Bitte erst etwas schreiben.';hint.classList.add('err');}
    try{ta&&ta.focus({preventScroll:true});}catch(e){}return;}
  const r=await API.post('/messages',{user_id:id,body});
  if(r.status!==200){if(hint){hint.textContent=(r.data&&r.data.error)||'Die Nachricht ging nicht raus – noch einmal versuchen.';hint.classList.add('err');}return;}
  RV_SENT[id]=new Date().toISOString();delete RV_DRAFT[id];
  if(ta)ta.value='';
  if(hint){hint.textContent='Antwort gesendet ✓';hint.classList.remove('err');}
  // Der Coach hat auf genau diese Unterhaltung geantwortet – damit ist sie gelesen. Das ist
  // dieselbe Stelle, an der openThread() die Lesemarke setzt; ein pauschales „alles gelesen"
  // gibt es weiterhin nicht (RATE-25-coach, Nachrichten-Tab).
  API.post('/messages/'+id+'/read-thread').then(rr=>{
    if(rr.status!==200)return;
    const g=RV_THREADS&&RV_THREADS.by?RV_THREADS.by[id]:null;if(g)g.unread=0;
    if(typeof loadMessages==='function')loadMessages();
    if(typeof invalidateView==='function'){try{invalidateView('messages');}catch(e){}}
    rvPatch(id);});
  if(THREAD&&THREAD.id===id)THREAD.msgs.push({from_id:ME.id,user_id:id,body,kind:'message',created_at:RV_SENT[id]});
  rvPatch(id);toast('Gesendet ✓');}

// --- Freigabe der Zielanpassung: EIN Tipp, mit der Rechnung daneben ----------------------------
// Solange B-I.1/B-I.2 die adaptiven Ziele liefern, traegt der Wochenbericht den Vorschlag selbst
// (Feld `target`/`targetProposal` mit `reason` aus adaptTargets). Bis dahin steht hier der
// Abgleich, den der Server heute schon rechnet: `kcalAsk` – gespeichertes Ziel gegen die Formel
// zum aktuellen Gewicht. Beides ist derselbe Fall: eine Zahl, die nachgefuehrt werden will, und
// ein Mensch, der das entscheidet (P10).
// Der Vorschlag kommt aus GET /api/targets/:id (`pending`): eine Zeile aus `target_history`, die der
// Wochenlauf des Servers aus tdeeFromTrend + adaptTargets gerechnet hat. `needsCoach` sagt, WER
// entscheiden soll – und das ist keine Feinheit: steht der Athlet auf „formel", ist der Vorschlag
// SEINE Entscheidung, und der Coach sieht ihn nur. Steht er auf „adaptiv" und hat einen Coach, dann
// wartet die Anpassung ausdruecklich auf dessen Freigabe (BUILD-B1 4.3). Beides steht hier in Worten,
// damit niemand raten muss, warum der Knopf da ist oder fehlt.
// FIX-B1 B-I.6-2: „Gemessener Verbrauch" nur, wenn er aus DERSELBEN Rechnung stammt wie der Satz
// darueber. Der Vorschlag (`p`) ist eine eingefrorene Zeile aus `target_history`; `tg.tdee` ist der
// HEUTIGE Wert aus `users.tdee_est`, den jeder spaetere Wochenlauf ueberschreibt. Gemessen standen
// deshalb auf derselben Karte drei Woerter auseinander: im Zitat „Dein gemessener Verbrauch liegt
// bei 1.940 kcal" und darunter „Gemessener Verbrauch: 2.020 kcal". Der Coach soll die Karte in
// einem Tipp abnicken und nicht zuerst einen Widerspruch aufloesen (P3).
// Drei Stufen, in dieser Reihenfolge:
//   1. Liefert der Server den Wert MIT der Zeile (eigene Spalte in `target_history`, B-I.1/B-I.2),
//      ist er der einzig richtige – dann steht er hier, ganz gleich was `users.tdee_est` heute sagt.
//   2. Nennt die Begruendung die Zahl schon (adaptTargets schreibt sie dort hinein), waere die
//      Zeile bestenfalls eine Wiederholung und schlimmstenfalls ein zweiter, anderer Wert.
//   3. Sonst nur, wenn der heutige Schaetzwert nicht juenger ist als der Vorschlag – dann stammen
//      beide aus demselben Wochenlauf. Fehlt einer der beiden Zeitpunkte, bleibt die Zeile weg:
//      „unbekannte Herkunft" ist kein Grund, eine Zahl neben eine andere zu stellen.
function rvTdeeLine(tg,p){
  const own=p?(p.tdee!=null?p.tdee:(p.tdee_est!=null?p.tdee_est:null)):null;
  const line=v=>` <span class="rv-tdee">Gemessener Verbrauch: ${fmtNum(Math.round(v))} kcal.</span>`;
  if(own!=null&&Number(own)>0)return line(Number(own));
  const cur=Number(tg&&tg.tdee)||0;
  if(!cur)return '';
  if(/verbrauch/i.test(String((p&&p.reason)||'')))return '';
  const a=cParseTs(tg&&tg.tdeeAt),b=cParseTs(p&&p.created_at);
  if(!a||!b||a.getTime()>b.getTime()+6e5)return '';
  return line(cur);}
function rvGoalHTML(a,e){
  const id=a.id,tg=e&&e.tg,ask=e&&e.ask,first=String(a.name||'').split(' ')[0]||'dein Athlet';
  if(RV_KEPT[id])return `<div class="rv-goal kept">${icon('check',14)} Zielanpassung entschieden – die Karte zeigt sie beim nächsten Laden nicht mehr.</div>`;
  const p=tg&&tg.pending;
  if(p){
    const cur=(tg.current&&tg.current.kcal)||null,neu=Number(p.kcal)||null;
    const d=(cur&&neu)?neu-cur:null;
    const macro=[p.protein?fmtNum(p.protein)+' g Eiweiß':'',p.carbs?fmtNum(p.carbs)+' g KH':'',p.fat?fmtNum(p.fat)+' g Fett':''].filter(Boolean).join(' · ');
    const head=`<div class="t">${icon('target',14)} Zielanpassung – ${p.needsCoach?'deine Freigabe':'wartet auf '+esc2(first)}</div>
      <div class="b">${cur?fmtNum(cur)+' → ':''}<b>${fmtNum(neu)} kcal</b>${d!=null?` (${d>0?'+':'−'}${fmtNum(Math.abs(d))})`:''}${macro?`<br><span class="rv-macro">${esc2(macro)}</span>`:''}</div>`;
    // Die Begruendung ist woertlich die des Rechenkerns – in der Du-Form, in der sie beim Athleten
    // steht. Deshalb als Zitat und mit der Herkunft davor: der Coach soll sehen, was SEIN ATHLET
    // liest, nicht einen zweiten, umformulierten Grund (P3, und RATE-25-coach 11 zum Athleten-Du).
    const why=`<div class="why"><span class="rv-src-lbl">Begründung des Rechenkerns – so liest sie ${esc2(first)}:</span><br>„${esc2(p.reason||'—')}"${rvTdeeLine(tg,p)}</div>`;
    const acts=p.needsCoach
      ? `<div class="acts"><button type="button" class="btn sm sec rv-ok" onclick="rvDecide(${id},${Number(p.id)},true)">${icon('check',16)} Freigeben</button>
          <button type="button" class="btn sm sec" onclick="rvDecide(${id},${Number(p.id)},false)">Behalten</button></div>`
      : `<div class="why">${esc2(first)} hat „Ziele automatisch anpassen" aus – der Vorschlag wartet auf ihn, nicht auf dich.</div>`;
    return `<div class="rv-goal">${head}${why}${acts}</div>`;}
  if(tg&&tg.available===false&&tg.mode)return '';
  // Rueckfall fuer Serverfassungen ohne target_history: der Abgleich, den der Server schon immer
  // rechnet (`kcalAsk` – gespeichertes Ziel gegen die Formel zum aktuellen Gewicht).
  if(!ask)return '';
  const t=ask.train||{},r=ask.rest||{};
  const su=Math.round(t.suggested||0),ru=Math.round(r.suggested||0);
  if(!su&&!ru)return '';
  const st=Math.round(t.saved||0),sr=Math.round(r.saved||0);
  const dev=(sv,n)=>(sv>0&&n>0)?((sv-n)/n*100):null;
  const dt=dev(st,su),dr=dev(sr,ru);
  const devTxt=[dt!=null?'Trainingstag '+(dt>0?'+':'−')+fmtNum(Math.abs(dt),1)+' %':'',
    dr!=null?'Ruhetag '+(dr>0?'+':'−')+fmtNum(Math.abs(dr),1)+' %':''].filter(Boolean).join(', ');
  return `<div class="rv-goal"><div class="t">${icon('target',14)} Zielanpassung – deine Freigabe</div>
    <div class="b">Gespeichert <b>${fmtNum(st)} / ${fmtNum(sr)} kcal</b> → gerechnet <b>${fmtNum(su)} / ${fmtNum(ru)} kcal</b> (Training / Ruhe).</div>
    <div class="why">Warum: ${devTxt?esc2(devTxt+' gegenüber der Rechnung'):'Das gespeicherte Ziel weicht von der Rechnung ab'} zum aktuellen Gewicht${ask.weightKg?' von '+fmtNum(ask.weightKg,1)+' kg':''}.
      Die Ernährung des Athleten arbeitet bereits mit der gerechneten Zahl – gespeichert ist nur die alte.${e.dobMissing?' Ohne Geburtsjahr rechnet die Formel ohne Alter: ein Startwert, kein Messwert.':''}</div>
    <div class="acts"><button type="button" class="btn sm sec rv-ok" onclick="rvApprove(${id},${su},${ru})">${icon('check',16)} Freigeben</button>
      <button type="button" class="btn sm sec" onclick="rvKeep(${id})">Behalten</button></div></div>`;}
// EIN Tipp. POST /api/targets/:id/decide ist dieselbe Route, die auch der Athlet benutzt – der
// Server haelt fest, wer entschieden hat (`approved_by`), loest die vorige Zielzeile ab und schickt
// dem Athleten den Satz dazu. Hier wird nichts nachgerechnet und nichts zweimal geschrieben.
async function rvDecide(id,pid,accept){
  const r=await API.post('/targets/'+id+'/decide',{id:pid,accept:!!accept});
  if(r.status!==200)return toast((r.data&&r.data.error)||'Fehler');
  RV_KEPT[id]=true;
  const key=id+'|'+rvWeekStart(),e=RV_DATA[key];
  if(e&&e.tg){e.tg.pending=null;if(accept&&r.data&&r.data.current)e.tg.current=r.data.current;}
  delete COACH_DASH[id];coachInvalidate();rvPatch(id);
  toast(accept?'Freigegeben ✓ – Athlet benachrichtigt':'Ziel bleibt – Athlet benachrichtigt');}
// Rueckfall-Weg (kein target_history): die vorhandene Coach-Route schreibt die beiden Spalten und
// schickt die Nachricht. Es entsteht kein zweiter, stiller Schreibweg fuer dieselbe Zahl.
async function rvApprove(id,tr,re){
  const body={};
  if(tr>0)body.kcal_target_train=Math.round(tr);
  if(re>0)body.kcal_target_rest=Math.round(re);
  if(!Object.keys(body).length)return toast('Kein Wert zum Übernehmen');
  const r=await API.put('/athlete/'+id+'/profile',body);
  if(r.status!==200)return toast((r.data&&r.data.error)||'Fehler');
  const changed=Array.isArray(r.data&&r.data.changed)?r.data.changed:null;
  const key=id+'|'+rvWeekStart();if(RV_DATA[key])RV_DATA[key].ask=null;
  const c=COACH_DASH[id];if(c&&c.d&&c.d.athlete){if(body.kcal_target_train)c.d.athlete.kcal_target_train=body.kcal_target_train;
    if(body.kcal_target_rest)c.d.athlete.kcal_target_rest=body.kcal_target_rest;c.d.kcalAsk=null;}
  coachInvalidate();rvPatch(id);
  toast(changed&&!changed.length?'Die Werte standen schon so im Profil':'Ziel übernommen ✓ – Athlet benachrichtigt');}
function rvKeep(id){RV_KEPT[id]=true;rvPatch(id);toast('Ziel bleibt – für diese Sitzung gemerkt');}

// --- Pivot: die HEUTIGE Einheit aendern, ohne die Vorlage anzufassen ---------------------------
// Zwei Tipps: „Heute ändern" oeffnet das Blatt, ein Tipp auf den Tag setzt ihn. Der Begruendungssatz
// steht vorformuliert im Feld darueber und geht mit – ohne Begruendung gibt es keine Aenderung (P3).
// WAS GEAENDERT WIRD: der Tageseintrag (`day_log`) dieses einen Datums. Die Vorlage (`training_days`,
// `exercises`) wird nicht angefasst, der Rhythmus laeuft ab morgen weiter wie vorher.
// WELCHES DATUM „heute" ist, sagt der SERVER (Antwort von GET /api/today/:id) – nicht die Uhr des
// Coaches. Sitzt der Athlet in einer anderen Zeitzone, ist das der Unterschied zwischen der
// richtigen und der falschen Einheit (BUILD-B1 Abschnitt 4.6).
async function rvPivot(uid,name){
  name=name||athName(uid);
  coachSheet('Heute ändern',{id:uid,name},'<div class="spinner"></div>');
  const [pr,tr]=await Promise.all([API.get('/plan/'+uid),API.get('/today/'+uid)]);
  if(pr.status!==200||tr.status!==200)
    return coachSheet('Heute ändern',{id:uid,name},`<div class="note err">${esc2(pr.status===403||tr.status===403?'Kein Coach-Zugriff auf diesen Athleten':'Plan oder Tag konnten nicht geladen werden.')}</div>`);
  const days=(pr.data&&pr.data.days)||[],t=tr.data||{},date=t.date||today();
  // „Heute" ist der lokale Tag des ATHLETEN – er steht in der Antwort des Servers (GET /api/today/:id
  // rechnet ihn ueber users.tz). Die Uhr des Coaches kommt hier bewusst nicht vor.
  const ov=t.override||null;
  const eff=t.confirmed||t.suggestion||{};
  const cur=eff.type==='train'?(eff.dayName||'Training'):eff.type==='sick'?'Pause':'Ruhetag';
  const from=ov?'bereits geändert':(t.confirmed?'bereits eingetragen':'Vorschlag aus dem Rhythmus');
  const first=String(name).split(' ')[0];
  const rvIsNow=d=>ov?(ov.day_id===d.id):(eff.type==='train'&&eff.dayName===d.name);
  const rows=days.map(d=>`<button type="button" class="row tap ad-row rv-day" onclick="rvPivotTo(${uid},'${esc(date)}',${d.id},'${esc(d.name)}')">
      <span class="r-ic">${icon('dumbbell')}</span><span class="rl">${esc2(d.name)}<small>${pl((d.exercises||[]).length,'Übung','Übungen')}</small></span>
      ${rvIsNow(d)?'<span class="rr">heute</span>':''}</button>`).join('');
  const restNow=ov?ov.rest:(eff.type==='rest');
  coachSheet('Heute ändern',{id:uid,name},`<div id="rvPivBox">
    <div class="note status mb-3">Heute (${esc2(fmtDate(date,{weekday:'short'}))}) steht bei ${esc2(first)}: <b>${esc2(cur)}</b> – ${esc2(from)}.
      Die Änderung gilt <b>nur für diesen Tag</b>. Plan und Rhythmus bleiben, wie sie sind.</div>
    ${ov?`<div class="note mb-3">${esc2(ov.text||'')}<br><span class="caption">Geändert von ${esc2(ov.by==='coach'?'dir':first)}.</span>
      <div class="mt-2"><button type="button" class="btn sm sec" onclick="rvPivotUndo(${uid},'${esc(date)}')">${icon('refresh',16)} Änderung zurücknehmen</button></div></div>`:''}
    <div class="field"><label for="rv_piv_note">Begründung (geht an ${esc2(first)})</label>
      <input id="rv_piv_note" maxlength="160" value="${esc2('Heute lieber etwas anderes – die Einheit holen wir nach.')}"></div>
    <div class="section-label"><span>Stattdessen</span></div>
    <div class="rows mb-3">${rows||'<div class="note status">Dieser Athlet hat noch keine Trainingstage im Plan.</div>'}
      <button type="button" class="row tap ad-row rv-day" onclick="rvPivotTo(${uid},'${esc(date)}',null,'Ruhetag')">
        <span class="r-ic">${icon('moon')}</span><span class="rl">Ruhetag<small>Heute nichts – erholen</small></span>${restNow?'<span class="rr">heute</span>':''}</button></div>
    <div class="caption">Ein Tipp auf die Zeile ändert den Tag. Die Begründung geht als Nachricht mit – ohne sie weist der Server die Änderung ab.</div></div>`);}
// Tipp 2. `day_id` ist der Vertrag von POST /api/session-override (B-I.2): eine Zahl heisst
// Trainingstag, `null` heisst Ruhetag. Der Server prueft selbst, ob der Tag zu diesem Plan gehoert.
// ZWEITER WEG fuer aeltere Serverfassungen (404/503): derselbe Tageseintrag, den auch der Athlet
// setzen kann, plus die Begruendung als Nachricht – sonst stuende die Aenderung wortlos in seinem Plan.
async function rvPivotTo(uid,date,dayId,label){
  const note=(val('rv_piv_note')||'').trim();
  if(!note){showFieldErr('rvPivBox','Bitte schreib dazu, warum – dein Athlet liest diesen Satz.','rv_piv_note');return;}
  let r=await API.post('/session-override',{user_id:uid,date,day_id:dayId,note});
  let via='override';
  if(r.status===404||r.status===503){
    via='daylog';
    r=await API.post('/today/'+uid,{date,type:dayId==null?'rest':'train',day_name:dayId==null?null:label});
    if(r.status!==200)return toast((r.data&&r.data.error)||'Fehler');
    await API.post('/messages',{user_id:uid,title:'Heute geändert: '+label,
      body:'Heute steht bei dir '+label+' statt der geplanten Einheit – weil: '+note+'\n\nDein Plan bleibt unverändert, ab morgen läuft dein Rhythmus weiter.'});}
  else if(r.status!==200)return toast((r.data&&r.data.error)||'Fehler');
  rvAfterWrite(uid);
  closeModal();
  toast('Heute: '+label+' ✓',{label:'Rückgängig',fn:()=>rvPivotUndo(uid,date,via)});}
// Zuruecknehmen heisst: die Override-Zeile loeschen. Danach gilt wieder der Rhythmus – die Vorlage
// war nie angefasst, es gibt also nichts wiederherzustellen (P12).
async function rvPivotUndo(uid,date,via){
  const u=(via==='daylog')?await API.del('/today/'+uid+'?date='+encodeURIComponent(date))
    :await API.del('/session-override/'+uid+'?date='+encodeURIComponent(date));
  if(u.status!==200)return toast('Zurücknehmen hat nicht geklappt');
  if(via==='daylog')await API.post('/messages',{user_id:uid,title:'Änderung zurückgenommen',
    body:'Die heutige Änderung ist zurückgenommen – es gilt wieder dein Rhythmus.'});
  rvAfterWrite(uid);closeModal();toast('Zurückgenommen – der Rhythmus gilt wieder');}
// Nach jedem Schreibzugriff auf einen Athleten: seine gemerkten Daten wegwerfen und genau seine
// Karte neu laden. Die Liste bleibt stehen, das Antwortfeld auch.
function rvAfterWrite(uid){
  delete COACH_DASH[uid];coachInvalidate();
  const start=rvWeekStart(),key=uid+'|'+start;
  delete RV_DATA[key];
  if(RV_TAB!=='week')return;
  const a=(ATHLETES_CACHE||[]).find(x=>x.id===uid);if(!a)return;
  RV_DATA[key]={state:'load'};rvPatch(uid);
  RV_QUEUE.push(()=>rvFetch(a,start,key));rvPump();}
