# Tenant Terminology Inventory

> Generated from exhaustive grep search across all directories.
> Excludes: `node_modules/`, `.git/`, `pnpm-lock.yaml`, `coverage/`, `.next/`, `dist/`, `.turbo/`

## Classification Legend

| Tag | Meaning |
|-----|---------|
| **RENAME** | Safe to replace `tenant` → `org` / `organization` |
| **EXTERNAL_API** | Azure / Firebase / Xero / django-tenants API surface — **must keep** |
| **REPORT_SELF_REF** | Alignment reports / contract tests _discussing_ the word "tenant" |
| **DATA_ARTIFACT** | Legacy analysis JSON, manifest data, migration reports — rename if still referenced |
| **BUILD_CACHE** | `tsconfig.tsbuildinfo` — auto-regenerated, no manual edit needed |

---

## Summary

| Classification | Unique files | Approx. line matches |
|---------------|-------------|---------------------|
| RENAME | ~95 | ~650+ |
| EXTERNAL_API | ~12 | ~25 |
| REPORT_SELF_REF | ~18 | ~40 |
| DATA_ARTIFACT | ~15 | ~200+ |
| BUILD_CACHE | ~8 | ~20 |

---

## 1. ROOT-LEVEL FILES

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `catalog-info.yaml` | L15 | `"multi-tenant"` tag | RENAME |
| `README.md` | L228 | "Org-level tenant isolation" | RENAME |
| `README.business.md` | L103 | "no cross-tenant leakage" | RENAME |
| `contract-test-output.txt` | L672-673 | test output mentioning tenant | DATA_ARTIFACT |

---

## 2. `.github/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `.github/workflows/platform-automation.yml` | L4,24,143,160,178-234 | `tenant-health` job, `tenant-provisioning.ts` refs | RENAME |
| `.github/workflows/game-day.yml` | L26,144 | `cross-tenant-isolation` experiment | RENAME |

---

## 3. `apps/` — Catalog & Config

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `apps/zonga/catalog-info.yaml` | — | `nzila.app/tenant-scoped: "true"` | RENAME |
| `apps/console/catalog-info.yaml` | — | `nzila.app/tenant-scoped: "true"` | RENAME |
| `apps/cfo/catalog-info.yaml` | — | `nzila.app/tenant-scoped: "true"` | RENAME |
| `apps/abr/catalog-info.yaml` | — | `nzila.app/tenant-scoped: "true"` | RENAME |
| `apps/web/catalog-info.yaml` | — | `nzila.app/tenant-scoped: "true"` | RENAME |
| `apps/nacp-exams/catalog-info.yaml` | — | `nzila.app/tenant-scoped: "true"` | RENAME |

### `apps/abr/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `apps/abr/infra/main.bicep` | L86 | `tenantId: subscription().tenantId` | **EXTERNAL_API** |
| `apps/abr/backend/services/api/tenant_offboarding_views.py` | L4,23 | `TenantOffboardingViewSet` | RENAME |
| `apps/abr/backend/auth_core/migrations/0001_initial.py` | L306,310,520 | `legacy_tenant_id` field | RENAME |
| `apps/abr/backend/auth_core/models.py` | L209,258 | `legacy_tenant_id`, `idx_org_legacy_tenant` | RENAME |

### `apps/console/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `apps/console/app/(dashboard)/pilot/export/page.tsx` | L189-190 | "Tenants Checked", "Cross-Tenant Leaks" UI labels | RENAME |
| `apps/console/app/(dashboard)/integrations/deliveries/page.tsx` | L94 | "org tenant" | RENAME |
| `apps/console/docs/DOMAIN_MODEL.md` | L9,16 | "Tenant management" | RENAME |

### `apps/orchestrator-api/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `apps/orchestrator-api/src/platform.ts` | L44,51 | `tenantId = 'system'` | RENAME |

### `apps/platform-admin/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `apps/platform-admin/app/search/page.tsx` | L73 | "Tenant-isolated search" | RENAME |
| `apps/platform-admin/app/orchestrator-ops/page.tsx` | L43 | `'tenant-onboarding'` | RENAME |

