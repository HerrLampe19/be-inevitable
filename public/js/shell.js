// BE INEVITABLE – Frontend, Teil «shell.js». Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js.
// Inhalt: Wischen zwischen Tabs · Sheet-System (Stapel, History, Griff, Wortkopf, confirmSheet) ·
// der große Titel (mountLargeTitle) · die Push-Ebene (pushPage/popPage) · Toast-Host mit
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
  // Steht eine Push-Ebene offen, wechselt ein Wisch NICHT den Reiter – der läge hinter der Ebene und
  // der Mensch sähe nichts davon. Nach rechts bedeutet hier dasselbe wie der Zurück-Knopf oben
  // (DESIGN-4 3.3: „Wischen zurück, wo möglich"); nach links bedeutet nichts. Die Geste ist keine
  // versteckte Funktion (G5/K5): der Zurück-Knopf mit dem Elternnamen steht die ganze Zeit sichtbar
  // darüber und ist der Hauptweg – das hier ist nur die Abkürzung für die, die sie kennen.
  if(typeof PUSH_STACK!=='undefined'&&PUSH_STACK.length){
    if(dx>0)popPage();
    try{if(navigator.vibrate)navigator.vibrate(8);}catch(x){}
    return;}
  const tabs=[...document.querySelectorAll('.navbtn')].map(b=>b.dataset.p);
  const cur=document.querySelector('.navbtn.on')?.dataset.p;const i=tabs.indexOf(cur);
  if(i<0||tabs.length<2)return;
  if(dx<0&&i<tabs.length-1)go(tabs[i+1]);                                        // nach links -> nächster Tab
  else if(dx>0&&i>0)go(tabs[i-1]);                                               // nach rechts -> vorheriger Tab
  try{if(navigator.vibrate)navigator.vibrate(8);}catch(e){}
},{passive:true});

// ===== SHEETS (Bottom-Sheet mit Stapel) =====
// openSheet(title,html,opts) legt eine Ebene auf den Stapel (+ history.pushState),
// closeModal() nimmt die oberste Ebene weg und zeigt die darunter wieder; die Zurück-Geste/-Taste macht dasselbe.
//
// opts (DESIGN-4 3.5 · alle vier sind freiwillig – ohne sie entscheidet der Rahmen, siehe _sheetHead):
//   size:'tall'                 die große der ZWEI Höhenstufen erzwingen (sonst wählt _sheetSettle)
//   cancel:'Wort'               das Wort links überschreiben (Standard: „Abbrechen" bzw. „Fertig")
//   done:{label,fn}             rechts „Fertig" mit einer Abschluss-Aktion; `fn` ist eine Funktion,
//     bzw. done:{label,onclick}  `onclick` ein JS-Ausdruck als Text (wie überall sonst in der App)
//   over:true                   darf ÜBER einem offenen Sheet liegen – NUR confirmSheet (S6)
//
// Regeln, damit bestehende Aufrufmuster keine Phantom-Ebenen erzeugen:
//  · gleicher Titel wie die oberste Ebene ODER oberste Ebene ist nur ein Spinner -> Inhalt wird ERSETZT (kein Push)
//  · Titel existiert weiter unten im Stapel -> Stapel wird bis dorthin abgebaut („Zurück"-Buttons, Kalender nach Planung)
// Sheet-Titel werden IMMER escaped (Namen von Athleten/Übungen/Rezepten landen hier) – Aufrufer übergeben Klartext.
let SHEET_STACK=[];   // [{title,html,opts,scroll}]
let _sheetHist=0;     // von uns gepushte History-Einträge des offenen Modals
let _sheetPop=0,_sheetPopT=null; // erwartete popstate-Events aus eigenem history.go()
let _sheetPendingPush=false;     // pushState wartet, bis ein eigenes history.go() durch ist (sonst überholt es der Browser)
let _pushPendingState=false;     // dasselbe für den History-Eintrag der Push-Ebene (siehe _pushPushLater)
let _CONFIRM_FN=null;
let _s6Reentry=false; // läuft gerade der Wieder-Aufruf aus der Verschachtelungssperre S6?

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
// Nachgeholt wird BEIDES: der Eintrag eines Sheets und der einer Push-Ebene. Die Push-Ebene kommt
// zuerst, weil sie in der Reihenfolge der Ereignisse zuerst entstanden ist (pushPage schließt das
// Sheet und legt DANN die Ebene an) – und weil ein Sheet über einer Ebene liegt, nie darunter.
function _sheetFlushPush(){
  if(_pushPendingState){_pushPendingState=false;if(typeof PUSH_STACK!=='undefined'&&PUSH_STACK.length)_pushDoPush();}
  if(!_sheetPendingPush)return;_sheetPendingPush=false;if(sheetOpen()&&SHEET_STACK.length)_sheetPush();}
