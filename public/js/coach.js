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
let THREAD=null;              // offene Unterhaltung {id,name,msgs}
let MONTHLY_UID=null;         // Athlet, dessen Monatsziel gerade bearbeitet wird (explizit, kein Kontext-Nebeneffekt)
const CACHE_MS=60000;

// Spiegel von logic.attentionStatus() – nur als Fallback, wenn der Server noch kein status/reasons liefert.
function attentionStatusClient(o){o=o||{};const reasons=[];let level='ok';
  const bump=l=>{if(l==='alert')level='alert';else if(l==='watch'&&level==='ok')level='watch';};
  const f=o.openFlags||0;if(f>0){reasons.push(f+' offene Beschwerde'+(f>1?'n':''));bump('alert');}
  const dc=o.daysSinceCheckin,dt=o.daysSinceTraining;
  if(dc==null){reasons.push('noch kein Check-in');bump('watch');}
  else if(dc>=10){reasons.push(dc+' Tage kein Check-in');bump('alert');}
  else if(dc>=5){reasons.push(dc+' Tage kein Check-in');bump('watch');}
  if(dt==null){reasons.push('noch kein Training geloggt');bump('watch');}
  else if(dt>=10){reasons.push(dt+' Tage kein Training');bump('alert');}
  else if(dt>=6){reasons.push(dt+' Tage kein Training');bump('watch');}
  return{level,reasons};}
function daysSince(d){if(!d)return null;const t=Date.parse(String(d).slice(0,10)+'T00:00:00');return isNaN(t)?null:Math.floor((Date.now()-t)/864e5);}
// EIN Modell: status/reasons vom Server (GET /api/athletes), sonst /coach/attention-Zeile, sonst Client-Fallback.
function athleteStatus(a,attMap){
  if(a&&a.status&&Array.isArray(a.reasons))return{status:a.status,reasons:a.reasons};
  const m=attMap&&attMap[a.id];if(m&&m.status)return{status:m.status,reasons:m.reasons||[]};
  const st=attentionStatusClient({daysSinceCheckin:daysSince(a.lastCheckin),daysSinceTraining:a.lastTrain?daysSince(a.lastTrain):null,openFlags:a.openFlags||0});
  return{status:st.level,reasons:st.reasons};}
function sortAthletes(list){return (list||[]).slice().sort((x,y)=>(ATT_ORDER[x.status]??2)-(ATT_ORDER[y.status]??2)||String(x.name).localeCompare(String(y.name),'de'));}
function attPill(status){const tone={alert:'red',watch:'amber',ok:'green'}[status]||'neutral';return `<span class="pill ${tone}">${ATT_LABEL[status]||'–'}</span>`;}
function reasonLine(reasons){reasons=reasons||[];if(!reasons.length)return '';return esc2(reasons[0])+(reasons.length>1?' · +'+(reasons.length-1):'');}
function athName(id){const a=(ATHLETES_CACHE||[]).find(x=>x.id===id);return a?a.name:(COACH_CONTEXT&&VIEW_USER===id?COACH_CONTEXT:'Athlet');}
function initialOf(name){return esc2(String(name||'?').trim().charAt(0).toUpperCase()||'?');}
function athAvatar(id,name,cls){return `<div class="ath-av${cls?' '+cls:''}" data-ath-av="${id}">${initialOf(name)}</div>`;}
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
// Vertrag (P2): coachSheet(title,athleteName,html,opts) – Sheet mit Athleten-Chip unter dem Titel (Titel = reines Nomen)
function coachSheet(title,name,html,opts){
  const id=(ATHLETES_CACHE||[]).find(a=>a.name===name)?.id;
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
    `<button class="btn sm sec" onclick="coachLeaveAthlete()">Verlassen</button>`;}
function coachLeaveAthlete(){const el=document.getElementById('ctxBar');if(el)el.innerHTML='';go('athletes');}

// ===== ADMIN: NUTZERVERWALTUNG =====
let ADMIN_USERS=[],ADMIN_COACHES=[];
async function renderAdmin(v,opts){opts=opts||{};
  const fresh=ADMIN_CACHE&&(Date.now()-ADMIN_CACHE.ts<CACHE_MS);
  if(fresh)drawAdmin(v,ADMIN_CACHE);
  else if(!opts.cached)v.innerHTML=`<div class="page on" id="adminPage"><div class="grid-3 mb-3">${skeleton(3,'sm')}</div>${skeleton(3)}</div>`;
  const [ur,cr,st]=await Promise.all([API.get('/admin/users'),API.get('/admin/coaches'),API.get('/admin/stats')]);
  if(ur.status!==200){if(document.getElementById('adminPage'))v.innerHTML=`<div class="page on" id="adminPage">${emptyState({icon:'lock',title:'Kein Zugriff',text:'Diese Seite ist nur für Admins.'})}</div>`;return;}
  const data={ts:Date.now(),users:ur.data.users||[],counts:ur.data.counts||{},coaches:cr.data?.coaches||[],stats:st?.data||{}};
  const sig=JSON.stringify([data.users,data.counts,data.stats]);
  const changed=!ADMIN_CACHE||ADMIN_CACHE.sig!==sig;data.sig=sig;ADMIN_CACHE=data;
  if((changed||!fresh)&&document.getElementById('adminPage'))drawAdmin(v,data);}
