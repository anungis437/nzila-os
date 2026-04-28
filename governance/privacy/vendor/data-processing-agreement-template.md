# Data Processing Agreement (DPA) — Template

**Doc ID:** DPA-TPL-2026-001
**Use:** When Nzila is the **controller** and a vendor processes personal
data on our behalf (e.g., Microsoft Azure, Azure OpenAI, observability
vendors). Required by GDPR Art. 28.

This is a TEMPLATE. Counsel review is required before execution.

---

## 1. Parties

- **Controller:** Nzila Ventures
- **Processor:** _Vendor Legal Name_
- **Effective date:**
- **Term:** Coterminous with the underlying Services Agreement dated _date_.

## 2. Subject matter and duration

- Subject matter of processing:
- Duration:
- Categories of data subjects:
- Categories of personal data:
- Special categories (if any):
- Nature and purpose of processing:

## 3. Processor obligations (GDPR Art. 28(3))

The Processor shall:

(a) Process personal data only on documented instructions from the Controller, including transfers to a third country.

(b) Ensure persons authorized to process personal data are bound by confidentiality.

(c) Implement appropriate technical and organizational measures (Annex II).

(d) Engage sub-processors only with prior specific or general written authorization (see §6).

(e) Assist the Controller in responding to data subject requests within reasonable timeframes.

(f) Assist with security, breach notification, DPIAs, and consultations with supervisory authorities.

(g) At Controller's option, delete or return all personal data at end of provision of services.

(h) Make available all information necessary to demonstrate compliance and allow audits.

## 4. Sub-processors

| Sub-processor | Country | Service |
|---------------|---------|---------|
| | | |

Controller has 30 days to object to additions.

## 5. International transfers

Where personal data is transferred outside the originating jurisdiction
(EEA / UK / Canada), Standard Contractual Clauses apply — see
[standard-contractual-clauses.md](standard-contractual-clauses.md). For
Azure OpenAI cross-border (Canada → US), zero-retention contract terms
must apply.

## 6. Breach notification

Processor shall notify Controller without undue delay (and in any event
**within 24 hours**) of becoming aware of a personal data breach, with
sufficient information for Controller to meet its own notification
obligations (see [`../incidents/breach-reporting-requirements.md`](../incidents/breach-reporting-requirements.md)).

## 7. Annex I — Description of processing

Per §2 above.

## 8. Annex II — Technical and organizational measures

Minimum required measures:

- Encryption at rest (AES-256) and in transit (TLS 1.2+)
- Access control (least privilege, MFA for admin access)
- Audit logging of administrative and data access
- Incident response with 24-hour Controller notification
- Annual independent security assessment (e.g., SOC 2 Type II, ISO 27001)
- Data segregation (logical or physical) for Confidential/Restricted data
- Defined retention and secure deletion process

## 9. Annex III — Authorized sub-processors

Maintained externally by Processor; updated list shall be available to Controller upon request.

## 10. Vendor inventory entry

When this DPA is executed, add an entry to `governance/privacy/vendor/vendor-register.md`
(create on first DPA) with vendor, service, sub-processors, regions, and renewal date.
