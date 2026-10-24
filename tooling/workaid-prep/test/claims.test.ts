import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addClaim, addDecision, createObjection, emptyGraph, planObjectionGroups, selectClaimReferencesForSubmission, validateWorkContext } from '../src/claims.ts';
import type { ClaimGraph, CreateObjectionInput, Objection } from '../src/claims.ts';
import { asDecisionId, asIssueId, asObjectionId } from '../src/ids.ts';
import { CLAIM_X, CLAIM_Y, ORG_A, ORG_B, REP_A, SPEC_1, claim, decision } from './helpers.ts';

const val = <T>(r: { ok: boolean }): T => {
  assert.equal(r.ok, true, JSON.stringify(r));
  return (r as unknown as { value: T }).value;
};

/** Scenario WA-S02: one member, two claims, five decisions. */
function scenarioS02(): ClaimGraph {
  let g = emptyGraph(ORG_A);
  g = val<{ graph: ClaimGraph }>(addClaim(g, claim('A-CLAIM-X', 'FAKE-WSIB-000002', 'EMPLOYER-X'))).graph;
  g = val<{ graph: ClaimGraph }>(addClaim(g, claim('A-CLAIM-Y', 'FAKE-WSIB-000003', 'EMPLOYER-Y', { historical: true }))).graph;
  for (const [id, c, h, issues] of [
    ['A-D1', 'A-CLAIM-X', 'h1', ['A-D1-I1']],
    ['A-D2', 'A-CLAIM-X', 'h2', ['A-D2-I1', 'A-D2-I2']],
    ['A-D3', 'A-CLAIM-X', 'h3', ['A-D3-I1']],
    ['B-D1', 'A-CLAIM-Y', 'h4', ['B-D1-I1']],
    ['B-D2', 'A-CLAIM-Y', 'h5', ['B-D2-I1']],
  ] as const) {
    g = val<{ graph: ClaimGraph }>(addDecision(g, decision(id, c, h, [...issues]))).graph;
  }
  return g;
}

const obj = (id: string, req: string, claimId: string, decisionId: string, issues: string[]): CreateObjectionInput => ({
  objectionId: asObjectionId(id),
  requestId: req,
  claimId: claimId as never,
  decisionId: asDecisionId(decisionId),
  issueIds: issues.map(asIssueId),
});

