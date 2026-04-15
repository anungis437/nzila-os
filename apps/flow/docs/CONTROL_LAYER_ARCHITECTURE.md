# Flow — Control Layer Architecture

## Overview

All business-critical state mutations in Flow go through a single, auditable pipeline: the **Command Bus**. There is no other way to mutate order, payment, PO, or production state.

```
UI / Server Action
       │
       ▼
 executeCommand(command, context)  ← lib/control/command-bus.ts
       │
       ├─ 1. Validate command input (Zod schema)
       ├─ 2. Load domain state
       ├─ 3. Run invariant checks
       ├─ 4. Run workflow validation
       ├─ 5. Run payment/production/shipment guards
       ├─ 6. Persist domain mutation
       ├─ 7. Emit domain events
       ├─ 8. Write audit metadata
       ├─ 9. Dispatch external side effects (async)
       └─ 10. Return CommandResult
```

## Key Files

| File | Role |
|------|------|
| `lib/control/command-bus.ts` | Central pipeline; executes handlers; event emission guardrail |
| `lib/control/register-handlers.ts` | Registers all 30 command handlers at startup |
| `lib/control/register-integrations.ts` | Registers all 4 side-effect handlers |
| `lib/control/types.ts` | Canonical TypeScript types for the control layer |
| `lib/control/handlers/*.handler.ts` | One file per command type; each is the authoritative mutation site |
| `lib/control/guards/payment-guard.ts` | Payment gate — called by PO and production handlers |
| `lib/control/guards/workflow-guard.ts` | Workflow state machine enforcement |
| `lib/control/dispatch/side-effect-dispatcher.ts` | Fire-and-forget external integration calls |

## Handler Naming Convention

Every command `TYPE_LIKE_THIS` has a handler at `lib/control/handlers/type-like-this.handler.ts`.

## Payment Guard Integration

Handlers that CREATE or START production call into the payment guard before writing to the DB:

```typescript
// In create-purchase-order.handler.ts
const gate = await checkCanGeneratePO(command.orderId, context.org_id)
if (!gate.allowed) throw new FlowWorkflowError('PAYMENT_GATE_BLOCKED', gate.reasons.join('; '))
```

## Event Emission Guardrail

The command bus checks that critical commands emit at least one domain event on success. If not, `event_emission_gap_count` is incremented in the governance telemetry:

```typescript
if (result.success && CRITICAL_COMMANDS.has(command.type)) {
  const emittedCount = result.emitted_event_ids?.length ?? 0
  if (emittedCount === 0) {
    logger.error('Critical command succeeded without emitting domain event', ...)
    recordEventEmissionGap()
  }
}
```

## Adding a New Command

1. Create `lib/control/handlers/your-command.handler.ts`
2. Implement `CommandHandler<YourCommandInput>`:
   - Validate with Zod
   - Load state from repos (read-only)
   - Apply guards
   - Mutate via repo
   - Emit event via `dispatchDomainEvent`
   - Return `CommandResult`
3. Register in `lib/control/register-handlers.ts`
4. Add the command type to `CRITICAL_COMMANDS` in `command-bus.ts` if it's lifecycle-critical
