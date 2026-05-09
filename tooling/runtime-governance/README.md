# tooling/runtime-governance

Release-time governance scripts. Designed to be invoked from CI.

| Script | Purpose |
|---|---|
| `check-env.mjs` | Validate that `NZILA_RELEASE_ID`, `NZILA_COMMIT_SHA`, `NZILA_MANIFEST_HASH`, `NZILA_BUILT_AT`, `NZILA_ENVIRONMENT_CLASS` are all present. |
| `check-pilot-boundaries.mjs` | Refuse a build whose pilot boundary configuration violates the structural pilot-isolation contract. |
| `generate-attestation.mjs` | Generate a runtime attestation envelope for the current release and write it to `proof-artifacts/attestations/<releaseId>/<class>.json`. |
| `write-evidence.mjs` | Append a governance evidence record to `proof-artifacts/evidence/<date>/<id>.json`. |
| `policies/` | Doctrine policy fixtures loaded into the registry at startup. |

All scripts are pure Node ESM and depend only on the standard library.
