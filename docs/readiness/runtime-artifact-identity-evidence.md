# Runtime Artifact Identity Evidence (Phase 5)

- **As of:** 2026-07-03 · verified via Azure CLI.

## Verdict

```
PARTIALLY DIGEST-PINNED  (union-eyes prod DIGEST-PINNED; web/partners on staging)
```

**Update (Phase 5C):** the union-eyes production running revision is now
**DIGEST-PINNED** via a live, verified Azure write — its digest gap is closed.
web/partners images are digest-pinned but run on staging (no isolated prod runtime).

## union-eyes — digest-pin CLOSED (live-verified)

- Re-pinned `nzila-os-union-eyes-prod` from `tag:6262e38…` to
  `@sha256:b919ccd00cbf73f493fdd24a1836b2f0770b752466a66c0853ed6af12f5dda1b`
  (same image content).
- New revision `nzila-os-union-eyes-prod--0000174`: Running, **traffic=100**, image DIGEST.
- `app.unioneyes.app/api/health` stayed **HTTP 200** throughout the swap (no downtime).
- Command: `az containerapp update -n nzila-os-union-eyes-prod -g nzila-canada-prod-rg --container-name nzila-os-union-eyes-prod --image <repo>@sha256:<digest>`.

## Evidence (prior state, pre-fix)

- Running prod image (`az containerapp list`): `nzila-os-union-eyes-prod` →
  `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:6262e38ce7f09d1dc04ea9480b49bf236c37bf6a`
  — a commit-SHA **tag**, not `@sha256:` digest.
- Staging apps (web, partners, etc.) largely run **digest-pinned** `@sha256:` images.
- `deploy-production.yml` consumes a verified staging artifact with
  `artifact-manifest.json` + SBOM + release-attestation + `subject-digest: sha256:…`
  (promotion pipeline digest identity is PROVEN).

## Gap → remediation (repo-side, no Azure write needed)

The running prod revision should be pinned to the **immutable digest**, not a
mutable tag. Remediation options:
1. Have the production deploy resolve the pushed image digest (`az acr repository show-manifests`
   / `docker buildx --provenance`) and `az containerapp update --image <repo>@sha256:<digest>`.
2. Enforce in `deploy-production.yml`: reject a tag-only image reference for prod.
3. Add a validator that fails if a prod-env container app runs a non-`@sha256` image.

## Rollback

Rollback should reference a previous known-good **digest/revision** (not a tag).
`deploy-production.yml` supports image rollback; wire it to digests.

## Note on permissions

Changing the running revision image is a **write** operation; the current operator
(`support@onelabtech.com`) is read-oriented and did not perform it. This is a
`PERMISSION-LIMITED` remediation for a deploy-identity/owner, not an external unknown.
