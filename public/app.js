// ===== GLOBALE FEHLERBEHANDLUNG =====
// Fängt unerwartete Fehler ab, damit die App nie still einfriert.
window.addEventListener('error',e=>{console.error('[App-Fehler]',e.error||e.message);
  if(typeof toast==='function')toast('Etwas ist schiefgelaufen – bitte erneut versuchen.');});
window.addEventListener('unhandledrejection',e=>{console.error('[App-Fehler/Promise]',e.reason);});

// ===== API =====
const API={async req(m,p,b){try{const o={method:m,headers:{},credentials:'same-origin'};if(b){o.headers['Content-Type']='application/json';o.body=JSON.stringify(b);}const r=await fetch('/api'+p,o);let d=null;try{d=await r.json();}catch{}return{status:r.status,data:d};}catch(err){console.error('[Netzwerkfehler]',p,err);return{status:0,data:{error:'Keine Verbindung. Ist der Server erreichbar?'}};}},get(p){return this.req('GET',p);},post(p,b){return this.req('POST',p,b);},put(p,b){return this.req('PUT',p,b);},del(p,b){return this.req('DELETE',p,b);}};

// ===== STATE =====
let ME=null,VIEW_USER=null,PLAN=null,CUR_DAY=null,DIET='training',FOODS=[],DEFS=[],authMode='login';
let TODAY=null,UNREAD=0;
const today=()=>new Date().toISOString().slice(0,10);

// ===== AUTH =====
function toggleAuth(){authMode=authMode==='login'?'register':'login';const reg=authMode==='register';
  document.getElementById('regName').classList.toggle('hidden',!reg);
  document.getElementById('authBtn').textContent=reg?'Konto erstellen':'Anmelden';
  document.getElementById('switchLink').innerHTML=reg?'Schon ein Konto? <a onclick="toggleAuth()">Anmelden</a>':'Noch kein Konto? <a onclick="toggleAuth()">Registrieren</a>';
  document.getElementById('authErr').classList.add('hidden');}
async function doAuth(){const email=val('i_email'),pw=val('i_pw');document.getElementById('authErr').classList.add('hidden');
  if(!email||!pw)return showErr('Bitte E-Mail und Passwort eingeben.');
  const btn=document.getElementById('authBtn');btn.disabled=true;let res;
  if(authMode==='register'){const name=val('i_name');if(!name){btn.disabled=false;return showErr('Bitte Namen eingeben.');}
    res=await API.post('/register',{email,password:pw,name});}
  else res=await API.post('/login',{email,password:pw});
  btn.disabled=false;
  if(res.status===200){ME=res.data.user;
    // Neuer Athlet ohne Profildaten -> Onboarding; sonst normale App
    if(authMode==='register'&&ME.role==='athlete')startOnboarding();
    else startApp();
  }else showErr(res.data?.error||'Fehler.');}
function showErr(m){const e=document.getElementById('authErr');e.textContent=m;e.classList.remove('hidden');}
async function logout(){await API.post('/logout');location.reload();}

// ===== ONBOARDING WIZARD =====
let ONB={step:0,data:{experience:'beginner',days_per_week:3}};
function startOnboarding(){ONB={step:0,data:{experience:'beginner',days_per_week:3,gender:'male'}};
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('onbView').classList.remove('hidden');
  renderOnb();}
const ONB_STEPS=[
  {key:'welcome'},
  {key:'goal'},{key:'experience'},{key:'body'},{key:'frequency'},{key:'result'}
];
function onbSet(k,v){ONB.data[k]=v;onbNext();}
function onbNext(){if(ONB.step<ONB_STEPS.length-1){ONB.step++;renderOnb();}}
function onbBack(){if(ONB.step>0){ONB.step--;renderOnb();}}
function bigChoice(k,v,emoji,title,desc,cur){return `<button class="card" style="display:block;width:100%;text-align:left;margin-bottom:12px;border:2px solid ${cur===v?'var(--red)':'transparent'}" onclick="onbSet('${k}','${v}')">
  <div style="font-size:28px">${emoji}</div><div style="font-weight:700;font-size:18px;margin-top:6px">${title}</div><div style="color:var(--ink2);font-size:14px;margin-top:2px">${desc}</div></button>`;}

async function renderOnb(){const v=document.getElementById('onbView');const s=ONB_STEPS[ONB.step];const d=ONB.data;
  const prog=`<div style="display:flex;gap:6px;margin-bottom:24px">${ONB_STEPS.map((_,i)=>`<div style="flex:1;height:4px;border-radius:2px;background:${i<=ONB.step?'var(--red)':'var(--line)'}"></div>`).join('')}</div>`;
  const backBtn=ONB.step>0&&s.key!=='result'?`<button class="btn sec" style="margin-top:8px" onclick="onbBack()">Zurück</button>`:'';
  let h=`<div style="padding-top:20px">${prog}`;
  if(s.key==='welcome'){
    h+=`<div style="text-align:center"><div style="font-size:48px">💪</div>
      <h1 style="font-size:28px;font-weight:700;margin:16px 0 8px">Willkommen, ${ME.name.split(' ')[0]}!</h1>
      <p style="color:var(--ink2);font-size:16px;line-height:1.5;margin-bottom:28px">In 4 kurzen Schritten erstellen wir deinen persönlichen Trainings- und Ernährungsplan. Dauert keine Minute.</p>
      <button class="btn" onclick="onbNext()">Los geht's</button></div>`;
  } else if(s.key==='goal'){
    h+=`<h2 style="font-size:24px;font-weight:700;margin-bottom:6px">Was ist dein Ziel?</h2><p style="color:var(--ink2);margin-bottom:20px">Danach richten wir alles aus.</p>`;
    h+=bigChoice('goal','muscle','🏋️','Muskeln aufbauen','Masse &amp; Kraft, leichter Kalorienüberschuss',d.goal);
    h+=bigChoice('goal','fatloss','🔥','Abnehmen / definieren','Fett verlieren, Muskeln erhalten',d.goal);
    h+=bigChoice('goal','health','❤️','Fit &amp; gesund werden','Allgemeine Fitness, Gewicht halten',d.goal);
  } else if(s.key==='experience'){
    h+=`<h2 style="font-size:24px;font-weight:700;margin-bottom:6px">Wie viel Erfahrung hast du?</h2><p style="color:var(--ink2);margin-bottom:20px">Das bestimmt, wie ausführlich die App dich begleitet.</p>`;
    h+=bigChoice('experience','beginner','🌱','Anfänger','Neu im Training oder Wiedereinstieg',d.experience);
    h+=bigChoice('experience','intermediate','📈','Fortgeschritten','Trainiere seit Monaten regelmäßig',d.experience);
    h+=bigChoice('experience','advanced','🏆','Profi','Erfahren, will alle Details &amp; Kontrolle',d.experience);
  } else if(s.key==='body'){
    h+=`<h2 style="font-size:24px;font-weight:700;margin-bottom:6px">Ein paar Eckdaten</h2><p style="color:var(--ink2);margin-bottom:20px">Für die Berechnung deiner Kalorien.</p>
      <div class="seg" style="margin-bottom:14px"><button id="g_m" class="${d.gender!=='female'?'on':''}" onclick="ONB.data.gender='male';renderOnb()">Mann</button><button id="g_f" class="${d.gender==='female'?'on':''}" onclick="ONB.data.gender='female';renderOnb()">Frau</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Alter</label><input id="o_age" type="number" inputmode="numeric" value="${d.age||''}" placeholder="28"></div>
        <div class="field"><label>Größe (cm)</label><input id="o_h" type="number" inputmode="numeric" value="${d.height_cm||''}" placeholder="180"></div>
      </div>
      <div class="field"><label>Aktuelles Gewicht (kg)</label><input id="o_w" type="number" step="0.1" inputmode="decimal" value="${d.start_weight||''}" placeholder="80"></div>
      <button class="btn" onclick="onbBody()">Weiter</button>`;
  } else if(s.key==='frequency'){
    h+=`<h2 style="font-size:24px;font-weight:700;margin-bottom:6px">Wie oft willst du trainieren?</h2><p style="color:var(--ink2);margin-bottom:20px">Pro Woche – ehrlich sein bringt die besten Ergebnisse.</p>
      <div style="text-align:center;margin-bottom:8px"><span style="font-size:52px;font-weight:700;color:var(--red)">${d.days_per_week}</span><span style="font-size:20px;color:var(--ink2)"> ×/Woche</span></div>
      <input type="range" min="1" max="6" value="${d.days_per_week}" style="width:100%;margin-bottom:8px" oninput="ONB.data.days_per_week=+this.value;renderOnb()">
      <p style="text-align:center;color:var(--ink2);font-size:14px;margin-bottom:24px">${freqHint(d.days_per_week)}</p>
      <button class="btn" onclick="onbNext()">Plan erstellen</button>`;
  } else if(s.key==='result'){
    h+=`<div id="onbResult" style="text-align:center"><div class="spinner"></div><p style="color:var(--ink2)">Wir berechnen deinen Plan…</p></div>`;
    v.innerHTML=h+'</div>';loadOnbResult();return;
  }
  h+=backBtn+'</div>';v.innerHTML=h;}
function freqHint(n){return {1:'Ganzkörper – besser als nichts!',2:'2× Ganzkörper – solider Einstieg.',3:'Push/Pull/Beine – sehr effektiv.',4:'Ober-/Unterkörper-Split – top für Aufbau.',5:'5er-Split – für Ambitionierte.',6:'6× – nur mit guter Erholung.'}[n]||'';}
function onbBody(){const age=+val('o_age'),h=+val('o_h'),w=+val('o_w');
  if(!age||!h||!w)return toast('Bitte alle Felder ausfüllen');
  if(age<14||age>100)return toast('Bitte ein realistisches Alter');
  ONB.data.age=age;ONB.data.height_cm=h;ONB.data.start_weight=w;onbNext();}
