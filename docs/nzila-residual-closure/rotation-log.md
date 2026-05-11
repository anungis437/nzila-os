# Provider Key Rotation Log

> **Append-only.** Every rotation event records reviewer-of-record signature + KV mint version. Doctrine: [r8-provider-key-rotation-cadence.md](./r8-provider-key-rotation-cadence.md).

## Format

Each entry:

```
### YYYY-MM-DD — <provider> — <env>
- **reason**: scheduled cadence | leak | vendor-mandated | reviewer-of-record departure
- **reviewer-of-record**: @github-username (UTC: YYYY-MM-DDTHH:MM:SSZ)
- **old key fingerprint** (last 4): xxxx
- **new key fingerprint** (last 4): xxxx
- **KV mint version**: <secret version id from `az keyvault secret show --version`>
- **post-rotation drill**: <link to drill artifact / chore PR>
- **notes**: <one-liner>
```

Never record full keys, full token values, or any fingerprint longer than the
last 4 characters.

## Decommissioned providers

### 2026-04-05 — Clerk — all envs
- **reason**: provider migration to `@nzila/platform-auth`
- **reviewer-of-record**: @anungis437 (UTC: 2026-04-05)
- **action**: All Clerk secrets purged from KV; CLERK_* env vars removed from all 7 Container Apps; Django auth class aliases preserved (`ClerkAPIKeyAuthentication = APIKeyAuthentication`).
- **notes**: Clerk decommissioned; no future rotations.

## Open rotations

_None yet recorded. First rotation: chore/r8-provider-key-rotation-q1 — quarterly OpenAI + Resend cycle._
