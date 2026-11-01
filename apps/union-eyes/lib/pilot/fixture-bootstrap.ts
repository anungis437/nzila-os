/**
 * The CUPE pilot bootstrap: what it creates, what it records about it, and what a reset may delete.
 *
 * Authority is split the way the rest of the application splits it. The platform phase runs as the system role and does only what that
 * role is granted: find or create the organization and write its marker, the way POST /api/organizations creates one. The tenant phase
 * runs as the runtime role bound to the fixture organization, so the members, grievances, checklist row, events and ledger are written
 * under the same row-level security as any other tenant data, and the system role never writes a member or a grievance.
 *
 * Every row the bootstrap creates is recorded in pilot_fixture_rows at the moment it is created. A reset deletes exactly the rows the ledger
 * names and refuses when the organization holds any row it does not (lib/pilot/fixture-plan.ts). A dry run executes the same code as the
 * real run inside a savepoint that is rolled back, so what it reports is what the run would do.
 */
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { pilotChecklistItems, pilotEvents } from '@/db/schema'
import { organizationMembers, organizations } from '@/db/schema-organizations'
import { grievances } from '@/db/schema/domains/claims/grievances'
import { pilotFixtureRows } from '@/db/schema/domains/pilot/pilot-fixture-rows'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { CUPE_BOOTSTRAP_SOURCE, summarizePilotOnboarding } from '@/lib/pilot/cupe-bootstrap-report'
import { partitionFixtureEntries, planFixtureReset, type FixtureResetPlan } from '@/lib/pilot/fixture-plan'

export const DEFAULT_FIXTURE_SLUG = 'cupe-local-123'
// Only this canonical checklist item is evidenced by the bootstrap; the other onboarding tasks stay pending.
const BOOTSTRAP_CHECKLIST_ITEM = 'org-seeded'
const FIXTURE_RELATIVE_PATH = 'fixtures/cupe/pilot-org/cupe-pilot-setup.json'

const text = (max: number) => z.string().trim().min(1).max(max)

export const cupeFixtureSchema = z
  .object({
    org: z.object({
      name: text(255),
      slug: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'the organization slug must be lowercase letters, digits and hyphens')
        .optional(),
    }),
    members: z
      .array(
        z.object({
          id: text(255),
          first_name: text(120),
          last_name: text(120),
          email: z.string().trim().email().max(255),
          role: text(64),
          member_number: text(64).optional(),
        }),
      )
      .max(500),
    cases: z
      .array(
        z.object({
          number: text(50),
          case_type: text(64),
          status: text(64),
          priority: z.string().trim().max(32).optional(),
          title: text(500),
          description: text(20000),
          filed_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'filed_at must be a date').optional(),
          filed_by: text(255),
        }),
      )
      .max(500),
    worksites: z.array(z.object({ id: text(255) })).max(500),
  })
  .superRefine((fixture, ctx) => {
    const repeats = (values: string[]) => values.length !== new Set(values).size
    if (repeats(fixture.members.map((member) => member.id))) ctx.addIssue({ code: 'custom', message: 'member ids must be unique', path: ['members'] })
    if (repeats(fixture.cases.map((entry) => entry.number))) ctx.addIssue({ code: 'custom', message: 'case numbers must be unique', path: ['cases'] })
  })

export type CupeFixture = z.infer<typeof cupeFixtureSchema>

export const fixtureSlug = (fixture: CupeFixture): string => fixture.org.slug ?? DEFAULT_FIXTURE_SLUG

export class FixtureUnavailableError extends Error {}

/** The fixture sits at the repository root; the application may be started from there or from apps/union-eyes. */
export async function loadCupeFixture(cwd: string = process.cwd()): Promise<CupeFixture> {
  const path = [cwd, resolve(cwd, '..', '..')].map((root) => resolve(root, FIXTURE_RELATIVE_PATH)).find((candidate) => existsSync(candidate))
  if (!path) throw new FixtureUnavailableError('The pilot fixture file was not found beside the application or at the repository root')
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(path, 'utf-8'))
  } catch {
    throw new FixtureUnavailableError('The pilot fixture file could not be read as JSON')
  }
  const parsed = cupeFixtureSchema.safeParse(raw)
  if (!parsed.success) throw new FixtureUnavailableError(`The pilot fixture file is not valid: ${parsed.error.issues[0]?.message ?? 'unknown problem'}`)
  return parsed.data
}

