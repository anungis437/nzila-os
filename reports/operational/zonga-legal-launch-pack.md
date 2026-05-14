# Zonga — Legal Launch Pack

**Sprint**: Client Launch Readiness | **Date**: 2026-04-19
**Status**: DRAFT — All documents require review by qualified legal counsel before publication.

> ⚠️ **Disclaimer**: This pack provides structured framework text drafted from platform architecture analysis. It is NOT legal advice. Nzila OS and its agents are not law firms. Every document below must be reviewed and approved by a qualified attorney in each jurisdiction of operation before being presented to users or clients.

---

## Overview

Zonga operates across African diaspora markets with multi-currency monetisation, creator royalties, live events, content rights, and audio streaming. The following legal documents are required before the first client deployment.

### Document Checklist

| Document | Status | Priority |
|---|---|---|
| Terms of Service (Listener) | 🟡 Draft framework below | Critical |
| Terms of Service (Creator) | 🟡 Draft framework below | Critical |
| Privacy Policy | 🟡 Draft framework below | Critical |
| Acceptable Use Policy (AUP) | 🟡 Draft framework below | Critical |
| Content Ownership & Rights Policy | 🟡 Draft framework below | Critical |
| DMCA / Takedown Notice Procedure | 🟡 Draft framework below | Critical |
| Refund & Cancellation Policy | 🟡 Draft framework below | High |
| Client Service Agreement | 🟡 Draft framework below | Critical |
| Data Retention & Deletion Policy | 🟡 Draft framework below | High |
| Cookie Policy | 🟡 Stub only | Medium |

---

## 1. Terms of Service — Listener Tier

**[REQUIRES COUNSEL REVIEW BEFORE PUBLICATION]**

**Platform**: Zonga Music Platform
**Operator**: [CLIENT LEGAL ENTITY NAME]
**Effective Date**: [DATE]

### 1.1 Agreement

By creating an account or accessing Zonga, you agree to these Terms. If you do not agree, do not use the platform.

### 1.2 Account

- You must be 13+ years old (18+ to purchase or subscribe).
- Provide accurate registration information.
- You are responsible for maintaining account security.
- Account lockout applies after 5 failed login attempts (15-minute cooldown).

### 1.3 Subscriptions and Payments

- Free tier: limited audio quality (Opus 48kbps). No payment required.
- Premium tier: USD $4.99/month (or local currency equivalent). Billed via Stripe. Auto-renews monthly.
- Payments are processed by Stripe, Inc. Zonga does not store payment card data.
- Prices may change with 30 days' notice.

### 1.4 Prohibited Conduct

- Do not reproduce, redistribute, or share platform content without authorization.
- Do not use automated tools, bots, or scrapers.
- Do not attempt to circumvent geofencing, quality entitlements, or access controls.
- Do not upload, stream, or distribute infringing, harmful, or illegal content.

### 1.5 Content Availability

- Platform availability is not guaranteed. Scheduled maintenance windows will be communicated.
- Artists may remove content; removed content will not be available for continued playback.

### 1.6 Intellectual Property

- All audio content is owned by respective creators and rights holders.
- Streaming grants a limited, non-exclusive, non-transferable license to listen only.

### 1.7 Limitation of Liability

**[COUNSEL MUST CUSTOMISE]** — [Include jurisdiction-appropriate liability caps and disclaimers].

### 1.8 Governing Law

**[COUNSEL MUST SPECIFY JURISDICTION]** — [e.g., Laws of Republic of Kenya / South Africa / Canada].

---

## 2. Terms of Service — Creator Tier

**[REQUIRES COUNSEL REVIEW BEFORE PUBLICATION]**

### 2.1 Creator Eligibility

- Must be 18+ years of age.
- Must own or control the rights to all content you upload.
- Must provide accurate payout/tax information.

### 2.2 Content Ownership Warranty

By uploading content, you represent and warrant that:

- You own the master recording rights and composition rights (or have a valid license).
- The content does not infringe any third-party copyright, trademark, or right of publicity.
- You have the right to grant Zonga the license described below.

### 2.3 Content License Grant

By uploading content, you grant Zonga a:

- **Non-exclusive, worldwide, royalty-free** license to:
  - Transcode, store, and cache your content for streaming and download.
  - Display your artist profile, artwork, and metadata for promotional purposes.
  - Generate waveform and preview clips (up to 30 seconds) for discovery features.

This license does **not** transfer ownership. You retain all rights.

### 2.4 Revenue and Payouts

- Platform fees apply per source: streaming (30%), downloads (25%), ticket sales (15%), subscription share (20%), tips (10%).
- Revenue splits for multi-artist collaborations must be declared at upload and must sum to 100%.
- Minimum payout thresholds apply by currency.
- Payout processing requires a valid Stripe Connect account (or M-Pesa wallet where supported).
- Payout requests are subject to finance admin review. Processing time: 3–7 business days.

### 2.5 Content Moderation

- Content may be reviewed for compliance with the Acceptable Use Policy.
- Non-compliant content will be removed. Repeated violations result in account suspension.
- You may appeal moderation decisions within 14 days via [support email].

