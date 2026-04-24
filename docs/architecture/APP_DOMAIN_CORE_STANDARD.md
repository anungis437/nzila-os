# App Domain-Core Standard — Nzila OS

> Canonical internal architecture for production-grade applications.
> All serious apps should converge toward this structure so the platform
> feels like one product family.
>
> Machine-readable: `apps/<app>/app-architecture.meta.json`
> Compliance check: `pnpm app:domain-core:check`

---

## Target Apps

| App | Tier | Domain | Adoption Status |
|-----|------|--------|----------------|
| union-eyes | PRODUCTION | Union/Labour | Partial — services, workflows, queries, events exist |
| flow | PRODUCTION | Commerce | Full — services, workflows, domain core, governance, evidence |
| zonga | INCUBATING | Media | Partial — workflows exist |
| cfo | PILOT | Finance | Not started |
| partners | PILOT | Commerce | Not started |
| control-plane | PILOT | Platform | Adapted version |
| web | PRODUCTION | Platform | Lighter alignment |

---

## Canonical Layers

### `domain/`

**Purpose**: Canonical entities, invariants, domain types, and source-of-truth state concepts.

**Contains**:

- Entity type definitions (`claim.ts`, `quote.ts`, `release.ts`)
- Domain invariants and validation rules
- Value objects and domain enums
- Aggregate root definitions

**Rules**:

- No side effects — pure types and validation
- No imports from `services/`, `workflows/`, or `ui/`
- Source of truth for business terminology
- Shared across the app

**Example**:

```typescript
// domain/claim.ts
export interface Claim {
  id: string
  organizationId: string
  memberId: string
  status: ClaimStatus
  type: ClaimType
  filedAt: string
  slaDeadline: string
}

export type ClaimStatus = 'draft' | 'filed' | 'assigned' | 'investigating' | 'resolved' | 'escalated' | 'withdrawn' | 'closed'
```

---

### `services/`

**Purpose**: Business actions, orchestration, and side-effect coordination.

**Contains**:

- Business logic that operates on domain entities
- Orchestration of multiple domain operations
- External service integration coordination
- Transaction boundaries

**Rules**:

- May import from `domain/` and `queries/`
- May emit events via `events/`
- Must use `workflows/` for state transitions (not bypass them)
- No UI dependencies

**Example**:

```typescript
// services/claims-service.ts
export async function fileClaim(input: FileClaimInput): Promise<Claim> {
  validate(input)
  const claim = await createClaim(input)
  await transitionClaim(claim.id, 'filed')
  await emitEvent('claim.filed', { claimId: claim.id })
  return claim
}
```

---

### `workflows/`

**Purpose**: State machines, lifecycle transitions, and gating rules.

**Contains**:

- Finite state machines (FSMs)
- Lifecycle transition definitions
- Transition guard/gating logic
- Workflow templates

**Rules**:

- Source of truth for lifecycle state
- All state transitions must go through workflow layer
- Services must call workflows, not directly mutate state
- Guards are pure functions — no side effects

**Example**:

```typescript
// workflows/claim-fsm.ts
export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  draft: ['filed', 'withdrawn'],
  filed: ['assigned', 'withdrawn'],
  assigned: ['investigating', 'escalated'],
  // ...
}
```

---

### `queries/`

**Purpose**: Read models, projections, and reporting-oriented data fetches.

**Contains**:

- Database queries optimized for reading
- Aggregation and reporting logic
- Dashboard data projections
- List/search/filter operations

**Rules**:

- Read-only — never mutate state
- May import from `domain/` for types
- Must not call `services/` or `workflows/`
- Optimized for the consumer (UI, API, reports)

**Example**:

```typescript
// queries/claim-queries.ts
export async function getClaimsByOrganization(orgId: string): Promise<ClaimSummary[]> {
  return db.select().from(claims).where(eq(claims.organizationId, orgId))
}
```

---

### `events/`

**Purpose**: Domain events emitted by the app and event schemas.

**Contains**:

- Event type definitions
- Event emission helpers
- Event schemas for validation
- Event bus integration

**Rules**:

- Events are facts — immutable records of what happened
- Event names follow `<entity>.<past-tense-verb>` pattern
- Events must include `organizationId` for multi-org isolation
- App-local events may be promoted to platform events via `@nzila/platform-events`

**Example**:

```typescript
// events/claim-events.ts
export type ClaimEvent =
  | { type: 'claim.filed'; payload: { claimId: string; organizationId: string } }
  | { type: 'claim.assigned'; payload: { claimId: string; assigneeId: string } }
  | { type: 'claim.resolved'; payload: { claimId: string; resolution: string } }
```

---

### `ui/`

**Purpose**: Presentation layer — route, page, and component organization.

**Contains**:

- Page components (typically in `app/` for Next.js)
- Reusable UI components (typically in `components/`)
- Layout and navigation
- Form handling and user interaction

**Rules**:

- No hidden business logic — delegate to `services/`
- No direct database queries — use `queries/` or API routes
- No state machine transitions — call `services/` which use `workflows/`
- May import from `domain/` for types only

---

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|-------------|----------------|-----------------|
| UI computing core business state directly | Business logic leaks into presentation | Use `services/` or `queries/` |
| Services bypassing workflow/state machine rules | State integrity violations | Always transition through `workflows/` |
| Queries embedded ad hoc inside UI files | Read logic scattered everywhere | Centralize in `queries/` |
| Domain state reconstructed from audit logs | Audit is observation, not source of truth | Domain state lives in `domain/` |
| Route handlers containing business orchestration | API layer does too much | Delegate to `services/` |
| Direct DB mutations in API routes | Bypasses service and workflow layers | Route → Service → Workflow → DB |

---

## Migration Strategy

Apps are **not** required to move every file immediately. The migration approach is:

1. **Create the canonical directories** (`domain/`, `services/`, `workflows/`, `queries/`, `events/`)
2. **Add barrel exports** (`index.ts`) that re-export from current locations
3. **Migrate highest-value business logic first** (state machines, core services)
4. **Prevent further drift** — new business logic goes into the canonical structure
5. **Gradual migration** — move remaining logic as files are touched

### Priority Migration Targets

| App | Priority Migrations |
|-----|-------------------|
| union-eyes | Claim FSM (already in services/), assignment logic, SLA workflows |
| flow | Quote lifecycle, payment gating, PO/production gating, supplier ranking |
| zonga | Release lifecycle, creator onboarding, listener actions, moderation state |
| cfo | Financial report logic, adjustment workflows, export rules |
| partners | Onboarding lifecycle, contract handling, revenue/update workflows |
| control-plane | Summary queries, recommendation/anomaly orchestration as services/queries |

---

## Compliance

- Machine-readable: `apps/<app>/app-architecture.meta.json`
- Check: `pnpm app:domain-core:check`
- See also: [ARCHITECTURE_GOVERNANCE_INDEX.md](ARCHITECTURE_GOVERNANCE_INDEX.md)
