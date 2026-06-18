import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = ['select', 'from', 'where', 'set', 'update', 'limit', 'returning'];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const next = queue.length ? queue.shift() : [];
      if (next instanceof Error) return Promise.reject(next).then(resolve, reject);
      return Promise.resolve(next).then(resolve, reject);
    };
    return chain;
  };
  const db = {
    select: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
  };
  return { queue, db };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, name) => {
    if (name === '__esModule') return false;
    return new Proxy({}, { get: (_o, col) => ({ __col: col }) });
  },
}));

import { processTimesheetValidation } from '../process-timesheet-validation';
import { processPayrollRun } from '../process-payroll-run';
import { processRemittanceRun } from '../process-remittance-run';
import { processComplianceWatchdog } from '../process-compliance-watchdog';
import { processReplayRun } from '../process-replay-run';
import { processEvidenceSeal } from '../process-evidence-seal';

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.update.mockClear();
});

describe('employer-execution workers', () => {
  describe('processTimesheetValidation', () => {
    it('validates a batch with no errors', async () => {
      h.queue.push([
        { validationErrors: [] },
        { validationErrors: [] },
      ]); // select entries
      h.queue.push([]); // update
      const r = await processTimesheetValidation('batch-1', 'org-1');
      expect(r).toEqual({ valid: 2, invalid: 0 });
    });

    it('rejects a batch when entries have validation errors', async () => {
      h.queue.push([
        { validationErrors: ['bad'] },
        { validationErrors: [] },
        { validationErrors: ['also bad'] },
      ]);
      h.queue.push([]);
      const r = await processTimesheetValidation('batch-2', 'org-1');
      expect(r).toEqual({ valid: 1, invalid: 2 });
    });
  });

  describe('processPayrollRun', () => {
    it('marks the run calculated', async () => {
      h.queue.push([]);
      const r = await processPayrollRun('pr-1', 'org-1');
      expect(r).toEqual({ payrollRunId: 'pr-1', status: 'calculated' });
    });
  });

  describe('processRemittanceRun', () => {
    it('marks the run generated', async () => {
      h.queue.push([]);
      const r = await processRemittanceRun('rr-1', 'org-1');
      expect(r).toEqual({ remittanceRunId: 'rr-1', status: 'generated' });
    });
  });

  describe('processComplianceWatchdog', () => {
    it('counts open critical compliance events', async () => {
      h.queue.push([{ id: 'e1' }, { id: 'e2' }]);
      const r = await processComplianceWatchdog('org-1');
      expect(r).toEqual({ organizationId: 'org-1', openCriticalCount: 2 });
    });
  });

  describe('processReplayRun', () => {
    it('reports changed=true when the diff indicates a change', async () => {
      h.queue.push([{ diffJson: { changed: true } }]);
      const r = await processReplayRun('replay-1', 'org-1');
      expect(r).toEqual({ replayId: 'replay-1', changed: true });
    });

    it('reports changed=false when no replay row is found', async () => {
      h.queue.push([]);
      const r = await processReplayRun('replay-2', 'org-1');
      expect(r).toEqual({ replayId: 'replay-2', changed: false });
    });
  });

  describe('processEvidenceSeal', () => {
    it('reports sealed=true when an evidence_seal artifact exists', async () => {
      h.queue.push([
        { artifactType: 'manifest' },
        { artifactType: 'evidence_seal' },
      ]);
      const r = await processEvidenceSeal('rr-1', 'org-1');
      expect(r).toEqual({ remittanceRunId: 'rr-1', sealed: true, artifactCount: 2 });
    });

    it('reports sealed=false when no seal artifact exists', async () => {
      h.queue.push([{ artifactType: 'manifest' }]);
      const r = await processEvidenceSeal('rr-2', 'org-1');
      expect(r).toEqual({ remittanceRunId: 'rr-2', sealed: false, artifactCount: 1 });
    });
  });
});
