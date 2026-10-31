/**
 * Normalizes the public case-studies API response.
 *
 * withApi() wraps handler responses as { success: true, data: { data: rows, pagination } }.
 * The old marketing page looked only for payload.caseStudies and silently showed an empty
 * page after an otherwise successful request. This helper retains backwards-compatible
 * parsing while refusing to interpret error envelopes as populated results.
 */
export function caseStudyRows<T>(payload: unknown): T[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const root = payload as Record<string, unknown>
  if (root.success === false) return []
  const wrapped = root.data
  const nested = wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped)
    ? (wrapped as Record<string, unknown>).data
    : undefined
  const rows = Array.isArray(nested) ? nested
    : Array.isArray(wrapped) ? wrapped
    : root.caseStudies
  return Array.isArray(rows) ? rows as T[] : []
}
