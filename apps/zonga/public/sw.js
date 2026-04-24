const CACHE_NAME = 'zonga-shell-v1'
const OFFLINE_ASSETS = ['/', '/en/dashboard']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)).catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) return
  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') return
  const safePath = `${requestUrl.pathname}${requestUrl.search}`

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      if (safePath === '/') {
        return fetch('/')
          .then((response) => {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => undefined)
            return response
          })
          .catch(() => caches.match('/en/dashboard'))
      }
      if (safePath === '/en/dashboard') {
        return fetch('/en/dashboard')
          .then((response) => {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => undefined)
            return response
          })
          .catch(() => caches.match('/en/dashboard'))
      }
      return caches.match('/en/dashboard')
        .then((response) => {
          return response
        })
    }),
  )
})
