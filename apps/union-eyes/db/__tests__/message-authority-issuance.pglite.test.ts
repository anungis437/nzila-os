/**
 * A governance-review mandate, adopted and issued through the real ceremony,
 * places a conversation hold and records retention. An audit fault rolls each
 * write back. An executive title does not.
 *
 * In-process PostgreSQL with the authority schema and platform 0014 and 0025.
 * The combined-schema file message-lifecycle.postgres.test.ts repeats this
 * ceremony under real roles and RLS when UE_AUTHORITY_COMBINED_URL is set.
 * This run is not that proof and not a credentialed acceptance.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import { changeMandate } from '../../lib/authority/store/lifecycle'
import { adoptRetentionPolicy, readRetentionPolicy, setLegalHold } from '../../lib/messaging/thread-lifecycle'
import type { CaseActor } from '@/lib/cases/case-authorization'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { ORG, U } from './authority-kernel-harness'
import { freshDb, kit } from './authority-kernel-testkit'

const migration = (name: string) => readFileSync(resolve(__dirname, '..', 'migrations-platform', name), 'utf8')

const STUB = `
  CREATE TYPE message_status AS ENUM ('sent','delivered','read');
  CREATE TYPE message_type AS ENUM ('text','file','system');
  CREATE TABLE message_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject text NOT NULL, member_id text NOT NULL, staff_id text,
    organization_id uuid NOT NULL, status text NOT NULL DEFAULT 'open', priority text DEFAULT 'normal', category text,
    is_archived boolean DEFAULT false, last_message_at timestamp, created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    sender_id text NOT NULL, sender_role text NOT NULL, message_type message_type NOT NULL DEFAULT 'text', content text,
    file_url text, file_name text, file_size text, status message_status NOT NULL DEFAULT 'sent', read_at timestamp,
    is_edited boolean DEFAULT false, edited_at timestamp, metadata text, created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE in_app_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
    user_id text NOT NULL, organization_id uuid, title text, message text, type text NOT NULL DEFAULT 'info',
    action_label text, action_url text, data jsonb, read boolean NOT NULL DEFAULT false, read_at timestamp, expires_at timestamp);
  CREATE SCHEMA audit_security;
  CREATE TABLE audit_security.audit_logs(
    audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, user_id varchar(255),
    action varchar(100) NOT NULL, resource_type varchar(50) NOT NULL, resource_id uuid, old_values jsonb, new_values jsonb,
    ip_address varchar(45), user_agent text, session_id uuid, correlation_id uuid, severity varchar(20) DEFAULT 'info',
    outcome varchar(20) DEFAULT 'success', error_message text, metadata jsonb DEFAULT '{}'::jsonb,
    archived boolean NOT NULL DEFAULT false, archived_at timestamptz, archived_path text, created_at timestamptz DEFAULT now());
`

let pg: PGlite
let app: ReturnType<typeof drizzle>
let k: ReturnType<typeof kit>
let threadId = ''
let holdMandate = ''
let retentionMandate = ''

const person = (userId: string): CaseActor => ({ userId, organizationId: ORG, role: 'member' })
const asUser = <T>(userId: string, fn: (tx: RLSTx) => Promise<T>) =>
  app.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true), set_config('app.current_org_id', ${ORG}, true)`)
    return fn(tx as unknown as RLSTx)
  })
const count = async (text: string, params: unknown[] = []) => Number((await pg.query<{ n: string }>(text, params)).rows[0].n)
const expectAuditDenied = async (p: Promise<unknown>) => {
  const error = (await p.then(() => null, (e: unknown) => e)) as { message?: string; cause?: { message?: string } } | null
  expect(error, 'the audit write must refuse the transaction').not.toBeNull()
  expect(`${error!.message ?? ''} ${error!.cause?.message ?? ''}`).toMatch(/permission denied/)
}
const withoutAuditInsert = async (fn: () => Promise<void>) => {
  await k.asAdmin(() => pg.exec('REVOKE INSERT ON audit_security.audit_logs FROM union_eyes_runtime'))
  try {
    await fn()
  } finally {
    await k.asAdmin(() => pg.exec('GRANT INSERT ON audit_security.audit_logs TO union_eyes_runtime'))
  }
}

beforeAll(async () => {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  pg = await freshDb()
  k = kit(pg)
  await k.asAdmin(async () => {
    await pg.exec(STUB)
    for (const file of ['0014_message_thread_triage.sql', '0025_message_thread_lifecycle_and_retention.sql']) {
      for (const statement of migration(file).split('--> statement-breakpoint')) {
        if (statement.replace(/--.*$/gm, '').trim()) await pg.exec(statement)
      }
    }
    await pg.exec(`
      GRANT USAGE ON SCHEMA audit_security TO union_eyes_runtime;
      GRANT SELECT, INSERT ON message_threads, message_thread_lifecycle TO union_eyes_runtime;
      GRANT SELECT, INSERT, UPDATE ON message_retention_policies TO union_eyes_runtime;
      GRANT SELECT, INSERT ON audit_security.audit_logs TO union_eyes_runtime;
    `)
  })
  app = drizzle(pg)
  await k.adoptDefaultRules(ORG, (domain, operation) => domain === 'governance_review' && (operation === 'issue' || operation === 'revoke'))
  threadId = randomUUID()
  await k.asAdmin(() => pg.query(
    `INSERT INTO message_threads (id, subject, member_id, organization_id, status) VALUES ($1,$2,$3,$4,'open')`,
    [threadId, 'private subject', U.member, ORG],
  ))
  holdMandate = await k.grantMandate('governance_review', U.reviewer, ['place_legal_hold', 'release_legal_hold'], { scope: { resourceIds: [threadId] } })
  retentionMandate = await k.grantMandate('governance_review', U.reviewer, ['adopt_retention', 'read_retention_policy'], { scope: { resourceIds: [ORG] } })
}, 60_000)

afterAll(async () => {
  vi.unstubAllEnvs()
  await pg?.close()
})

describe('governance-review issuance authorizes a hold and a retention record', () => {
  it('denies an executive title and lets the mandate holder place a hold without auditing the reference', async () => {
    expect(await asUser(U.president, (tx) => setLegalHold(tx, person(U.president), threadId, 'place', 'HOLD-ISSUED-1'))).toEqual({ kind: 'forbidden' })
    expect(await count(`SELECT count(*)::text AS n FROM message_thread_lifecycle WHERE thread_id = $1`, [threadId])).toBe(0)
    expect(await asUser(U.reviewer, (tx) => setLegalHold(tx, person(U.reviewer), threadId, 'place', 'HOLD-ISSUED-1'))).toEqual({ kind: 'ok', held: true })
    const row = (await pg.query<{ reference: string; metadata: string }>(
      `SELECT l.reference, a.metadata::text AS metadata
         FROM message_thread_lifecycle l
         JOIN audit_security.audit_logs a ON a.resource_id = l.thread_id AND a.action = 'messages.thread.hold_place'
        WHERE l.thread_id = $1`,
      [threadId],
    )).rows[0]
    expect(row.reference).toBe('HOLD-ISSUED-1')
    expect(row.metadata).not.toContain('HOLD-ISSUED-1')
    expect(row.metadata).not.toContain('private subject')
  })

  it('rolls a release back when the audit insert is refused', async () => {
    await withoutAuditInsert(async () => {
      await expectAuditDenied(asUser(U.reviewer, (tx) => setLegalHold(tx, person(U.reviewer), threadId, 'release', 'HOLD-ISSUED-1')))
      expect((await pg.query(`SELECT action FROM message_thread_lifecycle WHERE thread_id = $1 ORDER BY seq`, [threadId])).rows.map((r) => r.action)).toEqual(['hold_place'])
    })
    expect(await asUser(U.reviewer, (tx) => setLegalHold(tx, person(U.reviewer), threadId, 'release', 'HOLD-ISSUED-1'))).toEqual({ kind: 'ok', held: false })
  })

  it('ends the hold power when that mandate is revoked', async () => {
    await k.as(U.president)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, mandateId: holdMandate, change: 'revoke' }))
    const before = await count(`SELECT count(*)::text AS n FROM message_thread_lifecycle WHERE thread_id = $1`, [threadId])
    expect(await asUser(U.reviewer, (tx) => setLegalHold(tx, person(U.reviewer), threadId, 'place', 'HOLD-ISSUED-2'))).toEqual({ kind: 'forbidden' })
    expect(await count(`SELECT count(*)::text AS n FROM message_thread_lifecycle WHERE thread_id = $1`, [threadId])).toBe(before)
  })

  it('records and reads retention for a mandate naming the organization, and rolls a failed audit back', async () => {
    expect(await asUser(U.president, (tx) => readRetentionPolicy(tx, person(U.president)))).toEqual({ kind: 'forbidden' })
    expect(await asUser(U.reviewer, (tx) => readRetentionPolicy(tx, person(U.reviewer)))).toEqual({ kind: 'ok', policy: null })
    const adopted = await asUser(U.reviewer, (tx) => adoptRetentionPolicy(tx, person(U.reviewer), {
      retentionDays: 30, policyReference: 'Policy issued', authorityReference: 'Resolution issued',
    }))
    expect(adopted).toMatchObject({ kind: 'ok', policy: { retentionDays: 30, policyReference: 'Policy issued' } })
    await withoutAuditInsert(async () => {
      await expectAuditDenied(asUser(U.reviewer, (tx) => adoptRetentionPolicy(tx, person(U.reviewer), {
        retentionDays: 60, policyReference: 'Policy refused', authorityReference: 'Resolution refused',
      })))
      const live = await pg.query<{ policy_reference: string; n: string }>(
        `SELECT policy_reference, count(*)::text AS n FROM message_retention_policies WHERE organization_id = $1 GROUP BY policy_reference`,
        [ORG],
      )
      expect(live.rows).toEqual([{ policy_reference: 'Policy issued', n: '1' }])
    })
    await k.as(U.president)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, mandateId: retentionMandate, change: 'revoke' }))
    expect(await asUser(U.reviewer, (tx) => readRetentionPolicy(tx, person(U.reviewer)))).toEqual({ kind: 'forbidden' })
  })
})
