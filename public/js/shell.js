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

// ===== A-II.5 · BARRIEREFREIHEIT: ein Sheet ist ein echter Dialog =====
// Bis 2.5.0 war ein Sheet eine Schicht aus <div>: kein role="dialog", kein aria-modal, kein Fokus im
// Sheet, keine Escape-Taste, der Hintergrund blieb mit Tab erreichbar und die Seite scrollte darunter
// weiter (gemessen mit tools/a11y.mjs: 0 von 3 Sheets waren Dialoge). Der gesamte Mechanismus steht
// HIER – die Bereichsdateien (home/training/diet/analysis/coach/mindset) ändern dafür keine Zeile.
// Reihenfolge beim Öffnen ist wichtig: erst den Auslöser merken, DANN inert setzen (inert nimmt dem
// Auslöser sofort den Fokus), dann den Fokus ins Sheet holen.
let _sheetReturnFocus=null;   // Element, das das Sheet geöffnet hat – dorthin geht der Fokus zurück
let _scrollLockY=0;           // Scrollstand der Seite, während der Hintergrund gesperrt ist
// Alles außer #modal und #toastHost wird stillgelegt. #toastHost bleibt bedienbar: dort steht die
// „Rückgängig"-Schaltfläche einer gerade gezeigten Meldung, die auch über einem Sheet gelten muss.
// Mit der Maus reichte das (z-index 200 über dem Modal, pointer-events:auto). Mit der Tastatur nicht:
// die Fokusfalle unten drehte sich bis 2.6.0 ausschließlich innerhalb von #sheet, der echte
// <button class="act"> im Toast war damit fokussierbar, aber unerreichbar (gemessen: 20× Tab bei
// offenem Essen-Sheet erreichte „Ansehen" nie). Seitdem hängt _sheetTrap die Schaltflächen aus
// #toastHost an den Ring (in Dokumentreihenfolge, also hinten) und führt vom Sheet-Titel aus mit
// EINEM Tastendruck dorthin – das ist der Zustand, in dem ein „Rückgängig" erscheint – und
// _toastRemove hält die Meldung an, solange sie den Fokus hat (sonst wäre sie nach 5 s weg, bevor
// man sie erreicht hat), und gibt den Fokus danach ins Sheet zurück.
const A11_INERT=['appView','loginView','onbView','restBar'];
const A11_FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),summary,[contenteditable=""],[contenteditable="true"]';
function _a11Focusables(root){if(!root)return [];
  return [...root.querySelectorAll(A11_FOCUSABLE)].filter(el=>{
    if(el.hasAttribute('inert')||el.closest('[inert]'))return false;
    const r=el.getBoundingClientRect();if(r.width<1&&r.height<1)return false;
    const cs=getComputedStyle(el);
    return cs.visibility!=='hidden'&&cs.display!=='none';});}
// Schaltflächen der gerade sichtbaren Meldung (#toastHost). Eine Meldung im Ausblenden trägt [inert]
// (siehe _toastRemove) und fällt damit in _a11Focusables() heraus – sie darf den Ring nicht mehr fangen.
function _a11ToastFocusables(){return _a11Focusables(document.getElementById('toastHost'));}
function _a11SheetOn(){
  const sh=document.getElementById('sheet');if(!sh)return;
  sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');
  sh.setAttribute('aria-labelledby','sheetTitle');sh.setAttribute('tabindex','-1');
  // inert statt aria-hidden: es nimmt Fokus UND Vorlesbarkeit weg und löst keine Warnung aus, wenn der
  // Fokus im Moment des Setzens noch im Hintergrund steht. Browser ohne inert (Safari < 15.5) fangen
  // wenigstens die Fokusfalle unten ab.
  A11_INERT.forEach(id=>{const e=document.getElementById(id);if(e)e.setAttribute('inert','');});
  if(!document.body.classList.contains('sheet-open')){
    _scrollLockY=window.scrollY||document.documentElement.scrollTop||0;
    document.body.classList.add('sheet-open');}}
