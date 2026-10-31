/**
 * Where an attached interview document may live.
 *
 * The location is stored and later followed, so it must name an object in the organization's own area of the approved storage
 * account: https only, an exact approved host (a subdomain of an approved name is another party's host), no embedded credentials,
 * no query string or fragment (a signed-access token would be stored with the record), and a path that carries the organization
 * id as a segment, so one organization cannot register another's object. localhost is accepted outside production only.
 */
const DEFAULT_HOSTS = ['nzilacanadastore.blob.core.windows.net']

export function approvedStorageHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.UE_DOCUMENT_STORAGE_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
  const hosts = configured.length > 0 ? configured : DEFAULT_HOSTS
  return env.NODE_ENV === 'production' ? hosts : [...hosts, 'localhost', '127.0.0.1']
}

export type DocumentLocationVerdict = { ok: true } | { ok: false; reason: string }

export function checkDocumentLocation(fileUrl: string, organizationId: string, env: NodeJS.ProcessEnv = process.env): DocumentLocationVerdict {
  let url: URL
  try {
    url = new URL(fileUrl)
  } catch {
    return { ok: false, reason: 'fileUrl must be a valid URL' }
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:' && env.NODE_ENV !== 'production')) {
    return { ok: false, reason: 'fileUrl must use https' }
  }
  if (url.username || url.password) return { ok: false, reason: 'fileUrl must not carry credentials' }
  if (url.search || url.hash) return { ok: false, reason: 'fileUrl must not carry a query string or fragment (store the object location, not a signed link)' }
  if (!approvedStorageHosts(env).includes(url.hostname.toLowerCase())) {
    return { ok: false, reason: 'fileUrl must point to an authorized storage host' }
  }
  const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment).toLowerCase())
  if (segments.includes('..') || !segments.includes(organizationId.toLowerCase())) {
    return { ok: false, reason: "fileUrl must be inside the organization's own storage area" }
  }
  return { ok: true }
}
