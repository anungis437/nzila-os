/**
 * UE-OFFICER-EXECUTIVE-CANONICAL-2.1 §V — institutional decision lifecycle kernel.
 *
 * A PURE transition kernel: no database, no route, no UI. It encodes that each
 * stage has a distinct authoritative state and that a stage can only be entered
 * by the facts that justify it:
 *  - there is no "approve" operation; ADOPTED is produced only by tallying
 *    recorded votes under a decision rule against an established quorum;
 *  - ADOPTED is not EXECUTED; EXECUTED is not VERIFIED (verifier is independent
 *    of the owner); nothing here proves payment, delivery or receipt;
 *  - quorum, the decision rule and the notice reference are supplied by the
 *    caller from a governing instrument. This kernel invents none of them.
 *
 * Capability O05 stays BLOCKED: no motion/decision store, no organization-scoped
 * persistence and no route exist. This module is TEST_PROVEN only and is not
 * evidence that any institutional decision has been validly adopted.
 */

export type DecisionStage =
  | 'PROPOSED'
  | 'AUTHORITY_IDENTIFIED'
  | 'NOTICE_SATISFIED'
  | 'QUORUM_ESTABLISHED'
  | 'ADOPTED'
  | 'REJECTED'
  | 'EXECUTION_ASSIGNED'
  | 'EXECUTED'
  | 'VERIFIED'
  | 'COMMUNICATED'
  | 'CLOSED';

export type VoteChoice = 'for' | 'against' | 'abstain';

export interface DecisionAuthority {
  bodyId: string;
  /** Reference to the bylaw/policy that establishes this body's authority. */
  sourceRef: string;
  /** Eligible voting members of the deciding body (collective, not one officer). */
  memberUserIds: readonly string[];
  /** Members that must be present for a valid meeting. */
  quorumRequired: number;
  /** Number of "for" votes required for adoption under the governing rule. */
  forVotesRequired: number;
}

export interface DecisionRecord {
  id: string;
  organizationId: string;
  title: string;
  proposedBy: string;
  stage: DecisionStage;
  authority?: DecisionAuthority;
  noticeRef?: string;
  present: readonly string[];
  recused: readonly string[];
  votes: Readonly<Record<string, VoteChoice>>;
  executionOwner?: string;
  delegationRef?: string;
  evidenceRefs: readonly string[];
  verifiedBy?: string;
  communicatedTo: readonly string[];
  outstandingObligations: readonly string[];
  history: readonly { stage: DecisionStage; actorUserId: string; at: string }[];
}

export type DecisionResult =
  | { ok: true; decision: DecisionRecord }
  | { ok: false; error: string };

const fail = (error: string): DecisionResult => ({ ok: false, error });

function advance(d: DecisionRecord, stage: DecisionStage, actorUserId: string, at: Date, patch: Partial<DecisionRecord> = {}): DecisionResult {
  return {
    ok: true,
    decision: { ...d, ...patch, stage, history: [...d.history, { stage, actorUserId, at: at.toISOString() }] },
  };
}

export function proposeDecision(input: {
  id: string; organizationId: string; title: string; proposedBy: string; at: Date;
}): DecisionRecord {
  return {
    id: input.id,
    organizationId: input.organizationId,
    title: input.title,
    proposedBy: input.proposedBy,
    stage: 'PROPOSED',
    present: [],
    recused: [],
    votes: {},
    evidenceRefs: [],
    communicatedTo: [],
    outstandingObligations: [],
    history: [{ stage: 'PROPOSED', actorUserId: input.proposedBy, at: input.at.toISOString() }],
  };
}

export function identifyAuthority(d: DecisionRecord, authority: DecisionAuthority, actor: string, at: Date): DecisionResult {
  if (d.stage !== 'PROPOSED') return fail('Authority can only be identified for a proposed decision.');
  if (!authority.sourceRef.trim()) return fail('A governing-instrument reference is required.');
  const members = new Set(authority.memberUserIds);
  if (members.size === 0) return fail('The deciding body has no eligible members.');
  if (authority.quorumRequired < 1 || authority.quorumRequired > members.size) return fail('Quorum must be between 1 and the body size.');
  if (authority.forVotesRequired < 1 || authority.forVotesRequired > members.size) return fail('The adoption threshold must be between 1 and the body size.');
  return advance(d, 'AUTHORITY_IDENTIFIED', actor, at, { authority });
}