function drawAdmin(v,data){ADMIN_USERS=data.users;ADMIN_COACHES=data.coaches;const c=data.counts,st_=data.stats;
  const roleTile=(role,label,n,ic)=>`<div class="tile" onclick="document.getElementById('adm-${role}')?.scrollIntoView({behavior:'smooth',block:'start'})"><div class="v">${fmtNum(n)}</div><div class="l">${label}</div></div>`;
  let h=`<div class="page on${document.getElementById('adminPage')?'':' first'}" id="adminPage">
    <div class="grid-3 role-strip mb-3">${roleTile('admin','Admins',c.admin||0)}${roleTile('coach','Coaches',c.coach||0)}${roleTile('athlete','Athleten',c.athlete||0)}</div>
    <div class="grid-2 mb-4">
      <div class="tile"><div class="v">${st_.active7!=null?fmtNum(st_.active7):'–'}</div><div class="l">aktiv (7 Tage)</div></div>
      <div class="tile"><div class="v">${st_.totalSets!=null?fmtNum(st_.totalSets):'–'}</div><div class="l">Sätze gesamt</div></div>
      <div class="tile"><div class="v">${st_.totalCheckins!=null?fmtNum(st_.totalCheckins):'–'}</div><div class="l">Check-ins</div></div>
      <div class="tile"><div class="v">${st_.totalMessages!=null?fmtNum(st_.totalMessages):'–'}</div><div class="l">Nachrichten</div></div>
    </div>
    <button class="btn block mb-2" onclick="adminNewUser()">${icon('plus',18)} Nutzer anlegen</button>`;
  const roleGroups=[['admin','Admins','shield'],['coach','Coaches','users'],['athlete','Athleten','dumbbell']];
  roleGroups.forEach(([role,label,ic])=>{const us=ADMIN_USERS.filter(u=>u.role===role);if(!us.length)return;
    h+=`<div class="section-label" id="adm-${role}"><span>${label}</span><span class="sl-r">${us.length}</span></div><div class="rows mb-4">`+
    // „zuletzt aktiv“ kommt als last_active (jüngster Satz/Check-in, ISO-Datum oder null) aus GET /api/admin/users.
    us.map(u=>{const sub=role==='athlete'?(u.coach_name?'Coach: '+u.coach_name:'kein Coach'):(role==='coach'?pl(u.athlete_count||0,'Athlet','Athleten'):'Voller Zugriff');
      return `<div class="row tap" onclick="adminEditUser(${u.id})"><div class="r-ic">${icon(ic)}</div>
        <div class="rl">${esc2(u.name)}${u.id===(ME&&ME.id)?' <span class="pill neutral">du</span>':''}<small>${esc2(u.email)} · ${esc2(sub)}</small></div>
        <div class="rr">${esc2(adminLastActive(u))}</div></div>`;}).join('')+`</div>`;});
  h+=`<div class="rows mb-4"><div class="row tap" onclick="go('athletes')"><div class="r-ic">${icon('users')}</div><div class="rl">Alle Athleten<small>Status, Dashboards und Pläne aller Athleten</small></div></div></div></div>`;
  v.innerHTML=h;if(typeof cacheView==='function')cacheView('admin');}
function adminNewUser(){openSheet('Neuen Nutzer anlegen',`<div id="auBox">
  <div class="field"><label>Name</label><input id="au_name" placeholder="Vor- und Nachname" maxlength="80"></div>
  <div class="field"><label>E-Mail</label><input id="au_email" type="email" inputmode="email" autocomplete="off" placeholder="name@mail.com"></div>
  <div class="field"><label>Startpasswort</label><input id="au_pw" type="password" autocomplete="new-password" placeholder="min. 6 Zeichen"></div>
  <div class="field"><label>Rolle</label><select id="au_role" onchange="auRoleChange()">
    <option value="athlete">Athlet</option><option value="coach">Coach</option><option value="admin">Admin</option></select></div>
  <div class="field" id="au_coachwrap"><label>Coach zuordnen (optional)</label><select id="au_coach"><option value="">– kein Coach –</option>${ADMIN_COACHES.map(c=>`<option value="${c.id}">${esc2(c.name)}</option>`).join('')}</select></div>
  <button class="btn block" onclick="adminCreateUser()">Anlegen</button></div>`);}
function auRoleChange(){const w=document.getElementById('au_coachwrap');if(w)w.hidden=val('au_role')!=='athlete';}
async function adminCreateUser(){const body={name:val('au_name'),email:val('au_email'),password:val('au_pw'),role:val('au_role'),coach_id:val('au_coach')||null};
  if(!body.name)return showFieldErr('auBox','Bitte einen Namen eingeben.','au_name');
  if(!body.email)return showFieldErr('auBox','Bitte eine E-Mail eingeben.','au_email');
  if(body.password.length<6)return showFieldErr('auBox','Mindestens 6 Zeichen.','au_pw');
  const r=await API.post('/admin/users',body);
  if(r.status===200){closeModal();toast('Nutzer angelegt ✓');coachInvalidate();go('admin');}else showFieldErr('auBox',r.data?.error||'Fehler');}
