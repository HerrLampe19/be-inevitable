// BE INEVITABLE – Frontend, Teil «account.js». Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js.
// Inhalt (WP6 «Konto & Einstieg»): Login-Ansicht (Markup wird beim Laden in #loginView injiziert, index.html bleibt
// eingefroren) · Passwort vergessen/zurücksetzen · Nachrichten · Profil-Hub mit Unter-Sheets und Auto-Save ·
// Push-Status · Teilen-Links · Apple-Health-Import (Sheet) · Tour/Install-Hinweis.
// Hinweis: Einige Funktionen ÜBERSCHREIBEN bewusst gleichnamige Definitionen aus core.js/analysis.js (account.js lädt
// später) – sie sind unten jeweils mit «überschreibt …» markiert, damit die Integration sie ggf. zusammenführt.

// ===== LOGIN-ANSICHT =====
// Ersetzt das eingefrorene Markup in #loginView durch das neue Layout (Wortmarke ≤220 px, Segment Anmelden|Registrieren,
// gleiche Element-IDs, damit core.js (toggleAuth/doAuth/showErr) und shell.js (#loginVersion) unverändert funktionieren).
function renderLoginView(){const v=document.getElementById('loginView');if(!v)return;
  v.innerHTML=`<div class="login-brand">
    <img src="/logo-wide.jpg" alt="BE INEVITABLE" class="login-logo">
    <h1>Werde unaufhaltbar.</h1>
    <p>Training, Ernährung &amp; Coaching in einem.</p>
  </div>
  <form class="card login-card" id="authForm" onsubmit="doAuth();return false" novalidate>
    <div class="seg auth-seg" id="authSeg" role="tablist">
      <button type="button" class="on" id="authTabLogin" role="tab" onclick="setAuthMode('login')">Anmelden</button>
      <button type="button" id="authTabReg" role="tab" onclick="setAuthMode('register')">Registrieren</button>
    </div>
    <p class="login-promo hidden" id="authPromo">Kostenlos – dein Trainings- &amp; Ernährungsplan in unter einer Minute.</p>
    <div id="authErr" class="err hidden" role="alert"></div>
    <div id="regName" class="field hidden"><label for="i_name">Name</label><input id="i_name" name="name" autocomplete="name" placeholder="Dein Name" maxlength="80" enterkeyhint="next"></div>
    <div class="field"><label for="i_email">E-Mail</label><input id="i_email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="du@mail.com" enterkeyhint="next"></div>
    <div class="field"><label for="i_pw">Passwort</label><input id="i_pw" name="password" type="password" autocomplete="current-password" placeholder="••••••••" enterkeyhint="go"></div>
    <button class="btn block" id="authBtn" type="submit">Anmelden</button>
    <div class="switch hidden" id="switchLink" aria-hidden="true">Noch kein Konto? <a onclick="toggleAuth()">Registrieren</a></div>
    <div class="switch login-forgot" id="forgotLink"><a onclick="openForgot()">Passwort vergessen?</a></div>
    <div id="loginVersion" class="login-version"></div>
  </form>`;
  syncAuthSeg();}
// Segment steuert den bestehenden Modus-Wechsel (toggleAuth in core.js behält Autocomplete-Umschaltung & Button-Text)
function setAuthMode(mode){const cur=typeof authMode!=='undefined'?authMode:'login';
  if(mode!==cur&&typeof toggleAuth==='function')toggleAuth();
  syncAuthSeg();
  if(mode==='register')setTimeout(()=>document.getElementById('i_name')?.focus(),50);}
function syncAuthSeg(){const reg=(typeof authMode!=='undefined'?authMode:'login')==='register';
  document.getElementById('authTabLogin')?.classList.toggle('on',!reg);
  document.getElementById('authTabReg')?.classList.toggle('on',reg);
  document.getElementById('authTabLogin')?.setAttribute('aria-selected',String(!reg));
  document.getElementById('authTabReg')?.setAttribute('aria-selected',String(reg));
  document.getElementById('authPromo')?.classList.toggle('hidden',!reg);}
renderLoginView(); // sofort beim Laden – INIT (shell.js) läuft danach und findet alle IDs

// ===== PASSWORT VERGESSEN / ZURÜCKSETZEN (überschreibt core.js – Login-Bereich, WP6) =====
// Formulare mit Inline-Fehlern (showFieldErr), Enter sendet ab, Autocomplete für Passwort-Manager.
function openForgot(){openSheet('Passwort zurücksetzen',`<form id="fpForm" onsubmit="submitForgot();return false" novalidate>
    <p class="body muted mb-4">Gib deine E-Mail ein. Wenn ein Konto existiert, senden wir dir einen Link zum Zurücksetzen.</p>
    <div class="field"><label for="fp_email">E-Mail</label><input id="fp_email" type="email" autocomplete="email" inputmode="email" placeholder="du@mail.com" enterkeyhint="send"></div>
    <button class="btn block" type="submit">Link anfordern</button></form>`);
  setTimeout(()=>document.getElementById('fp_email')?.focus({preventScroll:true}),380);}
async function submitForgot(){const email=val('fp_email');
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return showFieldErr('fpForm','Bitte eine gültige E-Mail eingeben.','fp_email');
  const btn=document.querySelector('#fpForm .btn');if(btn)btn.disabled=true;
  await API.post('/forgot-password',{email});
  openSheet('E-Mail unterwegs',`<p class="body mb-4">Wenn ein Konto zu <b>${esc2(email)}</b> existiert, ist eine E-Mail mit einem Link zum Zurücksetzen unterwegs. Schau auch im Spam-Ordner nach.</p>
    <button class="btn block" onclick="closeAllSheets()">Alles klar</button>`);}
// Reset-Formular (vom Link ?reset=TOKEN aufgerufen) – funktioniert ohne Login
function showResetForm(token){
  document.getElementById('loginView')?.classList.remove('hidden');
  document.getElementById('appView')?.classList.add('hidden');
  document.getElementById('onbView')?.classList.add('hidden');
  openSheet('Neues Passwort festlegen',`<form id="rpForm" onsubmit="submitReset('${esc(token)}');return false" novalidate>
    <p class="body muted mb-4">Wähle ein neues Passwort für dein Konto.</p>
    <div class="field"><label for="rp_pw">Neues Passwort</label><input id="rp_pw" type="password" autocomplete="new-password" placeholder="mind. 6 Zeichen" enterkeyhint="next"></div>
    <div class="field"><label for="rp_pw2">Wiederholen</label><input id="rp_pw2" type="password" autocomplete="new-password" placeholder="nochmal eingeben" enterkeyhint="done"></div>
    <button class="btn block" type="submit">Passwort speichern</button></form>`);}
async function submitReset(token){const pw=val('rp_pw'),pw2=val('rp_pw2');
  if(!pw||pw.length<6)return showFieldErr('rpForm','Mindestens 6 Zeichen.','rp_pw');
  if(pw!==pw2)return showFieldErr('rpForm','Die Passwörter stimmen nicht überein.','rp_pw2');
  const btn=document.querySelector('#rpForm .btn');if(btn)btn.disabled=true;
  const r=await API.post('/reset-password',{token,password:pw});
  history.replaceState(null,'',location.pathname); // Reset-Param aus der URL entfernen
  if(r.status===200){
    openSheet('Passwort geändert',`<div class="note ok mb-4">Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.</div>
      <button class="btn block" onclick="closeAllSheets()">Zur Anmeldung</button>`);
  }else{ // ungültiger/abgelaufener Link: Sheet-Inhalt ersetzen statt Toast über dem Modal
    const b=document.getElementById('sheetBody');if(!b)return toast(r.data?.error||'Link ungültig oder abgelaufen');
    b.innerHTML=`<div class="err">${esc2(r.data?.error||'Der Link ist ungültig oder abgelaufen.')}</div>
      <button class="btn block" onclick="openForgot()">Neuen Link anfordern</button>
      <button class="btn block sec mt-2" onclick="closeAllSheets()">Zur Anmeldung</button>`;}}

// Gegenstück zu showFieldErr (WP0): markiert ein Feld wieder als gültig und entfernt seine Inline-Meldung.
function clearFieldErr(fieldId){const f=document.getElementById(fieldId);if(!f)return;
  const field=f.closest('.field');if(!field)return;
  field.classList.remove('invalid');field.querySelectorAll('.err[data-ferr]').forEach(e=>e.remove());}

// ===== NACHRICHTEN =====
// SQLite datetime('now') liefert UTC ohne Zeitzone ("YYYY-MM-DD HH:MM:SS") -> als UTC parsen
function _dbDate(s){if(!s)return null;if(s instanceof Date)return s;let t=String(s);
  if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t))t=t.replace(' ','T')+'Z';
  const d=new Date(t);return isNaN(d.getTime())?null:d;}
// Relatives Datum: „gerade eben", „vor 5 Min.", „vor 2 Std.", „gestern", „vor 3 Tagen", sonst „7. Sept."
function relDate(s){const d=_dbDate(s);if(!d)return '';const now=new Date();const m=Math.round((now-d)/60000);
  if(m<1)return 'gerade eben';if(m<60)return 'vor '+m+' Min.';
  const sod=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();
  const days=Math.round((sod(now)-sod(d))/864e5);
  if(days===0)return 'vor '+Math.round(m/60)+' Std.';
  if(days===1)return 'gestern';if(days<7)return 'vor '+pl(days,'Tag','Tagen');
  return fmtDate(d,d.getFullYear()!==now.getFullYear()?{year:'numeric'}:{});}