type GrievanceInsert = typeof grievances.$inferInsert

const GRIEVANCE_TYPE: Record<string, GrievanceInsert['type']> = {
  wage_dispute: 'contract',
  harassment: 'harassment',
  discipline: 'discipline',
  benefits_denial: 'contract',
}
const GRIEVANCE_STATUS: Record<string, NonNullable<GrievanceInsert['status']>> = {
  settled: 'settled',
  investigating: 'investigating',
  acknowledged: 'acknowledged',
}
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent'])

export const grievanceTypeFor = (caseType: string): GrievanceInsert['type'] => GRIEVANCE_TYPE[caseType] ?? 'other'
export const grievanceStatusFor = (status: string): NonNullable<GrievanceInsert['status']> => GRIEVANCE_STATUS[status] ?? 'filed'
export const grievancePriorityFor = (priority: string | undefined): NonNullable<GrievanceInsert['priority']> =>
  priority !== undefined && PRIORITIES.has(priority) ? (priority as NonNullable<GrievanceInsert['priority']>) : 'medium'

// Serializes bootstraps of one organization: the physical member table carries no unique (organization, user) index, so two concurrent
// seeds would both pass the "already there" check and insert the same member twice.
async function lock(tx: RLSTx, key: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
}

export interface FixtureDenial {
  organizationId: string
  userId: string
  runtimeMode: string
  reason: 'not_a_fixture_organization' | 'foreign_rows' | 'dependent_rows' | 'membership_required'
  details?: Record<string, unknown>
}

export async function recordFixtureDenial(tx: RLSTx, denial: FixtureDenial): Promise<void> {
  await persistAtomicAudit(
    tx,
    {
      organizationId: denial.organizationId,
      userId: denial.userId,
      action: 'pilot.bootstrap.cupe.denied',
      resourceType: 'organizations',
      resourceId: denial.organizationId,
      details: { reason: denial.reason, runtimeMode: denial.runtimeMode, ...denial.details },
    },
    'failure',
  )
}

export type FixtureOrganizationResolution =
  | { kind: 'ready'; organizationId: string; created: boolean }
  | { kind: 'would_create' }
  | { kind: 'refused'; reason: 'not_a_fixture_organization'; organizationId: string }

/**
 * Platform phase (system role, one transaction). An organization at the fixture slug is a fixture only if the ledger says the bootstrap
 * created it; a slug that merely matches proves nothing, and the organization is refused with the refusal recorded.
 */
export async function resolveFixtureOrganization(
  tx: RLSTx,
  args: { slug: string; name: string; userId: string; dryRun: boolean; runtimeMode: string },
): Promise<FixtureOrganizationResolution> {
  await lock(tx, `pilot-fixture-org:${args.slug}`)
  const [existing] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, args.slug)).limit(1)

  if (existing) {
    const [marker] = await tx
      .select({ id: pilotFixtureRows.id })
      .from(pilotFixtureRows)
      .where(
        and(
          eq(pilotFixtureRows.organizationId, existing.id),
          eq(pilotFixtureRows.resourceType, 'organization'),
          eq(pilotFixtureRows.resourceId, existing.id),
          eq(pilotFixtureRows.fixtureSource, CUPE_BOOTSTRAP_SOURCE),
        ),
      )
      .limit(1)
    if (marker) return { kind: 'ready', organizationId: existing.id, created: false }
    await recordFixtureDenial(tx, {
      organizationId: existing.id,
      userId: args.userId,
      runtimeMode: args.runtimeMode,
      reason: 'not_a_fixture_organization',
    })
    return { kind: 'refused', reason: 'not_a_fixture_organization', organizationId: existing.id }
  }

  if (args.dryRun) return { kind: 'would_create' }

  const [created] = await tx
    .insert(organizations)
    .values({ name: args.name, slug: args.slug, organizationType: 'local', hierarchyPath: [] })
    .returning({ id: organizations.id })
  await tx.insert(pilotFixtureRows).values({
    organizationId: created.id,
    fixtureSource: CUPE_BOOTSTRAP_SOURCE,
    resourceType: 'organization',
    resourceId: created.id,
    seededBy: args.userId,
  })
  await persistAtomicAudit(tx, {
    organizationId: created.id,
    userId: args.userId,
    action: 'pilot.bootstrap.cupe.organization_created',
    resourceType: 'organizations',
    resourceId: created.id,
    details: { slug: args.slug, runtimeMode: args.runtimeMode },
  })
  return { kind: 'ready', organizationId: created.id, created: true }
}

