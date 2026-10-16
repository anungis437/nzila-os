# Handler repair and retry: validated, not dispatched

## Current blocker

The required deployment skill failed to load on both attempts:
`Denied by preToolUse hook from "mobile-app" (hook errored)`.
The retry controller was not invoked. This is a tooling block before authority
consumption, **not** HANDLER_DEPLOYMENT_FAILURE and not a Blob semantic result.
No third live proof or workaround was attempted.

## Completed

- Read all 687 lines of the new authority; bound its exact SHA.
- New boundary `nzila-g3-firstbyte-f3b047ee4c-rg`, confirmed absent.
- Refreshed Canada Central extension discovery; published 2.1 family available.
- Exact CSE template repair is only selector `2.1.10` to `2.1`; both automatic
  upgrade flags remain false. Effective version will be observed, not invented.
- Preserved transport, private topology, UAMI/Reader, V1/V2 semantics and cleanup.
  Reused frozen binaries with identical hashes/bytes; no rebuild.
- Refreshed subscription/tenant/principal, write and role permission, deny
  assignments, providers, CIDR, pinned image, B2s restriction/quota, network and
  Storage capacity/name checks. No registration/quota/permission mutation.
- New ephemeral RSA3072 private provisioning key destroyed before any dispatch.
- Three Bicep build/lint checks PASS; eight combined contract tests PASS.
- Official validation helper PASS: CLI/auth/build/provider validation/what-if,
  Create14/Modify0/Delete0 in the new boundary. Official workflow completed
  UpdateStatus; isolated plan is Validated.
- Same-day meter evidence and bounded quantities revalidated: expected
  CAD 1.5363953 with >=50% contingency fits the separate CAD 3.00 ceiling.
  Historical CAD 1.3567668 is not erased or reused as retry budget.

## Limitations and resume contract

The later extension resource cannot be validated against a VM that does not yet
exist. Local compiled-contract tests are not a guest provisioning proof.
The repaired deployment is authorized, but no live attempt has been made.
Do not infer an effective patch, private consumption success or version selection.

Before resuming, restore deployment-skill availability, refresh concurrency and
time-sensitive read-only safety checks, and bind any changed inputs with new
immutable evidence. Do not overwrite this interruption packet or the failed
previous packet. Consume the new authority exactly once at first mutation.
Cleanup remains mandatory for the entire new boundary on PASS or FAIL.

Conditional local G3A adapter/package/cost closure has not been activated.
G3A/G3B/technical execution authorization remains NO. G2 and all protected prior
packets remain preserved; UE/Cora remain INFRA_NO_GO.

## Concurrency and files

Active isolated HEAD `7bec20aad11d43eeae8099c14e021b3074154b27`, branch
`g2/synthetic-health-source`, status remains two untracked owned roots.
Foreign shared HEAD `1c337567635bb86ea0df7831557d8d2d22df1e6f`,
branch main, 505 observed status entries. No foreign disposition or edit.
All new files are inside this retry lane: wrapper/controller, exact CSE repair,
unchanged copied transport/VM IaC, frozen binary copies, safety/validation
evidence, local plan and pre-deploy tooling-block closeout. No commit made.

See [full disposition](RETRY_DISPOSITION.json),
[tool failure record](PRE_DEPLOY_TOOLING_BLOCK.json) and
[deployment plan](.azure/deployment-plan.md).
