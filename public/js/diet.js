// BE INEVITABLE – Frontend, Teil «diet.js» (WP3 · Ernährung). Klassische Skripte in fester Reihenfolge
// (siehe index.html); alle Funktionen sind global, wie zuvor in der einen app.js.
// Aufbau: Grundgerüst/Tabs · Slot-Enum & Ziele · Heute (Ring, Nächste Mahlzeit, Protokoll) · Essen hinzufügen
// (Liste/Scan/Manuell/Neu, Mehrfach-Eintrag) · Plan (Mahlzeiten, Tauschen, Optionen) · Rezepte · Einkauf ·
// Barcode · Makro-Rechner. Exporte für andere Bereiche: nextPlanMeal(summary?) -> {mealId,label,slot,kcal,
// protein,logged,done,total,preview}|null, logFromMeal(mealId) -> boolean, openLogFood({focus}), openCalc().
// Reiterwahl von außen: renderDiet.tab = 'track'|'plan'|'recipes'|'cart' vor go('diet').
// ===== DIET: GRUNDGERÜST =====
const MEAL_SLOTS=['Frühstück','Mittag','Abend','Snack','Pre-Workout','Post-Workout']; // spiegelt logic.js MEAL_SLOTS
const SLOT_ORDER=['Frühstück','Pre-Workout','Post-Workout','Mittag','Snack','Abend','Sonstiges'];
// Eigenes Konto? (Coach-Kontext und der Zustand vor dem Login sind beide „nein")
function _dietSelf(){return !!(typeof ME!=='undefined'&&ME)&&VIEW_USER===ME.id;}
// Ins Protokoll schreibt nur der Athlet selbst – wie beim Check-in („Nur Ansicht") ist die Ernährung im
// Coach-Blick reine Ansicht. Die Schaltflächen werden gar nicht erst gezeichnet, _dietRO() fängt den Rest ab
// (z.B. eine Schaltfläche, die auf der Startseite noch aus einem alten Zustand stammt).
const DIET_RO_TX='Nur Ansicht – das Essen trägt dein Athlet selbst ein.';
function _dietRO(){if(_dietSelf())return false;toast(DIET_RO_TX);return true;}
function _dietShell(tab){return `<div class="page on">
    <div class="seg" id="dietSeg">
      <button id="dt_track" class="${tab==='track'?'on':''}" onclick="dietTab('track')">Heute</button>
      <button id="dt_plan" class="${tab==='plan'?'on':''}" onclick="dietTab('plan')">Plan</button>
      <button id="dt_recipes" class="${tab==='recipes'?'on':''}" onclick="dietTab('recipes')">Rezepte</button>
      ${_dietSelf()?`<button id="dt_cart" class="${tab==='cart'?'on':''}" onclick="dietTab('cart')">Einkauf</button>`:''}
    </div>
    <div id="dietBody">${skeleton(3)}</div></div>`;}
// renderDiet(v,opts): zeichnet sofort aus dem Speicher (wenn vorhanden) und lädt im Hintergrund nach.
// opts.cached=true (Router hat gecachtes HTML gemalt) -> Gerüst bleibt stehen, nur Daten/Body werden erneuert.
async function renderDiet(v,opts){opts=opts||{};
  if(!TODAY)await loadToday();
  const eff=TODAY?.confirmed||TODAY?.suggestion;renderDiet.todayType=(eff?.type==='train')?'training':'rest';
  if(renderDiet.user!==VIEW_USER){renderDiet.meals=null;renderDiet.foodlog=null;renderDiet.user=VIEW_USER;RC_CACHE={};RC_ALL=null;LF_RECENT=null;OPEN_MEALS=new Set();RECIPE_FILTER=null;RECIPE_Q='';}
  DIET=renderDiet.todayType;
  if(renderDiet.tab==='cart'&&!_dietSelf())renderDiet.tab='track';
  const tab=renderDiet.tab||'track';
  const cached=!!(renderDiet.meals&&renderDiet.foodlog&&renderDiet.foodlogDate===today());
  if(!(opts.cached&&document.getElementById('dietBody'))||!cached)v.innerHTML=_dietShell(tab);
  if(cached)dietTab(tab); // sofort aus dem Speicher malen, dann still nachladen
  const before=cached?JSON.stringify([renderDiet.meals,renderDiet.foodlog]):null;
  const [mr,fr]=await Promise.all([API.get('/meals/'+VIEW_USER),API.get('/foodlog/'+VIEW_USER+'?date='+today())]);
  if(!document.getElementById('dietBody'))return; // Nutzer ist inzwischen woanders
  if(mr.status===200)renderDiet.meals=mr.data?.meals||[];else if(!renderDiet.meals)renderDiet.meals=[];
  if(fr.status===200)renderDiet.foodlog=fr.data||{items:[],summary:{}};else if(!renderDiet.foodlog)renderDiet.foodlog={items:[],summary:{}};
  renderDiet.foodlogDate=today();
  const after=JSON.stringify([renderDiet.meals,renderDiet.foodlog]);
  if(!cached||before!==after)dietTab(renderDiet.tab||tab);
  if(typeof maybeStartTabTour==='function')try{maybeStartTabTour('diet',{deferred:true});}catch(e){}}
function _dietMark(t){renderDiet.tab=t;
  [['track','dt_track'],['plan','dt_plan'],['recipes','dt_recipes'],['cart','dt_cart']].forEach(([k,id])=>{const el=document.getElementById(id);if(el)el.classList.toggle('on',t===k);});}
function dietTab(t){if(t==='cart'&&!_dietSelf())t='track'; // Einkaufswagen nur im eigenen Konto
  if(!['track','plan','recipes','cart'].includes(t))t='track';
  _dietMark(t);
  if(t==='track')drawTrack();else if(t==='plan')drawDiet();else if(t==='cart')drawCart();else drawRecipes();}
// Protokoll neu laden (nach jeder Änderung) + Home-Cache verwerfen; zeichnet den sichtbaren Reiter neu
async function refreshFoodlog(redraw){const fr=await API.get('/foodlog/'+VIEW_USER+'?date='+today());
  if(fr.status===200){renderDiet.foodlog=fr.data;renderDiet.foodlogDate=today();}
  if(typeof invalidateView==='function')try{invalidateView('home');}catch(e){}
  _homeFoodPatch(); // Start-Kachel sofort nachziehen, wenn dort geloggt wurde (Home-Chip „Essen loggen")
  if(redraw!==false&&document.getElementById('dietBody')){if(renderDiet.tab==='plan')drawDiet();else if(renderDiet.tab==='track'||!renderDiet.tab)drawTrack();}
  return renderDiet.foodlog;}
// Wenn gerade die Startseite sichtbar ist (Essen aus dem Home-Chip geloggt): deren Ernährungs-Kachel mit
// den frischen Daten neu zeichnen. Alles defensiv – Home gehört WP1, die Funktionen können fehlen.
function _homeFoodPatch(){try{
    if(!document.getElementById('homeFood')||typeof homePatch!=='function'||typeof homeFoodHTML!=='function')return;
    if(typeof HOME_DATA!=='undefined'&&HOME_DATA&&renderDiet.foodlog)HOME_DATA.foodlog=renderDiet.foodlog;
    homePatch('homeFood',homeFoodHTML());
    if(typeof drawHomeGoals==='function'&&document.getElementById('homeGoals'))homePatch('homeGoals',drawHomeGoals());
    if(typeof homeCache==='function')homeCache();
  }catch(e){}}
async function refreshMeals(redraw){const mr=await API.get('/meals/'+VIEW_USER);if(mr.status===200)renderDiet.meals=mr.data?.meals||[];
  if(typeof invalidateView==='function')try{invalidateView('home');}catch(e){}
  if(redraw!==false&&document.getElementById('dietBody')){if(renderDiet.tab==='track')drawTrack();else if(renderDiet.tab==='plan')drawDiet();}
  return renderDiet.meals;}

// ===== SLOT-ENUM, ZIELE, PLAN-HELFER =====
// Mahlzeit-Slot aus Uhrzeit (bzw. aus dem zuletzt genutzten Slot, 90 Min. lang) – für Vorauswahl im Sheet
function slotDefault(){try{const m=JSON.parse(localStorage.getItem('be_lf_slot')||'null');
    if(m&&MEAL_SLOTS.includes(m.slot)&&Date.now()-(m.ts||0)<90*60000)return m.slot;}catch(e){}
  let ts=0;try{ts=+(window.LAST_SET_TS||0)||+(localStorage.getItem('be_last_set')||0);}catch(e){}
  if(ts&&Date.now()-ts<2*3600000)return 'Post-Workout'; // gerade trainiert
  const h=new Date().getHours();return h<10?'Frühstück':h<14?'Mittag':h<17?'Snack':'Abend';}
function slotRemember(s){if(!MEAL_SLOTS.includes(s))return;try{localStorage.setItem('be_lf_slot',JSON.stringify({slot:s,ts:Date.now()}));}catch(e){}}
function slotSelect(id,sel){sel=sel||slotDefault();return `<div class="field"><label>Mahlzeit</label><select id="${id}" onchange="slotRemember(this.value)">${MEAL_SLOTS.map(s=>`<option${s===sel?' selected':''}>${s}</option>`).join('')}</select></div>`;}
// Plan-Mahlzeit (Label/Slot) -> Enum-Slot; fallback wenn nichts passt
function mealSlotOf(m,fallback){m=m||{};if(m.slot&&MEAL_SLOTS.includes(m.slot))return m.slot;
  const l=String(m.label||m.meal_slot||'').toLowerCase();
  if(MEAL_SLOTS.includes(m.label))return m.label;
  if(/pre[\s\-\/]?(post[\s\-]?)?workout|vor dem training/.test(l))return 'Pre-Workout';
  if(/post[\s\-]?workout|nach dem training/.test(l))return 'Post-Workout';
  if(/frühstück|fruehstueck|breakfast/.test(l))return 'Frühstück';
  if(/mittag|lunch/.test(l))return 'Mittag';
  if(/abend|dinner/.test(l))return 'Abend';
  if(/snack|zwischen/.test(l))return 'Snack';
  if(m.slot==='b')return 'Frühstück';if(m.slot==='l')return 'Mittag';if(m.slot==='d')return 'Abend';if(m.slot==='s')return 'Snack';
  return fallback||'Snack';}
function slotNorm(s){if(!s)return 'Sonstiges';return mealSlotOf({label:s},'Sonstiges');}
function planMeals(dayType){return (renderDiet.meals||[]).filter(m=>m.day_type===(dayType||DIET)&&!/supplement/i.test(m.label||''));}
function mealTotals(m){const t={kcal:0,protein:0,carbs:0,fat:0};(m.items||[]).forEach(it=>{t.kcal+=it.kcal||0;t.protein+=it.protein||0;t.carbs+=it.carbs||0;t.fat+=it.fat||0;});return t;}
// Welche Plan-Mahlzeiten sind heute schon im Protokoll? (meal_id vom Backend; Fallback: Label-Abgleich ganzer Mahlzeiten)
function loggedMealIds(){const items=renderDiet.foodlog?.items||[];const ids=new Set(),labels=new Set();
  items.forEach(it=>{if(it.meal_id)ids.add(+it.meal_id);
    if(it.details)labels.add(String(it.food||'').toLowerCase());}); // ganze Mahlzeiten auch über den Namen (Plan neu erstellt = neue IDs)
  return {ids,labels};}
function mealLogged(m,L){L=L||loggedMealIds();if(L.ids.has(m.id))return true;
  const lbl=String(m.label||'').toLowerCase();return !!lbl&&L.labels.has(lbl);}
// Ziele (kcal + Makros) aus EINER Quelle: summary.targets vom Server -> Plan-Summen des Tagtyps -> alte Client-Formel
function dietTargets(){const sum=renderDiet.foodlog?.summary||{};const kcal=sum.target||0;
  const t=sum.targets;
  if(t&&(t.kcal||t.protein))return {kcal:t.kcal||kcal,protein:Math.round(t.protein||0),carbs:Math.round(t.carbs||0),fat:Math.round(t.fat||0),src:'server'};
  const dayType=renderDiet.foodlog?.dayType||(renderDiet.foodlog?.isTrain===false?'rest':'training');
  const meals=planMeals(dayType);
  if(meals.length){const s={kcal:0,protein:0,carbs:0,fat:0};meals.forEach(m=>{const x=mealTotals(m);s.kcal+=x.kcal;s.protein+=x.protein;s.carbs+=x.carbs;s.fat+=x.fat;});
    return {kcal:kcal||Math.round(s.kcal),protein:Math.round(s.protein),carbs:Math.round(s.carbs),fat:Math.round(s.fat),src:'plan'};}
  const prof=(_dietSelf())?ME:(VIEW_USER_PROFILE||{});const wt=prof.start_weight||75,goal=prof.goal;
  const ppk=goal==='muscle'?2.0:goal==='fatloss'?2.2:1.8;
  const tP=kcal?Math.round(wt*ppk):0,tF=kcal?Math.round(kcal*0.25/9):0,tC=kcal?Math.max(0,Math.round((kcal-tP*4-tF*9)/4)):0;
  return {kcal,protein:tP,carbs:tC,fat:tF,src:'formula'};}
function macroLine(p,c,f){return `${fmtNum(Math.round(p||0))} g P · ${fmtNum(Math.round(c||0))} g C · ${fmtNum(Math.round(f||0))} g F`;}
// Einheit eines Lebensmittels: foods.unit (wenn vorhanden) -> Stück-Erkennung -> g
function foodUnit(name,f){const pm=pieceModeFor(name);
  if(pm&&pm.mode==='native')return 'Stück'; // „Vollei (Stück)" – Nährwerte sind bereits je Stück
  return (f&&f.unit)||'g';}
// Portion oder Gramm? POST /api/recipes/:id/log legt amount=1 im Sinne von „eine Portion“ ab (kein Gramm-Wert).
// Als Grammzahl gelesen würde „Menge ändern“ den Eintrag um Faktor 100 aufblasen – deshalb gilt eine Menge nur
// dann als skalierbar, wenn sie zu einem Lebensmittel aus FOODS gehört oder klar keine Portionsangabe ist.
// Speichert das Backend amount=NULL (sauberere Variante), greift derselbe Weg über entryAmount()===null.
function isPortionEntry(it){if(!it||it.details)return false;
  const a=parseFloat(it.amount);if(!(a>0))return false;
  if(pieceModeFor(it.food))return false; // „Baguette Brötchen (Stück)“/Banane: erkennbar am Namen, auch bevor FOODS geladen ist
  return a===1&&!FOODS.some(f=>f.name===it.food);}
