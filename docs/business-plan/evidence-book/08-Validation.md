# 08 — Validation

## Objective

Summarize only documented validation evidence: pilots, customer-discovery traces, proof runs, adversarial testing, stress/readiness materials, and external-review readiness.

## Evidence Summary

- **Union Eyes has the clearest pilot-validation corpus.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/`, `docs/categories/products-and-market/union-eyes/pilot-overview.md`, `docs/categories/products-and-market/union-eyes/pilot-kpis.md`.
- **CIVIC has public-sector discovery engagement and forwardable briefings, but no completed pilot-validation corpus.** **Confidence: Documented.** Evidence: `docs/public-service/civic-one-page-brief.md`, `docs/public-service/public-service-conversation-guide.md`.
- **OCI/OCRA methodology includes procurement-facing validation binders and adversarial-review protocols, but these should not be described as completed external validation.** **Confidence: Documented.** Evidence: `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`.

## Pilot Programs

| Pilot evidence area | Assessment | Confidence | Supporting artifacts |
|---|---|---|---|
| Union Eyes controlled pilot | Full evidence pack, readiness memo, operations runbook, scope lock, success metrics | Demonstrated | `docs/union-eyes/pilot-evidence-pack/` |
| Union Eyes pilot metrics | Route-level KPI definitions and auditable metric-write model | Verified | `docs/categories/products-and-market/union-eyes/pilot-kpis.md`, `apps/union-eyes/docs/procurement/PILOT_SCOPE.md` |
| CIVIC public-sector discovery | Forwardable briefings and conversation guides for government audiences | Documented | `docs/public-service/forwardable/`, `docs/public-service/public-service-conversation-guide.md` |
| CourtLens pilot | Planning-stage pilot definition only | Planned | `docs/courtlens/pilot-readiness-plan.md` |

## Customer Discovery Evidence

- **Commercial research and pursuit targeting clearly exist.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/ICP_DEFINITION.md`, `docs/categories/stakeholders/commercial/TOP_15_PURSUIT_LIST.md`, `docs/categories/stakeholders/commercial/FIRST_50_TARGETS_CANADA.md`.
- **Direct customer-discovery logs, interview transcripts, or signed reference artifacts were not surfaced in the reviewed repository.** **Confidence: Not Yet Evidenced.**

## Sector Validation

- **Union Eyes sector focus is well articulated around Canadian labour organizations.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/why-union-eyes.md`, `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`, and Union Eyes product docs under `docs/categories/products-and-market/union-eyes/`.
- **CIVIC sector focus is explicitly framed around public-service continuity, modernization, and institutional-memory challenges for federal and provincial institutions.** **Confidence: Documented.** Evidence: `docs/public-service/civic-thesis.md`, `docs/public-service/the-public-service-continuity-problem.md`.
- **Institutional-intelligence sector rationale is deeply documented in doctrine whitepapers.** **Confidence: Documented.** Evidence: doctrine and OCI whitepapers.

## Adversarial Testing / CBA Intelligence Validation

- **Repository-level adversarial/security-review workflows exist.** **Confidence: Verified.** Evidence: `.github/workflows/red-team.yml`, `README.md` maturity signals.
- **Union Eyes case and cognition governance include test and validation references, but completed external CBA-intelligence validation evidence was not separately surfaced in reviewed materials.** **Confidence: Documented.** Evidence: `CHANGELOG.md`, Union Eyes docs index, doctrine corpus.

## Stress Testing / Proof Runs

- **Live-readiness, infra-convergence, backup/restore, and runtime-proof commands exist.** **Confidence: Verified.** Evidence: `package.json`, `docs/readiness/`, `docs/union-eyes/pilot-evidence-pack/READINESS_COMMANDS.md`.
- **Restore drill and runtime evidence are specifically documented for Union Eyes.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/PILOT_READINESS_MEMO.md`, `docs/union-eyes/pilot-evidence-pack/RUNTIME_EVIDENCE_PACK.md`, `docs/readiness/backup-restore-certification.md`.
- **Formal load/performance benchmark outputs for all core products were not assembled in one reviewed location.** **Confidence: Not Yet Evidenced.**

## External Review Materials

- **Procurement-facing methodology review materials are documented in the OCI method publication.** **Confidence: Documented.** Evidence: `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` references the validation binder, obligation taxonomy, and assessor standards.
- **Investor technical diligence summary exists for Union Eyes.** **Confidence: Documented.** Evidence: `docs/union-eyes/pilot-evidence-pack/INVESTOR_TECHNICAL_DILIGENCE_SUMMARY.md`.
- **Completed independent validation, certification, or auditor opinion letters were not found in the reviewed repository.** **Confidence: Not Yet Evidenced.**

## Supporting Artifacts

- `docs/union-eyes/pilot-evidence-pack/`
- `docs/categories/products-and-market/union-eyes/pilot-overview.md`
- `docs/categories/products-and-market/union-eyes/pilot-kpis.md`
- `docs/categories/products-and-market/faircase/pilot-package-v1.md`
- `docs/categories/products-and-market/faircase/pilot-plan.md`
- `docs/courtlens/pilot-readiness-plan.md`
- `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md`
- `package.json`
- `.github/workflows/red-team.yml`

## Current Maturity

Validation evidence is strongest where Nzila has operationalized a product into a controlled pilot motion. That is clearest for Union Eyes.

## Commercialization Relevance

This section matters because commercial readiness is materially improved when product claims are paired with validation loops, review runbooks, and formal success criteria.

## Gaps

- Customer-discovery transcripts, reference letters, or close reports are not a strong in-repo evidence class yet.
- CIVIC and CourtLens do not yet have evidence packs comparable to Union Eyes.
- External independent validation remains more prepared-for than completed.

## Next Milestone

Publish completed pilot close reports and external-review outputs using the same evidence-pack discipline already established for controlled pilot readiness.
