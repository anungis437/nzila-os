import {
  cognitionRegistry,
  COGNITION_DOMAINS,
  INSTITUTIONAL_CONCEPTS,
  INSTITUTIONAL_ONTOLOGY_VERSION,
  COGNITION_CONTRACT_VERSION,
} from '@nzila/organizational-cognition-core';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

/**
 * Cognition runtime health endpoint.
 *
 * Reports kernel + registry posture in a deterministic, organizationally-
 * scoped way. Suitable for ACA liveness probes, ops dashboards, procurement
 * review surfaces. Returns 200 even on degraded posture — degradation is
 * communicated via the `status` field, not the HTTP code, so pages can render.
 */
export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
  },
  async () => {
    const engines = cognitionRegistry.all();
    const enginesByDomain: Record<string, number> = {};
    for (const eng of engines) {
      for (const dom of eng.domains) {
        enginesByDomain[dom] = (enginesByDomain[dom] ?? 0) + 1;
      }
    }

    // Deterministic health rules:
    //   - degraded if any canonical domain has 0 registered engines
    //   - ok otherwise
    const missingDomains = (COGNITION_DOMAINS as readonly string[]).filter(
      (d) => !enginesByDomain[d],
    );
    const status: 'ok' | 'degraded' = missingDomains.length === 0 ? 'ok' : 'degraded';

    return {
      data: {
        status,
        ontologyVersion: INSTITUTIONAL_ONTOLOGY_VERSION,
        contractVersion: COGNITION_CONTRACT_VERSION,
        domainCount: COGNITION_DOMAINS.length,
        conceptCount: INSTITUTIONAL_CONCEPTS.length,
        engineCount: engines.length,
        enginesByDomain,
        missingDomains,
        checkedAt: new Date().toISOString(),
      },
    };
  },
);
