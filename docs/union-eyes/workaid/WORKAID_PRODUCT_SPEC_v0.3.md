# WorkAid × Union Eyes — Product specification v0.3 (candidate)

**Status:** DESIGN IN PROGRESS. `DESIGN_COMPLETE` = NO. This is a **candidate** for independent challenge (Grok R7); it has not been challenged, accepted or frozen. It supersedes [v0.2](WORKAID_PRODUCT_SPEC_v0.2.md) only where §1 says so; everything else in v0.2 and in v0.1 (`baseline-pack-v0.1/WORKAID_PRODUCT_SPEC_v0.1.md`) stands.
**Baseline:** `anungis437/nzila-os` `main` `38a824918cf2e7d7cfb7fcb0e796cbde45433be8`.
**Read with:** [02 requirements](02_REQUIREMENTS_TRACEABILITY.md), [14 journeys](14_PERSONA_JOURNEY_CONTRACTS.md), [15 consistency](15_CROSS_PERSONA_CONSISTENCY.md), [17 receipt vs filing](17_RECEIPT_VS_FILING_AUTHORITY.md), [11 decisions](11_WORKAID_VALIDATION_DECISIONS.md), [DECISION_LOG](DECISION_LOG.md).

## 1. Changes from v0.2

### CORRECT

1. **Receipt is not filing (v0.2 §1 CORRECT 3 amended; WA-C-001).** v0.2 exported a helper that treated `RECEIPT_CONFIRMED` with a receipt record as "filed". Removed. Receipt is a documented acknowledgement. Valid filing is a separate, append-only, professionally determined fact against a reviewed requirement source; the authority's acceptance or rejection is a third fact. There is no status named `VALIDLY_FILED`; the registry of requirement sources is empty, so every filing is `UNDETERMINED` until Angelo rules (D-19). Timeliness is never asserted. (WA-REQ-100; [17](17_RECEIPT_VS_FILING_AUTHORITY.md).)
2. **Submission states (v0.2 §1 CORRECT 3 amended).** Eleven stored states: `DRAFT, REVIEWED, APPROVED, DISPATCH_ATTEMPTED, DISPATCH_FAILED, DISPATCHED, DELIVERY_ACK, RECEIPT_CONFIRMED, REJECTED, WITHDRAWN, SUPERSEDED`. An attempt is human-only and is not a dispatch; `DISPATCHED` needs a transmission reference matching the attempt; the provider may report transmission outcomes and delivery acknowledgement but never an attempt, approval or receipt. Each submission names its recipient authority, and a kind cannot be addressed to the wrong one. (WA-REQ-031, 032, 100.)
3. **Worktree write isolation (WA-C-002).** All preparation scripts run only from an isolated linked worktree and write only through a guard that refuses every other worktree. The repository validator is run in a temp sandbox. Corrected account of the v0.2 run in [17 §7](17_RECEIPT_VS_FILING_AUTHORITY.md). (WA-REQ-120.)

### ADD

1. **Persona journeys.** Four executable synthetic journeys (specialist, supervisor, union representative, member) and cross-persona challenge steps over one composed world; each step records fixture, actor, tenant, operation, expected and actual result, authorization decision and audit expectation. ([14](14_PERSONA_JOURNEY_CONTRACTS.md), [15](15_CROSS_PERSONA_CONSISTENCY.md), `evidence/journey-trace.json`.)
2. **Tribunal assessment boundary (WA-REQ-091).** A non-favourable, partial or unknown ARO outcome opens a prompt for professional assessment. The record holds the professional's decision and reasoning only; `timeLimit` is `null`; a tribunal submission cannot be prepared without a recorded "proceeding" assessment; nothing is filed. Roles and trigger are D-23.
3. **Status-wording contract (WA-C-003, WA-REQ-111).** Member- and union-facing wording may not claim receipt, filing, validity or acceptance that the evidence does not support, in English or French; a decision notice says that a decision arrived and who will explain it, never the outcome. The lint is a backstop; the evidence-stage check is the gate.
4. **Bilingual content contract (WA-REQ-112).** English and French are separate texts. French is stored `UNREVIEWED`; it is shown only if present, with a labelled English fallback; where policy requires French, an English-only publication is refused. No translation quality, readability or accessibility is claimed (D-20).
5. **Union milestone view.** Publications are union-invisible by default; only explicitly union-visible, non-withdrawn milestones appear, as stage, text and version.
6. **Duplicate identity handling (WA-REQ-110).** A possible duplicate worker or union relationship blocks referral until an authorized actor resolves it; nothing is merged silently (D-21).
7. **Supervision is not access.** A supervising principal must be assigned and granted matter access like anyone else (D-22).
8. **Reassignment.** A task may be reassigned only to a specialist who is assigned and holds a live grant; the reminder is rescheduled for the new owner; nothing is delivered to the previous owner (D-24).
9. **Refusal logging.** A refusal is recorded on the actor's organization trail only; it never changes the target's trail or any other state.

