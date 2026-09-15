// BE INEVITABLE – Frontend, Teil «account.js». Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js.
// Inhalt (WP6 «Konto & Einstieg»): Login-Ansicht (Markup wird beim Laden in #loginView injiziert, index.html bleibt
// eingefroren) · Passwort vergessen/zurücksetzen · Nachrichten · Profil-Hub mit Unter-Sheets und Auto-Save ·
// Push-Status · Teilen-Links · Apple-Health-Import (Sheet) · Tour/Install-Hinweis.
// 2.7.0 (A-III.3, Kaltstart): Es gibt hier KEINE Doppelnamen mehr – kein Name dieser Datei steht ein
// zweites Mal auf oberster Ebene in einer anderen (geprüft mit dup_check.py und einem eigenen Vergleich
// über alle zehn Dateien: 0 Treffer). Der alte Hinweis auf «überschreibt … weil account.js später lädt»
// ist damit gegenstandslos – und wäre inzwischen auch falsch herum: analysis.js, mindset.js, coach.js
// und search.js werden seit dem Bündel-Umbau NACHGELADEN, laufen also NACH dieser Datei. Genau deshalb
// gilt in beide Richtungen: jeder Aufruf einer Funktion aus diesen vier Dateien braucht einen
// typeof-Riegel und, wo es um eine Handlung des Nutzers geht, window.bootCall/window.bootLoad zum Nachholen.

// ===== LOGIN-ANSICHT =====
// Ersetzt das eingefrorene Markup in #loginView durch das neue Layout (Wortmarke ≤220 px, Segment Anmelden|Registrieren,
// gleiche Element-IDs, damit core.js (toggleAuth/doAuth/showErr) und shell.js (#loginVersion) unverändert funktionieren).
// 2.7.0 (A-III.3, Kaltstart): Dieses Markup steht seit dem Buendel-Umbau STATISCH in index.html – Wort
// fuer Wort dasselbe. Die Anmeldekarte ist damit beim ERSTEN Bild fertig, statt erst nach dem achten von
// neun Skripten. Steht sie schon da (Erkennungsmerkmal #authTabLogin), wird hier nichts mehr gebaut:
// ein zweiter innerHTML-Lauf wuerde die Karte neu montieren, eine laufende Eingabe wegwerfen und – beim
// angemeldeten Nutzer, dessen #loginView nur ausgeblendet ist – das Anmelde-Logo zusaetzlich laden
// (gemessen 2.6.0: logo.jpg UND logo-wide.jpg, 26 KB, bei jedem Kaltstart).
// Der Block darunter bleibt als Notnagel stehen: fehlt das Markup (aeltere index.html, Testaufbau),
// entsteht es wie bisher hier. Wer hier etwas aendert, aendert index.html mit.
function renderLoginView(){const v=document.getElementById('loginView');if(!v)return;
  if(document.getElementById('authTabLogin')){syncAuthSeg();bootRelogin();return;}
  v.innerHTML=`<div class="login-brand">
    <img id="loginLogo" src="/logo-wide.jpg?v=${esc2(APP_VERSION)}" alt="BE INEVITABLE" class="login-logo">
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
    ${pwField({id:'i_pw',name:'password',label:'Passwort',autocomplete:'current-password',enterkeyhint:'go',hint:true,hintOff:true})}
    <div id="regCode" class="field hidden"><label for="i_code">Einladungscode</label><input id="i_code" name="code" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Code vom Betreiber" maxlength="80" enterkeyhint="go"></div>
    <button class="btn block" id="authBtn" type="submit">Anmelden</button>
    <div class="switch hidden" id="switchLink" aria-hidden="true">Noch kein Konto? <a onclick="toggleAuth()">Registrieren</a></div>
    <div class="switch login-forgot" id="forgotLink"><a onclick="openForgot()">Passwort vergessen?</a></div>
    <div id="loginVersion" class="login-version"></div>
  </form>
  ${lgLegalLinksHTML()}`;
  syncAuthSeg();bootRelogin();}
// Nach einem widerrufenen/abgelaufenen Token (sessionLost in core.js) oder einer Kontolöschung steht hier
// der Grund – einmalig, danach ist der Merker weg. Eigene Funktion, weil beide Wege oben sie brauchen.
function bootRelogin(){
  try{const m=sessionStorage.getItem('be_relogin');if(m){sessionStorage.removeItem('be_relogin');showErr(m);}}catch(e){}}

// ===== PASSWORTFELDER: Auge + Stärke-Hilfe =====
// Ein Passwortfeld mit „anzeigen"-Auge (44×44 px Trefferfläche) und – bei neuen Passwörtern – einer Hilfe,
// die WÄHREND des Tippens sagt, was noch fehlt. Sie ist bewusst kein Fehler: keine rote Box, kein Riegel,
// nur ein Hinweis, damit das Passwort beim Abschicken nicht am Server abprallt (dort gilt: mind. 8 Zeichen,
// kein häufiges Passwort). Alle autocomplete-Attribute bleiben, damit Passwort-Manager weiter funktionieren.
// o: {id,label,autocomplete,placeholder,enterkeyhint,name,hint:true (Stärke-Hilfe), hintOff:true (Hilfe erst
// per pwHintMode einschalten – Login-Feld, das im Registrier-Modus zum neuen Passwort wird)}
function pwField(o){o=o||{};const id=o.id;
  const ac=o.autocomplete||'current-password';
  const hint=o.hint?`<div class="pw-hint${o.hintOff?' hidden':''}" id="${id}_hint" aria-live="polite"><span class="pw-meter" aria-hidden="true"><i></i></span><span class="pw-hint-t">Mindestens 8 Zeichen, kein häufiges Passwort.</span></div>`:'';
  return `<div class="field"><label for="${id}">${esc2(o.label||'Passwort')}</label><div class="pw-wrap"><input id="${id}"${o.name?` name="${esc2(o.name)}"`:''} type="password" autocomplete="${ac}" placeholder="${esc2(o.placeholder||'••••••••')}" enterkeyhint="${o.enterkeyhint||'next'}"${o.hint?` oninput="pwHint(this)"`:''} maxlength="200"><button type="button" class="pw-eye" aria-label="Passwort anzeigen" aria-pressed="false" onclick="pwToggle(this)">${icon('eye',22)}</button></div>${hint}</div>`;}
function pwToggle(btn){const inp=btn.parentElement&&btn.parentElement.querySelector('input');if(!inp)return;
  const show=inp.type==='password';inp.type=show?'text':'password';
  btn.innerHTML=icon(show?'eyeOff':'eye',22);btn.setAttribute('aria-pressed',String(show));btn.setAttribute('aria-label',show?'Passwort verbergen':'Passwort anzeigen');
  // Fokus bleibt im Feld, Cursor ans Ende – sonst tippt man nach dem Tipp aufs Auge ins Leere
  try{inp.focus({preventScroll:true});const n=inp.value.length;inp.setSelectionRange(n,n);}catch(e){}}
// Die ~60 häufigsten Passwörter (deutsch + international). Der Server prüft gegen eine längere Liste; hier
// reicht die Spitze, damit die Hilfe die typischen Fälle schon beim Tippen abfängt.
const COMMON_PW=new Set(('123456,12345678,123456789,1234567890,password,passwort,qwertz,qwerty,qwertz123,qwerty123,abc123,111111,000000,123123,1234567,'
 +'iloveyou,admin,admin123,letmein,welcome,monkey,dragon,football,baseball,master,hallo,hallo123,schatz,sommer,winter,fussball,'
 +'passwort1,passwort123,password1,password123,12345678910,987654321,654321,666666,121212,112233,asdfgh,asdfghjkl,'
 +'sunshine,princess,superman,batman,starwars,pokemon,michael,daniel,thomas,andreas,berlin,hamburg,muenchen,'
 +'ficken,arschloch,geheim,geheim123,training,fitness,kraft,inevitable,beinevitable,be-inevitable').split(','));
function pwStrength(pw){pw=String(pw||'');const len=pw.length;
  if(!len)return {level:0,text:'Mindestens 8 Zeichen, kein häufiges Passwort.'};
  if(COMMON_PW.has(pw.toLowerCase()))return {level:1,text:'Zu häufig – das raten Angreifer als Erstes.'};
  if(len<8)return {level:1,text:`Noch ${pl(8-len,'Zeichen','Zeichen')} bis zur Mindestlänge.`};
  // Länge zählt mehr als Zeichenklassen: 12+ Zeichen oder ein Mix aus Wörtern/Zahlen ist stark genug
  const classes=[/[a-zäöü]/,/[A-ZÄÖÜ]/,/\d/,/[^\w\säöüÄÖÜß]/].filter(r=>r.test(pw)).length;
  if(len>=12||(len>=10&&classes>=3))return {level:3,text:'Stark ✓'};
  return {level:2,text:'Okay ✓ – länger ist stärker.'};}
function pwHint(inp){const h=document.getElementById(inp.id+'_hint');if(!h||h.classList.contains('hidden'))return;
  const s=pwStrength(inp.value);const m=h.querySelector('.pw-meter'),t=h.querySelector('.pw-hint-t');
  if(m){m.className='pw-meter'+(s.level===1?' bad':s.level===2?' ok':s.level===3?' strong':'');const i=m.querySelector('i');if(i)i.style.width=(s.level*33.4)+'%';}
  if(t)t.textContent=s.text;
  clearFieldErr(inp.id);}
// Hilfe an einem Feld ein-/ausschalten (Login-Feld: nur im Registrier-Modus)
function pwHintMode(id,on){const h=document.getElementById(id+'_hint');if(!h)return;h.classList.toggle('hidden',!on);
  const inp=document.getElementById(id);if(on&&inp)pwHint(inp);}
// 401 auf einem raw-Aufruf: entweder „Passwort falsch" (bleibt im Sheet) oder wirklich Sitzung weg.
// Rückgabe true, wenn die Sitzung verloren ist (dann läuft sessionLost, der Aufrufer hört auf).
function raw401(r){if(!r||r.status!==401)return false;
  if(/passwort/i.test(String(r.data?.error||'')))return false;
  if(typeof sessionLost==='function')sessionLost(r.data?.error);return true;}
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
// „E-Mail unterwegs" ist eine Behauptung über den Server (P9/BEHAUPTUNGEN.md). Ohne eingerichteten
// Mailversand geht nichts raus und der Nutzer wartet auf eine Mail, die nie kommt. GET /api/register-info
// meldet seit 2.5.0 `mailConfigured`; ältere Stände kennen das Feld nicht – dann bleibt es beim alten Satz.
// Einmal geholt und gemerkt (öffentlicher Endpunkt, ändert sich nur mit der Serverkonfiguration).
let acMailCfg;
async function acMailConfigured(){if(acMailCfg!==undefined)return acMailCfg;
  const r=await API.get('/register-info');
  acMailCfg=(r.status===200&&r.data&&typeof r.data.mailConfigured==='boolean')?r.data.mailConfigured:null;
  return acMailCfg;}
async function submitForgot(){const email=val('fp_email');
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return showFieldErr('fpForm','Bitte eine gültige E-Mail eingeben.','fp_email');
  const btn=document.querySelector('#fpForm .btn');if(btn)btn.disabled=true;
  await API.post('/forgot-password',{email});
  if(await acMailConfigured()===false)
    return openSheet('Kein Mailversand',`<p class="body mb-4">Der Mailversand ist gerade nicht eingerichtet – es kommt keine E-Mail an. Melde dich bei deinem Coach, er kann dir ein neues Passwort vergeben.</p>
      <button class="btn block" onclick="closeAllSheets()">Alles klar</button>`);
  openSheet('E-Mail unterwegs',`<p class="body mb-4">Wenn ein Konto zu <b>${esc2(email)}</b> existiert, ist eine E-Mail mit einem Link zum Zurücksetzen unterwegs. Schau auch im Spam-Ordner nach.</p>
    <button class="btn block" onclick="closeAllSheets()">Alles klar</button>`);}
// Reset-Formular (vom Link ?reset=TOKEN aufgerufen) – funktioniert ohne Login
function showResetForm(token){
  // A-III.3/B2: Dieser Weg fragt /api/me nie. Trug die Anfrage ein (totes) Sitzungs-Cookie, hat der
  // Server die Anmeldekarte ohne Logo geschickt – hier steht fest, dass sie gebraucht wird.
  try{if(typeof window.beLoginLogo==='function')window.beLoginLogo();}catch(e){}
  document.getElementById('loginView')?.classList.remove('hidden');
  document.getElementById('appView')?.classList.add('hidden');
  document.getElementById('onbView')?.classList.add('hidden');
  openSheet('Neues Passwort festlegen',`<form id="rpForm" onsubmit="submitReset('${esc(token)}');return false" novalidate>
    <p class="body muted mb-4">Wähle ein neues Passwort für dein Konto. Alle anderen Geräte werden dabei abgemeldet.</p>
    ${pwField({id:'rp_pw',label:'Neues Passwort',autocomplete:'new-password',placeholder:'mind. 8 Zeichen',enterkeyhint:'next',hint:true})}
    ${pwField({id:'rp_pw2',label:'Wiederholen',autocomplete:'new-password',placeholder:'nochmal eingeben',enterkeyhint:'done'})}
    <button class="btn block" type="submit">Passwort speichern</button></form>`);}
