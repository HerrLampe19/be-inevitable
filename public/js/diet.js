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
// DER UNTERTITEL DES GROSSEN TITELS (DESIGN-4 6.4 · 6.5 · 6.6 · 6.7).
// GEMESSEN (dz/f3/plan-v.json, Schritte T1–T4): `lgSub` war in allen vier Sichten LEER, während home,
// workout, tracker, athletes, messages, templates und admin je einen tragen. Folge: bei der Analyse
// sagt der Untertitel, welche der drei Sichten man sieht – bei der Ernährung sagte das nur der
// Zustand des Segments. Wer per Kurzweg („Plan ansehen" aus Heute, ein Suchtreffer, ein Toast mit
// „Ansehen") auf Plan oder Einkauf sprang, las oben genau ein Wort: „Ernährung".
// Die Zahlen darin stehen in DESIGN-4 wörtlich: „Rezepte · 12 gespeichert", „Einkauf · 15 Dinge,
// 4 erledigt". Sie kommen aus dem, was die Sicht gerade WIRKLICH geladen hat – ist noch nichts da,
// bleibt der Zusatz weg, statt eine Null zu behaupten.
function dtLgSub(tab){const t=tab||renderDiet.tab||'track';
  if(t==='plan')return 'Plan · '+(DIET==='training'?'Trainingstag':'Ruhetag');
  if(t==='recipes'){
    if(!renderDiet.recipesOk)return 'Rezepte';
    const n=(typeof RECIPES_CACHE!=='undefined'&&RECIPES_CACHE)?RECIPES_CACHE.length:0;
    // „12 gespeichert" (6.6) gilt nur für die ungefilterte Liste. Die Voreinstellung filtert aber
    // IMMER nach der Tageszeit („Frühstück" vor 10 Uhr) – dann wäre „gespeichert" eine Zahl, die
    // etwas anderes behauptet, als die Liste darunter zeigt.
    const eng=_rcFilterTeile().length>0;
    return 'Rezepte · '+(String(RECIPE_Q||'').trim()?pl(n,'Treffer','Treffer')
      :eng?pl(n,'zur Auswahl','zur Auswahl'):pl(n,'gespeichert','gespeichert'));}
  if(t==='cart')return 'Einkauf'+(renderDiet.cartSub?' · '+renderDiet.cartSub:'');
  // Tagebuch: der Tag, den die Ansicht gerade zeigt – nicht zwingend heute –, und sein Tagtyp.
  // Der Tagtyp steht nur da, wenn das Protokoll dieses Tages wirklich angekommen ist: ohne Antwort
  // wäre „Trainingstag" geraten, und ein geratener Untertitel ist schlimmer als keiner.
  const d=dtDate();
  const datum=fmtDate(d,{weekday:'long',month:'long'});
  const fl=renderDiet.foodlog||{};
  const typ=renderDiet.foodlogOk?((fl.dayType?fl.dayType==='training':fl.isTrain!==false)?'Trainingstag':'Ruhetag'):'';
  return datum+(typ?' · '+typ:'');}
// Den Untertitel nachziehen, ohne den Reiter neu aufzubauen – dasselbe Muster wie `#trTitleSub`
// (training.js) und `drawCoachStat()` (coach.js): nur der Textknoten wird ersetzt.
function dtSetLgSub(){const s=document.getElementById('dietLgSub');if(!s)return;
  const t=dtLgSub();if(s.textContent!==t)s.textContent=t;}
