/**
 * Member Management console — org-scoped stats/members fetch lifecycle.
 *
 * Extracted from components/admin/members-console.tsx so this data-layer
 * truth contract can be unit-tested directly (renderHook) without pulling
 * in the console's full UI import graph.
 *
 * Truth contract: a failed fetch for the CURRENT scope (org id or "all")
 * must never leave a PREVIOUS scope's data rendered as if it belongs to the
 * current one. Monotonic per-fetch tokens guard against a slow, stale
 * response resolving after a newer scope change has already superseded it.
 */
import { useState, useEffect, useCallback, useRef } from "react";

export interface MembersConsoleOrganization {
  id: string;
  name: string;
}

export interface MembersConsoleMemberStats {
  total: number;
  active: number;
  stewards: number;
  officers: number;
}

export interface MembersConsoleMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  membership_number: string | null;
  created_at: string | null;
}

export interface MembersConsoleData {
  stats: MembersConsoleMemberStats | null;
  isLoadingStats: boolean;
  statsError: string | null;
  members: MembersConsoleMember[];
  isLoadingMembers: boolean;
  membersError: string | null;
}

export function useMembersConsoleData(
  selectedOrg: string,
  organizations: MembersConsoleOrganization[],
  isLoadingOrgs: boolean,
): MembersConsoleData {
  const [stats, setStats] = useState<MembersConsoleMemberStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [members, setMembers] = useState<MembersConsoleMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const statsRequestRef = useRef(0);
  const membersRequestRef = useRef(0);

  const fetchStats = useCallback(async () => {
    const requestId = ++statsRequestRef.current;
    setIsLoadingStats(true);
    setStatsError(null);
    // Invalidate immediately — a failure below must never leave the
    // PREVIOUS organization's stats rendered as if they belong to the
    // newly-selected organization.
    setStats(null);
    try {
      const url = selectedOrg === "all"
        ? '/api/admin/members/stats'
        : `/api/admin/members/stats?organizationId=${selectedOrg}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load member statistics (${response.status})`);
      }
      const data = await response.json();
      if (statsRequestRef.current !== requestId) return; // superseded by a newer org selection
      setStats(data);
    } catch (error) {
      if (statsRequestRef.current !== requestId) return;
      setStatsError(error instanceof Error ? error.message : 'Failed to load member statistics');
    } finally {
      if (statsRequestRef.current === requestId) setIsLoadingStats(false);
    }
  }, [selectedOrg]);

  const fetchMembers = useCallback(async () => {
    const requestId = ++membersRequestRef.current;
    setMembersError(null);
    // Invalidate immediately — a failure below must never leave the
    // PREVIOUS organization's member rows rendered as if they belong to the
    // newly-selected organization (or scope, e.g. "all").
    setMembers([]);
    if (selectedOrg === "all") {
      // Fetch from all orgs
      try {
        setIsLoadingMembers(true);
        const allMembers: MembersConsoleMember[] = [];
        const failedOrgs: string[] = [];
        for (const org of organizations) {
          const response = await fetch(`/api/organizations/${org.id}/members`);
          if (response.ok) {
            const data = await response.json();
            allMembers.push(...(data.data || []));
          } else {
            failedOrgs.push(org.name);
          }
        }
        if (membersRequestRef.current !== requestId) return; // superseded
        setMembers(allMembers);
        if (failedOrgs.length > 0) {
          setMembersError(`Failed to load members for: ${failedOrgs.join(', ')}`);
        }
      } catch (error) {
        if (membersRequestRef.current !== requestId) return;
        setMembersError(error instanceof Error ? error.message : 'Failed to load members');
      } finally {
        if (membersRequestRef.current === requestId) setIsLoadingMembers(false);
      }
    } else {
      try {
        setIsLoadingMembers(true);
        const response = await fetch(`/api/organizations/${selectedOrg}/members`);
        if (!response.ok) {
          throw new Error(`Failed to load members (${response.status})`);
        }
        const data = await response.json();
        if (membersRequestRef.current !== requestId) return;
        setMembers(data.data || []);
      } catch (error) {
        if (membersRequestRef.current !== requestId) return;
        setMembersError(error instanceof Error ? error.message : 'Failed to load members');
      } finally {
        if (membersRequestRef.current === requestId) setIsLoadingMembers(false);
      }
    }
  }, [selectedOrg, organizations]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!isLoadingOrgs) {
      fetchMembers();
    }
  }, [fetchMembers, isLoadingOrgs]);

  return { stats, isLoadingStats, statsError, members, isLoadingMembers, membersError };
}
