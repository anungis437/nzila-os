# AI Risk Management — NIST AI RMF Alignment

## Why NIST AI RMF

The [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
(AI 100-1) is the most comprehensive framework for managing AI risks. It's:

- **Non-prescriptive** — Principles-based, not checklist-based
- **Broadly adopted** — Many regulators reference it
- **Complementary** — Works alongside SOC 2, ISO 27001
- **Practical** — Four functions that map to our existing controls

## The Four Functions

### GOVERN — Culture and Policies

- **Our implementation**: `governance/ai/` docs suite, `CODEOWNERS`, `@nzila/ai-registry` governance lifecycle
- **Key control**: Every model MUST have a model card before deployment

### MAP — Context and Framing

- **Our implementation**: Model cards (purpose, intended use, out-of-scope use), risk classification engine
- **Key control**: Multi-factor risk scoring with weighted factors (autonomy, data classification, impact, reversibility, transparency, bias, safety)

### MEASURE — Metrics and Testing

- **Our implementation**: Red team adversarial tests, OTel AI spans, SLO monitoring, budget tracking, model evaluation metrics
- **Key control**: CI-enforced safety audits (`.github/workflows/ai-governance.yml`)

### MANAGE — Ongoing Treatment

- **Our implementation**: PII redaction, budget caps, human-in-the-loop for medium/high risk, circuit breakers, incident response
- **Key control**: Risk-tiered approval requirements (1-3 approvers based on risk level)

## Risk Tier Controls

| Risk Level | Auto-Approve | Approvers | Required Controls |
|------------|-------------|-----------|-------------------|
| Low | Yes (if configured) | 1 | Audit logging, input validation |
| Medium | No | 1 | + PII redaction, budget caps, output monitoring |
| High | No | 2 | + Human review, content safety, quarterly review |
| Critical | No | 3 | + Dual approval, real-time monitoring, red team testing |

## Evidence Trail

Every AI decision produces evidence:

1. **Request log** — Hash-chained, encrypted for sensitive data
2. **Policy decision** — Risk tier evaluation recorded
3. **Attestation** — Self-hashing JSON for AI actions
4. **OTel span** — Distributed trace with `nzila.ai.risk_tier`
5. **Budget record** — Cost attributed to org

This evidence chain is the foundation for SOC 2 Type II AI-related controls.