function _a11SheetOff(){
  const sh=document.getElementById('sheet');
  if(sh)['role','aria-modal','aria-labelledby','tabindex'].forEach(a=>sh.removeAttribute(a));
  A11_INERT.forEach(id=>{const e=document.getElementById(id);if(e)e.removeAttribute('inert');});
  if(document.body.classList.contains('sheet-open')){
    document.body.classList.remove('sheet-open');
    // Nur zurückstellen, wenn der Browser die Position wirklich verloren hat (iOS). Blind zu scrollen
    // würde go() in die Quere kommen: ein Tipp im Sheet, der den Tab wechselt, ruft closeAllSheets()
    // VOR dem Seitenwechsel – und go() setzt den Scrollstand danach selbst.
    if(_scrollLockY>0&&(window.scrollY||0)===0){try{window.scrollTo(0,_scrollLockY);}catch(e){}}}
  const back=_sheetReturnFocus;_sheetReturnFocus=null;
  if(back&&back.isConnected&&typeof back.focus==='function'){try{back.focus({preventScroll:true});}catch(e){}}}
// Fokus in den Dialog holen – auf die Überschrift, damit ein Screenreader den Titel vorliest.
// Hat ein Aufrufer schon selbst fokussiert (openLogFood({focus:true}), showFieldErr), bleibt das stehen.
function _a11SheetFocus(){
  const sh=document.getElementById('sheet');if(!sh)return;
  if(document.activeElement&&sh.contains(document.activeElement)&&document.activeElement!==sh)return;
  const h=document.getElementById('sheetTitle');
  try{(h||sh).focus({preventScroll:true});}catch(e){}}
// Escape schließt die oberste Ebene, Tab bleibt im Dialog (auch ohne inert-Unterstützung).
function _sheetTrap(e){
  if(!sheetOpen())return;
  if(e.key==='Escape'||e.key==='Esc'){
    if(e.defaultPrevented)return;
    e.preventDefault();closeModal();return;}
  if(e.key!=='Tab')return;
  const sh=document.getElementById('sheet');if(!sh)return;
  // Ring = Sheet + (falls sichtbar) die Aktionsschaltfläche der Meldung darüber. Die Reihenfolge MUSS
  // der Dokumentreihenfolge folgen (#toastHost steht hinter #modal), denn in der Mitte des Rings
  // arbeitet der Browser selbst weiter – eingegriffen wird nur an den beiden Enden. Ein Ring gegen die
  // Dokumentreihenfolge würde den Fokus dort ins Leere laufen lassen (gemessen: Tab vom Toast landete
  // auf <body>, weil alles andere inert ist).
  const tf=_a11ToastFocusables();
  const f=_a11Focusables(sh).concat(tf);
  if(!f.length){e.preventDefault();try{sh.focus({preventScroll:true});}catch(x){}return;}
  const first=f[0],last=f[f.length-1],a=document.activeElement;
  const i=f.indexOf(a);
  // Fokus auf der Überschrift/dem Sheet selbst – der Zustand direkt nach closeModal() und damit genau
  // der Augenblick, in dem ein „Rückgängig" erscheint (_confirmYes → closeModal → toast). Steht dort
  // eine Meldung, führt EIN Tastendruck in beide Richtungen zu ihr; sonst wäre sie erst hinter allen
  // Elementen des Sheets erreichbar (im Essen-Sheet sind das 91).
  if(i<0){e.preventDefault();(tf.length?tf[0]:(e.shiftKey?last:first)).focus();return;}
  if(e.shiftKey&&a===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&a===last){e.preventDefault();first.focus();}}
