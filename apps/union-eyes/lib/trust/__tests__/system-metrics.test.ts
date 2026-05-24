import { describe, expect, it } from 'vitest';
import { exportTrustMetricsPDF } from '../system-metrics';
import type { TrustMetrics } from '@/types/marketing';

const metrics: TrustMetrics = {
  immutability: {
    status: 'active',
    verification: true,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: 'Immutable historical records verified.',
    triggersActive: true,
    tablesProtected: ['audit_logs', 'approval_records'],
    violationAttempts: 0,
    lastAudit: new Date('2026-05-24T00:00:00.000Z'),
  },
  rlsEnforcement: {
    status: 'active',
    verification: true,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: 'RLS policies active across tenant data.',
    policiesActive: 6,
    orgIsolation: '100%',
    lastPolicyCheck: new Date('2026-05-24T00:00:00.000Z'),
    tablesProtected: ['organizations', 'members'],
  },
  fsmValidation: {
    status: 'unknown',
    verification: false,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: 'FSM metrics source not configured.',
    invalidTransitionsBlocked: 0,
    complianceRate: 0,
    lastValidation: new Date('2026-05-24T00:00:00.000Z'),
  },
  governance: {
    status: 'active',
    verification: true,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: 'Golden share oversight is active.',
    goldenShareActive: true,
    goldenShareHolder: 'Member Oversight Council',
    lastElectionDate: new Date('2026-01-01T00:00:00.000Z'),
    reservedMattersProtection: 'active',
    upcomingElection: new Date('2027-01-01T00:00:00.000Z'),
  },
  auditLog: {
    status: 'active',
    verification: true,
    lastCheck: new Date('2026-05-24T00:00:00.000Z'),
    description: 'Audit trail is healthy.',
    eventsLogged: 1200,
    retentionPolicy: '7 years',
    lastArchive: new Date('2026-05-01T00:00:00.000Z'),
    archivedEvents: 42000,
  },
  lastUpdated: new Date('2026-05-24T00:00:00.000Z'),
};

describe('exportTrustMetricsPDF', () => {
  it('returns a real PDF blob', async () => {
    const blob = await exportTrustMetricsPDF(metrics);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});