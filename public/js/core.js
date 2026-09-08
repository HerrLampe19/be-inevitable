// BE INEVITABLE – Frontend, Teil «core.js». Klassische Skripte in fester Reihenfolge (siehe index.html);
// alle Funktionen sind global, wie zuvor in der einen app.js.
// ===== GLOBALE FEHLERBEHANDLUNG =====
// Fängt unerwartete Fehler ab, damit die App nie still einfriert.
window.addEventListener('error',e=>{console.error('[App-Fehler]',e.error||e.message);
  if(typeof toast==='function')toast('Etwas ist schiefgelaufen – bitte erneut versuchen.');});
window.addEventListener('unhandledrejection',e=>{console.error('[App-Fehler/Promise]',e.reason);});

// ===== ICONS (24×24, Stroke, Lucide-artig – eigene kurze Pfade; ISC-kompatible Formen) =====
// icon(name,size,cls) -> Inline-SVG (currentColor, aria-hidden). Unbekannter Name -> '' (wirft nie).
// Werte sind entweder ein Pfad (d=…) oder fertiges SVG-Innen-Markup (beginnt mit '<').
const ICONS={
  home:'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  dumbbell:'M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12',
  utensils:'M5 3v6a2 2 0 0 0 4 0V3M7 3v18M19 3c-2 0-4 2-4 6v4h4v8',
  brain:'M12 5a3 3 0 0 0-5.5-1.5A3 3 0 0 0 4 7a3 3 0 0 0 1 5.5A3 3 0 0 0 7 18a3 3 0 0 0 5 2V5M12 5a3 3 0 0 1 5.5-1.5A3 3 0 0 1 20 7a3 3 0 0 1-1 5.5A3 3 0 0 1 17 18a3 3 0 0 1-5 2',
  chartLine:'M3 3v18h18M7 14l4-4 4 3 5-6',
  chevronRight:'m9 6 6 6-6 6',chevronLeft:'m15 6-6 6 6 6',chevronDown:'m6 9 6 6 6-6',
  x:'M18 6 6 18M6 6l12 12',plus:'M12 5v14M5 12h14',minus:'M5 12h14',check:'m5 12 5 5L20 7',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  arrowRight:'M5 12h14m-6-6 6 6-6 6',arrowLeft:'M19 12H5m6 6-6-6 6-6',
  trendUp:'M3 17l6-6 4 4 8-8M15 7h6v6',trendDown:'M3 7l6 6 4-4 8 8M15 17h6v-6',trendFlat:'M3 12h18m-5-5 5 5-5 5',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  filter:'M3 5h18l-7 8v6l-4 2v-8z',
  bell:'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  send:'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users:'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7"/>',
  logOut:'M10 17l5-5-5-5M15 12H3M13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5',
  settings:'<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  alertTriangle:'M12 3 2 20h20zM12 9v5M12 17h.01',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  timer:'<circle cx="12" cy="14" r="7"/><path d="M12 10v4l2 2M10 2h4M12 2v5M18 8l1.5-1.5"/>',
  pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play:'M7 4l13 8-13 8z',
  volumeX:'M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  refresh:'M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5',
  pencil:'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3',
  trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  share:'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
  camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  barcode:'M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14',
  download:'M12 3v13M7 11l5 5 5-5M5 21h14',upload:'M12 16V3M7 8l5-5 5 5M5 21h14',
  cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M2 3h3l2.5 11h11L21 7H6"/>',
  ruler:'M3 17 17 3l4 4L7 21zM8 16l2 2M11 13l2 2M14 10l2 2',
  flame:'M12 22c4.4 0 7-2.8 7-6.5 0-3-1.5-5-3-6.5-.5 2-1.5 3-3 3.5 0-3-1-6-3.5-8.5C9 7 5 9.5 5 15.5 5 19.2 7.6 22 12 22z',
  trophy:'M8 4h8v6a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9 18h6',
  shield:'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  medal:'<circle cx="12" cy="15" r="5"/><path d="M9 10 6 3h4l2 5 2-5h4l-3 7"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  scale:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8.5 9.5a5 5 0 0 1 7 0M12 12l1.5-2"/>',
  footprints:'M8 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM6 15h4v2a2 2 0 0 1-4 0zM16 9c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM14 21h4v1a2 2 0 0 1-4 0z',
  droplet:'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  bed:'M3 7v13M3 12h18v8M3 12V7h5a3 3 0 0 1 3 3v2M21 20v-4',
  heart:'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  moon:'M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11z',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  wind:'M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h16a2.5 2.5 0 1 1-2.5 2.5M3 16h8a2 2 0 1 1-2 2',
  zap:'M13 2 4 14h7l-1 8 9-12h-7z',
  sparkles:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8zM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z',
  pill:'<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.5 15.5l7-7"/>',
  apple:'M12 7c-1.5-1.5-4-1.5-5.5 0C4 9.5 5 15 7 18c1.5 2 3 2 5 1 2 1 3.5 1 5-1 2-3 3-8.5.5-11-1.5-1.5-4-1.5-5.5 0zM12 7c0-2 1-3.5 3-4',
  fileSpreadsheet:'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h8M12 13v4'
};
function icon(name,size,cls){const b=ICONS[name];if(!b)return '';size=size||20;
  const inner=b.charAt(0)==='<'?b:`<path d="${b}"/>`;
  return `<svg class="ic${cls?' '+cls:''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;}

// ===== FORMAT-HELFER (de-DE überall) =====
// HTML-Escaping für Text UND Attributwerte (auch " und ' – damit value="…" nie aufbricht).
// Liegt hier, weil jede Datei es nutzt (früher in coach.js).
function esc2(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function fmtNum(v,digits){if(v==null||v===''||isNaN(+v))return '–';digits=digits||0;
  return (+v).toLocaleString('de-DE',{minimumFractionDigits:digits,maximumFractionDigits:digits});}
// fmtDate('2026-09-07',{weekday:'short'|'long', month:'short'|'long'}) -> „Mo., 7. Sept." / „Montag, 7. September"
function fmtDate(d,opts){opts=opts||{};const dt=d instanceof Date?d:new Date(String(d||'').slice(0,10)+'T00:00:00');
  if(isNaN(dt.getTime()))return '';const o={day:'numeric',month:opts.month||'short'};
  if(opts.weekday)o.weekday=opts.weekday;if(opts.year)o.year=opts.year;
  return dt.toLocaleDateString('de-DE',o);}
function pl(n,sing,plur){n=+n||0;return fmtNum(n)+' '+(n===1?sing:plur);}
// Coach/Admin betrachtet gerade einen fremden Athleten (nie das eigene Konto, nie ohne Athleten)
function coachView(){return !!(ME&&ME.role!=='athlete'&&VIEW_USER!=null&&VIEW_USER!==ME.id);}

// ===== GEMEINSAME FELDLISTEN =====
// Körpermaße: von training.js (Eingabe) und analysis.js (Verlauf/Formular) genutzt – deshalb hier.
const MEASURE_FIELDS=[['waist','Taille'],['chest','Brust'],['arm','Arm'],['thigh','Bein'],['hips','Hüfte'],['shoulders','Schultern'],['neck','Nacken'],['body_fat','Körperfett %']];

// ===== API =====
const API={async req(m,p,b){try{const o={method:m,headers:{},credentials:'same-origin'};if(b){o.headers['Content-Type']='application/json';o.body=JSON.stringify(b);}const r=await fetch('/api'+p,o);let d=null;try{d=await r.json();}catch{}
    // Sitzung abgelaufen/Konto weg -> sauber zurück zur Anmeldung statt endlos „Fehler"-Toasts
    if(r.status===401&&ME){ME=null;location.reload();}
    return{status:r.status,data:d};}catch(err){console.error('[Netzwerkfehler]',p,err);return{status:0,data:{error:'Keine Verbindung. Ist der Server erreichbar?'}};}},get(p){return this.req('GET',p);},post(p,b){return this.req('POST',p,b);},put(p,b){return this.req('PUT',p,b);},del(p,b){return this.req('DELETE',p,b);}};

// ===== STATE =====
let ME=null,VIEW_USER=null,PLAN=null,CUR_DAY=null,DIET='training',FOODS=[],DEFS=[],authMode='login';
const APP_VERSION=window.BE_VERSION||'dev'; // vom Server aus package.json in index.html eingesetzt (eine Quelle)
let TODAY=null,UNREAD=0;
const logTimers={}; // Debounce-Timer je Satz (logSet)
// „Heute" = lokales Datum des Geräts (nicht UTC), damit Einträge nach Mitternacht nicht auf dem Vortag landen
const today=()=>fmt(new Date());

// ===== AUTH =====
function toggleAuth(){authMode=authMode==='login'?'register':'login';const reg=authMode==='register';
  document.getElementById('regName').classList.toggle('hidden',!reg);
  const pw=document.getElementById('i_pw');if(pw)pw.setAttribute('autocomplete',reg?'new-password':'current-password'); // Passwort-Manager: neues vs. bestehendes Passwort
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

// ===== PASSWORT VERGESSEN / RESET / VERIFIZIERUNG =====
// openForgot/submitForgot/showResetForm/submitReset leben jetzt in account.js (WP6) – hier bewusst entfernt,
// damit es keine zwei Fassungen derselben Funktion gibt.

// Verifizierungs-Mail erneut senden (eingeloggt)
async function resendVerify(){const r=await API.post('/request-verification');
  if(r.status===200)toast(r.data.already?'Deine E-Mail ist bereits bestätigt ✓':'Bestätigungs-E-Mail gesendet ✓');
  else toast('Fehler');}

// ===== ONBOARDING WIZARD =====
let ONB={step:0,data:{experience:'beginner',days_per_week:3}};
function startOnboarding(){
  // Aus der laufenden App gestartet (Home-Banner)? Dann App-Ansicht + Nav ausblenden und später wiederherstellen.
  const fromApp=!document.getElementById('appView').classList.contains('hidden');
  ONB={step:0,fromApp,data:{experience:'beginner',days_per_week:3,gender:'male',disliked:[]}};
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.add('hidden');
  document.body.classList.remove('has-nav');
  document.getElementById('onbView').classList.remove('hidden');
  renderOnb();}
// Onboarding abbrechen (nur wenn aus der App gestartet) -> zurück in die App
function cancelOnboarding(){document.getElementById('onbView').classList.add('hidden');startApp();}
const ONB_STEPS=[
  {key:'welcome'},
  {key:'goal'},{key:'experience'},{key:'body'},{key:'frequency'},{key:'dislikes'},{key:'result'}
];
function onbSet(k,v){ONB.data[k]=v;onbNext();}
function onbNext(){if(ONB.step<ONB_STEPS.length-1){ONB.step++;renderOnb();}}
function onbBack(){if(ONB.step>0){ONB.step--;renderOnb();}}
function bigChoice(k,v,emoji,title,desc,cur){return `<button class="card" style="display:block;width:100%;text-align:left;margin-bottom:12px;border:2px solid ${cur===v?'var(--red)':'transparent'}" onclick="onbSet('${k}','${v}')">
  <div style="font-size:28px">${emoji}</div><div style="font-weight:700;font-size:18px;margin-top:6px">${title}</div><div style="color:var(--ink2);font-size:14px;margin-top:2px">${desc}</div></button>`;}

async function renderOnb(){const v=document.getElementById('onbView');const s=ONB_STEPS[ONB.step];const d=ONB.data;
  // Fortschrittsbalken nur über die fünf Inhaltsschritte – Willkommen und Ergebnis sind keine Schritte
  const content=ONB_STEPS.filter(x=>x.key!=='welcome'&&x.key!=='result');
  const cIdx=content.findIndex(x=>x.key===s.key);
  const prog=cIdx<0?'':`<div style="display:flex;gap:6px;margin-bottom:24px">${content.map((_,i)=>`<div style="flex:1;height:4px;border-radius:2px;background:${i<=cIdx?'var(--red)':'var(--line)'}"></div>`).join('')}</div>`;
  const backBtn=ONB.step>0&&s.key!=='result'?`<button class="btn sec" style="margin-top:8px" onclick="onbBack()">Zurück</button>`:'';
  let h=`<div style="padding-top:20px">${prog}`;
  if(s.key==='welcome'){
    h+=`<div style="text-align:center"><div style="font-size:48px">💪</div>
      <h1 style="font-size:28px;font-weight:700;margin:16px 0 8px">Willkommen, ${esc2(ME.name.split(' ')[0])}!</h1>
      <p style="color:var(--ink2);font-size:16px;line-height:1.5;margin-bottom:28px">In 5 kurzen Schritten erstellen wir deinen persönlichen Trainings- und Ernährungsplan. Dauert keine Minute.</p>
      <button class="btn" onclick="onbNext()">Los geht's</button>
      ${ONB.fromApp?`<button class="btn sec" style="margin-top:10px" onclick="cancelOnboarding()">Abbrechen</button>`:''}</div>`;
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
      <div id="onbBodyForm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field"><label>Alter</label><input id="o_age" type="number" inputmode="numeric" min="5" max="120" value="${d.age||''}" placeholder="28"></div>
          <div class="field"><label>Größe (cm)</label><input id="o_h" type="number" inputmode="numeric" min="50" max="260" value="${d.height_cm||''}" placeholder="180"></div>
        </div>
        <div class="field"><label>Aktuelles Gewicht (kg)</label><input id="o_w" type="number" step="0.1" inputmode="decimal" min="0" max="500" value="${d.start_weight||''}" placeholder="80"></div>
      </div>
      <button class="btn" onclick="onbBody()">Weiter</button>`;
  } else if(s.key==='frequency'){
    h+=`<h2 style="font-size:24px;font-weight:700;margin-bottom:6px">Wie oft willst du trainieren?</h2><p style="color:var(--ink2);margin-bottom:20px">Pro Woche – ehrlich sein bringt die besten Ergebnisse.</p>
      <div style="text-align:center;margin-bottom:8px"><span id="onbFreqNum" style="font-size:52px;font-weight:700;color:var(--red)">${fmtNum(d.days_per_week)}</span><span style="font-size:20px;color:var(--ink2)"> ×/Woche</span></div>
      <input id="onbFreqRange" class="onb-range" type="range" min="1" max="6" step="1" value="${+d.days_per_week||3}" aria-label="Trainingstage pro Woche" style="--pct:${((+d.days_per_week||3)-1)/5*100}%" oninput="onbFreq(this.value)">
      <p id="onbFreqHint" style="text-align:center;color:var(--ink2);font-size:14px;margin:0 0 24px">${esc2(freqHint(d.days_per_week))}</p>
      <button class="btn" onclick="onbNext()">Weiter</button>`;
  } else if(s.key==='dislikes'){
    const dt=d.diet_type||'all';
    h+=`<h2 style="font-size:24px;font-weight:700;margin-bottom:6px">Ernährung</h2><p style="color:var(--ink2);margin-bottom:16px">Damit dein Plan und die Rezepte passen. Alles später änderbar.</p>
      <div style="margin-bottom:8px;font-size:14px;font-weight:600">Ernährungsweise</div>
      <div class="chip-row" style="margin-bottom:18px">${[['all','Alles'],['vegetarian','🥕 Vegetarisch'],['vegan','🌱 Vegan']].map(([v,l])=>`<button class="daychip ${dt===v?'now':''}" onclick="ONB.data.diet_type='${v}';renderOnb()">${l}</button>`).join('')}</div>
      <div style="margin-bottom:8px;font-size:14px;font-weight:600">Was magst du nicht? <span style="font-weight:400;color:var(--ink3)">(optional)</span></div>
      <div id="onbDislikes"><div class="spinner"></div></div>
      <button class="btn" style="margin-top:8px" onclick="onbNext()">Weiter</button>`;
    v.innerHTML=h+(backBtn||'')+'</div>';loadOnbDislikes();return;
  } else if(s.key==='result'){
    h+=`<div id="onbResult" style="text-align:center"><div class="spinner"></div><p style="color:var(--ink2)">Wir berechnen deinen Plan…</p></div>`;
    v.innerHTML=h+'</div>';loadOnbResult();return;
  }
  h+=backBtn+'</div>';v.innerHTML=h;}