export interface FixtureCounts {
  members: number
  grievances: number
}

export interface FixtureApplyArgs {
  organizationId: string
  userId: string
  fixture: CupeFixture
  reset: boolean
  dryRun: boolean
  organizationCreated: boolean
  runtimeMode: string
}

export interface FixtureOutcome {
  removed: FixtureCounts
  clearedStale: FixtureCounts
  seeded: { members: number; cases: number }
  alreadyPresent: { members: number; cases: number }
  caseNumbersInUse: number
  onboarding: ReturnType<typeof summarizePilotOnboarding>
}

export type FixtureApplyResult =
  | { kind: 'refused'; reason: 'foreign_rows'; foreign: FixtureCounts }
  | { kind: 'refused'; reason: 'dependent_rows'; constraint: string | null }
  | ({ kind: 'done'; dryRun: boolean } & FixtureOutcome)

class DryRunRollback extends Error {
  constructor(readonly outcome: FixtureOutcome) {
    super('dry run rolled back')
  }
}

function postgresError(error: unknown): { code?: string; constraint: string | null } {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause]
  for (const candidate of candidates) {
    const e = candidate as { code?: unknown; constraint_name?: unknown; constraint?: unknown } | null
    if (typeof e?.code === 'string') {
      const constraint = e.constraint_name ?? e.constraint
      return { code: e.code, constraint: typeof constraint === 'string' ? constraint : null }
    }
  }
  return { constraint: null }
}

async function readLedger(tx: RLSTx, organizationId: string) {
  const rows = await tx
    .select({ type: pilotFixtureRows.resourceType, id: pilotFixtureRows.resourceId })
    .from(pilotFixtureRows)
    .where(
      and(
        eq(pilotFixtureRows.organizationId, organizationId),
        eq(pilotFixtureRows.fixtureSource, CUPE_BOOTSTRAP_SOURCE),
        inArray(pilotFixtureRows.resourceType, ['organization_member', 'grievance']),
      ),
    )
  return {
    members: rows.filter((row) => row.type === 'organization_member').map((row) => row.id),
    grievances: rows.filter((row) => row.type === 'grievance').map((row) => row.id),
  }
}

async function readPresent(tx: RLSTx, organizationId: string, ledger: { members: string[]; grievances: string[] }) {
  const members = ledger.members.length
    ? await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, organizationId), inArray(organizationMembers.id, ledger.members)))
    : []
  const held = ledger.grievances.length
    ? await tx
        .select({ id: grievances.id })
        .from(grievances)
        .where(and(eq(grievances.organizationId, organizationId), inArray(grievances.id, ledger.grievances)))
    : []
  return { members: members.map((row) => row.id), grievances: held.map((row) => row.id) }
}

// Counted in the database, so an organization that is not a small fixture cannot make the check load its rows.
async function countForeign(tx: RLSTx, organizationId: string): Promise<FixtureCounts> {
  const [members] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        sql`NOT EXISTS (SELECT 1 FROM ${pilotFixtureRows} f WHERE f.organization_id = ${organizationMembers.organizationId} AND f.resource_type = 'organization_member' AND f.resource_id = ${organizationMembers.id})`,
      ),
    )
  const [held] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(grievances)
    .where(
      and(
        eq(grievances.organizationId, organizationId),
        sql`NOT EXISTS (SELECT 1 FROM ${pilotFixtureRows} f WHERE f.organization_id = ${grievances.organizationId} AND f.resource_type = 'grievance' AND f.resource_id = ${grievances.id})`,
      ),
    )
  return { members: members?.n ?? 0, grievances: held?.n ?? 0 }
}

async function deleteLedgerRows(tx: RLSTx, organizationId: string, type: 'organization_member' | 'grievance', ids: string[]) {
  if (!ids.length) return
  await tx
    .delete(pilotFixtureRows)
    .where(and(eq(pilotFixtureRows.organizationId, organizationId), eq(pilotFixtureRows.resourceType, type), inArray(pilotFixtureRows.resourceId, ids)))
}

