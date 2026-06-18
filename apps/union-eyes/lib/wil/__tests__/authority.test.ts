import { describe, expect, it } from 'vitest';

import {
  toAuthorityRole,
  userCanAssignPriority,
  userCanConvertIntake,
  userCanCreateIntake,
  userCanCreateOfficialWorkItem,
  userCanOverridePriority,
} from '../authority';

describe('lib/wil/authority', () => {
  describe('toAuthorityRole', () => {
    it('passes through known WIL roles', () => {
      expect(toAuthorityRole('steward')).toBe('steward');
      expect(toAuthorityRole('president')).toBe('president');
    });
    it('maps unknown roles to member', () => {
      expect(toAuthorityRole('support_agent')).toBe('member');
      expect(toAuthorityRole('totally_unknown')).toBe('member');
    });
  });

  describe('authority delegation', () => {
    it('members cannot create official work items but stewards can', () => {
      expect(userCanCreateOfficialWorkItem('member')).toBe(false);
      expect(userCanCreateOfficialWorkItem('steward')).toBe(true);
    });
    it('members cannot convert intake but stewards can', () => {
      expect(userCanConvertIntake('member')).toBe(false);
      expect(userCanConvertIntake('steward')).toBe(true);
    });
    it('members can create an intake', () => {
      expect(userCanCreateIntake('member')).toBe(true);
    });
    it('priority assignment and override return booleans', () => {
      expect(typeof userCanAssignPriority('steward')).toBe('boolean');
      expect(typeof userCanOverridePriority('president')).toBe('boolean');
    });
  });
});