// Skalierbare Menge (Gramm/Stück) eines Protokoll-Eintrags – null bei Portionen, ganzen Mahlzeiten, freien Einträgen
function entryAmount(it){if(!it||it.details||isPortionEntry(it))return null;
  const a=parseFloat(it.amount);return a>0?a:null;}
function amountText(it){if(!it)return '';
  if(isPortionEntry(it))return '1 Portion';
  const a=entryAmount(it);if(a==null)return '';
  const f=FOODS.find(x=>x.name===it.food);return fmtNum(a,0)+' '+foodUnit(it.food,f);}
// FOODS lädt core.js beim Start; läuft das noch, hier einmal nachziehen – die Portionserkennung braucht die Liste.
function _dietEnsureFoods(){if(FOODS.length||_dietEnsureFoods.busy)return;_dietEnsureFoods.busy=true;
  API.get('/foods').then(r=>{_dietEnsureFoods.busy=false;FOODS=r.data?.foods||[];
    if(FOODS.length&&document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();})
    .catch(()=>{_dietEnsureFoods.busy=false;});}
// Portions-Chips eines Lebensmittels – dieselbe Logik im Hinzufügen-Sheet (lfPick) und in „Menge ändern“
function portionChips(name,unit){unit=unit||foodUnit(name,FOODS.find(x=>x.name===name));
  if(unit==='Stück')return [1,2,3,4].map(v=>[v,v+' Stück']);
  const pm=pieceModeFor(name);
  if(pm&&pm.mode==='convert')return [[pm.g,'1 Stück'],[pm.g*2,'2 Stück'],[100,'100 g'],[200,'200 g']];
  return [50,100,150,200].map(v=>[v,v+' '+unit]);} // Einheit übernehmen: Milch/Öl zeigen „100 ml", nicht „100 g"
// Chip setzt ein Zahlenfeld (Menge ändern / Barcode) – ohne die Live-Vorschau von lfPick
function amtChip(inputId,v,btn){const i=document.getElementById(inputId);if(i)i.value=v;
  if(btn&&btn.parentNode)btn.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===btn));}
// nextPlanMeal(summary?) -> {mealId,label,slot,kcal,protein,logged,done,total,preview}|null – synchron aus dem Speicher.
// Bevorzugt summary.nextMeal vom Server (GET /api/foodlog bzw. /api/home), sonst erste nicht eingetragene Plan-Mahlzeit.
function nextPlanMeal(summary){
  // Der Plan-Cache gehoert immer genau einem Athleten. Wechselt ein Coach den Athleten und landet auf der
  // Startseite, ohne den Ernaehrungs-Tab zu oeffnen, wuerde sonst die Mahlzeit des VORIGEN Athleten angeboten
  // (und „Gegessen“ in dessen Protokoll schreiben). Darum hier hart auf den aktuellen Nutzer pruefen.
  const mine=renderDiet.user===VIEW_USER;
  const sum=mine?(summary||renderDiet.foodlog?.summary||null):null;
  const dayType=renderDiet.todayType||DIET;const meals=mine?planMeals(dayType):[];
  const L=mine?loggedMealIds():{ids:new Set(),labels:new Set()};
  const total=meals.length,done=meals.filter(m=>mealLogged(m,L)).length;
  const pack=(m,logged)=>{const t=mealTotals(m);return {mealId:m.id,label:m.label||('Mahlzeit '+m.meal_no),slot:mealSlotOf(m),kcal:Math.round(t.kcal),protein:Math.round(t.protein),logged:!!logged,done,total,preview:(m.items||[]).map(i=>i.food).join(', ')};};
  if(sum&&sum.nextMeal!==undefined&&sum.nextMeal!==null){const n=sum.nextMeal;const m=meals.find(x=>x.id===+n.mealId);
    if(m)return pack(m,false);
    // Plan noch nicht geladen (z.B. Start-Kachel): Server-Angabe nutzen. Ist der Plan geladen und die Mahlzeit
    // fehlt dort (Plan neu erstellt / wiederhergestellt), zeigt die Karte sonst auf eine gelöschte ID und
    // „Gegessen“ endet in 403 – dann unten lokal weiterrechnen.
    if(!total)return {mealId:n.mealId,label:n.label||'',slot:n.slot||'',kcal:Math.round(n.kcal||0),protein:Math.round(n.protein||0),logged:false,done,total,preview:''};}
  if(!total)return null;
  const open=meals.find(m=>!mealLogged(m,L));
  if(open)return pack(open,false);
  return pack(meals[meals.length-1],true); // alles eingetragen
}

// ===== HEUTE: RING, MAKRO-BALKEN, NÄCHSTE MAHLZEIT, PROTOKOLL =====
function macroRow(kc,p,c,f,target){return `<div class="macro-row">
    <div class="macro kcal"><div class="v">${fmtNum(Math.round(kc||0))}${target?`<em>/${fmtNum(target)}</em>`:''}</div><div class="k">kcal</div></div>
    <div class="macro"><div class="v">${fmtNum(Math.round(p||0))}<em>g</em></div><div class="k">Protein</div></div>
    <div class="macro"><div class="v">${fmtNum(Math.round(c||0))}<em>g</em></div><div class="k">Carbs</div></div>
    <div class="macro"><div class="v">${fmtNum(Math.round(f||0))}<em>g</em></div><div class="k">Fett</div></div></div>`;}
// Urteil „gegessen vs. Ziel" – EINE Quelle für Ernährung und Startseite: bevorzugt der Serverstatus aus
// GET /api/foodlog – src/logic.js dayNutrition –, sonst dieselben Schwellen lokal (>105 % drüber, ab 95 % im Ziel).
// Über dem Ziel ist amber und heißt „über dem Ziel" – wortgleich und farbgleich mit home.js homeFoodHTML(),
// unabhängig vom Ziel des Athleten (ein Überschuss war hier früher grün, auf der Startseite amber).
function kcalVerdict(consumed,target){const sum=renderDiet.foodlog?.summary||{};
  let st=null;
  if(sum.status&&Math.round(sum.target||0)===Math.round(target||0)&&Math.round(sum.consumed||0)===Math.round(consumed||0))st=sum.status;
  if(!st)st=!target?'ok':(consumed>target*1.05?'over':(consumed>=target*0.95?'onTarget':'under'));
  if(st==='over')return {status:st,text:'über dem Ziel',tone:'tone-amber',color:'var(--amber)'};
  if(st==='onTarget')return {status:st,text:'im Ziel ✓',tone:'tone-green',color:'var(--green)'};
  return {status:st,text:'',tone:'',color:'var(--red)'};}
// Großer Kalorien-Ring (ring()-Helfer): verbleibende kcal in der Mitte. Das Sub-Label bleibt kurz
// („kcal übrig"/„kcal drüber") – längere Texte laufen im 128er-Ring über den Strich; das Urteil steht
// stattdessen als Text neben den Zahlen im Kopf der Karte.
function calorieRing(consumed,target,size){size=size||128;
  const rem=target?Math.round(target-consumed):0;const pct=target?Math.min(1,consumed/target):0;
  return ring(pct,{size,stroke:11,color:kcalVerdict(consumed,target).color,
    label:fmtNum(target?Math.abs(rem):Math.round(consumed)),sub:target?(rem>=0?'kcal übrig':'kcal drüber'):'kcal'});}
// Makro-Balken mit Über-Ziel-Zustand (Protein drüber = grün, Carbs/Fett drüber = amber, '+124 g')
function macroBar(label,val,target,color){const v=Math.round(val||0),t=Math.round(target||0);
  const pct=t?Math.min(100,Math.round(v/t*100)):0;const over=t&&v>t;const good=over&&label==='Protein';
  return `<div class="mbar${over?' over':''}${good?' good':''}"><div class="mb-h"><span class="mb-l">${label}</span><span class="mb-v">${fmtNum(v)}${t?' / '+fmtNum(t):''} g${over?` <b>+${fmtNum(v-t)} g</b>`:''}</span></div>
    <div class="bar${good?' green':over?' amber':''}"><i style="width:${pct}%${(!over&&color)?';background:'+color:''}"></i></div></div>`;}
// „Laut Plan als Nächstes" – Karte für Heute und Plan (nur wenn ein Plan existiert)
function nextMealCard(){const n=nextPlanMeal();const self=_dietSelf();
  if(!n)return `<div class="rows mb-3"><div class="row tap" onclick="dietTab('plan')"><div class="r-ic">${icon('utensils')}</div><div class="rl">Noch kein Ernährungsplan<small>Automatisch aus ${self?'deinem':'dem'} Profil erstellen</small></div><div class="rr"></div></div></div>`;
  if(n.logged)return `<div class="card next-meal done mb-3"><div class="between"><div class="eyebrow tone-green">Laut Plan</div><span class="caption">${n.done} von ${n.total} eingetragen</span></div>
    <div class="h3 mt-1">Alle Mahlzeiten eingetragen</div><div class="meta">${self?'Stark – der Plan ist für heute komplett.':'Der Plan ist für heute komplett eingetragen.'}</div></div>`;
  const m=planMeals(renderDiet.todayType||DIET).find(x=>x.id===n.mealId);const kc=n.kcal;
  return `<div class="card next-meal mb-3" id="nextMealCard">
    <div class="between"><div class="eyebrow">Laut Plan als Nächstes</div>${n.total?`<span class="caption">${n.done} von ${n.total} eingetragen</span>`:''}</div>
    <div class="h3 mt-1">${esc2(n.label)}</div>
    <div class="meta">${fmtNum(kc)} kcal · ${fmtNum(n.protein)} g P${n.preview?' · '+esc2(n.preview):''}</div>
    ${self?`<div class="nm-acts">
      <button class="btn block" onclick="logFromMeal(${n.mealId})">${icon('check',18)} Gegessen</button>
      ${m?`<button class="btn sm sec" onclick="swapMeal(${m.id},${Math.round(kc)},'${esc(m.label||'')}')">${icon('refresh',16)} Tauschen</button>`:''}
    </div>`:''}</div>`;}
// HEUTE: Ring + Makro-Balken + Nächste Mahlzeit + Hinzufügen + Protokoll nach Slot gruppiert
function drawTrack(){_dietMark('track');_dietEnsureFoods();const fl=renderDiet.foodlog||{items:[],summary:{}};const sum=fl.summary||{};
  const items=fl.items||[];const el=document.getElementById('dietBody');if(!el)return;
  const consumed=Math.round(sum.consumed||0);const T=dietTargets();const target=T.kcal||0;const mac=sum.macros||{};
  const isTrain=fl.isTrain!==false;const V=kcalVerdict(consumed,target);
  let h=`<div class="card diet-hero">
    <div class="dh-head"><span class="chip day ${isTrain?'train':'rest'}" id="dietDayBadge">${isTrain?'Trainingstag':'Ruhetag'}${target?' · '+fmtNum(target)+' kcal':''}</span><span class="meta"><span>${fmtNum(consumed)}${target?' / '+fmtNum(target):''} kcal</span> ${V.text?`<span class="${V.tone}">· ${esc2(V.text)}</span>`:'<span>gegessen</span>'}</span></div>
    <div class="dh-main"><div class="fixed">${calorieRing(consumed,target)}</div>
      <div class="dh-bars">${macroBar('Protein',mac.protein||0,T.protein,'var(--red)')}${macroBar('Carbs',mac.carbs||0,T.carbs,'var(--amber)')}${macroBar('Fett',mac.fat||0,T.fat,'var(--blue)')}</div></div>
  </div>`;
  h+=nextMealCard();
  // Essen trägt nur der Athlet selbst ein – im Coach-Blick statt der Schaltfläche derselbe Hinweis wie beim Check-in
  h+=_dietSelf()?`<button class="btn block mb-4" onclick="openLogFood({focus:true})">${icon('plus',18)} Essen hinzufügen</button>`
    :`<div class="note status mb-4">${DIET_RO_TX}</div>`;
  if(!items.length){h+=emptyState({icon:'utensils',title:'Noch nichts getrackt',text:_dietSelf()?'Trag dein Essen ein oder übernimm eine Mahlzeit aus dem Plan.':'Dein Athlet hat für heute noch nichts eingetragen.'});}
  else{
    const groups={};items.forEach(it=>{const k=slotNorm(it.meal_slot);(groups[k]=groups[k]||[]).push(it);});
    const keys=Object.keys(groups).sort((a,b)=>{const ia=SLOT_ORDER.indexOf(a),ib=SLOT_ORDER.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);});
    keys.forEach(k=>{const g=groups[k];const kc=g.reduce((a,it)=>a+(it.kcal||0),0);
      h+=`<div class="section-label"><span>${esc2(k)}</span><span class="sl-r">${fmtNum(Math.round(kc))} kcal</span></div><div class="rows mb-3">`;
      g.forEach(it=>{const isMeal=!!it.details;const amt=isMeal?'ganze Mahlzeit':amountText(it);
        h+=`<div class="row tap" onclick="openFoodRow(${it.id})"><div class="rl">${esc2(it.food)}<small>${amt?amt+' · ':''}${macroLine(it.protein,it.carbs,it.fat)}</small></div><div class="rr">${fmtNum(Math.round(it.kcal||0))} kcal</div></div>`;});
      h+='</div>';});
  }
  el.innerHTML=h;}
// Zeile antippen: Aufschlüsselung + Menge ändern · Duplizieren · Entfernen
function openFoodRow(id){const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);if(!it)return;
  let parts=[];if(it.details){try{parts=JSON.parse(it.details);}catch(e){parts=[];}}
  let h=macroRow(it.kcal,it.protein,it.carbs,it.fat);
  const amtTx=it.details?'ganze Mahlzeit':amountText(it);
  h+=`<div class="meta mb-3">${esc2(slotNorm(it.meal_slot))}${amtTx?' · '+esc2(amtTx):''}</div>`;
  if(parts.length){h+=`<div class="section-label">Zutaten</div><div class="rows mb-3">`+parts.map(p=>`<div class="row"><div class="rl">${esc2(p.food)}<small>${p.amount?fmtNum(p.amount)+' '+foodUnit(p.food)+' · ':''}${macroLine(p.protein,p.carbs,p.fat)}</small></div><div class="rr">${fmtNum(Math.round(p.kcal||0))} kcal</div></div>`).join('')+`</div>`;}
  // Ändern/Duplizieren/Entfernen schreiben ins Protokoll – im Coach-Blick bleibt nur die Aufschlüsselung
  h+=_dietSelf()?`<div class="rows">
    ${entryAmount(it)!=null?`<div class="row tap" onclick="openFoodAmount(${it.id})"><div class="r-ic">${icon('pencil')}</div><div class="rl">Menge ändern</div><div class="rr"></div></div>`:''}
    <div class="row tap" onclick="dupFood(${it.id})"><div class="r-ic">${icon('plus')}</div><div class="rl">Duplizieren<small>Noch einmal eintragen</small></div><div class="rr"></div></div>
    <div class="row tap" onclick="delFood(${it.id})"><div class="r-ic tone-red">${icon('trash')}</div><div class="rl tone-red">Entfernen</div><div class="rr"></div></div>
  </div>`:`<div class="note status">${DIET_RO_TX}</div>`;
  openSheet(it.food,h);}