async function submitReset(token){const pw=val('rp_pw'),pw2=val('rp_pw2');
  if(!pw||pw.length<8)return showFieldErr('rpForm','Mindestens 8 Zeichen.','rp_pw');
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
// B13 (RATE-25-account-auth H1, Beleg 43-messages-after-send.txt): Der Athlet hatte bis 2.4.0 nur einen
// Briefkasten – seine eigene Nachricht an den Coach war nach dem Senden nirgends mehr zu sehen, weil
// GET /api/messages/:userId ausschließlich `user_id=ich` liefert. Seit 2.5.0 gibt es zwei Bereiche:
//   Gespräch  – GET /api/messages/thread/:athleteId (beide Richtungen). Der Endpunkt erlaubt dem Athleten
//               seine eigene ID seit jeher (server.js threadPartners), die Oberfläche hat ihn nie benutzt.
//               Gezeichnet wird mit threadHTML() aus coach.js: dieselbe Darstellung wie beim Coach, keine
//               zweite Kopie. coach.js lädt vor account.js, der gemeinsame globale Scope trägt die Funktion.
//   „Für dich" – alles, was NICHT aus dem Gespräch kommt: Nachrichten der App, des Admins, eines früheren
//               Coachs. Die Sonntagsnachricht „Deine Woche" steht dort als Karte, nicht als Rohtext.
let ACC_MSG_TAB='thread';  // zuletzt gewählter Bereich; ohne Coach immer 'sys'
let acMsgData=null;        // Stand des offenen Nachrichten-Sheets: {msgs,thread,partner,canReply,unread}
// Gehört eine Postfach-Nachricht ins Gespräch? Alles vom eigenen Coach – auch seine „Plan angepasst"-
// Hinweise, die threadHTML als graue Systemblase zeichnet.
function acInThread(m){return !!(ME&&ME.coach_id)&&Number(m&&m.from_id)===Number(ME.coach_id);}
async function openMessages(){
  // 2.7.0 (A-III.3): coachOpenMessages() UND threadHTML() wohnen in coach.js – seit dem Bündel-Umbau
  // ein nachgeladenes Modul. Im Fenster zwischen Anmeldung und Nachlauf (gemessen ~1,5 s) zeigte das
  // Sheet sonst die Notdarstellung („lässt sich auf diesem Stand nicht anzeigen") statt des Gesprächs.
  // Erst nachladen, dann wie bisher entscheiden – der alte Rückfallweg bleibt Zeichen für Zeichen stehen.
  if(window.bootLoad&&typeof threadHTML!=='function'){
    // Athlet: sofort das Skelett zeigen, statt stumm auf das Modul zu warten. Coach/Admin nicht –
    // coachOpenMessages() öffnet gleich darauf sein eigenes Sheet mit eigenem Titel, das wäre ein
    // zweiter Eintrag im Sheet-Stapel und „Zurück" landete auf einem leeren Skelett.
    if(ME&&ME.role==='athlete')openSheet('Nachrichten',skeleton(3));
    try{await window.bootLoad('coach');}catch(e){}
  }
  // Coach/Admin: WP7 liefert eine nach Athleten gruppierte Ansicht – falls vorhanden, dorthin delegieren
  if(ME&&ME.role!=='athlete'&&typeof coachOpenMessages==='function')return coachOpenMessages();
  openSheet('Nachrichten',skeleton(3));
  const canReply=!!(ME&&ME.coach_id);
  const msgs=await loadMessages();
  // Ungelesene IDs VOR dem Lesen merken -> „Neu"-Pille bleibt sichtbar, solange das Sheet offen ist
  const unread=new Set(msgs.filter(m=>!m.read).map(m=>m.id));
  let thread=null,partner=null;
  if(canReply){const r=await API.get('/messages/thread/'+ME.id);
    if(r.status===200&&r.data&&Array.isArray(r.data.messages)){thread=r.data.messages;partner=r.data.partner||null;}}
  acMsgData={msgs,thread,partner,canReply,unread};
  acSetMsgTab(ACC_MSG_TAB);}
// Bereich wechseln. Ohne Coach (E23) gibt es kein Segment und keinen leeren Thread – nur „Für dich".
function acSetMsgTab(tab){const d=acMsgData;if(!d)return;
  ACC_MSG_TAB=(d.canReply&&d.thread&&tab!=='sys')?'thread':'sys';
  openSheet('Nachrichten',acMsgSheetHTML());
  if(ACC_MSG_TAB==='thread')acAthThreadOpen();else acReadSys();}
function acMsgSheetHTML(){const d=acMsgData;const t=ACC_MSG_TAB;
  const sys=d.msgs.filter(m=>!acInThread(m));
  const nNew=sys.filter(m=>d.unread.has(m.id)).length;
  const first=String((d.partner&&d.partner.name)||'Coach').split(' ')[0]||'Coach';
  const seg=(d.canReply&&d.thread)?`<div class="seg msg-seg" id="accMsgSeg" role="tablist">
    <button type="button" role="tab" aria-selected="${t==='thread'}" class="${t==='thread'?'on':''}" onclick="acSetMsgTab('thread')">${esc2(first)}</button>
    <button type="button" role="tab" aria-selected="${t==='sys'}" class="${t==='sys'?'on':''}" onclick="acSetMsgTab('sys')">Für dich${nNew?` <span class="pill red">${nNew}</span>`:''}</button>
  </div>`:'';
  return seg+(t==='thread'?acThreadHTML():acSysHTML(sys));}
// Das Gespräch: threadHTML() aus coach.js liefert Blasen, Datumstrenner UND die Eingabe unten. Die Eingabe
// dort schickt über POST /api/messages (Coach-Route, für den Athleten 403) – deshalb wird genau dieser
// eine Aufruf auf acAthThreadSend() umgehängt. Hat coach.js die Eingabe umgebaut, hängen wir eine eigene an,
// damit nie versehentlich die Coach-Route läuft.
function acThreadHTML(){const d=acMsgData;
  const name=(d.partner&&d.partner.name)||'Dein Coach';
  if(typeof threadHTML!=='function')
    return `<div class="note warn mb-3">Das Gespräch lässt sich auf diesem Stand nicht anzeigen.</div>${acComposeHTML(name)}`;
  const raw=threadHTML({id:ME.id,name,msgs:d.thread||[]});
  const want='onclick="sendThread('+ME.id+')"';
  if(raw.indexOf(want)>=0)return raw.replace(want,'onclick="acAthThreadSend()"');
  console.warn('[nachrichten] threadHTML hat eine andere Eingabe – eigene wird angehängt');
  const i=raw.indexOf('<div class="thread-compose"');
  return (i>=0?raw.slice(0,i):raw)+acComposeHTML(name);}
function acComposeHTML(name){const first=String(name||'').split(' ')[0]||'deinen Coach';
  return `<div class="thread-compose"><textarea id="th_body" rows="1" placeholder="Nachricht an ${esc2(first)}…" maxlength="2000" oninput="this.style.height='auto';this.style.height=Math.min(120,this.scrollHeight)+'px'"></textarea>
    <button class="btn icon red" aria-label="Senden" onclick="acAthThreadSend()">${icon('send',20)}</button></div>`;}
// Nach dem Zeichnen: ans Ende scrollen, Lesebestätigung setzen und die eigene Lesebestätigung zeigen.
function acAthThreadOpen(){const d=acMsgData;
  const sh=document.getElementById('sheet');if(sh)requestAnimationFrame(()=>{sh.scrollTop=sh.scrollHeight;});
  acDrawReceipt();
  if(!d||!d.thread||!d.thread.some(m=>m.dir==='in'&&!m.read))return;
  // Lesebestätigung beidseitig: read-thread markiert NUR die Nachrichten dieses Gesprächs – der Coach
  // sieht dadurch, dass gelesen wurde, und „Für dich" bleibt ungelesen (anders als das alte /read,
  // das beim bloßen Öffnen des Postfachs alles stumm wegklickte).
  API.post('/messages/'+ME.id+'/read-thread').then(r=>{if(r.status!==200)return;
    d.thread.forEach(m=>{if(m.dir==='in')m.read=1;});
    d.msgs.forEach(m=>{if(acInThread(m))m.read=1;});
    if(typeof setBellBadge==='function')setBellBadge(d.msgs.filter(m=>!m.read).length);});}
// „Gelesen ✓" / „Gesendet" unter der letzten eigenen Blase – die Gegenrichtung der Lesebestätigung.
function acDrawReceipt(){const d=acMsgData;if(!d||!d.thread)return;
  const th=document.getElementById('thread');if(!th)return;
  th.querySelectorAll('.thread-receipt').forEach(e=>e.remove());
  const out=d.thread.filter(m=>Number(m.from_id)===Number(ME&&ME.id));const last=out[out.length-1];
  const bubs=th.querySelectorAll('.bub.me');const el=bubs[bubs.length-1];
  if(!last||!el)return;
  const div=document.createElement('div');div.className='thread-receipt'+(last.read?' seen':'');
  div.textContent=last.read?'Gelesen ✓':'Gesendet';
  el.insertAdjacentElement('afterend',div);}
// Athlet -> Coach. Eigene Route (POST /api/messages/tocoach); die Coach-Route /api/messages darf er nicht.
async function acAthThreadSend(){const ta=document.getElementById('th_body');const body=(ta?.value||'').trim();
  if(!body)return showFieldErr('sheetBody','Bitte eine Nachricht eingeben.','th_body');
  const btn=document.querySelector('#sheetBody .thread-compose button');if(btn)btn.disabled=true;
  const r=await API.post('/messages/tocoach',{body});
  if(btn)btn.disabled=false;
  if(r.status!==200)return toast(r.data?.error||'Senden fehlgeschlagen – bitte erneut versuchen.');
  const m={from_id:ME.id,user_id:ME.coach_id,body,kind:'message',dir:'out',read:0,created_at:new Date().toISOString()};
  if(acMsgData&&acMsgData.thread)acMsgData.thread.push(m);
  const th=document.getElementById('thread');
  if(th){th.querySelector('.empty')?.remove();
    th.insertAdjacentHTML('beforeend',`<div class="bub me">${esc2(body)}<div class="bd">${typeof cTime==='function'?cTime(m.created_at):''}</div></div>`);
    acDrawReceipt();}
  if(ta){ta.value='';ta.style.height='auto';}
  const sh=document.getElementById('sheet');if(sh)sh.scrollTop=sh.scrollHeight;
  toast('An deinen Coach gesendet ✓');}
// „Für dich": Nachrichten der App + die ausblendbaren Hinweise. Ohne Coach steht hier zusätzlich, warum
// es kein Gespräch gibt – ein leerer Thread wäre eine Einladung, die niemand annehmen kann (E23).
function acSysHTML(sys){const d=acMsgData;
  const list=sys.length?sys.map(m=>acSysMsgHTML(m,d.unread.has(m.id))).join('')
    :emptyState({icon:'bell',title:'Noch nichts für dich',text:'Hier landen Hinweise der App – zum Beispiel dein Wochenrückblick am Sonntagabend.'});
  // System-Hinweise (E-Mail bestätigen / Gesundheitsdaten) unten als ausblendbare Notizen – nie als Zähler
  let notes='';
  for(const n of pendingNotifications()){
    if(n.type==='verify')notes+=infoBox('msg_verify',`<b>E-Mail bestätigen.</b> Bestätige ${esc2(ME.email||'')}, um Passwort-Reset und Mails zu nutzen.<div class="mt-2"><button class="btn sm sec" onclick="resendVerify()">Bestätigungs-Mail senden</button></div>`);
    if(n.type==='health')notes+=infoBox('msg_health_'+(n.li||0),`<b>Gesundheitsdaten aktualisieren.</b> ${n.li?'Letzter Import vor '+pl(n.days,'Tag','Tagen')+'.':'Noch keine Daten importiert.'}<div class="mt-2"><button class="btn sm sec" onclick="closeAllSheets();if(typeof openIntegrations==='function')openIntegrations()">Jetzt importieren</button></div>`);}
  // Ohne Coach: der Satz, warum es kein Gespräch gibt. Mit Coach, aber ohne geladenen Thread (kein Netz,
  // älterer Server): ehrlich sagen, dass das Gespräch fehlt – und den einfachen Weg zum Schreiben lassen.
  const tail=!d.canReply
    ?`<div class="note mt-3">Nachrichten an einen Coach gibt es, sobald dir einer zugeordnet ist.</div>`
    :d.thread?''
    :`<div class="note warn mt-3">Dein Gespräch mit dem Coach lässt sich gerade nicht laden. Schreiben geht trotzdem.</div>
      <div class="msg-compose"><button class="btn block" onclick="replyCoach()">${icon('send',18)} Nachricht an deinen Coach</button></div>`;
  return `<div class="msg-list">${list}</div>${notes?`<div class="msg-notes">${notes}</div>`:''}${tail}`;}
// Eine Nachricht aus „Für dich". Die Sonntagsnachricht („Deine Woche", erkennbar an der Wochenmarke)
// bekommt eine Karte: Zeitraum im Kopf, jede Kennzahl als eigene Zeile, darunter der Weg in die Woche.
function acSysMsgHTML(m,isNew){const wk=_msgWeek(m);const pill=isNew?' <span class="pill red">Neu</span>':'';
  if(wk.week){
    const mon=new Date(Date.parse(wk.week+'T00:00:00'));const sun=new Date(mon.getTime()+6*864e5);
    const span=isNaN(mon.getTime())?'':fmtDate(mon)+' – '+fmtDate(sun);
    // Satzgrenze = Satzzeichen, dem Leerraum oder das Ende folgt. Der Punkt im Tausendertrenner
    // („27.270 kg") trennt deshalb nicht – sonst stünde „27." als eigene Zeile da.
    const lines=String(wk.body).replace(/([.!?])(\s+|$)/g,'$1').split('').map(s=>s.trim()).filter(Boolean);
    return `<div class="sun-card${isNew?' unread':''}">
      <div class="sc-h">${icon('chartLine',20)}<div class="fill"><div class="t">${esc2(m.title||'Deine Woche')}${pill}</div>${span?`<div class="d">${esc2(span)}</div>`:''}</div><div class="md">${relDate(m.created_at)}</div></div>
      <ul class="sc-l">${lines.map(l=>`<li>${esc2(l)}</li>`).join('')}</ul>
      <button class="btn block sec" onclick="openWeekMessage('${esc(wk.week)}')">${icon('chartLine',16)} Woche ansehen</button>
    </div>`;}
  const kind=['message','change','system'].includes(m.kind)?m.kind:'message';
  const sender=m.from_name?m.from_name:(m.kind==='system'?'System':'');
  // Nachrichten kommen von anderen Nutzern -> immer escapen; Zeilenumbrüche erst NACH dem Escapen zu <br>
  return `<div class="msg ${kind}${isNew?' unread':''}"><div class="mh"><div class="mt">${esc2(m.title||'')}${pill}</div><div class="md">${relDate(m.created_at)}</div></div>${sender?`<div class="mf">von ${esc2(sender)}</div>`:''}<div class="mb">${esc2(wk.body).replace(/\n/g,'<br>')}</div></div>`;}
// „Für dich" gesehen -> diese Nachrichten als gelesen melden. Der Server kennt dafür keinen eigenen Weg:
// POST /messages/:id/read markiert das GANZE Postfach. Deshalb erst dann, wenn im Gespräch nichts
// Ungelesenes mehr liegt – sonst würde ein Blick auf „Für dich" eine ungelesene Coach-Nachricht
// stumm wegklicken. (Eigener Weg für „nur Systemnachrichten lesen" -> DEFER-A1.)
function acReadSys(){const d=acMsgData;if(!d)return;
  if(!d.msgs.some(m=>!m.read&&!acInThread(m)))return;
  if(d.msgs.some(m=>!m.read&&acInThread(m)))return;
  API.post('/messages/'+ME.id+'/read').then(r=>{if(r.status!==200)return;
    d.msgs.forEach(m=>{m.read=1;});
    if(typeof setBellBadge==='function')setBellBadge(0);});}
// Montag der BERICHTETEN Woche einer Wochen-Nachricht. Er kommt vom Server mit – als Feld (week /
// week_start / url mit „tracker/woche/JJJJ-MM-TT") oder als Marke „[week:JJJJ-MM-TT]" im Rumpf, die hier
// herausgeschnitten wird, damit sie nie im Klartext steht. Aus created_at lässt er sich NICHT ableiten:
// am nachgetragenen Montag und beim Admin-Knopf zeigte das nachweislich auf die falsche Woche. Ältere
// Nachrichten ohne Marke bekommen schlicht keinen Knopf – kein Bruch.
function _msgWeek(m){let w=null,body=String((m&&m.body)||'');
  const ok=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
  for(const k of ['week','week_start','weekStart']){if(m&&ok(m[k])){w=String(m[k]);break;}}
  if(!w&&m&&typeof m.url==='string'){const mm=m.url.match(/tracker\/woche\/(\d{4}-\d{2}-\d{2})/);if(mm)w=mm[1];}
  const mk=body.match(/\s*\[week:(\d{4}-\d{2}-\d{2})\]\s*/);
  if(mk){if(!w)w=mk[1];body=body.replace(mk[0],' ').trim();}
  if(w&&isNaN(Date.parse(w+'T00:00:00')))w=null;
  return {week:w,body};}
// Derselbe Weg wie der Sonntags-Push: Hash „#tracker/woche/<Montag>" setzen und den Router darauf
// loslassen (applyHashRoute in core.js zieht die Woche in ANA_WEEK_LINK und wechselt in die Analyse).
// replaceState statt location.hash: kein zusätzlicher History-Eintrag, kein zweites hashchange-Ereignis.
function openWeekMessage(w){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(w||'')))return;
  try{history.replaceState(null,'',location.pathname+location.search+'#tracker/woche/'+w);}catch(e){location.hash='#tracker/woche/'+w;}
  if(typeof applyHashRoute==='function'){try{if(applyHashRoute())return;}catch(e){console.error('[nachrichten] Woche',e);}}
  // Notnagel ohne Router: direkt in die Analyse (laufende Woche)
  if(typeof renderTracker==='function')renderTracker.tab='woche';go('tracker');}
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
// Die Stufen-Namen standen hier ein zweites Mal – dieselbe Tabelle wie in core.js (DS_LV_LABEL) und
// in coach.js (expLabel). Zwei Quellen für dieselben drei Wörter sind zwei Stellen, an denen sie
// auseinanderlaufen können; seit Ü-2 hängt an derselben Stufe auch ein Text. Also: eine Quelle.
const PHASE_LABEL={offseason:'Offseason',prep:'Wettkampf-Prep',maintain:'Maintenance'};
const DIET_LABEL={all:'Alles',vegetarian:'Vegetarisch',vegan:'Vegan'};
function roleLabel(r){return {admin:'Administrator',coach:'Coach',athlete:'Athlet'}[r]||'';}
function openProfile(){openSheet('Profil',profileHubHTML());loadProfileAvatar();
  // Fragt der Server das Kalorienziel an (kcalAsk)? Das entscheidet, ob die Ernährungs-Zeile einen
  // Hinweis trägt – deshalb gleich beim Öffnen, nicht erst im Unter-Sheet.
  if(ME&&ME.role==='athlete')acKcalAskLoad();}
function loadProfileAvatar(){if(!ME||!ME.has_avatar||_PF_AVATAR_URL)return;
  API.get('/avatar/'+ME.id).then(r=>{if(r.status===200&&r.data&&r.data.avatar){_PF_AVATAR_URL=r.data.avatar;
    const el=document.getElementById('pf_avatar');if(el){el.textContent='';el.style.backgroundImage='url('+_PF_AVATAR_URL+')';}}});}
