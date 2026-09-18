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
// ===== POSTFACH (DESIGN-4 6.12) – EINE PUSH-SEITE, BEIDE BEREICHE UNTEREINANDER =====
// Befund 3.0.2: Der Athlet sah seine EIGENEN gesendeten Nachrichten nie wieder und antwortete in
// ein nacktes Textfeld ohne Verlauf – der Coach hatte den Thread laengst. Seit 2.5.0 gab es den
// Verlauf, aber hinter einem SEGMENT („<Vorname>" | „Für dich") in einem Sheet: eine zweite
// Steuerebene (G4) und ein Bereich, den man erst finden muss.
// Jetzt: eine Push-Seite „Nachrichten" mit `‹ <Reiter>`, grossem Titel und ZWEI Abschnitten
// untereinander – „Gespräch" und „Für dich". Kein Segment mehr, nichts umgeschaltet, nichts
// versteckt. Die Blasen zeichnet weiterhin threadHTML() aus coach.js (dieselbe Darstellung wie
// beim Coach, keine zweite Kopie); die Eingabe haengt diese Datei an, weil der Athlet eine eigene
// Route hat (POST /api/messages/tocoach; die Coach-Route /api/messages gibt ihm 403).
//   „Für dich" – alles, was NICHT aus dem Gespraech kommt: Nachrichten der App, des Admins, eines
//   frueheren Coachs. Jede davon ist jetzt eine `.row` mit Absender und Zeit in der Unterzeile und
//   der Pille „Neu" rechts (6.12, woertlich). Die Sonntagskarte „Deine Woche" ist ebenfalls eine
//   Zeile – sie fuehrt in die Woche, wo die Zahlen ohnehin stehen, statt sie zu verdoppeln.
let ACC_MSG_TAB='thread';  // legacy: der zuletzt gewaehlte Bereich. Es gibt kein Segment mehr –
                           // der Name bleibt nur, weil acSetMsgTab() als Einsprung erhalten ist.
let acMsgData=null;        // Stand des offenen Postfachs: {msgs,thread,partner,canReply,unread}
// Gehoert eine Postfach-Nachricht ins Gespraech? Alles vom eigenen Coach – auch seine
// „Plan angepasst"-Hinweise, die threadHTML als graue Systemblase zeichnet.
function acInThread(m){return !!(ME&&ME.coach_id)&&Number(m&&m.from_id)===Number(ME.coach_id);}
async function openMessages(){
  // coachOpenMessages() UND threadHTML() wohnen in coach.js – seit dem Buendel-Umbau ein
  // nachgeladenes Modul. Im Fenster zwischen Anmeldung und Nachlauf (gemessen ~1,5 s) zeigte die
  // Seite sonst die Notdarstellung statt des Gespraechs. Erst nachladen, dann wie bisher entscheiden.
  if(window.bootLoad&&typeof threadHTML!=='function'){
    if(ME&&ME.role==='athlete')acMsgOpen(skeleton(3));
    try{await window.bootLoad('coach');}catch(e){}
  }
  // Coach/Admin: WP7 liefert eine nach Athleten gruppierte Ansicht – falls vorhanden, dorthin.
  if(ME&&ME.role!=='athlete'&&typeof coachOpenMessages==='function')return coachOpenMessages();
  acMsgOpen(skeleton(3));
  const canReply=!!(ME&&ME.coach_id);
  const msgs=await loadMessages();
  // Ungelesene IDs VOR dem Lesen merken -> die Pille „Neu" bleibt sichtbar, solange die Seite offen ist
  const unread=new Set(msgs.filter(m=>!m.read).map(m=>m.id));
  let thread=null,partner=null;
  if(canReply){const r=await API.get('/messages/thread/'+ME.id);
    if(r.status===200&&r.data&&Array.isArray(r.data.messages)){thread=r.data.messages;partner=r.data.partner||null;}}
  acMsgData={msgs,thread,partner,canReply,unread};
  acMsgOpen(acMsgPageHTML());
  acAthThreadOpen();acReadSys();}
// Die Seite oeffnen bzw. auffrischen. Push, wenn die Huelle es kann; sonst der alte Sheet-Weg.
function acMsgOpen(html){
  const sub=acMsgSub();
  if(typeof pushPage!=='function')return openSheet('Nachrichten',html);
  if(acRepaint('nachrichten',html,{sub}))return;
  pushPage('nachrichten','Nachrichten',acParent(),html,{sub});}
function acMsgSub(){const d=acMsgData;
  if(!d)return '';
  if(!d.canReply)return 'Noch kein Coach zugeordnet';
  const n=(d.partner&&d.partner.name)||'';
  return n?(n+' · dein Coach'):'Dein Coach';}
// Einsprung aus aelteren Aufrufern: es gibt keine Bereiche mehr, beide stehen untereinander.
function acSetMsgTab(){if(!acMsgData)return;acMsgOpen(acMsgPageHTML());acAthThreadOpen();acReadSys();}
function acMsgPageHTML(){const d=acMsgData;if(!d)return skeleton(3);
  const sys=d.msgs.filter(m=>!acInThread(m));
  return acThreadHTML()+acSysHTML(sys);}
// Das Gespraech: threadHTML() aus coach.js liefert Blasen und Datumstrenner. Seine Eingabe wird
// ABGESCHNITTEN und durch die eigene ersetzt – zwei Gruende: sie schickt ueber die Coach-Route
// (fuer den Athleten 403), und ihr Senden-Knopf ist ein Symbolknopf ohne Wort (K11). Hier steht
// das Wort „Senden" daneben.
function acThreadHTML(){const d=acMsgData;
  const name=(d.partner&&d.partner.name)||'Dein Coach';
  if(!d.canReply)
    return groupHTML('Gespräch',[rowHTML({icon:'mail',title:'Noch kein Coach',
        sub:'Sobald dir ein Coach zugeordnet ist, steht hier euer Verlauf'})],
      'Nachrichten an einen Coach gibt es, sobald dir einer zugeordnet ist. Hinweise der App '
      +'findest du darunter.');
  if(typeof threadHTML!=='function')
    return `<h2 class="rows-h">Gespräch</h2>
      <p class="rows-f">Der Verlauf lässt sich auf diesem Stand gerade nicht anzeigen – schreiben geht trotzdem.</p>`
      +acComposeHTML(name);
  const raw=threadHTML({id:ME.id,name,msgs:d.thread||[]});
  const i=raw.indexOf('<div class="thread-compose"');
  return `<h2 class="rows-h">Gespräch</h2>`+(i>=0?raw.slice(0,i):raw)+acComposeHTML(name);}
function acComposeHTML(name){const first=String(name||'').split(' ')[0]||'deinen Coach';
  return `<div class="ac-compose">
    <textarea id="th_body" rows="1" placeholder="Nachricht an ${esc2(first)}…" maxlength="2000" aria-label="Nachricht an ${esc2(first)}" oninput="this.style.height='auto';this.style.height=Math.min(120,this.scrollHeight)+'px'"></textarea>
    <button type="button" class="btn sm" onclick="acAthThreadSend()">Senden</button></div>
    <p class="rows-f">Dein Coach bekommt sofort eine Mitteilung. Unter deiner letzten Nachricht steht, ob er sie schon gelesen hat.</p>`;}
// Nach dem Zeichnen: ans Ende des Verlaufs scrollen und die Lesebestaetigung setzen.
function acAthThreadOpen(){const d=acMsgData;
  const th=document.getElementById('thread');
  if(th)requestAnimationFrame(()=>{try{th.scrollTop=th.scrollHeight;}catch(e){}});
  acDrawReceipt();
  if(!d||!d.thread||!d.thread.some(m=>m.dir==='in'&&!m.read))return;
  // Lesebestaetigung beidseitig: read-thread markiert NUR die Nachrichten dieses Gespraechs – der
  // Coach sieht dadurch, dass gelesen wurde, und „Für dich" bleibt ungelesen.
  API.post('/messages/'+ME.id+'/read-thread').then(r=>{if(r.status!==200)return;
    d.thread.forEach(m=>{if(m.dir==='in')m.read=1;});
    d.msgs.forEach(m=>{if(acInThread(m))m.read=1;});
    if(typeof setBellBadge==='function')setBellBadge(d.msgs.filter(m=>!m.read).length);});}
// „Gelesen ✓" / „Gesendet" unter der letzten eigenen Blase.
function acDrawReceipt(){const d=acMsgData;if(!d||!d.thread)return;
  const th=document.getElementById('thread');if(!th)return;
  th.querySelectorAll('.thread-receipt').forEach(e=>e.remove());
  const out=d.thread.filter(m=>Number(m.from_id)===Number(ME&&ME.id));const last=out[out.length-1];
  const bubs=th.querySelectorAll('.bub.me');const el=bubs[bubs.length-1];
  if(!last||!el)return;
  const div=document.createElement('div');div.className='thread-receipt'+(last.read?' seen':'');
  div.textContent=last.read?'Gelesen ✓':'Gesendet';
  el.insertAdjacentElement('afterend',div);}
// Athlet -> Coach. Eigene Route (POST /api/messages/tocoach); die Coach-Route darf er nicht.
async function acAthThreadSend(){const ta=document.getElementById('th_body');const body=(ta?.value||'').trim();
  if(!body)return showFieldErr(null,'Bitte eine Nachricht eingeben.','th_body');
  const btn=document.querySelector('.ac-compose .btn');if(btn)btn.disabled=true;
  const r=await API.post('/messages/tocoach',{body});
  if(btn)btn.disabled=false;
  if(r.status!==200)return toast(r.data?.error||'Senden fehlgeschlagen – bitte erneut versuchen.');
  const m={from_id:ME.id,user_id:ME.coach_id,body,kind:'message',dir:'out',read:0,created_at:new Date().toISOString()};
  if(acMsgData&&acMsgData.thread)acMsgData.thread.push(m);
  const th=document.getElementById('thread');
  if(th){th.querySelector('.empty')?.remove();
    th.insertAdjacentHTML('beforeend',`<div class="bub me">${esc2(body)}<div class="bd">${typeof cTime==='function'?cTime(m.created_at):''}</div></div>`);
    acDrawReceipt();try{th.scrollTop=th.scrollHeight;}catch(e){}}
  if(ta){ta.value='';ta.style.height='auto';}
  toast('An deinen Coach gesendet ✓');}
// „Für dich": Nachrichten der App + die ausblendbaren Hinweise. Jede Nachricht ist eine `.row`
// mit Absender und Zeit in der Unterzeile und der Pille „Neu" rechts (6.12).
function acSysHTML(sys){const d=acMsgData;
  if(!sys.length)
    return groupHTML('Für dich',[rowHTML({icon:'bell',title:'Noch nichts für dich',
        sub:'Hier landen Hinweise der App – zum Beispiel dein Wochenrückblick am Sonntagabend'})],
      'Nachrichten der App, deines Betreibers oder eines früheren Coachs stehen hier.')
      +acMsgNotesHTML();
  return groupHTML('Für dich',sys.map(m=>acSysMsgHTML(m,d.unread.has(m.id))),
      'Der Wochenrückblick kommt sonntags ab 18 Uhr. Eine Zeile mit „Neu" hast du noch nicht '
      +'geöffnet; sie verliert die Marke, sobald du diese Seite verlässt.')
    +acMsgNotesHTML();}
// System-Hinweise (E-Mail bestaetigen / Gesundheitsdaten) als ausblendbare Notizen – nie als Zaehler.
function acMsgNotesHTML(){let notes='';
  for(const n of pendingNotifications()){
    if(n.type==='verify')notes+=infoBox('msg_verify',`<b>E-Mail bestätigen.</b> Bestätige ${esc2(ME.email||'')}, um Passwort-Reset und Mails zu nutzen.<div class="mt-2"><button class="btn sm sec" onclick="resendVerify()">Bestätigungs-Mail senden</button></div>`);
    if(n.type==='health')notes+=infoBox('msg_health_'+(n.li||0),`<b>Gesundheitsdaten aktualisieren.</b> ${n.li?'Letzter Import vor '+pl(n.days,'Tag','Tagen')+'.':'Noch keine Daten importiert.'}<div class="mt-2"><button class="btn sm sec" onclick="openAppleHealth()">Jetzt importieren</button></div>`);}
  return notes?`<div class="msg-notes">${notes}</div>`:'';}
// Eine Nachricht aus „Für dich". Die Sonntagsnachricht („Deine Woche", erkennbar an der Wochenmarke)
// fuehrt in die Woche – dort stehen dieselben Zahlen ohnehin, und zwar als Diagramm.
function acSysMsgHTML(m,isNew){const wk=_msgWeek(m);
  const pill=isNew?{text:'Neu',tone:'red'}:null;
  if(wk.week){
    const mon=new Date(Date.parse(wk.week+'T00:00:00'));const sun=new Date(mon.getTime()+6*864e5);
    const span=isNaN(mon.getTime())?'':fmtDate(mon)+' – '+fmtDate(sun);
    return rowHTML({icon:'chartLine',title:m.title||'Deine Woche',
      sub:(span?span+' · ':'')+relDate(m.created_at),pill:pill,
      tap:`openWeekMessage('${esc(wk.week)}')`});}
  const ic=m.kind==='system'?'info':(m.kind==='change'?'dumbbell':'mail');
  const sender=m.from_name?m.from_name:(m.kind==='system'?'Die App':'');
  // Unterzeile = Absender und Zeit (6.12, woertlich). KEINE Vorschau des Rumpfes: eine Vorschau
  // ist abgeschnittener Text, und abgeschnitten wird nichts (G11). Der ganze Text steht eine Zeile
  // weiter, auf seiner eigenen Seite.
  return rowHTML({icon:ic,title:m.title||'Nachricht',
    sub:(sender?sender+' · ':'')+relDate(m.created_at),
    pill:pill,tap:`acOpenSysMsg(${+m.id})`});}
// Eine Nachricht ganz lesen: eigene Push-Seite mit dem vollen Text. Vorher stand der Rumpf
// abgeschnitten in einer Karte; ein langer Text war damit nur zur Haelfte da (G11).
function acOpenSysMsg(id){const d=acMsgData;if(!d)return;
  const m=d.msgs.find(x=>Number(x.id)===Number(id));if(!m)return;
  const wk=_msgWeek(m);
  const sender=m.from_name?m.from_name:(m.kind==='system'?'Die App':'');
  const rows=[rowHTML({icon:'user',title:sender||'Nachricht',value:relDate(m.created_at)})];
  if(wk.week)rows.push(rowHTML({icon:'chartLine',title:'Die Woche ansehen',
    sub:'Gewicht, Sätze, Schlaf und Schritte als Diagramm',tap:`openWeekMessage('${esc(wk.week)}')`}));
  acSubMsg('nachricht',m.title||'Nachricht',
    groupHTML('Absender',rows,'')
    +`<div class="ac-msgbody">${esc2(wk.body).replace(/\n/g,'<br>')}</div>`);}
// Eine Unterseite des Postfachs (Eltern: „Nachrichten").
function acSubMsg(key,title,html){
  if(typeof pushPage!=='function')return openSheet(title,html);
  let eltern='Nachrichten';
  try{if(typeof PUSH_STACK!=='undefined'){const t=PUSH_STACK[PUSH_STACK.length-1];
    if(t&&t.key==='nachrichten')eltern=t.title||'Nachrichten';}}catch(e){}
  pushPage(key,title,eltern,html);}
// „Für dich" gesehen -> diese Nachrichten als gelesen melden. Der Server kennt dafuer keinen
// eigenen Weg: POST /messages/:id/read markiert das GANZE Postfach. Deshalb erst dann, wenn im
// Gespraech nichts Ungelesenes mehr liegt – sonst wuerde ein Blick auf „Für dich" eine ungelesene
// Coach-Nachricht stumm wegklicken.
function acReadSys(){const d=acMsgData;if(!d)return;
  if(!d.msgs.some(m=>!m.read&&!acInThread(m)))return;
  if(d.msgs.some(m=>!m.read&&acInThread(m)))return;
  API.post('/messages/'+ME.id+'/read').then(r=>{if(r.status!==200)return;
    d.msgs.forEach(m=>{m.read=1;});
    if(typeof setBellBadge==='function')setBellBadge(0);});}
