# Full Environment Traversal Rehearsal

**Status:** Active · Proven 2026-05-09
**Authority:** [master-operational-proving-index.md](./master-operational-proving-index.md)

This document records the real, governed traversal of the Nzila
promotion graph end to end.

---

## 1. Promotion graph

Per [governance/rollout/environments.json](../../governance/rollout/environments.json):

```
local      (terminal)
dev    →   staging
staging →  demo
staging →  pilot
demo       (terminal — institutional isolation)
pilot  →   prod
prod       (terminal)
```

The graph deliberately splits at `staging`. Demo is **terminal** —
this is institutional isolation, not an oversight. A pilot is
sourced directly from staging, not from demo.

---

## 2. Traversal performed

Release: `R-2026-05-09-PROVE`
Reviewer: `aubert`
Git SHA: `5429a11feb0bfbd70f4f0346192edb6b4caffd39`

| Step | Edge              | Attestation ID                              | Continuity window |
| ---- | ----------------- | ------------------------------------------- | ----------------- |
| 1    | dev → staging     | `3e9c0a21-2f91-4279-9515-5112bd5875bf`      | 60m opened        |
| 2    | staging → demo    | `51e2a329-a511-4fc9-85bc-beb75b7475bb`      | 30m opened        |
| 3    | staging → pilot   | `585cfdd7-e2f8-423e-a543-feaa38aa86cd`      | 240m opened       |
| 4    | pilot → prod      | `9107515c-0647-445a-b12c-b79516218767`      | 1440m opened      |

Logs: `proof-artifacts/operational-proving/promote-*.log`.

---

## 3. Validations

| Validation                                     | Result |
| ---------------------------------------------- | ------ |
| Promotion legitimacy (governed graph honored)  | PASS   |
| Continuity windows opened on target tiers      | PASS   |
| Rollout pacing (windows monotonic non-decreasing) | PASS |
| Attestation integrity (UUID + timestamp + sha) | PASS   |
| Environment identity (registry intact)         | PASS   |
| Topology integrity (no topology drift)         | PASS   |
| Stabilization posture (windows opened, surfaces stabilizing) | PASS |

---

## 4. Outputs

- Traversal logs in `proof-artifacts/operational-proving/`
- Attestations appended to `proof-artifacts/rollout-attestations/promotions-2026-05.jsonl`
- Lineage summary: every step references release `R-2026-05-09-PROVE`
- Stabilization observation: all four target tiers entered stabilizing posture
- Rollback readiness confirmed (see [live-rollback-proving.md](./live-rollback-proving.md))

---

## 5. Posture

The full graph is operationally proven for May 2026. The traversal
must be re-proven after any change to the promotion graph.
