# UE database target, schema and search-path contract

## W2 gate: PASS — contract definition only

Status: **GOVERNANCE_ADOPTED_IMPLEMENTATION_PENDING**. Canonical bootstrap contract **1.2**, amendment **DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT**. [Exact machine-readable counterpart](UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json) and [related contract/evidence](PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json) retain exact references and version history. W1/W1N stay frozen PASS.

## Physical target and scope contract

| Scope             | Required host name binding | Explicit port binding    | Exact database-name binding  | Namespace                       |
| ----------------- | -------------------------- | ------------------------ | ---------------------------- | ------------------------------- |
| UE_OPERATIONAL    | UE_OPERATIONAL_PGHOST      | UE_OPERATIONAL_PGPORT    | UE_OPERATIONAL_PGDATABASE    | public in its distinct database |
| FINANCIAL_SERVICE | FINANCIAL_SERVICE_PGHOST   | FINANCIAL_SERVICE_PGPORT | FINANCIAL_SERVICE_PGDATABASE | public in its distinct database |

Select UE_DATABASE_TARGET_ENVIRONMENT once. All actors consume the exact same environment and scope descriptor; missing/empty/default values, conflicting URL/PG\* components, wrong scope or wrong role fail before connection. These are prospective mandatory **configuration names**, not fabricated hostnames or read secret values. The per-environment descriptor must be populated under the later authorized composition lane before connecting; no live physical endpoint is attested by W2.

Physical equality is normalized DNS host (lowercase, one terminal dot removed), explicit integer port and exact case-sensitive database name. No DNS/alias equivalence is assumed. Operational actors must match one tuple; financial actors must match a different physical tuple. Same server/different database is allowed; same database/different schema is **not** financial separation.

Django and scoped/security migrations use UE_OPERATIONAL, retaining the accepted shared plan-selected vault/migration-admin secret reference. Separate runtime and system reference classes must match that operational target later; their values were not compared. Financial migration/runtime/provisioning references are scope-specific prospective classes, never operational credential fallback. Credential/role identity is distinct from database equality. Existing URL/PG\* names are compatibility adapters only, not alternative target authorities.

## Actor, role and search-path matrix

| Actor                     | Scope             | Role class                 | Exact ordered path      | Executable exists / canonical binding applied |
| ------------------------- | ----------------- | -------------------------- | ----------------------- | --------------------------------------------- |
| DJANGO_MIGRATION          | UE_OPERATIONAL    | MIGRATION_ADMIN            | ["public","pg_catalog"] | YES / NO                                      |
| SCOPED_SECURITY_MIGRATION | UE_OPERATIONAL    | MIGRATION_ADMIN            | ["public","pg_catalog"] | YES / NO                                      |
| PROVISIONING              | UE_OPERATIONAL    | MIGRATION_ADMIN            | ["pg_catalog"]          | YES / NO                                      |
| PRECONSUMER_BASELINE      | UE_OPERATIONAL    | MIGRATION_ADMIN            | ["public","pg_catalog"] | NO / NO                                       |
| APPLICATION_RUNTIME       | UE_OPERATIONAL    | APPLICATION_RUNTIME        | ["pg_catalog","public"] | YES / NO                                      |
| SYSTEM_RUNTIME            | UE_OPERATIONAL    | SYSTEM_OR_INTERNAL_RUNTIME | ["pg_catalog","public"] | NO / NO                                       |
| FINANCIAL_PROVISIONING    | FINANCIAL_SERVICE | FINANCIAL_MIGRATION        | ["pg_catalog"]          | NO / NO                                       |
| FINANCIAL_MIGRATION       | FINANCIAL_SERVICE | FINANCIAL_MIGRATION        | ["public","pg_catalog"] | YES / NO                                      |
| FINANCIAL_RUNTIME         | FINANCIAL_SERVICE | FINANCIAL_RUNTIME          | ["pg_catalog","public"] | YES / NO                                      |

All paths are **GOVERNED_PROSPECTIVE_CONTRACT**, to be explicitly set/validated per connection and pool reuse; role/database defaults alone are insufficient. UE default/application/system runtime path is `["pg_catalog","public"]`. Provisioning uses `["pg_catalog"]` with qualified DDL. Django, platform/frozen scoped DDL and financial migration use `["public","pg_catalog"]` so unqualified CREATE targets public, not pg_catalog. Runtime prioritizes built-ins and cannot create objects. System access does not broaden its namespace.

## Schema authority and qualification

