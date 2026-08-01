# 06 — Security

## Objective

Assess the security, privacy, governance, accessibility, bilingual, and compliance evidence relevant to institutional diligence.

## Evidence Summary

- **The repository contains a meaningful security program with workflows, runbooks, readiness packs, and contract-test evidence.** **Confidence: Verified.** Evidence: `SECURITY.md`, `.github/workflows/`, `docs/union-eyes/pilot-evidence-pack/`, `docs/compliance/soc2/`.
- **Union Eyes has the deepest security evidence corpus.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `docs/union-eyes/pilot-evidence-pack/ORG_ISOLATION_CONTROL_MAP.md`, `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`.
- **SOC 2 and ISO 27001 are repository-documented as readiness or roadmap items, not completed attestations.** **Confidence: Verified.** Evidence: `docs/compliance/soc2/README.md`, `docs/compliance/soc2/gap-log.md`, `docs/categories/stakeholders/commercial/claims-ledger.md`.

## Security Posture

| Control area | Assessment | Confidence | Evidence |
|---|---|---|---|
| Vulnerability disclosure | Security contact and response targets are published | Verified | `SECURITY.md` |
| Dependency/security scanning | Dependency audit, secret scan, Trivy, SBOM, and static analysis workflows are documented | Verified | `SECURITY.md`, `.github/workflows/dependency-audit.yml`, `.github/workflows/secret-scan.yml`, `.github/workflows/trivy.yml`, `.github/workflows/sbom.yml` |
| Secret hygiene | Repo includes Gitleaks, TruffleHog, Key Vault integration, and hardening reports | Verified | `SECURITY.md`, `.gitleaks.toml`, `lefthook.yml`, `docs/categories/platform-and-operations/security/secrets-hardening-report.md` |
| Audit trail | Hash-chained audit records and evidence packs are core controls | Verified | `SECURITY.md`, `ARCHITECTURE.md`, Union Eyes evidence docs |

## Privacy Framework

- **Privacy and data-governance posture is explicitly documented at the corporate level.** **Confidence: Documented.** Evidence: `governance/corporate/compliance/security-data-governance-overview.md`.
- **Union Eyes and FairCase both present privacy-first / identity-vault / org-scoped handling models.** **Confidence: Documented.** Evidence: `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/categories/products-and-market/faircase/procurement-trust-kit.md`.
- **Legal-compliance language should be interpreted cautiously where legal memo evidence is not surfaced.** **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md` marks some compliance claims as honesty notes.

## AI Governance

- **Repository-wide rule:** no direct AI provider imports in apps; use @nzila/ai-sdk. **Confidence: Verified.** Evidence: `CONTRIBUTING.md`, `ARCHITECTURE.md`.
- **Union Eyes AI posture:** advisory-only, human review required, route-level guard architecture present but not proven universally. **Confidence: Documented.** Evidence: `docs/categories/platform-and-operations/security/UNION_EYES_AI_RUNTIME_AND_GOVERNANCE.md`.
- **Commercial claim discipline:** all AI features should be presented as advisory and auditable, not autonomous. **Confidence: Verified.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md`, `SECURITY.md`, `docs/courtlens/README.md`.

## Accessibility (WCAG / AODA)

- **Union Eyes documents accessibility as a compliance objective.** **Confidence: Documented.** Evidence: `apps/union-eyes/README.md` references AODA/accessibility in compliance sections.
- **FairCase procurement collateral claims WCAG 2.1 AA is in progress.** **Confidence: Planned.** Evidence: `docs/categories/products-and-market/faircase/procurement-trust-kit.md`.
- **A repository-wide completed accessibility certification was not evidenced.** **Confidence: Not Yet Evidenced.**

## Bilingual Readiness (French / English)

