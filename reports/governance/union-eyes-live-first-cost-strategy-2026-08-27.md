# Union Eyes Live-First Cost Strategy

Date: 2026-08-27
Repository: `anungis437/nzila-os`
Baseline SHA: `136426daadc5c2fb53f1e0a1c663245f31baac11`

## Decision

Union Eyes is the only application that must remain fully real and live in the
near term. Other Nzila OS applications should remain source-valid,
test-governed, and deployable on demand, but should not consume always-on
runtime capacity unless they are needed for an active customer, pilot, or
governance proof.

This changes the remaining roadmap priority from "make every app equally live"
to "make Union Eyes production-real while preserving dormant-app reversibility."

## Current Live Evidence

Live Azure inventory was read from subscription `Azure subscription 1 Nzila`
(`5d819f33-d16f-429c-a3c0-5b0e94740ba3`) on 2026-08-27.

### Union Eyes

| Environment | Resource | Current posture |
| --- | --- | --- |
| Staging | `nzila-os-union-eyes-staging` | Running, `minReplicas=1`, `maxReplicas=3`, frontend `1 CPU / 2Gi`, Django sidecar `0.5 CPU / 1Gi` |
| Production | `nzila-os-union-eyes-prod` | Running, `minReplicas=2`, `maxReplicas=6`, frontend `1 CPU / 2Gi`, Django sidecar `0.5 CPU / 1Gi` |
| Production database | `nzila-os-union-eyes-prod-db` | PostgreSQL Flexible Server, GeneralPurpose `Standard_D2s_v3`, zone-redundant HA |
| Production storage | `nzilacanadaprodev` | StorageV2, `Standard_GRS`, public blob access disabled, TLS 1.2 |

Union Eyes is already structurally separate from the broad `gitops-deploy.yml`
matrix. The dedicated Union Eyes workflow owns `-prod`, `-demo`, `-pilot`, and
`-staging` Container Apps.

### Non-Union Eyes Apps

The staging Container Apps environment is Consumption-based and several
non-Union Eyes applications are already cost-contained with `minReplicas=0`
(`flow`, `cfo`, `agrimo`, `cora`, `trade`, `mobility`, `abr`).

The remaining always-on non-Union Eyes staging apps are:

| App | Current floor |
| --- | --- |
| `nzila-os-web` | `minReplicas=1`, `0.5 CPU / 1Gi` |
| `nzila-os-console` | `minReplicas=1`, `0.5 CPU / 1Gi` |
| `nzila-os-partners` | `minReplicas=1`, `0.5 CPU / 1Gi` |
| `nzila-os-zonga` | `minReplicas=1`, `0.5 CPU / 1Gi` |
| `nzila-os-control-plane` | `minReplicas=1`, `0.5 CPU / 1Gi` |
| `nzila-os-platform-admin` | `minReplicas=1`, `0.5 CPU / 1Gi` |
| `nzila-os-orchestrator-api` | `minReplicas=1`, `0.5 CPU / 1Gi` |

Production also keeps `nzila-os-web-prod` and `nzila-os-partners-prod` at
`minReplicas=1`.

## Strategy

### 1. Union Eyes Is The Live Product Surface

Keep Union Eyes real across:

- frontend Container App;
- Django backend sidecar;
- PostgreSQL;
- private Blob storage for documents and evidence;
- Key Vault-backed secrets;
- health/readiness/version probes;
- rollback revision evidence;
- domain and TLS path where customer-facing.

Do not rely on fake storage, demo-only data, local fallbacks, or relaxed
readiness for Union Eyes capability claims.

### 2. Use Lean Live, Not Overbuilt Live

Until there is paid customer traffic or a scheduled external demo, prefer:

- production `minReplicas=1` for Union Eyes if availability requirements allow;
- staging `minReplicas=0` outside active release windows, with explicit warm-up
  before smoke tests;
