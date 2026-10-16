# Organic International and Equivalency Extension

**Status:** compatibility note only. No international connector or equivalency
mapping is implemented.

Keep shared evidence primitives jurisdiction-neutral. Use institution IDs,
scheme/program identifiers, source roles, standards references, observed
facts, provenance edges, and recipient dispositions rather than embedding
Canada-only assumptions in generic types.

Future evidence classes may need to reference:

- USDA National Organic Program (NOP);
- Canada-US organic equivalency;
- the EU organic regime;
- import/export certificates;
- transaction certificates;
- certificates of inspection.

These regimes can use different terms, authorities, scopes, statuses, and
document semantics. Equivalency is a separate sourced relationship, not a
status conversion. Do not normalize across schemes or infer equivalence without
the relevant current authority and versioned mapping.

No international source is registered, queried, or connected by this note.
