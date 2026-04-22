# Union Eyes: Security One-Pager

## For Procurement, IT, and Privacy Officers

---

### Data Residency

All member data — grievance files, case notes, member records, communications, election data — is stored in **Microsoft Azure Canada Central (Toronto)** by default.

Cross-border residency transfer is disabled in the production data plane by policy. This supports:
- Canada's *Personal Information Protection and Electronic Documents Act* (PIPEDA)
- Ontario FIPPA / provincial privacy programs
- CBA and CUPE data-sovereignty requirements

---

### Encryption

| Layer | Standard |
|---|---|
| Data at rest | AES-256 (Azure Storage Service Encryption) |
| Data in transit | TLS 1.3 with HSTS and `upgrade-insecure-requests` |
| Secret management | Azure Key Vault — no secrets stored in source code or env files |
| Evidence packages | HMAC-SHA256 cryptographic seals (non-repudiation) |

---

### Access Control

- **Role-Based Access Control (RBAC)**: Roles (grievance officer, steward, executive, read-only) scoped per organization
- **Database isolation**: PostgreSQL Row-Level Security (RLS) — no cross-organization data access, even on shared infrastructure
- **Authentication**: Argon2id password hashing (OWASP-hardened) + Microsoft Entra ID SSO for Microsoft 365 organizations
- **Session security**: Server-side opaque tokens; no credentials in localStorage or cookies
- **Account lockout**: 5 failed attempts → 15-minute lockout

---

### Audit & Compliance

- **Immutable audit logs**: Every case change, file access, and admin action logged with cryptographic HMAC seal
- **Evidence export**: One-click PDF bundles suitable for OLRB proceedings, arbitration, and internal review
- **Retention controls**: Configurable retention policies per organization
- **Vulnerability scanning**: Dependency audit + Trivy container scan in every CI/CD run

---

### AI & Responsible Data Use

- All AI features are **advisory only** — no automated decisions
- Every AI output is surfaced with confidence indicators and requires human confirmation
- AI models run on **Azure OpenAI within the same Canadian tenant** — your data is never used to train public models
- Full audit trail on all AI-assisted actions

---

### Certifications & Roadmap

| Control | Status |
|---|---|
| PIPEDA alignment | ✅ In place |
| SOC 2 Type II | 🔄 Roadmap (no active attestation engagement yet) |
| Third-party penetration test | 🔄 Planned (not yet scheduled) |
| ISO 27001 | 📋 Roadmap (post-SOC 2) |

---

### Subprocessors

| Subprocessor | Purpose | Data Region |
|---|---|---|
| Microsoft Azure | Hosting, compute, storage, AI | Canada Central |
| Sentry | Error monitoring (configured to minimize payloads) | PII redaction controls required |
| Resend | Transactional email (member notifications) | Message metadata only |
| Stripe | Payment processing (org billing only) | No member data |

No subprocessor receives member grievance data, case files, or personally identifiable information beyond what is required for their specific function.

---

### Responsible Disclosure

Security issues: [security@unioneyes.app](mailto:security@unioneyes.app)  
24-hour acknowledgement / 72-hour patch target for critical issues.

Full security policy: [SECURITY.md](https://github.com/anungis437/nzila-os/blob/main/SECURITY.md)

---

**Full trust page**: [unioneyes.app/trust](https://unioneyes.app/trust)  
**Vendor risk package / DPA**: Request at [support@unioneyes.app](mailto:support@unioneyes.app)