- **FairCase is explicitly bilingual by design with populated `apps/abr/messages/en-CA.json` / `apps/abr/messages/fr-CA.json` dashboard catalogs.** **Confidence: Verified.** Evidence: `apps/abr/README.md`, `apps/abr/messages/`.
- **Union Eyes documents bilingual member-facing communications in pilot/commercial materials.** **Confidence: Documented.** Evidence: `docs/categories/stakeholders/commercial/pilot-offer-cupe.md`, `docs/categories/stakeholders/commercial/pricing-framework.md`, message-parity scripts in `apps/union-eyes/scripts/sync-en-fr-parity.mjs`.
- **Platform-wide bilingual readiness is product-specific rather than uniformly proven.** **Confidence: Documented.**

## Role-Based Access Control

- **RBAC is core to the platform and is repeatedly evidenced.** **Confidence: Verified.** Evidence: `SECURITY.md`, `ARCHITECTURE.md`, `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`, `apps/abr/README.md`.
- **Union Eyes security pack describes org-scoped roles and audit logging.** **Confidence: Demonstrated.**

## Audit Trail and Tamper-Evident Records

- **All material actions producing hash-chained audit events and evidence packs is a strongly evidenced platform pattern.** **Confidence: Verified.** Evidence: `README.md`, `ARCHITECTURE.md`, `SECURITY.md`.
- **Union Eyes specifically documents append-only audit rows, tamper detection tests, and seal verification.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`.

## SOC 2 / ISO 27001 Alignment

| Claim area | Assessment | Confidence | Evidence |
|---|---|---|---|
| SOC 2 readiness scaffold | Present | Verified | `docs/compliance/soc2/README.md`, `docs/compliance/soc2/control-mapping.md`, `docs/compliance/soc2/evidence-inventory.md`, `docs/compliance/soc2/gap-log.md` |
| SOC 2 completed audit | Not evidenced | Verified | `docs/compliance/soc2/README.md`, `docs/compliance/soc2/gap-log.md` |
| ISO 27001 alignment | Referenced as roadmap / not committed | Documented | `docs/categories/stakeholders/commercial/UNION_EYES_SECURITY_ONE_PAGER.md`, `docs/compliance/soc2/README.md` |

## SBOM / Container Scanning / DAST

- **SBOM generation:** documented in `SECURITY.md` and present as `.github/workflows/sbom.yml`. **Confidence: Verified.**
- **Trivy image scanning:** documented in `SECURITY.md` and present as `.github/workflows/trivy.yml`. **Confidence: Verified.**
- **DAST / ZAP:** repository contains `.github/workflows/dast.yml` and a `.zap/` directory. **Confidence: Verified.**
- **Completed third-party pentest:** not yet evidenced as complete for the products in scope. **Confidence: Not Yet Evidenced.** Evidence: `docs/categories/stakeholders/commercial/claims-ledger.md`, `docs/compliance/soc2/gap-log.md`, `docs/categories/platform-and-operations/security/pentest-readiness-self-assessment.md`.

## Supporting Artifacts

- `SECURITY.md`
- `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`
- `docs/categories/platform-and-operations/security/UNION_EYES_AI_RUNTIME_AND_GOVERNANCE.md`
- `docs/categories/platform-and-operations/security/pentest-readiness-self-assessment.md`
- `docs/categories/platform-and-operations/security/secrets-hardening-report.md`
- `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`
- `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`
- `docs/compliance/soc2/`
- `.github/workflows/secret-scan.yml`
- `.github/workflows/trivy.yml`
- `.github/workflows/sbom.yml`
- `.github/workflows/dast.yml`

## Current Maturity

Security evidence is strong at the platform and Union Eyes level, moderate for FairCase, and weakest where external attestations would normally supplement internal documentation.

## Commercialization Relevance

Security and privacy evidence materially improve procurement, government-program, and lender confidence, especially for Union Eyes. The main limitation is the absence of completed external attestations in the reviewed repository.

## Gaps

- No completed SOC 2 or ISO certification in evidence.
- Pentest readiness is documented; completed product-specific external pentest evidence is not.
- Accessibility is discussed but not backed by a consolidated validation corpus.

## Next Milestone

Consolidate completed external assessments, access-review evidence, and accessibility validation into the same quality tier already achieved by the Union Eyes pilot-evidence pack.
