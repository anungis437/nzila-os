# WA-GROK Review Extension — R4 Operational Integrity / R5 Procedural Accuracy / R6 Product-Commercial

**Mission:** WA-GROK-REDTEAM-01 | **Date:** 2026-10-23 (America/Toronto)  
**Stance:** Independent adversarial review continuing R1/R2; sibling owns R3/baseline.  
**Evidence posture:** Official WSIB/WSIAT sources in `WA_GROK_SOURCE_REGISTER.md`; local clone reads at `/workspace/proof-base` HEAD `34f441d3…` (pack ref SHA **absent** → mark UNVERIFIED where pack assumed `38a82491…`).  
**Hard limits honored:** read-only; no Azure/live WSIB/Clio/claimant; no real PII; no secrets; gh logged out; no invented legal conclusions; do not promote 95% incomplete-referral or 4–6 week wait as verified metrics.

Severity: **CRITICAL / HIGH / MEDIUM / LOW**. Disposition for all new IDs: **OPEN_FOR_EXECUTABLE_PROOF** unless noted.

---

## R4 — Operational Integrity (WA-R4-xxx)

| ID | Sev | Challenge | Finding | Required control / negative proof |
|---|---|---|---|---|
| WA-R4-01 | CRITICAL | Multi-claim / multi-employer member | One `Person` may hold concurrent and historical `WSIBClaim`s across employers. Intake that flattens to a single claim context, or that auto-copies all claim numbers into outbound ITO reasons, violates SRC-09/SRC-11 and can miss claim-specific deadlines. | Claim graph + employer provenance on each claim; disclosure allow-list per outbound form type; tests: 2 employers × 3 claims × mixed open/closed (extend WA-S02 / WA-T071–073). |
| WA-R4-02 | CRITICAL | Multiple denials | One letter can cover multiple issues; multiple letters can hit one claim; Domenic “ITO per denial letter” is WORKAID_PREFERENCE, not regulator rule (SRC-09, R2-02). Auto `ITO_count = denial_letter_count` over/under-files. | ITO linked to claim + decision/issue set; professional grouping choice required; no silent one-letter rule. |
| WA-R4-03 | CRITICAL | Missing auth docs on urgent appeals | Blocking all outbound prep when photo ID / retainer missing can burn s.120 clocks; conversely marking packet “complete” without DOA risks unauthorized representation acts (SRC-02, SRC-12, R2-04). | Dual tracks: **urgent objection prep** vs **representation completeness**; DOA absence blocks representation-asserting sends, not member self-ITO coaching path; exception audited (WA-T011/076). |
| WA-R4-04 | CRITICAL | Generated-not-sent / sent-not-received | PDF generation, Clio note, or email-200 must never imply WSIB receipt (R1-04). Spec states PREPARED→…→RECEIVED_CONFIRMED but lacks executable failure injection in this track. | State machine with forbidden transitions; tests: generate PDF only; mark SENT without human; refuse RECEIVED without actor+method+time. |
| WA-R4-05 | HIGH | Duplicate submissions | Concurrent “submit referral” / replayed SENT_REPORTED / double ITO for same claim+decision set creates dual matters or dual receipt tasks (WA-T009/038). | Idempotency keys on referral, outbound version, and follow-up genesis; race test with two workers. |
| WA-R4-06 | HIGH | Reminder not delivered / double-processed | Local deadline-engine has retry/dead-letter patterns for **grievance** reminders (`apps/union-eyes/lib/deadline-engine/*` @ `34f441d3`), but Phase A **rejects `claim_deadlines`** in `recipient-resolver.ts`. Silent reuse would miss WSIB receipt calls or double-notify if Clio also reminds. | Separate WorkAid receipt-task channel; observed delivery; undelivered visible; no silent claim_deadlines path. |
| WA-R4-07 | HIGH | Fri / weekend / Ontario holiday / DST | Unresolved D-01: next calendar vs business day. Friday 23:59 send → Saturday due is a real miss mode (R1-11). America/Toronto DST (e.g. 2026-11-01 end) can shift “next day” walls if stored in UTC without local calendar rules. Local scheduler comments admit calendar-aware business offsets are incomplete. | Configurable calendar; editable due date; fixtures: Fri→Mon, holiday, DST spring/fall; block **automated** defaults until D-01 answered. |
| WA-R4-08 | HIGH | Late ARO / long ARO wait | Treating ARO wait as a statutory clock, or publishing “ARO decided” from draft ARF, falsifies member status (R1-14). ARO is post-ARF formal appeal (SRC-17–20). | ExternalDependency aging with owner; publication only after attested ARO decision event; no invented decision dates. |
| WA-R4-09 | HIGH | Representation change / end | DOA indefinite until written cancel/death (SRC-03); permanent reassignment needs new DOA; temporary may use addendum (SRC FAQ). UE grant revocation ≠ WSIB DOA revocation. Stale UE sessions after WorkAid ends representation leak or wrongly block. | Distinct records: WSIB DOA validity, WorkAid engagement, UE AccessGrant; revoke future access; warn prior downloads irrevocable. |
| WA-R4-10 | CRITICAL | Clio ↔ UE task conflict | Spec D-02 unresolved. Dual active follow-ups = missed calls or contradictory snoozes (R1-10). Option C deep sync without ledger worsens this. | Pilot: **single task-of-record** (recommend UE for inter-institutional receipt tasks only if Domenic accepts; else Clio SoR + UE read-only deep link). Acceptance: zero dual OPEN receipt tasks for same submission version. |
| WA-R4-11 | HIGH | Reuse UE grievance deadline engine for WSIB? | `resolveGrievanceDeadlineRecipients` throws if `sourceTable !== 'grievance_deadlines'`. Intake route enforces CUPE grievance vocabulary / `grievance_case_suite`. Blind reuse embeds Ontario WSIB into unrelated UE grievance paths — forbidden by mission. | **Smallest safe reusable contract** (below). WSIB deadlines remain human-confirmed `DeadlineObligation` with separate policy registry. |
| WA-R4-12 | MEDIUM | Outbox poison / notification auth | Clicking notification must re-check grants; payload must not carry clinical text (R1-22). | Purpose-limited notification schema; auth recheck on open; canary tests. |

