# OCI Method™ — Methodology Surface

**Status:** Canonical
**Doctrine version:** 1.0.0
**Date of first publication:** 2026-05-23
**Audience:** institutional procurement reviewers, governance auditors, academic reviewers, certified facilitators, sponsoring institutions.

This directory holds the OCI Method™ **methodology surface**: the publication-grade whitepaper that explains how OCI's signature frameworks work, together with the machine-readable companion artifacts the whitepaper cites and the source code in [apps/union-eyes/lib/oci/frameworks/](../../../../apps/union-eyes/lib/oci/frameworks) implements.

## Files

| File | Role |
| --- | --- |
| [OCI_METHOD_WHITEPAPER_v1.md](OCI_METHOD_WHITEPAPER_v1.md) | Primary deliverable. Publication-grade methodology specification. |
| [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md) | Governance log for every change to coefficients, confidence model, observable criteria, crosswalk, or doctrine interpretation. |
| [coefficient-registry.yaml](coefficient-registry.yaml) | Authoritative source for every coefficient, weight, cap, and threshold across the five frameworks. Each carries a `derivation_status` per the §4.5 Methodological Maturity Classification™. |
| [sample-size-policy.yaml](sample-size-policy.yaml) | Minimum input quantities per framework and the interpretive caution states surfaced to consumers below threshold. |
| [standards-crosswalk.yaml](standards-crosswalk.yaml) | Section-by-section mapping of OCI doctrine to ISO 22301 / 22317 / 37000 / 31000, COBIT 2019, NIST SP 800-34, DDI, Korn Ferry, OECD, CMMI. Uses `complements | extends | gap-coverage | not-equivalent` — never "equivalent-to". A separate `measurement_traditions` block positions OCI against self-assessed-capability measurement traditions (self-efficacy, organizational readiness, safety climate, control self-assessment, ISO 22316 resilience self-assessment) using the `structurally-consistent` class — consistency, never derivation or empirical-validation inheritance. |
| [sensitivity/scenarios.yaml](sensitivity/scenarios.yaml) | 25 structured sensitivity scenarios (5 per framework). |
| [observable-criteria/entropy-1.yaml](observable-criteria/entropy-1.yaml) … [entropy-5.yaml](observable-criteria/entropy-5.yaml) | Reviewer-reproducible observable indicators per Governance Entropy ordinal. |

## How these files relate

- The **whitepaper** is the prose source of authority for the methodology surface.
- The **coefficient registry** is the prose-citable machine-readable companion: the whitepaper cites coefficient symbols by name; the registry resolves those symbols to values. The framework source code uses the same values.
- The **observable criteria** files allow a third-party reviewer to reproduce a Governance Entropy classification without access to the OCI engine.
- The **sensitivity scenarios** are the basis for the regression-style claims in whitepaper §10.
- The **standards crosswalk** is the source of authority for §12 (Standards Positioning).
- The **changelog** is the source of authority for the methodology's own governance history.

## Honesty posture

OCI v1.0.0 frameworks are **theory-informed operational weighting**. They are not empirically calibrated against a longitudinal dataset. The whitepaper makes this explicit in §4.5 (Methodological Maturity Classification™) and in the per-framework honesty notes under each coefficient table.

The methodology surface is designed to make this honesty programmatically auditable: every coefficient in `coefficient-registry.yaml` carries a `derivation_status` field, and audit gates in the whitepaper's Phase-4 verification reject any coefficient that claims a maturity level it does not yet hold.

## Doctrine references

- [docs/oci/OCI_METHOD.md](../../OCI_METHOD.md) — canonical methodology spine.
- [docs/oci/OCI_AI_BOUNDARY.md](../../OCI_AI_BOUNDARY.md) — reviewer-led use boundary.
- [docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md) — binding anti-surveillance commitments.
- [docs/oci/OCI_PRIVACY_POSITION.md](../../OCI_PRIVACY_POSITION.md) — institutional privacy commitments.
- [docs/oci/stabilization/OCI_CONTINUITY_DEBT.md](../stabilization/OCI_CONTINUITY_DEBT.md) — Continuity Debt™ signature vocabulary.
- [apps/union-eyes/lib/oci/frameworks/](../../../../apps/union-eyes/lib/oci/frameworks) — deterministic framework implementations.

## Versioning

The methodology surface is versioned independently of product releases. The version number tracks the doctrine surface, not the codebase. Changes are recorded in [METHODOLOGY_CHANGELOG.md](METHODOLOGY_CHANGELOG.md).
