# AI Incident Playbook: Data Poisoning

## Trigger Conditions

- Drift or quality anomalies tied to specific data batches.
- Suspiciously coordinated content patterns in training or retrieval corpora.
- Evaluation score collapse after ingestion updates.

## Immediate Actions (0-30 min)

1. Halt ingestion pipelines for affected dataset/source.
2. Isolate suspected data partitions and freeze publication.
3. Record lineage pointers (source, checksum, ingestion run IDs).
4. Notify Security, AI, and Platform owners.

## Containment

1. Revert to last known-good dataset index or snapshot.
2. Block compromised connectors/source accounts.
3. Tighten validation thresholds and quarantine rules.

## Eradication and Recovery

1. Remove poisoned artifacts from active indexes/stores.
2. Rebuild indexes from trusted snapshots.
3. Re-run evaluation suites and compare to baseline.
4. Resume ingestion with elevated monitoring.

## Evidence Requirements

- source connector identity
- dataset/version hashes before and after rollback
- evaluation deltas and acceptance thresholds
- remediation PRs and run IDs