### `apps/cfo/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `apps/cfo/components/firm-health-dashboard.tsx` | L5 | "multi-tenant" comment | RENAME |

### `apps/flow/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `apps/flow/docs/*.md` | various | multi-tenant references | RENAME |

### `apps/union-eyes/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `apps/union-eyes/docs/DOMAIN_MODEL.md` | L10 | "Organisation tenant root" | RENAME |
| `apps/union-eyes/db/schema/domains/infrastructure/clc-per-capita.ts` | L121 | "multi-tenant" comment | RENAME |
| `apps/union-eyes/backend/services/migrations/0001_enterprise_hardening.py` | L162,325 | "Tenant organization ID" | RENAME |

#### `apps/union-eyes/services/financial-service/` (MASSIVE — ~200+ matches)

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `src/tests/workflows.test.ts` | L37-781 | `TEST_TENANT_ID` constant, ~80 uses | RENAME |
| `src/tests/analytics.test.ts` | L36-229 | `TEST_TENANT_ID`, ~30 uses | RENAME |
| `add-missing-tables.sql` | various | `tenant_id` columns, `tenant_idx` indexes | RENAME |
| `drizzle/0000_lucky_mole_man.sql` | L1709-4246 | `tenant_id` cols, `tenant_management_view`, `tenants` table, FK constraints | RENAME |
| `tests/*.ps1` | various | `$tenantId`, `x-tenant-id` headers | RENAME |
| `docs/*.md` (WEEK_5_6, TESTING_STATUS, STRIPE_*) | various | tenantId references | RENAME |

### `apps/` — tsconfig.tsbuildinfo files (multiple apps)

| File | Content | Tag |
|------|---------|-----|
| `apps/*/tsconfig.tsbuildinfo` | Azure SDK paths (`authorizerequestontenantchallenge.d.ts`, `multitenanttokencredentialoptions.d.ts`), Firebase paths (`tenant.d.ts`, `tenant-manager.d.ts`), internal paths (`tenant-bulkhead.ts`, `tenant-to-org-mapper.ts`) | **BUILD_CACHE** |

---

## 4. `packages/security/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `src/isolation.ts` | L2-53 | `TenantContext` interface, `assertTenantOwnership()`, `withTenantScope()`, `assertAllSameTenant()`, `TenantIsolationError` class, `TENANT_ISOLATION_VIOLATION` code | RENAME |
| `src/rate-limit.ts` | L2,27,29-30,78-90 | `rateLimitKey(tenantId, route)`, `check(tenantId)`, `reset(tenantId)`, "Per-tenant rate limiter" | RENAME |
| `src/validation.ts` | L52 | `TenantIdSchema = z.string().min(1).max(128)` | RENAME |
| `src/index.ts` | L28-42 | Re-exports: `assertTenantOwnership`, `withTenantScope`, `assertAllSameTenant`, `TenantIsolationError`, `TenantContext`, `TenantIdSchema` | RENAME |
| `src/security.test.ts` | L5,16,34,116-133 | Tests for tenant isolation + rate limiter with "tenant1" | RENAME |

---

## 5. `packages/os-core/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `src/resilience/tenant-bulkhead.ts` | L2-183 | **Full module**: `TenantBulkheadPool` class, `TenantBulkheadPoolOptions`, `TenantEntry`, `TenantBulkheadOverloadError`, `maxConcurrentPerTenant`, `maxQueuePerTenant`, `getTenantStats()`, `getOrCreateTenant()` | RENAME |
| `src/resilience/index.ts` | L17 | Re-exports `TenantBulkheadPool`, `TenantBulkheadOverloadError`, `TenantBulkheadPoolOptions` | RENAME |
| `src/resilience/__tests__/tenant-bulkhead.test.ts` | L2-109 | Full test suite: `'tenant-a'`, `'tenant-b'`, `tenantCount`, `onThrottle` | RENAME |

---

