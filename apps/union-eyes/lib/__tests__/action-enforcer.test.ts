import { describe, it, expect } from 'vitest';
import {
  canPerformAction,
  CUPE_ACTIONS,
  type CUPEAction,
  type CUPERole,
} from '../action-enforcer';

describe('action-enforcer', () => {
  it('allows members to create cases', () => {
    const result = canPerformAction('case_create', 'member');
    expect(result).toEqual({ allowed: true, reason: 'ok' });
  });

  it('denies members from reading any case', () => {
    const result = canPerformAction('case_read_any', 'member');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('lacks privilege');
  });

  it('allows admin to manage users', () => {
    const result = canPerformAction('user_manage', 'admin');
    expect(result).toEqual({ allowed: true, reason: 'ok' });
  });

  it('denies officer from admin_config', () => {
    const result = canPerformAction('admin_config', 'officer');
    expect(result.allowed).toBe(false);
  });

  it('allows platform_admin to do everything', () => {
    for (const action of CUPE_ACTIONS) {
      const result = canPerformAction(action, 'platform_admin');
      expect(result.allowed).toBe(true);
    }
  });

  it('chief_steward can close resolved cases', () => {
    const result = canPerformAction('case_close', 'chief_steward', {
      caseStatus: 'resolved',
    });
    expect(result.allowed).toBe(true);
  });

  it('chief_steward cannot close open cases', () => {
    const result = canPerformAction('case_close', 'chief_steward', {
      caseStatus: 'open',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('resolved or rejected');
  });

  it('returns error for unknown role', () => {
    const result = canPerformAction('case_create', 'ghost' as CUPERole);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Unknown role');
  });

  it('allows steward to transition cases', () => {
    const result = canPerformAction('case_transition', 'steward');
    expect(result.allowed).toBe(true);
  });

  it('denies member from adding internal notes', () => {
    const result = canPerformAction('note_add_internal', 'member');
    expect(result.allowed).toBe(false);
  });
});