async function openMessages(){
  // Coach/Admin: WP7 liefert eine nach Athleten gruppierte Ansicht – falls vorhanden, dorthin delegieren
  if(ME&&ME.role!=='athlete'&&typeof coachOpenMessages==='function')return coachOpenMessages();
  openSheet('Nachrichten',skeleton(3));
  const msgs=await loadMessages();
  // Ungelesene IDs VOR dem Read-Post merken -> „Neu"-Pill; Badge = nur echte ungelesene Nachrichten (Hinweise zählen nicht)
  const unread=new Set(msgs.filter(m=>!m.read).map(m=>m.id));
  if(unread.size)await API.post('/messages/'+ME.id+'/read');
  UNREAD=0;{const b=document.getElementById('bellBadge');if(b){b.textContent='';b.classList.add('hidden');}}
  const athlete=ME.role==='athlete';const canReply=athlete&&!!ME.coach_id;
  // Leerzustand ohne Coach nicht auf einen Coach verweisen: ein selbst registrierter Athlet hat keinen und
  // kann sich auch keinen zuweisen (die Zuordnung startet immer der Coach).
  const emptyTxt=canReply?'Dein Coach schreibt dir hier.'
    :athlete?'Hier landen Hinweise der App. Sobald dich ein Coach betreut, siehst du auch seine Nachrichten hier.'
    :'Hier landen Nachrichten deiner Athleten.';
  const list=msgs.length?msgs.map(m=>{const isNew=unread.has(m.id);
    const sender=m.from_name?m.from_name:(m.kind==='system'?'System':'');
    const kind=['message','change','system'].includes(m.kind)?m.kind:'message';
    const reply=(!athlete&&m.from_id&&typeof coachQuickMessage==='function')?`<button class="btn sm sec mt-2" onclick="coachQuickMessage(${+m.from_id},'${esc(m.from_name||'')}')">Antworten</button>`:'';
    // Nachrichten kommen von anderen Nutzern -> immer escapen; Zeilenumbrüche erst NACH dem Escapen zu <br>
    return `<div class="msg ${kind}${isNew?' unread':''}"><div class="mh"><div class="mt">${esc2(m.title||'')}${isNew?' <span class="pill red">Neu</span>':''}</div><div class="md">${relDate(m.created_at)}</div></div>${sender?`<div class="mf">von ${esc2(sender)}</div>`:''}<div class="mb">${esc2(m.body||'').replace(/\n/g,'<br>')}</div>${reply}</div>`;}).join('')
    :emptyState({icon:'bell',title:'Keine Nachrichten',text:emptyTxt});
  // System-Hinweise (E-Mail bestätigen / Gesundheitsdaten) unten als ausblendbare Notizen – nie als Zähler
  let notes='';
  for(const n of pendingNotifications()){
    if(n.type==='verify')notes+=infoBox('msg_verify',`<b>E-Mail bestätigen.</b> Bestätige ${esc2(ME.email||'')}, um Passwort-Reset und Mails zu nutzen.<div class="mt-2"><button class="btn sm sec" onclick="resendVerify()">Bestätigungs-Mail senden</button></div>`);
    if(n.type==='health')notes+=infoBox('msg_health_'+(n.li||0),`<b>Gesundheitsdaten aktualisieren.</b> ${n.li?'Letzter Import vor '+pl(n.days,'Tag','Tagen')+'.':'Noch keine Daten importiert.'}<div class="mt-2"><button class="btn sm sec" onclick="closeAllSheets();if(typeof openIntegrations==='function')openIntegrations()">Jetzt importieren</button></div>`);}
  const compose=canReply?`<div class="msg-compose"><button class="btn block" onclick="replyCoach()">${icon('send',18)} Nachricht an deinen Coach</button></div>`:'';
  openSheet('Nachrichten',`<div class="msg-list">${list}</div>${notes?`<div class="msg-notes">${notes}</div>`:''}${compose}`);}
// Antwort an den Coach – ohne Betreff (Server-Standard „Nachricht von <Name>")
function replyCoach(){openSheet('An deinen Coach',`<form id="rcForm" onsubmit="sendReplyCoach();return false" novalidate>
    <div class="field"><label for="rc_body">Nachricht</label><textarea id="rc_body" rows="4" maxlength="2000" placeholder="Deine Nachricht…" enterkeyhint="send"></textarea></div>
    <button class="btn block" type="submit">Senden</button></form>`);
  setTimeout(()=>document.getElementById('rc_body')?.focus({preventScroll:true}),380);}
async function sendReplyCoach(){const body=val('rc_body');
  if(!body)return showFieldErr('rcForm','Bitte eine Nachricht eingeben.','rc_body');
  const btn=document.querySelector('#rcForm .btn');if(btn)btn.disabled=true;
  const r=await API.post('/messages/tocoach',{body});
  if(r.status===200){closeModal();toast('An deinen Coach gesendet ✓');}
  else{if(btn)btn.disabled=false;showFieldErr('rcForm',r.data?.error||'Senden fehlgeschlagen.','rc_body');}}

// ===== PROFIL-HUB (alles Konto-bezogene liegt unter dem Profil-Icon) =====
// Kurzer Hub: Avatar + Name oben, darunter Gruppen-Zeilen, die je ein Unter-Sheet öffnen (Zurück-Chevron über den
// Sheet-Stapel). Jedes Feld speichert sofort (PUT /api/profile, Teil-Update) – es gibt keinen Speichern-Button mehr.
let _PF_AVATAR_URL=null; // geladenes Profilbild (Data-URL), damit der Hub nach Rücksprung sofort das Bild zeigt
const EXP_LABEL={beginner:'Anfänger',intermediate:'Fortgeschritten',advanced:'Profi'};
const PHASE_LABEL={offseason:'Offseason',prep:'Wettkampf-Prep',maintain:'Maintenance'};
const DIET_LABEL={all:'Alles',vegetarian:'Vegetarisch',vegan:'Vegan'};
function roleLabel(r){return {admin:'Administrator',coach:'Coach',athlete:'Athlet'}[r]||'';}
function openProfile(){openSheet('Profil',profileHubHTML());loadProfileAvatar();}
function loadProfileAvatar(){if(!ME||!ME.has_avatar||_PF_AVATAR_URL)return;
  API.get('/avatar/'+ME.id).then(r=>{if(r.status===200&&r.data&&r.data.avatar){_PF_AVATAR_URL=r.data.avatar;
    const el=document.getElementById('pf_avatar');if(el){el.textContent='';el.style.backgroundImage='url('+_PF_AVATAR_URL+')';}}});}
function pfRow(fn,ic,label,sub){return `<div class="row tap" onclick="${fn}"><div class="r-ic">${icon(ic,24)}</div><div class="rl">${label}${sub?`<small>${sub}</small>`:''}</div></div>`;}
function profileHubHTML(){const u=ME||{};const staff=u.role==='coach'||u.role==='admin';
  const avatarBg=(u.has_avatar&&_PF_AVATAR_URL)?` style="background-image:url(${_PF_AVATAR_URL})"`:'';
  const head=`<div class="pf-head">
    <div id="pf_avatar" class="pf-avatar"${avatarBg}>${avatarBg?'':esc2((u.name||'?').charAt(0).toUpperCase())}</div>
    <div class="h2" id="pf_nameShow">${esc2(u.name||'')}</div>
    <div class="meta">${esc2(u.email||'')}${u.role?' · '+roleLabel(u.role):''}</div>
    <div class="pf-avatar-acts">
      <label class="btn sm sec">${icon('camera',16)} Bild ändern<input type="file" accept="image/*" class="pf-file" onchange="avatarPick(event)"></label>
      <button class="btn sm ghost${u.has_avatar?'':' hidden'}" id="pf_remove" onclick="removeAvatar()">Bild entfernen</button>
    </div>
  </div>
  <div class="field"><label for="p_name">Name</label><input id="p_name" value="${esc2(u.name||'')}" maxlength="80" autocomplete="name" enterkeyhint="done" onchange="saveProfileName()"></div>`;
  let rows='';
  if(!staff){
    const goalSub=[goalLabel(u.goal),EXP_LABEL[u.experience]||'',(u.days_per_week||4)+'×/Woche'].filter(Boolean).join(' · ');
    const kcalSub=(u.kcal_target_train||u.kcal_target_rest)?`${DIET_LABEL[u.diet_type||'all']} · ${fmtNum(u.kcal_target_train)} / ${fmtNum(u.kcal_target_rest)} kcal`:DIET_LABEL[u.diet_type||'all'];
    const goalsSub=`${fmtNum(u.sleep_goal||8,(u.sleep_goal||8)%1?1:0)} h · ${fmtNum(u.steps_goal||10000)} Schritte · ${fmtNum(u.water_goal||3,(u.water_goal||3)%1?1:0)} L`;
    rows+=`<div class="section-label">Einstellungen</div><div class="rows pf-rows">
      ${pfRow('openGoalSheet()','target','Ziel &amp; Training',esc2(goalSub))}
      ${pfRow('openNutritionSheet()','utensils','Ernährung &amp; Kalorien',esc2(kcalSub))}
      ${pfRow('openGoalsSheet()','moon','Persönliche Ziele',esc2(goalsSub))}
      ${pfRow('openNotifSheet()','bell','Benachrichtigungen','Push, Erinnerungen, E-Mail')}
      ${pfRow('openDataSheet()','apple','Daten &amp; Verbindungen','Gesundheitsdaten, Export, App')}
    </div>`;
  }else{
    rows+=`<div class="note mb-3">Als ${roleLabel(u.role)} verwaltest du ${u.role==='admin'?'das System':'deine Athleten'}. Trainings- und Ernährungsdaten gibt es hier nicht.</div>
    <div class="section-label">Einstellungen</div><div class="rows pf-rows">
      ${pfRow('openNotifSheet()','bell','Benachrichtigungen','Push, E-Mail')}
      ${pfRow('openDataSheet()','download','Daten','Export, als App installieren')}
    </div>`;
  }
  rows+=`<div class="rows pf-rows">
    ${pfRow('openAccountSheet()','user','Konto',u.email&&!u.email_verified?'E-Mail noch nicht bestätigt':'E-Mail, Passwort, Abmelden')}
    ${pfRow('openHelpSheet()','help','Hilfe',u.role==='athlete'?'Hinweise, Einführung':'Hinweise')}
  </div>
  <div class="pf-version" id="versionLine">Version ${esc2(APP_VERSION)}</div>`;
  return head+rows;}
