# Governance decision: Stage 3 is private application substrate

Mission: `NZ-20261008-INFRA-001`.
Authority: the maintainer's Stage 3 decision packet supplied on 2026-10-11.

```text
G2_PRIVATE_CONTROL_PLANE = PASS
STAGE3_DEFINITION = G3_PRIVATE_APPLICATION_SUBSTRATE
STAGE3_DESIGN_AUTHORIZED = YES
STAGE3_TECHNICAL_EXECUTION_AUTHORIZED = NO
APPLICATION_ROLLOUT_AUTHORIZED = NO
PRODUCTION_DATA_AUTHORIZED = NO
UE_INFRA = INFRA_NO_GO
CORA_INFRA = INFRA_NO_GO
```

## Decision and chronology

Stage 3 answers whether a repeatable private, identity-bound runtime can consume
an immutable synthetic application, governed configuration and a synthetic
secret, demonstrate health and authorization separation, and return to an
accepted lifecycle state. It is not workload/product deployment approval,
database integration, full operations, security certification or readiness.

This decision supersedes the **UNDECIDED** selection in the historical
[G2 proposal](../evidence/G2_TERMINAL_STAGE3_GOVERNANCE_DECISION_DRAFT.md).
It does not edit that proposal, the [terminal disposition](../evidence/G2_TERMINAL_DISPOSITION.json),
the [sealed root](../evidence/G2_TERMINAL_FINAL_VERIFICATION.json), the historical
[mission register](../mission-gate-status.json), or any G2 source/evidence.
Historical `stage3Authorized: false` remains accurate at its capture time.
The current [G3 register](governance-status.json) distinguishes design authority
from technical execution authority; neither is product rollout authority.

## Selected design

[G3_PRIVATE_APPLICATION_SUBSTRATE_DESIGN](G3_PRIVATE_APPLICATION_SUBSTRATE_DESIGN.md)
selects an isolated internal Azure Container Apps **workload-profiles**
environment running only its Consumption profile. The workload is synthetic,
not a product. Its architecture borrows the newer landing-zone's Canadian,
private, digest-bound shape, not the legacy default product app array.

Only design and evidence documentation are delivered by this packet. No
template, application, image, identity, secret or network is instantiated.
The design explicitly separates its required future runtime proofs from its
present document checks. G3 has not passed.

## Boundaries

- Synthetic application/configuration/secret values and technical proof
  telemetry only; no copied production records or real credentials.
- Canada Central; no second region, DNS/product cutover or customer traffic.
- New platform integration-test resource group; no UE/Cora resource groups.
- Dedicated G3 identities; no reuse or modification of G2 identities/roles.
- Existing G2 artifacts and evidence remain retained; consumed authorities
  cannot be replayed.
- Minimum proof telemetry only; no SLO/SLA, on-call, full alerts, backup/DR or
  production scale claim.
- No production database/storage integration, external AI or public origin.
- Future named data and operations gates remain unnumbered and unauthorized.

## Next authority

The [execution-authority draft](G3_PRIVATE_APPLICATION_SUBSTRATE_EXECUTION_AUTHORITY_DRAFT.md)
is deliberately **NOT APPROVED / NOT EXECUTABLE**. Artifact digests, executable
sources, exact operator principals/roles, quota/region capability, provider
schemas, final cost and transaction what-if must be bound before requesting
approval. No implementation or Azure preflight is authorized by this document.