// A-II.4: role="button" + tabindex="0" machen die 22 tippbaren Einstellungszeilen zu echten Knöpfen für
// die Tastatur. Enter/Leertaste kommen vom EINEN delegierten Auslöser a11KeyActivate (shell.js) – kein
// eigenes onkeydown hier, sonst löst es zweimal aus (BUILD-A2 Abschnitt 2, Abgrenzung A-II.5 ↔ A-II.6).
// Der Fokusring steht in app.css (.row.tap:focus-visible). Keine Schachtelung: das Label enthält nie
// einen Knopf oder Link, sonst wäre ein Knopf im Knopf entstanden.
function pfRow(fn,ic,label,sub){return `<div class="row tap" role="button" tabindex="0" onclick="${fn}"><div class="r-ic">${icon(ic,24)}</div><div class="rl">${label}${sub?`<small>${sub}</small>`:''}</div></div>`;}
// ===== D10/D1: DAS GESPEICHERTE KALORIENZIEL UND DAS GERECHNETE =====
// Weicht das im Profil gespeicherte Ziel um mehr als 7 % von der Formel ab, rechnet der Server neu und
// legt beide Zahlen als `kcalAsk` in die Antwort (GET /api/me, GET /api/foodlog, GET /api/dashboard).
// Bis 2.5.0 zeigte das niemand: im Profil stand 3.017 / 2.600 kcal, die Ernährung rechnete mit
// 3.173 / 2.975 kcal – zwei Wahrheiten für dieselbe Sache. Hier steht jetzt die Frage, samt der einen
// Antwort, die den Widerspruch auflöst: übernehmen.
let AC_KCAL_ASK=null;     // null = deckungsgleich oder noch nicht geladen
async function acKcalAskLoad(){
  try{const r=await API.get('/me');
    if(r.status!==200)return;
    AC_KCAL_ASK=(r.data&&r.data.kcalAsk)||null;
    if(r.data&&r.data.user&&typeof ME!=='undefined'&&ME&&r.data.user.id===ME.id)ME.dob=r.data.user.dob??null;
    acKcalAskPaint();
  }catch(e){}}
// Den Kasten im offenen Sheet nachziehen, ohne das Sheet neu zu bauen (der Nutzer tippt womöglich gerade)
function acKcalAskPaint(){const box=document.getElementById('pf_kcalAsk');if(box)box.innerHTML=acKcalAskHTML();
  refreshProfileHub();}
function acKcalAskHTML(){const a=AC_KCAL_ASK;if(!a)return '';
  const t=a.train||{},r=a.rest||{};
  const st=Math.round(t.saved||0),su=Math.round(t.suggested||0);
  const sr=Math.round(r.saved||0),ru=Math.round(r.suggested||0);
  if(!su&&!ru)return '';
  const kg=a.weightKg?fmtNum(a.weightKg,1):'';
  return `<div class="note status mb-3">
    <div>Deine gespeicherten Ziele (<b>${fmtNum(st)} / ${fmtNum(sr)} kcal</b>) passen nicht mehr zu deinem Gewicht${kg?' von '+kg+' kg':''}.
      Gerechnet wird zurzeit mit <b>${fmtNum(su)} / ${fmtNum(ru)} kcal</b> (Training / Ruhe) – das siehst du auch im Ernährungs-Tab.</div>
    <div class="mt-2"><button class="btn sm" onclick="acKcalAskApply()">Auf ${fmtNum(su)} / ${fmtNum(ru)} kcal ändern</button></div>
    <div class="caption mt-2">Solange du die alten Werte behältst, bleibt der Unterschied bestehen. Dein Coach kann die Ziele ebenfalls anpassen.</div>
  </div>`;}
async function acKcalAskApply(){const a=AC_KCAL_ASK;if(!a)return;
  const t=Math.round(a.train?.suggested||0),r=Math.round(a.rest?.suggested||0);
  if(!t&&!r)return;
  const f={};if(t)f.kcal_target_train=t;if(r)f.kcal_target_rest=r;
  // plan:true – der Ernährungsplan hängt an diesen Zielen und muss neu geladen werden
  if(!await profileSave(f,{msg:'Kalorienziele übernommen ✓',plan:true}))return;
  const kt=document.getElementById('p_kt');if(kt)kt.value=t||'';
  const kr=document.getElementById('p_kr');if(kr)kr.value=r||'';
  AC_KCAL_ASK=null;acKcalAskPaint();
  acKcalAskLoad();}   // gegenprüfen: nur wenn der Server auch nichts mehr fragt, ist der Widerspruch weg
// Geburtsjahr: fehlt es, rechnet der Server das Kalorienziel OHNE Alter und nennt das Ergebnis einen
// Startwert (DOB_MISSING_NOTE). Das Onboarding fragt seit 2.5.0 danach (core.js) – Bestandskonten
// kamen bisher nirgends mehr an das Feld heran. Dieselbe Spanne wie dort: 1920 bis heute minus zehn.
const AC_DOB_YEAR_MIN=1920;
function acDobYearMax(){return (typeof crMaxBirthYear==='function')?crMaxBirthYear():(new Date().getFullYear()-10);}
function acDobYear(){const d=(ME&&typeof ME.dob==='string')?ME.dob:'';return /^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(0,4):'';}
// Der Satz unter dem Feld sagt, was das Jahr bewirkt – und ändert sich, sobald es da ist (oder wieder fehlt)
function acDobNoteTx(){return acDobYear()?'Aus dem Jahr rechnen wir dein Alter – es fließt in dein Kalorienziel ein.'
  :'Ohne Geburtsjahr rechnet dein Kalorienziel ohne Alter – die Zahl ist dann nur ein Startwert.';}
async function acDobSave(el){const raw=String(el.value||'').trim();const field=el.closest('.field');
  const cur=acDobYear();
  if(raw===''){if(!cur)return;const ok=await profileSave({reset:['dob']},{msg:'Geburtsjahr entfernt ✓'});
    if(ok){clearFieldErr('p_dobY');acDobNotePaint();acKcalAskLoad();}else el.value=cur;return;}
  const y=parseInt(raw,10),yMax=acDobYearMax();
  if(!Number.isInteger(y)||y<AC_DOB_YEAR_MIN||y>yMax)
    return showFieldErr(null,`Bitte ein Geburtsjahr zwischen ${AC_DOB_YEAR_MIN} und ${yMax}.`,'p_dobY');
  clearFieldErr('p_dobY');
  if(String(y)===cur)return;
  // Der Tag ist der 1.1. – wie im Onboarding. Gespeichert wird das JAHR, nicht der Geburtstag:
  // das Alter veraltet damit nie still, und mehr braucht die Kalorienformel nicht.
  const ok=await profileSave({dob:y+'-01-01'},{msg:'Geburtsjahr gespeichert ✓',plan:true});
  if(ok){pfFlash(field);acDobNotePaint();acKcalAskLoad();}else el.value=cur;}
function acDobNotePaint(){const n=document.getElementById('pf_dobNote');if(n)n.textContent=acDobNoteTx();}
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
    const goalSub=[goalLabel(u.goal),(typeof DS_LV_LABEL==='object'?DS_LV_LABEL[u.experience]:'')||'',(u.days_per_week||4)+'×/Woche'].filter(Boolean).join(' · ');
    // „· weicht ab" ist der Haken, an dem der Hinweis im Unter-Sheet hängt: die Zahl in dieser Zeile ist
    // dann nicht die, mit der gerechnet wird. Ohne Geburtsjahr ist sie zusätzlich nur ein Startwert (D1).
    const kcalSub=((u.kcal_target_train||u.kcal_target_rest)?`${DIET_LABEL[u.diet_type||'all']} · ${fmtNum(u.kcal_target_train)} / ${fmtNum(u.kcal_target_rest)} kcal`:DIET_LABEL[u.diet_type||'all'])
      +(AC_KCAL_ASK?' · weicht ab':'')+(u.dob?'':' · Geburtsjahr fehlt');
    const sg=pfSleepGoal();
    const goalsSub=`${fmtNum(sg.h,sg.h%1?1:0)} h${sg.derived?' (abgeleitet)':''} · ${fmtNum(u.steps_goal||10000)} Schritte · ${fmtNum(u.water_goal||3,(u.water_goal||3)%1?1:0)} L`;
    rows+=`<div class="section-label">Einstellungen</div><div class="rows pf-rows">
      ${pfRow('openGoalSheet()','target','Ziel &amp; Training',esc2(goalSub))}
      ${pfRow('openNutritionSheet()','utensils','Ernährung &amp; Kalorien',esc2(kcalSub))}
      ${pfRow('openGoalsSheet()','moon','Persönliche Ziele',esc2(goalsSub))}
      ${pfRow('openNotifSheet()','bell','Erinnerungen','Push, Uhrzeiten, Test-Mitteilung, E-Mail')}
      ${pfRow('openDataSheet()','apple','Daten &amp; Verbindungen','Gesundheitsdaten, Export, App')}
    </div>`;
  }else{
    rows+=`<div class="note mb-3">Als ${roleLabel(u.role)} verwaltest du ${u.role==='admin'?'das System':'deine Athleten'}. Trainings- und Ernährungsdaten gibt es hier nicht.</div>
    <div class="section-label">Einstellungen</div><div class="rows pf-rows">
      ${pfRow('openNotifSheet()','bell','Erinnerungen','Push, Test-Mitteilung, E-Mail')}
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
  // Die Antwort trägt mehr als „ok": nach einem Zielwechsel steht dort die neu gerechnete Kalorien-
  // Empfehlung (suggestedKcal). Sie hier festzuhalten ist billiger als eine zweite Abfrage – der
  // Rückgabewert bleibt absichtlich der alte (true/false), damit die zwölf Aufrufer unverändert stimmen.
  profileSave.last=r.data||null;
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
  const vorher=String(ME[key]??'');   // Ü-2: die Stufe VOR dem Tipp – sonst ist der Unterschied nicht mehr zu sagen
  row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===btn));
  const ok=await profileSave({[key]:v});
  if(!ok){row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.v===String(ME[key]??'')));return;}
  // A5/B15: „Muskelaufbau -> Definition" ändert die Kalorienziele NICHT von selbst – der Server sagt in
  // derselben Antwort, welche Zahlen zum neuen Ziel gehören (suggestedKcal). Bis 2.5.0 wurde das
  // verschwiegen: das Ziel stand auf Definition, gegessen wurde weiter nach Aufbau-Kalorien.
  if(key==='goal')acGoalAskPaint(profileSave.last&&profileSave.last.suggestedKcal);
  // Ü-2: dasselbe Versäumnis eine Zeile tiefer. Ein Tipp auf „Anfänger" nahm dem Athleten die
  // RIR-Spalte, die Satztypen und den e1RM – und sagte dazu „Gespeichert ✓". Jetzt steht der
  // Unterschied im Kasten unter den Chips. KEIN Dialog: der würde einen Tap kosten (Veto A-IV).
  if(key==='experience')acExpNotePaint(vorher);}
// --- Ü-2 · Was die Erfahrungs-Stufe bedeutet, unter den Chips ---
// Hier stand bis 2.7.0 ein Satz, der zweimal danebenlag: „Profis alle Details (RIR, Volumen)" –
// den Volumen-Korridor je Muskel sieht in 2.8.0 JEDER (analysis.js anaMuscleHTML hängt an keiner
// Stufe), und „Profi" zeigt exakt dasselbe wie „Fortgeschritten". Gleichzeitig sagte beim Umstellen
// NICHTS, was verschwindet. Beides ist derselbe Fehler: die Stufe war eine Vokabel.
// Der Kasten steht deshalb IMMER da (wer wissen will, was seine Stufe bedeutet, soll dafür nicht
// erst etwas kaputtmachen müssen) und bekommt nach einem Tipp den Unterschied dazu.
// Wortlaut und Rangfolge kommen aus core.js (DS_LV_*) – dieselbe Quelle, die twLevel()/an2Level()
// auswerten, damit hier nicht steht, was die Satzzeile anders macht.
// `d`  = {weg,neu} aus dsLvDiff, nur direkt nach einer Umstellung · `von` = vorige Selbstangabe.
function acExpNoteHTML(d,von){
  const self=String(ME.experience||'beginner');
  const coach=ME.experience_coach?String(ME.experience_coach):'';
  const wirk=coach||self;                    // dieselbe Rangfolge wie twLevel()/an2Level()
  const lab=k=>(typeof dsLvLabel==='function')?dsLvLabel(k):String(k||'');
  const sees=(typeof dsLvSees==='function')?dsLvSees(wirk):[];
  const basis=(typeof DS_LV_BASE==='string')?DS_LV_BASE:'';
  const li=a=>'<ul class="ds-lvlist">'+a.map(x=>'<li>'+esc2(x)+'</li>').join('')+'</ul>';
  let h='<div class="note status mt-2">';
  h+='<div><b>'+esc2(lab(wirk))+'</b> · '+(coach?'von deinem Coach gesetzt':'deine Angabe')+'</div>';
  h+=sees.length?'<div class="mt-2">Das siehst du damit:</div>'+li(sees)
    :(basis?'<div class="mt-2">'+esc2(basis)+'</div>':'');
  if(coach){
    // Die Chips sind dann eine Selbstauskunft, kein Schalter – das muss dastehen, sonst tippt der
    // Athlet auf „Profi" und wundert sich, dass die Satzzeile gleich bleibt.
    h+='<div class="mt-2 muted-2">Deine eigene Angabe ist „'+esc2(lab(self))+'". Wirksam ist die Stufe deines Coachs: solange sie steht, ändert ein Tipp auf die Chips oben nichts an dem, was du siehst.</div>';
  }else if(von!=null&&von!==''){
    if(!d){
      h+='<div class="mt-2">Umgestellt auf <b>'+esc2(lab(self))+'</b>. In der App ändert das nichts: „Fortgeschritten" und „Profi" zeigen dieselben Felder – die Stufe hält nur fest, wie du dich selbst einschätzt.</div>';
    }else{
      if(d.neu.length)h+='<div class="mt-2">Neu dazugekommen:</div>'+li(d.neu);
      if(d.weg.length){
        h+='<div class="mt-2">Weg ist damit:</div>'+li(d.weg);
        // Der wichtigste Satz des Kastens: die Werte sind NICHT gelöscht. `set_logs.rir` bleibt
        // stehen, und `recommend()` (logic.js) rechnet unverändert damit – die Funktion kennt gar
        // kein Stufen-Argument. Weg ist das EINGABEFELD, nicht die Zahl. Genau so steht es hier
        // auch: „du siehst sie nicht mehr" wäre schon wieder falsch, denn die Begründungszeile
        // der Satzzeile nennt einen gespeicherten RIR weiterhin (training.js twWhy).
        if(d.weg.some(x=>/RIR/.test(x)))
          h+='<div class="mt-2 muted-2">Schon eingetragene RIR-Werte bleiben gespeichert und rechnen weiter an deinen Empfehlungen mit – weg ist nur das Eingabefeld. Tipp oben wieder auf „'+esc2(lab(von))+'", und es ist zurück.</div>';
      }
    }
  }
  return h+'</div>';}
// Nach einer Umstellung neu zeichnen. Bei gesetzter Coach-Stufe ändert die eigene Angabe nichts an
// dem, was zu sehen ist – dann wird auch kein Unterschied behauptet (d=null, der Kasten sagt warum).
function acExpNotePaint(von){const box=document.getElementById('pf_expNote');if(!box)return;
  const coach=ME.experience_coach?String(ME.experience_coach):'';
  const d=(coach||typeof dsLvDiff!=='function')?null:dsLvDiff(von,String(ME.experience||'beginner'));
  box.innerHTML=acExpNoteHTML(d,von);}
// Kasten unter den Ziel-Chips: die neu gerechneten Kalorien zum gewählten Ziel, mit einem Weg, sie zu nehmen.
let AC_GOAL_ASK=null;
function acGoalAskPaint(s){const box=document.getElementById('pf_goalAsk');
  const t=Math.round(s?.train||0),r=Math.round(s?.rest||0);
  AC_GOAL_ASK=(t||r)?{train:t,rest:r}:null;
  if(!box)return;
  if(!AC_GOAL_ASK){box.innerHTML='';return;}
  const ct=Math.round(s.current?.train||0),cr=Math.round(s.current?.rest||0);
  const same=ct===t&&cr===r;
  box.innerHTML=same?`<div class="note mt-3">Deine Kalorienziele passen schon zum neuen Ziel.</div>`
    :`<div class="note status mt-3">
      <div>Zum neuen Ziel gehören <b>${fmtNum(t)} / ${fmtNum(r)} kcal</b> (Training / Ruhe)${(ct||cr)?` – gespeichert sind ${fmtNum(ct)} / ${fmtNum(cr)} kcal`:''}.${s.dobMissing?' Ohne Geburtsjahr ist das ein Startwert.':''}</div>
      <div class="mt-2"><button class="btn sm" onclick="acGoalAskApply()">Kalorienziele anpassen</button></div>
      <div class="caption mt-2">Ohne Anpassung bleibt es bei den alten Zahlen – das Ziel allein ändert sie nicht.</div>
    </div>`;}
async function acGoalAskApply(){const g=AC_GOAL_ASK;if(!g)return;
  const f={};if(g.train)f.kcal_target_train=g.train;if(g.rest)f.kcal_target_rest=g.rest;
  if(!Object.keys(f).length)return;
  if(!await profileSave(f,{msg:'Kalorienziele angepasst ✓',plan:true}))return;
  AC_GOAL_ASK=null;const box=document.getElementById('pf_goalAsk');
  if(box)box.innerHTML=`<div class="note mt-3">Kalorienziele stehen jetzt auf dein neues Ziel.</div>`;
  acKcalAskLoad();}
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
    <div id="pf_goalAsk"></div>
    <div class="section-label">Erfahrung</div>
    <div class="chip-row wrap">${pfChips('experience',[['beginner','Anfänger'],['intermediate','Fortgeschritten'],['advanced','Profi']])}</div>
    <div id="pf_expNote" aria-live="polite">${acExpNoteHTML()}</div>
    <div class="section-label">Phase</div>
    <div class="chip-row wrap">${pfChips('phase',[['offseason','Offseason'],['prep','Wettkampf-Prep'],['maintain','Maintenance']])}</div>
    <div class="section-label">Trainingsrhythmus</div>
    <div class="rows">${_mrow('refresh','Zyklus anpassen',"closeAllSheets();openRhythmus()",{sub:_pfCycleSub(dpw)})}</div>
    <p class="caption mt-2">Deine Folge aus Trainings- und Ruhetagen – unabhängig vom Wochentag. Sie bestimmt auch, wie viele Trainings pro Woche in deine Kalorienziele einfließen.</p>
    <div class="note mt-4">Änderungen werden sofort gespeichert.</div>`);}