- one production PostgreSQL authority for real data;
- no extra always-on demo/pilot databases unless a live event requires them;
- no second always-on backend service if the Django sidecar remains sufficient.

Retain production-grade controls, but avoid paying for production-grade
redundancy everywhere before the business need exists.

### 3. Make Union Eyes Storage Explicit

Current code separates document Blob usage (`AZURE_BLOB_CONTAINER`, default
`union-eyes`) from evidence storage (`AZURE_EVIDENCE_STORAGE_CONTAINER`).
Staging currently advertises evidence storage but not `AZURE_BLOB_CONTAINER`.

The preferred topology is:

- one dedicated Union Eyes production storage account or a clearly isolated
  production account namespace;
- private containers for `union-eyes-documents` and `union-eyes-evidence`;
- lifecycle management for old versions/snapshots and archival evidence;
- no public blob access;
- explicit `AZURE_BLOB_CONTAINER` and evidence env vars in UE runtime;
- readiness or capability evidence that verifies the document container without
  turning every storage concern into a hard app-start dependency.

For staging, use lower-cost LRS storage with the same container semantics. Do
not point Union Eyes document storage at generic shared containers without an
architecture decision.

### 4. Dormant Apps Stay Deployable, Not Always-On

For web, console, partners, Zonga, Agrimo, CFO, ABR, Flow, Cora, Trade,
Mobility, Orchestrator, and platform-admin:

- keep CI, typecheck, security, dependency audit, and contract tests green;
- keep Container Apps deployable from immutable images;
- set `minReplicas=0` in non-production unless actively testing that app;
- avoid creating or binding new paid backing services;
- do not pursue readiness closure that requires new runtime topology unless the
  app enters an active pilot or customer path.

Zonga and Agrimo readiness gaps should remain deferred unless they become part
of the active go-to-market path.

### 5. Reduce Default Deployment Churn

`gitops-deploy.yml` currently defaults `apps=all` on main and builds many
non-Union Eyes images even though Union Eyes is owned by a separate dedicated
workflow.

Recommended follow-up:

- introduce a `live_default` deployment set for mainline GitOps;
- make the default set exclude dormant apps;
- keep manual `workflow_dispatch` with explicit `apps=` for on-demand app
  deployment;
- keep governance checks broad, but make image build/deploy work match the live
  portfolio posture.

This reduces CI minutes, ACR churn, deployment noise, and accidental wake-ups
without weakening repository quality gates.

## Deferred Items

| Item | New posture |
| --- | --- |
| Zonga middleware readiness | Defer live deployment proof unless Zonga is reactivated |
| Agrimo authority readiness | Defer backend authority binding until Agrimo is reactivated |
| Non-UE staging apps | Prefer `minReplicas=0` and on-demand warm-up |
| Non-UE production apps | Review whether public web/partners surfaces are required; otherwise scale to zero or replace with static/low-cost alternatives |
| DORA deployment frequency | Monitor as operational KPI; do not fabricate deployments |

## Next Implementation Tranches

1. Create a Union Eyes storage topology ADR and choose document/evidence
   container names per environment.
2. Wire `AZURE_BLOB_CONTAINER` explicitly for Union Eyes staging and production
   only after the topology is accepted.
3. Add a UE storage capability probe or evidence script that verifies the
   configured document container without forcing unrelated apps to require Blob.
4. Change GitOps default app resolution so mainline deploys do not rebuild and
   redeploy dormant apps by default.
5. Scale non-Union Eyes staging and production Container Apps to zero where
   they are not serving current customer-facing traffic.

## Classification

`UNION_EYES_LIVE_STRATEGY = ACCEPTED / COST_OPTIMIZED`

`NON_UNION_EYES_APPS = DEFERRED / DEPLOYABLE_ON_DEMAND`

`UNION_EYES_BLOB_TOPOLOGY = OPEN / ADR_REQUIRED`

`AZURE_COST_POSTURE = OPTIMIZE_FOR_SINGLE_LIVE_PRODUCT`
