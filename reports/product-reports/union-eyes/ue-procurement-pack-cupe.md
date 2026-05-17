# Union Eyes Procurement Pack For CUPE

## What Can Be Bought Credibly Today

1. A controlled pilot for case intake, assignment, workflow progression, audit visibility, and evidence export.
2. A steward-led deployment model focused on operational discipline and defensibility.
3. A staged roadmap from pilot local to broader rollout.

## What Should Not Be Overstated

1. Full member self-serve readiness.
2. End-to-end evidence upload chain-of-custody from the current member UI.
3. Broad multi-local tenant maturity without additional hardening.
4. Admin simplicity for non-technical operators without a tighter runbook.

## Buyer Questions And Answers

### Is it secure enough for a pilot?

Yes, for a restricted pilot that uses the hardened case APIs and disables legacy entry points.

### Is it ready for all members on day one?

No. The member intake and attachment path still need rewiring.

### What is the strongest differentiator?

The combination of workflow discipline, auditability, and defensibility export.

### What is the highest current product risk?

Inconsistent live-path wiring between member-facing UI and the newer secured case APIs.

## Recommended Commercial Shape

1. Paid pilot with explicit restrictions and a hardening backlog.
2. Expansion milestone only after the restricted pilot KPIs are met.
3. Contract language that distinguishes pilot acceptance from general availability.

---

## Operational Evidence (Phase B Validated — 2026-05-17)

This section records the validated operational posture as of Phase B completion.
All claims below are backed by live evidence — no hypothetical readiness assertions.

### Infrastructure

| Component | Status | Evidence |
|---|---|---|
| Azure Container App (`nzila-os-union-eyes-prod`) | Validated | Live revision `--0000049`, Canada Central |
| Postgres 16 with ZR-HA | Validated | PITR restore drill completed in 4 min, prod unaffected |
| Redis (Upstash `cuddly-mudfish-102231`) | Validated | Health reports `redis:ok, ms:37` |
| Key Vault (`nzila-canada-prod-kv`) | Configured | Secrets centrally managed; KV RBAC grant pending |
| Log Analytics + KQL alerts | Validated | 3 alert rules wired to `ops@nzila.ca`; 400+ events/hr |
| Sentry DSN | Configured | `nzila-os-union-eyes-prod` project active |

### Deployment Posture

| Proof | Result |
|---|---|
| Deploy rehearsal | Passed — health-gated promotion, smoke tests confirmed |
| Rollback drill | Passed — 23s end-to-end, prior revision restored, smoke passed |
| PITR restore drill | Passed — DB restored in 4 min, timeline coherent, governance intact |
| Failed-deploy drill | Passed — ACA fast-fail on unknown image, 0 prod impact, 82s total |
| B8 validation suite | ✅ 7075 UE tests, 8962 contract tests, governance 54/54 |

### Auth Architecture

Union Eyes uses `@nzila/platform-auth` for all authentication and session management.

- **Primary**: PG-backed sessions (`nzila_session` cookie) — fully sovereign, no third-party auth path
- **Secondary**: Entra External ID via NextAuth — for Entra-managed workforce SSO
- **No Clerk dependency**: Clerk was removed in early 2026; no active dependency remains
- **Session tokens never leave the Nzila Canada perimeter**
- **Full audit trail** under organizational control

### Readiness Label

**PRODUCTION CANDIDATE**

Ready for:
- Controlled procurement reviews
- Pilot deployment with known CUPE locals
- Security/trust reviews (against staging)
- Executive demonstrations

Not yet for:
- Unsupervised public multi-tenant launch
- Unmonitored customer-facing deployment without ops team

Remaining gates before PRODUCTION READY (not blocking pilot):
1. Custom domain + WAF + HSTS
2. Key Vault RBAC for Redis token migration
3. 1-week minimum pilot observation window (opened 2026-05-17)
4. Governance authenticated drill (B3B)

