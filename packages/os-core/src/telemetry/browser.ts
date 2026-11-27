/** Browser-only, local diagnostics. This module has no Node or delivery dependency. */
export const BROWSER_DIAGNOSTIC_LIMIT = 50
const surfaces = {
  cfo: ['dashboard', 'advisory-ai', 'ai-insights', 'alerts', 'audit', 'client-portal', 'clients', 'documents', 'integrations', 'ledger', 'messages', 'notifications', 'platform-admin', 'reports', 'security', 'settings', 'tasks', 'tax-tools', 'workflows', 'documents-upload', 'workflows-detail', 'workflows-new'],
  zonga: ['dashboard', 'artists', 'browse', 'events', 'notifications', 'playlists', 'tracks'],
  partners: ['admin', 'portal'],
  'nacp-exams': ['dashboard'],
  console: ['error-panel'],
  'nzila-hq': ['error-panel'],
  'union-eyes': ['dashboard'],
} as const
type App = keyof typeof surfaces
export type BrowserErrorReference = Readonly<{ value: string; origin: 'error-digest' | 'local' }>
export type BrowserErrorDiagnostic = {
  [A in App]: { app: A; surface: (typeof surfaces)[A][number]; code: 'CLIENT_BOUNDARY_ERROR'; reference: string; referenceOrigin: BrowserErrorReference['origin'] }
}[App]
export type LocalBrowserDiagnostic = Readonly<BrowserErrorDiagnostic & { recordedAt: string }>
export type BrowserDiagnosticReceipt = Readonly<{
  status: 'RECORDED_LOCALLY' | 'UNAVAILABLE' | 'REJECTED'
  remoteDelivery: 'NOT_ATTEMPTED'
}>
const entries: LocalBrowserDiagnostic[] = []
const opaque = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)

/** React useId supplies a stable fallback across hydration and rerenders. */
export function browserErrorReference(digest: unknown, localId: string): BrowserErrorReference {
  if (opaque(digest)) return Object.freeze({ value: digest, origin: 'error-digest' })
  const suffix = localId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || 'unavailable'
  return Object.freeze({ value: `local-${suffix}`, origin: 'local' })
}

/** Record only this allowlisted envelope. Never enumerate or serialize input. */
export function recordBrowserError(input: BrowserErrorDiagnostic): BrowserDiagnosticReceipt {
  if (typeof window === 'undefined') return { status: 'UNAVAILABLE', remoteDelivery: 'NOT_ATTEMPTED' }
  try {
    const { app, surface, code, reference, referenceOrigin } = input
    if (typeof app !== 'string' || !Object.prototype.hasOwnProperty.call(surfaces, app) ||
      typeof surface !== 'string' || !(surfaces[app] as readonly string[]).includes(surface) || code !== 'CLIENT_BOUNDARY_ERROR' ||
      !opaque(reference) || !['error-digest', 'local'].includes(referenceOrigin) ||
      (referenceOrigin === 'local' && !reference.startsWith('local-')))
      return { status: 'REJECTED', remoteDelivery: 'NOT_ATTEMPTED' }
    const entry = Object.freeze({
      app, surface, code, reference, referenceOrigin,
      recordedAt: new Date().toISOString(),
    }) as LocalBrowserDiagnostic
    entries.push(entry)
    if (entries.length > BROWSER_DIAGNOSTIC_LIMIT) entries.shift()
    return { status: 'RECORDED_LOCALLY', remoteDelivery: 'NOT_ATTEMPTED' }
  } catch {
    // Diagnostics must not break an error boundary, even for hostile getters.
    return { status: 'REJECTED', remoteDelivery: 'NOT_ATTEMPTED' }
  }
}

/** A bounded in-memory snapshot, not a durable incident or telemetry receipt. */
export function readBrowserDiagnostics(): readonly LocalBrowserDiagnostic[] {
  return typeof window === 'undefined' ? [] : Object.freeze([...entries])
}
