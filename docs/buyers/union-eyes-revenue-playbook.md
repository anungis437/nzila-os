# Union Eyes Revenue Playbook (Enterprise)

## Product Positioning

- Product: Union Eyes
- Buyer: Labour union executives, grievance and representation leaders
- Purchase trigger: High grievance volume, weak evidence continuity, delayed SLA handling, fragmented reporting
- Deployment posture: Pilot-safe, governed rollout, no unsupported production claims

## 1) Pricing Model

- Base model: Annual platform subscription plus implementation package
- Price drivers:
  - Number of represented members
  - Number of active case workers
  - Required integrations and data migration complexity
  - Support tier and response target
- Commercial guardrails:
  - No open-ended fixed-bid delivery for unknown data quality
  - Pilot is mandatory before multi-year enterprise commitment

## 2) Packaging Tiers

- Essential: Case lifecycle + evidence capture + baseline dashboards
- Professional: Essential + advanced SLA operations + escalation workflows + compliance reporting
- Enterprise: Professional + custom integrations + executive analytics + governed proof exports

## 3) Onboarding Flow

1. Executive discovery and success criteria lock
2. Data readiness assessment and migration mapping
3. Security and access model setup (platform-auth + optional Entra SSO)
4. Workflow configuration and operator enablement
5. Pilot run, KPI review, and conversion decision

## 4) ROI Calculator Model

- Inputs:
  - Monthly case volume
  - Average time per case
  - Rework and audit preparation hours
  - Escalation penalties and missed SLA impact
- Outputs:
  - Hours saved per month
  - Reduction in case cycle time
  - Reduction in audit prep effort
  - Estimated annual operational savings
- Rule: Use buyer-provided baseline only; no synthetic assumptions.

## 5) Case Study Template

- Customer profile and operating context
- Baseline pain metrics (before)
- Pilot scope and timeline
- Outcome metrics (after)
- Governance and trust outcomes (audit readiness, evidence integrity)
- Commercial next step and expansion scope

## 6) Pilot Deployment Checklist

- Reference: docs/buyers/pilot-readiness-checklist.md
- Product-specific gates:
  - Evidence seal workflow verified on real pilot cases
  - SLA escalation workflow verified against breach scenarios
  - Role model validated by union leadership and case teams

## 7) Support Model

- Reference: docs/buyers/sla-support-model.md
- Recommended tier for Union Eyes pilots: Enhanced support with daily operating check-ins during first 30 days

## 8) Implementation Timeline (Typical)

- Week 1: Discovery, success criteria, security setup
- Week 2: Data mapping, workflow setup, training plan
- Week 3-4: Pilot go-live and supervised operations
- Week 5-6: KPI review, trust review, commercial conversion decision

## 9) Security One-Pager (Buyer Summary)

- Authentication: @nzila/platform-auth with Argon2id sessions and optional Entra SSO
- Audit posture: Append-only events and evidence-pack workflows
- Secrets management: Azure Key Vault-managed secrets in staging/production paths
- Risk disclosure: No claim of formal certification without evidence package

## 10) Executive Demo Flow

1. Show grievance intake and case routing
2. Show SLA timeline and breach escalation trigger
3. Show evidence sealing and audit export
4. Show operator governance and readiness gates
5. Close with pilot-to-production conversion path and timeline

## Notes

- Source-of-truth status is governed by governance/portfolio/product-catalog.json and nzila-truth-manifest.json.
- All commercial claims must align with documented proof status.
