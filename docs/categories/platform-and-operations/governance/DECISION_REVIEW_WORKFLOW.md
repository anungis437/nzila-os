# Decision Review Workflow

> How humans interact with the Decision Layer.

## Feedback Actions

| Action | Status Transition | Description |
|--------|-------------------|-------------|
| `APPROVE` | → `APPROVED` | Decision endorsed; ready for execution |
| `REJECT` | → `REJECTED` | Decision declined; moves to `CLOSED` on next transition |
| `DEFER` | → `DEFERRED` | Decision postponed; can return to `PENDING_REVIEW` |
| `EXECUTE` | → `EXECUTED` | Decision carried out; moves to `CLOSED` on completion |
| `COMMENT` | No change | Adds reviewer note without changing status |

## Review Process

1. **Decision generated** — engine creates decision with status `GENERATED`
2. **Enters review** — transitions to `PENDING_REVIEW` (automatically or on first view)
3. **Human acts** — reviewer provides feedback via the Control Plane UI
4. **Status updates** — feedback action triggers status transition
5. **Audit recorded** — every action creates an audit trail entry

## Control Plane UI

### Decisions List (`/decisions`)

- Summary cards: total, pending review, critical open, executed
- Critical decisions table (highlighted)
- Pending review table
- All decisions table with sortable columns

### Decision Detail (`/decisions/[id]`)

- Full evidence panel with:
  - Title, ID, severity badge, status badge
  - Summary and explanation
  - Evidence references (linked to source)
  - Recommended actions (ordered list)
  - Policy context (execution allowed / blocked reasons)
  - Metadata (category, type, confidence, environment, timestamps)
  - Required approvals
  - Review history

## Audit Trail

Every lifecycle event is persisted:

| Event | When |
|-------|------|
| `decision_generated` | Engine creates decision |
| `decision_viewed` | User views detail page |
| `decision_approved` | Reviewer approves |
| `decision_rejected` | Reviewer rejects |
| `decision_deferred` | Reviewer defers |
| `decision_executed` | Reviewer marks as executed |
| `decision_expired` | Decision passes expiry date |
| `decision_feedback_recorded` | Any feedback including comments |

## Export

Decision export packs can be generated for procurement evidence or external audit:

```json
{
  "decision_record": { ... },
  "evidence_refs": [ ... ],
  "policy_context": { ... },
  "governance_status_snapshot": { ... },
  "change_status_snapshot": { ... },
  "output_hash": "sha256:...",
  "exported_at": "2025-..."
}
```

The `output_hash` provides integrity verification for the export pack contents.