describe('claim graph', () => {
  it('[WA-T007][WA-T008] one member, many claims; every decision belongs to exactly one claim and keeps its letter provenance', () => {
    const g = scenarioS02();
    assert.equal(g.claims.length, 2);
    assert.equal(g.decisions.length, 5);
    assert.ok(g.claims.some((c) => c.historical), 'historical claim retained');
    for (const d of g.decisions) assert.ok(g.claims.some((c) => c.id === d.claimId));
    assert.equal(g.decisions.find((d) => d.id === asDecisionId('A-D2'))?.issues.length, 2, 'one letter, several issues');
  });

  it('[WA-ADV-06] an objection attached to the wrong claim is refused', () => {
    const r = createObjection(scenarioS02(), obj('O1', 'R1', 'A-CLAIM-Y', 'A-D1', ['A-D1-I1']));
    assert.equal((r as { code: string }).code, 'WRONG_CLAIM');
  });

  it('an objection must name real issues of that decision', () => {
    assert.equal((createObjection(scenarioS02(), obj('O1', 'R1', 'A-CLAIM-X', 'A-D1', ['A-D2-I1'])) as { code: string }).code, 'UNKNOWN_ISSUE');
    assert.equal((createObjection(scenarioS02(), obj('O1', 'R1', 'A-CLAIM-X', 'A-D1', [])) as { code: string }).code, 'NO_ISSUES_SELECTED');
  });

  it('[WA-ADV-07] the same denial letter submitted twice resolves to one decision', () => {
    const g = scenarioS02();
    const again = addDecision(g, decision('A-D1-DUP', 'A-CLAIM-X', 'h1', ['A-D1-I1']));
    assert.equal(again.ok && again.created, false);
    assert.equal(val<{ decision: { id: string } }>(again).decision.id, 'A-D1');
    assert.equal(val<{ graph: ClaimGraph }>(again).graph.decisions.length, 5);
  });

  it('the same letter bytes under a different claim are held for review as a likely wrong-claim upload', () => {
    const r = addDecision(scenarioS02(), decision('B-D9', 'A-CLAIM-Y', 'h1', ['B-D9-I1']));
    assert.equal((r as { code: string }).code, 'LETTER_ALREADY_ATTACHED_TO_OTHER_CLAIM');
  });

  it('a claim number linked to a different member is never auto-joined', () => {
    const other = { ...claim('A-CLAIM-Z', 'FAKE-WSIB-000002', 'EMPLOYER-X'), memberId: 'FAKE-MEMBER-999' as never };
    assert.equal((addClaim(scenarioS02(), other) as { code: string }).code, 'CLAIM_NUMBER_BELONGS_TO_OTHER_MEMBER');
  });

  it('[WA-T015] a claim number is data, not an identity: claims outside the organization scope are refused', () => {
    const g = scenarioS02();
    const foreign = { ...claim('A-CLAIM-Q', 'FAKE-WSIB-000777', 'EMPLOYER-Q'), organizationId: ORG_B };
    assert.equal((addClaim(g, foreign) as { code: string }).code, 'WRONG_ORGANIZATION');
  });

  it('[WA-ADV-07] idempotent create: the same request id returns the same objection; a changed payload under the same id is rejected', () => {
    const g0 = scenarioS02();
    const a = createObjection(g0, obj('O1', 'REQ-1', 'A-CLAIM-X', 'A-D1', ['A-D1-I1']));
    const g1 = val<{ graph: ClaimGraph }>(a).graph;
    const b = createObjection(g1, obj('O1-retry', 'REQ-1', 'A-CLAIM-X', 'A-D1', ['A-D1-I1']));
    assert.equal(b.ok && b.created, false);
    assert.equal(val<{ graph: ClaimGraph }>(b).graph.objections.length, 1);
    const c = createObjection(g1, obj('O1-x', 'REQ-1', 'A-CLAIM-X', 'A-D2', ['A-D2-I1']));
    assert.equal((c as { code: string }).code, 'REQUEST_ID_REUSED_WITH_DIFFERENT_PAYLOAD');
  });

  it('[WA-ADV-08] a legitimate new objection is not deduplicated against an older terminal one, nor against a different issue', () => {
    let g = val<{ graph: ClaimGraph }>(createObjection(scenarioS02(), obj('O1', 'REQ-1', 'A-CLAIM-X', 'A-D2', ['A-D2-I1']))).graph;
    // different issue of the same decision while the first is active: allowed
    g = val<{ graph: ClaimGraph }>(createObjection(g, obj('O2', 'REQ-2', 'A-CLAIM-X', 'A-D2', ['A-D2-I2']))).graph;
    // same issue while the first is active: needs a human, neither silently merged nor silently duplicated
    const overlap = createObjection(g, obj('O3', 'REQ-3', 'A-CLAIM-X', 'A-D2', ['A-D2-I1']));
    assert.equal((overlap as { code: string }).code, 'ACTIVE_OBJECTION_OVERLAP');
    // once the older one is withdrawn, a genuine re-objection is created with its own sequence
    const withdrawn: ClaimGraph = { ...g, objections: g.objections.map((o): Objection => (o.id === asObjectionId('O1') ? { ...o, status: 'WITHDRAWN' } : o)) };
    const again = createObjection(withdrawn, obj('O3', 'REQ-3', 'A-CLAIM-X', 'A-D2', ['A-D2-I1']));
    assert.equal(again.ok && again.created, true);
    assert.equal(val<{ objection: Objection }>(again).objection.sequence, 3);
  });
});