// Regler-Schritt: nur Zahl, Hinweis und Balkenfüllung nachziehen. Ein renderOnb() bei jedem input tauschte
// den Regler unter dem Finger aus (activeElement wurde BODY) und brach das Ziehen auf dem Touchscreen ab.
function onbFreq(v){const n=Math.max(1,Math.min(6,Math.round(+v||3)));ONB.data.days_per_week=n;
  const el=document.getElementById('onbFreqRange');if(el)el.style.setProperty('--pct',((n-1)/5*100)+'%');
  const nEl=document.getElementById('onbFreqNum');if(nEl)nEl.textContent=fmtNum(n);
  const hEl=document.getElementById('onbFreqHint');if(hEl)hEl.textContent=freqHint(n);}
function freqHint(n){return {1:'Ganzkörper – besser als nichts!',2:'2× Ganzkörper – solider Einstieg.',3:'Push/Pull/Beine – sehr effektiv.',4:'Ober-/Unterkörper-Split – top für Aufbau.',5:'5er-Split – für Ambitionierte.',6:'6× – nur mit guter Erholung.'}[n]||'';}
async function loadOnbDislikes(){const el=document.getElementById('onbDislikes');if(!el)return;
  const r=await API.get('/disliked/'+ME.id);const opts=r.data?.options||[];
  if(!ONB.data.disliked)ONB.data.disliked=[];
  const sel=new Set(ONB.data.disliked);
  el.innerHTML=`<div style="display:flex;flex-wrap:wrap">`+opts.map(o=>`<button class="daychip ${sel.has(o)?'now':''}" style="margin:0 6px 8px 0" onclick="toggleOnbDislike('${esc(o)}',this)">${sel.has(o)?'✓ ':''}${o}</button>`).join('')+`</div>`;}
