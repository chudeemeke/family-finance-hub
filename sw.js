/**
 * Service Worker for Family Finance Hub
 * Handles offline functionality, caching, and background sync
 */

const CACHE_NAME = 'family-finance-hub-v2';
const DATA_CACHE_NAME = 'family-finance-data-v2';
const SYNC_TAG = 'sync-data';

// Files to cache for offline use
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/styles.css',
    '/js/security-manager.js',
    '/js/db-manager.js',
    '/js/sync-manager.js',
    '/js/notification-manager.js',
    '/js/analytics.js',
    '/js/voice-commands.js',
    '/js/biometric-auth.js',
    '/js/components/app-context.js',
    '/js/components/login.js',
    '/js/components/dashboard.js',
    '/js/components/transactions.js',
    '/js/components/budget.js',
    '/js/components/savings.js',
    '/js/components/shopping.js',
    '/js/components/settings.js',
    '/js/components/navigation.js',
    '/js/app.js',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://cdn.jsdelivr.net/npm/recharts@2.5.0/dist/Recharts.js',
    'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js',
    'https://cdn.tailwindcss.com'
];

// Install event - cache all static assets
self.addEventListener('install', event => {
    console.log('[ServiceWorker] Install');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
            .catch(error => {
                console.error('[ServiceWorker] Cache failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Activate');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    return cacheName.startsWith('family-finance-') &&
                           cacheName !== CACHE_NAME &&
                           cacheName !== DATA_CACHE_NAME;
                }).map(cacheName => {
                    console.log('[ServiceWorker] Removing old cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin) &&
        !event.request.url.startsWith('https://')) {
        return;
    }
    
    // Handle API requests differently
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then(cache => {
                return fetch(event.request)
                    .then(response => {
                        // Cache successful responses
                        if (response.status === 200) {
                            cache.put(event.request.url, response.clone());
                        }
                        return response;
                    })
                    .catch(() => {
                        // Return cached data when offline
                        return cache.match(event.request);
                    });
            })
        );
        return;
    }
    
    // For all other requests, try cache first
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                // Clone the request
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then(response => {
                    // Check for valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Clone the response
                    const responseToCache = response.clone();
                    
                    // Cache the response
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(error => {
                console.error('[ServiceWorker] Fetch failed:', error);
                
                // Return offline page for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html');
                }
            })
    );
});

// Background sync event
self.addEventListener('sync', event => {
    console.log('[ServiceWorker] Sync event:', event.tag);
    
    if (event.tag === SYNC_TAG) {
        event.waitUntil(syncOfflineData());
    }
});

// Push notification event
self.addEventListener('push', event => {
    console.log('[ServiceWorker] Push event');
    
    const title = 'Family Finance Hub';
    const options = {
        body: event.data ? event.data.text() : 'New update available',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'view',
                title: 'View',
                icon: '/icon-check.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icon-close.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    console.log('[ServiceWorker] Notification click:', event.action);
    
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message event for communication with app
self.addEventListener('message', event => {
    console.log('[ServiceWorker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'SYNC_NOW') {
        event.waitUntil(syncOfflineData());
    }
});

// Sync offline data function
async function syncOfflineData() {
    console.log('[ServiceWorker] Syncing offline data...');
    
    try {
        // Get all clients
        const allClients = await clients.matchAll({
            includeUncontrolled: true,
            type: 'window'
        });
        
        // Send sync message to all clients
        allClients.forEach(client => {
            client.postMessage({
                type: 'SYNC_STARTED'
            });
        });
        
        // In production, this would sync with your backend
        // For now, we'll simulate a successful sync
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Notify clients of successful sync
        allClients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETED',
                success: true
            });
        });
        
        return true;
    } catch (error) {
        console.error('[ServiceWorker] Sync failed:', error);
        
        // Notify clients of failed sync
        const allClients = await clients.matchAll({
            includeUncontrolled: true,
            type: 'window'
        });
        
        allClients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETED',
                success: false,
                error: error.message
            });
        });
        
        throw error;
    }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-data') {
        event.waitUntil(syncOfflineData());
    }
});