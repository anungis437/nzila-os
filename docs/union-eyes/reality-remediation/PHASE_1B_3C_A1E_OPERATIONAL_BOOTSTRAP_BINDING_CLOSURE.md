# Phase 1B.3C-A1E - Operational bootstrap binding closure

## Gate and authorization

`PHASE_1B_3C_A1E_GATE = SOURCE_CEILING`.
`PHASE_1B_3C_A1E = SOURCE_CEILING_ACCEPTED`.
`BOOTSTRAP_OPERATIONAL_EVIDENCE = CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS`.
`NO_FURTHER_BOOTSTRAP_STATIC_SOURCE_PASS = YES`.

Canonical bootstrap contract remains **NOT_ESTABLISHED**. No candidate is recommended for adoption. A1G, A1R, A2 and B3C-B remain **NOT_AUTHORIZED**, unstarted. B3B remains SOURCE_CEILING_ACCEPTED; static RLS model CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS; runtime packet 3,124, readiness 0, production schema/tenant isolation/product readiness unproven. No database, migration, schema, policy, deployment, environment or application changes.

## Physical binding and topology

**ESTABLISHED_SAME_TARGET**, narrowly for the deployment Django migration job and targeted scoped rollout: both select the same plan-selected Key Vault and fixed migration-admin secret reference. No values are compared or accessed. The disposable fresh-build also explicitly composes one conn/dbName into Django PG\* and the scoped PostgreSQL client.

This is **not** full 23-file clean replay, deployed runtime target equality, financial scope binding, or role/search_path authority. The deployment uses an existing-environment targeted scoped 0005 job; the Django migration job is separate and gates deployment. Django runtime starts Gunicorn without migrate. Frontend runtime URL-to-Django PG\* translation exists, with fallback discrete wiring; migration-admin versus runtime target equality remains unproven.

The fresh-build's executable order is Django then extensions/scoped, despite its comment advertising extensions first; it omits platform and financial migration execution and requires preexisting runtime roles. It is binding evidence, not an adoptable complete sequence.

## Complete Django operational graph

25 configured apps = 13 local + 6 framework + 5 third-party + 0 explicitly migrations-disabled + 1 source-ceiling app.

Default manage.py/wsgi/asgi wiring selects config.settings.py, not the nested template base.py (no settings package initializer). All 29 local records and 26 literal edges are retained without execution. Requirements are ranges, not exact package pins; no contributed migration graph or migrationless package proof is invented. The configured apps namespace and four raw/generated-operation obligations remain unclosed. **COMPLETE_DJANGO_MIGRATION_PLAN = SOURCE_CEILING**; all 16 predecessor broader closure obligations remain.

## Financial materialization authority

**SOURCE_CEILING**. Package start/dev instantiate the service, not a schema materializer. Manual run-migrations.ts references three absent files under database/migrations and skips absent/erroring inputs. Partial add/repair scripts do not supply full-scope canonical authority. Frozen financial SQL remains comment-only and is not promoted. Scope is not merged with UE.

## Role, extension, type and function authority

The two runtime roles have an explicit standalone creator, but provisioning target/order is not composed into the full frozen bootstrap. Their disposition is RUNTIME_MANUAL_PREREQUISITE, not proof of deployed creation.

Four mandatory extensions (uuid-ossp, pgcrypto, pg_trgm, btree_gin) have explicit fail-fast, same-client installation before all frozen UE consumers through the bootstrap/shared executor. Their **static installer authority** is resolved by platform baseline; server availability, privilege and actual installation still need controlled environment proof. Vector is optional in the installer but downstream guarded use is not established, so remains SOURCE_CEILING.

All 41 currently ceilinged type/function identities retain their candidate evidence and explicit operational-authority ceilings. Historical, declaration, test-only and partial producers are not promoted.

## Exact reconciliation

- Ordering: **86 = 0 preconsumer prerequisites established + 0 proven true ordering conflicts + 86 source ceilings**. Frozen order unchanged; lack of a baseline is not proof of impossibility.
- Opaque: **118 = 0 physical-target resolved + 0 runtime-contract resolved + 0 not relevant + 118 source ceilings**. Exact predecessor IDs and consumers preserved.
- Prior prerequisite ceilings: **807 = 4 platform-baseline installer authorities resolved + 803 source ceilings remain**. All six other resolution/exemption classes are zero.
- Final model: **945 = 4 PostgreSQL core + 134 prior-frozen declarations + 4 platform-baseline resolutions + 803 remaining ceilings**. Unique IDs 945; unaccounted 0; authority conflicts 0. Static declarations/installer authority are not runtime presence proof.

