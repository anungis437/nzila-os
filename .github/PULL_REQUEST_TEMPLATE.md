<!--
Nzila Pull Request Template
See governance/ai/lifecycle-gates.md and governance/privacy/policies/data-classification-standard.md
-->

## Summary

<!-- 1-3 sentences. What problem does this solve? Link issue / spec. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor / chore
- [ ] Documentation
- [ ] Security / privacy
- [ ] AI / ML capability change

## Scope

<!-- Which apps / packages are affected? Note any cross-cutting impact. -->

---

## Privacy by Design checklist

Required when this PR touches data flows, schemas, APIs, logging, exports,
or any feature that processes personal data. Skip with "n/a" lines if
purely internal/no-data change.

- [ ] Data tier of all inputs/outputs identified per [`governance/privacy/policies/data-classification-standard.md`](governance/privacy/policies/data-classification-standard.md)
- [ ] Minimization — only the fields required for the purpose are collected/processed
- [ ] Retention — data lifetime fits the published retention schedule
- [ ] No Restricted-tier data in logs, error messages, or non-prod stores
- [ ] DSAR impact considered (does this introduce a new personal data store or processor?)
- [ ] Vendor / sub-processor change? If yes, DPA on file → list it in `governance/privacy/data-inventory.json`
- [ ] Cross-border data flow change? If yes, transfer mechanism documented in PIA / DPIA
- [ ] User-facing consent or notice changes considered

## Security checklist

- [ ] AuthN / AuthZ paths reviewed (no broken access control; least privilege)
- [ ] No new secrets in code, env files, or fixtures (use Key Vault / GitHub secrets)
- [ ] Input validation at trust boundaries
- [ ] Logging does not include credentials, tokens, or Restricted PII
- [ ] Dependency additions reviewed by `tooling/security/supply-chain-policy.ts`

---

## AI / ML checklist

Required if this PR touches `@nzila/ai-sdk`, `@nzila/ml-sdk`, prompts,
evals, model providers, RAG indexes, or AI-driven actions. Skip otherwise.

- [ ] AI access goes through `@nzila/ai-sdk` / `@nzila/ml-sdk` (no raw provider SDKs in app code) — enforced by [`tooling/contract-tests/ai-integration.test.ts`](tooling/contract-tests/ai-integration.test.ts)
- [ ] [`governance/ai/inventory.json`](governance/ai/inventory.json) updated for any new/changed surface
- [ ] Risk classification applied per [`governance/ai/risk-classification.md`](governance/ai/risk-classification.md)
- [ ] PIA created/updated under [`governance/privacy/ai-pia/`](governance/privacy/ai-pia/) for surfaces processing personal data
- [ ] AIGC approval recorded if Tier-1 (in inventory `approval` block + minutes link)
- [ ] Reasoning envelope (`AiTrace.correlationId` / `requestId`) propagated — enforced by [`tooling/contract-tests/ai-reasoning-envelope.test.ts`](tooling/contract-tests/ai-reasoning-envelope.test.ts)
- [ ] Eval suite added/updated under `tooling/ai-evals/datasets/<app>/`
- [ ] Prompt templates versioned in source control (no inline prompt mutation)
- [ ] User-facing AI disclosure present (Tier ≤ 2 with UI surface)
- [ ] Kill switch / feature flag in place (G15)
- [ ] Cost / token budget acknowledged in [`governance/ai/inventory.json`](governance/ai/inventory.json)

## Synthetic data checklist

- [ ] No production data committed in fixtures or seed packages
- [ ] If generating new synthetic data: decision framework in [`governance/ai/synthetic-data-policy.md`](governance/ai/synthetic-data-policy.md) followed
- [ ] Re-identification risk assessed if generator consumes real data

---

## Tests

- [ ] Unit tests added/updated
- [ ] Contract tests pass locally (`pnpm vitest run tooling/contract-tests`)
- [ ] Manual verification steps documented below

### Manual verification

<!-- Optional: scripted reproduction or manual steps -->

---

## Rollout & rollback

- [ ] Behind a feature flag if user-visible
- [ ] Rollback plan: <!-- e.g. revert PR; or disable feature flag X -->
- [ ] Migration / data backfill required? If yes, link the migration plan

## Related

<!-- Link issues, PRDs, ADRs, prior PRs -->
