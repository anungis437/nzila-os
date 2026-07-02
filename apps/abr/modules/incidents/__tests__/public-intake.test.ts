/**
 * CourtLens Phase 2A tests — public intake service and unknown practiceArea fix.
 *
 * Proves that:
 * - Unknown practice area is never silently treated as 'housing'.
 * - 'unknown' is the safe default for unset practice areas.
 * - assertValidPracticeArea rejects 'unknown' at intake time.
 * - Valid housing/employment/debt intakes create matters with CourtLens events.
 * - Consent is required and cannot be bypassed.
 * - Invalid practice area, sub-issue, and risk flag keys are rejected.
 * - Public confirmation response is safe (no internal data).
 * - Legal boundary notice is present on every confirmation.
 * - Tenant scope is preserved through the intake path.
 * - Existing matter-service and matter-events tests still pass (non-regression).
 */

import { describe, it, expect } from 'vitest';
import {
  validatePublicIntakeInput,
  createMatterFromPublicIntake,
  type PublicIntakeInput,
} from '../public-intake';
import {
  defaultCourtLensFields,
} from '../courtlens';
import { assertValidPracticeArea, CourtLensValidationError, listMatters, getMatterDetail } from '../matter-service';
import { isValidTenantSlug, TenantNotFoundError } from '../../tenants/tenant-resolver';

// ── Unknown practiceArea — safe default ───────────────────────────────────────

describe('practiceArea unknown default (Phase 2A fix)', () => {
  it('defaultCourtLensFields() with no args defaults practiceArea to unknown', () => {
    expect(defaultCourtLensFields().practiceArea).toBe('unknown');
  });

  it('defaultCourtLensFields("unknown") works', () => {
    expect(defaultCourtLensFields('unknown').practiceArea).toBe('unknown');
  });

  it('assertValidPracticeArea rejects "unknown" — not a valid intake value', () => {
    expect(() => assertValidPracticeArea('unknown')).toThrow(CourtLensValidationError);
  });

  it('assertValidPracticeArea accepts housing, employment, debt', () => {
    expect(() => assertValidPracticeArea('housing')).not.toThrow();
    expect(() => assertValidPracticeArea('employment')).not.toThrow();
    expect(() => assertValidPracticeArea('debt')).not.toThrow();
  });

  it('listMatters returns unknown practiceArea for matters without events replayed', async () => {
    const orgId = 'org-2a-list-test';
    const matters = await listMatters(orgId);
    // All projected items (demo data) should have practiceArea 'unknown', not 'housing'
    for (const m of matters) {
      expect(m.practiceArea).toBe('unknown');
    }
  });
});

// ── validatePublicIntakeInput ─────────────────────────────────────────────────