// Montag der BERICHTETEN Woche einer Wochen-Nachricht. Er kommt vom Server mit – als Feld oder als
// Marke „[week:JJJJ-MM-TT]" im Rumpf, die hier herausgeschnitten wird. Aus created_at laesst er
// sich NICHT ableiten: am nachgetragenen Montag zeigte das nachweislich auf die falsche Woche.
function _msgWeek(m){let w=null,body=String((m&&m.body)||'');
  const ok=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
  for(const k of ['week','week_start','weekStart']){if(m&&ok(m[k])){w=String(m[k]);break;}}
  if(!w&&m&&typeof m.url==='string'){const mm=m.url.match(/tracker\/woche\/(\d{4}-\d{2}-\d{2})/);if(mm)w=mm[1];}
  const mk=body.match(/\s*\[week:(\d{4}-\d{2}-\d{2})\]\s*/);
  if(mk){if(!w)w=mk[1];body=body.replace(mk[0],' ').trim();}
  if(w&&isNaN(Date.parse(w+'T00:00:00')))w=null;
  return {week:w,body};}
// Derselbe Weg wie der Sonntags-Push: Hash „#tracker/woche/<Montag>" setzen und den Router darauf
// loslassen. replaceState statt location.hash: kein zusaetzlicher History-Eintrag.
function openWeekMessage(w){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(w||'')))return;
  try{history.replaceState(null,'',location.pathname+location.search+'#tracker/woche/'+w);}catch(e){location.hash='#tracker/woche/'+w;}
  if(typeof applyHashRoute==='function'){try{if(applyHashRoute())return;}catch(e){console.error('[nachrichten] Woche',e);}}
  if(typeof renderTracker==='function')renderTracker.tab='woche';go('tracker');}
// Antwort an den Coach ohne offenes Postfach (Kurzweg): oeffnet das Postfach und setzt den Fokus
// ins Eingabefeld. Es gibt keinen zweiten Ort mehr, an dem man an den Coach schreibt.
function replyCoach(){openMessages();
  setTimeout(()=>{const ta=document.getElementById('th_body');
    if(ta)try{ta.focus({preventScroll:true});}catch(e){}},600);}
async function sendReplyCoach(){return acAthThreadSend();}

// ===== PROFIL (DESIGN-4 6.11) – EINE PUSH-SEITE STATT EINES SHEETS MIT AUFKLAPPERN =====
// Was sich gegenueber 3.0.2 aendert, und warum:
//   1. Das Profil war EIN Sheet mit Avatar-Block, Namensfeld, sieben Zeilen und sieben Unter-Sheets
//      uebereinander (Sheet ueber Sheet ueber Sheet). Jetzt ist es eine PUSH-SEITE mit `‹ <Reiter>`
//      oben links (G3/N1), grossem Titel und gruppierten Zeilen nach Apple-Art. 3.4 sagt es
//      woertlich: „Einstellungsgruppe im Profil (Erinnerungen)" gehoert auf eine Push-Seite.
//   2. JEDE Zeile kommt aus rowHTML(), jede Gruppe aus groupHTML() (G6/K6). Die 26 von Hand
//      geschriebenen Zeilen dieser Datei (sprache.mjs, statisch) fallen damit weg.
//   3. Jede Gruppe hat eine Ueberschrift und einen FUSSTEXT – der Erklaerungsort der App (G8).
//      Vorher standen Erklaerungen in `.note`-Kaesten, `.caption`-Absaetzen und einem `title`.
//   4. Der Aufklapper (das details/summary-Paar, account.css:57) ist ersatzlos weg: G5 -
//      ein Aufklapper versteckt, und was hinter einem Dreieck liegt, gibt es fuer den Nutzer nicht.
//   5. NEU: der Textgroessen-Schalter (6.11, W4) – siehe direkt darunter.
// Sheets bleiben genau dort, wo etwas ABGESCHLOSSEN oder BESTAETIGT wird (3.4-Pruefrage):
//   Passwort aendern · Konto loeschen · Widerruf der Einwilligung · Auswahl aus einer Liste ·
//   confirmSheet · der Installations-Trichter. Alles andere speichert sofort und laesst sich
//   halb erledigt liegen lassen – also Push-Seite.

// ---- Die Textgroesse (DESIGN-4 6.11 „Neu: Textgröße", W4/K22) --------------------------------
// Safari auf dem iPhone gibt die Systemtextgroesse NICHT an eine Webseite weiter. Welle 1 hat die
// sieben Typo-Sprossen auf `rem` gestellt und `html{font-size:100%}` gesetzt – genau damit dieser
// eine Schalter die ganze App groesser machen kann. Er steht hier, weil das Profil der Ort fuer
// „wie haette ich es gern" ist, und er gilt NUR AUF DIESEM GERAET: eine Anzeige-Einstellung ist
// nichts, was man dem Server schickt (sie gehoert nicht zu einem Konto, sondern zu einem Bildschirm).
const AC_TEXT_KEY='be_textsize';
const AC_TEXT_STEPS=[[100,'Standard'],[115,'Groß'],[130,'Größer'],[150,'Sehr groß']];
function acTextScale(){let v=100;try{v=parseInt(localStorage.getItem(AC_TEXT_KEY),10);}catch(e){}
  return AC_TEXT_STEPS.some(s=>s[0]===v)?v:100;}
function acTextLabel(v){v=v==null?acTextScale():v;const s=AC_TEXT_STEPS.find(x=>x[0]===v);
  return s?s[1]:'Standard';}
// Die Wurzel traegt den Faktor, nicht `body`: `rem` misst immer an der Wurzel. 100 % wird wieder
// ENTFERNT statt gesetzt – so bleibt der Stylesheet-Wert zustaendig und es gibt keinen zweiten Ort.
function acTextApply(){const v=acTextScale();
  try{const r=document.documentElement;if(v===100)r.style.removeProperty('font-size');
    else r.style.fontSize=v+'%';}catch(e){}}
function acTextSet(v){v=parseInt(v,10);if(!AC_TEXT_STEPS.some(s=>s[0]===v))return;
  try{if(v===100)localStorage.removeItem(AC_TEXT_KEY);else localStorage.setItem(AC_TEXT_KEY,String(v));}catch(e){}
  acTextApply();
  acRepaint('textgroesse',acTextPageHTML());
  acRepaint('profil',acProfileHTML());
  toast('Textgröße: '+acTextLabel(v));}
// Eine AUSWAHL-Gruppe (A32, „Optionsliste mit Haken"): jede Zeile setzt einen Wert und fuehrt
// NIRGENDWOHIN. Das Chevron bedeutet genau eines - „fuehrt weiter" (G7) -, also darf hier keines
// stehen. rowHTML() setzt es bei jedem `tap`; die Gruppe traegt deshalb `.pick`, und account.css
// blendet das Chevron darin aus. Bewusst NICHT aus dem Markup geschnitten: waere `.chev` weg,
// zoege die Legacy-Regel in app.css (`.row.tap:not(:has(.chev))`) ein Pseudo-Chevron nach. Die
// saubere Loesung ist ein Schalter `pick:true` in rowHTML() - core.js gehoert einem anderen Paket,
// der Auftrag steht in DEFER-D5.
// Eine AKTIONSZEILE: sie tut etwas und oeffnet KEINEN neuen Bildschirm (herunterladen, abmelden,
// Test-Mitteilung, Bild entfernen). Das Chevron bedeutet genau eines - „fuehrt weiter" (G7) -,
// also traegt sie keines. Die Zeile bleibt Zeichen fuer Zeichen die `.row.tap`: gleiche Hoehe,
// gleiche Spalten, gleicher Druckzustand; `.act` blendet nur das 16-px-Zeichen am Ende aus.
// (sprache.mjs zaehlt Klassensignaturen und sieht darin eine zweite „Zeilenform" - das ist der
// Messweg, nicht die Sache. Vermerkt in DONE-D5-D-6 und DEFER-D5.)
function acActRow(o){return rowHTML(o).replace('class="row tap','class="row tap act');}
// ACHTUNG, hier lag ein Fehler: groupHTML() liefert `<h2 class="rows-h">…</h2><div class="rows…`,
// und String.replace mit einer ZEICHENKETTE ersetzt nur das ERSTE Vorkommen – das stand in der
// Ueberschrift. Gemessen (dz/d6fix/vorher.json): `<h2 class="rows pick-h">Groesse</h2>` mit 25,5 px
// Schrift neben der richtigen `<h2 class="rows-h">` mit 17 px auf derselben Seite. Drei Folgen:
// die Ueberschrift erbte die Kartenflaeche von `.rows`, 25,5 px steht nicht in der Leiter aus 2.1
// (K7), und `.pick` landete NIE auf der Gruppe – also trug jede Auswahlzeile ein Chevron, obwohl
// sie nur einen Wert setzt (G7). Der Anker ist deshalb jetzt das oeffnende `<div`.
function acPickGroup(head,rows,foot){return groupHTML(head,rows,foot).replace('<div class="rows','<div class="rows pick');}
function acTextPageHTML(){const cur=acTextScale();
  return acPickGroup('Größe',AC_TEXT_STEPS.map(([v,l])=>rowHTML({
      title:l,sub:v+' % der Standardgröße',value:v===cur?'✓':'',tap:'acTextSet('+v+')'})),
    'Die Textgröße gilt für die ganze App und nur auf diesem Gerät – sie wird nicht an den Server '
    +'geschickt. Safari auf dem iPhone reicht die Systemtextgröße nicht an Webseiten weiter; '
    +'deshalb steht der Schalter hier. Ab „Größer" rücken nebeneinanderstehende Kacheln '
    +'untereinander, damit nichts abgeschnitten wird.')
  +groupHTML('Beispiel',[
      rowHTML({icon:'dumbbell',title:'Bankdrücken',sub:'3 Sätze · 8–12 Wiederholungen',value:'80 kg'})],
    'So sieht eine Zeile in der gewählten Größe aus.',{inset:true});}
function openTextSize(){acSub('textgroesse','Textgröße',acTextPageHTML());}
acTextApply();   // sofort beim Laden – vor dem ersten Bild, damit nichts nachspringt

// ---- Push-Seiten dieses Bereichs: oeffnen und auffrischen --------------------------------------
// Der Zurueck-Knopf traegt den Namen dessen, was WIRKLICH darunter liegt (G3/N1/K13): eine offene
// Push-Ebene, sonst der aktuelle Reiter.
function acParent(){
  try{if(typeof PUSH_STACK!=='undefined'&&PUSH_STACK.length)return PUSH_STACK[PUSH_STACK.length-1].title||'';}catch(e){}
  return acTabLabel();}
function acTabLabel(){try{const p=document.querySelector('.navbtn.on');const k=p&&p.dataset&&p.dataset.p;
    if(k&&typeof TITLES==='object'&&TITLES[k])return TITLES[k];}catch(e){}
  return 'Heute';}
// Eine Unterseite des Profils. Steht das Profil noch nicht im Stapel (Kurzweg aus der Suche),
// wird es ZUERST geoeffnet – sonst traegt der Zurueck-Knopf den Namen eines Reiters, und der Weg
// zurueck ins Profil fehlt ganz.
function acSub(key,title,html,opts){
  if(typeof pushPage!=='function')return openSheet(title,html);
  let eltern=null;
  try{if(typeof PUSH_STACK!=='undefined'){const t=PUSH_STACK[PUSH_STACK.length-1];
    if(t&&t.key==='profil')eltern=t.title||'Profil';}}catch(e){}
  if(!eltern){acProfileOpen();eltern=acProfileTitle();}
  pushPage(key,title,eltern,html,opts||{});}
function acLgHTML(t,s){return `<h1 class="lg-title" data-auto="1">${esc2(t)}${s?`<small>${esc2(s)}</small>`:''}</h1>`;}
// Eine Push-Seite dieses Bereichs neu zeichnen, OHNE den Fokus zu verschieben und ohne die Ebene
// neu aufzubauen. _renderPush() springt mit dem Fokus auf den Titel – richtig beim Oeffnen, falsch
// nach einem Schalter, den man gerade umgelegt hat. Liegt die Seite nicht obenauf, wird nur der
// gespeicherte Stand aufgefrischt; beim Ruecksprung ist er dann aktuell.
function acRepaint(key,html,o){o=o||{};
  let e=null,oben=false;
  try{if(typeof PUSH_STACK==='undefined')return false;
    const i=PUSH_STACK.findIndex(x=>x.key===key);if(i<0)return false;
    e=PUSH_STACK[i];oben=(i===PUSH_STACK.length-1);}catch(err){return false;}
  if(o.title!=null)e.title=String(o.title);
  if(o.sub!=null)e.sub=String(o.sub);
  e.html=String(html==null?'':html);
  if(!oben)return true;
  const el=document.getElementById('pushView');const page=el&&el.querySelector('.page');
  if(!page)return true;
  const bar=page.querySelector('.push-bar');const y=el.scrollTop;
  const h1=(e.title&&!/class="lg-title"/.test(e.html))?acLgHTML(e.title,e.sub):'';
  page.innerHTML=(bar?bar.outerHTML:'')+h1+e.html;
  el.scrollTop=y;
  if(typeof mountLargeTitle==='function')mountLargeTitle();
  if(typeof o.onMount==='function')try{o.onMount();}catch(err){console.error('[profil]',err);}
  return true;}

// ---- Die Wortmarken der Stufen und Rollen (unveraendert) --------------------------------------
let _PF_AVATAR_URL=null; // geladenes Profilbild (Data-URL)
const PHASE_LABEL={offseason:'Offseason',prep:'Wettkampf-Prep',maintain:'Maintenance'};
const DIET_LABEL={all:'Alles',vegetarian:'Vegetarisch',vegan:'Vegan'};
function roleLabel(r){return {admin:'Administrator',coach:'Coach',athlete:'Athlet'}[r]||'';}

// ---- Der Titel der Seite: der Mensch, nicht das Wort „Profil" (6.11) ---------------------------
// DESIGN-4 6.11 zeichnet den grossen Titel als „Marco Munsch" mit „Athlet · Stufe · seit …"
// darunter – genau wie die Einstellungen-App das Konto oben zeigt. Der Ortsname steht trotzdem
// dreifach fest: im Zurueck-Knopf steht, wo man herkommt, in der Kopfzeile derselbe Titel, und
// die Glocke/der Avatar bleiben sichtbar. Ohne Namen (Kaltstart) heisst die Seite „Profil".
function acProfileTitle(){return (ME&&ME.name)?String(ME.name):'Profil';}
function acProfileSub(){const u=ME||{};const t=[];
  if(u.role)t.push(roleLabel(u.role));
  if(u.role==='athlete'){const lv=u.experience_coach||u.experience;
    if(lv&&typeof dsLvLabel==='function')t.push(dsLvLabel(lv));}
  const seit=acSeit(u.created_at);if(seit)t.push('seit '+seit);
  return t.join(' · ');}
function acSeit(v){const d=_dbDate(v);if(!d)return '';
  try{return d.toLocaleDateString('de-DE',{month:'long',year:'numeric'});}catch(e){return '';}}

