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
  copy:'M9 9h10v10H9zM5 15V5h10' /* Kopieren */,
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.5 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1',
  devices:'<rect x="2" y="5" width="13" height="10" rx="2"/><path d="M6 19h5M8.5 15v4"/><rect x="17" y="8" width="5" height="11" rx="1.5"/>',
  fileSpreadsheet:'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h8M12 13v4',
  // --- A-IV.5: die 24 Glyphen, die bis 2.7.0 als Farb-Emoji ausgewichen wurden ---------------
  // Die App sprach zwei Ikonografien: 62 monochrome SVG hier UND 121 Emoji im Quelltext
  // (accent.mjs „Emoji im Quelltext"). Emoji zeichnet jedes System anders, sie kennen keinen
  // Dunkelmodus und keine Strichstärke. Jede Zeile hier ist ein Emoji, das nicht mehr nötig ist –
  // das Emoji steht im Kommentar NICHT als Zeichen, sondern als Name: accent.mjs zaehlt
  // Extended_Pictographic im Quelltext, und ein Kommentar-Emoji ist dort derselbe Treffer
  // wie ein gerendertes. Der Name traegt die Zuordnung genauso gut.
  lockOpen:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.7"/>',      // offenes Schloss
  sprout:'M12 21v-7M12 14c0-3.6-2.8-6-7-6 0 3.6 2.8 6 7 6zM12 14c0-3.2 2.5-5.5 6-5.5 0 3.2-2.5 5.5-6 5.5z', // Keimling
  leaf:'M20 4c0 9.4-5.2 14-13.2 14H4C4 9.6 9.2 4.6 17 4.6zM4.5 20C6.6 14.4 10.4 10.4 15 8',                 // Zweig
  carrot:'M2.5 21.5c4-1.2 8.6-4.8 11.5-10.5l-4.5-4.5C4.8 9.4 3.4 17.4 2.5 21.5zM14 8.5 16.5 6M16 5.5c0-2 1-3 3-3M18.5 8c2 0 3-1 3-3', // Karotte
  packageBox:'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',                                 // Paket
  rocket:'M12 2.5c3 2.2 4.8 5.6 4.8 9.2L14.5 15h-5L7.2 11.7c0-3.6 1.8-7 4.8-9.2zM9.5 15 8 21l4-2 4 2-1.5-6M12 9h.01', // Rakete
  telescope:'m13.5 6.5 5.5 3-9.5 5-5.5-3zM9.5 14.5 6.5 20M13.5 6.5l-1-3 4-1 1.2 3M12 15.5V21M9 21h6',       // Fernrohr
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/>',                   // Kompass
  hourglass:'M6 2.5h12M6 21.5h12M8 2.5V6c0 2.2 4 4 4 6s-4 3.8-4 6v3.5M16 2.5V6c0 2.2-4 4-4 6s4 3.8 4 6v3.5', // Sanduhr
  wheel:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21M5.6 5.6l4.6 4.6M13.8 13.8l4.6 4.6M18.4 5.6l-4.6 4.6M10.2 13.8l-4.6 4.6"/>', // Riesenrad
  handshake:'M12 8.5 9.6 6.1a2 2 0 0 0-2.8 0L3 9.9l4.6 4.6M12 8.5l2.4-2.4a2 2 0 0 1 2.8 0L21 9.9l-4.6 4.6M8.2 15.1l2.4 2.4a1.5 1.5 0 0 0 2.1-2.1M11.4 16.3l2 2a1.5 1.5 0 0 0 2.1-2.1', // Handschlag
  puzzle:'M10 3.5h4v2.8a1.9 1.9 0 1 0 3.8 0V9h2.7v4h-2.7a1.9 1.9 0 1 0 0 3.8v3.7h-4v-2.8a1.9 1.9 0 1 0-3.8 0v2.8H6v-3.7H3.5v-4H6V9h4z', // Puzzleteil
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3.2 2.6 14.8 0 18M12 3c-2.6 3.2-2.6 14.8 0 18"/>', // Weltkugel
  wallet:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18M16.5 14.5h.01M6 6V4.5h11"/>',// Geldsack
  bowl:'M3 11h18a9 9 0 0 1-18 0zM8 8c-.4-1.8 1-3 2.4-2.4M13 7c.6-1.8 2.6-2.2 3.8-1',                         // Salatschuessel
  run:'<circle cx="15.5" cy="4.5" r="2"/><path d="m7.5 21.5 2.8-6-2.3-3.3 1-4.7 4 1.9 2.8 2.9M9.5 9.3 5 10.5M12.8 14.4l3.2 2 1.2 5"/>', // Laeufer
  meditate:'<circle cx="12" cy="5" r="2.5"/><path d="M12 10c-2.1 0-3.2 1.6-3.2 3.6L5.5 17.5l3.4 1 3.1-2 3.1 2 3.4-1-3.3-3.9c0-2-1.1-3.6-3.2-3.6zM4.5 20.5h15"/>', // Meditation
  ban:'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',                                       // Verbotszeichen
  meat:'M16.5 2.8a7 7 0 0 0-9.3 9.3c.9 1.9-.1 3-1.6 4.5S3 20.4 4.6 21.4s3.1-.4 4.6-1.9 2.6-2.5 4.5-1.6a7 7 0 0 0 2.8-15.1zM11 12.5a3 3 0 0 1 4.2-4.2', // Steak
  glass:'M6 3h12l-1.5 11.2a3 3 0 0 1-3 2.6h-3a3 3 0 0 1-3-2.6zM9 21h6M12 16.8V21',                           // Milchglas
  coffee:'M4 8h13v5.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9.5h1.8a2.5 2.5 0 0 1 0 5H17M3.5 21.5H17',           // Kaffee
  dice:'<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M8.4 8.4h.01M15.6 8.4h.01M8.4 15.6h.01M15.6 15.6h.01M12 12h.01"/>', // Wuerfel
  checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.8 2.8L16 9"/>',                              // gruener Haken
  bookOpen:'M12 6.6C10.4 5 7.9 4.5 4 4.5v13c3.9 0 6.4.5 8 2 1.6-1.5 4.1-2 8-2v-13c-3.9 0-6.4.5-8 2.1zM12 6.6V21' // offenes Buch / Lesezeichen
};
function icon(name,size,cls){const b=ICONS[name];if(!b)return '';size=size||20;
  const inner=b.charAt(0)==='<'?b:`<path d="${b}"/>`;
  return `<svg class="ic${cls?' '+cls:''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;}

// ===== FORMAT-HELFER (de-DE überall) =====
// HTML-Escaping für Text UND Attributwerte (auch " und ' – damit value="…" nie aufbricht).
// Liegt hier, weil jede Datei es nutzt (früher in coach.js).
function esc2(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

// ===== DIE DREI BAU-HELFER (DESIGN-4 Teil 4.5 / 5.7) ==========================================
// Sie sind ab Welle 1 der EINZIGE erlaubte Weg, eine Zeile, eine Gruppe oder einen Ring zu bauen.
// Eine handgeschriebene `class="row"` im JS ist ab jetzt ein Abnahme-Fehler (DESIGN-4 9.3, K6).
//
// WARUM HELFER UND NICHT NUR CSS: Gemessen gab es 25 Zeilenformen, drei davon zeichengleiche
// Kopien derselben Zeile in verschiedenen Dateien. Eine CSS-Klasse verhindert das nicht - sie
// wartet darauf, dass jemand sie richtig benutzt. Eine Funktion, die das Markup erzeugt, macht
// die richtige Form zur bequemsten. Solange es zwei Wege gibt, gibt es zwei Dialekte.
//
// WELLE 1 BAUT SIE NUR - BENUTZT WERDEN SIE AB WELLE 3/4. Deshalb steht hier noch kein Aufruf.

// rowHTML(o) - DIE EINE ZEILE. 56 px, Symbol - Titel - Unterzeile - Wert - Chevron.
//   o = {icon, title, sub, value, pill:{text,tone}, tap:'js()', switch:{name,on}, danger, id}
//   - icon:   Name aus ICONS, immer 24 px (eine Groesse, ein Set, eine Strichstaerke)
//   - sub:    die Unterzeile, 13/400 --ink2 - der Ort fuer "woher kommt dieser Wert"
//   - value:  der graue Wert rechts. Er beantwortet "wie ist es eingestellt?" OHNE Tap (A28).
//   - pill:   Statusmarke rechts, IMMER mit Wort - eine Pille ohne Text gibt es nicht (A47).
//   - tap:    macht die Zeile zu einem <button> und setzt das Chevron. Das Chevron bedeutet genau
//             eines: fuehrt weiter (G7/A27). Wer nur einen Wert zeigt, uebergibt kein tap.
//   - switch: macht die Zeile zu einem <label> mit Schalter. Der Zeilentext IST die Beschriftung;
//             der Schalter bekommt keine eigene (A29). Was er bewirkt, steht im .rows-f darunter.
//   - danger: zerstoerende Aktion - eigene, einzeilige Gruppe, zentriert, rot (A30).
// ABWEICHUNG VON DESIGN-4 4.5, bewusst: der Bauplan dort schreibt fuer `tap`
// String(o.tap).replace(/"/g,'&quot;'), hier steht esc2(o.tap). esc2 maskiert zusaetzlich & < > und
// ', der HTML-Parser dekodiert sie, BEVOR der JS-Parser den onclick-Ausdruck liest - das Ergebnis
// ist identisch, nur haelt es auch dann, wenn im Ausdruck ein & (a&&b) oder ein < (i<n) steht. Die
// Spezifikationsfassung wuerde daraus ein kaputtes Attribut machen. Strenger, nicht anders.
function rowHTML(o){
  o=o||{};
  const ic=o.icon?`<span class="r-ic">${icon(o.icon,24)}</span>`:'';
  const sub=o.sub?`<small>${esc2(o.sub)}</small>`:'';
  const pill=o.pill?`<span class="pill ${esc2(o.pill.tone||'neutral')}">${esc2(o.pill.text)}</span>`:'';
  const val=(o.value!=null&&o.value!=='')?esc2(o.value):'';
  const rr=(pill||val)?`<span class="rr">${pill}${val}</span>`:'';
  const id=o.id?` id="${esc2(o.id)}"`:'';
  const rl=`<span class="rl">${esc2(o.title)}${sub}</span>`;
  if(o.switch)return `<label class="row switch"${id}>${ic}${rl}`
    +`<span class="rr"><input type="checkbox" class="sw" name="${esc2(o.switch.name)}"`
    +`${o.switch.on?' checked':''}></span></label>`;
  // Die zerstoerende Zeile bekommt KEIN Chevron: sie fuehrt nirgendwohin, sie loescht (G7/A30).
  if(o.tap)return `<button type="button" class="row tap${o.danger?' danger':''}"${id}`
    +` onclick="${esc2(o.tap)}">${ic}${rl}${rr}`
    +(o.danger?'':'<span class="chev" aria-hidden="true"></span>')+'</button>';
  return `<div class="row${o.danger?' danger':''}"${id}>${ic}${rl}${rr}</div>`;
}

// groupHTML(head, rows[], foot, o) - Ueberschrift + Gruppe + Fusstext in EINEM Stueck.
//   o = {action:{label,tap}, lg:true, inset:false}
//   - head:  die Abschnittsueberschrift (.rows-h), 17/700 GEMISCHT - keine Versalien (A36).
//   - foot:  DER ERKLAERUNGSORT DER APP (.rows-f, G8/A25). Grauer Fliesstext, mehrzeilig erlaubt,
//            dauerhaft sichtbar. Er ersetzt jedes i-Symbol, jeden Tooltip und jedes title-Attribut.
//            Wer ein Kuerzel benutzt, erklaert es hier - sonst gar nicht (G9/K21).
//   - action: die Wortaktion rechts in der Ueberschrift. Sie ersetzt die graue Pille (.btn.sm).
//   - inset:  die Trennlinie rueckt auf 52 px ein und steht damit buendig unter dem Titel statt
//            unter dem Symbol (A41). 52 px sind die Symbolspalte - eine Gruppe OHNE Symbole
//            bekaeme damit eine Linie, die 52 px neben nichts beginnt. Der Wert wird deshalb NICHT
//            aus einem Standardwert geraten, sondern an den Zeilen GEMESSEN: hat mindestens eine
//            Zeile eine Symbolspalte (.r-ic), gilt inset, sonst nicht. `o.inset` ueberstimmt das
//            ausdruecklich (true/false), so bleibt der Schalter aus DESIGN-4 4.5 erhalten.
function groupHTML(head,rows,foot,o){
  o=o||{};
  const a=(o.action&&o.action.label)
    ?`<button type="button" class="a" onclick="${esc2(o.action.tap)}">${esc2(o.action.label)}</button>`:'';
  const h=head?`<h2 class="rows-h${o.lg?' lg':''}">${esc2(head)}${a}</h2>`:'';
  const f=foot?`<p class="rows-f">${esc2(foot)}</p>`:'';
  const body=Array.isArray(rows)?rows.join(''):String(rows||'');
  const inset=(o.inset==null)?/class="r-ic"/.test(body):!!o.inset;
  return h+`<div class="rows${inset?' inset':''}">${body}</div>`+f;
}

// ringHTML(pct, size, label) - DER EINZIGE RING DER APP (DESIGN-4 5.7).
//   Ring = Tagesziel. Balken = Anteil in einer Liste. Zahl = alles andere.
//   HOECHSTENS EINER je Bildschirm, und NIE ROT. Gemessen gab es zwei Implementierungen: die eine
//   neutral mit runden Enden (home.js), die andere mit fest verdrahtetem --red und stumpfen Enden
//   (training.js) - damit war der Trainingsring die einzige rot gefuellte Fortschrittsflaeche der
//   App, gegen die eigene Hausregel "ein Balken ist eine Menge, kein Ruf". Hier gibt es eine.
//   pct   0..1 (wird geklemmt)          size  46 in einer Zeile, 128 als Held
//   label Text INNEN. VOREINSTELLUNG: NICHTS. Das WORT steht daneben, nicht im Ring:
//         nicht "0/27", sondern "27 Saetze - 0 geschafft" (G9).
//         Bis zur Nachbesserung schrieb der Helfer ohne label eine Prozentzahl hinein - bei einem
//         frischen Tag also "0 %", und genau das verbietet DESIGN-4 5.7/G9 woertlich ("Nicht 0 %,
//         sondern noch nichts geloggt"). Eine Voreinstellung, die man ueberschreiben MUSS, um die
//         Regel einzuhalten, ist die falsche Voreinstellung. Wer die Zahl will, schreibt sie hin:
//         ringHTML(p,128,Math.round(p*100)+'%').
//   Der Ring ist aria-hidden: er wiederholt nur, was daneben in Woertern steht.
function ringHTML(pct,size,label){
  pct=Math.max(0,Math.min(1,+pct||0));
  size=+size||46;
  const stroke=4,r=(size-stroke)/2,c=2*Math.PI*r,off=c*(1-pct),cx=size/2;
  // Untergrenze 12 px (--t-min): unter 12 px wird auf dunklem Grund nichts mehr gelesen, geraten.
  const fs=Math.max(12,Math.round(size*0.27));
  const txt=(label===null||label===undefined)?'':String(label);
  const inner=txt?`<text x="${cx}" y="${cx}" text-anchor="middle" dominant-baseline="central"`
    +` font-size="${fs}" font-weight="700" fill="var(--ink)">${esc2(txt)}</text>`:'';
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`
    +`<circle cx="${cx}" cy="${cx}" r="${r.toFixed(2)}" fill="none" stroke="var(--surface3)" stroke-width="${stroke}"/>`
    +`<circle class="ring-fg" cx="${cx}" cy="${cx}" r="${r.toFixed(2)}" fill="none" stroke="var(--ink2)"`
    +` stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}"`
    +` stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${cx} ${cx})"/>${inner}</svg>`;
}

function fmtNum(v,digits){if(v==null||v===''||isNaN(+v))return '–';digits=digits||0;
  return (+v).toLocaleString('de-DE',{minimumFractionDigits:digits,maximumFractionDigits:digits});}
// fmtDate('2026-09-07',{weekday:'short'|'long', month:'short'|'long'}) -> „Mo., 7. Sept." / „Montag, 7. September"
// Datum + Uhrzeit, z.B. „8. Sept., 23:50". Nimmt ISO-Strings mit und ohne 'T'
// (SQLite liefert "2026-09-08 21:50:00" – das versteht Safari sonst nicht).
function fmtDateTime(v){if(!v)return '';const s=String(v).trim().replace(' ','T');
  const iso=/Z|[+-]\d{2}:?\d{2}$/.test(s)?s:s+'Z';const dt=new Date(iso);
  if(isNaN(dt))return '';
  return dt.toLocaleDateString('de-DE',{day:'numeric',month:'short'})+', '+dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});}
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

// ===== A-IV.5 · DIE ERFAHRUNGS-STUFE, IN WORTEN (Präfix `ds`) =====
// Die Stufe schaltet in der App Felder an und aus. Gelesen wird sie an drei Stellen, alle mit
// derselben Rangfolge `experience_coach || experience` (CRITIC K1: `experience` ist die Selbstangabe
// des Athleten, `experience_coach` die Übersteuerung des Coachs):
//   training.js  twLevel / twRirOn / twSetTypesOn   analysis.js  an2Level   coach.js  co2LevelOf
// GESAGT wurde bis 2.7.0 nur dem COACH, was die Stufe bewirkt (coach.js CO2_LV_TXT). Der Athlet,
// der dieselbe Stufe im Profil mit EINEM Tipp selbst umstellt, bekam „Gespeichert ✓" – und die
// RIR-Spalte war weg, ohne dass irgendein Satz sie je erwähnt hätte (Befund Ü-2, STRATEGY 4.0/P10).
// Warum der Text HIER steht und nicht in coach.js: coach.js ist ein nachgeladenes Modul
// (server.js BOOT_MODULES) und beim Athleten überhaupt nicht im Dokument. core.js lädt jede Rolle.
// P9 ist bindend – hier steht nur, was einen echten Verbraucher hat:
//   KEIN Tempo (gibt es in 2.8.0 nirgends, DEFER-A4) und KEIN Muskel-Korridor
//   (den zeigt analysis.js `anaMuscleHTML` JEDEM, er hängt an keiner Stufe).
const DS_LV_KEYS=['beginner','intermediate','advanced'];
const DS_LV_LABEL={beginner:'Anfänger',intermediate:'Fortgeschritten',advanced:'Profi'};
function dsLvNum(k){const i=DS_LV_KEYS.indexOf(String(k||'').toLowerCase());return i<0?1:i+1;}
function dsLvLabel(k){return DS_LV_LABEL[String(k||'').toLowerCase()]||DS_LV_LABEL.beginner;}
// Was ab dieser Stufe DAZUKOMMT – je Eintrag genau eine Sache, die der Athlet danach wirklich sieht.
// „Profi" ist heute bewusst leer: in der App unterscheidet nichts Stufe 3 von Stufe 2, und das
// zu behaupten wäre dieselbe Lüge, die im Coach-Blatt schon gestrichen wurde.
const DS_LV_ADDS={
  beginner:[],
  intermediate:[
    'das RIR-Feld in der Satzzeile',
    // Die Zeile muss in BEIDE Richtungen stimmen („das siehst du damit" und „weg ist damit"),
    // deshalb steht die Folge als Bedingung da und nicht als Zeitangabe.
    'die Satztypen Aufwärmen, Drop und Backoff (lang auf die Satznummer) – nur mit ihnen bleiben Aufwärmsätze aus Volumen, e1RM und Bestleistung heraus',
    'den geschätzten e1RM neben jeder Übung in der Analyse'],
  advanced:[]};
// Alles, was auf dieser Stufe sichtbar ist (kumulativ, in der Reihenfolge der Stufen).
function dsLvSees(k){const n=dsLvNum(k);const out=[];
  for(let i=0;i<n;i++)(DS_LV_ADDS[DS_LV_KEYS[i]]||[]).forEach(x=>out.push(x));
  return out;}
// Der Satz für Stufe 1: sie fügt nichts hinzu, also wird beschrieben, wie die Zeile bleibt –
// statt einen leeren Halbsatz („Du siehst .") stehen zu lassen.
const DS_LV_BASE='Die Satzzeile bleibt [kg] [Wdh] [✓] – kein RIR, keine Satztypen, Empfehlungen ohne Fachbegriffe.';
// Unterschied zweier Stufen aus der Sicht des Athleten: {weg,neu}. null, wenn sich nichts ändert
// (heute der Fall bei „Fortgeschritten" ↔ „Profi") – dann darf auch nichts behauptet werden.
function dsLvDiff(from,to){const a=dsLvSees(from),b=dsLvSees(to);
  const weg=a.filter(x=>b.indexOf(x)<0),neu=b.filter(x=>a.indexOf(x)<0);
  return (weg.length||neu.length)?{weg,neu}:null;}

