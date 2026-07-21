# Union Eyes — Reality & World-Class Remediation Programme

**Programme status:** `PARTIALLY_IMPLEMENTED` — Wave 0 containment landed, verification incomplete.
**Wave 0 status:** `PARTIALLY_IMPLEMENTED` (see §Wave 0 open items below).
**Wave 1+ status:** `NOT_STARTED`.
**Branch:** `fix/union-eyes-reality-remediation`
**Owner:** Platform Reliability & Reality.

Only the evidence-backed states below may be used in this programme:
`NOT_STARTED`, `IN_PROGRESS`, `PARTIALLY_IMPLEMENTED`, `IMPLEMENTED_NOT_PROVEN`,
`PROVEN_IN_STAGING`, `BLOCKED`, `CLOSED`. The words "complete", "green",
"ready", or "delivered" MUST NOT be used unless every listed proof is on file.

## Wave 0 open items (blocking Wave 0 → `IMPLEMENTED_NOT_PROVEN`)

- Repository-wide capability inventory (registry currently a seed of 8 entries).
- Claim-to-runtime inventory for every claim in `docs/` and `readme` surface.
- Independent verification of every original adversarial finding against
  current code (25+ findings — see `04_FINDINGS_AND_DISPOSITIONS.md`).
- Anti-theatre CI gate wired into `pnpm` and CI workflow.
- Demo-profile deployment guard enforced at build, deploy, and runtime layers.
- Runtime capability-state enforcement (routes must consult the registry).
- Full baseline validation matrix (not just three targeted test files).
- Infrastructure and dependency inventory (Container App, DB, Redis, Django,
  ClamAV, SMTP/SMS/payment/monitoring providers, backups).
- Current staging configuration attestation (see `15_STAGING_ATTESTATION.md`).
- Readiness-document reconciliation against the capability registry.

## Purpose

Every capability inside `apps/union-eyes` must be truthfully classified as
one of the following states, at all times:

- `REAL` — Fully implemented, deployed, and validated against real data.
- `LIMITED` — Implemented with clearly documented limits (e.g. cached fallback).
- `DEGRADED` — Runs, but with a documented non-fatal defect.
- `DISABLED` — Code exists but is intentionally off in production.
- `DEMO_ONLY` — Runs only inside a marked demo profile; blocked outside dev.
- `NOT_IMPLEMENTED` — Handler exists but returns HTTP 501.
- `DEPRECATED` — Replaced; kept only for compatibility.
- `REMOVED` — Present in registry for history only.

The single machine-readable source of truth is
[`apps/union-eyes/lib/reality/capability-registry.ts`](../../../apps/union-eyes/lib/reality/capability-registry.ts).

## Non-negotiable principles

1. **Never lie about readiness.** An unimplemented endpoint returns HTTP 501,
   not HTTP 200 with `{ status: 'not_implemented' }`.
2. **Never fabricate provenance.** A cached fallback is labelled a cached
   fallback. External-source labels (`Bank of Canada (FXUSDCAD)`) are only
   applied when the value was retrieved from that source in the current call.
3. **Never mark a check green when it was not measured.** Health aggregators
   must have an `unknown` state, and any `unknown` check forces the overall
   status to `remediation_in_progress`.
4. **Never let demo profiles run outside development.** The `cupe4373` (and
   any future demo) profile must be blocked by a deployment guard in staging
   and production.
5. **Never claim `REAL` while depending on `NOT_IMPLEMENTED` or `DEMO_ONLY`
   capabilities.** Enforced by CI against the capability registry.

## Wave structure

Waves are analytic groupings — they are NOT commit or PR boundaries.
An item labelled "Wave N" may land in the same branch as Wave 0 work.
The programme continues until every P0 finding is `CLOSED` or `BLOCKED`.

| Wave | Focus                                                                                     |
|------|-------------------------------------------------------------------------------------------|
| 0    | P0 truth fixes: cron 501s, BOC provenance, pilot-status honesty, capability registry.     |
| 1    | Anti-theatre CI checks + deployment guards.                                               |
| 2    | Full audit-trail freshness + observability aggregator.                                    |
| 3    | Pilot readiness real checks (vocabulary loaded, SLA thresholds, audit-trail freshness).   |
| 4    | Notification & message processing pipelines.                                              |
| 5    | Dues calculation, notification dispatcher, invitation lifecycle.                          |
| 6    | Demo profile isolation and deployment-time enforcement.                                   |
| 7    | Durable authoritative FX-rate cache + T106 filing verification.                           |
| 8    | Scheduled reports pipeline.                                                               |
| 9    | Auth-audit consolidation (retire in-memory `auth-middleware.ts` audit store).             |
| 10   | Data-quality gate for cross-border transactions and financial records.                    |
| 11   | End-to-end reality tests against staging.                                                  |
| 12   | Formal validation report + evidence bundle.                                                |
| 13   | Post-remediation retrospective + programme close-out.                                     |

## Exit criteria

The programme exits successfully when every capability in the registry has
state `REAL`, `LIMITED` (with documented limits), `DEPRECATED`, or `REMOVED`,
and no anti-theatre CI check has been silenced or waived without a documented
maintainer approval.