async function loadOnbResult(){const r=await API.post('/onboarding/preview',ONB.data);
  if(r.status!==200){document.getElementById('onbResult').innerHTML='<p>Fehler. Bitte zurück und erneut.</p>';return;}
  const p=r.data;const n=p.nutrition;
  const goalTxt={muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'}[ONB.data.goal];
  document.getElementById('onbResult').innerHTML=`
    <div style="font-size:40px">✅</div>
    <h2 style="font-size:24px;font-weight:700;margin:12px 0 6px">Dein Plan steht!</h2>
    <p style="color:var(--ink2);margin-bottom:22px">Ziel: ${goalTxt}${p.bmi?' · BMI '+p.bmi:''}</p>
    <div class="surface pad" style="text-align:left;margin-bottom:14px">
      <div style="font-weight:600;margin-bottom:10px">🍽️ Deine Kalorienziele</div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line)"><span style="color:var(--ink2)">Trainingstag</span><b>${n.trainKcal} kcal</b></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line)"><span style="color:var(--ink2)">Ruhetag</span><b>${n.restKcal} kcal</b></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--ink2)">Protein / Carbs / Fett</span><b>${n.macros.protein} / ${n.macros.carbs} / ${n.macros.fat} g</b></div>
    </div>
    <div class="surface pad" style="text-align:left;margin-bottom:20px">
      <div style="font-weight:600;margin-bottom:10px">🏋️ Dein Trainingsplan (${p.plan.length} Tage)</div>
      ${p.plan.map(d=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line)"><span>${d.name}</span><span style="color:var(--ink2);font-size:13px">${d.exercises.length} Übungen</span></div>`).join('')}
    </div>
    <button class="btn" onclick="finishOnboarding()">Loslegen</button>
    <button class="btn sec" style="margin-top:8px" onclick="onbBack()">Etwas ändern</button>`;}
async function finishOnboarding(){const r=await API.post('/onboarding/complete',ONB.data);
  if(r.status!==200)return toast('Fehler beim Speichern');
  // ME aktualisieren
  const me=await API.get('/me');ME=me.data.user;
  document.getElementById('onbView').classList.add('hidden');
  startApp();toast('Willkommen an Bord! 🎉');}

// ===== START =====
async function startApp(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.body.classList.add('has-nav');
  document.getElementById('avatar').textContent=(ME.name||'?').charAt(0).toUpperCase();
  API.get('/foods').then(r=>FOODS=r.data?.foods||[]);
  fetch('/api/definitions').then(r=>r.json()).then(d=>DEFS=d.definitions||[]);
  COACH_CONTEXT=null;
  await loadMessages();
  startMsgPolling();
  buildNav();
  if(ME.role==='admin'){go('admin');}
  else if(ME.role==='coach'){VIEW_USER=null;go('athletes');}
  else{VIEW_USER=ME.id;await loadPlan();go('home');}
}
// Wenn ein Coach gerade einen Athleten "betreten" hat, steht hier dessen Name
let COACH_CONTEXT=null;
let VIEW_USER_PROFILE=null; // Profil des aktuell betrachteten Nutzers (für Coach-Kontext)
function buildNav(){const nav=document.getElementById('navBar');
  let items;
  if(ME.role==='admin'){
    // Admin: AUSSCHLIESSLICH Verwaltung (kein Training/Ernährung/Coaching)
    items=[['admin','🛡️','Verwaltung'],['more','•••','Mehr']];
  } else if(ME.role==='coach'&&COACH_CONTEXT){
    // Coach hat einen Athleten betreten: dessen Daten ansehen + zurück
    items=[['athletes','‹','Zurück'],['home','◎','Übersicht'],['workout','🏋️','Plan'],['diet','🍽️','Ernährung'],['tracker','📈','Verlauf']];
  } else if(ME.role==='coach'){
    // Coach-Grundansicht: nur Athletenverwaltung + Mehr
    items=[['athletes','📊','Übersicht'],['more','•••','Mehr']];
  } else {
    items=[['home','◎','Heute'],['workout','🏋️','Training'],['diet','🍽️','Ernährung'],['tracker','📈','Verlauf'],['more','•••','Mehr']];
  }
  nav.innerHTML=items.map(([p,i,l])=>`<button class="navbtn" data-p="${p}" onclick="go('${p}')"><div class="ni">${i}</div><div class="nl">${l}</div></button>`).join('');}

// ===== ROUTER =====
const TITLES={home:'Heute',workout:'Training',diet:'Ernährung',tracker:'Verlauf',more:'Mehr',athletes:'Übersicht',admin:'Verwaltung'};
function go(p){
  // Coach/Admin verlässt den Athleten-Kontext, wenn er auf "Zurück/Athleten" tippt
  if(p==='athletes'&&(ME.role==='coach'||ME.role==='admin')&&COACH_CONTEXT){COACH_CONTEXT=null;VIEW_USER=null;PLAN=null;TODAY=null;buildNav();}
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
  document.getElementById('hdrTitle').textContent=(COACH_CONTEXT?COACH_CONTEXT+' · ':'')+(TITLES[p]||'');window.scrollTo(0,0);
  const v=document.getElementById('views');
  if(p==='admin')return renderAdmin(v);
  if(p==='athletes')return renderAthletes(v);
  if(p==='home')return renderHome(v);
  if(p==='workout')return renderWorkout(v);
  if(p==='diet')return renderDiet(v);
  if(p==='tracker')return renderTracker(v);
  if(p==='more')return renderMore(v);}

// ===== DATA LOADERS =====
async function loadPlan(){const r=await API.get('/plan/'+VIEW_USER);if(r.status===200){PLAN=r.data;
  if(PLAN.days.length&&!PLAN.days.find(d=>d.id===CUR_DAY))CUR_DAY=PLAN.days[0].id;}}
async function loadToday(){const r=await API.get('/today/'+VIEW_USER);if(r.status===200)TODAY=r.data;}
async function loadMessages(){const r=await API.get('/messages/'+ME.id);const m=r.data?.messages||[];
  UNREAD=m.filter(x=>!x.read).length;const b=document.getElementById('bellBadge');
  if(b){b.textContent=UNREAD>9?'9+':UNREAD;b.classList.toggle('hidden',UNREAD===0);}return m;}
// Regelmäßig auf neue Nachrichten prüfen (alle 30s), damit Coach-Nachrichten zeitnah auftauchen
let msgPoll=null;
function startMsgPolling(){clearInterval(msgPoll);msgPoll=setInterval(()=>{if(ME)loadMessages();},30000);}

// ===== HOME =====
async function renderHome(v){v.innerHTML='<div class="page on"><div class="spinner"></div></div>';
  await Promise.all([loadToday(),PLAN?Promise.resolve():loadPlan()]);
  const [cr,flr,rec]=await Promise.all([
    API.get('/checkins/'+VIEW_USER),
    API.get('/foodlog/'+VIEW_USER+'?date='+today()),
    API.get('/recovery/'+VIEW_USER)
  ]);
  const cis=cr.data?.checkins||[];const last=cis[0];
  const foodSummary=flr.data?.summary||{consumed:0,target:null,remaining:null,macros:{}};
  const recovery=rec.data||null;
  // streak
  let streak=0;if(cis.length){const ds=new Set(cis.map(c=>c.date));let d=new Date();d.setHours(0,0,0,0);
    if(!ds.has(fmt(d)))d.setDate(d.getDate()-1);while(ds.has(fmt(d))){streak++;d.setDate(d.getDate()-1);}}
  const s=TODAY?.suggestion||{type:'rest'};const conf=TODAY?.confirmed;
  const eff=conf||s; // effektiver Tag
  const isTrain=eff.type==='train';
  const dateStr=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  const goalTxt={muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'}[TODAY?.goal]||'';
  const phaseTxt={offseason:'Offseason',prep:'Wettkampf-Prep',maintain:'Maintenance'}[TODAY?.phase]||'';
  const kcalTarget=isTrain?(TODAY?.kcal?.train):(TODAY?.kcal?.rest);
  // Kalorien heute (Summe der gespeicherten Meal-Items des passenden Tagtyps als "Plan", consumed später)
  const eyebrow=eff.type==='sick'?'Krank gemeldet':(isTrain?'Heute trainierst du':'Heute ist Ruhetag');
  const dayName=eff.type==='sick'?'Erholung':(isTrain?(eff.dayName||'Training'):'Rest Day');

  let html='<div class="page on">';
  // Einstiegs-Banner, wenn noch kein Plan/Ziel existiert (nur eigenes Konto)
  if(VIEW_USER===ME.id && !PLAN?.days?.length && !TODAY?.kcal?.train){
    html+=`<div class="today" style="background:linear-gradient(135deg,var(--red),#b00500);color:#fff">
      <div style="font-size:13px;font-weight:600;opacity:.9">ERSTE SCHRITTE</div>
      <div style="font-size:24px;font-weight:700;margin:6px 0">Erstelle deinen Plan</div>
      <div style="font-size:14px;opacity:.9;margin-bottom:16px">In unter einer Minute zu Trainingsplan &amp; Kalorienzielen.</div>
      <button class="btn" style="background:#fff;color:var(--red)" onclick="startOnboarding()">Jetzt einrichten</button>
    </div></div>`;
    v.innerHTML=html;return;
  }
  // TODAY HERO
  const hour=new Date().getHours();
  const greet=hour<11?'Guten Morgen':hour<17?'Hallo':'Guten Abend';
  const greetLine=(VIEW_USER===ME.id)?`<div style="font-size:15px;color:var(--ink2);margin-bottom:14px">${greet}, ${ME.name.split(' ')[0]} 👋</div>`:'';
  html+=greetLine;
  // Sanfter Health-Import-Hinweis: nur fürs eigene Konto, wenn Erinnerung aktiv und >7 Tage her (oder nie)
  if(VIEW_USER===ME.id && ME.health_reminder){
    const li=ME.last_health_import?Date.parse(ME.last_health_import):0;
    const days=li?Math.floor((Date.now()-li)/864e5):999;
    if(days>=7){
      html+=`<div class="surface pad" style="margin-bottom:16px;display:flex;align-items:center;gap:12px;border-left:3px solid var(--red)">
        <div style="font-size:22px">🍏</div>
        <div style="flex:1"><div style="font-weight:600;font-size:14px">Health-Daten aktualisieren</div><div style="color:var(--ink2);font-size:13px">${li?'Letzter Import vor '+days+' Tagen.':'Noch keine Health-Daten importiert.'} Tippe zum Importieren.</div></div>
        <button class="minibtn" onclick="openHealthImport()">Import</button>
      </div>`;
    }
  }
  html+=`<div class="today">
    <div class="eyebrow">◎ ${cap(dateStr)}</div>
    <div class="daytype">${dayName}</div>
    <div class="meta">${eyebrow}${phaseTxt?' · '+phaseTxt:''}</div>
    <div class="today-acts">
      ${isTrain?`<button class="btn" onclick="go('workout')">Training starten</button>`:`<button class="btn sec" onclick="go('diet')">Ernährung ansehen</button>`}
      <button class="btn sec" onclick="openDayPicker()">Tag ändern</button>
    </div>`;
  html+='</div>';

  // KALENDER-WIDGET: kommende 7 Tage, antippen öffnet vollen Kalender
  if(TODAY?.preview?.length){
    const wd=['So','Mo','Di','Mi','Do','Fr','Sa'];
    html+=`<div class="chart-card" style="padding:16px" onclick="openCalendar()">
      <div class="ch-h" style="margin-bottom:12px"><div class="t">Dein Plan</div><div class="v">Kalender öffnen ›</div></div>
      <div style="display:flex;gap:5px">`;
    TODAY.preview.slice(0,7).forEach((d,i)=>{
      const dt=new Date();dt.setDate(dt.getDate()+i);
      const isTrain=d.type==='train';
      const lbl=isTrain?(d.dayName||'Training'):'Rest';
      html+=`<div style="flex:1 1 0;min-width:0;text-align:center">
        <div style="font-size:10px;color:var(--ink3);margin-bottom:5px">${i===0?'Heute':wd[dt.getDay()]}</div>
        <div style="aspect-ratio:1;box-sizing:border-box;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:clamp(13px,4.2vw,18px);line-height:1;background:${isTrain?'var(--red)':'var(--surface2)'};color:${isTrain?'#fff':'var(--ink3)'};box-shadow:${i===0?'inset 0 0 0 2px var(--ink)':'none'}">${isTrain?'🏋️':'😴'}</div>
        <div style="font-size:9px;color:var(--ink2);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lbl}</div>
      </div>`;});
    html+='</div></div>';
  }

  // KALORIEN-RING (echte gegessene kcal vs Ziel)
  if(kcalTarget){
    const consumed=foodSummary.consumed||0;const rem=foodSummary.remaining;
    const statusTxt=foodSummary.status==='over'?'über dem Ziel':foodSummary.status==='onTarget'?'im Ziel ✓':(rem!=null?rem+' kcal übrig':'');
    html+=`<div class="surface pad ring-card" style="margin-bottom:16px" onclick="go('diet')">
      ${ring(consumed,kcalTarget)}
      <div class="ring-info">
        <div class="big">${consumed}<em> / ${kcalTarget} kcal</em></div>
        <div class="lbl">${goalTxt} · ${isTrain?'Trainingstag':'Ruhetag'}</div>
        <div class="kcal-left">${statusTxt} · ${foodSummary.macros?.protein||0}g Protein →</div>
      </div></div>`;
  }
  // RECOVERY-BADGE
  if(recovery&&recovery.score!=null){
    const col=recovery.score>=75?'var(--green)':recovery.score>=50?'var(--amber)':'var(--red)';
    html+=`<div class="surface pad" style="margin-bottom:16px;display:flex;align-items:center;gap:16px" onclick="openInfo('recovery')">
      <div style="flex-shrink:0;width:54px;height:54px;border-radius:50%;background:${col};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">${recovery.score}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:16px">${recovery.label} <span style="color:var(--ink3);font-size:13px;font-weight:400">ⓘ</span></div><div style="color:var(--ink2);font-size:13px;margin-top:2px">${recovery.advice}</div></div>
    </div>`;
  }
  // FORTSCHRITTS-KARTE: Startgewicht -> aktuell, mit Bewertung je nach Ziel
  const startW=ME.start_weight;const curW=last?.weight;
  if(startW&&curW){
    const diff=Math.round((curW-startW)*10)/10;
    const goal=TODAY?.goal||ME.goal;
    // Bewertung: passt die Richtung zum Ziel?
    let verdict,vColor;
    if(goal==='muscle'){if(diff>0){verdict='+'+diff+' kg aufgebaut 💪';vColor='var(--green)';}else if(diff<0){verdict=diff+' kg – Richtung stimmt noch nicht';vColor='var(--amber)';}else{verdict='Noch keine Veränderung';vColor='var(--ink2)';}}
    else if(goal==='fatloss'){if(diff<0){verdict=Math.abs(diff)+' kg verloren 🔥';vColor='var(--green)';}else if(diff>0){verdict='+'+diff+' kg – Richtung stimmt noch nicht';vColor='var(--amber)';}else{verdict='Noch keine Veränderung';vColor='var(--ink2)';}}
    else{verdict=(diff>0?'+':'')+diff+' kg seit Start';vColor='var(--ink2)';}
    html+=`<div class="surface pad" style="margin-bottom:16px">
      <div style="font-weight:600;margin-bottom:14px">Dein Fortschritt</div>
      <div style="display:flex;align-items:center;justify-content:space-between;text-align:center">
        <div style="flex:1"><div style="font-size:13px;color:var(--ink3)">Start</div><div style="font-size:22px;font-weight:700">${startW}<span style="font-size:13px;color:var(--ink2)"> kg</span></div></div>
        <div style="flex:0 0 40px;color:var(--ink3);font-size:20px">→</div>
        <div style="flex:1"><div style="font-size:13px;color:var(--ink3)">Heute</div><div style="font-size:26px;font-weight:700;color:var(--red)">${curW}<span style="font-size:13px;color:var(--ink2)"> kg</span></div></div>
      </div>
      <div style="text-align:center;margin-top:12px;font-weight:600;font-size:14px;color:${vColor}">${verdict}</div>
    </div>`;
  }
  // STAT TILES
  html+=`<div class="tiles">
    <div class="tile" onclick="go('tracker')"><div class="v">${last?.weight??'–'}<em> kg</em></div><div class="l">Aktuelles Gewicht</div>${weightTrend(cis)}</div>
    <div class="tile" onclick="openInfo('streak')"><div class="v">${streak}<em> Tage</em></div><div class="l">Check-in Streak ⓘ</div></div>
  </div>`;
  // GEWICHTSKURVE
  if(cis.filter(c=>c.weight).length>=2){
    html+=`<div class="chart-card"><div class="ch-h"><div class="t">Gewichtsverlauf</div><div class="v">letzte ${Math.min(cis.length,30)} Einträge</div></div>${sparkline(cis.filter(c=>c.weight).slice(0,30).reverse().map(c=>c.weight))}</div>`;
  }
  // SCHNELL-CHECKIN (Gewicht, Schlaf, Schritte, Wasser – das Tägliche an einem Ort)
  html+=`<div class="section-label">Schneller Check-in</div>
    <div class="surface pad">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label>Gewicht (kg)</label><input id="qc_weight" type="number" step="0.1" inputmode="decimal" placeholder="${last?.weight||'63.5'}"></div>
        <div class="field"><label>Schlaf (h)</label><input id="qc_sleep" type="number" step="0.5" inputmode="decimal" placeholder="${last?.sleep||'8'}"></div>
        <div class="field"><label>Schritte</label><input id="qc_steps" type="number" inputmode="numeric" placeholder="${last?.steps||'8000'}"></div>
        <div class="field"><label>Wasser (L)</label><input id="qc_water" type="number" step="0.1" inputmode="decimal" placeholder="${last?.water||'3'}"></div>
      </div>
      <button class="btn" onclick="quickCheckin()">Check-in speichern</button>
      <div style="font-size:12px;color:var(--ink3);text-align:center;margin-top:8px">Leer lassen ist okay – trag ein, was du hast.</div>
    </div>`;
  // ADAPTIV: Profis bekommen Maße + Fotos direkt griffbereit auf der Home
  if(isAdvanced()&&VIEW_USER===ME.id){
    html+=`<div class="section-label">Physik tracken</div>
      <div class="quick">
        <button class="qcard" onclick="openMeasure()"><span class="ic">📏</span><div class="t">Körpermaße</div><div class="d">Schnell eintragen</div></button>
        <button class="qcard" onclick="openPhotos()"><span class="ic">📸</span><div class="t">Foto</div><div class="d">Physik festhalten</div></button>
      </div>`;
  }
  html+='</div>';
  v.innerHTML=html;
}
function ring(val,max){const pct=max?Math.min(1,val/max):0;const R=34,C=2*Math.PI*R;const off=C*(1-pct);
  return `<svg class="ring" width="84" height="84" viewBox="0 0 84 84">
    <circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--line)" stroke-width="8"/>
    <circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--red)" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 42 42)"/>
    <text x="42" y="40" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">${val}</text>
    <text x="42" y="56" text-anchor="middle" font-size="10" fill="var(--ink2)">/ ${max}</text>
  </svg>`;}
function sparkline(vals){if(vals.length<2)return'';const w=480,h=120,pad=10;
  const mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;
  const pts=vals.map((v,i)=>[pad+i*(w-2*pad)/(vals.length-1),h-pad-((v-mn)/rng)*(h-2*pad)]);
  const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=d+` L${pts[pts.length-1][0].toFixed(1)} ${h-pad} L${pts[0][0].toFixed(1)} ${h-pad} Z`;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${area}" fill="var(--red-soft)"/>
    <path d="${d}" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="var(--red)"/>`).join('')}
  </svg>`;}
function weightTrend(cis){const w=cis.filter(c=>c.weight).map(c=>c.weight);if(w.length<2)return'';
  const diff=w[0]-w[1];if(Math.abs(diff)<0.05)return'';
  return `<div class="trend ${diff>0?'up':'down'}">${diff>0?'↑':'↓'} ${Math.abs(diff).toFixed(1)} kg</div>`;}
async function quickCheckin(){const w=num('qc_weight'),sl=num('qc_sleep'),st=num('qc_steps'),wa=num('qc_water');
  if(w==null&&sl==null&&st==null&&wa==null)return toast('Bitte mindestens einen Wert eingeben');
  const body={user_id:VIEW_USER,date:today()};
  if(w!=null)body.weight=w;if(sl!=null)body.sleep=sl;if(st!=null)body.steps=st;if(wa!=null)body.water=wa;
  await API.post('/checkins',body);toast('Check-in gespeichert ✓');go('home');}

// ===== TAG-PICKER =====
function openDayPicker(){const days=(PLAN?.days||[]);
  let h='<div class="info">Wähle, was du heute machst. Trainings-Tage rotieren automatisch weiter – du kannst aber jederzeit abweichen.</div>';
  days.forEach(d=>{h+=`<button class="btn sec" style="margin-bottom:8px" onclick="setDay('train','${esc(d.name)}')">🏋️ ${d.name}</button>`;});
  h+=`<button class="btn sec" style="margin-bottom:8px" onclick="setDay('rest')">😴 Ruhetag</button>`;
  h+=`<button class="btn sec" style="color:var(--amber)" onclick="setDay('sick')">🤒 Krank / Pause (Rhythmus verschiebt sich)</button>`;
  openSheet('Was machst du heute?',h);}
async function setDay(type,dayName){await API.post('/today/'+VIEW_USER,{date:today(),type,day_name:dayName});
  closeModal();await loadToday();toast(type==='sick'?'Gute Besserung! 🤒':'Aktualisiert ✓');go('home');}

// ===== WORKOUT =====
async function renderWorkout(v){if(!PLAN)await loadPlan();if(!TODAY)await loadToday();
  // aktiver Tag = bestätigter/empfohlener Trainingstag, sonst erster
  const eff=TODAY?.confirmed||TODAY?.suggestion;
  if(eff?.type==='train'&&eff.dayName){const m=PLAN.days.find(d=>d.name===eff.dayName);if(m)CUR_DAY=m.id;}
  const dateStr=new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  v.innerHTML=`<div class="page on">
    <div class="h1">Training</div><div class="sub">${cap(dateStr)}</div>
    <div class="seg" style="margin-bottom:16px">
      <button id="wt_strength" class="on" onclick="workoutTab('strength')">Kraft</button>
      <button id="wt_cardio" onclick="workoutTab('cardio')">Cardio</button>
    </div>
    <div id="workoutBody"></div>
  </div>`;
  workoutTab(renderWorkout.tab||'strength');}
function workoutTab(t){renderWorkout.tab=t;
  document.getElementById('wt_strength').classList.toggle('on',t==='strength');
  document.getElementById('wt_cardio').classList.toggle('on',t==='cardio');
  if(t==='strength')drawStrength();else drawCardioTab();}
function drawStrength(){const b=document.getElementById('workoutBody');
  b.innerHTML=`${isBeginner()?`<div class="info" style="margin-bottom:16px">👋 Tippe eine Übung an, um sie zu öffnen. Trag bei jedem Satz dein Gewicht und die Wiederholungen ein. Der grüne, gelbe oder graue Hinweis sagt dir, ob du nächstes Mal mehr Gewicht nehmen solltest.</div>`:''}
    <div class="chip-row" id="daysel" style="margin-bottom:18px"></div>
    <div id="exlist"></div>
    <button class="btn sec" id="addExBtn" style="margin-top:4px" onclick="addExercise()">+ Übung hinzufügen</button>`;
  renderDaySel();renderEx();}
function renderDaySel(){const el=document.getElementById('daysel');
  el.innerHTML=PLAN.days.map(d=>`<button class="daychip ${d.id===CUR_DAY?'now':''}" onclick="selDay(${d.id})">${d.name}</button>`).join('')
    +`<button class="daychip" onclick="addDay()">+ Tag</button>`
    +(curDayObj()?`<button class="daychip" onclick="manageDay()" title="Tag bearbeiten">⚙️</button>`:'');}
async function selDay(id){CUR_DAY=id;renderDaySel();await renderEx();}
function manageDay(){const d=curDayObj();if(!d)return;
  openSheet('Tag verwalten',`
    <div class="field"><label>Name des Trainingstags</label><input id="dn_name" value="${esc(d.name).replace(/&quot;/g,'"')}"></div>
    <button class="btn" onclick="renameDay(${d.id})">Umbenennen</button>
    <button class="btn sec" style="margin-top:10px;color:var(--red)" onclick="deleteDay(${d.id})">🗑 Diesen Tag löschen</button>
    <div class="info" style="margin-top:14px">Beim Löschen werden auch die Übungen dieses Tags entfernt. Dein Rhythmus passt sich automatisch an.</div>`);}
async function renameDay(id){const name=val('dn_name');if(!name)return toast('Name darf nicht leer sein');
  const r=await API.put('/days/'+id,{name});if(r.status===200){closeModal();await loadPlan();renderWorkout(document.getElementById('views'));toast('Umbenannt ✓');}else toast('Fehler');}
async function deleteDay(id){const d=curDayObj();if(!window.confirm('"'+d.name+'" wirklich löschen? Die Übungen dieses Tags werden mitgelöscht.'))return;
  const r=await API.del('/days/'+id);if(r.status===200){closeModal();CUR_DAY=null;await loadPlan();renderWorkout(document.getElementById('views'));toast('Tag gelöscht');}else toast(r.data?.error||'Fehler');}
function curDayObj(){return PLAN.days.find(d=>d.id===CUR_DAY);}
async function renderEx(){const day=curDayObj();const el=document.getElementById('exlist');
  if(!day){el.innerHTML='<div class="empty"><div class="ei">🏋️</div>Noch kein Trainingstag angelegt.<br><br><button class="btn" style="max-width:240px;margin:0 auto" onclick="addDay()">+ Ersten Trainingstag erstellen</button></div>';return;}
  if(!day.exercises.length){el.innerHTML='<div class="empty"><div class="ei">➕</div>Dieser Tag hat noch keine Übungen.<br><br><button class="btn" style="max-width:240px;margin:0 auto" onclick="addExercise()">+ Erste Übung hinzufügen</button></div>';return;}
  // Logs von heute + Progression je Übung parallel
  const lr=await API.get('/logs/'+VIEW_USER+'?date='+today());const logs=lr.data?.logs||[];
  const logFor=(exId,s)=>logs.find(l=>l.exercise_id===exId&&l.set_no===s)||{};
  const progs=await Promise.all(day.exercises.map(ex=>API.get('/progression/'+VIEW_USER+'/'+ex.id).then(r=>r.data)));
  el.innerHTML=day.exercises.map((ex,i)=>{
    const sets=ex.target_sets||3;const pr=progs[i]||{};const rec=pr.recommendation||{type:'none',text:''};
    const prevFor=(s)=>{const ps=(pr.lastSets||[]).find(x=>x.set_no===s);return ps?`${ps.weight??'–'} kg × ${ps.reps??'–'}`:'';};
    const recIcon={up:'↗',down:'↘',hold:'→',none:'•'}[rec.type]||'•';
    const prs=pr.prs;const prBadge=(prs&&prs.hasData)?`<span class="pill" style="background:#fff3cd;color:#9a6a00;margin-left:4px">🏆 ${prs.maxWeight}kg</span>`:'';
    return `<div class="ex" id="ex-${ex.id}">
      <div class="ex-head" onclick="toggleEx(${ex.id})">
        <div class="ex-idx">${i+1}</div>
        <div class="ex-main"><div class="nm">${ex.name}${ex.coach_locked?'<span class="pill coach">Coach</span>':''}${prBadge}</div>
          <div class="mg">${ex.muscle||''}${ex.target_reps?' · '+ex.target_reps+' Reps':''} <span id="save-${ex.id}" style="font-size:11px;font-weight:600;margin-left:4px"></span></div></div>
        <div class="ex-chev">›</div>
      </div>
      <div class="ex-body"><div class="ex-inner">
        <div class="rec ${rec.type}"><span class="ric">${recIcon}</span><span>${rec.text||''}</span></div>
        ${ex.technique?`<div class="surface" style="padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="explainTechnique('${esc(ex.technique)}')"><span style="font-size:15px">📖</span><div style="flex:1"><div style="font-weight:600;font-size:14px">Technik: ${ex.technique}</div><div style="font-size:12px;color:var(--ink3)">Antippen für Erklärung</div></div></div>`:''}
        <div class="setgrid"><div class="hd">Satz</div><div class="hd">Gewicht</div><div class="hd">Reps</div></div>
        ${Array.from({length:sets},(_,s)=>{const lg=logFor(ex.id,s+1);const ps=(pr.lastSets||[]).find(x=>x.set_no===s+1);
          const hasToday=(lg.weight!=null||lg.reps!=null);
          const wVal=lg.weight??(ps?ps.weight:'');const rVal=lg.reps??(ps?ps.reps:'');
          const sugg=!hasToday&&ps; // Vorschlag aus letztem Training
          const suggClass=sugg?' class="sugg"':'';
          return `<div class="setgrid">
            <div class="sn">${s+1}</div>
            <div><input type="number" inputmode="decimal" placeholder="kg"${suggClass} value="${wVal}" data-sugg="${sugg?1:0}" onfocus="clearSugg(this)" onchange="logSet(${ex.id},${s+1},'weight',this.value)"><div class="prev">${ps?'zuletzt '+(ps.weight??'–')+' kg':'erster Satz'}</div></div>
            <div><input type="number" inputmode="numeric" placeholder="–"${suggClass} value="${rVal}" data-sugg="${sugg?1:0}" onfocus="clearSugg(this)" onchange="logSet(${ex.id},${s+1},'reps',this.value,true)"><div class="prev">${ps?'× '+(ps.reps??'–'):''}</div></div>
          </div>`;}).join('')}
        <button class="minibtn" style="margin-top:6px" onclick="startRest(90)">⏱️ Pause starten (90s)</button>
        ${ex.notes?`<div class="info" style="margin-top:12px">${ex.notes}</div>`:''}
        <div class="ex-tools">
          <button class="minibtn video" onclick="openVideo('${esc(ex.name)}','${esc(ex.video_url||'')}')">▶ Ausführung</button>
          <button class="minibtn" onclick="openExHistory(${ex.id})">📊 Verlauf</button>
          <button class="minibtn" onclick="openExNote(${ex.id},'${esc(ex.name)}')">📝 Notiz</button>
          ${/hantel|press|bench|squat|deadlift|kreuzheben|curl|rudern|bankdr|kniebeu/i.test(ex.name)?`<button class="minibtn" onclick="openPlateCalc()">🏋️ Hantel</button>`:''}
          <button class="minibtn" onclick="editExercise(${ex.id})">Bearbeiten</button>
          <button class="minibtn red" onclick="delExercise(${ex.id})">Löschen</button>
        </div>
      </div></div></div>`;}).join('');
  // Fortschritts-Banner: wie viele Sätze sind eingetragen?
  let totalSets=0,doneSets=0;
  day.exercises.forEach(ex=>{const s=ex.target_sets||3;totalSets+=s;
    for(let i=1;i<=s;i++){const lg=logFor(ex.id,i);if(lg.weight!=null||lg.reps!=null)doneSets++;}});
  const pct=totalSets?Math.round(doneSets/totalSets*100):0;
  let banner=`<div class="surface pad" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px"><span style="font-weight:600">Heutiges Training</span><span style="color:var(--ink2)">${doneSets} / ${totalSets} Sätze</span></div>
    <div style="height:10px;background:var(--line);border-radius:5px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--green);border-radius:5px;transition:.3s"></div></div>`;
  if(pct>=100)banner+=`<div style="text-align:center;margin-top:12px;font-weight:600;color:var(--green)">🎉 Alle Sätze geschafft – stark!</div>`;
  else if(doneSets>0)banner+=`<div style="text-align:center;margin-top:10px;color:var(--ink2);font-size:13px">Weiter so – ${totalSets-doneSets} Sätze noch!</div>`;
  banner+=`</div>`;
  el.innerHTML=banner+el.innerHTML;}
function toggleEx(id){document.getElementById('ex-'+id).classList.toggle('open');}
// Verlauf + PRs einer Übung als Chart
// Notizen / Beschwerden zu einer Übung
async function openExNote(exId,name){openSheet('Notizen: '+name,'<div class="spinner"></div>');
  const r=await API.get('/exercise-notes/'+VIEW_USER+'/'+exId);const notes=r.data?.notes||[];
  let h=`<div class="info">Schreib hier Beschwerden oder Beobachtungen (z.B. "Schulter knackt", "linkes Knie zwickt"). Als Beschwerde markierte Notizen sieht dein Coach hervorgehoben.</div>
    <div class="field"><label>Neue Notiz</label><textarea id="en_note" rows="2" placeholder="Was ist dir aufgefallen?"></textarea></div>
    <label style="display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:14px"><input type="checkbox" id="en_flag" checked style="width:auto"> Als Beschwerde markieren (Coach informieren)</label>
    <button class="btn" onclick="saveExNote(${exId},'${esc(name)}')">Notiz speichern</button>`;
  if(notes.length){h+=`<div class="section-label">Frühere Notizen</div><div class="rows">`+notes.map(n=>{
    const dt=new Date(n.date+'T00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
    return `<div class="row"><div class="rl">${n.note}<small>${dt}</small></div><div class="rr">${n.flagged?'<span class="pill" style="background:var(--red-soft);color:var(--red)">offen</span>':'<span style="color:var(--ink3);font-size:12px">erledigt</span>'}</div></div>`;}).join('')+`</div>`;}
  openSheet('Notizen: '+name,h);}
async function saveExNote(exId,name){const note=val('en_note');if(!note)return toast('Bitte etwas eingeben');
  const flag=document.getElementById('en_flag').checked;
  const r=await API.post('/exercise-notes',{user_id:VIEW_USER,exercise_id:exId,note,flagged:flag});
  if(r.status===200){toast('Notiz gespeichert ✓');openExNote(exId,name);}else toast('Fehler');}
async function openExHistory(exId){openSheet('Lädt…','<div class="spinner"></div>');
  const r=await API.get('/exercise-history/'+VIEW_USER+'/'+exId);if(r.status!==200)return toast('Fehler');
  const d=r.data;const p=d.prs;
  let h='';
  if(!p||!p.hasData){h='<div class="empty"><div class="ei">📊</div>Noch keine Daten. Trag ein paar Sätze ein, dann erscheinen hier deine Rekorde und dein Fortschritt.</div>';}
  else{
    h+=`<div class="surface pad" style="margin-bottom:14px"><div style="font-weight:600;margin-bottom:10px">🏆 Deine Rekorde</div>
      <div class="row" style="padding:8px 0"><div class="rl">Bestes Gewicht</div><div class="rr"><b>${p.maxWeight} kg</b> × ${p.maxWeightReps}</div></div>
      <div class="row" style="padding:8px 0"><div class="rl">Geschätztes 1RM</div><div class="rr"><b>${p.best1RM} kg</b></div></div>
      <div class="row" style="padding:8px 0;border:none"><div class="rl">Meiste Reps</div><div class="rr"><b>${p.maxReps}</b> @ ${p.maxRepsWeight} kg</div></div></div>`;
    if(d.history.length>=2){const vals=d.history.map(x=>x.e1rm);
      h+=`<div class="chart-card"><div class="ch-h"><div class="t">1RM-Entwicklung</div><div class="v">${d.history.length} Einheiten</div></div>${sparkline(vals)}<div style="display:flex;justify-content:space-between;color:var(--ink2);font-size:13px;margin-top:8px"><span>${vals[0]} kg</span><span>aktuell: ${vals[vals.length-1]} kg</span></div></div>`;}
    else h+='<div class="info">Ab dem zweiten Trainingstag siehst du hier deine Fortschrittskurve.</div>';
  }
  openSheet(d.name,h);}
let logTimers={};
function logSet(exId,setNo,field,value,autoTimer){const key=exId+'_'+setNo;
  if(!logSet.cache)logSet.cache={};
  logSet.cache[key]={...(logSet.cache[key]||{}),user_id:VIEW_USER,exercise_id:exId,date:today(),set_no:setNo,[field]:value===''?null:parseFloat(value)};
  setSaveStatus(exId,'saving');
  clearTimeout(logTimers[key]);logTimers[key]=setTimeout(async()=>{
    const r=await API.post('/logs',logSet.cache[key]);
    setSaveStatus(exId, r.status===200?'saved':'error');
  },500);
  // Beim Eintragen der Reps automatisch Pausen-Timer starten (wenn ein Wert da ist)
  if(autoTimer&&value!==''&&parseFloat(value)>0&&restInt===null)startRest(90);}
function clearSugg(input){if(input.dataset.sugg==='1'){input.dataset.sugg='0';input.classList.remove('sugg');
    // Vorschlag als echten Wert übernehmen und speichern, falls Nutzer ihn so lässt
    if(input.value!==''){input.dispatchEvent(new Event('change'));}}}
function setSaveStatus(exId,state){const el=document.getElementById('save-'+exId);if(!el)return;
  if(state==='saving'){el.textContent='speichert…';el.style.color='var(--ink3)';}
  else if(state==='saved'){el.textContent='✓ gespeichert';el.style.color='var(--green)';
    clearTimeout(el._t);el._t=setTimeout(()=>{el.textContent='';},2000);}
  else{el.textContent='⚠ nicht gespeichert';el.style.color='var(--red)';}}

function openVideo(name,url){const q=encodeURIComponent(name+' richtige Ausführung Technik');
  const yt=url||`https://www.youtube.com/results?search_query=${q}`;
  openSheet('Übung: '+name,`<div class="info">${url?'Vom Coach hinterlegte Anleitung.':'Such-Ergebnisse für die korrekte Ausführung. Achte auf saubere Technik vor Gewicht.'}</div>
    <a href="${yt}" target="_blank"><button class="btn">▶ Auf YouTube ansehen</button></a>
    <a href="https://www.muscleandstrength.com/exercises" target="_blank"><button class="btn sec" style="margin-top:10px">Exercise-Datenbank (Bilder &amp; Anleitung)</button></a>`);}

