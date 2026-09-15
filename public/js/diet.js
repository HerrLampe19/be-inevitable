// BE INEVITABLE – Frontend, Teil «diet.js» (WP3 · Ernährung). Klassische Skripte in fester Reihenfolge
// (siehe index.html); alle Funktionen sind global, wie zuvor in der einen app.js.
// Aufbau: Grundgerüst/Tabs · Slot-Enum & Ziele · Heute (Ring, Nächste Mahlzeit, Protokoll) · Essen hinzufügen
// (Liste/Scan/Manuell/Neu, Mehrfach-Eintrag) · Plan (Mahlzeiten, Tauschen, Optionen) · Rezepte · Einkauf ·
// Barcode · Makro-Rechner. Exporte für andere Bereiche: nextPlanMeal(summary?) -> {mealId,label,slot,kcal,
// protein,logged,done,total,preview}|null, logFromMeal(mealId) -> true|'queued'|false, openLogFood({focus}),
// openCalc().
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
// ===== SUCHE, DIE TRIFFT (B18) =====
// Vorher verglich die Suche rohe Zeichenketten – „hahnchen" fand die „Hähnchenbrust" nicht, und wer unterwegs
// tippt, lässt Umlaute weg. dtNorm() bringt beide Seiten auf dieselbe Form: NFD zerlegt „ä" in „a" + Akzent,
// die Unicode-Klasse wirft den Akzent weg; „ß" wird zu „ss"; die getippten Ersatzschreibweisen ae/oe/ue fallen
// auf a/o/u. Damit enden „Hähnchen", „haehnchen" und „hahnchen" alle bei „hahnchen". Die Ersatzschreibweisen
// werden auf BEIDEN Seiten gleich behandelt – es kann also nichts auseinanderlaufen.
function dtNorm(s){return String(s==null?'':s).toLowerCase().replace(/ß/g,'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u')
  .replace(/\s+/g,' ').trim();}
// Mehrwort-UND: „toast kase" trifft „Toast Käse light", die Reihenfolge ist egal.
function dtToks(q){return dtNorm(q).split(' ').filter(Boolean);}
function dtHit(text,toks){if(!toks.length)return true;const h=dtNorm(text);return toks.every(t=>h.includes(t));}
// ===== DER TAG, DEN DIESER REITER ZEIGT (A-IV.4 · dt2) =====
// Bis 2.7.0 kannte der Ernährungs-Tab genau EINEN Tag: heute – `today()` stand an vierzehn Stellen fest.
// Wer abends das Mittagessen nachtragen wollte, konnte es nicht. Und genau das tun Menschen: sie loggen
// nicht beim Essen, sondern danach. Das Essens-Logging bricht unter allen Selbstbeobachtungs-Arten am
// schnellsten ab (Median 10 Wochen, Carpenter 2022); ein Tag, der sich nicht nachtragen lässt, ist der Tag,
// an dem jemand aufhört. Der Server nimmt `?date=` und `date` im Rumpf längst an (GET /api/foodlog,
// POST /api/foodlog, /foodlog/frommeal, /recipes/:id/log) – gefehlt hat allein die Oberfläche.
// DT2_DATE bleibt bewusst null, solange „heute" gemeint ist: so wandert die Ansicht über Mitternacht mit,
// statt auf dem Datum stehen zu bleiben, das beim Öffnen galt.
let DT2_DATE=null;
const DT2_BACK_MAX=365;   // so weit zurück lässt die Leiste (der Server erlaubt mehr, MAX_RANGE_DAYS=1100)
function dtDate(){return DT2_DATE||today();}
function dtIsToday(){return dtDate()===today();}
// Datumsrechnung über UTC-Mitternacht – dieselbe Form wie crDayDiff in core.js. Sommerzeit kann hier
// nichts verschieben, weil beide Seiten auf denselben Zeitpunkt 00:00 Z normiert werden.
function dtAddDays(d,n){return new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);}
function dtDayDiff(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);}
const DT2_WD=['So','Mo','Di','Mi','Do','Fr','Sa'];
// „Heute" · „Gestern" · „Sa 12.9." – kurz genug für die Leiste, eindeutig genug ohne Jahreszahl.
function dtDayLabel(d){const diff=dtDayDiff(today(),d);
  if(diff===0)return 'Heute';if(diff===-1)return 'Gestern';if(diff===-2)return 'Vorgestern';
  return dtDateShort(d);}
function dtDateShort(d){const x=new Date(Date.parse(d+'T00:00:00Z'));
  return DT2_WD[x.getUTCDay()]+' '+x.getUTCDate()+'.'+(x.getUTCMonth()+1)+'.';}
// Dasselbe Etikett mitten im Satz („für gestern", „für Sa 5.9."). Kleingeschrieben werden NUR die drei
// Wörter, die auch klein geschrieben gehören – „für sa 5.9." wäre schlicht falsch, Wochentage bleiben groß.
function dtDayLabelIn(d){const l=dtDayLabel(d);
  return /^(Heute|Gestern|Vorgestern)$/.test(l)?l.toLowerCase():l;}
// Tag wechseln. Der PLAN (/api/meals) hängt nicht am Kalendertag – er beschreibt Trainings- und Ruhetage –,
// darum wird hier nur das Protokoll neu geholt; den Tagtyp des gewählten Tages liefert die Antwort mit
// (fl.dayType, Server: dayTypeOf). Nach vorn ist bei „heute" Schluss: der Server nimmt einen Tag Kulanz an
// (FUTURE_GRACE_DAYS), aber ein Essen für morgen einzutragen ist keine Erfassung, sondern ein Versehen.
async function dtSetDate(d){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d)))return;
  if(d===dtDate())return;
  const diff=dtDayDiff(today(),d);
  if(diff>0)return toast('Weiter als bis heute geht es nicht');
  if(diff<-DT2_BACK_MAX)return toast('So weit zurück reicht das Protokoll nicht');
  DT2_DATE=(d===today())?null:d;
  renderDiet.foodlog=null;renderDiet.foodlogOk=false;renderDiet.foodlogSt=null;renderDiet.foodlogDate=null;
  renderDiet.foodlogLoading=true;   // drawTrack zeigt dann Leiste + Skelett statt „nicht erreichbar"
  if(renderDiet.tab==='track'||!renderDiet.tab)drawTrack();
  await refreshFoodlog();
}
function dtShiftDate(n){dtSetDate(dtAddDays(dtDate(),n));}
// Auf WELCHEN Tag schreibt ein Eintrag? Auf den, den der Ernährungs-Tab gerade zeigt – aber nur, wenn man
// ihn auch sieht. go() ersetzt den Inhalt von #views vollständig, es liegt also immer genau eine Ansicht im
// Dokument: gibt es kein #dietBody, kommt der Aufruf von woanders (Startseiten-Chip „Essen loggen",
// homeMealDone, Rezept aus der Suche) – und dort ist immer heute gemeint, nie ein Nachtrag-Tag, den der
// Nutzer vor zehn Minuten in einem anderen Reiter angesehen hat.
function dtLogDay(){return (document.getElementById('dietBody')&&!dtIsToday())?dtDate():today();}
// Die Datumsleiste. Sie steht im normalen Fluss (nicht sticky): eine klebende Leiste würde beim Messen
// den „Essen hinzufügen"-Knopf verdecken können, und verdeckte Ziele sind ein echter Bedienfehler, kein
// Messartefakt. Der mittlere Knopf ist zugleich der Rückweg – ein Tipp und man ist wieder auf heute.
function dtDateBar(){const d=dtDate(),isT=dtIsToday();
  const prev=dtAddDays(d,-1),next=dtAddDays(d,1);
  const canPrev=dtDayDiff(prev,today())<=DT2_BACK_MAX;
  const canNext=dtDayDiff(today(),next)<=0;
  // Die zweite Zeile trägt zwei Dinge: das genaue Datum und den Rückweg. Ab „Vorgestern" IST die erste
  // Zeile schon das Datum („Sa 5.9.") – dann bliebe nur „Sa 5.9. · zu heute" darunter, dasselbe Wort
  // zweimal untereinander. In dem Fall steht dort nur noch „zu heute".
  const label=dtDayLabel(d);
  const sub=isT?'':(label===dtDateShort(d)?'zu heute':dtDateShort(d)+' · zu heute');
  return `<div class="dt-datebar" id="dtDateBar">
    <button class="dt-arrow" ${canPrev?'':'disabled'} aria-label="Ein Tag zurück (${esc2(dtDayLabel(prev))})" onclick="dtShiftDate(-1)">${icon('chevronLeft',20)}</button>
    <button class="dt-day${isT?' now':''}" ${isT?'disabled':''} aria-label="${isT?'Angezeigt: heute':'Angezeigt: '+esc2(dtDateShort(d))+' – zurück zu heute'}" onclick="dtSetDate(today())">
      <span class="dd-l">${esc2(label)}</span>${sub?`<span class="dd-s">${esc2(sub)}</span>`:''}</button>
    <button class="dt-arrow" ${canNext?'':'disabled'} aria-label="Ein Tag vor (${esc2(dtDayLabel(next))})" onclick="dtShiftDate(1)">${icon('chevronRight',20)}</button>
  </div>`;}
// Wischen zwischen Tagen. Bewusst nur auf dem Heute-Reiter und nur für waagrechte, zügige Gesten:
// ein schräger Zug ist der Versuch zu scrollen, und den darf diese Geste nicht abfangen. Querscrollende
// Kinder (Chip-Reihen) sind ausgenommen – dort gehört die Bewegung der Reihe, nicht dem Kalender.
// Die Schwellen sind ABSICHTLICH dieselben wie beim Tabwechsel in shell.js (70 px, dy×2, 600 ms): eine
// Geste, die im Ernährungs-Tab bei 60 px auslöst und überall sonst erst bei 70, fühlt sich kaputt an.
// Dieselbe Bewegung, dieselbe Schwelle – nur eine andere Bedeutung an einer anderen Stelle.
let DT2_SW=null;
function dtSwipeStart(e){const t=e.touches&&e.touches[0];if(!t||e.touches.length>1)return;DT2_SW=null;
  if(renderDiet.tab&&renderDiet.tab!=='track')return;   // Plan/Rezepte/Einkauf haben keinen Tag zum Blättern
  let n=e.target;while(n&&n!==e.currentTarget){if(n.scrollWidth-n.clientWidth>8)return;n=n.parentNode;}
  DT2_SW={x:t.clientX,y:t.clientY,ts:Date.now()};}
function dtSwipeEnd(e){const s=DT2_SW;DT2_SW=null;if(!s)return;
  if(document.getElementById('modal')?.classList.contains('on'))return;   // über einem offenen Sheet nicht
  const t=e.changedTouches&&e.changedTouches[0];if(!t)return;
  const dx=t.clientX-s.x,dy=t.clientY-s.y;
  if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*2||Date.now()-s.ts>600)return;
  dtShiftDate(dx<0?1:-1);}   // nach links wischen = vorwärts blättern, wie in jedem Kalender
function dtSwipeBind(el){if(!el||el._dt2sw)return;el._dt2sw=1;
  el.addEventListener('touchstart',dtSwipeStart,{passive:true});
  el.addEventListener('touchend',dtSwipeEnd,{passive:true});
  el.addEventListener('touchcancel',()=>{DT2_SW=null;},{passive:true});}
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
  // Ohne Athleten gibt es nichts zu laden: der Coach kommt über go('athletes') mit VIEW_USER=null hierher,
  // und /meals/null antwortet 403. Früher lief das in die Offline-Karte („Offline – nichts verloren"),
  // obwohl der Server sauber geantwortet hat. Ehrlich ist hier der fehlende Athlet – wie in der Analyse.
  if(VIEW_USER==null||VIEW_USER===''){v.innerHTML=`<div class="page on">${dtNoAthleteHTML()}</div>`;return;}
  if(!TODAY)await loadToday();
  const eff=TODAY?.confirmed||TODAY?.suggestion;renderDiet.todayType=(eff?.type==='train')?'training':'rest';
  // Athletenwechsel: alles verwerfen – auch den gewählten Tag. Sonst stünde der Coach im Protokoll des
  // nächsten Athleten plötzlich auf „Vorgestern", ohne es gewollt zu haben.
  if(renderDiet.user!==VIEW_USER){renderDiet.meals=null;renderDiet.foodlog=null;renderDiet.mealsOk=false;renderDiet.foodlogOk=false;renderDiet.mealsSt=null;renderDiet.foodlogSt=null;renderDiet.user=VIEW_USER;
    renderDiet.targets=null;renderDiet.targetsUser=null;renderDiet.targetsSt=null; /* Zielblatt gehört dem Athleten, nicht dem Reiter */ RC_CACHE={};RC_ALL=null;LF_RECENT=null;DT_LF_FAV=null;OPEN_MEALS=new Set();RECIPE_FILTER=null;RECIPE_Q='';DT2_DATE=null;DT2_TPL=null;}
  DIET=renderDiet.todayType;
  if(renderDiet.tab==='cart'&&!_dietSelf())renderDiet.tab='track';
  const tab=renderDiet.tab||'track';
  const cached=!!(renderDiet.meals&&renderDiet.foodlog&&renderDiet.foodlogDate===dtDate());
  if(!(opts.cached&&document.getElementById('dietBody'))||!cached)v.innerHTML=_dietShell(tab);
  if(cached)dietTab(tab); // sofort aus dem Speicher malen, dann still nachladen
  const before=cached?JSON.stringify([renderDiet.meals,renderDiet.foodlog,renderDiet.targets]):null;
  const day=dtDate();
  // Drittes Blatt: das Zielblatt (`GET /api/targets/:uid`). Es hängt am selben Athleten und wird MIT den
  // anderen beiden geholt, nicht danach – sonst wartet die Vorschlagskarte eine Rundreise länger als der
  // Rest der Ansicht. Ein Fehlschlag darf die Ernährungsansicht nicht aufhalten: adpLoad() merkt sich den
  // Status, und ohne Antwort zeichnet die Karte einfach nichts.
  const [mr,fr]=await Promise.all([API.get('/meals/'+VIEW_USER),API.get('/foodlog/'+VIEW_USER+'?date='+day),
    adpLoad().catch(()=>null)]);
  if(!document.getElementById('dietBody'))return; // Nutzer ist inzwischen woanders
  // mealsOk/foodlogOk = „für diesen Athleten ist wirklich eine Antwort MIT Daten angekommen". Nur dann darf
  // ein leerer Stand als Leerzustand gezeichnet werden. mealsSt/foodlogSt merken sich zusätzlich den echten
  // Status, denn es gibt drei Lagen und nicht zwei: 200 = Daten, 0 = kein Netz, 4xx/5xx = der Server hat
  // geantwortet, nur eben abschlägig. Früher fielen alle drei auf „Offline – nichts verloren" zusammen.
  renderDiet.mealsSt=mr.status;renderDiet.foodlogSt=fr.status;
  if(mr.status===200){renderDiet.meals=mr.data?.meals||[];renderDiet.mealsOk=true;}else if(!renderDiet.meals)renderDiet.meals=[];
  if(fr.status===200){renderDiet.foodlog=fr.data||{items:[],summary:{}};renderDiet.foodlogOk=true;}else if(!renderDiet.foodlog)renderDiet.foodlog={items:[],summary:{}};
  renderDiet.foodlogDate=day;
  const after=JSON.stringify([renderDiet.meals,renderDiet.foodlog,renderDiet.targets]);
  if(!cached||before!==after)dietTab(renderDiet.tab||tab);
  if(typeof maybeStartTabTour==='function')try{maybeStartTabTour('diet',{deferred:true});}catch(e){}}
function _dietMark(t){renderDiet.tab=t;
  [['track','dt_track'],['plan','dt_plan'],['recipes','dt_recipes'],['cart','dt_cart']].forEach(([k,id])=>{const el=document.getElementById(id);if(el)el.classList.toggle('on',t===k);});
  // Wem gehört die waagrechte Wischbewegung in diesem Reiter? Die App wischt seit jeher zwischen den
  // FÜNF Haupttabs (shell.js:8–26, Schwelle 70 px). Ohne Absprache liefe im Heute-Reiter beides auf
  // einmal: der Tag springt einen zurück UND die App landet in „Mindset" – gemessen und im Bild
  // festgehalten (12-wischgeste-konflikt.png). Ein Doppeltreffer ist schlimmer als gar keine Geste.
  // shell.js hat für genau diesen Fall eine Tür offen gelassen: `[data-noswipe]` am Startpunkt der
  // Geste schaltet den Tabwechsel ab. Also markiert der Heute-Reiter seinen Körper und NUR er – auf
  // Plan, Rezepte und Einkauf bleibt der Tabwechsel unverändert. Das ist auch die richtige Rangfolge:
  // wo ein Tag dargestellt wird, ist waagrecht „ein Tag weiter" (so machen es MacroFactor und Yazio),
  // und der Tabwechsel bleibt über die Leiste unten erreichbar – ein Tap, wie vorher.
  const body=document.getElementById('dietBody');
  if(body){if(t==='track')body.setAttribute('data-noswipe','');else body.removeAttribute('data-noswipe');}}
function dietTab(t){if(t==='cart'&&!_dietSelf())t='track'; // Einkaufswagen nur im eigenen Konto
  if(!['track','plan','recipes','cart'].includes(t))t='track';
  _dietMark(t);
  if(t==='track')drawTrack();else if(t==='plan')drawDiet();else if(t==='cart')drawCart();else drawRecipes();}
// Protokoll neu laden (nach jeder Änderung) + Home-Cache verwerfen; zeichnet den sichtbaren Reiter neu
async function refreshFoodlog(redraw){const day=dtLogDay();const fr=await API.get('/foodlog/'+VIEW_USER+'?date='+day);
  renderDiet.foodlogSt=fr.status; // damit die Karte nach einem Fehlschlag denselben Grund nennt wie oben
  renderDiet.foodlogLoading=false;
  if(fr.status===200){renderDiet.foodlog=fr.data;renderDiet.foodlogDate=day;renderDiet.foodlogOk=true;}
  if(typeof invalidateView==='function')try{invalidateView('home');}catch(e){}
  _homeFoodPatch(); // Start-Kachel sofort nachziehen, wenn dort geloggt wurde (Home-Chip „Essen loggen")
  if(redraw!==false&&document.getElementById('dietBody')){if(renderDiet.tab==='plan')drawDiet();else if(renderDiet.tab==='track'||!renderDiet.tab)drawTrack();}
  return renderDiet.foodlog;}
// Wenn gerade die Startseite sichtbar ist (Essen aus dem Home-Chip geloggt): deren Ernährungs-Kachel mit
// den frischen Daten neu zeichnen. Alles defensiv – Home gehört WP1, die Funktionen können fehlen.
function _homeFoodPatch(){try{
    // Die Startseite zeigt IMMER den heutigen Tag. Steht der Ernährungs-Tab auf einem Nachtrag-Tag, darf
    // sein Protokoll dort nicht einziehen – sonst stünde „gestern 1.240 kcal" als heutiger Stand auf der
    // Startseite. Der invalidateView-Aufruf oben genügt dann: Home lädt beim nächsten Besuch selbst.
    if(!dtIsToday())return;
    if(!document.getElementById('homeFood')||typeof homePatch!=='function'||typeof homeFoodHTML!=='function')return;
    if(typeof HOME_DATA!=='undefined'&&HOME_DATA&&renderDiet.foodlog)HOME_DATA.foodlog=renderDiet.foodlog;
    homePatch('homeFood',homeFoodHTML());
    if(typeof drawHomeGoals==='function'&&document.getElementById('homeGoals'))homePatch('homeGoals',drawHomeGoals());
    if(typeof homeCache==='function')homeCache();
  }catch(e){}}
async function refreshMeals(redraw){const mr=await API.get('/meals/'+VIEW_USER);renderDiet.mealsSt=mr.status;
  if(mr.status===200){renderDiet.meals=mr.data?.meals||[];renderDiet.mealsOk=true;}
  if(typeof invalidateView==='function')try{invalidateView('home');}catch(e){}
  if(redraw!==false&&document.getElementById('dietBody')){if(renderDiet.tab==='track')drawTrack();else if(renderDiet.tab==='plan')drawDiet();}
  return renderDiet.meals;}

// ===== LEERZUSTAND ODER OFFLINE? =====
// Ein Leerzustand ist eine Aussage über die Daten („du hast noch keinen Plan"). Bei status 0 weiß der Client
// aber gar nichts – und „Noch kein Ernährungsplan · Automatisch erstellen" hat Athleten ohne Netz dazu
// verleitet, ihren vorhandenen Plan neu erzeugen zu lassen. Bis die Offline-Schnappschüsse kommen (Welle A-III)
// steht hier die Wahrheit plus ein Knopf, der es noch einmal versucht.
function dtOfflineNote(what){return emptyState({icon:'devices',title:'Offline – nichts verloren',
  text:(what==='plan'?'Dein Ernährungsplan':what==='cart'?'Dein Einkaufswagen':'Dein Protokoll')+' liegt auf dem Server und ist hier nicht gespeichert. Sobald du wieder Netz hast, ist alles da.',
  btn:{label:'Erneut laden',onclick:'dtReload()'}});}
// Kein Athlet im Blick (Coach nach „Verlassen", VIEW_USER=null): das ist kein Netzproblem, sondern eine
// fehlende Auswahl. Denselben Satz sagt die Analyse, damit beide Bereiche dasselbe meinen.
function dtNoAthleteHTML(){return emptyState({icon:'users',title:'Kein Athlet ausgewählt',
  text:'Wähle zuerst einen Athleten aus, um seine Ernährung zu sehen.',
  btn:{label:'Zu den Athleten',onclick:"go('athletes')"}});}
