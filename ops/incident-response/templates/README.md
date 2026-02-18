# Incident Response — Templates

**Owner:** CISO  
**Review Cadence:** Semi-annually or after major incident

## Available Templates

### 1. Postmortem Template

Use this template for all P1/P2 post-incident reviews.

```markdown
# Postmortem: {INCIDENT_ID}

**Date:** {YYYY-MM-DD}  
**Severity:** P{N}  
**Duration:** {duration}  
**Author:** {name}  
**Reviewers:** {names}

## Summary
{One paragraph summary of what happened}

## Timeline (UTC)
| Time | Event |
|---|---|
| HH:MM | Alert triggered |
| HH:MM | Incident declared |
| HH:MM | Containment complete |
| HH:MM | Root cause identified |
| HH:MM | Service restored |
| HH:MM | Incident closed |

## Root Cause
{Detailed root cause analysis}

## Impact
- Users affected: {count}
- Data exposed: {yes/no, details}
- Revenue impact: {estimate}
- SLA breach: {yes/no}

## Remediation Items
| # | Action | Owner | Deadline | Status |
|---|---|---|---|---|
| 1 | {action} | {owner} | {date} | Open |

## Lessons Learned
{What went well, what didn't, what to improve}
```

### 2. Incident Ticket Template

```markdown
**Title:** [P{N}] {Brief description}
**Severity:** P{N}
**Reported by:** {name}
**Assigned to:** {on-call engineer}
**Entity affected:** {entity_id}
**Systems affected:** {list}
**Current status:** Investigating | Contained | Resolved
```

## Evidence to Capture

When using these templates:

1. **Export the completed postmortem** as PDF
2. **Upload to Azure Blob** via `@nzila/blob`:
   - Container: `evidence`
   - Path: `{entity_id}/incident-response/{YYYY}/{MM}/postmortem/{incident_id}/postmortem.pdf`
3. **Record in `documents` table** with `sha256`, `retention_class = '7_YEARS'`
4. **Create `audit_event`** with `action = 'postmortem_uploaded'`
5. **Generate evidence pack index** using `tooling/scripts/generate-evidence-index.ts`