// Das Gerüst des Reiters: großer Titel, GENAU EINE Steuerebene darunter (G4), Inhalt.
// Der erste Segmentknopf heißt „Tagebuch", nicht mehr „Heute": das Wort „Heute" stand bis 3.0.2
// ZWEIMAL übereinander – einmal als Segmentknopf, einmal als Titel der Datumsleiste darunter
// (DESIGN-4 6.4). Jetzt steht es genau einmal, im Tageskopf INNERHALB der Tageskarte.
// Der große Titel steht hier im Markup und nicht mehr aus der Hülle (shell.js ensureLargeTitle):
// sobald eine Ansicht ihren Titel selbst mitbringt, tut die Übergangsmechanik nichts mehr.
function _dietShell(tab){return `<div class="page on">
    <h1 class="lg-title">Ernährung<small id="dietLgSub">${esc2(dtLgSub(tab))}</small></h1>
    <div class="seg" id="dietSeg">
      <button id="dt_track" class="${tab==='track'?'on':''}" onclick="dietTab('track')">Tagebuch</button>
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
    renderDiet.targets=null;renderDiet.targetsUser=null;renderDiet.targetsSt=null; /* Zielblatt gehört dem Athleten, nicht dem Reiter */ RC_CACHE={};RC_ALL=null;LF_RECENT=null;DT_LF_FAV=null;RECIPE_FILTER=null;RECIPE_Q='';DT2_DATE=null;DT2_TPL=null;
    renderDiet.recipesOk=false;renderDiet.cartSub='';}   /* die Zahlen im Untertitel gehören dem Athleten, nicht dem Reiter */
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
  if(body){if(t==='track')body.setAttribute('data-noswipe','');else body.removeAttribute('data-noswipe');}
  dtSetLgSub();}
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
// G9/R15: WÖRTER STATT KÜRZEL. Bis 3.0.2 stand hier „28 g P · 10 g C · 1 g F" – 25 gemessene
// Fundstellen in einer deutschen App, in der „C" für Kohlenhydrate steht und „F" für Fett.
// Wer die App ohne Erklärung verstehen soll, liest die Wörter. Die Zeile bricht lieber um (G11).
function macroLine(p,c,f){return `Eiweiß ${fmtNum(Math.round(p||0))} g · Kohlenhydrate ${fmtNum(Math.round(c||0))} g · Fett ${fmtNum(Math.round(f||0))} g`;}
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

// ===== HEUTE: TAGESKARTE, PLAN-GRUPPE, PROTOKOLL (DESIGN-4 6.4) =====
// Alles auf DEM EINEN Zeilenmuster (rowHTML/groupHTML aus core.js). Wo früher eine eigene Bauform
// stand (`.macro-row`, `.dt-mring`, `.next-meal`, `.section-label` mit „···"), steht jetzt eine
// Gruppe aus Zeilen mit einem Fußtext darunter – dem Erklärungsort der App (G8).

// Nährwerte als ZEILEN statt als vier Kacheln (G6). Die Kacheln `.macro-row/.macro` waren eine
// eigene Zeilenform mit eigener Typografie und trugen die Einheit als <em> im Wert; die Gruppe hier
// benutzt dieselbe Zeile wie jede andere Liste der App. Die Wörter sind ausgeschrieben (G9/R15):
// nicht „g P / g C / g F", sondern Eiweiß · Kohlenhydrate · Fett.
function macroRows(kc,p,c,f,target,head,foot){
  const rows=[
    rowHTML({title:'Kalorien',value:fmtNum(Math.round(kc||0))+(target?' / '+fmtNum(target):'')+' kcal'}),
    rowHTML({title:'Eiweiß',value:fmtNum(Math.round(p||0))+' g'}),
    rowHTML({title:'Kohlenhydrate',value:fmtNum(Math.round(c||0))+' g'}),
    rowHTML({title:'Fett',value:fmtNum(Math.round(f||0))+' g'})];
  return groupHTML(head||'',rows,foot||'',{inset:false});}
// Urteil „gegessen vs. Ziel" – EINE Quelle für Ernährung und Startseite: bevorzugt der Serverstatus aus
// GET /api/foodlog – src/logic.js dayNutrition –, sonst dieselben Schwellen lokal (>105 % drüber, ab 95 % im Ziel).
// Über dem Ziel ist amber und heißt „über dem Ziel" – wortgleich und farbgleich mit home.js homeFoodHTML().
// DESIGN-4 5.7/G19: eine FARBE gibt das Urteil hier nicht mehr mit. Der Ring ist neutral, immer.
// Bis 3.0.2 lieferte diese Funktion `color:var(--red)` für „unter dem Ziel" – und damit war der
// Kalorienring der Ernährung ein ROTER Fortschrittsring an jedem normalen Vormittag (gemessen:
// sprache.mjs K19 „1 rote Ringe"). Ein Ring ist eine Menge, kein Ruf.
function kcalVerdict(consumed,target){const sum=renderDiet.foodlog?.summary||{};
  let st=null;
  if(sum.status&&Math.round(sum.target||0)===Math.round(target||0)&&Math.round(sum.consumed||0)===Math.round(consumed||0))st=sum.status;
  if(!st)st=!target?'ok':(consumed>target*1.05?'over':(consumed>=target*0.95?'onTarget':'under'));
  if(st==='over')return {status:st,text:'über dem Ziel',tone:'tone-amber'};
  if(st==='onTarget')return {status:st,text:'im Ziel',tone:'tone-green'};
  return {status:st,text:'',tone:''};}

// Der Tageskopf. Er ist INHALT, keine Steuerebene (DESIGN-4 6.4): er steht IN der Tageskarte, nicht
// als vierte Leiste unter dem Titel. Die beiden Schritte tragen den NAMEN des Tages, auf den sie
// führen („‹ Gestern", „Morgen ›") statt eines nackten Pfeils – damit ist kein Bedienelement dieser
// Ansicht mehr ein Symbol ohne Wort (K11), und man sieht vor dem Tippen, wo man landet.
// Nach vorn ist bei heute Schluss (der Server nimmt einen Tag Kulanz, aber ein Essen für morgen
// einzutragen ist keine Erfassung). Dann steht rechts NICHTS – ein abgeschalteter Knopf mit dem Wort
// „Morgen" wäre ein Versprechen, das die App nicht hält.
function dtTagKopf(){const d=dtDate(),isT=dtIsToday();
  const prev=dtAddDays(d,-1),next=dtAddDays(d,1);
  const canPrev=dtDayDiff(prev,today())<=DT2_BACK_MAX;
  const canNext=dtDayDiff(today(),next)<=0;
  return `<div class="dt-tagkopf" id="dtTagKopf">
    <button type="button" class="dt-step"${canPrev?'':' disabled'} onclick="dtShiftDate(-1)">${icon('chevronLeft',16)}<span>${esc2(dtDayLabel(prev))}</span></button>
    <div class="dt-tag-m">
      <div class="dt-tag-l">${esc2(dtDayLabel(d))}</div>
      <div class="dt-tag-s">${esc2(fmtDate(d,{weekday:'long',month:'long'}))}</div>
    </div>
    ${canNext?`<button type="button" class="dt-step dt-next" onclick="dtShiftDate(1)"><span>${esc2(dtDayLabel(next))}</span>${icon('chevronRight',16)}</button>`
      :`<span class="dt-step-leer"></span>`}
  </div>${isT?'':`<button type="button" class="dt-heute" onclick="dtSetDate(today())">Zurück zu heute</button>`}`;}

// EIN Ring je Bildschirm, neutral, mit dem Wort daneben (DESIGN-4 5.7/G9). Vorher standen hier VIER
// Ringe: der Kalorienring und drei Makro-Ringe – gemessen „diet-tagebuch: 4 Ringe, 1 rot".
// Die drei Makros sind jetzt Balken: „Balken = Anteil in einer Liste" ist genau ihr Fall.
function dtRingBlock(consumed,target,isTrain){
  const rem=target?Math.round(target-consumed):0;
  const pct=target?Math.min(1,consumed/target):0;
  const V=kcalVerdict(consumed,target);
  return `<div class="dt-ring">
    ${ringHTML(pct,126,fmtNum(target?Math.abs(rem):Math.round(consumed)))}
    <div class="dt-ring-t">${target?(rem>=0?'kcal übrig':'kcal drüber'):'kcal gegessen'}</div>
    <div class="dt-ring-s">${isTrain?'Trainingstag':'Ruhetag'} · ${fmtNum(consumed)}${target?' von '+fmtNum(target):''} kcal gegessen${V.text?' · '+esc2(V.text):''}</div>
  </div>`;}
// Ein Makro als Balken. Kein Warnton bei Überschreitung – ein Tag mit 39 g Fett über dem Ziel ist ein
// normaler Tag, kein Alarm (STRATEGY P6). Grün heißt genau eine Sache: getroffen.
// Die Zahl steht vollständig daneben („0 / 157 g"), die Folgerung in Worten dahinter („157 g offen").
function dtMacroBar(label,val,target){const v=Math.round(val||0),t=Math.round(target||0);
  const pct=t?Math.min(1,v/t):0;
  const hit=!!(t&&v>=t*0.95&&v<=t*1.05);
  const rest=!t?'kein Ziel':hit?'im Ziel':(v>t?fmtNum(v-t)+' g drüber':fmtNum(t-v)+' g offen');
  return `<div class="dt-macro">
    <div class="dt-macro-h"><span class="dm-l">${esc2(label)}</span><span class="dm-v">${
      t?fmtNum(v)+' / '+fmtNum(t)+' g':fmtNum(v)+' g'} · ${esc2(rest)}</span></div>
    <div class="bar${hit?' green':''}"><i style="width:${Math.round(pct*100)}%"></i></div></div>`;}
function dtMacroBars(mac,T){return dtMacroBar('Eiweiß',mac.protein||0,T.protein)
  +dtMacroBar('Kohlenhydrate',mac.carbs||0,T.carbs)
  +dtMacroBar('Fett',mac.fat||0,T.fat);}

// „Laut Plan als Nächstes" – jetzt eine GRUPPE aus Zeilen statt einer Karte mit rotem Knopfpaar.
// Vorher stand „Gegessen" als vollbreite rote Fläche in der Karte und ein zweites Mal als Chip in der
// aufgeklappten Mahlzeit im Plan (DESIGN-4 6.4: „zweimal auf demselben Bild"). Jetzt führt die
// Mahlzeitzeile auf das Mahlzeit-Sheet, und dort steht „Gegessen" genau einmal als Primäraktion.
// Damit bleibt auf dem Tagebuch GENAU EINE rote Fläche: „Essen eintragen".
function nextMealGroup(){const day=dtDate();const past=!dtIsToday();
  const n=nextPlanMeal(null,day);const self=_dietSelf();
  const tagTx=past?('am '+dtDayLabelIn(day)):'für heute';
  if(!n&&!renderDiet.mealsOk)return dtLoadNote('plan',renderDiet.mealsSt);
  if(!n)return groupHTML('Plan',[rowHTML({icon:'utensils',title:'Noch kein Ernährungsplan',
      sub:'Automatisch aus '+(self?'deinem':'dem')+' Profil erstellen',tap:"dietTab('plan')"})],
    'Der Plan schlägt dir für Trainings- und Ruhetage konkrete Mahlzeiten vor. Eintragen musst du sie trotzdem selbst.');
  const dayType=(renderDiet.foodlog?.dayType)||renderDiet.todayType||DIET;
  const meals=planMeals(dayType);const L=loggedMealIds();
  if(!meals.length)return '';
  const rows=meals.map(m=>{const t=mealTotals(m);const done=mealLogged(m,L);
    const names=(m.items||[]).map(i=>i.food).join(', ');
    return rowHTML({icon:done?'check':'utensils',title:m.label||('Mahlzeit '+m.meal_no),
      sub:fmtNum(Math.round(t.kcal))+' kcal · '+fmtNum(Math.round(t.protein))+' g Eiweiß'+(names?' · '+names:''),
      pill:done?{text:'eingetragen',tone:'green'}:null,
      tap:'openMealSheet('+m.id+')'});});
  const head='Laut Plan '+(past?'noch offen':'als Nächstes');
  const zaehler=n.total?(fmtNum(n.done)+' von '+fmtNum(n.total)+' eingetragen'):'';
  const foot=self
    ?('Tipp eine Mahlzeit an: „Gegessen" trägt sie vollständig ins Protokoll ein, „Tauschen" schlägt ein Rezept mit ähnlichen Werten vor. '+(zaehler?zaehler.charAt(0).toUpperCase()+zaehler.slice(1)+' '+tagTx+'.':''))
    :('Eintragen und Tauschen macht der Athlet selbst. '+(zaehler?zaehler.charAt(0).toUpperCase()+zaehler.slice(1)+' '+tagTx+'.':''));
  return groupHTML(head,rows,foot);}

// Das Mahlzeit-Sheet (DESIGN-4 6.4). Eine Mahlzeit, eine Primäraktion: „Gegessen". Alles, was es an
// dieser Mahlzeit sonst zu tun gibt, steht als benannte Zeile darunter – nichts in einem „···".
function openMealSheet(mealId){
  const dayType=(renderDiet.foodlog?.dayType)||renderDiet.todayType||DIET;
  const m=planMeals(dayType).find(x=>x.id===+mealId);
  if(!m)return toast('Diese Mahlzeit steht nicht mehr im Plan');
  const t=mealTotals(m);const done=mealLogged(m);const self=_dietSelf();
  let h=macroRows(t.kcal,t.protein,t.carbs,t.fat,null,'Nährwerte',
    'Die Mengen sind Richtwerte aus deinem Plan. Beim Eintragen landen genau diese Zahlen im Protokoll.');
  h+=groupHTML('Zutaten',(m.items||[]).map(it=>rowHTML({title:it.food,
      sub:(it.amount?fmtNum(it.amount)+' '+foodUnit(it.food)+dtCookedOf(it)+' · ':'')+macroLine(it.protein,it.carbs,it.fat),
      value:fmtNum(Math.round(it.kcal||0))+' kcal'})),'',{inset:false});
  if(self){
    h+=`<button class="btn" onclick="logFromMeal(${m.id});closeAllSheets()">${done?'Noch einmal eintragen':'Gegessen – ins Protokoll'}</button>`;
    h+=groupHTML('',[
      rowHTML({icon:'refresh',title:'Tauschen',sub:'Rezept mit ähnlichen Werten',tap:`closeAllSheets();swapMeal(${m.id},${Math.round(t.kcal)},'${esc(m.label||'')}')`}),
      m.recipe_id?rowHTML({icon:'arrowLeft',title:'Original wiederherstellen',sub:'Die getauschte Mahlzeit zurücknehmen',tap:`restoreMeal(${m.id});closeAllSheets()`}):''
    ].filter(Boolean),done?'Diese Mahlzeit steht heute schon im Protokoll. „Noch einmal eintragen" bucht eine zweite Portion.':'');
  }else h+=`<p class="rows-f">${esc2(DIET_RO_TX)}</p>`;
  openSheet(m.label||'Mahlzeit',`<div class="dt-sheet">${h}</div>`);}

// D1: Ohne Geburtsjahr rechnet der Server das Kalorienziel ohne Alter – das Ergebnis ist ein Startwert,
// keine gerechnete Zahl. Der Server liefert den ehrlichen Satz als summary.targetsNote mit.
// Ab DESIGN-4 steht er als FUSSTEXT unter der Gruppe (G8) – nicht mehr hinter einem ⓘ in der Karte.
function dtTargetsNote(sum){
  const note=(sum&&typeof sum.targetsNote==='string')?sum.targetsNote.trim():'';
  if(!note&&!(sum&&sum.dobMissing))return '';
  return _dietSelf()?(note||'Startwert – trag dein Geburtsjahr ein, dann rechnen wir genauer.')
    :'Startwert – ohne Geburtsjahr rechnet das Ziel ohne Alter.';}
// Woher das Kalorienziel kommt, in einem Satz (DESIGN-4 Teil 8 · „Woher kommen diese Kalorien?").
// Gerechnet wird nichts Neues: die Bausteine stehen im Profil bzw. in der Antwort des Servers.
function dtZielHerkunft(T){
  const prof=(_dietSelf()?ME:(VIEW_USER_PROFILE||{}))||{};
  const wt=prof.weight||prof.start_weight;
  const ziel={muscle:'Muskelaufbau',fatloss:'Fettabbau',health:'Gesundheit'}[prof.goal]||'';
  const teile=[];
  if(wt)teile.push(fmtNum(wt,1)+' kg');
  if(ziel)teile.push('deinem Ziel '+ziel);
  if(prof.days_per_week)teile.push(fmtNum(prof.days_per_week)+' Einheiten pro Woche');
  const quelle=T.src==='server'?'aus '+(teile.length?teile.join(', '):'deinem Profil')
    :T.src==='plan'?'aus der Summe deiner Plan-Mahlzeiten':'aus '+(teile.length?teile.join(', '):'deinem Profil');
  if(!T.kcal)return '';
  return fmtNum(T.kcal)+' kcal – gerechnet '+quelle+'.';}
// Kurzform für den Tagtyp: „Trainingstag · 2.584 kcal (Startwert)" statt einer glatten Behauptung.
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
// Die Zahl als ZEILEN (G6). Bis 3.0.2 waren das fuenf eigene Bauformen in einer eigenen Karte
// (.adp-nums/.adp-old/.adp-arrow/.adp-new/.adp-d/.adp-mac) - allein sie machten ein Drittel der
// Zeilenformen des Tagebuchs aus. Die Aussage ist dieselbe, die Sprache ist jetzt dieselbe wie ueberall.
function adpNumberRows(a){a=a||adpData();if(!a)return [];
  const why=adpWhy(a);if(!why)return [];
  const from=adpKcalFrom(a),to=adpKcalTo(a);
  if(!to)return [];
  const T=adpTo(a);
  const d=from?to-from:0;
  const rows=[rowHTML({icon:'trendUp',title:'Neues Kalorienziel',
    sub:(from?'bisher '+fmtNum(from)+' kcal':'')+(d?' · '+(d>0?'+':'−')+fmtNum(Math.abs(d))+' kcal':''),
    value:fmtNum(to)+' kcal'})];
  if([T.protein,T.carbs,T.fat].some(v=>+v>0))rows.push(rowHTML({icon:'scale',title:'Neue Makros',
    sub:'Eiweiß '+fmtNum(Math.round(+T.protein||0))+' g · Kohlenhydrate '+fmtNum(Math.round(+T.carbs||0))+' g · Fett '+fmtNum(Math.round(+T.fat||0))+' g'}));
  return rows;}
// Die alte Fassung baute dasselbe als HTML-Block; das Sheet („Wie das funktioniert") benutzt sie weiter.
function adpNumbers(a){const rows=adpNumberRows(a);return rows.length?groupHTML('',rows,'',{inset:false}):'';}
// GEMESSEN: Die Zielzeile ist die TRAININGSTAGS-Zahl – `currentTarget` im Server rechnet mit
// `planTargets` und dem Tagtyp „training",
// und beim Übernehmen leitet der Server das Ruhetagsziel anteilig daraus ab (Konto 2:
// 3.017/2.600 vorher, 2.920/2.738 nachher). Auf einem Ruhetag steht dann „−97 kcal" auf der Karte und
// 2.600 → 2.738 am Ring – beides stimmt, aber nur mit diesem Satz dazwischen. Er steht immer da und
// nicht nur an Ruhetagen: die Zahl heißt an jedem Tag dasselbe, und ein Hinweis, der mal da ist und mal
// nicht, wirkt wie eine Ausrede.
// Im Coach-Blick ohne Du-Form – dort ist vom Athleten die Rede, nicht vom Leser.
function adpTagTypLine(){return _dietSelf()
  ?'Die Zahl gilt für Trainingstage – dein Ruhetagsziel rechnet die App im selben Verhältnis mit.'
  :'Die Zahl gilt für Trainingstage – das Ruhetagsziel rechnet die App im selben Verhältnis mit.';}
// Der Herkunftssatz als eigene Zeile. Er steht UNTER der Begründung, nicht zwischen Zahl und Begründung:
// zuerst die Zahl, dann was sie bedeutet, dann woher sie kommt. Wer nur die ersten zwei Zeilen liest,
// hat die Entscheidung; wer nachrechnen will, findet die Quelle direkt darunter.
function adpWhyLine(a){return adpWhy(a)||'';}
// Zahl + Begründung + Herkunft als ein Stück – dieselbe Reihenfolge in der Karte und im Sheet.
// Die Zahl kommt aus adpNumbers() und die gibt es nur MIT Herkunftssatz (P3, siehe dort).
// Der Erklaertext der Anpassung: Begruendung, Herkunft, Tagtyp – drei Saetze, die in den Fusstext
// unter die Gruppe gehoeren (G8). adaptTargets() schreibt in Du-Form; im Coach-Blick gilt reasonCoach.
function adpFussText(a){a=a||adpData();if(!a)return '';
  const reason=String(((!_dietSelf()&&a.reasonCoach)||a.reason)||'').trim();
  const teile=[reason];
  if(adpNumberRows(a).length){teile.push(adpWhyLine(a));teile.push(adpTagTypLine());}
  return teile.filter(Boolean).join(' ');}
function adpBody(a){a=a||adpData();if(!a)return '';
  const rows=adpNumberRows(a);
  const fuss=adpFussText(a);
  if(!rows.length&&!fuss)return '';
  return groupHTML('',rows,fuss,{inset:false});}
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
// ===== DIE GRUPPE =====
// Die Wochenanpassung als GRUPPE aus Zeilen (DESIGN-4 4.1/G6). Bis 3.0.2 war sie eine eigene Karte
// mit sieben eigenen Bauformen (.adp-nums/.adp-old/.adp-new/.adp-d/.adp-mac/.adp-reason/.adp-why/
// .adp-state/.adp-acts/.adp-more) – ein Drittel aller Zeilenformen des Tagebuchs stammte aus ihr.
// Die Aussage bleibt vollständig: Zahl, Begründung, Herkunft, Entscheidung, Widerruf.
// Sie trägt bewusst KEINE rot gefüllte Fläche: der eine Akzent des Reiters gehört „Essen eintragen"
// (STRATEGY P4). Eine Rückfrage ist nie die Hauptsache eines Bildschirms.
// Nur am heutigen Tag: beim Nachtragen von vorgestern gehört der Bildschirm dem Protokoll dieses
// Tages, nicht einer Entscheidung über die kommende Woche.
function adpCard(){
  if(!dtIsToday())return '';
  const a=adpData();if(!a)return '';
  const st=adpState(a);if(st==='none')return '';
  const self=_dietSelf();
  if(st==='holding')return adpHoldCard(a,self);
  const rows=adpNumberRows(a);
  const fuss=adpFussText(a);
  // Weder Zahl noch Begründung: dann hat die App nichts zu sagen und sagt nichts.
  if(!rows.length&&!fuss)return '';
  const head=st==='applied'?'Diese Woche angepasst':'Wöchentliche Anpassung';
  let satz='';
  if(st==='coach'){
    const bleibt=adpKcalFrom(a);
    satz=self
      ?('Dein Coach'+(a.coachName?' '+String(a.coachName):'')+' sieht diesen Vorschlag und gibt ihn frei'+(bleibt?' – bis dahin bleibt dein Ziel bei '+fmtNum(bleibt)+' kcal.':'.'))
      :('Der Vorschlag liegt zur Freigabe bereit'+(bleibt?' – bis dahin gilt weiter '+fmtNum(bleibt)+' kcal.':'.'));
    rows.push(rowHTML({icon:'lock',title:'Wartet auf die Freigabe',
      pill:{text:self?'beim Coach':'bei dir',tone:'neutral'}}));
  }else if(!self){
    satz=st==='applied'?'Der Athlet hat diese Anpassung übernommen.':'Der Athlet entscheidet selbst, ob er den Vorschlag übernimmt.';
  }else if(st==='applied'&&adpDone(a)){
    // „Passt" getippt: die Gruppe hat ihren Zweck erfüllt. Sie verschwindet ganz – nachlesbar bleibt
    // der Vorgang im Sheet („Wie die Anpassung rechnet").
    return '';
  }else if(st==='applied'){
    satz=adpKcalFrom(a)?('„Rückgängig" setzt dein Ziel wieder auf '+fmtNum(adpKcalFrom(a))+' kcal.')
      :'„Rückgängig" holt dein vorheriges Ziel zurück.';
    rows.push(rowHTML({icon:'check',title:'Passt',sub:'Nimmt die Anpassung zur Kenntnis',tap:'adpDismiss()'}));
    rows.push(rowHTML({icon:'arrowLeft',title:'Rückgängig',sub:'Setzt das vorherige Ziel zurück',tap:'adpUndo()'}));
  }else if(!adpAnswered(a)&&!rows.length){
    // P3 bis zum Ende gedacht: Ohne Herkunftssatz zeigt die App die Zahl nicht – dann darf sie auch
    // nicht um ein Ja für eine Zahl bitten, die sie nicht erklären kann.
    satz='Woher diese Zahl kommt, kann ich dir gerade nicht sagen – deshalb schlage ich sie auch nicht vor. Dein Ziel bleibt, wie es ist.';
  }else if(!adpAnswered(a)){
    satz='„Übernehmen" trägt '+fmtNum(adpKcalTo(a))+' kcal als dein Ziel ein. „Behalten" ändert nichts.';
    rows.push(rowHTML({icon:'check',title:'Übernehmen',sub:'Neues Ziel ab sofort',
      value:fmtNum(adpKcalTo(a))+' kcal',tap:'adpApply()'}));
    rows.push(rowHTML({icon:'lock',title:'Behalten',sub:'Ändert nichts',
      value:adpKcalFrom(a)?fmtNum(adpKcalFrom(a))+' kcal':'',tap:'adpKeep()'}));
  }else{
    satz=adpKcalFrom(a)
      ?('Du hast dich entschieden: dein Ziel bleibt bei '+fmtNum(adpKcalFrom(a))+' kcal.')
      :'Du hast dich entschieden: dein Ziel bleibt, wie es ist.';
  }
  rows.push(rowHTML({icon:'info',title:'Wie die Anpassung rechnet',
    sub:'Schalter, Herkunft und der Stand dieser Woche',tap:'adpOpenSettings()'}));
  return groupHTML(head,rows,[fuss,satz].filter(Boolean).join(' '));}
// Steht gerade eine offene Entscheidung über das Kalorienziel auf dem Schirm? Dieselben Bedingungen wie
// in adpCard(), nur als Frage – dtKcalAskGroup() liest sie, um seine eigene Rückfrage zurückzunehmen.
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
  return groupHTML('Wöchentliche Anpassung',
    [rowHTML({icon:'trendUp',title:'Diese Woche keine Anpassung',
      sub:need?(fmtNum(got)+' von mindestens '+fmtNum(need)+' Tagen eingetragen'):'',
      value:'Ziel bleibt',tap:self?'adpOpenSettings()':''})],
    (self?ADP_HOLD_TX:ADP_HOLD_TX_COACH)+(self?zahl:zahlC));}
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
  let h=groupHTML('',[rowHTML({icon:'trendUp',title:'Automatisch anpassen',
    sub:on?'An – die App fragt vor jeder Änderung':'Aus (Standard) – dein Ziel kommt aus der Formel',
    switch:{name:'adp_mode',on},id:'adpSwRow'})],ADP_OFF_TX+' '+ADP_ON_TX);
  // Was JETZT gilt, in einem Satz – und zwar in dem Satz, den auch der Coach-Bereich benutzt (`modeText`
  // aus `GET /api/targets`). Schickt der Server ihn nicht, steht hier dieselbe Tatsache in eigenen Worten.
  const mText=adpModeText();
  if(mText)h+=`<p class="rows-f">${esc2(mText)}</p>`;
  else if(adpHasCoach())h+=`<p class="rows-f">${esc2(self
    ?'Du hast einen Coach – jede Anpassung geht erst an ihn und wird erst nach seiner Freigabe vorgeschlagen.'
    :'Der Athlet hat einen Coach – die Anpassung wartet auf die Freigabe.')}</p>`;
  // Der Stand von dieser Woche, mit derselben Herkunftsangabe wie in der Karte. Auch nachdem die Karte
  // weggetippt wurde, ist hier nachlesbar, was vorgeschlagen wurde und warum.
  if(a&&st!=='none'){
    const lbl=st==='applied'?'Diese Woche angepasst':st==='coach'?'Wartet auf Freigabe':st==='holding'?'Diese Woche keine Anpassung':'Vorschlag dieser Woche';
    h+=(st==='holding')
      ?groupHTML(lbl,[rowHTML({icon:'info',title:'Kein Vorschlag',value:'Ziel bleibt'})],self?ADP_HOLD_TX:ADP_HOLD_TX_COACH)
      :(`<h2 class="rows-h">${esc2(lbl)}</h2>`+adpBody(a));
  }else if(self){
    h+=`<p class="rows-f">${esc2(on?'Der nächste Wochenlauf schaut sich deine Daten an – du siehst das Ergebnis hier und auf dem Tagebuch.':'Solange der Schalter aus ist, schlägt die App nichts vor.')}</p>`;
  }
  if(!self)h+=`<p class="rows-f">${esc2('Nur Ansicht – ob die Ziele automatisch angepasst werden, entscheidet der Athlet. Die Freigabe einer Anpassung machst du in deinem Coach-Bereich.')}</p>`;
  openSheet('Ziele automatisch anpassen',`<div class="dt-sheet">${h}</div>`);
  const sw=document.querySelector('#adpSwRow input.sw');
  if(sw){if(!self)sw.disabled=true;sw.onchange=function(){adpSetMode(this.checked);};}}
// Der Schalter schreibt nur EINE Sache: den Modus. Er rechnet nichts und setzt kein Ziel – auch das
// Einschalten ändert heute keine Zahl (P10). Schlägt das Speichern fehl, springt der Schalter zurück,
// statt einen Zustand zu zeigen, den der Server nicht kennt.
// GEMESSEN UND REPARIERT (15.09.2026): Hier stand `API.put('/profile',{target_mode:mode})`. Die Route
// nimmt das Feld nicht an – sie antwortete 200 {"ok":true} und speicherte es nicht; `GET /api/targets/2`
// meldete danach weiter `mode:"formel"`. Der Schalter blieb also an, der Toast versprach eine Automatik,
// und nach dem nächsten Laden sprang er zurück. Die zuständige Route ist `POST /api/targets/:uid/mode`
// (gemessen: 200 {"ok":true,"mode":"adaptiv"}, danach steht der Modus wirklich auf „adaptiv").
async function adpSetMode(on){
  const box=document.querySelector('#adpSwRow input.sw');
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
  // Der Schalter steht an ZWEI Orten: im Sheet („Ziele automatisch anpassen") und als Zeile im
  // Abschnitt „Plan ändern". Nach dem Umlegen wird der Ort neu gezeichnet, an dem man gerade steht –
  // vom Plan aus ein Sheet aufzuklappen wäre eine Antwort auf eine Frage, die niemand gestellt hat.
  if(document.querySelector('#adpSwRow'))adpOpenSettings();
  else if(document.getElementById('dietBody')&&renderDiet.tab==='plan')drawDiet();}
// TAGEBUCH (DESIGN-4 6.4): Tageskarte · die eine Primäraktion · Plan · Protokoll.
// Steuerebenen unter dem Titel: 1 (das Segment). Der Tageskopf steht IN der Karte, die Chip-Reihe
// „Wiederholen" ist eine Gruppe aus Zeilen geworden.
function drawTrack(){_dietMark('track');_dietEnsureFoods();
  const fl=renderDiet.foodlog||{items:[],summary:{}};const sum=fl.summary||{};
  const items=fl.items||[];const el=document.getElementById('dietBody');if(!el)return;
  dtSwipeBind(el);
  const self=_dietSelf();
  const kopf=`<h2 class="rows-h">${self?'Dein Tag':'Der Tag'}</h2>`;
  // Der Tageskopf steht ÜBER allem anderen – auch über den Fehlerkarten. Wer beim Blättern auf einen
  // Tag ohne Netz stößt, muss zurückblättern können, ohne die Seite neu zu laden.
  const karte=inner=>`<div class="card dt-tag">${dtTagKopf()}${inner||''}</div>`;
  if(renderDiet.foodlogLoading){el.innerHTML=kopf+karte('')+skeleton(3);return;}
  if(!renderDiet.foodlogOk&&!renderDiet.mealsOk){
    el.innerHTML=kopf+karte('')+dtLoadNote('track',renderDiet.foodlogSt||renderDiet.mealsSt);return;}
  const consumed=Math.round(sum.consumed||0);const T=dietTargets();const target=T.kcal||0;
  const mac=sum.macros||{};const isTrain=fl.isTrain!==false;
  let h='';
  // A-III.2: Kam nur der PLAN durch und das Protokoll nicht, ist „gegessen" UNBEKANNT, nicht null.
  // Dann steht statt Ring und Balken dieselbe ehrliche Karte; der Plan darunter bleibt sichtbar.
  if(renderDiet.foodlogOk){
    h+=kopf+karte(dtRingBlock(consumed,target,isTrain)+dtMacroBars(mac,T));
    // DER ERKLÄRUNGSORT (G8): woher das Ziel kommt und was „Startwert" bedeutet – dauerhaft sichtbar,
    // ohne ⓘ, ohne Tooltip. Bis 3.0.2 stand beides als `.dh-note` mit Info-Symbol IN der Karte.
    const fuss=[dtZielHerkunft(T),dtTargetsNote(sum)].filter(Boolean).join(' ');
    if(fuss)h+=`<p class="rows-f">${esc2(fuss)}</p>`;
  }else h+=kopf+karte('')+dtLoadNote('track',renderDiet.foodlogSt);
  // DIE EINE PRIMÄRAKTION DES BILDSCHIRMS (G10) – und sie steht jetzt dort, wo 6.4 sie zeichnet:
  // Tag-Karte → Fußtext → „Essen eintragen" → FALZ → Laut Plan als Nächstes → Protokoll.
  // GEMESSEN VORHER (dz/f3/V-plan.json, Schritt T1): die einzige Primäraktion lag bei y = 1.359 px
  // bei einem Falz von 844 px – 515 px unter dem Rand des Bildschirms. Dazwischen standen die
  // Kalorien-Rückfrage und die Wochenanpassung: zwei Gruppen mit zusammen bis zu sieben Zeilen und
  // zwei Absätzen Fußtext. Die Ernährung war damit der einzige Athleten-Reiter, der die Frage
  // „was ist hier die Hauptsache?" ohne Scrollen nicht beantwortete. Inhalt bleibt, Reihenfolge nicht.
  h+=self?`<button class="btn" onclick="openLogFood({focus:true})">${icon('plus',18)} Essen eintragen</button>`
    :`<p class="rows-f">${esc2(DIET_RO_TX)}</p>`;
  h+=dtKcalAskGroup(fl.dayType||(isTrain?'training':'rest'));
  h+=adpCard();   // B-I.4: die Wochenanpassung – nie still, immer mit Begruendung (P3/P10)
  h+=nextMealGroup();
  h+=dtProtokoll(items);
  el.innerHTML=h;
  dtSetLgSub();}
// Das Protokoll: je Mahlzeit eine Gruppe mit Überschrift „Frühstück · 816 kcal". Am Ende jeder Gruppe
// stehen die beiden Funktionen, die bis 3.0.2 hinter dem „···" der Gruppenzeile lagen (R6) – und das
// „···" erschien nur, wenn die Mahlzeit schon Einträge hatte, war also im Normalfall unsichtbar.
function dtProtokoll(items){const self=_dietSelf();
  let h='';
  if(!items.length&&renderDiet.foodlogOk){
    h+=`<h2 class="rows-h">Protokoll</h2>`+emptyState({icon:'utensils',
      title:dtIsToday()?'Noch nichts eingetragen':('Für '+dtDayLabelIn(dtDate())+' steht nichts im Protokoll'),
      text:self?(dtIsToday()?'Trag dein Essen ein oder übernimm eine Mahlzeit aus dem Plan.':'Trag nach, was du an diesem Tag gegessen hast – oder übernimm den Vortag.'):'Dein Athlet hat für diesen Tag nichts eingetragen.'});
  }else if(items.length){
    const groups={};items.forEach(it=>{const k=slotNorm(it.meal_slot);(groups[k]=groups[k]||[]).push(it);});
    const keys=Object.keys(groups).sort((a,b)=>{const ia=SLOT_ORDER.indexOf(a),ib=SLOT_ORDER.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);});
    keys.forEach(k=>{const g=groups[k];const kc=g.reduce((a,it)=>a+(it.kcal||0),0);
      const rows=g.map(it=>{const isMeal=!!it.details;const amt=isMeal?'ganze Mahlzeit':amountText(it);
        const sub=(amt?amt+' · ':'')+macroLine(it.protein,it.carbs,it.fat);
        // Wartet noch in der Outbox: zählt bereits mit, ist aber nicht antippbar – Ändern/Entfernen
        // brauchen die Server-ID, die dieser Eintrag erst nach dem Nachtragen bekommt.
        if(it._pending)return rowHTML({title:it.food,sub,pill:{text:'wird nachgetragen',tone:'neutral'},
          value:fmtNum(Math.round(it.kcal||0))+' kcal'});
        return rowHTML({title:it.food,sub,value:fmtNum(Math.round(it.kcal||0))+' kcal',tap:'openFoodRow('+it.id+')'});});
      if(self){
        rows.push(rowHTML({icon:'star',title:'Als Vorlage sichern',
          sub:'Als „'+dtTplName(k)+'" – danach mit zwei Tipps wieder eintragen',tap:"dtTplFromSlot('"+esc(k)+"')"}));
        rows.push(rowHTML({icon:'copy',title:'Noch einmal eintragen',
          sub:g.length===1?'Denselben Eintrag ein zweites Mal':('Dieselben '+fmtNum(g.length)+' Einträge ein zweites Mal'),
          tap:"dtSlotAgain('"+esc(k)+"')"}));}
      h+=groupHTML(k+' · '+fmtNum(Math.round(kc))+' kcal',rows,'');});
  }
  h+=dtWiederholenGruppe();
  return h;}
// „Gestern wiederholen" und die gespeicherten Vorlagen – bis 3.0.2 eine waagrecht scrollende
// Chip-Reihe UNTER dem Falz, deren letzter Chip ein „···" war und deren Vorlagen nur per RECHTSKLICK
// zu verwalten waren (R6, auf dem iPhone gar nicht auslösbar). Jetzt: benannte Zeilen.
function dtWiederholenGruppe(){if(!_dietSelf())return '';
  const prev=dtAddDays(dtDate(),-1);
  const tpl=dtTplLoad();
  const rows=[rowHTML({icon:'refresh',title:dtDayLabel(prev)+' wiederholen',
    sub:'Zeigt dir erst, was übernommen wird',tap:'dtRepeatPrev()'})];
  tpl.slice(0,3).forEach((t,i)=>rows.push(rowHTML({icon:'star',title:t.name,
    sub:pl(t.items.length,'Eintrag','Einträge')+(t.slot?' · '+t.slot:''),
    value:fmtNum(t.kcal||0)+' kcal',tap:'dtTplMenu('+i+')'})));
  if(tpl.length>3)rows.push(rowHTML({icon:'copy',title:'Alle Vorlagen',
    value:pl(tpl.length,'Vorlage','Vorlagen'),tap:'dtTplAll()'}));
  const foot=tpl.length
    ?'Eine Vorlage ist eine gespeicherte Mahlzeit. Du legst sie im Protokoll an („Als Vorlage sichern") und trägst sie hier wieder ein, umbenennen und löschen inbegriffen.'
    :'Sobald du eine Mahlzeit eingetragen hast, kannst du sie im Protokoll als Vorlage sichern – sie steht dann hier und ist mit zwei Tipps wieder eingetragen.';
  return groupHTML('Wiederholen',rows,foot);}
// D10: Weicht das gespeicherte kcal-Ziel um mehr als 7 % von der Formel ab, rechnet der Server neu.
// Bis 3.0.2 stand die Rückfrage als `.dh-note` mit ⓘ-Symbol und zwei Pillenknöpfen IN der Hero-Karte.
// Jetzt ist sie eine Gruppe aus zwei benannten Zeilen mit dem Grund im Fußtext (G8).
function dtKcalAskGroup(dayType){const ask=renderDiet.foodlog?.summary?.kcalAsk;if(!ask)return '';
  const d=ask[dayType==='training'?'train':'rest']||null;
  const saved=Math.round((d?d.saved:ask.saved)||0),sug=Math.round((d?d.suggested:ask.suggested)||0);
  if(!sug||!saved||saved===sug)return '';
  const self=_dietSelf();
  const kg=ask.weightKg?fmtNum(ask.weightKg,1):'';
  const tagTx=dayType==='training'?'Trainingstage':'Ruhetage';
  const txt=`${self?'Dein gespeichertes Ziel':'Das gespeicherte Ziel'} für ${tagTx} (${fmtNum(saved)} kcal) passt nicht mehr zum aktuellen Gewicht${kg?' von '+kg+' kg':''} – gerechnet wird mit ${fmtNum(sug)} kcal.`;
  // B-I.4: Auf EINEM Bildschirm steht nur EINE Frage nach dem Kalorienziel. Zeigt die Wochenanpassung
  // darunter gerade „Übernehmen / Behalten", tritt diese ältere Rückfrage auf ihren Erklärsatz zurück.
  if(!self||dtAskAnswered(ask)||adpDecisionOpen())
    return `<p class="rows-f">${esc2(txt)}</p>`;
  const t=Math.round(ask.train?.suggested||0),r=Math.round(ask.rest?.suggested||0);
  const was=[t?fmtNum(t)+' kcal an Trainingstagen':'',r?fmtNum(r)+' kcal an Ruhetagen':''].filter(Boolean).join(' und ');
  return groupHTML('Kalorienziel',[
    rowHTML({icon:'check',title:'Gerechnetes Ziel übernehmen',sub:was?('Trägt '+was+' in dein Profil ein'):'',
      value:fmtNum(sug)+' kcal',tap:'dtKcalAskApply()'}),
    rowHTML({icon:'lock',title:'Gespeichertes Ziel behalten',sub:'Ändert nichts',
      value:fmtNum(saved)+' kcal',tap:'dtKcalAskKeep()'})
  ],txt);}
// Zeile antippen: Aufschlüsselung + Menge ändern · Noch einmal eintragen · Entfernen
function openFoodRow(id){const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);if(!it)return;
  let parts=[];if(it.details){try{parts=JSON.parse(it.details);}catch(e){parts=[];}}
  const amtTx=it.details?'ganze Mahlzeit':amountText(it);
  let h=macroRows(it.kcal,it.protein,it.carbs,it.fat,null,'Nährwerte',
    slotNorm(it.meal_slot)+(amtTx?' · '+amtTx:''));
  if(parts.length)h+=groupHTML('Zutaten',parts.map(p=>rowHTML({title:p.food,
    sub:(p.amount?fmtNum(p.amount)+' '+foodUnit(p.food)+dtCookedTxt(p.food,p.amount)+' · ':'')+macroLine(p.protein,p.carbs,p.fat),
    value:fmtNum(Math.round(p.kcal||0))+' kcal'})),'',{inset:false});
  // Ändern/Duplizieren/Entfernen schreiben ins Protokoll – im Coach-Blick bleibt nur die Aufschlüsselung
  if(_dietSelf()){
    h+=groupHTML('',[
      entryAmount(it)!=null?rowHTML({icon:'pencil',title:'Menge ändern',value:amtTx,tap:'openFoodAmount('+it.id+')'}):'',
      rowHTML({icon:'copy',title:'Noch einmal eintragen',sub:'Zweite Portion mit denselben Werten',tap:'dupFood('+it.id+')'})
    ].filter(Boolean),'');
    h+=groupHTML('',[rowHTML({title:'Aus dem Protokoll entfernen',danger:true,tap:'delFood('+it.id+')'})],
      'Entfernen lässt sich sofort widerrufen – der Hinweis unten trägt „Rückgängig".');
  }else h+=`<p class="rows-f">${esc2(DIET_RO_TX)}</p>`;
  openSheet(it.food,`<div class="dt-sheet">${h}</div>`);}
function showMealDetails(id){openFoodRow(id);} // Alias (alter Name)
function openFoodAmount(id){if(_dietRO())return;const it=(renderDiet.foodlog?.items||[]).find(x=>x.id===id);if(!it)return;
  const base=entryAmount(it);if(base==null)return toast('Diese Menge lässt sich nicht ändern');
  const f=FOODS.find(x=>x.name===it.food);const u=foodUnit(it.food,f);
  const chips=portionChips(it.food,u).map(([v,l])=>`<button class="chip${base===v?' on':''}" onclick="amtChip('fa_amt',${v},this)">${esc2(l)}</button>`).join('');
  openSheet('Menge ändern',`<div class="dt-sheet"><h2 class="rows-h">${esc2(it.food)}</h2>
    <div class="field"><label for="fa_amt">Menge (${u})</label><input id="fa_amt" type="number" inputmode="decimal" value="${base}"></div>
    <div class="chip-row wrap">${chips}</div>
    <p class="rows-f">Die Nährwerte werden mit der neuen Menge neu gerechnet – der alte Eintrag wird ersetzt.</p>
    <button class="btn" onclick="changeFoodAmount(${it.id})">Speichern</button></div>`);
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
  if(r.status!==200){openSheet(title,`<div class="dt-sheet">${emptyState({icon:'devices',title:'Der Vortag ließ sich nicht laden',
    text:_dietErrTx(r,'Versuch es gleich noch einmal.')})}${groupHTML('',[rowHTML({icon:'refresh',title:'Nochmal versuchen',tap:'dtRepeatPrev()'})],'')}</div>`);return;}
  const items=(r.data?.items||[]).filter(it=>it&&it.food&&!it._pending);
  if(!items.length){openSheet(title,emptyState({icon:'utensils',title:'Da steht nichts',
    text:'Am '+dtDateShort(from)+' ist nichts im Protokoll – es gibt also nichts zu übernehmen.'}));return;}
  DT2_REP={from,to,items};
  const kc=items.reduce((a,it)=>a+(it.kcal||0),0);
  let h=groupHTML(pl(items.length,'Eintrag','Einträge')+' · '+fmtNum(Math.round(kc))+' kcal',
    items.map(it=>rowHTML({title:it.food,
      sub:slotNorm(it.meal_slot)+(it.details?' · ganze Mahlzeit':(amountText(it)?' · '+amountText(it):'')),
      value:fmtNum(Math.round(it.kcal||0))+' kcal'})),
    'Alle Einträge von '+dtDateShort(from)+' landen als neue Zeilen auf '+(dtIsToday()?'heute':dtDateShort(to))+'. Ein „Rückgängig" nimmt sie gemeinsam zurück.',
    {inset:false});
  h+=`<button class="btn" onclick="dtRepeatApply()">Übernehmen</button>`;
  openSheet(title,`<div class="dt-sheet">${h}</div>`,{size:'tall'});}
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
  openSheet('Vorlage umbenennen',`<div class="dt-sheet" id="tplForm"><div class="field"><label>Name</label><input id="tpl_name" value="${esc2(list[i].name)}" maxlength="40" enterkeyhint="done" onkeydown="if(event.key==='Enter')dtTplRenameSave('${esc(list[i].name)}')"></div>
    <button class="btn" onclick="dtTplRenameSave('${esc(list[i].name)}')">Speichern</button></div>`);
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
// Das Vorlagen-Sheet (R6). Bis 3.0.2 kam man hierher NUR per Rechtsklick auf einen Chip – auf dem
// iPhone also gar nicht. Jetzt fuehrt jede Vorlagenzeile hierher, Eintragen ist die Primaeraktion,
// Loeschen steht als rote Zeile in einer eigenen Gruppe (A30).
function dtTplMenu(i){const t=dtTplLoad()[i];if(!t)return;
  let h=groupHTML('Inhalt',t.items.map(x=>rowHTML({title:x.food,value:fmtNum(Math.round(x.kcal||0))+' kcal'})),
    pl(t.items.length,'Eintrag','Einträge')+' · '+fmtNum(t.kcal||0)+' kcal'+(t.slot?' · '+t.slot:''),{inset:false});
  h+=`<button class="btn" onclick="closeModal();dtTplLog(${i})">Jetzt eintragen</button>`;
  h+=groupHTML('',[rowHTML({icon:'pencil',title:'Umbenennen',value:t.name,tap:"dtTplRename('"+esc(t.name)+"')"})],'');
  h+=groupHTML('',[rowHTML({title:'Vorlage löschen',danger:true,tap:'dtTplDel('+i+')'})],
    'Gelöscht wird nur die Vorlage – die Einträge, die du damit gebucht hast, bleiben im Protokoll stehen.');
  openSheet(t.name,`<div class="dt-sheet">${h}</div>`);}
function dtTplDel(i){const list=dtTplLoad();const t=list[i];if(!t)return;
  list.splice(i,1);dtTplStore(list);closeAllSheets();
  if(document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();
  toast(`„${t.name}“ gelöscht`);}
async function dtSlotAgain(slot){if(_dietRO())return;
  const items=(renderDiet.foodlog?.items||[]).filter(it=>!it._pending&&slotNorm(it.meal_slot)===slot);
  if(!items.length)return toast('In dieser Mahlzeit steht nichts');
  closeAllSheets();
  const res=await dtPostEntries(items,dtDate());
  await refreshFoodlog();
  if(!res.ids.length)return toast('Nicht eingetragen – der Server hat abgelehnt');
  toast(slot+' noch einmal eingetragen ✓',{label:'Rückgängig',fn:()=>dtUndoEntries(res.ids)});}
// Der Satz „Noch keine Vorlage – tippe auf ⋯ neben einer Mahlzeit im Protokoll" ist ersatzlos weg
// (DESIGN-4 6.4): eine Oberflaeche, die dem Nutzer per Meldung erklaeren muss, wo ihr eigener Knopf
// steht, ist versteckt. Der Knopf heisst jetzt „Als Vorlage sichern" und steht in jeder Mahlzeit.
function dtTplAll(){const tpl=dtTplLoad();
  const h=tpl.length
    ?groupHTML('Deine Vorlagen',tpl.map((t,i)=>rowHTML({icon:'star',title:t.name,
        sub:pl(t.items.length,'Eintrag','Einträge')+(t.slot?' · '+t.slot:''),
        value:fmtNum(t.kcal||0)+' kcal',tap:'dtTplMenu('+i+')'})),
      'Eine Vorlage traegst du mit zwei Tipps ein, benennst sie um oder loeschst sie – alles ueber die Zeile.')
    :emptyState({icon:'star',title:'Noch keine Vorlage',
      text:'Trag zuerst eine Mahlzeit ein. Im Protokoll steht dann unter jeder Mahlzeit die Zeile „Als Vorlage sichern".'});
  openSheet('Meine Vorlagen',`<div class="dt-sheet">${h}</div>`);}

// ===== ESSEN EINTRAGEN (DESIGN-4 6.4 / R10) =====
// Bis 3.0.2: 3.212 px Inhalt in einem 776 px hohen Fenster (76 % unsichtbar), 87 Aktionen, 68 davon
// unter dem Falz, 42 Sternsymbole ohne Text – und ein Segment „Liste / Scan / Manuell / Neu" als
// VIERTE Steuerebene (Reiterleiste → Segment → Sheet → Segment).
// Jetzt: EIN Bildschirm. Suchfeld oben, darunter die Abschnitte Zuletzt · Favoriten · Vorlagen ·
// Alle Lebensmittel · Selbst eintragen. Die drei Reiter sind drei benannte Zeilen im letzten
// Abschnitt geworden („Strichcode scannen", „Freie Kalorien eintragen", „Eigenes Lebensmittel
// anlegen") – ein Neuling konnte am Wort „Manuell" ohnehin nicht ablesen, was es von „Neu" trennt.
// Steuerebenen: 4 -> 1 (das Sheet selbst).
let LF_SESSION={count:0,kcal:0};
// openLogFood({focus:true}) – öffnet das Sheet (hoch), Liste mit fokussierter Suche
function openLogFood(o){if(_dietRO())return;o=o||{};LF_SESSION={count:0,kcal:0};
  openSheet('Essen eintragen',`<div class="dt-sheet">
    <div id="lfBody"></div>
    <div class="lf-done" id="lfDone" hidden><span class="fill" id="lfDoneTx"></span><button class="btn sec inline" onclick="lfDone()">Fertig</button></div>
  </div>`,{size:'tall'});
  lfTab(1,{focus:o.focus!==false});}
function lfUpdateDone(){const d=document.getElementById('lfDone');if(!d)return;d.hidden=!LF_SESSION.count;
  const t=document.getElementById('lfDoneTx');if(t)t.textContent=`${pl(LF_SESSION.count,'Eintrag','Einträge')} · ${fmtNum(Math.round(LF_SESSION.kcal))} kcal`;}
function lfDone(){const n=LF_SESSION.count,k=LF_SESSION.kcal;closeModal();if(n)toast(`${pl(n,'Eintrag','Einträge')} · ${fmtNum(Math.round(k))} kcal eingetragen`);}
// lfTab(1) ist die Liste; 2/3/4 sind die drei Sonderwege. Sie haben KEIN Segment mehr: man kommt
// über eine benannte Zeile hin und über „Zurück zur Liste" zurück. Der Name der Funktion bleibt,
// weil search.js und die Messwerkzeuge ihn kennen.
function lfTab(t,o){o=o||{};if(typeof stopBarcodeCam==='function')stopBarcodeCam(); // Kamera stoppen, wenn man den Scan-Weg verlässt
  const b=document.getElementById('lfBody');if(!b)return;
  const zurueck=groupHTML('',[rowHTML({icon:'arrowLeft',title:'Zurück zur Liste',tap:'lfTab(1)'})],'');
  if(t===1){if(!FOODS.length){b.innerHTML=skeleton(3,'sm');API.get('/foods').then(r=>{FOODS=r.data?.foods||[];if(document.getElementById('lfBody'))lfTab(1,o);});return;}
    LF_SELECTED=null;
    b.innerHTML=`
      <div class="field lf-search"><label for="lf_search">Lebensmittel suchen</label><div class="lf-searchwrap">${icon('search',18)}<input id="lf_search" type="search" placeholder="z.B. Hähnchen, Reis, Quark…" oninput="lfFilter()" autocomplete="off" enterkeyhint="search"></div></div>
      <div id="lf_list"></div>
      <div id="lf_chosen"></div>`;
    lfFilter();loadRecentFoods().then(()=>{if(document.getElementById('lf_list')&&!(val('lf_search')))lfFilter();});
    if(o.focus)setTimeout(()=>{const s=document.getElementById('lf_search');if(s)try{s.focus({preventScroll:true});}catch(e){s.focus();}},50);}
  else if(t===2){b.innerHTML=`<h2 class="rows-h">Strichcode scannen</h2>
      <div id="bc_cam" class="bc-cam"><video id="bc_video" playsinline muted autoplay></video><div class="bc-line"></div></div>
      <div id="bc_status" class="bc-status">Kamera startet… halte den Strichcode ins Bild.</div>
      <div class="field"><label for="bc_code">oder Nummer (EAN) eintippen</label><input id="bc_code" type="text" inputmode="numeric" placeholder="z.B. 4337185272363"></div>
      <button class="btn" onclick="lookupBarcode()">Produkt suchen</button>
      <p class="rows-f">Die Nährwerte kommen aus der offenen Datenbank Open Food Facts. Was dort fehlt, trägst du über „Freie Kalorien eintragen" ein.</p>
      ${zurueck}`;
    startBarcodeCam();}
  else if(t===3){b.innerHTML=`<h2 class="rows-h">Freie Kalorien eintragen</h2>
      <div id="qfForm">
      <div class="field"><label for="qf_name">Bezeichnung</label><input id="qf_name" placeholder="z.B. Restaurant-Pizza"></div>
      <div class="field"><label for="qf_kcal">Kalorien (kcal)</label><input id="qf_kcal" type="number" inputmode="numeric" placeholder="z.B. 650"></div>
      <div class="grid-3">
        <div class="field"><label for="qf_p">Eiweiß</label><input id="qf_p" type="number" inputmode="numeric" placeholder="g"></div>
        <div class="field"><label for="qf_c">Kohlenhydrate</label><input id="qf_c" type="number" inputmode="numeric" placeholder="g"></div>
        <div class="field"><label for="qf_f">Fett</label><input id="qf_f" type="number" inputmode="numeric" placeholder="g"></div>
      </div>${slotSelect('lf_slot')}
      <button class="btn" onclick="confirmQuickFood()">Eintragen</button></div>
      <p class="rows-f">Für alles, was in keiner Liste steht – die Zahlen von der Verpackung oder aus dem Restaurant. Der Eintrag zählt für diesen Tag und steht morgen unter „Zuletzt".</p>
      ${zurueck}`;
    if(o.focus!==false)setTimeout(()=>document.getElementById('qf_name')?.focus(),50);}
  else{b.innerHTML=`<h2 class="rows-h">Eigenes Lebensmittel anlegen</h2>
      <div id="nfForm">
      <div class="field"><label for="nf_name">Name</label><input id="nf_name" placeholder="z.B. Mein Proteinriegel"></div>
      <div class="grid-3">
        <div class="field"><label for="nf_p">Eiweiß /100 g</label><input id="nf_p" type="number" inputmode="decimal" placeholder="g"></div>
        <div class="field"><label for="nf_c">Kohlenhydrate /100 g</label><input id="nf_c" type="number" inputmode="decimal" placeholder="g"></div>
        <div class="field"><label for="nf_f">Fett /100 g</label><input id="nf_f" type="number" inputmode="decimal" placeholder="g"></div>
      </div>
      <button class="btn" onclick="confirmNewFood()">Speichern und auswählen</button></div>
      <p class="rows-f">Werte pro 100 g, wie auf der Packung. Das Lebensmittel steht danach dauerhaft in deiner Liste – im Gegensatz zu „Freie Kalorien", die nur für einen Tag gelten.</p>
      ${zurueck}`;
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
// K11/G5: Der Stern in jeder Listenzeile ist WEG. Gemessen waren es 42 Symbolknöpfe ohne Wort in
// einem einzigen Sheet – die größte Einzelquelle der ganzen App. Die Funktion ist nicht weg: sie
// heißt jetzt. Nach der Auswahl eines Lebensmittels steht in der Mengenkarte die Schalterzeile
// „Favorit" (dtFavSwitch), und die Favoriten stehen weiter als eigener Abschnitt ganz oben.
// Ein Symbol ohne Wort darf nie DER Weg sein (G5); hier war es der einzige.
function dtFavSwitch(name){const on=dtFavSet().has(dtNorm(name));
  return groupHTML('',[rowHTML({icon:'star',title:'Favorit',
    sub:on?'Steht oben in der Liste':'Legt es oben in die Liste',
    switch:{name:'lf_fav',on},id:'lfFavRow'})],'');}
// Den Schalter erst nach dem Einsetzen verdrahten: rowHTML() kennt kein onchange, und ein Helfer,
// der fuer einen Sonderfall ein Attribut mehr lernt, ist der Anfang der naechsten 25 Zeilenformen.
function dtFavBind(name){const sw=document.querySelector('#lfFavRow input.sw');
  if(sw)sw.onchange=function(){dtLfToggleFav(name);};}

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
function _lfRow(f,i,sub){return rowHTML({title:f.name,
  sub:(sub&&sub.txt?sub.txt+' · ':'')+kcalUnitTxt(f),
  pill:f.owner_id?{text:'eigenes',tone:'neutral'}:null,
  tap:'lfPick('+i+(sub&&sub.amount?',{amount:'+(+sub.amount||0)+'}':'')+')'});}
// Zeile für einen FREIEN Eintrag aus „Zuletzt" (Manuell/Restaurant): dahinter steht kein Lebensmittel, also
// auch keine Menge zum Skalieren – dafür genügt EIN Tipp, um denselben Eintrag noch einmal zu buchen.
function dtFreeRow(r,i){const m=r.m||{};
  return rowHTML({title:r.name,pill:{text:'freier Eintrag',tone:'neutral'},
    sub:'zuletzt · '+fmtNum(Math.round(m.kcal||0))+' kcal · '+macroLine(m.protein,m.carbs,m.fat),
    tap:'dtLogRecent('+i+')'});}
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
// Die Liste. Ohne Suchtext stehen oben die Abschnitte, die ein Mensch wirklich braucht – Zuletzt,
// Favoriten, Vorlagen –, dann eine kurze Auswahl aus allen Lebensmitteln, dann die drei benannten
// Sonderwege. Die Vollliste (113 Einträge) steht NICHT mehr am Stück da: sie hat das Sheet auf
// 3.212 px getrieben, von denen 76 % unsichtbar waren. Wer ein bestimmtes Lebensmittel sucht,
// tippt oben – das ist ein Tap weniger als 80-mal scrollen.
// Mit Suchtext: normalisiert und mehrwortfähig gefiltert (dtNorm/dtHit), über Lebensmittel UND
// freie Zuletzt-Einträge.
const LF_ALLE_KURZ=12;
function lfFilter(){const toks=dtToks(val('lf_search')||'');
  const el=document.getElementById('lf_list');if(!el)return;
  const seenN=new Set();const all=[];FOODS.forEach((f,i)=>{const k=f.name.toLowerCase();if(seenN.has(k))return;seenN.add(k);all.push({f,i});});
  const fav=dtFavSet();const favHit=n=>fav.has(dtNorm(n));
  all.sort((a,b)=>(favHit(b.f.name)?1:0)-(favHit(a.f.name)?1:0)||(b.f.owner_id?1:0)-(a.f.owner_id?1:0)||(b.f.use_count||0)-(a.f.use_count||0)||a.f.name.localeCompare(b.f.name,'de'));
  const rec=(LF_RECENT&&LF_RECENT.user===VIEW_USER)?LF_RECENT.list:[];
  let h='';
  if(!toks.length){const shown=new Set();
    // Zuletzt zuerst: gemessen ist Wiederholen der häufigste Fall (A-IV.4).
    const zuletzt=[];
    rec.slice(0,6).forEach((r,ri)=>{const k=dtNorm(r.name||'');if(!k||shown.has(k))return;
      const idx=FOODS.findIndex(f=>dtNorm(f.name)===k);const f=FOODS[idx];
      if(f){shown.add(k);zuletzt.push(_lfRow(f,idx,{amount:r.amount,txt:r.amount?'zuletzt '+fmtNum(r.amount)+' '+foodUnit(f.name,f):'zuletzt'}));}
      else if(r.m&&r.m.kcal>0){shown.add(k);zuletzt.push(dtFreeRow(r,ri));}});
    all.filter(x=>(x.f.use_count||0)>0).slice(0,6).forEach(x=>{if(zuletzt.length>=6||shown.has(dtNorm(x.f.name)))return;
      shown.add(dtNorm(x.f.name));zuletzt.push(_lfRow(x.f,x.i,{txt:'häufig'}));});
    if(zuletzt.length)h+=groupHTML('Zuletzt',zuletzt,'',{inset:false});
    const favRows=all.filter(x=>favHit(x.f.name)&&!shown.has(dtNorm(x.f.name))).slice(0,6);
    favRows.forEach(x=>shown.add(dtNorm(x.f.name)));
    if(favRows.length)h+=groupHTML('Favoriten',favRows,'',{inset:false});
    // Mahlzeiten-Vorlagen: bis 3.0.2 lagen sie hinter einem „···"-Chip am Ende einer waagrecht
    // scrollenden Reihe und ließen sich nur per Rechtsklick verwalten (R6). Jetzt stehen sie hier.
    const tpl=_dietSelf()?dtTplLoad():[];
    if(tpl.length)h+=groupHTML('Vorlagen',tpl.slice(0,6).map((t,i)=>rowHTML({icon:'star',title:t.name,
      sub:pl(t.items.length,'Eintrag','Einträge')+(t.slot?' · '+t.slot:''),
      value:fmtNum(t.kcal||0)+' kcal',tap:'dtTplMenu('+i+')'})),
      'Eine Vorlage ist eine gespeicherte Mahlzeit aus deinem Protokoll.');
    const rest=all.filter(x=>!shown.has(dtNorm(x.f.name))).slice(0,LF_ALLE_KURZ);
    if(rest.length)h+=groupHTML('Lebensmittel',rest.map(x=>_lfRow(x.f,x.i)),
      all.length>LF_ALLE_KURZ?('Das sind '+fmtNum(LF_ALLE_KURZ)+' von '+fmtNum(all.length)+'. Tipp oben ins Suchfeld, um in allen zu suchen.'):'',{inset:false});
    h+=lfWegeGruppe();}
  else{const matches=all.filter(x=>dtHit(x.f.name,toks)).slice(0,60);
    const free=rec.map((r,ri)=>({r,ri})).filter(x=>x.r.m&&x.r.m.kcal>0&&!FOODS.some(f=>dtNorm(f.name)===dtNorm(x.r.name))&&dtHit(x.r.name,toks)).slice(0,10);
    if(free.length)h+=groupHTML('Zuletzt eingetragen',free.map(x=>dtFreeRow(x.r,x.ri)),'',{inset:false});
    if(matches.length)h+=groupHTML(pl(matches.length,'Treffer','Treffer'),matches.map(x=>_lfRow(x.f,x.i)),'',{inset:false});
    if(!matches.length&&!free.length)h+=emptyState({icon:'search',title:'Nichts gefunden',
      text:'Trag die Kalorien frei ein oder leg das Lebensmittel als eigenes an – beides steht unten.'});
    h+=lfWegeGruppe();}
  el.innerHTML=h;}
// Die drei Wege, die bis 3.0.2 das Segment „Scan / Manuell / Neu" waren. Sie stehen als benannte
// Zeilen am Ende der Liste – „Kein Treffer? Lebensmittel anlegen" ist die letzte Zeile (DESIGN-4 6.4).
function lfWegeGruppe(){return groupHTML('Selbst eintragen',[
  rowHTML({icon:'barcode',title:'Strichcode scannen',sub:'Nährwerte aus der Packung holen',tap:'lfTab(2)'}),
  rowHTML({icon:'pencil',title:'Freie Kalorien eintragen',sub:'Restaurant, Einladung, Selbstgekochtes',tap:'lfTab(3)'}),
  rowHTML({icon:'plus',title:'Eigenes Lebensmittel anlegen',sub:'Steht danach dauerhaft in deiner Liste',tap:'lfTab(4)'})
],'Alles drei trägt auf den Tag ein, den das Tagebuch gerade zeigt.');}
// Lebensmittel auswählen -> Menge (Portions-Chips) + Slot + Makro-Vorschau + Hinzufügen
function lfPick(i,o){o=o||{};LF_SELECTED=i;const f=FOODS[i];if(!f)return;
  const pm=pieceModeFor(f.name);LF_PIECE=pm;const unit=foodUnit(f.name,f);
  const isPiece=unit==='Stück';
  const def=o.amount||(isPiece?1:100);
  const chips=portionChips(f.name,unit);
  document.getElementById('lf_chosen').innerHTML=`
    <h2 class="rows-h">${esc2(f.name)}<button type="button" class="a" onclick="lfClear()">Anderes wählen</button></h2>
    <div class="card lf-chosen">
      <div class="field"><label for="lf_amt">Menge (${unit})</label><input id="lf_amt" type="number" inputmode="decimal" value="${def}" oninput="lfCalc()"></div>
      <div class="chip-row wrap" id="lf_portions">${chips.map(([v,l])=>`<button class="chip${+def===v?' on':''}" data-v="${v}" onclick="lfSetAmt(${v},this)">${esc2(l)}</button>`).join('')}</div>
      ${slotSelect('lf_slot',o.slot)}
    </div>
    <div id="lf_out"></div>
    ${dtFavSwitch(f.name)}
    <button class="btn" onclick="confirmLogFood()">Hinzufügen</button>`;
  dtFavBind(f.name);
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
  const out=document.getElementById('lf_out');
  if(out)out.innerHTML=macroRows(kc,prot,carb,fat,null,'Das trägst du ein',
    'Gerechnet aus '+fmtNum(a,0)+' '+foodUnit(f.name,f)+'.');}
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
  const rows=recipes.map(rc=>{const dk=Math.round((rc.kcal||0)-mealKcal),dp=Math.round((rc.protein||0)-mealP);
    const dietTxt=rc.diet==='vegan'?'Vegan · ':rc.diet==='veg'?'Vegetarisch · ':'';
    return rowHTML({title:rc.name,
      sub:dietTxt+macroLine(rc.protein,rc.carbs,rc.fat)+' · '+sgn(dk)+' kcal, '+sgn(dp)+' g Eiweiß gegenüber dem Plan',
      value:fmtNum(Math.round(rc.kcal))+' kcal',tap:'doSwapMeal('+mealId+','+rc.id+')'});});
  openSheet('Mahlzeit tauschen',`<div class="dt-sheet">${groupHTML('Passende Rezepte',rows,
    'Sortiert nach Ähnlichkeit zu '+mealName+' (rund '+fmtNum(mealKcal)+' kcal und '+fmtNum(mealP)+' g Eiweiß). Die Zeile zeigt, wie viel der Tausch an Kalorien und Eiweiß ändert.',
    {inset:false})}</div>`,{size:'tall'});}
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
function dtAskKey(ask){const u=(typeof VIEW_USER!=='undefined'&&VIEW_USER!=null)?VIEW_USER:0;
  return 'be_kcalask_'+u+'_'+Math.round(ask?.train?.suggested||0)+'_'+Math.round(ask?.rest?.suggested||0);}
function dtAskAnswered(ask){try{return !!localStorage.getItem(dtAskKey(ask));}catch(e){return false;}}
async function dtKcalAskApply(){const ask=renderDiet.foodlog?.summary?.kcalAsk;if(!ask||!_dietSelf())return;
  const t=Math.round(ask.train?.suggested||0),r=Math.round(ask.rest?.suggested||0);
  if(!t&&!r)return;
  const body={};if(t)body.kcal_target_train=t;if(r)body.kcal_target_rest=r;
  const res=await API.put('/profile',body);
  if(res.status!==200)return toast(_dietErrTx(res,'Fehler – nicht gespeichert'));
  try{localStorage.setItem(dtAskKey(ask),'1');}catch(e){}
  if(typeof ME==='object'&&ME){if(t)ME.kcal_target_train=t;if(r)ME.kcal_target_rest=r;}
  await refreshFoodlog(true);   // holt das Protokoll neu; ohne Abweichung liefert der Server kcalAsk:null
  toast('Ziel übernommen');}
function dtKcalAskKeep(){const ask=renderDiet.foodlog?.summary?.kcalAsk;if(!ask)return;
  try{localStorage.setItem(dtAskKey(ask),'1');}catch(e){}
  if(document.getElementById('dietBody')&&(renderDiet.tab==='track'||!renderDiet.tab))drawTrack();
  toast('Gespeichertes Ziel bleibt – gerechnet wird weiter mit dem neuen Wert');}

// ===== PLAN (DESIGN-4 6.5) =====
// Steuerebenen unter dem Titel: 1 (das Segment des Reiters). Das zweite Segment Trainingstag/Ruhetag
// ist eine WORTAKTION im Abschnittskopf geworden („Ruhetag zeigen") – sie sagt, was sie tut, und
// die Überschrift daneben sagt, wo man gerade steht („Ziele für Trainingstage").
// Das runde Plan-„···" mit fünf Funktionen (R7) ist weg; alle fünf stehen als Zeilen im Abschnitt
// „Plan ändern". Makro-Rechner und Lebensmittel ausschließen hatten bis 3.0.2 KEINEN anderen
// Tap-Weg in der ganzen App – sie lagen hinter einem Symbol, das wie ein dritter Segmentknopf aussah.
// Die aufklappbaren Mahlzeitkarten (.meal/.meal-h/.fi, drei eigene Zeilenformen) sind ersetzt:
// eine Mahlzeit ist eine Zeile und führt auf das Mahlzeit-Sheet (6.4).
function drawDiet(){_dietMark('plan');const allMeals=renderDiet.meals||[];const meals=planMeals(DIET);
  const el=document.getElementById('dietBody');if(!el)return;
  const target=dietTargetKcal();const self=_dietSelf();
  // Ohne echte Antwort NICHT „Noch kein Ernährungsplan" anbieten: „Plan automatisch erstellen" würde offline
  // zwar nichts tun, online aber den vorhandenen Plan überschreiben, den der Athlet gerade nur nicht sieht.
  if(!allMeals.length&&!renderDiet.mealsOk){el.innerHTML=dtLoadNote('plan',renderDiet.mealsSt);return;}
  if(!allMeals.length){
    el.innerHTML=emptyState({icon:'utensils',title:'Noch kein Ernährungsplan',text:'Aus deinem Profil (Gewicht, Größe, Ziel) entsteht automatisch ein Plan mit konkreten Mahlzeiten für Trainings- und Ruhetage.',btn:{label:'Plan automatisch erstellen',onclick:'genMealPlan()'}})
      +(self?dtPlanAendern({leer:true})
            :groupHTML('Vorher',[rowHTML({icon:'x',title:'Lebensmittel ausschließen',sub:'Was nicht im Plan landen soll',tap:'openDislikes()'})],
              'Was du hier ausschließt, kommt im automatischen Plan nicht vor.'));
    if(self)dtPlanBind();
    return;}
  const tot={kcal:0,protein:0,carbs:0,fat:0};meals.forEach(m=>{const t=mealTotals(m);tot.kcal+=t.kcal;tot.protein+=t.protein;tot.carbs+=t.carbs;tot.fat+=t.fat;});
  const anderer=DIET==='training'?'rest':'training';
  const kopf='Ziele für '+(DIET==='training'?'Trainingstage':'Ruhetage');
  const tp=dtPlanTargetProtein();
  let h=groupHTML(kopf,[
    rowHTML({title:'Kalorien',value:fmtNum(Math.round(tot.kcal))+(target?' / '+fmtNum(target):'')+' kcal'}),
    rowHTML({title:'Eiweiß',value:fmtNum(Math.round(tot.protein))+(tp?' / '+fmtNum(tp):'')+' g'}),
    rowHTML({title:'Kohlenhydrate',value:fmtNum(Math.round(tot.carbs))+' g'}),
    rowHTML({title:'Fett',value:fmtNum(Math.round(tot.fat))+' g'})
  ],[dtZielHerkunft({kcal:target,src:'server'}),dtPlanFitTx(tot.kcal,tot.protein,target)].filter(Boolean).join(' '),
  {inset:false,action:{label:(anderer==='rest'?'Ruhetag':'Trainingstag')+' zeigen',tap:"setDiet('"+anderer+"')"}});
  h+=dtKcalAskGroup(DIET);
  if(!meals.length){h+=emptyState({icon:'utensils',title:'Keine Mahlzeiten für diesen Tagtyp',text:'Erstelle den Plan neu, damit beide Tagtypen befüllt werden.',btn:{label:'Plan neu erstellen',onclick:'genMealPlan()'}});
    // Auch hier hing „Plan ändern" hinter einem `return`: ein Plan, der nur Trainingstage kennt,
    // nahm dem Ruhetag den Makro-Rechner und den Schalter mit. Es ist derselbe Athlet, dieselbe Sicht.
    if(self)h+=dtPlanAendern();
    el.innerHTML=h;if(self)dtPlanBind();return;}
  const isToday=DIET===(renderDiet.foodlog?.dayType||renderDiet.todayType||DIET);
  const L=loggedMealIds();
  h+=groupHTML('Mahlzeiten',meals.map(m=>{const t=mealTotals(m);const done=isToday&&mealLogged(m,L);
    const names=(m.items||[]).map(i=>i.food).join(', ');
    return rowHTML({icon:done?'check':'utensils',title:m.label||('Mahlzeit '+m.meal_no),
      sub:fmtNum(Math.round(t.kcal))+' kcal · '+fmtNum(Math.round(t.protein))+' g Eiweiß'+(names?' · '+names:''),
      pill:done?{text:'eingetragen',tone:'green'}:null,
      tap:'openMealSheet('+m.id+')'});}),
    self?'Tipp eine Mahlzeit an: dort stehen die Zutaten, „Gegessen" und „Tauschen". Die Mengen sind Richtwerte.'
        :'Tipp eine Mahlzeit an, um Zutaten und Nährwerte zu sehen. Eintragen und Tauschen macht der Athlet selbst.');
  if(self)h+=dtPlanAendern();
  el.innerHTML=h;
  if(self)dtPlanBind();}
// R7: die fünf Funktionen, die bis 3.0.2 hinter dem runden „···" neben dem Segment lagen – als Zeilen.
// „Zum Einkaufswagen" entfällt doppelt: das ist bereits ein Segmentknopf.
//
// `o.leer` = die Gruppe für den Zustand OHNE Plan. Der ist nicht die Ausnahme, sondern der Zustand
// JEDES neuen Kontos, und bis hierher kehrte drawDiet() an zwei Stellen zurück, BEVOR diese Gruppe
// gebaut wurde. Gemessen am laufenden Server (dz/f3/V1-plan-leer.png): Ernährung › Plan zeigte
// wörtlich „Noch kein Ernährungsplan | Plan automatisch erstellen | Vorher | Lebensmittel
// ausschließen" – Makro-Rechner, Ziele automatisch anpassen und Wie die Anpassung rechnet standen
// nirgends. Einziger Weg blieb die Lupe, deren Unterzeile „Makro-Rechner · Ernährung" sogar einen
// Ort behauptete, an dem er dann nicht stand (R9/G5). Drei der vier Zeilen arbeiten ohne Plan;
// „Plan neu erstellen" bleibt draußen, denn ohne Plan gibt es nichts neu zu erstellen – dafür steht
// der rote Knopf „Plan automatisch erstellen" zwei Zentimeter darüber.
function dtPlanAendern(o){o=o||{};
  const aus=myDisliked().length;
  const rows=[
    rowHTML({icon:'scale',title:'Makro-Rechner',sub:'Nährwerte einer Menge nachrechnen',tap:'openCalc()'}),
    rowHTML({icon:'x',title:'Lebensmittel ausschließen',sub:'Was nicht im Plan landen soll',
      value:aus?pl(aus,'ausgeschlossen','ausgeschlossen'):'nichts',tap:'openDislikes()'}),
    rowHTML({icon:'trendUp',title:'Ziele automatisch anpassen',sub:'Wöchentlich nach deinem Gewichtsverlauf',
      switch:{name:'adp_plan',on:adpOn()},id:'adpPlanRow'}),
    rowHTML({icon:'info',title:'Wie die Anpassung rechnet',sub:'Der Vorschlag dieser Woche und seine Herkunft',tap:'adpOpenSettings()'})];
  if(!o.leer)rows.push(rowHTML({icon:'refresh',title:'Plan neu erstellen',
    sub:'Ersetzt den aktuellen Plan durch einen neuen Vorschlag',tap:'genMealPlan()'}));
  return groupHTML(o.leer?'Vorher':'Plan ändern',rows,
    (o.leer?'Was du hier ausschließt, kommt im automatischen Plan nicht vor. Der Makro-Rechner arbeitet auch ohne Plan. '
           :'')
    +'„Ziele automatisch anpassen" ändert deine Kalorien wöchentlich anhand deines Gewichtstrends – und fragt dich vor jeder Änderung.'
    +(o.leer?'':' „Plan neu erstellen" lässt sich sofort widerrufen.'));}
// Der Schalter im Plan wird nach dem Zeichnen verdrahtet (rowHTML kennt kein onchange).
function dtPlanBind(){const sw=document.querySelector('#adpPlanRow input.sw');
  if(sw)sw.onchange=function(){adpSetMode(this.checked);};}
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
    <div class="dt-sheet"><h2 class="rows-h">Was nicht im Plan landen soll</h2>
    <div class="chip-row wrap">${chips}</div>
    <p class="rows-f">Tipp an, was du nicht magst oder nicht verträgst. Diese Lebensmittel kommen weder in den automatischen Plan noch in die Rezeptliste.</p>
    <button class="btn" onclick="saveDislikes()">Speichern</button></div>`);}
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
// Welche Filter gerade wirken – als SATZ im Fußtext, nicht als Chip-Reihe (DESIGN-4 6.6/G4).
// Die Chip-Reihe war die zweite Steuerebene dieser Ansicht und sagte mit „Filter · 2" nicht, WAS
// gefiltert ist. Der Satz sagt es; geändert wird über die Wortaktion „Filtern" im Abschnittskopf.
// Was die Liste gerade einschränkt – EINE Quelle für zwei Leser: den Fußtext unter der Gruppe
// („Gefiltert nach: …") und die Zahl im Untertitel des großen Titels. Ohne diese eine Quelle würden
// die beiden Stellen irgendwann Verschiedenes behaupten.
function _rcFilterTeile(){const f=RECIPE_FILTER||defaultRecipeFilter();
  const dt=(_dietSelf()?ME.diet_type:VIEW_USER_PROFILE?.diet_type)||'all';
  const teile=[];
  if(f.meal&&f.meal!=='all')teile.push(f.meal);
  if(f.goal&&f.goal!=='all')teile.push(({muscle:'Aufbau',fatloss:'Definition',health:'Gesundheit'})[f.goal]||f.goal);
  if(dt!=='all')teile.push(({vegetarian:'Vegetarisch',vegan:'Vegan'})[dt]||dt);
  if(f.category&&f.category!=='all')teile.push(f.category);
  if(f.source==='mine')teile.push('nur eigene');else if(f.source==='shared')teile.push('nur geteilte');
  if(f.fit)teile.push('passt ins heutige Budget');
  if(myDisliked().length)teile.push('ohne '+pl(myDisliked().length,'ausgeschlossenes Lebensmittel','ausgeschlossene Lebensmittel'));
  if(f.simKcal)teile.push('nach Kalorien sortiert (≈ '+fmtNum(Math.round(f.simKcal))+' kcal)');
  return teile;}
