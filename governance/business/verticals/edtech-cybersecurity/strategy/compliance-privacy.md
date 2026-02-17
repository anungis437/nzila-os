# EdTech-Cybersecurity — Compliance & Privacy Strategy

> Regulatory compliance framework for CyberLearn — data privacy, security certifications, and training industry regulations.

---

## Data Privacy & Protection

### PIPEDA Compliance (Primary Jurisdiction)
- **Scope**: CyberLearn processes employee PII (names, emails, training performance, phishing test results)
- **Data controller**: Client organization (employer is controller, CyberLearn is processor)
- **Data processing agreement (DPA)**: Standard DPA with every client/MSP partner
- **Consent**: Employer provides notice to employees; CyberLearn provides template notices
- **Breach notification**: 72-hour notification to Privacy Commissioner + client organization
- **Access/deletion**: Employee requests go through employer → CyberLearn API supports bulk delete

### Data Inventory
| Data Type | Purpose | Retention | Classification |
|---|---|---|---|
| Employee name + email | Account, training enrollment | Active + 1yr | PII |
| Training completion records | Compliance, certificates | Active + 5yr (audit) | Business |
| Quiz scores + attempts | Assessment, remediation | Active + 3yr | Business |
| Phishing test results | Risk scoring, behavioral analysis | Active + 2yr | Sensitive |
| IP address / device info | Security, anomaly detection | 90 days | PII |
| Login timestamps | Attendance, compliance | Active + 1yr | PII |
| Video viewing analytics | Content optimization | 90 days (anonymized) | Anonymous |
| Payment info (MSP billing) | Billing (Stripe tokenized) | Active + 7yr | Financial |

### Quebec — Law 25
- Privacy officer designated for CyberLearn operations
- Privacy Impact Assessment (PIA) completed for phishing simulation feature
- Consent management: employees informed before phishing simulation enrollment
- De-identification: anonymize learner data after retention period
- French language: complete privacy notice + terms in French

### International (Future Markets)
| Market | Regulation | CyberLearn Impact |
|---|---|---|
| US (various) | CCPA/CPRA (California) | Do-not-sell notice, data deletion API |
| EU | GDPR | DPO designation, SCCs for cross-border, Art. 28 DPA |
| UK | UK GDPR | Separate legal basis documentation |
| Australia | Privacy Act 1988 | APP compliance for AU partner expansion |

---

## Employee Monitoring & Privacy Considerations

### Phishing Simulation Ethics
- **No punitive use**: Phishing results must not be used for disciplinary action (contractual requirement)
- **Transparency**: Employees informed that periodic security tests occur (exact timing not disclosed)
- **Data minimization**: Only track click/no-click + time — no keystroke logging, no credential storage
- **Aggregate reporting**: Emphasize department/org-level metrics over individual naming
- **Right to training**: Failed tests trigger additional training, not reprimand
- **Opt-out**: Some jurisdictions may require opt-out for test simulations (monitor evolving case law)

### Workplace Privacy
```
CyberLearn Data Usage Policy:
┌─────────────────────────────────────────────────┐
│ ✅ We DO track:                                 │
│    • Course completions and scores              │
│    • Phishing test pass/fail (aggregate only)   │
│    • Login frequency for compliance reporting    │
│                                                  │
│ ❌ We do NOT track:                             │
│    • Keystroke logging or screen recording       │
│    • Personal browsing or email content          │
│    • Real credential capture (simulated only)    │
│    • GPS or precise location tracking            │
│    • Biometric data                              │
└─────────────────────────────────────────────────┘
```

---

## Security Certifications & Standards

### SOC 2 Type II (Target: 2027)
- **Scope**: Trust Service Criteria (Security, Availability, Confidentiality)
- **Timeline**: SOC 2 Type I by Q2 2027, Type II by Q4 2027
- **Controls**:
  - Access control: RBAC, MFA, principle of least privilege
  - Change management: version-controlled deployments, approval workflows
  - Monitoring: continuous logging, anomaly detection, incident response plan
  - Data protection: encryption at rest + in transit, key management
  - Vendor management: third-party risk assessment for sub-processors

### ISO 27001 (Target: 2028)
- Information Security Management System (ISMS) implementation
- Risk assessment and treatment plan
- Annual internal audits + management reviews
- Continuous improvement cycle (Plan-Do-Check-Act)

### Current Security Baseline
| Control | Status | Target |
|---|---|---|
| Encryption at rest (AES-256) | ✅ Implemented | — |
| Encryption in transit (TLS 1.3) | ✅ Implemented | — |
| MFA for admin accounts | ✅ Implemented | All users by 2026 |
| RBAC | ✅ Implemented | — |
| Vulnerability scanning | 🔄 Quarterly | Monthly by 2026 |
| Penetration testing | ❌ Not yet | Annual by 2026 |
| Incident response plan | 🔄 Draft | Tested by 2026 |
| Business continuity plan | 🔄 Draft | Tested by 2026 |
| Backup & DR | ✅ Daily backup | Tested quarterly |

