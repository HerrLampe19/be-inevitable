// BE INEVITABLE – Frontend, Teil «shell.js». Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js.
// Inhalt: Wischen zwischen Tabs · Sheet-System (Stapel, History, Griff, confirmSheet) · Toast-Host mit
// Warteschlange · Feier-Warteschlange (celebrate) · Skeleton/Empty/Feldfehler-Helfer · Hinweise (infoBox)
// · kleine Utils · INIT (muss als Letztes laufen).
// ===== Wischen zwischen den Tabs (links/rechts) =====
let _swX=0,_swY=0,_swT=0;
document.addEventListener('touchstart',e=>{const t=e.touches&&e.touches[0];if(!t)return;_swX=t.clientX;_swY=t.clientY;_swT=Date.now();},{passive:true});
document.addEventListener('touchend',e=>{
  if(!ME)return;
  if(document.getElementById('modal')?.classList.contains('on'))return;        // Sheet offen
  if(document.body.classList.contains('tour-active'))return;                    // Tour läuft
  if(!document.getElementById('onbView')?.classList.contains('hidden'))return;  // Onboarding läuft
  const t=e.changedTouches&&e.changedTouches[0];if(!t)return;
  const dx=t.clientX-_swX, dy=t.clientY-_swY;
  if(Date.now()-_swT>600)return;                                               // zu langsam
  if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*2)return;                       // nicht klar horizontal
  const start=document.elementFromPoint(_swX,_swY);
  if(start&&start.closest('.chip-row,.filter-pills,.seg,.work-tools,.restbar,input,textarea,select,[data-noswipe]'))return; // horizontal scrollbare Bereiche aussparen
  const tabs=[...document.querySelectorAll('.navbtn')].map(b=>b.dataset.p);
  const cur=document.querySelector('.navbtn.on')?.dataset.p;const i=tabs.indexOf(cur);
  if(i<0||tabs.length<2)return;
  if(dx<0&&i<tabs.length-1)go(tabs[i+1]);                                        // nach links -> nächster Tab
  else if(dx>0&&i>0)go(tabs[i-1]);                                               // nach rechts -> vorheriger Tab
  try{if(navigator.vibrate)navigator.vibrate(8);}catch(e){}
},{passive:true});

// ===== SHEETS (Bottom-Sheet mit Stapel) =====
// openSheet(title,html,{size:'auto'|'tall',back:true}) legt eine Ebene auf den Stapel (+ history.pushState),
// closeModal() nimmt die oberste Ebene weg und zeigt die darunter wieder; die Zurück-Geste/-Taste macht dasselbe.
// Regeln, damit bestehende Aufrufmuster keine Phantom-Ebenen erzeugen:
//  · gleicher Titel wie die oberste Ebene ODER oberste Ebene ist nur ein Spinner -> Inhalt wird ERSETZT (kein Push)
//  · Titel existiert weiter unten im Stapel -> Stapel wird bis dorthin abgebaut („Zurück"-Buttons, Kalender nach Planung)
// Sheet-Titel werden IMMER escaped (Namen von Athleten/Übungen/Rezepten landen hier) – Aufrufer übergeben Klartext.
let SHEET_STACK=[];   // [{title,html,opts,scroll}]
let _sheetHist=0;     // von uns gepushte History-Einträge des offenen Modals
let _sheetPop=0,_sheetPopT=null; // erwartete popstate-Events aus eigenem history.go()
let _sheetPendingPush=false;     // pushState wartet, bis ein eigenes history.go() durch ist (sonst überholt es der Browser)
let _CONFIRM_FN=null;
function _sheetPush(){try{history.pushState({beSheet:SHEET_STACK.length},'');_sheetHist++;}catch(e){}}
function _sheetPushLater(){if(_sheetPop>0)_sheetPendingPush=true;else _sheetPush();}
function _sheetFlushPush(){if(!_sheetPendingPush)return;_sheetPendingPush=false;if(sheetOpen()&&SHEET_STACK.length)_sheetPush();}
function sheetOpen(){return !!document.getElementById('modal')?.classList.contains('on');}
function _isLoadingHtml(h){return /^\s*<div class="spinner"><\/div>\s*$/.test(h||'');}
function _sheetSnapshot(){const b=document.getElementById('sheetBody');return b?b.innerHTML:null;}
function _renderSheet(entry){const sh=document.getElementById('sheet');if(!sh)return;const o=entry.opts||{};const depth=SHEET_STACK.length;
  const back=(o.back===true||(o.back!==false&&depth>1))?`<button class="btn icon sm ghost back" aria-label="Zurück" onclick="closeModal()">${icon('chevronLeft',22)}</button>`:'';
  sh.classList.toggle('tall',o.size==='tall');sh.style.transform='';
  sh.innerHTML=`<div class="sheet-grip"></div><div class="sheet-h">${back}<h3>${esc2(entry.title)}</h3><button class="sheet-x" aria-label="Schließen" onclick="closeModal()">${icon('x',20)}</button></div><div id="sheetBody">${entry.html}</div>`;
  sh.scrollTop=entry.scroll||0;}
