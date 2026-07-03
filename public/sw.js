// PeopleFlow HRMS — Enterprise Service Worker v2
//
// Features:
//   ✅ Multi-layer caching (static, runtime, API)
//   ✅ Offline app shell (dashboard loads instantly from cache)
//   ✅ Background sync for attendance check-in (offline → sync when online)
//   ✅ Push notification handling with action buttons
//   ✅ Cache versioning with automatic cleanup
//   ✅ Bengali + English offline page

const CACHE_VERSION = 'peopleflow-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const API_CACHE = `${CACHE_VERSION}-api`;

// App shell — resources needed for the app to load offline
const APP_SHELL = [
    '/',
    '/manifest.json',
    '/offline.html',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

// ── Install: pre-cache app shell ──
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(APP_SHELL).catch(() => {
                // If any URL fails, continue — don't block install
                console.log('PeopleFlow SW: Some app shell resources failed to cache');
            });
        })
    );
    self.skipWaiting();
});

// ── Activate: clean up old caches + claim clients ──
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => !name.startsWith(CACHE_VERSION))
                    .map((name) => {
                        console.log('PeopleFlow SW: Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ── Fetch: multi-strategy caching ──
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin
    if (url.origin !== self.location.origin) return;

    // Skip non-GET
    if (request.method !== 'GET') {
        // Handle background sync for POST requests (attendance check-in)
        return;
    }

    // ── Strategy 1: API requests — Network-first with timeout, fallback to cache ──
    if (url.pathname.startsWith('/api/')) {
        // Don't cache auth endpoints
        if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/v1/')) {
            return;
        }

        event.respondWith(
            fetchWithTimeout(request, 5000)
                .then((response) => {
                    // Cache successful API responses (short TTL)
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(API_CACHE).then((cache) => {
                            cache.put(request, clone);
                            // Expire after 2 minutes
                            setTimeout(() => cache.delete(request), 120000);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cached API response
                    return caches.match(request).then((cached) => {
                        return cached || new Response(
                            JSON.stringify({ error: 'Offline', code: 'OFFLINE' }),
                            { status: 503, headers: { 'Content-Type': 'application/json' } }
                        );
                    });
                })
        );
        return;
    }

    // ── Strategy 2: Navigation requests — Network-first, fallback to cache, then offline ──
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache the page for offline access
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        return cached || caches.match('/offline.html');
                    });
                })
        );
        return;
    }

    // ── Strategy 3: Static assets — Cache-first (fast) ──
    if (['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
                    }
                    return response;
                }).catch(() => cached || new Response('', { status: 503 }));
                });
        });
        return;
    }
});

// ── Helper: fetch with timeout ──
function fetchWithTimeout(request, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), ms);
        fetch(request).then(
            (response) => { clearTimeout(timer); resolve(response); },
            (error) => { clearTimeout(timer); reject(error); }
        );
    });
}

// ── Push notifications with action buttons ──
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data?.json() || {};
    } catch {
        data = { title: event.data?.text() || 'PeopleFlow' };
    }

    const title = data.title || 'PeopleFlow Notification';
    const options = {
        body: data.body || data.message || '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || data.link || '/',
            type: data.type || 'general',
        },
        actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' },
        ],
        tag: data.type || 'default', // Group notifications by type
        renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click handler ──
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

// ── Background Sync: offline attendance check-in ──
// When the employee checks in while offline, the request is queued.
// When connectivity returns, the service worker fires a 'sync' event
// and we replay the queued request.
self.addEventListener('sync', (event) => {
    if (event.tag === 'attendance-checkin') {
        event.waitUntil(replayOfflineAttendance());
    }
});

async function replayOfflineAttendance() {
    try {
        // Read queued attendance actions from IndexedDB
        const db = await openOfflineDB();
        const tx = db.transaction(['pendingAttendance'], 'readonly');
        const store = tx.objectStore('pendingAttendance');
        const requests = await store.getAll();

        for (const req of requests) {
            try {
                const response = await fetch(req.url, {
                    method: req.method,
                    headers: req.headers,
                    body: req.body,
                });

                if (response.ok) {
                    // Remove from queue on success
                    const deleteTx = db.transaction(['pendingAttendance'], 'readwrite');
                    deleteTx.objectStore('pendingAttendance').delete(req.id);

                    // Notify the app
                    const clients = await self.clients.matchAll();
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'attendance-synced',
                            success: true,
                            timestamp: req.timestamp,
                        });
                    });
                }
            } catch {
                // Will retry on next sync event
            }
        }
    } catch (err) {
        console.error('PeopleFlow SW: Background sync failed:', err);
    }
}

// ── IndexedDB for offline attendance queue ──
function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('peopleflow-offline', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pendingAttendance')) {
                db.createObjectStore('pendingAttendance', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ── Message handler: app → service worker communication ──
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data?.type === 'QUEUE_ATTENDANCE') {
        // Queue an attendance action for background sync
        queueAttendanceAction(event.data.payload);
    }
});

async function queueAttendanceAction(payload) {
    const db = await openOfflineDB();
    const tx = db.transaction(['pendingAttendance'], 'readwrite');
    tx.objectStore('pendingAttendance').add({
        url: payload.url,
        method: payload.method,
        headers: payload.headers,
        body: payload.body,
        timestamp: Date.now(),
    });

    // Register for background sync
    if ('sync' in self.registration) {
        self.registration.sync.register('attendance-checkin');
    }
}
