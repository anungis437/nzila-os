# Zonga — Audit Trail Schema

## Overview

Every critical mutation in Zonga writes to the `audit_log` table. This
document defines the schema and all known audit actions.

## Table Schema

```sql
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  action        TEXT NOT NULL,      -- dotted action name
  entity_type   TEXT,               -- e.g. 'payout', 'release', 'ticket'
  entity_id     UUID,               -- FK to the affected entity
  actor_id      TEXT,               -- Clerk user ID or 'system'
  metadata      JSONB DEFAULT '{}', -- additional context
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

## Audit Actions by Domain

### Payout Domain

| Action | Trigger | Metadata |
|--------|---------|----------|
| `payout.executed` | Successful payout | `{ amount, stripeTransferId }` |
| `payout.gated` | Payout blocked by `gatePayout()` | `{ reason }` |
| `payout.compensated` | Post-payout failure recovery | `{ error, correlationId }` |

### Rights Domain

| Action | Trigger | Metadata |
|--------|---------|----------|
| `rights.dispute.filed` | Dispute created | `{ releaseId, reason }` |
| `rights.dispute.payout_freeze` | Payouts frozen on dispute | `{ disputeId }` |
| `rights.dispute.resolved` | Dispute resolved | `{ resolution, outcome }` |
| `rights.dispute.payout_unfreeze` | Payouts unfrozen — no remaining disputes | `{ releaseId }` |

### Revenue Domain

| Action | Trigger | Metadata |
|--------|---------|----------|
| `ledger.revenue.entry` | Revenue event recorded | `{ revenueEventId, amount, source }` |

### Moderation Domain

| Action | Trigger | Metadata |
|--------|---------|----------|
| `moderation.case.created` | New moderation case opened | `{ contentId, reason }` |
| `moderation.case.assigned` | Case assigned to moderator | `{ caseId, assigneeId }` |
| `moderation.case.resolved` | Case resolved/escalated | `{ caseId, resolution, notes }` |

### Release Domain

| Action | Trigger | Metadata |
|--------|---------|----------|
| `release.created` | New release in DRAFT | `{ releaseId, title }` |
| `release.status.transitioned` | FSM transition | `{ from, to }` |
| `release.transition.compensated` | Transition rollback | `{ error, previousStatus }` |

### Ticketing Domain

| Action | Trigger | Metadata |
|--------|---------|----------|
| `ticket.purchased` | Ticket purchase confirmed | `{ eventId, ticketId }` |
| `ticket.purchase.compensated` | Purchase rollback | `{ error }` |

### Creator Domain

| Action | Trigger | Metadata |
|--------|---------|----------|
| `creator.registered` | New creator registered | `{ creatorId }` |

### Command Bus

| Action | Trigger | Metadata |
|--------|---------|----------|
| `command.blocked` | Pre-execution guard blocked command | `{ guard, reason }` |

## Querying Audit Logs

```sql
-- All compensations in last 24h
SELECT * FROM audit_log
WHERE action LIKE '%.compensated'
  AND created_at > NOW() - INTERVAL '24 hours';

-- All payout freezes for a release
SELECT * FROM audit_log
WHERE action = 'rights.dispute.payout_freeze'
  AND metadata->>'releaseId' = '<uuid>';

-- Command blocks by guard name
SELECT metadata->>'guard' AS guard, COUNT(*)
FROM audit_log
WHERE action = 'command.blocked'
GROUP BY 1 ORDER BY 2 DESC;
```