function _rcFilterSatz(){const teile=_rcFilterTeile();
  return teile.length?('Gefiltert nach: '+teile.join(' · ')+'. Über „Filtern" änderst du das.')
    :'Alle Rezepte. Über „Filtern" schränkst du auf Mahlzeit, Ziel, Ernährungsweise oder dein Kalorienbudget ein.';}
// Rezepte-Tab: Suche + eine Gruppe. Die Liste wird separat gezeichnet, damit die Suche den Fokus behält.
async function drawRecipes(){_dietMark('recipes');const el=document.getElementById('dietBody');if(!el)return;
  if(!RECIPE_FILTER)RECIPE_FILTER=defaultRecipeFilter();
  el.innerHTML=`<div class="field lf-search rc-search"><label for="rc_search">Rezept suchen</label><div class="lf-searchwrap">${icon('search',18)}<input id="rc_search" type="search" placeholder="Name oder Zutat…" value="${esc2(RECIPE_Q)}" oninput="recipeSearch(this.value)" autocomplete="off" enterkeyhint="search"></div></div>
    <div id="rcList">${skeleton(3)}</div>`;
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
  RECIPES_CACHE=recipes;
  renderDiet.recipesOk=true;dtSetLgSub();   // erst jetzt ist die Zahl im Untertitel belegt
  const self=_dietSelf();
  const kopf=q?pl(recipes.length,'Treffer','Treffer'):'Rezepte';
  if(!recipes.length){el.innerHTML=emptyState({icon:'search',title:q?'Nichts gefunden':'Keine Rezepte für diese Filter',
      text:q?'Versuch einen anderen Begriff.':'Ändere die Filter oder leg ein eigenes Rezept an.'})
    +(self?`<button class="btn" onclick="openNewRecipe()">${icon('plus',18)} Eigenes Rezept anlegen</button>`:'')
    +`<p class="rows-f">${esc2(_rcFilterSatz())}</p>`;return;}
  const hideMeal=!q&&f.meal!=='all';
  const rows=recipes.map(rc=>{
    const goalTxt=({muscle:'Aufbau',fatloss:'Definition',health:'Gesundheit'})[rc.goal]||'';
    // Woerter statt Symbolpillen: die beiden Pflanzen-/Karotten-Symbole waren Symbole ohne Text (K11/G9).
    const dietTxt=rc.diet==='vegan'?'Vegan':rc.diet==='veg'?'Vegetarisch':'';
    const mine=rc.owner_id===ME?.id, shared=rc.owner_id&&!mine;
    const meta=[hideMeal?'':rc.meal_type,rc.category,goalTxt,dietTxt].filter(Boolean).join(' · ');
    return rowHTML({title:rc.name,
      sub:(meta?meta+' · ':'')+macroLine(rc.protein,rc.carbs,rc.fat),
      pill:mine?{text:'eigenes',tone:'neutral'}:(shared?{text:'geteilt',tone:'neutral'}:null),
      value:fmtNum(Math.round(rc.kcal))+' kcal',tap:'openRecipe('+rc.id+')'});});
  el.innerHTML=groupHTML(kopf,rows,_rcFilterSatz()+' Ein Rezept lässt sich als Mahlzeit eintragen oder in den Einkauf legen.',
    {inset:false,action:{label:'Filtern',tap:'openRecipeFilter()'}})
    +(self?`<button class="btn" onclick="openNewRecipe()">${icon('plus',18)} Eigenes Rezept anlegen</button>`:'');}
