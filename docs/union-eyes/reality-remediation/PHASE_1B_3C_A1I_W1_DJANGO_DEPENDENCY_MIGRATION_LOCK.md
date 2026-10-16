# W1 - exact Django dependency and migration identity

## Gate: PASS — W1 dependency identity only

The explicit W1N maintainer amendment approves the unchanged package/graph/plan identity and separates W1 completion from downstream physical/runtime work. W1 is PASS; bootstrap implementation and runtime proof remain NO. The original BLOCKED gate and its governance-boundary conflict are preserved in the W1N inverse history, historical validation and unchanged dependencyConflicts register.

## Package authority and exact lock

Existing authority: pip requirements.txt. The unchanged 27 direct declarations resolve to 87 exact distributions (60 transitives) with one verified artifact SHA256 each in [requirements.lock](../../../apps/union-eyes/backend/requirements.lock) and [lock metadata](../../../apps/union-eyes/backend/requirements.lock.metadata.json). Candidate target: CPython 3.11.14/Linux x86_64/manylinux2014/cp311. Installed Python 3.13 is only the resolver/AST tool, not promoted to runtime authority. The existing Docker minor is 3.11; historical workflow dependency commands also declare 3.12. Deployment/runtime alignment is not changed here.

Package-index metadata and exact wheel downloads were used. No application services, secret stores or databases contacted. Direct compatibility ranges remain unchanged. Host-marker versus target-marker differences were independently validated for the Linux 3.11.14 transitive requirement closure; no target requirement is missing.

## Configured apps and migrations

25 = 14 local + 6 framework + 5 third-party + 0 unresolved.

The configured apps namespace is a single-path local namespace app without apps.models or apps.migrations. Exact locked Django AppConfig/MigrationLoader source rules support it as a migrationless app; apps.core is not silently installed as an additional app. No Django initialization/import of these app sources occurs.

All 29 local migration bytes and 26 literal edges remain unchanged. The complete inventory has 82 nodes, 81 dependency edges, 0 run-before, 0 replacement and 1 swappable edges. Unknown references: 0; duplicate identities: 0; dependency cycles: 0. Replacement lineage is not modeled as an execution dependency.

AUTH_USER_MODEL is resolved from the repository override, or the literal default in the exact locked Django global_settings.py when no override exists. All wheel migration sources are identified by artifact and per-file hashes; external code is not vendored or reproduced in these reports.

## Operations and candidate plan

Operation classes include raw/generated/state-only effects, with explicit state/physical flags and static-analysis requirements. Raw RunPython/RunSQL/SeparateDatabaseAndState dependencies are inventories, not implemented preconsumer producers. The JSON [exact report](PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.json) contains operation and raw registers, consumer references and a deterministic topological candidate plan. This is not proof Django internally executes precisely that order.

## Digests

- DJANGO_PACKAGE_LOCK_DIGEST: `310eb938f4f7c25b6f93323031981ede60a0d2ef2d68e017a5c9ced33e326fe6`
- DJANGO_MIGRATION_GRAPH_DIGEST: `73690369f0985a6d3fe33e1d72c66da9d864c0c590590c1628f75c33278e79f1`
- DJANGO_MIGRATION_PLAN_DIGEST: `447da85fbb379c41d4684ea6dda994c3dad7c98b6bce08d475d01d4bb9bd10e2`
- LOCAL_MIGRATION_SOURCE_DIGEST: `03b85c45cd7a2401619e24b169fffb0f45d169ffc9f689672d21754f6cacce43`
- EXTERNAL_MIGRATION_SOURCE_DIGEST: `edd2cdd9441d3008c5e8520a7058017748efc4c7e9264113b6c26f4faacd41eb`

## Normalized W1 linkage and approved identity

All 400 W1-linked obligation IDs remain represented exactly once: 24 W1 completion obligations and 376 downstream-dependent obligations. The prior 24 implemented obligations are unchanged. All 372 Django physical obligations have identity/plan established but remain physically unimplemented and runtime-unproven; their existing explicit W4 Django producer assignment is retained, W8 composes and W9 proves. Four raw/generated obligations are downstream-owned using the unchanged raw registry, with per-operation W4/W6 duties preserved.

Decision approved by the explicit W1N mission: exact lock, graph, plan and CPython 3.11/cp311/Linux x86_64 compatibility target. Reference patch 3.11.14 is not deployed runtime proof. Contract version 1.1 records W1_COMPLETION_BOUNDARY_NORMALIZATION and the original version 1 digest. Native locked-runtime validation, deployment alignment and expected schema digest remain W8 requirements before faithful replay, with W9 proof. See [W1N preservation and exact ownership report](PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.md).

## Verification

Two pip resolutions produced identical lock bytes. Two syntax graph builds produce identical graph/plan digests. All wheel SHA256 values verified; a fresh offline cross-platform pip target payload populated with --require-hashes and distribution metadata matches all 87 pins. This is not a native Python311 executable venv; no Python311 interpreter is available locally, so native import validation is not claimed.

No django.setup, migrations, database, schema/RLS changes or deployment. The preceding W1 run preserved governance/predecessor hashes and all 23 frozen migration hashes. W1N explicitly amends prospective contract governance only; all accepted W1 technical JSON fields and lock bytes remain unchanged. Frozen manifest hashes are compared within the permitted artifacts, not rescanned from source. Syntax/self-tests, deterministic --check, scoped formatting and docs validation are run separately.

## Historical W1 reproduction commands — not executed or authorized by W1N

Use an explicitly selected temporary directory in `$work`; no application environment files are read. The full pip resolver flags are recorded in lock metadata. Resolve the unchanged requirements twice using those flags with `--report` paths, then:

```powershell
python scripts\ue\lock-django-bootstrap-dependencies.py --run1 "$work\resolution-run1.json" --run2 "$work\resolution-run2.json" --evidence apps\union-eyes\backend\requirements.lock.metadata.json --check
python -m pip --isolated download --require-hashes --no-deps --only-binary=:all: --python-version 3.11.14 --platform manylinux2014_x86_64 --implementation cp --abi cp311 --dest "$work\wheelhouse" -r apps\union-eyes\backend\requirements.lock
python -m pip --isolated install --require-hashes --no-deps --no-compile --no-index --find-links "$work\wheelhouse" --only-binary=:all: --python-version 3.11.14 --platform manylinux2014_x86_64 --implementation cp --abi cp311 --target "$work\isolated-payload" -r apps\union-eyes\backend\requirements.lock
python scripts\ue\build-django-migration-plan.py --wheelhouse "$work\wheelhouse" --isolated-payload "$work\isolated-payload" --check
```

Regenerating from unpinned requirements against a later index may intentionally produce a different compatible resolution and must fail `--check`, not overwrite the accepted lock silently. Existing exact lock/artifact URLs and hashes reproduce package sources without rerunning floating resolution. No native import/runtime proof is inferred from cross-target population.

## Next authorization

W1 = PASS (dependency identity only); W1N = PASS; W2 = AUTHORIZED_NOT_STARTED and not started. W3-W10, A1R/A2/B3C-B are not started; runtime readiness remains zero and all production/faithful replay/tenant-isolation/product proof remains NO.
