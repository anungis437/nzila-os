/**
 * The employer-execution pages' reads (lib/employer-execution/page-reads.ts) on real PostgreSQL, as the real roles.
 *
 * The pages used to read these nine tables through the module-level database handle. Outside a tenant transaction that handle is the pooled
 * connection with no organization, and row-level security then shows the runtime role nothing: every page rendered an empty list, or "not
 * found", while unit tests (which replace the database) and the CI runtime (which connects as a superuser) saw data. This runs the unmodified
 * read functions, with only the context boundary replaced by the harness's (a tenant transaction with app.current_org_id set), and proves that
 *   - an organization reads its own rows and not another organization's, for every list and every detail;
 *   - a detail asked for with another organization's id, or with something that is not a uuid, is "not found";
 *   - the same statements with no organization set (the old page behaviour) read nothing, which is why the context is required.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const reads = URL ? await import('@/lib/employer-execution/page-reads') : null
const schema = URL ? await import('@/db/schema') : null

describe.skipIf(!URL)('the employer-execution page reads on the combined schema, as the real roles', () => {
  const tag = `ee${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  let admin: pg.Client
  const ids = { runA1: '', runA2: '', runB: '', remitA: '', remitB: '', batchA: '', batchB: '' }

  const one = async (sql: string, params: unknown[]) => (await admin.query(sql, params)).rows[0].id as string

  const seedRun = (organizationId: string, code: string, createdAt: string) =>
    one(
      `INSERT INTO employer_payroll_runs (organization_id, run_code, period_start, period_end, engine_version, calc_trace_hash, created_at)
       VALUES ($1, $2, '2026-01-01', '2026-01-14', 'engine-1', $3, $4) RETURNING id::text AS id`,
      [organizationId, `${code}-${tag}`, `hash-${code}-${tag}`, createdAt],
    )
  const seedItem = (organizationId: string, runId: string, employee: string) =>
    admin.query(
      `INSERT INTO employer_payroll_run_items (organization_id, payroll_run_id, employee_external_id, remittance_group_key, trace_hash)
       VALUES ($1, $2, $3, 'group-1', $4)`,
      [organizationId, runId, employee, `trace-${employee}-${tag}`],
    )
  const seedEvent = (organizationId: string, code: string, detectedAt: string, runId: string | null = null, remittanceId: string | null = null) =>
    admin.query(
      `INSERT INTO employer_execution_compliance_events (organization_id, event_code, summary, detected_at, payroll_run_id, remittance_run_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [organizationId, `${code}-${tag}`, `summary ${code}`, detectedAt, runId, remittanceId],
    )
  const seedArtifact = (organizationId: string, name: string, runId: string | null, remittanceId: string | null, createdAt: string) =>
    admin.query(
      `INSERT INTO employer_execution_artifacts (organization_id, payroll_run_id, remittance_run_id, artifact_type, artifact_name, storage_ref, artifact_hash, created_at)
       VALUES ($1, $2, $3, 'summary', $4, 'ref', $5, $6)`,
      [organizationId, runId, remittanceId, `${name}-${tag}`, `ah-${name}-${tag}`, createdAt],
    )

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const [id, name] of [[ORG_A, 'A'], [ORG_B, 'B']]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1, $2, $3, 'local', '{}', 0, '{}', false, 0, 0, '{}', '{}', 'active', now(), now(), 1)`,
        [id, `Employer execution ${name} ${tag}`, `ee-${name.toLowerCase()}-${tag}`],
      )
    }

    ids.runA1 = await seedRun(ORG_A, 'A1', '2026-02-01T00:00:00Z')
    ids.runA2 = await seedRun(ORG_A, 'A2', '2026-03-01T00:00:00Z')
    ids.runB = await seedRun(ORG_B, 'B1', '2026-03-05T00:00:00Z')
    await seedItem(ORG_A, ids.runA2, `emp-a-${tag}`)
    await seedItem(ORG_B, ids.runB, `emp-b-${tag}`)
    await admin.query(
      `INSERT INTO employer_execution_replays (organization_id, source_payroll_run_id, source_engine_version, replay_engine_version, diff_hash, diff_json)
       VALUES ($1, $2, 'engine-1', 'engine-2', $3, '{"changed": true, "summary": "replay A"}'::jsonb)`,
      [ORG_A, ids.runA2, `diff-a-${tag}`],
    )
    await seedEvent(ORG_A, 'old', '2026-03-01T00:00:00Z', ids.runA2)
    await seedEvent(ORG_A, 'new', '2026-03-09T00:00:00Z', ids.runA2)
    await seedEvent(ORG_A, 'other-run', '2026-03-10T00:00:00Z', ids.runA1)
    await seedEvent(ORG_B, 'b-event', '2026-03-11T00:00:00Z', ids.runB)
    await seedArtifact(ORG_A, 'art-a-old', ids.runA2, null, '2026-03-01T00:00:00Z')
    await seedArtifact(ORG_A, 'art-a-new', ids.runA2, null, '2026-03-02T00:00:00Z')
    await seedArtifact(ORG_B, 'art-b', ids.runB, null, '2026-03-03T00:00:00Z')

    ids.remitA = await one(
      `INSERT INTO employer_remittance_runs (organization_id, payroll_run_id, run_code, period_start, period_end, due_date, source_revision_hash)
       VALUES ($1, $2, $3, '2026-01-01', '2026-01-14', '2026-02-15', $4) RETURNING id::text AS id`,
      [ORG_A, ids.runA2, `RA-${tag}`, 'a'.repeat(64)],
    )
    ids.remitB = await one(
      `INSERT INTO employer_remittance_runs (organization_id, payroll_run_id, run_code, period_start, period_end, due_date, source_revision_hash)
       VALUES ($1, $2, $3, '2026-01-01', '2026-01-14', '2026-02-15', $4) RETURNING id::text AS id`,
      [ORG_B, ids.runB, `RB-${tag}`, 'b'.repeat(64)],
    )
    await seedArtifact(ORG_A, 'remit-art-a', null, ids.remitA, '2026-03-04T00:00:00Z')
    await seedArtifact(ORG_B, 'remit-art-b', null, ids.remitB, '2026-03-04T00:00:00Z')
    await seedEvent(ORG_A, 'remit-event-a', '2026-03-12T00:00:00Z', null, ids.remitA)

    await admin.query(
      `INSERT INTO employer_execution_profiles (organization_id, profile_code, jurisdiction) VALUES ($1, $2, 'ON'), ($3, $4, 'BC')`,
      [ORG_A, `profile-a-${tag}`, ORG_B, `profile-b-${tag}`],
    )

    const employerOf = new Map<string, string>()
    for (const organizationId of [ORG_A, ORG_B]) {
      employerOf.set(
        organizationId,
        await one(`INSERT INTO employers (organization_id, name, employer_type) VALUES ($1, $2, 'private') RETURNING id::text AS id`, [organizationId, `Employer ${tag}`]),
      )
    }
    const batch = (organizationId: string, code: string, createdAt: string) =>
      one(
        `INSERT INTO employer_timesheet_batches (organization_id, employer_id, batch_code, source_file_name, source_file_hash, period_start, period_end, created_at)
         VALUES ($1, $2, $3, 'sheet.csv', $4, '2026-01-01', '2026-01-14', $5) RETURNING id::text AS id`,
        [organizationId, employerOf.get(organizationId), `${code}-${tag}`, `fh-${code}-${tag}`, createdAt],
      )
    const oldBatch = await batch(ORG_A, 'old', '2026-02-01T00:00:00Z')
    ids.batchA = await batch(ORG_A, 'new', '2026-03-01T00:00:00Z')
    ids.batchB = await batch(ORG_B, 'b', '2026-03-09T00:00:00Z')
    const entry = (organizationId: string, batchId: string, employee: string, row: number) =>
      admin.query(
        `INSERT INTO employer_timesheet_entries (organization_id, batch_id, employee_external_id, shift_date, row_number, source_row_hash)
         VALUES ($1, $2, $3, '2026-01-05', $4, $5)`,
        [organizationId, batchId, employee, row, `rh-${employee}-${row}-${tag}`],
      )
    await entry(ORG_A, oldBatch, `emp-old-${tag}`, 1)
    await entry(ORG_A, ids.batchA, `emp-new-1-${tag}`, 1)
    await entry(ORG_A, ids.batchA, `emp-new-2-${tag}`, 2)
    await entry(ORG_B, ids.batchB, `emp-b-${tag}`, 1)
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  const mine = <T extends Record<string, unknown>>(rows: T[], key: keyof T & string) => rows.filter((row) => String(row[key]).endsWith(`-${tag}`))

  it('lists an organization\'s payroll runs, newest first, and not another organization\'s', async () => {
    const asA = await reads!.listPayrollRuns(ORG_A)
    expect(asA.map((run) => run.id)).toEqual([ids.runA2, ids.runA1])
    const asB = await reads!.listPayrollRuns(ORG_B)
    expect(asB.map((run) => run.id)).toEqual([ids.runB])
  })

  it('shows one payroll run with its items, newest replay, compliance events and evidence, all of the organization\'s own', async () => {
    const detail = await reads!.loadPayrollRunDetail(ORG_A, ids.runA2)
    expect(detail?.run.id).toBe(ids.runA2)
    expect(detail?.items.map((item) => item.employeeExternalId)).toEqual([`emp-a-${tag}`])
    expect(detail?.latestReplay?.diffJson).toMatchObject({ changed: true, summary: 'replay A' })
    expect(detail?.complianceEvents.map((event) => event.eventCode)).toEqual([`new-${tag}`, `old-${tag}`])
    expect(detail?.artifacts.map((artifact) => artifact.artifactName)).toEqual([`art-a-new-${tag}`, `art-a-old-${tag}`])
  })

  it('answers "not found" for another organization\'s payroll run and for an id that is not a uuid', async () => {
    expect(await reads!.loadPayrollRunDetail(ORG_A, ids.runB)).toBeNull()
    expect(await reads!.loadPayrollRunDetail(ORG_B, ids.runA2)).toBeNull()
    expect(await reads!.loadPayrollRunDetail(ORG_A, 'not-a-uuid')).toBeNull()
    expect(await reads!.loadPayrollRunDetail(ORG_A, randomUUID())).toBeNull()
    expect((await reads!.loadPayrollRunDetail(ORG_B, ids.runB))?.items.map((item) => item.employeeExternalId)).toEqual([`emp-b-${tag}`])
  })

  it('lists compliance events newest first, bounded to the organization', async () => {
    const asA = mine(await reads!.listComplianceEvents(ORG_A), 'eventCode')
    expect(asA.map((event) => event.eventCode)).toEqual([`remit-event-a-${tag}`, `other-run-${tag}`, `new-${tag}`, `old-${tag}`])
    const asB = mine(await reads!.listComplianceEvents(ORG_B), 'eventCode')
    expect(asB.map((event) => event.eventCode)).toEqual([`b-event-${tag}`])
  })

  it('lists remittance runs and shows one with its evidence and compliance events, never across organizations', async () => {
    expect((await reads!.listRemittanceRuns(ORG_A)).map((run) => run.id)).toEqual([ids.remitA])
    expect((await reads!.listRemittanceRuns(ORG_B)).map((run) => run.id)).toEqual([ids.remitB])
    const detail = await reads!.loadRemittanceRunDetail(ORG_A, ids.remitA)
    expect(detail?.artifacts.map((artifact) => artifact.artifactName)).toEqual([`remit-art-a-${tag}`])
    expect(detail?.complianceEvents.map((event) => event.eventCode)).toEqual([`remit-event-a-${tag}`])
    expect(await reads!.loadRemittanceRunDetail(ORG_A, ids.remitB)).toBeNull()
    expect(await reads!.loadRemittanceRunDetail(ORG_A, 'nope')).toBeNull()
  })

  it('lists an organization\'s runtime profiles', async () => {
    expect((await reads!.listExecutionProfiles(ORG_A)).map((profile) => profile.profileCode)).toEqual([`profile-a-${tag}`])
    expect((await reads!.listExecutionProfiles(ORG_B)).map((profile) => profile.profileCode)).toEqual([`profile-b-${tag}`])
  })

  it('loads the newest timesheet batch with its own entries only, and nothing for an organization with no batch', async () => {
    const asA = await reads!.loadLatestTimesheetBatch(ORG_A)
    expect(asA.batch?.id).toBe(ids.batchA)
    expect(asA.entries.map((entry) => entry.employeeExternalId).sort()).toEqual([`emp-new-1-${tag}`, `emp-new-2-${tag}`])
    expect((await reads!.loadLatestTimesheetBatch(ORG_B)).batch?.id).toBe(ids.batchB)
    expect(await reads!.loadLatestTimesheetBatch(randomUUID())).toEqual({ batch: null, entries: [] })
  })

  it('control: the same tables read with no organization set show the runtime role nothing, which is why every page read needs its context', async () => {
    const withoutOrganization = await harness.tenant(RUNTIME_ROLE, null, null, async (tx) => ({
      runs: await tx.select().from(schema!.employerPayrollRuns),
      events: await tx.select().from(schema!.employerExecutionComplianceEvents),
      artifacts: await tx.select().from(schema!.employerExecutionArtifacts),
      remittances: await tx.select().from(schema!.employerRemittanceRuns),
      profiles: await tx.select().from(schema!.employerExecutionProfiles),
      batches: await tx.select().from(schema!.employerTimesheetBatches),
      entries: await tx.select().from(schema!.employerTimesheetEntries),
    }))
    expect(withoutOrganization).toEqual({ runs: [], events: [], artifacts: [], remittances: [], profiles: [], batches: [], entries: [] })
  })
})
