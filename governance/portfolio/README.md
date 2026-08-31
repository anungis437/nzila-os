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

Every other catalog entry — including other `tier: 1` / `sell-now`-labelled
products such as CourtLens and Flow — is portfolio inventory or a hold, not
part of the current commercial spine. If a document elsewhere in this repo
implies otherwise, this file is the tie-breaker.

Dollar and revenue fields in `product-catalog.json` are estimated/forecast
figures, not audited actuals; customers-under-contract for most entries is
zero. Treat every commercial figure in this catalog as an estimate unless a
specific evidence artifact under `reports/` says otherwise for that product.

This pass did not regenerate or edit any commercial field in
`product-catalog.json` — see `docs/_alignment/DIFF_NOTES.md` on the
`docs/ue-alignment-20260831` branch.
