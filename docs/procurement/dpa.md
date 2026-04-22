# Data Processing Agreement (DPA) Template

**UNION EYES – DATA PROCESSOR AGREEMENT**  
Version 1.0 | Template as of 2026-04-22

> **Note**: This is a template for review by legal counsel before execution. Do not execute without legal sign-off.

---

## Parties

**Data Controller**: [Union Name], a labour organization registered under [applicable provincial/federal legislation], with principal offices at [address] ("**Controller**")

**Data Processor**: Nzila OS Inc., a corporation incorporated under the laws of [Province], with principal offices at [address] ("**Processor**" or "**Nzila**")

---

## Recitals

A. Controller operates a labour union and processes member personal information in connection with grievance management, representation, elections, and related activities.

B. Controller wishes to engage Processor to provide the Union Eyes software platform ("**Platform**") to assist with the foregoing activities.

C. The parties agree that the processing of personal data by Processor on behalf of Controller shall be governed by this Agreement, consistent with Canada's *Personal Information Protection and Electronic Documents Act* (PIPEDA), applicable provincial privacy statutes (including Ontario's *Freedom of Information and Protection of Privacy Act* (FIPPA) and the *Personal Health Information Protection Act* (PHIPA) where applicable), and the *Labour Relations Act*.

---

## 1. Definitions

| Term | Meaning |
|---|---|
| **Personal Data** | Any information relating to an identified or identifiable natural person, including union members' names, contact details, employment records, grievance files, medical/accommodation information, and voting records |
| **Processing** | Any operation on Personal Data, including collection, storage, retrieval, use, disclosure, and deletion |
| **Sub-processor** | Any third party engaged by Processor to perform Processing on behalf of Controller |
| **Security Incident** | Any accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to Personal Data |

---

## 2. Scope and Purpose

2.1 Processor shall process Personal Data only on documented instructions from Controller, which shall be to provide the Union Eyes Platform services as described in the Order Form / Pilot Agreement.

2.2 Processor shall not process Personal Data for any purpose other than providing the Platform, including for AI model training, advertising, or sharing with third parties for their own purposes.

---

## 3. Data Residency

3.1 All Personal Data shall be stored and processed exclusively within **Microsoft Azure Canada Central (Toronto)**, unless Controller provides express written consent to a different jurisdiction.

3.2 Processor shall not transfer Personal Data outside of Canada without:  
(a) Controller's prior written consent, and  
(b) Confirmation of an adequate level of protection in the destination jurisdiction.

3.3 AI inference (Azure OpenAI) is performed within Microsoft's Azure tenant under Microsoft's contractual no-training commitment. Processor warrants that no Personal Data submitted to Azure OpenAI is used to train Microsoft's public models.

---

## 4. Sub-processors

4.1 Controller authorizes the following sub-processors as of the Effective Date:

| Sub-processor | Location | Purpose |
|---|---|---|
| Microsoft Azure | Canada Central (Toronto) | Hosting, storage, database, container runtime |
| Microsoft Azure OpenAI | East US / East US 2 (Microsoft tenant) | AI inference only — under Microsoft no-training commitment |
| GitHub | United States | Source code hosting and CI/CD (no Personal Data processed) |

4.2 Processor shall notify Controller at least 30 days before adding or replacing a sub-processor that will process Personal Data.

4.3 Controller may object to a new sub-processor within 14 days of notice. If the parties cannot resolve the objection, Controller may terminate the agreement without penalty.

---

## 5. Security Measures

5.1 Processor shall implement and maintain the following technical and organizational measures:

| Control | Implementation |
|---|---|
| Encryption at rest | AES-256 (Azure Storage Service Encryption, enabled by default) |
| Encryption in transit | TLS 1.3 with HSTS |
| Access control | RBAC per organization; RLS at database layer |
| Authentication | Argon2id password hashing (OWASP-hardened); optional Entra SSO |
| Audit logging | Cryptographic HMAC-sealed logs; non-repudiation evidence packages |
| Vulnerability scanning | Dependency audit + Trivy container scan in every CI/CD pipeline run |
| Secret management | Azure Key Vault; no secrets in source code |
| Account lockout | 5 failed attempts → 15-minute lockout |

5.2 Processor shall review and update these measures no less than annually.

---

## 6. Security Incident Response

6.1 Processor shall notify Controller without undue delay, and in any event within **72 hours** of becoming aware of a Security Incident.

6.2 Notification shall include, to the extent known:  
(a) Description of the nature of the incident;  
(b) Categories and approximate number of individuals affected;  
(c) Likely consequences;  
(d) Measures taken or proposed.

6.3 Processor shall cooperate with Controller's investigation and any required notifications to regulatory bodies (OPC, provincial commissioners).

---

## 7. Data Retention and Deletion

7.1 Processor shall retain Personal Data only as long as necessary to provide the Platform services.

7.2 Upon termination or Controller's request, Processor shall, at Controller's election:  
(a) Return all Personal Data in a portable format (CSV / JSON export); or  
(b) Securely delete all Personal Data within 30 days.

7.3 Processor shall provide written confirmation of deletion upon request.

---

## 8. Data Subject Rights

8.1 Processor shall promptly notify Controller of any request from a data subject exercising rights under PIPEDA or applicable provincial statutes (access, correction, deletion).

8.2 Processor shall not respond directly to data subject requests without Controller's instructions, unless required by law.

8.3 Processor shall assist Controller in fulfilling data subject requests using the Platform's member record management features.

---

## 9. Audits and Assessments

9.1 Processor shall make available all information necessary to demonstrate compliance with this Agreement.

9.2 Controller may, upon 30 days' written notice, conduct an audit of Processor's data processing activities no more than once per calendar year. Costs of audit shall be borne by Controller unless a material breach is found.

9.3 Processor shall notify Controller if, in its opinion, an instruction infringes PIPEDA or applicable provincial law.

---

## 10. Term and Termination

10.1 This Agreement is effective on the date of execution and continues until termination of the underlying Platform agreement.

10.2 Either party may terminate this Agreement for cause upon 30 days' notice if the other party materially breaches this Agreement and fails to cure within the notice period.

---

## 11. Governing Law

This Agreement is governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein.

---

## Signature Block

| Role | Name | Date |
|---|---|---|
| Controller (authorized signatory) | ___________________________ | ___________ |
| Nzila OS Inc. (authorized signatory) | ___________________________ | ___________ |

---

*This template is provided for negotiation purposes. Legal review required before execution.*
