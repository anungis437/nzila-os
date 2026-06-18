# Union Eyes — `any` Elimination Playbook & Tracker

Goal: replace every `any` in `apps/union-eyes` with proper types, with no runtime
behaviour change and a green `typecheck` + `lint` at every step.

This is a multi-session program. Progress is locked in file-by-file via an ESLint
ratchet so cleaned files cannot regress.

## How progress is enforced (the ratchet)

`apps/union-eyes/eslint.config.mjs` keeps `@typescript-eslint/no-explicit-any` at
`warn` repo-wide, but escalates it to **error** for files that have been fully
cleaned. When you finish de-anying a file, add its path to the `files:` array in the
"no-explicit-any ratchet" override block at the bottom of that config. Lint will then
fail if any `any` is reintroduced.

## Verification cadence (run after each file)

```bash
cd apps/union-eyes
# Authoritative typecheck (slow; needs 8GB heap):
node --max-old-space-size=8192 ../../node_modules/typescript/lib/tsc.js --noEmit
# Strict lint of the file(s) you just cleaned:
npx eslint <relative/path.ts> --max-warnings=0
```

VS Code's in-editor errors can be stale; `tsc` is authoritative.

## The proven cleanup recipe

Drizzle raw SQL (`tx.execute(sql\`...\`)`) returns loosely-typed rows, and
node-postgres returns COUNT/numeric columns as **strings**. Apply:

1. Add a local row alias: `type SqlRow = Record<string, unknown>;`
2. Type raw-row map callbacks as `(r: SqlRow)`. Wrap object-key usages in
   `String(r.field)`, numeric usages in `Number(r.field)`.
3. For a function with a declared domain return type, use a boundary cast:
   `return result as unknown as DeclaredType[];` (NEVER `as any`).
4. For functions returning generic rows, type them `Promise<SqlRow[]>` /
   `Promise<SqlRow>` / `Promise<SqlRow | null>`.
5. For a query consumed with typed field access (e.g. `summary.overdue_count`),
   give it a **real exported interface** (with `[key: string]: unknown` index
   signature) rather than `SqlRow`, so callers stay type-safe.
6. Remove redundant `as any` on `logger.info/error/warn` context objects
   (`LogContext = Record<string, unknown>`) and on drizzle inserts where values
   already match column types.