function sheetOpen(){return !!document.getElementById('modal')?.classList.contains('on');}
function _isLoadingHtml(h){return /^\s*<div class="spinner"><\/div>\s*$/.test(h||'');}
function _sheetSnapshot(){const b=document.getElementById('sheetBody');return b?b.innerHTML:null;}
// ===== DER SHEET-KOPF (DESIGN-4 3.5 · S1–S5) =====
// Bis hierher trug der Kopf jedes Sheets ein rundes „×" und sonst nichts. Gemessen (A16/A11):
// 36 von 41 Sheets hatten KEIN Wort, das sagt, was ein Tipp darauf bedeutet – „×" heißt je nach
// Sheet „verwerfen", „schließen" oder „fertig", und man sieht es ihm nicht an.
// Ab jetzt steht links ein WORT. Welches, entscheidet der Bauplan des Sheets, nicht die Laune des
// Aufrufers:
//   · eine Ebene liegt darunter -> „‹ <Titel der Ebene darunter>"  (G3: Zurück trägt den Elternnamen)
//   · das Sheet nimmt EINGABEN  -> „Abbrechen"                     (S3)
//   · das Sheet zeigt nur       -> „Fertig"                        (S4, der einzige Fall ohne Abbrechen)
// „Nimmt Eingaben" wird am fertig gezeichneten DOM GEMESSEN (ein Feld im Körper), nicht geraten –
// deshalb läuft _sheetHead() nach dem Setzen von innerHTML.
// Rechts steht „Fertig" NUR, wenn der Aufrufer eine Abschluss-Aktion mitgibt ({done:{label,fn}} bzw.
// {done:{label,onclick}}). Ein „Fertig", das bloß schließt, wäre in einem Eingabe-Sheet eine Falle:
// der Mensch erwartet, dass es speichert. Die 41 Sheets selbst baut erst Welle 4/5 um – bis dahin
// tragen sie ihre Speichern-Knöpfe weiter im Körper, und der Kopf lügt nicht darüber.
const _SHEET_FIELDS='input:not([type=hidden]),textarea,select,[contenteditable="true"]';
let _SHEET_DONE=null;   // Abschluss-Aktion der obersten Ebene, wenn sie als Funktion kam
function _sheetDoneRun(){const d=_SHEET_DONE;
  if(!d||typeof d.fn!=='function')return closeModal();
  try{const r=d.fn();if(r&&typeof r.catch==='function')r.catch(e=>console.error('[sheet done]',e));}
  catch(e){console.error('[sheet done]',e);}}
// S5 · ZWEI HÖHEN, MEHR NICHT: 56 dvh (Standard) und 92 dvh (`.tall`).
// Welle 2 baut die Sheets NICHT um – ihre Inhalte sind noch die alten (das Essen-Sheet bringt
// 3.243 px mit). Würde die kleine Stufe für alle gelten, müsste man ab sofort in Sheets scrollen,
// in denen man heute alles sieht: ein gemessener Rückschritt (G12). Deshalb WÄHLT der Rahmen die
// Stufe, statt sie zu erzwingen – passt der Inhalt in die kleine, bleibt es dabei; sonst die große.
// Es gibt genau diese zwei Werte. Jedes Sheet, das auch in 92 dvh nicht fertig wird, gehört nach
// 3.4 auf eine Push-Seite; die Liste steht in DEFER-D4.md.
// Ein Bild später noch einmal hinsehen: mehrere Sheets tragen ihren Inhalt erst NACH dem Öffnen ein
// (Spinner -> Liste, Formular aus einer zweiten Antwort). Beim ersten Zeichnen stünde dort weder das
// Feld, an dem „Abbrechen" hängt, noch die Höhe, an der die Stufe hängt. Deshalb werden beide Fragen
// im nächsten Bild noch einmal gestellt – ein rAF, zwei Messungen, kein Beobachter.
function _sheetSettle(entry,depth,sh){
  requestAnimationFrame(()=>{
    if(!sh.isConnected||!sheetOpen())return;
    if(SHEET_STACK[SHEET_STACK.length-1]!==entry)return;          // inzwischen liegt etwas anderes da
    _sheetHead(entry,depth);
    if((entry.opts||{}).size!=='tall'&&!sh.classList.contains('tall')
       &&sh.scrollHeight>sh.clientHeight+4)sh.classList.add('tall');});}