async function mutate(tx: RLSTx, args: FixtureApplyArgs, plan: FixtureResetPlan): Promise<FixtureOutcome> {
  const { organizationId, userId, fixture } = args
  const removed: FixtureCounts = { members: 0, grievances: 0 }
  const clearedStale: FixtureCounts = { members: 0, grievances: 0 }

  if (args.reset) {
    if (plan.remove.grievances.length) {
      const gone = await tx
        .delete(grievances)
        .where(and(eq(grievances.organizationId, organizationId), inArray(grievances.id, plan.remove.grievances)))
        .returning({ id: grievances.id })
      removed.grievances = gone.length
    }
    if (plan.remove.members.length) {
      const gone = await tx
        .delete(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, organizationId), inArray(organizationMembers.id, plan.remove.members)))
        .returning({ id: organizationMembers.id })
      removed.members = gone.length
    }
    await deleteLedgerRows(tx, organizationId, 'organization_member', [...plan.remove.members, ...plan.stale.members])
    await deleteLedgerRows(tx, organizationId, 'grievance', [...plan.remove.grievances, ...plan.stale.grievances])
    clearedStale.members = plan.stale.members.length
    clearedStale.grievances = plan.stale.grievances.length
  }

  const fixtureUserIds = fixture.members.map((member) => member.id)
  const heldUserIds = new Set(
    fixtureUserIds.length
      ? (
          await tx
            .select({ userId: organizationMembers.userId })
            .from(organizationMembers)
            .where(and(eq(organizationMembers.organizationId, organizationId), inArray(organizationMembers.userId, fixtureUserIds)))
        ).map((row) => row.userId)
      : [],
  )
  const members = partitionFixtureEntries(fixture.members, (member) => member.id, heldUserIds)
  const memberRows = members.create.map((member) => ({
    id: randomUUID(),
    userId: member.id,
    organizationId,
    name: `${member.first_name} ${member.last_name}`,
    email: member.email,
    role: member.role,
    status: 'active',
    membershipNumber: member.member_number,
  }))
  const insertedMembers = memberRows.length
    ? await tx.insert(organizationMembers).values(memberRows).returning({ id: organizationMembers.id })
    : []

  const fixtureNumbers = fixture.cases.map((entry) => entry.number)
  const heldNumbers = new Set(
    fixtureNumbers.length
      ? (
          await tx
            .select({ number: grievances.grievanceNumber })
            .from(grievances)
            .where(and(eq(grievances.organizationId, organizationId), inArray(grievances.grievanceNumber, fixtureNumbers)))
        ).map((row) => row.number)
      : [],
  )
  const cases = partitionFixtureEntries(fixture.cases, (entry) => entry.number, heldNumbers)
  const nameByUser = new Map(fixture.members.map((member) => [member.id, member] as const))
  const grievanceRows: GrievanceInsert[] = cases.create.map((entry) => {
    const grievant = nameByUser.get(entry.filed_by)
    return {
      id: randomUUID(),
      grievanceNumber: entry.number,
      organizationId,
      type: grievanceTypeFor(entry.case_type),
      status: grievanceStatusFor(entry.status),
      priority: grievancePriorityFor(entry.priority),
      title: entry.title,
      description: entry.description,
      grievantName: grievant ? `${grievant.first_name} ${grievant.last_name}` : undefined,
      grievantEmail: grievant?.email,
      filedDate: entry.filed_at ? new Date(entry.filed_at) : undefined,
    }
  })
  // Grievance numbers are unique across organizations, so a number held by another organization is skipped, never overwritten or claimed.
  const insertedGrievances = grievanceRows.length
    ? await tx.insert(grievances).values(grievanceRows).onConflictDoNothing().returning({ id: grievances.id })
    : []

  const ledgerRows = [
    ...insertedMembers.map((row) => ({ type: 'organization_member' as const, id: row.id })),
    ...insertedGrievances.map((row) => ({ type: 'grievance' as const, id: row.id })),
  ]
  if (ledgerRows.length) {
    await tx.insert(pilotFixtureRows).values(
      ledgerRows.map((row) => ({
        organizationId,
        fixtureSource: CUPE_BOOTSTRAP_SOURCE,
        resourceType: row.type,
        resourceId: row.id,
        seededBy: userId,
      })),
    )
  }

  await tx
    .insert(pilotChecklistItems)
    .values({ organizationId, itemId: BOOTSTRAP_CHECKLIST_ITEM, completed: true, completedAt: new Date(), completedBy: userId })
    .onConflictDoNothing()
  const checklist = await tx
    .select({ itemId: pilotChecklistItems.itemId, completed: pilotChecklistItems.completed })
    .from(pilotChecklistItems)
    .where(eq(pilotChecklistItems.organizationId, organizationId))

  const sessionId = `pilot-bootstrap:${organizationId}`
  await tx.insert(pilotEvents).values([
    ...(args.organizationCreated
      ? [{ userId, organizationId, sessionId, eventType: 'org_created', metadata: { source: CUPE_BOOTSTRAP_SOURCE } }]
      : []),
    { userId, organizationId, sessionId, eventType: 'feature_used', metadata: { feature: 'one_click_bootstrap', reset: args.reset } },
  ])

  return {
    removed,
    clearedStale,
    seeded: { members: insertedMembers.length, cases: insertedGrievances.length },
    alreadyPresent: { members: members.alreadyPresent.length, cases: cases.alreadyPresent.length },
    caseNumbersInUse: cases.create.length - insertedGrievances.length,
    onboarding: summarizePilotOnboarding(checklist),
  }
}

