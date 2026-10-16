# Phase 1A.2b2-R2N — canonical effect normalization

**R2N gate: FAIL. Phase 1A.2b2 source census: SOURCE_CEILING.** This census adds the bounded R2E adjudication of accepted b2/R1/R2/R2N evidence; no new source tracing, product changes, runtime runs, or readiness claims were made.

## Required enum validation

| Check                                               |                       Result |
| --------------------------------------------------- | ---------------------------: |
| Total effect chains                                 |                          394 |
| Server-target enum violations                       |                            0 |
| Primary data-effect enum violations                 |                            0 |
| Secondary data-effect enum violations               |                            0 |
| Request/response enum violations                    |                            0 |
| Control-observation enum violations                 |                            0 |
| Server-target arithmetic                            |                          394 |
| Primary data-effect arithmetic                      |                          394 |
| Unknown server targets                              |                            0 |
| Primary unknown data effects                        |                          245 |
| Secondary unknown data-effect entries               |                            2 |
| Unknown data-effect entries (primary and secondary) |                          247 |
| B1 carry-forward                                    | 40 (23 trace + 17 no-caller) |

R2E adjudicated 254 existing unknown-effect chains: 7 were resolved from accepted evidence and 247 remain at the static evidence ceiling. See [the R2E backfill report](./PHASE_1A_2B2_R2E_EXISTING_EVIDENCE_BACKFILL.md).

The schema checks pass only when enum violations are zero. Unresolved classifications remain UNKNOWN_DATA_EFFECT; the R2N gate remains FAIL and the source census is SOURCE_CEILING.

Regenerate the R2E and R2N JSON and Markdown, then run enum and gate validation with `node scripts/ue/normalize-effect-census.mjs`. The artifacts are written before a nonzero process status is returned for an R2N `FAIL` gate.

## Server-target arithmetic

| Canonical server target     |  Chains |
| --------------------------- | ------: |
| `LOCAL_NEXT_ROUTE`          |     343 |
| `SERVER_ACTION`             |       3 |
| `EXPLICIT_EXTERNAL_BACKEND` |       0 |
| `EXPLICIT_PROXY_OR_REWRITE` |       0 |
| `EXTERNAL_PROVIDER_DIRECT`  |       2 |
| `MISSING_ROUTE_CANDIDATE`   |      46 |
| `UNKNOWN_SERVER_TARGET`     |       0 |
| **SUM**                     | **394** |

## Primary data-effect arithmetic

| Canonical primary effect  |  Chains |
| ------------------------- | ------: |
| `DATABASE_INSERT`         |      19 |
| `DATABASE_UPDATE`         |      10 |
| `DATABASE_DELETE`         |       0 |
| `DATABASE_READ`           |      29 |
| `DATABASE_TRANSACTION`    |       0 |
| `EXTERNAL_PROVIDER_WRITE` |       7 |
| `EXTERNAL_PROVIDER_READ`  |       1 |
| `OBJECT_STORAGE_WRITE`    |       4 |
| `OBJECT_STORAGE_READ`     |       0 |
| `QUEUE_OR_JOB_ENQUEUE`    |       0 |
| `EMAIL_SEND`              |       0 |
| `SMS_SEND`                |       0 |
| `EXPORT_GENERATION`       |       0 |
| `NO_PERSISTENT_EFFECT`    |      14 |
| `STUB_OR_MOCK_EFFECT`     |       5 |
| `MISSING_IMPLEMENTATION`  |      60 |
| `UNKNOWN_DATA_EFFECT`     |     245 |
| **SUM**                   | **394** |

## Known source-defect inventory

| Finding                     | Chains | Unique roots |
| --------------------------- | -----: | -----------: |
| Missing route candidates    |     46 |            4 |
| Method mismatch             |     14 |            9 |
| Missing implementation      |     60 |           13 |
| Stub/mock effect            |      5 |            3 |
| False-success source chains |      5 |            3 |

## Phase 1B source-observation inventory

| Control not observed in accepted bounded evidence | Chains |
| ------------------------------------------------- | -----: |
| Auth check                                        |    273 |
| Role check                                        |    334 |
| Organization resolution                           |    279 |
| Resource permission check                         |    334 |
| Audit write                                       |    285 |

These values are source-observation counts only; they are not vulnerability or correctness conclusions.

## Exact unresolved classifications

Unknown server-target chains (0):

- none

Unknown data-effect chains (247); 238 are only granularly unresolved in R1, and 9 remain ambiguous in R2:

- UE-B2-CHAIN-0009, UE-B2-CHAIN-0012, UE-B2-CHAIN-0014, UE-B2-CHAIN-0015, UE-B2-CHAIN-0016, UE-B2-CHAIN-0017, UE-B2-CHAIN-0022, UE-B2-CHAIN-0023
- UE-B2-CHAIN-0024, UE-B2-CHAIN-0025, UE-B2-CHAIN-0026, UE-B2-CHAIN-0027, UE-B2-CHAIN-0028, UE-B2-CHAIN-0030, UE-B2-CHAIN-0031, UE-B2-CHAIN-0032
- UE-B2-CHAIN-0033, UE-B2-CHAIN-0034, UE-B2-CHAIN-0035, UE-B2-CHAIN-0036, UE-B2-CHAIN-0039, UE-B2-CHAIN-0040, UE-B2-CHAIN-0041, UE-B2-CHAIN-0042
- UE-B2-CHAIN-0045, UE-B2-CHAIN-0046, UE-B2-CHAIN-0047, UE-B2-CHAIN-0048, UE-B2-CHAIN-0051, UE-B2-CHAIN-0052, UE-B2-CHAIN-0053, UE-B2-CHAIN-0054
- UE-B2-CHAIN-0057, UE-B2-CHAIN-0058, UE-B2-CHAIN-0061, UE-B2-CHAIN-0062, UE-B2-CHAIN-0063, UE-B2-CHAIN-0064, UE-B2-CHAIN-0065, UE-B2-CHAIN-0066
- UE-B2-CHAIN-0068, UE-B2-CHAIN-0069, UE-B2-CHAIN-0070, UE-B2-CHAIN-0072, UE-B2-CHAIN-0073, UE-B2-CHAIN-0076, UE-B2-CHAIN-0078, UE-B2-CHAIN-0079
- UE-B2-CHAIN-0080, UE-B2-CHAIN-0081, UE-B2-CHAIN-0082, UE-B2-CHAIN-0083, UE-B2-CHAIN-0084, UE-B2-CHAIN-0085, UE-B2-CHAIN-0086, UE-B2-CHAIN-0089
- UE-B2-CHAIN-0090, UE-B2-CHAIN-0093, UE-B2-CHAIN-0094, UE-B2-CHAIN-0095, UE-B2-CHAIN-0096, UE-B2-CHAIN-0100, UE-B2-CHAIN-0101, UE-B2-CHAIN-0107
- UE-B2-CHAIN-0108, UE-B2-CHAIN-0109, UE-B2-CHAIN-0110, UE-B2-CHAIN-0111, UE-B2-CHAIN-0113, UE-B2-CHAIN-0114, UE-B2-CHAIN-0115, UE-B2-CHAIN-0116
- UE-B2-CHAIN-0117, UE-B2-CHAIN-0118, UE-B2-CHAIN-0119, UE-B2-CHAIN-0120, UE-B2-CHAIN-0121, UE-B2-CHAIN-0123, UE-B2-CHAIN-0124, UE-B2-CHAIN-0125
- UE-B2-CHAIN-0126, UE-B2-CHAIN-0127, UE-B2-CHAIN-0128, UE-B2-CHAIN-0129, UE-B2-CHAIN-0130, UE-B2-CHAIN-0131, UE-B2-CHAIN-0132, UE-B2-CHAIN-0133
- UE-B2-CHAIN-0134, UE-B2-CHAIN-0135, UE-B2-CHAIN-0136, UE-B2-CHAIN-0137, UE-B2-CHAIN-0138, UE-B2-CHAIN-0139, UE-B2-CHAIN-0140, UE-B2-CHAIN-0142
- UE-B2-CHAIN-0143, UE-B2-CHAIN-0144, UE-B2-CHAIN-0145, UE-B2-CHAIN-0146, UE-B2-CHAIN-0163, UE-B2-CHAIN-0168, UE-B2-CHAIN-0169, UE-B2-CHAIN-0170
- UE-B2-CHAIN-0171, UE-B2-CHAIN-0172, UE-B2-CHAIN-0173, UE-B2-CHAIN-0174, UE-B2-CHAIN-0175, UE-B2-CHAIN-0176, UE-B2-CHAIN-0177, UE-B2-CHAIN-0182
- UE-B2-CHAIN-0186, UE-B2-CHAIN-0187, UE-B2-CHAIN-0188, UE-B2-CHAIN-0189, UE-B2-CHAIN-0190, UE-B2-CHAIN-0192, UE-B2-CHAIN-0193, UE-B2-CHAIN-0195
- UE-B2-CHAIN-0196, UE-B2-CHAIN-0197, UE-B2-CHAIN-0198, UE-B2-CHAIN-0201, UE-B2-CHAIN-0202, UE-B2-CHAIN-0203, UE-B2-CHAIN-0204, UE-B2-CHAIN-0205
- UE-B2-CHAIN-0206, UE-B2-CHAIN-0207, UE-B2-CHAIN-0208, UE-B2-CHAIN-0209, UE-B2-CHAIN-0210, UE-B2-CHAIN-0213, UE-B2-CHAIN-0215, UE-B2-CHAIN-0220
- UE-B2-CHAIN-0221, UE-B2-CHAIN-0222, UE-B2-CHAIN-0224, UE-B2-CHAIN-0227, UE-B2-CHAIN-0228, UE-B2-CHAIN-0229, UE-B2-CHAIN-0230, UE-B2-CHAIN-0231
- UE-B2-CHAIN-0232, UE-B2-CHAIN-0233, UE-B2-CHAIN-0234, UE-B2-CHAIN-0235, UE-B2-CHAIN-0236, UE-B2-CHAIN-0239, UE-B2-CHAIN-0241, UE-B2-CHAIN-0246
- UE-B2-CHAIN-0247, UE-B2-CHAIN-0248, UE-B2-CHAIN-0254, UE-B2-CHAIN-0258, UE-B2-CHAIN-0259, UE-B2-CHAIN-0260, UE-B2-CHAIN-0261, UE-B2-CHAIN-0262
- UE-B2-CHAIN-0263, UE-B2-CHAIN-0264, UE-B2-CHAIN-0266, UE-B2-CHAIN-0267, UE-B2-CHAIN-0269, UE-B2-CHAIN-0272, UE-B2-CHAIN-0273, UE-B2-CHAIN-0274
- UE-B2-CHAIN-0275, UE-B2-CHAIN-0276, UE-B2-CHAIN-0277, UE-B2-CHAIN-0278, UE-B2-CHAIN-0279, UE-B2-CHAIN-0280, UE-B2-CHAIN-0281, UE-B2-CHAIN-0282
- UE-B2-CHAIN-0283, UE-B2-CHAIN-0284, UE-B2-CHAIN-0285, UE-B2-CHAIN-0286, UE-B2-CHAIN-0287, UE-B2-CHAIN-0288, UE-B2-CHAIN-0289, UE-B2-CHAIN-0291
- UE-B2-CHAIN-0292, UE-B2-CHAIN-0293, UE-B2-CHAIN-0296, UE-B2-CHAIN-0299, UE-B2-CHAIN-0300, UE-B2-CHAIN-0301, UE-B2-CHAIN-0302, UE-B2-CHAIN-0303
- UE-B2-CHAIN-0304, UE-B2-CHAIN-0305, UE-B2-CHAIN-0306, UE-B2-CHAIN-0307, UE-B2-CHAIN-0308, UE-B2-CHAIN-0309, UE-B2-CHAIN-0310, UE-B2-CHAIN-0311
- UE-B2-CHAIN-0312, UE-B2-CHAIN-0313, UE-B2-CHAIN-0314, UE-B2-CHAIN-0315, UE-B2-CHAIN-0316, UE-B2-CHAIN-0317, UE-B2-CHAIN-0318, UE-B2-CHAIN-0320
- UE-B2-CHAIN-0321, UE-B2-CHAIN-0322, UE-B2-CHAIN-0323, UE-B2-CHAIN-0324, UE-B2-CHAIN-0327, UE-B2-CHAIN-0328, UE-B2-CHAIN-0329, UE-B2-CHAIN-0330
- UE-B2-CHAIN-0331, UE-B2-CHAIN-0332, UE-B2-CHAIN-0335, UE-B2-CHAIN-0337, UE-B2-CHAIN-0338, UE-B2-CHAIN-0339, UE-B2-CHAIN-0340, UE-B2-CHAIN-0341
- UE-B2-CHAIN-0344, UE-B2-CHAIN-0346, UE-B2-CHAIN-0355, UE-B2-CHAIN-0359, UE-B2-CHAIN-0360, UE-B2-CHAIN-0361, UE-B2-CHAIN-0362, UE-B2-CHAIN-0363
- UE-B2-CHAIN-0366, UE-B2-CHAIN-0367, UE-B2-CHAIN-0368, UE-B2-CHAIN-0369, UE-B2-CHAIN-0372, UE-B2-CHAIN-0373, UE-B2-CHAIN-0374, UE-B2-CHAIN-0375
- UE-B2-CHAIN-0376, UE-B2-CHAIN-0378, UE-B2-CHAIN-0379, UE-B2-CHAIN-0381, UE-B2-CHAIN-0382, UE-B2-CHAIN-0392, UE-B2-CHAIN-0393

## Preserved boundary

- R1 source work and the accepted 394-chain denominator are preserved.
- R2 source dispositions and the unchanged 40-item b1 ceiling are preserved.
- Persistence, authorization, organization scope, audit, and runtime behavior remain unproven.
- Phase 1A.2 final is not yet proven; Phase 1B remains unauthorized; product readiness is NO.

The complete row-level census is in [the R2N JSON record](./PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.json).
