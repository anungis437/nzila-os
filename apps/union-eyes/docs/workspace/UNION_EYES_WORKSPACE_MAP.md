# Union Eyes Workspace Map

> Pattern: Club360-style workspace consolidation (see
> [UNION_EYES_WORKSPACE_DOCTRINE.md](./UNION_EYES_WORKSPACE_DOCTRINE.md))

Following the Club360 pattern, **no legacy route is deleted**. Each existing
Union Eyes dashboard route is subordinated to exactly one workspace tab and kept
alive as an execution surface until workspace adoption is proven by telemetry.

## Legend

**Workspace Tab** — one of: Overview, Case Operations, Members, Governance,
Continuity, Financial, Documents.

**Role:**
- `deep-work surface` — linked directly from a tab's Deep Work section
- `source surface` — feeds a tab's Current State / Required Actions (now or later)
- `candidate for retirement` — overlaps another surface; review after adoption
- `unmapped` — not yet assigned to a tab

**Retirement Status:**
- `keep`
- `subordinate`
- `review later`
- `retire only after adoption proof`

## Map

| Legacy Route | Workspace Tab | Role | Retirement Status |
| --- | --- | --- | --- |
| `/dashboard` | Overview | source surface | keep |
| `/dashboard/analytics` | Overview | source surface | review later |
| `/dashboard/reports` | Overview | source surface | subordinate |
| `/dashboard/intelligence` | Continuity | source surface | review later |
| `/dashboard/cases` | Case Operations | deep-work surface | keep |
| `/dashboard/claims` | Case Operations | deep-work surface | keep |
| `/dashboard/grievances` | Case Operations | deep-work surface | keep |
| `/dashboard/inbox` | Case Operations | deep-work surface | subordinate |
| `/dashboard/priorities` | Case Operations | deep-work surface | subordinate |
| `/dashboard/work` | Case Operations | source surface | review later |
| `/dashboard/workbench` | Case Operations | source surface | review later |
| `/dashboard/arbitration` | Case Operations | source surface | review later |
| `/dashboard/members` | Members | deep-work surface | keep |
| `/dashboard/member` | Members | deep-work surface | keep |
| `/dashboard/stewards` | Members | deep-work surface | subordinate |
| `/dashboard/organizer` | Members | source surface | review later |
| `/dashboard/organizing` | Members | source surface | review later |
| `/dashboard/governance` | Governance | deep-work surface | keep |
| `/dashboard/governance-center` | Governance | deep-work surface | keep |
| `/dashboard/governance-culture` | Governance | source surface | review later |
| `/dashboard/governance-recommendations` | Continuity | deep-work surface | subordinate |
| `/dashboard/compliance` | Governance | deep-work surface | keep |
| `/dashboard/compliance-admin` | Governance | source surface | review later |
| `/dashboard/audits` | Governance | deep-work surface | subordinate |
| `/dashboard/committees` | Governance | deep-work surface | subordinate |
| `/dashboard/elections` | Governance | deep-work surface | subordinate |
| `/dashboard/voting` | Governance | source surface | subordinate |
| `/dashboard/trust` | Governance | source surface | review later |
| `/organizational-continuity-risk` | Continuity | deep-work surface | retire only after adoption proof |
| `/institutional-continuity-risk` | Continuity | deep-work surface | retire only after adoption proof |
| `/continuity-assessment/start` | Continuity | deep-work surface | keep |
| `/continuity-assessment/results` | Continuity | source surface | keep |
| `/ocra` | Continuity | candidate for retirement | retire only after adoption proof |
| `/oci` | Continuity | candidate for retirement | retire only after adoption proof |
| `/dashboard/continuity-intelligence` | Continuity | deep-work surface | subordinate |
| `/dashboard/continuity-planning` | Continuity | deep-work surface | subordinate |
| `/dashboard/continuity-simulation` | Continuity | source surface | review later |
| `/dashboard/institutional-memory` | Continuity | deep-work surface | subordinate |
| `/dashboard/institutional-chronology` | Continuity | source surface | review later |
| `/dashboard/knowledge-transfer` | Continuity | deep-work surface | subordinate |
| `/dashboard/knowledge` | Continuity | source surface | review later |
| `/dashboard/leadership` | Continuity | deep-work surface | subordinate |
| `/dashboard/dues` | Financial | deep-work surface | keep |
| `/dashboard/finance` | Financial | deep-work surface | keep |
| `/dashboard/financial` | Financial | deep-work surface | keep |
| `/dashboard/strike-fund` | Financial | deep-work surface | subordinate |
| `/dashboard/pension` | Financial | deep-work surface | subordinate |
| `/dashboard/pay` | Financial | source surface | review later |
| `/dashboard/billing-admin` | Financial | source surface | review later |
| `/dashboard/documents` | Documents | deep-work surface | keep |
| `/dashboard/agreements` | Documents | deep-work surface | keep |
| `/dashboard/clause-library` | Documents | deep-work surface | subordinate |
| `/dashboard/knowledge-base` | Documents | deep-work surface | subordinate |
| `/dashboard/precedents` | Documents | deep-work surface | subordinate |
| `/dashboard/content` | Documents | source surface | review later |

## Notes

- OCI/OCRA routes (`/organizational-continuity-risk`,
  `/institutional-continuity-risk`, `/ocra`, `/oci`,
  `/continuity-assessment/*`) are subordinated under **Continuity** — never as a
  top-level workspace. Their scoring and routing behavior is untouched.
- Routes marked `retire only after adoption proof` may only have their standalone
  navigation removed once `absorbed_by_workspace` telemetry consistently shows
  their traffic flowing through the workspace.
- Routes not listed here are `unmapped` for v1 and will be assigned in a later
  pass; they remain reachable through existing navigation.
