// BE INEVITABLE – Service Worker
// Push-Benachrichtigungen (unverändert) UND seit 2.3.0 ein Cache für die App-Hülle.
// Zwei Regeln, je nach Adresse:
//  · Dateien MIT Versionsstempel (?v=2.3.0 – CSS, JS, Icons) kommen aus dem Cache, ohne beim Server
//    nachzufragen. Eine solche Adresse kann sich per Definition nicht ändern: ändert sich die Datei, nennt
//    die (nie gecachte) index.html eine NEUE Adresse. Vorher fragte der Worker bei jedem Start alle
//    20 Dateien nach (20 × 304), und bei schlechtem Netz wartete jede davon auf ein scheiterndes fetch,
//    obwohl alles im Cache lag – genau die Lage, für die der Cache gebaut wurde.
//    Für lokale Tests heißt das: eine geänderte JS/CSS-Datei erscheint erst nach Versionssprung in
//    package.json oder nach „Cache leeren" (DevTools → Application → Service Workers → Unregister).
//  · Alles OHNE Stempel („/", manifest.json, logo.jpg) bleibt NETWORK-FIRST: solange Netz da ist, gewinnt
//    die Antwort vom Server, der Cache ist reine Rückfallebene für „kein Netz". Nur so kann nach einem
//    Deploy nie eine alte index.html ausgeliefert werden (die Cache-Probleme, wegen derer hier vorher
//    gar nichts gecacht wurde).
// /api/* und /sw.js werden NIEMALS gecacht: Daten sollen nie aus der Konserve kommen.
// Der Cache-Name trägt die Version (der Server ersetzt __APP_VERSION__ beim Ausliefern), und
// activate löscht jeden fremden Cache – nach einem Deploy bleibt also nichts Altes stehen.
//
// 2.7.0 (A-III.3): Aus 22 Einzeldateien sind /app.js und /app.css geworden, dazu vier nachgeladene
// Module unter /mod/. Ein Browser, der noch die 2.6.0-Hülle im Cache hat, kommt OHNE Handgriff auf den
// neuen Stand: index.html wird nie gecacht, nennt also sofort die neuen Adressen; die alten Einträge
// liegen im Cache „be-shell-2.6.0", und activate löscht jeden Cache, der nicht der aktuelle ist.
// Bleibt trotzdem einmal ein Worker hängen: /?swkill=1 (Notausgang, siehe index.html und
// DEPLOY-PRUEFEN.md) meldet ihn ab und leert alle Caches.

const CACHE = 'be-shell-__APP_VERSION__';

// Die Hülle vorab holen, damit die App auch beim allerersten Offline-Start rendert.
// Bewusst NUR die Hülle: die vier nachgeladenen Module (/mod/…) landen im Cache, sobald sie das erste
// Mal wirklich gebraucht werden – der fetch-Zweig unten legt jede gültige Antwort ab. Sie beim
// Installieren mitzuziehen hieße, 112 KB zu holen, während der Nutzer auf seine Startseite wartet.
// 2.7.0 (A-III.3, Nachbesserung B2/B5): Das Anmelde-Logo und icon-192 stehen hier NICHT mehr.
// Sie wurden sonst beim Installieren des Workers geholt – also mitten im Kaltstart, fuer den die beiden
// Dateien gerade aus index.html entfernt wurden (13,2 + 7,7 KB). Verloren geht damit nichts, was jemand
// merkt: der fetch-Zweig unten legt JEDE gueltige Antwort ab, das Logo landet also im Cache, sobald ein
// abgemeldeter Besucher die Anmeldekarte wirklich einmal sieht, und icon-192 (Push-Symbol, Installation),
// sobald der Browser es fuer manifest.json oder eine Meldung holt. Wer sie hier wieder eintraegt,
// bezahlt sie beim ersten Start jedes Geraets.
const SHELL = [
  '/', '/manifest.json',
  '/app.css?v=__APP_VERSION__',
  '/app.js?v=__APP_VERSION__'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // Jede Datei einzeln, jeder Fehler geschluckt: eine fehlende Datei darf die Installation nicht kippen.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
});

self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // Schreibendes gehört der Outbox, nicht dem Cache
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;  // fremde Hosts (z.B. Barcode-Datenbank) bleiben unberührt
  if (url.pathname.startsWith('/api/')) return;     // Daten NIEMALS cachen
  if (url.pathname === '/sw.js') return;            // der Worker selbst läuft am Cache vorbei
  // Versionsstempel = unveränderlich (siehe Kopf). index.html trägt nie einen, wird hier aber trotzdem
  // ausdrücklich ausgenommen – sie darf unter keinen Umständen aus dem Cache kommen, solange Netz da ist.
  const versioned = url.searchParams.has('v') && url.pathname !== '/' && url.pathname !== '/index.html';
  e.respondWith((async () => {
    if (versioned) {
      const hit = await caches.match(req);
      if (hit) return hit;                           // ohne Nachfrage beim Server
    }
    try {
      const res = await fetch(req);
      // Nur vollständige, gültige Antworten ablegen – ein 404 oder eine Teilantwort darf keine gute Datei verdrängen
      if (res && res.ok && res.type === 'basic' && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      // Seitenaufruf ohne Netz: die gecachte Hülle liefern, damit die App startet statt einer Fehlerseite
      if (req.mode === 'navigate') {
        const shell = await caches.match('/');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});

self.addEventListener('push', e => {
  let data = { title: 'BE INEVITABLE', body: '', url: '/' };
  try { data = { ...data, ...e.data.json() }; } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png?v=__APP_VERSION__',
    badge: '/icon-192.png?v=__APP_VERSION__',
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});
