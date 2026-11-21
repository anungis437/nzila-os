/**
 * F06 R6 on real PostgreSQL — the audit reader under the real application roles.
 *
 * The reader was credited in B105 on mocked transactions. Natively the runtime role held only INSERT on the legacy
 * audit_security.audit_logs, so every list or read failed with "permission denied"; legacy cache migration 0045 added an org-scoped SELECT.
 *
 * The canonical current-security source now decides the other way for a canonical deployment: the runtime role holds no usage of the
 * audit_security schema at all (tooling/scripts/write-union-eyes-current-catalog.ts; the V2 source plan excludes audit_security.audit_logs),
 * and persistAtomicAudit writes only the hash-chained public.audit_logs. So the reader reads only the store the deployment writes. This
 * proves, against the canonical combined database as union_eyes_runtime in a real canonical business session:
 *   - canonical mode lists, reads and answers from the canonical store only, isolated to the session's organization;
 *   - a reader in legacy mode is refused by the canonical database (permission denied), never shown a silently empty or foreign result;
 *   - the legacy sink stays unreadable and unchangeable for the tenant, and the signature trail unchangeable.
 * It no longer applies legacy migration 0045 here: re-granting a store the canonical source removed would test a topology this database
 * does not have.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasAuditedAction, listAuditEntries, readAuditEntry } from '@/lib/audit/audit-reader'
import { readSealWitnesses } from '@/lib/signature/seal-witness'
import { installNativeBusinessContext, nativeActionUrl, withNativeCanonicalActor } from '../../scripts/runtime/native-canonical-fixture'
import { seedDeclaredCanonicalActor } from './native-declared-actor'
import type { AuthenticatedOrgBinding } from '../../../../packages/platform-auth/src/org-binding'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

describe.skipIf(!URL)('audit reader on real PostgreSQL as the runtime role', () => {
  let admin: pg.Client
  let client: ReturnType<typeof postgres>
  const orgA = randomUUID()
  const orgB = randomUUID()
  const legacyA = randomUUID()
  const legacyB = randomUUID()
  const canonA = randomUUID()
  const canonB = randomUUID()
  const orphan = randomUUID()
  // One declared reader per organization: a real canonical member acting through a real canonical session.
  const readerOf = (org: string) => `audit-reader-${org.slice(0, 8)}`

  // The application's own driver (postgres-js) on the restricted runtime login, so execute() returns rows the way the reader sees
  // them in production. With an organization, the transaction carries that organization's reader's verified business session.
  const asRuntime = async <T,>(org: string | null, fn: (tx: never) => Promise<T>): Promise<T> => {
    const run = (binding?: AuthenticatedOrgBinding) => drizzle(client).transaction(async (tx) => {
      await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
      await tx.execute(sql`SET LOCAL search_path=pg_catalog,public,pg_temp`)
      if (binding) await installNativeBusinessContext((statement) => tx.execute(statement), binding)
      return fn(tx as never)
    })
    return org ? withNativeCanonicalActor(readerOf(org), org, run) : run()
  }
  const causeOf = (error: unknown) => (error as { cause?: { message?: string } }).cause?.message ?? (error as Error).message
  const deniedBy = async (org: string, statement: ReturnType<typeof sql>) => {
    try {
      await asRuntime(org, async (tx) => { await (tx as { execute: (q: unknown) => Promise<unknown> }).execute(statement) })
    } catch (error) {
      return /permission denied/i.test(causeOf(error))
    }
    return false
  }
  // A reader configured for the legacy store, run against this canonical database: the store it would read is not the runtime's.
  const inLegacyMode = async <T,>(work: () => Promise<T>): Promise<T> => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '0'
    try { return await work() } finally { process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1' }
  }

  const legacy = (id: string, org: string | null, action: string) =>
    admin.query(
      `INSERT INTO audit_security.audit_logs (audit_id, organization_id, user_id, action, resource_type, severity, outcome)
       VALUES ($1, $2, 'u1', $3, 'thing', 'info', 'success')`,
      [id, org, action],
    )
  const canonical = (id: string, org: string, action: string) =>
    admin.query(
      `INSERT INTO public.audit_logs (id, created_at, updated_at, audit_id, organization_id, user_id, action, resource_type, resource_id, content_hash, previous_hash)
       VALUES (gen_random_uuid(), now(), now(), $1, $2, 'u2', $3, 'thing', 'r1', repeat('a', 64), NULL)`,
      [id, org, action],
    )

  beforeAll(async () => {
    expect(process.env.UE_CANONICAL_BOOTSTRAP_V2).toBe('1')
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(nativeActionUrl('union_eyes_runtime', URL), { max: 4, onnotice: () => undefined })
    for (const org of [orgA, orgB]) {
      const slug = `ar-${org.slice(0, 8)}`
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1) ON CONFLICT (id) DO NOTHING`,
        [org, slug, slug],
      )
      await seedDeclaredCanonicalActor(admin, readerOf(org), org, 'admin')
    }
    await legacy(legacyA, orgA, 'reader.legacy.a')
    await legacy(legacyB, orgB, 'reader.legacy.b')
    await legacy(orphan, null, 'reader.legacy.platform')
    await canonical(canonA, orgA, 'reader.canonical.a')
    await canonical(canonB, orgB, 'reader.canonical.b')
  }, 120_000)

  afterAll(async () => {
    await admin?.query('DELETE FROM audit_security.audit_logs WHERE action LIKE $1', ['reader.%']).catch(() => undefined)
    await admin?.query("DELETE FROM public.audit_logs WHERE action LIKE 'reader.%'").catch(() => undefined)
    await client?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('lists only the organization\'s own canonical records in canonical mode, and never the legacy store', async () => {
    const rows = await asRuntime(orgA, (tx) => listAuditEntries(tx, orgA))
    const ids = rows.map((r) => r.auditId)
    expect(ids).toContain(canonA)
    expect(ids).not.toContain(canonB)
    expect(ids).not.toEqual(expect.arrayContaining([legacyA]))
    expect(ids).not.toEqual(expect.arrayContaining([orphan]))
    expect(rows.every((r) => r.source === 'canonical')).toBe(true)
    expect(rows.find((r) => r.auditId === canonA)).toMatchObject({ source: 'canonical', severity: null, outcome: null, resourceId: 'r1' })
  })

  it('refuses a legacy-mode reader: the canonical runtime role holds no usage of the legacy audit schema', async () => {
    const refused = await asRuntime(orgA, (tx) => inLegacyMode(() => listAuditEntries(tx, orgA))).then(() => null, causeOf)
    expect(refused).toMatch(/permission denied for schema audit_security/)
  })

  it('reads one record by id from the canonical store, and answers null for a legacy id and across organizations', async () => {
    expect(await asRuntime(orgA, (tx) => readAuditEntry(tx, orgA, canonA))).toMatchObject({ source: 'canonical', action: 'reader.canonical.a' })
    expect(await asRuntime(orgA, (tx) => readAuditEntry(tx, orgA, legacyA))).toBeNull()
    expect(await asRuntime(orgA, (tx) => readAuditEntry(tx, orgA, canonB))).toBeNull()
    // A caller who names another organization while running in its own tenant context still sees nothing.
    expect(await asRuntime(orgA, (tx) => readAuditEntry(tx, orgB, canonB))).toBeNull()
  })

  it('answers whether an action was recorded, per organization, from the canonical store only', async () => {
    expect(await asRuntime(orgA, (tx) => hasAuditedAction(tx, orgA, 'reader.canonical.%'))).toBe(true)
    expect(await asRuntime(orgA, (tx) => hasAuditedAction(tx, orgA, 'reader.canonical.%', ['%.a']))).toBe(false)
    expect(await asRuntime(orgA, (tx) => hasAuditedAction(tx, orgA, 'reader.legacy.%'))).toBe(false)
    expect(await asRuntime(orgB, (tx) => hasAuditedAction(tx, orgA, 'reader.canonical.%'))).toBe(false)
  })

  it('sees nothing without a tenant context', async () => {
    const rows = await asRuntime(null, (tx) => listAuditEntries(tx, orgA))
    expect(rows).toEqual([])
  })

  it('keeps the legacy sink out of the tenant\'s reach: no read, no update, no delete', async () => {
    await expect(deniedBy(orgA, sql`SELECT 1 FROM audit_security.audit_logs WHERE audit_id = ${legacyA}::uuid`)).resolves.toBe(true)
    await expect(deniedBy(orgA, sql`UPDATE audit_security.audit_logs SET action = 'x' WHERE audit_id = ${legacyA}::uuid`)).resolves.toBe(true)
    await expect(deniedBy(orgA, sql`DELETE FROM audit_security.audit_logs WHERE audit_id = ${legacyA}::uuid`)).resolves.toBe(true)
  })

  describe('seal records read back for the signature chain check', () => {
    const doc = randomUUID()
    const head = `sha256:${'b'.repeat(64)}`

    beforeAll(async () => {
      await admin.query(
        `INSERT INTO audit_security.audit_logs (audit_id, organization_id, user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, 'u1', 'signature.document.sealed', 'signature_documents', $3, $4::jsonb)`,
        [randomUUID(), orgA, doc, JSON.stringify({ chainHead: head, chainedEvents: 4 })],
      )
      await admin.query(
        `INSERT INTO public.audit_logs (id, created_at, updated_at, audit_id, organization_id, user_id, action, resource_type, resource_id, details, content_hash, previous_hash)
         VALUES (gen_random_uuid(), now(), now(), $1, $2, 'u2', 'signature.document.sealed', 'signature_documents', $3, $4::jsonb, repeat('c', 64), NULL)`,
        [randomUUID(), orgA, doc, JSON.stringify({ chainHead: head, chainedEvents: 4 })],
      )
    })
    afterAll(async () => {
      await admin?.query("DELETE FROM audit_security.audit_logs WHERE action = 'signature.document.sealed' AND resource_id = $1", [doc]).catch(() => undefined)
      await admin?.query("DELETE FROM public.audit_logs WHERE action = 'signature.document.sealed' AND resource_id = $1", [doc]).catch(() => undefined)
    })

    it('reads the head and count from the canonical store in canonical mode, and refuses a legacy-mode read', async () => {
      expect(await asRuntime(orgA, (tx) => readSealWitnesses(tx, orgA, doc))).toEqual([{ head, events: 4 }])
      const refused = await asRuntime(orgA, (tx) => inLegacyMode(() => readSealWitnesses(tx, orgA, doc))).then(() => null, causeOf)
      expect(refused).toMatch(/permission denied for schema audit_security/)
    })

    it('shows another organization nothing', async () => {
      expect(await asRuntime(orgB, (tx) => readSealWitnesses(tx, orgB, doc))).toEqual([])
    })

    it('leaves the signature trail itself unchangeable by the runtime role: no update, no delete', async () => {
      await expect(deniedBy(orgA, sql`UPDATE signature_audit_trail SET event_description = 'x' WHERE document_id = ${doc}::uuid`)).resolves.toBe(true)
      await expect(deniedBy(orgA, sql`DELETE FROM signature_audit_trail WHERE document_id = ${doc}::uuid`)).resolves.toBe(true)
    })
  })
})