document.addEventListener('keydown',_sheetTrap);
// ===== A-II.5 · DER EINE Tastatur-Auslöser =====
// Enter/Leertaste auf einem Element, das role="button" UND tabindex="0" trägt, löst denselben click aus
// wie ein Tipp – genau einmal. Drei Sperren gegen doppelte Auslösung:
//  1. e.defaultPrevented – ein eigener Handler des Elements war schon dran und hat abgeräumt
//  2. [onkeydown] – das Element bringt einen eigenen Handler mit (heute 11 Stellen in home/analysis/
//     diet/search/mindset); der läuft am Ziel und damit VOR diesem Handler. A-II.6 darf die Attribute
//     entfernen, dann greift dieser hier – nie beide.
//  3. nativer <button>/<a href>/<summary>/Feld-Vorfahr – dort löst der Browser selbst aus
function a11KeyActivate(e){
  if(e.key!=='Enter'&&e.key!==' '&&e.key!=='Spacebar')return;
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;
  const el=e.target;
  if(!el||el.nodeType!==1||typeof el.closest!=='function')return;
  if(el.getAttribute('role')!=='button'||el.getAttribute('tabindex')!=='0')return;
  if(el.hasAttribute('onkeydown'))return;
  if(el.closest('button,a[href],summary,input,select,textarea'))return;
  if(el.hasAttribute('disabled')||el.getAttribute('aria-disabled')==='true')return;
  e.preventDefault();   // Leertaste darf die Seite nicht scrollen, Enter kein Formular abschicken
  el.click();}
document.addEventListener('keydown',a11KeyActivate);

function _sheetPush(){try{history.pushState({beSheet:SHEET_STACK.length},'');_sheetHist++;}catch(e){}}
function _sheetPushLater(){if(_sheetPop>0)_sheetPendingPush=true;else _sheetPush();}
function _sheetFlushPush(){if(!_sheetPendingPush)return;_sheetPendingPush=false;if(sheetOpen()&&SHEET_STACK.length)_sheetPush();}
function sheetOpen(){return !!document.getElementById('modal')?.classList.contains('on');}
function _isLoadingHtml(h){return /^\s*<div class="spinner"><\/div>\s*$/.test(h||'');}
function _sheetSnapshot(){const b=document.getElementById('sheetBody');return b?b.innerHTML:null;}
function _renderSheet(entry){const sh=document.getElementById('sheet');if(!sh)return;const o=entry.opts||{};const depth=SHEET_STACK.length;
  const back=(o.back===true||(o.back!==false&&depth>1))?`<button class="btn icon sm ghost back" aria-label="Zurück" onclick="closeModal()">${icon('chevronLeft',22)}</button>`:'';
  sh.classList.toggle('tall',o.size==='tall');sh.style.transform='';
  // id="sheetTitle" ist das Ziel von aria-labelledby (der Dialog trägt damit den Namen, den der Nutzer
  // sieht); tabindex="-1", weil der Fokus beim Öffnen auf die Überschrift springt.
  sh.innerHTML=`<div class="sheet-grip" aria-hidden="true"></div><div class="sheet-h">${back}<h3 id="sheetTitle" tabindex="-1">${esc2(entry.title)}</h3><button class="sheet-x" aria-label="Schließen" onclick="closeModal()">${icon('x',20)}</button></div><div id="sheetBody">${entry.html}</div>`;
  sh.scrollTop=entry.scroll||0;}
function _sheetBack(n){ // eigene History-Einträge zurücknehmen (popstate dazu wird ignoriert)
  if(n<=0)return;const st=history.state;
  if(_sheetHist>0&&st&&st.beSheet){const k=Math.min(n,_sheetHist);_sheetHist-=k;_sheetPop++;clearTimeout(_sheetPopT);_sheetPopT=setTimeout(()=>{_sheetPop=0;_sheetFlushPush();},600);
    try{history.go(-k);}catch(e){_sheetPop=0;_sheetFlushPush();}}
  else _sheetHist=Math.max(0,_sheetHist-n);}