Operational **public = CANONICAL_OPERATIONAL_SCHEMA**, preserving Django/frozen public identities. Domain objects (including organizations) remain Django-owned, not platform surrogates. Approved platform/security helpers can occupy the same governed namespace with explicit ownership and collision controls. Financial public is independently approved inside FINANCIAL_SERVICE, not inside UE_OPERATIONAL. pg_catalog is read/lookup-only system schema. No additional decorative platform/security/internal schema is invented or created.

W3 must restrict effective public CREATE to governed DDL owners (including inherited/PUBLIC privilege paths); runtime/system actors must not own protected domain objects. No principals or grants are chosen by W2.

- Existing frozen SQL and Django unqualified objects: **allowed only under the fixed governed migration path**; no frozen SQL rewritten.
- New privileged bootstrap DDL, helper/table/type references: **require schema qualification**. Built-ins in new privileged SQL use pg_catalog qualification.
- Elevated SECURITY DEFINER, policy, trigger and privileged functions: explicit trusted function-specific `["pg_catalog","public"]` in their own database; no ambient caller path. W6 adjudicates existing frozen function compatibility without rewriting it.
- pg_catalog is explicit for every actor. Migration/runtime order differs only for creation-versus-lookup requirements.
- pg_temp is **NOT_EXPLICITLY_ALLOWED**. Omission does **not** suppress implicit temporary relation/type lookup. W3 must deny effective TEMP including inherited/PUBLIC privileges; privileged references remain qualified, and W8 rejects unexpected temporary namespaces before privileged execution.
- Cross-scope operational/financial targeting is prohibited. Business integration requires a later separately approved contract.

## Exact W2 decisions and obligation accounting

| Decision ID                          | Subject                                                  | Approved |
| ------------------------------------ | -------------------------------------------------------- | -------- |
| UE-1B3CA1G-DECISION-b3a80b236c6a489d | Exact operational and distinct financial target contract | YES      |
| UE-1B3CA1G-DECISION-70fd4794fc24b96e | Exact schema names and search paths                      | YES      |

Exact denominator: **1 W2 input obligation; 2 W2 input decisions**. All are closed as target/namespace contract work, with zero lost or duplicate IDs. Obligation `UE-1B3CA1G-REQUIREMENT-cfda13aaa220ee21` is IMPLEMENTED_BY_W2 = YES, CONTRACT_DEFINED = YES, SOURCE_CONFIGURATION_ALIGNED = PARTIAL, RUNTIME_PROVEN = NO. All decisions are authorized W2 architecture adjudications, not product/business decisions.

## Configuration drift / alignment register

| Drift ID                                      | Owner | Classification                   | Blocks W2 |
| --------------------------------------------- | ----- | -------------------------------- | --------- |
| UE-W2-DRIFT-DJANGO_MIGRATION-PATH             | W8    | SOURCE_ALIGNMENT_CEILING         | NO        |
| UE-W2-DRIFT-SCOPED_SECURITY_MIGRATION-PATH    | W8    | SOURCE_ALIGNMENT_CEILING         | NO        |
| UE-W2-DRIFT-PROVISIONING-PATH                 | W3    | SOURCE_ALIGNMENT_CEILING         | NO        |
| UE-W2-DRIFT-PRECONSUMER_BASELINE-PATH         | W4    | PROSPECTIVE_IMPLEMENTATION_GAP   | NO        |
| UE-W2-DRIFT-APPLICATION_RUNTIME-PATH          | W8    | SOURCE_ALIGNMENT_CEILING         | NO        |
| UE-W2-DRIFT-SYSTEM_RUNTIME-PATH               | W8    | PROSPECTIVE_IMPLEMENTATION_GAP   | NO        |
| UE-W2-DRIFT-FINANCIAL_PROVISIONING-PATH       | W3    | PROSPECTIVE_IMPLEMENTATION_GAP   | NO        |
| UE-W2-DRIFT-FINANCIAL_MIGRATION-PATH          | W7    | SOURCE_ALIGNMENT_CEILING         | NO        |
| UE-W2-DRIFT-FINANCIAL_RUNTIME-PATH            | W7    | SOURCE_ALIGNMENT_CEILING         | NO        |
| UE-W2-DRIFT-MIGRATION-RUNTIME-TARGET-EQUALITY | W8    | SOURCE_ALIGNMENT_CEILING         | NO        |
| UE-W2-DRIFT-LEGACY-BOOTSTRAP-TARGET           | W8    | NON_CANONICAL_EXISTING_CANDIDATE | NO        |
| UE-W2-DRIFT-FINANCIAL-GENERIC-URL             | W7    | SOURCE_ALIGNMENT_CEILING         | NO        |

