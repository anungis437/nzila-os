# Union Eyes — Phase 1 Authoritative Indexes

**Captured:** 2026-10-07
**Repository:** `anungis437/nzila-os`
**Source baseline:** `main` / `origin/main` at `1c337567635bb86ea0df7831557d8d2d22df1e6f`
**Purpose:** map the current Union Eyes implementation and its evidence sources. This is an inventory, not product validation.

## Prospective bootstrap governance (A1G)

The [canonical bootstrap contract](reality-remediation/UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.md)
and [W1-W10 remediation specification](reality-remediation/PHASE_1B_3C_A1G_BOOTSTRAP_REMEDIATION_SPECIFICATION.md)
are **GOVERNANCE_ADOPTED_IMPLEMENTATION_PENDING**, not implemented or runtime-proven schema authority.
A1E's frozen 803 prerequisite, 118 opaque and 86 ordering evidence ceilings are unchanged.
A1I is authorized but unstarted; A1R/A2/B3C-B remain unauthorized; runtime proof readiness remains zero.
No further generic static bootstrap source pass is authorized.

### Accepted terminal W5 static-program closure

**UNION_EYES_W5_STATIC_REMEDIATION = CLOSED_BLOCKED_TERMINAL_STATIC**, accepted by the
human on 2026-10-13. The [terminal governance disposition](reality-remediation/UE_W5_TERMINAL_STATIC_DISPOSITION.md)
and [hash-preservation manifest](reality-remediation/UE_W5_TERMINAL_STATIC_PRESERVATION.json)
close this lane and release COMMAND to normal Nzila OS delivery operations.
The [terminal closure validation](reality-remediation/UE_W5_TERMINAL_STATIC_LOCAL_VALIDATION.json)
records the schema, preservation, no-runtime, deterministic-generation and documentation checks.
This is successful governance closure of unsuccessful W5 qualification, not a paused task or W5 PASS.
Further W5 engineering requires a **new human architecture charter**, not another W5B compatibility
iteration. W6 and runtime execution remain unauthorized. This status concerns only the W5 static
bootstrap/replay program; it does not mark the Union Eyes product, application or assurance failed.

### Preserved offline W5B-COMPAT disposition

The human-authorized [prospective W4P/W5 UUID supersession](reality-remediation/UE_W5_W4P_COMPATIBILITY_SUPERSESSION.md)
and [162-payload census](reality-remediation/UE_W5_W4P_COMPATIBILITY_CENSUS.md) conclude
**W5 = BLOCKED_TERMINAL_STATIC**, **W6 = NOT_AUTHORIZED**, canonical contract **1.3.3**.
Only the membership UUID/unique contract was superseded. Three independent source/W4P nullability
contradictions and seven missing constraint-operand preconditions remain outside that authorization.
The [authoritative prospective gate](reality-remediation/w5-compat/PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.md),
[plan](reality-remediation/w5-compat/UE_W5_REPLAY_IMPLEMENTATION_PLAN.md) and
[registry](reality-remediation/w5-compat/UE_W5_REPLAY_IMPLEMENTATION_REGISTRY.md) are distinct successors:
the same-named W5B-C packets at their original paths and all W5B-PK assets remain immutable
historical predecessor evidence. No full107 fresh/noop/rollback, 1.3.4, runtime execution or product
readiness is claimed. Static W5 remediation is exhausted; G3 remains terminally closed.
The [local validation ledger](reality-remediation/UE_W5_W4P_COMPATIBILITY_LOCAL_VALIDATION.json)
records exact commands and actual results, including the still-failing historical full-acceptance
test rather than treating it as an excluded or passing qualification.

## Scope and operating rules

- **Phase 0 remains `PASS`**, as ruled by the maintainer. The absent reset and integration commands and the non-canonical database setup remain Phase 3 productization obligations; they were not implemented here.
- This phase creates indexes and identifies evidence gaps only. It does not change product behavior, permissions, schemas, RLS, journeys, navigation, fixtures, or production configuration.
- The API registry below was regenerated from the current application tree. The other counts are read-only filesystem/source scans run with generated build/dependency directories excluded.
- Static presence, generated counts, route-wrapper classification, and documentation claims are not proof of runtime behavior, authorization correctness, or SaaS readiness.
- No secrets or environment-variable values were read or recorded.

