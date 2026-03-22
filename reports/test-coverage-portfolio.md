# Test Coverage Portfolio Report

**Generated**: 2026-03-15  
**Runner**: Vitest 4.0.18  
**Total test files**: 617 (*.test.ts) + 36 (*.test.tsx)  
**Contract tests**: 149 files in `tooling/contract-tests/`

---

## Coverage by Tier

### Tier 1 — Vertical Applications (16 apps)

| App | Test Files | Test Types | Notes |
|-----|:---------:|------------|-------|
| union-eyes | 21 | Unit + contract + integration | Representation protocol, FSM, evidence |
| orchestrator-api | 3 | Unit + contract + store integration | Schema, workflows, in-memory store lifecycle |
| cfo | 2 | Smoke + integration | Platform integration |
| console | 2 | Smoke + integration | Platform integration |
| cora | 2 | Smoke + resolve-org | Role mapping, read-only permissions |
| trade | 2 | Smoke + evidence packs | 3 evidence builders, org export |
| agrimo | 2 | Smoke + evidence packs | 4 agri evidence builders |
| abr | 1 | Smoke | Platform smoke |
| nacp-exams | 1 | Smoke | Platform smoke |
| partners | 1 | Smoke | Platform smoke |
| platform-admin | 1 | Smoke | Platform smoke |
| flow | 1 | Smoke | Platform smoke |
| web | 1 | Smoke | Platform smoke |
| zonga | 1 | Smoke | Platform smoke |
| mobility | 0 | — | Pure UI, no server-side logic |
| mobility-client-portal | 0 | — | Pure UI, no server-side logic |

**App coverage**: 14/16 apps have tests (87.5%)  
**Zero-test justification**: mobility and mobility-client-portal are client-only UIs with no server actions, API routes, or testable business logic.

### Tier 2 — Core Packages

| Package | Test Files | Coverage Area |
|---------|:---------:|---------------|
| os-core | 11 | Evidence sealing, audit, policy engine, tenant isolation |
| integrations-runtime | 8 | ResilientDispatcher, circuit breaker, retry, DLQ |
| payments-stripe | 5 | Webhook verification, Zod schemas, payment lifecycle |
| ai-core | 2 | AI model registry, prompt management |
| mobility-compliance | 1 | Workflow FSM (6-step), risk scoring, severity penalty |
| mobility-ai | 1 | AI governance, prohibited actions, document checklists |
| agri-core | 2 | FSM (lot + shipment), domain types, validation |
| agri-intelligence | 2 | Yield, loss, payout analytics |
| trade-core | 1 | Deal FSM engine, 9 states, 5 failure modes |
| agri-events | 1 | Event bus, domain events |
| agri-traceability | 1 | Evidence pack builders |
| integrations-hubspot | 1 | Webhook schema, sync |
| integrations-m365 | 1 | Graph API adapter |
| integrations-whatsapp | 1 | Provider pattern |
| qbo | 1 | OAuth + entity sync |

### Tier 3 — Packages Without Tests

| Package | Reason | Risk |
|---------|--------|------|
| ai-sdk | Thin SDK wrapper | Low |
| ml-core | ML pipeline definitions | Medium |
| ml-sdk | Thin SDK wrapper | Low |
| agri-db | Prisma schema only | Low (generated code) |
| agri-adapters | Re-exports | Low |
| blob | Azure Blob wrapper | Medium |
| chatops-slack | Webhook-only | Low |
| evidence | Pure functions (3 exports) | Medium |
| analytics | Event tracking wrapper | Low |
| automation | Python — uses pytest separately | N/A (different runner) |

### Tier 4 — Contract & Governance Tests

| Category | Files | Invariants |
|----------|:-----:|:----------:|
| Architectural contracts | 149 | Package structure, boundaries, exports |
| Governance enforcement | 24 | RBAC, audit, evidence, policy |
| Integration contracts | 7 | Adapters, webhooks, dispatcher |
| GA gate checks | 23 | Release readiness |

---

## Test Distribution Summary

```
Contract Tests   ████████████████████████████████  149 files (24%)
Union-Eyes       ████████                           21 files  (3%)
OS-Core          ████                               11 files  (2%)
Integrations-RT  ███                                 8 files  (1%)
Payments-Stripe  ██                                  5 files  (1%)
Other packages   █████████                          20 files  (3%)
Other apps       ██████████████                     20 files  (3%)
Remaining        █████████████████████████████████ 383 files (62%)
```

---

## Coverage Gaps & Recommendations

### High Priority
1. **packages/evidence** — Zero tests for `computeMerkleRoot`, `generateSeal`, `verifySeal`. These are security-critical cryptographic functions used by all evidence packs.
2. **packages/ml-core** — ML pipeline definitions untested. Add schema validation tests.

### Medium Priority
3. **packages/blob** — Azure Blob operations untested. Add mock-based unit tests.
4. **packages/trade-core** — Only 1 test file. Expand FSM transition tests.

### Low Priority (Acceptable)
5. Thin SDK wrappers (ai-sdk, ml-sdk) — minimal logic to test
6. Pure UI apps (mobility, mobility-client-portal) — no server logic
7. automation package — tested via pytest, not vitest

---

## CI Integration

- `pnpm test` → `turbo test` — runs all vitest projects in parallel
- `pnpm contract-tests` → `vitest run --project contract-tests` — 149 contract tests
- `pnpm test:coverage` → `turbo test:coverage` — coverage collection
- Governance gates job in CI enforces contract tests pass before merge
