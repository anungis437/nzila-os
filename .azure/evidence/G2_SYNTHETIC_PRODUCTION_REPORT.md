# G2 Stage 2A synthetic artifact production - blocked before dispatch

Mission `NZ-20261008-INFRA-001`.
Slice `G2_STAGE2A_SYNTHETIC_ARTIFACT_PRODUCTION`.

**STAGE2A_BUILDER_ARTIFACT = PARTIAL**

**EXECUTION_AUTHORITY_CONSUMED = NO**

**OVERALL_G2 = FAIL**

## Exact blocker

`PRE_DISPATCH_IMMEDIATE_LIVE_CONDITION_RECHECK_UNAVAILABLE`.

The packet requires re-reading live authorization immediately before push
and stopping if the live condition has broadened. The builder has exactly
two assignments, both on the target ACR:

- `ba1fd686-3000-51dc-8fa6-1cfdedf67d20`: conditioned Repository Writer,
  `synthetic-health` only.
- `6628bb3e-5e59-5dcb-9f7b-80b421a7a7f8`: conditioned Repository Reader,
  `g2-tooling` only.

Fresh role definitions for both have `actions: []`. Their DataActions cover
repository content/metadata only; neither authorizes
`Microsoft.Authorization/roleAssignments/read`. Only builder UAMI is attached.
This is a permissions conclusion from live assignment/definition evidence,
not a guest-observed HTTP403: no guest execution occurred.

The operator can and did read exact live conditions before dispatch.
That is not the same proof as re-reading those conditions at the later
guest push boundary after retrieval/extraction/version/collision checks.
Scoped token tests can establish effective access to their requested
repositories but do not return ARM ABAC condition text or establish that
no other repository was added to a condition.

This packet permits no RBAC changes, operator credentials on the guest,
SSH or Run Command. No additional bridge/check channel is assumed.
Stop before creating or consuming the single-use execution.

## Work completed

- Fresh protected16 resource bodies match the last final estate, excluding
  only volatile etag/systemData.
- Target public Disabled, bypass None, admin disabled.
- Full target/source assignment conditions and registry state unchanged.
- Importer roles absent. Builder tooling read PRESENT, tooling write ABSENT,
  synthetic-health write PRESENT; runtime tooling access ABSENT.
- Private DNS A records, PE NIC and zone group unchanged:
  login .5/data .4.
- CSE absent; prior evidence/source hashes checked and preserved.
- Fixed 326-byte SYNTHETIC_ONLY payload and source contract bound locally.

```text
SOURCE_CONTRACT_SHA256 = c55178058d1e2475066761759edda464fd9afc4eab6825d6048065d3ab5ab303
SYNTHETIC_SOURCE_SHA256 = 2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db
TARGET_REPOSITORY = synthetic-health
TARGET_TAG = stage2a-2457502e49df5a77cd6403052c37ad7dc8cce95f3947378aa5e3dcf2f12703db
```

The payload contains the canonical source-contract digest, not its own
digest. The exact tag derives from the payload hash. There are no
timestamps, host values, secrets, product/customer data or random values.
This is source/tag binding only, **not** the full execution-source authority
required to dispatch a production CSE.

## Validation

`python -m unittest discover -s
infrastructure/landing-zone/g2-builder/stage2a/synthetic-production
-p test_*.py -v`: **6 PASS**.
Checks deterministic bytes/tag, nonrecursive source relationship, exact
synthetic-only field set, no execution authority, exclusive output creation
and canonical key-order independence.

`git diff --check`: **PASS**.

No production runner/Bicep was created. Current-packet Bicep build/lint,
provider/what-if, azure-validate and azure-deploy are **NOT_RUN**.
Historical successful validation is not substituted.

## No runtime advancement

Archive retrieval/version proof, collision check, push, immutable readback
and both write-negative probes are NOT_RUN. No guest token or workspace
created. No new CSE, import, registry write, role/network change, package
installation, extraction or ORAS execution.
Prior private delivery remains PROVEN by its own sealed packet; it is not
reported as a fresh archive/version observation here.

## Concurrency and files

Isolated branch `g2/synthetic-health-source`, HEAD
`7bec20aad11d43eeae8099c14e021b3074154b27`.
Status unchanged: `?? .azure/`, `?? infrastructure/landing-zone/g2-builder/`.
No observed foreign delta in this lane; no foreign work dispositioned.

New [source contract and tests](../../infrastructure/landing-zone/g2-builder/stage2a/synthetic-production)
and `G2_SYNTHETIC_PRODUCTION_*` baseline, payload/contract/binding,
disposition/report/integrity evidence. [Deployment plan](../deployment-plan.md)
updated; earlier source/evidence preserved. Old plan SHA is historical
after this expressly scoped current-plan update.

## Required authority resolution

Resume only when an authorized immediate condition-read mechanism exists,
or the maintainer explicitly accepts a revised gate comprising a fresh
operator ARM census immediately before dispatch plus immediate guest
effective scoped grant/denial checks before push.
Neither choice has been assumed or implemented. No role broadening proposed
or performed here.

Stage 2B and Stage 3 remain unstarted. UE/Cora INFRA_NO_GO unchanged.

## Evidence

- [Fresh baseline and permission evidence](G2_SYNTHETIC_PRODUCTION_BASELINE.json)
- [Payload/tag binding](G2_SYNTHETIC_PRODUCTION_PAYLOAD_BINDING.json)
- [Exact synthetic payload](G2_SYNTHETIC_PRODUCTION_PAYLOAD.json)
- [Final disposition](G2_SYNTHETIC_PRODUCTION_FINAL_DISPOSITION.json)
- [Integrity root](G2_SYNTHETIC_PRODUCTION_FINAL_VERIFICATION.json)