## Four-candidate reevaluation

- **DJANGO_FIRST_THEN_SCOPED_PLATFORM_MIGRATIONS**: NOT ADOPTABLE. Same-target binding evidence added, but complete configured graph, exact preconsumer baseline, financial authority and opaque obligations remain. Snapshot strategy additionally lacks pinned provenance/replay compatibility; cleanroom remains disqualified.
- **PINNED_CANONICAL_SNAPSHOT_THEN_FORWARD_MIGRATIONS**: NOT ADOPTABLE. Same-target binding evidence added, but complete configured graph, exact preconsumer baseline, financial authority and opaque obligations remain. Snapshot strategy additionally lacks pinned provenance/replay compatibility; cleanroom remains disqualified.
- **EXISTING_REPOSITORY_BOOTSTRAP_ORCHESTRATOR**: NOT ADOPTABLE. Same-target binding evidence added, but complete configured graph, exact preconsumer baseline, financial authority and opaque obligations remain. Snapshot strategy additionally lacks pinned provenance/replay compatibility; cleanroom remains disqualified.
- **OTHER_ALREADY_EVIDENCED_CANONICAL_PATH**: NOT ADOPTABLE. Same-target binding evidence added, but complete configured graph, exact preconsumer baseline, financial authority and opaque obligations remain. Snapshot strategy additionally lacks pinned provenance/replay compatibility; cleanroom remains disqualified.

## Remaining governance/runtime evidence packet

The JSON [exact ledgers](PHASE_1B_3C_A1E_OPERATIONAL_BOOTSTRAP_BINDING_CLOSURE.json) contain one entry per residual prerequisite and preserve every opaque/ordering linkage, plus external-package and raw-operation gaps. Categories are GOVERNANCE_DECISION_REQUIRED, RUNTIME_ENVIRONMENT_EVIDENCE_REQUIRED, EXTERNAL_PACKAGE_RUNTIME_EVIDENCE_REQUIRED and MISSING_REPOSITORY_AUTHORITY.

Required next evidence: approved full-scope target/role/search_path/sequence and initial-state contract; exact external package migration graphs and swappable/migrationless-app proof; raw/generated physical dependencies; authoritative preconsumer object/column/type baseline; complete fail-fast financial manifest; controlled role/extension environment evidence; each of the 118 dynamic/ACL/semantic target contracts. If snapshot strategy is selected, pin provenance/version/migration level and object/policy digests and reconcile baselining with exact frozen replay.

**No further generic static bootstrap source pass is authorized.** This packet identifies prerequisites, not permission to execute them or adopt a contract.

## Source scope and validation

169 byte-digested operational/configuration sources; actual environment files, secret values/stores and product/business dependencies excluded. CI/CD YAML, package scripts, container topology, settings, requirements, IaC, runbooks and directly referenced bootstrap files inspected as syntax only.

Validation commands (run separately; generation does not assert external audit success):

```powershell
python scripts\ue\read-operational-django-config.py --self-test
node scripts\ue\read-operational-bootstrap-sources.mjs --self-test
node --check scripts\ue\reconcile-operational-bootstrap-bindings.mjs
node scripts\ue\reconcile-operational-bootstrap-bindings.mjs --self-test
node scripts\ue\reconcile-operational-bootstrap-bindings.mjs
node scripts\ue\reconcile-operational-bootstrap-bindings.mjs --check
pnpm exec prettier --check scripts\ue\reconcile-operational-bootstrap-bindings.mjs scripts\ue\read-operational-bootstrap-sources.mjs docs\union-eyes\reality-remediation\PHASE_1B_3C_A1E_OPERATIONAL_BOOTSTRAP_BINDING_CLOSURE.json docs\union-eyes\reality-remediation\PHASE_1B_3C_A1E_OPERATIONAL_BOOTSTRAP_BINDING_CLOSURE.md
pnpm validate:docs
```

Five predecessor hashes, 23 migration hashes, prerequisite graph, exact 945/807/118/86 IDs, Django 29/26 records and quarantined C-A evidence are preserved. No canonical contract, replay mode, governance adoption, tenant-isolation tests or PR.