// Untertitel der Rhythmus-Zeile: die echte Folge, sonst nur die Frequenz.
// Der Rhythmus wird ausschließlich im Editor (Training → Kalender) geändert – eine Quelle,
// kein zweiter Regler, der eine fein gebaute Folge stillschweigend überschreibt.
function _pfCycleSub(dpw){
  let pat=null;try{pat=ME&&ME.pattern?JSON.parse(ME.pattern):null;}catch(e){pat=null;}
  const txt=(typeof cycleText==='function'&&Array.isArray(pat))?cycleText(pat,(PLAN?.days||[]).map(d=>d.name)):'';
  return txt?txt+' · '+dpw+'×/Woche':dpw+' Trainings pro Woche';}
// --- Unter-Sheet: Ernährung & Kalorien ---
function openNutritionSheet(){const u=ME;
  const start=u.start_weight?`Startgewicht ${fmtNum(u.start_weight,1)} kg${u.created_at?' · gesetzt am '+fmtDate(u.created_at):''}`:'Kein Startgewicht gesetzt';
  const yMax=acDobYearMax();
  acKcalAskLoad();   // frisch holen, während das Sheet schon steht – #pf_kcalAsk füllt sich nach
  openSheet('Ernährung & Kalorien',`
    <div class="section-label">Ernährungsweise</div>
    <div class="chip-row wrap">${pfChips('diet_type',[['all','Alles'],['vegetarian','Vegetarisch'],['vegan','Vegan']])}</div>
    <p class="caption mt-2">Filtert Rezepte und deinen Ernährungsplan.</p>
    <div class="section-label">Kalorienziele</div>
    <div id="pf_kcalAsk">${acKcalAskHTML()}</div>
    <div class="grid-2">
      <div class="field"><label for="p_kt">Trainingstag (kcal)</label><input id="p_kt" type="number" inputmode="numeric" min="0" max="15000" value="${u.kcal_target_train||''}" placeholder="z.B. 3000" onchange="pfNum('kcal_target_train',this)"></div>
      <div class="field"><label for="p_kr">Ruhetag (kcal)</label><input id="p_kr" type="number" inputmode="numeric" min="0" max="15000" value="${u.kcal_target_rest||''}" placeholder="z.B. 2600" onchange="pfNum('kcal_target_rest',this)"></div>
    </div>
    <p class="caption">Dein Coach kann diese Ziele ebenfalls anpassen.</p>
    <div class="section-label">Körperdaten</div>
    <div class="grid-2">
      <div class="field"><label for="p_dobY">Geburtsjahr</label><input id="p_dobY" type="number" inputmode="numeric" autocomplete="bday-year" min="${AC_DOB_YEAR_MIN}" max="${yMax}" step="1" value="${esc2(acDobYear())}" placeholder="z.B. 1996" onchange="acDobSave(this)"></div>
      <div class="field"><label for="p_height">Größe (cm)</label><input id="p_height" type="number" inputmode="numeric" min="50" max="260" value="${u.height_cm||''}" placeholder="z.B. 180" onchange="pfNum('height_cm',this)"></div>
    </div>
    <p class="caption mb-3" id="pf_dobNote">${acDobNoteTx()}</p>
    <div class="note status">${esc2(start)}<br><span class="muted-2">Fest – daran wird dein Fortschritt gemessen. Korrektur über deinen Coach.</span></div>
    <div class="note mt-3">Änderungen werden sofort gespeichert.</div>`);}
// --- Unter-Sheet: Persönliche Ziele ---
// Wirksames Schlafziel fürs Profil: der gesetzte Wert – sonst das Ziel, das der Server ohne Profilangabe aus
// dem eigenen 14-Tage-Schnitt ableitet (7–8 h) und in readiness.sleepGoal mitliefert (Home-Aggregat bzw.
// Analyse-Cache). So steht hier dieselbe Zahl wie in Bereitschaft und Wochenrückblick, und es steht dabei,
// woher sie kommt. Ohne Serverwert (noch nichts geladen) bleibt der App-Standard 8.
function pfSleepGoal(){const u=ME||{};const set=+u.sleep_goal;if(set>0)return {h:set,derived:false};
  const num=v=>{v=Number(v);return (v>0&&isFinite(v))?v:null;};let v=null;
  try{if(typeof HOME_DATA!=='undefined'&&HOME_DATA&&HOME_DATA.readiness&&VIEW_USER===u.id)v=num(HOME_DATA.readiness.sleepGoal);}catch(e){}
  try{if(!v&&typeof anaCached==='function'&&VIEW_USER===u.id){const R=anaCached('readiness');if(R)v=num(R.sleepGoal);}}catch(e){}
  return v?{h:v,derived:true}:{h:8,derived:false};}
function openGoalsSheet(){const u=ME;const sg=pfSleepGoal();
  const sgTxt=fmtNum(sg.h,sg.h%1?1:0)+' h';
  openSheet('Persönliche Ziele',`
    <div class="grid-3 mt-2">
      <div class="field"><label for="p_sleepg">Schlaf (h)</label><input id="p_sleepg" type="number" inputmode="decimal" step="0.5" min="0" max="24" value="${u.sleep_goal??''}" placeholder="${sg.derived?esc2(sgTxt):'Standard 8'}" onchange="pfNum('sleep_goal',this,{reset:true})"></div>
      <div class="field"><label for="p_stepsg">Schritte</label><input id="p_stepsg" type="number" inputmode="numeric" min="0" max="100000" value="${u.steps_goal??''}" placeholder="Standard 10.000" onchange="pfNum('steps_goal',this,{reset:true})"></div>
      <div class="field"><label for="p_waterg">Wasser (L)</label><input id="p_waterg" type="number" inputmode="decimal" step="0.1" min="0" max="30" value="${u.water_goal??''}" placeholder="Standard 3" onchange="pfNum('water_goal',this,{reset:true})"></div>
    </div>
    ${sg.derived?`<p class="caption mb-3">Schlaf: ohne Angabe leitet die App dein Ziel aus deinem eigenen Schnitt der letzten 14 Nächte ab (7–8 h) – zurzeit ${esc2(sgTxt)}. Trag einen Wert ein, wenn ein anderes Ziel gelten soll.</p>`:''}
    <div class="note">Diese Ziele erscheinen als grüne Linie in deiner Analyse. Leer lassen = Schlafziel aus deinem eigenen Schnitt (7–8 h) · 10.000 Schritte · 3 L. Änderungen werden sofort gespeichert.</div>`);}
// --- Unter-Sheet: Benachrichtigungen (Push mit echtem Status, Uhrzeiten als Chips, Mindset, E-Mail) ---
// A5/M2a (RATE-25-account-auth, 09-notif-sheet.png): Bis 2.4.0 stand hier „Push Aus" und daneben leuchtete
// „10 Uhr". Eine Erinnerung ohne Push kommt aber nirgends an. Alles, was Push braucht, startet deshalb
// GESPERRT (.dis) und wird von renderPushRow() erst freigegeben, wenn Push auf DIESEM Gerät wirklich läuft –
// gesperrt statt versteckt, damit die eingestellte Stunde sichtbar bleibt.
// Ebenso der E-Mail-Schalter: ohne bestätigte Adresse verschickt der Server keine Mail (server.js prüft
// `a.email_notifications && a.email && a.email_verified`), also darf der Schalter das nicht behaupten.
// Und selbst mit bestätigter Adresse geht nichts raus, wenn auf dem Server gar kein Mailversand
// eingerichtet ist (GET /api/register-info → `mailConfigured:false`, Serverlog „SMTP fehlt"). Dann ist der
// Schalter gesperrt wie die Push-Chips – ein bedienbarer Schalter wäre ein Versprechen, das niemand einlöst.
// Ältere Server kennen das Feld nicht; acMailConfigured() liefert dafür null und es bleibt beim alten Verhalten.
async function openNotifSheet(){const u=ME;const athlete=u.role==='athlete';
  const pushSub=athlete?(u.coach_id?'Trainings-Erinnerung und Nachrichten deines Coachs':'Trainings-Erinnerung und Hinweise der App'):'Neue Nachrichten deiner Athleten';
  // Beide Erinnerungs-Reihen führen '' = Aus als erste Wahl; NULL in der DB bedeutet in beiden Fällen „keine Erinnerung"
  const ph=u.push_hour==null?'':String(u.push_hour);const mh=u.mindset_push_hour==null?'':String(u.mindset_push_hour);
  let noMail=false;try{noMail=await acMailConfigured()===false;}catch(e){}
  const verified=!!u.email_verified;
  const mailOk=verified&&!noMail;const mailOn=!!u.email_notifications&&mailOk;
  const mailSub=noMail?'Auf diesem Server ist kein Mailversand eingerichtet':(verified?'Benachrichtigungen auch per E-Mail':'Erst nach der E-Mail-Bestätigung aktiv');
  const mailTap=noMail?"toast('Auf diesem Server ist kein Mailversand eingerichtet.')":"toast('Bestätige zuerst deine E-Mail-Adresse.')";
  const mailNote=noMail
    ?`<div class="note mb-3">Auf diesem Server ist kein Mailversand eingerichtet – es kommt keine E-Mail an, egal was hier steht. Was dich erreichen soll, läuft über Push-Mitteilungen.</div>`
    :`<div class="note mb-3">Bestätige zuerst deine E-Mail-Adresse – vorher verschickt die App keine Mail an dich.<div class="mt-2"><button class="btn sm sec" onclick="resendVerify()">Bestätigungs-Mail senden</button></div></div>`;
  let h=`<div class="rows mb-3">
    <div class="switch-row"><div class="r-ic">${icon('bell',24)}</div><div class="rl">Push-Mitteilungen<small id="pf_pushStatus">Status wird geprüft…</small></div><button type="button" class="tgl" id="pf_pushTgl" role="switch" aria-checked="false" aria-label="Push-Mitteilungen" onclick="togglePush()"></button></div>
    <div class="switch-row"><div class="r-ic">${icon('mail',24)}</div><div class="rl">E-Mail<small>${esc2(mailSub)}</small></div><button type="button" class="tgl${mailOn?' on':''}${mailOk?'':' dis'}" id="p_notif" role="switch" aria-checked="${mailOn?'true':'false'}"${mailOk?'':' aria-disabled="true"'} aria-label="E-Mail-Benachrichtigungen" onclick="${mailOk?"toggleEmailNotif(!this.classList.contains('on'),this)":mailTap}"></button></div>
  </div>
  <p class="caption mb-2">${pushSub}.</p>
  ${mailOk?'':mailNote}
  <div class="note mb-3" id="pf_pushOff">Push-Mitteilungen sind auf diesem Gerät aus – ohne sie kommt keine Erinnerung an.<div class="mt-2"><button class="btn sm sec" onclick="togglePush()">Push einschalten</button></div></div>`;
  // A-V.3 (BUILD-A5 5.3): Das ERINNERUNGS-CENTER. Bis 2.8.0 standen hier drei Chip-Reihen – und
  // fünf weitere Push-Arten (Wochen-Rückblick, Coach-Nachricht, Plan-Änderung, Reparatur,
  // Abend-Hinweis) waren unsichtbar und unschaltbar (RATE-25-engagement M1). Wer nicht weiß, was
  // ihn erreichen kann, schaltet im Zweifel alles ab. Deshalb steht ab jetzt JEDE Art hier – und
  // zwar mit dem Zeitfenster, das der Server wirklich benutzt (src/server.js cronTick).
  // Was noch keinen eigenen Schalter hat, steht trotzdem da und sagt das auch: eine ehrliche Liste
  // ist mehr wert als ein Schalter, der nichts tut.
  h+=`<div class="rows mb-3">
    <div class="switch-row"><div class="r-ic">${icon('bell',24)}</div><div class="rl">Test-Mitteilung<small id="lp_testSub">Zeigt sofort eine Mitteilung auf diesem Gerät – so siehst du, ob Sperrbildschirm und Ton stimmen</small></div><button type="button" class="btn sm sec" id="lp_testBtn" onclick="lpTestNotification()">Senden</button></div>
  </div>`;
  if(athlete){
    h+=`<div class="section-label">Trainings-Erinnerung</div>
    <div class="chip-row wrap" id="pf_pushHour" role="group" aria-label="Uhrzeit der Trainings-Erinnerung">${[['','Aus'],['6','6 Uhr'],['7','7 Uhr'],['8','8 Uhr'],['9','9 Uhr'],['10','10 Uhr'],['12','12 Uhr'],['16','16 Uhr'],['17','17 Uhr'],['18','18 Uhr'],['19','19 Uhr'],['20','20 Uhr']].map(([v,l])=>`<button type="button" class="chip dis${v===ph?' on':''}" data-v="${v}" aria-pressed="${v===ph?'true':'false'}" onclick="pfPushHour('${v}',this)">${l}</button>`).join('')}</div>
    <p class="caption mt-2">An Trainingstagen zur vollen Stunde · deutsche Zeit · nur mit aktiven Push-Mitteilungen. War der Server zur vollen Stunde gerade neu gestartet, kommt sie bis zu drei Stunden später nach. „Aus" betrifft nur diese Erinnerung.</p>
    <div class="section-label">Priming-Erinnerung</div>
    <div class="chip-row wrap" id="pf_mindHour" role="group" aria-label="Uhrzeit der Priming-Erinnerung">${[['','Aus'],['5','5 Uhr'],['6','6 Uhr'],['7','7 Uhr'],['8','8 Uhr'],['9','9 Uhr'],['10','10 Uhr']].map(([v,l])=>`<button type="button" class="chip dis${v===mh?' on':''}" data-v="${v}" aria-pressed="${v===mh?'true':'false'}" onclick="pfMindHour('${v}',this)">${l}</button>`).join('')}</div>
    <p class="caption mt-2">„Zeit für dein Priming" zur gewählten Stunde, solange heute noch kein Priming gespeichert ist.</p>
    <div class="rows mt-3 mb-3">
      <div class="switch-row"><div class="r-ic">${icon('moon',24)}</div><div class="rl">Abend-Reflexion<small>Erinnerung um 20 Uhr</small></div><button type="button" class="tgl dis${u.evening_push?' on':''}" id="p_evepush" role="switch" aria-checked="${u.evening_push?'true':'false'}" aria-label="Abend-Reflexion erinnern" onclick="toggleEvePush(this)"></button></div>
    </div>`+lpOtherPushHTML();
  }
  h+=`<div class="note">Änderungen werden sofort gespeichert.</div>`;
  openSheet('Erinnerungen',h);renderPushRow();}