// Filter-Sheet: Ziel, Mahlzeit, Ernährungsweise, Quelle, Kategorie, Budget, Ausschlüsse – Chips schalten in-place
function openRecipeFilter(){if(!RECIPE_FILTER)RECIPE_FILTER=defaultRecipeFilter();const f=RECIPE_FILTER;const meals=['Frühstück','Mittag','Abend','Snack'];
  const sum=renderDiet.foodlog?.summary||{};const remaining=sum.remaining;
  const dt=(_dietSelf()?ME.diet_type:VIEW_USER_PROFILE?.diet_type)||'all';
  const grp=(label,key,opts,cur,fn)=>`<h2 class="rows-h">${esc2(label)}</h2><div class="chip-row wrap rc-filtergrp" data-rfg="${key}">`+opts.map(([v,l])=>`<button class="chip${cur===v?' on':''}" data-v="${esc2(v)}" onclick="${fn?fn+"('"+esc(v)+"')":"recipeFilter('"+key+"','"+esc(v)+"')"}">${esc2(l)}</button>`).join('')+`</div>`;
  let h=grp('Ziel','goal',[['all','Alle'],['muscle','Aufbau'],['fatloss','Definition'],['health','Gesundheit']],f.goal);
  h+=grp('Mahlzeit','meal',[['all','Alle'],...meals.map(m=>[m,m])],f.meal);
  h+=grp('Ernährungsweise','diet',[['all','Alle'],['vegetarian','Vegetarisch'],['vegan','Vegan']],dt,'setDietType');
  h+=grp('Quelle','source',[['all','Alle'],['mine','Eigene'],['shared','Geteilt']],f.source||'all');
  if(RECIPE_CATS.length)h+=grp('Kategorie','category',[['all','Alle'],...RECIPE_CATS.map(c=>[c,c])],f.category||'all');
  const rows=[];
  if(remaining>0)rows.push(rowHTML({icon:'target',title:'Nur was ins Budget passt',
    sub:fmtNum(remaining)+' kcal übrig',switch:{name:'rc_fit',on:!!f.fit},id:'rcFitRow'}));
  rows.push(rowHTML({icon:'x',title:'Zutaten ausschließen',
    sub:myDisliked().length?pl(myDisliked().length,'Lebensmittel','Lebensmittel')+' ausgeschlossen':'Unverträglichkeiten, Abneigungen',tap:'openDislikes()'}));
  h+=groupHTML('Weitere Filter',rows,'Ausgeschlossene Lebensmittel gelten überall: im Plan, in den Rezepten und im Einkauf.');
  h+=`<div class="lf-done"><span class="fill" id="rfCount"></span><button class="btn sec inline" onclick="closeModal()">Fertig</button></div>`;
  openSheet('Rezepte filtern',`<div class="dt-sheet">${h}</div>`,{size:'tall'});
  const sw=document.querySelector('#rcFitRow input.sw');if(sw)sw.onchange=function(){recipeFilter('fit',this.checked);};
  _rfCount();}
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
  closeAllSheets();if(typeof closeAllPages==='function')closeAllPages();
  if(document.getElementById('dietBody'))dietTab('recipes');else{renderDiet.tab='recipes';go('diet');}
  if(kcal)toast('Ähnliche '+(mealType?mealType+'-Rezepte':'Rezepte')+' nach Kalorien sortiert');}
