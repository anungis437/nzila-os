# Employer Execution Controls Matrix

| Control | Objective | Implementation |
|---|---|---|
| Org scope | Prevent cross-org leakage | `organization_id` filters + RLS context |
| Runtime profile gating | Keep UE single-product model | `employer_execution_profiles` + entitlements |
| Executable rule lineage | Trace authoritative CBA semantics | typed executable rules with `sourceRuleId` + `path` |
| Deterministic payroll | Ensure replayable outcomes | snapshot hash + item trace hash + run trace hash |
| Canonical severity policy | Remove drift in compliance triage | severity enum: `info` `warning` `error` `critical` |
| Blocking policy | Consistent approval gates | `critical` blocks, `error` requires acknowledgement, `warning/info` non-blocking |
| Lifecycle immutability | Prevent silent mutation of approved records | approval lock + adjustment-by-new-run pattern |
| Replay attribution | Explain why variance happened | structured diff with `causeType` and rule paths |
| Evidence manifest + seal | Strengthen tamper-evident posture | manifest hash + seal artifacts linked to run |
| API thinness | Keep business rules authoritative in service layer | API delegates to service resolution/calc/replay semantics |