function _sheetBack(n){ // eigene History-Einträge zurücknehmen (popstate dazu wird ignoriert)
  if(n<=0)return;const st=history.state;
  if(_sheetHist>0&&st&&st.beSheet){const k=Math.min(n,_sheetHist);_sheetHist-=k;_sheetPop++;clearTimeout(_sheetPopT);_sheetPopT=setTimeout(()=>{_sheetPop=0;_sheetFlushPush();},600);
    try{history.go(-k);}catch(e){_sheetPop=0;_sheetFlushPush();}}
  else _sheetHist=Math.max(0,_sheetHist-n);}
function openSheet(title,html,opts){opts=opts||{};title=title==null?'':String(title);html=html==null?'':String(html);
  const modal=document.getElementById('modal'),sh=document.getElementById('sheet');if(!modal||!sh)return;
  if(!modal.classList.contains('on')){SHEET_STACK=[];_sheetHist=0;}
  const top=SHEET_STACK[SHEET_STACK.length-1];const entry={title,html,opts,scroll:0};
  if(top&&(top.title===title||_isLoadingHtml(top.html))){SHEET_STACK[SHEET_STACK.length-1]=entry;}
  else{const idx=title?SHEET_STACK.findIndex(e=>e.title===title):-1;
    if(idx>=0){const drop=SHEET_STACK.length-1-idx;SHEET_STACK.length=idx+1;SHEET_STACK[idx]=entry;_sheetBack(drop);}
    else{if(top){const snap=_sheetSnapshot();if(snap!=null)top.html=snap;top.scroll=sh.scrollTop;}
      SHEET_STACK.push(entry);_sheetPushLater();}}
  _renderSheet(entry);modal.classList.add('on');}
function _sheetHide(){const modal=document.getElementById('modal'),sh=document.getElementById('sheet');
  if(modal)modal.classList.remove('on');if(sh){sh.classList.remove('tall');sh.style.transform='';}
  SHEET_STACK=[];_sheetHist=0;_sheetPendingPush=false;_CONFIRM_FN=null;
  if(typeof stopBarcodeCam==='function')stopBarcodeCam();}
function closeModal(){
  if(SHEET_STACK.length>1){SHEET_STACK.pop();_sheetBack(1);if(typeof stopBarcodeCam==='function')stopBarcodeCam();_renderSheet(SHEET_STACK[SHEET_STACK.length-1]);return;}
  _sheetBack(SHEET_STACK.length?1:0);_sheetHide();}
function closeAllSheets(){if(!sheetOpen()){SHEET_STACK=[];_sheetHist=0;return;}_sheetBack(_sheetHist);_sheetHide();}
// Zurück-Geste/-Taste: schließt die oberste Ebene (Browser hat den History-Eintrag bereits entfernt)
window.addEventListener('popstate',()=>{
  if(_sheetPop>0){_sheetPop--;if(_sheetPop===0){clearTimeout(_sheetPopT);_sheetFlushPush();}return;}
  if(!sheetOpen()||!SHEET_STACK.length)return;
  _sheetHist=Math.max(0,_sheetHist-1);
  if(SHEET_STACK.length>1){SHEET_STACK.pop();if(typeof stopBarcodeCam==='function')stopBarcodeCam();_renderSheet(SHEET_STACK[SHEET_STACK.length-1]);}
  else _sheetHide();});
