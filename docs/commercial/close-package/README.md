# Union Eyes — Enterprise Close Package

> The package a serious buyer receives **after a successful first meeting**. Designed to convert a 45-minute demo into a signed pilot in ≤10 business days.

**Audience:** IT Directors · Procurement · Privacy Officers · Union Executives · COOs · Pilot Sponsors · Evaluation Committees

## Contents

| # | Document | Owner read | Length |
|---|---|---|---|
| 1 | [TRUST_VISUAL_PACK.md](./TRUST_VISUAL_PACK.md) | IT, Privacy, Procurement | 1-page summary + 5-slide appendix + screenshot plan |
| 2 | [UNION_EYES_BUYER_DECK.md](./UNION_EYES_BUYER_DECK.md) | Executive sponsor + board | 13 slides + speaker notes |
| 3 | [PROCUREMENT_CHECKLIST.md](./PROCUREMENT_CHECKLIST.md) | Procurement, Legal, IT, Operations, Finance | Frictionless checklist |
| 4 | [PILOT_ROI_CALCULATOR.md](./PILOT_ROI_CALCULATOR.md) | COO, Director of Operations | Editable model + CSV |
| 5 | [CASE_STUDY_TEMPLATE.md](./CASE_STUDY_TEMPLATE.md) | Marketing, future references | 4 reusable formats |
| 6 | [ENTERPRISE_CLOSE_SEQUENCE.md](./ENTERPRISE_CLOSE_SEQUENCE.md) | Account owner | Day 0 → Day 10 cadence |
| — | [pilot-roi-calculator.csv](./pilot-roi-calculator.csv) | Spreadsheet-ready ROI | 1 file |

## Source-of-truth pointers

Every claim in this package traces to:

- [`docs/commercial/trust-center/`](../trust-center/) — security posture
- [`docs/commercial/sales-kit/`](../sales-kit/) — demo + procurement Q&A
- [`docs/commercial/UNION_EYES_COGNITION_ROI.md`](../UNION_EYES_COGNITION_ROI.md) — KPI formulas
- [`docs/commercial/pricing-framework.md`](../pricing-framework.md) — pricing
- [`docs/commercial/pilot-offer-cupe.md`](../pilot-offer-cupe.md) — pilot terms
- [`docs/commercial/vendor-risk-pack/`](../vendor-risk-pack/) — DPA, subprocessors, IR

## Exporting the buyer deck to PPTX / PDF

The deck ([UNION_EYES_BUYER_DECK.md](./UNION_EYES_BUYER_DECK.md)) is authored in Markdown and exported to a branded PPTX via `python-pptx`.

**Quick export (PPTX only):**

```powershell
# From repo root — venv must exist (.venv/)
.\scripts\Export-BuyerDeck.ps1
# Output: demo-output/union-eyes-buyer-deck.pptx
```

**Export with PDF (requires LibreOffice or Microsoft Office):**

```powershell
.\scripts\Export-BuyerDeck.ps1 -Pdf
```

**Custom output path:**

```powershell
.\scripts\Export-BuyerDeck.ps1 -Out "C:\Presentations\union-eyes-Q2-2026.pptx" -Pdf
```

**If you don't have the repo venv:**

```powershell
pip install python-pptx
python scripts/export_buyer_deck.py --out demo-output/union-eyes-buyer-deck.pptx
```

**Install LibreOffice (free PDF conversion):**

```powershell
winget install TheDocumentFoundation.LibreOffice
```

Generated PPTX/PDF files are gitignored (`demo-output/` and `docs/commercial/**/*.pptx|.pdf`).

---

## Honest scope

This package describes only what is shipped today. Roadmap items (SOC 2 audit, WebAuthn, public SCIM) are explicitly disclosed where relevant.
