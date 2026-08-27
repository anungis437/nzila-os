# Demo Governance System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Position

Demos at Nzila are **governed institutional environments**. They are
not throwaway sales fixtures. A demo that fails legitimacy review is
not promoted, regardless of commercial pressure.

## 2. Demo Legitimacy Criteria

A demo environment is legitimate when all of the following hold:

1. Its `secret_topology` matches the registry (`nzila-canada-demo-kv`
   for the current canonical demo, with TSOSA exception documented).
2. Its database has been bootstrapped via `pnpm db:bootstrap` and a
   bootstrap attestation row exists (per ORM governance).
3. Its release identifier matches a promotion attestation with
   `to=demo`.
4. It advertises identity correctly per
   [environment-legitimacy-visibility.md](./environment-legitimacy-visibility.md).

## 3. Topology Governance

- Demo environments MUST be tier-`demo-isolated` topology.
- Demo environments MUST NOT touch pilot or production data.
- Demo environments MAY share Key Vault under TSOSA only when the
  exception is recorded and time-bounded.

## 4. Realism Governance

Demo realism is governed; demos must not present synthetic prosperity
that misrepresents institutional capability. Specifically:

- Demo data must originate from canonical sanitized snapshots, never
  ad-hoc fixtures injected to support a pitch.
- Demo telemetry must reflect real system behavior; demos must not
  mute alerts to appear healthier than they are.
- Demo continuity windows must be honored; demos under a stabilization
  window must not be presented as production-grade.

## 5. Demo Data Governance

| Data origin                          | Permitted in demo?                  |
|--------------------------------------|-------------------------------------|
| Canonical sanitized snapshot         | Yes                                 |
| Synthetic governance fixtures        | Yes, when tagged synthetic          |
| Production data                      | **Never**                           |
| Pilot data                           | **Never**                           |
| Other tenant pilot data              | **Never**                           |

## 6. Operator Governance

A demo session requires a designated **demo operator** who is
accountable for:

- Verifying legitimacy summary before opening the session.
- Logging the session in the rollout attestation ledger.
- Refusing to demonstrate features whose legitimacy is degraded.

## 7. Environment Review Cadence

Demo environments are reviewed:

- **Pre-session:** legitimacy summary check.
- **Weekly:** topology + snapshot freshness.
- **Per release:** promotion legitimacy review.

## 8. Demo Attestation Rules

Each demo session emits a session attestation containing:

- `release_id`, `git_sha`, `operator`, `audience_class`,
  `legitimacy_state_at_open`, `legitimacy_state_at_close`,
  `continuity_window_state`.

## 9. Demo Degradation Policy

When demo legitimacy is degraded (snapshot stale, attestation missing,
continuity window open), the demo MUST be:

- presented with a calm, executive-readable degradation banner, OR
- postponed.

Demos must never be presented as healthy when they are not. This is
non-negotiable institutional posture.

## 10. Required UX Surfaces

Implemented under operator surfaces (see
[operator-rollout-workflows.md](./operator-rollout-workflows.md)):

- demo environment identity panel
- demo legitimacy summary
- demo attestation view
- demo realism check view
- demo continuity validation indicator
