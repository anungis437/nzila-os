---
name: nzila-runtime-acceptance
description: Use after Nzila source remediation when proving authenticated application journeys, tenant isolation, migrations, concurrency, and environment-specific release gates without overstating readiness.
---

# Runtime acceptance and environment truth

## Trigger
Use when asked to certify a corrected family, validate a user journey, establish staging/production parity, or issue a GO/NO_GO decision.

## Procedure
1. Capture the exact candidate SHA, deployed image/revision, environment, configuration, schema migration level, release gate, and allowed test identities. A build or CI PASS is not a deployed-environment PASS.
2. Read `AGENTS.md` and product-specific acceptance sources. For Union Eyes, read the ordered resources required by `AGENTS.md`; locate the current convergence ledger and runtime evidence, not historical snapshots.
3. Create a persona/action matrix covering navigation, API behavior, persisted state, reverse/undo paths, background jobs, deadline/notification delivery, authorization, tenant cross-access, observability, and degraded/negative paths.
4. Execute only permitted tests in the correctly identified environment. For every row, capture request/actor/tenant, observed response, database or event outcome, evidence artifact, and SHA. Do not use synthetic success to stand in for a real authenticated journey.
5. Check migrations and workers under concurrent/retry conditions, including kill/restart and duplicate delivery where authorized. A migration passing on one clean database does not prove supported upgrade or deployed recovery.
6. Compare demo/UAT/prod by capability and data contract, not by leaking test records between tenants or relying on noncanonical UAT fixtures as release truth.
7. Issue `GO` only when all applicable gates and human production authorizations are recorded. Otherwise provide an exact `NO_GO` / `CONDITIONAL` ruling with unexecuted probes.

## Evidence format
`CHECK | ENVIRONMENT | CANDIDATE_SHA | ACTOR/TENANT | EXPECTED | OBSERVED | PROOF | VERDICT | REMAINING_ACTION`.

