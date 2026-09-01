# Portfolio catalog — read this before quoting a number from here

`product-catalog.json` in this folder is a **portfolio inventory**: every
product Nzila has built or is incubating, with tier, GTM-posture, and
commercial-metric fields. It is not, by itself, the current go-to-market
plan, and a `tier: 1` / `gtm_posture: "sell-now"` entry does not mean that
product has an active sales motion this quarter.

**Commercial spine (as of the Aug 2026 condensed plan):** two lanes only —
Union Eyes (near-term revenue) and CIVIC (cautious public-institution path,
see [`../../docs/CIVIC_OCI_ALIGNMENT.md`](../../docs/CIVIC_OCI_ALIGNMENT.md)).
NzilaOS itself is internal acceleration IP, not sold directly. The offer for
the active lane is fixed-fee continuity (briefing → diagnostic → OCI/OCRA →
platform → implementation → retainer), not per-seat intake software.

Every other catalog entry — including CourtLens and Flow, now labelled `tier: 2` /
`gtm_posture: "hold"` in the catalog itself — is portfolio inventory or a hold, not
part of the current commercial spine. If a document elsewhere in this repo
implies otherwise, this file is the tie-breaker.

Dollar and revenue fields in `product-catalog.json` are estimated/forecast
figures, not audited actuals; customers-under-contract for most entries is
zero. Treat every commercial figure in this catalog as an estimate unless a
specific evidence artifact under `reports/` says otherwise for that product.

This pass did not regenerate or edit any commercial (dollar/revenue) field in
`product-catalog.json`. A follow-up hygiene pass (2026-08-31/09-01) added a
`civic` catalog entry (`tier: 2`, `gtm_posture: "hold"`, `revenue_status:
"pre-revenue"`, all dollar fields `0` — no revenue invented) so the catalog no
longer silently omits the second commercial lane, and demoted Flow and
CourtLens (`abr`) from `tier: 1` / `sell-now` to `tier: 2` / `hold` so the
catalog itself agrees with this file's tie-breaker instead of contradicting it.
