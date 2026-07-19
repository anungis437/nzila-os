# Deployment Production Certification (Phase 4A)

- **As of:** 2026-07-03
- **Validator:** `pnpm validate:production-deploy-authority`

## Verdict

```
DEPLOYMENT AUTHORITY POLICY: CLOSED
DEPLOYMENT PRODUCTION CERTIFICATION: BLOCKED
```

Deploy-authority **policy** is closed (Phase 4B): `pnpm validate:production-deploy-authority`
passes. Full production **certification** remains BLOCKED on infra isolation and
external proof (below). The two are distinct: policy bounds *who/how* may promote;
certification requires the environment itself to be production-grade.

## Phase 4B policy closure (what changed)

- `console` / `control-plane` set `prodPromotionEligible: false` — no longer
  production-promotable via the tier-1 pipeline (they deploy internally).
- `resolve-deploy-apps.ts` production branch no longer admits `internal-only`.
- `canary-deploy.yml` no longer offers `console` as a choice.
- Expired rollback exceptions replaced by structured, non-expired pilot-production
  exceptions in `governance/release/production-exceptions.json`
  (owner + expiry 2026-09-30 + scope + rollback plan + explicit "PILOT, not
  full-production" limitation, `PROVISIONAL_PENDING_REATTESTATION`).
  Production-eligible set is now `{union-eyes, web, partners}` (all PILOT).

## What is already strong (evidence)

`deploy-production.yml` promotes from a **verified staging artifact**, not a raw
branch rebuild:

- Resolves a source staging run (`source_run_id`) and downloads
  `staging-build-artifacts`.
- Verifies `artifact-manifest.json`, `sbom.json`, and `release-attestation.json`.
- Emits build provenance with `subject-digest: sha256:...`.
- App set is filtered through `scripts/release/resolve-deploy-apps.ts` before any
  credentialed step.
- Pre-deploy gates: release-tag shape + main-containment, governance check,
  change-window, contract tests, migration-safety, SLO gate.

## Blockers (must close before certification)

1. ~~console / control-plane production-eligible~~ — **CLOSED (4B).**
2. ~~expired exceptions~~ — **CLOSED (4B)** via structured non-expired exceptions.
3. ~~canary offers console~~ — **CLOSED (4B).**
4. ~~OSB-2 shared prod/staging infra~~ — **RESOLVED (Phase 5, az-verified):**
   production runs in dedicated `nzila-canada-prod-rg` / `nzila-canada-prod-env`
   (see [production-staging-isolation-certification.md](production-staging-isolation-certification.md)).
5. **App-deploy digest pinning:** union-eyes prod running image **DIGEST-PINNED**
   (Phase 5C live write, revision 0000174, traffic 100). web/partners images
   digest-pinned but run on **staging** (production-on-staging). See
   [runtime-artifact-identity-evidence.md](runtime-artifact-identity-evidence.md).
6. ~~OIDC federation existence~~ \u2014 **PROVEN (Phase 5):** `OIDC READY`
   (see [oidc-migration-certification.md](oidc-migration-certification.md)).
7. **Pilot exceptions are PROVISIONAL:** require platform-ops human re-attestation
   before 2026-09-30 (they formalize the existing live arrangement, not a new approval).

## Rollback

`deploy-production` supports image-tag rollback; rollback should reference a
previous known-good **digest**, not a mutable tag. Tracked with blocker #5.