// Griff (und Kopfzeile) nach unten ziehen -> Sheet folgt dem Finger, ab 80 px schließt es
(function(){const sh=document.getElementById('sheet');if(!sh)return;let y0=0,dy=0,active=false;
  sh.addEventListener('touchstart',e=>{const t=e.target;if(!(t&&t.closest)||!t.closest('.sheet-grip,.sheet-h')||t.closest('button')||sh.scrollTop>0)return;
    y0=e.touches[0].clientY;dy=0;active=true;sh.classList.add('dragging');},{passive:true});
  sh.addEventListener('touchmove',e=>{if(!active)return;dy=Math.max(0,e.touches[0].clientY-y0);sh.style.transform=dy?`translateY(${dy}px)`:'';},{passive:true});
  const end=()=>{if(!active)return;active=false;sh.classList.remove('dragging');
    if(dy>80){sh.style.transform='';closeModal();}
    else{sh.style.transition='transform 220ms var(--ease)';sh.style.transform='';setTimeout(()=>{sh.style.transition='';},240);}
    dy=0;};
  sh.addEventListener('touchend',end,{passive:true});sh.addEventListener('touchcancel',end,{passive:true});})();
// confirmSheet(title,text,{label:'Löschen',danger:true,onYes,cancel:'Abbrechen'}) – ersetzt window.confirm
function confirmSheet(title,text,o){o=o||{};_CONFIRM_FN=typeof o.onYes==='function'?o.onYes:null;
  const label=o.label||'Löschen',cancel=o.cancel||'Abbrechen',danger=o.danger!==false;
  openSheet(title,`<div class="body mb-4">${esc2(text||'').replace(/\n/g,'<br>')}</div>
    <button class="btn block${danger?' danger':''}" onclick="_confirmYes()">${esc2(label)}</button>
    <button class="btn block sec mt-2" onclick="closeModal()">${esc2(cancel)}</button>`);}
function _confirmYes(){const f=_CONFIRM_FN;_CONFIRM_FN=null;closeModal();
  if(f)try{const r=f();if(r&&typeof r.catch==='function')r.catch(e=>console.error('[confirmSheet]',e));}catch(e){console.error('[confirmSheet]',e);}}

// ===== TOAST (ein Host, eine sichtbare Meldung, Warteschlange) =====
// toast(msg) ersetzt eine sichtbare schlichte Meldung; toast(msg,{label,fn}) bleibt 5 s oder bis zum Tipp.
// Solange ein Feier-Pop sichtbar ist, warten Toasts.
let TOAST_Q=[],TOAST_CUR=null,TOAST_T=null;
function toast(m,action){TOAST_Q.push({m:String(m??''),action:(action&&typeof action.fn==='function')?action:null});_toastFlush();}
function _toastFlush(){
  if(!TOAST_Q.length)return;
  if(typeof CELEBRATE_ON!=='undefined'&&CELEBRATE_ON)return;
  if(TOAST_CUR){if(TOAST_CUR.action)return;_toastRemove(TOAST_CUR,true,true);} // sichtbare schlichte Meldung sofort ersetzen (ohne Re-Entry)
  const it=TOAST_Q.shift();if(!it)return;const host=document.getElementById('toastHost')||document.body;
  const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');
  const tx=document.createElement('span');tx.className='tx';tx.textContent=it.m;t.appendChild(tx); // Text, kein HTML (Übungsnamen!)
  if(it.action){const b=document.createElement('button');b.className='act';b.textContent=it.action.label||'OK';
    b.onclick=()=>{_toastRemove(it,true);try{it.action.fn();}catch(e){console.error('[toast]',e);}};t.appendChild(b);}
  it.el=t;host.appendChild(t);requestAnimationFrame(()=>t.classList.add('on'));
  TOAST_CUR=it;clearTimeout(TOAST_T);TOAST_T=setTimeout(()=>_toastRemove(it),it.action?5000:1800);}