// Hub im Sheet-Stapel aktualisieren (Werte in den Zeilen), damit der Rücksprung aus einem Unter-Sheet frische Daten zeigt
function refreshProfileHub(){if(typeof SHEET_STACK==='undefined')return;const i=SHEET_STACK.findIndex(e=>e.title==='Profil');if(i<0)return;
  SHEET_STACK[i].html=profileHubHTML();
  if(i===SHEET_STACK.length-1){const b=document.getElementById('sheetBody');if(b)b.innerHTML=SHEET_STACK[i].html;}}
// Teil-Update des Profils (Server: COALESCE -> nur übergebene Felder ändern sich). Nie go('home'):
// der aktuelle Tab wird im Hintergrund neu gezeichnet, das Sheet bleibt offen.
async function profileSave(fields,o){o=o||{};const r=await API.put('/profile',fields);
  if(r.status!==200){toast(r.data?.error||'Speichern fehlgeschlagen');return false;}
  // Lokalen Nutzer spiegeln: '' heißt „zurück auf den Standard" (Server speichert NULL),
  // {reset:[…]} ist nur ein Hilfsschlüssel für den Server und gehört nicht nach ME.
  Object.keys(fields).forEach(k=>{if(k!=='reset')ME[k]=fields[k]===''?null:fields[k];});
  if(Array.isArray(fields.reset))fields.reset.forEach(k=>{ME[k]=null;});
  if(o.msg!==false)toast(o.msg||'Gespeichert ✓');
  if(o.hub!==false)refreshProfileHub();
  TODAY=null;if(o.plan)PLAN=null;
  scheduleTabRefresh();return true;}
let _tabRefreshT=null;
function scheduleTabRefresh(){clearTimeout(_tabRefreshT);_tabRefreshT=setTimeout(refreshCurrentTab,600);}
// Aktuellen Tab neu zeichnen, ohne go() (go() würde alle Sheets schließen und nach oben scrollen)
function refreshCurrentTab(){try{if(typeof invalidateView==='function')invalidateView();}catch(e){}
  const cur=document.querySelector('.navbtn.on')?.dataset?.p;const v=document.getElementById('views');if(!cur||!v)return;
  const name={home:'renderHome',workout:'renderWorkout',diet:'renderDiet',mindset:'renderMindset',tracker:'renderTracker',athletes:'renderAthletes',admin:'renderAdmin'}[cur];
  const fn=name&&window[name];if(typeof fn!=='function')return;
  try{const p=fn(v);if(p&&typeof p.catch==='function')p.catch(e=>console.error('[profil/refresh]',e));}catch(e){console.error('[profil/refresh]',e);}}
async function saveProfileName(){const name=val('p_name');
  if(!name)return showFieldErr(null,'Der Name darf nicht leer sein.','p_name');
  clearFieldErr('p_name');
  if(name===ME.name)return;
  const ok=await profileSave({name},{msg:'Name gespeichert ✓',hub:false});
  if(ok){const n=document.getElementById('pf_nameShow');if(n)n.textContent=name;applyAvatar();
    if(typeof SHEET_STACK!=='undefined'){const e=SHEET_STACK.find(x=>x.title==='Profil');if(e&&e!==SHEET_STACK[SHEET_STACK.length-1])e.html=profileHubHTML();}}}
function saveSimpleProfile(){return saveProfileName();} // legacy-Name (Coach-Profil)
// legacy: früher sammelte saveProfile() alle Felder des langen Formulars – heute speichert jedes Feld selbst.
async function saveProfile(){const f={};[['p_name','name'],['p_height','height_cm'],['p_kt','kcal_target_train'],['p_kr','kcal_target_rest']].forEach(([id,k])=>{const el=document.getElementById(id);if(el&&el.value!=='')f[k]=k==='name'?el.value.trim():parseFloat(el.value);});
  if(Object.keys(f).length)await profileSave(f);}
// Chip-Auswahl (Ziel/Erfahrung/Phase/Ernährungsweise): sofort speichern, bei Fehler zurückspringen
function pfChips(key,opts){return opts.map(([v,l])=>`<button type="button" class="chip${String(ME[key]??'')===v?' on':''}" data-v="${v}" onclick="pfPick('${key}','${v}',this)">${l}</button>`).join('');}
async function pfPick(key,v,btn){if(String(ME[key]??'')===v)return;const row=btn.parentElement;
  row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===btn));
  const ok=await profileSave({[key]:v});
  if(!ok)row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.v===String(ME[key]??'')));}
// Zahlenfeld: bei Änderung speichern. reset:true -> leeres Feld setzt auf Standard zurück (Server: '' = NULL)
async function pfNum(key,el,o){o=o||{};const raw=String(el.value||'').trim();const field=el.closest('.field');
  if(raw===''){if(o.reset){if(ME[key]==null)return;const ok=await profileSave({[key]:''});if(ok)pfFlash(field);return;}
    el.value=ME[key]??'';return;}
  const n=parseFloat(raw);if(isNaN(n)){el.value=ME[key]??'';return;}
  if(ME[key]!=null&&Number(ME[key])===n)return;
  const ok=await profileSave({[key]:n});if(ok)pfFlash(field);else el.value=ME[key]??'';}
function pfFlash(field){if(!field)return;field.classList.add('saved');setTimeout(()=>field.classList.remove('saved'),1500);}
// --- Unter-Sheet: Ziel & Training ---
function openGoalSheet(){const u=ME;const dpw=u.days_per_week||4;
  openSheet('Ziel & Training',`
    <div class="section-label">Ziel</div>
    <div class="chip-row wrap">${pfChips('goal',[['muscle','Muskelaufbau'],['fatloss','Definition'],['health','Gesundheit']])}</div>
    <div class="section-label">Erfahrung</div>
    <div class="chip-row wrap">${pfChips('experience',[['beginner','Anfänger'],['intermediate','Fortgeschritten'],['advanced','Profi']])}</div>
    <p class="caption mt-2">Anfänger bekommen mehr Erklärungen, Profis alle Details (RIR, Volumen).</p>
    <div class="section-label">Phase</div>
    <div class="chip-row wrap">${pfChips('phase',[['offseason','Offseason'],['prep','Wettkampf-Prep'],['maintain','Maintenance']])}</div>
    <div class="section-label">Trainings pro Woche</div>
    <div class="chip-row wrap" id="pf_days">${[1,2,3,4,5,6,7].map(n=>`<button type="button" class="chip${n===dpw?' on':''}" data-v="${n}" onclick="pfDaysPick(${n})">${n}×</button>`).join('')}</div>
    <p class="caption mt-2">Legt deinen Rhythmus fest (z.B. 2 Tage Training, 1 Ruhetag) – keine festen Wochentage. Nach Pausen machst du nahtlos weiter.</p>
    <div class="note mt-4">Änderungen werden sofort gespeichert.</div>`);}
// Frequenz ändern baut den Rhythmus neu -> Bestätigung (confirmSheet statt window.confirm)
function pfDaysPick(n){const cur=ME.days_per_week||4;if(n===cur)return;
  confirmSheet('Trainingstage ändern',`Du änderst die Trainingstage pro Woche von ${cur} auf ${n}.\n\nDein Trainingsrhythmus wird neu berechnet – manuell im Kalender geplante Tage gehen dabei verloren.`,
    {label:`Auf ${n}× ändern`,danger:false,cancel:'Abbrechen',onYes:async()=>{
      const ok=await profileSave({days_per_week:n},{plan:true,msg:'Trainingstage gespeichert ✓'});
      if(ok)document.querySelectorAll('#pf_days .chip').forEach(c=>c.classList.toggle('on',c.dataset.v===String(n)));}});}
// --- Unter-Sheet: Ernährung & Kalorien ---
function openNutritionSheet(){const u=ME;
  const start=u.start_weight?`Startgewicht ${fmtNum(u.start_weight,1)} kg${u.created_at?' · gesetzt am '+fmtDate(u.created_at):''}`:'Kein Startgewicht gesetzt';
  openSheet('Ernährung & Kalorien',`
    <div class="section-label">Ernährungsweise</div>
    <div class="chip-row wrap">${pfChips('diet_type',[['all','Alles'],['vegetarian','🥕 Vegetarisch'],['vegan','🌱 Vegan']])}</div>
    <p class="caption mt-2">Filtert Rezepte und deinen Ernährungsplan.</p>
    <div class="section-label">Kalorienziele</div>
    <div class="grid-2">
      <div class="field"><label for="p_kt">Trainingstag (kcal)</label><input id="p_kt" type="number" inputmode="numeric" min="0" max="15000" value="${u.kcal_target_train||''}" placeholder="z.B. 3000" onchange="pfNum('kcal_target_train',this)"></div>
      <div class="field"><label for="p_kr">Ruhetag (kcal)</label><input id="p_kr" type="number" inputmode="numeric" min="0" max="15000" value="${u.kcal_target_rest||''}" placeholder="z.B. 2600" onchange="pfNum('kcal_target_rest',this)"></div>
    </div>
    <p class="caption">Dein Coach kann diese Ziele ebenfalls anpassen.</p>
    <div class="section-label">Körperdaten</div>
    <div class="field"><label for="p_height">Größe (cm)</label><input id="p_height" type="number" inputmode="numeric" min="50" max="260" value="${u.height_cm||''}" placeholder="z.B. 180" onchange="pfNum('height_cm',this)"></div>
    <div class="note status">${esc2(start)}<br><span class="muted-2">Fest – daran wird dein Fortschritt gemessen. Korrektur über deinen Coach.</span></div>
    <div class="note mt-3">Änderungen werden sofort gespeichert.</div>`);}