function openSheet(title,html,opts){opts=opts||{};title=title==null?'':String(title);html=html==null?'':String(html);
  const modal=document.getElementById('modal'),sh=document.getElementById('sheet');if(!modal||!sh)return;
  // Auslöser merken, SOLANGE er noch den Fokus hat – gleich darauf legt _a11SheetOn() inert darüber.
  if(!modal.classList.contains('on')){SHEET_STACK=[];_sheetHist=0;
    const a=document.activeElement;_sheetReturnFocus=(a&&a!==document.body&&a.isConnected)?a:null;}
  const top=SHEET_STACK[SHEET_STACK.length-1];const entry={title,html,opts,scroll:0};
  if(top&&(top.title===title||_isLoadingHtml(top.html))){SHEET_STACK[SHEET_STACK.length-1]=entry;}
  else{const idx=title?SHEET_STACK.findIndex(e=>e.title===title):-1;
    if(idx>=0){const drop=SHEET_STACK.length-1-idx;SHEET_STACK.length=idx+1;SHEET_STACK[idx]=entry;_sheetBack(drop);}
    else{if(top){const snap=_sheetSnapshot();if(snap!=null)top.html=snap;top.scroll=sh.scrollTop;}
      SHEET_STACK.push(entry);_sheetPushLater();}}
  _renderSheet(entry);modal.classList.add('on');
  _a11SheetOn();_a11SheetFocus();}
function _sheetHide(){const modal=document.getElementById('modal'),sh=document.getElementById('sheet');
  if(modal)modal.classList.remove('on');if(sh){sh.classList.remove('tall');sh.style.transform='';}
  SHEET_STACK=[];_sheetHist=0;_sheetPendingPush=false;_CONFIRM_FN=null;
  if(typeof stopBarcodeCam==='function')stopBarcodeCam();
  _a11SheetOff();}
function closeModal(){
  if(SHEET_STACK.length>1){SHEET_STACK.pop();_sheetBack(1);if(typeof stopBarcodeCam==='function')stopBarcodeCam();_renderSheet(SHEET_STACK[SHEET_STACK.length-1]);_a11SheetFocus();return;}
  _sheetBack(SHEET_STACK.length?1:0);_sheetHide();}
function closeAllSheets(){if(!sheetOpen()){SHEET_STACK=[];_sheetHist=0;return;}_sheetBack(_sheetHist);_sheetHide();}
// Zurück-Geste/-Taste: schließt die oberste Ebene (Browser hat den History-Eintrag bereits entfernt)
window.addEventListener('popstate',()=>{
  if(_sheetPop>0){_sheetPop--;if(_sheetPop===0){clearTimeout(_sheetPopT);_sheetFlushPush();}return;}
  if(!sheetOpen()||!SHEET_STACK.length)return;
  _sheetHist=Math.max(0,_sheetHist-1);
  if(SHEET_STACK.length>1){SHEET_STACK.pop();if(typeof stopBarcodeCam==='function')stopBarcodeCam();_renderSheet(SHEET_STACK[SHEET_STACK.length-1]);_a11SheetFocus();}
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
// toast(msg) ersetzt eine sichtbare schlichte Meldung; toast(msg,{label,fn}) bleibt 5 s oder bis zum Tipp
// – und länger, solange die Schaltfläche den Tastaturfokus hat (A-II.5, sonst ist sie nicht bedienbar).
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
    b.onclick=()=>{_toastRemove(it,true);try{it.action.fn();}catch(e){console.error('[toast]',e);}};
    // Tastatur: solange die Schaltfläche den Fokus hat, läuft die Uhr nicht weiter. Sonst wäre die
    // Meldung nach 5 s weg, während der Nutzer noch überlegt – und der Fokus fiele ins Leere.
    b.addEventListener('focus',()=>{if(TOAST_CUR===it&&it.el){clearTimeout(TOAST_T);TOAST_T=null;}});
    b.addEventListener('blur',()=>{if(TOAST_CUR!==it||!it.el)return;   // (nach Klick/Enter ist TOAST_CUR schon null)
      clearTimeout(TOAST_T);TOAST_T=setTimeout(()=>_toastRemove(it),2500);});
    t.appendChild(b);}
  it.el=t;host.appendChild(t);requestAnimationFrame(()=>t.classList.add('on'));
  // Standzeit nach Lesedauer statt pauschal 1,8 s: „Aktualisiert ✓" braucht keine drei Sekunden, die
  // Offline-Bestätigung („wird nachgetragen, sobald du online bist", 63 Zeichen) sehr wohl – sie war
  // vorher weg, bevor man sie zu Ende gelesen hatte (RATE-shell-home M1, RATE-performance-offline 6).
  // Rund 45 ms je Zeichen ≈ 22 Zeichen/s, gedeckelt auf 1,8 s unten und 5 s oben.
  TOAST_CUR=it;clearTimeout(TOAST_T);
  const ms=it.action?5000:Math.max(1800,Math.min(5000,1200+it.m.length*45));
  TOAST_T=setTimeout(()=>_toastRemove(it),ms);}