async function addDay(){openSheet('Neuer Trainingstag',`<div class="field"><label>Name</label><input id="dayName" placeholder="z.B. Push, Lower 2, Beine"></div><button class="btn" onclick="confirmAddDay()">Erstellen</button>`);}
async function confirmAddDay(){const name=val('dayName')||'Neuer Tag';const r=await API.post('/days',{plan_id:PLAN.plan.id,name});
  if(r.status===200){closeModal();await loadPlan();CUR_DAY=r.data.id;renderWorkout(document.getElementById('views'));}}
function exForm(ex){return `
  <div class="field"><label>Muskelgruppe</label><input id="ex_muscle" value="${ex?.muscle||''}" placeholder="z.B. Quads"></div>
  <div class="field"><label>Übung</label><input id="ex_name" value="${ex?.name||''}" placeholder="z.B. Leg Press"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="field"><label>Sätze (1–10)</label><input id="ex_sets" type="number" min="1" max="10" value="${ex?.target_sets||3}"></div>
    <div class="field"><label>Reps (z.B. 8-12)</label><input id="ex_reps" value="${ex?.target_reps||''}" placeholder="8-12"></div>
  </div>
  <div class="field"><label>Technik (optional)</label>
    <div style="display:flex;gap:8px"><input id="ex_tech" value="${ex?.technique||''}" placeholder="z.B. Continuous Reps" style="flex:1">
    <button type="button" class="btn sec" style="width:auto;padding:0 14px;white-space:nowrap" onclick="pickTechnique()">📖 Begriffe</button></div></div>
  <div class="field"><label>Video-Link (optional)</label><input id="ex_video" value="${ex?.video_url||''}" placeholder="YouTube-Link"></div>
  <div class="field"><label>Notizen (optional)</label><textarea id="ex_notes" rows="2">${ex?.notes||''}</textarea></div>`;}
function addExercise(){if(!curDayObj())return toast('Erstelle zuerst einen Tag');
  EX_FORM_CTX={id:null,draft:null};
  openSheet('Übung hinzufügen',exForm(null)+`<button class="btn" onclick="confirmAddExercise()">Hinzufügen</button>`);}
async function confirmAddExercise(){const body={day_id:CUR_DAY,muscle:val('ex_muscle'),name:val('ex_name'),technique:val('ex_tech'),video_url:val('ex_video'),target_sets:clampSets(val('ex_sets')),target_reps:val('ex_reps'),notes:val('ex_notes')};
  if(!body.name)return toast('Name fehlt');const r=await API.post('/exercises',body);
  if(r.status===200){closeModal();await loadPlan();renderEx();toast('Hinzugefügt ✓');}}
function editExercise(id){const ex=curDayObj().exercises.find(e=>e.id===id);
  EX_FORM_CTX={id:id,draft:null};
  openSheet('Übung bearbeiten',(ex.coach_locked&&ME.role!=='coach'?`<div class="warn">⚠️ Diese Übung stammt von deinem Coach. Änderst du sie, weicht dein Plan von der Vorgabe ab.</div>`:'')+exForm(ex)+`<button class="btn" onclick="confirmEditExercise(${id})">Speichern</button>`);}
async function confirmEditExercise(id,confirm){const body={muscle:val('ex_muscle'),name:val('ex_name'),technique:val('ex_tech'),video_url:val('ex_video'),target_sets:clampSets(val('ex_sets')),target_reps:val('ex_reps'),notes:val('ex_notes')};
  if(confirm)body.confirm=true;const r=await API.put('/exercises/'+id,body);
  if(r.status===409&&r.data?.warning){if(window.confirm(r.data.message))return confirmEditExercise(id,true);return;}
  if(r.status===200){closeModal();await loadPlan();renderEx();toast('Gespeichert ✓');}else toast(r.data?.error||'Fehler');}
async function delExercise(id,confirm){const ex=curDayObj().exercises.find(e=>e.id===id);
  const name=ex?.name||'Übung';
  const r=await API.del('/exercises/'+id,confirm?{confirm:true}:{});
  if(r.status===409&&r.data?.warning){if(window.confirm(r.data.message))return delExercise(id,true);return;}
  if(r.status===200){await loadPlan();renderEx();
    toast('"'+name+'" gelöscht',{label:'Rückgängig',fn:async()=>{await API.post('/exercises/'+id+'/restore');await loadPlan();renderEx();toast('Wiederhergestellt ✓');}});}}

// ===== DIET =====
async function renderDiet(v){if(!TODAY)await loadToday();
  const eff=TODAY?.confirmed||TODAY?.suggestion;DIET=(eff?.type==='train')?'training':'rest';
  v.innerHTML=`<div class="page on"><div class="h1">Ernährung</div>
    <div class="sub">${DIET==='training'?'Heute ist ein Trainingstag':'Heute ist ein Ruhetag'} – automatisch gewählt</div>
    <div class="seg">
      <button id="dt_track" class="on" onclick="dietTab('track')">Heute</button>
      <button id="dt_plan" onclick="dietTab('plan')">Plan</button>
      <button id="dt_recipes" onclick="dietTab('recipes')">Rezepte</button>
    </div>
    <div id="dietBody"><div class="spinner"></div></div></div>`;
  const [mr,fr]=await Promise.all([API.get('/meals/'+VIEW_USER),API.get('/foodlog/'+VIEW_USER+'?date='+today())]);
  renderDiet.meals=mr.data?.meals||[];renderDiet.foodlog=fr.data||{items:[],summary:{}};
  dietTab('track');}
function dietTab(t){renderDiet.tab=t;
  document.getElementById('dt_track').classList.toggle('on',t==='track');
  document.getElementById('dt_plan').classList.toggle('on',t==='plan');
  document.getElementById('dt_recipes').classList.toggle('on',t==='recipes');
  if(t==='track')drawTrack();else if(t==='plan')drawDiet();else drawRecipes();}
function macroRow(kc,p,c,f,target){return `<div class="macro-row">
    <div class="macro kcal"><div class="v">${Math.round(kc)}${target?`<em>/${target}</em>`:''}</div><div class="k">kcal</div></div>
    <div class="macro"><div class="v">${Math.round(p)}<em>g</em></div><div class="k">Protein</div></div>
    <div class="macro"><div class="v">${Math.round(c)}<em>g</em></div><div class="k">Carbs</div></div>
    <div class="macro"><div class="v">${Math.round(f)}<em>g</em></div><div class="k">Fett</div></div></div>`;}

// HEUTE getrackt: was wurde gegessen, vs Ziel, mit Hinzufügen
function drawTrack(){const fl=renderDiet.foodlog||{items:[],summary:{}};const sum=fl.summary||{};
  const items=fl.items||[];
  const el=document.getElementById('dietBody');
  let h=macroRow(sum.consumed||0,sum.macros?.protein||0,sum.macros?.carbs||0,sum.macros?.fat||0,sum.target);
  // Fortschrittsbalken
  if(sum.target){const pct=Math.min(100,Math.round((sum.consumed/sum.target)*100));
    const col=sum.status==='over'?'var(--red)':sum.status==='onTarget'?'var(--green)':'var(--red)';
    h+=`<div style="background:var(--surface);border-radius:var(--r);box-shadow:var(--shadow);padding:16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px"><span style="color:var(--ink2)">${sum.consumed} von ${sum.target} kcal</span><span style="font-weight:600;color:${col}">${sum.remaining>=0?sum.remaining+' übrig':Math.abs(sum.remaining)+' drüber'}</span></div>
      <div style="height:8px;background:var(--line);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${col};border-radius:4px;transition:.3s"></div></div></div>`;}
  // Schnell-Aktionen
  h+=`<div style="display:flex;gap:10px;margin-bottom:16px">
    <button class="btn" onclick="openLogFood()">+ Lebensmittel</button>
    <button class="btn sec" onclick="openLogFromPlan()">Aus Plan übernehmen</button></div>`;
  // gegessene Items
  if(!items.length){h+='<div class="empty"><div class="ei">🍽️</div>Noch nichts getrackt heute.<br>Füge dein erstes Lebensmittel hinzu.</div>';}
  else{h+='<div class="section-label">Heute gegessen</div><div class="rows">';
    items.forEach(it=>{h+=`<div class="row"><div class="rl">${it.food}<small>${it.amount} g/ml${it.meal_slot?' · '+it.meal_slot:''}</small></div><div class="rr">${Math.round(it.kcal||0)} kcal<br><button class="minibtn red" style="padding:3px 10px;margin-top:4px" onclick="delFood(${it.id})">Entfernen</button></div></div>`;});
    h+='</div>';}
  // Ernährungs-Tools
  h+=`<div class="section-label">Hilfsmittel</div><div class="quick">
    <button class="qcard" onclick="openCalc()"><span class="ic">🧮</span><div class="t">Makro-Rechner</div><div class="d">Aus Lebensmitteln</div></button>
    <button class="qcard" onclick="openSupp()"><span class="ic">💊</span><div class="t">Supplements</div><div class="d">Dein Protokoll</div></button>
  </div>`;
  el.innerHTML=h;}

async function delFood(id){await API.del('/foodlog/'+id);const fr=await API.get('/foodlog/'+VIEW_USER+'?date='+today());renderDiet.foodlog=fr.data;drawTrack();toast('Entfernt');}

// ===== REZEPTE =====
let RECIPE_FILTER=null; // wird beim ersten Öffnen aus Profil + Uhrzeit vorbelegt
function defaultRecipeFilter(){
  // Ziel aus dem Profil des angesehenen Nutzers (Athlet bzw. vom Coach betreuter)
  const goal=(VIEW_USER===ME.id?ME.goal:(VIEW_USER_PROFILE?.goal))||'all';
  // Mahlzeit aus der Tageszeit
  const h=new Date().getHours();
  const meal=h<10?'Frühstück':h<15?'Mittag':h<21?'Abend':'Snack';
  return {goal:goal||'all',meal,fit:false};
}
async function drawRecipes(){const el=document.getElementById('dietBody');el.innerHTML='<div class="spinner"></div>';
  if(!RECIPE_FILTER)RECIPE_FILTER=defaultRecipeFilter();
  const sum=renderDiet.foodlog?.summary||{};const remaining=sum.remaining;
  const f=RECIPE_FILTER;
  let q='/recipes?';
  if(f.goal!=='all')q+='goal='+encodeURIComponent(f.goal)+'&';
  if(f.meal!=='all')q+='meal='+encodeURIComponent(f.meal)+'&';
  if(f.fit&&remaining>0)q+='maxKcal='+encodeURIComponent(remaining)+'&';
  const r=await API.get(q);const recipes=r.data?.recipes||[];
  const meals=['Frühstück','Mittag','Abend','Snack'];
  let h=`<div class="info">Fertige Mahlzeiten mit Nährwerten – mit einem Tipp ins Tagesprotokoll übernehmen. Kein lästiges Einzel-Tracken.</div>`;
  // Filter-Chips
  h+=`<div style="margin-bottom:6px;font-size:13px;color:var(--ink2)">Ziel</div><div class="chip-row" style="margin-bottom:12px">`+
    [['all','Alle'],['muscle','Aufbau'],['fatloss','Definition'],['health','Gesundheit']].map(([v,l])=>`<button class="daychip ${f.goal===v?'now':''}" onclick="recipeFilter('goal','${v}')">${l}</button>`).join('')+`</div>`;
  h+=`<div style="margin-bottom:6px;font-size:13px;color:var(--ink2)">Mahlzeit</div><div class="chip-row" style="margin-bottom:12px">`+
    [['all','Alle'],...meals.map(m=>[m,m])].map(([v,l])=>`<button class="daychip ${f.meal===v?'now':''}" onclick="recipeFilter('meal','${v}')">${l}</button>`).join('')+`</div>`;
  // "Passt in mein Budget"-Schalter (nur sinnvoll, wenn Restbudget bekannt)
  if(remaining>0)h+=`<label style="display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:14px"><input type="checkbox" ${f.fit?'checked':''} onchange="recipeFilter('fit',this.checked)" style="width:auto"> Nur Rezepte, die noch in mein Budget passen (${remaining} kcal übrig)</label>`;
  h+=`<button class="btn sec" style="margin-bottom:16px" onclick="openNewRecipe()">+ Eigenes Rezept</button>`;
  // Liste
  if(!recipes.length)h+='<div class="empty"><div class="ei">🍳</div>Keine Rezepte für diese Filter.</div>';
  else{RECIPES_CACHE=recipes;h+='<div class="rows">'+recipes.map(rc=>{
    const badge=({muscle:'💪',fatloss:'🔥',health:'❤️'})[rc.goal]||'';
    return `<div class="row" onclick="openRecipe(${rc.id})"><div class="rl">${rc.name} ${rc.owner_id?'⭐':''}<small>${rc.meal_type||''} ${badge} · P${Math.round(rc.protein)} K${Math.round(rc.carbs)} F${Math.round(rc.fat)}</small></div><div class="rr">${Math.round(rc.kcal)} kcal<br><span style="color:var(--ink3);font-size:11px">ansehen ›</span></div></div>`;}).join('')+'</div>';}
  el.innerHTML=h;}
