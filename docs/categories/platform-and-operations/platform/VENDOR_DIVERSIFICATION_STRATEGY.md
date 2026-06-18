# Vendor Diversification and Exit Strategy

## Purpose

This strategy reduces single-vendor concentration risk by requiring explicit secondary providers, portability boundaries, and tested exit procedures for every critical capability.

---

## Critical Capability Matrix

| Capability | Primary provider | Secondary or fallback | Maximum tolerated disruption |
|---|---|---|---|
| LLM inference | Azure OpenAI | OpenAI API (or self-hosted inference gateway) | 4 hours |
| Observability | Azure Monitor + App Insights | OpenTelemetry collector + Prometheus/Grafana-compatible backend | 8 hours |
| Secrets management | Azure Key Vault | HashiCorp Vault or cloud-native KMS abstraction | 8 hours |
| Blob/object storage | Azure Blob | S3-compatible storage adapter | 24 hours |
| CI/CD runtime | GitHub Actions | Self-hosted runner pool + alternate CI definition | 12 hours |

---

## Architecture Guardrails

1. New external dependencies must be integrated through an adapter interface.
2. App code must not directly consume provider SDK clients outside approved gateway packages.
3. Every provider integration must declare a portability score and migration effort estimate.
4. Control plane must maintain provider configuration in one authoritative registry.

---

## Exit Readiness Requirements

| Requirement | Frequency | Evidence |
|---|---|---|
| Restore critical path on secondary provider in staging | Quarterly | Drill report + deployment logs |
| Validate data export format compatibility | Quarterly | Schema compatibility checklist |
| Rotate one service to backup integration for 24h | Semi-annual | Incident-free execution report |
| Recalculate egress and migration cost envelope | Quarterly | FinOps worksheet |

---

## Enforcement

- Machine-readable source of truth: governance/foundations/resilience/vendor-diversification-registry.json
- Validation command: node tooling/scripts/validate-strategic-resilience.mjs --enforce
- Governance gate: GOV-GATE-021 ensures this strategy and registry stay present and complete

---

## Review Cadence

- Owner: Platform Architecture
- Review: quarterly
- Triggered review: unknown Sev 1 outage involving provider dependency
