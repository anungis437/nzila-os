# V2 scheduled-job provider name correction

Governed rollout [43057378878](https://github.com/anungis437/nzila-os/actions/runs/43057378878)
passed its plan, image attestations, reviewed what-if, change window and fresh
drift gates. The application revision reached ready on the attested source
`8438da0bffd2e5e90084bf9d965533ffe94c5a8a`, but Azure rejected the deadline
job's 34-character name. The overall rollout failed and does not qualify staging.

The legacy job suffix now receives an explicit prefix budget within Azure's
32-character limit. The staging deadline job becomes
`nzila-ue-v2-stagi-cron-deadlines` (32 characters). All 12 manifest jobs remain;
all names are unique and within the provider limit. The other staging names
and the existing production names are unchanged. No cadence, route, image,
credential, permission, application behavior or database schema is changed.

The Bicep compiled without warnings, all 38 existing release/deployment safety
tests passed, and read-only Azure ProviderNoRbac validation of the complete
normal deployment succeeded after the correction. The
[provider receipt](evidence/ue-v2-job-name-provider-contract-20261111.json)
preserves both the failure and the corrective validation. Actual successful
rollout and deployed runtime qualification remain mandatory.

The already-installed private PostgreSQL database and its verified synthetic
personas are preserved. The corrected candidate must requalify that existing
schema and restricted credential boundary; it must not rerun the empty-target
restore or discard installed data.
