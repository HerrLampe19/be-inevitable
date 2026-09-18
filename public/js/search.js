// BE INEVITABLE – Frontend, Teil «search.js» (2.3.0, Paket D: globale Suche). Klassische Skripte in
// fester Reihenfolge (siehe index.html); alle Funktionen sind global, wie zuvor in der einen app.js.
// Einstieg: openSearch() – die Lupe im Kopf. Ein Sheet, ein Feld, fünf Gruppen in fester Reihenfolge
// (Aktionen · Übungen · Rezepte · Lebensmittel · Mindset-Wissen), höchstens 8 Treffer je Gruppe.
// Drei Regeln, aus denen sich alles andere ergibt:
//  1. Beim Tippen wird NUR #gsBody neu geschrieben. Das Eingabefeld wird nie neu gebaut – sonst
//     verlöre es auf dem Handy Fokus, Cursor und Tastatur, und die Liste würde bei jedem Buchstaben
//     flackern. (Der Titel-gleich-Titel-Trick von openSheet würde zwar keinen Stapel aufbauen, aber
//     genau das Feld neu setzen – deshalb rufen wir openSheet hier nur EIN Mal auf.)
//  2. Fremde Öffner werden ausschließlich über typeof geprüft. Ein Ziel, das es (noch) nicht gibt oder
//     das im aktuellen Blick nicht erlaubt ist, erscheint gar nicht erst als Treffer – lieber ein
//     Treffer weniger als einer, der nichts tut.
//  3. Die Suche legt keine eigenen Daten an: sie liest PLAN (Übungen), FOODS und den Rezept-Cache aus
//     diet.js. Was fehlt, wird höchstens einmal je geöffnetem Sheet nachgeladen und landet in
//     openSearch.recipes/.foods – nie in fremden Zustandsvariablen. Die Fachbegriffe aus DEFS bekommen
//     keine eigene Gruppe; sie sind über die Aktion „Technik-Lexikon" erreichbar.

// ===== NORMALISIERUNG =====
// Kleinschreibung, und Umlaute samt ihrer Umschreibung auf denselben Nenner: ä/ae→a, ö/oe→o, ü/ue→u,
// ß→ss. Beides in dieselbe Richtung, deshalb finden „Maße", „Masse", „Müsli" und „Muesli" einander –
// genau die Tippfehler, die bei Umlauten auf dem Handy wirklich passieren. Alles Übrige (Bindestrich,
// Punkt, Klammer) wird zum Leerzeichen, damit „3-to-5" und „Rapport 7 · 38 · 55" in Wörter zerfallen.
function _searchNorm(s){return String(s??'').toLowerCase()
  .replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss')
  .replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u')
  .replace(/[^a-z0-9]+/g,' ').trim();}

// Rang eines Treffers: 0 = Suchwort steht am Anfang des Namens, 1 = am Anfang eines weiteren Wortes im
// Namen, 2 = am Wortanfang in den Synonymen, 3 = mitten im Namen. -1 = kein Treffer. Mehrere Suchwörter
// müssen alle vorkommen (UND), gewertet wird das beste davon.
// Zwei Feinheiten, die den Unterschied zwischen „findet nichts" und „findet das Richtige" machen:
//  · Rang 3 (Wortmitte) gibt es erst ab vier Buchstaben und nur im Namen. Ohne ihn fände „quark" das
//    „Magerquark" nie – deutsche Zusammensetzungen schreiben das gesuchte Wort nun mal hinten hin.
//    Mit der Längengrenze bleibt der Preis klein: „reis" zeigt „Preiselbeeren" erst hinter „Reis".
//  · Ein einzelner Buchstabe sucht nur im Namen, nicht in den Synonymen – sonst schwemmt „w" über
//    „waage/woche/wasser" die halbe App in die Liste.
function _searchRank(name,extra,terms){
  if(!terms.length)return 2;
  let best=9;
  for(let i=0;i<terms.length;i++){const t=terms[i];let r=-1;
    if(name.startsWith(t))r=0;
    else if((' '+name).indexOf(' '+t)>=0)r=1;
    else if(t.length>1&&(' '+extra).indexOf(' '+t)>=0)r=2;
    else if(t.length>3&&name.indexOf(t)>0)r=3;
    if(r<0)return -1;
    if(r<best)best=r;}
  return best;}
// Innerhalb einer Gruppe: bester Rang zuerst, dann der kürzere Name (er trifft die Absicht meist eher)
function _searchSort(a,b){return a.r-b.r||a.t.length-b.t.length||String(a.t).localeCompare(String(b.t),'de');}

