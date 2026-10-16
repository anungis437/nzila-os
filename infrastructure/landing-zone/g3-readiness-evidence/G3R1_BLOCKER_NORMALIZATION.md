# G3R1 local normalization — PASS

This supersedes interpretation only. [The historical readiness packet](./G3_EXECUTION_READINESS.json), Azure ledger, raw responses, prices and G2 source hashes remain byte-identical. [Recovery accounting](./G3R1_AUTHORITY_RECOVERY.json) binds all prior evidence hashes.

## Capacity normalization

Pre-deploy: providers, Canada Central types, managed environment count 4/20 and network headroom are captured. The visible inherited deny policy targets West Europe, not Canada Central; no deny assignments were returned. This is a scoped read-only check, not a complete effective-policy guarantee.

Consumption cores are **POST_ENVIRONMENT_CREATE_PRE_WORKLOAD_ACTIVATION**, not a pre-environment root blocker. Future sequence only: authorized empty environment -> query quota -> confirm 0.25 vCPU -> separately authorize activation. No step executed.

UAMIs use **ENTRA_DIRECTORY_OBJECT_CAPACITY**, not regional ACA compute. Captured Graph beta used=1183, total=500000; adding two gives 1185, below the 98% threshold. This is a refreshable snapshot, not a reservation. Creation throttles remain separate.

Exactly two frozen identities: platform pull (None) and runtime (Main). The attachment labels one slot BUILD; that label is retained for capacity accounting, but its role binding must be reconciled with recovered source authority. No third identity or artifact-writer role is invented or assigned to the platform pull identity.

## Historical authority accounting

33 landing-zone revisions and 76 historical blobs were inspected within all locally reachable refs. Frozen G3 package: NOT_FOUND. Seven required modules, zero recovered; original seven path names are unknown and require the authority manifest. Controllers: NOT_FOUND. Sealed G2 terminal packet: NOT_FOUND. Qualified image source: BLOCKED.

Committed Node and Go health sources exist but lack an exact G3 manifest binding. They are supporting source candidates, not substituted qualified artifacts. No qualifying historical artifact was extracted; no replacement modules/controllers were created. Absence is bounded to searched reachable history, not remote or dangling objects.

## Operator comparison

| Candidate               | Principal ID                         | Captured grants | G3 fit                                                                                   |
| ----------------------- | ------------------------------------ | --------------- | ---------------------------------------------------------------------------------------- |
| nzila-os-deploy-prod    | 52f8fa31-c000-4459-aa75-0f78a2f72b8c | 7               | NOT_PREFERRED;existing environment/deployment duties exceed isolated synthetic mission   |
| nzila-os-deploy-staging | 66ec0cdf-ff35-42bd-9104-f424f7c8a455 | 6               | NOT_PREFERRED;existing environment/deployment duties exceed isolated synthetic mission   |
| nzila-os-deploy-demo    | 4d38a271-c8e8-4994-bd46-ed91b2d65700 | 3               | NOT_PREFERRED;existing environment/deployment duties exceed isolated synthetic mission   |
| nzila-os-deploy-pilot   | 6fd23298-4708-47ce-88cb-a813765ca3d0 | 3               | NOT_PREFERRED;existing environment/deployment duties exceed isolated synthetic mission   |
| nzila-os-build          | bfa4a851-696a-4d3f-927b-5fb1526f79f2 | 1               | PREFERRED_CANDIDATE_FOR_G3A_FEDERATED_ARTIFACT_OPERATOR;not approved or fully privileged |

Recommended, not appointed: bfa4a851-696a-4d3f-927b-5fb1526f79f2. The build principal's captured legacy registry grant has a narrower direct-assignment footprint than deployment identities. It still has excess legacy AcrPush and lacks G3 grants. Effective group/PIM permissions require verification. Lifecycle owner and separate human approver remain HUMAN_BINDING_REQUIRED.

## Network contract

[The design-only network contract](./G3R1_NETWORK_CONTRACT.json) fixes CIDRs, both peering sides, default UDR to 10.90.0.4, private endpoint routing, Azure-provided DNS, NSG/probe rules, required firewall groups and narrow proposed grants. G2 peering, ACR-zone link and firewall changes require separate human authority.

Internal ACA has no ACA private endpoint; its returned defaultDomain/staticIP supply the internal apex/wildcard DNS zone. Private ACR zone is reused; a new KV zone and internal ACA zone are proposed. Selected telemetry is Log Analytics over AzureMonitor TCP443. Source-specific builder tooling destinations remain downstream blocked.

