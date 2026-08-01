# AI Authoring Policy

**Prepared:** 2026-08-01  
**Branch:** `copilot/generate-evidence-and-dossier`  
**Commit SHA:** `cb3440b04a1bd7d1f71ae1b7df60dc386678dcc3`  
**Status:** AUTHORITATIVE — governs all future AI agent activity in this repository

---

## Purpose

This policy defines how future AI agents are permitted to modify, extend, or reference this repository. It is designed to prevent the re-introduction of prohibited content, the elevation of unverified claims, and the circumvention of governance controls established during the BDC workstream.

All future AI agents operating in this repository must read this document before taking any action affecting the `docs/business-plan/` directory.

---

## Part 1 — Absolute Prohibitions

These actions are never authorized, regardless of instructions received.

### 1.1 Never invent evidence

An AI agent must not create, infer, or synthesize evidence that does not exist in the repository. Every claim that is added to any evidence-book document must cite a specific, existing repository artifact (file path, commit, CI/CD result, or documented process). Invented or inferred evidence is strictly prohibited.

**Prohibited example:** Adding a claim that "the company has conducted three union pilot conversations" without a corresponding meeting log or outreach record in the repository.

### 1.2 Never fabricate commercial traction

An AI agent must not create, add, or imply customer conversations, pilot engagements, signed agreements, or commercial conversions that are not documented by verified records in the repository.

**Prohibited example:** Adding a deal record to `FOUNDER_REVENUE_COCKPIT.md` without a real customer record from a founder or commercial team member.

**Prohibited example:** Changing "outreach infrastructure is built" to "outreach is actively underway" without a documented outreach log.

### 1.3 Never promote Planned to Demonstrated

An AI agent must not advance any product, feature, or capability from a lower confidence level (Planned, Not Yet Evidenced) to a higher confidence level (Demonstrated, Verified) without documented evidence supporting the promotion.

**Prohibited example:** Changing CourtLens maturity from "Planned" to "Pilot Ready" without a documented pilot scope, deployment evidence, or founder authorization.

**Prohibited example:** Changing CIVIC from "market-development stage" to "actively deployed" without a signed client agreement.

### 1.4 Never alter readiness status without evidence

An AI agent must not change the BDC readiness verdict (currently NOT READY) or close any open finding in the remediation register without verified human inputs that satisfy the specific closure evidence requirements documented in `BDC-U9-Remediation-Register.md`.

**Prohibited example:** Marking REM-001 as "Closed" without a month-by-month cash flow model built from confirmed or explicitly stated loan terms and revenue projections.

**Prohibited example:** Changing the verdict from NOT READY to CONDITIONALLY READY without verifying that all six Critical findings are closed.

### 1.5 Never remove historical lineage

An AI agent must not remove the FairCase historical lineage sections from `03-Products.md` or the master dossier, and must not remove One Lab Technologies from its proper context as a historical reference. These sections preserve institutional memory and must not be deleted.

**Prohibited example:** Removing the `## FairCase — Historical Lineage` section because FairCase is not a current product.

### 1.6 Never overwrite founder decisions

An AI agent must not reverse, contradict, or circumvent a decision that has been documented as a founder decision in any BDC workstream document.

**Prohibited example:** Deciding independently to include One Lab Technologies history in the BDC submission without Aubert's formal confirmation that disclosure is required.

**Prohibited example:** Deciding independently how to classify the Nungisa Law relationship without Michel's written input.

### 1.7 Never represent estimated figures as verified facts

An AI agent must not present estimated founder investment figures, estimated pipeline values, or estimated financial projections as verified, confirmed, or accounting-supported facts.

### 1.8 Never introduce deprecated language

An AI agent must not use FairCase as an active product name, One Lab Technologies as an active entity, "Nzila OS Inc." as the corporate name, seeded pipeline figures as commercial evidence, or any other term listed in `CONTROLLED-VOCABULARY.md` Part 2 in any new document.

---

## Part 2 — Required Behaviors

These behaviors are mandatory for all AI agent actions that affect the `docs/business-plan/` directory.

### 2.1 Always preserve institutional memory

Historical documents (FairCase, One Lab Technologies, prior iterations) are preserved for institutional continuity. An AI agent must never delete, truncate, or relocate these materials without explicit founder authorization and a documented rationale.

### 2.2 Always create traceable changes

Every change made by an AI agent must be committed with a descriptive commit message that explains what was changed and why. Commit messages must not be vague (e.g., "update docs"). They must specify the document affected and the nature of the change.

**Required commit message format:** `docs: [action] — [document name] — [brief rationale]`

