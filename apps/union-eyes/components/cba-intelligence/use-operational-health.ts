import { useQuery } from "@tanstack/react-query";
import type { CbaIntelOperationalHealth } from "@/lib/services/cba-intelligence/health-service";
import { apiErrorMessage, envelopeData } from "@/lib/client/api-envelope";

/**
 * The operational snapshot of the CBA intelligence pipeline, for every screen that shows a part of it: one query, one cache entry. A refusal (an
 * entitlement the organization lacks, a role below steward) is the query's error, never a body a screen reads as if it were the snapshot.
 */
export function useOperationalHealth() {
  return useQuery<CbaIntelOperationalHealth>({
    queryKey: ["cba-intel-operational-health"],
    refetchInterval: 60_000,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/cba-intelligence/health");
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(body, "Failed to load health snapshot."));
      const health: CbaIntelOperationalHealth = envelopeData(body) as unknown as CbaIntelOperationalHealth;
      return health;
    },
  });
}
