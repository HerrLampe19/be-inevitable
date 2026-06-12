// BE INEVITABLE – Service Worker
// WICHTIG: Dieser Worker macht AUSSCHLIESSLICH Push-Benachrichtigungen.
// Es gibt bewusst KEINEN fetch-Handler und KEIN Caching – die App soll immer
// frisch vom Server laden (wir hatten genug Cache-Probleme).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let data = { title: 'BE INEVITABLE', body: '', url: '/' };
  try { data = { ...data, ...e.data.json() }; } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png?v=1.4.0',
    badge: '/icon-192.png?v=1.4.0',
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
