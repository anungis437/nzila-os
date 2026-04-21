# ITSM Command Center — Architecture

## Overview

The ITSM Command Center is a first-party service management module inside NzilaOS.  
It follows the established monorepo pattern: shared logic lives in a workspace package (`@nzila/itsm-core`), the API surface is mounted on the orchestrator, and UI lives in the console + platform-admin apps.

```
packages/
  itsm-core/           Core logic, FSM, SLA engine, types, NIL prompts
  db/src/schema/itsm.ts  Database schema (Drizzle ORM / PostgreSQL)

apps/
  orchestrator-api/routes/itsm.ts   REST API (Fastify, 10 endpoints)
  console/(dashboard)/itsm/         Operator UI (12 Next.js pages)
  platform-admin/itsm-config/       Admin config hub (5 sub-pages)
```

---

## Package: `@nzila/itsm-core`

| Module | Purpose |
|---|---|
| `src/types.ts` | Zod schemas + TypeScript types for all ITSM entities |
| `src/ticket-fsm.ts` | Finite-state machine for ticket lifecycle (9 states, 16 transitions) |
| `src/sla.ts` | SLA computation: due dates, breach detection, attainment, MTTR |
| `src/ticket-number.ts` | Human-readable ticket numbers (`INC-0042`, `RFC-0007`) |
| `src/asset-risk.ts` | CMDB asset risk scoring (0–100) |
| `src/automation.ts` | No-code automation rule evaluator + 3 built-in templates |
| `src/nil-prompts.ts` | NIL use-case contracts for 5 AI capabilities |

---

## Database Schema (`packages/db/src/schema/itsm.ts`)

### Enums

| Enum | Values |
|---|---|
| `ticketTypeEnum` | incident, service_request, change, problem, question, maintenance, access, security, procurement, other |
| `ticketStatusEnum` | new, triaged, assigned, in_progress, pending_user, pending_third_party, resolved, closed, cancelled |
| `priorityEnum` | p1_critical, p2_high, p3_medium, p4_low |
| `changeTypeEnum` | standard, normal, emergency |
| `problemStatusEnum` | open, under_investigation, root_cause_identified, fix_in_progress, resolved, closed |
| `assetTypeEnum` | server, workstation, laptop, mobile, network_device, software, license, database, service, other |
| `assetStatusEnum` | in_use, spare, decommissioned, maintenance |
| `changeApprovalStatusEnum` | pending, approved, rejected, withdrawn |
| `kbStatusEnum` | draft, review, published, archived |

### Tables

| Table | Rows held | Key FK |
|---|---|---|
| `itsmQueues` | Service desk queues | `orgId` |
| `itsmSlas` | SLA profile overrides | `orgId`, `queueId?` |
| `itsmContracts` | MSP/client contracts | `orgId`, `clientOrgId`, `slaId?` |
| `itsmTickets` | Service tickets | `orgId`, `queueId?`, `contractId?` |
| `itsmTicketEvents` | Immutable event log | `ticketId`, `actorId` |
| `itsmAssets` | CMDB CI records | `orgId` |
| `itsmProblems` | Problem records | `orgId`, `linkedTicketIds[]` |
| `itsmChanges` | Change records (RFC) | `orgId`, `platformChangeId?` |
| `itsmApprovals` | Multi-step approvals | `changeId`, `approverId` |
| `itsmKbArticles` | Knowledge Base articles | `orgId` |

All tables carry `orgId` — every query **must** include an org filter.

---

## API Routes (`apps/orchestrator-api/src/routes/itsm.ts`)

All routes mounted at `/itsm` prefix.

| Method | Path | Description |
|---|---|---|
| `POST` | `/tickets` | Create ticket, apply automation rules, emit domain event |
| `GET` | `/tickets` | List tickets (filter by orgId, status, type, priority) |
| `GET` | `/tickets/:id` | Fetch single ticket |
| `POST` | `/tickets/:id/transition` | FSM state transition via `attemptTransition()` |
| `POST` | `/tickets/:id/events` | Append event to immutable log |
| `POST` | `/assets` | Register CMDB asset |
| `GET` | `/assets` | List assets by orgId |
| `POST` | `/kb` | Create KB article |
| `GET` | `/kb` | List KB articles (published only) |
| `GET` | `/health` | Liveness check |

### FSM Transition

```ts
const result = attemptTransition(ticketMachine, ticket, toState, {
  actorId, role, metadata,
})
if (!result.success) reply.code(422).send({ error: result.reason })
```

---

## Ticket Lifecycle (FSM)

```
new → triaged → assigned → in_progress → resolved → closed
           ↓                    ↓            ↓
        cancelled         pending_user   cancelled
                          pending_third_party
```

Terminal state: `closed`  
All transitions are role-gated via `ItsmRole`: `itsm_agent | itsm_manager | itsm_change_approver | itsm_client_viewer`

---

## SLA Engine

Priority targets (default profile):

| Priority | First Response | Resolution |
|---|---|---|
| P1 Critical | 15 min | 4 hr |
| P2 High | 1 hr | 8 hr |
| P3 Medium | 4 hr | 3 days |
| P4 Low | 8 hr | 7 days |

Key functions:
- `computeSlaDueDates(createdAt, priority, targets)` → `{ firstResponseDue, resolutionDue }`
- `isSlaBreached(ticket, now)` → `boolean`
- `minutesUntilBreach(ticket, now)` → `number`
- `computeSlaAttainment(tickets)` → `{ responseAttainment, resolutionAttainment }` (0–1)
- `computeMttr(resolvedTickets)` → mean minutes

---

## NIL Intelligence

ITSM registers 5 AI use-cases in the Nzila Intelligence Layer:

| Use-Case Key | Capability |
|---|---|
| `itsm_ticket_triage` | Auto-suggest priority, queue, category from free text |
| `itsm_sla_breach_prediction` | Score breach probability for in-flight tickets |
| `itsm_duplicate_detection` | Find semantically similar open tickets |
| `itsm_kb_suggest` | Recommend relevant KB articles |
| `itsm_response_draft` | Draft agent response messages |

`app` key in `IntelligenceRequest`: `'itsm'` (registered in `@nzila/intelligence`).

---

## Auth & RBAC

| Platform Role | Capabilities |
|---|---|
| `itsm_agent` | Create tickets, add events, transition within standard paths |
| `itsm_manager` | All agent permissions + SLA config, queue management, reports |
| `itsm_change_approver` | Approve/reject RFC change records |
| `itsm_client_viewer` | Read own org's tickets and contracts (read-only) |

Role values are declared in `@nzila/platform-contracts` (`platformRoleValues`).

---

## Automation Engine

Three built-in templates (from `@nzila/itsm-core`):

1. **VIP P1 Escalation** — Escalate P1 tickets to manager if unassigned after 10 min
2. **No Response Escalation** — Escalate when ticket sits in `pending_user` for 48 hr
3. **Recurring Incident → Problem** — Trigger problem creation when same category fires 3×

Custom rules stored in DB as JSONB; evaluated on every ticket mutation via `evaluateAutomationRules()`.
