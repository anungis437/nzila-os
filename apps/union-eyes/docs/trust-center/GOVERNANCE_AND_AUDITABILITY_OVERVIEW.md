# UnionEyes — Governance and Auditability Overview

> **Audience:** Governance auditors, procurement reviewers, institutional buyers.
> **Scope:** Public-safe summary of UnionEyes runtime governance controls and audit trail posture.
> **Caveats:** Claims use language such as "is designed to," "supports," and "provides evidence of."

---

## 1. Runtime Governance Architecture

UnionEyes is designed with a layered governance architecture that operates in parallel with
production runtime without blocking or modifying it (shadow mode).

**Governance layers (Waves 1–10):**

| Layer | Description |
|-------|-------------|
| Migration lineage | SHA-256 manifest of all applied database migrations |
| Route registry | Generated inventory of all governed API and page routes |
| API governance validation | CI gate verifying route-level policy conformance |
| Middleware activation | Runtime middleware enforcing rate limits and auth guards |
| Route policy orchestration | Policy evaluation engine applied to all route accesses |
| Governance observability | Telemetry classification, correlation IDs, evidence ledger |
| Evidence correlation | Cross-event correlation for audit trail reconstruction |
| Governance simulation | Shadow-mode scenario engine for institutional preparedness |
| Federation sovereignty | Sovereignty modeling and delegation chain evaluation |

---

## 2. Audit Trail

UnionEyes is designed to support audit trail reconstruction through:

- **Correlation IDs:** All governance events are assigned a correlation ID that links related
  operations across the audit ledger.
- **Event retention:** The governance observability ledger retains up to 10,000 classified
  events with oldest-eviction semantics, providing a recent event history.
- **Simulation ledger:** Governance simulations are ledgered separately for governance
  preparedness evidence.
- **Sovereignty ledger:** Delegation chain events, sovereignty mode transitions, and conflict
  classifications are recorded in the federation sovereignty ledger.

*Supporting evidence:*
- `lib/governance-observability/correlation.ts` — correlation ID assignment
- `lib/governance-observability/ledger.ts` — observability event ledger
- `lib/governance-simulation/ledger.ts` — simulation ledger
- `lib/federation-sovereignty/ledger.ts` — sovereignty ledger

---

## 3. Policy Contracts

Governance contracts declare the expected behaviour for each governance scope. Contracts
include:

- Governance sensitivity classification (`low`, `moderate`, `high`, `critical`)
- Federation tier applicability
- AI operation risk thresholds
- Evidence requirements
- Escalation conditions

Contracts are registered at module load and validated by a CI gate on every change.

*Supporting evidence:*
- `lib/governance-policy/contracts.ts` — governance contract definitions
- `scripts/validate-governance-contracts.ts` — CI validation gate

---

## 4. Governance CI Gates

The following CI gates provide continuous governance evidence:

| Gate | Script | Purpose |
|------|--------|---------|
| `governance:contracts` | `validate-governance-contracts.ts` | Policy contract conformance |
| `validate:route-policies` | `validate-route-policies.ts` | Route policy assignment coverage |
| `governance:observability` | `validate-governance-observability.ts` | Observability ledger integrity |
| `governance:simulation` | `validate-governance-simulation.ts` | Simulation scenario validity |
| `governance:sovereignty` | `validate-governance-sovereignty.ts` | Sovereignty chain integrity |
| `trust:center:check` | `generate-trust-center-manifest.ts` | Evidence manifest coverage |

All gates are warn-only by default and do not block production deployment.

---

## 5. Governance Observability Summary

| Capability | Status |
|------------|--------|
| Correlation ID assignment | ✅ Present |
| Event severity classification | ✅ Present |
| Retention-aware event ledger | ✅ Present |
| Cross-event evidence correlation | ✅ Present |
| Governance simulation ledger | ✅ Present |
| Federation sovereignty ledger | ✅ Present |
| CI governance validation gates | ✅ Present (6 gates) |

---

*See also: [PROCUREMENT_EVIDENCE_MAP.md](./PROCUREMENT_EVIDENCE_MAP.md)*