### Worktree context

At the start of Phase 1, `HEAD` equaled `origin/main`, but the repository worktree was dirty with pre-existing changes across Cora, shared packages, portfolio/governance documentation, and related files. The initial status also showed untracked `apps/union-eyes/AGENTS.md` and `apps/union-eyes/CLAUDE.md`; these were not modified. Those unrelated changes were preserved.

The only intentional changes for this index are this document, its link from the Union Eyes README, and the regenerated API route report at [`apps/union-eyes/reports/route-registry.json`](../../apps/union-eyes/reports/route-registry.json).

### Context map

| Surface                   | Current source or output                                                                                     | Index treatment                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| API routes                | `apps/union-eyes/app/api/**/route.ts`; generator `apps/union-eyes/scripts/generate-route-registry.ts`        | Regenerated machine-readable route index                                |
| Pages and navigation      | `apps/union-eyes/app/**/page.tsx`; `apps/union-eyes/lib/dashboard/role-experience.ts`                        | File counts and current persona navigation census                       |
| Capabilities              | `apps/union-eyes/lib/reality/capability-registry.ts`                                                         | Curated runtime-state ledger; explicitly not exhaustive                 |
| Actions and authorization | `apps/union-eyes/actions/`, `apps/union-eyes/lib/api/`, `apps/union-eyes/lib/auth/`                          | Source namespaces and coverage limits                                   |
| Domain and persistence    | `apps/union-eyes/db/schema/`, `apps/union-eyes/db/schema-authority/`, `apps/union-eyes/backend/`, migrations | Data ownership and schema-source evidence, including conflicting claims |
| Audit and integrations    | `apps/union-eyes/lib/audit*`, `apps/union-eyes/lib/integrations/`, backend event/evidence services           | Implementation anchors and documentation/code differences               |
| Tests and fixtures        | `apps/union-eyes/**/__tests__/`, `tests/`, `e2e/`, `scripts/fixtures/`                                       | File inventory only; no tests or journeys executed                      |
| Documentation and hygiene | `docs/union-eyes/`, `apps/union-eyes/docs/`, generated reports and ontology validators                       | Current anchors, dated evidence, candidate-only hygiene indexes         |

## 1. Route index

The generated API route index is [`apps/union-eyes/reports/route-registry.json`](../../apps/union-eyes/reports/route-registry.json), produced by [`apps/union-eyes/scripts/generate-route-registry.ts`](../../apps/union-eyes/scripts/generate-route-registry.ts).

| API route inventory field                   | Current count |
| ------------------------------------------- | ------------: |
| Physical `route.ts` / `route.tsx` files     |           965 |
| Files with exported HTTP methods            |           964 |
| Static-classified governed routes           |           654 |
| Static-classified deprecated-wrapper routes |           139 |
| Static-classified public routes             |            49 |
| Static-classified cron routes               |            16 |
| Static-classified ungoverned routes         |           106 |
| Routes with audience annotation             |             3 |
| Routes with evidence-required annotation    |             3 |
| Routes with pilot-eligibility annotation    |             0 |

The generator classifies routes using source-text heuristics and configured prefixes. Its `ungoverned` and `deprecated` counts are inventory findings, not vulnerability or dead-code conclusions. The report covers API routes only; it does not replace the page, middleware, route-policy, or runtime authorization checks.

The application tree contains **343 `page.ts` / `page.tsx` files**. This is a file count, not a count of unique user-facing routes: locale variants, route groups, and other framework conventions affect route identity.

## 2. Navigation and page-path index

[`apps/union-eyes/lib/dashboard/role-experience.ts`](../../apps/union-eyes/lib/dashboard/role-experience.ts) defines five dashboard experiences and their navigation, route-prefix allowlists, pilot exclusions, and landing paths. The navigation arrays currently contain 47 entries, 29 distinct href strings, and 26 distinct pathnames. A static source-tree check found a corresponding page or route file for all 26 pathnames. This checks file presence only; it does not execute the routes or verify query-string behavior.

