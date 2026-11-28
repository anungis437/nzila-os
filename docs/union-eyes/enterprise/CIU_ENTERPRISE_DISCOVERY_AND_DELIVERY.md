# CIU enterprise discovery and delivery — internal working kit
2026-11-28. Prepared for pre-introduction rehearsal. Not client-approved, not a proposal, no production readiness claim. Reuse canonical Nzila procurement and contract materials; this is an engagement-specific overlay, not replacement legal terms.

## Executive engagement
Objective: agree business outcome, scope, authority, evidence and system discovery. Lead with representation continuity and controlled integration. Do not request internal credentials or case data via informal sponsor. Do not imply sponsor procurement authority or client adoption.
75-minute agenda: 5 Nzila overview; 15 institutional objectives; 20 synthetic demo; 20 ecosystem and data discovery; 10 security/implementation; 5 next-step agreement. Offer English or French, with accessible materials. Identify decision-makers and procurement route formally.
Demonstrate member intake; steward assignment; branch-to-national referral; LRO review and deadline trace; national aggregate without unauthorized case contents; mapping preview and reconciliation only when actual operation qualified. Never show a restricted feature as live; no real CIU records or name/logo in tenant without permission.

## Discovery collection template
Complete one record per source, not one questionnaire per vendor. Start with schemas, counts and synthetic/sanitized sample only.
Field | Required discovery output
---|---
Source ID and system | Name, vendor/version, environment, business owner, technical owner
Scope | Entity set, authoritative fields, historical coverage, business workflow, record counts, growth
Identity | Stable source identifiers, namespace, branch membership and transfers, merge/split behavior, effective dates
Transport | Authorized API/SFTP/export, format/encoding, incremental marker, frequency, rate limits, replay window
Authority | Read/write permissions, approved service identity, contractual rights, purpose, approval record
Privacy | Data classification, restricted content, privilege, geographic residence, subprocessors, retention/hold, deletion
Quality | Missing/duplicate/conflicting IDs, language, source timezone, missing dates, document availability, checksum
Mapping | Source field/path, target entity/field, transformation/version, value map, requiredness, null semantics, conflict policy
Operations | Cutover window, delta sync, monitoring, rejection queue, rollback/exit, support owner
Acceptance | Manifest digest, count and amount reconciliation, sampled record signoff, exceptions disposition, approval

Candidate source inventory (hypotheses, not confirmed access): PSAC member/dues system; national grievance database; branch records/email exports; CBSA grievance receipt numbers (no assumed employer integration); identity directory; accounting; election provider; collective agreement and governance documents; secure document repository.
Discovery decisions: coexist vs migration; system of record per field; inbound vs outbound; active vs historical; restricted material handling; permitted exchange with PSAC/CBSA/counsel; no direct employer sync without authority. Security and privacy review before transferring any data.

## Delivery method and stop/go gates
D0 mobilization: sponsor, delivery owner, decision authority, scope, contract/DPA, approved data classification and communication.
D1 discovery: system inventory, process walkthroughs, sample schemas, volume metrics, source-of-truth map, data access approval.
D2 design: mapped tenant/branch model, authority and policy configuration, interface contracts, acceptance matrix and cutover plan.
D3 build/configure: institution-neutral provisioning; mapping/version setup; controlled import into isolated nonproduction; deny unknown or conflicting records; record provenance.
D4 migration rehearsal: manifest, dry run, duplicate and conflict decisions, count reconciliation by domain/branch, hashes, rollback simulation, delta replay; human signoff.
D5 UAT: authorized users, EN/FR and mobile, role capacity, grant/revoke, nonresponse/failure, support, restoration and privacy checks. No real voting/payment/mandate without adoption.
D6 controlled cutover: current release GO, client acceptance, reconciled source freeze/delta, backup, rollback threshold, operations handover.
D7 hypercare/BAU: issue intake, bilingual support, incident communications, adoption and outcome metrics, scheduled review and exit readiness.
Never claim a time/cost/SLA before resource plan and signed scope. For customer success track deadline coverage, handoff completeness, time to acknowledge, migration exceptions, evidence availability and adoption; baseline with CIU before setting targets.

## Internal responsibility model (role assignments proposed, not confirmed)
Executive sponsor: Nzila commercial lead; technical solution owner: engineering lead; delivery: implementation lead; privacy/security: designated competent owner; QA: independent evidence evaluator within existing process; client owner: formally designated by CIU; PSAC/CBSA/provider authority: their authorized representatives. Identify coverage, substitutes and support capacity before offering commitments.

## External message
Union Eyes is a platform designed for Canadian union representation and institutional operations. We would begin with your current workflows and systems, agree data authority and scope, and demonstrate a controlled approach to migration and integration. Implementation and production commitments depend on mutually approved requirements and verified release evidence.