// --- Unter-Sheet: Persönliche Ziele ---
function openGoalsSheet(){const u=ME;
  openSheet('Persönliche Ziele',`
    <div class="grid-3 mt-2">
      <div class="field"><label for="p_sleepg">Schlaf (h)</label><input id="p_sleepg" type="number" inputmode="decimal" step="0.5" min="0" max="24" value="${u.sleep_goal??''}" placeholder="Standard 8" onchange="pfNum('sleep_goal',this,{reset:true})"></div>
      <div class="field"><label for="p_stepsg">Schritte</label><input id="p_stepsg" type="number" inputmode="numeric" min="0" max="100000" value="${u.steps_goal??''}" placeholder="Standard 10.000" onchange="pfNum('steps_goal',this,{reset:true})"></div>
      <div class="field"><label for="p_waterg">Wasser (L)</label><input id="p_waterg" type="number" inputmode="decimal" step="0.1" min="0" max="30" value="${u.water_goal??''}" placeholder="Standard 3" onchange="pfNum('water_goal',this,{reset:true})"></div>
    </div>
    <div class="note">Diese Ziele erscheinen als grüne Linie in deiner Analyse. Leer lassen = Standard (8 h · 10.000 Schritte · 3 L). Änderungen werden sofort gespeichert.</div>`);}
// --- Unter-Sheet: Benachrichtigungen (Push mit echtem Status, Uhrzeiten als Chips, Mindset, E-Mail) ---
function openNotifSheet(){const u=ME;const athlete=u.role==='athlete';
  const pushSub=athlete?(u.coach_id?'Trainings-Erinnerung und Nachrichten deines Coachs':'Trainings-Erinnerung und Hinweise der App'):'Neue Nachrichten deiner Athleten';
  // Beide Erinnerungs-Reihen führen '' = Aus als erste Wahl; NULL in der DB bedeutet in beiden Fällen „keine Erinnerung"
  const ph=u.push_hour==null?'':String(u.push_hour);const mh=u.mindset_push_hour==null?'':String(u.mindset_push_hour);
  let h=`<div class="rows mb-3">
    <div class="switch-row"><div class="r-ic">${icon('bell',24)}</div><div class="rl">Push-Mitteilungen<small id="pf_pushStatus">Status wird geprüft…</small></div><button type="button" class="tgl" id="pf_pushTgl" role="switch" aria-checked="false" aria-label="Push-Mitteilungen" onclick="togglePush()"></button></div>
    <div class="switch-row"><div class="r-ic">${icon('mail',24)}</div><div class="rl">E-Mail<small>Benachrichtigungen auch per E-Mail</small></div><button type="button" class="tgl${u.email_notifications?' on':''}" id="p_notif" role="switch" aria-checked="${u.email_notifications?'true':'false'}" aria-label="E-Mail-Benachrichtigungen" onclick="toggleEmailNotif(!this.classList.contains('on'),this)"></button></div>
  </div>
  <p class="caption mb-2">${pushSub}.</p>`;
  if(athlete){
    h+=`<div class="section-label">Trainings-Erinnerung</div>
    <div class="chip-row wrap" id="pf_pushHour">${[['','Aus'],['5','5 Uhr'],['6','6 Uhr'],['7','7 Uhr'],['8','8 Uhr'],['9','9 Uhr'],['10','10 Uhr'],['11','11 Uhr'],['12','12 Uhr']].map(([v,l])=>`<button type="button" class="chip${v===ph?' on':''}" data-v="${v}" onclick="pfPushHour('${v}',this)">${l}</button>`).join('')}</div>
    <p class="caption mt-2">An Trainingstagen zur vollen Stunde · deutsche Zeit · nur mit aktiven Push-Mitteilungen. „Aus" betrifft nur diese Erinnerung.</p>
    <div class="section-label">Priming-Erinnerung</div>
    <div class="chip-row wrap" id="pf_mindHour">${[['','Aus'],['5','5 Uhr'],['6','6 Uhr'],['7','7 Uhr'],['8','8 Uhr'],['9','9 Uhr'],['10','10 Uhr']].map(([v,l])=>`<button type="button" class="chip${v===mh?' on':''}" data-v="${v}" onclick="pfMindHour('${v}',this)">${l}</button>`).join('')}</div>
    <p class="caption mt-2">„Zeit für dein Priming" zur gewählten Stunde, solange heute noch kein Priming gespeichert ist.</p>
    <div class="rows mt-3 mb-3">
      <div class="switch-row"><div class="r-ic">${icon('moon',24)}</div><div class="rl">Abend-Reflexion<small>Erinnerung um 20 Uhr</small></div><button type="button" class="tgl${u.evening_push?' on':''}" id="p_evepush" role="switch" aria-checked="${u.evening_push?'true':'false'}" aria-label="Abend-Reflexion erinnern" onclick="toggleEvePush(this)"></button></div>
    </div>`;
  }
  h+=`<div class="note">Änderungen werden sofort gespeichert.</div>`;
  openSheet('Benachrichtigungen',h);renderPushRow();}
// Trainings-Erinnerung: Stunde als String, '' = Aus. Aus setzt push_hour über den reset-Weg auf NULL
// (PROFILE_RESETTABLE); das mitgesendete '' greift zusätzlich, falls der Server '' wie bei den Zielfeldern behandelt.
async function pfPushHour(v,btn){v=String(v==null?'':v);const cur=ME.push_hour==null?'':String(ME.push_hour);
  if(v===cur)return;const row=btn.parentElement;const off=v==='';
  row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===btn));
  const ok=await profileSave(off?{push_hour:'',reset:['push_hour']}:{push_hour:parseInt(v,10)},
    {msg:off?'Trainings-Erinnerung aus':'Erinnerung um '+v+' Uhr ✓',hub:false});
  if(!ok)row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.v===cur));}
function pfMindHour(v,btn){btn.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===btn));saveMindsetReminders();}
function toggleEvePush(btn){const on=!btn.classList.contains('on');btn.classList.toggle('on',on);btn.setAttribute('aria-checked',String(on));saveMindsetReminders();}
async function toggleEmailNotif(on,btn){if(btn){btn.classList.toggle('on',!!on);btn.setAttribute('aria-checked',String(!!on));}
  const r=await API.post('/notifications',{email_notifications:!!on});
  if(r.status!==200){if(btn){btn.classList.toggle('on',!on);btn.setAttribute('aria-checked',String(!on));}return toast(r.data?.error||'Fehler');}
  if(ME)ME.email_notifications=on?1:0;
  toast(on?'E-Mail-Benachrichtigungen an ✓':'E-Mail-Benachrichtigungen aus');}
// Mindset-Erinnerungen: Priming-Stunde (Chips) + Abend-Reflexion (Schalter) sofort speichern.
// Teil-Update: nur diese zwei Schlüssel – Priming-Dauer und Grundbedürfnisse bleiben unangetastet.
async function saveMindsetReminders(){
  const sel=document.querySelector('#pf_mindHour .chip.on');const hv=sel?sel.dataset.v:(document.getElementById('p_mindhour')?.value??'');
  const hour=hv===''||hv==null?null:parseInt(hv,10);
  const eveEl=document.getElementById('p_evepush');const eve=eveEl?(eveEl.classList.contains('on')||eveEl.checked===true?1:0):(ME.evening_push?1:0);
  const r=await API.put('/mindset/prefs',{mindset_push_hour:hour,evening_push:eve});
  if(r.status===200){if(ME){ME.mindset_push_hour=hour;ME.evening_push=eve;}
    try{if(typeof MIND_TODAY!=='undefined'&&MIND_TODAY&&MIND_TODAY.prefs)Object.assign(MIND_TODAY.prefs,{mindset_push_hour:hour,evening_push:eve});}catch(e){}
    toast(hour==null&&!eve?'Mindset-Erinnerungen aus':'Mindset-Erinnerungen gespeichert ✓');}
  else toast(r.data?.error||'Fehler');}