### DELETE

1. `submissionCountsAsFiled`.
2. The single `DISPATCHED` meaning "someone sent it". It is split into attempt, confirmation and failure.

### UNRESOLVED (owner decision required; nothing assumed)

D-01 … D-24 in [11](11_WORKAID_VALIDATION_DECISIONS.md). New in this version: D-19 filing validity (assumption F-01: receipt is a prerequisite for a *valid* determination), D-20 bilingual content and wording, D-21 duplicate-identity authority, D-22 supervisor access, D-23 tribunal assessment, D-24 reassignment without access.

Still unresolved from earlier versions and still blocking: **D-02 task-of-record** (Union Eyes, Clio or neither), D-04 urgent-referral waivers, D-06 tribunal naming and process, D-11 deadline rule sources, D-17 whether WSIB must acknowledge the DOA first.

## 2. Boundaries (unchanged)

- Union Eyes: institutional coordination, referrals, continuity, permission-controlled collaboration, accountability.
- WorkAid: professional representation, advice, decisions, evidence assessment, professional responsibility.
- Clio: WorkAid's professional case and record management. **Option B (split responsibility) stays provisional.** No connector, no writeback. A Clio report is recorded as a possible discrepancy and never changes a Union Eyes fact.
- WSIB / WSIAT: external authorities and sources of procedural events.
- The system never files, never certifies a deadline, never gives legal advice, never accepts representation on a professional's behalf, never reuses grievance deadlines for WSIB obligations.

## 3. Evidence statement

The domain contracts and journeys in `tooling/workaid-prep/` are pure and synthetic-only. A pass proves that a contract behaves as specified over fabricated data. It does not prove deployed behaviour, tenant isolation, identity, delivery, accessibility, translation quality or legal correctness. Counts and per-case status are generated into [08](08_SYNTHETIC_TEST_REPORT.md), [18](18_SLICE_C_TEST_REPORT.md) and `data/WORKAID_ACCEPTANCE_MATRIX_v0.3.csv`; this document states none of them so it cannot drift.

No finding is `FIXED_PROVEN`. A WorkAid-owned finding with passing synthetic proof is `PARTIALLY_MITIGATED` at most; a platform-owned finding stays `OPEN` and belongs to Codex.

## 4. Completion forms

| Form | Value | Why |
|---|---|---|
| `DESIGN_COMPLETE` | NO | Open P0/P1 entries; consequential professional decisions (D-02, D-04, D-06, D-11, D-17, D-19–D-24) unresolved; v0.3 has not been independently challenged |
| `IMPLEMENTATION_COMPLETE` | NO | Isolated contracts only; nothing built in the operational application |
| `STAGING_READY` | NO | No runtime gate closed; Union Eyes remains `NO_GO` |
| `PILOT_READY` | NO | None |
| `PRODUCTION_READY` | NO | None |

## 5. Challenge targets

See [19](19_R7_ADVERSARIAL_HANDOFF.md) §9 for the assumptions to falsify.
