# Exact-source staging prerequisite receipt

Candidate: `86c328e3e1fdd76e6ba11e85237b103d31e2836d`.

The [measured local export receipt](evidence/ue-v2-candidate-export-20261110.json)
records the current dependency-bound plan and emitted restore file hashes.
Pinned PostgreSQL 16 installed the plan, verified 23,849 catalog objects and the
native privilege boundary, returned receipt-backed NOOP, then restored the
actual emitted dump into another empty database and repeated those checks.
Both restore and privilege checks passed, with no privilege mismatches.

This is a local export prerequisite. It does not establish Azure database
installation, application sessions, deployed tenant isolation, delivery,
telemetry, recovery or STAGING_GO. Use only these exact hashed artifacts for
the source-bound private restore after main admission and governed foundation
deployment. Preserve an unexpected target state rather than overwriting it.
