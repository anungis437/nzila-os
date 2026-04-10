# TypeScript Error Inventory

Generated after removing `// @ts-nocheck` from **431 files** across the Union Eyes codebase.

## Summary

- **Total errors**: 2,795
- **Unique files with errors**: 408
- **Files that compile cleanly**: ~23
- **`ignoreBuildErrors`**: temporarily set to `true` in `next.config.ts`

## Errors by Directory

| Directory | Errors |
|-----------|--------|
| app/api | 1,089 |
| lib/integrations | 447 |
| lib/services | 154 |
| lib/jobs | 93 |
| app/[locale] | 69 |
| lib/social-media | 57 |
| lib/external-calendar-sync | 52 |
| lib/graphql | 49 |
| lib/ai | 48 |
| app/admin | 46 |
| lib/analytics | 38 |
| components/admin | 32 |
| app/(marketing) | 31 |
| lib/signature | 27 |
| lib/automation | 26 |
| lib/gdpr | 24 |
| db/queries | 24 |
| db/schema | 23 |
| lib/mobile | 21 |
| lib/utils | 20 |

## Errors by Type

| Code | Description | Count |
|------|-------------|-------|
| TS2339 | Property does not exist on type | 599 |
| TS18046 | Variable is of type `unknown` | 518 |
| TS2345 | Argument not assignable to parameter | 358 |
| TS2304 | Cannot find name | 332 |
| TS2322 | Type not assignable | 305 |
| TS2554 | Expected N arguments, got M | 127 |
| TS2769 | No overload matches this call | 88 |
| TS2300 | Duplicate identifier | 70 |
| TS18004 | No value exists in scope | 57 |
| TS2571 | Object is of type `unknown` | 46 |
| TS2353 | Object literal may only specify known properties | 35 |
| TS2551 | Property does not exist (did you mean?) | 32 |
| TS18047 | Possibly null/undefined | 20 |
| TS2308 | Module has no exported member | 18 |
| TS2305 | Module has no exported member | 17 |

## tsconfig.json Exclude Analysis

The `tsconfig.json` already excludes several directories from compilation.
Errors in excluded files appear because they are **imported by non-excluded files**.

- **Errors in tsconfig-excluded paths**: 865
- **Errors in non-excluded paths**: 1,930

### Excluded paths that still produce errors (via imports)

- `lib/integrations/**` (447 errors)
- `lib/social-media/**` (57 errors)
- `lib/external-calendar-sync/**` (52 errors)
- `lib/graphql/**` (49 errors)
- `lib/gdpr/**` (24 errors)
- `db/schema/**` (23 errors)
- `db/queries/**` (24 errors)
- `services/**`
- `app/api/social-media/**`

## Top 25 Files by Error Count

| File | Errors |
|------|--------|
| `lib/jobs/dues-reminder-scheduler.ts` | 73 |
| `app/api/social-media/analytics/route.ts` | 55 |
| `lib/external-calendar-sync/microsoft-calendar-service.ts` | 52 |
| `lib/graphql/resolvers.ts` | 49 |
| `lib/integrations/adapters/hris/bamboohr-adapter.ts` | 48 |
| `lib/integrations/adapters/hris/workday-client.ts` | 46 |
| `lib/analytics/advanced-metrics.ts` | 38 |
| `app/api/social-media/accounts/route.ts` | 36 |
| `app/api/social-media/campaigns/route.ts` | 35 |
| `lib/integrations/adapters/communication/teams-adapter.ts` | 35 |
| `app/api/v2/ai/classify/route.ts` | 33 |
| `lib/social-media/meta-api-client.ts` | 31 |
| `app/api/documents/route.ts` | 27 |
| `lib/integrations/adapters/hris/adp-adapter.ts` | 26 |
| `lib/automation/story-automation.ts` | 26 |
| `app/api/whop/webhooks/utils/frictionless-payment-handlers.ts` | 24 |
| `lib/gdpr/consent-manager.ts` | 24 |
| `app/api/whop/webhooks/utils/payment-handlers.ts` | 24 |
| `lib/integrations/adapters/lms/linkedin-learning-adapter.ts` | 23 |
| `lib/integrations/adapters/communication/slack-adapter.ts` | 23 |
| `lib/integrations/adapters/documents/sharepoint-adapter.ts` | 22 |
| `app/api/v2/ai/semantic-search/route.ts` | 22 |
| `lib/signature/providers.ts` | 21 |
| `app/api/v2/documents/route.ts` | 20 |
| `app/api/v2/cases/route.ts` | 19 |

## Error Distribution by File

| Errors per file | File count |
|-----------------|------------|
| 1 error | 101 |
| 2 errors | 64 |
| 3–5 errors | 80 |
| 6–10 errors | 84 |
| 11+ errors | 79 |

## Recommended Fix Order

1. **db/schema + db/queries** (47 errors) — Foundation types used everywhere
2. **actions/** (~20 errors) — Server actions used by pages
3. **app/[locale]/** (69 errors) — Active user-facing pages
4. **components/** (~52 errors) — Shared UI components
5. **app/api/v2/** routes — Active API endpoints
6. **lib/services/** (154 errors) — Core business logic
7. **app/api/v1/** routes — Legacy routes (lower priority)
8. **lib/integrations/** (447 errors) — Third-party adapters (aspirational, lowest priority)

## Resolution Strategy

Each follow-up PR should:
1. Pick a directory or error category from the list above
2. Fix actual type errors (add types, fix imports, update signatures)
3. Run `pnpm exec tsc --noEmit` to verify error count decreases
4. Once all errors are resolved, set `ignoreBuildErrors: false` in `next.config.ts`
