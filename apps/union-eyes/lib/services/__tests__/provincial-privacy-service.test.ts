/**
 * Provincial Privacy Service — Unit Tests
 *
 * Tests:
 *   - QC rules have 24h breach notification
 *   - ON rules have correct authority
 *   - AB rules have correct requirements
 *   - BC rules have correct requirements
 *   - Unknown province falls back to FEDERAL/PIPEDA
 *
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/db', () => ({
  db: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getPrivacyRules } from '../provincial-privacy-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('provincial-privacy-service', () => {
  it('returns QC rules with 24h breach notification', () => {
    const rules = getPrivacyRules('QC');
    expect(rules.province).toBe('QC');
    expect(rules.breachNotificationHours).toBe(24);
    expect(rules.consentRequired).toBe(true);
    expect(rules.specificRequirements).toContain('Breach notification within 24 hours');
  });

  it('returns ON rules with correct authority', () => {
    const rules = getPrivacyRules('ON');
    expect(rules.province).toBe('ON');
    expect(rules.breachNotificationHours).toBe(72);
    expect(rules.contactAuthority).toContain('Ontario');
  });

  it('returns AB rules', () => {
    const rules = getPrivacyRules('AB');
    expect(rules.province).toBe('AB');
    expect(rules.breachNotificationHours).toBe(72);
    expect(rules.contactAuthority).toContain('Alberta');
  });

  it('returns BC rules', () => {
    const rules = getPrivacyRules('BC');
    expect(rules.province).toBe('BC');
    expect(rules.consentRequired).toBe(true);
    expect(rules.dataRetentionDays).toBe(2555);
  });

  it('falls back to FEDERAL PIPEDA for unknown provinces', () => {
    const rules = getPrivacyRules('XX');
    expect(rules.province).toBe('FEDERAL');
    expect(rules.contactAuthority).toContain('Privacy Commissioner of Canada');
  });
});