7. Remove now-orphaned `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
   comments.
8. `config: any` / `parameters?: any` → `unknown`; `conditions: any[]` → `SQL[]`
   (import `type SQL` from `drizzle-orm`).
9. For thin wrapper functions that just `return otherTypedFn(...)`, delete the
   `: Promise<any>` annotation and let TypeScript infer the proper return type.

### Watch out for cascades

Changing an exported return type from `any` to something stricter can break callers.
Always check callers first. If a function is consumed with typed field access, give
it a precise interface (recipe step 5). The boundary cast `as unknown as T` removes
`any` with zero runtime change.

## Completed (ratcheted to error — cannot regress)

| File | any removed |
| --- | --- |
| `lib/services/notification-service.ts` | 162 |
| `db/queries/analytics-queries.ts` | 82 |
| `db/queries/deadline-queries.ts` | 56 |
| `db/queries/enhanced-rbac-queries.ts` | 42 |
| `lib/deadline-service.ts` | 6 |
| `lib/scheduled-report-executor.ts` | 21 |
| `lib/api-auth-guard.ts` | 18 |
| `actions/rewards-actions.ts` | 15 |
| `lib/api/signature-service-api.ts` | 14 |
| `lib/utils/excel-generator.ts` | 14 |
| `components/cross-union-analytics/cross-union-analytics-console.tsx` | 19 |
| `lib/services/audit-trail-service.ts` | 26 |
| `lib/enterprise-role-middleware.ts` | 29 |
| `lib/api/index.ts` | 48 |
| `components/ui/data-table-advanced.tsx` | 28 |
| `lib/services/ai/vector-search-service.ts` | 22 |
| `lib/tracing/utils.ts` | 12 |
| `lib/database/multi-db-client.ts` | 12 |
| `lib/middleware/request-validation.ts` | 11 |
| `lib/console-wrapper.ts` | 10 |
| `lib/services/ocr-service.ts` | 10 |
| `lib/movement-insights/consent-manager.ts` | 14 |
| `components/analytics/charts/types.ts` | 9 |
| `components/analytics/charts/ScatterChart.tsx` | 4 |
| `components/analytics/charts/BubbleChart.tsx` | 3 |
| `components/analytics/charts/TreemapChart.tsx` | 5 |
| `components/analytics/charts/FunnelChart.tsx` | 1 |
| `components/analytics/charts/SunburstChart.tsx` | 6 |
| `components/analytics/charts/BoxPlotChart.tsx` | 2 |
| `components/analytics/charts/WaterfallChart.tsx` | 3 |
| `components/analytics/charts/DataTable.tsx` | 4 |
| `components/analytics/charts/SankeyChart.tsx` | 5 |
| `components/analytics/charts/CandlestickChart.tsx` | 2 |
| `lib/services/pci-compliance-service.ts` | 9 |
| `lib/calendar-reminder-scheduler.ts` | 9 |
| `lib/api/crud-factory.ts` | 9 |
| `lib/api/standardized-responses.ts` | 8 |
| `lib/workflow-engine.ts` | 8 |
| `lib/ai/insights-generator.ts` | 8 |
| `lib/mobile/service-worker-registration.ts` | 8 |
| `actions/admin-actions.ts` | 10 |
| `components/voting/vote-casting-interface.tsx` | 9 |
| `components/admin/MemberEmploymentManagement.tsx` | 9 |
| `components/clause-library/clause-library-console.tsx` | 8 |
| `lib/services/member-service.ts` | 7 |
| `lib/services/clause-service.ts` | 7 |
| `lib/payment-processor/types.ts` | 7 |
| `lib/db-validator.ts` | 7 |
| `lib/accessibility/accessibility-service.ts` | 11 |
| `lib/data-export-import.ts` | 7 |
| `lib/ai/template-engine.ts` | 11 |
| `lib/mobile/mobile-engine.ts` | 8 |
| `components/precedents/precedents-console.tsx` | 7 |
| `components/members/members-console.tsx` | 7 |
| `lib/services/rewards/export-service.ts` | 6 |
| `lib/services/policy-engine.ts` | 6 |
| `lib/services/messaging/campaign-service.ts` | 6 |
| `lib/report-executor.ts` | 6 |
| `lib/organizational-narratives/index.ts` | 6 |
| `lib/csrf-client.ts` | 6 |
| `lib/ai/chatbot-service.ts` | 6 |
| `components/members/member-onboarding-wizard.tsx` | 6 |
| `components/analytics/custom-report-builder.tsx` | 6 |
| `app/api/icra/report/[assessmentId]/review/route.ts` | 6 |
| `lib/services/external-data/statcan-client.ts` | 5 |
| `lib/services/ai/precedent-matching-service.ts` | 5 |
| `lib/middleware/api-security.ts` | 5 |
| `lib/email/report-email-templates.ts` | 5 |
| `lib/email-service.ts` | 5 |
| `lib/clc/nil-prompts.ts` | 5 |
| `lib/azure-keyvault.ts` | 5 |
| `lib/ai/pipeline.ts` | 5 |
| `components/ui/chart.tsx` | 9 |
| `components/rewards/recognition-feed.tsx` | 5 |
| `components/education/quiz-builder.tsx` | 5 |
| `components/communication/notification-preferences.tsx` | 5 |
| `components/automation/automation-workflow-builder.tsx` | 5 |
| `components/accessibility/accessibility-dashboard.tsx` | 5 |
| `app/api/icra/submit/route.ts` | 5 |

## Remaining hot spots (top of ~835 files)

Self-contained query/service files are low-risk and follow the recipe directly.
The API client and React components cascade widely and need real domain types.

| File | approx any | risk |
| --- | --- | --- |
| `lib/api/index.ts` | 48 | HIGH — response generics cascade to many components; needs real domain response types, not `unknown` |
| `lib/graphql/resolvers.ts` | 25 | medium |
| `lib/workers/report-worker.ts` | 20 | medium (tsconfig-excluded; structurally messy) |
| `lib/gdpr/consent-manager.ts` | 16 | medium (tsconfig-excluded) |
| `lib/workers/notification-worker.ts` | 14 | medium (tsconfig-excluded) |
| `services/financial-service/src/services/payment-processing.ts` | 15 | medium (tsconfig-excluded) |
| `lib/documents/batch-operations-service.ts` | 7 | HIGH — DEFERRED: uses `getDatabase()` (multi-db client) whose schema differs from `@/db`; casting to the real `AppDb` surfaces ~10 genuine column mismatches (e.g. `auditLogs` has `auditId`/`organizationId`/`resourceId`, code inserts `id`/`tenantId`/`resourceIds`). Needs the multi-db schema types before de-anying. |

Test files (`**/*.test.ts`, e.g. `workflow-engine.test.ts` 35, `workflows.test.ts`
26, `rbac-server.test.ts` 22) are lower-priority and lower-risk; do them last.

## Recommended order

1. Query/service layers that follow the recipe cleanly (like the completed set).
2. Workers and server-side utilities.
3. GraphQL resolvers and API guards (define request/response types).
4. `lib/api/index.ts` — dedicated pass introducing real domain response types so
   component callers stay green.
5. React components.
6. Test files.

After each file: re-run `tsc`, lint it strict, then add it to the ratchet list.
