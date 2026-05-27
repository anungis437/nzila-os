# Emerging Threat Model

## Purpose

This model tracks forward-looking threats that can bypass conventional controls and require pre-emptive mitigation.

---

## Threat Classes

### AI Hallucination in Production

- Risk: incorrect generated output used in operational or compliance decisions.
- Detection: response quality scoring, confidence thresholds, policy linting, and sampled human review.
- Mitigation: retrieval grounding, high-risk action confirmation gates, and fallback deterministic workflows.
- Escalation: incident class AI-HALLUCINATION with runbook linkage.

### Post-Quantum Cryptography Transition Risk

- Risk: future cryptanalytic capability compromises stored sensitive data encrypted with legacy algorithms.
- Detection: crypto inventory scans and algorithm usage reports.
- Mitigation: crypto agility roadmap, hybrid key exchange trials, and staged migration plan for long-lived secrets.
- Escalation: incident class CRYPTO-AGILITY.

### Dependency Confusion and Supply Chain Poisoning

- Risk: malicious package resolution from public registries or compromised transitive dependencies.
- Detection: lockfile integrity checks, namespace allowlists, provenance verification, and advisory monitoring.
- Mitigation: private scope enforcement, immutable lockfile in CI, and high-severity auto-blocking.
- Escalation: incident class SUPPLY-CHAIN.

---

## Mandatory Controls

| Control | Minimum expectation |
|---|---|
| Hallucination guardrails | High-impact actions require deterministic validation or human approval |
| Crypto agility | All new crypto code must be algorithm-agile and centrally configurable |
| Dependency provenance | Build pipeline must reject unapproved or unsigned critical dependencies |

---

## Evidence and Validation

- Machine-readable register: governance/foundations/resilience/emerging-threat-register.json
- Validation command: node tooling/scripts/validate-strategic-resilience.mjs --enforce
- Governance gate: GOV-GATE-022 ensures required threat families are tracked
- Operational playbooks:
  - docs/platform/AI_INCIDENT_PLAYBOOK_HALLUCINATION.md
  - docs/platform/AI_INCIDENT_PLAYBOOK_POST_QUANTUM_MIGRATION.md
  - docs/platform/AI_INCIDENT_PLAYBOOK_DEPENDENCY_CONFUSION.md

---

## Review Cadence

- Owner: Security Engineering
- Review: quarterly and after major ecosystem changes