function _sheetHead(entry,depth){
  const o=entry.opts||{};
  const lead=document.getElementById('sheetLead'),right=document.getElementById('sheetRight');
  if(!lead)return;
  const body=document.getElementById('sheetBody');
  const eingabe=!!(body&&body.querySelector(_SHEET_FIELDS));
  const done=(o.done&&(typeof o.done.fn==='function'||o.done.onclick))?o.done:null;
  _SHEET_DONE=(done&&typeof done.fn==='function')?{fn:done.fn}:null;
  if(right)right.innerHTML=done
    ? `<button type="button" class="sheet-done" onclick="${done.fn?'_sheetDoneRun()':esc(String(done.onclick))}">${esc2(done.label||'Fertig')}</button>`
    : '';
  let wort,zurueck=false;
  // S6-Ausnahme zuerst: confirmSheet liegt ÜBER einem Sheet (over:true) und bringt sein eigenes Wort
  // mit. Ohne diesen Zweig gewann der depth>1-Fall und schrieb den ELTERNTITEL nach links – gemessen
  // stand dort „Essen hinzufügen" über drei Zeilen (Kopf 90 statt 49 px), während im Körper
  // „Abbrechen" auf dem zweiten Knopf stand: zwei Wörter für denselben Ausgang. Ein „Zurück zum
  // Eltern-Sheet" gibt es hier auch gar nicht – der Rückweg IST das Abbrechen, das Eltern-Sheet
  // bleibt ja stehen.
  if(o.over&&o.cancel)wort=String(o.cancel);
  else if(depth>1&&SHEET_STACK[depth-2]&&SHEET_STACK[depth-2].title){wort=SHEET_STACK[depth-2].title;zurueck=true;}
  else if(o.cancel)wort=String(o.cancel);
  else wort=(eingabe||done)?'Abbrechen':'Fertig';
  // S2: ein langer Elternname wird NICHT gekürzt (G11) – er bricht um, der Kopf wird höher.
  lead.innerHTML=(zurueck?icon('chevronLeft',20):'')+`<span>${esc2(wort)}</span>`;
  lead.setAttribute('aria-label',zurueck?('Zurück zu '+wort):wort);
  lead.classList.toggle('back',zurueck);}
function _renderSheet(entry){const sh=document.getElementById('sheet');if(!sh)return;const o=entry.opts||{};const depth=SHEET_STACK.length;
  sh.classList.toggle('tall',o.size==='tall');sh.style.transform='';
  // S2: Titel mittig, 22/700. Zu lang -> `.long` setzt ihn auf 17/700. NIE abschneiden (G11);
  // bis hierher endete „Chest Supported DB Lateral …" im Nichts.
  const lang=String(entry.title||'').length>20;
  // id="sheetTitle" ist das Ziel von aria-labelledby (der Dialog trägt damit den Namen, den der Nutzer
  // sieht); tabindex="-1", weil der Fokus beim Öffnen auf die Überschrift springt.
  sh.innerHTML=`<div class="sheet-grip" aria-hidden="true"></div><div class="sheet-h">`+
    `<button type="button" class="sheet-cancel" id="sheetLead" onclick="closeModal()"></button>`+
    `<h3 id="sheetTitle" tabindex="-1"${lang?' class="long"':''}>${esc2(entry.title)}</h3>`+
    `<span class="sheet-right" id="sheetRight"></span></div><div id="sheetBody">${entry.html}</div>`;
  _sheetHead(entry,depth);
  sh.scrollTop=entry.scroll||0;
  _sheetSettle(entry,depth,sh);}
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
    else if(top&&!opts.over&&!_s6Reentry){
      // S6 · VERSCHACHTELUNG VERBOTEN. Genau EIN Sheet gleichzeitig; einzige Ausnahme ist
      // confirmSheet ({over:true}), das über einem Sheet liegen darf.
      // Gemessen war der Bestand: 213 openSheet-Aufrufe und 27 confirmSheet mit einem Stapel darunter
      // – ein Sheet über einem Sheet über einem Sheet ist ein Raum ohne Fenster (A15).
      // Statt den Aufruf zu verweigern (dann führte der Tipp ins Leere) wird das untere GESCHLOSSEN:
      // der Mensch landet auf dem, was er angetippt hat, und der Weg hinaus führt auf die Seite
      // zurück, nicht in eine Kette. Die Warnung nennt beide Titel – sie ist die Fundliste für die
      // Wellen 3–5, die diese Stellen in Push-Seiten verwandeln (3.4).
      console.warn('[Sheet] S6: „'+title+'" wollte über „'+top.title+'" liegen – das untere wird geschlossen.');
      _s6Reentry=true;
      try{closeAllSheets();openSheet(title,html,opts);}finally{_s6Reentry=false;}
      return;}
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
  // Sheets liegen ÜBER der Push-Ebene – deshalb werden sie zuerst abgebaut. Erst wenn keines mehr
  // offen ist, gilt die Zurück-Geste der Push-Ebene darunter.
  if(sheetOpen()&&SHEET_STACK.length){
    _sheetHist=Math.max(0,_sheetHist-1);
    if(SHEET_STACK.length>1){SHEET_STACK.pop();if(typeof stopBarcodeCam==='function')stopBarcodeCam();_renderSheet(SHEET_STACK[SHEET_STACK.length-1]);_a11SheetFocus();}
    else _sheetHide();
    return;}
  _pushPopstate();});
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
// confirmSheet ist die EINE Ausnahme von S6: es darf über einem Sheet liegen („Wirklich löschen?"
// gehört zu dem, was darunter steht, und darf es nicht wegräumen). `over:true` sagt der Sperre in
// openSheet genau das. Im Kopf steht links „Abbrechen" – dasselbe Wort wie auf dem zweiten Knopf,
// damit beide Wege dasselbe heißen.
function confirmSheet(title,text,o){o=o||{};_CONFIRM_FN=typeof o.onYes==='function'?o.onYes:null;
  const label=o.label||'Löschen',cancel=o.cancel||'Abbrechen',danger=o.danger!==false;
  openSheet(title,`<div class="body mb-4">${esc2(text||'').replace(/\n/g,'<br>')}</div>
    <button class="btn block${danger?' danger':''}" onclick="_confirmYes()">${esc2(label)}</button>
    <button class="btn block sec mt-2" onclick="closeModal()">${esc2(cancel)}</button>`,{over:true,cancel});}
