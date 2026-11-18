# tooling/runtime-governance

Release-time governance scripts. Designed to be invoked from CI.

| Script | Purpose |
|---|---|
| `check-env.mjs` | Validate a safe release ID, full Git SHA, real SHA-256 manifest digest, ISO build timestamp and explicit environment class. |
| `check-pilot-boundaries.mjs` | Refuse a build whose pilot boundary configuration violates the structural pilot-isolation contract. |
| `generate-attestation.mjs` | Generate the canonical runtime attestation schema and exclusively create `proof-artifacts/attestations/<releaseId>/<class>.json`. Hash the cited local artifact bytes. |
| `write-evidence.mjs` | Validate the canonical attestation and recheck its cited bytes, then exclusively append a canonical ledger record containing the full attestation to `proof-artifacts/evidence/<date>/<id>.json`. |
| `policies/` | Doctrine policy fixtures loaded into the registry at startup. |

These Node ESM entry points reuse the consumer schemas from
`@nzila/runtime-attestation` and `@nzila/governance-runtime` through the installed
`tsx` loader. Run them after the repository's frozen dependency installation.

Attestation generation additionally requires `NZILA_PRODUCT`,
`NZILA_ATTESTATION_ISSUER`, `NZILA_ATTESTATION_RATIONALE`, and a comma-separated
`NZILA_ATTESTATION_EVIDENCE` list of existing local file paths or `file:` URLs.
Remote URLs must first be captured as actual local artifacts by an authorized
collector; a URL string is not evidence content. An unspecified verdict remains
`unverified`. Set an explicit verdict only for the checks actually performed.

The workflow records actual manifest and check-log digests. Its deployment-class
record is `partial`: offline CI does not establish an application deployment or
live environment acceptance. The local ledger is append-only by exclusive file
creation; it does not establish trusted signing or immutable remote storage.
