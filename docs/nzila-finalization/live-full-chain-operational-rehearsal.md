# Live Full-Chain Operational Rehearsal

Authority: `master-finalization-index.md`. As of 2026-07-03.

This records the **real** operational chain executed and verified during production
graduation — not a simulated rehearsal. Each step is an attestation in
`proof-artifacts/rollout-attestations/finalization-attestations.jsonl` and is
summarized in `proof-artifacts/operational-proving/proving-manifest.json`.

## The chain (source → production domain)

1. **Build** — `docker buildx --platform linux/amd64 --provenance=false` produced
   `nzila/web@sha256:ec68587d…` and `nzila/partners@sha256:d49e064a…`; union-eyes
   prod re-pinned to `@sha256:b919ccd0…`.
2. **Deploy** — `az containerapp create` for `nzila-os-web-prod` and
   `nzila-os-partners-prod` in `nzila-canada-prod-env`; digest-pinned;
   `provisioningState: Succeeded`.
3. **Verify** — live smoke: `app.unioneyes.app` 200; `www.nzilaventures.com` 200
   (TLS ok); `partners.nzilaventures.com` 200 + `/api/ready` 200 (prod DB).
4. **Cut over** — Cloudflare CNAMEs repointed to prod FQDNs; hostnames rebound;
   managed certs for `www` and `partners` reached `Succeeded`.

## Rollback + restoration

- **Rollback** — union-eyes retained prior known-good revision
  `…--0000173`; deploy-production consumes a digest-verified artifact. Rollback =
  previous known-good revision/digest.
- **Restoration** — prod DB has 30-day PITR + geo-redundant backup; a restore-drill
  server (`nzila-ue-prod-db-drill-20260520`) exists in the prod RG.

See the runbooks: `docs/runbooks/production-rollback.md`, `docs/runbooks/production-incident-response.md`.