// ---- Die Seite ---------------------------------------------------------------------------------
// `openProfile` bleibt der oeffentliche Name (index.html, core.js, diet.js, search.js rufen ihn).
// Die Arbeit macht acProfileOpen(): der Bundle-Lader in src/server.js legt um `openProfile` eine
// Huelle, die erst training.js nachlaedt (fruehere Abhaengigkeit von applyAvatar/_mrow/cycleText).
// Diese Datei ruft deshalb INTERN immer acProfileOpen – sonst waere jeder Sprung von einer
// Unterseite zurueck ins Profil ein asynchrones Warten, und die Reihenfolge der Push-Ebenen
// haengt davon ab, wer zuerst fertig ist.
function openProfile(o){return acProfileOpen(o);}
function acProfileOpen(o){o=o||{};
  if(typeof pushPage!=='function'){openSheet('Profil',acProfileHTML());loadProfileAvatar();return;}
  // Steht das Profil schon obenauf (zweiter Tipp auf den Avatar, Kurzweg aus der Suche), wird es
  // AUFGEFRISCHT statt ein zweites Mal gestapelt. Ohne diesen Riegel stand „Marco Munsch" als
  // Elternname ueber „Marco Munsch" - ein Zurueck-Weg auf denselben Bildschirm (K13).
  let schonOben=false;
  try{if(typeof PUSH_STACK!=='undefined'){const t=PUSH_STACK[PUSH_STACK.length-1];schonOben=!!(t&&t.key==='profil');}}catch(e){}
  // DAS PROFIL LIEGT IMMER AUF EBENE 1. Der Avatar steht in `.hdr` und ist ueber JEDER Push-Ebene
  // bedienbar. Lag schon eine fremde Ebene (z. B. „Probe-Uebung") darunter, war das Profil Ebene 2
  // und jede seiner 13 Unterseiten waere Ebene 3 gewesen – dort ERSETZT N3 (shell.js:540) die
  // oberste Ebene. Gemessen (dz/p/planE.out.json E5): Stapel [Probe-Uebung, Textgroesse], Zurueck
  // hiess „‹ Probe-Uebung", das Profil war spurlos weg; in der Rolle Betreiber genauso („‹ Betrieb").
  // 6.11 nennt als Eltern des Profils ohnehin „den aktuellen Reiter" – also raeumen wir fremde
  // Ebenen ab, statt uns daraufzustapeln. Danach greift N3 auf keiner Unterseite mehr.
  // Reihenfolge, auf die es ankommt: closeAllPages() stellt history.go(-n) in die Warteschlange
  // (asynchron), das pushState von pushPage() laeuft synchron davor. Die spaeter eintreffende
  // Rueckwaerts-Bewegung schluckt _pushPopstate() ueber _pushPop – gemessen bleibt genau EIN
  // eigener History-Eintrag ueber dem Reiter (d6fix-probe.mjs, Abschnitt „zurueckKette").
  if(!schonOben){try{if(typeof PUSH_STACK!=='undefined'&&PUSH_STACK.length&&typeof closeAllPages==='function')closeAllPages();}catch(e){}}
  if(schonOben){acRepaint('profil',acProfileHTML(),{title:acProfileTitle(),sub:acProfileSub(),onMount:()=>acProfileMount(o)});}
  else pushPage('profil',acProfileTitle(),acParent(),acProfileHTML(),
    {sub:acProfileSub(),onMount:()=>acProfileMount(o)});
  loadProfileAvatar();
  if(ME&&ME.role==='athlete'){acKcalAskLoad();lgSupportLoad();}
  acPushPaint();}
// Nach dem Zeichnen: Schalter verdrahten und, wenn ein Kurzweg einen Abschnitt meint, dorthin.
function acProfileMount(o){o=o||{};
  acBindSwitches();
  if(!o.focus)return;
  const el=document.getElementById('pf_'+o.focus);if(!el)return;
  try{el.scrollIntoView({block:'start',behavior:'auto'});}catch(e){}
  const z=el.querySelector('.rows');if(z){z.classList.add('flash');setTimeout(()=>z.classList.remove('flash'),3400);}}
// EIN Zuhoerer je Seite fuer alle Schalter (A29: der Zeilentext ist die Beschriftung, der Schalter
// traegt keine eigene). rowHTML() setzt den Schalter als <input class="sw" name="…"> – hier haengt
// die Wirkung dran. Kein onclick im Markup: ein `label` mit `onclick` loest bei jedem Klick auf den
// Zeilentext ZWEIMAL aus (einmal am Label, einmal am weitergereichten Klick auf das Feld).
function acBindSwitches(){
  const el=document.getElementById('pushView');if(!el||el._acSw)return;
  el._acSw=true;
  el.addEventListener('change',e=>{const t=e.target;
    if(!t||!t.classList||!t.classList.contains('sw'))return;
    acSwitch(t.name,t);});}
function acSwitch(name,el){
  if(name==='push')return togglePush(el);
  if(name==='mail')return toggleEmailNotif(el.checked,el);
  if(name==='evening')return toggleEvePush(el);
  if(name==='ai')return lgAiSet(el.checked,el);}

function acProfileHTML(){const u=ME||{};const staff=u.role==='coach'||u.role==='admin';
  let h='';

  // --- Konto: Name, E-Mail, Passwort -----------------------------------------------------------
  const mail=u.email?(u.email+(u.email_verified?' · bestätigt':' · noch nicht bestätigt')):'Noch keine Adresse hinterlegt';
  h+='<div id="pf_konto">'+groupHTML('Konto',[
    rowHTML({icon:'user',title:'Name und Foto',sub:u.name||'Noch kein Name',tap:'acOpenName()'}),
    rowHTML({icon:'mail',title:'E-Mail',sub:mail,tap:'acOpenEmail()'}),
    rowHTML({icon:'lock',title:'Passwort ändern',sub:'Danach melden sich alle anderen Geräte neu an',tap:'openChangePw()'})
  ],'Dein Name steht über jeder Nachricht an deinen Coach. Die E-Mail ist dein Anmeldename – '
   +'bestätigt brauchst du sie für „Passwort vergessen" und für Mails der App.')+'</div>';

  // --- Training & Ernährung (nur der Athlet hat einen Plan) ------------------------------------
  if(!staff){
    const zielWert=goalLabel(u.goal);
    // Der Wert rechts ist KURZ (er darf nicht umbrechen, .rr steht auf nowrap); der Rest steht in
    // der Unterzeile, die umbrechen darf. Die Phase steht auf der Unterseite, nicht hier - drei
    // Angaben in einer Unterzeile sind auf 390 px schon zwei Zeilen.
    const zielSub=[(typeof dsLvLabel==='function'?dsLvLabel(u.experience_coach||u.experience):''),
                   (u.days_per_week||4)+'×/Woche'].filter(Boolean).join(' · ');
    const kcalSub=[DIET_LABEL[u.diet_type||'all'],
      (u.kcal_target_train||u.kcal_target_rest)
        ? fmtNum(u.kcal_target_train)+' kcal am Trainingstag · '+fmtNum(u.kcal_target_rest)+' kcal am Ruhetag'
        : 'Noch keine Kalorienziele gesetzt',
      AC_KCAL_ASK?'Weicht von der Rechnung ab':''].filter(Boolean).join(' · ');
    const koerper=[u.height_cm?fmtNum(u.height_cm)+' cm':'Größe fehlt',
                   acDobYear()?'Jahrgang '+acDobYear():'Geburtsjahr fehlt',
                   u.start_weight?'Start '+fmtNum(u.start_weight,1)+' kg':''].filter(Boolean).join(' · ');
    const sg=pfSleepGoal();
    const zieleSub=fmtNum(sg.h,sg.h%1?1:0)+' h Schlaf'+(sg.derived?' (abgeleitet)':'')
      +' · '+fmtNum(u.steps_goal||10000)+' Schritte · '+fmtNum(u.water_goal||3,(u.water_goal||3)%1?1:0)+' L Wasser';
    const rows=[
      rowHTML({icon:'target',title:'Ziel & Training',sub:zielSub,value:zielWert,tap:'openGoalSheet()'}),
      rowHTML({icon:'utensils',title:'Ernährung & Kalorien',sub:kcalSub,tap:'openNutritionSheet()'}),
      rowHTML({icon:'ruler',title:'Körperdaten',sub:koerper,tap:'acOpenBody()'}),
      rowHTML({icon:'moon',title:'Persönliche Ziele',sub:zieleSub,tap:'openGoalsSheet()'})];
    if(typeof openSupp==='function')
      rows.push(rowHTML({icon:'pill',title:'Supplements',sub:'Deine Liste – abhaken und verwalten',tap:'openSupp()'}));
    h+='<div id="pf_training">'+groupHTML('Training & Ernährung',rows,
      'Ziel und Erfahrungsstufe entscheiden, womit die App rechnet und welche Felder du in einer '
      +'Einheit siehst. Aus Größe, Geburtsjahr und Gewicht kommt dein Kalorienziel. Dein Coach '
      +'kann Ziel, Stufe und Kalorien ebenfalls setzen – dann steht das dort.')+'</div>';
  }else{
    h+=groupHTML('Dein Konto',[
      rowHTML({icon:'users',title:'Rolle',value:roleLabel(u.role)})],
      'Als '+roleLabel(u.role)+' verwaltest du '+(u.role==='admin'?'das System':'deine Athleten')
      +'. Einen eigenen Trainings- oder Ernährungsplan gibt es für dieses Konto nicht.');
  }

  // --- Darstellung: der Textgroessen-Schalter (NEU, W4) ----------------------------------------
  h+='<div id="pf_darstellung">'+groupHTML('Darstellung',[
    rowHTML({icon:'eye',title:'Textgröße',sub:acTextScale()+' % der Standardgröße',
             value:acTextLabel(),tap:'openTextSize()'})],
    'Größerer Text gilt für die ganze App und nur auf diesem Gerät.')+'</div>';

  // --- Erinnerungen ----------------------------------------------------------------------------
  const ph=u.push_hour==null?null:String(u.push_hour);
  h+='<div id="pf_erinnerungen">'+groupHTML('Erinnerungen',[
    rowHTML({icon:'bell',title:'Mitteilungen',
      sub:ph?('An Trainingstagen um '+ph+' Uhr'):'Keine Trainings-Erinnerung eingestellt',
      value:ph?(ph+' Uhr'):'Aus',tap:'openNotifSheet()',id:'pf_notifRow'})],
    'Hier steht, was dich erreichen darf und wann. Ohne Push-Mitteilungen auf diesem Gerät kommt '
    +'nichts an – das sagt die Seite dir dort auch.')+'</div>';

  // --- Daten & Sichtbarkeit (nur der Athlet hat Gesundheitsdaten) ------------------------------
  if(!staff){
    h+='<div id="pf_sichtbarkeit">'+groupHTML('Sichtbarkeit',[
      rowHTML({icon:'users',title:'Wer sieht was',sub:'Du, dein Coach, der Betreiber – Zeile für Zeile',tap:'lgOpenWhoSheet()'}),
      rowHTML({icon:'shield',title:'Einwilligung',sub:lgConsentSub(),tap:'lgOpenConsentSheet()'}),
      rowHTML({icon:'help',title:'Einblick für den Betreiber',sub:lgGrantSubText(),tap:'lgOpenSupportSheet()',id:'pf_grantRow'})
    ],'Ohne deine Einwilligung speichert die App keine neuen Gesundheitswerte. Der Betreiber sieht '
     +'in der App Zahlen und Zustände, keine Gesundheitsdaten – es sei denn, du gibst ihm für '
     +fmtNum(lgGrantMin())+' Minuten Einblick. Jeder dieser Zugriffe steht im Protokoll.')+'</div>';
  }

  // --- Deine Daten -----------------------------------------------------------------------------
  const drows=[];
  if(!staff)drows.push(rowHTML({icon:'apple',title:'Gesundheitsdaten verbinden',
    sub:u.last_health_import?('Letzter Import '+relDate(u.last_health_import)):'Apple Health per Kurzbefehl – noch nicht eingerichtet',
    tap:'openAppleHealth()'}));
  drows.push(rowHTML({icon:'refresh',title:'Offline-Warteschlange',sub:acOutboxSub(),
    value:acOutboxN()?fmtNum(acOutboxN())+' wartet':'leer',tap:'openOutbox()'}));
  drows.push(acActRow({icon:'download',title:'Daten herunterladen',sub:'Alles, was zu deinem Konto gehört, als eine JSON-Datei (DSGVO)',tap:'exportMyData()'}));
  drows.push(rowHTML({icon:'share',title:'Als App installieren',
    sub:isStandalone()?'Läuft auf diesem Gerät bereits als App':'Zum Startbildschirm hinzufügen – ohne Browserleiste, offline nutzbar',
    tap:'openInstallSheet()'}));
  h+='<div id="pf_daten">'+groupHTML('Deine Daten',drows,
    'Die Warteschlange füllt sich, wenn du ohne Netz etwas einträgst; sobald du wieder online '
    +'bist, geht alles von selbst raus. Der Download enthält jede Zeile, die zu deinem Konto '
    +'gespeichert ist.')+'</div>';

  // --- Hilfe und Rechtliches --------------------------------------------------------------------
  const hrows=[acActRow({icon:'refresh',title:'Hinweise wieder anzeigen',sub:'Alle ausgeblendeten Hinweiskästen zurückholen',tap:'resetHints()'})];
  if(u.role==='athlete')hrows.push(acActRow({icon:'play',title:'Einführung erneut ansehen',sub:'Die kurze Tour über die App',tap:'restartTour()'}));
  hrows.push(lgLinkRow(LG_PRIVACY_URL,'shield','Datenschutz','Welche Daten, wozu, wer sie bekommt'));
  hrows.push(lgLinkRow(LG_IMPRINT_URL,'info','Impressum','Wer diese App betreibt'));
  h+='<div id="pf_hilfe">'+groupHTML('Hilfe',hrows,
    'Datenschutz und Impressum öffnen sich als eigene Seite – sie funktionieren auch dann, wenn '
    +'die App klemmt. Diese Fassung: Version '+APP_VERSION+'.')+'</div>';

  // --- Sitzungen --------------------------------------------------------------------------------
  h+=groupHTML('Sitzungen',[
    rowHTML({icon:'devices',title:'Alle Geräte abmelden',sub:'Andere Handys, Tablets und Browser rauswerfen – hier bleibst du angemeldet',tap:'confirmLogoutAll()'}),
    acActRow({icon:'logOut',title:'Abmelden',sub:'Nur dieses Gerät',tap:'logout()'})
  ],'Auf einem geteilten Gerät (Familien-Tablet, Studio-Rechner): erst „Alle Geräte abmelden", '
   +'dann „Abmelden" – so bleibt nirgends etwas von dir zurück.');

  // --- Die zerstoerende Aktion: eigene Gruppe, einzeilig, rot, zentriert (4.4/A30) --------------
  if(u.role==='admin'){
    // inset:true, obwohl die Zeile kein Symbol traegt: eine einzeilige Gruppe hat keine Trennlinie,
    // der Schalter aendert hier also nichts am Bild - er haelt nur die Gruppe bei EINER Klasse.
    h+=groupHTML('',[rowHTML({title:'Konto löschen',value:'nur über die Verwaltung'})],
      'Ein Administrator-Konto löscht sich nicht selbst – sonst stünde das System ohne Betreiber da.',{inset:true});
  }else{
    h+=groupHTML('',[rowHTML({title:'Konto löschen',tap:'openDeleteAccount()',danger:true})],
      // siehe oben: inset haelt die Gruppe bei EINER Klasse, ohne das Bild zu aendern.
      'Löscht dein Konto mit allem darin: Plan, Sätze, Check-ins, Maße, Fotos, Ernährung, '
      +'Nachrichten, Mindset und Gesundheitsdaten. Es gibt keine Wiederherstellung – auch nicht '
      +'durch den Betreiber. Vorher fragen wir nach deinem Passwort und bieten dir den Download an.',{inset:true});
  }
  return h;}

// Die Warteschlange in Zahlen. outboxList/outboxOwn wohnen in core.js (Startbuendel).
function acOutboxN(){try{if(typeof outboxList!=='function')return 0;
    const a=outboxList();return (typeof outboxOwn==='function'?a.filter(outboxOwn):a).length;}catch(e){return 0;}}
function acOutboxSub(){const n=acOutboxN();
  return n?'Einträge, die noch nicht beim Server sind':'Alle Einträge sind beim Server angekommen';}