// --- Push-Status: Berechtigung + vorhandenes Abo auf DIESEM Gerät ---
function isIOS(){return /iphone|ipod|ipad/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function isStandalone(){try{return window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;}catch(e){return false;}}
async function pushStatus(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return{state:'unsupported',text:'Auf diesem Gerät nicht verfügbar'};
  if(isIOS()&&!isStandalone())return{state:'install',text:'Zuerst zum Home-Bildschirm hinzufügen'};
  if(Notification.permission==='denied')return{state:'blocked',text:isIOS()?'Blockiert – iOS Einstellungen › BE INEVITABLE › Mitteilungen':'Blockiert – in den Browser-Einstellungen erlauben'};
  let sub=null;try{const reg=await navigator.serviceWorker.getRegistration('/sw.js');if(reg)sub=await reg.pushManager.getSubscription();}catch(e){}
  if(sub&&Notification.permission==='granted')return{state:'on',text:'Aktiv auf diesem Gerät',sub};
  return{state:'off',text:'Aus – antippen zum Aktivieren'};}
async function renderPushRow(){const st=await pushStatus();const s=document.getElementById('pf_pushStatus'),t=document.getElementById('pf_pushTgl');if(!s||!t)return;
  s.textContent=st.text;const on=st.state==='on';t.classList.toggle('on',on);t.setAttribute('aria-checked',String(on));
  t.classList.toggle('dis',st.state==='unsupported'||st.state==='blocked');}
async function togglePush(){const st=await pushStatus();
  if(st.state==='on'){try{await API.del('/push/subscribe',{endpoint:st.sub.endpoint});await st.sub.unsubscribe();}catch(e){console.error('[push]',e);}
    toast('Push-Mitteilungen aus');renderPushRow();return;}
  if(st.state==='install')return openInstallSheet();
  if(st.state==='blocked'||st.state==='unsupported')return toast(st.text);
  await enablePush();renderPushRow();}
// --- Unter-Sheet: Daten & Verbindungen ---
function openDataSheet(){const athlete=ME.role==='athlete';
  openSheet(athlete?'Daten & Verbindungen':'Daten',`<div class="rows mt-2">
    ${athlete?pfRow("if(typeof openIntegrations==='function')openIntegrations();else toast('Gesundheitsdaten sind über die Analyse erreichbar')",'apple','Gesundheitsdaten verbinden',ME.last_health_import?'Letzter Import '+relDate(ME.last_health_import):'Apple Health per Kurzbefehl'):''}
    ${pfRow('exportMyData()','download','Meine Daten exportieren','Alle deine Daten als JSON-Datei (DSGVO)')}
    ${pfRow('openInstallSheet()','share','Als App installieren',isStandalone()?'Läuft bereits als App':'Zum Home-Bildschirm hinzufügen')}
  </div>`);}
function openInstallSheet(){let h;
  if(isStandalone())h=`<div class="note ok mb-4">BE INEVITABLE läuft auf diesem Gerät bereits als App.</div>`;
  else if(isIOS())h=`<p class="body mb-3">So landet BE INEVITABLE auf deinem Home-Bildschirm – erst dann funktionieren Push-Mitteilungen:</p>
    <div class="rows mb-4">
      <div class="row"><div class="r-ic num">1</div><div class="rl">In Safari auf <b>Teilen</b> tippen<small>Das Quadrat mit dem Pfeil nach oben, unten in der Leiste</small></div></div>
      <div class="row"><div class="r-ic num">2</div><div class="rl"><b>„Zum Home-Bildschirm"</b> wählen<small>Etwas weiter unten in der Liste</small></div></div>
      <div class="row"><div class="r-ic num">3</div><div class="rl">Oben rechts <b>Hinzufügen</b><small>Danach die App vom Home-Bildschirm starten</small></div></div>
    </div>`;
  else if(/android/i.test(navigator.userAgent))h=`<p class="body mb-3">So landet BE INEVITABLE auf deinem Startbildschirm:</p>
    <div class="rows mb-4">
      <div class="row"><div class="r-ic num">1</div><div class="rl">Browser-Menü öffnen<small>Die drei Punkte oben rechts</small></div></div>
      <div class="row"><div class="r-ic num">2</div><div class="rl"><b>„App installieren"</b> oder <b>„Zum Startbildschirm"</b><small>Danach die App vom Startbildschirm öffnen</small></div></div>
    </div>`;
  else h=`<p class="body mb-3">Auf dem Computer: über das Installieren-Symbol in der Adressleiste oder das Browser-Menü („Installieren"). Auf dem Handy nutzt du Safari (iPhone) oder Chrome (Android) und wählst „Zum Home-Bildschirm".</p>`;
  openSheet('Als App installieren',h+`<button class="btn block sec" onclick="closeModal()">Alles klar</button>`);}
// --- Unter-Sheet: Konto ---
function openAccountSheet(){const u=ME;const verified=!!u.email_verified;
  openSheet('Konto',`<div class="rows mt-2 mb-3">
    <div class="row"><div class="r-ic">${icon('mail',24)}</div><div class="rl">E-Mail<small>${esc2(u.email||'–')}</small></div><div class="rr">${u.email?(verified?'<span class="pill green">Bestätigt</span>':'<span class="pill amber">Unbestätigt</span>'):''}</div></div>
    ${u.email&&!verified?pfRow('resendVerify()','send','E-Mail bestätigen','Bestätigungs-Mail erneut senden'):''}
    ${pfRow('openChangePw()','lock','Passwort ändern','')}
  </div>
  ${u.email&&!verified?`<div class="note warn mb-3">Ohne bestätigte E-Mail funktionieren Passwort-Reset und Mails nicht. Schau auch im Spam-Ordner nach.</div>`:''}
  <div class="rows mb-3">${pfRow('logout()','logOut','<span class="tone-red">Abmelden</span>','')}</div>
  <div class="pf-version">Version ${esc2(APP_VERSION)}</div>`);}
// --- Unter-Sheet: Hilfe ---
function openHelpSheet(){const athlete=ME.role==='athlete';
  openSheet('Hilfe',`<div class="rows mt-2">
    ${pfRow('resetHints()','refresh','Hinweise wieder anzeigen','Alle ausgeblendeten Info-Boxen zurückholen')}
    ${athlete?pfRow('restartTour()','play','Einführung erneut ansehen','Die kurze Tour über die App'):''}
  </div>`);}
// --- Avatar ---
function avatarPick(ev){const file=ev.target.files&&ev.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=async()=>{
    // quadratisch zuschneiden + auf 256px skalieren (klein halten)
    const size=256;const cv=document.createElement('canvas');cv.width=size;cv.height=size;
    const m=Math.min(img.width,img.height);const sx=(img.width-m)/2, sy=(img.height-m)/2;
    cv.getContext('2d').drawImage(img,sx,sy,m,m,0,0,size,size);
    const data=cv.toDataURL('image/jpeg',0.82);
    const r=await API.post('/avatar',{avatar:data});
    if(r.status===200){ME.has_avatar=true;_PF_AVATAR_URL=data;
      const pv=document.getElementById('pf_avatar');if(pv){pv.textContent='';pv.style.backgroundImage=`url(${data})`;}
      document.getElementById('pf_remove')?.classList.remove('hidden');applyAvatar();toast('Profilbild gespeichert ✓');}
    else toast(r.data?.error||'Fehler');
  };img.src=e.target.result;};reader.readAsDataURL(file);}
// Entfernt nur das Bild und zeichnet den Avatar-Block neu – das Sheet bleibt offen
async function removeAvatar(){const r=await API.post('/avatar',{avatar:null});
  if(r.status!==200)return toast('Fehler');
  ME.has_avatar=false;_PF_AVATAR_URL=null;applyAvatar();
  const pv=document.getElementById('pf_avatar');if(pv){pv.style.backgroundImage='';pv.textContent=(ME.name||'?').charAt(0).toUpperCase();}
  document.getElementById('pf_remove')?.classList.add('hidden');toast('Profilbild entfernt');}
// --- Passwort ändern (Formular, Passwort-Manager-freundlich, Inline-Fehler) ---
function openChangePw(){openSheet('Passwort ändern',`<form id="pwForm" onsubmit="saveNewPw();return false" novalidate>
    <div class="field"><label for="pw_cur">Aktuelles Passwort</label><input id="pw_cur" type="password" autocomplete="current-password" placeholder="••••••••" enterkeyhint="next"></div>
    <div class="field"><label for="pw_new">Neues Passwort</label><input id="pw_new" type="password" autocomplete="new-password" placeholder="mind. 6 Zeichen" enterkeyhint="next"></div>
    <div class="field"><label for="pw_new2">Neues Passwort wiederholen</label><input id="pw_new2" type="password" autocomplete="new-password" placeholder="••••••••" enterkeyhint="done"></div>
    <button class="btn block" type="submit">Passwort speichern</button></form>`);
  setTimeout(()=>document.getElementById('pw_cur')?.focus({preventScroll:true}),380);}
async function saveNewPw(){const cur=val('pw_cur'),n1=val('pw_new'),n2=val('pw_new2');
  if(!cur)return showFieldErr('pwForm','Bitte dein aktuelles Passwort eingeben.','pw_cur');
  if(n1.length<6)return showFieldErr('pwForm','Mindestens 6 Zeichen.','pw_new');
  if(n1!==n2)return showFieldErr('pwForm','Die Passwörter stimmen nicht überein.','pw_new2');
  const btn=document.querySelector('#pwForm .btn');if(btn)btn.disabled=true;
  // Bewusst OHNE API.post: der Server meldet ein falsches aktuelles Passwort mit 401, und der globale Handler
  // in core.js deutet jeden 401 als abgelaufene Sitzung und laedt die App neu (Sheet weg, kein Fehler sichtbar).
  // Hier also direkt fetchen und nur eine echte Sitzungs-Meldung wie der globale Handler behandeln.
  let status=0,data=null;
  try{const res=await fetch('/api/password',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({current:cur,next:n1})});
    status=res.status;try{data=await res.json();}catch(e){}}
  catch(err){console.error('[Netzwerkfehler] /password',err);}
  if(status===200){closeModal();toast('Passwort geändert ✓');return;}
  if(btn)btn.disabled=false;
  if(!status)return showFieldErr('pwForm','Keine Verbindung. Ist der Server erreichbar?','pw_cur');
  const msg=String(data?.error||'');
  if(status===401&&!/aktuelles passwort/i.test(msg)){ME=null;location.reload();return;} // Sitzung wirklich abgelaufen
  showFieldErr('pwForm',msg||'Fehler',status===401?'pw_cur':'pw_new');}