// ===== API =====
// Vierter Parameter opts={queue:true,kind,label} NUR für schreibende Aufrufe, die offline nachgetragen werden dürfen.
// Ohne opts verhält sich das API-Objekt exakt wie vorher – die Onlinenutzung bleibt unberührt.
// Frist je Aufruf. Ein fetch ohne Frist hängt bei „Verbindung angenommen, nie geantwortet" (Hotel-WLAN,
// Portalseite, ein Balken im Keller) 60 s und länger: der Satz stand in „speichert", kam NIE in die Ablage
// (die greift nur bei abgelehntem fetch) und flushOutbox.busy blockierte solange alle wartenden Einträge.
// Lesend kürzer, schreibend länger (der Render-Kaltstart braucht bis zu ~10 s, ein Satz darf nicht wegen
// eines aufwachenden Servers in die Ablage), Uploads (Foto, Avatar, Excel-/Health-Import, KI) deutlich länger.
// Ein Abbruch landet im catch und wird wie „kein Netz" behandelt – ab da funktioniert die Ablage wie geplant.
// Zu kurz wäre ungefährlich: client_id sitzt schon im ersten Versuch, Sätze/Check-ins sind Upserts.
const API_TIMEOUT={read:15000,write:25000,upload:120000};
const API_SLOW_PATH=/^\/(photos|avatar|health-import|import\/|ai\/)/;
function _apiTimeout(m,p){if(API_SLOW_PATH.test(String(p||'')))return API_TIMEOUT.upload;return m==='GET'?API_TIMEOUT.read:API_TIMEOUT.write;}
const API={async req(m,p,b,opts){
    // Idempotenz-Marke SCHON VOR dem ersten Versuch setzen, nicht erst beim Einreihen: Bricht die
    // Verbindung ab, NACHDEM der Server die Zeile geschrieben hat, wiederholt die Ablage denselben
    // Aufruf – ohne Marke im ersten Versuch entstünde dabei eine echte Dublette (/foodlog, /cardio
    // sind reine INSERTs). Mit Marke erkennt der Server den zweiten Versuch und legt nichts an.
    let _cid=null;
    if(opts&&opts.queue===true&&OUTBOX_IDEMPOTENT[String(opts.kind||'')]){_cid=outboxMintId();b=Object.assign({},b||{},{client_id:_cid});}
    let ctl=null,tm=null;
    try{const o={method:m,headers:{},credentials:'same-origin'};if(b){o.headers['Content-Type']='application/json';o.body=JSON.stringify(b);}
    // AbortController gibt es in jedem Browser, den die App unterstützt; der typeof-Schutz ist nur für Testumgebungen.
    if(typeof AbortController==='function'){ctl=new AbortController();o.signal=ctl.signal;tm=setTimeout(()=>{try{ctl.abort();}catch(e){}},_apiTimeout(m,p));}
    const r=await fetch('/api'+p,o);
    // D32: Nur MITLESEN, was der Server als seinen Tag angibt (siehe today()). Kein Einfluss auf Ablage,
    // Schnappschüsse oder Rückgabewert – fehlt die Kopfzeile (ältere Server-Fassung), bleibt alles wie bisher.
    try{crNoteServerDay(r.headers.get('X-App-Day'));}catch(e){}
    let d=null;try{d=await r.json();}catch{}
    clearTimeout(tm);
    // Die Frist kann auch MITTEN im Antwort-Rumpf zuschlagen (Kopf sofort, Rumpf tropft 20 s): dann hat
    // r.json() abgebrochen, das leere catch hat es geschluckt, und wir staenden mit status 200 und
    // data null da – PLAN wuerde null, der Trainings-Tab leer. Das ist derselbe Fall wie „kein Netz".
    if(ctl&&ctl.signal.aborted&&d==null)throw Object.assign(new Error('Antwort abgebrochen'),{name:'AbortError'});
    // Sitzung abgelaufen/Konto weg/Token widerrufen -> sauber zurück zur Anmeldung statt endlos „Fehler"-Toasts.
    // opts.raw: der Aufrufer wertet 401 selbst aus – nötig, wo 401 ein FALSCHES PASSWORT meldet
    // (/password, DELETE /me, /admin/backup) und keine verlorene Sitzung.
    if(r.status===401&&ME&&!(opts&&opts.raw===true))sessionLost(d&&d.error);
    // A-II.4: Der Server lehnt Gesundheitsdaten ohne Einwilligung mit 409 und `needsConsent:true` ab
    // (src/server.js: CONSENT_HINT). Ohne diesen Haken bekäme ein Konto von vor 2.6.0 – oder eines, das
    // widerrufen hat – bei jedem Check-in dieselbe Absage und keinen Weg heraus. Der Rückgabewert
    // bleibt unverändert; die Meldung ist ein Zusatz, kein Ersatz für die Fehlerbehandlung des Aufrufers.
    // Die Fassung, die der Server verlangt, steht in derselben Antwort (`consentVersion`). Wir merken
    // sie uns – nur damit erkennt die Oberfläche den Fall „einwilligt, aber der Text hat sich geändert"
    // (der Server antwortet dann ebenfalls 409, `reason:'version'`).
    if(r.status===409&&d&&d.needsConsent===true){
      if(typeof d.consentVersion==='string'&&d.consentVersion)LG_CONSENT_REQUIRED=d.consentVersion;
      try{lgConsentNeeded();}catch(e){}}
    return{status:r.status,data:d};}catch(err){clearTimeout(tm);
    console.error(err&&err.name==='AbortError'?'[Netzwerkfehler] keine Antwort innerhalb der Frist':'[Netzwerkfehler]',p,err);
    // Nur hier landet „kein Netz" (status 0). 4xx/5xx kommen NIE hier an – echte Server-Ablehnungen
    // dürfen niemals in die Outbox, sonst schickt die App eine abgelehnte Eingabe endlos erneut.
    // 202 gibt es NUR, wenn der Eintrag wirklich im Speicher liegt: kann localStorage nicht schreiben
    // (voll, Privatmodus, blockierte Website-Daten), fällt der Aufruf auf den ehrlichen status-0-Pfad
    // zurück. Sonst bestätigt die Oberfläche etwas, das nirgends existiert.
    if(opts&&opts.queue===true&&outboxAdd(m,p,b,opts,_cid)!==false)return{status:202,data:{queued:true}};
    // Bei abgelaufener Frist auf einem schreibenden Aufruf OHNE Ablage kann der Server die Aenderung
    // laengst haben – „Keine Verbindung" wuerde zum blinden Nochmal-Senden verleiten.
    const timedOut=!!(err&&err.name==='AbortError');
    return{status:0,data:{error:(timedOut&&m!=='GET')?'Keine Antwort vom Server – bitte erst nachsehen, ob es gespeichert wurde, bevor du es erneut sendest.':'Keine Verbindung. Ist der Server erreichbar?'}};}},
  // A-III.1: Der EINE Ort, an dem aus „keine Antwort" ein ehrlicher letzter Stand wird. Jeder Aufrufer
  // prüft weiter nur `status===200` und bekommt Zahlen statt Nullen; wer will, liest zusätzlich
  // `stale`/`at`. Drei Regeln, in dieser Reihenfolge (siehe Abschnitt OFFLINE-WAHRHEIT weiter unten):
  //   echtes 200      -> gilt, und erneuert den Schnappschuss (stale-while-revalidate)
  //   status 0 + Stand-> {status:200,data,stale:true,at}, mit der Outbox darüber
  //   status 0 ohne   -> unverändert status 0; die Ansicht sagt „Noch nicht geladen" (A-III.2)
  // 4xx/5xx holen NIE einen alten Stand zurück: eine Ablehnung des Servers ist eine Aussage, kein Ausfall.
  // `b` wird bewusst auf null gezwungen – ein GET mit Rumpf wirft in fetch(). `opts` geht dagegen durch
  // (bisher fiel es still unter den Tisch, obwohl logoutAll `{raw:true}` mitgibt).
  async get(p,b,opts){
    const r=await this.req('GET',p,null,opts);
    // Hier – und NUR hier – fällt das Stand-Etikett: eine echte 200 für genau diesen Pfad ist der einzige
    // Beleg dafür, dass die Zahlen auf dem Bildschirm wirklich frisch sind. Bis 2.7.0 hing das Zurücksetzen
    // am `online`-Ereignis; das Etikett verschwand also, sobald das Netz zurück war, während weiter der alte
    // Stand dastand (gemessen: p10-wieder40.mjs, leerer Chip + unveränderte Zahlen, keine einzige frische API-Antwort).
    if(r&&r.status===200){offSnapSave(p,r.data);offFreshPath(p);return r;}
    if(r&&r.status===0){
      const s=offSnapLoad(p);
      if(s){offNoteStale(s.at,p);return {status:200,data:offApplyOutbox(p,s.data),stale:true,at:s.at};}}
    return r;},
  post(p,b,opts){return this.req('POST',p,b,opts);},put(p,b,opts){return this.req('PUT',p,b,opts);},del(p,b,opts){return this.req('DELETE',p,b,opts);}};

// ===== STATE =====
let ME=null,VIEW_USER=null,PLAN=null,CUR_DAY=null,DIET='training',FOODS=[],DEFS=[],authMode='login';
const APP_VERSION=window.BE_VERSION||'dev'; // vom Server aus package.json in index.html eingesetzt (eine Quelle)
let TODAY=null,UNREAD=0;
const logTimers={}; // Debounce-Timer je Satz (logSet)
// „Heute" = lokales Datum des Geräts (nicht UTC), damit Einträge nach Mitternacht nicht auf dem Vortag landen.
// D32: Der Server rechnet in seiner Zeitzone (APP_TZ) und schickt seinen Tag auf jeder API-Antwort mit
// (Kopfzeile X-App-Day). Zwei Fälle sind zu unterscheiden:
//  • Gerät steht östlich/westlich des Servers → die Tage weichen um HÖCHSTENS einen Kalendertag ab. Dann
//    gilt weiter der Gerätetag: wer um 00:30 in Tokio etwas einträgt, will den 14., nicht den Berliner 13.
//    (Der Server nimmt diesen einen Tag Vorsprung seit 2.5.0 an, siehe dateProblem in src/server.js.)
//  • Gerät ist FALSCH GESTELLT (Uhr um Jahre daneben, nach einem leeren Akku auf 1970) → die Abweichung ist
//    größer als ein Tag. Dann ist der Gerätetag keine Wahrheit, sondern ein Defekt, und die App würde in
//    ein unverständliches „Das Datum liegt in der Zukunft." laufen. In diesem Fall zählt der Servertag.
let CR_SERVER_DAY=null;                 // 'YYYY-MM-DD' in der Zeitzone des Servers, sobald eine Antwort da war
const crDayDiff=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);
function crNoteServerDay(d){if(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d))CR_SERVER_DAY=d;}
const today=()=>{const d=fmt(new Date());
  if(CR_SERVER_DAY&&Math.abs(crDayDiff(d,CR_SERVER_DAY))>1)return CR_SERVER_DAY;
  return d;};

// Service Worker so früh wie möglich registrieren – nicht erst in startApp(). Nur so ist die App-Hülle
// (HTML/CSS/JS/Icons) schon VOR dem ersten Login im Cache und die App startet auch ohne Netz.
try{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}catch(e){}

// ===== OFFLINE-OUTBOX =====
// Im Keller ohne Netz darf nichts verloren gehen. Schreibende Aufrufe mit {queue:true} landen bei
// „kein Netz" hier statt im Nichts und gehen der Reihe nach raus, sobald wieder Verbindung da ist.
// Speicher ist localStorage (kein IndexedDB im Projekt) und muss persistent sein: ein 401 lädt die
// Seite mitten im Nachtragen neu – alles nur im RAM wäre dann weg.
const OUTBOX='be_outbox';   // localStorage-Schlüssel
let _outboxSeq=0;           // Zähler für die IDs – bewusst KEIN Math.random (IDs müssen reproduzierbar sortierbar bleiben)
// Arten, die serverseitig ein reines INSERT sind (/foodlog, /foodlog/frommeal, /cardio): sie bekommen
// die Outbox-ID als client_id in den Rumpf. Bricht die Antwort unterwegs ab, nachdem die Zeile schon
// geschrieben war, erkennt der Server den zweiten Versuch an der client_id und legt keine Dublette an.
// Satz-Logs und Check-ins brauchen das nicht – die sind schon Upserts.
const OUTBOX_IDEMPOTENT={food:1,cardio:1,intake:1};
function outboxList(){try{const a=JSON.parse(localStorage.getItem(OUTBOX)||'[]');return Array.isArray(a)?a:[];}catch(e){console.error('[outbox]',e);return [];}}
// Ein Gerät, mehrere Konten: jeder Eintrag trägt seit 2.3 den Besitzer. Fremde Einträge werden weder
// gezeigt noch gesendet – sonst sieht Nutzer B die Übungs- und Essensnamen von A, und A's Einträge
// verglühen in einem 403 (canAccess), weil im Rumpf A's user_id steht.
// Kein Besitzer = Altlast aus einer Vorabfassung (vor 2.3 kannte die Ablage keine Konten). Solche Einträge
// sind nachweislich auf DIESEM Gerät entstanden; beim Anmelden übernimmt outboxAdoptOrphans() sie EINMAL für
// das angemeldete Konto (Aufruf in startApp). Davor – also solange niemand angemeldet ist – werden sie weder
// gezeigt noch gesendet: die Warnung unten gilt für diesen Zustand, nicht für den Weg über outboxAdoptOrphans.
function outboxOwn(x){return !!(x&&ME&&x.uid===ME.id);}
function outboxMine(){return outboxList().filter(outboxOwn);}
function outboxCount(){return outboxMine().length;}
// Eintrag anhängen. Deckel bei 200: das älteste fliegt raus, damit der Speicher nie überläuft.
// Rückgabe: die id – oder false, wenn der Speicher den Eintrag NICHT aufgenommen hat.
// Eine neue, auf diesem Gerät eindeutige Marke. Getrennt von outboxAdd, weil API.req sie schon
// VOR dem ersten Versuch braucht (siehe dort) und beide dieselbe benutzen müssen.
// Einmalige Kennung dieses Geräts. Der UNIQUE-Index auf (user_id, client_id) gilt kontoweit über
// ALLE Geräte – ohne Geräteanteil könnten Handy und Tablet in derselben Millisekunde dieselbe Marke
// vergeben, und einer der beiden Einträge verschwände still als vermeintliche Dublette.
function deviceTag(){try{let d=localStorage.getItem('be_dev');
  if(!d){d=Math.random().toString(36).slice(2,8);localStorage.setItem('be_dev',d);}return d;}catch(e){return 'x';}}
function outboxMintId(){const a=outboxList(),ts=Date.now(),dev=deviceTag();let id=dev+'-'+ts+'-'+(++_outboxSeq);
  while(a.some(x=>x.id===id))id=dev+'-'+ts+'-'+(++_outboxSeq); // nach einem Neuladen startet der Zähler bei 0 – hier abgefangen
  return id;}
function outboxAdd(method,path,body,opts,forcedId){opts=opts||{};const a=outboxList();
  const id=forcedId||outboxMintId();
  const kind=String(opts.kind||'');
  // Bei vorgegebener Marke steckt client_id bereits im Rumpf (API.req hat ihn vor dem Versuch gesetzt).
  const bd=(OUTBOX_IDEMPOTENT[kind]&&!forcedId)?Object.assign({},body||{},{client_id:id}):(body??null);
  const entry={id,ts:Number(String(id).split('-')[1])||Date.now(),method,path,body:bd,kind,label:String(opts.label||''),uid:(ME&&ME.id!=null)?ME.id:null};
  a.push(entry);
  // Deckel bei 200. Zwei Regeln, in dieser Reihenfolge:
  //  1. Der GERADE angelegte Eintrag wird nie verdrängt. Sonst meldet die App „Offline gespeichert"
  //     für etwas, das sie im selben Atemzug weggeworfen hat – der eine Fall, den es nie geben darf.
  //  2. Zuerst weichen fremde Einträge (ältester zuerst): sie lassen sich erst senden, wenn ihr Konto
  //     sich wieder anmeldet, und dürfen dem, der das Gerät gerade benutzt, nicht den Platz nehmen.
  //     Erst danach der älteste eigene.
  while(a.length>200){
    let i=a.findIndex(x=>x!==entry&&!outboxOwn(x));
    if(i<0)i=a.findIndex(x=>x!==entry);
    if(i<0)break;                       // nur noch der neue Eintrag übrig: behalten
    a.splice(i,1);}
  // Scheitert das Schreiben, ist der Eintrag NIRGENDS – das muss der Aufrufer erfahren, sonst meldet
  // die Oberfläche „Offline gespeichert" für etwas, das es nicht gibt.
  try{localStorage.setItem(OUTBOX,JSON.stringify(a));}catch(e){console.error('[outbox]',e);return false;}
  syncBadge();return id;}
// Ein Eintrag, der immer wieder 5xx bekommt, stand bisher für immer am Kopf der Schlange: jede Runde
// nahm denselben, alles dahinter kam nie an die Reihe. Deshalb zählt jeder vergebliche Anlauf am
// Eintrag mit. Nach OUTBOX_MAX_TRIES wird er NICHT verworfen – es sind die Daten des Nutzers –,
// sondern hinten angestellt, damit der Rest durchkommt; entfernen kann ihn nur der Nutzer selbst
// (Sheet „Wartende Einträge").
const OUTBOX_MAX_TRIES=5;
function _outboxWrite(a){try{localStorage.setItem(OUTBOX,JSON.stringify(a));return true;}catch(e){console.error('[outbox]',e);return false;}}
// Rückgabe: neuer Zählerstand – 0, wenn er sich nicht merken ließ (dann bleibt alles wie bisher).
function outboxBumpTry(id){const a=outboxList(),i=a.findIndex(x=>x.id===id);if(i<0)return 0;
  const n=(+a[i].tries||0)+1;a[i].tries=n;return _outboxWrite(a)?n:0;}
function outboxDefer(id){const a=outboxList(),i=a.findIndex(x=>x.id===id);if(i<0)return false;
  const [x]=a.splice(i,1);a.push(x);return _outboxWrite(a);}   // tries bleibt stehen: die Warteliste zeigt daran, dass er festhängt
// Von Hand entfernen – nur eigene Einträge, sonst löschte ein Konto die Daten des anderen.
function outboxDrop(id){const a=outboxList(),i=a.findIndex(x=>x.id===id&&outboxOwn(x));if(i<0)return false;
  a.splice(i,1);if(!_outboxWrite(a))return false;syncBadge();return true;}
// Altlasten aus dem Upgrade-Fenster: Einträge ohne Besitzer sind seit 2.3 unsichtbar UND unzustellbar –
// sie fielen irgendwann still über den 200er-Deckel heraus. Sie sind auf diesem Gerät entstanden, bevor
// die Ablage überhaupt Konten unterschied; ein anderer Besitzer als das jetzt angemeldete Konto kommt
// also nicht in Frage. Einmal beim Anmelden stempeln, danach laufen sie den normalen Weg.
function outboxAdoptOrphans(){if(!ME||ME.id==null)return 0;
  const a=outboxList();let n=0;
  a.forEach(x=>{if(x&&x.uid==null){x.uid=ME.id;n++;}});
  if(!n)return 0;
  return _outboxWrite(a)?n:0;}
function okRes(r){return !!r&&(r.status===200||r.status===202);}   // 202 = offline gespeichert, für den Aufrufer ein Erfolg
function wasQueued(r){return !!r&&r.status===202;}
// Der Reihe nach senden, Abbruch beim ersten Netzfehler (die Reihenfolge der Einträge ist fachlich wichtig).
// Danach genau EIN Toast und invalidateView() für die betroffenen Bereiche.
async function flushOutbox(){
  // busy trägt den Startzeitpunkt: jeder Aufruf in der Schleife hat eine Frist (API.req), ein Lauf endet also
  // von selbst. Die Zeitgrenze hier ist die zweite Sicherung – sollte ein Lauf doch einmal hängen bleiben,
  // sperrt er die Ablage nicht für den Rest der Sitzung (das war bis 2.3 genau der Keller-Fall). Großzügig
  // (5 min), damit ein ehrlich langer Lauf (viele Einträge, langsamer Server) nicht von einem zweiten überholt wird.
  if(flushOutbox.busy&&Date.now()-flushOutbox.busy<300000)return 0;
  if(!ME)return 0;
  if(!outboxCount()){syncBadge();return 0;}
  if(navigator.onLine===false){syncBadge();return 0;}
  // Den Besitzer für die Bilanz am Ende merken: ein 401 unterwegs setzt ME auf null, und outboxCount()
  // zählte dann 0 – der Toast meldete „nachgetragen ✓" über einer Ablage, die nicht leer war.
  const owner=ME.id;
  flushOutbox.busy=Date.now();let done=0,rej=0,dup=0,tmp=false,stuck=0,noConsent=false;const kinds={},rejL=[],dupL=[],rejItems=[],parked={};
  // Obergrenze über dem 200er-Deckel aus outboxAdd: schlägt das Entfernen aus dem Speicher fehl,
  // liest die nächste Runde denselben Eintrag erneut. Ohne Zähler liefe das endlos.
  try{for(let guard=0;guard<250;guard++){
      // Bewusst in JEDER Runde frisch lesen: der Nutzer kann während des Nachtragens weiter loggen,
      // eine im Speicher gehaltene Liste würde den neuen Eintrag beim Zurückschreiben überbügeln.
      // parked = in DIESER Runde schon hinten angestellt; noch einmal versuchen hieße im Kreis laufen.
      const it=outboxList().find(x=>outboxOwn(x)&&!parked[x.id]);if(!it)break;   // fremde Einträge bleiben unangetastet liegen
      const r=await API.req(it.method,it.path,it.body);   // ohne opts -> ein Fehlschlag reiht NICHT erneut ein
      if(r.status===0)break;                              // kein Netz: Rest bleibt stehen, Reihenfolge bleibt erhalten
      if(r.status===401)break;                            // Sitzung weg: nichts verwerfen, der Reload kommt gleich von selbst
      // Vorübergehende Serverzustände sind KEINE Ablehnung: 502/503/504 kommen beim Hosting regelmäßig,
      // während die Instanz neu startet oder aus dem Schlaf kommt; 408/429 heißen „später nochmal".
      // Der Eintrag bleibt liegen und geht beim nächsten Anlauf raus – verwerfen wäre Datenverlust.
      // Erst nach OUTBOX_MAX_TRIES vergeblichen Anläufen wird er hinten angestellt, damit ein einzelner
      // Problemfall nicht alles hinter sich blockiert.
      if(r.status>=500||r.status===408||r.status===429){
        const n=outboxBumpTry(it.id);
        // Zähler nicht speicherbar (Privatmodus, voller Speicher): 0 < MAX wäre in jeder Runde wahr, der
        // Hänger stünde für immer vorn und die Einträge dahinter kämen nie an die Reihe. Dann für DIESE
        // Runde im RAM parken und weitergehen – die Reihenfolge ist ohne Speicher ohnehin nicht zu halten.
        if(n===0){parked[it.id]=1;stuck++;continue;}
        if(n<OUTBOX_MAX_TRIES||!outboxDefer(it.id)){tmp=true;break;}
        parked[it.id]=1;stuck++;console.error('[outbox] hängt fest, hinten angestellt',it.method,it.path,r.status);continue;}
      // Seit 2.6.0 hat 409 ZWEI Bedeutungen. Der Server antwortet mit demselben Status, wenn die
      // Einwilligung fehlt (src/server.js consentOk: `needsConsent:true`). Das ist KEINE Dublette:
      // der Eintrag ist nirgends angekommen, und die untere 409-Zeile hätte ihn aus der Ablage
      // geworfen und als „war schon eingetragen" gemeldet – gemessener Datenverlust (alle Arten:
      // checkin, food, cardio, intake, set). Also liegen lassen und den Lauf beenden: sobald die
      // Einwilligung da ist, geht derselbe Eintrag raus. Den Weg dorthin zeigt API.req bereits
      // (lgConsentNeeded öffnet die Karte), deshalb hier KEIN zweiter Toast – dafür `noConsent`.
      if(r.status===409&&r.data&&r.data.needsConsent===true){noConsent=true;tmp=true;break;}
      // Die Art wird IMMER vermerkt, auch bei Ablehnung: gerade dann steht auf dem Bildschirm ein
      // optimistischer Eintrag, den der Server nicht hat – die Ansicht muss frisch geholt werden.
      // Vermerken und zählen VOR dem Entfernen aus dem Speicher: scheitert das Schreiben, hat der
      // Server den Eintrag trotzdem – die App darf dazu nicht komplett schweigen.
      kinds[it.kind]=1;
      // 409 heißt „steht schon im Protokoll". Der Server hat aber NICHTS eingefügt, und die Prüfung
      // geht z.B. bei /foodlog/frommeal auf (Nutzer, Tag, Mahlzeit) – eine echte zweite Portion fällt
      // genauso hinein. Als Erfolg zu melden wäre eine Lüge mit Haken, als Ablehnung eine Übertreibung:
      // deshalb ein eigener dritter Ausgang, der im Toast beim Namen genannt wird.
      if(r.status===409){dup++;if(dupL.length<2)dupL.push(it.label||'Eintrag');}
      else if(r.status>=200&&r.status<300)done++;
      // 4xx: der Server lehnt dauerhaft ab (ungültig, doppelt, kein Zugriff). Behalten hieße,
      // die Schlange für immer zu blockieren. 5xx ist oben schon abgefangen.
      // Der ganze Eintrag wandert in rejItems: nur so kann der Trainings-Tab die Merker des
      // abgelehnten Satzes räumen (sonst ließe sich derselbe Satz nie wieder eintragen).
      else{rej++;rejItems.push({kind:it.kind,body:it.body,label:it.label||'Eintrag'});
        if(rejL.length<2)rejL.push(it.label||'Eintrag');console.error('[outbox] abgelehnt',it.method,it.path,r.status);}
      const b=outboxList(),i=b.findIndex(x=>x.id===it.id);
      if(i>=0){b.splice(i,1);
        // Der Eintrag steht noch in der Ablage: weiterlaufen hieße, ihn sofort erneut zu senden.
        if(!_outboxWrite(b))break;
      }}
  }catch(e){console.error('[outbox]',e);}
  flushOutbox.busy=0;syncBadge();
  // Gegen den gemerkten Besitzer zählen, nicht gegen ME (siehe oben) – nur für die Bilanz; in der Schleife
  // bleibt outboxOwn richtig, weil der Nutzer währenddessen weiter loggen kann.
  const left=outboxList().filter(x=>x&&x.uid===owner).length;
  // Der Rest bleibt liegen: kein Fehler, nur noch nicht dran. Der Kopf-Zustand zeigt weiter „warten".
  // `noConsent` ausgenommen: der Server IST erreichbar, es fehlt die Einwilligung. API.req hat dafür
  // schon die Karte geöffnet bzw. den Hinweis mit Knopf gezeigt – „Server gerade nicht erreichbar"
  // wäre daneben falsch und schickte den Nutzer in die Irre.
  if((tmp||stuck)&&!noConsent&&!done&&!rej&&!dup&&typeof toast==='function')toast('Server gerade nicht erreichbar – die Einträge bleiben gespeichert');
  if(done||rej||dup){
    // Welche Ansicht zeigt jetzt alte Zahlen? Nur die betroffenen leeren, nicht den ganzen Cache.
    const TABS={set:['workout','tracker','home'],cardio:['tracker','home'],checkin:['home','tracker'],intake:['home'],food:['diet','home']};
    Object.keys(kinds).forEach(k=>(TABS[k]||['home']).forEach(t=>invalidateView(t)));
    _afterFlushPaint(kinds,rejItems,owner);
    // Verworfene Einträge beim Namen nennen – sie sind endgültig weg, „1 abgelehnt" sagt dem Nutzer nicht,
    // was er nachtragen muss.
    if(typeof toast==='function'){
      const names=(l,n)=>l.join(', ')+(n>l.length?` und ${pl(n-l.length,'weiterer','weitere')}`:'');
      // „0 Einträge nachgetragen" wäre eine Nullaussage vor der eigentlichen Nachricht – deshalb
      // fängt der Text nur dann mit dem Erfolg an, wenn wirklich etwas durchging.
      const okTxt=done?`${pl(done,'Eintrag','Einträge')} nachgetragen`:'';
      const dupTxt=dup?`war schon eingetragen: ${names(dupL,dup)}`:'';
      const badTxt=rej?`nicht angenommen: ${names(rejL,rej)}`:'';
      // Hängt die Schlange, darf der Toast das nicht verschweigen: sonst steht „nachgetragen ✓" neben
      // einer Kopfzeile, die gleichzeitig „3 warten" zeigt – zwei Aussagen, eine davon falsch.
      const restTxt=((tmp||stuck)&&left)?`${pl(left,'Eintrag wartet','Einträge warten')} noch – Server gerade nicht erreichbar`:'';
      // Das ' ✓' heißt „fertig" und darf nur stehen, wenn die Ablage wirklich leer ist – sonst
      // widerspricht der Toast der Pille im Kopf, die gleichzeitig „N warten" zeigt.
      toast([okTxt,dupTxt,badTxt,restTxt].filter(Boolean).join(' · ')+((rej||dup||left)?'':' ✓'));
    }
  }
  return done;}