// Das Rezept ist eine PUSH-SEITE, kein Sheet (DESIGN-4 6.6 / R17). Es hat einen eigenen Titel, einen
// Zurück-Knopf mit dem Namen des Bildschirms darunter (G3) und genug Platz für Zutaten und
// Zubereitung – als Sheet lag beides unter dem Falz. Das „Mehr"-Punktemenü (recipeMore) entfällt:
// Teilen und Löschen stehen als benannte Zeilen auf der Seite. Die vier Quadratkacheln `.rc-act`
// (66 px, eigene Zeilenform, Symbol über einem Wort) werden Zeilen.
// Eine Ebene ZEIGEN statt sie ein zweites Mal zu stapeln.
// GEMESSEN (dz/f3/plan-v.json, Schritte L1–L3, Bild dz/f3/V4-rezept-zurueck1.png): openRecipe() rief
// pushPage() mit DEMSELBEN Schlüssel zweimal auf – erst mit dem Spinner, dann mit dem Rezept –, und
// pushPage() (shell.js) kennt keine Regel „gleicher Schlüssel obenauf → ersetzen". Ergebnis:
// PUSH_STACK = ["recipe-53|Rezept", "recipe-53|Bircher Müsli"], und der Schnappschuss der unteren
// Ebene war der SPINNER. Ein Tipp auf „‹ Ernährung" führte damit nicht nach Ernährung, sondern auf
// einen Rezepttitel über 1.500 px Schwarz mit einem Kreisel, der sich nie auflöst; erst der zweite
// Tipp kam an. Vorbild für den Weg hier: acRepaint() in account.js.
// Der dauerhafte Riegel gehört in pushPage() selbst und ist als D3-2.1 an die Hülle gemeldet – diese
// Datei baut den Fehler nicht mehr, egal was die Hülle tut.
function dtPageSet(key,title,eltern,html,opts){opts=opts||{};
  let e=null;
  try{if(typeof PUSH_STACK!=='undefined'&&PUSH_STACK.length){
    const t=PUSH_STACK[PUSH_STACK.length-1];if(t&&t.key===String(key))e=t;}}catch(err){e=null;}
  if(!e)return pushPage(key,title,eltern,html,opts);
  e.title=String(title||'');
  e.sub=opts.sub==null?'':String(opts.sub);
  if(opts.short!=null)e.short=String(opts.short);
  e.html=String(html==null?'':html);
  e.onMount=typeof opts.onMount==='function'?opts.onMount:null;
  const el=document.getElementById('pushView');const page=el&&el.querySelector('.page');
  if(!page)return;
  const bar=page.querySelector('.push-bar');const y=el.scrollTop;
  const h1=(e.title&&!/class="lg-title"/.test(e.html))
    ?`<h1 class="lg-title" data-auto="1">${esc2(e.title)}${e.sub?`<small>${esc2(e.sub)}</small>`:''}</h1>`:'';
  page.innerHTML=(bar?bar.outerHTML:'')+h1+e.html;
  el.scrollTop=y;
  if(typeof mountLargeTitle==='function')mountLargeTitle();
  if(e.onMount)try{e.onMount();}catch(err){console.error('[ernaehrung]',err);}}