---

## Training Content Compliance

### Accuracy & Currency
- Content reviewed quarterly for accuracy against current threat landscape
- CCCS (Canadian Centre for Cyber Security) advisories integrated within 72 hours
- NIST Cybersecurity Framework alignment for training modules
- CIS Controls mapping for each training course
- Version control: all content changes tracked, previous versions retained

### Accessibility Compliance
- **AODA** (Ontario): Accessibility for Ontarians with Disabilities Act
  - WCAG 2.1 Level AA for all training content
  - Video captions in English and French
  - Alt text for all images and diagrams
  - Screen reader compatible quizzes
- **ACA** (Federal): Accessible Canada Act — barrier-free training
- Annual third-party accessibility audit

### Bilingual Requirements
- Complete EN + FR content parity (not machine-translated)
- Quebec clients: French-first delivery (OQLF compliance)
- Training certificates issued in client's preferred language
- Privacy notices and terms in both official languages

---

## Regulatory Framework Compliance

### Cyber Insurance Alignment
- Training programs aligned with common cyber insurance questionnaires:
  - Coalition, Corvus, At-Bay, Beazley requirements
  - Evidence package: completion rates, phishing metrics, policy acknowledgments
  - Automated annual report for insurance renewal submissions
- Risk reduction scoring compatible with insurance underwriting models

### Industry Regulations Requiring Security Training
| Regulation | Industry | CyberLearn Coverage |
|---|---|---|
| **PCI-DSS** (Req 12.6) | Payment card handling | Security awareness training module |
| **PIPEDA** (Principle 7) | All Canadian businesses | Privacy & data protection training |
| **Bill C-26** | Critical infrastructure | Cyber security awareness (pending regs) |
| **PHIPA** | Ontario healthcare | Health data privacy training |
| **OSFI B-13** | Financial institutions | IT risk management training |
| **SOC 2** (CC9.9) | Technology/SaaS | Security awareness program requirement |
| **HIPAA** | US healthcare (future) | Security awareness training rule |

### Compliance Reporting Engine
```
Report Generation:
┌─────────────────────────────────────────────┐
│ Select Framework: [PCI-DSS v4.0      ▼]    │
│ Period: [Q4 2025                     ▼]    │
│ Organization: [Smith & Co Law        ▼]    │
│                                             │
│ Report Preview:                             │
│ ┌─────────────────────────────────────┐    │
│ │ Req 12.6.1: Security awareness     │    │
│ │ program — COMPLIANT ✅             │    │
│ │ Evidence: 78/80 employees trained  │    │
│ │ Completion rate: 97.5%             │    │
│ │ Last training date: Dec 15, 2025   │    │
│ │ Phishing test: Dec 2025 — 8% click│    │
│ │ Remediation: 2 users retrained    │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ [Download PDF] [Download CSV] [Email Report]│
└─────────────────────────────────────────────┘
```

---

## Vendor & Sub-Processor Management

### Sub-Processor Register
| Sub-Processor | Purpose | Data Shared | Location | DPA |
|---|---|---|---|---|
| **Azure (Microsoft)** | Cloud hosting, compute, storage | All platform data | Canada Central | ✅ |
| **SendGrid (Twilio)** | Email delivery (phishing sim) | Email addresses | US | ✅ |
| **Stripe** | Payment processing | MSP billing info (tokenized) | US | ✅ |
| **Sentry** | Error monitoring | Anonymized error data | US | ✅ |
| **Azure AD B2C** | Authentication | Email, name | Canada | ✅ |

### Sub-Processor Requirements
- All sub-processors must have SOC 2 Type II or equivalent
- Data processing agreements (DPA) with each sub-processor
- 30-day notification to clients before adding new sub-processors
- Annual review of sub-processor security posture
- Preference for Canadian data residency (Azure Canada Central)

---

## Compliance Roadmap

### 2025 — Foundation
- PIPEDA compliance framework + privacy policy + DPA template
- Employee data handling procedures documentation
- Training content accuracy review process
- Basic security controls (encryption, RBAC, backup)
- AODA accessibility baseline assessment

### 2026 — Maturation
- Law 25 (Quebec) full compliance
- Annual penetration testing program
- Incident response plan (tested via tabletop exercise)
- AODA WCAG 2.1 AA remediation complete
- Vulnerability management program (monthly scans)
- Sub-processor management framework

### 2027 — Certification
- SOC 2 Type I audit (Q2) + Type II (Q4)
- Cyber insurance alignment reporting engine
- CCPA/CPRA readiness (US expansion)
- Business continuity plan tested
- Third-party security audit (annual program)

### 2028 — Enterprise-Ready
- ISO 27001 certification
- GDPR compliance (EU expansion)
- FedRAMP awareness (US gov market exploration)
- Automated compliance monitoring and alerting
- Privacy by design embedded in SDLC