// Wer darf dieses Ziel sehen? „any" = immer · „view" = auch im Coach-Blick auf einen Athleten ·
// „self" = nur im eigenen Konto. Ein Coach OHNE Athleten-Kontext (VIEW_USER === null) bekommt nichts
// davon, was VIEW_USER braucht – solche Ziele liefen sonst gegen /api/…/null.
function _searchAllow(av){
  if(av==='any')return true;
  if(typeof ME==='undefined'||!ME||VIEW_USER==null)return false;
  if(av==='view')return true;
  const cv=(typeof coachView==='function')&&coachView();
  return !cv&&VIEW_USER===ME.id;}
// Ist das Ziel überhaupt geladen? Wirft ok() (weil eine fremde Datei fehlt), gilt es als nicht erreichbar.
function _searchOk(a){try{return a.ok?!!a.ok():true;}catch(e){console.error('[suche]',e);return false;}}

// ===== AKTIONEN: die feste Liste der App-Funktionen =====
// t=Titel · g=Bereich · p=DER PFAD zum Ort (steht als Unterzeile, sonst g) · ic=Symbol aus ICONS ·
// s=weitere Suchwörter (Synonyme, bewusst ohne Umlaute – _searchNorm zieht beide Schreibweisen
// zusammen) · av=Sichtbarkeit (siehe _searchAllow) · top=Vorschlag bei leerem Feld · ok()=erreichbar? ·
// run()=hingehen.
//
// WARUM p: DESIGN-4 6.13/7.9 verlangen, dass jede Trefferzeile den WEG zeigt („Hantelrechner ·
// Training › Werkzeuge"), damit die Suche dem Nutzer den Ort BEIBRINGT, statt ihn zu ersetzen —
// „Die Suche bleibt die Abkürzung, nicht der Weg." Bis zur D-6-Fix-Runde stand hier nur `sub:a.g`,
// also „Training" ohne den Abschnitt: im Bild dz/pv/p18-suche.png stand unter „Hantelrechner"
// bloss „Training", und wer danach in den Reiter ging, suchte weiter.
// Die Pfade sind NICHT geraten, sondern am laufenden DOM abgelesen (scratchpad/d6fix-orte.mjs:
// jedes onclick-Ziel gegen die `.rows-h` seiner Gruppe). Wo kein Abschnitt gemessen wurde, steht
// weiterhin nur der Bereich — lieber eine kurze Wahrheit als ein erfundener Weg.
const SEARCH_ACTIONS=[
  // --- Start ---
  {t:'Check-in',g:'Start',p:'Start › Heute offen',ic:'check',av:'self',top:1,s:'gewicht schlaf schritte wasser eintragen tagesform waage taeglich',
   ok:()=>typeof openCheckinSheet==='function',run:()=>openCheckinSheet(today())},
  {t:'Mehrere Tage nachtragen',g:'Start',p:'Analyse › Einträge',ic:'copy',av:'self',s:'nachtragen rueckwirkend mehrere tage vergangenheit sammel checkin',
   ok:()=>typeof openBulkCheckin==='function',run:()=>openBulkCheckin()},
  {t:'Supplements',g:'Start',p:'Start › Heute offen',ic:'pill',av:'self',s:'nahrungsergaenzung kapseln vitamine kreatin einnahme haken',
   ok:()=>typeof openSupp==='function',run:()=>openSupp()},
  {t:'Bereitschaft',g:'Start',p:'Start › Jetzt-Karte',ic:'zap',av:'view',s:'readiness erholung frisch belastung hrv ruhepuls schlaf ampel form',
   ok:()=>typeof openReadiness==='function',run:()=>openReadiness()},
  // --- Training ---
  {t:'Kalender',g:'Training',p:'Training › Plan',ic:'calendar',av:'view',top:1,s:'kalender monat tage planen nachtragen trainingstage uebersicht',
   ok:()=>typeof openCalendar==='function',run:()=>openCalendar()},
  {t:'Trainingsrhythmus',g:'Training',p:'Training › Plan',ic:'refresh',av:'self',s:'rhythmus split folge trainingstage ruhetage muster wochenplan',
   ok:()=>typeof openRhythmus==='function',run:()=>openRhythmus()},
  {t:'Technik-Lexikon',g:'Training',p:'Training › Werkzeuge',ic:'info',av:'any',s:'technik lexikon begriffe erklaerung dropsatz rir tempo definition',
   ok:()=>typeof openDefs==='function',run:()=>openDefs()},
  {t:'Hantelrechner',g:'Training',p:'Training › Werkzeuge',ic:'dumbbell',av:'any',s:'hantel scheiben platten langhantel rechner gewicht kg beladen',
   ok:()=>typeof openPlateCalc==='function',run:()=>openPlateCalc()},
  {t:'Pausen-Timer',g:'Training',p:'Training › Werkzeuge',ic:'timer',av:'self',s:'pause timer stoppuhr satzpause uhr countdown pausenlaenge',
   ok:()=>typeof restPick==='function',run:()=>restPick()},
  {t:'Cardio',g:'Training',p:'Training › Cardio',ic:'heart',av:'self',s:'cardio ausdauer laufen joggen rad schwimmen hiit einheit erfassen',
   ok:()=>typeof openCardio==='function',run:()=>openCardio()},
  // --- Ernährung ---
  {t:'Essen hinzufügen',g:'Ernährung',p:'Ernährung › Tagebuch',ic:'plus',av:'self',top:1,s:'essen loggen protokoll mahlzeit eintragen lebensmittel kalorien',
   ok:()=>typeof openLogFood==='function',run:()=>openLogFood({focus:true})},
  {t:'Ernährungsplan',g:'Ernährung',p:'Ernährung › Plan',ic:'utensils',av:'view',s:'plan mahlzeiten essensplan tagesplan makros ziel',
   ok:()=>typeof renderDiet==='function',run:()=>{renderDiet.tab='plan';go('diet');}},
  {t:'Rezepte',g:'Ernährung',p:'Ernährung › Rezepte',ic:'fileSpreadsheet',av:'view',s:'rezepte kochen gerichte ideen mahlzeiten sammlung',
   ok:()=>typeof renderDiet==='function',run:()=>{renderDiet.tab='recipes';go('diet');}},
  {t:'Rezept anlegen',g:'Ernährung',p:'Ernährung › Rezepte',ic:'pencil',av:'any',s:'rezept anlegen neu eigenes erstellen kochen speichern',
   ok:()=>typeof openNewRecipe==='function',run:()=>openNewRecipe()},
  {t:'Einkaufswagen',g:'Ernährung',p:'Ernährung › Einkauf',ic:'cart',av:'self',s:'einkaufen einkaufsliste einkaufszettel supermarkt besorgen liste',
   ok:()=>typeof renderDiet==='function',run:()=>{renderDiet.tab='cart';go('diet');}},
  {t:'Barcode scannen',g:'Ernährung',p:'Ernährung › Essen eintragen',ic:'barcode',av:'self',s:'barcode strichcode scannen ean produkt kamera packung',
   ok:()=>typeof openBarcodeScanner==='function',run:()=>openBarcodeScanner()},
  {t:'Makro-Rechner',g:'Ernährung',p:'Ernährung › Plan ändern',ic:'flame',av:'any',s:'makro rechner kalorien naehrwerte eiweiss ausrechnen menge',
   ok:()=>typeof openCalc==='function',run:()=>openCalc()},
  {t:'Lebensmittel ausschließen',g:'Ernährung',p:'Ernährung › Plan ändern',ic:'filter',av:'self',s:'abneigung mag ich nicht ausschliessen unvertraeglich allergie',
   ok:()=>typeof openDislikes==='function',run:()=>openDislikes()},
  // --- Analyse ---
  // Suchwörter genau die Felder aus MEASURE_FIELDS (core.js:99) – „waage" stand hier falsch: Gewicht
  // wird im Check-in eingetragen, im Maß-Sheet gibt es kein Gewichtsfeld. Wegen des kurzen Titels stand
  // „Maße" bei „waage" sogar VOR dem Check-in und wäre mit der Eingabetaste das erste Ziel gewesen.
  {t:'Maße',g:'Analyse',p:'Analyse › Maße & Fotos',ic:'ruler',av:'view',top:1,s:'umfang taille brust arm bein huefte schultern nacken koerperfett messen zentimeter',
   ok:()=>typeof openMeasure==='function',run:()=>openMeasure()},
  {t:'Fotos',g:'Analyse',p:'Analyse › Maße & Fotos',ic:'camera',av:'view',s:'fotos bilder vorher nachher fortschritt pose kamera',
   ok:()=>typeof openPhotos==='function',run:()=>openPhotos()},
  {t:'Erfolge',g:'Analyse',p:'Analyse › Erfolge',ic:'trophy',av:'view',top:1,s:'erfolge abzeichen level xp auszeichnungen serie streak',
   ok:()=>typeof openAchievements==='function',run:()=>openAchievements()},
  {t:'Monatsziel',g:'Analyse',p:'Analyse › Erfolge',ic:'medal',av:'view',s:'monatsziel monat ziel vorgabe fortschritt auszeichnung',
   ok:()=>typeof openMonthlyGoal==='function',run:()=>openMonthlyGoal()},
  {t:'Gesundheitsdaten',g:'Analyse',p:'Analyse › Verbindungen',ic:'link',av:'self',s:'apple health uhr smartwatch verbinden import garmin fitbit schritte',
   ok:()=>typeof openIntegrations==='function',run:()=>openIntegrations()},
  // Der Rückblick steht im dritten Segment „Woche" (analysis.js: Knopf #an_w → anaTab('woche') →
  // drawAnaWeek), NICHT im Segment „Körper" – dort gibt es keine Wochenkarte. Geprüft wird deshalb
  // drawAnaWeek und nicht renderTracker: fehlt das Segment, fällt anaTab still auf „Körper" zurück und
  // der Treffer landete wieder daneben – dann lieber gar kein Treffer.
  {t:'Wochenrückblick',g:'Analyse',p:'Analyse › Woche',ic:'chartLine',av:'view',s:'woche wochenrueckblick rueckblick zusammenfassung bilanz sonntag deine woche',
   ok:()=>typeof drawAnaWeek==='function',run:()=>go('tracker','woche')},
  // --- Mindset ---
  {t:'Priming',g:'Mindset',p:'Mindset › Heute',ic:'sun',av:'self',top:1,s:'priming morgenritual morgen atmung dankbarkeit energie ritual',
   ok:()=>typeof openPriming==='function',run:()=>openPriming()},
  {t:'Rad des Lebens',g:'Mindset',p:'Mindset › Rad des Lebens',ic:'scale',av:'view',s:'rad leben balance lebensrad bereiche bewertung',
   ok:()=>typeof renderMindset==='function',run:()=>{renderMindset.tab='wheel';go('mindset');}},
  {t:'Wochencheck',g:'Mindset',p:'Mindset › Woche & Monat',ic:'star',av:'self',s:'wochencheck woche reflexion fragen auswertung sonntag',
   ok:()=>typeof openWeeklyCheck==='function',run:()=>openWeeklyCheck()},
  {t:'Challenge',g:'Mindset',p:'Mindset › Challenge',ic:'shield',av:'self',s:'challenge vital 10 tage 30 tage regeln durchziehen',
   ok:()=>typeof renderMindset==='function',run:()=>{renderMindset.tab='challenge';go('mindset');}},
  {t:'Wissen',g:'Mindset',p:'Mindset › Wissen',ic:'brain',av:'view',s:'wissen themen lexikon glaubenssaetze triade erfolgsformel rapport lernen',
   ok:()=>typeof renderMindset==='function',run:()=>{renderMindset.tab='wissen';go('mindset');}},
  // --- Profil ---
  {t:'Profil',g:'Profil',p:'Avatar in der Kopfzeile',ic:'user',av:'any',s:'profil konto einstellungen avatar name daten abmelden',
   ok:()=>typeof openProfile==='function',run:()=>openProfile()},
  // Zwei verschiedene Sheets, die auch der Profil-Hub getrennt anbietet (account.js:175/177): „Ziel &
  // Training" (Muskelaufbau/Definition, Erfahrung, Phase, Rhythmus) und „Persönliche Ziele" (Schlaf,
  // Schritte, Wasser). Bis 2.3.0 trug EIN Treffer beide Wortfelder und öffnete immer nur das zweite –
  // wer „Muskelaufbau" suchte, landete bei seinem Schlafziel.
  // Beide av:'self': der Hub blendet diese ganze Reihe für Coach und Admin bewusst aus (account.js:170).
  {t:'Ziel & Training',g:'Profil',p:'Profil › Training & Ernährung',ic:'target',av:'self',s:'ziel muskelaufbau definition gesundheit erfahrung anfaenger profi phase offseason prep trainingstage pro woche',
   ok:()=>typeof openGoalSheet==='function',run:()=>openGoalSheet()},
  {t:'Persönliche Ziele',g:'Profil',p:'Profil › Training & Ernährung',ic:'moon',av:'self',s:'ziele schlaf schritte wasser tagesziel vorgabe stunden liter',
   ok:()=>typeof openGoalsSheet==='function',run:()=>openGoalsSheet()},
  {t:'Benachrichtigungen',g:'Profil',p:'Profil › Erinnerungen',ic:'bell',av:'any',s:'benachrichtigungen push erinnerung mitteilungen uhrzeit ton erlauben',
   ok:()=>typeof openNotifSheet==='function',run:()=>openNotifSheet()},
  // Titel wie das Sheet selbst („Daten & Verbindungen" bzw. „Daten" für Coach/Admin, account.js:360).
  // „konto loeschen" stand hier als Suchwort, ohne dass es die Funktion irgendwo in der App gibt –
  // ein Treffer auf eine Suche, die nur ins Leere führen kann, ist schlimmer als gar keiner.
  {t:'Daten & Export',g:'Profil',p:'Profil › Deine Daten',ic:'download',av:'any',s:'export daten herunterladen sicherung datei dsgvo installieren app',
   // Seit Welle 5 gibt es kein Daten-Sheet mehr: "Deine Daten" ist ein ABSCHNITT der Profilseite
   // (account.js/openDataSheet ist nur noch eine Huelle um acProfileOpen({focus:'daten'})). Der Treffer
   // nennt deshalb den Weg, den es wirklich gibt - Avatar -> Profil, dann der Abschnitt. Dasselbe Ziel,
   // aber ohne einen Funktionsnamen, hinter dem in der ganzen App kein einziger Knopf mehr steht (K14).
   ok:()=>typeof openProfile==='function',run:()=>openProfile({focus:'daten'})},
  {t:'Nachrichten',g:'Profil',p:'Glocke in der Kopfzeile',ic:'mail',av:'any',s:'nachrichten coach postfach glocke schreiben antwort',
   ok:()=>typeof openMessages==='function',run:()=>openMessages()},
  {t:'Hilfe',g:'Profil',p:'Profil › Hilfe',ic:'help',av:'any',s:'hilfe faq anleitung support fragen tour erklaerung',
   ok:()=>typeof openProfile==='function',run:()=>openProfile({focus:'hilfe'})}
];

