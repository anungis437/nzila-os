# Cora local stress-test governance checks

Offline doctrine/test-governance only, not an app/package runtime dependency.
No credentials, network, database, data acquisition or activation behaviour.
The private tooling package declares Ajv for its local schema checks. It has
no application exports or runtime consumer; root tsx/TypeScript and existing
Cora lint configuration provide the development runners.

Canonical contracts:
[framework](../../docs/categories/products-and-market/agri/CORA_STRESS_TEST_FRAMEWORK.md),
[registry](../../docs/categories/products-and-market/agri/CORA_STRESS_TEST_REGISTRY.json),
[schema](../../docs/categories/products-and-market/agri/CORA_STRESS_TEST_REGISTRY.schema.json).

Run from repository root on Windows:

```powershell
pnpm exec tsx tooling\cora-stress-test\governance.ts
pnpm exec tsx --test tooling\cora-stress-test\governance.test.ts
pnpm exec tsc --project tooling\cora-stress-test\tsconfig.json
pnpm exec eslint --config apps\cora\eslint.config.mjs --max-warnings 0 --rule "@next/next/no-html-link-for-pages: off" tooling\cora-stress-test\governance.ts tooling\cora-stress-test\governance.test.ts
```

CLI exit 0 means the registry is structurally/semantically valid, **not a
portfolio pass or authorization**. Pending evidence is explicitly reported
as BLOCKED_EVIDENCE with null disposition. Invalid registry exits 1 with error.

Tests construct synthetic governance-only results in memory. They are not
CFA, producer, recipient or public-source findings. No constructed selected B
is persisted to the canonical registry.

`registrationHash` binds the preregistered contract and approval before
observations. Recompute it only for an approved prospective version; retain
old registry/memo snapshots in the approved restricted governance store.
The local hash is integrity checking, not a trusted timestamp, signature,
legal approval, immutable store or verification that an evidence reference
exists. Threshold-change records bind sequential hashes and approval references;
the human approver must verify retained old/new snapshots, actual authority
and prospective evidence scope. No numeric defaults are approved here.

All required metric observations are finite and unit-matched; kill criteria
use any-match, pass and redirect use all-match, in that precedence. Human
constraints can block a numeric pass, never convert a numeric failure to PASS.
Route/phase decisions and closed conditions remain independent. The portfolio
matrix cannot clear any source or production gate.