function adminEditUser(id){const u=ADMIN_USERS.find(x=>x.id===id);if(!u)return;
  const roleName={admin:'Admin',coach:'Coach',athlete:'Athlet'}[u.role]||u.role;
  let h=`<div id="euBox"><div class="note status mb-4">${esc2(u.email)} · aktuell <b>${roleName}</b> · zuletzt aktiv: <b>${esc2(adminLastActive(u))}</b></div>
    <div class="field"><label>Rolle</label><select id="eu_role" onchange="euRoleChange()">
      <option value="athlete"${u.role==='athlete'?' selected':''}>Athlet</option>
      <option value="coach"${u.role==='coach'?' selected':''}>Coach</option>
      <option value="admin"${u.role==='admin'?' selected':''}>Admin</option></select></div>
    <div class="field" id="eu_coachwrap"${u.role==='athlete'?'':' hidden'}><label>Coach</label><select id="eu_coach"><option value="">– kein Coach –</option>${ADMIN_COACHES.map(c=>`<option value="${c.id}"${u.coach_id===c.id?' selected':''}>${esc2(c.name)}</option>`).join('')}</select></div>
    <button class="btn block" onclick="adminSaveUser(${id})">Speichern</button></div>
    <details class="admin-more"><summary>Passwort zurücksetzen ${icon('chevronDown',18)}</summary>
      <div id="euPwBox"><div class="field mt-2"><label>Neues Passwort</label><input id="eu_pw" type="password" autocomplete="new-password" placeholder="min. 6 Zeichen"></div>
      <button class="btn sec block" onclick="adminResetPw(${id})">Passwort setzen</button></div></details>`;
  if(id!==(ME&&ME.id))h+=`<div class="danger-block"><div class="h3 mb-1">Nutzer löschen</div><div class="meta mb-3">Entfernt das Konto samt Daten. Zugeordnete Athleten bleiben erhalten, verlieren aber ihren Coach.</div>
    <button class="btn danger block" onclick="adminDeleteUser(${id},'${esc(u.name)}')">${icon('trash',18)} ${esc2(u.name)} löschen</button></div>`;
  openSheet(u.name,h);}
function euRoleChange(){const w=document.getElementById('eu_coachwrap');if(w)w.hidden=val('eu_role')!=='athlete';}
// EIN Speichern für Rolle + Coach-Zuordnung (statt zwei Buttons)
async function adminSaveUser(id){const u=ADMIN_USERS.find(x=>x.id===id);if(!u)return;const role=val('eu_role');
  if(role!==u.role){const r=await API.put('/admin/users/'+id+'/role',{role});if(r.status!==200)return showFieldErr('euBox',r.data?.error||'Fehler','eu_role');}
  if(role==='athlete'){const cid=val('eu_coach')||null;if(String(cid||'')!==String(u.coach_id||'')){const r=await API.put('/admin/users/'+id+'/coach',{coach_id:cid});if(r.status!==200)return showFieldErr('euBox',r.data?.error||'Fehler','eu_coach');}}
  closeModal();toast('Gespeichert ✓');coachInvalidate();go('admin');}
// Alte Einzel-Buttons bleiben als Aliase erreichbar
async function adminSaveRole(id){return adminSaveUser(id);}
async function adminSaveCoach(id){return adminSaveUser(id);}
async function adminResetPw(id){const next=val('eu_pw');if(!next||next.length<6)return showFieldErr('euPwBox','Mindestens 6 Zeichen.','eu_pw');
  const r=await API.post('/admin/users/'+id+'/resetpw',{next});
  if(r.status===200){closeModal();toast('Passwort zurückgesetzt ✓');}else showFieldErr('euPwBox',r.data?.error||'Fehler','eu_pw');}
function adminDeleteUser(id,name){
  confirmSheet('Nutzer löschen',`„${name}" wird endgültig gelöscht – samt Trainings-, Ernährungs- und Check-in-Daten. Das kann nicht rückgängig gemacht werden.`,{label:'Endgültig löschen',onYes:async()=>{
    const r=await API.del('/admin/users/'+id);
    if(r.status===200){closeAllSheets();toast('Nutzer gelöscht');coachInvalidate();go('admin');}else toast(r.data?.error||'Fehler');}});}

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
async function renderAthletes(v,opts){opts=opts||{};mountCoachHeader();
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
  const active=list.filter(a=>(a.trainsThisWeek||0)>0).length;
  const seg=[`<b>${pl(list.length,'Athlet','Athleten')}</b>`,`${fmtNum(active)} aktiv diese Woche`];
  if(alerts)seg.push(`<b class="tone-red">${pl(alerts,'Alarm','Alarme')}</b>`);
  if(watch)seg.push(`<span class="tone-amber">${fmtNum(watch)} beobachten</span>`);
  if(!alerts&&!watch&&list.length)seg.push(`<span class="tone-green">alle im grünen Bereich</span>`);
  return seg.map(x=>`<span>${x}</span>`).join('');}
function drawCoachStat(){const el=document.querySelector('#athPage .coach-stat');if(el)el.innerHTML=coachStatHTML(ATHLETES_CACHE);}
function drawAthletes(v,data){const list=data.list||[];ATHLETES_CACHE=list;
  const stat=coachStatHTML(list);
  let h=`<div class="page on${document.getElementById('athPage')?'':' first'}" id="athPage">`;
  if(ME&&ME.role==='admin')h+=`<button class="btn sm sec mb-3" onclick="go('admin')">${icon('chevronLeft',16)} Zur Verwaltung</button>`;
  h+=`<div class="coach-stat">${stat}</div>`;
  h+=`<div class="section-label"><span>Athleten</span><span class="sl-r"><button class="btn sm sec" onclick="addAthlete()">${icon('plus',14)} Athlet</button></span></div>`;
  if(list.length>5)h+=`<input class="field ath-search" id="athSearch" type="search" placeholder="Athlet suchen" oninput="filterAthletes(this.value)">`;
  h+=`<div id="athList"></div>`;
  const inNav=!!(ME&&ME.role==='coach'); // Coach-Navigation hat eigene Tabs für Nachrichten und Vorlagen
  h+=`<div class="section-label"><span>Mehr</span></div><div class="rows mb-4">
    ${inNav?'':`<div class="row tap" onclick="coachMessagesSheet()"><div class="r-ic">${icon('mail')}</div><div class="rl">Nachrichten<small>Unterhaltungen je Athlet</small></div></div>`}
    <div class="row tap" onclick="coachInsights()"><div class="r-ic">${icon('chartLine')}</div><div class="rl">Einblicke<small>Aktivität, Ziele, jüngste Trainings</small></div></div>
  </div></div>`;
  v.innerHTML=h;drawAthleteList(list);if(typeof cacheView==='function')cacheView('athletes');}
