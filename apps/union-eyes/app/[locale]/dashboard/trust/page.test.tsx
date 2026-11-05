// @vitest-environment jsdom
/**
 * The trust page is a server component: it formats its dates and numbers on the server, where the process default locale is not the reader's. It reads them in the reader's language
 * (next-intl's getLocale), and a calendar day (the last election) as that day wherever the process runs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { TrustMetrics } from '@/types/marketing';

const h = vi.hoisted(() => ({ locale: 'fr-CA' }));
vi.mock('next-intl/server', () => ({ getLocale: async () => h.locale, getTranslations: async () => (key: string) => key }));
// The status badges are client components that format in the reader's locale (useLocale).
vi.mock('next-intl', () => ({ useLocale: () => h.locale, useTranslations: () => (key: string) => key }));
vi.mock('@/lib/page-data/organization-scope', () => ({ requireOrganizationScope: async () => ({ organizationId: 'org-1' }) }));

const AUDIT = new Date('2026-05-24T18:30:00.000Z');
const metrics: TrustMetrics = {
  immutability: { status: 'active', verification: true, lastCheck: AUDIT, description: 'Immutable historical records verified.', triggersActive: true, tablesProtected: ['audit_logs', 'approval_records'], violationAttempts: null, lastAudit: AUDIT },
  rlsEnforcement: { status: 'degraded', verification: false, lastCheck: AUDIT, description: '2 of 3 tables enforce row-level security.', policiesActive: 6, orgIsolation: '66%', lastPolicyCheck: AUDIT, tablesProtected: ['organizations', 'members'] },
  fsmValidation: { status: 'unknown', verification: false, lastCheck: AUDIT, description: 'FSM metrics source not configured.', invalidTransitionsBlocked: 0, complianceRate: 0, lastValidation: AUDIT },
  governance: { status: 'active', verification: true, lastCheck: AUDIT, description: 'Golden share oversight is active.', goldenShareActive: true, goldenShareHolder: 'Member Oversight Council', lastElectionDate: new Date('2026-01-01T00:00:00.000Z'), reservedMattersProtection: 'active' },
  auditLog: { status: 'active', verification: true, lastCheck: AUDIT, description: 'Audit trail is healthy.', eventsLogged: 1234567, retentionPolicy: '7 years' },
  lastUpdated: AUDIT,
};
vi.mock('@/lib/trust/system-metrics', () => ({ getTrustMetrics: async () => metrics }));

import TrustPage from './page';

const zone = process.env.TZ;
afterEach(() => {
  cleanup();
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

const textOf = async () => {
  const { container } = render(await TrustPage());
  return container.textContent ?? '';
};

describe('trust page', () => {
  it('reads its numbers and dates in the language of the reader, not the language of the server', async () => {
    h.locale = 'fr-CA';
    const french = await textOf();
    expect(french).toContain((1234567).toLocaleString('fr-CA'));
    expect(french).toContain(AUDIT.toLocaleDateString('fr-CA'));
    cleanup();

    h.locale = 'it';
    const italian = await textOf();
    expect(italian).toContain((1234567).toLocaleString('it'));
    expect(italian).toContain(AUDIT.toLocaleDateString('it'));
    // The two languages write the same figure differently, so a page that ignored the locale would match one at most.
    expect((1234567).toLocaleString('fr-CA')).not.toBe((1234567).toLocaleString('it'));
  });

  it('shows the day of the last election that was recorded, not the evening before it, in a zone west of Greenwich', async () => {
    process.env.TZ = 'America/Toronto';
    h.locale = 'fr-CA';
    const text = await textOf();
    // Stored as UTC midnight on 1 January: read as an instant in Toronto it would be 31 December.
    expect(text).toContain('lastElection: 2026-01-01');
    expect(text).not.toContain('2025-12-31');
  });
});
