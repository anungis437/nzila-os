/**
 * Canonical destination for ICRA emails containing a bearer capability.
 * Never derive a production link from Host/X-Forwarded-Host: an attacker could
 * otherwise redirect a valid capability to an attacker-controlled origin.
 * Development fallback is restricted to local loopback, not arbitrary hosts.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

export function resolveIcraEmailOrigin(
  configuredOrigin: string | undefined,
  requestOrigin: string,
  production: boolean,
): string | null {
  const configured = configuredOrigin?.trim()
  if (!configured && production) return null

  try {
    const url = new URL(configured || requestOrigin)
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    if (configured) {
      if (url.protocol !== 'https:' && !( !production && url.protocol === 'http:' && LOOPBACK.has(url.hostname))) return null
    } else if (!LOOPBACK.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}
