import { describe, it, expect } from 'vitest';
import { enforceCreateSecurityInvariants } from '../crud-factory';

describe('crud-factory enforceCreateSecurityInvariants', () => {
  it('applies organizationId/createdBy when a hook returns a clean object without them', () => {
    const result = enforceCreateSecurityInvariants(
      { description: 'a hazard' },
      { organizationId: 'org-real', userId: 'user-real', hasOrgColumn: true, hasCreatedByColumn: true },
    );
    expect(result.organizationId).toBe('org-real');
    expect(result.createdBy).toBe('user-real');
  });

  it('cannot have organizationId removed by a hostile beforeCreate result', () => {
    const hostileResult: Record<string, unknown> = { description: 'a hazard' };
    delete hostileResult.organizationId;
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result.organizationId).toBe('org-real');
  });

  it('cannot have organizationId replaced by a hostile beforeCreate result', () => {
    const hostileResult = { description: 'a hazard', organizationId: 'attacker-controlled-org' };
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result.organizationId).toBe('org-real');
    expect(result.organizationId).not.toBe('attacker-controlled-org');
  });

  it('cannot have createdBy removed by a hostile beforeCreate result', () => {
    const hostileResult: Record<string, unknown> = { description: 'a hazard' };
    delete hostileResult.createdBy;
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result.createdBy).toBe('user-real');
  });

  it('cannot have createdBy replaced by a hostile beforeCreate result', () => {
    const hostileResult = { description: 'a hazard', createdBy: 'attacker-controlled-user' };
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result.createdBy).toBe('user-real');
    expect(result.createdBy).not.toBe('attacker-controlled-user');
  });

  it('cannot have both organizationId and createdBy stripped and replaced simultaneously', () => {
    const hostileResult = {
      description: 'a hazard',
      organizationId: 'attacker-controlled-org',
      createdBy: 'attacker-controlled-user',
    };
    const result = enforceCreateSecurityInvariants(hostileResult, {
      organizationId: 'org-real',
      userId: 'user-real',
      hasOrgColumn: true,
      hasCreatedByColumn: true,
    });
    expect(result).toMatchObject({
      description: 'a hazard',
      organizationId: 'org-real',
      createdBy: 'user-real',
    });
  });

  it('preserves other transformed business fields untouched', () => {
    const result = enforceCreateSecurityInvariants(
      { hazardCategory: 'fire', hazardLevel: 'high', organizationId: 'attacker-org' },
      { organizationId: 'org-real', userId: 'user-real', hasOrgColumn: true, hasCreatedByColumn: true },
    );
    expect(result.hazardCategory).toBe('fire');
    expect(result.hazardLevel).toBe('high');
    expect(result.organizationId).toBe('org-real');
  });

  it('does not set organizationId when the table is not org-scoped, even if the context has one', () => {
    const result = enforceCreateSecurityInvariants(
      { organizationId: 'attacker-org' },
      { organizationId: 'org-real', userId: 'user-real', hasOrgColumn: false, hasCreatedByColumn: true },
    );
    // hasOrgColumn: false means this resource isn't org-scoped; the hook's
    // value passes through unchanged rather than being forcibly overwritten.
    expect(result.organizationId).toBe('attacker-org');
  });

  it('does not set createdBy when there is no authenticated userId in context', () => {
    const result = enforceCreateSecurityInvariants(
      { createdBy: 'client-supplied-value' },
      { organizationId: 'org-real', userId: undefined, hasOrgColumn: true, hasCreatedByColumn: true },
    );
    expect(result.createdBy).toBe('client-supplied-value');
  });
});
