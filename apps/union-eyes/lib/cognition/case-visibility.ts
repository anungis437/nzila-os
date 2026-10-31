import { withRLSContext } from '@/lib/db/with-rls-context'
import { decideCase } from '@/lib/authority/store/route-adapter'

/**
 * The cases, of those named, that the authority kernel lets this person read. A role floor says a steward may use a tool; it does not
 * say the steward holds a given case, so every case a cognition read touches is checked against the same decision the case routes use.
 */
export async function visibleCaseIds(organizationId: string, userId: string, caseIds: readonly string[]): Promise<Set<string>> {
  const unique = [...new Set(caseIds)]
  if (unique.length === 0) return new Set()
  return withRLSContext({ organizationId }, async (tx) => {
    const visible = new Set<string>()
    for (const caseId of unique) {
      const verdict = await decideCase(tx, { userId, organizationId, caseId, action: 'case:read_internal' })
      if (verdict.effect === 'allow') visible.add(caseId)
    }
    return visible
  })
}
