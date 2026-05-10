# Nzila OS — Pilot Readiness Checklist

> Internal gate checklist for moving a product from incubation into a formal pilot engagement.
> Every item must be marked ✅ before a pilot proposal is issued.
>
> Authority: `governance/portfolio/product-catalog.json` · Updated: 2026-04-17

---

## Gate 1 — Product Foundations

- [ ] Product has a named GM / product owner
- [ ] `value_prop` in product catalog is customer-facing and unambiguous
- [ ] Buyer pack exists at `docs/buyers/<product>-buyer-pack.md`
- [ ] `docs_entrypoint` points to a real, non-stub README
- [ ] `target_customer` is a named buyer persona, not "internal users"

---

## Gate 2 — Code Completeness

- [ ] `code_presence: "full"` in product catalog (not "partial" or "scaffold")
- [ ] Core user journeys can be completed end-to-end without known blockers
- [ ] All critical TypeScript errors resolved (`pnpm --filter <app> typecheck` clean)
- [ ] Unit test coverage exists for core business logic (no 0% coverage domains)
- [ ] No `TODO: STUB`, `NOT_IMPLEMENTED`, or `placeholder` patterns in critical paths

---

## Gate 3 — Auth & Security

- [ ] `@nzila/platform-auth` adopted (no Clerk/custom auth remaining)
- [ ] RBAC model defined and enforced for all protected routes
- [ ] `can_claim_audit_hardened: true` in product catalog
- [ ] No OWASP Top 10 critical findings open in security review
- [ ] Rate limiting active on all public-facing API routes
- [ ] CSRF protection active on all mutation endpoints

---

## Gate 4 — Data Integrity

- [ ] `data_integrity` in `maturity.json` is `"strong"` or `"partial"` (not `"stale"`)
- [ ] Database schema migrations are tracked and reversible
- [ ] No raw SQL with string interpolation in production code paths
- [ ] Org-scoping enforced: no cross-org data leakage paths identified
- [ ] Drizzle ORM schema matches deployed DB columns for all queried tables

---

## Gate 5 — Observability

- [ ] Structured logging (pino/OS-core) in all API routes — no `console.log` calls
- [ ] Error paths log with context (orgId, actorId, operation) — no silent swallows
- [ ] Key lifecycle events emit metrics (case created, invoice sent, org onboarded)
- [ ] Health endpoint available and returns structured status
- [ ] `observability` in `maturity.json` is `"partial"` or `"full"` (not `"none"`)

---

## Gate 6 — Orchestrator Integration

- [ ] `orchestrator_integration: true` in `maturity.json`
- [ ] At least one background job is dispatched through orchestrator (not ad-hoc fetch)
- [ ] Idempotency key strategy documented for all dispatched playbooks
- [ ] Dispatch client uses `AbortSignal.timeout` — no unbounded fetches
- [ ] Dispatch failures are logged, not thrown to the user request

---

## Gate 7 — Governance & Evidence

- [ ] `evidence_status` in product catalog is `"complete"` or `"partial"` (not `"none"`)
- [ ] `proof_status` is `"internal-proof"` or `"pilot-proof"` (not `"no-proof"`)
- [ ] Proof artifact linked in `docs/proof-center/`
- [ ] `contracts_complete` in `maturity.json` is `true` — or documented gap list exists
- [ ] `last_validated` date within 30 days of pilot proposal

---

## Gate 8 — Pilot Scope Agreement

- [ ] Pilot success criteria defined and agreed with buyer
- [ ] Pilot duration and support model documented
- [ ] Rollback plan documented for pilot environment
- [ ] Data handling and privacy obligations reviewed against buyer requirements
- [ ] Commercialisation threshold documented: what converts pilot to contract?

---

## Summary Scorecard

For a product to enter pilot:

- **Gates 1–4**: All items ✅ (required)
- **Gate 5–6**: All items ✅ (required)
- **Gate 7**: Minimum `evidence_status: "partial"` and `proof_status: "internal-proof"` (required)
- **Gate 8**: Completed before first pilot call (required)

Products currently passing all gates:

| Product | Gate 1 | Gate 2 | Gate 3 | Gate 4 | Gate 5 | Gate 6 | Gate 7 | Gate 8 |
|---------|--------|--------|--------|--------|--------|--------|--------|--------|
| union-eyes | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ | 🟡 |
| flow | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | 🟡 |
| cfo | ✅ | ✅ | ✅ | 🟡 | 🟡 | ❌ | 🟡 | ❌ |
| partners | ✅ | ✅ | ✅ | 🟡 | 🟡 | ❌ | ❌ | ❌ |

> Legend: ✅ Passed · 🟡 Partial · ❌ Not started