// ===== TEILEN PER LINK (WhatsApp & Co.) =====
// Erstellt einen Link und öffnet den nativen Teilen-Dialog (Handy) bzw. kopiert ihn.
async function shareViaLink(kind,id){const r=await API.post('/share',{kind,id});
  if(r.status!==200)return toast(r.data?.error||'Fehler beim Erstellen des Links');
  const url=location.origin+'/?share='+r.data.token;
  const what=kind==='recipe'?'dieses Rezept':'diese Übung';
  if(navigator.share){try{await navigator.share({title:'BE INEVITABLE',text:`Schau dir ${what} an:`,url});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(url);toast('Link kopiert ✓ – einfach per WhatsApp & Co. verschicken');}
  catch(e){openSheet('Link teilen',`<p class="body muted mb-3">Kopiere diesen Link und schicke ihn z.B. per WhatsApp:</p><div class="card sub sh-link">${esc2(url)}</div>`);}}

let _SHARE_ITEM=null; // zuletzt angebotenes geteiltes Element (Name für Hervorhebung nach dem Übernehmen)
// Prüft nach dem Start, ob die App über einen Teilen-Link geöffnet wurde -> Übernehmen-Dialog
async function checkPendingShare(){const tok=localStorage.getItem('be_pending_share');if(!tok||!ME)return;
  if(ME.role!=='athlete'){localStorage.removeItem('be_pending_share');return;}
  const r=await API.get('/share/'+tok);
  if(r.status!==200){localStorage.removeItem('be_pending_share');toast('Geteilter Link ist ungültig');return;}
  const d=r.data,it=d.item||{};_SHARE_ITEM={kind:d.kind,name:it.name||''};
  if(d.kind==='recipe'){
    openSheet('Geteiltes Rezept',`
      <p class="body mb-3"><b>${esc2(d.sharedBy)}</b> hat ein Rezept mit dir geteilt. Möchtest du es übernehmen?</p>
      ${it.photo?`<img id="sh_photo" alt="" class="sh-photo">`:''}
      <div class="card mb-4"><div class="h3">${esc2(it.name||'Rezept')}</div>
        <div class="meta mt-1">${fmtNum(it.kcal)} kcal · ${fmtNum(it.protein)} g P · ${fmtNum(it.carbs)} g C · ${fmtNum(it.fat)} g F</div>
        ${it.ingredients?`<div class="meta mt-2 sh-ingr">${esc2(it.ingredients)}</div>`:''}</div>
      <button class="btn block" onclick="acceptShare('${esc(tok)}')">Zu meinen Rezepten hinzufügen</button>
      <button class="btn block sec mt-2" onclick="declineShare()">Nein danke</button>`);
    if(it.photo&&typeof it.photo==='string'&&/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(it.photo)){const im=document.getElementById('sh_photo');if(im)im.src=it.photo;} // src als Property
  } else if(d.kind==='exercise'){
    if(!PLAN)await loadPlan();
    const days=(PLAN?.days||[]);
    openSheet('Geteilte Übung',`
      <p class="body mb-3"><b>${esc2(d.sharedBy)}</b> hat eine Übung mit dir geteilt.</p>
      <div class="card mb-4"><div class="h3">${esc2(it.name||'Übung')}</div>
        <div class="meta mt-1">${esc2(it.muscle||'')}${it.muscle?' · ':''}${pl(it.target_sets||3,'Satz','Sätze')} · ${esc2(it.target_reps||'8-12')} Wdh.</div></div>
      ${days.length?`<div class="section-label">Zu welchem Trainingstag hinzufügen?</div><div class="rows mb-3">`+
        days.map(dd=>`<div class="row tap" onclick="acceptShare('${esc(tok)}',${+dd.id})"><div class="r-ic">${icon('dumbbell',24)}</div><div class="rl">${esc2(dd.name)}${Array.isArray(dd.exercises)?`<small>${pl(dd.exercises.length,'Übung','Übungen')}</small>`:''}</div></div>`).join('')+`</div>`:
        `<div class="note warn mb-3">Du hast noch keinen Trainingsplan – schließe zuerst das Onboarding ab.</div>`}
      <button class="btn block sec" onclick="declineShare()">Nein danke</button>`);
  } else {localStorage.removeItem('be_pending_share');}}
async function acceptShare(tok,dayId){const r=await API.post('/share/'+tok+'/accept',dayId?{day_id:dayId}:{});
  localStorage.removeItem('be_pending_share');closeAllSheets();
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  const name=_SHARE_ITEM?.name||'';_SHARE_ITEM=null;
  try{if(typeof invalidateView==='function')invalidateView();}catch(e){}
  if(r.data.kind==='recipe'){toast('Rezept übernommen ✓');
    try{if(typeof RECIPE_FILTER!=='undefined'){if(!RECIPE_FILTER&&typeof defaultRecipeFilter==='function')RECIPE_FILTER=defaultRecipeFilter();
      if(RECIPE_FILTER){RECIPE_FILTER.goal='all';RECIPE_FILTER.meal='all';RECIPE_FILTER.simKcal=null;}}}catch(e){}
    if(typeof renderDiet==='function')renderDiet.tab='recipes';go('diet');flashNew('#dietBody .row',name);}
  else{toast('Übung übernommen ✓');PLAN=null;go('workout');_shareShowDay(dayId,name);}}
// renderWorkout setzt CUR_DAY beim Neuaufbau selbst auf den empfohlenen Tag – ein vorher gesetztes CUR_DAY
// wird dabei überschrieben. Den Zieltag deshalb ERST nach dem Rendern wählen (selDay zeichnet die Liste neu),
// damit die übernommene Übung wirklich sichtbar wird und aufblitzt.
function _shareShowDay(dayId,name,tries){tries=tries==null?24:tries;
  if(!document.getElementById('exlist')){if(tries>0)setTimeout(()=>_shareShowDay(dayId,name,tries-1),150);return;}
  if(dayId&&typeof CUR_DAY!=='undefined'&&CUR_DAY!==dayId&&typeof selDay==='function'){
    Promise.resolve(selDay(dayId)).then(()=>flashNew('#exlist .ex',name,{fallbackLast:true})).catch(()=>flashNew('#exlist .ex',name,{fallbackLast:true}));return;}
  flashNew('#exlist .ex',name,{fallbackLast:true});}
function declineShare(){localStorage.removeItem('be_pending_share');closeAllSheets();_SHARE_ITEM=null;toast('Okay, nicht übernommen');}
// Neues Element nach dem Rendern ansteuern und kurz rot aufblitzen lassen (wartet, bis die Liste da ist).
// o.fallbackLast: das Element wurde unten angehaengt -> bei gleichnamigen Treffern das LETZTE nehmen
// (sonst blitzt bei einer uebernommenen Uebung die gleichnamige alte Zeile oben auf).
function flashNew(sel,name,o,tries){o=o||{};tries=tries==null?14:tries;
  const els=[...document.querySelectorAll(sel)];let el=null;
  if(name){const n=name.trim().toLowerCase();const hit=els.filter(e=>(e.textContent||'').toLowerCase().includes(n));
    el=o.fallbackLast?hit[hit.length-1]:hit[0];}
  if(!el&&tries<=0&&o.fallbackLast&&els.length)el=els[els.length-1];
  if(!el){if(tries>0)setTimeout(()=>flashNew(sel,name,o,tries-1),250);return;}
  el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),3400);}

// „Mahlzeit tauschen": wechselt zum Rezepte-Tab und zeigt Rezepte mit ähnlichen Kalorien
// (±20%) für dieselbe Mahlzeit – so kann man eine Mahlzeit gegen eine gleichwertige ersetzen.
function findSimilarRecipes(kcal,mealType){
  closeAllSheets();
  if(!RECIPE_FILTER)RECIPE_FILTER=defaultRecipeFilter();
  RECIPE_FILTER.meal=mealType||'all';
  RECIPE_FILTER.simKcal=kcal||null; // weicher Kalorien-Anker für die Sortierung
  renderDiet.tab='recipes';
  go('diet');
  setTimeout(()=>{if(kcal)toast('Ähnliche '+(mealType||'Mahlzeiten')+' nach Kalorien sortiert');},500);
}

// ===== APPLE HEALTH ÜBER KURZBEFEHL (überschreibt analysis.js: openAppleHealth/importShortcutText/showImportPreview) =====
// Eingabe zuerst, die einmalige Einrichtung eingeklappt; Status als .note.status (nie ausblendbar); Plural über pl().
function openAppleHealth(){openSheet('Apple Health',`
  <div class="field mt-2"><label for="sc_text">Werte aus dem Kurzbefehl einfügen</label><textarea id="sc_text" rows="4" placeholder='{"days":{"2026-06-01":{"weight":75.5,"steps":8200,"sleep":7.5}}}'></textarea></div>
  <button class="btn block" onclick="importShortcutText()">Übernehmen</button>
  <div class="caption center mt-3 mb-3">oder</div>
  <input type="file" id="health_file" accept=".json,.txt,.xml,application/json,text/plain,text/xml" class="hidden" onchange="handleHealthFile(event)">
  <button class="btn block sec" onclick="document.getElementById('health_file').click()">${icon('upload',18)} Datei hochladen (JSON oder Export.xml)</button>
  <div id="health_status" class="mt-3"></div>
  <details class="pf-details mt-4"><summary>Kurzbefehl einrichten (einmalig)</summary>
    <div class="card sub body pf-steps">
      <div class="h3 mb-2">Einmalig</div>
      1. Öffne die <b>Kurzbefehle</b>-App (auf jedem iPhone vorinstalliert).<br>
      2. Tippe auf <b>+</b> (neuer Kurzbefehl).<br>
      3. Aktion hinzufügen: <b>„Gesundheitsdaten suchen"</b> (engl. „Find Health Samples") – je einmal für <b>Gewicht</b>, <b>Schritte</b> und <b>Schlaf</b>, Zeitraum z.B. „<b>letzte 7 Tage</b>".<br>
      4. Aktion <b>„Text"</b> hinzufügen und die Werte als JSON zusammensetzen (Format siehe unten).<br>
      5. Aktion <b>„In die Zwischenablage kopieren"</b> ans Ende.<br>
      6. Kurzbefehl benennen (z.B. „BE INEVITABLE Export") und sichern.
      <div class="h3 mt-3 mb-2">Wöchentlich</div>
      1. Kurzbefehl starten – er kopiert deine Werte.<br>
      2. Oben ins Feld einfügen und auf „Übernehmen" tippen. Fertig.
    </div></details>
  <details class="pf-details mt-2"><summary>Welches Format muss der Kurzbefehl erzeugen?</summary>
    <div class="card sub body pf-steps">Eine kleine Textdatei oder Zwischenablage im Format:<br><code class="sh-code">{"days":{"2026-06-01":{"weight":75.5,"steps":8200,"sleep":7.5}}}</code><br><br>Datum als JJJJ-MM-TT, Gewicht in kg, Schritte als Zahl, Schlaf in Stunden. Felder, die du nicht hast, kannst du weglassen.</div></details>`);}
