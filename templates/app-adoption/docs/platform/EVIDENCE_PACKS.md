# Evidence Packs

Evidence packs are tamper-evident bundles produced by CI that prove
governance controls were evaluated and passed at a specific commit.

## Pack Structure

```
evidence/
  pack.json     # Draft → Sealed manifest of collected artifacts
  seal.json     # SHA-256 Merkle root + HMAC seal
```

### pack.json

```json
{
  "version": "1.0.0",
  "status": "sealed",
  "createdAt": "2025-07-20T12:00:00Z",
  "sealedAt": "2025-07-20T12:00:05Z",
  "commitSha": "abc1234",
  "runId": "12345678",
  "artifacts": [
    {
      "name": "SBOM",
      "type": "sbom",
      "sha256": "...",
      "collectedAt": "2025-07-20T12:00:01Z"
    }
  ]
}
```

### seal.json

```json
{
  "seal": "<hmac-sha256>",
  "merkleRoot": "<sha256>",
  "sealedAt": "2025-07-20T12:00:05Z",
  "commitSha": "abc1234",
  "runId": "12345678",
  "artifactCount": 3
}
```

## Lifecycle

1. **Collect** — `pnpm evidence:collect` gathers CI output hashes into `pack.json` (status: `draft`).
2. **Seal** — `pnpm evidence:seal` computes a Merkle root over artifact hashes, signs with `EVIDENCE_SEAL_KEY`, writes `seal.json`, and sets status to `sealed`.
3. **Verify** — Downstream audit tools re-compute the Merkle root and compare against the HMAC seal.

## Required Environment

| Variable | Purpose |
|----------|---------|
| `EVIDENCE_SEAL_KEY` | HMAC key for sealing. Store in GitHub secrets. |
| `GITHUB_RUN_ID` | Auto-set by GitHub Actions. |

## Verification

```bash
# Recompute seal locally (requires EVIDENCE_SEAL_KEY)
npx tsx scripts/evidence/seal.ts

# Or use NzilaOS verify-pack
npx tsx -e "
  import { verifySeal } from '@nzila/os-core/evidence/seal';
  import seal from './evidence/seal.json';
  console.log(verifySeal(seal));
"
```

## Retention

Evidence packs should be stored as GitHub Actions artifacts with a
retention period of at least 90 days. For compliance-critical apps,
archive packs to Azure Blob Storage with immutable retention policies.