// Der Hub im Stapel wird aufgefrischt (Werte in den Zeilen), damit der Ruecksprung aus einer
// Unterseite frische Zahlen zeigt. Der Name bleibt: zwoelf Aufrufer in dieser Datei benutzen ihn.
function refreshProfileHub(){
  if(acRepaint('profil',acProfileHTML(),{title:acProfileTitle(),sub:acProfileSub()}))return;
  // Notnagel ohne Push-Mechanik (sehr alte Huelle): der Hub liegt noch im Sheet-Stapel.
  if(typeof SHEET_STACK==='undefined')return;
  const i=SHEET_STACK.findIndex(e=>e.title==='Profil');if(i<0)return;
  SHEET_STACK[i].html=acProfileHTML();
  if(i===SHEET_STACK.length-1){const b=document.getElementById('sheetBody');if(b)b.innerHTML=SHEET_STACK[i].html;}}

function loadProfileAvatar(){if(!ME||!ME.has_avatar||_PF_AVATAR_URL)return;
  API.get('/avatar/'+ME.id).then(r=>{if(r.status===200&&r.data&&r.data.avatar){_PF_AVATAR_URL=r.data.avatar;
    const el=document.getElementById('pf_avatar');if(el){el.textContent='';el.style.backgroundImage='url('+_PF_AVATAR_URL+')';}}});}

// ===== D10/D1: DAS GESPEICHERTE KALORIENZIEL UND DAS GERECHNETE =====
// Weicht das im Profil gespeicherte Ziel um mehr als 7 % von der Formel ab, rechnet der Server neu
// und legt beide Zahlen als `kcalAsk` in die Antwort. Bis 2.5.0 zeigte das niemand: im Profil stand
// 3.017 / 2.600 kcal, die Ernährung rechnete mit 3.173 / 2.975 – zwei Wahrheiten für dieselbe Sache.
let AC_KCAL_ASK=null;     // null = deckungsgleich oder noch nicht geladen
async function acKcalAskLoad(){
  try{const r=await API.get('/me');
    if(r.status!==200)return;
    AC_KCAL_ASK=(r.data&&r.data.kcalAsk)||null;
    if(r.data&&r.data.user&&typeof ME!=='undefined'&&ME&&r.data.user.id===ME.id)ME.dob=r.data.user.dob??null;
    acKcalAskPaint();
  }catch(e){}}
function acKcalAskPaint(){acRepaint('ernaehrung',acNutritionHTML());refreshProfileHub();}
// Die Frage steht als eigene Gruppe mit EINER Zeile und dem Fusstext darunter – kein `.note`-Kasten
// mehr (G8: erklaert wird in der Fusszeile, nicht in einem farbigen Kasten mitten im Fluss).
function acKcalAskHTML(){const a=AC_KCAL_ASK;if(!a)return '';
  const t=a.train||{},r=a.rest||{};
  const su=Math.round(t.suggested||0),ru=Math.round(r.suggested||0);
  if(!su&&!ru)return '';
  const st=Math.round(t.saved||0),sr=Math.round(r.saved||0);
  const kg=a.weightKg?fmtNum(a.weightKg,1):'';
  return groupHTML('Deine Ziele passen nicht mehr',[
    rowHTML({icon:'alertTriangle',title:'Gespeichert',sub:'Damit steht es in deinem Profil',value:fmtNum(st)+' / '+fmtNum(sr)}),
    rowHTML({icon:'chartLine',title:'Gerechnet',sub:'Damit rechnet die Ernährung gerade',value:fmtNum(su)+' / '+fmtNum(ru)}),
    acActRow({icon:'check',title:'Auf die gerechneten Werte ändern',sub:fmtNum(su)+' kcal am Trainingstag · '+fmtNum(ru)+' kcal am Ruhetag',tap:'acKcalAskApply()'})
  ],'Die Zahlen stehen für Trainingstag / Ruhetag. Deine gespeicherten Ziele passen nicht mehr zu '
   +'deinem Gewicht'+(kg?' von '+kg+' kg':'')+'. Solange du die alten Werte behältst, bleibt der '
   +'Unterschied bestehen. Dein Coach kann die Ziele ebenfalls anpassen.');}
async function acKcalAskApply(){const a=AC_KCAL_ASK;if(!a)return;
  const t=Math.round(a.train?.suggested||0),r=Math.round(a.rest?.suggested||0);
  if(!t&&!r)return;
  const f={};if(t)f.kcal_target_train=t;if(r)f.kcal_target_rest=r;
  if(!await profileSave(f,{msg:'Kalorienziele übernommen ✓',plan:true}))return;
  AC_KCAL_ASK=null;acKcalAskPaint();
  acKcalAskLoad();}   // gegenpruefen: nur wenn der Server nichts mehr fragt, ist der Widerspruch weg

// Geburtsjahr: fehlt es, rechnet der Server das Kalorienziel OHNE Alter und nennt das Ergebnis
// einen Startwert. Dieselbe Spanne wie im Onboarding: 1920 bis heute minus zehn.
const AC_DOB_YEAR_MIN=1920;
function acDobYearMax(){return (typeof crMaxBirthYear==='function')?crMaxBirthYear():(new Date().getFullYear()-10);}
function acDobYear(){const d=(ME&&typeof ME.dob==='string')?ME.dob:'';return /^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(0,4):'';}
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
  // Gespeichert wird das JAHR, nicht der Geburtstag: das Alter veraltet damit nie still.
  const ok=await profileSave({dob:y+'-01-01'},{msg:'Geburtsjahr gespeichert ✓',plan:true});
  if(ok){pfFlash(field);acDobNotePaint();acKcalAskLoad();}else el.value=cur;}
function acDobNotePaint(){const n=document.getElementById('pf_dobNote');if(n)n.textContent=acDobNoteTx();}

// ---- Speichern (unveraendert im Verhalten) -----------------------------------------------------
// Teil-Update des Profils (Server: COALESCE -> nur uebergebene Felder aendern sich). Nie go('home'):
// der aktuelle Tab wird im Hintergrund neu gezeichnet, die Seite bleibt offen.
async function profileSave(fields,o){o=o||{};const r=await API.put('/profile',fields);
  profileSave.last=r.data||null;
  if(r.status!==200){toast(r.data?.error||'Speichern fehlgeschlagen');return false;}
  Object.keys(fields).forEach(k=>{if(k!=='reset')ME[k]=fields[k]===''?null:fields[k];});
  if(Array.isArray(fields.reset))fields.reset.forEach(k=>{ME[k]=null;});
  if(o.msg!==false)toast(o.msg||'Gespeichert ✓');
  if(o.hub!==false)refreshProfileHub();
  TODAY=null;if(o.plan)PLAN=null;
  scheduleTabRefresh();return true;}
let _tabRefreshT=null;
function scheduleTabRefresh(){clearTimeout(_tabRefreshT);_tabRefreshT=setTimeout(refreshCurrentTab,600);}
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
  if(ok){if(typeof applyAvatar==='function')applyAvatar();
    acRepaint('name',acNameHTML());refreshProfileHub();}}
function saveSimpleProfile(){return saveProfileName();} // legacy-Name (Coach-Profil)
async function saveProfile(){const f={};[['p_name','name'],['p_height','height_cm'],['p_kt','kcal_target_train'],['p_kr','kcal_target_rest']].forEach(([id,k])=>{const el=document.getElementById(id);if(el&&el.value!=='')f[k]=k==='name'?el.value.trim():parseFloat(el.value);});
  if(Object.keys(f).length)await profileSave(f);}
// Chip-Auswahl (Ziel/Erfahrung/Phase/Ernaehrungsweise): sofort speichern, bei Fehler zurueckspringen
function pfChips(key,opts){return opts.map(([v,l])=>`<button type="button" class="chip${String(ME[key]??'')===v?' on':''}" data-v="${v}" onclick="pfPick('${key}','${v}',this)">${l}</button>`).join('');}
async function pfPick(key,v,btn){if(String(ME[key]??'')===v)return;const row=btn.parentElement;
  const vorher=String(ME[key]??'');
  row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===btn));
  const ok=await profileSave({[key]:v},{hub:false});
  if(!ok){row.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.v===String(ME[key]??'')));return;}
  refreshProfileHub();
  if(key==='goal')acGoalAskPaint(profileSave.last&&profileSave.last.suggestedKcal);
  if(key==='experience')acExpNotePaint(vorher);}
// --- Ü-2 · Was die Erfahrungs-Stufe bedeutet ---------------------------------------------------
// Der Text steht IMMER da (wer wissen will, was seine Stufe bewirkt, soll dafuer nicht erst etwas
// kaputtmachen muessen) und bekommt nach einem Tipp den Unterschied dazu. Wortlaut und Rangfolge
// kommen aus core.js (DS_LV_*) – dieselbe Quelle, die twLevel()/an2Level() auswerten.
function acExpNoteHTML(d,von){
  const self=String(ME.experience||'beginner');
  const coach=ME.experience_coach?String(ME.experience_coach):'';
  const wirk=coach||self;
  const lab=k=>(typeof dsLvLabel==='function')?dsLvLabel(k):String(k||'');
  const sees=(typeof dsLvSees==='function')?dsLvSees(wirk):[];
  const basis=(typeof DS_LV_BASE==='string')?DS_LV_BASE:'';
  const li=a=>'<ul class="ds-lvlist">'+a.map(x=>'<li>'+esc2(x)+'</li>').join('')+'</ul>';
  let h='<div class="note status mt-2">';
  h+='<div><b>'+esc2(lab(wirk))+'</b> · '+(coach?'von deinem Coach gesetzt':'deine Angabe')+'</div>';
  h+=sees.length?'<div class="mt-2">Das siehst du damit:</div>'+li(sees)
    :(basis?'<div class="mt-2">'+esc2(basis)+'</div>':'');
  if(coach){
    h+='<div class="mt-2 muted-2">Deine eigene Angabe ist „'+esc2(lab(self))+'". Wirksam ist die Stufe deines Coachs: solange sie steht, ändert ein Tipp auf die Chips oben nichts an dem, was du siehst.</div>';
  }else if(von!=null&&von!==''){
    if(!d){
      h+='<div class="mt-2">Umgestellt auf <b>'+esc2(lab(self))+'</b>. In der App ändert das nichts: „Fortgeschritten" und „Profi" zeigen dieselben Felder – die Stufe hält nur fest, wie du dich selbst einschätzt.</div>';
    }else{
      if(d.neu.length)h+='<div class="mt-2">Neu dazugekommen:</div>'+li(d.neu);
      if(d.weg.length){
        h+='<div class="mt-2">Weg ist damit:</div>'+li(d.weg);
        if(d.weg.some(x=>/RIR/.test(x)))
          h+='<div class="mt-2 muted-2">Schon eingetragene Reserve-Werte (RIR) bleiben gespeichert und rechnen weiter an deinen Empfehlungen mit – weg ist nur das Eingabefeld. Tipp oben wieder auf „'+esc2(lab(von))+'", und es ist zurück.</div>';
      }
    }
  }
  return h+'</div>';}
function acExpNotePaint(von){const box=document.getElementById('pf_expNote');if(!box)return;
  const coach=ME.experience_coach?String(ME.experience_coach):'';
  const d=(coach||typeof dsLvDiff!=='function')?null:dsLvDiff(von,String(ME.experience||'beginner'));
  box.innerHTML=acExpNoteHTML(d,von);}
// Kasten unter den Ziel-Chips: die neu gerechneten Kalorien zum gewaehlten Ziel, mit einem Weg,
// sie zu nehmen. A5/B15: „Muskelaufbau -> Definition" aendert die Kalorienziele NICHT von selbst.
let AC_GOAL_ASK=null;
function acGoalAskPaint(s){const box=document.getElementById('pf_goalAsk');
  const t=Math.round(s?.train||0),r=Math.round(s?.rest||0);
  AC_GOAL_ASK=(t||r)?{train:t,rest:r}:null;
  if(!box)return;
  if(!AC_GOAL_ASK){box.innerHTML='';return;}
  const ct=Math.round(s.current?.train||0),cr=Math.round(s.current?.rest||0);
  const same=ct===t&&cr===r;
  box.innerHTML=same?`<p class="rows-f">Deine Kalorienziele passen schon zum neuen Ziel.</p>`
    :groupHTML('',[acActRow({icon:'utensils',title:'Kalorienziele anpassen',
        sub:fmtNum(t)+' kcal am Trainingstag · '+fmtNum(r)+' kcal am Ruhetag',tap:'acGoalAskApply()'})],
      'Zum neuen Ziel gehören diese Zahlen'+((ct||cr)?' – gespeichert sind '+fmtNum(ct)+' / '+fmtNum(cr)+' kcal':'')+'.'
      +(s.dobMissing?' Ohne Geburtsjahr ist das ein Startwert.':'')
      +' Ohne Anpassung bleibt es bei den alten Zahlen – das Ziel allein ändert sie nicht.');}
async function acGoalAskApply(){const g=AC_GOAL_ASK;if(!g)return;
  const f={};if(g.train)f.kcal_target_train=g.train;if(g.rest)f.kcal_target_rest=g.rest;
  if(!Object.keys(f).length)return;
  if(!await profileSave(f,{msg:'Kalorienziele angepasst ✓',plan:true}))return;
  AC_GOAL_ASK=null;const box=document.getElementById('pf_goalAsk');
  if(box)box.innerHTML=`<p class="rows-f">Kalorienziele stehen jetzt auf dein neues Ziel.</p>`;
  acKcalAskLoad();}
// Zahlenfeld: bei Aenderung speichern. reset:true -> leeres Feld setzt auf Standard zurueck.
async function pfNum(key,el,o){o=o||{};const raw=String(el.value||'').trim();const field=el.closest('.field');
  if(raw===''){if(o.reset){if(ME[key]==null)return;const ok=await profileSave({[key]:''});if(ok)pfFlash(field);return;}
    el.value=ME[key]??'';return;}
  const n=parseFloat(raw);if(isNaN(n)){el.value=ME[key]??'';return;}
  if(ME[key]!=null&&Number(ME[key])===n)return;
  const ok=await profileSave({[key]:n});if(ok)pfFlash(field);else el.value=ME[key]??'';}
function pfFlash(field){if(!field)return;field.classList.add('saved');setTimeout(()=>field.classList.remove('saved'),1500);}

// ---- Unterseite: Name und Foto ----------------------------------------------------------------
// Der grosse Avatar-Block stand bisher OBEN im Profil-Sheet und kostete 200 px, bevor die erste
// Zeile kam. Er gehoert dorthin, wo man ihn aendert.
function acNameHTML(){const u=ME||{};
  const bg=(u.has_avatar&&_PF_AVATAR_URL)?` style="background-image:url(${_PF_AVATAR_URL})"`:'';
  return `<div class="pf-head">
    <div id="pf_avatar" class="pf-avatar"${bg}>${bg?'':esc2((u.name||'?').charAt(0).toUpperCase())}</div>
  </div>
  <div class="field"><label for="p_name">Dein Name</label><input id="p_name" value="${esc2(u.name||'')}" maxlength="80" autocomplete="name" enterkeyhint="done" onchange="saveProfileName()"></div>`
  +groupHTML('Profilbild',[
    acActRow({icon:'camera',title:'Bild auswählen',sub:'Aus deiner Fotomediathek – wird quadratisch zugeschnitten',tap:'acPickAvatar()',id:'pf_pick'}),
    acActRow({icon:'trash',title:'Bild entfernen',sub:u.has_avatar?'Zurück zum Anfangsbuchstaben':'Zurzeit ist kein Bild gesetzt',tap:'removeAvatar()',id:'pf_remove'})
  ],'Name und Bild sieht dein Coach. Der Name steht über jeder Nachricht, die du schreibst; '
   +'geändert wird er sofort, ohne Speichern-Knopf.')
  +`<input type="file" accept="image/*" id="pf_file" class="hidden" onchange="avatarPick(event)">`;}
function acOpenName(){acSub('name','Name und Foto',acNameHTML());}
function acPickAvatar(){document.getElementById('pf_file')?.click();}

