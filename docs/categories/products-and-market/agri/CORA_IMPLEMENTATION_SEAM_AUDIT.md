# Cora Implementation-Seam Audit — Phase 0B

**Captured:** 2026-10-07  
**Baseline:** working tree after Phase 0A; repository HEAD
`1c337567635bb86ea0df7831557d8d2d22df1e6f`  
**Disposition:** `CORA_PHASE_0B_DISPOSITION = PASS_WITH_LIMITATIONS`  
**Scope:** Read-only implementation audit and design output. No runtime,
schema, authorization, or product-capability changes.

## Finding

The accepted Cora/Agrimo peer-product architecture is compatible with the
repository if Cora writes only to Cora-owned records through a separately
authorized Cora service/repository boundary. It must not receive write access
to Agrimo-owned operational rows.

The current Cora app is even less data-connected than the old companion
description suggests: its inspected pages are placeholder UI, its APIs are
platform/auth/health routes, and no app-source call to an agricultural
repository or intelligence query was found. Agri data-access packages are
declared as dependencies but do not establish an active Cora data path.
Read-only restrictions remain valuable defense in depth until a new,
ownership-aware contract replaces them in a separately authorized phase.

## 1. Current Runtime Shape

- `apps/cora/lib/resolve-org.ts` calls platform `auth()`, rejects a missing
  user or active organization, maps the org/session role to `AgriOrgRole`,
  and returns a shared `AgriOrgContext`. It grants a fixed set of
  `agri:*` read permissions and does not resolve Cora-specific capabilities.
- Cora's proxy enforces authenticated private routes, rate limiting, request
  IDs, and localization. Those are platform/runtime controls, not
  read-only enforcement.
- The Cora dashboard pages contain placeholder UI. The app has no observed
  server action, Cora-owned repository/schema, or business API route.
- Cora declares dependencies on `@nzila/agri-db`, `@nzila/agri-intelligence`,
  `@nzila/evidence`, and other agri packages, but the inspected app source
  does not import or call their data APIs.
- `@nzila/agri-db/readonly` is a read-only export surface over shared agri
  repositories. The main `@nzila/agri-db` barrel exports their read and
  write APIs. Repository functions use explicit `orgId` query predicates;
  they do not perform permission checks.
- `packages/db/src/schema/agri.ts` defines organization-scoped agricultural
  tables, but does not encode a product owner for those rows. No agri-table
  PostgreSQL RLS enablement or policy was found in the inspected repository
  schema/migrations. This is not evidence of deployed database state; that
  state must be verified before any future write path.
- `scripts/migrations/agri/import-cora-legacy.ts` documents intended
  imports into forecast, price-signal, and risk-score tables, but the
  inspected migration runners contain TODO placeholders rather than a live
  source fetch/persist path. It does not prove current Cora ownership or
  current runtime access.
- No Cora-specific feature-flag definition was found in the app files
  inspected. Cora's `instrumentation.ts` does use the canonical OS boot and
  telemetry hook.

## 2. Implementation Assumptions and Coupling Classification