function filterAthletes(q){q=(q||'').toLowerCase();drawAthleteList(ATHLETES_CACHE.filter(a=>String(a.name||'').toLowerCase().includes(q)));}
function drawAthleteList(list){const el=document.getElementById('athList');if(!el)return;
  if(!list.length){el.innerHTML=ATHLETES_CACHE.length?emptyState({icon:'search',title:'Kein Treffer',text:'Kein Athlet passt zu deiner Suche.'}):
    emptyState({icon:'users',title:'Noch keine Athleten',text:'Lege einen Athleten an oder ordne dir einen bestehenden zu.',btn:{label:'Athlet hinzufügen',onclick:'addAthlete()'}});return;}
  el.innerHTML=`<div class="rows mb-3">`+list.map(a=>{
    const st=a.status||'ok';const reasons=a.reasons||[];
    const statusTxt=a.lastTrain?(a.daysSinceTrain===0?'heute trainiert':a.daysSinceTrain===1?'gestern trainiert':'Training '+daysAgoTxt(a.lastTrain)):'noch kein Training';
    const sub=[statusTxt,(a.trainsThisWeek||0)+'× diese Woche',a.goal?goalLabel(a.goal):'',a.lastWeight!=null?fmtNum(a.lastWeight,1)+' kg':''].filter(Boolean).join(' · ');
    return `<div class="row tap ath-row" onclick="openDashboard(${a.id})">${athAvatar(a.id,a.name)}
      <div class="rl">${esc2(a.name)}${st!=='ok'?attPill(st):''}${reasons.length?`<small class="reason ${st}">${reasonLine(reasons)}</small>`:''}<small>${esc2(sub)}</small></div></div>`;}).join('')+`</div>`;
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
  if(t==='new')b.innerHTML=`<div class="note mb-4">Lege direkt einen neuen Athleten an. Gib ihm Login-Daten – er kann das Passwort später selbst ändern.</div>
    <div class="field"><label>Name</label><input id="na_name" placeholder="Vor- und Nachname" maxlength="80"></div>
    <div class="field"><label>E-Mail</label><input id="na_email" type="email" inputmode="email" autocomplete="off" placeholder="athlet@mail.com"></div>
    <div class="field"><label>Startpasswort</label><input id="na_pw" type="password" autocomplete="new-password" placeholder="min. 6 Zeichen"></div>
    <button class="btn block" onclick="confirmCreateAthlete()">Athlet anlegen</button>`;
  else b.innerHTML=`<div class="note mb-4">Der Athlet hat sich bereits selbst registriert. Gib seine E-Mail ein, um ihn dir zuzuordnen.</div>
    <div class="field"><label>E-Mail</label><input id="addEmail" type="email" inputmode="email" placeholder="athlet@mail.com"></div>
    <button class="btn block" onclick="confirmAddAthlete()">Zuordnen</button>`;}