function showMealDetails(id){openFoodRow(id);} // Alias (alter Name)
function openFoodAmount(id){if(_dietRO())return;const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);if(!it)return;
  const base=entryAmount(it);if(base==null)return toast('Diese Menge lässt sich nicht ändern');
  const f=FOODS.find(x=>x.name===it.food);const u=foodUnit(it.food,f);
  const chips=portionChips(it.food,u).map(([v,l])=>`<button class="chip${base===v?' on':''}" onclick="amtChip('fa_amt',${v},this)">${esc2(l)}</button>`).join('');
  openSheet('Menge ändern',`<div class="body mb-3">${esc2(it.food)}</div>
    <div class="field"><label>Menge (${u})</label><input id="fa_amt" type="number" inputmode="decimal" value="${base}"></div>
    <div class="chip-row wrap mb-4">${chips}</div>
    <button class="btn block" onclick="changeFoodAmount(${it.id})">Speichern</button>`);
  setTimeout(()=>{const i=document.getElementById('fa_amt');if(i){i.focus();i.select();}},60);}
// Menge ändern = neue Zeile mit skalierten Werten anlegen, alte löschen (kein PUT im Backend nötig)
async function changeFoodAmount(id){if(_dietRO())return;const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);if(!it)return;
  const base=entryAmount(it);if(base==null)return toast('Diese Menge lässt sich nicht ändern');
  const a=parseFloat(val('fa_amt'))||0;if(a<=0)return showFieldErr(null,'Bitte eine Menge eingeben','fa_amt');
  const k=a/base;
  const body={user_id:VIEW_USER,date:it.date||today(),meal_slot:it.meal_slot,food:it.food,amount:a,kcal:Math.round((it.kcal||0)*k),fat:r1((it.fat||0)*k),carbs:r1((it.carbs||0)*k),protein:r1((it.protein||0)*k)};
  const r=await API.post('/foodlog',body);if(r.status!==200)return toast(r.data?.error||'Fehler – nicht gespeichert');
  await API.del('/foodlog/'+id);closeAllSheets();await refreshFoodlog();toast('Menge geändert ✓');}
async function dupFood(id){if(_dietRO())return;const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);if(!it)return;
  // force:true – dieselbe Plan-Mahlzeit darf bewusst ein zweites Mal eingetragen werden (zweite Portion)
  let r;if(it.meal_id)r=await API.post('/foodlog/frommeal/'+it.meal_id,{date:today(),meal_slot:slotNorm(it.meal_slot),force:true});
  else r=await API.post('/foodlog',{user_id:VIEW_USER,date:today(),meal_slot:it.meal_slot,food:it.food,amount:it.amount,kcal:it.kcal,fat:it.fat,carbs:it.carbs,protein:it.protein});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();await refreshFoodlog();toast(it.food+' noch einmal eingetragen ✓');}
async function delFood(id){if(_dietRO())return;const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);
  const r=await API.del('/foodlog/'+id);if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();await refreshFoodlog();
  if(it)toast(`„${it.food}“ entfernt`,{label:'Rückgängig',fn:()=>undoDelFood(it)});else toast('Entfernt');}
async function undoDelFood(it){let r;
  if(it.meal_id)r=await API.post('/foodlog/frommeal/'+it.meal_id,{date:it.date||today(),meal_slot:slotNorm(it.meal_slot),force:true});
  else r=await API.post('/foodlog',{user_id:VIEW_USER,date:it.date||today(),meal_slot:it.meal_slot,food:it.food,amount:it.amount,kcal:it.kcal,fat:it.fat,carbs:it.carbs,protein:it.protein});
  if(r.status!==200)return toast('Konnte nicht wiederherstellen');
  await refreshFoodlog();toast('Wiederhergestellt ✓');}

// ===== ESSEN HINZUFÜGEN (Liste / Scan / Manuell / Neu) – Sheet bleibt für Mehrfach-Einträge offen =====
let LF_SESSION={count:0,kcal:0};
// openLogFood({focus:true}) – öffnet das Sheet (hoch), Liste mit fokussierter Suche
function openLogFood(o){if(_dietRO())return;o=o||{};LF_SESSION={count:0,kcal:0};
  openSheet('Essen hinzufügen',`
    <div class="seg" id="lfSeg">
      <button id="lf_t1" class="on" onclick="lfTab(1)">Liste</button>
      <button id="lf_t2" onclick="lfTab(2)">Scan</button>
      <button id="lf_t3" onclick="lfTab(3)">Manuell</button>
      <button id="lf_t4" onclick="lfTab(4)">Neu</button>
    </div>
    <div id="lfBody"></div>
    <div class="lf-done" id="lfDone" hidden><span class="fill" id="lfDoneTx"></span><button class="btn sm" onclick="lfDone()">Fertig</button></div>`,{size:'tall'});
  lfTab(1,{focus:o.focus!==false});}
function lfUpdateDone(){const d=document.getElementById('lfDone');if(!d)return;d.hidden=!LF_SESSION.count;
  const t=document.getElementById('lfDoneTx');if(t)t.textContent=`${pl(LF_SESSION.count,'Eintrag','Einträge')} · ${fmtNum(Math.round(LF_SESSION.kcal))} kcal`;}
function lfDone(){const n=LF_SESSION.count,k=LF_SESSION.kcal;closeModal();if(n)toast(`${pl(n,'Eintrag','Einträge')} · ${fmtNum(Math.round(k))} kcal eingetragen ✓`);}
function lfTab(t,o){o=o||{};if(typeof stopBarcodeCam==='function')stopBarcodeCam(); // Kamera stoppen, wenn man den Scan-Tab verlässt
  [1,2,3,4].forEach(i=>{const el=document.getElementById('lf_t'+i);if(el)el.classList.toggle('on',i===t);});
  const b=document.getElementById('lfBody');if(!b)return;
  if(t===1){if(!FOODS.length){b.innerHTML=skeleton(3,'sm');API.get('/foods').then(r=>{FOODS=r.data?.foods||[];if(document.getElementById('lfBody'))lfTab(1,o);});return;}
    LF_SELECTED=null;
    b.innerHTML=`
      <div class="field lf-search"><label>Lebensmittel suchen</label><div class="lf-searchwrap">${icon('search',18)}<input id="lf_search" type="search" placeholder="z.B. Hähnchen, Reis, Quark…" oninput="lfFilter()" autocomplete="off" enterkeyhint="search"></div></div>
      <div id="lf_list"></div>
      <div id="lf_chosen"></div>`;
    lfFilter();loadRecentFoods().then(()=>{if(document.getElementById('lf_list')&&!(val('lf_search')))lfFilter();});
    if(o.focus)setTimeout(()=>{const s=document.getElementById('lf_search');if(s)try{s.focus({preventScroll:true});}catch(e){s.focus();}},50);}
  else if(t===2){b.innerHTML=`
      <div class="note mb-3">Scanne den Strichcode – die Nährwerte werden automatisch geladen.</div>
      <div id="bc_cam" class="bc-cam"><video id="bc_video" playsinline muted autoplay></video><div class="bc-line"></div></div>
      <div id="bc_status" class="bc-status">Kamera startet… halte den Strichcode ins Bild.</div>
      <div class="field"><label>oder Nummer (EAN) eintippen</label><input id="bc_code" type="text" inputmode="numeric" placeholder="z.B. 4337185272363"></div>
      <button class="btn block" onclick="lookupBarcode()">Produkt suchen</button>`;
    startBarcodeCam();}
  else if(t===3){b.innerHTML=`<div class="note mb-3">Bezeichnung, Kalorien und optional die Makros – z.B. von der Verpackung oder aus dem Restaurant.</div>
      <div id="qfForm">
      <div class="field"><label>Bezeichnung</label><input id="qf_name" placeholder="z.B. Restaurant-Pizza"></div>
      <div class="field"><label>Kalorien (kcal)</label><input id="qf_kcal" type="number" inputmode="numeric" placeholder="z.B. 650"></div>
      <div class="grid-3">
        <div class="field"><label>Protein</label><input id="qf_p" type="number" inputmode="numeric" placeholder="g"></div>
        <div class="field"><label>Carbs</label><input id="qf_c" type="number" inputmode="numeric" placeholder="g"></div>
        <div class="field"><label>Fett</label><input id="qf_f" type="number" inputmode="numeric" placeholder="g"></div>
      </div>${slotSelect('lf_slot')}
      <button class="btn block" onclick="confirmQuickFood()">Hinzufügen</button></div>`;
    if(o.focus!==false)setTimeout(()=>document.getElementById('qf_name')?.focus(),50);}
  else{b.innerHTML=`<div class="note mb-3">Eigenes Lebensmittel anlegen – es steht dir danach in der Liste zur Verfügung. Werte pro 100 g.</div>
      <div id="nfForm">
      <div class="field"><label>Name</label><input id="nf_name" placeholder="z.B. Mein Proteinriegel"></div>
      <div class="grid-3">
        <div class="field"><label>Protein /100 g</label><input id="nf_p" type="number" inputmode="decimal" placeholder="g"></div>
        <div class="field"><label>Carbs /100 g</label><input id="nf_c" type="number" inputmode="decimal" placeholder="g"></div>
        <div class="field"><label>Fett /100 g</label><input id="nf_f" type="number" inputmode="decimal" placeholder="g"></div>
      </div>
      <button class="btn block" onclick="confirmNewFood()">Speichern und auswählen</button></div>`;
    if(o.focus!==false)setTimeout(()=>document.getElementById('nf_name')?.focus(),50);}
  lfUpdateDone();}
let LF_SELECTED=null, LF_PIECE=null;
// Lebensmittel, die sinnvoller in STÜCK eingegeben werden.
//  'native'  = Nährwerte sind bereits pro Stück (z.B. "Eier (Stück)") -> Menge = Anzahl direkt.
//  'convert' = pro-Gramm-Food, das wir über g/Stück in Stück umrechnen (z.B. Banane = 120 g).
const PIECE_GRAMS={'banane':120,'apfel':180,'banana':120,'apple':180};
function pieceModeFor(name){const n=(name||'').toLowerCase().trim();
  if(/\((stück|piece)\)/.test(n))return {mode:'native'};
  if(PIECE_GRAMS[n]!=null)return {mode:'convert',g:PIECE_GRAMS[n]};
  return null;}
function isPieceUnitName(name){return !!pieceModeFor(name);}
function kcal100(f){return Math.round((f.fat*9+f.carbs*4+f.protein*4)*100);}
// Bezugsgröße einer Listenzeile: „85 kcal / Stück" bzw. „353 kcal / 100 g"
function kcalUnitTxt(f){const u=foodUnit(f.name,f);
  return u==='Stück'?`${fmtNum(Math.round(kcal100(f)/100))} kcal / Stück`:`${fmtNum(kcal100(f))} kcal / 100 ${u}`;}
// „Zuletzt": Lebensmittel der letzten 7 Tage (mit letzter Menge) – clientseitig aus dem Protokoll, 5 Min. gecacht
let LF_RECENT=null;
function _lfRecentKey(){return 'be_lf_recent_'+VIEW_USER;}
function _lfRecentLoad(){if(LF_RECENT&&LF_RECENT.user===VIEW_USER)return LF_RECENT;
  try{const c=JSON.parse(localStorage.getItem(_lfRecentKey())||'null');
    if(c&&Array.isArray(c.list))LF_RECENT={user:VIEW_USER,day:c.day,ts:c.ts||0,list:c.list};}catch(e){}
  return (LF_RECENT&&LF_RECENT.user===VIEW_USER)?LF_RECENT:null;}
function _lfRecentSave(){try{if(LF_RECENT)localStorage.setItem(_lfRecentKey(),JSON.stringify({day:LF_RECENT.day,ts:LF_RECENT.ts,list:LF_RECENT.list}));}catch(e){}}
// Neuer Eintrag: Liste lokal fortschreiben, statt den Sammelabruf zu erzwingen
function _lfRecentTouch(name,amount,slot){if(!name)return;const c=_lfRecentLoad();
  const fresh=!!(c&&c.day===today());const list=fresh?c.list.slice():[];
  const k=String(name).toLowerCase();const i=list.findIndex(x=>String(x.name||'').toLowerCase()===k);
  const e=i>=0?list.splice(i,1)[0]:{name,amount:null,slot:null,n:0};
  e.name=name;if(amount!=null)e.amount=amount;if(slot)e.slot=slot;e.n=(e.n||0)+1;
  list.unshift(e);
  LF_RECENT={user:VIEW_USER,day:today(),ts:fresh?c.ts:0,list:list.slice(0,40)};_lfRecentSave();}
// Sammelabruf der letzten 7 Tage in EINEM Roundtrip (GET /foodlog/:id/recent?days=7);
// zusätzlich pro Nutzer und Kalendertag gecacht und zwischendurch nur lokal fortgeschrieben.
async function loadRecentFoods(){const c=_lfRecentLoad();
  if(c&&c.day===today()&&Date.now()-(c.ts||0)<6*3600000)return c.list;
  const r=await API.get('/foodlog/'+VIEW_USER+'/recent?days=7').catch(()=>null);
  if(!r||r.status!==200)return (c&&c.list)||[];
  const seen=new Map();
  (r.data?.items||[]).forEach(it=>{if(it.details||!it.food)return;const k=it.food.toLowerCase();
    if(!seen.has(k))seen.set(k,{name:it.food,amount:entryAmount(it),slot:it.meal_slot,n:0});seen.get(k).n++;});
  LF_RECENT={user:VIEW_USER,day:today(),ts:Date.now(),list:[...seen.values()]};_lfRecentSave();return LF_RECENT.list;}