// invalidateView() leert nur den Cache – der sichtbare Tab zeigt sonst weiter die Pille „wird nachgetragen",
// während der Toast „nachgetragen ✓" meldet. Deshalb den offenen Tab in place auffrischen; bewusst OHNE go(),
// das würde offene Sheets schließen. Alles typeof-geschützt: core.js darf nicht an diet/home/analysis hängen.
function _afterFlushPaint(kinds,rejItems,owner){
  rejItems=rejItems||[];if(owner==null)owner=ME&&ME.id;
  // Auch die Rückgabe abfangen: die Zeichner sind async, ein Fehler darf nicht als unbehandelte Promise enden.
  const run=fn=>{try{const p=fn();if(p&&typeof p.catch==='function')p.catch(e=>console.error('[outbox]',e));}catch(e){console.error('[outbox]',e);}};
  if(kinds.food&&document.getElementById('dietBody')&&typeof refreshFoodlog==='function')run(refreshFoodlog);
  if(CUR_TAB==='home'&&typeof refreshHomeIfActive==='function')run(refreshHomeIfActive);
  if(CUR_TAB==='tracker'&&(kinds.cardio||kinds.checkin||kinds.set)&&typeof anaRefreshIfVisible==='function')run(anaRefreshIfVisible);
  // Abgelehnte Sätze zuerst aus den Merkern von training.js räumen: dort steht die Signatur des
  // Satzes in logSet.sent. Ohne dieses Aufräumen steigt derselbe Satz beim zweiten Versuch still
  // aus („schon gespeichert") – der Nutzer bekäme den grünen Haken und der Satz wäre endgültig weg.
  const rejSets=rejItems.filter(x=>x&&x.kind==='set'&&x.body);
  if(rejSets.length&&typeof trainForgetSets==='function')run(()=>trainForgetSets(rejSets.map(x=>x.body)));
  // Der Trainings-Tab wird aus den ECHTEN Server-Daten neu gemalt (renderEx holt GET /logs). Solange
  // noch Sätze in der Ablage liegen, wäre dieses Bild unvollständig: die wartenden Sätze verschwänden
  // samt Haken vom Bildschirm, der Ring fiele auf 0 % – und der Nutzer trüge sie ein zweites Mal ein.
  // Deshalb erst neu zeichnen, wenn für diese Art nichts mehr wartet.
  // Gegen den Besitzer des Laufs, nicht gegen ME: nach einem 401 ist ME null, setsLeft wäre false und
  // genau das Neuzeichnen liefe, das für wartende Sätze bewusst verhindert wird.
  const setsLeft=outboxList().some(x=>x&&x.uid===owner&&x.kind==='set');
  if(kinds.set&&!setsLeft&&CUR_TAB==='workout'&&document.getElementById('exlist')&&typeof renderEx==='function')run(()=>renderEx({quiet:true}));}
// Kleiner Zustand im Kopf: nur sichtbar, wenn offline ODER noch etwas wartet.
// A-III.1: Dieselbe Pille trägt seit 2.7.0 auch den Stand der angezeigten Zahlen („Stand 20:14 · offline").
// Bewusst hier und nirgends sonst – ein Zeitstempel je Ansicht wäre fünfmal dieselbe Aussage (BUILD-A3 §3.5).
function syncBadge(){const el=document.getElementById('syncState');if(!el)return;
  const n=outboxCount(),off=navigator.onLine===false;
  const st=(typeof offStaleLabel==='function')?offStaleLabel():'';
  if(!off&&!n&&!st){el.classList.add('hidden');el.textContent='';return;}
  const parts=[];
  if(st)parts.push(st);
  if(off)parts.push(st?'offline':'Offline');   // klein, wenn der Stand davorsteht: ein Satz, nicht zwei Etiketten
  if(n)parts.push(pl(n,'wartet','warten'));
  const t=parts.join(' · ');
  // Die Pille öffnet die Warteliste. Wartet nichts, verspricht „wartende Einträge anzeigen" das Falsche.
  el.textContent=t;el.setAttribute('aria-label',t+(n?' – wartende Einträge anzeigen':' – Details anzeigen'));
  el.classList.remove('hidden');}
// Liste der wartenden Einträge + „Jetzt senden"
function openOutbox(){if(typeof openSheet!=='function')return;
  const all=outboxList(),a=all.filter(outboxOwn),off=navigator.onLine===false;   // nur die eigenen – fremde Einträge zeigt niemand
  const other=all.length-a.length;
  const KINDS={set:['dumbbell','Satz'],food:['utensils','Essen'],checkin:['scale','Check-in'],intake:['pill','Supplement'],cardio:['flame','Cardio']};
  let h=`<div class="note status mb-4">${off?'Du bist gerade offline. Sobald du wieder Netz hast, geht alles automatisch raus.':'Du bist online – die Einträge werden gleich nachgetragen.'}</div>`;
  if(!a.length)h+=(typeof emptyState==='function'?emptyState({icon:'check',title:'Nichts wartet',text:'Alle Einträge sind beim Server angekommen.'}):'<p class="meta">Nichts wartet.</p>');
  else h+='<div class="rows">'+a.map(it=>{const k=KINDS[it.kind]||['upload','Eintrag'];
      // Ein Eintrag, den der Server mehrfach nicht angenommen hat, steht jetzt hinten – das muss man sehen,
      // sonst wirkt die Liste wie ein Stillstand ohne Grund.
      const stuck=(+it.tries||0)>=OUTBOX_MAX_TRIES;
      // Ohne brauchbaren Zeitstempel (Eintrag aus einer Vorabfassung) wirft new Date(...).toISOString()
      // – das riss bisher das ganze Sheet mit. Dann steht eben keine Zeit da.
      const ts=Number(it.ts)||0,when=ts?fmtDateTime(new Date(ts).toISOString()):'';
      return `<div class="row"><div class="r-ic">${icon(k[0],22)}</div><div class="rl"><span class="truncate">${esc2(it.label||k[1])}</span><small>${esc2(k[1])}${when?' · '+esc2(when):''}${stuck?' · Server nimmt ihn gerade nicht an':''}</small></div>`
        +`<div class="rr"><button class="btn icon sm ghost" type="button" aria-label="${esc2(it.label||k[1])} entfernen" onclick="outboxRemove('${esc(it.id)}')">${icon('trash',18)}</button></div></div>`;}).join('')
    +'</div>'+`<button class="btn block mt-4" onclick="flushOutbox().then(()=>openOutbox())"${off?' disabled':''}>Jetzt senden</button>`;
  // Fremde Einträge werden bewusst weder gezeigt noch gesendet. Ganz zu verschweigen, dass sie da sind,
  // hieße aber: sie sterben irgendwann still über den 200er-Deckel. Nur die Zahl, keine Namen.
  if(other)h+=`<div class="caption mt-3">${pl(other,'Eintrag eines anderen Kontos wartet','Einträge eines anderen Kontos warten')} auf diesem Gerät. Melde dich mit diesem Konto an, um sie zu senden.</div>`;
  openSheet('Wartende Einträge',h);}
// Einen wartenden Eintrag von Hand entfernen. Ohne diesen Weg bliebe ein Eintrag, den der Server
// dauerhaft nicht annimmt, für immer in der Liste – ihn loszuwerden hieße, localStorage von Hand zu leeren.
function outboxRemove(id){const it=outboxList().find(x=>x.id===id&&outboxOwn(x));if(!it)return;
  const drop=()=>{const ok=outboxDrop(id);if(typeof toast==='function')toast(ok?'Eintrag entfernt':'Konnte nicht entfernt werden');openOutbox();};
  const name=it.label||'Dieser Eintrag';
  if(typeof confirmSheet==='function')confirmSheet('Eintrag entfernen',`„${name}" wird dann nicht mehr gesendet und ist weg. Wirklich entfernen?`,{label:'Entfernen',onYes:drop});
  else drop();}
// Auslöser fürs Nachtragen: „online"-Ereignis (die anderen beiden sitzen im visibilitychange und im 30-s-Poll)
function _onlineInit(){if(_onlineInit.done)return;_onlineInit.done=true;
  // A-III.1: Netz zurück -> NICHT das Etikett löschen, sondern frische Zahlen holen.
  // Bis 2.7.0 stand hier `offFresh()`. Das war die falsche Reihenfolge: „online" ist eine Aussage über
  // das Netz, nicht über den Bildschirm. Gemessen (p10-wieder40.mjs): Kaltstart ohne Netz, dann Netz an,
  // keine Nutzeraktion – der Chip „Stand 16:47 · offline" verschwand nach 3 s, die Zahlen blieben 40 s
  // lang exakt dieselben, und es ging keine einzige frische Anfrage raus (flushOutbox zeichnet nur im
  // Erfolgspfad neu, bei leerer Ablage also nie; der Minuten-Poll holt nur den Nachrichtenzähler).
  // Jetzt: Ablage leeren, Zähler holen, sichtbare Ansicht neu zeichnen – das Etikett fällt danach in
  // API.get, Pfad für Pfad, WEIL die neuen Zahlen da sind.
  window.addEventListener('online',()=>{syncBadge();flushOutbox();
    if(ME&&typeof loadUnread==='function')Promise.resolve(loadUnread()).catch(e=>console.error('[off]',e));
    offRefreshActive();});
  window.addEventListener('offline',syncBadge);
  syncBadge();}
_onlineInit();

// ===== SCHNAPPSCHUSS FÜR DEN START OHNE NETZ =====
// Der Service Worker bringt nur die Hülle (HTML/CSS/JS) aus dem Cache zurück. Ohne einen letzten
// Datenstand steht der Nutzer nach einem Neustart ohne Netz vor dem Anmeldeformular – genau in der
// Lage, für die die Outbox gebaut wurde. Deshalb wird bei jedem vollständigen Laden ein kleiner
// Schnappschuss abgelegt: be_me (Nutzer), be_plan_<uid> (Plan), be_today_<uid>_<datum> (Tag).
// Das ersetzt KEINE Ansicht – es bringt die App nur hoch, damit Sätze weiter eingetragen werden können.
function snapSave(key,val){if(val==null)return;try{localStorage.setItem(key,JSON.stringify(val));}catch(e){console.error('[snap]',e);}}
function snapLoad(key){try{const s=localStorage.getItem(key);return s?JSON.parse(s):null;}catch(e){console.error('[snap]',e);return null;}}
function _snapKeys(){const out=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
    if(k==='be_me'||/^be_(plan|today)_/.test(k||''))out.push(k);}}catch(e){console.error('[snap]',e);}return out;}
// Beim Abmelden verschwindet der komplette Schnappschuss: er gehört dem Konto, nicht dem Gerät.
function snapClearAll(){try{_snapKeys().forEach(k=>localStorage.removeItem(k));}catch(e){console.error('[snap]',e);}}
// Nur das eigene Athleten-Konto: der Coach-Blick liegt in fremden Daten, und Coach/Admin kommen ohne
// Netz ohnehin nicht weit (Athletenliste, Verwaltung). Alte Tages-Schnappschüsse fliegen dabei raus.
// Ein Schnappschuss ist der letzte Stand DES EIGENEN Kontos. Im Coach-Blick zeigen PLAN und TODAY
// die Daten des Athleten – die haben auf dem Geraet des Coaches nichts verloren, auch nicht
// zwischengespeichert. Dieselbe Pruefung galt bisher nur in snapState(); loadPlan/loadToday
// schrieben daran vorbei, sobald ein Coach einen Athleten oeffnete.
function snapAllowed(){return !!(ME&&ME.role==='athlete'&&VIEW_USER===ME.id&&!(typeof coachView==='function'&&coachView()));}
function snapState(){try{
    if(!ME||ME.role!=='athlete'||coachView())return;
    snapSave('be_me',ME);
    const uid=VIEW_USER!=null?VIEW_USER:ME.id;
    if(PLAN&&PLAN.days)snapSave('be_plan_'+uid,PLAN);
    if(TODAY){const k='be_today_'+uid+'_'+today();snapSave(k,TODAY);
      _snapKeys().forEach(x=>{if(x!==k&&x.indexOf('be_today_')===0)try{localStorage.removeItem(x);}catch(e){}});}
  }catch(e){console.error('[snap]',e);}}
// Start ohne Netz (GET /api/me kam als status 0): aus dem Schnappschuss hochfahren. Gibt es keinen,
// bleibt der Anmeldebildschirm stehen – aber mit klarer Ansage statt eines wortlos toten Formulars.
// Rückgabe: true, wenn die App gestartet wurde.
function offlineBoot(){
  const m=snapLoad('be_me');
  if(!m||m.id==null){
    // Hier ist ME immer null (es gibt ja kein be_me) – outboxCount() zählt dann nach outboxOwn
    // grundsätzlich 0 und der Hinweis wäre tot. Gezählt wird deshalb die ganze Ablage; gezeigt wird
    // nur die ANZAHL, nie ein Label – fremde Übungs- oder Essensnamen gehören auf keinen fremden Bildschirm.
    const n=outboxList().length;
    try{showErr(n?`Keine Verbindung · ${pl(n,'Eintrag wartet','Einträge warten')} auf diesem Gerät. Sie gehen raus, sobald du wieder online und angemeldet bist.`:'Keine Verbindung. Zum Anmelden brauchst du kurz Netz.');}catch(e){}
    return false;}
  ME=m;startApp();
  // Der Kopf zeigt bereits „Offline" (syncBadge). Dazu einmal die Ansage, was jetzt trotzdem geht –
  // nach kurzer Verzögerung, damit der Toast nicht unter dem Aufbau der Startseite verschwindet.
  // Bis 2.6.0 stand hier: „gespeicherte Zahlen fehlen gerade". Das war die Wahrheit, solange der
  // Schnappschuss nur be_me, PLAN und TODAY trug – Check-ins, Essen, Supplements, Sätze und Mindset
  // holte die Startseite ausschliesslich vom Netz und zeigte ohne Netz Nullen.
  // Seit A-III.1 legt `API.get` jede gelesene Antwort mit ab (be_snap_v1_…), und dieselbe Startseite
  // kommt aus dem letzten Stand zurück. Welcher Satz stimmt, hängt also davon ab, ob wirklich etwas
  // da ist – deshalb wird gezählt statt behauptet. Den Zeitstempel trägt der Chip im Kopf
  // („Stand 20:14 · offline"), nicht dieser Toast: eine Aussage, eine Stelle.
  // Gezählt werden NUR die tragenden Stände (offBearingCount, siehe OFF_BEARING weiter unten) – nicht
  // jeder Schlüssel. Sonst verspricht dieser Toast einen Stand, den der Chip im Kopf im selben Moment
  // als „Offline · Noch nicht geladen" dementiert.
  let snaps=0;try{snaps=offBearingCount();}catch(e){}
  if(typeof toast==='function')setTimeout(()=>toast(snaps
    ?'Offline – du siehst deinen letzten gespeicherten Stand. Sätze kannst du weiter eintragen.'
    :'Offline – gespeicherte Zahlen fehlen gerade. Sätze kannst du trotzdem eintragen.'),700);
  return true;}

// ===== A-III.1 · OFFLINE-WAHRHEIT (Präfix `off`) =====
// Diese Schicht ist die ERWEITERUNG der Schnappschüsse oben, nicht ein zweiter Mechanismus daneben
// (CRITIC K4). Sie beantwortet genau eine Frage: Was zeigt die App, wenn der Server nicht antwortet?
//
// Bisher: nichts. `be_me`/`be_plan_`/`be_today_` bringen die App hoch, aber jede Ansicht holt ihre
// Zahlen selbst – und bekam ohne Netz `status 0`. Gemessen (MESS-BEFUNDE M6, `tools/offline-diff.mjs`):
// beim Kaltstart verschwinden 130 Kennzahlen, die Bereitschaft fällt von 92 auf 0, und ein Toast
// behauptet daneben, man sähe den letzten Stand. Genau das endet hier.
//
// Die drei Regeln, in dieser Reihenfolge:
//   1. Was der Server sagt, gilt.                      (echtes 200 -> Schnappschuss wird erneuert)
//   2. Sonst gilt der letzte Stand, ehrlich etikettiert.(status 0 -> {status:200,data,stale:true,at})
//   3. Über beidem liegt, was noch in der Ablage wartet.(Outbox-Überlagerung, siehe offApplyOutbox)
//
// WARUM localStorage UND NICHT Cache Storage (BUILD-A3 §3.1 verlangt eine begründete Entscheidung):
//   • K4 warnt vor einer dritten Wahrheit. `be_outbox` und `be_me`/`be_plan_`/`be_today_` liegen in
//     localStorage; ein zweiter Speicher daneben hätte zwei Aufräumwege, zwei Purges, zwei Fehlerbilder.
//   • Gemessen auf dem Prüfstand (2.6.0, Konto „Athlet 2"): die grösste Leseantwort, die eine Ansicht
//     wirklich braucht, ist `/recipes` mit 35 KB, danach `/logs/2` mit 23 KB und `/home/2` mit 11 KB.
//     Das ist Kleinkram für localStorage. Alles wirklich Grosse (Fotos, Avatare) ist Bild-Inhalt, den
//     ohne Netz niemand braucht – der steht unten ausdrücklich auf der Nie-Liste und fällt zusätzlich
//     über die Grössengrenze.
//   • localStorage ist synchron. `offlineBoot()` und `snapState()` laufen in einem Zug; eine
//     asynchrone Cache-Storage-API hätte den Startpfad umgebaut, den wir gerade nicht anfassen wollen.
//   • Haltbarkeit gewinnt Cache Storage nicht: Safari löscht bei nicht installierten Web-Apps nach
//     7 Tagen ohne Interaktion BEIDE Speicher. Das ist kein Argument für den zweiten Speicher, sondern
//     einer dafür, den Verlust sauber abzufangen (siehe offSnapLoad / offlineBoot).
//   • Die bewusste Regel „`sw.js` cacht `/api/*` nie" bleibt damit unangetastet: die Leseschicht lebt
//     vollständig in der App, an einer Stelle, unter Kontrolle des angemeldeten Kontos.

const OFF_SNAP_V='v1';                  // Speicherfassung. Hochzählen = alles Alte wird verworfen.
const OFF_PREFIX='be_snap_';            // Schlüssel: be_snap_v1_<uid>_<pfad>
const OFF_MAX_BYTES=64*1024;            // je Eintrag – deckt die grösste gemessene Antwort (35 KB) gut ab
const OFF_MAX_ENTRIES=40;               // Deckel über ALLE Konten auf diesem Gerät
const OFF_MAX_AGE_MS=30*864e5;          // älter als 30 Tage ist kein „letzter Stand" mehr, sondern Archiv
// Pfade, die NIE in den Schnappschuss gehören. Drei Gründe, jeder für sich ausreichend:
//   • Es ist keine Kennzahl, sondern eine Auskunft über den Server (/version, /register-info, /selftest).
//     Ein gecachtes /version würde die Versionsprüfung belügen.
//   • Es ist ein Bild oder ein Schlüssel (/photos, /avatar, /push) – gross bzw. sinnlos ohne Netz.
//   • Es gehört nicht dem angemeldeten Konto (/admin) oder ist ein Einmal-Vorgang (/share, /invite).
// `/me` fehlt bewusst: der Nutzer-Datensatz hat mit `be_me` + `snapState()` schon genau einen Besitzer,
// und `offlineBoot()` liest ihn von dort. Zwei Quellen für denselben Datensatz wären wieder K4.
const OFF_NEVER=[/^\/version\b/,/^\/register-info\b/,/^\/me\b/,/^\/login\b/,/^\/logout\b/,/^\/register\b/,
  /^\/photos\//,/^\/avatar\//,/^\/ai\//,/^\/admin\//,/^\/selftest\b/,/^\/push\//,/^\/support\//,
  /^\/share\//,/^\/invite\//,/^\/definitions\b/];
function offCacheable(p){p=String(p||'');return !OFF_NEVER.some(re=>re.test(p));}
// Welche Schnappschüsse TRAGEN eine Ansicht? Nicht jeder abgelegte Pfad ist eine Kennzahl: der
// Lebensmittel-Katalog (`/foods`), Mahlzeiten-Vorlagen (`/meals/2`) oder Rezepte füllen keine einzige
// Zahl auf dem Bildschirm. Bis 2.7.0 zählte `offlineBoot()` schlicht alle Schlüssel – blieben nach dem
// 40-Einträge-Deckel nur solche stummen Listen übrig, versprach der Toast „du siehst deinen letzten
// gespeicherten Stand", während beide Ansichten „Noch nicht geladen" zeigten (gemessen: p6-toast-workout.mjs).
const OFF_BEARING=[/^\/home\//,/^\/today\//,/^\/plan\//,/^\/logs\//,/^\/foodlog\//,/^\/checkins\//,
  /^\/readiness\//,/^\/insights\//,/^\/supplement-intake\//,/^\/mindset\/today\//,
  /^\/week\//,/^\/monthly\//,/^\/dashboard\//,/^\/cardio\//,/^\/measurements\//,/^\/progression\//];
function offIsBearing(p){p=String(p||'');return OFF_BEARING.some(re=>re.test(p));}
// Gezählt wird nur das EIGENE Konto: auf einem geteilten Gerät ist der Stand eines anderen Athleten
// kein Grund, diesem Nutzer einen letzten Stand zu versprechen.
function offBearingCount(){try{const pre=offKey('');if(pre==null)return 0;
  return offKeys().filter(k=>k.indexOf(pre)===0&&offIsBearing(k.slice(pre.length))).length;
}catch(e){console.error('[off]',e);return 0;}}
// Wessen Stand ist das? ME, solange jemand angemeldet ist – sonst der Schnappschuss-Nutzer (Kaltstart
// ohne Netz: shell.js fragt /me, bekommt status 0, offlineBoot() setzt ME aus `be_me`. In der kurzen
// Spanne davor greift der Rückfall).
function offUid(){if(ME&&ME.id!=null)return ME.id;const m=snapLoad('be_me');return (m&&m.id!=null)?m.id:null;}
function offKey(p){const u=offUid();if(u==null)return null;return OFF_PREFIX+OFF_SNAP_V+'_'+u+'_'+String(p||'');}
function offKeys(){const out=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
  if(k&&k.indexOf(OFF_PREFIX)===0)out.push(k);}}catch(e){console.error('[off]',e);}return out;}
