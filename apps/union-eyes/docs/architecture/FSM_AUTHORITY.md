# FSM Authority — UnionEyes Workflow State Machine

## Canonical FSM

**Single source of truth:** `lib/workflow/case-lifecycle.ts`

All new workflow code and all state-transition API routes MUST use `validateTransition()` from this module.

---

## Unified State Model (10 states)

```
draft → submitted → triage → investigation → pending_docs
                                   ↓
                     negotiation → mediation → arbitration → resolved → closed
```

| State | Description | Terminal |
|-------|-------------|----------|
| `draft` | Member preparing, not yet filed | No |
| `submitted` | Filed with union | No |
| `triage` | Under review / acknowledged | No |
| `investigation` | Fact-finding in progress | No |
| `pending_docs` | Blocked on documentation | No |
| `negotiation` | Active discussions with employer | No |
| `mediation` | Alternative dispute resolution | No |
| `arbitration` | Formal arbitration | No |
| `resolved` | Outcome reached | No |
| `closed` | Archived (terminal for standard roles) | Yes |

Sub-classifications (on the case record, not separate states):
- `resolution_type`: `'settled' | 'denied' | 'withdrawn'` 
- `assigned_to`: steward/officer assignment
- `intake_outcome`: `'converted' | 'closed_no_case'`

---

## Enforcement Contract

All state transitions MUST:

1. Call `validateTransition(ctx: TransitionContext)` from `lib/workflow/case-lifecycle.ts`
2. Pass `actorRole` normalized via `normalizeActorRole()` (maps `platform_admin → system_admin`, etc.)
3. Use `toLifecycleState('cupe', status)` from `lib/workflow/state-bridge.ts` to convert CUPE vocabulary IDs to `LifecycleState`
4. Log to audit trail after every allowed transition
5. Use `getAllowedTransitions(state, role)` when returning `nextAllowedStatuses` to callers

---

## Deprecated FSMs

These files are **deprecated** and must NOT be used in new code. Existing call sites have been migrated.

| File | Status | Replacement |
|------|--------|-------------|
| `lib/case-fsm-enforcement.ts` | ⚠️ Deprecated | `lib/workflow/case-lifecycle.ts` |
| `lib/services/case-workflow-fsm.ts` | ⚠️ Deprecated | `lib/workflow/case-lifecycle.ts` |
| `lib/services/claim-workflow-fsm.ts` | ⚠️ Deprecated | `lib/workflow/case-lifecycle.ts` |
| `lib/workflows/grievance-state-machine.ts` | ⚠️ Deprecated | `lib/workflow/case-lifecycle.ts` |

These files remain in the codebase for reference and for `state-bridge.ts` type imports. They must not be called for new transitions.

---

## State Bridge

**`lib/workflow/state-bridge.ts`** provides bidirectional mapping between legacy/vocabulary states and `LifecycleState`.

```typescript
import { toLifecycleState, toLegacyCaseState } from '@/lib/workflow/state-bridge';

// Legacy/CUPE → canonical
const state = toLifecycleState('cupe', 'investigating');  // → 'investigation'
const state2 = toLifecycleState('claim', 'under_review'); // → 'triage'

// Canonical → legacy (for DB writes that still use old enum)
const legacy = toLegacyCaseState('investigation');        // → 'investigating'
```

Supported `fsm` values: `'case' | 'claim' | 'grievance' | 'cupe'`

---

## API Call Site Audit

| Route | Uses canonical FSM? | Notes |
|-------|--------------------|----|
| `app/api/cases/[caseId]/transition/route.ts` | ✅ Yes (migrated) | Was using `validateCUPETransition` (deprecated) |
| `app/api/grievances/[id]/transition/route.ts` | ⚠️ Verify | Check on next audit |
| `app/api/claims/[id]/transition/route.ts` | ⚠️ Verify | Check on next audit |

Run this to find any remaining deprecated FSM imports in API routes:

```powershell
Select-String -Path apps/union-eyes/app/api/**/*.ts `
  -Pattern "(case-workflow-fsm|claim-workflow-fsm|grievance-state-machine|case-fsm-enforcement)" `
  -Recurse
```

---

## Role Normalization

The canonical FSM uses `ActorRole`:

```
'member' | 'steward' | 'chief_steward' | 'officer' | 'admin' | 'system_admin'
```

Map from DB/org roles before calling `validateTransition`:

| DB / org role | ActorRole |
|--------------|-----------|
| `platform_admin` | `system_admin` |
| `business_agent` | `chief_steward` |
| `union_admin` | `admin` |
| `union_staff` | `steward` |
| all others | same |

---

## SLA Standards

Each state has SLA guidance defined in `SLA_STANDARDS` in `case-lifecycle.ts`. `validateTransition` automatically checks SLA compliance and returns warnings when breached (non-blocking).

---

## Adding New Transitions

To add or modify a transition:

1. Edit the `TRANSITIONS` map in `lib/workflow/case-lifecycle.ts`
2. Add or update the `SLA_STANDARDS` entry if a new state is added
3. Update `state-bridge.ts` mappings if the new state needs to map from legacy vocabulary
4. Add a test in `lib/workflow/__tests__/case-lifecycle.test.ts`
5. Update this document

Do NOT add new states to any deprecated FSM file.