// Die übrigen Push-Arten – was der Server wirklich verschickt, mit dem Fenster aus cronTick.
// Reine Anzeige: jede Zeile hier hängt an EINEM Schalter, nämlich „Push-Mitteilungen" ganz oben.
// Was hier steht, ist gegen src/server.js geprüft – wer dort ein Fenster ändert, ändert diese Zeilen mit.
function lpOtherPushHTML(){
  const rows=[
    ['calendar','Dein Wochenrückblick','Sonntag ab 18 Uhr · Nachricht in der App, Push und (mit bestätigter Adresse) E-Mail'],
    ['send','Nachrichten deines Coachs','Sofort, wenn dein Coach dir schreibt'],
    ['dumbbell','Planänderungen','Sofort, wenn dein Coach deinen Plan ändert'],
    ['shield','Reparatur eingesetzt','Morgens, wenn ein vergessener Tag automatisch nachgetragen wurde'],
    ['flame','Abend-Hinweis','19–21 Uhr, wenn heute noch kein Check-in da ist']
  ];
  return `<div class="section-label">Was dir die App sonst schickt</div>
    <div class="rows mb-2">`+rows.map(([ic,t,sub])=>
      `<div class="row"><div class="r-ic">${icon(ic,22)}</div><div class="rl">${esc2(t)}<small>${esc2(sub)}</small></div></div>`).join('')
    +`</div>
    <p class="caption mb-3">Diese fünf haben keinen eigenen Schalter – sie hängen am Schalter „Push-Mitteilungen" ganz oben.</p>
    <!-- 2.9.0 Fix-Runde A-V.3: BUILD-A5 5.3 verlangt außerdem „zuletzt gesendet" und Ruhezeiten.
         Beides braucht Spalten in der Datenbank (DEFER-A5 A5-4/A5-5) und ist nach Stufe B verschoben.
         Solange es fehlt, steht das hier – eine Lücke, die man kennt, ist besser als eine, die man
         beim ersten nächtlichen Ping entdeckt. Ein Ruhezeit-Schalter im Browser wäre wirkungslos:
         die Mitteilung zeichnet der Service Worker im Auftrag des Servers. -->
    <p class="caption mb-3">Eine <b>Nachtruhe</b> lässt sich noch nicht einstellen: schreibt dir dein Coach um 2 Uhr, kommt die Mitteilung um 2 Uhr. Auch <b>„zuletzt gesendet"</b> kann die App noch nicht anzeigen – der Server merkt sich bisher nicht, was er dir schon geschickt hat.</p>`;}