| Experience   | Entries | Navigation hrefs as currently declared                                                                                                                                                                                                                                                                       | Execution home                   |
| ------------ | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `member`     |       8 | `/dashboard/workspace`; `/dashboard/inbox`; `/dashboard/inbox?type=intake`; `/dashboard/claims/new`; `/dashboard/inbox?type=message`; `/dashboard/documents`; `/dashboard/settings`; `/dashboard/support`                                                                                                    | `/dashboard/workspace`           |
| `staff`      |      10 | `/dashboard/workspace`; `/dashboard/workbench`; `/dashboard/inbox?type=intake`; `/dashboard/operations`; `/dashboard/members`; `/dashboard/documents`; `/dashboard/correspondence`; `/dashboard/intelligence`; `/dashboard/notifications`; `/dashboard/settings`                                             | `/dashboard/workbench`           |
| `executive`  |      10 | `/dashboard/workspace`; `/dashboard/intelligence?scope=executive`; `/dashboard/continuity-intelligence`; `/dashboard/executive-operating-intelligence`; `/dashboard/governance-center`; `/dashboard/outcomes`; `/dashboard/leadership`; `/dashboard/intelligence`; `/dashboard/trust`; `/dashboard/settings` | `/dashboard/intelligence`        |
| `governance` |       9 | `/dashboard/workspace`; `/dashboard/governance`; `/dashboard/trust`; `/dashboard/workbench`; `/dashboard/governance`; `/dashboard/continuity-intelligence`; `/dashboard/intelligence`; `/dashboard/audits`; `/dashboard/settings`                                                                            | `/dashboard/governance`          |
| `admin`      |      10 | `/dashboard/workspace`; `/dashboard/admin/organizations`; `/dashboard/admin/members`; `/dashboard/admin/onboarding`; `/dashboard/governance`; `/dashboard/audits`; `/dashboard/security`; `/dashboard/movement-insights/export`; `/dashboard/integrations`; `/dashboard/operations`                          | `/dashboard/admin/organizations` |

The experiences map from role sets in `role-experience.ts`: `member` is the fallback; `staff`, `executive`, `governance`, and `admin` are explicit sets. Role resolution and navigation are not interchangeable with API permissions.

**Count discrepancy to preserve for later reconciliation:** the readiness rerun [`25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md`](reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md) reports 43 canonical navigation destinations at audited SHA `0a2c9fa0b`. The current source census above yields 47 entries / 26 pathnames. The definitions or snapshots differ; Phase 1 records the discrepancy and does not rewrite either source.

## 3. Persona and access-surface index

| Index concern                                  | Source of evidence                                                                                          | Current boundary                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Role-to-experience mapping                     | `lib/dashboard/role-experience.ts`                                                                          | Five UI experiences; unknown roles fall back to member experience                            |
| Landing paths and menu entries                 | `ROLE_EXECUTION_HOME_BY_EXPERIENCE`, `getNavigationForExperience()` in the same file                        | UI routing and presentation, not an API authorization policy                                 |
| Dashboard path allowlists and pilot exclusions | `ALLOWED_PREFIXES_BY_EXPERIENCE`, `PILOT_EXCLUDED_PREFIXES`, `canAccessDashboardPath()`                     | Path-based UI access behavior                                                                |
| API auth and minimum-role metadata             | Generated route registry and `lib/api/with-api.ts`                                                          | Static extraction is partial; null metadata does not prove public access                     |
| Role/policy enforcement                        | `lib/auth/roles.ts`, `permissions.ts`, `hierarchy-access-control.ts`, `policy-adapter.ts`, `rbac-server.ts` | Runtime policy source modules; not exhaustively reconciled route by route here               |
| Existing access matrix                         | `tooling/contract-tests/ue-persona-access.test.ts`; `docs/union-eyes/qa/rbac-reality-map.md`                | Contract test plus a historical route subset; the markdown map says last verified 2026-05-10 |

The existing page inventory [`apps/union-eyes/docs/governance/MODULE_PAGE_INVENTORY.md`](../../apps/union-eyes/docs/governance/MODULE_PAGE_INVENTORY.md) and the newer navigation implementation express different role/page models in places. Treat that inventory as a historical product map until reconciled against code and route-level policy.

