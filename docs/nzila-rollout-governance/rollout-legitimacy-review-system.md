# Rollout Legitimacy Review System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Purpose

A rollout legitimacy review is a structured, recordable workflow that
asserts an environment, release, or promotion is fit for the next
governance step.

## 2. Review Areas

A full review covers:

| Dimension                  | Source of truth                                                  |
|----------------------------|------------------------------------------------------------------|
| Environment identity       | Running app `/health/identity` + environments registry.          |
| Deployment legitimacy      | Azure Container Apps revision; managed identity; KV refs.        |
| Attestation integrity      | Promotion + bootstrap attestation ledger.                        |
| Schema legitimacy          | ORM governance bootstrap attestation; `db:validate` result.      |
| Governance posture         | Doctrine corpus + governance corpus references current.          |
| Continuity posture         | Stabilization window state; alert posture.                       |
| Operational readiness      | Operator roster; on-call; runbooks linked.                       |
| Pilot readiness            | Sponsor sign-off; isolation verified; onboarding attested.       |
| Operator readiness         | Onboarding attestation present and current.                      |

## 3. Review Outcomes

Every review yields one of:

- **PASS** — proceed.
- **PASS-WITH-CONDITIONS** — proceed; conditions recorded as
  follow-on attestations with deadlines.
- **HOLD** — do not proceed; stabilization or remediation required.
- **REFUSE** — promotion or rollout is not legitimate; record incident.

There is no implicit pass. No outcome means the review did not occur.

## 4. Review Workflows

| Workflow                       | Triggered by                                        |
|--------------------------------|-----------------------------------------------------|
| Promotion review               | Operator initiates `node tooling/scripts/record-promotion-attestation.mjs`.   |
| Pre-pilot review               | Pilot onboarding intent.                            |
| Per-release pilot review       | Pilot release window opens.                         |
| Demo pre-session review        | Demo session scheduled.                             |
| Rollback review                | Rollback intent.                                    |
| Readiness aggregate review     | Scheduled cadence per release-governance-cadence.   |

## 5. Review Queues

Each workflow has a review queue. Queues are visible to operators via
[operator-rollout-workflows.md](./operator-rollout-workflows.md). A
review may not be silently dismissed; closing a review without an
outcome is itself a governance incident.

## 6. Review Records

Reviews are persisted as JSONL lines under
`proof-artifacts/rollout-attestations/reviews-YYYY-MM.jsonl`. Each
record contains: `review_id`, `workflow`, `subject`, `dimensions`,
`outcome`, `reviewer`, `conditions`, `timestamp`.

## 7. Required UX Surfaces

- rollout review panel
- legitimacy review workflow
- promotion review queue
- rollout attestation view
- rollout governance summary