function _toastRemove(it,immediate,noFlush){if(!it||!it.el)return;const el=it.el;it.el=null;
  if(TOAST_CUR===it){TOAST_CUR=null;clearTimeout(TOAST_T);}
  if(immediate||TOAST_Q.length){el.remove();}else{el.classList.remove('on');setTimeout(()=>el.remove(),240);}
  if(!noFlush)_toastFlush();}

// ===== FEIER-MOMENTE: Konfetti + Pop (Warteschlange, ein Pop zur Zeit, ein Konfetti pro Lauf) =====
let CELEBRATE_Q=[],CELEBRATE_ON=false,_celebConfetti=false,_celebT=null;
function confettiBurst(n=46){const cols=['#e10600','#30d158','#ffd60a','#0a84ff','#ff9f0a','#ff375f','#bf5af2'];
  for(let i=0;i<n;i++){const p=document.createElement('div');p.className='confetti-pc';
    p.style.left=Math.random()*100+'vw';p.style.background=cols[i%cols.length];
    const dur=1.6+Math.random()*1.3;p.style.animation=`confettiFall ${dur}s linear ${(Math.random()*0.3).toFixed(2)}s forwards`;
    p.style.opacity=String((.7+Math.random()*.3).toFixed(2));document.body.appendChild(p);
    setTimeout(()=>p.remove(),(dur+0.6)*1000);}
}
// Kurz sammeln (60 ms), damit mehrere direkt nacheinander gemeldete Erfolge in EINEM Pop landen
function celebrate(icon,title,sub){CELEBRATE_Q.push({icon:String(icon??'🎉'),title:String(title??''),sub:sub?String(sub):''});
  clearTimeout(_celebT);_celebT=setTimeout(_celebrateFlush,60);}
function _celebrateFlush(){if(CELEBRATE_ON||!CELEBRATE_Q.length)return;
  const items=CELEBRATE_Q.splice(0,CELEBRATE_Q.length);const head=items[0],rest=items.slice(1); // alles Wartende in EIN Pop (z.B. Level-up + Erfolge)
  CELEBRATE_ON=true;
  try{if(!_celebConfetti){_celebConfetti=true;confettiBurst();}
    const el=document.createElement('div');el.className='celebrate-pop';
    el.innerHTML=`<div class="cl-ic">${esc2(head.icon)}</div><div class="cl-t">${esc2(head.title)}</div>${head.sub?`<div class="cl-s">${esc2(head.sub)}</div>`:''}`+
      (rest.length?`<div class="cl-list">${rest.map(r=>`<div><span>${esc2(r.icon)}</span><div>${esc2(r.title)}${r.sub?` <small class="muted">· ${esc2(r.sub)}</small>`:''}</div></div>`).join('')}</div>`:'');
    document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('on'));
    setTimeout(()=>{el.classList.remove('on');setTimeout(()=>{el.remove();CELEBRATE_ON=false;
      if(CELEBRATE_Q.length)_celebrateFlush();else{_celebConfetti=false;_toastFlush();}},400);},2800);
  }catch(e){CELEBRATE_ON=false;_celebConfetti=false;}}

// ===== SKELETON / EMPTY / FELDFEHLER =====
function skeleton(n,cls){n=n||3;return Array.from({length:n},()=>`<div class="skeleton${cls?' '+cls:''}" aria-hidden="true"></div>`).join('');}
// emptyState({icon:'dumbbell',title,text,btn:{label,onclick}}) – onclick als JS-Ausdruck (String) oder Funktion
const _EMPTY_FN={};let _emptyN=0;
function _emptyFn(k){const f=_EMPTY_FN[k];if(f)f();}
function emptyState(o){o=o||{};const ic=o.icon?icon(o.icon,36):'';let btn='';
  if(o.btn&&o.btn.label){let oc=o.btn.onclick||'';if(typeof oc==='function'){const k='e'+(++_emptyN);_EMPTY_FN[k]=oc;oc=`_emptyFn('${k}')`;}
    btn=`<button class="btn sm" onclick="${String(oc).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${esc2(o.btn.label)}</button>`;}
  return `<div class="empty">${ic}${o.title?`<div class="t">${esc2(o.title)}</div>`:''}${o.text?`<div>${esc2(o.text)}</div>`:''}${btn}</div>`;}
