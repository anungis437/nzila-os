import { describe, expect, it, vi } from 'vitest';

import {
  OrgContextRequiredError,
  OrgContractViolationError,
  assertPlatformTenantId,
  resolvePlatformTenantId,
  type OrgContext,
  type TenantVerifier,
} from '../index';
import {
  FOUNDATIONAL_PATHS,
  FOUNDATIONAL_PATH_VALUES,
} from '../foundational-paths';

const VALID_UUID = '11111111-2222-3333-4444-555555555555';
const OTHER_UUID = '99999999-8888-7777-6666-555555555555';

function makeContext(overrides: Partial<OrgContext> = {}): OrgContext {
  return {
    userId: 'user_abc',
    explicitOrgId: null,
    isProduction: true,
    allowDefaultOrg: false,
    ...overrides,
  };
}

function makeVerifier(map: Record<string, string | null>): TenantVerifier {
  return {
    verifyOrg: vi.fn(async (orgId: string) => map[orgId] ?? null),
  };
}

describe('resolvePlatformTenantId — fail-closed contract', () => {
  it('throws OrgContextRequiredError when no explicitOrgId is supplied', async () => {
    const verifier = makeVerifier({});
    await expect(
      resolvePlatformTenantId(makeContext(), verifier),
    ).rejects.toBeInstanceOf(OrgContextRequiredError);
    expect(verifier.verifyOrg).not.toHaveBeenCalled();
  });

  it('throws OrgContractViolationError when explicitOrgId is not a UUID', async () => {
    const verifier = makeVerifier({});
    await expect(
      resolvePlatformTenantId(
        makeContext({ explicitOrgId: 'not-a-uuid' }),
        verifier,
      ),
    ).rejects.toBeInstanceOf(OrgContractViolationError);
    expect(verifier.verifyOrg).not.toHaveBeenCalled();
  });

  it('throws OrgContractViolationError when the tenant is not present', async () => {
    const verifier = makeVerifier({ [VALID_UUID]: null });
    await expect(
      resolvePlatformTenantId(
        makeContext({ explicitOrgId: VALID_UUID }),
        verifier,
      ),
    ).rejects.toBeInstanceOf(OrgContractViolationError);
  });

  it('throws OrgContractViolationError when the CHECK constraint is broken', async () => {
    // Verifier returns a different UUID → broken CHECK invariant.
    const verifier = makeVerifier({ [VALID_UUID]: OTHER_UUID });
    await expect(
      resolvePlatformTenantId(
        makeContext({ explicitOrgId: VALID_UUID }),
        verifier,
      ),
    ).rejects.toBeInstanceOf(OrgContractViolationError);
  });

  it('returns the platform tenant id when the invariant holds', async () => {
    const verifier = makeVerifier({ [VALID_UUID]: VALID_UUID });
    const result = await resolvePlatformTenantId(
      makeContext({ explicitOrgId: VALID_UUID }),
      verifier,
    );
    expect(result).toBe(VALID_UUID);
    expect(verifier.verifyOrg).toHaveBeenCalledWith(VALID_UUID);
  });

  it('does NOT fall back to a default org even when allowDefaultOrg=true', async () => {
    const verifier = makeVerifier({});
    await expect(
      resolvePlatformTenantId(
        makeContext({
          explicitOrgId: null,
          isProduction: false,
          allowDefaultOrg: true,
        }),
        verifier,
      ),
    ).rejects.toBeInstanceOf(OrgContextRequiredError);
  });
});

describe('assertPlatformTenantId', () => {
  it('accepts a valid UUID', () => {
    expect(assertPlatformTenantId(VALID_UUID)).toBe(VALID_UUID);
  });

  it('rejects non-UUID input', () => {
    expect(() => assertPlatformTenantId('nope')).toThrow(
      OrgContractViolationError,
    );
  });
});

describe('FOUNDATIONAL_PATHS', () => {
  it('enumerates exactly the five paths declared in the strategy doc', () => {
    expect(Object.keys(FOUNDATIONAL_PATHS)).toEqual([
      'PILOT_DEFINITIONS_WRITE',
      'PILOT_METRIC_EVENTS_WRITE',
      'KPI_SNAPSHOT_ORG_OWNERSHIP',
      'RLS_SESSION_CONTEXT',
      'AUDIT_EVENT_WRITE',
    ]);
    expect(FOUNDATIONAL_PATH_VALUES).toHaveLength(5);
  });

  it('has stable, unique string values', () => {
    const values = new Set(FOUNDATIONAL_PATH_VALUES);
    expect(values.size).toBe(FOUNDATIONAL_PATH_VALUES.length);
  });
});