// Die zwölf Wissens-Themen aus openKnow() (public/mindset.js): Schlüssel, Titel ohne das führende Emoji
// des Sheets, Suchwörter. w=persönliches Arbeitsblatt – die zeigt mindset.js nur dem Athleten selbst,
// deshalb tauchen sie für Fremde hier gar nicht erst auf (ein Treffer, der nur einen Hinweis-Toast
// auslöst, wäre eine Sackgasse).
const SEARCH_KNOW=[
  {k:'priming',t:'Priming',s:'morgenritual morgen atmung dankbarkeit energie zustand ritual'},
  {k:'needs',t:'Die 6 Grundbedürfnisse',s:'beduerfnisse antrieb sicherheit abwechslung bedeutung liebe wachstum beitrag'},
  {k:'triad',t:'Die Triade des Zustands',s:'triade zustand koerper fokus sprache haltung 90 sekunden'},
  {k:'formula',t:'Die Erfolgsformel',s:'erfolg formel ziele handeln anpassen fuenf schritte'},
  {k:'beliefs',t:'Glaubenssätze',s:'glauben ueberzeugung dickens muster grenzen',w:1},
  {k:'incantation',t:'Deine Incantation',s:'incantation kraftsaetze affirmation mantra sprechen',w:1},
  {k:'rapport',t:'Rapport 7 · 38 · 55',s:'rapport verbindung kommunikation koerpersprache stimme worte'},
  {k:'principles',t:'10 Meisterprinzipien',s:'prinzipien meister vital geschenke gifte gesundheit basis'},
  {k:'wheel',t:'Rad des Lebens',s:'rad leben balance bereiche lebensrad'},
  {k:'thrive',t:'3-to-5 to Thrive',s:'thrive entscheidungen schritte sofort massnahme',w:1},
  {k:'passion',t:'Leidenschaft & Vision',s:'leidenschaft vision traum zukunft wollen lieben',w:1},
  {k:'home',t:'Emotionales Zuhause',s:'emotionales zuhause gefuehle emotionen gewohnheit umziehen'}
];

