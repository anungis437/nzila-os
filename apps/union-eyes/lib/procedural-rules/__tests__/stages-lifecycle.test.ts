import { describe, expect, it } from 'vitest';
import { decideLifecycleTransition, initialStatusFor } from '../lifecycle';
import { decideStageTransition, decisionMakerConflicts } from '../stages';
import { regimeA, regimeB } from './synthetic-regimes';

describe('stage transitions', () => {
  const both = { unionPartyRef: 'u1', employerPartyRef: 'e1', agreedOnDay: '2027-03-01' };

  it('escalates to the next level', () => {
    expect(decideStageTransition(regimeA(), 'L1', 'L2')).toEqual({ ok: true, kind: 'escalate', skipped: [] });
  });

  it('refuses to skip an intermediate level without a recorded agreement of both parties', () => {
    expect(decideStageTransition(regimeA(), 'L1', 'L3')).toMatchObject({ ok: false, code: 'waiver_agreement_required' });
    expect(decideStageTransition(regimeA(), 'L1', 'L3', { waiver: { ...both, employerPartyRef: null } })).toMatchObject({ ok: false, code: 'waiver_agreement_required' });
  });

  it('waives a waivable intermediate level by agreement', () => {
    expect(decideStageTransition(regimeA(), 'L1', 'L3', { waiver: both })).toEqual({ ok: true, kind: 'waive_intermediate', skipped: ['L2'] });
  });

  it('routes a qualifying matter directly to the final level', () => {
    expect(decideStageTransition(regimeA(), 'L1', 'L3', { matterCategory: 'termination' })).toEqual({ ok: true, kind: 'direct_route', skipped: ['L2'] });
  });

  it('refuses to waive a level the rule set does not make waivable (four-level regime)', () => {
    expect(decideStageTransition(regimeB(), 'L1', 'L4', { waiver: both })).toMatchObject({ ok: false, code: 'level_not_waivable' });
  });

  it('refuses an undefined transition, a backwards move and an unknown stage', () => {
    expect(decideStageTransition(regimeB(), 'L2', 'L4', { waiver: both })).toMatchObject({ ok: false, code: 'transition_not_defined' });
    expect(decideStageTransition(regimeA(), 'L2', 'L1')).toMatchObject({ ok: false, code: 'backwards' });
    expect(decideStageTransition(regimeA(), 'L1', 'L9')).toMatchObject({ ok: false, code: 'unknown_stage' });
  });

  it('a level count of three or four is data, not code', () => {
    expect(regimeA().stages).toHaveLength(3);
    expect(regimeB().stages).toHaveLength(4);
    expect(decideStageTransition(regimeB(), 'L3', 'L4')).toEqual({ ok: true, kind: 'escalate', skipped: [] });
  });
});

describe('employer decision-maker per level', () => {
  it('flags the same decision-maker at two levels', () => {
    expect(
      decisionMakerConflicts(regimeA(), [
        { stageKey: 'L1', employerDecisionMakerRef: 'mgr-1' },
        { stageKey: 'L2', employerDecisionMakerRef: 'mgr-1' },
        { stageKey: 'L3', employerDecisionMakerRef: 'mgr-2' },
      ]),
    ).toEqual([{ decisionMakerRef: 'mgr-1', stageKeys: ['L1', 'L2'] }]);
  });

  it('no conflict when each level has its own decision-maker or none is recorded', () => {
    expect(decisionMakerConflicts(regimeA(), [{ stageKey: 'L1', employerDecisionMakerRef: 'mgr-1' }, { stageKey: 'L2', employerDecisionMakerRef: null }])).toEqual([]);
  });

  it('does not apply the check when the rule set does not require it', () => {
    expect(decisionMakerConflicts(regimeB(), [{ stageKey: 'L1', employerDecisionMakerRef: 'm' }, { stageKey: 'L2', employerDecisionMakerRef: 'm' }])).toEqual([]);
  });
});

describe('adoption lifecycle', () => {
  const human = (userId: string) => ({ userId, kind: 'human' as const });
  const draft = { status: 'draft' as const, origin: 'ai_assisted_extraction' as const, draftedBy: 'author', reviewedBy: null };

  it('every new record starts as a draft, AI-assisted or not', () => {
    expect(initialStatusFor('ai_assisted_extraction')).toBe('draft');
    expect(initialStatusFor('human_authored')).toBe('draft');
  });

  it('draft → reviewed → adopted by people other than the drafter', () => {
    expect(decideLifecycleTransition(draft, 'reviewed', human('reviewer'))).toEqual({ ok: true, next: 'reviewed' });
    expect(decideLifecycleTransition({ ...draft, status: 'reviewed', reviewedBy: 'reviewer' }, 'adopted', human('reviewer'))).toEqual({ ok: true, next: 'adopted' });
  });

  it('refuses self-review and self-adoption', () => {
    expect(decideLifecycleTransition(draft, 'reviewed', human('author'))).toMatchObject({ ok: false, code: 'self_review' });
    expect(decideLifecycleTransition({ ...draft, status: 'reviewed' }, 'adopted', human('author'))).toMatchObject({ ok: false, code: 'self_adoption' });
  });

  it('an automated actor (AI extraction) can never review or adopt', () => {
    expect(decideLifecycleTransition(draft, 'reviewed', { userId: 'extractor', kind: 'automated' })).toMatchObject({ ok: false, code: 'automated_actor' });
  });

  it('refuses to adopt a draft directly and to revive a superseded rule', () => {
    expect(decideLifecycleTransition(draft, 'adopted', human('x'))).toMatchObject({ ok: false, code: 'illegal_transition' });
    expect(decideLifecycleTransition({ ...draft, status: 'superseded' }, 'adopted', human('x'))).toMatchObject({ ok: false, code: 'illegal_transition' });
  });
});
