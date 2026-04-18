# Flow Revenue Playbook (Enterprise SMB Operations)

## Product Positioning

- Product: Flow
- Buyer: Founders, operators, finance leads in SMB and mid-market teams
- Purchase trigger: Fragmented CRM/invoicing workflow, slow cash conversion, poor operational visibility
- Deployment posture: Pilot-safe with staged implementation

## 1) Pricing Model

- Base model: Subscription per operating entity plus onboarding package
- Price drivers:
  - Number of users and active pipelines
  - Integration requirements (accounting, commerce, payments)
  - Automation depth (reminders, onboarding workflows)
  - Support and onboarding level
- Commercial guardrails:
  - Pilot-first for accounts with legacy workflow complexity
  - Scope-based implementation pricing only after discovery

## 2) Packaging Tiers

- Starter: Pipeline + invoicing + baseline reminders
- Growth: Starter + advanced automation + team-level reporting + SLA support
- Enterprise Ops: Growth + integration orchestration + executive reporting + governance controls

## 3) Onboarding Flow

1. Workflow discovery and baseline KPI capture
2. Pipeline and invoicing configuration
3. Integration setup and data migration
4. Team enablement and usage instrumentation
5. Pilot performance review and conversion

## 4) ROI Calculator Model

- Inputs:
  - Lead-to-quote cycle time
  - Quote-to-cash cycle time
  - Collection delay and overdue volume
  - Manual coordination hours
- Outputs:
  - Improved conversion velocity
  - Reduced time-to-value for onboarding and invoicing
  - Reduction in overdue receivables
  - Operating hours saved
- Rule: ROI outputs must use observed pilot data where available.

## 5) Case Study Template

- Customer operating profile
- Baseline metrics and process gaps
- Pilot configuration and timeline
- Before/after KPI deltas
- Lessons learned and rollout decision

## 6) Pilot Deployment Checklist

- Reference: docs/buyers/pilot-readiness-checklist.md
- Product-specific gates:
  - Reminder dispatch workflow validated with real invoices
  - Onboarding trigger validated for new organizations
  - Pipeline and receivable views validated by operator team

## 7) Support Model

- Reference: docs/buyers/sla-support-model.md
- Recommended tier for early pilots: Enhanced support with weekly optimization reviews

## 8) Implementation Timeline (Typical)

- Week 1: Discovery, baseline metrics, onboarding plan
- Week 2: Data and integration setup
- Week 3: Workflow activation and training
- Week 4-6: Pilot operations and KPI review

## 9) Security One-Pager (Buyer Summary)

- Authentication model: @nzila/platform-auth with optional Entra federation
- Operational integrity: Orchestrator-backed idempotent workflow dispatch
- Auditability: Event traces and pilot metrics retained in platform DB tables
- Disclosure policy: No unsupported compliance claims

## 10) Executive Demo Flow

1. Show lead-to-quote-to-invoice operating path
2. Show reminder dispatch automation in context
3. Show onboarding trigger for new organization setup
4. Show pilot metrics and health scoring view
5. Close with conversion milestones and expansion path

## Notes

- Source-of-truth status is governed by governance/portfolio/product-catalog.json and nzila-truth-manifest.json.
- Commercial claims must remain consistent with observed pilot evidence.