### Smallest safe reusable contract (deadline / reminder primitives)

Reuse from UE kernel **only**:

1. Durable schedule row with `timezone`, `scheduled_for`, retry/dead-letter, audit event types.  
2. Idempotent schedule key `(organizationId, sourceKind, sourceId, reminderKind, offsetKey)`.  
3. Recipient **snapshot at schedule time** (immutable), not live re-resolve at send.  
4. Observed delivery outcome enum: `ATTEMPTED | DELIVERED_SINK | FAILED_RETRYABLE | DEAD_LETTER | CANCELLED_SUPERSEDED`.

**Do not reuse / do not widen without new design:**

- `sourceTable: grievance_deadlines` recipient graph (grievor/officer).  
- CUPE intake vocabulary / `grievance_case_suite` entitlement.  
- Any assumption that `claim_deadlines` == WSIB claim.  
- Auto calculation of s.120 / WSIAT 6-month as “met”.

**WorkAid-specific config (not kernel):** form types DOA/WRF/ITO/ARF/NOA/COA-or-HRF; Ontario holiday calendar; human-confirmed obligation; Clio task-of-record flag; External Specialist Coordination matter types.

---

## R5 — Procedural Accuracy (WA-R5-xxx)

| ID | Sev | Challenge | Finding | Required control / negative proof |
|---|---|---|---|---|
| WA-R5-01 | CRITICAL | ITO grouping vs Domenic practice | Regulator: one ITO **per contested claim**; multi-issue OK in one letter (SRC-09). Preference: ITO per denial letter. Product must not freeze preference as law. | UI copy: “WSIB requires separate ITO per claim number”; grouping within claim is professional choice with attestation. |
| WA-R5-02 | CRITICAL | Cross-employer disclosure | Auto-fill historical claims into ITO §7 violates privacy caution (SRC-11). | Private history vs form disclosure fields; default deny cross-employer numbers on ITO. |
| WA-R5-03 | HIGH | DOA ≠ WorkAid forms ≠ WRF ≠ ITO ≠ ARF ≠ NOA | Forms page explicitly separates DOA, ITO, worker file request; ARF arrives with claim file after ITO path; NOA is tribunal (SRC-01,05,08,17,22). | Typed `OutboundSubmission.kind`; stage gates; WA-T077–080. |
| WA-R5-04 | HIGH | ARF readiness criteria ignored | Submitting ARF before evidence/access ready can force hearing-in-writing with no second submission chance (SRC-18,21) or oral scheduling within 90 days readiness. | Checklist mapped to SRC-18; block “ARF SENT” milestone until professional attestation of readiness criteria (override audited). |
| WA-R5-05 | HIGH | ARO ≠ WSIAT; final decision copy required | WSIAT appeals **final** WSIB decisions (usually ARO); Case Manager decisions are not final (SRC-22). | WSIAT assessment only after attested final decision artifact linked. |
| WA-R5-06 | HIGH | NOA vs COA vs Hearing Ready Form drift | Pack/R2 use Confirmation of Appeal; current PD #8 centers **Hearing Ready Form** with 4-week disclosure (SRC-25). Freezing wrong name mis-trains staff. | Versioned tribunal checklist; Angelo validates current forms before UI strings ship. |
| WA-R5-07 | HIGH | Worker signature / disclosure obligations | DOA/ITO signatures; WSIAT worker consent to release Case Record to employer (SRC-26–28). System must not mark tribunal-ready without tracking required signatures/consents as human-attested. | Checklist items with actor+timestamp; never auto-complete from PDF presence alone. |
| WA-R5-08 | MEDIUM | Receipt definition confusion | “Received by WSIB” (s.120) ≠ “sent from WorkAid laptop” ≠ “UE task completed” ≠ “member saw status”. | Glossary in product + acceptance tests naming each. |
| WA-R5-09 | MEDIUM | Exception windows treated as universal | +60 days applies only to listed decision-date windows (SRC-15), not all 2024–26 decisions. | Rule registry with effective intervals; WA-T075. |
| WA-R5-10 | MEDIUM | ARF has no submit deadline → neglect risk | No statutory ARF submit deadline (SRC-19) can become infinite “waiting for file” without owner (and must not be confused with 4–6 week observation). | Operational SLA fields separate from legal clocks; aging alerts. |