function _confirmYes(){const f=_CONFIRM_FN;_CONFIRM_FN=null;closeModal();
  if(f)try{const r=f();if(r&&typeof r.catch==='function')r.catch(e=>console.error('[confirmSheet]',e));}catch(e){console.error('[confirmSheet]',e);}}

// =================================================================================================
// DER GROSSE TITEL (DESIGN-4 3.2 · G1/G2)
// =================================================================================================
// Jeder Bildschirm beginnt mit seinem Namen in 34/700 – und beim Scrollen schrumpft der Name in die
// kompakte Kopfzeile, die ihn dann bis ans Seitenende trägt. Das ist die eine Apple-Nachbildung, die
// sich lohnt: sie beantwortet „wo bin ich" zweimal, ohne zweimal Platz zu kosten.
//
// ZWEI TEILE, ZWEI ORTE:
//   · WIE der Titel heißt, steht in core.js (lgTitleText/lgTitleSub bei TITLES) – das ist Sache des
//     Routers.
//   · DASS er auf der Seite steht und beim Scrollen wandert, steht hier.
//
// WARUM DER TITEL EINGESETZT WIRD, STATT IM MARKUP ZU STEHEN:
// Welle 2 besitzt die Hülle (index.html, shell.js, core.js, app.css), nicht die dreizehn Ansichten.
// Die Ansichten bekommen ihren `<h1 class="lg-title">` in den Wellen 4 und 5 als festes Markup –
// dann tut ensureLargeTitle() nichts mehr (es rührt eine Seite nicht an, die schon einen Titel hat).
// Bis dahin setzt die Hülle ihn ein, damit die Regel ab dieser Welle für JEDE Ansicht gilt und nicht
// erst in zwei Wellen. Ein `data-auto`-Merker sagt, welcher Titel von hier kommt.
let _titleObs=null;      // Beobachter, der das Verschwinden des großen Titels meldet
let _lgObs=null;         // Beobachter, der das Neuzeichnen einer Ansicht meldet
let _lgRaf=0;
let _hintObs=null;       // Beobachter für den Installations-Hinweis (siehe _hintUnderTitle)
// Die Kopfzeile ist 56 px hoch – plus Safe-Area, plus die 8 px Polster oben und unten. Statt die
// Zahl zu raten, wird sie gemessen: sie ist der Punkt, an dem der große Titel „oben aus dem Bild"
// ist, und zugleich der Punkt, an dem die Push-Ebene beginnt.
function lgHdrH(){const h=document.querySelector('.hdr');
  return h?Math.round(h.getBoundingClientRect().height):56;}
// Wo die Push-Ebene beginnen DARF, ist nicht dasselbe wie die Höhe der Kopfzeile. Unter der
// Kopfzeile kann die Kontextleiste des Coaches stehen („Du siehst: Marco Munsch · Verlassen") – und
// die beantwortet die schärfste Form von „wo bin ich": nicht welcher Bildschirm, sondern WESSEN
// Daten. Gemessen lag die Ebene mit --push-top:61px genau darüber: der Knopf „Verlassen" war im
// Bild und unter dem Finger weg (elementFromPoint traf .push-bar). Deshalb zählt hier die Unterkante
// dessen, was oben wirklich steht. Die Leiste klebt NICHT (kein position:sticky) – ist die Seite
// gescrollt, liegt ihre Unterkante über der Kopfzeile, und dann bleibt es bei der Kopfzeile.
function pushTopPx(){
  const h=document.querySelector('.hdr');
  let unten=h?Math.round(h.getBoundingClientRect().bottom):56;
  const cb=document.getElementById('ctxBar');
  if(cb){const r=cb.getBoundingClientRect();
    if(r.height>0&&Math.round(r.bottom)>unten)unten=Math.round(r.bottom);}
  return Math.max(0,unten);}
// Die Seite, um die es gerade geht: die Push-Ebene, wenn eine offen ist, sonst der Reiter.
function _lgScope(){const pv=document.getElementById('pushView');
  return (pv&&!pv.hidden)?pv:document.getElementById('views');}