| Evidence                                                                                                                                                                   | Classification                                 | Audit disposition                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/cora/lib/resolve-org.ts` requires authenticated user and active org                                                                                                  | `PERMANENT_INVARIANT`                          | Keep fail-closed identity and tenant resolution.                                                                                                                  |
| Cora resolver returns `AgriOrgContext` and maps Agri roles/session metadata                                                                                                | `OBSOLETE_PRODUCT_COUPLING`                    | Replace with canonical org context plus Cora-specific authority at a future implementation boundary; do not reinterpret existing Agri roles as Cora write grants. |
| Cora resolver grants only fixed `agri:read`, dashboard, intelligence, and evidence permissions                                                                             | `TEMPORARY_SAFETY_CONTROL`                     | Preserve now. A future Cora write requires explicit, server-derived Cora capabilities and service-layer checks.                                                   |
| `apps/cora/proxy.ts` comment equates Cora's read-only product with Agrimo's auth enforcement                                                                               | `OBSOLETE_PRODUCT_COUPLING`                    | Product equivalence is obsolete; auth, rate limits, and request-ID controls remain.                                                                               |
| Cora has no actions directory and all app writes are prohibited by `cora-readonly.test.ts`                                                                                 | `TEMPORARY_SAFETY_CONTROL`                     | Do not weaken now. Replace the blanket product-wide ban only alongside scoped ownership-aware controls and tests.                                                 |
| Existing agri repositories operate on shared agri tables and constrain queries by `orgId`                                                                                  | `SHARED_CORE`                                  | Reuse for authorized shared/agri reads; do not treat tenant scope as product ownership or mutation authority.                                                     |
| Cora must not mutate Agrimo operational records                                                                                                                            | `PERMANENT_INVARIANT`                          | Keep. No unrestricted or direct Cora mutation path into Agrimo tables.                                                                                            |
| Cora has no owned persistence/service boundary                                                                                                                             | `CORA_OWNED_FUTURE_SEAM` / `REFACTOR_REQUIRED` | New Cora-owned schema/repository and service authorization are needed before Cora mutations.                                                                      |
| Cora/Agrimo share `@nzila/agri-core` concepts                                                                                                                              | `SHARED_CORE`                                  | Keep semantically common types; keep product behavior in product-owned services.                                                                                  |
| Shared agri tables do not carry a product-owner discriminator                                                                                                              | `REFACTOR_REQUIRED`                            | Keep existing operational ownership in application contracts; use separate Cora-owned tables or an explicitly designed ownership model for future Cora records.   |
| `agri_forecasts`, `agri_price_signals`, and `agri_risk_scores` have Cora legacy import notes and agri-db writers, but no current Cora app caller or explicit product owner | `HARD_BLOCKER` to treating these as Cora-owned | Resolve ownership and data lineage before reuse or writes. Do not infer Cora ownership from the legacy script.                                                    |
| `agri-events` uses agri event types and sets event source to `@nzila/agri`                                                                                                 | `SHARED_CORE` / `REFACTOR_REQUIRED`            | Reuse/adapt the event envelope only after defining Cora event namespaces, ownership, durable delivery, and authorization.                                         |
| `platform-entity-graph` has a generic tenant-aware interface but only an in-memory reference store                                                                         | `CORA_OWNED_FUTURE_SEAM`                       | A persistent, tenant-safe adapter and authorized relationship contract are missing; the reference store is not production persistence.                            |
| `docs/.../platform/acceptance-matrix.md` codifies all Cora mutations as forbidden                                                                                          | `OBSOLETE_PRODUCT_COUPLING`                    | Reframe this acceptance gate in a future authorized phase to protect Agrimo-owned rows while permitting separately authorized Cora-owned writes.                  |

## 3. Permanent Safety Invariants

1. Resolve the authenticated actor and active organization on the server;
   deny missing or invalid identity/scope.
2. Enforce same-org isolation on reads and writes, including related-row
   references and evidence lookups. Never accept `orgId`, role, or permission
   from an untrusted request body as authority.
3. Cora cannot create, update, delete, certify, settle, or otherwise mutate
   Agrimo-owned operational records. Cross-product exchange must use an
   explicitly authorized contract.
4. A Cora capability is not implied by an Agrimo role, shared package access,
   database reachability, or an admin label alone.
5. Cora-owned writes must pass Cora-domain validation, authorization,
   audit/evidence/provenance policy, and tenant-scoped persistence.
6. Preserve Agrimo's independent operational workflows and deployment
   boundary. No app-to-app import or shared table write is an ownership
   contract.
7. Preserve current Cora read-only behavior until the above replacement
   controls are implemented and independently tested.

## 4. Cora/Agrimo Ownership Boundaries

| Concern                                                                                                  | Owner/boundary                                                               |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Identity, org/tenant context, policy, authorization primitives, evidence and provenance rails, telemetry | NzilaOS control plane/shared platform                                        |
| Canonical producer/farm/field/season/commodity primitives where semantics are common                     | Shared agricultural core; shared types do not transfer record ownership      |
| Harvest, lot, warehouse, batch, shipment, payment, certification and execution workflows                 | Agrimo operational domain unless an explicit future contract says otherwise  |
| Food-economy intelligence and coordination workflows and their own records                               | Cora product domain; not yet implemented in the inspected app                |
| Authorized consumption of Agrimo/shared evidence                                                         | Consumer-specific grant/consent and read contract; no ownership transfer     |
| Cora output consumed by Agrimo                                                                           | Only through an explicitly designed and authorized interoperability contract |

## 5. Data Ownership Matrix

“Current Cora reader” means an app-source data call found in this audit. No
such live reader was found. Repository functions exist independently of
whether Cora invokes them.

| Tables/data family                                                                                        | Canonical owner                                                                            | Current writers                                                                                         | Current readers                                                                 | Org scope and authorization                                                                                                                                  | Evidence/provenance                                                                                                                                                 | Cora future disposition                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agri_producers`, `agri_cooperatives`, `agri_crops`                                                       | Agrimo operational records; shared concepts/types                                          | Agri DB repositories; Agrimo actions for operational workflows                                          | Agri DB read/readonly repositories; no Cora app call found                      | Non-null `org_id`; repositories explicitly filter by context `orgId`. Repository does not authorize. No agri-table RLS policy was found in inspected source. | Producer records can be referenced by agri evidence; table itself is not an evidence ledger.                                                                        | Authorized read only through a deliberate share contract. Never mutate as Cora. New Cora-owned records require distinct schema.                                                                                       |
| `agri_harvests`, `agri_lots`, `agri_lot_contributions`, `agri_inspections`                                | Agrimo operations                                                                          | Agri DB repos/Agrimo workflows                                                                          | Agri DB readonly exports; no Cora app call found                                | `org_id` predicates on repository access; no product-owner boundary in schema; no RLS evidence found                                                         | Traceability/certification builders can reference these records; action-side audit is separate from repository persistence.                                         | `MUST_NOT_USE` for Cora writes. Read only when specifically authorized and required.                                                                                                                                  |
| `agri_warehouses`, `agri_batches`, `agri_batch_allocations`, `agri_shipments`, `agri_shipment_milestones` | Agrimo execution                                                                           | Agri DB repos/Agrimo workflows                                                                          | Agri DB readonly exports; no Cora app call found                                | Org-scoped predicates; repository-level permission enforcement absent; RLS state unverified.                                                                 | Shipment/traceability evidence builders may include operational references.                                                                                         | `MUST_NOT_USE` for Cora writes. Governed reads only.                                                                                                                                                                  |
| `agri_payment_plans`, `agri_payments`, `agri_certifications`, `agri_traceability_links`                   | Agrimo operations and associated regulated/evidence records                                | Agri DB repos/Agrimo workflows                                                                          | Agri DB readonly exports; no Cora app call found                                | Org-scoped predicates; no product authorization in DB repo API; RLS state unverified.                                                                        | Sensitive financial/certification/traceability evidence. Evidence access requires its own authorization and audit decision.                                         | `MUST_NOT_USE` for Cora writes or settlement execution. Consume only approved evidence views/contracts.                                                                                                               |
| `agri_evidence_artifacts` and evidence packs                                                              | Evidence ownership follows the originating domain/action; current table is agri-namespaced | Agri traceability/evidence-related code; exact persistent writer path was not established in this audit | Agri DB readonly surface exposes evidence-related reads; no Cora app call found | Row has `org_id`; product owner, retention, and authorization are not encoded by the table shape alone.                                                      | Reuse `@nzila/evidence` seals and `@nzila/agri-traceability` builders/verifiers; they do not by themselves supply authorized storage/retention.                     | Extend through Cora-owned evidence references/storage and authorized sharing; never reassign Agrimo evidence ownership.                                                                                               |
| `agri_forecasts`, `agri_price_signals`, `agri_risk_scores`                                                | **Unresolved** in current schema/API; legacy import notes are not an ownership contract    | `agri-db` exposes `saveForecast`, `savePriceSignal`, `saveRiskScore`; no app caller found               | Corresponding list APIs; no Cora app caller found                               | Each has `org_id`; current API filters reads by org and writes set org, but neither product ownership nor RLS is established.                                | Forecast records contain model version; richer explainability/provenance is available in intelligence/provenance packages but not guaranteed by these table writes. | `HARD_BLOCKER` to reuse as Cora-owned data until ownership, writer authority, lineage, and tenancy policies are decided. Prefer a new Cora-owned schema unless a reviewed shared-data contract establishes otherwise. |
| Cora-owned opportunity, association, framework, farmer-intelligence, workflow records                     | Cora                                                                                       | None found                                                                                              | None found                                                                      | No schema/repository/authorization contract found.                                                                                                           | Must be designed with canonical evidence/provenance and policy hooks.                                                                                               | `REQUIRES_NEW_CORA_REPOSITORY`; create only in a future authorized phase.                                                                                                                                             |

