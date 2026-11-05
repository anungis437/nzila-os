import { beforeEach, describe, expect, it, vi } from 'vitest';
import { txDouble } from '@/lib/page-data/__tests__/tx-double';

vi.mock('@/lib/db/with-rls-context', async () => (await import('@/lib/page-data/__tests__/tx-double')).txDoubleModule());

import {
  listComplianceEvents,
  listExecutionProfiles,
  listPayrollRuns,
  listRemittanceRuns,
  loadLatestTimesheetBatch,
  loadPayrollRunDetail,
  loadRemittanceRunDetail,
} from '../page-reads';

const ORG = '4f0d6b5e-8a52-4c5e-9d0e-2f3b8d9a1c11';
const RUN = '7a1e2c3d-4b5f-4a6b-8c7d-9e0f1a2b3c4d';

beforeEach(() => txDouble.reset());

describe('the lists a page shows', () => {
  const lists = [
    ['listComplianceEvents', () => listComplianceEvents(ORG)],
    ['listPayrollRuns', () => listPayrollRuns(ORG)],
    ['listRemittanceRuns', () => listRemittanceRuns(ORG)],
    ['listExecutionProfiles', () => listExecutionProfiles(ORG)],
  ] as const;

  it.each(lists)('%s reads the organization own rows in the organization context', async (_name, run) => {
    txDouble.queue([{ id: 'row-1' }]);

    expect(await run()).toEqual([{ id: 'row-1' }]);

    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(txDouble.statements).toHaveLength(1);
    expect(txDouble.statements[0]).toMatchObject({ kind: 'select', context: ORG });
    expect(txDouble.statements[0].where?.sql).toMatch(/"organization_id" = \$1/);
    expect(txDouble.statements[0].where?.params).toEqual([ORG]);
  });

  it.each(lists)('%s surfaces a database failure instead of an empty list', async (_name, run) => {
    txDouble.queue(new Error('connection lost'));

    await expect(run()).rejects.toThrow('connection lost');
  });
});

describe('loadPayrollRunDetail', () => {
  it('assembles the run with its items, newest replay, compliance events and evidence, all of the organization', async () => {
    txDouble.queue([{ id: RUN }], [{ id: 'item-1' }], [{ id: 'replay-1' }], [{ id: 'event-1' }], [{ id: 'artifact-1' }]);

    const detail = await loadPayrollRunDetail(ORG, RUN);

    expect(detail).toEqual({
      run: { id: RUN },
      items: [{ id: 'item-1' }],
      latestReplay: { id: 'replay-1' },
      complianceEvents: [{ id: 'event-1' }],
      artifacts: [{ id: 'artifact-1' }],
    });
    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(txDouble.statements).toHaveLength(5);
    for (const statement of txDouble.statements) {
      expect(statement.where?.params).toContain(ORG);
      expect(statement.context).toBe(ORG);
    }
    expect(txDouble.statements[0].where?.params).toEqual([ORG, RUN]);
  });

  it('has no newest replay when the run was never replayed', async () => {
    txDouble.queue([{ id: RUN }], [], [], [], []);

    expect((await loadPayrollRunDetail(ORG, RUN))?.latestReplay).toBeNull();
  });

  it('finds nothing, and reads nothing else, when the run is not the organization own', async () => {
    txDouble.queue([]);

    expect(await loadPayrollRunDetail(ORG, RUN)).toBeNull();
    expect(txDouble.statements).toHaveLength(1);
  });

  it('does not open a context for an identifier that is no uuid', async () => {
    expect(await loadPayrollRunDetail(ORG, 'not-a-uuid')).toBeNull();
    expect(txDouble.contexts).toEqual([]);
  });

  it('surfaces a database failure instead of a run that is not found', async () => {
    txDouble.queue(new Error('connection lost'));

    await expect(loadPayrollRunDetail(ORG, RUN)).rejects.toThrow('connection lost');
  });
});

describe('loadRemittanceRunDetail', () => {
  it('assembles the run with its evidence and compliance events', async () => {
    txDouble.queue([{ id: RUN }], [{ id: 'artifact-1' }], [{ id: 'event-1' }]);

    expect(await loadRemittanceRunDetail(ORG, RUN)).toEqual({
      run: { id: RUN },
      artifacts: [{ id: 'artifact-1' }],
      complianceEvents: [{ id: 'event-1' }],
    });
    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(txDouble.statements.every((statement) => statement.where?.params.includes(ORG))).toBe(true);
  });

  it('finds nothing for a run that is not the organization own, and for an identifier that is no uuid', async () => {
    txDouble.queue([]);
    expect(await loadRemittanceRunDetail(ORG, RUN)).toBeNull();

    txDouble.reset();
    expect(await loadRemittanceRunDetail(ORG, '42')).toBeNull();
    expect(txDouble.contexts).toEqual([]);
  });
});

describe('loadLatestTimesheetBatch', () => {
  it('reads the newest batch and its entries of the organization', async () => {
    txDouble.queue([{ id: 'batch-1' }], [{ id: 'entry-1' }, { id: 'entry-2' }]);

    expect(await loadLatestTimesheetBatch(ORG)).toEqual({ batch: { id: 'batch-1' }, entries: [{ id: 'entry-1' }, { id: 'entry-2' }] });
    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(txDouble.statements[1].where?.params).toEqual([ORG, 'batch-1']);
  });

  it('is a batch of null with no entries, from a real read, for an organization with no batch', async () => {
    txDouble.queue([]);

    expect(await loadLatestTimesheetBatch(ORG)).toEqual({ batch: null, entries: [] });
    expect(txDouble.statements).toHaveLength(1);
  });
});
