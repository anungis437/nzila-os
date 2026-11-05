import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { POLICY_LIFECYCLE_UNAVAILABLE } from '@/lib/governance/policy-lifecycle-unavailable'

/**
 * The policy lifecycle governance API is not available (capability UE-GOVERNANCE-POLICY-LIFECYCLE, lib/reality/capability-registry.ts).
 *
 * The mismatch census (scripts/runtime/mismatch-census.ts, UE-CONV-H-013) found thirteen routes reading and writing seven relations of the Nzila platform database
 * through Union Eyes' own handle: relations that exist in no Union Eyes migration, model or declaration, so every call failed, and that would have been written
 * as the system role by an administrator of any one organization had they existed. The routes now answer 501, behind the same role and entitlement gate, and read
 * and write nothing; the pages and components that called them are gone, since nothing links to them and each would have shown an error.
 */
const APP_ROOT = join(__dirname, '..', '..', '..')
const API_ROOT = join(APP_ROOT, 'app', 'api', 'governance', 'lifecycle')

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? routeFiles(path) : name === 'route.ts' ? [path] : []
  })
}

const FILES = routeFiles(API_ROOT).sort()
const count = (text: string, needle: string) => text.split(needle).length - 1

describe('the policy lifecycle governance API answers that it is not available', () => {
  it('keeps the thirteen routes it always had, so no client meets a 404 where it used to meet an answer', () => {
    expect(FILES.map((file) => relative(API_ROOT, file).replace(/\\/g, '/'))).toEqual([
      'conflicts/[conflictId]/route.ts',
      'conflicts/route.ts',
      'deprecation-watch/route.ts',
      'policies/[id]/approvals/route.ts',
      'policies/[id]/conflicts/route.ts',
      'policies/[id]/lineage/route.ts',
      'policies/[id]/replay/route.ts',
      'policies/[id]/route.ts',
      'policies/[id]/versions/route.ts',
      'policies/route.ts',
      'policy-events/route.ts',
      'snapshots/[at]/route.ts',
      'snapshots/route.ts',
    ])
  })

  it.each(FILES.map((file) => [relative(API_ROOT, file).replace(/\\/g, '/'), file]))(
    '%s answers 501 for every method behind the administrator and entitlement gate, and touches no data',
    (_name, file) => {
      const text = readFileSync(file, 'utf8')
      const methods = [...text.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = withApi\(/g)]
      expect(methods.length).toBeGreaterThan(0)
      // Every exported method is the same refusal, and every one keeps the gate: an anonymous or unentitled caller is still refused as before.
      expect(count(text, 'ApiError.notImplemented(POLICY_LIFECYCLE_UNAVAILABLE)')).toBe(methods.length)
      expect(count(text, "auth: { required: true, minRole: 'admin' }")).toBe(methods.length)
      expect(count(text, "entitlement: 'governance_suite'")).toBe(methods.length)
      for (const forbidden of ['@/db', '@nzila/db', 'withSystemContext', 'withRLSContext', 'persistAtomicAudit', '.insert(', '.update(', '.delete(', '.select(', 'request.json']) {
        expect(text, forbidden).not.toContain(forbidden)
      }
    },
  )

  it('says what is missing, and that nothing happened', () => {
    expect(POLICY_LIFECYCLE_UNAVAILABLE).toContain('platform database')
    expect(POLICY_LIFECYCLE_UNAVAILABLE).toContain('no organization-scoped policy store')
    expect(POLICY_LIFECYCLE_UNAVAILABLE).toContain('Nothing was read or written')
  })

  it('leaves no page or component that calls the API and would show an error', () => {
    expect(existsSync(join(APP_ROOT, 'app', '[locale]', 'dashboard', 'governance', 'lifecycle'))).toBe(false)
    expect(existsSync(join(APP_ROOT, 'components', 'policy-governance'))).toBe(false)
  })
})