/**
 * Tenant phase (runtime role bound to the fixture organization, one transaction). Seeds and, when asked, first resets; the rows, the ledger,
 * the checklist, the events and the audit record commit together or not at all. A refused reset writes only its denial record.
 */
export async function applyFixture(tx: RLSTx, args: FixtureApplyArgs): Promise<FixtureApplyResult> {
  const { organizationId, userId, runtimeMode } = args
  await lock(tx, `pilot-fixture-rows:${organizationId}`)

  const ledger = await readLedger(tx, organizationId)
  const plan = planFixtureReset({
    ledger,
    present: await readPresent(tx, organizationId, ledger),
    foreign: await countForeign(tx, organizationId),
  })

  if (args.reset && plan.refusal) {
    await recordFixtureDenial(tx, { organizationId, userId, runtimeMode, reason: 'foreign_rows', details: { foreign: plan.foreign } })
    return { kind: 'refused', reason: 'foreign_rows', foreign: plan.foreign }
  }

  let outcome: FixtureOutcome
  try {
    outcome = await tx.transaction(async (savepoint) => {
      // Django creates its foreign keys deferred to commit. Checked here instead, a delete that a dependent record blocks is refused at the
      // statement (and rehearsed by a dry run) rather than surfacing as a failed commit after the audit record was written.
      await savepoint.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`)
      const done = await mutate(savepoint as unknown as RLSTx, args, plan)
      if (args.dryRun) throw new DryRunRollback(done)
      return done
    })
  } catch (error) {
    if (error instanceof DryRunRollback) {
      outcome = error.outcome
    } else {
      const { code, constraint } = postgresError(error)
      // 23503: a row the reset would delete is still referenced by a record the bootstrap did not create. It is left alone.
      if (code !== '23503') throw error
      await recordFixtureDenial(tx, { organizationId, userId, runtimeMode, reason: 'dependent_rows', details: { constraint } })
      return { kind: 'refused', reason: 'dependent_rows', constraint }
    }
  }

  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: args.dryRun ? 'pilot.bootstrap.cupe.dry_run' : 'pilot.bootstrap.cupe',
    resourceType: 'organizations',
    resourceId: organizationId,
    details: {
      reset: args.reset,
      dryRun: args.dryRun,
      runtimeMode,
      organizationCreated: args.organizationCreated,
      membersInserted: outcome.seeded.members,
      casesInserted: outcome.seeded.cases,
      membersAlreadyPresent: outcome.alreadyPresent.members,
      casesAlreadyPresent: outcome.alreadyPresent.cases,
      caseNumbersInUse: outcome.caseNumbersInUse,
      removed: outcome.removed,
      clearedStale: outcome.clearedStale,
      worksitesInFixtureNotSeeded: args.fixture.worksites.length,
    },
  })
  return { kind: 'done', dryRun: args.dryRun, ...outcome }
}