async function openRecipe(id){let rc=RECIPES_CACHE.find(x=>x.id===id);
  const eltern=(typeof TITLES==='object'&&TITLES&&typeof CUR_TAB!=='undefined'&&TITLES[CUR_TAB])||'Ernährung';
  pushPage('recipe-'+id,rc?rc.name:'Rezept',eltern,'<div class="spinner"></div>',{short:'Rezept'});
  const dr=await API.get('/recipes/'+id);if(dr.status===200)rc=dr.data.recipe;
  if(!rc){dtPageSet('recipe-'+id,'Rezept',eltern,emptyState({icon:'search',title:'Rezept nicht gefunden',
    text:'Vielleicht wurde es gelöscht oder die Freigabe wurde zurückgenommen.'}),{short:'Rezept'});return;}
  openRecipe.cur=rc;
  const self=_dietSelf();
  const isMine=rc.owner_id===ME?.id;
  const goalTxt=({muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'})[rc.goal]||'für alle Ziele';
  const dietTxt=rc.diet==='vegan'?'Vegan':rc.diet==='veg'?'Vegetarisch':'';
  const unter=[rc.meal_type||'Mahlzeit',goalTxt,rc.category,dietTxt,(rc.owner_id&&!isMine)?'geteilt':(isMine?'eigenes Rezept':'')].filter(Boolean).join(' · ');
  let h='';
  if(rc.photo)h+=`<img id="rc_photo" alt="Foto des Rezepts ${esc2(rc.name)}" class="rc-photo">`; // src wird unten als Property gesetzt
  h+=macroRows(rc.kcal,rc.protein,rc.carbs,rc.fat,null,'Nährwerte','Je Portion.');
  if(self)h+=`<button class="btn" onclick="logRecipe(${rc.id})">${icon('check',18)} Als Mahlzeit eintragen</button>`;
  const akt=[];
  if(self)akt.push(rowHTML({icon:'cart',title:'In den Einkauf legen',sub:'Zutaten in den Einkaufswagen',tap:'cartFromRecipe('+rc.id+')'}));
  akt.push(rowHTML({icon:'refresh',title:'Ähnliche Rezepte',sub:'Nach Kalorien sortiert (≈ '+fmtNum(Math.round(rc.kcal||0))+' kcal)',
    tap:"similarRecipes("+(rc.kcal||0)+",'"+esc(rc.meal_type||'')+"')"}));
  akt.push(rowHTML({icon:'share',title:'Teilen',sub:'Per Link oder mit einzelnen Personen',tap:'openShareRecipe('+rc.id+",'"+esc(rc.name)+"')"}));
  if(rc.link&&/^https?:\/\//.test(rc.link))akt.push(rowHTML({icon:'play',title:'Rezept ansehen (extern)',sub:rc.link,tap:"window.open('"+esc(rc.link)+"','_blank','noopener')"}));
  h+=groupHTML('Was du damit tun kannst',akt,'„Als Mahlzeit eintragen" bucht die Portion auf den Tag, den dein Tagebuch gerade zeigt.');
  if(rc.ingredients)h+=groupHTML('Zutaten',[`<div class="row rc-text">${esc2(rc.ingredients)}</div>`],'',{inset:false});
  if(rc.steps)h+=groupHTML('Zubereitung',[`<div class="row rc-text">${esc2(rc.steps)}</div>`],'',{inset:false});
  if(isMine)h+=groupHTML('',[rowHTML({title:'Rezept löschen',danger:true,tap:'delRecipe('+rc.id+')'})],
    'Gelöscht wird dauerhaft. Bereits eingetragene Mahlzeiten bleiben im Protokoll stehen.');
  dtPageSet('recipe-'+id,rc.name,eltern,h,{short:'Rezept',sub:unter,onMount:()=>{
    if(rc.photo){const im=document.getElementById('rc_photo');if(im)im.src=rc.photo;}}});}
// Teilen-Sheet: Personen (Athlet->Athlet gleicher Coach, Coach->Athleten) + Link an einem Ort
async function openShareRecipe(id,name){const title='„'+name+'“ teilen';openSheet(title,'<div class="spinner"></div>');
  const r=await API.get('/recipes/'+id+'/share-targets');
  const link=rowHTML({icon:'link',title:'Per Link teilen',sub:'Funktioniert für jeden – auch ohne Konto',tap:"shareViaLink('recipe',"+id+")"});
  if(r.status!==200){openSheet(title,`<div class="dt-sheet">${groupHTML('',[link],esc2(r.data?.error||'Die Personenliste ließ sich nicht laden.'))}</div>`);return;}
  const t=r.data;
  let h=groupHTML('',[link],'');
  if(t.canBroadcast)h+=groupHTML('Alle Athleten',[rowHTML({icon:'users',title:'Für alle meine Athleten freigeben',
    switch:{name:'sh_all',on:t.scope==='athletes'},id:'shAllRow'})],
    'Freigegebene Rezepte erscheinen bei deinen Athleten im Rezepte-Reiter mit der Marke „geteilt".');
  if(t.targets.length)h+=groupHTML('Einzeln teilen',t.targets.map(p=>rowHTML({title:p.name,
    switch:{name:'sh_t_'+p.id,on:!!p.shared},id:'shT'+p.id})),
    'Die Auswahl wird erst mit „Speichern" übernommen.')
    +`<button class="btn" onclick="doShareRecipe(${id})">Auswahl speichern</button>`;
  else h+=`<p class="rows-f">${esc2(t.canBroadcast?'Noch keine Athleten zugewiesen.':'Niemand aus deinem Coaching-Kreis zum Teilen verfügbar.')}</p>`;
  openSheet(title,`<div class="dt-sheet">${h}</div>`);
  const sw=document.querySelector('#shAllRow input.sw');if(sw)sw.onchange=function(){shareBroadcast(id,this.checked);};}
async function shareBroadcast(id,on){await API.post('/recipes/'+id+'/share',{scope:on?'athletes':'private'});toast(on?'Für alle Athleten freigegeben ✓':'Freigabe entfernt');}
async function doShareRecipe(id){const boxes=[...document.querySelectorAll('[id^="shT"] input.sw')];
  const uid=b=>+String(b.name||'').replace('sh_t_','');
  const add=boxes.filter(b=>b.checked).map(uid);
  const remove=boxes.filter(b=>!b.checked).map(uid);
  if(add.length)await API.post('/recipes/'+id+'/share',{user_ids:add});
  for(const uid of remove)await API.del('/recipes/'+id+'/share/'+uid);
  closeModal();toast('Teilen aktualisiert ✓');}
// Rezept als gegessen eintragen. opts.quick=true (aus der Liste): Sheet/Liste bleiben, nur Toast mit Rückgängig
async function logRecipe(id,opts){if(_dietRO())return;opts=opts||{};const rc=RECIPES_CACHE.find(x=>x.id===id)||(openRecipe.cur&&openRecipe.cur.id===id?openRecipe.cur:null);
  const slot=(rc&&MEAL_SLOTS.includes(rc.meal_type))?rc.meal_type:slotDefault();
  const r=await API.post('/recipes/'+id+'/log',{user_id:VIEW_USER,date:dtLogDay(),meal_slot:slot});
  if(r.status!==200)return toast(r.data?.error||'Fehler');
  if(!opts.quick){closeAllSheets();if(typeof pushOpen==='function'&&pushOpen())popPage();}
  const fl=await refreshFoodlog(!opts.quick);
  const name=rc?rc.name:'Rezept';
  const row=(fl?.items||[]).slice().reverse().find(it=>it.food===name);
  toast(name+' eingetragen ✓',row?{label:'Rückgängig',fn:async()=>{const dr=await API.del('/foodlog/'+row.id);await refreshFoodlog(!opts.quick);
    toast(dr.status===200?'Zurückgenommen':'Eintrag ist nicht mehr da');}}:undefined);
  if(!opts.quick)dietTab('track');}
function delRecipe(id){confirmSheet('Rezept löschen','Dein eigenes Rezept wird dauerhaft gelöscht.',{label:'Löschen',danger:true,onYes:async()=>{
    const r=await API.del('/recipes/'+id);
    if(r.status===200){closeAllSheets();if(typeof pushOpen==='function'&&pushOpen())popPage();
      RC_CACHE={};RC_ALL=null;toast('Rezept gelöscht');if(renderDiet.tab==='recipes')drawRecipes();}
    else toast(r.data?.error||'Fehler');}});}
// Das Formular für ein eigenes Rezept. Der Aufklapper „Mehr Angaben" (`<details>`) ist weg: ein
// Aufklapper ist per Definition versteckt (G5), und die Messung zählt jedes `<summary>` als
// Navigationsmittel. Stattdessen drei benannte Abschnitte – wer nur Name und Kalorien ausfüllt,
// scrollt an den anderen vorbei; der Fußtext sagt, was optional ist.
function openNewRecipe(){openSheet('Eigenes Rezept',`<div class="dt-sheet" id="nrForm">
  <h2 class="rows-h">Das Nötige</h2>
  <div class="field"><label for="nr_name">Name</label><input id="nr_name" placeholder="z.B. Mein Frühstücks-Bowl"></div>
  <div class="grid-2">
    <div class="field"><label for="nr_kcal">Kalorien</label><input id="nr_kcal" type="number" inputmode="numeric" placeholder="kcal"></div>
    <div class="field"><label for="nr_meal">Mahlzeit</label><select id="nr_meal"><option value="">–</option><option>Frühstück</option><option>Mittag</option><option>Abend</option><option>Snack</option></select></div>
  </div>
  <div class="grid-3">
    <div class="field"><label for="nr_p">Eiweiß</label><input id="nr_p" type="number" inputmode="numeric" placeholder="g"></div>
    <div class="field"><label for="nr_c">Kohlenhydrate</label><input id="nr_c" type="number" inputmode="numeric" placeholder="g"></div>
    <div class="field"><label for="nr_f">Fett</label><input id="nr_f" type="number" inputmode="numeric" placeholder="g"></div>
  </div>
  <p class="rows-f">Name und Kalorien genügen. Alles Weitere kannst du später ergänzen.</p>
  <h2 class="rows-h">Zutaten und Zubereitung</h2>
  <div class="field"><label for="nr_ing">Zutaten (eine pro Zeile)</label><textarea id="nr_ing" rows="3" placeholder="100 g Haferflocken&#10;300 ml Milch"></textarea></div>
  <div class="field"><label for="nr_steps">Zubereitung</label><textarea id="nr_steps" rows="2" placeholder="1. …"></textarea></div>
  <p class="rows-f">Die Zutaten stehen später auf der Rezeptseite und lassen sich von dort in den Einkaufswagen legen.</p>
  <h2 class="rows-h">Einordnung</h2>
  <div class="grid-2">
    <div class="field"><label for="nr_goal">Ziel</label><select id="nr_goal"><option value="">für alle</option><option value="muscle">Aufbau</option><option value="fatloss">Definition</option><option value="health">Gesundheit</option></select></div>
    <div class="field"><label for="nr_diet">Ernährungsweise</label><select id="nr_diet"><option value="">egal</option><option value="veg">Vegetarisch</option><option value="vegan">Vegan</option></select></div>
  </div>
  <div class="field"><label for="nr_cat">Kategorie</label><input id="nr_cat" list="catlist" placeholder="z.B. Bowl, Smoothie"><datalist id="catlist">${(RECIPE_CATS||[]).map(c=>`<option value="${esc2(c)}">`).join('')}</datalist></div>
  <div class="field"><label for="nr_link">Link zu Rezept/Video</label><input id="nr_link" placeholder="https://…"></div>
  <div class="field"><label>Foto</label>
    <label class="btn sec">${icon('camera',18)} Foto aufnehmen oder auswählen<input type="file" accept="image/*" hidden onchange="recipePhotoPick(event)"></label>
    <div id="nr_photo_prev"></div></div>
  ${(ME?.role==='coach'||ME?.role==='admin')?groupHTML('',[rowHTML({icon:'users',title:'Direkt mit allen meinen Athleten teilen',switch:{name:'nr_share_ath',on:false},id:'nrShareRow'})],'Du kannst die Freigabe später auf der Rezeptseite wieder zurücknehmen.'):''}
  <button class="btn" onclick="saveNewRecipe()">Rezept speichern</button></div>`,{size:'tall'});
  setTimeout(()=>document.getElementById('nr_name')?.focus(),60);}
// Foto auswählen, runterskalieren (max 1024px), als Data-URL in NR_PHOTO ablegen
let NR_PHOTO=null;
function recipePhotoPick(ev){const file=ev.target.files&&ev.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=()=>{
    const max=1024;let{width:w,height:h}=img;if(w>max||h>max){if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;}}
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(img,0,0,w,h);
    NR_PHOTO=cv.toDataURL('image/jpeg',0.78);
    const pv=document.getElementById('nr_photo_prev');if(pv)pv.innerHTML=`<img src="${NR_PHOTO}" alt="Vorschau des gewählten Rezeptfotos" class="rc-photo"><button class="btn sec inline" onclick="NR_PHOTO=null;document.getElementById('nr_photo_prev').innerHTML='';">Foto entfernen</button>`;
  };img.src=e.target.result;};reader.readAsDataURL(file);}
async function saveNewRecipe(){const shareAth=document.querySelector('#nrShareRow input.sw');
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

// ===== EINKAUF (DESIGN-4 6.7 / R8) =====
// Bis 3.0.2: 47 Aktionen, 18 ohne Text, davon 16 mit dem Label „Mehr" – 16 zeichengleiche
// Punkte-Symbole, die zusammen vier verschiedene Dinge konnten. „Erledigt" ist die häufigste
// Handlung im Supermarkt und brauchte 2 Taps, obwohl die Zeile schon ein Häkchen trug.
// Jetzt das Muster von Apple Erinnerungen: Häkchen LINKS in der Zeile, EIN Tap. Entfernen, Erledigte
// wegräumen und Wagen leeren stehen im „Bearbeiten"-Modus, den die Wortaktion im Abschnittskopf
// öffnet – kein „···" mehr, nirgends.
let CART_EDIT=false;
function cartEditToggle(){CART_EDIT=!CART_EDIT;drawCart();}
// Die Häkchenzeile. Sie ist die EINE begründete Ausnahme dieser Datei vom Helfer `rowHTML()`:
// der Helfer kennt Schalter (51 x 31) und Chevron, aber kein rundes Häkchen links – und ein
// Einkaufszettel ohne Häkchen links ist keiner (DESIGN-4 6.7 gibt das Markup wörtlich vor).
// Alles andere an der Zeile ist die normale `.row`: 56 px, .rl, .rr, dieselbe Trennlinie.
function cartCheckRow(i){return `<label class="row check${i.checked?' done':''}">
  <input type="checkbox" class="cb"${i.checked?' checked':''} onchange="cartToggle(${i.id})" aria-label="${esc2(i.text)} erledigt">
  <span class="rl">${esc2(i.text)}</span></label>`;}
async function drawCart(){_dietMark('cart');const el=document.getElementById('dietBody');if(!el)return;el.innerHTML=skeleton(3,'sm');
  const r=await API.get('/cart');const items=r.data?.items||[];
  if(!document.getElementById('dietBody')||renderDiet.tab!=='cart')return;
  // Der Untertitel nennt dieselben zwei Zahlen wie die beiden Abschnittsüberschriften (6.7). Ohne
  // Antwort bleibt er leer – „0 Dinge" wäre eine Behauptung über einen Wagen, den niemand gesehen hat.
  renderDiet.cartSub=(r.status!==200)?''
    :items.length?pl(items.length,'Ding','Dinge')+(items.some(i=>i.checked)?', '+fmtNum(items.filter(i=>i.checked).length)+' erledigt':'')
    :'leer';
  dtSetLgSub();
  // Derselbe Fall wie bei Plan und Protokoll: ohne Antwort ist der Wagen nicht leer, er ist nur nicht da
  if(!items.length&&r.status!==200){el.innerHTML=dtLoadNote('cart',r.status);CART_EDIT=false;return;}
  if(!items.length){CART_EDIT=false;
    el.innerHTML=emptyState({icon:'cart',title:'Dein Einkaufswagen ist leer',
      text:'Übernimm deinen Plan, leg Rezept-Zutaten hinein oder füge selbst etwas hinzu.'})
      +`<button class="btn" onclick="cartAddManual()">${icon('plus',18)} Etwas hinzufügen</button>`
      +groupHTML('',[rowHTML({icon:'download',title:'Aus dem Plan übernehmen',sub:'Die Mengen deines Plans für 7 Tage',tap:'cartFromPlan()'})],
        '„Aus dem Plan" rechnet zusammen, was in deinen Plan-Mahlzeiten steht – sieben Tage, eine Liste.');
    return;}
  const offen=items.filter(i=>!i.checked), erledigt=items.filter(i=>i.checked);
  let h='';
  if(CART_EDIT){
    h+=groupHTML('Bearbeiten',items.map(i=>rowHTML({icon:'trash',title:i.text,
        sub:i.checked?'erledigt':'offen',tap:'cartDelete('+i.id+')'})),
      'Tipp eine Zeile an, um sie zu entfernen. Entfernen lässt sich sofort widerrufen.',
      {action:{label:'Fertig',tap:'cartEditToggle()'}});
    h+=groupHTML('',[
      rowHTML({icon:'check',title:'Erledigte entfernen',value:pl(erledigt.length,'erledigt','erledigt'),tap:'cartClear(true)'}),
      rowHTML({title:'Wagen leeren',danger:true,tap:'cartClear(false)'})
    ],'„Wagen leeren" entfernt auch die offenen Einträge und fragt vorher nach.');
    el.innerHTML=h;return;}
  h+=groupHTML('Offen · '+pl(offen.length,'Ding','Dinge'),
    offen.length?offen.map(cartCheckRow):[rowHTML({title:'Alles erledigt',sub:'Nichts steht mehr offen'})],
    'Tipp das Häkchen an, sobald du etwas im Wagen hast – ein Tipp genügt. Über „Bearbeiten" entfernst du Zeilen oder leerst den Wagen.',
    {inset:false,action:{label:'Bearbeiten',tap:'cartEditToggle()'}});
  if(erledigt.length)h+=groupHTML('Erledigt · '+fmtNum(erledigt.length),erledigt.map(cartCheckRow),'',{inset:false});
  h+=`<button class="btn" onclick="cartAddManual()">${icon('plus',18)} Etwas hinzufügen</button>`;
  h+=groupHTML('',[rowHTML({icon:'download',title:'Aus dem Plan übernehmen',sub:'Die Mengen deines Plans für 7 Tage',tap:'cartFromPlan()'})],
    'Was schon im Wagen liegt, bleibt stehen – der Plan kommt dazu.');
  el.innerHTML=h;}
async function cartFromPlan(){const r=await API.post('/cart/from-plan',{});if(r.status===200){toast(pl(r.data.added||0,'Artikel','Artikel')+' aus dem Plan');drawCart();}else toast(r.data?.error||'Erst einen Ernährungsplan erstellen');}
function cartAddManual(){openSheet('Zum Einkaufswagen',`<div class="dt-sheet" id="cartForm"><div class="field"><label for="cart_text">Was brauchst du?</label><input id="cart_text" placeholder="z.B. 6 Eier, Olivenöl, Haferflocken" enterkeyhint="done" onkeydown="if(event.key==='Enter')cartSaveManual()"></div><button class="btn" onclick="cartSaveManual()">Hinzufügen</button>
  <p class="rows-f">Mehrere Dinge trennst du mit Komma – jedes wird eine eigene Zeile.</p></div>`);
  setTimeout(()=>document.getElementById('cart_text')?.focus(),60);}
async function cartSaveManual(){const t=val('cart_text');if(!t)return showFieldErr('cartForm','Bitte etwas eingeben','cart_text');const r=await API.post('/cart/add',{text:t,source:'manual'});if(r.status===200){closeModal();dietTab('cart');}else toast(r.data?.error||'Fehler');}
async function cartFromRecipe(id){const r=await API.post('/cart/from-recipe/'+id,{});if(r.status===200)toast(pl(r.data.added||0,'Zutat','Zutaten')+' im Einkaufswagen',{label:'Ansehen',fn:()=>{closeAllSheets();if(typeof closeAllPages==='function')closeAllPages();dietTab('cart');}});else toast(r.data?.error||'Fehler');}
// EIN Tap (R8): das Häkchen schaltet, die Zeile zeichnet sich neu. Kein Sheet dazwischen.
async function cartToggle(id){const r=await API.post('/cart/'+id+'/toggle',{});if(r.status!==200)toast(r.data?.error||'Fehler');drawCart();}
async function cartDelete(id){const cur=(await API.get('/cart')).data?.items?.find(i=>i.id===id);
  const r=await API.del('/cart/item/'+id);if(r.status!==200)return toast(r.data?.error||'Fehler');
  drawCart();
  if(cur)toast('Entfernt',{label:'Rückgängig',fn:async()=>{await API.post('/cart/add',{text:cur.text,source:cur.source||'manual'});drawCart();toast('Wiederhergestellt');}});}
async function cartClear(checkedOnly){const run=async()=>{const r=await API.post('/cart/clear',{checkedOnly});
    if(r.status!==200)toast(r.data?.error||'Fehler');else toast(checkedOnly?'Erledigte entfernt':'Einkaufswagen geleert');
    closeAllSheets();CART_EDIT=false;drawCart();};
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
    <button class="btn" onclick="lookupBarcode()">Produkt suchen</button>`);
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
    openSheet(per100.name,`<div class="dt-sheet">
      ${macroRows(per100.kcal,per100.protein,per100.carbs,per100.fat,null,'Pro 100 g','So steht es in der Datenbank Open Food Facts.')}
      <div id="bcForm"><div class="field"><label for="bc_amt">Wie viel hast du gegessen? (g)</label><input id="bc_amt" type="number" inputmode="decimal" min="0" max="3000" value="100"></div>
      <div class="chip-row wrap">${[50,100,150,200].map(v=>`<button class="chip${v===100?' on':''}" onclick="amtChip('bc_amt',${v},this)">${v} g</button>`).join('')}</div>
      ${slotSelect('bc_slot')}
      <button class="btn" onclick="logScannedProduct()">Eintragen</button>
      ${groupHTML('',[rowHTML({icon:'barcode',title:'Anderes Produkt scannen',tap:'openBarcodeScanner()'})],'')}</div></div>`);
  }catch(e){openSheet('Strichcode',`<div class="dt-sheet">${emptyState({icon:'devices',title:'Produktsuche fehlgeschlagen',
      text:'Die Lebensmittel-Datenbank war nicht erreichbar. Ohne Netz geht das Scannen nicht.'})}
      ${groupHTML('',[rowHTML({icon:'refresh',title:'Nochmal versuchen',tap:'openBarcodeScanner()'})],'')}</div>`);}}
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
  openSheet('Makro-Rechner',`<div class="dt-sheet">
    <div class="field lf-search"><label for="calc_search">Lebensmittel suchen</label><div class="lf-searchwrap">${icon('search',18)}<input id="calc_search" type="search" placeholder="z.B. Reis, Hähnchen…" oninput="filterCalcFoods(this.value)" autocomplete="off"></div></div>
    <div id="calc_list"></div>
    <div id="calc_sel" hidden>
    <h2 class="rows-h"><span id="calc_name"></span><button type="button" class="a" onclick="calcClear()">Anderes wählen</button></h2>
    <div class="field"><label id="calc_unit" for="calc_amt">Menge (g)</label><input id="calc_amt" type="number" inputmode="decimal" value="100" oninput="doCalc()"></div>
    <div id="calc_out"></div>
    ${slotSelect('calc_slot')}
    ${_dietSelf()?'<button class="btn" onclick="calcAddToLog()">Ins Protokoll eintragen</button>':''}</div>
    <p class="rows-f">Der Rechner zeigt nur – eingetragen wird erst mit dem Knopf. Er rechnet mit den Nährwerten je 100 g aus der Lebensmittel-Liste.</p></div>`);
  filterCalcFoods('');setTimeout(()=>document.getElementById('calc_search')?.focus(),60);}
function filterCalcFoods(q){const toks=dtToks(q);const el=document.getElementById('calc_list');if(!el)return;
  const seen=new Set();let list=[];FOODS.forEach((f,i)=>{const k=f.name.toLowerCase();if(seen.has(k))return;seen.add(k);if(dtHit(f.name,toks))list.push({f,i});});
  const rows=list.slice(0,toks.length?30:10).map(x=>rowHTML({title:x.f.name,sub:kcalUnitTxt(x.f),tap:'calcPick('+x.i+')'}));
  el.innerHTML=list.length?groupHTML(toks.length?pl(list.length,'Treffer','Treffer'):'Lebensmittel',rows,'',{inset:false})
    :emptyState({icon:'search',title:'Nichts gefunden',text:'Versuch einen anderen Begriff.'});}
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
  const out=document.getElementById('calc_out');
  if(out)out.innerHTML=macroRows(kc,prot,carb,fat,null,'Das kommt dabei heraus','');}
