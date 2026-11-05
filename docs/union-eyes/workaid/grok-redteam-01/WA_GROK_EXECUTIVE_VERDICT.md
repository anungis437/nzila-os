# WA_GROK_EXECUTIVE_VERDICT

**Mission:** WA-GROK-REDTEAM-01 — independent adversarial track R4–R6  
**Draft date:** 2026-10-23 (America/Toronto)  
**Status:** CONSOLIDATED 2026-10-23 ~05:50 ET after R3 + R4–R6 — **not** a release authorization.  
**Composite readiness score:** **NONE** (forbidden). Dispositions are separate below.

---

## (1) Wrong / unsupported assumptions

1. **Partner anecdotes as baselines:** “~95% incomplete referrals” and “4–6 week WSIB file wait” are Domenic observations (SPEC §1; SRC-31). Treating them as verified metrics or ROI inputs is unsupported (WA-R1-18, WA-R2-09, WA-R6-05).  
2. **One ITO per denial letter as law:** That is WORKAID_PREFERENCE. Regulator text requires **separate ITO per contested claim** and allows multiple issues in one letter (SRC-09; WA-R2-02; WA-R5-01).  
3. **WorkAid intake forms ≡ WSIB DOA / file request / appeal:** False. Forms page states DOA is not access or appeals; WRF and ITO are distinct (SRC-01,05,08; WA-R2-05).  
4. **Sent / generated / reminded ≡ WSIB received:** False for s.120 receipt (SRC-14; WA-R1-04; WA-R4-04).  
5. **UE grievance deadline engine is ready for WSIB claim deadlines:** Local `recipient-resolver.ts` @ `34f441d3` **rejects** non-`grievance_deadlines` (WA-R4-11). Pack SHA `38a82491…` **not in clone** → pack-cited runtime readiness **UNVERIFIED**.  
6. **ARF timing / COA naming frozen from memory:** ARF has official readiness criteria and no submit deadline (SRC-18–19). Tribunal disclosure currently centers Hearing Ready Form in PD #8 while COA PDF still exists (SRC-25) — do not assume a single eternal label.  
7. **Clio “integration” implied by roadmap:** No proven connector; demo explicitly no practice-system connector (DEMO_SANDBOX_P0).  
8. **Universal 2024–26 deadline extensions:** +60 days only for listed decision-date windows (SRC-15).

---

## (2) What could go seriously wrong

| Risk | Consequence |
|---|---|
| Missed s.120 / wrong clock (Fri/holiday/DST/mixed issues) | Lost objection rights; professional liability |
| Cross-employer claim numbers on ITO | Privacy breach vs WSIB instruction (SRC-11) |
| Dual Clio+UE task desks | Missed receipt calls or contradictory dispositions |
| False member/union visibility of medical/notes | Confidentiality incident; trust collapse |
| Autofile or fake “filed/ARO/WSIAT” status | Misrepresentation to client/union; process malpractice |
| Urgent incomplete packet blocked **or** waved complete | Either statutory miss or unauthorized representation acts |
| Deep Clio sync before isolation proven | Cross-tenant / privileged exfil at scale |
| Commercial claims on unverified 95%/wait | Credibility and contractual misrepresentation |

---

## (3) Reusable vs new

| Reuse (kernel / primitives) | New / WorkAid-specific |
|---|---|
| External Specialist Coordination pattern: representation authority vs access grants (schema exists; runtime proof separate) | Ontario WSIB form kinds, ITO grouping UX, ARF readiness checklist |
| Durable reminder transport: schedule, idempotency, recipient snapshot, retry/dead-letter **ideas** | Human-confirmed `DeadlineObligation` + dated rule registry (s.120, exceptions, WSIAT 6-month) |
| Document classification / publication decision model (as designed) | Clio task-of-record policy; IntegrationLedger (future) |
| Demo persona **test ideas** only (`DEMO_CONFIGURED`) | Member plain-language WSIB stage map; Angelo WSIAT supervisory gate |
| **Do not reuse:** CUPE intake route, grievance_deadlines recipient graph, claim_deadlines silent path | Specialization pack `workaid_ontario_wsib` |

Architecture recommendation: **Option B (split responsibility)** — see `WA_GROK_ARCHITECTURE_CHALLENGE.md`. Contingency **A′** if Domenic refuses UE tasks. **Defer C**.

---

## (4) Exact corrections for VS Code engineering agent

1. **Do not** wire WSIB into `apps/union-eyes/lib/deadline-engine/recipient-resolver.ts` by widening `grievance_deadlines` silently. Add a **specialization adapter** or fail closed.  
2. **Do not** reuse `app/api/cases/intake/route.ts` CUPE vocabulary as WSIB referral intake.  
3. Implement `OutboundSubmission` states with **forbidden transitions** tested: generate↛received; draft↛published milestone.  
4. Model `WSIBClaim` + `WSIBDecision` + `Objection` links; ITO disclosure fields **default-deny** other-employer claim numbers.  
5. Store deadline rule provenance (`sourceUrl`, `retrievedAt`, `effectiveFrom/To`, `humanConfirmedBy`).  
6. Feature-flag `taskOfRecord = ue_receipt | clio_only`; enforce single OPEN receipt follow-up.  
7. Keep Ontario form enums in config pack, not shared grievance enums.  
8. Label metrics partner-reported until measured; refuse marketing strings for 95% / 4–6 weeks.  
9. Cite SHAs for any “exists in repo” claim; if pack SHA missing, mark UNVERIFIED.  
10. No Clio/WSIB live credentials, autofile, or staging writes on this track.

---

## (5) Evidence still needed for DESIGN_COMPLETE