// showFieldErr(containerId,msg,fieldId): markiert das Feld (.field.invalid), zeigt die Meldung, fokussiert und scrollt hin.
// Ohne fieldId landet die Meldung als .err-Box vor dem ersten Button im Container.
function showFieldErr(containerId,msg,fieldId){
  const c=document.getElementById(containerId);const f=fieldId?document.getElementById(fieldId):null;
  const scope=c||f?.closest('.sheet,.page,form')||document;
  scope.querySelectorAll('.err[data-ferr]').forEach(e=>e.remove());scope.querySelectorAll('.field.invalid').forEach(x=>x.classList.remove('invalid'));
  const e=document.createElement('div');e.className='err';e.dataset.ferr='1';e.textContent=msg||'Bitte prüfen.';
  const field=f?f.closest('.field'):null;
  if(field){field.classList.add('invalid');field.appendChild(e);}
  else if(c){const b=c.querySelector('.btn');if(b&&b.parentNode===c)c.insertBefore(e,b);else c.prepend(e);}
  const target=f||c?.querySelector('input,select,textarea');
  if(target){try{target.focus({preventScroll:true});}catch(x){}target.scrollIntoView({block:'center',behavior:'smooth'});
    target.addEventListener('input',()=>{e.remove();field?.classList.remove('invalid');},{once:true});}
  else e.scrollIntoView({block:'center',behavior:'smooth'});}

// ===== UTILS =====
function val(id){return document.getElementById(id)?.value.trim()??'';}
function num(id){const v=document.getElementById(id)?.value;return v===''||v==null?null:parseFloat(v);}
// ISO-Datum aus LOKALEN Komponenten (nicht UTC) – konsistent mit today()
function fmt(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function r1(n){return Math.round((n||0)*10)/10;}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}

// ===== AUSBLENDBARE HINWEISE =====
// infoBox(key,html) ist der EINZIGE Erzeuger einer schließbaren Hinweis-Box (.note[data-hint] mit 44-px-✕).
// Dauerhaft ausgeblendet wird pro Gerät (localStorage be_hints); „Hinweise wieder anzeigen" im Profil setzt zurück.
// Status-/Datentexte nutzen .note.status und sind nie ausblendbar.
function hintsDismissed(){try{return JSON.parse(localStorage.getItem('be_hints')||'{}');}catch(e){return {};}}
function infoBox(key,html){if(hintsDismissed()[key])return '';
  return `<div class="note info hintbox" data-hint="${esc2(key)}"><div class="fill">${html}</div><button class="btn icon sm" onclick="hintNever('${esc(key)}',this)" title="Hinweis ausblenden" aria-label="Hinweis ausblenden">${icon('x',18)}</button></div>`;}
function hintNever(key,btn){const d=hintsDismissed();d[key]=1;try{localStorage.setItem('be_hints',JSON.stringify(d));}catch(e){}
  const b=btn.closest('.hintbox');if(b)b.remove();toast('Hinweis ausgeblendet – im Profil unter „Hinweise wieder anzeigen" zurückholbar.');}
function resetHints(){try{localStorage.removeItem('be_hints');}catch(e){}toast('Alle Hinweise wieder aktiviert ✓');
  // aktuelle Ansicht neu zeichnen, damit ausgeblendete Boxen sofort zurückkommen
  try{const cur=document.querySelector('.navbtn.on')?.dataset?.p;if(cur)go(cur);}catch(e){}}
// Die automatische Nachrüstung von ✕ an JEDER .info-Box (MutationObserver) ist abgeschafft:
// nur infoBox() erzeugt schließbare Hinweise. Die Namen bleiben als No-ops, damit alte Aufrufer nicht brechen.
function applyHintControls(){}
function startHintObserver(){}