export function satisfyNotice(d: DecisionRecord, noticeRef: string, actor: string, at: Date): DecisionResult {
  if (d.stage !== 'AUTHORITY_IDENTIFIED') return fail('Notice follows identification of the decision authority.');
  if (!noticeRef.trim()) return fail('A notice or agenda reference is required.');
  return advance(d, 'NOTICE_SATISFIED', actor, at, { noticeRef });
}

export function establishQuorum(d: DecisionRecord, presentUserIds: readonly string[], recusedUserIds: readonly string[], actor: string, at: Date): DecisionResult {
  if (d.stage !== 'NOTICE_SATISFIED' || !d.authority) return fail('Quorum requires satisfied notice.');
  const members = new Set(d.authority.memberUserIds);
  const present = [...new Set(presentUserIds)].filter((u) => members.has(u));
  if (present.length < d.authority.quorumRequired) return fail('Quorum is not met.');
  const recused = [...new Set(recusedUserIds)].filter((u) => present.includes(u));
  return advance(d, 'QUORUM_ESTABLISHED', actor, at, { present, recused });
}

export function recordVote(d: DecisionRecord, userId: string, choice: VoteChoice): DecisionResult {
  if (d.stage !== 'QUORUM_ESTABLISHED') return fail('Votes are recorded only while a valid quorum is established.');
  if (!d.present.includes(userId)) return fail('Only present members of the deciding body may vote.');
  if (d.recused.includes(userId)) return fail('A recused member may not vote.');
  if (d.votes[userId]) return fail('A member may vote only once.');
  return { ok: true, decision: { ...d, votes: { ...d.votes, [userId]: choice } } };
}

/** Closes voting. The outcome is computed from recorded votes; it is never asserted. */
export function tallyVotes(d: DecisionRecord, actor: string, at: Date): DecisionResult {
  if (d.stage !== 'QUORUM_ESTABLISHED' || !d.authority) return fail('Only a decision in session can be tallied.');
  const forVotes = Object.values(d.votes).filter((v) => v === 'for').length;
  return advance(d, forVotes >= d.authority.forVotesRequired ? 'ADOPTED' : 'REJECTED', actor, at);
}

export function assignExecution(d: DecisionRecord, ownerUserId: string, delegationRef: string, actor: string, at: Date): DecisionResult {
  if (d.stage !== 'ADOPTED') return fail('Only an adopted decision can be assigned for execution.');
  if (!delegationRef.trim()) return fail('Execution requires a valid delegation reference.');
  return advance(d, 'EXECUTION_ASSIGNED', actor, at, { executionOwner: ownerUserId, delegationRef });
}

export function recordExecution(d: DecisionRecord, actorUserId: string, evidenceRefs: readonly string[], at: Date): DecisionResult {
  if (d.stage !== 'EXECUTION_ASSIGNED') return fail('Execution is recorded only against an assigned adopted decision.');
  if (actorUserId !== d.executionOwner) return fail('Only the assigned owner may record execution.');
  if (evidenceRefs.length === 0) return fail('Execution requires completion evidence.');
  return advance(d, 'EXECUTED', actorUserId, at, { evidenceRefs });
}

export function verifyCompletion(d: DecisionRecord, verifierUserId: string, at: Date): DecisionResult {
  if (d.stage !== 'EXECUTED') return fail('Only an executed decision can be verified.');
  if (verifierUserId === d.executionOwner) return fail('Completion must be verified independently of the owner.');
  return advance(d, 'VERIFIED', verifierUserId, at, { verifiedBy: verifierUserId });
}

export function communicateOutcome(d: DecisionRecord, recipients: readonly string[], actor: string, at: Date): DecisionResult {
  if (d.stage !== 'VERIFIED') return fail('Outcome is communicated after verification.');
  if (recipients.length === 0) return fail('At least one authorized recipient is required.');
  return advance(d, 'COMMUNICATED', actor, at, { communicatedTo: recipients });
}

/** Closure never discards obligations; outstanding items are retained for follow-through and succession. */
export function closeDecision(d: DecisionRecord, outstandingObligations: readonly string[], actor: string, at: Date): DecisionResult {
  if (d.stage !== 'COMMUNICATED') return fail('Only a communicated decision can be closed.');
  return advance(d, 'CLOSED', actor, at, { outstandingObligations });
}
