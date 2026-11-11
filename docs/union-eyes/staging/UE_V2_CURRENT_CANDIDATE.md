# Exact-source staging prerequisite receipt

Candidate: `7d67bcd59ee3f2441d41cde5adbd8769bda85a96`.

The [measured local export receipt](evidence/ue-v2-candidate-export-7d67bcd5-20261111.json) records the exact committed source, dependency-bound plan and emitted file hashes. Pinned PostgreSQL 16 installed all 6,255 statements for 771 tables, verified 23,849 catalog objects and native privilege boundaries, returned receipt-backed NOOP, restored the emitted dump into another empty local database and repeated those checks. Both restore and privilege checks passed without mismatches.

The canonical catalog digest remains `f42fdab7ad9ff4ad032de0692fe51527228e6703708adc9595cb267b73805e30`. SQL statements are byte-identical to the installed preceding plan; source commitment metadata changed because private API error handling changed. Preserve the actual Azure database and its original installation receipt. Requalify its native catalog and restricted credentials against this candidate; do not repeat empty-target restore, reseed fixtures or relabel the historical receipt.

[Real staging diagnostics and source repairs](UE_V2_REAL_ENTRA_RUNTIME_REPAIR.md) explain the failed case write after two real provider sessions. [The job-name correction](UE_V2_JOB_NAME_PROVIDER_REPAIR.md) fixes the observed deployment rejection. These are source prerequisites, not current-candidate runtime acceptance. Full CI, main admission, a new source-attested image, fresh reviewed normal rollout and deployed qualification remain required. Staging remains NO_GO; production and institutional authority are outside scope.
