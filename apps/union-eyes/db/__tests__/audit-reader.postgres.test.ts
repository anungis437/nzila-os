/**
 * F06 R6 on real PostgreSQL — the audit reader under the real application roles.
 *
 * The reader was credited in B105 on mocked transactions. Natively the runtime role held only INSERT on the legacy
 * audit_security.audit_logs (FORCE RLS, one INSERT policy), so every list or read failed with "permission denied". Cache migration
 * 0045 adds the org-scoped SELECT; this test applies it and proves the reader against both stores as union_eyes_runtime.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasAuditedAction, listAuditEntries, readAuditEntry } from '@/lib/audit/audit-reader'
import { readSealWitnesses } from '@/lib/signature/seal-witness'

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

  // The application's own driver (postgres-js), so execute() returns rows the way the reader sees them in production.
  const asRuntime = async <T,>(org: string | null, fn: (tx: never) => Promise<T>): Promise<T> =>
    drizzle(client).transaction(async (tx) => {
      await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
      if (org) await tx.execute(sql`SELECT set_config('app.current_org_id', ${org}, true)`)
      return fn(tx as never)
    })
  const deniedBy = async (org: string, statement: ReturnType<typeof sql>) => {
    try {
      await asRuntime(org, async (tx) => { await (tx as { execute: (q: unknown) => Promise<unknown> }).execute(statement) })
    } catch (error) {
      const cause = (error as { cause?: { message?: string } }).cause?.message ?? (error as Error).message
      return /permission denied/i.test(cause)
    }
    return false
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
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL as string, { max: 4, onnotice: () => undefined })
    const migration = readFileSync(resolve(__dirname, '../migrations-cache/0045_audit_security_runtime_read.sql'), 'utf8')
    for (const statement of migration.split('--> statement-breakpoint')) await admin.query(statement)
    for (const org of [orgA, orgB]) {
      const slug = `ar-${org.slice(0, 8)}`
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1) ON CONFLICT (id) DO NOTHING`,
        [org, slug, slug],
      )
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

  it('lists only the organization\'s own legacy records, and never a platform row without an organization', async () => {
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    const rows = await asRuntime(orgA, (tx) => listAuditEntries(tx, orgA))
    expect(rows.map((r) => r.auditId)).toContain(legacyA)
    expect(rows.map((r) => r.auditId)).not.toContain(legacyB)
    expect(rows.map((r) => r.auditId)).not.toContain(orphan)
    expect(rows.every((r) => r.source === 'legacy')).toBe(true)
  })

  it('lists both stores in canonical mode, each isolated to the organization', async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    try {
      const rows = await asRuntime(orgA, (tx) => listAuditEntries(tx, orgA))
      const ids = rows.map((r) => r.auditId)
      expect(ids).toEqual(expect.arrayContaining([legacyA, canonA]))
      expect(ids).not.toContain(legacyB)
      expect(ids).not.toContain(canonB)
      expect(rows.find((r) => r.auditId === canonA)).toMatchObject({ source: 'canonical', severity: null, outcome: null, resourceId: 'r1' })
    } finally {
      delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    }
  })

  it('reads one record by id from either store, and answers null across organizations', async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    try {
      expect(await asRuntime(orgA, (tx) => readAuditEntry(tx, orgA, legacyA))).toMatchObject({ source: 'legacy', action: 'reader.legacy.a' })
      expect(await asRuntime(orgA, (tx) => readAuditEntry(tx, orgA, canonA))).toMatchObject({ source: 'canonical' })
      expect(await asRuntime(orgA, (tx) => readAuditEntry(tx, orgA, legacyB))).toBeNull()
      expect(await asRuntime(orgA, (tx) => readAuditEntry(tx, orgA, canonB))).toBeNull()
      // A caller who names another organization while running in its own tenant context still sees nothing.
      expect(await asRuntime(orgA, (tx) => readAuditEntry(tx, orgB, legacyB))).toBeNull()
    } finally {
      delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    }
  })

  it('answers whether an action was recorded, per organization and per store', async () => {
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    expect(await asRuntime(orgA, (tx) => hasAuditedAction(tx, orgA, 'reader.legacy.%'))).toBe(true)
    expect(await asRuntime(orgA, (tx) => hasAuditedAction(tx, orgA, 'reader.legacy.%', ['%.a']))).toBe(false)
    expect(await asRuntime(orgA, (tx) => hasAuditedAction(tx, orgA, 'reader.canonical.%'))).toBe(false)
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    try {
      expect(await asRuntime(orgA, (tx) => hasAuditedAction(tx, orgA, 'reader.canonical.%'))).toBe(true)
      expect(await asRuntime(orgB, (tx) => hasAuditedAction(tx, orgA, 'reader.canonical.%'))).toBe(false)
    } finally {
      delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    }
  })

  it('sees nothing without a tenant context', async () => {
    const rows = await asRuntime(null, (tx) => listAuditEntries(tx, orgA))
    expect(rows).toEqual([])
  })

  it('keeps the legacy sink append-only for the tenant: no update, no delete', async () => {
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

    it('reads the head and count from the legacy store, and from both stores in canonical mode', async () => {
      delete process.env.UE_CANONICAL_BOOTSTRAP_V2
      expect(await asRuntime(orgA, (tx) => readSealWitnesses(tx, orgA, doc))).toEqual([{ head, events: 4 }])
      process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
      try {
        expect(await asRuntime(orgA, (tx) => readSealWitnesses(tx, orgA, doc))).toEqual([{ head, events: 4 }, { head, events: 4 }])
      } finally {
        delete process.env.UE_CANONICAL_BOOTSTRAP_V2
      }
    })

    it('shows another organization nothing', async () => {
      process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
      try {
        expect(await asRuntime(orgB, (tx) => readSealWitnesses(tx, orgB, doc))).toEqual([])
      } finally {
        delete process.env.UE_CANONICAL_BOOTSTRAP_V2
      }
    })

    it('leaves the signature trail itself unchangeable by the runtime role: no update, no delete', async () => {
      await expect(deniedBy(orgA, sql`UPDATE signature_audit_trail SET event_description = 'x' WHERE document_id = ${doc}::uuid`)).resolves.toBe(true)
      await expect(deniedBy(orgA, sql`DELETE FROM signature_audit_trail WHERE document_id = ${doc}::uuid`)).resolves.toBe(true)
    })
  })
})
