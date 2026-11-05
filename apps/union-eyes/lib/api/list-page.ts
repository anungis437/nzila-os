/**
 * The page a list read answers: limit (1..maxLimit, default maxLimit, so a caller that sends none gets what the route always returned) and offset (0..1,000,000) from the query string. A
 * non-numeric or negative value is the default, never NaN or a negative offset handed to the query.
 */
export function listPage(request: { url: string }, maxLimit = 200, defaultLimit = maxLimit): { limit: number; offset: number } {
  const params = new URL(request.url).searchParams
  const bounded = (raw: string | null, fallback: number, min: number, max: number) => {
    const parsed = Number.parseInt(raw ?? '', 10)
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback
  }
  return {
    limit: bounded(params.get('limit'), Math.min(defaultLimit, maxLimit), 1, maxLimit),
    offset: bounded(params.get('offset'), 0, 0, 1_000_000),
  }
}