function _lfRow(f,i,sub){return `<div class="row tap" onclick="lfPick(${i}${sub&&sub.amount?',{amount:'+(+sub.amount||0)+'}':''})"><div class="rl">${esc2(f.name)}${f.owner_id?` <span class="pill neutral">eigenes</span>`:''}<small>${sub&&sub.txt?esc2(sub.txt)+' · ':''}${kcalUnitTxt(f)}</small></div><div class="rr"></div></div>`;}
// Liste: ohne Suchtext „Zuletzt / Häufig" zuerst, dann alle (dedupliziert, eigene zuerst); mit Suchtext gefiltert
function lfFilter(){const q=(val('lf_search')||'').trim().toLowerCase();
  const el=document.getElementById('lf_list');if(!el)return;
  const seenN=new Set();const all=[];FOODS.forEach((f,i)=>{const k=f.name.toLowerCase();if(seenN.has(k))return;seenN.add(k);all.push({f,i});});
  all.sort((a,b)=>(b.f.owner_id?1:0)-(a.f.owner_id?1:0)||(b.f.use_count||0)-(a.f.use_count||0)||a.f.name.localeCompare(b.f.name,'de'));
  let h='';
  if(!q){const rec=(LF_RECENT&&LF_RECENT.user===VIEW_USER)?LF_RECENT.list:[];const shown=new Set();
    const rows=[];
    rec.slice(0,6).forEach(r=>{const k=String(r.name||'').toLowerCase();const idx=FOODS.findIndex(f=>f.name.toLowerCase()===k);
      const f=FOODS[idx];if(!f||shown.has(k))return;shown.add(k);
      rows.push(_lfRow(f,idx,{amount:r.amount,txt:r.amount?'zuletzt '+fmtNum(r.amount)+' '+foodUnit(f.name,f):'zuletzt'}));});
    all.filter(x=>(x.f.use_count||0)>0).slice(0,8).forEach(x=>{if(rows.length>=8||shown.has(x.f.name.toLowerCase()))return;shown.add(x.f.name.toLowerCase());rows.push(_lfRow(x.f,x.i,{txt:'häufig'}));});
    if(rows.length)h+=`<div class="section-label tight"><span>Zuletzt / Häufig</span></div><div class="rows mb-3">${rows.join('')}</div>`;
    h+=`<div class="section-label tight"><span>Alle Lebensmittel</span><span class="sl-r">${all.length}</span></div><div class="rows">`+all.slice(0,40).map(x=>_lfRow(x.f,x.i)).join('')+'</div>';
    if(all.length>40)h+=`<div class="caption center mt-2">Tippe oben, um in allen ${all.length} zu suchen.</div>`;}
  else{const matches=all.filter(x=>x.f.name.toLowerCase().includes(q)).slice(0,60);
    if(!matches.length){h=emptyState({icon:'search',title:'Nichts gefunden',text:'Über „Manuell“ trägst du freie Kalorien ein, unter „Neu“ speicherst du ein eigenes Lebensmittel.',btn:{label:'Neu anlegen',onclick:'lfTab(4)'}});}
    else h='<div class="rows">'+matches.map(x=>_lfRow(x.f,x.i)).join('')+'</div>';}
  el.innerHTML=h;}
// Lebensmittel auswählen -> Menge (Portions-Chips) + Slot + Makro-Vorschau + Hinzufügen
function lfPick(i,o){o=o||{};LF_SELECTED=i;const f=FOODS[i];if(!f)return;
  const pm=pieceModeFor(f.name);LF_PIECE=pm;const unit=foodUnit(f.name,f);
  const isPiece=unit==='Stück';
  const def=o.amount||(isPiece?1:100);
  const chips=portionChips(f.name,unit);
  document.getElementById('lf_chosen').innerHTML=`
    <div class="card lf-chosen mb-3">
      <div class="between mb-2"><div class="h3 fill truncate">${esc2(f.name)}</div><button class="btn sm sec" onclick="lfClear()">ändern</button></div>
      <div class="field"><label>Menge (${unit})</label><input id="lf_amt" type="number" inputmode="decimal" value="${def}" oninput="lfCalc()"></div>
      <div class="chip-row wrap mb-3" id="lf_portions">${chips.map(([v,l])=>`<button class="chip${+def===v?' on':''}" data-v="${v}" onclick="lfSetAmt(${v},this)">${l}</button>`).join('')}</div>
      ${slotSelect('lf_slot',o.slot)}<div class="macro-row" id="lf_out"></div>
    </div>
    <button class="btn block" onclick="confirmLogFood()">Hinzufügen</button>`;
  lfCalc();
  // Liste & Suche ausblenden, damit der Fokus auf der Auswahl liegt
  const ls=document.getElementById('lf_list');if(ls)ls.hidden=true;
  const sf=document.getElementById('lf_search');if(sf){sf.closest('.field').hidden=true;try{sf.blur();}catch(e){}}
  const sh=document.getElementById('sheet');if(sh)sh.scrollTop=0;}
function lfSetAmt(v,btn){const i=document.getElementById('lf_amt');if(i)i.value=v;
  if(btn)btn.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===btn));lfCalc();}
function lfClear(){LF_SELECTED=null;const ch=document.getElementById('lf_chosen');if(ch)ch.innerHTML='';
  const ls=document.getElementById('lf_list');if(ls)ls.hidden=false;
  const sf=document.getElementById('lf_search');if(sf){sf.closest('.field').hidden=false;sf.value='';lfFilter();try{sf.focus({preventScroll:true});}catch(e){}}}
function lfCalc(){if(LF_SELECTED==null)return;const f=FOODS[LF_SELECTED];if(!f)return;const a=parseFloat(val('lf_amt'))||0;
  const fat=f.fat*a,carb=f.carbs*a,prot=f.protein*a,kc=fat*9+carb*4+prot*4;
  const p=document.getElementById('lf_portions');if(p)p.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',+c.dataset.v===a));
  const out=document.getElementById('lf_out');if(out)out.innerHTML=`<div class="macro kcal"><div class="v">${fmtNum(Math.round(kc))}</div><div class="k">kcal</div></div><div class="macro"><div class="v">${fmtNum(prot,1)}<em>g</em></div><div class="k">Protein</div></div><div class="macro"><div class="v">${fmtNum(carb,1)}<em>g</em></div><div class="k">Carbs</div></div><div class="macro"><div class="v">${fmtNum(fat,1)}<em>g</em></div><div class="k">Fett</div></div>`;}
// Nach dem Eintragen: Sheet bleibt offen, Zähler oben, zurück zur Liste
async function _lfAfterAdd(kc,name,o){o=o||{};LF_SESSION.count++;LF_SESSION.kcal+=kc||0;lfUpdateDone();
  if(name)_lfRecentTouch(name,o.amount,o.slot); // „Zuletzt“ lokal fortschreiben (kein neuer 7-Tage-Abruf)
  toast((name?name+' ':'')+'eingetragen ✓');
  await refreshFoodlog();}
async function confirmLogFood(){if(LF_SELECTED==null)return toast('Bitte ein Lebensmittel wählen');
  const f=FOODS[LF_SELECTED];const a=parseFloat(val('lf_amt'))||0;if(a<=0)return showFieldErr(null,'Bitte eine Menge eingeben','lf_amt');
  const fat=f.fat*a,carb=f.carbs*a,prot=f.protein*a,kc=fat*9+carb*4+prot*4;const slot=val('lf_slot');slotRemember(slot);
  const r=await API.post('/foodlog',{user_id:VIEW_USER,date:today(),meal_slot:slot,food:f.name,amount:a,kcal:kc,fat,carbs:carb,protein:prot});
  if(r.status!==200)return toast(r.data?.error||'Fehler – nicht gespeichert');
  f.use_count=(f.use_count||0)+1;
  if(document.getElementById('lf_chosen')){lfClear();}
  await _lfAfterAdd(kc,f.name,{amount:a,slot});}
async function confirmQuickFood(){const name=val('qf_name')||'Schnell-Eintrag';const kc=num('qf_kcal');
  if(kc==null)return showFieldErr('qfForm','Bitte Kalorien eingeben','qf_kcal');
  const slot=val('lf_slot');slotRemember(slot);
  // amount bleibt leer: ein freier Eintrag („Restaurant-Pizza") hat keine sinnvolle Grammzahl
  const r=await API.post('/foodlog',{user_id:VIEW_USER,date:today(),meal_slot:slot,food:name,amount:null,kcal:kc,fat:num('qf_f')||0,carbs:num('qf_c')||0,protein:num('qf_p')||0});
  if(r.status!==200)return toast(r.data?.error||'Fehler – nicht gespeichert');
  if(document.getElementById('lfBody'))lfTab(3,{focus:false});
  await _lfAfterAdd(kc,name);}
async function confirmNewFood(){const name=val('nf_name');if(!name)return showFieldErr('nfForm','Bitte einen Namen eingeben','nf_name');
  const r=await API.post('/foods',{name,protein:num('nf_p')||0,carbs:num('nf_c')||0,fat:num('nf_f')||0,per100:true});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  const fr=await API.get('/foods');FOODS=fr.data?.foods||[]; // neu laden, damit das neue gleich auswählbar ist
  toast('Gespeichert ✓');lfTab(1,{focus:false});
  setTimeout(()=>{const idx=FOODS.findIndex(f=>f.name===name);if(idx>=0)lfPick(idx);},60);}
// Plan-Mahlzeit als gegessen eintragen (auch von Home aus aufrufbar). Gibt true/false zurück.
async function logFromMeal(mealId){if(_dietRO())return false;const m=(renderDiet.meals||[]).find(x=>x.id===+mealId);
  const r=await API.post('/foodlog/frommeal/'+mealId,{date:today(),meal_slot:m?mealSlotOf(m):undefined});
  if(r.status===409){await refreshFoodlog();  // war schon eingetragen: Ansicht angleichen, zweite Portion anbieten
    toast('Schon eingetragen – heute bereits im Protokoll',{label:'Nochmal',fn:async()=>{
      const r2=await API.post('/foodlog/frommeal/'+mealId,{date:today(),meal_slot:m?mealSlotOf(m):undefined,force:true});
      if(r2.status!==200)return toast(r2.data?.error||'Fehler');
      await refreshFoodlog();toast('Zweite Portion eingetragen ✓');}});
    return false;}
  if(r.status!==200){toast(r.data?.error||'Fehler');return false;}
  const fl=await refreshFoodlog();
  const label=r.data?.label||m?.label||'';
  const row=(fl?.items||[]).slice().reverse().find(it=>(it.meal_id&&+it.meal_id===+mealId)||(it.details&&it.food===label));
  toast((label||'Mahlzeit')+' eingetragen ✓',row?{label:'Rückgängig',fn:async()=>{const dr=await API.del('/foodlog/'+row.id);await refreshFoodlog();
    toast(dr.status===200?'Zurückgenommen':'Eintrag ist nicht mehr da');}}:undefined);
  return true;}

// ===== PLAN: MAHLZEIT TAUSCHEN =====
// Rezepte derselben Kategorie, sortiert nach gewichteter kcal+Protein-Nähe; beide Differenzen sichtbar
async function swapMeal(mealId,mealKcal,mealLabel){
  openSheet('Mahlzeit tauschen','<div class="spinner"></div>',{size:'tall'});
  const m=(renderDiet.meals||[]).find(x=>x.id===+mealId);const mt=m?mealTotals(m):{kcal:mealKcal||0,protein:0};
  const mealP=Math.round(mt.protein||0);mealKcal=Math.round(mealKcal||mt.kcal||0);
  const slot=mealSlotOf(m||{label:mealLabel},null);
  const cat=['Frühstück','Mittag','Abend','Snack'].includes(slot)?slot:(slot==='Pre-Workout'||slot==='Post-Workout')?'Snack':null;
  const r=await API.get('/recipes'+(cat?'?meal='+encodeURIComponent(cat):''));
  let recipes=r.data?.recipes||[];
  const dt=(_dietSelf()?ME.diet_type:VIEW_USER_PROFILE?.diet_type)||'all';
  if(dt==='vegan')recipes=recipes.filter(rc=>rc.diet==='vegan');
  else if(dt==='vegetarian')recipes=recipes.filter(rc=>rc.diet==='veg'||rc.diet==='vegan');
  const score=rc=>Math.abs((rc.kcal||0)-mealKcal)/100+Math.abs((rc.protein||0)-mealP)/10; // 100 kcal ≈ 10 g Protein
  recipes=[...recipes].sort((a,b)=>score(a)-score(b)).slice(0,20);
  if(!recipes.length){openSheet('Mahlzeit tauschen',emptyState({icon:'utensils',title:'Keine passenden Rezepte',text:(cat?cat+'-Rezepte':'Rezepte')+(dt!=='all'?' für deine Ernährungsweise':'')+' fehlen noch.',btn:{label:'Eigenes Rezept anlegen',onclick:'openNewRecipe()'}}),{size:'tall'});return;}
  const sgn=v=>v>0?'+'+fmtNum(v):v<0?'−'+fmtNum(-v):'±0';
  // `cat` ist nur die Rezept-Kategorie für die Abfrage (Pre-/Post-Workout -> „Snack") – im Text steht die
  // Mahlzeit selbst, ohne ihren Zusatz in Klammern („Pre-Workout (60–90 Min. …)" -> „Pre-Workout").
  const mealName=String((m&&m.label)||mealLabel||slot||'').replace(/\s*\([^)]*\)\s*$/,'').trim()||'diese Mahlzeit';
  let h=`<div class="note status mb-3">Wähle ein Rezept für ${esc2(mealName)} (≈${fmtNum(mealKcal)} kcal · ${fmtNum(mealP)} g P). Sortiert nach Ähnlichkeit.</div><div class="rows">`;
  h+=recipes.map(rc=>{const dk=Math.round((rc.kcal||0)-mealKcal),dp=Math.round((rc.protein||0)-mealP);const dpill=rc.diet==='vegan'?' <span class="pill neutral">🌱</span>':rc.diet==='veg'?' <span class="pill neutral">🥕</span>':'';
    return `<div class="row tap" onclick="doSwapMeal(${mealId},${rc.id})"><div class="rl">${esc2(rc.name)}${dpill}<small>${macroLine(rc.protein,rc.carbs,rc.fat)}</small></div><div class="rr wrap"><span class="swap-diff"><b>${fmtNum(Math.round(rc.kcal))} kcal</b><span class="caption ${Math.abs(dk)<=60?'':'tone-amber'}">${sgn(dk)} kcal · ${sgn(dp)} g P</span></span></div></div>`;}).join('')+`</div>`;
  openSheet('Mahlzeit tauschen',h,{size:'tall'});}
