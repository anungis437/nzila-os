# NzilaOS — Dominance Train Acceptance Matrix

> Each PR must satisfy every gate before merge. No exceptions.

---

## Universal Gates (apply to ALL PRs)

| Gate | Criteria | Verification |
| ---- | -------- | ------------ |
| TypeScript strict | `strict: true`, no `any` escape hatches | `pnpm -w typecheck` |
| Lint clean | Zero warnings, zero errors | `pnpm -w lint` |
| Unit tests pass | All existing + new tests green | `pnpm -w test` |
| Contract tests pass | All structural/boundary tests green | `pnpm contract:test` |
| Build succeeds | Full Turborepo build completes | `turbo run build` |
| No feature drift | PR contains only scoped changes, no bonus features | Code review |
| Layering respected | `route → service → domain → adapter` — no shortcuts | Code review |
| Org terminology | `orgId` only — no `tenantId`, `companyId`, `entityId` as org synonym | Contract test + review |

---

## Per-PR Acceptance Gates

### PR 0.1 — Tracking Docs

| Gate | Criteria |
| ---- | -------- |
| Docs exist | `docs/platform/dominance-train.md` + `docs/platform/acceptance-matrix.md` created |
| Scope defined | Each PR's scope clearly documented |
| Rollback documented | Rollback steps for each epic noted |

---

### PR 1.1 — Cora Contract Tests (Read-Only Enforcement)

| Gate | Criteria |
| ---- | -------- |
| CORA_NO_ACTIONS_FOLDER_001 | CI fails if `apps/cora/lib/actions/**` exists |
| CORA_NO_MUTATION_IMPORTS_002 | CI fails if Cora imports write repos/services from `@nzila/agri-db` or operational DB packages. Allowlist documented inline. |
| CORA_NO_SQL_MUTATIONS_003 | CI fails if `INSERT\|UPDATE\|DELETE` SQL strings appear in `apps/cora` (excluding `tests/fixtures`) |
| Allowlist documented | Permitted read-only import paths explicitly listed in contract test |

---

### PR 1.2 — Read-Only Query Layer

| Gate | Criteria |
| ---- | -------- |
| Readonly repos created | `packages/agri-db/src/readonly/` directory with read-only repository wrappers |
| No `tx` parameter | Readonly repos cannot accept transaction objects |
| Cora compiles | Cora compiles using readonly repos only |
| No write imports remain | Zero write-capable repository imports in Cora |

---

### PR 2.1 — ABR Org Isolation

| Gate | Criteria |
| ---- | -------- |
| Org context resolved | Every ABR API endpoint resolves org context |
| Org-scoped queries | All data queries scoped by org |
| Cross-org denied | Cross-org access attempts rejected at data layer |
| Isolation proof endpoint | ABR exposes a platform-only isolation proof endpoint |

---

### PR 2.2 — ABR Audit Taxonomy

| Gate | Criteria |
| ---- | -------- |
| Taxonomy defined | `abr.case.created`, `abr.case.updated`, `abr.case.status_transitioned`, `abr.export.generated`, `abr.integration.sent` |
| All mutations emit | Every ABR mutation emits a platform-form audit event |
| Required fields | `orgId`, `actorId`, `appId`, `correlationId` present on every event |

---

### PR 2.3 — ABR Evidence Packs

| Gate | Criteria |
| ---- | -------- |
| Terminal events defined | Decision issued, export generated, case closed |
| Evidence created | Signed hash evidence packs generated on terminal events |
| Org export includes evidence | Evidence references included in org data export |

---

### PR 2.4 — ABR Integrations Dispatcher-Only

| Gate | Criteria |
| ---- | -------- |
| No direct SDK calls | Zero direct email/SMS/webhook/CRM/chatops SDK usage in ABR app/backend |
| Dispatcher only | All outbound comms routed through `integrations-runtime` dispatcher |
| Delivery logs visible | Integration delivery logs + retry/DLQ visible in Console |

---

### PR 3.1 — Performance Metrics in Console

| Gate | Criteria |
| ---- | -------- |
| Metrics tracked | `trackRequestMetrics(route, orgId, appId, latencyMs, statusCode, ts)` operational |
| Console page | `/console/performance` with time window, app, org, route group filters |
| Cards rendered | p50/p95/p99, error rate, RPM displayed |
| Table rendered | Top slow routes table present |
| Org scoping | Org admins see only their org's metrics; platform sees global |
| No secrets | No secrets, tokens, or PII displayed |

---

### PR 3.2 — Queue/Outbox Visibility

| Gate | Criteria |
| ---- | -------- |
| Outbox metrics | Backlog count by app/domain, oldest outbox age (lag) |
| Worker metrics | Queue depth / saturation indicators |
| Console page | `/console/system-health` enhanced with outbox lag + backlog + saturation |
| Read-only | Page is strictly read-only |
| Scoping | Platform-only for global; org-only for scoped |

---

### PR 3.3 — Integration SLO Dashboard

| Gate | Criteria |
| ---- | -------- |
| SLO metrics | Success rate, p95 delivery latency, rate-limit count per provider |
| Console pages | `/console/integrations/health` + `/console/integrations/sla` |
| Proof pack extended | `packages/platform-proof` includes integration health snapshot + 24h success rate |
| Deterministic | Calculations are deterministic and reproducible |
| Exportable | SLA report exportable |
| Secret-safe | Proof pack contains no secrets |

---

### PR 4.1 — Canonical Context Contract

| Gate | Criteria |
| ---- | -------- |
| Package created | `packages/org/src/context/types.ts` exists |
| OrgContext type | `{ orgId, actorId, roles, appId, correlationId, requestId }` |
| `orgId` canonical | `orgId` is the only org identifier |
| `actorId` canonical | `actorId` is the only actor identifier |

---

### PR 4.2 — entityId → orgId Refactor

| Gate | Criteria |
| ---- | -------- |
| No masquerading | Zero `entityId` used as org identifier outside legitimate domain entities |
| DB repos updated | All DB repos accept `orgId` explicitly |
| Tests updated | All tests + contract tests use `orgId` |
| Contract tests pass | Updated contract tests pass |

---

### PR 4.3 — Context Semantics Contract Tests

| Gate | Criteria |
| ---- | -------- |
| CONTEXT_SEMANTICS_ENFORCED_001 | Fail if `resolveOrgContext` returns `{ entityId }` without `{ orgId }` |
| Server action guard | Fail if `ctx.entityId` used in org filters in server actions |
| Regression prevented | New code cannot introduce `entityId` as org synonym |

---

### PR 5.1 — TODO/FIXME Cleanup

| Gate | Criteria |
| ---- | -------- |
| Security paths clean | No unscoped TODOs in security/governance code paths |
| Tracked or removed | Non-trivial TODOs have issue references (`TODO(#123)`) or are eliminated |
| Obsolete removed | Stale/completed TODOs deleted |
| Count reduced | Material reduction in repo TODO count or all made traceable |
