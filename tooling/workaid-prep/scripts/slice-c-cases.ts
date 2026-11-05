/**
 * Acceptance cases added by Slice C (WA-T101–T115). Each is executed only by
 * tests whose titles carry the exact tag; the builder derives its state.
 */
import type { MatrixRow } from './sources.ts';

const c = (id: string, domain: string, severity: string, actor: string, stimulus: string, expected: string, assertion: string, relatedFindings: string): MatrixRow => ({
  id,
  domain,
  severity,
  actor,
  stimulus,
  expected,
  assertion,
  owner: 'WorkAid prep',
  priorState: 'NEW_IN_V0_3',
  relatedFindings,
  origin: 'SLICE_C',
});

export const SLICE_C_CASES: readonly MatrixRow[] = [
  c('WA-T101', 'Submission addressing', 'P1', 'Specialist', 'Create an outbound document of each kind for the default and a different recipient', 'The recipient is the authority the kind belongs to; a mismatch is refused', 'An ITO cannot be created for the Tribunal; a tampered recipient is rejected', 'WA-C-001'),
  c('WA-T102', 'Dispatch', 'P0', 'Specialist / provider', 'Attempt, confirm and fail a dispatch; provider reports outcomes', 'An attempt is not a dispatch; confirmation needs the matching attempt and a transmission reference; the provider never reports receipt or approval', 'No follow-up eligibility without confirmed dispatch; the old "counts as filed" helper is gone', 'WA-C-001 WA-R1-04'),
  c('WA-T103', 'Receipt vs filing', 'P0', 'Specialist', 'Reach RECEIPT_CONFIRMED and read the filing view', 'Filing status stays UNDETERMINED; receipt has no validity or acceptance property', 'No state, with or without a receipt, yields a valid filing without a professional determination', 'WA-C-001 WA-R4-04'),
  c('WA-T104', 'Filing authority', 'P0', 'Union user / member / forged assessor', 'Determine filing validity without professional authority', 'Refused; status unchanged', 'Union user, member, inactive session, forged assessor, missing authorization, closed or stale submission are all refused', 'WA-C-001'),
  c('WA-T105', 'Filing evidence', 'P0', 'Specialist', 'Determine valid filing with missing evidence', 'Refused: no receipt, no reviewed requirement source, or an unattested element', 'Every element needs a non-empty evidence reference; an unknown source leaves the status explicitly undetermined', 'WA-C-001'),
  c('WA-T106', 'Filing integrity', 'P0', 'Specialist', 'Determine valid filing for a malformed or misdirected submission', 'Refused MALFORMED or MISDIRECTED even when receipt was acknowledged', 'Wrong claim, decision, issues, matter, form kind or recipient, and a missing required link, each refused; a refusal changes nothing', 'WA-C-001'),
  c('WA-T107', 'Filing determination', 'P1', 'Specialist / authority response', 'Record a valid determination and then the authority response', 'Valid only with every gate satisfied; the authority response is a separate record with its own document', 'Timeliness is never asserted; authority acceptance does not create a determination; a superseded submission voids its determination', 'WA-C-001'),
  c('WA-T108', 'Filing defect', 'P1', 'Specialist', 'Record a defect determination', 'A defect needs concrete defects and reasoning; determinations are append-only', 'A later defect supersedes a valid determination without erasing it', 'WA-C-001'),
  c('WA-T109', 'Write isolation', 'P1', 'Preparation tooling', 'Write to prefixes, other worktrees, traversal paths and temp', 'Only the two preparation prefixes and OS temp are writable; other worktrees and traversal are refused', 'Static scan: no write-capable fs import outside the guard, no mutating git, no other-checkout path, restricted cwd values', 'WA-C-002'),
  c('WA-T110', 'Sandboxed validation', 'P1', 'Preparation tooling', 'Run the repository document validator', 'Runs in a temp sandbox; reports land only there; the worktree reports are untouched', 'The validator derives its output directory from the working directory, so it is only run in a sandbox', 'WA-C-002'),
  c('WA-T111', 'Status wording', 'P1', 'Specialist / member', 'Publish wording that claims receipt, filing, validity or acceptance', 'Refused MISREPRESENTS_PROGRESS unless the evidence stage supports a weaker claim', 'A decision notice never states the outcome; waiting stages cannot claim receipt; the lint is a backstop, not a gate on evidence', 'WA-C-003'),
  c('WA-T112', 'Bilingual contract', 'P2', 'Specialist / member', 'Publish English-only or bilingual text; view in each locale', 'French is linted like English, recorded UNREVIEWED, shown only if present; policy may require French', 'No translation quality or accessibility is claimed', 'WA-C-003'),
  c('WA-T113', 'Union milestones', 'P1', 'Union representative', 'Read milestones for a matter', 'Publications are union-invisible by default; only explicitly union-visible, non-withdrawn milestones appear with no extra fields', 'No medical, privileged or professional-only content reaches the union view', 'WA-R1-03'),
  c('WA-T114', 'Tribunal assessment', 'P1', 'Supervisor', 'Receive a non-favourable or unknown ARO outcome', 'A prompt for professional assessment opens; nothing is filed; a time limit is never stated', 'Only a permitted role records the assessment as itself; tribunal preparation needs an assessed-proceed record', 'WA-R2-07'),
  c('WA-T115', 'Duplicate identity', 'P1', 'Union representative / administrator', 'Register the same name and birth year twice in one union, and once in another union', 'A possible duplicate blocks referral; only the administrator resolves it; a superseded record cannot be referred; another union is unaffected', 'Executed for duplicates within a union and across unions by name and birth year only. A worker linked to two unions as separate relationships, and variant spellings, are not exercised', 'WA-R1-06'),
];