The register records exact governed/current values and A1E references in JSON. Existing paths and complete descriptor mappings are unpinned or not implemented in accepted evidence; migration/runtime target equality and financial generic-URL separation remain alignment ceilings. No unsupported claim about current source values is made and no source is rescanned. These gaps block faithful replay until aligned, not internally coherent W2 contract definition.

Structural reasoning covers untrusted schema precedence, public-before-catalog legacy DDL, privileged helper resolution, admin/runtime target ambiguity and implicit temporary lookup. Concrete downstream controls are specified; **no exploitability or runtime security proof is claimed**.

## Downstream implementation packet

| Owner | Exact duty                                                                                                                                                                                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W3    | Map separate role/credential classes to exact scope targets; provision governed schema ownership/CREATE/TEMP boundaries and mandatory extensions under fixed qualified provisioning paths. No principal/grant/extension is created by W2.                                               |
| W4    | Implement real Django-owned and approved preconsumer producers in operational public; preserve domain authority and frozen SQL. Validate collision-free trusted schema before legacy public-first DDL.                                                                                  |
| W6    | Bind raw/opaque helper, policy and privileged semantic targets to exact scope/schema/function path; prohibit ambient and cross-scope resolution.                                                                                                                                        |
| W7    | Implement fail-fast full financial materializer and isolated migration/runtime credential adapters; financial public belongs to a distinct physical database.                                                                                                                           |
| W8    | Compose descriptors into every connection/pool, reject ambient/conflicting URL/PG\* options, verify same-operational/distinct-financial targets and effective paths/CREATE/TEMP boundaries before any replay. Apply runtime/secret/configuration alignment only in its authorized lane. |

Every task carries exact actor, scope, schema, path, W2 obligation and W2 decision IDs. All tasks remain unimplemented/not started by W2. W8 must apply and verify target/path/privilege boundaries before faithful replay; W9 remains a separately authorized runtime-proof lane.

## Version chain and preservation

Canonical JSON 1.2 retains the version 1 digest and exact version 1.1 digest/reference. [W2 JSON](PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json) inverse patches reconstruct 1.1 byte-for-byte; frozen [W1N JSON](PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.json) reconstructs version 1. W1/W1N/A1E and lock/metadata whole-file hashes remain unchanged. The 87 distributions, Django 5.2.18, 25 apps, 82 migrations, 81 dependency/one swappable edges, 29 local migrations/26 local edges, 16 raw records, 803/118/86 universes and all 23 frozen manifest hashes remain intact. Frozen source hashes are preserved within artifacts; no source/database inspection occurs.

## Validation and proof boundaries

Syntax, deterministic generation/two-build equality, --check, scoped Prettier, docs audit and independent preservation/reference/ID/version-chain assertions are required at closeout. Offline synthetic descriptor tests reject wrong/ambient targets, paths, roles, temporary privileges, cross-scope collapse and missing/duplicate actors; they do not connect to PostgreSQL or inspect secrets.

```powershell
node --check scripts\ue\define-database-target-contract.mjs
node scripts\ue\define-database-target-contract.mjs --self-test --check
pnpm validate:docs
```

W2 = PASS; W2_IMPLEMENTATION_COMPLETE = YES **for contract definition only**. W3 = AUTHORIZED_NOT_STARTED; W3_STARTED = NO. W4-W10, A1R/A2/B3C-B remain not started.

DATABASE_RUNTIME_CONFIGURATION_APPLIED = NO; DATABASE_RUNTIME_CONFIGURATION_PROVEN = NO; DATABASE_ROLES_PROVISIONED = NO; EXTENSIONS_RUNTIME_PROVEN = NO; DJANGO_SCHEMA_MATERIALIZED = NO; BOOTSTRAP_IMPLEMENTATION_COMPLETE = NO; FAITHFUL_SCHEMA_REPLAY_PROVEN = NO; PRODUCTION_SCHEMA_PROVEN = NO; RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN = NO; TENANT_ISOLATION_RUNTIME_PROVEN = NO; READY_FOR_RUNTIME_PROOF = 0; PRODUCT_READY = NO.

No database/migration execution, schema/role/extension creation, environment/deployment/configuration mutation, secret access, RLS change, later workstream start or PR creation occurs here.
