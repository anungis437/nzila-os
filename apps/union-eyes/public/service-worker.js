/**
 * UnionEyes Service Worker
 * 
 * Provides offline functionality and caching strategies
 * for Progressive Web App (PWA)
 * 
 * Features:
 * - Stale-while-revalidate for API calls
 * - Cache-first for static assets
 * - Network-first for authentication
 * - Background sync for offline actions
 * - Push notification handling
 *
 * Logging: All log output is sent to connected clients via postMessage
 * instead of console.* to satisfy the zero-console production constraint.
 */

const _CACHE_NAME = 'union-eyes-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';
const API_CACHE = 'api-v1';

/**
 * Service-worker log helper — sends structured messages to all clients.
 * Silent when no clients are connected (production cold-start).
 */
function _swLog(level, ...args) {
  const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  self.clients.matchAll().then(clients => {
    for (const client of clients) {
      client.postMessage({ type: 'SW_LOG', level, message });
    }
  });
}

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API endpoints that should be cached
const _API_PATTERNS = [
  /\/api\/v1\/claims/,
  /\/api\/v1\/members/,
  /\/api\/notifications/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  _swLog('info', '[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      _swLog('info', '[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  _swLog('info', '[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE)
          .map((name) => {
            _swLog('info', '[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  
  // Take control immediately
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - network first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets - cache first, fall back to network
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Navigation requests - network first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Default - stale while revalidate
  event.respondWith(staleWhileRevalidateStrategy(request));
});

// Cache first strategy - for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    _swLog('warn', '[SW] Cache first failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy - for API calls
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (_error) {
    _swLog('warn', '[SW] Network first - falling back to cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({ error: 'offline', message: 'You are currently offline' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Stale while revalidate - for pages and mixed content
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then((c) => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => null);

  return cachedResponse || fetchPromise || new Response('Offline', { status: 503 });
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/fonts/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2')
  );
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  _swLog('info', '[SW] Background sync:', event.tag);
  
  if (event.tag.startsWith('sync-')) {
    event.waitUntil(handleBackgroundSync(event.tag));
  }
});

// Handle background sync
async function handleBackgroundSync(syncTag) {
  const action = syncTag.replace('sync-', '');
  
  switch (action) {
    case 'claim':
      await syncClaimDrafts();
      break;
    case 'member':
      await syncMemberUpdates();
      break;
    case 'message':
      await syncOfflineMessages();
      break;
    default:
      _swLog('warn', '[SW] Unknown sync action:', action);
  }
}

// Sync claim drafts from IndexedDB
async function syncClaimDrafts() {
  // Would open IndexedDB and sync pending claims
  _swLog('info', '[SW] Syncing claim drafts...');
  
  // Get pending operations from cache
  const cache = await caches.open(API_CACHE);
  const pendingRequests = await cache.keys();
  
  for (const request of pendingRequests) {
    if (request.url.includes('/api/claims') && request.method === 'POST') {
      // Re-try the request
      try {
        // In production, would reconstruct and retry
        _swLog('info', '[SW] Would retry:', request.url);
      } catch (error) {
        _swLog('error', '[SW] Sync failed:', error);
      }
    }
  }
}

async function syncMemberUpdates() {
  _swLog('info', '[SW] Syncing member updates...');
}

async function syncOfflineMessages() {
  _swLog('info', '[SW] Syncing offline messages...');
}

// Push notification handling
self.addEventListener('push', (event) => {
  _swLog('info', '[SW] Push notification received');
  
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_e) {
      data = { title: 'UnionEyes', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: data.tag || 'default',
    renotify: data.renotify || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'UnionEyes', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  _swLog('info', '[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Message handling from main app
self.addEventListener('message', (event) => {
  _swLog('info', '[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});
