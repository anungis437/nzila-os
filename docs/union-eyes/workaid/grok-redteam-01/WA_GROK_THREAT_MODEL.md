# WA-GROK Threat Model — WorkAid × Union Eyes (R3)

**Mission:** WA-GROK-REDTEAM-01  
**HEAD:** `38a824918cf2e7d7cfb7fcb0e796cbde45433be8`  
**Date:** 2026-10-23 America/Toronto  
**Scope:** Design-time + source-attested threats for External Specialist Coordination (WorkAid Ontario WSIB/WSIAT first specialization). No live exploitation against real tenants.

---

## 1. Actors

| Actor | Goals | Capabilities | Trust assumption |
|---|---|---|---|
| **Domenic** (WorkAid specialist) | Complete referrals, prepare DOA/WRF/ITO/ARF, confirm WSIB receipts, develop evidence | Legitimate grants on assigned matters; phone/email to WSIB; Clio (external, out of band) | Trusted professionally; still in scope for confused-deputy and wrong-org mistakes |
| **Angelo** (WorkAid principal) | Oversight, escalations, WSIAT pathway validation | Caseload aggregates; supervisory exceptions | Trusted; must not gain raw cross-union medical without necessity |
| **Union referral representative** | Submit complete packets; track institutional status | Upload docs; see union-permitted metadata | Semi-trusted; may be curious or coerced; primary insider threat for over-access |
| **Union institutional admin** | Governance metrics | Aggregate oversight | Semi-trusted; small-cell re-identification risk |
| **Member / claimant** | See truthful approved status; upload own materials; exercise access rights | Own portal session; own uploads | Authenticated but may share devices; compromised session threat |
| **WorkAid staff (general)** | Support Domenic/Angelo | Possibly multi-org specialist identity | Must be scoped per matter + specialist org |
| **UE platform admin / operator** | Infra health, incidents | Service roles, `withSystemContext`, break-glass potential | High privilege; must not imply claim-data access by default |
| **Adversary** (external) | Steal medical/ID/claim data; disrupt deadlines; inject malware/prompts | Network access to public endpoints; stolen links; phishing; malicious uploads | Untrusted |
| **Compromised session / insider collusion** | Cross-tenant read, export, replay | Valid cookies + guessed IDs | Treat as authenticated attacker |

---

## 2. Assets

| Asset | Sensitivity | Notes |
|---|---|---|
| Medical evidence / clinical notes | Highest | WorkAid-restricted by default |
| Government photo ID | Highest | Identity theft / fraud |
| WSIB claim numbers | High | Not authorization keys; still identifying |
| Professional / privileged notes | Highest | Prefer Clio; never mirror to union |
| Union/member case notes | High | Institutional confidentiality |
| DOA / WRF / ITO / ARF / NOA / COA artifacts | High | Legal process integrity |
| Representation authority & grant records | High | Confused-deputy if misread |
| Auth sessions / tokens / service identities | Critical | Revocation must bite |
| Signed / SAS download URLs | Critical | Long TTL ≈ durable secret |
| Notification payloads & search indexes | High | Metadata side channel |
| Audit logs | High (integrity) | Must exclude raw medical bodies |
| Synthetic demo personas | Low | Must stay labeled demo |

---

## 3. Trust boundaries

```
[Member device] --HTTPS--> [UE edge / auth]
                              |
                    +---------v----------+
                    | Tenant org context |  <-- must bind ONE active membership
                    +---------+----------+
                              |
         +--------------------+--------------------+
         |                    |                    |
   [Union institutional] [WorkAid specialist org] [Platform/system role]
         |                    |                    |
   referral packet      matter/document grants   ops without claim read
         |                    |
         v                    v
   publication gates    representation authority
         |                    |
         +--------+-----------+
                  |
           [Document store / blob]
                  |
           signed URL egress  <-- short TTL + re-authz required
                  |
           [Email/push sinks] <-- purpose-limited payloads only

External: [Clio] [WSIB/WSIAT] = OUT OF BAND for pilot (no connector at HEAD)
```

**Critical separations:**  
1) Technical view grant ≠ WorkAid acceptance ≠ WSIB DOA.  
2) Union release ≠ member release ≠ professional storage.  
3) Grievance deadline engine ≠ WSIB statutory obligation.  
4) Demo sandbox ≠ production runtime.

---

## 4. Abuse cases (mapped to R3)

| ID | Abuse case | Primary findings |
|---|---|---|
| AB-01 | Cross-union IDOR via forged org id on server action / API | WA-R3-001, 002, 003, 004 |
| AB-02 | Multi-union worker claim number used as key | WA-R3-003 |
| AB-03 | Specialist multi-org queue bleed | WA-R3-004 |
| AB-04 | Search/export/preview/cache title leak | WA-R3-005, 013 |
| AB-05 | Year-long signed URL after revoke | WA-R3-006, 008, 015 |
| AB-06 | Treat view grant as representation / file ITO | WA-R3-007, 009 |
| AB-07 | Member portal shows professional docs/status | WA-R3-011 |
| AB-08 | Notification lock-screen clinical title | WA-R3-010, 022 |
| AB-09 | Stale session after role/authority change | WA-R3-015, 018 |
| AB-10 | UI-only hide while API returns body | WA-R3-016 |
| AB-11 | Service role / empty org context read | WA-R3-017 |
| AB-12 | Malicious PDF / prompt injection into AI | WA-R3-020, 021 |
| AB-13 | Map WSIB deadlines onto grievance engine | WA-R3-023 |
| AB-14 | Fake “Clio integrated” operational dual desk | WA-R3-024 |
| AB-15 | Aggregate dashboard re-identifies claimant | WA-R3-026 |
| AB-16 | Promote WorkAid while UE NO-GO | WA-R3-017, 025 |

---

## 5. STRIDE-style highlights

| Category | Example |
|---|---|
| Spoofing | Forged organizationId on actions; stolen SAS URL |
| Tampering | Malformed intake metadata; dual send events |
| Repudiation | Audit sink down while upload “succeeds” (R1-08 still relevant) |
| Information disclosure | Titles in search/notifications; cross-tenant segments |
| Denial of service | Huge/malware uploads; notification queue crash missing receipt calls |
| Elevation of privilege | View grant → professional action; steward-plus overbreadth on medical labels |

---

## 6. Residual platform posture

UE production readiness document on this HEAD remains **NO_GO / RUNTIME_PROOF_REQUIRED**. Public staging probes returned **503 maintenance**. Therefore WorkAid design may continue in parallel, but **no customer-data execution** and **no UE production promotion** under this threat model until separately proven.

*Threat model supports R3; not a sign-off.*