## 6. `packages/governance/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `src/schemas.ts` | L7,16,26 | `tenantId: z.string()`, `actor.tenantId` | RENAME |
| `src/policy.ts` | L4 | dot-path `"actor.tenantId"` | RENAME |
| `src/middleware.ts` | L14 | `tenantId: req.actor.tenantId` | RENAME |
| `src/decisions.ts` | L11,40,42 | `getByTenant(tenantId)`, filter by `actor.tenantId` | RENAME |
| `src/governance.test.ts` | L22-135 | `"allow-read-own-tenant"`, `actor.tenantId` in ~12 test contexts | RENAME |

---

## 7. `packages/audit/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `src/schema.ts` | L9,26,41 | `tenantId: z.string().min(1)` in 3 schemas | RENAME |
| `src/store.ts` | L7,10,13,25,27,39,42,57-58 | `getLastEntry(tenantId)`, `getEntries(tenantId)`, `getEntryCount(tenantId)` | RENAME |
| `src/engine.ts` | L29,39,52,68,71,78-79 | `validated.tenantId`, `getEntries(tenantId)`, `getEntryCount(tenantId)` | RENAME |
| `src/verify.ts` | L36,80,82,84 | `verifyTenantChain(tenantId)`, `entry.tenantId` | RENAME |
| `src/snapshot.ts` | L9,10,20,22,26-27,34,36,39,47 | `getSnapshot(tenantId)`, `getSnapshots(tenantId)`, snapshot creation | RENAME |
| `src/export.ts` | L7,14,26,40,54,70 | `tenantId` in export options, CSV header, data rows | RENAME |
| `src/index.ts` | L29 | Re-exports `verifyTenantChain` | RENAME |
| `src/engine.test.ts` | L14,26,42,49,64-79 | `tenantId: "t1"`, `tenantId: "t"` in test data | RENAME |
| `src/export.test.ts` | L11-31 | `tenantId: "t1"` in test data, CSV header check | RENAME |

---

## 8. `packages/ai-control/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `src/schemas.ts` | L7,40,54,68,98 | `tenantId: z.string()` in 5 schemas | RENAME |
| `src/budget.ts` | L6-97 | `getConfig(tenantId)`, `getSpend(tenantId)`, `recordSpend(tenantId)`, `checkBudget(store, tenantId)`, `InMemoryBudgetStore` | RENAME |
| `src/runner.ts` | L56,62,77,80,110 | `validated.tenantId`, budget check/record per tenant | RENAME |
| `src/logging.ts` | L8,18-19,39 | `getEntries(tenantId)`, `e.tenantId === tenantId` | RENAME |
| `src/policy.test.ts` | L10,31,43 | `tenantId: "t1"` | RENAME |
| `src/budget.test.ts` | L8,21,35,48,60,67 | `tenantId: "t1"`, `"unknown-tenant"` | RENAME |

---

## 9. `packages/finops/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `package.json` | L12 | `"./tenant-provisioning": "./src/tenant-provisioning.ts"` export | RENAME |
| `src/tenant-provisioning.ts` | L2-214 | **Full module**: `TenantTierSchema`, `TenantProvisionRequestSchema`, `TenantConfigSchema`, `provisionTenant()`, `deprovisionTenant()`, `TIER_DEFAULTS`, `tenant_free`/`tenant_starter`/etc schemas | RENAME |
| `src/index.ts` | L5 | "Tenant resource quotas" comment | RENAME |
| `src/quotas.ts` | L2 | "Tenant Resource Quotas" header | RENAME |
| `src/__tests__/tenant-provisioning.test.ts` | L2-114 | Full test suite: `provisionTenant()`, `deprovisionTenant()` | RENAME |
| `tsconfig.tsbuildinfo` | L1 | References `tenant-provisioning.ts` | BUILD_CACHE |

---

## 10. `packages/analytics/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `dashboards/MIGRATION_TRACKER.json` | L73,77 | "Phase 1: Multi-Tenant + Auth", "Tenant isolation" | RENAME |
| `dashboards/IP_PORTFOLIO_ANALYTICS.json` | L298,407 | "Multi-Tenant Data Isolation Architecture" | RENAME |
| `dashboards/GOVERNMENT_FUNDING_ANALYTICS.json` | L261 | "Multi-tenant architecture optimization" | RENAME |