function ensureLargeTitle(){
  const pv=document.getElementById('pushView');
  if(pv&&!pv.hidden)return;                       // Push-Seiten bringen ihren Titel selbst mit
  const v=document.getElementById('views');if(!v)return;
  const page=v.querySelector('.page.on')||v.querySelector('.page');
  if(!page)return;
  if(page.querySelector(':scope > .lg-title'))return;            // Welle 4/5 hat hier schon einen
  const t=(typeof lgTitleText==='function')?lgTitleText(CUR_TAB):'';
  if(!t)return;
  const h=document.createElement('h1');
  h.className='lg-title';h.dataset.auto='1';
  h.appendChild(document.createTextNode(t));
  const sub=(typeof lgTitleSub==='function')?lgTitleSub(CUR_TAB):'';
  if(sub){const s=document.createElement('small');s.textContent=sub;h.appendChild(s);}
  page.insertBefore(h,page.firstChild);}
function mountLargeTitle(){
  ensureLargeTitle();
  const scope=_lgScope();
  const inPush=!!(scope&&scope.id==='pushView');
  const top=(inPush&&typeof PUSH_STACK!=='undefined'&&PUSH_STACK.length)?PUSH_STACK[PUSH_STACK.length-1]:null;
  const h=scope?(scope.querySelector('.page.on .lg-title')||scope.querySelector('.lg-title')):null;
  const hd=document.getElementById('hdrTitle'),hdr=document.querySelector('.hdr');
  if(_titleObs){_titleObs.disconnect();_titleObs=null;}
  if(!hd)return;
  if(!h){
    // Keine Seite mit großem Titel (Onboarding, Anmeldung, eine Ansicht im Aufbau): dann steht der
    // kompakte Titel IMMER da. Ein Bildschirm ohne Titel gibt es nicht (G1).
    // Steht eine Push-Ebene offen, ist ihr Name die Wahrheit – vorher blieb hier der Text des
    // REITERS stehen und wurde sichtbar gemacht: Kopfzeile „Training", Zurück-Knopf „‹ Training",
    // Reiter „Training" – und der Bildschirm hieß Bankdrücken. _renderPush() setzt inzwischen
    // selbst einen großen Titel ein, das hier ist der Gürtel zum Hosenträger.
    if(top&&(top.short||top.title))hd.textContent=String(top.short||top.title);
    hd.classList.add('sunk');hdr&&hdr.classList.remove('lg','scrolled');return;}
  const wort=(h.firstChild&&h.firstChild.nodeType===3?h.firstChild.textContent:h.textContent)||'';
  // G2: derselbe Text wie oben auf der Seite. Die EINE Ausnahme ist `short` aus pushPage(): in
  // 210 px Kopfzeile steht „Chest Supported Dumbbell Lateral Raise" nicht, und Abschneiden ist nach
  // G11 verboten. Wer einen langen Namen auf eine Ebene legt, gibt die Kurzform selbst mit; ohne sie
  // bleibt es beim vollen Wort (das CSS setzt dann wenigstens ein Auslassungszeichen).
  hd.textContent=(top&&top.short)?String(top.short):wort.trim();
  hd.classList.remove('sunk');         // Startzustand: der große Titel steht da, der kleine nicht
  hdr&&hdr.classList.add('lg');
  hdr&&hdr.classList.toggle('scrolled',false);
  const bar=inPush?scope.querySelector('.push-bar'):null;
  const oben=inPush?(bar?Math.round(bar.getBoundingClientRect().height):0):lgHdrH();
  try{
    _titleObs=new IntersectionObserver(([e])=>{
      const weg=!e.isIntersecting;
      hd.classList.toggle('sunk',weg);
      document.querySelector('.hdr')?.classList.toggle('scrolled',weg);
    },{root:inPush?scope:null,rootMargin:`-${oben}px 0px 0px 0px`,threshold:0});
    _titleObs.observe(h);
  }catch(e){hd.classList.add('sunk');}   // ohne IntersectionObserver: kompakter Titel steht fest
}
// Die dreizehn Ansichten zeichnen sich selbst neu – nach dem Cache, nach der Netzantwort, nach jeder
// Eingabe. Jedes dieser Neuzeichnen ersetzt `#views` komplett und nähme den eingesetzten Titel mit.
// Der Beobachter setzt ihn wieder ein. Er kostet einen Aufruf je Zeichenvorgang und darin genau ein
// querySelector; das Einsetzen selbst löst ihn erneut aus, findet den Titel dann aber vor und tut
// nichts. Er fällt ersatzlos weg, sobald die Ansichten ihren Titel selbst mitbringen (Welle 4/5).
function _lgObserve(){
  const v=document.getElementById('views');if(!v||_lgObs)return;
  _lgObs=new MutationObserver(()=>{
    if(_lgRaf)return;
    _lgRaf=requestAnimationFrame(()=>{_lgRaf=0;
      const pv=document.getElementById('pushView');if(pv&&!pv.hidden)return;
      const page=v.querySelector('.page.on');
      if(!page)return;
      if(!page.querySelector(':scope > .lg-title'))mountLargeTitle();
      _hintUnderTitle();});});
  _lgObs.observe(v,{childList:true,subtree:true});
  // Der Installations-Hinweis wird als GESCHWISTER von #views eingehängt (account.js), also außerhalb
  // des beobachteten Baums. Ein zweiter, flacher Beobachter am Elternknoten meldet ihn – er sieht nur
  // childList auf EINER Ebene und kostet damit nichts.
  const app=v.parentNode;
  if(app&&!_hintObs){_hintObs=new MutationObserver(()=>{_hintUnderTitle();});
    _hintObs.observe(app,{childList:true});}}