// Beim Wechsel der Fassung fliegt alles Alte raus – eine halb gelesene Mischung aus zwei Formaten wäre
// schlimmer als gar kein Schnappschuss. Läuft genau einmal beim Laden der Datei.
function offPurgeOldVersions(){const pre=OFF_PREFIX+OFF_SNAP_V+'_';
  offKeys().forEach(k=>{if(k.indexOf(pre)!==0)try{localStorage.removeItem(k);}catch(e){}});}
try{offPurgeOldVersions();}catch(e){console.error('[off]',e);}
// Zeitstempel eines Eintrags, ohne ihn zu parsen: `at` steht bewusst als ERSTES Feld im JSON.
// 40 Schlüssel bei jedem Aufräumen vollständig zu parsen wäre auf einem alten Telefon spürbar.
function offAt(k){try{const s=localStorage.getItem(k);const m=s&&/^\{"at":(\d{10,16})/.exec(s);return m?+m[1]:0;}catch(e){return 0;}}
// Ältesten Eintrag opfern (nie den, der gerade geschrieben wird). Rückgabe: hat es einen gegeben?
// Reihenfolge des Opferns: zuerst das Alter, aber innerhalb der STUMMEN Einträge. Ein Lebensmittel-Katalog
// ist beim Start ohne Netz schnell wieder besorgt; die Startseiten-Zahlen sind es nicht. Gibt es nichts
// Stummes mehr, fällt wie bisher der älteste Eintrag überhaupt.
function offEvictOldest(keep){const all=offKeys().filter(k=>k!==keep);if(!all.length)return false;
  const pre=offKey('');
  const mute=(pre==null)?[]:all.filter(k=>k.indexOf(pre)===0&&!offIsBearing(k.slice(pre.length)));
  const ks=mute.length?mute:all;
  let old=ks[0],oa=offAt(ks[0]);
  ks.forEach(k=>{const a=offAt(k);if(a<oa){oa=a;old=k;}});
  try{localStorage.removeItem(old);return true;}catch(e){console.error('[off]',e);return false;}}
function offTrim(){let guard=0;while(offKeys().length>OFF_MAX_ENTRIES&&guard++<200)if(!offEvictOldest(null))break;}
// Schreiben mit Rückzug: ist der Speicher voll (Privatmodus, viele Konten, grosse Outbox), wird der
// älteste Schnappschuss geopfert und erneut versucht. Scheitert es endgültig, ist das KEIN Fehler für
// den Nutzer – die App läuft ohne Schnappschuss genau wie vor 2.7.0 weiter.
// Nur ein ECHTES Platzproblem rechtfertigt das Opfern eines anderen Schnappschusses. Safari im privaten
// Modus lässt `setItem` grundsätzlich scheitern – dort würde blindes Aufräumen bei jedem Speicherversuch
// drei brauchbare Stände löschen und am Ende alles leeren, ohne dass je ein Byte ankommt.
function offIsQuota(e){return !!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'
  ||e.code===22||e.code===1014||/quota|exceed/i.test(String(e.message||'')));}
function offWrite(k,s){for(let i=0;i<4;i++){
    try{localStorage.setItem(k,s);offTrim();return true;}
    catch(e){
      if(!offIsQuota(e)){console.error('[off] Schnappschuss nicht gespeichert',e);return false;}
      if(!offEvictOldest(k)){console.error('[off] Speicher voll, nichts mehr zum Aufräumen',e);return false;}}}
  return false;}
// Einen Lesestand ablegen. Nur das eigene Athleten-Konto (snapAllowed) – im Coach-Blick gehören die
// Zahlen jemand anderem und haben auf diesem Gerät nichts verloren.
function offSnapSave(p,data){
  try{
    if(data==null)return false;
    if(!offCacheable(p))return false;
    if(!snapAllowed())return false;
    const k=offKey(p);if(!k)return false;
    let s;try{s=JSON.stringify({at:Date.now(),data});}catch(e){return false;}   // Zyklen o.ä. – still übergehen
    if(s.length>OFF_MAX_BYTES)return false;   // zu gross: lieber kein Stand als ein voller Speicher
    return offWrite(k,s);
  }catch(e){console.error('[off]',e);return false;}}
// Lesen. Gibt {data,at} oder null. Null heisst IMMER „wir wissen es nicht" – nie „es ist nichts da".
// Alles, was hier schiefgehen kann (iOS hat den Speicher geleert, kaputtes JSON, fremdes Format),
// endet in null und räumt den Eintrag weg.
function offSnapLoad(p){
  try{
    const k=offKey(p);if(!k)return null;
    const s=localStorage.getItem(k);if(!s)return null;
    const o=JSON.parse(s);
    if(!o||typeof o!=='object'||!('data' in o))throw new Error('Format');
    const at=+o.at||0;
    if(at&&Date.now()-at>OFF_MAX_AGE_MS){try{localStorage.removeItem(k);}catch(e){}return null;}
    return {data:o.data,at};
  }catch(e){console.error('[off]',e);try{const k=offKey(p);if(k)localStorage.removeItem(k);}catch(e2){}return null;}}
function offClearAll(){offKeys().forEach(k=>{try{localStorage.removeItem(k);}catch(e){}});}

// ----- Outbox ÜBER dem Schnappschuss -----
// Der Fall, um den es geht (CRITIC K4): Im Keller ohne Netz einen Satz loggen, dann den Tab wechseln.
// Ohne diese Überlagerung zeigte der Schnappschuss den Serverstand VON VORHIN – also ohne den Satz.
// Aus „falscher Null" würde „falscher Altstand", und der Nutzer trägt denselben Satz ein zweites Mal.
// Absichtlich NUR auf dem stale-Pfad: eine frische Serverantwort hat den Eintrag entweder schon (dann
// wäre die Überlagerung eine Dublette) oder der Eintrag ist gerade unterwegs. Der Doppeleintrag beim
// Wiederverbinden entsteht genau hier – deshalb steht das so eng.
function offPending(kind){try{if(!ME||ME.id==null)return [];
  return outboxList().filter(x=>x&&x.uid===ME.id&&x.kind===kind&&x.body);}catch(e){console.error('[off]',e);return [];}}
function offQueryDate(p){const m=/[?&]date=([^&]+)/.exec(String(p||''));
  if(!m)return null;let d='';try{d=decodeURIComponent(m[1]);}catch(e){d=m[1];}
  return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:null;}
// Sätze sind serverseitig ein Upsert über (Nutzer, Übung, Tag, Satznummer) – ein wartender Satz ERSETZT
// also die Zeile, die schon da ist, statt sich danebenzustellen. Sonst stünde derselbe Satz zweimal.
function offOverlaySets(logs,uid,date){
  const out=Array.isArray(logs)?logs.slice():[];
  offPending('set').forEach(it=>{const b=it.body||{};
    if(b.user_id!=null&&+b.user_id!==+uid)return;
    if(date&&String(b.date||'')!==String(date))return;
    const row={id:null,user_id:+uid,exercise_id:+b.exercise_id,date:String(b.date||date||''),
      set_no:+b.set_no,weight:+b.weight||0,reps:+b.reps||0,note:b.note??null,pending:true};
    const i=out.findIndex(r=>r&&+r.exercise_id===row.exercise_id&&+r.set_no===row.set_no&&String(r.date)===row.date);
    if(i>=0)out[i]=Object.assign({},out[i],row);else out.push(row);});
  return out;}
// Dieselbe Rechnung wie `dayNutrition` im Server (src/logic.js) – stünde in der Kopfzeile eine andere
// Zahl als in der Liste darunter, wäre die Überlagerung schlimmer als gar keine.
function offNutritionSum(items,prev){
  const s=(items||[]).reduce((a,r)=>({kcal:a.kcal+(+r.kcal||0),fat:a.fat+(+r.fat||0),
    carbs:a.carbs+(+r.carbs||0),protein:a.protein+(+r.protein||0)}),{kcal:0,fat:0,carbs:0,protein:0});
  const o=Object.assign({},prev||{});
  const t=+o.target||0;
  o.consumed=Math.round(s.kcal);
  o.macros={fat:Math.round(s.fat),carbs:Math.round(s.carbs),protein:Math.round(s.protein)};
  o.remaining=t?Math.round(t-s.kcal):null;
  o.pct=t?Math.min(1,s.kcal/t):0;
  o.status=!t?'ok':(s.kcal>t*1.05?'over':(s.kcal>=t*0.95?'onTarget':'under'));
  return o;}
// Essen. Zwei Arten warten in der Ablage:
//   POST /foodlog                  – trägt alle Nährwerte im Rumpf, lässt sich vollständig nachbilden.
//   POST /foodlog/frommeal/<id>    – der Server löst die Mahlzeit erst beim Eintreffen in Zeilen auf.
//     Die Nährwerte kennen wir hier NICHT. Also steht die Zeile mit dem Namen aus der Warteliste da und
//     mit `pendingUnknown` – und die Tagessumme bleibt unverändert. Eine geschätzte Zahl wäre genau die
//     Sorte Erfindung, die diese Welle abschafft.
function offOverlayFoodlog(v,uid,date){
  if(!v||typeof v!=='object'||!Array.isArray(v.items))return v;
  const d=String(date||v.date||'');
  const items=v.items.slice();let added=0;
  offPending('food').forEach(it=>{
    const b=it.body||{},base=String(it.path||'').split('?')[0],bd=String(b.date||d);
    if(d&&bd!==d)return;
    if(b.user_id!=null&&+b.user_id!==+uid)return;
    if(b.client_id&&items.some(r=>r&&r.client_id===b.client_id))return;   // ist doch schon angekommen
    const row={id:null,client_id:b.client_id||null,user_id:+uid,date:bd,meal_slot:b.meal_slot||null,
      food:b.food||it.label||'Eintrag',amount:b.amount??null,meal_id:null,pending:true};
    if(base==='/foodlog'){
      items.push(Object.assign(row,{kcal:+b.kcal||0,protein:+b.protein||0,carbs:+b.carbs||0,fat:+b.fat||0}));added++;}
    else if(/^\/foodlog\/frommeal\/\d+$/.test(base)){
      items.push(Object.assign(row,{food:it.label||'Mahlzeit',kcal:0,protein:0,carbs:0,fat:0,pendingUnknown:true}));added++;}});
  if(!added)return v;
  const out=Object.assign({},v,{items});
  out.summary=offNutritionSum(items,v.summary);
  return out;}
// Supplements. Zugewiesene werden im Plan abgehakt (nicht angehängt – der Server macht dasselbe über
// (Nutzer, Tag, Supplement)); freie Einträge kommen als Extra dazu, wenn der Name noch nicht dasteht.
function offOverlaySupp(v,uid,date){
  if(!v||typeof v!=='object')return v;
  const d=String(date||v.date||'');
  const pend=offPending('intake').filter(it=>{const b=it.body||{};return !d||String(b.date||d)===d;});
  if(!pend.length)return v;
  const plan=(v.plan||[]).slice(),extras=(v.extras||[]).slice();
  pend.forEach(it=>{const b=it.body||{};
    if(b.supplement_id!=null){
      const i=plan.findIndex(x=>x&&+x.supplement_id===+b.supplement_id);
      if(i>=0&&!plan[i].taken)plan[i]=Object.assign({},plan[i],{taken:true,pending:true,dose:b.dose||plan[i].dose});}
    else{const nm=String(b.name||it.label||'').replace(/^Supplement · /,'').trim();
      if(!nm||extras.some(x=>x&&x.name===nm))return;
      extras.push({supplement_id:null,name:nm,dose:b.dose||null,taken:true,intake_id:null,mandatory:false,pending:true});}});
  return Object.assign({},v,{plan,extras,total:plan.length,done:plan.filter(p=>p&&p.taken).length});}
// Check-in: ein Upsert je Tag, und der Server behält über COALESCE alles, was NICHT mitgeschickt wurde.
// Genau so wird hier überlagert – ein wartender Check-in, der nur das Gewicht trägt, darf den Schlaf
// von gestern nicht auf null setzen.
const OFF_CHECKIN_SKIP={user_id:1,date:1,client_id:1,id:1};
function offCheckinFields(b){const o={};
  Object.keys(b||{}).forEach(k=>{if(!OFF_CHECKIN_SKIP[k]&&b[k]!=null&&b[k]!=='')o[k]=b[k];});return o;}
function offOverlayCheckins(list,uid){
  const pend=offPending('checkin');if(!pend.length)return list;
  const out=Array.isArray(list)?list.slice():[];
  pend.forEach(it=>{const b=it.body||{};
    if(b.user_id!=null&&+b.user_id!==+uid)return;
    const dt=String(b.date||'');if(!dt)return;
    const i=out.findIndex(r=>r&&String(r.date)===dt);
    const merged=Object.assign({},i>=0?out[i]:{id:null,user_id:+uid,date:dt},offCheckinFields(b),{pending:true});
    if(i>=0)out[i]=merged;else out.push(merged);});
  out.sort((a,b)=>String(b&&b.date||'').localeCompare(String(a&&a.date||'')));   // neueste zuerst, wie der Server
  return out;}
// Die Startseite holt alles in EINEM Aggregat (/home/:uid). Die Teilstücke haben dieselbe Form wie die
// Einzelrouten – also dieselben Überlagerungen, eine Ebene tiefer.
function offOverlayHome(v,uid){
  if(!v||typeof v!=='object')return v;
  const d=String(v.date||today());
  const out=Object.assign({},v);
  if(out.foodlog)out.foodlog=offOverlayFoodlog(out.foodlog,uid,d);
  if(out.supplements)out.supplements=offOverlaySupp(out.supplements,uid,d);
  if(Array.isArray(out.checkins))out.checkins=offOverlayCheckins(out.checkins,uid);
  // `logsToday` zählt Sätze mit reps>0. Wartende Sätze desselben Tages zählen mit – aber jede
  // (Übung, Satznummer) nur einmal, sonst zählte ein zweimal angetippter Satz doppelt.
  const seen={},sets=offPending('set').filter(it=>{const b=it.body||{};
    if(String(b.date||'')!==d||!(+b.reps>0))return false;
    const k=b.exercise_id+'/'+b.set_no;if(seen[k])return false;seen[k]=1;return true;});
  if(sets.length)out.logsToday=(+out.logsToday||0)+sets.length;
  return out;}
// Der eine Einstieg. Kennt die Route niemand, kommt der Schnappschuss unverändert zurück – ein
// unbekannter Pfad darf nie ein Fehler sein.
function offApplyOutbox(p,data){
  try{
    if(data==null||typeof data!=='object')return data;
    const path=String(p||''),q=path.split('?')[0];let m;
    if((m=/^\/home\/(\d+)$/.exec(q)))return offOverlayHome(data,+m[1]);
    if((m=/^\/foodlog\/(\d+)$/.exec(q)))return offOverlayFoodlog(data,+m[1],offQueryDate(path));
    if((m=/^\/supplement-intake\/(\d+)$/.exec(q)))return offOverlaySupp(data,+m[1],offQueryDate(path));
    if((m=/^\/checkins\/(\d+)$/.exec(q))&&Array.isArray(data.checkins))
      return Object.assign({},data,{checkins:offOverlayCheckins(data.checkins,+m[1])});
    if((m=/^\/logs\/(\d+)$/.exec(q))&&Array.isArray(data.logs))
      return Object.assign({},data,{logs:offOverlaySets(data.logs,+m[1],offQueryDate(path))});
  }catch(e){console.error('[off]',e);}
  return data;}

// ----- Ein Zeitstempel, eine Stelle -----
// BUILD-A3 §3.5: `stale` + `at` werden EINMAL in der Hülle gezeigt, nicht in jeder Ansicht. Die Hülle
// hat dafür schon ein Element: `#syncState` im Kopf (bisher „Offline · 2 warten"). Es bekommt den Stand
// vorangestellt – „Stand 20:14 · offline". Kein neues Markup, keine Datei ausserhalb dieses Pakets.
// A-III.2 ruft `offStaleChip()` und liest bei Bedarf `offIsStale()` / `offStaleAt()` – und baut nichts nach.
//
// `var`, nicht `let` – und das ist kein Schlendrian, sondern gemessen: `_onlineInit()` weiter oben ruft
// `syncBadge()` schon WÄHREND diese Datei ausgewertet wird, also lange bevor diese Zeile an der Reihe ist.
// Mit `let` stünde die Bindung dann in der temporalen Todeszone, `offStaleLabel()` würfe einen
// ReferenceError, und der gesamte Rest von core.js (alles ab hier: Anmeldung, Router, Lader) würde nie
// ausgeführt – ein weisser Bildschirm. Genau das ist in der ersten Fassung passiert. `var` wird gehoben
// und ist zu diesem Zeitpunkt schlicht `undefined`, was `offStaleLabel()` sauber als „nichts Veraltetes"
// liest. Die Funktionen unten fangen zusätzlich alles ab, was ihnen noch fehlen könnte.
var OFF_STALE_AT=0;
// Je Pfad gemerkt, nicht nur als eine Zahl. Grund: eine Ansicht mischt mehrere Antworten. Käme eine
// davon frisch und die anderen aus dem Schnappschuss, würde ein einzelnes Zurücksetzen den Chip löschen,
// obwohl daneben weiter alte Zahlen stehen. Mit der Tabelle fällt genau der eine Eintrag weg, für den
// frische Zahlen da sind – der Chip verschwindet erst, wenn kein alter Stand mehr auf dem Bildschirm ist.
// `var` aus demselben Grund wie OFF_STALE_AT (siehe oben): _onlineInit() läuft früher als diese Zeile.
var OFF_STALE_P=null;
function _offStaleMap(){if(!OFF_STALE_P||typeof OFF_STALE_P!=='object')OFF_STALE_P={};return OFF_STALE_P;}
// Gezeigt wird der ÄLTESTE der gerade gelesenen Stände. „Stand 20:14" darf nicht frischer aussehen als
// die älteste Zahl auf dem Bildschirm. Der Chip wird nur angefasst, wenn sich wirklich etwas ändert.
function _offStaleRecalc(){const m=_offStaleMap();let min=0;
  Object.keys(m).forEach(k=>{const a=+m[k]||0;if(a&&(!min||a<min))min=a;});
  if(min===OFF_STALE_AT)return;
  OFF_STALE_AT=min;offStaleChip();}
function offNoteStale(at,p){at=+at||0;if(!at)return;
  _offStaleMap()[String(p==null?'':p)]=at;_offStaleRecalc();}
// Für DIESEN Pfad sind frische Zahlen da (echtes 200 in API.get). Das ist der Unterschied zwischen
// „das Etikett fällt, weil neue Zahlen da sind" und „das Etikett fällt, weil das Netz zurück ist".
function offFreshPath(p){const m=_offStaleMap();const k=String(p==null?'':p);
  if(!(k in m))return;
  delete m[k];_offStaleRecalc();}
// Neue Ansicht, neue Rechnung: die Zahlen werden gleich frisch geholt. Bleibt es beim alten Stand,
// setzt der nächste stale-Treffer den Chip sofort wieder.
function offFresh(){OFF_STALE_P={};if(!OFF_STALE_AT)return;OFF_STALE_AT=0;offStaleChip();}
function offIsStale(){return OFF_STALE_AT>0;}
function offStaleAt(){return OFF_STALE_AT||0;}
// „Stand 20:14" – am selben Tag nur die Uhrzeit, sonst mit Datum davor. Leer = nichts Veraltetes da.
function offStaleLabel(){
  try{
    if(!OFF_STALE_AT)return '';
    const d=new Date(OFF_STALE_AT);if(isNaN(d.getTime()))return '';
    const t=d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    return 'Stand '+((new Date()).toDateString()===d.toDateString()?t:(fmtDate(d,{})+', '+t));
  }catch(e){return '';}}
function offStaleChip(){try{syncBadge();}catch(e){console.error('[off]',e);}}
// ----- Das Etikett fällt, weil jemand nachgeholt hat -----
// Netz zurück oder App wieder im Vordergrund: irgendjemand muss die frischen Zahlen tatsächlich holen,
// sonst bleibt der alte Stand stehen. Genau das tut diese Funktion – Ansichts-Cache verwerfen und die
// SICHTBARE Ansicht neu zeichnen. Sie ist bewusst zurückhaltend, mit fünf Bremsen:
//   • nur angemeldet und mit einer aktiven Ansicht (sonst gibt es nichts zu zeichnen),
//   • nur wenn das Gerät online ist (offline holt niemand etwas),
//   • nur wenn wirklich ein alter Stand angezeigt wird (offIsStale) – kein Neuzeichnen auf Verdacht,
//   • nie über ein offenes Sheet hinweg (das würde eine Eingabe des Nutzers wegwischen),
//   • höchstens alle 3 s: `online` und `visibilitychange` feuern beim Aufwachen oft im selben Atemzug.
// Gezeichnet wird bevorzugt mit dem Auffrischer des jeweiligen Bereichs – genau wie nach dem Nachtragen
// aus der Outbox (_afterFlushPaint). Das hat einen handfesten Grund: die Bereiche haben EIGENE Speicher
// mit eigener Frist. `analysis.js` etwa hält seine Antworten 60 s für frisch (ANA_TTL) und merkt nicht,
// dass sie aus dem Schnappschuss kamen – ein blosses go('tracker') malte deshalb denselben alten Stand
// noch einmal, ohne eine einzige Anfrage (gemessen: p10-wieder40.mjs, tracker, 40 s ohne frische API-200).
// `anaRefreshIfVisible`/`mindRefresh` setzen diese Speicher zurück. Alles andere über den Router – mit
// `keepStale`, damit go() den Chip NICHT vorab löscht. Er soll fallen, wenn die 200er da sind.
var OFF_REFRESH_AT=0;
function offRefreshActive(){
  try{
    if(!ME||!CUR_TAB)return false;
    if(navigator.onLine===false)return false;
    if(!offIsStale())return false;
    if(typeof sheetOpen==='function'&&sheetOpen())return false;
    const now=Date.now();if(OFF_REFRESH_AT&&now-OFF_REFRESH_AT<3000)return false;
    OFF_REFRESH_AT=now;
    const t=CUR_TAB;
    if(typeof invalidateView==='function')invalidateView();
    const run=fn=>{try{const o=fn();if(o&&typeof o.catch==='function')o.catch(e=>console.error('[off]',e));}catch(e){console.error('[off]',e);}};
    if(t==='home'&&typeof refreshHomeIfActive==='function'){run(refreshHomeIfActive);return true;}
    if(t==='tracker'&&typeof anaRefreshIfVisible==='function'&&document.getElementById('anaBody')){run(anaRefreshIfVisible);return true;}
    if(t==='mindset'&&typeof mindRefresh==='function'&&document.getElementById('mindBody')){run(mindRefresh);return true;}
    if(typeof go==='function'){run(()=>go(t,{keepStale:true}));return true;}
    return false;
  }catch(e){console.error('[off]',e);return false;}}

