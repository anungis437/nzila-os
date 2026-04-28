# Data Breach Reporting Requirements — Summary

**Doc ID:** BRR-2026-001
**Version:** 1.0
**Authority:** Privacy Lead
**Use:** Companion to [security-incident-management-plan.md](security-incident-management-plan.md) §5.

> **DO NOT use this as legal advice.** Always consult counsel for active incidents.

## 1. Jurisdictions

| Jurisdiction | Trigger | Authority deadline | Data-subject deadline |
|-------------|---------|--------------------|------------------------|
| **GDPR (EU/EEA)** | Personal data breach likely to result in risk to rights/freedoms | **72 hours** to lead supervisory authority (Art. 33) | "Without undue delay" if HIGH risk (Art. 34) |
| **UK GDPR** | As above | **72 hours** to ICO | As above |
| **PIPEDA (Canada)** | Breach of security safeguards involving personal information posing **real risk of significant harm (RROSH)** | "As soon as feasible" to OPC + record of every breach kept 24 months | "As soon as feasible" to affected individuals |
| **HIPAA (US, PHI)** | Acquisition, access, use, or disclosure of unsecured PHI not permitted by Privacy Rule | **60 days** to HHS (≥500 individuals → also media) | **60 days** to individuals |
| **CCPA/CPRA (California)** | Unauthorized acquisition of unencrypted personal information | "Most expedient time possible" | Same |
| **Quebec Law 25** | Confidentiality incident posing risk of serious injury | "Promptly" to CAI | Same |
| **Provincial PHI laws (e.g., PHIPA Ontario)** | PHI lost / stolen / accessed unauthorized | Varies; PHIPA: at first reasonable opportunity | Same |

## 2. The "real risk of significant harm" test (PIPEDA)

Considers:

- Sensitivity of the personal information
- Probability that the information has been / is / will be misused
- Any other prescribed factor

Examples of significant harm: bodily harm, humiliation, damage to reputation
or relationships, loss of employment/business/professional opportunities,
financial loss, identity theft, negative effect on credit record.

## 3. Decision tree

```
Detect potential breach
    |
    v
Does it involve personal data?  -- No --> Standard incident only (no privacy clock)
    |
   Yes
    v
What jurisdictions / data subjects affected?
    |
    v
For each jurisdiction, apply test:
  - GDPR: risk to rights/freedoms?    -> notify authority within 72h
                                         -> notify subjects if HIGH risk
  - PIPEDA: RROSH?                     -> notify OPC + subjects ASAP
  - HIPAA: PHI involved?               -> notify HHS + subjects within 60d
                                         -> media if >=500 in same state
  - CCPA: unencrypted PI acquired?     -> notify residents in most expedient time
    |
    v
Document EVERY breach (notified or not) — GDPR Art. 33(5), PIPEDA s. 10.3
```

## 4. Information required in notifications

Most notifications require:

- Nature of the breach + categories and approximate number of data subjects
- Categories and approximate number of records
- Name and contact of DPO / Privacy Lead
- Likely consequences
- Measures taken or proposed to address and mitigate
- For data subjects: practical steps they can take

## 5. Notification templates

### 5.1 Regulator notification (GDPR / PIPEDA — adapt fields)

```
To: <competent authority>
From: Nzila Ventures, Privacy Lead
Subject: Personal Data Breach Notification — <internal incident id>

Date and time of detection: <ISO timestamp>
Date and time of breach (estimated): <ISO timestamp>
Status: ongoing / contained / resolved

1. Nature of the breach: <confidentiality / integrity / availability>; describe
2. Categories of personal data: <e.g., contact info, member case data, voice recordings>
3. Approximate number of data subjects affected: <n>
4. Approximate number of records affected: <n>
5. Likely consequences: <e.g., risk of identity misuse, reputational harm>
6. Containment / mitigation measures taken: <list>
7. DPO / Privacy Lead contact: <name, email, phone>
8. Whether data subjects have been notified: yes / no / planned by <date>
9. Cross-border aspect: <jurisdictions involved>

Attachments: <forensic timeline if available>
```

### 5.2 Data-subject notification

```
Subject: Important — security incident affecting your Nzila account

Dear <name>,

On <date> we discovered <plain-language summary>. We have <containment
actions taken>. Based on our investigation, the following information about
you may have been affected:

  <bullet list of data categories>

What you can do:
  - <practical step 1, e.g., reset your password>
  - <practical step 2, e.g., monitor financial accounts>
  - <practical step 3, e.g., be alert to suspicious messages>

We have notified <relevant authority> and are continuing to investigate.

For questions, contact privacy@nzila.example or <phone>.

You have the right to file a complaint with <data protection authority>.

— Nzila Privacy Office
```

## 6. Records

Every breach (notified or not) is recorded in
`governance/privacy/incidents/log.csv` (TODO — create on first incident) with:
id, detected-at, contained-at, jurisdictions, data categories, count,
notification decisions, post-mortem link.