// Globaler Eingabeschutz: KEIN Zahlenfeld darf negativ werden (Standard-Minimum 0);
// vorhandene min/max-Attribute werden eingehalten. Greift für alle <input type="number">.
document.addEventListener('change',e=>{
  const el=e.target;if(!el||el.tagName!=='INPUT'||el.type!=='number'||el.value==='')return;
  const n=parseFloat(el.value);if(isNaN(n))return;
  const min=el.getAttribute('min')!=null?parseFloat(el.getAttribute('min')):0; // Standard: nicht negativ
  const max=el.getAttribute('max')!=null?parseFloat(el.getAttribute('max')):null;
  if(n<min)el.value=min;else if(max!=null&&n>max)el.value=max;
},true);
// Abgelehnte Lebensmittel des ANGESEHENEN Nutzers (Coach-Kontext: die des Athleten) für den Rezept-Filter
function myDisliked(){try{const src=(VIEW_USER&&VIEW_USER!==ME?.id&&VIEW_USER_PROFILE)?VIEW_USER_PROFILE.disliked_foods:ME?.disliked_foods;
  return Array.isArray(src)?src:JSON.parse(src||'[]');}catch(e){return [];}}
// Escaping für Strings INNERHALB von onclick="fn('…')": erst HTML-Entities (& " <), dann JS-String (\ ' Zeilenumbruch).
// Der HTML-Parser dekodiert die Entities, bevor der JS-Parser den String liest.
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/\r?\n/g,' ');}
function goalLabel(g){return{muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'}[g]||'–';}
function clampSets(v){let n=parseInt(v);if(isNaN(n))n=3;return Math.max(1,Math.min(10,n));}
function isBeginner(){return (ME?.experience||'beginner')==='beginner';}
function isAdvanced(){return (ME?.experience)==='advanced';}

// ===== INIT =====
(async()=>{
  // Übrig gebliebener Sheet-Zustand aus der History (Reload mit offenem Sheet) -> neutralisieren
  try{if(history.state&&history.state.beSheet)history.replaceState(null,'',location.pathname+location.search+location.hash);}catch(e){}
  // Version auf dem Login-Screen anzeigen + mit Backend abgleichen (deckt Cache-Probleme auf)
  const lv=document.getElementById('loginVersion');if(lv)lv.textContent='Version '+APP_VERSION;
  try{const vr=await API.get('/version');if(vr.status===200&&vr.data.version&&vr.data.version!==APP_VERSION){
    // Frontend (gecacht) und Backend (frisch deployt) laufen auseinander -> Hard-Reload nötig
    if(lv)lv.innerHTML=`App ${APP_VERSION} · Server ${vr.data.version} – <a onclick="location.reload(true)" style="color:var(--red-text)">neu laden</a>`;
    console.warn('[Version] Frontend',APP_VERSION,'≠ Backend',vr.data.version,'– bitte hart neu laden (Cache).');
  }}catch(e){}
  const params=new URLSearchParams(location.search);
  // Teilen-Link: Token merken (übersteht Login/Registrierung), URL säubern
  const shareTok=params.get('share');
  if(shareTok){localStorage.setItem('be_pending_share',shareTok);history.replaceState(null,'',location.pathname);}
  // Reset-Link aus E-Mail: Formular zeigen, KEIN Auto-Login nötig
  const resetTok=params.get('reset');
  if(resetTok){showResetForm(resetTok);return;}
  const r=await API.get('/me');
  if(r.status===200){ME=r.data.user;
    startApp();
    // Rückmeldung der E-Mail-Verifizierung
    const v=params.get('verified');
    if(v==='1'){if(ME)ME.email_verified=1;history.replaceState(null,'',location.pathname);setTimeout(()=>toast('E-Mail bestätigt ✓'),400);}
    else if(v==='0'){history.replaceState(null,'',location.pathname);setTimeout(()=>toast('Bestätigungslink ungültig oder abgelaufen'),400);}
  } else {
    const v=params.get('verified');
    if(v==='1')setTimeout(()=>toast('E-Mail bestätigt ✓ – bitte anmelden'),400);
  }
})();
