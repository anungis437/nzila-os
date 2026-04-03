# Evidence Integration Guide — Server Actions

> How to add audit evidence hooks to server action files across the monorepo.

## Quick Start

Every server action file that performs **mutations** (create, update, delete) must produce
evidence packs. Read-only actions (queries, searches, analyses) are exempt.

### Step 1: Import the evidence bridge

Each app has a local `lib/evidence.ts` bridge. Import from there:

```ts
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
```

### Step 2: Add evidence after each mutation

```ts
export async function createFooAction(data: { name: string }) {
  const ctx = await getDbContext()
  const result = await createFoo(ctx, data)
  await processEvidencePack(
    buildEvidencePackFromAction({
      actionType: 'FOO_CREATED',
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      metadata: { fooId: result.id },
    }),
  )
  return result
}
```

### Step 3: Name your action types consistently

Use `ENTITY_VERB` pattern in SCREAMING_SNAKE_CASE:

| Action | Type |
|--------|------|
| Create customer | `CUSTOMER_CREATED` |
| Update order status | `ORDER_STATUS_CHANGED` |
| Delete PO line | `PO_LINE_DELETED` |
| Record payment | `PAYMENT_RECORDED` |
| Adjust stock | `STOCK_ADJUSTED` |

## App-Specific Bridges

| App | Bridge Location | Underlying Package |
|-----|----------------|-------------------|
| Zonga | `apps/zonga/lib/evidence.ts` | `@nzila/os-core/evidence` |
| Flow | `apps/flow/lib/evidence.ts` | `@nzila/commerce-audit` |
| Union-Eyes | `apps/union-eyes/lib/evidence.ts` | `@nzila/os-core/evidence` |

## What to Skip

- **Read-only actions** (queries, searches, list operations)
- **Command bus mutations** (via `executeCommand()`) — the command bus pipeline
  already produces audit entries through its invariant → workflow → audit layers
- **Internal plumbing** (notification dispatch, cache invalidation)

## Contract Test Enforcement

The contract test `tooling/contract-tests/evidence-coverage.test.ts` enforces:

- **EVD-001**: All mutation action files must import `buildEvidencePackFromAction`
- **EVD-002**: Financial action files must call `processEvidencePack`

Exempt files (read-only): search, listener, streaming, notification actions.

## Checklist for New Action Files

- [ ] Import evidence bridge from `@/lib/evidence`
- [ ] Add evidence hook after every successful mutation
- [ ] Use `ENTITY_VERB` naming for `actionType`
- [ ] Include entity ID in `metadata` for updates/deletes
- [ ] Verify the contract test passes: `pnpm contract-tests`