let SEARCH_Q='';   // aktuelle Eingabe (der Sheet-Stapel darf sie überleben)

// ===== DATENQUELLEN =====
// Rezepte: erst die 60-s-Caches aus diet.js, dann unser eigener Nachlader. RECIPES_CACHE hält nur die
// zuletzt gezeichnete Teilmenge – deshalb steht sie hinten.
function _searchRecipeList(){
  try{if(typeof RC_ALL!=='undefined'&&RC_ALL&&Array.isArray(RC_ALL.recipes)&&RC_ALL.recipes.length)return RC_ALL.recipes;}catch(e){}
  if(Array.isArray(openSearch.recipes)&&openSearch.recipes.length)return openSearch.recipes;
  try{if(typeof RECIPES_CACHE!=='undefined'&&Array.isArray(RECIPES_CACHE)&&RECIPES_CACHE.length)return RECIPES_CACHE;}catch(e){}
  return [];}
// Lebensmittel: FOODS füllt core.js beim Start ohne await – direkt danach ist die Liste oft noch leer.
function _searchFoodList(){
  try{if(typeof FOODS!=='undefined'&&Array.isArray(FOODS)&&FOODS.length)return FOODS;}catch(e){}
  return Array.isArray(openSearch.foods)?openSearch.foods:[];}