describe('ITO grouping is a professional choice', () => {
  it('[WA-T027][WA-T073] groups never span claims; counts differ by approved strategy and never equal the letter count by formula', () => {
    const g = scenarioS02();
    const perClaim = planObjectionGroups(g, 'PER_CLAIM');
    const perLetter = planObjectionGroups(g, 'PER_DECISION_LETTER');
    const perIssue = planObjectionGroups(g, 'PER_ISSUE');
    assert.equal(perClaim.length, 2);
    assert.equal(perLetter.length, 5);
    assert.equal(perIssue.length, 6);
    for (const grp of [...perClaim, ...perLetter, ...perIssue]) {
      const claimIds = new Set(grp.decisionIds.map((d) => g.decisions.find((x) => x.id === d)?.claimId));
      assert.equal(claimIds.size, 1);
      assert.ok(claimIds.has(grp.claimId));
    }
    assert.equal(perClaim.filter((x) => x.claimId === CLAIM_X).length, 1);
    assert.equal(perClaim.filter((x) => x.claimId === CLAIM_Y).length, 1);
  });

  it('regrouping excludes issues already covered by an active objection', () => {
    const g = val<{ graph: ClaimGraph }>(createObjection(scenarioS02(), obj('O1', 'REQ-1', 'A-CLAIM-X', 'A-D2', ['A-D2-I1', 'A-D2-I2']))).graph;
    const groups = planObjectionGroups(g, 'PER_DECISION_LETTER');
    assert.equal(groups.some((x) => x.decisionIds.includes(asDecisionId('A-D2'))), false);
    assert.equal(groups.length, 4);
  });
});

describe('cross-employer disclosure (WA-S11)', () => {
  function s11() {
    let g = emptyGraph(ORG_A);
    g = val<{ graph: ClaimGraph }>(addClaim(g, claim('A-CLAIM-X', 'FAKE-WSIB-000011', 'EMPLOYER-X'))).graph;
    g = val<{ graph: ClaimGraph }>(addClaim(g, claim('A-CLAIM-Y', 'FAKE-WSIB-000012', 'EMPLOYER-Y', { historical: true }))).graph;
    g = val<{ graph: ClaimGraph }>(addClaim(g, claim('A-CLAIM-X2', 'FAKE-WSIB-000013', 'EMPLOYER-X', { closed: true }))).graph;
    g = val<{ graph: ClaimGraph }>(addClaim(g, claim('A-CLAIM-U', 'FAKE-WSIB-000014', null))).graph;
    return g;
  }

  it('[WA-T071] a historical claim from another employer stays private and is excluded from the outbound ITO by default', () => {
    const r = val<{ included: string[]; excluded: { claimId: string; reason: string }[] }>(selectClaimReferencesForSubmission({ graph: s11(), targetClaimId: CLAIM_X, validations: [] }));
    assert.deepEqual(r.included, ['FAKE-WSIB-000011']);
    assert.ok(!r.included.includes('FAKE-WSIB-000012'));
    assert.equal(r.excluded.find((e) => e.claimId === CLAIM_Y)?.reason.includes('different employer'), true);
  });

  it('[WA-T072] a same-employer related claim needs explicit professional work-context validation; intake listing is not permission', () => {
    const without = val<{ included: string[] }>(selectClaimReferencesForSubmission({ graph: s11(), targetClaimId: CLAIM_X, validations: [] }));
    assert.ok(!without.included.includes('FAKE-WSIB-000013'));
    const v = val<{ claimId: never; validatedBy: never; reason: string }>(validateWorkContext(SPEC_1, 'A-CLAIM-X2' as never, 'same worksite and same employer confirmed against decision letter'));
    const withV = val<{ included: string[] }>(selectClaimReferencesForSubmission({ graph: s11(), targetClaimId: CLAIM_X, validations: [v] }));
    assert.deepEqual(withV.included, ['FAKE-WSIB-000011', 'FAKE-WSIB-000013']);
  });

  it('a union user cannot validate work context; unknown-employer claims fail closed even with a validation', () => {
    assert.equal((validateWorkContext(REP_A, 'A-CLAIM-X2' as never, 'same worksite and same employer confirmed') as { code: string }).code, 'NOT_PROFESSIONAL');
    const v = val<{ claimId: never; validatedBy: never; reason: string }>(validateWorkContext(SPEC_1, 'A-CLAIM-U' as never, 'confirmed by phone with the member'));
    const r = val<{ included: string[] }>(selectClaimReferencesForSubmission({ graph: s11(), targetClaimId: CLAIM_X, validations: [v] }));
    assert.ok(!r.included.includes('FAKE-WSIB-000014'));
  });
});
