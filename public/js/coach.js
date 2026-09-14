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
  return `<div class="note warn"><b>${esc2(was)} ist auf diesem Server noch nicht verfügbar.</b><br>
    Die Route liefert Paket A-II.2 dieser Welle. Bis dahin steht hier nichts – das heißt ausdrücklich
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
  const [ur,cr,st,sf,au]=await Promise.all([
    API.get('/admin/users'),API.get('/admin/coaches'),API.get('/admin/stats'),API.get('/selftest'),
    adGet(['/admin/audit'],{limit:200})]);
  if(ur.status!==200){if(document.getElementById('adminPage'))v.innerHTML=`<div class="page on" id="adminPage">${emptyState({icon:'lock',title:'Kein Zugriff',text:'Diese Seite ist nur für Betreiber.'})}</div>`;return;}
  const data={ts:Date.now(),users:ur.data.users||[],counts:ur.data.counts||ur.data.roles||{},coaches:cr.data?.coaches||[],
    stats:st?.data||{},self:sf?.data||null,audit:au};
  // uptimeSec steigt bei jedem Aufruf – nur Zustand und Probleme entscheiden ueber ein Neuzeichnen.
  const sig=JSON.stringify([data.users,data.counts,data.stats,data.self?.ok,data.self?.problems,data.self?.hints,
    au.status,adRows(au.data,['entries']).length]);
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
function coAdminStatusHTML(st_,self,audit){st_=st_||{};
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
  const bkTs=adLastAction(audit,'backup.download')||st_.lastBackup||null;
  const bkDays=bkTs?Math.floor((adAgo(bkTs)||0)/1440):null;
  rows.push(coachStatusRow(bkTs?(bkDays>7?'mid':'ok'):'unknown','Letzte Sicherung',
    bkTs?adAgoTxt(bkTs):'nicht protokolliert',"adInfo('backup')",
    bkTs?(bkDays>7?'Älter als eine Woche – neue Kopie ziehen':''):'Es gibt noch keine Ablage dafür'));
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
  backup:['Letzte Sicherung','Der Zeitpunkt der letzten Datenbankkopie – abgelesen am Protokolleintrag „Sicherung heruntergeladen". Eine Sicherung, die niemand je zurückgespielt hat, ist keine Sicherung.','Im Reiter „Betrieb" eine Kopie ziehen, verschlüsselt ablegen – und einmal im Quartal in eine Testdatenbank zurückspielen.'],
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
    ${coAdminStatusHTML(data.stats,data.self,data.audit)}
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
function adBetriebHTML(d){const st_=d.stats||{},c=d.counts||{};
  const tiles=AD_KPI.map(([k,l])=>`<button type="button" class="tile ad-kpi" onclick="adKpiInfo('${k}')">
    <span class="v">${st_[k]!=null?fmtNum(st_[k]):'–'}</span><span class="l">${esc2(l)} ${icon('info',13)}</span></button>`).join('');
  const mailOk=st_.mail==='konfiguriert';
  return `<div class="grid-2 ad-kpis mb-4">${tiles}</div>
  <div class="ad-counts mb-4">${adRoleLabel('admin')}: <b>${fmtNum(c.admin||0)}</b> · Coaches: <b>${fmtNum(c.coach||0)}</b> · Athleten: <b>${fmtNum(c.athlete||0)}</b> — Kürzel und Rollen stehen im Reiter „Konten".</div>
  <div class="section-label"><span>Sicherung</span></div>
  <div class="rows mb-4">
    <button type="button" class="row tap ad-row" onclick="openBackupSheet()"><span class="r-ic">${icon('download')}</span><span class="rl">Sicherung herunterladen<small>Vollständige Kopie der Datenbank, mit Passwort</small></span></button>
    <button type="button" class="row tap ad-row" onclick="coOpenSelftest()"><span class="r-ic">${icon('shield')}</span><span class="rl">Selbsttest<small>Schema, Datenbank und Startschritte prüfen</small></span></button>
  </div>
  <div class="section-label"><span>Mailversand</span></div>
  <div class="rows mb-3">
    <button type="button" class="row tap ad-row" onclick="adTestmail()"><span class="r-ic">${icon('mail')}</span><span class="rl">Testmail an mich<small>${mailOk?'Prüft den echten Versandweg':'Landet ohne SMTP nur im Server-Log'}</small></span></button>
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
  const anyCreated=(ADMIN_USERS||[]).some(u=>u.created_at||u.createdAt);
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
    ${anyPseudo?'':`<p class="caption ad-foot">Die Kürzel sind hier aus der Konto-Nummer gebildet (S/C/A + Nummer). Stabile Pseudonyme wie <b>A-7F2K</b> liefert der Server ab Paket A-II.2.</p>`}
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
    Er hat auf die Suche ${fmtNum(res.n)} Konten zurückgegeben statt eines. Die exakte Suche liefert Paket A-II.2;
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
  'password.reset':'Passwort zurückgesetzt','backup.download':'Sicherung heruntergeladen','mail.test':'Testmail ausgelöst',
  'job.weekly.run':'Wochen-Rückblick von Hand','job.freezes.run':'Streak-Joker von Hand','cron.tick':'Zeitgeber gelaufen',
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
// tägliche Aufräumen. „Sicherung" ist KEIN Lauf – sie wird von Hand gezogen und steht deshalb ohne
// Ampel, aber mit ihrem letzten Protokolleintrag da.
const AD_JOBS=[
  ['cron.tick','Zeitgeber','weekly','Läuft stündlich. Er verschickt den Sonntags-Rückblick, die Erinnerungen und die Streak-Joker.'],
  ['retention.prune','Aufräumen',null,'Löscht täglich abgelaufene Tokens sowie Protokoll- und Fehlerzeilen, die ihre Frist überschritten haben.']];
