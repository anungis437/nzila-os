import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  recordPilotMetricEvent: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@nzila/db/platform', () => ({
  platformDb: { execute: mocks.execute },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

vi.mock('@nzila/platform-pilot-metrics', () => ({
  recordPilotMetricEvent: mocks.recordPilotMetricEvent,
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: mocks.warn },
}));

import {
  recordUnionEyesCaseCreated,
  recordUnionEyesCaseAssigned,
  recordUnionEyesCaseAcknowledged,
  recordUnionEyesCaseResolved,
  recordUnionEyesWorkflowTransition,
  recordUnionEyesWorkflowTransitionFailure,
  recordUnionEyesEvidenceExport,
  recordUnionEyesSlaWatchdog,
  recordUnionEyesSlaCompliance,
} from '../pilot-metrics';

const ORG = 'org-1';
const lastEvent = () => mocks.recordPilotMetricEvent.mock.calls.at(-1)?.[0];

describe('lib/pilot-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue([{ id: 'pilot-1' }]);
    mocks.recordPilotMetricEvent.mockResolvedValue(undefined);
  });

  it('records a case-created event with operations metric type and subject', async () => {
    await recordUnionEyesCaseCreated(ORG, 'claim-1', 'actor-1', 'trace-1');
    const ev = lastEvent();
    expect(ev.metricName).toBe('cases_created');
    expect(ev.metricType).toBe('operations');
    expect(ev.entityType).toBe('case');
    // Legacy subject ref key carries the claim id.
    expect(ev.entityId).toBe('claim-1');
  });

  it('records assignment efficiency with assignee in valueJson', async () => {
    await recordUnionEyesCaseAssigned(ORG, 'claim-1', 'assignee-1', 'actor-1', 'trace-1');
    const ev = lastEvent();
    expect(ev.metricName).toBe('assignment_efficiency');
    expect(ev.metricType).toBe('operations');
    expect(ev.valueJson).toEqual({ assigneeId: 'assignee-1' });
  });

  it('records acknowledgement as two events (operations + adoption)', async () => {
    await recordUnionEyesCaseAcknowledged(ORG, 'claim-1', 12, 'actor-1', 'trace-1');
    expect(mocks.recordPilotMetricEvent).toHaveBeenCalledTimes(2);
    const names = mocks.recordPilotMetricEvent.mock.calls.map((c) => c[0].metricName);
    expect(names).toEqual(['cases_acknowledged', 'avg_time_to_first_response']);
    expect(lastEvent().metricType).toBe('adoption');
  });

  it('records resolution time', async () => {
    await recordUnionEyesCaseResolved(ORG, 'claim-1', 5, 'actor-1', 'trace-1');
    expect(lastEvent().metricName).toBe('avg_time_to_resolution');
    expect(lastEvent().valueNumeric).toBe(5);
  });

  it('records a successful workflow transition with workflow metric type', async () => {
    await recordUnionEyesWorkflowTransition(ORG, 'claim-1', true, 'closed', 'actor-1', 'trace-1');
    const ev = lastEvent();
    expect(ev.metricName).toBe('workflow_transition_success_rate');
    expect(ev.metricType).toBe('workflow');
    expect(ev.valueNumeric).toBe(1);
  });

  it('records a workflow transition failure as 0', async () => {
    await recordUnionEyesWorkflowTransition(ORG, 'claim-1', false, 'open', 'actor-1', 'trace-1');
    expect(lastEvent().valueNumeric).toBe(0);
  });

  it('records a workflow failure event with reason', async () => {
    await recordUnionEyesWorkflowTransitionFailure(ORG, 'claim-1', 'invalid', 'actor-1', 'trace-1');
    expect(lastEvent().metricName).toBe('workflow_failures');
    expect(lastEvent().valueJson).toEqual({ reason: 'invalid' });
  });

  it('records an evidence export (adoption)', async () => {
    await recordUnionEyesEvidenceExport(ORG, 'claim-1', 'actor-1', 'trace-1');
    expect(lastEvent().metricName).toBe('evidence_pack_exports');
    expect(lastEvent().metricType).toBe('adoption');
  });

  it('records the SLA watchdog with a system actor and no subject', async () => {
    await recordUnionEyesSlaWatchdog(ORG, 3, 7, 'trace-1');
    const ev = lastEvent();
    expect(ev.metricName).toBe('sla_breach_count');
    expect(ev.valueNumeric).toBe(3);
    expect(ev.valueJson).toEqual({ atRiskCount: 7 });
    // No subject id/type provided.
    expect(ev.entityId).toBeUndefined();
    expect(ev.entityType).toBeUndefined();
  });

  it('computes SLA compliance rate as a percentage', async () => {
    await recordUnionEyesSlaCompliance(ORG, 8, 10, 'trace-1');
    expect(lastEvent().valueNumeric).toBe(80);
  });

  it('defaults SLA compliance to 100 when nothing was scanned', async () => {
    await recordUnionEyesSlaCompliance(ORG, 0, 0, 'trace-1');
    expect(lastEvent().valueNumeric).toBe(100);
  });

  it('is a no-op when there is no active pilot', async () => {
    mocks.execute.mockResolvedValue([]);
    await recordUnionEyesCaseCreated(ORG, 'claim-1', 'actor-1', 'trace-1');
    expect(mocks.recordPilotMetricEvent).not.toHaveBeenCalled();
  });

  it('swallows errors and logs a warning when the emit fails', async () => {
    mocks.recordPilotMetricEvent.mockRejectedValue(new Error('emit boom'));
    await recordUnionEyesCaseCreated(ORG, 'claim-1', 'actor-1', 'trace-1');
    expect(mocks.warn).toHaveBeenCalledWith(
      'pilot metrics emit failed (union-eyes)',
      expect.objectContaining({ metricName: 'cases_created', orgId: ORG }),
    );
  });
});