## 4. Capability index

The machine-readable source is [`apps/union-eyes/lib/reality/capability-registry.ts`](../../apps/union-eyes/lib/reality/capability-registry.ts). It currently has **31 curated entries**:

| State             | Entries |
| ----------------- | ------: |
| `NOT_IMPLEMENTED` |       6 |
| `LIMITED`         |      14 |
| `REAL`            |       6 |
| `DISABLED`        |       3 |
| `DEGRADED`        |       1 |
| `REMOVED`         |       1 |

This registry is not an exhaustive feature, navigation, or API inventory. The Union Eyes README explicitly states that absence from the registry means **unclassified**, not `REAL`; its historical R-7 backlog is not evidence that those routes are broken. Preserve the allowed capability-state vocabulary and evidence requirements defined in the registry and the current gate documentation.

## 5. Action index

The `apps/union-eyes/actions/` tree contains **25 TypeScript files including tests**. The broader source tree has **14 files containing a `"use server"` directive**. Server actions, mutations, and query entry points also appear outside the `actions/` directory, including `db/queries/` and page/component modules.

| Concern                              | Main locations                                                 |
| ------------------------------------ | -------------------------------------------------------------- |
| Named action modules                 | `apps/union-eyes/actions/` (including `actions/icra/`)         |
| Query modules with server directives | `apps/union-eyes/db/queries/`                                  |
| API mutations                        | `apps/union-eyes/app/api/**/route.ts`                          |
| Domain mutation/service boundaries   | `apps/union-eyes/lib/services/`, `lib/workflows/`, `services/` |
| Action tests                         | `apps/union-eyes/actions/**/__tests__/`                        |

There is no single exhaustive action/function registry in the inspected sources. The count is a source-namespace census, not a count of exported action functions or state-changing operations.

## 6. Domain and data index

### Domain namespaces

The Drizzle schema tree contains **261 TypeScript files**, including **169 files** under `db/schema/domains/`. Its 20 domain subtrees are:

`agreements`, `analytics`, `cba-intelligence`, `claims`, `communications`, `compliance`, `data`, `dispatch`, `documents`, `employer-execution`, `federation`, `finance`, `financial`, `governance`, `health-safety`, `infrastructure`, `member`, `ml`, `pilot`, and `scheduling`.

### Persistence and schema authorities

| Data surface                 | Inventory                                                  | Authority evidence                                                                           |
| ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Drizzle schema definitions   | 261 TypeScript files; 169 in domain subtrees               | `db/schema/index.ts`, `db/schema-authority/registry.json`, `runtime-required-contract.json`  |
| SQL migrations               | 170 `.sql` files under migration directories               | `db/migrations/MANIFEST.md` and migration subdirectories; includes separate migration tracks |
| Django model declarations    | 18 `models.py` files                                       | `backend/` Django applications                                                               |
| Django migrations            | 42 `.py` files under migration directories                 | `backend/**/migrations/`                                                                     |
| Financial-service data layer | `services/financial-service/` schema and migration sources | Separate service boundary; not collapsed into the main app inventory                         |

**Authority conflict recorded, not adjudicated:** [`apps/union-eyes/db/README.md`](../../apps/union-eyes/db/README.md) describes Django as canonical for `public` tables and Drizzle as a read-only mirror (plus `ue_cache`), while its directory heading also calls `db/` the “Source of Truth” and its examples prescribe Drizzle schema/migrations. The architecture and schema-authority artifacts must be reconciled before future data-model changes; this phase changes none of them.

The older `reports/union-eyes-111-declaration-census.json` reports 98 physical table declarations and is dated 2026-09-09. It is not a substitute for the current schema-file census and does not establish live database shape.

## 7. Authorization and RLS index

