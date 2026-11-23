# 008 — Wave 3 Azure / staging diagnostics

**Observed at:** 2026-11-23 (agent environment)  
**Integration tip at observation:** `5ec9d5ded`  
**B-005 closure:** `NOT_PROVEN`

## Environment facts

| Check | Result |
|---|---|
| `az` CLI present | **No** (`az: command not found`) |
| Azure write credentials | **Unavailable** in this agent environment |
| Staging health probe | `https://staging-admin.nzilaventures.com/api/health` — **timeout** (15s, 0 bytes) |
| Network egress policy | unrestricted (allow-all) on this pod |

## Interpretation

Anonymous / authenticated staging qualification **cannot** proceed from this
environment. Offline B-005 package remains `LOCAL_TESTED`. Do not elevate to
`STAGING_VERIFIED`.

## Exact external dependency

1. Azure CLI + staging-scoped write identity (`nzila-canada-staging-rg`)
2. Reachable staging-admin ingress (or confirmed FQDN)
3. Fictional test session cookie for authenticated smoke
4. Isolated Postgres apply of migrations through `0052`

## Non-claims

- Read-only timeout ≠ staging outage attestation without Azure control-plane evidence
- Local HTTP route tests ≠ staging authenticated journey
