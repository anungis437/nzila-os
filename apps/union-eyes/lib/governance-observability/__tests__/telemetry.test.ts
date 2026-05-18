import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordGovernedTelemetry,
  recordGovernanceDecision,
  recordAIActionTrace,
  recordFederationEvent,
  recordRouteTelemetry,
  recordPublicationEvent,
} from '../telemetry';
import { flushObservabilityLedger, clearObservabilityLedger } from '../ledger';

beforeEach(() => {
  clearObservabilityLedger();
});

describe('recordGovernedTelemetry', () => {
  it('writes an event to the ledger', async () => {
    await recordGovernedTelemetry({
      operationId: 'test.op',
      category: 'governance',
      sensitivity: 'internal',
    });
    const events = flushObservabilityLedger();
    expect(events).toHaveLength(1);
    expect(events[0].operationId).toBe('test.op');
    expect(events[0].category).toBe('governance');
  });

  it('derives sensitivity from governanceSensitivity when sensitivity not provided', async () => {
    await recordGovernedTelemetry({
      operationId: 'op.critical',
      category: 'audit',
      governanceSensitivity: 'critical',
    });
    const events = flushObservabilityLedger();
    expect(events[0].sensitivity).toBe('restricted');
  });

  it('defaults to internal sensitivity when neither is provided', async () => {
    await recordGovernedTelemetry({ operationId: 'op.default', category: 'governance' });
    const events = flushObservabilityLedger();
    expect(events[0].sensitivity).toBe('internal');
  });

  it('always uses shadow mode', async () => {
    await recordGovernedTelemetry({ operationId: 'op', category: 'governance' });
    const events = flushObservabilityLedger();
    expect(events[0].governanceMode).toBe('shadow');
  });

  it('never throws on any input', async () => {
    await expect(
      recordGovernedTelemetry({ operationId: 'op', category: 'governance' }),
    ).resolves.not.toThrow();
  });
});

describe('recordGovernanceDecision', () => {
  it('writes a governance category event', async () => {
    await recordGovernanceDecision({
      operationId: 'route.exec',
      contractId: 'route.standard',
      allowed: true,
      unmetRequirements: [],
      governanceSensitivity: 'moderate',
    });
    const events = flushObservabilityLedger();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('governance');
    expect(events[0].contractId).toBe('route.standard');
    expect((events[0].metadata as Record<string, unknown>)['allowed']).toBe(true);
  });
});

describe('recordAIActionTrace', () => {
  it('writes an ai-operation event', async () => {
    await recordAIActionTrace({
      operationId: 'grievance.summarise',
      risk: 'sensitive',
      humanReviewTriggered: true,
    });
    const events = flushObservabilityLedger();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('ai-operation');
    expect(events[0].sensitivity).toBe('confidential');
    const trace = (events[0].metadata as Record<string, unknown>)['aiTrace'] as Record<string, unknown>;
    expect(trace.humanReviewTriggered).toBe(true);
  });

  it('sets sensitivity to restricted for restricted AI operations', async () => {
    await recordAIActionTrace({
      operationId: 'communication.draft',
      risk: 'restricted',
      humanReviewTriggered: true,
    });
    const events = flushObservabilityLedger();
    expect(events[0].sensitivity).toBe('restricted');
  });
});

describe('recordFederationEvent', () => {
  it('writes a federation category event', async () => {
    await recordFederationEvent({
      orgId: 'org-local-1',
      parentOrgId: 'org-national',
      tier: 'local',
      contractId: 'route.governed',
      operationId: 'federation.escalation',
      escalatedToParent: true,
    });
    const events = flushObservabilityLedger();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('federation');
    const trace = (events[0].metadata as Record<string, unknown>)['federationTrace'] as Record<string, unknown>;
    expect(trace.escalatedToParent).toBe(true);
  });

  it('sets sensitivity to restricted when override rejected or publication denied', async () => {
    await recordFederationEvent({
      orgId: 'org-1',
      tier: 'regional',
      contractId: 'contract.id',
      operationId: 'federation.op',
      publicationDenied: true,
    });
    const events = flushObservabilityLedger();
    expect(events[0].sensitivity).toBe('restricted');
  });
});

describe('recordRouteTelemetry', () => {
  it('classifies and records a route event', async () => {
    await recordRouteTelemetry({ routePath: '/api/export/report' });
    const events = flushObservabilityLedger();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('export');
    expect(events[0].sensitivity).toBe('restricted');
  });
});

describe('recordPublicationEvent', () => {
  it('records a publication event with correct category', async () => {
    await recordPublicationEvent({
      surfaceId: 'surface-1',
      isPublic: true,
      isFederation: false,
      targetStatus: 'published',
      actorId: 'user-1',
      allowed: true,
    });
    const events = flushObservabilityLedger();
    expect(events).toHaveLength(1);
    expect(events[0].category).toBe('publication');
    expect(events[0].operationId).toBe('publication.surface-1');
  });

  it('records a federation publication event with federation category', async () => {
    await recordPublicationEvent({
      surfaceId: 'fed-surface-1',
      isPublic: true,
      isFederation: true,
      targetStatus: 'published',
      actorId: 'user-2',
      allowed: false,
    });
    const events = flushObservabilityLedger();
    expect(events[0].category).toBe('federation');
    expect(events[0].sensitivity).toBe('restricted');
  });
});
