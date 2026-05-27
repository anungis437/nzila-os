# Regulatory Change Monitoring

## Purpose

Ensure policy and implementation remain aligned with evolving obligations (GDPR, CCPA/CPRA, Law 25, PIPEDA, and AI regulations).

---

## Regulatory Watchlist

| Regulation | Scope | Monitoring source | Review cadence |
|---|---|---|---|
| GDPR | EU personal data processing | EDPB guidance + legal advisories | Monthly |
| CCPA/CPRA | California consumer privacy | CA AG and CPPA updates | Monthly |
| Law 25 (Quebec) | Quebec privacy | CAI publications | Monthly |
| PIPEDA | Canada privacy baseline | OPC guidance and bulletins | Monthly |
| EU AI Act | AI risk and governance | Official EU publications | Monthly |

---

## Workflow

1. Detect change in monitored regulation feed.
2. Classify impact level (none, low, medium, high).
3. Create tracked action item with due date.
4. Update affected policy docs and controls.
5. Record closure evidence and reviewer sign-off.

---

## Enforcement

- Machine-readable registry: governance/foundations/resilience/regulatory-watchlist.json
- Validation command: node tooling/scripts/validate-strategic-resilience.mjs --enforce
- Governance gate: GOV-GATE-025 ensures the watchlist remains complete and current

---

## Ownership

- Primary owner: Compliance lead
- Technical owner: Platform Governance