The agri schema uses `org_id` on the inspected table families but does not
identify product ownership in the rows. Application repository predicates
are necessary, not proof of database-enforced tenant or product isolation.
Confirm deployed grants/RLS and additive schema behavior before any future
mutation.

## 6. Authorization Seam

### Current Cora resolution

1. `auth()` supplies `userId`, `orgId`, `orgRole`, and session claims.
2. Missing `userId` or `orgId` throws; this fail-closed behavior is correct.
3. `org:admin` maps to `admin`, `org:member` and unknown roles map to
   `viewer`; public `agriRole` metadata can map to the Agri role union.
4. A central super-admin email check can elevate the returned role to
   `admin`.
5. The resolver returns a fixed Agri read-permission list for every mapped
   role. There is no Cora-specific capability set or mutation check.

The shared authorization primitives support arbitrary permission strings:
`@nzila/org` exposes `requireOrgScope`, `requirePermission`, `requireRole`,
and same-org assertions; `@nzila/platform-auth` exposes permission and
privileged-action checks. Therefore separate product authority is expressible
without inventing a second auth system. It is not currently wired into Cora.

### Required before a Cora-owned mutation

- Resolve a canonical `OrgContext` with `appId: 'cora'` and trusted
  `orgId`/`actorId`; converge the duplicate `AgriOrgContext` and agri DB
  context shape on `@nzila/org` rather than adding another context type.
