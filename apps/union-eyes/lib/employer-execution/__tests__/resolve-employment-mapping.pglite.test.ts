import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { resolveEmploymentMapping } from '../resolve-employment-mapping'

// Minimal fixture schema: only the columns resolveEmploymentMapping's queries touch, no FK
// constraints (this is a unit test of the function's own logic, not of referential integrity).
// vi.mock factories (and vi.hoisted itself) are hoisted above this file's own imports too (vitest
// transforms them into variables the same way), so drizzle-orm/pg-core must be required here rather
// than imported at the top - matches the require('zod') pattern used elsewhere in this codebase for
// the same reason.
const { schema } = vi.hoisted(() => {
  const {
    boolean,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid,
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must be required, not imported: see comment above
  } = require('drizzle-orm/pg-core') as typeof import('drizzle-orm/pg-core')

  const employerTimesheetBatches = pgTable('employer_timesheet_batches', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    employerId: uuid('employer_id'),
  })
  const employerTimesheetEntries = pgTable('employer_timesheet_entries', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    batchId: uuid('batch_id').notNull(),
    employeeExternalId: text('employee_external_id').notNull(),
    memberEmploymentId: uuid('member_employment_id'),
    jobClassificationId: uuid('job_classification_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  })
  const employerPayrollRuns = pgTable('employer_payroll_runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sourceBatchId: uuid('source_batch_id'),
  })
  const employerExecutionComplianceEvents = pgTable('employer_execution_compliance_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    payrollRunId: uuid('payroll_run_id'),
    eventCode: text('event_code').notNull(),
    status: text('status').notNull(),
    blocking: text('blocking').notNull().default('no'),
    severity: text('severity').notNull().default('warning'),
    summary: text('summary').notNull().default(''),
    details: jsonb('details').notNull().default({}),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  })
  const memberEmployment = pgTable('member_employment', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    employerId: uuid('employer_id'),
  })
  const jobClassifications = pgTable('job_classifications', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
  })
  const auditLog = pgTable('audit_log', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    details: jsonb('details').notNull().default({}),
    success: boolean('success').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  })

  return {
    schema: {
      employerTimesheetBatches,
      employerTimesheetEntries,
      employerPayrollRuns,
      employerExecutionComplianceEvents,
      memberEmployment,
      jobClassifications,
      auditLog,
    },
  }
})

const {
  employerTimesheetBatches,
  employerTimesheetEntries,
  employerPayrollRuns,
  employerExecutionComplianceEvents,
  memberEmployment,
  jobClassifications,
  auditLog,
} = schema

vi.mock('@/db/schema', () => schema)
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (tx: ReturnType<typeof drizzle>, entry: Record<string, unknown>) => {
    await tx.insert(auditLog).values({
      organizationId: entry.organizationId as string,
      userId: entry.userId as string,
      action: entry.action as string,
      resourceType: entry.resourceType as string,
      resourceId: entry.resourceId as string,
      details: entry.details as Record<string, unknown>,
    })
  },
}))

const ORG = '11111111-1111-4111-8111-111111111111'
const EMPLOYER_A = '22222222-2222-4222-8222-222222222222'
const EMPLOYER_B = '33333333-3333-4333-8333-333333333333'

let client: PGlite
let db: ReturnType<typeof drizzle>

beforeEach(async () => {
  client = new PGlite()
  db = drizzle(client, { schema })
  await client.exec(`
    CREATE TABLE employer_timesheet_batches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, employer_id uuid);
    CREATE TABLE employer_timesheet_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, batch_id uuid NOT NULL,
      employee_external_id text NOT NULL, member_employment_id uuid, job_classification_id uuid,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE employer_payroll_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, source_batch_id uuid);
    CREATE TABLE employer_execution_compliance_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, payroll_run_id uuid,
      event_code text NOT NULL, status text NOT NULL, blocking text NOT NULL DEFAULT 'no',
      severity text NOT NULL DEFAULT 'warning', summary text NOT NULL DEFAULT '', details jsonb NOT NULL DEFAULT '{}',
      resolved_at timestamptz, resolved_by text, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE member_employment (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, employer_id uuid);
    CREATE TABLE job_classifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL);
    CREATE TABLE audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, user_id text NOT NULL,
      action text NOT NULL, resource_type text NOT NULL, resource_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
      success boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
    );
  `)
})

afterEach(async () => {
  await client.close()
})

