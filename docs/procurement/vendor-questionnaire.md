# Security Vendor Questionnaire — Pre-filled Responses

**Product**: Union Eyes (Nzila OS Platform)  
**Version**: 1.0 | 2026-04-22  
**Respondent**: Nzila OS Inc. — Platform Security

> This document provides standard answers for union IT / privacy officer security questionnaires. All claims are cross-referenced to [docs/commercial/claims-ledger.md](../commercial/claims-ledger.md).

---

## Section 1: Data Residency & Sovereignty

**Q1. Where is our data stored?**  
All member data is stored exclusively in **Microsoft Azure Canada Central (Toronto)**. No data is stored in or transmitted to U.S. infrastructure.

**Q2. Is data processed outside Canada?**  
AI inference uses Azure OpenAI (East US). This is covered by Microsoft's contractual no-training commitment — member data is never used to train public models. If your organization requires strict in-Canada AI processing, this can be discussed.

**Q3. Do you comply with PIPEDA?**  
Our platform is designed with PIPEDA principles in mind (data minimization, purpose limitation, consent, retention controls). We do not make a legal certification of PIPEDA compliance — organizations requiring formal certification should engage legal counsel. A DPA template is available at [docs/procurement/dpa.md](./dpa.md).

---

## Section 2: Encryption

**Q4. How is data encrypted at rest?**  
AES-256 using Azure Storage Service Encryption (SSE), enabled by default on all storage resources.

**Q5. How is data encrypted in transit?**  
TLS 1.3 with HSTS enforced. The `upgrade-insecure-requests` Content-Security-Policy header is active.

**Q6. How are secrets managed?**  
Azure Key Vault. No secrets are stored in source code, environment files, or version control. CI pipelines include Gitleaks secret scanning.

---

## Section 3: Access Control

**Q7. How are user permissions managed?**  
Role-Based Access Control (RBAC) with roles scoped per organization: Grievance Officer, Steward, Executive Director, Read-Only, Admin. Roles are enforced at both API and database levels.

**Q8. Is there database-level isolation between organizations?**  
Yes. PostgreSQL Row-Level Security (RLS) ensures that queries for one organization cannot return data for another, even on shared infrastructure.

**Q9. How do users authenticate?**  
Email/password with Argon2id hashing (OWASP-recommended parameters). Microsoft Entra ID (Azure Active Directory) SSO is available for organizations using Microsoft 365.

**Q10. What is your account lockout policy?**  
5 failed login attempts triggers a 15-minute lockout. Lockout events are logged.

---

## Section 4: Audit & Compliance

**Q11. Are audit logs tamper-proof?**  
Yes. Every case change, file access, and admin action is logged with a cryptographic HMAC seal (AES-256 / SHA-256). Logs are append-only and the seal chain prevents undetected modification.

**Q12. Can we export audit logs for legal proceedings?**  
Yes. One-click evidence packages are exportable as PDF bundles suitable for OLRB proceedings, arbitration, and internal review.

**Q13. What vulnerability scanning do you perform?**  
Every CI/CD pipeline run includes:
- Dependency audit (pnpm audit / Snyk)
- Container image scanning (Trivy, CRITICAL severity threshold)
- Secret scanning (Gitleaks / TruffleHog)

---

## Section 5: AI & Data Use

**Q14. Is member data used to train AI models?**  
No. Azure OpenAI operates under Microsoft's contractual no-training commitment. Member data submitted for AI processing is never used to train public models.

**Q15. Are AI decisions automated or human-reviewed?**  
All AI outputs are advisory only. No automated decisions are made. Every AI suggestion is surfaced with confidence indicators and requires explicit human confirmation before action.

**Q16. Is there an audit trail for AI-assisted actions?**  
Yes. All AI-assisted actions are logged in the standard audit trail with the same cryptographic HMAC sealing.

---

## Section 6: Incident Response

**Q17. What is your incident response SLA?**  
We commit to notifying affected organizations within **72 hours** of becoming aware of a Security Incident, consistent with PIPEDA breach notification requirements. Our DPA template at [docs/procurement/dpa.md](./dpa.md) formalizes this commitment.

**Q18. Do you have a documented incident response plan?**  
Yes. See `SECURITY.md` in the platform repository for our security response process and contacts.

---

## Section 7: Certifications

**Q19. Do you have SOC 2 Type II certification?**  
Not currently. SOC 2 Type II is on our compliance roadmap. We undergo continuous dependency and container vulnerability scanning in every CI/CD run. We are happy to provide our current security controls evidence package on request.

**Q20. Have you had a third-party penetration test?**  
A third-party pen test is planned before general commercial availability. We have not yet completed one. We are happy to share results once completed, and organizations requiring a pen test before pilot can request a delayed start date.

**Q21. Do you have cyber insurance?**  
[TO BE CONFIRMED by Nzila legal/finance team]

---

## Section 8: Business Continuity

**Q22. What is your data backup policy?**  
Azure Database for PostgreSQL Flexible Server performs automated backups with configurable retention (default 7 days). Geo-redundant backup options are available on request.

**Q23. What is your disaster recovery capability?**  
We run on Azure Container Apps in Canada Central with Azure's built-in redundancy. A formal RTO/RPO target and DR runbook is on our operations roadmap.

---

*For follow-up questions, contact: security@nzila.ca*  
*Claims cross-reference: [docs/commercial/claims-ledger.md](../commercial/claims-ledger.md)*
