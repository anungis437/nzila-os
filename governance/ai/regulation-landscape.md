# AI Regulation Landscape & Readiness

**Doc ID:** AI-REG-2026-001
**Version:** 1.0
**Owner:** Legal + AI Governance Committee
**Cadence:** quarterly review; ad-hoc on new enactment

> Not legal advice. Always consult counsel for binding interpretation.

## 1. Jurisdictions in scope for Nzila

Primary: **Canada (federal + provincial)**, **United States (federal + key states)**.
Forward-looking: **EU/EEA**, **UK** — Nzila has no current operations there
but adopts EU/UK frameworks where they raise the bar.

## 2. Summary table

| Jurisdiction | Instrument | Status (Apr 2026) | Applicability to Nzila | Top obligation |
|-------------|-----------|-------------------|------------------------|----------------|
| EU | **EU AI Act** (Reg. 2024/1689) | Phased in force; Art. 5 prohibitions live; GPAI obligations live; high-risk obligations apply 2026-08-02 | If we offer AI to EU users | Risk classification + conformity for high-risk; transparency for limited; GPAI documentation |
| EU | GDPR Art. 22 + EDPB AI guidance | In force | Active (we have EU-tier data flows) | Human-in-the-loop, right to explanation |
| UK | UK AI white paper / sector regulators | Pro-innovation; sector-led | Forward-looking | Per-sector regulator alignment (ICO, FCA) |
| Canada | **AIDA** (Bill C-27 Part 3) | Pending; Voluntary Code of Conduct adopted 2023 | YES — Canadian operations | Voluntary code: accountability, safety, fairness, transparency, human oversight, validity, robustness |
| Canada | **PIPEDA / OPC AI Proposals** | OPC guidance current | YES | Algorithmic traceability (Proposal 9), purpose specification |
| Canada | **Quebec Law 25** | In force | YES (members in Quebec) | Notification of automated decisions, right to explanation |
| Canada | **OSFI E-23 model risk** | In force for FRFIs | If we serve regulated FIs (cfo, partners) | Model risk management lifecycle |
| US Federal | **EO 14110** + agency rules | In force; subject to political change | Limited federal effect | NIST AI RMF best-practice baseline |
| US-CO | **Colorado AI Act** (SB24-205) | Effective 2026-02-01 | If algorithmic decisions affect Colorado consumers | Reasonable care; impact assessment; consumer disclosure |
| US-NYC | NYC Local Law 144 (AEDT) | In force | If hiring tools used for NYC roles | Bias audit + notice |
| US-CA | CCPA/CPRA + CPPA ADMT regs | Regs in progress | YES (California users) | Pre-use notice; opt-out of automated decision-making |
| US-IL/TX | BIPA / CUBI | In force | If biometric processing of residents | Consent + retention limits |
| Sectoral US | HIPAA (PHI) | In force | Where union-eyes touches PHI | Min-necessary; BAA; security rule |
| International | Council of Europe AI Convention 2024 | Signed | Forward-looking | Rights-based AI obligations |
| Standards | NIST AI RMF 1.0 | Voluntary | Adopted as baseline | Govern · Map · Measure · Manage |
| Standards | ISO/IEC 42001:2023 | Voluntary, certifiable | Aspirational | AI management system |
| Standards | ISO/IEC 23894 | Voluntary | Reference | AI risk guidance |

## 3. Nzila readiness posture (April 2026)

| Obligation area | Current | Gap | Action |
|----------------|---------|-----|--------|
| Risk classification of AI surfaces | Partial | Some surfaces unclassified | [risk-classification.md](risk-classification.md) §3 — complete pending entries |
| Per-surface PIA / DPIA | 3 of ~6 drafted | Console Extract/Actions/Embed missing | Run PIA template per surface |
| Reasoning context envelope (algorithmic traceability) | Contract exists in repo memory | Not enforced via contract test on every surface | Add CI gate |
| Pre-use disclosure to users | Missing on some surfaces | Privacy notice published as draft (`../privacy/public/privacy-notice.md`) | Wire into product UI |
| Human-in-the-loop for material decisions | Cultural / by convention | Not enforced via code | Add review-gate pattern in console actions |
| Bias evaluations | None systematic | No bias eval suite | Build evals per surface in [assurance-program.md](assurance-program.md) |
| Incident playbook (AI-specific) | Generic only | Need AI track | See [assurance-program.md](assurance-program.md) §5 |
| Vendor DPA + zero-retention | Microsoft DPA covers Azure OpenAI | Document confirmation per surface | Confirm in each PIA |
| Cross-border safeguards (CA → US) | Whisper crosses to East US 2 | Notice & SCC needed where required | [zonga-voice](../privacy/ai-pia/surfaces/zonga-voice.md) R1 |
| Conformity assessment for High-risk | Not yet exercised | Required if any Tier-1 surface goes live | Build conformity dossier template before first Tier-1 launch |
| Model registry & versioning | Per-surface | No central registry | [inventory.md](inventory.md) — extend |

## 4. Forthcoming changes to track

- EU AI Act high-risk obligations and penalties — fully applicable 2026-08-02
- AIDA progression in Parliament — assess on Royal Assent
- CPPA California ADMT regulations — finalization expected 2026
- US state-level AI bills — monitor (NY, NJ, CT, IL, WA)
- ISO/IEC 42005 (AI impact assessment) — finalization

## 5. Process

- Legal monitors regulatory feeds; quarterly briefing to AIGC
- Material change → emergency AIGC session within 30 days
- Each new regulation triggers a gap analysis appended to this doc
