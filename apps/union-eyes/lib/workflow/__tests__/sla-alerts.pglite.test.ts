import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { inAppNotifications } from '@/db/schema';
import { createTableDatabase } from '@/app/api/__tests__/support/pglite-tables';

vi.mock('@/lib/workflow/case-lifecycle', () => ({ getSLADeadlineHours: (_state: string, priority: string) => (priority === 'high' ? 10 : 100) }));
vi.mock('@/lib/workflow/state-bridge', () => ({ toLifecycleState: () => 'submitted' }));

import { alertKey, assessClaim, emptyTally, tally, writeSlaAlerts, type ScannedClaim } from '../sla-alerts';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-06-01T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const claim = (over: Partial<ScannedClaim> = {}): ScannedClaim => ({
  claimId: 'c-1', claimNumber: 'CL-1', status: 'open', priority: 'high', organizationId: ORG, assignedTo: 'steward-1',
  updatedAt: hoursAgo(1), createdAt: hoursAgo(50), ...over,
});

describe('assessClaim', () => {
  it('classifies by the share of the window left, once', () => {
    expect(assessClaim(claim({ updatedAt: hoursAgo(1) }), NOW).state).toBe('ok');
    expect(assessClaim(claim({ updatedAt: hoursAgo(9) }), NOW).state).toBe('at_risk'); // 1h of 10h left (< 20%)
    expect(assessClaim(claim({ updatedAt: hoursAgo(10) }), NOW).state).toBe('breached');
    expect(assessClaim(claim({ updatedAt: hoursAgo(12) }), NOW).hoursRemaining).toBeCloseTo(-2, 5);
  });
});

describe('tally', () => {
  it('counts every claim once, alerts only the assigned, and reports the unassigned', () => {
    const t = emptyTally();
    for (const [c, h] of [[claim({ claimId: 'a' }), 1], [claim({ claimId: 'b' }), 9], [claim({ claimId: 'c' }), 12], [claim({ claimId: 'd', assignedTo: null }), 12]] as const) {
      tally(t, c, assessClaim({ ...c, updatedAt: hoursAgo(h) }, NOW));
    }
    expect(t).toMatchObject({ scanned: 4, compliant: 2, atRisk: 1, breached: 2, unassigned: 1 });
    expect(t.alerts.map((a) => [a.claimId, a.kind, a.recipient])).toEqual([['b', 'at_risk', 'steward-1'], ['c', 'breached', 'steward-1']]);
  });
});

describe('writeSlaAlerts (PostgreSQL)', () => {
  let pg: PGlite;
  let db: any;
  const alert = (claimId: string, kind: 'breached' | 'at_risk' = 'breached', recipient = 'steward-1', deadline = hoursAgo(2)) =>
    ({ claimId, claimNumber: `N-${claimId}`, recipient, kind, deadline, hoursRemaining: kind === 'breached' ? -2 : 1 });

  beforeAll(async () => {
    const created = await createTableDatabase([inAppNotifications]);
    pg = created.pg;
    db = created.db;
    // the unique index comes from the migration itself, so the test proves the shipped SQL
    await pg.exec(readFileSync(resolve(__dirname, '../../../db/migrations/20261103_in_app_notifications_dedupe_key.sql'), 'utf8'));
  });
  afterAll(async () => { await pg.close(); });
  beforeEach(async () => { await pg.exec('TRUNCATE in_app_notifications'); });

  const rows = async () => (await pg.query<{ user_id: string; organization_id: string; type: string; title: string; data: Record<string, unknown> }>(
    'SELECT user_id, organization_id, type, title, data FROM in_app_notifications ORDER BY title')).rows;

  it('writes one durable alert per claim for its steward, with the right severity', async () => {
    expect(await writeSlaAlerts(db, ORG, [alert('a'), alert('b', 'at_risk')])).toBe(2);
    const stored = await rows();
    expect(stored.map((r) => [r.type, r.user_id, r.organization_id])).toEqual([['warning', 'steward-1', ORG], ['error', 'steward-1', ORG]]);
    expect(stored[1].data).toMatchObject({ origin: 'system:sla-watchdog', claimId: 'a' });
  });

  it('writes nothing for a repeated run, overlapping runs, or a retry', async () => {
    await writeSlaAlerts(db, ORG, [alert('a')]);
    expect(await writeSlaAlerts(db, ORG, [alert('a')])).toBe(0);
    expect((await Promise.all([writeSlaAlerts(db, ORG, [alert('a')]), writeSlaAlerts(db, ORG, [alert('a')])])).reduce((x, y) => x + y, 0)).toBe(0);
    expect(await rows()).toHaveLength(1);
  });

  it('alerts again when the claim moves on to a new deadline, or escalates from at risk to breached', async () => {
    await writeSlaAlerts(db, ORG, [alert('a', 'at_risk', 'steward-1', hoursAgo(-1))]);
    expect(await writeSlaAlerts(db, ORG, [alert('a', 'breached', 'steward-1', hoursAgo(-1))])).toBe(1);
    expect(await writeSlaAlerts(db, ORG, [alert('a', 'breached', 'steward-1', hoursAgo(-30))])).toBe(1);
    expect(await rows()).toHaveLength(3);
  });

  it('keeps one steward\'s or one organization\'s alert from suppressing another\'s', async () => {
    await writeSlaAlerts(db, ORG, [alert('a')]);
    expect(await writeSlaAlerts(db, ORG, [alert('a', 'breached', 'steward-2')])).toBe(1);
    expect(await writeSlaAlerts(db, OTHER, [alert('a')])).toBe(1);
  });

  it('leaves other notices alone: the index constrains only rows that carry a dedupe key', async () => {
    for (let i = 0; i < 2; i += 1) {
      await pg.query(`INSERT INTO in_app_notifications (user_id, organization_id, title, message, type) VALUES ('u', $1, 'plain', 'm', 'info')`, [ORG]);
    }
    expect(await rows()).toHaveLength(2);
  });

  it('derives the key from the claim, kind and deadline', () => {
    expect(alertKey({ claimId: 'a', kind: 'breached', deadline: new Date('2026-01-01T00:00:00Z') })).toBe('sla:a:breached:2026-01-01T00:00:00.000Z');
  });
});