// ---- Unterseite: E-Mail ------------------------------------------------------------------------
function acEmailHTML(){const u=ME||{};const ok=!!u.email_verified;
  const rows=[rowHTML({icon:'mail',title:u.email||'Noch keine Adresse',
    sub:ok?'Bestätigt – Passwort-Reset und Mails funktionieren':'Noch nicht bestätigt'})];
  if(u.email&&!ok)rows.push(acActRow({icon:'send',title:'Bestätigungs-Mail senden',
    sub:'An '+u.email+' – schau auch im Spam-Ordner nach',tap:'resendVerify()'}));
  return groupHTML('Deine Adresse',rows,
    ok?'Mit der E-Mail meldest du dich an. Ändern kann sie zurzeit nur dein Coach oder der Betreiber – '
      +'so kann niemand ein Konto still auf eine fremde Adresse umschreiben.'
      :'Ohne Bestätigung funktionieren „Passwort vergessen" und die E-Mail-Benachrichtigungen nicht. '
      +'Die Adresse selbst ändert zurzeit nur dein Coach oder der Betreiber.');}
function acOpenEmail(){acSub('email','E-Mail',acEmailHTML());}

// ---- Unterseite: Ziel & Training ---------------------------------------------------------------
// `openGoalSheet` bleibt der oeffentliche Name (search.js springt direkt hierher und der
// Bundle-Lader umhuellt ihn, weil cycleText aus training.js kommt).
function openGoalSheet(){return acGoalPage();}
function acGoalPage(){const u=ME;const dpw=u.days_per_week||4;
  acSub('ziel','Ziel & Training',
    `<h2 class="rows-h">Ziel</h2><div class="chip-row wrap">${pfChips('goal',[['muscle','Muskelaufbau'],['fatloss','Definition'],['health','Gesundheit']])}</div>
    <div id="pf_goalAsk"></div>
    <p class="rows-f">Dein Ziel steuert, wie die App Sätze empfiehlt und womit sie deine Kalorien rechnet. Es ändert die gespeicherten Kalorienziele nicht von selbst – dafür steht der Weg direkt darunter.</p>
    <h2 class="rows-h">Erfahrung</h2><div class="chip-row wrap">${pfChips('experience',[['beginner','Anfänger'],['intermediate','Fortgeschritten'],['advanced','Profi']])}</div>
    <div id="pf_expNote" aria-live="polite">${acExpNoteHTML()}</div>
    <h2 class="rows-h">Phase</h2><div class="chip-row wrap">${pfChips('phase',[['offseason','Offseason'],['prep','Wettkampf-Prep'],['maintain','Maintenance']])}</div>
    <p class="rows-f">Die Phase hält fest, worauf du gerade hinarbeitest. Sie steht auf deiner Startseite und dein Coach sieht sie.</p>`
    +groupHTML('Trainingsrhythmus',[
      rowHTML({icon:'refresh',title:'Zyklus anpassen',sub:_pfCycleSub(dpw),tap:"go('workout');if(typeof openRhythmus==='function')openRhythmus();else toast('Der Kalender wird noch geladen - gleich nochmal versuchen.')"})],
     'Deine Folge aus Trainings- und Ruhetagen – unabhängig vom Wochentag. Sie bestimmt auch, wie '
     +'viele Trainings pro Woche in deine Kalorienziele einfließen. Geändert wird sie an EINER '
     +'Stelle, im Kalender unter Training – ein zweiter Regler hier würde eine fein gebaute Folge '
     +'stillschweigend überschreiben.')
    +`<p class="rows-f">Alles auf dieser Seite wird sofort gespeichert.</p>`);}
function _pfCycleSub(dpw){
  let pat=null;try{pat=ME&&ME.pattern?JSON.parse(ME.pattern):null;}catch(e){pat=null;}
  const txt=(typeof cycleText==='function'&&Array.isArray(pat))?cycleText(pat,(PLAN?.days||[]).map(d=>d.name)):'';
  return txt?txt+' · '+dpw+'×/Woche':dpw+' Trainings pro Woche';}

// ---- Unterseite: Ernährung & Kalorien ----------------------------------------------------------
function openNutritionSheet(){return acNutritionPage();}
function acNutritionPage(){acKcalAskLoad();acSub('ernaehrung','Ernährung & Kalorien',acNutritionHTML());}
function acNutritionHTML(){const u=ME||{};
  return `<h2 class="rows-h">Ernährungsweise</h2><div class="chip-row wrap">${pfChips('diet_type',[['all','Alles'],['vegetarian','Vegetarisch'],['vegan','Vegan']])}</div>
    <p class="rows-f">Filtert Rezepte und deinen Ernährungsplan.</p>`
    +`<div id="pf_kcalAsk">${acKcalAskHTML()}</div>`
    +`<h2 class="rows-h">Kalorienziele</h2>
    <div class="grid-2">
      <div class="field"><label for="p_kt">Trainingstag (kcal)</label><input id="p_kt" type="number" inputmode="numeric" min="0" max="15000" value="${u.kcal_target_train||''}" placeholder="z.B. 3000" onchange="pfNum('kcal_target_train',this)"></div>
      <div class="field"><label for="p_kr">Ruhetag (kcal)</label><input id="p_kr" type="number" inputmode="numeric" min="0" max="15000" value="${u.kcal_target_rest||''}" placeholder="z.B. 2600" onchange="pfNum('kcal_target_rest',this)"></div>
    </div>
    <p class="rows-f">An Trainingstagen braucht dein Körper mehr Energie als an Ruhetagen – deshalb zwei Zahlen. Lässt du sie leer, rechnet die App aus Größe, Gewicht, Alter und Trainingstagen. Dein Coach kann sie ebenfalls anpassen. Änderungen werden sofort gespeichert.</p>`
    +groupHTML('Körperdaten',[
      rowHTML({icon:'ruler',title:'Größe, Geburtsjahr, Startgewicht',
        sub:[u.height_cm?fmtNum(u.height_cm)+' cm':'Größe fehlt',acDobYear()||'Geburtsjahr fehlt'].join(' · '),
        tap:'acOpenBody()'})],
      'Aus diesen drei Angaben kommt dein Kalorienziel.');}

// ---- Unterseite: Körperdaten --------------------------------------------------------------------
function acBodyHTML(){const u=ME||{};const yMax=acDobYearMax();
  const start=u.start_weight?`Startgewicht ${fmtNum(u.start_weight,1)} kg${u.created_at?' · gesetzt am '+fmtDate(u.created_at):''}`:'Kein Startgewicht gesetzt';
  return `<div class="grid-2">
      <div class="field"><label for="p_dobY">Geburtsjahr</label><input id="p_dobY" type="number" inputmode="numeric" autocomplete="bday-year" min="${AC_DOB_YEAR_MIN}" max="${yMax}" step="1" value="${esc2(acDobYear())}" placeholder="z.B. 1996" onchange="acDobSave(this)"></div>
      <div class="field"><label for="p_height">Größe (cm)</label><input id="p_height" type="number" inputmode="numeric" min="50" max="260" value="${u.height_cm||''}" placeholder="z.B. 180" onchange="pfNum('height_cm',this)"></div>
    </div>
    <p class="rows-f" id="pf_dobNote">${acDobNoteTx()}</p>`
    +groupHTML('Startgewicht',[
      rowHTML({icon:'scale',title:u.start_weight?fmtNum(u.start_weight,1)+' kg':'Nicht gesetzt',
        sub:u.created_at?'Gesetzt am '+fmtDate(u.created_at):'Kommt aus deinem ersten Check-in'})],
      esc2(start)+' – fest, daran wird dein Fortschritt gemessen. Eine Korrektur macht dein Coach. '
      +'Dein aktuelles Gewicht trägst du im Check-in ein, nicht hier.')
    +`<p class="rows-f">Änderungen werden sofort gespeichert.</p>`;}
function acOpenBody(){acSub('koerper','Körperdaten',acBodyHTML());}

// ---- Unterseite: Persönliche Ziele --------------------------------------------------------------
// Wirksames Schlafziel: der gesetzte Wert – sonst das Ziel, das der Server ohne Profilangabe aus
// dem eigenen 14-Tage-Schnitt ableitet (7–8 h) und in readiness.sleepGoal mitliefert.
function pfSleepGoal(){const u=ME||{};const set=+u.sleep_goal;if(set>0)return {h:set,derived:false};
  const num=v=>{v=Number(v);return (v>0&&isFinite(v))?v:null;};let v=null;
  try{if(typeof HOME_DATA!=='undefined'&&HOME_DATA&&HOME_DATA.readiness&&VIEW_USER===u.id)v=num(HOME_DATA.readiness.sleepGoal);}catch(e){}
  try{if(!v&&typeof anaCached==='function'&&VIEW_USER===u.id){const R=anaCached('readiness');if(R)v=num(R.sleepGoal);}}catch(e){}
  return v?{h:v,derived:true}:{h:8,derived:false};}
function openGoalsSheet(){return acGoalsPage();}
function acGoalsPage(){const u=ME;const sg=pfSleepGoal();
  const sgTxt=fmtNum(sg.h,sg.h%1?1:0)+' h';
  acSub('ziele','Persönliche Ziele',`<div class="grid-3">
      <div class="field"><label for="p_sleepg">Schlaf (h)</label><input id="p_sleepg" type="number" inputmode="decimal" step="0.5" min="0" max="24" value="${u.sleep_goal??''}" placeholder="${sg.derived?esc2(sgTxt):'Standard 8'}" onchange="pfNum('sleep_goal',this,{reset:true})"></div>
      <div class="field"><label for="p_stepsg">Schritte</label><input id="p_stepsg" type="number" inputmode="numeric" min="0" max="100000" value="${u.steps_goal??''}" placeholder="Standard 10.000" onchange="pfNum('steps_goal',this,{reset:true})"></div>
      <div class="field"><label for="p_waterg">Wasser (L)</label><input id="p_waterg" type="number" inputmode="decimal" step="0.1" min="0" max="30" value="${u.water_goal??''}" placeholder="Standard 3" onchange="pfNum('water_goal',this,{reset:true})"></div>
    </div>
    <p class="rows-f">Diese drei Ziele erscheinen als grüne Linie in deiner Analyse. Lässt du ein Feld leer, gilt der Standard: Schlaf aus deinem eigenen Schnitt der letzten 14 Nächte (7–8 h${sg.derived?', zurzeit '+esc2(sgTxt):''}) · 10.000 Schritte · 3 L Wasser. Änderungen werden sofort gespeichert.</p>`);}

// ---- Unterseite: Erinnerungen -------------------------------------------------------------------
// A5/M2a: Bis 2.4.0 stand hier „Push Aus" und daneben leuchtete „10 Uhr". Eine Erinnerung ohne Push
// kommt nirgends an. Alles, was Push braucht, startet deshalb GESPERRT und wird von renderPushRow()
// erst freigegeben, wenn Push auf DIESEM Geraet wirklich laeuft – gesperrt statt versteckt, damit
// die eingestellte Stunde ablesbar bleibt.
// Ebenso der E-Mail-Schalter: ohne bestaetigte Adresse und ohne eingerichteten Mailversand
// verschickt der Server keine Mail – ein bedienbarer Schalter waere ein Versprechen, das niemand
// einloest.
function openNotifSheet(){return acNotifPage();}
function acNotifPage(){
  acSub('erinnerungen','Erinnerungen',acNotifHTML(null),{onMount:acNotifMount});
  acMailConfigured().then(v=>{acRepaint('erinnerungen',acNotifHTML(v===false),{onMount:acNotifMount});})
    .catch(()=>{});}
function acNotifMount(){acBindSwitches();renderPushRow();
  // Ohne bestaetigte Adresse ODER ohne eingerichteten Mailversand verschickt der Server keine Mail
  // (server.js prueft `email_notifications && email && email_verified`). Ein bedienbarer Schalter
  // waere ein Versprechen, das niemand einloest - der Fusstext darunter sagt, was zuerst fehlt.
  const mr=document.getElementById('pf_mailRow');
  const sw=mr&&mr.querySelector('input.sw');
  if(sw)sw.disabled=!(!!(ME&&ME.email_verified)&&acMailCfg!==false);}
function acNotifHTML(noMail){const u=ME||{};const athlete=u.role==='athlete';
  const verified=!!u.email_verified;
  const mailOk=verified&&noMail!==true;const mailOn=!!u.email_notifications&&mailOk;
  const pushSub=athlete?(u.coach_id?'Trainings-Erinnerung und Nachrichten deines Coachs':'Trainings-Erinnerung und Hinweise der App')
                       :'Neue Nachrichten deiner Athleten';
  let h=groupHTML('Auf diesem Gerät',[
    rowHTML({icon:'bell',title:'Push-Mitteilungen',sub:'Status wird geprüft …',switch:{name:'push',on:false},id:'pf_pushRow'}),
    rowHTML({icon:'mail',title:'E-Mail',
      sub:noMail===true?'Auf diesem Server ist kein Mailversand eingerichtet'
         :(verified?'Benachrichtigungen zusätzlich per E-Mail':'Erst nach der E-Mail-Bestätigung möglich'),
      switch:{name:'mail',on:mailOn},id:'pf_mailRow'})],
    pushSub+'. '+(noMail===true
      ? 'Auf diesem Server ist kein Mailversand eingerichtet – es kommt keine E-Mail an, egal was hier steht. Was dich erreichen soll, läuft über Push-Mitteilungen.'
      : (verified?'Push-Mitteilungen gelten nur für dieses Gerät; auf jedem weiteren Gerät schaltest du sie erneut ein.'
                 :'Bestätige zuerst deine E-Mail-Adresse – vorher verschickt die App keine Mail an dich. Den Weg dazu findest du unter Profil › E-Mail.')));

  h+=groupHTML('Prüfen',[
    acActRow({icon:'zap',title:'Test-Mitteilung senden',
      sub:'Zeigt sofort eine Mitteilung auf diesem Gerät',tap:'lpTestNotification()',id:'lp_testRow'})],
    'Die Test-Mitteilung zeichnet der Dienst dieses Geräts. Sie beweist, dass Erlaubnis, '
    +'Sperrbildschirm und Ton stimmen – nicht, dass eine Mitteilung vom Server ankommt.');

  if(athlete){
    const ph=u.push_hour==null?'':String(u.push_hour);
    const mh=u.mindset_push_hour==null?'':String(u.mindset_push_hour);
    h+=groupHTML('Deine Uhrzeiten',[
      rowHTML({icon:'timer',title:'Trainings-Erinnerung',sub:'An Trainingstagen zur vollen Stunde',
        value:ph?ph+' Uhr':'Aus',tap:"acHourSheet('push')",id:'pf_pushHourRow'}),
      rowHTML({icon:'brain',title:'Priming-Erinnerung',sub:'Solange heute noch kein Priming gespeichert ist',
        value:mh?mh+' Uhr':'Aus',tap:"acHourSheet('mind')",id:'pf_mindHourRow'}),
      rowHTML({icon:'moon',title:'Abend-Reflexion',sub:'Erinnerung um 20 Uhr',
        switch:{name:'evening',on:!!u.evening_push},id:'pf_eveRow'})],
      'Deutsche Zeit. War der Server zur vollen Stunde gerade neu gestartet, kommt die Erinnerung '
      +'bis zu drei Stunden später nach. „Aus" betrifft immer nur diese eine Erinnerung – und ohne '
      +'eingeschaltete Push-Mitteilungen kommt keine von ihnen an.');
    h+=lpOtherPushHTML();
  }
  return h;}
// Die uebrigen Push-Arten – was der Server wirklich verschickt, mit dem Fenster aus cronTick.
// Reine Anzeige: jede Zeile haengt an EINEM Schalter, naemlich „Push-Mitteilungen" ganz oben.
function lpOtherPushHTML(){
  const rows=[
    ['calendar','Dein Wochenrückblick','Sonntag ab 18 Uhr · Nachricht in der App, Push und (mit bestätigter Adresse) E-Mail'],
    ['send','Nachrichten deines Coachs','Sofort, wenn dein Coach dir schreibt'],
    ['dumbbell','Planänderungen','Sofort, wenn dein Coach deinen Plan ändert'],
    ['shield','Reparatur eingesetzt','Morgens, wenn ein vergessener Tag automatisch nachgetragen wurde'],
    ['flame','Abend-Hinweis','19–21 Uhr, wenn heute noch kein Check-in da ist']
  ];
  return groupHTML('Was dir die App sonst schickt',
    rows.map(([ic,t,sub])=>rowHTML({icon:ic,title:t,sub:sub})),
    'Diese fünf haben keinen eigenen Schalter – sie hängen am Schalter „Push-Mitteilungen" ganz '
    +'oben. Eine Nachtruhe lässt sich noch nicht einstellen: schreibt dir dein Coach um 2 Uhr, '
    +'kommt die Mitteilung um 2 Uhr. Auch „zuletzt gesendet" kann die App noch nicht anzeigen – '
    +'der Server merkt sich bisher nicht, was er dir schon geschickt hat.');}
