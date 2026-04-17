# Nzila OS Portfolio Matrix (Canonical)

Last reviewed: 2026-04-17
Canonical source: ../../governance/portfolio/product-catalog.json

## Segmentation

### SELL NOW
- union-eyes
- flow

### USE INTERNALLY
- console
- control-plane
- web (commercial front door, non-product SKU)

### INCUBATE
- cfo
- partners
- zonga
- agrimo
- trade
- cora
- nacp-exams
- mobility
- abr

### ARCHIVE / CUT PRIORITY
- mobility-client-portal
- platform-admin
- orchestrator-api

## Product Truth Table

| Product | Tier | Deployment | Readiness | Proof Status | Focus Classification | Score (/10) |
|---|---|---|---|---|---|---:|
| union-eyes | PRODUCTION | pilot | pilot-safe | pilot-proof | DOUBLE DOWN | 8.6 |
| flow | PRODUCTION | pilot | pilot-safe | internal-proof | DOUBLE DOWN | 7.9 |
| cfo | PILOT | pilot | pilot-safe | internal-proof | MAINTAIN | 7.2 |
| partners | PILOT | pilot | pilot-safe | no-proof | MAINTAIN | 6.8 |
| web | PRODUCTION | pilot | pilot-safe | internal-proof | MAINTAIN | 7.0 |
| console | PRODUCTION | internal | internal-only | internal-proof | INTERNAL ONLY | 8.2 |
| control-plane | PILOT | internal | internal-only | internal-proof | INTERNAL ONLY | 7.4 |
| zonga | INCUBATING | internal | internal-only | no-proof | HOLD | 5.8 |
| agrimo | INCUBATING | internal | internal-only | no-proof | HOLD | 5.3 |
| trade | INCUBATING | internal | internal-only | no-proof | HOLD | 5.1 |
| cora | INCUBATING | internal | internal-only | no-proof | HOLD | 4.9 |
| nacp-exams | INCUBATING | internal | internal-only | no-proof | HOLD | 5.0 |
| mobility | INCUBATING | internal | internal-only | no-proof | HOLD | 5.0 |
| abr | EXPERIMENTAL | internal | internal-only | no-proof | HOLD | 4.4 |
| mobility-client-portal | EXPERIMENTAL | internal | internal-only | no-proof | CUT | 3.8 |
| platform-admin | EXPERIMENTAL | internal | internal-only | no-proof | CUT | 3.5 |
| orchestrator-api | EXPERIMENTAL | scaffold | scaffold-only | no-proof | CUT | 3.2 |

## Notes

- Product tier authority: `packages/platform-contracts/src/registry.ts`
- Deployment/readiness authority: `../../nzila-truth-manifest.json`
- Proof authority: `../proof-center/portfolio-proof-index.md`
- Final score authority: `../../reports/final-repo-scorecard.md`

## Canonical Tier Matrix (Validator Surface)

| App | Surface | Exposure | Deployment State | Registry Tier | Notes |
|---|---|---|---|---|---|
| **union-eyes** | Revenue product | public | pilot | PRODUCTION | SELL NOW |
| **flow** | Revenue product | public | pilot | PRODUCTION | SELL NOW |
| **console** | Internal control surface | internal | internal | PRODUCTION | INTERNAL ONLY |
| **web** | Commercial front door | public | pilot | PRODUCTION | Platform surface |
| **control-plane** | Platform orchestration | internal | internal | PILOT | INTERNAL ONLY |
| **partners** | Partner workflows | public | pilot | PILOT | BUILD NEXT |
| **cfo** | Finance workflows | public | pilot | PILOT | BUILD NEXT |
| **zonga** | Venture app | internal | internal | INCUBATING | HOLD |
| **agrimo** | Venture app | internal | internal | INCUBATING | HOLD |
| **trade** | Venture app | internal | internal | INCUBATING | HOLD |
| **cora** | Venture app | internal | internal | INCUBATING | HOLD |
| **nacp-exams** | Venture app | internal | internal | INCUBATING | HOLD |
| **mobility** | Venture app | internal | internal | INCUBATING | HOLD |
| **mobility-client-portal** | Legacy surface | internal | internal | EXPERIMENTAL | CUT PRIORITY |
| **abr** | Venture app | internal | internal | EXPERIMENTAL | HOLD |
| **platform-admin** | Legacy admin surface | internal | internal | EXPERIMENTAL | CUT PRIORITY |
| **orchestrator-api** | Legacy orchestrator surface | internal | scaffold | EXPERIMENTAL | CUT PRIORITY |