function _toastRemove(it,immediate,noFlush){if(!it||!it.el)return;const el=it.el;it.el=null;
  if(TOAST_CUR===it){TOAST_CUR=null;clearTimeout(TOAST_T);}
  // Erst den Fokus in Sicherheit bringen, dann die Meldung wegnehmen: verschwindet sie unter dem
  // Fokus, fiele er auf <body> und die nächste Tab-Taste finge im Sheet wieder ganz vorn an.
  const hadFocus=el.contains(document.activeElement);
  el.setAttribute('inert','');   // ab hier nicht mehr im Fokusring von _sheetTrap (auch ohne inert-Unterstützung)
  if(hadFocus){if(sheetOpen())_a11SheetFocus();
    else{try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur();}catch(e){}}}
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
// P-5 · EINE Erfahrungs-Leiter, nicht zwei. `isBeginner` las bis zur Nachbesserung allein
// `ME.experience` und übersah damit beides, was seit 2.6.0 darüber steht: die Übersteuerung des
// Coachs (`experience_coach`) und – im Coach-Blick – das Profil des ANGESEHENEN Athleten. Sobald
// ein Coach jemanden auf Stufe 2 setzt, trug die Satzzeile das RIR-Feld, während der
// Anfänger-Infokasten darüber stehen blieb. `twLevel()` (training.js) ist die eine Quelle;
// die Prüfung auf die Funktion hält den Aufruf robust, falls nur ein Teilbündel geladen ist.
// Die Zwillingsfunktion `isAdvanced` ist ersatzlos geloescht: `grep -rn isAdvanced public/ src/`
// fand nur ihre eigene Definition, sie wurde also nie aufgerufen. (Ohne Klammern geschrieben, damit
// static_check.py den Satz nicht als Aufruf einer entfernten Funktion liest.)
function isBeginner(){if(typeof twLevel==='function')return twLevel()<=1;
  return (ME?.experience||'beginner')==='beginner';}

// ===== EINLADUNGSLINK EINLÖSEN (A-II.5 · Einlöseseite zu BUILD-A2 §4 Punkt 11) =====
// Der Server legt ein Konto ohne gültiges Passwort an und gibt einen einmaligen Link (72 h) aus
// (src/server.js: makeInvite/NO_PASSWORD_HASH). Hier ist die Gegenseite: `?invite=TOKEN` führt nicht
// mehr auf die Anmeldekarte, sondern auf eine Begrüßung mit zwei Passwortfeldern.
// Drei Zustände, mehr gibt es nicht:
//   gültig            -> „Hallo <Vorname>" + Passwort setzen -> angemeldet
//   abgelaufen/benutzt-> Klartext, warum, und der Weg zur Anmeldung (kein stiller Rückfall)
//   kein Netz         -> „Erneut versuchen", der Link bleibt gültig
// Bewusst als Sheet wie das Reset-Formular (account.js showResetForm): damit gelten Fokusfalle,
// Escape, inert und Scroll-Lock aus diesem Paket auch hier, ohne eine Zeile doppelt zu bauen.
// Der Token wird NIE in einen History-Eintrag geschrieben – die URL ist sofort sauber (er steht in
// A11_INVITE_TOKEN), sonst läge er nach dem Einlösen noch im Verlauf des Geräts.
let A11_INVITE_TOKEN=null;
async function a11InviteBoot(token){
  A11_INVITE_TOKEN=String(token||'');
  try{history.replaceState(null,'',location.pathname);}catch(e){}
  document.getElementById('loginView')?.classList.remove('hidden');
  document.getElementById('appView')?.classList.add('hidden');
  document.getElementById('onbView')?.classList.add('hidden');
  openSheet('Einladung','<div class="spinner"></div>');
  const r=await API.get('/invite/'+encodeURIComponent(A11_INVITE_TOKEN));
  if(r.status===200&&r.data&&r.data.valid===true)return a11InviteForm(r.data.name);
  if(r.status===0)return a11InviteDead('Keine Verbindung. Dein Link gilt weiter – probier es gleich noch einmal.',true);
  a11InviteDead(r.data?.error||'Der Einladungslink ist abgelaufen oder wurde schon benutzt. Bitte lass dir einen neuen schicken.');}