---

## 11. `packages/automation/`

### Generators (code)

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `generators/infra/azure_resource_manager.py` | L162,165 | `subscription().tenantId` in Bicep templates | **EXTERNAL_API** |
| `generators/infra/azure_resource_manager.py` | L271 | `tenant-id: ${{ secrets.AZURE_TENANT_ID }}` | **EXTERNAL_API** |
| `generators/infra/azure_resource_manager.py` | L410 | `AZURE_TENANT_ID` env var documentation | **EXTERNAL_API** |
| `generators/migration/scaffold_populator.py` | L1201 | `subscription().tenantId` in Bicep template | **EXTERNAL_API** |
| `generators/fixers/standardize_org_terminology.py` | L3-127 | **The rename tool itself** — maps tenant→organization | **REPORT_SELF_REF** |
| `generators/fixers/fix_cross_app_refs.py` | L27 | Pattern matching `TenantModel` class | RENAME |

### Data files

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `data/nzila-platform-manifest.json` | L8,36-39,132,152,182-189,200,261 | `tenant_key`, `tenant_management`, entity names, `django-tenants`, `multi_tenant_strategy` | DATA_ARTIFACT |
| `data/memora-platform.manifest.json` | L8,74 | `tenant_key`, `multi_tenant` | DATA_ARTIFACT |
| `data/organizations_model.py` | L166,202 | `legacy_tenant_id`, `idx_organizations_legacy_tenant` | RENAME |
| `data/legacy_portfolio_analysis.json` | ~100 lines | Legacy type names (`TenantContext`, `TenantSettings`, etc.) in portfolio scan | DATA_ARTIFACT |
| `data/SCHEMA_EXTRACTION_REPORT.md` | L2462,2529-2530 | "Multi-tenant", `TenantModel` class | DATA_ARTIFACT |
| `data/MIGRATION_DASHBOARD.md` | L414 | "multi-tenant context injection" | DATA_ARTIFACT |
| `data/TABLE_MAPPING_REPORT.md` | L57 | `legacy_tenant_id` | DATA_ARTIFACT |
| `data/AUTH_MIGRATION_PLAN.md` | L122 | "Multi-tenant data isolation" | DATA_ARTIFACT |
| `data/AUTH_IMPLEMENTATION_SUMMARY.md` | L25,55,231,315 | OrganizationIsolation, "cross-tenant leaks" | DATA_ARTIFACT |
| `data/ue-audit-report.json` | L47 | "multi-tenant isolation" | DATA_ARTIFACT |
| `data/abr-audit-report.json` | L47 | "multi-tenant isolation" | DATA_ARTIFACT |
| `data/abr_service_view_generation_report.json` | L476-478 | `tenant-offboarding`, `TenantOffboardingViewSet` | DATA_ARTIFACT |
| `data/manifests/*.json` (14 files) | L8,37+ each | `"tenant_key": "org_id"`, `"multi_tenant": true` | DATA_ARTIFACT |

---

## 12. `packages/scripts-book/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `**/deploy-production.yml` | L24 | `tenant-id: ${{ secrets.AZURE_TENANT_ID }}` | **EXTERNAL_API** |
| `**/deploy-staging.yml` | L24 | `tenant-id: ${{ secrets.AZURE_TENANT_ID }}` | **EXTERNAL_API** |
| `**/deployment.md` | L23 | `AZURE_TENANT_ID` env var | **EXTERNAL_API** |

---

## 13. `packages/ai-registry/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `src/risk-classification.ts` | L109 | "users/tenants affected" | RENAME |

---

## 14. `governance/`

### Reports

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `reports/ALIGNMENT_REPORT.md` | L6,271,307,339-386 | Discussing tenant refs as terminology debt | **REPORT_SELF_REF** |
| `reports/alignment-report.json` | L5,301,336,349,372,401,427-432 | JSON version of alignment report | **REPORT_SELF_REF** |

