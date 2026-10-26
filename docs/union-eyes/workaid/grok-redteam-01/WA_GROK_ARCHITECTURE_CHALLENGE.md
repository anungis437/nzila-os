# WA-GROK Architecture Challenge — Clio Integration Options A / B / C

**Mission:** WA-GROK-REDTEAM-01 | **Date:** 2026-10-23 (America/Toronto)  
**Independent of sibling R3.** Recommendation must preserve **External Specialist Coordination** kernel and avoid embedding Ontario WSIB terms into unrelated UE grievance capabilities.

**Repo evidence caveat:** Local read-only clone `/workspace/proof-base` HEAD `34f441d3a8e350f97e546245ed26bceb916dc4d9`. Pack reference SHA `38a824918cf2e7d7cfb7fcb0e796cbde45433be8` **not in this clone** → any claim that “main at pack SHA proves X” is **UNVERIFIED** here; defer runtime attestation to sibling baseline.

Observed (this clone, paths cited):

- `apps/union-eyes/lib/deadline-engine/recipient-resolver.ts` — Phase A **grievance_deadlines only**; throws on `claim_deadlines`.
- `apps/union-eyes/app/api/cases/intake/route.ts` — CUPE vocabulary / `grievance_case_suite` entitlement; not WSIB intake.
- `apps/union-eyes/db/schema/representation-authority-schema.ts` — `representation_authorities`, `external_matter_access_grants`; matter types include `'grievance'`, `'wcb_claim'` (generic WCB label — **not** proof of Ontario WSIB specialization).
- `apps/union-eyes-demo/DEMO_SANDBOX_P0.md` — `DEMO_CONFIGURED`; `AUTH_START_WORKAID=NO`; no Clio connector.
- Deadline engine has retry/dead-letter/idempotent schedule patterns reusable as **primitives**, not as WSIB policy.

---

## Options compared

| Dimension | **A — Clio-led** | **B — Split responsibility** | **C — Deeper Clio integration** |
|---|---|---|---|
| **Summary** | Clio remains sole professional work queue; UE limited to union referral packet + optional status publication; receipt calls tracked only in Clio. | Clio = professional file SoR; UE owns **inter-institutional coordination** (referral completeness, member-safe status, receipt-follow-up tasks Domenic accepts) with deep links into Clio; **no automatic writeback**. | Bidirectional sync: matters, tasks, contacts, documents between Clio and UE; webhooks; possible medical binary sync later. |
| **Duplication** | Lowest record duplication; risk = retyping claim numbers into Clio and losing UE packet context. | Controlled duplication of **coordination metadata** only (claim ref, submission version, task ids); forbid dual OPEN receipt tasks via task-of-record flag. | Highest duplication & conflict surface (two masters for tasks/notes). |
| **Task ownership** | Clear: Clio only. UE must not invent competing reminders. | Explicit split: UE owns referral + receipt-follow-up (if accepted); Clio owns legal notes, medical pursuit, hearing prep. Written D-02 decision required. | Ambiguous unless heavy conflict protocol; R1-10 fails easily. |
| **Workload (Domenic)** | Familiar Clio UX; UE adds little daily value → weak product case. | Best chance to cut **context re-entry** for WSIB receipt calls without forcing full desk migration — **if** deep links and prefilled task context work. | Migration + reconciliation tax; likely net increase during pilot. |
| **Security / privacy** | Keeps medical/privileged in Clio; UE holds referral docs — still needs tenant isolation on UE side. | Same boundary + smaller sync blast radius; publication/release stays explicit. | Largest exfil/replay/org-spoof surface (R1-20); needs OAuth, HMAC, idempotency, field allow-lists — **not available as PROVEN**. |
| **Cost** | Lowest build cost; may fail commercial “why UE?” test. | Medium: task UX, grants, form typing, outbox — reuses reminder primitives. | Highest: connector, mapping, DR, support. |
| **Reliability** | Depends on Clio alone for follow-ups (known gap per Domenic narrative — **partner-reported**, not measured). | UE outbox can make receipt tasks durable **if** delivery observed; still no WSIB connector. | Coupled failure modes; partial sync = false confidence. |
| **Support** | Simple story: “use Clio.” | Two surfaces — needs runbook: which queue to check. | Hardest: sync incidents, field drift, credential rotation. |
| **Complexity** | Low engineering; high process friction remains. | Medium; matches SPEC §9 first pilot candidate. | High; violates “no live connector in v1” hardening from R1. |
| **Kernel purity** | Safe (almost no WSIB in UE). | Safe if WSIB rules live in **specialization config**, not grievance deadline resolver. | Risk of baking Clio+WSIB into shared kernel. |

---

## Recommendation

**Recommend Option B — Split responsibility** for the preparation / first pilot *design*, with the following hard constraints:

1. **Task-of-record:** Exactly one active receipt-follow-up owner system per `OutboundSubmission` version. Default proposal for validation with Domenic: **UE owns inter-institutional receipt-follow-up**; Clio remains SoR for professional notes and medical workflow. If Domenic rejects UE task UX, fall back to **A′**: Clio SoR + UE referral/status only (no UE reminders) — still preferred over C.  
2. **No automatic Clio writeback** until a separately proven IntegrationLedger (idempotency, conflict, replay age, per-tenant OAuth) exists — currently **PROPOSED / UNVERIFIED**.  
3. **Preserve External Specialist Coordination kernel:** referrals, grants, document classes, publication decisions, durable notification primitives — parameterized by specialist type.  
4. **Forbid** embedding Ontario WSIB form names, s.120 timers, or ITO grouping into `grievance_deadlines` / CUPE intake. WSIB uses a **WorkAid specialization pack** + human-confirmed `DeadlineObligation`.  
5. **Option C deferred** until after measured pilot of B/A′ and security verification of connector design — not “phase 1.5.”

### Evidence chain for B

- SPEC §9 already nominates split / Clio authoritative / no automatic writeback as preferred validation path.  
- R1-10 / WA-R4-10: dual-master is a CRITICAL operational failure mode.  
- Local deadline engine proves reusable **transport** patterns but explicitly **not** claim/WSIB recipient graphs.  
- Demo sandbox proves personas/grants ideas only (`DEMO_CONFIGURED`), not integration readiness.  
- Official procedure complexity (source register) argues for human attestation in UE checklists rather than sync-driven automation (C).

### Anti-recommendation for C (now)

Deeper integration multiplies wrong-claim linkage, privileged-note leakage, and false “filed/received” signals before basic receipt-state discipline and tenant isolation are proven. Cost and support load are unjustified while platform readiness remains separately NO_GO / UNVERIFIED.

### Anti-recommendation for pure A (as sole end-state)

Pure A minimizes engineering risk but fails the stated problem (Clio reminder/pop-up gaps; incomplete referrals; member visibility) unless UE still delivers referral completeness + member publication — which is already a weak form of B. Treat pure A as **contingency** if Domenic refuses a second task surface.

---

## Decision questions (not blanket approval)

See executive verdict draft for precisely worded Domenic/Angelo questions (D-02, D-07, tribunal form naming).
