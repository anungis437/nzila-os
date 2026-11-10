/**
 * Platform 0087 (verified dependency evidence bound to what its reviewer attested) on real PostgreSQL
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE, Family 1 final correction).
 *
 * Proves, on the database Django `migrate` plus the approved platform bootstrap builds:
 *   - ue_verified_dependency_evidence carries the five 0087 columns with the declared types, existing rows default to
 *     identity-key version 1, and every 0085-0087 CHECK is present and validated;
 *   - the database itself refuses: an attestation by the submitter, a partial attestation, an attestation or a
 *     document-integrity value on the wrong evidence type, an unknown identity-key version, a self-review, and a
 *     self-dependency - independently of application code;
 *   - 0087 is idempotent, its rollback removes exactly what it added, and re-applying restores it.
 *
 * Every case runs in a transaction that is rolled back. Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN
 * connection to a disposable, fully bootstrapped database.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const sqlOf = (file: string) => readFileSync(join(__dirname, '..', 'migrations-platform', file), 'utf8')
const UP = sqlOf('0087_verified_dependency_evidence_binding.sql')
const DOWN = sqlOf('0087_verified_dependency_evidence_binding.rollback.sql')

const ORG = '11111111-1111-4111-8111-111111111111'
const DOC = '33333333-3333-4333-8333-333333333333'

const COLUMNS: Array<[string, string, 'YES' | 'NO']> = [
  ['evidence_document_integrity', 'character varying', 'YES'],
  ['external_attestation', 'character varying', 'YES'],
  ['external_attested_by', 'text', 'YES'],
  ['external_attested_at', 'timestamp with time zone', 'YES'],
  ['identity_key_version', 'smallint', 'NO'],
]
const CHECKS = [
  'ue_verified_dependency_evidence_status_check',
  'ue_verified_dependency_evidence_not_self_dependent',
  'ue_verified_dependency_evidence_reviewer_distinct',
  'ue_verified_dependency_evidence_reference_type_check',
  'ue_verified_dependency_evidence_document_ref_consistent',
  'ue_verified_dependency_evidence_identity_key_version_check',
  'ue_verified_dependency_evidence_document_integrity_scope',
  'ue_verified_dependency_evidence_external_attestation_consistent',
]
const ADDED_CHECKS = CHECKS.slice(5)

describe.skipIf(!URL)('platform 0087 verified dependency evidence binding', () => {
  async function inTransaction<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
    const client = new pg.Client({ connectionString: URL })
    await client.connect()
    try {
      await client.query('BEGIN')
      return await run(client)
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      await client.end()
    }
  }

  /** Runs one statement under a savepoint and reports whether PostgreSQL refused it with a CHECK violation (23514). */
  async function refused(client: pg.Client, statement: string, params: unknown[] = []): Promise<boolean> {
    await client.query('SAVEPOINT attempt')
    try {
      await client.query(statement, params)
      await client.query('RELEASE SAVEPOINT attempt')
      return false
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT attempt')
      if ((error as { code?: string }).code !== '23514') throw error
      return true
    }
  }

  const columns = async (client: pg.Client) =>
    (
      await client.query<{ column_name: string; data_type: string; is_nullable: 'YES' | 'NO' }>(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ue_verified_dependency_evidence' AND column_name = ANY($1)
          ORDER BY array_position($1::text[], column_name::text)`,
        [COLUMNS.map(([name]) => name)],
      )
    ).rows.map((r) => [r.column_name, r.data_type, r.is_nullable])
  const checks = async (client: pg.Client, names: string[]) =>
    (
      await client.query<{ conname: string; convalidated: boolean }>(
        `SELECT conname, convalidated FROM pg_constraint
          WHERE conrelid = 'public.ue_verified_dependency_evidence'::regclass AND contype = 'c' AND conname = ANY($1) ORDER BY conname`,
        [names],
      )
    ).rows

  const insertExternal = (client: pg.Client) =>
    client.query<{ id: string; identity_key_version: number }>(
      `INSERT INTO public.ue_verified_dependency_evidence
         (organization_id, dependent_node_id, depends_on_node_id, process_or_system, responsible_authority, evidence_reference, submitted_by)
       VALUES ($1, 'a', 'b', 'p', 'r', 'e', 'submitter')
       RETURNING id, identity_key_version`,
      [ORG],
    )

  it('carries the 0087 columns, defaults existing rows to identity-key version 1, and every CHECK is validated', async () => {
    await inTransaction(async (client) => {
      expect(await columns(client)).toEqual(COLUMNS)
      const row = (await insertExternal(client)).rows[0]
      expect(row.identity_key_version).toBe(1)
      expect(await checks(client, CHECKS)).toEqual([...CHECKS].sort().map((conname) => ({ conname, convalidated: true })))
    })
  })

  it('refuses at the database layer what the application must never write', async () => {
    await inTransaction(async (client) => {
      const id = (await insertExternal(client)).rows[0].id
      const update = (set: string) => refused(client, `UPDATE public.ue_verified_dependency_evidence SET ${set} WHERE id = $1::uuid`, [id])
      expect(await update(`external_attestation = 'x', external_attested_by = 'submitter', external_attested_at = now()`)).toBe(true)
      expect(await update(`external_attestation = 'x'`)).toBe(true)
      expect(await update(`external_attestation = '   ', external_attested_by = 'reviewer', external_attested_at = now()`)).toBe(true)
      expect(await update(`evidence_document_integrity = 'sha256:x'`)).toBe(true)
      expect(await update(`identity_key_version = 3`)).toBe(true)
      expect(await update(`status = 'verified', reviewed_by = 'submitter'`)).toBe(true)
      expect(await update(`depends_on_node_id = 'a'`)).toBe(true)
      // The accepted shape: attested by someone other than the submitter, all three fields together.
      expect(await update(`external_attestation = 'checked clause 14.2', external_attested_by = 'reviewer', external_attested_at = now(), identity_key_version = 2`)).toBe(false)

      const doc = await client.query<{ id: string }>(
        `INSERT INTO public.ue_verified_dependency_evidence
           (organization_id, dependent_node_id, depends_on_node_id, process_or_system, responsible_authority, evidence_reference, submitted_by,
            evidence_reference_type, evidence_document_id, evidence_document_integrity)
         VALUES ($1, 'a', 'b', 'p', 'r', 'e', 'submitter', 'document', $2, 'sha256:abc') RETURNING id`,
        [ORG, DOC],
      )
      expect(
        await refused(client, `UPDATE public.ue_verified_dependency_evidence SET external_attestation = 'x', external_attested_by = 'reviewer', external_attested_at = now() WHERE id = $1::uuid`, [doc.rows[0].id]),
      ).toBe(true)
    })
  })

  it('is idempotent, and its rollback removes exactly what it added', async () => {
    await inTransaction(async (client) => {
      await client.query(UP)
      expect(await columns(client)).toEqual(COLUMNS)
      expect((await checks(client, ADDED_CHECKS)).map((c) => c.conname)).toEqual([...ADDED_CHECKS].sort())

      await client.query(DOWN)
      expect(await columns(client)).toEqual([])
      expect(await checks(client, ADDED_CHECKS)).toEqual([])
      // The 0085/0086 constraints are untouched by the rollback.
      expect((await checks(client, CHECKS.slice(0, 5))).map((c) => c.conname)).toEqual([...CHECKS.slice(0, 5)].sort())

      await client.query(UP)
      expect(await columns(client)).toEqual(COLUMNS)
      expect(await checks(client, ADDED_CHECKS)).toEqual([...ADDED_CHECKS].sort().map((conname) => ({ conname, convalidated: true })))
    })
  })
})