### 2.6 Takedowns

- Verified rights holders may submit DMCA/takedown requests.
- Infringing content will be removed within [72 hours] of verified notice.

---

## 3. Privacy Policy

**[REQUIRES COUNSEL REVIEW — especially for GDPR, POPIA, and NDPR compliance]**

### 3.1 Data Collected

| Category | Examples |
|---|---|
| Account data | Email, name, country, login timestamps |
| Payment data | Stripe customer ID, payout rail, account status (not card numbers) |
| Content data | Uploaded audio, images, metadata |
| Listening data | Track plays, quality tier, device type, country, skip patterns |
| Creator data | Revenue splits, earnings, payout requests |
| Technical data | IP address, browser, session tokens |

### 3.2 Legal Bases for Processing

**[COUNSEL MUST SPECIFY per jurisdiction]** — Consent / Contract Performance / Legitimate Interests / Legal Obligation.

### 3.3 Data Retention

- Account data: retained while account is active + 3 years
- Earnings and payout records: 7 years (financial regulation)
- Playback logs: 24 months
- Session tokens: invalidated on logout or 30 days of inactivity
- Takedown records: 5 years
- Full policy: see Data Retention & Deletion Policy (Section 9)

### 3.4 Data Sharing

We share data with:

- **Stripe, Inc.** — payment processing
- **Amazon Web Services** — media storage, transcoding, CloudFront CDN, IVS live streaming
- **Microsoft Azure** — Blob storage, OpenAI (where used for search), Entra SSO
- No data sold to third-party advertisers.

### 3.5 User Rights

Depending on your jurisdiction, you may have rights to:

- Access your data
- Correct inaccurate data
- Delete your account and personal data
- Withdraw consent
- Object to processing

Contact: [privacy@CLIENTDOMAIN.com]

### 3.6 Security

- Passwords hashed with Argon2id.
- Sessions use opaque tokens stored server-side.
- TLS in transit; encryption at rest on storage providers.

---

## 4. Acceptable Use Policy (AUP)

**[REQUIRES COUNSEL REVIEW]**

The following content is prohibited on Zonga:

### 4.1 Prohibited Content

- Content infringing copyright, trademark, or trade secret of any party
- Content that depicts, promotes, or facilitates child sexual exploitation
- Malware, phishing links, or fraudulent representations
- Hate speech targeting race, religion, gender, sexual orientation, disability, or national origin
- Content promoting or glorifying terrorism, mass violence, or genocide
- Non-consensually distributed intimate images ("revenge porn")
- Content that violates applicable export control regulations

### 4.2 Prohibited Conduct

- Impersonating another user, creator, or platform employee
- Manipulating stream counts, tip volumes, or play statistics
- Attempting to reverse-engineer or scrape the platform
- Creating multiple accounts to circumvent suspension
- Using the platform for money laundering or sanctions evasion

### 4.3 Enforcement

- First violation: content removed, warning issued
- Second violation: temporary suspension (14 days)
- Third / severe violation: permanent account termination, payout withheld pending review
- Illegal conduct: reported to relevant law enforcement

---

## 5. Content Ownership & Rights Policy

**[REQUIRES COUNSEL REVIEW]**

### 5.1 Rights Warranty

Every creator who uploads content warrants they hold either:

- Full ownership of master + composition rights, OR
- A valid, current license to upload and distribute via digital streaming platforms

### 5.2 Co-Ownership and Revenue Splits

- Multi-party ownership splits are declared at upload
- Splits must sum to 100%
- All parties must have verified accounts before splits are paid
- Disputes are resolved via the Rights Dispute Process (Section 5.4)

### 5.3 Takedown Rights

Verified rights holders may request content removal by submitting to [takedown@CLIENTDOMAIN.com]:

- Title and artist of the disputed content
- Description of infringement
- Your rights basis (ownership, exclusive license, etc.)
- Sworn statement of good faith and authority to act

### 5.4 Rights Dispute Process

If a creator disputes a takedown:

1. Counter-notice submitted within 14 days
2. Complainant has 10 business days to file legal action
3. If no action filed, content may be reinstated

### 5.5 Fraudulent Reporting

Submitting a materially false takedown notice may result in account termination and legal liability.

---

## 6. DMCA / Takedown Procedure

**[Adapted for Canadian/African jurisdictions — COUNSEL MUST ADAPT]**

### 6.1 Designated Agent

**[CLIENT LEGAL ENTITY NAME]**
Attn: DMCA Agent
[Address]
Email: [takedown@CLIENTDOMAIN.com]

### 6.2 Notice Requirements

A valid takedown notice must include:

- Identification of the copyrighted work claimed to be infringed
- Identification of the infringing material and its URL on Zonga
- Your contact information (name, address, phone, email)
- Statement of good faith belief that use is not authorized
- Statement under penalty of perjury that you are authorized to act
- Physical or electronic signature

### 6.3 Response Timeline