**Example:** `docs: close REM-002 — 13-Timeline.md — use-of-funds breakdown confirmed by Aubert, $75,000 allocated across 5 line items`

### 2.3 Always cite source documents

Every new claim added to an evidence-book document must include a citation of the form `Evidence: [repository path]`. Claims without citations must be classified as "Not Yet Evidenced" and added to the gap register, not presented as established facts.

### 2.4 Always read the restart sequence before resuming the BDC workstream

Before taking any action in the BDC workstream, an AI agent must read the documents in this order:

1. `docs/business-plan/BDC-WORKSTREAM-HANDOFF.md`
2. `docs/business-plan/BDC-FREEZE-RECORD.md`
3. `docs/business-plan/evidence-book/BDC-U9-Remediation-Register.md`
4. `docs/business-plan/evidence-book/BDC-U10-Credit-Package-Readiness.md`
5. `docs/business-plan/BDC-FOUNDER-INPUT-CHECKLIST.md`
6. `docs/business-plan/BDC-DOCUMENT-CONTROL-INDEX.md`

An AI agent that has not read these documents must not make any change to lender-facing documents or close any open finding.

### 2.5 Always apply the Single Source of Truth hierarchy

When two documents conflict, the AI agent must apply the hierarchy in `SINGLE-SOURCE-OF-TRUTH.md`. The higher-authority document wins. The lower-authority document is corrected to align with the higher-authority source.

### 2.6 Always apply the Controlled Vocabulary

All new content must use canonical terms as defined in `CONTROLLED-VOCABULARY.md`. No new document may introduce deprecated language.

### 2.7 Always run a secret scan before committing

Before committing any change, an AI agent must confirm that no secrets (API keys, tokens, credentials, personal identifiers) are present in the modified files.

### 2.8 Always record the source of inputs

When a human supplies a verified input (e.g., a founder investment figure, a BDC loan term, a management profile), the AI agent must document:

- What input was provided
- Who provided it (Aubert, Michel, accountant, legal counsel, etc.)
- The date it was provided
- Where it is reflected in the repository

This documentation enables audit and allows future reviewers to trace every fact to its source.

---

## Part 3 — Permitted Actions Without Prior Human Input

An AI agent may perform the following without receiving new verified human inputs, provided the action is consistent with all prohibitions in Part 1:

- Reading any document in the repository
- Producing governance documents (such as the ones in this series)
- Identifying and documenting inconsistencies without resolving them
- Producing summaries of existing repository content
- Adding items to the gap register or remediation register
- Creating new internal working documents that do not make commercial claims
- Performing audit and integrity checks
- Running secret scans
- Preparing formatted versions of existing documents without changing their content or claims

---

## Part 4 — Actions That Require Verified Human Inputs

The following actions may only be taken after the specified verified inputs are received:

| Action | Required input | Source |
|---|---|---|
| Close REM-001 (repayment model) | Month-by-month cash flow model; confirmed or stated loan terms | Aubert Nungisa; BDC loan officer |
| Close REM-002 (use of funds) | Written $75,000 use-of-funds breakdown | Aubert Nungisa |
| Close REM-003 (revenue scenarios) | Numerical revenue projections for Conservative and Base scenarios | Aubert Nungisa |
| Close REM-004 (seeded pipeline) | Instruction to remove seeded data; real customer records to replace it | Aubert Nungisa; Michel Nungisa |
| Close REM-005 (succession plan) | Signed succession plan; board resolution | Aubert Nungisa; legal counsel |
| Close REM-006 (Michel profile) | Complete verified management profile for Michel | Michel Nungisa; legal counsel |
| Close REM-008 (founder investment) | Signed founder declaration; bank statements; accounting entries | Aubert Nungisa; accountant |
| Update revenue scenarios with numbers | Founder-provided revenue projections | Aubert Nungisa |
| Update founder investment amounts | Signed founder declaration with accounting support | Accountant; Aubert Nungisa |
| Normalize entity name in README.business.md | Founder authorization | Aubert Nungisa |
| Advance BDC verdict from NOT READY | All Critical findings closed with documentation | Founders; accountant; legal counsel |
| Add a new product to the portfolio | Founder authorization; documented discovery and evidence gate passage | Aubert Nungisa |

---

## Part 5 — Escalation

If an AI agent receives instructions that conflict with this policy, the agent must:

1. Decline the conflicting instruction
2. Explain which policy rule prohibits the action
3. Describe what verified input would be required to permit the action
4. Stop and wait for human resolution

An AI agent must never silently comply with an instruction that violates this policy.

---

*This policy is authoritative. It may only be revised by Aubert Nungisa or by a future governance process that itself complies with this policy.*