| Layer                                   | Evidence sources                                                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API route wrapper/auth metadata         | `lib/api/with-api.ts`, `lib/api/crud-factory.ts`, generated `reports/route-registry.json`                                                                                                            |
| Roles and permissions                   | `lib/auth/roles.ts`, `permissions.ts`, `policy-adapter.ts`, `rbac-server.ts`                                                                                                                         |
| Organization/hierarchy scoping          | `lib/auth/hierarchy-access-control.ts`, organization-context guards, API wrapper tests                                                                                                               |
| Page navigation/path access             | `lib/dashboard/role-experience.ts` and its tests                                                                                                                                                     |
| Database policy/schema authority        | `db/schema-authority/`, `db/rls-storage-authority/`, `scripts/rls-enforcement/`                                                                                                                      |
| RLS migration and verification evidence | `db/migrations/`, `scripts/rls-verify.ts`, RLS isolation tests, `docs/union-eyes/reality-remediation/27_RLS_STORAGE_SCHEMA_CANONICALIZATION.md`, `28_RLS_PRIVILEGED_CALLER_AND_ORG_CONTEXT_AUDIT.md` |

The generated registry classifies 106 exported API routes as ungoverned by its wrapper heuristic and has only three audience/evidence annotations each. Neither count proves a bypass or a successful authorization check. This index makes no live database, RLS, privilege, or production-runtime claim.

## 8. Audit and evidence index

| Surface                                | Primary implementation/evidence                                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application audit logger and mutations | `lib/audit-logger.ts`, `lib/audited-case-mutations.ts`, `lib/audit/`                                                                                                                   |
| Audit services and trail               | `lib/services/audit-service.ts`, `lib/services/audit-trail-service.ts`                                                                                                                 |
| Deadline audit                         | `lib/deadline-engine/audit.ts`                                                                                                                                                         |
| Audit persistence schemas              | `db/schema/audit-security-schema.ts`, `db/schema/domains/infrastructure/audit.ts`, `db/schema/clc-sync-audit-schema.ts`                                                                |
| Immutability and audit migrations      | `db/migrations/0063_add_audit_log_archive_support.sql`, `20260402_audit_immutability.sql`, `0099_audit_remediation.sql`, `db/migrations-platform/0004_audit_gap_canonical_tables.sql`  |
| Django event/evidence implementation   | `backend/core/models.py`, `backend/core/migrations/0002_audit_hash_chain.py`, `backend/services/events/`, `backend/services/evidence_pack/`, `backend/services/compliance_snapshot/`   |
| Audit tests                            | `lib/__tests__/audit-logger.test.ts`, audit trail/mutation tests, `db/__tests__/rls-storage-authority-round49-immutable-security-audit-evidence.test.ts`, and backend compliance tests |

The older `docs/architecture/DOMAIN_MODEL.md` states that audit/evidence records are traceability artifacts, not the source of current business state. That distinction is retained; an audit index is not a domain-state index.

## 9. Integration index

The integration framework entry point is [`apps/union-eyes/lib/integrations/README.md`](../../apps/union-eyes/lib/integrations/README.md), supported by `registry.ts`, `factory.ts`, `control-plane.ts`, `sync-engine.ts`, `webhook-router.ts`, and `provider-policy.ts`.

| Adapter family | Current adapter directory               | Provider examples found in source                 |
| -------------- | --------------------------------------- | ------------------------------------------------- |
| Accounting     | `lib/integrations/adapters/accounting/` | FreshBooks, QuickBooks, Sage Intacct, Wave, Xero  |
| Communication  | `.../communication/`                    | Slack, Microsoft Teams                            |
| Documents      | `.../documents/`                        | SharePoint                                        |
| HRIS           | `.../hris/`                             | ADP, BambooHR, Workday                            |
| Insurance      | `.../insurance/`                        | Canada Life, Green Shield, iA, Manulife, Sun Life |
| LMS            | `.../lms/`                              | LinkedIn Learning                                 |

The adapter tree contains 80 files, and the integration framework subtree contains 106 files including core modules, tests, and documentation. The provider registry also lists pension integrations, but there is no pension adapter directory among the six current adapter families. Registry presence is not evidence of an implemented or connected integration.

## 10. Test index

The source-tree scan found **1,335 files** matching `*.test.*` or `*.spec.*` under Union Eyes, including unit, route, integration, and browser tests. This is a filename census, not a test-run result.