describe('validatePublicIntakeInput', () => {
  const validHousing: PublicIntakeInput = {
    tenantSlug: 'org-clinic-test',
    practiceArea: 'housing',
    subIssue: 'eviction',
    summary: 'My landlord sent an eviction notice and I have nowhere to go.',
    consentAcknowledged: true,
  };

  it('accepts a valid housing intake', () => {
    const result = validatePublicIntakeInput(validHousing);
    expect(result.ok).toBe(true);
  });

  it('accepts a valid employment intake', () => {
    const result = validatePublicIntakeInput({
      ...validHousing,
      practiceArea: 'employment',
      subIssue: 'unpaid_wages',
      summary: 'My employer has not paid me for three weeks of work completed.',
    });
    expect(result.ok).toBe(true);
  });

  it('accepts a valid debt intake', () => {
    const result = validatePublicIntakeInput({
      ...validHousing,
      practiceArea: 'debt',
      subIssue: 'wage_garnishment',
      summary: 'I received papers about wage garnishment for a debt I do not recognise.',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects missing tenantSlug', () => {
    const r = validatePublicIntakeInput({ ...validHousing, tenantSlug: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'MISSING_TENANT_SLUG')).toBe(true);
  });

  it('rejects malformed tenantSlug', () => {
    const r = validatePublicIntakeInput({ ...validHousing, tenantSlug: 'ab' }); // too short
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'INVALID_TENANT_SLUG')).toBe(true);
  });

  it('rejects unknown practiceArea', () => {
    const r = validatePublicIntakeInput({ ...validHousing, practiceArea: 'criminal' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'INVALID_PRACTICE_AREA')).toBe(true);
  });

  it('rejects "unknown" practiceArea — not a valid intake value', () => {
    const r = validatePublicIntakeInput({ ...validHousing, practiceArea: 'unknown' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'INVALID_PRACTICE_AREA')).toBe(true);
  });

  it('rejects unknown subIssue', () => {
    const r = validatePublicIntakeInput({ ...validHousing, subIssue: 'parking_dispute' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'INVALID_SUB_ISSUE')).toBe(true);
  });

  it('rejects summary shorter than 10 characters', () => {
    const r = validatePublicIntakeInput({ ...validHousing, summary: 'too short' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'INVALID_SUMMARY')).toBe(true);
  });

  it('rejects false consent', () => {
    const r = validatePublicIntakeInput({ ...validHousing, consentAcknowledged: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'CONSENT_REQUIRED')).toBe(true);
  });

  it('rejects missing consent (undefined)', () => {
    const body = { ...validHousing } as Record<string, unknown>;
    delete body.consentAcknowledged;
    const r = validatePublicIntakeInput(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'CONSENT_REQUIRED')).toBe(true);
  });

  it('rejects unknown risk flag key', () => {
    const r = validatePublicIntakeInput({
      ...validHousing,
      riskFlags: { risk_eviction: true, risk_flying_car: true },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'INVALID_RISK_FLAG_KEY')).toBe(true);
  });

  it('accepts valid known risk flags', () => {
    const r = validatePublicIntakeInput({
      ...validHousing,
      riskFlags: { risk_eviction: true, risk_lockout: false },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects malformed hearingDate', () => {
    const r = validatePublicIntakeInput({ ...validHousing, hearingDate: 'next Tuesday' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'INVALID_HEARING_DATE')).toBe(true);
  });

  it('accepts valid ISO hearingDate', () => {
    const r = validatePublicIntakeInput({ ...validHousing, hearingDate: '2026-09-15' });
    expect(r.ok).toBe(true);
  });

  it('returns multiple errors simultaneously', () => {
    const r = validatePublicIntakeInput({
      tenantSlug: '',
      practiceArea: 'criminal',
      subIssue: '',
      summary: 'short',
      consentAcknowledged: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });
});

// ── Tenant resolver — Phase 2B ────────────────────────────────────────────────

describe('isValidTenantSlug', () => {
  it('accepts valid slugs', () => {
    expect(isValidTenantSlug('metro-university')).toBe(true);
    expect(isValidTenantSlug('org-clinic-1')).toBe(true);
    expect(isValidTenantSlug('abc')).toBe(true);
  });

  it('rejects too-short slugs', () => {
    expect(isValidTenantSlug('ab')).toBe(false);
    expect(isValidTenantSlug('')).toBe(false);
  });

  it('rejects slugs with invalid characters', () => {
    expect(isValidTenantSlug('org/slash')).toBe(false);
    expect(isValidTenantSlug('org space')).toBe(false);
    expect(isValidTenantSlug('org@at')).toBe(false);
  });

  it('rejects slug starting with hyphen', () => {
    expect(isValidTenantSlug('-org')).toBe(false);
  });
});

describe('TenantNotFoundError', () => {
  it('has a generic message that does not expose the slug', () => {
    const err = new TenantNotFoundError('unknown-org');
    expect(err.message).not.toContain('unknown-org');
    expect(err.name).toBe('TenantNotFoundError');
  });
});

// ── createMatterFromPublicIntake — integration with tenant resolver ───────────
// Uses real demo org slugs so the tenant resolver can resolve them in
// in-memory mode without a DB.

describe('createMatterFromPublicIntake — full integration with resolver', () => {
  it('housing intake creates matter with correct practiceArea via event replay', async () => {
    const conf = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'housing',
      subIssue: 'eviction',
      summary: 'Eviction notice received with 14-day deadline.',
      consentAcknowledged: true,
    });

    expect(conf.practiceArea).toBe('housing');
    expect(conf.matterId).toBeTruthy();
    expect(conf.statusLabel).toBe('New Intake');
    expect(conf.legalBoundaryNotice).toBeTruthy();

    const detail = await getMatterDetail('metro-university', conf.matterId);
    expect(detail!.matter.practiceArea).toBe('housing');
    expect(detail!.matter.subIssue).toBe('eviction');
  });

  it('employment intake creates matter with correct practiceArea', async () => {
    const conf = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'employment',
      subIssue: 'unpaid_wages',
      summary: 'Employer has not paid wages for four weeks of completed work.',
      consentAcknowledged: true,
    });

    const detail = await getMatterDetail('metro-university', conf.matterId);
    expect(detail!.matter.practiceArea).toBe('employment');
    expect(detail!.matter.subIssue).toBe('unpaid_wages');
  });

  it('debt intake creates matter with correct practiceArea', async () => {
    const conf = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'debt',
      subIssue: 'collector_harassment',
      summary: 'Collector is calling multiple times per day about a debt I do not recognize.',
      consentAcknowledged: true,
    });

    const detail = await getMatterDetail('metro-university', conf.matterId);
    expect(detail!.matter.practiceArea).toBe('debt');
  });

  it('unknown tenant slug is rejected — TenantNotFoundError', async () => {
    await expect(createMatterFromPublicIntake({
      tenantSlug: 'not-a-real-org',
      practiceArea: 'housing',
      subIssue: 'eviction',
      summary: 'Eviction notice received with imminent deadline.',
      consentAcknowledged: true,
    })).rejects.toThrow(TenantNotFoundError);
  });

  it('malformed tenant slug is rejected', async () => {
    await expect(createMatterFromPublicIntake({
      tenantSlug: 'ab',
      practiceArea: 'housing',
      subIssue: 'eviction',
      summary: 'Eviction notice received with imminent deadline.',
      consentAcknowledged: true,
    })).rejects.toThrow(TenantNotFoundError);
  });

  it('risk flags are persisted and reconstructed via event replay', async () => {
    const conf = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'housing',
      subIssue: 'eviction',
      summary: 'Eviction notice received and at risk of losing housing.',
      consentAcknowledged: true,
      riskFlags: { risk_eviction: true, risk_homelessness: true },
    });

    const detail = await getMatterDetail('metro-university', conf.matterId);
    expect(detail!.matter.riskFlags.risk_eviction).toBe(true);
    expect(detail!.matter.riskFlags.risk_homelessness).toBe(true);
    expect(detail!.matter.riskFlags.risk_lockout).toBe(false);
  });

  it('critical risk flags derive severity critical', async () => {
    const conf = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'housing',
      subIssue: 'lockout',
      summary: 'I have been locked out of my apartment without notice.',
      consentAcknowledged: true,
      riskFlags: { risk_lockout: true },
    });

    const detail = await getMatterDetail('metro-university', conf.matterId);
    expect(detail!.matter.severity).toBe('critical');
  });

  it('no deadline and no critical flags derive severity low', async () => {
    const conf = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'debt',
      subIssue: 'collection_letter',
      summary: 'I received a collection letter for a small debt amount.',
      consentAcknowledged: true,
    });

    const detail = await getMatterDetail('metro-university', conf.matterId);
    expect(detail!.matter.severity).toBe('low');
  });

  it('client profile is persisted and reconstructed', async () => {
    const conf = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'housing',
      subIssue: 'rent_arrears',
      summary: 'I am behind on rent due to unexpected medical costs.',
      consentAcknowledged: true,
      contactName: 'Jane Smith',
      contactEmail: 'jsmith@example.com',
      householdSize: 3,
      hasChildren: true,
    });

    const detail = await getMatterDetail('metro-university', conf.matterId);
    expect(detail!.matter.clientProfile?.clientName).toBe('Jane Smith');
    expect(detail!.matter.clientProfile?.hasChildren).toBe(true);
    expect(detail!.matter.clientProfile?.consentStatus).toBe('granted');
  });

  it('tenant org scope is preserved — different demo orgs are isolated', async () => {
    const confA = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'housing', subIssue: 'eviction',
      summary: 'Metro University client facing eviction in 14 days.',
      consentAcknowledged: true,
    });

    const confB = await createMatterFromPublicIntake({
      tenantSlug: 'northcare-hospital',
      practiceArea: 'employment', subIssue: 'termination',
      summary: 'NorthCare Hospital worker terminated without cause or notice.',
      consentAcknowledged: true,
    });

    const detailA = await getMatterDetail('metro-university', confA.matterId);
    const detailB = await getMatterDetail('northcare-hospital', confB.matterId);

    expect(detailA!.matter.orgId).toBe('metro-university');
    expect(detailB!.matter.orgId).toBe('northcare-hospital');

    // Cross-tenant isolation: metro-university cannot see northcare-hospital matter
    const crossTenant = await getMatterDetail('metro-university', confB.matterId);
    expect(crossTenant).toBeNull();
  });

  it('public confirmation never exposes internal data', async () => {
    const conf = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'housing', subIssue: 'eviction',
      summary: 'Eviction notice — need legal help urgently.',
      consentAcknowledged: true,
    });

    const keys = Object.keys(conf);
    expect(keys).not.toContain('orgId');
    expect(keys).not.toContain('tenantSlug');
    expect(keys).not.toContain('events');
    expect(keys).not.toContain('notes');
    expect(keys).not.toContain('riskFlags');
    expect(keys).not.toContain('clientProfile');
    expect(keys).not.toContain('aiSummaryStatus');
    expect(keys).not.toContain('referralStatus');
  });

  it('legal boundary notice is always present and non-advisory', async () => {
    const conf = await createMatterFromPublicIntake({
      tenantSlug: 'metro-university',
      practiceArea: 'housing', subIssue: 'eviction',
      summary: 'Eviction notice received with imminent deadline.',
      consentAcknowledged: true,
    });

    expect(conf.legalBoundaryNotice).toBeTruthy();
    expect(conf.legalBoundaryNotice.length).toBeGreaterThan(50);
    expect(conf.legalBoundaryNotice.toLowerCase()).toContain('does not provide legal advice');
    expect(conf.legalBoundaryNotice.toLowerCase()).not.toMatch(/will (give|provide|offer) legal advice/);
    expect(conf.legalBoundaryNotice.toLowerCase()).not.toMatch(/legal outcome|legal conclusion/);
  });
});
