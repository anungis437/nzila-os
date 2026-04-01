/**
 * CBA Intelligence Domain
 *
 * Public Canadian CBA intelligence schemas: source registry,
 * ingestion pipeline, document processing, extraction, review workflow,
 * benchmark snapshots, and freshness tracking.
 *
 * Priority: 3.5 (extends agreements domain for public intelligence layer)
 *
 * Depends on: agreements (collectiveAgreements, cbaClause)
 */

export * from "./source-registry";
export * from "./ingestion";
export * from "./documents";
export * from "./extraction";
export * from "./review";
export * from "./benchmarks";
export * from "./freshness";