Per SPEC §12 — still missing or open:

- [ ] Domenic answers D-01 (calendar vs business next-day) and D-02/D-07 (task SoR / Clio depth).  
- [ ] Angelo validates WSIAT NOA + hearing-ready/COA current forms/signatures (D-06; SRC-25).  
- [ ] WorkAid confirms within-claim ITO grouping practice (D-05) without contradicting SRC-09.  
- [ ] Executable negative tests WA-T071–080 plus WA-T081–100 (designed, not executed).  
- [x] Sibling R3 threat/isolation evidence + baseline inventory vs pack SHA (26 findings; HEAD match).  
- [ ] Fresh platform/runtime attestation (pack cited `30_UE_PRODUCTION…`; this clone lacks that exact file / pack SHA — **UNVERIFIED**).  
- [ ] Privacy/legal review owners for medical vs institutional data classes (D-03, D-09, D-10).  
- [ ] No CRITICAL/HIGH finding left without FIXED_PROVEN or signed ACCEPTED_RISK.

---

## Separate dispositions (no composite score)

| Disposition | Verdict | Rationale |
|---|---|---|
| **Design completeness** | **NOT COMPLETE** | R1/R2 open; R4–R6 add 31 findings; D-01–D-12 unresolved; source register helps but partner validation pending. |
| **Implementation completeness** | **NOT STARTED / NOT COMPLETE** | Preparation track only; demo configured ≠ product; no executed acceptance rows. |
| **Security verification** | **NOT VERIFIED** | R3 delivered 26 findings (8 P0 / 15 P1 / 3 P2) at HEAD `38a8249`; FIXED_PROVEN=0; staging probes HTTP 503; no promotion evidence. |
| **Operational validation** | **NOT VALIDATED** | No measured referral completeness, reminder delivery, or minutes/matter study; 95%/4–6w excluded as baselines. |
| **External pilot readiness** | **NO** | Explicit exclusions in SPEC; AUTH_START_WORKAID=NO in demo; no real-data authorization; procedural freeze FAIL per R2. |

**Overall release/pilot call:** **NO-GO for external pilot and procedural freeze.** **YES** to continue evidence-driven design preparation under Option B constraints.

---

## Precisely worded partner questions

### Domenic (2–4)

1. For a DOA/WRF/ITO you marked sent at **Friday 16:00 America/Toronto**, should the first receipt-confirmation due moment be the next **calendar** day or the next **Ontario business** day, and who is paged if still unconfirmed after that moment?  
2. In the first pilot, will you accept **Union Eyes as the only active queue** for WSIB receipt-confirmation tasks (with deep link into the Clio matter), or must every such task also exist as a Clio task — and if both, how do you prevent double completion?  
3. When one claim has **two denial letters** (possibly multi-issue), do you want the system to default to **one ITO per claim** (linking both letters/issues) or **one ITO per letter**, understanding WSIB requires separate ITOs when **different claim numbers** are contested?  
4. For an urgent objection with **missing photo ID but signed DOA**, will you accept an expedited incomplete referral for objection prep without labeling the packet “complete”?

### Angelo (2–4)

1. After an adverse **ARO** decision, which exact current WSIAT artifacts and signature/consent steps must be checklisted before anyone records “NOA ready” (NOA form version, final decision copy, worker disclosure/consent, and whether **Confirmation of Appeal** or **Hearing Ready Form** is the current hearing-ready instrument)?  
2. Who (role/name) must approve recording `WSIAT_NOTICE_PREPARED` / `WSIAT_SUBMITTED` in Union Eyes, and is any staff member other than you authorized to override a missing final-decision attachment?  
3. For decisions dated inside WSIB’s published **+60 calendar day** disruption windows, who confirms applicability before a deadline is shown to staff or clients?  
4. What member-facing plain-language phrase is approved when the file is at ARO waiting vs when only an ARF draft exists (to forbid false “appeal decided/filed” wording)?

---

## Artifact index

| File | Path |
|---|---|
| Source register (31 entries) | `/workspace/missions/WA-GROK-REDTEAM-01/out/WA_GROK_SOURCE_REGISTER.md` |
| R4–R6 review extension | `/workspace/missions/WA-GROK-REDTEAM-01/out/WA_GROK_REVIEW_EXTENSION.md` |
| Architecture challenge (rec **B**) | `/workspace/missions/WA-GROK-REDTEAM-01/out/WA_GROK_ARCHITECTURE_CHALLENGE.md` |
| Requirements delta (R4–R6) | `/workspace/missions/WA-GROK-REDTEAM-01/out/WA_GROK_REQUIREMENTS_DELTA.md` |
| Acceptance delta (WA-T081–100) | `/workspace/missions/WA-GROK-REDTEAM-01/out/WA_GROK_ACCEPTANCE_DELTA.csv` |
| This draft verdict | `/workspace/missions/WA-GROK-REDTEAM-01/out/WA_GROK_EXECUTIVE_VERDICT.md` |

---

## Sibling R3 cross-check (observed in shared out/)

Independent R3 artifact `WA_GROK_R3_ADVERSARIAL_FINDINGS.md` reports: inspected HEAD **matches** pack SHA `38a82491…`; staging health endpoints **HTTP 503** maintenance; R3 severity **P0:8 / P1:14 / P2:4 (26 total)**; verdict **FAIL for release / FAIL for UE production promotion**. This strengthens **Security verification = NOT VERIFIED** and **External pilot readiness = NO**. R4–R6 architecture note that pack SHA was missing from `/workspace/proof-base` remains accurate for *that* tree; baseline SHA claims should prefer R3’s fresh clone.
