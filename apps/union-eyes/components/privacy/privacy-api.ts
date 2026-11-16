import { envelopeData } from '@/lib/client/api-envelope'

export class PrivacyApiError extends Error {
  constructor(readonly reason: string) { super('Privacy operation could not be completed') }
}

export async function privacyFetch(organizationId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('x-ue-expected-organization', organizationId)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) {
    let reason = response.status === 404 ? 'not_found' : response.status === 403 || response.status === 401 ? 'forbidden' : 'unavailable'
    try {
      const body: unknown = await response.json()
      if (body && typeof body === 'object' && 'error' in body && body.error && typeof body.error === 'object' &&
          'details' in body.error && body.error.details && typeof body.error.details === 'object' &&
          'reason' in body.error.details && typeof body.error.details.reason === 'string') reason = body.error.details.reason
    } catch { /* Do not display arbitrary server text or an authentication page. */ }
    throw new PrivacyApiError(reason)
  }
  return response
}

export async function privacyData(organizationId: string, path: string, init?: RequestInit) {
  return envelopeData(await (await privacyFetch(organizationId, path, init)).json())
}

export async function verifiedPrivacyDownload(response: Response): Promise<Blob> {
  const expected = response.headers.get('X-Privacy-Export-Sha256')
  if (!expected || !/^[a-f0-9]{64}$/.test(expected) || !response.headers.get('Content-Type')?.includes('application/json'))
    throw new PrivacyApiError('unavailable')
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > 1024 * 1024) throw new PrivacyApiError('unavailable')
  const actual = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('')
  if (actual !== expected) throw new PrivacyApiError('unavailable')
  return new Blob([bytes], { type: 'application/json' })
}