// ----- Abmelden räumt auf (BUILD-A3 §3.4) -----
// Auf einem geteilten Gerät darf nach dem Abmelden nichts vom Konto zurückbleiben: keine Zahlen, keine
// Namen von Übungen oder Lebensmitteln, keine Vorschlagslisten. `clearAccountStorage()` deckt die alten
// Schlüssel ab (be_me/be_plan_/be_today_/be_lf_recent_ …) und seit A-III.1 auch `be_snap_`; die eigenen
// Outbox-Rümpfe räumt es ebenfalls. Diese Funktion ist der EINE benannte Weg dorthin.
function purgeLocalData(uid){
  if(uid===undefined)uid=ME&&ME.id;
  try{snapClearAll();}catch(e){console.error('[purge]',e);}
  try{offClearAll();}catch(e){console.error('[purge]',e);}
  try{clearAccountStorage(uid);}catch(e){console.error('[purge]',e);}
  OFF_STALE_AT=0;OFF_STALE_P={};
  try{offStaleChip();}catch(e){}
  return true;}

// ===== AUTH =====
// Der JWT lebt NUR im httpOnly-Cookie. login/register liefern ihn seit 2.5 nicht mehr im JSON-Rumpf,
// und dieser Client hat ihn nie gelesen oder abgelegt (kein localStorage-Token, kein Bearer-Header):
// ein XSS könnte ihn damit nicht abgreifen. Bitte auch künftig nichts aus res.data außer `user` verwenden.
// Einladungscode (REGISTER_CODE auf dem Server): GET /api/register-info sagt, ob das Feld gebraucht wird.
// Einmal je Seitenladen gefragt, erst beim Wechsel auf „Registrieren" – wer sich nur anmeldet, zahlt nichts.
// Älterer Server ohne die Route (404) oder kein Netz: Feld bleibt weg, Registrierung läuft wie bisher.
let _regInfo=null;
// Die Serverangaben zur Anmeldung – genau EINMAL je Seitenladen geholt und danach aus _regInfo bedient.
// Zweiter Nutzer neben dem Einladungsfeld: `mailConfigured`. Ohne SMTP verschickt der Server nichts
// (`email.js`: „Mail nicht versandt – SMTP fehlt"), die Oberfläche versprach aber trotzdem
// „Bestätigungs-Mail unterwegs" (B15/A5). Fehlt das Feld (Server vor 2.5), ist der Wert `null` =
// „wir wissen es nicht" – dann wird über E-Mail NICHTS versprochen. Ein fehlendes Versprechen kostet
// nichts, ein falsches kostet das Vertrauen.
async function crRegisterInfo(){
  if(_regInfo)return _regInfo;
  const r=await API.get('/register-info');
  const info=(r.status===200&&r.data)
    ?{inviteRequired:!!r.data.inviteRequired,mailConfigured:(typeof r.data.mailConfigured==='boolean')?r.data.mailConfigured:null}
    :{inviteRequired:false,mailConfigured:null,unknown:r.status!==404};
  // Ein Aussetzer (status 0) wird NICHT gemerkt: sonst bliebe eine einzige Sekunde ohne Netz für den Rest
  // des Seitenlebens die Wahrheit. Eine echte Antwort – auch 404 vom älteren Server – darf bleiben.
  if(r.status!==0)_regInfo=info;
  return info;}
// true = der Server kann Mails verschicken · false = er kann es nicht · null = unbekannt (alter Server,
// kein Netz). Nur bei true darf die Oberfläche eine Mail ankündigen.
async function crMailConfigured(){try{return (await crRegisterInfo()).mailConfigured;}catch(e){console.error('[register-info]',e);return null;}}
async function loadRegisterInfo(){
  const info=await crRegisterInfo();
  const wrap=document.getElementById('regCode');
  if(wrap)wrap.classList.toggle('hidden',!(authMode==='register'&&info.inviteRequired));
  return info;}
function toggleAuth(){authMode=authMode==='login'?'register':'login';const reg=authMode==='register';
  _authWaitStop(); // ein laufender 429-Countdown gehört zum vorigen Versuch
  document.getElementById('regName').classList.toggle('hidden',!reg);
  const pw=document.getElementById('i_pw');if(pw)pw.setAttribute('autocomplete',reg?'new-password':'current-password'); // Passwort-Manager: neues vs. bestehendes Passwort
  // Stärke-Hilfe nur beim NEUEN Passwort (Registrieren) – beim Anmelden gibt es nichts zu bewerten
  if(typeof pwHintMode==='function')pwHintMode('i_pw',reg);
  const code=document.getElementById('regCode');if(code)code.classList.add('hidden');
  if(reg)loadRegisterInfo();
  document.getElementById('authBtn').textContent=reg?'Konto erstellen':'Anmelden';
  document.getElementById('switchLink').innerHTML=reg?'Schon ein Konto? <a onclick="toggleAuth()">Anmelden</a>':'Noch kein Konto? <a onclick="toggleAuth()">Registrieren</a>';
  document.getElementById('authErr').classList.add('hidden');}
async function doAuth(){const email=val('i_email'),pw=val('i_pw');document.getElementById('authErr').classList.add('hidden');
  if(_authWait.t)return; // Countdown läuft – der Knopf ist gesperrt, Enter darf ihn nicht umgehen
  if(!email||!pw)return showErr('Bitte E-Mail und Passwort eingeben.');
  const btn=document.getElementById('authBtn');btn.disabled=true;let res;
  if(authMode==='register'){const name=val('i_name');if(!name){btn.disabled=false;return showErr('Bitte Namen eingeben.');}
    // Mindestlänge wie der Server (8) – die Stärke-Hilfe hat es beim Tippen schon gesagt, hier nur der Riegel
    if(pw.length<8){btn.disabled=false;return showErr('Das Passwort braucht mindestens 8 Zeichen.');}
    const body={email,password:pw,name};
    // Einladungscode nur mitschicken, wenn das Feld sichtbar ist (sonst bleibt der Rumpf wie bisher)
    const cw=document.getElementById('regCode');if(cw&&!cw.classList.contains('hidden')){body.code=val('i_code');
      if(!body.code){btn.disabled=false;return showErr('Bitte den Einladungscode eingeben.');}}
    res=await API.post('/register',body);}
  else res=await API.post('/login',{email,password:pw});
  btn.disabled=false;
  if(res.status===200){ME=res.data.user;
    // Neuer Athlet ohne Profildaten -> Onboarding; sonst normale App
    if(authMode==='register'&&ME.role==='athlete')startOnboarding();
    else startApp();
  }else if(res.status===429&&res.data&&Number.isFinite(+res.data.retryAfterSec)&&+res.data.retryAfterSec>0)_authWaitStart(Math.ceil(+res.data.retryAfterSec));
  else showErr(res.data?.error||'Fehler.');}
function showErr(m){const e=document.getElementById('authErr');e.textContent=m;e.classList.remove('hidden');}
// 429 mit retryAfterSec (V2): statt „in 15 Minuten" ein Countdown im Fehlerbereich, Knopf solange gesperrt.
// Ohne das Feld (älterer Server) bleibt es beim Text des Servers – siehe doAuth.
const _authWait={t:null,until:0};
function _authWaitStart(sec){_authWaitStop();_authWait.until=Date.now()+sec*1000;
  const btn=document.getElementById('authBtn');if(btn)btn.disabled=true;
  // Die Sperre gilt je ADRESSE (Server: IP+E-Mail). Tippt jemand eine andere Adresse ein – Familien-Tablet,
  // das Geschwister hat sich gerade ausgesperrt – darf der Knopf nicht 15 Minuten zu bleiben: Countdown weg,
  // Fehler weg, Anmelden frei. Kommt dieselbe Adresse zurueck, wuerde der Server ohnehin wieder 429 sagen.
  const em=document.getElementById('i_email');_authWait.email=em?em.value.trim().toLowerCase():'';
  if(em&&!em._waitHook){em._waitHook=true;em.addEventListener('input',()=>{
    if(_authWait.t&&em.value.trim().toLowerCase()!==_authWait.email){_authWaitStop();const e=document.getElementById('authErr');if(e)e.classList.add('hidden');}});}
  const tick=()=>{const left=Math.ceil((_authWait.until-Date.now())/1000);
    if(left<=0){_authWaitStop();showErr('Du kannst es jetzt erneut versuchen.');return;}
    // Sekunden bis eine Minute, darüber Minuten:Sekunden – „884 s" liest niemand gern
    const t=left<60?`${left} s`:`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')} Min.`;
    showErr(`Zu viele Versuche – in ${t} geht es weiter.`);};
  tick();_authWait.t=setInterval(tick,250);}
function _authWaitStop(){if(_authWait.t){clearInterval(_authWait.t);_authWait.t=null;}
  const btn=document.getElementById('authBtn');if(btn)btn.disabled=false;}
// Sitzung weg (401 auf einem normalen Aufruf: Token abgelaufen, widerrufen – „Alle Geräte abmelden",
// Passwortwechsel auf einem anderen Gerät – oder Konto gelöscht). Genau EIN Neuladen, danach steht der
// Anmeldebildschirm mit dem Grund. Kein Endlos-Reload: nach dem Neuladen fragt shell.js /api/me – bekommt
// das 401, wird ME nie gesetzt, und dieser Pfad läuft nicht erneut. Der Schnappschuss (be_me) fliegt hier
// raus, sonst holte offlineBoot() den widerrufenen Nutzer beim nächsten Start ohne Netz zurück.
// Outbox und Vorschlagslisten bleiben liegen: meist meldet sich derselbe Nutzer gleich wieder an.
function sessionLost(reason){if(sessionLost.done)return;sessionLost.done=true;
  ME=null;
  try{snapClearAll();}catch(e){}
  // A-III.1: auch die Lese-Schnappschüsse. Sonst holte der nächste Start ohne Netz die Zahlen eines
  // Kontos zurück, dessen Sitzung der Server gerade widerrufen hat („Alle Geräte abmelden").
  try{offClearAll();}catch(e){}
  try{sessionStorage.setItem('be_relogin',/neu anmelden/i.test(String(reason||''))?'Bitte melde dich neu an.':'Deine Sitzung ist abgelaufen – bitte melde dich neu an.');}catch(e){}
  location.reload();}
// Alles, was dieses Konto im Speicher des Geräts hinterlassen hat – für das Abmelden auf einem geteilten
// Gerät. Bleiben dürfen nur Geräte-Einstellungen (Pausenlänge, Hinweise, Geräte-Marke, Tour-Merker) und die
// Outbox-Einträge ANDERER Konten: die gehören nicht uns und werden gesendet, wenn ihr Konto sich anmeldet.
// `snap_` seit A-III.1: die Lese-Schnappschüsse (be_snap_v1_<uid>_<pfad>) tragen Gewicht, Kalorien,
// Übungsnamen und Bereitschaft – genau das, was auf einem geteilten Gerät nicht liegen bleiben darf.
const ACCOUNT_KEY_RE=/^be_(me$|snap_|plan_|today_|lf_recent_|level$|streak$|ach$|visits_|q$|q_|daily$|daily_|last_set$|pending_share$)/;
function clearAccountStorage(uid){
  try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&ACCOUNT_KEY_RE.test(k))localStorage.removeItem(k);}}catch(e){console.error('[logout]',e);}
  // Eigene Outbox-Rümpfe: nach dem Nachtragen sollte hier nichts mehr liegen (logout fragt vorher nach)
  if(uid!=null){try{const rest=outboxList().filter(x=>!(x&&x.uid===uid));_outboxWrite(rest);}catch(e){console.error('[logout]',e);}}
  try{sessionStorage.removeItem('be_relogin');}catch(e){}}
// Abmelden ist erst erledigt, wenn der Server das Cookie gelöscht hat: ohne Netz bleibt die Sitzung
// 30 Tage gültig (httpOnly-Cookie), die gecachte Hülle würde aber trotzdem den Anmeldebildschirm zeigen –
// auf einem geteilten Gerät genau das Gegenteil dessen, was gewollt war.
// Wartende Einträge gehen vorher raus. Was der Server gerade nicht annimmt, wird NICHT still verworfen:
// der Nutzer entscheidet (abbrechen und später abmelden – oder bewusst verwerfen). Auf einem geteilten
// Gerät darf nach dem Abmelden nichts vom Konto zurückbleiben, auch keine Outbox-Rümpfe mit Werten.
// Bewusst entschieden (offener Punkt aus 2.3): ohne Netz wird NICHTS aufgeräumt. Den Schnappschuss zu
// löschen und den Anmeldebildschirm zu zeigen wäre eine Beruhigung ohne Deckung – das Cookie bleibt
// gültig, und beim ersten Aufruf mit Netz stünde derselbe Nutzer wieder in der App. Solange wir das
// Abmelden nicht wirklich ausführen können, sagen wir das auch: der Nutzer bleibt angemeldet.
async function logout(force){
  try{if(outboxCount())await flushOutbox();}catch(e){console.error('[logout]',e);}
  const n=outboxCount();
  if(n&&force!==true&&typeof confirmSheet==='function')
    return confirmSheet('Abmelden',`${pl(n,'Eintrag konnte','Einträge konnten')} noch nicht gesendet werden (Server gerade nicht erreichbar). Beim Abmelden ${n===1?'wird er':'werden sie'} verworfen. Warte lieber kurz und versuche es dann erneut – oder melde dich trotzdem ab.`,{label:'Trotzdem abmelden',onYes:()=>logout(true)});
  const r=await API.post('/logout');
  if(r.status===0)return toast('Zum Abmelden brauchst du kurz Netz – bis dahin bleibst du angemeldet.');
  // A-III.1 §3.4: EIN benannter Weg räumt alles weg – Schnappschüsse, Lese-Stände, Outbox-Reste,
  // Vorschlagslisten. Bis 2.6.0 blieb der letzte Stand auf einem geteilten Gerät liegen.
  purgeLocalData(ME&&ME.id);ME=null;location.reload();}
// „Alle Geräte abmelden" (V1): der Server zählt token_version hoch – jedes andere Gerät bekommt beim nächsten
// Aufruf 401 und landet auf der Anmeldung. DIESES Gerät bleibt drin, weil die Antwort ein frisches Cookie setzt.
// Feature-Erkennung statt Annahme: ob der Server dieses Gerät wirklich drin lässt, zeigt erst ein Aufruf nach
// dem Widerruf. Räumt er das eigene Cookie doch ab (ältere Server-Fassung), gibt es hier ein sauberes
// Abmelden mit klarer Ansage – kein 401-Reload mit „Sitzung abgelaufen" auf einer Aktion, die man selbst wollte.
async function logoutAll(){
  const r=await API.post('/logout-all',{},{raw:true});
  if(r.status===404)return toast('Dafür braucht der Server ein Update – bitte den Betreiber informieren.');
  if(r.status===401)return sessionLost(r.data&&r.data.error);
  if(r.status!==200)return toast(r.data?.error||'Das hat nicht geklappt – bitte erneut versuchen.');
  const me=await API.get('/me',null,{raw:true});
  if(me.status===200)return toast('Alle anderen Geräte sind abgemeldet ✓ – hier bleibst du angemeldet.');
  if(me.status===401){snapClearAll();ME=null;
    try{sessionStorage.setItem('be_relogin','Alle Geräte sind abgemeldet ✓ – bitte melde dich hier neu an.');}catch(e){}
    location.reload();return;}
  toast('Alle anderen Geräte sind abgemeldet ✓');}

// ===== PASSWORT VERGESSEN / RESET / VERIFIZIERUNG =====
// openForgot/submitForgot/showResetForm/submitReset leben jetzt in account.js (WP6) – hier bewusst entfernt,
// damit es keine zwei Fassungen derselben Funktion gibt.

// Verifizierungs-Mail erneut senden (eingeloggt)
// Ohne eingerichteten Versand antwortet der Server mit 200, schreibt die Mail aber nur ins Log – „gesendet ✓"
// wäre dann eine Lüge, und der Nutzer wartet auf eine Mail, die nie kommt (B15/A5). Deshalb vorher fragen.
async function resendVerify(){
  if(await crMailConfigured()===false)return toast('E-Mail-Versand ist noch nicht eingerichtet – sag dem Betreiber Bescheid.');
  const r=await API.post('/request-verification');
  if(r.status===200)return toast(r.data&&r.data.already?'Deine E-Mail ist bereits bestätigt ✓':'Bestätigungs-E-Mail gesendet ✓');
  // „Fehler" allein sagt niemandem, ob er es gleich noch einmal versuchen soll.
  toast(r.status===0?'Keine Verbindung – bitte später erneut versuchen.':(r.data?.error||'Das hat nicht geklappt – bitte erneut versuchen.'));}

// ===== EINWILLIGUNG & RECHT (Paket A-II.4, Präfix lg) =====
// Zwei statische Seiten ohne JavaScript (public/datenschutz.html, public/impressum.html). Sie werden
// von express.static ausgeliefert, tragen also KEINEN ?v=-Stempel – der Server ersetzt __APP_VERSION__
// nur in index.html und sw.js. Deshalb hier echte Links ohne Stempel; der Service Worker holt sie
// network-first, sie können also nie veralten.
// Ein Helfer für drei Stellen: unter der Anmeldekarte (account.js: renderLoginView), im
// Einwilligungsschritt des Onboardings und im Konto-Sheet.
const LG_PRIVACY_URL='/datenschutz.html', LG_IMPRINT_URL='/impressum.html';
// Die Fassung des Einwilligungstexts vergibt der SERVER (src/server.js: CONSENT_VERSION, heute
// '2026-09-13') und schreibt sie nach users.consent_version. Der Client schickt deshalb bewusst KEINE
// eigene Nummer mit – zwei Quellen für dieselbe Angabe laufen früher oder später auseinander.
// Ändert sich der Text der drei Karten unten inhaltlich, gehört CONSENT_VERSION im Server hochgezählt;
// dann fragt die App neu.
// Nachbesserung A-II (13.09.2026, derselbe Bautag wie die Fassung '2026-09-13', deshalb keine neue
// Nummer): „Was wir speichern" nannte Mindset, Notizen und Nachrichten nicht, obwohl datenschutz.html
// Abschnitt 2 sie als eigene Kategorie „Freitexte" führt – Karte und Häkchen sagen sie jetzt mit.
// Ob der Server sie auch technisch hinter die Einwilligung stellt, entscheidet Paket A-II.2
// (consentOk für die schreibenden Mindset-Routen); diese Datei kann das nicht.
// Damit diese Kopplung (A4-6) nicht still veraltet, tragen beide Rechtsseiten die Fassung als
// <meta name="einwilligung-fassung"> mit, und den Ausfüllzustand als <meta name="rechtstexte-status">.
// Die zwei Prüfbefehle stehen NUR hier, nicht in den HTML-Dateien selbst: ein Kommentar, der sein
// eigenes Suchmuster zitiert, findet sich selbst – die Prüfung würde nie grün.
//
//   1) Freigabe vor dem Deploy (B8) – muss LEER ausgeben:
//        grep -l 'rechtstexte-status" content="unvoll' public/*.html
//      Solange sie anschlägt, tragen die Seiten TODO-MARCO-Platzhalter und stehen auf robots=noindex.
//
//   2) Fassungsabgleich (A4-6) – die drei Werte müssen gleich sein:
//        grep -o "CONSENT_VERSION = '[^']*'" src/server.js
//        grep -ho 'content="[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}"' public/impressum.html public/datenschutz.html
function lgLegalLinksHTML(o){o=o||{};
  const col=o.color||'var(--ink2)';
  const a=(href,txt)=>`<a href="${href}" style="color:${col};padding:12px 10px;min-height:44px;display:inline-flex;align-items:center">${txt}</a>`;
  return `<nav aria-label="Rechtliches" style="display:flex;justify-content:${o.align||'center'};gap:4px;font-size:13px;${o.style||''}">
    ${a(LG_PRIVACY_URL,'Datenschutz')}<span style="color:var(--ink3);align-self:center" aria-hidden="true">·</span>${a(LG_IMPRINT_URL,'Impressum')}</nav>`;}

// Einwilligung an den Server. `POST /api/consent` entsteht in Paket A-II.2 – läuft dieser Client gegen
// einen älteren Server (404) oder gerade ohne Netz (0), darf die Anmeldung deswegen NICHT stehenbleiben.
// Wir merken uns die Zustimmung dann lokal und schicken sie beim nächsten Start noch einmal.
// Das ist kein Ersatz für die Serverspalte, sondern die Brücke bis dorthin – ehrlicher als ein
// verschlucktes Häkchen.
const LG_CONSENT_KEY='be_consent_pending';
// Die Fassung, die der Server gerade verlangt (aus einer 409-Antwort, siehe API.req). Solange wir keine
// gesehen haben, bleibt sie leer – dann gilt eine vorhandene Einwilligung als gültig. Nur so kann ein
// älterer Server (ohne das Feld) die App nicht in eine Dauerfrage treiben.
let LG_CONSENT_REQUIRED='';
async function lgConsentSend(){
  const r=await API.post('/consent',{});
  if(r.status===200){try{localStorage.removeItem(LG_CONSENT_KEY);}catch(e){}
    if(ME&&r.data){ME.consent_health_at=r.data.consent_health_at||ME.consent_health_at;ME.consent_version=r.data.consent_version||ME.consent_version;}
    // Die Fassung, die der Server GERADE geschrieben hat, ist ab jetzt die verlangte. Ohne diese Zeile
    // könnte eine ältere Merkung aus einem früheren 409 die App in eine Dauerfrage treiben, falls der
    // Server seine Fassung je zurückdreht.
    if(r.data&&typeof r.data.consent_version==='string'&&r.data.consent_version)LG_CONSENT_REQUIRED=r.data.consent_version;
    return true;}
  try{localStorage.setItem(LG_CONSENT_KEY,'1');}catch(e){}
  return false;}