async function doSwapMeal(mealId,recipeId){
  const r=await API.post('/meals/'+mealId+'/swap',{recipe_id:recipeId});
  if(r.status===200){closeAllSheets();await refreshMeals(false);if(renderDiet.tab==='track')drawTrack();else drawDiet();
    const d=r.data||{};const sgn=v=>v>0?'+'+fmtNum(Math.round(v)):v<0?'−'+fmtNum(Math.round(-v)):'±0';
    toast('Mahlzeit getauscht ✓'+(d.kcalDiff!=null?' · '+sgn(d.kcalDiff)+' kcal · '+sgn(d.proteinDiff||0)+' g P':''));}
  else toast(r.data?.error||'Fehler');}
async function restoreMeal(mealId){const r=await API.post('/meals/'+mealId+'/restore',{});
  if(r.status===200){await refreshMeals(false);drawDiet();toast('Original wiederhergestellt ✓');}
  else toast(r.status===404?'Wiederherstellen ist auf diesem Server noch nicht verfügbar':(r.data?.error||'Fehler'));}

// ===== PLAN: MAHLZEITEN-KARTEN =====
function setDiet(t){DIET=t;drawDiet();}
function dietTargetKcal(){const prof=(_dietSelf()?ME:(VIEW_USER_PROFILE||ME))||{};
  const t=DIET==='training'?(prof.kcal_target_train||0):(prof.kcal_target_rest||0);
  if(t)return t;
  // kein Profilziel gesetzt: für den heutigen Tagtyp das Serverziel aus dem Protokoll nehmen (eine Quelle)
  const todayType=renderDiet.foodlog?.dayType||renderDiet.todayType;
  return (DIET===todayType)?(renderDiet.foodlog?.summary?.targets?.kcal||renderDiet.foodlog?.summary?.target||0):0;}
let OPEN_MEALS=new Set();
function toggleMeal(id){const el=document.getElementById('meal-'+id);if(!el)return;const on=el.classList.toggle('open');
  if(on)OPEN_MEALS.add(id);else OPEN_MEALS.delete(id);}
function drawDiet(){_dietMark('plan');const allMeals=renderDiet.meals||[];const meals=planMeals(DIET);
  const el=document.getElementById('dietBody');if(!el)return;
  const target=dietTargetKcal();
  const isToday=DIET===(renderDiet.todayType||DIET);
  if(!allMeals.length){
    el.innerHTML=emptyState({icon:'utensils',title:'Noch kein Ernährungsplan',text:'Aus deinem Profil (Gewicht, Größe, Ziel) entsteht automatisch ein Plan mit konkreten Mahlzeiten für Trainings- und Ruhetage.',btn:{label:'Plan automatisch erstellen',onclick:'genMealPlan()'}})+
      `<button class="btn sec mt-2" onclick="openDislikes()">Erst Lebensmittel ausschließen</button>`;return;}
  const tot={kcal:0,protein:0,carbs:0,fat:0};meals.forEach(m=>{const t=mealTotals(m);tot.kcal+=t.kcal;tot.protein+=t.protein;tot.carbs+=t.carbs;tot.fat+=t.fat;});
  let h=`<div class="diet-seg-row"><div class="seg"><button class="${DIET==='training'?'on':''}" onclick="setDiet('training')">Trainingstag</button><button class="${DIET==='rest'?'on':''}" onclick="setDiet('rest')">Ruhetag</button></div><button class="btn icon sm" aria-label="Plan-Optionen" onclick="openPlanOptions()">${icon('more')}</button></div>`;
  h+=macroRow(tot.kcal,tot.protein,tot.carbs,tot.fat,target||undefined);
  if(target){const diff=Math.round(tot.kcal-target);const ok=Math.abs(diff)<=120;
    h+=`<div class="plan-status meta">Plan ${fmtNum(Math.round(tot.kcal))} kcal · Ziel ${fmtNum(target)} kcal · <span class="${ok?'tone-green':'tone-amber'}">${ok?'passt':(diff>0?fmtNum(diff)+' kcal drüber':fmtNum(-diff)+' kcal drunter')}</span></div>`;}
  if(isToday)h+=nextMealCard();
  if(!meals.length){h+=emptyState({icon:'utensils',title:'Keine Mahlzeiten für diesen Tagtyp',text:'Erstelle den Plan neu, damit beide Tagtypen befüllt werden.',btn:{label:'Plan neu erstellen',onclick:'genMealPlan()'}});el.innerHTML=h;return;}
  const L=loggedMealIds();const next=isToday?nextPlanMeal():null;const self=_dietSelf();
  h+=meals.map(m=>{const t=mealTotals(m);const done=isToday&&mealLogged(m,L);const slot=mealSlotOf(m);
    const open=OPEN_MEALS.has(m.id)||(next&&!next.logged&&next.mealId===m.id&&!OPEN_MEALS.size);
    const norm=s=>String(s||'').toLowerCase().replace(/[^a-zäöüß]/g,'');
    const showSlot=!norm(m.label).startsWith(norm(slot)); // Slot nur zeigen, wenn das Label ihn nicht schon nennt
    const names=(m.items||[]).map(i=>i.food).join(', ');
    return `<div class="meal${open?' open':''}${done?' done':''}" id="meal-${m.id}">
      <div class="meal-h" onclick="toggleMeal(${m.id})">
        <div class="ml">${done?`<div class="n ok">${icon('check',12)} Eingetragen</div>`:showSlot?`<div class="n">${esc2(slot)}</div>`:''}<div class="t">${esc2(m.label||'')}</div><div class="prev-line caption truncate">${esc2(names)}</div></div>
        <div class="kc">${fmtNum(Math.round(t.kcal))} kcal<em>${fmtNum(Math.round(t.protein))} g P</em></div>
        <span class="meal-chev">${icon('chevronDown',18)}</span>
      </div>
      <div class="meal-body">
        ${(m.items||[]).map(it=>`<div class="fi"><div class="fill"><div class="fn">${esc2(it.food)}${it.amount?` <span class="muted">· ${fmtNum(it.amount)} ${foodUnit(it.food)}</span>`:''}</div><div class="fi-mac caption">${macroLine(it.protein,it.carbs,it.fat)}</div>${it.notes?`<div class="fm">${esc2(it.notes)}</div>`:''}</div><div class="fmac">${fmtNum(Math.round(it.kcal||0))} kcal</div></div>`).join('')}
        ${self?`<div class="meal-acts cluster">
          ${done?`<button class="btn sm sec" disabled>${icon('check',16)} Eingetragen</button>`:`<button class="btn sm" onclick="logFromMeal(${m.id})">${icon('check',16)} Gegessen</button>`}
          <button class="btn sm ghost" onclick="swapMeal(${m.id},${Math.round(t.kcal)},'${esc(m.label||'')}')">Tauschen</button>
          ${m.recipe_id?`<button class="btn sm ghost" onclick="restoreMeal(${m.id})">Original</button>`:''}
        </div>`:''}
      </div></div>`;}).join('');
  h+=self?infoBox('dietplan_note','Der Plan trifft dein kcal- und Proteinziel. Mengen sind Richtwerte – mit „Tauschen“ ersetzt du eine Mahlzeit durch ein Rezept, mit „Gegessen“ landet sie im Protokoll.')
    :infoBox('dietplan_note_coach','Der Plan trifft das kcal- und Proteinziel des Athleten. Mengen sind Richtwerte. Eintragen und Tauschen macht der Athlet selbst – über „Plan neu erstellen“ passt du die Vorgabe an.');
  el.innerHTML=h;}
// Plan-Optionen (⋯): neu erstellen, ausschließen, nur berechnen, Einkaufswagen
function openPlanOptions(){openSheet('Plan-Optionen',`<div class="rows">
    <div class="row tap" onclick="closeModal();genMealPlan()"><div class="r-ic">${icon('refresh')}</div><div class="rl">Plan neu erstellen<small>Automatisch aus Profil und Ziel</small></div><div class="rr"></div></div>
    <div class="row tap" onclick="closeModal();openDislikes()"><div class="r-ic">${icon('x')}</div><div class="rl">Lebensmittel ausschließen<small>Was nicht im Plan landen soll</small></div><div class="rr"></div></div>
    <div class="row tap" onclick="closeModal();openCalc()"><div class="r-ic">${icon('scale')}</div><div class="rl">Nur berechnen<small>Makro-Rechner für ein Lebensmittel</small></div><div class="rr"></div></div>
    ${_dietSelf()?`<div class="row tap" onclick="closeModal();dietTab('cart')"><div class="r-ic">${icon('cart')}</div><div class="rl">Zum Einkaufswagen<small>Einkaufsliste verwalten</small></div><div class="rr"></div></div>`:''}
  </div>`);}
// Mahlzeitenplan automatisch (neu) erstellen – mit Bestätigung, wenn schon einer existiert, und Rückgängig (Server-Snapshot)
async function genMealPlan(){const has=(renderDiet.meals||[]).length>0;
  const run=async()=>{const el=document.getElementById('dietBody');if(el)el.innerHTML=skeleton(4);
    const r=await API.post('/mealplan/generate/'+VIEW_USER,{});
    if(r.status===200){await refreshMeals(false);await refreshFoodlog(false);drawDiet(); // Ziele + „als Nächstes“ gehören zum neuen Plan
      const vid=r.data?.versionId;
      if(vid)toast('Plan neu erstellt ✓',{label:'Rückgängig',fn:()=>restorePlan(vid)});else toast('Plan erstellt ✓');}
    else{toast(r.data?.error||'Fehler beim Erstellen');drawDiet();}};
  if(!has)return run();
  confirmSheet('Plan neu erstellen','Dein aktueller Plan – inklusive getauschter Mahlzeiten – wird durch einen neuen Vorschlag ersetzt.',{label:'Neu erstellen',danger:true,onYes:run});}
async function restorePlan(versionId){const r=await API.post('/meals/restore-plan',{versionId});
  if(r.status===200){await refreshMeals(false);await refreshFoodlog(false); // Ziele + „als Nächstes“ zeigen sonst auf den verworfenen Plan
    if(renderDiet.tab==='plan')drawDiet();else if(renderDiet.tab==='track')drawTrack();toast('Vorheriger Plan wiederhergestellt ✓');}
  else toast(r.data?.error||'Wiederherstellen nicht möglich');}

// Lebensmittel ausschließen (Abneigungen) – Mehrfachauswahl
async function openDislikes(){openSheet('Lebensmittel ausschließen','<div class="spinner"></div>');
  const r=await API.get('/disliked/'+VIEW_USER);const opts=r.data?.options||[];const sel=new Set(r.data?.disliked||[]);
  DISLIKE_SEL=sel;
  const chips=opts.map(o=>`<button class="chip soft${sel.has(o)?' on':''}" onclick="toggleDislike('${esc(o)}',this)">${esc2(o)}</button>`).join('');
  openSheet('Lebensmittel ausschließen',`
    <div class="note mb-3">Tippe an, was du nicht magst. Diese Lebensmittel kommen nicht in deinen automatischen Plan.</div>
    <div class="chip-row wrap mb-4">${chips}</div>
    <button class="btn block" onclick="saveDislikes()">Speichern</button>`);}
let DISLIKE_SEL=new Set();
function toggleDislike(name,btn){if(DISLIKE_SEL.has(name)){DISLIKE_SEL.delete(name);btn.classList.remove('on');}
  else{DISLIKE_SEL.add(name);btn.classList.add('on');}}
async function saveDislikes(){closeModal();const list=[...DISLIKE_SEL];
  const r=await API.post('/disliked/'+VIEW_USER,{disliked:list});
  if(r.status===200){
    if(_dietSelf())ME.disliked_foods=list;else if(VIEW_USER_PROFILE)VIEW_USER_PROFILE.disliked_foods=list; // lokal spiegeln
    RC_CACHE={};RC_ALL=null;
    await refreshMeals(false);
    if(renderDiet.tab==='recipes')drawRecipes();else if(renderDiet.tab==='plan')drawDiet();else if(renderDiet.tab==='track')drawTrack();
    if(r.data&&r.data.regenerated===false&&(renderDiet.meals||[]).length)toast('Gespeichert ✓',{label:'Plan neu erstellen',fn:genMealPlan});
    else toast('Gespeichert ✓');
  } else toast(r.data?.error||'Fehler');}

// ===== REZEPTE =====
let RECIPE_FILTER=null; // wird beim ersten Öffnen aus Profil + Uhrzeit vorbelegt
let RECIPES_CACHE=[];let RECIPE_CATS=[];let RECIPE_Q='';let RC_CACHE={};let RC_ALL=null;
function defaultRecipeFilter(){
  const goal=(_dietSelf()?ME.goal:(VIEW_USER_PROFILE?.goal))||'all';
  const h=new Date().getHours();const meal=h<10?'Frühstück':h<15?'Mittag':h<21?'Abend':'Snack';
  return {goal:goal||'all',meal,fit:false,source:'all',category:'all',simKcal:null};}
async function loadRecipeCats(){try{const r=await API.get('/recipes/categories');if(r.status===200)RECIPE_CATS=r.data.categories||[];}catch(e){}}
function _rcQuery(f){const sum=renderDiet.foodlog?.summary||{};const remaining=sum.remaining;let q='/recipes?';
  if(f.goal!=='all')q+='goal='+encodeURIComponent(f.goal)+'&';
  if(f.meal!=='all')q+='meal='+encodeURIComponent(f.meal)+'&';
  if(f.fit&&remaining>0)q+='maxKcal='+encodeURIComponent(remaining)+'&';
  if(f.category&&f.category!=='all')q+='category='+encodeURIComponent(f.category)+'&';
  if(f.source==='mine')q+='mine=1&';else if(f.source==='shared')q+='shared=1&';
  return q;}
async function _rcFetch(q){const c=RC_CACHE[q];if(c&&Date.now()-c.ts<60000)return c.recipes;
  const r=await API.get(q);const recipes=r.data?.recipes||[];RC_CACHE[q]={ts:Date.now(),recipes};return recipes;}
async function _rcFetchAll(){if(RC_ALL&&Date.now()-RC_ALL.ts<60000)return RC_ALL.recipes;const r=await API.get('/recipes');RC_ALL={ts:Date.now(),recipes:r.data?.recipes||[]};return RC_ALL.recipes;}
// Zutaten-Ausschluss + Ernährungsweise clientseitig
function _rcApplyPrefs(recipes){const dis=myDisliked();
  if(dis.length)recipes=recipes.filter(rc=>{const ing=(rc.ingredients||'').toLowerCase();return !dis.some(d=>ing.includes(String(d).toLowerCase()));});
  const dt=(_dietSelf()?ME.diet_type:VIEW_USER_PROFILE?.diet_type)||'all';
  if(dt==='vegan')recipes=recipes.filter(rc=>rc.diet==='vegan');
  else if(dt==='vegetarian')recipes=recipes.filter(rc=>rc.diet==='veg'||rc.diet==='vegan');
  return recipes;}