document.addEventListener('DOMContentLoaded',_lgObserve);
if(document.readyState!=='loading')_lgObserve();

// ===== DER INSTALLATIONS-HINWEIS GEHÖRT UNTER DEN TITEL, NICHT DARÜBER =====
// account.js hängt `.note.install-hint` vor #views – damit stand auf vier von fünf Reitern das
// ERSTE Element unter der Kopfzeile nicht der Ortsname, sondern eine Werbezeile (gemessen auf
// Ernährung: Hinweis bei y=69, „Ernährung" bei y=145; elementFromPoint(195,80) traf den Knopf
// „Als App installieren"). Genau die Ortsangabe, die diese Welle eingeführt hat, war verdeckt.
// Hier wird die Zeile an ihren Platz gesetzt: erster Abschnitt UNTER dem großen Titel. VERSCHOBEN,
// nicht nachgebaut – account.js behält seine Zeile mit Text, ✕, Trichter und Merker, diese Datei
// rührt nur den Ort an. Und sie erzeugt NIE eine: WANN der Hinweis gilt, entscheidet allein der
// Trichter in account.js/home.js. Ein Versuch, ihn beim Neuzeichnen selbst nachzufordern, hat in
// der Messung genau das getan, was er nicht darf – er ließ die Zeile auf sechs weiteren Ansichten
// erscheinen (K6 167→190, K9 23→29, K11 265→277). Wird #views neu gezeichnet, geht die Zeile mit
// und kommt beim nächsten Anlass von account.js wieder; dass sie das Neuzeichnen übersteht, ist
// Sache von Welle 4 (dann steht sie als Abschnitt im Markup der Ansicht, siehe DEFER-D4).
function _hintUnderTitle(){
  const pv=document.getElementById('pushView');if(pv&&!pv.hidden)return;   // unter der Ebene sieht sie ohnehin niemand
  const b=document.getElementById('iosInstallHint');if(!b)return;
  const v=document.getElementById('views');if(!v)return;
  const page=v.querySelector('.page.on');if(!page)return;
  const h=page.querySelector(':scope > .lg-title');
  const soll=h?h.nextSibling:page.firstChild;       // Platz 1 unter dem Titel, sonst Platz 1 der Seite
  if(b===soll)return;                               // steht schon dort
  if(h&&b.parentNode===page&&b.previousSibling===h)return;  // dito, wenn der Titel letztes Kind war
  page.insertBefore(b,soll);}

// =================================================================================================
// PUSH-NAVIGATION (DESIGN-4 3.3 · N1–N6)
// =================================================================================================
// Bis hierher kannte die App genau zwei Räume: den Reiter und das Sheet von unten. Alles, was tiefer
// liegt als ein Reiter – die Übung, der Athlet, das Profil – war ein Sheet: ohne Titel in der
// Kopfzeile, ohne Zurück-Weg mit Ziel, ohne Platz (gemessen: 240 Sheet-Bildschirme hinter 5 Türen).
//
// Die Push-Ebene ist der dritte Raum und die Antwort auf die Prüffrage aus 3.4: „Kann ich das halb
// erledigt liegen lassen und morgen weitermachen?" Ja -> Push-Seite. Nein -> Sheet.
//
// Die sechs Regeln, hier im Code durchgesetzt:
//   N1  Der Zurück-Knopf trägt IMMER den Namen des Elternbildschirms, nie „Zurück" (G3).
//   N2  Die Reiterleiste bleibt sichtbar; ein Reiterwechsel räumt den Stapel ab (go() -> closeAllPages).
//   N3  Höchstens zwei Ebenen tief – die dritte ersetzt die oberste und meldet sich in der Konsole.
//   N4  Jede Push-Seite hat einen großen Titel (mountLargeTitle läuft nach jedem Zeichnen).
//   N5  Die Wisch-zurück-Geste wird nicht als Ziehen nachgebaut; der sichtbare Zurück-Knopf ist der
//       Weg. Was es gibt: die Zurück-Geste des Browsers (der Stapel liegt in der History) und den
//       Wisch nach rechts (oben im Tab-Wisch-Zweig) – beides Abkürzungen, keine Alleinwege.
//   N6  Deep-Link ohne eigenen History-Eintrag -> nur zeichnen, NIE history.back() aus der App heraus.
//
// pushPage(key,title,parent,html,{onMount,sub,short}) – `parent` ist der Text im Zurück-Knopf.
//   sub    Unterzeile des großen Titels (Kontext: Muskelgruppe, Zeitraum, Elternobjekt – nie eine Aktion)
//   short  Kurzform für die KOMPAKTE Kopfzeile, wenn der Titel dort nicht hinpasst (G11, siehe
//          mountLargeTitle). Ohne `short` steht dort das volle Wort.
// `title` wird gezeichnet: bringt `html` keinen eigenen <h1 class="lg-title"> mit, setzt
// _renderPush() einen aus `title` (und `sub`) ein – das Gegenstück zu ensureLargeTitle() für die
// Reiter. Damit ist N4 („jede Push-Seite hat einen großen Titel") durchgesetzt statt erhofft.
let PUSH_STACK=[];        // [{key,title,sub,short,parent,html,scroll,onMount}]
let _pushHist=0;          // von uns gepushte History-Einträge
let _pushPop=0,_pushPopT=null;  // erwartete popstate-Ereignisse aus eigenem history.back()/go()
function pushOpen(){return PUSH_STACK.length>0;}
function _pushSnapshot(el){const p=el.querySelector('.page');if(!p)return null;
  const c=p.cloneNode(true);const b=c.querySelector('.push-bar');if(b)b.remove();return c.innerHTML;}
