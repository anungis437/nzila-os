# IIA Heatmap Visualization Spec

## Purpose
Provide a consistent visual representation of IIA dimension scores, fragility concentration, and urgency for executive decision-making.

## Input Data
Required fields:
1. Six dimension scores (0-4)
2. Consequence rating per dimension (High/Medium/Low)
3. Urgency rating per dimension (High/Medium/Low)
4. Composite score (0-24)

## Heatmap Layout
- X-axis: IIA dimensions (6 columns)
- Y-axis: three rows
  - Score row
  - Consequence row
  - Urgency row

Dimension order:
1. Memory Integrity
2. Continuity Capacity
3. Governance Maturity
4. Trust Operations
5. Accountability Architecture
6. Institutional Resilience

## Color Rules
### Score row (0-4)
- 0-1: Red (#C73E1D)
- 2: Amber (#D98E04)
- 3: Yellow-Green (#9AAE04)
- 4: Green (#2E7D32)

### Consequence and Urgency rows
- High: Red (#C73E1D)
- Medium: Amber (#D98E04)
- Low: Green (#2E7D32)

## Labels
Each cell must include:
- Numeric score or risk label
- Short tooltip text when rendered digitally

## Executive Caption Template
"IIA heatmap shows concentrated fragility in [dimension names]. These areas carry [consequence level] consequence and [urgency level] urgency and should drive the first 90-day actions."

## Interpretation Rules
1. Any dimension score <= 1 is immediate intervention priority.
2. Any dimension score 2 with high consequence is top-three priority candidate.
3. Two or more adjacent low-scoring dimensions indicates system-level architecture gap.
4. High Trust Operations score with low Governance Maturity should be flagged as potential optics-performance mismatch.

## Recommended Views
1. Current-state heatmap (single engagement)
2. Trend heatmap (baseline vs reassessment)
3. Cohort view (anonymized benchmark quartiles, when available)

## Accessibility
- Include text alternatives for all color-coded states.
- Avoid red/green-only distinction; include labels and patterns in exported visuals.
