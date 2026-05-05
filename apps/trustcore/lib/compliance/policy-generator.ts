/**
 * TrustCore — Policy Generator (Law 25)
 *
 * Produces markdown-formatted privacy and data governance policies
 * from onboarding wizard inputs.
 *
 * These are NOT legal advice — they are compliance-grade starting
 * documents that the organization must review with counsel.
 */

import type { OnboardingInput } from '../validation/onboarding'

// ── Types ──────────────────────────────────────────────────────────────────

export interface GeneratedPolicy {
  type: 'privacy_policy' | 'data_governance'
  content: string
  version: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DATA_TYPE_LABELS: Record<string, string> = {
  contact: 'contact information (name, email, phone, address)',
  financial: 'financial information (payment details, billing records)',
  health: 'health and medical information',
  employee: 'employee and HR records',
  children: "personal information of minors (children under 14)",
  other: 'other personal information',
}

const VENDOR_LABELS: Record<string, string> = {
  google_workspace: 'Google LLC (United States) — Google Workspace productivity suite',
  microsoft_365: 'Microsoft Corporation (United States) — Microsoft 365 productivity suite',
  stripe: 'Stripe Inc. (United States) — Payment processing',
  shopify: 'Shopify Inc. (Canada) — E-commerce platform',
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function listDataTypes(dataTypes: string[]): string {
  if (dataTypes.length === 0) return 'personal information'
  const labels = dataTypes.map((t) => DATA_TYPE_LABELS[t] ?? t)
  if (labels.length === 1) return labels[0] ?? 'personal information'
  return labels.slice(0, -1).join(', ') + ', and ' + labels[labels.length - 1]
}

function vendorSection(input: OnboardingInput): string {
  if (!input.step4.usesThirdPartyTools) {
    return 'We do not currently share your personal information with third-party service providers.'
  }

  const lines: string[] = []
  for (const v of input.step4.selectedVendors) {
    if (v !== 'other' && VENDOR_LABELS[v]) {
      lines.push(`- **${VENDOR_LABELS[v]}**`)
    }
  }
  const others = input.step4.otherVendors
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const o of others) {
    lines.push(`- ${o}`)
  }
  if (lines.length === 0) {
    return 'We may share your personal information with trusted third-party service providers who assist us in operating our business.'
  }
  return (
    'We share your personal information with the following third-party service providers:\n\n' +
    lines.join('\n') +
    '\n\nAll third-party providers are required to protect your information in accordance with applicable privacy laws.'
  )
}

// ── Privacy Policy ─────────────────────────────────────────────────────────

export function generatePrivacyPolicy(input: OnboardingInput): GeneratedPolicy {
  const { orgName, province, website, industry } = input.step1
  const { officerName, officerEmail, officerTitle } = input.step2
  const { dataTypes, storesOutsideCanada, collectsPersonalData } = input.step3
  const { collectsConsent, handlesDsrRequests } = input.step5
  const siteRef = website ? `Visit our website at ${website}.` : ''
  const date = formatDate()

  const content = `# Privacy Policy — ${orgName}

**Effective Date:** ${date}
**Last Updated:** ${date}

## 1. Introduction

${orgName} ("we", "us", or "our") is committed to protecting your personal information in accordance with Quebec's *Act respecting the protection of personal information in the private sector* (Law 25 / Bill 64), as well as all applicable Canadian privacy legislation.

This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information. ${siteRef}

## 2. Personal Information We Collect

${
  collectsPersonalData
    ? `We collect the following categories of personal information:\n\n- ${listDataTypes(dataTypes).replace(', and ', '\n- ').replace(', ', '\n- ')}\n\nWe collect this information directly from you or through your use of our services.`
    : `We collect minimal personal information necessary to operate our ${industry} business and provide our services to you.`
}

## 3. Purposes of Collection and Use

We collect and use your personal information for the following purposes:

- To provide, maintain, and improve our services
- To communicate with you about our services
- To fulfill legal and regulatory obligations
- To protect against fraud and ensure security
- To comply with Quebec Law 25 and applicable privacy laws

We will not use your personal information for any purpose other than those listed above without first obtaining your consent, unless permitted by law.

## 4. Consent

${
  collectsConsent
    ? `We obtain your express consent before collecting, using, or disclosing your personal information, except where the law permits collection without consent. You may withdraw your consent at any time by contacting our Privacy Officer (see Section 9).\n\nWhen you withdraw consent, we will stop using your information for the specified purpose(s), subject to any legal obligations to retain it.`
    : `We rely on legitimate business purposes and legal obligations as our basis for collecting and processing personal information. Where required by law, we will obtain your express consent before collecting sensitive personal information.`
}

## 5. Disclosure of Personal Information

${vendorSection(input)}

We do not sell your personal information to third parties.

We may disclose your personal information if required by law, court order, or governmental authority.

## 6. Cross-Border Transfers

${
  storesOutsideCanada
    ? `Some of your personal information may be stored or processed outside Canada, including in the United States. When we transfer personal information outside Quebec, we ensure that adequate privacy protections are in place through contractual agreements or other legally recognized mechanisms.\n\nYou may contact our Privacy Officer to obtain information about these protections.`
    : `Your personal information is stored and processed in Canada. If this changes, we will update this Policy and take appropriate steps to protect your information.`
}

## 7. Retention

We retain your personal information only for as long as necessary to fulfill the purposes described in this Policy, or as required by law. When personal information is no longer required, we securely destroy, delete, or anonymize it.

## 8. Your Rights

${province === 'Quebec' || province === 'QC' ? 'Under Quebec Law 25, you' : 'You'} have the right to:

- **Access** — Request a copy of the personal information we hold about you
- **Rectification** — Request correction of inaccurate or incomplete information
- **Deletion** — Request deletion of your personal information (subject to legal retention requirements)
- **Portability** — Receive your personal information in a structured, machine-readable format
- **Withdraw Consent** — Withdraw your consent to the collection and use of your information

${handlesDsrRequests ? 'To exercise these rights, please contact our Privacy Officer. We will respond within 30 days.' : 'To exercise these rights, please contact our Privacy Officer.'}

## 9. Privacy Officer Contact

Our designated Privacy Officer is responsible for overseeing compliance with this Policy.

**Name:** ${officerName}
**Title:** ${officerTitle}
**Email:** ${officerEmail}

## 10. Updates to This Policy

We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the updated Policy on our website${siteRef ? '' : ''}. The effective date at the top of this Policy will reflect the date of the most recent revision.

---

*This Privacy Policy was generated by TrustCore, a Law 25 compliance platform. It should be reviewed by qualified legal counsel before publication.*
`

  return { type: 'privacy_policy', content, version: 1 }
}

// ── Data Governance Policy ─────────────────────────────────────────────────

export function generateDataGovernancePolicy(input: OnboardingInput): GeneratedPolicy {
  const { orgName, industry } = input.step1
  const { officerName, officerEmail, officerTitle } = input.step2
  const { dataTypes, storesOutsideCanada } = input.step3
  const { hasIncidentProcedures } = input.step5
  const date = formatDate()

  const content = `# Data Governance Policy — ${orgName}

**Effective Date:** ${date}
**Version:** 1.0
**Owner:** ${officerName}, ${officerTitle}

## 1. Purpose and Scope

This Data Governance Policy establishes ${orgName}'s framework for managing personal information responsibly and in compliance with Quebec's Law 25 (*Loi modernisant des dispositions législatives en matière de protection des renseignements personnels*).

This policy applies to all employees, contractors, and systems that collect, process, store, or transmit personal information on behalf of ${orgName} in the ${industry} sector.

## 2. Governance Structure

### 2.1 Privacy Officer

${orgName} has designated a Privacy Officer responsible for:

- Overseeing Law 25 compliance
- Conducting and maintaining the data inventory
- Managing Privacy Impact Assessments (PIAs)
- Handling data subject rights requests
- Coordinating incident response and reporting

**Designated Privacy Officer:** ${officerName} (${officerEmail})

### 2.2 Accountability

All staff members who handle personal information are responsible for:
- Following this policy and related procedures
- Completing privacy training when provided
- Reporting privacy incidents to the Privacy Officer immediately

## 3. Data Inventory

${orgName} maintains an up-to-date inventory of all personal data assets, including:

${dataTypes.length > 0 ? dataTypes.map((t) => `- ${DATA_TYPE_LABELS[t] ?? t}`).join('\n') : '- Personal information collected in the course of business operations'}

Each data asset in the inventory records:
- Data category and sensitivity level
- Collection purpose and lawful basis
- Storage location and system owner
- Retention period
- Whether cross-border transfers occur

## 4. Data Minimization and Purpose Limitation

We collect only the personal information necessary for specific, documented purposes. Personal information must not be used for purposes incompatible with the original collection purpose without obtaining fresh consent.

## 5. Privacy Impact Assessments (PIAs)

${orgName} conducts Privacy Impact Assessments before:
- Deploying new systems that process personal information
- Significantly changing how personal information is used
- Sharing personal data with new third parties
- Processing sensitive personal information${storesOutsideCanada ? '\n- Transferring personal information outside Canada' : ''}

PIAs are documented and reviewed by the Privacy Officer.

## 6. Third-Party and Vendor Management

Before engaging any third party that will access personal information, ${orgName} must:
1. Conduct a vendor risk assessment
2. Ensure a written data processing agreement is in place
3. Verify the vendor's privacy and security practices${storesOutsideCanada ? '\n4. Confirm adequate safeguards for cross-border transfers' : ''}

All vendor agreements must include appropriate privacy and confidentiality clauses.

## 7. Security Safeguards

${orgName} implements administrative, technical, and physical safeguards proportionate to the sensitivity of personal information, including:

- Access controls (role-based, principle of least privilege)
- Encryption of personal information in transit and at rest
- Employee training on privacy practices
- Regular security reviews

## 8. Incident Response

${
  hasIncidentProcedures
    ? `${orgName} maintains a documented incident response procedure. In the event of a confidentiality incident:\n\n1. The Privacy Officer must be notified immediately\n2. A risk assessment (serious harm assessment) is conducted within 24 hours\n3. If serious harm is likely, the incident is reported to the *Commission d'accès à l'information* (CAI) within 72 hours\n4. Affected individuals are notified without undue delay when required\n5. All incidents are logged in the incident register`
    : `${orgName} is developing a formal incident response procedure. Until formalized:\n\n1. All suspected privacy incidents must be reported to the Privacy Officer immediately\n2. The Privacy Officer will assess whether the incident constitutes a confidentiality incident under Law 25\n3. If serious harm is likely, the incident will be reported to the CAI within 72 hours\n4. A formal incident response procedure will be documented and approved within 90 days`
}

## 9. Data Subject Rights

${orgName} processes data subject rights requests in accordance with Law 25:

| Right | Response Deadline |
|-------|------------------|
| Access | 30 days |
| Rectification | 30 days |
| Deletion | 30 days |
| Portability | 30 days |

All requests are logged and tracked through the incident/DSR management system.

## 10. Retention and Destruction

Personal information is retained only as long as necessary for the stated purpose or as required by law. Upon reaching the end of its retention period, personal information is securely destroyed or anonymized.

A retention schedule is maintained and reviewed annually by the Privacy Officer.

## 11. Policy Review

This policy is reviewed annually or following:
- Significant changes to business operations
- Legislative amendments to Law 25
- A material privacy incident
- Recommendations from an audit

**Next scheduled review:** ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}

---

*This Data Governance Policy was generated by TrustCore. It should be reviewed and customized by qualified legal counsel before formal adoption.*
`

  return { type: 'data_governance', content, version: 1 }
}