// Die Uhrzeit als AUSWAHL AUS EINER LISTE – das ist ein Sheet (3.4), kein zweiter Regler auf der
// Seite. Damit fallen die beiden waagrechten Chip-Reihen weg, die hier eine zweite Steuerebene
// gewesen waeren (G4).
const AC_PUSH_HOURS=['','6','7','8','9','10','12','16','17','18','19','20'];
const AC_MIND_HOURS=['','5','6','7','8','9','10'];
function acHourSheet(kind){
  const mind=kind==='mind';
  const cur=mind?(ME.mindset_push_hour==null?'':String(ME.mindset_push_hour))
                :(ME.push_hour==null?'':String(ME.push_hour));
  const list=mind?AC_MIND_HOURS:AC_PUSH_HOURS;
  openSheet(mind?'Priming-Erinnerung':'Trainings-Erinnerung',
    acPickGroup('Uhrzeit',list.map(v=>rowHTML({
        title:v===''?'Keine Erinnerung':v+' Uhr',
        value:v===cur?'✓':'',
        tap:`acHourPick('${esc(kind)}','${esc(v)}')`})),
      mind?'„Zeit für dein Priming" zur gewählten Stunde, solange heute noch kein Priming gespeichert ist.'
          :'An Trainingstagen zur vollen Stunde, deutsche Zeit. Ohne eingeschaltete Push-Mitteilungen kommt sie nicht an.'));}
async function acHourPick(kind,v){
  const mind=kind==='mind';
  closeModal();
  if(mind){await saveMindsetReminders({hour:v===''?null:parseInt(v,10)});}
  else{await pfPushHour(v);}
  acRepaint('erinnerungen',acNotifHTML(acMailCfg===false),{onMount:acNotifMount});
  refreshProfileHub();}
// Test-Mitteilung: wird LOKAL vom Service Worker dieses Geraets gezeichnet. Das beweist Erlaubnis,
// Service Worker und Anzeige – NICHT die Zustellung vom Server. Genau das steht auch im Fusstext.
async function lpTestNotification(){
  const row=document.getElementById('lp_testRow');
  const sub=row&&row.querySelector('.rl small');
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
// Trainings-Erinnerung: Stunde als String, '' = Aus. Aus setzt push_hour ueber den reset-Weg auf NULL.
async function pfPushHour(v){
  v=String(v==null?'':v);const cur=ME.push_hour==null?'':String(ME.push_hour);
  if(v===cur)return true;const off=v==='';
  return await profileSave(off?{push_hour:'',reset:['push_hour']}:{push_hour:parseInt(v,10)},
    {msg:off?'Trainings-Erinnerung aus':'Erinnerung um '+v+' Uhr ✓',hub:false});}
function toggleEvePush(el){saveMindsetReminders({evening:el&&el.checked?1:0});}
async function toggleEmailNotif(on,el){
  const r=await API.post('/notifications',{email_notifications:!!on});
  if(r.status!==200){if(el)el.checked=!on;return toast(r.data?.error||'Fehler');}
  if(ME)ME.email_notifications=on?1:0;
  toast(on?'E-Mail-Benachrichtigungen an ✓':'E-Mail-Benachrichtigungen aus');}
// Mindset-Erinnerungen: Priming-Stunde und Abend-Reflexion sofort speichern. Teil-Update: nur diese
// zwei Schluessel – Priming-Dauer und Grundbeduerfnisse bleiben unangetastet.
async function saveMindsetReminders(o){o=o||{};
  const hour=o.hour!==undefined?o.hour:(ME.mindset_push_hour==null?null:+ME.mindset_push_hour);
  const eve=o.evening!==undefined?o.evening:(ME.evening_push?1:0);
  const r=await API.put('/mindset/prefs',{mindset_push_hour:hour,evening_push:eve});
  if(r.status===200){if(ME){ME.mindset_push_hour=hour;ME.evening_push=eve;}
    try{if(typeof MIND_TODAY!=='undefined'&&MIND_TODAY&&MIND_TODAY.prefs)Object.assign(MIND_TODAY.prefs,{mindset_push_hour:hour,evening_push:eve});}catch(e){}
    toast(hour==null&&!eve?'Mindset-Erinnerungen aus':'Mindset-Erinnerungen gespeichert ✓');return true;}
  toast(r.data?.error||'Fehler');return false;}
// --- Push-Status: Berechtigung + vorhandenes Abo auf DIESEM Geraet ---
function isIOS(){return /iphone|ipod|ipad/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function isStandalone(){try{return window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;}catch(e){return false;}}
async function pushStatus(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return{state:'unsupported',text:'Auf diesem Gerät nicht verfügbar'};
  if(isIOS()&&!isStandalone())return{state:'install',text:'Zuerst zum Startbildschirm hinzufügen'};
  if(Notification.permission==='denied')return{state:'blocked',text:isIOS()?'Blockiert – iOS Einstellungen › BE INEVITABLE › Mitteilungen':'Blockiert – in den Browser-Einstellungen erlauben'};
  let sub=null;try{const reg=await navigator.serviceWorker.getRegistration('/sw.js');if(reg)sub=await reg.pushManager.getSubscription();}catch(e){}
  if(sub&&Notification.permission==='granted')return{state:'on',text:'Aktiv auf diesem Gerät',sub};
  return{state:'off',text:'Aus – hier einschalten'};}
// Alles, was ohne Push nichts bewirkt, folgt dem echten Geraetestatus (M2a): die beiden
// Uhrzeit-Zeilen und die Abend-Reflexion bleiben gesperrt, solange Push aus ist.
async function renderPushRow(){const st=await pushStatus();const on=st.state==='on';
  const row=document.getElementById('pf_pushRow');
  if(row){const s=row.querySelector('.rl small');if(s)s.textContent=st.text;
    const sw=row.querySelector('input.sw');
    if(sw){sw.checked=on;sw.disabled=(st.state==='unsupported'||st.state==='blocked');}}
  // Die drei Erinnerungen bleiben BEDIENBAR, auch wenn Push aus ist - aber jede sagt in ihrer
  // Unterzeile, dass ohne Push nichts ankommt. Ein gesperrtes Bedienelement ohne Grund daneben ist
  // dasselbe Versteck wie ein ausgeblendetes (G5); der alte Weg sperrte und erklaerte erst nach
  // einem Tipp in einem Toast.
  const warn='Kommt erst an, wenn die Push-Mitteilungen oben eingeschaltet sind';
  const setSub=(id,txt)=>{const r=document.getElementById(id);if(!r)return;
    const s=r.querySelector('.rl small');if(s)s.textContent=txt;};
  if(!on){setSub('pf_pushHourRow',warn);setSub('pf_mindHourRow',warn);setSub('pf_eveRow',warn);}
  else{setSub('pf_pushHourRow','An Trainingstagen zur vollen Stunde');
       setSub('pf_mindHourRow','Solange heute noch kein Priming gespeichert ist');
       setSub('pf_eveRow','Erinnerung um 20 Uhr');}
  acPushPaint();}
// Die Zeile im Profil sagt, was auf diesem Geraet wirklich laeuft – nicht nur, was eingestellt ist.
async function acPushPaint(){
  if(!document.getElementById('pf_notifRow'))return;
  let st;try{st=await pushStatus();}catch(e){return;}
  const r=document.getElementById('pf_notifRow');if(!r)return;
  const rr=r.querySelector('.rr'),sm=r.querySelector('.rl small');
  const ph=ME&&ME.push_hour!=null?String(ME.push_hour):null;
  if(st.state!=='on'){if(rr)rr.textContent='Aus';
    if(sm)sm.textContent='Push-Mitteilungen sind auf diesem Gerät aus – ohne sie kommt keine Erinnerung an';return;}
  if(rr)rr.textContent=ph?ph+' Uhr':'An';
  if(sm)sm.textContent=ph?('An Trainingstagen um '+ph+' Uhr'):'An – aber keine Trainings-Erinnerung eingestellt';}
async function togglePush(el){const st=await pushStatus();
  if(st.state==='on'){try{await API.del('/push/subscribe',{endpoint:st.sub.endpoint});await st.sub.unsubscribe();}catch(e){console.error('[push]',e);}
    toast('Push-Mitteilungen aus');renderPushRow();return;}
  if(st.state==='install'){if(el)el.checked=false;return openInstallSheet();}
  if(st.state==='blocked'||st.state==='unsupported'){if(el)el.checked=false;return toast(st.text);}
  await enablePush();renderPushRow();}
// „Daten & Verbindungen" und „Hilfe" waren eigene Unter-Sheets. Ihre Zeilen stehen jetzt als
// Abschnitte AUF der Profilseite – die beiden Namen bleiben trotzdem, weil die Suche sie als
// Kurzweg kennt. Sie fuehren dorthin, wo die Sache steht, und markieren sie kurz.
function openDataSheet(){return acProfileOpen({focus:'daten'});}
function openHelpSheet(){return acProfileOpen({focus:'hilfe'});}

// ===== A-II.4: EINWILLIGUNG, WER-SIEHT-WAS, KI-SCHALTER, HILFE-FREIGABE (Präfix lg) =====
// Alles, was mit „wer darf was von mir sehen" zu tun hat, steht an EINER Stelle: Profil →
// „Wer sieht was".

// Eine Zeile, die auf eine echte Seite fuehrt (kein onclick): die Rechtstexte muessen auch dann
// funktionieren, wenn die App klemmt. target=_blank, damit die geoeffnete App stehenbleibt.
// Bewusst von Hand gebaut und nicht ueber rowHTML(): der Helfer kennt nur <button>, und ein Knopf
// mit window.open() waere fuer genau diesen Fall der falsche Baustein. Klassen, Aufbau und Chevron
// sind Zeichen fuer Zeichen die der .row.tap – es entsteht keine zweite Zeilenform.
function lgLinkRow(href,ic,label,sub){
  return `<a class="row tap" href="${href}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">
    <span class="r-ic">${icon(ic,24)}</span><span class="rl">${esc2(label)}${sub?`<small>${esc2(sub)}</small>`:''}</span>
    <span class="chev" aria-hidden="true"></span></a>`;}

// Untertitel der Einwilligungs-Zeile: Datum, wenn der Server es liefert – sonst der ehrliche Zustand.
function lgConsentSub(){const u=ME||{};
  if(u.consent_health_at&&typeof lgConsentMissing==='function'&&lgConsentMissing(u))return 'Neue Fassung – bitte bestätigen';
  if(u.consent_health_at)return 'Erteilt am '+fmtDate(u.consent_health_at);
  let pend=null;try{pend=localStorage.getItem('be_consent_pending');}catch(e){}
  return pend?'Auf diesem Gerät erteilt, noch nicht beim Server angekommen':'Noch nicht erteilt';}
function lgGrantSubText(){const min=lgGrantMinutesLeft();
  if(LG_GRANT&&LG_GRANT.available===false)return 'In dieser Fassung noch nicht verfügbar';
  return min>0?('Läuft noch '+fmtNum(min)+' Min.'):'Aus – nur mit deiner Freigabe';}

// --- Schalter: KI-Analyse (DECISIONS F5, Standard AUS) ---
// Eigene Route `POST /api/ai/consent`, NICHT PUT /api/profile: der Schalter ist eine Einwilligung,
// kein Profilfeld – er wird protokolliert und darf nicht nebenbei mitgespeichert werden.
// Wir uebernehmen den Zustand aus der ANTWORT des Servers, nicht aus dem Klick.
async function lgAiSet(on,el){
  const paint=v=>{if(el)el.checked=!!v;};
  if(el)el.disabled=true;
  const r=await API.post('/ai/consent',{ai_consent:!!on});
  if(el)el.disabled=false;
  if(r.status===404){paint(!on);return toast('Dafür braucht der Server ein Update – bitte den Betreiber informieren.');}
  if(r.status!==200){paint(!on);return toast(r.data?.error||'Der Schalter wurde nicht geändert.');}
  const got=Number(r.data?.ai_consent||0);
  paint(got===1);if(ME)ME.ai_consent=got;
  toast(got?'KI-Analyse erlaubt ✓':'KI-Analyse aus – dein Coach bekommt keine mehr');}
function lgAiToggle(el){return lgAiSet(el&&el.checked!==undefined?el.checked:!(el&&el.classList&&el.classList.contains('on')),el);}

// --- Unterseite: Wer sieht was ---
// Die Tabelle sagt den Stand NACH dieser Welle: der Betreiber ist Betreiber, nicht Ueber-Coach.
// Sie wird bewusst hier gepflegt und nicht aus dem Server geholt – eine Tabelle, die sich selbst
// schoenrechnet, waere wertlos. Stimmt eine Zeile nicht mehr, gehoert sie hier korrigiert.
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
  ['Dein Passwort','nur du','kann neues vergeben','nur Link **'],
  ['Anzahl Konten, Fehler, Laufzeiten','–','–','ja'],
  ['Vollständige Sicherung','–','–','ja, protokolliert']
];
function lgWhoCell(v){const t=String(v);
  const short=t==='ja'||t==='nein'||t==='–';
  const col=t==='ja'?'var(--green)':(t==='nein'||t==='–'?'var(--ink3)':'var(--ink2)');
  return `<td class="lg-who-c${short?' s':''}" style="color:${col}">${esc2(t)}</td>`;}
function lgOpenWhoSheet(){
  const head=['Daten','Du','Coach','Betreiber'].map((h,i)=>`<th scope="col"${i?'':' class="k"'}>${h}</th>`).join('');
  const body=LG_WHO_ROWS.map(r=>`<tr><th scope="row">${esc2(r[0])}</th>${lgWhoCell(r[1])}${lgWhoCell(r[2])}${lgWhoCell(r[3])}</tr>`).join('');
  const ai=!!Number((ME||{}).ai_consent||0);
  acSub('wersiehtwas','Wer sieht was',
    `<p class="rows-f">Drei Sichten: du, dein Coach und der Betreiber. Der Betreiber hält die App am Laufen – in der App sieht er Zahlen und Zustände, keine Gesundheitsdaten. Zwei Ausnahmen stehen weiter unten: die Hilfe-Freigabe und die vollständige Sicherung.</p>
    <div class="lg-who"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <p class="rows-f">* Der Betreiber findet ein Konto nur, wenn er die E-Mail-Adresse genau eingibt – eine Liste aller Adressen gibt es nicht. Jede Suche steht im Protokoll.<br>
    ** Dein Passwort kann niemand lesen – es liegt nur als Prüfsumme in der Datenbank. Kommst du nicht mehr hinein, erzeugt der Betreiber einen einmaligen Link (72 Stunden, einmal gültig); dein bisheriges Passwort bleibt gültig, bis du den Link benutzt, und das neue setzt du selbst. Dein Coach dagegen kann dir ein neues Passwort vergeben – du wirst dabei überall abgemeldet und bekommst eine Nachricht.</p>`
    +groupHTML('KI-Analyse',[
      rowHTML({icon:'sparkles',title:'KI-Analyse durch meinen Coach erlauben',sub:'Standard: aus',
        switch:{name:'ai',on:ai},id:'lg_aiRow'})],
      'Eingeschaltet darf dein Coach eine Auswertung anfordern: dabei gehen Ziel, Erfahrung, '
      +'Trainingstage, deine Check-in-Werte der letzten 14 Tage und deine letzten 90 Sätze an '
      +'Anthropic (USA) – ohne deinen Namen und ohne Freitexte. Nach jeder Auswertung bekommst du '
      +'eine Nachricht.')
    +groupHTML('Was daneben gilt',[
      rowHTML({icon:'users',title:'Ein Coach sieht nur seine Athleten',sub:'Übernimmt dich ein Coach, bekommst du eine Nachricht darüber'}),
      rowHTML({icon:'help',title:'Hilfe-Freigabe',sub:'Gibst du sie, sieht der Betreiber '+fmtNum(lgGrantMin())+' Minuten lang so viel wie dein Coach - im Profil unter „Einblick für den Betreiber"'}),
      rowHTML({icon:'shield',title:'Sicherung der Datenbank',sub:'Eine Datei mit allem – verschlüsselt, protokolliert, du bekommst jedes Mal eine Nachricht'})],
      'Damit nach einem Ausfall nichts verloren ist, zieht der Betreiber Sicherungen der ganzen '
      +'Datenbank. Jeder einzelne Zugriff während einer Hilfe-Freigabe steht im Protokoll; danach '
      +'ist die Tür wieder zu.')
    +lgLegalLinksHTML({align:'flex-start'}),{onMount:acBindSwitches});}

// --- Unterseite: Einwilligung ---
// Drei Zustaende, nicht zwei: erteilt · gar nicht erteilt · erteilt, aber der Text hat sich seither
// geaendert (der Server antwortet dann ebenfalls 409, `reason:'version'`).
function lgOpenConsentSheet(){const u=ME||{};
  const stale=!!(u.consent_health_at&&typeof lgConsentMissing==='function'&&lgConsentMissing(u));
  const given=!!u.consent_health_at&&!stale;
  const kopf=given
    ?rowHTML({icon:'check',title:'Erteilt',sub:'am '+fmtDate(u.consent_health_at)+(u.consent_version?' · Fassung '+u.consent_version:'')})
    :(stale
      ?rowHTML({icon:'alertTriangle',title:'Neue Fassung offen',sub:'Bis du sie bestätigst, speichert die App keine neuen Gesundheitswerte'})
      :rowHTML({icon:'alertTriangle',title:'Noch nicht erteilt',sub:'Ohne sie kann die App keine neuen Gesundheitswerte speichern'}));
  const akt=given
    ?acActRow({icon:'x',title:'Einwilligung widerrufen',sub:'Gilt ab sofort – dein bisheriger Verlauf bleibt',tap:'lgConsentRevokeAsk()'})
    :acActRow({icon:'check',title:stale?'Neue Fassung bestätigen':'Einwilligung erteilen',sub:'Danach speichert die App deine Werte wieder',tap:'lgConsentGrant()'});
  acSub('einwilligung','Einwilligung',
    groupHTML('Stand',[kopf,akt],
      'Das betrifft Gewicht, Schlaf, Puls, HRV, Körpermaße, Fotos und Stimmung – nach Artikel 9 '
      +'DSGVO besondere Daten, die es ohne dein ausdrückliches Ja nicht geben darf. Dazu deine '
      +'Notizen (Check-in, Mindset, Reflexion), soweit sie etwas über deine Gesundheit sagen.')
    +groupHTML('Nachlesen',[lgLinkRow(LG_PRIVACY_URL,'shield','Datenschutz','Der ganze Text: Zwecke, Empfänger, Fristen')],
      'Der Widerruf gilt ab sofort; was bis dahin geschah, bleibt rechtmäßig. Danach speichert die '
      +'App keine neuen Gesundheitswerte mehr – dein Konto und dein bisheriger Verlauf bleiben, bis '
      +'du sie löschst. Eine laufende Hilfe-Freigabe wird dabei geschlossen; die KI-Analyse ist ein '
      +'eigener Schalter, den du im selben Schritt mit abschalten kannst. Ganz weg willst du? '
      +'Profil → „Konto löschen" entfernt alles in einem Zug.'));}
// Der Weg zurueck. Ohne ihn waere der Widerruf eine Einbahnstrasse.
async function lgConsentGrant(){
  const ok=await lgConsentSend();
  if(!ok)return toast('Das hat nicht geklappt – bitte erneut versuchen.');
  const me=await API.get('/me');if(me.status===200&&me.data&&me.data.user)ME=me.data.user;
  toast('Einwilligung erteilt ✓');
  popPage();refreshProfileHub();}
// Nachbesserung A-II: Der Dialog zaehlte nur Check-in, Masse, Fotos und Health-Import auf – und
// liess damit die zwei Dinge ungenannt, die den Widerruf erst vollstaendig machen:
//   · die laufende Freigabe schliesst der SERVER beim Widerruf selbst (DELETE /api/consent);
//   · der KI-Schalter ist eine eigene Einwilligung und bleibt deshalb eine Wahl – vorbelegt mit
//     „mit abschalten", weil niemand seine Gesundheitsdaten zurueckzieht und sie gleichzeitig in
//     die USA schicken will.
// Eigenes Sheet statt confirmSheet(): confirmSheet escapt seinen Text und kennt kein Haekchen.
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
  // Das Haekchen VOR dem ersten await lesen: danach kann das Sheet schon zu sein.
  const alsoAi=!!(document.getElementById('lg_revokeAi')||{}).checked;
  const r=await API.del('/consent',{});
  if(r.status===200){try{localStorage.removeItem('be_consent_pending');}catch(e){}
    let aiLeft=false;
    if(alsoAi){const a=await API.post('/ai/consent',{ai_consent:false});if(a.status!==200)aiLeft=true;}
    if(LG_GRANT&&typeof LG_GRANT==='object'){LG_GRANT.active=null;lgSupportPaint();}
    const me=await API.get('/me');if(me.status===200&&me.data&&me.data.user)ME=me.data.user;
    closeAllSheets();
    toast(aiLeft?'Einwilligung widerrufen – die KI-Analyse blieb an, bitte im Profil prüfen'
      :(alsoAi?'Einwilligung widerrufen · KI-Analyse aus':'Einwilligung widerrufen'));
    popPage();refreshProfileHub();return;}
  if(r.status===404)return toast('Dafür braucht der Server ein Update – bitte den Betreiber informieren.');
  toast(r.data?.error||'Das hat nicht geklappt – bitte erneut versuchen.');}

