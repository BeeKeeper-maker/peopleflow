// Service Worker for PeopleFlow HRMS
// Handles caching, offline support, and background sync

const CACHE_NAME = 'peopleflow-v1';
const OFFLINE_URL = '/offline.html';

// Resources to cache on install
const STATIC_CACHE = [
    '/',
    '/login',
    '/manifest.json',
    '/offline.html',
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('PeopleFlow: Caching static resources');
            return cache.addAll(STATIC_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Skip API requests (don't cache)
    if (event.request.url.includes('/api/')) {
        return;
    }

    // Only cache GET requests (POST, PUT, DELETE cannot be cached)
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful GET responses only
                if (response.status === 200 && event.request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Return cached response or offline page
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    // Return offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// Background sync for leave applications
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-leaves') {
        event.waitUntil(syncPendingLeaves());
    }
    if (event.tag === 'sync-expenses') {
        event.waitUntil(syncPendingExpenses());
    }
});

async function syncPendingLeaves() {
    // Get pending leaves from IndexedDB and sync
    console.log('PeopleFlow: Syncing pending leaves');
}

async function syncPendingExpenses() {
    // Get pending expenses from IndexedDB and sync
    console.log('PeopleFlow: Syncing pending expenses');
}

// Push notifications
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const title = data.title || 'PeopleFlow Notification';
    const options = {
        body: data.body || '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
});
