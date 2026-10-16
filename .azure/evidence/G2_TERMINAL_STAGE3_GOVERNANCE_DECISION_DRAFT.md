# Governance decision proposal: WHAT IS STAGE3?

Mission `NZ-20261008-INFRA-001`.
**PROPOSAL ONLY / UNDECIDED / NO EXECUTION AUTHORITY**.

## Starting boundary

[Terminal G2 disposition](G2_TERMINAL_DISPOSITION.json): private control-plane
foundation **PASS**. Protected estate16,unsafe residuals absent.
UE/Cora remain **INFRA_NO_GO**. No application rollout or Stage3 authorized.
The G2 ruling does not define Stage3 implicitly and does not override any
product programme gate,recording restriction,or institutional-control gate.

## Decision required

Maintainers must answer **WHAT IS STAGE3?** and explicitly select one bounded
scope or a named,justified alternative. None is selected by this draft.

| Candidate scope | Possible objective | Must not be inferred |
|---|---|---|
| Application substrate | Define and prove private runtime hosting/configuration/identity foundation without product rollout | G2 synthetic VM proves a production application substrate |
| Workload deployment | A separately approved synthetic or named product workload with exact immutable artifact/runtime contracts | Permission to deploy UE/Cora or production data |
| Observability/operations | Establish scoped telemetry,alerts,ownership,runbooks and operational proof | Current private registry checks prove monitoring/SLA |
| Data-plane integration | Prove named database/storage/secrets/connectivity contracts with approved data classifications | G2 proves database access or secret lifecycle |
| Another bounded infrastructure gate | Name its controls and measurable acceptance proofs,including security hardening if selected | Existing draft phase numbers define its scope automatically |

## Required decision packet before implementation

- Name the selected scope and explicitly exclude the alternatives not included.
- Map dependencies to the terminal G2 ruling and any product/institutional
  restrictions;keep UE/Cora NO_GO unless their own required proofs permit change.
- Define subscription/RG/environment/product boundaries and Canada residency.
- Define exact resources/identities/role scopes/private network flows and
  immutable executable inputs. No `latest` production artifact contract.
- Define data permitted/prohibited,synthetic versus production,whether any
  external AI/source service is involved,and prior approval dependencies.
- Set measurable acceptance checks and required evidence shapes for each claim.
- Specify rollout/cutover authority separately from substrate/read-only design.
- State allowed mutations,maximum executions,cost/capacity profile,abort rules,
  transaction ownership,rollback/teardown,and retained steady-state inventory.
- Assign accountable maintainer/risk owner and decide independently whether
  any Stage3 technical execution authority exists.
- Preserve the concurrency protocol and complete G2 history;do not repurpose
  consumed G2 authorities or delete retained proof artifacts.

## Default pending decision

`STAGE3_DEFINITION = UNDECIDED`
`STAGE3_AUTHORIZED = NO`
`APPLICATION_ROLLOUT_AUTHORIZED = NO`
`UE_INFRA = INFRA_NO_GO`
`CORA_INFRA = INFRA_NO_GO`

No deployment,RBAC/network/data/artifact/product change is authorized by this
document. The next action is human governance decision,not technical execution.