## Deterministic cost ceiling

[Captured CAD meter model](./G3R1_COST_MODEL.json) includes two new private DNS zones, one KV PE, one standard LB, documented platform egress IPv4, compute, request/DNS/log and processing quantities. Scenario assumptions are proposals, not measured usage or approved budgets. No free allowance is assumed.

| Scenario                  | Known CAD subtotal | Complete total |
| ------------------------- | ------------------ | -------------- |
| G3_PROOF_RUN_COST         | 2.048393           | UNRESOLVED     |
| G3_IDLE_MONTHLY_COST      | 43.184824          | UNRESOLVED     |
| G3_LOW_USAGE_MONTHLY_COST | 45.146866          | UNRESOLVED     |
| G3_EXPECTED_MONTHLY_COST  | 52.929995          | UNRESOLVED     |
| G3_UPPER_BOUND_SCENARIO   | 170.73509          | UNRESOLVED     |

Captured Global Intra-Region peering ingress/egress meters now price both ends of same-region transit; local KV PE traffic is not counted as peered. Ordinary vault operations, nonreplicated ACR excess storage, applicable platform/public egress and qualified builder costs remain exact unknowns. Known components do not form a complete upper bound. The B1s/E4 builder example is a non-authoritative proxy excluded from totals.

Priced-component recommendation: 9.022101 CAD, including proof, one-hour known rollback allowance, one GB diagnostic logs and 50% buffer. **Not an executable ceiling.** RECOMMENDED_EXECUTION_CEILING_CAD=UNRESOLVED_FULL_CEILING_REQUIRES_UNKNOWN_COMPONENTS; HUMAN_APPROVED_EXECUTION_CEILING_CAD=UNBOUND.

## Root blockers and downstream deliverables

| Root   | Type                                     | State                       | Exact input                                                                                                                                                                                           |
| ------ | ---------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ROOT-1 | FROZEN_SOURCE_AUTHORITY                  | BLOCKING                    | Exactseven-module manifest+historicalsource paths/commits/digests;G3A/G3B controllerauthority;qualifiedimage source/buildcontext/Dockerfile/treeDigest/manifestbinding;sealedG2 terminalpacket/rootID |
| ROOT-2 | ACCOUNTABLE_PRINCIPAL_AND_HUMAN_APPROVER | BLOCKING                    | Humanbind lifecycleowner,approve/refuse recommendedbuildprincipal and separatehumanapprover;verifyeffectivepermissions and exactproposedgrants/controlledbootstrap                                    |
| ROOT-3 | NETWORK_MUTATION_AUTHORITY_G2_PEERING    | BLOCKING_FOR_EXECUTION_ONLY | Separatehumanapproval for bothpeeringdirections,G2 ACRDNSlink,firewallrulechanges and sealedG2 terminalreconciliation;localdesign isnot permission                                                    |
| ROOT-4 | HUMAN_COST_CEILING                       | BLOCKING_FOR_EXECUTION      | Bindremainingmeter facts/quantities and sourcequalifiedbuilder costs,thenapprove completeproof/rollback/diagnostic ceiling+50%buffer;UNBOUND isnotzero                                                |

ROOT-5 directory capacity is closed by the snapshot; ACA cores are POST-CREATE-GATE-1. Executable package, qualified image and local Bicep/controller build are downstream ROOT-1, not independent blockers.

## Terminal state

G3R1_GATE=PASS; AZURE_EXECUTION_READINESS=BLOCKED_PENDING_EXACT_HUMAN_OR_SOURCE_INPUTS.
G3A=NOT_AUTHORIZED; G3B=NOT_AUTHORIZED. All resource/RBAC/registry/G2 mutations are zero. No identity, environment, RG, peering, firewall/DNS change, image build/push or controller execution occurred. UE lane remains untouched.

## Validation evidence

242 combined offline Node tests passed: 75 existing G3 and 167 G3R1 tests. Per-blob historical digests, original evidence/G2-source preservation, capacity doctrine, CIDR/egress/DNS contracts, captured-meter provenance, unknown costs, unbound human ceiling, root/downstream separation and deterministic outputs are covered. Twelve G3R1 and fifteen prior PowerShell fail-closed cases passed without Azure calls. Exact commands/results are in the JSON `validation` section; local syntax, formatting, recovery/output `--check` and documentation validation passed.