- Derive Cora permissions from server-side membership/entitlement policy.
  Existing `agri:*` roles and claims must not imply Cora write authority.
- Require product- and operation-specific permissions at the API/action and
  domain-service boundary; fail closed and test denial paths. Existing
  colon-delimited agri permission naming is precedent; final Cora keys must
  follow repository conventions and be registered/granted explicitly.
- Enforce authorization before repository access. Current agri repository
  functions only take org/actor context and do not check permissions.
- Verify database runtime roles, grants, and RLS in every target deployment.
  Add org isolation for new Cora-owned tables and ensure Cora's DB path cannot
  write Agrimo-owned rows.
- Record actor, org, app, request/correlation IDs and the domain action in
  audit/evidence; do not rely on UI visibility as authorization.

## 7. Repository / DB Seam

| Pattern                                        | Status                                                                                                                 | Future disposition                                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Generic read-only agri repository barrel       | Exists as `@nzila/agri-db/readonly`; current Cora app does not call it                                                 | `SAFE_AS_IS` for intended SELECT-only, org-scoped access after authorization and share/consent checks.                          |
| Agrimo operational repositories                | Exists under `@nzila/agri-db`; read and write functions share repository modules and the main barrel                   | `MUST_NOT_USE` for Cora-owned writes. Keep as Agrimo/shared operational access.                                                 |
| Shared agri DB abstractions                    | Tables are in `@nzila/db/schema/agri.ts`; repositories call the shared DB directly and add explicit `orgId` predicates | `EXTENDABLE` for shared primitives and approved reads. Does not establish product ownership or database permission enforcement. |
| Direct SQL or `@nzila/db` access from Cora app | Not found in inspected Cora sources; blanket test currently prohibits it                                               | `MUST_NOT_USE` from app/UI entry points. Future Cora services should use a Cora repository, not raw SQL.                        |
| Cora-owned DB tables/repository                | Not present in inspected app/schema paths                                                                              | `REQUIRES_NEW_CORA_REPOSITORY`, with an additive schema and explicit RLS/grant/retention design.                                |
| Generated client                               | No generated Cora data client or Cora service API was found                                                            | `MISSING`; do not introduce one unless a reviewed service boundary requires it.                                                 |
| RLS                                            | Agri schema/repository inspection showed `org_id` predicates but no agri table RLS policy declaration                  | `EXTENDABLE` only after deployed state is verified; it is a hard precondition for future writes, not assumed safe.              |

