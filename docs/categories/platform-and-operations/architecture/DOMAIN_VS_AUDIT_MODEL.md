# Domain vs Audit Model — Nzila OS

> Anti-entropy guardrail: audit/evidence stores must never be used as the primary
> business state store for core entities unless a documented exception exists.

## Three Data Layers

### 1. Domain Model (Primary Business State)

The domain model is the **source of truth** for current operational state.

| Concern | Examples |
|---------|----------|
| Primary entities | Org, User, Quote, Order, Invoice, Case, Grievance, Election, Trade |
| State machines | Quote lifecycle, Order fulfillment, Case workflow, Election phases |
| Tables | `orgs`, `users`, `quotes`, `orders`, `invoices`, `cases`, `grievances`, `elections` |
| Access pattern | Direct CRUD with org-scoped isolation |
| Ownership | Domain service layer (`lib/services/`, `lib/actions/`) |

**Rule:** Domain state tables are the single source of truth for "what is the current state of entity X?"

### 2. Event Model (Signals & Workflow)

The event model captures what happened and triggers downstream behavior.

| Concern | Examples |
|---------|----------|
| Event emission | `quote.created`, `order.completed`, `grievance.filed`, `vote.cast` |
| Workflow signals | State transitions, approval triggers, escalation signals |
| Integration inputs | External webhook events, CRM sync events |
| Intelligence inputs | Anomaly signals, AI recommendation triggers |
| Tables/Stores | `events`, `platform_events`, `integration_events` |
| Access pattern | Append-only; consumed by subscribers |
| Ownership | `@nzila/platform-events`, `@nzila/platform-event-fabric` |

**Rule:** Events describe what happened. They are not the primary store for current entity state.

### 3. Audit / Evidence Model (Traceability & Proof)

The audit layer provides immutable traceability and compliance evidence.

| Concern | Examples |
|---------|----------|
| Traceability | Who did what, when, and why |
| Proof | Evidence packs, sealed audit trails, governance snapshots |
| Exportability | Compliance exports, procurement evidence, RFP documentation |
| Compliance support | SOC 2, ISO 27001, governance audit trails |
| Tables/Stores | `audit_entries`, `evidence_packs`, `governance_snapshots`, `compliance_snapshots` |
| Access pattern | Append-only; read for reporting, export, and governance views |
| Ownership | `@nzila/evidence`, `@nzila/platform-evidence-pack`, `@nzila/commerce-audit` |

**Rule:** Audit stores exist for traceability and proof. They must NOT be queried as the primary data source for core business entities.

## The Cardinal Rule

```
Audit/event stores must not be used as the primary business state store
for core entities unless a documented exception exists in
tooling/contract-tests/domain-audit-allowlist.json.
```

### What This Means in Practice

| Scenario | Correct | Incorrect |
|----------|---------|-----------|
| Show current quote price | Query `quotes` table | Query audit trail for latest price event |
| Display grievance status | Query `grievances` table | Scan evidence packs for status |
| List active elections | Query `elections` table | Filter audit entries for election events |
| Show governance timeline | Query audit/evidence tables | ✓ (this IS an audit surface) |
| Export compliance evidence | Query evidence packs | ✓ (this IS an evidence view) |
| Replay debug timeline | Query events/audit | ✓ (this IS a debug/audit tool) |

## Allowed Exceptions

Documented in `tooling/contract-tests/domain-audit-allowlist.json`:

1. **Audit views** — pages whose sole purpose is displaying audit trails
2. **Evidence export** — endpoints that generate evidence packs
3. **Governance timelines** — governance dashboard views
4. **Replay/debug tools** — documented diagnostic tools

## Enforcement

- Contract test: `tooling/contract-tests/domain-vs-audit.test.ts`
- Allowlist: `tooling/contract-tests/domain-audit-allowlist.json`
- CI command: `pnpm contract-tests`

### Enforced Apps

| App | Domain Tables | Audit Tables | Enforcement |
|-----|---------------|-------------|-------------|
| Union-Eyes | `elections`, `grievances`, `representatives` | `audit_entries`, `evidence_packs` | ✓ |
| Shop Quoter | `quotes`, `orders`, `products` | `commerce_audit`, `evidence_packs` | ✓ |
| Zonga | `registrations`, `courses`, `assessments` | `audit_entries`, `evidence_packs` | ✓ |
| CFO | `invoices`, `payments`, `accounts` | `audit_entries`, `evidence_packs` | ✓ |
| Partners | `partners`, `agreements`, `commissions` | `audit_entries`, `evidence_packs` | ✓ |

## Migration Guidance

If you find business logic reading from audit/evidence tables as primary state:

1. Identify the correct domain table
2. Move the query to the domain service layer
3. Keep audit emission as a side effect
4. Update any UI components to query domain state
5. Add the old pattern to a test regression to prevent recurrence
