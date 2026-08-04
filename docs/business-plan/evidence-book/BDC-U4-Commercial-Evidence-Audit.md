# Commercial Evidence Audit

**Prepared:** 2026-08-01
**Scope:** Every commercial statement must map to documentary evidence.
**Instruction:** Build a claim-evidence-confidence-gap matrix. Any claim without evidence must either be downgraded, rewritten, or removed.

---

## Method

Each material commercial claim in the dossier is assigned:
- **Claim** — exact wording from source document
- **Evidence** — repository artifact(s) supporting the claim
- **Confidence** — Verified / Documented / Inferred / Not Evidenced
- **Gap** — what is missing
- **Disposition** — Keep As-Is / Downgrade / Rewrite / Remove

---

## Claim Matrix

### Commercial Traction and Pipeline

---

**Claim CEA-01**
> "Commercialization has begun. The pipeline is active."

**Source:** `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md`

**Evidence:** Revenue cockpit exists. TOP_15_PURSUIT_LIST exists. UNION_GTM_MAP exists.

**Confidence:** Inferred

**Gap:** The revenue cockpit explicitly shows "Awaiting activity data" as the null state for all activity KPIs (emails sent, replies received, calls completed, demos delivered). The deal table is labeled "as of data seed." No outreach activity, no meeting log, and no prospect responses are documented.

**Disposition:** Rewrite — "Commercial infrastructure is fully built and the pipeline management system is operational. Outreach has not yet been formally logged in the system."

---

**Claim CEA-02**
> "Active commercial motions: Executive discovery meetings"

**Source:** `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md`

**Evidence:** "Documented in commercial pursuit system and conversation guides"

**Confidence:** Documented

**Gap:** No meeting dates, no counterparty names, no outcomes, no follow-up evidence. "Documented in the pursuit system" is circular when the pursuit system shows no activity data.

**Disposition:** Downgrade — "Executive-targeted conversation guides and materials are prepared and ready. No completed meeting outcomes are formally recorded in-repository."

---

**Claim CEA-03**
> "Active commercial motions: Union demonstrations"

**Source:** `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md`

**Evidence:** "Pilot offer to CUPE and documented union GTM map"

**Confidence:** Documented

**Gap:** A pilot offer document and a GTM map are marketing assets. They are not evidence that a demonstration has been delivered to any union organization.

**Disposition:** Downgrade — "Union-targeted demonstration materials and a CUPE-specific pilot offer are prepared and ready for delivery."

---

**Claim CEA-04**
> "Active commercial motions: Pilot discussions"

**Source:** `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md`

**Evidence:** "Union Eyes controlled-pilot GO clearance with defined pilot offer"

**Confidence:** Documented

**Gap:** GO clearance means the product is technically authorized to run a pilot. It is not evidence that a pilot discussion with any external organization is in progress.

**Disposition:** Downgrade — "Union Eyes has received controlled-pilot GO clearance. The company is ready to initiate pilot discussions. No external pilot discussion is formally recorded."

---

**Claim CEA-05**
> "deal-001 CUPE Local 123 — pilot_active"

**Source:** `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`

**Evidence:** Deal table labeled "Current Live Calculation (as of data seed)"

**Confidence:** Not Evidenced

**Gap:** The label "as of data seed" indicates this is a developer-inserted example record, not an actual customer engagement.

**Disposition:** Remove — this deal record must not be cited as commercial evidence until replaced by an actual customer record.

---

**Claim CEA-06**
> "deal-004 CLC National — ingestion_running — $250,000"

**Source:** `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md`

**Evidence:** Deal table labeled "as of data seed"

**Confidence:** Not Evidenced

**Gap:** Same as CEA-05. Additionally, "ingestion_running" at $250,000 is the single largest weighted pipeline item ($225,000 of $368,750 total). If this is seeded data, the weighted pipeline figure is materially misleading.

**Disposition:** Remove — cannot be cited as pipeline evidence.

---

### Product and Technology Claims

---

**Claim CEA-07**
> "Production-certified infrastructure supporting Union Eyes"

**Source:** `docs/business-plan/evidence-book/14-Founder-Investment.md`

**Evidence:** `docs/readiness/production-certification.md`, `docs/readiness/production-ready-release-summary.md`

**Confidence:** Demonstrated

**Gap:** Certification is self-issued (internal). No external auditor or third party has reviewed it. This is acceptable if clearly framed as internal certification.

**Disposition:** Rewrite — "Union Eyes infrastructure has received internal production-readiness certification. External independent validation has not yet been conducted."

---

**Claim CEA-08**
> "Security architecture: Row-level security, RBAC, audit chains, CI/CD security scans, SBOM, and DAST integration"

**Source:** `docs/business-plan/evidence-book/14-Founder-Investment.md`

**Evidence:** Code artifacts cited for RLS, SBOM workflow, DAST workflow, CI governance evidence pack

**Confidence:** Verified (for architecture); Documented (for external attestation)

**Gap:** No external pentest has confirmed these controls work under adversarial conditions. Controls are internally implemented and internally evidenced.