// ===== TREFFER SAMMELN =====
// Liefert [{title,hits:[{ic,t,sub,run}]}] in der festen Reihenfolge Aktionen → Übungen → Rezepte →
// Lebensmittel → Wissen. Leere Gruppen kommen gar nicht erst vor.
function _searchGroups(q){
  const terms=_searchNorm(q).split(' ').filter(Boolean);
  const out=[];
  const acts=SEARCH_ACTIONS.filter(a=>_searchAllow(a.av)&&_searchOk(a));
  // Leeres Feld: sechs sinnvolle Einstiege statt einer leeren Fläche (die als „top" markierten zuerst,
  // aufgefüllt in Listenreihenfolge – so bleiben es auch im Coach-Blick sechs).
  if(!terms.length){
    const sug=acts.filter(a=>a.top).concat(acts.filter(a=>!a.top)).slice(0,6)
      .map(a=>({ic:a.ic,t:a.t,sub:a.p||a.g,run:a.run}));
    if(sug.length)out.push({title:'Vorschläge',hits:sug,gesamt:sug.length});
    return out;}
  // 1 Aktionen
  const hitsA=[];
  acts.forEach(a=>{const n=a._n||(a._n=_searchNorm(a.t)),x=a._x||(a._x=_searchNorm(a.t+' '+a.g+' '+(a.s||'')));
    const r=_searchRank(n,x,terms);if(r>=0)hitsA.push({ic:a.ic,t:a.t,sub:a.p||a.g,run:a.run,r});});
  if(hitsA.length)out.push({title:'Aktionen',hits:hitsA.sort(_searchSort).slice(0,8),gesamt:hitsA.length});
  // 2 Übungen aus dem aktiven Plan (gelöschte liefert der Server gar nicht erst mit)
  const hitsE=[];
  if(typeof go==='function')(PLAN?.days||[]).forEach(d=>(d.exercises||[]).forEach(e=>{
    if(!e||!e.name)return;
    const r=_searchRank(_searchNorm(e.name),_searchNorm([e.name,e.muscle,e.technique,d.name].join(' ')),terms);
    if(r<0)return;
    hitsE.push({ic:'dumbbell',t:e.name,sub:[d.name,e.muscle].filter(Boolean).join(' · '),r,run:()=>_searchOpenEx(d.id,e.id)});}));
  if(hitsE.length)out.push({title:'Übungen',hits:hitsE.sort(_searchSort).slice(0,8),gesamt:hitsE.length});
  // 3 Rezepte
  const hitsR=[];
  if(typeof openRecipe==='function')_searchRecipeList().forEach(rc=>{
    if(!rc||!rc.name)return;
    const r=_searchRank(_searchNorm(rc.name),_searchNorm([rc.name,rc.category,rc.meal_type].join(' ')),terms);
    if(r<0)return;
    const sub=[rc.kcal?fmtNum(rc.kcal)+' kcal':'',rc.category||''].filter(Boolean).join(' · ');
    hitsR.push({ic:'utensils',t:rc.name,sub,r,run:()=>openRecipe(rc.id)});});
  if(hitsR.length)out.push({title:'Rezepte',hits:hitsR.sort(_searchSort).slice(0,8),gesamt:hitsR.length});
  // 4 Lebensmittel – nur im eigenen Konto: ins Protokoll schreibt allein der Athlet selbst.
  // FOODS enthält Dubletten nach Namen (eigene + globale), deshalb wird nach Kleinschreibung entdoppelt.
  const hitsF=[];
  if(_searchAllow('self')&&typeof openLogFood==='function'){const seen=new Set();
    _searchFoodList().forEach(f=>{const k=String(f?.name||'').toLowerCase();if(!k||seen.has(k))return;seen.add(k);
      const r=_searchRank(_searchNorm(f.name),_searchNorm(f.name),terms);if(r<0)return;
      let sub='Lebensmittel';try{if(typeof kcalUnitTxt==='function')sub=kcalUnitTxt(f);}catch(e){}
      hitsF.push({ic:'apple',t:f.name,sub,r,run:()=>_searchOpenFood(f.name)});});}
  if(hitsF.length)out.push({title:'Lebensmittel',hits:hitsF.sort(_searchSort).slice(0,8),gesamt:hitsF.length});
  // 5 Mindset-Wissen
  const hitsK=[];
  const own=(typeof mindOwn==='function')?mindOwn():_searchAllow('self');
  if(typeof openKnow==='function')SEARCH_KNOW.forEach(w=>{
    if(w.w&&!own)return;
    const r=_searchRank(_searchNorm(w.t),_searchNorm(w.t+' mindset wissen '+(w.s||'')),terms);if(r<0)return;
    hitsK.push({ic:'brain',t:w.t,sub:'Mindset · Wissen',r,run:()=>openKnow(w.k)});});
  if(hitsK.length)out.push({title:'Mindset-Wissen',hits:hitsK.sort(_searchSort).slice(0,8),gesamt:hitsK.length});
  return out;}

