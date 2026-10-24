/**
 * Lifecycle regression: grievance_deadlines keeps ONE effective due date and a status every reader agrees on.
 *
 * Runs the REAL writers (createDeadline, overrideDeadline, supersedeDeadline, requestDeadlineExtension,
 * approveDeadlineExtension, completeDeadline) through Drizzle on PGlite against the table shape that
 * grievances.0007 produces (staging lineage columns + due_date/status), with the migration's own CHECK constraints
 * installed. A one-time backfill is not enough: after creation, override, re-override, extension, approval,
 * supersession and cancellation the invariants must still hold, and a writer that forgets one must fail closed.
 *
 *   I1  override_due_date IS NOT NULL  =>  due_date = override_due_date
 *   I2  superseded_at IS NOT NULL      =>  status IN ('completed', 'cancelled')
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const ctx = vi.hoisted(() => ({ db: undefined as unknown, audit: undefined as unknown as ReturnType<typeof vi.fn> }));

vi.mock('@/db/db', () => ({
  get db() {
    return ctx.db;
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  // A real transaction on the in-process database, so a thrown audit rolls the mutation back.
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    (ctx.db as { transaction: (f: (tx: unknown) => Promise<unknown>) => Promise<unknown> }).transaction(fn),
}));
vi.mock('@/lib/audit/atomic-audit', () => {
  ctx.audit = vi.fn(async () => undefined);
  return { persistAtomicAudit: ctx.audit };
});
vi.mock('@/lib/audit-logger', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditSeverity: { MEDIUM: 'MEDIUM' },
}));
vi.mock('@/lib/deadline-engine', () => ({
  scheduleGrievanceDeadlineReminders: vi.fn(async () => ({ correlationId: 'c', scheduled: [], cancelledForReschedule: [], skipped: [], skippedInPast: [] })),
  cancelGrievanceDeadlineReminders: vi.fn(async () => ({ cancelledIds: [], correlationId: 'c' })),
}));
vi.mock('@nzila/os-core/telemetry', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { grievanceDeadlines } from '@/db/schema';
import { createDeadline, completeDeadline, requestDeadlineExtension, approveDeadlineExtension } from '@/lib/deadline-tracking-system';
import { confirmDeadline, overrideDeadline, supersedeDeadline } from '@/lib/services/deadline-confirmation-service';
import { effectiveDueDateUpdate, isTerminalDeadlineStatus, TERMINAL_DEADLINE_STATUSES } from '@/lib/deadline-engine/deadline-semantics';

const APP_ROOT = resolve(__dirname, '..', '..');
const MIGRATION = readFileSync(resolve(APP_ROOT, 'backend', 'grievances', 'migrations', '0007_grievance_deadlines_due_date_status.py'), 'utf8');
const CONVERGE_AND_GUARD = (() => {
  const m = MIGRATION.match(/CONVERGE_AND_GUARD = """([\s\S]*?)"""/);
  if (!m) throw new Error('CONVERGE_AND_GUARD not found in grievances.0007');
  return m[1];
})();

const ORG = '00000000-0000-0000-0000-0000000000aa';
const GRIEVANCE = '00000000-0000-0000-0000-0000000000bb';
const DAY = 24 * 60 * 60 * 1000;

let pg: PGlite;

type Row = {
  id: string;
  due_date: Date | null;
  status: string;
  calculated_due_date: Date | null;
  override_due_date: Date | null;
  superseded_at: Date | null;
  new_deadline: Date | null;
};
const row = async (id: string): Promise<Row> =>
  (await pg.query<Row>(`SELECT id, due_date, status, calculated_due_date, override_due_date, superseded_at, new_deadline FROM grievance_deadlines WHERE id = $1`, [id])).rows[0];

// Both invariants, asserted on every row after every step.
async function assertInvariants(label: string) {
  const rows = (await pg.query<Row>(`SELECT id, due_date, status, calculated_due_date, override_due_date, superseded_at, new_deadline FROM grievance_deadlines`)).rows;
  for (const r of rows) {
    if (r.override_due_date) expect(r.due_date?.getTime(), `${label}: I1 for ${r.id}`).toBe(r.override_due_date.getTime());
    if (r.superseded_at) expect(['completed', 'cancelled'], `${label}: I2 for ${r.id}`).toContain(r.status);
  }
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE grievances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL);
    CREATE TABLE grievance_deadlines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      grievance_id uuid NOT NULL REFERENCES grievances(id),
      deadline_type varchar(255),
      description varchar(500),
      due_date timestamptz,
      status varchar(50) NOT NULL DEFAULT 'pending',
      completed_at timestamptz,
      extension_granted boolean DEFAULT false,
      new_deadline timestamptz,
      confirmation_status varchar(32) NOT NULL DEFAULT 'SYSTEM_CALCULATED',
      calculated_due_date timestamptz,
      calculation_provenance jsonb DEFAULT '{}',
      confirmed_at timestamptz,
      confirmed_by text,
      override_due_date timestamptz,
      override_reason text,
      override_at timestamptz,
      override_by text,
      superseded_at timestamptz,
      superseded_by text,
      reminder_days integer[],
      reminders_sent jsonb,
      notes text
    );
  `);
  await pg.exec(CONVERGE_AND_GUARD);
  await pg.query(`INSERT INTO grievances (id, organization_id) VALUES ($1, $2)`, [GRIEVANCE, ORG]);
  const real = drizzle(pg, { schema: { grievanceDeadlines } });
  // createDeadline reads db.query.grievances (a wide table); only its existence matters here.
  ctx.db = new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'query') {
        return { grievances: { findFirst: async () => ({ id: GRIEVANCE, organizationId: ORG }) }, grievanceDeadlines: target.query.grievanceDeadlines };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  await pg.exec('DELETE FROM grievance_deadlines');
});

const create = async (days = 10) => {
  const res = await createDeadline(GRIEVANCE, 'grievance_filing', { customDays: days, useBusinessDays: false });
  expect(res.success, JSON.stringify(res)).toBe(true);
  return { id: res.deadlineId as string, dueDate: res.dueDate as Date };
};

describe('deadline lifecycle: one effective due date and one status vocabulary', () => {
  it('creation: due_date is the effective date; no override, not superseded', async () => {
    const { id, dueDate } = await create();
    const r = await row(id);
    expect(r.due_date?.getTime()).toBe(dueDate.getTime());
    expect(r.status).toBe('pending');
    expect(r.override_due_date).toBeNull();
    await assertInvariants('create');
  });

  it('override then re-override ("recalculation"): the effective date follows the latest override, the original calculation is kept', async () => {
    const { id, dueDate } = await create();
    const first = new Date(dueDate.getTime() + 3 * DAY);
    await overrideDeadline({ organizationId: ORG, deadlineId: id, actorId: 'u1', overrideDueDate: first, overrideReason: 'r1' });
    let r = await row(id);
    expect(r.due_date?.getTime()).toBe(first.getTime());
    expect(r.override_due_date?.getTime()).toBe(first.getTime());
    expect(r.calculated_due_date?.getTime()).toBe(dueDate.getTime());
    await assertInvariants('override');

    const second = new Date(dueDate.getTime() + 8 * DAY);
    await overrideDeadline({ organizationId: ORG, deadlineId: id, actorId: 'u2', overrideDueDate: second, overrideReason: 'r2' });
    r = await row(id);
    expect(r.due_date?.getTime()).toBe(second.getTime());
    expect(r.override_due_date?.getTime()).toBe(second.getTime());
    expect(r.calculated_due_date?.getTime(), 'the ORIGINAL calculation is preserved').toBe(dueDate.getTime());
    await assertInvariants('re-override');
  });

  it('immediate extension moves the effective date (it used to leave due_date stale) and keeps an override in step', async () => {
    const { id, dueDate } = await create();
    const extended = new Date(dueDate.getTime() + 5 * DAY);
    expect((await requestDeadlineExtension({ organizationId: ORG, deadlineId: id, newDate: extended, reason: 'ok', requestedBy: 'u1', requiresApproval: false })).success).toBe(true);
    let r = await row(id);
    expect(r.due_date?.getTime()).toBe(extended.getTime());
    expect(r.status).toBe('extended');
    await assertInvariants('extension');

    const overridden = new Date(dueDate.getTime() + 6 * DAY);
    await overrideDeadline({ organizationId: ORG, deadlineId: id, actorId: 'u1', overrideDueDate: overridden, overrideReason: 'r' });
    const again = new Date(dueDate.getTime() + 9 * DAY);
    expect((await requestDeadlineExtension({ organizationId: ORG, deadlineId: id, newDate: again, reason: 'again', requestedBy: 'u1', requiresApproval: false })).success).toBe(true);
    r = await row(id);
    expect(r.due_date?.getTime()).toBe(again.getTime());
    expect(r.override_due_date?.getTime(), 'an override in force must move with the extension').toBe(again.getTime());
    await assertInvariants('extension over override');
  });

  it('approval path applies the REQUESTED date (the request used to lose it and approval fell back to "now")', async () => {
    const { id, dueDate } = await create();
    const requested = new Date(dueDate.getTime() + 7 * DAY);
    expect((await requestDeadlineExtension({ organizationId: ORG, deadlineId: id, newDate: requested, reason: 'please', requestedBy: 'u1', requiresApproval: true })).success).toBe(true);
    let r = await row(id);
    expect(r.due_date?.getTime(), 'a pending request must not move the date').toBe(dueDate.getTime());
    expect(r.new_deadline?.getTime()).toBe(requested.getTime());

    expect((await approveDeadlineExtension(id, ORG, 'approver')).success).toBe(true);
    r = await row(id);
    expect(r.due_date?.getTime()).toBe(requested.getTime());
    expect(r.status).toBe('extended');
    await assertInvariants('approval');
  });

  it('supersession cancels the deadline for every reader; a completed deadline keeps its completion', async () => {
    const a = await create(4);
    await supersedeDeadline({ organizationId: ORG, deadlineId: a.id, actorId: 'u1' });
    let r = await row(a.id);
    expect(r.superseded_at).not.toBeNull();
    expect(r.status).toBe('cancelled');
    await assertInvariants('supersede');

    const b = await create(4);
    expect((await completeDeadline(b.id, ORG, 'u1', 'done')).success).toBe(true);
    await supersedeDeadline({ organizationId: ORG, deadlineId: b.id, actorId: 'u1' });
    r = await row(b.id);
    expect(r.status, 'completion is not overwritten by supersession').toBe('completed');
    await assertInvariants('complete then supersede');
  });

  it('a terminal deadline cannot be resurrected by an extension (and the database agrees)', async () => {
    const { id, dueDate } = await create();
    await supersedeDeadline({ organizationId: ORG, deadlineId: id, actorId: 'u1' });
    const res = await requestDeadlineExtension({ organizationId: ORG, deadlineId: id, newDate: new Date(dueDate.getTime() + DAY), reason: 'x', requestedBy: 'u', requiresApproval: false });
    expect(res.success).toBe(false);
    expect((await approveDeadlineExtension(id, ORG, 'approver')).success).toBe(false);
    expect((await row(id)).status).toBe('cancelled');
    await assertInvariants('terminal');
  });

  it('readers agree on what is terminal', async () => {
    expect([...TERMINAL_DEADLINE_STATUSES].sort()).toEqual(['cancelled', 'completed']);
    for (const s of ['completed', 'cancelled']) expect(isTerminalDeadlineStatus(s)).toBe(true);
    for (const s of ['pending', 'extended', 'overdue', 'missed', null, undefined]) expect(isTerminalDeadlineStatus(s as string)).toBe(false);
    const d = new Date();
    expect(effectiveDueDateUpdate({ overrideDueDate: null }, d)).toEqual({ dueDate: d });
    expect(effectiveDueDateUpdate({ overrideDueDate: new Date(0) }, d)).toEqual({ dueDate: d, overrideDueDate: d });
  });

  describe('the database fails closed for a writer that forgets an invariant', () => {
    it('rejects a due_date that diverges from the override (I1)', async () => {
      const { id, dueDate } = await create();
      await overrideDeadline({ organizationId: ORG, deadlineId: id, actorId: 'u', overrideDueDate: new Date(dueDate.getTime() + DAY), overrideReason: 'r' });
      await expect(pg.query(`UPDATE grievance_deadlines SET due_date = due_date + interval '2 days' WHERE id = $1`, [id])).rejects.toThrow(/grievance_deadlines_override_is_effective/);
      await expect(pg.query(`UPDATE grievance_deadlines SET override_due_date = NULL, due_date = NULL WHERE id = $1`, [id])).resolves.toBeDefined();
    });

    it('rejects superseding without cancelling, and re-opening a superseded row (I2)', async () => {
      const { id } = await create();
      await expect(pg.query(`UPDATE grievance_deadlines SET superseded_at = now() WHERE id = $1`, [id])).rejects.toThrow(/grievance_deadlines_superseded_is_terminal/);
      await supersedeDeadline({ organizationId: ORG, deadlineId: id, actorId: 'u' });
      await expect(pg.query(`UPDATE grievance_deadlines SET status = 'extended' WHERE id = $1`, [id])).rejects.toThrow(/grievance_deadlines_superseded_is_terminal/);
      await expect(pg.query(`UPDATE grievance_deadlines SET status = 'missed' WHERE id = $1`, [id])).rejects.toThrow(/grievance_deadlines_superseded_is_terminal/);
    });
  });

  describe('migration convergence (not just a one-time backfill assertion)', () => {
    it('converges stale rows and installs the guards idempotently', async () => {
      const db2 = new PGlite();
      await db2.exec(`
        CREATE TABLE grievance_deadlines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), due_date timestamptz, status varchar(50) NOT NULL DEFAULT 'pending',
          calculated_due_date timestamptz, override_due_date timestamptz, superseded_at timestamptz);
        INSERT INTO grievance_deadlines (due_date, status, calculated_due_date, override_due_date, superseded_at) VALUES
          (NULL, 'pending', '2026-01-10', NULL, NULL),                      -- missing due_date -> calculation
          ('2026-01-01', 'pending', '2026-01-10', '2026-01-20', NULL),      -- stale due_date -> override wins
          ('2026-01-05', 'extended', '2026-01-05', NULL, '2026-01-06'),     -- superseded but not cancelled
          ('2026-01-05', 'completed', '2026-01-05', NULL, '2026-01-06'),    -- superseded but completed: kept
          ('2026-02-02', 'pending', NULL, NULL, NULL);                      -- untouched
      `);
      await db2.exec(CONVERGE_AND_GUARD);
      await db2.exec(CONVERGE_AND_GUARD); // idempotent
      const r = (await db2.query<{ due_date: Date; status: string }>(`SELECT due_date, status FROM grievance_deadlines`)).rows;
      const actual = r.map((x) => `${x.due_date.toISOString().slice(0, 10)}:${x.status}`).sort();
      expect(actual).toEqual(['2026-01-05:cancelled', '2026-01-05:completed', '2026-01-10:pending', '2026-01-20:pending', '2026-02-02:pending']);      const c = (await db2.query<{ n: number }>(`SELECT count(*)::int n FROM pg_constraint WHERE conname IN ('grievance_deadlines_override_is_effective','grievance_deadlines_superseded_is_terminal')`)).rows[0].n;
      expect(c).toBe(2);
      await db2.close();
    });

    it('installs the guards inside one transaction even when Django-style DEFERRED foreign keys have pending trigger events', async () => {
      // Found in the lineage rehearsal: the convergence UPDATEs queue deferred FK events and ALTER TABLE is refused while they are pending.
      const db5 = new PGlite();
      await db5.exec(`
        CREATE TABLE grievances (id uuid PRIMARY KEY);
        CREATE TABLE grievance_deadlines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grievance_id uuid NOT NULL,
          calculated_due_date timestamptz, override_due_date timestamptz, superseded_at timestamptz,
          CONSTRAINT gd_fk FOREIGN KEY (grievance_id) REFERENCES grievances(id) DEFERRABLE INITIALLY DEFERRED);
        INSERT INTO grievances VALUES ('00000000-0000-0000-0000-0000000000d2');
        INSERT INTO grievance_deadlines (grievance_id, calculated_due_date, override_due_date) VALUES ('00000000-0000-0000-0000-0000000000d2', '2026-11-01', '2026-11-05');
        INSERT INTO grievance_deadlines (grievance_id, calculated_due_date, superseded_at) VALUES ('00000000-0000-0000-0000-0000000000d2', '2026-11-02', now());
      `);
      await db5.exec(`BEGIN; ALTER TABLE grievance_deadlines ADD COLUMN due_date timestamptz NULL; ALTER TABLE grievance_deadlines ADD COLUMN status varchar(50) NOT NULL DEFAULT 'pending';`);
      await db5.exec(CONVERGE_AND_GUARD);
      await db5.exec('COMMIT');
      const r = (await db5.query<{ due_date: Date; status: string }>(`SELECT due_date, status FROM grievance_deadlines`)).rows;
      expect(r.map((x) => `${x.due_date.toISOString().slice(0, 10)}:${x.status}`).sort()).toEqual(['2026-11-02:cancelled', '2026-11-05:pending']);
      await db5.close();
    });

    it('is a safe no-op on a Django-first table that has no lineage columns', async () => {
      const db3 = new PGlite();
      await db3.exec(`CREATE TABLE grievance_deadlines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), due_date timestamptz, status varchar(50) NOT NULL DEFAULT 'pending')`);
      await db3.exec(CONVERGE_AND_GUARD);
      const c = (await db3.query<{ n: number }>(`SELECT count(*)::int n FROM pg_constraint WHERE conname LIKE 'grievance_deadlines_%' AND contype = 'c'`)).rows[0].n;
      expect(c).toBe(0);
      await db3.close();
    });

    it('is a safe no-op when the table does not exist', async () => {
      const db4 = new PGlite();
      await expect(db4.exec(CONVERGE_AND_GUARD)).resolves.toBeDefined();
      await db4.close();
    });
  });

describe('deadline confirmation is organization-scoped and audited in its own transaction', () => {
  const OTHER_ORG = '00000000-0000-0000-0000-0000000000cc';

  it('another organization cannot confirm, override or supersede this deadline, and nothing is audited', async () => {
    const { id, dueDate } = await create();
    const before = await row(id);
    expect(await overrideDeadline({ organizationId: OTHER_ORG, deadlineId: id, actorId: 'x', overrideDueDate: new Date(dueDate.getTime() + DAY), overrideReason: 'r' })).toBeNull();
    expect(await supersedeDeadline({ organizationId: OTHER_ORG, deadlineId: id, actorId: 'x' })).toBeNull();
    expect(await confirmDeadline({ organizationId: OTHER_ORG, deadlineId: id, actorId: 'x' })).toBeNull();
    expect(await row(id)).toEqual(before);
    expect((ctx.audit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('another organization cannot extend, approve, complete or escalate this deadline', async () => {
    const { id, dueDate } = await create();
    const before = await row(id);
    const req = { organizationId: OTHER_ORG, deadlineId: id, newDate: new Date(dueDate.getTime() + DAY), reason: 'x', requestedBy: 'x' };
    expect((await requestDeadlineExtension({ ...req, requiresApproval: false })).success).toBe(false);
    expect((await requestDeadlineExtension({ ...req, requiresApproval: true })).success).toBe(false);
    expect((await approveDeadlineExtension(id, OTHER_ORG, 'x')).success).toBe(false);
    expect((await completeDeadline(id, OTHER_ORG, 'x')).success).toBe(false);
    expect(await row(id)).toEqual(before);
  });

  it('the owning organization is audited with the change, and a failed audit rolls the change back', async () => {
    const { id, dueDate } = await create();
    const audit = ctx.audit as ReturnType<typeof vi.fn>;
    audit.mockClear();
    const moved = new Date(dueDate.getTime() + 2 * DAY);
    await overrideDeadline({ organizationId: ORG, deadlineId: id, actorId: 'u1', overrideDueDate: moved, overrideReason: 'agreed' });
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'deadline.overridden', organizationId: ORG, userId: 'u1', resourceId: id }));
    expect((await row(id)).due_date?.getTime()).toBe(moved.getTime());

    audit.mockRejectedValueOnce(new Error('audit write failed'));
    await expect(overrideDeadline({ organizationId: ORG, deadlineId: id, actorId: 'u2', overrideDueDate: new Date(moved.getTime() + DAY), overrideReason: 'again' })).rejects.toThrow();
    expect((await row(id)).due_date?.getTime()).toBe(moved.getTime());
    audit.mockRejectedValueOnce(new Error('audit write failed'));
    await expect(supersedeDeadline({ organizationId: ORG, deadlineId: id, actorId: 'u2' })).rejects.toThrow();
    expect((await row(id)).superseded_at).toBeNull();
  });
});
});
