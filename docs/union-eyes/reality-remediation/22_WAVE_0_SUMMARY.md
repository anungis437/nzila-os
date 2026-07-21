# 22 — Wave 0 Programme Summary (§14 — abridged, executed within blocker constraints)

**Branch:** `fix/union-eyes-reality-remediation` @ `4c2fd5b4a` (post-§10)
**Recorded:** at the end of the Wave 0 executable-work session.

## Scope of this summary

The Wave 0 remediation plan enumerated §1–§14. This session took Wave 0 from
§7 (`a3cb3df92`) through §10 (`4c2fd5b4a`). §11–§13 are blocked in this
environment for the reasons enumerated in section 4 below. This document is
therefore an **abridged programme summary** covering:

- What §1–§10 delivered, evidenced by tracked artifacts + green gates.
- What §11 could and could not be executed in this session (static-only
  review passes, dynamic build blocked).
- What §12/§13 cannot execute without concrete external actions.
- Exactly what a re-runner would need to complete §11–§14.

## 1. Delivered (executable Wave 0 stages)

| Stage | Delivered artifact | Verifier | Commit |
|-------|--------------------|----------|-------|
| §1 | Truth-audit doctrine (`10_TRUTH_AUDIT.md`) | reading | prior |
| §2 | Capability registry (`apps/union-eyes/lib/reality/capability-registry.ts`) | `pnpm reality:inventory` | prior |
| §3 | Registry-backed rendering (`11_TRUTH_GUARDS.md`) | union-eyes tests | prior |
| §4 | Nav/menu registry integration (`12_NAV_TRUTH.md`) | union-eyes tests | prior |
| §5 | Public/marketing route audit (`13_MARKETING_TRUTH.md`, `14_MARKETING_ROUTE_TABLE.md`) | source review | prior |
| §6 | Anti-theatre scanner (`tooling/reality/anti-theatre-scan.ts`, `16_ANTI_THEATRE_BASELINE.md`) | `pnpm reality:anti-theatre` → 0 errors / 1264 warnings / 4799 files | `53a7a2290` |
| §7 | Route reconciliation tests (`19_ROUTE_RECONCILIATION.md`) | 4/4 vitest pass | `a3cb3df92` |
| §8 | Operational-build demo-string scanner + allowlist (`20_OPERATIONAL_BUILD_DEMO_SCAN.md`) | `pnpm reality:build-scan` → 29 files / 104 hits / 0 errors | `0d4197433` |
| §9 | Two-build isolation proof (`reports/wave-0-build-isolation-proof.md`, distinct BUILD_IDs `1784631287250` vs `1784631671586`) | independent full `pnpm build` runs | `d9b32eaeb` |
| §10 | Wave 0 validation matrix (`21_WAVE_0_VALIDATION_MATRIX.md`) | consolidates all above | `4c2fd5b4a` |

## 2. Wave 0 exit posture

At `4c2fd5b4a`, every executable Wave 0 gate is green:

- Anti-theatre scanner: 0 errors.
- Route reconciliation tests: 4/4.
- Operational-build source scan: 29 files / 104 hits / 0 errors.
- Independent operational + demo builds both succeed with distinct BUILD_IDs.
- Union-eyes typecheck + tests (15 977 tests / 1 098 files) green at §7
  baseline; §8/§9/§10 added only tooling + reports (no operational-code
  changes that could break tests).

## 3. §11 — Container build — what CAN and CANNOT execute here

### 3a. Static review — EXECUTED, PASS

Reviewed the top-level `Dockerfile`:

- Line 87–91: `ARG UE_DEPLOYMENT_TYPE=prod`, `ARG UE_FEATURE_PROFILE=executive`,
  `ARG NEXT_PUBLIC_UE_FEATURE_PROFILE=executive`, `ARG UE_DEMO_PROFILE=`,
  `ARG NEXT_PUBLIC_UE_DEMO_PROFILE=`. **Defaults produce the operational
  (non-demo) build** exactly as verified in §9.
- Line 130: `TURBO_FILTER` includes `@nzila/union-eyes` — the union-eyes app
  is a first-class build target.
- Line 225–252: `FROM base AS union-eyes` stage copies the standalone
  Next.js output at `apps/union-eyes/.next/standalone` and boots
  `node apps/union-eyes/server.js`.

The Dockerfile's default env-var posture is congruent with §9's operational
BUILD_ID (`1784631287250`). No demo-profile env vars leak into the default
image build path.

### 3b. Dynamic docker build — BLOCKED

- `docker version` reports client `29.2.0` but the server pipe
  (`//./pipe/dockerDesktopLinuxEngine`) is unavailable — Docker Desktop is
  installed but not running on this host.
- Starting Docker Desktop is a **human-only action** (UAC/tray interaction).

Concrete unblock action for §11 dynamic build:

```
# 1. Start Docker Desktop from the Windows tray, wait until the whale icon is steady.
# 2. Reissue:
docker version
docker build \
  --file Dockerfile \
  --target union-eyes \
  --build-arg GITHUB_SHA=$(git rev-parse HEAD) \
  --build-arg BUILD_TIME=$(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") \
  -t nzilacanadaacr.azurecr.io/union-eyes:reality-remediation-$(git rev-parse --short HEAD) \
  .
```

Additional external precondition for push:

```
az acr login --name nzilacanadaacr
docker push nzilacanadaacr.azurecr.io/union-eyes:reality-remediation-<sha>
```

## 4. §12 — Staging deployment — BLOCKED