// ===== ZEICHNEN =====
// Schreibt AUSSCHLIESSLICH #gsBody neu – das Feld darüber bleibt unangetastet (Fokus, Cursor, Tastatur).
function runSearch(q){
  SEARCH_Q=String(q??'');
  const body=document.getElementById('gsBody');if(!body)return;
  // Der Sheet-Stapel legt den Inhalt beim Öffnen einer Ebene darüber als HTML-Schnappschuss ab. Ein
  // getippter Wert steht nur in der value-Eigenschaft, nicht im Attribut – ohne diese Zeile käme man
  // aus einem Treffer-Sheet mit leerem Feld, aber voller Trefferliste zurück.
  const inp=document.getElementById('gsInput');if(inp)try{inp.setAttribute('value',SEARCH_Q);}catch(e){}
  let groups=[];try{groups=_searchGroups(SEARCH_Q);}catch(e){console.error('[suche]',e);}
  const hits=[];let h='';
  // DIE EINE ZEILE, AUS DEM EINEN HELFER (DESIGN-4 Teil 4, K6/9.3 Zielwert 0 handgeschriebene
  // Zeilen). Bis zur D-6-Fix-Runde baute diese Schleife `<div class="row tap gs-hit">` samt `.r-ic`,
  // `.rl`, `.rr` von Hand – mit einem 22-px-Symbol statt 24 und einer leeren `.rr`, die nur da war,
  // damit die Legacy-Regel in app.css ein Chevron nachzieht. Jetzt kommt die Zeile aus rowHTML() und
  // die Gruppe aus groupHTML(): dieselbe Zeile wie im Profil, im Training, in der Ernährung.
  // Die Überschrift ist damit `.rows-h` (17/700, gemischt) statt `.section-label` (12 px VERSALIEN) –
  // genau dort, wohin man geht, WEIL man etwas nicht findet, stand bis eben eine zweite Designsprache.
  // Die Trefferzahl stand rechts in der Versal-Zeile; sie wandert in den Fußtext, und zwar nur dort,
  // wo sie etwas sagt: wenn mehr da ist als die acht gezeigten (G5 – ein stiller Deckel versteckt).
  groups.forEach(g=>{
    if(!g.hits.length)return;
    const zeilen=g.hits.map(it=>{const i=hits.length;hits.push(it);
      return rowHTML({icon:it.ic||'chevronRight',title:it.t,sub:it.sub,tap:'searchHit('+i+')'});});
    const mehr=(g.gesamt||g.hits.length)-g.hits.length;
    const fuss=mehr>0?`Die ${fmtNum(g.hits.length)} besten von ${fmtNum(g.gesamt)} Treffern. Tippe genauer, wenn deiner nicht dabei ist.`:null;
    h+=groupHTML(g.title,zeilen,fuss).replace('<div class="rows','<div class="rows gs-rows');});
  openSearch.hits=hits;
  if(!h)h=emptyState({icon:'search',title:'Nichts gefunden',text:'Probier ein anderes Wort – zum Beispiel „Maße", „Cardio", „Rezepte" oder „Priming".'});
  body.innerHTML=h;}