// Test-Mitteilung: wird LOKAL vom Service Worker dieses Geräts gezeichnet (registration.showNotification).
// Das beweist Erlaubnis, Service Worker und Anzeige – NICHT die Zustellung vom Server. Genau das steht
// auch dort, wo der Knopf sitzt: eine Prüfung, die mehr behauptet als sie zeigt, ist wertlos.
// Fuer die echte Zustellung gibt es IPHONE-TEST.md (Paket A-V.4).
async function lpTestNotification(){
  const sub=document.getElementById('lp_testSub');
  const say=(t)=>{if(sub)sub.textContent=t;};
  const st=await pushStatus();
  if(st.state==='install'){openInstallSheet();return;}
  if(st.state!=='on'){toast('Erst Push-Mitteilungen einschalten – sonst hat der Test nichts zu zeigen.');return;}
  try{
    const reg=await navigator.serviceWorker.getRegistration('/sw.js');
    if(!reg){say('Kein Service Worker auf diesem Gerät');toast('Kein Service Worker – lade die App einmal neu');return;}
    await reg.showNotification('BE INEVITABLE',{
      body:'So sieht eine Erinnerung aus. Wenn du das hier siehst, funktioniert die Anzeige auf diesem Gerät.',
      icon:'/icon-192.png',badge:'/icon-192.png',tag:'be-test',data:{url:'/'}});
    const t=new Date();
    say('Zuletzt geprüft: heute '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0')+' · lokal auf diesem Gerät');
    toast('Test-Mitteilung gezeigt – schau auf deinen Sperrbildschirm');
  }catch(e){console.error('[lp] test',e);say('Anzeige auf diesem Gerät fehlgeschlagen');toast('Das Gerät hat die Mitteilung nicht angezeigt');}}
// Trainings-Erinnerung: Stunde als String, '' = Aus. Aus setzt push_hour über den reset-Weg auf NULL
// (PROFILE_RESETTABLE); das mitgesendete '' greift zusätzlich, falls der Server '' wie bei den Zielfeldern behandelt.
async function pfPushHour(v,btn){
  if(btn&&btn.classList.contains('dis'))return toast('Erst Push-Mitteilungen einschalten – sonst kommt die Erinnerung nicht an.');
  v=String(v==null?'':v);const cur=ME.push_hour==null?'':String(ME.push_hour);
  if(v===cur)return;const row=btn.parentElement;const off=v==='';
  const mark=(sel)=>row.querySelectorAll('.chip').forEach(c=>{const on=sel(c);c.classList.toggle('on',on);c.setAttribute('aria-pressed',String(on));});
  mark(c=>c===btn);
  const ok=await profileSave(off?{push_hour:'',reset:['push_hour']}:{push_hour:parseInt(v,10)},
    {msg:off?'Trainings-Erinnerung aus':'Erinnerung um '+v+' Uhr ✓',hub:false});
  if(!ok)mark(c=>c.dataset.v===cur);}
function pfMindHour(v,btn){
  if(btn&&btn.classList.contains('dis'))return toast('Erst Push-Mitteilungen einschalten – sonst kommt die Erinnerung nicht an.');
  btn.parentElement.querySelectorAll('.chip').forEach(c=>{const on=c===btn;c.classList.toggle('on',on);c.setAttribute('aria-pressed',String(on));});saveMindsetReminders();}
function toggleEvePush(btn){
  if(btn&&btn.classList.contains('dis'))return toast('Erst Push-Mitteilungen einschalten – sonst kommt die Erinnerung nicht an.');
  const on=!btn.classList.contains('on');btn.classList.toggle('on',on);btn.setAttribute('aria-checked',String(on));saveMindsetReminders();}
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
  t.classList.toggle('dis',st.state==='unsupported'||st.state==='blocked');
  // Alles, was ohne Push nichts bewirkt, folgt dem echten Gerätestatus (M2a): Stunden-Chips und
  // Abend-Reflexion bleiben sperrt, solange Push aus ist, und der Hinweis darüber sagt, warum.
  document.querySelectorAll('#pf_pushHour .chip,#pf_mindHour .chip').forEach(c=>c.classList.toggle('dis',!on));
  document.getElementById('p_evepush')?.classList.toggle('dis',!on);
  document.getElementById('pf_pushOff')?.classList.toggle('hidden',on);}
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
  </div>`
  +(athlete?lgPrivacyBlockHTML():'')
  +`<div class="section-label">Rechtliches</div>
  <div class="rows mb-3">
    ${lgLinkRow(LG_PRIVACY_URL,'shield','Datenschutz','Welche Daten, wozu, wer sie bekommt')}
    ${lgLinkRow(LG_IMPRINT_URL,'info','Impressum','Wer diese App betreibt')}
  </div>`);
  if(athlete)lgSupportLoad();}

// ===== A-II.4: EINWILLIGUNG, WER-SIEHT-WAS, KI-SCHALTER, HILFE-FREIGABE (Präfix lg) =====
// Alles, was mit „wer darf was von mir sehen" zu tun hat, steht an EINER Stelle: Profil →
// Daten & Verbindungen. Vorher war die Antwort darauf nirgends zu finden.

// Eine Zeile, die auf eine echte Seite führt (kein onclick): die Rechtstexte müssen auch dann
// funktionieren, wenn die App klemmt. target=_blank, damit die geöffnete App stehenbleibt.
// Kein eigenes Pfeil-Symbol: app.css setzt den Chevron über .row.tap::after – ein zweiter stünde daneben.
function lgLinkRow(href,ic,label,sub){
  return `<a class="row tap" href="${href}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">
    <div class="r-ic">${icon(ic,24)}</div><div class="rl">${label}${sub?`<small>${sub}</small>`:''}</div></a>`;}

// Untertitel der Einwilligungs-Zeile: Datum, wenn der Server es liefert – sonst der ehrliche Zustand.
function lgConsentSub(){const u=ME||{};
  // Erteilt, aber der Server verlangt eine neuere Fassung: „Erteilt am …" wäre hier eine Unwahrheit.
  if(u.consent_health_at&&typeof lgConsentMissing==='function'&&lgConsentMissing(u))return 'Neue Fassung – bitte bestätigen';
  if(u.consent_health_at)return 'Erteilt am '+fmtDate(u.consent_health_at);
  let pend=null;try{pend=localStorage.getItem('be_consent_pending');}catch(e){}
  return pend?'Auf diesem Gerät erteilt, noch nicht beim Server angekommen':'Noch nicht erteilt';}

function lgPrivacyBlockHTML(){const u=ME||{};const ai=!!Number(u.ai_consent||0);
  return `<div class="section-label">Deine Daten und wer sie sieht</div>
  <div class="rows mb-2">
    ${pfRow('lgOpenWhoSheet()','eye','Wer sieht was?','Du, dein Coach, der Betreiber – Zeile für Zeile')}
    ${pfRow('lgOpenConsentSheet()','shield','Einwilligung',esc2(lgConsentSub()))}
    ${pfRow('lgOpenSupportSheet()','help','Einblick für den Betreiber','<span id="pf_grantSub">Aus – nur mit deiner Freigabe</span>')}
  </div>
  <div class="section-label">KI-Analyse</div>
  <div class="rows">
    <div class="switch-row"><div class="r-ic">${icon('sparkles',24)}</div>
      <div class="rl">KI-Analyse durch meinen Coach erlauben<small>Standard: aus</small></div>
      <button type="button" class="tgl${ai?' on':''}" id="lg_aiTgl" role="switch" aria-checked="${ai?'true':'false'}" aria-label="KI-Analyse durch meinen Coach erlauben" onclick="lgAiToggle(this)"></button></div>
  </div>
  <p class="caption mt-2 mb-3">Eingeschaltet darf dein Coach eine Auswertung anfordern: dabei gehen Ziel, Erfahrung, Trainingstage, deine Check-in-Werte der letzten 14 Tage und deine letzten 90 Sätze an <b>Anthropic</b> (USA) – ohne deinen Namen und ohne Freitexte. Nach jeder Auswertung bekommst du eine Nachricht.</p>`;}

// --- Schalter: KI-Analyse (DECISIONS F5, Standard AUS) ---
// Eigene Route `POST /api/ai/consent` (A-II.2), NICHT PUT /api/profile: der Schalter ist eine
// Einwilligung, kein Profilfeld – er wird protokolliert und darf nicht nebenbei mitgespeichert werden.
// Wir übernehmen den Zustand aus der ANTWORT des Servers, nicht aus dem Klick: nur so steht der
// Schalter nachher auf dem, was wirklich in der Datenbank steht.
async function lgAiToggle(btn){
  const on=!btn.classList.contains('on');
  const paint=v=>{btn.classList.toggle('on',!!v);btn.setAttribute('aria-checked',String(!!v));};
  paint(on);btn.classList.add('dis');
  const r=await API.post('/ai/consent',{ai_consent:on});
  btn.classList.remove('dis');
  if(r.status===404){paint(!on);return toast('Dafür braucht der Server ein Update – bitte den Betreiber informieren.');}
  if(r.status!==200){paint(!on);return toast(r.data?.error||'Der Schalter wurde nicht geändert.');}
  const got=Number(r.data?.ai_consent||0);
  paint(got===1);if(ME)ME.ai_consent=got;
  toast(got?'KI-Analyse erlaubt ✓':'KI-Analyse aus – dein Coach bekommt keine mehr');}

// --- Unter-Sheet: Wer sieht was ---
// Die Tabelle sagt den Stand NACH dieser Welle (2.6.0): der Betreiber ist Betreiber, nicht Über-Coach.
// Sie wird bewusst hier gepflegt und nicht aus dem Server geholt – eine Tabelle, die sich selbst
// schönrechnet, wäre wertlos. Stimmt eine Zeile nicht mehr, gehört sie hier korrigiert.
// Kurze Zellen sind hier kein Stil, sondern Bedingung: auf 390 px Bildschirmbreite muss die Spalte
// „Betreiber" SICHTBAR sein – sie ist die, wegen der diese Tabelle überhaupt existiert. Eine Tabelle,
// bei der man erst seitwärts wischen muss, um die wichtigste Antwort zu sehen, beantwortet nichts.
const LG_WHO_ROWS=[
  ['Name','ja','ja','Kürzel'],
  ['E-Mail-Adresse','ja','beim Zuordnen','nur per Suche *'],
  ['Geburtsjahr, Geschlecht, Größe','ja','nein','nein'],
  ['Gewicht, Schlaf, Puls, HRV, Schritte','ja','ja','nein'],
  ['Körpermaße, Fortschrittsfotos','ja','ja','nein'],
  ['Sätze, Trainingstage, Cardio, Essen','ja','ja','nein'],
  ['Übungsnotizen, Beschwerden','ja','ja','nein'],
  ['Check-in-Freitexte','ja','nein','nein'],
  ['Mindset: Stimmung, Energie','ja','ja','nein'],
  ['Mindset: Notizen, Reflexion','ja','nein','nein'],
  ['Nachrichten mit deinem Coach','ja','ja','nein'],
  ['Apple-Health-Schlüssel','ja','nein','nein'],
  // B2: Das Passwort gehört in diese Tabelle, weil daran hängt, ob jemand IN dein Konto kommt.
  // Lesen kann es niemand (es liegt nur als Prüfsumme da). Der Coach kann dir ein neues vergeben,
  // der Betreiber seit 2.6.0 nicht mehr – er erzeugt höchstens einen Link, den du selbst einlöst.
  ['Dein Passwort','nur du','kann neues vergeben','nur Link **'],
  ['Anzahl Konten, Fehler, Laufzeiten','–','–','ja'],
  // B1: Die Zeile, die diese Tabelle ehrlich macht. Der Betreiber kann eine vollständige Kopie der
  // Datenbank ziehen – darin steht alles, was oben mit „nein" markiert ist. Ohne Sicherung gibt es
  // keine Wiederherstellung, also bleibt der Weg; verschweigen darf ihn die Tabelle trotzdem nicht.
  ['Vollständige Sicherung','–','–','ja, protokolliert']
];
function lgWhoCell(v){const t=String(v);
  const short=t==='ja'||t==='nein'||t==='–';
  const col=t==='ja'?'var(--green)':(t==='nein'||t==='–'?'var(--ink3)':'var(--ink2)');
  return `<td style="padding:8px 4px;border-bottom:.5px solid var(--line);color:${col};font-weight:${short?'600':'400'};font-size:12px;line-height:1.3;vertical-align:top">${esc2(t)}</td>`;}
function lgOpenWhoSheet(){
  const head=['Daten','Du','Coach','Betreiber'].map((h,i)=>`<th scope="col" style="text-align:left;padding:6px 4px;border-bottom:.5px solid var(--line);color:var(--ink2);font-size:10px;text-transform:uppercase;letter-spacing:.04em;${i?'':'width:44%'}">${h}</th>`).join('');
  const body=LG_WHO_ROWS.map(r=>`<tr><th scope="row" style="text-align:left;padding:8px 4px 8px 0;border-bottom:.5px solid var(--line);font-weight:500;font-size:12px;line-height:1.3;vertical-align:top">${esc2(r[0])}</th>${lgWhoCell(r[1])}${lgWhoCell(r[2])}${lgWhoCell(r[3])}</tr>`).join('');
  openSheet('Wer sieht was',`
    <p class="body mb-3">Drei Sichten: du, dein Coach und der Betreiber. Der Betreiber hält die App am Laufen –
    in der App sieht er Zahlen und Zustände, keine Gesundheitsdaten. Zwei Ausnahmen stehen unten:
    die Hilfe-Freigabe und die vollständige Sicherung.</p>
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:10px">
      <table style="border-collapse:collapse;width:100%"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </div>
    <p class="caption mb-3">* Der Betreiber findet ein Konto nur, wenn er die E-Mail-Adresse genau eingibt – eine Liste aller Adressen gibt es nicht. Jede Suche steht im Protokoll.<br>
    ** Dein Passwort kann niemand lesen – es liegt nur als Prüfsumme in der Datenbank. Kommst du nicht mehr hinein, erzeugt der Betreiber einen einmaligen Link (72 Stunden, einmal gültig); dein bisheriges Passwort bleibt gültig, bis du den Link benutzt, und das neue setzt du selbst. Dein Coach dagegen kann dir ein neues Passwort vergeben – du wirst dabei überall abgemeldet und bekommst eine Nachricht.</p>
    <div class="note mb-3">Ein Coach sieht nur <b>seine</b> Athleten. Übernimmt dich ein Coach, bekommst du eine Nachricht darüber.</div>
    <div class="note mb-3">Gibst du dem Betreiber die <b>Hilfe-Freigabe</b>, sieht er 30 Minuten lang so viel wie dein Coach – und jeder einzelne Zugriff wird protokolliert. Danach ist die Tür wieder zu.</div>
    <div class="note mb-3">Damit nach einem Ausfall nichts verloren ist, zieht der Betreiber <b>Sicherungen</b> der ganzen Datenbank – eine Datei mit allem, auch mit deinen Daten. Sie wird verschlüsselt aufbewahrt, jede Kopie steht im Protokoll, und <b>du bekommst jedes Mal eine Nachricht</b>.</div>
    ${lgLegalLinksHTML({align:'flex-start'})}`);}

// --- Unter-Sheet: Einwilligung ---
// Drei Zustände, nicht zwei: erteilt · gar nicht erteilt · erteilt, aber der Text hat sich seither
// geändert (der Server antwortet dann ebenfalls 409, `reason:'version'`). Ohne den dritten Fall zeigte
// die Karte einem solchen Konto nur „Du hast eingewilligt" und den Widerrufsknopf – eine Sackgasse:
// die App hätte weiter nichts angenommen, und der einzige Knopf hätte es schlimmer gemacht.
function lgOpenConsentSheet(){const u=ME||{};
  const stale=!!(u.consent_health_at&&typeof lgConsentMissing==='function'&&lgConsentMissing(u));
  const given=!!u.consent_health_at&&!stale;
  openSheet('Einwilligung',`
    <div class="note ${given?'ok':'warn'} mb-3">${given
      ?`Du hast am <b>${esc2(fmtDate(u.consent_health_at))}</b> eingewilligt, dass die App deine Gesundheitsdaten für deinen Plan und deine Auswertung verarbeitet${u.consent_version?` (Fassung ${esc2(u.consent_version)})`:''}.`
      :(stale
        ?`Der Text der Einwilligung hat sich geändert. Bis du die neue Fassung bestätigst, speichert die App keine neuen Gesundheitswerte.`
        :`Für deine Gesundheitsdaten liegt noch keine Einwilligung vor. Ohne sie kann die App keine neuen Werte speichern.`)}</div>
    <p class="body mb-3">Das betrifft Gewicht, Schlaf, Puls, HRV, Körpermaße, Fotos und Stimmung – nach Artikel 9 DSGVO
    besondere Daten, die es ohne dein ausdrückliches Ja nicht geben darf. Dazu deine Notizen (Check-in,
    Mindset, Reflexion), soweit sie etwas über deine Gesundheit sagen.</p>
    <div class="rows mb-3">${lgLinkRow(LG_PRIVACY_URL,'shield','Datenschutz','Der ganze Text: Zwecke, Empfänger, Fristen')}</div>
    <div class="section-label">Widerruf</div>
    <p class="body muted mb-3">Der Widerruf gilt ab sofort; was bis dahin geschah, bleibt rechtmäßig. Danach speichert
    die App keine neuen Gesundheitswerte mehr – dein Konto und dein bisheriger Verlauf bleiben, bis du sie löschst.
    Eine laufende Hilfe-Freigabe wird dabei geschlossen; die KI-Analyse ist ein eigener Schalter, den du im selben
    Schritt mit abschalten kannst.</p>
    ${given?`<button class="btn block sec" onclick="lgConsentRevokeAsk()">Einwilligung widerrufen</button>`
      :`<button class="btn block" onclick="lgConsentGrant()">${stale?'Neue Fassung bestätigen':'Einwilligung erteilen'}</button>`}
    <p class="caption mt-3">Ganz weg willst du? Profil → Konto → „Konto löschen“ entfernt alles in einem Zug.</p>`);}
// Der Weg zurück. Ohne ihn wäre der Widerruf eine Einbahnstraße: Wer einmal widerruft (oder wessen
// Konto aus der Zeit vor 2.6.0 stammt), käme nie wieder dazu, Werte einzutragen, und die App sagte
// nur noch 409. Dieselbe Route wie im Onboarding – der Server vergibt die Fassung.
async function lgConsentGrant(){
  const ok=await lgConsentSend();
  if(!ok)return toast('Das hat nicht geklappt – bitte erneut versuchen.');
  const me=await API.get('/me');if(me.status===200&&me.data&&me.data.user)ME=me.data.user;
  closeAllSheets();toast('Einwilligung erteilt ✓');refreshProfileHub();}
// Nachbesserung A-II: Der Dialog zählte nur Check-in, Maße, Fotos und Health-Import auf – und ließ
// damit die zwei Dinge ungenannt, die den Widerruf erst vollständig machen. Gemessen an einem
// Athleten mit `ai_consent=1` und offener Hilfe-Freigabe: nach dem Widerruf lief die Freigabe
// unverändert weiter, und die KI-Auswertung des Coaches kam durch die Einwilligungs-Schranke
// hindurch (nur der fehlende Schlüssel beim Betreiber stoppte die Übermittlung an Anthropic).
// Jetzt sagt der Dialog beides – und tut beides:
//   · die laufende Freigabe schließt der SERVER beim Widerruf selbst (DELETE /api/consent), sie
//     steht deshalb als Tatsache da und nicht als Häkchen, das man abwählen könnte;
//   · der KI-Schalter ist eine eigene Einwilligung (datenschutz.html Abschnitt 6: „einzeln und
//     unabhängig davon abschalten") und bleibt deshalb eine Wahl – vorbelegt mit „mit abschalten",
//     weil niemand seine Gesundheitsdaten zurückzieht und sie gleichzeitig in die USA schicken will.
// Eigenes Sheet statt confirmSheet(): confirmSheet escapt seinen Text und kennt kein Häkchen –
// und shell.js gehört einem anderen Paket.
function lgConsentRevokeAsk(){
  const ai=!!Number((ME||{}).ai_consent||0);
  const min=lgGrantMinutesLeft();
  openSheet('Einwilligung widerrufen',`
    <p class="body mb-3">Danach speichert die App <b>keine neuen Gesundheitswerte</b> mehr – Check-in, Maße,
    Fotos und der Health-Import hören auf zu funktionieren. Dein bisheriger Verlauf bleibt erhalten.</p>
    <div class="note mb-3">${min>0
      ?`Deine laufende <b>Hilfe-Freigabe</b> für den Betreiber (noch ${fmtNum(min)} Min.) wird dabei sofort geschlossen.`
      :`Eine laufende <b>Hilfe-Freigabe</b> für den Betreiber wird dabei sofort geschlossen.`}</div>
    ${ai
      ?`<label class="switch-row rows mb-3"><span class="rl">KI-Analyse ebenfalls abschalten<small>Sonst darf dein Coach weiter eine Auswertung deiner gespeicherten Werte anfordern – dabei gehen sie an Anthropic (USA)</small></span><input type="checkbox" class="rcheck" id="lg_revokeAi" checked></label>`
      :`<div class="note mb-3">Die <b>KI-Analyse</b> ist bei dir bereits aus.</div>`}
    <button class="btn block danger" onclick="lgConsentRevoke()">Ja, widerrufen</button>
    <button class="btn block sec mt-2" onclick="closeModal()">Abbrechen</button>`);}
async function lgConsentRevoke(){
  // Das Häkchen VOR dem ersten await lesen: danach kann das Sheet schon zu sein.
  const alsoAi=!!(document.getElementById('lg_revokeAi')||{}).checked;
  const r=await API.del('/consent',{});
  if(r.status===200){try{localStorage.removeItem('be_consent_pending');}catch(e){}
    // Zweiter Aufruf statt eines Feldes im Widerruf: der KI-Schalter ist eine eigene Einwilligung
    // mit eigener Route und eigenem Protokolleintrag (ai.consent.off). Scheitert er, wird das gesagt
    // – ein stiller Fehlschlag wäre genau die Lücke, wegen der diese Nachbesserung entstand.
    let aiLeft=false;
    if(alsoAi){const a=await API.post('/ai/consent',{ai_consent:false});if(a.status!==200)aiLeft=true;}
    // Die Freigabe hat der Server geschlossen. Der lokale Stand darf nicht „Läuft noch 25 Min."
    // behalten, bis das Sheet das nächste Mal nachlädt.
    if(LG_GRANT&&typeof LG_GRANT==='object'){LG_GRANT.active=null;lgSupportPaint();}
    const me=await API.get('/me');if(me.status===200&&me.data&&me.data.user)ME=me.data.user;
    closeAllSheets();
    toast(aiLeft?'Einwilligung widerrufen – die KI-Analyse blieb an, bitte im Profil prüfen'
      :(alsoAi?'Einwilligung widerrufen · KI-Analyse aus':'Einwilligung widerrufen'));
    refreshProfileHub();return;}
  if(r.status===404)return toast('Dafür braucht der Server ein Update – bitte den Betreiber informieren.');
  toast(r.data?.error||'Das hat nicht geklappt – bitte erneut versuchen.');}

// --- Unter-Sheet: Hilfe-Freigabe ---
// Der Athlet öffnet dem Betreiber die Tür, 30 Minuten, jederzeit widerrufbar, jeder Zugriff protokolliert.
// Die Routen entstehen in Paket A-II.2 (POST /api/support/grant, DELETE /api/support/revoke).
// Kennt der Server sie noch nicht (404), sagt die Oberfläche das – statt einen Knopf anzubieten,
// der nichts tut.
// Stand: {active:<Freigabe|null>, minutes:30, reasons:{bug,data,login,other}, available:bool}
// `available:false` heißt: der Server hat die Tabelle noch nicht – dann gibt es hier keinen Knopf,
// der nichts tut, sondern einen Satz, der sagt warum.
// Der Grund ist Pflicht (Server antwortet sonst 400): vier feste Auswahlmöglichkeiten, keine Freitexte.
let LG_GRANT=null;            // null = noch nicht geladen
let LG_GRANT_REASON='';       // gewählter Grund im Sheet
function lgGrantMin(){return (LG_GRANT&&+LG_GRANT.minutes>0)?+LG_GRANT.minutes:30;}
// Die Gründe kommen vom Server (SUPPORT_REASONS). Die Ersatzliste steht bewusst IN der Funktion:
// ein Objektliteral auf oberster Ebene mit dem Schlüssel `data` liest dup_check.py als zweite
// Top-Level-Deklaration von `data` – ein falscher Alarm, den man sich sparen kann.
function lgGrantReasons(){
  if(LG_GRANT&&LG_GRANT.reasons&&typeof LG_GRANT.reasons==='object')return LG_GRANT.reasons;
  const fb={};fb.bug='Fehler in der App';fb.data='Daten stimmen nicht';fb.login='Anmeldung/Konto';fb.other='Anderes';
  return fb;}
function lgGrantMinutesLeft(){const g=LG_GRANT&&LG_GRANT.active;if(!g||!g.expires_at)return 0;
  const d=_dbDate(g.expires_at);if(!d||isNaN(d))return 0;
  return Math.max(0,Math.ceil((d-new Date())/60000));}
async function lgSupportLoad(){
  const r=await API.get('/support/grant');
  LG_GRANT=r.status===200?(r.data||{}):{available:false};
  lgSupportPaint();}
function lgSupportPaint(){
  const sub=document.getElementById('pf_grantSub');
  if(sub){const min=lgGrantMinutesLeft();
    sub.textContent=(LG_GRANT&&LG_GRANT.available===false)?'In dieser Fassung noch nicht verfügbar'
      :(min>0?`Läuft noch ${fmtNum(min)} Min.`:'Aus – nur mit deiner Freigabe');}
  const box=document.getElementById('lg_grantBox');
  if(box)box.innerHTML=lgSupportBodyHTML();}
function lgSupportBodyHTML(){
  if(LG_GRANT===null)return `<div class="spinner"></div>`;
  if(LG_GRANT.available===false)return `<div class="note warn">Diese Fassung des Servers kennt die Hilfe-Freigabe noch nicht. Bis dahin kommt der Betreiber nicht an deine Gesundheitsdaten – auch nicht auf Nachfrage.</div>`;
  const min=lgGrantMinutesLeft(),R=lgGrantReasons();
  if(min>0){const g=LG_GRANT.active||{};
    return `<div class="note ok mb-3">Der Betreiber hat gerade Einblick – noch <b>${fmtNum(min)} Minuten</b>${g.reason&&R[g.reason]?` (Grund: ${esc2(R[g.reason])})`:''}. Danach schließt sich die Tür von selbst.</div>
      <button class="btn block danger" onclick="lgSupportRevoke()">Freigabe sofort zurücknehmen</button>`;}
  return `<div class="note mb-3">Gerade hat der Betreiber <b>keinen</b> Einblick in deine Daten.</div>
    <div class="section-label">Worum geht es?</div>
    <div class="chip-row wrap mb-3" id="lg_grantReasons">${Object.keys(R).map(k=>
      `<button type="button" class="chip${LG_GRANT_REASON===k?' on':''}" data-v="${esc2(k)}" onclick="lgGrantPickReason('${esc(k)}')">${esc2(R[k])}</button>`).join('')}</div>
    <button class="btn block sec" onclick="lgSupportGrant()">Betreiber für ${fmtNum(lgGrantMin())} Minuten Einblick geben</button>
    <div id="lg_grantErr" class="hidden" style="color:var(--red-text);font-size:13px;margin-top:8px" role="alert"></div>`;}
function lgGrantPickReason(k){LG_GRANT_REASON=String(k||'');
  document.querySelectorAll('#lg_grantReasons .chip').forEach(c=>c.classList.toggle('on',c.dataset.v===LG_GRANT_REASON));
  document.getElementById('lg_grantErr')?.classList.add('hidden');}
function lgOpenSupportSheet(){
  if(LG_GRANT===null)lgSupportLoad();
  openSheet('Einblick für den Betreiber',`
    <p class="body mb-3">Wenn etwas klemmt und nur der Betreiber es lösen kann, kannst du ihm hier für
    <b>${fmtNum(lgGrantMin())} Minuten</b> Einblick geben – er sieht dann so viel wie dein Coach.</p>
    <div class="rows mb-3">
      <div class="row"><div class="r-ic num">1</div><div class="rl">Die Freigabe läuft von selbst ab<small>Nach ${fmtNum(lgGrantMin())} Minuten ist sie weg, ohne dass du etwas tun musst</small></div></div>
      <div class="row"><div class="r-ic num">2</div><div class="rl">Du kannst sie jederzeit sofort beenden<small>Ein Tipp auf „Zurücknehmen“ genügt</small></div></div>
      <div class="row"><div class="r-ic num">3</div><div class="rl">Jeder Zugriff wird protokolliert<small>Was der Betreiber in dieser Zeit ansieht, steht im Protokoll</small></div></div>
    </div>
    <div id="lg_grantBox">${lgSupportBodyHTML()}</div>
    <p class="caption mt-3">Ohne diese Freigabe sieht der Betreiber deine Gesundheitsdaten in der App nicht – es gibt keinen „als Nutzer anmelden“-Knopf, und dein <b>Passwort</b> kann er weder lesen noch setzen. Kommst du nicht mehr in dein Konto, erzeugt er dafür nur einen einmaligen Link; das neue Passwort setzt du selbst, und du bekommst darüber sofort eine Nachricht. Was es daneben gibt: die vollständige <b>Sicherung</b> der Datenbank für den Notfall – darüber bekommst du jedes Mal eine Nachricht.</p>`);}
async function lgSupportGrant(){
  if(!LG_GRANT_REASON){const e=document.getElementById('lg_grantErr');
    if(e){e.textContent='Bitte sag kurz, worum es geht – das steht später im Protokoll.';e.classList.remove('hidden');}
    return;}
  const r=await API.post('/support/grant',{reason:LG_GRANT_REASON});
  if(r.status===200){LG_GRANT=Object.assign({},LG_GRANT,{active:r.data&&r.data.grant?r.data.grant:null,available:true});
    lgSupportPaint();toast(`Einblick für ${fmtNum(lgGrantMin())} Minuten freigegeben`);refreshProfileHub();return;}
  if(r.status===404)return toast('Dafür braucht der Server ein Update – bitte den Betreiber informieren.');
  toast(r.data?.error||'Das hat nicht geklappt – bitte erneut versuchen.');}
async function lgSupportRevoke(){
  const r=await API.del('/support/grant',{});
  if(r.status===200){LG_GRANT=Object.assign({},LG_GRANT,{active:null});LG_GRANT_REASON='';
    lgSupportPaint();toast('Freigabe zurückgenommen');refreshProfileHub();return;}
  if(r.status===404)return toast('Dafür braucht der Server ein Update – bitte den Betreiber informieren.');
  toast(r.data?.error||'Das hat nicht geklappt – bitte erneut versuchen.');}
// A-V.3 (2.9.0): Dieses Sheet IST der Installations-Trichter aus BUILD-A5 5.1 – die „ruhige Karte
// mit drei Bildern". Es gibt nur diesen einen Ort dafür (CRITIC K1): home.js öffnet ihn einmal, wenn
// das erste Training abgeschlossen ist und die App nicht als PWA läuft (maybeShowInstallHint), das Profil
// öffnet ihn jederzeit über „Als App installieren", und auf iOS führt auch der Push-Schalter
// hierher – Web-Push gibt es dort nur für die installierte App.
// Die drei Bilder kommen aus home.js (lpStepsHTML) und sind reine Inline-SVG: kein Netzabruf, im
// Flugmodus da, in beiden Farbschemata lesbar.
function openInstallSheet(){let h;
  const bilder=(typeof lpStepsHTML==='function')?lpStepsHTML():'';
  const anderer=(typeof lpOtherWayText==='function')?esc2(lpOtherWayText()):'';
  if(isStandalone())h=`<div class="note ok mb-4">BE INEVITABLE läuft auf diesem Gerät bereits als App.</div>`;
  else if(isIOS())h=`<p class="body mb-2">Ohne Browserleiste, offline nutzbar – und nur so kann die App dich überhaupt erinnern. Drei Schritte in Safari:</p>
    ${bilder}
    <div class="rows mb-3">
      <div class="row"><div class="r-ic num">1</div><div class="rl">In Safari auf <b>Teilen</b> tippen<small>Das Quadrat mit dem Pfeil nach oben, unten in der Leiste</small></div></div>
      <div class="row"><div class="r-ic num">2</div><div class="rl"><b>„Zum Home-Bildschirm"</b> wählen<small>Etwas weiter unten in der Liste</small></div></div>
      <div class="row"><div class="r-ic num">3</div><div class="rl">Oben rechts <b>Hinzufügen</b><small>Danach die App vom Home-Bildschirm starten</small></div></div>
    </div>
    <p class="caption mb-4">${anderer}</p>`;
  // 2.9.0 Fix-Runde A-V.3: Der Satz „nur so kann die App dich überhaupt erinnern" gilt NUR auf iOS.
  // Android und Chrome am Rechner können Web-Push auch ohne Installation. Bis die Zeile unter dem
  // Kopf auf allen Plattformen erschien, hat diesen Absatz praktisch niemand ausserhalb von iOS
  // gesehen – jetzt schon, und dann darf er nicht das Falsche behaupten.
  else if(/android/i.test(navigator.userAgent))h=`<p class="body mb-2">Ohne Browserleiste, offline nutzbar, eigenes Symbol auf dem Startbildschirm. So geht es:</p>
    ${bilder}
    <div class="rows mb-3">
      <div class="row"><div class="r-ic num">1</div><div class="rl">Browser-Menü öffnen<small>Die drei Punkte oben rechts</small></div></div>
      <div class="row"><div class="r-ic num">2</div><div class="rl"><b>„App installieren"</b> oder <b>„Zum Startbildschirm"</b><small>Danach die App vom Startbildschirm öffnen</small></div></div>
    </div>
    <p class="caption mb-4">${anderer}</p>`;
  else h=`<p class="body mb-2">Ohne Browserleiste und als eigenes Fenster – so geht es am Rechner:</p>
    ${bilder}
    <p class="caption mb-4">${anderer}</p>`;
  // Der Titel folgt der Plattform: einen „Startbildschirm" gibt es am Rechner nicht, und seit der
  // Fix-Runde führt die Zeile unter dem Kopf auch dort hierher.
  const titel=(!isStandalone()&&!isIOS()&&!/android/i.test(navigator.userAgent))
    ?'Als App installieren':'Auf den Startbildschirm legen';
  openSheet(titel,h+`<button class="btn block sec" onclick="closeModal()">${isStandalone()?'Alles klar':'Später'}</button>`);}
// --- Unter-Sheet: Konto ---
function openAccountSheet(){const u=ME;const verified=!!u.email_verified;
  openSheet('Konto',`<div class="rows mt-2 mb-3">
    <div class="row"><div class="r-ic">${icon('mail',24)}</div><div class="rl">E-Mail<small>${esc2(u.email||'–')}</small></div><div class="rr">${u.email?(verified?'<span class="pill green">Bestätigt</span>':'<span class="pill amber">Unbestätigt</span>'):''}</div></div>
    ${u.email&&!verified?pfRow('resendVerify()','send','E-Mail bestätigen','Bestätigungs-Mail erneut senden'):''}
    ${pfRow('openChangePw()','lock','Passwort ändern','')}
  </div>
  ${u.email&&!verified?`<div class="note warn mb-3">Ohne bestätigte E-Mail funktionieren Passwort-Reset und Mails nicht. Schau auch im Spam-Ordner nach.</div>`:''}
  <div class="section-label">Sitzungen</div>
  <div class="rows mb-2">
    ${pfRow('confirmLogoutAll()','devices','Alle Geräte abmelden','Andere Handys, Tablets und Browser rauswerfen – hier bleibst du angemeldet')}
    ${pfRow('logout()','logOut','<span class="tone-red">Abmelden</span>','Nur dieses Gerät')}
  </div>
  <p class="caption mb-4">Auf einem geteilten Gerät (Familien-Tablet, Studio-PC): erst „Alle Geräte abmelden", dann „Abmelden" – so bleibt nirgends etwas von dir zurück.</p>
  ${u.role==='admin'
    ?`<p class="caption mb-3">Admin-Konten lassen sich nur über die Verwaltung löschen.</p>`
    :`<div class="danger-block"><div class="h3 mb-1">Konto löschen</div><div class="meta mb-3">Löscht dein Konto mit allen Daten – endgültig. Dein Coach behält nichts von dir.</div>
      <button class="btn danger block" onclick="openDeleteAccount()">${icon('trash',18)} Konto löschen …</button></div>`}
  <div class="section-label">Rechtliches</div>
  <div class="rows mb-2">
    ${lgLinkRow(LG_PRIVACY_URL,'shield','Datenschutz','Welche Daten, wozu, wer sie bekommt')}
    ${lgLinkRow(LG_IMPRINT_URL,'info','Impressum','Wer diese App betreibt')}
  </div>
  <div class="pf-version">Version ${esc2(APP_VERSION)}</div>`);}
// „Alle Geräte abmelden": kurze Rückfrage, damit niemand aus Versehen das Tablet der Familie rauswirft.
function confirmLogoutAll(){confirmSheet('Alle Geräte abmelden','Jedes andere Gerät, auf dem du angemeldet bist, muss sich danach neu anmelden. Dieses Gerät bleibt angemeldet.',{label:'Alle anderen abmelden',danger:false,onYes:()=>logoutAll()});}
// --- Konto selbst löschen (V4): Passwort + zweistufige Rückfrage, dann DELETE /api/me ---
// Stufe 1 sagt, WAS weg ist, und bietet vorher den Export an. Stufe 2 ist die eigentliche, letzte Rückfrage.
function openDeleteAccount(){
  openSheet('Konto löschen',`<form id="delForm" onsubmit="deleteAccountStep2();return false" novalidate>
    <div class="note err mb-3"><b>Das ist endgültig.</b> Gelöscht werden dein Konto und ALLES darin: Trainingsplan und Sätze, Check-ins, Körpermaße, Fotos, Ernährungsprotokoll und Rezepte, Nachrichten, Mindset-Einträge, Gesundheitsdaten und Push-Abos. Es gibt keine Wiederherstellung – auch nicht durch den Betreiber.</div>
    <p class="body muted mb-3">Willst du deine Daten vorher behalten? Der Export enthält alles als eine Datei.</p>
    <button class="btn block sec mb-4" type="button" onclick="exportMyData()">${icon('download',18)} Erst meine Daten exportieren</button>
    ${pwField({id:'del_pw',label:'Zur Bestätigung dein Passwort',autocomplete:'current-password',enterkeyhint:'done'})}
    <button class="btn block danger" type="submit">Weiter zur letzten Rückfrage</button>
    <button class="btn block sec mt-2" type="button" onclick="closeModal()">Abbrechen</button></form>`);
  setTimeout(()=>document.getElementById('del_pw')?.focus({preventScroll:true}),380);}
// Das Passwort wandert für die Dauer der zweiten Rückfrage in eine Variable (nie in den Speicher des Geräts):
// das Feld liegt nach dem Sheet-Wechsel nur noch als HTML im Stapel, sein Wert nicht. „Nein, zurück" leert sie.
let _DEL_PW='';
function deleteAccountStep2(){const pw=val('del_pw');
  if(!pw)return showFieldErr('delForm','Bitte dein Passwort eingeben.','del_pw');
  _DEL_PW=pw;
  openSheet('Wirklich löschen?',`<div class="body mb-4">Letzte Frage: Dein Konto <b>${esc2(ME?.email||'')}</b> und alle Daten werden jetzt unwiderruflich gelöscht.</div>
    <button class="btn block danger" id="delGo" onclick="doDeleteAccount()">Ja, mein Konto endgültig löschen</button>
    <button class="btn block sec mt-2" onclick="_DEL_PW='';closeModal()">Nein, zurück</button>`);}
async function doDeleteAccount(){
  const pw=_DEL_PW;_DEL_PW='';
  const btn=document.getElementById('delGo');if(btn){btn.disabled=true;btn.textContent='Wird gelöscht …';}
  const r=await API.del('/me',{password:pw},{raw:true});
  if(raw401(r))return;
  if(r.status===200){
    // Der Server hat das Cookie gelöscht. Hier alles vom Konto vom Gerät räumen – auch die Outbox, es gibt
    // kein Konto mehr, an das sie gesendet werden könnte.
    const uid=ME&&ME.id;ME=null;
    try{clearAccountStorage(uid);}catch(e){}
    try{sessionStorage.setItem('be_relogin','Dein Konto wurde gelöscht. Danke, dass du dabei warst.');}catch(e){}
    location.reload();return;}
  if(btn){btn.disabled=false;btn.textContent='Ja, mein Konto endgültig löschen';}
  if(r.status===404)return toast('Dafür braucht der Server ein Update – bitte den Betreiber informieren.');
  // Falsches Passwort: zurück zur ersten Stufe, Meldung am Feld (das Feld ist nach dem Rücksprung leer)
  if(r.status===401){closeModal();setTimeout(()=>showFieldErr('delForm',r.data?.error||'Passwort falsch.','del_pw'),50);return;}
  toast(r.data?.error||'Löschen fehlgeschlagen – bitte erneut versuchen.');}
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
    ${pwField({id:'pw_cur',label:'Aktuelles Passwort',autocomplete:'current-password',enterkeyhint:'next'})}
    ${pwField({id:'pw_new',label:'Neues Passwort',autocomplete:'new-password',placeholder:'mind. 8 Zeichen',enterkeyhint:'next',hint:true})}
    ${pwField({id:'pw_new2',label:'Neues Passwort wiederholen',autocomplete:'new-password',enterkeyhint:'done'})}
    <p class="caption mb-3">Nach dem Wechsel werden alle anderen Geräte abgemeldet – dieses hier bleibt angemeldet.</p>
    <button class="btn block" type="submit">Passwort speichern</button></form>`);
  setTimeout(()=>document.getElementById('pw_cur')?.focus({preventScroll:true}),380);}