---

## R6 — Product / Commercial (WA-R6-xxx)

Perspectives: **Domenic** (specialist desk), **Angelo** (principal/WSIAT), **union rep**, **member**.

| ID | Sev | Lens | Finding | Required control |
|---|---|---|---|---|
| WA-R6-01 | HIGH | Domenic | Value is receipt-task ergonomics and less retyping — not “AI appeals.” If Clio remains SoR and UE also creates tasks, net load increases (R4-10). | Time-motion study design; pilot success = minutes/matter + follow-up assurance, not ROI slogans. |
| WA-R6-02 | HIGH | Angelo | WSIAT path needs supervisory gates; auto-NOA or fake tribunal milestones create professional risk. | Principal queue for WSIAT_ASSESSMENT; no autofile. |
| WA-R6-03 | HIGH | Union rep | Incomplete-referral pain is real as anecdote; **95% figure unverified**. Over-blocking urgency damages trust; under-blocking dumps junk on WorkAid. | Measured first-pass completeness with denominator; urgent exception path. |
| WA-R6-04 | HIGH | Member | Jargon (ITO/ARF/ARO/NOA), mobile small screens, notification fatigue, and accidental medical exposure are product-breaking. R1-19 still open. | WCAG 2.2 AA target for member flows; plain-language stage map; digestible notifications; zero restricted metadata. |
| WA-R6-05 | MEDIUM | All | Economics: do not claim productivity savings from unverified 95% / 4–6 week baselines (R1-18, R2-09). | Partner-reported labels; collect pilot baselines first. |
| WA-R6-06 | MEDIUM | Platform | Reusable External Specialist Coordination vs WorkAid-only config must stay separated or every future specialist inherits Ontario WSIB terms. | Kernel primitives vs `specialization=workaid_ontario_wsib` config pack. |
| WA-R6-07 | MEDIUM | Mobile / a11y | Upload failures, signature capture, and dense claim tables fail on small screens / AT. | Synthetic mobile + SR journeys before external pilot. |
| WA-R6-08 | LOW | Notification fatigue | Next-day receipt + aging file + ARF + ARO + member pings can train users to ignore alerts. | Priority tiers; bundling; quiet hours; undelivered≠done. |
| WA-R6-09 | MEDIUM | Commercial honesty | “Clio integrated” / “pilot ready” / composite readiness scores are forbidden theatre given UE staging NO_GO history and absent connector. | Separate dispositions only (see executive verdict draft). |

---

## Finding counts

| Round | CRITICAL | HIGH | MEDIUM | LOW | Total |
|---|---:|---:|---:|---:|---:|
| R4 | 5 | 6 | 1 | 0 | **12** |
| R5 | 2 | 5 | 3 | 0 | **10** |
| R6 | 0 | 4 | 4 | 1 | **9** |
| **All new** | **7** | **15** | **8** | **1** | **31** |

Prior open R1 (22) + R2 (9) remain open for executable proof unless sibling closes them; this extension does not close them by prose.

## Coordination notes for R3 sibling

- Append-only deltas written to `WA_GROK_REQUIREMENTS_DELTA.md` and `WA_GROK_ACCEPTANCE_DELTA.csv` (created as stubs if absent).  
- Architecture recommendation isolated in `WA_GROK_ARCHITECTURE_CHALLENGE.md` → **Option B**.  
- Do not treat local clone HEAD as pack baseline SHA.
