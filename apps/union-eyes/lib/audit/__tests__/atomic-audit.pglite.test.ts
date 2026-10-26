import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '../atomic-audit'

const org = '11111111-1111-4111-8111-111111111111'
let pg: PGlite
let db: ReturnType<typeof drizzle>

const entry = (action: string) => ({
  organizationId: org,
  userId: 'actor',
  action,
  resourceType: 'policy_approval_actions',
  resourceId: randomUUID(),
  details: { decision: 'approved' },
})

beforeAll(async () => {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  pg = new PGlite()
  db = drizzle(pg)
  await pg.exec(`
    CREATE SCHEMA audit_security;
    CREATE TABLE audit_security.audit_logs(
      audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid, user_id varchar(255),
      action varchar(100) NOT NULL, resource_type varchar(50) NOT NULL, resource_id uuid,
      old_values jsonb, new_values jsonb, ip_address varchar(45), user_agent text, session_id uuid,
      correlation_id uuid, severity varchar(20) DEFAULT 'info', outcome varchar(20) DEFAULT 'success',
      error_message text, metadata jsonb DEFAULT '{}'::jsonb, archived boolean NOT NULL DEFAULT false,
      archived_at timestamptz, archived_path text, created_at timestamptz DEFAULT now(),
      CONSTRAINT valid_action CHECK (action != ''),
      CONSTRAINT valid_severity CHECK (severity IN ('debug','info','warning','error','critical')),
      CONSTRAINT valid_outcome CHECK (outcome IN ('success','failure','error'))
    );
    CREATE TABLE approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), decision text NOT NULL);
  `)
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await pg?.close()
})
beforeEach(async () => {
  await pg.exec('TRUNCATE approvals; TRUNCATE audit_security.audit_logs')
})

const counts = async () => ({
  approvals: Number((await pg.query<{ n: string }>('SELECT count(*) AS n FROM approvals')).rows[0].n),
  audits: Number((await pg.query<{ n: string }>('SELECT count(*) AS n FROM audit_security.audit_logs')).rows[0].n),
})

const approve = (auditEntry: ReturnType<typeof entry>, outcome: 'success' | 'failure' = 'success') =>
  db.transaction(async (tx) => {
    await tx.execute(sql`INSERT INTO approvals(decision) VALUES ('approved')`)
    await persistAtomicAudit(tx as unknown as RLSTx, auditEntry, outcome)
  })

describe('persistAtomicAudit outside canonical mode', () => {
  it('commits the mutation and its audit record together', async () => {
    await approve(entry('governance.policy_approval_action.create'))
    expect(await counts()).toEqual({ approvals: 1, audits: 1 })
    const row = (await pg.query<{ outcome: string; severity: string }>('SELECT outcome, severity FROM audit_security.audit_logs')).rows[0]
    expect(row).toMatchObject({ outcome: 'success', severity: 'info' })
  })

  it('records denials as failures', async () => {
    await approve(entry('governance.policy_approval.denied'), 'failure')
    const row = (await pg.query<{ outcome: string; severity: string }>('SELECT outcome, severity FROM audit_security.audit_logs')).rows[0]
    expect(row).toMatchObject({ outcome: 'failure', severity: 'warning' })
  })

  it('rolls the mutation back when the audit write fails', async () => {
    await expect(approve(entry(''))).rejects.toThrow()
    expect(await counts()).toEqual({ approvals: 0, audits: 0 })
  })

  it('keeps concurrent transactions independent: a failing audit rolls back only its own mutation', async () => {
    const results = await Promise.allSettled([
      approve(entry('governance.policy_approval_action.create')),
      approve(entry('')),
      approve(entry('governance.policy_approval_action.create')),
    ])
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
    expect(await counts()).toEqual({ approvals: 2, audits: 2 })
  })
})