function _rcActiveCount(f){const dt=(_dietSelf()?ME.diet_type:VIEW_USER_PROFILE?.diet_type)||'all';
  return (f.meal!=='all'?1:0)+(f.goal!=='all'?1:0)+(dt!=='all'?1:0)+(f.source&&f.source!=='all'?1:0)+(f.fit?1:0)+(f.category&&f.category!=='all'?1:0)+(myDisliked().length?1:0);}
function _rcChips(){const f=RECIPE_FILTER;const dt=(_dietSelf()?ME.diet_type:VIEW_USER_PROFILE?.diet_type)||'all';
  const n=_rcActiveCount(f);
  const dietLbl={all:'',vegetarian:'🥕 Vegetarisch',vegan:'🌱 Vegan'}[dt];
  const goalLbl=({muscle:'Aufbau',fatloss:'Definition',health:'Gesundheit'})[f.goal];
  return `<button class="chip soft${n?' on':''}" onclick="openRecipeFilter()">${icon('filter',16)} Filter${n?' · '+n:''}</button>
    <button class="chip${f.meal!=='all'?' on':''}" onclick="openRecipeFilter()">${f.meal!=='all'?esc2(f.meal):'Alle Mahlzeiten'}</button>
    <button class="chip${f.goal!=='all'?' on':''}" onclick="openRecipeFilter()">${goalLbl||'Jedes Ziel'}</button>
    ${dietLbl?`<button class="chip on" onclick="openRecipeFilter()">${dietLbl}</button>`:''}
    ${f.simKcal?`<button class="chip on" onclick="recipeFilter('simKcal',null)">Ähnlich ≈ ${fmtNum(Math.round(f.simKcal))} kcal ${icon('x',14)}</button>`:''}`;}
// Rezepte-Tab: Suche + Filter-Chips + Liste (Liste wird separat gerendert, damit die Suche den Fokus behält)
async function drawRecipes(){_dietMark('recipes');const el=document.getElementById('dietBody');if(!el)return;
  if(!RECIPE_FILTER)RECIPE_FILTER=defaultRecipeFilter();
  el.innerHTML=`<div class="field lf-search rc-search"><div class="lf-searchwrap">${icon('search',18)}<input id="rc_search" type="search" placeholder="Rezepte durchsuchen…" value="${esc2(RECIPE_Q)}" oninput="recipeSearch(this.value)" autocomplete="off" enterkeyhint="search"></div></div>
    <div class="chip-row mb-2" id="rcChips">${_rcChips()}</div>
    <div id="rcList">${skeleton(3)}</div>
    <button class="btn sec mt-4" onclick="openNewRecipe()">${icon('plus',18)} Eigenes Rezept</button>`;
  if(!RECIPE_CATS.length)loadRecipeCats();
  // Im Coach-Kontext die Abneigungen des ATHLETEN laden (nicht die eigenen des Coaches)
  if(!_dietSelf()&&VIEW_USER_PROFILE&&VIEW_USER_PROFILE.disliked_foods===undefined){
    const dr=await API.get('/disliked/'+VIEW_USER);VIEW_USER_PROFILE.disliked_foods=dr.status===200?(dr.data?.disliked||[]):[];}
  await rcRenderList();}
function recipeSearch(v){RECIPE_Q=String(v||'');rcRenderList();}
async function rcRenderList(){const el=document.getElementById('rcList');if(!el)return;const f=RECIPE_FILTER;const q=RECIPE_Q.trim().toLowerCase();
  const myQ=q;
  let recipes=q?await _rcFetchAll():await _rcFetch(_rcQuery(f));
  if(!document.getElementById('rcList')||RECIPE_Q.trim().toLowerCase()!==myQ)return; // inzwischen weitergetippt / Tab gewechselt
  recipes=_rcApplyPrefs(recipes);
  if(q)recipes=recipes.filter(rc=>(rc.name||'').toLowerCase().includes(q)||(rc.ingredients||'').toLowerCase().includes(q)||(rc.category||'').toLowerCase().includes(q));
  if(!q&&f.simKcal)recipes=[...recipes].sort((a,b)=>Math.abs((a.kcal||0)-f.simKcal)-Math.abs((b.kcal||0)-f.simKcal));
  const ch=document.getElementById('rcChips');if(ch)ch.innerHTML=_rcChips();
  RECIPES_CACHE=recipes;
  if(!recipes.length){el.innerHTML=emptyState({icon:'search',title:q?'Nichts gefunden':'Keine Rezepte für diese Filter',text:q?'Versuch einen anderen Begriff.':'Ändere die Filter oder leg ein eigenes Rezept an.',btn:q?null:{label:'Filter ändern',onclick:'openRecipeFilter()'}});return;}
  const hideMeal=!q&&f.meal!=='all';const self=_dietSelf();
  el.innerHTML=(q?`<div class="caption mb-2">${recipes.length} Treffer in allen Rezepten</div>`:'')+'<div class="rows">'+recipes.map(rc=>{
    const goalTxt=({muscle:'Aufbau',fatloss:'Definition',health:'Gesundheit'})[rc.goal]||'';
    const dpill=rc.diet==='vegan'?' <span class="pill neutral" title="Vegan">🌱</span>':rc.diet==='veg'?' <span class="pill neutral" title="Vegetarisch">🥕</span>':'';
    const mine=rc.owner_id===ME?.id, shared=rc.owner_id&&!mine;
    const tag=mine?' <span class="pill neutral">eigenes</span>':shared?' <span class="pill red">geteilt</span>':'';
    const thumb=rc.has_photo?`<div class="rc-thumb" data-rcthumb="${rc.id}"></div>`:'';
    const meta=[hideMeal?'':rc.meal_type,rc.category,goalTxt].filter(Boolean).map(esc2).join(' · ');
    return `<div class="row tap" onclick="openRecipe(${rc.id})">${thumb}<div class="rl">${esc2(rc.name)}${dpill}${tag}<small>${meta?meta+'<br>':''}${macroLine(rc.protein,rc.carbs,rc.fat)}</small></div><div class="rr"><span>${fmtNum(Math.round(rc.kcal))} kcal</span>${self?`<button class="btn icon sm ghost" aria-label="Als gegessen eintragen" onclick="event.stopPropagation();logRecipe(${rc.id},{quick:true})">${icon('plus',20)}</button>`:''}</div></div>`;}).join('')+'</div>';
  // Thumbnails nachladen (Fotos sind nicht in der Liste enthalten)
  recipes.filter(rc=>rc.has_photo).forEach(async rc=>{const dr=await API.get('/recipes/'+rc.id);
    if(dr.status===200&&dr.data.recipe.photo){const box=document.querySelector(`[data-rcthumb="${rc.id}"]`);
      if(box){const im=document.createElement('img');im.alt='';im.src=dr.data.recipe.photo;box.replaceChildren(im);}}});}
// Filter-Sheet: Ziel, Mahlzeit, Ernährungsweise, Quelle, Kategorie, Budget, Ausschlüsse – Chips schalten in-place
function openRecipeFilter(){if(!RECIPE_FILTER)RECIPE_FILTER=defaultRecipeFilter();const f=RECIPE_FILTER;const meals=['Frühstück','Mittag','Abend','Snack'];
  const sum=renderDiet.foodlog?.summary||{};const remaining=sum.remaining;
  const dt=(_dietSelf()?ME.diet_type:VIEW_USER_PROFILE?.diet_type)||'all';
  const grp=(label,key,opts,cur,fn)=>`<div class="meta mb-2">${label}</div><div class="chip-row wrap mb-4" data-rfg="${key}">`+opts.map(([v,l])=>`<button class="chip${cur===v?' on':''}" data-v="${esc2(v)}" onclick="${fn?fn+"('"+esc(v)+"')":"recipeFilter('"+key+"','"+esc(v)+"')"}">${esc2(l)}</button>`).join('')+`</div>`;
  let h=grp('Ziel','goal',[['all','Alle'],['muscle','Aufbau'],['fatloss','Definition'],['health','Gesundheit']],f.goal);
  h+=grp('Mahlzeit','meal',[['all','Alle'],...meals.map(m=>[m,m])],f.meal);
  h+=grp('Ernährungsweise','diet',[['all','Alle'],['vegetarian','🥕 Vegetarisch'],['vegan','🌱 Vegan']],dt,'setDietType');
  h+=grp('Quelle','source',[['all','Alle'],['mine','Eigene'],['shared','Geteilt']],f.source||'all');
  if(RECIPE_CATS.length)h+=grp('Kategorie','category',[['all','Alle'],...RECIPE_CATS.map(c=>[c,c])],f.category||'all');
  if(remaining>0)h+=`<label class="switch-row rows mb-3"><div class="rl">Nur was ins Budget passt<small>${fmtNum(remaining)} kcal übrig</small></div><input type="checkbox" class="rcheck" ${f.fit?'checked':''} onchange="recipeFilter('fit',this.checked)"></label>`;
  h+=`<div class="rows mb-3"><div class="row tap" onclick="openDislikes()"><div class="r-ic">${icon('x')}</div><div class="rl">Zutaten ausschließen<small>${myDisliked().length?pl(myDisliked().length,'Lebensmittel','Lebensmittel')+' ausgeschlossen':'Unverträglichkeiten, Abneigungen'}</small></div><div class="rr"></div></div></div>`;
  h+=`<div class="lf-done"><span class="fill caption" id="rfCount"></span><button class="btn sm" onclick="closeModal()">Fertig</button></div>`;
  openSheet('Rezepte filtern',h,{size:'tall'});_rfCount();}
function _rfCount(){const c=document.getElementById('rfCount');if(c)c.textContent=pl(RECIPES_CACHE.length,'Rezept','Rezepte');}
function recipeFilter(key,val){if(!RECIPE_FILTER)RECIPE_FILTER=defaultRecipeFilter();RECIPE_FILTER[key]=val;
  if(key!=='simKcal')RECIPE_FILTER.simKcal=null; // manueller Filter hebt „Ähnliche"-Sortierung auf
  // Chips im offenen Sheet in-place umschalten (kein Neuaufbau, Scrollposition bleibt)
  const g=document.querySelector(`[data-rfg="${key}"]`);if(g)g.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.v===String(val)));
  if(renderDiet.tab==='recipes'&&document.getElementById('rcList'))rcRenderList().then(_rfCount);else drawRecipes().then(_rfCount);}
// Ernährungsweise setzen: nur speichern (kein Plan-Neuaufbau) – Plan neu erstellen nur über Plan-Optionen
async function setDietType(v){let r;
  if(_dietSelf())r=await API.put('/profile',{diet_type:v});
  else r=await API.post('/disliked/'+VIEW_USER,{disliked:myDisliked(),diet_type:v});
  if(r.status===200){if(_dietSelf())ME.diet_type=v;else if(VIEW_USER_PROFILE)VIEW_USER_PROFILE.diet_type=v;
    const g=document.querySelector('[data-rfg="diet"]');if(g)g.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.dataset.v===v));
    if(renderDiet.tab==='recipes'&&document.getElementById('rcList'))rcRenderList().then(_rfCount);
    toast('Ernährungsweise: '+({all:'Alle',vegetarian:'Vegetarisch',vegan:'Vegan'}[v])+' ✓');}
  else toast(r.data?.error||'Fehler');}
// „Ähnliche Rezepte" aus einem Rezept heraus: Rezepte-Tab mit kcal-Anker (ohne Seiten-Neuaufbau)
function similarRecipes(kcal,mealType){if(!RECIPE_FILTER)RECIPE_FILTER=defaultRecipeFilter();
  RECIPE_FILTER.meal=mealType||'all';RECIPE_FILTER.simKcal=kcal||null;RECIPE_Q='';
  closeAllSheets();
  if(document.getElementById('dietBody'))dietTab('recipes');else{renderDiet.tab='recipes';go('diet');}
  if(kcal)toast('Ähnliche '+(mealType?mealType+'-Rezepte':'Rezepte')+' nach Kalorien sortiert');}