| Test surface               | Current index                                                                 |
| -------------------------- | ----------------------------------------------------------------------------- |
| API route tests            | `app/api/__tests__/`                                                          |
| UI/library/component tests | `components/**/__tests__/`, `lib/**/__tests__/`, `contexts/**/__tests__/`     |
| API QA suites              | `tests/api/` (30 files under `tests/` including helpers and fixtures)         |
| Browser/E2E suites         | `e2e/` (21 files) and `tests/e2e/`                                            |
| Database/RLS tests         | `db/__tests__/`, migration and isolation contract tests                       |
| Django/backend tests       | `backend/**/tests*.py` and app test modules                                   |
| Test configuration         | `vitest.config.ts`, `playwright.config.ts`, package scripts in `package.json` |

No test, build, or browser journey was run as part of this documentation/indexing phase.

## 11. Fixture and seed index

| Location                                   | Inventory                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `tests/fixtures/`                          | `test-cases.ts`, `test-orgs.ts`, `test-permissions.ts`, `test-users.ts` |
| `e2e/helpers/`                             | Authentication, governance, navigation assertions, and role fixtures    |
| `lib/integration/__fixtures__/`            | Integration test fixtures                                               |
| `scripts/fixtures/`                        | Script-level fixtures                                                   |
| `db/seeds/`                                | Database seed sources                                                   |
| `scripts/seed-*.ts` / `scripts/seed-*.mjs` | Development, pilot, and demo seed entry points                          |

The scan found 15 files under directories named `fixtures`, `__fixtures__`, `testdata`, or `seeds`; inline fixtures and data embedded in test files are not included in that count. These are test/development references only; no LIUNA recording fixtures or recording certification were created or changed.

## 12. Documentation index

| Documentation tree      | Markdown files | Role in this index                                                                       |
| ----------------------- | -------------: | ---------------------------------------------------------------------------------------- |
| `docs/union-eyes/`      |             67 | Product gate, reality-remediation ledgers, QA and pilot evidence                         |
| `apps/union-eyes/docs/` |             58 | App architecture, operations, governance, security, procurement, trust center, workspace |
| **Combined**            |        **125** | File count; excludes README files elsewhere and generated/non-Markdown artifacts         |

Primary current navigation points:

- [`docs/union-eyes/README.md`](README.md) — product and gate orientation.
- [`docs/union-eyes/reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md`](reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md) — gate snapshot, audited at `0a2c9fa0b` on 2026-08-31.
- [`apps/union-eyes/docs/governance/MODULE_PAGE_INVENTORY.md`](../../apps/union-eyes/docs/governance/MODULE_PAGE_INVENTORY.md) — page/module map, marked last updated 2026-05-17.
- [`docs/union-eyes/qa/rbac-reality-map.md`](qa/rbac-reality-map.md) — subset route/RBAC map, last verified 2026-05-10.
- [`apps/union-eyes/docs/architecture/DOMAIN_MODEL.md`](../../apps/union-eyes/docs/architecture/DOMAIN_MODEL.md) — domain and audit distinctions.
- [`apps/union-eyes/docs/governance/TERMINOLOGY_ALIGNMENT.md`](../../apps/union-eyes/docs/governance/TERMINOLOGY_ALIGNMENT.md) — product language and surface map.

**Snapshot differences to carry forward:** the README identifies file 25 as the current gate ruling and records that it was audited at SHA `0a2c9fa0b`; the Phase 1 source baseline is `1c3375676`. No operational-readiness rerun was performed here, so the documented `NO_GO — RUNTIME_PROOF_REQUIRED` ruling remains the governing readiness evidence. That ruling is separate from the maintainer's Phase 0 `PASS` baseline-mapping decision. The README's folder map describes the numbered ledger range as 00–25, while files 26–28 are also present; the map is therefore not an exhaustive file listing. The May page/RBAC inventories also differ in places from the current role-navigation module. No gate ruling or historical document was rewritten in Phase 1.

## 13. Dead-code candidate index

No exhaustive, authoritative dead-code index or unused-export analysis was found in the inspected Union Eyes sources. The following are **review inputs only**, not proof of dead code:

- 139 routes classified as deprecated wrappers by the route-registry text heuristic.
- Capability-registry entries in `REMOVED` or `DISABLED` states.
- `reports/ontology-antipattern-inventory.md`, generated 2026-05-25, reports zero ontology anti-pattern matches; it is not a dead-code scanner.
- `lib/api/deprecation.ts` and the deprecation route inventory are relevant to API lifecycle review, not source reachability proof.

No file was deleted or marked dead.

## 14. Duplication candidate index

[`apps/union-eyes/schema-duplicate-table-report.txt`](../../apps/union-eyes/schema-duplicate-table-report.txt) reports:

| Static report classification              | Count |
| ----------------------------------------- | ----: |
| Distinct `(schema, table)` keys           |   702 |
| Keys with multiple declarations           |   341 |
| Conflicting schemas                       |    15 |
| Same column set, compatibility unverified |     3 |
| Identical or statically compatible        |   323 |

The report is a candidate index, not a live-database reconciliation. Its generation date is not established in the report header. The separately dated 2026-09-09 declaration census reports 98 physical table declarations, so the two artifacts use different scopes or snapshots and must not be combined as if they were one denominator. No duplicate was removed or refactored.

## 15. Environment-variable index

Environment templates found:

| Template                                                  | Declared keys |
| --------------------------------------------------------- | ------------: |
| `apps/union-eyes/.env.example`                            |            78 |
| `apps/union-eyes/backend/.env.example`                    |            14 |
| `apps/union-eyes/backend/.env.template`                   |            12 |
| `apps/union-eyes/services/financial-service/.env.example` |            29 |
| **Unique declared keys across templates**                 |       **106** |

A source-pattern scan of code and configuration files found 382 distinct environment-key references: 312 names are not present in those four templates, and 36 template keys were not matched by the static scan. These are **reconciliation candidates**, not asserted runtime configuration defects: the scan spans tests, scripts, backend, and service code; dynamic key access and indirect configuration may not be recognized. Actual local `.env` files and values were excluded.

## 16. Terminology and ontology index

| Source                                                                                                                                                | Coverage/evidence                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/union-eyes/config/continuity-ontology-matrix.json`                                                                                              | Version 1.4.2, last updated 2026-05-25; nine semantic-dictionary terms plus route/API/navigation/gating governance metadata |
| `apps/union-eyes/scripts/validate-ontology-dictionary.ts`                                                                                             | Validates dictionary structure and canonical-label presence in the referenced glossary                                      |
| `apps/union-eyes/scripts/validate-ontology-nav.ts`, `validate-ontology-gating.ts`, `validate-ontology-docs.ts`, `validate-ontology-registry-drift.ts` | Navigation, gating, documentation, and registry-drift validation entry points                                               |
| `apps/union-eyes/docs/governance/TERMINOLOGY_ALIGNMENT.md`                                                                                            | Product labels, user actions, route/API references, and narrative rules                                                     |
| `docs/categories/products-and-market/union-eyes/runtime-authority-audit/constitutional-semantic-dictionary.md`                                        | Glossary referenced by the ontology matrix                                                                                  |

The terminology matrix and the live role-navigation source use different product language in places (for example, documented “Work”/“Priorities” surfaces versus current menu labels such as “Operations”/“Operations Queue”). The module inventory also describes a member experience differently from the current member navigation. These are reconciliation findings for later phases; Phase 1 does not retarget navigation or rewrite product copy.

## 17. Phase disposition

```text
PHASE_0_GATE = PASS
PHASE_1_INDEX_STATUS = CAPTURED
PHASE_3_OBLIGATION_RESET = CREATE_CANONICAL_RESET
PHASE_3_OBLIGATION_DATABASE_SETUP = CREATE_CANONICAL_DB_SETUP
PHASE_3_OBLIGATION_INTEGRATION = DEFINE_AND_EXPOSE_CANONICAL_INTEGRATION_COMMAND
PRODUCT_REMEDIATION = NOT_PERFORMED
PRODUCTION_CHANGES = NOT_PERFORMED
```

The indexes establish a source map and record inconsistencies without deciding product behavior or readiness. Phase 3 command gaps remain deferred exactly as directed.
