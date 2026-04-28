# AI Privacy Impact Assessments (PIA)

This directory holds privacy impact assessments for every AI-powered surface
in the Nzila OS portfolio. Methodology is derived from the Info-Tech
"Conduct an AI Privacy Risk Assessment" blueprint and aligned to:

- **GDPR** Art. 5 (data minimization), Art. 6 (lawful bases), Art. 22 (automated decision-making)
- **CCPA / CPRA**
- **PIPEDA** (and OPC AI Proposals — esp. #9 algorithmic traceability)
- **HIPAA** §164.312 (technical safeguards) where PHI may be present
- **NIST Privacy Framework 1.0**
- **ISO/IEC 27701:2019**
- **Cavoukian's 7 Privacy by Design principles**

## When a PIA is required

A PIA MUST be completed (and re-reviewed annually OR on material change) for:

1. Any new AI feature shipped to production users
2. Any change to model provider, model family, or model version
3. Any change to the categories of data sent to a model
4. Any change to the geography/region of model inference
5. Any new automated decision that materially affects a user

## Process

1. Copy [`template.md`](template.md) to `surfaces/<surface-name>.md`
2. Complete all 12 Info-Tech privacy domains
3. Score residual risk; mitigations MUST close any HIGH residual to MEDIUM or lower
4. Get sign-off from: Privacy Lead + Surface Owner + Security Lead
5. Link the PIA from the surface README and from the relevant entry in `governance/portfolio/`

## Inventory

| Surface | Owner | Status | PIA |
|---------|-------|--------|-----|
| Console RAG (`apps/console/ai/rag`) | Console Lead | DRAFT | [surfaces/console-rag.md](surfaces/console-rag.md) |
| Console Extract (`apps/console/ai/extract`) | Console Lead | TODO | _to create_ |
| Console Actions (`apps/console/ai/actions`) | Console Lead | TODO | _to create_ |
| Console Embed (`apps/console/ai/embed`) | Console Lead | TODO | _to create_ |
| Zonga Voice (Whisper) | Zonga Lead | DRAFT | [surfaces/zonga-voice.md](surfaces/zonga-voice.md) |
| Union-Eyes Cognition | UE Lead | DRAFT | [surfaces/union-eyes-cognition.md](surfaces/union-eyes-cognition.md) |

## Reference

- Info-Tech blueprint and PIA tools: see `infotech/` (gitignored, internal reference only)
- Reasoning context envelope contract (algorithmic traceability): see `/memories/repo/reasoning-context-envelope-contract.md`