// Der eigene History-Eintrag der Ebene – und warum er warten können muss:
// pushPage() schließt zuerst ein offenes Sheet. closeAllSheets() nimmt dessen Einträge mit
// history.go(-k) zurück, und das ist ASYNCHRON. Ein synchrones history.pushState direkt danach legt
// den Eintrag an, den die anstehende go(-k) im selben Atemzug wieder wegnimmt; das zugehörige
// popstate wird vom _sheetPop-Zähler geschluckt, also korrigiert niemand _pushHist. Gemessen:
// history.length blieb bei 3 statt auf 4 zu steigen, history.state war {beSheet} statt {bePush},
// und der erste Zurück-Druck verließ die App (edge://sync-confirmation-dialog/) – mit der Ebene
// sichtbar über einer fremden Seite. shell.js hat für genau diese Reihenfolge schon eine
// Warteschlange (_sheetPendingPush/_sheetFlushPush); die Push-Ebene benutzt sie jetzt auch.
function _pushDoPush(){try{history.pushState({bePush:PUSH_STACK.length},'');_pushHist++;}catch(e){}}
function _pushPushLater(){if(_sheetPop>0)_pushPendingState=true;else _pushDoPush();}
function pushPage(key,title,parent,html,opts){
  opts=opts||{};
  const el=document.getElementById('pushView');if(!el)return;
  // Eine laufende Einführungs-Tour überlebt keinen Ebenenwechsel – ihr Overlay liegt mit z-index 9999
  // über allem, hat pointer-events:auto und zeigt auf Elemente, die auf der neuen Seite nicht stehen.
  // Gemessen: der Zurück-Knopf der Ebene war nicht anklickbar (elementFromPoint traf .tour-ov), die
  // Karte erklärte „Dein Tag", während der Bildschirm „Bankdrücken" hieß. Dieselbe Zeile steht in
  // go() (core.js); sie hat hier gefehlt.
  if(typeof endTour==='function'&&document.getElementById('tourOv'))endTour();
  // Ein Sheet und eine Push-Seite gleichzeitig wären zwei Grammatiken übereinander (A14). Führt eine
  // Aktion im Sheet auf eine Seite, wird das Sheet geschlossen (3.5 S6, letzter Satz).
  if(typeof sheetOpen==='function'&&sheetOpen())closeAllSheets();
  if(PUSH_STACK.length){const t=PUSH_STACK[PUSH_STACK.length-1];
    const snap=_pushSnapshot(el);if(snap!=null)t.html=snap;t.scroll=el.scrollTop;}
  const eintrag={key:String(key||''),title:String(title||''),
                 sub:opts.sub==null?'':String(opts.sub),short:opts.short==null?'':String(opts.short),
                 parent:String(parent||''),
                 html:String(html==null?'':html),scroll:0,onMount:typeof opts.onMount==='function'?opts.onMount:null};
  if(PUSH_STACK.length>=2){
    console.warn('[push] N3: „'+eintrag.title+'" wäre die dritte Ebene – die oberste wird ersetzt. Die Struktur gehört flacher.');
    // N1 gilt auch im Ausnahmefall: der Zurück-Knopf trägt den Namen der Ebene, die nach dem Ersetzen
    // WIRKLICH darunter liegt. Der vom Aufrufer übergebene `parent` zeigt auf die Ebene, die gerade
    // verschwindet – gemessen stand danach „‹ Ebene B" über einem Stapel [Ebene A, Ebene C], und ein
    // Tipp darauf landete auf „Ebene A": ein Zurück-Weg mit dem Namen eines Bildschirms, den es nicht
    // mehr gibt (K13).
    eintrag.parent=String(PUSH_STACK[PUSH_STACK.length-2].title||eintrag.parent||'');
    PUSH_STACK[PUSH_STACK.length-1]=eintrag;}
  else{PUSH_STACK.push(eintrag);_pushPushLater();}
  _renderPush();}
