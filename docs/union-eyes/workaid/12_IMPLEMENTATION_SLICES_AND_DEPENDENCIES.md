# 12 — Implementation slices and dependencies

No completion percentages are used. Each slice has a verdict on the evidence it has, not a progress figure.

## Slice ledger

| Slice | Scope | State | Evidence | Open items |
|---|---|---|---|---|
| A — Reality and contract convergence | Traceability, capability inventory, domain model, authority matrix, state machines, contracts, data minimization, delta register | **Done for this slice, with named gaps** | [01](01_WORKAID_REALITY_BASELINE.md), [02](02_REQUIREMENTS_TRACEABILITY.md), [03](03_DOMAIN_MODEL_AND_STATES.md), [04](04_AUTHORITY_AND_DISCLOSURE_MATRIX.md), [13](13_INTEGRATION_HANDOFF_CONTRACT.md) | Main-app member portal surfaces not inspected; API/event contracts exist only as TypeScript signatures and the Clio event allow-list; no OpenAPI |
| B — Pure domain proof | Referral completeness and lifecycle, multiple claims/decisions, objections, authorization separation, dispatch/receipt, follow-up, reminders, deadline obligations, publication, revocation, dependencies | **Done for these contracts** | The synthetic suite ([08](08_SYNTHETIC_TEST_REPORT.md)) | Tribunal appeal entity, ARF packet checklist, identity duplicate review, referral persistence concurrency (T009), a kernel/specialization configuration boundary |
| C — Persona journeys | Domenic, Angelo, union rep, member as machine-verifiable scenario contracts, plus cross-persona consistency; WA-C-001 and WA-C-002 corrections | **Done for these contracts; awaiting independent challenge (Grok R7)** | [14](14_PERSONA_JOURNEY_CONTRACTS.md), [15](15_CROSS_PERSONA_CONSISTENCY.md), [16](16_MEMBER_PORTAL_REUSE_ASSESSMENT.md), [17](17_RECEIPT_VS_FILING_AUTHORITY.md), [18](18_SLICE_C_TEST_REPORT.md), `evidence/journey-trace.json` | No persistence, UI or route; French and accessibility untested; D-19…D-24 unresolved; journeys rest on fixture policy values |
| D — Clio coexistence | Minimal integration contract without connecting | **Contract written; field mapping deliberately absent** | [07](07_CLIO_COEXISTENCE_ARCHITECTURE.md), `clio.ts`, tests | Field-level mapping needs D-07 and Clio's real API |
| E — Adversarial hardening | Challenge every contract against R1/R2/R3–R6 | **Ongoing** | [09](09_ADVERSARIAL_FINDINGS_REGISTER.md), [10](10_GROK_FINDINGS_RECONCILIATION.md), [19](19_R7_ADVERSARIAL_HANDOFF.md) | Open P0/P1 entries are counted in 09 (source entries, not independent defects); `FIXED_PROVEN` = 0; R7 not yet run |

## Verdicts (kept separate; none implies another)

| Verdict | Value | Reason |
|---|---|---|
| `DESIGN_READY` | **NO** | High-severity findings are open and consequential professional decisions (D-01…D-06, D-11…D-15, D-19…D-24) are unanswered. Not claimed |
| `IMPLEMENTATION_READY` | **NO** | No persistence, no routes, no UI; schema work waits on the staging candidate |
| `STAGING_READY` | **NO** | Not applicable to this branch; Codex owns staging qualification |
| `PILOT_READY` | **NO** | Union Eyes remains `NO_GO`; no real-data authorization; no WorkAid permission basis |
| `PRODUCTION_READY` | **NO** | — |

No source-only test closes a runtime gate.

## Dependency map

| Next slice | Needs | Depends on Codex? |
|---|---|---|
| C — persona journeys (Domenic, Angelo, union rep, member) | Existing contracts only | No (done; awaiting Grok R7) |
| B2 — tribunal appeal entity and attested readiness checklist | D-06 from Angelo for content; structure can start | No |
| B3 — identity binding and duplicate-review contract | Decision on member identity model; read-only inspection of member tables | No (inspection only) |
| B4 — kernel versus specialization configuration boundary | None | No |
| B5 — requirement-to-OpenAPI/event contract documents | None | No |
| D2 — Clio field mapping | D-07 and a verified Clio capability check | No |
| Any schema/migration/route work | Staging candidate finalized and its migration journal qualified | **Yes** |
| Platform fixes in [13](13_INTEGRATION_HANDOFF_CONTRACT.md) §2 | Codex's decision on scope and timing | **Yes** |
| Runtime/UI/accessibility cases (T060–T070) | Built flows, deployed runtime | **Yes** |
| Pilot measurement (T062, WA-R6-03/05) | Authorized pilot | **Yes** |

## Work that can proceed without waiting for staging

Everything under "No" above, plus the professional decision packet in [11](11_WORKAID_VALIDATION_DECISIONS.md), which is the largest single unblocker.
