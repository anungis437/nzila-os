# 008 — Wave 3 Azure / staging diagnostics

**Observed at:** 2026-11-23 (agent environment)  
**Integration tip at observation:** `0ce7bb9e9` (re-checked after Azure plugin work)  
**B-005 closure:** `NOT_PROVEN`

## Azure plugin use (concrete)

| Azure MCP tool | What it produced for this workspace |
|---|---|
| `extension_cli_install` | Official install path → **Azure CLI 2.93.0 installed** on this agent (`/usr/bin/az`). Prior observation had `az: command not found`. |
| `documentation` (`microsoft_docs_search`) | Confirmed ACA inspect commands: `az containerapp show` (FQDN / image / latestRevisionName), `revision list`, `logs show --type system` for pre-revision image-pull failures. |
| `get_azure_bestpractices` | Prefer control-plane evidence over data-plane timeouts; match ingress `targetPort` to app listen port; do not claim staging deploy from unreachable health alone. |
| `containerapps` (learn + list) | MCP exposes `containerapps_list`; **live list timed out** without an authenticated Azure session in this environment. |
| `subscription_list` | **Timed out** — no Azure identity bound to this agent. |

Durable tooling added from that guidance:

- `tooling/scripts/sage-b005-azure-revision-inspect.mjs` (+ tests) — read-only before-state receipt for B-005 §A.

## Environment facts

| Check | Result |
|---|---|
| `az` CLI present | **Yes** — `azure-cli 2.93.0` (installed via Azure plugin install guidance) |
| `az account show` | **Not authenticated** — `Please run 'az login'` |
| Azure MCP control plane | `subscription_list` / `containerapps_list` **timeout** (no bound credentials) |
| Staging health probe | `https://staging-admin.nzilaventures.com/api/health` — **200 OK** (re-checked after CLI install; earlier observation timed out) |
| Live `buildInfo.commit` | `c2e3c61ce619a78639b827b40b6478d65dc66d0c` (merge of #941 — **not** the Wave 3 / SAGE institutional tip) |
| Network egress policy | unrestricted (allow-all) on this pod |

## Honest inspect dry-run (this environment)

Receipt: `/opt/cursor/artifacts/b005-receipts/sage-b005-azure-revision-auth-required.json`

```text
result: AUTH_REQUIRED
b005Closure: NOT_PROVEN
az.present: true
az.version: 2.93.0
accountError: AZ_LOGIN_REQUIRED
containerApp: null
health.httpStatus: 200
health.commit: c2e3c61ce619a78639b827b40b6478d65dc66d0c
```

## Interpretation

Data-plane health is reachable, but **control-plane revision/image parity cannot be
recorded** without Azure auth. Offline B-005 package remains `LOCAL_TESTED`.
Do **not** elevate to `STAGING_VERIFIED`: live commit is not the Wave 3 tip, and
image digest / `sage_%` migrations / authenticated journeys remain unproven.

The Azure plugin unblocked a concrete gap: agents can install `az`, emit the
exact §A before-state receipt B-005 needs, refuse prod RGs, and separate
health-OK from control-plane-captured — without false closure.

## Exact external dependency

1. Staging-scoped Azure identity for `nzila-canada-staging-rg` (`az login` or CI OIDC)
2. Reachable staging-admin ingress (or confirmed FQDN from inspect receipt)
3. Fictional test session cookie for authenticated smoke
4. Isolated Postgres apply of migrations through `0052`

## Non-claims

- Read-only timeout ≠ staging outage attestation without Azure control-plane evidence
- Local HTTP route tests ≠ staging authenticated journey
- Installing `az` ≠ B-005 closed