### Security

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `security/HSM_KEY_ROTATION.md` | L56 | `tenantId: subscription().tenantId` | **EXTERNAL_API** |
| `security/THREAT_MODEL.md` | L75 | "Cross-tenant data leak" | RENAME |

### Platform

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `platform-package-owners.yaml` | L132 | "Tenant isolation enforcement" | RENAME |

### Docs

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `docs/BACKBONE_BUILD_PLAN.md` | L12-975 | ~50 refs: django-tenants code samples (`TenantMixin`, `class Tenant`, `set_tenant()`), `tenant_id` fields, `X-Tenant-ID` header | MIX: django-tenants imports = **EXTERNAL_API**, concept refs = RENAME |
| `docs/BACKBONE_ARCHITECTURE.md` | L42,189,199,253 | `tenants/` app refs | RENAME |
| `docs/backbone_analysis_output.txt` | L72-255 | multi-tenant refs | RENAME |
| `docs/technical-specs/STANDARDIZATION_ARCHITECTURE.md` | L16-500 | `tenant_key_mapping`, multi-tenant (~20 refs) | RENAME |
| `docs/PORTFOLIO_DEEP_DIVE*.md` | various | multi-tenant architecture | RENAME |
| `docs/MULTI_VERTICAL_STRATEGY.md` | L66,75,84,104,329 | `tenants/`, `map_tenant()` | RENAME |

### AI

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `ai/README.md` | L208 | multi-tenant RLS | RENAME |
| `ai/COMPANION_ENGINE_ARCHITECTURE.md` | L101 | multi-tenant RLS | RENAME |

### Business

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `business/verticals/virtual-cfo/strategy/technical-architecture.md` | L62 | multi-tenant RLS | RENAME |
| `business/verticals/virtual-cfo/strategy/technical-architecture.md` | L71 | `xero_tenant_id` | **EXTERNAL_API** |
| `business/verticals/uniontech/strategy/*.md` | various | multi-tenant, django-tenants | MIX |
| `business/verticals/insurancetech/strategy/technical-architecture.md` | L31,55-57 | Tenant model, multi-tenant | RENAME |
| `business/verticals/trade-commerce/strategy/product-roadmap.md` | L109 | multi-tenant | RENAME |
| `business/PRICING_AND_PACKAGING.md` | L150 | cross-tenant analytics | RENAME |
| `business/investor-materials/*.md` | various | multi-tenant | RENAME |

### Corporate

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `corporate/legal/network-data-jurisdiction-map.md` | L40 | "M365 Canada tenant" | **EXTERNAL_API** (Microsoft 365) |
| `corporate/intellectual-property/IP_PORTFOLIO_PROTECTION_STRATEGY.md` | L13 | multi-tenant | RENAME |

---

## 15. `docs/`

### Platform docs (REPORT_SELF_REF — enforcing "no tenant" rule)

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `docs/platform/APP_ADOPTION_GUIDE.md` | L4,140,200 | "Do NOT introduce tenant" | **REPORT_SELF_REF** |
| `docs/platform/acceptance-matrix.md` | L18 | "no tenantId terminology" | **REPORT_SELF_REF** |
| `docs/platform/dominance-train.md` | L25 | "no tenant" | **REPORT_SELF_REF** |
| `docs/stress-test/*.md` (3 files) | various | "no tenant" terminology notes | **REPORT_SELF_REF** |
| `docs/ga/GA_READINESS_GATE.md` | L8 | "no tenant" | **REPORT_SELF_REF** |
| `docs/governance/enterprise-readiness.md` | L30 | "never tenant" | **REPORT_SELF_REF** |
| `docs/governance/platform-readiness.md` | L281 | 'zero "tenant" references' | **REPORT_SELF_REF** |
| `docs/commerce/spec/GLOSSARY.md` | L14 | 'Never use "tenant"' | **REPORT_SELF_REF** |

