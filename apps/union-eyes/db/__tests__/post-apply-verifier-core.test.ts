import { describe, expect, it } from 'vitest'
import { storageAuthorityManifest, type RuntimeOperation } from '../rls-storage-authority/index'
import {
  CLASSIFICATION_TREATMENT,
  OPERATIONS,
  RUNTIME_ROLE,
  SYSTEM_ROLE,
  evaluateTable,
  isInScope,
  observeTable,
  policyCoverage,
  requiresRowLevelSecurity,
  verifyEntries,
  type ManifestEntryLike,
  type ObservedPolicy,
  type ObservedTable,
  type Queryable,
} from '../../scripts/rls-enforcement/post-apply-verifier-core'

const ops = (...o: RuntimeOperation[]) => new Set<RuntimeOperation>(o)
const all = ops(...OPERATIONS)
const policy = (command: ObservedPolicy['command'], roles: string[], permissive = true): ObservedPolicy => ({ command, roles, permissive })
const entry = (over: Partial<ManifestEntryLike> = {}): ManifestEntryLike => ({
  table: 'widgets',
  classification: 'TENANT_RLS_REQUIRED',
  requiredRuntimePrivileges: [...OPERATIONS],
  requiredSystemPrivileges: ['SELECT'],
  ...over,
})
const clean = (over: Partial<ObservedTable> = {}): ObservedTable => ({
  rlsEnabled: true,
  rlsForced: true,
  policies: [policy('ALL', [RUNTIME_ROLE]), policy('SELECT', [SYSTEM_ROLE])],
  runtimePrivileges: all,
  systemPrivileges: ops('SELECT'),
  ...over,
})
const texts = (diffs: ReturnType<typeof evaluateTable>) => diffs.map((d) => `${d.kind}: ${d.text}`)

describe('post-apply verifier core: expectations come from the manifest entry', () => {
  it('accepts a table whose privileges and permissive policies match its entry', () => {
    expect(evaluateTable(entry(), clean())).toEqual([])
  })

  it('reports RLS that is not enabled or not forced', () => {
    expect(texts(evaluateTable(entry(), clean({ rlsEnabled: false })))).toEqual(['MISSING: widgets RLS not enabled'])
    expect(texts(evaluateTable(entry(), clean({ rlsForced: false })))).toEqual(['MISSING: widgets FORCE RLS not enabled'])
  })

  it('requires a policy for every command a role is privileged to run, per role', () => {
    const diffs = texts(evaluateTable(entry(), clean({ policies: [policy('DELETE', [RUNTIME_ROLE])] })))
    expect(diffs).toContain(`MISSING: widgets ${RUNTIME_ROLE} is privileged to SELECT but no permissive SELECT policy applies to it`)
    expect(diffs).toContain(`MISSING: widgets ${SYSTEM_ROLE} is privileged to SELECT but no permissive SELECT policy applies to it`)
    expect(diffs.some((d) => d.includes('DELETE'))).toBe(false)
  })

  it('does not count a restrictive policy as coverage, because it can only narrow access', () => {
    const diffs = evaluateTable(entry(), clean({ policies: [policy('ALL', [RUNTIME_ROLE], false), policy('SELECT', [SYSTEM_ROLE])] }))
    expect(diffs).toHaveLength(OPERATIONS.length)
    expect(diffs.every((d) => d.kind === 'MISSING' && d.text.includes(RUNTIME_ROLE))).toBe(true)
  })

  it('counts a permissive policy granted to PUBLIC for both roles, as PostgreSQL applies it', () => {
    expect(evaluateTable(entry(), clean({ policies: [policy('ALL', ['-'])] }))).toEqual([])
    expect(policyCoverage([policy('SELECT', ['public'])], SYSTEM_ROLE)).toEqual(ops('SELECT'))
  })

  it('does not require policies for commands an append-only table never grants', () => {
    const appendOnly = entry({ requiredRuntimePrivileges: ['SELECT', 'INSERT'], requiredSystemPrivileges: [] })
    const observed = clean({ policies: [policy('SELECT', [RUNTIME_ROLE]), policy('INSERT', [RUNTIME_ROLE])], runtimePrivileges: ops('SELECT', 'INSERT'), systemPrivileges: ops() })
    expect(evaluateTable(appendOnly, observed)).toEqual([])
  })

  it('reports a privilege the manifest requires but the role lacks, and one the role holds but the manifest does not allow', () => {
    const diffs = texts(evaluateTable(entry(), clean({ runtimePrivileges: ops('SELECT', 'INSERT', 'UPDATE'), systemPrivileges: ops('SELECT', 'DELETE') })))
    expect(diffs).toContain(`MISSING: ${RUNTIME_ROLE} DELETE on widgets`)
    expect(diffs).toContain(`EXTRA: ${SYSTEM_ROLE} DELETE on widgets`)
    expect(diffs).toHaveLength(2)
  })

  it('treats TBD privileges as none, so any privilege actually held is reported as extra', () => {
    const tbd = entry({ requiredRuntimePrivileges: 'TBD', requiredSystemPrivileges: 'TBD' })
    const diffs = texts(evaluateTable(tbd, clean({ runtimePrivileges: ops('SELECT'), systemPrivileges: ops() })))
    expect(diffs).toEqual([`EXTRA: ${RUNTIME_ROLE} SELECT on widgets`])
  })

  it('owns no RLS shape for a dedicated execution context, but still compares its privileges', () => {
    const framework = entry({ classification: 'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT', requiredRuntimePrivileges: [], requiredSystemPrivileges: [] })
    expect(evaluateTable(framework, clean({ rlsEnabled: false, rlsForced: false, policies: [], runtimePrivileges: ops(), systemPrivileges: ops() }))).toEqual([])
    expect(texts(evaluateTable(framework, clean({ rlsEnabled: false, rlsForced: false, policies: [], runtimePrivileges: ops('SELECT'), systemPrivileges: ops() })))).toEqual([
      `EXTRA: ${RUNTIME_ROLE} SELECT on widgets`,
    ])
  })
})

