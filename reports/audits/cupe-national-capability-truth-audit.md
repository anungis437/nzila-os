# Union Eyes CUPE National Capability-Truth Audit

## Audit identity

- Audited branch: `fix/union-eyes-reality-remediation`
- Audited commit: `099af64e3d3ccb0a610dd4180069649d39cc40e9`
- Audit date: 2026-07-22
- Repository state: combination of the commit above and a dirty working tree. The pre-existing modifications are documentation, operations outputs, and generated reports; no Union Eyes product source file was modified by this audit.
- Package manager: pnpm 10.33.0.
- Scope: `apps/union-eyes`, its workspace dependencies, deployment configuration, tests, current repository reports, and CUPE pilot materials.

## Method and classification discipline

This is an implementation audit, not a documentation acceptance review. A capability received a positive classification only where the route or executable service, server-side authorization, organization scope, persistence, and tests could be identified. A schema, route name, dependency, UI, pilot checklist, or marketing statement was not treated as proof by itself. The capability inventory found 1,714 Union Eyes surfaces, of which only 7 were covered by the current surface registry; this is a material traceability gap.

The system map and individual findings are recorded in `cupe-national-audit-evidence-register.md`; scenario-level determinations are in `cupe-national-scenario-response-matrix.md` and its JSON counterpart.

## Current system map

| Area | Repository evidence | Audit determination |
|---|---|---|
| Application | `apps/union-eyes/app`, Next.js 16 app; public marketing, locale-scoped, authenticated dashboard, admin, workbench, case and workbook surfaces | Implemented application surface, but broad surface ownership is incomplete. |
| Core service functions | `app/api/**`, `lib/**`, `services/**`, backend Django modules | 931 API routes and 127 services were discovered. Only pilot-critical routes have a documented and tested route inventory. |
| Data | `db/schema/index.ts`, `db/schema/domains/**`, `union-structure-schema.ts`, migrations | Rich schema covers claims, documents, governance, organization-linked structures, analytics, AI, and infrastructure. Runtime use is unevenly proven. |
| AuthN/AuthZ | `lib/api-auth-guard.ts`, `lib/auth/**`, `lib/db/with-rls-context.ts` | Email/password sessions and optional Entra paths exist; role hierarchy and selected server guards exist. Whole-API authorization coverage is not proven. |
| Tenant/org model | organization IDs, `getOrganizationIdForUser`, RLS wrapper, seeded primary/secondary organizations | Pilot-critical cross-org negative tests exist. CUPE National multi-level hierarchy and multi-context membership are not proven end-to-end. |
| Casework | case/claim intake, assignment, transition, evidence, audit/export routes; E2E/API tests | Seeded pilot workflow is demonstrable conditionally. Escalation, appeal, cross-structure transfer, and joint ownership are not proven. |
| Reporting | analytics routes, dashboard/export paths, analytics schema | Pilot dashboard/export claims have tests; National aggregate-without-record-access is not proven. |
| Governance | governance schema/routes, audit logger, evidence tooling | Scoped audit/evidence workflows are demonstrable conditionally. National decision lineage/authority workflow is not proven. |
| Localization | `i18n.ts`, `lib/locales.ts`, `messages/**`, locale tests | Locale routing and fallback exist. English/French operational parity has not been proven. |
| Accessibility | accessible components and unit tests, no demonstrated full automated/manual audit | Partially implemented; no WCAG conformance claim is supportable. |
| AI | `app/api/ai/**`, `lib/ai/**`, `@nzila/ai-sdk` | AI features are optional, rate-limited and guarded in inspected routes. Sensitive-data policy, end-to-end audit, and all decision safeguards need validation. |
| Deployment/ops | Dockerfile, `infra/main.bicep`, release/observability scripts, ACA evidence | Staging/demo deployment evidence exists. Production readiness, tenant offboarding, restoration, and incident drills are unproven for CUPE National. |

## Domain findings

