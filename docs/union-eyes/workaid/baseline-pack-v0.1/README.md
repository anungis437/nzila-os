# WorkAid × Union Eyes — Preparation Pack v0.1

**Prepared:** 23 October 2026  
**Mode:** Parallel design, requirements and adversarial test preparation; no staging changes  
**Status:** Design in progress; adversarial R1 and R2 **FAIL for release**; suitable for further design iteration  
**Reference main SHA:** `38a824918cf2e7d7cfb7fcb0e796cbde45433be8`

## Contents

1. `WORKAID_PRODUCT_SPEC_v0.1.md` — canonical product/architecture candidate with workflows, actor model, lifecycle, access policy, acceptance and unresolved WorkAid process choices.
2. `WORKAID_ADVERSARIAL_REVIEW_R1.md` — twenty-two adversarial findings, fixes/negative proof, review roadmap and explicit R1 disposition.
3. `WORKAID_ADVERSARIAL_REVIEW_R2.md` — official-procedure challenge and nine additional issues discovered in a second independent review.
4. `WORKAID_VSCODE_AGENT_MISSION.md` — independently executable parallel preparation brief, with isolated worktree and release boundary.
5. `WORKAID_ACCEPTANCE_MATRIX.csv` — testable acceptance cases with expected behavior and failure proof.
6. `WORKAID_SYNTHETIC_SCENARIOS.json` — fake-only case records and scenario combinations for model and UI tests.
7. `MANIFEST.json` — produced-file sizes and hashes for integrity.

## Interpretation

- Do not treat the presence of a source function as an end-to-end product capability.
- The currently documented Union Eyes runtime still has `NO_GO` evidence; the product design is independent of that staging candidate's execution.
- WorkAid's 95% missing-referral claim and 4–6-week average are Domenic's observations and need empirical measurement before use in commercial claims.
- R1 `FAIL` is not a stop-work instruction: it identifies what must be challenged and proven as design progresses.

## Starting point for next adversarial round

Ask reviewer to *disprove* that each outbound WSIB action can be correctly mapped to one claim, decision/issue, authoritative form, actual receipt-check task and human-confirmed deadline. Reuse the negative cases in the acceptance matrix. Next, force test member/union access to every restricted surface including metadata and notification payloads.