async function saveNewPw(){const cur=val('pw_cur'),n1=val('pw_new'),n2=val('pw_new2');
  if(!cur)return showFieldErr('pwForm','Bitte dein aktuelles Passwort eingeben.','pw_cur');
  if(n1.length<8)return showFieldErr('pwForm','Mindestens 8 Zeichen.','pw_new');
  if(n1!==n2)return showFieldErr('pwForm','Die Passwörter stimmen nicht überein.','pw_new2');
  const btn=document.querySelector('#pwForm .btn');if(btn)btn.disabled=true;
  // raw: der Server meldet ein falsches aktuelles Passwort mit 401 – das ist keine verlorene Sitzung.
  // Nach 200 hat DIESES Gerät in derselben Antwort ein frisches Cookie bekommen (V1): kein Neu-Anmelden hier,
  // nur die anderen Geräte fliegen raus.
  const r=await API.post('/password',{current:cur,next:n1},{raw:true});
  if(raw401(r))return;
  if(r.status===200){closeModal();toast('Passwort geändert ✓ – andere Geräte müssen sich neu anmelden.');return;}
  if(btn)btn.disabled=false;
  if(!r.status)return showFieldErr('pwForm',r.data?.error||'Keine Verbindung. Ist der Server erreichbar?','pw_cur');
  showFieldErr('pwForm',r.data?.error||'Fehler',r.status===401?'pw_cur':'pw_new');}

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
        days.map(dd=>`<div class="row tap" role="button" tabindex="0" onclick="acceptShare('${esc(tok)}',${+dd.id})"><div class="r-ic">${icon('dumbbell',24)}</div><div class="rl">${esc2(dd.name)}${Array.isArray(dd.exercises)?`<small>${pl(dd.exercises.length,'Übung','Übungen')}</small>`:''}</div></div>`).join('')+`</div>`:
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

// ===== APPLE HEALTH =====
// openAppleHealth/importShortcutText/showImportPreview stehen NUR hier – analysis.js hat keine
// gleichnamigen Definitionen mehr (2.7.0 geprüft). Was dort liegt und deshalb nachgeladen werden muss:
// parseShortcutData, handleHealthFile, doHealthImport – siehe bootHealth*() weiter unten.
// Eingabe zuerst, die einmalige Einrichtung eingeklappt; Status als .note.status (nie ausblendbar); Plural über pl().
// Zwei Wege in EINEM Sheet: oben die automatische Übertragung (Kurzbefehl + Automation),
// unten der Weg von Hand. Der Schlüssel kommt von GET /api/health/link.
let _HL=null; // zuletzt geladener Stand des persönlichen Links
async function openAppleHealth(){openSheet('Apple Health','<div class="spinner"></div>');
  const r=await API.get('/health/link');_HL=r.status===200?r.data:{enabled:false};
  drawAppleHealth();}
function drawAppleHealth(){const h=_HL||{enabled:false};
  const last=h.last?fmtDateTime(h.last):null;
  openSheet('Apple Health',`
  ${h.enabled?`
    <div class="note ok mb-3">${icon('check',16)} Automatische Übertragung ist eingerichtet.${last?` Zuletzt: <b>${esc2(last)}</b>.`:' Noch nichts angekommen – starte den Kurzbefehl einmal von Hand.'}</div>
    <div class="section-label">Dein persönlicher Link<span class="sl-r">nur für dich</span></div>
    <div class="card sub sh-link" id="hlUrl">${esc2(h.url||'')}</div>
    <div class="cluster mt-2">
      <button class="btn sm" onclick="copyHealthLink()">${icon('copy',16)} Link kopieren</button>
      <button class="btn sm sec" onclick="rotateHealthLink()">${icon('refresh',16)} Neu erzeugen</button>
      <button class="btn sm ghost tone-red" onclick="disableHealthLink()">Abschalten</button>
    </div>
    <div class="caption mt-2">Der Link darf ausschließlich Gesundheitswerte schreiben – kein Login, keine Einsicht in deine Daten. Trotzdem: nicht weitergeben. „Neu erzeugen" macht den alten sofort ungültig.</div>
    ${_shortcutSteps()}
  `:`
    <div class="note mb-3">Dein iPhone kann Schlaf, Schritte, Verbrauch und Trainings jede Nacht von selbst herüberschicken – über einen Kurzbefehl, ganz ohne dich.</div>
    <button class="btn block" onclick="enableHealthLink()">${icon('zap',18)} Automatische Übertragung einrichten</button>
    <div class="caption mt-2">Du bekommst einen persönlichen Link und eine Schritt-für-Schritt-Anleitung. Dauert einmalig etwa 10 Minuten.</div>
  `}
  <div class="section-label mt-4">Von Hand übertragen</div>
  <div class="field"><label for="sc_text">Werte aus dem Kurzbefehl einfügen</label><textarea id="sc_text" rows="3" placeholder='{"days":{"2026-06-01":{"weight":75.5,"steps":8200,"sleep":7.5}}}'></textarea></div>
  <button class="btn block sec" onclick="importShortcutText()">Übernehmen</button>
  <input type="file" id="health_file" accept=".json,.txt,.xml,application/json,text/plain,text/xml" class="hidden" onchange="bootHealthFile(this)">
  <button class="btn block ghost mt-2" onclick="document.getElementById('health_file').click()">${icon('upload',18)} Datei hochladen (JSON oder Export.xml)</button>
  <div id="health_status" class="mt-3"></div>`);}