const AD_JOB_STATE={ok:['ok','läuft'],up:['ok','läuft'],late:['mid','überfällig'],down:['bad','steht'],
  never:['unknown','noch nie gelaufen'],unknown:['unknown','noch nie erfolgreich gelaufen']};
function adminJobsHTML(r){
  const avail=!(r&&r.ok&&r.data&&r.data.available===false);
  const srv=r&&r.ok&&avail?adRows(r.data,['jobs','rows']):[];
  const byName={};srv.forEach(j=>{if(j&&j.name)byName[String(j.name)]=j;});
  const known=AD_JOBS.map(([key,label,trigger,text])=>({key,label,trigger,text,j:byName[key]||null}));
  // Laeufe, die der Server kennt und diese Liste nicht – nie verschweigen, sonst faellt ein neuer Job
  // aus der Aufsicht heraus, ohne dass es jemand merkt.
  const extra=srv.filter(j=>!AD_JOBS.some(k=>k[0]===String(j.name)))
    .map(j=>({key:String(j.name||'?'),label:String(j.name||'?'),trigger:null,text:'Dieser Lauf ist in der Verwaltung noch nicht beschrieben.',j:j}));
  let h='';
  if(!r||!r.ok||!avail)h+=adMissingHTML('Der Zustand der Läufe',avail?r:{status:404})
    +`<p class="body mt-3 mb-3">Die Zeilen unten zeigen deshalb nur, was es gibt und was du von Hand auslösen kannst.</p>`;
  h+=`<div class="section-label"><span>Wiederkehrende Läufe</span></div><div class="rows mb-4">`;
  h+=known.concat(extra).map(({label,trigger,text,j})=>{
    const s=AD_JOB_STATE[j?String(j.state||'unknown'):'']||['unknown','Zustand nicht protokolliert'];
    const last=j?(j.last_ok_utc||j.last_run_utc):null;
    const err=j&&j.last_error?String(j.last_error):'';
    const grace=j&&j.graceMin?('Karenz '+(j.graceMin>=120?fmtNum(j.graceMin/60,j.graceMin%60?1:0)+' Std.':j.graceMin+' Min.')):'';
    return `<div class="row ad-job"><span class="sdot ${s[0]}"></span>
      <span class="rl">${esc2(label)}<small>${j?esc2(s[1]):'Zustand nicht protokolliert'}${last?' · zuletzt '+esc2(adAgoTxt(last)):''}${grace?' · '+esc2(grace):''}${err?`<br><span class="t-bad">Fehler: ${esc2(err.slice(0,80))}</span>`:''}<br>${esc2(text)}</small></span>
      ${trigger?`<button type="button" class="btn sm sec" onclick="adJobRun('${trigger}')">jetzt nachholen</button>`:''}</div>`;}).join('');
  h+=`</div><div class="section-label"><span>Von Hand auslösen</span></div><div class="rows mb-3">
    <button type="button" class="row tap ad-row" onclick="adJobRun('weekly')"><span class="r-ic">${icon('calendar')}</span><span class="rl">Wochen-Rückblick nachholen<small>Für die zuletzt abgeschlossene Woche – Nachricht und Mail</small></span></button>
    <button type="button" class="row tap ad-row" onclick="adJobRun('freezes')"><span class="r-ic">${icon('refresh')}</span><span class="rl">Streak-Joker verarbeiten<small>Vergibt fällige Joker und räumt abgelaufene weg</small></span></button>
    <button type="button" class="row tap ad-row" onclick="openBackupSheet()"><span class="r-ic">${icon('download')}</span><span class="rl">Sicherung ziehen<small>Sie ist kein Lauf – niemand zieht sie für dich</small></span></button></div>
  <p class="caption ad-foot">„Aufräumen" hat keinen Knopf: es gibt keine Route, um es von Hand anzustoßen. Was du hier auslöst, steht danach im Reiter „Protokoll".</p>`;
  return h;}
