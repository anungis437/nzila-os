# @nzila/runtime-attestation

Runtime attestation envelopes and content-addressable governance evidence ledger records.

See:
- [docs/categories/historical-archive/archive/iterations/nzila-runtime-governance/runtime-attestation-pipeline.md](../../docs/categories/historical-archive/archive/iterations/nzila-runtime-governance/runtime-attestation-pipeline.md)
- [docs/categories/historical-archive/archive/iterations/nzila-runtime-governance/governance-evidence-ledger.md](../../docs/categories/historical-archive/archive/iterations/nzila-runtime-governance/governance-evidence-ledger.md)

## Posture

- Attestations are release-bound and environment-bound. Unbound attestations are rejected.
- Ledger records are append-only and content-addressable. Updates are issued as supersession, never mutation.
- Retention and access classes are required at write time; defaulting is rejected.
- Signing is OPTIONAL in the contract — attestations remain valid as unsigned governance records during the unsigned-attestation phase, with a documented progression to signed attestations.