// Eine Absage wegen fehlender Einwilligung (409 `needsConsent`) endet nicht in einem „Fehler"-Toast,
// sondern in einem Weg: wo es geht, öffnet die App die Einwilligungs-Karte SELBST; nur wo das nicht
// geht, bleibt die Meldung mit Knopf. Höchstens alle 20 Sekunden – ein hängender Sync darf den
// Bildschirm nicht zupflastern.
//
// Warum nicht einfach der Toast? Er steht 5 Sekunden. Wer mit der Tastatur oder einem Screenreader
// arbeitet, muss seinen Knopf in dieser Zeit erst finden – bei einem offenen Sheet liegt er außerhalb
// des Dialogs. Die Karte dagegen bleibt stehen, holt den Fokus und trägt den Knopf „Einwilligung
// erteilen" (Nachbesserung zu B1, Welle A-II). Für ein Bestandskonto ohne Einwilligung ist das der
// Unterschied zwischen „die App nimmt nichts an" und „hier ist der Weg".
let _lgConsentToastAt=0;
// Steht die Einwilligungs-Karte GERADE offen? Der Titel allein genügt dafür nicht: `_sheetHide()`
// (shell.js) nimmt dem Modal nur die Klasse `on` und lässt den Inhalt stehen – `#sheetTitle` trägt
// danach weiter „Einwilligung". Wer nur den Titel prüfte, hielt die Karte für offen, nachdem der
// Nutzer sie geschlossen hatte, und unterdrückte jeden weiteren Hinweis für den Rest der Sitzung.
// Gemessen: Karte schließen, Check-in tippen -> 409 vom Server, aber nichts auf dem Bildschirm.
function lgConsentSheetUp(){
  if(typeof sheetOpen==='function'&&!sheetOpen())return false;
  const t=document.getElementById('sheetTitle');
  return !!(t&&/Einwilligung/.test(t.textContent||''));}
// Darf die Karte jetzt von selbst aufgehen? Fünf Fälle, in denen sie es NICHT darf.
function lgConsentCanOpen(){
  if(typeof lgOpenConsentSheet!=='function')return false;              // ältere/andere Seite ohne die Karte
  if(typeof document==='undefined')return false;
  if(document.visibilityState==='hidden')return false;                 // im Hintergrund poppt nichts auf
  const app=document.getElementById('appView');
  if(!app||app.classList.contains('hidden'))return false;              // Anmeldung: nicht dazwischenfunken
  const onb=document.getElementById('onbView');
  if(onb&&!onb.classList.contains('hidden'))return false;              // Onboarding fragt selbst danach
  if(document.getElementById('tourOv'))return false;                   // laufende Einführungs-Tour: ihr Spotlight läge oben drauf
  if(lgConsentSheetUp())return false;                                  // steht schon offen
  // Wer gerade tippt, verlöre seinen Text: der Sheet-Stapel sichert nur das Markup, keine Feldinhalte.
  const a=document.activeElement;
  if(a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable))return false;
  return true;}
function lgConsentNeeded(){
  if(Date.now()-_lgConsentToastAt<20000)return;
  // Erst den Aufrufer seine eigene Fehlerbehandlung zu Ende machen lassen (Toast, Sheet schließen,
  // neu zeichnen) – sonst überschriebe er die Karte, die wir gerade geöffnet haben. Deshalb der
  // kurze Aufschub, und die Prüfung steht IN der Verzögerung, nicht davor.
  setTimeout(()=>{
    // Steht die Karte schon offen (z. B. die vom Start), ist alles gesagt: kein zweiter Hinweis daneben –
    // und die 20-Sekunden-Sperre bleibt ungenutzt. Sonst wäre sie nach dem Schließen der Karte scharf,
    // und der erste Check-in danach liefe ins Leere. Genau das war in der Probe passiert.
    if(lgConsentSheetUp())return;
    _lgConsentToastAt=Date.now();
    if(lgConsentCanOpen()){try{lgOpenConsentSheet();return;}catch(e){console.error('[consent]',e);}}
    toast('Dafür fehlt noch deine Einwilligung.',{label:'Ansehen',fn:()=>{
      if(typeof lgOpenConsentSheet==='function')lgOpenConsentSheet();
      else if(typeof openProfile==='function')openProfile();}});},80);}
// Beim Start einmal nachreichen, falls der Versand oben nicht durchkam (kein Netz, Server noch ohne Route).
async function lgConsentRetry(){
  let pend=null;try{pend=localStorage.getItem(LG_CONSENT_KEY);}catch(e){}
  if(!pend||!ME||ME.role!=='athlete')return;
  if(ME.consent_health_at){try{localStorage.removeItem(LG_CONSENT_KEY);}catch(e){}return;}
  try{await lgConsentSend();}catch(e){}}

// ===== EINWILLIGUNG BEIM START (A-II.4, Nachbesserung zur Prüfung) =====
// Bis hierher gab es GENAU EINE Tür zur Einwilligung: den letzten Onboarding-Schritt. Den sieht aber nur,
// wer sich selbst registriert (`doAuth`: `authMode==='register'`). Ein Konto, das der Coach über
// `POST /api/athletes/create` anlegt, und jedes Konto von vor 2.6.0 landet direkt in `startApp()` – und
// dort wurde bisher nur `lgConsentRetry()` gerufen, das ohne lokalen Merker gar nichts tut.
// Gemessen: Konto vom Coach angelegt, erster Login → „Erste Schritte / Jetzt einrichten", das Wort
// „Einwilligung" kam im ganzen Bildschirm nicht vor. Sobald der Coach dann Ziel und Kalorien setzte,
// verschwand auch dieser Banner (home.js zeigt ihn nur ohne Plan UND ohne kcal-Ziel) – der erste Check-in
// endete in einem 409 mit einem Toast, der nach 5 Sekunden weg war.
// Deshalb fragt die App jetzt von sich aus, einmal je Anmeldung, sobald die Startseite steht.
function lgConsentMissing(u){
  u=u||ME||{};
  if(!u||u.role!=='athlete')return false;
  // Ältere Serverfassung ohne die Spalte: `pubUser` liefert das Feld dann gar nicht. Wer nicht weiß,
  // ob eine Einwilligung fehlt, fragt nicht danach.
  if(!('consent_health_at' in u))return false;
  if(!u.consent_health_at)return true;
  // Einwilligung liegt vor, aber der Server verlangt eine neuere Fassung (409 `reason:'version'`).
  return !!(LG_CONSENT_REQUIRED&&String(u.consent_version||'')!==LG_CONSENT_REQUIRED);}
// Umgekehrte Frage, für das Onboarding: liegt eine gültige Einwilligung schon vor?
function lgConsentGiven(u){u=u||ME||{};return !!(u.consent_health_at&&!lgConsentMissing(u));}
// Je Konto einmal – wer die Karte schließt, ohne zuzustimmen, bekommt sie in dieser Sitzung nicht
// wieder vorgesetzt (der 409-Weg bleibt). Nach einem Kontowechsel greift sie erneut.
let _lgConsentGateFor=null;
async function lgConsentGate(){
  // Erst die lokal gemerkte Zustimmung nachreichen: sonst fragten wir jemanden, der gestern ohne Netz
  // schon zugestimmt hat, ein zweites Mal.
  try{await lgConsentRetry();}catch(e){}
  if(!ME||ME.role!=='athlete'||COACH_CONTEXT)return;
  if(_lgConsentGateFor===ME.id)return;
  if(!lgConsentMissing(ME))return;
  _lgConsentGateFor=ME.id;
  let tries=0;
  const tick=()=>{
    if(!lgConsentMissing(ME))return;                                   // inzwischen erteilt
    if(lgConsentCanOpen()){try{lgOpenConsentSheet();return;}catch(e){console.error('[consent]',e);}}
    // Startseite baut noch, ein anderes Sheet steht offen, jemand tippt gerade: kurz warten statt
    // dazwischenfunken. Nach rund fünf Sekunden bleibt der Hinweis mit Knopf – er verliert sich nicht.
    if(++tries<6){setTimeout(tick,800);return;}
    toast('Eine Sache fehlt noch: deine Einwilligung.',{label:'Ansehen',fn:()=>{
      if(typeof lgOpenConsentSheet==='function')lgOpenConsentSheet();
      else if(typeof openProfile==='function')openProfile();}});};
  setTimeout(tick,900);}

// ===== ONBOARDING WIZARD =====
let ONB={step:0,data:{experience:'beginner',days_per_week:3}};
function startOnboarding(){
  // Aus der laufenden App gestartet (Home-Banner)? Dann App-Ansicht + Nav ausblenden und später wiederherstellen.
  const fromApp=!document.getElementById('appView').classList.contains('hidden');
  ONB={step:0,fromApp,data:{experience:'beginner',days_per_week:3,gender:'male',disliked:[]}};
  // Wer das Onboarding aus der App noch einmal durchläuft, soll sein Geburtsjahr nicht neu tippen –
  // und es vor allem nicht verlieren: ohne Vorbelegung stünde das Feld leer, und ein Durchlauf ohne
  // Eingabe überschriebe ein vorhandenes `dob` mit NULL.
  if(ME&&typeof ME.dob==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(ME.dob)){ONB.data.dob=ME.dob;ONB.data.age=crAgeFromDob(ME.dob);}
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.add('hidden');
  document.body.classList.remove('has-nav');
  document.getElementById('onbView').classList.remove('hidden');
  _lgOnbLastStep=-1; // jeder Neustart beginnt mit einem Schrittwechsel → Fokus auf die Überschrift
  renderOnb();}
// Onboarding abbrechen (nur wenn aus der App gestartet) -> zurück in die App
function cancelOnboarding(){document.getElementById('onbView').classList.add('hidden');startApp();}
// A-II.4: GENAU EIN zusätzlicher Schritt – „consent", ganz am Ende, nach dem fertigen Plan.
// Bewusst dort und nicht vorher: Wer erst den Plan sieht, weiß, wofür er das Häkchen setzt.
// Der Fortschrittsbalken zählt ihn wie „welcome" und „result" NICHT mit – das Versprechen
// „In 5 kurzen Schritten" bleibt wahr, die fünf Schritte sind die zum Plan.
const ONB_STEPS=[
  {key:'welcome'},
  {key:'goal'},{key:'experience'},{key:'body'},{key:'frequency'},{key:'dislikes'},{key:'result'},
  {key:'consent'}
];
function onbSet(k,v){ONB.data[k]=v;onbNext();}
// ===== GEBURTSJAHR (D1) =====
// Bis 2.4 fragte das Onboarding das ALTER und schickte `age`. Der Server speichert aber nur die Spalte
// `dob` – das Alter war nach dem Abschicken für immer weg, und jede spätere Neuberechnung rechnete mit
// 30 Jahren (RECHEN D1; auf dem Testserver gemessen: Jahrgang 1964, 180 cm, 80 kg, Aufbau →
// 2812 statt 3090 kcal am Trainingstag, also 278 kcal/Tag zu viel). Seit 2.5 fragen wir das Geburtsjahr und
// schicken `dob` als '<jahr>-01-01'; `age` geht weiterhin mit, solange der Server es annimmt.
// Untergrenze 1920 (der älteste plausible Jahrgang), Obergrenze „heute minus 10 Jahre": jünger als 10
// ist kein Fall für eine Trainings-App, und ein vertipptes „2026" fiele sonst durch.
const CR_BIRTH_YEAR_MIN=1920;
function crMaxBirthYear(){return new Date().getFullYear()-10;}
// Alter aus dem Geburtsdatum – GENAU wie der Server es aus `dob` ableitet (`server.js:onboardingInput`),
// damit die Vorschau im letzten Schritt und die spätere Neuberechnung dieselbe Zahl benutzen.
function crAgeFromDob(dob){const t=Date.parse(String(dob||'')+'T00:00:00Z');
  if(isNaN(t))return null;return Math.floor((Date.now()-t)/(365.25*864e5));}
function onbNext(){if(ONB.step<ONB_STEPS.length-1){ONB.step++;renderOnb();}}
function onbBack(){if(ONB.step>0){ONB.step--;renderOnb();}}
// Die grosse Auswahlkarte des Onboardings. Zwei Aenderungen aus A-IV.5, beide messbar:
// (1) Das Farb-Emoji wird ein Symbol aus icon() in einer .ic-tile - dieselbe Ikonografie wie der
//     Rest der App (BUILD-A4 6.5). Der dritte Parameter heisst deshalb `ico`, nicht `emoji`.
// (2) Die Auswahl war eine 2-px-Rotkante und damit der fuenfte "ausgewaehlt"-Dialekt der App
//     (BUILD-A4 6.6). Jetzt .card.sel = Stil B ("weich gewaehlt", app.css) - dieselbe Flaeche und
//     derselbe Ring wie .chip.soft.on und .seg button.on. `aria-pressed` sagt es der Vorlesehilfe,
//     die Kante hat das nie getan.
function bigChoice(k,v,ico,title,desc,cur){const on=cur===v;return `<button type="button" class="card${on?' sel':''}" aria-pressed="${on?'true':'false'}" style="display:block;width:100%;text-align:left;margin-bottom:12px" onclick="onbSet('${k}','${v}')">
  <span class="ic-tile lg">${icon(ico,28)}</span><div style="font-weight:700;font-size:18px;margin-top:10px">${title}</div><div style="color:var(--ink2);font-size:14px;margin-top:2px">${desc}</div></button>`;}

// ===== FOKUS IM ONBOARDING (A-II.4, Nachbesserung) =====
// renderOnb() ersetzt den ganzen Schritt (`v.innerHTML`). Damit stirbt auch das Element, das gerade
// bedient wurde – `document.activeElement` fällt auf <body>, und die Tab-Kette beginnt wieder ganz oben.
// Gemessen mit echten Tastenanschlägen bei „Muskeln aufbauen" (goal), „Anfänger" (experience) und
// „Mann"/„Frau" (body). Am Regler-Schritt war dasselbe schon aufgefallen (onbFreq rendert deshalb gar
// nicht neu, siehe unten), im consent-Schritt schon gelöst (gezielter Fokus auf den Haken). Ab hier
// gilt die Regel für JEDEN Schritt:
//   • Schrittwechsel          → Fokus auf die Überschrift (`#onbTitle`, tabindex="-1"). Das ist der
//     Seitenwechsel-Fall: Screenreader lesen den neuen Titel vor, Tab geht von dort weiter.
//   • Auswahl im selben Schritt → Fokus zurück auf dasselbe Element (gleiche id im neuen HTML).
// `tabindex="-1"` heißt: per Skript fokussierbar, aber NICHT in der Tab-Reihenfolge – die Kette wird
// dadurch nicht länger. Einen Fokusring gibt es nur nach Tastaturbedienung (`:focus-visible`).
let _lgOnbLastStep=-1;
function lgOnbFocus(id){
  // Nach dem Setzen von innerHTML, damit das Ziel sicher im Dokument steht.
  setTimeout(()=>{try{
    const el=(id&&document.getElementById(id))||document.getElementById('onbTitle');
    if(el&&typeof el.focus==='function')el.focus({preventScroll:true});
  }catch(e){}},0);}

// Die Geschlechtswahl rendert den Eckdaten-Schritt komplett neu. Bis jetzt hat sie dabei alles
// weggeworfen, was schon in Geburtsjahr/Größe/Gewicht stand – diese Felder schreiben ihre Werte erst
// in onbBody() nach ONB.data, und renderOnb() füllt sie wieder aus ONB.data. Also vorher sichern.
// Jeder Wert einzeln geprüft: Unsinn wird nicht übernommen, aber auch nichts Vorhandenes überschrieben.
function lgOnbGender(g){
  ONB.data.gender=(g==='female')?'female':'male';
  const y=+val('o_year');
  if(Number.isInteger(y)&&y>=CR_BIRTH_YEAR_MIN&&y<=crMaxBirthYear()){ONB.data.dob=y+'-01-01';ONB.data.age=crAgeFromDob(ONB.data.dob);}
  const hc=+val('o_h');if(hc>0)ONB.data.height_cm=hc;
  const wk=+val('o_w');if(wk>0)ONB.data.start_weight=wk;
  renderOnb();}

async function renderOnb(){const v=document.getElementById('onbView');const s=ONB_STEPS[ONB.step];const d=ONB.data;
  // Wer hatte gerade den Fokus? Nur die id lässt sich merken – das Element selbst überlebt das
  // innerHTML nicht. Ohne id (z. B. ein Knopf ohne) fällt es auf die Überschrift zurück.
  const prevId=(document.activeElement&&document.activeElement.id)||'';
  const stepChanged=_lgOnbLastStep!==ONB.step;_lgOnbLastStep=ONB.step;
  const refocus=()=>lgOnbFocus(stepChanged?'':prevId);
  // Fortschrittsbalken nur über die fünf Inhaltsschritte – Willkommen und Ergebnis sind keine Schritte
  const content=ONB_STEPS.filter(x=>x.key!=='welcome'&&x.key!=='result'&&x.key!=='consent');
  const cIdx=content.findIndex(x=>x.key===s.key);
  const prog=cIdx<0?'':`<div style="display:flex;gap:6px;margin-bottom:24px">${content.map((_,i)=>`<div style="flex:1;height:4px;border-radius:2px;background:${i<=cIdx?'var(--ink)':'var(--surface3)'}"></div>`).join('')}</div>`;
  const backBtn=ONB.step>0&&s.key!=='result'?`<button class="btn sec" style="margin-top:8px" onclick="onbBack()">Zurück</button>`:'';
  let h=`<div style="padding-top:20px">${prog}`;
  if(s.key==='welcome'){
    h+=`<div style="text-align:center"><span class="ic-tile lg">${icon('rocket',28)}</span>
      <h1 id="onbTitle" tabindex="-1" style="font-size:28px;font-weight:700;margin:16px 0 8px">Willkommen, ${esc2(ME.name.split(' ')[0])}!</h1>
      <p style="color:var(--ink2);font-size:16px;line-height:1.5;margin-bottom:28px">In 5 kurzen Schritten erstellen wir deinen persönlichen Trainings- und Ernährungsplan. Dauert keine Minute.</p>
      <button class="btn" onclick="onbNext()">Los geht's</button>
      ${ONB.fromApp?`<button class="btn sec" style="margin-top:10px" onclick="cancelOnboarding()">Abbrechen</button>`:''}</div>`;
  } else if(s.key==='goal'){
    h+=`<h2 id="onbTitle" tabindex="-1" style="font-size:24px;font-weight:700;margin-bottom:6px">Was ist dein Ziel?</h2><p style="color:var(--ink2);margin-bottom:20px">Danach richten wir alles aus.</p>`;
    h+=bigChoice('goal','muscle','dumbbell','Muskeln aufbauen','Masse &amp; Kraft, leichter Kalorienüberschuss',d.goal);
    h+=bigChoice('goal','fatloss','flame','Abnehmen / definieren','Fett verlieren, Muskeln erhalten',d.goal);
    h+=bigChoice('goal','health','heart','Fit &amp; gesund werden','Allgemeine Fitness, Gewicht halten',d.goal);
  } else if(s.key==='experience'){
    h+=`<h2 id="onbTitle" tabindex="-1" style="font-size:24px;font-weight:700;margin-bottom:6px">Wie viel Erfahrung hast du?</h2><p style="color:var(--ink2);margin-bottom:20px">Das bestimmt, wie ausführlich die App dich begleitet.</p>`;
    h+=bigChoice('experience','beginner','sprout','Anfänger','Neu im Training oder Wiedereinstieg',d.experience);
    h+=bigChoice('experience','intermediate','trendUp','Fortgeschritten','Trainiere seit Monaten regelmäßig',d.experience);
    h+=bigChoice('experience','advanced','trophy','Profi','Erfahren, will alle Details &amp; Kontrolle',d.experience);
  } else if(s.key==='body'){
    // Geburtsjahr statt Alter (D1): das Alter veraltet jedes Jahr still, das Geburtsjahr nie.
    const yMax=crMaxBirthYear(),yVal=(typeof d.dob==='string'&&d.dob)?String(d.dob).slice(0,4):'';
    h+=`<h2 id="onbTitle" tabindex="-1" style="font-size:24px;font-weight:700;margin-bottom:6px">Ein paar Eckdaten</h2><p style="color:var(--ink2);margin-bottom:20px">Damit dein Kalorienbedarf stimmt.</p>
      <div class="seg" style="margin-bottom:14px"><button id="g_m" class="${d.gender!=='female'?'on':''}" onclick="lgOnbGender('male')">Mann</button><button id="g_f" class="${d.gender==='female'?'on':''}" onclick="lgOnbGender('female')">Frau</button></div>
      <div id="onbBodyForm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field"><label for="o_year">Geburtsjahr</label><input id="o_year" type="number" inputmode="numeric" autocomplete="bday-year" min="${CR_BIRTH_YEAR_MIN}" max="${yMax}" step="1" value="${esc2(yVal)}" placeholder="1996"></div>
          <div class="field"><label for="o_h">Größe (cm)</label><input id="o_h" type="number" inputmode="numeric" min="50" max="260" value="${d.height_cm||''}" placeholder="180"></div>
        </div>
        <div class="field"><label for="o_w">Aktuelles Gewicht (kg)</label><input id="o_w" type="number" step="0.1" inputmode="decimal" min="0" max="500" value="${d.start_weight||''}" placeholder="80"></div>
      </div>
      <button class="btn" onclick="onbBody()">Weiter</button>`;
  } else if(s.key==='frequency'){
    h+=`<h2 id="onbTitle" tabindex="-1" style="font-size:24px;font-weight:700;margin-bottom:6px">Wie oft willst du trainieren?</h2><p style="color:var(--ink2);margin-bottom:20px">Pro Woche – ehrlich sein bringt die besten Ergebnisse.</p>
      <div style="text-align:center;margin-bottom:8px"><span id="onbFreqNum" style="font-size:52px;font-weight:700;color:var(--ink)">${fmtNum(d.days_per_week)}</span><span style="font-size:20px;color:var(--ink2)"> ×/Woche</span></div>
      <input id="onbFreqRange" class="onb-range" type="range" min="1" max="6" step="1" value="${+d.days_per_week||3}" aria-label="Trainingstage pro Woche" style="--pct:${((+d.days_per_week||3)-1)/5*100}%" oninput="onbFreq(this.value)">
      <p id="onbFreqHint" style="text-align:center;color:var(--ink2);font-size:14px;margin:0 0 24px">${esc2(freqHint(d.days_per_week))}</p>
      <button class="btn" onclick="onbNext()">Weiter</button>`;
  } else if(s.key==='dislikes'){
    const dt=d.diet_type||'all';
    h+=`<h2 id="onbTitle" tabindex="-1" style="font-size:24px;font-weight:700;margin-bottom:6px">Ernährung</h2><p style="color:var(--ink2);margin-bottom:16px">Damit dein Plan und die Rezepte passen. Alles später änderbar.</p>
      <div style="margin-bottom:8px;font-size:14px;font-weight:600">Ernährungsweise</div>
      <div class="chip-row" style="margin-bottom:18px">${[['all','','Alles'],['vegetarian','carrot','Vegetarisch'],['vegan','sprout','Vegan']].map(([v,ic,l])=>`<button type="button" id="onbDiet_${v}" class="daychip ${dt===v?'now':''}" aria-pressed="${dt===v?'true':'false'}" onclick="ONB.data.diet_type='${v}';renderOnb()">${ic?icon(ic,16):''}${l}</button>`).join('')}</div>
      <div style="margin-bottom:8px;font-size:14px;font-weight:600">Was magst du nicht? <span style="font-weight:400;color:var(--ink3)">(optional)</span></div>
      <div id="onbDislikes"><div class="spinner"></div></div>
      <button class="btn" style="margin-top:8px" onclick="onbNext()">Weiter</button>`;
    // Die Ernährungsweise-Chips rendern den ganzen Schritt neu – refocus() setzt den Fokus auf denselben
    // Chip zurück (gleiche id), statt ihn an <body> zu verlieren.
    v.innerHTML=h+(backBtn||'')+'</div>';refocus();loadOnbDislikes();return;
  } else if(s.key==='result'){
    // Der Ergebnisschritt hat beim Rendern noch keine Überschrift – die kommt erst mit dem Plan.
    // Solange fängt der Ergebnisbereich selbst den Fokus auf (tabindex="-1"), damit er nicht auf <body>
    // fällt; loadOnbResult() reicht ihn danach an die fertige Überschrift weiter.
    h+=`<div id="onbResult" tabindex="-1" style="text-align:center"><div class="spinner"></div><p style="color:var(--ink2)">Wir berechnen deinen Plan…</p></div>`;
    v.innerHTML=h+'</div>';lgOnbFocus('onbResult');loadOnbResult();return;
  } else if(s.key==='consent'){
    // backBtn bleibt: wer den Plan noch einmal sehen will, darf zurück – eine Einwilligungsseite
    // ohne Rückweg wäre genau die Sackgasse, die wir im Ergebnisschritt schon einmal repariert haben.
    h+=lgConsentStepHTML()+backBtn;
    v.innerHTML=h+'</div>';
    // Der Haken bekommt den Fokus, nicht der Knopf: wer mit Tastatur oder Screenreader kommt, landet
    // auf dem Element, um das es hier geht. Gibt es keinen Haken (Einwilligung liegt schon vor), fängt
    // die Überschrift den Fokus auf – sonst fiele er auf <body> und die Tab-Kette begänne von vorn.
    setTimeout(()=>{try{(document.getElementById('onbConsentBox')||document.getElementById('onbTitle'))?.focus({preventScroll:true});}catch(e){}},120);
    return;
  }
  h+=backBtn+'</div>';v.innerHTML=h;refocus();}
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
  el.innerHTML=`<div style="display:flex;flex-wrap:wrap">`+opts.map(o=>`<button type="button" class="daychip ${sel.has(o)?'now':''}" aria-pressed="${sel.has(o)?'true':'false'}" style="margin:0 6px 8px 0" onclick="toggleOnbDislike('${esc(o)}',this)">${o}</button>`).join('')+`</div>`;}
