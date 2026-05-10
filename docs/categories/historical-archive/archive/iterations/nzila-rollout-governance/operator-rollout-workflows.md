# Operator Rollout Workflows

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Position

Operators are **governance-guided**, not deployment-reactive. Workflows
present the next legitimate action, not raw infrastructure controls.

## 2. Supported Workflows

| Workflow                          | Purpose                                                |
|-----------------------------------|--------------------------------------------------------|
| Demo prep                         | Walks through demo legitimacy + session attestation.   |
| Pilot prep                        | Pilot onboarding + sponsor sign-off + attestation.     |
| Environment promotion             | Cross-tier promotion with full review.                 |
| Release review                    | Per-release legitimacy review.                         |
| Rollback review                   | Governed rollback flow.                                |
| Onboarding review                 | Stakeholder + operator readiness review.               |
| Rollout stabilization review      | Stabilization window close-out.                        |

## 3. Workflow Anatomy

Each workflow follows the same shape:

1. **Identity confirmation** — what environment, what release.
2. **Legitimacy summary** — what is currently legitimate, what is not.
3. **Outstanding conditions** — open follow-on attestations.
4. **Review prompts** — short, executive-readable assertions to mark.
5. **Outcome** — PASS / PASS-WITH-CONDITIONS / HOLD / REFUSE.
6. **Attestation** — the workflow ends by writing an attestation.

## 4. UX Guarantees

- No raw kubectl/az/psql controls in operator surfaces.
- No "deploy" buttons that bypass review prompts.
- No queue spam: at most one banner; one inbox; one timeline.
- All destructive actions require a typed reason.

## 5. Operator Identity

Every workflow records the operator's identity (named, not service
principal) on the resulting attestation. Service-principal-only
attestations are reserved for CI-emitted records that do not require
operator gating.

## 6. CLI Companion

Operator workflows are mirrored by CLI commands for environments
without UI access:

```bash
pnpm rollout:validate
pnpm rollout:readiness
pnpm rollout:promote:attest -- --from <tier> --to <tier> --release-id <id> --reviewer <name> --reason <text>
```

## 7. Anti-Patterns

- Workflow steps that explain "what failed" without naming the next
  legitimate action.
- Workflows that present alarms in lieu of decisions.
- Workflows that allow silent close.