async function openRecipe(id){let rc=RECIPES_CACHE.find(x=>x.id===id);
  openSheet(rc?rc.name:'Rezept','<div class="spinner"></div>');
  const dr=await API.get('/recipes/'+id);if(dr.status===200)rc=dr.data.recipe;
  if(!rc){openSheet('Rezept',emptyState({icon:'search',title:'Rezept nicht gefunden'}));return;}
  const goalTxt=({muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'})[rc.goal]||'für alle Ziele';
  const dpill=rc.diet==='vegan'?' · 🌱 Vegan':rc.diet==='veg'?' · 🥕 Vegetarisch':'';
  const isMine=rc.owner_id===ME?.id;
  let h='';
  if(rc.photo)h+=`<img id="rc_photo" alt="" class="rc-photo">`; // src wird unten als Property gesetzt
  h+=macroRow(rc.kcal,rc.protein,rc.carbs,rc.fat);
  h+=`<div class="meta mb-4">${esc2(rc.meal_type||'Mahlzeit')} · ${goalTxt}${rc.category?' · '+esc2(rc.category):''}${dpill}${(rc.owner_id&&!isMine)?' · <span class="tone-red">geteilt</span>':''}</div>`;
  if(_dietSelf())h+=`<button class="btn block mb-3" onclick="logRecipe(${rc.id})">${icon('check',18)} Gegessen – ins Protokoll</button>`;
  h+=`<div class="rc-acts mb-4">
    <button class="rc-act" onclick="similarRecipes(${rc.kcal||0},'${esc(rc.meal_type||'')}')">${icon('refresh',22)}<span>Ähnliche</span></button>
    ${_dietSelf()?`<button class="rc-act" onclick="cartFromRecipe(${rc.id})">${icon('cart',22)}<span>Einkauf</span></button>`:''}
    <button class="rc-act" onclick="openShareRecipe(${rc.id},'${esc(rc.name)}')">${icon('share',22)}<span>Teilen</span></button>
    <button class="rc-act" onclick="recipeMore(${rc.id})">${icon('more',22)}<span>Mehr</span></button>
  </div>`;
  if(rc.ingredients){h+=`<div class="section-label"><span>Zutaten</span></div><div class="card rc-text">${esc2(rc.ingredients)}</div>`;}
  if(rc.steps){h+=`<div class="section-label"><span>Zubereitung</span></div><div class="card rc-text">${esc2(rc.steps)}</div>`;}
  openSheet(rc.name,h);
  openRecipe.cur=rc;
  if(rc.photo){const im=document.getElementById('rc_photo');if(im)im.src=rc.photo;}}
function recipeMore(id){const rc=openRecipe.cur&&openRecipe.cur.id===id?openRecipe.cur:RECIPES_CACHE.find(x=>x.id===id);if(!rc)return;
  const isMine=rc.owner_id===ME?.id;
  openSheet('Mehr',`<div class="rows">
    <div class="row tap" onclick="shareViaLink('recipe',${rc.id})"><div class="r-ic">${icon('link')}</div><div class="rl">Per Link teilen</div><div class="rr"></div></div>
    ${(rc.link&&/^https?:\/\//.test(rc.link))?`<a class="row tap" href="${esc2(rc.link)}" target="_blank" rel="noopener"><div class="r-ic">${icon('play')}</div><div class="rl">Rezept ansehen (extern)</div><div class="rr"></div></a>`:''}
    ${isMine?`<div class="row tap" onclick="delRecipe(${rc.id})"><div class="r-ic tone-red">${icon('trash')}</div><div class="rl tone-red">Löschen</div><div class="rr"></div></div>`:''}
  </div>`);}
// Teilen-Sheet: Personen (Athlet->Athlet gleicher Coach, Coach->Athleten) + Link an einem Ort
async function openShareRecipe(id,name){const title='„'+name+'“ teilen';openSheet(title,'<div class="spinner"></div>');
  const r=await API.get('/recipes/'+id+'/share-targets');
  if(r.status!==200){openSheet(title,`<div class="note err mb-3">${esc2(r.data?.error||'Fehler')}</div><div class="rows"><div class="row tap" onclick="shareViaLink('recipe',${id})"><div class="r-ic">${icon('link')}</div><div class="rl">Per Link teilen</div><div class="rr"></div></div></div>`);return;}
  const t=r.data;
  let h=`<div class="rows mb-3"><div class="row tap" onclick="shareViaLink('recipe',${id})"><div class="r-ic">${icon('link')}</div><div class="rl">Per Link teilen<small>Funktioniert für jeden – auch ohne Konto</small></div><div class="rr"></div></div></div>`;
  if(t.canBroadcast){const on=t.scope==='athletes';
    h+=`<label class="switch-row rows mb-3"><div class="rl">Für alle meine Athleten freigeben</div><input type="checkbox" class="rcheck" id="sh_all" ${on?'checked':''} onchange="shareBroadcast(${id},this.checked)"></label>`;}
  if(t.targets.length){h+=`<div class="section-label"><span>Einzeln teilen</span></div><div class="rows mb-4">`+t.targets.map(p=>`<label class="switch-row"><div class="rl">${esc2(p.name)}</div><input type="checkbox" class="rcheck sh_t" value="${p.id}" ${p.shared?'checked':''}></label>`).join('')+`</div>
    <button class="btn block" onclick="doShareRecipe(${id})">Auswahl speichern</button>`;}
  else h+=`<div class="caption center">${t.canBroadcast?'Noch keine Athleten zugewiesen.':'Niemand aus deinem Coaching-Kreis zum Teilen verfügbar.'}</div>`;
  openSheet(title,h);}
async function shareBroadcast(id,on){await API.post('/recipes/'+id+'/share',{scope:on?'athletes':'private'});toast(on?'Für alle Athleten freigegeben ✓':'Freigabe entfernt');}
async function doShareRecipe(id){const boxes=[...document.querySelectorAll('.sh_t')];
  const add=boxes.filter(b=>b.checked).map(b=>+b.value);
  const remove=boxes.filter(b=>!b.checked).map(b=>+b.value);
  if(add.length)await API.post('/recipes/'+id+'/share',{user_ids:add});
  for(const uid of remove)await API.del('/recipes/'+id+'/share/'+uid);
  closeModal();toast('Teilen aktualisiert ✓');}
// Rezept als gegessen eintragen. opts.quick=true (aus der Liste): Sheet/Liste bleiben, nur Toast mit Rückgängig
async function logRecipe(id,opts){if(_dietRO())return;opts=opts||{};const rc=RECIPES_CACHE.find(x=>x.id===id)||(openRecipe.cur&&openRecipe.cur.id===id?openRecipe.cur:null);
  const slot=(rc&&MEAL_SLOTS.includes(rc.meal_type))?rc.meal_type:slotDefault();
  const r=await API.post('/recipes/'+id+'/log',{user_id:VIEW_USER,date:today(),meal_slot:slot});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  if(!opts.quick){closeAllSheets();}
  const fl=await refreshFoodlog(!opts.quick);
  const name=rc?rc.name:'Rezept';
  const row=(fl?.items||[]).slice().reverse().find(it=>it.food===name);
  toast(name+' eingetragen ✓',row?{label:'Rückgängig',fn:async()=>{const dr=await API.del('/foodlog/'+row.id);await refreshFoodlog(!opts.quick);
    toast(dr.status===200?'Zurückgenommen':'Eintrag ist nicht mehr da');}}:undefined);
  if(!opts.quick)dietTab('track');}
function delRecipe(id){confirmSheet('Rezept löschen','Dein eigenes Rezept wird dauerhaft gelöscht.',{label:'Löschen',danger:true,onYes:async()=>{
    const r=await API.del('/recipes/'+id);
    if(r.status===200){closeAllSheets();RC_CACHE={};RC_ALL=null;toast('Rezept gelöscht');if(renderDiet.tab==='recipes')drawRecipes();}
    else toast(r.data?.error||'Fehler');}});}
function openNewRecipe(){openSheet('Eigenes Rezept',`
  <div class="note mb-3">Leg eine Mahlzeit an, die du oft isst – danach trägst du sie mit einem Tipp ein.</div>
  <div id="nrForm">
  <div class="field"><label>Name</label><input id="nr_name" placeholder="z.B. Mein Frühstücks-Bowl"></div>
  <div class="grid-2">
    <div class="field"><label>Kalorien</label><input id="nr_kcal" type="number" inputmode="numeric" placeholder="kcal"></div>
    <div class="field"><label>Mahlzeit</label><select id="nr_meal"><option value="">–</option><option>Frühstück</option><option>Mittag</option><option>Abend</option><option>Snack</option></select></div>
  </div>
  <div class="grid-3">
    <div class="field"><label>Protein</label><input id="nr_p" type="number" inputmode="numeric" placeholder="g"></div>
    <div class="field"><label>Carbs</label><input id="nr_c" type="number" inputmode="numeric" placeholder="g"></div>
    <div class="field"><label>Fett</label><input id="nr_f" type="number" inputmode="numeric" placeholder="g"></div>
  </div>
  <details class="more mb-4"><summary>Mehr Angaben</summary>
    <div class="mt-3">
    <div class="field"><label>Ziel (optional)</label><select id="nr_goal"><option value="">für alle</option><option value="muscle">Aufbau</option><option value="fatloss">Definition</option><option value="health">Gesundheit</option></select></div>
    <div class="field"><label>Zutaten (eine pro Zeile)</label><textarea id="nr_ing" rows="3" placeholder="100 g Haferflocken\n300 ml Milch"></textarea></div>
    <div class="field"><label>Zubereitung</label><textarea id="nr_steps" rows="2" placeholder="1. …"></textarea></div>
    <div class="grid-2">
      <div class="field"><label>Kategorie</label><input id="nr_cat" list="catlist" placeholder="z.B. Bowl, Smoothie"><datalist id="catlist">${(RECIPE_CATS||[]).map(c=>`<option value="${esc2(c)}">`).join('')}</datalist></div>
      <div class="field"><label>Ernährungsweise</label><select id="nr_diet"><option value="">egal</option><option value="veg">🥕 Vegetarisch</option><option value="vegan">🌱 Vegan</option></select></div>
    </div>
    <div class="field"><label>Foto</label>
      <label class="btn sec">${icon('camera',18)} Foto aufnehmen / auswählen<input type="file" accept="image/*" hidden onchange="recipePhotoPick(event)"></label>
      <div id="nr_photo_prev" class="mt-2"></div></div>
    <div class="field"><label>Link zu Rezept/Video</label><input id="nr_link" placeholder="https://…"></div>
    ${(ME?.role==='coach'||ME?.role==='admin')?`<label class="switch-row rows mb-3"><div class="rl">Direkt mit allen meinen Athleten teilen</div><input type="checkbox" class="rcheck" id="nr_share_ath"></label>`:''}
    </div></details>
  <button class="btn block" onclick="saveNewRecipe()">Rezept speichern</button></div>`,{size:'tall'});
  setTimeout(()=>document.getElementById('nr_name')?.focus(),60);}
// Foto auswählen, runterskalieren (max 1024px), als Data-URL in NR_PHOTO ablegen
let NR_PHOTO=null;
function recipePhotoPick(ev){const file=ev.target.files&&ev.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=()=>{
    const max=1024;let{width:w,height:h}=img;if(w>max||h>max){if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;}}
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(img,0,0,w,h);
    NR_PHOTO=cv.toDataURL('image/jpeg',0.78);
    const pv=document.getElementById('nr_photo_prev');if(pv)pv.innerHTML=`<img src="${NR_PHOTO}" alt="" class="rc-photo"><button class="btn sm sec" onclick="NR_PHOTO=null;document.getElementById('nr_photo_prev').innerHTML='';">Foto entfernen</button>`;
  };img.src=e.target.result;};reader.readAsDataURL(file);}
async function saveNewRecipe(){const shareAth=document.getElementById('nr_share_ath');
  const body={name:val('nr_name'),kcal:num('nr_kcal'),protein:num('nr_p'),carbs:num('nr_c'),fat:num('nr_f'),
    meal_type:val('nr_meal'),goal:val('nr_goal')||null,ingredients:val('nr_ing'),steps:val('nr_steps'),link:val('nr_link'),
    category:val('nr_cat'),diet:val('nr_diet'),photo:NR_PHOTO,shared_scope:(shareAth&&shareAth.checked)?'athletes':'private'};
  if(!body.name)return showFieldErr('nrForm','Bitte einen Namen eingeben','nr_name');
  if(!body.kcal)return showFieldErr('nrForm','Bitte die Kalorien angeben','nr_kcal');
  const r=await API.post('/recipes',body);
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();NR_PHOTO=null;toast('Rezept gespeichert ✓');
  RECIPE_FILTER=Object.assign(defaultRecipeFilter(),{goal:'all',meal:'all',source:'mine',simKcal:null});RECIPE_Q='';RC_CACHE={};RC_ALL=null;
  loadRecipeCats();
  if(document.getElementById('dietBody')){await drawRecipes();}
  if(r.data?.id)openRecipe(r.data.id);}

// ===== EINKAUFSWAGEN (eigener Reiter) =====
async function drawCart(){_dietMark('cart');const el=document.getElementById('dietBody');if(!el)return;el.innerHTML=skeleton(3,'sm');
  const r=await API.get('/cart');const items=r.data?.items||[];
  if(!document.getElementById('dietBody')||renderDiet.tab!=='cart')return;
  let h=`<div class="cluster mb-2">
      <button class="btn sm sec" onclick="cartFromPlan()">${icon('download',16)} Aus Plan (7 Tage)</button>
      <button class="btn sm" onclick="cartAddManual()">${icon('plus',16)} Hinzufügen</button>
      ${items.length?`<button class="btn icon sm" aria-label="Mehr" onclick="cartMore()">${icon('more')}</button>`:''}
    </div><div class="caption mb-3">„Aus Plan“ rechnet die Mengen deines Plans für 7 Tage zusammen.</div>`;
  if(!items.length){h+=emptyState({icon:'cart',title:'Dein Einkaufswagen ist leer',text:'Übernimm deinen Plan, leg Rezept-Zutaten hinein oder füge selbst etwas hinzu.',btn:{label:'Aus Plan übernehmen',onclick:'cartFromPlan()'}});
    el.innerHTML=h;return;}
  const open=items.filter(i=>!i.checked), done=items.filter(i=>i.checked);
  const row=i=>`<div class="row cart-row${i.checked?' done':''}" onclick="cartToggle(${i.id})">
    <span class="cart-check">${i.checked?icon('check',14):''}</span><div class="rl truncate">${esc2(i.text)}</div>
    <button class="btn icon sm ghost" aria-label="Mehr" onclick="event.stopPropagation();cartItemMenu(${i.id},'${esc(i.text)}',${i.checked?1:0})">${icon('more',18)}</button></div>`;
  if(open.length)h+=`<div class="rows mb-3">`+open.map(row).join('')+`</div>`;
  if(done.length)h+=`<div class="section-label"><span>Erledigt</span><span class="sl-r">${done.length}</span></div><div class="rows">`+done.map(row).join('')+`</div>`;
  h+=`<div class="caption center mt-3">${done.length}/${items.length} erledigt</div>`;
  el.innerHTML=h;}
async function cartFromPlan(){const r=await API.post('/cart/from-plan',{});if(r.status===200){toast(pl(r.data.added||0,'Artikel','Artikel')+' aus dem Plan ✓');drawCart();}else toast(r.data?.error||'Erst einen Ernährungsplan erstellen');}
function cartAddManual(){openSheet('Zum Einkaufswagen',`<div id="cartForm"><div class="field"><label>Was brauchst du?</label><input id="cart_text" placeholder="z.B. 6 Eier, Olivenöl, Haferflocken" enterkeyhint="done" onkeydown="if(event.key==='Enter')cartSaveManual()"></div><button class="btn block" onclick="cartSaveManual()">Hinzufügen</button></div>`);
  setTimeout(()=>document.getElementById('cart_text')?.focus(),60);}
async function cartSaveManual(){const t=val('cart_text');if(!t)return showFieldErr('cartForm','Bitte etwas eingeben','cart_text');const r=await API.post('/cart/add',{text:t,source:'manual'});if(r.status===200){closeModal();dietTab('cart');}else toast(r.data?.error||'Fehler');}
async function cartFromRecipe(id){const r=await API.post('/cart/from-recipe/'+id,{});if(r.status===200)toast(pl(r.data.added||0,'Zutat','Zutaten')+' im Einkaufswagen ✓',{label:'Ansehen',fn:()=>{closeAllSheets();dietTab('cart');}});else toast(r.data?.error||'Fehler');}
async function cartToggle(id){const r=await API.post('/cart/'+id+'/toggle',{});if(r.status!==200)toast(r.data?.error||'Fehler');drawCart();}
function cartItemMenu(id,text,checked){openSheet(text,`<div class="rows">
    <div class="row tap" onclick="closeModal();cartToggle(${id})"><div class="r-ic">${icon('check')}</div><div class="rl">${checked?'Wieder offen':'Erledigt'}</div><div class="rr"></div></div>
    <div class="row tap" onclick="cartDelete(${id})"><div class="r-ic tone-red">${icon('trash')}</div><div class="rl tone-red">Entfernen</div><div class="rr"></div></div></div>`);}
