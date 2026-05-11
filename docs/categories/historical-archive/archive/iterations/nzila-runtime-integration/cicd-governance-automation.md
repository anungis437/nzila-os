# CI/CD Governance Automation

> **Status:** Canonical runtime integration · **Layer:** CI/CD execution · **Inherits:** [live-runtime-attestation-generation.md](live-runtime-attestation-generation.md), [governance-evidence-emission.md](governance-evidence-emission.md)

## 1. Objective

Make CI/CD a governance-emitting substrate: every build, deploy, and release produces validated governance artifacts as a precondition for promotion.

## 2. Required workflow: `runtime-governance-attestation.yml`

The workflow is added under `.github/workflows/` and runs on every push to `main` and on every pull request that touches `apps/*`, `packages/*`, or `infrastructure/*`. It executes:

1. **Validate doctrine enforcement** — `pnpm --filter @nzila/doctrine-enforcement test`.
2. **Validate governance telemetry contracts** — `pnpm --filter @nzila/governance-telemetry test`.
3. **Validate runtime attestation schema** — `pnpm --filter @nzila/runtime-attestation test`.
4. **Validate environment legitimacy inputs** — `node tooling/runtime-governance/check-env.mjs`.
5. **Validate pilot boundaries** — `node tooling/runtime-governance/check-pilot-boundaries.mjs`.
6. **Generate deployment attestation** — `node tooling/runtime-governance/generate-attestation.mjs --class=deployment`.
7. **Write attestation evidence** — `node tooling/runtime-governance/write-evidence.mjs --from-attestation=...`.
8. **Upload artifacts** — `proof-artifacts/attestations/**` and `proof-artifacts/evidence/**`.

## 3. Failure posture

- A failure in steps 1–3 fails the build (governance contract regression).
- A failure in steps 4–5 fails the build (legitimacy precondition not met).
- A failure in steps 6–8 fails the build (attestation could not be produced).

There is no `continue-on-error: true` for governance steps. A build that cannot produce its governance evidence is not a candidate for deployment.

## 4. Required outputs

CI emits, per build:

- `proof-artifacts/attestations/<releaseId>/deployment.json`
- `proof-artifacts/attestations/<releaseId>/doctrine-compliance.json`
- `proof-artifacts/evidence/<date>/<id>.json` for each governance event
- `proof-artifacts/governance-report.md` — calm, banded summary of the build's governance posture
- `proof-artifacts/runtime-governance-readiness.md` — banded readiness across the integration layers

## 5. Discipline

CI governance must be deterministic, fast, and structurally honest. A green CI badge that conceals a partial verdict is worse than a red badge that surfaces the truth.