describe('resolveEmploymentMapping (DEF-0B6-EMP-OFFICIAL-APPROVAL-UNREACHABLE)', () => {
  it('writes memberEmploymentId/jobClassificationId onto every entry sharing the mapped externalId, and resolves the open critical event once none remain unmapped', async () => {
    const [batch] = await db.insert(employerTimesheetBatches).values({ organizationId: ORG, employerId: EMPLOYER_A }).returning()
    const [employment] = await db.insert(memberEmployment).values({ organizationId: ORG, employerId: EMPLOYER_A }).returning()
    const [classification] = await db.insert(jobClassifications).values({ organizationId: ORG }).returning()
    await db.insert(employerTimesheetEntries).values([
      { organizationId: ORG, batchId: batch!.id, employeeExternalId: 'EMP-100' },
      { organizationId: ORG, batchId: batch!.id, employeeExternalId: 'EMP-100' }, // a second shift for the same external id
    ])
    const [run] = await db.insert(employerPayrollRuns).values({ organizationId: ORG, sourceBatchId: batch!.id }).returning()
    const [event] = await db.insert(employerExecutionComplianceEvents).values({
      organizationId: ORG, payrollRunId: run!.id, eventCode: 'missing_employment_mapping', status: 'open', blocking: 'yes', severity: 'critical',
    }).returning()

    const result = await resolveEmploymentMapping(db, {
      organizationId: ORG, userId: 'user-1', batchId: batch!.id,
      mappings: [{ employeeExternalId: 'EMP-100', memberEmploymentId: employment!.id, jobClassificationId: classification!.id }],
    })

    expect(result.results).toEqual([{ employeeExternalId: 'EMP-100', entriesUpdated: 2 }])
    expect(result.resolvedEventCount).toBe(1)

    const entries = await db.select().from(employerTimesheetEntries).where(eq(employerTimesheetEntries.batchId, batch!.id))
    for (const row of entries) {
      expect(row.memberEmploymentId).toBe(employment!.id)
      expect(row.jobClassificationId).toBe(classification!.id)
    }
    const [resolvedEvent] = await db.select().from(employerExecutionComplianceEvents).where(eq(employerExecutionComplianceEvents.id, event!.id))
    expect(resolvedEvent!.status).toBe('resolved')
    expect(resolvedEvent!.resolvedBy).toBe('user-1')

    const [audit] = await db.select().from(auditLog)
    expect(audit!.action).toBe('employer_execution.timesheet_batch.resolve_employment_mapping')
  })

  it('leaves the compliance event open, and leaves other external ids unmapped, when only some external ids are mapped (unresolved matches safely held for review)', async () => {
    const [batch] = await db.insert(employerTimesheetBatches).values({ organizationId: ORG, employerId: EMPLOYER_A }).returning()
    const [employment] = await db.insert(memberEmployment).values({ organizationId: ORG, employerId: EMPLOYER_A }).returning()
    await db.insert(employerTimesheetEntries).values([
      { organizationId: ORG, batchId: batch!.id, employeeExternalId: 'EMP-100' },
      { organizationId: ORG, batchId: batch!.id, employeeExternalId: 'EMP-101' },
    ])
    const [run] = await db.insert(employerPayrollRuns).values({ organizationId: ORG, sourceBatchId: batch!.id }).returning()
    await db.insert(employerExecutionComplianceEvents).values({
      organizationId: ORG, payrollRunId: run!.id, eventCode: 'missing_employment_mapping', status: 'open', blocking: 'yes', severity: 'critical',
    })

    const result = await resolveEmploymentMapping(db, {
      organizationId: ORG, userId: 'user-1', batchId: batch!.id,
      mappings: [{ employeeExternalId: 'EMP-100', memberEmploymentId: employment!.id }],
    })

    expect(result.resolvedEventCount).toBe(0)
    const [stillOpen] = await db.select().from(employerExecutionComplianceEvents)
    expect(stillOpen!.status).toBe('open')
    const [unmapped] = await db.select().from(employerTimesheetEntries).where(eq(employerTimesheetEntries.employeeExternalId, 'EMP-101'))
    expect(unmapped!.memberEmploymentId).toBeNull()
  })

  it('refuses a memberEmploymentId that does not exist in this organization, and writes nothing', async () => {
    const [batch] = await db.insert(employerTimesheetBatches).values({ organizationId: ORG, employerId: EMPLOYER_A }).returning()
    await db.insert(employerTimesheetEntries).values({ organizationId: ORG, batchId: batch!.id, employeeExternalId: 'EMP-100' })

    await expect(resolveEmploymentMapping(db, {
      organizationId: ORG, userId: 'user-1', batchId: batch!.id,
      mappings: [{ employeeExternalId: 'EMP-100', memberEmploymentId: '99999999-9999-4999-8999-999999999999' }],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })

    const [entry] = await db.select().from(employerTimesheetEntries)
    expect(entry!.memberEmploymentId).toBeNull()
  })

  it('refuses a memberEmploymentId belonging to a different employer than the batch', async () => {
    const [batch] = await db.insert(employerTimesheetBatches).values({ organizationId: ORG, employerId: EMPLOYER_A }).returning()
    const [employment] = await db.insert(memberEmployment).values({ organizationId: ORG, employerId: EMPLOYER_B }).returning()
    await db.insert(employerTimesheetEntries).values({ organizationId: ORG, batchId: batch!.id, employeeExternalId: 'EMP-100' })

    await expect(resolveEmploymentMapping(db, {
      organizationId: ORG, userId: 'user-1', batchId: batch!.id,
      mappings: [{ employeeExternalId: 'EMP-100', memberEmploymentId: employment!.id }],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('refuses a request that maps the same employeeExternalId twice', async () => {
    const [batch] = await db.insert(employerTimesheetBatches).values({ organizationId: ORG, employerId: EMPLOYER_A }).returning()
    const [employmentOne] = await db.insert(memberEmployment).values({ organizationId: ORG, employerId: EMPLOYER_A }).returning()
    const [employmentTwo] = await db.insert(memberEmployment).values({ organizationId: ORG, employerId: EMPLOYER_A }).returning()

    await expect(resolveEmploymentMapping(db, {
      organizationId: ORG, userId: 'user-1', batchId: batch!.id,
      mappings: [
        { employeeExternalId: 'EMP-100', memberEmploymentId: employmentOne!.id },
        { employeeExternalId: 'EMP-100', memberEmploymentId: employmentTwo!.id },
      ],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('refuses when the batch does not exist in this organization', async () => {
    await expect(resolveEmploymentMapping(db, {
      organizationId: ORG, userId: 'user-1', batchId: '99999999-9999-4999-8999-999999999999',
      mappings: [{ employeeExternalId: 'EMP-100', memberEmploymentId: '88888888-8888-4888-8888-888888888888' }],
    })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