// Nachgeladene Daten still nachziehen – nur wenn dasselbe Such-Sheet noch offen ist (Token) und das
// Feld noch existiert. Der Nutzer merkt davon nichts außer neuen Zeilen.
function _searchRepaint(tok){if(tok!==openSearch.tok)return;if(!document.getElementById('gsBody'))return;runSearch(SEARCH_Q);}

// Plan, Rezepte und Lebensmittel liegen nicht immer im Speicher: wer nur auf der Startseite war, hat
// keinen PLAN, und FOODS füllt core.js ohne await. Einmal je geöffnetem Sheet nachladen, Fremdzustand
// dabei nicht anfassen (eigene Ablage in openSearch.recipes/.foods).
function _searchPrefetch(){const tok=openSearch.tok;
  try{if(!PLAN&&VIEW_USER!=null&&typeof loadPlan==='function'){const p=loadPlan();
    if(p&&typeof p.then==='function')p.then(()=>_searchRepaint(tok)).catch(e=>console.error('[suche]',e));}}catch(e){console.error('[suche]',e);}
  try{if(!_searchRecipeList().length)API.get('/recipes').then(r=>{
    if(r.status===200)openSearch.recipes=r.data?.recipes||[];_searchRepaint(tok);}).catch(e=>console.error('[suche]',e));}catch(e){console.error('[suche]',e);}
  try{if(!_searchFoodList().length)API.get('/foods').then(r=>{
    if(r.status===200)openSearch.foods=r.data?.foods||[];_searchRepaint(tok);}).catch(e=>console.error('[suche]',e));}catch(e){console.error('[suche]',e);}}

