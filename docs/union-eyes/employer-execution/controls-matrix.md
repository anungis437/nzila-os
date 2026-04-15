# Employer Execution Controls Matrix

| Control | Objective | Implementation |
|---|---|---|
| Org scope | Prevent cross-org leakage | organization_id on all execution tables + org-filtered APIs |
| Runtime profile | Enable mode without app fork | employer_execution_profiles with profile_code=contractor_execution |
| Feature gating | Contract-aware commercial control | employer_execution* feature keys in org_entitlements |
| Deterministic calc | Replayable, stable payroll outputs | persisted snapshot + engineVersion + calc trace hash |
| Rule lineage | Explain CBA source used | cba_rule_versions.source_hash + rule-resolution trace |
| Validation gates | Block bad inputs before official run | timesheet validation summary + compliance blocking events |
| Evidence seal | Tamper-evident outputs | employer_execution_artifacts + evidence_seal artifact |
| Replay variance | Detect drift/regression | employer_execution_replays diff_json + diff_hash |
