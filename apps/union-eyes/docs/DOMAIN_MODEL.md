# Domain Model — Union-Eyes

> Canonical reference for Union-Eyes domain entities, state machines,
> events, and audit surfaces. See also: docs/DOMAIN_VS_AUDIT_MODEL.md

## Primary Entities

| Entity | Table(s) | Purpose |
|--------|----------|---------|
| Org | `orgs` | Organisation root |
| Union | `unions` | Union / labour organisation |
| Member | `members`, `profiles_v2` | Union member record |
| Grievance | `grievances` | Worker grievance case |
| CBA | `collective_bargaining_agreements` | Collective bargaining agreement |
| Employer | `employers` | Employer entity |
| Claim | `claims` | Member claim against employer |
| Election | `elections`, `voting` | Democratic election + ballot |
| Certification | `certifications` | Union certification record |
| Congress | `congress_memberships` | Congress membership |
| Document | `documents` | Document store |
| E-Signature | `e_signatures` | Digital signature record |
| Deadline | `deadlines`, `calendar` | Regulatory / procedural deadlines |
| Payment | `payments`, `financial_records` | Financial transaction |
| Notification | `notifications` | Member notification |

## Primary State Tables (Source of Truth)

These tables are the **single source of truth** for current entity state:

- `grievances` — current grievance status, assignment, resolution
- `elections` — current election phase, candidates, results
- `members` — current membership status, role, profile
- `claims` — current claim status, evidence, determination
- `collective_bargaining_agreements` — current CBA terms, validity

## Workflow State Machines

| State Machine | File | States |
|---------------|------|--------|
| Grievance | `lib/workflows/grievance-state-machine.ts` | filed → under_review → investigation → mediation → arbitration → resolved / dismissed |

## Emitted Events

| Event | Trigger | Consumer |
|-------|---------|----------|
| `grievance.filed` | New grievance created | Intelligence, Audit |
| `grievance.escalated` | Moved to next phase | Intelligence, Notifications |
| `election.started` | Election opened | Notifications, Audit |
| `election.completed` | Results certified | Governance, Audit |
| `member.joined` | New member registered | Analytics, Notifications |
| `cba.ratified` | Agreement ratified | Governance, Audit |

## Audit Surfaces

| Surface | Purpose | Tables |
|---------|---------|--------|
| Governance timeline | Track governance decisions | `audit_entries` |
| Evidence export | Generate compliance packs | `evidence_packs` |
| Election audit trail | Ballot integrity proof | `audit_entries` (election scope) |
| Grievance evidence | Case evidence chain | `evidence_packs` |

## What is NOT a Source of Truth

| Data | Why Not |
|------|---------|
| `audit_entries` | Traceability only — do not query for current grievance/election state |
| `evidence_packs` | Export artefacts — do not use as primary business query source |
| `platform_events` | Signals — may be replayed, delayed, or out of order |
| Intelligence signals | AI-derived — always advisory, never authoritative for entity state |