// Die Anleitung steht bewusst im Sheet und nicht nur in der Doku: hier braucht man sie.
function _shortcutSteps(){return `
  <details class="pf-details mt-3" open><summary>Kurzbefehl einrichten (einmalig, ca. 10 Min.)</summary>
    <div class="card sub body pf-steps">
      1. <b>Kurzbefehle</b>-App öffnen → <b>+</b> (neuer Kurzbefehl).<br>
      2. Aktion <b>„Gesundheitsdaten suchen"</b> hinzufügen, Typ <b>Schlafanalyse</b>, Zeitraum <b>heute</b>, danach <b>„Statistik berechnen" → Summe</b>. Ergebnis merken (Variable umbenennen in <b>sleep</b>, in Stunden: durch 60 teilen).<br>
      3. Dasselbe für <b>Schritte</b> (Summe → <b>steps</b>), <b>Aktive Energie</b> (Summe → <b>active_kcal</b>), <b>Trainingsminuten</b> (Summe → <b>exercise_min</b>), <b>Ruhepuls</b> (Durchschnitt → <b>resting_hr</b>), <b>Herzfrequenzvariabilität</b> (Durchschnitt → <b>hrv</b>) und <b>Gewicht</b> (letzter Wert → <b>weight</b>).<br>
      4. Aktion <b>„Wörterbuch"</b> anlegen mit genau diesen Schlüsseln:<br>
      <code class="sh-code">sleep · steps · active_kcal · exercise_min · resting_hr · hrv · weight</code><br>
      <b>hrv</b> nicht weglassen – die Herzfrequenzvariabilität ist ein Viertel deiner Bereitschaft.<br>
      Werte = die Variablen aus 2./3. Was du nicht hast, lässt du einfach weg.<br>
      5. Aktion <b>„Inhalte von URL abrufen"</b>: URL = <b>dein Link von oben</b>, Methode <b>POST</b>, Anfragetext <b>JSON</b>, Inhalt = das Wörterbuch aus 4.<br>
      6. Kurzbefehl sichern, z.B. als „BE INEVITABLE Sync", und einmal starten – oben sollte danach „Zuletzt" stehen.
    </div></details>
  <details class="pf-details mt-2"><summary>Jede Nacht von selbst (Automation)</summary>
    <div class="card sub body pf-steps">
      Kurzbefehle-App → Reiter <b>Automation</b> → <b>+</b> → <b>Tageszeit</b> → z.B. <b>23:50</b>, täglich →
      Kurzbefehl <b>„BE INEVITABLE Sync"</b> wählen → <b>„Sofort ausführen"</b> einschalten und <b>„Vor dem Ausführen fragen"</b> ausschalten.<br><br>
      Danach passiert es von allein. Ohne Datum im Wörterbuch zählt der Tag, an dem gesendet wird.
    </div></details>
  <details class="pf-details mt-2"><summary>Trainings mitschicken (optional)</summary>
    <div class="card sub body pf-steps">
      Wer auch seine Einheiten übernehmen will, ergänzt im Kurzbefehl die Aktion <b>„Trainings suchen"</b> (Zeitraum heute) und schickt zusätzlich den Schlüssel <b>workouts</b> als Liste:<br>
      <code class="sh-code">{"workouts":[{"date":"2026-09-08","kind":"Laufen","minutes":38,"kcal":410,"id":"…"}]}</code><br>
      Das Feld <b>id</b> (die Trainings-UUID) sorgt dafür, dass dieselbe Einheit nie zweimal ankommt. Die Einheiten erscheinen unter <b>Training → Cardio</b>.
    </div></details>`;}
async function enableHealthLink(){const r=await API.post('/health/link',{});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  _HL=r.data;drawAppleHealth();toast('Link erstellt ✓');}
async function rotateHealthLink(){confirmSheet('Link neu erzeugen','Der alte Link hört sofort auf zu funktionieren. Du musst ihn danach im Kurzbefehl ersetzen.',{label:'Neu erzeugen',danger:false,onYes:async()=>{
  const r=await API.post('/health/link',{});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  _HL=r.data;drawAppleHealth();toast('Neuer Link erzeugt ✓');}});}
async function disableHealthLink(){confirmSheet('Übertragung abschalten','Dein iPhone kann danach nichts mehr schicken. Bereits übertragene Werte bleiben erhalten.',{label:'Abschalten',danger:true,onYes:async()=>{
  const r=await API.del('/health/link');
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  _HL={enabled:false};drawAppleHealth();toast('Automatische Übertragung aus');}});}
async function copyHealthLink(){const url=_HL?.url;if(!url)return;
  try{await navigator.clipboard.writeText(url);toast('Link kopiert ✓ – im Kurzbefehl bei „Inhalte von URL abrufen" einsetzen');}
  catch(e){const el=document.getElementById('hlUrl');if(el){const r=document.createRange();r.selectNodeContents(el);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);}
    toast('Markiert – bitte von Hand kopieren');}}

// Text aus dem Kurzbefehl (oder per Hand) einlesen – tolerant gegenüber kleinen Formatfehlern (Parser: analysis.js)
async function importShortcutText(){const raw=val('sc_text');const st=document.getElementById('health_status');
  if(!raw)return showFieldErr(null,'Bitte zuerst die Werte einfügen.','sc_text');
  clearFieldErr('sc_text'); // alte Inline-Meldung entfernen, sobald wieder Text da ist
  // parseShortcutData liegt in analysis.js (nachgeladen). Fehlte es, log die alte Fassung dem Nutzer
  // etwas vor: „konnte ich nicht lesen" – obwohl an seinen Daten nichts falsch war.
  if(typeof parseShortcutData!=='function'&&window.bootLoad){
    if(st)st.innerHTML='<div class="spinner"></div>';
    try{await window.bootLoad('analysis');}catch(e){}
  }
  if(typeof parseShortcutData!=='function'){
    if(st)st.innerHTML='<div class="note err">Dieser Teil der App ist gerade nicht geladen. Prüfe deine Verbindung und versuche es noch einmal.</div>';
    return;}
  const days=parseShortcutData(raw);
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
    <button class="btn block" onclick='bootHealthImport(${JSON.stringify(days).replace(/'/g,"&#39;")})'>${pl(dc,'Tag','Tage')} importieren</button>`;}

// ---- Brücke zu analysis.js (A-III.3, 2.7.0) ---------------------------------------------------
// parseShortcutData, handleHealthFile und doHealthImport wohnen in analysis.js – seit dem Bündel-Umbau
// ein NACHGELADENES Modul. Zwischen „angemeldet" und „Nachlauf durch" liegt ein gemessenes Fenster von
// rund 1,5 s (ohne Drossel wie auf Slow-4G), in dem sie schlicht fehlen. Ohne Riegel passierte dann
// gar nichts: Sheet offen, Datei gewählt, kein Toast, kein Status – der Import tat stumm nichts.
// Dieselbe Form wie an den über 20 anderen Übergängen, plus Nachholen: window.bootCall lädt das Modul und
// sagt von sich aus Bescheid, wenn es nicht kommt. bootLoad/bootCall stehen im Nachlade-Lader am Ende
// von /app.js; fehlen sie (Notbetrieb, alter Cache), bleibt es beim typeof-Riegel.
function bootHealthFile(el){
  // Nicht das Event weiterreichen, sondern die Eingabe selbst: nach dem Nachladen ist das Event-Objekt
  // vielleicht schon recycelt, el.files aber steht noch. handleHealthFile liest genau ev.target.files[0].
  const ev={target:el};
  if(typeof handleHealthFile==='function')return handleHealthFile(ev);
  const st=document.getElementById('health_status');
  if(st)st.innerHTML='<div class="spinner"></div><div class="caption center">Einen Moment – der Teil der App wird noch geladen …</div>';
  if(window.bootCall)return window.bootCall('analysis','handleHealthFile',ev);
  if(st)st.innerHTML='<div class="note err">Dieser Teil der App ist gerade nicht geladen. Prüfe deine Verbindung und versuche es noch einmal.</div>';
}
function bootHealthImport(days){
  if(typeof doHealthImport==='function')return doHealthImport(days);
  const st=document.getElementById('health_status');
  if(st)st.innerHTML='<div class="spinner"></div>';
  if(window.bootCall)return window.bootCall('analysis','doHealthImport',days);
  if(st)st.innerHTML='<div class="note err">Dieser Teil der App ist gerade nicht geladen. Prüfe deine Verbindung und versuche es noch einmal.</div>';
}

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
// Installhinweis: Safari zeigt keinen automatischen „Installieren"-Prompt, und auf Android/Desktop
// zeigt ihn der Browser höchstens versteckt im Menü. Eine schmale, schließbare Zeile unter dem Header
// (nicht als Balken über den Ringen).
// A-V.3 (CRITIC K7): NICHT BEIM ERSTEN START. Bis 2.8.0 erschien diese Zeile 1,6 s nach dem
// allerersten Öffnen – also bevor jemand einen Grund hatte, die App auf seinem Startbildschirm zu
// wollen. Es gilt dieselbe Bedingung wie für den Rest des Trichters: erst nach dem ersten
// abgeschlossenen Training, und 30 Tage Ruhe nach einem „Später".
// 2.9.0 Fix-Runde A-V.3, zwei nachgewiesene Fehler:
//   (1) `be_ios_install_dismissed` schloss den Trichter FÜR IMMER. Gemessen: nach einem „X" stand
//       be_ios_install_dismissed="1" neben dem Zeitstempel; 31 Tage vorgespult sagte lpInstallDue()
//       true, die Zeile kam trotzdem nicht. Jetzt entscheidet NUR lpInstallDue() – die 30 Tage
//       rechnet es selbst (CRITIC K1: eine Bedingung, ein Ort). Der alte Dauer-Schlüssel wird beim
//       ersten Lauf in einen Zeitstempel überführt und gelöscht, damit ein Bestandskonto seine
//       Ablehnung nicht verliert, sie aber auch nicht ewig behält.
//   (2) `if(!isIOS())return;` sperrte Android und den Rechner komplett aus – gemessen: mit Desktop-UA
//       war lpInstallDue() true und das Wort „Startbildschirm" stand nirgends auf der Seite. Der
//       einzige Weg war Profil → Daten. lpStepsHTML()/openInstallSheet() kennen alle drei Wege
//       längst; die Zeile sagt jetzt je Plattform, was sie einbringt (Web-Push ohne installierte App
//       gibt es nur auf iOS nicht – anderswo wäre dieser Satz unwahr).
// Die Zeile hängt VOR #views, zählt also nicht in das Höhenbudget der Startseite (accent.mjs).
function lpInstallOldKeyMigrate(){
  // Einmalig: alter Dauer-Merker -> Zeitstempel unter LP_INSTALL_KEY (30 Tage ab jetzt), dann weg.
  try{
    if(!localStorage.getItem('be_ios_install_dismissed'))return;
    if(typeof LP_INSTALL_KEY==='undefined')return;        // home.js fehlt: lieber nichts anfassen
    if(!localStorage.getItem(LP_INSTALL_KEY))localStorage.setItem(LP_INSTALL_KEY,String(Date.now()));
    localStorage.removeItem('be_ios_install_dismissed');
  }catch(e){}
}
// Welche Ansicht steht gerade? (Dieselbe Quelle wie maybeStartTour: der aktive Tab in der Leiste.)
function lpInstallViewNow(){try{return (document.querySelector('.navbtn.on')||{}).dataset?.p||'';}catch(e){return '';}}
// Der Tabwechsel ist der Anlass, an dem die Zeile kommen oder gehen kann. EIN Zuhörer am Dokument,
// einmal gesetzt – kein Timer, der im Hintergrund läuft.
let LP_HINT_NAV=false;
function lpInstallArmNav(){
  if(LP_HINT_NAV)return;LP_HINT_NAV=true;
  try{document.addEventListener('click',function(e){
    const t=e.target;if(!t||!t.closest||!t.closest('.nav'))return;
    setTimeout(maybeShowInstallHint,450);},true);}catch(e){}}
function maybeShowInstallHint(){
  try{
    if(isStandalone())return;                             // läuft schon als installierte App
    // Der Trichter entscheidet, nicht die Uhr: lpInstallDue() prüft eigenes Athleten-Konto, erstes
    // Training abgeschlossen und die 30-Tage-Ruhe. Fehlt home.js (Teilbündel), bleibt der Hinweis weg.
    if(typeof lpInstallDue!=='function'||typeof homeState!=='function')return;
    lpInstallOldKeyMigrate();
    // NICHT auf der Startseite – und das ist eine Messung, kein Geschmack:
    // Die Startseite ist die einzige Ansicht mit einem Höhenbudget (BUILD-A4: < 1.000 px,
    // tools/accent.mjs prüft nur sie). Gemessen auf der Referenzdatenbank: ohne die Zeile 981 px,
    // MIT ihr 1.064 px – accent ROT. Der Prüfer, der die iOS-Sperre beanstandet hat, nahm an, die
    // Zeile hänge „ausserhalb des Home-Höhenbudgets"; sie hängt zwar vor #views, aber accent misst
    // document.scrollHeight, und der zählt sie mit. Nebenbei behebt das einen Bruch, den bis eben
    // niemand sah: accent misst mit Desktop-Browserkennung, auf dem iPhone stand die Startseite
    // durch genau diese Zeile seit 2.9.0 bei 1.064 px.
    // Auf allen anderen Tabs (Training, Ernährung, Mindset, Analyse) steht die Zeile – dort gibt es
    // kein Höhenbudget, und genau dort wird trainiert und eingetragen.
    if(lpInstallViewNow()==='home'){
      const alt=document.getElementById('iosInstallHint');if(alt)alt.remove();
      lpInstallArmNav();return;}
    lpInstallArmNav();
    let due=false;try{due=lpInstallDue(homeState());}catch(e){due=false;}
    if(!due)return;
    if(document.getElementById('iosInstallHint'))return;
    if(document.body.classList.contains('tour-active'))return; // nicht während der Einführungs-Tour
    const bar=document.createElement('div');bar.id='iosInstallHint';bar.className='note install-hint';
    // A-V.3: Die ganze Zeile führt in den Trichter (drei Bilder + drei Schritte), nicht nur das Wort
    // „Anleitung" – ein 13-px-Link war die einzige Tuer zu dem, was auf dem iPhone über Erinnerungen
    // entscheidet. Der Grund steht dabei, und er stimmt je Plattform.
    const txt=isIOS()
      ?'Auf den Startbildschirm legen – nur so kann die App dich erinnern.'
      :'Als App installieren – eigenes Fenster, schnellerer Start, Erinnerungen.';
    bar.innerHTML=`<button type="button" class="fill" style="all:unset;flex:1;cursor:pointer;min-height:44px;display:flex;align-items:center;gap:6px" onclick="openInstallSheet()"><span style="flex:1">${esc2(txt)}</span><span style="flex:0 0 auto;display:inline-flex" aria-hidden="true">${icon('chevronRight',16)}</span></button>
      <button class="btn icon sm ghost" aria-label="Hinweis schließen" onclick="dismissInstallHint()">${icon('x',18)}</button>`;
    const views=document.getElementById('views');
    if(views&&views.parentNode)views.parentNode.insertBefore(bar,views);else document.body.appendChild(bar);
  }catch(e){}
}
// Einmal weggetippt gilt für BEIDE Orte: die Zeile hier und jeder andere Trichter-Anstoß. EIN Merker
// für dieselbe Entscheidung (CRITIC K1) – der Zeitstempel, den lpInstallDue() ohnehin liest. Der alte
// Dauer-Schlüssel wird hier nicht mehr geschrieben; lpInstallOldKeyMigrate() räumt ihn weg.
function dismissInstallHint(){
  try{
    if(typeof LP_INSTALL_KEY!=='undefined')localStorage.setItem(LP_INSTALL_KEY,String(Date.now()));
    else localStorage.setItem('be_lp_install_off',String(Date.now()));  // Notnagel ohne home.js
    localStorage.removeItem('be_ios_install_dismissed');
  }catch(e){}
  const b=document.getElementById('iosInstallHint');if(b)b.remove();}

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
  // Fehlt die Einwilligung, geht die Frage danach vor (core.js: lgConsentGate). Gemessen: die Tour
  // legte ihren Spotlight über die frisch geöffnete Einwilligungs-Karte – zwei Dinge gleichzeitig,
  // und ausgerechnet das wichtigere lag hinten. Die Tour ist dadurch nicht verbraucht: sie startet
  // beim nächsten Zeichnen der Startseite, sobald die Einwilligung steht.
  if(typeof lgConsentMissing==='function'&&lgConsentMissing())return true;
  // Läuft gerade das Onboarding (aus der App über „Jetzt einrichten"), liegt es über der Startseite –
  // die Tour würde ihren Spotlight auf Elemente setzen, die niemand sieht.
  const onb=document.getElementById('onbView');
  if(onb&&!onb.classList.contains('hidden'))return true;
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
    // A-V.3 (RATE-25-engagement M7): Bis 2.8.0 endete das Aktivieren mit einem Toast – ob auf dem
    // Gerät je etwas erscheint, sah man erst Tage später (oder nie). Eine Mitteilung direkt nach
    // dem Ja zeigt es sofort. Sie kommt vom Service Worker dieses Geräts, nicht vom Server: das
    // beweist Erlaubnis und Anzeige, nicht die Zustellung – die prüft IPHONE-TEST.md am Gerät.
    if(r.status===200){
      try{await reg.showNotification('Erinnerungen sind an',{
        body:'So sieht es aus, wenn ich mich melde. Uhrzeit und Arten änderst du im Profil.',
        icon:'/icon-192.png',badge:'/icon-192.png',tag:'be-test',data:{url:'/'}});}catch(e){}
      toast('Push-Mitteilungen aktiviert ✓');return true;}
    toast('Fehler beim Aktivieren');return false;
  }catch(e){console.error('[push]',e);toast('Push konnte nicht aktiviert werden');return false;}}
function exportMyData(){window.open('/api/export/'+ME.id,'_blank');toast('Export wird heruntergeladen…');}
