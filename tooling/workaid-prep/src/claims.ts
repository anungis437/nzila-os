import type {
  ClaimId,
  DecisionId,
  IssueId,
  MemberId,
  ObjectionId,
  OrganizationId,
  UserId,
  WsibClaimNumber,
} from './ids.ts';
import type { Principal } from './principal.ts';
import { hasAnyRole, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';

/**
 * Claim / decision / issue / objection graph. One member has many claims; one
 * claim has many decisions; one decision has many disputed issues; an objection
 * belongs to exactly one claim and one decision and covers a subset of that
 * decision's issues. Nothing here counts objections from letters.
 */
export interface WsibClaim {
  readonly id: ClaimId;
  readonly organizationId: OrganizationId;
  readonly memberId: MemberId;
  readonly claimNumber: WsibClaimNumber;
  /** Null means unknown. Unknown employer never qualifies for cross-reference. */
  readonly employerKey: string | null;
  readonly historical: boolean;
  readonly closed: boolean;
}

export interface DisputedIssue {
  readonly id: IssueId;
  readonly kind: string;
}

export interface WsibDecision {
  readonly id: DecisionId;
  readonly claimId: ClaimId;
  /** Content hash of the decision letter as received. Identity of the letter. */
  readonly letterContentHash: string;
  readonly letterDate: string;
  /** Kept separate from letterDate; never defaulted from upload time. */
  readonly receivedDate: string | null;
  readonly outcome: 'DENIED' | 'ALLOWED' | 'PARTIAL' | 'OTHER';
  readonly issues: readonly DisputedIssue[];
}

export type ObjectionStatus = 'DRAFT' | 'PREPARED' | 'SUBMITTED' | 'WITHDRAWN' | 'SUPERSEDED' | 'RESOLVED';
const ACTIVE_OBJECTION: readonly ObjectionStatus[] = ['DRAFT', 'PREPARED', 'SUBMITTED'];

export interface Objection {
  readonly id: ObjectionId;
  readonly claimId: ClaimId;
  readonly decisionId: DecisionId;
  readonly issueIds: readonly IssueId[];
  readonly status: ObjectionStatus;
  /** Client-supplied idempotency key for creation. */
  readonly requestId: string;
  readonly sequence: number;
}

export interface ClaimGraph {
  readonly organizationId: OrganizationId;
  readonly claims: readonly WsibClaim[];
  readonly decisions: readonly WsibDecision[];
  readonly objections: readonly Objection[];
}

export function emptyGraph(organizationId: OrganizationId): ClaimGraph {
  return { organizationId, claims: [], decisions: [], objections: [] };
}

export type GraphError =
  | 'WRONG_ORGANIZATION'
  | 'CLAIM_NUMBER_BELONGS_TO_OTHER_MEMBER'
  | 'NO_SUCH_CLAIM'
  | 'NO_SUCH_DECISION'
  | 'LETTER_ALREADY_ATTACHED_TO_OTHER_CLAIM'
  | 'DENIAL_WITHOUT_ISSUES'
  | 'WRONG_CLAIM'
  | 'UNKNOWN_ISSUE'
  | 'NO_ISSUES_SELECTED'
  | 'REQUEST_ID_REUSED_WITH_DIFFERENT_PAYLOAD'
  | 'ACTIVE_OBJECTION_OVERLAP';

export function addClaim(graph: ClaimGraph, claim: WsibClaim): Result<{ graph: ClaimGraph; claim: WsibClaim }, GraphError> {
  if (claim.organizationId !== graph.organizationId) {
    return err('WRONG_ORGANIZATION', 'claim belongs to another organization');
  }
  const sameNumber = graph.claims.find((c) => c.claimNumber === claim.claimNumber);
  if (sameNumber) {
    if (sameNumber.memberId !== claim.memberId) {
      return err('CLAIM_NUMBER_BELONGS_TO_OTHER_MEMBER', 'claim number already linked to a different member; human identity review required');
    }
    return ok({ graph, claim: sameNumber }, false);
  }
  return ok({ graph: { ...graph, claims: [...graph.claims, claim] }, claim });
}

export function addDecision(
  graph: ClaimGraph,
  decision: WsibDecision,
): Result<{ graph: ClaimGraph; decision: WsibDecision }, GraphError> {
  if (!graph.claims.some((c) => c.id === decision.claimId)) return err('NO_SUCH_CLAIM', 'decision references an unknown claim');
  if (decision.outcome === 'DENIED' && decision.issues.length === 0) {
    return err('DENIAL_WITHOUT_ISSUES', 'a denial must identify at least one disputed issue');
  }
  const sameLetter = graph.decisions.find((d) => d.letterContentHash === decision.letterContentHash);
  if (sameLetter) {
    if (sameLetter.claimId !== decision.claimId) {
      return err('LETTER_ALREADY_ATTACHED_TO_OTHER_CLAIM', 'identical letter already recorded under a different claim; likely wrong-claim upload');
    }
    return ok({ graph, decision: sameLetter }, false);
  }
  return ok({ graph: { ...graph, decisions: [...graph.decisions, decision] }, decision });
}

export interface CreateObjectionInput {
  readonly objectionId: ObjectionId;
  readonly requestId: string;
  readonly claimId: ClaimId;
  readonly decisionId: DecisionId;
  readonly issueIds: readonly IssueId[];
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export function createObjection(
  graph: ClaimGraph,
  input: CreateObjectionInput,
): Result<{ graph: ClaimGraph; objection: Objection }, GraphError> {
  const decision = graph.decisions.find((d) => d.id === input.decisionId);
  if (!decision) return err('NO_SUCH_DECISION', 'unknown decision');
  if (decision.claimId !== input.claimId) {
    return err('WRONG_CLAIM', 'objection claim does not match the claim that owns the decision');
  }
  if (input.issueIds.length === 0) return err('NO_ISSUES_SELECTED', 'an objection must name at least one disputed issue');
  const known = new Set(decision.issues.map((i) => i.id));
  if (input.issueIds.some((i) => !known.has(i))) return err('UNKNOWN_ISSUE', 'issue is not part of this decision');

  const replay = graph.objections.find((o) => o.requestId === input.requestId);
  if (replay) {
    const same =
      replay.claimId === input.claimId && replay.decisionId === input.decisionId && sameSet(replay.issueIds, input.issueIds);
    if (!same) return err('REQUEST_ID_REUSED_WITH_DIFFERENT_PAYLOAD', 'idempotency key reused with different content');
    return ok({ graph, objection: replay }, false);
  }

  const overlap = graph.objections.find(
    (o) =>
      o.decisionId === input.decisionId &&
      ACTIVE_OBJECTION.includes(o.status) &&
      o.issueIds.some((i) => input.issueIds.includes(i)),
  );
  if (overlap) {
    return err('ACTIVE_OBJECTION_OVERLAP', `active objection ${overlap.id} already covers one of these issues; human decision required`);
  }

  const sequence = graph.objections.filter((o) => o.decisionId === input.decisionId).length + 1;
  const objection: Objection = {
    id: input.objectionId,
    claimId: input.claimId,
    decisionId: input.decisionId,
    issueIds: [...input.issueIds],
    status: 'DRAFT',
    requestId: input.requestId,
    sequence,
  };
  return ok({ graph: { ...graph, objections: [...graph.objections, objection] }, objection });
}

export type GroupingStrategy = 'PER_DECISION_LETTER' | 'PER_CLAIM' | 'PER_ISSUE';

export interface ObjectionGroup {
  readonly claimId: ClaimId;
  readonly decisionIds: readonly DecisionId[];
  readonly issueIds: readonly IssueId[];
}

/**
 * Proposes ITO groupings. The strategy is a WorkAid professional choice (D-05)
 * and has no default. Groups never span claims. Issues already covered by an
 * active objection are excluded so a regroup cannot duplicate filed work.
 */
export function planObjectionGroups(graph: ClaimGraph, strategy: GroupingStrategy): ObjectionGroup[] {
  const covered = new Set(graph.objections.filter((o) => ACTIVE_OBJECTION.includes(o.status)).flatMap((o) => o.issueIds));
  const groups: ObjectionGroup[] = [];
  for (const claim of graph.claims) {
    const decisions = graph.decisions
      .filter((d) => d.claimId === claim.id && (d.outcome === 'DENIED' || d.outcome === 'PARTIAL'))
      .map((d) => ({ d, issues: d.issues.filter((i) => !covered.has(i.id)) }))
      .filter((x) => x.issues.length > 0);
    if (decisions.length === 0) continue;
    if (strategy === 'PER_CLAIM') {
      groups.push({
        claimId: claim.id,
        decisionIds: decisions.map((x) => x.d.id),
        issueIds: decisions.flatMap((x) => x.issues.map((i) => i.id)),
      });
    } else if (strategy === 'PER_DECISION_LETTER') {
      for (const x of decisions) {
        groups.push({ claimId: claim.id, decisionIds: [x.d.id], issueIds: x.issues.map((i) => i.id) });
      }
    } else {
      for (const x of decisions) {
        for (const i of x.issues) groups.push({ claimId: claim.id, decisionIds: [x.d.id], issueIds: [i.id] });
      }
    }
  }
  return groups;
}

export interface WorkContextValidation {
  readonly claimId: ClaimId;
  readonly validatedBy: UserId;
  readonly reason: string;
}

export function validateWorkContext(
  principal: Principal,
  claimId: ClaimId,
  reason: string,
): Result<WorkContextValidation, 'NOT_PROFESSIONAL' | 'REASON_REQUIRED'> {
  if (!hasAnyRole(principal, WORKAID_ROLES)) return err('NOT_PROFESSIONAL', 'only WorkAid professionals may validate work context');
  if (reason.trim().length < 10) return err('REASON_REQUIRED', 'a substantive reason is required');
  return ok({ claimId, validatedBy: principal.userId, reason });
}

export interface SubmissionClaimReferences {
  readonly included: readonly WsibClaimNumber[];
  readonly excluded: readonly { readonly claimId: ClaimId; readonly reason: string }[];
}

/**
 * Which claim numbers may appear on an outbound WSIB form for `targetClaimId`.
 * Intake history is private background. Only the target claim is included by
 * default; another claim needs a known identical employer AND an explicit
 * professional work-context validation (WA-R2-01, WA-T071, WA-T072).
 */
export function selectClaimReferencesForSubmission(input: {
  readonly graph: ClaimGraph;
  readonly targetClaimId: ClaimId;
  readonly validations: readonly WorkContextValidation[];
}): Result<SubmissionClaimReferences, 'NO_SUCH_CLAIM'> {
  const target = input.graph.claims.find((c) => c.id === input.targetClaimId);
  if (!target) return err('NO_SUCH_CLAIM', 'unknown target claim');
  const included: WsibClaimNumber[] = [target.claimNumber];
  const excluded: { claimId: ClaimId; reason: string }[] = [];
  for (const c of input.graph.claims) {
    if (c.id === target.id) continue;
    if (c.memberId !== target.memberId) {
      excluded.push({ claimId: c.id, reason: 'different member' });
    } else if (target.employerKey === null || c.employerKey === null) {
      excluded.push({ claimId: c.id, reason: 'employer unknown; fail closed' });
    } else if (c.employerKey !== target.employerKey) {
      excluded.push({ claimId: c.id, reason: 'different employer; private background only' });
    } else if (!input.validations.some((v) => v.claimId === c.id && v.reason.trim().length >= 10)) {
      excluded.push({ claimId: c.id, reason: 'same employer but no professional work-context validation' });
    } else {
      included.push(c.claimNumber);
    }
  }
  return ok({ included, excluded });
}
