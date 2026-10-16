# G2_TERMINAL_ADJUDICATION - separate authority proposal

Mission `NZ-20261008-INFRA-001`,gate `G2_PRIVATE_CONTROL_PLANE`.
**PROPOSED / NOT AUTHORIZED / NOT EXECUTED**.
This packet does not declare G2 PASS or authorize Stage3.

## Current accepted state

- Stage1 discovery PROVEN.
- Stage2A private ORAS delivery PROVEN.
- Local deterministic OCI contract PROVEN.
- Stage2A builder artifact production PROVEN.
- Stage2B runtime identity boundary PROVEN.
- Protected steady state16,zero transient resources.
- Overall G2 FAIL. UE/Cora INFRA_NO_GO unchanged.

Source of reconciliation:
[G2_STAGE2B_EVIDENCE_CHAIN.json](G2_STAGE2B_EVIDENCE_CHAIN.json).
Proof root:
[G2_STAGE2B_FINAL_VERIFICATION.json](G2_STAGE2B_FINAL_VERIFICATION.json).
Prior roots remain immutable historical authority,not current plan hashes.

## Proposed read-only adjudication scope

Once explicitly authorized,perform no deployment or registry mutation:

1. Verify all retained current/prior roots,source/executed-script/template/
   parameter bindings and consumed execution records. Retain historical failed
   and superseded evidence; do not recast it as successful execution.
2. Reconcile the four stage dispositions and exact artifact lineage. Confirm
   private tooling source-to-target equivalence and synthetic local-to-remote
   manifest/payload equivalence. No additional push/import/pull execution.
3. Capture fresh read-only ARM estate and both-identity assignment census.
   Compare protected16,zero transient resources,private endpoint/NIC/DNS/zone
   group,target public Disabled/bypass None/admin disabled,source unchanged,
   importer roles absent,repository conditions and identity separation.
4. Review effective boundary evidence: builder tooling read/denied write and
   synthetic-health push; runtime synthetic-health read/denied write and
   tooling denied read/write. Distinguish data-plane proof from static RBAC.
5. Map each original G2 requirement to exact retained evidence and identify
   gaps/limitations requiring explicit risk disposition. Stage proofs do not
   automatically prove all institutional controls or any product readiness.
6. Return a separate terminal ruling with evidence links:
   `G2_PRIVATE_CONTROL_PLANE = PASS | PASS_WITH_LIMITATIONS | FAIL`,
   only against the explicitly accepted G2 acceptance contract.
   Maintainers retain architecture/risk/production decisions.

## Required terminal outputs

`CONCURRENCY_CHECKPOINT`
`G2_EVIDENCE_CHAIN_RECONCILIATION`
`G2_REQUIREMENT_TO_EVIDENCE_MATRIX`
`IMMUTABLE_ARTIFACT_LINEAGE`
`IDENTITY_BOUNDARY_DISPOSITION`
`PRIVATE_NETWORK_STEADY_STATE`
`EXCEPTION_CLOSURE_REGISTER`
`RESIDUAL_GAPS_AND_LIMITATIONS`
`G2_PRIVATE_CONTROL_PLANE`
`UE_INFRA_DISPOSITION`
`CORA_INFRA_DISPOSITION`
`NEXT_GATE_AUTHORITY_REQUIRED`

## Restrictions

No new VM/CSE,execution on builder,runtime identity attachment,credential
creation,package installation,network/DNS/firewall/RBAC/registry settings,
public bypass,reimport,artifact mutation,product-domain change or rollout.
No broad security/DR/reliability/tenant-isolation/audit/production-readiness
claim beyond its separately proven requirements.
No Stage3 until terminal G2 adjudication explicitly authorizes its scope;
a favorable narrow G2 ruling alone is not application rollout permission.

## Outstanding authority decision

Maintainer must explicitly authorize this read-only terminal adjudication and
confirm its acceptance contract. Until then,STOP at the frozen Stage2B proof.