| Domain | Classification | Capability truth |
|---|---|---|
| A. Organizational hierarchy | PARTIALLY_IMPLEMENTED | Organization-linked employers, worksites, bargaining units, committees and steward assignments are modelled. There is no demonstrated configurable CUPE National-to-local hierarchy or multi-context membership boundary. |
| B. National/regional/local autonomy | NOT_PROVEN | Seeded cross-org denial exists, but selective National oversight, consented sharing, delegated administration and aggregate-only access are not traced. |
| C. Casework continuity | IMPLEMENTED_WITH_LIMITATIONS | Intake, assignment, selected transitions, evidence, timeline and export are guarded/tested for the pilot. Appeals, reopening, transfer and lifecycle completeness are not proven. |
| D. Servicing/escalation | PARTIALLY_IMPLEMENTED | Escalation-related paths and models exist, but a complete acceptance/rejection/return/SLA audit workflow was not evidenced. |
| E. Executive visibility | PARTIALLY_IMPLEMENTED | Pilot KPI/dashboard routes and tests exist. National-safe aggregation and live calculation provenance are unproven. |
| F. Confidentiality | PARTIALLY_IMPLEMENTED | Organization scope, attachment controls and a selected AI document check exist. Matter/document/field sensitivity tiers and privilege hiding are not proven. |
| G. Authorization | IMPLEMENTED_WITH_LIMITATIONS | Server wrappers and pilot critical-route checks exist, including cross-org negative E2E. 1,707 unregistered surfaces prevent a whole-system authorization assertion. |
| H. Documents/evidence | IMPLEMENTED_WITH_LIMITATIONS | Scoped attachment/evidence pilot control is evidenced. Retention, legal hold, versioning, redaction, disposition and malware runtime proof are not complete. |
| I. Institutional memory | PARTIALLY_IMPLEMENTED | Structured case/audit/evidence primitives exist; transition procedures and automated continuity safeguards are not proven. |
| J. Governance lineage | PARTIALLY_IMPLEMENTED | Governance schema/audit infrastructure exists, but the decision-to-approval-to-evidence lifecycle is not fully traced. |
| K. Reporting/analytics | PARTIALLY_IMPLEMENTED | Pilot metrics/export paths are tested. Permission-safe drill-down, definitions, National comparisons and data-quality warnings are unproven. |
| L. Bilingual operation | PARTIALLY_IMPLEMENTED | `en-CA`/`fr-CA` routing/fallback are implemented; operational-screen, notification, export, error and AI parity is unproven. |
| M. Accessibility | NOT_PROVEN | Component-level accessibility work exists, but no complete automated plus manual evidence supports WCAG compliance. |
| N. Search/retrieval | PARTIALLY_IMPLEMENTED | Negative org search test exists; full record/document multilingual search, indexing and pagination authority are unproven. |
| O. Notifications | PARTIALLY_IMPLEMENTED | Notification schema/routes exist. Delivery, preferences, language, failure handling, and sensitive-data minimization are not fully traced. |
| P. Integration | REQUIRES_DISCOVERY_OR_VALIDATION | Entra and Azure/Graph-related dependencies/configuration exist. CUPE M365, membership, case, document, and warehouse integrations are not implemented evidence. |
| Q. Historical migration | NOT_IMPLEMENTED | No complete import, matching, reconciliation, rollback, provenance and dry-run path was evidenced. |
| R. Scale/performance | NOT_PROVEN | No repeatable CUPE National load, concurrency, recovery or volume evidence was available. |
| S. Privacy/security/operations | PARTIALLY_IMPLEMENTED | Sessions, rate limits, secrets/deployment tooling and monitoring components exist. Compliance, residency, restore, IR and assurance claims need runtime evidence and legal review. |
| T. AI | IMPLEMENTED_WITH_LIMITATIONS | Inspected summarization has auth, rate limit, entitlement/feature guard, organization document check, trace metadata and `reviewRequired: true`. It still transmits content to an external provider path and lacks a CUPE-specific data/approval assessment. |
| U. Deployment/production | NOT_PROVEN | Staging/pilot-oriented material and Bicep/ACA configuration exist. CUPE National production provisioning, support, DR and offboarding readiness are not proven. |

## Adversarial demo audit

The full question bank is in the boundary register. The application would survive a live demo only for seeded, pilot-critical cases using the tested roles and organization boundaries. It must not be used live to prove National-local visibility rules, privileged-matter restrictions, cross-organization collaboration, full bilingual parity, M365 integration, migration, accessibility conformance, National scale, or production assurance.

## Validation record

Validation was run against the current modified working tree. Commands, result classifications, and blockers are recorded in the evidence register. Audit artifacts intentionally report execution separately from code inspection; no unexecuted test is represented as passing.

## Reproducibility

The audit is reproducible from the branch/commit above only after preserving the listed working-tree changes and rerunning the commands in the evidence register. Generated reports in the working tree may change as a side effect of repository governance commands.
