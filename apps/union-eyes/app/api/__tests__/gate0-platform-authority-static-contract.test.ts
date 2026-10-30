/**
 * Gate 0 institutional access invariants: platform role titles never confer
 * cross-tenant information access or membership offboarding authority.
 * Behavioral tests are maintained by each route; these checks prevent a
 * future refactor from silently restoring a legacy platform-title bypass.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

describe('product-owner-approved no-standing-cross-tenant-authority baseline', () => {
  it('pilot overview gates enrollment metrics to direct tenant administrators', () => {
    const source = read('pilot/overview/route.ts');
    expect(source).toContain('resolveOrganizationAccess(user.userId)');
    expect(source).toContain('isAdministrativeRole(role)');
    expect(source).toContain('inArray(pilotEnrollments.organizationId, permittedOrgIds)');
    expect(source).not.toContain('isPlatformAdminUser(');
  });
  it('membership revocation validates the exact target tenant after resolving the member', () => {
    const source = read('admin/users/[userId]/route.ts');
    expect(source).toContain('resolveOrganizationAccess(callerId)');
    expect(source).toContain('isAdministrativeRole(access.direct.get(memberRecord.organizationId))');
    expect(source).toContain('Privileged reactivation requires independent office approval');
    expect(source).not.toContain('isPlatformAdminUser(');
  });
  it('ordinary billing endpoints cannot issue financial charges without mandate validation', () => {
    const source = read('admin/billing-cycles/route.ts');
    const refusal = source.indexOf('BILLING_CYCLE_EXECUTION_UNQUALIFIED');
    const attempt = source.indexOf('BillingCycleService.generateBillingCycle(');
    expect(refusal).toBeGreaterThan(0);
    expect(attempt).toBeGreaterThan(refusal);
    expect(source).toContain('requireAuthorizedBillingPreview(user.id, organizationId)');
  });
});
