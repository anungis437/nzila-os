# @nzila/ai-registry

Unified AI/ML model registry with NIST AI RMF risk classification, model cards, governance lifecycle, bias detection, and carbon tracking.

## Capabilities

| Area | Functions |
|------|-----------|
| **Model Cards** | `ModelCard` — structured model documentation and metadata |
| **Risk Classification** | `RiskClassification` — NIST AI RMF risk categorization |
| **Governance Lifecycle** | `GovernanceLifecycle` — model approval and retirement workflows |
| **NIST RMF** | `NistRmf` — AI Risk Management Framework compliance |
| **Bias Detection** | `BiasAssessment` — fairness metrics and bias evaluation |
| **Carbon Tracking** | `CarbonTracking` — compute footprint and sustainability metrics |

## Source Layout

```
src/
├── bias-detection.ts
├── carbon-tracking.ts
├── governance-lifecycle.ts
├── model-card.ts
├── nist-rmf.ts
├── risk-classification.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./model-card` — model card definitions
- `./risk-classification` — risk categorization
- `./governance-lifecycle` — lifecycle management
- `./nist-rmf` — NIST framework integration
- `./bias-detection` — bias assessment utilities
- `./carbon-tracking` — carbon footprint tracking