### Platform docs (RENAME)

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `docs/platform/proof/*.md` (6 files) | various | tenantId in proof docs | RENAME |
| `docs/platform/semantic-convergence-entity-to-org.md` | L78 | org/tenant mapping table | RENAME |
| `docs/tutorials/README.md` | L14 | "Multi-Tenant Data Access" link | RENAME |
| `docs/README.md` | L55,80,149 | doc refs | RENAME |
| `docs/SAAS_ENABLEMENT_ARCHITECTURE.md` | L9 | multi-tenant | RENAME |
| `docs/GOLDEN_PATH_DEVELOPER_GUIDE.md` | L62 | `tenantId: decoded.orgId` | RENAME |
| `docs/how-to/README.md` | L11 | "Add a New Tenant" link | RENAME |
| `docs/how-to/create-model-card.md` | L16 | users/tenants | RENAME |
| `docs/migration/legacy-trade-domain-models.md` | L1341 | Tenant/Organization | RENAME |
| `docs/architecture/AI_PLATFORM_CONTRACT.md` | L26 | multi-tenant isolation | RENAME |
| `docs/APP_DOMAIN_CORE_STANDARD.md` | L160 | multi-tenant isolation | RENAME |
| `docs/pilot/*.md` (4 files) | various | multi-tenant refs | RENAME |
| `docs/decision-layer/*.md` | various | multi-tenant refs | RENAME |
| `docs/agri/01-market-map.md` | L33 | multi-tenant | RENAME |
| `docs/backlog/abr-backend.md` | L58 | `tenant_offboarding_views.py` | RENAME |
| `docs/commerce/spec/ORG_SCOPE_PLAN.md` | L34-479 | tenant isolation, schema-per-tenant, tenant_key | RENAME |
| `docs/governance/PLATFORM_VS_APP_DECISION_RULE.md` | L61 | multi-tenant code | RENAME |
| `docs/explanation/README.md` | L8 | Multi-tenant isolation | RENAME |
| `docs/explanation/ai-risk-management.md` | L52 | attributed to tenant | RENAME |

---

## 16. `tests/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `tests/e2e/platform/ue-governed-mutation.test.ts` | L71-231 | `tenantId`, `x-tenant-id: 'tenant_ue_main'`, ~20 refs | RENAME |
| `tests/e2e/platform/ai-controlled-request.test.ts` | L63-153 | `tenantId: 'tenant_ai_demo'`, `checkBudget()` | RENAME |
| `tests/e2e/platform/compliance-sensitive-action.test.ts` | L82-245 | `tenantId: 'tenant_abr'` | RENAME |
| `tests/e2e/platform/event-contract-flow.test.ts` | L93-172 | `tenantId: 'tenant_commerce'` | RENAME |

---

## 17. `ops/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `ops/runbooks/platform/README.md` | L15 | Tenant Offboarding link | RENAME |
| `ops/runbooks/platform/integration-failure.md` | L88 | "Notify affected tenants" | RENAME |
| `ops/runbooks/platform/orchestrator-failure.md` | L4 | tenant-onboarding workflow | RENAME |
| `ops/runbooks/platform/platform-governed-ai-failure.md` | L33 | tenant policy | RENAME |
| `ops/runbooks/platform/slo-breach.md` | L55 | tenant-specific | RENAME |
| `ops/compliance/Required-Evidence-Map.md` | L49 | multi-tenant | RENAME |
| `ops/runbooks/numbered/rb-001-db-pool-exhaustion.md` | L20,40 | tenants affected | RENAME |
| `ops/runbooks/numbered/rb-002-dlq-backlog-spike.md` | L16,21,61-62 | tenant integration | RENAME |
| `ops/runbooks/numbered/rb-003-integration-provider-outage.md` | L17,22,41 | tenant reports | RENAME |
| `ops/runbooks/numbered/rb-005-error-rate-spike.md` | L60-63 | tenant-specific | RENAME |
| `ops/runbooks/numbered/rb-006-tenant-isolation-breach.md` | L1,15,20,28,51,71 | **Full runbook**: Tenant Isolation Breach | RENAME |
| `ops/runbooks/numbered/rb-008-certificate-secret-expiry.md` | L23 | tenant disruption | RENAME |
| `ops/runbooks/numbered/README.md` | L14 | RB-006 Tenant Isolation Breach | RENAME |
| `ops/runbooks/ue-pilot.md` | L124 | cross-tenant route check | RENAME |

