# 07 — Clio coexistence architecture

**Decision (provisional):** Option B — split responsibility. Confirmed as the working architecture for design preparation by the Grok R3–R6 intake and the independent triage; it is **not** approved for pilot. Option A′ is the fallback; Option C is deferred.

## Facts at the pinned source

- No Clio connector exists in the repository. The only Clio reference is the demo sandbox's phrase blocking (`DEMO_SANDBOX_P0.md`), which forbids "Clio-integrated" claims.
- The `IntegrationLedger` in the v0.1 spec is `PROPOSED` only.
- No official Clio API capability check has been made by this mission.

## Options compared

| | A — Clio-led | **B — split responsibility (provisional)** | C — deeper integration |
|---|---|---|---|
| Professional file | Clio | Clio | Clio + mirrored copies |
| Union Eyes owns | Referral packet and optional status only | Referral completeness; member-safe publication; receipt follow-up tasks **only if Domenic accepts** | Matters, tasks, contacts, documents synced |
| Task of record | Clio | One system per submission version; undecided (D-02) | Ambiguous without a heavy conflict protocol |
| Writeback | none | **none** | bidirectional |
| Duplication | lowest; retyping risk | coordination metadata only | highest |
| Main risk | fails the stated problem (reminders, referral completeness, member visibility) | two surfaces to check; D-02 unresolved | dual master, replay, wrong-tenant, privileged-note leak |
| This harness | n/a | `clio.ts`, `followup.ts` task-of-record switch | none (explicitly out of scope) |

Reasons for B over C now: the dual-master failure (WA-R1-10 / WA-R4-10) and connector attack surface (WA-R1-20) are the two highest-consequence integration risks and neither can be proven in isolation; reasons for B over A: A leaves the stated pain points unaddressed unless Union Eyes still delivers referral completeness and member publication, which is already a weak B.

## Source-of-truth ownership

| Data | Owner | Union Eyes holds |
|---|---|---|
| Client profile, communications, notes, professional work, medical pursuit, hearing preparation | Clio | Nothing, or an opaque deep-link reference |
| Referral packet, completeness, referral state | Union Eyes | Full |
| Receipt follow-up task for an outbound WSIB submission | Per D-02: Union Eyes **or** Clio, never both | Task only if `UNION_EYES` |
| Outbound submission records (kind, version, dispatch, receipt) | Union Eyes coordination record; the document itself stays in Clio | Metadata and human-attested receipt |
| Member-visible status | Union Eyes publication | Full |
| Access grants and revocation | Union Eyes | Full |

## Permitted event exchange (future, documented, not built)

`REFERRAL_ACCEPTED`, `SUBMISSION_DISPATCHED`, `RECEIPT_CONFIRMED`, `ACCESS_REVOKED`. Fields: `eventId`, `type`, `organizationId`, `opaqueMatterRef`, `opaqueSubmissionRef`, `occurredAt`. Nothing else. `checkEventAdmissibility` rejects replay, wrong tenant, other types, extra fields and stale events (`[WA-T055]`).

## Minimum data exchange and prohibited synchronization

Allowed: opaque references and state names above. **Prohibited:** medical content or binaries, government ID, professional notes, document titles or filenames, claim numbers from another employer, privileged strategy, free-text task notes, any mirrored task list, any writeback of Clio state into Union Eyes receipt evidence.

## Conflict, retry and idempotency

- Tasks: any disagreement becomes a `RECONCILIATION_EXCEPTION` with `writeback=false`; two active tasks for one submission are an exception; an external "done" is never receipt evidence (`[WA-ADV-15]`, `[WA-T056]`).
- Retry/idempotency keys: event id (replay), `receipt-followup:{submissionId}:v{n}`, reminder key per owner epoch.
- Deletion, correction, revocation propagation (design): revocation emits `ACCESS_REVOKED` with opaque references only; corrections are new versions, not edits; prior audit is never deleted.
- Integration audit ledger: one append-only record per admitted or rejected event with input hash, outcome and reason (not built).

## Field-level mapping

Not defined. Defining it requires Clio's real data model and Domenic's decision on D-07 (read-only context, controlled entry, or none). Producing a mapping now would be invention.

## Enforcement in the harness

- `ARCHITECTURE` constant: `clioConnector=false`, `automaticWriteback=false`, `integrationMode='MANUAL_COORDINATION'`.
- `findClioIntegrationClaims` rejects "Clio-integrated", "integrated with Clio", "syncs with Clio", "Clio sync" and "automatically updates Clio" (`[WA-T096]`).
- `generateReceiptFollowUp` produces nothing when Clio is task-of-record (`[WA-ADV-15]`-adjacent test in `followup.test.ts`).

## Decisions required

D-02 (task-of-record), D-07 (read-only, controlled entry or none), and the "which events must be recorded in Clio" question in [11](11_WORKAID_VALIDATION_DECISIONS.md).