async function cartDelete(id){const cur=(await API.get('/cart')).data?.items?.find(i=>i.id===id);
  const r=await API.del('/cart/item/'+id);if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();drawCart();
  if(cur)toast('Entfernt',{label:'Rückgängig',fn:async()=>{await API.post('/cart/add',{text:cur.text,source:cur.source||'manual'});drawCart();toast('Wiederhergestellt ✓');}});}
function cartMore(){openSheet('Einkaufswagen',`<div class="rows">
    <div class="row tap" onclick="closeModal();cartClear(true)"><div class="r-ic">${icon('check')}</div><div class="rl">Erledigte entfernen</div><div class="rr"></div></div>
    <div class="row tap" onclick="cartClear(false)"><div class="r-ic tone-red">${icon('trash')}</div><div class="rl tone-red">Wagen leeren</div><div class="rr"></div></div></div>`);}
async function cartClear(checkedOnly){const run=async()=>{const r=await API.post('/cart/clear',{checkedOnly});if(r.status!==200)toast(r.data?.error||'Fehler');else toast(checkedOnly?'Erledigte entfernt':'Einkaufswagen geleert');closeAllSheets();drawCart();};
  if(checkedOnly)return run();
  confirmSheet('Einkaufswagen leeren','Alle Einträge – auch offene – werden entfernt.',{label:'Leeren',danger:true,onYes:run});}

// ===== BARCODE-SCANNER (Open Food Facts) =====
let BC_STREAM=null,BC_RUNNING=false,BC_ZXING=null,_zxingPromise=null;
// ZXing (Barcode-Erkennung in JS) bei Bedarf nachladen – nötig auf iOS-Safari, das kein
// natives BarcodeDetector hat. Fällt sauber auf manuelle Eingabe zurück, wenn offline.
function loadZXing(){
  if(window.ZXing)return Promise.resolve(window.ZXing);
  if(_zxingPromise)return _zxingPromise;
  _zxingPromise=new Promise(res=>{
    const s=document.createElement('script');
    s.src='https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
    s.onload=()=>res(window.ZXing||null);
    s.onerror=()=>{_zxingPromise=null;res(null);};
    document.head.appendChild(s);
  });
  return _zxingPromise;
}
// Höhere Auflösung hilft bei kleinen Barcodes; Dauer-Autofokus anfordern (best-effort, Hardware-abhängig).
const BC_VIDEO_CONSTRAINTS={facingMode:'environment',width:{ideal:1920},height:{ideal:1080}};
function tryContinuousFocus(){
  setTimeout(()=>{try{const v=document.getElementById('bc_video');
    const tr=v&&v.srcObject&&v.srcObject.getVideoTracks&&v.srcObject.getVideoTracks()[0];
    if(tr&&tr.applyConstraints)tr.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{});
  }catch(e){}},900);
}
function openBarcodeScanner(){
  openSheet('Barcode scannen',`
    <div id="bc_cam" class="bc-cam"><video id="bc_video" playsinline muted autoplay></video><div class="bc-line"></div></div>
    <div id="bc_status" class="bc-status">Kamera startet… halte den Strichcode ins Bild.</div>
    <div class="field"><label>oder Nummer (EAN) eintippen</label><input id="bc_code" type="text" inputmode="numeric" placeholder="z.B. 4337185272363"></div>
    <button class="btn block" onclick="lookupBarcode()">Produkt suchen</button>`);
  startBarcodeCam();}
async function startBarcodeCam(){
  const v=document.getElementById('bc_video');if(!v)return;
  const st=document.getElementById('bc_status');
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){if(st)st.textContent='Kamera nicht verfügbar – Nummer unten eintippen.';return;}
  // 1) Schneller nativer Weg (Android/Chrome): BarcodeDetector
  if('BarcodeDetector' in window){
    try{
      BC_STREAM=await navigator.mediaDevices.getUserMedia({video:BC_VIDEO_CONSTRAINTS});
      v.srcObject=BC_STREAM;await v.play();tryContinuousFocus();
      const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128']});
      BC_RUNNING=true;if(st)st.textContent='Halte den Strichcode ins Bild.';
      const scan=async()=>{
        if(!BC_RUNNING||!document.getElementById('bc_video'))return stopBarcodeCam();
        try{const codes=await det.detect(v);
          if(codes.length){const code=codes[0].rawValue;stopBarcodeCam();
            const inp=document.getElementById('bc_code');if(inp)inp.value=code;lookupBarcode(code);return;}}catch(e){}
        requestAnimationFrame(scan);};
      scan();return;
    }catch(e){if(st)st.textContent='Kamera-Zugriff verweigert – Nummer unten eintippen.';return;}
  }
  // 2) iOS-Safari & Co.: ZXing nachladen und die Kamera scannen lassen
  if(st)st.textContent='Scanner wird geladen…';
  const Z=await loadZXing();
  if(!Z){if(st)st.textContent='Scanner konnte nicht geladen werden (offline?) – Nummer unten eintippen.';return;}
  try{
    BC_ZXING=new Z.BrowserMultiFormatReader();
    BC_RUNNING=true;if(st)st.textContent='Halte den Strichcode ins Bild.';
    // decodeFromConstraints ist asynchron: abgelehnte Kamera landet sonst als unbehandelter Promise-Fehler
    const p=BC_ZXING.decodeFromConstraints({video:BC_VIDEO_CONSTRAINTS},v,(result)=>{
      if(result&&BC_RUNNING){const code=result.getText();stopBarcodeCam();
        const inp=document.getElementById('bc_code');if(inp)inp.value=code;lookupBarcode(code);}
    });
    if(p&&typeof p.catch==='function')p.catch(()=>{stopBarcodeCam();
      const st2=document.getElementById('bc_status');if(st2)st2.textContent='Kamera-Zugriff verweigert – Nummer unten eintippen.';});
    tryContinuousFocus();
  }catch(e){if(st)st.textContent='Kamera-Zugriff verweigert – Nummer unten eintippen.';}}
function stopBarcodeCam(){BC_RUNNING=false;
  if(BC_STREAM){BC_STREAM.getTracks().forEach(t=>t.stop());BC_STREAM=null;}
  if(BC_ZXING){try{BC_ZXING.reset();}catch(e){}BC_ZXING=null;}}
let BC_FOUND=null;
async function lookupBarcode(codeArg){
  const code=(codeArg||val('bc_code')||'').replace(/\D/g,'');
  if(code.length<8)return toast('Bitte gültige Barcode-Nummer eingeben');
  stopBarcodeCam();openSheet('Barcode','<div class="spinner"></div>');
  try{
    const resp=await fetch('https://world.openfoodfacts.org/api/v2/product/'+code+'.json?fields=product_name,brands,nutriments');
    const d=await resp.json();
    if(!d.product||d.status===0){openSheet('Barcode',emptyState({icon:'barcode',title:'Produkt nicht gefunden',text:'Nicht in der Datenbank. Du kannst es unter „Neu“ selbst anlegen.',btn:{label:'Nochmal scannen',onclick:'openBarcodeScanner()'}}));return;}
    const n=d.product.nutriments||{};
    const per100={name:(d.product.product_name||'Produkt')+(d.product.brands?' ('+d.product.brands.split(',')[0]+')':''),
      kcal:Math.round(n['energy-kcal_100g']||((n.energy_100g||0)/4.184)),protein:n.proteins_100g||0,carbs:n.carbohydrates_100g||0,fat:n.fat_100g||0};
    BC_FOUND=per100;try{BC_PRODUCT=per100;}catch(e){}
    openSheet('Gefunden',`
      <div class="card mb-3"><div class="h3">${esc2(per100.name)}</div>
        <div class="meta mt-1">pro 100 g: ${fmtNum(per100.kcal)} kcal · ${macroLine(per100.protein,per100.carbs,per100.fat)}</div></div>
      <div id="bcForm"><div class="field"><label>Wie viel hast du gegessen? (g)</label><input id="bc_amt" type="number" inputmode="decimal" min="0" max="3000" value="100"></div>
      <div class="chip-row wrap mb-3">${[50,100,150,200].map(v=>`<button class="chip${v===100?' on':''}" onclick="amtChip('bc_amt',${v},this)">${v} g</button>`).join('')}</div>
      ${slotSelect('bc_slot')}
      <button class="btn block" onclick="logScannedProduct()">Eintragen</button>
      <button class="btn sec mt-2" onclick="openBarcodeScanner()">Anderes Produkt scannen</button></div>`);
  }catch(e){openSheet('Barcode',`<div class="note err mb-3">Produktsuche fehlgeschlagen – keine Verbindung zur Lebensmittel-Datenbank?</div><button class="btn sec" onclick="openBarcodeScanner()">Nochmal versuchen</button>`);}}
async function logScannedProduct(){const f=BC_FOUND;if(!f)return;const a=(num('bc_amt')||0);
  if(a<=0)return showFieldErr('bcForm','Bitte eine Menge angeben','bc_amt');
  const k=a/100;const slot=val('bc_slot')||slotDefault();slotRemember(slot);
  const r=await API.post('/foodlog',{user_id:VIEW_USER,date:today(),meal_slot:slot,food:f.name,amount:a,
    kcal:Math.round(f.kcal*k),protein:r1(f.protein*k),carbs:r1(f.carbs*k),fat:r1(f.fat*k)});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  // Aus dem „Essen hinzufügen"-Sheet heraus: eine Ebene zurück, Scanner wieder starten, Zähler hochzählen
  if(typeof SHEET_STACK!=='undefined'&&SHEET_STACK.length>1){closeModal();
    if(document.getElementById('lfSeg')){lfTab(2,{focus:false});await _lfAfterAdd(Math.round(f.kcal*k),f.name);return;}}
  closeAllSheets();await refreshFoodlog(false);toast(f.name+' eingetragen ✓');if(document.getElementById('dietBody'))dietTab('track');}

// ===== MAKRO-RECHNER („Nur berechnen" aus den Plan-Optionen) =====
let CALC_SEL=null;
function openCalc(){if(!FOODS.length)return toast('Lädt…');CALC_SEL=null;
  openSheet('Makro-Rechner',`${infoBox('calc_intro','Such ein Lebensmittel, gib die Menge ein – Kalorien und Makros werden sofort berechnet und lassen sich direkt ins Protokoll übernehmen.')}
    <div class="field lf-search"><label>Lebensmittel suchen</label><div class="lf-searchwrap">${icon('search',18)}<input id="calc_search" type="search" placeholder="z.B. Reis, Hähnchen…" oninput="filterCalcFoods(this.value)" autocomplete="off"></div></div>
    <div id="calc_list" class="mb-3"></div>
    <div id="calc_sel" hidden><div class="between mb-2"><div class="h3 fill truncate" id="calc_name"></div><button class="btn sm sec" onclick="calcClear()">ändern</button></div>
    <div class="field"><label id="calc_unit">Menge (g)</label><input id="calc_amt" type="number" inputmode="decimal" value="100" oninput="doCalc()"></div>
    <div class="macro-row" id="calc_out"></div>
    ${slotSelect('calc_slot')}
    ${_dietSelf()?'<button class="btn block" onclick="calcAddToLog()">Ins Protokoll eintragen</button>':''}</div>`);
  filterCalcFoods('');setTimeout(()=>document.getElementById('calc_search')?.focus(),60);}
function filterCalcFoods(q){q=(q||'').toLowerCase().trim();const el=document.getElementById('calc_list');if(!el)return;
  const seen=new Set();let list=[];FOODS.forEach((f,i)=>{const k=f.name.toLowerCase();if(seen.has(k))return;seen.add(k);if(!q||k.includes(q))list.push({f,i});});
  el.innerHTML='<div class="rows">'+list.slice(0,q?30:10).map(x=>`<div class="row tap" onclick="calcPick(${x.i})"><div class="rl">${esc2(x.f.name)}<small>${kcalUnitTxt(x.f)}</small></div><div class="rr"></div></div>`).join('')+'</div>'+(!list.length?emptyState({icon:'search',title:'Nichts gefunden'}):'');}
function calcPick(i){CALC_SEL=i;const f=FOODS[i];if(!f)return;const s=document.getElementById('calc_sel');if(s)s.hidden=false;
  const n=document.getElementById('calc_name');if(n)n.textContent=f.name;
  const u=foodUnit(f.name,f);const ul=document.getElementById('calc_unit');if(ul)ul.textContent='Menge ('+u+')';
  const ai=document.getElementById('calc_amt');if(ai&&u==='Stück')ai.value=1;
  const l=document.getElementById('calc_list');if(l)l.hidden=true;const sf=document.getElementById('calc_search');if(sf)sf.closest('.field').hidden=true;doCalc();}
function calcClear(){CALC_SEL=null;const s=document.getElementById('calc_sel');if(s)s.hidden=true;const l=document.getElementById('calc_list');if(l)l.hidden=false;const sf=document.getElementById('calc_search');if(sf){sf.closest('.field').hidden=false;sf.focus();}}
async function calcAddToLog(){if(_dietRO())return;const f=FOODS[CALC_SEL];const a=parseFloat(val('calc_amt'))||0;
  if(!f||a<=0)return toast('Menge angeben');const slot=val('calc_slot')||slotDefault();slotRemember(slot);
  const body={user_id:VIEW_USER,date:today(),meal_slot:slot,food:f.name,amount:a,
    kcal:Math.round((f.fat*9+f.carbs*4+f.protein*4)*a),fat:f.fat*a,carbs:f.carbs*a,protein:f.protein*a};
  const r=await API.post('/foodlog',body);
  if(r.status===200){closeAllSheets();await refreshFoodlog(false);dietTab('track');toast(f.name+' eingetragen ✓');}else toast(r.data?.error||'Fehler');}
function doCalc(){const f=FOODS[CALC_SEL];if(!f)return;const a=parseFloat(val('calc_amt'))||0;
  const fat=f.fat*a,carb=f.carbs*a,prot=f.protein*a,kc=fat*9+carb*4+prot*4;
  const out=document.getElementById('calc_out');if(out)out.innerHTML=`<div class="macro kcal"><div class="v">${fmtNum(Math.round(kc))}</div><div class="k">kcal</div></div><div class="macro"><div class="v">${fmtNum(prot,1)}<em>g</em></div><div class="k">Protein</div></div><div class="macro"><div class="v">${fmtNum(carb,1)}<em>g</em></div><div class="k">Carbs</div></div><div class="macro"><div class="v">${fmtNum(fat,1)}<em>g</em></div><div class="k">Fett</div></div>`;}
