// ---------------------------------------------------------------------------
// @nzila/ingestion-core  —  Pipeline registry
// ---------------------------------------------------------------------------

import type { PipelineDefinition } from './types';
import { validatePipeline } from './runner';

const registry = new Map<string, PipelineDefinition>();

function key(name: string, version: string): string {
  return `${name}@${version}`;
}

/**
 * Register a pipeline definition. Validates on registration (fail-fast).
 * @throws if the definition is structurally invalid.
 */
export function registerPipeline(definition: PipelineDefinition): void {
  const errors = validatePipeline(definition);
  if (errors.length > 0) {
    const msgs = errors.map((e) => `  ${e.field}: ${e.message}`).join('\n');
    throw new Error(
      `Invalid pipeline "${definition.name}":\n${msgs}`,
    );
  }
  registry.set(key(definition.name, definition.version), definition);
}

/**
 * Retrieve a registered pipeline by name and version.
 */
export function getPipeline(
  name: string,
  version: string,
): PipelineDefinition | undefined {
  return registry.get(key(name, version));
}

/**
 * List all registered pipeline keys.
 */
export function listPipelines(): ReadonlyArray<string> {
  return [...registry.keys()];
}

/**
 * Remove a pipeline from the registry.
 */
export function unregisterPipeline(name: string, version: string): boolean {
  return registry.delete(key(name, version));
}

/**
 * Clear all registered pipelines (for testing).
 */
export function clearPipelineRegistry(): void {
  registry.clear();
}