// --- Unterseite: Hilfe-Freigabe ---
// Der Athlet oeffnet dem Betreiber die Tuer, 30 Minuten, jederzeit widerrufbar, jeder Zugriff
// protokolliert. Kennt der Server die Routen noch nicht (404), sagt die Oberflaeche das – statt
// einen Knopf anzubieten, der nichts tut.
let LG_GRANT=null;            // null = noch nicht geladen
let LG_GRANT_REASON='';       // gewaehlter Grund
function lgGrantMin(){return (LG_GRANT&&+LG_GRANT.minutes>0)?+LG_GRANT.minutes:30;}
// Die Gruende kommen vom Server (SUPPORT_REASONS). Die Ersatzliste steht bewusst IN der Funktion:
// ein Objektliteral auf oberster Ebene mit dem Schluessel `data` liest dup_check.py als zweite
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
  const row=document.getElementById('pf_grantRow');
  if(row){const s=row.querySelector('.rl small');if(s)s.textContent=lgGrantSubText();}
  acRepaint('freigabe',lgSupportHTML());}
function lgSupportBodyHTML(){
  if(LG_GRANT===null)return `<div class="spinner"></div>`;
  if(LG_GRANT.available===false)
    return groupHTML('Stand',[rowHTML({icon:'shield',title:'Noch nicht verfügbar',
      sub:'Diese Fassung des Servers kennt die Hilfe-Freigabe nicht'})],
      'Bis dahin kommt der Betreiber nicht an deine Gesundheitsdaten – auch nicht auf Nachfrage.');
  const min=lgGrantMinutesLeft(),R=lgGrantReasons();
  if(min>0){const g=LG_GRANT.active||{};
    return groupHTML('Stand',[
      rowHTML({icon:'eye',title:'Der Betreiber hat gerade Einblick',
        sub:(g.reason&&R[g.reason]?'Grund: '+R[g.reason]+' · ':'')+'danach schließt sich die Tür von selbst',
        value:fmtNum(min)+' Min.'})],
      'Jeder Zugriff in dieser Zeit steht im Protokoll.')
      +groupHTML('',[rowHTML({title:'Freigabe sofort zurücknehmen',tap:'lgSupportRevoke()',danger:true})],
      'Danach ist die Tür sofort zu - ohne auf die restlichen Minuten zu warten.');}
  return groupHTML('Stand',[rowHTML({icon:'lock',title:'Gerade kein Einblick',
      sub:'Der Betreiber sieht deine Gesundheitsdaten nicht'})],
      'Sag kurz, worum es geht – das steht später im Protokoll.')
    +`<div class="chip-row wrap" id="lg_grantReasons">${Object.keys(R).map(k=>
      `<button type="button" class="chip${LG_GRANT_REASON===k?' on':''}" data-v="${esc2(k)}" onclick="lgGrantPickReason('${esc(k)}')">${esc2(R[k])}</button>`).join('')}</div>`
    +groupHTML('',[acActRow({icon:'help',title:'Betreiber für '+fmtNum(lgGrantMin())+' Minuten Einblick geben',
        sub:'Er sieht dann so viel wie dein Coach',tap:'lgSupportGrant()',id:'lg_grantGo'})],
      'Ohne gewählten Grund geht es nicht – der Grund steht im Protokoll.')
    +`<div id="lg_grantErr" class="hidden err" role="alert"></div>`;}
function lgSupportHTML(){
  return groupHTML('Was die Freigabe bedeutet',[
    rowHTML({icon:'timer',title:'Sie läuft von selbst ab',sub:'Nach '+fmtNum(lgGrantMin())+' Minuten ist sie weg, ohne dass du etwas tun musst'}),
    rowHTML({icon:'x',title:'Du kannst sie jederzeit beenden',sub:'Ein Tipp auf „Zurücknehmen" genügt'}),
    rowHTML({icon:'fileSpreadsheet',title:'Jeder Zugriff wird protokolliert',sub:'Was der Betreiber in dieser Zeit ansieht, steht im Protokoll'})],
    'Wenn etwas klemmt und nur der Betreiber es lösen kann, gibst du ihm hier für '
    +fmtNum(lgGrantMin())+' Minuten Einblick.')
    +`<div id="lg_grantBox">${lgSupportBodyHTML()}</div>`
    +`<p class="rows-f">Ohne diese Freigabe sieht der Betreiber deine Gesundheitsdaten in der App nicht – es gibt keinen „als Nutzer anmelden"-Knopf, und dein Passwort kann er weder lesen noch setzen. Kommst du nicht mehr in dein Konto, erzeugt er dafür nur einen einmaligen Link; das neue Passwort setzt du selbst, und du bekommst darüber sofort eine Nachricht. Was es daneben gibt: die vollständige Sicherung der Datenbank für den Notfall – darüber bekommst du jedes Mal eine Nachricht.</p>`;}
function lgGrantPickReason(k){LG_GRANT_REASON=String(k||'');
  document.querySelectorAll('#lg_grantReasons .chip').forEach(c=>c.classList.toggle('on',c.dataset.v===LG_GRANT_REASON));
  document.getElementById('lg_grantErr')?.classList.add('hidden');}
function lgOpenSupportSheet(){
  if(LG_GRANT===null)lgSupportLoad();
  acSub('freigabe','Einblick für den Betreiber',lgSupportHTML());}
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

// --- Der Installations-Trichter (BUILD-A5 5.1) bleibt ein Sheet ---
// Es ist eine abgeschlossene Nebenaufgabe mit drei Bildern und drei Schritten – man laesst sie
// nicht halb erledigt liegen (3.4). Es gibt nur diesen einen Ort dafuer: home.js oeffnet ihn nach
// dem ersten abgeschlossenen Training, das Profil ueber „Als App installieren", und auf iOS fuehrt
// auch der Push-Schalter hierher – Web-Push gibt es dort nur fuer die installierte App.
function openInstallSheet(){let h;
  const bilder=(typeof lpStepsHTML==='function')?lpStepsHTML():'';
  const anderer=(typeof lpOtherWayText==='function')?esc2(lpOtherWayText()):'';
  if(isStandalone())h=`<div class="note ok mb-4">BE INEVITABLE läuft auf diesem Gerät bereits als App.</div>`;
  else if(isIOS())h=`<p class="body mb-2">Ohne Browserleiste, offline nutzbar – und nur so kann die App dich überhaupt erinnern. Drei Schritte in Safari:</p>
    ${bilder}`
    +groupHTML('',[
      rowHTML({icon:'share',title:'In Safari auf „Teilen" tippen',sub:'Das Quadrat mit dem Pfeil nach oben, unten in der Leiste'}),
      rowHTML({icon:'home',title:'„Zum Home-Bildschirm" wählen',sub:'Etwas weiter unten in der Liste'}),
      rowHTML({icon:'check',title:'Oben rechts „Hinzufügen"',sub:'Danach die App vom Home-Bildschirm starten'})],anderer);
  else if(/android/i.test(navigator.userAgent))h=`<p class="body mb-2">Ohne Browserleiste, offline nutzbar, eigenes Symbol auf dem Startbildschirm. So geht es:</p>
    ${bilder}`
    +groupHTML('',[
      rowHTML({icon:'more',title:'Browser-Menü öffnen',sub:'Die drei Punkte oben rechts'}),
      rowHTML({icon:'check',title:'„App installieren" oder „Zum Startbildschirm"',sub:'Danach die App vom Startbildschirm öffnen'})],anderer);
  else h=`<p class="body mb-2">Ohne Browserleiste und als eigenes Fenster – so geht es am Rechner:</p>
    ${bilder}<p class="rows-f">${anderer}</p>`;
  const titel=(!isStandalone()&&!isIOS()&&!/android/i.test(navigator.userAgent))
    ?'Als App installieren':'Auf den Startbildschirm legen';
  openSheet(titel,h+`<button class="btn block sec" onclick="closeModal()">${isStandalone()?'Alles klar':'Später'}</button>`);}

// „Alle Geraete abmelden": kurze Rueckfrage, damit niemand aus Versehen das Tablet der Familie rauswirft.
function confirmLogoutAll(){confirmSheet('Alle Geräte abmelden','Jedes andere Gerät, auf dem du angemeldet bist, muss sich danach neu anmelden. Dieses Gerät bleibt angemeldet.',{label:'Alle anderen abmelden',danger:false,onYes:()=>logoutAll()});}
// --- Konto selbst loeschen (V4): Passwort + zweistufige Rueckfrage, dann DELETE /api/me ---
// Stufe 1 sagt, WAS weg ist, und bietet vorher den Export an. Stufe 2 ist die letzte Rueckfrage.
// Bleibt ein Sheet: eine Bestaetigung, die man nicht halb erledigt liegen laesst (3.4).
function openDeleteAccount(){
  openSheet('Konto löschen',`<form id="delForm" onsubmit="deleteAccountStep2();return false" novalidate>
    <div class="note err mb-3"><b>Das ist endgültig.</b> Gelöscht werden dein Konto und ALLES darin: Trainingsplan und Sätze, Check-ins, Körpermaße, Fotos, Ernährungsprotokoll und Rezepte, Nachrichten, Mindset-Einträge, Gesundheitsdaten und Push-Abos. Es gibt keine Wiederherstellung – auch nicht durch den Betreiber.</div>
    <p class="body muted mb-3">Willst du deine Daten vorher behalten? Der Export enthält alles als eine Datei.</p>
    <button class="btn block sec mb-4" type="button" onclick="exportMyData()">${icon('download',18)} Erst meine Daten exportieren</button>
    ${pwField({id:'del_pw',label:'Zur Bestätigung dein Passwort',autocomplete:'current-password',enterkeyhint:'done'})}
    <button class="btn block danger" type="submit">Weiter zur letzten Rückfrage</button>
    <button class="btn block sec mt-2" type="button" onclick="closeModal()">Abbrechen</button></form>`);
  setTimeout(()=>document.getElementById('del_pw')?.focus({preventScroll:true}),380);}