// Der Server HAT geantwortet, nur nicht mit Daten (4xx/5xx). „Offline" wäre hier gelogen: 403 heißt „nicht
// (mehr) für dich freigegeben", alles andere ist eine Störung auf der anderen Seite.
function dtErrNote(what,st){const wl=what==='plan'?'Der Ernährungsplan':what==='cart'?'Der Einkaufswagen':'Das Protokoll';
  // Die Freigabe-Karte nur im Coach-Blick: im eigenen Konto kann 403 gar nicht am Athleten liegen,
  // dort wäre „Wähle einen Athleten aus deiner Liste" sinnlos – da bleibt es bei der Störungskarte.
  if((st===401||st===403)&&!_dietSelf())return emptyState({icon:'lock',title:'Kein Zugriff',
    text:wl+' dieses Athleten ist für dich nicht freigegeben. Wähle einen Athleten aus deiner Liste.',
    btn:{label:'Zu den Athleten',onclick:"go('athletes')"}});
  return emptyState({icon:'info',title:'Ernährung gerade nicht erreichbar',
    text:wl+' konnte nicht geladen werden'+(st?' (Fehler '+st+')':'')+'. Gespeichert ist alles auf dem Server – versuch es gleich noch einmal.',
    btn:{label:'Erneut laden',onclick:'dtReload()'}});}
// Eine Stelle entscheidet, welche der drei Karten gilt: st 0/unbekannt -> offline, st>=400 -> Serverantwort.
function dtLoadNote(what,st){return (st&&st!==200)?dtErrNote(what,st):dtOfflineNote(what);}
async function dtReload(){const el=document.getElementById('dietBody');if(el)el.innerHTML=skeleton(3);
  const day=dtDate();
  const [mr,fr]=await Promise.all([API.get('/meals/'+VIEW_USER),API.get('/foodlog/'+VIEW_USER+'?date='+day)]);
  renderDiet.mealsSt=mr.status;renderDiet.foodlogSt=fr.status;renderDiet.foodlogLoading=false;
  if(mr.status===200){renderDiet.meals=mr.data?.meals||[];renderDiet.mealsOk=true;}
  if(fr.status===200){renderDiet.foodlog=fr.data||{items:[],summary:{}};renderDiet.foodlogDate=day;renderDiet.foodlogOk=true;}
  if(!document.getElementById('dietBody'))return; // Nutzer ist inzwischen woanders
  dietTab(renderDiet.tab||'track');
  // Der Toast sagt dasselbe wie die Karte: kein Netz nur, wenn wirklich keine Antwort kam.
  if(mr.status!==200&&fr.status!==200)toast((mr.status===0&&fr.status===0)?'Immer noch kein Netz – versuch es gleich noch einmal':'Der Server antwortet gerade nicht – versuch es gleich noch einmal');}

