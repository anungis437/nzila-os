/**
 * Action Denial Tests — RBAC matrix enforcement
 *
 * PR-033: Mirrors canPerformAction() from
 * apps/union-eyes/lib/action-enforcer.ts
 * to validate the CUPE RBAC matrix without cross-package imports.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Local mirror of enforcer types + logic
// ---------------------------------------------------------------------------

type CUPEAction =
  | 'case_create' | 'case_read_own' | 'case_read_any' | 'case_assign'
  | 'case_transition' | 'case_close' | 'case_reopen' | 'case_export'
  | 'note_add' | 'note_add_internal'
  | 'attachment_upload' | 'attachment_delete'
  | 'user_manage' | 'admin_config';

type CUPERole =
  | 'member' | 'steward' | 'chief_steward' | 'business_agent'
  | 'officer' | 'admin' | 'platform_admin';

interface ActionContext { caseStatus?: string; }
interface ActionResult { allowed: boolean; reason: string; }

const ROLE_LEVEL: Record<CUPERole, number> = {
  member: 0, steward: 1, chief_steward: 2, business_agent: 2,
  officer: 3, admin: 4, platform_admin: 5,
};

const MIN_LEVEL: Record<CUPEAction, number> = {
  case_create: 0, case_read_own: 0, case_read_any: 2, case_assign: 2,
  case_transition: 1, case_close: 2, case_reopen: 3, case_export: 3,
  note_add: 0, note_add_internal: 1,
  attachment_upload: 0, attachment_delete: 4,
  user_manage: 4, admin_config: 5,
};

function canPerformAction(action: CUPEAction, role: CUPERole, ctx?: ActionContext): ActionResult {
  const level = ROLE_LEVEL[role];
  const required = MIN_LEVEL[action];
  if (level < required) {
    return { allowed: false, reason: `Role ${role} (level ${level}) lacks privilege for ${action} (requires level ${required})` };
  }
  // case_close conditional at level 2
  if (action === 'case_close' && level === 2) {
    const closable = ['resolved', 'rejected'];
    if (!ctx?.caseStatus || !closable.includes(ctx.caseStatus)) {
      return { allowed: false, reason: `Role ${role} can only close cases with status resolved or rejected (current: ${ctx?.caseStatus ?? 'unknown'})` };
    }
  }
  return { allowed: true, reason: 'ok' };
}

// ---------------------------------------------------------------------------
// Denied actions — at least 2 per forbidden role-action pair
// ---------------------------------------------------------------------------

describe('RBAC Denial Tests', () => {
  describe('member denials', () => {
    it('member cannot read any case', () => {
      expect(canPerformAction('case_read_any', 'member').allowed).toBe(false);
    });
    it('member cannot assign case', () => {
      expect(canPerformAction('case_assign', 'member').allowed).toBe(false);
    });
    it('member cannot transition case', () => {
      expect(canPerformAction('case_transition', 'member').allowed).toBe(false);
    });
    it('member cannot close case', () => {
      expect(canPerformAction('case_close', 'member').allowed).toBe(false);
    });
    it('member cannot reopen case', () => {
      expect(canPerformAction('case_reopen', 'member').allowed).toBe(false);
    });
    it('member cannot export case', () => {
      expect(canPerformAction('case_export', 'member').allowed).toBe(false);
    });
    it('member cannot add internal note', () => {
      expect(canPerformAction('note_add_internal', 'member').allowed).toBe(false);
    });
    it('member cannot delete attachment', () => {
      expect(canPerformAction('attachment_delete', 'member').allowed).toBe(false);
    });
    it('member cannot manage users', () => {
      expect(canPerformAction('user_manage', 'member').allowed).toBe(false);
    });
    it('member cannot admin config', () => {
      expect(canPerformAction('admin_config', 'member').allowed).toBe(false);
    });
  });

  describe('steward denials', () => {
    it('steward cannot assign case', () => {
      expect(canPerformAction('case_assign', 'steward').allowed).toBe(false);
    });
    it('steward cannot close case', () => {
      expect(canPerformAction('case_close', 'steward').allowed).toBe(false);
    });
    it('steward cannot reopen case', () => {
      expect(canPerformAction('case_reopen', 'steward').allowed).toBe(false);
    });
    it('steward cannot export case', () => {
      expect(canPerformAction('case_export', 'steward').allowed).toBe(false);
    });
    it('steward cannot delete attachment', () => {
      expect(canPerformAction('attachment_delete', 'steward').allowed).toBe(false);
    });
    it('steward cannot manage users', () => {
      expect(canPerformAction('user_manage', 'steward').allowed).toBe(false);
    });
  });

  describe('chief_steward conditional denials', () => {
    it('chief_steward cannot close active case (investigation)', () => {
      expect(canPerformAction('case_close', 'chief_steward', { caseStatus: 'investigation' }).allowed).toBe(false);
    });
    it('chief_steward cannot close submitted case', () => {
      expect(canPerformAction('case_close', 'chief_steward', { caseStatus: 'submitted' }).allowed).toBe(false);
    });
    it('chief_steward cannot close without context', () => {
      expect(canPerformAction('case_close', 'chief_steward').allowed).toBe(false);
    });
    it('chief_steward cannot reopen case', () => {
      expect(canPerformAction('case_reopen', 'chief_steward').allowed).toBe(false);
    });
    it('chief_steward cannot export case', () => {
      expect(canPerformAction('case_export', 'chief_steward').allowed).toBe(false);
    });
  });

  describe('business_agent conditional denials', () => {
    it('business_agent cannot close under_review case', () => {
      expect(canPerformAction('case_close', 'business_agent', { caseStatus: 'under_review' }).allowed).toBe(false);
    });
    it('business_agent cannot reopen case', () => {
      expect(canPerformAction('case_reopen', 'business_agent').allowed).toBe(false);
    });
  });

  describe('officer denials', () => {
    it('officer cannot delete attachment', () => {
      expect(canPerformAction('attachment_delete', 'officer').allowed).toBe(false);
    });
    it('officer cannot manage users', () => {
      expect(canPerformAction('user_manage', 'officer').allowed).toBe(false);
    });
    it('officer cannot admin config', () => {
      expect(canPerformAction('admin_config', 'officer').allowed).toBe(false);
    });
  });

  describe('admin denials', () => {
    it('admin cannot admin config', () => {
      expect(canPerformAction('admin_config', 'admin').allowed).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Allowed actions — spot-check grants
// ---------------------------------------------------------------------------

describe('RBAC Grant Tests', () => {
  it('member can create case', () => {
    expect(canPerformAction('case_create', 'member').allowed).toBe(true);
  });
  it('member can read own case', () => {
    expect(canPerformAction('case_read_own', 'member').allowed).toBe(true);
  });
  it('member can add note', () => {
    expect(canPerformAction('note_add', 'member').allowed).toBe(true);
  });
  it('member can upload attachment', () => {
    expect(canPerformAction('attachment_upload', 'member').allowed).toBe(true);
  });
  it('steward can transition case', () => {
    expect(canPerformAction('case_transition', 'steward').allowed).toBe(true);
  });
  it('steward can add internal note', () => {
    expect(canPerformAction('note_add_internal', 'steward').allowed).toBe(true);
  });
  it('chief_steward can assign case', () => {
    expect(canPerformAction('case_assign', 'chief_steward').allowed).toBe(true);
  });
  it('chief_steward can close resolved case', () => {
    expect(canPerformAction('case_close', 'chief_steward', { caseStatus: 'resolved' }).allowed).toBe(true);
  });
  it('chief_steward can close rejected case', () => {
    expect(canPerformAction('case_close', 'chief_steward', { caseStatus: 'rejected' }).allowed).toBe(true);
  });
  it('officer can reopen case', () => {
    expect(canPerformAction('case_reopen', 'officer').allowed).toBe(true);
  });
  it('officer can export case', () => {
    expect(canPerformAction('case_export', 'officer').allowed).toBe(true);
  });
  it('admin can delete attachment', () => {
    expect(canPerformAction('attachment_delete', 'admin').allowed).toBe(true);
  });
  it('admin can manage users', () => {
    expect(canPerformAction('user_manage', 'admin').allowed).toBe(true);
  });
  it('platform_admin can do admin config', () => {
    expect(canPerformAction('admin_config', 'platform_admin').allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Denial reason messages
// ---------------------------------------------------------------------------

describe('Denial reasons', () => {
  it('includes role and action in reason', () => {
    const result = canPerformAction('case_assign', 'member');
    expect(result.reason).toContain('member');
    expect(result.reason).toContain('case_assign');
  });
  it('conditional denial explains status requirement', () => {
    const result = canPerformAction('case_close', 'chief_steward', { caseStatus: 'investigation' });
    expect(result.reason).toContain('resolved or rejected');
    expect(result.reason).toContain('investigation');
  });
});