// ===== ÖFFNEN =====
function openSearch(){
  if(typeof ME==='undefined'||!ME||typeof openSheet!=='function')return;
  SEARCH_Q='';openSearch.hits=[];openSearch.tok=(openSearch.tok||0)+1;
  openSheet('Suche',`<div class="field gs-search"><div class="gs-wrap">${icon('search',18)}<input id="gsInput" type="search" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="In der App suchen" placeholder="Übung, Rezept, Funktion…" oninput="runSearch(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();searchHit(0);}"></div></div>
    <div id="gsBody"></div>`,{size:'tall'});
  runSearch('');
  _searchPrefetch();
  // Tastatur gleich mit öffnen – die Suche ist ein Feld, kein Menü. Erst nach der Sheet-Animation,
  // sonst schiebt iOS das halb offene Sheet aus dem Bild.
  setTimeout(()=>{const el=document.getElementById('gsInput');if(el)try{el.focus({preventScroll:true});}catch(e){try{el.focus();}catch(x){}}},140);}

// Treffer öffnen (auch per Eingabetaste: searchHit(0) = der oberste Treffer)
function searchHit(i){const h=(openSearch.hits||[])[i];if(!h||typeof h.run!=='function')return;
  try{h.run();}catch(e){console.error('[suche]',e);toast('Das ließ sich gerade nicht öffnen');}}

// ===== SPRUNGZIELE, DIE MEHR ALS EINEN SCHRITT BRAUCHEN =====
// Auf ein Element warten, das erst nach einem Netz-Aufruf entsteht (Plan laden, Übungen zeichnen).
// Höchstens ~2,5 s – danach lieber nichts tun als endlos pollen.
function _searchWait(id,cb,n){n=(n==null)?42:n;
  const el=document.getElementById(id);
  if(el){try{cb(el);}catch(e){console.error('[suche]',e);}return;}
  if(n<=0)return;
  setTimeout(()=>_searchWait(id,cb,n-1),60);}
// Kurz aufleuchten lassen, damit man die gesuchte Zeile in einer langen Liste sofort sieht
function _searchFlash(el){try{el.classList.add('gs-flash');setTimeout(()=>el.classList.remove('gs-flash'),1700);}catch(e){}}
// Übung: Trainings-Tab öffnen, auf den richtigen Tag wechseln, Karte aufklappen und hervorheben.
// go() schließt das Such-Sheet selbst. Heikel ist die Reihenfolge: renderWorkout lädt asynchron und
// wählt dabei SELBST einen Tag – ein zu früh gesetztes CUR_DAY wird dort wieder überschrieben. Deshalb
// wird der Tag so lange nachgesetzt, bis Tag und Karte zusammenpassen, und nach einer Pause noch einmal
// nachgefasst, falls ein spät zurückkommender Ladevorgang die Liste neu aufgebaut hat. Gehandelt wird
// nur, wenn die Karte eine ANDERE ist als beim letzten Mal – sonst blinkt sie zweimal.
function _searchOpenEx(dayId,exId){
  if(typeof go!=='function')return;
  try{if(typeof renderWorkout==='function')renderWorkout.tab='strength';go('workout');}catch(e){console.error('[suche]',e);return;}
  let n=30,again=1,last=null;
  const act=el=>{last=el;
    // Seit DESIGN-4 6.3 ist die Uebung eine eigene SEITE, kein Aufklapper mehr: der Sprung fuehrt
    // hinein statt daneben. Der alte Zweig rief `toggleEx` auf einer Karte `.ex` – beides gibt es
    // nicht mehr, der Aufruf war tot (static_check.py: „REMOVED BUT STILL CALLED"). Der Rueckfall
    // bleibt fuer den Fall, dass das Trainings-Modul die Seite (noch) nicht anbietet.
    if(typeof pushExercise==='function'){pushExercise(exId);return;}
    try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}
    _searchFlash(el);};
  const tick=()=>{
    if(document.getElementById('exlist')){
      if(typeof CUR_DAY!=='undefined'&&CUR_DAY!==dayId&&typeof selDay==='function'){try{selDay(dayId);}catch(e){console.error('[suche]',e);}}
      const el=document.getElementById('ex-'+exId);
      if(el&&(typeof CUR_DAY==='undefined'||CUR_DAY===dayId)){
        if(el!==last)act(el);
        if(again){again=0;n=10;setTimeout(tick,700);}
        return;}}
    if(n-->0)setTimeout(tick,80);};
  tick();}
// Lebensmittel: „Essen hinzufügen" öffnen und die Suche dort vorbelegen. Der Fokus wandert mit, damit
// man die Menge sofort tippen kann; das Sheet baut seine Liste erst nach dem /foods-Abruf auf.
function _searchOpenFood(name){
  try{
    if(typeof openLogFood!=='function')return;
    openLogFood({focus:false});
    _searchWait('lf_search',el=>{
      el.value=name;
      if(typeof lfFilter==='function')lfFilter();
      try{el.focus({preventScroll:true});}catch(e){}
      try{el.setSelectionRange(name.length,name.length);}catch(e){}});
  }catch(e){console.error('[suche]',e);}}