// Sackgassen-Karte: sagt, was los ist, und lässt den Menschen nicht ohne Knopf zurück.
function a11InviteDead(msg,retry){
  openSheet('Einladung',`<div class="err">${esc2(msg)}</div>
    ${retry?`<button class="btn block" onclick="a11InviteBoot(A11_INVITE_TOKEN)">Erneut versuchen</button>`:''}
    <button class="btn block${retry?' sec mt-2':''}" onclick="closeAllSheets()">Zur Anmeldung</button>`);}
function a11InviteForm(name){
  const vorname=String(name||'').trim();
  openSheet(vorname?('Hallo '+vorname):'Willkommen',`<form id="a11InvForm" onsubmit="a11InviteAccept();return false" novalidate>
    <p class="body muted mb-4">Setz dir hier dein eigenes Passwort für BE INEVITABLE. Niemand außer dir kennt es – auch dein Coach nicht. Danach bist du gleich angemeldet.</p>
    ${pwField({id:'a11inv_pw',label:'Dein Passwort',autocomplete:'new-password',placeholder:'mind. 8 Zeichen',enterkeyhint:'next',hint:true})}
    ${pwField({id:'a11inv_pw2',label:'Wiederholen',autocomplete:'new-password',placeholder:'nochmal eingeben',enterkeyhint:'done'})}
    <button class="btn block" id="a11inv_go" type="submit">Passwort setzen und loslegen</button></form>`);
  setTimeout(()=>document.getElementById('a11inv_pw')?.focus({preventScroll:true}),380);}
async function a11InviteAccept(){
  const pw=val('a11inv_pw'),pw2=val('a11inv_pw2');
  if(!pw||pw.length<8)return showFieldErr('a11InvForm','Mindestens 8 Zeichen.','a11inv_pw');
  if(pw!==pw2)return showFieldErr('a11InvForm','Die Passwörter stimmen nicht überein.','a11inv_pw2');
  const btn=document.getElementById('a11inv_go');if(btn)btn.disabled=true;
  const r=await API.post('/invite/accept',{token:A11_INVITE_TOKEN,password:pw});
  if(btn)btn.disabled=false;
  if(r.status!==200){
    // Ein verbrauchter/abgelaufener Token ist kein Feldfehler – da hilft kein zweiter Versuch im Formular.
    if(/abgelaufen|benutzt/i.test(String(r.data?.error||'')))return a11InviteDead(r.data.error);
    if(r.status===0)return showFieldErr('a11InvForm',r.data?.error||'Keine Verbindung. Ist der Server erreichbar?','a11inv_pw');
    return showFieldErr('a11InvForm',r.data?.error||'Das hat nicht geklappt.','a11inv_pw');}
  A11_INVITE_TOKEN=null;                 // einmalig verbraucht – nichts davon bleibt liegen
  ME=r.data.user;
  try{snapState();}catch(e){}
  closeAllSheets();                      // erst schließen: das Sheet legt inert über #onbView
  setTimeout(()=>toast('Passwort gesetzt ✓'),400);
  // Ein frisch angelegter Athlet hat noch kein Ziel – der Einladungsweg bringt ihn direkt ins
  // Onboarding und damit über dessen letzten Schritt auch zur Einwilligung (A-II.4). Wer den
  // gleichen Linktyp nur zum Zurücksetzen bekommen hat (Betreiber, /admin/users/:id/resetpw),
  // hat sein Ziel längst und landet dort, wo er immer landet.
  if(ME&&ME.role==='athlete'&&!ME.goal&&typeof startOnboarding==='function')startOnboarding();
  else startApp();}