- Acknowledgement: 2 business days
- Content review: within 72 hours of verified notice
- Content removal: immediately upon verification

---

## 7. Refund & Cancellation Policy

**[REQUIRES COUNSEL REVIEW]**

### 7.1 Subscriptions

- Cancel anytime from your account settings.
- Cancellation takes effect at the end of the current billing period.
- No refunds for partial billing periods.
- Exception: if service was unavailable for >72 continuous hours due to platform failure, pro-rated credit may be issued at operator discretion.

### 7.2 Event Tickets

- Refund window: 24 hours after purchase, if event is >7 days away.
- No refunds within 7 days of event.
- If event is cancelled by organiser: full refund within 5–10 business days.
- If event is postponed: ticket valid for new date; refund available within 48 hours of postponement announcement.

### 7.3 Creator Payouts

- Once a payout is approved and dispatched, it cannot be reversed from the platform.
- Disputes involving incorrect payout amounts: contact [finance@CLIENTDOMAIN.com] within 30 days.

---

## 8. Client Service Agreement (B2B)

**[REQUIRES COUNSEL REVIEW — this is the contract between Nzila / Zonga operator and the client organisation]**

### 8.1 Parties

- **Service Provider**: [Nzila OS Entity / Operator Legal Name]
- **Client**: [CLIENT LEGAL ENTITY]

### 8.2 Services

The Provider will operate the Zonga digital music and media platform, including:

- Upload, transcoding, and streaming of audio content
- Creator and listener account management
- Event ticketing and live streaming
- Revenue collection, payout processing, and earnings ledger
- Moderation and content rights management

### 8.3 Service Level Agreement (SLA)

| Metric | Target |
|---|---|
| Platform availability | 99.5% monthly uptime |
| Major incident response | < 1 hour |
| Critical bug fix | < 72 hours |
| Scheduled maintenance | Communicated 48h in advance |
| Payout processing | 3–7 business days |

### 8.4 Data Governance

- Client data is processed on behalf of the Client (data processor/controller relationship per applicable law).
- Provider will not use client data for any purpose beyond platform operation.
- Data processed in: [Canada / Azure Canada Central, AWS us-east-1].
- Data residency obligations: [COUNSEL MUST SPECIFY].

### 8.5 Fees

- [NEGOTIATED SEPARATELY — see attached Schedule A]
- Platform fees pass-through: Stripe processing fees, AWS/Azure infrastructure costs at cost + [X]%.

### 8.6 Term and Termination

- Initial term: 12 months
- Auto-renews monthly thereafter
- Either party may terminate with 30 days' notice
- Client data export provided within 30 days of termination

### 8.7 Liability Cap

**[COUNSEL MUST DRAFT]** — [Typically: aggregate liability capped at fees paid in the 12 months preceding the claim].

### 8.8 Governing Law

**[COUNSEL MUST SPECIFY JURISDICTION]**

---

## 9. Data Retention & Deletion Policy

**[REQUIRES COUNSEL REVIEW]**

| Data Category | Retention Period | Deletion Method |
|---|---|---|
| Active account data | Lifetime of account | User-initiated deletion or admin action |
| Deleted account data | 30 days (grace / recovery) | Automated purge |
| Earnings records | 7 years | Archive then purge |
| Payout records | 7 years | Archive then purge |
| Session tokens | Until logout or 30-day inactivity | Auto-invalidated |
| Playback logs | 24 months rolling | Automated purge |
| Content (audio/images) | Until creator deletes or takedown | Storage key removed from blob |
| Takedown records | 5 years | Archive |
| Audit logs (admin actions) | 3 years | Archive |
| Moderation records | 5 years | Archive |
| Event/ticket data | 3 years post-event | Archive |

### Account Deletion Request

- User submits deletion request via account settings or [privacy@CLIENTDOMAIN.com]
- Confirmation sent within 72 hours
- Irreversible deletion completed within 30 days
- Earnings data retained for 7 years regardless of deletion (regulatory requirement)

---

## 10. Next Steps for Legal Team

| Action | Owner | Priority |
|---|---|---|
| Engage qualified legal counsel in client's primary jurisdiction | Client / Nzila | 🔴 Before launch |
| Review all 9 documents above for jurisdiction-specific requirements | Counsel | 🔴 Before launch |
| Confirm POPIA compliance (South Africa) if ZA market | Counsel | 🔴 If applicable |
| Confirm NDPR compliance (Nigeria) if NG market | Counsel | 🔴 If applicable |
| Confirm GDPR compliance (EU diaspora) if EU users expected | Counsel | 🟠 Before EU launch |
| Register Designated DMCA Agent (US) | Counsel | 🟠 High |
| Publish finalized ToS and Privacy Policy to platform | Engineering | 🔴 Before launch |
| Wire ToS acceptance checkbox to account creation flow | Engineering | 🔴 Before launch |
| Cookie consent banner | Engineering | 🟡 Medium |

---

*Generated by Nzila OS Automation — Zonga Client Launch Readiness Sprint*
*This document does not constitute legal advice.*
