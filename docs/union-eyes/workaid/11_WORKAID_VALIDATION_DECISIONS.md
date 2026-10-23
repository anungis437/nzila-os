# 11 — WorkAid validation decisions

Institutional decisions that source inspection cannot settle. **None is answered here.** For each, the harness has a defined behaviour until the owner decides; that behaviour is "do not guess" (unconfigured, unresolved or refused), never a plausible default. Owners: **D** = Domenic Procopio (specialist desk), **A** = Angelo (principal / WSIAT), **S** = security/privacy owner or counsel.

| ID | Owner | Question | Options and operational consequence | Harness behaviour until answered |
|---|---|---|---|---|
| D-01 | D | Does "next day" for the receipt call mean the next calendar day or the next working day? Who is alerted when a sent form is not acknowledged? | **Calendar:** simple; Friday sends land on Saturday and must be edited (flagged). **Business:** avoids weekend tasks; needs a maintained holiday calendar. Either way, who is alerted after silence is separate (D-16) | No rule configured → task has no due date; owner confirms. Weekend landings are flagged, never shifted |
| D-02 | D | Which system owns the receipt follow-up task: Union Eyes or Clio? | **UE:** removes retyping; adds a second surface; Clio then must not also create it. **Clio:** no new surface; UE tracks nothing and the pain point is unaddressed (Option A′). A mixed "both" is not offered: it is the dual-master failure | `UNRESOLVED`: non-authoritative task record, **no reminders**. If `CLIO`: UE generates nothing |
| D-03 | S, A | Who may disclose, withhold or release each class of document, who may lift a professional hold, and how are the member's lawful records-access rights met outside the portal? | Release roles: specialist only vs principal only vs either. Hold lift: principal only is safest; specialist-lift is faster. Records-access channel: a defined request route (not a UE portal permission) | Release and hold-lift roles are policy parameters with no default; the member view always shows the records-access channel |
| D-04 | D, A | Which referral deficiencies may be waived for urgent professional review, who may waive, and who disposes of the urgent review? | Waive nothing (safe, may block urgent objections) → waive only photo ID → waive several (risk of unauthorized representation). The test policy waives only photo ID **as a fixture, not a proposal** | `waivableItems` and roles are required inputs; a pending urgent review blocks withdraw/decline until dispositioned |
| D-05 | D | Within one claim, how many ITOs and related records are used for several denials: per letter, per issue, or one per claim? (WSIB requires at least one per contested claim number.) | Per claim: fewer filings, coarser tracking. Per letter: matches current practice. Per issue: finest control | No default strategy; planner requires an explicit strategy; groups never span claims |
| D-06 | A | WSIAT: which artifacts, current Hearing Ready / Confirmation of Appeal workflow, supervisory approvals, member-facing ARO wording; what triggers WSIAT preparation; who attests NOA readiness? | Principal-only attestation vs specialist with principal approval; member wording drafted by WorkAid vs templated | NOA/ARF approval refused without an attested readiness gate; no tribunal entity; no member stage text is invented (publication needs professional text) |
| D-07 | D | How deep should Clio linking go for the pilot: read-only context, controlled data entry, or none? | None/deep link: lowest risk. Read-only: needs a verified API capability and credentials. Controlled entry: needs an idempotency ledger and conflict handling (Option C territory) | Manual coordination; no connector; copy that claims integration is rejected |
| D-08 | D, S | How are members with prior unions or parallel representation handled without tenant leakage? | One institutional context per session vs cross-union specialist queue | Member identity is per organization; no join by name or claim number |
| D-09 | A, S | Which communications remain WorkAid-only (client statements, legal notes, mental-health material)? | Whole classes vs per-document holds | Everything not explicitly released is professional-only |
| D-10 | S | Exact organizational permissions, privacy basis and retention for each data class. | Counsel-defined; affects T067 | No retention behaviour is implemented |
| D-11 | A | When objection timelines or mail-disruption exception windows apply, which professional validates the dated policy source? | A named reviewer per rule source | Rule registry is empty; confirmation refused without a reviewed, effective rule source |
| D-12 | D | Which prior-claim numbers may appear on which WSIB submission without exposing another employer's claims? | Target claim only (default in the contract); plus same-employer references with validation | Other-employer and unknown-employer claims excluded; same-employer needs professional validation |
| D-13 | A | Who formally accepts representation? | Specialist; principal only; specialist with principal countersign | `acceptanceRoles` is a required policy input |
| D-14 | D | Which receipt-confirmation methods and evidence are acceptable? | Phone call with named contact; portal confirmation; written confirmation; e-mail reply. Each needs an evidence field | Four methods and a contact/evidence reference are required; provider acknowledgement never counts |
| D-15 | A | Must the approver differ from the preparer, which roles approve, and which actions need Angelo? | Separate approver always / only for ITO and ARF / never | `approverMustDifferFromPreparer` and `approvalRoles` are policy inputs; default in tests is a fixture |
| D-16 | D, A | After a dispatched document stays unconfirmed, who is alerted, after how long, and what is the escalation? | Owner only; owner + principal after N days | Reported as unconfirmed; no automatic escalation is invented |
| D-17 | D | Must WSIB acknowledge the DOA before WRF/ITO are dispatched as representative, or is a recorded DOA enough? | Recorded DOA suffices (as built) vs DOA receipt confirmed first | Dispatch needs a live recorded DOA; urgent drafting is unaffected |
| D-18 | S | Minimum cohort size for union-facing aggregates. | Larger threshold = safer, less useful | Threshold is a required parameter; complementary suppression applies |

## What these decisions block

- **Task and reminder activation:** D-01, D-02, D-16.
- **Referral intake and the urgent path:** D-04, D-13.
- **Outbound document workflow:** D-05, D-12, D-14, D-15, D-17.
- **Member and union visibility:** D-03, D-09, D-10, D-18.
- **Tribunal:** D-06, D-11.
- **Integration:** D-02, D-07.

`DESIGN_COMPLETE` cannot be claimed while any of these that affect a P0/P1 finding (D-01…D-06, D-11…D-15) is unanswered and unconfigured.
