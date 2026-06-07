const EXTERNAL_BILLING_REDIRECT_ALLOWLIST = (process.env.BILLING_REDIRECT_ALLOWLIST ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)

function isAllowlistedHost(hostname: string): boolean {
  return EXTERNAL_BILLING_REDIRECT_ALLOWLIST.some(
    (entry) => hostname === entry || hostname.endsWith(`.${entry}`),
  )
}

/**
 * Validates redirect URLs used by billing endpoints.
 *
 * Rules:
 * - http/https only
 * - same-origin always allowed
 * - explicit external host allowlist via BILLING_REDIRECT_ALLOWLIST
 */
export function isAllowedBillingRedirect(url: string, requestOrigin: string): boolean {
  try {
    const parsed = new URL(url)
    const origin = new URL(requestOrigin)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    if (parsed.origin === origin.origin) return true
    return isAllowlistedHost(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}