function toggleOnbDislike(name,btn){if(!ONB.data.disliked)ONB.data.disliked=[];
  const i=ONB.data.disliked.indexOf(name);
  if(i>=0){ONB.data.disliked.splice(i,1);btn.classList.remove('now');btn.textContent=name;}
  else{ONB.data.disliked.push(name);btn.classList.add('now');btn.textContent='✓ '+name;}}
// Fehler stehen am Feld, nicht als Toast über den Feldern (WP0-Helfer showFieldErr)
function onbBody(){const age=+val('o_age'),h=+val('o_h'),w=+val('o_w');
  if(!age)return showFieldErr('onbBodyForm','Bitte trag dein Alter ein.','o_age');
  if(age<14||age>100)return showFieldErr('onbBodyForm','Bitte ein realistisches Alter (14–100).','o_age');
  if(!h)return showFieldErr('onbBodyForm','Bitte trag deine Größe ein.','o_h');
  if(!w)return showFieldErr('onbBodyForm','Bitte trag dein aktuelles Gewicht ein.','o_w');
  ONB.data.age=age;ONB.data.height_cm=h;ONB.data.start_weight=w;onbNext();}
async function loadOnbResult(){const r=await API.post('/onboarding/preview',ONB.data);
  if(r.status!==200){document.getElementById('onbResult').innerHTML='<p>Fehler. Bitte zurück und erneut.</p>';return;}
  const p=r.data;const n=p.nutrition;
  const goalTxt={muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'}[ONB.data.goal];
  document.getElementById('onbResult').innerHTML=`
    <div style="font-size:40px">✅</div>
    <h2 style="font-size:24px;font-weight:700;margin:12px 0 6px">Dein Plan steht!</h2>
    <p style="color:var(--ink2);margin-bottom:6px">Ziel: ${goalTxt}${p.bmi?' · BMI '+fmtNum(p.bmi,1):''}</p>
    ${ME&&ME.email?`<p class="caption" style="margin-bottom:22px">Bestätigungs-Mail an ${esc2(ME.email)} unterwegs.</p>`:'<div style="height:16px"></div>'}
    <div class="surface pad" style="text-align:left;margin-bottom:14px">
      <div style="font-weight:600;margin-bottom:10px">🍽️ Deine Kalorienziele</div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line)"><span style="color:var(--ink2)">Trainingstag</span><b>${fmtNum(n.trainKcal)} kcal</b></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line)"><span style="color:var(--ink2)">Ruhetag</span><b>${fmtNum(n.restKcal)} kcal</b></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--ink2)">Protein / Carbs / Fett</span><b>${fmtNum(n.macros.protein)} / ${fmtNum(n.macros.carbs)} / ${fmtNum(n.macros.fat)} g</b></div>
    </div>
    <div class="surface pad" style="text-align:left;margin-bottom:20px">
      <div style="font-weight:600;margin-bottom:10px">🏋️ Dein Trainingsplan (${p.plan.length} Tage)</div>
      ${p.plan.map(d=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line)"><span>${d.name}</span><span style="color:var(--ink2);font-size:13px">${d.exercises.length} Übungen</span></div>`).join('')}
    </div>
    <button class="btn" onclick="finishOnboarding()">Loslegen</button>
    <button class="btn sec" style="margin-top:8px" onclick="ONB.step=1;renderOnb()">Etwas ändern</button>`;}
async function finishOnboarding(){const r=await API.post('/onboarding/complete',ONB.data);
  if(r.status!==200)return toast('Fehler beim Speichern');
  // ME aktualisieren
  const me=await API.get('/me');ME=me.data.user;
  document.getElementById('onbView').classList.add('hidden');
  startApp();toast('Willkommen an Bord! 🎉');}

// ===== START =====
async function startApp(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('onbView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.body.classList.add('has-nav');
  // Service Worker immer registrieren (PWA/Push-Klicks funktionieren dann unabhängig von enablePush)
  try{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}catch(e){}
  invalidateView();CUR_TAB=null;
  applyAvatar();
  setTimeout(checkPendingShare,700); // wartender Teilen-Link? -> Übernehmen-Dialog
  // Die Home-Tour startet jetzt am Ende von renderHome (kein Timer mehr, nie über dem Spinner)
  setTimeout(maybeShowInstallHint,1600); // iOS: Hinweis „Zum Home-Bildschirm" (einmalig, schlanke Notiz unter dem Header)
  API.get('/foods').then(r=>FOODS=r.data?.foods||[]);
  fetch('/api/definitions').then(r=>r.json()).then(d=>DEFS=d.definitions||[]);
  COACH_CONTEXT=null;
  // Neue Version deployt? (Frontend gecacht) -> Aktions-Toast statt stummem Auseinanderlaufen
  API.get('/version').then(vr=>{if(vr.status===200&&vr.data?.version&&vr.data.version!==APP_VERSION)toast('Neue Version verfügbar',{label:'Neu laden',fn:()=>location.reload()});}).catch(()=>{});
  await loadMessages();
  startMsgPolling();
  buildNav();
  if(ME.role==='admin'){go('admin');}
  else if(ME.role==='coach'){VIEW_USER=null;go('athletes');}
  else{VIEW_USER=ME.id;await loadPlan();if(!applyHashRoute())go('home');}
}
// Deep-Links aus Push-Mitteilungen: #mindset, #mindset/wheel, #mindset/challenge (nur eigenes Athleten-Konto).
// Der Hash wird nach dem Sprung entfernt, damit ein Neuladen wieder auf der Home landet.
function applyHashRoute(){const h=location.hash||'';
  if(!h.startsWith('#mindset')||!ME||ME.role!=='athlete'||COACH_CONTEXT||typeof renderMindset!=='function')return false;
  const sub=(h.split('/')[1]||'heute').replace(/[^a-z]/gi,'');
  renderMindset.tab=sub||'heute';
  try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}
  go('mindset');return true;}
window.addEventListener('hashchange',()=>{if(ME&&document.getElementById('appView')&&!document.getElementById('appView').classList.contains('hidden'))applyHashRoute();});
// Wenn ein Coach gerade einen Athleten "betreten" hat, steht hier dessen Name
let COACH_CONTEXT=null;
let VIEW_USER_PROFILE=null; // Profil des aktuell betrachteten Nutzers (für Coach-Kontext)
// Nav-Varianten (WP1): Athlet 5 Tabs · Coach: Athleten/Nachrichten/Vorlagen · Admin: Verwaltung/Athleten ·
// Coach/Admin im Athleten-Kontext: die 5 Athleten-Tabs mit identischen Labels (Verlassen über die Kontextleiste).
function buildNav(){const nav=document.getElementById('navBar');if(!nav||!ME)return;
  let items;
  const athleteTabs=[['home','home','Home'],['workout','dumbbell','Training'],['diet','utensils','Ernährung'],['mindset','brain','Mindset'],['tracker','chartLine','Analyse']];
  if(ME.role!=='athlete'&&COACH_CONTEXT)items=athleteTabs;
  else if(ME.role==='admin')items=[['admin','settings','Verwaltung'],['athletes','users','Athleten']];
  else if(ME.role==='coach')items=[['athletes','users','Athleten'],['messages','mail','Nachrichten'],['templates','fileSpreadsheet','Vorlagen']];
  else items=athleteTabs;
  nav.innerHTML=items.map(([p,ic,l])=>`<button class="navbtn" data-p="${p}" aria-label="${l}" onclick="go('${p}')">${icon(ic,24)}<div class="nl">${l}</div></button>`).join('');
  const cur=CUR_TAB;if(cur)nav.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('on',b.dataset.p===cur));
  // Weniger als zwei Ziele -> Leiste ausblenden (kein Platzhalter, kein Abstand unten)
  document.body.classList.toggle('no-nav',items.length<2);document.body.classList.toggle('has-nav',items.length>=2);}

// ===== ROUTER + ANSICHTS-CACHE (stale-while-revalidate) =====
const TITLES={home:'Home',workout:'Training',diet:'Ernährung',mindset:'Mindset',tracker:'Analyse',athletes:'Athleten',admin:'Verwaltung',messages:'Nachrichten',templates:'Vorlagen'};
// VIEW_CACHE[tab]={html,scrollY,ts,user,date}. go() malt den Cache synchron (kein Spinner, keine Animation),
// ruft dann den Renderer mit {cached:true} – der frischt im Hintergrund auf. invalidateView(tab?) leert.
let VIEW_CACHE={},CUR_TAB=null;
function invalidateView(tab){if(tab)delete VIEW_CACHE[tab];else VIEW_CACHE={};}
function _cacheValid(c){return !!(c&&c.html&&c.user===VIEW_USER&&c.date===today()&&!(c.html.length<400&&c.html.indexOf('class="spinner"')>=0));}
// Ansicht in den Cache legen (html = aktueller Inhalt von #views, ohne die Erstmontage-Animation)
function cacheView(tab,html){const v=document.getElementById('views');if(!tab)return;
  const h=html!=null?String(html):(v?v.innerHTML:'');if(!h||(h.length<400&&h.indexOf('class="spinner"')>=0))return;
  VIEW_CACHE[tab]={html:h.replace(/class="page on first"/g,'class="page on"'),scrollY:window.scrollY||0,ts:Date.now(),user:VIEW_USER,date:today()};}
function _snapshotView(tab){cacheView(tab);}
function _renderer(p){
  const map={admin:'renderAdmin',athletes:'renderAthletes',home:'renderHome',workout:'renderWorkout',diet:'renderDiet',mindset:'renderMindset',tracker:'renderTracker',
    messages:'renderMessagesTab',templates:'renderTemplatesTab'};
  const fn=window[map[p]];if(typeof fn==='function')return fn;
  if(p==='messages')return _renderMessagesFallback;if(p==='templates')return _renderTemplatesFallback;return null;}
// go(tab, opts?) – opts.start (Training), opts.cached wird von go() gesetzt; go('tracker','training') wählt das Segment.
function go(p,opts){
  if(typeof opts==='string'){const seg=opts;opts={};if(p==='tracker'&&typeof renderTracker==='function')renderTracker.tab=seg;}
  opts=opts||{};
  if(typeof closeAllSheets==='function')closeAllSheets(); // ein Sheet überlebt keinen Tabwechsel
  // …und eine laufende Coachmark-Tour auch nicht: ihr Overlay liegt über allem und zeigt auf Elemente,
  // die es auf dem neuen Tab nicht mehr gibt (endTour räumt Overlay, Scroll-Sperre und Resize-Handler auf).
  if(typeof endTour==='function'&&document.getElementById('tourOv'))endTour();
  // Coach/Admin verlässt den Athleten-Kontext (Kontextleiste „Verlassen" oder Tab „Athleten")
  if((p==='athletes'||p==='admin'||p==='messages'||p==='templates')&&ME&&ME.role!=='athlete'&&COACH_CONTEXT){COACH_CONTEXT=null;VIEW_USER=null;VIEW_USER_PROFILE=null;PLAN=null;TODAY=null;invalidateView();buildNav();}
  const v=document.getElementById('views');if(!v)return;
  const same=CUR_TAB===p;
  if(CUR_TAB&&!same)_snapshotView(CUR_TAB); // verlassene Ansicht für die Rückkehr merken
  CUR_TAB=p;
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
  const ht=document.getElementById('hdrTitle');
  if(ht)ht.innerHTML=(p==='home'&&!coachView())?'<span class="wordmark" aria-label="BE INEVITABLE">BE INEVITABLE</span>':esc2(TITLES[p]||'');
  mountCtxBar();
  const c=VIEW_CACHE[p];
  if(_cacheValid(c)){v.innerHTML=c.html;window.scrollTo(0,same?0:(c.scrollY||0));opts.cached=true;}
  else{window.scrollTo(0,0);opts.cached=false;}
  const r=_renderer(p);if(!r)return;
  try{const out=r(v,opts);if(out&&typeof out.catch==='function')out.catch(e=>console.error('[go]',p,e));return out;}catch(e){console.error('[go]',p,e);}}
// Coach-Kontextleiste unter dem Header: renderCtxBar() aus coach.js (WP7), sonst schlanke Fallback-Leiste
function mountCtxBar(){const cb=document.getElementById('ctxBar');if(!cb)return;
  if(!(coachView()&&COACH_CONTEXT)){cb.innerHTML='';return;}
  let h='';
  if(typeof renderCtxBar==='function'){try{h=renderCtxBar()||'';}catch(e){console.error('[ctxBar]',e);h='';}}
  if(!h){const name=String(COACH_CONTEXT||'');const initial=esc2(name.charAt(0).toUpperCase()||'?');
    const msg=(typeof coachQuickMessage==='function')?`<button class="btn icon sm" aria-label="Nachricht an ${esc2(name)}" onclick="coachQuickMessage(${VIEW_USER},'${esc(name)}')">${icon('mail',18)}</button>`:'';
    h=`<div class="ctx-av" aria-hidden="true">${initial}</div><div class="ctx-t">Du siehst: <b>${esc2(name)}</b></div>${msg}<button class="btn sm sec" onclick="go('athletes')">Verlassen</button>`;}
  cb.innerHTML=h;
  if(VIEW_USER&&typeof loadAthAvatars==='function'){try{loadAthAvatars([VIEW_USER]);}catch(e){}}}
// Fallback-Tab „Nachrichten" (Coach), solange coach.js kein renderMessagesTab liefert
async function _renderMessagesFallback(v,opts){opts=opts||{};
  if(!opts.cached)v.innerHTML=`<div class="page on${opts.cached?'':' first'}" id="msgPage">${skeleton(3)}</div>`;
  const msgs=await loadMessages();
  const rel=iso=>{const t=Date.parse(iso);if(isNaN(t))return '';const m=Math.round((Date.now()-t)/60000);
    if(m<60)return 'vor '+pl(Math.max(1,m),'Min.','Min.');const h=Math.round(m/60);if(h<24)return 'vor '+pl(h,'Std.','Std.');
    const d=Math.round(h/24);return d<7?'vor '+pl(d,'Tag','Tagen'):fmtDate(iso,{});};
  let h='<div class="page on" id="msgPage">';
  if(ME.role!=='athlete'&&typeof openBroadcast==='function')h+=`<button class="btn block mb-4" onclick="openBroadcast()">${icon('send',18)} Nachricht an alle Athleten</button>`;
  if(!msgs.length)h+=emptyState({icon:'mail',title:'Keine Nachrichten',text:'Antworten deiner Athleten und Systemhinweise erscheinen hier.'});
  else h+='<div class="rows">'+msgs.map(m=>`<div class="row tap" onclick="openMessages()"><div class="r-ic">${icon(m.kind==='system'?'info':'mail',22)}</div><div class="rl"><span class="truncate">${esc2(m.title||'Nachricht')}</span><small>${esc2(m.from_name||(m.kind==='system'?'System':''))}${m.from_name?' · ':''}${rel(m.created_at)}</small></div><div class="rr">${m.read?'':'<span class="pill red">Neu</span>'}</div></div>`).join('')+'</div>';
  h+='</div>';v.innerHTML=h;cacheView('messages');}
// Fallback-Tab „Vorlagen" (Coach): Einstieg in das bestehende Vorlagen-Sheet
function _renderTemplatesFallback(v,opts){opts=opts||{};
  const has=typeof openTemplates==='function';
  v.innerHTML=`<div class="page on${opts.cached?'':' first'}">${emptyState({icon:'fileSpreadsheet',title:'Plan-Vorlagen',text:'Gespeicherte Trainingspläne, die du jedem Athleten mit einem Tipp zuweisen kannst.',btn:has?{label:'Vorlagen öffnen',onclick:'openTemplates()'}:null})}</div>`;
  cacheView('templates');}

// ===== DATA LOADERS =====
async function loadPlan(){const r=await API.get('/plan/'+VIEW_USER);if(r.status===200){PLAN=r.data;
  if(PLAN.days.length&&!PLAN.days.find(d=>d.id===CUR_DAY))CUR_DAY=PLAN.days[0].id;}}
async function loadToday(){const r=await API.get('/today/'+VIEW_USER);if(r.status===200)TODAY=r.data;}
// Glocken-Badge = NUR ungelesene Nachrichten (System-Hinweise zählen nicht mehr mit – sie leben im Nachrichten-Sheet/Profil)
async function loadMessages(){const r=await API.get('/messages/'+ME.id);const m=r.data?.messages||[];
  UNREAD=m.filter(x=>!x.read).length;
  const b=document.getElementById('bellBadge');
  if(b){b.textContent=UNREAD>9?'9+':UNREAD;b.classList.toggle('hidden',UNREAD===0);}return m;}
// Offene System-Hinweise (E-Mail bestätigen, Health-Import) – Datenquelle für das Nachrichten-Sheet und das Profil (WP6)
function pendingNotifications(){const out=[];if(!ME)return out;
  if(ME.role==='athlete'||ME.id===VIEW_USER){
    if(ME.email && !ME.email_verified) out.push({type:'verify'});
    if(ME.health_reminder){const li=ME.last_health_import?Date.parse(ME.last_health_import):0;const days=li?Math.floor((Date.now()-li)/864e5):999;if(days>=7)out.push({type:'health',days,li});}
  }
  return out;}
// Regelmäßig auf neue Nachrichten prüfen (alle 30s), damit Coach-Nachrichten zeitnah auftauchen
let msgPoll=null;
function startMsgPolling(){clearInterval(msgPoll);msgPoll=setInterval(()=>{if(ME)loadMessages();},30000);}
// App kommt aus dem Hintergrund: war sie > 5 Min. weg, gelten alle gecachten Ansichten als veraltet
// (die aktive Home frischt sich über refreshHomeIfActive in place auf – ohne den DOM zu leeren)
let _hiddenAt=0;
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){_hiddenAt=Date.now();return;}
  if(_hiddenAt&&Date.now()-_hiddenAt>5*60000)invalidateView();_hiddenAt=0;});

// ===== TOUR-TIMING (WP1) =====
// Die komplette Tour-Mechanik (TOUR_DEFS, runTour, drawTourStep, maybeStartTour, maybeStartTabTour, endTour)
// und der iOS-Installhinweis liegen in account.js (WP6) – dort sind Markup, CSS und Timing aus einer Hand.
// WP1 steuert nur die Aufrufpunkte: renderHome ruft am Ende maybeStartTour(); die Tab-Renderer rufen
// maybeStartTabTour(tab,{deferred:true}); go() zählt keine Besuche mehr mit (das macht maybeStartTabTour selbst).
