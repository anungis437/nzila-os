/** Minimum group size for publishing organization-level membership and case metrics. */
export const MIN_PUBLISHABLE_GROUP_SIZE = 5

/** Protect both the small cell and its complementary cell, so a published total cannot reveal either. */
function requiresFamilySuppression(total: number, cells: number[]): boolean {
  if (!Number.isSafeInteger(total) || total < 0) return true
  if (total > 0 && total < MIN_PUBLISHABLE_GROUP_SIZE) return true
  return cells.some((cell) =>
    !Number.isSafeInteger(cell) ||
    cell < 0 ||
    cell > total ||
    (cell > 0 && cell < MIN_PUBLISHABLE_GROUP_SIZE) ||
    (total - cell > 0 && total - cell < MIN_PUBLISHABLE_GROUP_SIZE),
  )
}

export function shouldSuppressMemberMetrics(mem: {
  total: number
  active: number
  new_this_month: number
  prev: number
}): boolean {
  return requiresFamilySuppression(mem.total, [mem.active, mem.new_this_month, mem.prev])
}

export function shouldSuppressClaimMetrics(
  claims: { total: number; active: number; resolved: number; this_month: number },
  byStatus: Record<string, number>,
): boolean {
  const statuses = Object.values(byStatus)
  // A malformed/incomplete grouping must not be published as if it were a complete partition.
  if (statuses.reduce((sum, value) => sum + value, 0) !== claims.total) return true
  return requiresFamilySuppression(claims.total, [
    claims.active, claims.resolved, claims.this_month, ...statuses,
  ])
}