async function confirmCreateAthlete(){const body={name:val('na_name'),email:val('na_email'),password:val('na_pw')};
  if(!body.name)return showFieldErr('aaBody','Bitte einen Namen eingeben.','na_name');
  if(!body.email)return showFieldErr('aaBody','Bitte eine E-Mail eingeben.','na_email');
  if(body.password.length<6)return showFieldErr('aaBody','Mindestens 6 Zeichen.','na_pw');
  const r=await API.post('/athletes/create',body);
  if(r.status===200){closeModal();toast('Athlet angelegt ✓');coachInvalidate();go('athletes');}else showFieldErr('aaBody',r.data?.error||'Fehler');}
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
async function openDashboard(id,opts){opts=opts||{};
  const top=SHEET_STACK.length?SHEET_STACK[SHEET_STACK.length-1].title:null;
  const openAgain=!!(opts.replace&&top&&(top===athName(id)||top===COACH_DASH[id]?.d?.athlete?.name));
  if(!openAgain)openSheet('Lädt…','<div class="spinner"></div>');
  const [c,ai]=await Promise.all([loadDashboard(id),coachAiStatus()]);
  if(!c){if(!openAgain)closeModal();const s=loadDashboard.lastStatus;
    return toast(s===403||s===401?'Kein Coach-Zugriff auf diesen Athleten':'Fehler beim Laden');}
  const d=c.d,a=d.athlete,flagged=c.flagged;const listRow=(ATHLETES_CACHE||[]).find(x=>x.id===id);
  const st=listRow?athleteStatus(listRow):attentionStatusClient({daysSinceCheckin:daysSince(d.checkins[0]?.date),daysSinceTraining:daysSince(d.sessions[0]?.date),openFlags:flagged.length});
  const status=st.status||st.level,reasons=st.reasons||[];
  const lastW=d.weights[0]?.weight;const lastTrain=d.sessions[0]?.date;
  const pills=[a.goal?goalLabel(a.goal):'',phaseLabel(a.phase)||'keine Phase',a.days_per_week?a.days_per_week+'×/Woche':'',expLabel(a.experience)].filter(Boolean);
  let h=`<div class="dash-head">${athAvatar(id,a.name,'lg')}<div class="fill"><div class="dash-pills">${pills.map(t=>`<span class="pill neutral">${esc2(t)}</span>`).join('')}</div></div></div>`;
  // Gründe, die der Beschwerden-Block ohnehin zeigt, hier weglassen (nie zweimal dieselbe Aussage)
  const factReasons=flagged.length?reasons.filter(r=>!/Beschwerde/i.test(r)):reasons;
  const fseg=[attPill(status)+(factReasons.length?' '+esc2(factReasons.join(' · ')):''),`<b>${lastW!=null?fmtNum(lastW,1)+' kg':'– kg'}</b>`,`Training ${esc2(daysAgoTxt(lastTrain))}`];
  h+=`<div class="dash-facts">${fseg.map(x=>`<span>${x}</span>`).join('')}</div>`;
  // Offene Beschwerden zuerst – mit direkter Erledigung (patcht in place)
  if(flagged.length)h+=`<div class="complaints" id="complaints"><div class="ct">${icon('alertTriangle',18)}<span id="complaintsT">${pl(flagged.length,'offene Beschwerde','offene Beschwerden')}</span></div>`+
    flagged.map(n=>`<div class="complaint" id="cmp-${n.id}"><div class="cm">${esc2(n.exercise_name)} · ${fmtDate(n.date)}</div><div class="cb">${esc2(n.note)}</div>
      <button class="btn sm sec" onclick="coachResolveNote(${n.id},${id},this)">${icon('check',14)} Als erledigt markieren</button></div>`).join('')+`</div>`;
  h+=`<div class="coach-pair"><button class="btn" onclick="coachOpenPlan(${id},'${esc(a.name)}')">${icon('pencil',18)} Plan bearbeiten</button><button class="btn sec" onclick="openThread(${id},'${esc(a.name)}')">${icon('mail',18)} Nachricht</button></div>`;
  const row=(ic,label,sub,onclick)=>`<div class="row tap" onclick="${onclick}"><div class="r-ic">${icon(ic)}</div><div class="rl">${label}${sub?`<small>${sub}</small>`:''}</div></div>`;
  h+=`<div class="section-label"><span>Ansehen</span></div><div class="rows mb-4">`+
    row('user',`Als ${esc2(a.name.split(' ')[0])} ansehen`,'Home, Training, Ernährung, Mindset und Analyse im Athleten-Kontext',`coachOpenView(${id},'${esc(a.name)}','home')`)+
    row('chartLine','Volle Analyse','Körper und Training in Zahlen',`coachOpenView(${id},'${esc(a.name)}','tracker')`)+
    (ai.configured!==false?row('sparkles','KI-Analyse','Zweitmeinung aus Trainings- und Check-in-Daten',`aiSummary(${id})`):'')+`</div>`;
  h+=`<div class="section-label"><span>Verwalten</span></div><div class="rows mb-4">`+
    row('target','Phase &amp; Ziele',`${a.kcal_target_train?fmtNum(a.kcal_target_train)+' / '+fmtNum(a.kcal_target_rest||0)+' kcal':'Kalorienziele setzen'}`,`coachPhaseSheet(${id})`)+
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
    const ast=attentionStatusClient({daysSinceCheckin:daysSince(arow.lastCheckin),daysSinceTraining:arow.lastTrain?daysSince(arow.lastTrain):null,openFlags:arow.openFlags});
    arow.status=ast.level;arow.reasons=ast.reasons;
    if(document.getElementById('athList')){ATHLETES_CACHE=sortAthletes(ATHLETES_CACHE);
      const q=document.getElementById('athSearch')?.value;if(q)filterAthletes(q);else drawAthleteList(ATHLETES_CACHE);drawCoachStat();}
    if(VIEW_USER===athleteId&&typeof mountCtxBar==='function')mountCtxBar();}
  const left=c?c.flagged.length:0;const box=document.getElementById('complaints');
  if(el){el.classList.add('gone');setTimeout(()=>{el.remove();const t=document.getElementById('complaintsT');if(t)t.textContent=pl(left,'offene Beschwerde','offene Beschwerden');if(!left&&box)box.remove();},240);}
  coachInvalidate();
  if(coachResolveNote.noUndo)return toast('Als erledigt markiert ✓');
  toast('Als erledigt markiert ✓',{label:'Rückgängig',fn:async()=>{const u=await API.post('/exercise-notes/'+noteId+'/flag');
    if(u.status===200){coachInvalidate();delete COACH_DASH[athleteId];openDashboard(athleteId,{replace:true});}
    else{coachResolveNote.noUndo=true;toast('Rückgängig ist auf diesem Server noch nicht möglich');}}});}