function toggleOnbDislike(name,btn){if(!ONB.data.disliked)ONB.data.disliked=[];
  const i=ONB.data.disliked.indexOf(name);
  if(i>=0){ONB.data.disliked.splice(i,1);btn.classList.remove('now');btn.setAttribute('aria-pressed','false');}
  else{ONB.data.disliked.push(name);btn.classList.add('now');btn.setAttribute('aria-pressed','true');}}
// Fehler stehen am Feld, nicht als Toast über den Feldern (WP0-Helfer showFieldErr)
function onbBody(){const y=+val('o_year'),h=+val('o_h'),w=+val('o_w');
  const yMax=crMaxBirthYear();
  if(!y)return showFieldErr('onbBodyForm','Bitte trag dein Geburtsjahr ein.','o_year');
  // Jahreszahlen NIE mit fmtNum ausgeben – daraus würde „1.920"
  if(!Number.isInteger(y)||y<CR_BIRTH_YEAR_MIN||y>yMax)return showFieldErr('onbBodyForm',`Bitte ein Geburtsjahr zwischen ${CR_BIRTH_YEAR_MIN} und ${yMax}.`,'o_year');
  if(!h)return showFieldErr('onbBodyForm','Bitte trag deine Größe ein.','o_h');
  if(!w)return showFieldErr('onbBodyForm','Bitte trag dein aktuelles Gewicht ein.','o_w');
  // `dob` ist der Wert, der beim Server ankommt und bleibt (Spalte `users.dob`). Der Tag ist der 1.1. –
  // wir fragen bewusst nur das Jahr, das reicht für den Kalorienbedarf auf wenige kcal genau.
  // `age` geht weiterhin mit, weil die Vorschau des Servers es heute noch liest.
  ONB.data.dob=y+'-01-01';ONB.data.age=crAgeFromDob(ONB.data.dob);
  ONB.data.height_cm=h;ONB.data.start_weight=w;onbNext();}
