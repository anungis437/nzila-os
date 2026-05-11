# Institutional Ontology

Shared semantic vocabulary used by every cognition engine. **Engines must
use these names verbatim — no synonyms, no parallel taxonomies.**

## Cognition Domains (closed set, v1)

`governance`, `continuity`, `resilience`, `procedural_intelligence`,
`operational_trust`, `institutional_memory`, `coordination`, `adaptation`,
`precedent`, `systems_coherence`.

## Institutional Concepts

`governance_action`, `governance_review`, `continuity_plan`,
`continuity_assessment`, `mitigation_decision`, `risk_response`,
`resilience_baseline`, `precedent_record`, `procedural_artifact`,
`trust_signal`, `memory_capture`, `adaptation_event`, `coordination_session`.

## Maturity Ladder

`emergent → developing → mature → advanced` (use `maturityFromScore`).

## Trajectory Labels

`accelerating | steady | decelerating | volatile | stalled | insufficient_history`.

## Severity Ladder

`critical | high | moderate | low | informational`.

## Confidence Bands

`very_high | high | moderate | low | insufficient_data` (use
`confidenceBandFromScore`).

## Adding to the Ontology

The ontology is closed at v1. Additions require:

1. RFC explaining the gap and why existing terms cannot cover it.
2. Governance review (labor-safety implications).
3. Coordinated update across all engines using the new term.
