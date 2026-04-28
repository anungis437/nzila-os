# Enterprise AI Governance Committee — Charter

**Doc ID:** AIGC-CHTR-2026-001
**Version:** 1.0
**Status:** ACTIVE
**Effective:** 2026-04-28
**Sponsor:** CEO

## 1. Purpose

The AI Governance Committee ("AIGC") is the cross-functional body
accountable for Nzila's adaptive AI governance program. It sets policy,
approves high-risk AI use, monitors assurance signals, and ensures Nzila
meets its legal, ethical, and operational obligations across all AI surfaces.

## 2. Authority

The AIGC has the authority to:

- Approve or reject any AI use case classified Limited risk or higher (per [risk-classification.md](risk-classification.md))
- Require a DPIA / PIA before any production deployment touching personal data
- Pause or roll back any AI surface that breaches policy, fails assurance, or experiences an incident
- Approve exceptions to AI policy with documented justification, expiry, and compensating controls
- Recommend strategic investments and resource allocation for AI governance

## 3. Membership

| Role | Voting | Notes |
|------|:-----:|------|
| AI Lead (Chair) | Yes | Accountable executive; sets agenda |
| Privacy Lead / DPO | Yes | Chairs PIA reviews |
| Security Lead / CISO | Yes | Chairs adversarial / security reviews |
| Legal Counsel | Yes | Regulatory interpretation, contractual risk |
| Engineering Lead (Platform) | Yes | Technical feasibility, lifecycle integration |
| Product Lead (rotating) | Yes | Speaks for product surface under review |
| Business Stakeholder (rotating) | Yes | Speaks for the business outcome |
| HR Lead | Advisory | When use affects employees / workers |
| Member / Customer Advocate | Advisory | When use affects members / customers |
| Surface Owner under review | Non-voting | Presents proposal |

Quorum: Chair + 4 voting members including at least one of {Privacy Lead,
Security Lead, Legal Counsel}.

## 4. Cadence

- **Standing meeting:** monthly (default) — minimum quarterly
- **Decision sessions:** ad hoc, called for High/Limited-risk approvals
- **Annual review:** full program review including [maturity-assessment.md](maturity-assessment.md)
- **Incident-triggered:** convened within 5 business days of any AI incident

## 5. Scope

In scope:

- Any internal or vendor AI used in production, including LLMs, embeddings, Whisper, classical ML, agentic tools
- AI used in employee productivity tools where data is non-public
- AI used in member-facing or partner-facing surfaces
- AI used in security/operations tooling that affects production systems

Out of scope (logged but not approved):

- Personal-use general AI by individuals on public/non-confidential content
- Public-domain experimentation in isolated, non-production environments

## 6. Decision-making

Decisions by majority vote of voting members present. Chair has tie-breaking
vote. Decisions, dissents, and rationale recorded in committee minutes
(stored in `governance/ai/minutes/YYYY-MM-DD.md`, created on first meeting).

Material decisions are also recorded in the affected surface's PIA / DPIA
and in [inventory.md](inventory.md).

## 7. Inputs the committee reviews

- New AI proposal package: PIA + risk classification + eval plan + rollout plan
- Quarterly assurance report from [assurance-program.md](assurance-program.md)
- Incident reports
- Regulatory updates (curated by Legal)
- Vendor / model changes (Engineering)

## 8. Outputs

- Approval decisions (with conditions / expirations)
- Updated [ai-policy.md](ai-policy.md) and exception register
- Inventory updates ([inventory.md](inventory.md))
- Annual AI Governance Report (template TODO)

## 9. Escalation

- Disagreements not resolvable at AIGC escalate to the CEO.
- Material legal exposure escalates to the Board.

## 10. Amendments

This charter is reviewed annually. Amendments are made by AIGC majority and
ratified by the CEO sponsor.