---

## 18. `tooling/`

### Backstage templates

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `tooling/backstage/templates/nextjs-app-template/template.yaml` | L41-42,77 | `tenantScoped` parameter | RENAME |
| `tooling/backstage/templates/nextjs-app-template/skeleton/catalog-info.yaml` | L11 | `nzila.app/tenant-scoped` | RENAME |

### Golden path

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `tooling/golden-path/scaffold-governed-app.ts` | L170,176 | `tenantId: 'placeholder-org'`, `_tenantId` | RENAME |

### Chaos

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `tooling/chaos/src/experiments.ts` | L88-98 | `'cross-tenant-isolation'` experiment | RENAME |

### Contract tests

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `tooling/contract-tests/abr-governance-bridge.test.ts` | L250 | `tenant_offboarding_views.py` path | RENAME |
| `tooling/contract-tests/cross-org-auth.test.ts` | L2,4,35,60 | cross-tenant route detection | RENAME |
| `tooling/contract-tests/governance-proof-harness.test.ts` | L71-419 | tenantId in test contexts | RENAME |
| `tooling/contract-tests/polyglot-authority.test.ts` | L16,318-400 | ES tenant isolation, index-per-tenant | RENAME |
| `tooling/contract-tests/tamper-simulation.test.ts` | L330 | cross-tenant steal | RENAME |
| `tooling/contract-tests/ue-persona-access.test.ts` | L419 | cross-tenant route check | RENAME |
| `tooling/contract-tests/platform-compliance-invariants.test.ts` | L103-119 | Tests enforcing "org" not "tenant" | **REPORT_SELF_REF** |
| `tooling/contract-tests/platform-control-plane-invariants.test.ts` | L103-119 | Tests enforcing "org" not "tenant" | **REPORT_SELF_REF** |
| `tooling/contract-tests/platform-events-invariants.test.ts` | L6,103-120 | Tests enforcing "org" not "tenant" | **REPORT_SELF_REF** |
| `tooling/contract-tests/platform-evidence-invariants.test.ts` | L103-119 | Tests enforcing "org" not "tenant" | **REPORT_SELF_REF** |
| `tooling/contract-tests/platform-observability-invariants.test.ts` | L103-119 | Tests enforcing "org" not "tenant" | **REPORT_SELF_REF** |

---

## 19. `scripts/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `scripts/proof/proof-artifacts.ts` | L22,59 | `tenant_id` in ProofArtifact type | RENAME |
| `scripts/seed-staging-autoseed.sql` | L94 | column detection for `tenant_id` | RENAME |
| `scripts/seed-staging-cohesion.sql` | L4,344 | tenant org comments | RENAME |
| `scripts/seed-staging-full.sql` | L368 | INSERT with `tenant_id` | RENAME |
| `scripts/staging-col-counts.txt` | L674 | `tenant_org_mappings` table count | DATA_ARTIFACT |
| `scripts/staging-columns.txt` | L871-11679 | `tenant_id` columns in multiple tables, `tenant_org_mappings` table (11 cols) | DATA_ARTIFACT |

---

## 20. `templates/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `templates/app-adoption/docs/platform/NZILAOS_ADOPTION.md` | L13 | `grep -ri tenant src/` check instruction | **REPORT_SELF_REF** |

---

## 21. `tech-repo-scaffold/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `vertical-apps/template/infra/main.bicep` | L86 | `tenantId: subscription().tenantId` | **EXTERNAL_API** |
| `infra-as-code/bicep/modules/key-vault.bicep` | L13 | `tenantId: subscription().tenantId` | **EXTERNAL_API** |
| `vertical-apps/union-eyes-scaffold.md` | L103 | Multi-tenant hierarchy | RENAME |
| `django-backbone/pyproject.toml` | L4 | "Multi-tenant SaaS" | RENAME |
| `django-backbone/README.md` | L3 | "Multi-tenant SaaS" | RENAME |
| `django-backbone/apps/auth_core/DJANGO_SETTINGS_GUIDE.md` | L62 | multi-tenant isolation | RENAME |

