/**
 * @nzila/trustcore-core — Trust Operations v1 foundations.
 *
 * Pure, deterministic primitives that EXTEND (never replace) the existing
 * apps/trustcore compliance engine. Includes:
 *   - scoring/   Deterministic trust score with category caps + thresholds.
 *   - risks/     Risk register pure helpers (severity ordering, etc.).
 *   - tasks/     Task scheduling primitives (SLA + priority).
 *   - trust-engine/ Composition layer that wraps the apps engine output.
 */

export * from './scoring/index'
export * from './risks/index'
export * from './tasks/index'
export * from './trust-engine/index'
