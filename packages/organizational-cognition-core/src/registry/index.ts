/**
 * Cognition Registry
 *
 * Central registry of cognition engines and their declared capabilities.
 * The orchestrator uses this to discover engines without hard-coupling.
 */

import type { CognitionDomain } from '../ontology/index';

export interface CognitionEngineDescriptor {
  /** Stable engine id, e.g. "systems-dynamics". */
  id: string;
  /** Engine semantic version. */
  version: string;
  /** Cognition domain(s) this engine operates in. */
  domains: CognitionDomain[];
  /** Human-readable description. */
  description: string;
  /** Whether the engine is read-only (most are). */
  readonly: boolean;
  /** Whether the engine emits explainability envelopes (must be true for v1). */
  emitsExplainability: true;
  /** Contract version emitted. */
  contractVersion: string;
}

class CognitionRegistry {
  private readonly engines = new Map<string, CognitionEngineDescriptor>();

  register(descriptor: CognitionEngineDescriptor): void {
    if (!descriptor.emitsExplainability) {
      throw new Error(
        `Engine "${descriptor.id}" must emit InstitutionalExplainabilityEnvelope to register.`,
      );
    }
    this.engines.set(descriptor.id, descriptor);
  }

  get(id: string): CognitionEngineDescriptor | undefined {
    return this.engines.get(id);
  }

  byDomain(domain: CognitionDomain): CognitionEngineDescriptor[] {
    return Array.from(this.engines.values()).filter((e) => e.domains.includes(domain));
  }

  all(): CognitionEngineDescriptor[] {
    return Array.from(this.engines.values());
  }

  clear(): void {
    this.engines.clear();
  }
}

export const cognitionRegistry = new CognitionRegistry();
export type { CognitionRegistry };