// Text aus dem Kurzbefehl (oder per Hand) einlesen – tolerant gegenüber kleinen Formatfehlern (Parser: analysis.js)
function importShortcutText(){const raw=val('sc_text');const st=document.getElementById('health_status');
  if(!raw)return showFieldErr(null,'Bitte zuerst die Werte einfügen.','sc_text');
  clearFieldErr('sc_text'); // alte Inline-Meldung entfernen, sobald wieder Text da ist
  const days=typeof parseShortcutData==='function'?parseShortcutData(raw):null;
  if(!days){if(st)st.innerHTML='<div class="note err">Die eingefügten Daten konnte ich nicht lesen. Sie sollten im JSON-Format sein (siehe „Welches Format…" unten).</div>';return;}
  const n=Object.keys(days).length;
  if(!n){if(st)st.innerHTML='<div class="note status">Keine Tage gefunden. Prüfe das Format.</div>';return;}
  showImportPreview(days,st);}
// Vorschau + Bestätigen (gemeinsam für Text- und Datei-Weg)
function showImportPreview(days,st){if(!st)return;
  const dc=Object.keys(days).length;
  const w=Object.values(days).filter(d=>d.weight!=null).length;
  const s=Object.values(days).filter(d=>d.steps!=null).length;
  const sl=Object.values(days).filter(d=>d.sleep!=null).length;
  st.innerHTML=`<div class="note status mb-3">Gefunden: <b>${pl(w,'Tag','Tage')}</b> Gewicht · <b>${pl(s,'Tag','Tage')}</b> Schritte · <b>${pl(sl,'Tag','Tage')}</b> Schlaf (${pl(dc,'Tag','Tage')} gesamt).</div>
    <button class="btn block" onclick='doHealthImport(${JSON.stringify(days).replace(/'/g,"&#39;")})'>${pl(dc,'Tag','Tage')} importieren</button>`;}

// ===== TOUR-SYSTEM (mehrseitig: eigene kurze Einführung je Tab) =====
const TOUR_DEFS={
  home:[
    {sel:'.today',title:'Dein Tag',body:'Hier siehst du sofort, ob heute Training oder Ruhetag ist – und startest mit einem Tipp.',pos:'below'},
    {sel:'#homeCheckin',title:'Schnell eintragen',body:'Gewicht, Schlaf, Schritte, Wasser – trag ein was du hast, der Rest bleibt leer. Dauert 10 Sekunden.',pos:'below'},
    {sel:'#navBar',title:'Alles per Tab',body:'Training, Ernährung, Mindset und Analyse erreichst du jederzeit hier unten. Tippe dich ruhig durch.',pos:'above'},
    {sel:'#avatar',title:'Dein Profil',body:'Profil, Einstellungen, Push-Mitteilungen und Abmelden findest du hier oben.',pos:'below'}
  ],
  workout:[
    {sel:'#daysel',title:'Deine Trainingstage',body:'Wechsle hier zwischen deinen Trainingstagen. Der hervorgehobene ist für heute vorgeschlagen.',pos:'below'},
    {sel:'#workoutTools',title:'Pause & Hantelrechner',body:'Pausen-Timer und der Rechner für die Hantelscheiben sind immer griffbereit.',pos:'below'},
    {sel:'#exlist',title:'Übungen loggen',body:'Tippe eine Übung an, trag Gewicht und Wiederholungen ein und bestätige den Satz mit dem Haken. Der farbige Hinweis sagt dir, ob du steigern solltest.',pos:'above'}
  ],
  diet:[
    {sel:'#dietDayBadge',title:'Trainings- oder Ruhetag',body:'Oben siehst du, für welchen Tag die Werte gelten – an Trainingstagen brauchst du mehr Energie.',pos:'below'},
    {sel:'#dietSeg',title:'Heute · Plan · Rezepte',body:'„Heute" zeigt was du gegessen hast, „Plan" deinen Ernährungsplan zum Anpassen, „Rezepte" die Datenbank.',pos:'below'},
    {sel:'#dietBody',title:'Essen eintragen',body:'Trag Lebensmittel manuell ein, scanne einen Barcode oder übernimm Mahlzeiten aus deinem Plan.',pos:'above'}
  ],
  // Analyse: Segment oben, Schlaf-Diagramm unten (die alte Seitenüberschrift #trackerHead gibt es nicht mehr –
  // den Titel trägt der Header). analysis.js muss diese Selektoren dadurch nicht mehr zur Laufzeit korrigieren.
  tracker:[
    {sel:'#anaSeg',title:'Deine Entwicklung',body:'Hier werden alle deine Daten zu Diagrammen – Gewicht, Schlaf, Schritte, Wasser, Kraftwerte.',pos:'below'},
    {sel:'#chart-sleep',title:'Ziel-Linien',body:'Die grün gestrichelte Linie ist dein Zielwert. Liegt deine Kurve darüber, bist du im grünen Bereich.',pos:'above'}
  ]
};
let TOUR_STEP=0,TOUR_STEPS=[],TOUR_NAME='',TOUR_LAST=0;
const _tabTourCalls={};
// iOS-Installhinweis: Safari zeigt keinen automatischen „Installieren"-Prompt. Einmaliger, schließbarer Hinweis als
// schmale Zeile unter dem Header (nicht mehr als Balken über den Ringen). Nur auf iOS, nur außerhalb der PWA.
function maybeShowInstallHint(){
  try{
    if(isStandalone())return;                             // läuft schon als installierte App
    if(!isIOS())return;                                   // Hinweis nur auf iOS nötig
    if(localStorage.getItem('be_ios_install_dismissed'))return;
    if(document.getElementById('iosInstallHint'))return;
    if(document.body.classList.contains('tour-active'))return; // nicht während der Einführungs-Tour
    const bar=document.createElement('div');bar.id='iosInstallHint';bar.className='note install-hint';
    bar.innerHTML=`<div class="fill">Als App nutzen: in Safari auf <b>Teilen</b> tippen, dann <b>„Zum Home-Bildschirm"</b>. <a onclick="openInstallSheet()">Anleitung</a></div>
      <button class="btn icon sm ghost" aria-label="Hinweis schließen" onclick="dismissInstallHint()">${icon('x',18)}</button>`;
    const views=document.getElementById('views');
    if(views&&views.parentNode)views.parentNode.insertBefore(bar,views);else document.body.appendChild(bar);
  }catch(e){}
}
function dismissInstallHint(){try{localStorage.setItem('be_ios_install_dismissed','1');}catch(e){}const b=document.getElementById('iosInstallHint');if(b)b.remove();}

// Home-Tour beim allerersten App-Start: erst wenn Home fertig gezeichnet ist UND ein Plan existiert
// (ohne Plan zeigt Home nur den Einrichten-Banner). Wird von startApp() früh gerufen -> wartet auf das Rendering.
let _tourWait=0;
function _homeTourReady(){return !!(PLAN&&PLAN.days&&PLAN.days.length&&document.querySelector('.navbtn.on')?.dataset.p==='home'&&document.querySelector('#views .today,#views #homeCheckin'));}
function maybeStartTour(){
  if(!ME||ME.role!=='athlete')return; // Touren nur für Athleten
  if(ME.tour_done)return;            // bereits einmal pro Konto gesehen (geräteübergreifend)
  if(localStorage.getItem('be_tour_home'))return;
  if(typeof COACH_CONTEXT!=='undefined'&&COACH_CONTEXT)return;
  if(_tourBlocked())return;
  if(_homeTourReady()){if(Date.now()-TOUR_LAST<60000)return;
    setTimeout(()=>{if(!_tourBlocked()&&!localStorage.getItem('be_tour_home')&&_homeTourReady())runTour('home');},400);return;}
  if(_tourWait>0)return; // wartet bereits auf das Home-Rendering
  _tourWait=25;const t=setInterval(()=>{if(_homeTourReady()){clearInterval(t);_tourWait=0;maybeStartTour();}
    else if(--_tourWait<=0){clearInterval(t);_tourWait=0;}},300);
}
// Tab-Touren: erst beim ZWEITEN Besuch des Tabs (nie direkt nach der Home-Tour), nie innerhalb von 60 s nach einer Tour.
// opts.deferred:true – so rufen die Tab-Renderer (training.js/diet.js/analysis.js): der Tab lädt seine Inhalte noch
// asynchron nach, deshalb die gewohnte Wartezeit von 700 ms und danach notfalls ein paar Versuche, bis ein Ziel da ist.
function maybeStartTabTour(tab,opts){
  opts=opts||{};
  if(!ME||ME.role!=='athlete')return;
  if(!TOUR_DEFS[tab]||tab==='home')return;
  if(typeof COACH_CONTEXT!=='undefined'&&COACH_CONTEXT)return;
  if(localStorage.getItem('be_tour_'+tab))return;
  const now=Date.now();if(now-(_tabTourCalls[tab]||0)<2000)return;_tabTourCalls[tab]=now; // doppelte Aufrufe je Besuch (Router + Renderer) ignorieren
  let n=0;try{n=(+localStorage.getItem('be_visits_'+tab)||0)+1;localStorage.setItem('be_visits_'+tab,String(n));}catch(e){}
  if(n<2)return;
  if(now-TOUR_LAST<60000)return;
  if(_tourBlocked())return; // keine zwei Touren gleichzeitig, keine über einem Sheet
  const deferred=opts.deferred!==false; // Standard bleibt das bisherige Verhalten (700 ms nach dem Rendern)
  const startTab=left=>{
    if(_tourBlocked()||document.querySelector('.navbtn.on')?.dataset.p!==tab)return;
    // Ziel-Elemente noch nicht gezeichnet (Daten unterwegs) -> kurz nachfassen statt die Tour zu verschenken
    if(!(TOUR_DEFS[tab]||[]).some(s=>document.querySelector(s.sel))){if(left>0)setTimeout(startTab,250,left-1);return;}
    runTour(tab);};
  setTimeout(startTab,deferred?700:120,deferred?6:0);
}
// Keine Tour, solange ein Sheet offen ist (sie würde hinter dem Modal laufen)
function _tourBlocked(){if(document.getElementById('tourOv'))return true;
  if(typeof sheetOpen==='function'&&sheetOpen())return true;                 // nie hinter einem Sheet
  try{if(localStorage.getItem('be_pending_share'))return true;}catch(e){}   // Teilen-Dialog geht vor
  return false;}