function popPage(){
  if(!PUSH_STACK.length)return;
  PUSH_STACK.pop();
  if(_pushHist>0){
    _pushHist--;_pushPop++;clearTimeout(_pushPopT);_pushPopT=setTimeout(()=>{_pushPop=0;},900);
    try{history.back();}catch(e){_pushPop=0;}}
  _renderPush();}
// Reiterwechsel: der ganze Stapel fällt. Die eigenen History-Einträge werden in EINEM Sprung
// zurückgenommen, damit die Zurück-Taste danach dorthin führt, wo der Mensch vorher war.
function closeAllPages(){
  if(!PUSH_STACK.length)return;
  const n=Math.min(_pushHist,PUSH_STACK.length);
  PUSH_STACK=[];_renderPush();
  if(n>0){_pushHist-=n;_pushPop+=n;clearTimeout(_pushPopT);_pushPopT=setTimeout(()=>{_pushPop=0;},900);
    try{history.go(-n);}catch(e){_pushPop=0;}}}
function _pushPopstate(){
  if(_pushPop>0){_pushPop--;if(_pushPop===0)clearTimeout(_pushPopT);return true;}
  if(!PUSH_STACK.length)return false;
  _pushHist=Math.max(0,_pushHist-1);
  PUSH_STACK.pop();_renderPush();return true;}
function _renderPush(){
  const el=document.getElementById('pushView');if(!el)return;
  const top=PUSH_STACK[PUSH_STACK.length-1];
  if(!top){el.hidden=true;el.innerHTML='';document.body.classList.remove('push-open');
    el.style.removeProperty('--push-top');
    if(typeof mountLargeTitle==='function')mountLargeTitle();return;}
  // Die Ebene beginnt UNTER der Kopfzeile: die bleibt stehen und trägt den kompakten Titel, die
  // Suche, die Glocke und den Avatar. Die Höhe wird gemessen statt geraten – sie wächst mit der
  // Safe-Area des Geräts und mit der Textgröße des Systems.
  el.style.setProperty('--push-top',pushTopPx()+'px');
  el.hidden=false;document.body.classList.add('push-open');
  el.innerHTML=`<div class="page on"><div class="push-bar">`+
    `<button type="button" class="push-back" onclick="popPage()" aria-label="Zurück zu ${esc2(top.parent)}">`+
    `${icon('chevronLeft',20)}<span>${esc2(top.parent)}</span></button></div>${top.html}</div>`;
  // N4 · JEDE Push-Seite hat einen großen Titel. Bringt der Aufrufer keinen mit, wird er aus `title`
  // gebaut – derselbe Bau wie in ensureLargeTitle() für die Reiter. Bis hierher war der
  // title-Parameter nirgends gezeichnet: eine Ebene ohne eigenen <h1> hatte GAR KEINEN Titel, und
  // die Kopfzeile trug weiter den Namen des Elternbildschirms. Der Parameter war damit eine Falle
  // für jeden, der eine Seite baut; jetzt ist er die Zusicherung.
  const seite=el.querySelector('.page');
  if(seite&&top.title&&!seite.querySelector('.lg-title')){
    const h1=document.createElement('h1');
    h1.className='lg-title';h1.dataset.auto='1';
    h1.appendChild(document.createTextNode(top.title));
    if(top.sub){const s=document.createElement('small');s.textContent=top.sub;h1.appendChild(s);}
    const bar=seite.querySelector('.push-bar');
    seite.insertBefore(h1,bar?bar.nextSibling:seite.firstChild);}
  el.scrollTop=top.scroll||0;
  if(top.onMount)try{top.onMount();}catch(e){console.error('[push]',e);}
  if(typeof mountLargeTitle==='function')mountLargeTitle();
  // Der Fokus springt auf den großen Titel der neuen Seite – derselbe Weg wie beim Sheet, damit ein
  // Screenreader sagt, wo man gelandet ist, statt stumm auf dem alten Knopf stehen zu bleiben.
  const h=el.querySelector('.lg-title');
  if(h){h.setAttribute('tabindex','-1');try{h.focus({preventScroll:true});}catch(e){}}}

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
  // Übrig gebliebener Sheet- ODER Ebenen-Zustand aus der History (Reload mit offenem Sheet bzw. auf
  // einer Push-Seite) -> neutralisieren. Ohne den bePush-Teil behauptete der Eintrag nach dem
  // Neuladen weiter, hier liege eine Ebene, die es nicht mehr gibt (gemessen: state {"bePush":1} auf
  // einer Startseite ohne Stapel). Die Seite selbst kommt damit NICHT zurück – Push-Seiten haben
  // heute keine URL; das ist als N6-Schuld in DEFER-D4.md notiert und gehört Welle 3.
  try{if(history.state&&(history.state.beSheet||history.state.bePush))history.replaceState(null,'',location.pathname+location.search+location.hash);}catch(e){}
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