describe('post-apply verifier core: scope follows the manifest vocabulary', () => {
  it('decides a treatment for every classification the manifest uses', () => {
    const used = new Set(storageAuthorityManifest.map((e) => e.classification))
    for (const classification of used) expect(CLASSIFICATION_TREATMENT[classification], classification).toBeDefined()
  })

  it('exempts only classes that carry no runtime or system contract, and keeps the former baseline tables in scope', () => {
    expect(isInScope({ classification: 'LATENT_UNREACHABLE' })).toBe(false)
    expect(isInScope({ classification: 'CONTAINED_NO_AUTHORITY' })).toBe(false)
    expect(isInScope({ classification: 'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT' })).toBe(true)
    expect(requiresRowLevelSecurity('FRAMEWORK_DEDICATED_EXECUTION_CONTEXT')).toBe(false)
    expect(requiresRowLevelSecurity('NEEDS_REVIEW')).toBe(true)
    const grievances = storageAuthorityManifest.find((e) => e.table === 'grievances')!
    expect(isInScope(grievances)).toBe(true)
  })

  it('is internally consistent: a table observed exactly as its entry specifies passes, for every entry in the live manifest', () => {
    const failures: string[] = []
    for (const e of storageAuthorityManifest) {
      if (!isInScope(e)) continue
      const runtime = new Set<RuntimeOperation>(e.requiredRuntimePrivileges === 'TBD' ? [] : e.requiredRuntimePrivileges)
      const system = new Set<RuntimeOperation>(e.requiredSystemPrivileges === 'TBD' ? [] : e.requiredSystemPrivileges)
      const observed: ObservedTable = {
        rlsEnabled: true,
        rlsForced: true,
        policies: [policy('ALL', [RUNTIME_ROLE, SYSTEM_ROLE])],
        runtimePrivileges: runtime,
        systemPrivileges: system,
      }
      const diffs = evaluateTable(e, observed)
      if (diffs.length > 0) failures.push(`${e.table}: ${texts(diffs).join('; ')}`)
    }
    expect(failures).toEqual([])
  })
})

describe('post-apply verifier core: catalog observation', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    rls: true,
    forced: true,
    policies: [
      { roles: [RUNTIME_ROLE], cmd: 'r', permissive: true },
      { roles: ['-'], cmd: '*', permissive: false },
    ],
    privileges: { [`${RUNTIME_ROLE}:SELECT`]: true, [`${RUNTIME_ROLE}:INSERT`]: false, [`${SYSTEM_ROLE}:SELECT`]: true },
    ...over,
  })
  const db = (byTable: Record<string, Record<string, unknown> | null>): Queryable => ({
    query: async (_text, params) => {
      const found = byTable[String((params ?? [])[0])]
      return { rows: found ? [found] : [] }
    },
  })

  it('maps catalog rows to observed state and reports an absent table as null', async () => {
    const observed = await observeTable(db({ widgets: row() }), 'widgets')
    expect(observed).toEqual({
      rlsEnabled: true,
      rlsForced: true,
      policies: [
        { roles: [RUNTIME_ROLE], command: 'SELECT', permissive: true },
        { roles: ['-'], command: 'ALL', permissive: false },
      ],
      runtimePrivileges: ops('SELECT'),
      systemPrivileges: ops('SELECT'),
    })
    expect(await observeTable(db({}), 'absent')).toBeNull()
  })

  it('skips absent tables and out-of-scope entries, and counts every gap it finds', async () => {
    const entries: ManifestEntryLike[] = [
      entry({ table: 'present_ok', requiredRuntimePrivileges: ['SELECT'], requiredSystemPrivileges: ['SELECT'] }),
      entry({ table: 'present_gap' }),
      entry({ table: 'absent' }),
      entry({ table: 'reference', classification: 'GLOBAL_REFERENCE_DATA' }),
    ]
    const report = await verifyEntries(
      db({
        present_ok: row({ policies: [{ roles: [RUNTIME_ROLE, SYSTEM_ROLE], cmd: 'r', permissive: true }] }),
        present_gap: row({ rls: false }),
        reference: row(),
      }),
      entries,
    )
    expect(report.checked).toEqual(['present_ok', 'present_gap'])
    expect(report.skipped).toEqual(['absent'])
    expect(report.missing).toBe(report.diffs.filter((d) => d.kind === 'MISSING').length)
    expect(report.diffs.some((d) => d.text === 'present_gap RLS not enabled')).toBe(true)
    expect(report.diffs.some((d) => d.text.startsWith('present_ok'))).toBe(false)
  })
})
