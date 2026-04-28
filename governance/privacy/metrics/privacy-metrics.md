# Privacy Program Metrics & KPIs

**Doc ID:** PMET-2026-001
**Owner:** Privacy Lead
**Cadence:** monthly collection · quarterly review · annual report

Metrics are organized by the Info-Tech 12 privacy domains. Each metric has
a target and a data source. Where the source is "TODO" the metric requires
new instrumentation.

## 1. Governance

| Metric | Target | Source |
|--------|--------|--------|
| % surfaces with a Surface Owner registered | 100% | `governance/portfolio/` |
| Privacy steering committee meetings held | 4 / yr | meeting log (TODO) |

## 2. Regulatory Compliance

| Metric | Target | Source |
|--------|--------|--------|
| Jurisdictions with documented control mapping | 5 (PIPEDA, GDPR, CCPA, HIPAA, Quebec L25) | [readiness-assessment.md](../readiness-assessment.md) |
| Material legal/regulatory changes assessed within 30 days | 100% | privacy log (TODO) |

## 3. Data Process & Handling

| Metric | Target | Source |
|--------|--------|--------|
| % data stores classified | 100% | `governance/privacy/data-inventory.json` (TODO) |
| % Restricted data in non-prod | 0% | data inventory + staging seed audit |

## 4. Incident Response

| Metric | Target | Source |
|--------|--------|--------|
| Mean time to detect (MTTD) | < 24h | incident log |
| Mean time to contain (MTTC) | < 4h SEV1, < 24h SEV2 | incident log |
| Tabletop exercises per year | 4 | exercise log |
| % incidents with completed post-mortem within 5 BD | 100% | post-mortem index |

## 5. Privacy Risk Assessments

| Metric | Target | Source |
|--------|--------|--------|
| % production data flows with current DPIA / PIA | 100% | [`../README.md`](../README.md) inventory |
| DPIAs reviewed in last 12 months | 100% | DPIA index |
| HIGH residual risks open | 0 | DPIA risk registers |

## 6. Notices and Consent

| Metric | Target | Source |
|--------|--------|--------|
| Privacy notice published & current | yes | [`../public/privacy-notice.md`](../public/privacy-notice.md) |
| Cookie policy published & current | yes | [`../public/cookie-policy.md`](../public/cookie-policy.md) |
| Consent capture rate (where required) | ≥ 95% | per-app consent telemetry (TODO) |

## 7. Data Subject Requests

| Metric | Target | Source |
|--------|--------|--------|
| DSARs received / month | tracked | DSAR log (TODO) |
| % completed within statutory SLA | 100% | DSAR log |
| Average days to fulfilment | < 14 | DSAR log |
| % refused, by reason | tracked | DSAR log |

## 8. Privacy by Design

| Metric | Target | Source |
|--------|--------|--------|
| % new features with PbD checklist completed in PR | 100% | PR template (TODO) |
| Reasoning-context-envelope coverage of AI surfaces | 100% | contract test |

## 9. Information Security

| Metric | Target | Source |
|--------|--------|--------|
| HIGH/CRITICAL CVEs unwaived past SLA | 0 | `tooling/security/supply-chain-policy.ts` |
| Trivy CRITICAL findings on prod images | 0 | CI |
| MFA enrollment for human admin access | 100% | Entra |

## 10. Third-Party Management

| Metric | Target | Source |
|--------|--------|--------|
| % vendors processing personal data with executed DPA | 100% | vendor register (TODO) |
| % vendors with current security assessment (≤ 12 mo) | 100% | vendor register |
| Sub-processor changes reviewed within 30 days | 100% | vendor register |

## 11. Awareness and Training

| Metric | Target | Source |
|--------|--------|--------|
| % employees with annual privacy training completed | ≥ 95% | training system (TODO) |
| Phishing-simulation click rate | < 5% | security awareness platform (TODO) |

## 12. Program Measurement

| Metric | Target | Source |
|--------|--------|--------|
| Annual privacy program report published | 1 / yr | [data-privacy-program-report-template.md](data-privacy-program-report-template.md) |
| Readiness assessment composite | ≥ 3.5 / 5 by 2027-Q1 | [`../readiness-assessment.md`](../readiness-assessment.md) |

## Reporting

Monthly metric snapshot is committed to `governance/privacy/metrics/snapshots/YYYY-MM.json`
(directory created on first snapshot). The annual report consolidates trends.