// Alter Name (analysis.js hat ihn auch; dort mit Sheet-Neuaufbau) – hier bewusst nicht überschrieben.
// Phase & Ziele: vorbefüllt mit aktuellen Werten + Ziel-Auswahl
function coachPhaseSheet(id){const c=COACH_DASH[id];const a=c?.d?.athlete||{id,name:athName(id)};
  const opt=(v,l,cur)=>`<option value="${v}"${cur===v?' selected':''}>${l}</option>`;
  coachSheet('Phase & Ziele',a.name,`<div id="cpBox">
    <div class="note status mb-4">Aktuell: <b>${a.kcal_target_train?fmtNum(a.kcal_target_train):'–'} / ${a.kcal_target_rest?fmtNum(a.kcal_target_rest):'–'} kcal</b> (Training / Ruhe) · ${goalLabel(a.goal)} · ${phaseLabel(a.phase)||'keine Phase'}</div>
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
  if(r.status!==200){coachSheet('Monatsziel',name,`<div class="note err">${esc2(r.data?.error||'Fehler')}</div>`);return;}
  const m=r.data;const monthName=new Date(m.month+'-01T00:00:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  const left=m.parts.length-m.reachedCount;
  let h=`<div class="between mb-3"><div><div class="h3">${cap(monthName)}${m.custom?' <span class="pill red">vom Coach</span>':''}</div><div class="meta">${m.allReached?'Monatsziel erreicht':left===0?'alles geschafft':'Noch '+pl(left,'Ziel','Ziele')+' bis zur Auszeichnung'}</div></div>${m.allReached?icon('trophy',28,'tone-green'):''}</div>`;
  h+=`<div class="rows mb-4">`+m.parts.map(p=>`<div class="row"><div class="rl">${esc2(p.label)}<small>${p.key==='volume'?fmtNum(p.done):fmtNum(p.done)} / ${fmtNum(p.target)}${p.reached?' · erreicht':''}</small><div class="bar${p.reached?' green':''} mt-2"><i style="width:${Math.min(100,p.pct||0)}%"></i></div></div><div class="rr">${p.reached?icon('check',18,'tone-green'):Math.round(p.pct||0)+' %'}</div></div>`).join('')+`</div>`;
  const t=m.parts.find(p=>p.key==='trainings')?.target||0,cc=m.parts.find(p=>p.key==='checkins')?.target||0,vv=m.parts.find(p=>p.key==='volume')?.target||0;
  h+=`<button class="btn block sec" onclick="openEditMonthly('${m.month}',${t},${cc},${vv},${id})">${icon('target',18)} Ziel anpassen</button>`;
  if(m.history&&m.history.length)h+=`<div class="section-label"><span>Geschaffte Monate</span></div><div class="cluster">`+m.history.map(x=>`<span class="pill neutral">${new Date(x.month+'-01T00:00:00').toLocaleDateString('de-DE',{month:'short',year:'2-digit'})}</span>`).join('')+`</div>`;
  coachSheet('Monatsziel',name,h);}
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
  if(nm)coachSheet('Monatsziel anpassen',nm,body);else openSheet('Monatsziel anpassen',body);}
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
    el.innerHTML=`<div class="eyebrow mb-2">Coach-Übersicht</div>`+(s===403||s===401
      ? `<div class="note warn">Du hast keinen Coach-Zugriff auf ${who} – der Athlet ist dir nicht (mehr) zugeordnet oder deine Sitzung gehört zu einem anderen Konto.</div>
         <button class="btn sm sec mt-3" onclick="coachLeaveAthlete()">Zur Athletenliste</button>`
      : `<div class="note err">Daten konnten nicht geladen werden.</div>
         <button class="btn sm sec mt-3" onclick="coachHomeCardFill(${id})">${icon('refresh',16)} Erneut versuchen</button>`);return;}
  el.outerHTML=coachHomeCardHTML(c);loadAthAvatars([id]);}
function coachHomeCardHTML(c){const d=c.d,a=d.athlete,id=a.id,fl=c.flagged||[];
  const listRow=(ATHLETES_CACHE||[]).find(x=>x.id===id);
  const st=listRow?athleteStatus(listRow):attentionStatusClient({daysSinceCheckin:daysSince(d.checkins[0]?.date),daysSinceTraining:daysSince(d.sessions[0]?.date),openFlags:fl.length});
  const status=st.status||st.level;const lc=d.checkins[0],ls=d.sessions[0];
  const n=esc2(a.name),nm=esc(a.name);
  const row=(ic,label,rr,onclick)=>`<div class="row${onclick?' tap':''}"${onclick?` onclick="${onclick}"`:''}><div class="r-ic">${icon(ic)}</div><div class="rl">${label}</div><div class="rr">${rr}</div></div>`;
  return `<div class="card coach-home" id="coachHomeCard">
    <div class="between mb-3"><div><div class="eyebrow">Coach-Übersicht</div><div class="h2">${n}</div></div>${attPill(status)}</div>
    ${(st.reasons||[]).length?`<div class="meta mb-3">${st.reasons.map(esc2).join(' · ')}</div>`:''}
    <div class="coach-facts">
      ${row('scale','Letzter Check-in',lc?`${lc.weight!=null?fmtNum(lc.weight,1)+' kg · ':''}${esc2(daysAgoTxt(lc.date))}`:'noch keiner')}
      ${row('dumbbell','Letztes Training',ls?`${esc2(ls.dayName||'Training')} · ${esc2(daysAgoTxt(ls.date))}`:'noch keins')}
      ${row('alertTriangle','Offene Beschwerden',fl.length?`<b class="tone-red">${fl.length}</b>`:'keine',fl.length?`openDashboard(${id})`:'')}
      ${row('utensils','Kalorienziele',a.kcal_target_train?`${fmtNum(a.kcal_target_train)} / ${fmtNum(a.kcal_target_rest||0)} kcal`:'nicht gesetzt',`coachPhaseSheet(${id})`)}
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
  coachSheet('Nachricht',name,`<div id="qmBox">
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
function threadHTML(t){const id=t.id;let lastDay='';
  const bubbles=t.msgs.map(m=>{const mine=m.from_id===ME.id;const sys=m.kind&&m.kind!=='message';
    const d=cParseTs(m.created_at);const day=d?fmtDate(d,{weekday:'short'}):'';let sep='';if(day&&day!==lastDay){lastDay=day;sep=`<div class="thread-day">${esc2(day)}</div>`;}
    const title=m.title&&!/^Nachricht vo[mn] /i.test(m.title)?`<div class="bt">${esc2(m.title)}</div>`:'';
    if(sys)return sep+`<div class="bub sys">${esc2(m.title||'')}${m.body?' – '+esc2(m.body):''}</div>`;
    return sep+`<div class="bub ${mine?'me':'them'}">${title}${esc2(m.body||'')}<div class="bd">${cTime(m.created_at)}</div></div>`;}).join('');
  return `<div class="thread" id="thread">${bubbles||emptyState({icon:'mail',title:'Noch keine Nachrichten',text:'Schreib '+t.name.split(' ')[0]+' die erste Nachricht.'})}</div>
    <div class="thread-compose"><textarea id="th_body" rows="1" placeholder="Nachricht an ${esc2(t.name.split(' ')[0])}…" maxlength="2000" oninput="this.style.height='auto';this.style.height=Math.min(120,this.scrollHeight)+'px'"></textarea>
      <button class="btn icon red" aria-label="Senden" onclick="sendThread(${id})">${icon('send',20)}</button></div>`;}
async function openThread(id,name){name=name||athName(id);openSheet('Unterhaltung','<div class="spinner"></div>');
  const msgs=await loadThread(id);THREAD={id,name,msgs};
  coachSheet('Unterhaltung',name,threadHTML(THREAD),{size:'tall'});
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
  const th=document.getElementById('thread');if(th){th.querySelector('.empty')?.remove();th.insertAdjacentHTML('beforeend',`<div class="bub me">${esc2(body)}<div class="bd">${cTime(m.created_at)}</div></div>`);}
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
  let h=t.rows.length?`<div class="rows mb-4">`+t.rows.map(({a,g})=>`<div class="row tap msg-row" onclick="openThread(${a.id},'${esc(a.name)}')">${athAvatar(a.id,a.name,'sm')}
      <div class="rl">${esc2(a.name)}${g&&g.unread?` <span class="pill red">${g.unread} neu</span>`:''}<small class="truncate">${g?.last?esc2(g.last.body||g.last.title||''):'Noch keine Nachrichten'}</small></div>
      <div class="rr">${g?.last?esc2(cRelTime(g.last.created_at)):''}</div></div>`).join('')+`</div>`:
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
  if(!list.length)h+=emptyState({icon:'fileSpreadsheet',title:'Noch keine Vorlagen',text:'Öffne den Plan eines Athleten und speichere ihn dort über „···" › „Als Vorlage speichern". Danach weist du ihn jedem Athleten mit einem Tipp zu.',btn:{label:'Zu den Athleten',onclick:"go('athletes')"}});
  else{h+=`<div class="coach-stat"><span><b>${pl(list.length,'Vorlage','Vorlagen')}</b></span><span>im Plan eines Athleten anwendbar</span></div>`;
    h+=`<div class="rows mb-4">`+list.map(t=>`<div class="row"><div class="r-ic">${icon('fileSpreadsheet')}</div>
      <div class="rl">${esc2(t.name)}<small>${pl(t.days,'Tag','Tage')} · ${pl(t.exercises,'Übung','Übungen')}</small></div>
      <div class="rr"><button class="btn icon sm ghost" aria-label="Vorlage löschen" onclick="delTemplate(${t.id},'${esc(t.name)}')">${icon('trash',18)}</button></div></div>`).join('')+`</div>`;
    h+=`<div class="note status">Anwenden: Athlet öffnen › Training › „···" › „Vorlage anwenden".</div>`;}
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
  if(st.configured===false)return coachSheet('KI-Analyse',name,`<div class="note status">Die KI-Analyse ist auf diesem Server nicht aktiviert.</div>`);
  openSheet('KI-Analyse',`<div class="spinner"></div><p class="center muted">Analysiere Trainings- und Check-in-Daten…</p>`);
  const r=await API.post('/ai/summary/'+id,{});
  if(r.status===200)coachSheet('KI-Analyse',name,`<div class="ai-text">${esc2(r.data.summary||'')}</div><div class="caption mt-4">KI-generiert – als Zweitmeinung gedacht. Deine Coach-Einschätzung zählt.</div>`);
  else{const err=String(r.data?.error||'');const friendly=/konfiguriert|API_KEY/i.test(err)?'Die KI-Analyse ist auf diesem Server nicht aktiviert.':(err||'Fehler bei der Analyse.');
    coachSheet('KI-Analyse',name,`<div class="note err mb-4">${esc2(friendly)}</div><button class="btn block sec" onclick="closeModal()">OK</button>`);}}

// ===== COACH: SUPPLEMENTS für Athlet verwalten (Zugewiesen / Katalog, Toggle je Zeile, in-place) =====
let COACH_SUPP_CTX={uid:null,name:'',cat:[],assigned:{}};
async function coachSupp(uid,name){name=name||athName(uid);openSheet('Supplements','<div class="spinner"></div>');
  const [catR,aR]=await Promise.all([API.get('/supplements-catalog'),API.get('/supplements/'+uid)]);
  const cat=catR.data?.supplements||[];
  const assigned={};(aR.data?.personalized?aR.data.supplements:[]).forEach(s=>{assigned[s.id]={mandatory:s.mandatory,dose:s.dose,timing:s.timing,note:s.note};});
  COACH_SUPP_CTX={uid,name,cat,assigned};
  coachSheet('Supplements',name,`<div class="meta mb-3">Schalter = zuweisen. Zeile antippen für Pflicht, Dosierung und Timing.</div><div id="csBody">${coachSuppBodyHTML()}</div>`);}
function coachSuppBodyHTML(){const {cat,assigned}=COACH_SUPP_CTX;
  const row=s=>{const a=assigned[s.id];const on=!!a;
    const status=a?(a.mandatory?'<span class="pill must">Pflicht</span>':'<span class="pill neutral">optional</span>'):'';
    return `<div class="row supp-row" id="cs-${s.id}"><button class="tgl${on?' on':''}" role="switch" aria-checked="${on}" aria-label="${esc2(s.name)} zuweisen" onclick="coachToggleSupp(${s.id})"></button>
      <div class="rl" onclick="coachEditSupp(${s.id})">${esc2(s.name)}<small>${esc2([a?.dose||s.dose,a?.timing||s.timing].filter(Boolean).join(' · '))}</small></div>
      <div class="rr" onclick="coachEditSupp(${s.id})">${status}${icon('chevronRight',16)}</div></div>`;};
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
  coachSheet(s.name,name,`<div id="csEdit">
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
  coachSheet('Import',name,`
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
    if(r.status!==200){coachSheet('Import',IMPORT.athleteName,`<div class="note err mb-4">${esc2(r.data?.error||'Fehler beim Lesen')}</div><button class="btn block sec" onclick="openImport(${IMPORT.athleteId},'${esc(IMPORT.athleteName)}')">Andere Datei</button>`);return;}
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
  coachSheet('Import',IMPORT.athleteName,h);}
async function doImport(){
  const sh=IMPORT.sheets[IMPORT.sheetIdx];
  const dayType=document.getElementById('imp_daytype')?.value||'training'; // VOR dem Ersetzen des Sheets lesen
  openSheet('Import','<div class="spinner"></div>');
  let r;
  if(IMPORT.type==='training')r=await API.post('/import/apply-training/'+IMPORT.athleteId,{rows:sh.rows,mapping:IMPORT.mapping,headerIdx:IMPORT.headerIdx,planName:'Import: '+sh.name});
  else r=await API.post('/import/apply-nutrition/'+IMPORT.athleteId,{rows:sh.rows,mapping:IMPORT.mapping,headerIdx:IMPORT.headerIdx,dayType});
  if(r.status!==200){coachSheet('Import',IMPORT.athleteName,`<div class="note err mb-4">${esc2(r.data?.error||'Fehler')}</div><button class="btn block sec" onclick="drawImportMapping()">Zurück zur Zuordnung</button>`);return;}
  const d=r.data;if(VIEW_USER===IMPORT.athleteId){PLAN=null;TODAY=null;}coachInvalidate();
  coachSheet('Import',IMPORT.athleteName,`<div class="center">
    <div class="import-ok">${icon('check',32)}</div>
    <div class="h2 mb-1">Übernommen</div>
    <div class="body muted mb-2">${IMPORT.type==='training'?`${pl(d.days,'Trainingstag','Trainingstage')} mit ${pl(d.exercises,'Übung','Übungen')}`:`${pl(d.meals,'Mahlzeit','Mahlzeiten')} mit ${pl(d.items,'Lebensmittel','Lebensmitteln')}`} für ${esc2(IMPORT.athleteName)}.</div>
    ${IMPORT.type==='training'?'<div class="caption mb-4">Der Athlet wurde benachrichtigt.</div>':'<div class="mb-4"></div>'}
    <button class="btn block" onclick="closeAllSheets();openDashboard(${IMPORT.athleteId})">Fertig</button>
  </div>`);
  toast('Import erfolgreich ✓');}

// ===== PLAN-VORLAGEN (Coach) =====
function saveAsTemplate(){const name=COACH_CONTEXT||athName(VIEW_USER);
  coachSheet('Als Vorlage speichern',name,`<div id="tplBox">
    <div class="note mb-4">Speichert den aktuellen Plan als wiederverwendbare Vorlage – z.B. „Push/Pull/Legs Anfänger". Du kannst sie jedem Athleten mit einem Tipp zuweisen.</div>
    <div class="field"><label>Name der Vorlage</label><input id="tpl_name" placeholder="z.B. Oberkörper/Unterkörper 4x" maxlength="80"></div>
    <button class="btn block" onclick="doSaveTemplate()">Speichern</button></div>`);}
async function doSaveTemplate(){const name=val('tpl_name');if(!name)return showFieldErr('tplBox','Bitte einen Namen eingeben.','tpl_name');
  const r=await API.post('/templates',{name,from_user_id:VIEW_USER});
  if(r.status===200){closeModal();toast('Vorlage gespeichert ✓ ('+pl(r.data.days,'Tag','Tage')+')');}else showFieldErr('tplBox',r.data?.error||'Fehler');}
async function openTemplates(){openSheet('Vorlagen','<div class="spinner"></div>');
  const r=await API.get('/templates');const list=r.data?.templates||[];const inCtx=coachView();
  if(!list.length){openSheet('Vorlagen',emptyState({icon:'fileSpreadsheet',title:'Noch keine Vorlagen',text:inCtx?'Speichere zuerst diesen Plan als Vorlage.':'Speichere im Plan eines Athleten „Als Vorlage speichern".',btn:inCtx?{label:'Als Vorlage speichern',onclick:'saveAsTemplate()'}:null}));return;}
  let h=inCtx?`<div class="note warn mb-4">Beim Anwenden wird der aktuelle Plan von ${esc2(COACH_CONTEXT)} ersetzt (der alte bleibt deaktiviert erhalten). Geloggte Sätze gehen nicht verloren.</div>`
    :`<div class="meta mb-3">Anwenden kannst du eine Vorlage im Plan eines Athleten (Training › „···").</div>`;
  h+=`<div class="rows">`+list.map(t=>`<div class="row${inCtx?' tap':''}"${inCtx?` onclick="applyTemplate(${t.id},'${esc(t.name)}')"`:''}><div class="r-ic">${icon('fileSpreadsheet')}</div>
    <div class="rl">${esc2(t.name)}<small>${pl(t.days,'Tag','Tage')} · ${pl(t.exercises,'Übung','Übungen')}</small></div>
    <div class="rr"><button class="btn icon sm ghost" aria-label="Vorlage löschen" onclick="event.stopPropagation();delTemplate(${t.id},'${esc(t.name)}')">${icon('trash',18)}</button></div></div>`).join('')+`</div>`;
  openSheet('Vorlagen',h);}
function applyTemplate(id,name){
  confirmSheet('Vorlage anwenden',`„${name}" auf ${COACH_CONTEXT||'diesen Athleten'} anwenden? Der aktuelle Plan wird ersetzt.`,{label:'Anwenden',danger:false,onYes:async()=>{
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