// ===== OHNE NETZ EINGETRAGEN (Outbox aus core.js) =====
// core.js reiht Schreibaufrufe mit {queue:true} bei „kein Netz" (status 0) ein und antwortet 202.
// Beides defensiv abgefragt: fehlt die Outbox (ältere core.js), gilt weiter nur 200 als Erfolg und der
// vierte Parameter wird schlicht ignoriert – dann bleibt es beim alten Fehler-Toast statt einer Ausnahme.
const DIET_QUEUED_TX='Offline gespeichert – wird nachgetragen, sobald du online bist';
function _dietOk(r){return typeof okRes==='function'?okRes(r):r?.status===200;}
function _dietQueued(r){return typeof wasQueued==='function'?wasQueued(r):false;}
// Meldung für alles, was NICHT in die Outbox darf (Menge ändern, Duplizieren-Löschen, Rückgängig, neues
// Lebensmittel): diese Aufrufe hängen an einer Server-ID oder laden danach neu – offline gäbe es beides nicht.
// Bei status 0 sagen wir das beim Namen, sonst bleibt die Meldung des Servers stehen.
function _dietErrTx(r,fallback){return r?.status===0?'Dafür brauchst du kurz Netz':(r?.data?.error||fallback||'Fehler');}
// Optimistisch nachführen: der wartende Eintrag kommt sofort ins Protokoll – ohne Server-ID (id:null) und
// sichtbar als „wird nachgetragen". Ohne ID zeichnet drawTrack() die Zeile bewusst NICHT antippbar: Menge
// ändern, Duplizieren und Entfernen brauchen die ID vom Server, die Zeile würde also etwas versprechen, was
// offline nicht geht. Doppelt kann daraus nichts werden – die nächste erfolgreiche Antwort (refreshFoodlog /
// renderDiet) ersetzt renderDiet.foodlog komplett und damit auch diese Zeile.
function _dietPending(it){try{
    // Nur in ein geladenes Protokoll DIESES Tages schreiben. Ein leeres Gerüst zu erfinden würde auf der
    // Startseite als „heute erst 320 kcal gegessen" gelesen – das wäre eine Lüge, kein optimistischer Stand.
    if(!renderDiet.foodlog||renderDiet.foodlogDate!==dtLogDay())return;
    const fl=renderDiet.foodlog;
    fl.items=(fl.items||[]).concat([Object.assign({id:null,date:dtLogDay(),amount:null,details:null,meal_id:null,kcal:0,fat:0,carbs:0,protein:0},it,{_pending:true})]);
    const s=fl.summary=fl.summary||{};const m=s.macros=s.macros||{};
    s.consumed=(+s.consumed||0)+(+it.kcal||0);
    m.protein=(+m.protein||0)+(+it.protein||0);m.carbs=(+m.carbs||0)+(+it.carbs||0);m.fat=(+m.fat||0)+(+it.fat||0);
    if(s.target){s.remaining=Math.round(s.target-s.consumed);s.pct=Math.round(s.consumed/s.target*100);}
    s.status=null; // erst löschen, dann neu bewerten – kcalVerdict rechnet lokal mit denselben Schwellen wie der Server
    s.status=kcalVerdict(Math.round(s.consumed),Math.round(s.target||0)).status;
    // Eine Plan-Mahlzeit gilt danach als eingetragen, sonst bietet die Karte „Gegessen" dieselbe gleich nochmal an
    if(it.meal_id){s.nextMeal=null;if(Array.isArray(s.loggedMealIds))s.loggedMealIds.push(+it.meal_id);}
    _homeFoodPatch();
    if(document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();
  }catch(e){console.error('[diet] offline-eintrag',e);}}
// Wartende Plan-Mahlzeit als Protokollzeile – nur mit den echten Zahlen aus dem Plan. Ist der Plan nicht
// geladen (Aufruf von der Startseite), bleibt es beim Hinweis-Toast: „0 kcal" wäre schlimmer als keine Zeile.
function _dietPendingMeal(m,mealId,slot,label){if(!m)return;const t=mealTotals(m);
  _dietPending({meal_slot:slot||mealSlotOf(m),food:label||m.label||'Mahlzeit',meal_id:+mealId,
    kcal:Math.round(t.kcal),protein:r1(t.protein),carbs:r1(t.carbs),fat:r1(t.fat),
    details:JSON.stringify((m.items||[]).map(i=>({food:i.food,amount:i.amount,kcal:i.kcal,protein:i.protein,carbs:i.carbs,fat:i.fat})))});}

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
// Roh oder gekocht? (D3) Der Zutatenkatalog in logic.js benennt es seit 2.5.0 ausdrücklich („Reis (roh)") –
// hier steht die Zahl dazu: 145 g roher Reis sind rund 405 g fertiger Reis. Wer 145 g gekochten Reis abwiegt,
// isst ein Viertel der geplanten Kalorien; der Plan wäre rechnerisch richtig und praktisch falsch.
// Die Faktoren sind eine Kopie von `cookedFactor` aus src/logic.js (MEAL_FOODS, dort Zeile 596–625) – die
// Planzeile kommt als fertiger Text aus /api/meals und trägt die Zahl nicht mit. Wer den Katalog dort ändert,
// ändert sie hier mit (in DEFER-A1 vorgemerkt: den Wert mit der Mahlzeit ausliefern, dann fällt die Kopie weg).
// Unter Faktor 1,2 (Kartoffeln) steht bewusst nichts: „145 g roh ≈ 140 g gekocht" ist kein Hinweis, sondern
// Rauschen in jeder Zeile – dass roh abgewogen wird, sagt schon der Name.
const DT_COOKED={'haferflocken':3,'reis':2.8,'vollkornnudeln':2.4,'kartoffeln':0.95,'susskartoffeln':0.95};
function dtCookedTxt(name,amount){const a=parseFloat(amount);if(!(a>0))return '';
  const n=dtNorm(name);if(!/\(roh\)/.test(n))return '';
  const f=DT_COOKED[n.replace(/\(roh\)/g,'').replace(/\s+/g,' ').trim()];
  if(!(f>=1.2))return '';
  return ' · ≈ '+fmtNum(Math.round(a*f/5)*5)+' g gekocht';}
// A-V.5 (DEFER-A1 D3-Rest, Stand nach 2.8.0): `GET /api/meals/:userId` schickt seit 2.8.0 an JEDEM
// Item `cookedG`/`cookedFactor`/`cookedText` – gerechnet aus `cookedEquivalent()` in src/logic.js, der
// einen Quelle. Die PLANZEILE nimmt ab jetzt diese Zahl; `DT_COOKED` ist dort nur noch der Notnagel
// für einen älteren Server. Die Kopie bleibt trotzdem stehen, weil sie einen ZWEITEN Aufrufer hat:
// die Zutatenliste im Protokoll liest `food_log.details`, und dieser JSON-Schnappschuss trägt
// nachgeprüft nur `food/amount/kcal/protein/carbs/fat` – kein `cookedG`. Wer die Kopie ersatzlos
// löscht, nimmt dem Protokoll den Hinweis weg, und dort steht er NACH dem Essen.
// Die Hausformulierung und die 1,2-Schwelle bleiben hier: der Servertext ist länger („roh abgewogen —
// entspricht ca. 330 g gekocht") und würde die Planzeile umbrechen, und unterhalb von Faktor 1,2 ist
// der Hinweis Rauschen („145 g roh ≈ 140 g gekocht"). Übernommen wird die ZAHL, nicht der Satz.
function dtCookedOf(it){if(!it)return '';
  if(it.cookedG!=null&&it.cookedFactor!=null)return (+it.cookedFactor>=1.2)?(' · ≈ '+fmtNum(it.cookedG)+' g gekocht'):'';
  return dtCookedTxt(it.food,it.amount);}
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
// forDay = für welchen Kalendertag? Ohne Angabe: heute. Das ist wichtig geworden, seit der Reiter auch
// vergangene Tage zeigt: die Startseite ruft nextPlanMeal() ohne Argument und meint immer heute – läge im
// Speicher gerade das Protokoll von vorgestern, hätte sie sonst dessen Mahlzeiten als „noch offen" gezeigt.
// Nur wenn das geladene Protokoll GENAU zu diesem Tag gehört, wird lokal gerechnet; sonst zählt allein die
// Server-Angabe summary.nextMeal aus der Antwort, die der Aufrufer mitbringt.
function nextPlanMeal(summary,forDay){
  const day=forDay||today();
  // Der Plan-Cache gehoert immer genau einem Athleten. Wechselt ein Coach den Athleten und landet auf der
  // Startseite, ohne den Ernaehrungs-Tab zu oeffnen, wuerde sonst die Mahlzeit des VORIGEN Athleten angeboten
  // (und „Gegessen“ in dessen Protokoll schreiben). Darum hier hart auf den aktuellen Nutzer pruefen.
  const mine=renderDiet.user===VIEW_USER&&(!renderDiet.foodlogDate||renderDiet.foodlogDate===day);
  const sum=mine?(summary||renderDiet.foodlog?.summary||null):null;
  // Trainings- oder Ruhetag? Für einen vergangenen Tag sagt das die Antwort des Servers (fl.dayType);
  // renderDiet.todayType beschreibt nur den heutigen Tag und wäre beim Nachtragen der falsche Plan.
  const dayType=(mine&&renderDiet.foodlog?.dayType)||renderDiet.todayType||DIET;const meals=mine?planMeals(dayType):[];
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
    <div class="macro"><div class="v">${fmtNum(Math.round(p||0))}<em>g</em></div><div class="k">Eiweiß</div></div>
    <div class="macro"><div class="v">${fmtNum(Math.round(c||0))}<em>g</em></div><div class="k">Kohlenhydrate</div></div>
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
// ===== MAKRO-RINGE STATT BALKEN-WARNUNG (A-IV.4 · Punkt 4) =====
// Vorher: drei Balken, und jeder Wert über dem Ziel wurde amber eingefärbt und mit „+23 g" beziffert.
// Bei einem Fettziel von 29 g (RATE-25-diet H1) hieß das: JEDER normale Tag sah aus wie ein Fehler.
// Eine Warnfarbe, die täglich erscheint, warnt nicht mehr – sie wird überlesen, und mit ihr die echte
// (STRATEGY P4 „Eine Farbe, eine Bedeutung", P6 „Kein Alarm für Normales"). Ein Ring kennt diesen Zustand
// gar nicht: er ist voll, und wer genau wissen will, wie weit darüber, liest die Zahl darunter.
// Der Ring füllt bis 100 %; „drüber" sagt eine ruhige Kleinzeile, in derselben Schriftfarbe wie alles andere.
// Grün heißt hier genau EINE Sache: „das ist gut so". Es gibt genau zwei Fälle, sonst nichts:
//  · im Ziel (95–105 %) -> grüner Ring, Kleinzeile „im Ziel" ebenfalls grün
//  · Eiweiß über dem Ziel -> grüner Ring, Kleinzeile bleibt normal: mehr Eiweiß ist beim Aufbau kein
//    Ausrutscher, sondern der Zweck – aber „105 g drüber" ist eine Menge, keine Auszeichnung
//  · alles andere (darunter ODER darüber) -> die neutrale Farbe, Kleinzeile in normaler Textfarbe
// Keine Warnfarbe. Ein Tag mit 39 g Fett über dem Ziel ist ein normaler Tag, kein Alarm (P6).
// Der Ring trägt NUR die gegessene Zahl – kein `sub`. Grund ist eine Messung, keine Vorliebe: `ring()`
// (home.js) rechnet die Schriftgröße aus der Ringgröße, `sub` mit Faktor 0,12. Bei einem 62-px-Ring waren
// das **7 px** – a11y.mjs hat den Ernährungs-Tab allein dafür rot gemeldet (Mindestgröße 12 px, CRITIC K10).
// Für 12 px im `sub` müsste der Ring 100 px groß sein; drei davon nebeneinander passen nicht. Also wandert
// alles, was kleiner als der Hauptwert ist, unter den Ring – dort bestimmt diese Datei die Größe (--t-xs,
// 12 px) und nicht eine Formel in einer fremden Datei. Die Ringgröße 70 hebt zugleich den Hauptwert von
// 11 auf 13 px (70 × 0,18).
// Drei Zeilen darunter, in der Reihenfolge, in der man sie braucht:
//   „Eiweiß"      – worum geht es
//   „20 / 157 g"  – die vollständige Zahl, die schon die Balken hatten (für den Profi bleibt nichts weg)
//   „137 g offen" – was daraus folgt, in Worten statt in einer Warnfarbe
function dtMacroRing(label,val,target,color){const v=Math.round(val||0),t=Math.round(target||0);
  const pct=t?Math.min(1,v/t):0;
  const over=!!(t&&v>t);
  const hit=!!(t&&v>=t*0.95&&v<=t*1.05);
  const good=hit||(over&&label==='Eiweiß');
  const col=good?'var(--green)':color;
  const vals=t?fmtNum(v)+' / '+fmtNum(t)+' g':fmtNum(v)+' g';
  const note=!t?'kein Ziel':hit?'im Ziel':over?fmtNum(v-t)+' g drüber':fmtNum(t-v)+' g offen';
  const a11y=`${label} ${fmtNum(v)}${t?' von '+fmtNum(t)+' Gramm':' Gramm'}`+
    (!t?'':hit?', im Ziel':over?', '+fmtNum(v-t)+' Gramm darüber':', '+fmtNum(t-v)+' Gramm offen');
  return `<div class="dt-mring${good?' good':''}${hit?' hit':''}" role="img" aria-label="${esc2(a11y)}">
    ${ring(pct,{size:70,stroke:8,color:col,label:fmtNum(v)})}
    <div class="mr-l">${esc2(label)}</div>
    <div class="mr-v">${esc2(vals)}</div>
    <div class="mr-s">${esc2(note)}</div></div>`;}
// Die drei Ringe als Reihe – eine Stelle, damit Heute-Karte und spätere Aufrufer dieselbe Zeile zeigen.
// Alle drei tragen dieselbe neutrale Farbe (`--ink`). Eigene Hues je Makro wären hübsch, aber in dieser
// Karte liegt darüber schon der Kalorienring, der amber wird, wenn der Tag über dem Ziel liegt – ein
// amberner Kohlenhydrat-Ring daneben hieße dann dasselbe Amber an zwei Stellen mit zwei Bedeutungen
// (P4). Und jedes rote Element zählt gegen das Akzent-Budget der Welle. Also: neutral ist der Normalfall,
// Grün ist die einzige Aussage – „getroffen". Welcher Ring welches Makro ist, sagt die Beschriftung.
function dtMacroRings(mac,T){return `<div class="dt-mrings">
    ${dtMacroRing('Eiweiß',mac.protein||0,T.protein,'var(--ink)')}
    ${dtMacroRing('Kohlenhydrate',mac.carbs||0,T.carbs,'var(--ink)')}
    ${dtMacroRing('Fett',mac.fat||0,T.fat,'var(--ink)')}</div>`;}
// „Laut Plan als Nächstes" – Karte für Heute und Plan (nur wenn ein Plan existiert).
// Am gewählten Tag: „als Nächstes" gilt nur für heute – wer vorgestern nachträgt, hat nichts mehr vor sich,
// sondern etwas offen. Dasselbe Werkzeug, ehrlich benannt.
// nextMealCard.planCTA merkt sich, ob diese Karte gerade einen GEFÜLLTEN Primär-Knopf („Gegessen")
// gezeichnet hat. drawTrack liest das unmittelbar danach und stuft „Essen hinzufügen" entsprechend ein –
// so steht auf dem Heute-Reiter zu jedem Zeitpunkt GENAU EINE rot gefüllte Fläche (STRATEGY P4, Akzent-
// Budget der Welle). RATE-25-diet hatte im Design-Abzug genau das notiert: „zwei gestapelte vollbreite
// rote Primär-Buttons ‚Gegessen' + ‚Essen hinzufügen' direkt untereinander" – zwei gleich laute Knöpfe
// sagen dem Auge nicht, welcher gemeint ist. Kein Tap ändert sich dadurch, nur das Gewicht.
function nextMealCard(){const day=dtDate();const past=!dtIsToday();
  nextMealCard.planCTA=false;
  const n=nextPlanMeal(null,day);const self=_dietSelf();
  const tagTx=past?('am '+dtDayLabelIn(day)):'für heute';
  // „Noch kein Ernährungsplan" nur, wenn wirklich eine Antwort da war – sonst die ehrliche Offline-Karte
  if(!n&&!renderDiet.mealsOk)return `<div class="mb-3">${dtLoadNote('plan',renderDiet.mealsSt)}</div>`;
  if(!n)return `<div class="rows mb-3"><div class="row tap" role="button" tabindex="0" onclick="dietTab('plan')"><div class="r-ic">${icon('utensils')}</div><div class="rl">Noch kein Ernährungsplan<small>Automatisch aus ${self?'deinem':'dem'} Profil erstellen</small></div><div class="rr"></div></div></div>`;
  if(n.logged)return `<div class="card next-meal done mb-3"><div class="between"><div class="eyebrow tone-green">Laut Plan</div><span class="caption">${n.done} von ${n.total} eingetragen</span></div>
    <div class="h3 mt-1">Alle Mahlzeiten eingetragen</div><div class="meta">${self?(past?'Der Plan ist '+esc2(tagTx)+' vollständig nachgetragen.':'Stark – der Plan ist für heute komplett.'):'Der Plan ist '+esc2(tagTx)+' komplett eingetragen.'}</div></div>`;
  const m=planMeals((renderDiet.foodlog?.dayType)||renderDiet.todayType||DIET).find(x=>x.id===n.mealId);const kc=n.kcal;
  nextMealCard.planCTA=self;   // ab hier steht „Gegessen" als gefüllter Primär-Knopf in der Karte
  return `<div class="card next-meal mb-3" id="nextMealCard">
    <div class="between"><div class="eyebrow">${past?'Laut Plan noch offen':'Laut Plan als Nächstes'}</div>${n.total?`<span class="caption">${n.done} von ${n.total} eingetragen</span>`:''}</div>
    <div class="h3 mt-1">${esc2(n.label)}</div>
    <div class="meta">${fmtNum(kc)} kcal · ${fmtNum(n.protein)} g P${n.preview?' · '+esc2(n.preview):''}</div>
    ${self?`<div class="nm-acts">
      <button class="btn block" onclick="logFromMeal(${n.mealId})">${icon('check',18)} Gegessen</button>
      ${m?`<button class="btn sm sec" onclick="swapMeal(${m.id},${Math.round(kc)},'${esc(m.label||'')}')">${icon('refresh',16)} Tauschen</button>`:''}
    </div>`:''}</div>`;}
// D1: Ohne Geburtsjahr rechnet der Server das Kalorienziel ohne Alter – das Ergebnis ist ein Startwert,
// keine gerechnete Zahl. Bis 2.4.0 stand „2.584 kcal“ trotzdem da wie ein Messwert. Der Server liefert den
// ehrlichen Satz als summary.targetsNote mit (GET /api/foodlog, GET /api/home); angezeigt wurde er nirgends.
// Im Coach-Blick gilt derselbe Sachverhalt, nur nicht in der Du-Form des Athleten.
function dtTargetsNote(sum){
  const note=(sum&&typeof sum.targetsNote==='string')?sum.targetsNote.trim():'';
  if(!note&&!(sum&&sum.dobMissing))return '';
  const txt=_dietSelf()?(note||'Startwert – trag dein Geburtsjahr ein, dann rechnen wir genauer.')
    :'Startwert – ohne Geburtsjahr rechnet das Ziel ohne Alter.';
  return `<div class="dh-note">${icon('info',16)}<span>${esc2(txt)}</span></div>`;}
// Kurzform für den Tagtyp-Chip: „Trainingstag · 2.584 kcal (Startwert)" statt einer glatten Behauptung.
function dtStartwert(sum){return (sum&&sum.dobMissing)?' (Startwert)':'';}
// ===== ADAPTIVE ERNÄHRUNGSZIELE (B-I.4 · Präfix `adp`) =====
// Bis 2.9.0 war das Kalorienziel eine FORMEL: Gewicht, Größe, Alter, Ziel – einmal gerechnet, dann steht sie.
// Das ist ein Startwert, keine Messung. Was ein Mensch wirklich verbraucht, steht nicht in der Formel, sondern
// in zwei Reihen, die längst in der Datenbank liegen: `checkins.weight` und `food_log`. Ändert sich das Gewicht
// bei bekannter Aufnahme nicht, IST die Aufnahme die Erhaltung – das ist der Kern von MacroFactor
// (RESEARCH-25-apps, Muster 13 „Ausgaben-Algorithmus statt Formel"; RATE-25-diet, 12/10-Idee 1).
//
// Diese Datei zeigt das Ergebnis, sie rechnet es nicht: gerechnet wird in `src/logic.js`
// (`tdeeFromTrend` → {tdee, confidence, holding}, `adaptTargets` → höchstens ±100 kcal je Woche samt
// Begründungssatz), verdrahtet wird es in `src/server.js` (Wochen-Job, `target_history`). Hier gelten drei
// Regeln, und sie sind der ganze Unterschied zu „die App hat halt was geändert":
//
//  P10 · Die App SCHLÄGT VOR, sie ändert nicht. Auch bei eingeschaltetem Schalter steht die Anpassung als
//        Karte da – „Übernehmen / Behalten". Es gibt keinen Pfad, auf dem ein Ziel still wandert.
//  P3  · Jede Zahl trägt genau EINEN Satz, woher sie kommt, und der ist nicht abschaltbar. Technisch
//        erzwungen: `adpNumbers()` gibt gar nichts zurück, wenn `adpWhy()` leer ist. Keine Herkunft,
//        keine Zahl – lieber schweigen als behaupten.
//  Ehrlichkeit · `holding` (zu wenige Log-Tage) wird GEZEIGT, nicht verschwiegen. Eine Woche ohne
//        Anpassung ist eine Aussage über die Daten, kein Grund, die Karte wegzulassen.
//
// Standard ist AUS (`users.target_mode='formel'`). Wer nichts tut, bekommt weiter die Formel und keine
// Vorschläge – das ist die Voreinstellung, die niemanden überrascht.
//
// SERVER-VERTRAG · GEMESSEN STATT ANGENOMMEN (Nachbesserung 15.09.2026)
// Bis hierher war diese Datei gegen einen Vertrag geschrieben, den Paket B-I.2 nie ausgeliefert hat:
// sie las `GET /api/foodlog/:id` → `summary.adapt` und schrieb auf `POST /api/targets/adapt` bzw.
// `PUT /api/profile {target_mode}`. Nachgemessen gegen den laufenden Server (Port 3835):
//   GET  /api/foodlog/2                         -> summary OHNE Schlüssel `adapt` (19 Schlüssel, keiner heißt so)
//   POST /api/targets/adapt                     -> 404 {"error":"Unbekannte Route"}
//   PUT  /api/profile {"target_mode":"adaptiv"}  -> 200 {"ok":true} … und danach `mode:"formel"`
// Der Athlet sah also nie eine Vorschlagskarte, obwohl der Vorschlag längst in `target_history` lag,
// und der Schalter meldete Erfolg, ohne etwas zu speichern. Ausgeliefert ist stattdessen ein eigener,
// vollständiger Satz Routen – und DIE werden jetzt benutzt (alle vier gemessen, siehe DONE-Bericht):
//   GET  /api/targets/:uid   -> { available, mode:'formel'|'adaptiv', modes, hasCoach, modeText,
//                                 current:{kcal,protein,carbs,fat,source,reason,week_start,id,formula},
//                                 tdee, tdeeAt,
//                                 pending:{id,week_start,kcal,protein,carbs,fat,source,reason,
//                                          status,approved_by,created_at,decided_at,needsCoach}|null,
//                                 history:[…20 Zeilen…] }
//   POST /api/targets/:uid/mode    {mode:'formel'|'adaptiv'}  – der Schalter
//   POST /api/targets/:uid/decide  {id, accept:true|false}    – „Übernehmen" / „Behalten"
//   POST /api/targets/:uid/revert  {}                         – „Rückgängig"
// `adpMap()` bildet diese Antwort auf die vier Zustände dieser Datei ab; geladen wird sie in `adpLoad()`
// zusammen mit Plan und Protokoll. Antwortet der Server 404 (ältere Fassung) oder gar nicht, bleibt
// `adpRaw()` null und diese Datei zeichnet NICHTS – der Reiter verliert nur die Karte.
// Die ALTE Form (`summary.adapt`, dieselbe Form darf `/api/home` mitschicken) wird weiterhin gelesen und
// gewinnt, wenn ein Server sie doch mitschickt: sie trägt mehr Herkunft (Ø kcal, Logtage, Gewichtstrend)
// als `GET /api/targets`, und P3 lebt von genau dieser Herkunft. Ihr Aufbau:
//   adapt = { mode, state:'proposal'|'coach'|'applied'|'holding'|'none', id, weekStart, reason,
//             reasonCoach, from:{kcal,…}, to:{kcal,…}, tdee, confidence, weightKg, weightDelta,
//             avgKcal, loggedDays, needDays, days, hasCoach, coachName }
// WAS `GET /api/targets` NICHT LIEFERT: den Zustand `holding` (zu wenige Logtage → keine Anpassung).
// Er entsteht in `targetsWeeklyFor()` und wird nur an den Aufrufer von `POST …/run` zurückgegeben,
// nirgends gespeichert. Raten wäre hier das Schlimmste: „zu wenig gelogged" und „die Rechnung fand
// keinen Änderungsbedarf" sehen von außen gleich aus, und ein falscher Vorwurf wiegt schwerer als ein
// fehlender Satz. Also zeigt die Karte den Zustand nur, wenn der Server ihn schickt (`holding` in
// `summary.adapt` oder in der Antwort von `/targets/:uid`) – vermerkt in DEFER-B1 als Bitte an B-I.2.
// Der Satz aus dem Auftrag, wörtlich. „gelogged" ist kein schönes Deutsch, aber es ist das Wort, das im
// Haus benutzt wird („Essen loggen" steht so auf der Startseite) – und ein Satz, der klingt wie die App
// sonst spricht, wird gelesen. Im Coach-Blick steht dieselbe Tatsache ohne Du-Form.
const ADP_HOLD_TX='Zu wenig gelogged diese Woche – ich lasse dein Ziel stehen.';
const ADP_HOLD_TX_COACH='Zu wenige Einträge in dieser Woche – das Ziel bleibt stehen.';
// ===== LADEN =====
// Die Antwort von `GET /api/targets/:uid` liegt roh in `renderDiet.targets`, zusammen mit dem Athleten,
// für den sie geholt wurde. Der Athletenwechsel im Coach-Blick verwirft sie (renderDiet oben) – sonst
// stünde der Vorschlag des einen Athleten in der Ansicht des nächsten.
async function adpLoad(){
  const u=(typeof VIEW_USER!=='undefined')?VIEW_USER:null;
  if(u==null||u==='')return null;
  const r=await API.get('/targets/'+u);
  renderDiet.targetsSt=r.status;
  // 200 = frische Wahrheit. 404/403 = dieser Server oder dieses Konto hat die Funktion nicht: dann
  // lieber gar nichts zeigen als etwas Altes. status 0 (kein Netz) lässt den letzten Stand stehen –
  // er ist eine Minute alt und immer noch das, was der Server zuletzt gesagt hat.
  if(r.status===200&&r.data&&typeof r.data==='object'){renderDiet.targets=r.data;renderDiet.targetsUser=u;}
  else if(r.status>0){renderDiet.targets=null;renderDiet.targetsUser=u;}
  return renderDiet.targets;}
// Die rohe Antwort – aber nur, wenn sie zu dem Athleten gehört, der gerade auf dem Schirm ist.
function adpRaw(){const u=(typeof VIEW_USER!=='undefined')?VIEW_USER:null;
  const t=renderDiet.targets;
  return (t&&typeof t==='object'&&renderDiet.targetsUser===u)?t:null;}
// Der Vorgänger einer geltenden Zeile: die zuletzt ABGELÖSTE aus der Historie. Nach Id zu sortieren wäre
// falsch – der Ausgangswert wird beim ersten „Übernehmen" nachgetragen und hat deshalb eine höhere Id als
// die Zeile, die er ablöst (derselbe Grund steht in der revert-Route im Server).
function adpPrevRow(hist,curId){
  const l=(hist||[]).filter(r=>r&&r.status==='abgeloest'&&r.id!==curId)
    .sort((a,b)=>String(b.decided_at||'').localeCompare(String(a.decided_at||''))||(b.id-a.id));
  return l.length?{kcal:l[0].kcal,protein:l[0].protein,carbs:l[0].carbs,fat:l[0].fat}:null;}
// „Diese Woche angepasst" darf nur dastehen, solange es stimmt. Eine Anpassung aus dem Juli ist kein
// Kartenthema mehr – sie steht im Sheet unter „Diese Woche angepasst"… also: neun Tage Fenster, dann
// verschwindet die Karte von selbst, auch wenn nie jemand „Passt" getippt hat.
function adpFreshWeek(ws){if(!ws)return false;
  const d=dtDayDiff(String(ws),today());return d>=0&&d<=9;}
// Die Antwort des Servers auf die vier Zustände dieser Datei abbilden. Sie rechnet nichts um und erfindet
// nichts: jedes Feld kommt aus der Antwort, und was fehlt, bleibt leer (siehe adpWhy/adpNumbers, P3).
function adpMap(t){
  if(!t||typeof t!=='object')return null;
  const mode=(t.mode==='adaptiv')?'adaptiv':'formel';
  const hasCoach=!!t.hasCoach;
  const pend=(t.pending&&typeof t.pending==='object'&&t.pending.status==='vorschlag')?t.pending:null;
  const cur=(t.current&&typeof t.current==='object')?t.current:null;
  const four=r=>r?{kcal:r.kcal,protein:r.protein,carbs:r.carbs,fat:r.fat}:null;
  let a=null;
  if(pend){
    // Wartet der Vorschlag auf den Coach? Der Server sagt es in `needsCoach`; die zweite Bedingung ist
    // nur der Gürtel zum Hosenträger, falls eine ältere Fassung das Feld nicht mitschickt.
    const wartet=(pend.needsCoach===true)||(pend.needsCoach==null&&mode==='adaptiv'&&hasCoach);
    a={state:wartet?'coach':'proposal',id:pend.id,weekStart:pend.week_start,reason:pend.reason,
       from:four(cur),to:four(pend)};
  }else if(cur&&cur.id&&cur.source==='adaptiv'&&adpFreshWeek(cur.week_start)){
    a={state:'applied',id:cur.id,weekStart:cur.week_start,reason:cur.reason,
       from:adpPrevRow(t.history,cur.id),to:four(cur)};
  }else if(t.holding){      // schickt der Server den Zustand doch mit, zeigt ihn die Karte (siehe oben)
    const h=(typeof t.holding==='object')?t.holding:{};
    a={state:'holding',id:null,weekStart:h.weekStart||h.week_start||null,reason:h.reason||null,
       loggedDays:h.loggedDays,needDays:h.needDays};
  }else return null;
  a.mode=mode;a.hasCoach=hasCoach;
  a.tdee=(t.tdee==null||t.tdee==='')?null:+t.tdee;
  a.tdeeAt=t.tdeeAt||null;
  a.tdeeTrend=true;   // Marke: dieser Verbrauch kommt aus tdeeFromTrend (Gewicht + Protokoll), s. adpWhy
  return a;}
// Die Karten-Daten: die alte Form gewinnt, wenn ein Server sie schickt (mehr Herkunft), sonst die
// abgebildete Antwort von `GET /api/targets/:uid`.
function adpData(){const a=renderDiet.foodlog?.summary?.adapt;
  if(a&&typeof a==='object')return a;
  return adpMap(adpRaw());}
function adpProfile(){return (_dietSelf()?ME:(VIEW_USER_PROFILE||ME))||{};}
// Der Schalterzustand kommt vom Server (auch wenn es GAR KEINEN Vorschlag gibt – deshalb liest er die
// rohe Antwort und nicht die Karte), sonst aus dem Profil, sonst 'formel'. Voreinstellung AUS gilt an
// jeder dieser drei Stellen.
function adpMode(){const t=adpRaw();
  if(t&&(t.mode==='adaptiv'||t.mode==='formel'))return t.mode;
  const a=adpData();
  if(a&&(a.mode==='adaptiv'||a.mode==='formel'))return a.mode;
  return adpProfile().target_mode==='adaptiv'?'adaptiv':'formel';}
function adpOn(){return adpMode()==='adaptiv';}
function adpHasCoach(){const t=adpRaw();
  if(t&&typeof t.hasCoach==='boolean')return t.hasCoach;
  const a=adpData();
  if(a&&typeof a.hasCoach==='boolean')return a.hasCoach;
  return !!adpProfile().coach_id;}
// Der Satz unter dem Schalter kommt vom Server (`modeText`), damit Ernährungs- und Coach-Ansicht nicht
// zwei verschiedene Versprechen geben. Er ist in Du-Form geschrieben – im Coach-Blick gilt er deshalb nicht.
function adpModeText(){const t=adpRaw();
  return (_dietSelf()&&t&&typeof t.modeText==='string')?t.modeText.trim():'';}
// Vier Zustände und ein fünfter, der nichts zeichnet. Fremde Schreibweisen werden mitgenommen, damit ein
// Namensunterschied zwischen Paket B-I.2 und dieser Datei nicht zu einer leeren Ansicht führt.
function adpState(a){a=a||adpData();if(!a)return 'none';
  const s=String(a.state||'').toLowerCase();
  if(s==='holding'||(!s&&a.holding===true))return 'holding';
  if(s==='proposal'||s==='proposed'||s==='vorschlag')return 'proposal';
  if(s==='coach'||s==='waiting_coach'||s==='pending_coach')return 'coach';
  if(s==='applied'||s==='angewendet')return 'applied';
  return 'none';}
function adpFrom(a){return (a&&a.from&&typeof a.from==='object')?a.from:{};}
function adpTo(a){return (a&&a.to&&typeof a.to==='object')?a.to:{};}
function adpKcalFrom(a){return Math.round(+adpFrom(a).kcal||0);}
function adpKcalTo(a){return Math.round(+adpTo(a).kcal||0);}
// P3, die eine Stelle: WOHER kommt die Zahl? Gebaut wird der Satz nur aus dem, was der Server wirklich
// geschickt hat – fehlt alles, bleibt er leer, und dann zeigt die Karte auch keine Zahl (siehe adpNumbers).
// „Geschätzt" steht ausdrücklich dabei: ein Verbrauch ist eine Schätzung aus zwei Reihen, kein Messwert.
function adpWhy(a){a=a||adpData();if(!a)return '';
  const self=_dietSelf();
  const tdee=Math.round(+a.tdee||0);
  const avg=Math.round(+a.avgKcal||0);
  const logged=Math.round(+a.loggedDays||0);
  const days=Math.round(+a.days||0);
  const kg=(+a.weightKg>0)?fmtNum(+a.weightKg,1):'';
  const dwRaw=(a.weightDelta==null||a.weightDelta===''||isNaN(+a.weightDelta))?null:+a.weightDelta;
  const quellen=[];
  if(kg)quellen.push((self?'deinem':'dem')+' Gewichtsverlauf ('+kg+' kg'+
    (dwRaw==null?'':', '+(dwRaw>0?'+':dwRaw<0?'−':'±')+fmtNum(Math.abs(dwRaw),1)+' kg'+(days?' in '+pl(days,'Tag','Tagen'):''))+')');
  if(avg&&logged)quellen.push('Ø '+fmtNum(avg)+' kcal an '+pl(logged,'eingetragenen Tag','eingetragenen Tagen'));
  else if(avg)quellen.push('Ø '+fmtNum(avg)+' kcal aus dem Protokoll');
  if(!tdee&&!quellen.length)return '';
  const kopf=tdee?('Geschätzter Verbrauch '+fmtNum(tdee)+' kcal'):'Gerechnet';
  if(quellen.length)return kopf+' – aus '+quellen.join(' und ')+'.';
  // `GET /api/targets/:uid` schickt die Einzelposten nicht mit – nur die Zahl und den Zeitpunkt. Die
  // beiden Reihen, aus denen sie entsteht, stehen trotzdem fest (tdeeFromTrend: Gewicht + Protokoll),
  // und `tdeeTrend` sagt, dass diese Zahl wirklich von dort kommt. Also wird die Herkunft benannt,
  // aber ohne Zahlen, die hier niemand belegen kann.
  if(tdee&&a.tdeeTrend){
    const stand=(typeof a.tdeeAt==='string'&&a.tdeeAt.length>=10)?(' (Stand '+dtDateShort(a.tdeeAt.slice(0,10))+')'):'';
    return kopf+' – aus '+(self?'deinem Gewichtsverlauf und deinen Einträgen':'dem Gewichtsverlauf und den Einträgen')+stand+'.';}
  return kopf+'.';}
// Die Zahlen der Anpassung – aber nur MIT Herkunftssatz. Das ist P3 als Code und nicht als Vorsatz:
// wer diese Funktion aufruft, bekommt entweder beides oder gar nichts.
function adpNumbers(a){a=a||adpData();if(!a)return '';
  const why=adpWhy(a);if(!why)return '';
  const from=adpKcalFrom(a),to=adpKcalTo(a);
  if(!to)return '';
  const T=adpTo(a);
  const makros=[T.protein,T.carbs,T.fat].some(v=>+v>0)
    ?`<div class="adp-mac">Eiweiß ${fmtNum(Math.round(+T.protein||0))} g · Kohlenhydrate ${fmtNum(Math.round(+T.carbs||0))} g · Fett ${fmtNum(Math.round(+T.fat||0))} g</div>`:'';
  const d=from?to-from:0;
  const delta=(from&&d)?`<span class="adp-d">${d>0?'+':'−'}${fmtNum(Math.abs(d))} kcal</span>`:'';
  return `<div class="adp-nums">${from?`<span class="adp-old">${fmtNum(from)}</span><span class="adp-arrow" aria-hidden="true">→</span>`:''}<span class="adp-new">${fmtNum(to)} kcal</span>${delta}</div>${makros}${adpTagTypLine()}`;}
// GEMESSEN: Die Zielzeile ist die TRAININGSTAGS-Zahl – `currentTarget` im Server rechnet mit
// `planTargets` und dem Tagtyp „training",
// und beim Übernehmen leitet der Server das Ruhetagsziel anteilig daraus ab (Konto 2:
// 3.017/2.600 vorher, 2.920/2.738 nachher). Auf einem Ruhetag steht dann „−97 kcal" auf der Karte und
// 2.600 → 2.738 am Ring – beides stimmt, aber nur mit diesem Satz dazwischen. Er steht immer da und
// nicht nur an Ruhetagen: die Zahl heißt an jedem Tag dasselbe, und ein Hinweis, der mal da ist und mal
// nicht, wirkt wie eine Ausrede.
// Im Coach-Blick ohne Du-Form – dort ist vom Athleten die Rede, nicht vom Leser.
function adpTagTypLine(){return `<div class="adp-mac adp-day">${esc2(_dietSelf()
  ?'Die Zahl gilt für Trainingstage – dein Ruhetagsziel rechnet die App im selben Verhältnis mit.'
  :'Die Zahl gilt für Trainingstage – das Ruhetagsziel rechnet die App im selben Verhältnis mit.')}</div>`;}
// Der Herkunftssatz als eigene Zeile. Er steht UNTER der Begründung, nicht zwischen Zahl und Begründung:
// zuerst die Zahl, dann was sie bedeutet, dann woher sie kommt. Wer nur die ersten zwei Zeilen liest,
// hat die Entscheidung; wer nachrechnen will, findet die Quelle direkt darunter.
function adpWhyLine(a){const why=adpWhy(a);if(!why)return '';
  return `<div class="adp-why">${icon('info',15)}<span>${esc2(why)}</span></div>`;}
// Zahl + Begründung + Herkunft als ein Stück – dieselbe Reihenfolge in der Karte und im Sheet.
// Die Zahl kommt aus adpNumbers() und die gibt es nur MIT Herkunftssatz (P3, siehe dort).
function adpBody(a){a=a||adpData();if(!a)return '';
  const nums=adpNumbers(a);
  // adaptTargets() schreibt seinen Satz in Du-Form („Dein Gewicht ist 3 Wochen gleich geblieben") – im
  // Coach-Blick spräche die App damit den Coach an, obwohl vom Athleten die Rede ist. Schickt der Server
  // eine Coach-Fassung mit (`reasonCoach`), gilt sie dort; sonst bleibt der Satz stehen, wie er ist.
  const reason=String(((!_dietSelf()&&a.reasonCoach)||a.reason)||'').trim();
  if(!nums&&!reason)return '';
  return nums+(reason?`<div class="adp-reason">${esc2(reason)}</div>`:'')+(nums?adpWhyLine(a):'');}
// Antwort merken: dieselbe Woche mit denselben Zahlen wird nicht zweimal gefragt. Ändert der nächste
// Wochenlauf etwas, ist der Schlüssel ein anderer – dann fragt die App wieder. Genau wie bei dtAskKey.
// ZWEI Schlüssel, nicht einer – GEMESSEN BEIM BAUEN: die Frage („Übernehmen / Behalten") und die
// Kenntnisnahme danach („Passt") betreffen dieselbe Woche mit derselben Zahl. Mit einem einzigen
// Schlüssel verschluckte das „Übernehmen" seine eigene Erfolgskarte: die Antwort war gemerkt, und die
// Karte „Diese Woche angepasst · Passt / Rückgängig" erschien nie – der Widerruf war einen Wimpernschlag
// nach dem Ja nicht mehr erreichbar. `tag='ok'` trennt die beiden Fälle.
function adpKey(a,tag){const u=(typeof VIEW_USER!=='undefined'&&VIEW_USER!=null)?VIEW_USER:0;
  return 'be_adapt_'+(tag?tag+'_':'')+u+'_'+String((a&&(a.weekStart||a.week_start))||'')+'_'+adpKcalTo(a);}
function adpAnswered(a){try{return !!localStorage.getItem(adpKey(a));}catch(e){return false;}}
function adpRemember(a){try{localStorage.setItem(adpKey(a),'1');}catch(e){}}
function adpDone(a){try{return !!localStorage.getItem(adpKey(a,'ok'));}catch(e){return false;}}
function adpRememberDone(a){try{localStorage.setItem(adpKey(a,'ok'),'1');}catch(e){}}
// Alle Zielrouten hängen am Athleten, dessen Ansicht gerade offen ist – derselbe Nutzer wie in
// `/foodlog/<uid>` eine Zeile darüber. Der Server prüft ihn ein zweites Mal (`canAccessPersonal`,
// `ownRecordOnly`); hier steht er, damit der Coach-Blick nicht versehentlich am eigenen Konto dreht.
function adpPath(sub){const u=(typeof VIEW_USER!=='undefined'&&VIEW_USER!=null&&VIEW_USER!=='')?VIEW_USER
  :((typeof ME==='object'&&ME)?ME.id:0);
  return '/targets/'+u+(sub||'');}
// ===== DIE KARTE =====
// Sie steht auf dem Heute-Reiter zwischen Hero und Plan-Karte – über der Plan-Mahlzeit, weil eine
// Zielanpassung höchstens einmal pro Woche auftaucht und dann die wichtigere Entscheidung ist.
// Sie trägt bewusst KEINE rot gefüllte Fläche: der eine Akzent des Reiters gehört „Gegessen"
// bzw. „Essen hinzufügen" (STRATEGY P4). Eine Rückfrage ist nie der Primär-CTA einer Seite.
// Nur am heutigen Tag: beim Nachtragen von vorgestern gehört der Bildschirm dem Protokoll dieses
// Tages, nicht einer Entscheidung über die kommende Woche.
function adpCard(){
  if(!dtIsToday())return '';
  const a=adpData();if(!a)return '';
  const st=adpState(a);if(st==='none')return '';
  const self=_dietSelf();
  if(st==='holding')return adpHoldCard(a,self);
  const body=adpBody(a);
  // Weder Zahl noch Begründung: dann hat die App nichts zu sagen und sagt nichts.
  if(!body)return '';
  const head=st==='applied'?'Diese Woche angepasst':'Wöchentliche Anpassung';
  const pill=st==='coach'?`<span class="pill neutral">${self?'wartet auf deinen Coach':'wartet auf deine Freigabe'}</span>`:'';
  let foot='';
  if(st==='coach'){
    const bleibt=adpKcalFrom(a);
    foot=`<div class="adp-state">${esc2(self
      ?('Dein Coach'+(a.coachName?' '+String(a.coachName):'')+' sieht diesen Vorschlag und gibt ihn frei'+(bleibt?' – bis dahin bleibt dein Ziel bei '+fmtNum(bleibt)+' kcal.':'.'))
      :('Der Vorschlag liegt zur Freigabe bereit'+(bleibt?' – bis dahin gilt weiter '+fmtNum(bleibt)+' kcal.':'.')))}</div>`;
  }else if(!self){
    foot=`<div class="adp-state">${esc2(st==='applied'?'Der Athlet hat diese Anpassung übernommen.':'Der Athlet entscheidet selbst, ob er den Vorschlag übernimmt.')}</div>`;
  }else if(st==='applied'&&adpDone(a)){
    // „Passt" getippt: die Karte hat ihren Zweck erfüllt. Sie verschwindet ganz – nachlesbar bleibt der
    // Vorgang im Sheet („Wie das funktioniert"). Vorher stand sie hier bis in alle Ewigkeit, weil der
    // applied-Zweig als einziger nicht nach der Antwort gefragt hat.
    return '';
  }else if(st==='applied'){
    foot=`<div class="adp-acts"><button class="btn sm sec" onclick="adpDismiss()">Passt</button>
      <button class="btn sm ghost" onclick="adpUndo()">Rückgängig</button>
      <small>${esc2(adpKcalFrom(a)?('„Rückgängig" setzt dein Ziel wieder auf '+fmtNum(adpKcalFrom(a))+' kcal.')
        :'„Rückgängig" holt dein vorheriges Ziel zurück.')}</small></div>`;
  }else if(!adpAnswered(a)&&!adpNumbers(a)){
    // P3 bis zum Ende gedacht: Ohne Herkunftssatz zeigt adpNumbers() die Zahl nicht – dann darf sie auch
    // nicht in der Fußzeile eines Knopfes stehen („Übernehmen trägt 2.720 kcal ein"), und erst recht darf
    // die App nicht um ein Ja für eine Zahl bitten, die sie nicht erklären kann. Gemessen in
    // 15-sonde-randfaelle.png (Fall a): genau das stand vorher da. Also: kein Knopf, sondern die Wahrheit.
    foot=`<div class="adp-state">Woher diese Zahl kommt, kann ich dir gerade nicht sagen – deshalb schlage ich sie auch nicht vor. Dein Ziel bleibt, wie es ist.</div>`;
  }else if(!adpAnswered(a)){
    foot=`<div class="adp-acts"><button class="btn sm sec" onclick="adpApply()">Übernehmen</button>
      <button class="btn sm ghost" onclick="adpKeep()">Behalten</button>
      <small>„Übernehmen" trägt ${fmtNum(adpKcalTo(a))} kcal als dein Ziel ein. „Behalten" ändert nichts.</small></div>`;
  }else{
    foot=`<div class="adp-state">${esc2(adpKcalFrom(a)
      ?('Du hast dich entschieden: dein Ziel bleibt bei '+fmtNum(adpKcalFrom(a))+' kcal.')
      :'Du hast dich entschieden: dein Ziel bleibt, wie es ist.')}</div>`;
  }
  return `<div class="card adp-card${st==='applied'?' done':''} mb-3" id="adpCard">
    <div class="between"><div class="eyebrow">${esc2(head)}</div>${pill}</div>
    ${body}
    ${foot}
    <button class="adp-more" onclick="adpOpenSettings()">${icon('settings',15)} Wie das funktioniert</button>
  </div>`;}
// Steht gerade eine offene Entscheidung über das Kalorienziel auf dem Schirm? Dieselben Bedingungen wie
// in adpCard(), nur als Frage – dtKcalAskNote() liest sie, um seine eigene Rückfrage zurückzunehmen.
function adpDecisionOpen(){
  if(!dtIsToday()||!_dietSelf())return false;
  const a=adpData();if(!a)return false;
  const st=adpState(a);
  if(st!=='proposal'&&st!=='applied')return false;
  if(!adpBody(a))return false;
  if(st==='applied')return !adpDone(a);           // „Passt" beendet auch diese Rückfrage
  if(adpAnswered(a)||!adpNumbers(a))return false;
  return true;}
// `holding`: die Woche hat zu wenige Log-Tage, also wird NICHT angepasst. Das ist kein Fehler und keine
// Warnung – es ist der ehrliche Zustand, und er gehört dorthin, wo sonst die Anpassung stünde. Deshalb
// eine ruhige Statusnotiz statt einer Karte: nichts zu entscheiden, nichts anzutippen.
function adpHoldCard(a,self){
  const need=Math.round(+a.needDays||4),got=Math.round(+a.loggedDays||0);
  const zahl=need?` Du hast an ${fmtNum(got)} von mindestens ${fmtNum(need)} Tagen dieser Woche etwas eingetragen.`:'';
  const zahlC=need?` Eingetragen wurde an ${fmtNum(got)} von mindestens ${fmtNum(need)} Tagen.`:'';
  return `<div class="note status adp-hold mb-3">${icon('info',16)}<div class="fill">${esc2(self?ADP_HOLD_TX:ADP_HOLD_TX_COACH)}${esc2(self?zahl:zahlC)}
    ${self?'<button class="adp-more" onclick="adpOpenSettings()">Wie das funktioniert</button>':''}</div></div>`;}
// ===== DIE DREI AKTIONEN =====
// Alle drei brauchen Netz. Sie in die Offline-Outbox zu legen wäre falsch: danach wird das Protokoll neu
// geholt, und ein Ziel, das erst morgen wirkt, hätte heute eine Karte hinterlassen, die nicht mehr stimmt.
// Bei status 0 sagt `_dietErrTx` das beim Namen („Dafür brauchst du kurz Netz").
// „Übernehmen" und „Behalten" sind dieselbe Route mit einem Ja oder Nein (`accept`) – der Server schließt
// die Zeile in beiden Fällen, deshalb wird die Frage auch in beiden Fällen nur einmal gestellt.
async function adpDecide(accept){const a=adpData();if(!a)return null;
  return API.post(adpPath('/decide'),{id:(a.id==null?null:a.id),accept:accept===true});}
// Nach jeder der drei Aktionen werden BEIDE Reihen neu geholt: das Zielblatt (der Zustand der Karte) und
// das Protokoll (der Ring rechnet gegen das neue Ziel). Zuerst das Zielblatt – sonst zeichnet
// refreshFoodlog() die Karte noch einmal aus dem alten Stand.
async function adpReload(){try{await adpLoad();}catch(e){}
  await refreshFoodlog(true);}
async function adpApply(){const a=adpData();if(!a||!_dietSelf())return;
  if(!adpKcalTo(a))return toast('Für diese Woche liegt kein Vorschlag vor');
  const r=await adpDecide(true);
  if(!_dietOk(r))return toast(_dietErrTx(r,'Nicht übernommen'));
  adpRemember(a);
  await adpReload();
  toast('Neues Ziel übernommen ✓');}
// „Behalten" ändert am Ziel nichts – der Vorschlag war ja nie gesetzt; der Server merkt sich nur, dass
// entschieden wurde (`status='abgelehnt'`). Deshalb gilt die Antwort auch dann, wenn die Meldung nicht
// ankommt: das Ziel bleibt so oder so stehen. Die Karte verschwindet trotzdem sofort (adpRemember).
function adpKeep(){const a=adpData();if(!a||!_dietSelf())return;
  adpRemember(a);
  try{const p=adpDecide(false);if(p&&p.then)p.then(()=>{try{adpLoad();}catch(e){}}).catch(()=>{});}catch(e){}
  if(document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();
  toast('Dein Ziel bleibt bei '+fmtNum(adpKcalFrom(a)||adpKcalTo(a))+' kcal');}
// Eine bereits gesetzte Anpassung zurücknehmen (BUILD-B1 4.3: „immer widerrufbar"). Der Server holt dafür
// die vorige Zielzeile zurück – auch den Ausgangswert, den er beim ersten „Übernehmen" nachgetragen hat.
async function adpUndo(){const a=adpData();if(!a||!_dietSelf())return;
  const r=await API.post(adpPath('/revert'),{});
  if(!_dietOk(r))return toast(_dietErrTx(r,'Nicht zurückgenommen'));
  adpRemember(a);adpRememberDone(a);   // beides beantwortet: die Frage und die Karte danach
  await adpReload();
  const zurueck=adpKcalFrom(a);
  toast(zurueck?('Zurückgenommen – dein Ziel ist wieder '+fmtNum(zurueck)+' kcal'):'Zurückgenommen – es gilt wieder dein vorheriges Ziel');}
// „Passt": die Karte hat ihren Zweck erfüllt. Der Vorgang bleibt im Sheet nachlesbar, es geht nichts verloren.
function adpDismiss(){const a=adpData();if(!a)return;adpRememberDone(a);
  if(document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();}
// ===== DER SCHALTER =====
// Ein Schalter, ein Satz, was er tut – und derselbe Satz nennt die Quelle der Zahl. Er steht in einem
// eigenen Sheet statt im Heute-Reiter: eine Einstellung, die man einmal trifft, gehört nicht zwischen
// Ring und Protokoll. Erreichbar aus der Karte („Wie das funktioniert") und aus den Plan-Optionen.
const ADP_OFF_TX='Aus: Dein Kalorienziel kommt aus der Formel – Gewicht, Größe, Alter und Ziel aus deinem Profil.';
const ADP_ON_TX='An: Einmal pro Woche vergleicht die App deinen Gewichtsverlauf mit dem, was du eingetragen hast, schätzt daraus deinen Verbrauch und schlägt höchstens 100 kcal mehr oder weniger vor. Geändert wird nichts ohne dein Ja.';
function adpOpenSettings(){
  const a=adpData(),on=adpOn(),self=_dietSelf();
  const st=adpState(a);
  let h=`<label class="switch-row rows mb-3"><div class="rl">Automatisch anpassen<small>${on?'An – die App fragt vor jeder Änderung':'Aus (Standard) – dein Ziel kommt aus der Formel'}</small></div>
    <input type="checkbox" class="rcheck" id="adp_sw" ${on?'checked':''} ${self?'':'disabled'} onchange="adpSetMode(this.checked)"></label>`;
  h+=`<div class="note mb-3">${esc2(ADP_OFF_TX)}<br><br>${esc2(ADP_ON_TX)}</div>`;
  // Was JETZT gilt, in einem Satz – und zwar in dem Satz, den auch der Coach-Bereich benutzt (`modeText`
  // aus `GET /api/targets`). Schickt der Server ihn nicht, steht hier dieselbe Tatsache in eigenen Worten.
  const mText=adpModeText();
  if(mText)h+=`<div class="note status mb-3">${esc2(mText)}</div>`;
  else if(adpHasCoach())h+=`<div class="note status mb-3">${esc2(self
    ?'Du hast einen Coach – jede Anpassung geht erst an ihn und wird erst nach seiner Freigabe vorgeschlagen.'
    :'Der Athlet hat einen Coach – die Anpassung wartet auf die Freigabe.')}</div>`;
  // Der Stand von dieser Woche, mit derselben Herkunftsangabe wie in der Karte. Auch nachdem die Karte
  // weggetippt wurde, ist hier nachlesbar, was vorgeschlagen wurde und warum.
  if(a&&st!=='none'){
    const lbl=st==='applied'?'Diese Woche angepasst':st==='coach'?'Wartet auf Freigabe':st==='holding'?'Diese Woche keine Anpassung':'Vorschlag dieser Woche';
    h+=`<div class="section-label"><span>${esc2(lbl)}</span></div>
      <div class="card adp-card mb-3">${st==='holding'?`<div class="adp-reason">${esc2(self?ADP_HOLD_TX:ADP_HOLD_TX_COACH)}</div>`:adpBody(a)}</div>`;
  }else if(self){
    h+=`<div class="caption center mb-3">${esc2(on?'Der nächste Wochenlauf schaut sich deine Daten an – du siehst das Ergebnis hier und auf dem Heute-Reiter.':'Solange der Schalter aus ist, schlägt die App nichts vor.')}</div>`;
  }
  if(!self)h+=`<div class="note status">${esc2('Nur Ansicht – ob die Ziele automatisch angepasst werden, entscheidet der Athlet. Die Freigabe einer Anpassung machst du in deinem Coach-Bereich.')}</div>`;
  openSheet('Ziele automatisch anpassen',h);}
// Der Schalter schreibt nur EINE Sache: den Modus. Er rechnet nichts und setzt kein Ziel – auch das
// Einschalten ändert heute keine Zahl (P10). Schlägt das Speichern fehl, springt der Schalter zurück,
// statt einen Zustand zu zeigen, den der Server nicht kennt.
// GEMESSEN UND REPARIERT (15.09.2026): Hier stand `API.put('/profile',{target_mode:mode})`. Die Route
// nimmt das Feld nicht an – sie antwortete 200 {"ok":true} und speicherte es nicht; `GET /api/targets/2`
// meldete danach weiter `mode:"formel"`. Der Schalter blieb also an, der Toast versprach eine Automatik,
// und nach dem nächsten Laden sprang er zurück. Die zuständige Route ist `POST /api/targets/:uid/mode`
// (gemessen: 200 {"ok":true,"mode":"adaptiv"}, danach steht der Modus wirklich auf „adaptiv").
async function adpSetMode(on){
  const box=document.getElementById('adp_sw');
  if(!_dietSelf()){if(box)box.checked=adpOn();return void toast(DIET_RO_TX);}
  const mode=on?'adaptiv':'formel';
  const r=await API.post(adpPath('/mode'),{mode});
  if(!_dietOk(r)){if(box)box.checked=!on;return toast(_dietErrTx(r,'Nicht gespeichert'));}
  if(typeof ME==='object'&&ME)ME.target_mode=mode;
  const t=adpRaw();if(t)t.mode=mode;   // bis adpLoad() antwortet, zeigt der Schalter schon das Neue
  toast(on?(adpHasCoach()?'An – die Rechnung läuft; jede Anpassung geht erst an deinen Coach'
                         :'An – die App schlägt ab der nächsten Woche vor, ändern tut sie nichts ohne dich')
        :'Aus – dein Ziel kommt wieder aus der Formel');
  await adpReload();
  adpOpenSettings();}
// HEUTE: Ring + Makro-Balken + Nächste Mahlzeit + Hinzufügen + Protokoll nach Slot gruppiert
function drawTrack(){_dietMark('track');_dietEnsureFoods();const fl=renderDiet.foodlog||{items:[],summary:{}};const sum=fl.summary||{};
  const items=fl.items||[];const el=document.getElementById('dietBody');if(!el)return;
  // Gar keine Antwort für heute: dann ist auch der Ring eine Behauptung („0 von 2.600 kcal gegessen").
  // Statt zwei Offline-Karten unter einem falschen Hero steht hier eine Karte mit der Wahrheit.
  // Welcher Status zählt? Der des Protokolls, denn davon handelt diese Ansicht; kam von dort nichts
  // (status 0), entscheidet der Plan mit – so bleibt „kein Netz" dem Fall vorbehalten, in dem wirklich
  // keine der beiden Anfragen angekommen ist.
  // Die Datumsleiste steht ÜBER allem anderen – auch über den Fehlerkarten. Wer beim Blättern auf einen
  // Tag ohne Netz stößt, muss zurückblättern können, ohne die Seite neu zu laden.
  const bar=dtDateBar();
  dtSwipeBind(el);
  if(renderDiet.foodlogLoading){el.innerHTML=bar+skeleton(3);return;}
  if(!renderDiet.foodlogOk&&!renderDiet.mealsOk){el.innerHTML=bar+dtLoadNote('track',renderDiet.foodlogSt||renderDiet.mealsSt);return;}
  const consumed=Math.round(sum.consumed||0);const T=dietTargets();const target=T.kcal||0;const mac=sum.macros||{};
  const isTrain=fl.isTrain!==false;const V=kcalVerdict(consumed,target);
  // A-III.2: Kam nur der PLAN durch und das Protokoll nicht (mealsOk, aber kein foodlogOk), stand hier
  // bis 2.6.0 trotzdem der volle Hero – „0 / 3.017 kcal gegessen", Ring auf null, alle drei Makrobalken
  // leer –, obwohl über das heutige Essen gar keine Auskunft vorlag. Gegessen ist dann UNBEKANNT, nicht
  // null. Statt des Hero steht dieselbe ehrliche Karte wie oben; der Plan darunter bleibt sichtbar, denn
  // der IST geladen. Das Protokoll weiter unten wiederholt die Karte dann nicht noch einmal.
  let h=bar+(renderDiet.foodlogOk?`<div class="card diet-hero">
    <div class="dh-head"><span class="chip day ${isTrain?'train':'rest'}" id="dietDayBadge">${isTrain?'Trainingstag':'Ruhetag'}${target?' · '+fmtNum(target)+' kcal'+dtStartwert(sum):''}</span><span class="meta"><span>${fmtNum(consumed)}${target?' / '+fmtNum(target):''} kcal</span> ${V.text?`<span class="${V.tone}">· ${esc2(V.text)}</span>`:'<span>gegessen</span>'}</span></div>
    <div class="dh-main"><div class="fixed">${calorieRing(consumed,target)}</div>
      <div class="dh-bars">${dtMacroRings(mac,T)}</div></div>
    ${dtTargetsNote(sum)}
    ${dtKcalAskNote(fl.dayType||(isTrain?'training':'rest'),true)}
  </div>`:`<div class="mb-3">${dtLoadNote('track',renderDiet.foodlogSt)}</div>`);
  h+=adpCard();   // B-I.4: die Wochenanpassung – nie still, immer mit Begruendung (P3/P10)
  h+=nextMealCard();
  // Essen trägt nur der Athlet selbst ein – im Coach-Blick statt der Schaltfläche derselbe Hinweis wie beim Check-in.
  // Steht darüber schon ein gefülltes „Gegessen" (offene Plan-Mahlzeit), ist DAS der schnellste richtige Weg –
  // ein Tap, und der Tag stimmt. „Essen hinzufügen" tritt dann eine Stufe zurück (`sec`: eigene Fläche, volle
  // Breite, volle 52 px – nur eben nicht rot). Gibt es keine offene Plan-Mahlzeit (kein Plan, oder alles
  // eingetragen), ist „Essen hinzufügen" der Primär-Knopf und trägt den Akzent. Die Trefferfläche und die
  // Tap-Zahl sind in beiden Fällen dieselben – es ändert sich nur, welcher Knopf zuerst gelesen wird.
  h+=_dietSelf()?`<button class="btn block mb-2${nextMealCard.planCTA?' sec':''}" onclick="openLogFood({focus:true})">${icon('plus',18)} Essen hinzufügen</button>`
    :`<div class="note status mb-4">${DIET_RO_TX}</div>`;
  h+=dtRepeatRow();   // „Gestern wiederholen" + gespeicherte Mahlzeit-Vorlagen (je 2 Taps)
  // Leer ist erst leer, wenn der Server das gesagt hat. Fehlt das Protokoll, steht die ehrliche Karte
  // schon oben an der Stelle des Hero – hier dann nichts, sonst stünde sie zweimal auf derselben Seite.
  if(!items.length&&renderDiet.foodlogOk)h+=emptyState({icon:'utensils',title:dtIsToday()?'Noch nichts getrackt':('Für '+dtDayLabelIn(dtDate())+' steht nichts im Protokoll'),text:_dietSelf()?(dtIsToday()?'Trag dein Essen ein oder übernimm eine Mahlzeit aus dem Plan.':'Trag nach, was du an diesem Tag gegessen hast – oder übernimm den Vortag.'):'Dein Athlet hat für diesen Tag nichts eingetragen.'});
  else if(!items.length){/* Karte steht oben */}
  else{
    const groups={};items.forEach(it=>{const k=slotNorm(it.meal_slot);(groups[k]=groups[k]||[]).push(it);});
    const keys=Object.keys(groups).sort((a,b)=>{const ia=SLOT_ORDER.indexOf(a),ib=SLOT_ORDER.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);});
    keys.forEach(k=>{const g=groups[k];const kc=g.reduce((a,it)=>a+(it.kcal||0),0);
      // Die Gruppenzeile trägt jetzt ein Menü: von hier wird aus einer gegessenen Mahlzeit eine Vorlage
      // („Mein Frühstück") oder derselbe Satz Einträge noch einmal gebucht – beides in 2 Taps.
      h+=`<div class="section-label"><span>${esc2(k)}</span><span class="sl-r">${fmtNum(Math.round(kc))} kcal</span>${
        _dietSelf()?`<button class="btn icon sm ghost sl-menu" aria-label="${esc2(k)}: Vorlage speichern oder noch einmal eintragen" onclick="dtSlotMenu('${esc(k)}')">${icon('more',18)}</button>`:''}</div><div class="rows mb-3">`;
      g.forEach(it=>{const isMeal=!!it.details;const amt=isMeal?'ganze Mahlzeit':amountText(it);
        const sub=`<small>${amt?amt+' · ':''}${macroLine(it.protein,it.carbs,it.fat)}</small>`;
        // Wartet noch in der Outbox: zählt bereits mit, ist aber nicht antippbar – Ändern/Entfernen
        // brauchen die Server-ID, die dieser Eintrag erst nach dem Nachtragen bekommt.
        if(it._pending){h+=`<div class="row food-pending"><div class="rl">${esc2(it.food)} <span class="pill neutral">wird nachgetragen</span>${sub}</div><div class="rr">${fmtNum(Math.round(it.kcal||0))} kcal</div></div>`;return;}
        h+=`<div class="row tap" role="button" tabindex="0" onclick="openFoodRow(${it.id})"><div class="rl">${esc2(it.food)}${sub}</div><div class="rr">${fmtNum(Math.round(it.kcal||0))} kcal</div></div>`;});
      h+='</div>';});
  }
  el.innerHTML=h;}
// Zeile antippen: Aufschlüsselung + Menge ändern · Duplizieren · Entfernen
function openFoodRow(id){const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);if(!it)return;
  let parts=[];if(it.details){try{parts=JSON.parse(it.details);}catch(e){parts=[];}}
  let h=macroRow(it.kcal,it.protein,it.carbs,it.fat);
  const amtTx=it.details?'ganze Mahlzeit':amountText(it);
  h+=`<div class="meta mb-3">${esc2(slotNorm(it.meal_slot))}${amtTx?' · '+esc2(amtTx):''}</div>`;
  if(parts.length){h+=`<div class="section-label">Zutaten</div><div class="rows mb-3">`+parts.map(p=>`<div class="row"><div class="rl">${esc2(p.food)}<small>${p.amount?fmtNum(p.amount)+' '+foodUnit(p.food)+dtCookedTxt(p.food,p.amount)+' · ':''}${macroLine(p.protein,p.carbs,p.fat)}</small></div><div class="rr">${fmtNum(Math.round(p.kcal||0))} kcal</div></div>`).join('')+`</div>`;}
  // Ändern/Duplizieren/Entfernen schreiben ins Protokoll – im Coach-Blick bleibt nur die Aufschlüsselung
  h+=_dietSelf()?`<div class="rows">
    ${entryAmount(it)!=null?`<div class="row tap" role="button" tabindex="0" onclick="openFoodAmount(${it.id})"><div class="r-ic">${icon('pencil')}</div><div class="rl">Menge ändern</div><div class="rr"></div></div>`:''}
    <div class="row tap" role="button" tabindex="0" onclick="dupFood(${it.id})"><div class="r-ic">${icon('plus')}</div><div class="rl">Duplizieren<small>Noch einmal eintragen</small></div><div class="rr"></div></div>
    <div class="row tap" role="button" tabindex="0" onclick="delFood(${it.id})"><div class="r-ic tone-red">${icon('trash')}</div><div class="rl tone-red">Entfernen</div><div class="rr"></div></div>
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
  const body={user_id:VIEW_USER,date:it.date||dtDate(),meal_slot:it.meal_slot,food:it.food,amount:a,kcal:Math.round((it.kcal||0)*k),fat:r1((it.fat||0)*k),carbs:r1((it.carbs||0)*k),protein:r1((it.protein||0)*k)};
  // Kein Outbox-Fall: POST und DELETE gehören zusammen und der DELETE hängt an einer Server-ID.
  // Getrennt nachgetragen entstünde entweder eine Dublette oder ein Datenverlust – lieber ehrlich warten.
  const r=await API.post('/foodlog',body);if(r.status!==200)return toast(_dietErrTx(r,'Fehler – nicht gespeichert'));
  const dr=await API.del('/foodlog/'+id);closeAllSheets();await refreshFoodlog();
  toast(dr.status===200?'Menge geändert ✓':'Neue Menge steht drin – der alte Eintrag ließ sich nicht entfernen');}
async function dupFood(id){if(_dietRO())return;const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);if(!it)return;
  // force:true – dieselbe Plan-Mahlzeit darf bewusst ein zweites Mal eingetragen werden (zweite Portion)
  let r;if(it.meal_id)r=await API.post('/foodlog/frommeal/'+it.meal_id,{date:dtLogDay(),meal_slot:slotNorm(it.meal_slot),force:true});
  else r=await API.post('/foodlog',{user_id:VIEW_USER,date:dtLogDay(),meal_slot:it.meal_slot,food:it.food,amount:it.amount,kcal:it.kcal,fat:it.fat,carbs:it.carbs,protein:it.protein});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();await refreshFoodlog();toast(it.food+' noch einmal eingetragen ✓');}
async function delFood(id){if(_dietRO())return;const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);
  // Löschen geht nie in die Outbox (die ID kennt nur der Server) – offline bleibt der Eintrag stehen
  const r=await API.del('/foodlog/'+id);if(r.status!==200)return toast(_dietErrTx(r,'Fehler'));
  closeAllSheets();await refreshFoodlog();
  if(it)toast(`„${it.food}“ entfernt`,{label:'Rückgängig',fn:()=>undoDelFood(it)});else toast('Entfernt');}
async function undoDelFood(it){let r;
  if(it.meal_id)r=await API.post('/foodlog/frommeal/'+it.meal_id,{date:it.date||dtDate(),meal_slot:slotNorm(it.meal_slot),force:true});
  else r=await API.post('/foodlog',{user_id:VIEW_USER,date:it.date||dtDate(),meal_slot:it.meal_slot,food:it.food,amount:it.amount,kcal:it.kcal,fat:it.fat,carbs:it.carbs,protein:it.protein});
  // „Rückgängig" bleibt eine Sofort-Aktion: nachgetragen käme die Wiederherstellung ohne den Toast, der sie erklärt
  if(r.status!==200)return toast(_dietErrTx(r,'Konnte nicht wiederherstellen'));
  await refreshFoodlog();toast('Wiederhergestellt ✓');}

// ===== WIEDERHOLEN UND VORLAGEN (A-IV.4 · Punkt 2) =====
// MacroFactor, MyFitnessPal und Yazio holen ihren Vorsprung nicht bei der Tap-Zahl für EIN Lebensmittel
// (dort brauchen alle drei ebenfalls 3 Taps), sondern beim WIEDERHOLEN: „Gestern kopieren", Mahlzeiten-
// Vorlagen, Favoriten. Menschen essen selten neu – sie essen wieder. Genau da lag hier bisher nichts.
// Eine Zeile, die mehrere Einträge auf einmal bucht, braucht dieselbe Sorgfalt wie eine einzelne: was
// gebucht wird, steht vorher da, und danach nimmt EIN „Rückgängig" alles wieder zurück.

// Einträge eines Tages als Protokollzeilen buchen. Gibt die neuen IDs zurück (für „Rückgängig").
// Ganze Plan-Mahlzeiten laufen über /foodlog/frommeal – nur so bleibt die Zutatenliste (`details`) erhalten;
// POST /api/foodlog kennt dieses Feld nicht. Fehlt die meal_id (alter Eintrag), wird die Zeile als freier
// Eintrag gebucht: die Kalorien stimmen, die Aufschlüsselung ist weg – das sagt der Toast auch.
async function dtPostEntries(list,day){const ids=[];let flat=0,fail=0;
  for(const it of list){
    let r;
    if(it.meal_id)r=await API.post('/foodlog/frommeal/'+it.meal_id,{date:day,meal_slot:slotNorm(it.meal_slot),force:true});
    else{if(it.details)flat++;
      r=await API.post('/foodlog',{user_id:VIEW_USER,date:day,meal_slot:slotNorm(it.meal_slot),food:it.food,
        amount:it.details?null:(it.amount??null),kcal:Math.round(it.kcal||0),fat:r1(it.fat),carbs:r1(it.carbs),protein:r1(it.protein)});}
    if(r.status===200&&r.data?.id)ids.push(r.data.id);else fail++;
  }
  return {ids,flat,fail};}
// Mehrere Einträge zurücknehmen (ein „Rückgängig" für eine Sammelbuchung)
async function dtUndoEntries(ids){let n=0;for(const id of ids){const r=await API.del('/foodlog/'+id);if(r.status===200)n++;}
  await refreshFoodlog();toast(n?pl(n,'Eintrag','Einträge')+' zurückgenommen':'Die Einträge sind nicht mehr da');}
// Schritt 1 (Tap 1): den Vortag holen und zeigen, was übernommen würde. Ohne diese Vorschau wäre es eine
// Buchung ins Blaue – und beim Essens-Protokoll ist eine falsche Zahl schlimmer als eine fehlende.
let DT2_REP=null;
async function dtRepeatPrev(){if(_dietRO())return;
  const to=dtDate(),from=dtAddDays(to,-1);
  const title=dtDayLabel(from)+' wiederholen';
  openSheet(title,'<div class="spinner"></div>');
  const r=await API.get('/foodlog/'+VIEW_USER+'?date='+from);
  if(r.status!==200){openSheet(title,`<div class="note err mb-3">${esc2(_dietErrTx(r,'Der Vortag ließ sich nicht laden'))}</div><button class="btn sec" onclick="dtRepeatPrev()">Nochmal versuchen</button>`);return;}
  const items=(r.data?.items||[]).filter(it=>it&&it.food&&!it._pending);
  if(!items.length){openSheet(title,emptyState({icon:'utensils',title:'Da steht nichts',
    text:'Am '+dtDateShort(from)+' ist nichts im Protokoll – es gibt also nichts zu übernehmen.'}));return;}
  DT2_REP={from,to,items};
  const kc=items.reduce((a,it)=>a+(it.kcal||0),0);
  let h=`<div class="note status mb-3">Alle Einträge von ${esc2(dtDateShort(from))} landen als neue Zeilen auf ${esc2(dtIsToday()?'heute':dtDateShort(to))}. Ein „Rückgängig" nimmt sie gemeinsam zurück.</div>`;
  h+=`<div class="rows mb-3">`+items.map(it=>`<div class="row dt-erow"><div class="rl">${esc2(it.food)}<small>${esc2(slotNorm(it.meal_slot))}${it.details?' · ganze Mahlzeit':(amountText(it)?' · '+amountText(it):'')}</small></div><div class="rr">${fmtNum(Math.round(it.kcal||0))} kcal</div></div>`).join('')+`</div>`;
  h+=`<div class="lf-done"><span class="fill">${pl(items.length,'Eintrag','Einträge')} · ${fmtNum(Math.round(kc))} kcal</span>
    <button class="btn sm" onclick="dtRepeatApply()">Übernehmen</button></div>`;
  openSheet(title,h,{size:'tall'});}
// Schritt 2 (Tap 2): buchen.
async function dtRepeatApply(){const R=DT2_REP;if(!R)return;DT2_REP=null;
  closeAllSheets();
  const res=await dtPostEntries(R.items,R.to);
  await refreshFoodlog();
  if(!res.ids.length)return toast('Nichts übernommen – der Server hat abgelehnt');
  const tail=res.fail?` · ${res.fail} nicht übernommen`:(res.flat?` · ${res.flat} ohne Zutatenliste`:'');
  toast(pl(res.ids.length,'Eintrag','Einträge')+' übernommen ✓'+tail,{label:'Rückgängig',fn:()=>dtUndoEntries(res.ids)});}

// ---- Mahlzeit als Vorlage ----
// Eine Vorlage ist eine BENANNTE Gruppe von Protokollzeilen („Mein Frühstück"). Sie liegt im localStorage
// und ist nach Konto getrennt (`be_dt_tpl_<id>`) – wie die Favoriten und aus demselben Grund: im Coach-Blick
// dürfen die Gewohnheiten des Coaches nicht über dem Protokoll des Athleten stehen.
let DT2_TPL=null;
const DT2_TPL_MAX=8;
function dtTplKey(){return 'be_dt_tpl_'+VIEW_USER;}
function dtTplLoad(){if(DT2_TPL&&DT2_TPL.user===VIEW_USER)return DT2_TPL.list;
  let list=[];try{const c=JSON.parse(localStorage.getItem(dtTplKey())||'null');
    if(Array.isArray(c))list=c.filter(t=>t&&t.name&&Array.isArray(t.items)&&t.items.length).slice(0,DT2_TPL_MAX);}catch(e){}
  DT2_TPL={user:VIEW_USER,list};return list;}
function dtTplStore(list){DT2_TPL={user:VIEW_USER,list:list.slice(0,DT2_TPL_MAX)};
  try{localStorage.setItem(dtTplKey(),JSON.stringify(DT2_TPL.list));}catch(e){}}
// Eine Vorlage ablegen. Derselbe Name ersetzt die vorhandene, statt eine zweite daneben zu legen –
// „Mein Frühstück" zweimal zu speichern ist eine Korrektur, keine zweite Vorlage. Gibt den Namen zurück.
function dtTplSave(name,slot,kcal,items){name=String(name||'').trim().slice(0,40)||'Vorlage';
  const list=dtTplLoad().filter(t=>dtNorm(t.name)!==dtNorm(name));
  list.unshift({name,slot,kcal,items,ts:Date.now()});
  dtTplStore(list);
  if(document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();
  return name;}
// Aus der Protokollgruppe eines Slots eine Vorlage machen – in ZWEI Taps (⋯ → „Als Vorlage speichern").
// Der Name steht vorher fest und im Menü darüber („Mein Frühstück"), also wird nicht erst danach gefragt.
// Wer ihn ändern will, tippt im Toast auf „Umbenennen": der seltenere Fall kostet den dritten Tap, statt
// ihn jedem abzuverlangen. Beim Essens-Protokoll zählt jeder gesparte Tap doppelt – es bricht unter allen
// Selbstbeobachtungs-Arten am schnellsten ab (Median 10 Wochen, Carpenter 2022).
// Gespeichert wird nur das Nötige: die Server-IDs des Ursprungstages gehören nicht dazu, sonst zeigte die
// Vorlage auf Zeilen, die längst gelöscht sind.
function dtTplFromSlot(slot){if(_dietRO())return;
  const items=(renderDiet.foodlog?.items||[]).filter(it=>!it._pending&&slotNorm(it.meal_slot)===slot);
  if(!items.length)return toast('In dieser Mahlzeit steht nichts');
  const kc=Math.round(items.reduce((a,it)=>a+(it.kcal||0),0));
  const slim=items.map(it=>({food:it.food,meal_slot:slot,meal_id:it.meal_id||null,details:it.details?1:0,
    amount:it.amount??null,kcal:Math.round(it.kcal||0),protein:r1(it.protein),carbs:r1(it.carbs),fat:r1(it.fat)}));
  closeAllSheets();
  const name=dtTplSave(dtTplName(slot),slot,kc,slim);
  toast(`„${name}“ gespeichert – steht jetzt oben im Heute-Reiter`,{label:'Umbenennen',fn:()=>dtTplRename(name)});}
// Der vorgeschlagene Name – eine Stelle, damit das Menü genau den Namen nennt, der danach wirklich dasteht.
function dtTplName(slot){return 'Mein '+slot;}
function dtTplRename(name){const list=dtTplLoad();const i=list.findIndex(t=>dtNorm(t.name)===dtNorm(name));
  if(i<0)return toast('Diese Vorlage gibt es nicht mehr');
  openSheet('Vorlage umbenennen',`<div id="tplForm"><div class="field"><label>Name</label><input id="tpl_name" value="${esc2(list[i].name)}" maxlength="40" enterkeyhint="done" onkeydown="if(event.key==='Enter')dtTplRenameSave('${esc(list[i].name)}')"></div>
    <button class="btn block" onclick="dtTplRenameSave('${esc(list[i].name)}')">Speichern</button></div>`);
  setTimeout(()=>{const el=document.getElementById('tpl_name');if(el){el.focus();el.select();}},60);}
function dtTplRenameSave(oldName){const list=dtTplLoad();const i=list.findIndex(t=>dtNorm(t.name)===dtNorm(oldName));
  if(i<0){closeAllSheets();return;}
  const name=String(val('tpl_name')||'').trim().slice(0,40);
  if(!name)return showFieldErr('tplForm','Bitte einen Namen eingeben','tpl_name');
  const t=list.splice(i,1)[0];t.name=name;
  const rest=list.filter(x=>dtNorm(x.name)!==dtNorm(name)); // läuft der neue Name auf eine vorhandene Vorlage, ersetzt er sie
  rest.unshift(t);dtTplStore(rest);closeAllSheets();
  if(document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();
  toast(`Heißt jetzt „${name}“`);}
// Ein Tipp = eingetragen. Der Toast nimmt es gemeinsam zurück, deshalb braucht es keine Rückfrage davor.
async function dtTplLog(i){if(_dietRO())return;const t=dtTplLoad()[i];if(!t)return;
  const res=await dtPostEntries(t.items,dtLogDay());
  await refreshFoodlog();
  if(!res.ids.length)return toast('Nicht eingetragen – der Server hat abgelehnt');
  toast(`„${t.name}“ eingetragen ✓`+(res.fail?` · ${res.fail} nicht übernommen`:''),{label:'Rückgängig',fn:()=>dtUndoEntries(res.ids)});}
function dtTplMenu(i){const t=dtTplLoad()[i];if(!t)return;
  openSheet(t.name,`<div class="meta mb-3">${pl(t.items.length,'Eintrag','Einträge')} · ${fmtNum(t.kcal||0)} kcal · ${esc2(t.slot||'')}</div>
    <div class="rows mb-3">`+t.items.map(x=>`<div class="row dt-erow"><div class="rl">${esc2(x.food)}</div><div class="rr">${fmtNum(Math.round(x.kcal||0))} kcal</div></div>`).join('')+`</div>
    <div class="rows">
      <div class="row tap" role="button" tabindex="0" onclick="closeModal();dtTplLog(${i})"><div class="r-ic">${icon('check')}</div><div class="rl">Jetzt eintragen</div><div class="rr"></div></div>
      <div class="row tap" role="button" tabindex="0" onclick="dtTplRename('${esc(t.name)}')"><div class="r-ic">${icon('pencil')}</div><div class="rl">Umbenennen</div><div class="rr"></div></div>
      <div class="row tap" role="button" tabindex="0" onclick="dtTplDel(${i})"><div class="r-ic tone-red">${icon('trash')}</div><div class="rl tone-red">Vorlage löschen</div><div class="rr"></div></div>
    </div>`);}
function dtTplDel(i){const list=dtTplLoad();const t=list[i];if(!t)return;
  list.splice(i,1);dtTplStore(list);closeAllSheets();
  if(document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();
  toast(`„${t.name}“ gelöscht`);}
// Das Menü an der Gruppenzeile: aus einer gegessenen Mahlzeit wird in 2 Taps eine Vorlage – oder derselbe
// Satz Einträge noch einmal (die zweite Portion abends, der gleiche Snack ein zweites Mal).
function dtSlotMenu(slot){if(_dietRO())return;
  const items=(renderDiet.foodlog?.items||[]).filter(it=>!it._pending&&slotNorm(it.meal_slot)===slot);
  const kc=Math.round(items.reduce((a,it)=>a+(it.kcal||0),0));
  // Beide Zeilen führen sofort aus – kein Zwischenschritt, keine Rückfrage. Deshalb steht im Untertitel
  // vorher, was genau passiert: unter welchem Namen die Vorlage landet, und wie viele Zeilen ein zweites
  // Mal gebucht werden. Zurückgenommen wird beides über den Toast.
  const nochmal=items.length===1?'Denselben Eintrag ein zweites Mal':`Dieselben ${fmtNum(items.length)} Einträge ein zweites Mal`;
  openSheet(slot,`<div class="meta mb-3">${pl(items.length,'Eintrag','Einträge')} · ${fmtNum(kc)} kcal</div><div class="rows">
    <div class="row tap" role="button" tabindex="0" onclick="dtTplFromSlot('${esc(slot)}')"><div class="r-ic">${icon('star')}</div><div class="rl">Als Vorlage speichern<small>Als „${esc2(dtTplName(slot))}“ – danach mit einem Tipp eintragen</small></div><div class="rr"></div></div>
    <div class="row tap" role="button" tabindex="0" onclick="dtSlotAgain('${esc(slot)}')"><div class="r-ic">${icon('copy')}</div><div class="rl">Noch einmal eintragen<small>${esc2(nochmal)}</small></div><div class="rr"></div></div>
  </div>`);}
async function dtSlotAgain(slot){if(_dietRO())return;
  const items=(renderDiet.foodlog?.items||[]).filter(it=>!it._pending&&slotNorm(it.meal_slot)===slot);
  if(!items.length)return toast('In dieser Mahlzeit steht nichts');
  closeAllSheets();
  const res=await dtPostEntries(items,dtDate());
  await refreshFoodlog();
  if(!res.ids.length)return toast('Nicht eingetragen – der Server hat abgelehnt');
  toast(slot+' noch einmal eingetragen ✓',{label:'Rückgängig',fn:()=>dtUndoEntries(res.ids)});}
// Die Zeile unter „Essen hinzufügen": der Vortag und die gespeicherten Vorlagen. Sie erscheint nur im
// eigenen Konto und nur dort, wo sie etwas kann – im Coach-Blick wird nichts eingetragen.
function dtRepeatRow(){if(!_dietSelf())return '';
  const prev=dtAddDays(dtDate(),-1);
  const tpl=dtTplLoad();
  // Eine Zeile, waagrecht scrollend (`chip-row` ohne `wrap`): „Mein Frühstück · 223 kcal" ist breit, im
  // Umbruch stand jede Vorlage auf einer eigenen Zeile und die Reihe fraß 130 px Höhe für drei Knöpfe.
  // Waagrecht bleibt „Gestern wiederholen" immer sichtbar, der Rest liegt eine Wischbewegung daneben –
  // und die Tages-Wischgeste greift hier bewusst nicht (dtSwipeStart lässt querscrollende Kinder aus).
  let h=`<div class="chip-row dt-repeat mb-4" role="group" aria-label="Wiederholen">`;
  h+=`<button class="chip soft" onclick="dtRepeatPrev()">${icon('refresh',16)} ${esc2(dtDayLabel(prev))} wiederholen</button>`;
  tpl.slice(0,3).forEach((t,i)=>{h+=`<button class="chip soft" onclick="dtTplLog(${i})" oncontextmenu="event.preventDefault();dtTplMenu(${i})">${esc2(t.name)} · ${fmtNum(t.kcal||0)} kcal</button>`;});
  if(tpl.length)h+=`<button class="chip soft" aria-label="Alle Vorlagen" onclick="dtTplAll()">${icon('more',16)}</button>`;
  return h+`</div>`;}
function dtTplAll(){const tpl=dtTplLoad();
  if(!tpl.length)return toast('Noch keine Vorlage – tippe auf ⋯ neben einer Mahlzeit im Protokoll');
  openSheet('Meine Vorlagen',`<div class="note mb-3">Ein Tipp trägt die Vorlage ein. Über die Zeile öffnest du sie zum Ansehen oder Löschen.</div><div class="rows">`+
    tpl.map((t,i)=>`<div class="row tap" role="button" tabindex="0" onclick="dtTplMenu(${i})"><div class="rl">${esc2(t.name)}<small>${pl(t.items.length,'Eintrag','Einträge')} · ${esc2(t.slot||'')}</small></div><div class="rr">${fmtNum(t.kcal||0)} kcal</div></div>`).join('')+`</div>`);}

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
        <div class="field"><label>Eiweiß</label><input id="qf_p" type="number" inputmode="numeric" placeholder="g"></div>
        <div class="field"><label>Kohlenhydrate</label><input id="qf_c" type="number" inputmode="numeric" placeholder="g"></div>
        <div class="field"><label>Fett</label><input id="qf_f" type="number" inputmode="numeric" placeholder="g"></div>
      </div>${slotSelect('lf_slot')}
      <button class="btn block" onclick="confirmQuickFood()">Hinzufügen</button></div>`;
    if(o.focus!==false)setTimeout(()=>document.getElementById('qf_name')?.focus(),50);}
  else{b.innerHTML=`<div class="note mb-3">Eigenes Lebensmittel anlegen – es steht dir danach in der Liste zur Verfügung. Werte pro 100 g.</div>
      <div id="nfForm">
      <div class="field"><label>Name</label><input id="nf_name" placeholder="z.B. Mein Proteinriegel"></div>
      <div class="grid-3">
        <div class="field"><label>Eiweiß /100 g</label><input id="nf_p" type="number" inputmode="decimal" placeholder="g"></div>
        <div class="field"><label>Kohlenhydrate /100 g</label><input id="nf_c" type="number" inputmode="decimal" placeholder="g"></div>
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
// ===== FAVORITEN =====
// Wer jeden Morgen dasselbe isst, soll nicht jeden Morgen danach suchen. Der Stern liegt – genau wie die
// „Zuletzt"-Liste – im localStorage und ist nach Konto getrennt (`be_lf_fav_<id>`): im Coach-Blick dürfen
// nicht die Vorlieben des Coaches über der Liste des Athleten stehen. Verglichen wird über dtNorm(), damit
// „Hähnchenbrust" und ein später anders geschriebener Name derselbe Favorit bleiben.
let DT_LF_FAV=null;
function dtFavKey(){return 'be_lf_fav_'+VIEW_USER;}
function dtFavLoad(){if(DT_LF_FAV&&DT_LF_FAV.user===VIEW_USER)return DT_LF_FAV;
  let list=[];try{const c=JSON.parse(localStorage.getItem(dtFavKey())||'null');
    if(Array.isArray(c))list=c.filter(x=>typeof x==='string'&&x).slice(0,60);}catch(e){}
  DT_LF_FAV={user:VIEW_USER,list};return DT_LF_FAV;}
// Einmal je Liste normalisieren, nicht je Zeile: dtStar() fragt für alle 106 Zeilen dieselbe Menge ab.
function dtFavSet(){const c=dtFavLoad();if(!c._set)c._set=new Set(c.list.map(dtNorm));return c._set;}
function dtLfToggleFav(name){if(!name)return;const c=dtFavLoad();const k=dtNorm(name);
  const i=c.list.findIndex(x=>dtNorm(x)===k);
  if(i>=0)c.list.splice(i,1);else c.list.unshift(String(name));
  c.list=c.list.slice(0,60);c._set=null;
  try{localStorage.setItem(dtFavKey(),JSON.stringify(c.list));}catch(e){}
  toast(i>=0?`„${name}“ ist kein Favorit mehr`:`„${name}“ steht jetzt oben`);
  lfFilter();}
// Stern in einer Listenzeile – stopPropagation, damit der Tipp auf den Stern nicht das Lebensmittel auswählt
function dtStar(name){const on=dtFavSet().has(dtNorm(name));
  return `<button class="btn icon sm ghost lf-star${on?' on':''}" aria-pressed="${on?'true':'false'}" aria-label="${on?'Favorit entfernen':'Als Favorit merken'}" onclick="event.stopPropagation();dtLfToggleFav('${esc(name)}')">${icon('star',20)}</button>`;}

// „Zuletzt": Lebensmittel der letzten 7 Tage (mit letzter Menge) – clientseitig aus dem Protokoll, 5 Min. gecacht
let LF_RECENT=null;
function _lfRecentKey(){return 'be_lf_recent_'+VIEW_USER;}
function _lfRecentLoad(){if(LF_RECENT&&LF_RECENT.user===VIEW_USER)return LF_RECENT;
  try{const c=JSON.parse(localStorage.getItem(_lfRecentKey())||'null');
    if(c&&Array.isArray(c.list))LF_RECENT={user:VIEW_USER,day:c.day,ts:c.ts||0,list:c.list};}catch(e){}
  return (LF_RECENT&&LF_RECENT.user===VIEW_USER)?LF_RECENT:null;}
function _lfRecentSave(){try{if(LF_RECENT)localStorage.setItem(_lfRecentKey(),JSON.stringify({day:LF_RECENT.day,ts:LF_RECENT.ts,list:LF_RECENT.list}));}catch(e){}}
// Neuer Eintrag: Liste lokal fortschreiben, statt den Sammelabruf zu erzwingen.
// macros = die tatsächlich gebuchten Werte eines FREIEN Eintrags („Restaurant-Pizza"). Hinter so einem Eintrag
// steht kein Lebensmittel, also kann die Liste ihn ohne diese Zahlen nicht noch einmal anbieten – genau deshalb
// fiel Manuell-Gebuchtes bisher aus „Zuletzt" heraus (M1).
function _lfRecentTouch(name,amount,slot,macros){if(!name)return;const c=_lfRecentLoad();
  const fresh=!!(c&&c.day===today());const list=fresh?c.list.slice():[];
  const k=dtNorm(name);const i=list.findIndex(x=>dtNorm(x.name||'')===k);
  const e=i>=0?list.splice(i,1)[0]:{name,amount:null,slot:null,n:0};
  e.name=name;if(amount!=null)e.amount=amount;if(slot)e.slot=slot;e.n=(e.n||0)+1;
  if(macros&&macros.kcal>0)e.m=macros;
  list.unshift(e);
  LF_RECENT={user:VIEW_USER,day:today(),ts:fresh?c.ts:0,list:list.slice(0,40)};_lfRecentSave();}
// Sammelabruf der letzten 7 Tage in EINEM Roundtrip (GET /foodlog/:id/recent?days=7);
// zusätzlich pro Nutzer und Kalendertag gecacht und zwischendurch nur lokal fortgeschrieben.
async function loadRecentFoods(){const c=_lfRecentLoad();
  if(c&&c.day===today()&&Date.now()-(c.ts||0)<6*3600000)return c.list;
  const r=await API.get('/foodlog/'+VIEW_USER+'/recent?days=7').catch(()=>null);
  if(!r||r.status!==200)return (c&&c.list)||[];
  // Der Sammelabruf liefert bewusst keine Makros (nur date/food/amount/slot). Für freie Einträge tragen wir sie
  // aus zwei Quellen nach: aus der bisherigen lokalen Liste und aus dem heutigen Protokoll, das sie vollständig
  // hat. Ohne diese Zahlen wäre die „Restaurant-Pizza" von gestern wieder nur ein Name ohne Wert.
  const prev=new Map();((c&&c.list)||[]).forEach(x=>{if(x&&x.m&&x.m.kcal>0)prev.set(dtNorm(x.name),x.m);});
  const mac=new Map();(renderDiet.foodlog?.items||[]).forEach(it=>{if(it.details||!it.food||!(it.kcal>0))return;
    mac.set(dtNorm(it.food),{kcal:Math.round(it.kcal||0),protein:r1(it.protein),carbs:r1(it.carbs),fat:r1(it.fat)});});
  const seen=new Map();
  (r.data?.items||[]).forEach(it=>{if(it.details||!it.food)return;const k=dtNorm(it.food);
    if(!seen.has(k))seen.set(k,{name:it.food,amount:entryAmount(it),slot:it.meal_slot,n:0,m:prev.get(k)||mac.get(k)||null});seen.get(k).n++;});
  LF_RECENT={user:VIEW_USER,day:today(),ts:Date.now(),list:[...seen.values()]};_lfRecentSave();return LF_RECENT.list;}
function _lfRow(f,i,sub){return `<div class="row tap" role="button" tabindex="0" onclick="lfPick(${i}${sub&&sub.amount?',{amount:'+(+sub.amount||0)+'}':''})"><div class="rl">${esc2(f.name)}${f.owner_id?` <span class="pill neutral">eigenes</span>`:''}<small>${sub&&sub.txt?esc2(sub.txt)+' · ':''}${kcalUnitTxt(f)}</small></div><div class="rr">${dtStar(f.name)}</div></div>`;}
// Zeile für einen FREIEN Eintrag aus „Zuletzt" (Manuell/Restaurant): dahinter steht kein Lebensmittel, also
// auch keine Menge zum Skalieren – dafür genügt EIN Tipp, um denselben Eintrag noch einmal zu buchen.
function dtFreeRow(r,i){const m=r.m||{};
  return `<div class="row tap" role="button" tabindex="0" onclick="dtLogRecent(${i})"><div class="rl">${esc2(r.name)} <span class="pill neutral">freier Eintrag</span><small>zuletzt · ${fmtNum(Math.round(m.kcal||0))} kcal · ${macroLine(m.protein,m.carbs,m.fat)}</small></div><div class="rr">${dtStar(r.name)}</div></div>`;}
// Freien Eintrag noch einmal buchen – dieselben Werte, Slot nach der aktuellen Uhrzeit bzw. zuletzt genutzt
async function dtLogRecent(i){if(_dietRO())return;const c=_lfRecentLoad();const r=c&&c.list[i];
  if(!r||!r.m||!(r.m.kcal>0))return toast('Für diesen Eintrag fehlen die Nährwerte');
  const slot=slotDefault();slotRemember(slot);
  const body={user_id:VIEW_USER,date:dtLogDay(),meal_slot:slot,food:r.name,amount:null,
    kcal:Math.round(r.m.kcal||0),fat:r1(r.m.fat),carbs:r1(r.m.carbs),protein:r1(r.m.protein)};
  const res=await API.post('/foodlog',body,{queue:true,kind:'food',label:r.name});
  if(!_dietOk(res))return toast(res.data?.error||'Fehler – nicht gespeichert');
  await _lfAfterAdd(body.kcal,r.name,{slot,macros:r.m,pending:_dietQueued(res)?body:null});
  if(document.getElementById('lf_list'))lfFilter();}
// Liste: ohne Suchtext „Favoriten" und „Zuletzt / Häufig" zuerst, dann alle (dedupliziert); mit Suchtext
// normalisiert und mehrwortfähig gefiltert (dtNorm/dtHit) – über Lebensmittel UND freie Zuletzt-Einträge.
function lfFilter(){const toks=dtToks(val('lf_search')||'');
  const el=document.getElementById('lf_list');if(!el)return;
  const seenN=new Set();const all=[];FOODS.forEach((f,i)=>{const k=f.name.toLowerCase();if(seenN.has(k))return;seenN.add(k);all.push({f,i});});
  const fav=dtFavSet();const favHit=n=>fav.has(dtNorm(n));
  all.sort((a,b)=>(favHit(b.f.name)?1:0)-(favHit(a.f.name)?1:0)||(b.f.owner_id?1:0)-(a.f.owner_id?1:0)||(b.f.use_count||0)-(a.f.use_count||0)||a.f.name.localeCompare(b.f.name,'de'));
  const rec=(LF_RECENT&&LF_RECENT.user===VIEW_USER)?LF_RECENT.list:[];
  let h='';
  if(!toks.length){const shown=new Set();
    const favRows=all.filter(x=>favHit(x.f.name)).slice(0,8);
    favRows.forEach(x=>shown.add(dtNorm(x.f.name))); // Favoriten stehen oben, nicht doppelt unter „Zuletzt"
    if(favRows.length)h+=`<div class="section-label tight"><span>Favoriten</span><span class="sl-r">${favRows.length}</span></div><div class="rows mb-3" role="group" aria-label="Favoriten">${favRows.map(x=>_lfRow(x.f,x.i)).join('')}</div>`;
    const rows=[];
    rec.slice(0,8).forEach((r,ri)=>{const k=dtNorm(r.name||'');if(!k||shown.has(k))return;
      const idx=FOODS.findIndex(f=>dtNorm(f.name)===k);const f=FOODS[idx];
      if(f){shown.add(k);rows.push(_lfRow(f,idx,{amount:r.amount,txt:r.amount?'zuletzt '+fmtNum(r.amount)+' '+foodUnit(f.name,f):'zuletzt'}));}
      else if(r.m&&r.m.kcal>0){shown.add(k);rows.push(dtFreeRow(r,ri));} // freier Eintrag, kein Lebensmittel
    });
    all.filter(x=>(x.f.use_count||0)>0).slice(0,8).forEach(x=>{if(rows.length>=8||shown.has(dtNorm(x.f.name)))return;shown.add(dtNorm(x.f.name));rows.push(_lfRow(x.f,x.i,{txt:'häufig'}));});
    if(rows.length)h+=`<div class="section-label tight"><span>Zuletzt / Häufig</span></div><div class="rows mb-3" role="group" aria-label="Zuletzt oder haeufig eingetragen">${rows.join('')}</div>`;
    h+=`<div class="section-label tight"><span>Alle Lebensmittel</span><span class="sl-r">${all.length}</span></div><div class="rows" role="group" aria-label="Alle Lebensmittel">`+all.slice(0,40).map(x=>_lfRow(x.f,x.i)).join('')+'</div>';
    if(all.length>40)h+=`<div class="caption center mt-2">Tippe oben, um in allen ${all.length} zu suchen.</div>`;}
  else{const matches=all.filter(x=>dtHit(x.f.name,toks)).slice(0,60);
    const free=rec.map((r,ri)=>({r,ri})).filter(x=>x.r.m&&x.r.m.kcal>0&&!FOODS.some(f=>dtNorm(f.name)===dtNorm(x.r.name))&&dtHit(x.r.name,toks)).slice(0,10);
    if(!matches.length&&!free.length){h=emptyState({icon:'search',title:'Nichts gefunden',text:'Über „Manuell“ trägst du freie Kalorien ein, unter „Neu“ speicherst du ein eigenes Lebensmittel.',btn:{label:'Neu anlegen',onclick:'lfTab(4)'}});}
    else{if(free.length)h+=`<div class="section-label tight"><span>Zuletzt eingetragen</span></div><div class="rows mb-3">`+free.map(x=>dtFreeRow(x.r,x.ri)).join('')+'</div>';
      if(matches.length)h+='<div class="rows" role="group" aria-label="Suchtreffer">'+matches.map(x=>_lfRow(x.f,x.i)).join('')+'</div>';}}
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
  const out=document.getElementById('lf_out');if(out)out.innerHTML=`<div class="macro kcal"><div class="v">${fmtNum(Math.round(kc))}</div><div class="k">kcal</div></div><div class="macro"><div class="v">${fmtNum(prot,1)}<em>g</em></div><div class="k">Eiweiß</div></div><div class="macro"><div class="v">${fmtNum(carb,1)}<em>g</em></div><div class="k">Kohlenhydrate</div></div><div class="macro"><div class="v">${fmtNum(fat,1)}<em>g</em></div><div class="k">Fett</div></div>`;}
// Nach dem Eintragen: Sheet bleibt offen, Zähler oben, zurück zur Liste
// o.pending = der Eintrag, der in der Outbox wartet (nur bei 202). Dann NICHT nachladen: die Serverantwort
// kennt ihn noch nicht und würde den optimistischen Stand sofort wieder wegwischen.
async function _lfAfterAdd(kc,name,o){o=o||{};LF_SESSION.count++;LF_SESSION.kcal+=kc||0;lfUpdateDone();
  if(name)_lfRecentTouch(name,o.amount,o.slot,o.macros); // „Zuletzt“ lokal fortschreiben (kein neuer 7-Tage-Abruf)
  if(o.pending){_dietPending(o.pending);return toast(DIET_QUEUED_TX);}
  toast((name?name+' ':'')+'eingetragen ✓');
  await refreshFoodlog();}
async function confirmLogFood(){if(LF_SELECTED==null)return toast('Bitte ein Lebensmittel wählen');
  const f=FOODS[LF_SELECTED];const a=parseFloat(val('lf_amt'))||0;if(a<=0)return showFieldErr(null,'Bitte eine Menge eingeben','lf_amt');
  const fat=f.fat*a,carb=f.carbs*a,prot=f.protein*a,kc=fat*9+carb*4+prot*4;const slot=val('lf_slot');slotRemember(slot);
  const body={user_id:VIEW_USER,date:dtLogDay(),meal_slot:slot,food:f.name,amount:a,kcal:kc,fat,carbs:carb,protein:prot};
  const r=await API.post('/foodlog',body,{queue:true,kind:'food',label:f.name});
  if(!_dietOk(r))return toast(r.data?.error||'Fehler – nicht gespeichert');
  f.use_count=(f.use_count||0)+1;
  if(document.getElementById('lf_chosen')){lfClear();}
  await _lfAfterAdd(kc,f.name,{amount:a,slot,pending:_dietQueued(r)?body:null});}
async function confirmQuickFood(){const name=val('qf_name')||'Schnell-Eintrag';const kc=num('qf_kcal');
  if(kc==null)return showFieldErr('qfForm','Bitte Kalorien eingeben','qf_kcal');
  const slot=val('lf_slot');slotRemember(slot);
  // amount bleibt leer: ein freier Eintrag („Restaurant-Pizza") hat keine sinnvolle Grammzahl
  const body={user_id:VIEW_USER,date:dtLogDay(),meal_slot:slot,food:name,amount:null,kcal:kc,fat:num('qf_f')||0,carbs:num('qf_c')||0,protein:num('qf_p')||0};
  const r=await API.post('/foodlog',body,{queue:true,kind:'food',label:name});
  if(!_dietOk(r))return toast(r.data?.error||'Fehler – nicht gespeichert');
  if(document.getElementById('lfBody'))lfTab(3,{focus:false});
  // Die gebuchten Werte mitgeben: ein freier Eintrag hat kein Lebensmittel hinter sich, nur mit diesen Zahlen
  // steht er morgen wieder in „Zuletzt" und ist mit einem Tipp erneut eingetragen (M1).
  await _lfAfterAdd(kc,name,{slot,macros:{kcal:Math.round(kc||0),protein:body.protein,carbs:body.carbs,fat:body.fat},pending:_dietQueued(r)?body:null});}
async function confirmNewFood(){const name=val('nf_name');if(!name)return showFieldErr('nfForm','Bitte einen Namen eingeben','nf_name');
  // Kein Outbox-Fall: gleich danach wird die ganze Liste neu geladen, und ausgewählt werden kann nur, was es gibt
  const r=await API.post('/foods',{name,protein:num('nf_p')||0,carbs:num('nf_c')||0,fat:num('nf_f')||0,per100:true});
  if(r.status!==200)return toast(_dietErrTx(r,'Fehler'));
  const fr=await API.get('/foods');if(fr.status===200)FOODS=fr.data?.foods||[]; // neu laden, damit das neue gleich auswählbar ist
  toast('Gespeichert ✓');lfTab(1,{focus:false});
  setTimeout(()=>{const idx=FOODS.findIndex(f=>f.name===name);if(idx>=0)lfPick(idx);},60);}
// Plan-Mahlzeit als gegessen eintragen (auch von Home aus aufrufbar). Drei Antworten, nicht zwei:
// true = der Server hat sie, 'queued' = sie wartet ohne Netz in der Outbox, false = nichts passiert.
// Der Wartezustand braucht einen eigenen Wert, weil der Aufrufer danach NICHT nachladen darf (der
// Serverstand kennt die Mahlzeit noch nicht und würde den optimistischen Stand überschreiben).
// 'queued' ist absichtlich ein Wahrheitswert – jede vorhandene truthy-Prüfung bleibt richtig.
async function logFromMeal(mealId){if(_dietRO())return false;const m=(renderDiet.meals||[]).find(x=>x.id===+mealId);
  const slot=m?mealSlotOf(m):undefined;const mealTx=m?.label||'Mahlzeit';
  const r=await API.post('/foodlog/frommeal/'+mealId,{date:dtLogDay(),meal_slot:slot},{queue:true,kind:'food',label:mealTx});
  if(r.status===409){await refreshFoodlog();  // war schon eingetragen: Ansicht angleichen, zweite Portion anbieten
    toast('Schon eingetragen – heute bereits im Protokoll',{label:'Nochmal',fn:async()=>{
      const r2=await API.post('/foodlog/frommeal/'+mealId,{date:dtLogDay(),meal_slot:slot,force:true},{queue:true,kind:'food',label:mealTx});
      if(!_dietOk(r2))return toast(r2.data?.error||'Fehler');
      if(_dietQueued(r2)){_dietPendingMeal(m,mealId,slot,mealTx);return toast(DIET_QUEUED_TX);}
      await refreshFoodlog();toast('Zweite Portion eingetragen ✓');}});
    return false;}
  if(!_dietOk(r)){toast(r.data?.error||'Fehler');return false;}
  // Offline: Zeile lokal ins Protokoll, kein Nachladen und kein „Rückgängig" – rückgängig machen ließe sich
  // erst, was der Server kennt. Die Mahlzeit gilt trotzdem als eingetragen, damit „Gegessen" nicht doppelt geht.
  if(_dietQueued(r)){_dietPendingMeal(m,mealId,slot,mealTx);toast(DIET_QUEUED_TX);return 'queued';}
  const fl=await refreshFoodlog();
  const label=r.data?.label||m?.label||'';
  const row=(fl?.items||[]).slice().reverse().find(it=>(it.meal_id&&+it.meal_id===+mealId)||(it.details&&it.food===label));
  toast((label||'Mahlzeit')+' eingetragen ✓',row?{label:'Rückgängig',fn:async()=>{const dr=await API.del('/foodlog/'+row.id);
    if(dr.status===0)return toast('Dafür brauchst du kurz Netz'); // Löschen wartet nicht in der Outbox
    await refreshFoodlog();toast(dr.status===200?'Zurückgenommen':'Eintrag ist nicht mehr da');}}:undefined);
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
  h+=recipes.map(rc=>{const dk=Math.round((rc.kcal||0)-mealKcal),dp=Math.round((rc.protein||0)-mealP);const dpill=rc.diet==='vegan'?` <span class="pill neutral" role="img" title="Vegan" aria-label="Vegan">${icon('sprout',12)}</span>`:rc.diet==='veg'?` <span class="pill neutral" role="img" title="Vegetarisch" aria-label="Vegetarisch">${icon('carrot',12)}</span>`:'';
    return `<div class="row tap" role="button" tabindex="0" onclick="doSwapMeal(${mealId},${rc.id})"><div class="rl">${esc2(rc.name)}${dpill}<small>${macroLine(rc.protein,rc.carbs,rc.fat)}</small></div><div class="rr wrap"><span class="swap-diff"><b>${fmtNum(Math.round(rc.kcal))} kcal</b><span class="caption ${Math.abs(dk)<=60?'':'tone-amber'}">${sgn(dk)} kcal · ${sgn(dp)} g P</span></span></div></div>`;}).join('')+`</div>`;
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
// Das kcal-Ziel des angezeigten Tagtyps – EINE Quelle: der Server (GET /api/foodlog → summary).
// Bis hierher nahm der Plan-Tab zuerst das Profilziel (kcal_target_train/rest). Der Server verwirft dieses
// Ziel aber, sobald es mehr als 7 % von der Formel abweicht (planTargets/KCAL_DRIFT_PCT), und rechnet neu.
// Dadurch standen in EINEM Konto an EINEM Tag zwei Zahlen nebeneinander: Heute „Ruhetag · 2.975 kcal"
// (Serverziel) und im Plan „Ziel 2.600 kcal" (Profil) – mit einem daraus erfundenen „259 kcal drüber".
// summary.kcalAsk trägt beide Tagtypen mit gespeichertem UND neu gerechnetem Wert; damit stimmt auch der
// Tagtyp, der heute nicht dran ist. Das Profilziel ist erst der letzte Rückfall (Server hat nichts gesagt).
function dietTargetKcal(){const sum=renderDiet.foodlog?.summary||{};
  const todayType=renderDiet.foodlog?.dayType||renderDiet.todayType;
  if(DIET===todayType){const t=Math.round(sum.targets?.kcal||sum.target||0);if(t)return t;}
  const ask=sum.kcalAsk&&sum.kcalAsk[DIET==='training'?'train':'rest']; // Server rechnet neu -> BEIDE Tagtypen
  if(ask&&ask.suggested>0)return Math.round(ask.suggested);
  const prof=(_dietSelf()?ME:(VIEW_USER_PROFILE||ME))||{};  // kein Serverwort: gespeichertes Ziel
  return (DIET==='training'?(prof.kcal_target_train||0):(prof.kcal_target_rest||0));}
// Proteinziel des ANGEZEIGTEN Tagtyps. Es kommt nur für den heutigen Tagtyp vom Server
// (summary.targets.protein) – für den anderen gibt es keinen Serverwert, und geraten wird hier nichts.
function dtPlanTargetProtein(){const todayType=renderDiet.foodlog?.dayType||renderDiet.todayType;
  if(DIET!==todayType)return 0;
  return Math.round(renderDiet.foodlog?.summary?.targets?.protein||0);}
// Trifft der Plan die Ziele? Toleranz wie in der Zeile über den Mahlzeiten: 120 kcal; beim Eiweiß 5 %
// (mindestens 5 g) nach unten – darüber ist kein Mangel, sondern erwünscht.
function dtPlanFit(totKcal,totProtein,target){const tp=dtPlanTargetProtein();
  const dk=target?Math.round((totKcal||0)-target):0;
  const dp=tp?Math.round((totProtein||0)-tp):0;
  return {hasK:!!target,hasP:!!tp,dk,dp,
    kOk:!target||Math.abs(dk)<=120,
    pOk:!tp||dp>=-Math.max(5,Math.round(tp*0.05))};}
// Der Hinweis unter den Mahlzeiten. Er behauptete unbedingt „Der Plan trifft dein kcal- und Proteinziel" –
// auch direkt unter „259 kcal drüber" und bei 166 g Eiweiß gegen 179 g Ziel. Jetzt sagt er, was die Zahlen
// darüber sagen, und nennt den Weg zurück zum Ziel.
function dtPlanFitTx(totKcal,totProtein,target){const f=dtPlanFit(totKcal,totProtein,target);const self=_dietSelf();
  const zielD=self?'deinem Ziel':'dem Ziel des Athleten';
  const tail=self?'Mengen sind Richtwerte – mit „Tauschen“ ersetzt du eine Mahlzeit durch ein Rezept, mit „Gegessen“ landet sie im Protokoll.'
    :'Mengen sind Richtwerte. Eintragen und Tauschen macht der Athlet selbst – über „Plan neu erstellen“ passt du die Vorgabe an.';
  if(!f.hasK)return `Für diesen Tagtyp steht noch kein Kalorienziel – der Plan lässt sich deshalb an nichts messen. ${tail}`;
  const kTx=`${fmtNum(Math.abs(f.dk))} kcal ${f.dk>0?'über':'unter'} ${zielD}`;
  const pTx=`${fmtNum(Math.abs(f.dp))} g Eiweiß`;
  let s;
  if(!f.kOk&&!f.pOk)s=`Der Plan liegt ${kTx} und es fehlen ihm ${pTx} auf das Proteinziel.`;
  else if(!f.kOk)s=`Der Plan liegt ${kTx}.`;
  else if(!f.pOk)s=`Der Plan trifft das Kalorienziel, es fehlen ihm aber ${pTx} auf das Proteinziel.`;
  else s=`Der Plan trifft ${f.hasP?(self?'dein kcal- und Proteinziel':'das kcal- und Proteinziel des Athleten')
    :(self?'dein Kalorienziel für diesen Tagtyp':'das Kalorienziel des Athleten für diesen Tagtyp')}.`;
  if(!f.kOk||!f.pOk)s+=` Mit „Plan neu erstellen“ ${self?'rechnen wir ihn auf dein aktuelles Ziel':'entsteht er neu aus dem aktuellen Ziel'}.`;
  return `${s} ${tail}`;}
// D10: Weicht das gespeicherte kcal-Ziel um mehr als 7 % von der Formel ab, rechnet der Server neu und legt
// beide Zahlen als summary.kcalAsk in dieselbe Antwort. Gezeigt wurde das nirgends – im Profil und beim
// Coach stand weiter die alte Zahl, in der Ernährung die neue, und niemand konnte den Unterschied erklären.
// `hero` = kurze Zeile in der Heute-Karte (dort steht auch die Rückfrage), sonst eigene Notiz über den Mahlzeiten.
function dtKcalAskNote(dayType,hero){const ask=renderDiet.foodlog?.summary?.kcalAsk;if(!ask)return '';
  const d=ask[dayType==='training'?'train':'rest']||null;
  const saved=Math.round((d?d.saved:ask.saved)||0),sug=Math.round((d?d.suggested:ask.suggested)||0);
  if(!sug||!saved||saved===sug)return '';
  const self=_dietSelf();
  const kg=ask.weightKg?fmtNum(ask.weightKg,1):''; // eine Nachkommastelle wie überall beim Gewicht
  const tagTx=dayType==='training'?'Trainingstage':'Ruhetage';
  const txt=`${self?'Dein gespeichertes Ziel':'Das gespeicherte Ziel'} für ${tagTx} (${fmtNum(saved)} kcal) passt nicht mehr zum aktuellen Gewicht${kg?' von '+kg+' kg':''} – gerechnet wird mit ${fmtNum(sug)} kcal.`;
  // Die Rückfrage steht nur in der Heute-Karte (eine Frage, eine Stelle) und nur im eigenen Konto –
  // das Profil des Athleten schreibt der Coach über „Phase & Ziele", nicht über diese Zeile.
  // B-I.4: Auf EINEM Bildschirm steht nur EINE Frage nach dem Kalorienziel. Zeigt die Wochenanpassung
  // darunter gerade „Übernehmen / Behalten", tritt diese ältere Rückfrage auf ihren Erklärsatz zurück.
  // Gemessen, bevor das hier stand (00-konflikt-zwei-fragen.png): zwei Knopfpaare untereinander mit
  // ZWEI verschiedenen Zielzahlen – 2.975 kcal aus der Formel, 2.720 kcal aus der Messung. Das ist
  // keine Wahl, das ist ein Widerspruch. Der Satz bleibt stehen (P3), die Entscheidung gehört der
  // gemessenen Zahl: sie ist die jüngere und die belegtere.
  const acts=(hero&&self&&!dtAskAnswered(ask)&&!adpDecisionOpen())?dtKcalAskActions(ask):'';
  if(hero)return `<div class="dh-note">${icon('info',16)}<span>${esc2(txt)}${acts}</span></div>`;
  return `<div class="note status dt-ask mb-3"><div class="fill">${esc2(txt)}</div>${
    self?`<button class="btn sm sec" onclick="openProfile()">Im Profil ändern</button>`:''}</div>`;}
// D10, zweiter Teil: Die App fragt EINMAL, statt das Ziel still zu überschreiben oder still stehen zu lassen.
// „Übernehmen" schreibt die gerechneten Ziele BEIDER Tagtypen ins Profil – danach stimmen Profil, Startseite,
// Ernährung und Coach-Übersicht wieder überein und der Server hat nichts mehr zu korrigieren.
// „Behalten" lässt das gespeicherte Ziel stehen und merkt sich genau dieses Zahlenpaar lokal; der erklärende
// Satz bleibt trotzdem stehen (im Ring steht ja weiter eine andere Zahl als im Profil). Ändert sich das
// Gewicht oder das Ziel, ist das Paar ein anderes – dann fragt die App erneut.
function dtAskKey(ask){const u=(typeof VIEW_USER!=='undefined'&&VIEW_USER!=null)?VIEW_USER:0;
  return 'be_kcalask_'+u+'_'+Math.round(ask?.train?.suggested||0)+'_'+Math.round(ask?.rest?.suggested||0);}
function dtAskAnswered(ask){try{return !!localStorage.getItem(dtAskKey(ask));}catch(e){return false;}}
function dtKcalAskActions(ask){const t=Math.round(ask.train?.suggested||0),r=Math.round(ask.rest?.suggested||0);
  if(!t&&!r)return '';
  const was=[t?fmtNum(t)+' kcal an Trainingstagen':'',r?fmtNum(r)+' kcal an Ruhetagen':''].filter(Boolean).join(' und ');
  // Beide Knöpfe ohne Akzentfläche: das hier ist eine Rückfrage, nicht der Primär-CTA der Seite. Rot gefüllt
  // stünde „Übernehmen" lauter da als „Gegessen" darunter – und eine Rückfrage nach dem Kalorienziel ist nie
  // das Wichtigste auf dem Heute-Reiter (P4). Die Empfehlung bleibt trotzdem erkennbar: eigene Fläche (`sec`)
  // gegen durchsichtig (`ghost`).
  return `<span class="dt-ask-acts"><button class="btn sm sec" onclick="dtKcalAskApply()">Übernehmen</button>`+
    `<button class="btn sm ghost" onclick="dtKcalAskKeep()">Behalten</button>`+
    `<small>Übernehmen trägt ${was} in dein Profil ein.</small></span>`;}
async function dtKcalAskApply(){const ask=renderDiet.foodlog?.summary?.kcalAsk;if(!ask||!_dietSelf())return;
  const t=Math.round(ask.train?.suggested||0),r=Math.round(ask.rest?.suggested||0);
  if(!t&&!r)return;
  const body={};if(t)body.kcal_target_train=t;if(r)body.kcal_target_rest=r;
  const res=await API.put('/profile',body);
  if(res.status!==200)return toast(_dietErrTx(res,'Fehler – nicht gespeichert'));
  try{localStorage.setItem(dtAskKey(ask),'1');}catch(e){}
  if(typeof ME==='object'&&ME){if(t)ME.kcal_target_train=t;if(r)ME.kcal_target_rest=r;}
  await refreshFoodlog(true);   // holt das Protokoll neu; ohne Abweichung liefert der Server kcalAsk:null
  toast('Ziel übernommen ✓');}
function dtKcalAskKeep(){const ask=renderDiet.foodlog?.summary?.kcalAsk;if(!ask)return;
  try{localStorage.setItem(dtAskKey(ask),'1');}catch(e){}
  if(document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();
  toast('Gespeichertes Ziel bleibt – gerechnet wird weiter mit dem neuen Wert');}
let OPEN_MEALS=new Set();
function toggleMeal(id){const el=document.getElementById('meal-'+id);if(!el)return;const on=el.classList.toggle('open');
  // aria-expanded mitfuehren – sonst liest ein Screenreader dauerhaft „eingeklappt" (A-II.6)
  const h=el.querySelector('.meal-h');if(h)h.setAttribute('aria-expanded',on?'true':'false');
  if(on)OPEN_MEALS.add(id);else OPEN_MEALS.delete(id);}
function drawDiet(){_dietMark('plan');const allMeals=renderDiet.meals||[];const meals=planMeals(DIET);
  const el=document.getElementById('dietBody');if(!el)return;
  const target=dietTargetKcal();
  const isToday=DIET===(renderDiet.todayType||DIET);
  // Ohne echte Antwort NICHT „Noch kein Ernährungsplan" anbieten: „Plan automatisch erstellen" würde offline
  // zwar nichts tun, online aber den vorhandenen Plan überschreiben, den der Athlet gerade nur nicht sieht.
  if(!allMeals.length&&!renderDiet.mealsOk){el.innerHTML=dtLoadNote('plan',renderDiet.mealsSt);return;}
  if(!allMeals.length){
    el.innerHTML=emptyState({icon:'utensils',title:'Noch kein Ernährungsplan',text:'Aus deinem Profil (Gewicht, Größe, Ziel) entsteht automatisch ein Plan mit konkreten Mahlzeiten für Trainings- und Ruhetage.',btn:{label:'Plan automatisch erstellen',onclick:'genMealPlan()'}})+
      `<button class="btn sec mt-2" onclick="openDislikes()">Erst Lebensmittel ausschließen</button>`;return;}
  const tot={kcal:0,protein:0,carbs:0,fat:0};meals.forEach(m=>{const t=mealTotals(m);tot.kcal+=t.kcal;tot.protein+=t.protein;tot.carbs+=t.carbs;tot.fat+=t.fat;});
  let h=`<div class="diet-seg-row"><div class="seg"><button class="${DIET==='training'?'on':''}" onclick="setDiet('training')">Trainingstag</button><button class="${DIET==='rest'?'on':''}" onclick="setDiet('rest')">Ruhetag</button></div><button class="btn icon sm" aria-label="Plan-Optionen" onclick="openPlanOptions()">${icon('more')}</button></div>`;
  h+=macroRow(tot.kcal,tot.protein,tot.carbs,tot.fat,target||undefined);
  // Sanity-Zeile: Plan-Summe gegen dasselbe Ziel, das die Heute-Karte zeigt – dazu das Eiweiß, wenn der
  // Server ein Proteinziel für diesen Tagtyp genannt hat. Aus genau diesen Zahlen entsteht auch der
  // Hinweissatz unter den Mahlzeiten (dtPlanFitTx) – eine Rechnung, zwei Stellen, kein Widerspruch.
  if(target){const F=dtPlanFit(tot.kcal,tot.protein,target);const diff=F.dk;
    h+=`<div class="plan-status meta"><span>Plan ${fmtNum(Math.round(tot.kcal))} kcal</span> · <span>Ziel ${fmtNum(target)} kcal</span> · <span class="${F.kOk?'tone-green':'tone-amber'}">${F.kOk?'passt':(diff>0?fmtNum(diff)+' kcal drüber':fmtNum(-diff)+' kcal drunter')}</span>${
      F.hasP?` · <span>Eiweiß ${fmtNum(Math.round(tot.protein))} / ${fmtNum(dtPlanTargetProtein())} g</span>${F.pOk?'':` · <span class="tone-amber">${fmtNum(Math.abs(F.dp))} g fehlen</span>`}`:''}</div>`;}
  h+=dtKcalAskNote(DIET,false);
  if(isToday)h+=nextMealCard();
  if(!meals.length){h+=emptyState({icon:'utensils',title:'Keine Mahlzeiten für diesen Tagtyp',text:'Erstelle den Plan neu, damit beide Tagtypen befüllt werden.',btn:{label:'Plan neu erstellen',onclick:'genMealPlan()'}});el.innerHTML=h;return;}
  const L=loggedMealIds();const next=isToday?nextPlanMeal(null,dtDate()):null;const self=_dietSelf();
  h+=meals.map(m=>{const t=mealTotals(m);const done=isToday&&mealLogged(m,L);const slot=mealSlotOf(m);
    const open=OPEN_MEALS.has(m.id)||(next&&!next.logged&&next.mealId===m.id&&!OPEN_MEALS.size);
    const norm=s=>String(s||'').toLowerCase().replace(/[^a-zäöüß]/g,'');
    const showSlot=!norm(m.label).startsWith(norm(slot)); // Slot nur zeigen, wenn das Label ihn nicht schon nennt
    const names=(m.items||[]).map(i=>i.food).join(', ');
    return `<div class="meal${open?' open':''}${done?' done':''}" id="meal-${m.id}">
      <div class="meal-h" role="button" tabindex="0" aria-expanded="${open?'true':'false'}" aria-controls="mealb-${m.id}" onclick="toggleMeal(${m.id})">
        <div class="ml">${done?`<div class="n ok">${icon('check',12)} Eingetragen</div>`:showSlot?`<div class="n">${esc2(slot)}</div>`:''}<div class="t">${esc2(m.label||'')}</div><div class="prev-line caption truncate">${esc2(names)}</div></div>
        <div class="kc">${fmtNum(Math.round(t.kcal))} kcal<em>${fmtNum(Math.round(t.protein))} g P</em></div>
        <span class="meal-chev">${icon('chevronDown',18)}</span>
      </div>
      <div class="meal-body" id="mealb-${m.id}">
        ${(m.items||[]).map(it=>`<div class="fi"><div class="fill"><div class="fn">${esc2(it.food)}${it.amount?` <span class="muted">· ${fmtNum(it.amount)} ${foodUnit(it.food)}${dtCookedOf(it)}</span>`:''}</div><div class="fi-mac caption">${macroLine(it.protein,it.carbs,it.fat)}</div>${it.notes?`<div class="fm">${esc2(it.notes)}</div>`:''}</div><div class="fmac">${fmtNum(Math.round(it.kcal||0))} kcal</div></div>`).join('')}
        ${self?`<div class="meal-acts cluster">
          ${/* „Gegessen" in der aufgeklappten Mahlzeit ist NICHT rot gefüllt: über der Liste steht dieselbe
               Handlung schon einmal als Primär-Knopf in der „Laut Plan als Nächstes"-Karte. Zweimal
               dieselbe rote Fläche für dieselbe Sache auf einem Bildschirm – genau das meint P4 mit
               „eine Farbe, eine Bedeutung". Die Handlung bleibt an Ort und Stelle, sie schreit nur nicht. */''}
          ${done?`<button class="btn sm sec" disabled>${icon('check',16)} Eingetragen</button>`:`<button class="btn sm sec" onclick="logFromMeal(${m.id})">${icon('check',16)} Gegessen</button>`}
          <button class="btn sm ghost" onclick="swapMeal(${m.id},${Math.round(t.kcal)},'${esc(m.label||'')}')">Tauschen</button>
          ${m.recipe_id?`<button class="btn sm ghost" onclick="restoreMeal(${m.id})">Original</button>`:''}
        </div>`:''}
      </div></div>`;}).join('');
  h+=infoBox(self?'dietplan_note':'dietplan_note_coach',esc2(dtPlanFitTx(tot.kcal,tot.protein,target)));
  el.innerHTML=h;}
// Plan-Optionen (⋯): neu erstellen, ausschließen, nur berechnen, Einkaufswagen
function openPlanOptions(){openSheet('Plan-Optionen',`<div class="rows">
    <div class="row tap" role="button" tabindex="0" onclick="closeModal();genMealPlan()"><div class="r-ic">${icon('refresh')}</div><div class="rl">Plan neu erstellen<small>Automatisch aus Profil und Ziel</small></div><div class="rr"></div></div>
    <div class="row tap" role="button" tabindex="0" onclick="closeModal();openDislikes()"><div class="r-ic">${icon('x')}</div><div class="rl">Lebensmittel ausschließen<small>Was nicht im Plan landen soll</small></div><div class="rr"></div></div>
    <div class="row tap" role="button" tabindex="0" onclick="closeModal();openCalc()"><div class="r-ic">${icon('scale')}</div><div class="rl">Nur berechnen<small>Makro-Rechner für ein Lebensmittel</small></div><div class="rr"></div></div>
    <div class="row tap" role="button" tabindex="0" onclick="closeModal();adpOpenSettings()"><div class="r-ic">${icon('trendUp')}</div><div class="rl">Ziele automatisch anpassen<small>${adpOn()?'An – jede Anpassung fragt dich vorher':'Aus – dein Ziel kommt aus der Formel'}</small></div><div class="rr"></div></div>
    ${_dietSelf()?`<div class="row tap" role="button" tabindex="0" onclick="closeModal();dietTab('cart')"><div class="r-ic">${icon('cart')}</div><div class="rl">Zum Einkaufswagen<small>Einkaufsliste verwalten</small></div><div class="rr"></div></div>`:''}
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
  const dietLbl={all:'',vegetarian:'Vegetarisch',vegan:'Vegan'}[dt];
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
  // Dieselbe Normalisierung wie bei den Lebensmitteln: „huhn reis" findet „Hühnerbrust mit Reis", auch wenn
  // ein Wort im Namen und das andere in den Zutaten steht – deshalb laufen alle drei Felder als ein Text durch.
  if(q){const toks=dtToks(q);recipes=recipes.filter(rc=>dtHit((rc.name||'')+' '+(rc.ingredients||'')+' '+(rc.category||''),toks));}
  if(!q&&f.simKcal)recipes=[...recipes].sort((a,b)=>Math.abs((a.kcal||0)-f.simKcal)-Math.abs((b.kcal||0)-f.simKcal));
  const ch=document.getElementById('rcChips');if(ch)ch.innerHTML=_rcChips();
  RECIPES_CACHE=recipes;
  if(!recipes.length){el.innerHTML=emptyState({icon:'search',title:q?'Nichts gefunden':'Keine Rezepte für diese Filter',text:q?'Versuch einen anderen Begriff.':'Ändere die Filter oder leg ein eigenes Rezept an.',btn:q?null:{label:'Filter ändern',onclick:'openRecipeFilter()'}});return;}
  const hideMeal=!q&&f.meal!=='all';const self=_dietSelf();
  el.innerHTML=(q?`<div class="caption mb-2">${recipes.length} Treffer in allen Rezepten</div>`:'')+'<div class="rows">'+recipes.map(rc=>{
    const goalTxt=({muscle:'Aufbau',fatloss:'Definition',health:'Gesundheit'})[rc.goal]||'';
    const dpill=rc.diet==='vegan'?` <span class="pill neutral" role="img" title="Vegan" aria-label="Vegan">${icon('sprout',12)}</span>`:rc.diet==='veg'?` <span class="pill neutral" role="img" title="Vegetarisch" aria-label="Vegetarisch">${icon('carrot',12)}</span>`:'';
    const mine=rc.owner_id===ME?.id, shared=rc.owner_id&&!mine;
    const tag=mine?' <span class="pill neutral">eigenes</span>':shared?' <span class="pill red">geteilt</span>':'';
    const thumb=rc.has_photo?`<div class="rc-thumb" data-rcthumb="${rc.id}"></div>`:'';
    const meta=[hideMeal?'':rc.meal_type,rc.category,goalTxt].filter(Boolean).map(esc2).join(' · ');
    return `<div class="row tap" role="button" tabindex="0" onclick="openRecipe(${rc.id})">${thumb}<div class="rl">${esc2(rc.name)}${dpill}${tag}<small>${meta?meta+'<br>':''}${macroLine(rc.protein,rc.carbs,rc.fat)}</small></div><div class="rr"><span>${fmtNum(Math.round(rc.kcal))} kcal</span>${self?`<button class="btn icon sm ghost" aria-label="Als gegessen eintragen" onclick="event.stopPropagation();logRecipe(${rc.id},{quick:true})">${icon('plus',20)}</button>`:''}</div></div>`;}).join('')+'</div>';
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
  h+=grp('Ernährungsweise','diet',[['all','Alle'],['vegetarian','Vegetarisch'],['vegan','Vegan']],dt,'setDietType');
  h+=grp('Quelle','source',[['all','Alle'],['mine','Eigene'],['shared','Geteilt']],f.source||'all');
  if(RECIPE_CATS.length)h+=grp('Kategorie','category',[['all','Alle'],...RECIPE_CATS.map(c=>[c,c])],f.category||'all');
  if(remaining>0)h+=`<label class="switch-row rows mb-3"><div class="rl">Nur was ins Budget passt<small>${fmtNum(remaining)} kcal übrig</small></div><input type="checkbox" class="rcheck" ${f.fit?'checked':''} onchange="recipeFilter('fit',this.checked)"></label>`;
  h+=`<div class="rows mb-3"><div class="row tap" role="button" tabindex="0" onclick="openDislikes()"><div class="r-ic">${icon('x')}</div><div class="rl">Zutaten ausschließen<small>${myDisliked().length?pl(myDisliked().length,'Lebensmittel','Lebensmittel')+' ausgeschlossen':'Unverträglichkeiten, Abneigungen'}</small></div><div class="rr"></div></div></div>`;
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
  const dpill=rc.diet==='vegan'?' · Vegan':rc.diet==='veg'?' · Vegetarisch':'';
  const isMine=rc.owner_id===ME?.id;
  let h='';
  if(rc.photo)h+=`<img id="rc_photo" alt="Foto des Rezepts ${esc2(rc.name)}" class="rc-photo">`; // src wird unten als Property gesetzt
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
    <div class="row tap" role="button" tabindex="0" onclick="shareViaLink('recipe',${rc.id})"><div class="r-ic">${icon('link')}</div><div class="rl">Per Link teilen</div><div class="rr"></div></div>
    ${(rc.link&&/^https?:\/\//.test(rc.link))?`<a class="row tap" href="${esc2(rc.link)}" target="_blank" rel="noopener"><div class="r-ic">${icon('play')}</div><div class="rl">Rezept ansehen (extern)</div><div class="rr"></div></a>`:''}
    ${isMine?`<div class="row tap" role="button" tabindex="0" onclick="delRecipe(${rc.id})"><div class="r-ic tone-red">${icon('trash')}</div><div class="rl tone-red">Löschen</div><div class="rr"></div></div>`:''}
  </div>`);}
// Teilen-Sheet: Personen (Athlet->Athlet gleicher Coach, Coach->Athleten) + Link an einem Ort
async function openShareRecipe(id,name){const title='„'+name+'“ teilen';openSheet(title,'<div class="spinner"></div>');
  const r=await API.get('/recipes/'+id+'/share-targets');
  if(r.status!==200){openSheet(title,`<div class="note err mb-3">${esc2(r.data?.error||'Fehler')}</div><div class="rows"><div class="row tap" role="button" tabindex="0" onclick="shareViaLink('recipe',${id})"><div class="r-ic">${icon('link')}</div><div class="rl">Per Link teilen</div><div class="rr"></div></div></div>`);return;}
  const t=r.data;
  let h=`<div class="rows mb-3"><div class="row tap" role="button" tabindex="0" onclick="shareViaLink('recipe',${id})"><div class="r-ic">${icon('link')}</div><div class="rl">Per Link teilen<small>Funktioniert für jeden – auch ohne Konto</small></div><div class="rr"></div></div></div>`;
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
  const r=await API.post('/recipes/'+id+'/log',{user_id:VIEW_USER,date:dtLogDay(),meal_slot:slot});
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
    <div class="field"><label>Eiweiß</label><input id="nr_p" type="number" inputmode="numeric" placeholder="g"></div>
    <div class="field"><label>Kohlenhydrate</label><input id="nr_c" type="number" inputmode="numeric" placeholder="g"></div>
    <div class="field"><label>Fett</label><input id="nr_f" type="number" inputmode="numeric" placeholder="g"></div>
  </div>
  <details class="more mb-4"><summary>Mehr Angaben</summary>
    <div class="mt-3">
    <div class="field"><label>Ziel (optional)</label><select id="nr_goal"><option value="">für alle</option><option value="muscle">Aufbau</option><option value="fatloss">Definition</option><option value="health">Gesundheit</option></select></div>
    <div class="field"><label>Zutaten (eine pro Zeile)</label><textarea id="nr_ing" rows="3" placeholder="100 g Haferflocken\n300 ml Milch"></textarea></div>
    <div class="field"><label>Zubereitung</label><textarea id="nr_steps" rows="2" placeholder="1. …"></textarea></div>
    <div class="grid-2">
      <div class="field"><label>Kategorie</label><input id="nr_cat" list="catlist" placeholder="z.B. Bowl, Smoothie"><datalist id="catlist">${(RECIPE_CATS||[]).map(c=>`<option value="${esc2(c)}">`).join('')}</datalist></div>
      <div class="field"><label>Ernährungsweise</label><select id="nr_diet"><option value="">egal</option><option value="veg">Vegetarisch</option><option value="vegan">Vegan</option></select></div>
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
    const pv=document.getElementById('nr_photo_prev');if(pv)pv.innerHTML=`<img src="${NR_PHOTO}" alt="Vorschau des gewählten Rezeptfotos" class="rc-photo"><button class="btn sm sec" onclick="NR_PHOTO=null;document.getElementById('nr_photo_prev').innerHTML='';">Foto entfernen</button>`;
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
  // Derselbe Fall wie bei Plan und Protokoll: ohne Antwort ist der Wagen nicht leer, er ist nur nicht da
  if(!items.length&&r.status!==200){el.innerHTML=dtLoadNote('cart',r.status);return;}
  if(!items.length){h+=emptyState({icon:'cart',title:'Dein Einkaufswagen ist leer',text:'Übernimm deinen Plan, leg Rezept-Zutaten hinein oder füge selbst etwas hinzu.',btn:{label:'Aus Plan übernehmen',onclick:'cartFromPlan()'}});
    el.innerHTML=h;return;}
  const open=items.filter(i=>!i.checked), done=items.filter(i=>i.checked);
  const row=i=>`<div class="row cart-row${i.checked?' done':''}" role="button" tabindex="0" aria-pressed="${i.checked?'true':'false'}" onclick="cartToggle(${i.id})">
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
    <div class="row tap" role="button" tabindex="0" onclick="closeModal();cartToggle(${id})"><div class="r-ic">${icon('check')}</div><div class="rl">${checked?'Wieder offen':'Erledigt'}</div><div class="rr"></div></div>
    <div class="row tap" role="button" tabindex="0" onclick="cartDelete(${id})"><div class="r-ic tone-red">${icon('trash')}</div><div class="rl tone-red">Entfernen</div><div class="rr"></div></div></div>`);}
async function cartDelete(id){const cur=(await API.get('/cart')).data?.items?.find(i=>i.id===id);
  const r=await API.del('/cart/item/'+id);if(r.status!==200)return toast(r.data?.error||'Fehler');
  closeAllSheets();drawCart();
  if(cur)toast('Entfernt',{label:'Rückgängig',fn:async()=>{await API.post('/cart/add',{text:cur.text,source:cur.source||'manual'});drawCart();toast('Wiederhergestellt ✓');}});}
function cartMore(){openSheet('Einkaufswagen',`<div class="rows">
    <div class="row tap" role="button" tabindex="0" onclick="closeModal();cartClear(true)"><div class="r-ic">${icon('check')}</div><div class="rl">Erledigte entfernen</div><div class="rr"></div></div>
    <div class="row tap" role="button" tabindex="0" onclick="cartClear(false)"><div class="r-ic tone-red">${icon('trash')}</div><div class="rl tone-red">Wagen leeren</div><div class="rr"></div></div></div>`);}
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
    // Version fest UND Inhalt fest (Subresource Integrity): der Browser führt die Datei nur aus, wenn ihr
    // SHA-384 exakt passt. Ein kompromittiertes CDN oder eine manipulierte Verbindung könnte sonst fremden
    // Code in den App-Ursprung laden – mit vollem Zugriff auf alle /api-Aufrufe des angemeldeten Nutzers.
    // crossorigin="anonymous" ist für die Prüfung Pflicht (ohne CORS liefert der Browser keine Bytes zum
    // Vergleich). Hash berechnet aus @zxing/library@0.21.3/umd/index.min.js (336008 Byte, unpkg + jsdelivr
    // identisch). Bei einem Versionswechsel MUSS der Hash neu berechnet werden, sonst lädt der Scanner nicht.
    s.src='https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
    s.integrity='sha384-BzBxP10ZE72aitqj5UMmUsbKFliP/DZqA8Wq+BNNhlIJDGoEd1tpkMYXOg9+n6sB';
    s.crossOrigin='anonymous';
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
    // Auf 120 Zeichen kürzen wie der Server das Protokollfeld: sonst hieße dasselbe Produkt im Protokoll
    // anders als im gespeicherten Lebensmittel und die „Zuletzt"-Liste fände es nicht wieder.
    const per100={name:((d.product.product_name||'Produkt')+(d.product.brands?' ('+d.product.brands.split(',')[0]+')':'')).slice(0,120),
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
// Gescanntes Produkt als eigenes Lebensmittel sichern (M1): ohne das ist derselbe Proteinriegel morgen wieder
// weg und muss neu gescannt werden – gescannte Einträge fielen bisher aus „Zuletzt" heraus, weil dort nur
// Zeilen aus FOODS gezeichnet werden. Open Food Facts liefert die Werte pro 100 g, also genau das Format von
// POST /api/foods. Nur im eigenen Konto (der Server hängt owner_id an req.user), nur wenn es den Namen noch
// nicht gibt, und nur mit echten Makros – 0/0/0 wäre in der Liste eine Zeile „0 kcal / 100 g", also Rauschen.
async function dtRememberFood(p){try{
    if(!p||!p.name||!_dietSelf())return null;
    const k=dtNorm(p.name);if(FOODS.some(f=>dtNorm(f.name)===k))return null;
    const P=+p.protein||0,C=+p.carbs||0,F=+p.fat||0;if(P+C+F<=0)return null;
    const r=await API.post('/foods',{name:p.name,protein:P,carbs:C,fat:F,per100:true});
    if(r.status!==200||!r.data?.id)return null;
    // Der Server speichert pro 1 g. Die Liste lokal genauso fortschreiben, statt alle Lebensmittel neu zu holen.
    FOODS.push({id:r.data.id,name:p.name,protein:P/100,carbs:C/100,fat:F/100,owner_id:ME?.id,use_count:1});
    return r.data.id;
  }catch(e){return null;}}
async function logScannedProduct(){const f=BC_FOUND;if(!f)return;const a=(num('bc_amt')||0);
  if(a<=0)return showFieldErr('bcForm','Bitte eine Menge angeben','bc_amt');
  const k=a/100;const slot=val('bc_slot')||slotDefault();slotRemember(slot);
  const body={user_id:VIEW_USER,date:dtLogDay(),meal_slot:slot,food:f.name,amount:a,
    kcal:Math.round(f.kcal*k),protein:r1(f.protein*k),carbs:r1(f.carbs*k),fat:r1(f.fat*k)};
  const r=await API.post('/foodlog',body,{queue:true,kind:'food',label:f.name});
  if(!_dietOk(r))return toast(r.data?.error||'Fehler');
  const pend=_dietQueued(r)?body:null; // wartet in der Outbox -> nicht nachladen, sondern lokal nachführen
  if(!pend)await dtRememberFood(f); // ab jetzt steht das Produkt in der Liste und unter „Zuletzt"
  // Aus dem „Essen hinzufügen"-Sheet heraus: eine Ebene zurück, Scanner wieder starten, Zähler hochzählen
  if(typeof SHEET_STACK!=='undefined'&&SHEET_STACK.length>1){closeModal();
    if(document.getElementById('lfSeg')){lfTab(2,{focus:false});await _lfAfterAdd(Math.round(f.kcal*k),f.name,{pending:pend});return;}}
  closeAllSheets();
  if(pend){_dietPending(pend);toast(DIET_QUEUED_TX);}
  else{await refreshFoodlog(false);toast(f.name+' eingetragen ✓');}
  if(document.getElementById('dietBody'))dietTab('track');}

// ===== MAKRO-RECHNER („Nur berechnen" aus den Plan-Optionen) =====
let CALC_SEL=null;
// FOODS füllt seit 2.9.0 nicht mehr der Start, sondern der Ernährungs-Reiter (_dietEnsureFoods) bzw.
// rpLater() in core.js. Der Rechner ist auch aus der globalen Suche heraus erreichbar, also aus einer
// Ansicht, die die Liste nie angefordert hat: dort forderte „Lädt…" bisher etwas an, das niemand lud.
function openCalc(){if(!FOODS.length){_dietEnsureFoods();return toast('Lädt – gleich nochmal tippen');}CALC_SEL=null;
  openSheet('Makro-Rechner',`${infoBox('calc_intro','Such ein Lebensmittel, gib die Menge ein – Kalorien und Makros werden sofort berechnet und lassen sich direkt ins Protokoll übernehmen.')}
    <div class="field lf-search"><label>Lebensmittel suchen</label><div class="lf-searchwrap">${icon('search',18)}<input id="calc_search" type="search" placeholder="z.B. Reis, Hähnchen…" oninput="filterCalcFoods(this.value)" autocomplete="off"></div></div>
    <div id="calc_list" class="mb-3"></div>
    <div id="calc_sel" hidden><div class="between mb-2"><div class="h3 fill truncate" id="calc_name"></div><button class="btn sm sec" onclick="calcClear()">ändern</button></div>
    <div class="field"><label id="calc_unit">Menge (g)</label><input id="calc_amt" type="number" inputmode="decimal" value="100" oninput="doCalc()"></div>
    <div class="macro-row" id="calc_out"></div>
    ${slotSelect('calc_slot')}
    ${_dietSelf()?'<button class="btn block" onclick="calcAddToLog()">Ins Protokoll eintragen</button>':''}</div>`);
  filterCalcFoods('');setTimeout(()=>document.getElementById('calc_search')?.focus(),60);}
function filterCalcFoods(q){const toks=dtToks(q);const el=document.getElementById('calc_list');if(!el)return;
  const seen=new Set();let list=[];FOODS.forEach((f,i)=>{const k=f.name.toLowerCase();if(seen.has(k))return;seen.add(k);if(dtHit(f.name,toks))list.push({f,i});});
  el.innerHTML='<div class="rows">'+list.slice(0,toks.length?30:10).map(x=>`<div class="row tap" role="button" tabindex="0" onclick="calcPick(${x.i})"><div class="rl">${esc2(x.f.name)}<small>${kcalUnitTxt(x.f)}</small></div><div class="rr"></div></div>`).join('')+'</div>'+(!list.length?emptyState({icon:'search',title:'Nichts gefunden'}):'');}
function calcPick(i){CALC_SEL=i;const f=FOODS[i];if(!f)return;const s=document.getElementById('calc_sel');if(s)s.hidden=false;
  const n=document.getElementById('calc_name');if(n)n.textContent=f.name;
  const u=foodUnit(f.name,f);const ul=document.getElementById('calc_unit');if(ul)ul.textContent='Menge ('+u+')';
  const ai=document.getElementById('calc_amt');if(ai&&u==='Stück')ai.value=1;
  const l=document.getElementById('calc_list');if(l)l.hidden=true;const sf=document.getElementById('calc_search');if(sf)sf.closest('.field').hidden=true;doCalc();}
function calcClear(){CALC_SEL=null;const s=document.getElementById('calc_sel');if(s)s.hidden=true;const l=document.getElementById('calc_list');if(l)l.hidden=false;const sf=document.getElementById('calc_search');if(sf){sf.closest('.field').hidden=false;sf.focus();}}
async function calcAddToLog(){if(_dietRO())return;const f=FOODS[CALC_SEL];const a=parseFloat(val('calc_amt'))||0;
  if(!f||a<=0)return toast('Menge angeben');const slot=val('calc_slot')||slotDefault();slotRemember(slot);
  const body={user_id:VIEW_USER,date:dtLogDay(),meal_slot:slot,food:f.name,amount:a,
    kcal:Math.round((f.fat*9+f.carbs*4+f.protein*4)*a),fat:f.fat*a,carbs:f.carbs*a,protein:f.protein*a};
  const r=await API.post('/foodlog',body,{queue:true,kind:'food',label:f.name});
  if(!_dietOk(r))return toast(r.data?.error||'Fehler');
  closeAllSheets();
  if(_dietQueued(r)){_dietPending(body);dietTab('track');return toast(DIET_QUEUED_TX);}
  await refreshFoodlog(false);dietTab('track');toast(f.name+' eingetragen ✓');}
function doCalc(){const f=FOODS[CALC_SEL];if(!f)return;const a=parseFloat(val('calc_amt'))||0;
  const fat=f.fat*a,carb=f.carbs*a,prot=f.protein*a,kc=fat*9+carb*4+prot*4;
  const out=document.getElementById('calc_out');if(out)out.innerHTML=`<div class="macro kcal"><div class="v">${fmtNum(Math.round(kc))}</div><div class="k">kcal</div></div><div class="macro"><div class="v">${fmtNum(prot,1)}<em>g</em></div><div class="k">Eiweiß</div></div><div class="macro"><div class="v">${fmtNum(carb,1)}<em>g</em></div><div class="k">Kohlenhydrate</div></div><div class="macro"><div class="v">${fmtNum(fat,1)}<em>g</em></div><div class="k">Fett</div></div>`;}