## 8. Evidence and Provenance Seam

- Reuse `@nzila/evidence` for cryptographic pack seals/verification and
  `@nzila/agri-traceability` for agri evidence-pack construction.
- Reuse `@nzila/agri-provenance` for hashed source and transformation
  records; `@nzila/agri-core` supplies action audit-entry helpers.
- `@nzila/agri-intelligence` provides explainability metadata including
  sources, confidence, and model version. That does not automatically
  persist model runs or attach provenance to a Cora write.
- The audited packages provide builders/verifiers and data shapes, not a
  complete Cora evidence repository, retention policy, authorization gate,
  or automatic pre-persist hook.
- Future Cora-owned records need domain-defined audit and provenance links
  at creation/update, immutable evidence where required, retention and
  disclosure policy, and tests that prove evidence access is tenant- and
  capability-scoped.

## 9. Event and Integration Seam

`@nzila/agri-events` provides typed agri event envelopes, org/actor/
correlation metadata, an in-process event bus, and integration routing.
Its event source is fixed to `@nzila/agri`; it is not by itself a durable
cross-product outbox, Cora event namespace, authorization boundary, or
sharing-consent mechanism. `@nzila/governed-workflow` and platform workflow
packages provide reusable workflow/policy patterns, but no Cora workflow is
currently wired.

Before publishing a Cora event, define ownership, event type/version,
tenant/correlation semantics, durable delivery/idempotency, policy and
consent checks, audit behavior, and which consumers may see it. Keep
Agrimo-specific events and operational effects owned by Agrimo.

## 10. Test Disposition

Do not change or weaken these tests during Phase 0B.