// ===== INIT =====
(async()=>{
  // Übrig gebliebener Sheet-Zustand aus der History (Reload mit offenem Sheet) -> neutralisieren
  try{if(history.state&&history.state.beSheet)history.replaceState(null,'',location.pathname+location.search+location.hash);}catch(e){}
  // Version auf dem Login-Screen anzeigen + mit Backend abgleichen (deckt Cache-Probleme auf).
  // Bewusst OHNE await: die Prüfung ist ein Hinweis, kein Startschritt – bis 2.3 wartete hier jeder Start
  // (auch der Login) einen vollen Round-Trip, bevor /api/me überhaupt losging. checkVersion (core.js)
  // fragt genau einmal; startApp hängt seinen Toast an dieselbe Antwort.
  const lv=document.getElementById('loginVersion');if(lv)lv.textContent='Version '+APP_VERSION;
  try{checkVersion().then(v=>{if(!v.mismatch)return;
    // Frontend (gecacht) und Backend (frisch deployt) laufen auseinander -> Hard-Reload nötig
    if(lv)lv.innerHTML=`App ${esc2(APP_VERSION)} · Server ${esc2(v.server)} – <a onclick="location.reload(true)" style="color:var(--red-text)">neu laden</a>`;
    console.warn('[Version] Frontend',APP_VERSION,'≠ Backend',v.server,'– bitte hart neu laden (Cache).');
  });}catch(e){}
  const params=new URLSearchParams(location.search);
  // Teilen-Link: Token merken (übersteht Login/Registrierung), URL säubern
  const shareTok=params.get('share');
  if(shareTok){localStorage.setItem('be_pending_share',shareTok);history.replaceState(null,'',location.pathname);}
  // Reset-Link aus E-Mail: Formular zeigen, KEIN Auto-Login nötig
  const resetTok=params.get('reset');
  if(resetTok){showResetForm(resetTok);return;}
  // Einladungslink (BUILD-A2 §4 Punkt 11): der EINZIGE Weg, auf dem ein vom Coach oder Betreiber
  // angelegtes Konto sein erstes Passwort bekommt. Ohne diesen Zweig endete der Link auf der normalen
  // Anmeldekarte – und das Konto trägt einen Hash, zu dem es kein Passwort gibt (server.js
  // NO_PASSWORD_HASH): Anmeldung unmöglich, Konto tot. Deshalb VOR /api/me: der Link gilt einem
  // bestimmten Konto, nicht dem, das hier vielleicht noch angemeldet ist.
  const inviteTok=params.get('invite');
  if(inviteTok){a11InviteBoot(inviteTok);return;}
  const r=await API.get('/me');
  if(r.status===200){ME=r.data.user;
    try{snapState();}catch(e){}   // letzter Stand für einen Start ohne Netz (core.js)
    startApp();
    // Rückmeldung der E-Mail-Verifizierung
    const v=params.get('verified');
    if(v==='1'){if(ME)ME.email_verified=1;history.replaceState(null,'',location.pathname);setTimeout(()=>toast('E-Mail bestätigt ✓'),400);}
    else if(v==='0'){history.replaceState(null,'',location.pathname);setTimeout(()=>toast('Bestätigungslink ungültig oder abgelaufen'),400);}
  } else {
    // Kein Netz beim Start (status 0): die Hülle kommt aus dem Cache des Service Workers, also darf hier
    // nicht das Anmeldeformular stehen bleiben – offlineBoot() fährt aus dem Schnappschuss hoch oder
    // schreibt wenigstens hin, warum gerade nichts geht. 4xx/5xx bleiben beim bisherigen Weg.
    if(r.status===0&&typeof offlineBoot==='function'&&offlineBoot())return;
    const v=params.get('verified');
    if(v==='1')setTimeout(()=>toast('E-Mail bestätigt ✓ – bitte anmelden'),400);
  }
})();