**Disposition:** Keep with caveat — "Security architecture is implemented and internally evidenced. External penetration testing has not been completed."

---

**Claim CEA-09**
> "Controlled demonstration environments"

**Source:** `docs/business-plan/evidence-book/15-Commercial-Traction-Pipeline.md`

**Evidence:** `apps/union-eyes/` — "controlled-pilot GO clearance"

**Confidence:** Demonstrated

**Gap:** None material — the demo environment exists and GO clearance is documented.

**Disposition:** Keep As-Is.

---

**Claim CEA-10**
> "SOC 2 Type II certification (on completion, included in subscription)"

**Source:** `docs/categories/stakeholders/commercial/pricing-framework.md`

**Evidence:** None — SOC 2 has not been completed.

**Confidence:** Not Evidenced

**Gap:** SOC 2 Type II has not been initiated or completed. The gap register classifies this as Critical.

**Disposition:** Rewrite — "SOC 2 Type II readiness program is underway. Certification is targeted for completion on a schedule to be confirmed. Subscription pricing includes SOC 2 certification upon completion." Remove from "always included" until a completion date is documented.

---

### Market and Competitive Claims

---

**Claim CEA-11**
> "For reference — comparable tools in the Canadian market: LaborSoft, UnionTrack, Custom build"

**Source:** `docs/categories/stakeholders/commercial/pricing-framework.md`

**Evidence:** No citation. Price comparison figures are unattributed.

**Confidence:** Not Evidenced

**Gap:** Competitive pricing figures ($60,000–$80,000 for LaborSoft; $45,000–$65,000 for UnionTrack) have no source citations.

**Disposition:** Downgrade — "Estimated competitive pricing benchmarks, not independently verified. Cite source or remove."

---

**Claim CEA-12**
> "Qualifies for $500K–$1.5M annually in non-dilutive government funding"

**Source:** `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`

**Evidence:** SR&ED program eligibility criteria cited; OITC criteria cited; IRAP and BDC applications described.

**Confidence:** Documented

**Gap:** This is eligibility, not approval. No government funding approval letter or confirmed grant exists in-repo. The document is from February 2026; application statuses may have changed.

**Disposition:** Rewrite — "Nzila has identified and applied for non-dilutive government programs with estimated combined value of $500K–$1.5M annually. SR&ED claims are active. Other programs are pending confirmation."

---

### Governance and Compliance Claims

---

**Claim CEA-13**
> "The repository demonstrates sustained operating activity across governance, engineering, commercial, and product surfaces."

**Source:** `docs/business-plan/evidence-book/01-Company.md`

**Evidence:** Full repository scan: 26 apps, 225 packages, 52 workflows, governance artifacts, commercial artifacts.

**Confidence:** Verified

**Gap:** None — repository artifacts confirm this.

**Disposition:** Keep As-Is.

---

**Claim CEA-14**
> "3 patent filings pending"

**Source:** `governance/corporate/finance/GOVERNMENT_FUNDING_STRATEGY.md`

**Evidence:** None in the business plan package or IP section.

**Confidence:** Not Evidenced (in dossier)

**Gap:** No patent application numbers, filing dates, or descriptions appear in the IP section (`docs/business-plan/evidence-book/09-IP.md`).

**Disposition:** Verify and add to IP section, or remove from any external-facing claim.

---

## Summary

| ID | Claim | Confidence | Disposition |
|---|---|---|---|
| CEA-01 | Pipeline is active | Inferred | Rewrite |
| CEA-02 | Executive discovery meetings active | Documented | Downgrade |
| CEA-03 | Union demonstrations active | Documented | Downgrade |
| CEA-04 | Pilot discussions active | Documented | Downgrade |
| CEA-05 | CUPE Local 123 pilot_active | Not Evidenced | Remove |
| CEA-06 | CLC National $250K ingestion_running | Not Evidenced | Remove |
| CEA-07 | Production-certified infrastructure | Demonstrated | Rewrite (add external caveat) |
| CEA-08 | Security architecture implemented | Verified | Keep with caveat |
| CEA-09 | Controlled demo environment exists | Demonstrated | Keep As-Is |
| CEA-10 | SOC 2 included in subscription | Not Evidenced | Rewrite |
| CEA-11 | Competitive pricing benchmarks | Not Evidenced | Downgrade |
| CEA-12 | $500K–$1.5M government funding | Documented | Rewrite |
| CEA-13 | Sustained operating activity | Verified | Keep As-Is |
| CEA-14 | 3 patent filings pending | Not Evidenced | Verify or remove |

---

## Counts

| Disposition | Count |
|---|---|
| Keep As-Is | 2 |
| Keep with caveat | 1 |
| Rewrite | 4 |
| Downgrade | 4 |
| Remove | 3 |

**3 claims must be removed before this dossier is submitted to BDC.** They present seeded/illustrative data as commercial activity.

**4 claims must be rewritten** to align the external framing with the dossier's own evidence boundaries.