| Existing test                                                                                                        | Disposition                     | Future treatment                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cora-readonly.test.ts`: `apps/cora/lib/actions/ must NOT exist`                                                     | `REFRAME`                       | Permit a Cora action/service boundary only when every entry point authenticates, resolves org, checks Cora capability, and uses Cora-owned repositories.                                                     |
| `cora-readonly.test.ts`: `apps/cora/app/**/actions/ directories must NOT exist`                                      | `REFRAME`                       | Same as above; directory presence is not itself a security invariant.                                                                                                                                        |
| `cora-readonly.test.ts`: `Cora source files must not import from write-capable repositories/services`                | `REFRAME`                       | Continue blocking Agrimo-owned and direct operational DB writers; allow only an explicitly named Cora-owned service/repository boundary.                                                                     |
| `cora-readonly.test.ts`: `documents the allowlist of permitted import paths`                                         | `KEEP`, then extend             | Keep an explicit reviewed boundary allowlist; distinguish Cora-owned repository imports from read-only shared/Agrimo imports.                                                                                |
| `cora-readonly.test.ts`: `no INSERT/UPDATE/DELETE SQL strings in Cora source`                                        | `REFRAME`                       | Keep prohibiting direct SQL in app routes/components; test persistence through owned repository/service contracts instead of banning all authorized domain writes.                                           |
| `cora-readonly.test.ts`: `no "use server" directives in Cora`                                                        | `REFRAME`                       | Server actions may be valid future entry points; require server-side authorization and domain service calls.                                                                                                 |
| `apps/cora/lib/__tests__/resolve-org.test.ts`: `returns read-only permissions for Cora`                              | `REPLACE`                       | Replace with tests for exact server-derived Cora read/write grants and denial for ungranted roles; do not add write permissions until separately authorized.                                                 |
| Resolver tests for missing user, missing org, role mapping, invalid metadata, super-admin lookup, and locale exports | `KEEP` with role-context review | Preserve auth/scope fail-closed behavior; role mapping must not become a write grant.                                                                                                                        |
| `apps/cora/proxy.test.ts` auth redirect, rate limit, request ID, locale path tests                                   | `KEEP`                          | These are runtime safety behaviors independent of product ownership.                                                                                                                                         |
| Agri repository read/write org filters and cross-org reference handling                                              | `ADD_NEW` / strengthen          | Add repository-level tests for org A/B reads and writes, related-row scope, and identity/correlation attribution. No equivalent focused agri repository isolation suite was found in `packages/agri-db/src`. |
| Cora-owned action/service/repository policy                                                                          | `ADD_NEW`                       | Test unauthenticated, missing-org, wrong-org, missing capability, cross-owner mutation denial, successful permitted Cora write, audit/evidence/provenance, and rollback/idempotency behavior.                |
| Database tenant/product isolation                                                                                    | `ADD_NEW`                       | Integration-test actual role grants and RLS/policies against Cora and Agrimo ownership; repository unit predicates alone are insufficient.                                                                   |
| Graph traversal tenant isolation                                                                                     | `ADD_NEW` if graph is used      | Ensure edges are tenant-scoped in the persistent adapter; do not use the current in-memory store as a production security boundary.                                                                          |

`docs/categories/platform-and-operations/platform/acceptance-matrix.md`
currently repeats the blanket contract. Update it with the test contract only
when a future authorized phase changes that contract.

## 11. Canonical Reuse Matrix

| Concern                | Existing canonical component                                                    | State                                                                          | Future action                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity               | `@nzila/platform-auth/entra/server`                                             | `REUSE`                                                                        | Keep server-derived actor and organization; retain auth failure behavior.                                                                                                    |
| Org/tenancy            | `@nzila/org` `OrgContext`, `DbContext`, guards                                  | `REUSE` / `EXTEND`                                                             | Converge Agri-specific contexts; bind app identity and enforce org checks.                                                                                                   |
| Authorization          | `@nzila/platform-auth` permission/privileged-action checks; `@nzila/org` guards | `EXTEND`                                                                       | Define and explicitly grant Cora capabilities; never derive them from Agri roles alone.                                                                                      |
| Audit                  | `@nzila/agri-core` action audit helpers; policy audit facilities                | `REUSE` / `ADAPTER`                                                            | Attach Cora domain/entity types, actor, org, app, and correlation metadata.                                                                                                  |
| Evidence               | `@nzila/evidence`                                                               | `REUSE`                                                                        | Use for cryptographic seal/verification; add authorized Cora evidence persistence/retention.                                                                                 |
| Provenance             | `@nzila/agri-provenance`                                                        | `REUSE` / `EXTEND`                                                             | Record source, transformation/version, output hash, and verify before publishing/persisting.                                                                                 |
| Consent                | `@nzila/consent-engine`                                                         | `ADAPTER`                                                                      | Reconcile its organization/tenant/site-shaped model with canonical `orgId` and food-economy participation/sharing semantics.                                                 |
| Policy                 | `@nzila/platform-policy-engine`                                                 | `REUSE` / `EXTEND`                                                             | Evaluate policy/approval requirements before sensitive Cora actions.                                                                                                         |
| Workflow               | `@nzila/governed-workflow` and platform workflow packages                       | `ADAPTER`                                                                      | Reuse governed orchestration; provide Cora-owned workflow definitions and context.                                                                                           |
| Agri primitives        | `@nzila/agri-core`                                                              | `REUSE`                                                                        | Reuse genuinely common producer/farm/season/commodity/evidence references; do not move product behavior into shared core.                                                    |
| Agri repository access | `@nzila/agri-db/readonly`, `@nzila/agri-db`                                     | `REUSE` for approved reads; `MUST_NOT_USE` for Cora writes to operational data | Keep shared/Agrimo reads read-only; new Cora-owned writes need a distinct repository.                                                                                        |
| Graph/relation support | `@nzila/platform-entity-graph` plus ontology                                    | `ADAPTER`                                                                      | Reuse types/traversal only with a persistent, authorized tenant-safe adapter. Current in-memory `getEdges` does not filter by tenant and is explicitly a dev/test reference. |
| Commerce               | `@nzila/commerce-core`                                                          | `REUSE` for shared types; `NOT_APPLICABLE` for mutation in this phase          | Keep settlement/payment execution in its authorized owner; no Cora settlement authority is implied.                                                                          |
| Methodology/versioning | `@nzila/agri-intelligence` explainability and model-version fields              | `EXTEND`                                                                       | Add governed methodology registry/version lifecycle and run/output provenance if needed; do not duplicate intelligence primitives.                                           |
| Eventing               | `@nzila/agri-events`                                                            | `ADAPTER`                                                                      | Define Cora event ownership/namespaces and durable authorized publication; do not relabel Agrimo events.                                                                     |
| Observability          | `@nzila/os-core/telemetry`, Cora boot hook                                      | `REUSE`                                                                        | Preserve tracing, request/correlation IDs, SLO/RED metrics, and boot checks.                                                                                                 |

No canonical Cora domain repository, opportunity/farmer graph persistence,
or shared cross-product record-ownership contract was found.

## 12. Required Refactors Before Future Cora Writes

1. Design Cora-owned record ownership, additive tables, indexes, retention,
   migrations, and database roles. Resolve ambiguous shared intelligence
   table ownership before use.
2. Converge Cora context on `@nzila/org` and add server-derived `appId`
   and Cora capability grants. Preserve the active-org and authenticated-user
   failure paths.
3. Establish API/action → domain service → authorized Cora repository
   layering. Repository access must not substitute for permission checks.
4. Verify and enforce org isolation in actual database roles/RLS and in
   relationship joins; Cora writes must be structurally unable to target
   Agrimo-owned operational records.
5. Define Cora audit/evidence/provenance persistence and policy/consent
   requirements before write-capable workflows.
6. Add Cora-owned event/workflow contracts with durable delivery, tenant
   context, idempotency, and consumer authorization where applicable.
7. Replace broad read-only static guards with ownership-aware contracts only
   after the new guards and tests exist. Keep a hard prohibition on
   cross-owner Agrimo writes and direct DB access from UI entry points.

## 13. Hard Blockers and Limitations

There is no architecture-level incompatibility between Phase 0A doctrine
and the shared platform primitives inspected. The following are hard
blockers **to any Cora mutation today**, not blockers to this audit:

- no implemented Cora-owned schema/repository/service;
- no Cora-specific capability assignment or enforcement wired into Cora;
- blanket static contracts still prohibit every Cora mutation;
- agri-table database RLS/grants were not evidenced in repository source and
  deployed policy state is unknown;
- ownership of the existing shared intelligence tables is unresolved;
- no durable, ownership-aware Cora-to-Agrimo event/share contract exists.

The generic authorization layer can represent product-specific permission
strings; no need to duplicate it. This audit does not claim the correct Cora
roles/grants, data-sharing basis, deployed RLS, or production database state
have been validated. The in-memory graph edge store also is not safe as a
production tenant isolation mechanism.

## 14. Safe Sequence for Future Implementation

1. Select one Cora-owned domain slice and define its records, data
   classification, actor/org authority, and evidence/provenance needs.
2. Resolve ambiguous data ownership and agree any cross-product read contract;
   preserve Agrimo as sole writer for its operational records.
3. Design additive Cora schema and database roles/RLS, then prove same-org
   access and cross-org/cross-owner denial in integration tests.
4. Implement canonical-context authorization and a narrow Cora service/
   repository boundary; deny by default and test denied and permitted cases.
5. Add audit/evidence/provenance and policy/consent behavior to that slice.
6. Add durable events/workflows only if the slice requires them, with
   explicit ownership and consumer permissions.
7. Update blanket static tests and acceptance docs to preserve the permanent
   invariants while allowing only the reviewed Cora-owned path.
8. Run focused package/app/security-boundary checks and required repository
   governance checks; request separate authorization before capability work.

## 15. Phase Boundary

**No write authorization was granted.** This audit does not implement Farmer
360, Value Creation, Opportunity Passport, Association Observatory,
Collective Action, Evidence Wallet, Standards Registry, National Index/B
Corp adapters, Foodchain Graph, capital navigation, policy/research domains,
settlement extensions, schema changes, permission changes, deployment, or
production mutation. Phase 1 must be separately authorized.