async function loadOnbResult(){
  // Beides parallel: die Vorschau und die Frage, ob der Server überhaupt Mails verschicken kann.
  const [r,mailOk]=await Promise.all([API.post('/onboarding/preview',ONB.data),crMailConfigured()]);
  // Der Ergebnisschritt zeigt keinen „Zurück"-Knopf (renderOnb) – ohne einen hier saß der Nutzer im
  // Fehlerfall in einer Sackgasse fest: kein Weg zurück, kein Weg in die App. Der Text sagte „Bitte
  // zurück", und es gab nichts zum Zurückgehen.
  if(r.status!==200){document.getElementById('onbResult').innerHTML=
    `<p style="color:var(--ink2)">${r.status===0?'Keine Verbindung – dein Plan lässt sich gerade nicht berechnen.':'Das hat nicht geklappt. Bitte prüf deine Eingaben.'}</p>
     <button class="btn" style="margin-top:12px" onclick="renderOnb()">Erneut versuchen</button>
     <button class="btn sec" style="margin-top:8px" onclick="onbBack()">Zurück</button>`;
    // Auch der Fehlerfall bekommt den Fokus: #onbResult trägt tabindex="-1" und trägt jetzt den Text.
    lgOnbFocus('onbResult');return;}
  const p=r.data;const n=p.nutrition;
  const goalTxt={muscle:'Muskelaufbau',fatloss:'Definition',health:'Gesundheit'}[ONB.data.goal];
  document.getElementById('onbResult').innerHTML=`
    <span class="ic-tile lg" style="color:var(--green-text)">${icon('checkCircle',28)}</span>
    <h2 id="onbTitle" tabindex="-1" style="font-size:24px;font-weight:700;margin:12px 0 6px">Dein Plan steht!</h2>
    <p style="color:var(--ink2);margin-bottom:6px">Ziel: ${goalTxt}${p.bmi?' · BMI '+fmtNum(p.bmi,1):''}</p>
    ${(ME&&ME.email&&mailOk===true)?`<p class="caption" style="margin-bottom:22px">Bestätigungs-Mail an ${esc2(ME.email)} unterwegs.</p>`:'<div style="height:16px"></div>'}
    <div class="surface pad" style="text-align:left;margin-bottom:14px">
      <div style="font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px">${icon('utensils',18)}Deine Kalorienziele</div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line)"><span style="color:var(--ink2)">Trainingstag</span><b>${fmtNum(n.trainKcal)} kcal</b></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line)"><span style="color:var(--ink2)">Ruhetag</span><b>${fmtNum(n.restKcal)} kcal</b></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--ink2)">Protein / Carbs / Fett</span><b>${fmtNum(n.macros.protein)} / ${fmtNum(n.macros.carbs)} / ${fmtNum(n.macros.fat)} g</b></div>
    </div>
    <div class="surface pad" style="text-align:left;margin-bottom:20px">
      <div style="font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px">${icon('dumbbell',18)}Dein Trainingsplan (${p.plan.length} Tage)</div>
      ${p.plan.map(d=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid var(--line)"><span>${d.name}</span><span style="color:var(--ink2);font-size:13px">${d.exercises.length} Übungen</span></div>`).join('')}
    </div>
    <button class="btn" onclick="onbNext()">Weiter</button>
    <button class="btn sec" style="margin-top:8px" onclick="ONB.step=1;renderOnb()">Etwas ändern</button>`;
  // Der Plan ersetzt den Spinner – der Fokus wandert vom Ergebnisbereich auf die fertige Überschrift.
  lgOnbFocus('');}

// --- Der eine zusätzliche Schritt: drei kurze Karten und EIN Häkchen (A-II.4) ---
// Bewusst kurz gehalten: 59 Wörter, gemessen rund 15 s Lesezeit. Marcos Vorgabe „die Anmeldung darf
// dadurch nicht schlechter werden" ist der Maßstab, nicht die Vollständigkeit – das Vollständige steht
// auf /datenschutz.html, verlinkt direkt darunter.
// KEIN zweites Häkchen, keine vorangekreuzte Box, keine Angstmache. Der KI-Schalter und die
// Hilfe-Freigabe bleiben ausdrücklich AUS und werden hier nicht mitverkauft.
// Symbol statt Farb-Emoji (BUILD-A4 6.5): icon() haengt selbst aria-hidden an das SVG.
function lgConsentCard(ico,title,text){return `<div class="surface pad" style="text-align:left;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start">
  <span class="ic-tile sm">${icon(ico,18)}</span>
  <div><div style="font-weight:600;margin-bottom:2px">${title}</div><div style="color:var(--ink2);font-size:14px;line-height:1.45">${text}</div></div></div>`;}
// Wer die Einwilligung schon erteilt hat (z. B. beim Start gefragt, oder weil er das Onboarding aus der
// App ein zweites Mal durchläuft), bekommt hier KEIN zweites Häkchen vorgesetzt – nur die Bestätigung,
// dass es bereits erledigt ist. „Kein zusätzlicher Tap für alle, die bereits eingewilligt haben."
function lgConsentStepHTML(){
  const given=lgConsentGiven(ME);
  const ask=given
    ? `<div class="note ok mb-3" style="margin:6px 0 12px">Deine Einwilligung liegt schon vor${(ME&&ME.consent_health_at)?` (seit ${esc2(fmtDate(ME.consent_health_at))})`:''} – du musst nichts erneut ankreuzen. Widerrufen kannst du sie jederzeit im Profil.</div>`
    : `<label for="onbConsentBox" style="display:flex;gap:12px;align-items:flex-start;padding:14px 4px;min-height:44px;cursor:pointer">
      <input type="checkbox" id="onbConsentBox" style="width:22px;height:22px;flex:0 0 auto;margin-top:1px" onchange="lgConsentTick()">
      <span style="font-size:15px;line-height:1.4">Ja, meine Gesundheitsdaten und meine Notizen dürfen dafür gespeichert werden.</span>
    </label>`;
  return `<div id="onbConsent">
    <h2 id="onbTitle" tabindex="-1" style="font-size:24px;font-weight:700;margin-bottom:16px">Bevor du loslegst</h2>
    ${lgConsentCard('packageBox','Was wir speichern','Training, Essen, Gewicht, Schlaf, Puls, Maße, Fotos, Mindset – dazu deine Notizen und Nachrichten. Für deinen Plan.')}
    ${lgConsentCard('eye','Wer es sieht','Du und dein Coach. Der Betreiber nur mit deiner Freigabe – und in der Sicherung der Datenbank. Verkauft wird nichts.')}
    ${lgConsentCard('lockOpen','Was du jederzeit kannst','Exportieren, widerrufen, alles löschen – im Profil.')}
    ${ask}
    <div id="onbConsentErr" class="hidden" style="color:var(--red-text);font-size:13px;margin:0 4px 10px" role="alert"></div>
    <button class="btn" onclick="lgConsentGo()">Loslegen</button>
    ${lgLegalLinksHTML({style:'margin-top:6px'})}
  </div>`;}
// Ein Klick auf den Haken räumt eine eventuelle Meldung weg – niemand soll gemaßregelt dastehen,
// nachdem er getan hat, worum er gebeten wurde.
function lgConsentTick(){document.getElementById('onbConsentErr')?.classList.add('hidden');}
// „Loslegen" ist NICHT gesperrt: ein toter Knopf sagt nicht, was fehlt. Fehlt der Haken, sagt es der
// Satz darunter – und der Haken bekommt den Fokus.
function lgConsentGo(){
  const box=document.getElementById('onbConsentBox');
  // Kein Haken im Bildschirm = die Einwilligung liegt schon vor (siehe lgConsentStepHTML) -> durchwinken.
  if(!box&&lgConsentGiven(ME))return finishOnboarding();
  if(!box||!box.checked){const e=document.getElementById('onbConsentErr');
    if(e){e.textContent='Ohne dieses Häkchen dürfen wir keine Werte speichern – dann bleibt die App leer.';e.classList.remove('hidden');}
    try{box?.focus({preventScroll:true});}catch(err){}
    return;}
  finishOnboarding();}

async function finishOnboarding(){
  // Erst die Einwilligung, dann der Plan: Routen, die Gesundheitsdaten entgegennehmen, antworten ohne
  // sie mit 409 (A-II.2). Schlägt der Versand fehl (älterer Server, kein Netz), merkt sich lgConsentSend
  // die Zustimmung lokal und der Start läuft trotzdem weiter – ein neues Konto darf an dieser Stelle
  // nicht hängenbleiben. Liegt die Einwilligung bereits vor (beim Start erteilt, zweiter Durchlauf aus
  // der App), schicken wir sie NICHT noch einmal: das wäre ein Protokolleintrag ohne Anlass.
  if(!lgConsentGiven(ME))try{await lgConsentSend();}catch(e){}
  const r=await API.post('/onboarding/complete',ONB.data);
  if(r.status!==200)return toast('Fehler beim Speichern');
  // ME aktualisieren
  const me=await API.get('/me');ME=me.data.user;
  document.getElementById('onbView').classList.add('hidden');
  startApp();toast('Willkommen an Bord! 🎉');}

// ===== NACH DEM START (Präfix rp · A-V.5) =====
// Drei Anfragen lagen bis 2.9.0 im KALTEN Start, ohne dass das erste Bild sie braucht: die
// Versionsprüfung (ein Hinweis, kein Startschritt), das Profilbild im Kopf (Zierde) und der
// Lebensmittel-Katalog (gehört dem Ernährungs-Reiter). Gemessen waren das vier der vierzehn
// Anfragen – das Profilbild zählt zweimal, einmal der Abruf und einmal das Bild selbst.
// rpLater() schiebt eine Aufgabe hinter die erste vollständige Seite: erst wenn der Browser Luft hat
// (requestIdleCallback), frühestens aber nach `min` Millisekunden. Das Idle-Fenster allein reicht
// nicht – es öffnet sich auf einem schnellen Rechner oft schon 50 ms nach dem ersten Bild, und dann
// stünde die Anfrage wieder mitten im Start. 2500 ms ist die Grenze, ab der auf einem gedrosselten
// Netz (Slow-4G: 1,6 Mbit/s, 150 ms RTT) auch die letzte Startanfrage durch ist; vorher wäre
// „später" nur ein anderes Wort für „gleichzeitig".
function rpLater(fn,min){
  const wait=Math.max(0,+min||2500);
  setTimeout(()=>{
    // requestIdleCallback gibt es auf iOS-Safari nicht – dort läuft die Aufgabe direkt.
    try{if(typeof requestIdleCallback==='function'){requestIdleCallback(()=>{try{fn();}catch(e){console.error('[rpLater]',e);}},{timeout:2000});return;}}catch(e){}
    try{fn();}catch(e){console.error('[rpLater]',e);}
  },wait);}
// Das Profilbild im Kopf: die Initiale steht SOFORT, das Bild kommt, wenn die App steht.
// applyAvatar() (training.js) fragt /api/avatar/<id> ab und setzt das Ergebnis als Hintergrundbild –
// zwei Anfragen, bevor die erste Trainingszeile auf dem Schirm war. Die Initiale ist kein Platzhalter
// für nichts: sie ist die Anzeige, die jedes Konto ohne Bild dauerhaft hat.
// applyAvatar() selbst bleibt unverändert – account.js ruft es nach dem Hochladen auf und muss dort
// sofort zeichnen.
// Das Technik-Lexikon (/api/definitions): 5,7 KB gepackt und damit nach app.js, app.css und
// icon-192 der viertgrößte Posten des kalten Starts – für Inhalte, die ausschließlich im
// Trainings-Reiter stehen (Technik-Karte einer Grundübung, Technik-Auswahl im Übungsformular,
// Lexikon-Sheet). Die Startseite zeigt keinen einzigen Eintrag davon.
// Einmal je Seitenladen, egal wer zuerst fragt: rpLater() nach dem Start oder der Trainings-Reiter
// (_trEnsureDefs in training.js), wenn jemand schneller dort ist. Schlägt der Abruf fehl, darf der
// nächste Aufrufer es erneut versuchen – deshalb wird die Zusage im Fehlerfall verworfen.
function rpLoadDefs(){
  if(DEFS&&DEFS.length)return Promise.resolve(DEFS);
  if(!rpLoadDefs._p)rpLoadDefs._p=fetch('/api/definitions').then(r=>r.json())
    .then(d=>{DEFS=d.definitions||[];return DEFS;})
    // ohne Netz wirft fetch – kein Grund für einen Fehler-Toast, das Lexikon ist Beiwerk
    .catch(()=>{rpLoadDefs._p=null;return DEFS||[];});
  return rpLoadDefs._p;}
function rpAvatarBoot(){
  try{const el=document.getElementById('avatar');
    if(el&&ME){el.style.backgroundImage='';el.textContent=(ME.name||'?').charAt(0).toUpperCase();}}catch(e){}
  // B2 (3.0.1): applyAvatar() wohnt in training.js, und training.js ist seit diesem Stand nachgeladen.
  // Ohne die Zeile unten waere das Profilbild im Kopf ein Zufall: mal da (Datei schon im Cache), mal
  // nicht (erster Start), und im zweiten Fall stuende ein ReferenceError im Protokoll. Also: wenn die
  // Funktion da ist, sofort - sonst das Modul anstossen und danach zeichnen. Kein eigener Abruf, kein
  // frueheres Nachladen: rpLater() feuert ohnehin erst, wenn die Startseite steht.
  if(!(ME&&ME.has_avatar))return;
  rpLater(()=>{
    const mal=()=>{try{applyAvatar();}catch(e){console.error('[avatar]',e);}};
    if(typeof applyAvatar==='function')return mal();
    if(window.bootLoad)window.bootLoad('training').then(ok=>{if(ok)mal();});
  });}

// ===== START =====
async function startApp(){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('onbView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.body.classList.add('has-nav');
  // Der Service Worker ist bereits beim Laden von core.js registriert (siehe oben) – damit die Hülle
  // auch vor dem ersten Login im Cache liegt. Hier nur noch die Kopfzeile bestücken.
  try{const sb=document.getElementById('searchBtn');if(sb&&!sb.innerHTML.trim())sb.innerHTML=icon('search',22);}catch(e){}
  // Sofort nachtragen statt erst nach 30 Sekunden: wer die App morgens kurz öffnet und wieder
  // schließt, hat weder ein „online"-Ereignis noch einen Sichtbarkeitswechsel – die Einträge von
  // gestern Abend lägen sonst Tag für Tag weiter herum.
  // Vor dem ersten Nachtragen die Altlasten ohne Besitzer übernehmen – sonst bleiben sie für immer
  // unsichtbar und unzustellbar liegen (siehe outboxAdoptOrphans).
  outboxAdoptOrphans();
  syncBadge();flushOutbox();
  // A-II.4: eine Einwilligung, die beim Abschicken nicht durchkam (kein Netz, Server ohne Route),
  // still nachreichen – und, wenn danach immer noch keine vorliegt, EINMAL danach fragen. Das ist die
  // Tür für alle Konten, die nie durch die Registrierung kamen (Coach-/Admin-Konten, Bestand vor 2.6.0).
  // Läuft absichtlich ohne await: der Start darf nicht auf eine Netzantwort warten.
  try{lgConsentGate();}catch(e){}
  invalidateView();CUR_TAB=null;
  rpAvatarBoot();
  setTimeout(checkPendingShare,700); // wartender Teilen-Link? -> Übernehmen-Dialog
  // Die Home-Tour startet jetzt am Ende von renderHome (kein Timer mehr, nie über dem Spinner)
  setTimeout(maybeShowInstallHint,1600); // iOS: Hinweis „Zum Home-Bildschirm" (einmalig, schlanke Notiz unter dem Header)
  // Der Lebensmittel-Katalog gehört dem Ernährungs-Reiter, nicht dem Start: drawTrack() zieht ihn über
  // _dietEnsureFoods() nach, das Hinzufügen-Sheet und die Suche haben je einen eigenen Nachlader.
  // Bis 2.9.0 stand er im kalten Start und kostete dort eine von vierzehn Anfragen, obwohl das erste
  // Bild (Startseite) kein einziges Lebensmittel zeigt.
  rpLater(()=>{if(!FOODS.length)API.get('/foods').then(r=>{if(!FOODS.length)FOODS=r.data?.foods||[];}).catch(()=>{});});
  rpLater(()=>{rpLoadDefs();});
  COACH_CONTEXT=null;
  // Neue Version deployt? (Frontend gecacht) -> Aktions-Toast statt stummem Auseinanderlaufen.
  // Dieselbe Antwort, die shell.js beim Laden schon angefordert hat – keine zweite Anfrage.
  checkVersion().then(v=>{if(v.mismatch)toast('Neue Version verfügbar',{label:'Neu laden',fn:()=>location.reload()});});
  // Kein `await loadMessages()` mehr vor dem ersten Bild: das lud 50 Nachrichten samt Volltext (58 KB) nur
  // für den Glocken-Zähler und hielt die Startkette einen vollen Round-Trip auf. Die Startseite liefert
  // `unread` im Aggregat mit; wer per Kurzweg/Deep-Link woanders landet, holt nur den Zähler (loadUnread).
  startMsgPolling();
  buildNav();
  if(ME.role==='admin'){go('admin');loadUnread();}
  else if(ME.role==='coach'){VIEW_USER=null;go('athletes');loadUnread();}
  else{VIEW_USER=ME.id;
    // Plan PARALLEL zur Startseite statt davor: loadPlan merkt sich den laufenden Aufruf, loadHomeData
    // (home.js) und renderWorkout hängen sich daran, statt ein zweites Mal zu fragen. Vorher warteten
    // /plan und /home nacheinander – ein Round-Trip mehr, bis die Startseite stand.
    loadPlan().then(()=>{try{snapState();}catch(e){}}).catch(e=>console.error('[plan]',e));
    if(!applyHashRoute())go('home');else loadUnread();}
}
// Genau EIN Abgleich mit dem Server je Seitenladen: shell.js (Zeile unter dem Anmeldeformular) und
// startApp (Aktions-Toast) hängen sich an dieselbe Antwort. Bis 2.3 liefen zwei Anfragen, die erste davon
// blockierend VOR /api/me – die Versionsprüfung ist ein Hinweis, kein Startschritt.
// 2.9.0: die Abfrage läuft nicht mehr im Startpfad, sondern hinter der ersten vollständigen Seite
// (rpLater). Sie ist ein Hinweis – der Kommentar darüber sagt das seit 2.3 – und hat als solcher
// nichts vor der ersten Trainingszeile zu suchen; gemessen war sie eine von vierzehn Anfragen im
// kalten Start. Beide Aufrufer (shell.js beim Laden, startApp) hängen unverändert an derselben
// Zusage; sie wird nur ein paar Sekunden später eingelöst. Kein Aufrufer wartet darauf.
function checkVersion(){
  if(!checkVersion._p)checkVersion._p=new Promise(resolve=>{
    rpLater(()=>{API.get('/version').then(vr=>{
      const server=(vr.status===200&&vr.data&&vr.data.version)?String(vr.data.version):'';
      resolve({server,mismatch:!!(server&&server!==APP_VERSION)});}).catch(()=>resolve({server:'',mismatch:false}));});});
  return checkVersion._p;}
// Deep-Links aus Push-Mitteilungen: #mindset, #mindset/wheel, #mindset/challenge, #tracker/woche
// (Sonntags-Push „Deine Woche") sowie die PWA-Kurzwege ?go=workout|food|priming aus manifest.json
// (die Tab-Namen home|workout|diet|mindset|tracker gehen als ?go= UND als #-Ziel, ältere Kurzwege
// bleiben gültig).
// Alles nur im eigenen Athleten-Konto. Ziel wird nach dem Sprung aus der Adresse entfernt, damit ein
// Neuladen wieder auf der Home landet und der Kurzweg nicht ein zweites Mal feuert.
function applyHashRoute(){
  if(!ME||ME.role!=='athlete'||COACH_CONTEXT)return false;
  const h=location.hash||'';
  // keepQuery: nur der Kurzweg räumt die Suchparameter weg – ?verified=1 & Co. gehören nicht uns
  const clean=keepQuery=>{try{history.replaceState(null,'',location.pathname+(keepQuery?location.search:''));}catch(e){}};
  if(h.startsWith('#tracker')){const p=h.split('/');const seg=(p[1]||'').replace(/[^a-z]/gi,'')||'woche';
    if(typeof renderTracker==='function')renderTracker.tab=seg;
    // Dritter Abschnitt = Montag der gemeinten Woche: '#tracker/woche/2026-09-07'. Der Sonntags-Push
    // spricht über die zu Ende gehende Woche; ohne Datum stünde ab Mitternacht die neue, leere Woche
    // auf dem Bildschirm, während die Nachricht Rekorde und Tonnage der Vorwoche nennt.
    // Ohne Datum bleibt alles wie bisher (laufende Woche) – alte Push-Nachrichten funktionieren weiter.
    const d=String(p[2]||'').slice(0,10);
    if(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)){
      if(typeof renderTracker==='function')renderTracker.tab='woche';
      // NICHT ANA_WEEK_START setzen, sondern einen eigenen „kam per Link"-Merker: analysis.js kann
      // sonst nicht unterscheiden, ob der Wochenstart vom Nutzer (Blättern) oder aus der Nachricht
      // stammt – beim zweiten Tipp auf dieselbe Mitteilung landete man deshalb wieder in der
      // laufenden, leeren Woche. Der Merker wird beim Zeichnen genau einmal verbraucht.
      try{window.ANA_WEEK_LINK=d;}catch(e){}
      try{ANA_WEEK_LINK=d;}catch(e){}
      // Steht der Nutzer schon auf diesem Segment, kommt go() nicht mehr am Zeichner vorbei –
      // dann hier ausdrücklich neu zeichnen, sonst bliebe der Link beim zweiten Tipp wirkungslos.
      if(CUR_TAB==='tracker'&&typeof anaTab==='function')setTimeout(()=>{try{anaTab('woche',{refresh:true});}catch(e){}},0);
    }
    clean(true);go('tracker');return true;}
  if(h.startsWith('#mindset')&&typeof renderMindset==='function'){
    const sub=(h.split('/')[1]||'heute').replace(/[^a-z]/gi,'');
    renderMindset.tab=sub||'heute';
    clean(true);go('mindset');return true;}
  // Ein Tab-Name als HASH ist derselbe Kurzweg wie ?go=<Tab>. Bis 2.9.0 prüfte die Liste unten nur
  // ?go=, während der Kommentar über dieser Funktion behauptete, die Tab-Namen gingen „weiterhin":
  // gemessen landeten /#workout, /#diet und /#home still auf der Startseite, und aus der laufenden App
  // heraus tat ein Klick auf einen solchen Link gar nichts (der hashchange-Zweig unten fiel durch).
  // #tracker und #mindset haben eigene Zweige darüber – sie tragen Unterziele und kommen nie hierher.
  // clean(true) wie in jenen Zweigen: die Suchparameter gehören nicht uns, der Hash schon.
  const hg=(((location.hash||'').slice(1).split('/')[0])||'').replace(/[^a-z]/gi,'').toLowerCase();
  if({home:1,workout:1,diet:1}[hg]){clean(true);go(hg);return true;}
  let g='';try{g=(new URLSearchParams(location.search)).get('go')||'';}catch(e){}
  if({home:1,workout:1,diet:1,mindset:1,tracker:1}[g]){clean(false);go(g);return true;}
  // Kurzwege, die eine HANDLUNG versprechen („Essen loggen", „Priming"): erst der Tab, dann das Sheet –
  // vorher landete der Nutzer nur auf dem Tab und brauchte genau den Tipp, den der Kurzweg sparen sollte.
  // Die Zielfunktionen leben in diet.js/mindset.js und brauchen ME/VIEW_USER; nach einem Kaltstart läuft
  // das erst kurz nach go(), deshalb typeof-geprüft und mit kurzer Verzögerung. Nur, wenn der Nutzer bis
  // dahin nicht selbst weitergetippt hat (Tab noch derselbe).
  const ACTIONS={food:['diet',()=>{if(typeof openLogFood==='function')openLogFood({focus:true});}],
                 priming:['mindset',()=>{if(typeof openPriming==='function')openPriming();}]};
  if(ACTIONS[g]){const [tab,act]=ACTIONS[g];clean(false);go(tab);
    setTimeout(()=>{if(ME&&CUR_TAB===tab&&!(typeof sheetOpen==='function'&&sheetOpen()))try{act();}catch(e){console.error('[go]',g,e);}},450);return true;}
  return false;}
window.addEventListener('hashchange',()=>{if(ME&&document.getElementById('appView')&&!document.getElementById('appView').classList.contains('hidden'))applyHashRoute();});
// Wenn ein Coach gerade einen Athleten "betreten" hat, steht hier dessen Name
let COACH_CONTEXT=null;
let VIEW_USER_PROFILE=null; // Profil des aktuell betrachteten Nutzers (für Coach-Kontext)
// Nav-Varianten (WP1): Athlet 5 Tabs · Coach: Athleten/Nachrichten/Vorlagen · Admin: Verwaltung/Athleten ·
// Coach/Admin im Athleten-Kontext: die 5 Athleten-Tabs mit identischen Labels (Verlassen über die Kontextleiste).
// Ein Reiter ist „aktuell" in zwei Sprachen: `class="on"` fürs Auge, `aria-current="page"` fürs Ohr.
// `false` statt Entfernen wäre falsch – der Standard kennt nur „false" als Wert, und VoiceOver liest
// ihn nicht als „nicht aktuell", sondern gar nicht. Deshalb wird das Attribut weggenommen.
function _navMark(b,on){if(!b)return;b.classList.toggle('on',!!on);
  if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
function buildNav(){const nav=document.getElementById('navBar');if(!nav||!ME)return;
  let items;
  // G2 (DESIGN-4 3.1): Reiterbeschriftung = grosser Titel = kompakter Titel. Der erste Reiter hiess
  // „Home" und trug damit als einziger einen anderen Namen als sein Titel. Er heisst jetzt „Heute" –
  // dasselbe Wort wie in TITLES und wie im grossen Titel der Seite. Der Routenname (`home`) bleibt:
  // er steht in Deep-Links, PWA-Kurzwegen und im Ansichts-Cache und ist keine Beschriftung.
  const athleteTabs=[['home','home','Heute'],['workout','dumbbell','Training'],['diet','utensils','Ernährung'],['mindset','brain','Mindset'],['tracker','chartLine','Analyse']];
  if(ME.role!=='athlete'&&COACH_CONTEXT)items=athleteTabs;
  else if(ME.role==='admin')items=[['admin','settings','Verwaltung'],['athletes','users','Athleten']];
  else if(ME.role==='coach')items=[['athletes','users','Athleten'],['messages','mail','Nachrichten'],['templates','fileSpreadsheet','Vorlagen']];
  else items=athleteTabs;
  nav.innerHTML=items.map(([p,ic,l])=>`<button class="navbtn" data-p="${p}" aria-label="${l}" onclick="go('${p}')">${icon(ic,24)}<div class="nl">${l}</div></button>`).join('');
  // A-V.5 (DEFER-A1, N12-Rest): die Landmarken stehen seit 2.6.0 in index.html, `aria-current` fehlte.
  // Ohne es sagt ein Screenreader nur „Home, Schalter" – welcher Reiter GERADE offen ist, verrät allein
  // die Farbe. Gesetzt wird es an derselben Stelle wie die Klasse `on`, damit es nie auseinanderläuft.
  const cur=CUR_TAB;if(cur)nav.querySelectorAll('.navbtn').forEach(b=>_navMark(b,b.dataset.p===cur));
  // Weniger als zwei Ziele -> Leiste ausblenden (kein Platzhalter, kein Abstand unten)
  document.body.classList.toggle('no-nav',items.length<2);document.body.classList.toggle('has-nav',items.length>=2);}

// ===== ROUTER + ANSICHTS-CACHE (stale-while-revalidate) =====
const TITLES={home:'Heute',workout:'Training',diet:'Ernährung',mindset:'Mindset',tracker:'Analyse',athletes:'Athleten',admin:'Verwaltung',messages:'Nachrichten',templates:'Vorlagen'};
// ===== DER GROSSE TITEL, TEIL 1: DER TEXT (DESIGN-4 3.2) =====
// Teil 2 (Einsetzen, Schrumpfen beim Scrollen) steht in shell.js bei mountLargeTitle().
// Hier steht nur, WIE der Titel und seine Unterzeile heissen – das ist Sache des Routers, weil
// TITLES und CUR_TAB hier wohnen.
// Die Unterzeile traegt KONTEXT (Datum, Zeitraum, Elternobjekt), nie eine Aktion (3.2).
// In dieser Welle bleibt sie fuer die REITER leer, und zwar gemessen begruendet:
//   · Der Kontext, den DESIGN-4 6.1/6.2/6.9 dort vorsieht (Datum, Trainingstag, Zeitraum), steht
//     heute schon auf jeder dieser Seiten – auf `home` als „Guten Abend, Marco · Mi., 16.9." in
//     .today .eyebrow, im Training als Tages-Chips, in der Analyse als Zeitraum-Chips. Eine zweite
//     Kopie 20 px darueber waere genau die Verdopplung, gegen die diese Ueberarbeitung antritt
//     (jedes Thema dreimal auf einem Bildschirm, S#3/P5).
//   · Sie kostet gemessene 24 px Seitenhoehe. Auf `home` ist die Hoehe ein Abnahmekriterium
//     (< 1.000 px, DESIGN-4 9.4) – 24 px fuer eine Doppelung auszugeben, waere das schlechteste
//     Geschaeft dieser Welle.
// Die Unterzeilen kommen in Welle 4/5 zusammen mit dem Umbau der Ansichten, der die alten Kopien
// entfernt. Push-Seiten (3.3) geben ihre Unterzeile dagegen jetzt schon selbst mit – dort gibt es
// keine Kopie, die man erst wegraeumen muesste.
function lgTitleText(tab){return TITLES[tab]||'';}
function lgTitleSub(tab){return '';}
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
  // …und eine Push-Ebene auch nicht (DESIGN-4 3.3 N2): ein Reiterwechsel räumt den Stapel ab.
  // Die Reiterleiste bleibt über der Push-Seite sichtbar und bedienbar – genau deshalb MUSS ein
  // Tipp darauf hier landen und nicht hinter der offenen Ebene verpuffen.
  if(typeof closeAllPages==='function')closeAllPages();
  // …und eine laufende Coachmark-Tour auch nicht: ihr Overlay liegt über allem und zeigt auf Elemente,
  // die es auf dem neuen Tab nicht mehr gibt (endTour räumt Overlay, Scroll-Sperre und Resize-Handler auf).
  if(typeof endTour==='function'&&document.getElementById('tourOv'))endTour();
  // Coach/Admin verlässt den Athleten-Kontext (Kontextleiste „Verlassen" oder Tab „Athleten")
  if((p==='athletes'||p==='admin'||p==='messages'||p==='templates')&&ME&&ME.role!=='athlete'&&COACH_CONTEXT){COACH_CONTEXT=null;VIEW_USER=null;VIEW_USER_PROFILE=null;PLAN=null;TODAY=null;invalidateView();buildNav();}
  const v=document.getElementById('views');if(!v)return;
  // A-III.1: Neue Ansicht = neue Rechnung für den Stand-Chip. Die Zahlen werden gleich frisch geholt;
  // bleibt es beim alten Stand, setzt der erste stale-Treffer den Chip im selben Atemzug wieder.
  // Ausnahme `keepStale`: offRefreshActive() zeichnet dieselbe Ansicht nach dem Wiederverbinden neu.
  // Dort darf der Chip nicht vorab fallen – er soll fallen, WENN die frischen Zahlen ankommen.
  if(!opts.keepStale&&typeof offFresh==='function')offFresh();
  const same=CUR_TAB===p;
  if(CUR_TAB&&!same)_snapshotView(CUR_TAB); // verlassene Ansicht für die Rückkehr merken
  CUR_TAB=p;
  document.querySelectorAll('.navbtn').forEach(b=>_navMark(b,b.dataset.p===p));
  // G1 (DESIGN-4 3.2): Der Kopf trägt den Namen des Bildschirms, NIE den App-Namen. Bis hierher stand
  // auf der Startseite die Wortmarke „BE INEVITABLE" – der einzige Bildschirm der App ohne Ortsangabe
  // (Beleg A8). Die Wortmarke ist nicht verschwunden: sie steht auf der Anmeldeseite (index.html
  // #loginView), im Startbildschirm-Symbol und im Profilkopf. Sie hört nur auf, die Ortsangabe zu
  // blockieren. `textContent` statt `innerHTML`: der Titel ist ab jetzt reiner Text.
  const ht=document.getElementById('hdrTitle');
  if(ht)ht.textContent=lgTitleText(p);
  mountCtxBar();
  const c=VIEW_CACHE[p];
  if(_cacheValid(c)){v.innerHTML=c.html;window.scrollTo(0,same?0:(c.scrollY||0));opts.cached=true;}
  else{window.scrollTo(0,0);opts.cached=false;}
  // Der grosse Titel wird SOFORT gesetzt – vor dem Zeichner. Sonst steht auf einer Seite, die noch
  // ein Skelett zeigt, kein Titel, und genau das ist der Augenblick, in dem man wissen will, wo man
  // ist. Der Zeichner ersetzt das Markup gleich darauf; der Beobachter in shell.js setzt den Titel
  // dann wieder ein (siehe _lgObserve).
  if(typeof mountLargeTitle==='function')mountLargeTitle();
  const r=_renderer(p);if(!r)return;
  try{const out=r(v,opts);
    if(typeof mountLargeTitle==='function')mountLargeTitle();
    if(out&&typeof out.catch==='function')out.catch(e=>console.error('[go]',p,e));return out;}catch(e){console.error('[go]',p,e);}}
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
  if(ME&&ME.role!=='athlete'&&typeof openBroadcast==='function')h+=`<button class="btn block mb-4" onclick="openBroadcast()">${icon('send',18)} Nachricht an alle Athleten</button>`;
  if(!msgs.length)h+=emptyState({icon:'mail',title:'Keine Nachrichten',text:'Antworten deiner Athleten und Systemhinweise erscheinen hier.'});
  else h+='<div class="rows">'+msgs.map(m=>`<div class="row tap" role="button" tabindex="0" onclick="openMessages()"><div class="r-ic">${icon(m.kind==='system'?'info':'mail',22)}</div><div class="rl"><span class="truncate">${esc2(m.title||'Nachricht')}</span><small>${esc2(m.from_name||(m.kind==='system'?'System':''))}${m.from_name?' · ':''}${rel(m.created_at)}</small></div><div class="rr">${m.read?'':'<span class="pill red">Neu</span>'}</div></div>`).join('')+'</div>';
  h+='</div>';v.innerHTML=h;cacheView('messages');}
// Fallback-Tab „Vorlagen" (Coach): Einstieg in das bestehende Vorlagen-Sheet
function _renderTemplatesFallback(v,opts){opts=opts||{};
  const has=typeof openTemplates==='function';
  v.innerHTML=`<div class="page on${opts.cached?'':' first'}">${emptyState({icon:'fileSpreadsheet',title:'Plan-Vorlagen',text:'Gespeicherte Trainingspläne, die du jedem Athleten mit einem Tipp zuweisen kannst.',btn:has?{label:'Vorlagen öffnen',onclick:'openTemplates()'}:null})}</div>`;
  cacheView('templates');}

// ===== DATA LOADERS =====
// Plan und Tag werden bei jedem erfolgreichen Laden mitgeschrieben und beim Start ohne Netz (status 0)
// aus dem Schnappschuss geholt. Nur dann – eine Server-Ablehnung (4xx) darf keinen alten Stand zurückholen.
// Läuft für denselben Nutzer schon ein Aufruf, hängen sich weitere daran (eine Anfrage, ein Ergebnis) –
// beim Start fragen startApp und loadHomeData/renderWorkout sonst zweimal hintereinander nach dem Plan.
// Nach der Antwort ist der Merker weg: ein Aufruf NACH einer Änderung (Tag umbenennen …) holt wieder frisch.
async function loadPlan(){const uid=VIEW_USER;
  if(loadPlan._p&&loadPlan._uid===uid)return loadPlan._p;
  const p=(async()=>{const r=await API.get('/plan/'+uid);
    if(r.status===200){PLAN=r.data;if(snapAllowed())snapSave('be_plan_'+uid,PLAN);}
    else if(r.status===0&&!PLAN){const s=snapLoad('be_plan_'+uid);if(s&&s.days)PLAN=s;}
    if(PLAN&&PLAN.days&&PLAN.days.length&&!PLAN.days.find(d=>d.id===CUR_DAY))CUR_DAY=PLAN.days[0].id;})();
  loadPlan._p=p;loadPlan._uid=uid;
  try{return await p;}finally{if(loadPlan._p===p)loadPlan._p=null;}}
async function loadToday(){const r=await API.get('/today/'+VIEW_USER);
  if(r.status===200){TODAY=r.data;if(snapAllowed())snapSave('be_today_'+VIEW_USER+'_'+today(),TODAY);}
  else if(r.status===0&&!TODAY){const s=snapLoad('be_today_'+VIEW_USER+'_'+today());if(s)TODAY=s;}}
// Glocken-Badge = NUR ungelesene Nachrichten (System-Hinweise zählen nicht mehr mit – sie leben im Nachrichten-Sheet/Profil)
// Ohne angemeldetes Konto gibt es nichts zu holen. Der Zweig ist kein Schönheitsfehler: beim
// Rollenwechsel (abmelden, anmelden) kann ein nachgereichter Zeichner noch aus dem alten Dokument
// feuern, während ME schon null ist – gemessen einmal als „[go] messages TypeError … reading 'id'
// of null". loadUnread() daneben hat denselben Wächter seit jeher.
async function loadMessages(){if(!ME)return [];
  const r=await API.get('/messages/'+ME.id);const m=r.data?.messages||[];
  // Kein Netz / keine Antwort: den Zähler stehen lassen, sonst verschwände die Glocke bei jedem Aussetzer.
  if(r.status===200)setBellBadge(m.filter(x=>!x.read).length);
  return m;}
function setBellBadge(n){UNREAD=Math.max(0,+n||0);
  const b=document.getElementById('bellBadge');
  if(b){b.textContent=UNREAD>9?'9+':UNREAD;b.classList.toggle('hidden',UNREAD===0);}}
// Nur den ZÄHLER holen, nicht die Texte. Der Poll lud bis 2.3 alle 30 s die 50 letzten Nachrichten samt
// Volltext (gemessen 58 KB je Abruf, rund 7 MB je Stunde offener App) und behielt davon eine Zahl.
// GET /messages/:uid/unread liefert die Zahl allein (~20 B). Kennt der Server die Route nicht (404, älterer
// Stand), bleibt es beim alten Weg – das wird einmal erkannt und nicht bei jedem Poll erneut probiert.
// Bei kein Netz / Sitzung weg / Serverfehler: nichts umstellen und nichts nachladen (vorübergehend).
async function loadUnread(){if(!ME)return UNREAD;
  if(!loadUnread.legacy){const r=await API.get('/messages/'+ME.id+'/unread');
    if(r.status===200&&r.data&&typeof r.data.unread==='number'){setBellBadge(r.data.unread);return UNREAD;}
    if(r.status!==404)return UNREAD;
    loadUnread.legacy=true;}
  await loadMessages();return UNREAD;}
// Offene System-Hinweise (E-Mail bestätigen, Health-Import) – Datenquelle für das Nachrichten-Sheet und das Profil (WP6)
function pendingNotifications(){const out=[];if(!ME)return out;
  if(ME.role==='athlete'||ME.id===VIEW_USER){
    if(ME.email && !ME.email_verified) out.push({type:'verify'});
    if(ME.health_reminder){const li=ME.last_health_import?Date.parse(ME.last_health_import):0;const days=li?Math.floor((Date.now()-li)/864e5):999;if(days>=7)out.push({type:'health',days,li});}
  }
  return out;}
// Regelmäßig auf neue Nachrichten prüfen, damit Coach-Nachrichten zeitnah auftauchen. Alle 60 s statt 30 s
// und NUR bei sichtbarer App: im Hintergrund zählt niemand die Glocke, und eine neue Nachricht kommt ohnehin
// als Push. Beim Zurückkehren in den Vordergrund holt visibilitychange den Zähler nach.
const MSG_POLL_MS=60000;
let msgPoll=null;
// …und im selben Takt die Outbox leeren – solange sie leer ist, kostet flushOutbox() nur einen localStorage-Blick.
// Das Nachtragen läuft auch im Hintergrund weiter: Daten sollen raus, sobald Netz da ist.
// A-III.1: …und als letztes Netz unter dem Netz. Feuert ein Browser das `online`-Ereignis nicht (iOS im
// Standby, wechselnde WLANs), stünde der alte Stand sonst bis zur nächsten Nutzeraktion da. offRefreshActive()
// bremst sich selbst: ohne angezeigten Altstand kostet der Aufruf einen Vergleich.
function startMsgPolling(){clearInterval(msgPoll);msgPoll=setInterval(()=>{if(!ME)return;flushOutbox();
  if(document.visibilityState!=='hidden'){loadUnread();offRefreshActive();}},MSG_POLL_MS);}
// App kommt aus dem Hintergrund: war sie > 5 Min. weg, gelten alle gecachten Ansichten als veraltet
// (die aktive Home frischt sich über refreshHomeIfActive in place auf – ohne den DOM zu leeren)
let _hiddenAt=0;
document.addEventListener('visibilitychange',()=>{
  // In den Hintergrund ist der letzte sichere Moment vor dem Abschuss durch iOS – hier den Stand sichern.
  // (TODAY füllt die Startseite auch über das Home-Aggregat, nicht nur über loadToday().)
  if(document.visibilityState==='hidden'){_hiddenAt=Date.now();snapState();return;}
  const away=_hiddenAt?Date.now()-_hiddenAt:0;
  if(away>5*60000)invalidateView();_hiddenAt=0;
  // Zurück im Vordergrund ist der wahrscheinlichste Moment, in dem wieder Netz da ist. Auch hier gilt:
  // das Stand-Etikett wird nicht gelöscht, sondern eingeholt (A-III.1, siehe _onlineInit/offRefreshActive).
  syncBadge();flushOutbox();
  offRefreshActive();
  // Der Poll hat im Hintergrund pausiert – war die App länger als einen Takt weg, den Zähler jetzt holen
  if(ME&&away>=MSG_POLL_MS)loadUnread();});

// ===== TOUR-TIMING (WP1) =====
// Die komplette Tour-Mechanik (TOUR_DEFS, runTour, drawTourStep, maybeStartTour, maybeStartTabTour, endTour)
// und der iOS-Installhinweis liegen in account.js (WP6) – dort sind Markup, CSS und Timing aus einer Hand.
// WP1 steuert nur die Aufrufpunkte: renderHome ruft am Ende maybeStartTour(); die Tab-Renderer rufen
// maybeStartTabTour(tab,{deferred:true}); go() zählt keine Besuche mehr mit (das macht maybeStartTabTour selbst).
