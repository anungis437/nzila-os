# Replay And Audit Model

## Replay Modes
- exact: same engine version and rule references.
- simulated: newer engine version and/or changed rule path.

## Diff Model
- changed: boolean
- fieldsChanged: [{ field, before, after }]
- summary: human-readable explanation
- diffHash: sha256 hash for tamper detection

## Audit Path
1. Original payroll run captures calc trace and snapshot hash.
2. Replay run executed with selected mode/version.
3. Diff generated and persisted in employer_execution_replays.
4. Replay diff artifact generated for evidence package.
