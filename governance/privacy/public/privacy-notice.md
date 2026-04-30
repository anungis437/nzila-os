# Privacy Notice — Nzila Ventures

**Effective date:** YYYY-MM-DD
**Last updated:** YYYY-MM-DD
**Owner:** Privacy Lead

> This is the canonical, plain-language privacy notice for Nzila products.
> When deployed to public web surfaces (`apps/web`, `apps/zonga`, etc.) it
> should be rendered from this source of truth.

---

## Who we are

Nzila Ventures ("Nzila", "we", "us") provides a portfolio of digital
services. This notice explains what personal information we collect, why,
how we use and protect it, and your rights.

Privacy contact: **privacy@nzila.example** (TODO confirm)
Legal address: TODO

## What information we collect

| Category | Examples | Source |
|---------|----------|--------|
| Account information | name, email, phone, organization | you, at sign-up |
| Authentication & security | password hash (Argon2id), session tokens, sign-in logs | you, our auth system |
| Profile data | preferences, locale, role within your organization | you |
| Service-specific data | varies by product (e.g., union case data, financial records, voice uploads) | you, your organization |
| Usage data | pages visited, actions taken, device/browser, IP | automatic |
| Communications | support messages, feedback | you |

We collect **special-category data** (e.g., health context in case files,
voice recordings) only where you or your organization provide it, and only
where we have a lawful basis (typically consent or contract).

## Why we use it (purposes & lawful bases)

| Purpose | Lawful basis (GDPR Art. 6) |
|---------|---------------------------|
| Provide and operate the service you signed up for | Performance of contract |
| Authenticate, secure, and prevent abuse | Legitimate interest / legal obligation |
| Comply with legal/regulatory obligations | Legal obligation |
| Improve the service (aggregated analytics) | Legitimate interest (with opt-out) |
| Communicate with you about the service | Performance of contract |
| Marketing communications | Consent |

## Automated decisions and AI

We use AI (including third-party models) to assist features such as voice
transcription and document analysis. AI outputs are advisory and reviewed by
a human before any decision that materially affects you. You may object to
AI-assisted processing; contact privacy@nzila.example.

## Sharing your information

We do **not** sell personal information.

We share data only with:

- Service providers (sub-processors) bound by Data Processing Agreements (e.g., Microsoft Azure for hosting and AI inference)
- Your organization, where you use Nzila as part of an employer/union deployment
- Authorities, where required by law

A current list of sub-processors is available on request.

## International transfers

Our primary data location is **Canada (Azure Canada Central)**. Some
processing (e.g., AI inference) occurs in the **United States** (Azure East
US / East US 2) under appropriate safeguards (Standard Contractual Clauses,
zero-retention contractual terms with the AI provider).

## How long we keep your information

Per our [Data Retention Schedule](../policies/data-retention-schedule.md).
Examples:

- Account data: for the life of your account, then 30 days
- Voice recordings: 30 days; transcripts: 1 year
- Audit logs: 1 year hot, 6 years cold (security/regulatory)

When the period ends we delete or irreversibly anonymize the data.

## How we protect your information

- Encryption at rest (AES-256) and in transit (TLS 1.2+)
- Role-based access with org-scoped data isolation
- Argon2id password hashing; account lockout on failed attempts
- MFA available; required for administrative access
- Independent security testing and continuous vulnerability management
- See our public [Application Security Policy](../../security/APPLICATION_SECURITY_POLICY.md) for details

## Your rights

Depending on your jurisdiction, you may have the right to:

- **Access** the personal information we hold about you
- **Correct** inaccurate information
- **Delete** your information (subject to legal retention)
- **Restrict** or **object to** certain processing
- **Portability** — receive your data in a machine-readable format
- **Withdraw consent** at any time (where consent is the basis)
- **Not be subject to solely automated decisions** with significant effects
- **Complain** to your data protection authority (e.g., OPC in Canada, ICO in UK, your EU lead supervisory authority, California AG)

To exercise any right, see [How to submit a request](#how-to-submit-a-request).

## Cookies and similar technologies

See our [Cookie Policy](cookie-policy.md).

## Changes to this notice

We will post material changes here and, where appropriate, notify you in-app
or by email at least 30 days before they take effect.

## How to submit a request

Email **privacy@nzila.example** (TODO) or use the in-product "Privacy →
Submit a request" link. We respond within statutory timeframes (typically
30 days; up to 90 days for complex requests with notice).

## Children

Our services are not directed to children under 16 (under 13 in the US).
We do not knowingly collect personal information from children.