// Das Passwort wandert fuer die Dauer der zweiten Rueckfrage in eine Variable (nie in den Speicher
// des Geraets): das Feld liegt nach dem Sheet-Wechsel nur noch als HTML im Stapel, sein Wert nicht.
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
    const uid=ME&&ME.id;ME=null;
    try{clearAccountStorage(uid);}catch(e){}
    try{sessionStorage.setItem('be_relogin','Dein Konto wurde gelöscht. Danke, dass du dabei warst.');}catch(e){}
    location.reload();return;}
  if(btn){btn.disabled=false;btn.textContent='Ja, mein Konto endgültig löschen';}
  if(r.status===404)return toast('Dafür braucht der Server ein Update – bitte den Betreiber informieren.');
  if(r.status===401){closeModal();setTimeout(()=>showFieldErr('delForm',r.data?.error||'Passwort falsch.','del_pw'),50);return;}
  toast(r.data?.error||'Löschen fehlgeschlagen – bitte erneut versuchen.');}
// --- Avatar ---
function avatarPick(ev){const file=ev.target.files&&ev.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=async()=>{
    // quadratisch zuschneiden + auf 256 px skalieren (klein halten)
    const size=256;const cv=document.createElement('canvas');cv.width=size;cv.height=size;
    const m=Math.min(img.width,img.height);const sx=(img.width-m)/2, sy=(img.height-m)/2;
    cv.getContext('2d').drawImage(img,sx,sy,m,m,0,0,size,size);
    const data=cv.toDataURL('image/jpeg',0.82);
    const r=await API.post('/avatar',{avatar:data});
    if(r.status===200){ME.has_avatar=true;_PF_AVATAR_URL=data;
      if(typeof applyAvatar==='function')applyAvatar();
      acRepaint('name',acNameHTML());refreshProfileHub();toast('Profilbild gespeichert ✓');}
    else toast(r.data?.error||'Fehler');
  };img.src=e.target.result;};reader.readAsDataURL(file);}
async function removeAvatar(){
  if(!ME||!ME.has_avatar)return toast('Zurzeit ist kein Bild gesetzt.');
  const r=await API.post('/avatar',{avatar:null});
  if(r.status!==200)return toast('Fehler');
  ME.has_avatar=false;_PF_AVATAR_URL=null;
  if(typeof applyAvatar==='function')applyAvatar();
  acRepaint('name',acNameHTML());refreshProfileHub();toast('Profilbild entfernt');}
// --- Passwort aendern: bleibt ein Sheet (Formular mit Abbrechen und einem Speichern-Knopf) ---
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
  // Nach 200 hat DIESES Gerät in derselben Antwort ein frisches Cookie bekommen (V1): kein Neu-Anmelden
  // hier, nur die anderen Geräte fliegen raus.
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
      ${days.length?`<h2 class="rows-h">Zu welchem Trainingstag hinzufügen?</h2><div class="rows mb-3">`+
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

// ===== APPLE HEALTH (DESIGN-4 6.11: die Aufklapper entfallen) =====
// openAppleHealth/importShortcutText/showImportPreview stehen NUR hier – analysis.js hat keine
// gleichnamigen Definitionen. Was dort liegt und deshalb nachgeladen werden muss: parseShortcutData,
// handleHealthFile, doHealthImport – siehe bootHealth*() weiter unten.
// Zwei Aenderungen gegenueber 3.0.2:
//   1. Aus dem Sheet wird eine PUSH-SEITE. Die Einrichtung dauert laut eigener Anleitung zehn
//      Minuten und man laesst sie halb erledigt liegen – das ist die Pruefrage aus 3.4.
//   2. Die drei Aufklapper (.pf-details) sind WEG (G5/6.11). Ein Aufklapper versteckt; die
//      Anleitung, die man genau hier braucht, stand hinter einem Dreieck. Sie steht jetzt offen da,
//      als Abschnitt mit Ueberschrift, nummerierten Zeilen und Fusstext – ohne eine weitere Ebene
//      aufzumachen (N3: die Seite ist schon Ebene 2).
let _HL=null; // zuletzt geladener Stand des persoenlichen Links
async function openAppleHealth(){acHealthOpen('<div class="spinner"></div>');
  const r=await API.get('/health/link');_HL=r.status===200?r.data:{enabled:false};
  drawAppleHealth();}
function acHealthOpen(html){
  if(typeof pushPage!=='function')return openSheet('Apple Health',html);
  if(acRepaint('health',html))return;
  let eltern=acParent();
  try{if(typeof PUSH_STACK!=='undefined'){const t=PUSH_STACK[PUSH_STACK.length-1];
    if(t&&t.key==='profil')eltern=t.title||'Profil';}}catch(e){}
  pushPage('health','Apple Health',eltern,html,{sub:'Schlaf, Schritte, Puls und Gewicht vom iPhone'});}
function drawAppleHealth(){const h=_HL||{enabled:false};
  const last=h.last?fmtDateTime(h.last):null;
  let t='';
  if(h.enabled){
    t+=groupHTML('Automatische Übertragung',[
      rowHTML({icon:'check',title:'Eingerichtet',
        sub:last?('Zuletzt angekommen: '+last):'Noch nichts angekommen – starte den Kurzbefehl einmal von Hand',
        value:'aktiv'}),
      acActRow({icon:'copy',title:'Link kopieren',sub:'Im Kurzbefehl bei „Inhalte von URL abrufen" einsetzen',tap:'copyHealthLink()'}),
      acActRow({icon:'refresh',title:'Link neu erzeugen',sub:'Macht den alten sofort ungültig',tap:'rotateHealthLink()'})],
      'Dein persönlicher Link darf nur eines: Gesundheitswerte eintragen. Kein Login, keine '
      +'Einsicht in deine Daten. Trotzdem: nicht weitergeben.');
    t+=`<div class="card sub sh-link" id="hlUrl">${esc2(h.url||'')}</div>`;
    t+=groupHTML('',[rowHTML({title:'Übertragung abschalten',tap:'disableHealthLink()',danger:true})],
      'Dein iPhone kann danach nichts mehr schicken. Bereits übertragene Werte bleiben erhalten.');
    t+=_shortcutSteps();
  }else{
    t+=groupHTML('Automatische Übertragung',[
      acActRow({icon:'zap',title:'Jetzt einrichten',
        sub:'Du bekommst einen persönlichen Link und eine Anleitung – einmalig etwa 10 Minuten',
        tap:'enableHealthLink()'})],
      'Dein iPhone kann Schlaf, Schritte, Verbrauch, Puls und Gewicht jede Nacht von selbst '
      +'herüberschicken – über einen Kurzbefehl, ganz ohne dich.');
  }
  t+=`<h2 class="rows-h">Von Hand übertragen</h2>
    <div class="field"><label for="sc_text">Werte aus dem Kurzbefehl einfügen</label><textarea id="sc_text" rows="3" placeholder='{"days":{"2026-06-01":{"weight":75.5,"steps":8200,"sleep":7.5}}}'></textarea></div>
    <button class="btn block sec" onclick="importShortcutText()">Übernehmen</button>
    <input type="file" id="health_file" accept=".json,.txt,.xml,application/json,text/plain,text/xml" class="hidden" onchange="bootHealthFile(this)">
    <button class="btn block ghost mt-2" onclick="document.getElementById('health_file').click()">Datei hochladen (JSON oder Export.xml)</button>
    <p class="rows-f">Beides geht auch ohne eingerichtete Übertragung: Text aus dem Kurzbefehl einfügen oder die Datei wählen, die dein iPhone exportiert hat. Vor dem Speichern zeigt die App, was sie gefunden hat.</p>
    <div id="health_status"></div>`;
  acHealthOpen(t);}
// Die Anleitung steht OFFEN da – hier braucht man sie, und ein Aufklapper haette sie versteckt (G5).
function _shortcutSteps(){
  return groupHTML('Kurzbefehl einrichten',[
    rowHTML({icon:'pencil',title:'Kurzbefehle-App öffnen, neuen Kurzbefehl anlegen',sub:'Das Plus oben rechts'}),
    rowHTML({icon:'bed',title:'„Gesundheitsdaten suchen" → Schlafanalyse, heute',sub:'Danach „Statistik berechnen" → Summe; Variable umbenennen in sleep, in Stunden (durch 60 teilen)'}),
    rowHTML({icon:'footprints',title:'Dasselbe für die übrigen Werte',sub:'Schritte → steps · Aktive Energie → active_kcal · Trainingsminuten → exercise_min · Ruhepuls → resting_hr (Durchschnitt) · Herzfrequenzvariabilität → hrv (Durchschnitt) · Gewicht → weight (letzter Wert)'}),
    rowHTML({icon:'fileSpreadsheet',title:'Aktion „Wörterbuch" mit genau diesen Schlüsseln',sub:'sleep · steps · active_kcal · exercise_min · resting_hr · hrv · weight'}),
    rowHTML({icon:'link',title:'„Inhalte von URL abrufen"',sub:'URL = dein Link von oben · Methode POST · Anfragetext JSON · Inhalt = das Wörterbuch'}),
    rowHTML({icon:'check',title:'Sichern als „BE INEVITABLE Sync" und einmal starten',sub:'Oben sollte danach „Zuletzt angekommen" stehen'})],
    'Lass weg, was du nicht hast – aber nicht hrv: die Herzfrequenzvariabilität ist ein Viertel '
    +'deiner Bereitschaft.')
  +groupHTML('Jede Nacht von selbst',[
    rowHTML({icon:'timer',title:'Kurzbefehle → Automation → Tageszeit',sub:'z. B. 23:50, täglich'}),
    rowHTML({icon:'zap',title:'Kurzbefehl „BE INEVITABLE Sync" wählen',sub:'„Sofort ausführen" an, „Vor dem Ausführen fragen" aus'})],
    'Danach passiert es von allein. Ohne Datum im Wörterbuch zählt der Tag, an dem gesendet wird.')
  +groupHTML('Trainings mitschicken (optional)',[
    rowHTML({icon:'flame',title:'Aktion „Trainings suchen" ergänzen',sub:'Zeitraum heute – und den Schlüssel workouts als Liste mitschicken'}),
    rowHTML({icon:'copy',title:'{"workouts":[{"date":"2026-09-08","kind":"Laufen","minutes":38,"kcal":410,"id":"…"}]}',sub:'Das Feld id (die Trainings-UUID) sorgt dafür, dass dieselbe Einheit nie zweimal ankommt'})],
    'Die Einheiten erscheinen unter Training → Cardio.');}
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
// DIE TOUR IST DIE EINZIGE STELLE, AN DER DIE APP NOCH ERKLÄRT – sie muss deshalb auf Elemente
// zeigen, die es gibt, und sie beim Namen nennen, den sie tragen. Gemessen am laufenden Server
// (d6fix-probe.mjs): `.today` und `#homeCheckin` standen nicht mehr im DOM (die Startseite heisst
// seit D-2 `#homeNow` / `#homeGoals`), `#dietDayBadge` ebenso wenig (seit D-3 `#dtTagKopf`).
// drawTourStep() ueberspringt fehlende Ziele stillschweigend – die Einfuehrung eines neuen Athleten
// schrumpfte dadurch auf der Startseite von vier auf zwei Schritte, ohne dass es jemand sah.
// Dauerhafte Kur: tools/sprache.mjs prueft in jedem Lauf jeden Tour-Selektor gegen das laufende
// DOM der zugehoerigen Reiterwurzel und faellt auf ROT, sobald einer ins Leere zeigt.
// (D-1 zieht seine Workout-Tour zur Laufzeit nach, training.js:2719ff – dieselbe Krankheit,
// dort mit einer Kur, die nur diese eine Tour heilt.)
const TOUR_DEFS={
  home:[
    {sel:'#homeNow',title:'Dein Tag',body:'Hier siehst du sofort, ob heute Training oder Ruhetag ist – und startest mit einem Tipp.',pos:'below'},
    {sel:'#homeGoals',title:'Schnell eintragen',body:'Unter „Heute offen" steht, was dein Tag noch braucht: Check-in, Ernährung, Supplements. Trag ein was du hast, der Rest bleibt leer.',pos:'below'},
    {sel:'#navBar',title:'Alles per Tab',body:'Training, Ernährung, Mindset und Analyse erreichst du jederzeit hier unten. Tippe dich ruhig durch.',pos:'above'},
    {sel:'#avatar',title:'Dein Profil',body:'Profil, Einstellungen, Push-Mitteilungen und Abmelden findest du hier oben.',pos:'below'}
  ],
  workout:[
    {sel:'#daysel',title:'Deine Trainingstage',body:'Wechsle hier zwischen deinen Trainingstagen. Der hervorgehobene ist für heute vorgeschlagen.',pos:'below'},
    {sel:'#workoutTools',title:'Pause & Hantelrechner',body:'Pausen-Timer und der Rechner für die Hantelscheiben sind immer griffbereit.',pos:'below'},
    {sel:'#exlist',title:'Übungen loggen',body:'Tippe eine Übung an, trag Gewicht und Wiederholungen ein und bestätige den Satz mit dem Haken. Der farbige Hinweis sagt dir, ob du steigern solltest.',pos:'above'}
  ],
  diet:[
    {sel:'#dtTagKopf',title:'Trainings- oder Ruhetag',body:'Oben siehst du, für welchen Tag die Werte gelten – an Trainingstagen brauchst du mehr Energie.',pos:'below'},
    {sel:'#dietSeg',title:'Tagebuch · Plan · Rezepte · Einkauf',body:'„Tagebuch" zeigt was du gegessen hast, „Plan" deinen Ernährungsplan zum Anpassen, „Rezepte" die Datenbank und „Einkauf" die Liste fürs Geschäft.',pos:'below'},
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
    const bar=document.createElement('div');bar.id='iosInstallHint';bar.className='install-hint';
    // A-V.3: Die ganze Zeile führt in den Trichter (drei Bilder + drei Schritte), nicht nur das Wort
    // „Anleitung" – ein 13-px-Link war die einzige Tuer zu dem, was auf dem iPhone über Erinnerungen
    // entscheidet. Der Grund steht dabei, und er stimmt je Plattform.
    // D-6 Fix-Runde (Befund D14): Bis hierher war das ein zweites, fremdes Element unter dem grossen
    // Titel – ein `.note`-Kasten mit sieben rohen Inline-Werten (`all:unset;flex:1;…`), die K16/K22
    // nie sehen konnten, weil sie im JavaScript standen, dazu ein rundes `.btn.icon.sm ghost`, also
    // die in 5.1 geloeschte Knopfgroesse. Jetzt ist es EIN Abschnitt in der Sprache der App:
    // Ueberschrift mit der Wortaktion „Später" (4.2 `.rows-h .a`, sie ersetzt das runde „×"),
    // darunter genau EINE Zeile aus rowHTML(). Kein Inline-Stil, kein Symbolknopf ohne Wort (K11).
    // Ueberschrift = WAS, Zeile = WIE auf DIESEM Geraet. Dieselben drei Plattformen wie in
    // lpStepsHTML() (home.js), damit die Zeile und die drei Bilder dahinter dasselbe sagen.
    const txt=isIOS()?'Auf den Startbildschirm legen'
      :/android/i.test(navigator.userAgent)?'Über das Browser-Menü installieren'
      :'Über die Adressleiste installieren';
    const sub=isIOS()
      ?'Nur so kann die App dich erinnern.'
      :'Eigenes Fenster, schnellerer Start, Erinnerungen.';
    bar.innerHTML=groupHTML('Als App installieren',
      [rowHTML({icon:'download',title:txt,sub,tap:'openInstallSheet()'})],
      null,{action:{label:'Später',tap:'dismissInstallHint()'}});
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
// Dieselben Selektoren wie TOUR_DEFS.home – sonst startet die Tour auf einer Seite, auf der ihr
// erster Schritt nichts findet (vorher: `.today` / `#homeCheckin`, beide seit D-2 weg).
function _homeTourReady(){return !!(PLAN&&PLAN.days&&PLAN.days.length&&document.querySelector('.navbtn.on')?.dataset.p==='home'&&document.querySelector('#views #homeNow,#views #homeGoals'));}
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
