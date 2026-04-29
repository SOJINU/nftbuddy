// sw.js v2 — handles both scheduled (setTimeout) AND server-pushed (VAPID) notifications

const CACHE = 'nft-buddy-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

// ── Install ──────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch (offline cache) ────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return; // never cache API calls
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
    )
  );
});

// ─────────────────────────────────────────────
//  VAPID PUSH — fires even when browser is closed
// ─────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'NFT Buddy', body: 'You have an upcoming mint!', url: '/' };
  try { data = e.data ? e.data.json() : data; } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-72.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'mint-reminder',
      requireInteraction: !!(data.urgent),
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'Open app' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// ─────────────────────────────────────────────
//  SCHEDULED notifications (browser open / background tab)
//  Sent via postMessage from the main page
// ─────────────────────────────────────────────
const timers = new Map();

self.addEventListener('message', e => {
  const msg = e.data;
  if (!msg?.type) return;

  if (msg.type === 'SCHEDULE_NOTIF') {
    const { id, title, body, delay, tag, urgent } = msg;
    if (timers.has(id)) clearTimeout(timers.get(id));
    if (delay <= 0) return;

    const tid = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        vibrate: [200, 100, 200],
        tag,
        requireInteraction: !!urgent,
        data: { url: '/' },
        actions: [
          { action: 'open', title: 'Open app' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      });
      timers.delete(id);
    }, delay);

    timers.set(id, tid);
  }

  if (msg.type === 'CANCEL_NOTIF') {
    for (const [k, tid] of timers.entries()) {
      if (k.startsWith(msg.id)) { clearTimeout(tid); timers.delete(k); }
    }
  }
});

// ── Notification click ────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  const url = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin)) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
