# Domain Expertise Map

> Last updated: April 2026. Update when team assignments change.

---

## Purpose

This map prevents knowledge silos by making domain ownership explicit, identifying cross-training needs, and defining the quarterly rotation cadence.

---

## Domain Teams

### Commerce Domain

**Apps**: `flow`, `trade`, `zonga`, `agrimo`
**Primary owner**: Commerce team
**Deputy**: Platform Engineering (escalation)
**Key knowledge areas**: Order lifecycle, payment flows (Stripe), revenue ledger (DAPL), media transcoding
**Bus factor risk**: Trade order processing and DAPL ledger logic — high complexity, document in ADRs

### Union Domain

**Apps**: `union-eyes`
**Primary owner**: Union team
**Deputy**: Platform Engineering (for DB schema changes)
**Key knowledge areas**: Member management, case timelines, break-glass access (Shamir threshold crypto), Django sidecar, org isolation
**Bus factor risk**: Shamir threshold implementation — requires 2-person knowledge minimum

### Finance Domain

**Apps**: `cfo`, `abr`
**Primary owner**: Finance team
**Deputy**: Commerce team (shared ledger concepts)
**Key knowledge areas**: Regulatory reporting, ABR reconciliation, audit evidence packs
**Bus factor risk**: ABR audit pipeline — single-engineer domain today, cross-training target for Q3 2026

### Identity & Platform Domain

**Apps**: `console`, `web`, `platform-admin`, `partners`
**Primary owner**: Platform Engineering
**Deputy**: Any senior engineer
**Key knowledge areas**: `@nzila/platform-auth` (Argon2id sessions + Entra SSO), org-scoping, RLS, CODEOWNERS
**Bus factor risk**: Auth middleware and org resolver — well-documented in `ARCHITECTURE.md`

### AI & Intelligence Domain

**Apps**: `control-plane`, `orchestrator-api`, `cora`
**Primary owner**: AI/ML team
**Deputy**: Platform Engineering
**Key knowledge areas**: Azure OpenAI integration, prompt injection mitigations, model drift detection, reasoning context envelope
**Bus factor risk**: Prompt template security review — must involve both AI and Security teams

### Mobility & Exams Domain

**Apps**: `mobility`, `mobility-client-portal`, `nacp-exams`
**Primary owner**: Mobility team
**Deputy**: Finance team (shared compliance patterns)
**Key knowledge areas**: NACP exam workflows, client portal auth, mobility scoring
**Bus factor risk**: NACP exam state machine — underdocumented, target for Q2 2026 ADR

---

## Cross-Training Matrix

| Domain | Cross-trains with | Focus | Target quarter |
|---|---|---|---|
| Commerce ↔ Finance | ABR/CFO ledger reconciliation | Shared data model | Q2 2026 |
| Union ↔ Platform | Auth integration, org-scoping | Break-glass + session flow | Q2 2026 |
| AI ↔ Security | Prompt injection, model drift | AI incident playbooks | Q3 2026 |
| Mobility ↔ Platform | Auth for client portal | Entra SSO for external users | Q3 2026 |
| Finance ↔ Commerce | Zonga revenue reporting | DAPL ledger extensions | Q4 2026 |

## Mandatory Cross-Training Program (Enforced)

All domains must complete mandatory cross-training hours every quarter. Targets are tracked in `governance/foundations/resilience/succession-and-cross-training.json` and validated in CI.

| Rule | Minimum |
|---|---|
| Quarterly cross-training participation | 100% of engineers in high-risk domains |
| Cross-domain incident drill attendance | At least 2 representatives per domain |
| Evidence submission | Training log + reviewer sign-off in quarterly governance review |

Missed targets require a remediation plan in the next sprint.

---

## On-Call Rotation

Each domain contributes to the platform-wide on-call rotation. Engineers must be cross-trained before taking on-call coverage outside their primary domain.

**Requirements before cross-domain on-call**:

1. Shadow the primary domain engineer for one sprint
2. Walk through a simulated incident using the relevant AI incident playbook or SLO runbook
3. Approved by domain tech lead in writing (Slack or GitHub issue)

---

## Knowledge Transfer SLA

When a domain's primary owner is unavailable (leave, departure):

| Timeline | Required action |
|---|---|
| > 2 weeks absence | Deputy must be briefed; critical runbooks reviewed |
| Permanent departure | ADR or internal wiki page for all non-obvious design decisions within 30 days |
| Team restructuring | Expertise map updated in this document within 1 sprint |

## Succession Alerting Protocol

Succession risk is fail-closed for domains with bus factor 1:

1. If a domain remains with bus factor 1 for > 30 days, raise a governance action item.
2. If a critical owner is unavailable without a documented deputy, block non-emergency releases in that domain.
3. Every high-risk domain must maintain at least 2 validated backups in the succession registry.

Automated checks are enforced via `pnpm validate:strategic-resilience`.

## Diversity and Coverage Metrics

The platform tracks diversity of operational knowledge to reduce concentration risk:

| Metric | Target |
|---|---|
| Cross-domain review share | ≥ 30% |
| Multi-region reviewer participation | ≥ 35% |
| Incident commander diversity over rolling quarter | ≥ 3 domains represented |

---

## Bus Factor Reduction Targets

Priority cross-training investments ranked by risk:

1. **Shamir threshold crypto** (union-eyes) — two engineers must understand the `secrets.js-grempe` integration and key custodian rotation
2. **ABR audit pipeline** — Finance + Commerce cross-training scheduled Q3 2026
3. **NACP exam state machine** — ADR documenting the state transitions planned Q2 2026
4. **DAPL platform ledger** — Commerce + Finance pairing sessions quarterly

---

## Escalation Contacts

For live incidents, see `docs/platform/ALERTING_RUNBOOK.md` for escalation paths.  
For architecture questions, tag domain leads via `CODEOWNERS` in GitHub.
