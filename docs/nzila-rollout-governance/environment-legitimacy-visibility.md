# Environment Legitimacy Visibility

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Purpose

Environment legitimacy must be **visible** at all times, in a calm,
executive-readable form. Operators must never have to infer whether an
environment is legitimate.

## 2. Surfaces

| Surface                              | Audience           | Cadence                |
|--------------------------------------|--------------------|------------------------|
| Environment identity badge           | Everyone in the UI | Continuous             |
| Release lineage panel                | Operators          | Continuous             |
| Deployment integrity summary         | Operators          | Continuous             |
| Attestation linkage view             | Operators          | Continuous             |
| Topology legitimacy panel            | Platform           | Per change             |
| Promotion legitimacy timeline        | Operators + sponsor| Continuous             |
| Isolation posture indicator          | Platform           | Continuous             |

## 3. Identity Advertisement Contract

Every running environment exposes:

- `tier` — one of `local | dev | staging | demo | pilot | prod`.
- `release_id`
- `git_sha`
- `secret_topology`
- `bootstrap_attestation_ref` (where applicable)
- `continuity_window_state` — `closed | open | recently_closed`

These fields are surfaced in the UI identity badge and in the
`/health/identity` endpoint.

## 4. UX Principles

Environment legitimacy visibility must:

- remain **calm** — no flashing, no pulsing, no urgency cues for normal
  states.
- remain **sparse** — one identity badge, not five.
- remain **executive-readable** — short labels, no jargon, no acronyms
  without expansion.
- avoid **operational panic** — degraded states are presented in
  composed, neutral language with the next governed action explicit.

## 5. Anti-Patterns

- "Live" or "Online" indicators that conflate runtime liveness with
  legitimacy.
- Color-only signaling (red/yellow/green) without textual state.
- Hidden legitimacy state visible only to platform engineers.
- Surveillance-flavored telemetry overlays on operator screens.

## 6. Implementation Notes

The identity badge is a small persistent UI element (header strip).
The release lineage panel is reachable in one click from the badge.
All other surfaces are reached through the rollout governance panel
described in [operator-rollout-workflows.md](./operator-rollout-workflows.md).