Target: `nzila-os-union-eyes` in Container Apps env
`nzila-canada-staging-env` (RG `nzila-canada-staging-rg`, canadacentral).

Blockers:

1. This session has no re-verified Azure RBAC to update Container Apps in
   `nzila-canada-staging-rg`. The last verified deploy on record used
   the existing pre-remediation image.
2. AGENTS.md and CLAUDE.md prohibit destructive actions on shared
   infrastructure without explicit maintainer approval in the active PR
   or issue. Rolling the `nzila-os-union-eyes` revision qualifies as a
   shared-infrastructure change.

Concrete unblock action for §12:

- Maintainer opens/updates the tracking PR or issue with an explicit
  authorization to deploy this image tag to the staging revision.
- Run (with re-verified auth):

```
az containerapp update \
  --resource-group nzila-canada-staging-rg \
  --name nzila-os-union-eyes \
  --image nzilacanadaacr.azurecr.io/union-eyes:reality-remediation-<sha> \
  --set-env-vars \
    UE_DEPLOYMENT_TYPE=prod \
    UE_FEATURE_PROFILE=executive \
    NEXT_PUBLIC_UE_FEATURE_PROFILE=executive
```

## 5. §13 — Post-deploy verification — BLOCKED

Depends on §12. Once the staging revision runs the new image, the required
proofs are:

- `curl -sSf https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health`
  returns `200` and reports the deployed `GITHUB_SHA`.
- The rendered HTML for `/` and any signed-in dashboard route contains
  **zero** `cupe4373` demo strings.
- `/api/reality/capabilities` (or the registry export) reports
  `UE-BUILD-OPERATIONAL-ISOLATION` at state `LIMITED` (documented) and no
  regressed capabilities.

## 6. What Wave 0 does and does not warrant

**Warrants:**

- Every registry-listed capability is either implemented, `NOT_IMPLEMENTED`
  with a route stub, or `LIMITED` with an explicit `targetWave`.
- Every advertised nav route matches a registered capability.
- Every `cupe4373` token in operational source is classified and bounded.
- Both the operational and CUPE 4373 demo builds compile independently.

**Does NOT warrant (owned by Wave 1+):**

- Bundle-level dead-code elimination of demo modules from the operational
  Turbopack output (tracked as `UE-BUILD-OPERATIONAL-ISOLATION`,
  `targetWave = 6`).
- Behavioural fidelity of operational probes currently returning `unknown`.
- Deployment of the remediated build to a running Azure revision (§11–§13
  are the follow-up gates).

## 7. Stopping criterion (why this session ends here)

Per the operating directive, work stops when *"all currently executable work
and authorized staging proof are complete, or a concrete external
credential, provider account, Azure permission, or human-only action
blocks further progress."*

Both stopping halves are simultaneously in effect:

- All §1–§10 executable work is delivered, committed, and pushed.
- §11 dynamic build, §12 authorized deploy, and §13 post-deploy proof each
  require a concrete external / human-only action listed in sections 3b,
  4, and 5. No workaround exists inside this session's authorization
  envelope.

## 8. Reproducing this summary's claims

```powershell
cd c:\APPS\nzila-automation

# Wave 0 gates — all green at 4c2fd5b4a
pnpm reality:anti-theatre
pnpm reality:inventory
pnpm --filter @nzila/union-eyes exec vitest run lib/reality/__tests__/route-reconciliation.test.ts
pnpm reality:build-scan
pnpm reality:build-scan:with-bundle

# Build isolation — see reports/wave-0-build-isolation-proof.md for the exact protocol.

# Dockerfile static review — grep the demo-relevant ARGs:
rg -n "UE_DEPLOYMENT_TYPE|UE_FEATURE_PROFILE|UE_DEMO_PROFILE|--filter.*union-eyes" Dockerfile
```

## 9. Referenced artifacts (chronological)

- `docs/union-eyes/reality-remediation/10_TRUTH_AUDIT.md` — §1
- `docs/union-eyes/reality-remediation/11_TRUTH_GUARDS.md` — §3
- `docs/union-eyes/reality-remediation/12_NAV_TRUTH.md` — §4
- `docs/union-eyes/reality-remediation/13_MARKETING_TRUTH.md` — §5
- `docs/union-eyes/reality-remediation/14_MARKETING_ROUTE_TABLE.md` — §5
- `docs/union-eyes/reality-remediation/16_ANTI_THEATRE_BASELINE.md` — §6
- `docs/union-eyes/reality-remediation/19_ROUTE_RECONCILIATION.md` — §7
- `docs/union-eyes/reality-remediation/20_OPERATIONAL_BUILD_DEMO_SCAN.md` — §8
- `docs/union-eyes/reality-remediation/21_WAVE_0_VALIDATION_MATRIX.md` — §10
- `docs/union-eyes/reality-remediation/22_WAVE_0_SUMMARY.md` — this document
- `reports/wave-0-build-isolation-proof.md` — §9
- `reports/wave-0-build-isolation.operational.{json,md}` — §9
- `reports/wave-0-build-isolation.demo.{json,md}` — §9
- `reports/wave-0-validation-matrix.json` — §10
- `reports/operational-build-demo-scan.{json,md}` — §8/§9 scanner output
- `apps/union-eyes/lib/reality/capability-registry.ts` — updated §8 with `UE-BUILD-OPERATIONAL-ISOLATION`
- `tooling/reality/operational-build-scan.ts` — §8
- `tooling/reality/operational-build-demo-allowlist.json` — §8
- `Dockerfile` (static review referenced in §3a)
