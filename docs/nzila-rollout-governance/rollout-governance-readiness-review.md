# Rollout Governance Readiness Review

**Status:** Active — first review
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Readiness Matrix

| Dimension                            | Maturity      | Notes                                                                       |
|--------------------------------------|---------------|-----------------------------------------------------------------------------|
| Demo governance                      | **Established** | Doctrine + identity + attestation contract written; UX surfaces specified. |
| Pilot governance                     | **Specified**   | Doctrine + isolation + onboarding written; pilot not yet provisioned.      |
| Rollout legitimacy review            | **Established** | Workflows defined; CLI aggregator implemented.                             |
| Onboarding governance                | **Specified**   | Phases + pacing + attestations defined; first onboarding pending.          |
| Release governance cadence           | **Established** | Cadence tiers + stabilization windows defined and enforced by registry.    |
| Environment promotion                | **Established** | Promotion graph + authority + attestation recorder implemented.            |
| Rollback governance                  | **Specified**   | Doctrine + schema written; rollback CLI to follow first non-trivial rollback.|
| Continuity-safe rollout              | **Established** | Windows in registry; refusal logic in attestation recorder.                |
| Environment legitimacy visibility    | **Specified**   | Identity contract written; UI badge + panels are follow-on app work.       |

Legend matches ORM readiness review.

## 2. What This Phase Has Achieved

- Constitutional rollout doctrine written.
- Environment registry with tier identity, topology, isolation,
  promotion graph, stabilization windows.
- Static rollout legitimacy validator implemented and runnable.
- Promotion attestation recorder implemented; refuses out-of-graph and
  in-window promotions.
- Readiness aggregator implemented.
- Rollback governance doctrine written; recorder pattern defined.
- 14-document corpus committed under `docs/nzila-rollout-governance/`.

## 3. Unresolved Risks

### 3.1 UI surfaces are specified, not implemented
Identity badge, rollout governance panel, attestation viewers, review
queues are specified. Implementation lands progressively in Control
Plane / ExecutiveOS / UE Ops, not in this phase. Until then, operator
surfaces are CLI-first.

### 3.2 Rollback CLI not yet implemented
`node tooling/scripts/record-rollback-attestation.mjs` is documented but will be implemented
on first non-trivial rollback to ensure the implementation matches
real operator need.

### 3.3 No CI wiring of `rollout:validate`
Validator runs locally; not yet a required CI gate.

### 3.4 Attestation ledger not yet append-only-enforced
Today the JSONL files are conventionally append-only. A future contract
test must assert no in-place edits.

### 3.5 Pilot infrastructure not provisioned
Pilot tier governance is fully specified but no pilot environment
exists today; first pilot provisioning is gated on demo schema
legitimacy per ORM governance.

### 3.6 Demo legitimacy depends on operator-wired snapshot
Per ORM governance, demo schema legitimacy is pending
`UE_DB_RESTORE_SNAPSHOT_URL` wiring. Demo governance UX must reflect
this state today via degradation banner per
[demo-governance-system.md §9](./demo-governance-system.md).

## 4. Sign-off Criteria for "Reconciliation Complete"

This phase will be marked **Reconciled** when:

1. Identity badge + rollout governance panel are live in at least one
   operator app (Control Plane).
2. `rollout:validate` is wired into CI for the rollout-governance and
   environments-registry paths.
3. First pilot is provisioned with sponsor sign-off recorded as an
   attestation.
4. Append-only ledger contract test exists and passes.
5. First non-trivial rollback has executed via the governed flow with
   a recorded attestation.

Until then, the rollout governance posture is **Established for demo
and staging**, **Specified for pilot and production**.

## 5. Operator Posture Statement

As of 2026-05-09, Nzila possesses an institutional rollout governance
authority layer with:

- deterministic environment identity,
- governed promotion authority,
- attested rollout events,
- continuity-safe pacing,
- legitimacy-preserving rollback doctrine.

The system behaves as governed institutional operational infrastructure
with deterministic rollout legitimacy. UI surfaces are the next
adoption frontier; the governance layer underneath them is in place
and verifiable today.
