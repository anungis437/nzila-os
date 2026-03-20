# Zonga — Observability Dashboard Guide

## Overview

Zonga bridges control-plane metrics into the application layer via
`lib/observability.ts`. This document defines all metrics, spans, and
health checks available for dashboarding.

## Metric Constants

### Control-Plane Metrics (via `@nzila/zonga-control-plane`)

| Metric | Emitter Function | When |
|--------|-----------------|------|
| `payout.executed` | `emitPayoutMetric()` | After successful payout |
| `dispute.filed` | `emitDisputeFiledMetric()` | After dispute creation |
| `payout.frozen` | `emitPayoutFreezeMetric()` | After payout freeze |
| `oversell.blocked` | `emitOversellBlockMetric()` | When atomic INSERT prevents oversell |
| `invariant.checked` | `emitInvariantCheckMetric()` | After invariant check run |
| `capacity.utilization` | `emitCapacityMetric()` | Event capacity tracking |

### Application Metrics (`ZONGA_METRIC`)

| Metric | Description |
|--------|-------------|
| `zonga.payout.initiated` | Payout process started |
| `zonga.payout.completed` | Payout finished successfully |
| `zonga.payout.failed` | Payout failed |
| `zonga.stream.started` | Stream playback began |
| `zonga.stream.completed` | Stream finished |
| `zonga.release.published` | Release went live |
| `zonga.event.created` | Event created |
| `zonga.ticket.purchased` | Ticket purchased |
| `zonga.moderation.flagged` | Content flagged |
| `zonga.rights.dispute_filed` | Dispute filed |

## Spans (`ZONGA_SPAN`)

| Span | Description |
|------|-------------|
| `zonga.payout.execute` | Full payout execution |
| `zonga.payout.stripe_transfer` | Stripe API call |
| `zonga.payout.evidence_pack` | Evidence generation |
| `zonga.stream.revenue_attribution` | Revenue attribution calc |
| `zonga.release.transition` | Release state transition |
| `zonga.moderation.review` | Moderation review cycle |

## Health Checks (`ZONGA_HEALTH_CHECKS`)

| Check | What It Validates |
|-------|-------------------|
| `database` | PostgreSQL connection |
| `stripe` | Stripe API reachable |
| `storage` | Azure Blob Storage accessible |
| `clerk` | Clerk auth service reachable |

## Log Attributes

### `buildPayoutLogAttrs(payout)`
Returns: `{ payoutId, creatorId, amount, rail, status }`

### `buildStreamLogAttrs(stream)`
Returns: `{ streamId, trackId, listenerId, platform }`

### `buildGovernanceLogAttrs(action, actor)`
Returns: `{ action, actorId, timestamp, orgId }`

## Recommended Dashboards

### 1. Financial Health
- `payout.executed` rate (per hour)
- `payout.frozen` count (should be near 0)
- `oversell.blocked` count (capacity issues)
- Compensation events (`audit_log WHERE action LIKE '%.compensated'`)

### 2. Content Pipeline
- Release publish rate
- Moderation flagged/approved ratio
- Track upload processing pipeline throughput

### 3. Ticketing Operations
- Ticket purchase rate
- Oversell block rate (T1 violations caught)
- Refund request rate

### 4. System Integrity
- `invariant.checked` pass/fail ratio
- `command.blocked` rate by guard name
- Compensation event rate (should trend toward 0)