// Von Hand ausloesen. Die Antwort wird ausgesprochen (wie viele Mails, wie viele Nachrichten) –
// ein blosses „ok ✓" laesst den Betreiber raten, ob etwas passiert ist.
async function adJobRun(name){
  const map={weekly:['/admin/weekly','Wochen-Rückblick'],freezes:['/admin/process-freezes','Streak-Joker']};
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
function drawAthletes(v,data){const list=data.list||[];ATHLETES_CACHE=list;
  const stat=coachStatHTML(list);
  let h=`<div class="page on${document.getElementById('athPage')?'':' first'}" id="athPage">`;
  // (Bis 2.5.0 stand hier ein „Zur Verwaltung"-Knopf fuer Admins. Ein Admin erreicht diese Liste seit
  //  2.6.0 gar nicht mehr – renderAthletes() biegt vorher ab.)
  h+=`<div class="coach-stat">${stat}</div>`;
  h+=`<div class="section-label"><span>Athleten</span><span class="sl-r"><button class="btn sm sec" onclick="addAthlete()">${icon('plus',14)} Athlet</button></span></div>`;
  if(list.length>5)h+=`<input class="field ath-search" id="athSearch" type="search" placeholder="Athlet suchen" oninput="filterAthletes(this.value)">`;
  // Filter-Chips ab derselben Schwelle wie die Suche: bei fünf Athleten ist die Liste die Übersicht,
  // ab sechs beginnt das Suchen. Keine Sortier-Maschinerie – vier Chips, die man ohne Erklärung versteht.
  if(list.length>5)h+=`<div class="chip-row wrap co-filters" id="athFilters">${coachFilterChipsHTML(list)}</div>`;
  h+=`<div id="athList"></div>`;
  const inNav=!!(ME&&ME.role==='coach'); // Coach-Navigation hat eigene Tabs für Nachrichten und Vorlagen
  h+=`<div class="section-label"><span>Mehr</span></div><div class="rows mb-4">
    ${inNav?'':`<button type="button" class="row tap ad-row" onclick="coachMessagesSheet()"><span class="r-ic">${icon('mail')}</span><span class="rl">Nachrichten<small>Unterhaltungen je Athlet</small></span></button>`}
    <button type="button" class="row tap ad-row" onclick="coachInsights()"><span class="r-ic">${icon('chartLine')}</span><span class="rl">Einblicke<small>Aktivität, Ziele, jüngste Trainings</small></span></button>
  </div></div>`;
  v.innerHTML=h;drawAthleteList(coachVisibleAthletes());if(typeof cacheView==='function')cacheView('athletes');}
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
function coachSetFilter(f){COACH_FILTER=f||'all';coachDrawFilters();drawAthleteList(coachVisibleAthletes());}
function filterAthletes(q){COACH_QUERY=(q||'').toLowerCase().trim();drawAthleteList(coachVisibleAthletes());}
function drawAthleteList(list){const el=document.getElementById('athList');if(!el)return;
  if(!list.length){
    el.innerHTML=!(ATHLETES_CACHE||[]).length
      ? emptyState({icon:'users',title:'Noch keine Athleten',text:'Lege einen Athleten an oder ordne dir einen bestehenden zu.',btn:{label:'Athlet hinzufügen',onclick:'addAthlete()'}})
      : (COACH_FILTER!=='all'&&!COACH_QUERY
        ? emptyState({icon:'filter',title:'Niemand in diesem Filter',text:COACH_FILTER==='alert'?'Kein Athlet steht gerade auf Alarm – das ist eine gute Nachricht.':COACH_FILTER==='watch'?'Kein Athlet steht auf Beobachten.':'Kein Athlet ohne erste Eintragung.',btn:{label:'Alle zeigen',onclick:"coachSetFilter('all')"}})
        : emptyState({icon:'search',title:'Kein Treffer',text:'Kein Athlet passt zu deiner Suche.'}));return;}
  el.innerHTML=`<div class="rows mb-3">`+list.map(a=>{
    const st=a.status||'ok';const reasons=a.reasons||[];
    const statusTxt=a.lastTrain?(a.daysSinceTrain===0?'heute trainiert':a.daysSinceTrain===1?'gestern trainiert':'Training '+daysAgoTxt(a.lastTrain)):'noch kein Training';
    // Nie zweimal dieselbe Aussage: sagt der Grund schon „noch kein Training geloggt", fallen „noch kein
    // Training" und „0/3 diese Woche" aus der Unterzeile – sonst steht es dreimal untereinander (RATE-coach, Design).
    const noTrain=reasons.some(r=>/kein Training/i.test(r));
    // „diese Woche" heisst hier dieselbe Kalenderwoche wie beim Athleten: 3/3 statt „3× diese Woche"
    // (das war das rollende Sieben-Tage-Fenster und stand neben einem anderen Wochenziel im Sheet).
    const rw=coWeekGoal(a);
    const weekTxt=rw?`${fmtNum(rw.done)}/${fmtNum(rw.target)} diese Woche`:(a.trainsThisWeek||0)+'× diese Woche';
    const weekDone=rw?rw.done:(a.trainsThisWeek||0);
    const sub=[noTrain?'':statusTxt,(noTrain&&!weekDone)?'':weekTxt,
      a.goal?goalLabel(a.goal):'',a.lastWeight!=null?fmtNum(a.lastWeight,1)+' kg':''].filter(Boolean).join(' · ');
    return `<button type="button" class="row tap ad-row ath-row" onclick="openDashboard(${a.id})">${athAvatar(a.id,a.name)}
      <span class="rl">${esc2(a.name)}${st!=='ok'?attPill(st):''}${reasons.length?`<small class="reason ${st}">${reasonLine(reasons)}</small>`:''}<small>${esc2(sub)}</small></span></button>`;}).join('')+`</div>`;
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
  const pills=[a.goal?goalLabel(a.goal):'',phaseLabel(a.phase)||'keine Phase',rate!=null?coRateLabel(rate):'',expLabel(a.experience)].filter(Boolean);
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
    (ai.configured!==false?row('sparkles','KI-Analyse','Zweitmeinung aus Trainings- und Check-in-Daten',`aiSummary(${id})`):'')+`</div>`;
  h+=`<div class="section-label"><span>Verwalten</span></div><div class="rows mb-4">`+
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
  await loadPlan();await loadToday();}
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
  if(r.status===200)coachSheet('KI-Analyse',{id,name},`<div class="ai-text">${esc2(r.data.summary||'')}</div><div class="caption mt-4">KI-generiert – als Zweitmeinung gedacht. Deine Coach-Einschätzung zählt.</div>`);
  else{const err=String(r.data?.error||'');const friendly=/konfiguriert|API_KEY/i.test(err)?'Die KI-Analyse ist auf diesem Server nicht aktiviert.':(err||'Fehler bei der Analyse.');
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