function runTour(name){
  if(_tourBlocked())return;
  TOUR_NAME=name;TOUR_STEPS=TOUR_DEFS[name]||[];TOUR_STEP=0;
  if(!TOUR_STEPS.length)return;
  if(!TOUR_STEPS.some(s=>document.querySelector(s.sel)))return; // nichts zu zeigen
  TOUR_LAST=Date.now();
  lockTourScroll(); // Hintergrund-Scrollen/Tippen blockieren, damit der Spotlight-Rahmen nie verrutscht
  const ov=document.createElement('div');ov.className='tour-ov';ov.id='tourOv';
  ov.innerHTML=`<div class="tour-hole" id="tourHole"></div>
    <div class="tour-card hid" id="tourCard">
      <div class="tt" id="tourTitle"></div><div class="td" id="tourBody"></div>
      <div class="tb">
        <div class="tdots" id="tourDots"></div>
        <div class="tbtns">
          <button class="tour-skip" onclick="endTour()">Überspringen</button>
          <button class="btn inline" id="tourNext" onclick="tourNext()">Weiter</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  // requestAnimationFrame wird in gedrosselten/Hintergrund-Tabs (PWA aus dem Hintergrund, Energiesparmodus)
  // nicht ausgefuehrt. Ohne Fallback bliebe das Overlay ohne .on stehen: unsichtbar, aber ueber der ganzen App
  // und mit gesperrtem Scroll -> die App nimmt keinen Tap mehr an. Deshalb rAF UND Timeout, idempotent.
  const startTour=()=>{const o=document.getElementById('tourOv');
    if(!o||o.classList.contains('on'))return;
    o.classList.add('on');drawTourStep();};
  requestAnimationFrame(startTour);
  setTimeout(startTour,150);
  window.addEventListener('resize',drawTourStep);
}
function drawTourStep(){
  const hole=document.getElementById('tourHole'),card=document.getElementById('tourCard');
  if(!hole||!card)return;
  // Schritte ohne Ziel-Element überspringen (z.B. Check-in-Karte fehlt, Tools umgebaut)
  while(TOUR_STEP<TOUR_STEPS.length&&!document.querySelector(TOUR_STEPS[TOUR_STEP].sel))TOUR_STEP++;
  if(TOUR_STEP>=TOUR_STEPS.length){endTour();return;}
  const step=TOUR_STEPS[TOUR_STEP];const el=document.querySelector(step.sel);
  document.getElementById('tourTitle').textContent=step.title;
  document.getElementById('tourBody').textContent=step.body;
  document.getElementById('tourDots').innerHTML=TOUR_STEPS.map((_,i)=>`<span class="${i===TOUR_STEP?'on':''}"></span>`).join('');
  const isLast=!TOUR_STEPS.slice(TOUR_STEP+1).some(s=>document.querySelector(s.sel));
  document.getElementById('tourNext').textContent=isLast?'Los geht’s':'Weiter';
  card.classList.add('hid');
  // Feste/klebende Ziele (Nav, Header/Avatar) nicht anscrollen – sie sind immer sichtbar
  let fixedLike=false;try{const ps=getComputedStyle(el).position;fixedLike=ps==='fixed'||ps==='sticky'||!!el.closest('.hdr,.nav');}catch(e){}
  if(!fixedLike)el.scrollIntoView({block:'center',behavior:'auto'});
  // Position erst nach dem Scrollen setzen. requestAnimationFrame wird in Hintergrund-Tabs
  // gedrosselt -> zusaetzlich ein Timeout, damit die Karte nie unsichtbar haengen bleibt.
  const place=()=>_tourPlace(step,el);
  requestAnimationFrame(()=>requestAnimationFrame(place));
  setTimeout(place,140);
}
// Spotlight-Loch ueber das Zielelement legen und die Karte darunter/darueber einpassen (nie unter den Header)
function _tourPlace(step,el){
  const hole=document.getElementById('tourHole'),card=document.getElementById('tourCard');
  if(!hole||!card||!el||!el.isConnected)return;
  const r=el.getBoundingClientRect();const pad=8;
  hole.style.left=(r.left-pad)+'px';hole.style.top=(r.top-pad)+'px';
  hole.style.width=(r.width+pad*2)+'px';hole.style.height=(r.height+pad*2)+'px';
  const hdr=document.querySelector('.hdr');const minTop=(hdr?hdr.getBoundingClientRect().bottom:0)+8;
  const ch=card.offsetHeight||200;const below=step.pos!=='above';
  let top=below?r.bottom+16:r.top-ch-16;
  top=Math.max(minTop,Math.min(top,window.innerHeight-ch-16));
  card.style.top=top+'px';card.classList.remove('hid');
}
function tourNext(){if(TOUR_STEP<TOUR_STEPS.length-1){TOUR_STEP++;drawTourStep();}else endTour();}
function endTour(){if(TOUR_NAME)localStorage.setItem('be_tour_'+TOUR_NAME,'1');
  // Home-Tour beendet/übersprungen -> serverseitig als gesehen merken (einmalig pro Konto)
  if(TOUR_NAME==='home'&&ME&&!ME.tour_done){ME.tour_done=1;API.post('/tour-done',{}).catch(()=>{});}
  TOUR_LAST=Date.now();
  unlockTourScroll();
  const ov=document.getElementById('tourOv');if(ov){ov.classList.remove('on');setTimeout(()=>ov.remove(),250);}
  window.removeEventListener('resize',drawTourStep);}
// Scroll-Sperre: fängt Wheel/Touch-Move ab (Koordinaten der Elemente bleiben dadurch stabil,
// anders als bei position:fixed, das die Seite verschieben würde).
let _tourScrollBlocker=null;
function lockTourScroll(){
  document.body.classList.add('tour-active');
  _tourScrollBlocker=e=>{
    // Scrollen INNERHALB der Tour-Karte (falls Text lang) erlauben, sonst alles blocken
    const card=document.getElementById('tourCard');
    if(card&&card.contains(e.target))return;
    e.preventDefault();e.stopPropagation();
  };
  window.addEventListener('wheel',_tourScrollBlocker,{passive:false,capture:true});
  window.addEventListener('touchmove',_tourScrollBlocker,{passive:false,capture:true});
}
function unlockTourScroll(){
  document.body.classList.remove('tour-active');
  if(_tourScrollBlocker){
    window.removeEventListener('wheel',_tourScrollBlocker,{capture:true});
    window.removeEventListener('touchmove',_tourScrollBlocker,{capture:true});
    _tourScrollBlocker=null;
  }
}
// Alle Touren zurücksetzen und mit der Home-Tour neu beginnen (nur Athleten – Coach/Admin haben keine Athleten-Home)
function restartTour(){if(!ME||ME.role!=='athlete')return toast('Die Einführung gibt es nur für Athleten');
  ['home','workout','diet','tracker'].forEach(t=>localStorage.removeItem('be_tour_'+t));
  ME.tour_done=0;TOUR_LAST=0; // für die Wiederholung diese Sitzung erlauben (wird am Ende wieder gesetzt)
  closeAllSheets();go('home');setTimeout(()=>{if(_homeTourReady())runTour('home');else maybeStartTour();},600);}

// ===== PUSH-MITTEILUNGEN =====
function urlB64ToUint8(s){const pad='='.repeat((4-s.length%4)%4);const b=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...b].map(c=>c.charCodeAt(0)));}
// Aktiviert Push auf diesem Gerät; schließt KEIN Sheet (der Schalter im Profil zeichnet seinen Status selbst neu)
async function enablePush(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)){toast('Push wird von diesem Browser nicht unterstützt');return false;}
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){toast('Mitteilungen wurden nicht erlaubt');return false;}
    const reg=await navigator.serviceWorker.register('/sw.js');
    const kr=await API.get('/push/pubkey');
    if(kr.status!==200){toast(kr.data?.error||'Push auf dem Server nicht eingerichtet');return false;}
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64ToUint8(kr.data.key)});
    const r=await API.post('/push/subscribe',{subscription:sub.toJSON()});
    if(r.status===200){toast('Push-Mitteilungen aktiviert ✓');return true;}
    toast('Fehler beim Aktivieren');return false;
  }catch(e){console.error('[push]',e);toast('Push konnte nicht aktiviert werden');return false;}}
function exportMyData(){window.open('/api/export/'+ME.id,'_blank');toast('Export wird heruntergeladen…');}