---

## 22. `plans/`

| File | Lines | Content | Tag |
|------|-------|---------|-----|
| `plans/REPO_ASSESSMENT.md` | L103,124,195,256 | Tenant entity, tenant isolation, multi-tenant | RENAME |
| `plans/IMPLEMENTATION_PLAN_FINAL.md` | L172,192 | '"org" usage never "tenant"' | **REPORT_SELF_REF** |

---

## EXTERNAL_API Summary — DO NOT RENAME

These lines reference Azure/Xero/M365/django-tenants APIs where "tenant" is the correct term:

| File | Line | API |
|------|------|-----|
| `apps/abr/infra/main.bicep` | L86 | `subscription().tenantId` (Azure Bicep) |
| `tech-repo-scaffold/vertical-apps/template/infra/main.bicep` | L86 | `subscription().tenantId` (Azure Bicep) |
| `tech-repo-scaffold/infra-as-code/bicep/modules/key-vault.bicep` | L13 | `subscription().tenantId` (Azure Bicep) |
| `packages/automation/generators/infra/azure_resource_manager.py` | L162,165 | `subscription().tenantId` (Bicep template string) |
| `packages/automation/generators/infra/azure_resource_manager.py` | L271 | `secrets.AZURE_TENANT_ID` (GitHub Actions) |
| `packages/automation/generators/infra/azure_resource_manager.py` | L410 | `AZURE_TENANT_ID` (env var docs) |
| `packages/automation/generators/migration/scaffold_populator.py` | L1201 | `subscription().tenantId` (Bicep template string) |
| `packages/scripts-book/**/deploy-production.yml` | L24 | `secrets.AZURE_TENANT_ID` (GitHub Actions) |
| `packages/scripts-book/**/deploy-staging.yml` | L24 | `secrets.AZURE_TENANT_ID` (GitHub Actions) |
| `packages/scripts-book/**/deployment.md` | L23 | `AZURE_TENANT_ID` env var |
| `governance/security/HSM_KEY_ROTATION.md` | L56 | `subscription().tenantId` (Azure Bicep) |
| `governance/business/verticals/virtual-cfo/strategy/technical-architecture.md` | L71 | `xero_tenant_id` (Xero API) |
| `governance/corporate/legal/network-data-jurisdiction-map.md` | L40 | "M365 Canada tenant" (Microsoft 365) |
| `governance/docs/BACKBONE_BUILD_PLAN.md` | various | `from django_tenants.models import TenantMixin` (django-tenants library) |

---

## High-Priority RENAME Targets (source code with exports/interfaces)

These files define types/functions consumed across the monorepo — rename here first:

1. **`packages/security/src/isolation.ts`** — `TenantContext`, `assertTenantOwnership`, `withTenantScope`, `assertAllSameTenant`, `TenantIsolationError`
2. **`packages/security/src/validation.ts`** — `TenantIdSchema`
3. **`packages/security/src/rate-limit.ts`** — `rateLimitKey(tenantId)`, `check(tenantId)`, `reset(tenantId)`
4. **`packages/os-core/src/resilience/tenant-bulkhead.ts`** — `TenantBulkheadPool`, `TenantBulkheadOverloadError`, `TenantBulkheadPoolOptions`
5. **`packages/governance/src/schemas.ts`** — `tenantId` in policy schemas
6. **`packages/governance/src/decisions.ts`** — `getByTenant()`
7. **`packages/audit/src/schema.ts`** — `tenantId` in audit entry schemas
8. **`packages/ai-control/src/schemas.ts`** — `tenantId` in AI control schemas
9. **`packages/ai-control/src/budget.ts`** — `BudgetStore` interface with `tenantId` params
10. **`packages/finops/src/tenant-provisioning.ts`** — `TenantTier`, `TenantConfig`, `provisionTenant()`, `deprovisionTenant()` + **file rename** needed