let RECIPES_CACHE=[];
function recipeFilter(key,val){RECIPE_FILTER[key]=val;drawRecipes();}
function openRecipe(id){const rc=RECIPES_CACHE.find(x=>x.id===id);if(!rc)return;
  const badge=({muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'})[rc.goal]||'für alle Ziele';
  let h=macroRow(rc.kcal,rc.protein,rc.carbs,rc.fat);
  h+=`<div style="color:var(--ink2);font-size:13px;margin:4px 0 16px">${rc.meal_type||'Mahlzeit'} · ${badge}</div>`;
  h+=`<button class="btn" onclick="logRecipe(${rc.id})">🍽️ Als gegessen eintragen</button>`;
  if(rc.link)h+=`<a class="btn sec" style="margin-top:10px;display:block;text-align:center;text-decoration:none" href="${esc(rc.link)}" target="_blank" rel="noopener">▶ Rezept ansehen (extern)</a>`;
  if(rc.ingredients){h+=`<div class="section-label">Zutaten</div><div class="surface pad" style="white-space:pre-line;font-size:14px;line-height:1.7">${esc2(rc.ingredients)}</div>`;}
  if(rc.steps){h+=`<div class="section-label">Zubereitung</div><div class="surface pad" style="white-space:pre-line;font-size:14px;line-height:1.7">${esc2(rc.steps)}</div>`;}
  if(rc.owner_id)h+=`<button class="btn sec" style="margin-top:16px;color:var(--red)" onclick="delRecipe(${rc.id})">🗑 Eigenes Rezept löschen</button>`;
  openSheet(rc.name,h);}
async function logRecipe(id){const r=await API.post('/recipes/'+id+'/log',{user_id:VIEW_USER,date:today()});
  if(r.status===200){closeModal();const fr=await API.get('/foodlog/'+VIEW_USER+'?date='+today());renderDiet.foodlog=fr.data;
    toast('Eingetragen ✓');dietTab('track');}else toast(r.data?.error||'Fehler');}
async function delRecipe(id){if(!window.confirm('Eigenes Rezept löschen?'))return;
  const r=await API.del('/recipes/'+id);if(r.status===200){closeModal();toast('Gelöscht');drawRecipes();}else toast(r.data?.error||'Fehler');}
function openNewRecipe(){openSheet('Eigenes Rezept',`
  <div class="info">Lege eine Mahlzeit an, die du oft isst – dann trägst du sie künftig mit einem Tipp ein.</div>
  <div class="field"><label>Name</label><input id="nr_name" placeholder="z.B. Mein Frühstücks-Bowl"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="field"><label>Kalorien</label><input id="nr_kcal" type="number" inputmode="numeric" placeholder="kcal"></div>
    <div class="field"><label>Mahlzeit</label><select id="nr_meal"><option value="">–</option><option>Frühstück</option><option>Mittag</option><option>Abend</option><option>Snack</option></select></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    <div class="field"><label>Protein</label><input id="nr_p" type="number" inputmode="numeric" placeholder="g"></div>
    <div class="field"><label>Carbs</label><input id="nr_c" type="number" inputmode="numeric" placeholder="g"></div>
    <div class="field"><label>Fett</label><input id="nr_f" type="number" inputmode="numeric" placeholder="g"></div>
  </div>
  <div class="field"><label>Ziel (optional)</label><select id="nr_goal"><option value="">für alle</option><option value="muscle">Aufbau</option><option value="fatloss">Definition</option><option value="health">Gesundheit</option></select></div>
  <div class="field"><label>Zutaten (optional, eine pro Zeile)</label><textarea id="nr_ing" rows="3" placeholder="100 g Haferflocken\n300 ml Milch"></textarea></div>
  <div class="field"><label>Zubereitung (optional)</label><textarea id="nr_steps" rows="2" placeholder="1. ..."></textarea></div>
  <div class="field"><label>Link zu Rezept/Video (optional)</label><input id="nr_link" placeholder="https://..."></div>
  <button class="btn" onclick="saveNewRecipe()">Rezept speichern</button>`);}
async function saveNewRecipe(){const body={name:val('nr_name'),kcal:num('nr_kcal'),protein:num('nr_p'),carbs:num('nr_c'),fat:num('nr_f'),
    meal_type:val('nr_meal'),goal:val('nr_goal')||null,ingredients:val('nr_ing'),steps:val('nr_steps'),link:val('nr_link')};
  if(!body.name)return toast('Name fehlt');if(!body.kcal)return toast('Kalorien angeben');
  const r=await API.post('/recipes',body);
  if(r.status===200){closeModal();toast('Rezept gespeichert ✓');RECIPE_FILTER.goal='all';drawRecipes();}else toast(r.data?.error||'Fehler');}
function openLogFood(){
  openSheet('Essen hinzufügen',`
    <div class="seg" style="margin-bottom:16px">
      <button id="lf_t1" class="on" onclick="lfTab(1)">Aus Liste</button>
      <button id="lf_t2" onclick="lfTab(2)">Schnell</button>
      <button id="lf_t3" onclick="lfTab(3)">Neu anlegen</button>
    </div>
    <div id="lfBody"></div>`);lfTab(1);}
function lfTab(t){[1,2,3].forEach(i=>document.getElementById('lf_t'+i).classList.toggle('on',i===t));
  const b=document.getElementById('lfBody');const slot=`<div class="field"><label>Mahlzeit</label><select id="lf_slot"><option>Frühstück</option><option>Mittag</option><option>Abend</option><option>Snack</option><option>Pre/Post Workout</option></select></div>`;
  if(t===1){if(!FOODS.length){b.innerHTML='<div class="empty">Lädt…</div>';return;}
    LF_SELECTED=null;
    b.innerHTML=`
      <div class="field"><label>Lebensmittel suchen</label><input id="lf_search" type="text" placeholder="z.B. Hähnchen, Reis, Quark…" oninput="lfFilter()" autocomplete="off"></div>
      <div id="lf_list" style="max-height:230px;overflow-y:auto;margin-bottom:14px"></div>
      <div id="lf_chosen"></div>`;
    lfFilter();}
  else if(t===2){b.innerHTML=`<div class="info">Schnell-Eintrag: Wenn du nur die Kalorien kennst (z.B. von der Verpackung), trag sie direkt ein. Makros optional.</div>
      <div class="field"><label>Bezeichnung</label><input id="qf_name" placeholder="z.B. Restaurant-Pizza"></div>
      <div class="field"><label>Kalorien (kcal)</label><input id="qf_kcal" type="number" inputmode="numeric" placeholder="z.B. 650"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div class="field"><label>Protein</label><input id="qf_p" type="number" inputmode="numeric" placeholder="g"></div>
        <div class="field"><label>Carbs</label><input id="qf_c" type="number" inputmode="numeric" placeholder="g"></div>
        <div class="field"><label>Fett</label><input id="qf_f" type="number" inputmode="numeric" placeholder="g"></div>
      </div>${slot}
      <button class="btn" onclick="confirmQuickFood()">Hinzufügen</button>`;}
  else{b.innerHTML=`<div class="info">Lege ein eigenes Lebensmittel an – es wird gespeichert und steht dir künftig in der Liste zur Verfügung. Werte pro 100 g.</div>
      <div class="field"><label>Name</label><input id="nf_name" placeholder="z.B. Mein Proteinriegel"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div class="field"><label>Protein /100g</label><input id="nf_p" type="number" inputmode="decimal" placeholder="g"></div>
        <div class="field"><label>Carbs /100g</label><input id="nf_c" type="number" inputmode="decimal" placeholder="g"></div>
        <div class="field"><label>Fett /100g</label><input id="nf_f" type="number" inputmode="decimal" placeholder="g"></div>
      </div>
      <button class="btn" onclick="confirmNewFood()">Speichern &amp; auswählen</button>`;}}
let LF_SELECTED=null;
// Liste live nach Suchtext filtern (häufig genutzte zuerst – FOODS kommt schon so sortiert)
function lfFilter(){const q=(val('lf_search')||'').trim().toLowerCase();
  const el=document.getElementById('lf_list');if(!el)return;
  const matches=FOODS.filter(f=>f.name.toLowerCase().includes(q)).slice(0,40);
  if(!matches.length){el.innerHTML='<div class="empty" style="padding:20px">Nichts gefunden. Tipp: Über „Schnell" kannst du freie Kalorien eintragen oder unter „Neu anlegen" ein eigenes Lebensmittel speichern.</div>';return;}
  el.innerHTML='<div class="rows">'+matches.map(f=>{const i=FOODS.indexOf(f);
    const kcal100=Math.round((f.fat*9+f.carbs*4+f.protein*4)*100);
    return `<div class="row" style="cursor:pointer" onclick="lfPick(${i})"><div class="rl">${esc2(f.name)}${f.owner_id?' ⭐':''}<small>${kcal100} kcal / 100g</small></div><div class="rr" style="color:var(--ink3)">wählen ›</div></div>`;}).join('')+'</div>';}
// Lebensmittel auswählen -> Menge + Makro-Vorschau + Hinzufügen
function lfPick(i){LF_SELECTED=i;const f=FOODS[i];if(!f)return;
  const slot=`<div class="field"><label>Mahlzeit</label><select id="lf_slot"><option>Frühstück</option><option>Mittag</option><option>Abend</option><option>Snack</option><option>Pre/Post Workout</option></select></div>`;
  document.getElementById('lf_chosen').innerHTML=`
    <div class="surface pad" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-weight:600">${esc2(f.name)}</div>
        <button class="minibtn" onclick="lfClear()">ändern</button></div>
      <div class="field"><label>Menge (g/ml)</label><input id="lf_amt" type="number" inputmode="numeric" value="100" oninput="lfCalc()"></div>
      ${slot}<div class="macro-row" id="lf_out"></div>
    </div>
    <button class="btn" onclick="confirmLogFood()">Hinzufügen</button>`;
  lfCalc();
  // Liste & Suche ausblenden, damit der Fokus auf der Auswahl liegt
  const ls=document.getElementById('lf_list');if(ls)ls.style.display='none';
  const sf=document.getElementById('lf_search');if(sf)sf.closest('.field').style.display='none';}
function lfClear(){LF_SELECTED=null;document.getElementById('lf_chosen').innerHTML='';
  const ls=document.getElementById('lf_list');if(ls)ls.style.display='';
  const sf=document.getElementById('lf_search');if(sf){sf.closest('.field').style.display='';sf.focus();}}
function lfCalc(){if(LF_SELECTED==null)return;const f=FOODS[LF_SELECTED];if(!f)return;const a=parseFloat(val('lf_amt'))||0;
  const fat=f.fat*a,carb=f.carbs*a,prot=f.protein*a,kc=fat*9+carb*4+prot*4;
  const out=document.getElementById('lf_out');if(out)out.innerHTML=`<div class="macro kcal"><div class="v">${Math.round(kc)}</div><div class="k">kcal</div></div><div class="macro"><div class="v">${prot.toFixed(1)}<em>g</em></div><div class="k">Protein</div></div><div class="macro"><div class="v">${carb.toFixed(1)}<em>g</em></div><div class="k">Carbs</div></div><div class="macro"><div class="v">${fat.toFixed(1)}<em>g</em></div><div class="k">Fett</div></div>`;}
async function confirmLogFood(){if(LF_SELECTED==null)return toast('Bitte ein Lebensmittel wählen');
  const f=FOODS[LF_SELECTED];const a=parseFloat(val('lf_amt'))||0;
  const fat=f.fat*a,carb=f.carbs*a,prot=f.protein*a,kc=fat*9+carb*4+prot*4;
  await API.post('/foodlog',{user_id:VIEW_USER,date:today(),meal_slot:val('lf_slot'),food:f.name,amount:a,kcal:kc,fat,carbs:carb,protein:prot});
  closeModal();const fr=await API.get('/foodlog/'+VIEW_USER+'?date='+today());renderDiet.foodlog=fr.data;drawTrack();toast('Getrackt ✓');}
async function confirmQuickFood(){const name=val('qf_name')||'Schnell-Eintrag';const kc=num('qf_kcal');
  if(kc==null)return toast('Bitte Kalorien eingeben');
  await API.post('/foodlog',{user_id:VIEW_USER,date:today(),meal_slot:val('lf_slot'),food:name,amount:1,kcal:kc,fat:num('qf_f')||0,carbs:num('qf_c')||0,protein:num('qf_p')||0});
  closeModal();const fr=await API.get('/foodlog/'+VIEW_USER+'?date='+today());renderDiet.foodlog=fr.data;drawTrack();toast('Getrackt ✓');}
async function confirmNewFood(){const name=val('nf_name');if(!name)return toast('Name fehlt');
  const r=await API.post('/foods',{name,protein:num('nf_p')||0,carbs:num('nf_c')||0,fat:num('nf_f')||0,per100:true});
  if(r.status!==200)return toast('Fehler');
  // Foods neu laden, damit das neue gleich auswählbar ist
  const fr=await API.get('/foods');FOODS=fr.data?.foods||[];
  toast('Gespeichert ✓');lfTab(1);
  // das neue Lebensmittel direkt auswählen
  setTimeout(()=>{const idx=FOODS.findIndex(f=>f.name===name);if(idx>=0)lfPick(idx);},60);}
function openLogFromPlan(){const meals=(renderDiet.meals||[]).filter(m=>m.day_type===DIET);
  if(!meals.length)return toast('Kein Meal Plan vorhanden');
  openSheet('Mahlzeit übernehmen',`<div class="info">Übernimm eine geplante Mahlzeit mit einem Tipp als "gegessen".</div>`+
    meals.map(m=>{const mk=m.items.reduce((s,it)=>s+(it.kcal||0),0);
      return `<button class="btn sec" style="margin-bottom:8px;text-align:left" onclick="logFromMeal(${m.id})">Meal ${m.meal_no}: ${m.label||''} · ${Math.round(mk)} kcal</button>`;}).join(''));}
async function logFromMeal(mealId){await API.post('/foodlog/frommeal/'+mealId,{date:today()});
  closeModal();const fr=await API.get('/foodlog/'+VIEW_USER+'?date='+today());renderDiet.foodlog=fr.data;drawTrack();toast('Übernommen ✓');}

function setDiet(t){DIET=t;drawDiet();}
function drawDiet(){const meals=(renderDiet.meals||[]).filter(m=>m.day_type===DIET);
  let kc=0,f=0,c=0,p=0;meals.forEach(m=>m.items.forEach(it=>{kc+=it.kcal||0;f+=it.fat||0;c+=it.carbs||0;p+=it.protein||0;}));
  const el=document.getElementById('dietBody');
  let h=macroRow(kc,p,c,f);
  h+=`<div class="seg" style="margin-bottom:14px"><button class="${DIET==='training'?'on':''}" onclick="setDiet('training')">Trainingstag</button><button class="${DIET==='rest'?'on':''}" onclick="setDiet('rest')">Ruhetag</button></div>`;
  if(!meals.length){h+='<div class="empty"><div class="ei">🍽️</div>Noch kein Meal Plan.</div>';el.innerHTML=h;return;}
  h+=meals.map(m=>{const mk=m.items.reduce((s,it)=>s+(it.kcal||0),0);
    return `<div class="meal"><div class="meal-h"><div class="ml"><div class="n">Meal ${m.meal_no}</div><div class="t">${m.label||''}</div></div><div class="kc">${Math.round(mk)}<em>kcal</em></div></div>
      ${m.items.map(it=>`<div class="fi"><div><div class="fn">${it.food}</div><div class="fa">${it.amount} g/ml</div>${it.notes?`<div class="fm">${it.notes}</div>`:''}</div><div class="fmac">${Math.round(it.kcal||0)} kcal<br>${r1(it.protein)}P·${r1(it.carbs)}C·${r1(it.fat)}F</div></div>`).join('')}</div>`;}).join('');
  el.innerHTML=h;}

// ===== VERLAUF / ANALYSE =====
async function renderTracker(v){
  v.innerHTML=`<div class="page on"><div class="h1">Verlauf</div><div class="sub">Deine Entwicklung</div>
    <div id="anaBox"><div class="spinner"></div></div></div>`;
  const ci=await API.get('/checkins/'+VIEW_USER);
  const checkins=(ci.data?.checkins||[]);
  const box=document.getElementById('anaBox');
  let h='';
  // Hinweis, wenn noch zu wenig Daten
  const wWeights=checkins.filter(c=>c.weight);
  if(checkins.length<2){
    h+=`<div class="info" style="margin-bottom:16px">📊 Deine Auswertungen erscheinen hier, sobald du ein paar Tage Check-ins gemacht hast (auf der Startseite: Gewicht, Schlaf, Schritte, Wasser).</div>`;
  }
  // GEWICHT
  if(wWeights.length>=2){
    const series=wWeights.slice(0,30).reverse().map(c=>c.weight);
    const diff=(series[series.length-1]-series[0]);
    h+=`<div class="chart-card"><div class="ch-h"><div class="t">Gewicht</div><div class="v">${diff>0?'+':''}${diff.toFixed(1)} kg über ${series.length} Einträge</div></div>${sparkline(series)}</div>`;
  }
  // SCHLAF
  const sl=checkins.filter(c=>c.sleep).slice(0,30).reverse().map(c=>c.sleep);
  if(sl.length>=2){const avg=(sl.reduce((a,b)=>a+b,0)/sl.length).toFixed(1);
    h+=`<div class="chart-card"><div class="ch-h"><div class="t">Schlaf</div><div class="v">Ø ${avg} h</div></div>${sparkline(sl)}</div>`;}
  // SCHRITTE
  const st=checkins.filter(c=>c.steps).slice(0,30).reverse().map(c=>c.steps);
  if(st.length>=2){const avg=Math.round(st.reduce((a,b)=>a+b,0)/st.length);
    h+=`<div class="chart-card"><div class="ch-h"><div class="t">Schritte</div><div class="v">Ø ${avg.toLocaleString('de-DE')}/Tag</div></div>${sparkline(st)}</div>`;}
  // WASSER
  const wa=checkins.filter(c=>c.water).slice(0,30).reverse().map(c=>c.water);
  if(wa.length>=2){const avg=(wa.reduce((a,b)=>a+b,0)/wa.length).toFixed(1);
    h+=`<div class="chart-card"><div class="ch-h"><div class="t">Wasser</div><div class="v">Ø ${avg} L/Tag</div></div>${sparkline(wa)}</div>`;}

  // KÖRPER & PHYSIK – eigener Bereich, adaptiv vorgestellt
  h+=`<div class="section-label">Körper &amp; Physik</div>`;
  if(isBeginner()){
    h+=`<div class="info" style="margin-bottom:10px">Für den Anfang reicht dein Gewicht. Wenn du weiter bist, kannst du hier auch Körpermaße und Fortschrittsfotos festhalten – beides hilft deinem Coach, deinen Fortschritt zu sehen.</div>`;
  }
  h+=`<div class="quick" style="margin-bottom:16px">
      <button class="qcard" onclick="openMeasure()"><span class="ic">📏</span><div class="t">Körpermaße</div><div class="d">Taille, Arm, Brust…</div></button>
      <button class="qcard" onclick="openPhotos()"><span class="ic">📸</span><div class="t">Fortschrittsfotos</div><div class="d">Physik vergleichen</div></button>
    </div>`;

  // CHECK-IN HISTORIE (kompakt, Anzeige)
  h+=`<div class="section-label">Check-in Historie</div><div id="histlist"><div class="spinner"></div></div>`;
  h+=`<div class="info" style="margin-top:16px;display:flex;align-items:center;gap:12px"><div style="flex:1">🍏 Du nutzt Apple Health? Importiere Gewicht, Schritte &amp; Schlaf für viele Tage auf einmal.</div></div>
    <button class="btn sec" style="margin-top:10px" onclick="openHealthImport()">🍏 Apple Health importieren</button>`;
  box.innerHTML=h;
  loadHist();}
const CARDIO_KINDS=['Laufen','Joggen','Rad','Spinning','Rudern','Gehen','Wandern','Schwimmen','Crosstrainer','Stepper','Seilspringen','HIIT','Crossfit'];
const CARDIO_DIST=['Laufen','Joggen','Rad','Gehen','Wandern','Schwimmen']; // Sportarten mit sinnvoller Distanz
function openCardio(){openSheet('Cardio-Einheit',`
  <div class="field"><label>Sportart</label><select id="c_kind" onchange="cardioKindChange()">${CARDIO_KINDS.map(k=>`<option>${k}</option>`).join('')}</select></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="field"><label>Minuten</label><input id="c_min" type="number" inputmode="numeric" placeholder="30" oninput="cardioPace()"></div>
    <div class="field" id="c_distwrap"><label>Distanz (km, opt.)</label><input id="c_dist" type="number" step="0.1" inputmode="decimal" placeholder="5" oninput="cardioPace()"></div>
  </div>
  <div id="c_pace" style="font-size:13px;color:var(--ink2);margin:-4px 0 12px;min-height:16px"></div>
  <div class="field"><label>Intensität</label><select id="c_int"><option value="leicht">Leicht (locker, Gespräch möglich)</option><option value="moderat" selected>Moderat</option><option value="hart">Hart (fordernd, außer Atem)</option></select></div>
  <div class="field"><label>Puls Ø (opt.)</label><input id="c_hr" type="number" inputmode="numeric" placeholder="z.B. 145"></div>
  <div class="info">Die Kalorien werden automatisch geschätzt. Hartes/moderates Cardio fließt in deine Erholungs-Anzeige ein – so weiß die App, ob du morgen voll Kraft trainieren kannst.</div>
  <button class="btn" onclick="confirmCardio()">Speichern</button>`);cardioKindChange();}
function cardioKindChange(){const k=val('c_kind');const w=document.getElementById('c_distwrap');
  if(w)w.style.display=CARDIO_DIST.includes(k)?'block':'none';cardioPace();}
function cardioPace(){const el=document.getElementById('c_pace');if(!el)return;
  const min=parseFloat(val('c_min'))||0,dist=parseFloat(val('c_dist'))||0;const k=val('c_kind');
  if(CARDIO_DIST.includes(k)&&min>0&&dist>0){
    const pace=min/dist;const mm=Math.floor(pace);const ss=Math.round((pace-mm)*60).toString().padStart(2,'0');
    const speed=(dist/(min/60)).toFixed(1);
    el.textContent=`Tempo: ${mm}:${ss} min/km · ${speed} km/h`;
  }else el.textContent='';}
async function confirmCardio(){const body={user_id:VIEW_USER,date:today(),kind:val('c_kind'),minutes:num('c_min'),distance_km:num('c_dist'),avg_hr:num('c_hr'),intensity:val('c_int')};
  if(!body.minutes)return toast('Bitte Minuten eingeben');
  const r=await API.post('/cardio',body);if(r.status===200){closeModal();toast('Cardio gespeichert · '+r.data.kcal+' kcal ✓');
    drawCardioTab();}else toast('Fehler');}

// ===== CARDIO-TAB im Training =====
async function drawCardioTab(){const b=document.getElementById('workoutBody');b.innerHTML='<div class="spinner"></div>';
  const r=await API.get('/cardio/'+VIEW_USER);const all=r.data?.cardio||[];
  // Wochenstatistik (letzte 7 Tage)
  const weekAgo=new Date(Date.now()-7*864e5).toISOString().slice(0,10);
  const wk=all.filter(c=>c.date>=weekAgo);
  const wkMin=wk.reduce((a,c)=>a+(c.minutes||0),0);
  const wkKcal=wk.reduce((a,c)=>a+(c.kcal||0),0);
  const wkKm=wk.reduce((a,c)=>a+(c.distance_km||0),0);
  let h=`<button class="btn" onclick="openCardio()">+ Cardio-Einheit erfassen</button>`;
  h+=`<div class="section-label">Diese Woche</div>
    <div class="tiles">
      <div class="tile"><div class="v">${wkMin}<em> min</em></div><div class="l">Cardio-Zeit</div></div>
      <div class="tile"><div class="v">${Math.round(wkKcal)}<em> kcal</em></div><div class="l">verbrannt</div></div>
      ${wkKm>0?`<div class="tile"><div class="v">${wkKm.toFixed(1)}<em> km</em></div><div class="l">Distanz</div></div>`:''}
    </div>`;
  if(!all.length){h+='<div class="empty"><div class="ei">🏃</div>Noch keine Cardio-Einheiten.<br>Erfasse deine erste oben.</div>';}
  else{h+='<div class="section-label">Verlauf</div><div class="rows">'+all.slice(0,40).map(c=>{
    const dt=new Date(c.date+'T00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    const pace=(CARDIO_DIST.includes(c.kind)&&c.minutes&&c.distance_km)?` · ${(c.minutes/c.distance_km).toFixed(1)} min/km`:'';
    const icon=({Laufen:'🏃',Joggen:'🏃',Rad:'🚴',Spinning:'🚴',Rudern:'🚣',Gehen:'🚶',Wandern:'🥾',Schwimmen:'🏊',Crosstrainer:'🏋️',Stepper:'🪜',Seilspringen:'🤸',HIIT:'🔥',Crossfit:'🔥'})[c.kind]||'🏃';
    return `<div class="row"><div class="rl">${icon} ${c.kind}<small>${dt} · ${c.minutes||0} min${c.distance_km?' · '+c.distance_km+' km':''}${pace} · ${c.intensity||'moderat'}</small></div><div class="rr">${Math.round(c.kcal||0)} kcal<br><button class="minibtn red" style="padding:3px 10px;margin-top:4px" onclick="delCardioTab(${c.id})">Entfernen</button></div></div>`;}).join('')+'</div>';}
  b.innerHTML=h;}
async function delCardioTab(id){await API.del('/cardio/'+id);drawCardioTab();toast('Entfernt');}

// KÖRPERMASSE
const MEASURE_FIELDS=[['waist','Taille'],['chest','Brust'],['arm','Arm'],['thigh','Bein'],['hips','Hüfte'],['shoulders','Schultern'],['neck','Nacken'],['body_fat','Körperfett %']];
// ===== APPLE HEALTH IMPORT =====
function openHealthImport(){openSheet('Apple Health importieren',`
  <div class="info">Übertrage Gewicht, Schritte und Schlaf aus Apple Health – für viele Tage auf einmal. Deine manuell eingetragenen Werte bleiben dabei erhalten.</div>
  <div class="section-label">So geht's auf dem iPhone</div>
  <div class="surface pad" style="font-size:14px;line-height:1.7;margin-bottom:16px">
    1. Öffne die <b>Health</b>-App (Health/Apple Health).<br>
    2. Tippe oben rechts auf dein <b>Profilbild</b>.<br>
    3. Ganz unten: <b>„Alle Gesundheitsdaten exportieren"</b>.<br>
    4. Es entsteht eine ZIP-Datei – <b>entpacke</b> sie und wähle darin die Datei <b>„Export.xml"</b>.<br>
    5. Lade diese Datei hier hoch. 👇
  </div>
  <input type="file" id="health_file" accept=".xml,text/xml" style="display:none" onchange="handleHealthFile(event)">
  <button class="btn" onclick="document.getElementById('health_file').click()">📂 Export.xml auswählen</button>
  <div id="health_status" style="margin-top:14px"></div>
  <label style="display:flex;align-items:center;gap:10px;margin-top:18px;font-size:14px">
    <input type="checkbox" id="health_rem" ${ME.health_reminder?'checked':''} onchange="toggleHealthReminder(this.checked)" style="width:auto">
    Wöchentlich erinnern, neue Health-Daten zu importieren
  </label>
  <div style="font-size:12px;color:var(--ink3);margin-top:8px">Kein iPhone/Apple Health? Kein Problem – du kannst alle Werte auch direkt auf der Startseite eintragen.</div>`);}

// Datei im Browser lesen und parsen (nur die Tageswerte gehen an den Server – klein & schnell)
function handleHealthFile(ev){const file=ev.target.files&&ev.target.files[0];if(!file)return;
  const st=document.getElementById('health_status');
  st.innerHTML='<div class="spinner"></div><div style="text-align:center;color:var(--ink2);font-size:13px">Datei wird gelesen…</div>';
  const reader=new FileReader();
  reader.onerror=()=>{st.innerHTML='<div class="info" style="background:var(--red-soft);color:var(--red)">Datei konnte nicht gelesen werden. Stelle sicher, dass es die Export.xml ist.</div>';};
  reader.onload=async()=>{
    try{
      const parsed=parseHealthXML(reader.result);
      const dayCount=Object.keys(parsed.days).length;
      if(!dayCount){st.innerHTML='<div class="info">Keine passenden Daten (Gewicht/Schritte/Schlaf) in der Datei gefunden. Hast du die richtige Export.xml gewählt?</div>';return;}
      st.innerHTML=`<div class="info">Gefunden: <b>${parsed.stats.weightDays}</b> Tage Gewicht, <b>${parsed.stats.stepDays}</b> Tage Schritte, <b>${parsed.stats.sleepDays}</b> Tage Schlaf.<br>Insgesamt ${dayCount} Tage werden importiert.</div>
        <button class="btn" onclick='doHealthImport(${JSON.stringify(parsed.days).replace(/'/g,"&#39;")})'>${dayCount} Tage jetzt importieren</button>`;
    }catch(e){console.error(e);st.innerHTML='<div class="info" style="background:var(--red-soft);color:var(--red)">Die Datei konnte nicht verarbeitet werden. Ist es die Export.xml aus Apple Health?</div>';}
  };
  reader.readAsText(file);}

// Kompakter XML-Parser (Browser-Variante des Server-Moduls): Gewicht (letzter/Tag),
// Schritte (Summe/Tag), Schlaf (Std., dem Aufwach-Tag zugeordnet, nur echte Schlafphasen).
function parseHealthXML(xml){
  const dayOf=s=>{const m=(s||'').match(/^(\d{4}-\d{2}-\d{2})/);return m?m[1]:null;};
  const norm=x=>{const m=(x||'').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\s*([+-]\d{2})(\d{2})?/);return m?`${m[1]}T${m[2]}${m[3]}:${m[4]||'00'}`:null;};
  const weight={},steps={},sleepMs={};let count=0;
  for(const mt of xml.matchAll(/<Record\b([^>]*)>/g)){
    const tag=mt[1];const a={};for(const m of tag.matchAll(/(\w+)="([^"]*)"/g))a[m[1]]=m[2];count++;
    const t=a.type;if(!t)continue;
    if(t==='HKQuantityTypeIdentifierBodyMass'){const d=dayOf(a.startDate||a.endDate),v=parseFloat(a.value);if(d&&!isNaN(v))weight[d]=v;}
    else if(t==='HKQuantityTypeIdentifierStepCount'){const d=dayOf(a.startDate||a.endDate),v=parseFloat(a.value);if(d&&!isNaN(v))steps[d]=(steps[d]||0)+v;}
    else if(t==='HKCategoryTypeIdentifierSleepAnalysis'){if(!/Asleep/i.test(a.value||''))continue;const s=norm(a.startDate),e=norm(a.endDate);if(!s||!e)continue;const ms=Math.max(0,Date.parse(e)-Date.parse(s));if(ms<=0)continue;const d=dayOf(a.endDate||a.startDate);if(d)sleepMs[d]=(sleepMs[d]||0)+ms;}
  }
  const days={};const ens=d=>(days[d]=days[d]||{});
  for(const[d,v]of Object.entries(weight))ens(d).weight=Math.round(v*10)/10;
  for(const[d,v]of Object.entries(steps))ens(d).steps=Math.round(v);
  for(const[d,ms]of Object.entries(sleepMs))ens(d).sleep=Math.round(ms/3600000*10)/10;
  return{days,stats:{records:count,weightDays:Object.keys(weight).length,stepDays:Object.keys(steps).length,sleepDays:Object.keys(sleepMs).length}};}

async function doHealthImport(days){const st=document.getElementById('health_status');
  st.innerHTML='<div class="spinner"></div>';
  const r=await API.post('/health-import/'+VIEW_USER,{days});
  if(r.status===200){
    if(ME)ME.last_health_import=new Date().toISOString();
    st.innerHTML=`<div class="info" style="background:var(--green-soft,#e7f7ec)">✓ Fertig! ${r.data.created} neue Tage, ${r.data.updated} ergänzt. Deine Auswertungen im Verlauf sind aktualisiert.</div>`;
    toast('Health-Daten importiert ✓');
  }else st.innerHTML='<div class="info" style="background:var(--red-soft);color:var(--red)">Import fehlgeschlagen. Bitte erneut versuchen.</div>';}

async function toggleHealthReminder(on){await API.post('/health-reminder',{enabled:on});if(ME)ME.health_reminder=on?1:0;
  toast(on?'Erinnerung aktiviert ✓':'Erinnerung deaktiviert');}

async function openMeasure(){const r=await API.get('/measurements/'+VIEW_USER);const list=r.data?.measurements||[];const last=list[0]||{};
  let h=`<div class="info">Trag ein, was du misst – leer lassen ist okay. Einheit: cm (Körperfett in %).</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">`;
  MEASURE_FIELDS.forEach(([k,lbl])=>{h+=`<div class="field"><label>${lbl}</label><input id="ms_${k}" type="number" step="0.1" inputmode="decimal" value="" placeholder="${last[k]??'–'}"></div>`;});
  h+=`</div><button class="btn" onclick="saveMeasure()">Speichern</button>`;
  // Verlauf der wichtigsten Maße
  if(list.length>=2){h+=`<div class="section-label">Verlauf Taille</div>`;
    const waists=list.filter(m=>m.waist).slice(0,20).reverse().map(m=>m.waist);
    if(waists.length>=2)h+=`<div class="chart-card">${sparkline(waists)}</div>`;}
  if(list.length){h+=`<div class="section-label">Einträge</div><div class="rows">`+list.slice(0,8).map(m=>{
    const dt=new Date(m.date+'T00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
    const parts=MEASURE_FIELDS.filter(([k])=>m[k]!=null).map(([k,l])=>`${l} ${m[k]}`);
    return `<div class="row"><div class="rl">${dt}</div><div class="rr" style="font-size:13px">${parts.join(' · ')||'–'}</div></div>`;}).join('')+`</div>`;}
  openSheet('Körpermaße',h);}
async function saveMeasure(){const body={user_id:VIEW_USER,date:today()};let any=false;
  MEASURE_FIELDS.forEach(([k])=>{const v=num('ms_'+k);if(v!=null){body[k]=v;any=true;}});
  if(!any)return toast('Bitte mindestens einen Wert eingeben');
  const r=await API.post('/measurements',body);if(r.status===200){closeModal();toast('Maße gespeichert ✓');}else toast('Fehler');}

// FORTSCHRITTSFOTOS
async function openPhotos(){const r=await API.get('/photos/'+VIEW_USER);const list=r.data?.photos||[];
  let h=`<div class="info">Mach regelmäßig Fotos (z.B. alle 2 Wochen, gleiche Pose &amp; Licht), um deine Veränderung zu sehen. Fotos bleiben privat.</div>
    <label class="btn" style="display:block;text-align:center;cursor:pointer">📸 Foto aufnehmen / auswählen
      <input type="file" accept="image/*" capture="environment" style="display:none" onchange="handlePhoto(event)"></label>
    <div style="display:flex;gap:8px;margin:12px 0">
      <select id="ph_pose" class="field" style="flex:1;margin:0"><option value="front">Vorne</option><option value="side">Seite</option><option value="back">Hinten</option></select>
    </div>`;
  if(list.length){h+=`<div class="section-label">Deine Fotos</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">`+
    list.map(p=>{const dt=new Date(p.date+'T00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
      return `<div style="position:relative"><img src="" data-pid="${p.id}" onclick="viewPhoto(${p.id})" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:10px;background:var(--surface2);cursor:pointer" loading="lazy">
        <div style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;padding:2px 6px;border-radius:6px">${dt} ${({front:'V',side:'S',back:'H'}[p.pose]||'')}</div>
        <button onclick="delPhoto(${p.id})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:24px;height:24px">✕</button></div>`;}).join('')+`</div>`;
  }else h+=`<div class="empty"><div class="ei">📸</div>Noch keine Fotos.</div>`;
  openSheet('Fortschrittsfotos',h);
  // Thumbnails laden (einzeln, da Bilddaten separat)
  list.forEach(async p=>{const pr=await API.get('/photos/'+VIEW_USER+'/'+p.id);
    const img=document.querySelector(`img[data-pid="${p.id}"]`);if(img&&pr.data?.photo)img.src=pr.data.photo.image;});}
function handlePhoto(ev){const file=ev.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=()=>{
    const img=new Image();img.onload=()=>{
      // verkleinern auf max 800px Breite, als JPEG ~0.7 -> unter 2MB
      const max=800;let w=img.width,hh=img.height;if(w>max){hh=hh*max/w;w=max;}
      const cv=document.createElement('canvas');cv.width=w;cv.height=hh;
      cv.getContext('2d').drawImage(img,0,0,w,hh);
      const data=cv.toDataURL('image/jpeg',0.7);
      uploadPhoto(data);
    };img.src=reader.result;};
  reader.readAsDataURL(file);}
async function uploadPhoto(data){toast('Lädt hoch…');
  const r=await API.post('/photos',{user_id:VIEW_USER,date:today(),pose:val('ph_pose')||'front',image:data});
  if(r.status===200){toast('Foto gespeichert ✓');openPhotos();}else toast(r.data?.error||'Fehler');}
async function viewPhoto(id){const r=await API.get('/photos/'+VIEW_USER+'/'+id);if(r.status!==200)return;
  const p=r.data.photo;const dt=new Date(p.date+'T00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'long',year:'numeric'});
  openSheet(dt,`<img src="${p.image}" style="width:100%;border-radius:14px"><button class="btn sec" style="margin-top:14px" onclick="openPhotos()">Zurück</button>`);}
async function delPhoto(id){if(!window.confirm('Foto löschen?'))return;
  const r=await API.del('/photos/'+id);if(r.status===200){toast('Gelöscht');openPhotos();}}

async function loadHist(){const r=await API.get('/checkins/'+VIEW_USER);const h=r.data?.checkins||[];
  const el=document.getElementById('histlist');
  if(!h.length){el.innerHTML='<div class="empty"><div class="ei">📈</div>Noch keine Einträge.</div>';return;}
  el.innerHTML='<div class="rows">'+h.map(c=>{const dt=new Date(c.date+'T00:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
    const parts=[];if(c.weight)parts.push(c.weight+' kg');if(c.steps)parts.push(Math.round(c.steps)+' Schritte');if(c.sleep)parts.push(c.sleep+' h');
    return `<div class="row"><div class="rl">${dt}${c.coach_notes?'<small style="color:var(--red)">Coach: '+c.coach_notes+'</small>':''}</div><div class="rr">${parts.join(' · ')||'–'}</div></div>`;}).join('')+'</div>';}

// ===== ADMIN: NUTZERVERWALTUNG =====
let ADMIN_USERS=[],ADMIN_COACHES=[];
async function renderAdmin(v){v.innerHTML=`<div class="page on"><div class="h1">Verwaltung</div><div class="sub">Nutzer &amp; Rollen</div><div id="adminBox"><div class="spinner"></div></div></div>`;
  const [ur,cr]=await Promise.all([API.get('/admin/users'),API.get('/admin/coaches')]);
  if(ur.status!==200){document.getElementById('adminBox').innerHTML='<div class="empty">Kein Zugriff.</div>';return;}
  ADMIN_USERS=ur.data.users;ADMIN_COACHES=cr.data?.coaches||[];const c=ur.data.counts;
  let h=`<div class="tiles" style="margin-bottom:8px">
    <div class="tile"><div class="v">${c.admin||0}</div><div class="l">Admins 🛡️</div></div>
    <div class="tile"><div class="v">${c.coach||0}</div><div class="l">Coaches</div></div>
    <div class="tile"><div class="v">${c.athlete||0}</div><div class="l">Athleten</div></div>
  </div>
  <button class="btn" style="margin-bottom:16px" onclick="adminNewUser()">+ Nutzer anlegen</button>`;
  const roleGroups=[['admin','🛡️ Admins'],['coach','👤 Coaches'],['athlete','🏋️ Athleten']];
  roleGroups.forEach(([role,label])=>{const us=ADMIN_USERS.filter(u=>u.role===role);if(!us.length)return;
    h+=`<div class="section-label">${label} (${us.length})</div><div style="margin-bottom:16px">`+
    us.map(u=>{const sub=role==='athlete'?(u.coach_name?'Coach: '+u.coach_name:'kein Coach'):(role==='coach'?u.athlete_count+' Athleten':'Voller Zugriff');
      return `<div class="surface pad" style="margin-bottom:8px;display:flex;align-items:center;gap:12px" onclick="adminEditUser(${u.id})">
        <div style="flex:1;min-width:0"><div style="font-weight:600">${esc2(u.name)}${u.id===ME.id?' <span class="pill" style="background:var(--surface2)">du</span>':''}</div>
          <div style="color:var(--ink2);font-size:13px">${esc2(u.email)} · ${sub}</div></div>
        <div style="color:var(--ink3)">›</div></div>`;}).join('')+`</div>`;});
  document.getElementById('adminBox').innerHTML=h;}
function esc2(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function adminNewUser(){openSheet('Neuen Nutzer anlegen',`
  <div class="field"><label>Name</label><input id="au_name" placeholder="Vor- und Nachname"></div>
  <div class="field"><label>E-Mail</label><input id="au_email" type="email" placeholder="name@mail.com"></div>
  <div class="field"><label>Startpasswort</label><input id="au_pw" placeholder="min. 6 Zeichen"></div>
  <div class="field"><label>Rolle</label><select id="au_role" onchange="auRoleChange()">
    <option value="athlete">Athlet</option><option value="coach">Coach</option><option value="admin">Admin</option></select></div>
  <div class="field" id="au_coachwrap"><label>Coach zuordnen (optional)</label><select id="au_coach"><option value="">– kein Coach –</option>${ADMIN_COACHES.map(c=>`<option value="${c.id}">${esc2(c.name)}</option>`).join('')}</select></div>
  <button class="btn" onclick="adminCreateUser()">Anlegen</button>`);}
function auRoleChange(){document.getElementById('au_coachwrap').style.display=val('au_role')==='athlete'?'block':'none';}
async function adminCreateUser(){const body={name:val('au_name'),email:val('au_email'),password:val('au_pw'),role:val('au_role'),coach_id:val('au_coach')||null};
  const r=await API.post('/admin/users',body);
  if(r.status===200){closeModal();toast('Nutzer angelegt ✓');go('admin');}else toast(r.data?.error||'Fehler');}
function adminEditUser(id){const u=ADMIN_USERS.find(x=>x.id===id);if(!u)return;
  let h=`<div class="info">${esc2(u.email)} · aktuell <b>${({admin:'Admin',coach:'Coach',athlete:'Athlet'})[u.role]}</b></div>
    <div class="field"><label>Rolle ändern</label><select id="eu_role">
      <option value="athlete"${u.role==='athlete'?' selected':''}>Athlet</option>
      <option value="coach"${u.role==='coach'?' selected':''}>Coach</option>
      <option value="admin"${u.role==='admin'?' selected':''}>Admin</option></select></div>
    <button class="btn" onclick="adminSaveRole(${id})">Rolle speichern</button>`;
  if(u.role==='athlete'){h+=`<div class="field" style="margin-top:14px"><label>Coach zuordnen</label><select id="eu_coach"><option value="">– kein Coach –</option>${ADMIN_COACHES.map(c=>`<option value="${c.id}"${u.coach_id===c.id?' selected':''}>${esc2(c.name)}</option>`).join('')}</select></div>
    <button class="btn sec" onclick="adminSaveCoach(${id})">Zuordnung speichern</button>`;}
  h+=`<div class="section-label">Passwort</div>
    <div class="field"><input id="eu_pw" placeholder="Neues Passwort (min. 6 Zeichen)"></div>
    <button class="btn sec" onclick="adminResetPw(${id})">🔒 Passwort zurücksetzen</button>`;
  if(id!==ME.id)h+=`<button class="btn sec" style="margin-top:18px;color:var(--red)" onclick="adminDeleteUser(${id},'${esc(u.name)}')">🗑 Nutzer löschen</button>`;
  openSheet('Nutzer: '+esc2(u.name),h);}
async function adminResetPw(id){const next=val('eu_pw');if(!next||next.length<6)return toast('Mindestens 6 Zeichen');
  const r=await API.post('/admin/users/'+id+'/resetpw',{next});
  if(r.status===200){closeModal();toast('Passwort zurückgesetzt ✓');}else toast(r.data?.error||'Fehler');}
async function adminSaveRole(id){const r=await API.put('/admin/users/'+id+'/role',{role:val('eu_role')});
  if(r.status===200){closeModal();toast('Rolle geändert ✓');go('admin');}else toast(r.data?.error||'Fehler');}
async function adminSaveCoach(id){const r=await API.put('/admin/users/'+id+'/coach',{coach_id:val('eu_coach')||null});
  if(r.status===200){closeModal();toast('Zuordnung gespeichert ✓');go('admin');}else toast(r.data?.error||'Fehler');}
async function adminDeleteUser(id,name){if(!window.confirm('"'+name+'" wirklich löschen? Das kann nicht rückgängig gemacht werden.'))return;
  const r=await API.del('/admin/users/'+id);
  if(r.status===200){closeModal();toast('Nutzer gelöscht');go('admin');}else toast(r.data?.error||'Fehler');}

// ===== COACH: ATHLETEN =====
async function renderAthletes(v){v.innerHTML=`<div class="page on"><div class="h1">${ME.role==='admin'?'Athleten':'Übersicht'}</div><div class="sub">Dein Coaching auf einen Blick</div>
  <div id="ovBox"><div class="spinner"></div></div></div>`;
  const [ov,al]=await Promise.all([API.get('/coach/overview'),API.get('/athletes')]);
  const o=ov.data||{};const list=al.data?.athletes||[];ATHLETES_CACHE=list;
  let h='';
  // KENNZAHLEN-KACHELN
  h+=`<div class="tiles" style="margin-bottom:8px">
    <div class="tile"><div class="v">${o.totalAthletes||0}</div><div class="l">Athleten</div></div>
    <div class="tile"><div class="v">${o.activeThisWeek||0}<em> aktiv</em></div><div class="l">diese Woche</div></div>
    <div class="tile"><div class="v" style="color:${o.attention?'var(--red)':'var(--ink)'}">${o.attention||0}</div><div class="l">brauchen Aufmerksamkeit</div></div>
    <div class="tile"><div class="v">${o.trainingsThisWeek||0}</div><div class="l">Trainings/Woche</div></div>
  </div>`;
  // WOCHEN-TREND
  if(o.weeklyTrend&&o.weeklyTrend.some(x=>x>0)){
    h+=`<div class="chart-card"><div class="ch-h"><div class="t">Trainings-Aktivität</div><div class="v">letzte 8 Wochen</div></div>${barchart(o.weeklyTrend)}</div>`;}
  // ZIEL-VERTEILUNG
  const gc=o.goalCounts||{};const totalG=(gc.muscle||0)+(gc.fatloss||0)+(gc.health||0);
  if(totalG>0){h+=`<div class="surface pad" style="margin-bottom:16px"><div style="font-weight:600;margin-bottom:12px">Ziele deiner Athleten</div>`;
    const goalBar=(label,n,col)=>{const pct=totalG?Math.round(n/totalG*100):0;return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${label}</span><span style="color:var(--ink2)">${n}</span></div><div style="height:8px;background:var(--line);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${col};border-radius:4px"></div></div></div>`;};
    h+=goalBar('💪 Muskelaufbau',gc.muscle||0,'var(--red)')+goalBar('🔥 Definition',gc.fatloss||0,'var(--amber)')+goalBar('❤️ Gesundheit',gc.health||0,'var(--green)');
    h+=`</div>`;}
  // JÜNGSTE AKTIVITÄT
  if(o.recentActivity&&o.recentActivity.length){h+=`<div class="section-label">Jüngste Aktivität</div><div class="rows" style="margin-bottom:16px">`+
    o.recentActivity.map(a=>{const dt=new Date(a.date+'T00:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
      return `<div class="row"><div class="rl">${a.name}<small>${a.dayName||'Training'} · ${dt}</small></div><div class="rr">${a.sets} Sätze</div></div>`;}).join('')+`</div>`;}
  // ATHLETEN-LISTE mit Suche
  h+=`<div class="section-label">Alle Athleten (${list.length})</div>`;
  if(list.length>5)h+=`<input id="athSearch" placeholder="🔍 Athlet suchen…" oninput="filterAthletes(this.value)" style="width:100%;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:12px">`;
  h+=`<div id="athList"></div>
    <button class="btn sec" style="margin-top:12px" onclick="addAthlete()">+ Athlet hinzufügen</button>`;
  document.getElementById('ovBox').innerHTML=h;
  drawAthleteList(list);}
let ATHLETES_CACHE=[];
function filterAthletes(q){const f=ATHLETES_CACHE.filter(a=>a.name.toLowerCase().includes(q.toLowerCase()));drawAthleteList(f);}
function drawAthleteList(list){const el=document.getElementById('athList');if(!el)return;
  if(!list.length){el.innerHTML='<div class="empty"><div class="ei">👥</div>Keine Athleten gefunden.</div>';return;}
  el.innerHTML=list.map(a=>{
    const dot=a.attention?'var(--red)':a.trainsThisWeek>0?'var(--green)':'var(--amber)';
    const statusTxt=a.lastTrain?(a.daysSinceTrain===0?'heute trainiert':a.daysSinceTrain===1?'gestern trainiert':'vor '+a.daysSinceTrain+' Tagen'):'noch kein Training';
    return `<div class="surface pad" style="margin-bottom:11px;display:flex;align-items:center;gap:14px" onclick="openDashboard(${a.id})">
      <div style="flex-shrink:0;width:10px;height:10px;border-radius:50%;background:${dot}"></div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:16px">${a.name}${a.attention?' <span class="pill" style="background:var(--red-soft);color:var(--red)">Achtung</span>':''}</div>
        <div style="color:var(--ink2);font-size:13px;margin-top:2px">${statusTxt} · ${a.trainsThisWeek}× diese Woche · ${goalLabel(a.goal)}</div>
      </div>
      <div style="text-align:right;color:var(--ink2);font-size:13px">${a.lastWeight?a.lastWeight+' kg':'–'}<br><span style="color:var(--ink3);font-size:11px">${phaseLabel(a.phase)}</span></div>
    </div>`;}).join('');}
function phaseLabel(p){return{offseason:'Offseason',prep:'Prep',maintain:'Maintain'}[p]||'';}
function addAthlete(){openSheet('Athlet hinzufügen',`
  <div class="seg" style="margin-bottom:16px"><button id="aa_new" class="on" onclick="aaTab('new')">Neu anlegen</button><button id="aa_link" onclick="aaTab('link')">Bestehenden</button></div>
  <div id="aaBody"></div>`);aaTab('new');}
function aaTab(t){document.getElementById('aa_new').classList.toggle('on',t==='new');document.getElementById('aa_link').classList.toggle('on',t==='link');
  const b=document.getElementById('aaBody');
  if(t==='new')b.innerHTML=`<div class="info">Lege direkt einen neuen Athleten an. Gib ihm Login-Daten – er kann das Passwort später selbst ändern.</div>
    <div class="field"><label>Name</label><input id="na_name" placeholder="Vor- und Nachname"></div>
    <div class="field"><label>E-Mail</label><input id="na_email" type="email" placeholder="athlet@mail.com"></div>
    <div class="field"><label>Startpasswort</label><input id="na_pw" placeholder="min. 6 Zeichen"></div>
    <button class="btn" onclick="confirmCreateAthlete()">Athlet anlegen</button>`;
  else b.innerHTML=`<div class="info">Der Athlet hat sich bereits selbst registriert. Gib seine E-Mail ein, um ihn dir zuzuordnen.</div>
    <div class="field"><label>E-Mail</label><input id="addEmail" type="email" placeholder="athlet@mail.com"></div>
    <button class="btn" onclick="confirmAddAthlete()">Zuordnen</button>`;}
async function confirmCreateAthlete(){const body={name:val('na_name'),email:val('na_email'),password:val('na_pw')};
  const r=await API.post('/athletes/create',body);
  if(r.status===200){closeModal();toast('Athlet angelegt ✓');go('athletes');}else toast(r.data?.error||'Fehler');}
async function confirmAddAthlete(){const email=val('addEmail');const r=await API.post('/athletes/add',{email});
  if(r.status===200){closeModal();toast('Zugeordnet ✓');go('athletes');}else toast(r.data?.error||'Fehler');}
async function openAthlete(id,name){COACH_CONTEXT=name;VIEW_USER=id;TODAY=null;PLAN=null;RECIPE_FILTER=null;buildNav();
  const dr=await API.get('/dashboard/'+id);VIEW_USER_PROFILE=dr.data?.athlete||null;
  await loadPlan();await loadToday();go('home');}

// Coach-Dashboard für einen Athleten
async function openDashboard(id){openSheet('Lädt...','<div class="spinner"></div>');
  const [r,fn]=await Promise.all([API.get('/dashboard/'+id),API.get('/flagged-notes/'+id)]);
  if(r.status!==200)return toast('Fehler beim Laden');
  const d=r.data;const a=d.athlete;const flagged=fn.data?.notes||[];
  let h='';
  // Kopf mit Eckdaten
  h+=`<div class="info" style="margin-bottom:14px"><b>${goalLabel(a.goal)}</b> · ${phaseLabel(a.phase)||'keine Phase'} · ${a.days_per_week||'–'}×/Woche · ${({beginner:'Anfänger',intermediate:'Fortgeschritten',advanced:'Profi'}[a.experience]||'')}</div>`;
  // OFFENE BESCHWERDEN (rot hervorgehoben) – haben Priorität
  if(flagged.length){h+=`<div style="background:var(--red-soft);border-radius:14px;padding:14px;margin-bottom:16px">
    <div style="font-weight:700;color:var(--red);margin-bottom:8px">⚠️ ${flagged.length} offene Beschwerde${flagged.length>1?'n':''}</div>`+
    flagged.map(n=>{const dt=new Date(n.date+'T00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
      return `<div style="background:var(--surface);border-radius:10px;padding:10px;margin-bottom:6px">
        <div style="font-size:13px;color:var(--ink2)">${n.exercise_name} · ${dt}</div>
        <div style="font-size:14px;margin:3px 0 6px">${n.note}</div>
        <button class="minibtn" onclick="resolveNote(${n.id},${id})">✓ Als erledigt markieren</button></div>`;}).join('')+`</div>`;}
  // Aktionen
  h+=`<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    <button class="btn" style="flex:1;min-width:120px" onclick="coachOpenPlan(${id},'${esc(a.name)}')">Plan bearbeiten</button>
    <button class="btn sec" style="flex:1;min-width:120px" onclick="coachMessage(${id})">Nachricht</button>
    <button class="btn sec" style="flex:1;min-width:120px" onclick="coachSetPhase(${id},'${a.phase||'offseason'}')">Phase/Ziele</button>
    <button class="btn sec" style="flex:1;min-width:120px" onclick="coachSupp(${id},'${esc(a.name)}')">💊 Supplements</button></div>`;
  // Gewichtsverlauf
  if(d.weights.length>=2){const w=d.weights.slice().reverse().map(x=>x.weight);
    h+=`<div class="section-label">Gewichtsverlauf</div><div class="chart-card">${sparkline(w)}<div style="display:flex;justify-content:space-between;color:var(--ink2);font-size:13px;margin-top:8px"><span>${w[0]} kg</span><span>jetzt: ${w[w.length-1]} kg</span></div></div>`;}
  // Volumen-Trend (Tonnage)
  if(d.volume.length>=2){const vol=d.volume.slice().reverse().map(x=>x.tonnage);
    h+=`<div class="section-label">Trainingsvolumen (kg bewegt/Einheit)</div><div class="chart-card">${barchart(vol)}</div>`;}
  // Letzte Trainings
  h+=`<div class="section-label">Letzte Trainings</div>`;
  if(!d.sessions.length)h+='<div class="info">Noch keine Trainings geloggt.</div>';
  else{h+='<div class="rows">'+d.sessions.map(s=>{const dt=new Date(s.date+'T00:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
    return `<div class="row"><div class="rl">${s.dayName||'Training'}<small>${dt}</small></div><div class="rr">${s.exCount} Übungen · ${s.setCount} Sätze<br><span style="color:var(--ink3);font-size:11px">Top: ${s.topWeight||0} kg</span></div></div>`;}).join('')+'</div>';}
  // Cardio
  if(d.cardio.length){h+=`<div class="section-label">Cardio (14 Tage)</div><div class="rows">`+d.cardio.map(c=>{const dt=new Date(c.date+'T00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    return `<div class="row"><div class="rl">${c.kind}<small>${dt}</small></div><div class="rr">${c.minutes} min · ${Math.round(c.kcal||0)} kcal</div></div>`;}).join('')+'</div>';}
  // Schlaf/Schritte aus Check-ins
  const withData=d.checkins.filter(c=>c.sleep||c.steps);
  if(withData.length){h+=`<div class="section-label">Schlaf &amp; Schritte</div><div class="rows">`+withData.slice(0,7).map(c=>{const dt=new Date(c.date+'T00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    const p=[];if(c.sleep)p.push(c.sleep+' h');if(c.steps)p.push(Math.round(c.steps)+' Schritte');
    return `<div class="row"><div class="rl">${dt}</div><div class="rr">${p.join(' · ')}</div></div>`;}).join('')+'</div>';}
  openSheet(a.name,h);}

function barchart(vals){if(!vals.length)return'';const mx=Math.max(...vals)||1;const w=480,h=110,n=vals.length,bw=Math.min(48,(w-20)/n-8);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${vals.map((v,i)=>{const bh=(v/mx)*(h-24);const x=10+i*((w-20)/n)+( (w-20)/n - bw)/2;const y=h-bh-4;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="var(--red)" opacity="${0.4+0.6*v/mx}"/>`;}).join('')}</svg>`;}

// Coach öffnet Plan des Athleten (wechselt VIEW_USER)
async function coachOpenPlan(id,name){closeModal();COACH_CONTEXT=name;VIEW_USER=id;TODAY=null;PLAN=null;RECIPE_FILTER=null;buildNav();
  const dr=await API.get('/dashboard/'+id);VIEW_USER_PROFILE=dr.data?.athlete||null;
  await loadPlan();await loadToday();go('workout');}
function coachMessage(id){openSheet('Nachricht an Athlet',`<div class="field"><label>Betreff</label><input id="cm_title" placeholder="z.B. Plananpassung"></div><div class="field"><label>Nachricht</label><textarea id="cm_body" rows="3" placeholder="Deine Nachricht..."></textarea></div><button class="btn" onclick="sendCoachMsg(${id})">Senden</button>`);}
async function sendCoachMsg(id){const r=await API.post('/messages',{user_id:id,title:val('cm_title'),body:val('cm_body')});
  if(r.status===200){closeModal();toast('Nachricht gesendet ✓');}else toast('Fehler');}
function coachSetPhase(id,cur){openSheet('Phase & Ziele',`
  <div class="field"><label>Phase</label><select id="cp_phase">
    <option value="offseason"${cur==='offseason'?' selected':''}>Offseason (Aufbau)</option>
    <option value="prep"${cur==='prep'?' selected':''}>Wettkampf-Prep (Diät)</option>
    <option value="maintain"${cur==='maintain'?' selected':''}>Maintenance</option></select></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="field"><label>kcal Trainingstag</label><input id="cp_kt" type="number" placeholder="z.B. 3000"></div>
    <div class="field"><label>kcal Ruhetag</label><input id="cp_kr" type="number" placeholder="z.B. 2600"></div></div>
  <div class="info">Der Athlet bekommt automatisch eine Nachricht über die Änderung.</div>
  <button class="btn" onclick="saveCoachPhase(${id})">Speichern</button>`);}
async function saveCoachPhase(id){const r=await API.put('/athlete/'+id+'/profile',{phase:val('cp_phase'),kcal_target_train:num('cp_kt'),kcal_target_rest:num('cp_kr')});
  if(r.status===200){closeModal();toast('Gespeichert ✓ – Athlet benachrichtigt');}else toast('Fehler');}
async function resolveNote(noteId,athleteId){const r=await API.post('/exercise-notes/'+noteId+'/resolve');
  if(r.status===200){toast('Als erledigt markiert ✓');openDashboard(athleteId);}else toast('Fehler');}

// ===== COACH: SUPPLEMENTS für Athlet verwalten =====
let COACH_SUPP_CTX={uid:null,name:'',cat:[],assigned:{}};
async function coachSupp(uid,name){openSheet('Supplements: '+name,'<div class="spinner"></div>');
  const [catR,aR]=await Promise.all([API.get('/supplements-catalog'),API.get('/supplements/'+uid)]);
  const cat=catR.data?.supplements||[];
  // aktuelle Zuweisungen (nur die personalisierten haben mandatory/assigned)
  const assigned={};(aR.data?.personalized?aR.data.supplements:[]).forEach(s=>{assigned[s.id]={mandatory:s.mandatory,dose:s.dose,timing:s.timing,note:s.note};});
  COACH_SUPP_CTX={uid,name,cat,assigned};
  drawCoachSupp();}
function drawCoachSupp(){const {uid,name,cat,assigned}=COACH_SUPP_CTX;
  let h=`<div class="info">Tippe ein Supplement an, um es als <b>Pflicht</b> oder optional festzulegen und Dosierung/Timing für ${esc2(name)} anzupassen.</div>`;
  h+='<div class="rows">'+cat.map(s=>{const a=assigned[s.id];
    const status=a?(a.mandatory?'<span class="pill coach">Pflicht</span>':'<span class="pill" style="background:var(--surface2)">optional</span>'):'<span style="color:var(--ink3);font-size:12px">nicht zugewiesen</span>';
    return `<div class="row" onclick="coachEditSupp(${s.id})"><div class="rl">${esc2(s.name)}<small>${esc2(a?.dose||s.dose||'')}</small></div><div class="rr">${status} ›</div></div>`;}).join('')+'</div>';
  openSheet('Supplements: '+name,h);}
function coachEditSupp(sid){const {cat,assigned}=COACH_SUPP_CTX;const s=cat.find(x=>x.id===sid);if(!s)return;const a=assigned[sid]||{};
  openSheet(s.name,`
    <div class="info">Standard: ${esc2(s.dose||'–')} · ${esc2(s.timing||'–')}. Leere Felder = Standard verwenden.</div>
    <label style="display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:15px;font-weight:600"><input type="checkbox" id="cs_mand" ${a.mandatory?'checked':''} style="width:auto"> Als Pflicht festlegen</label>
    <div class="field"><label>Dosierung anpassen (optional)</label><input id="cs_dose" value="${a.dose&&a.dose!==s.dose?esc(a.dose):''}" placeholder="${esc(s.dose||'z.B. 5 g')}"></div>
    <div class="field"><label>Timing anpassen (optional)</label><input id="cs_timing" value="${a.timing&&a.timing!==s.timing?esc(a.timing):''}" placeholder="${esc(s.timing||'z.B. morgens')}"></div>
    <div class="field"><label>Persönlicher Hinweis (optional)</label><textarea id="cs_note" rows="2" placeholder="z.B. wegen deiner Schlafprobleme abends">${esc(a.note||'')}</textarea></div>
    <button class="btn" onclick="saveCoachSupp(${sid})">Speichern</button>
    ${a&&Object.keys(assigned).includes(String(sid))?`<button class="btn sec" style="margin-top:10px;color:var(--red)" onclick="removeCoachSupp(${sid})">Zuweisung entfernen</button>`:''}`);}
async function saveCoachSupp(sid){const {uid}=COACH_SUPP_CTX;
  const body={mandatory:document.getElementById('cs_mand').checked,custom_dose:val('cs_dose')||null,custom_timing:val('cs_timing')||null,note:val('cs_note')||null};
  const r=await API.put('/supplements/'+uid+'/'+sid,body);
  if(r.status===200){toast('Gespeichert ✓');coachSupp(uid,COACH_SUPP_CTX.name);}else toast(r.data?.error||'Fehler');}
async function removeCoachSupp(sid){const {uid}=COACH_SUPP_CTX;
  const r=await API.del('/supplements/'+uid+'/'+sid);
  if(r.status===200){toast('Entfernt');coachSupp(uid,COACH_SUPP_CTX.name);}else toast('Fehler');}

// ===== MESSAGES =====
async function openMessages(){const msgs=await loadMessages();
  await API.post('/messages/'+ME.id+'/read');document.getElementById('bellBadge').classList.add('hidden');
  const canReply=ME.role==='athlete'&&ME.coach_id;
  openSheet('Nachrichten',(canReply?`<button class="btn sec" style="margin-bottom:14px" onclick="replyCoach()">✏️ Nachricht an deinen Coach</button>`:'')+(msgs.length?msgs.map(m=>{const dt=new Date(m.created_at).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const sender=m.from_name?m.from_name:(m.kind==='system'?'System':'');
    return `<div class="msg ${m.kind}"><div class="mh"><div class="mt">${m.title}</div><div class="md">${dt}</div></div>${sender?`<div style="font-size:12px;color:var(--ink3);margin-top:2px">von ${sender}</div>`:''}<div class="mb">${m.body}</div></div>`;}).join(''):'<div class="empty"><div class="ei">🔔</div>Keine Nachrichten.</div>'));}
function replyCoach(){openSheet('An deinen Coach',`<div class="field"><label>Betreff</label><input id="rc_title" placeholder="z.B. Frage zum Training"></div><div class="field"><label>Nachricht</label><textarea id="rc_body" rows="3" placeholder="Deine Nachricht..."></textarea></div><button class="btn" onclick="sendReplyCoach()">Senden</button>`);}
async function sendReplyCoach(){const r=await API.post('/messages/tocoach',{title:val('rc_title'),body:val('rc_body')});
  if(r.status===200){closeModal();toast('An Coach gesendet ✓');}else toast(r.data?.error||'Fehler');}

// ===== MORE =====
function renderMore(v){
  // "Mehr" ist bewusst schlank: nur Konto/allgemeine Dinge.
  // Tools sind jetzt in ihren passenden Kategorien (Kalender/Rhythmus auf Home,
  // Makro-/Hantelrechner & Supplements in Ernährung/Training, Technik in den Übungen).
  v.innerHTML=`<div class="page on"><div class="h1">Mehr</div><div class="sub">Konto &amp; Einstellungen</div>
  <div class="quick">
    <button class="qcard" onclick="openProfile()"><span class="ic">👤</span><div class="t">Profil</div><div class="d">${ME.role==='athlete'?'Ziele &amp; Daten':'Deine Daten'}</div></button>
    <button class="qcard" onclick="openChangePw()"><span class="ic">🔒</span><div class="t">Passwort</div><div class="d">Ändern</div></button>
  </div>
  <div class="section-label">Konto</div>
  <div class="rows"><div class="row" onclick="logout()"><div class="rl" style="color:var(--red)">Abmelden</div><div class="rr">›</div></div></div>
  </div>`;}

function openProfile(){const u=ME;
  // Coach/Admin brauchen keine Trainings-/Ernährungsdaten – nur administratives Profil
  if(u.role==='coach'||u.role==='admin'){
    openSheet('Profil',`
      <div class="info">Als ${u.role==='admin'?'Administrator':'Coach'} verwaltest du ${u.role==='admin'?'das System':'deine Athleten'}. Trainings- und Ernährungsdaten gibt es hier nicht.</div>
      <div class="field"><label>Name</label><input id="p_name_simple" value="${u.name||''}"></div>
      <div class="field"><label>E-Mail</label><input value="${u.email||''}" disabled style="opacity:.6"></div>
      <button class="btn" onclick="saveSimpleProfile()">Name speichern</button>
      <button class="btn sec" style="margin-top:10px" onclick="openChangePw()">🔒 Passwort ändern</button>`);
    return;
  }
  openSheet('Profil',`
    <div class="field"><label>Name</label><input id="p_name" value="${u.name||''}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="field"><label>Größe (cm)</label><input id="p_height" type="number" value="${u.height_cm||''}"></div>
      <div class="field"><label>Startgewicht (fest)</label><input type="number" value="${u.start_weight||'–'}" disabled style="opacity:.6"></div>
    </div>
    <div class="field"><label>Erfahrung</label><select id="p_exp">
      <option value="beginner"${u.experience==='beginner'?' selected':''}>Anfänger (mehr Erklärungen)</option>
      <option value="intermediate"${u.experience==='intermediate'?' selected':''}>Fortgeschritten</option>
      <option value="advanced"${u.experience==='advanced'?' selected':''}>Profi (RIR, Volumen, alle Details)</option></select></div>
    <div class="field"><label>Ziel</label><select id="p_goal">
      <option value="muscle"${u.goal==='muscle'?' selected':''}>Muskelaufbau</option>
      <option value="fatloss"${u.goal==='fatloss'?' selected':''}>Gewicht verlieren / Definition</option>
      <option value="health"${u.goal==='health'?' selected':''}>Gesundheit / Fitness</option></select></div>
    <div class="field"><label>Phase</label><select id="p_phase">
      <option value="offseason"${u.phase==='offseason'?' selected':''}>Offseason (Aufbau)</option>
      <option value="prep"${u.phase==='prep'?' selected':''}>Wettkampf-Prep (Diät)</option>
      <option value="maintain"${u.phase==='maintain'?' selected':''}>Maintenance (Halten)</option></select></div>
    <div class="field"><label>Trainings pro Woche: <span id="dpwLabel">${u.days_per_week||4}</span></label>
      <input id="p_days" type="range" min="1" max="7" value="${u.days_per_week||4}" oninput="document.getElementById('dpwLabel').textContent=this.value"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="field"><label>kcal Trainingstag</label><input id="p_kt" type="number" value="${u.kcal_target_train||''}" placeholder="z.B. 3000"></div>
      <div class="field"><label>kcal Ruhetag</label><input id="p_kr" type="number" value="${u.kcal_target_rest||''}" placeholder="z.B. 2600"></div>
    </div>
    <div class="info">Die Trainingsfrequenz legt deinen Rhythmus fest (z.B. 2 Tage Training, 1 Ruhetag) – nicht feste Wochentage. So machst du nach Pausen nahtlos weiter.</div>
    <button class="btn" onclick="saveProfile()">Speichern</button>
    <button class="btn sec" style="margin-top:10px" onclick="openChangePw()">🔒 Passwort ändern</button>`);}
async function saveSimpleProfile(){const name=val('p_name_simple');if(!name)return toast('Name darf nicht leer sein');
  const r=await API.put('/profile',{name,gender:ME.gender,start_weight:ME.start_weight});
  if(r.status===200){ME.name=name;document.getElementById('avatar').textContent=name.charAt(0).toUpperCase();closeModal();toast('Gespeichert ✓');}else toast('Fehler');}
function openChangePw(){openSheet('Passwort ändern',`
    <div class="field"><label>Aktuelles Passwort</label><input id="pw_cur" type="password" placeholder="••••••••"></div>
    <div class="field"><label>Neues Passwort</label><input id="pw_new" type="password" placeholder="min. 6 Zeichen"></div>
    <div class="field"><label>Neues Passwort wiederholen</label><input id="pw_new2" type="password" placeholder="••••••••"></div>
    <button class="btn" onclick="saveNewPw()">Passwort speichern</button>`);}
async function saveNewPw(){const cur=val('pw_cur'),n1=val('pw_new'),n2=val('pw_new2');
  if(n1!==n2)return toast('Passwörter stimmen nicht überein');
  if(n1.length<6)return toast('Mindestens 6 Zeichen');
  const r=await API.post('/password',{current:cur,next:n1});
  if(r.status===200){closeModal();toast('Passwort geändert ✓');}else toast(r.data?.error||'Fehler');}
async function saveProfile(){const newDays=num('p_days');
  // Warnung: Ändern der Frequenz baut den Rhythmus neu und überschreibt manuelle Kalenderplanung
  if(newDays&&newDays!==ME.days_per_week){
    if(!window.confirm('Du änderst die Trainingstage pro Woche von '+(ME.days_per_week||'?')+' auf '+newDays+'.\n\nDadurch wird dein Trainingsrhythmus neu berechnet – manuell im Kalender geplante Tage gehen dabei verloren.\n\nFortfahren?'))return;
  }
  const body={name:val('p_name'),height_cm:num('p_height'),goal:val('p_goal'),phase:val('p_phase'),experience:val('p_exp'),days_per_week:newDays,kcal_target_train:num('p_kt'),kcal_target_rest:num('p_kr'),dob:ME.dob,gender:ME.gender,start_weight:ME.start_weight};
  const r=await API.put('/profile',body);if(r.status===200){Object.assign(ME,body);
    document.getElementById('avatar').textContent=(ME.name||'?').charAt(0).toUpperCase();
    TODAY=null;closeModal();toast('Profil gespeichert ✓');go('home');}}

// ===== RHYTHMUS-EDITOR =====
let RHY=[];
// ===== INTERAKTIVER KALENDER =====
let CAL_MONTH=null; // erster Tag des angezeigten Monats
async function openCalendar(){CAL_MONTH=new Date();CAL_MONTH.setDate(1);drawCalendar();}
async function drawCalendar(){
  const y=CAL_MONTH.getFullYear(),m=CAL_MONTH.getMonth();
  const monthName=CAL_MONTH.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  const startISO=`${y}-${String(m+1).padStart(2,'0')}-01`;
  openSheet('Kalender','<div class="spinner"></div>');
  const r=await API.get('/calendar/'+VIEW_USER+'?start='+startISO+'&days='+last.getDate());
  const cal=r.data?.calendar||[];const byDate={};cal.forEach(d=>byDate[d.date]=d);
  const todayISO=today();
  // Wochentags-Kopf (Mo-So)
  const wd=['Mo','Di','Mi','Do','Fr','Sa','So'];
  let grid=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">`+
    wd.map(w=>`<div style="text-align:center;font-size:11px;color:var(--ink3)">${w}</div>`).join('')+`</div>`;
  grid+=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">`;
  // Leerfelder bis zum ersten Wochentag (Mo=0)
  let lead=(first.getDay()+6)%7;
  for(let i=0;i<lead;i++)grid+=`<div></div>`;
  for(let day=1;day<=last.getDate();day++){
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const e=byDate[iso];const isTrain=e?.type==='train';const isSick=e?.type==='sick';
    const isToday=iso===todayISO;const isPast=iso<todayISO;
    let bg=isTrain?'var(--red)':(e?.type==='rest'||isSick)?'var(--surface2)':'transparent';
    let fg=isTrain?'#fff':'var(--ink2)';
    const icon=isTrain?'🏋️':isSick?'🤒':'😴';
    grid+=`<button onclick="calDay('${iso}')" ${isPast?'disabled':''} style="aspect-ratio:1;box-sizing:border-box;border:none;border-radius:10px;background:${bg};color:${fg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;opacity:${isPast?0.4:1};${isToday?'box-shadow:inset 0 0 0 2px var(--ink)':''};position:relative;overflow:hidden">
      <span style="font-size:clamp(11px,3.2vw,13px);font-weight:600;line-height:1">${day}</span>
      <span style="font-size:clamp(10px,3vw,13px);line-height:1">${icon}</span>
      ${e?.planned?`<span style="position:absolute;top:3px;right:3px;width:6px;height:6px;background:var(--blue);border-radius:50%"></span>`:''}
    </button>`;
  }
  grid+=`</div>`;
  const body=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button class="minibtn" onclick="calNav(-1)">‹</button>
      <div style="font-weight:600;font-size:16px">${monthName}</div>
      <button class="minibtn" onclick="calNav(1)">›</button>
    </div>
    ${grid}
    <div style="display:flex;gap:14px;justify-content:center;margin-top:14px;font-size:12px;color:var(--ink2)">
      <span>🏋️ Training</span><span>😴 Ruhetag</span><span>🤒 Krank</span><span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;background:var(--blue);border-radius:50%;display:inline-block"></span> geplant</span>
    </div>
    <div class="info" style="margin-top:14px">Tippe auf einen Tag, um ihn zu planen – z.B. einen Ruhetag, wenn du unterwegs bist. Dein Rhythmus rechnet automatisch weiter.</div>
    <button class="btn sec" style="margin-top:10px" onclick="openRhythmus()">🗓️ Trainingsrhythmus anpassen</button>`;
  openSheet('Kalender',body);
}
function calNav(dir){CAL_MONTH.setMonth(CAL_MONTH.getMonth()+dir);drawCalendar();}
function calDay(iso){const dt=new Date(iso+'T00:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  const trainNames=(PLAN?.days||[]).map(d=>d.name);
  openSheet(dt,`
    <div class="info">Was möchtest du für diesen Tag festlegen?</div>
    <button class="btn" onclick="setCalDay('${iso}','rest',null)">😴 Ruhetag</button>
    <div class="section-label" style="margin-top:14px">Training</div>
    ${trainNames.length?trainNames.map(n=>`<button class="btn sec" style="margin-bottom:8px" onclick="setCalDay('${iso}','train','${esc(n)}')">🏋️ ${n}</button>`).join(''):'<button class="btn sec" onclick="setCalDay(\''+iso+'\',\'train\',null)">🏋️ Training</button>'}
    <button class="btn sec" style="margin-top:8px" onclick="setCalDay('${iso}','sick',null)">🤒 Krank/Pause</button>
    <button class="btn sec" style="margin-top:14px;color:var(--ink2)" onclick="clearCalDay('${iso}')">↺ Automatisch (Planung entfernen)</button>`);}
async function setCalDay(iso,type,dayName){
  const r=await API.post('/today/'+VIEW_USER,{date:iso,type,day_name:dayName});
  if(r.status===200){TODAY=null;toast('Tag geplant ✓');drawCalendar();}else toast('Fehler');}
async function clearCalDay(iso){
  const r=await API.del('/today/'+VIEW_USER+'?date='+iso);
  if(r.status===200){TODAY=null;toast('Zurück auf automatisch');drawCalendar();}else toast('Fehler');}

async function openRhythmus(){
  const me=await API.get('/me');try{RHY=JSON.parse(me.data.user.pattern);}catch{RHY=null;}
  if(!Array.isArray(RHY)||!RHY.length)RHY=['train','train','rest'];
  drawRhythmus();
}
function drawRhythmus(){
  const trainNames=(PLAN?.days||[]).map(d=>d.name);let rot=0;
  const rows=RHY.map((slot,i)=>{const isTrain=slot==='train';
    const label=isTrain?(trainNames[(rot++)%Math.max(1,trainNames.length)]||'Training'):'Ruhetag';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--surface2);border-radius:12px;margin-bottom:8px">
      <div style="flex-shrink:0;width:30px;height:30px;border-radius:8px;background:${isTrain?'var(--red)':'var(--line)'};color:${isTrain?'#fff':'var(--ink2)'};display:flex;align-items:center;justify-content:center">${isTrain?'🏋️':'😴'}</div>
      <div style="flex:1"><div style="font-weight:600;font-size:15px">Tag ${i+1}: ${label}</div>
        <button style="font-size:12px;color:var(--blue);background:none;border:none;padding:0;margin-top:2px" onclick="rhyToggle(${i})">→ zu ${isTrain?'Ruhetag':'Trainingstag'}</button></div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <button class="minibtn" style="padding:4px 8px" onclick="rhyMove(${i},-1)">▲</button>
        <button class="minibtn" style="padding:4px 8px" onclick="rhyMove(${i},1)">▼</button></div>
      <button class="minibtn red" style="padding:4px 8px" onclick="rhyRemove(${i})">✕</button>
    </div>`;}).join('');
  const trainTotal=RHY.filter(x=>x==='train').length;
  openSheet('Trainingsrhythmus',`
    <div class="info">Bau deine Wochen-Sequenz: ${trainTotal} Trainingstage in ${RHY.length} Tagen. Sie wiederholt sich endlos – nach einer Pause machst du nahtlos weiter.</div>
    ${rows}
    <div style="display:flex;gap:8px;margin:12px 0">
      <button class="btn sec" onclick="rhyAdd('train')">+ Trainingstag</button>
      <button class="btn sec" onclick="rhyAdd('rest')">+ Ruhetag</button></div>
    <button class="btn" onclick="saveRhythmus()">Rhythmus speichern</button>`);}
function rhyToggle(i){RHY[i]=RHY[i]==='train'?'rest':'train';drawRhythmus();}
function rhyMove(i,dir){const j=i+dir;if(j<0||j>=RHY.length)return;[RHY[i],RHY[j]]=[RHY[j],RHY[i]];drawRhythmus();}
function rhyRemove(i){if(RHY.length<=1)return toast('Mindestens 1 Tag nötig');RHY.splice(i,1);drawRhythmus();}
function rhyAdd(t){RHY.push(t);drawRhythmus();}
async function saveRhythmus(){if(!RHY.filter(x=>x==='train').length)return toast('Mindestens 1 Trainingstag nötig');
  const r=await API.post('/pattern',{pattern:RHY});
  if(r.status===200){closeModal();TODAY=null;toast('Rhythmus gespeichert ✓');go('home');}else toast('Fehler');}

// ===== TOOLS =====
function openCalc(){if(!FOODS.length)return toast('Lädt...');
  openSheet('Makro-Rechner',`<div class="info">Lebensmittel + Menge → Makros automatisch.</div>
    <div class="field"><label>Lebensmittel</label><select id="calc_food" onchange="doCalc()">${FOODS.map((f,i)=>`<option value="${i}">${f.name}</option>`).join('')}</select></div>
    <div class="field"><label>Menge (g/ml)</label><input id="calc_amt" type="number" inputmode="numeric" value="100" oninput="doCalc()"></div>
    <div class="macro-row" id="calc_out"></div>`);doCalc();}
function doCalc(){const f=FOODS[+val('calc_food')];const a=parseFloat(val('calc_amt'))||0;
  const fat=f.fat*a,carb=f.carbs*a,prot=f.protein*a,kc=fat*9+carb*4+prot*4;
  document.getElementById('calc_out').innerHTML=`<div class="macro kcal"><div class="v">${Math.round(kc)}</div><div class="k">kcal</div></div><div class="macro"><div class="v">${prot.toFixed(1)}<em>g</em></div><div class="k">Protein</div></div><div class="macro"><div class="v">${carb.toFixed(1)}<em>g</em></div><div class="k">Carbs</div></div><div class="macro"><div class="v">${fat.toFixed(1)}<em>g</em></div><div class="k">Fett</div></div>`;}
// Erklärung einer an einer Übung gesetzten Technik aus dem Lexikon zeigen
function explainTechnique(term){
  const t=(term||'').toLowerCase();
  const hit=DEFS.find(d=>d.term.toLowerCase()===t)||DEFS.find(d=>d.term.toLowerCase().includes(t)||t.includes(d.term.toLowerCase()));
  if(hit)openSheet(hit.term,`<div style="font-size:15px;line-height:1.6;color:var(--ink2)">${hit.def}</div><button class="btn" style="margin-top:16px" onclick="closeModal()">Verstanden</button>`);
  else openSheet(term,`<div class="info">Für diese Technik gibt es noch keine Erklärung im Lexikon. Dein Coach hat sie als Hinweis gesetzt – frag im Zweifel direkt nach.</div><button class="btn" onclick="openDefs()">Ganzes Lexikon ansehen</button>`);
}
function openDefs(){openSheet('Technik-Lexikon',DEFS.length?DEFS.map(d=>`<div class="def"><div class="dt">${d.term}</div><div class="dd">${d.def}</div></div>`).join(''):'<div class="empty">Keine Einträge.</div>');}
// Technik aus dem Lexikon auswählen -> trägt den Begriff ins Übungsformular ein
function pickTechnique(){
  if(!DEFS.length)return toast('Lexikon lädt noch…');
  // aktuellen Formularstand sichern, damit beim Zurückkommen nichts verloren geht
  if(EX_FORM_CTX&&!EX_FORM_CTX.id){EX_FORM_CTX.draft={muscle:val('ex_muscle'),name:val('ex_name'),target_sets:val('ex_sets'),target_reps:val('ex_reps'),video_url:val('ex_video'),notes:val('ex_notes')};}
  openSheet('Technik wählen',`<div class="info">Tippe auf eine Technik, um sie für diese Übung zu übernehmen. Die Erklärung sieht der Athlet später direkt an der Übung.</div>`+
    DEFS.map(d=>`<button class="def" style="display:block;width:100%;text-align:left;border:none;background:var(--surface2);margin-bottom:8px;border-radius:12px;cursor:pointer" onclick="setTechnique('${esc(d.term)}')"><div class="dt">${d.term}</div><div class="dd">${d.def}</div></button>`).join('')+
    `<button class="btn sec" style="margin-top:6px" onclick="setTechnique('')">Keine / zurücksetzen</button>`);
}
let EX_FORM_CTX=null; // merkt sich, ob wir gerade eine Übung anlegen oder bearbeiten
function setTechnique(term){
  // Wir öffnen das Formular nicht neu (Werte gingen verloren) – stattdessen Feld direkt setzen,
  // aber das Sheet wurde überschrieben. Lösung: Wert zwischenspeichern und Formular mit erhaltenem Stand neu zeigen.
  closeModal();
  if(EX_FORM_CTX&&EX_FORM_CTX.id){ // bearbeiten
    const ex={...curDayObj().exercises.find(e=>e.id===EX_FORM_CTX.id)};ex.technique=term;
    openSheet('Übung bearbeiten',exForm(ex)+`<button class="btn" onclick="confirmEditExercise(${ex.id})">Speichern</button>`);
  } else { // anlegen – bisher eingegebene Werte aus dem Kontext wiederherstellen
    const draft=EX_FORM_CTX?.draft||{};draft.technique=term;
    openSheet('Übung hinzufügen',exForm(draft)+`<button class="btn" onclick="confirmAddExercise()">Hinzufügen</button>`);
  }
}

// HANTELRECHNER
function platesPerSideJS(target,bar,plates){let perSide=(target-bar)/2;const out=[];
  for(const p of plates){let c=0;while(perSide>=p-1e-9){perSide-=p;c++;}if(c>0)out.push([p,c]);}
  const used=out.reduce((s,[p,c])=>s+p*c,0);const ach=bar+used*2;
  return {out,achievable:Math.round(ach*100)/100,remainder:Math.round((target-ach)*100)/100};}
function openPlateCalc(){openSheet('Hantelrechner',`
  <div class="info">Gib dein Zielgewicht ein – wir zeigen dir, welche Scheiben pro Seite auf die Stange müssen.</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="field"><label>Zielgewicht (kg)</label><input id="pc_target" type="number" step="0.5" inputmode="decimal" value="60" oninput="doPlate()"></div>
    <div class="field"><label>Stange (kg)</label><select id="pc_bar" onchange="doPlate()"><option value="20">20 (Standard)</option><option value="15">15 (Frauen)</option><option value="10">10 (kurz)</option><option value="0">ohne Stange</option></select></div>
  </div>
  <div id="pc_out"></div>`);doPlate();}
function doPlate(){const target=parseFloat(val('pc_target'))||0;const bar=parseFloat(val('pc_bar'));
  const el=document.getElementById('pc_out');
  if(target<bar){el.innerHTML=`<div class="warn">Das Zielgewicht ist kleiner als die Stange (${bar} kg).</div>`;return;}
  const r=platesPerSideJS(target,bar,[25,20,15,10,5,2.5,1.25]);
  let h=`<div class="surface pad" style="text-align:center;margin-bottom:12px"><div style="color:var(--ink2);font-size:13px">Pro Seite</div>`;
  if(!r.out.length)h+=`<div style="font-size:18px;font-weight:700;margin-top:6px">Nur die Stange</div>`;
  else{h+=`<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px">`+
    r.out.map(([p,c])=>`<div style="background:var(--red);color:#fff;border-radius:10px;padding:10px 14px;font-weight:700">${c}× ${p}kg</div>`).join('')+`</div>`;}
  h+=`</div>`;
  if(r.remainder>0.01)h+=`<div class="warn">Exakt ${target} kg nicht möglich. Nächstmöglich: <b>${r.achievable} kg</b> (${r.remainder} kg fehlen). Tipp: kleinere Scheiben besorgen.</div>`;
  else h+=`<div class="info" style="text-align:center">Ergibt genau <b>${r.achievable} kg</b> ✓</div>`;
  el.innerHTML=h;}
// Supplements des angesehenen Nutzers: Pflicht oben hervorgehoben, Details auf Tippen.
let SUPP_CACHE=[];
async function openSupp(){openSheet('Supplements','<div class="spinner"></div>');
  const r=await API.get('/supplements/'+VIEW_USER);
  const list=r.data?.supplements||[];SUPP_CACHE=list;const personalized=r.data?.personalized;
  const mand=list.filter(s=>s.mandatory),opt=list.filter(s=>!s.mandatory);
  let h='';
  if(!personalized)h+=`<div class="info">Dein Coach hat dir noch keine Supplements zugewiesen. Hier siehst du gängige Empfehlungen zur Orientierung – tippe für Details.</div>`;
  else h+=`<div class="info">Dein persönliches Protokoll. <b>Pflicht</b> hat dein Coach für dich festgelegt. Tippe ein Supplement für Dosierung, Timing und Einnahme.</div>`;
  const card=s=>`<button class="def" style="display:block;width:100%;text-align:left;border:none;background:var(--surface2);margin-bottom:8px;border-radius:12px;cursor:pointer" onclick="suppDetail(${s.id})">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-weight:600">${esc2(s.name)}${s.mandatory?' <span class="pill coach">Pflicht</span>':''}</div>
        <div style="color:var(--ink2);font-size:14px;white-space:nowrap">${esc2(s.dose||'')}</div></div>
      <div style="color:var(--ink3);font-size:12px;margin-top:3px">${esc2(s.category||'')}${s.timing?' · '+esc2(s.timing):''}</div>
    </button>`;
  if(mand.length){h+=`<div class="section-label">Pflicht (vom Coach)</div>`+mand.map(card).join('');}
  if(opt.length){h+=`<div class="section-label">${personalized?'Optional':'Empfehlungen'}</div>`+opt.map(card).join('');}
  if(!list.length)h+='<div class="empty"><div class="ei">💊</div>Keine Supplements hinterlegt.</div>';
  openSheet('Supplements',h);}
function suppDetail(id){const s=SUPP_CACHE.find(x=>x.id===id);if(!s)return;
  openSheet(s.name,`
    ${s.mandatory?'<div class="info" style="background:var(--red-soft);color:var(--red)">⚠️ Pflicht – von deinem Coach festgelegt.</div>':''}
    <div class="rows" style="margin-bottom:14px">
      <div class="row"><div class="rl">Dosierung</div><div class="rr">${esc2(s.dose||'–')}</div></div>
      <div class="row"><div class="rl">Wann</div><div class="rr" style="max-width:60%;text-align:right">${esc2(s.timing||'–')}</div></div>
      <div class="row"><div class="rl">Mit Wasser</div><div class="rr">${s.with_water?'Ja 💧':'Nicht nötig'}</div></div>
    </div>
    ${s.how_to?`<div class="section-label">Einnahme &amp; Wirkung</div><div class="surface pad" style="font-size:14px;line-height:1.6">${esc2(s.how_to)}</div>`:''}
    ${s.note?`<div class="section-label">Hinweis deines Coaches</div><div class="surface pad" style="font-size:14px;line-height:1.6;border-left:3px solid var(--red)">${esc2(s.note)}</div>`:''}
    <button class="btn" style="margin-top:16px" onclick="openSupp()">Zurück</button>`);}

// ===== MODAL/UTIL =====
const INFO_TEXTS={
  recovery:{t:'Erholungs-Score',b:`Dein Erholungs-Score schätzt, wie bereit dein Körper heute fürs Training ist. Er berücksichtigt:<br><br>• <b>Schlaf:</b> Wie lange und wie gut du letzte Nacht geschlafen hast (aus deinem Check-in).<br>• <b>Training gestern:</b> Hartes Training senkt die Erholung.<br>• <b>Hartes Cardio gestern:</b> Lange/intensive Einheiten brauchen Erholung.<br><br><b>75–100 (Top erholt):</b> Volle Leistung möglich – pushe dich.<br><b>50–74 (Solide):</b> Trainiere normal, saubere Technik.<br><b>30–49 (Angeschlagen):</b> Volumen moderat halten.<br><b>unter 30 (Erschöpft):</b> Erwäge einen leichten Tag oder Pause.<br><br>Je mehr du im Check-in einträgst (vor allem Schlaf), desto genauer wird der Score.`},
  streak:{t:'Check-in Streak',b:`Die Streak zählt, an wie vielen Tagen <b>hintereinander</b> du einen Check-in gemacht hast (Gewicht, Schlaf o.ä.).<br><br>Sie soll dich motivieren, täglich kurz reinzuschauen – Dranbleiben ist der wichtigste Erfolgsfaktor.<br><br>Lässt du einen Tag komplett aus, beginnt die Streak wieder bei 1. Ein Ruhetag zählt ganz normal mit, solange du den Check-in machst.`},
};
function openInfo(key){const i=INFO_TEXTS[key];if(!i)return;
  openSheet(i.t,`<div style="font-size:15px;line-height:1.6;color:var(--ink2)">${i.b}</div><button class="btn" style="margin-top:18px" onclick="closeModal()">Verstanden</button>`);}
function openSheet(title,html){document.getElementById('sheet').innerHTML=`<div class="sheet-grip"></div><div class="sheet-h"><h3>${title}</h3><button class="sheet-x" onclick="closeModal()">✕</button></div>${html}`;document.getElementById('modal').classList.add('on');}
function closeModal(){document.getElementById('modal').classList.remove('on');}
// ===== REST-TIMER =====
let restInt=null,restLeft=0;
function startRest(seconds){restLeft=seconds;document.getElementById('restBar').classList.remove('hidden');drawRest();
  clearInterval(restInt);restInt=setInterval(()=>{restLeft--;drawRest();
    if(restLeft<=0){clearInterval(restInt);restDone();}},1000);}
function drawRest(){const m=Math.floor(Math.max(0,restLeft)/60),s=Math.max(0,restLeft)%60;
  const el=document.getElementById('restTime');if(el)el.textContent=m+':'+String(s).padStart(2,'0');}
function restAdd(s){restLeft+=s;drawRest();}
function restStop(){clearInterval(restInt);document.getElementById('restBar').classList.add('hidden');}
function restDone(){document.getElementById('restBar').classList.add('hidden');
  // kurzes akustisches + haptisches Signal
  try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.value=0.1;o.start();
    setTimeout(()=>{o.stop();ctx.close();},250);}catch{}
  if(navigator.vibrate)navigator.vibrate(200);
  toast('Pause vorbei – nächster Satz! 💪');}

function toast(m,action){const t=document.createElement('div');t.className='toast';
  if(action){t.innerHTML=`<span>${m}</span>`;const b=document.createElement('button');
    b.textContent=action.label;b.style.cssText='margin-left:14px;color:var(--red);font-weight:700;background:none;border:none;font-size:14px';
    b.onclick=()=>{action.fn();t.remove();};t.appendChild(b);t.style.cssText+=';display:flex;align-items:center';
    document.body.appendChild(t);setTimeout(()=>{if(t.parentNode){t.style.transition='.4s';t.style.opacity='0';setTimeout(()=>t.remove(),400);}},5000);}
  else{t.textContent=m;document.body.appendChild(t);setTimeout(()=>{t.style.transition='.4s';t.style.opacity='0';setTimeout(()=>t.remove(),400);},1600);}}
function val(id){return document.getElementById(id)?.value.trim()??'';}
function num(id){const v=document.getElementById(id)?.value;return v===''||v==null?null:parseFloat(v);}
function fmt(d){return d.toISOString().slice(0,10);}
function r1(n){return Math.round((n||0)*10)/10;}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function esc(s){return String(s).replace(/'/g,"\\'").replace(/"/g,'&quot;');}
function goalLabel(g){return{muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'}[g]||'–';}
function clampSets(v){let n=parseInt(v);if(isNaN(n))n=3;return Math.max(1,Math.min(10,n));}
function isBeginner(){return (ME?.experience||'beginner')==='beginner';}
function isAdvanced(){return (ME?.experience)==='advanced';}

// ===== INIT =====
(async()=>{const r=await API.get('/me');if(r.status===200){ME=r.data.user;startApp();}})();
