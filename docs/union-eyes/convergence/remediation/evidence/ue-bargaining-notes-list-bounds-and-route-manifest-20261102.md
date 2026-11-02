# Union Eyes — bargaining-notes collection bounds and route manifest reconciliation (2026-11-02)

**Inspected source baseline:** `b11a68d023b4e69cf1703cea0194b9d183b5efc9`  
**Source and regression commits:** `223a81afb14d3bf5394b37db013e0e9dfa1109ba`, `322aa8d08430d261b57974f3adb1690c7058cd4f`, `6f70e5b6bce97bc1b53daea0a866b685e214b1ef`, `fe4f5f248180d5875e3bb81e89ddd13029b31ab0`, `017be439544a7cef537d4b5aa44fe907894b80a8`, `a379393423a6526fdae2ac85f53f2433c873bb55`.

## Baseline evidence

GitHub Actions whole-application job `125118310449` in run `41396315669` on exact baseline SHA reported **23,910 passing, 2 failing, 28 skipped** tests. Both failures were in `route-coverage-manifest.test.ts`: the generated manifest still called `bargaining-notes/route.ts` `AMBIENT_DB` after the route gained `withRLSContext`. The scanner's fresh result was `TENANT_TX`. The route count was 1,010 and the mutating data summary had drifted by exactly one (`AMBIENT_DB` 13 versus 12, `TENANT_TX` 183 versus 184). At that baseline the whole contract, native PostgreSQL 15/16, security, disposable HTTP/browser, App Floor Check, and governance workflows reported success. Those are **baseline-only** results.

## Corrections

The *generated, regenerable* route-coverage manifest was reconciled with the scanner's actual source classification, changing only the affected route and the two aggregate counts. This is not a claim that text scanning alone proves transaction/RLS safety. The source route's tenant transaction was inspected, and `db/db.ts` routes its proxy through the active tenant transaction; the underlying service uses that proxy. No frozen Gate 0 defect classification, 777-defect provenance or qualification artifact was rewritten.

The bargaining-notes collection GET previously silently coerced malformed `page` and `limit`, accepted arbitrarily large tag lists and invalid dates that could produce internal errors, and could treat reversed dates as empty results. The new pure query parser bounds pagination (1–100,000 pages, 1–100 rows), tags (20 entries, 64 characters each, 512 total), and sorting, checks real ISO calendar dates and timezone-qualified timestamps, and refuses reversed ranges. The route validates before agreement lookup and tenant queries and returns an explicit HTTP 400 for invalid list controls. Existing ordinary-list default 20 and tag-list default 50 are preserved. It does not change membership, role, confidentiality, CBA ownership or tenant authorization.

Adversarial Vitest tests were authored for normal defaults, leap-day dates, timezone-qualified timestamps, invalid dates, reversed ranges, malformed or oversized pagination, invalid sort options and oversized or empty tags. The existing manifest ratchet tests compare all 1,010 scanned routes and summary counts against generated evidence.

## Qualification boundary

**Source-level:** committed and inspectable. **Unit/contract:** new tests authored; no exact-final-SHA pass yet at record creation. **Native PostgreSQL 15/16:** pending exact-final-SHA results. **Real HTTP/browser:** pending exact-final-SHA results. **Staging and independent acceptance:** not established. A generated manifest match is not a runtime security proof.

**Defect credit: 0. CLOSED credit: 0.** The 777-defect programme, 150-item release-debt index, 111 capabilities, complete stakeholder journeys and Gate 0C.4 independent reviewer, owner-persona and institutional decisions remain outstanding. No merge or production promotion is authorized by this record.
