/**
 * FSM Enforcement Tests
 *
 * PR-022: Validates the CUPE vocabulary-based FSM transition enforcement.
 * 
 * Note: Tests the vocabulary's transition rules directly rather than the
 * union-eyes FSM enforcement module, which wraps these rules.
 */

import { describe, it, expect } from 'vitest';
import { getStatusById, getAllStatusIds, getCUPEVocabulary } from '../vocabulary';

/**
 * Lightweight FSM validator using vocabulary rules directly.
 * Mirrors the logic in apps/union-eyes/lib/case-fsm-enforcement.ts
 */
const ROLE_LEVEL: Record<string, number> = {
  member: 0,
  steward: 1,
  chief_steward: 2,
  business_agent: 2,
  officer: 3,
  admin: 4,
  platform_admin: 5,
};

function hasMinRole(actorRole: string, requiredRoles: string[]): boolean {
  const actorLevel = ROLE_LEVEL[actorRole] ?? -1;
  return requiredRoles.some((r) => actorLevel >= (ROLE_LEVEL[r] ?? Infinity));
}

function validateTransition(
  currentStatus: string,
  targetStatus: string,
  actorRole: string,
): { allowed: boolean; reason?: string; nextAllowed?: string[] } {
  const currentDef = getStatusById(currentStatus);
  if (!currentDef) return { allowed: false, reason: `Unknown current status '${currentStatus}'` };

  const targetDef = getStatusById(targetStatus);
  if (!targetDef) return { allowed: false, reason: `Unknown target status '${targetStatus}'` };

  if (!currentDef.allowTransitionsTo.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Invalid transition: ${currentStatus} → ${targetStatus}`,
      nextAllowed: currentDef.allowTransitionsTo,
    };
  }

  if (!hasMinRole(actorRole, targetDef.allowedRoles)) {
    return {
      allowed: false,
      reason: `Role '${actorRole}' cannot transition to '${targetDef.label}'`,
      nextAllowed: currentDef.allowTransitionsTo,
    };
  }

  return { allowed: true, nextAllowed: currentDef.allowTransitionsTo };
}

function getAllowedTransitions(currentStatus: string, actorRole: string) {
  const currentDef = getStatusById(currentStatus);
  if (!currentDef) return [];
  return currentDef.allowTransitionsTo
    .map((id) => getStatusById(id))
    .filter((s) => s !== undefined)
    .filter((s) => hasMinRole(actorRole, s!.allowedRoles))
    .map((s) => ({ statusId: s!.id, label: s!.label }));
}

describe('validateTransition (CUPE vocabulary rules)', () => {
  it('allows valid transition: filed → acknowledged (steward)', () => {
    const result = validateTransition('filed', 'acknowledged', 'steward');
    expect(result.allowed).toBe(true);
  });

  it('allows valid transition: acknowledged → investigating (steward)', () => {
    const result = validateTransition('acknowledged', 'investigating', 'steward');
    expect(result.allowed).toBe(true);
  });

  it('allows valid transition: investigating → response_due (steward)', () => {
    const result = validateTransition('investigating', 'response_due', 'steward');
    expect(result.allowed).toBe(true);
  });

  it('allows valid transition: escalated → mediation (business_agent)', () => {
    const result = validateTransition('escalated', 'mediation', 'business_agent');
    expect(result.allowed).toBe(true);
  });

  it('rejects invalid transition: filed → closed', () => {
    const result = validateTransition('filed', 'closed', 'admin');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Invalid transition');
  });

  it('rejects invalid transition: draft → arbitration', () => {
    const result = validateTransition('draft', 'arbitration', 'admin');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Invalid transition');
  });

  it('rejects transition by member (insufficient role)', () => {
    const result = validateTransition('filed', 'acknowledged', 'member');
    // The filed→acknowledged transition requires steward or higher
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Role');
  });

  it('rejects unknown current status', () => {
    const result = validateTransition('nonexistent', 'acknowledged', 'admin');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Unknown current status');
  });

  it('rejects unknown target status', () => {
    const result = validateTransition('filed', 'nonexistent', 'admin');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Unknown target status');
  });

  it('includes nextAllowed on rejection', () => {
    const result = validateTransition('filed', 'closed', 'admin');
    expect(result.allowed).toBe(false);
    expect(result.nextAllowed).toBeDefined();
    expect(result.nextAllowed).toContain('acknowledged');
  });

  it('admin can transition through escalation path', () => {
    const result = validateTransition('acknowledged', 'escalated', 'admin');
    expect(result.allowed).toBe(true);
  });

  it('closed has no outgoing transitions', () => {
    const result = validateTransition('closed', 'filed', 'admin');
    expect(result.allowed).toBe(false);
  });

  it('withdrawn has no outgoing transitions', () => {
    const result = validateTransition('withdrawn', 'filed', 'admin');
    expect(result.allowed).toBe(false);
  });
});

describe('getAllowedTransitions', () => {
  it('returns allowed transitions for filed + steward', () => {
    const transitions = getAllowedTransitions('filed', 'steward');
    expect(transitions.length).toBeGreaterThan(0);
    const ids = transitions.map((t) => t.statusId);
    expect(ids).toContain('acknowledged');
  });

  it('returns empty for closed status', () => {
    const transitions = getAllowedTransitions('closed', 'admin');
    expect(transitions).toEqual([]);
  });

  it('returns empty for withdrawn status', () => {
    const transitions = getAllowedTransitions('withdrawn', 'admin');
    expect(transitions).toEqual([]);
  });

  it('returns empty for unknown status', () => {
    const transitions = getAllowedTransitions('nonexistent', 'admin');
    expect(transitions).toEqual([]);
  });

  it('admin has more transitions than member', () => {
    const adminTransitions = getAllowedTransitions('acknowledged', 'admin');
    const memberTransitions = getAllowedTransitions('acknowledged', 'member');
    expect(adminTransitions.length).toBeGreaterThanOrEqual(memberTransitions.length);
  });

  it('returns label and statusId for each transition', () => {
    const transitions = getAllowedTransitions('filed', 'admin');
    for (const t of transitions) {
      expect(t.statusId).toBeDefined();
      expect(t.label).toBeDefined();
      expect(typeof t.statusId).toBe('string');
      expect(typeof t.label).toBe('string');
    }
  });
});
